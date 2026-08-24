#!/usr/bin/env node
/**
 * FishWizz — cross-tenant RLS probe.
 *
 * Proves gap G1 is actually closed. Reading policies in the dashboard only
 * shows that policies exist; this drives the public REST API as two real
 * signed-in users and checks that one genuinely cannot reach the other's rows.
 *
 * Usage:
 *   node scripts/rls-probe.mjs
 *   node scripts/rls-probe.mjs --destructive     # also probe UPDATE and DELETE
 *
 * Env (all required):
 *   FISHWIZZ_SUPABASE_URL   https://<ref>.supabase.co
 *   FISHWIZZ_SUPABASE_KEY   the publishable / anon key
 *   FISHWIZZ_PROBE_A_EMAIL  test user A
 *   FISHWIZZ_PROBE_A_PASS
 *   FISHWIZZ_PROBE_B_EMAIL  test user B  (a DIFFERENT account)
 *   FISHWIZZ_PROBE_B_PASS
 *
 * Use throwaway accounts. Exit code 0 = every probe passed.
 *
 * Safety: the default run performs no destructive writes. The UPDATE/DELETE
 * probes are opt-in precisely because they are only dangerous in the case
 * where they would fail -- if RLS is broken, a DELETE probe would really
 * delete the other user's row. A security test must not cause the damage it
 * is looking for.
 */

const URL_BASE = process.env.FISHWIZZ_SUPABASE_URL?.replace(/\/$/, '');
const KEY = process.env.FISHWIZZ_SUPABASE_KEY;
const DESTRUCTIVE = process.argv.includes('--destructive');

// Every table the client touches. Reference tables are probed differently:
// shared reads are expected, writes are not.
const PER_USER = [
  'profiles', 'catches', 'lures', 'combos', 'rods', 'reels',
  'fishing_sessions', 'water_spots', 'mission_feedback',
  'inventory_photo_intake', 'user_fishing_profiles', 'beta_feedback',
];
const REFERENCE = ['waterbodies', 'app_release_status'];
const PRIMARY_KEY = { user_fishing_profiles: 'user_id' };

let pass = 0, fail = 0, skip = 0;
const failures = [];

const ok   = m => { pass++; console.log(`  \x1b[32mPASS\x1b[0m  ${m}`); };
const bad  = m => { fail++; failures.push(m); console.log(`  \x1b[31mFAIL\x1b[0m  ${m}`); };
const meh  = m => { skip++; console.log(`  \x1b[33mSKIP\x1b[0m  ${m}`); };

function required(name) {
  const v = process.env[name];
  if (!v) { console.error(`Missing required env var ${name}`); process.exit(2); }
  return v;
}

async function signIn(email, password) {
  const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`sign-in failed for ${email}: ${d.error_description || d.msg || r.status}`);
  return { token: d.access_token, id: d.user.id, email };
}

function rest(path, { token, ...opt } = {}) {
  return fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...opt,
    headers: {
      apikey: KEY,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opt.headers || {}),
    },
  });
}

async function json(r) { const t = await r.text(); try { return t ? JSON.parse(t) : null; } catch { return t; } }

// --- probes ----------------------------------------------------------------

async function probeAnon() {
  console.log('\n1. Unauthenticated access (anon role must reach nothing)');
  for (const t of [...PER_USER, ...REFERENCE]) {
    const r = await rest(`${t}?select=*&limit=1`);
    const body = await json(r);
    if (r.ok && Array.isArray(body) && body.length > 0) {
      bad(`${t}: anon read returned ${body.length} row(s)`);
    } else if (r.ok) {
      // Reachable but empty. Not proof of safety -- the table may just be empty.
      meh(`${t}: anon read allowed but returned 0 rows (grant still present?)`);
    } else {
      ok(`${t}: anon denied (${r.status})`);
    }
  }
}

async function probeCrossTenantRead(A, B) {
  console.log('\n2. Cross-tenant read (B must not see A\'s rows)  <-- this is G1');
  for (const t of PER_USER) {
    const key = PRIMARY_KEY[t] || 'id';
    const ra = await rest(`${t}?select=${key}&limit=1`, { token: A.token });
    const rowsA = await json(ra);
    if (!ra.ok) { meh(`${t}: A could not read own rows (${ra.status}) -- ${JSON.stringify(rowsA).slice(0, 90)}`); continue; }
    if (!Array.isArray(rowsA) || rowsA.length === 0) { meh(`${t}: A owns no rows, nothing to probe`); continue; }

    const targetId = rowsA[0][key];
    if (targetId === undefined) { meh(`${t}: no ${key} column to target`); continue; }

    const rb = await rest(`${t}?select=*&${key}=eq.${encodeURIComponent(targetId)}`, { token: B.token });
    const rowsB = await json(rb);
    if (rb.ok && Array.isArray(rowsB) && rowsB.length > 0) {
      bad(`${t}: B READ A's row ${targetId} -- cross-tenant leak`);
    } else if (!rb.ok && rb.status >= 500) {
      bad(`${t}: unexpected ${rb.status} for B -- ${JSON.stringify(rowsB).slice(0, 90)}`);
    } else {
      ok(`${t}: B cannot see A's row`);
    }
  }
}

