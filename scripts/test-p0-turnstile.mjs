#!/usr/bin/env node
// Regression test for "Turnstile CAPTCHA is not working, blocking login on
// production" (fishwizz2-0.skylerhunze98.workers.dev, 2026-08-28).
//
// Live diagnosis: the sign-in form showed NO Turnstile widget at all, and
// every attempt was rejected by Supabase with the raw backend string
// "captcha protection: request disallowed (no captcha_token found)".
// Confirmed live: the deployed JS bundle contained ZERO occurrences of the
// literal "challenges.cloudflare.com/turnstile" script URL string -- not a
// rendering failure, the code path was entirely absent. Root cause:
// VITE_TURNSTILE_SITE_KEY is not set in the Cloudflare build environment
// that actually builds/deploys this Worker (a Pages/Build Git integration,
// separate from this repo's own .env), so `SITE_KEY` was `undefined` at
// build time -- which made turnstile.js's `if (!SITE_KEY) return` guard
// unconditional, and esbuild's minifier dead-code-eliminated everything
// after it. DEPLOYMENT.md's own "confirmed live end-to-end, 2026-08-25"
// entry was for a DIFFERENT hostname (fishwizz-e7d.pages.dev) -- the site
// key's own allowed-hostnames list (a Cloudflare Turnstile dashboard
// setting, not code) almost certainly still only lists that old domain,
// not fishwizz2-0.skylerhunze98.workers.dev.
//
// Neither of those two facts is fixable from this repository -- this test
// covers what IS: the module must be safely importable without a Vite
// build (previously would have thrown, since import.meta.env does not
// exist under plain Node), a missing site key must be loud (a real
// diagnostic event) instead of a silent no-op, a widget/script failure
// must render a real retry affordance instead of leaving an empty box,
// and a raw "captcha" backend error must produce an actionable message
// instead of showing Supabase's internal string verbatim.
//
// Run with:
//   node scripts/test-p0-turnstile.mjs
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

function stubEl(over = {}) {
  const el = {
    innerHTML: '', textContent: '', className: '', type: '',
    appendChild(child) { (this.children ||= []).push(child); },
    children: [],
    ...over,
  };
  return el;
}

const diagEvents = [];
globalThis.document = {
  head: stubEl(),
  createElement: (tag) => stubEl({ tag }),
  getElementById: (id) => (id === 'turnstileWidget' ? globalThis.__hostStub : null),
  dispatchEvent: (evt) => { diagEvents.push(evt.detail); },
};
globalThis.window = globalThis;
globalThis.CustomEvent = class { constructor(type, opts) { this.type = type; this.detail = opts?.detail; } };

section('module import: safe outside a Vite build (import.meta.env does not exist under plain Node)');
{
  let threw = false;
  let mod;
  try {
    mod = await import(pathToFileURL(path.join(root, 'src/runtime/turnstile.js')));
  } catch (e) {
    threw = true;
    console.log('  import threw:', e.message);
  }
  check('importing the real module under plain Node did not throw', !threw);
  globalThis.__turnstileMod = mod;
}

const { initTurnstile, captchaToken, resetTurnstile, turnstileState, errorLabel, renderFallback, renderWidget } = globalThis.__turnstileMod;

section('no site key configured (the exact live-production state found): loud, not silent');
{
  diagEvents.length = 0;
  globalThis.__hostStub = stubEl({ id: 'turnstileWidget' });
  await initTurnstile();
  check('turnstileState() correctly reports not configured', turnstileState().configured === false);
  check('captchaToken() returns undefined (Supabase treats this as "not in use", not a rejected request)', captchaToken() === undefined);
  check('a real, findable diagnostic event was dispatched instead of a silent no-op', diagEvents.some(d => d.event === 'no-site-key'));
  check('nothing was written into the widget host (no misleading empty-but-touched state)', globalThis.__hostStub.innerHTML === '');
}

section('errorLabel(): the documented hostname-mismatch code gets a specific, correct label (the live suspect once the site key is restored)');
{
  check('110200 (Cloudflare\'s own documented "Invalid domain" code) is labeled as a hostname problem', /hostname/i.test(errorLabel('110200')));
  check('an unmapped code still returns a usable string, never throws or returns undefined', typeof errorLabel('999999') === 'string' && errorLabel('999999').length > 0);
  check('a missing/undefined code is handled without throwing', typeof errorLabel(undefined) === 'string');
}

section('renderFallback(): a failed widget gets a real explanation and a working retry control, not an empty box');
{
  const host = stubEl({ id: 'turnstileWidget' });
  renderFallback(host, 'Verification could not load (test reason).');
  check('the host is not left empty', host.innerHTML !== '' || host.children.length > 0);
  const retryBtn = host.children.find(c => c.textContent === 'Retry verification');
  check('a real retry button was added', !!retryBtn);
  check('the retry button has a real click handler wired (not a dead button)', typeof retryBtn.onclick === 'function');
  const message = host.children.find(c => c.textContent && c.textContent.includes('test reason'));
  check('the actual failure reason is shown to the visitor, not hidden', !!message);
}

section('renderWidget(): a script-load failure (network/ad-blocker) falls back visibly instead of leaving the box empty for the rest of the session');
{
  globalThis.window.turnstile = undefined; // force loadScript() to actually try creating a <script>
  const host = stubEl({ id: 'turnstileWidget' });
  const originalAppendChild = globalThis.document.head.appendChild.bind(globalThis.document.head);
  globalThis.document.head.appendChild = (s) => { originalAppendChild(s); if (s.onerror) s.onerror(); };
  await renderWidget(host);
  check('the host shows a retry affordance after a script-load failure, not an empty box', host.children.some(c => c.textContent === 'Retry verification'));
  globalThis.document.head.appendChild = originalAppendChild;
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
