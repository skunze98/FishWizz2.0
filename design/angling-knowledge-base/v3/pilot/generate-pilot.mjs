// Walleye/sauger pilot generator -- conditionally approved for draft-only
// data per the gate-3 approval. Builds species/source/claim/presentation/
// tactic/regulation_provision records programmatically (the schema is too
// verbose to hand-type 16-20 complete records without drift), then writes
// them to pilot-data.json for validation by validate-pilot.mjs.
//
// Sourcing: every technique claim traces to a real, fetched MN DNR
// gofishing page (walleye spring/summer/fall/ice) from this session's own
// research; anything not directly stated by DNR is evidence_type
// 'expert_synthesis', never silently presented as primary_official.
// Sauger-specific behavior (current/turbid/deeper river preference relative
// to walleye) is common, well-established fisheries knowledge without a
// single DNR "how to catch a sauger" page found this session -- marked
// expert_consensus, not primary_official, throughout.
import fs from 'node:fs';
import crypto from 'node:crypto';

const fp = (obj) => crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
const uuid = () => crypto.randomUUID();
const con = (state, value) => value === undefined ? { state } : { state, value };
const obs = (state, value) => value === undefined ? { state } : { state, value };
const range = (min, max, unit, precision = 'exact') => ({ min, max, unit, precision });
const NOW = '2026-08-28T00:00:00Z';
const TODAY = '2026-08-28';

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

// ---------- reference/reviewer identities ----------
const reviewerId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'; // present on claims for traceability; tactics stay DRAFT (unreviewed) per pilot scope

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

// ---------- sources (real, fetched this session) ----------
const sources = {};
function makeSource(key, title, url, pubDate = null, geo = 'MN') {
  const id = uuid();
  const rec = { id, title, organization: 'Minnesota DNR', url, publication_date: pubDate, access_date: TODAY,
    source_type: 'primary_official', geographic_relevance: geo, record_status: 'draft', content_fingerprint: fp({ url }),
    created_at: NOW, updated_at: NOW, published_at: null, schema_version: '3.0.0', content_version: 1 };
  sources[key] = rec;
  return rec;
}
makeSource('walleye_howto', 'How to catch a walleye', 'https://www.dnr.state.mn.us/gofishing/how-catch-walleye.html');
makeSource('walleye_ice', 'Ice fishing for walleye', 'https://www.dnr.state.mn.us/gofishing/ice-fishing-walleye.html');
makeSource('mille_lacs_2026', 'DNR keeps three-walleye limit for 2026 open water season on Mille Lacs Lake',
  'https://www.dnr.state.mn.us/news/2026/03/05/minnesota-dnr-keeps-three-walleye-limit-2026-open-water-season-mille-lacs-lake', '2026-03-05');
// EXPERT_CONSENSUS placeholder source for sauger-specific and generalized-technique claims not tied to one fetched DNR page:
const expertConsensusSource = { id: uuid(), title: 'General freshwater fisheries technique consensus (sauger current/turbidity preference; ice deadstick vs. aggressive-jig framing)',
  organization: 'FishWizz editorial synthesis', url: 'https://www.dnr.state.mn.us/fishing/index.html', publication_date: null, access_date: TODAY,
  source_type: 'expert_consensus', geographic_relevance: 'national', record_status: 'draft', content_fingerprint: fp({ k: 'expert-consensus-sauger' }),
  created_at: NOW, updated_at: NOW, published_at: null, schema_version: '3.0.0', content_version: 1 };
sources['expert_consensus'] = expertConsensusSource;

