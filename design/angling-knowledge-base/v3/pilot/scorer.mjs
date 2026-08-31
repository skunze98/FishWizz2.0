// Reference scorer -- a REAL, runnable implementation of the gate-2/3 scoring
// design, sufficient to run the pilot through real scenarios and show real
// ranked output. Explicitly NOT the "working scorer/ranking implementation"
// listed as a production prerequisite (that item remains open) -- this is a
// minimal but honest reference implementation for pilot validation only.
const AXES = ['platform', 'water_environment', 'depth_ft', 'structure', 'cover', 'substrate', 'current', 'clarity',
  'wind', 'light', 'barometric_pressure_trend', 'fishing_pressure', 'weather_front', 'water_level_trend',
  'recent_precipitation', 'dissolved_oxygen_status', 'observed_fish_activity', 'time_of_day'];
// gate-5: renamed/re-tiered to match the fixed confidence semantics (a single authoritative
// agency is official_guidance, not independently_corroborated -- see shared-definitions.schema.json).
const CONFIDENCE_WEIGHT = { peer_review_supported: 1.0, independently_corroborated: 0.85, official_guidance: 0.65, expert_synthesis: 0.5, anecdotal: 0.4, estimated: 0.3, unsupported: 0 };
const LIVE_COMPONENTS = ['live_minnow', 'live_leech', 'live_nightcrawler', 'live_other'];
export const SCORER_VERSION = 'pilot-reference-0.1.0';

function rangesOverlap(tacticRange, observedValue) {
  if (tacticRange.min == null || tacticRange.max == null) return 0.5; // general/unknown precision -> partial credit only
  if (observedValue >= tacticRange.min && observedValue <= tacticRange.max) return 1;
  const span = tacticRange.max - tacticRange.min || 1;
  const dist = observedValue < tacticRange.min ? tacticRange.min - observedValue : observedValue - tacticRange.max;
  return Math.max(0, 1 - dist / span);
}
function arrayMatch(tacticValues, observedValue) { return tacticValues.includes(observedValue) ? 1 : 0; }
function scalarMatch(tacticValue, observedValue) { return tacticValue === observedValue ? 1 : 0; }

function axisScore(axisName, tacticAxis, obsAxis) {
  if (tacticAxis.state !== 'constrained') return { included: false, reason: tacticAxis.state === 'unconstrained' ? 'no_constraint' : 'not_applicable' };
  if (obsAxis.state !== 'observed') return { included: false, reason: obsAxis.state === 'missing' ? 'mission_missing' : 'mission_unknown' };
  if (axisName === 'depth_ft') return { included: true, score: rangesOverlap(tacticAxis.value, obsAxis.value) };
  if (['platform', 'water_environment', 'structure', 'cover', 'substrate', 'time_of_day'].includes(axisName)) return { included: true, score: arrayMatch(tacticAxis.value, obsAxis.value) };
  return { included: true, score: scalarMatch(tacticAxis.value, obsAxis.value) };
}

function seasonScore(tacticSeason, obsSeason) {
  const results = [];
  if (tacticSeason.biological_stage.state === 'constrained' && obsSeason.biological_stage?.state === 'observed')
    results.push({ axis: 'season.biological_stage', included: true, score: scalarMatch(tacticSeason.biological_stage.value, obsSeason.biological_stage.value) });
  if (tacticSeason.water_temp_f.state === 'constrained' && obsSeason.water_temp_f?.state === 'observed')
    results.push({ axis: 'season.water_temp_f', included: true, score: rangesOverlap(tacticSeason.water_temp_f.value, obsSeason.water_temp_f.value) });
  return results;
}

export function hardFilter(tactic, scenario) {
  const reasons = [];
  const platformKeyMap = { shore: 'shore', dock: 'dock', wading: 'wading', boat: 'boat', kayak: 'kayak', canoe: 'canoe', ice: 'ice' };
  const platformApplicability = tactic.environment_applicability[platformKeyMap[scenario.platform]];
  if (platformApplicability === 'not_applicable') reasons.push(`platform '${scenario.platform}' is not_applicable for this tactic`);
  // gate-4 fix: bait_composition.mode is now the single authoritative field for these filters,
  // replacing the old bait_method_tags array where a tactic could carry BOTH 'artificial_only'
  // and 'live_bait' simultaneously (the exact t8 defect the semantic audit found).
  if (scenario.user_constraint_tags?.includes('no_live_bait') && tactic.bait_composition.components.some(c => LIVE_COMPONENTS.includes(c)))
    reasons.push('excluded by no_live_bait constraint (bait_composition includes a live component)');
  if (scenario.user_constraint_tags?.includes('artificial_only') && tactic.bait_composition.mode !== 'artificial_only')
    reasons.push(`excluded by artificial_only constraint (bait_composition.mode is '${tactic.bait_composition.mode}', not 'artificial_only' -- hybrid tactics are NOT artificial_only-safe since their recorded rigging still contemplates real bait)`);
  if (scenario.user_constraint_tags?.includes('no_boat') && platformKeyMap[scenario.platform] === 'boat') reasons.push('excluded by no_boat constraint');
  if (scenario.speciesId && !tactic.species.some(s => s.species_id === scenario.speciesId)) reasons.push('species does not match');
  return reasons;
}

