// Server-side error monitoring for edge functions -- the counterpart to
// src/runtime/sentry.js on the client (DEPLOYMENT.md step 8, item 3).
//
// Same no-op-until-configured shape as the client: initSentry() does nothing
// until the SENTRY_DSN function secret is set, so importing this in every
// function ahead of that secret existing is safe -- no network call, no
// behavior change. Once the secret is set, every function's own catch block
// gets real error reporting by adding one line: reportError(e, {function:...}).
//
// Scrubbing mirrors the client file's REDACT_KEYS/JWT_RE: these functions
// handle precise GPS (weather, water profile, nearby-waters) and bearer
// tokens (every function's own auth header), and the privacy policy promises
// neither leaves the app for a third party.
import * as Sentry from "npm:@sentry/deno@8";

let ready = false;

const REDACT_KEYS = new Set([
  "latitude", "longitude", "lat", "lon", "lng",
  "email", "user_email",
  "authorization", "access_token", "refresh_token",
]);

const JWT_RE = /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/;

function redactString(s: unknown): unknown {
  if (typeof s !== "string") return s;
  return JWT_RE.test(s) ? "[redacted]" : s;
}

function redactObject(obj: unknown, seen = new WeakSet<object>()): unknown {
  if (!obj || typeof obj !== "object") return obj;
  if (seen.has(obj as object)) return obj;
  seen.add(obj as object);
  const out: any = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (REDACT_KEYS.has(k.toLowerCase())) { out[k] = "[redacted]"; continue; }
    out[k] = typeof v === "string" ? redactString(v)
      : (v && typeof v === "object") ? redactObject(v, seen)
      : v;
  }
  return out;
}

function scrubEvent(event: any) {
  if (event.user) { const { email, ...rest } = event.user; event.user = rest; }
  if (event.request) {
    if (event.request.headers) event.request.headers = redactObject(event.request.headers);
    if (event.request.data) event.request.data = redactObject(event.request.data);
  }
  if (event.extra) event.extra = redactObject(event.extra);
  if (event.contexts) event.contexts = redactObject(event.contexts);
  return event;
}

function ensureInit(): boolean {
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) return false;
  if (!ready) {
    Sentry.init({
      dsn,
      defaultIntegrations: false,
      tracesSampleRate: 0,
      sendDefaultPii: false,
      beforeSend: (event: any) => scrubEvent(event),
    });
    const region = Deno.env.get("SB_REGION");
    if (region) Sentry.setTag("region", region);
    ready = true;
  }
  return true;
}

// Reports an error to Sentry when SENTRY_DSN is configured; a silent no-op
// otherwise. Never throws -- a monitoring failure must never become a second,
// worse error inside the caller's own catch block.
export function reportError(e: unknown, tags?: Record<string, string>): void {
  try {
    if (!ensureInit()) return;
    if (tags) for (const [k, v] of Object.entries(tags)) Sentry.setTag(k, v);
    Sentry.captureException(e);
  } catch {
    // swallow -- see comment above
  }
}
