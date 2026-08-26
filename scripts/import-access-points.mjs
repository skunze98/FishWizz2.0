// Phase 1 of the full-accuracy mapping project: bulk-import EVERY official
// public water-access site in Minnesota and Wisconsin, not just the ones a
// live tap happens to trigger caching for. Same two sources and field
// mapping atlas-water-access already uses per-request; this pulls all of
// them once via pagination instead of a radius query around one point.
//
//   node --env-file=.env scripts/import-access-points.mjs
//
// Needs FISHWIZZ_SUPABASE_URL in .env and the project's service_role key
// (fetched fresh each run via `supabase projects api-keys`, never stored).
//
// Idempotent: upserts on (source_system, source_id), the same real,
// DNR-assigned unique ID atlas-water-access already keys on -- safe to
// re-run to pick up new/changed sites later.
//
// Leaves waterbody_id null except for a best-effort name match against
// whatever is in `waterbodies` right now. Most of these 6,000+ access
// points won't have a resolved water yet until the water-body catalog
// import (phase 2) lands -- a follow-up linking pass reconciles this
// properly once that exists, rather than guessing here.

import { execSync } from 'node:child_process';

const url = process.env.FISHWIZZ_SUPABASE_URL;
if (!url) { console.error('FISHWIZZ_SUPABASE_URL not set -- run with --env-file=.env'); process.exit(1); }

const svc = JSON.parse(execSync('npx --no-install supabase projects api-keys --project-ref doddeferfxzgdmzadibq', { encoding: 'utf8' }))
  .keys.find(k => k.id === 'service_role').api_key;

