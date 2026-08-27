#!/usr/bin/env node
// Regression tests for the QA-tracker P2 commands (see DEPLOYMENT.md):
//   P2-10: guest Mission/catch draft persistence
//   P2-11: consistent post-save catch-form reset policy
//   P2-13: local required-field validation runs before the auth check
// Plain Node script, matching this repo's existing convention. Run with:
//   node scripts/test-p2-fixes.mjs
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
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; }, getAttribute(k) { return this.attrs[k]; },
    insertAdjacentElement() {}, insertAdjacentHTML() {}, appendChild() {}, remove() {}, closest() { return null; }, addEventListener() {}, focus() {},
    files: [], ...over,
  };
}

function makeDocument(fields) {
  const listeners = {};
  return {
    readyState: 'complete',
    head: stubEl(),
    getElementById: (id) => (fields[id] ||= stubEl()),
    createElement: () => stubEl(),
    addEventListener: (name, fn) => { (listeners[name] ||= []).push(fn); },
    dispatchEvent: (evt) => { (listeners[evt.type] || []).forEach(fn => fn(evt)); },
    _listeners: listeners,
  };
}

// --- P2-10: guest-draft.js -------------------------------------------------
{
  const fields = { mWater: stubEl(), mTarget: stubEl(), cWater: stubEl(), cSpecies: stubEl() };
  globalThis.document = makeDocument(fields);
  globalThis.window = globalThis;
  const store = new Map();
  globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) };

  await import(pathToFileURL(path.join(root, 'public/guest-draft.js')));
  const { readDraft, restore, wire, clearDraft, KEY } = globalThis.__fishwizzTest?.guestDraft || {};

  section('P2-10: guest draft save / restore');
  wire();
  check('module exports the expected surface', typeof restore === 'function' && typeof clearDraft === 'function' && typeof readDraft === 'function');

  // The stub DOM's addEventListener is a no-op (no real 'input' event
  // wiring to exercise), so this writes a draft the way the module's own
  // saveField() would, then confirms restore() applies it correctly --
  // that's the actual contract under test, not the DOM event plumbing.
  localStorage.setItem(KEY, JSON.stringify({ mWater: 'Lake Minnetonka', cSpecies: 'Walleye' }));
  fields.mWater.value = '';
  fields.cSpecies.value = '';
  fields.cWater.value = 'Already typed water';
  restore();
  check('an empty field is restored from the draft', fields.mWater.value === 'Lake Minnetonka');
  check('a second empty field restores independently', fields.cSpecies.value === 'Walleye');
  check('a field the user already filled is never overwritten', fields.cWater.value === 'Already typed water');

  section('P2-10: draft clears after a successful Mission/catch');
  clearDraft();
  check('localStorage draft key is removed', localStorage.getItem(KEY) === null);
  fields.mWater.value = '';
  restore();
  check('nothing left to restore after clearing', fields.mWater.value === '');
}

// --- P2-11 / P2-13: catch-pro.js's enhancedSave --------------------------
{
  const fields = {
    cWater: stubEl(), cSpot: stubEl(), cSpecies: stubEl(), cCombo: stubEl(), cLure: stubEl(), cColor: stubEl(),
    cLearn: stubEl(), cWhyWorked: stubEl(), cTryNext: stubEl(), cLength: stubEl(), cWeight: stubEl(),
    cConfidence: stubEl(), cReleased: stubEl(), cPhoto: stubEl({ files: [] }), cPhotoPreview: stubEl({ hidden: true }),
    catchContextNote: stubEl(), saveCatch: stubEl(),
  };
  globalThis.document = makeDocument(fields);
  globalThis.window = globalThis;
  window.URL = { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} };
  let statMsg = null, statKind = null;
  globalThis.stat = (msg, kind) => { statMsg = msg; statKind = kind; };
  const calls = [];
  globalThis.api = async (p, opt = {}) => { calls.push({ path: p, method: opt.method || 'GET', body: opt.body ? JSON.parse(opt.body) : null }); return [{ id: 'catch-1' }]; };
  globalThis.loadCatches = async () => {};
  globalThis.session = null;

  await import(pathToFileURL(path.join(root, 'public/catch-pro.js')));
  const { enhancedSave } = globalThis.__fishwizzTest?.catchPro || {};

  section('P2-13: local required-field validation runs before the auth check');
  await enhancedSave();
  check('empty required fields are rejected before any network call', calls.length === 0);
  check('the field-required message is shown, not a sign-in message', /water and species/i.test(statMsg || ''));
  check('the empty Water field is marked invalid', fields.cWater.attrs['aria-invalid'] === 'true');
  check('the empty Species field is marked invalid', fields.cSpecies.attrs['aria-invalid'] === 'true');

  section('P2-13: valid fields while signed out -> auth message, not silently lost');
  fields.cWater.value = 'Lake Minnetonka';
  fields.cSpecies.value = 'Walleye';
  await enhancedSave();
  check('still no network call while signed out', calls.length === 0);
  check('a sign-in message is shown once fields are valid', /sign in/i.test(statMsg || ''));
  check('the previously-invalid fields are cleared of the error state once valid', fields.cWater.attrs['aria-invalid'] === 'false' && fields.cSpecies.attrs['aria-invalid'] === 'false');
  check('typed values are preserved, not cleared, by the auth gate', fields.cWater.value === 'Lake Minnetonka' && fields.cSpecies.value === 'Walleye');

  section('P2-11: signed-in save clears every catch-specific field, including Water/Combo');
  globalThis.session = { user: { id: 'user-1' }, access_token: 'tok' };
  fields.cCombo.value = 'Chatterbait setup';
  fields.cSpot.value = 'North dock';
  let sawCatchSaved = false;
  document.addEventListener('atlas:catch-saved', () => { sawCatchSaved = true; });
  await enhancedSave();
  check('the catch was actually posted', calls.some(c => c.method === 'POST' && c.path.includes('/catches')));
  check('atlas:catch-saved fired for real (catch-history-pro.js etc. depend on this)', sawCatchSaved === true);
  const clearedIds = ['cWater', 'cSpot', 'cSpecies', 'cCombo', 'cLure', 'cColor', 'cLearn', 'cWhyWorked', 'cTryNext', 'cLength', 'cWeight'];
  check('every listed catch field is cleared, with no Water/Combo exception', clearedIds.every(id => fields[id].value === ''));
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
