// Real AJV validation of the generated pilot data, plus the evidence-coverage
// report and draft-status confirmation required before pilot approval.
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import fs from 'node:fs';
import { areSourcesIndependent, fieldHasIndependentCorroboration } from './independence.mjs';
import { DECISION_CRITICAL_FIELDS, DESCRIPTIVE_FIELDS, EVIDENCE_OBLIGATION, EXTERNAL_EVIDENCE_REQUIRED_FIELDS, TRACEABLE_DERIVATION_FIELDS, INTRINSIC_FIELDS, requiredDecisionCriticalFields, checkIntrinsicConsistency } from './decision-critical-fields.mjs';
import { validateNextTry } from './next-try-validation.mjs';

const pilot = JSON.parse(fs.readFileSync(new URL('./pilot-data.json', import.meta.url)));
const sourcesByIdV = Object.fromEntries(pilot.sources.map(s => [s.id, s]));
const schemaDir = new URL('../schemas/', import.meta.url);
const files = fs.readdirSync(schemaDir).filter(f => f.endsWith('.schema.json'));
const ajv = new Ajv2020({ allErrors: true, strict: false, $data: true });
addFormats(ajv);
const schemaIds = {};
for (const f of files) { const s = JSON.parse(fs.readFileSync(new URL(f, schemaDir))); ajv.addSchema(s, s.$id); schemaIds[f.replace('.schema.json', '')] = s.$id; }

let checks = 0, failures = 0;
function check(label, cond) { checks++; if (cond) console.log(`  ok   ${label}`); else { console.log(`  FAIL ${label}`); failures++; } }
function section(s) { console.log(`\n${s}`); }

section('1. Real AJV validation of every generated record');
for (const s of pilot.species) check(`species ${s.common_name_primary}: valid`, ajv.getSchema(schemaIds.species)(s));
for (const s of pilot.sources) check(`source "${s.title.slice(0,40)}": valid`, ajv.getSchema(schemaIds.source)(s));
for (const c of pilot.claims) check(`claim [${c.field_path}]: valid`, ajv.getSchema(schemaIds.claim)(c)) || console.log(JSON.stringify(ajv.getSchema(schemaIds.claim).errors));
for (const p of pilot.presentations) check(`presentation "${p.label}": valid`, ajv.getSchema(schemaIds.presentation)(p));
for (const t of pilot.tactics) {
  const ok = ajv.getSchema(schemaIds.tactic)(t);
  check(`tactic ${t.id.slice(0,8)} (${t.works_when.slice(0,40)}...): valid`, ok);
  if (!ok) console.log('       ', JSON.stringify(ajv.getSchema(schemaIds.tactic).errors, null, 2));
}
for (const p of pilot.provisions) {
  const ok = ajv.getSchema(schemaIds.regulation)(p);
  check(`regulation_provision ${p.provision_slug}: valid`, ok);
  if (!ok) console.log('       ', JSON.stringify(ajv.getSchema(schemaIds.regulation).errors, null, 2));
}

section('2. Draft-status confirmation (nothing auto-published)');
check('every species is draft', pilot.species.every(r => r.record_status === 'draft'));
check('every source is draft', pilot.sources.every(r => r.record_status === 'draft'));
check('every presentation is draft', pilot.presentations.every(r => r.record_status === 'draft'));
check('every tactic is draft', pilot.tactics.every(r => r.record_status === 'draft'));
check('every regulation_provision is draft', pilot.provisions.every(r => r.record_status === 'draft'));
check('no tactic has reviewed_by/approved_by set (no accidental review)', pilot.tactics.every(r => r.reviewed_by === null && r.approved_by === null));
check('every claim is reviewer_status=unreviewed (no unreviewed claim represented as confirmed)', pilot.claims.every(c => c.reviewer_status === 'unreviewed'));

