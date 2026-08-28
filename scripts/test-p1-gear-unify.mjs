#!/usr/bin/env node
// Regression tests for P1 "Unify gear state across Mission, Gear, Catches,
// and Atlas" (staging QA, 2026-08-27): "Gear showed 2 setups/2 rods/2
// reels; Tackle showed 5 items; Mission said 'No gear loaded' while
// SIMULTANEOUSLY saying '2 combos known' and using a saved setup in
// recommendations; Catches' Combo selector showed only 'Select combo'."
//
// Reproduces the actual root causes found by reading the real shipped
// modules (not a re-implementation of them):
//   1. app.js/inventory-pro.js used to each run their OWN independent
//      /rest/v1/combos and /rest/v1/lures fetches, uncoordinated with
//      gear-state.js's own fetch -- three sources of truth for one number.
//   2. the Catches Combo selector was only ever populated from inside
//      app.js's own fetch handler -- a page whose gear came from
//      gear-state.js instead (Gear, Mission) never refreshed it.
//   3. mentor-pro.js computed its Mission-page gear cards from a fixed
//      800ms boot timer with no regard for whether the shared gear fetch
//      had actually resolved yet, and then never refreshed them once it did
//      -- producing exactly the reported "No gear loaded" next to a
//      correctly-loaded "2 combos known" elsewhere on the same page.
// Run with:
//   node scripts/test-p1-gear-unify.mjs
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
    value: '', hidden: false, textContent: '', innerHTML: '', dataset: {}, files: [], options: [],
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); },
    },
    attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; }, getAttribute(k) { return this.attrs[k]; },
    insertAdjacentElement() {}, insertAdjacentHTML() {}, appendChild() {}, remove() { if (_id) delete fields[_id]; }, closest() { return null; }, focus() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener() {}, onclick: null, oninput: null,
    ...over,
  };
  // document.createElement() returns a disconnected node whose id is only
  // assigned AFTER creation (box.id='mentorNow'); registering it into the
  // shared `fields` map on that assignment is what lets a LATER
  // getElementById('mentorNow') find the exact node the module itself
  // appended, instead of a fresh, disconnected stub -- required to test the
  // pending -> resolved re-render lifecycle below.
  Object.defineProperty(el, 'id', {
    get() { return _id; },
    set(v) { _id = v; if (v) fields[v] = el; },
  });
  if (over.id) fields[over.id] = el;
  return el;
}

const listeners = {};
// A single fake "plan card" so mentor-pro.js's enhance() -- gated on
// document.querySelectorAll('#planCards .plan').length -- actually proceeds
// past its own early-return, exercising the real per-card
// .mentor-inventory pending/resolved lifecycle, not just quickFieldCard()
// in isolation.
const planCard = stubEl({ querySelector: () => null, querySelectorAll: () => [] });
globalThis.document = {
  readyState: 'complete',
  head: stubEl(), body: stubEl(),
  // Strict, like the real DOM: an id nothing has registered returns null,
  // not a phantom auto-created element -- that distinction is exactly what
  // mentor-pro.js's own "does #mentorNow already exist" check below depends
  // on to tell a genuinely fresh render apart from a stale one. Every id any
  // imported module's top-level code touches must be pre-registered in
  // `fields` before that import (see the app.js section below).
  getElementById: (id) => fields[id] || null,
  createElement: () => stubEl(),
  querySelectorAll: (sel) => (sel === '#planCards .plan' ? [planCard] : []),
  addEventListener: (name, fn) => { (listeners[name] ||= []).push(fn); },
  dispatchEvent: (evt) => { (listeners[evt.type] || []).forEach(fn => fn(evt)); },
};
globalThis.window = globalThis;
globalThis.window.addEventListener = (name, fn) => { (listeners[`window:${name}`] ||= []).push(fn); };
globalThis.document.hidden = false;
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const UID = 'user-qa';
globalThis.session = { user: { id: UID } };
globalThis.stat = () => {};
globalThis.esc = s => String(s ?? '');
globalThis.fishwizzAuth = { generation: () => 1, ready: Promise.resolve() };

// --- the exact QA numbers: 2 combos, 2 rods, 2 reels, 5 tackle -------------
const COMBOS = [{ id: 'c1', atlas_id: 'S1', name: 'Setup One', rod_id: 'r1', reel_id: 're1' }, { id: 'c2', atlas_id: 'S2', name: 'Setup Two', rod_id: 'r2', reel_id: 're2' }];
const RODS = [{ id: 'r1', brand: 'St. Croix', model: 'Rod 1' }, { id: 'r2', brand: 'St. Croix', model: 'Rod 2' }];
const REELS = [{ id: 're1', brand: 'Shimano', model: 'Reel 1' }, { id: 're2', brand: 'Shimano', model: 'Reel 2' }];
const LURES = Array.from({ length: 5 }, (_, i) => ({ id: `l${i}`, category: 'jig', model: `Lure ${i}` }));

