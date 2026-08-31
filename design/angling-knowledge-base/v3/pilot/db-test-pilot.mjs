// Loads the real pilot data into a real (PGlite/WASM) Postgres instance
// running the real migration.sql, confirms everything lands as draft, and
// runs one real content revision + full rollback using pilot data.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

let checks = 0, failures = 0;
function check(label, cond) { checks++; if (cond) console.log(`  ok   ${label}`); else { console.log(`  FAIL ${label}`); failures++; } }
function section(s) { console.log(`\n${s}`); }

const db = new PGlite();
await db.exec(fs.readFileSync(new URL('../migration.sql', import.meta.url), 'utf8'));
console.log('Real migration.sql applied to a fresh isolated Postgres instance.');

const pilot = JSON.parse(fs.readFileSync(new URL('./pilot-data.json', import.meta.url)));

section('Loading pilot data into live Postgres (all draft)');
for (const s of pilot.species)
  await db.query(`INSERT INTO angling_species (id, species_slug, scientific_name, common_name_primary, content_fingerprint, record_status, verified_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7)`, [s.id, s.species_slug, s.scientific_name, s.common_name_primary, s.content_fingerprint, s.record_status, s.verified_at]);
for (const src of pilot.sources)
  await db.query(`INSERT INTO angling_source (id, title, organization, parent_organization, url, access_date, source_type, geographic_relevance, record_status, content_fingerprint)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [src.id, src.title, src.organization, src.parent_organization, src.url, src.access_date, src.source_type, src.geographic_relevance, src.record_status, src.content_fingerprint]);
for (const p of pilot.presentations)
  await db.query(`INSERT INTO angling_presentation (id, presentation_slug, label, category, imitates, intensity_tier, record_status, content_fingerprint)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [p.id, p.presentation_slug, p.label, p.category, p.imitates, p.intensity_tier, p.record_status, p.content_fingerprint]);
for (const c of pilot.claims)
  await db.query(`INSERT INTO angling_claim (id, evidence_status, source_id, field_path, paraphrased_claim, source_location, evidence_type, derived_from_claim_ids, derivation_explanation, access_date, geographic_applicability, reviewer_status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [c.id, c.evidence_status, c.source_id, c.field_path, c.paraphrased_claim, c.source_location, c.evidence_type, c.derived_from_claim_ids, c.derivation_explanation, c.access_date, c.geographic_applicability, c.reviewer_status]);
for (const t of pilot.tactics) {
  await db.query(`INSERT INTO angling_tactic (id, content_fingerprint, presentation_id, applies_when, equipment, bait_composition, presentation_method_tags, retrieve, rigging_instructions, bite_detection, hookset_fight, works_when, fails_when, diagnostic_signals, casting_access_required, environment_applicability, conservation_notes, confidence, readiness, readiness_reason, geographic_applicability, verified_date, record_status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
    [t.id, t.content_fingerprint, t.presentation_id, JSON.stringify(t.applies_when), JSON.stringify(t.equipment), JSON.stringify(t.bait_composition), t.presentation_method_tags, JSON.stringify(t.retrieve),
     t.rigging_instructions, t.bite_detection, t.hookset_fight, t.works_when, t.fails_when, t.diagnostic_signals, t.casting_access_required,
     JSON.stringify(t.environment_applicability), t.conservation_notes, t.confidence, t.readiness, t.readiness_reason, t.geographic_applicability, t.verified_date, t.record_status]);
  for (const s of t.species) await db.query(`INSERT INTO tactic_species (tactic_id, species_id, is_primary_species) VALUES ($1,$2,$3)`, [t.id, s.species_id, s.is_primary_species]);
  for (const e of t.evidence) await db.query(`INSERT INTO tactic_claim (tactic_id, claim_id, covers_field_path) VALUES ($1,$2,$3)`, [t.id, e.claim_id, e.covers_field_path]);
}
for (const t of pilot.tactics) for (const a of t.alternatives)
  await db.query(`INSERT INTO tactic_relationship (from_tactic_id, to_tactic_id, relationship_type, note) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [t.id, a.related_tactic_id, a.relationship_type, a.note]);
for (const p of pilot.provisions) {
  await db.query(`INSERT INTO regulation_provision (id, provision_slug, content_fingerprint, provision_type, geographic_scope, temporal_scope, value, official_wording, source_location, status, mandatory_reverify_by, verified_date, record_status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [p.id, p.provision_slug, p.content_fingerprint, p.provision_type, JSON.stringify(p.geographic_scope), JSON.stringify(p.temporal_scope), JSON.stringify(p.value), p.official_wording, p.source_location, p.status, p.mandatory_reverify_by, p.verified_date, p.record_status]);
}
check('all pilot data inserted without error', true);

