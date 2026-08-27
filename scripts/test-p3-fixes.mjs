#!/usr/bin/env node
// Regression tests for the QA-tracker P3 commands (see DEPLOYMENT.md):
//   P3-14: filters expose selected state (aria-pressed)
// The other P3 fixes in this batch (P3-15's CSS containing-block/height
// bugs, P3-16's copy/data corrections) were verified live -- against a real
// running dev server via the browser preview tool, and against the live
// Supabase database via `supabase db query --linked` -- rather than with a
// synthetic DOM stub here; see DEPLOYMENT.md for the measured before/after
// values. This file covers the one piece that's cleanly unit-testable the
// same way the rest of this repo's test scripts are.
// Run with: node scripts/test-p3-fixes.mjs
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

let failures = 0;
function check(label, cond) {
  if (cond) { console.log(`  ok   ${label}`); }
  else { console.log(`  FAIL ${label}`); failures++; }
}
function section(name) { console.log(`\n${name}`); }

function stubBtn(text, active) {
  return {
    textContent: text, attrs: {}, className: active ? 'active' : '',
    classList: { contains: (c) => c === 'active' && active, add() {}, remove() {}, toggle(c, on) { active = on; } },
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
    onclick: null,
  };
}

{
  const buttons = [stubBtn('All', true), stubBtn('Knots', false), stubBtn('Rigs', false)];
  buttons.forEach(b => b.dataset = { howFilter: b.textContent.toLowerCase() });
  const fields = {
    howToSearch: { addEventListener() {} },
    howToList: { innerHTML: '' }, howToCount: { textContent: '' },
    howToStyles: null,
  };
  globalThis.document = {
    readyState: 'complete',
    getElementById: (id) => fields[id] || null,
    createElement: () => ({ textContent: '', appendChild() {} }),
    head: { appendChild() {} },
    querySelectorAll: (sel) => (sel === '[data-how-filter]' ? buttons : []),
    addEventListener() {},
  };
  globalThis.window = globalThis;

  await import(pathToFileURL(path.join(root, 'public/how-to.js')));
  // boot() is scheduled via setTimeout(boot,300) since readyState is
  // 'complete' in this stub -- wait it out before asserting.
  await new Promise(r => setTimeout(r, 400));

  section('P3-14: How-To filters expose selected state via aria-pressed');
  check('the initially-active filter starts aria-pressed=true', buttons[0].attrs['aria-pressed'] === 'true');
  check('the initially-inactive filters start aria-pressed=false', buttons[1].attrs['aria-pressed'] === 'false' && buttons[2].attrs['aria-pressed'] === 'false');

  buttons[1].onclick();
  check('clicking a filter flips it to aria-pressed=true', buttons[1].attrs['aria-pressed'] === 'true');
  check('the previously-active filter flips to aria-pressed=false', buttons[0].attrs['aria-pressed'] === 'false');
  check('only one filter is pressed at a time', [buttons[0], buttons[1], buttons[2]].filter(b => b.attrs['aria-pressed'] === 'true').length === 1);
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
