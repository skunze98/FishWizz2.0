#!/usr/bin/env node
// Regression test for P1-5 reopened (staging QA, 2026-08-27): "Gear shows 10
// setups, Mission reports 0, and Gear also renders 'No gear saved yet'
// beneath the 10 setup records." Covers the actual fix -- one shared,
// authoritative gear loader (public/gear-state.js) instead of three
// independent fetch/cache implementations (arsenal-safe.js,
// mission-inventory-fit.js, today.js) that used to disagree.
// Run with: node scripts/test-gear-state-p1-5.mjs
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

let failures = 0;
function check(label, cond) {
  if (cond) { console.log(`  ok   ${label}`); }
  else { console.log(`  FAIL ${label}`); failures++; }
}
function section(name) { console.log(`\n${name}`); }

const listeners = {};
globalThis.document = {
  readyState: 'complete',
  getElementById: () => null,
  addEventListener: (name, fn) => { (listeners[name] ||= []).push(fn); },
  dispatchEvent: (evt) => { (listeners[evt.type] || []).forEach(fn => fn(evt)); },
};
globalThis.window = globalThis;
globalThis.session = { user: { id: 'user-aaaa' } };
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const TEN_COMBOS = Array.from({ length: 10 }, (_, i) => ({ id: `combo-${i}`, atlas_id: `SETUP-${i}`, name: `Setup ${i}`, rod_id: null, reel_id: null }));
let fetchCount = 0;
globalThis.api = async (p) => {
  if (p.includes('/rest/v1/combos')) { fetchCount++; return TEN_COMBOS; }
  if (p.includes('/rest/v1/rods')) return [];
  if (p.includes('/rest/v1/reels')) return [];
  if (p.includes('/rest/v1/lures')) return [{ id: 'lure-1' }, { id: 'lure-2' }];
  return [];
};

await import(pathToFileURL(path.join(root, 'public/gear-state.js')));
const { ensure, get, invalidate, isHydratedFor } = globalThis.__fishwizzTest?.gearState || {};

section('P1-5: a single shared fetch, not one per consumer');
const missionSideResult = await ensure(); // e.g. today.js on the Mission page
const gearSideResult = await ensure();    // e.g. arsenal-safe.js after navigating to Gear
check('exactly one real network fetch happened for two consumers calling ensure()', fetchCount === 1);
check('the Mission-side consumer sees the real count', missionSideResult.combos.length === 10);
check('the Gear-side consumer sees the SAME real count -- this is the actual reported bug (10 vs 0)', gearSideResult.combos.length === 10);
check('both consumers got literally the same cached result, not two separately-fetched copies', missionSideResult === gearSideResult);
check('window.combos (read directly by mentor-pro.js, gear-coach-lite.js, etc) also agrees', window.combos.length === 10);
check('isHydratedFor confirms the current account is genuinely loaded', isHydratedFor('user-aaaa') === true);

section('P1-5: concurrent first-load calls (the literal "refresh, then two pages ask at once" case) still dedupe');
{
  invalidate();
  fetchCount = 0;
  const [a, b] = await Promise.all([ensure(), ensure()]);
  check('two concurrent ensure() calls on a cold cache still only fetch once', fetchCount === 1);
  check('both resolve to the real 10, neither sees a pre-hydration zero', a.combos.length === 10 && b.combos.length === 10);
}

section('P1-5: a failed fetch never looks identical to "confirmed genuinely empty"');
{
  invalidate();
  fetchCount = 0;
  const realApi = globalThis.api;
  globalThis.api = async () => { throw new Error('network down'); };
  const failed = await ensure({ force: true });
  check('a failed load reports loaded:false, not a false empty confirmation', failed.loaded === false);
  check('a failed load still reports zero counts (nothing to show), but callers must gate on loaded:true first', failed.combos.length === 0);
  globalThis.api = realApi;
}

section('P1-5: account switch invalidates -- no stale cross-account count survives');
{
  fetchCount = 0;
  await ensure({ force: true }); // re-warm after the failure test above
  check('re-warmed after the failure test', fetchCount === 1 && isHydratedFor('user-aaaa'));
  document.dispatchEvent({ type: 'atlas:account-changed' });
  check('account switch clears hydration for the old account', isHydratedFor('user-aaaa') === false);
  check('the shared cache no longer reports itself loaded at all', get().loaded === false);
}

section('P1-5: "render the empty state only after loading completes and the collection is genuinely empty"');
{
  globalThis.session = { user: { id: 'user-empty' } };
  globalThis.api = async (p) => (p.includes('/rest/v1/combos') ? [] : []);
  const empty = await ensure({ force: true });
  check('a genuinely empty account resolves loaded:true with zero, not stuck loading', empty.loaded === true && empty.combos.length === 0);
  check('isHydratedFor is true for this account even with zero gear -- the empty state IS trustworthy now', isHydratedFor('user-empty') === true);
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
