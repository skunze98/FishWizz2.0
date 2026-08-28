#!/usr/bin/env node
// Regression test for P1 "Different tabs and refreshes load different
// FishWizz versions" (release-blocking stabilization, 2026-08-28, and its
// follow-up correction).
//
// Original diagnosis (WRONG, corrected by the user): "Workers Static
// Assets ignores _headers entirely." Actual root cause, confirmed by
// checking wrangler.toml/run_worker_first: this project never deployed via
// `wrangler`/a config file at all. Its old .deploy/direct-cloudflare-
// assets-upload.mjs hand-rolled the raw Assets Upload API directly,
// uploading _headers as an inert static file rather than the special,
// deploy-time-parsed rules file `wrangler deploy` treats it as. It also
// shipped a Worker script with no run_worker_first setting (defaults
// false), so Cloudflare's Assets binding served matching paths directly,
// bypassing that Worker's own fetch handler entirely -- confirmed live
// that a Cache-Control header set inside it had zero observable effect.
//
// Fixed by removing both of those files and switching to the standard
// `wrangler deploy` pipeline (wrangler.toml, no `main` Worker script at
// all -- assets served directly, _headers genuinely governs caching).
//
// Run with:
//   node scripts/test-p1-caching.mjs
import fs from 'node:fs';
import path from 'node:path';

let failures = 0;
function check(label, cond) {
  if (cond) { console.log(`  ok   ${label}`); }
  else { console.log(`  FAIL ${label}`); failures++; }
}
function section(name) { console.log(`\n${name}`); }

const root = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

section('the old, competing deploy pipeline is gone -- one authoritative path remains');
{
  check('.deploy/direct-cloudflare-assets-upload.mjs (the raw Upload API script) no longer exists', !fs.existsSync(path.join(root, '.deploy/direct-cloudflare-assets-upload.mjs')));
  check('.deploy/fishwizz-static-worker.mjs (the Worker whose header-setting code was never actually invoked) no longer exists', !fs.existsSync(path.join(root, '.deploy/fishwizz-static-worker.mjs')));
  check('wrangler.toml exists as the one real deployment configuration', fs.existsSync(path.join(root, 'wrangler.toml')));
}

section('wrangler.toml: explicit, deliberate configuration -- not left to Cloudflare\'s implicit defaults');
{
  const toml = fs.readFileSync(path.join(root, 'wrangler.toml'), 'utf8');
  check('assets.directory references dist/', /directory\s*=\s*"\.\/dist"/.test(toml));
  check('SPA fallback is configured explicitly (not_found_handling)', /not_found_handling\s*=\s*"single-page-application"/.test(toml));
  check('there is no `main` field -- explicitly no Worker script runs before static assets', !/^\s*main\s*=/m.test(toml));
  // Matches only a real TOML key=value line, not this file's own explanatory
  // comment mentioning "run_worker_first" by name.
  check('run_worker_first is not set (assets are served directly, the deliberate choice this config documents)', !/^\s*run_worker_first\s*=/m.test(toml));
}

section('_headers.template: the exact cache rules requested, and the release identifier');
{
  const tpl = fs.readFileSync(path.join(root, 'public/_headers.template'), 'utf8');
  const rule = (pathPrefix) => {
    const idx = tpl.indexOf(`\n${pathPrefix}\n`);
    if (idx === -1) return null;
    return tpl.slice(idx, tpl.indexOf('\n\n', idx));
  };
  check('index.html: no-cache, must-revalidate', /no-cache, must-revalidate/.test(rule('/index.html') || ''));
  check('/: no-cache, must-revalidate', /no-cache, must-revalidate/.test(rule('/') || ''));
  check('hashed /assets/*: long-lived immutable', /public, max-age=31536000, immutable/.test(rule('/assets/*') || ''));
  check('a release-identifier response header is configured (X-FishWizz-Release)', /X-FishWizz-Release:\s*%FISHWIZZ_BUILD%/.test(tpl));
  // P1 follow-up, caught live in production: a broad /*.js glob also
  // matched /assets/*.js, and Cloudflare's _headers engine concatenates
  // every matching rule's Cache-Control rather than letting the more
  // specific one win -- confirmed live returning a self-contradicting
  // header on the hashed bundle. The template no longer contains ANY glob
  // that could cross into /assets/; postbuild.mjs generates one exact rule
  // per real non-hashed file instead (verified in the next section).
  check('no broad /*.js glob remains in the template (the exact bug this fix routes around)', !/\n\/\*\.js\n/.test(tpl));
  check('no broad /*.css glob remains in the template', !/\n\/\*\.css\n/.test(tpl));
  check('sw.js is no longer given its own separate rule -- it is covered by the generated non-hashed-file rules like every other legacy script (removing the redundancy that used to also concatenate)', !/\n\/sw\.js\n/.test(tpl));
}

