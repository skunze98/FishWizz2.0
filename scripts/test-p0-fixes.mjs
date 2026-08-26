#!/usr/bin/env node
// Regression tests for the QA-tracker P0 commands (see DEPLOYMENT.md):
//   P0-1: identity data must never enter fishing-domain fields
//   P0-3: a riverlike search must never resolve to a nearby lake
// Plain Node script, matching this repo's existing convention
// (scripts/check-syntax.mjs, scripts/test-mentor-explanations.mjs) rather
// than a test framework this project doesn't otherwise use. Run with:
//   node scripts/test-p0-fixes.mjs
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

// --- P0-3: map.js's water-matching ---------------------------------------
await import(pathToFileURL(path.join(root, 'public/map.js')));
const { hintIsRiverlike, bestWater } = globalThis.__fishwizzTest?.map || {};

section('P0-3: hintIsRiverlike');
check('detects a dam search', hintIsRiverlike({ name: 'Lock and Dam 7', category: 'waterway', type: 'dam' }));
check('detects a river by name alone (no category)', hintIsRiverlike({ name: 'Mississippi River' }));
check('detects a tailwater/lock/weir/rapids/falls', ['tailwater', 'lock', 'weir', 'rapids', 'falls'].every(w => hintIsRiverlike({ name: `Some ${w}` })));
check('a plain lake search is not riverlike', !hintIsRiverlike({ name: 'Lake Minnetonka', category: 'water', type: 'lake' }));
check('no hint at all (plain map tap) is not riverlike', !hintIsRiverlike(null) && !hintIsRiverlike(undefined));

section('P0-3: bestWater excludes lakes for a riverlike hint (the reported bug)');
{
  // Reproduces the tracker's exact evidence: "Lock and Dam 7 matched
  // Unnamed, lake, WI, 0.4 miles away with a lake-depth record" plus the
  // real river a few hundred meters further out.
  const rows = [
    { name: 'Unnamed', water_type: 'lake', state_code: 'WI', match_type: 'on_water', distance_miles: 0.4 },
    { name: 'Mississippi River', water_type: 'stream', state_code: 'MN', match_type: 'very_close', distance_miles: 0.6 },
  ];
  const damHint = { name: 'Lock and Dam 7', category: 'waterway', type: 'dam' };
  const best = bestWater(rows, damHint);
  check('never returns the lake for a dam search', best?.water_type !== 'lake');
  check('returns the real river instead', best?.name === 'Mississippi River');
}
{
  // Same rows, no search hint (a plain map tap) -- behavior must be
  // completely unchanged from before this fix: nearest/on_water wins.
  const rows = [
    { name: 'Unnamed', water_type: 'lake', state_code: 'WI', match_type: 'on_water', distance_miles: 0.4 },
    { name: 'Mississippi River', water_type: 'stream', state_code: 'MN', match_type: 'very_close', distance_miles: 0.6 },
  ];
  const best = bestWater(rows, null);
  check('a plain map tap (no hint) still returns the on_water match, lake or not', best?.name === 'Unnamed');
}
{
  // A named-lake search must be completely unaffected -- this fix only
  // ever narrows candidates for a riverlike hint, never re-ranks otherwise.
  const rows = [{ name: 'Lake Minnetonka', water_type: 'lake', state_code: 'MN', match_type: 'on_water', distance_miles: 0.02 }];
  const lakeHint = { name: 'Lake Minnetonka', category: 'water', type: 'lake' };
  check('a real lake search still resolves to the lake', bestWater(rows, lakeHint)?.name === 'Lake Minnetonka');
}
{
  // No type-compatible candidate at all -- must return null (caller then
  // keeps the searched label) rather than falling back to the wrong lake.
  const rows = [{ name: 'Unnamed', water_type: 'lake', state_code: 'WI', match_type: 'on_water', distance_miles: 0.05 }];
  const damHint = { name: 'Lock and Dam 7', category: 'waterway', type: 'dam' };
  check('no compatible candidate -> null, not the lake', bestWater(rows, damHint) === null);
}

// --- P0-1: email-shaped value rejection -----------------------------------
await import(pathToFileURL(path.join(root, 'public/field-guard.js')));
const { isEmailShaped } = globalThis.__fishwizzTest?.fieldGuard || {};

section('P0-1: isEmailShaped');
check('a real email is rejected', isEmailShaped('skylerhunze98@gmail.com'));
check('a real water name is accepted', !isEmailShaped('Lake Minnetonka'));
check('a river name with punctuation is accepted', !isEmailShaped("Mississippi River, Lock and Dam 7"));
check('empty/whitespace is accepted (nothing to reject)', !isEmailShaped('') && !isEmailShaped('   '));
check('a bare "@" with no real shape is accepted (not email-shaped)', !isEmailShaped('Cast @ the point'));

