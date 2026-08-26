// Phase 4 of the full-accuracy mapping project: bulk-import named rivers
// and streams, the piece phase 2 deliberately deferred (segmented into
// ~130K individual line pieces state-wide with no single natural "one row"
// geometry the way a lake basin has). Same overall approach as phase 2's
// lakes -- group real segments into one row per real river, upsert via
// upsert_catalog_waterbody -- but the grouping key differs by state because
// the underlying data differs by state, verified live before writing this:
//
//   WI: RIVER_SYS_WBIC is a real, stable per-river-SYSTEM id -- confirmed
//   live that all 19 segments of the real Bad River share one WBIC, the
//   same safe pattern already used for WI lakes. Grouped by it, same
//   collision-free guarantee lakes have.
//
//   MN: kittle_nbr is per-SEGMENT/reach, not per-river (confirmed live:
//   the Mississippi River's 83 MN segments each carry a different
//   kittle_nbr, e.g. "M-B003", "M-B004" -- there's no shared numeric id
//   the way dowlknum works for lakes). kittle_name is the only real
//   grouping key available, which reintroduces a lower-stakes version of
//   the same-name-different-water risk lakes had -- lower-stakes because
//   streams carry no depth/temp/clarity data to misattribute, only
//   identity and geometry, and a genuinely different real MN creek sharing
//   a name with another elsewhere in the state would (rare case) get its
//   segments merged into one multi-part row instead of two separate ones.
//   Documented here rather than silently accepted.
//
// Scope, MN: kittle_name IS NOT NULL, and strm_type_desc restricted to
// 'Centerline (River)' + 'Stream (Perennial)' -- the two categories that
// are real, natural, non-intermittent named waterways (verified live via
// a strm_type_desc breakdown before choosing this: excludes intermittent
// streams, administrative "Connector" lines, agricultural drainage
// ditches, and buried infrastructure like storm sewers/drain tile that
// happen to carry a name in this layer). 27,632 raw segments, not 133,523.
//
// Scope, WI: IN_STATE_CODE=1 (the real fix from the lake-matching bug) and
// named -- 27,351 raw segments, already correctly grouped down by real
// RIVER_SYS_WBIC, no further type filtering needed for correctness. Some
// WI rows still display as "Unnamed" despite the RIVER_SYS_NAME<>'Unnamed'
// filter -- confirmed harmless: those have a real, distinct WBIC each (no
// merging), just a genuinely blank name field in WI's own data for that
// reach, not the literal 'Unnamed' placeholder text this filter targets.
//
// STATUS, 2026-08-26: the first run of this script correctly excluded WI's
// literal 'Unnamed' placeholder but not MN's equivalent ('Unnamed Creek',
// 'Unnamed Ditch', etc.) -- MN has no real per-river id the way WI's WBIC
// is, so grouping by name merged every genuinely different, unrelated
// "Unnamed Creek" segment statewide into one nonsensical combined shape.
// Caught immediately after the run (2 such MN rows, not hundreds -- most
// literally-unnamed MN segments were already correctly cataloged one at a
// time, with a real per-segment dnr_hydro_id, by the live per-tap path
// from before this script ever ran). Fixed here by excluding
// /^unnamed\b/i names from MN's grouping entirely, matching WI's existing
// exclusion. The 2 already-bad rows from the first run were handed to the
// user to delete (low-impact -- nobody searches "Unnamed Creek" by name --
// but wrong is wrong) rather than silently left in place.

const url = process.env.FISHWIZZ_SUPABASE_URL;
if (!url) { console.error('FISHWIZZ_SUPABASE_URL not set -- run with --env-file=.env'); process.exit(1); }

const { execSync } = await import('node:child_process');
const svc = JSON.parse(execSync('npx -y supabase projects api-keys --project-ref doddeferfxzgdmzadibq', { encoding: 'utf8' }))
  .keys.find(k => k.id === 'service_role').api_key;