let apiCalls = [];
globalThis.api = async (p) => {
  apiCalls.push(p);
  if (p.includes('/combos?')) return COMBOS;
  if (p.includes('/rods?')) return RODS;
  if (p.includes('/reels?')) return REELS;
  if (p.includes('/lures?')) return LURES;
  return [];
};

await import(pathToFileURL(path.join(root, 'public/gear-state.js')));
const gearState = globalThis.__fishwizzTest.gearState;

section('gear-state.js is the ONLY fetch: one combos+rods+reels+lures round trip total');
{
  apiCalls = [];
  const result = await gearState.ensure({ force: true });
  check('exactly 4 API calls (combos, rods, reels, lures) for one shared fetch', apiCalls.length === 4);
  check('2 setups hydrated', result.combos.length === 2);
  check('2 rods hydrated', result.rods.length === 2);
  check('2 reels hydrated', result.reels.length === 2);
  check('5 tackle items hydrated', result.lures.length === 5);
  check('window.combos carries the linked rod/reel objects (same shape app.js\'s old query used)', window.combos[0].rods?.id === 'r1' && window.combos[0].reels?.id === 're1');
}

section('app.js: Combo selector populated, and refreshed no matter which page triggered the shared fetch');
{
  fields.cCombo = stubEl();
  // app.js's own top-level code (not inside any function -- runs the
  // instant the file is imported) wires onclick handlers onto these ids
  // unconditionally; the real page always has them, so they're pre-declared
  // as plain stub buttons purely so import doesn't throw on a null .onclick
  // target -- none of them are otherwise exercised by this test.
  ['accountBtn', 'searchWater', 'coach', 'saveCatch', 'signIn', 'signUp', 'signOut', 'initialize'].forEach(id => { fields[id] = stubEl(); });
  await import(pathToFileURL(path.join(root, 'public/app.js')));
  // Simulate loadCombos() being called at sign-in (as loadCore() does).
  await globalThis.loadCombos();
  check('Combo selector has both real setups (not stuck on "Select combo")', fields.cCombo.innerHTML.includes('Setup One') && fields.cCombo.innerHTML.includes('Setup Two'));

  // The exact reported bug: the Combo selector must also update when GEAR
  // page (not Catches/sign-in) is what actually triggered the fetch --
  // simulated here as a fresh atlas:gear-hydrated dispatch with different
  // data, the same event gear-state.js's own fetchAll() fires.
  fields.cCombo.innerHTML = '<option value="">Select combo</option>'; // reset, as if Catches was never visited this session
  window.combos = [{ id: 'c3', name: 'Setup Three' }];
  document.dispatchEvent({ type: 'atlas:gear-hydrated', detail: {} });
  check('Combo selector refreshes on atlas:gear-hydrated alone, without loadCombos() being called again', fields.cCombo.innerHTML.includes('Setup Three'));
}

section('inventory-pro.js: Tackle reads the shared store instead of its own fetch');
{
  fields.tackleCards = stubEl();
  fields.tackleSearch = stubEl();
  // state()'s retry-button branch does $('tackleRetry').onclick=... against
  // a button id whose real element only exists because it was in the HTML
  // string state() just wrote into #tackleCards -- this plain-string stub
  // never parses that markup into a real node, so it's pre-declared here.
  fields.tackleRetry = stubEl();
  // Hydrate the shared store BEFORE inventory-pro.js even loads -- as if
  // Gear or Mission already triggered the one shared fetch this session --
  // so inventory-pro.js's own auto-boot load() (fire-and-forget on import)
  // and this test's own explicit call both deterministically hit the same
  // already-hydrated cache with zero ordering dependency between them.
  await gearState.ensure({ force: true });
  apiCalls = [];
  await import(pathToFileURL(path.join(root, 'public/inventory-pro.js')));
  await globalThis.loadTackleLocker({ force: false });
  check('Tackle did NOT run its own separate /rest/v1/lures fetch (cache was already hydrated)', apiCalls.filter(p => p.includes('/lures?')).length === 0);
  check('window.lures carries the same 5 items the shared store hydrated', (window.lures || []).length === 5);
  check('Tackle actually rendered those items (not the "No tackle saved yet" empty state)', fields.tackleCards.innerHTML.includes('Lure 0') && !fields.tackleCards.innerHTML.includes('No tackle saved yet'));

  section('  a genuine gear-state fetch failure surfaces as a retryable error, never a false "No tackle saved yet"');
  window.FishWizzGearState.invalidate();
  const realApi = globalThis.api;
  globalThis.api = async () => { throw new Error('PostgREST: connection reset'); };
  await globalThis.loadTackleLocker({ force: true });
  check('Tackle shows a real error state', fields.tackleCards.innerHTML.includes('Could not load your Tackle Locker'));
  check('Tackle never claims "No tackle saved yet" for a genuine failure', !fields.tackleCards.innerHTML.includes('No tackle saved yet'));
  globalThis.api = realApi;
  // load()'s own failure path scheduled a real 2.5s retry timer; the process
  // exits well before it fires, so it's inert for the rest of this run --
  // just re-hydrate cleanly for the sections that follow.
  window.FishWizzGearState.invalidate();
  await gearState.ensure({ force: true });
}

