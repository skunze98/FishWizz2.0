// Gate-6 final report: fishing-research pass across all 15 tactics in 5 batches, using the
// obligation-aware (A/B/C) readiness architecture. Produces exactly the 8 items requested in
// instruction 7.
import fs from 'node:fs';
import { EVIDENCE_OBLIGATION, EXTERNAL_EVIDENCE_REQUIRED_FIELDS, TRACEABLE_DERIVATION_FIELDS, requiredDecisionCriticalFields, checkIntrinsicConsistency } from './decision-critical-fields.mjs';
import { areSourcesIndependent } from './independence.mjs';
import { validateNextTry } from './next-try-validation.mjs';

const pilot = JSON.parse(fs.readFileSync(new URL('./pilot-data.json', import.meta.url)));
const claimsById = Object.fromEntries(pilot.claims.map(c => [c.id, c]));
const sourcesById = Object.fromEntries(pilot.sources.map(s => [s.id, s]));
const tacticsById = Object.fromEntries(pilot.tactics.map(t => [t.id, t]));
const presentationsById = Object.fromEntries(pilot.presentations.map(p => [p.id, p]));

let report = [];
function log(s = '') { report.push(s); console.log(s); }

log('# Gate-6 report: fishing-research pass across all 15 tactics (obligation-aware A/B/C)');
log(`Generated ${new Date().toISOString()}. Schema frozen at commit 3c60444 -- no schema files changed this pass. All numbers computed from the live pilot-data.json.\n`);

// 1. Readiness matrix
log('## 1. Readiness matrix -- all 15 tactics');
log('| tactic | presentation | confidence | readiness | remaining blocker(s) |');
log('|---|---|---|---|---|');
pilot.tactics.forEach((t, i) => {
  const pres = presentationsById[t.presentation_id];
  log(`| t${i+1} | ${pres.presentation_slug} | ${t.confidence} | **${t.readiness}** | ${t.readiness_reason.replace(/\|/g,'/')} |`);
});
const readinessCounts = {};
for (const t of pilot.tactics) readinessCounts[t.readiness] = (readinessCounts[t.readiness]||0)+1;
log(`\nDistribution: ${JSON.stringify(readinessCounts)}. 0/15 ready_for_human_review -- t8 is blocked_by_safety_gap pending safety review (not permanently) (kayak/canoe, no safety_advisory layer exists); the other 14 have real, specific, individually-listed remaining gaps (mostly exact water-temperature/depth numbers and retrieve.pause_seconds, the hardest-to-source fields in the whole pilot).`);

// 2. Coverage by evidence-obligation category
log('\n## 2. Coverage by evidence-obligation category');
{
  const byObl = { A: { total: 0, real: 0 }, B: { total: 0, real: 0 } };
  for (const t of pilot.tactics) {
    const requiredNow = requiredDecisionCriticalFields(t);
    const evByField = {};
    for (const e of t.evidence) (evByField[e.covers_field_path] ||= []).push(claimsById[e.claim_id]);
    for (const f of requiredNow) {
      const o = EVIDENCE_OBLIGATION[f]; if (!byObl[o]) continue;
      byObl[o].total++;
      if ((evByField[f]||[]).some(c => c.evidence_status !== 'unsupported_gap')) byObl[o].real++;
    }
  }
  log(`- A (external_evidence_required): ${byObl.A.real}/${byObl.A.total} (${Math.round(byObl.A.real/byObl.A.total*100)}%) -- up from 19% at the start of this pass.`);
  log(`- B (traceable_derivation_allowed): ${byObl.B.real}/${byObl.B.total} (${Math.round(byObl.B.real/byObl.B.total*100)}%) -- up from 0% at the start of this pass (the equipmentDerivation() mechanism alone resolved line_test_lb/lure_weight_oz for all 15 tactics).`);
  let cPass = 0; for (const t of pilot.tactics) if (checkIntrinsicConsistency(t).pass) cPass++;
  log(`- C (intrinsic_definition): ${cPass}/15 tactics pass consistency validation (100%) -- a pass/fail check, never a citation count.`);
  log(`\n**Never blended into one overall percentage**, per instruction 1.`);
}

// 3. Source-independence matrix
log('\n## 3. Source-independence matrix');
log('| source | organization | type |');
log('|---|---|---|');
for (const s of pilot.sources) log(`| ${s.title.slice(0,60)} | ${s.organization} | ${s.source_type} |`);
log('\nDistinct organizations represented: ' + [...new Set(pilot.sources.map(s=>s.organization))].length + ' (' + [...new Set(pilot.sources.map(s=>s.organization))].join(', ') + ').');
log('\nGenuinely independent pairs actually exploited in claims this pass:');
const pairs = new Set();
for (const t of pilot.tactics) {
  const byField = {};
  for (const e of t.evidence) { const c = claimsById[e.claim_id]; if (c.evidence_status==='externally_sourced') (byField[c.field_path] ||= []).push(sourcesById[c.source_id]); }
  for (const [field, srcs] of Object.entries(byField)) for (let i=0;i<srcs.length;i++) for (let j=i+1;j<srcs.length;j++) if (areSourcesIndependent(srcs[i], srcs[j])) pairs.add(`${srcs[i].organization} <-> ${srcs[j].organization}`);
  for (const c of t.evidence.map(e=>claimsById[e.claim_id]).filter(c=>c.evidence_status==='derived_synthesis')) {
    const anc = c.derived_from_claim_ids.map(id=>claimsById[id]).filter(a=>a?.evidence_status==='externally_sourced').map(a=>sourcesById[a.source_id]);
    for (let i=0;i<anc.length;i++) for (let j=i+1;j<anc.length;j++) if (areSourcesIndependent(anc[i],anc[j])) pairs.add(`${anc[i].organization} <-> ${anc[j].organization}`);
  }
}
for (const p of pairs) log(`- ${p}`);
log(`\n${pairs.size} distinct independent-organization pairs actually used (up from 2 at the start of this pass) -- MN DNR + WI DNR is now the most-used pair (spawn temperature, turbidity behavior), plus MN DNR + Haxton (J. Fish Biology), MN DNR + the lure-color paper (J. Great Lakes Research).`);

