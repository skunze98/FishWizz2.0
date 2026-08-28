// Real AJV validation of the generated pilot data, plus the evidence-coverage
// report and draft-status confirmation required before pilot approval.
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import fs from 'node:fs';

const pilot = JSON.parse(fs.readFileSync(new URL('./pilot-data.json', import.meta.url)));
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
  check('every claim.source_id resolves to a real source', pilot.claims.every(c => sourceIds.has(c.source_id)));
  check('every claim.subject_id (tactic claims) resolves to a real tactic or provision', pilot.claims.every(c => c.subject_table === 'tactic' ? tacticIds.has(c.subject_id) : c.subject_table === 'regulation_provision' ? new Set(pilot.provisions.map(p=>p.id)).has(c.subject_id) : true));
  check('every tactic.evidence[].claim_id resolves to a real claim', pilot.tactics.every(t => t.evidence.every(e => claimIds.has(e.claim_id))));
  check('every tactic.species[].species_id resolves to a real species', pilot.tactics.every(t => t.species.every(s => speciesIds.has(s.species_id))));
  check('every tactic.presentation_id resolves to a real presentation', pilot.tactics.every(t => presentationIds.has(t.presentation_id)));
  check('every tactic.alternatives[].related_tactic_id resolves to a real tactic (no dangling relationship)', pilot.tactics.every(t => t.alternatives.every(a => tacticIds.has(a.related_tactic_id))));
  check('no tactic content_fingerprint collides with a DIFFERENT tactic (accidental duplicate detection)', new Set(pilot.tactics.map(t => t.content_fingerprint)).size === pilot.tactics.length);
}

section('4. Evidence-coverage report -- every fact-bearing field, listed, not assumed');
const REQUIRED_EVIDENCE_FIELD_PATHS = ['applies_when.season.water_temp_f', 'applies_when.depth_ft', 'equipment.line_test_lb', 'equipment.lure_weight_oz', 'retrieve.pause_seconds', 'rigging_instructions', 'works_when', 'fails_when'];
let coverageGaps = 0;
for (const t of pilot.tactics) {
  const covered = new Set(t.evidence.map(e => e.covers_field_path));
  const missing = REQUIRED_EVIDENCE_FIELD_PATHS.filter(fp => !covered.has(fp) && t.applies_when.depth_ft.state !== 'unconstrained' || (fp !== 'applies_when.depth_ft' && !covered.has(fp)));
  // depth_ft coverage only required when the tactic actually constrains depth (schema-consistent: no claim needed for an axis the tactic doesn't use)
  const trulyMissing = REQUIRED_EVIDENCE_FIELD_PATHS.filter(fp => {
    if (fp === 'applies_when.depth_ft' && t.applies_when.depth_ft.state !== 'constrained') return false;
    if (fp === 'applies_when.season.water_temp_f' && t.applies_when.season.water_temp_f.state !== 'constrained') return false;
    return !covered.has(fp);
  });
  if (trulyMissing.length) { coverageGaps++; console.log(`  GAP  tactic ${t.id.slice(0,8)}: missing evidence for [${trulyMissing.join(', ')}]`); }
}
check(`evidence-coverage report complete (${coverageGaps} tactic(s) with a genuine gap, listed above -- 0 expected)`, coverageGaps === 0);

section('5. No invented numerical precision / no unsupported evidence-type claims');
{
  let precisionViolations = 0;
  for (const t of pilot.tactics) {
    for (const [path, obj] of [['line_test_lb', t.equipment.line_test_lb], ['lure_weight_oz', t.equipment.lure_weight_oz], ['pause_seconds', t.retrieve.pause_seconds]]) {
      if (obj.precision === 'exact' && (obj.min == null || obj.max == null)) { precisionViolations++; console.log(`  VIOLATION tactic ${t.id.slice(0,8)} ${path}: precision=exact but min/max missing`); }
    }
  }
  check(`no invented-precision violations (${precisionViolations} found, 0 expected)`, precisionViolations === 0);
  const primaryOfficialClaims = pilot.claims.filter(c => c.evidence_type === 'primary_official');
  const realPrimarySourceIds = new Set(pilot.sources.filter(s => s.source_type === 'primary_official').map(s => s.id));
  check(`every primary_official claim (${primaryOfficialClaims.length} of them) actually cites a source whose own source_type is primary_official (not the expert-consensus placeholder)`,
    primaryOfficialClaims.every(c => realPrimarySourceIds.has(c.source_id)));
}

section('6. Legality-safety language check (no unsupported targeting/harvest/catch-and-release claim)');
{
  const carProvision = pilot.provisions.find(p => p.provision_type === 'catch_and_release_permitted');
  check('a catch_and_release_permitted provision exists and is explicit (true), not assumed from silence', carProvision && carProvision.value === true);
  check('no tactic text asserts legality itself -- that is exclusively the regulation_provision layer\'s job', pilot.tactics.every(t => !/legal to (keep|harvest)|you may keep/i.test(t.works_when + t.fails_when + t.rigging_instructions)));
}

console.log(`\n${checks} checks run, ${failures} failed.`);
console.log(failures ? 'RESULT: FAIL' : 'RESULT: PASS -- pilot data validates, is fully draft, referentially sound, and evidence-covered.');
process.exit(failures ? 1 : 0);
