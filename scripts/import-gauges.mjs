// Phase 3a of the full-accuracy mapping project: bulk-import every real
// live-reporting USGS gauge in MN and WI -- not just the one gauge that
// happened to get linked before. atlas-live-water already knows how to
// refresh values for gauges that exist in `stream_gauges`; it has no way to
// discover new ones. This is the discovery half.
//
//   node --env-file=.env scripts/import-gauges.mjs
//
// Source: USGS's own Site Service (waterservices.usgs.gov/nwis/site),
// seriesCatalogOutput=true so each site's actually-available parameters
// come back too, not just its existence. Scoped to real-time
// (hasDataTypeCd=iv) stream/lake sites reporting discharge (00060), gage
// height (00065), or water temperature (00010) -- the three
// atlas-live-water already knows how to read. Real counts verified live
// before writing this: 194 MN sites, 485 WI sites.
//
// Idempotent: upserts on (agency, site_id), the table's own real unique
// constraint.

const url = process.env.FISHWIZZ_SUPABASE_URL;
if (!url) { console.error('FISHWIZZ_SUPABASE_URL not set -- run with --env-file=.env'); process.exit(1); }

const { execSync } = await import('node:child_process');
const svc = JSON.parse(execSync('npx -y supabase projects api-keys --project-ref doddeferfxzgdmzadibq', { encoding: 'utf8' }))
  .keys.find(k => k.id === 'service_role').api_key;

async function fetchText(u, timeoutMs = 20000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(u, { signal: ctl.signal, headers: { 'user-agent': 'FishWizz/1.0' } });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${u}`);
    return await r.text();
  } finally { clearTimeout(t); }
}

// USGS rdb: comment lines start with '#', then one header line, then one
// format-spec line ("5s 15s ..."), then data rows -- all tab-delimited.
function parseRdb(text) {
  const lines = text.split('\n').filter(l => l && !l.startsWith('#'));
  if (lines.length < 2) return [];
  const header = lines[0].split('\t');
  return lines.slice(2).filter(Boolean).map(line => {
    const cells = line.split('\t');
    const row = {};
    header.forEach((h, i) => { row[h] = cells[i]; });
    return row;
  });
}

const PARAM_NAME = { '00060': 'discharge', '00065': 'gage_height', '00010': 'water_temperature' };

async function loadState(stateCd) {
  const u = new URL('https://waterservices.usgs.gov/nwis/site/');
  u.searchParams.set('format', 'rdb');
  u.searchParams.set('stateCd', stateCd);
  u.searchParams.set('siteType', 'ST,LK');
  u.searchParams.set('hasDataTypeCd', 'iv');
  u.searchParams.set('parameterCd', '00060,00065,00010');
  u.searchParams.set('seriesCatalogOutput', 'true');
  const rows = parseRdb(await fetchText(u));

  const bySite = new Map();
  for (const r of rows) {
    const siteNo = r.site_no;
    if (!siteNo) continue;
    let site = bySite.get(siteNo);
    if (!site) {
      const lat = Number(r.dec_lat_va), lon = Number(r.dec_long_va);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      site = { site_id: siteNo, site_name: r.station_nm || null, lat, lon, params: new Set() };
      bySite.set(siteNo, site);
    }
    // seriesCatalogOutput rows include non-parameter rows (data_type_cd
    // like 'ad'/'pk'/'qw' with no parm_cd) -- only real iv/dv series with a
    // known parameter code count.
    if (r.parm_cd && PARAM_NAME[r.parm_cd] && (r.data_type_cd === 'iv' || r.data_type_cd === 'dv')) {
      site.params.add(r.parm_cd);
    }
  }
  return [...bySite.values()].filter(s => s.params.size > 0).map(s => ({
    agency: 'USGS', site_id: s.site_id, site_name: s.site_name,
    lat: s.lat, lon: s.lon, parameters: [...s.params],
  }));
}

async function upsertBatch(rows, batchSize = 200) {
  let done = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize).map(r => ({
      agency: r.agency, site_id: r.site_id, site_name: r.site_name,
      location: `SRID=4326;POINT(${r.lon} ${r.lat})`,
      parameters: r.parameters, active: true,
    }));
    const res = await fetch(`${url}/rest/v1/stream_gauges?on_conflict=agency,site_id`, {
      method: 'POST',
      headers: { apikey: svc, authorization: 'Bearer ' + svc, 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(batch),
    });
    if (!res.ok) { console.error('batch failed', res.status, await res.text()); process.exit(1); }
    done += batch.length;
    process.stderr.write(`\rupserted ${done}/${rows.length}`);
  }
  process.stderr.write('\n');
}

async function main() {
  console.log('==> Fetching MN real-time gauges...');
  const mn = await loadState('mn');
  console.log(`    ${mn.length} MN sites`);

  console.log('==> Fetching WI real-time gauges...');
  const wi = await loadState('wi');
  console.log(`    ${wi.length} WI sites`);

  const all = [...mn, ...wi];
  console.log(`==> Total: ${all.length} gauges`);

  console.log('==> Upserting into stream_gauges...');
  await upsertBatch(all);
  console.log('==> Done.');
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
