// Walleye/sauger pilot generator -- GATE 4 REMEDIATION PASS.
//
// Supersedes the gate-3 generator's auto-generation fallback entirely: there
// is no more "cover every required field with a boilerplate expert_synthesis
// claim" mechanism. Every claim is now explicitly authored as one of three
// evidence_status values:
//   ext(...)     -- externally_sourced: cites one real, independently fetched
//                   source directly (see REAL FACTS below).
//   derived(...) -- derived_synthesis: a reasoned combination of >=1 real
//                   claims, with derived_from_claim_ids + derivation_explanation.
//                   Only labeled evidence_type 'expert_consensus' when it
//                   draws on >=2 claims from DIFFERENT sources (real
//                   corroboration); a single-source combination is
//                   'expert_synthesis'.
//   gap(...)     -- unsupported_gap: an explicit, honest admission that no
//                   real evidence exists for this field. Still occupies the
//                   field_path slot (so the gap is visible and trackable) but
//                   NEVER counts toward coverage/confidence/ranking/publish.
//
// Real research performed this pass (2026-08-29), all facts traceable to a
// fetched URL -- see REAL FACTS below and semantic-audit-report.md section on
// sources for the full citation list. No fake/placeholder source is created
// anywhere in this file; a field with no real source is a `gap(...)`, never
// a claim pointed at a stand-in.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { DECISION_CRITICAL_FIELDS, EVIDENCE_OBLIGATION, EXTERNAL_EVIDENCE_REQUIRED_FIELDS, TRACEABLE_DERIVATION_FIELDS, INTRINSIC_FIELDS, requiredDecisionCriticalFields, checkIntrinsicConsistency } from './decision-critical-fields.mjs';
import { areSourcesIndependent, fieldHasIndependentCorroboration } from './independence.mjs';
import { validateNextTry } from './next-try-validation.mjs';

const fp = (obj) => crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
const uuid = () => crypto.randomUUID();
const con = (state, value) => value === undefined ? { state } : { state, value };
const range = (min, max, unit, precision = 'general') => ({ min, max, unit, precision });
const NOW = '2026-08-29T00:00:00Z';
const TODAY = '2026-08-29';

function baseConditionSet(overrides = {}) {
  const base = {
    platform: con('unconstrained'), water_environment: con('unconstrained'),
    season: { biological_stage: con('unconstrained'), calendar_range: con('unconstrained'), water_temp_f: con('unconstrained') },
    depth_ft: con('unconstrained'), structure: con('unconstrained'), cover: con('unconstrained'), substrate: con('unconstrained'),
    current: con('unconstrained'), clarity: con('unconstrained'), wind: con('unconstrained'), light: con('unconstrained'),
    barometric_pressure_trend: con('unconstrained'), fishing_pressure: con('unconstrained'),
    weather_front: con('unconstrained'), water_level_trend: con('unconstrained'), recent_precipitation: con('unconstrained'),
    dissolved_oxygen_status: con('not_applicable'), observed_fish_activity: con('unconstrained'), time_of_day: con('unconstrained'),
  };
  return Object.assign(base, overrides);
}

// ---------- species ----------
const species = {};
function makeSpecies(slug, sci, common) {
  const id = uuid();
  const rec = { id, species_slug: slug, scientific_name: sci, common_name_primary: common, common_name_aliases: [],
    angling_category_slugs: ['walleye_sauger'], taxonomic_note: null, content_fingerprint: fp({ sci }),
    record_status: 'draft', created_at: NOW, updated_at: NOW, verified_at: TODAY, published_at: null,
    schema_version: '3.0.0', content_version: 1 };
  species[slug] = rec;
  return rec;
}
const walleye = makeSpecies('species:sander-vitreus', 'Sander vitreus', 'Walleye');
const sauger = makeSpecies('species:sander-canadensis', 'Sander canadensis', 'Sauger');

// ---------- sources (all real, fetched 2026-08-28/29) ----------
const sources = {};
function makeSource(key, title, url, { organization = 'Minnesota DNR', parentOrganization = null, sourceType = 'official_guidance', geo = 'MN' } = {}) {
  const id = uuid();
  sources[key] = { id, title, organization, parent_organization: parentOrganization, url, publication_date: null, access_date: TODAY,
    source_type: sourceType, geographic_relevance: geo, record_status: 'draft', content_fingerprint: fp({ url }),
    created_at: NOW, updated_at: NOW, published_at: null, schema_version: '3.0.0', content_version: 1 };
  return sources[key];
}
makeSource('walleye_howto', 'How to catch a walleye', 'https://www.dnr.state.mn.us/gofishing/how-catch-walleye.html');
makeSource('walleye_ice', 'Ice fishing for walleye', 'https://www.dnr.state.mn.us/gofishing/ice-fishing-walleye.html');
makeSource('mille_lacs_2026', 'DNR keeps three-walleye limit for 2026 open water season on Mille Lacs Lake',
  'https://www.dnr.state.mn.us/news/2026/03/05/minnesota-dnr-keeps-three-walleye-limit-2026-open-water-season-mille-lacs-lake');
makeSource('walleye_biology', 'Walleye biology and identification', 'https://www.dnr.state.mn.us/fish/walleye/biology.html');
makeSource('sauger_mcv', "Minnesota Profile: Sauger (Sander canadensis)", 'https://www.dnr.state.mn.us/mcvmagazine/issues/2022/may-jun/sauger.html');
makeSource('barotrauma_dnr', 'Barotrauma', 'https://www.dnr.state.mn.us/fish_diseases/barotrauma.html');
// gate-5 NEW: genuinely INDEPENDENT (non-MN-DNR) organizations, fetched this pass.
// These are what make real independently_corroborated claims possible at all --
// every source above is the SAME organization (Minnesota DNR) and, per instruction 1,
// cannot corroborate itself no matter how many different pages are cited.
makeSource('fws_walleye', 'Walleye (Sander vitreus)', 'https://www.fws.gov/species/walleye-sander-vitreus',
  { organization: 'U.S. Fish and Wildlife Service', sourceType: 'official_guidance', geo: 'national' });
makeSource('haxton_2019', 'Interaction of sauger Sander canadensis and walleye Sander vitreus in a large, shallow northern river',
  'https://onlinelibrary.wiley.com/doi/10.1111/jfb.14080',
  { organization: 'Journal of Fish Biology (Wiley)', sourceType: 'peer_review_supported', geo: 'MN_WI_boundary' }); // studies the Rainy River, a real MN/Ontario border water
makeSource('lure_color_turbidity_paper', "You can't just use gold: Elevated turbidity alters successful lure color for recreational Walleye fishing",
  'https://www.sciencedirect.com/science/article/pii/S0380133020300496',
  { organization: 'Journal of Great Lakes Research (Elsevier)', sourceType: 'peer_review_supported', geo: 'great_lakes' });
makeSource('massie_wagner_2021', 'Lake turbidity mitigates impact of warming on walleyes in upper Midwest lakes (Penn State research summary)',
  'https://www.psu.edu/news/research/story/lake-turbidity-mitigates-impact-warming-walleyes-upper-midwest-lakes',
  { organization: 'Pennsylvania State University', parentOrganization: null, sourceType: 'peer_review_supported', geo: 'national' }); // underlying paper: Canadian Journal of Fisheries and Aquatic Sciences, Feb 2021
// gate-6 NEW: a real, independent tackle-industry rod-power/line/lure-weight convention chart --
// this is what makes a genuine "traceable derivation" possible for equipment.line_test_lb and
// equipment.lure_weight_oz on every tactic, per instruction 3 ("manufacturer rod-rating
// conventions"). The source itself is explicit that "there is no universal standard" across rod
// types (spinning/casting/swimbait) -- that caveat is preserved in every derivation citing it,
// not silently dropped.
makeSource('rod_power_chart', 'Fishing Rod Lure Weight and Line Test Chart', 'https://norrik.com/fishing-rod-weight-chart/',
  { organization: 'Norrik', sourceType: 'manufacturer_guidance', geo: 'national' });
// gate-6: convergent jig-cadence pause-duration finding across multiple independent established
// angling-education publications (FishUSA, others) -- direct full-text fetch was blocked (403) on
// the strongest single source, so this is cited as a cross-publication convergent pattern from
// WebSearch-index synthesis, not one directly-quoted article. Used ONLY for standard-tempo
// lift-hop jig presentations (not deadstick/aggressive/troll cadences, which are a different
// technique category this source does not address).
makeSource('jig_cadence_convergence', 'Cross-publication convergent finding on jig lift-and-pause cadence (FishUSA cold-water jerkbait cadence guide and others)',
  'https://www.fishusa.com/learn/cold-water-walleye-jerkbait-cadence/', { organization: 'FishUSA', sourceType: 'anecdotal', geo: 'national' });
// gate-6 batch-1 addition: Wisconsin DNR -- a genuinely DIFFERENT organization from Minnesota DNR
// (both are real state agencies, not the same one, satisfying areSourcesIndependent()). This is
// what makes real independently_corroborated water-temperature/turbidity claims possible: MN DNR
// and WI DNR independently state the SAME 42-50F peak spawning figure and the SAME
// turbidity-increases-daytime-activity pattern.
makeSource('walleye_wi_dnr', 'Walleye | Fishes of Wisconsin', 'https://dnr.wisconsin.gov/topic/Fishing/species/walleye.html',
  { organization: 'Wisconsin DNR', sourceType: 'official_guidance', geo: 'WI' });
// gate-6 batch-2 addition: basic winter limnology (under-ice thermal stratification), used ONLY
// to ground the ice tactics' water_temp_f range -- NOT a walleye-specific behavioral source, and
// the derivations citing it say so explicitly.
makeSource('winter_limnology', 'A Look Under the Ice: Winter Lake Ecology', 'https://www.ausableriver.org/blog/look-under-ice-winter-lake-ecology',
  { organization: 'Ausable River Association / Adirondack Watershed Institute', sourceType: 'expert_synthesis', geo: 'national' });
// gate-6 batch-5 addition: independent established angling publication, fetched directly, on
// rising/post-rain river walleye behavior -- fills a genuine, previously entirely-unsupported gap.
makeSource('windrider_rain_fishing', 'How to Fish for Walleye in the Rain: Tactics and Gear', 'https://windrider.com/blogs/tips-and-tricks/how-to-fish-for-walleye-in-the-rain-tactics-and-gear',
  { organization: 'WindRider', sourceType: 'anecdotal', geo: 'national' });
makeSource('mn_dnr_winterkill', 'Fish kills | Minnesota DNR', 'https://www.dnr.state.mn.us/fisheries/fishkills.html');
// No fake/placeholder source this pass -- every field with no real source is gap(...).

// ---------- claims ----------
const claims = [];
const claimText = {};
function _push(rec) { claims.push(rec); claimText[rec.id] = rec.paraphrased_claim; return rec.id; }

/** externally_sourced: cites ONE real source directly. evidenceType defaults to the source's OWN source_type (a single source cannot make itself more authoritative than its own type). */
function ext(sourceKey, subjectTable, subjectId, fieldPath, text, sourceLocation, evidenceType, geo = 'MN') {
  evidenceType = evidenceType || sources[sourceKey].source_type;
  return _push({ id: uuid(), evidence_status: 'externally_sourced', source_id: sources[sourceKey].id,
    subject_table: subjectTable, subject_id: subjectId, field_path: fieldPath, paraphrased_claim: text,
    source_location: sourceLocation, evidence_type: evidenceType, derived_from_claim_ids: [], derivation_explanation: null,
    access_date: TODAY, geographic_applicability: geo, reviewer_status: 'unreviewed', reviewer_id: null, reviewed_at: null, created_at: NOW });
}
/** derived_synthesis: reasoned combination of >=1 prior claim ids. independently_corroborated requires >=2 claims from GENUINELY DIFFERENT organizations (real areSourcesIndependent() check -- same organization across different pages does NOT qualify, per instruction 1). Confidence never exceeds the weakest ancestor's own type (peer_review_supported ancestors can lift a derived claim to peer_review_supported; official_guidance-only ancestors cap it at independently_corroborated at best). */
function derived(subjectTable, subjectId, fieldPath, fromClaimIds, explanation, geo = 'MN') {
  const ancestorSources = fromClaimIds.map(id => { const c = claims.find(x => x.id === id); return c?.source_id ? sources[Object.keys(sources).find(k => sources[k].id === c.source_id)] : null; }).filter(Boolean);
  const distinctIndependentSources = [];
  for (const s of ancestorSources) if (!distinctIndependentSources.some(existing => !areSourcesIndependent(existing, s))) distinctIndependentSources.push(s);
  const genuinelyIndependent = distinctIndependentSources.length >= 2;
  const anyPeerReviewed = ancestorSources.some(s => s.source_type === 'peer_review_supported');
  const evidenceType = anyPeerReviewed && genuinelyIndependent ? 'peer_review_supported' : genuinelyIndependent ? 'independently_corroborated' : 'expert_synthesis';
  return _push({ id: uuid(), evidence_status: 'derived_synthesis', source_id: null,
    subject_table: subjectTable, subject_id: subjectId, field_path: fieldPath, paraphrased_claim: `[derived] ${explanation}`,
    source_location: 'derived from cited claims, see derivation_explanation', evidence_type: evidenceType,
    derived_from_claim_ids: fromClaimIds, derivation_explanation: explanation,
    access_date: TODAY, geographic_applicability: geo, reviewer_status: 'unreviewed', reviewer_id: null, reviewed_at: null, created_at: NOW });
}
/** unsupported_gap: honest admission -- no real source, does not count toward coverage/confidence/ranking/publish. */
function gap(subjectTable, subjectId, fieldPath, note) {
  return _push({ id: uuid(), evidence_status: 'unsupported_gap', source_id: null,
    subject_table: subjectTable, subject_id: subjectId, field_path: fieldPath, paraphrased_claim: `[GAP] ${note}`,
    source_location: 'n/a -- no source', evidence_type: null, derived_from_claim_ids: [], derivation_explanation: null,
    access_date: TODAY, geographic_applicability: 'MN_WI', reviewer_status: 'unreviewed', reviewer_id: null, reviewed_at: null, created_at: NOW });
}

// ---------- presentations ----------
const presentations = {};
function makePresentation(slug, label, category, imitates, tier) {
  const id = uuid();
  presentations[slug] = { id, presentation_slug: slug, label, category, imitates, intensity_tier: tier,
    record_status: 'draft', content_fingerprint: fp({ slug }), created_at: NOW, updated_at: NOW, published_at: null,
    schema_version: '3.0.0', content_version: 1 };
  return presentations[slug];
}
makePresentation('jig-minnow', 'Jig and minnow', 'live_bait_jig', 'injured baitfish', 'standard');
makePresentation('slip-sinker-livebait-rig', 'Slip-sinker (Lindy-style) live-bait rig', 'live_bait_rig', 'natural bottom-feeding baitfish/invertebrate', 'subtle');
makePresentation('shallow-crankbait', 'Small perch-imitating crankbait', 'crankbait', 'perch / small baitfish', 'standard');
makePresentation('jigging-spoon-aggressive', 'Jigging spoon, aggressive cadence', 'ice_jig', 'fleeing/injured baitfish', 'aggressive');
makePresentation('jig-minnow-head-deadstick', 'Minnow-head jig, near-motionless', 'ice_jig', 'dying/stationary baitfish', 'subtle');
makePresentation('slip-bobber-livebait', 'Slip bobber with live bait', 'live_bait_rig', 'suspended baitfish/leech', 'subtle');
makePresentation('crawler-harness-troll', 'Crawler harness, trolled', 'trolling_rig', 'spinner-flashed nightcrawler', 'standard');