// gate-4 addition, per instruction 4 ("do not invent a universal kayak/canoe wind threshold
// inside a fishing tactic... until [a safety layer] is properly researched, high-wind
// kayak/canoe recommendations must return a caution or insufficient-safety-data result rather
// than confidently recommending a tactic"). This is an honest placeholder pending the real
// safety_advisory entity described in design/angling-knowledge-base/v3/safety/README.md --
// it does NOT invent a wind-speed threshold beyond the existing 'high' enum value the mission
// already reports, and it does not attempt to reason about waterbody size, temperature, or
// paddler experience, none of which this pilot has real data for.
function isSmallCraftSafetyUnresolved(tactic, scenario) {
  const platformKeyMap = { kayak: 'kayak', canoe: 'canoe' };
  if (!platformKeyMap[scenario.platform]) return false;
  if (tactic.environment_applicability[platformKeyMap[scenario.platform]] === 'not_applicable') return false;
  const wind = scenario.observed_conditions.wind;
  return wind?.state === 'observed' && wind.value === 'high';
}

export function scoreTactic(tactic, scenario, candidatePoolAxisDensity) {
  const filterReasons = hardFilter(tactic, scenario);
  if (filterReasons.length) return { excluded: true, filterReasons };
  if (isSmallCraftSafetyUnresolved(tactic, scenario))
    return { excluded: true, insufficientSafetyData: true,
      filterReasons: [`kayak/canoe under high wind: no safety_advisory data exists to confirm or rule out this tactic (see design/angling-knowledge-base/v3/safety/README.md) -- returned as insufficient_safety_data, not scored/ranked as a confident recommendation`] };
  const matched = [], excluded = [];
  let numerator = 0, denominator = 0;
  for (const axis of AXES) {
    const r = axisScore(axis, tactic.applies_when[axis], scenario.observed_conditions[axis]);
    if (!r.included) { excluded.push({ axis, reason: r.reason }); continue; }
    matched.push({ axis, score: r.score });
    numerator += r.score; denominator += 1;
  }
  for (const sr of seasonScore(tactic.applies_when.season, scenario.observed_conditions.season || {})) {
    if (sr.included) { matched.push(sr); numerator += sr.score; denominator += 1; }
  }
  // Sparse-tactic fix: normalize against the candidate pool's overall axis density, not just this tactic's own count.
  const rawScore = denominator > 0 ? numerator / denominator : 0;
  const densityAdjustedScore = candidatePoolAxisDensity > 0 ? rawScore * Math.min(1, denominator / candidatePoolAxisDensity) : rawScore;
  const confidenceWeight = CONFIDENCE_WEIGHT[tactic.confidence] ?? 0.5;
  const finalScore = densityAdjustedScore * confidenceWeight;
  return { excluded: false, matched, excluded_axes: excluded, rawScore, denominator, finalScore, confidenceWeight };
}

export function rankTactics(tactics, scenario) {
  const avgDenominator = tactics.reduce((sum, t) => {
    let d = 0;
    for (const axis of AXES) if (t.applies_when[axis].state === 'constrained') d++;
    if (t.applies_when.season.biological_stage.state === 'constrained') d++;
    if (t.applies_when.season.water_temp_f.state === 'constrained') d++;
    return sum + d;
  }, 0) / tactics.length;
  const results = tactics.map(t => ({ tactic: t, ...scoreTactic(t, scenario, avgDenominator) }));
  const included = results.filter(r => !r.excluded).sort((a, b) => b.finalScore - a.finalScore);
  const cautions = results.filter(r => r.excluded && r.insufficientSafetyData);
  const excluded = results.filter(r => r.excluded && !r.insufficientSafetyData);
  return { ranked: included, excluded, cautions, scorer_version: SCORER_VERSION };
}
