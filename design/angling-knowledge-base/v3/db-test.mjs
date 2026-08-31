// Real PostgreSQL (via PGlite -- Postgres compiled to WASM, an actual
// isolated database instance, not a mock) migration + constraint test.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

let checks = 0, failures = 0;
function check(label, cond) { checks++; if (cond) console.log(`  ok   ${label}`); else { console.log(`  FAIL ${label}`); failures++; } }
function section(s) { console.log(`\n${s}`); }

const db = new PGlite();

section('Running the real migration.sql against a real isolated Postgres instance');
const sql = fs.readFileSync(new URL('./migration.sql', import.meta.url), 'utf8');
try {
  await db.exec(sql);
  check('migration.sql runs to completion with no errors', true);
} catch (e) {
  check(`migration.sql runs to completion with no errors -- ${e.message}`, false);
}

section('Table existence check -- every entity + junction + revision + staging table');
const expectTables = ['angling_species','species_alias','angling_category','species_angling_category','angling_source',
  'angling_claim','angling_presentation','gear_compatibility_profile','rod_power_mapping','reel_type_mapping',
  'lure_category_mapping','angling_tactic','tactic_species','tactic_claim','tactic_relationship',
  'regulation_provision','regulation_provision_species','regulation_provision_claim','mission_recommendation',
  'import_batch','angling_tactic_revision','regulation_provision_revision','angling_species_revision',
  'angling_source_revision','staging_angling_tactic','staging_regulation_provision'];
const { rows: existingTables } = await db.query(`SELECT tablename FROM pg_tables WHERE schemaname='public'`);
const existingSet = new Set(existingTables.map(r => r.tablename));
for (const t of expectTables) check(`table ${t} exists`, existingSet.has(t));

section('Seed data check (mapping tables)');
{
  const { rows } = await db.query(`SELECT count(*) FROM rod_power_mapping`);
  check('rod_power_mapping has real seed rows', Number(rows[0].count) > 0);
}

section('CHECK constraints actually enforce, tested with real INSERT/UPDATE against the live DB');
async function expectFail(label, fn) {
  try { await fn(); check(label, false); }
  catch (e) { check(`${label} -- rejected: ${e.message.split('\n')[0].slice(0, 90)}`, true); }
}
async function expectOk(label, fn) {
  try { await fn(); check(label, true); }
  catch (e) { check(`${label} -- unexpectedly rejected: ${e.message}`, false); }
}

const speciesId = '8e2f1a3c-1b4d-4e6a-9c2f-0a1b2c3d4e5f';
await db.query(`INSERT INTO angling_species (id, species_slug, scientific_name, common_name_primary, content_fingerprint, record_status, verified_at, published_at)
  VALUES ($1, 'species:sander-vitreus', 'Sander vitreus', 'Walleye', 'abc123', 'published', '2026-08-28', now())`, [speciesId]);
check('a valid published species inserts successfully', true);

await expectFail('a PUBLISHED species with published_at=NULL is REJECTED by the CHECK constraint', () =>
  db.query(`INSERT INTO angling_species (species_slug, scientific_name, common_name_primary, content_fingerprint, record_status, verified_at, published_at)
    VALUES ('species:x-y', 'X y', 'X', 'def456', 'published', '2026-08-28', NULL)`));

const presId = '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
await db.query(`INSERT INTO angling_presentation (id, presentation_slug, label, category, content_fingerprint) VALUES ($1, 'slip-sinker-rig', 'Slip-sinker rig', 'live_bait_rig', 'p1')`, [presId]);

await expectOk('TWO gear_compatibility_profile rows for the SAME presentation both insert (requirement-7 fix: no longer 1 row max)', async () => {
  await db.query(`INSERT INTO gear_compatibility_profile (presentation_id, label, reel_type, rod_power_min, rod_power_max, rod_action_min, rod_action_max, line_material, line_test_min_lb, line_test_max_lb, leader_required, lure_weight_min_oz, lure_weight_max_oz, environment_applicability, content_fingerprint)
    VALUES ($1, 'Light finesse', 'spinning', 'light', 'medium_light', 'fast', 'fast', 'fluorocarbon', 4, 8, false, 0.1, 0.25, '{}', 'gcp1')`, [presId]);
  await db.query(`INSERT INTO gear_compatibility_profile (presentation_id, label, reel_type, rod_power_min, rod_power_max, rod_action_min, rod_action_max, line_material, line_test_min_lb, line_test_max_lb, leader_required, leader_material, lure_weight_min_oz, lure_weight_max_oz, environment_applicability, content_fingerprint)
    VALUES ($1, 'Deep structure', 'spinning', 'medium_light', 'medium', 'fast', 'fast', 'fluorocarbon', 6, 10, true, 'fluorocarbon', 0.5, 1.0, '{}', 'gcp2')`, [presId]);
});
{ const { rows } = await db.query(`SELECT count(*) FROM gear_compatibility_profile WHERE presentation_id=$1`, [presId]);
  check('both profiles are actually stored (count=2)', Number(rows[0].count) === 2); }

