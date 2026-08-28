#!/usr/bin/env node
// Regression test for P2 "Legacy shell FOUC on startup" (independent
// authenticated production QA, NO-GO on release 6ae72c096be9, 2026-08-28):
// "A fresh tab briefly shows 'Arsenal'/reduced species list/'Getting your
// fishing ready…' before rewriting to current UI ~5s later." Explicitly
// NOT a caching/deployment issue this time -- "The HTML release and hashed
// asset identifiers were correct."
//
// Root cause, confirmed by reading the actual shipped modules: two pieces
// of PRIMARY-NAV/GLOBAL UI chrome were only ever correct after
// fishwizz-shell-v2.js and species-mn-wi.js -- both loaded dynamically,
// late in the LEGACY chain -- finished running and rewrote them:
//   1. The nav button for the Gear page was hardcoded "Arsenal" in
//      index.html; fishwizz-shell-v2.js's topLabels() relabeled it to
//      "Gear" at boot.
//   2. #mTarget's species dropdown was hardcoded to 7 generic options in
//      index.html; species-mn-wi.js's optionize() replaced it with a full
//      116-species, two-optgroup catalog at boot.
// Neither of these depends on auth/session/network state -- they are
// static, universal UI that is either right or (briefly, visibly) wrong
// for every single visitor, guest or signed-in, on every fresh load. The
// fix bakes the CURRENT values directly into index.html so first paint is
// already correct; the JS-side functions stay as idempotent defense-in-
// depth (for an old cached shell or a future revert), not the only source
// of truth.
//
// This test guards against the fix silently drifting apart from its own
// source of truth: it re-derives species-mn-wi.js's exact species catalog
// from that file's own arrays (not a hand-copied duplicate) and asserts
// index.html's static #mTarget markup is byte-for-byte the same grouping,
// so a future edit to the species list that forgets to update index.html
// fails this test instead of silently reintroducing the flash.
//
// Run with:
//   node scripts/test-p2-shell-fouc.mjs
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

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const speciesSrc = fs.readFileSync(path.join(root, 'public/species-mn-wi.js'), 'utf8');

section('primary nav: the Gear button already reads "Gear" from first paint, not the stale "Arsenal"');
{
  check('no static "Arsenal" text/label remains on the nav button (data-page="arsenal")', !/data-page="arsenal"[^>]*>Arsenal</.test(html) && !/aria-label="Arsenal"/.test(html));
  check('the nav button for data-page="arsenal" reads "Gear"', /<button data-page="arsenal" aria-label="Gear">Gear<\/button>/.test(html));
}

section('#mTarget: the static markup already carries the full species catalog, not the old 7-option placeholder');
{
  check('the old reduced placeholder list is gone (Bass/Panfish/Crappie as bare top-level options)', !/<select id="mTarget"[^>]*><option>Bass<\/option>/.test(html));
  check('#mTarget is marked data-species-catalog="1" so species-mn-wi.js\'s optionize() treats it as already done, not a second rebuild on every load', /<select id="mTarget" data-species-catalog="1">/.test(html));
  check('#mTarget uses the same two-optgroup structure optionize() builds ("Popular targets" + "More MN + WI freshwater species")', /<optgroup label="Popular targets">/.test(html) && /<optgroup label="More MN \+ WI freshwater species">/.test(html));
}

section('drift guard: index.html\'s baked-in species list is derived from, and stays byte-identical to, species-mn-wi.js\'s own arrays');
{
  // Re-derive the exact same computation optionize() performs, from the
  // real source arrays in the real file -- never a second hand-maintained
  // copy of the species list that could itself drift.
  const speciesMatch = speciesSrc.match(/const species=\[([\s\S]*?)\];/);
  const commonMatch = speciesSrc.match(/const common=\[([\s\S]*?)\];/);
  check('could locate the species array in species-mn-wi.js', !!speciesMatch);
  check('could locate the common array in species-mn-wi.js', !!commonMatch);
  if (speciesMatch && commonMatch) {
    // eslint-disable-next-line no-new-func
    const species = new Function(`return [${speciesMatch[1]}];`)();
    const common = new Function(`return [${commonMatch[1]}];`)();
    const atlas = [...new Set(species)].sort((a, b) => a.localeCompare(b));
    const extra = atlas.filter(x => !common.includes(x));
    const expectedHtml = `<optgroup label="Popular targets">${common.map(x => `<option>${x}</option>`).join('')}</optgroup>` +
      `<optgroup label="More MN + WI freshwater species">${extra.map(x => `<option>${x}</option>`).join('')}</optgroup>`;
    const selectMatch = html.match(/<select id="mTarget" data-species-catalog="1">([\s\S]*?)<\/select>/);
    check('the #mTarget select block could be located in index.html', !!selectMatch);
    if (selectMatch) {
      check(`index.html's baked-in #mTarget markup exactly matches what optionize() would compute today (${atlas.length} species, ${common.length} popular + ${extra.length} more)`, selectMatch[1] === expectedHtml);
    }
  }
}

section('species-mn-wi.js and fishwizz-shell-v2.js both document the sync requirement so a future edit does not silently reintroduce the flash');
{
  check('optionize() explains why its guard now matters and what to keep in sync', /index\.html's own #mTarget markup must be regenerated/.test(speciesSrc));
  const shellSrc = fs.readFileSync(path.join(root, 'public/fishwizz-shell-v2.js'), 'utf8');
  check('topLabels() explains the same for the nav label', /index\.html's own nav markup must be updated/.test(shellSrc));
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
