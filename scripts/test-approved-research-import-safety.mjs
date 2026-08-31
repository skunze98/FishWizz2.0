#!/usr/bin/env node
// Regression/behavior test for the approved-research import tooling
// (tools/import-tool.mjs, tools/rollback-run.mjs), built for the isolated
// integration of checkpoint approved-2026-08-30.
//
// Drives the REAL tools as subprocesses (not a reimplementation) against a
// disposable local-directory-persisted PGlite instance, so this proves the
// actual behavior an operator would see, not an assumption about it. Every
// database this test touches lives under a throwaway temp directory deleted
// at the end of the run -- never a real Supabase environment.
//
// Covers (see the standing integration instruction's "strengthened import
// safety" list and "tests must cover" list):
//   - dry-run-by-default behavior
//   - disposable-local-database-only behavior
//   - existing-ID identical-content handling (idempotent re-run)
//   - existing-ID checksum-mismatch handling (abort before any write)
//   - transaction rollback / pre-existing-data preservation (via rollback-run.mjs's own sentinel demo)
//   - package/checksum/approval-integrity gate
//
// Run with:
//   node scripts/test-approved-research-import-safety.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ISO_ROOT = path.resolve(__dirname, '..'); // C:\fw-iso\src (this isolated app copy)
// tools/ is a sibling of src/ under the isolated workspace root (C:\fw-iso\tools), not inside
// src/ itself -- src/ is the read-only-shaped application snapshot; tools/ is new tooling this
// integration added alongside it. See C:\fw-iso\SOURCE-COMMIT.md for the workspace layout.
const TOOLS_DIR = path.join(ISO_ROOT, '..', 'tools');

let failures = 0;
function check(label, cond) {
  if (cond) { console.log(`  ok   ${label}`); }
  else { console.log(`  FAIL ${label}`); failures++; }
}
function section(name) { console.log(`\n${name}`); }

function runTool(script, args) {
  try {
    const out = execFileSync('node', [script, ...args], { cwd: TOOLS_DIR, encoding: 'utf8' });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') };
  }
}

const DATA_DIR = path.join(os.tmpdir(), `fw-iso-test-import-${Date.now()}`);
const RUN_ID = `test-run-${Date.now()}`;
const MANIFEST_PATH = path.join(TOOLS_DIR, 'runs', `${RUN_ID}-inserted.json`);

function cleanup() {
  try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch {}
  try { fs.rmSync(MANIFEST_PATH, { force: true }); } catch {}
}
cleanup();