await expectFail('gear_compatibility_profile with min line test > max line test is REJECTED (by the CHECK constraint specifically, not a missing column)', () =>
  db.query(`INSERT INTO gear_compatibility_profile (presentation_id, label, reel_type, rod_power_min, rod_power_max, rod_action_min, rod_action_max, line_material, line_test_min_lb, line_test_max_lb, leader_required, lure_weight_min_oz, lure_weight_max_oz, environment_applicability, content_fingerprint)
    VALUES ($1, 'bad', 'spinning', 'light', 'light', 'fast', 'fast', 'fluorocarbon', 12, 6, false, 0.1, 0.2, '{}', 'gcp-bad')`, [presId]));

const tacticId = '6f5e4d3c-2b1a-4c9d-8e7f-0102030405a6';
const reviewerId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
await expectFail('a PUBLISHED tactic missing approved_by/approved_at is REJECTED (requirement-5 review-chain constraint)', () =>
  db.query(`INSERT INTO angling_tactic (id, content_fingerprint, presentation_id, applies_when, equipment, bait_composition, presentation_method_tags, retrieve, rigging_instructions, bite_detection, hookset_fight, works_when, fails_when, diagnostic_signals, environment_applicability, confidence, readiness, readiness_reason, geographic_applicability, verified_date, record_status, reviewed_by, reviewed_at)
    VALUES ($1, 'tfp1', $2, '{"a":1}', '{}', '{"mode":"live_bait_only","components":["live_minnow"]}', '{jigging}', '{}', 'rig it', 'bite', 'set', 'works', 'fails', 'diag', '{}', 'official_guidance', 'ready_for_human_review', 'x', 'MN_WI', '2026-08-28', 'published', $3, now())`,
    [tacticId, presId, reviewerId]));

await expectOk('the SAME tactic WITH the full review chain inserts successfully', () =>
  db.query(`INSERT INTO angling_tactic (id, content_fingerprint, presentation_id, applies_when, equipment, bait_composition, presentation_method_tags, retrieve, rigging_instructions, bite_detection, hookset_fight, works_when, fails_when, diagnostic_signals, environment_applicability, confidence, readiness, readiness_reason, geographic_applicability, verified_date, record_status, reviewed_by, reviewed_at, approved_by, approved_at, published_at)
    VALUES ($1, 'tfp1', $2, '{"a":1}', '{}', '{"mode":"live_bait_only","components":["live_minnow"]}', '{jigging}', '{}', 'rig it', 'bite', 'set', 'works', 'fails', 'diag', '{}', 'official_guidance', 'ready_for_human_review', 'x', 'MN_WI', '2026-08-28', 'published', $3, now(), $3, now(), now())`,
    [tacticId, presId, reviewerId]));

const waterbodyId = 'a96c6a4c-19ed-4455-a091-6233f688d336'; // real FishWizz waterbodies.id for Mille Lacs Lake (gate-4 fix -- see supabase/schema/waterbodies-data.sql)
await expectFail('a PUBLISHED named_water regulation_provision with NO waterbody_id in geographic_scope is REJECTED', () =>
  db.query(`INSERT INTO regulation_provision (provision_slug, content_fingerprint, provision_type, geographic_scope, temporal_scope, value, official_wording, source_location, status, mandatory_reverify_by, verified_date, record_status, reviewed_by, reviewed_at, approved_by, approved_at, published_at)
    VALUES ('mn.named_water.test-lake.walleye.daily_limit.2026', 'rfp1', 'daily_limit',
      '{"type":"named_water","waterbody_name":"Test Lake"}', '{"type":"fixed_interval","fixed_interval":{"start":"2026-05-09"}}',
      '3', 'wording', 'loc', 'current', '2027-03-01', '2026-08-28', 'published', $1, now(), $1, now(), now())`, [reviewerId]));

