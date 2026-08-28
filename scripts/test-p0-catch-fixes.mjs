#!/usr/bin/env node
// Regression tests for two P0 commands from the staging QA report of
// 2026-08-27 (deployment 3b8ad178 / commit ba44abd):
//
//   P0 "Enforce valid catch measurements" -- "FishWizz accepted and saved a
//   Bluegill measuring -5 in and 9999 lb, labeled it a personal best."
//
//   P0 "Respect explicitly cleared catch fields" -- "after building a
//   Walleye Mission, the user cleared Water/Species/Lure in the Catch form;
//   clicking Save catch silently restored Mission values and created
//   another Walleye catch."
//
// Imports the real public/measurement-guard.js, public/field-guard.js,
// public/catch-pro.js, public/catch-history-pro.js, and public/personal-
// hub.js -- not re-implementations of their logic -- matching this repo's
// existing plain-Node testability convention. Run with:
//   node scripts/test-p0-catch-fixes.mjs
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
  const listeners = {};
  const el = {
    value: '', hidden: false, textContent: '', innerHTML: '', dataset: {}, files: [],
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); },
    },
    attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; }, getAttribute(k) { return this.attrs[k]; },
    insertAdjacentElement() {}, insertAdjacentHTML() {}, appendChild() {}, remove() {}, closest() { return null; }, focus() {},
    addEventListener(name, fn) { (listeners[name] ||= []).push(fn); },
    _fire(name) { (listeners[name] || []).forEach(fn => fn()); },
    querySelectorAll() { return []; }, replaceWith() {}, onclick: null,
    ...over,
  };
  el.cloneNode = () => stubEl();
  return el;
}

function makeDocument(fields) {
  const listeners = {};
  return {
    readyState: 'complete',
    head: stubEl(), body: stubEl(),
    getElementById: (id) => (fields[id] ||= stubEl()),
    createElement: () => stubEl(),
    addEventListener: (name, fn) => { (listeners[name] ||= []).push(fn); },
    dispatchEvent: (evt) => { (listeners[evt.type] || []).forEach(fn => fn(evt)); },
  };
}

// --- shared boot: field-guard.js + measurement-guard.js --------------------
delete globalThis.window;
await import(pathToFileURL(path.join(root, 'public/field-guard.js')));
const realGuard = globalThis.__fishwizzTest?.fieldGuard;

const fields = {};
globalThis.document = makeDocument(fields);
globalThis.window = globalThis;
window.FishWizzGuard = realGuard;
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

await import(pathToFileURL(path.join(root, 'public/measurement-guard.js')));
const measure = globalThis.__fishwizzTest?.measure;

// ============================================================================
section('P0 measurement validation: boundary tests, direct against FishWizzMeasure');
// ============================================================================
{
  const cases = [
    ['length_in', -5, false, 'negative length (the exact reported -5 in)'],
    ['length_in', 0, false, 'zero length'],
    ['length_in', 0.01, true, 'just above the lower bound'],
    ['length_in', 18.5, true, 'a normal, valid length'],
    ['length_in', 100, true, 'exactly the upper bound'],
    ['length_in', 100.01, false, 'just above the upper bound'],
    ['length_in', 9999, false, 'the exact reported 9999 magnitude, on length'],
    ['length_in', NaN, false, 'non-finite (malformed) length'],
    ['length_in', 'abc', false, 'malformed non-numeric length'],
    ['length_in', '', true, 'empty length is optional and always valid'],
    ['length_in', null, true, 'null length is optional and always valid'],
    ['weight_lb', -1, false, 'negative weight'],
    ['weight_lb', 0, false, 'zero weight'],
    ['weight_lb', 0.01, true, 'just above the lower bound'],
    ['weight_lb', 3.25, true, 'a normal, valid weight'],
    ['weight_lb', 200, true, 'exactly the upper bound'],
    ['weight_lb', 200.01, false, 'just above the upper bound'],
    ['weight_lb', 9999, false, 'the exact reported 9999 lb'],
    ['weight_lb', Infinity, false, 'non-finite weight'],
    ['weight_lb', '', true, 'empty weight is optional and always valid'],
  ];
  for (const [key, raw, expectOk, label] of cases) {
    const r = measure.validateMeasurement(raw, key);
    check(`${key}=${JSON.stringify(raw)} (${label}) -> ${expectOk ? 'accepted' : 'rejected'}`, r.ok === expectOk);
  }
  check('a rejected value is never silently clamped into the result (no "value" carried through on failure)',
    measure.validateMeasurement(9999, 'weight_lb').value === undefined);
  check('an accepted value is returned exactly as entered, not rewritten', measure.validateMeasurement(18.5, 'length_in').value === 18.5);
}