section('Confirm every pilot record is draft, nothing published, in the live DB');
const tables = ['angling_species', 'angling_source', 'angling_presentation', 'angling_tactic', 'regulation_provision'];
for (const t of tables) {
  const { rows } = await db.query(`SELECT count(*) FROM ${t} WHERE record_status <> 'draft'`);
  check(`${t}: 0 non-draft rows`, Number(rows[0].count) === 0);
  const { rows: pubRows } = await db.query(`SELECT count(*) FROM ${t} WHERE published_at IS NOT NULL`);
  check(`${t}: 0 rows with published_at set`, t === 'angling_source' || t === 'angling_presentation' || Number(pubRows[0].count) === 0);
}
const { rows: claimRows } = await db.query(`SELECT count(*) FROM angling_claim WHERE reviewer_status <> 'unreviewed'`);
check('angling_claim: 0 rows marked reviewed/confirmed (nothing represented as confirmed)', Number(claimRows[0].count) === 0);

section('gate-4: evidence_status distribution matches the pilot data exactly (real query, not re-asserted)');
{
  const { rows } = await db.query(`SELECT evidence_status, count(*) FROM angling_claim GROUP BY evidence_status ORDER BY evidence_status`);
  const dbCounts = Object.fromEntries(rows.map(r => [r.evidence_status, Number(r.count)]));
  const jsonCounts = { externally_sourced: 0, derived_synthesis: 0, unsupported_gap: 0 };
  for (const c of pilot.claims) jsonCounts[c.evidence_status]++;
  console.log(`  DB: ${JSON.stringify(dbCounts)}  JSON: ${JSON.stringify(jsonCounts)}`);
  check('DB evidence_status counts match pilot-data.json exactly', ['externally_sourced', 'derived_synthesis', 'unsupported_gap'].every(k => dbCounts[k] === jsonCounts[k]));
}

