#!/usr/bin/env node
// Regression test for the ACTUAL root cause behind "Profile showed 5
// Tackle, Gear showed 2/2/2, Tackle showed 0 items/No tackle saved yet"
// (independent authenticated production QA, NO-GO on release 6ae72c096be9,
// 2026-08-28).
//
// arsenal-safe.js (Gear) runs its OWN direct combos/rods/reels fetch --
// deliberately, per its own P1-5 note, so Gear's correctness never depends
// on gear-state.js's shared-fetch timing -- and reports that result to
// gear-state.js via report() as a side effect, purely so other readers can
// reuse it if they get there first. report() never receives lures at all
// (arsenal-safe.js's own load(): `report(userId,{combos:...,rods:...,
// reels:...})`, no `lures` key).
//
// Before this fix, report() marked the ENTIRE shared cache loaded:true
// regardless -- the one and only flag both ensure()'s freshness check and
// isHydratedFor() (Tackle's sole gate) trusted. If Gear was the first
// inventory-related page visited this session, Tackle's own load() would
// see isHydratedFor(uid)===true and render get().lures directly -- which
// was still the untouched initial [], since lures had never actually been
// fetched by anyone yet -- producing a permanent (for the rest of that
// cache's 30s TTL) false "No tackle saved yet" for an account that
// genuinely has tackle, while Profile (reading window.lures, populated by
// whatever real fetch happens to have run) could show a real, different
// number.
//
// Run with:
//   node scripts/test-p1-tackle-report-race.mjs
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

const fields = {};
function stubEl(over = {}) {
  let _id = over.id || '';
  const el = {
    value: '', hidden: false, textContent: '', innerHTML: '', dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute() {}, getAttribute() {}, insertAdjacentElement() {}, insertAdjacentHTML() {},
    appendChild() {}, remove() { if (_id) delete fields[_id]; },
    closest() { return null; }, addEventListener() {}, focus() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    onclick: null,
    ...over,
  };
  Object.defineProperty(el, 'id', { get() { return _id; }, set(v) { _id = v; if (v) fields[v] = el; } });
  return el;
}

const listeners = {};
globalThis.document = {
  readyState: 'complete',
  head: stubEl(), body: stubEl(),
  getElementById: (id) => fields[id] || null,
  createElement: () => stubEl(),
  querySelectorAll: () => [],
  addEventListener: (name, fn) => { (listeners[name] ||= []).push(fn); },
  dispatchEvent: (evt) => { (listeners[evt.type] || []).forEach(fn => fn(evt)); },
};
globalThis.window = globalThis;
globalThis.window.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const UID = 'user-qa';
globalThis.session = { user: { id: UID } };
globalThis.stat = () => {};
globalThis.esc = s => String(s ?? '');
globalThis.fishwizzAuth = { generation: () => 1, ready: Promise.resolve() };

const COMBOS = [{ id: 'c1', name: 'Setup One' }, { id: 'c2', name: 'Setup Two' }];
const RODS = [{ id: 'r1' }, { id: 'r2' }];
const REELS = [{ id: 're1' }, { id: 're2' }];
const LURES = Array.from({ length: 5 }, (_, i) => ({ id: `l${i}`, category: 'jig', model: `Lure ${i}` }));

globalThis.api = async (p) => {
  // The real fetchAll() re-fetches all four collections together once
  // luresLoaded forces a genuine fetch -- returning the SAME combos/rods/
  // reels report() already established keeps this fixture internally
  // consistent (Gear's own numbers do not change just because Tackle also
  // triggered a real fetch).
  if (p.includes('/combos?')) return COMBOS;
  if (p.includes('/rods?')) return RODS;
  if (p.includes('/reels?')) return REELS;
  if (p.includes('/lures?')) return LURES;
  return [];
};

await import(pathToFileURL(path.join(root, 'public/gear-state.js')));
const gearState = globalThis.__fishwizzTest.gearState;

section('Gear\'s own report() (combos/rods/reels only, exactly as arsenal-safe.js calls it) never fetched lures');
{
  gearState.report(UID, { combos: COMBOS, rods: RODS, reels: REELS }); // no `lures` key -- the real call shape
  const state = gearState.get();
  check('combos/rods/reels are reflected (Gear\'s own numbers are correct)', state.combos.length === 2 && state.rods.length === 2 && state.reels.length === 2);
  check('loaded is true (Gear itself is done)', state.loaded === true);
  check('luresLoaded is FALSE -- lures were never actually fetched by this call', state.luresLoaded === false);
  check('isHydratedFor() correctly refuses to call this "hydrated for tackle purposes"', window.FishWizzGearState.isHydratedFor(UID) === false);
}

section('Tackle (inventory-pro.js) visited right after Gear: must NOT render a false "0 items" from the unfetched cache');
{
  fields.tackleCards = stubEl();
  fields.tackleSearch = stubEl();
  fields.tackleRetry = stubEl();
  // Importing inventory-pro.js itself kicks off boot()'s own fire-and-forget
  // load() call (readyState is already 'complete') -- deliberately NOT
  // pre-hydrated first, unlike test-p1-gear-unify.mjs's version of this
  // section, specifically so this exercises the SLOW, first-ever-fetch path
  // (isHydratedFor() false -> a real ensure() fetch) rather than the fast
  // cache-hit path. Give that in-flight call room to actually finish before
  // asserting on its result, instead of racing a second explicit call into
  // its own `if (loading) return` guard.
  await import(pathToFileURL(path.join(root, 'public/inventory-pro.js')));
  await new Promise(r => setTimeout(r, 30));
  check('a real /rest/v1/lures fetch actually happened (isHydratedFor(false) correctly forced ensure() to fetch for real)', fields.tackleCards.innerHTML.includes('Lure 0'));
  check('the real 5 items are shown, not a false empty state', !fields.tackleCards.innerHTML.includes('No tackle saved yet'));
  check('window.lures now carries the real 5 items', (window.lures || []).length === 5);
}

section('Profile (angler-profile.js\'s stats(), reading window.lures directly) now agrees with Tackle');
{
  const combosCount = (window.combos || []).length;
  const luresCount = (window.lures || []).length;
  check('Combos: Profile would report the same 2 Gear itself shows', combosCount === 2);
  check('Tackle: Profile would report the same 5 Tackle itself now shows (was the "5 vs 0" contradiction)', luresCount === 5);
}

section('ensure()\'s own freshness check also requires luresLoaded -- not just Tackle\'s isHydratedFor()');
{
  gearState.invalidate();
  window.combos = []; window.lures = [];
  gearState.report(UID, { combos: COMBOS, rods: RODS, reels: REELS }); // combos-only report again
  const result = await gearState.ensure({ force: false }); // any caller (Mission's inventory loader, etc), not just Tackle
  check('ensure() did not trust the combos-only report as "fresh enough" -- it fetched lures for real', result.luresLoaded === true && result.lures.length === 5);
}

section('a genuine account switch clears the bare window.combos/window.lures globals (never shows the previous angler\'s gear)');
{
  gearState.invalidate({ user_id: 'a-different-user' });
  check('window.combos was cleared on a real account switch', (window.combos || []).length === 0);
  check('window.lures was cleared on a real account switch', (window.lures || []).length === 0);
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