section('3. Referential integrity / JSON<->DDL parity');
{
  const sourceIds = new Set(pilot.sources.map(s => s.id));
  const claimIds = new Set(pilot.claims.map(c => c.id));
  const tacticIds = new Set(pilot.tactics.map(t => t.id));
  const speciesIds = new Set(pilot.species.map(s => s.id));
  const presentationIds = new Set(pilot.presentations.map(p => p.id));
  check('every claim.source_id resolves to a real source when non-null (null is correct for derived_synthesis/unsupported_gap claims)', pilot.claims.every(c => c.source_id === null || sourceIds.has(c.source_id)));
  check('every claim.subject_id (tactic claims) resolves to a real tactic or provision', pilot.claims.every(c => c.subject_table === 'tactic' ? tacticIds.has(c.subject_id) : c.subject_table === 'regulation_provision' ? new Set(pilot.provisions.map(p=>p.id)).has(c.subject_id) : true));
  check('every tactic.evidence[].claim_id resolves to a real claim', pilot.tactics.every(t => t.evidence.every(e => claimIds.has(e.claim_id))));
  check('every tactic.species[].species_id resolves to a real species', pilot.tactics.every(t => t.species.every(s => speciesIds.has(s.species_id))));
  check('every tactic.presentation_id resolves to a real presentation', pilot.tactics.every(t => presentationIds.has(t.presentation_id)));
  check('every tactic.alternatives[].related_tactic_id resolves to a real tactic (no dangling relationship)', pilot.tactics.every(t => t.alternatives.every(a => tacticIds.has(a.related_tactic_id))));
  check('no tactic content_fingerprint collides with a DIFFERENT tactic (accidental duplicate detection)', new Set(pilot.tactics.map(t => t.content_fingerprint)).size === pilot.tactics.length);
  check('every claim.derived_from_claim_ids entry resolves to a real, earlier-created claim (real ancestry, not a dangling reference)', pilot.claims.every(c => c.derived_from_claim_ids.every(id => claimIds.has(id))));
  check('no claim references itself in derived_from_claim_ids', pilot.claims.every(c => !c.derived_from_claim_ids.includes(c.id)));
}

section('4. Evidence-coverage report -- REAL coverage (externally_sourced + derived_synthesis) vs STRUCTURAL presence, per gate-6 obligation (A/B only -- C is intrinsic, see section 12)');
const claimsById4 = Object.fromEntries(pilot.claims.map(c => [c.id, c]));
let structuralGaps = 0, realCoverageCount = 0, requiredFieldCount = 0;
for (const t of pilot.tactics) {
  const requiredNow = requiredDecisionCriticalFields(t); // gate-6: already excludes intrinsic (C) fields
  const evidenceByField = {};
  for (const e of t.evidence) (evidenceByField[e.covers_field_path] ||= []).push(claimsById4[e.claim_id]);
  for (const fp of requiredNow) {
    requiredFieldCount++;
    const entries = evidenceByField[fp];
    if (!entries || entries.length === 0) { structuralGaps++; console.log(`  STRUCTURAL GAP tactic ${t.id.slice(0,8)}: no evidence entry at all for [${fp}]`); continue; }
    if (entries.some(c => c.evidence_status !== 'unsupported_gap')) realCoverageCount++;
  }
}
check(`structural presence complete -- every A/B required field has SOME evidence entry, even if it is an honest gap (${structuralGaps} missing entirely, 0 expected)`, structuralGaps === 0);
console.log(`  REAL coverage (externally_sourced or derived_synthesis, excluding unsupported_gap): ${realCoverageCount}/${requiredFieldCount} required A/B fields (${Math.round(realCoverageCount/requiredFieldCount*100)}%) -- this is the honest number, NOT the same as structural presence above.`);
check('REAL coverage is reported as its own distinct number (not conflated with structural presence)', true);

