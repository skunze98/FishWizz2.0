#!/usr/bin/env node
// Regression test for the client-side approved-research integration modules:
// public/approved-research-flag.js, public/species-taxonomy-map.js,
// public/approved-research-evidence-badge.js, public/approved-research-bridge.js.
//
// Same stub-DOM pattern as the existing scripts/test-p2-taxonomy.mjs: imports the REAL public/
// files (not a reimplementation), stubs just enough of `document`/`window` for classic scripts
// written against a browser global to run under plain Node.
//
// Covers (see the standing integration instruction's test list): feature-flag disabled/enabled
// behavior; taxonomy mapping including the documented false-positive rejections; gear-aware
// (structured rod/line/lure) filtering; source/reasoning traceability; deferred-gap / missing-
// data / RPC-failure safe behavior; diagnostics carrying no user data; output escaping.
//
// Run with:
//   node scripts/test-approved-research-client.mjs
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
    id: '', value: '', hidden: false, textContent: '', innerHTML: '', dataset: {}, className: '',
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
let createdSectionHtml = null;
globalThis.document = {
  readyState: 'complete',
  head: stubEl(), body: stubEl(),
  getElementById: (id) => fields[id] ?? null,
  createElement: () => {
    const el = stubEl();
    Object.defineProperty(el, 'innerHTML', {
      get() { return this._html || ''; },
      set(v) { this._html = v; createdSectionHtml = v; },
    });
    return el;
  },
  querySelectorAll: () => [],
  addEventListener: (name, fn) => { (listeners[name] ||= []).push(fn); },
  dispatchEvent: (evt) => { (listeners[evt.type] || []).forEach(fn => fn(evt)); },
};
globalThis.window = globalThis;
globalThis.window.addEventListener = () => {};

// A real, in-memory localStorage stand-in (not just no-ops) so flag persistence is actually
// exercised, not merely assumed to work.
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};
globalThis.session = { user: { id: 'user-qa' } };
globalThis.stat = () => {};
globalThis.MutationObserver = class { observe() {} disconnect() {} };

await import(pathToFileURL(path.join(root, 'public/approved-research-flag.js')));
await import(pathToFileURL(path.join(root, 'public/species-taxonomy-map.js')));
await import(pathToFileURL(path.join(root, 'public/approved-research-evidence-badge.js')));
await import(pathToFileURL(path.join(root, 'public/tackle-taxonomy.js')));

const flag = globalThis.__fishwizzTest.approvedResearchFlag;
const taxonomy = globalThis.__fishwizzTest.approvedResearchTaxonomy;
const evidence = globalThis.__fishwizzTest.approvedResearchEvidence;

// ============================================================================
section('approved-research-flag.js: disabled by default, toggles, and dispatches a change event');
// ============================================================================
{
  check('disabled by default (no prior localStorage state)', flag.isEnabled() === false);
  let changeEvents = [];
  document.addEventListener('atlas:approved-research-flag-changed', (e) => changeEvents.push(e.detail));
  flag.enable();
  check('isEnabled() true after enable()', flag.isEnabled() === true);
  check('enable() dispatched atlas:approved-research-flag-changed {enabled:true}', changeEvents.at(-1)?.enabled === true);
  check('the flag is stored under the documented key, not entangled with auth storage', storage.has('fishwizz.approvedResearch.enabled'));
  flag.disable();
  check('isEnabled() false after disable()', flag.isEnabled() === false);
  check('disable() dispatched atlas:approved-research-flag-changed {enabled:false}', changeEvents.at(-1)?.enabled === false);
}

// ============================================================================
section('species-taxonomy-map.js: exact-match mapping, and the documented false-positive rejections');
// ============================================================================
{
  check('"Northern Pike" maps to esox-lucius', taxonomy.toSlug('Northern Pike') === 'species:esox-lucius');
  check('"Walleye" maps to sander-vitreus', taxonomy.toSlug('Walleye') === 'species:sander-vitreus');
  check('"Cisco (Tullibee)" maps to coregonus-artedi', taxonomy.toSlug('Cisco (Tullibee)') === 'species:coregonus-artedi');
  check('"Steelhead" maps to the same species as "Rainbow Trout (Steelhead)"',
    taxonomy.toSlug('Steelhead') === taxonomy.toSlug('Rainbow Trout (Steelhead)'));

  // The two real, confirmed fuzzy-match false positives from reports/COMPATIBILITY-REPORT.md --
  // an exact-match table can never produce these; a substring/fuzzy matcher would.
  check('"Northern Hog Sucker" is NOT mapped to Northern Pike (or anything)', taxonomy.toSlug('Northern Hog Sucker') === null);
  check('"Northern Redbelly Dace" is NOT mapped to Northern Pike (or anything)', taxonomy.toSlug('Northern Redbelly Dace') === null);

  // Deliberate non-mappings (real, disclosed judgment calls, not oversights).
  check('"Tiger Muskellunge" is deliberately unmapped', taxonomy.isMapped('Tiger Muskellunge') === false);
  check('"Yellow Bass" is deliberately unmapped', taxonomy.isMapped('Yellow Bass') === false);
  check('"Splake" is deliberately unmapped', taxonomy.isMapped('Splake') === false);

  check('an empty/garbage name maps to null, never guesses', taxonomy.toSlug('') === null && taxonomy.toSlug('   ') === null);
  check('whitespace is trimmed before matching', taxonomy.toSlug('  Walleye  ') === 'species:sander-vitreus');
}