// ---------- tactics ----------
const tactics = [];
function makeTactic({ speciesKeys, presentationSlug, applies_when, equipment, bait_composition, presentation_method_tags, retrieve,
  rigging_instructions, bite_detection, hookset_fight, works_when, fails_when, diagnostic_signals,
  casting_access_required, environment_applicability, conservation_notes, geographic_applicability,
  buildEvidence, alternatives = [] }) {
  const id = uuid();
  const fullSet = baseConditionSet(applies_when);
  const explicitIds = buildEvidence(id, equipment); // claim ids the caller explicitly hand-authored (real research) for this tactic; equipment passed through for equipmentDerivation()
  const explicitCovered = new Set(explicitIds.map(cid => claims.find(c => c.id === cid).field_path));

  // gate-5: the required-field list now covers every DECISION_CRITICAL_FIELDS entry the
  // tactic actually constrains (not just the old 8), per instruction 2. Any field the caller
  // did NOT explicitly research this pass gets an HONEST auto-gap -- never fake evidence,
  // just an explicit, visible admission that it wasn't researched, so nothing is silently
  // missing from the record.
  const requiredNow = requiredDecisionCriticalFields({ applies_when: fullSet, conservation_notes: conservation_notes ?? null, casting_access_required: casting_access_required ?? null });
  const autoGapIds = [];
  for (const f of requiredNow) {
    if (!explicitCovered.has(f)) autoGapIds.push(gap('tactic', id, f, `Not specifically researched this pass -- no source sought or found for this decision-critical field on this tactic. Flagged as an open research item, not silently covered.`));
  }
  const evidenceIds = [...explicitIds, ...autoGapIds];
  const evidence = evidenceIds.map(cid => ({ claim_id: cid, covers_field_path: claims.find(c => c.id === cid).field_path }));

  // ---- confidence: computed ONLY from evidence on obligation-A/B fields (external_evidence_required
  // + traceable_derivation_allowed) -- intrinsic (C) fields never feed confidence, since they aren't
  // evidentiary claims at all. Genuine cross-organization independence check -- a single authoritative
  // DNR page is official_guidance, never independently_corroborated.
  const claimsById = Object.fromEntries(claims.map(c => [c.id, c]));
  const sourcesById = Object.fromEntries(Object.values(sources).map(s => [s.id, s]));
  const abFields = [...EXTERNAL_EVIDENCE_REQUIRED_FIELDS, ...TRACEABLE_DERIVATION_FIELDS];
  const dcEvidence = evidence.filter(e => abFields.includes(claimsById[e.claim_id].field_path));
  const dcClaims = dcEvidence.map(e => claimsById[e.claim_id]).filter(c => c.evidence_status !== 'unsupported_gap');
  const byField = {};
  for (const c of dcClaims) (byField[c.field_path] ||= []).push(c);
  const anyPeerReview = dcClaims.some(c => c.evidence_type === 'peer_review_supported');
  const anyFieldIndependentlyCorroborated = Object.values(byField).some(fc => fieldHasIndependentCorroboration(fc, claimsById, sourcesById));
  const anyOfficialGuidance = dcClaims.some(c => c.evidence_status === 'externally_sourced');
  const anyDerived = dcClaims.some(c => c.evidence_status === 'derived_synthesis');
  const anyRealAnywhere = evidence.some(e => claimsById[e.claim_id].evidence_status !== 'unsupported_gap');
  let confidence;
  if (anyPeerReview) confidence = 'peer_review_supported';
  else if (anyFieldIndependentlyCorroborated) confidence = 'independently_corroborated';
  else if (anyOfficialGuidance) confidence = 'official_guidance';
  else if (anyDerived) confidence = 'expert_synthesis';
  else if (anyRealAnywhere) confidence = 'estimated';
  else confidence = 'unsupported';

  // ---- readiness: SEPARATE from confidence, and now obligation-aware (gate-6). A tactic
  // cannot be ready_for_human_review while:
  //  - any A field it actually uses lacks real (non-gap) evidence
  //  - any B field it actually uses lacks a real (non-gap) claim (ideally a derivation)
  //  - any C field fails checkIntrinsicConsistency()
  //  - any equipment/retrieve range is precision='exact' while its covering claim is a gap
  //  - it's a kayak/canoe-primary tactic (safety gap, unresolved regardless of research)
  //  - any next_try relationship fails validateNextTry()
  const isKayakCanoePrimary = environment_applicability.kayak === 'primary' || environment_applicability.canoe === 'primary';
  const missingAB = requiredNow.filter(f => {
    const entriesForField = evidence.filter(e => claimsById[e.claim_id].field_path === f);
    return entriesForField.length === 0 || entriesForField.every(e => claimsById[e.claim_id].evidence_status === 'unsupported_gap');
  });
  const intrinsicResult = checkIntrinsicConsistency({ rigging_instructions, bait_composition });
  const exactViolations = [];
  for (const [path, obj] of [['equipment.line_test_lb', equipment.line_test_lb], ['equipment.lure_weight_oz', equipment.lure_weight_oz], ['retrieve.pause_seconds', retrieve.pause_seconds]]) {
    if (obj.precision !== 'exact') continue;
    const entriesForField = evidence.filter(e => claimsById[e.claim_id].field_path === path);
    const covered = entriesForField.some(e => claimsById[e.claim_id].evidence_status !== 'unsupported_gap');
    if (!covered) exactViolations.push(path);
  }
  let readiness, readinessReason;
  if (isKayakCanoePrimary) {
    readiness = 'blocked_by_safety_gap';
    readinessReason = 'Kayak/canoe is a primary platform for this tactic, and no safety_advisory data exists yet to confirm or rule out conditions where it is unsafe (see safety/README.md) -- blocked regardless of technique-evidence completeness.';
  } else if (missingAB.length > 0) {
    readiness = 'research_incomplete';
    readinessReason = `${missingAB.length} external_evidence_required/traceable_derivation_allowed field(s) still unsupported: ${missingAB.join(', ')}.`;
  } else if (!intrinsicResult.pass) {
    readiness = 'research_incomplete';
    readinessReason = `Intrinsic-field consistency check failed: ${intrinsicResult.issues.join('; ')}.`;
  } else if (exactViolations.length > 0) {
    readiness = 'research_incomplete';
    readinessReason = `${exactViolations.length} field(s) marked precision=exact without covering real evidence: ${exactViolations.join(', ')}.`;
  } else {
    readiness = 'ready_for_human_review';
    readinessReason = 'Every external_evidence_required and traceable_derivation_allowed field this tactic uses has real evidence; all intrinsic fields pass consistency validation; no unsupported exact value remains; no safety gap applies. Still requires actual human review/approval -- readiness is a research-completeness gate, not a publish decision.';
  }
  const rec = {
    id, content_fingerprint: fp({ presentationSlug, applies_when, pass: 'gate4' }),
    presentation_id: presentations[presentationSlug].id,
    species: speciesKeys.map((k, i) => ({ species_id: species[k].id, is_primary_species: i === 0, override_equipment: null, override_notes: null })),
    applies_when: fullSet,
    equipment, bait_composition, presentation_method_tags, retrieve, rigging_instructions, bite_detection, hookset_fight, works_when, fails_when, diagnostic_signals,
    casting_access_required: casting_access_required ?? null,
    environment_applicability, conservation_notes: conservation_notes ?? null,
    evidence, confidence, readiness, readiness_reason: readinessReason, geographic_applicability, verified_date: TODAY,
    alternatives, record_status: 'draft', reviewed_by: null, reviewed_at: null, approved_by: null, approved_at: null,
    superseded_by: null, created_at: NOW, updated_at: NOW, published_at: null, schema_version: '3.0.0', content_version: 1,
  };
  tactics.push(rec);
  return rec;
}
const envAll = (over) => Object.assign({ shore: 'not_applicable', dock: 'not_applicable', wading: 'not_applicable', boat: 'not_applicable', kayak: 'not_applicable', canoe: 'not_applicable', ice: 'not_applicable' }, over);
const bc = (mode, components) => ({ mode, components });
const GAP_TACKLE = (id, field) => gap('tactic', id, field, `No fetched source (DNR or otherwise) states an exact ${field.includes('line_test') ? 'line-test' : field.includes('lure_weight') ? 'lure-weight' : 'pause-duration'} number for this presentation. The value shown is standard-tackle sizing knowledge, not sourced -- excluded from coverage/confidence/ranking per the gate-4 evidence-remediation rules.`);

// gate-6 instruction 3: a real traceable derivation for line_test_lb/lure_weight_oz, combining
// (a) the manufacturer rod-power/line/lure-weight convention chart (real, independent source),
// (b) the tactic's own already-chosen rod_power class, and (c) an explicit FishWizz derivation
// stating whether the tactic's actual range sits inside or outside the standard convention for
// that power class -- disagreement is REPORTED, never silently forced to match (per instruction 3:
// "if reliable sources disagree, retain the range of disagreement and explain it").
const ROD_POWER_STANDARD = {
  ultralight: { lure: [0.0156, 0.0625], line: [1, 6] },
  light: { lure: [0.0625, 0.25], line: [4, 8] },
  medium_light: { lure: [0.25, 0.5], line: [6, 10] },
  medium: { lure: [0.5, 1], line: [8, 15] },
  medium_heavy: { lure: [1, 4], line: [15, 30] },
  heavy: { lure: [4, 6], line: [20, 40] },
};
function equipmentDerivation(id, equipment) {
  const std = ROD_POWER_STANDARD[equipment.rod_power];
  if (!std) return [GAP_TACKLE(id, 'equipment.line_test_lb'), GAP_TACKLE(id, 'equipment.lure_weight_oz')]; // specialized_musky/sturgeon -- no standard chart entry, remains an honest gap
  const chartClaim = ext('rod_power_chart', 'tactic', id, 'equipment.line_test_lb', `Norrik rod-power/line/lure-weight convention chart (independent tackle publisher, not a DNR or academic source -- a real manufacturer-convention specification, used per instruction 3 for equipment sizing only, not as evidence of technique effectiveness): rod_power="${equipment.rod_power}" conventionally pairs with line test ${std.line[0]}-${std.line[1]}lb and lure weight ${std.lure[0]}-${std.lure[1]}oz. The source itself states "there is no universal standard... since different rod types (spinning/casting/swimbait) perform differently" -- this is a general convention, not a guarantee, and is preserved as such here.`, 'Rod power classes chart', 'manufacturer_guidance');
  const lineAgrees = equipment.line_test_lb.min >= std.line[0] * 0.7 && equipment.line_test_lb.max <= std.line[1] * 1.3;
  const lureAgrees = equipment.lure_weight_oz.min >= std.lure[0] * 0.5 && equipment.lure_weight_oz.max <= std.lure[1] * 1.5;
  const lineDerived = derived('tactic', id, 'equipment.line_test_lb', [chartClaim],
    lineAgrees
      ? `This tactic's stated line-test range (${equipment.line_test_lb.min}-${equipment.line_test_lb.max}lb) falls within the standard convention for a ${equipment.rod_power} rod (${std.line[0]}-${std.line[1]}lb) per the Norrik chart -- a genuine traceable derivation, not an independently discovered fact.`
      : `DISAGREEMENT, retained rather than hidden: this tactic's stated line-test range (${equipment.line_test_lb.min}-${equipment.line_test_lb.max}lb) falls OUTSIDE the standard convention for a ${equipment.rod_power} rod (${std.line[0]}-${std.line[1]}lb) per the Norrik chart. The chart itself notes ratings vary by rod type/application, so this is not necessarily an error -- e.g. species/current/leverage considerations specific to this tactic may justify the deviation -- but it is flagged, not silently reconciled.`);
  const lureDerived = derived('tactic', id, 'equipment.lure_weight_oz', [chartClaim],
    lureAgrees
      ? `This tactic's stated lure-weight range (${equipment.lure_weight_oz.min}-${equipment.lure_weight_oz.max}oz) is reasonably consistent with the standard convention for a ${equipment.rod_power} rod (${std.lure[0]}-${std.lure[1]}oz) per the Norrik chart.`
      : `DISAGREEMENT, retained rather than hidden: this tactic's stated lure-weight range (${equipment.lure_weight_oz.min}-${equipment.lure_weight_oz.max}oz) falls OUTSIDE the standard convention for a ${equipment.rod_power} rod (${std.lure[0]}-${std.lure[1]}oz) per the Norrik chart -- flagged for human review rather than silently reconciled; the chart itself cautions ratings vary by rod type.`);
  return [lineDerived, lureDerived];
}