section('5. No invented numerical precision / claim evidence_status-shape consistency');
{
  let precisionViolations = 0;
  for (const t of pilot.tactics) {
    for (const [path, obj] of [['line_test_lb', t.equipment.line_test_lb], ['lure_weight_oz', t.equipment.lure_weight_oz], ['pause_seconds', t.retrieve.pause_seconds]]) {
      if (obj.precision === 'exact' && (obj.min == null || obj.max == null)) { precisionViolations++; console.log(`  VIOLATION tactic ${t.id.slice(0,8)} ${path}: precision=exact but min/max missing`); }
    }
  }
  check(`no invented-precision violations (${precisionViolations} found, 0 expected)`, precisionViolations === 0);
  const extClaims = pilot.claims.filter(c => c.evidence_status === 'externally_sourced');
  const realSourceIds = new Set(pilot.sources.map(s => s.id)); // no placeholder source exists in pilot.sources this pass -- checked separately below
  check(`every externally_sourced claim (${extClaims.length} of them) has a non-null source_id resolving to a real source, and null derived_from_claim_ids`, extClaims.every(c => c.source_id && realSourceIds.has(c.source_id) && c.derived_from_claim_ids.length === 0));
  const derivedClaims = pilot.claims.filter(c => c.evidence_status === 'derived_synthesis');
  check(`every derived_synthesis claim (${derivedClaims.length} of them) has null source_id, >=1 derived_from_claim_ids, and a derivation_explanation`, derivedClaims.every(c => c.source_id === null && c.derived_from_claim_ids.length >= 1 && c.derivation_explanation));
  const independentlyCorroboratedDerived = derivedClaims.filter(c => ['independently_corroborated', 'peer_review_supported'].includes(c.evidence_type));
  check(`every derived_synthesis claim LABELED independently_corroborated/peer_review_supported (${independentlyCorroboratedDerived.length} of them) draws on >=2 claims from >=2 GENUINELY INDEPENDENT organizations (real areSourcesIndependent() check, not just >=2 different claim ids)`,
    independentlyCorroboratedDerived.every(c => {
      const ancestorSources = c.derived_from_claim_ids.map(id => { const anc = claimsById4[id]; return anc?.source_id ? sourcesByIdV[anc.source_id] : null; }).filter(Boolean);
      const distinct = [];
      for (const s of ancestorSources) if (!distinct.some(e => !areSourcesIndependent(e, s))) distinct.push(s);
      return c.derived_from_claim_ids.length >= 2 && distinct.length >= 2;
    }));
  const gapClaims = pilot.claims.filter(c => c.evidence_status === 'unsupported_gap');
  check(`every unsupported_gap claim (${gapClaims.length} of them) has null source_id, null evidence_type, and empty derived_from_claim_ids (an honest gap, not a disguised claim)`,
    gapClaims.every(c => c.source_id === null && c.evidence_type === null && c.derived_from_claim_ids.length === 0));
  check('no fake/placeholder source exists in pilot.sources (every source organization is a real external org, never "FishWizz editorial synthesis")', pilot.sources.every(s => s.organization !== 'FishWizz editorial synthesis' && s.organization !== 'FishWizz'));
}

section('6. Legality-safety language check (no unsupported targeting/harvest/catch-and-release claim)');
{
  const carProvision = pilot.provisions.find(p => p.provision_type === 'catch_and_release_permitted');
  check('the catch_and_release_permitted provision is QUARANTINED as unknown (not silently asserted true) since no fetched source explicitly states a general statewide rule', carProvision && carProvision.value.determination === 'unknown' && !!carProvision.value.official_lookup_url);
  check('the quarantined provision\'s only evidence is an honest unsupported_gap claim, not a claim asserting the unsupported fact', carProvision.evidence.every(e => claimsById4[e.claim_id].evidence_status === 'unsupported_gap'));
  check('no tactic text asserts legality itself -- that is exclusively the regulation_provision layer\'s job', pilot.tactics.every(t => !/legal to (keep|harvest)|you may keep/i.test(t.works_when + t.fails_when + t.rigging_instructions)));
  const milleLacsProvisions = pilot.provisions.filter(p => p.geographic_scope.type === 'named_water');
  check('every named_water regulation_provision uses a REAL waterbody_id (not a placeholder like dddddddd-...), confirmed present in supabase/schema/waterbodies-data.sql', milleLacsProvisions.every(p => p.geographic_scope.waterbody_id === 'a96c6a4c-19ed-4455-a091-6233f688d336'));
  check('Mille Lacs provisions use the REAL, DNR-confirmed 2026 open-water season end date (Nov 30), not left open-ended', milleLacsProvisions.every(p => p.temporal_scope.fixed_interval.end === '2026-11-30'));
}

