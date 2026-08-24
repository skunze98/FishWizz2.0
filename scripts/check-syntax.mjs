#!/usr/bin/env node
/**
 * FishWizz — syntax check for the legacy public/ scripts.
 *
 * `public/*.js` are classic (non-module) scripts, loaded at runtime by
 * src/runtime/index.js and public/pwa.js rather than through Vite's module
 * graph -- so `vite build` never parses them and a stray syntax error is
 * invisible until a real browser loads that exact file. `npm run check`
 * exists to catch that before it ships; it was referenced from package.json
 * but the script itself was missing, so it always failed with
 * MODULE_NOT_FOUND instead of ever actually checking anything.
 *
 * `node --check` parses each file without executing it, so browser-only
 * globals (window, document, session, api, ...) are never touched -- this
 * only proves the JavaScript is syntactically valid, not that it runs.
 */

import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, extname, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOTS = ['public', 'scripts', 'src'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);

function walk(dir) {
  let out = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out = out.concat(walk(full));
    else if (extname(entry) === '.js' || extname(entry) === '.mjs') out.push(full);
  }
  return out;
}

const files = ROOTS.filter(r => statSync(r, { throwIfNoEntry: false })).flatMap(walk);

if (files.length === 0) {
  console.error('check-syntax: found no .js/.mjs files under ' + ROOTS.join(', '));
  process.exit(1);
}

const failures = [];
for (const file of files) {
  // src/**/*.js use import/export (ES modules); everything else (public/,
  // scripts/) is loaded as a classic <script> and must parse as one.
  const isModule = file.split(sep)[0] === 'src' || extname(file) === '.mjs';

  const result = isModule
    // --check on stdin needs --input-type=module to accept import/export;
    // it can't take a file path in that mode, so pipe the source in instead.
    ? spawnSync(process.execPath, ['--input-type=module', '--check'], {
        input: readFileSync(file, 'utf8'),
        encoding: 'utf8',
      })
    : spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });

  if (result.status !== 0) {
    failures.push({ file, error: (result.stderr || result.error?.message || 'unknown error').trim() });
  }
}

if (failures.length) {
  console.error(`check-syntax: ${failures.length} of ${files.length} file(s) failed to parse:\n`);
  for (const { file, error } of failures) {
    console.error(`--- ${file} ---`);
    console.error(error);
    console.error('');
  }
  process.exit(1);
}

console.log(`check-syntax: ok, ${files.length} files parsed cleanly`);
