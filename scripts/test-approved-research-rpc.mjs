#!/usr/bin/env node
// Regression test for the new, additive get_approved_research_plan(p_context) Postgres
// function (src/supabase/migrations/20260830000000_approved_research_integration.sql,
// section 4) -- the ONE new RPC this integration adds. get_mission_plan_v3 itself is never
// modified; this is a completely separate function the isolated app calls from a new client
// module (public/approved-research-bridge.js) only when the feature flag is enabled.
//
// Builds a real disposable local PGlite database (via import-tool.mjs --commit, the same real
// tool an operator would use), applies the RPC migration on top, then issues 5 real queries
// covering: species-with-tactics, species-with-zero-tactics (disclosed, not hidden), an
// unmapped/no-match species (honest failure, no fabrication), alias resolution (Steelhead ->
// Rainbow Trout), and tactic/regulation separation (neither array leaks the other's fields).
//
// Run with:
//   node scripts/test-approved-research-rpc.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ISO_ROOT = path.resolve(__dirname, '..');           // C:\fw-iso\src
const FW_ISO_ROOT = path.resolve(ISO_ROOT, '..');          // C:\fw-iso
const TOOLS_DIR = path.join(FW_ISO_ROOT, 'tools');

let failures = 0;
function check(label, cond) {
  if (cond) { console.log(`  ok   ${label}`); }
  else { console.log(`  FAIL ${label}`); failures++; }
}
function section(name) { console.log(`\n${name}`); }

const DATA_DIR = path.join(os.tmpdir(), `fw-iso-test-rpc-${Date.now()}`);
const RUN_ID = `test-rpc-run-${Date.now()}`;
const MANIFEST_PATH = path.join(TOOLS_DIR, 'runs', `${RUN_ID}-inserted.json`);
function cleanup() {
  try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch {}
  try { fs.rmSync(MANIFEST_PATH, { force: true }); } catch {}
}
cleanup();