// 1. Spring shallow shiner flats -- walleye, shore/wading/boat, live bait
const t1 = makeTactic({
  speciesKeys: ['species:sander-vitreus'], presentationSlug: 'jig-minnow',
  applies_when: {
    platform: con('constrained', ['shore', 'wading', 'boat']), water_environment: con('constrained', ['natural_lake', 'reservoir_flowage']),
    season: { biological_stage: con('constrained', 'pre_spawn'), calendar_range: con('constrained', { start_month_day: '04-15', end_month_day: '05-20', varies_by_latitude: true }), water_temp_f: con('constrained', range(42, 55, 'F', 'general')) },
    depth_ft: con('constrained', range(1, 6, 'ft', 'exact')), structure: con('constrained', ['flat']), substrate: con('constrained', ['sand']),
    current: con('constrained', 'none'), clarity: con('unconstrained'),
  },
  equipment: { rod_power: 'medium_light', rod_action: 'fast', reel_type: 'spinning', line_test_lb: range(6, 8, 'lb'), leader: null, lure_weight_oz: range(0.125, 0.25, 'oz'), hook_size: '#4-#2 jig' },
  bait_composition: bc('live_bait_only', ['live_minnow']), presentation_method_tags: ['casting'],
  retrieve: { speed: 'slow', cadence: 'lift-drop along the bottom', pause_seconds: range(1, 2, 's'), depth_control: 'count down to bottom, hop along it', rod_position: 'tip low' },
  rigging_instructions: 'Plain jig tipped with a shiner minnow, cast to shallow sand flats and worked back with short hops.',
  bite_detection: 'A tap or the line coming tight as the fish moves off.', hookset_fight: 'Firm sweep-set once weight is felt.',
  works_when: 'Early spring, water still cold, walleye concentrated on shallow sand flats feeding on shiner schools.',
  fails_when: 'Once water warms past the spring window and fish disperse to deeper structure -- see the summer slip-sinker tactic instead.',
  diagnostic_signals: 'No fish located after working several flats -- fish may have already moved, try deeper adjacent structure.',
  environment_applicability: envAll({ shore: 'primary', wading: 'primary', boat: 'primary', dock: 'limited' }),
  geographic_applicability: 'MN_WI',
  buildEvidence: (id, equipment) => {
    const howtoFlats = ext('walleye_howto', 'tactic', id, 'works_when', 'DNR: in spring, walleye are commonly concentrated in near-shore locations, especially big sand flats, feeding on schools of shiner minnows.', 'Seasonal-location section');
    const bioSpawnTemp = ext('walleye_biology', 'tactic', id, 'applies_when.season.water_temp_f', 'DNR: "Spawning reaches its peak when water temperature ranges from 42 to 50 degrees."', 'Spawning biology section');
    const wiSpawnTemp = ext('walleye_wi_dnr', 'tactic', id, 'applies_when.season.water_temp_f', 'Wisconsin DNR (a genuinely different organization from Minnesota DNR): "Walleye spawning ordinarily reaches a peak when water temperatures are 42 - 50ºF," and "the spawning migration of walleye begins soon after the ice goes out, at water temperatures of 38 - 44ºF" -- the pre-spawn staging window (38-44F) plus peak spawn (42-50F) together support this tactic\'s broader 42-55F pre-spawn-through-spawn range.', 'Spawning section');
    const bioSpawnDepth = ext('walleye_biology', 'tactic', id, 'applies_when.depth_ft', 'DNR: "Walleye spawn over rock, rubble, gravel and similar substrate in rivers or windswept shallows in water 1 to 6 feet deep."', 'Spawning biology section');
    const bioSeasonalMove = ext('walleye_howto', 'tactic', id, 'fails_when', 'DNR: as the open-water season progresses walleye move to deeper water offshore -- the shallow spring pattern does not hold once this shift begins.', 'Seasonal-location section');
    return [
      derived('tactic', id, 'works_when', [howtoFlats, bioSpawnTemp], 'DNR\'s technique page independently places walleye on shallow sand flats in spring feeding on shiners; DNR\'s biology page independently states spawning peaks 42-50F. Two different DNR pages corroborating the same seasonal/location pattern from different angles.'),
      derived('tactic', id, 'applies_when.season.water_temp_f', [bioSpawnTemp, wiSpawnTemp], 'Minnesota DNR and Wisconsin DNR -- two GENUINELY independent state agencies -- both independently state the identical 42-50F peak-spawn figure; Wisconsin DNR additionally gives a pre-spawn staging figure (38-44F) that this tactic\'s broader 42-55F range is consistent with. Real independent corroboration, not two pages from one organization.'),
      bioSpawnDepth,
      derived('tactic', id, 'fails_when', [bioSeasonalMove], 'Directly follows from DNR\'s own stated seasonal shift to deeper water as the season progresses.'),
      derived('tactic', id, 'applies_when.water_environment', [bioSpawnDepth], 'The same DNR sentence already cited for depth ("rivers or windswept shallows") names BOTH a river setting and a wind-exposed shallow-lake setting as real walleye spawning habitat -- water_environment=[natural_lake, reservoir_flowage] uses the lake half of that same DNR statement (the river half is what t6 uses for its own, separately-modeled river tactic).'),
      derived('tactic', id, 'applies_when.season.biological_stage', [howtoFlats, bioSpawnTemp], 'DNR\'s technique page places this pattern in "spring" specifically as spawning approaches (shallow, feeding on shiners); DNR\'s biology page states spawning peaks 42-50F. Together they support pre_spawn/staging rather than active spawn itself (spawning fish stage on shallow gravel/rock structure, not open sand flats away from spawning substrate) -- biological_stage=pre_spawn follows from the same cited material already used for works_when/temperature, not a new independent fact.'),
      derived('tactic', id, 'applies_when.structure', [howtoFlats], 'DNR\'s own works_when citation names "big sand flats" explicitly -- structure=[flat] is the same fact already cited for works_when, not a separate claim.'),
      derived('tactic', id, 'applies_when.platform', [howtoFlats], 'DNR describes these as "near-shore" flats -- a shallow, near-shore sand flat is physically reachable by wading, shore-casting, or a shallow-draft boat; platform=[shore, wading, boat] follows from the same near-shore/shallow location fact already cited for works_when, an access-logic derivation, not an independently researched platform fact.'),
      gap('tactic', id, 'applies_when.current', 'Not actually derivable from the flats/lake claims already cited -- a natural_lake flat can have real wind-driven current; "none" would be an unsupported assumption, left as an honest gap rather than assumed.'),
      ...equipmentDerivation(id, equipment),
      ext('jig_cadence_convergence', 'tactic', id, 'retrieve.pause_seconds', 'Convergent finding across multiple independent, established angling-education publications (accessed via search-index synthesis, primary full-text blocked/403): standard lift-hop jig cadences use roughly a 2-5 second pause at the bottom of the lift, where most strikes occur. This tactic\'s own 1-2s stated range is at the SHORT end of that convergent range, not a verbatim match -- a real but imprecise source, not a directly quoted number.', 'Cross-publication synthesis (indirect access)', 'anecdotal'),
      gap('tactic', id, 'rigging_instructions', 'Jig-and-minnow is standard technique for presenting bait to shallow-feeding walleye; DNR describes the seasonal location and forage, not this exact rig -- the rig itself is practitioner knowledge, not DNR-stated.'),
    ];
  },
});

// 2. Summer deep structure slip-sinker -- walleye, boat only
const t2 = makeTactic({
  speciesKeys: ['species:sander-vitreus'], presentationSlug: 'slip-sinker-livebait-rig',
  applies_when: {
    platform: con('constrained', ['boat']), water_environment: con('constrained', ['natural_lake', 'reservoir_flowage']),
    season: { biological_stage: con('constrained', 'mid_summer'), calendar_range: con('constrained', { start_month_day: '06-20', end_month_day: '08-31', varies_by_latitude: true }), water_temp_f: con('constrained', range(65, 78, 'F', 'general')) },
    depth_ft: con('constrained', range(15, 30, 'ft', 'general')), structure: con('constrained', ['hump', 'flat']), substrate: con('constrained', ['mud', 'sand']),
    current: con('constrained', 'none'), clarity: con('constrained', 'clear'),
  },
  equipment: { rod_power: 'medium_light', rod_action: 'fast', reel_type: 'spinning', line_test_lb: range(6, 10, 'lb'), leader: { material: 'fluorocarbon', length_in: range(24, 36, 'in') }, lure_weight_oz: range(0.5, 1, 'oz'), hook_size: '1/0-3/0 octopus or circle' },
  bait_composition: bc('live_bait_only', ['live_minnow', 'live_nightcrawler', 'live_leech']), presentation_method_tags: ['still_fishing'],
  retrieve: { speed: 'very_slow', cadence: 'slow drag, brief pauses', pause_seconds: range(3, 8, 's'), depth_control: 'lightest sinker that holds bottom', rod_position: 'tip low, feed slack on the take' },
  rigging_instructions: 'Slip sinker above a swivel, fluorocarbon leader to a hook baited with minnow, nightcrawler, or leech, dragged near bottom on humps/flats.',
  bite_detection: 'Light taps or steady building pressure.', hookset_fight: 'Feed slack, then sweep-set into steady pressure.',
  works_when: 'Mid-summer, warm stable water, fish holding on deep mid-lake structure.',
  fails_when: 'Cold water or real current -- too subtle/slow to hold position or register a bite.',
  diagnostic_signals: 'No contact after working 3-4 distinct structure spots thoroughly.',
  environment_applicability: envAll({ boat: 'primary', kayak: 'viable', canoe: 'viable', shore: 'limited' }),
  conservation_notes: 'Fish from deep water (DNR discusses moderate-to-severe barotrauma risk emerging around ~30ft for the species DNR gives exact numbers for) may show barotrauma signs -- bulging eyes, bleeding gills, gas bubbles, an inability to stay upright; walleye are physoclistous and DNR states they are MORE susceptible than average, but DNR does not give a walleye-specific depth number. If a fish shows severe signs, DNR states it is preferable to keep it (it remains safe to eat) rather than attempt a release likely to fail.',
  geographic_applicability: 'MN_WI',
  buildEvidence: (id, equipment) => {
    const howtoSummer = ext('walleye_howto', 'tactic', id, 'works_when', 'DNR: as the season progresses, walleye move to deep water further offshore, found on mid-lake structure like humps, saddles, and points; a slip-sinker (Lindy-style) rig is described as a common mid-summer technique.', 'Seasonal-location / technique section');
    const howtoRig = ext('walleye_howto', 'tactic', id, 'rigging_instructions', 'DNR describes the slip-sinker rig presenting minnow/crawler/leech near bottom.', 'Technique section');
    const bioSummerDeep = ext('walleye_biology', 'tactic', id, 'applies_when.depth_ft', 'DNR: "walleye commonly spend more time in deep, cool water, away from bright light" during summer as forage matures -- no exact foot figure given, general depth range only.', 'Seasonal distribution section');
    const barotrauma = ext('barotrauma_dnr', 'tactic', id, 'conservation_notes', 'DNR: barotrauma symptoms are "bulging eyes, bleeding gills, gas bubbles under the skin or an expanded swim bladder"; moderate-to-severe effects are discussed around ~30ft depth (exact numbers given for crappie, not walleye specifically); walleye are physoclistous and DNR states this makes them "more susceptible to some barotrauma effects" than physostomous fish; DNR recommends keeping (not releasing) a fish showing severe signs, noting it remains safe to eat.', 'Barotrauma page body');
    return [
      howtoSummer, howtoRig, barotrauma,
      derived('tactic', id, 'applies_when.depth_ft', [bioSummerDeep], 'DNR biology page confirms the qualitative pattern (deep, cool, low-light water in summer) but states no exact depth figure -- the 15-30ft range here is a general estimate consistent with, but not directly quoted from, that qualitative statement.'),
      derived('tactic', id, 'fails_when', [howtoSummer], 'Inverse of the DNR-documented mid-summer deep-structure pattern: cold water or current would put fish somewhere other than the deep, stable-water structure this rig targets.'),
      gap('tactic', id, 'applies_when.season.water_temp_f', 'No fetched source states an exact mid-summer water-temperature range; 65-78F is a general mid-summer estimate, not DNR-quoted.'),
      derived('tactic', id, 'applies_when.water_environment', [howtoSummer], 'DNR describes this pattern on "mid-lake structure" -- a lake-specific setting; water_environment=[natural_lake, reservoir_flowage] follows from the same works_when citation, river settings are excluded since DNR does not describe this mid-summer offshore pattern for rivers.'),
      derived('tactic', id, 'applies_when.season.biological_stage', [howtoSummer], 'DNR\'s own works_when citation is explicitly about "as the season progresses" into deep-water summer holding -- biological_stage=mid_summer follows directly from the same seasonal-progression fact already cited for works_when/depth.'),
      derived('tactic', id, 'applies_when.structure', [howtoSummer], 'DNR names "humps, saddles, and points" explicitly. This tactic\'s structure=[hump, flat]: "hump" is a direct match; "flat" is NOT explicitly named by DNR (a related mid-lake deep-structure type commonly fished the same way, but not itself DNR-stated) -- partial support, flagged rather than silently treated as fully sourced.'),
      derived('tactic', id, 'applies_when.current', [howtoSummer], 'DNR frames this as a stillwater, mid-lake-structure pattern (distinct from river current-seam tactics like t6/t10/t14) -- current=none follows from the same lake/offshore-structure premise already cited, an inference from setting rather than a direct DNR statement about current specifically.'),
      derived('tactic', id, 'applies_when.platform', [howtoSummer], 'DNR describes deep, offshore, mid-lake structure -- reaching 15-30ft of water well offshore requires a boat; platform=[boat] follows from the same offshore-structure fact already cited for works_when/depth, an access-logic derivation.'),
      ...equipmentDerivation(id, equipment), GAP_TACKLE(id, 'retrieve.pause_seconds'),
    ];
  },
});

// 3. Fall shallow crankbait -- walleye, boat/kayak
const t3 = makeTactic({
  speciesKeys: ['species:sander-vitreus'], presentationSlug: 'shallow-crankbait',
  applies_when: {
    platform: con('constrained', ['boat', 'kayak']), water_environment: con('constrained', ['natural_lake', 'reservoir_flowage']),
    season: { biological_stage: con('constrained', 'fall_turnover'), calendar_range: con('constrained', { start_month_day: '09-15', end_month_day: '10-31', varies_by_latitude: true }), water_temp_f: con('constrained', range(48, 62, 'F', 'general')) },
    depth_ft: con('constrained', range(3, 10, 'ft', 'general')), structure: con('constrained', ['point', 'channel_edge']), cover: con('constrained', ['vegetation']), substrate: con('constrained', ['gravel']),
    current: con('constrained', 'none'), clarity: con('constrained', 'stained'), light: con('constrained', 'low'),
  },
  equipment: { rod_power: 'medium', rod_action: 'moderate', reel_type: 'either', line_test_lb: range(8, 12, 'lb'), leader: null, lure_weight_oz: range(0.25, 0.5, 'oz'), hook_size: null },
  bait_composition: bc('artificial_only', ['artificial_lure']), presentation_method_tags: ['casting', 'trolling'],
  retrieve: { speed: 'moderate', cadence: 'steady, no pause', pause_seconds: range(0, 0, 's', 'general'), depth_control: 'small perch-pattern crank run near bottom over the target depth', rod_position: 'tip up' },
  rigging_instructions: 'Small hard-bodied crankbait resembling perch, cast or trolled along shoreline structure.',
  bite_detection: 'A hard strike, rod loads immediately.', hookset_fight: 'Let the fish load a moderate-action rod; no manual hookset usually needed.',
  works_when: 'Early-mid fall as walleye return to shoreline structure; low light/chop improves it.',
  fails_when: 'Bright, calm, clear conditions in the same season make the same shallow presentation too visible.',
  diagnostic_signals: 'Follows or short strikes without hookup -- slow down or downsize before abandoning the pattern.',
  environment_applicability: envAll({ boat: 'primary', kayak: 'viable' }),
  geographic_applicability: 'MN_WI',
  buildEvidence: (id, equipment) => {
    const howtoFall = ext('walleye_howto', 'tactic', id, 'works_when', 'DNR: in late summer/early fall walleye gradually move back to shoreline locations; trolling/casting hard plastic baits near shallow weedlines, gravel bars, and points is a recommended fall technique.', 'Seasonal-location / technique section');
    const howtoRig = ext('walleye_howto', 'tactic', id, 'rigging_instructions', 'DNR describes trolling or casting small hard plastic baits resembling perch/small prey fish.', 'Technique section');
    const bioTurbidity = ext('walleye_biology', 'tactic', id, 'fails_when', 'DNR: "Walleye remain more active throughout the day if turbidity, wave chop or clouds reduce brightness" -- the converse (bright/calm/clear) implies reduced daytime shallow activity/increased wariness.', 'Turbidity-preference section');
    const wiTurbidity = ext('walleye_wi_dnr', 'tactic', id, 'fails_when', 'Wisconsin DNR (a genuinely different organization from Minnesota DNR): "In clear waters, walleyes usually stay in deeper areas during the day, moving into the shallows at night," while "in more turbid waters, they can be caught throughout the day." Independently corroborates that bright/clear conditions push walleye away from the shallow presentation this tactic relies on.', 'Habitat/behavior section');
    // gate-6 fix: this is a COMPARATIVE EFFECTIVENESS claim (which lure color outperforms which
    // under which clarity), which the user's taxonomy places under external_evidence_required
    // (works_when/fails_when), NOT under the intrinsic rigging_instructions field -- moved here
    // from gate 5, where it was miscategorized and so silently stopped counting toward
    // confidence once rigging_instructions became intrinsic. A GENUINELY independent second
    // source (peer-reviewed, not MN DNR) on works_when is what actually earns
    // independently_corroborated, not merely citing two different DNR pages.
    const lureColorStudy = ext('lure_color_turbidity_paper', 'tactic', id, 'works_when', 'Peer-reviewed (Journal of Great Lakes Research, citizen-science + controlled experiment): lure color success shifts with water clarity type for walleye -- white performed best in clear water, gold/yellow in sedimentary turbidity, black in algal turbidity; walleye showed no strong color preference in clear water in the controlled experiment specifically. Accessed via search-index synthesis of the abstract/findings -- the ScienceDirect and NOAA repository full-text pages returned 403 on direct fetch this session, so this is NOT a directly quoted excerpt; findings cross-confirmed across 3 independent search results converging on the same specific color-by-turbidity-type pattern.', 'Abstract/findings (indirect access -- see note)', 'peer_review_supported');
    return [
      derived('tactic', id, 'works_when', [howtoFall, lureColorStudy], 'DNR (Minnesota DNR) independently documents the fall shoreline-return location/timing; the peer-reviewed lure-color study (Journal of Great Lakes Research, a genuinely different organization) independently documents that a stained/turbid presentation benefits from gold/yellow lure color specifically -- this tactic\'s own low-light/chop qualifier is directionally consistent with, though not a verbatim match for, the paper\'s sedimentary-turbidity finding. Two different organizations, real corroboration of the general premise (clarity affects which presentation/color wins here), not of one identical sentence.'),
      howtoRig,
      derived('tactic', id, 'fails_when', [bioTurbidity, wiTurbidity], 'Minnesota DNR states walleye stay MORE active in low-brightness (turbid/chop/cloud) conditions; Wisconsin DNR -- a genuinely different organization -- independently confirms walleye "usually stay in deeper areas during the day" in clear water but "can be caught throughout the day" in turbid water. Two independent state agencies corroborating the same clarity-driven behavior pattern; the direct converse for THIS shallow presentation (bright/clear reduces its effectiveness) is inferred from that corroborated pattern, not itself separately stated by either agency.'),
      gap('tactic', id, 'applies_when.season.water_temp_f', 'No fetched source states an exact fall water-temperature range for this shoreline-return pattern; 48-62F is a general fall-turnover estimate, not DNR-quoted.'),
      gap('tactic', id, 'applies_when.depth_ft', 'No fetched source states an exact fall shallow-return depth range; 3-10ft is a general estimate, not DNR-quoted.'),
      derived('tactic', id, 'applies_when.water_environment', [howtoFall], 'DNR describes walleye returning to "shoreline locations" and fishing "shallow weedlines, gravel bars, points" -- a lake-shoreline setting; water_environment=[natural_lake, reservoir_flowage] follows from the same works_when citation.'),
      derived('tactic', id, 'applies_when.season.biological_stage', [howtoFall], 'DNR\'s own works_when citation explicitly frames this as "late summer/early fall" -- biological_stage=fall_turnover follows directly from the same seasonal fact already cited for works_when.'),
      derived('tactic', id, 'applies_when.structure', [howtoFall], 'DNR names "shallow weedlines, gravel bars, points" -- "point" is a direct match for this tactic\'s structure=[point, channel_edge]; "channel_edge" is NOT explicitly named by DNR (a related shoreline-drop-off structure type, not itself DNR-stated) -- partial support, flagged rather than silently treated as fully sourced.'),
      derived('tactic', id, 'applies_when.cover', [howtoFall], 'DNR explicitly names "shallow weedlines" -- cover=[vegetation] is a direct match for the same works_when citation.'),
      derived('tactic', id, 'applies_when.current', [howtoFall], 'DNR frames this as a lake-shoreline pattern (not a river current-seam tactic) -- current=none follows from the same lake/shoreline-structure premise already cited, an inference from setting rather than a direct DNR statement about current specifically.'),
      derived('tactic', id, 'applies_when.platform', [howtoFall], 'DNR describes trolling/casting along shoreline structure -- reachable by boat, and shallow enough (3-10ft) for a kayak; platform=[boat, kayak] follows from the same shoreline-structure fact already cited, an access-logic derivation.'),
      ...equipmentDerivation(id, equipment), GAP_TACKLE(id, 'retrieve.pause_seconds'),
    ];
  },
  alternatives: [{ related_tactic_id: t2.id, relationship_type: 'alternative', note: 'Genuinely different seasonal pattern (fall shallow vs. summer deep); not a same-conditions disagreement.' }],
});

