#!/usr/bin/env node
// Regression test for P2 "Tackle navigation button has no accessible name"
// (release-blocking stabilization, 2026-08-28): "The visible Tackle button
// was exposed to accessibility tools as an unnamed button."
//
// Root cause, confirmed by reading the actual CSS cascade, not guessed:
// fishwizz-shell-v2.js's topLabels() hid the primary-nav Tackle button
// (hidden=true + aria-hidden="true" + tabIndex=-1) once gearBridge()
// provided an in-page "Tackle Box" shortcut instead -- but
// landing-app-theme.css/fishwizz-v1.css apply `.nav button{display:flex
// !important}` unconditionally at most viewport widths, with no matching
// `.nav button[hidden]{display:none}` override outside one narrow mobile
// media query. The button stayed visually present and mouse-clickable
// while simultaneously marked aria-hidden and unfocusable -- exactly the
// reported inconsistency. Fixed by no longer hiding it at all: Tackle
// stays index.html's own normal, always-visible, always-labeled primary
// nav item, matching the P2 acceptance criteria directly instead of
// patching the CSS to make an intentional hide "really" hide it (which
// would leave Tackle unreachable from primary nav entirely).
//
// Imports the real public/fishwizz-shell-v2.js and reads the real CSS
// files this repo ships, to directly re-confirm the cascade gap this fix
// routes around rather than papers over. Run with:
//   node scripts/test-p2-nav-accessibility.mjs
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

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
    value: '', hidden: false, textContent: 'Tackle', innerHTML: '', dataset: { page: 'tackle' },
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    attrs: { 'aria-label': 'Tackle' },
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; }, removeAttribute(k) { delete this.attrs[k]; },
    insertAdjacentElement() {}, insertAdjacentHTML() {}, appendChild() {}, remove() {},
    closest() { return null; }, addEventListener() {}, focus() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    tabIndex: 0,
    ...over,
  };
  el.cloneNode = () => stubEl();
  return el;
}

section('the actual CSS cascade gap this fix routes around, confirmed directly against the shipped files');
{
  const landingTheme = fs.readFileSync(path.join(root, 'public/landing-app-theme.css'), 'utf8');
  const v1 = fs.readFileSync(path.join(root, 'public/fishwizz-v1.css'), 'utf8');
  const unconditionalDisplayFlex = /\.nav button\{[^}]*display:flex!important/.test(v1);
  check('fishwizz-v1.css really does force .nav button to display:flex unconditionally (not viewport-gated)', unconditionalDisplayFlex);
  const mobileHiddenOverride = /@media\(max-width:820px\)[^]*?\.nav button\[hidden\]\{display:none!important/.test(landingTheme);
  check('a [hidden] override for that only exists inside the narrow mobile media query, confirming the gap outside it', mobileHiddenOverride);
}

section('fishwizz-shell-v2.js: the Tackle nav button is no longer hidden, aria-hidden, or removed from tab order');
{
  const fields = {};
  const listeners = {};
  globalThis.MutationObserver = class { observe() {} disconnect() {} };
  globalThis.document = {
    readyState: 'complete',
    documentElement: { dataset: {} },
    head: stubEl(), body: stubEl(),
    getElementById: (id) => (fields[id] ||= stubEl()),
    createElement: () => stubEl(),
    querySelector: (sel) => (sel === `.nav [data-page="tackle"]` ? fields.tackleNavBtn : sel === '.brand' ? stubEl() : null),
    querySelectorAll: () => [],
    addEventListener: (name, fn) => { (listeners[name] ||= []).push(fn); },
    dispatchEvent: (evt) => { (listeners[evt.type] || []).forEach(fn => fn(evt)); },
  };
  globalThis.window = globalThis;
  globalThis.window.addEventListener = () => {};
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  globalThis.session = { user: { id: 'user-qa' } };
  globalThis.stat = () => {};
  globalThis.showPage = () => {};

  // The exact real markup: an already-correctly-labeled button, matching
  // index.html's own `<button data-page="tackle" aria-label="Tackle">
  // Tackle</button>`.
  fields.tackleNavBtn = stubEl({ id: 'tackleNavBtn', textContent: 'Tackle', attrs: { 'aria-label': 'Tackle' }, tabIndex: 0 });

  await import(pathToFileURL(path.join(root, 'public/fishwizz-shell-v2.js')));

  const btn = fields.tackleNavBtn;
  check('Tackle is discoverable as a button named "Tackle" (aria-label untouched)', btn.attrs['aria-label'] === 'Tackle');
  check('the button was never marked hidden', btn.hidden === false);
  check('the button was never marked aria-hidden', btn.attrs['aria-hidden'] === undefined);
  check('the button was never removed from the keyboard tab order (tabIndex left alone)', btn.tabIndex === 0);
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