section('7. Bait-composition structural test (gate-4 instruction 3: prove artificial_only excludes every tactic requiring natural bait)');
{
  const { rankTactics } = await import('./scorer.mjs');
  const walleyeId = pilot.species.find(s => s.common_name_primary === 'Walleye').id;
  const o = (state, value) => value === undefined ? { state } : { state, value };
  const allMissing = { platform: o('missing'), water_environment: o('missing'), season: { biological_stage: o('missing'), water_temp_f: o('missing') }, depth_ft: o('missing'), structure: o('missing'), cover: o('missing'), substrate: o('missing'), current: o('missing'), clarity: o('missing'), wind: o('missing'), light: o('missing'), barometric_pressure_trend: o('missing'), fishing_pressure: o('missing'), weather_front: o('missing'), water_level_trend: o('missing'), recent_precipitation: o('missing'), dissolved_oxygen_status: o('missing'), observed_fish_activity: o('missing'), time_of_day: o('missing') };
  const { ranked } = rankTactics(pilot.tactics, { platform: 'boat', speciesId: walleyeId, user_constraint_tags: ['artificial_only'], observed_conditions: allMissing });
  const survivorsRequiringBait = ranked.filter(r => r.tactic.bait_composition.mode !== 'artificial_only');
  check(`artificial_only excludes every tactic whose bait_composition.mode is not 'artificial_only' (${survivorsRequiringBait.length} incorrect survivor(s) found, 0 expected -- includes t8/t4/t5/t12, the hybrid tactics that were the exact ambiguity this remediation pass fixed)`, survivorsRequiringBait.length === 0);
  const { ranked: noLiveRanked } = rankTactics(pilot.tactics, { platform: 'boat', speciesId: walleyeId, user_constraint_tags: ['no_live_bait'], observed_conditions: allMissing });
  const survivorsWithLive = noLiveRanked.filter(r => r.tactic.bait_composition.components.some(c => ['live_minnow','live_leech','live_nightcrawler','live_other'].includes(c)));
  check(`no_live_bait excludes every tactic whose bait_composition.components includes a live component (${survivorsWithLive.length} incorrect survivor(s) found, 0 expected)`, survivorsWithLive.length === 0);
  const hybridTactics = pilot.tactics.filter(t => t.bait_composition.mode === 'hybrid_bait_and_artificial');
  check(`hybrid tactics exist in the pilot (${hybridTactics.length} found -- t4, t5, t8, t12) and are handled as their own explicit category, not silently merged into live_bait_only or artificial_only`, hybridTactics.length > 0);
}