async function fetchJson(u, timeoutMs = 25000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(u, { signal: ctl.signal, headers: { 'user-agent': 'FishWizz/1.0' } });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${u}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

async function paginate(baseUrl, params, orderField, pageSize = 2000) {
  const all = [];
  let offset = 0;
  while (true) {
    const q = new URL(baseUrl);
    for (const [k, v] of Object.entries({ ...params, orderByFields: orderField, resultOffset: String(offset), resultRecordCount: String(pageSize) })) q.searchParams.set(k, v);
    const page = await fetchJson(q);
    if (page.error) throw new Error(`ArcGIS error: ${JSON.stringify(page.error)}`);
    const feats = page.features || [];
    all.push(...feats);
    process.stderr.write(`\r  fetched ${all.length}`);
    if (!feats.length) break; // don't trust "fewer than requested" -- see phase 2's own lesson
    offset += feats.length;
  }
  process.stderr.write('\n');
  return all;
}

function esriToGeoJSON(paths) {
  if (!Array.isArray(paths) || !paths.length) return null;
  return { type: 'MultiLineString', coordinates: paths };
}

function fallbackCentroid(paths) {
  const line = paths?.[0];
  if (!Array.isArray(line) || !line.length) return null;
  const mid = line[Math.floor(line.length / 2)];
  return { lon: mid[0], lat: mid[1] };
}

// Group raw segment features by a real key, merging every segment's own
// paths into one MultiLineString per key.
function groupAndMerge(feats, idOf, nameOf) {
  const byId = new Map();
  for (const f of feats) {
    const id = idOf(f.attributes || {});
    if (!id) continue;
    const paths = f.geometry?.paths;
    if (!Array.isArray(paths) || !paths.length) continue;
    const existing = byId.get(id);
    if (existing) existing.paths.push(...paths);
    else byId.set(id, { id, name: nameOf(f.attributes || {}), paths: [...paths] });
  }
  return [...byId.values()];
}

async function loadMn() {
  const feats = await paginate(
    'https://enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_dnr/water_dnr_hydrography/FeatureServer/0/query',
    { f: 'json', where: "kittle_name IS NOT NULL AND strm_type_desc IN ('Centerline (River)','Stream (Perennial)')", outFields: 'kittle_name', outSR: '4326', returnGeometry: 'true' },
    'objectid'
  );
  const norm = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  // Unlike WI's WBIC (a real per-river id), MN's kittle_name is the only
  // grouping key available -- fine for a real name, but "Unnamed Creek" /
  // "Unnamed Ditch" etc. are literal placeholder text MN's own data uses
  // for genuinely different, unrelated creek segments statewide. Grouping
  // by name would merge all of them into one nonsensical combined shape --
  // caught live on the first run (2 such rows), excluded here.
  const isGeneric = (s) => /^unnamed\b/i.test(String(s || '').trim());
  const merged = groupAndMerge(feats.filter(f => !isGeneric(f.attributes?.kittle_name)), a => norm(a.kittle_name), a => String(a.kittle_name || '').trim());
  return merged.map(m => {
    const c = fallbackCentroid(m.paths);
    const geom = esriToGeoJSON(m.paths);
    if (!c || !geom) return null;
    return {
      source_system: 'mn_dnr_streams', source_id: m.id, name: m.name,
      state_code: 'MN', water_type: 'stream', source_label: 'Minnesota DNR Rivers and Streams',
      lon: c.lon, lat: c.lat, geometry: geom,
    };
  }).filter(Boolean);
}

async function loadWi() {
  const feats = await paginate(
    'https://dnrmaps.wi.gov/arcgis/rest/services/DW_Map_Dynamic/EN_SurfaceWater_WTM_Ext_Dynamic_L16/MapServer/3/query',
    { f: 'json', where: "IN_STATE_CODE=1 AND RIVER_SYS_NAME<>'Unnamed'", outFields: 'RIVER_SYS_NAME,RIVER_SYS_WBIC', outSR: '4326', returnGeometry: 'true' },
    'OBJECTID'
  );
  const merged = groupAndMerge(feats, a => a.RIVER_SYS_WBIC ? String(a.RIVER_SYS_WBIC) : null, a => String(a.RIVER_SYS_NAME || 'Unnamed'));
  return merged.map(m => {
    const c = fallbackCentroid(m.paths);
    const geom = esriToGeoJSON(m.paths);
    if (!c || !geom) return null;
    return {
      source_system: 'wi_dnr_streams', source_id: m.id, name: m.name,
      state_code: 'WI', water_type: 'stream', source_label: 'Wisconsin DNR 24K Hydrography',
      lon: c.lon, lat: c.lat, geometry: geom,
    };
  }).filter(Boolean);
}

async function upsertOne(w) {
  const r = await fetch(`${url}/rest/v1/rpc/upsert_catalog_waterbody`, {
    method: 'POST',
    headers: { apikey: svc, authorization: 'Bearer ' + svc, 'content-type': 'application/json' },
    body: JSON.stringify({
      p_source_system: w.source_system, p_source_id: w.source_id, p_source_label: w.source_label,
      p_name: w.name, p_state_code: w.state_code, p_water_type: w.water_type,
      p_lon: w.lon, p_lat: w.lat, p_official_url: null, p_source_updated_at: null,
      p_geometry_geojson: JSON.stringify(w.geometry),
    }),
  });
  if (!r.ok) return { ok: false, error: await r.text() };
  return { ok: true };
}

async function upsertAll(rows, concurrency = 15) {
  let done = 0, failed = 0;
  const errors = [];
  for (let i = 0; i < rows.length; i += concurrency) {
    const batch = rows.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(upsertOne));
    for (let j = 0; j < results.length; j++) {
      if (results[j].ok) done++;
      else { failed++; if (errors.length < 10) errors.push({ name: batch[j].name, error: results[j].error }); }
    }
    process.stderr.write(`\r  upserted ${done + failed}/${rows.length} (${failed} failed)`);
  }
  process.stderr.write('\n');
  if (errors.length) { console.log('Sample errors:'); errors.forEach(e => console.log(' -', e.name, e.error)); }
  return { done, failed };
}

async function main() {
  console.log('==> Fetching MN named rivers/perennial streams...');
  const mn = await loadMn();
  console.log(`    ${mn.length} distinct MN rivers/streams (grouped by name)`);

  console.log('==> Fetching WI named rivers/streams...');
  const wi = await loadWi();
  console.log(`    ${wi.length} distinct WI rivers/streams (grouped by real RIVER_SYS_WBIC)`);

  const all = [...mn, ...wi];
  console.log(`==> Total: ${all.length} rivers/streams to upsert`);

  console.log('==> Upserting via upsert_catalog_waterbody...');
  const { done, failed } = await upsertAll(all);
  console.log(`==> Done. ${done} upserted, ${failed} failed.`);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
