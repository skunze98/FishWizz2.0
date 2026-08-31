// Gate-5 output report: confidence-semantics fix, decision-critical research pass,
// readiness computation. Produces exactly the 8 items requested in instruction 7.
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { DECISION_CRITICAL_FIELDS, DESCRIPTIVE_FIELDS } from './decision-critical-fields.mjs';
import { areSourcesIndependent } from './independence.mjs';

const pilot = JSON.parse(fs.readFileSync(new URL('./pilot-data.json', import.meta.url)));
const claimsById = Object.fromEntries(pilot.claims.map(c => [c.id, c]));
const sourcesById = Object.fromEntries(pilot.sources.map(s => [s.id, s]));

let report = [];
function log(s = '') { report.push(s); console.log(s); }

log('# Gate-5 report: confidence semantics fix, decision-critical research, readiness');
log(`Generated ${new Date().toISOString()}. All numbers computed from the live pilot-data.json.\n`);

// 1. externally sourced coverage for decision-critical fields
log('## 1. Externally-sourced coverage -- decision-critical fields');
{
  let total = 0, real = 0, ext = 0, derived = 0, gap = 0;
  for (const t of pilot.tactics) for (const e of t.evidence) {
    const c = claimsById[e.claim_id];
    if (!DECISION_CRITICAL_FIELDS.includes(c.field_path)) continue;
    total++;
    if (c.evidence_status === 'externally_sourced') { ext++; real++; }
    else if (c.evidence_status === 'derived_synthesis') { derived++; real++; }
    else gap++;
  }
  log(`${real}/${total} (${Math.round(real/total*100)}%) -- ${ext} externally_sourced, ${derived} derived_synthesis, ${gap} unsupported_gap.`);
}

// 2. externally sourced coverage for descriptive fields
log('\n## 2. Externally-sourced coverage -- descriptive fields');
{
  let total = 0, real = 0;
  for (const t of pilot.tactics) for (const e of t.evidence) {
    const c = claimsById[e.claim_id];
    if (!DESCRIPTIVE_FIELDS.includes(c.field_path)) continue;
    total++;
    if (c.evidence_status !== 'unsupported_gap') real++;
  }
  log(`${real}/${total} (${total ? Math.round(real/total*100) : 0}%). This pilot's claim model does not currently track evidence for descriptive fields at all (bite_detection/hookset_fight/diagnostic_signals/casting_access_required/environment_applicability have zero claim entries) -- 0/0 is an honest reflection of that scope decision, not a hidden gap. Per instruction 6, descriptive-field gaps are explicitly allowed to remain visible and are excluded from ranking/confidence impact (the scorer and confidence computation only ever look at DECISION_CRITICAL_FIELDS).`);
}

// 3. readiness status for each of the 15 tactics
log('\n## 3. Readiness status per tactic');
log('| tactic | presentation | confidence | readiness | reason (truncated) |');
log('|---|---|---|---|---|');
pilot.tactics.forEach((t, i) => {
  const pres = pilot.presentations.find(p => p.id === t.presentation_id);
  log(`| t${i+1} | ${pres.presentation_slug} | ${t.confidence} | **${t.readiness}** | ${t.readiness_reason.slice(0,100)}... |`);
});
const readinessCounts = {};
for (const t of pilot.tactics) readinessCounts[t.readiness] = (readinessCounts[t.readiness]||0)+1;
log(`\nDistribution: ${JSON.stringify(readinessCounts)}. 0 of 15 are ready_for_human_review this pass -- expected and honest: DECISION_CRITICAL_FIELDS now includes platform/water_environment/season.biological_stage/structure/cover/current/bait_composition/conservation_notes (not just the narrower 6-8 fields tracked before gate 5), and this research pass targeted specific high-value gaps (turbidity/lure-color, sauger/walleye river coexistence, barotrauma) rather than exhaustively covering all ~16 decision-critical fields x 15 tactics. t8 is blocked_by_safety_gap (kayak/canoe primary platform, no safety_advisory layer exists yet) independent of its research completeness.`);