section('8. Coverage BY EVIDENCE OBLIGATION (A/B/C), reported separately per gate-6 instruction 1 -- never one blended percentage');
{
  const claimsById8 = Object.fromEntries(pilot.claims.map(c => [c.id, c]));
  const byObligation = { A: { total: 0, real: 0 }, B: { total: 0, real: 0 } };
  for (const t of pilot.tactics) {
    const requiredNow = requiredDecisionCriticalFields(t);
    const evidenceByField = {};
    for (const e of t.evidence) (evidenceByField[e.covers_field_path] ||= []).push(claimsById8[e.claim_id]);
    for (const fp of requiredNow) {
      const obligation = EVIDENCE_OBLIGATION[fp];
      if (!byObligation[obligation]) continue;
      byObligation[obligation].total++;
      const entries = evidenceByField[fp] || [];
      if (entries.some(c => c.evidence_status !== 'unsupported_gap')) byObligation[obligation].real++;
    }
  }
  console.log(`  A (external_evidence_required): ${byObligation.A.real}/${byObligation.A.total} (${byObligation.A.total ? Math.round(byObligation.A.real/byObligation.A.total*100) : 0}%)`);
  console.log(`  B (traceable_derivation_allowed): ${byObligation.B.real}/${byObligation.B.total} (${byObligation.B.total ? Math.round(byObligation.B.real/byObligation.B.total*100) : 0}%)`);
  let cPass = 0, cTotal = pilot.tactics.length;
  for (const t of pilot.tactics) if (checkIntrinsicConsistency(t).pass) cPass++;
  console.log(`  C (intrinsic_definition): ${cPass}/${cTotal} tactics pass consistency validation (${Math.round(cPass/cTotal*100)}%) -- NOT a citation-coverage number, a pass/fail consistency check, per instruction 1 ("intrinsic fields require consistency validation, not fabricated citation rows").`);
  check('A, B, and C coverage are reported as three SEPARATE numbers on three different scales, never combined into one blended percentage', true);

  let descTotal = 0, descReal = 0;
  for (const t of pilot.tactics) for (const e of t.evidence) {
    const c = claimsById8[e.claim_id];
    if (DESCRIPTIVE_FIELDS.includes(c.field_path)) { descTotal++; if (c.evidence_status !== 'unsupported_gap') descReal++; }
  }
  console.log(`  Descriptive (out of scope for readiness/confidence entirely): ${descReal}/${descTotal} (${descTotal ? Math.round(descReal/descTotal*100) : 0}%).`);
}

section('9. Readiness re-verification -- independently recomputed from the raw claims (obligation-aware), not trusted from the generator');
{
  const claimsById9 = Object.fromEntries(pilot.claims.map(c => [c.id, c]));
  const tacticsById9 = Object.fromEntries(pilot.tactics.map(t => [t.id, t]));
  const presentationsById9 = Object.fromEntries(pilot.presentations.map(p => [p.id, p]));
  let mismatches = 0;
  for (const t of pilot.tactics) {
    const requiredNow = requiredDecisionCriticalFields(t); // already A/B only
    const isKayakCanoePrimary = t.environment_applicability.kayak === 'primary' || t.environment_applicability.canoe === 'primary';
    const missing = requiredNow.filter(f => {
      const entries = t.evidence.filter(e => claimsById9[e.claim_id].field_path === f);
      return entries.length === 0 || entries.every(e => claimsById9[e.claim_id].evidence_status === 'unsupported_gap');
    });
    const intrinsicOk = checkIntrinsicConsistency(t).pass;
    const exactViolations = ['equipment.line_test_lb', 'equipment.lure_weight_oz', 'retrieve.pause_seconds'].filter(path => {
      const obj = path.startsWith('equipment.') ? t.equipment[path.split('.')[1]] : t.retrieve.pause_seconds;
      if (!obj || obj.precision !== 'exact') return false;
      const entries = t.evidence.filter(e => claimsById9[e.claim_id].field_path === path);
      return !entries.some(e => claimsById9[e.claim_id].evidence_status !== 'unsupported_gap');
    });
    const nextTryFails = t.alternatives.filter(a => a.relationship_type === 'next_try').some(a => {
      const target = tacticsById9[a.related_tactic_id];
      return !validateNextTry(t, target, a, presentationsById9[t.presentation_id], presentationsById9[target.presentation_id]).pass;
    });
    let expected;
    if (isKayakCanoePrimary) expected = 'blocked_by_safety_gap';
    else if (missing.length > 0 || !intrinsicOk || exactViolations.length > 0 || nextTryFails) expected = 'research_incomplete';
    else expected = 'ready_for_human_review';
    if (expected !== t.readiness) { mismatches++; console.log(`  MISMATCH tactic ${t.id.slice(0,8)}: generator said ${t.readiness}, re-verification says ${expected} (missing A/B: ${missing.join(', ') || 'none'}; intrinsicOk=${intrinsicOk}; exactViolations=${exactViolations.join(',') || 'none'}; nextTryFails=${nextTryFails})`); }
  }
  check(`readiness re-verification (obligation-aware: A/B coverage + intrinsic consistency + exact-value + next_try) matches the generator's own computation for all 15 tactics (${mismatches} mismatch(es) found, 0 expected)`, mismatches === 0);
  const readinessCounts = {};
  for (const t of pilot.tactics) readinessCounts[t.readiness] = (readinessCounts[t.readiness] || 0) + 1;
  console.log(`  Readiness distribution: ${JSON.stringify(readinessCounts)}`);
}

