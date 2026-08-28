#!/usr/bin/env node
// Regression test for P1 "320x700 layout horizontally overflows" (independent
// authenticated production QA, NO-GO on release 6ae72c096be9, 2026-08-28),
// measured as: clientWidth 305px vs scrollWidth 365px; .card elements 353px
// wide; chips extending to 719px.
//
// Root cause, confirmed live in a real browser (fishwizz-dev, 320x700,
// Mission page): @media(max-width:800px){.grid{grid-template-columns:1fr}}
// -- a bare `1fr` track's IMPLICIT minimum is `auto` (its content's
// min-content size), not 0, unlike the desktop two-column layout which
// already correctly uses minmax(0,1.44fr) for exactly this reason. The
// source-legend chip row (launch.js, deliberately flex-wrap:nowrap +
// overflow-x:auto so it can scroll horizontally on purpose) is
// intrinsically ~710px wide; without minmax(0,...) on the mobile grid
// track, that forced the whole single mobile column -- and therefore
// #planCards' own card grid inside it -- wider than the real viewport.
//
// Reverting the one-line fix below and re-measuring in the live dev
// server reproduced scrollWidth 369 vs clientWidth 320, .card at
// 355.97px, and legend content at 710px -- matching the reported numbers
// almost exactly and confirming this is the actual mechanism, not a
// coincidental fix. Restoring it brought clientWidth back to exactly
// equal scrollWidth (320/320) at 320x700, 390x844, 768x900, and desktop,
// with the legend's own horizontal scroll still working (contained: 296
// client vs 710 internal scroll, never leaking into the page).
//
// This file asserts the static CSS facts a plain-Node test can check
// deterministically; the live-browser measurements above are the actual
// end-to-end proof and are not reproduced by a DOM-less test here.
//
// Run with:
//   node scripts/test-p1-viewport-overflow.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

let failures = 0;
function check(label, cond) {
  if (cond) { console.log(`  ok   ${label}`); }
  else { console.log(`  FAIL ${label}`); failures++; }
}
function section(name) { console.log(`\n${name}`); }

const styles = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');
const launch = fs.readFileSync(path.join(root, 'public/launch.js'), 'utf8');

section('the mobile .grid track has a real minimum (minmax(0,...)), not the implicit auto minimum of a bare 1fr');
{
  check('the exact regression pattern is gone: @media(max-width:800px){.grid{grid-template-columns:1fr}}', !/@media\(max-width:800px\)\{\.grid\{grid-template-columns:1fr\}\}/.test(styles));
  check('the fixed form is present: minmax(0,1fr) on the mobile .grid track', /@media\(max-width:800px\)\{\.grid\{grid-template-columns:minmax\(0,1fr\)\}\}/.test(styles));
  check('the desktop two-column .grid track already had this same protection (unchanged, still correct)', /\.grid\{display:grid;grid-template-columns:minmax\(300px,\.86fr\) minmax\(0,1\.44fr\)/.test(styles));
}

section('defense-in-depth: .card and .source-legend can shrink within their own grid/flex parent, not just the one ancestor track');
{
  check('.card carries min-width:0', /\.card\{[^}]*min-width:0\}/.test(styles));
  check('.source-legend (the confirmed intrinsically-wide, deliberately non-wrapping chip row) carries min-width:0', /\.source-legend\{[^`]*?min-width:0\}/.test(launch));
}

section('the legend\'s own intentional horizontal scroll on mobile is preserved (this is not "hiding overflow" -- it is a deliberately contained, scrollable component, same pattern as .nav/.tabs elsewhere in this codebase)');
{
  check('mobile still switches the legend to a contained horizontal scroller (overflow-x:auto, flex-wrap:nowrap)', /\.source-legend\{overflow-x:auto;flex-wrap:nowrap/.test(launch));
  check('chips inside it stay non-shrinking so they read as a scrollable strip, not squashed text', /\.source-chip\{flex:0 0 auto\}/.test(launch));
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