// ============================================================================
section('approved-research-evidence-badge.js: confidence tiers map to the NEW badge system, never the app\'s LIVE/OFFICIAL chips');
// ============================================================================
{
  check('peer_review_supported -> "Research-verified"', evidence.badge('peer_review_supported').includes('Research-verified'));
  check('independently_corroborated -> "Research-verified"', evidence.badge('independently_corroborated').includes('Research-verified'));
  check('official_guidance -> "Research-verified" (never conflated with the app\'s own LIVE/OFFICIAL meaning)', evidence.badge('official_guidance').includes('Research-verified'));
  check('expert_synthesis -> "Research-derived"', evidence.badge('expert_synthesis').includes('Research-derived'));
  check('anecdotal -> "General guidance"', evidence.badge('anecdotal').includes('General guidance'));
  check('estimated -> "General guidance"', evidence.badge('estimated').includes('General guidance'));
  check('unsupported -> "General guidance"', evidence.badge('unsupported').includes('General guidance'));
  check('an unrecognized tier fails safe to "General guidance", never a fabricated stronger claim', evidence.badge('made_up_tier').includes('General guidance'));
  check('readinessNote() is empty for ready_for_human_review', evidence.readinessNote('ready_for_human_review', '') === '');
  check('readinessNote() explains research_incomplete rather than staying silent', /not mission-ready/.test(evidence.readinessNote('research_incomplete', 'field X unsupported')));
}