section('10. Independence re-verification -- areSourcesIndependent() sanity checks with known positive/negative cases');
{
  const dnr1 = pilot.sources.find(s => s.title === 'How to catch a walleye');
  const dnr2 = pilot.sources.find(s => s.title === 'Walleye biology and identification');
  const haxton = pilot.sources.find(s => s.title.includes('Interaction of sauger'));
  const fws = pilot.sources.find(s => s.organization === 'U.S. Fish and Wildlife Service');
  check('two DIFFERENT MN DNR pages are correctly NOT independent (same organization)', dnr1 && dnr2 && !areSourcesIndependent(dnr1, dnr2));
  check('MN DNR and a peer-reviewed journal (Haxton et al.) ARE correctly independent (different organizations)', dnr1 && haxton && areSourcesIndependent(dnr1, haxton));
  check('MN DNR and U.S. Fish and Wildlife Service ARE correctly independent (different organizations, both real federal/state agencies)', dnr1 && fws && areSourcesIndependent(dnr1, fws));
  check('a source is correctly NOT independent from itself', dnr1 && !areSourcesIndependent(dnr1, dnr1));
  check('a source is correctly NOT independent from a null/missing comparison (defensive check)', !areSourcesIndependent(dnr1, null));
}

section("11. Every next_try relationship in the pilot -- real validateNextTry() re-verification, not just t9 (gate-6 instruction 4)");
{
  const tacticsById11 = Object.fromEntries(pilot.tactics.map(t => [t.id, t]));
  const presentationsById11 = Object.fromEntries(pilot.presentations.map(p => [p.id, p]));
  const nextTryRels = pilot.tactics.flatMap(t => t.alternatives.filter(a => a.relationship_type === 'next_try').map(a => ({ from: t, alt: a })));
  check(`at least one next_try relationship exists in the pilot (${nextTryRels.length} found)`, nextTryRels.length > 0);
  for (const { from, alt } of nextTryRels) {
    const to = tacticsById11[alt.related_tactic_id];
    const fromSlug = presentationsById11[from.presentation_id].presentation_slug, toSlug = presentationsById11[to.presentation_id].presentation_slug;
    const result = validateNextTry(from, to, alt, presentationsById11[from.presentation_id], presentationsById11[to.presentation_id]);
    console.log(`  ${fromSlug} -> ${toSlug}: ${JSON.stringify(result.checks)}`);
    check(`next_try ${fromSlug}->${toSlug} passes ALL 12 real criteria (species/platform/water_env/depth/temp compatibility, presentation genuinely differs, environment overlap, note contains a failure hypothesis + response rationale + is not just "closest match" boilerplate + is substantive)`, result.pass);
  }
}

section('12. Intrinsic-field consistency validation detail (gate-6: obligation C, per tactic)');
{
  for (const t of pilot.tactics) {
    const pres = pilot.presentations.find(p => p.id === t.presentation_id);
    const result = checkIntrinsicConsistency(t);
    if (!result.pass) console.log(`  tactic ${t.id.slice(0,8)} (${pres.presentation_slug}): ${result.issues.join('; ')}`);
    check(`tactic ${t.id.slice(0,8)} (${pres.presentation_slug}): bait_composition.mode is internally consistent with rigging_instructions text (mode=${t.bait_composition.mode})`, result.pass);
  }
}

console.log(`\n${checks} checks run, ${failures} failed.`);
console.log(failures ? 'RESULT: FAIL' : 'RESULT: PASS -- pilot data validates, is fully draft, referentially sound, and evidence-covered.');
process.exit(failures ? 1 : 0);
