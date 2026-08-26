// Phase 2 of the full-accuracy mapping project: bulk-import every named,
// real lake/pond basin in Minnesota and Wisconsin into `waterbodies`, with
// real shoreline geometry -- not just the small subset a live tap happens
// to have cached so far.
//
//   node --env-file=.env scripts/import-waterbodies-lakes.mjs
//
// Scope, per the user's own choice (named/significant, not every mapped
// feature): MN's Public Waters Basins filtered to pwi_class='P' (a real
// lake/pond basin, not a "W" wetland classification) with a real name
// (pw_basin_name <> 'Unnamed') -- 8,203 rows, verified live before writing
// this. WI's 24K hydro waterbody layer, filtered to IN_STATE_CODE=1 (the
// real in-state field -- see the atlas-nearby-waters fix) with a real name
// -- 10,306 rows, also verified live. Both counts confirmed every matching
// row has a real, non-zero unique id (dowlknum / WATERBODY_WBIC) before
// this was written, so there's no name-collision risk the way the old
// dnr_hydro_id fallback had (see the matching fix in atlas-nearby-waters
// and atlas-water-catalog, deployed alongside this).
//
// Reuses the same upsert_catalog_waterbody RPC the app's own edge functions
// already call per-tap -- same column mapping, same server-side centroid
// derivation from real geometry (PostGIS ST_Centroid, not a vertex
// average). Idempotent: the RPC upserts on (source_system, source_id).
//
// Rivers/streams are NOT included in this pass -- MN's named-stream count
// alone is in the thousands, segmented into ~130K individual pieces with no
// single natural "one row" geometry, and live per-tap stream matching
// already works correctly (only the WI lake/stream cross-border bug was
// broken, and that's fixed). Left for a separate, smaller pass if wanted.

const url = process.env.FISHWIZZ_SUPABASE_URL;
if (!url) { console.error('FISHWIZZ_SUPABASE_URL not set -- run with --env-file=.env'); process.exit(1); }

const { execSync } = await import('node:child_process');
const svc = JSON.parse(execSync('npx --no-install supabase projects api-keys --project-ref doddeferfxzgdmzadibq', { encoding: 'utf8' }))
  .keys.find(k => k.id === 'service_role').api_key;

async function fetchJson(u, timeoutMs = 20000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(u, { signal: ctl.signal, headers: { 'user-agent': 'FishWizz/1.0' } });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${u}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

async function paginate(baseUrl, params, orderField, pageSize = 2000) {
  // Do NOT treat "got fewer than requested" as "last page" -- the first run
  // of this script found a WI query silently capping each page at 1000
  // regardless of a resultRecordCount=2000 request (a different effective
  // limit than this same service's own advertised maxRecordCount for an
  // unfiltered query), which made that rule stop after page 1 and silently
  // drop 9,306 of 10,306 real rows. Keep paging until a page comes back
  // genuinely empty instead.
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
    if (!feats.length) break;
    offset += feats.length;
  }
  process.stderr.write('\n');
  return all;
}

// Esri polygon rings -> GeoJSON MultiPolygon, same convention
// atlas-nearby-waters uses -- every ring its own polygon rather than
// assuming later rings are holes in the first.
function esriToGeoJSON(g) {
  if (!g) return null;
  if (Array.isArray(g.rings) && g.rings.length) return { type: 'MultiPolygon', coordinates: g.rings.map(r => [r]) };
  return null;
}

// Cheap fallback point (vertex average of the outer ring) passed alongside
// the real geometry -- upsert_catalog_waterbody derives the true PostGIS
// centroid from geometry when it's supplied, this is just a non-null
// placeholder in case that ever isn't the case for some row.
function fallbackCentroid(g) {
  const ring = g?.rings?.[0];
  if (!Array.isArray(ring) || !ring.length) return null;
  const lon = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  return { lon, lat };
}

// Some real lakes are split across multiple polygon features sharing one
// DOW/WBIC number (an island, a narrows, a survey-sheet split) -- the
// second run's "Elk"/"Sugar Camp Creek" failures were exactly this:  two
// features, same source_id, dispatched in the same concurrent upsert batch,
// racing on the atlas_id unique index (derived from source_system+source_id,
// so identical) in a way ON CONFLICT's (source_system, source_id) target
// doesn't serialize against. Group by source_id and merge every duplicate's
// rings into one MultiPolygon instead of discarding or racing on them --
// more complete geometry, and there's only ever one row per source_id by
// construction, so no concurrent duplicate can reach the upsert step at all.
function groupAndMerge(feats, idOf, nameOf) {
  const byId = new Map();
  for (const f of feats) {
    const id = idOf(f.attributes || {});
    if (!id || id === '0') continue;
    const rings = f.geometry?.rings;
    if (!Array.isArray(rings) || !rings.length) continue;
    const existing = byId.get(id);
    if (existing) existing.rings.push(...rings);
    else byId.set(id, { id, name: nameOf(f.attributes || {}), rings: [...rings] });
  }
  return [...byId.values()];
}

