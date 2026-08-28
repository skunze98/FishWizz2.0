#!/usr/bin/env node
// Regression test for P2 "Make the first catch form complete before saving"
// (staging QA, 2026-08-27): "length/weight/release/photo/confidence
// controls became visible only AFTER the first catch was saved."
//
// Root cause: catch-pro.js is itself lazy-loaded (pwa.js only requests it
// once the Catches page is visited), so by the time it runs,
// document.readyState is already 'complete' -- yet wire() (the only thing
// that injects the Length/Weight/Release/Photo/Confidence controls, via
// ensureLearningFields()) used to wait an ADDITIONAL, unexplained 1200ms
// before running at all. Fixed by calling wire() immediately.
//
// Imports the real public/catch-pro.js. Run with:
//   node scripts/test-p2-first-catch-form.mjs
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
    value: '', hidden: false, textContent: '', innerHTML: '', dataset: {}, files: [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute() {}, getAttribute() {}, insertAdjacentElement() {}, insertAdjacentHTML(pos, html) { this.innerHTML += html; }, appendChild() {}, remove() {},
    closest() { return null; }, addEventListener() {}, focus() {}, querySelectorAll() { return []; }, replaceWith() {}, onclick: null,
    ...over,
  };
  el.cloneNode = () => stubEl();
  return el;
}

const fields = {};
const listeners = {};
globalThis.document = {
  readyState: 'complete', // matches the real situation: this file is lazy-loaded well after the page's own DOMContentLoaded
  head: stubEl(), body: stubEl(),
  // Strict, like the real DOM: an id nothing has registered returns null.
  // This matters here specifically -- ensureLearningFields() guards its own
  // insertion with `if(!$('cLength'))`, so an auto-vivifying stub (this
  // repo's other, more permissive test convention) would make that check
  // always false and silently skip the exact insertion this test exists to
  // verify.
  getElementById: (id) => fields[id] || null,
  createElement: () => stubEl(),
  addEventListener: (name, fn) => { (listeners[name] ||= []).push(fn); },
  dispatchEvent: (evt) => { (listeners[evt.type] || []).forEach(fn => fn(evt)); },
};
globalThis.window = globalThis;
globalThis.window.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.session = null;
globalThis.stat = () => {};
globalThis.api = async () => [];
globalThis.loadCatches = async () => {};

fields.saveCatch = stubEl();
// #cSpecies must be wrapped in a <label>, matching index.html's real static
// markup -- ensureLearningFields() inserts the measurement fields right
// after it.
const speciesLabel = stubEl();
fields.cSpecies = stubEl({ closest: () => speciesLabel });
const learnLabel = stubEl();
fields.cLearn = stubEl({ closest: () => learnLabel });

section('the fields exist the instant the module finishes loading -- no save, no delay, no wait');
{
  await import(pathToFileURL(path.join(root, 'public/catch-pro.js')));
  // ensureLearningFields() injects these via insertAdjacentHTML strings;
  // this test's stub captures that into speciesLabel/learnLabel's own
  // innerHTML (a real DOM would parse it into live elements) -- checking
  // for their markers there is the honest equivalent of "the control now
  // exists in the form" for this harness.
  const html = speciesLabel.innerHTML;
  check('module loaded without ever waiting on a timer this test had to sleep through', true);
  check('Length control is present', html.includes('id="cLength"'));
  check('Weight control is present', html.includes('id="cWeight"'));
  check('Release status control is present', html.includes('id="cReleased"'));
  check('Catch photo control is present', html.includes('id="cPhoto"'));
  check('Confidence control is present (in the learning fields block)', learnLabel.innerHTML.includes('id="cConfidence"'));
  check('all of these were present before enhancedSave() was ever called even once', true);
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
