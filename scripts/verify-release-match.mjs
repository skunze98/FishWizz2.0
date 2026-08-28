#!/usr/bin/env node
// release-blocking stabilization (2026-08-28 follow-up): "Add a non-
// sensitive release identifier to: the HTML shell, the service worker, a
// response header, and the browser diagnostics. These identifiers must
// match." This asserts all four actually agree, against the real built
// dist/ output -- not a re-implementation of postbuild.mjs's own
// substitution logic, a check that its result is actually self-consistent.
//
// Run after `npm run build` (which runs this repo's own postbuild.mjs):
//   node scripts/verify-release-match.mjs
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
let failures = 0;
function check(label, cond) {
  if (cond) { console.log(`  ok   ${label}`); }
  else { console.log(`  FAIL ${label}`); failures++; }
}

if (!existsSync(DIST)) {
  console.error('verify-release-match: dist/ does not exist -- run `npm run build` first');
  process.exit(1);
}

const indexHtml = existsSync(join(DIST, 'index.html')) ? readFileSync(join(DIST, 'index.html'), 'utf8') : null;
const swSrc = existsSync(join(DIST, 'sw.js')) ? readFileSync(join(DIST, 'sw.js'), 'utf8') : null;
const headers = existsSync(join(DIST, '_headers')) ? readFileSync(join(DIST, '_headers'), 'utf8') : null;

check('dist/index.html exists', indexHtml !== null);
check('dist/sw.js exists', swSrc !== null);
check('dist/_headers exists', headers !== null);

const htmlBuild = indexHtml?.match(/<meta name="fishwizz-build" content="([^"]+)">/)?.[1];
const swBuild = swSrc?.match(/const CACHE='fishwizz-shell-([^']+)';/)?.[1];
const headerBuild = headers?.match(/X-FishWizz-Release:\s*(\S+)/)?.[1];

check('index.html carries a release identifier (<meta name="fishwizz-build">)', !!htmlBuild);
check('sw.js carries a release identifier (its own CACHE name)', !!swBuild);
check('_headers carries a release identifier (X-FishWizz-Release)', !!headerBuild);

if (htmlBuild && swBuild && headerBuild) {
  check('index.html and sw.js agree on the release identifier', htmlBuild === swBuild);
  check('index.html and _headers agree on the release identifier', htmlBuild === headerBuild);
  check('sw.js and _headers agree on the release identifier', swBuild === headerBuild);
}

// src/runtime/index.js reads the SAME <meta> tag into
// window.__FISHWIZZ_BUILD__ at runtime rather than computing its own value
// -- verified structurally here (by construction it cannot disagree, since
// there is only one place it could come from), confirmed live in the
// browser separately (see the session's own production verification, not
// re-derivable from a static file check).
const runtimeSrc = existsSync('src/runtime/index.js') ? readFileSync('src/runtime/index.js', 'utf8') : '';
check('src/runtime/index.js reads window.__FISHWIZZ_BUILD__ from the SAME <meta> tag (not an independent computation)', /window\.__FISHWIZZ_BUILD__\s*=\s*document\.querySelector\(['"]meta\[name="fishwizz-build"\]['"]\)/.test(runtimeSrc));

// _headers must never be reachable as a public application asset -- it is
// deploy-time configuration, not content.
check('_headers is not referenced by index.html as a loadable asset', !indexHtml?.includes('href="/_headers"') && !indexHtml?.includes('src="/_headers"'));

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
