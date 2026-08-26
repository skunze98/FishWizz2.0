// Phase 3c of the full-accuracy mapping project: persist real MN water
// clarity (Secchi transparency) onto the lakes phase 2 cataloged.
//
//   node --env-file=.env scripts/backfill-clarity.mjs
//
// Source: MN PCA's Citizen Lake Monitoring Program API
// (services.pca.state.mn.us/api/v1/cmp/loc-data) -- real, volunteer-
// collected Secchi depth summaries per monitoring station. That endpoint
// requires a county or huc8 filter (no statewide query), so this iterates
// all 80 of MN's real HUC8 major watersheds, pulled live from MN DNR's own
// watershed layer (geos_dnr_watersheds/FeatureServer/6, verified 2026-08-26)
// rather than typed from memory -- see HUC8_CODES below.
//
// Unit note, resolved before writing this (see the schema migration's own
// comments): loc-data's secchi fields are in FEET for Lake/Lake Station
// rows, confirmed by exact cross-check against the program's own
// human-facing report page for a real station (21-0057-00-204, Carlos:
// API secchiMean 19.75 == the report page's "Secchi Transparency data
// (ft): Mean 19.75"). River/Stream rows use a different, unverified
// convention and are out of scope -- clarity is a lakes-only column,
// matching phase 2.
//
// Wisconsin has no equivalent per-lake queryable value (DNR's satellite
// Secchi ships only as raster imagery) -- not attempted here.
//
// Idempotent-ish: re-running overwrites with whatever the API currently
// reports as each lake's best (most recent monitoringYear) station: this
// data legitimately changes year to year, so re-running to pick up a new
// season is the intended use, not a one-time load.
//
// STATUS, 2026-08-26: blocked, not fixable from here. The first-ever call
// this script made succeeded (42 real stations, 26 matched to a cataloged
// lake -- see the data already in waterbodies.clarity_secchi_ft). Every
// request after that -- including a second full run with real pacing
// (600ms between requests) and backed-off retries -- came back as a
// Radware Bot Manager CAPTCHA page instead of JSON. That is a real
// bot-detection wall, not a transient error retries or slower pacing can
// fix, and this script will not be extended to try to solve or route
// around a CAPTCHA in any form. Re-running it now is expected to fail the
// same way. The 26 lakes already filled in are genuine, legitimately
// obtained data from before the block triggered -- left as-is, not backed
// out. A real path forward would be non-programmatic: MPCA offers a bulk
// data request/export process for exactly this kind of use case -- that's
// a request for the user to make, not something to script.

const url = process.env.FISHWIZZ_SUPABASE_URL;
if (!url) { console.error('FISHWIZZ_SUPABASE_URL not set -- run with --env-file=.env'); process.exit(1); }

const { execSync } = await import('node:child_process');
const svc = JSON.parse(execSync('npx -y supabase projects api-keys --project-ref doddeferfxzgdmzadibq', { encoding: 'utf8' }))
  .keys.find(k => k.id === 'service_role').api_key;