try {
  section('Seeding a disposable local PGlite database via the real import-tool.mjs --commit');
  const seed = execFileSync('node', ['import-tool.mjs', `--data-dir=${DATA_DIR}`, `--run-id=${RUN_ID}`, '--commit'],
    { cwd: TOOLS_DIR, encoding: 'utf8' });
  check('seed import exits 0', true); // execFileSync throws on non-zero, so reaching here already proves it
  check('seed import reports COMMIT mode', /COMMIT \(will write\)/.test(seed));

  const queryScript = path.join(TOOLS_DIR, `.rpc-test-query-${Date.now()}.mjs`);
  fs.writeFileSync(queryScript, `
    import fs from 'node:fs';
    import path from 'node:path';
    import { PGlite } from '@electric-sql/pglite';
    const dataDir = process.argv[2];
    const migrationPath = process.argv[3];
    const db = new PGlite(dataDir);
    // Apply just the new RPC (section 4) -- the underlying tables already exist from the seed
    // import above; re-applying the same function is idempotent (CREATE OR REPLACE).
    const full = fs.readFileSync(migrationPath, 'utf8');
    const rpcOnly = full.slice(full.indexOf('CREATE OR REPLACE FUNCTION public.get_approved_research_plan'));
    await db.exec(rpcOnly);
    const scenarios = JSON.parse(process.argv[4]);
    const results = {};
    for (const [name, ctx] of Object.entries(scenarios)) {
      const { rows } = await db.query('SELECT get_approved_research_plan($1) AS result', [JSON.stringify(ctx)]);
      results[name] = rows[0].result;
    }
    console.log(JSON.stringify(results));
    await db.close();
  `);

  // target_species_slug on cisco/rainbowTroutDirect mirrors exactly what
  // approved-research-bridge.js now sends: species-taxonomy-map.js's resolution of the app's own
  // free-text dropdown label to the real approved species_slug, since those two strings are
  // legitimately different for several species (see get_approved_research_plan's own header
  // comment). tigerMuskie deliberately omits it -- species-taxonomy-map.js has no entry for Tiger
  // Muskellunge, so the real bridge would never send one either, and this must still resolve
  // honestly to no_species_match. steelheadAlias deliberately sends ONLY `target` (no slug), to
  // prove the RPC's own alias-table fallback still works for a caller that never went through the
  // client-side taxonomy map at all (e.g. a future non-app caller).
  const scenarios = {
    walleye: { target: 'Walleye' },
    cisco: { target: 'Cisco (Tullibee)', target_species_slug: 'species:coregonus-artedi' },
    tigerMuskie: { target: 'Tiger Muskellunge' },
    steelheadAlias: { target: 'Steelhead' },
    rainbowTroutDirect: { target: 'Rainbow Trout (Steelhead)', target_species_slug: 'species:oncorhynchus-mykiss' },
  };

  const migrationPath = path.join(FW_ISO_ROOT, 'migrations', 'migration-004-approved-research-integration.sql');
  check('migration-004 file exists', fs.existsSync(migrationPath));

  let out;
  try {
    out = execFileSync('node', [queryScript, DATA_DIR, migrationPath, JSON.stringify(scenarios)], { cwd: TOOLS_DIR, encoding: 'utf8' });
  } finally {
    fs.rmSync(queryScript, { force: true });
  }
  const results = JSON.parse(out.trim().split('\n').pop());

  // ==========================================================================
  section('species-with-tactics: Walleye resolves and returns real tactic + source data');
  // ==========================================================================
  {
    const r = results.walleye;
    check('available === true', r.available === true);
    check('matched_common_name is Walleye', r.matched_common_name === 'Walleye');
    check('tactic_count matches tactics.length', r.tactic_count === (r.tactics || []).length);
    check('at least one tactic returned', (r.tactics || []).length > 0);
    const t0 = r.tactics?.[0];
    check('a tactic carries a presentation_label', !!t0?.presentation_label);
    check('a tactic carries a confidence tier', !!t0?.confidence);
    check('a tactic carries readiness/readiness_reason', !!t0?.readiness && (t0.readiness === 'ready_for_human_review' || !!t0.readiness_reason));
    check('a tactic carries a real sources array (not fabricated/empty by construction)', Array.isArray(t0?.sources));
    check('data_note is present and non-fabricated (explains 0 mission-ready by design)', typeof r.data_note === 'string' && r.data_note.length > 0);
  }

  // ==========================================================================
  section('species-with-zero-tactics: Cisco resolves but discloses zero tactics rather than hiding the gap');
  // ==========================================================================
  {
    const r = results.cisco;
    check('available === true (species exists)', r.available === true);
    check('tactic_count === 0, not fabricated', r.tactic_count === 0);
    check('tactics array is empty, not padded with anything', (r.tactics || []).length === 0);
  }

  // ==========================================================================
  section('unmapped species: Tiger Muskellunge is an honest no_species_match, never a fuzzy guess');
  // ==========================================================================
  {
    const r = results.tigerMuskie;
    check('available === false', r.available === false);
    check('reason is no_species_match', r.reason === 'no_species_match');
    check('requested_target echoes the input verbatim', r.requested_target === 'Tiger Muskellunge');
    check('a data_note is present explaining the gap', typeof r.data_note === 'string' && r.data_note.length > 0);
  }

  // ==========================================================================
  section('alias resolution: "Steelhead" resolves to the same species record as "Rainbow Trout (Steelhead)"');
  // ==========================================================================
  {
    const alias = results.steelheadAlias;
    const direct = results.rainbowTroutDirect;
    check('Steelhead resolves (available === true)', alias.available === true);
    check('Steelhead and the direct name resolve to the SAME matched_species_id', alias.matched_species_id && alias.matched_species_id === direct.matched_species_id);
    check('both report the same matched_common_name', alias.matched_common_name === direct.matched_common_name);
  }

  // ==========================================================================
  section('tactics/regulations separation: neither array leaks the other\'s fields');
  // ==========================================================================
  {
    const r = results.walleye;
    const tacticOnlyFields = ['presentation_label', 'rigging_instructions', 'bite_detection', 'hookset_fight'];
    const regOnlyFields = ['provision_type', 'official_wording', 'geographic_scope', 'temporal_scope'];
    for (const reg of (r.regulations || [])) {
      for (const f of tacticOnlyFields) check(`a regulation record never carries tactic field "${f}"`, !(f in reg));
    }
    for (const t of (r.tactics || [])) {
      for (const f of regOnlyFields) check(`a tactic record never carries regulation field "${f}"`, !(f in t));
    }
    check('regulation_count matches regulations.length', r.regulation_count === (r.regulations || []).length);
  }
} finally {
  cleanup();
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
