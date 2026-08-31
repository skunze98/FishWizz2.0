// Runs the pilot tactics through 15 realistic mission scenarios (5 from the
// original readable-artifact design examples + 10 new walleye/sauger
// scenarios) using the real reference scorer, and prints exact ranked
// results -- scores, exclusions, missing inputs, source/claim chains.
import fs from 'node:fs';
import { rankTactics } from './scorer.mjs';

const pilot = JSON.parse(fs.readFileSync(new URL('./pilot-data.json', import.meta.url)));
const walleyeId = pilot.species.find(s => s.common_name_primary === 'Walleye').id;
const saugerId = pilot.species.find(s => s.common_name_primary === 'Sauger').id;
const claimsById = Object.fromEntries(pilot.claims.map(c => [c.id, c]));
const sourcesById = Object.fromEntries(pilot.sources.map(s => [s.id, s]));

const o = (state, value) => value === undefined ? { state } : { state, value };
function baseObserved(overrides = {}) {
  const base = {
    platform: o('missing'), water_environment: o('missing'),
    season: { biological_stage: o('missing'), water_temp_f: o('missing') },
    depth_ft: o('missing'), structure: o('missing'), cover: o('missing'), substrate: o('missing'),
    current: o('missing'), clarity: o('missing'), wind: o('missing'), light: o('missing'),
    barometric_pressure_trend: o('missing'), fishing_pressure: o('missing'),
    weather_front: o('missing'), water_level_trend: o('missing'), recent_precipitation: o('missing'),
    dissolved_oxygen_status: o('missing'), observed_fish_activity: o('missing'), time_of_day: o('missing'),
  };
  return Object.assign(base, overrides);
}

export const scenarios = [
  // -- 5 from the original readable-artifact design examples --
  { name: '1. Shore, walleye, after a MN cold front (water temp unknown, no live bait)', platform: 'shore', speciesId: walleyeId, user_constraint_tags: ['no_live_bait'],
    observed_conditions: baseObserved({ weather_front: o('observed', 'passed_recently'), barometric_pressure_trend: o('observed', 'rising') }) },
  { name: '2. Boat, smallmouth-style clear-lake summer conditions applied to walleye (72F, calm, bright, clear)', platform: 'boat', speciesId: walleyeId,
    observed_conditions: baseObserved({ season: { biological_stage: o('observed', 'mid_summer'), water_temp_f: o('observed', 72) }, clarity: o('observed', 'clear'), wind: o('observed', 'light'), light: o('observed', 'bright') }) },
  { name: '3. Kayak, strong wind', platform: 'kayak', speciesId: walleyeId,
    observed_conditions: baseObserved({ wind: o('observed', 'high') }) },
  { name: '4. Ice, crappie-style low-oxygen midwinter conditions applied to walleye', platform: 'ice', speciesId: walleyeId,
    observed_conditions: baseObserved({ season: { biological_stage: o('observed', 'midwinter_ice'), water_temp_f: o('observed', 35) }, dissolved_oxygen_status: o('observed', 'stressed_suspected'), observed_fish_activity: o('observed', 'inactive') }) },
  { name: '5. River, catfish-style rising water applied to sauger', platform: 'boat', speciesId: saugerId,
    observed_conditions: baseObserved({ water_environment: o('observed', 'river'), water_level_trend: o('observed', 'rising'), recent_precipitation: o('observed', 'heavy'), clarity: o('observed', 'turbid'), current: o('observed', 'strong') }) },
  // -- 10 new walleye/sauger-specific scenarios --
  { name: '6. Boat, walleye, exact match for the mid-summer deep-structure tactic', platform: 'boat', speciesId: walleyeId,
    observed_conditions: baseObserved({ season: { biological_stage: o('observed', 'mid_summer'), water_temp_f: o('observed', 70) }, depth_ft: o('observed', 20), structure: o('observed', 'hump'), current: o('observed', 'none'), clarity: o('observed', 'clear') }) },
  { name: '7. Ice, walleye, midwinter clear/deep -- the GENUINE conflict scenario (aggressive spoon vs. deadstick)', platform: 'ice', speciesId: walleyeId,
    observed_conditions: baseObserved({ season: { biological_stage: o('observed', 'midwinter_ice'), water_temp_f: o('observed', 36) }, depth_ft: o('observed', 20), structure: o('observed', 'hump'), clarity: o('observed', 'clear'), current: o('observed', 'none') }) },
  { name: '8. Dock, walleye, early summer low light near a drop-off', platform: 'dock', speciesId: walleyeId,
    observed_conditions: baseObserved({ season: { biological_stage: o('observed', 'early_summer'), water_temp_f: o('observed', 64) }, cover: o('observed', 'docks'), light: o('observed', 'low') }) },
  { name: '9. Shore, walleye, spring shallow sand flat, live bait allowed', platform: 'shore', speciesId: walleyeId,
    observed_conditions: baseObserved({ season: { biological_stage: o('observed', 'pre_spawn'), water_temp_f: o('observed', 46) }, depth_ft: o('observed', 4), structure: o('observed', 'flat'), substrate: o('observed', 'sand') }) },
  { name: '10. Boat, sauger, fall turbid river channel edge', platform: 'boat', speciesId: saugerId,
    observed_conditions: baseObserved({ water_environment: o('observed', 'river'), season: { biological_stage: o('observed', 'fall_turnover'), water_temp_f: o('observed', 46) }, structure: o('observed', 'channel_edge'), current: o('observed', 'moderate'), clarity: o('observed', 'turbid') }) },
  { name: '11. Kayak, walleye, clear calm summer point (finesse-tactic match)', platform: 'kayak', speciesId: walleyeId,
    observed_conditions: baseObserved({ season: { biological_stage: o('observed', 'mid_summer'), water_temp_f: o('observed', 71) }, structure: o('observed', 'point'), clarity: o('observed', 'clear'), wind: o('observed', 'calm') }) },
  { name: '12. Boat, walleye, turbid water, artificial_only constraint', platform: 'boat', speciesId: walleyeId, user_constraint_tags: ['artificial_only'],
    observed_conditions: baseObserved({ season: { biological_stage: o('observed', 'mid_summer'), water_temp_f: o('observed', 68) }, clarity: o('observed', 'turbid') }) },
  { name: '13. Wading, walleye/sauger, river pre-spawn current seam', platform: 'wading', speciesId: walleyeId,
    observed_conditions: baseObserved({ water_environment: o('observed', 'river'), season: { biological_stage: o('observed', 'pre_spawn'), water_temp_f: o('observed', 44) }, structure: o('observed', 'current_seam'), current: o('observed', 'moderate'), clarity: o('observed', 'stained') }) },
  { name: '14. Ice, sauger, early ice near a river mouth', platform: 'ice', speciesId: saugerId,
    observed_conditions: baseObserved({ season: { biological_stage: o('observed', 'early_ice'), water_temp_f: o('observed', 35) }, structure: o('observed', 'basin'), clarity: o('observed', 'stained') }) },
  { name: '15. No platform observed at all, walleye, only species known (tests all-missing behavior)', platform: 'boat', speciesId: walleyeId,
    observed_conditions: baseObserved() },
];

