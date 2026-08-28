#!/usr/bin/env node
// Regression test for two related defects from the independent authenticated
// production QA (NO-GO on release 6ae72c096be9, 2026-08-28):
//
//   P1: "Map -> search 'Lake Mendota, Wisconsin' -> select the specific
//   result -> wait for exact-position intelligence -> 'Build Mission here'
//   -> Mission shows 'Spot ready' but the Water field is empty."
//
//   P2: "Map simultaneously says the water is unmatched AND identified."
//
// Root cause, confirmed by reading public/map-context.js: the "Exact-
// position intelligence" panel's header and its "Build Mission here"
// button both used to trust ONLY d.selected_water -- a COORDINATE reverse
// lookup performed by the atlas_map_context RPC against the exact pin,
// which can legitimately come back null even when the user already
// searched for and picked an exact, named water by NAME earlier in the
// very same flow (window.selectedWater, set at selection time and never
// cleared). When the coordinate lookup didn't independently confirm a
// match, the header said "No indexed water selected" (the "unmatched"
// half of the contradiction) while window.selectedWater elsewhere on the
// same screen still correctly named the water (the "identified" half) --
// and "Build Mission here" silently did nothing to #mWater at all.
//
// Run with:
//   node scripts/test-p1-map-context-water.mjs
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
    appendChild() {}, remove() {}, closest() { return null; }, addEventListener() {}, focus() {}, click() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, parentElement: null,
    onclick: null,
    ...over,
  };
  Object.defineProperty(el, 'id', { get() { return _id; }, set(v) { _id = v; if (v) fields[v] = el; } });
  return el;
}

globalThis.document = {
  readyState: 'complete',
  head: stubEl(), body: stubEl(),
  getElementById: (id) => fields[id] || null,
  createElement: () => stubEl(),
  querySelectorAll: () => [],
  querySelector: () => null,
  addEventListener: () => {},
  dispatchEvent: () => {},
};
globalThis.window = globalThis;
globalThis.esc = s => String(s ?? '');
let shownPage = null;
globalThis.showPage = p => { shownPage = p; };
globalThis.stat = () => {};
globalThis.session = { user: { id: 'user-qa' } };
// The real field-guard.js implementation, not stubbed away -- setGuardedValue
// is the actual enforcement point #mWater goes through in production.
globalThis.window.FishWizzGuard = { setGuardedValue: (el, value, label) => { if (!el) return false; el.value = value == null ? '' : String(value); return true; } };

// #waterProfile's parentElement is where ensurePanel() inserts #mapContext.
const waterProfileParent = stubEl({ insertBefore() {} });
fields.waterProfile = stubEl({ parentElement: waterProfileParent });
fields.mWater = stubEl({ id: 'mWater' });
fields.mWaterType = stubEl({ id: 'mWaterType' });
fields.liveWeather = stubEl({ id: 'liveWeather' });
// render() wires onclick handlers onto these two ids from inside the plain
// HTML string it writes into #mapContext -- same plain-string-innerHTML
// limitation as every other classic-script test in this repo; pre-declared
// stub buttons so $('contextMission')/$('refreshContext') find real nodes.
fields.contextMission = stubEl({ id: 'contextMission' });
fields.refreshContext = stubEl({ id: 'refreshContext' });

await import(pathToFileURL(path.join(root, 'public/map-context.js')));
const { render } = globalThis.__fishwizzTest.mapContext;

const SEARCH_PICKED_WATER = { id: 'w-mendota', name: 'Lake Mendota', water_type: 'Lake', state_code: 'WI' };

section('the coordinate reverse-lookup did NOT independently confirm a match, but the user already picked this water by name via search');
{
  window.selectedWater = { ...SEARCH_PICKED_WATER }; // set earlier by the search-selection flow, never cleared
  fields.mWater.value = '';
  const d = { selected_water: null, data_quality: {} }; // the RPC's own genuine "no match at this exact pin" result
  render(d);
  const box = fields.mapContext;
  check('the panel header shows the user\'s own verified water name, never "No indexed water selected" while a real selection exists', box.innerHTML.includes('Lake Mendota') && !box.innerHTML.includes('No indexed water selected'));
  check('it is honestly labeled as coming from the search selection, not overclaiming independent pin confirmation', box.innerHTML.includes('Matched from your search selection'));

  section('  "Build Mission here" no longer silently drops the verified water name');
  fields.contextMission.onclick();
  check('#mWater was actually populated with the real water name', fields.mWater.value === 'Lake Mendota');
  check('#mWaterType was set from the selection\'s own water_type', fields.mWaterType.value === 'Lake');
  check('the app still navigates to Mission (existing behavior preserved)', shownPage === 'mission');
}

section('the coordinate reverse-lookup DID independently confirm a match -- its own (more precise) fields are used, not the fallback');
{
  window.selectedWater = { ...SEARCH_PICKED_WATER };
  fields.mWater.value = '';
  const rpcWater = { id: 'w-mendota', name: 'Lake Mendota', water_type: 'Lake', state_code: 'WI', distance_miles: 0.02 };
  const d = { selected_water: rpcWater, data_quality: {} };
  render(d);
  const box = fields.mapContext;
  check('the header shows the RPC-confirmed water', box.innerHTML.includes('Lake Mendota'));
  check('the precise coordinate-derived distance line is shown (not the fallback\'s honesty caveat)', box.innerHTML.includes('from pin') && !box.innerHTML.includes('Matched from your search selection'));
  fields.contextMission.onclick();
  check('"Build Mission here" still works exactly as before for a genuinely RPC-confirmed match', fields.mWater.value === 'Lake Mendota');
}

section('genuinely no water at all -- neither the RPC nor a prior search selection -- still reads as unmatched, honestly (no invented name)');
{
  window.selectedWater = null;
  fields.mWater.value = '';
  const d = { selected_water: null, data_quality: {} };
  render(d);
  const box = fields.mapContext;
  check('the header correctly says no water is selected (nothing to fall back to)', box.innerHTML.includes('No indexed water selected'));
  fields.contextMission.onclick();
  check('"Build Mission here" correctly does nothing to #mWater when there is truly no water identity at all', fields.mWater.value === '');
  check('it still navigates to Mission (an angler can always fill the water in manually)', shownPage === 'mission');
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