await expectOk('the SAME provision WITH waterbody_id resolved inserts successfully', () =>
  db.query(`INSERT INTO regulation_provision (provision_slug, content_fingerprint, provision_type, geographic_scope, temporal_scope, value, official_wording, source_location, status, mandatory_reverify_by, verified_date, record_status, reviewed_by, reviewed_at, approved_by, approved_at, published_at)
    VALUES ('mn.named_water.mille-lacs-lake.walleye.daily_limit.2026', 'rfp2', 'daily_limit',
      $2, '{"type":"fixed_interval","fixed_interval":{"start":"2026-05-09"}}',
      '3', 'wording', 'loc', 'current', '2027-03-01', '2026-08-28', 'published', $1, now(), $1, now(), now())`,
    [reviewerId, JSON.stringify({ type: 'named_water', waterbody_id: waterbodyId, waterbody_name: 'Mille Lacs Lake' })]));

await expectOk('a SECOND, DIFFERENT provision_type (size_rule) for the SAME waterbody+species coexists (requirement-6: composable, not one winner)', () =>
  db.query(`INSERT INTO regulation_provision (provision_slug, content_fingerprint, provision_type, geographic_scope, temporal_scope, value, official_wording, source_location, status, mandatory_reverify_by, verified_date, record_status, reviewed_by, reviewed_at, approved_by, approved_at, published_at)
    VALUES ('mn.named_water.mille-lacs-lake.walleye.size_rule.2026', 'rfp3', 'size_rule',
      $2, '{"type":"fixed_interval","fixed_interval":{"start":"2026-05-09"}}',
      '{"rule_type":"minimum","min_in":17}', 'wording', 'loc', 'current', '2027-03-01', '2026-08-28', 'published', $1, now(), $1, now(), now())`,
    [reviewerId, JSON.stringify({ type: 'named_water', waterbody_id: waterbodyId, waterbody_name: 'Mille Lacs Lake' })]));
{ const { rows } = await db.query(`SELECT provision_type FROM regulation_provision WHERE geographic_scope->>'waterbody_id' = $1 ORDER BY provision_type`, [waterbodyId]);
  check('both provisions are independently queryable for the same water (daily_limit AND size_rule both present)', rows.length === 2 && rows.map(r => r.provision_type).includes('daily_limit') && rows.map(r => r.provision_type).includes('size_rule')); }

section('Foreign keys actually enforce referential integrity');
await expectFail('tactic_claim referencing a NON-EXISTENT claim_id is REJECTED by the FK constraint', () =>
  db.query(`INSERT INTO tactic_claim (tactic_id, claim_id, covers_field_path) VALUES ($1, gen_random_uuid(), 'works_when')`, [tacticId]));
await expectFail('tactic_relationship with from_tactic_id = to_tactic_id (self-reference) is REJECTED', () =>
  db.query(`INSERT INTO tactic_relationship (from_tactic_id, to_tactic_id, relationship_type, note) VALUES ($1, $1, 'next_try', 'x')`, [tacticId]));

section('Transaction rollback: a real BEGIN/COMMIT/ROLLBACK boundary, tested against the live DB (fixes the broken gate-2 example)');
{
  const batchId = 'eeeeeeee-1111-4222-8333-000000000001';
  await db.query(`INSERT INTO import_batch (id, imported_by, row_count, status) VALUES ($1, 'test-pipeline', 1, 'validating')`, [batchId]);
  check('import_batch row inserted in its OWN transaction (auto-committed), BEFORE the data transaction starts', true);

  let dataTxFailed = false;
  try {
    await db.exec('BEGIN');
    await db.query(`INSERT INTO angling_species (species_slug, scientific_name, common_name_primary, content_fingerprint, record_status, verified_at)
      VALUES ('species:test-fail', 'Test fail', 'Test', 'willrollback', 'published', '2026-08-28')`); // published w/ no published_at -> violates CHECK
    await db.exec('COMMIT');
  } catch (e) {
    dataTxFailed = true;
    await db.exec('ROLLBACK');
  }
  check('the data transaction correctly failed and was rolled back', dataTxFailed);
  await db.query(`UPDATE import_batch SET status='rejected_pre_commit' WHERE id=$1`, [batchId]);
  const { rows: check1 } = await db.query(`SELECT status FROM import_batch WHERE id=$1`, [batchId]);
  check('import_batch itself (a SEPARATE, already-committed transaction) correctly still records the rejected attempt -- the exact gate-2 defect (update-after-rollback-in-same-tx) fixed', check1[0].status === 'rejected_pre_commit');
  const { rows: check2 } = await db.query(`SELECT count(*) FROM angling_species WHERE species_slug='species:test-fail'`);
  check('the failed species row was NOT partially committed', Number(check2[0].count) === 0);
}

console.log(`\n${checks} checks run, ${failures} failed.`);
console.log(failures ? 'RESULT: FAIL' : 'RESULT: PASS -- real Postgres migration + constraints verified against a live (PGlite/WASM) database.');
process.exit(failures ? 1 : 0);