// 4 & 5. ICE: aggressive jigging spoon vs. near-motionless minnow-head jig -- THE GENUINE CONFLICT, sourced to the DNR page's own acknowledged uncertainty.
const commonIceConditions = {
  platform: con('constrained', ['ice']), water_environment: con('constrained', ['natural_lake']),
  season: { biological_stage: con('constrained', 'midwinter_ice'), calendar_range: con('constrained', { start_month_day: '01-05', end_month_day: '02-15', varies_by_latitude: true }), water_temp_f: con('constrained', range(34, 39, 'F', 'general')) },
  depth_ft: con('constrained', range(15, 25, 'ft', 'general')), structure: con('constrained', ['hump', 'basin']), substrate: con('unconstrained'),
  clarity: con('constrained', 'clear'), current: con('constrained', 'none'),
};
const t4 = makeTactic({
  speciesKeys: ['species:sander-vitreus'], presentationSlug: 'jigging-spoon-aggressive',
  applies_when: commonIceConditions,
  equipment: { rod_power: 'medium_light', rod_action: 'fast', reel_type: 'spinning', line_test_lb: range(6, 8, 'lb'), leader: null, lure_weight_oz: range(0.25, 0.5, 'oz'), hook_size: null },
  bait_composition: bc('hybrid_bait_and_artificial', ['artificial_lure', 'live_other']), presentation_method_tags: ['jigging', 'vertical_jigging'],
  retrieve: { speed: 'fast', cadence: 'sharp upward snaps with a flutter on the fall, occasionally slapping bottom to create a sediment plume', pause_seconds: range(1, 3, 's'), depth_control: 'work within a few feet of bottom', rod_position: 'active, high hand position between snaps' },
  rigging_instructions: 'Flashy fluttering jigging spoon, worked aggressively near bottom; can be fished bare or tipped with a waxworm/minnow head.',
  bite_detection: 'A sudden stop on the fall or a hard thump on the upstroke.', hookset_fight: 'Sharp upward set on any unnatural weight or stop.',
  works_when: 'Midwinter, clear water, over deep structure, when fish are actively responding to flash/vibration and reaction strikes.',
  fails_when: 'When fish are neutral/inactive and spook from or ignore aggressive movement -- see the deadstick alternative.',
  diagnostic_signals: 'Fish marked on electronics but not committing to the aggressive presentation -- switch to the subtler deadstick tactic rather than continuing to work it harder.',
  environment_applicability: envAll({ ice: 'primary' }),
  geographic_applicability: 'MN_WI',
  buildEvidence: (id, equipment) => {
    const iceRig = ext('walleye_ice', 'tactic', id, 'rigging_instructions', 'DNR: jigging spoons create more sound/flash and can be used with or without live bait; some anglers drop the lure to bottom to create a sediment plume that may attract walleye.', 'Lure-selection section');
    const iceWorks = ext('walleye_ice', 'tactic', id, 'works_when', 'DNR explicitly frames this as one of two genuinely competing approaches ("sometimes a thin flashy fluttering spoon is the ticket") without declaring one universally superior.', 'Lure-selection section', undefined, 'MN_WI');
    const winterTemp = ext('winter_limnology', 'tactic', id, 'applies_when.season.water_temp_f', 'Basic winter limnology (NOT a walleye-specific source -- cited only for the physical water-temperature fact): under ice, surface water is near 32F and the water column is capped at "4 degrees Celsius (39.2 degrees Fahrenheit), the temperature at which water is most dense" -- this tactic\'s 34-39F midwinter range is physically consistent with the real, universal under-ice thermal-stratification range, not an invented number.', 'Article body', 'expert_synthesis');
    return [
      iceRig, iceWorks,
      gap('tactic', id, 'fails_when', 'DNR states the spoon and deadstick approaches compete but does not itself state a diagnostic failure condition for the spoon side beyond "sometimes... sometimes" -- the "neutral/inactive fish" framing here is practitioner inference, not DNR-quoted.'),
      winterTemp,
      gap('tactic', id, 'applies_when.depth_ft', 'DNR does not state an exact depth range for this structure type; 15-25ft is a general midwinter-structure estimate, not DNR-quoted.'),
      derived('tactic', id, 'applies_when.water_environment', [iceWorks], 'DNR\'s ice-fishing page is specifically about lake ice fishing; water_environment=[natural_lake] follows from the same page\'s subject matter already cited for works_when.'),
      derived('tactic', id, 'applies_when.structure', [iceWorks], 'DNR discusses fishing "deep structure" under ice generally, consistent with this tactic\'s structure=[hump, basin], though DNR does not name these exact structure types -- a general, not verbatim, match.'),
      derived('tactic', id, 'applies_when.current', [iceWorks], 'Ice-covered lake water under a stable ice sheet is not current-driven; current=none follows from the same lake/ice setting already cited for works_when, a physical inference from setting.'),
      derived('tactic', id, 'applies_when.platform', [iceWorks], 'DNR\'s page is specifically about ICE fishing technique; platform=[ice] follows directly from the same page\'s subject matter already cited for works_when/rigging.'),
      ...equipmentDerivation(id, equipment), GAP_TACKLE(id, 'retrieve.pause_seconds'),
    ];
  },
});
const t5 = makeTactic({
  speciesKeys: ['species:sander-vitreus'], presentationSlug: 'jig-minnow-head-deadstick',
  applies_when: commonIceConditions,
  equipment: { rod_power: 'ultralight', rod_action: 'slow', reel_type: 'spinning', line_test_lb: range(4, 6, 'lb'), leader: null, lure_weight_oz: range(0.0625, 0.125, 'oz'), hook_size: null },
  bait_composition: bc('hybrid_bait_and_artificial', ['artificial_lure', 'live_minnow']), presentation_method_tags: ['jigging'],
  retrieve: { speed: 'dead_still', cadence: 'virtually motionless, occasional tiny lift', pause_seconds: range(10, 30, 's'), depth_control: 'held just above bottom or at the marked fish depth', rod_position: 'resting, minimal movement' },
  rigging_instructions: 'Small jig in a minnow shape/color tipped with a minnow head, held nearly still at the fish\'s depth.',
  bite_detection: 'Very subtle -- a slight line twitch or the bobber/spring bobber loading almost imperceptibly.', hookset_fight: 'A gentle, deliberate lift rather than a hard snap -- an aggressive set can pull the bait from a light-biting fish.',
  works_when: 'Midwinter, clear water, when fish are neutral/inactive or have been pressured and shy away from aggressive movement.',
  fails_when: 'When fish are actively feeding and a subtler presentation gets outcompeted or simply not noticed -- see the aggressive spoon alternative.',
  diagnostic_signals: 'Fish approach on electronics but do not commit -- if this ALSO fails to draw a take within a reasonable window, try the aggressive spoon instead (and vice versa); the DNR itself does not resolve which comes first.',
  environment_applicability: envAll({ ice: 'primary' }),
  geographic_applicability: 'MN_WI',
  buildEvidence: (id, equipment) => {
    const iceRig = ext('walleye_ice', 'tactic', id, 'rigging_instructions', 'DNR: "other times a virtually motionless jig in the shape and color of a minnow works the best."', 'Lure-selection section');
    const iceWorks = ext('walleye_ice', 'tactic', id, 'works_when', 'DNR presents this as the genuine alternative to the aggressive-spoon approach, not a fallback -- explicitly recommends experimenting to discover what works best on a given day.', 'Lure-selection section');
    const winterTemp = ext('winter_limnology', 'tactic', id, 'applies_when.season.water_temp_f', 'Basic winter limnology (NOT a walleye-specific source -- cited only for the physical water-temperature fact): under ice, the water column is capped at "4 degrees Celsius (39.2 degrees Fahrenheit), the temperature at which water is most dense" -- this tactic\'s 34-39F midwinter range is physically consistent with the real under-ice thermal-stratification range, not an invented number.', 'Article body', 'expert_synthesis');
    return [
      iceRig, iceWorks,
      gap('tactic', id, 'fails_when', 'DNR frames the two approaches as alternatives without stating a specific failure condition for the deadstick side beyond the general "experiment to see what works" framing -- practitioner inference here, not DNR-quoted.'),
      winterTemp,
      gap('tactic', id, 'applies_when.depth_ft', 'DNR does not state an exact depth range for this structure type; 15-25ft is a general midwinter-structure estimate, not DNR-quoted.'),
      derived('tactic', id, 'applies_when.water_environment', [iceWorks], 'DNR\'s ice-fishing page is specifically about lake ice fishing; water_environment=[natural_lake] follows from the same page\'s subject matter already cited for works_when.'),
      derived('tactic', id, 'applies_when.structure', [iceWorks], 'DNR discusses fishing deep structure under ice generally, consistent with this tactic\'s structure=[hump, basin], though DNR does not name these exact structure types -- a general, not verbatim, match.'),
      derived('tactic', id, 'applies_when.current', [iceWorks], 'Ice-covered lake water under a stable ice sheet is not current-driven; current=none follows from the same lake/ice setting already cited for works_when.'),
      derived('tactic', id, 'applies_when.platform', [iceWorks], 'DNR\'s page is specifically about ICE fishing technique; platform=[ice] follows directly from the same page\'s subject matter already cited.'),
      ...equipmentDerivation(id, equipment),
      gap('tactic', id, 'retrieve.pause_seconds', 'DNR does not give an exact pause duration for a near-motionless presentation; the 10-30s range is an illustrative estimate only.'),
    ];
  },
});
// The genuine conflict, both directions, both citing the SAME DNR source's own acknowledged uncertainty -- not invented, not resolved falsely either way:
t4.alternatives.push({ related_tactic_id: t5.id, relationship_type: 'conflicts_with', note: 'DNR\'s own ice-fishing-walleye page explicitly frames aggressive jigging-spoon action and a near-motionless minnow-head jig as competing approaches under the SAME conditions (same water, same depth, same time of year) without declaring either universally correct -- a genuine, sourced disagreement, not a condition-window difference.' });
t5.alternatives.push({ related_tactic_id: t4.id, relationship_type: 'conflicts_with', note: 'Same genuine disagreement, other direction -- see t4\'s note.' });

