#!/usr/bin/env node
/**
 * FishWizz — post-build: generate, then verify.
 *
 * Two jobs.
 *
 * 1. Generate the things that were previously hand-maintained and drifted:
 *    the service worker's precache list and the _headers file.
 *
 * 2. Refuse to ship a build with a dangling reference. The service worker had
 *    never once registered in production -- it precached /spatial-mentor.js,
 *    a file that does not exist, and cache.addAll() rejects atomically. That
 *    class of bug is invisible at runtime (pwa.js logs it to console and moves
 *    on) and is exactly what a build step is for.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';

const DIST = 'dist';
const errors = [];
const notes = [];

if (!existsSync(DIST)) {
  console.error('postbuild: dist/ does not exist -- run vite build first');
  process.exit(1);
}

const walk = d => readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);

const files = walk(DIST);
const urlOf = f => '/' + relative(DIST, f).split(sep).join('/');
const present = new Set(files.map(urlOf));
const read = u => readFileSync(join(DIST, u.slice(1)), 'utf8');

// --- 1. service worker precache list ---------------------------------------
// Derived from what is actually in dist/, never from a hand-kept list.

const swPath = join(DIST, 'sw.js');
if (!existsSync(swPath)) {
  errors.push('sw.js is missing from dist/');
} else {
  const swSrc = readFileSync(swPath, 'utf8');

  // The shell = the app skeleton needed to boot offline: the document, styles,
  // hashed bundler output, the eagerly-loaded scripts from index.html, and the
  // PWA metadata. Lazily-loaded modules are cached on first use by the fetch
  // handler instead of precached, matching the existing runtime behaviour.
  const html = existsSync(join(DIST, 'index.html')) ? read('/index.html') : '';
  // Accept both "/app.js" and "app.js" -- a silently-empty match here would
  // shrink the shell without failing anything, which is the same shape of bug
  // this script exists to prevent.
  const eager = [...html.matchAll(/<script[^>]+src="(?!https?:)\/?([^"]+\.js)"/g)].map(m => '/' + m[1]);
  if (eager.length === 0) errors.push('index.html: found no same-origin <script src> tags -- the shell would be incomplete');

  // The nine legacy core modules are no longer <script> tags -- src/runtime
  // injects them so the auth shim can run first. Read that list from the
  // runtime source so the shell cannot drift from what actually loads.
  const RUNTIME_SRC = 'src/runtime/index.js';
  let chain = [];
  if (existsSync(RUNTIME_SRC)) {
    const block = readFileSync(RUNTIME_SRC, 'utf8').match(/const LEGACY\s*=\s*\[([^\]]*)\]/);
    if (block) chain = [...block[1].matchAll(/'(\/[^']+\.js)'/g)].map(m => m[1]);
  }
  if (chain.length === 0) errors.push(`${RUNTIME_SRC}: could not read the LEGACY chain -- the shell would be incomplete`);
  eager.push(...chain);

  const SHELL = ['/'].concat([...present].filter(u =>
    /^\/(index\.html|manifest\.webmanifest|atlas-icon\.svg)$/.test(u) ||
    /^\/[^/]+\.css$/.test(u) ||
    (/^\/assets\//.test(u) && !u.endsWith('.map'))   // never precache sourcemaps
  )).concat(eager).filter((u, i, a) => a.indexOf(u) === i);

  // Validate BEFORE reading anything, so a dangling reference produces the
  // diagnostic below rather than an ENOENT stack trace from the hash.
  const missing = SHELL.filter(u => u !== '/' && !present.has(u));
  for (const u of missing) errors.push(`sw precache references a missing file: ${u}`);

  // Version the cache from every shipped runtime asset, including lazy page
  // modules such as gear-catalog.js. Hash contents rather than file lengths:
  // two releases can easily have equal byte counts but different behavior.
  const versioned = [...present]
    .filter(u => u !== '/sw.js' && u !== '/_headers' && !u.endsWith('.map'))
    .sort();
  const BUILD = createHash('sha256')
    .update(versioned.map(u => {
      const contentHash = createHash('sha256')
        .update(readFileSync(join(DIST, u.slice(1))))
        .digest('hex');
      return `${u}:${contentHash}`;
    }).join('|'))
    .digest('hex').slice(0, 12);

  let out = swSrc;
  if (swSrc.includes('__ATLAS_SHELL__')) out = out.replace('__ATLAS_SHELL__', JSON.stringify(SHELL));
  else out = out.replace(/const SHELL=\[[^\]]*\];/, `const SHELL=${JSON.stringify(SHELL)};`);

  if (out.includes('__ATLAS_BUILD__')) out = out.replace('__ATLAS_BUILD__', BUILD);
  else out = out.replace(/const CACHE='[^']*';/, `const CACHE='fishwizz-shell-${BUILD}';`);

  if (out === swSrc) errors.push('sw.js: could not substitute SHELL/CACHE -- the expected shape changed');
  writeFileSync(swPath, out);
  notes.push(`sw.js: build ${BUILD}, ${SHELL.length} shell entries`);
}

// --- 2. _headers ------------------------------------------------------------

const tpl = join(DIST, '_headers.template');
if (existsSync(tpl)) {
  // Prefer the build-time env var; fall back to whatever app.js is actually
  // pointing at, so a misconfigured CSP can never silently block the API.
  let origin = process.env.VITE_SUPABASE_URL;
  if (!origin && existsSync('.env')) {
    // Vite reads .env itself, but this script runs as plain node afterwards.
    // [^\S\n] not \s -- \s matches newlines, so an empty value would swallow
    // the next line and produce a nonsense "origin".
    origin = readFileSync('.env', 'utf8').match(/^[^\S\n]*VITE_SUPABASE_URL[^\S\n]*=[^\S\n]*(\S+)[^\S\n]*$/m)?.[1];
    if (origin) notes.push('_headers: Supabase origin read from .env');
  }
  if (!origin) {
    // Last resort: whatever origin actually made it into the built bundle, so
    // the CSP can never disagree with the code it is protecting.
    const bundle = [...present].find(u => /^\/assets\/main\..*\.js$/.test(u));
    if (bundle) {
      origin = read(bundle).match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0];
      if (origin) notes.push(`_headers: using ${origin} found in the built bundle`);
    }
  }
  if (!origin) errors.push('_headers: no Supabase origin -- set VITE_SUPABASE_URL');
  else {
    origin = new URL(origin).origin;

    // FishWizz runs against two Supabase projects (production and staging), so
    // an environment mixup is now a real possibility. If the CSP names one
    // project and the bundle was built against the other, every API call is
    // blocked at runtime by connect-src -- a failure that looks like an outage,
    // not a config error. Catch it here instead.
    const bundle = [...present].find(u => /^\/assets\/main\..*\.js$/.test(u));
    const inBundle = bundle && read(bundle).match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0];
    if (inBundle && inBundle !== origin) {
      errors.push(`environment mismatch: CSP allows ${origin} but the bundle calls ${inBundle}`);
    }
    if (bundle && !inBundle) {
      errors.push('the built bundle contains no Supabase origin -- VITE_SUPABASE_URL was empty at build time');
    }

    writeFileSync(join(DIST, '_headers'),
      readFileSync(tpl, 'utf8').replaceAll('%SUPABASE_ORIGIN%', origin));
    notes.push(`_headers: written, API origin ${origin}`);
  }
  // publicDir copies the template into dist/ as a side effect. It is build
  // input, not something to serve.
  rmSync(tpl, { force: true });
} else {
  errors.push('_headers.template is missing from dist/');
}

// --- 3. verify every reference resolves -------------------------------------

if (present.has('/index.html')) {
  const html = read('/index.html');
  for (const m of html.matchAll(/<(?:script[^>]+src|link[^>]+href)="(?!https?:|data:)\/?([^"]+)"/g)) {
    const u = '/' + m[1];
    if (!present.has(u)) errors.push(`index.html references a missing file: ${u}`);
  }
}

// pwa.js lazily injects modules by hardcoded URL. A typo here is invisible
// until a user navigates to that page, so check it at build time.
if (present.has('/pwa.js')) {
  for (const m of read('/pwa.js').matchAll(/'(\/[a-zA-Z0-9._-]+\.js)'/g)) {
    if (!present.has(m[1])) errors.push(`pwa.js lazy-loads a missing module: ${m[1]}`);
  }
}

// app.js used to declare `const URL = 'https://...supabase.co'` at classic
// script top level, shadowing the global URL constructor for every script
// loaded after it. That broke URL.createObjectURL in inventory-add.js and would
// break supabase-js's OAuth callback parsing. Never again.
for (const f of files) {
  const u = urlOf(f);
  if (!u.endsWith('.js') || u.startsWith('/assets/')) continue;
  if (/\b(?:const|let|var)\s+URL\s*=/.test(readFileSync(f, 'utf8'))) {
    errors.push(`${u} shadows the global URL constructor`);
  }
}

// --- report -----------------------------------------------------------------

for (const n of notes) console.log(`postbuild: ${n}`);
if (errors.length) {
  console.error('\npostbuild FAILED:');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`postbuild: ok, ${files.length} files in dist/`);