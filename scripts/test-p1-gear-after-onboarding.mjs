#!/usr/bin/env node
// Regression test for P1 "Fix incomplete Gear rendering after onboarding"
// (staging QA, 2026-08-27): "'Save & Add Gear' initially showed only
// heading, '+Add Gear', 'Tackle Box' -- no entry controls/collection;
// clicking '+Add Gear' did nothing; a full refresh fixed it."
//
// Root cause, confirmed by reading pwa.js's watchNavigation(), not guessed:
// the Arsenal/Gear module group is only ever lazy-loaded from a real click
// on a [data-page] element -- onboarding.js's "Save & Add Gear" button
// calls showPage('arsenal') as a plain function call, which never bubbles a
// click through a [data-page] element, so arsenal-safe.js (and the rest of
// the `arsenal` group) was simply never requested. Fixed by having
// showPage() itself -- the one shared entry point -- also trigger the
// target page's lazy group load, so every programmatic navigation gets the
// same guarantee a real nav-tab click already had.
//
// Imports the real public/pwa.js. Run with:
//   node scripts/test-p1-gear-after-onboarding.mjs
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
  return {
    value: '', hidden: false, textContent: '', innerHTML: '', dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute() {}, getAttribute() {}, insertAdjacentElement() {}, appendChild() {}, remove() {},
    closest() { return null; }, addEventListener() {}, focus() {},
    ...over,
  };
}

const scriptTags = []; // every <script> pwa.js's loader actually appended
const listeners = {};
globalThis.document = {
  readyState: 'complete',
  documentElement: { dataset: {} },
  body: { appendChild: (el) => { scriptTags.push(el); queueMicrotask(() => el.onload?.()); } },
  head: stubEl(),
  getElementById: () => null,
  querySelector: () => null,
  createElement: () => stubEl({}),
  addEventListener: (name, fn) => { (listeners[name] ||= []).push(fn); },
  dispatchEvent: (evt) => { (listeners[evt.type] || []).forEach(fn => fn(evt)); },
};
globalThis.window = globalThis;
globalThis.window.addEventListener = () => {};
// Node >=21 ships a read-only global `navigator` getter; override it rather
// than assign directly.
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
globalThis.stat = () => {};

// The real showPage() app.js defines -- a plain page-switch, exactly its
// shape, but tracked here so this test can assert it still actually runs
// (the wrap must call through, not replace it).
let pagesShown = [];
globalThis.showPage = (id) => { pagesShown.push(id); };

await import(pathToFileURL(path.join(root, 'public/pwa.js')));
const { loadGroup, pageGroup, wireShowPageLazyLoad, groups, loaded } = globalThis.__fishwizzTest.pwa;

section('pageGroup() maps every real page to the group the QA report actually depends on');
{
  check('arsenal page maps to the arsenal group', pageGroup('arsenal') === 'arsenal');
  check('an unknown page falls back to mission (matches the real default)', pageGroup('made-up-page') === 'mission');
}

section('the exact reported bug: showPage(\'arsenal\') called directly (as onboarding.js does), not via a click');
{
  wireShowPageLazyLoad();
  check('showPage was wrapped', window.showPage.__fwLazyWrapped === true);

  scriptTags.length = 0;
  pagesShown = [];
  window.showPage('arsenal'); // exactly onboarding.js's finish('gear') call shape
  check('the real showPage() still ran (the page actually switches)', pagesShown[0] === 'arsenal');
  // loadGroup() appends <script> tags asynchronously (loadOne() returns a
  // promise per script); give its fire-and-forget chain a tick to run.
  await new Promise(r => setTimeout(r, 10));
  const arsenalScripts = groups.arsenal.map(([src]) => src);
  check('every script in the arsenal group was requested, without any click ever happening',
    arsenalScripts.every(src => scriptTags.some(t => t.src === src)));
  check('arsenal-safe.js specifically was requested (the actual Gear page renderer)',
    scriptTags.some(t => t.src === '/arsenal-safe.js'));
}

section('idempotency: reaching the same page later via a real nav click does not re-request already-loaded scripts');
{
  scriptTags.length = 0;
  await loadGroup('arsenal'); // simulates a later real [data-page="arsenal"] click
  check('no scripts were re-appended -- loadOne()\'s own `loaded` tracking already covers this', scriptTags.length === 0);
  check('the group is recorded as loaded', groups.arsenal.every(([, key]) => loaded.has(key)));
}

section('wireShowPageLazyLoad() is itself idempotent (called twice, e.g. by a hot-reload or duplicate boot)');
{
  const onceWrapped = window.showPage;
  wireShowPageLazyLoad();
  check('a second call does not wrap the wrapper again', window.showPage === onceWrapped);
}

section('P1 regression, caught live in a real browser: a single real nav click must not double-load a group');
{
  // Matches the actual page shape: app.js wires b.onclick=()=>showPage(...)
  // on every [data-page] element AND (before the fix) watchNavigation()
  // ALSO listened for the same click via delegation on `document` -- two
  // independent triggers for the one click. Reproduced here exactly that
  // way: a real DOM click bubbling to `document` (what watchNavigation()
  // used to listen for) alongside the element's own onclick calling
  // showPage() (what actually drives real navigation).
  const catchesGroup = groups.catches.map(([src]) => src);
  loaded.clear();
  const btn = { dataset: { page: 'catches' }, onclick: () => window.showPage('catches') };
  scriptTags.length = 0;
  btn.onclick(); // the element's own click handler (app.js)
  document.dispatchEvent({ type: 'click', target: { closest: (sel) => (sel === '[data-page]' ? btn : null) } }); // the bubbled document click watchNavigation() used to also catch
  await new Promise(r => setTimeout(r, 20));
  const catchHistoryProTags = scriptTags.filter(t => t.src === '/catch-history-pro.js');
  check('catch-history-pro.js was requested exactly once for one click, not twice', catchHistoryProTags.length === 1);
  const uniqueCatchesScripts = new Set(scriptTags.filter(t => catchesGroup.includes(t.src)).map(t => t.src));
  check('every script in the group was requested exactly once each', scriptTags.filter(t => catchesGroup.includes(t.src)).length === uniqueCatchesScripts.size);
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