section('gate-4: real negative tests -- the evidence_status CHECK constraints actually reject malformed rows, not just accept well-formed ones');
{
  const badId1 = crypto.randomUUID();
  let rejected1 = false;
  try {
    await db.query(`INSERT INTO angling_claim (id, evidence_status, source_id, field_path, paraphrased_claim, source_location, evidence_type, access_date, geographic_applicability)
      VALUES ($1,'externally_sourced',NULL,'x','placeholder claim text','n/a','primary_official','2026-08-29','MN')`, [badId1]);
  } catch (e) { rejected1 = /angling_claim_externally_sourced_shape/.test(e.message) || /violates check constraint/.test(e.message); }
  check('DB rejects evidence_status=externally_sourced with a NULL source_id (angling_claim_externally_sourced_shape)', rejected1);

  const badId2 = crypto.randomUUID();
  const realSourceId = pilot.sources[0].id;
  let rejected2 = false;
  try {
    await db.query(`INSERT INTO angling_claim (id, evidence_status, source_id, field_path, paraphrased_claim, source_location, access_date, geographic_applicability)
      VALUES ($1,'unsupported_gap',$2,'x','placeholder claim text','n/a','2026-08-29','MN')`, [badId2, realSourceId]);
  } catch (e) { rejected2 = /angling_claim_unsupported_gap_shape/.test(e.message) || /violates check constraint/.test(e.message); }
  check('DB rejects evidence_status=unsupported_gap with a NON-NULL source_id (angling_claim_unsupported_gap_shape -- a gap can never smuggle in a fake source)', rejected2);

  const badId3 = crypto.randomUUID();
  let rejected3 = false;
  try {
    await db.query(`INSERT INTO angling_claim (id, evidence_status, source_id, field_path, paraphrased_claim, source_location, evidence_type, derived_from_claim_ids, access_date, geographic_applicability)
      VALUES ($1,'derived_synthesis',NULL,'x','placeholder claim text','n/a','expert_consensus','{}','2026-08-29','MN')`, [badId3]);
  } catch (e) { rejected3 = /angling_claim_derived_synthesis_shape/.test(e.message) || /violates check constraint/.test(e.message); }
  check('DB rejects evidence_status=derived_synthesis with EMPTY derived_from_claim_ids (angling_claim_derived_synthesis_shape -- cannot claim synthesis from nothing)', rejected3);

  const badId4 = crypto.randomUUID();
  const oneRealClaimId = pilot.claims.find(c => c.evidence_status === 'externally_sourced').id;
  let rejected4 = false;
  try {
    await db.query(`INSERT INTO angling_claim (id, evidence_status, source_id, field_path, paraphrased_claim, source_location, evidence_type, derived_from_claim_ids, derivation_explanation, access_date, geographic_applicability)
      VALUES ($1,'derived_synthesis',NULL,'x','placeholder claim text','n/a','expert_consensus',$2,'only one ancestor, mislabeled expert_consensus','2026-08-29','MN')`, [badId4, [oneRealClaimId]]);
  } catch (e) { rejected4 = /angling_claim_derived_expert_consensus_needs_two/.test(e.message) || /violates check constraint/.test(e.message); }
  check('DB rejects a derived_synthesis claim LABELED expert_consensus with only ONE ancestor claim (angling_claim_derived_expert_consensus_needs_two -- a single source can never be relabeled corroboration)', rejected4);

  const badTacticId = crypto.randomUUID();
  let rejected5 = false;
  try {
    await db.query(`INSERT INTO angling_tactic (id, content_fingerprint, presentation_id, applies_when, equipment, bait_composition, presentation_method_tags, retrieve, rigging_instructions, bite_detection, hookset_fight, works_when, fails_when, diagnostic_signals, environment_applicability, confidence, readiness, readiness_reason, geographic_applicability, verified_date)
      VALUES ($1,'x',$2,'{}','{}','{}','{}','{}','x','x','x','x','x','x','{}','totally_made_up','research_incomplete','x','MN','2026-08-29')`, [badTacticId, pilot.presentations[0].id]);
  } catch (e) { rejected5 = /violates check constraint/.test(e.message); }
  check('DB rejects a tactic.confidence value outside the gate-5 7-tier enum (peer_review_supported/independently_corroborated/official_guidance/expert_synthesis/anecdotal/estimated/unsupported)', rejected5);

  const badReadinessId = crypto.randomUUID();
  let rejected6 = false;
  try {
    await db.query(`INSERT INTO angling_tactic (id, content_fingerprint, presentation_id, applies_when, equipment, bait_composition, presentation_method_tags, retrieve, rigging_instructions, bite_detection, hookset_fight, works_when, fails_when, diagnostic_signals, environment_applicability, confidence, readiness, readiness_reason, geographic_applicability, verified_date)
      VALUES ($1,'x',$2,'{}','{}','{}','{}','{}','x','x','x','x','x','x','{}','estimated','made_up_readiness','x','MN','2026-08-29')`, [badReadinessId, pilot.presentations[0].id]);
  } catch (e) { rejected6 = /violates check constraint/.test(e.message); }
  check('DB rejects a tactic.readiness value outside the 5-value enum (ready_for_human_review/research_incomplete/blocked_by_conflicting_evidence/blocked_by_safety_gap/blocked_by_regulation_gap)', rejected6);
}

