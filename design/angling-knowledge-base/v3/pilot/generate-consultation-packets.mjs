// gate-7: expert-consultation packets. Reads the REAL pilot-data.json (unmodified) and produces
// one review sheet per tactic, computed -- not hand-summarized -- so nothing drifts from the
// actual record. Does NOT touch pilot-data.json, schemas, or migration.sql. Does NOT answer any
// of the questions it raises.
import fs from 'node:fs';
import { EVIDENCE_OBLIGATION, EXTERNAL_EVIDENCE_REQUIRED_FIELDS, TRACEABLE_DERIVATION_FIELDS, INTRINSIC_FIELDS, requiredDecisionCriticalFields, checkIntrinsicConsistency } from './decision-critical-fields.mjs';
import { validateNextTry } from './next-try-validation.mjs';
import { rankTactics } from './scorer.mjs';
import { scenarios } from './run-scenarios.mjs';

const pilot = JSON.parse(fs.readFileSync(new URL('./pilot-data.json', import.meta.url)));
const claimsById = Object.fromEntries(pilot.claims.map(c => [c.id, c]));
const sourcesById = Object.fromEntries(pilot.sources.map(s => [s.id, s]));
const speciesById = Object.fromEntries(pilot.species.map(s => [s.id, s]));
const presentationsById = Object.fromEntries(pilot.presentations.map(p => [p.id, p]));
const tacticsById = Object.fromEntries(pilot.tactics.map(t => [t.id, t]));

function fieldsByStatus(t) {
  const requiredNow = requiredDecisionCriticalFields(t);
  const evByField = {};
  for (const e of t.evidence) (evByField[e.covers_field_path] ||= []).push(claimsById[e.claim_id]);
  const ext = [], derived = [], unsupported = [];
  for (const f of requiredNow) {
    const entries = evByField[f] || [];
    const realEntry = entries.find(c => c.evidence_status === 'externally_sourced');
    const derivedEntry = entries.find(c => c.evidence_status === 'derived_synthesis');
    if (realEntry) ext.push({ field: f, claim: realEntry });
    else if (derivedEntry) derived.push({ field: f, claim: derivedEntry });
    else unsupported.push(f);
  }
  return { ext, derived, unsupported };
}

function questionsFor(t, unsupported, presSlug) {
  const qs = [];
  const fieldQuestion = {
    'applies_when.water_environment': 'Is the stated water-environment set (lake vs. river vs. tributary) actually where you\'d expect this to work, in your MN/WI experience?',
    'applies_when.season.biological_stage': 'Does the stated biological stage match when you\'d actually use this on the water, or does it run earlier/later/differently than stated?',
    'applies_when.season.water_temp_f': `Is the stated water-temperature range (${t.applies_when.season.water_temp_f.state==='constrained'?t.applies_when.season.water_temp_f.value.min+'-'+t.applies_when.season.water_temp_f.value.max+'F':'n/a'}) realistic, or would you narrow/widen/shift it?`,
    'applies_when.depth_ft': `Is the stated depth range (${t.applies_when.depth_ft.state==='constrained'?t.applies_when.depth_ft.value.min+'-'+t.applies_when.depth_ft.value.max+'ft':'n/a'}) realistic for this presentation/season on typical MN/WI water, or should it change?`,
    'applies_when.structure': 'Is the stated structure set the right one, or is a different structure type more reliable for this pattern?',
    'applies_when.cover': 'Is the stated cover accurate, or does something else (that this record misses) matter more?',
    'applies_when.current': 'Is the stated current level accurate for where this tactic is actually fished?',
    'works_when': 'Does the stated works_when reasoning hold up on the water, or is something missing/wrong?',
    'fails_when': 'What actually causes this tactic to fail in your experience -- does the stated fails_when match, or is there a different, more common failure mode?',
    'conservation_notes': 'Is there a real conservation/handling consideration for this species/depth/season combination that this record is missing?',
    'applies_when.platform': 'Is the derived platform list (from access logic, not direct research) actually correct on the water?',
    'equipment.line_test_lb': 'Is the derived line-test range realistic for this specific presentation, species, and conditions -- not just the generic rod-power chart?',
    'equipment.lure_weight_oz': 'Is the derived lure-weight range realistic in practice, or does real fishing call for something outside the generic chart range?',
    'retrieve.pause_seconds': 'What pause/cadence would you actually use here? A qualitative description (e.g. "brief, a beat or two" vs. "long, count to ten-plus") is preferred over an invented exact number.',
    'casting_access_required': 'Is the derived casting-access rating (open/limited/tight) accurate for this platform/structure in practice?',
  };
  for (const f of unsupported) if (fieldQuestion[f]) qs.push(`[${f}] ${fieldQuestion[f]}`);
  qs.push(`[overall] Is the "${presSlug}" presentation, as fully specified here, something you'd actually recommend under these conditions -- or is it technically sourced/derived but impractical/awkward on the water?`);
  return qs;
}