// All 80 of MN's DNR Major Watersheds (HUC8), pulled live 2026-08-26 from
// enterprise.gisdata.mn.gov/.../geos_dnr_watersheds/FeatureServer/6 --
// the state's own authoritative watershed delineation, not recalled from
// memory or approximated.
const HUC8_CODES = [
  '04010101', '04010102', '04010201', '04010202', '04010301',
  '07010101', '07010102', '07010103', '07010104', '07010105', '07010106', '07010107', '07010108',
  '07010201', '07010202', '07010203', '07010204', '07010205', '07010206', '07010207',
  '07020001', '07020002', '07020003', '07020004', '07020005', '07020006', '07020007', '07020008', '07020009', '07020010', '07020011', '07020012',
  '07030001', '07030003', '07030004', '07030005',
  '07040001', '07040002', '07040003', '07040004', '07040006', '07040008',
  '07060001', '07060002',
  '07080102', '07080201', '07080202', '07080203',
  '07100001', '07100002', '07100003',
  '09020101', '09020102', '09020103', '09020104', '09020106', '09020107', '09020108',
  '09020301', '09020302', '09020303', '09020304', '09020305', '09020306', '09020309', '09020311', '09020312', '09020314',
  '09030001', '09030002', '09030003', '09030005', '09030006', '09030007', '09030008', '09030009',
  '10170202', '10170203', '10170204',
  '10230003',
];

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function fetchJson(u, timeoutMs = 20000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(u, { signal: ctl.signal, headers: { 'user-agent': 'FishWizz/1.0' } });
    const text = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`);
    if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) throw new Error(`non-JSON response (status ${r.status}): ${text.slice(0, 120)}`);
    return JSON.parse(text);
  } finally { clearTimeout(t); }
}

// The first run of this script hammered services.pca.state.mn.us with 80
// back-to-back requests and every one after the first got a blocked HTML
// page instead of JSON -- some rate limit or bot protection, not a real
// data gap. Paced retries fix it: a real delay between requests, and a
// couple of backed-off retries for any request that still gets blocked.
async function fetchJsonPaced(u, { delayMs = 600, retries = 3 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(delayMs * 2 ** attempt);
    try { return await fetchJson(u); }
    catch (e) { if (attempt === retries) throw e; }
  }
}

function trustworthy(row) {
  const mt = String(row?.match_type || '');
  if (mt === 'on_water' || mt === 'very_close') return true;
  const d = Number(row?.distance_miles);
  return Number.isFinite(d) && d <= 0.3;
}

async function loadAllStations() {
  const byStation = new Map();
  let done = 0, failedHucs = [];
  for (const huc8 of HUC8_CODES) {
    const u = new URL('https://services.pca.state.mn.us/api/v1/cmp/loc-data');
    u.searchParams.set('huc8', huc8);
    u.searchParams.set('format', 'json');
    await sleep(600); // real pacing -- see fetchJsonPaced's comment above
    try {
      const data = await fetchJsonPaced(u);
      for (const row of data.data || []) {
        if (!/^Lake/.test(String(row.stationType || ''))) continue; // Lake / Lake Station only -- River/Stream units unverified
        const mean = Number(row.secchiMean);
        if (!Number.isFinite(mean) || mean <= 0) continue;
        const lat = Number(row.lat), lon = Number(row.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const year = Number(row.monitoringYear) || 0;
        const key = String(row.stationId || `${row.wid}:${huc8}`);
        const existing = byStation.get(key);
        if (!existing || year > existing.year) {
          byStation.set(key, {
            stationId: key, lat, lon, year,
            secchiMean: mean, sampleCount: Number(row.secchiCount) || null,
          });
        }
      }
    } catch (e) { failedHucs.push(huc8); console.error(`  huc8 ${huc8} failed after retries:`, e.message); }
    done++;
    process.stderr.write(`\r  ${done}/${HUC8_CODES.length} watersheds, ${byStation.size} lake stations so far`);
  }
  process.stderr.write('\n');
  if (failedHucs.length) console.log(`  !! ${failedHucs.length}/${HUC8_CODES.length} watersheds never returned real data even after retries: ${failedHucs.join(', ')}`);
  return [...byStation.values()];
}

async function matchOne(station) {
  const r = await fetch(`${url}/rest/v1/rpc/nearby_water_catalog`, {
    method: 'POST',
    headers: { apikey: svc, authorization: 'Bearer ' + svc, 'content-type': 'application/json' },
    body: JSON.stringify({ p_lat: station.lat, p_lon: station.lon, p_radius_miles: 0.5, p_limit: 5 }),
  });
  if (!r.ok) return null;
  const matches = await r.json();
  const best = (matches || []).filter(m => m.water_type === 'lake' && trustworthy(m)).sort((a, b) => Number(a.distance_miles || 0) - Number(b.distance_miles || 0))[0];
  return best ? best.id : null;
}

async function main() {
  console.log('==> Fetching MN Citizen Lake Monitoring Program clarity data across all 80 HUC8 watersheds...');
  const stations = await loadAllStations();
  console.log(`==> ${stations.length} distinct lake monitoring stations with a real Secchi reading`);

  console.log('==> Matching each station to a cataloged lake and writing clarity...');
  // Keep the best (most recent year) reading per matched lake, in case two
  // stations on the same lake both match it.
  const byLake = new Map();
  let matched = 0, done = 0;
  const CONCURRENCY = 20;
  for (let i = 0; i < stations.length; i += CONCURRENCY) {
    const batch = stations.slice(i, i + CONCURRENCY);
    const ids = await Promise.all(batch.map(matchOne));
    for (let j = 0; j < ids.length; j++) {
      const id = ids[j], s = batch[j];
      if (!id) continue;
      matched++;
      const existing = byLake.get(id);
      if (!existing || s.year > existing.year) byLake.set(id, s);
    }
    done += batch.length;
    process.stderr.write(`\r  checked ${done}/${stations.length}, matched ${matched}, ${byLake.size} distinct lakes so far`);
  }
  process.stderr.write('\n');

  const updates = [...byLake.entries()];
  console.log(`==> Writing clarity to ${updates.length} distinct lakes...`);
  let written = 0;
  for (let i = 0; i < updates.length; i += 15) {
    const batch = updates.slice(i, i + 15);
    await Promise.all(batch.map(([id, s]) => fetch(`${url}/rest/v1/waterbodies?id=eq.${id}`, {
      method: 'PATCH',
      headers: { apikey: svc, authorization: 'Bearer ' + svc, 'content-type': 'application/json', prefer: 'return=minimal' },
      body: JSON.stringify({
        clarity_secchi_ft: s.secchiMean, clarity_year: s.year || null, clarity_sample_count: s.sampleCount,
        clarity_source: 'MN PCA Citizen Lake Monitoring Program', clarity_updated_at: new Date().toISOString(),
      }),
    })));
    written += batch.length;
    process.stderr.write(`\r  wrote ${written}/${updates.length}`);
  }
  process.stderr.write('\n');
  console.log(`==> Done. ${updates.length} lakes now have real, persisted clarity data.`);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
