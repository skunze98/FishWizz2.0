// Phase 3b of the full-accuracy mapping project: persist max depth for
// every lake phase 2 cataloged, instead of only ever computing it live on
// a tap. Same two real sources atlas-water-depth already queries live --
// this just backfills the summary onto the row so it's instantly known.
//
//   node --env-file=.env scripts/backfill-depth.mjs
//
// Efficient by construction: phase 2 already gave every lake a real
// dowlknum (MN) or WBIC (WI) as its source_id, and both DNR services can be
// queried directly `WHERE dowlknum IN (...)` / `WHERE WBIC IN (...)` in
// batches -- no spatial tiling or one-request-per-lake needed.

const url = process.env.FISHWIZZ_SUPABASE_URL;
if (!url) { console.error('FISHWIZZ_SUPABASE_URL not set -- run with --env-file=.env'); process.exit(1); }

const { execSync } = await import('node:child_process');
const svc = JSON.parse(execSync('npx -y supabase projects api-keys --project-ref doddeferfxzgdmzadibq', { encoding: 'utf8' }))
  .keys.find(k => k.id === 'service_role').api_key;

async function fetchJson(u, timeoutMs = 20000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(u, { signal: ctl.signal, headers: { 'user-agent': 'FishWizz/1.0' } });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${u}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

async function fetchAll(table, select, filter) {
  const rows = [];
  let offset = 0;
  while (true) {
    const r = await fetch(`${url}/rest/v1/${table}?${filter}&select=${select}&order=id&limit=1000&offset=${offset}`, { headers: { apikey: svc, authorization: 'Bearer ' + svc } });
    const batch = await r.json();
    if (!Array.isArray(batch) || !batch.length) break;
    rows.push(...batch);
    offset += batch.length;
    if (batch.length < 1000) break;
  }
  return rows;
}

function chunk(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }

async function backfillMn() {
  const lakes = await fetchAll('waterbodies', 'id,source_id', "source_system=eq.mn_dnr_basins");
  console.log(`==> ${lakes.length} MN lakes to check against DNR bathymetry survey`);
  const byDow = new Map(lakes.map(l => [String(l.source_id), l.id]));
  const base = 'https://enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_dnr/water_lake_bathymetry/MapServer/0/query';
  const maxByDow = new Map();
  // 30 lakes per batch, not 80: this layer's own maxRecordCount is 2,000
  // features (confirmed live), and a single batch's total contour count is
  // unpredictable -- some real lakes carry hundreds of contour rings. Small
  // batches keep any one request well clear of that cap; exceededTransferLimit
  // is still checked and logged so a real truncation is visible, not silent.
  const groups = chunk([...byDow.keys()], 30);
  let done = 0, truncatedBatches = 0;
  for (const g of groups) {
    const where = `dowlknum IN (${g.map(d => `'${d}'`).join(',')})`;
    const q = new URL(base);
    for (const [k, v] of Object.entries({ f: 'json', where, outFields: 'dowlknum,abs_depth,depth', returnGeometry: 'false', resultRecordCount: '2000' })) q.searchParams.set(k, v);
    try {
      const data = await fetchJson(q, 25000);
      if (data.exceededTransferLimit) truncatedBatches++;
      for (const f of data.features || []) {
        const dow = String(f.attributes?.dowlknum || '');
        const d = Number(f.attributes?.abs_depth ?? f.attributes?.depth ?? 0);
        if (!dow || !Number.isFinite(d)) continue;
        if (!maxByDow.has(dow) || d > maxByDow.get(dow)) maxByDow.set(dow, d);
      }
    } catch (e) { console.error('  MN batch failed:', e.message); }
    done += g.length;
    process.stderr.write(`\r  checked ${done}/${byDow.size} dowlknums, ${maxByDow.size} surveyed so far`);
  }
  process.stderr.write('\n');
  if (truncatedBatches) console.log(`  !! ${truncatedBatches} batches hit exceededTransferLimit -- some max depths in those batches may be understated. Re-run with a smaller batch size if this is nonzero.`);

  const updates = [...maxByDow.entries()].map(([dow, maxDepth]) => ({
    id: byDow.get(dow), max_depth_ft: maxDepth, depth_kind: 'contour_survey',
    depth_source: 'Minnesota DNR Lake Bathymetric Contours', depth_updated_at: new Date().toISOString(),
  }));
  console.log(`==> ${updates.length} MN lakes have a real DNR survey on file -- writing...`);
  await writeUpdates(updates);
  return updates.length;
}

async function backfillWi() {
  const lakes = await fetchAll('waterbodies', 'id,source_id', "source_system=eq.wi_dnr_lakes");
  console.log(`==> ${lakes.length} WI lakes to check against WDNR reported max depth`);
  const byWbic = new Map(lakes.map(l => [String(l.source_id), l.id]));
  const base = 'https://dnrmaps.wi.gov/arcgis/rest/services/WT_SWDV/WY_NATURAL_COMMUNITY_MODELING/MapServer/0/query';
  const found = new Map();
  const groups = chunk([...byWbic.keys()], 150);
  let done = 0;
  for (const g of groups) {
    const where = `WBIC IN (${g.join(',')}) AND MAX_DEPTH IS NOT NULL`;
    const q = new URL(base);
    for (const [k, v] of Object.entries({ f: 'json', where, outFields: 'WBIC,MAX_DEPTH,MAX_DEPTH_UNITS,MAX_DEPTH_SOURCE', returnGeometry: 'false', resultRecordCount: '2000' })) q.searchParams.set(k, v);
    try {
      const data = await fetchJson(q, 25000);
      for (const f of data.features || []) {
        const a = f.attributes || {};
        const wbic = String(a.WBIC || '');
        const d = Number(a.MAX_DEPTH);
        if (!wbic || !Number.isFinite(d) || String(a.MAX_DEPTH_UNITS || '').toUpperCase() !== 'FEET') continue;
        found.set(wbic, { depth: d, source: a.MAX_DEPTH_SOURCE || 'Wisconsin DNR' });
      }
    } catch (e) { console.error('  WI batch failed:', e.message); }
    done += g.length;
    process.stderr.write(`\r  checked ${done}/${byWbic.size} WBICs, ${found.size} with a reported depth so far`);
  }
  process.stderr.write('\n');

  const updates = [...found.entries()].map(([wbic, v]) => ({
    id: byWbic.get(wbic), max_depth_ft: v.depth, depth_kind: 'reported_max',
    depth_source: v.source, depth_updated_at: new Date().toISOString(),
  }));
  console.log(`==> ${updates.length} WI lakes have a reported max depth on file -- writing...`);
  await writeUpdates(updates);
  return updates.length;
}

async function writeUpdates(updates, concurrency = 15) {
  let done = 0;
  for (let i = 0; i < updates.length; i += concurrency) {
    const batch = updates.slice(i, i + concurrency);
    await Promise.all(batch.map(u => fetch(`${url}/rest/v1/waterbodies?id=eq.${u.id}`, {
      method: 'PATCH',
      headers: { apikey: svc, authorization: 'Bearer ' + svc, 'content-type': 'application/json', prefer: 'return=minimal' },
      body: JSON.stringify({ max_depth_ft: u.max_depth_ft, depth_kind: u.depth_kind, depth_source: u.depth_source, depth_updated_at: u.depth_updated_at }),
    })));
    done += batch.length;
    process.stderr.write(`\r  wrote ${done}/${updates.length}`);
  }
  process.stderr.write('\n');
}

async function main() {
  const mn = await backfillMn();
  const wi = await backfillWi();
  console.log(`==> Done. ${mn} MN + ${wi} WI = ${mn + wi} lakes now have a real persisted max depth.`);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
