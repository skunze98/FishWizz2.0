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
 * Supabase's dashboard -- see the .env.example note next to the site key
 * this file does use.
 */

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

let widgetId = null;
let token = null;
let scriptReady = null;

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

// Fire-and-forget from the boot IIFE, well before any sign-in attempt is
// possible (a human has to type first) -- so there is no meaningful "not
// ready yet" window worth blocking boot for.
export async function initTurnstile() {
  if (!SITE_KEY) return;
  const host = document.getElementById('turnstileWidget');
  if (!host) return;
  try {
    await loadScript();
    widgetId = window.turnstile.render(host, {
      sitekey: SITE_KEY,
      callback: t => { token = t; },
      'expired-callback': () => { token = null; },
      'error-callback': () => { token = null; },
    });
  } catch (e) {
    // Turnstile being unreachable (ad blocker, offline) should degrade to
    // "no captcha token sent", not break sign-in -- Supabase's own rate
    // limits are still in place either way.
    console.error('FishWizz: Turnstile widget failed to load', e);
  }
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
