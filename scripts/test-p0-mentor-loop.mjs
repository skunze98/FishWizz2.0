#!/usr/bin/env node
// Regression test for the ACTUAL P0 root cause behind "Mission creation
// still freezes in authenticated production, 0 of 10 builds passed, the
// promised timeout/Retry UI never appears, browser control is interrupted"
// (independent authenticated production QA, NO-GO on release 6ae72c096be9,
// 2026-08-28).
//
// The prior P0 fix (src/runtime/api.js's AbortController timeout,
// mission-v3.js's buildPlan() rewrite) addressed an ASYNC hang -- a fetch
// promise that never resolved. It could never have helped here: the real
// mechanism is a SYNCHRONOUS main-thread starvation loop in mentor-pro.js,
// introduced by this session's own earlier P1 gear-unify fix.
//
// mentor-pro.js's boot() installs a MutationObserver on #mission that calls
// enhance() (which calls quickFieldCard()) on almost every DOM change inside
// it. quickFieldCard()/enhance() used to remove and recreate the SAME
// placeholder card on every single call while gear state was still
// pending -- but removing and recreating a node is itself an observed DOM
// mutation, so the observer fires again immediately, calls enhance() again,
// which removes and recreates again... forever, as long as gear state
// stays not-loaded. Two real ways that happens on a real account:
//   1. A fetch that is still genuinely in flight when the first Mission
//      card renders (a real, plausible race -- not a bug on its own).
//   2. A fetch that FAILED -- gear-state.js's own ensure() used to only put
//      the error on the ensure() promise's resolved value, never on the
//      module-scope `cache` object get() actually returns, so a real
//      failure looked EXACTLY like "still loading" to every peek-only
//      reader, forever, for the rest of that page's lifetime.
// Case 2 explains "0 of 10 consecutive builds passed" specifically: once
// one gear fetch fails for a QA account (network hiccup, cold start, an
// RLS edge case), EVERY subsequent Mission build in that same tab hits the
// same infinite loop, not just the one unlucky attempt.
//
// This is why the browser looked "interrupted" rather than merely slow, and
// why api.js's 12s timeout/Retry UI never rendered: it is a setTimeout
// (a macrotask) racing against a MutationObserver callback that keeps
// re-queuing itself as a microtask on every tick -- the event loop never
// goes idle long enough to reach the macrotask queue at all.
//
// This test's harness -- unlike scripts/test-p1-gear-unify.mjs's own
// `MutationObserver { observe(){} disconnect(){} }` no-op stub -- actually
// invokes the registered callback when a tracked element is mutated, which
// is exactly what let this ship undetected: every existing test exercised
// the pending->resolved data lifecycle directly, never the observer loop
// that drives it for real in a browser.
//
// Run with:
//   node scripts/test-p0-mentor-loop.mjs
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

// A generous ceiling: a correct implementation performs at most a small,
// fixed number of real DOM mutations per Mission (one placeholder insert,
// at most one resolved-state replace, plus the same for each of up to 3
// per-card .mentor-inventory blocks and the one-time session-plan card --
// comfortably under 20). The old, buggy code blew well past this within a
// handful of ticks and would otherwise spin until the process is killed.
const MAX_MUTATIONS = 40;
let mutationCount = 0;
let observerCallback = null;

function fireMutation(addedNodes, removedNodes) {
  mutationCount++;
  if (mutationCount > MAX_MUTATIONS) {
    throw new Error(`mutation storm detected: exceeded ${MAX_MUTATIONS} observed DOM mutations -- this is the exact infinite MutationObserver loop the P0 fix eliminates`);
  }
  if (observerCallback) observerCallback([{ addedNodes, removedNodes }]);
}

globalThis.MutationObserver = class {
  constructor(cb) { observerCallback = cb; }
  observe() {}
  disconnect() {}
};

function stubEl(over = {}) {
  let _id = over.id || '';
  const el = {
    value: '', hidden: false, textContent: '', innerHTML: '', dataset: {}, nodeType: 1,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute() {}, getAttribute() {}, insertAdjacentElement() {}, insertAdjacentHTML() {},
    appendChild() {}, remove() { if (_id) delete fields[_id]; },
    closest() { return null; }, addEventListener() {}, focus() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    onclick: null,
    ...over,
  };
  Object.defineProperty(el, 'id', { get() { return _id; }, set(v) { _id = v; if (v) fields[v] = el; } });
  el.cloneNode = () => stubEl();
  return el;
}

// #planSummary is where quickFieldCard() inserts #mentorNow
// (insertAdjacentElement('afterend', box)) -- this is the exact call this
// test wires into fireMutation, and the real one that starts the loop.
const planSummary = stubEl({
  id: 'planSummary',
  insertAdjacentElement(_pos, node) {
    node.remove = function () { delete fields[this.id]; fireMutation([], [node]); };
    fireMutation([node], []);
  },
});
fields.planSummary = planSummary;
fields.mission = stubEl({ id: 'mission' });
fields.mentorStart = stubEl();
fields.mentorMore = stubEl();
fields.mentorCaught = stubEl();
fields.mentorNoContact = stubEl();
// One fake #planCards .plan card so enhance() proceeds past its own
// early-return, with a real per-card .mentor-inventory mutation path too.
let planCardBox = null;
const planCard = stubEl({
  querySelector: () => planCardBox,
  appendChild(node) { planCardBox = node; fireMutation([node], []); },
});