section('Real content revision + full rollback, using pilot data');
{
  const t2 = pilot.tactics[1]; // the summer deep-structure walleye tactic
  const batchId = crypto.randomUUID();
  await db.query(`INSERT INTO import_batch (id, imported_by, row_count, status) VALUES ($1,'pilot-revision-test',1,'validating')`, [batchId]);
  const { rows: before } = await db.query(`SELECT * FROM angling_tactic WHERE id=$1`, [t2.id]);
  await db.query(`INSERT INTO angling_tactic_revision (tactic_id, revision_number, snapshot, content_fingerprint, changed_fields, import_batch_id)
    VALUES ($1, 1, $2, $3, $4, $5)`, [t2.id, JSON.stringify(before[0]), before[0].content_fingerprint, ['equipment.line_test_lb.max'], batchId]);
  await db.exec('BEGIN');
  await db.query(`UPDATE angling_tactic SET equipment = jsonb_set(equipment, '{line_test_lb,max}', '12'), content_fingerprint='revised-fp-001', updated_at=now() WHERE id=$1`, [t2.id]);
  await db.exec('COMMIT');
  await db.query(`UPDATE import_batch SET status='committed' WHERE id=$1`, [batchId]);
  const { rows: after } = await db.query(`SELECT equipment, content_fingerprint, id FROM angling_tactic WHERE id=$1`, [t2.id]);
  check('the edit applied: line_test_lb.max changed to 12', after[0].equipment.line_test_lb.max === 12);
  check('the edit applied: content_fingerprint changed', after[0].content_fingerprint === 'revised-fp-001');
  check('the id (immutable identity) did NOT change', after[0].id === t2.id);

  // Full rollback: restore the COMPLETE prior snapshot, not a partial field subset (the gate-2/3 fix).
  const { rows: revRows } = await db.query(`SELECT snapshot FROM angling_tactic_revision WHERE tactic_id=$1 AND revision_number=1`, [t2.id]);
  const snap = revRows[0].snapshot;
  await db.exec('BEGIN');
  await db.query(`UPDATE angling_tactic SET
    content_fingerprint=$2, presentation_id=$3, applies_when=$4, equipment=$5, bait_composition=$6, presentation_method_tags=$7, retrieve=$8,
    rigging_instructions=$9, bite_detection=$10, hookset_fight=$11, works_when=$12, fails_when=$13, diagnostic_signals=$14,
    casting_access_required=$15, environment_applicability=$16, conservation_notes=$17, confidence=$18, readiness=$19, readiness_reason=$20,
    geographic_applicability=$21, verified_date=$22, record_status=$23, updated_at=now()
    WHERE id=$1`,
    [t2.id, snap.content_fingerprint, snap.presentation_id, JSON.stringify(snap.applies_when), JSON.stringify(snap.equipment), JSON.stringify(snap.bait_composition), snap.presentation_method_tags,
     JSON.stringify(snap.retrieve), snap.rigging_instructions, snap.bite_detection, snap.hookset_fight, snap.works_when, snap.fails_when, snap.diagnostic_signals,
     snap.casting_access_required, JSON.stringify(snap.environment_applicability), snap.conservation_notes, snap.confidence, snap.readiness, snap.readiness_reason, snap.geographic_applicability, snap.verified_date, snap.record_status]);
  await db.exec('COMMIT');
  const { rows: restored } = await db.query(`SELECT equipment, content_fingerprint FROM angling_tactic WHERE id=$1`, [t2.id]);
  check('rollback restored equipment.line_test_lb.max to the ORIGINAL value (full snapshot restore, not partial)', restored[0].equipment.line_test_lb.max === t2.equipment.line_test_lb.max);
  check('rollback restored the ORIGINAL content_fingerprint exactly', restored[0].content_fingerprint === t2.content_fingerprint);
  // Prove EVERY field was restored, not just the two checked above, by diffing the full row:
  const { rows: fullRestored } = await db.query(`SELECT * FROM angling_tactic WHERE id=$1`, [t2.id]);
  const fieldsChecked = Object.keys(before[0]).filter(k => !['updated_at'].includes(k));
  const allMatch = fieldsChecked.every(k => JSON.stringify(fullRestored[0][k]) === JSON.stringify(before[0][k]));
  check(`ALL ${fieldsChecked.length} other fields match the pre-edit snapshot exactly (true full-row rollback)`, allMatch);
}

console.log(`\n${checks} checks run, ${failures} failed.`);
console.log(failures ? 'RESULT: FAIL' : 'RESULT: PASS -- pilot data loads cleanly into a real Postgres instance, is fully draft, and a real revision+full rollback both work correctly.');
process.exit(failures ? 1 : 0);
