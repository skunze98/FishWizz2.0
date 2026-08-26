// Link stream_gauges rows to a real cataloged water, same technique as
// scripts/link-access-points.mjs -- real PostGIS shoreline/nearest-point
// distance via nearby_water_catalog, not a name guess. Most gauges sit on
// rivers/streams, which phase 2 deliberately did not bulk-import (see its
// own header comment) -- so most stream-type gauges are expected to stay
// unlinked until a real stream catalog exists. Lake-adjacent gauges should
// link well against phase 2's 15,014 lakes.
//
//   node --env-file=.env scripts/link-gauges.mjs

const url = process.env.FISHWIZZ_SUPABASE_URL;
if (!url) { console.error('FISHWIZZ_SUPABASE_URL not set -- run with --env-file=.env'); process.exit(1); }

const { execSync } = await import('node:child_process');
const svc = JSON.parse(execSync('npx -y supabase projects api-keys --project-ref doddeferfxzgdmzadibq', { encoding: 'utf8' }))
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
    const r = await fetch(`${url}/rest/v1/stream_gauges?waterbody_id=is.null&select=id,location&order=id&limit=500&offset=${offset}`, { headers: { apikey: svc, authorization: 'Bearer ' + svc } });
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
  const up = await fetch(`${url}/rest/v1/stream_gauges?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: { apikey: svc, authorization: 'Bearer ' + svc, 'content-type': 'application/json', prefer: 'return=minimal' },
    body: JSON.stringify({ waterbody_id: best.id }),
  });
  return { linked: up.ok };
}

async function main() {
  const rows = await fetchUnlinked();
  console.log(`==> ${rows.length} unlinked gauges`);
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
  console.log(`==> Done. ${linked}/${rows.length} linked.`);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