// gate-7: guard so other scripts can `import { scenarios } from './run-scenarios.mjs'` (to reuse
// the real scenario definitions) without also re-running/re-printing the whole scenario sweep as
// a side effect. Only executes when run directly (`node run-scenarios.mjs`).
const isMain = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;
if (isMain) {
console.log(`Reference scorer version: pilot-reference-0.1.0 (design-only, not the production scorer)\n`);
for (const scenario of scenarios) {
  const { ranked, excluded, cautions, scorer_version } = rankTactics(pilot.tactics, scenario);
  console.log(`\n${'='.repeat(78)}\n${scenario.name}`);
  console.log(`  scorer_version=${scorer_version}  platform=${scenario.platform}  constraints=${JSON.stringify(scenario.user_constraint_tags || [])}`);
  console.log(`  ${ranked.length} candidate(s) survived hard filters, ${excluded.length} excluded outright, ${cautions.length} returned insufficient_safety_data (gate-4 kayak/canoe high-wind placeholder).`);
  if (cautions.length) console.log(`  CAUTION: ${cautions.map(c => c.filterReasons[0]).join(' | ')}`);
  ranked.slice(0, 3).forEach((r, i) => {
    const t = r.tactic;
    const claimIds = t.evidence.map(e => e.claim_id);
    const sourceTitles = [...new Set(claimIds.map(cid => sourcesById[claimsById[cid].source_id]?.title))];
    console.log(`  #${i + 1} [score ${r.finalScore.toFixed(3)}] ${t.works_when.slice(0, 70)}...`);
    console.log(`      matched: ${r.matched.map(m => `${m.axis}=${m.score.toFixed(2)}`).join(', ') || '(none)'}`);
    console.log(`      excluded axes: ${r.excluded_axes.map(e => `${e.axis}:${e.reason}`).join(', ')}`);
    console.log(`      confidence=${t.confidence} (weight ${r.confidenceWeight})  sources: ${sourceTitles.join('; ')}`);
  });
  if (excluded.length) console.log(`  excluded: ${excluded.slice(0, 3).map(r => r.tactic.presentation_id.slice(0,8) + ':' + r.filterReasons.join(',')).join(' | ')}${excluded.length > 3 ? ` (+${excluded.length - 3} more)` : ''}`);
}

// Scenario 7 specifically: prove both conflicting tactics surface, neither silently wins.
console.log(`\n${'='.repeat(78)}\nCONFLICT CHECK -- scenario 7 (the genuine ice conflict)`);
const s7 = scenarios[6];
const { ranked: r7 } = rankTactics(pilot.tactics, s7);
const jiggingSpoonPresId = pilot.presentations.find(p => p.presentation_slug === 'jigging-spoon-aggressive').id;
const deadstickPresId = pilot.presentations.find(p => p.presentation_slug === 'jig-minnow-head-deadstick').id;
// The genuine conflict pair is specifically t4 (midwinter aggressive spoon) and t5 (midwinter deadstick) --
// match by presentation_id AND applies_when.season.biological_stage to exclude t12/t15's own deadstick variants for OTHER seasons.
const aggressiveSpoon = r7.find(r => r.tactic.presentation_id === jiggingSpoonPresId);
const deadstick = r7.find(r => r.tactic.presentation_id === deadstickPresId && r.tactic.applies_when.season.biological_stage.value === 'midwinter_ice');
console.log(`  Both conflicting tactics present in ranked results: ${!!aggressiveSpoon && !!deadstick}`);
if (aggressiveSpoon) console.log(`  Aggressive spoon: rank present, score ${aggressiveSpoon.finalScore.toFixed(3)}, confidence=${aggressiveSpoon.tactic.confidence}`);
if (deadstick) console.log(`  Deadstick: rank present, score ${deadstick.finalScore.toFixed(3)}, confidence=${deadstick.tactic.confidence}`);
const conflictRel = aggressiveSpoon?.tactic.alternatives.find(a => a.relationship_type === 'conflicts_with');
console.log(`  conflicts_with note present and explains the disagreement: ${!!conflictRel}`);
if (conflictRel) console.log(`  note: "${conflictRel.note.slice(0, 120)}..."`);
} // end isMain guard