function scenarioResultsFor(tacticId) {
  const hits = [];
  for (const scenario of scenarios) {
    const { ranked, cautions } = rankTactics(pilot.tactics, scenario);
    const rank = ranked.findIndex(r => r.tactic.id === tacticId);
    if (rank !== -1) hits.push({ scenario: scenario.name, rank: rank + 1, score: ranked[rank].finalScore.toFixed(3), of: ranked.length });
    const caution = cautions.find(c => c.tactic.id === tacticId);
    if (caution) hits.push({ scenario: scenario.name, rank: 'CAUTION', score: 'insufficient_safety_data', of: null });
  }
  return hits;
}

let report = [];
function log(s = '') { report.push(s); }

log('# FishWizz Walleye/Sauger Pilot -- Expert Consultation Packets');
log(`Generated ${new Date().toISOString()} from the real, unmodified pilot-data.json (commit a114e97). Every field below is computed from the live record, not hand-summarized -- nothing here has been softened or reordered to bury unsupported material. Sourced and unsourced content for each tactic sit side by side, not separated into a "good news" and "fine print" section.\n`);
log('**Every tactic in this pilot is still `record_status: draft` and every claim is `reviewer_status: unreviewed`.** Nothing here is published or approved. Expert input recorded against this packet is practitioner testimony, captured per `expert-consultation-workflow.md`, not automatic approval -- see that document for the full workflow-state model.\n');
log('---\n');

