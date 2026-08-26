#!/usr/bin/env node
// Smoke tests for the mentor-experience additions (see DEPLOYMENT.md):
//   - "Why this Mission?" factor/confidence explanation (public/mission-why.js)
//   - "What's biting" + species ranking (public/water-mentor-pro.js)
//   - honesty/privacy contracts of the two new edge functions
// Plain Node script, matching this repo's existing convention
// (scripts/check-syntax.mjs, scripts/rls-probe.mjs) rather than a test
// framework this project doesn't otherwise use. Run with:
//   node scripts/test-mentor-explanations.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

let failures = 0;
function check(label, cond) {
  if (cond) { console.log(`  ok   ${label}`); }
  else { console.log(`  FAIL ${label}`); failures++; }
}
function section(name) { console.log(`\n${name}`); }

// --- load the two browser IIFE modules for their side effect -------------
// Both attach globalThis.__fishwizzTest.{missionWhy,waterMentor} guarded so
// this works with no `window`/`document` present (see the comment at the
// bottom of each file for why this isn't module.exports).
await import(pathToFileURL(path.join(root, 'public/mission-why.js')));
await import(pathToFileURL(path.join(root, 'public/water-mentor-pro.js')));
const { missionWhy, waterMentor } = globalThis.__fishwizzTest || {};

section('mission-why.js: FACTORS shape');
check('FACTORS is a non-empty array of [key,label,fn] triples',
  Array.isArray(missionWhy?.FACTORS) && missionWhy.FACTORS.length > 5 &&
  missionWhy.FACTORS.every(f => f.length === 3 && typeof f[2] === 'function'));

section('mission-why.js: confidence reasoning');
{
  const full = {
    target: 'Walleye', live_weather: { current: {} }, angler_profile: { experience_level: 'casual' },
    inventory_summary: { saved_setups: 1, saved_tackle: 0 }, latitude: 44.9, longitude: -93.5,
    fish_activity: 'Active',
  };
  const r1 = missionWhy.confidenceReasoning(full, { confidence: 82 });
  check('high score -> high band', r1.band === 'high');
  check('no missing inputs listed when everything is supplied', r1.missing.length === 0);
  check('text mentions the target species', /Walleye/.test(r1.text));

  const sparse = { };
  const r2 = missionWhy.confidenceReasoning(sparse, { confidence: 45 });
  check('low score -> low band', r2.band === 'low');
  check('missing list flags live weather, position, profile, gear, and activity',
    ['live weather', 'an exact fishing position', 'an angler profile', 'saved gear', 'recent fish-activity reports']
      .every(m => r2.missing.includes(m)));
  check('reasoning text has no double-punctuation artifact (": ," bug)', !/:\s*,/.test(r2.text));
}

section('mission-why.js: full render()');
{
  const html = missionWhy.render(
    { target: 'Bass', clarity: 'Clear', water_type: 'River', current: 'Moderate' },
    { confidence: 70 }
  );
  check('never states a recommendation as a guarantee', /not a guarantee/.test(html));
  check('shows the confidence percentage verbatim from the recommendation', /Confidence: 70%/.test(html));
  check('moving water gets its own explained factor row', /Moving water/.test(html));
  // Edge case: nothing known at all must not throw and must still render.
  let threw = false;
  try { missionWhy.render({}, {}); } catch { threw = true; }
  check('render() does not throw on a fully empty context/recommendation', !threw);
}

section('water-mentor-pro.js: rankSpecies()');
{
  const species = [
    { species_name: 'Walleye', confidence: 0.8, source_name: 'DNR survey' },
    { species_name: 'Bluegill', confidence: 0.5, source_name: 'DNR survey' },
  ];
  const reports = [
    { species: ['Walleye'], age_hours: 10 },
    { species: ['Walleye'], age_hours: 40 },
  ];
  const ranked = waterMentor.rankSpecies(species, reports);
  check('returns one ranked entry per species', ranked.length === 2);
  check('scores are sorted descending', ranked[0].score >= ranked[1].score);
  check('the species with real recent reports outranks the one with none', ranked[0].name === 'Walleye');
  check('evidence cites a real count, not an invented one', /2 recent fishing reports/.test(ranked[0].evidence.join(' ')));
  check('the species with zero report mentions says so honestly', /no recent fishing reports/.test(ranked[1].evidence.join(' ')));

  const noEvidence = waterMentor.rankSpecies([], []);
  check('empty species list produces an empty ranking, not a fabricated one', noEvidence.length === 0);
}

section('water-mentor-pro.js: honest empty states (item 10 -- no fabrication)');
{
  const emptyBiting = waterMentor.renderBiting([]);
  check('"what\'s biting" empty state says it will not invent activity', /will not invent/.test(emptyBiting));
  const emptyRanking = waterMentor.renderRanking([], []);
  check('species ranking empty state says it will not guess', /will not guess/.test(emptyRanking));

  const realBiting = waterMentor.renderBiting([
    { species: ['Walleye'], lure_mentions: ['jig'], technique_mentions: ['drifting'], age_hours: 5, confidence_score: 0.6, source_name: 'Local forum' },
  ]);
  check('a real report renders its species, lure, and source', /Walleye/.test(realBiting) && /jig/.test(realBiting) && /Local forum/.test(realBiting));
  check('real report output still carries the "not a guarantee" caveat', /not a guarantee/.test(realBiting));
}

section('water-mentor-pro.js: speciesHint() never returns empty guidance');
{
  for (const name of ['Walleye', 'Bluegill', 'Northern Pike', 'Channel Catfish', 'Largemouth Bass', 'Brown Trout', 'Some Unlisted Species']) {
    const h = waterMentor.speciesHint(name);
    check(`hint for "${name}" has depth/technique/time text`, !!(h.depth && h.technique && h.time));
  }
}

// --- edge function source contracts (no live auth needed) ----------------
const accessSrc = readFileSync(path.join(root, 'supabase/functions/atlas-water-access/index.ts'), 'utf8');
const depthSrc = readFileSync(path.join(root, 'supabase/functions/atlas-water-depth/index.ts'), 'utf8');

section('atlas-water-access: honesty + privacy contract');
check('returns available:false with a real reason when nothing is found', /available:false,reason:/.test(accessSrc));
check('requires a signed-in user (matches the other 8 edge functions\' auth gate)', /Unauthorized.*401/.test(accessSrc));
check('never touches a private/user-owned table (catches, personal_fishing_locations, etc.)',
  !/\b(catches|personal_fishing_locations|fishing_sessions|water_visits)\b/.test(accessSrc));

section('atlas-water-depth: honesty + privacy contract');
check('rivers/streams get an explicit "no bathymetric survey for moving water" reason, not fake contours',
  /river or streams/i.test(depthSrc) || /rivers or streams/i.test(depthSrc));
check('non-MN states get an explicit reason rather than empty/fake data', /Wisconsin DNR does not publish/.test(depthSrc));
check('an unsurveyed MN lake gets an honest reason, not an empty silent 200', /No DNR bathymetric survey is on file/.test(depthSrc));
check('does not fabricate a unit-ambiguous acreage figure (dropped after the source unit could not be verified)',
  !/surface_acres/.test(depthSrc));
check('requires a signed-in user', /Unauthorized.*401/.test(depthSrc));
check('never touches a private/user-owned table', !/\b(catches|personal_fishing_locations|fishing_sessions|water_visits)\b/.test(depthSrc));

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) FAILED.`}`);
process.exit(failures === 0 ? 0 : 1);
