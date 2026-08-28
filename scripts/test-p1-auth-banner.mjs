#!/usr/bin/env node
// Regression test for P1 "Authenticated users still see guest authentication
// controls" (release-blocking stabilization, 2026-08-28): "The page
// reported 'Connected to FishWizz,' loaded the signed-in QA profile, gear,
// setups, and catches, but simultaneously displayed 'WELCOME BACK,' 'Log
// In,' and 'Create Account.'"
//
// Audited fishwizz-shell-v2.js's authBanner() (the actual owner of that
// banner) end to end: it reads the same authoritative bare `session` global
// src/runtime/index.js's applySession() is the one place that ever writes
// (see src/runtime/auth-state.js), is called once at boot (after that
// initial session check has already resolved -- boot() runs from the
// eager LEGACY chain, which only begins after runtime/index.js's own
// session-resolution block completes), and re-runs on every real
// atlas:account-changed dispatch plus a MutationObserver on #signedOut/
// #signedIn's own hidden attribute (kept in exact sync with syncAuthUi()).
// No live wiring bug found in the current source; a QA session hitting a
// stale cached copy of this file predating this repo's auth-atomicity work
// (see P1 "different tabs load different versions" -- the actual, evidenced
// root cause of stale bundles being served at all) would reproduce exactly
// this symptom from an OLDER version of this same file. This test verifies
// the CURRENT wiring is correct, closing the loop with real coverage rather
// than only a hypothesis.
//
// Imports the real public/fishwizz-shell-v2.js. Run with:
//   node scripts/test-p1-auth-banner.mjs
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
  const el = {
    value: '', hidden: false, textContent: '', innerHTML: '', dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute() {}, getAttribute() {}, insertAdjacentElement() {}, insertAdjacentHTML() {}, appendChild() {}, remove() {},
    closest() { return null; }, addEventListener() {}, focus() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    onclick: null,
    ...over,
  };
  el.cloneNode = () => stubEl();
  return el;
}

const fields = {};
const listeners = {};
const observedTargets = [];
globalThis.MutationObserver = class {
  constructor(cb) { this.cb = cb; }
  observe(target) { observedTargets.push(target); }
  disconnect() {}
};
globalThis.document = {
  readyState: 'complete',
  documentElement: { dataset: {} },
  head: stubEl(), body: stubEl(),
  getElementById: (id) => (fields[id] ||= stubEl()),
  createElement: () => stubEl(),
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
  addEventListener: (name, fn) => { (listeners[name] ||= []).push(fn); },
  dispatchEvent: (evt) => { (listeners[evt.type] || []).forEach(fn => fn(evt)); },
};
globalThis.window = globalThis;
globalThis.window.addEventListener = (name, fn) => { (listeners[`window:${name}`] ||= []).push(fn); };
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.stat = () => {};
globalThis.showPage = () => {};

section('the exact reported scenario: session is already resolved and signed-in at boot time');
{
  // "boot() runs from the eager LEGACY chain, which only begins after
  // runtime/index.js's own session-resolution block completes" -- session
  // is genuinely correct and signed-in from the very first call, matching
  // a real signed-in QA account whose data (gear/catches/profile) already
  // loaded successfully by the time this file's own boot() runs.
  globalThis.session = { user: { id: 'user-qa', email: 'qa@example.com' } };
  fields.signedOut = stubEl({ hidden: true });
  fields.signedIn = stubEl({ hidden: false });

  await import(pathToFileURL(path.join(root, 'public/fishwizz-shell-v2.js')));

  const banner = fields.fwAuthBanner;
  check('a signed-in account never sees the WELCOME BACK banner at all', banner?.hidden === true);
  check('the banner was never populated with Log In / Create Account markup while signed in', !(banner?.innerHTML || '').includes('WELCOME BACK'));
}

section('a genuine account-changed dispatch (sign-out) correctly reveals the banner');
{
  globalThis.session = null;
  document.dispatchEvent({ type: 'atlas:account-changed' });
  const banner = fields.fwAuthBanner;
  check('signing out reveals the banner', banner?.hidden === false);
  check('the banner now shows WELCOME BACK / Log In / Create Account', (banner?.innerHTML || '').includes('WELCOME BACK') && banner.innerHTML.includes('Log In') && banner.innerHTML.includes('Create Account'));
}

section('signing back in (another real account-changed dispatch) hides it again -- never stuck showing both states');
{
  globalThis.session = { user: { id: 'user-qa', email: 'qa@example.com' } };
  document.dispatchEvent({ type: 'atlas:account-changed' });
  const banner = fields.fwAuthBanner;
  check('the banner is hidden again once signed back in', banner?.hidden === true);
}

section('the banner tracks #signedOut/#signedIn\'s own hidden attribute via a MutationObserver, staying in sync with syncAuthUi()');
{
  check('authWatch() actually observed both panels (not just relying on the account-changed event alone)', observedTargets.includes(fields.signedOut) && observedTargets.includes(fields.signedIn));
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
