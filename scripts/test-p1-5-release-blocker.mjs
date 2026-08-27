#!/usr/bin/env node
// Regression test for P1-5 reopened as a release blocker (staging QA,
// 2026-08-27): "Gear shows 0 setups, 0 rods, 0 reels [for an account
// confirmed to still have 10/12/10]; Refresh does not recover them; Tackle
// (47 items) correctly retrieves everything." Reproduces the actual
// mechanism -- a boot-time atlas:account-changed race invalidating the very
// first in-flight fetch -- and asserts the exact reported numbers survive
// both a fresh "refresh" and a real Mission -> Gear -> Mission round trip,
// using the real public/arsenal-safe.js (not a re-implementation of it) for
// the Gear side. Run with:
//   node scripts/test-p1-5-release-blocker.mjs
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

// --- the exact counts from the staging QA report ---------------------------
const UID = 'user-real-account';
const COMBOS = Array.from({ length: 10 }, (_, i) => ({ id: `combo-${i}`, atlas_id: `SETUP-${i}`, name: `Setup ${i}`, rod_id: null, reel_id: null }));
const RODS = Array.from({ length: 12 }, (_, i) => ({ id: `rod-${i}`, brand: 'St. Croix', model: `Rod ${i}` }));
const REELS = Array.from({ length: 10 }, (_, i) => ({ id: `reel-${i}`, brand: 'Shimano', model: `Reel ${i}` }));
const LURES = Array.from({ length: 47 }, (_, i) => ({ id: `lure-${i}`, category: 'jig', model: `Lure ${i}` }));

function stubEl(over = {}) {
  return {
    value: '', hidden: false, textContent: '', innerHTML: '', dataset: {}, tabIndex: 0, attrs: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
    querySelector: () => null, querySelectorAll: () => [],
    insertAdjacentElement() {}, insertAdjacentHTML() {}, appendChild() {}, before() {}, remove() {},
    closest: () => null, addEventListener: () => {}, focus() {},
    ...over,
  };
}

const listeners = {};
const domFields = {};
globalThis.document = {
  readyState: 'complete',
  head: stubEl(),
  getElementById: (id) => (domFields[id] ||= stubEl()),
  createElement: () => stubEl(),
  querySelector: () => null,
  addEventListener: (name, fn) => { (listeners[name] ||= []).push(fn); },
  dispatchEvent: (evt) => { (listeners[evt.type] || []).forEach(fn => fn(evt)); },
};
globalThis.window = globalThis;
globalThis.window.addEventListener = (name, fn) => { (listeners[`window:${name}`] ||= []).push(fn); };
globalThis.document.hidden = false;
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.session = { user: { id: UID } };
globalThis.stat = () => {};
globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };

// A controllable fetch: resolves each call only once release() is called for
// it, so the boot-race scenario below can fire atlas:account-changed at the
// exact moment a real fetch would still be in flight -- not guessed at with
// a timer, actually controlled.
let pendingResolvers = [];
let fetchCallCount = 0;
globalThis.api = (p) => {
  if (p.includes('/rest/v1/combos')) fetchCallCount++;
  return new Promise((resolve) => {
    pendingResolvers.push(() => {
      if (p.includes('/rest/v1/combos')) resolve(COMBOS);
      else if (p.includes('/rest/v1/rods')) resolve(RODS);
      else if (p.includes('/rest/v1/reels')) resolve(REELS);
      else if (p.includes('/rest/v1/lures')) resolve(LURES);
      else resolve([]);
    });
  });
};
function releaseAllPending() { const r = pendingResolvers; pendingResolvers = []; r.forEach(fn => fn()); }

await import(pathToFileURL(path.join(root, 'public/gear-state.js')));
const gearState = globalThis.__fishwizzTest.gearState;