// ============================================================================
section('P0 measurement validation: catch-pro.js creation form (client bypass surface)');
// ============================================================================
{
  const catchFields = {
    cWater: stubEl(), cSpecies: stubEl(),
    cSpot: stubEl(), cCombo: stubEl(), cLure: stubEl(), cColor: stubEl(),
    cLearn: stubEl(), cWhyWorked: stubEl(), cTryNext: stubEl(),
    cLength: stubEl(), cWeight: stubEl(), cConfidence: stubEl(), cReleased: stubEl(), cPhoto: stubEl({ value: '' }),
    saveCatch: stubEl(),
  };
  Object.assign(fields, catchFields);
  globalThis.session = { user: { id: 'user-qa', email: 'qa@example.com' }, access_token: 'tok' };
  const apiCalls = [];
  globalThis.api = async (p, opts) => { apiCalls.push({ p, opts }); return [{ id: 'new-catch', ...JSON.parse(opts.body) }]; };
  globalThis.loadCatches = async () => {};
  let lastStat = null;
  globalThis.stat = (msg, kind) => { lastStat = { msg, kind }; };

  // catch-pro.js's own wire() now runs immediately on import (P2: the
  // "form isn't fully rendered until after the first save" fix removed its
  // old artificial 1200ms boot delay) and, as part of that, calls
  // fillFromMission() once -- exactly what happens on a real page load. Set
  // Water/Species AFTER import, simulating the user typing them in
  // afterward, not before -- setting them first would just have that first
  // fillFromMission() call (correctly) leave them alone since there's no
  // Mission context to autofill from, but it's the real, honest sequencing
  // a live page actually goes through.
  await import(pathToFileURL(path.join(root, 'public/catch-pro.js')));
  const { enhancedSave } = globalThis.__fishwizzTest.catchPro;
  catchFields.cWater.value = 'Lake Minnetonka'; catchFields.cWater._fire('input');
  catchFields.cSpecies.value = 'Bluegill'; catchFields.cSpecies._fire('input');

  section('  the exact reported bypass: a Bluegill at -5 in / 9999 lb must never save');
  catchFields.cLength.value = '-5';
  catchFields.cWeight.value = '9999';
  apiCalls.length = 0;
  await enhancedSave();
  check('no API call was made', apiCalls.length === 0);
  check('the length field is marked invalid', catchFields.cLength.classList.contains('fw-field-error'));
  check('the weight field is marked invalid', catchFields.cWeight.classList.contains('fw-field-error'));
  check('an error is reported to the angler', lastStat?.kind === 'err' && /Length/.test(lastStat.msg));

  section('  a valid catch (length and weight both in range) saves successfully');
  catchFields.cLength.value = '18.5';
  catchFields.cWeight.value = '3.25';
  apiCalls.length = 0;
  await enhancedSave();
  check('exactly one API call was made', apiCalls.length === 1);
  check('the saved row carries the exact entered length', JSON.parse(apiCalls[0].opts.body).length_in === 18.5);
  check('the saved row carries the exact entered weight, not clamped', JSON.parse(apiCalls[0].opts.body).weight_lb === 3.25);
  check('field errors are cleared on success', !catchFields.cLength.classList.contains('fw-field-error') && !catchFields.cWeight.classList.contains('fw-field-error'));

  section('  length/weight remain optional -- a catch with neither still saves');
  catchFields.cWater.value = 'Lake Minnetonka'; catchFields.cSpecies.value = 'Bluegill';
  catchFields.cLength.value = ''; catchFields.cWeight.value = '';
  apiCalls.length = 0;
  await enhancedSave();
  check('the catch saved with both measurements null, not rejected', apiCalls.length === 1 && JSON.parse(apiCalls[0].opts.body).length_in === null);

  // ==========================================================================
  section('P0 "respect explicitly cleared catch fields": Mission -> Catch untouched vs. edited vs. cleared');
  // ==========================================================================
  const { fillFromMission, touched } = globalThis.__fishwizzTest.catchPro;

  section('  untouched form: Mission context fills every empty field');
  touched.clear();
  catchFields.cWater.value = ''; catchFields.cSpecies.value = ''; catchFields.cLure.value = '';
  window.lastMission = { context: { water: 'Lake Minnetonka', target: 'Walleye' }, recommendation: { primary: { lure: 'Jig', color: 'Chartreuse' } } };
  fillFromMission();
  check('an untouched Water field is filled from the Mission', catchFields.cWater.value === 'Lake Minnetonka');
  check('an untouched Species field is filled from the Mission', catchFields.cSpecies.value === 'Walleye');
  check('an untouched Lure field is filled from the Mission recommendation', catchFields.cLure.value === 'Jig');

  section('  the exact reported bug: Water/Species/Lure explicitly cleared, then a fresh Mission/position event fires again before Save');
  catchFields.cWater._fire('input'); // simulates the user's own clearing keystroke landing in the field
  catchFields.cWater.value = '';
  catchFields.cSpecies._fire('input');
  catchFields.cSpecies.value = '';
  catchFields.cLure._fire('input');
  catchFields.cLure.value = '';
  // A later, independent atlas:fishing-position / atlas:mission-built event
  // re-firing fillFromMission() -- exactly what a live GPS ping does on the
  // real Catch page, per the root-cause analysis -- must NOT resurrect what
  // was just explicitly cleared.
  fillFromMission();
  check('Water stays cleared after a later Mission/position re-fire', catchFields.cWater.value === '');
  check('Species stays cleared after a later Mission/position re-fire', catchFields.cSpecies.value === '');
  check('Lure stays cleared after a later Mission/position re-fire', catchFields.cLure.value === '');
  // An untouched field (Color, in this scenario) must still legitimately
  // benefit from the same event -- this proves the fix is per-field
  // touched-tracking, not "stop listening to Mission updates altogether".
  check('an UNTOUCHED field (Color) still gets filled by the same event', catchFields.cColor.value === 'Chartreuse');

  section('  clicking Save with Water and Species cleared: blocked, not silently restored+saved');
  apiCalls.length = 0;
  await enhancedSave();
  check('no catch was created for the cleared-required-fields case', apiCalls.length === 0);
  check('Water is marked required', catchFields.cWater.classList.contains('fw-field-error'));
  check('Species is marked required', catchFields.cSpecies.classList.contains('fw-field-error'));
  check('the values the user typed (empty) are still visible -- not silently restored to Mission values', catchFields.cWater.value === '' && catchFields.cSpecies.value === '');

  section('  clearing only ONE required field (Species) blocks save and marks only that field');
  catchFields.cWater.value = 'Lake Minnetonka'; catchFields.cWater._fire('input');
  catchFields.cSpecies.value = ''; catchFields.cSpecies._fire('input');
  apiCalls.length = 0;
  await enhancedSave();
  check('no catch was created', apiCalls.length === 0);
  check('only Species is marked required (Water is valid)', catchFields.cSpecies.classList.contains('fw-field-error') && !catchFields.cWater.classList.contains('fw-field-error'));

  section('  after a real save, the form is fresh again -- the next Mission legitimately re-fills it');
  catchFields.cWater.value = 'Lake Minnetonka'; catchFields.cWater._fire('input');
  catchFields.cSpecies.value = 'Walleye'; catchFields.cSpecies._fire('input');
  catchFields.cLength.value = ''; catchFields.cWeight.value = '';
  apiCalls.length = 0;
  await enhancedSave();
  check('the catch saved', apiCalls.length === 1);
  check('touched was reset after a successful save', touched.size === 0);
  window.lastMission = { context: { water: 'New Lake', target: 'Bass' }, recommendation: { primary: {} } };
  fillFromMission();
  check('the fresh, post-save form accepts new Mission defaults again', catchFields.cWater.value === 'New Lake');

  section('  double-click / repeated-submit protection');
  catchFields.cWater.value = 'Lake Minnetonka'; catchFields.cSpecies.value = 'Walleye';
  catchFields.cLength.value = '18'; catchFields.cWeight.value = '3';
  apiCalls.length = 0;
  const p1 = enhancedSave();
  const p2 = enhancedSave(); // fired while p1 is still in flight (busy=true)
  await Promise.all([p1, p2]);
  check('a second click while a save is in flight is a no-op, not a duplicate catch', apiCalls.length === 1);
}

