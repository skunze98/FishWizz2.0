#!/usr/bin/env node
// Regression test for P2 "Provide traceable recommendation evidence"
// (staging QA, 2026-08-27): "Mission gave narrative reasoning and LIVE/
// OFFICIAL/PERSONAL/ESTIMATED labels but no specific source/agency record/
// observation time/evidence identified."
//
// Root cause, confirmed by reading get_mission_plan_v3's own SQL body (a
// deterministic if/else rules engine -- general technique guidance, not a
// live or official-record lookup) and patch.js's renderWater(): the Mission
// card only ever used ONE of the four evidence categories its own legend
// promised (a LIVE weather chip); water-profile evidence (gauges/species/
// reports/personal history) had real source_name/observed_at fields but no
// chip labeling at all.
//
// Imports the real public/evidence-provenance.js, public/patch.js, and
// public/mission-v3.js. Run with:
//   node scripts/test-p2-evidence.mjs
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
globalThis.document = {
  readyState: 'complete',
  head: stubEl(), body: stubEl(),
  getElementById: (id) => (fields[id] ||= stubEl()),
  createElement: () => stubEl(),
  querySelectorAll: () => [],
  addEventListener: (name, fn) => { (listeners[name] ||= []).push(fn); },
  dispatchEvent: (evt) => { (listeners[evt.type] || []).forEach(fn => fn(evt)); },
};
globalThis.window = globalThis;
globalThis.window.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.session = { user: { id: 'user-qa' } };
globalThis.stat = () => {};
globalThis.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// patch.js and mission-v3.js are both classic scripts that rely on a bare
// global `$` (app.js's own helper) rather than defining their own.
globalThis.$ = id => document.getElementById(id);
globalThis.panel = (name, html, empty) => `<div class="panel" data-panel="${name}">${html || `<p class="muted">${empty}</p>`}</div>`;
// app.js declares `let lastMission` at its own top-level scope (not
// imported here); mission-v3.js reads/writes the same bare global.
globalThis.lastMission = null;

await import(pathToFileURL(path.join(root, 'public/evidence-provenance.js')));
const evidence = globalThis.__fishwizzTest.evidence;

// ============================================================================
section('evidence-provenance.js: sourceLabel() never claims OFFICIAL for an unnamed source');
// ============================================================================
{
  check('a real agency source name is accepted', evidence.sourceLabel('Minnesota DNR') === 'Minnesota DNR');
  check('an empty source name is rejected', evidence.sourceLabel('') === null);
  check('a missing source name is rejected', evidence.sourceLabel(undefined) === null);
  check('a generic "Atlas" self-reference is rejected (that is Atlas\'s own inference, not an outside source)', evidence.sourceLabel('Atlas') === null);
  check('"Unknown" is rejected', evidence.sourceLabel('Unknown') === null);
  const html = evidence.chip('official', 'OFFICIAL — Minnesota DNR');
  check('chip() renders the official class', html.includes('class="source-chip official"'));
  check('chip() escapes its label', evidence.chip('live', '<script>').includes('&lt;script&gt;'));
}