// --- P0-2: atomic location/Mission state ----------------------------------
// location-state.js is entirely event-driven DOM code (no pure-logic
// export makes sense to carve out the way map.js's ranking functions do),
// so this stubs a minimal document/window rather than restructuring it with
// a test-export guard. Stub fields are real tiny EventTargets so the
// module's actual `el.addEventListener('change', checkContext)` wiring
// fires for real, not a shortcut that calls internal functions directly.
{
  function stubField(value = '') {
    const listeners = [];
    return { value, dataset: {}, addEventListener: (name, fn) => listeners.push(fn), fire: () => listeners.forEach(fn => fn()) };
  }
  const fields = {
    planSummary: { innerHTML: '' }, planCards: { innerHTML: '' },
    feedbackBox: { hidden: false }, askAtlasAnswer: { innerHTML: '' },
  };
  const docListeners = {};
  globalThis.document = {
    readyState: 'complete',
    getElementById: (id) => fields[id] || null,
    addEventListener: (name, fn) => { (docListeners[name] ||= []).push(fn); },
    dispatchEvent: (evt) => { (docListeners[evt.type] || []).forEach(fn => fn(evt)); },
  };
  globalThis.window = globalThis; // window === globalThis, matching a real browser's top-level scope
  globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
  window.addEventListener = () => {}; // pageshow -- not exercised by these tests
  window.atlasFishingLocation = null;
  window.selectedWater = null;
  window.lastMission = null;

  await import(pathToFileURL(path.join(root, 'public/location-state.js')));
  const { locationKey, contextKey, CONTEXT_FIELDS, wireContextFields } = globalThis.__fishwizzTest?.locationState || {};
  // The module's own first wiring pass already ran at import (readyState is
  // 'complete' in this stub) before these fields existed -- re-run it now
  // that they do, exactly mirroring the real page's own delayed re-wire for
  // fields mission-v3.js injects asynchronously.
  CONTEXT_FIELDS.forEach(id => { fields[id] ||= stubField(''); });
  wireContextFields();

  section('P0-2: locationKey / contextKey');
  check('no position/water -> null key', locationKey() === null);
  window.atlasFishingLocation = { lat: 44.9364, lon: -93.5306 };
  check('a real position produces a stable coordinate key', locationKey() === '44.93640,-93.53060');
  window.atlasFishingLocation = null;
  window.selectedWater = { id: 'abc-123', name: 'Lake Minnetonka' };
  check('a matched water (no live position) keys by id', locationKey() === 'water:abc-123');

  section('P0-2: stale Mission is cleared when location changes (the reported bug)');
  {
    fields.planCards.innerHTML = '<article>old plan</article>';
    fields.feedbackBox.hidden = false;
    fields.askAtlasAnswer.innerHTML = '<p>old answer</p>';

    // Build a Mission for Lake Minnetonka -- mirrors mission-v3.js dispatching
    // atlas:mission-built right after setting window.lastMission.
    window.selectedWater = { id: 'minnetonka-id', name: 'Lake Minnetonka' };
    fields.mWater.value = 'Lake Minnetonka';
    window.lastMission = { context: { water: 'Lake Minnetonka' }, recommendation: {} };
    document.dispatchEvent(new CustomEvent('atlas:mission-built'));
    check('Mission gets tagged with the location it was built from', !!window.lastMission.location_key);

    // The tracker's exact scenario: switch to Lock and Dam 7 while the old
    // Minnetonka Mission is still rendered.
    window.selectedWater = null;
    window.atlasFishingLocation = { lat: 43.53, lon: -91.35 }; // real Lock and Dam 7 coordinates
    document.dispatchEvent(new CustomEvent('atlas:fishing-position'));

    check('old Mission is cleared the moment location changes', window.lastMission === null);
    check('rendered Mission cards are cleared', fields.planCards.innerHTML === '');
    check('feedback box is hidden again', fields.feedbackBox.hidden === true);
    check('stale Atlas answer is cleared', fields.askAtlasAnswer.innerHTML === '');
  }

  section('P0-2: changing target/conditions invalidates a stale Mission');
  {
    fields.planCards.innerHTML = '<article>bass plan</article>';
    window.atlasFishingLocation = { lat: 43.08, lon: -89.42 };
    fields.mWater.value = 'Lake Mendota';
    fields.mTarget.value = 'Bass';
    window.lastMission = { context: { water: 'Lake Mendota', target: 'Bass' }, recommendation: {} };
    document.dispatchEvent(new CustomEvent('atlas:mission-built'));
    check('Mission is tagged with its context', !!window.lastMission.context_key);

    fields.mTarget.value = 'Walleye';
    fields.mTarget.fire(); // real 'change' listener wired by the module, not an internal shortcut
    check('changing target clears the stale Mission', window.lastMission === null);
    check('rendered Mission cards are cleared for a context change too', fields.planCards.innerHTML === '');
  }

  section('P0-2: a redundant re-fire of the same location does not clear a fresh Mission');
  {
    fields.planCards.innerHTML = '<article>fresh plan</article>';
    window.atlasFishingLocation = { lat: 43.08, lon: -89.42 };
    window.lastMission = { context: { water: 'Lake Mendota' }, recommendation: {} };
    document.dispatchEvent(new CustomEvent('atlas:mission-built'));
    document.dispatchEvent(new CustomEvent('atlas:fishing-position')); // same coordinates as above, no real change
    check('same-location re-fire does not clear a just-built Mission', window.lastMission !== null);
    check('rendered cards are untouched', fields.planCards.innerHTML === '<article>fresh plan</article>');
  }
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