async function loadMn() {
  const feats = await paginate(
    'https://enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_dnr/water_mn_public_waters/FeatureServer/1/query',
    { f: 'json', where: "pwi_class='P' AND pw_basin_name<>'Unnamed'", outFields: 'dowlknum,pw_basin_name,gnis_name,acres,shore_mi', outSR: '4326', returnGeometry: 'true' },
    'objectid'
  );
  const merged = groupAndMerge(feats, a => a.dowlknum ? String(a.dowlknum) : null, a => String(a.pw_basin_name || a.gnis_name || 'Unnamed'));
  return merged.map(m => {
    const c = fallbackCentroid({ rings: m.rings });
    const geom = esriToGeoJSON({ rings: m.rings });
    if (!c || !geom) return null;
    return {
      source_system: 'mn_dnr_basins', source_id: m.id, name: m.name,
      state_code: 'MN', water_type: 'lake', source_label: 'Minnesota DNR Public Waters',
      lon: c.lon, lat: c.lat, geometry: geom,
    };
  }).filter(Boolean);
}

async function loadWi() {
  const feats = await paginate(
    'https://dnrmaps.wi.gov/arcgis/rest/services/DW_Map_Dynamic/EN_SurfaceWater_WTM_Ext_Dynamic_L16/MapServer/5/query',
    { f: 'json', where: "IN_STATE_CODE=1 AND WATERBODY_NAME<>'Unnamed'", outFields: 'WATERBODY_WBIC,WATERBODY_NAME', outSR: '4326', returnGeometry: 'true' },
    'OBJECTID'
  );
  const merged = groupAndMerge(feats, a => a.WATERBODY_WBIC ? String(a.WATERBODY_WBIC) : null, a => String(a.WATERBODY_NAME || 'Unnamed'));
  return merged.map(m => {
    const c = fallbackCentroid({ rings: m.rings });
    const geom = esriToGeoJSON({ rings: m.rings });
    if (!c || !geom) return null;
    return {
      source_system: 'wi_dnr_lakes', source_id: m.id, name: m.name,
      state_code: 'WI', water_type: 'lake', source_label: 'Wisconsin DNR 24K Hydrography',
      lon: c.lon, lat: c.lat, geometry: geom,
    };
  }).filter(Boolean);
}

async function upsertOne(admin, w) {
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
    const results = await Promise.all(batch.map(w => upsertOne(null, w)));
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

async function expectedCount(baseUrl, where) {
  const q = new URL(baseUrl);
  q.searchParams.set('f', 'json'); q.searchParams.set('where', where); q.searchParams.set('returnCountOnly', 'true');
  return (await fetchJson(q)).count;
}

async function main() {
  const mnExpected = await expectedCount('https://enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_dnr/water_mn_public_waters/FeatureServer/1/query', "pwi_class='P' AND pw_basin_name<>'Unnamed'");
  console.log(`==> Fetching MN named lake basins (pwi_class=P, named) -- expecting ${mnExpected} features...`);
  const mn = await loadMn();
  console.log(`    ${mn.length} usable MN rows (from ${mnExpected} raw features -- fewer means some share a dowlknum and got merged, not lost)`);

  const wiExpected = await expectedCount('https://dnrmaps.wi.gov/arcgis/rest/services/DW_Map_Dynamic/EN_SurfaceWater_WTM_Ext_Dynamic_L16/MapServer/5/query', "IN_STATE_CODE=1 AND WATERBODY_NAME<>'Unnamed'");
  console.log(`==> Fetching WI named waterbodies (IN_STATE_CODE=1, named) -- expecting ${wiExpected} features...`);
  const wi = await loadWi();
  console.log(`    ${wi.length} usable WI rows (from ${wiExpected} raw features -- fewer means some share a WBIC and got merged, not lost)`);

  const all = [...mn, ...wi];
  console.log(`==> Total: ${all.length} lakes to upsert`);

  console.log('==> Upserting via upsert_catalog_waterbody (real PostGIS centroid + shoreline geometry)...');
  const { done, failed } = await upsertAll(all);
  console.log(`==> Done. ${done} upserted, ${failed} failed.`);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
