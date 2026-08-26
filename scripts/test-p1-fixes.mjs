#!/usr/bin/env node
// Regression tests for the QA-tracker P1 commands (see DEPLOYMENT.md):
//   P1-4: named-lake search must resolve against the indexed catalog before
//         falling back to point-nearest matching
//   P1-9: the guided fishing session state machine (start/bump/end,
//         idempotency, persistence, end summary)
// Plain Node script, matching this repo's existing convention. Run with:
//   node scripts/test-p1-fixes.mjs
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

// --- P1-4: map.js's named-water catalog resolution ------------------------
await import(pathToFileURL(path.join(root, 'public/map.js')));
const { hintIsLakelike, pickNamedWaterMatch, normWaterName } = globalThis.__fishwizzTest?.map || {};

section('P1-4: hintIsLakelike');
check('a plain "Lake ___" name is lakelike with no category', hintIsLakelike({ name: 'Lake Minnetonka' }));
check('a Nominatim water/lake result is lakelike', hintIsLakelike({ name: 'Mendota', category: 'water', type: 'lake' }));
check('a reservoir/pond category counts as lakelike', hintIsLakelike({ name: 'Some Flowage', category: 'water', type: 'reservoir' }));
check('a river/dam search is not lakelike', !hintIsLakelike({ name: 'Lock and Dam 7', category: 'waterway', type: 'dam' }));
check('no hint at all is not lakelike', !hintIsLakelike(null));

section('P1-4: pickNamedWaterMatch -- deterministic Minnetonka/Mendota fixtures');
{
  // Reproduces the tracker's exact evidence: both major lakes returned "No
  // confident water match" because the geocoded search point for a large,
  // irregular lake is often nowhere near our own centroid or shoreline.
  const minnetonkaRows = [
    { id: 'mn-1', name: 'Lake Minnetonka', state_code: 'MN', water_type: 'lake', latitude: 44.94, longitude: -93.57 },
  ];
  const best = pickNamedWaterMatch(minnetonkaRows, { name: 'Lake Minnetonka, Hennepin County, Minnesota', state: 'MN' });
  check('Lake Minnetonka resolves to its single indexed MN record', best?.id === 'mn-1');

  const mendotaRows = [
    { id: 'wi-1', name: 'Lake Mendota', state_code: 'WI', water_type: 'lake', latitude: 43.11, longitude: -89.42 },
  ];
  const bestM = pickNamedWaterMatch(mendotaRows, { name: 'Lake Mendota, Dane County, Wisconsin', state: 'WI' });
  check('Lake Mendota resolves to its single indexed WI record', bestM?.id === 'wi-1');
}

section('P1-4: pickNamedWaterMatch -- ambiguity preserves the fallback instead of guessing');
{
  // MN has several real, distinct "Long Lake"s -- this must never silently
  // pick one; the caller falls through to the existing point-nearest flow.
  const rows = [
    { id: 'a', name: 'Long Lake', state_code: 'MN', water_type: 'lake' },
    { id: 'b', name: 'Long Lake', state_code: 'MN', water_type: 'lake' },
  ];
  check('same-state duplicate names -> null (no guess)', pickNamedWaterMatch(rows, { name: 'Long Lake', state: 'MN' }) === null);
  const cross = [
    { id: 'a', name: 'Long Lake', state_code: 'MN', water_type: 'lake' },
    { id: 'b', name: 'Long Lake', state_code: 'WI', water_type: 'lake' },
  ];
  check('a search hint state narrows an otherwise-ambiguous name to one', pickNamedWaterMatch(cross, { name: 'Long Lake', state: 'WI' })?.id === 'b');
  check('no rows at all -> null', pickNamedWaterMatch([], { name: 'Lake Minnetonka' }) === null);
  check('no hint name -> null', pickNamedWaterMatch([{ id: 'a', name: 'X' }], {}) === null);
}

section('P1-4: normWaterName');
check('case/punctuation-insensitive', normWaterName('Lake Minnetonka!') === normWaterName('lake   minnetonka'));