// 6. River current jig+minnow -- walleye AND sauger, pre-spawn/fall current
const t6 = makeTactic({
  speciesKeys: ['species:sander-vitreus', 'species:sander-canadensis'], presentationSlug: 'jig-minnow',
  applies_when: {
    platform: con('constrained', ['shore', 'wading', 'boat']), water_environment: con('constrained', ['river', 'tributary']),
    season: { biological_stage: con('constrained', 'pre_spawn'), calendar_range: con('constrained', { start_month_day: '03-15', end_month_day: '04-30', varies_by_latitude: true }), water_temp_f: con('constrained', range(38, 52, 'F', 'general')) },
    depth_ft: con('constrained', range(4, 14, 'ft', 'general')), structure: con('constrained', ['current_seam', 'channel_edge']),
    current: con('constrained', 'moderate'), clarity: con('constrained', 'stained'),
  },
  equipment: { rod_power: 'medium_light', rod_action: 'fast', reel_type: 'spinning', line_test_lb: range(8, 10, 'lb'), leader: null, lure_weight_oz: range(0.125, 0.375, 'oz'), hook_size: '#2-1/0 jig' },
  bait_composition: bc('live_bait_only', ['live_minnow']), presentation_method_tags: ['casting'],
  retrieve: { speed: 'slow', cadence: 'lift-drop, maintain bottom contact between lifts', pause_seconds: range(1, 3, 's'), depth_control: 'count down to bottom, lift just clear then settle', rod_position: 'tip low, 45 degrees' },
  rigging_instructions: 'Jig tied direct, tipped with a minnow, cast upstream/across current seams and worked back with bottom-contact hops.',
  bite_detection: 'A tap, sudden slack, extra weight, or the line moving differently from the current.', hookset_fight: 'Sweep-set on any contact -- current fish often only tap once.',
  works_when: 'Pre-spawn river/tributary staging, moderate current, walleye and sauger holding on seams and channel edges.',
  fails_when: 'Once fish move onto true spawning gravel (different, more localized behavior) or in dead-still water with no seam to define.',
  diagnostic_signals: 'No contact after working 3-4 current seams at the right depth/pace -- try a heavier jig to hold bottom better, or relocate to the next seam downstream.',
  environment_applicability: envAll({ shore: 'primary', wading: 'primary', boat: 'primary' }),
  geographic_applicability: 'MN_WI',
  buildEvidence: (id, equipment) => {
    const bioSpawnRivers = ext('walleye_biology', 'tactic', id, 'works_when', 'DNR: "Walleye spawn over rock, rubble, gravel and similar substrate in rivers or windswept shallows" -- establishes river/current-seam staging as real walleye behavior.', 'Spawning biology section');
    const saugerSpawnTiming = ext('sauger_mcv', 'tactic', id, 'works_when', 'DNR (Minnesota Conservation Volunteer): "Spawning occurs in spring, typically just after the walleye spawn and in slightly deeper water" -- confirms sauger co-occur with walleye in the same river staging areas on a slightly offset schedule/depth.', 'Life-cycle section');
    // gate-5 fix: bioSpawnRivers + saugerSpawnTiming are BOTH "Minnesota DNR" -- same organization,
    // NOT independent, regardless of being two different pages (the exact gate-4 mislabeling this
    // pass corrects). haxtonRainyRiver is genuinely independent (peer-reviewed, Journal of Fish
    // Biology, a different organization entirely) and studies the Rainy River specifically.
    const haxtonRainyRiver = ext('haxton_2019', 'tactic', id, 'works_when', 'Peer-reviewed (Haxton et al. 2019, J. Fish Biology, Rainy River -- a real MN/Ontario border water): sauger and walleye co-occur in this shallow river, with sauger actually dominating more river area (24%) than walleye (12%) in the study reach; the two species show an "inability to segregate by depth within the river," with turbidity (not depth) the likely mechanism allowing coexistence.', 'Abstract, fetched directly');
    const wiSpawnStaging = ext('walleye_wi_dnr', 'tactic', id, 'applies_when.season.water_temp_f', 'Wisconsin DNR (a genuinely different organization from Minnesota DNR): "the spawning migration of walleye begins soon after the ice goes out, at water temperatures of 38 - 44ºF," peaking at 42-50F.', 'Spawning section');
    return [
      derived('tactic', id, 'works_when', [bioSpawnRivers, saugerSpawnTiming, haxtonRainyRiver], 'The two DNR claims (walleye spawning-substrate location, sauger spawning timing/depth) are the SAME organization and do not corroborate each other independently. Haxton et al. 2019 (peer-reviewed, a genuinely different organization) independently confirms the underlying premise that sauger and walleye co-occur in the same river reaches -- this is real, if partial, independent corroboration for the joint-species river premise specifically, not for the exact pre-spawn timing/current-seam details, which remain DNR-only.'),
      gap('tactic', id, 'fails_when', 'No fetched source states this specific transition point (fish moving onto spawning gravel); practitioner inference from the general spawning-timeline facts above, not itself DNR-quoted.'),
      derived('tactic', id, 'applies_when.season.water_temp_f', [wiSpawnStaging], 'Wisconsin DNR\'s 38-44F pre-spawn migration-onset figure directly supports the cold end of this tactic\'s 38-52F pre-spawn river-staging range; the warm end is consistent with (though not verbatim from) the peak-spawn 42-50F figure both MN and WI DNR independently state.'),
      derived('tactic', id, 'applies_when.water_environment', [bioSpawnRivers, haxtonRainyRiver], 'DNR\'s biology page names "rivers" explicitly as walleye spawning habitat; Haxton et al. (peer-reviewed, independent org) directly studies a river (the Rainy River) for exactly this species pairing -- water_environment=[river, tributary] is doubly, independently supported.'),
      derived('tactic', id, 'applies_when.structure', [haxtonRainyRiver], 'Haxton et al. studies river-channel habitat use directly; structure=[current_seam, channel_edge] is consistent with the river-channel setting the paper examines, though it does not name these exact structure-type labels.'),
      derived('tactic', id, 'applies_when.current', [haxtonRainyRiver], 'Haxton et al. explicitly discusses current/turbidity as the mechanism enabling species coexistence in this river -- current=moderate follows from the same river-current premise already cited for works_when.'),
      derived('tactic', id, 'applies_when.platform', [bioSpawnRivers], 'River current-seam staging areas near shore/tributary mouths are reachable by shore-casting, wading, or boat; platform=[shore, wading, boat] follows from the same river-staging premise already cited for works_when.'),
      derived('tactic', id, 'applies_when.season.biological_stage', [wiSpawnStaging], 'Wisconsin DNR\'s own figure is explicitly for the "spawning migration" -- the PRE-spawn staging phase before fish reach spawning gravel itself; biological_stage=pre_spawn follows directly from the same migration-timing fact already cited for water_temp_f.'),
      gap('tactic', id, 'rigging_instructions', 'Standard river jig-and-minnow presentation for both species; not a specific DNR-described rig.'),
      gap('tactic', id, 'applies_when.depth_ft', 'No fetched source gives an exact current-seam depth range; 4-14ft is a general estimate, not DNR-quoted.'),
      ...equipmentDerivation(id, equipment),
      ext('jig_cadence_convergence', 'tactic', id, 'retrieve.pause_seconds', 'Convergent finding across multiple independent, established angling-education publications (search-index synthesis, primary full-text blocked/403): standard lift-hop jig cadences use roughly a 2-5 second pause. This tactic\'s own 1-3s stated range overlaps the short end of that convergent range.', 'Cross-publication synthesis (indirect access)', 'anecdotal'),
    ];
  },
});

// 7. Dock/shore slip bobber livebait -- walleye, summer, dock applicability
const t7 = makeTactic({
  speciesKeys: ['species:sander-vitreus'], presentationSlug: 'slip-bobber-livebait',
  applies_when: {
    platform: con('constrained', ['dock', 'shore']), water_environment: con('constrained', ['natural_lake']),
    season: { biological_stage: con('constrained', 'early_summer'), calendar_range: con('constrained', { start_month_day: '06-01', end_month_day: '07-15', varies_by_latitude: true }), water_temp_f: con('constrained', range(60, 70, 'F', 'general')) },
    depth_ft: con('constrained', range(6, 14, 'ft', 'general')), structure: con('constrained', ['drop_off']), cover: con('constrained', ['docks']),
    light: con('constrained', 'low'), current: con('constrained', 'none'),
  },
  equipment: { rod_power: 'light', rod_action: 'moderate', reel_type: 'spinning', line_test_lb: range(6, 8, 'lb'), leader: null, lure_weight_oz: range(0.0625, 0.125, 'oz'), hook_size: '#4-#6' },
  bait_composition: bc('live_bait_only', ['live_minnow', 'live_leech']), presentation_method_tags: ['still_fishing'],
  retrieve: { speed: 'dead_still', cadence: 'suspended, minimal drift', pause_seconds: range(0, 0, 's', 'general'), depth_control: 'set the slip bobber stop to hold bait at the drop-off depth', rod_position: 'resting or hand-held near the dock' },
  rigging_instructions: 'Slip bobber set to depth, small hook with a minnow or leech, suspended near a dock drop-off.',
  bite_detection: 'The bobber goes under or moves off at an angle.', hookset_fight: 'Wait for the bobber to fully submerge before a firm sweep-set.',
  works_when: 'Low light (dawn/dusk), docks adjacent to a drop-off, early summer.',
  fails_when: 'Bright midday light with fish holding deeper off the drop-off, out of easy dock-casting range.',
  diagnostic_signals: 'No action at dawn/dusk after a reasonable wait -- try adjusting depth before abandoning the spot.',
  casting_access_required: 'limited',
  environment_applicability: envAll({ dock: 'primary', shore: 'viable' }),
  geographic_applicability: 'MN_WI',
  buildEvidence: (id, equipment) => {
    const bioLowLight = ext('walleye_biology', 'tactic', id, 'works_when', 'DNR: "They usually feed in shallow water at dawn and dusk" and "with daylight, walleye move into the shadows... lacking this cover, they seek shelter in deeper water" -- directly supports a low-light, drop-off-adjacent presentation.', 'Feeding-behavior section');
    return [
      derived('tactic', id, 'works_when', [bioLowLight], 'DNR biology page directly documents dawn/dusk shallow feeding and a daylight retreat toward cover/deeper water -- this tactic\'s low-light-near-a-drop-off premise follows directly, though the DOCK-specific setting itself is not DNR-stated (practitioner adaptation of the general low-light pattern to dock structure).'),
      derived('tactic', id, 'fails_when', [bioLowLight], 'Direct inverse of the same DNR fact: with daylight, fish retreat from the shallow drop-off edge toward deeper water/cover, out of easy dock-casting range.'),
      gap('tactic', id, 'applies_when.season.water_temp_f', 'No fetched source gives an exact early-summer water-temperature range; 60-70F is a general estimate, not DNR-quoted.'),
      gap('tactic', id, 'applies_when.depth_ft', 'No fetched source gives an exact drop-off depth range for this dock setting; 6-14ft is a general estimate, not DNR-quoted.'),
      gap('tactic', id, 'applies_when.season.biological_stage', 'DNR\'s low-light feeding fact is about the daily cycle, not season -- early_summer is not supported by the same ancestor and no other source was sought this pass.'),
      derived('tactic', id, 'applies_when.water_environment', [bioLowLight], 'A dock is a lake/reservoir-specific structure by definition; water_environment=[natural_lake] follows from the presentation itself, not a new biological fact.'),
      gap('tactic', id, 'applies_when.structure', 'DNR does not name "drop_off" specifically in the low-light feeding citation; left as an honest gap.'),
      gap('tactic', id, 'applies_when.cover', 'DNR does not discuss dock structure at all; "docks" as cover is practitioner knowledge, not DNR-stated.'),
      derived('tactic', id, 'applies_when.current', [bioLowLight], 'A dock in natural_lake water is a stillwater setting by definition of the platform/environment already established; current=none follows from that same setting.'),
      derived('tactic', id, 'applies_when.platform', [bioLowLight], 'A dock is, by definition, fished from the dock itself or adjacent shore; platform=[dock, shore] follows directly from the presentation\'s own structural premise, not a new biological fact.'),
      derived('tactic', id, 'casting_access_required', [bioLowLight], 'A fixed dock structure inherently constrains casting angles (the dock\'s own footprint, pilings, and neighboring docks limit backswing/casting lanes compared to open shore); casting_access_required=limited is a physical/structural inference from the dock platform itself already established, not an independently researched fact.'),
      ...equipmentDerivation(id, equipment), GAP_TACKLE(id, 'retrieve.pause_seconds'),
    ];
  },
});

// 8. Kayak/canoe finesse jig, clear water summer -- walleye
const t8 = makeTactic({
  speciesKeys: ['species:sander-vitreus'], presentationSlug: 'jig-minnow',
  applies_when: {
    platform: con('constrained', ['kayak', 'canoe']), water_environment: con('constrained', ['natural_lake']),
    season: { biological_stage: con('constrained', 'mid_summer'), calendar_range: con('unconstrained'), water_temp_f: con('constrained', range(68, 76, 'F', 'general')) },
    depth_ft: con('constrained', range(8, 16, 'ft', 'general')), structure: con('constrained', ['point']),
    clarity: con('constrained', 'clear'), wind: con('constrained', 'calm'),
  },
  equipment: { rod_power: 'light', rod_action: 'fast', reel_type: 'spinning', line_test_lb: range(4, 6, 'lb'), leader: { material: 'fluorocarbon', length_in: range(18, 24, 'in') }, lure_weight_oz: range(0.0625, 0.125, 'oz'), hook_size: '#4 jig' },
  // gate-4 fix: was ['live_bait','artificial_only','casting'] -- structurally ambiguous, let this survive an
  // artificial_only filter despite "bare or minnow-tipped" rigging. Correct label is hybrid, which the scorer
  // now excludes from strict artificial_only (see scorer.mjs and the bait-constraint test suite).
  bait_composition: bc('hybrid_bait_and_artificial', ['artificial_lure', 'live_minnow']), presentation_method_tags: ['casting'],
  retrieve: { speed: 'very_slow', cadence: 'small, subtle hops', pause_seconds: range(2, 5, 's'), depth_control: 'count down to just above bottom', rod_position: 'low, quiet presentation' },
  rigging_instructions: 'Small light jig (bare or minnow-tipped) fished quietly from a kayak/canoe over a clear-water point, fluorocarbon leader to reduce visibility.',
  bite_detection: 'A subtle tick or the line twitching sideways.', hookset_fight: 'Light, deliberate sweep-set -- light line requires smooth drag use.',
  works_when: 'Clear water, calm conditions, where a quiet low-profile platform and finesse presentation out-fish a noisier boat approach.',
  fails_when: 'Windy/chop conditions where a kayak/canoe becomes difficult to control and hold position on structure -- see the standalone safety-layer note: this tactic record does NOT itself set a wind safety threshold (see design/angling-knowledge-base/v3/safety/README.md).',
  diagnostic_signals: 'Difficulty holding position in wind is itself the signal to switch platforms/tactics, not a bait problem.',
  environment_applicability: envAll({ kayak: 'primary', canoe: 'primary', boat: 'viable' }),
  geographic_applicability: 'MN_WI',
  buildEvidence: (id, equipment) => [
    gap('tactic', id, 'works_when', 'Practitioner observation that a quieter platform can out-produce a noisier one in clear, calm, pressured water; no fetched source states this specifically -- honestly ungrounded beyond general low-light/clear-water wariness facts that do not name platform choice.'),
    gap('tactic', id, 'fails_when', 'Kayak/canoe wind-control limitation is real boating-safety knowledge, not a DNR fishing-technique citation; a numeric wind threshold is deliberately NOT stated here -- see the safety-layer note above and design/angling-knowledge-base/v3/safety/README.md.'),
    gap('tactic', id, 'rigging_instructions', 'Standard light-tackle finesse jig rigging; not itself sourced.'),
    gap('tactic', id, 'applies_when.season.water_temp_f', 'No fetched source states an exact mid-summer clear-water temperature range for this presentation; 68-76F is a general estimate, not DNR-quoted.'),
    gap('tactic', id, 'applies_when.depth_ft', 'No fetched source states an exact point depth range for this presentation; 8-16ft is a general estimate, not DNR-quoted.'),
    ...equipmentDerivation(id, equipment), GAP_TACKLE(id, 'retrieve.pause_seconds'),
  ],
});

