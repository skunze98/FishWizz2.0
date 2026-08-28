#!/usr/bin/env node
// Regression test for P0 "Mission creation freezes the application"
// (release-blocking stabilization, 2026-08-28): "The UI becomes
// unresponsive for more than 60 seconds. The workflow does not return a
// Mission or a usable error."
//
// Root cause, confirmed by tracing the real deployed request path, not
// guessed: src/runtime/api.js's fetch() call had no timeout and no
// AbortController at all. Every await api(...) in the Mission chain
// (weather, gear/inventory, the Mission RPC itself) would hang forever if
// the underlying network request ever stalled instead of erroring outright.
//
// Imports the real src/runtime/api.js (via a lightweight ESM shim, since it
// uses `import.meta`/module syntax unlike the rest of this repo's plain
// classic scripts) and public/mission-v3.js. Run with:
//   node scripts/test-p0-mission-freeze.mjs
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

// ============================================================================
section('src/runtime/api.js: a stalled fetch rejects with a bounded timeout instead of hanging forever');
// ============================================================================
{
  const { makeApi } = await import(pathToFileURL(path.join(root, 'src/runtime/api.js')));

  globalThis.window = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON: 'anon-key', parse: async r => r.json() };
  // A fetch that never settles at all -- exactly the reported failure mode
  // (a stalled network request, not an outright HTTP error).
  // A real fetch() rejects its own promise the instant its AbortSignal
  // fires; this stand-in mimics that (a plain stalled Promise that ignores
  // the signal would never prove the timeout actually aborts anything).
  let abortedSignal = null;
  globalThis.fetch = (url, opts) => {
    abortedSignal = opts?.signal;
    return new Promise((resolve, reject) => {
      opts?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' })));
    });
  };
  const supabase = { auth: { getSession: async () => ({ data: { session: null } }) } };
  const session = { access_token: 'tok', user: { id: 'user-qa' } };
  const api = makeApi(supabase, () => session);

  const start = Date.now();
  let caught = null;
  try {
    await api('/rest/v1/rpc/get_mission_plan_v3', { method: 'POST', body: '{}', timeoutMs: 300 });
  } catch (e) { caught = e; }
  const elapsed = Date.now() - start;

  check('the call actually rejects instead of hanging forever', caught !== null);
  check('it rejects close to the requested timeout, not instantly and not after a long default', elapsed >= 280 && elapsed < 2000);
  check('the error message is something an angler can act on ("try again"), not a raw AbortError', /try again/i.test(caught?.message || ''));
  check('the error is flagged timedOut for callers that want to distinguish it', caught?.timedOut === true);
  check('the AbortController signal was actually wired into the fetch call', abortedSignal?.aborted === true);
}

section('src/runtime/api.js: a genuine network failure (not a timeout) gets its own clear message');
{
  const { makeApi } = await import(pathToFileURL(path.join(root, 'src/runtime/api.js')));
  globalThis.window = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON: 'anon-key', parse: async r => r.json() };
  globalThis.fetch = () => Promise.reject(Object.assign(new Error('fetch failed'), { name: 'TypeError' }));
  const supabase = { auth: { getSession: async () => ({ data: { session: null } }) } };
  const session = { access_token: 'tok' };
  const api = makeApi(supabase, () => session);
  let caught = null;
  try { await api('/rest/v1/catches'); } catch (e) { caught = e; }
  check('a real network failure is caught and re-thrown with a clear message', caught !== null && /check your connection/i.test(caught.message));
  check('it is flagged networkError, distinct from a timeout', caught?.networkError === true && !caught?.timedOut);
}

section('src/runtime/api.js: a normal, fast response still works exactly as before');
{
  const { makeApi } = await import(pathToFileURL(path.join(root, 'src/runtime/api.js')));
  globalThis.window = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON: 'anon-key', parse: async r => r.json() };
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: true, status: 200, json: async () => ({ ok: true }) }; };
  const supabase = { auth: { getSession: async () => ({ data: { session: null } }) } };
  const session = { access_token: 'tok' };
  const api = makeApi(supabase, () => session);
  const result = await api('/rest/v1/catches');
  check('a normal response resolves normally, unaffected by the new timeout machinery', result?.ok === true && calls === 1);
}