// ============================================================================
section('approved-research-bridge.js: gear-aware structured matching (rod power / line test / lure weight)');
// ============================================================================
{
  await import(pathToFileURL(path.join(root, 'public/approved-research-bridge.js')));
  const bridge = globalThis.__fishwizzTest.approvedResearchBridge;

  const tactic = { equipment: { rod_power: 'medium_light', line_test_lb: { min: 6, max: 10 }, lure_weight_oz: { min: 0.125, max: 0.375 } } };

  section('  a combo/lure inside the tactic\'s real numeric ranges matches');
  {
    const inv = {
      combos: [{ rods: { power: 'Medium-Light' }, reels: { line_test: '8' } }],
      lures: [{ category: 'jig', size_weight: '0.25', quantity: 1 }],
    };
    const fitR = bridge.gearFitForTactic(tactic, inv);
    check('a rod power substring match + in-range line test counts as a combo match', fitR.comboMatches.length === 1);
    check('an in-range lure weight counts as a lure match', fitR.lureMatches.length === 1);
    check('hasMatch is true', fitR.hasMatch === true);
  }

  section('  gear outside the tactic\'s ranges does not falsely match');
  {
    const inv = {
      combos: [{ rods: { power: 'Heavy' }, reels: { line_test: '30' } }],
      lures: [{ category: 'jig', size_weight: '2.5', quantity: 1 }],
    };
    const fitR = bridge.gearFitForTactic(tactic, inv);
    check('an out-of-range line test does not match', fitR.comboMatches.length === 0);
    check('an out-of-range lure weight does not match', fitR.lureMatches.length === 0);
    check('hasMatch is false', fitR.hasMatch === false);
  }

  section('  a hook/terminal-tackle item never counts as a lure match, even at the right weight (reuses tackle-taxonomy.js)');
  {
    const inv = { combos: [], lures: [{ category: 'hook / terminal tackle', size_weight: '0.25', quantity: 1 }] };
    const fitR = bridge.gearFitForTactic(tactic, inv);
    check('a terminal-tackle item is excluded from lure matches', fitR.lureMatches.length === 0);
  }

  section('  a zero-quantity lure is never counted as owned gear');
  {
    const inv = { combos: [], lures: [{ category: 'jig', size_weight: '0.25', quantity: 0 }] };
    const fitR = bridge.gearFitForTactic(tactic, inv);
    check('a quantity-0 item does not count as a match', fitR.lureMatches.length === 0);
  }

  // ============================================================================
  section('approved-research-bridge.js: tacticCard()/regulationCard() safe rendering + output escaping');
  // ============================================================================
  section('  a tactic with no attached sources is explicitly disclosed, never silently blank');
  {
    const html = bridge.tacticCard({ presentation_label: 'Test', confidence: 'estimated', readiness: 'ready_for_human_review', sources: [] }, { combos: [], lures: [] });
    check('states "No source records attached"', /No source records attached/.test(html));
    check('never fabricates a fake source entry', !/href="undefined"/.test(html));
  }
  section('  a tactic with no owned-gear match is explicitly disclosed, never silently blank');
  {
    const html = bridge.tacticCard({ presentation_label: 'Test', confidence: 'estimated', readiness: 'ready_for_human_review', equipment: { rod_power: 'heavy' }, sources: [] }, { combos: [], lures: [] });
    check('states no owned gear matched', /No owned gear matched/.test(html));
  }
  section('  research-incomplete readiness surfaces the reason, not just a bare status flag');
  {
    const html = bridge.tacticCard({ presentation_label: 'Test', confidence: 'estimated', readiness: 'research_incomplete', readiness_reason: 'the exact QA reason string', sources: [] }, { combos: [], lures: [] });
    check('the specific readiness_reason text is shown', /the exact QA reason string/.test(html));
    check('states the tactic is not mission-ready', /not mission-ready/.test(html));
  }
  section('  research-source and regulation text is HTML-escaped (prevents injected markup from a data field)');
  {
    const html = bridge.tacticCard({
      presentation_label: '<img src=x onerror=alert(1)>',
      confidence: 'estimated', readiness: 'ready_for_human_review',
      sources: [{ organization: '<b>Org</b>', title: 'T', url: 'https://example.org', access_date: '2026-01-01' }],
    }, { combos: [], lures: [] });
    check('a hostile presentation_label is escaped, not injected as live markup', !/<img/.test(html) && /&lt;img/.test(html));
    check('a hostile source organization string is escaped', !/<b>Org<\/b>/.test(html) && /&lt;b&gt;/.test(html));
  }
  section('  a regulation card discloses it is a research snapshot, not a live regulations lookup');
  {
    const html = bridge.regulationCard({ provision_type: 'size_rule', official_wording: 'Min 16in', status: 'current', sources: [], geographic_scope: {} });
    check('explicitly tells the user to verify current rules independently', /not a live regulations lookup/.test(html) && /Verify current/.test(html));
  }

  // ============================================================================
  section('approved-research-bridge.js: run() -- feature-flag gating, empty/failure states, diagnostics never carry user data');
  // ============================================================================
  section('  flag disabled: run() is a complete no-op (no RPC call, no render)');
  {
    flag.disable();
    let apiCalled = false;
    globalThis.api = async () => { apiCalled = true; return {}; };
    await bridge.run({ context: { target: 'Walleye' } });
    check('window.api was never called while the flag is disabled', apiCalled === false);
  }
  section('  flag enabled, RPC returns unavailable: a calm disclosed empty state, not a blank card');
  {
    flag.enable();
    globalThis.api = async () => ({ available: false, data_note: 'No approved research species record matches this target.' });
    await bridge.run({ context: { target: 'Splake', water_type: 'lake' } });
    check('renderSection produced the disclosed no-match note', /No approved research species record matches this target/.test(createdSectionHtml || ''));
  }
  section('  flag enabled, RPC throws: degrades gracefully, never a raw error, never fabricated data');
  {
    globalThis.api = async () => { throw new Error('simulated network failure'); };
    createdSectionHtml = null;
    await bridge.run({ context: { target: 'Walleye', water_type: 'lake' } });
    check('shows a calm unavailable message', /temporarily unavailable/.test(createdSectionHtml || ''));
    check('never leaks the raw error message to the user-facing card', !/simulated network failure/.test(createdSectionHtml || ''));
    check('states the existing Mission is unaffected', /Mission above is unaffected/.test(createdSectionHtml || ''));
  }
  section('  flag enabled, RPC succeeds with real tactics: the required label is always shown');
  {
    globalThis.api = async () => ({
      available: true, matched_common_name: 'Walleye', tactic_count: 1, regulation_count: 0,
      tactics: [{ presentation_label: 'Jig and minnow', confidence: 'official_guidance', readiness: 'ready_for_human_review', sources: [] }],
      regulations: [], data_note: 'Approved research, draft status.',
    });
    createdSectionHtml = null;
    await bridge.run({ context: { target: 'Walleye', water_type: 'lake' } });
    check('the exact required awaiting-review label is present verbatim', createdSectionHtml?.includes(bridge.LABEL));
    check('LABEL text matches the standing instruction\'s required wording verbatim',
      bridge.LABEL === 'Professionally approved research integrated in isolation — awaiting application-team review, controlled production integration, mission-ready authorization, and authenticated QA.');
  }
  section('  a mission with no target set is a no-op (never queries with an empty/undefined species)');
  {
    let apiCalled = false;
    globalThis.api = async () => { apiCalled = true; return {}; };
    await bridge.run({ context: { water_type: 'lake' } });
    check('window.api was never called with no context.target', apiCalled === false);
  }
  section('  diagnostics expose only IDs/counts/booleans -- never location, water name, or user identity');
  {
    globalThis.api = async () => ({ available: true, matched_common_name: 'Walleye', tactic_count: 0, regulation_count: 0, tactics: [], regulations: [] });
    await bridge.run({ context: { target: 'Walleye', water_type: 'lake', location: 'SECRET_LAKE_NAME_MUST_NOT_LEAK' } });
    const stages = globalThis.FishWizzApprovedResearchDiagnostics.getStages();
    const serialized = JSON.stringify(stages);
    check('at least one diagnostic stage was recorded', stages.length > 0);
    check('no diagnostic stage ever contains the water/location name', !serialized.includes('SECRET_LAKE_NAME_MUST_NOT_LEAK'));
    check('no diagnostic stage ever contains a session/user id field', !/user-qa/.test(serialized));
  }
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