// --- P1-9: session-pro.js's guided fishing session state machine ----------
{
  const listeners = {};
  const fields = {};
  function stubEl(extra = {}) { return { innerHTML: '', hidden: false, classList: { add() {}, remove() {} }, insertAdjacentElement() {}, scrollIntoView() {}, ...extra }; }
  globalThis.document = {
    readyState: 'complete',
    getElementById: (id) => (fields[id] ||= stubEl()),
    addEventListener: (name, fn) => { (listeners[name] ||= []).push(fn); },
    dispatchEvent: (evt) => { (listeners[evt.type] || []).forEach(fn => fn(evt)); },
  };
  globalThis.window = globalThis;
  globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
  globalThis.localStorage = (() => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; })();

  const posts = [];
  let nextId = 1;
  globalThis.session = { user: { id: 'user-1' } };
  globalThis.lastMission = null;
  globalThis.stat = () => {};
  globalThis.esc = (v) => String(v ?? '');
  globalThis.showPage = () => {};
  // A minimal stand-in for app.js's api(): POST creates a row with an id,
  // PATCH/DELETE just succeed. Records every call so bump()/end() calls can
  // be asserted on directly rather than inferred from side effects alone.
  globalThis.api = async (pathStr, opt = {}) => {
    posts.push({ path: pathStr, method: opt.method || 'GET', body: opt.body ? JSON.parse(opt.body) : null });
    if ((opt.method || 'GET') === 'POST' && pathStr.includes('fishing_sessions')) {
      return [{ id: `sess-${nextId++}`, bites: 0, catches: 0, moves: 0, water_name: 'Lake Minnetonka', started_at: new Date().toISOString() }];
    }
    return [{}];
  };

  await import(pathToFileURL(path.join(root, 'public/session-pro.js')));
  // restore() is scheduled with setTimeout(800) at import; call it directly
  // instead of waiting, mirroring location-state.js's test re-wiring pattern.
  await new Promise(r => setTimeout(r, 10));

  section('P1-9: session start / idempotency');
  await window.fishwizzSession.start();
  check('a session starts as active', window.fishwizzSession.isActive());
  check('window.atlasActiveSession is set for other modules (mission_feedback linking, etc.)', !!window.atlasActiveSession);
  const idAfterFirstStart = window.fishwizzSession.active.id;
  await window.fishwizzSession.start();
  check('starting again while active does not create a second session row', posts.filter(p => p.method === 'POST' && p.path.includes('fishing_sessions')).length === 1);
  check('the active session identity is unchanged by the redundant start', window.fishwizzSession.active.id === idAfterFirstStart);

  section('P1-9: event logging bumps the right counter');
  await window.fishwizzSession.bump('bites');
  await window.fishwizzSession.bump('catches');
  await window.fishwizzSession.bump('catches');
  check('bites incremented', window.fishwizzSession.active.bites === 1);
  check('catches incremented independently', window.fishwizzSession.active.catches === 2);
  const patches = posts.filter(p => p.method === 'PATCH' && p.path.includes('fishing_sessions'));
  check('each bump persisted a PATCH with just that field', patches.some(p => p.body?.bites === 1) && patches.filter(p => 'catches' in (p.body || {})).length === 2);

  section('P1-9: navigation/refresh persistence');
  check('active session is persisted to localStorage for a refresh to restore', JSON.parse(localStorage.getItem('atlas:activeSession') || 'null')?.catches === 2);

  section('P1-9: ending produces a summary without creating an unconfirmed catch');
  const catchInserts = posts.filter(p => p.method === 'POST' && p.path.includes('/catches')).length;
  await window.fishwizzSession.end();
  check('session is no longer active after end()', !window.fishwizzSession.isActive());
  check('localStorage is cleared on end so a refresh does not resurrect it', localStorage.getItem('atlas:activeSession') === null);
  check('ending never inserts into catches', posts.filter(p => p.method === 'POST' && p.path.includes('/catches')).length === catchInserts);

  section('P1-9: a fresh session can start again after the previous one ended');
  await window.fishwizzSession.start();
  check('a new session starts cleanly post-end', window.fishwizzSession.isActive() && window.fishwizzSession.active.id !== idAfterFirstStart);
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