pilot.tactics.forEach((t, i) => {
  const pres = presentationsById[t.presentation_id];
  const { ext, derived, unsupported } = fieldsByStatus(t);
  const speciesNames = t.species.map(s => `${speciesById[s.species_id].common_name_primary}${s.is_primary_species ? ' (primary)' : ''}`);
  const aw = t.applies_when;
  const fmtCon = (c, unit = '') => c.state !== 'constrained' ? `(${c.state})` : Array.isArray(c.value) ? c.value.join(', ') : typeof c.value === 'object' && c.value.min !== undefined ? `${c.value.min}-${c.value.max}${unit} (${c.value.precision})` : c.value;

  log(`## t${i + 1} -- ${pres.label} (${pres.presentation_slug})`);
  log(`**Tactic ID:** \`${t.id}\`  |  **Presentation ID:** \`${t.presentation_id}\`  |  **Confidence:** \`${t.confidence}\`  |  **Readiness:** \`${t.readiness}\``);
  log(`**Target species:** ${speciesNames.join(', ')}`);
  log(`**Platform:** ${fmtCon(aw.platform)}  |  **Water environment:** ${fmtCon(aw.water_environment)}  |  **Environment applicability:** ${JSON.stringify(t.environment_applicability)}`);
  log(`**Seasonal stage:** ${fmtCon(aw.season.biological_stage)}  |  **Calendar range:** ${aw.season.calendar_range.state === 'constrained' ? `${aw.season.calendar_range.value.start_month_day} to ${aw.season.calendar_range.value.end_month_day}` : `(${aw.season.calendar_range.state})`}  |  **Water temp:** ${fmtCon(aw.season.water_temp_f, 'F')}`);
  log(`**Depth:** ${fmtCon(aw.depth_ft, 'ft')}  |  **Structure:** ${fmtCon(aw.structure)}  |  **Cover:** ${fmtCon(aw.cover)}  |  **Current:** ${fmtCon(aw.current)}  |  **Clarity:** ${fmtCon(aw.clarity)}`);
  log(``);
  log(`**Bait composition:** ${t.bait_composition.mode} (${t.bait_composition.components.join(', ')})  |  **Methods:** ${t.presentation_method_tags.join(', ')}`);
  log(`**Equipment:** ${t.equipment.rod_power} power, ${t.equipment.rod_action} action, ${t.equipment.reel_type} reel, line ${t.equipment.line_test_lb.min}-${t.equipment.line_test_lb.max}lb (${t.equipment.line_test_lb.precision}), lure ${t.equipment.lure_weight_oz.min}-${t.equipment.lure_weight_oz.max}oz (${t.equipment.lure_weight_oz.precision})${t.equipment.leader ? `, leader: ${t.equipment.leader.material} ${t.equipment.leader.length_in.min}-${t.equipment.leader.length_in.max}in` : ', no leader'}${t.equipment.hook_size ? `, hook: ${t.equipment.hook_size}` : ''}`);
  log(`**Retrieve:** ${t.retrieve.speed}, "${t.retrieve.cadence}", pause ${t.retrieve.pause_seconds.min}-${t.retrieve.pause_seconds.max}s (${t.retrieve.pause_seconds.precision}), depth control: ${t.retrieve.depth_control}`);
  log(`**Rigging:** ${t.rigging_instructions}`);
  log(`**Casting access required:** ${t.casting_access_required ?? 'not specified'}`);
  log(``);
  log(`**Works when:** ${t.works_when}`);
  log(`**Fails when:** ${t.fails_when}`);
  log(`**Diagnostic signals:** ${t.diagnostic_signals}`);
  log(`**Bite detection:** ${t.bite_detection}  |  **Hookset/fight:** ${t.hookset_fight}`);
  log(`**Conservation notes:** ${t.conservation_notes ?? '(none recorded)'}`);
  log(``);
  log(`**Alternatives/next_try:**`);
  if (t.alternatives.length === 0) log(`- NONE recorded -- see relationship-graph.md for gap status.`);
  for (const a of t.alternatives) {
    const target = tacticsById[a.related_tactic_id];
    const targetPres = presentationsById[target.presentation_id];
    log(`- **${a.relationship_type}** -> t${pilot.tactics.indexOf(target) + 1} (${targetPres.presentation_slug}): ${a.note}`);
    if (a.relationship_type === 'next_try') {
      const v = validateNextTry(t, target, a, pres, targetPres);
      log(`  - Real validation: **${v.pass ? 'PASS' : 'FAIL'}** all ${Object.keys(v.checks).length} criteria: ${JSON.stringify(v.checks)}`);
    }
  }
  log(``);
  log(`**Externally supported fields (${ext.length}):**`);
  for (const { field, claim } of ext) log(`- \`${field}\`: [${claim.evidence_type}] ${sourcesById[claim.source_id].title} -- "${claim.paraphrased_claim.slice(0, 160)}${claim.paraphrased_claim.length > 160 ? '...' : ''}"`);
  log(``);
  log(`**Derived fields, with derivation shown (${derived.length}):**`);
  for (const { field, claim } of derived) log(`- \`${field}\`: ${claim.derivation_explanation}`);
  log(``);
  log(`**REMAINING UNSUPPORTED FIELDS (${unsupported.length}) -- not buried, listed first-class:**`);
  if (unsupported.length === 0) log(`- None -- all A/B obligations covered (readiness may still be blocked by intrinsic/exact-value/next_try/safety checks; see Readiness above).`);
  for (const f of unsupported) log(`- \`${f}\` [obligation ${EVIDENCE_OBLIGATION[f]}]`);
  log(``);
  log(`**Questions requiring expert judgment:**`);
  for (const q of questionsFor(t, unsupported, pres.presentation_slug)) log(`- ${q}`);
  log(``);
  const hits = scenarioResultsFor(t.id);
  log(`**Relevant scenario results (${hits.length} of 15 scenarios where this tactic was ranked or cautioned):**`);
  if (hits.length === 0) log(`- Did not survive hard filters or rank in any of the 15 test scenarios.`);
  for (const h of hits) log(`- "${h.scenario}": ${h.rank === 'CAUTION' ? 'CAUTION -- insufficient_safety_data (not ranked)' : `ranked #${h.rank} of ${h.of}, score ${h.score}`}`);
  log(`\n---\n`);
});

fs.writeFileSync(new URL('./consultation-packets.md', import.meta.url), report.join('\n'));
console.log(`Written consultation-packets.md (${report.length} lines) for ${pilot.tactics.length} tactics.`);