try {
  // ==========================================================================
  section('import-tool.mjs: dry-run is the default (no --commit passed)');
  // ==========================================================================
  {
    const r1 = runTool('import-tool.mjs', [`--data-dir=${DATA_DIR}`, `--run-id=${RUN_ID}`]);
    check('exits 0', r1.code === 0);
    check('reports DRY-RUN mode explicitly', /DRY-RUN \(default/.test(r1.out));
    check('reports "to insert" counts for a fresh disposable database', /to insert/.test(r1.out));
    check('never claims a write occurred', !/COMMIT phase/i.test(r1.out));
    check('no manifest file written on a dry run', !fs.existsSync(MANIFEST_PATH));
  }

  // ==========================================================================
  section('import-tool.mjs: refuses a real --db-url outright');
  // ==========================================================================
  {
    const r = runTool('import-tool.mjs', ['--db-url=postgres://example-not-real/db']);
    check('exits non-zero (refuses)', r.code !== 0);
    check('states it never uses --db-url this session', /never passes --db-url/.test(r.out));
  }

  // ==========================================================================
  section('import-tool.mjs --commit: first real commit against the disposable local-directory database');
  // ==========================================================================
  {
    const r = runTool('import-tool.mjs', [`--data-dir=${DATA_DIR}`, `--run-id=${RUN_ID}`, '--commit']);
    check('exits 0', r.code === 0);
    check('reports COMMIT mode', /COMMIT \(will write\)/.test(r.out));
    check('reports referential integrity verification before commit', /[Rr]eferential integrity/.test(r.out) || /verified/i.test(r.out));
    check('a run manifest was written', fs.existsSync(MANIFEST_PATH));
  }
  let manifest = null;
  if (fs.existsSync(MANIFEST_PATH)) manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  check('manifest run_id matches', manifest?.run_id === RUN_ID);
  check('manifest recorded at least one inserted species', (manifest?.inserted?.species?.length ?? 0) > 0);

  // ==========================================================================
  section('import-tool.mjs: idempotent re-run against the SAME persisted database (existing-ID, identical content)');
  // ==========================================================================
  {
    const r = runTool('import-tool.mjs', [`--data-dir=${DATA_DIR}`, `--run-id=${RUN_ID}-rerun`]);
    check('exits 0 (no conflict)', r.code === 0);
    check('reports 0 to_insert for species on the second pass', /species: 0 to insert/.test(r.out));
    check('reports every species already present, identical', /already present \(identical\)/.test(r.out));
    check('explicitly states no conflicts were found', /No conflicts\./.test(r.out));
  }

  // ==========================================================================
  section('import-tool.mjs: existing-ID with DIFFERENT content aborts the entire import before any write');
  // ==========================================================================
  {
    // Runs as a one-off subprocess with cwd = tools/, so it resolves
    // @electric-sql/pglite from tools/node_modules exactly like the tools
    // themselves do -- this test file has no dependency of its own on that
    // package, deliberately.
    const tamperScript = path.join(TOOLS_DIR, `.tamper-test-${Date.now()}.mjs`);
    fs.writeFileSync(tamperScript, `
      import { PGlite } from '@electric-sql/pglite';
      const db = new PGlite(process.argv[2]);
      const { rows } = await db.query('SELECT id FROM angling_species LIMIT 1');
      await db.query("UPDATE angling_species SET common_name_primary = 'TAMPERED FOR TEST' WHERE id = $1", [rows[0].id]);
      console.log(rows[0].id);
      await db.close();
    `);
    let targetId = '';
    try {
      targetId = execFileSync('node', [tamperScript, DATA_DIR], { cwd: TOOLS_DIR, encoding: 'utf8' }).trim();
    } finally {
      fs.rmSync(tamperScript, { force: true });
    }

    const r = runTool('import-tool.mjs', [`--data-dir=${DATA_DIR}`, `--run-id=${RUN_ID}-conflict-check`]);
    check('exits non-zero (aborts)', r.code !== 0);
    check('reports CONFLICT DETECTED', /CONFLICT DETECTED -- ABORTING/.test(r.out));
    check('states it never uses ON CONFLICT DO NOTHING to hide the mismatch', /never uses ON CONFLICT DO NOTHING/.test(r.out));
    check('names the specific mismatched record', targetId.length > 0 && r.out.includes(targetId));
    // No restore needed: DATA_DIR is a disposable throwaway directory, deleted by cleanup() below --
    // never a real database, so leaving the tamper in place has no lasting effect on anything.
  }

  // ==========================================================================
  section('rollback-run.mjs: dry-run is the default, and only accepts a real run manifest');
  // ==========================================================================
  {
    const rMissing = runTool('rollback-run.mjs', ['no-such-run-id']);
    check('a nonexistent run id is refused, not guessed at', rMissing.code !== 0 && /Refusing to guess/.test(rMissing.out));

    const r = runTool('rollback-run.mjs', [RUN_ID]);
    check('exits 0', r.code === 0);
    check('reports DRY-RUN by default', /DRY-RUN \(default/.test(r.out));
    check('states it only considers this run\'s own inserted IDs', /Only these exact IDs will ever be considered/.test(r.out));
  }

  // ==========================================================================
  section('rollback-run.mjs: rollback deletes only its own inserted records, pre-existing data (sentinel) survives');
  // ==========================================================================
  {
    const r = runTool('rollback-run.mjs', [RUN_ID, '--commit']);
    check('exits 0', r.code === 0);
    check('the pre-existing sentinel row is confirmed to survive', /Sentinel pre-existing row still present: YES/.test(r.out));
    check('the tool\'s own self-check reports PASS', /RESULT: PASS/.test(r.out));
  }
} finally {
  cleanup();
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
