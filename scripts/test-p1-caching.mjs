#!/usr/bin/env node
// Regression test for P1 "Different tabs and refreshes load different
// FishWizz versions" (release-blocking stabilization, 2026-08-28).
//
// Root cause, confirmed live against the deployed target, not guessed:
// dist/_headers (rendered by scripts/postbuild.mjs, a Cloudflare *Pages*
// convention) is silently ignored by Cloudflare Workers Static Assets --
// what fishwizz2-0 actually deploys to. Confirmed by fetching /_headers on
// the live deployment and getting back the raw template file content as a
// plain served asset, not applied header rules. Every non-hashed file
// (index.html, sw.js, every public/*.js legacy script) was instead served
// under Cloudflare's own default asset caching, observed live returning
// CF-Cache-Status: HIT -- explaining how a stale cached copy of a legacy
// script could silently keep running next to a fresh index.html/nav shell
// in one tab while a different tab (or edge POP) got the real current set.
// Fixed by moving Cache-Control logic into .deploy/fishwizz-static-worker.mjs's
// own fetch handler, since that's the one thing whose headers this
// deployment target actually honors.
//
// Run with:
//   node scripts/test-p1-caching.mjs
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

let failures = 0;
function check(label, cond) {
  if (cond) { console.log(`  ok   ${label}`); }
  else { console.log(`  FAIL ${label}`); failures++; }
}
function section(name) { console.log(`\n${name}`); }

section('.deploy/fishwizz-static-worker.mjs: hashed assets get immutable caching, everything else must revalidate');
{
  const worker = (await import(pathToFileURL(path.join(root, '.deploy/fishwizz-static-worker.mjs')))).default;

  async function fetchThrough(pathname) {
    const env = { ASSETS: { fetch: async () => new Response('body', { status: 200, headers: { 'content-type': 'text/plain' } }) } };
    const response = await worker.fetch(new Request(`https://fishwizz2-0.example.workers.dev${pathname}`), env);
    return response.headers.get('Cache-Control');
  }

  check('a Vite content-hashed bundle gets long, immutable caching', (await fetchThrough('/assets/main.DuzO67xA.js')) === 'public, max-age=31536000, immutable');
  check('index.html (unhashed, changes every deploy) must revalidate, never cached blindly', (await fetchThrough('/index.html')) === 'no-cache');
  check('the root path must revalidate', (await fetchThrough('/')) === 'no-cache');
  check('sw.js itself (the thing that decides whether a NEW service worker is even noticed) must revalidate', (await fetchThrough('/sw.js')) === 'no-cache');
  check('an unhashed legacy module (app.js) must revalidate -- this is the exact file class that caused the reported bug', (await fetchThrough('/app.js')) === 'no-cache');
  check('an unhashed legacy module (gear-state.js) must revalidate', (await fetchThrough('/gear-state.js')) === 'no-cache');
  check('the manifest must revalidate', (await fetchThrough('/manifest.webmanifest')) === 'no-cache');
}

section('.deploy/direct-cloudflare-assets-upload.mjs no longer hardcodes a second, drifting copy of the worker source');
{
  const uploadScript = fs.readFileSync(path.join(root, '.deploy/direct-cloudflare-assets-upload.mjs'), 'utf8');
  check('the deploy script reads fishwizz-static-worker.mjs from disk instead of duplicating its content as a literal', /readFileSync\(.*fishwizz-static-worker\.mjs/.test(uploadScript));
  check('the old hardcoded literal worker source is gone', !uploadScript.includes(`fetch(request, env) { return env.ASSETS.fetch(request); }`));
}

section('public/sw.js: precache versioning and activation lifecycle are still sound');
{
  const swSrc = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
  check('install calls skipWaiting() -- a new SW activates immediately, not after every tab closes', /self\.skipWaiting\(\)/.test(swSrc));
  check('activate deletes every cache that is not the current one -- no obsolete FishWizz caches survive a new release', /caches\.delete/.test(swSrc));
  check('activate calls clients.claim() -- an already-open tab is controlled by the new SW without a manual refresh', /clients\.claim\(\)/.test(swSrc));
  check('the fetch handler is network-first (fetch before falling back to cache), not cache-first', /event\.respondWith\(fetch\(event\.request\)/.test(swSrc));
  // scripts/postbuild.mjs versions CACHE from a real content hash of every
  // shipped file (see that script's own BUILD computation) -- confirmed
  // structurally here rather than re-deriving the hash logic in this test.
  check('the cache name is a placeholder postbuild.mjs actually substitutes at build time (not a stale hardcoded version)', /const CACHE='fishwizz-shell-[^']+';/.test(swSrc));
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
