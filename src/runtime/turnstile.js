/**
 * Cloudflare Turnstile wiring for the email/password sign-in and sign-up
 * forms (DEPLOYMENT.md steps 5 and 2d).
 *
 * Inert with no site key configured: loads no script, renders no widget, and
 * sends no captchaToken -- so this ships safely ahead of the dashboard side
 * of the work. Supabase only checks captchaToken when Attack Protection is
 * turned on in the dashboard, so `undefined` there today is a no-op, not a
 * rejected request.
 *
 * The Turnstile SECRET never touches this codebase. It's the one half of the
 * pair that actually verifies a token, and it's pasted directly into
 * Supabase's dashboard (Authentication -> Attack Protection) -- see the
 * .env.example note next to the site key this file does use. There is no
 * Cloudflare Worker in this deployment (wrangler.toml has no `main` --
 * everything is served as static assets) and no server-side code in this
 * repo validates the token at all; Supabase's own auth server calls
 * Cloudflare's siteverify endpoint internally once Attack Protection is on.
 *
 * Live-production diagnosis (2026-08-28): index.html's sign-in form showed
 * NO widget at all and Supabase rejected every attempt with "captcha
 * protection: request disallowed (no captcha_token found)" -- Attack
 * Protection was correctly enabled, but the deployed JS bundle contained
 * ZERO Turnstile code (confirmed: the literal challenges.cloudflare.com
 * script URL string did not appear anywhere in the live minified bundle).
 * Root cause: `SITE_KEY` below is `undefined` when VITE_TURNSTILE_SITE_KEY
 * is not set at BUILD time, which makes the `if (!SITE_KEY) return` guard
 * unconditional -- esbuild's minifier then dead-code-eliminates the entire
 * rest of initTurnstile() (the script tag, the sitekey string, everything),
 * not just skip it at runtime. DEPLOYMENT.md's own "confirmed live
 * end-to-end, 2026-08-25" entry was for a DIFFERENT hostname
 * (fishwizz-e7d.pages.dev, a Cloudflare Pages project) -- the app has since
 * moved to fishwizz2-0.skylerhunze98.workers.dev (Workers Static Assets,
 * wrangler.toml). Two separate, dashboard-only configuration values need
 * reconciling for the NEW hostname, neither fixable from this codebase:
 *   1. VITE_TURNSTILE_SITE_KEY must be set as a build environment variable
 *      on whatever now builds and deploys fishwizz2-0 (Cloudflare
 *      Workers/Pages Build project settings) -- without this, everything
 *      below is unreachable code by construction, not just untriggered.
 *   2. The Turnstile site key's allowed-hostnames list (Cloudflare
 *      dashboard -> Turnstile -> this site key -> Settings -> Domains)
 *      needs fishwizz2-0.skylerhunze98.workers.dev added -- it was almost
 *      certainly only ever registered for the old pages.dev hostname.
 *      Turnstile's own error code for this specific case is 110200
 *      ("Invalid domain"); errorLabel() below surfaces that distinctly if
 *      it recurs after (1) is fixed, so it's diagnosable from the console
 *      instead of a second silent dead end.
 */

// Optional chaining on `.env` (not just the key) so this module is safely
// importable outside a Vite build too (plain Node, e.g. this repo's own
// test suite) -- import.meta.env doesn't exist there at all, only under
// Vite. No effect on the real build: Vite always provides a real object.
const SITE_KEY = import.meta.env?.VITE_TURNSTILE_SITE_KEY;

let widgetId = null;
let token = null;
let scriptReady = null;
// Distinguishes "never attempted" from "attempted and failed" so a caller
// (the pre-flight check in index.js, or a manual retry) can tell whether
// there is anything worth retrying versus nothing was ever configured.
let lastError = null;

// Best-effort labels for the Turnstile client-side error codes worth a
// specific, actionable message. Not exhaustive -- the raw code is always
// logged alongside this, so an unmapped code is still fully diagnosable,
// just without the friendly gloss. Cloudflare documents these codes at
// https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/
const ERROR_LABELS = {
  '110200': 'hostname not allowed for this Turnstile site key',
  '110100': 'invalid site key',
  '110110': 'site key is disabled',
  '600010': 'challenge expired before it was submitted',
};
export function errorLabel(code) {
  const c = String(code ?? '');
  if (ERROR_LABELS[c]) return ERROR_LABELS[c];
  if (c.startsWith('110')) return 'configuration error (site key / domain)';
  if (c.startsWith('300') || c.startsWith('600')) return 'network or timeout error';
  return 'unrecognized error code';
}