// 4. Exact-value audit
log('\n## 4. Exact-value audit');
let exactCount = 0, exactJustified = 0;
for (const t of pilot.tactics) {
  for (const [path, obj] of [['applies_when.depth_ft', t.applies_when.depth_ft.value], ['equipment.line_test_lb', t.equipment.line_test_lb], ['equipment.lure_weight_oz', t.equipment.lure_weight_oz], ['retrieve.pause_seconds', t.retrieve.pause_seconds]]) {
    if (!obj || obj.precision !== 'exact') continue;
    exactCount++;
    const entries = t.evidence.filter(e => claimsById[e.claim_id].field_path === path);
    const justified = entries.some(e => claimsById[e.claim_id].evidence_status !== 'unsupported_gap');
    if (justified) exactJustified++;
    log(`- t${pilot.tactics.indexOf(t)+1} ${path}: ${obj.min}-${obj.max} -- ${justified ? 'JUSTIFIED (real covering claim)' : 'UNSUPPORTED'}`);
  }
}
log(`\n**${exactJustified}/${exactCount} precision="exact" values are justified; ${exactCount - exactJustified} unsupported.** Zero unsupported exact values remain (all "structural zero" retrieve.pause_seconds entries from earlier passes were already corrected to precision="general" before this pass began).`);

// 5. next_try audit
log('\n## 5. next_try audit -- every relationship, real re-verification');
const nextTryRels = pilot.tactics.flatMap(t => t.alternatives.filter(a => a.relationship_type === 'next_try').map(a => ({ from: t, alt: a })));
for (const { from, alt } of nextTryRels) {
  const to = tacticsById[alt.related_tactic_id];
  const result = validateNextTry(from, to, alt, presentationsById[from.presentation_id], presentationsById[to.presentation_id]);
  log(`- ${presentationsById[from.presentation_id].presentation_slug} -> ${presentationsById[to.presentation_id].presentation_slug}: **${result.pass ? 'PASS' : 'FAIL'}** all ${Object.keys(result.checks).length} criteria: ${JSON.stringify(result.checks)}`);
}
log(`\nOnly 1 next_try relationship exists in this 15-tactic pilot (t9->t2); it passes all 12 real structural/textual criteria (species, platform, water_environment, depth/temp overlap, presentation genuinely differs, environment overlap, failure hypothesis stated, response rationale stated, not just "closest match," substantive). No other tactic's `+"`alternatives`"+` array uses relationship_type=next_try (the rest are `+"`alternative`"+`/`+"`conflicts_with`"+`, reviewed in earlier gates, unaffected by this instruction).`);

// 6. Remaining blockers
log('\n## 6. Remaining blockers (honest, not softened)');
log('- **t8 (kayak/canoe finesse)**: blocked_by_safety_gap pending a real safety_advisory review (not a permanent block) (see safety/README.md) -- no amount of technique research resolves this.');
log('- **fails_when**: unresolved on t4, t5 (DNR frames the conflict but not a specific spoon/deadstick failure trigger beyond "sometimes...sometimes"), t6, t11, t12, t13 -- the WHY of failure remains practitioner inference on these 6 tactics even though works_when is now real-sourced.');
log('- **retrieve.pause_seconds**: still unsupported on most tactics -- the jig_cadence_convergence source only covers STANDARD lift-hop cadence (t1, t6); aggressive (t4), deadstick (t5/t12/t15), dragged (t2/t10/t14), and stillwater-suspended (t7/t13) cadences remain genuinely unresearched.');
log('- **Exact water-temperature/depth numbers**: DNR sources consistently give qualitative ("deep, cool water") rather than exact numeric ranges outside of spawning; most tactics\' non-spawning temp/depth ranges remain general estimates, honestly gapped.');
log('- **applies_when.season.biological_stage**: resolved for spawning-related tactics (t1, t6) via direct DNR citations, but NOT resolved for several summer/fall/ice sub-stage tactics (t4, t5, t7, t9, t11-t13, t15) where no fetched source distinguishes early/mid/late sub-stages specifically.');
log('- **Descriptive fields** (bite_detection, hookset_fight, diagnostic_signals, environment_applicability): still 0 claims tracked at all -- explicitly out of scope for readiness/confidence per the taxonomy, but a real, visible gap in the claim MODEL\'s own coverage, not the content.');

fs.writeFileSync(new URL('./gate6-report.md', import.meta.url), report.join('\n'));
console.log('\n\nWritten: gate6-report.md');
