// gate-7 instruction 4: full relationship graph + gap analysis. Does NOT add any relationship to
// pilot-data.json -- for tactics with no next_try/alternative, this SEARCHES the other 14 real
// tactics for a genuine candidate (using the same validateNextTry() criteria already proven on
// t9->t2) and reports either a real candidate or an honest no_valid_alternative finding. Never
// invents a relationship merely to satisfy a count.
import fs from 'node:fs';
import { validateNextTry } from './next-try-validation.mjs';

const pilot = JSON.parse(fs.readFileSync(new URL('./pilot-data.json', import.meta.url)));
const presentationsById = Object.fromEntries(pilot.presentations.map(p => [p.id, p]));
const tacticsById = Object.fromEntries(pilot.tactics.map(t => [t.id, t]));

let report = [];
function log(s = '') { report.push(s); console.log(s); }

log('# Relationship graph -- all 15 tactics (gate-7 instruction 4)');
log(`Generated ${new Date().toISOString()}. No relationship added to pilot-data.json by this script -- candidates below are SUGGESTIONS for a future, separately-approved pass, not applied changes.\n`);

log('## Full graph (outgoing edges)');
log('| tactic | -> | relationship | note (truncated) |');
log('|---|---|---|---|');
pilot.tactics.forEach((t, i) => {
  const pres = presentationsById[t.presentation_id];
  if (t.alternatives.length === 0) { log(`| t${i+1} (${pres.presentation_slug}) | -- | **NONE** | (no outgoing relationship) |`); return; }
  for (const a of t.alternatives) {
    const target = tacticsById[a.related_tactic_id];
    const targetPres = presentationsById[target.presentation_id];
    log(`| t${i+1} (${pres.presentation_slug}) | t${pilot.tactics.indexOf(target)+1} (${targetPres.presentation_slug}) | ${a.relationship_type} | ${a.note.slice(0,90)}... |`);
  }
});

log('\n## Coverage summary');
const withNextTry = pilot.tactics.filter(t => t.alternatives.some(a => a.relationship_type === 'next_try'));
const withAlternativeOnly = pilot.tactics.filter(t => !withNextTry.includes(t) && t.alternatives.some(a => a.relationship_type === 'alternative' || a.relationship_type === 'conflicts_with'));
const withNeither = pilot.tactics.filter(t => t.alternatives.length === 0);
log(`- Has a validated next_try: ${withNextTry.length}/15 (t9 only)`);
log(`- Has an alternative/conflicts_with but no next_try: ${withAlternativeOnly.length}/15`);
log(`- Has NO outgoing relationship at all: ${withNeither.length}/15`);

log('\n## Gap analysis for tactics with NO outgoing relationship -- real candidate search, not invention');
for (const t of withNeither) {
  const pres = presentationsById[t.presentation_id];
  const idx = pilot.tactics.indexOf(t) + 1;
  log(`\n### t${idx} (${pres.presentation_slug}) -- fails_when: "${t.fails_when}"`);
  const candidates = [];
  for (const other of pilot.tactics) {
    if (other.id === t.id) continue;
    const otherPres = presentationsById[other.presentation_id];
    const result = validateNextTry(t, other, { note: 'CANDIDATE SEARCH -- placeholder note, textual checks will correctly fail until a real note is written' }, pres, otherPres);
    // textual checks (hasFailureHypothesis/hasResponseRationale/notJustClosestMatch/noteIsSubstantive) will
    // always fail against a placeholder note -- report the STRUCTURAL checks only for candidate discovery,
    // textual checks are a reminder of what a human-authored note would still need to satisfy.
    const structuralChecks = ['sameSpecies','compatiblePlatform','compatibleWaterEnv','depthOverlap','tempOverlap','presentationDiffers','intensityTierDiffers','environmentApplicabilityOverlap'];
    const structuralPass = structuralChecks.every(k => result.checks[k]);
    if (structuralPass) candidates.push({ other, idx: pilot.tactics.indexOf(other) + 1, otherPres });
  }
  if (candidates.length === 0) {
    log(`**no_valid_alternative** -- no other tactic in this 15-tactic pilot passes the structural criteria (species/platform/water_environment/depth/temp compatibility + a genuinely different presentation). A real substitute may not exist in this pilot's current scope; adding one would require a NEW tactic, which this pass does not authorize.`);
  } else {
    log(`${candidates.length} structural candidate(s) found (still need a human-authored failure-hypothesis note before formalizing as next_try, per instruction 4's "do not create relationships solely to satisfy a count"):`);
    for (const c of candidates) log(`- t${c.idx} (${c.otherPres.presentation_slug}) -- structurally compatible; a next_try relationship would still need: what characteristic of t${idx} is believed to be failing, and why t${c.idx} specifically responds to that (not just "closest match").`);
  }
}

log('\n## Incoming-edge check (is every tactic reachable as SOMEONE\'s alternative, even if it has no outgoing edge?)');
for (const t of withNeither) {
  const idx = pilot.tactics.indexOf(t) + 1;
  const incoming = pilot.tactics.filter(other => other.alternatives.some(a => a.related_tactic_id === t.id));
  log(`- t${idx}: ${incoming.length ? `referenced BY ${incoming.map(o => 't'+(pilot.tactics.indexOf(o)+1)).join(', ')}` : 'NOT referenced by any other tactic -- fully isolated in the relationship graph'}`);
}

fs.writeFileSync(new URL('./relationship-graph.md', import.meta.url), report.join('\n'));
console.log('\n\nWritten relationship-graph.md');