// One shared, safe diagnostic channel: console (always) plus a DOM event any
// diagnostics collector can subscribe to later without this file knowing
// about it. Never includes the token or anything from the secret half --
// only the event name and small, non-identifying fields (an error code, a
// boolean, a hostname that is already public in the URL bar).
function logDiag(event, detail = {}) {
  console.warn('FishWizz: turnstile', event, detail);
  try {
    document.dispatchEvent(new CustomEvent('atlas:turnstile-diag', { detail: { event, ...detail, at: Date.now() } }));
  } catch (e) { /* CustomEvent unavailable in some non-browser test contexts -- non-fatal */ }
}

function loadScript() {
  if (window.turnstile) return Promise.resolve();
  if (!scriptReady) {
    scriptReady = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      s.async = true;
      s.defer = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Turnstile script failed to load'));
      document.head.appendChild(s);
    });
  }
  return scriptReady;
}

// Shown INSIDE #turnstileWidget itself when verification could not be set
// up at all, so a visitor sees an explanation instead of an empty box with
// nothing next to "Password" -- and a real way to retry instead of being
// stuck for the rest of the tab's life if the failure was transient
// (network hiccup, ad blocker, a slow connection).
export function renderFallback(host, message) {
  host.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'muted tiny fw-turnstile-fallback';
  p.textContent = message;
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'btn ghost';
  retry.textContent = 'Retry verification';
  retry.onclick = () => { renderWidget(host); };
  host.appendChild(p);
  host.appendChild(retry);
}

export async function renderWidget(host) {
  try {
    await loadScript();
    host.innerHTML = ''; // clear any prior fallback message/button before rendering fresh
    widgetId = window.turnstile.render(host, {
      sitekey: SITE_KEY,
      callback: t => { token = t; lastError = null; },
      'expired-callback': () => {
        token = null;
        logDiag('expired', {});
      },
      'error-callback': code => {
        token = null;
        lastError = code ?? 'unknown';
        logDiag('render-error', { code: lastError, label: errorLabel(lastError) });
        renderFallback(host, `Verification could not load (${errorLabel(lastError)}). This is a site configuration issue, not something wrong on your end.`);
      },
    });
    logDiag('rendered', {});
  } catch (e) {
    // Turnstile being unreachable (ad blocker, offline, script blocked) --
    // give a real retry path instead of degrading to "no captcha token
    // sent" and leaving Attack Protection to reject every attempt with no
    // visible explanation on this end.
    lastError = 'script-load-failed';
    logDiag('script-load-failed', { message: e?.message || String(e) });
    renderFallback(host, 'Verification could not load. Check your connection (or ad blocker) and retry.');
  }
}

// Fire-and-forget from the boot IIFE, well before any sign-in attempt is
// possible (a human has to type first) -- so there is no meaningful "not
// ready yet" window worth blocking boot for.
export async function initTurnstile() {
  const host = document.getElementById('turnstileWidget');
  if (!host) return;
  if (!SITE_KEY) {
    // Previously a completely silent no-op -- indistinguishable from "this
    // loaded and is working" from the console. Log once so a missing build
    // env var shows up immediately instead of only being caught by
    // noticing every sign-in fails with a raw backend message.
    logDiag('no-site-key', {});
    return;
  }
  await renderWidget(host);
}

// Whether this build even has Turnstile configured at all -- distinct from
// whether the widget is currently ready/completed. Lets a caller (the
// sign-in/sign-up click handlers) give a specific, correct message instead
// of either silently sending an empty token or wrongly telling someone to
// "complete the checkbox" when there never was one to complete.
export function turnstileState() {
  return { configured: !!SITE_KEY, ready: widgetId != null, hasToken: !!token, lastError };
}

export function captchaToken() {
  return SITE_KEY ? (token || undefined) : undefined;
}

// Each token is single-use; call after every sign-in/sign-up attempt
// regardless of outcome, or the next attempt silently reuses a spent one.
export function resetTurnstile() {
  token = null;
  if (widgetId != null && window.turnstile) window.turnstile.reset(widgetId);
}