// ============================================================================
section('patch.js renderWater(): every evidence card is labeled by what it actually is');
// ============================================================================
{
  fields.waterProfile = stubEl();
  fields.waterPanels = stubEl({ querySelector: () => stubEl() });
  globalThis.api = async () => ({});
  globalThis.selectedWater = null;
  globalThis.showPage = () => {};
  await import(pathToFileURL(path.join(root, 'public/patch.js')));

  const profile = {
    water: { name: 'Lake Minnetonka', state_code: 'MN', water_type: 'lake', source_label: 'Atlas catalog' },
    evidence: { confidence: 'moderate', species_count: 1, access_count: 0, gauge_count: 1, report_count: 1 },
    gauges: [{ site_name: 'USGS 05288500', parameters: [{ parameter_name: 'Gage height', value: 4.2, unit: 'ft', observed_at: '2026-08-27T12:00:00Z' }] }],
    species: [
      { species_name: 'Walleye', confidence: 0.8, source_name: 'Minnesota DNR' },
      { species_name: 'Bass', confidence: 0.4, source_name: '' }, // no real source
    ],
    reports: [{ title: 'Fall walleye bite report', summary: 'Active bite reported.', source_name: 'Minnesota DNR', age_hours: 6, confidence_score: 0.7 }],
    personal_spots: [{ name: 'My dock spot', notes: 'Good at dusk' }],
    personal_catches: [],
  };
  window.renderWater(profile);
  const html = fields.waterProfile.innerHTML;

  check('a real gauge reading is labeled LIVE', /source-chip live">LIVE — agency gauge reading/.test(html));
  check('a species record with a real named source is labeled OFFICIAL, naming the source', /source-chip official">OFFICIAL — Minnesota DNR/.test(html));
  check('a species record with NO named source is labeled ESTIMATED, never OFFICIAL by default', (() => {
    // the Bass entry (empty source_name) must get ESTIMATED, not OFFICIAL
    const bassIdx = html.indexOf('Bass');
    const before = html.slice(Math.max(0, bassIdx - 400), bassIdx);
    return /source-chip estimated">ESTIMATED — no named source/.test(before);
  })());
  check('a report with a real named source is labeled OFFICIAL', /source-chip official">OFFICIAL — Minnesota DNR[\s\S]*Fall walleye bite report/.test(html));
  check('the account\'s own saved spot is labeled PERSONAL', /source-chip personal">PERSONAL — your own record/.test(html));
}

// ============================================================================
section('mission-v3.js: the Mission card labels its own rules-engine guidance as such');
// ============================================================================
{
  fields.planSummary = stubEl();
  fields.planCards = stubEl();
  fields.feedbackBox = stubEl();
  fields.mWater = stubEl({ value: 'Lake Minnetonka' });
  fields.mTarget = stubEl({ value: 'Walleye' });
  fields.mSeason = stubEl({ value: 'Summer' });
  fields.mClarity = stubEl({ value: 'Stained' });
  fields.mWind = stubEl({ value: 'Low' });
  fields.mLight = stubEl({ value: 'Low' });
  fields.mAccess = stubEl({ value: 'Shore' });
  fields.mCover = stubEl({ value: 'Mixed' });
  fields.mCurrent = stubEl({ value: 'None' });
  fields.mDepth = stubEl({ value: 'Shallow' });
  fields.mSky = stubEl({ value: 'Clear' });
  fields.mPrecip = stubEl({ value: 'None' });
  fields.mPressure = stubEl({ value: 'Steady' });
  fields.mWaterTemp = stubEl({ value: 'Unknown' });
  fields.mLevel = stubEl({ value: 'Stable' });
  fields.mActivity = stubEl({ value: 'Unknown' });
  fields.mWaterType = stubEl({ value: 'Lake' });
  fields.coach = stubEl();
  globalThis.selectedWater = null;
  globalThis.missionCoords = undefined; // module defines its own
  globalThis.session = { user: { id: 'user-qa' } };
  const RAW = {
    start_zone: 'Start around points, vegetation edges, docks, wood, rock, or an inlet, then work outward.',
    adjustment_plan: 'Change one variable at a time.',
    confidence: 68, data_note: 'General guidance.',
    primary: { combo: 'Medium spinning setup', lure: 'Jig', why: 'why', how: 'how' },
    backup: null, finesse: null,
  };
  globalThis.api = async (p) => (p.includes('get_mission_plan_v3') ? RAW : {});
  globalThis.window.FishWizzMissionInventory = { load: async () => ({ combos: [], lures: [] }), fit: (rec) => rec };
  await import(pathToFileURL(path.join(root, 'public/mission-v3.js')));
  const build = globalThis.__fishwizzTest?.missionV3?.buildPlan;
  check('mission-v3.js exposes buildPlan() for direct testing', typeof build === 'function');
  if (build) {
    let lastStat = null;
    globalThis.stat = (msg, kind) => { lastStat = { msg, kind }; };
    await build();
    check('buildPlan() completes without an internal error (backup/finesse are null in this fixture -- card() must tolerate that)', lastStat?.kind !== 'err');
    const html = fields.planSummary.innerHTML;
    check('the plan is explicitly labeled ESTIMATED -- general technique guidance', /source-chip estimated">ESTIMATED — general technique guidance/.test(html));
    check('it explains this is not a location-verified or live-agency reading', /not a location-verified or live-agency reading/.test(html));
    check('with no exact position set, the card explicitly says the plan is generic\/non-spatial', /No exact fishing position was set.*general guidance/.test(html));
  }
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