async function probeForgedOwner(A, B) {
  console.log('\n3. Forged-owner write (B must not insert a row owned by A)');
  // The client sends owner_id straight from the browser, so this is the exact
  // shape of the attack: WITH CHECK is what stops it, and a USING-only policy
  // will sail right through.
  const payload = { owner_id: A.id, water: 'RLS probe', species: 'RLS probe' };
  const r = await rest('catches', {
    token: B.token,
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  const body = await json(r);

  if (r.ok && Array.isArray(body) && body.length > 0) {
    const row = body[0];
    if (row.owner_id === A.id) {
      bad(`catches: B inserted a row attributed to A (id ${row.id}) -- WITH CHECK missing`);
    } else {
      ok(`catches: forged owner_id was overridden to ${row.owner_id === B.id ? 'B' : row.owner_id}`);
    }
    // Clean up whatever we just made, as whichever user owns it.
    for (const who of [B, A]) {
      const del = await rest(`catches?id=eq.${row.id}`, { token: who.token, method: 'DELETE' });
      if (del.ok) break;
    }
  } else if (r.status === 400 || r.status === 404) {
    meh(`catches: insert rejected for a non-RLS reason (${r.status}) -- ${JSON.stringify(body).slice(0, 110)}`);
  } else {
    ok(`catches: B denied inserting a row owned by A (${r.status})`);
  }
}

async function probeReferenceWrites(B) {
  console.log('\n4. Reference tables (readable, not writable)');
  for (const t of REFERENCE) {
    const rr = await rest(`${t}?select=*&limit=1`, { token: B.token });
    rr.ok ? ok(`${t}: signed-in read allowed`) : meh(`${t}: signed-in read denied (${rr.status}) -- app expects to read this`);

    const rw = await rest(t, { token: B.token, method: 'POST', body: JSON.stringify({}) });
    const wb = await json(rw);
    if (rw.ok) bad(`${t}: signed-in user could WRITE to reference data`);
    else if (rw.status === 400) meh(`${t}: write rejected as malformed (${rw.status}) -- grants not proven revoked`);
    else ok(`${t}: write denied (${rw.status})`);
  }
}

async function probeDestructive(A, B) {
  console.log('\n5. Cross-tenant UPDATE / DELETE (--destructive)');
  for (const t of PER_USER) {
    const key = PRIMARY_KEY[t] || 'id';
    const ra = await rest(`${t}?select=${key}&limit=1`, { token: A.token });
    const rowsA = await json(ra);
    if (!ra.ok || !Array.isArray(rowsA) || rowsA.length === 0 || rowsA[0][key] === undefined) {
      meh(`${t}: nothing of A's to target`); continue;
    }
    const id = rowsA[0][key];

    // Updating the primary key to its existing value is deliberately a no-op:
    // if RLS is broken PostgREST returns A's row, proving the leak without
    // changing its data. A protected row returns an empty representation.
    const ru = await rest(`${t}?${key}=eq.${encodeURIComponent(id)}`, {
      token: B.token, method: 'PATCH', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ [key]: id }),
    });
    const updated = await json(ru);
    if (ru.ok && Array.isArray(updated) && updated.length > 0) {
      bad(`${t}: B UPDATED A's row ${id} -- update policy missing`);
    } else if (!ru.ok && ru.status >= 500) {
      bad(`${t}: unexpected ${ru.status} during cross-tenant update -- ${JSON.stringify(updated).slice(0, 90)}`);
    } else {
      ok(`${t}: B cannot update A's row`);
    }

    const rd = await rest(`${t}?${key}=eq.${encodeURIComponent(id)}`, {
      token: B.token, method: 'DELETE', headers: { Prefer: 'return=representation' },
    });
    const deleted = await json(rd);
    if (rd.ok && Array.isArray(deleted) && deleted.length > 0) {
      bad(`${t}: B DELETED A's row ${id} -- data loss, delete policy missing`);
    } else {
      ok(`${t}: B cannot delete A's row`);
    }
  }
}

// --- main ------------------------------------------------------------------

(async () => {
  required('FISHWIZZ_SUPABASE_URL');
  required('FISHWIZZ_SUPABASE_KEY');

  const A = await signIn(required('FISHWIZZ_PROBE_A_EMAIL'), required('FISHWIZZ_PROBE_A_PASS'));
  const B = await signIn(required('FISHWIZZ_PROBE_B_EMAIL'), required('FISHWIZZ_PROBE_B_PASS'));
  if (A.id === B.id) { console.error('A and B are the same account -- the probe would prove nothing.'); process.exit(2); }

  console.log(`FishWizz RLS probe against ${URL_BASE}`);
  console.log(`  user A ${A.email} (${A.id})`);
  console.log(`  user B ${B.email} (${B.id})`);

  await probeAnon();
  await probeCrossTenantRead(A, B);
  await probeForgedOwner(A, B);
  await probeReferenceWrites(B);
  if (DESTRUCTIVE) await probeDestructive(A, B);
  else console.log('\n5. Cross-tenant UPDATE / DELETE  \x1b[33mnot run\x1b[0m (pass --destructive)');

  console.log(`\n${pass} passed, ${fail} failed, ${skip} inconclusive`);
  if (fail) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  if (skip) {
    console.log('\nInconclusive checks are not passes. Seed both accounts with data and re-run.');
    process.exit(1);
  }
  process.exit(0);
})().catch(e => { console.error('\nProbe aborted:', e.message); process.exit(2); });