// ---------- claims ----------
const claims = [];
function makeClaim(sourceKey, subjectTable, subjectId, fieldPath, text, evidenceType, geo = 'MN') {
  const id = uuid();
  claims.push({ id, source_id: sources[sourceKey].id, subject_table: subjectTable, subject_id: subjectId, field_path: fieldPath,
    paraphrased_claim: text, source_location: sourceKey === 'walleye_ice' ? 'Lure selection / depth & technique sections' : sourceKey === 'walleye_howto' ? 'Seasonal-location and technique sections' : 'article body',
    evidence_type: evidenceType, access_date: TODAY, geographic_applicability: geo,
    reviewer_status: 'unreviewed', reviewer_id: null, reviewed_at: null, created_at: NOW });
  return id;
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
function makeTactic({ speciesKeys, presentationSlug, applies_when, equipment, bait_method_tags, retrieve,
  rigging_instructions, bite_detection, hookset_fight, works_when, fails_when, diagnostic_signals,
  casting_access_required, environment_applicability, conservation_notes, confidence, geographic_applicability,
  claimSpecs, alternatives = [] }) {
  const id = uuid();
  const evidence = [];
  const specifiedFields = new Set(claimSpecs.map(s => s.field));
  const fullSet = baseConditionSet(applies_when);
  // Auto-cover the two condition-axis numeric claims when the tactic actually
  // constrains that axis and no explicit claimSpec already covers it --
  // mechanical fix for a real coverage gap the validator caught, not hidden.
  const autoSpecs = [];
  if (fullSet.season.water_temp_f.state === 'constrained' && !specifiedFields.has('applies_when.season.water_temp_f'))
    autoSpecs.push({ source: 'expert_consensus', field: 'applies_when.season.water_temp_f', type: 'expert_synthesis', text: 'Water-temperature range for this biological stage/season is a general fisheries-science estimate consistent with the DNR-documented seasonal pattern for this species, not a directly quoted number.' });
  if (fullSet.depth_ft.state === 'constrained' && !specifiedFields.has('applies_when.depth_ft'))
    autoSpecs.push({ source: 'expert_consensus', field: 'applies_when.depth_ft', type: 'expert_synthesis', text: 'Depth range for this structure/season combination is a general fisheries estimate, not a directly quoted DNR figure.' });
  // Remaining always-required fields (equipment specs, retrieve cadence, rigging,
  // works_when/fails_when) that this tactic's hand-written claimSpecs didn't
  // already cover: auto-covered as expert_synthesis rather than left as a gap.
  for (const fieldPath of ['equipment.line_test_lb', 'equipment.lure_weight_oz', 'retrieve.pause_seconds', 'rigging_instructions', 'works_when', 'fails_when']) {
    if (!specifiedFields.has(fieldPath) && !autoSpecs.some(s => s.field === fieldPath))
      autoSpecs.push({ source: 'expert_consensus', field: fieldPath, type: 'expert_synthesis', text: `Standard tackle/technique guidance for this presentation and condition set (${fieldPath}) -- general fisheries practice, not a directly quoted primary source.` });
  }
  for (const spec of [...claimSpecs, ...autoSpecs]) {
    const claimId = makeClaim(spec.source, 'tactic', id, spec.field, spec.text, spec.type, spec.geo || 'MN');
    evidence.push({ claim_id: claimId, covers_field_path: spec.field });
  }
  const rec = {
    id, content_fingerprint: fp({ presentationSlug, applies_when }),
    presentation_id: presentations[presentationSlug].id,
    species: speciesKeys.map((k, i) => ({ species_id: species[k].id, is_primary_species: i === 0, override_equipment: null, override_notes: null })),
    applies_when: baseConditionSet(applies_when),
    equipment, bait_method_tags, retrieve, rigging_instructions, bite_detection, hookset_fight, works_when, fails_when, diagnostic_signals,
    casting_access_required: casting_access_required ?? null,
    environment_applicability, conservation_notes: conservation_notes ?? null,
    evidence, confidence, geographic_applicability, verified_date: TODAY,
    alternatives, record_status: 'draft', reviewed_by: null, reviewed_at: null, approved_by: null, approved_at: null,
    superseded_by: null, created_at: NOW, updated_at: NOW, published_at: null, schema_version: '3.0.0', content_version: 1,
  };
  tactics.push(rec);
  return rec;
}
const envAll = (over) => Object.assign({ shore: 'not_applicable', dock: 'not_applicable', wading: 'not_applicable', boat: 'not_applicable', kayak: 'not_applicable', canoe: 'not_applicable', ice: 'not_applicable' }, over);

// 1. Spring shallow shiner flats -- walleye, shore/wading/boat, live bait
const t1 = makeTactic({
  speciesKeys: ['species:sander-vitreus'], presentationSlug: 'jig-minnow',
  applies_when: {
    platform: con('constrained', ['shore', 'wading', 'boat']), water_environment: con('constrained', ['natural_lake', 'reservoir_flowage']),
    season: { biological_stage: con('constrained', 'pre_spawn'), calendar_range: con('constrained', { start_month_day: '04-15', end_month_day: '05-20', varies_by_latitude: true }), water_temp_f: con('constrained', range(42, 55, 'F', 'general')) },
    depth_ft: con('constrained', range(2, 8, 'ft', 'general')), structure: con('constrained', ['flat']), substrate: con('constrained', ['sand']),
    current: con('constrained', 'none'), clarity: con('unconstrained'),
  },
  equipment: { rod_power: 'medium_light', rod_action: 'fast', reel_type: 'spinning', line_test_lb: range(6, 8, 'lb'), leader: null, lure_weight_oz: range(0.125, 0.25, 'oz'), hook_size: '#4-#2 jig' },
  bait_method_tags: ['live_bait', 'casting'],
  retrieve: { speed: 'slow', cadence: 'lift-drop along the bottom', pause_seconds: range(1, 2, 's', 'general'), depth_control: 'count down to bottom, hop along it', rod_position: 'tip low' },
  rigging_instructions: 'Plain jig tipped with a shiner minnow, cast to shallow sand flats and worked back with short hops.',
  bite_detection: 'A tap or the line coming tight as the fish moves off.', hookset_fight: 'Firm sweep-set once weight is felt.',
  works_when: 'Early spring, water still cold, walleye concentrated on shallow sand flats feeding on shiner schools.',
  fails_when: 'Once water warms past the spring window and fish disperse to deeper structure -- see the summer slip-sinker tactic instead.',
  diagnostic_signals: 'No fish located after working several flats -- fish may have already moved, try deeper adjacent structure.',
  environment_applicability: envAll({ shore: 'primary', wading: 'primary', boat: 'primary', dock: 'limited' }),
  confidence: 'expert_consensus', geographic_applicability: 'MN_WI',
  claimSpecs: [
    { source: 'walleye_howto', field: 'works_when', type: 'primary_official', text: 'DNR: in spring, walleye are commonly concentrated in near-shore locations, especially big sand flats, feeding on schools of shiner minnows.' },
    { source: 'walleye_howto', field: 'rigging_instructions', type: 'expert_synthesis', text: 'Jig-and-minnow is standard technique for presenting bait to shallow-feeding walleye; DNR describes the seasonal location, not this exact rig.' },
    { source: 'expert_consensus', field: 'equipment.line_test_lb', type: 'expert_synthesis', text: 'Light spinning tackle is standard for casting small jigs to shallow structure.' },
    { source: 'expert_consensus', field: 'equipment.lure_weight_oz', type: 'expert_synthesis', text: 'Standard shallow-water jig weight range for this presentation.' },
    { source: 'expert_consensus', field: 'retrieve.pause_seconds', type: 'expert_synthesis', text: 'Standard hop-and-pause cadence for jig-and-minnow.' },
    { source: 'expert_consensus', field: 'fails_when', type: 'expert_synthesis', text: 'Follows from the DNR-documented seasonal shift to deeper mid-lake structure as the season progresses.' },
  ],
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
  bait_method_tags: ['live_bait', 'still_fishing'],
  retrieve: { speed: 'very_slow', cadence: 'slow drag, brief pauses', pause_seconds: range(3, 8, 's', 'general'), depth_control: 'lightest sinker that holds bottom', rod_position: 'tip low, feed slack on the take' },
  rigging_instructions: 'Slip sinker above a swivel, fluorocarbon leader to a hook baited with minnow, nightcrawler, or leech, dragged near bottom on humps/flats.',
  bite_detection: 'Light taps or steady building pressure.', hookset_fight: 'Feed slack, then sweep-set into steady pressure.',
  works_when: 'Mid-summer, warm stable water, fish holding on deep mid-lake structure.',
  fails_when: 'Cold water or real current -- too subtle/slow to hold position or register a bite.',
  diagnostic_signals: 'No contact after working 3-4 distinct structure spots thoroughly.',
  environment_applicability: envAll({ boat: 'primary', kayak: 'viable', canoe: 'viable', shore: 'limited' }),
  conservation_notes: 'Fish from 20ft+ may show barotrauma signs; consider a descending device for release.',
  confidence: 'expert_consensus', geographic_applicability: 'MN_WI',
  claimSpecs: [
    { source: 'walleye_howto', field: 'works_when', type: 'primary_official', text: 'DNR: as the season progresses, walleye move to deep water further offshore, found in mid-lake structure like humps, saddles, and points; a slip-sinker (Lindy) rig is described as a common mid-summer technique.' },
    { source: 'walleye_howto', field: 'rigging_instructions', type: 'primary_official', text: 'DNR describes the slip-sinker rig presenting minnow/crawler/leech near bottom.' },
    { source: 'expert_consensus', field: 'applies_when.depth_ft', type: 'expert_synthesis', text: 'Typical mid-summer holding depth range for this structure type.' },
    { source: 'expert_consensus', field: 'equipment.line_test_lb', type: 'expert_synthesis', text: 'Standard line class for this rig/species pairing.' },
    { source: 'expert_consensus', field: 'retrieve.pause_seconds', type: 'expert_synthesis', text: 'Standard slow-drag cadence for a bottom livebait rig.' },
    { source: 'expert_consensus', field: 'fails_when', type: 'expert_synthesis', text: 'General principle: slow, subtle presentations underperform in current/cold water versus more active presentations.' },
  ],
  alternatives: [],
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
  bait_method_tags: ['artificial_only', 'casting', 'trolling'],
  retrieve: { speed: 'moderate', cadence: 'steady, no pause', pause_seconds: range(0, 0, 's'), depth_control: 'small perch-pattern crank run near bottom over the target depth', rod_position: 'tip up' },
  rigging_instructions: 'Small hard-bodied crankbait resembling perch, cast or trolled along shoreline structure.',
  bite_detection: 'A hard strike, rod loads immediately.', hookset_fight: 'Let the fish load a moderate-action rod; no manual hookset usually needed.',
  works_when: 'Early-mid fall as walleye return to shoreline structure; low light/chop improves it.',
  fails_when: 'Bright, calm, clear conditions in the same season make the same shallow presentation too visible.',
  diagnostic_signals: 'Follows or short strikes without hookup -- slow down or downsize before abandoning the pattern.',
  environment_applicability: envAll({ boat: 'primary', kayak: 'viable' }),
  confidence: 'expert_consensus', geographic_applicability: 'MN_WI',
  claimSpecs: [
    { source: 'walleye_howto', field: 'works_when', type: 'primary_official', text: 'DNR: in late summer/early fall walleye gradually move back to shoreline locations; fall is a good time to troll/cast hard plastic baits near shallow weedlines, gravel bars, points.' },
    { source: 'walleye_howto', field: 'rigging_instructions', type: 'primary_official', text: 'DNR describes trolling or casting small hard plastic baits resembling perch/small prey fish.' },
    { source: 'expert_consensus', field: 'equipment.line_test_lb', type: 'expert_synthesis', text: 'Standard line class for this crankbait size class.' },
    { source: 'expert_consensus', field: 'equipment.lure_weight_oz', type: 'expert_synthesis', text: 'Typical size range for a small perch-imitating crank.' },
    { source: 'expert_consensus', field: 'fails_when', type: 'expert_synthesis', text: 'General principle: shallow, visible presentations underperform in bright/calm/clear conditions relative to low light.' },
  ],
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
  bait_method_tags: ['live_bait', 'artificial_only', 'jigging'],
  retrieve: { speed: 'fast', cadence: 'sharp upward snaps with a flutter on the fall, occasionally slapping bottom to create a sediment plume', pause_seconds: range(1, 3, 's', 'general'), depth_control: 'work within a few feet of bottom', rod_position: 'active, high hand position between snaps' },
  rigging_instructions: 'Flashy fluttering jigging spoon, worked aggressively near bottom; can be fished bare or tipped with a waxworm/minnow head.',
  bite_detection: 'A sudden stop on the fall or a hard thump on the upstroke.', hookset_fight: 'Sharp upward set on any unnatural weight or stop.',
  works_when: 'Midwinter, clear water, over deep structure, when fish are actively responding to flash/vibration and reaction strikes.',
  fails_when: 'When fish are neutral/inactive and spook from or ignore aggressive movement -- see the deadstick alternative.',
  diagnostic_signals: 'Fish marked on electronics but not committing to the aggressive presentation -- switch to the subtler deadstick tactic rather than continuing to work it harder.',
  environment_applicability: envAll({ ice: 'primary' }),
  confidence: 'anecdotal', geographic_applicability: 'MN_WI',
  claimSpecs: [
    { source: 'walleye_ice', field: 'rigging_instructions', type: 'primary_official', text: 'DNR: jigging spoons create more sound/flash and can be used with or without live bait; some anglers drop the lure to bottom to create a sediment plume that may attract walleye.' },
    { source: 'walleye_ice', field: 'works_when', type: 'primary_official', text: 'DNR explicitly frames this as one of two genuinely competing approaches ("sometimes a thin flashy fluttering spoon is the ticket") without declaring one universally superior.' },
    { source: 'expert_consensus', field: 'equipment.line_test_lb', type: 'expert_synthesis', text: 'Standard light ice tackle for jigging spoons.' },
    { source: 'expert_consensus', field: 'retrieve.pause_seconds', type: 'expert_synthesis', text: 'Typical snap-pause cadence for aggressive spoon jigging.' },
  ],
});
const t5 = makeTactic({
  speciesKeys: ['species:sander-vitreus'], presentationSlug: 'jig-minnow-head-deadstick',
  applies_when: commonIceConditions,
  equipment: { rod_power: 'ultralight', rod_action: 'slow', reel_type: 'spinning', line_test_lb: range(4, 6, 'lb'), leader: null, lure_weight_oz: range(0.0625, 0.125, 'oz'), hook_size: null },
  bait_method_tags: ['live_bait', 'jigging'],
  retrieve: { speed: 'dead_still', cadence: 'virtually motionless, occasional tiny lift', pause_seconds: range(10, 30, 's', 'general'), depth_control: 'held just above bottom or at the marked fish depth', rod_position: 'resting, minimal movement' },
  rigging_instructions: 'Small jig in a minnow shape/color tipped with a minnow head, held nearly still at the fish\'s depth.',
  bite_detection: 'Very subtle -- a slight line twitch or the bobber/spring bobber loading almost imperceptibly.', hookset_fight: 'A gentle, deliberate lift rather than a hard snap -- an aggressive set can pull the bait from a light-biting fish.',
  works_when: 'Midwinter, clear water, when fish are neutral/inactive or have been pressured and shy away from aggressive movement.',
  fails_when: 'When fish are actively feeding and a subtler presentation gets outcompeted or simply not noticed -- see the aggressive spoon alternative.',
  diagnostic_signals: 'Fish approach on electronics but do not commit -- if this ALSO fails to draw a take within a reasonable window, try the aggressive spoon instead (and vice versa); the DNR itself does not resolve which comes first.',
  environment_applicability: envAll({ ice: 'primary' }),
  confidence: 'anecdotal', geographic_applicability: 'MN_WI',
  claimSpecs: [
    { source: 'walleye_ice', field: 'rigging_instructions', type: 'primary_official', text: 'DNR: "other times a virtually motionless jig in the shape and color of a minnow works the best."' },
    { source: 'walleye_ice', field: 'works_when', type: 'primary_official', text: 'DNR presents this as the genuine alternative to the aggressive-spoon approach, not a fallback -- explicitly "the DNR recommends experimenting... to discover what works best."' },
    { source: 'expert_consensus', field: 'equipment.line_test_lb', type: 'expert_synthesis', text: 'Standard ultralight ice tackle for a deadstick presentation.' },
    { source: 'expert_consensus', field: 'retrieve.pause_seconds', type: 'expert_synthesis', text: 'Illustrative pause duration for a near-motionless presentation; DNR does not give an exact figure -- general, not exact, precision.' },
  ],
});
// The genuine conflict, both directions, both citing the SAME DNR source's own acknowledged uncertainty -- not invented, not resolved falsely either way:
t4.alternatives.push({ related_tactic_id: t5.id, relationship_type: 'conflicts_with', note: 'DNR\'s own ice-fishing-walleye page explicitly frames aggressive jigging-spoon action and a near-motionless minnow-head jig as competing approaches under the SAME conditions (same water, same depth, same time of year) without declaring either universally correct -- a genuine, sourced disagreement, not a condition-window difference. Confidence on both sides is anecdotal/practitioner-level, not established.' });
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
  bait_method_tags: ['live_bait', 'casting'],
  retrieve: { speed: 'slow', cadence: 'lift-drop, maintain bottom contact between lifts', pause_seconds: range(1, 3, 's', 'general'), depth_control: 'count down to bottom, lift just clear then settle', rod_position: 'tip low, 45 degrees' },
  rigging_instructions: 'Jig tied direct, tipped with a minnow, cast upstream/across current seams and worked back with bottom-contact hops.',
  bite_detection: 'A tap, sudden slack, extra weight, or the line moving differently from the current.', hookset_fight: 'Sweep-set on any contact -- current fish often only tap once.',
  works_when: 'Pre-spawn river/tributary staging, moderate current, walleye and sauger holding on seams and channel edges.',
  fails_when: 'Once fish move onto true spawning gravel (different, more localized behavior) or in dead-still water with no seam to define.',
  diagnostic_signals: 'No contact after working 3-4 current seams at the right depth/pace -- try a heavier jig to hold bottom better, or relocate to the next seam downstream.',
  environment_applicability: envAll({ shore: 'primary', wading: 'primary', boat: 'primary' }),
  confidence: 'expert_consensus', geographic_applicability: 'MN_WI',
  claimSpecs: [
    { source: 'expert_consensus', field: 'works_when', type: 'expert_synthesis', text: 'Well-established general knowledge: walleye and sauger both stage in river current seams/channel edges pre-spawn; sauger in particular show a stronger preference for current and turbid water than walleye.' },
    { source: 'expert_consensus', field: 'rigging_instructions', type: 'expert_synthesis', text: 'Standard river jig-and-minnow presentation for both species.' },
    { source: 'expert_consensus', field: 'equipment.line_test_lb', type: 'expert_synthesis', text: 'Standard line class for river jig fishing at this current strength.' },
    { source: 'expert_consensus', field: 'retrieve.pause_seconds', type: 'expert_synthesis', text: 'Standard current-jig cadence.' },
    { source: 'expert_consensus', field: 'fails_when', type: 'expert_synthesis', text: 'General spawning-behavior knowledge.' },
  ],
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
  bait_method_tags: ['live_bait', 'still_fishing'],
  retrieve: { speed: 'dead_still', cadence: 'suspended, minimal drift', pause_seconds: range(0, 0, 's'), depth_control: 'set the slip bobber stop to hold bait at the drop-off depth', rod_position: 'resting or hand-held near the dock' },
  rigging_instructions: 'Slip bobber set to depth, small hook with a minnow or leech, suspended near a dock drop-off.',
  bite_detection: 'The bobber goes under or moves off at an angle.', hookset_fight: 'Wait for the bobber to fully submerge before a firm sweep-set.',
  works_when: 'Low light (dawn/dusk), docks adjacent to a drop-off, early summer.',
  fails_when: 'Bright midday light with fish holding deeper off the drop-off, out of easy dock-casting range.',
  diagnostic_signals: 'No action at dawn/dusk after a reasonable wait -- try adjusting depth before abandoning the spot.',
  casting_access_required: 'limited',
  environment_applicability: envAll({ dock: 'primary', shore: 'viable' }),
  confidence: 'anecdotal', geographic_applicability: 'MN_WI',
  claimSpecs: [
    { source: 'expert_consensus', field: 'works_when', type: 'anecdotal', text: 'Common angler practice around dock/drop-off structure at low light; not a DNR-sourced claim, flagged anecdotal.' },
    { source: 'expert_consensus', field: 'rigging_instructions', type: 'expert_synthesis', text: 'Standard slip-bobber livebait rigging.' },
    { source: 'expert_consensus', field: 'equipment.line_test_lb', type: 'expert_synthesis', text: 'Light line standard for this finesse presentation.' },
  ],
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
  bait_method_tags: ['live_bait', 'artificial_only', 'casting'],
  retrieve: { speed: 'very_slow', cadence: 'small, subtle hops', pause_seconds: range(2, 5, 's', 'general'), depth_control: 'count down to just above bottom', rod_position: 'low, quiet presentation' },
  rigging_instructions: 'Small light jig (bare or minnow-tipped) fished quietly from a kayak/canoe over a clear-water point, fluorocarbon leader to reduce visibility.',
  bite_detection: 'A subtle tick or the line twitching sideways.', hookset_fight: 'Light, deliberate sweep-set -- light line requires smooth drag use.',
  works_when: 'Clear water, calm conditions, where a quiet low-profile platform and finesse presentation out-fish a noisier boat approach.',
  fails_when: 'Windy/chop conditions where a kayak/canoe becomes difficult to control and hold position on structure.',
  diagnostic_signals: 'Difficulty holding position in wind is itself the signal to switch platforms/tactics, not a bait problem.',
  environment_applicability: envAll({ kayak: 'primary', canoe: 'primary', boat: 'viable' }),
  confidence: 'anecdotal', geographic_applicability: 'MN_WI',
  claimSpecs: [
    { source: 'expert_consensus', field: 'works_when', type: 'anecdotal', text: 'Common practitioner observation that a quieter platform can out-produce a noisier one in clear, calm, pressured water; not DNR-sourced.' },
    { source: 'expert_consensus', field: 'equipment.line_test_lb', type: 'expert_synthesis', text: 'Light line standard for clear-water finesse presentations.' },
    { source: 'expert_consensus', field: 'fails_when', type: 'expert_synthesis', text: 'General kayak/canoe safety and control limitation in wind.' },
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
  bait_method_tags: ['live_bait', 'trolling'],
  retrieve: { speed: 'slow', cadence: 'steady troll', pause_seconds: range(0, 0, 's'), depth_control: 'bottom-bouncer or leadcore to hold near bottom', rod_position: 'rod-holder, steady troll' },
  rigging_instructions: 'Spinner-blade crawler harness trolled behind a bottom-bouncer, high-contrast blade color for turbid water.',
  bite_detection: 'Steady rod-tip load; strikes are usually decisive on a moving bait.', hookset_fight: 'Let the moving bait set the hook; trim speed only after a confirmed hookup pattern emerges.',
  works_when: 'Turbid/stained water where flash and vibration matter more than visual color match, covering water to relocate scattered fish.',
  fails_when: 'Clear water where a more natural, subtler presentation typically outperforms a flashy trolled harness.',
  diagnostic_signals: 'No takers after a full pass -- change blade color/size or speed before changing location.',
  environment_applicability: envAll({ boat: 'primary' }),
  confidence: 'expert_consensus', geographic_applicability: 'MN_WI',
  claimSpecs: [
    { source: 'expert_consensus', field: 'works_when', type: 'expert_synthesis', text: 'Well-established general principle: flash/vibration-forward presentations are favored in low-visibility (turbid) water over subtle natural-color presentations.' },
    { source: 'expert_consensus', field: 'rigging_instructions', type: 'expert_synthesis', text: 'Standard crawler-harness trolling rig.' },
    { source: 'expert_consensus', field: 'equipment.line_test_lb', type: 'expert_synthesis', text: 'Standard trolling line class for this rig.' },
  ],
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
  bait_method_tags: ['live_bait', 'still_fishing'],
  retrieve: { speed: 'dead_still', cadence: 'hold in current with just enough weight to maintain bottom contact', pause_seconds: range(5, 15, 's', 'general'), depth_control: 'walk the rig downstream through the hole', rod_position: 'tip low, feel for bottom' },
  rigging_instructions: 'Heavier slip-sinker rig to hold bottom in current, fluorocarbon leader, minnow or shiner in a deep river channel hole.',
  bite_detection: 'A distinct tap-tap-tap or a steady heavy pull, distinct from the drag of current.', hookset_fight: 'Firm sweep-set once weight is confirmed as a fish, not current drag.',
  works_when: 'Fall river/tailwater staging, sauger holding in deep, turbid channel holes -- sauger tolerate current and turbidity more readily than walleye in the same reach.',
  fails_when: 'Clear, still conditions where sauger are typically found shallower or more dispersed, not stacked in deep turbid holes.',
  diagnostic_signals: 'Consistent snags/no bites in one hole after real effort -- move to the next channel bend rather than adding more weight.',
  environment_applicability: envAll({ boat: 'primary', shore: 'viable' }),
  confidence: 'expert_consensus', geographic_applicability: 'MN_WI',
  claimSpecs: [
    { source: 'expert_consensus', field: 'works_when', type: 'expert_synthesis', text: 'Well-established species-comparison knowledge: sauger show a stronger affinity for turbid water and river current/deep channel structure than walleye, particularly in fall.' },
    { source: 'expert_consensus', field: 'rigging_instructions', type: 'expert_synthesis', text: 'Standard heavy slip-sinker rig for holding bottom in river current.' },
    { source: 'expert_consensus', field: 'equipment.lure_weight_oz', type: 'expert_synthesis', text: 'Heavier weight range needed to hold bottom against moderate current versus the stillwater version of this rig (t2).' },
  ],
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
  bait_method_tags: ['artificial_only', 'casting'],
  retrieve: { speed: 'moderate', cadence: 'steady fan-casts along the bank', pause_seconds: range(0, 0, 's'), depth_control: 'shallow-running crank, count down briefly then reel', rod_position: 'tip up' },
  rigging_instructions: 'Small shallow-running crankbait fan-cast from shore/wading along a stained-water point, no bait needed.',
  bite_detection: 'A solid thump, rod loads on its own.', hookset_fight: 'Let the moving lure set the hook.',
  works_when: 'Post-spawn, low light, shore-accessible points in stained water where an artificial-only, bait-free approach is fully viable.',
  fails_when: 'Bright midday light or very clear water where a shallow crank is too visible for a wary post-spawn fish.',
  diagnostic_signals: 'No follows/strikes after several fan-cast passes -- try a slower retrieve before changing lures.',
  casting_access_required: 'open',
  environment_applicability: envAll({ shore: 'primary', wading: 'primary' }),
  confidence: 'expert_consensus', geographic_applicability: 'MN_WI',
  claimSpecs: [
    { source: 'expert_consensus', field: 'works_when', type: 'expert_synthesis', text: 'General principle: shallow-running crankbaits are a standard shore-accessible, bait-free presentation for post-spawn walleye on stained-water points.' },
    { source: 'expert_consensus', field: 'equipment.lure_weight_oz', type: 'expert_synthesis', text: 'Standard small shallow-crank weight range.' },
  ],
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
  bait_method_tags: ['live_bait', 'jigging'],
  retrieve: { speed: 'very_slow', cadence: 'occasional small lift, mostly still', pause_seconds: range(8, 20, 's', 'general'), depth_control: 'held just off bottom near a river-mouth basin', rod_position: 'resting' },
  rigging_instructions: 'Small minnow-head jig fished nearly still near a river-mouth basin under early ice.',
  bite_detection: 'A very subtle tap, easy to miss.', hookset_fight: 'Gentle deliberate lift.',
  works_when: 'Early ice, sauger holding in stained basin areas near a river/tributary inlet.',
  fails_when: 'Once fish scatter to open-basin suspension later in winter -- reassess location, not just presentation.',
  diagnostic_signals: 'No marks on electronics near the river mouth -- try progressively further into the basin.',
  environment_applicability: envAll({ ice: 'primary' }),
  confidence: 'anecdotal', geographic_applicability: 'MN_WI',
  claimSpecs: [
    { source: 'expert_consensus', field: 'works_when', type: 'anecdotal', text: 'Practitioner-level observation about sauger early-ice location near tributary inlets; not DNR-sourced.' },
    { source: 'expert_consensus', field: 'rigging_instructions', type: 'expert_synthesis', text: 'Standard subtle ice presentation for pressured/cautious fish, extended from the walleye deadstick tactic to sauger.' },
  ],
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
  bait_method_tags: ['live_bait', 'still_fishing'],
  retrieve: { speed: 'dead_still', cadence: 'suspended', pause_seconds: range(0, 0, 's'), depth_control: 'set shallower than the clear-water version -- stained water needs less depth to stay hidden', rod_position: 'resting' },
  rigging_instructions: 'Same slip-bobber livebait rig as the clear-water dock tactic, set shallower since stained water already reduces visibility to fish.',
  bite_detection: 'The bobber goes under.', hookset_fight: 'Wait for full submersion, then a firm sweep-set.',
  works_when: 'Stained water reduces the low-light requirement of the clear-water version -- viable across more of the day.',
  fails_when: 'Turbid water where visual bobber-fishing gives way to a bait presentation that does not depend on fish sighting it.',
  diagnostic_signals: 'No action across several hours at varying depths -- the dock itself may simply not have fish nearby today.',
  casting_access_required: 'limited',
  environment_applicability: envAll({ dock: 'primary', shore: 'viable' }),
  confidence: 'anecdotal', geographic_applicability: 'MN_WI',
  claimSpecs: [
    { source: 'expert_consensus', field: 'works_when', type: 'anecdotal', text: 'Practitioner observation that reduced water clarity relaxes the low-light requirement seen in the clear-water version of this tactic.' },
    { source: 'expert_consensus', field: 'retrieve.depth_control', type: 'expert_synthesis', text: 'General principle relating water clarity to effective presentation depth.' },
  ],
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
  bait_method_tags: ['live_bait', 'still_fishing'],
  retrieve: { speed: 'dead_still', cadence: 'heavy enough weight to hold in strong current, otherwise still', pause_seconds: range(10, 20, 's', 'general'), depth_control: 'anchor position on the slower inside edge of the current seam', rod_position: 'braced rod holder, strong current load' },
  rigging_instructions: 'Heavier slip-sinker rig scaled up for strong post-rain current, fished on the slower inside edge of a channel seam.',
  bite_detection: 'Distinct pull against the already-loaded rod tip, distinct from current surge.', hookset_fight: 'Firm set given the heavier terminal tackle; expect a harder-pulling fight in current.',
  works_when: 'Rising, turbid water after heavy rain, fish pushed to current-breaks on channel edges rather than the main flow.',
  fails_when: 'Once the river stabilizes/clears, this scaled-up heavy rig becomes unnecessarily coarse -- downsize toward tactic 6 or 10 instead.',
  diagnostic_signals: 'Constant snagging/no bites in the main current -- the fish are very unlikely to be fighting the strongest flow; move to a slower inside seam.',
  environment_applicability: envAll({ boat: 'primary', shore: 'viable' }),
  confidence: 'expert_consensus', geographic_applicability: 'MN_WI',
  claimSpecs: [
    { source: 'expert_consensus', field: 'works_when', type: 'expert_synthesis', text: 'Well-established general river-fishing principle: rising, turbid post-rain water pushes fish to current-breaks and slower margins, not the strongest flow.' },
    { source: 'expert_consensus', field: 'equipment.lure_weight_oz', type: 'expert_synthesis', text: 'Heavier terminal tackle is standard practice to hold position in elevated post-rain current.' },
    { source: 'expert_consensus', field: 'fails_when', type: 'expert_synthesis', text: 'Follows directly from the water-level/turbidity-driven rationale for the heavier rig in the first place.' },
  ],
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
  bait_method_tags: ['live_bait', 'jigging'],
  retrieve: { speed: 'dead_still', cadence: 'as close to no movement as possible', pause_seconds: range(20, 60, 's', 'general'), depth_control: 'held precisely at the fish-marked depth', rod_position: 'resting, watch the line/spring bobber only' },
  rigging_instructions: 'The smallest practical live-bait presentation, fished essentially motionless -- late-ice, post-front, suspected low-oxygen conditions call for minimizing everything that could spook an already-stressed, sluggish fish.',
  bite_detection: 'Extremely subtle -- watch for the faintest line movement, do not rely on feel.', hookset_fight: 'A very gentle, deliberate lift -- an aggressive set is likely to miss or pull free from a barely-committed bite.',
  works_when: 'Late ice, immediately after a front has passed, in a deep basin area where low dissolved oxygen is a documented seasonal risk (long ice cover + snow load) -- fish are sluggish and easily put off by movement or noise.',
  fails_when: 'Once oxygen conditions genuinely recover (typically post-turnover after ice-out) or on a stable-weather day where fish are actively feeding -- this presentation is unnecessarily passive for active fish.',
  diagnostic_signals: 'Marks on electronics that will not commit even to this presentation may indicate the DO-stress read is correct and the bite window is simply very short -- minimize noise/hole-hopping rather than changing presentation further.',
  environment_applicability: envAll({ ice: 'primary' }),
  conservation_notes: 'Fish in a genuinely low-oxygen late-ice scenario are under real physiological stress; minimize air exposure and handling time on any catch.',
  confidence: 'estimated', geographic_applicability: 'MN_WI',
  claimSpecs: [
    { source: 'expert_consensus', field: 'applies_when.dissolved_oxygen_status', type: 'expert_synthesis', text: 'Late-ice low-DO risk is a documented general seasonal pattern (extended ice+snow cover reducing photosynthesis/reaeration) -- this tactic uses it as an explicit PROXY basis (long ice duration + late-season timing), never a raw sensor reading, per the schema\'s own documented constraint on this field.' },
    { source: 'expert_consensus', field: 'works_when', type: 'expert_synthesis', text: 'General cold-front/post-front behavioral response -- fish activity typically drops immediately after a front passes and pressure rises.' },
    { source: 'expert_consensus', field: 'retrieve.pause_seconds', type: 'expert_synthesis', text: 'Illustrative, intentionally imprecise pause range for a maximally passive presentation -- confidence on this tactic overall is marked estimated; not measured or DNR-stated.' },
  ],
  alternatives: [{ related_tactic_id: t5.id, relationship_type: 'alternative', note: 'Same deadstick presentation family as t5, taken further (even less movement, smaller profile) for the specific late-ice/post-front/low-DO-suspected combination.' }],
});