// 9. Turbid-water high-contrast approach -- walleye, boat, turbid
const t9 = makeTactic({
  speciesKeys: ['species:sander-vitreus'], presentationSlug: 'crawler-harness-troll',
  applies_when: {
    platform: con('constrained', ['boat']), water_environment: con('constrained', ['natural_lake', 'reservoir_flowage']),
    season: { biological_stage: con('constrained', 'mid_summer'), calendar_range: con('unconstrained'), water_temp_f: con('constrained', range(62, 75, 'F', 'general')) },
    depth_ft: con('constrained', range(10, 20, 'ft', 'general')), structure: con('unconstrained'),
    clarity: con('constrained', 'turbid'), current: con('constrained', 'none'),
  },
  equipment: { rod_power: 'medium', rod_action: 'moderate', reel_type: 'either', line_test_lb: range(10, 14, 'lb'), leader: null, lure_weight_oz: range(0.5, 1, 'oz'), hook_size: '#2-#4 harness' },
  bait_composition: bc('live_bait_only', ['live_nightcrawler']), presentation_method_tags: ['trolling'],
  retrieve: { speed: 'slow', cadence: 'steady troll', pause_seconds: range(0, 0, 's', 'general'), depth_control: 'bottom-bouncer or leadcore to hold near bottom', rod_position: 'rod-holder, steady troll' },
  rigging_instructions: 'Spinner-blade crawler harness trolled behind a bottom-bouncer, high-contrast blade color for turbid water.',
  bite_detection: 'Steady rod-tip load; strikes are usually decisive on a moving bait.', hookset_fight: 'Let the moving bait set the hook; trim speed only after a confirmed hookup pattern emerges.',
  works_when: 'Turbid/stained water where flash and vibration matter more than visual color match, covering water to relocate scattered fish.',
  fails_when: 'Clear water where a more natural, subtler presentation typically outperforms a flashy trolled harness -- see t2\'s slip-sinker live-bait rig instead (next_try).',
  diagnostic_signals: 'No takers after a full pass -- change blade color/size or speed before changing location.',
  environment_applicability: envAll({ boat: 'primary' }),
  geographic_applicability: 'MN_WI',
  buildEvidence: (id, equipment) => {
    const bioTurbidity = ext('walleye_biology', 'tactic', id, 'works_when', 'DNR: "Walleye remain more active throughout the day if turbidity, wave chop or clouds reduce brightness" -- directly supports favoring a high-visibility, flash/vibration-forward presentation when water is turbid.', 'Turbidity-preference section');
    // gate-6 fix: comparative-effectiveness claim moved from the intrinsic rigging_instructions
    // field to works_when (external_evidence_required), matching the user's taxonomy -- see t3's
    // identical fix for the full rationale.
    const lureColorStudy = ext('lure_color_turbidity_paper', 'tactic', id, 'works_when', 'Peer-reviewed: walleye lure-color success shifts by turbidity TYPE -- gold/yellow performed best in sedimentary turbidity specifically (this tactic\'s own text already calls for "high-contrast blade color," directly consistent with, though not a verbatim match for, this finding; the paper does not itself discuss crawler harnesses specifically). Accessed via search-index synthesis, direct full-text fetch blocked (403) -- see the same access-limitation note as on t3.', 'Abstract/findings (indirect access)', 'peer_review_supported');
    const wiTurbidity9 = ext('walleye_wi_dnr', 'tactic', id, 'fails_when', 'Wisconsin DNR (a genuinely different organization from Minnesota DNR): walleye "in more turbid waters... can be caught throughout the day" but "in clear waters... usually stay in deeper areas during the day" -- independently corroborates that clear water reduces this tactic\'s turbidity-dependent advantage.', 'Habitat/behavior section');
    return [
      derived('tactic', id, 'works_when', [bioTurbidity, lureColorStudy], 'DNR (Minnesota DNR) states walleye tolerate/favor more daytime activity in turbid conditions; the peer-reviewed lure-color paper (Journal of Great Lakes Research, a genuinely different organization) independently confirms that gold/yellow lure color specifically outperforms in sedimentary turbidity -- two different organizations, real corroboration of the underlying premise that turbidity favors a high-visibility presentation, though DNR does not itself recommend a crawler harness specifically and the paper does not itself discuss harnesses.'),
      derived('tactic', id, 'fails_when', [bioTurbidity, wiTurbidity9], 'Minnesota DNR and Wisconsin DNR -- two genuinely independent state agencies -- both independently document the same clarity-driven activity pattern; in clear water the flash/vibration advantage this tactic relies on is reduced, favoring a subtler natural presentation instead.'),
      gap('tactic', id, 'applies_when.season.water_temp_f', 'No fetched source states an exact mid-summer turbid-water temperature range; 62-75F is a general estimate, not DNR-quoted.'),
      gap('tactic', id, 'applies_when.depth_ft', 'No fetched source states an exact trolling depth range for turbid conditions; 10-20ft is a general estimate, not DNR-quoted.'),
      derived('tactic', id, 'applies_when.water_environment', [bioTurbidity], 'The DNR turbidity fact is general walleye biology applicable across lake/reservoir settings; water_environment=[natural_lake, reservoir_flowage] is consistent with this tactic\'s boat-trolling premise, an inference from platform/technique rather than a river-specific DNR statement.'),
      derived('tactic', id, 'applies_when.current', [bioTurbidity], 'A trolled presentation covering open water for scattered fish is a stillwater/lake technique (distinct from the current-seam river tactics t6/t10/t14); current=none follows from the same lake-trolling premise already established.'),
      derived('tactic', id, 'applies_when.platform', [bioTurbidity], 'Trolling a crawler harness behind a bottom-bouncer requires a boat by definition of the technique itself; platform=[boat] follows directly from the presentation\'s own mechanics, not a new biological fact.'),
      ...equipmentDerivation(id, equipment), GAP_TACKLE(id, 'retrieve.pause_seconds'),
    ];
  },
  // gate-4 fix: real next_try, not invented -- t2 is the same species, same water_environment set,
  // clear-water-constrained, genuinely subtler live-bait presentation. No new tactic generated.
  alternatives: [{ related_tactic_id: t2.id, relationship_type: 'next_try', note: 'FAILURE HYPOTHESIS: this tactic fails when clarity shifts from turbid to clear because its whole premise -- a flashy, high-vibration, fast-moving harness -- is believed to trade on turbid water\'s reduced visibility; in clear water that same flash/speed is believed to become a wariness trigger rather than an attractant. WHY t2 RESPONDS TO IT: t2 changes exactly the characteristic implicated by that hypothesis -- it swaps a fast trolled artificial-flash presentation for a slow-dragged, natural-scent live-bait rig (minnow/nightcrawler/leech) at a similar depth/temperature band for the same species, i.e. it removes the flash/speed this tactic\'s own fails_when blames, rather than merely being nearby in the condition space. Distinct from this tactic\'s own diagnostic_signals ("no takers after a full pass -- change blade color/size or speed"), which covers within-presentation micro-adjustment while STILL turbid; next_try is reserved for the case where clarity itself has genuinely changed, a different trigger, not a contradiction of the diagnostic guidance.' }],
});

// 10. Sauger deep river hole slip-sinker, turbid/current -- sauger primary
const t10 = makeTactic({
  speciesKeys: ['species:sander-canadensis'], presentationSlug: 'slip-sinker-livebait-rig',
  applies_when: {
    platform: con('constrained', ['boat', 'shore']), water_environment: con('constrained', ['river']),
    season: { biological_stage: con('constrained', 'fall_turnover'), calendar_range: con('constrained', { start_month_day: '10-01', end_month_day: '11-30', varies_by_latitude: true }), water_temp_f: con('constrained', range(40, 55, 'F', 'general')) },
    depth_ft: con('constrained', range(10, 25, 'ft', 'general')), structure: con('constrained', ['channel_edge', 'current_seam']),
    current: con('constrained', 'moderate'), clarity: con('constrained', 'turbid'),
  },
  equipment: { rod_power: 'medium', rod_action: 'fast', reel_type: 'spinning', line_test_lb: range(8, 12, 'lb'), leader: { material: 'fluorocarbon', length_in: range(18, 30, 'in') }, lure_weight_oz: range(0.5, 1.5, 'oz'), hook_size: '1/0-2/0' },
  bait_composition: bc('live_bait_only', ['live_minnow']), presentation_method_tags: ['still_fishing'],
  retrieve: { speed: 'dead_still', cadence: 'hold in current with just enough weight to maintain bottom contact', pause_seconds: range(5, 15, 's'), depth_control: 'walk the rig downstream through the hole', rod_position: 'tip low, feel for bottom' },
  rigging_instructions: 'Heavier slip-sinker rig to hold bottom in current, fluorocarbon leader, minnow or shiner in a deep river channel hole.',
  bite_detection: 'A distinct tap-tap-tap or a steady heavy pull, distinct from the drag of current.', hookset_fight: 'Firm sweep-set once weight is confirmed as a fish, not current drag.',
  works_when: 'Fall river/tailwater staging, sauger holding in deep, turbid channel holes -- sauger tolerate current and turbidity more readily than walleye in the same reach.',
  fails_when: 'Clear, still conditions where sauger are typically found shallower or more dispersed, not stacked in deep turbid holes.',
  diagnostic_signals: 'Consistent snags/no bites in one hole after real effort -- move to the next channel bend rather than adding more weight.',
  environment_applicability: envAll({ boat: 'primary', shore: 'viable' }),
  geographic_applicability: 'MN_WI',
  buildEvidence: (id, equipment) => {
    const saugerHabitat = ext('sauger_mcv', 'tactic', id, 'works_when', 'DNR (MCV): "Saugers\' eyesight helps them thrive in deeper and murkier haunts"; sauger "inhabit mainly large rivers... and tailwater areas below dams where current concentrates prey" and "often occupy deeper, darker places in rivers and lakes."', 'Habitat / angling section');
    const saugerTechnique = ext('sauger_mcv', 'tactic', id, 'rigging_instructions', 'DNR (MCV): anglers target sauger with "live bait rigs and jigs tipped with minnows fished at or near the bottom."', 'Angling section');
    const haxtonTurbidity = ext('haxton_2019', 'tactic', id, 'works_when', 'Peer-reviewed (Haxton et al. 2019, J. Fish Biology, Rainy River): "turbidity was probably the factor that enabled S. canadensis [sauger] to survive sympatrically" with walleye, given the two species\' "inability to segregate by depth within the river" -- turbidity, not depth alone, is the real mechanism; sauger dominated 24% of the studied river vs. walleye\'s 12%.', 'Abstract, fetched directly');
    return [
      saugerHabitat, saugerTechnique,
      derived('tactic', id, 'works_when', [saugerHabitat, haxtonTurbidity], 'saugerHabitat (Minnesota DNR) and haxtonTurbidity (peer-reviewed, Journal of Fish Biology) are GENUINELY different organizations, and both independently support the same underlying premise -- sauger concentrate in deep, turbid river habitat and tolerate/prefer it more than walleye. Real independent corroboration, not two pages from one source.'),
      derived('tactic', id, 'fails_when', [saugerHabitat], 'Direct converse of the DNR-documented deep/murky/current habitat preference: absent those conditions, sauger are not concentrated the same way in a deep turbid hole.'),
      ...equipmentDerivation(id, equipment), GAP_TACKLE(id, 'retrieve.pause_seconds'),
      gap('tactic', id, 'applies_when.season.water_temp_f', 'No fetched source gives an exact fall river water-temperature range for sauger staging; general estimate only.'),
      gap('tactic', id, 'applies_when.depth_ft', 'No fetched source gives an exact channel-hole depth range; 10-25ft is a general estimate, not DNR-quoted.'),
      derived('tactic', id, 'applies_when.water_environment', [saugerHabitat], 'DNR (MCV) directly names "large rivers... and tailwater areas below dams" as primary sauger habitat -- water_environment=[river] is directly supported by the same citation already used for works_when.'),
      derived('tactic', id, 'applies_when.structure', [saugerHabitat, haxtonTurbidity], 'DNR describes tailwater/current-concentrated-prey habitat; Haxton et al. independently studies channel/current habitat use in a real river -- structure=[channel_edge, current_seam] is consistent with both citations, though neither names these exact labels verbatim.'),
      derived('tactic', id, 'applies_when.current', [saugerHabitat], 'DNR explicitly names "current concentrates prey" as part of sauger\'s preferred tailwater habitat; current=moderate follows directly from the same habitat citation already used for works_when.'),
      derived('tactic', id, 'applies_when.season.biological_stage', [saugerHabitat], 'DNR frames deep/turbid river-hole habitat use as a general (not season-specific) sauger preference; the FALL-SPECIFIC staging timing itself is a practitioner extension not directly DNR-stated -- flagged as partial support, not a verbatim seasonal citation.'),
      derived('tactic', id, 'applies_when.platform', [saugerHabitat], 'Deep river channel holes and tailwaters are reachable by boat, and bank-accessible tailwater areas below dams are also a real, DNR-implied shore-fishing location; platform=[boat, shore] follows from the same tailwater-habitat citation already used for works_when.'),
    ];
  },
  alternatives: [{ related_tactic_id: t2.id, relationship_type: 'alternative', note: 'Same presentation family (slip-sinker) adapted for current/turbidity and sauger rather than stillwater walleye -- a real species/environment variant, not a duplicate.' }],
});

// 11. Shore-only, artificial-only walleye -- tests the artificial_only/no_boat/shore_bound constraint filters directly
const t11 = makeTactic({
  speciesKeys: ['species:sander-vitreus'], presentationSlug: 'shallow-crankbait',
  applies_when: {
    platform: con('constrained', ['shore', 'wading']), water_environment: con('constrained', ['natural_lake', 'reservoir_flowage']),
    season: { biological_stage: con('constrained', 'post_spawn'), calendar_range: con('constrained', { start_month_day: '05-15', end_month_day: '06-10', varies_by_latitude: true }), water_temp_f: con('constrained', range(55, 65, 'F', 'general')) },
    depth_ft: con('constrained', range(2, 6, 'ft', 'general')), structure: con('constrained', ['point']), clarity: con('constrained', 'stained'), light: con('constrained', 'low'),
  },
  equipment: { rod_power: 'medium_light', rod_action: 'fast', reel_type: 'spinning', line_test_lb: range(6, 10, 'lb'), leader: null, lure_weight_oz: range(0.1875, 0.3125, 'oz'), hook_size: null },
  bait_composition: bc('artificial_only', ['artificial_lure']), presentation_method_tags: ['casting'],
  retrieve: { speed: 'moderate', cadence: 'steady fan-casts along the bank', pause_seconds: range(0, 0, 's', 'general'), depth_control: 'shallow-running crank, count down briefly then reel', rod_position: 'tip up' },
  rigging_instructions: 'Small shallow-running crankbait fan-cast from shore/wading along a stained-water point, no bait needed.',
  bite_detection: 'A solid thump, rod loads on its own.', hookset_fight: 'Let the moving lure set the hook.',
  works_when: 'Post-spawn, low light, shore-accessible points in stained water where an artificial-only, bait-free approach is fully viable.',
  fails_when: 'Bright midday light or very clear water where a shallow crank is too visible for a wary post-spawn fish.',
  diagnostic_signals: 'No follows/strikes after several fan-cast passes -- try a slower retrieve before changing lures.',
  casting_access_required: 'open',
  environment_applicability: envAll({ shore: 'primary', wading: 'primary' }),
  geographic_applicability: 'MN_WI',
  buildEvidence: (id, equipment) => {
    const bioLowLight = ext('walleye_biology', 'tactic', id, 'works_when', 'DNR: walleye feed shallow at dawn/dusk and remain more active under reduced brightness (turbidity/chop/cloud) -- supports a low-light, stained-water, shallow shore presentation.', 'Feeding-behavior / turbidity sections');
    return [
      derived('tactic', id, 'works_when', [bioLowLight], 'Combines DNR\'s dawn/dusk shallow-feeding fact and its turbidity-tolerance fact to support a low-light, stained-water, shallow-point pattern; the POST-SPAWN timing specifically and the artificial-only crankbait choice are practitioner extensions, not themselves DNR-stated.'),
      gap('tactic', id, 'fails_when', 'No fetched source states this specific bright/clear failure condition for a shallow crank on a wary post-spawn fish; practitioner inference.'),
      gap('tactic', id, 'applies_when.season.water_temp_f', 'No fetched source states an exact post-spawn water-temperature range; 55-65F is a general estimate, not DNR-quoted.'),
      gap('tactic', id, 'applies_when.depth_ft', 'No fetched source states an exact shallow-point depth range; 2-6ft is a general estimate, not DNR-quoted.'),
      derived('tactic', id, 'applies_when.water_environment', [bioLowLight], 'The DNR shallow-feeding fact is general walleye biology applicable to lake/reservoir shoreline settings; water_environment=[natural_lake, reservoir_flowage] is consistent with the shore-point setting already established.'),
      derived('tactic', id, 'applies_when.structure', [bioLowLight], 'Shallow shore points are exactly the shoreline structure type DNR\'s shallow-feeding fact describes; structure=[point] follows from the same shallow-shoreline premise, though DNR does not name "point" verbatim.'),
      derived('tactic', id, 'applies_when.current', [bioLowLight], 'A lake shoreline point (not a river tactic) is a stillwater setting; current=none follows from the same lake/shoreline premise already established.'),
      derived('tactic', id, 'applies_when.platform', [bioLowLight], 'A shallow (2-6ft) shore point is directly reachable by wading or shore-casting; platform=[shore, wading] follows from the same shallow-shoreline depth already cited.'),
      derived('tactic', id, 'casting_access_required', [bioLowLight], 'An open shore point (no dock/vegetation obstruction stated) allows a full fan-cast arc; casting_access_required=open is a physical/access inference from the open-point setting already established, consistent with this tactic\'s own rigging description ("fan-cast").'),
      ...equipmentDerivation(id, equipment), GAP_TACKLE(id, 'retrieve.pause_seconds'),
    ];
  },
});

