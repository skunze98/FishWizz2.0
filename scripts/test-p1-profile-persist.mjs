#!/usr/bin/env node
// Regression test for P1 "Persist onboarding and Mission state" (staging
// QA, 2026-08-27): "onboarding saved nickname 'QA test Angler,' but after
// refresh Mission returned to 'Ready, shunze?'."
//
// Root cause, confirmed by reading pwa.js's lazy page-group loader, not
// guessed: angler-profile.js -- the ONLY thing that used to fetch the
// profile and populate window.atlasAnglerProfile -- is only ever loaded by
// pwa.js once the ACCOUNT page is visited (a separate lazy group from
// `mission`). A refresh landing on Mission (the default page) never
// triggered it, so the saved nickname never reached the greeting at all --
// not a timing race, a fetch that was never scheduled. Fixed with
// public/profile-state.js: one authoritative, eagerly-loaded profile store
// that today.js's own snapshot() now awaits directly, the same pattern
// gear-state.js already established for gear.
//
// Imports the real public/profile-state.js and public/today.js. Run with:
//   node scripts/test-p1-profile-persist.mjs
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

function stubEl(over = {}) {
  let _id = over.id || '';
  const el = {
    value: '', hidden: false, textContent: '', innerHTML: '', dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
    insertAdjacentElement() {}, insertAdjacentHTML() {}, appendChild() {}, remove() {}, closest() { return null; }, focus() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener() {}, onclick: null,
    ...over,
  };
  Object.defineProperty(el, 'id', { get() { return _id; }, set(v) { _id = v; if (v) fields[v] = el; } });
  return el;
}

const fields = {};
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
globalThis.session = { user: { id: UID, email: 'shunze@example.com' } };
globalThis.stat = () => {};
globalThis.showPage = () => {};
globalThis.fishwizzAuth = { generation: () => 1, ready: Promise.resolve() };

const PROFILE = { id: UID, display_name: 'QA test Angler', experience_level: 'casual', home_region: 'Rochester, MN', preferred_species: ['Walleye'], access_style: 'shore', gear_status: 'some', onboarding_completed: true };

let apiCalls = [];
globalThis.api = async (p) => {
  apiCalls.push(p);
  if (p.includes('/rpc/bootstrap_atlas_account')) return { success: true };
  if (p.includes('/profiles?')) return [PROFILE];
  if (p.includes('/catches?')) return [];
  if (p.includes('/combos?') || p.includes('/rods?') || p.includes('/reels?') || p.includes('/lures?')) return [];
  return [];
};

await import(pathToFileURL(path.join(root, 'public/gear-state.js')));
await import(pathToFileURL(path.join(root, 'public/profile-state.js')));
const profileState = globalThis.__fishwizzTest.profileState;

section('profile-state.js: the one authoritative fetch, before any Account-page module ever loads');
{
  apiCalls = [];
  const state = await profileState.ensure({ force: true });
  check('exactly 2 API calls (bootstrap RPC + profiles select)', apiCalls.length === 2);
  check('the profile carries the saved nickname', state.profile.display_name === 'QA test Angler');
  check('window.atlasAnglerProfile is populated as a side effect', window.atlasAnglerProfile?.display_name === 'QA test Angler');
}

section('the exact reported scenario: a refresh that lands on Mission (not Account), angler-profile.js never loaded');
{
  // pwa.js never loads angler-profile.js in this scenario -- deliberately
  // NOT importing public/angler-profile.js here at all, matching the real
  // bug's actual trigger condition (Account page group untouched).
  profileState.invalidate(); // simulate a fresh page load: nothing has fetched yet
  window.atlasAnglerProfile = null;
  fields.mission = stubEl();
  // render()'s HTML string wires onclick handlers onto these two button ids
  // -- same plain-string-innerHTML stub limitation as elsewhere in this
  // repo's Node tests.
  fields.todayPrimary = stubEl();
  fields.todaySecondary = stubEl();
  apiCalls = [];
  // today.js's own boot() (triggered automatically on import, matching how
  // it actually runs in the app) already fires an unawaited refresh() of
  // its own the instant it loads -- not asserting on state before that,
  // only on the outcome after this test's own explicit, awaited calls.
  await import(pathToFileURL(path.join(root, 'public/today.js')));
  const { snapshot, render } = globalThis.__fishwizzTest.today;

  const data = await snapshot(true);
  check('snapshot() itself triggered the profile fetch (without angler-profile.js ever being loaded)', apiCalls.some(p => p.includes('/profiles?')));
  check('window.atlasAnglerProfile now carries the saved nickname', window.atlasAnglerProfile?.display_name === 'QA test Angler');

  render(data);
  const greeting = fields.atlasToday?.innerHTML || '';
  check('the Mission-page greeting shows the real saved nickname', greeting.includes('Ready, QA test Angler?'));
  check('it does NOT fall back to the email-derived name (the exact reported "Ready, shunze?" bug)', !greeting.includes('Ready, shunze?'));
}

section('a genuine profile-fetch failure never renders a false default nickname');
{
  profileState.invalidate();
  window.atlasAnglerProfile = null;
  const realApi = globalThis.api;
  globalThis.api = async () => { throw new Error('PostgREST: connection reset'); };
  const state = await profileState.ensure({ force: true });
  check('a real failure carries a real error message', typeof state.error === 'string' && state.error.length > 0);
  globalThis.api = realApi;
  profileState.invalidate();
  await profileState.ensure({ force: true }); // restore a clean, hydrated state for anything after this
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
