// Phase 1 <-> Phase 2 reconciliation: link every public_access_points row
// still missing a waterbody_id against the water catalog phase 2 just
// filled in with real shoreline geometry. Uses the same nearby_water_catalog
// RPC the app's own map-tap flow already trusts for "which water is this
// point on" -- real PostGIS shoreline distance, not a name guess -- so an
// access point only links when it's genuinely on or very near a cataloged
// water's real shape.
//
//   node --env-file=.env scripts/link-access-points.mjs

const url = process.env.FISHWIZZ_SUPABASE_URL;
if (!url) { console.error('FISHWIZZ_SUPABASE_URL not set -- run with --env-file=.env'); process.exit(1); }

const { execSync } = await import('node:child_process');
const svc = JSON.parse(execSync('npx --no-install supabase projects api-keys --project-ref doddeferfxzgdmzadibq', { encoding: 'utf8' }))
  .keys.find(k => k.id === 'service_role').api_key;

function parseWkbPoint(hex) {
  const buf = Buffer.from(hex, 'hex');
  const le = buf.readUInt8(0) === 1;
  const lon = le ? buf.readDoubleLE(9) : buf.readDoubleBE(9);
  const lat = le ? buf.readDoubleLE(17) : buf.readDoubleBE(17);
  return { lon, lat };
}

function trustworthy(row) {
  const mt = String(row?.match_type || '');
  if (mt === 'on_water' || mt === 'very_close') return true;
  const d = Number(row?.distance_miles);
  return Number.isFinite(d) && d <= 0.3;
}

async function fetchUnlinked() {
  const rows = [];
  let offset = 0;
  while (true) {
    const r = await fetch(`${url}/rest/v1/public_access_points?waterbody_id=is.null&select=id,location&order=id&limit=500&offset=${offset}`, { headers: { apikey: svc, authorization: 'Bearer ' + svc } });
    const batch = await r.json();
    if (!Array.isArray(batch) || !batch.length) break;
    rows.push(...batch);
    offset += batch.length;
    if (batch.length < 500) break;
  }
  return rows;
}

async function linkOne(row) {
  let latlon;
  try { latlon = parseWkbPoint(row.location); } catch { return { linked: false }; }
  const r = await fetch(`${url}/rest/v1/rpc/nearby_water_catalog`, {
    method: 'POST',
    headers: { apikey: svc, authorization: 'Bearer ' + svc, 'content-type': 'application/json' },
    body: JSON.stringify({ p_lat: latlon.lat, p_lon: latlon.lon, p_radius_miles: 0.5, p_limit: 3 }),
  });
  if (!r.ok) return { linked: false };
  const matches = await r.json();
  const best = (matches || []).filter(trustworthy).sort((a, b) => Number(a.distance_miles || 0) - Number(b.distance_miles || 0))[0];
  if (!best) return { linked: false };
  const up = await fetch(`${url}/rest/v1/public_access_points?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: { apikey: svc, authorization: 'Bearer ' + svc, 'content-type': 'application/json', prefer: 'return=minimal' },
    body: JSON.stringify({ waterbody_id: best.id }),
  });
  return { linked: up.ok };
}

async function main() {
  console.log('==> Fetching unlinked access points...');
  const rows = await fetchUnlinked();
  console.log(`    ${rows.length} unlinked`);

  let linked = 0, done = 0;
  const CONCURRENCY = 20;
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(linkOne));
    for (const r of results) if (r.linked) linked++;
    done += batch.length;
    process.stderr.write(`\rchecked ${done}/${rows.length}, linked ${linked}`);
  }
  process.stderr.write('\n');
  console.log(`==> Done. ${linked}/${rows.length} newly linked to a real water.`);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