section('P1-5 release blocker: the actual race -- account-changed firing while the first fetch is in flight');
{
  // Mirrors src/runtime/index.js's real boot sequence: a fresh page load
  // dispatches atlas:account-changed for an ALREADY-signed-in user
  // (previous_user_id: null is what that first firing actually carries),
  // which can land while the very first combos/rods/reels fetch is still
  // in flight -- the exact timing that caused this to regress to 0/0/0.
  const p = gearState.ensure(); // starts the fetch, does not await yet
  document.dispatchEvent({ type: 'atlas:account-changed', detail: { user_id: UID, previous_user_id: null } });
  releaseAllPending();
  const result = await p;
  check('the in-flight fetch was NOT discarded by the boot-time account-changed race', result.loaded === true);
  check('setups: exactly 10, matching the account’s real data', result.combos.length === 10);
  check('rods: exactly 12', result.rods.length === 12);
  check('reels: exactly 10', result.reels.length === 10);
  check('lures/tackle: exactly 47', result.lures.length === 47);
  check('only one real network fetch happened despite the race', fetchCallCount === 1);
}

section('P1-5 release blocker: "refresh" -- a completely fresh module load still resolves correctly');
{
  gearState.forceReset();
  fetchCallCount = 0;
  const p = gearState.ensure({ force: true });
  releaseAllPending();
  const result = await p;
  check('setups after a fresh refresh: 10', result.combos.length === 10);
  check('rods after a fresh refresh: 12', result.rods.length === 12);
  check('reels after a fresh refresh: 10', result.reels.length === 10);
}

section('P1-5 release blocker: Mission -> Gear -> Mission, using the real arsenal-safe.js for the Gear side');
{
  gearState.forceReset();
  fetchCallCount = 0;

  // Mission side (today.js-equivalent): asks the shared loader directly.
  let p = gearState.ensure();
  releaseAllPending();
  const missionFirst = await p;
  check('Mission (first visit) sees 10 setups / 12 rods / 10 reels', missionFirst.combos.length === 10 && missionFirst.rods.length === 12 && missionFirst.reels.length === 10);

  // Gear side: the REAL arsenal-safe.js, not a re-implementation of its
  // fetch logic -- proves the report() wiring in the actual shipped file
  // works, not just this test's model of it. Its own boot() calls load()
  // once, synchronously, at import time (against session=UID); let that
  // fetch settle.
  domFields.arsenal = stubEl();
  domFields.arsenalCards = stubEl();
  await import(pathToFileURL(path.join(root, 'public/arsenal-safe.js')));
  releaseAllPending();
  await new Promise((r) => setImmediate(r));

  section('  (Gear’s own fetch reported into the shared state)');
  const afterGear = gearState.get();
  check('Gear’s real load() reported 10 setups into the shared state', afterGear.combos.length === 10);
  check('Gear’s real load() reported 12 rods into the shared state', afterGear.rods.length === 12);
  check('Gear’s real load() reported 10 reels into the shared state', afterGear.reels.length === 10);

  // Mission again: must still show the real numbers, not reset by the Gear
  // visit and not a stray duplicate fetch.
  p = gearState.ensure();
  const missionAgain = await p; // already cached by Gear's report(); resolves without releaseAllPending
  check('Mission (after Gear) still sees 10 setups', missionAgain.combos.length === 10);
  check('Mission (after Gear) still sees 12 rods', missionAgain.rods.length === 12);
  check('Mission (after Gear) still sees 10 reels', missionAgain.reels.length === 10);
}

section('P1-5 release blocker: a genuine failure is a real error, never a false "0 setups"');
{
  gearState.forceReset();
  const realApi = globalThis.api;
  globalThis.api = async () => { throw new Error('PostgREST: connection reset'); };
  const failed = await gearState.ensure({ force: true });
  check('a real failure carries a real error message', typeof failed.error === 'string' && failed.error.length > 0);
  check('a real failure is never reported as loaded:true (which would render as "0 setups" instead of an error)', failed.loaded === false);
  globalThis.api = realApi;
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