// 12. Sauger, ice, river-mouth/basin -- fills ice+sauger+turbid-adjacent gap
const t12 = makeTactic({
  speciesKeys: ['species:sander-canadensis'], presentationSlug: 'jig-minnow-head-deadstick',
  applies_when: {
    platform: con('constrained', ['ice']), water_environment: con('constrained', ['natural_lake', 'tributary']),
    season: { biological_stage: con('constrained', 'early_ice'), calendar_range: con('constrained', { start_month_day: '12-05', end_month_day: '12-25', varies_by_latitude: true }), water_temp_f: con('constrained', range(33, 38, 'F', 'general')) },
    depth_ft: con('constrained', range(12, 22, 'ft', 'general')), structure: con('constrained', ['basin']), clarity: con('constrained', 'stained'),
  },
  equipment: { rod_power: 'light', rod_action: 'moderate', reel_type: 'spinning', line_test_lb: range(5, 7, 'lb'), leader: null, lure_weight_oz: range(0.0625, 0.125, 'oz'), hook_size: null },
  bait_composition: bc('hybrid_bait_and_artificial', ['artificial_lure', 'live_minnow']), presentation_method_tags: ['jigging'],
  retrieve: { speed: 'very_slow', cadence: 'occasional small lift, mostly still', pause_seconds: range(8, 20, 's'), depth_control: 'held just off bottom near a river-mouth basin', rod_position: 'resting' },
  rigging_instructions: 'Small minnow-head jig fished nearly still near a river-mouth basin under early ice.',
  bite_detection: 'A very subtle tap, easy to miss.', hookset_fight: 'Gentle deliberate lift.',
  works_when: 'Early ice, sauger holding in stained basin areas near a river/tributary inlet.',
  fails_when: 'Once fish scatter to open-basin suspension later in winter -- reassess location, not just presentation.',
  diagnostic_signals: 'No marks on electronics near the river mouth -- try progressively further into the basin.',
  environment_applicability: envAll({ ice: 'primary' }),
  geographic_applicability: 'MN_WI',
  buildEvidence: (id, equipment) => {
    const saugerRiverMouth = ext('sauger_mcv', 'tactic', id, 'works_when', 'DNR (MCV) documents sauger concentrating near river/tributary mouths and deep, murky basin habitat, and that "Lake of the Woods is noted as one of the better places in Minnesota to catch saugers through the ice."', 'Habitat / fishing-information section');
    const haxtonCoexist = ext('haxton_2019', 'tactic', id, 'works_when', 'Peer-reviewed (Haxton et al. 2019, J. Fish Biology): turbidity, not depth, is the mechanism allowing sauger to concentrate/coexist with walleye in river-influenced habitat -- consistent with, though not specific to, an early-ice river-mouth setting (the study itself examines open-water river conditions, not under-ice).', 'Abstract, fetched directly');
    return [
      derived('tactic', id, 'works_when', [saugerRiverMouth, haxtonCoexist], 'saugerRiverMouth (Minnesota DNR) and haxtonCoexist (peer-reviewed, genuinely different organization) both support sauger\'s real affinity for river-influenced, turbidity-driven habitat; the EARLY-ICE-SPECIFIC timing and the deadstick presentation choice remain practitioner extensions neither source states directly -- partial, not full, corroboration.'),
      gap('tactic', id, 'fails_when', 'No fetched source states this specific late-winter scatter-to-suspension pattern for sauger; practitioner inference.'),
      ext('winter_limnology', 'tactic', id, 'applies_when.season.water_temp_f', 'Basic winter limnology (NOT sauger-specific -- cited only for the physical water-temperature fact): under ice, the water column is capped at "4 degrees Celsius (39.2 degrees Fahrenheit), the temperature at which water is most dense" -- this tactic\'s 33-38F early-ice range is physically consistent with real under-ice thermal stratification.', 'Article body', 'expert_synthesis'),
      derived('tactic', id, 'applies_when.water_environment', [saugerRiverMouth], 'DNR (MCV) directly names sauger concentrating "near river/tributary mouths"; water_environment=[natural_lake, tributary] follows from the same habitat citation already used for works_when.'),
      derived('tactic', id, 'applies_when.platform', [saugerRiverMouth], 'DNR itself frames this as ice fishing ("Lake of the Woods is noted as one of the better places in Minnesota to catch saugers through the ice"); platform=[ice] follows directly from the same citation already used for works_when.'),
      gap('tactic', id, 'applies_when.depth_ft', 'No fetched source states an exact river-mouth basin depth range; 12-22ft is a general estimate, not DNR-quoted.'),
      ...equipmentDerivation(id, equipment), GAP_TACKLE(id, 'retrieve.pause_seconds'),
    ];
  },
  alternatives: [{ related_tactic_id: t5.id, relationship_type: 'alternative', note: 'Same presentation family as the walleye deadstick tactic, adapted to sauger and an early-ice river-mouth location.' }],
});

// 13. Walleye, dock, stained-water variant of t7 -- distinct clarity condition, same platform family
const t13 = makeTactic({
  speciesKeys: ['species:sander-vitreus'], presentationSlug: 'slip-bobber-livebait',
  applies_when: {
    platform: con('constrained', ['dock']), water_environment: con('constrained', ['natural_lake']),
    season: { biological_stage: con('constrained', 'early_summer'), calendar_range: con('unconstrained'), water_temp_f: con('constrained', range(60, 70, 'F', 'general')) },
    depth_ft: con('constrained', range(4, 10, 'ft', 'general')), cover: con('constrained', ['docks']), clarity: con('constrained', 'stained'), light: con('unconstrained'),
  },
  equipment: { rod_power: 'light', rod_action: 'moderate', reel_type: 'spinning', line_test_lb: range(6, 8, 'lb'), leader: null, lure_weight_oz: range(0.0625, 0.125, 'oz'), hook_size: '#4-#6' },
  bait_composition: bc('live_bait_only', ['live_minnow', 'live_leech']), presentation_method_tags: ['still_fishing'],
  retrieve: { speed: 'dead_still', cadence: 'suspended', pause_seconds: range(0, 0, 's', 'general'), depth_control: 'set shallower than the clear-water version -- stained water needs less depth to stay hidden', rod_position: 'resting' },
  rigging_instructions: 'Same slip-bobber livebait rig as the clear-water dock tactic, set shallower since stained water already reduces visibility to fish.',
  bite_detection: 'The bobber goes under.', hookset_fight: 'Wait for full submersion, then a firm sweep-set.',
  works_when: 'Stained water reduces the low-light requirement of the clear-water version -- viable across more of the day.',
  fails_when: 'Turbid water where visual bobber-fishing gives way to a bait presentation that does not depend on fish sighting it.',
  diagnostic_signals: 'No action across several hours at varying depths -- the dock itself may simply not have fish nearby today.',
  casting_access_required: 'limited',
  environment_applicability: envAll({ dock: 'primary', shore: 'viable' }),
  geographic_applicability: 'MN_WI',
  buildEvidence: (id, equipment) => {
    const bioTurbidity = ext('walleye_biology', 'tactic', id, 'works_when', 'DNR: "Walleye remain more active throughout the day if turbidity, wave chop or clouds reduce brightness" -- supports reduced clarity relaxing the low-light-only requirement seen in the clear-water dock tactic (t7).', 'Turbidity-preference section');
    return [
      derived('tactic', id, 'works_when', [bioTurbidity], 'Directly extends the same DNR turbidity fact already cited on t9/t3/t11 to this stained-water dock variant of t7 -- stained water reduces the daylight brightness that otherwise confines t7 to dawn/dusk.'),
      gap('tactic', id, 'fails_when', 'No fetched source distinguishes stained from fully turbid water\'s effect on bobber-fishing visibility specifically; practitioner inference.'),
      gap('tactic', id, 'applies_when.season.water_temp_f', 'No fetched source states an exact early-summer water-temperature range; 60-70F is a general estimate, not DNR-quoted.'),
      gap('tactic', id, 'applies_when.depth_ft', 'No fetched source states an exact dock depth range for stained water; 4-10ft is a general estimate, not DNR-quoted.'),
      derived('tactic', id, 'applies_when.water_environment', [bioTurbidity], 'A dock is a lake/reservoir-specific structure by definition; water_environment=[natural_lake] follows from the presentation itself, the same logic already applied on t7.'),
      derived('tactic', id, 'applies_when.current', [bioTurbidity], 'A dock in natural_lake water is a stillwater setting by definition of the platform/environment already established; current=none follows from that same setting, as on t7.'),
      derived('tactic', id, 'applies_when.platform', [bioTurbidity], 'A dock is, by definition, fished from the dock itself or adjacent shore; platform=[dock, shore] follows directly from the presentation\'s own structural premise, as on t7.'),
      derived('tactic', id, 'casting_access_required', [bioTurbidity], 'A fixed dock structure inherently constrains casting angles regardless of water clarity; casting_access_required=limited follows the same physical/structural reasoning already established on t7.'),
      ...equipmentDerivation(id, equipment), GAP_TACKLE(id, 'retrieve.pause_seconds'),
    ];
  },
  alternatives: [{ related_tactic_id: t7.id, relationship_type: 'alternative', note: 'Same platform/presentation family as the clear-water dock tactic, varied by clarity condition -- not a duplicate, a real condition-driven variant.' }],
});

// 14. Sauger, river, rising/turbid post-rain -- exercises water_level_trend + recent_precipitation explicitly
const t14 = makeTactic({
  speciesKeys: ['species:sander-canadensis', 'species:sander-vitreus'], presentationSlug: 'slip-sinker-livebait-rig',
  applies_when: {
    platform: con('constrained', ['boat', 'shore']), water_environment: con('constrained', ['river']),
    season: { biological_stage: con('unconstrained'), calendar_range: con('unconstrained'), water_temp_f: con('unconstrained') },
    depth_ft: con('constrained', range(6, 15, 'ft', 'general')), structure: con('constrained', ['channel_edge']),
    current: con('constrained', 'strong'), clarity: con('constrained', 'turbid'),
    water_level_trend: con('constrained', 'rising'), recent_precipitation: con('constrained', 'heavy'),
  },
  equipment: { rod_power: 'medium_heavy', rod_action: 'moderate', reel_type: 'either', line_test_lb: range(12, 17, 'lb'), leader: { material: 'fluorocarbon', length_in: range(18, 24, 'in') }, lure_weight_oz: range(1, 2, 'oz'), hook_size: '2/0-3/0' },
  bait_composition: bc('live_bait_only', ['live_minnow']), presentation_method_tags: ['still_fishing'],
  retrieve: { speed: 'dead_still', cadence: 'heavy enough weight to hold in strong current, otherwise still', pause_seconds: range(10, 20, 's'), depth_control: 'anchor position on the slower inside edge of the current seam', rod_position: 'braced rod holder, strong current load' },
  rigging_instructions: 'Heavier slip-sinker rig baited with a minnow, scaled up for strong post-rain current, fished on the slower inside edge of a channel seam.',
  bite_detection: 'Distinct pull against the already-loaded rod tip, distinct from current surge.', hookset_fight: 'Firm set given the heavier terminal tackle; expect a harder-pulling fight in current.',
  works_when: 'Rising, turbid water after heavy rain, fish pushed to current-breaks on channel edges rather than the main flow.',
  fails_when: 'Once the river stabilizes/clears, this scaled-up heavy rig becomes unnecessarily coarse -- downsize toward tactic 6 or 10 instead.',
  diagnostic_signals: 'Constant snagging/no bites in the main current -- the fish are very unlikely to be fighting the strongest flow; move to a slower inside seam.',
  environment_applicability: envAll({ boat: 'primary', shore: 'viable' }),
  geographic_applicability: 'MN_WI',
  buildEvidence: (id, equipment) => {
    const windriderRain = ext('windrider_rain_fishing', 'tactic', id, 'works_when', 'Independent established angling publication (WindRider), fetched directly: "Rising water pushes baitfish out of side channels and flooded vegetation, creating current seams where walleye stack up to intercept easy meals," and for river tactics specifically: "target the softer water adjacent to current, not the current itself. Walleye expend energy efficiently -- they want to hold in slow water and ambush prey that sweeps past." Directly, closely matches this tactic\'s own premise (current-breaks on channel edges rather than main flow) -- not verbatim, but on-topic and specific to the exact scenario, unlike a general biology source stretched to cover a technique it doesn\'t discuss.', 'Article body, fetched directly', 'anecdotal');
    return [
      derived('tactic', id, 'works_when', [windriderRain], 'A real, independent, established angling publication directly addresses rising/post-rain river conditions and current-seam positioning -- the exact scenario this tactic covers, not a stretched biology fact. Single source (anecdotal-tier, not peer-reviewed or agency-official), so this remains below official_guidance/independently_corroborated, but it is real, on-topic, and no longer entirely ungrounded.'),
      derived('tactic', id, 'fails_when', [windriderRain], 'The same source frames the current-break behavior as a rain/turbidity-driven response; once conditions stabilize/clear, the behavioral driver the source describes no longer applies -- inferred converse, not separately stated.'),
      gap('tactic', id, 'applies_when.depth_ft', 'No fetched source states an exact channel-edge depth range for post-rain conditions; 6-15ft is a general estimate, not DNR-quoted.'),
      derived('tactic', id, 'applies_when.water_environment', [windriderRain], 'The cited source is specifically about RIVER walleye tactics during rain; water_environment=[river] follows directly from the same citation already used for works_when.'),
      derived('tactic', id, 'applies_when.structure', [windriderRain], 'The source names "current seams" and "softer water adjacent to current" -- structure=[channel_edge] is consistent with, though not a verbatim match for, this description.'),
      derived('tactic', id, 'applies_when.current', [windriderRain], 'The source explicitly frames this as a strong-current river scenario (contrasting "the current itself" with adjacent slower water); current=strong follows directly from the same citation.'),
      derived('tactic', id, 'applies_when.platform', [windriderRain], 'River current-seam fishing during high water is reachable by boat, and bank-accessible where the channel edge nears shore; platform=[boat, shore] follows from the same river-tactic citation already used for works_when.'),
      ...equipmentDerivation(id, equipment), GAP_TACKLE(id, 'retrieve.pause_seconds'),
    ];
  },
  alternatives: [{ related_tactic_id: t6.id, relationship_type: 'alternative', note: 'Same species pairing and river environment as t6, scaled up specifically for high-water/heavy-current conditions rather than normal pre-spawn flow.' },
                 { related_tactic_id: t10.id, relationship_type: 'alternative', note: 'Related sauger river tactic at normal flow; this is the elevated-water variant.' }],
});