const listeners = {};
globalThis.document = {
  readyState: 'complete',
  head: stubEl(), body: stubEl(),
  getElementById: (id) => fields[id] || null,
  createElement: () => stubEl(),
  querySelectorAll: (sel) => (sel === '#planCards .plan' ? [planCard] : []),
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
globalThis.fishwizzAuth = { generation: () => 1 };
globalThis.api = async (p) => {
  if (p.includes('/combos?')) return [{ id: 'c1', atlas_id: 'S1', name: 'Setup One', rod_id: 'r1', reel_id: 're1' }];
  if (p.includes('/rods?')) return [{ id: 'r1', brand: 'St. Croix', model: 'Rod 1' }];
  if (p.includes('/reels?')) return [{ id: 're1', brand: 'Shimano', model: 'Reel 1' }];
  if (p.includes('/lures?')) return [];
  return [];
};

await import(pathToFileURL(path.join(root, 'public/gear-state.js')));
const gearState = globalThis.__fishwizzTest.gearState;

await import(pathToFileURL(path.join(root, 'public/mentor-pro.js'))); // boot() runs on import (readyState is 'complete')
const { bestOwned, enhance } = globalThis.__fishwizzTest.mentorPro;

const rec = { lure: 'Jig', color: 'Green', combo: 'Setup One' };
window.lastMission = { recommendation: { primary: rec, start_zone: 'Fish the drop-off.' } };

section('gear state still genuinely IN FLIGHT (never resolved) -- the render happens once, then the observer goes quiet');
{
  mutationCount = 0;
  window.FishWizzGearState.invalidate(); // fresh cache: loaded:false, error:null -- exactly "still checking", forever, in this section
  enhance(); // simulates the boot-time setTimeout(enhance,800)/atlas:fishing-position trigger while gear is still loading
  check('did not exceed the mutation ceiling (no infinite loop)', mutationCount <= MAX_MUTATIONS);
  // Two legitimate placeholders get created once (the #mentorNow quick-field
  // card, and one .mentor-inventory block on the single fake plan card) --
  // each insertion re-triggers the observer exactly once more, which
  // re-enters enhance() and finds nothing left to do. The invariant under
  // test is boundedness and stabilization, not this exact count.
  check('a small, bounded number of real DOM mutations happened, not an unbounded stream', mutationCount >= 1 && mutationCount <= 4);
  check('#mentorNow was created and correctly marked pending', fields.mentorNow?.dataset.pending === '1');
  check('it shows the neutral "still checking" message, never a false "No gear loaded"', fields.mentorNow.innerHTML.includes('Checking your saved gear') && !fields.mentorNow.innerHTML.includes('No gear loaded'));

  section('  further calls with gear STILL not resolved cause zero additional mutations (this is what actually breaks the loop)');
  const stableAt = mutationCount;
  enhance(); enhance(); enhance();
  check('repeated re-entry while nothing has changed performs no further DOM writes', mutationCount === stableAt);
}

section('gear state resolves to a genuine, permanent FETCH FAILURE -- exactly one honest replace, never a loop');
{
  mutationCount = 0;
  const realApi = globalThis.api;
  globalThis.api = async () => { throw new Error('PostgREST: connection reset'); };
  await gearState.ensure({ force: true }); // resolves cache to {loaded:false, error:'...'} AND dispatches atlas:gear-hydrate-failed
  globalThis.api = realApi;
  check('gear-state.js\'s own cache (get(), not just ensure()\'s return value) actually reflects the failure', window.FishWizzGearState.get().loaded === false && !!window.FishWizzGearState.get().error);
  check('bestOwned() now resolves pending to false for a permanent failure (it no longer looks identical to "still loading")', bestOwned(rec).pending === false && bestOwned(rec).error === 'PostgREST: connection reset');
  check('atlas:gear-hydrate-failed actually refreshed the placeholder (mentor-pro.js listens for it)', mutationCount > 0);
  check('did not exceed the mutation ceiling (no infinite loop even mid-resolution)', mutationCount <= MAX_MUTATIONS);
  check('#mentorNow now shows the honest "could not check" message, not stuck on "Checking…"', fields.mentorNow.innerHTML.includes('could not confirm your saved gear') && !fields.mentorNow.innerHTML.includes('Checking your saved gear'));
  check('it does NOT claim "No gear loaded — that is okay" for a real failure (that would be misleading)', !fields.mentorNow.innerHTML.includes('No gear loaded'));

  section('  further unrelated enhance() calls after resolution are true no-ops');
  const mutBefore = mutationCount;
  enhance(); enhance(); enhance();
  check('no additional mutations from repeated calls once resolved', mutationCount === mutBefore);
}

section('gear state resolves to a genuine SUCCESS -- exactly one honest replace, never a loop (the ordinary, common case)');
{
  Object.keys(fields).forEach(k => { if (k !== 'planSummary' && k !== 'mission' && !['mentorStart', 'mentorMore', 'mentorCaught', 'mentorNoContact'].includes(k)) delete fields[k]; });
  planCardBox = null;
  window.FishWizzGearState.invalidate();
  mutationCount = 0;
  enhance(); // first render: pending placeholder
  check('a small, bounded number of mutations for the initial pending placeholders', mutationCount >= 1 && mutationCount <= 4);
  await gearState.ensure({ force: true }); // real success this time -- dispatches atlas:gear-hydrated, mentor-pro listens and refreshes
  check('did not exceed the mutation ceiling resolving to success', mutationCount <= MAX_MUTATIONS);
  check('#mentorNow now reflects the resolved (non-pending) state', fields.mentorNow?.dataset.pending === '');
  check('no false "No gear loaded" or stuck "Checking…" message remains', !fields.mentorNow.innerHTML.includes('Checking your saved gear'));
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