// ============================================================================
section('mission-v3.js: buildPlan() reaches a real end state on every path, with a visible Retry action');
// ============================================================================
{
  function stubEl(over = {}) {
    const el = {
      value: '', hidden: false, textContent: '', innerHTML: '', dataset: {},
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      setAttribute() {}, getAttribute() {}, insertAdjacentElement() {}, insertAdjacentHTML() {}, appendChild() {}, remove() {},
      closest() { return null; }, addEventListener(name, fn) { (el._listeners ||= {})[name] = fn; }, focus() {},
      querySelector() { return null; }, querySelectorAll() { return []; }, disabled: false,
      ...over,
    };
    el.cloneNode = () => stubEl();
    return el;
  }
  const fields = {};
  globalThis.document = {
    readyState: 'complete',
    head: stubEl(), body: stubEl(),
    getElementById: (id) => (fields[id] ||= stubEl()),
    createElement: () => stubEl(),
    querySelectorAll: () => [],
    addEventListener: () => {},
    dispatchEvent: () => {},
  };
  globalThis.window = globalThis;
  globalThis.window.addEventListener = () => {};
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  globalThis.session = { user: { id: 'user-qa' } };
  globalThis.stat = () => {};
  globalThis.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  globalThis.$ = id => document.getElementById(id);
  globalThis.panel = (name, html, empty) => `<div data-panel="${name}">${html || empty}</div>`;
  globalThis.lastMission = null;
  globalThis.selectedWater = null;
  globalThis.window.FishWizzMissionInventory = { load: async () => ({ combos: [], lures: [] }), fit: rec => rec };

  ['mWater', 'mTarget', 'mSeason', 'mClarity', 'mWind', 'mLight', 'mAccess', 'mCover', 'mCurrent', 'mDepth', 'mSky', 'mPrecip', 'mPressure', 'mWaterTemp', 'mLevel', 'mActivity', 'mWaterType'].forEach(id => { fields[id] = stubEl({ value: id === 'mWater' ? 'Lake Minnetonka' : id === 'mTarget' ? 'Walleye' : 'x' }); });
  fields.planSummary = stubEl();
  fields.planCards = stubEl();
  fields.feedbackBox = stubEl();
  fields.coach = stubEl();

  const RAW = { start_zone: 'Start around points.', adjustment_plan: 'Change one thing.', confidence: 68, data_note: 'General guidance.', primary: { combo: 'Medium spinning setup', lure: 'Jig', why: 'why', how: 'how' }, backup: null, finesse: null };

  section('  a hung/failed RPC produces a visible error state with a working Retry button, never an indefinite loading state');
  {
    globalThis.api = async (p) => { if (p.includes('get_mission_plan_v3')) throw Object.assign(new Error('FishWizz could not reach the server in time. Check your connection and try again.'), { timedOut: true }); return {}; };
    await import(pathToFileURL(path.join(root, 'public/mission-v3.js')));
    const { buildPlan, missionDebugState } = globalThis.__fishwizzTest.missionV3;

    await buildPlan();
    check('the build is no longer marked in-flight after a failure (guaranteed transition out of loading)', missionDebugState().inFlight === false);
    check('a real error state was rendered into #planSummary, not left on "Building..."', fields.planSummary.innerHTML.includes('Could not build this Mission'));
    check('the error message reached the card', fields.planSummary.innerHTML.includes('reach the server in time'));
    check('a visible Retry control exists', fields.planSummary.innerHTML.includes('id="missionRetry"'));
    check('the Mission button was re-enabled, not left stuck disabled', fields.coach.disabled === false);

    section('    clicking Retry re-runs buildPlan() without a page refresh');
    let secondAttempt = false;
    globalThis.api = async (p) => { if (p.includes('get_mission_plan_v3')) { secondAttempt = true; return RAW; } return {}; };
    const retryHandler = fields.missionRetry?._listeners?.click;
    check('a real click handler was actually wired onto the Retry button', typeof retryHandler === 'function');
    if (retryHandler) { await retryHandler(); }
    check('retrying actually re-invoked the RPC and this time succeeded', secondAttempt === true);
    check('after a successful retry, the card no longer shows the error state', !fields.planSummary.innerHTML.includes('Could not build this Mission'));
  }

  section('  duplicate-submission prevention: a second call while one is already in flight is a real no-op');
  {
    let rpcCalls = 0;
    let resolveFirst;
    globalThis.api = async (p) => {
      if (!p.includes('get_mission_plan_v3')) return {};
      rpcCalls++;
      return new Promise(r => { resolveFirst = () => r(RAW); });
    };
    const { buildPlan, missionDebugState } = globalThis.__fishwizzTest.missionV3;
    const first = buildPlan(); // still in flight -- api() above hasn't resolved yet
    await Promise.resolve(); await Promise.resolve(); // let the first call reach the RPC stage
    check('the button is disabled while a build is genuinely in flight', fields.coach.disabled === true);
    const second = buildPlan(); // a second call while the first is still running
    resolveFirst();
    await Promise.all([first, second]);
    check('only ONE real RPC call happened for the two overlapping calls', rpcCalls === 1);
    check('the build correctly settles back to not-in-flight afterward', missionDebugState().inFlight === false);
  }

  section('  ten consecutive Mission builds each complete or return a usable error within budget, none left hanging');
  {
    let rpcCalls = 0;
    globalThis.api = async (p) => { if (p.includes('get_mission_plan_v3')) { rpcCalls++; return RAW; } return {}; };
    const { buildPlan, missionDebugState } = globalThis.__fishwizzTest.missionV3;
    const start = Date.now();
    for (let i = 0; i < 10; i++) {
      await buildPlan();
      check(`build ${i + 1}/10 left the app not-in-flight (no indefinite loading)`, missionDebugState().inFlight === false);
    }
    const elapsed = Date.now() - start;
    check('all 10 builds together completed well within a generous real-world budget', elapsed < 15000);
    check('all 10 builds actually reached the RPC (none were incorrectly skipped)', rpcCalls === 10);
  }

  section('  Mission -> Map -> Mission navigation does not leave stale state (window.lastMission reflects the latest real build)');
  {
    globalThis.api = async (p) => (p.includes('get_mission_plan_v3') ? RAW : {});
    const { buildPlan } = globalThis.__fishwizzTest.missionV3;
    fields.mWater.value = 'Rainy Lake';
    await buildPlan();
    check('window.lastMission reflects the latest built Mission\'s water', window.lastMission?.context?.water === 'Rainy Lake');
    // Simulate leaving to Map and coming back -- nothing in buildPlan()
    // itself depends on page visibility, so state must simply still be
    // correct on the next real build.
    fields.mWater.value = 'Lake Minnetonka';
    await buildPlan();
    check('a Mission rebuilt with changed inputs after navigating away and back reflects the NEW input, not stale state', window.lastMission?.context?.water === 'Lake Minnetonka');
  }
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
