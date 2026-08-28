#!/usr/bin/env node
// Regression test for the "visible update/reload path" requirement of the
// P1 service-worker upgrade lifecycle (release-blocking stabilization,
// 2026-08-28 follow-up): "Provide a visible update/reload path if an
// existing tab is running an obsolete release."
//
// Imports the real public/pwa.js. Run with:
//   node scripts/test-p1-sw-update-banner.mjs
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
    setAttribute() {}, getAttribute() {}, insertAdjacentElement() {}, insertAdjacentHTML() {}, appendChild() {}, remove() { if (_id) delete fields[_id]; },
    closest() { return null; }, addEventListener() {}, focus() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    onclick: null,
    ...over,
  };
  // document.createElement() returns a disconnected node whose id is
  // assigned AFTER creation (b.id='fwUpdateBanner'); registering it into
  // the shared `fields` map on that assignment is what lets a later
  // getElementById/$() find the exact node pwa.js itself created and
  // appended, instead of a fresh, disconnected stub.
  Object.defineProperty(el, 'id', { get() { return _id; }, set(v) { _id = v; if (v) fields[v] = el; } });
  el.cloneNode = () => stubEl();
  return el;
}

const listeners = {};
globalThis.document = {
  readyState: 'complete',
  documentElement: { dataset: {} },
  head: stubEl(), body: stubEl(),
  getElementById: (id) => fields[id] || null,
  createElement: () => stubEl(),
  querySelector: () => null,
  addEventListener: (name, fn) => { (listeners[name] ||= []).push(fn); },
  dispatchEvent: (evt) => { (listeners[evt.type] || []).forEach(fn => fn(evt)); },
};
globalThis.window = globalThis;
globalThis.window.addEventListener = () => {};
globalThis.stat = () => {};

section('a live version switch WHILE a tab is already open and running shows the update banner');
{
  // showUpdateBanner() wires an onclick handler onto this id from inside
  // the HTML string it writes into the banner -- same plain-string-
  // innerHTML limitation as elsewhere in this repo's Node tests.
  fields.fwUpdateReload = stubEl();
  const swListeners = {};
  // Node >=21 ships a read-only global `navigator` getter; override it
  // rather than assign directly.
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    onLine: true,
    serviceWorker: {
      controller: { state: 'activated' }, // this tab was ALREADY controlled before this listener was wired
      addEventListener: (name, fn) => { (swListeners[name] ||= []).push(fn); },
      register: async () => ({ update: async () => {} }),
    },
  } });
  await import(pathToFileURL(path.join(root, 'public/pwa.js')));
  const { watchServiceWorkerUpdates } = globalThis.__fishwizzTest.pwa;
  watchServiceWorkerUpdates();
  check('a controllerchange listener was actually registered', typeof swListeners.controllerchange?.[0] === 'function');

  swListeners.controllerchange[0](); // the new SW just took over from the old one
  check('the update banner was created', !!fields.fwUpdateBanner);
  check('it names FishWizz and offers a reload, not a silent/invisible change', fields.fwUpdateBanner.innerHTML.includes('new version') && fields.fwUpdateBanner.innerHTML.includes('id="fwUpdateReload"'));

  section('  a second controllerchange does not stack a duplicate banner');
  fields.fwUpdateBanner = null; // simulate: nothing rendered a second one, since $() would find the first if it existed
  const bannerBefore = fields.fwUpdateBanner;
  swListeners.controllerchange[0]();
  check('shown-once guard prevented a second banner creation attempt from doing anything new', fields.fwUpdateBanner === bannerBefore);
}

section('the FIRST-EVER activation on a previously-uncontrolled tab does NOT show a banner (nothing was running to be stale)');
{
  Object.keys(fields).forEach(k => delete fields[k]);
  const swListeners = {};
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    onLine: true,
    serviceWorker: {
      controller: null, // no controller yet -- this is a fresh, first-ever page load
      addEventListener: (name, fn) => { (swListeners[name] ||= []).push(fn); },
      register: async () => ({ update: async () => {} }),
    },
  } });
  await import(pathToFileURL(path.join(root, 'public/pwa.js')) + '?fresh=1');
  const { watchServiceWorkerUpdates } = globalThis.__fishwizzTest.pwa;
  watchServiceWorkerUpdates();
  swListeners.controllerchange[0](); // the SW's first-ever activation for this tab
  check('no update banner appears for a page that had nothing running before this activation', !fields.fwUpdateBanner);
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