async function fetchJson(u, timeoutMs = 15000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(u, { signal: ctl.signal, headers: { 'user-agent': 'FishWizz/1.0' } });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${u}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

async function paginate(baseUrl, params, pageSize = 2000) {
  // orderByFields is required for stable, non-overlapping pages -- without
  // an explicit order, ArcGIS REST doesn't guarantee the same row can't show
  // up on two different resultOffset pages, which is exactly what produced
  // duplicate (source_system, source_id) pairs in the same upsert batch on
  // the first run of this script.
  const all = [];
  let offset = 0;
  while (true) {
    const q = new URL(baseUrl);
    for (const [k, v] of Object.entries({ orderByFields: 'objectid', ...params, resultOffset: String(offset), resultRecordCount: String(pageSize) })) q.searchParams.set(k, v);
    const page = await fetchJson(q);
    const feats = page.features || [];
    all.push(...feats);
    if (feats.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

// Same normalization atlas-water-access/index.ts uses -- kept in lockstep so
// a site cached from a live tap and one from this bulk import land in the
// same bucket.
function normalizeMnType(t) {
  const s = (t || '').toLowerCase();
  if (s.includes('carry')) return 'Canoe / kayak / carry-in';
  if (s.includes('trailer') || s.includes('ramp')) return 'Boat launch';
  return t || 'Public access';
}
function normalizeWiRamp(landing, ramp) {
  const s = `${landing || ''} ${ramp || ''}`.toLowerCase();
  if (s.includes('carry') || s.includes('hand')) return 'Canoe / kayak / carry-in';
  if (s.includes('ramp') || s.includes('trailer') || s.includes('boat')) return 'Boat launch';
  return 'Boat launch';
}

async function loadMn() {
  const feats = await paginate(
    'https://enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_dnr/struc_water_access_sites/FeatureServer/0/query',
    { f: 'json', where: '1=1', outFields: 'unique_swas_id,access_name,launch_type,administrator,lake_name,accessible_parking_spaces,dow_lake_id', outSR: '4326', returnGeometry: 'true' }
  );
  return feats.map(f => {
    const a = f.attributes || {}, g = f.geometry || {};
    if (!Number.isFinite(g.x) || !Number.isFinite(g.y)) return null;
    return {
      source_system: 'mn_dnr_water_access',
      source_id: String(a.unique_swas_id || a.access_name || `${g.x},${g.y}`),
      name: String(a.access_name || a.lake_name || 'Public water access'),
      access_type: normalizeMnType(String(a.launch_type || '')),
      administrator: a.administrator || null,
      ada_accessible: Number(a.accessible_parking_spaces || 0) > 0,
      lat: g.y, lon: g.x,
      source_url: 'https://www.dnr.state.mn.us/water_access/index.html',
      water_name_hint: a.lake_name || null,
    };
  }).filter(Boolean);
}

async function loadWi() {
  const base = 'https://dnrmaps.wi.gov/arcgis2/rest/services/PR_Recreation/PR_Boat_Access_Shore_Fishing_WTM_Ext/MapServer';
  const [boatFeats, shoreFeats] = await Promise.all([
    paginate(`${base}/2/query`, { f: 'json', where: '1=1', outFields: 'BOATLANDING_SEQ_NO,LMS_BOAT_LANDING_NAME,LANDING_TYPE_CODE,RAMP_TYPE_CODE,ADA_ACCESSIBLE_FEATURE_CODE,OWNERSHIP_NAME_TEXT,WATERBODY_NAME_TEXT', outSR: '4326', returnGeometry: 'true', orderByFields: 'OBJECTID' }),
    paginate(`${base}/1/query`, { f: 'json', where: '1=1', outFields: 'SHOREFISH_SEQ_NO,FACILITY_NAME_TEXT,WATERBODY_NAME_TEXT,MORE_INFO_URL', outSR: '4326', returnGeometry: 'true', orderByFields: 'OBJECTID' }),
  ]);
  const boat = boatFeats.map(f => {
    const a = f.attributes || {}, g = f.geometry || {};
    if (!Number.isFinite(g.x) || !Number.isFinite(g.y)) return null;
    return {
      source_system: 'wi_dnr_boat_access',
      source_id: String(a.BOATLANDING_SEQ_NO || a.LMS_BOAT_LANDING_NAME || `${g.x},${g.y}`),
      name: String(a.LMS_BOAT_LANDING_NAME || a.WATERBODY_NAME_TEXT || 'Public boat access'),
      access_type: normalizeWiRamp(String(a.LANDING_TYPE_CODE || ''), String(a.RAMP_TYPE_CODE || '')),
      administrator: a.OWNERSHIP_NAME_TEXT || null,
      ada_accessible: /y|yes|true/i.test(String(a.ADA_ACCESSIBLE_FEATURE_CODE || '')),
      lat: g.y, lon: g.x,
      source_url: 'https://dnr.wisconsin.gov/topic/lands/boataccess',
      water_name_hint: a.WATERBODY_NAME_TEXT || null,
    };
  }).filter(Boolean);
  const shore = shoreFeats.map(f => {
    const a = f.attributes || {}, g = f.geometry || {};
    if (!Number.isFinite(g.x) || !Number.isFinite(g.y)) return null;
    return {
      source_system: 'wi_dnr_shore_fishing',
      source_id: String(a.SHOREFISH_SEQ_NO || a.FACILITY_NAME_TEXT || `${g.x},${g.y}`),
      name: String(a.FACILITY_NAME_TEXT || a.WATERBODY_NAME_TEXT || 'Shore fishing site'),
      access_type: 'Shore fishing',
      administrator: null,
      ada_accessible: null,
      lat: g.y, lon: g.x,
      source_url: a.MORE_INFO_URL || 'https://dnr.wisconsin.gov/topic/lands/boataccess',
      water_name_hint: a.WATERBODY_NAME_TEXT || null,
    };
  }).filter(Boolean);
  return [...boat, ...shore];
}

function norm(s) { return String(s || '').toLowerCase().replace(/\b(lake|river|stream|creek|flowage|reservoir|pond)\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }

async function fetchAllWaterbodies() {
  const rows = [];
  let offset = 0;
  while (true) {
    const r = await fetch(`${url}/rest/v1/waterbodies?select=id,name,state_code&order=id&limit=1000&offset=${offset}`, { headers: { apikey: svc, authorization: 'Bearer ' + svc } });
    const batch = await r.json();
    if (!Array.isArray(batch) || !batch.length) break;
    rows.push(...batch);
    offset += batch.length;
    if (batch.length < 1000) break;
  }
  return rows;
}

async function upsertBatch(rows, batchSize = 200) {
  let done = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize).map(r => ({
      waterbody_id: r.waterbody_id || null,
      source_system: r.source_system,
      source_id: r.source_id,
      name: r.name,
      access_type: r.access_type,
      location: `SRID=4326;POINT(${r.lon} ${r.lat})`,
      public_status: r.administrator,
      source_url: r.source_url,
      source_updated_at: new Date().toISOString(),
    }));
    const res = await fetch(`${url}/rest/v1/public_access_points?on_conflict=source_system,source_id`, {
      method: 'POST',
      headers: { apikey: svc, authorization: 'Bearer ' + svc, 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      console.error('batch failed', res.status, await res.text());
      process.exit(1);
    }
    done += batch.length;
    process.stderr.write(`\rupserted ${done}/${rows.length}`);
  }
  process.stderr.write('\n');
}

async function main() {
  console.log('==> Fetching MN access sites (paginated)...');
  const mn = await loadMn();
  console.log(`    ${mn.length} MN sites`);

  console.log('==> Fetching WI access sites (paginated)...');
  const wi = await loadWi();
  console.log(`    ${wi.length} WI sites`);

  const all = [...mn, ...wi];
  console.log(`==> Total: ${all.length} access points`);

  console.log('==> Best-effort name match against existing waterbodies catalog...');
  const waterbodies = await fetchAllWaterbodies();
  const byNormName = new Map();
  for (const w of waterbodies) {
    const key = `${w.state_code}:${norm(w.name)}`;
    if (key.endsWith(':') ) continue;
    if (!byNormName.has(key)) byNormName.set(key, w.id);
  }
  let linked = 0;
  for (const r of all) {
    const state = r.source_system.startsWith('mn_') ? 'MN' : 'WI';
    const hint = r.water_name_hint || r.name;
    const key = `${state}:${norm(hint)}`;
    const wid = byNormName.get(key);
    if (wid) { r.waterbody_id = wid; linked++; }
  }
  console.log(`    ${linked}/${all.length} linked to an existing cataloged water; the rest wait on the water-body catalog import.`);

  // Safety net regardless of the pagination fix above: a batch containing
  // two rows with the same (source_system, source_id) makes Postgres's
  // ON CONFLICT DO UPDATE fail outright ("cannot affect row a second time"),
  // so de-dupe defensively rather than trust upstream pagination alone.
  const seen = new Map();
  for (const r of all) seen.set(`${r.source_system}:${r.source_id}`, r);
  const deduped = [...seen.values()];
  if (deduped.length !== all.length) console.log(`==> Deduped ${all.length - deduped.length} rows with a repeated (source_system, source_id).`);

  console.log('==> Upserting into public_access_points...');
  await upsertBatch(deduped);

  console.log('==> Done.');
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