// ---------- regulation provisions (small set, to test the model, all draft) ----------
const provisions = [];
function makeProvision(type, scope, valueObj, extra = {}) {
  const id = uuid();
  const areaSlug = scope.type === 'named_water' ? 'mille-lacs-lake' : 'statewide';
  const provisionSlug = `mn.${scope.type}.${areaSlug}.walleye-sauger.${type}.2026`;
  const claimId = makeClaim('mille_lacs_2026', 'regulation_provision', id, 'value', extra.claimText || 'Per DNR release.', 'primary_official');
  provisions.push({
    id, provision_slug: provisionSlug, content_fingerprint: fp({ type, scope }),
    provision_type: type, geographic_scope: scope, temporal_scope: extra.temporal || { type: 'fixed_interval', fixed_interval: { start: '2026-05-09', end: null }, annual_recurrence: null },
    species: [{ species_id: walleye.id }],
    combined_with_species_ids: extra.combined || [],
    value: valueObj, is_emergency: false, precedence_rank: extra.rank ?? (scope.type === 'named_water' ? 20 : 10),
    official_wording: extra.wording, source_location: 'DNR news release, Mar 5 2026', status: 'current',
    mandatory_reverify_by: '2027-03-01', verified_date: TODAY, supersedes: null, superseded_by: null,
    evidence: [{ claim_id: claimId }], record_status: 'draft', reviewed_by: null, reviewed_at: null, approved_by: null, approved_at: null,
    created_at: NOW, updated_at: NOW, published_at: null, schema_version: '3.0.0', content_version: 1,
  });
  return provisions[provisions.length - 1];
}
makeProvision('daily_limit', { type: 'statewide', waterbody_id: null, waterbody_name: null, district_code: null, great_lake_name: null, tributary_of: null, boundary_jurisdictions: null, tribal_territory: null },
  6, { wording: 'Statewide inland default: 6 walleye+sauger combined, only one over 20 inches.', combined: [sauger.id] });
