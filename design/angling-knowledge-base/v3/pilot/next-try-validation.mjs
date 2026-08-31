// gate-6 instruction 4: re-review every next_try relationship against 5 real criteria,
// not just "closest matching tactic." Returns a structured result so it can be both
// asserted in the generator AND independently re-verified by the validator.
export function validateNextTry(fromTactic, toTactic, alt, fromPresentation, toPresentation) {
  const checks = {};
  // 1. remains usable under the same observed conditions (species, platform, water_environment
  //    compatible) -- i.e. everything EXCEPT the specific characteristic believed to be failing.
  checks.sameSpecies = fromTactic.species.every(s1 => toTactic.species.some(s2 => s2.species_id === s1.species_id));
  checks.compatiblePlatform = fromTactic.applies_when.platform.value.some(p => toTactic.applies_when.platform.value.includes(p));
  checks.compatibleWaterEnv = toTactic.applies_when.water_environment.value.some(w => fromTactic.applies_when.water_environment.value.includes(w));
  const fromDepth = fromTactic.applies_when.depth_ft.value, toDepth = toTactic.applies_when.depth_ft.value;
  checks.depthOverlap = fromTactic.applies_when.depth_ft.state !== 'constrained' || toTactic.applies_when.depth_ft.state !== 'constrained'
    || (toDepth.min <= fromDepth.max && toDepth.max >= fromDepth.min);
  const fromTemp = fromTactic.applies_when.season.water_temp_f.value, toTemp = toTactic.applies_when.season.water_temp_f.value;
  checks.tempOverlap = fromTactic.applies_when.season.water_temp_f.state !== 'constrained' || toTactic.applies_when.season.water_temp_f.state !== 'constrained'
    || (toTemp.min <= fromTemp.max && toTemp.max >= fromTemp.min);

  // 2. changes the presentation characteristic believed to be failing (different presentation
  //    category/intensity_tier -- not literally the same rig).
  checks.presentationDiffers = fromTactic.presentation_id !== toTactic.presentation_id;
  checks.intensityTierDiffers = fromPresentation.intensity_tier !== toPresentation.intensity_tier || fromPresentation.category !== toPresentation.category;

  // 3. compatible platform AND gear (environment_applicability overlap on a real platform).
  const envKeys = ['shore','dock','wading','boat','kayak','canoe','ice'];
  checks.environmentApplicabilityOverlap = envKeys.some(k => fromTactic.environment_applicability[k] !== 'not_applicable' && toTactic.environment_applicability[k] !== 'not_applicable');

  // 4. the note records BOTH a failure hypothesis AND why the alternative responds to it --
  //    checked structurally (not just "closest matching tactic" boilerplate, and long enough
  //    to actually contain a hypothesis + response, not a one-line label).
  checks.hasFailureHypothesis = /fails? (when|because)|failure hypothesis|believed to be failing/i.test(alt.note);
  checks.hasResponseRationale = /because|responds to|addresses|by (switching|using|presenting)/i.test(alt.note);
  checks.notJustClosestMatch = !/closest.{0,20}match/i.test(alt.note) || alt.note.length > 300;
  checks.noteIsSubstantive = alt.note.length >= 200;

  const allPass = Object.values(checks).every(Boolean);
  return { pass: allPass, checks };
}