section('mentor-pro.js: the exact contradiction -- "No gear loaded" next to a correctly-loaded "2 combos known"');
{
  fields.planSummary = stubEl();
  fields.mission = stubEl();
  // quickFieldCard() wires onclick handlers onto these two button ids from
  // inside the HTML string it writes into #mentorNow -- same plain-string-
  // innerHTML limitation as tackleRetry above.
  fields.mentorStart = stubEl();
  fields.mentorMore = stubEl();
  // Same reason: addSessionPlan() (called from enhance()) wires these two
  // from its own HTML-string button markup.
  fields.mentorCaught = stubEl();
  fields.mentorNoContact = stubEl();
  // mentor-pro.js's boot() observes DOM mutations on #mission for its own
  // "clear and rebuild on a new Mission" path -- irrelevant to what this
  // section tests (the pending/resolved data lifecycle), so a no-op stub is
  // enough; nothing here asserts on mutation-driven rebuilds.
  globalThis.MutationObserver = class { observe() {} disconnect() {} };
  await import(pathToFileURL(path.join(root, 'public/mentor-pro.js')));
  const { bestOwned, inventoryLine, enhance, quickFieldCard } = globalThis.__fishwizzTest.mentorPro;
  const rec = { lure: 'Jig', color: 'Green', combo: 'Setup One' };

  window.lastMission = { recommendation: { primary: rec, start_zone: 'Fish the drop-off.' } };

  // Reset to a fresh, not-yet-loaded gear-state cache -- simulating
  // mentor-pro's own unconditional setTimeout(enhance,800) firing before
  // gear-state.js's shared fetch has resolved on a real network, exactly
  // the race the QA report reproduced.
  window.FishWizzGearState.invalidate();
  const pendingResult = bestOwned(rec);
  check('bestOwned() reports pending (not "zero gear") while the shared store has not loaded yet', pendingResult.pending === true);
  const pendingLine = inventoryLine(pendingResult, rec);
  check('the rendered line is a neutral "still checking" message, never a confident "No gear loaded"', pendingLine.combo === 'Checking your saved gear…');
  check('it does NOT claim noInventory (which would render the permanent "works without inventory" framing)', pendingLine.noInventory === false);

  // Build the #mentorNow card from this pending state, exactly as
  // quickFieldCard() does on the real page's first render.
  quickFieldCard();
  check('the card is marked pending so it is eligible for exactly one real refresh', fields.mentorNow?.dataset.pending === '1');
  const cardHtmlWhilePending = fields.mentorNow?.innerHTML || '';
  check('the pending card shows "Checking your saved gear…", never "No gear loaded"', cardHtmlWhilePending.includes('Checking your saved gear') && !cardHtmlWhilePending.includes('No gear loaded'));

  // Now the shared gear store actually finishes loading -- 2 real setups,
  // matching "2 combos known" elsewhere on the same page (ask-atlas.js,
  // already covered above). atlas:gear-hydrated is mentor-pro's real
  // trigger for this (see boot()); call enhance() directly here since it's
  // the function that listener invokes.
  await gearState.ensure({ force: true }); // repopulates window.combos with the 2 real setups
  enhance(); // no #planCards cards exist in this stub, but quickFieldCard() inside it must still refresh #mentorNow
  check('the SAME #mentorNow card was rebuilt (dataset.pending cleared), not left frozen on the pending render', fields.mentorNow?.dataset.pending === '');
  // Not asserting on "Owned" vs. "Best owned substitute" specifically --
  // that distinction depends on this fixture's word-overlap fuzzy-match
  // score, not on the fix under test here. What matters is that the card
  // now names the real, loaded setup instead of either stale placeholder.
  const resolvedCombo = fields.mentorNow?.innerHTML || '';
  check('the card now names the real, loaded setup ("Setup One") instead of a placeholder', resolvedCombo.includes('Setup One'));
  check('it no longer shows the pending placeholder', !resolvedCombo.includes('Checking your saved gear'));
  check('it no longer falsely claims no gear is loaded', !resolvedCombo.includes('No gear loaded'));

  // Once resolved, a later stray event must not blow the card away and
  // re-render it again (avoids render churn once the data is correct).
  const resolvedHtml = fields.mentorNow.innerHTML;
  const resultAfterResolved = bestOwned(rec);
  check('bestOwned() no longer reports pending once the store is hydrated', resultAfterResolved.pending === false);
  quickFieldCard();
  check('a second call after resolution is a no-op (same content, not rebuilt again)', fields.mentorNow.innerHTML === resolvedHtml);
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