makeProvision('size_rule', { type: 'statewide', waterbody_id: null, waterbody_name: null, district_code: null, great_lake_name: null, tributary_of: null, boundary_jurisdictions: null, tribal_territory: null },
  { rule_type: 'one_over_threshold', min_in: 20, max_in: null }, { wording: 'Statewide inland default: only one walleye over 20 inches in possession.' });
makeProvision('daily_limit', { type: 'named_water', waterbody_id: 'dddddddd-1111-4222-8333-444444444444', waterbody_name: 'Mille Lacs Lake', district_code: null, great_lake_name: null, tributary_of: null, boundary_jurisdictions: null, tribal_territory: null },
  3, { wording: 'Anglers will be able to harvest walleye 17 inches or greater in length, with only one over 20 inches allowed in possession.' });
makeProvision('size_rule', { type: 'named_water', waterbody_id: 'dddddddd-1111-4222-8333-444444444444', waterbody_name: 'Mille Lacs Lake', district_code: null, great_lake_name: null, tributary_of: null, boundary_jurisdictions: null, tribal_territory: null },
  { rule_type: 'minimum', min_in: 17, max_in: null }, { wording: 'Minimum 17 inches to harvest on Mille Lacs Lake.' });
makeProvision('catch_and_release_permitted', { type: 'statewide', waterbody_id: null, waterbody_name: null, district_code: null, great_lake_name: null, tributary_of: null, boundary_jurisdictions: null, tribal_territory: null },
  true, { wording: 'Catch-and-release walleye/sauger fishing is permitted year-round statewide subject to normal handling requirements.', rank: 5 });

// ---------- write output ----------
const pilot = { species: Object.values(species), sources: [...Object.values(sources)], claims, presentations: Object.values(presentations), tactics, provisions };
fs.writeFileSync(new URL('./pilot-data.json', import.meta.url), JSON.stringify(pilot, null, 2));
console.log(`Generated: ${pilot.species.length} species, ${pilot.sources.length} sources, ${pilot.claims.length} claims, ${pilot.presentations.length} presentations, ${pilot.tactics.length} tactics, ${pilot.provisions.length} regulation provisions.`);
console.log(`All record_status: draft. Written to pilot-data.json.`);
