// gate-6: three evidence OBLIGATIONS, replacing the gate-5 flat "every decision-critical
// field needs a citation" rule that the user correctly flagged as pointless claim inflation
// for fields that are either transparently derivable or intrinsically definitional.
//
//   A. external_evidence_required -- a real-world fact about fish/water that only external
//      research can establish (biology, behavior, habitat, seasonal movement, effectiveness,
//      failure conditions, conservation/safety). Needs a real externally_sourced or
//      derived_synthesis (from real ancestors) claim.
//   B. traceable_derivation_allowed -- a RECOMMENDATION that can legitimately be reasoned out
//      from technical specs/premises (equipment sizing, platform access logic, next_try
//      compatibility) without necessarily being an independently discovered fact. Needs a
//      real claim too (ideally derived_synthesis with an explicit calculation/reasoning), but
//      a transparent derivation satisfies it -- it does NOT need to be, and should not be
//      dressed up as, an independently_corroborated biological fact.
//   C. intrinsic_definition -- true by construction from the presentation/rig itself (e.g. "a
//      minnow-tipped jig uses natural bait"). Requires CONSISTENCY VALIDATION (a real,
//      programmatic check that the field doesn't contradict the presentation/rigging text),
//      never a citation -- fabricating a citation row for these would be exactly the pointless
//      claim inflation the user is correcting.
export const EVIDENCE_OBLIGATION = {
  'applies_when.water_environment': 'A',
  'applies_when.season.biological_stage': 'A',
  'applies_when.season.water_temp_f': 'A',
  'applies_when.depth_ft': 'A',
  'applies_when.structure': 'A',
  'applies_when.cover': 'A',
  'applies_when.current': 'A',
  'works_when': 'A',
  'fails_when': 'A',
  'conservation_notes': 'A',

  'applies_when.platform': 'B',
  'equipment.line_test_lb': 'B',
  'equipment.lure_weight_oz': 'B',
  'retrieve.pause_seconds': 'B',
  'casting_access_required': 'B',
  'next_try': 'B', // structural, not a claim field_path -- validated via validateNextTry(), not a citation

  'bait_composition': 'C',
  'rigging_instructions': 'C',
};

export const DECISION_CRITICAL_FIELDS = Object.keys(EVIDENCE_OBLIGATION).filter(f => f !== 'next_try');
export const EXTERNAL_EVIDENCE_REQUIRED_FIELDS = Object.keys(EVIDENCE_OBLIGATION).filter(f => EVIDENCE_OBLIGATION[f] === 'A');
export const TRACEABLE_DERIVATION_FIELDS = Object.keys(EVIDENCE_OBLIGATION).filter(f => EVIDENCE_OBLIGATION[f] === 'B');
export const INTRINSIC_FIELDS = Object.keys(EVIDENCE_OBLIGATION).filter(f => EVIDENCE_OBLIGATION[f] === 'C');

export const DESCRIPTIVE_FIELDS = [
  'bite_detection',
  'hookset_fight',
  'diagnostic_signals',
  'environment_applicability',
];

/** Only the fields this SPECIFIC tactic actually constrains/uses -- an unconstrained axis has nothing to source. */
export function requiredDecisionCriticalFields(tactic) {
  const required = [];
  const aw = tactic.applies_when;
  const conditionalAxis = {
    'applies_when.water_environment': aw.water_environment,
    'applies_when.platform': aw.platform,
    'applies_when.season.biological_stage': aw.season.biological_stage,
    'applies_when.season.water_temp_f': aw.season.water_temp_f,
    'applies_when.depth_ft': aw.depth_ft,
    'applies_when.structure': aw.structure,
    'applies_when.cover': aw.cover,
    'applies_when.current': aw.current,
  };
  for (const [field, axis] of Object.entries(conditionalAxis)) {
    if (axis.state === 'constrained') required.push(field);
  }
  // gate-6: intrinsic (C) fields -- bait_composition, rigging_instructions -- are deliberately
  // NOT in this list. They need consistency validation (checkIntrinsicConsistency), never a
  // required citation/gap row -- that was exactly the "pointless claim inflation" being fixed.
  required.push('retrieve.pause_seconds', 'equipment.line_test_lb', 'equipment.lure_weight_oz', 'works_when', 'fails_when');
  if (tactic.conservation_notes !== null) required.push('conservation_notes');
  if (tactic.casting_access_required !== null) required.push('casting_access_required');
  return required;
}

/**
 * Real, programmatic consistency checks for INTRINSIC fields -- never a fabricated citation.
 * Returns { pass: boolean, issues: string[] }.
 */
export function checkIntrinsicConsistency(tactic) {
  const issues = [];
  const rig = tactic.rigging_instructions.toLowerCase();
  const mode = tactic.bait_composition.mode;
  const components = tactic.bait_composition.components;
  const mentionsLive = /minnow|leech|nightcrawler|crawler|live.?bait|shiner/.test(rig) && !/bare or/.test(rig) && !/no bait/.test(rig);
  const mentionsArtificialOnly = /no bait needed|artificial|hard.?bodied|crankbait|spoon/.test(rig);
  const mentionsHybrid = /bare or|can be fished bare|or minnow-tipped|or tipped/.test(rig);
  if (mode === 'live_bait_only' && !mentionsLive) issues.push(`bait_composition.mode=live_bait_only but rigging_instructions does not clearly name a live-bait component: "${tactic.rigging_instructions.slice(0,80)}..."`);
  if (mode === 'artificial_only' && mentionsLive && !mentionsHybrid) issues.push(`bait_composition.mode=artificial_only but rigging_instructions mentions a live-bait term: "${tactic.rigging_instructions.slice(0,80)}..."`);
  if (mode === 'hybrid_bait_and_artificial' && !mentionsHybrid && !(mentionsLive)) issues.push(`bait_composition.mode=hybrid_bait_and_artificial but rigging_instructions does not describe an optional/hybrid bait+artificial presentation: "${tactic.rigging_instructions.slice(0,80)}..."`);
  if (mode === 'artificial_only' && !components.every(c => ['artificial_lure', 'soft_plastic'].includes(c))) issues.push(`bait_composition.mode=artificial_only but components include a non-artificial entry: ${components.join(',')}`);
  return { pass: issues.length === 0, issues };
}