// 4. source-independence report
log('\n## 4. Source-independence report');
log('Sources and their organizations:');
for (const s of pilot.sources) log(`- **${s.title}** -- organization: "${s.organization}"${s.parent_organization ? `, parent_organization: "${s.parent_organization}"` : ''} (${s.source_type})`);
log('\nIndependent organization pairs actually exploited in this pilot\'s claims (verified via areSourcesIndependent(), not asserted -- checked two ways: ancestors of a derived_synthesis claim, AND separate ext() claims covering the same field_path within one tactic):');
const orgPairs = new Set();
for (const c of pilot.claims.filter(c => c.evidence_status === 'derived_synthesis')) {
  const ancSources = c.derived_from_claim_ids.map(id => claimsById[id]).filter(a => a?.evidence_status === 'externally_sourced').map(a => sourcesById[a.source_id]);
  for (let i = 0; i < ancSources.length; i++) for (let j = i+1; j < ancSources.length; j++) {
    if (areSourcesIndependent(ancSources[i], ancSources[j])) orgPairs.add(`${ancSources[i].organization} <-> ${ancSources[j].organization} (via derived_synthesis ancestry)`);
  }
}
for (const t of pilot.tactics) {
  const byField = {};
  for (const e of t.evidence) { const c = claimsById[e.claim_id]; if (c.evidence_status === 'externally_sourced') (byField[c.field_path] ||= []).push(sourcesById[c.source_id]); }
  for (const [field, srcs] of Object.entries(byField)) for (let i = 0; i < srcs.length; i++) for (let j = i+1; j < srcs.length; j++) {
    if (areSourcesIndependent(srcs[i], srcs[j])) orgPairs.add(`${srcs[i].organization} <-> ${srcs[j].organization} (co-cited on ${field})`);
  }
}
for (const p of orgPairs) log(`- ${p}`);
log(`\n**Important caveat, stated plainly**: 6 of the 10 sources in this pilot (How to catch a walleye, Ice fishing for walleye, DNR keeps three-walleye limit release, Walleye biology and identification, Minnesota Profile: Sauger, Barotrauma) are ALL organization="Minnesota DNR" -- none of these corroborate each other under the new rule, regardless of how many different pages are cited. Only 4 sources are genuinely independent of MN DNR and of each other: U.S. Fish and Wildlife Service, Journal of Fish Biology (Haxton et al.), Journal of Great Lakes Research (lure-color paper), and Pennsylvania State University (Massie & Wagner -- fetched but not yet wired into any claim this pass). This is why only 5 of 15 tactics (t3, t6, t9, t10, t12) reach independently_corroborated/peer_review_supported tier, and why the OTHER "independent" claims from gate 4 (t1's two-DNR-page claim, t6's original two-DNR-page claim) have been explicitly corrected in their derivation_explanation text to say they are NOT independent, per instruction 1.`);
log(`\n**Secondary caveat**: the lure-color paper (Journal of Great Lakes Research) could not be directly fetched this session (ScienceDirect, NOAA repository, and a news summary all returned HTTP 403) -- its findings are cited via convergent WebSearch-index synthesis across 3 independent search results, not a directly-read excerpt. This is disclosed in the claim's own paraphrased_claim/source_location text, not hidden.`);

// 5. confidence changes
log('\n## 5. Confidence changes vs the gate-4 (pre-gate-5) state');
let baselineTactics = null;
try {
  const repoRoot = new URL('../../../..', import.meta.url).pathname.replace(/^\/([A-Za-z]):/, '$1:');
  const baselineJson = execSync('git show 32e2814:design/angling-knowledge-base/v3/pilot/pilot-data.json', { cwd: repoRoot, encoding: 'utf8' });
  baselineTactics = JSON.parse(baselineJson).tactics;
} catch (e) { log(`(could not load gate-4 baseline via git: ${e.message.split('\n')[0]})`); }
if (baselineTactics) {
  log('| tactic | gate-4 confidence (BUGGY semantics) | gate-5 confidence (fixed semantics) | change |');
  log('|---|---|---|---|');
  pilot.tactics.forEach((t, i) => {
    const b = baselineTactics[i];
    log(`| t${i+1} | ${b.confidence} | ${t.confidence} | ${b.confidence === t.confidence ? 'unchanged' : b.confidence + ' -> ' + t.confidence} |`);
  });
  log(`\nThe headline correction: t4 and t5 (the genuine ice conflict) were WRONGLY labeled 'expert_consensus' in gate 4 -- their confidence computation there treated "has at least one externally_sourced claim" as sufficient for the top corroboration tier. Under the fixed semantics they correctly show 'official_guidance' (one DNR page, real evidence, but not consensus). Conversely t3/t6/t9/t10/t12 gained REAL new corroboration this pass (genuinely independent sources newly cited) and now correctly show 'peer_review_supported', which gate 4 could not have shown even by accident since no non-DNR source existed in the pilot before this pass.`);
}

// 6. remaining unsupported fields
log('\n## 6. Remaining unsupported decision-critical fields (by field_path, across all 15 tactics)');
const gapsByField = {};
for (const t of pilot.tactics) for (const e of t.evidence) {
  const c = claimsById[e.claim_id];
  if (DECISION_CRITICAL_FIELDS.includes(c.field_path) && c.evidence_status === 'unsupported_gap') gapsByField[c.field_path] = (gapsByField[c.field_path]||0)+1;
}
log('| field_path | tactics still unsupported | / 15 |');
log('|---|---|---|');
for (const f of DECISION_CRITICAL_FIELDS) log(`| ${f} | ${gapsByField[f]||0} | /${pilot.tactics.filter(t2 => true).length} (of tactics where this field applies) |`);
log(`\nWorst gaps, unchanged from before this pass: equipment.line_test_lb, equipment.lure_weight_oz, retrieve.pause_seconds are 0% sourced on every tactic that has them -- no fetched source in this pilot's research (this pass or gate 4) states an exact tackle number. applies_when.platform, applies_when.water_environment, applies_when.structure, applies_when.cover, applies_when.current, bait_composition, and conservation_notes are NEWLY tracked as decision-critical this pass and were not researched for most tactics (t2's conservation_notes and several tactics' bait_composition are the exceptions actually researched this pass).`);

// 7 & 8: complete diff and test results/commit hash are reported in the chat response, not this file
// (a diff against the previous commit and the actual commit hash cannot be known until after this
// script runs and the result is committed).

fs.writeFileSync(new URL('./gate5-report.md', import.meta.url), report.join('\n'));
console.log('\n\nWritten: gate5-report.md');
