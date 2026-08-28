#!/usr/bin/env node
// Regression test for P2 "Enforce recommendation taxonomy compatibility"
// (staging QA, 2026-08-27): "recommendation 'Best owned lure substitute: QA
// test Northstar QA test Circle Rig' where the referenced record was
// categorized 'hook / terminal tackle,' not a lure."
//
// Imports the real public/tackle-taxonomy.js, public/mentor-pro.js, and
// public/mission-inventory-fit.js. Run with:
//   node scripts/test-p2-taxonomy.mjs
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
globalThis.MutationObserver = class { observe() {} disconnect() {} };

await import(pathToFileURL(path.join(root, 'public/tackle-taxonomy.js')));
const taxonomy = globalThis.__fishwizzTest.tackleTaxonomy;

// ============================================================================
section('tackle-taxonomy.js: classification matches manual-gear-pro.js\'s real category <select> options');
// ============================================================================
{
  const cases = [
    ['hard bait / lure', 'lure', true], ['crankbait', 'lure', true], ['jerkbait', 'lure', true],
    ['topwater', 'lure', true], ['spinnerbait', 'lure', true], ['bladed jig', 'lure', true],
    ['swimbait', 'lure', true], ['spoon', 'lure', true], ['inline spinner', 'lure', true], ['jig', 'lure', true],
    ['jig head', 'jig_head', false], ['soft plastic', 'trailer', false], ['trailer', 'trailer', false],
    // the exact reported category string
    ['hook / terminal tackle', 'terminal', false],
    ['weight / sinker', 'weight', false],
    ['bobber / float', 'accessory', false], ['swivel / snap / connector', 'accessory', false],
    ['line / leader material', 'accessory', false], ['other tackle', 'accessory', false],
  ];
  for (const [category, expectKind, expectPresentable] of cases) {
    check(`"${category}" classifies as ${expectKind}`, taxonomy.classify(category) === expectKind);
    check(`"${category}" isPresentable() === ${expectPresentable}`, taxonomy.isPresentable({ category }) === expectPresentable);
  }
  check('a jig head WITH a trailer_pairing becomes presentable (a complete rig)', taxonomy.isPresentable({ category: 'jig head', trailer_pairing: 'Rage Craw' }) === true);
  check('an unrecognized/legacy category fails open (presentable), not excluded by default', taxonomy.isPresentable({ category: 'some old hand-typed value' }) === true);
  check('terminal tackle is never labeled as a lure', taxonomy.label({ category: 'hook / terminal tackle' }) === 'terminal component');
  check('a real lure is labeled a lure', taxonomy.label({ category: 'crankbait' }) === 'lure');
}

// ============================================================================
section('mentor-pro.js bestOwned()/inventoryLine(): the exact reported scenario');
// ============================================================================
{
  await import(pathToFileURL(path.join(root, 'public/mentor-pro.js')));
  const { bestOwned, inventoryLine } = globalThis.__fishwizzTest.mentorPro;

  // "QA test Northstar QA test Circle Rig" -- the exact reported item,
  // categorized as terminal tackle, not a lure -- named so it scores highly
  // on plain word overlap against a recommendation asking for the same
  // words, exactly like the real bug.
  window.lures = [{ id: 'hook-1', category: 'hook / terminal tackle', brand: 'Northstar', model: 'Circle Rig', color: 'Nickel' }];
  window.combos = [];
  const rec = { lure: 'Northstar Circle Rig', color: 'Nickel' };

  const result = bestOwned(rec);
  check('the terminal-tackle item is never selected as the matched "lure"', result.lure === null);
  const line = inventoryLine(result, rec);
  check('the rendered line never says "Owned lure" or "Best owned lure substitute" for it', !/Owned lure|Best owned lure substitute/.test(line.lure));
  check('it falls back to generic guidance instead of mislabeling the hook', line.lure.startsWith('Start with the Mission presentation'));

  section('  a genuine lure with the exact same name IS matched and labeled correctly');
  window.lures = [{ id: 'lure-1', category: 'crankbait', brand: 'Northstar', model: 'Circle Rig', color: 'Nickel' }];
  const realResult = bestOwned(rec);
  check('a real lure category is selected as the matched lure', realResult.lure?.item?.id === 'lure-1');
  const realLine = inventoryLine(realResult, rec);
  check('it is labeled as an owned lure', /Owned lure|Best owned lure substitute/.test(realLine.lure));

  section('  a jig head alone (no trailer) is never presented as a complete lure, but one WITH a trailer is');
  window.lures = [{ id: 'jh-1', category: 'jig head', brand: 'Northland', model: 'Fire-Ball', color: 'Chartreuse' }];
  const bareJigHead = bestOwned({ lure: 'Northland Fire-Ball', color: 'Chartreuse' });
  check('a bare jig head is excluded from the lure match', bareJigHead.lure === null);
  window.lures = [{ id: 'jh-2', category: 'jig head', brand: 'Northland', model: 'Fire-Ball', color: 'Chartreuse', trailer_pairing: 'Rage Craw' }];
  const dressedJigHead = bestOwned({ lure: 'Northland Fire-Ball', color: 'Chartreuse' });
  check('a jig head already paired with a trailer IS eligible (a complete rig)', dressedJigHead.lure?.item?.id === 'jh-2');
}

// ============================================================================
section('mission-inventory-fit.js bestPair(): the primary Mission card never mislabels terminal tackle either');
// ============================================================================
{
  await import(pathToFileURL(path.join(root, 'public/mission-inventory-fit.js')));
  const { fit } = globalThis.__fishwizzTest?.missionInventory || window.FishWizzMissionInventory;
  const inv = {
    combos: [],
    lures: [{ id: 'hook-1', category: 'hook / terminal tackle', brand: 'Northstar', model: 'Circle Rig', quantity: 1 }],
  };
  const rec = { primary: { lure: 'Northstar Circle Rig', why: 'Circle Rig' }, backup: null, finesse: null };
  const context = { target: 'Catfish', cover: 'Open Water', clarity: 'Stained', light: 'Low', wind: 'Low', sky: 'Clear', water_temp: 'Cool' };
  const out = window.FishWizzMissionInventory.fit(rec, context, inv);
  check('the Mission card\'s primary plan is never fitted to the terminal-tackle item as its "lure"', out.primary?.inventory_lure_id !== 'hook-1');
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