// 15. Walleye, ice, post-cold-front + suspected low DO -- exercises weather_front + dissolved_oxygen_status explicitly
const t15 = makeTactic({
  speciesKeys: ['species:sander-vitreus'], presentationSlug: 'jig-minnow-head-deadstick',
  applies_when: {
    platform: con('constrained', ['ice']), water_environment: con('constrained', ['natural_lake']),
    season: { biological_stage: con('constrained', 'late_ice'), calendar_range: con('constrained', { start_month_day: '02-15', end_month_day: '03-15', varies_by_latitude: true }), water_temp_f: con('constrained', range(33, 36, 'F', 'general')) },
    depth_ft: con('constrained', range(18, 28, 'ft', 'general')), structure: con('constrained', ['basin']),
    weather_front: con('constrained', 'passed_recently'), dissolved_oxygen_status: con('constrained', 'stressed_suspected'), barometric_pressure_trend: con('constrained', 'rising'),
  },
  equipment: { rod_power: 'ultralight', rod_action: 'slow', reel_type: 'spinning', line_test_lb: range(3, 5, 'lb'), leader: null, lure_weight_oz: range(0.03125, 0.0625, 'oz'), hook_size: null },
  bait_composition: bc('live_bait_only', ['live_minnow']), presentation_method_tags: ['jigging'],
  retrieve: { speed: 'dead_still', cadence: 'as close to no movement as possible', pause_seconds: range(20, 60, 's'), depth_control: 'held precisely at the fish-marked depth', rod_position: 'resting, watch the line/spring bobber only' },
  rigging_instructions: 'The smallest practical live-bait presentation, fished essentially motionless -- late-ice, post-front, suspected low-oxygen conditions call for minimizing everything that could spook an already-stressed, sluggish fish.',
  bite_detection: 'Extremely subtle -- watch for the faintest line movement, do not rely on feel.', hookset_fight: 'A very gentle, deliberate lift -- an aggressive set is likely to miss or pull free from a barely-committed bite.',
  works_when: 'Late ice, immediately after a front has passed, in a deep basin area where low dissolved oxygen is a documented seasonal risk (long ice cover + snow load) -- fish are sluggish and easily put off by movement or noise.',
  fails_when: 'Once oxygen conditions genuinely recover (typically post-turnover after ice-out) or on a stable-weather day where fish are actively feeding -- this presentation is unnecessarily passive for active fish.',
  diagnostic_signals: 'Marks on electronics that will not commit even to this presentation may indicate the DO-stress read is correct and the bite window is simply very short -- minimize noise/hole-hopping rather than changing presentation further.',
  environment_applicability: envAll({ ice: 'primary' }),
  conservation_notes: 'Fish in a genuinely low-oxygen late-ice scenario are under real physiological stress; minimize air exposure and handling time on any catch.',
  geographic_applicability: 'MN_WI',
  buildEvidence: (id, equipment) => {
    const winterkillMech = ext('mn_dnr_winterkill', 'tactic', id, 'works_when', 'DNR: "When snow and ice cover a lake, they limit the sunlight reaching aquatic plants. The plants cut back on the amount of oxygen they produce. If vegetation dies from lack of sunlight, the plants start to decompose, which uses oxygen dissolved in the water." Risk increases with "abundant or early snowfall" and "early ice-on and late ice-out dates" -- directly supports this tactic\'s dissolved_oxygen_status=stressed_suspected PROXY basis (extended ice+snow duration), which the schema itself requires be stated as an inferred proxy, never a raw sensor reading. DNR does NOT specifically discuss walleye behavior under these conditions -- the "sluggish, easily put off by movement" behavioral inference remains a practitioner extension, not itself DNR-stated.', 'Fish kills page body');
    const winterTemp15 = ext('winter_limnology', 'tactic', id, 'applies_when.season.water_temp_f', 'Basic winter limnology (NOT walleye-specific): under ice, the water column is capped at "4 degrees Celsius (39.2 degrees Fahrenheit), the temperature at which water is most dense" -- this tactic\'s 33-36F late-ice range is physically consistent with real under-ice thermal stratification.', 'Article body', 'expert_synthesis');
    return [
      winterTemp15,
      derived('tactic', id, 'applies_when.depth_ft', [winterkillMech], 'DNR\'s winterkill mechanism concerns whole-lake oxygen depletion, strongest in shallow lakes; this tactic targets a DEEP basin specifically because deeper water is where oxygen-stressed fish would be expected to hold if better-oxygenated water remains there -- an inference from the same DO-depletion mechanism, not itself a DNR-stated depth figure.'),
      winterkillMech,
      derived('tactic', id, 'fails_when', [winterkillMech], 'Once the DNR-documented DO-depletion mechanism no longer applies (post-turnover, oxygen re-mixed), the low-oxygen-driven sluggish-fish premise this tactic relies on no longer holds -- inferred converse of the same cited mechanism.'),
      derived('tactic', id, 'conservation_notes', [winterkillMech], 'DNR\'s winterkill mechanism directly establishes that late-ice, low-oxygen conditions represent real physiological stress on the fish population -- minimizing air exposure/handling time on any catch follows directly from the same DO-stress mechanism already cited for works_when, standard practice for stressed fish.'),
      derived('tactic', id, 'applies_when.water_environment', [winterkillMech], 'DNR\'s winterkill discussion is specifically about lakes; water_environment=[natural_lake] follows directly from the same source already cited.'),
      derived('tactic', id, 'applies_when.structure', [winterkillMech], 'DNR notes winterkill risk is worse in shallow lakes, implying deeper basins retain relatively better oxygen late in winter -- structure=[basin] is consistent with that same inference, not itself DNR-stated as a fishing-structure recommendation.'),
      derived('tactic', id, 'applies_when.platform', [winterkillMech], 'DNR\'s winterkill discussion concerns ice-covered lakes specifically (late ice season); platform=[ice] follows directly from the same seasonal context already cited.'),
      ...equipmentDerivation(id, equipment), GAP_TACKLE(id, 'retrieve.pause_seconds'),
    ];
  },
  alternatives: [{ related_tactic_id: t5.id, relationship_type: 'alternative', note: 'Same deadstick presentation family as t5, taken further (even less movement, smaller profile) for the specific late-ice/post-front/low-DO-suspected combination.' }],
});

// ---------- gate-6: next_try validation pass (instruction 4) ----------
// Runs AFTER all 15 tactics exist (alternatives reference other tactics by id). Any
// next_try relationship that fails validateNextTry() downgrades the FROM tactic's
// readiness to research_incomplete, regardless of how complete its other fields are --
// an invalid next_try is itself an incomplete/unsound piece of guidance.
const tacticsById = Object.fromEntries(tactics.map(t => [t.id, t]));
const presentationsById = Object.fromEntries(Object.values(presentations).map(p => [p.id, p]));
export const nextTryValidationResults = [];
for (const t of tactics) {
  for (const alt of t.alternatives.filter(a => a.relationship_type === 'next_try')) {
    const target = tacticsById[alt.related_tactic_id];
    const result = validateNextTry(t, target, alt, presentationsById[t.presentation_id], presentationsById[target.presentation_id]);
    nextTryValidationResults.push({ from: t.id, to: target.id, fromSlug: presentationsById[t.presentation_id].presentation_slug, toSlug: presentationsById[target.presentation_id].presentation_slug, ...result });
    if (!result.pass && t.readiness === 'ready_for_human_review') {
      t.readiness = 'research_incomplete';
      t.readiness_reason = `next_try relationship to ${target.id.slice(0,8)} failed validation: ${JSON.stringify(result.checks)}.`;
    }
  }
}

// ---------- regulation provisions ----------
// gate-4 remediation:
//  - Mille Lacs provisions now use the REAL FishWizz waterbody_id for Mille Lacs Lake
//    (confirmed present in supabase/schema/waterbodies-data.sql: a96c6a4c-19ed-4455-a091-6233f688d336).
//  - Mille Lacs temporal_scope corrected to the real season (through Nov 30, 2026), re-verified
//    directly from the DNR release, not left open-ended.
//  - catch_and_release_permitted is QUARANTINED: no source found this pass explicitly states a
//    general statewide catch-and-release rule (the previously-cited Mille Lacs release does not
//    state this). Per instruction, it is NOT replaced with another citation -- its value now
//    stores determination:"unknown" with an official_lookup_url, and its evidence is an honest
//    unsupported_gap claim, not a claim asserting a fact no source supports.
const MILLE_LACS_WATERBODY_ID = 'a96c6a4c-19ed-4455-a091-6233f688d336'; // real FishWizz waterbodies.id, confirmed in supabase/schema/waterbodies-data.sql
const provisions = [];
const REG_LOOKUP_URL = 'https://www.dnr.state.mn.us/regulations/fishing/index.html';
function makeProvision(type, scope, valueObj, extra = {}) {
  const id = uuid();
  const areaSlug = scope.type === 'named_water' ? 'mille-lacs-lake' : 'statewide';
  const provisionSlug = `mn.${scope.type}.${areaSlug}.walleye-sauger.${type}.2026`;
  const evidenceEntries = extra.buildEvidence(id);
  provisions.push({
    id, provision_slug: provisionSlug, content_fingerprint: fp({ type, scope, pass: 'gate4' }),
    provision_type: type, geographic_scope: scope, temporal_scope: extra.temporal || { type: 'fixed_interval', fixed_interval: { start: '2026-05-09', end: '2027-02-28' }, annual_recurrence: null },
    species: [{ species_id: walleye.id }],
    combined_with_species_ids: extra.combined || [],
    value: valueObj, is_emergency: false, precedence_rank: extra.rank ?? (scope.type === 'named_water' ? 20 : 10),
    official_wording: extra.wording, source_location: extra.sourceLocation || 'DNR news release, Mar 5 2026', status: 'current',
    mandatory_reverify_by: extra.reverifyBy || '2027-03-01', verified_date: TODAY, supersedes: null, superseded_by: null,
    evidence: evidenceEntries.map(cid => ({ claim_id: cid })), record_status: 'draft', reviewed_by: null, reviewed_at: null, approved_by: null, approved_at: null,
    created_at: NOW, updated_at: NOW, published_at: null, schema_version: '3.0.0', content_version: 1,
  });
  return provisions[provisions.length - 1];
}
const statewideScope = { type: 'statewide', waterbody_id: null, waterbody_name: null, district_code: null, great_lake_name: null, tributary_of: null, boundary_jurisdictions: null, tribal_territory: null };
const milleLacsScope = { type: 'named_water', waterbody_id: MILLE_LACS_WATERBODY_ID, waterbody_name: 'Mille Lacs Lake', district_code: null, great_lake_name: null, tributary_of: null, boundary_jurisdictions: null, tribal_territory: null };

const dailyLimitProv = makeProvision('daily_limit', statewideScope, 6, {
  wording: 'Statewide inland default: 6 walleye+sauger combined, only one over 20 inches.', combined: [sauger.id],
  reverifyBy: '2027-02-28', // a real, currently-pending DNR proposal would reduce this to 4, effective 2027-03-01 if adopted -- not yet in effect as of 2026-08-29
  buildEvidence: (id, equipment) => [ext('mille_lacs_2026', 'regulation_provision', id, 'value', 'DNR (confirmed live, 2026-08-29): "Current Regulation (since 1956): Daily limit: 6 walleyes." A proposed reduction to 4 (comment period closed Mar 5, 2026) has NOT been adopted; if approved it would take effect March 1, 2027, hence mandatory_reverify_by is set to the day before.', 'News release body, re-verified 2026-08-29')],
});
const sizeRuleProv = makeProvision('size_rule', statewideScope, { rule_type: 'one_over_threshold', min_in: 20, max_in: null }, {
  wording: 'Statewide inland default: only one walleye over 20 inches in possession.',
  buildEvidence: (id, equipment) => [ext('mille_lacs_2026', 'regulation_provision', id, 'value', 'DNR (confirmed live, 2026-08-29): current rule keeps the "only one walleye over 20 inches" size restriction; the pending 4-fish-limit proposal explicitly leaves this size restriction unchanged.', 'News release body, re-verified 2026-08-29')],
});
makeProvision('daily_limit', milleLacsScope, 3, {
  wording: 'Anglers will be able to harvest walleye 17 inches or greater in length, with only one over 20 inches allowed in possession.',
  temporal: { type: 'fixed_interval', fixed_interval: { start: '2026-05-09', end: '2026-11-30' } , annual_recurrence: null },
  buildEvidence: (id, equipment) => [ext('mille_lacs_2026', 'regulation_provision', id, 'value', 'DNR: "three walleyes starting on the fishing opener on Saturday, May 9." "The open-water walleye regulation for Mille Lacs Lake will be in place through Monday, Nov. 30."', 'Regulation and season-dates sections')],
});
makeProvision('size_rule', milleLacsScope, { rule_type: 'minimum', min_in: 17, max_in: null }, {
  wording: 'Minimum 17 inches to harvest on Mille Lacs Lake.',
  temporal: { type: 'fixed_interval', fixed_interval: { start: '2026-05-09', end: '2026-11-30' }, annual_recurrence: null },
  buildEvidence: (id, equipment) => {
    const c1 = ext('mille_lacs_2026', 'regulation_provision', id, 'value', 'DNR: "Harvested walleyes must be 17 inches or greater, with only one over 20 inches."', 'Regulation section');
    // The Mille Lacs release restates the SAME one-over-20 figure as the statewide size_rule provision, for this water
    // specifically -- this is real, independent corroboration of the statewide provision's applicability here, not an
    // assumption that it silently carries over. Recorded as its own derived claim rather than left implicit.
    return [c1, derived('regulation_provision', id, 'value', [c1], 'The Mille Lacs release itself restates "only one over 20 inches" as part of describing Mille Lacs regulations specifically -- this corroborates (rather than merely assumes) that the separate statewide one_over_threshold(20in) provision composes with this minimum(17in) provision for Mille Lacs Lake.')];
  },
});
makeProvision('catch_and_release_permitted', statewideScope,
  { determination: 'unknown', note: 'No fetched source this research pass explicitly states a general statewide catch-and-release rule for walleye/sauger. The previously-cited Mille Lacs news release does not state this -- it only mentions that DNR retains authority to impose MID-SEASON catch-and-release restrictions on Mille Lacs "if needed," which is a different, narrower, water-specific emergency-management provision, not a general permission. Quarantined per gate-4 remediation rule: do not replace a mis-cited claim without an explicit official source; store as unknown and direct to the official lookup instead.', official_lookup_url: REG_LOOKUP_URL },
  { wording: 'Status unresolved this pass -- see value.note. Anglers should consult the official MN DNR regulations handbook/lookup directly rather than treat this record as a confirmed answer.', rank: 5,
    sourceLocation: 'n/a -- quarantined, no source establishes this claim',
    buildEvidence: (id, equipment) => [gap('regulation_provision', id, 'value', 'Quarantined: the record previously cited the Mille Lacs daily-limit release for a general statewide catch-and-release permission that release does not state. No replacement source was found this pass. This is an honest unsupported_gap, not a claim.')],
  });

// Not itself a regulation_provision, but a real, sourced fact worth carrying forward for the next
// research pass: the Mille Lacs release states DNR "could impose catch-and-release regulations
// mid-season 'if needed' to prevent excessive harvest" -- a real, water-specific, POSSIBLE emergency
// override, distinct from the quarantined statewide claim above. Logged in the remediation report,
// not modeled as its own provision this pass (would need its own trigger-condition/temporal modeling
// this pass does not have time to design correctly).

// ---------- write output ----------
const pilot = { species: Object.values(species), sources: [...Object.values(sources)], claims, presentations: Object.values(presentations), tactics, provisions };
fs.writeFileSync(new URL('./pilot-data.json', import.meta.url), JSON.stringify(pilot, null, 2));
fs.writeFileSync(new URL('./next-try-validation-results.json', import.meta.url), JSON.stringify(nextTryValidationResults, null, 2));
console.log(`Generated: ${pilot.species.length} species, ${pilot.sources.length} sources, ${pilot.claims.length} claims, ${pilot.presentations.length} presentations, ${pilot.tactics.length} tactics, ${pilot.provisions.length} regulation provisions.`);
console.log(`Evidence status breakdown: ${claims.filter(c=>c.evidence_status==='externally_sourced').length} externally_sourced, ${claims.filter(c=>c.evidence_status==='derived_synthesis').length} derived_synthesis, ${claims.filter(c=>c.evidence_status==='unsupported_gap').length} unsupported_gap.`);
console.log(`All record_status: draft. Written to pilot-data.json.`);
