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

// Release identifier, hoisted to module scope: used below by both the sw.js
// cache name AND _headers' X-FishWizz-Release header AND the HTML shell's
// own <meta> tag / window.__FISHWIZZ_BUILD__ -- one real value, computed
// once, not four independent copies that could drift from each other.
let BUILD = null;

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
  BUILD = createHash('sha256')
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

// --- 1b. release identifier in the HTML shell + browser diagnostics --------
//
// release-blocking stabilization (2026-08-28 follow-up): "Add a non-
// sensitive release identifier to: the HTML shell, the service worker, a
// response header, and the browser diagnostics. These identifiers must
// match." BUILD (computed above, from a real content hash of every shipped
// file) is that one identifier -- sw.js's own CACHE name already carries it;
// this step adds it to index.html (both a <meta> tag any tool/human can
// read without executing JS, and window.__FISHWIZZ_BUILD__ for runtime
// diagnostics/console use); _headers' own X-FishWizz-Release substitution
// happens in step 2 below. scripts/verify-release-match.mjs asserts all
// four actually agree after every build.

const indexPath = join(DIST, 'index.html');
if (BUILD && existsSync(indexPath)) {
  const htmlSrc = readFileSync(indexPath, 'utf8');
  if (!/<head[^>]*>/.test(htmlSrc)) {
    errors.push('index.html: no <head> tag found -- cannot inject the release identifier');
  } else {
    // A <meta> tag only -- deliberately not an inline <script> setting
    // window.__FISHWIZZ_BUILD__ directly, which would violate this app's
    // own script-src 'self' CSP the instant it leaves Report-Only mode.
    // src/runtime/index.js (already loaded same-origin, satisfying CSP as-is)
    // reads this tag itself and sets window.__FISHWIZZ_BUILD__ from it.
    const injected = htmlSrc.replace(
      /<head([^>]*)>/,
      `<head$1><meta name="fishwizz-build" content="${BUILD}">`,
    );
    if (injected === htmlSrc) errors.push('index.html: could not inject the release identifier');
    else { writeFileSync(indexPath, injected); notes.push(`index.html: release identifier ${BUILD} injected`); }
  }
} else if (!BUILD) {
  errors.push('index.html: no BUILD identifier available to inject (sw.js precache step above must have failed)');
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

    // P1 follow-up, caught live in production: a broad /*.js glob also
    // matched /assets/*.js, and Cloudflare's _headers engine concatenates
    // every matching rule's Cache-Control rather than letting the more
    // specific one win -- the live, deployed response for the hashed
    // bundle came back as the self-contradicting "no-cache, must-
    // revalidate, public, max-age=31536000, immutable". One exact rule per
    // real non-hashed .js/.css file (never a glob, so it can never
    // accidentally reach into /assets/) is the only version of this that
    // cannot repeat that bug -- generated from the real file list, so it
    // can never drift from what dist/ actually contains either.
    const nonHashedRules = [...present]
      .filter(u => /\.(?:js|css)$/.test(u) && !u.startsWith('/assets/'))
      .sort()
      .map(u => `${u}\n  Cache-Control: no-cache, must-revalidate`)
      .join('\n\n');

    const renderedHeaders = readFileSync(tpl, 'utf8')
      .replaceAll('%SUPABASE_ORIGIN%', origin)
      .replaceAll('%FISHWIZZ_BUILD%', BUILD || 'unknown')
      .replaceAll('%FISHWIZZ_NONHASHED_RULES%', nonHashedRules);

    // Catches the exact class of bug just found live in production: a
    // template placeholder token that also appears inside an explanatory
    // comment gets replaceAll'd there too, duplicating that path's rule
    // block -- which _headers concatenates rather than dedupes (see this
    // section's own header comment). Every path line (one per blank-line-
    // separated block) must appear exactly once in the rendered output.
    const pathLines = renderedHeaders.split('\n').filter(l => l.startsWith('/'));
    const duplicatePaths = pathLines.filter((p, i) => pathLines.indexOf(p) !== i);
    if (duplicatePaths.length) errors.push(`_headers: duplicate rule block(s) for ${[...new Set(duplicatePaths)].join(', ')} -- likely a placeholder token also matched inside a comment`);

    writeFileSync(join(DIST, '_headers'), renderedHeaders);
    notes.push(`_headers: written, API origin ${origin}, ${[...present].filter(u => /\.(?:js|css)$/.test(u) && !u.startsWith('/assets/')).length} exact non-hashed cache rules`);
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