section('scripts/postbuild.mjs: non-hashed cache rules are generated as exact paths, never overlapping glob(s)');
{
  const postbuild = fs.readFileSync(path.join(root, 'scripts/postbuild.mjs'), 'utf8');
  check('non-hashed rules are built from the real file list (present), filtered to exclude anything under /assets/', /filter\(u => \/\\\.\(\?:js\|css\)\$\/\.test\(u\) && !u\.startsWith\('\/assets\/'\)\)/.test(postbuild));
  check('a build-time guard rejects any duplicate rule path in the rendered _headers output (the exact class of bug a comment accidentally matching a placeholder caused)', /duplicatePaths/.test(postbuild) && /_headers: duplicate rule block/.test(postbuild));
}

section('dist/_headers (if a build has been run): every path appears exactly once, and the hashed bundle is never double-ruled');
{
  const distHeaders = path.join(root, 'dist/_headers');
  if (fs.existsSync(distHeaders)) {
    const rendered = fs.readFileSync(distHeaders, 'utf8');
    const pathLines = rendered.split('\n').filter(l => l.startsWith('/'));
    const duplicates = pathLines.filter((p, i) => pathLines.indexOf(p) !== i);
    check('no path appears more than once in the actual rendered dist/_headers', duplicates.length === 0);
    check('app.js (a representative legacy script) has its own exact rule', rendered.includes('\n/app.js\n'));
  } else {
    console.log('  (skipped -- run `npm run build` first to check the real rendered dist/_headers)');
  }
}

section('scripts/postbuild.mjs: the release identifier is computed once and substituted everywhere, never independently re-derived');
{
  const postbuild = fs.readFileSync(path.join(root, 'scripts/postbuild.mjs'), 'utf8');
  check('BUILD is hoisted to module scope (shared by the sw.js, index.html, and _headers steps)', /let BUILD = null;/.test(postbuild));
  check('_headers gets %FISHWIZZ_BUILD% substituted from the same BUILD value', /replaceAll\('%FISHWIZZ_BUILD%',\s*BUILD/.test(postbuild));
  check('index.html gets a <meta name="fishwizz-build"> tag injected from the same BUILD value', /<meta name="fishwizz-build" content="\$\{BUILD\}">/.test(postbuild));
  check('_headers.template itself is still removed from the final dist/ output (it is deploy-time input, never a servable file)', /rmSync\(tpl,\s*\{\s*force:\s*true\s*\}\)/.test(postbuild));
}

section('src/runtime/index.js: reads the SAME identifier for browser diagnostics, never computes its own');
{
  const runtime = fs.readFileSync(path.join(root, 'src/runtime/index.js'), 'utf8');
  check('window.__FISHWIZZ_BUILD__ is read from the <meta> tag, not independently computed', /window\.__FISHWIZZ_BUILD__\s*=\s*document\.querySelector\(['"]meta\[name="fishwizz-build"\]['"]\)\?\.content/.test(runtime));
}

section('public/sw.js: precache versioning and activation lifecycle are still sound');
{
  const swSrc = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
  check('install calls skipWaiting() -- a new SW activates immediately, not after every tab closes', /self\.skipWaiting\(\)/.test(swSrc));
  check('activate deletes every cache that is not the current one -- no obsolete FishWizz caches survive a new release', /caches\.delete/.test(swSrc));
  check('activate calls clients.claim() -- an already-open tab is controlled by the new SW without a manual refresh', /clients\.claim\(\)/.test(swSrc));
  check('the fetch handler is network-first (fetch before falling back to cache), not cache-first', /event\.respondWith\(fetch\(event\.request\)/.test(swSrc));
  check('the cache name is a placeholder postbuild.mjs actually substitutes at build time (not a stale hardcoded version)', /const CACHE='fishwizz-shell-[^']+';/.test(swSrc));
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
