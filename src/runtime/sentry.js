/**
 * Client-side error monitoring (DEPLOYMENT.md step 8).
 *
 * Inert with no DSN configured -- Sentry.init() is never called, so nothing
 * loads, nothing connects out, and the CSP needs no change yet either. Once
 * VITE_SENTRY_DSN is set, this also needs the project's ingest origin added
 * to connect-src in public/_headers.template -- that origin is per-Sentry
 * -org, so it can't be predicted and pre-added the way Turnstile's could.
 *
 * captureConsoleIntegration is what makes this pay off immediately: every
 * `console.error('FishWizz: ...', e)` already scattered through public/ --
 * including the 13 that used to swallow their error silently, fixed in the
 * same pass as this file -- becomes a Sentry event with no further wiring.
 *
 * beforeSend/beforeBreadcrumb scrub exactly what DEPLOYMENT.md step 8 calls
 * out: latitude/longitude (this app handles precise GPS; leaking it to a
 * third party would contradict the privacy policy on day one), user email,
 * and the fishwizz.auth session. Scoped to the specific event fields that
 * carry free-form app data (user, request, extra, contexts, breadcrumbs,
 * message) rather than deep-walking the whole event, so Sentry's own
 * required fields (exception, stacktrace, event_id, sdk, ...) are never at
 * risk of being reshaped by a generic recursive scrubber.
 */
import * as Sentry from '@sentry/browser';

const DSN = import.meta.env.VITE_SENTRY_DSN;

const REDACT_KEYS = new Set([
  'latitude', 'longitude', 'lat', 'lon', 'lng',
  'email', 'user_email',
  'authorization', 'access_token', 'refresh_token', 'fishwizz.auth',
]);

// A JWT shape catches the fishwizz.auth session value even if it reaches a
// breadcrumb some other way than the storage key name itself (e.g. inside a
// thrown JSON.parse input).
const JWT_RE = /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/;

function redactString(s) {
  if (typeof s !== 'string') return s;
  if (/fishwizz\.auth/i.test(s) || JWT_RE.test(s)) return '[redacted]';
  return s;
}

function redactObject(obj, seen = new WeakSet()) {
  if (!obj || typeof obj !== 'object') return obj;
  if (seen.has(obj)) return obj;
  seen.add(obj);
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (REDACT_KEYS.has(k.toLowerCase())) { out[k] = '[redacted]'; continue; }
    out[k] = typeof v === 'string' ? redactString(v)
      : (v && typeof v === 'object') ? redactObject(v, seen)
      : v;
  }
  return out;
}

function scrubEvent(event) {
  if (event.user) { const { email, ...rest } = event.user; event.user = rest; }
  if (event.request) {
    if (event.request.url) event.request.url = redactString(event.request.url);
    if (event.request.query_string) event.request.query_string = redactString(String(event.request.query_string));
    if (event.request.data) event.request.data = redactObject(event.request.data);
  }
  if (event.extra) event.extra = redactObject(event.extra);
  if (event.contexts) event.contexts = redactObject(event.contexts);
  if (event.message) event.message = redactString(event.message);
  return event;
}

export function initSentry() {
  if (!DSN) return;
  try {
    Sentry.init({
      dsn: DSN,
      integrations: [Sentry.captureConsoleIntegration({ levels: ['error', 'warn'] })],
      tracesSampleRate: 0,     // errors only -- no performance/session tracing
      sendDefaultPii: false,   // no IP, no cookies
      beforeSend: event => scrubEvent(event),
      beforeBreadcrumb: breadcrumb => {
        if (breadcrumb.data) breadcrumb.data = redactObject(breadcrumb.data);
        if (breadcrumb.message) breadcrumb.message = redactString(breadcrumb.message);
        return breadcrumb;
      },
    });
  } catch (e) {
    // Monitoring must never be why the app fails to boot.
    console.error('FishWizz: Sentry init failed', e);
  }
}