// ============================================================================
section('P0: existing invalid records excluded from personal-best, never deleted or rewritten');
// ============================================================================
{
  const validRecords = [
    { id: 'a', species: 'Bluegill', length_in: 8, weight_lb: 1.2 },
    { id: 'b', species: 'Bluegill', length_in: 9, weight_lb: 1.5 },
    { id: 'c', species: 'Walleye', length_in: 22, weight_lb: 4.1 },
  ];
  // The exact QA record: still present in the array (never deleted), still
  // carries its original, untouched values.
  const invalidQaRecord = { id: 'qa-bluegill-bad', species: 'Bluegill', length_in: -5, weight_lb: 9999 };
  const c = [...validRecords, invalidQaRecord];

  section('  catch-history-pro.js pbs(): the invalid record never wins Personal Best');
  await import(pathToFileURL(path.join(root, 'public/catch-history-pro.js')));
  const { pbs, buildEditRow } = globalThis.__fishwizzTest.catchHistoryPro;
  const result = pbs(c);
  check('Bluegill personal best is the valid, larger real record (id "b"), not the corrupt 9999 lb one', result.Bluegill?.id === 'b');
  check('Walleye personal best is unaffected', result.Walleye?.id === 'c');
  check('the invalid QA record is still present in the input array, untouched (never deleted or rewritten)',
    c.find(x => x.id === 'qa-bluegill-bad')?.length_in === -5 && c.find(x => x.id === 'qa-bluegill-bad')?.weight_lb === 9999);

  section('  personal-hub.js bestValidCatch(): same exclusion on the Personal Best card');
  await import(pathToFileURL(path.join(root, 'public/personal-hub.js')));
  const { bestValidCatch } = globalThis.__fishwizzTest.personalHub;
  const best = bestValidCatch(c);
  check('the Personal Best card also skips the invalid 9999 lb record', best?.id !== 'qa-bluegill-bad');
  check('it picks the real heaviest valid catch instead', best?.id === 'c');

  section('  catch-history-pro.js buildEditRow(): editing uses the same validation as creation');
  const invalidEdit = buildEditRow([
    ['water', 'Lake Minnetonka'], ['spot', ''], ['species', 'Bluegill'],
    ['lure_bait', ''], ['color', ''], ['length_in', '-5'], ['weight_lb', '9999'], ['learned', ''],
  ]);
  check('editing the QA record with the same bad values is rejected (same bounds as creation)', invalidEdit.error?.key === 'length_in');
  check('no partial row was accepted on a rejected edit', invalidEdit.row.length_in === null);

  const fixEdit = buildEditRow([
    ['water', 'Lake Minnetonka'], ['spot', ''], ['species', 'Bluegill'],
    ['lure_bait', ''], ['color', ''], ['length_in', '9'], ['weight_lb', '1.5'], ['learned', ''],
  ]);
  check('correcting the QA record through the edit modal is accepted', !fixEdit.error);
  check('the corrected row carries the fixed numbers, not the original bad ones', fixEdit.row.length_in === 9 && fixEdit.row.weight_lb === 1.5);

  section('  buildEditRow() still enforces required Water/Species, same as creation');
  const missingRequired = buildEditRow([['water', ''], ['spot', ''], ['species', ''], ['lure_bait', ''], ['color', ''], ['length_in', ''], ['weight_lb', ''], ['learned', '']]);
  check('an edit clearing Water and Species is rejected, not silently saved', missingRequired.error?.message === 'Water and species are required.');
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
