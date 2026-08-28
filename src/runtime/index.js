/**
 * FishWizz runtime shim.
 *
 * Runs before every legacy script, publishes the globals they expect, then
 * injects them in their original order. The 57 files in public/ are not
 * modified: they keep reading bare `session`, calling bare `api()`, and
 * listening for `atlas:account-changed` exactly as before.
 *
 * Why a boot loader instead of leaving <script> tags in index.html: a
 * type="module" script is always deferred, so it can never run before a classic
 * <script src>. Injecting the chain from here is the only way to get
 * "shim first, legacy second". The async=false + 60ms gap mirrors pwa.js's
 * lazy loader, which was tuned for iPhone startup stability (commits c1e8a7c,
 * 3f03ac8) -- worth matching rather than rediscovering.
 */
import { initSentry } from './sentry.js';
import { supabase, SUPABASE_URL, SUPABASE_ANON } from './supabase.js';
import { makeApi } from './api.js';
import { initTurnstile, captchaToken, resetTurnstile, turnstileState } from './turnstile.js';
import { createAuthState } from './auth-state.js';

// First real line of the module: monitoring should be recording before
// anything else here has a chance to throw. No-ops with no VITE_SENTRY_DSN.
initSentry();

// Release identifier for browser diagnostics (release-blocking
// stabilization, 2026-08-28 follow-up: "Add a non-sensitive release
// identifier to: the HTML shell, the service worker, a response header,
// and the browser diagnostics. These identifiers must match."). Read from
// the <meta> tag scripts/postbuild.mjs injects into index.html -- not a
// second, independently-computed value -- so this can never disagree with
// what the meta tag, sw.js's own CACHE name, and the X-FishWizz-Release
// response header all already say. `undefined` locally (no build step has
// run) or on a build predating this change; never fabricated.
window.__FISHWIZZ_BUILD__ = document.querySelector('meta[name="fishwizz-build"]')?.content;

// Leaflet is bundled rather than loaded from unpkg. That removes the last
// third-party script origin -- so script-src can drop to 'self' -- and with it
// the risk that a compromised or unavailable CDN takes the map down. map.js and
// nine other modules expect the global `L`, so expose it before they load.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
window.L = L;

// Eager load order from index.html. Order is semantics, not style: patch.js
// overrides window.coach, water-search.js overrides window.searchWater,
// mission-v3.js overrides again.
const LEGACY = [
  '/app.js',
  // P0-1 reopened (staging QA, 2026-08-27): field-guard.js used to load
  // second-to-last, which was fine for catch-pro.js/mission-v3.js (they only
  // ever call window.FishWizzGuard at user-interaction time, long after the
  // whole LEGACY chain has finished) but was a real, live bug for
  // guest-draft.js below: its restore() runs synchronously at BOOT, so on
  // every single page load window.FishWizzGuard did not exist yet when it
  // needed it, silently skipping the guard entirely. Moved right after
  // app.js -- it has no dependency on anything else in this list -- so
  // every consumer, boot-time or interaction-time, can rely on it.
  '/field-guard.js',
  // P0 (staging QA, 2026-08-27): the one authoritative length/weight
  // validation for catches -- shared by catch-pro.js (creation),
  // catch-history-pro.js (editing and personal-best ranking), and
  // personal-hub.js (personal-best display). Early and eager for the same
  // reason as field-guard.js just above: every consumer needs it available
  // the moment a user can possibly interact with a measurement field or
  // catch list, and none of them should have to guard against it not having
  // loaded yet.
  '/measurement-guard.js',
  // P2 ("enforce recommendation taxonomy compatibility" -- staging QA,
  // 2026-08-27): the one authoritative tackle-category classification,
  // shared by mission-inventory-fit.js and mentor-pro.js so a hook or
  // sinker can never be labeled "Owned lure" by one of them while the other
  // gets it right -- see that file's own header for the full root cause.
  '/tackle-taxonomy.js',
  // P2 ("provide traceable recommendation evidence" -- staging QA,
  // 2026-08-27): the one shared evidence-chip builder, used by patch.js
  // (water intelligence: gauges/species/reports/personal history) and
  // mission-v3.js (the Mission card's own rules-engine guidance) so a claim
  // is never labeled LIVE/OFFICIAL without an actual record backing it --
  // see that file's own header for the full root cause.
  '/evidence-provenance.js',
  // P1 (staging QA, 2026-08-27): the one authoritative angler-profile fetch,
  // loaded here in the always-eager LEGACY chain rather than only inside
  // pwa.js's lazy `account` page group -- see that file's own header for why
  // a profile fetch that only ever happened on the Account page is what
  // caused a saved nickname to disappear from the Mission-page greeting
  // after a refresh that landed back on Mission. Placed before today.js
  // (loaded lazily, later, via pwa.js's `mission` group) so
  // window.FishWizzProfileState already exists by the time today.js's own
  // snapshot() calls it.
  '/profile-state.js',
  // P1-5 reopened: the one authoritative gear (combos/rods/reels/lures)
  // fetch + cache, replacing three separate ones that used to each hold
  // their own answer to "how much gear does this account have" and
  // disagree. Eager and early for the same reason as field-guard.js above:
  // arsenal-safe.js, mission-inventory-fit.js, and today.js all call it, at
  // both boot time (today.js) and interaction time, and none of them should
  // have to worry about whether it has loaded yet.
  '/gear-state.js',
  '/water-search.js',
  '/patch.js',
  '/mission-inventory-fit.js',
  '/mission-v3.js',
  '/map.js',
  // P0-2: after mission-v3.js/map.js so the events and globals it listens
  // for (atlas:fishing-position, atlas:water-selected, atlas:mission-built,
  // window.lastMission) already exist -- though as an event listener rather
  // than a direct call site, exact ordering only affects which very first
  // synthetic re-dispatch it can observe, not correctness.
  '/location-state.js',
  // P2-10: static Mission/Catch fields exist in index.html's initial markup
  // (unlike mission-v3.js's own extra condition fields), so this can restore
  // a guest draft into them eagerly, same as location-state.js above.
  '/guest-draft.js',
  '/launch.js',
  '/pwa.js',
  '/fishwizz-shell-v2.js',
  '/production-hardening.js',
  '/premium-product.js',
  // TEMPORARY -- P0-1 staging diagnostic. Loaded last so window.FishWizzGuard
  // (field-guard.js, now at the top) already exists to wrap. Remove this
  // line and public/diag-identity-p0.js together once P0-1 is resolved --
  // see that file's own header for the full removal note.
  '/diag-identity-p0.js',
];

let _session = null;
let _ready = false;
const _queue = [];
const afterLegacy = fn => (_ready ? fn() : _queue.push(fn));

// P0 (staging QA, 2026-08-27): "signed-in content rendered together with
// WELCOME BACK / Log In / Create Account; navigation broken until refresh."
// Root cause -- confirmed by tracing the actual sequence, not guessed: the
// sign-in click handler declared success and navigated to Mission the
// instant supabase.auth.signInWithPassword()'s own promise resolved, without
// waiting for the SEPARATE onAuthStateChange callback that is the only thing
// which actually updates `_session` (Supabase JS does not guarantee that
// callback fires before signInWithPassword()'s promise settles in the
// caller -- it's a well-documented, real gap, not a timing coincidence).
// Every other session-dependent read in the app (fishwizz-shell-v2.js's
// WELCOME BACK banner, missionGuard's sign-in check, etc) reads `session`
// live, so during that gap they still saw signed-out state on a page that
// had already navigated as if signed in.
//
// applySession() is now the ONE place `_session` is ever written, called
// both by onAuthStateChange (the authoritative source) and directly by the
// sign-in/sign-up handlers below with the session Supabase's own response
// already contains -- so the UI is atomically correct the instant the
// click handler's own await resolves, not on a best-effort race with a
// second async callback. It's idempotent: applying the same user id twice
// (the click handler's direct call, then onAuthStateChange's own later
// firing for the same sign-in) is a no-op the second time, not a double
// clear-and-dispatch.
//
// The actual decision logic (is this a real account change, what generation
// does it get, was this the very first session established) lives in
// auth-state.js, not here -- pulled out into its own dependency-free module
// specifically so it has a real, direct Node unit test
// (scripts/test-auth-state.mjs) instead of only ever being exercised through
// this file's Leaflet/CSS imports, which plain Node can't load at all. This
// wrapper only adds the DOM/legacy-chain side effects (syncAuthUi,
// atlas:account-changed, clearing the previous account's state) that are
// specific to running inside the actual app.
//
// generation increments only on a REAL account change (never on the very
// first session establishment, and never on a same-account re-application)
// and is exposed via window.fishwizzAuth.generation() so any in-flight
// request can be tagged and checked against it before being applied -- a
// stale Account A response arriving after Account B is active carries an
// old generation and is discarded, per the P0 instruction to cancel/ignore
// stale responses by account id + generation.
const authState = createAuthState({
  onChange(s, detail) {
    afterLegacy(() => {
      syncAuthUi(s);
      if (detail.previous_user_id) window.atlasClearPersonalState?.();
      // Same name and same detail shape account-isolation.js's own version
      // already used -- 13+ modules listen for this and are not being
      // changed. `initial: true` on the very first session establishment
      // (a fresh page load restoring an existing session, or a first-ever
      // sign-in with nothing to switch away from) lets a listener that only
      // cares about REAL account switches -- as opposed to "a session now
      // exists, go load" -- tell the two apart explicitly, rather than
      // inferring it from previous_user_id being null.
      document.dispatchEvent(new CustomEvent('atlas:account-changed', { detail }));
    });
  },
  onSameAccount(s) {
    afterLegacy(() => syncAuthUi(s));
  },
});

function applySession(s) {
  const result = authState.apply(s);
  _session = s;
  return result;
}

// --- globals the legacy scripts expect --------------------------------------

window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON = SUPABASE_ANON;
window.KEY = SUPABASE_ANON;

// app.js used to declare these with `let` at classic-script top level, which
// puts them in the global DECLARATIVE record -- not on window. Meanwhile 13
// files write window.selectedWater. They were two different variables, so
// app.js's feedback() never saw the water the map had selected. As window
// properties there is now exactly one of each.
window.combos = [];
window.lures = [];
window.selectedWater = null;
window.lastMission = null;

// window.catches was never declared anywhere, so it resolved to the
// <section id="catches"> element -- browsers expose element ids as window
// properties. Eight modules read it as an array of catches; angler-insights.js
// threw "c.map is not a function" on every render and the rest silently showed
// nothing. Declaring it as a real array shadows the element.
window.catches = [];

Object.defineProperty(window, 'session', {
  configurable: true,
  get() { return _session; },
  // account-polish.js's deleteAccount() assigns `session=null` directly. That
  // now lands here and performs a real sign-out instead of desyncing the UI.
  // Also applied atomically (not just requested) so the UI reflects
  // signed-out state immediately, the same guarantee sign-in gets below,
  // rather than waiting on Supabase's own signOut() round trip and the
  // onAuthStateChange callback it eventually triggers.
  set(v) { if (v == null && _session) { applySession(null); supabase.auth.signOut().catch(() => {}); } },
});

window.api = makeApi(supabase, () => _session);

// Resolves once the initial session check has finished (success or failure) --
// i.e. once `window.session` is authoritative rather than just its `null`
// initial value. `window.session === null` is otherwise ambiguous between
// "not checked yet" and "confirmed signed out", which is exactly what forced
// arsenal-safe.js and inventory-pro.js to poll for a session that would never
// arrive, showing "Loading… waiting for your account session" to every signed
// -out visitor of Gear/Tackle for a full 5 seconds. Await this instead of
// polling `session?.user?.id` truthiness.
let resolveAuthReady;
const authReady = new Promise(resolve => { resolveAuthReady = resolve; });

window.fishwizzAuth = {
  client: supabase,
  ready: authReady,
  // The current account-change generation. Any long-running fetch that
  // cares about staleness should read this before starting and compare
  // again before applying its result -- see gear-state.js's own use of this
  // for the pattern (P0 instruction 5: cancel/ignore a stale response by
  // account id + generation).
  generation: () => authState.generation,
  token: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
  // captchaToken() is undefined until both halves of Turnstile exist (a site
  // key here, Attack Protection turned on in Supabase) -- Supabase ignores
  // the field entirely until then, so this is safe ahead of that.
  signIn: (email, password) =>
    supabase.auth.signInWithPassword({ email, password, options: { captchaToken: captchaToken() } }),
  signUp: (email, password) =>
    supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: location.origin + '/', captchaToken: captchaToken() },
    }),
  signInWithGoogle: () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + '/', queryParams: { prompt: 'select_account' } },
    }),
  signOut: () => supabase.auth.signOut(),
};

// --- one-time migration off the hand-rolled session -------------------------

async function importLegacySession() {
  try {
    const raw = localStorage.getItem('atlas_session');
    if (!raw) return;
    localStorage.removeItem('atlas_session');
    const s = JSON.parse(raw);
    if (s?.access_token && s?.refresh_token && !(await supabase.auth.getSession()).data.session) {
      await supabase.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
    }
  } catch (e) {
    console.warn('FishWizz: could not migrate the previous session', e);
  }
}

// Device-independent email confirmation. With flowType: 'pkce' (see
// supabase.js), the normal ?code= callback only works in the SAME browser
// that started the signup, because the PKCE code verifier lives in that
// browser's storage -- so a confirmation link opened on a phone after
// signing up on a laptop fails outright. Supabase's token_hash link format
// sidesteps PKCE entirely: verifyOtp() exchanges it for a session directly,
// from whatever browser opens it. This only fires once the Supabase "Confirm
// signup" email template (and invite/magic-link/recovery, if used) is
// changed to `{{ .SiteURL }}/?token_hash={{ .TokenHash }}&type=email` --
// undone, ?token_hash is just never present and this is a no-op.
let pendingAuthMessage = null;

async function completeEmailConfirmation() {
  const q = new URLSearchParams(location.search);
  const token_hash = q.get('token_hash');
  const type = q.get('type');
  if (!token_hash || !type) return;

  // Strip the params before the exchange, not after: a token_hash is single
  // -use, so if the tab is reloaded mid-flight (slow network, impatient
  // refresh) it must not resubmit the same one.
  history.replaceState({}, '', location.pathname);

  const { data, error } = await supabase.auth.verifyOtp({ token_hash, type });
  if (error) {
    console.error('FishWizz: email confirmation link failed', error);
    pendingAuthMessage = {
      kind: 'err',
      title: 'This confirmation link no longer works',
      body: 'It may have expired or already been used. Try signing in -- if that fails, create the account again to get a fresh link.',
    };
    return;
  }
  if (data.session) {
    pendingAuthMessage = { kind: 'ok', title: 'Email confirmed', body: 'Your FishWizz account is ready.' };
  }
}

// --- UI sync ----------------------------------------------------------------

// app.js's save() minus the session and localStorage bookkeeping, which the
// client now owns. Toggling #signedOut/#signedIn.hidden is load-bearing beyond
// the two panels: fishwizz-shell-v2.js watches those exact attributes with a
// MutationObserver and drives the welcome banner off them.
function syncAuthUi(s) {
  const el = id => document.getElementById(id);
  const checking = el('authChecking'), out = el('signedOut'), inn = el('signedIn'), who = el('who');
  if (checking) checking.hidden = true;
  if (out) out.hidden = !!s;
  if (inn) inn.hidden = !s;
  if (who) who.textContent = s ? 'Signed in as ' + (s.user?.email || 'FishWizz angler') : 'Signed in';
  window.stat?.(s ? 'Connected to FishWizz.' : 'Sign in to use FishWizz.', s ? 'ok' : '');
}

// --- the authoritative auth event bus ---------------------------------------

supabase.auth.onAuthStateChange((event, s) => {
  const previousUid = _session?.user?.id ?? null;
  const { changed } = applySession(s);
  const current = s?.user?.id ?? null;

  afterLegacy(() => {
    // Never reload on TOKEN_REFRESHED: it now fires roughly hourly, forever.
    // Only load on a real change -- a redundant firing for a session the
    // sign-in handler already applied (changed:false here) must not
    // re-trigger loadCore, which would re-fetch everything a second time.
    if (s && changed && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
      window.loadCore?.().catch(e => window.stat?.(e.message, 'err'));
    }
    if (event === 'SIGNED_OUT' && current !== previousUid) window.atlasClearPersonalState?.();
  });
});

// --- boot -------------------------------------------------------------------

function loadScript(src) {
  return new Promise(resolve => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = resolve;
    s.onerror = () => {
      console.error('FishWizz: core module failed to load', src);
      document.documentElement.dataset.fishwizzModuleError = '1';
      resolve();
    };
    document.head.appendChild(s);
  });
}

// Fire-and-forget: #turnstileWidget is already in index.html's static markup,
// so this doesn't need to wait on anything else in boot, and nothing else
// needs to wait on it -- a human has to type into the form before there's a
// sign-in attempt for it to matter to.
initTurnstile();

(async () => {
  try {
    await importLegacySession();
    // Runs before getSession() below so that, if the link carried a
    // token_hash, the session it establishes is what getSession() then reads
    // back -- same ordering guarantee the ?code= comment below relies on.
    await completeEmailConfirmation();
    // Resolves only after detectSessionInUrl has exchanged any ?code= for a
    // session, so window.session is already populated when app.js first runs.
    _session = (await supabase.auth.getSession()).data.session ?? null;
  } catch (e) {
    // Never let an auth failure stop the app from loading -- degrade to
    // signed-out rather than showing a blank page.
    console.error('FishWizz: auth init failed, continuing signed out', e);
  } finally {
    // window.session is authoritative from this point on, whichever branch
    // ran. Modules that were blocking on "is there a session yet" can stop.
    resolveAuthReady();
    // P0 (staging QA): "do not render authenticated or signed-out content
    // until the initial session check resolves". syncAuthUi() itself is
    // gated behind afterLegacy(), which queues until the ENTIRE ~17-script
    // LEGACY chain has finished loading -- seconds after the auth check
    // above has actually resolved. #authChecking (a neutral third state,
    // shown by default in index.html alongside #signedOut/#signedIn both
    // starting hidden) is revealed/hidden here instead, tied directly to
    // the real resolution point rather than to LEGACY's own unrelated
    // timeline. A full syncAuthUi() still runs later, once LEGACY finishes
    // -- this is only about not showing the WRONG one of the two panels in
    // the meantime, not a replacement for it.
    const out = document.getElementById('signedOut'), inn = document.getElementById('signedIn');
    if (document.getElementById('authChecking')) document.getElementById('authChecking').hidden = true;
    if (out) out.hidden = !!_session;
    if (inn) inn.hidden = !_session;
  }

  for (const src of LEGACY) {
    await loadScript(src);
    await new Promise(r => setTimeout(r, 60));
  }

  // The legacy modules were written as classic <script> tags, i.e. they load
  // BEFORE DOMContentLoaded. Injecting them from a deferred module breaks that
  // assumption: the event has already fired, so the eight files that register a
  // listener without a readyState guard -- map.js among them, which is what
  // creates the Leaflet map -- would never boot at all.
  //
  // Re-fire the event so the contract they were written against still holds.
  // This cannot double-fire the 38 modules that DO guard on readyState: those
  // took the immediate branch and never registered a listener.
  document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true, cancelable: false }));

  rebindAuthControls();
  _ready = true;
  while (_queue.length) _queue.shift()();

  // The legacy chain has run, so INITIAL_SESSION has already been queued and
  // flushed above. Paint once more in case nothing fired.
  syncAuthUi(_session);

  // Must run after the syncAuthUi() above, not inside rebindAuthControls():
  // the queued INITIAL_SESSION callback (flushed a few lines up) calls
  // syncAuthUi too, which repaints #status from the resolved session and
  // would silently overwrite whatever rebindAuthControls() had just put
  // there. #status has no per-message priority, only last-write-wins.
  if (pendingAuthMessage) {
    const { kind, title } = pendingAuthMessage;
    pendingAuthMessage = null;
    window.stat?.(title, kind === 'err' ? 'err' : kind === 'ok' ? 'ok' : '');
    if (kind === 'ok') window.showPage?.('mission');
  }
})();

// Supabase returns terse, lowercase, developer-facing strings. Shown verbatim
// they read as breakage rather than as something the angler can act on -- and
// "email rate limit exceeded" in particular tells the user nothing about what
// to do. Map the ones that actually reach users; pass anything else through.
function explainAuthError(error) {
  const raw = String(error?.message || error || '').toLowerCase();
  const status = error?.status;

  if (status === 429 || raw.includes('rate limit')) {
    return {
      title: 'Too many attempts just now',
      body: 'FishWizz can only send a few confirmation emails per hour. Wait a few minutes and try again — your details were fine.',
    };
  }
  if (raw.includes('invalid login credentials')) {
    return { title: 'Email or password is incorrect', body: 'Check both and try again.' };
  }
  if (raw.includes('email not confirmed')) {
    return { title: 'Confirm your email first', body: 'Open the link we sent you, then sign in.' };
  }
  if (raw.includes('already registered') || raw.includes('already been registered') || raw.includes('user already exists')) {
    return { title: 'That email already has an account', body: 'Sign in instead, or use a different email.' };
  }
  if (raw.includes('password should be') || raw.includes('weak password')) {
    return { title: 'Password is too weak', body: 'Use at least 6 characters.' };
  }
  // Supabase's real message for this case is `Email address "..." is invalid`
  // -- "invalid" and "email" in that order, not the "invalid email" substring
  // this used to check for -- so it fell through to the generic fallback
  // below and showed that raw technical string verbatim. Confirmed live.
  if (raw.includes('unable to validate email') || (raw.includes('invalid') && raw.includes('email'))) {
    return { title: "That email address doesn't look right", body: 'Check it for typos.' };
  }
  if (raw.includes('signups not allowed') || raw.includes('signup is disabled')) {
    return { title: 'New accounts are turned off right now', body: 'Please try again later.' };
  }
  if (raw.includes('failed to fetch') || raw.includes('networkerror') || raw.includes('load failed')) {
    return { title: 'Could not reach FishWizz', body: 'Check your connection and try again.' };
  }
  // Live-verified 2026-08-28: Supabase's own message for this is "captcha
  // protection: request disallowed (no captcha_token found)" or "captcha
  // verification process failed" -- both used to fall through to the raw
  // generic fallback below and show that exact backend string verbatim,
  // giving no indication anything could be retried. resetTurnstile() below
  // gives a fresh widget/token on the next attempt regardless of which of
  // these two shapes it was.
  if (raw.includes('captcha')) {
    return {
      title: 'Verification did not complete',
      body: turnstileState().configured
        ? 'The security check below has been reset — complete it again and retry.'
        : 'Verification is temporarily unavailable on this deployment. This is a site configuration issue, not something wrong with your email or password — please try again shortly.',
    };
  }
  return { title: 'That did not work', body: error?.message || 'Please try again.' };
}

function rebindAuthControls() {
  const el = id => document.getElementById(id);

  // app.js binds these at parse time with .onclick, capturing the original
  // function reference -- so overriding window.login later would NOT change the
  // handler. Re-binding the property is the only thing that works. This is the
  // same idiom patch.js and water-search.js already use.
  window.api = makeApi(supabase, () => _session);   // app.js's declaration overwrote it
  window.save = syncAuthUi;
  window.restore = async () => {};                  // the client owns restore now

  const email = () => el('email')?.value.trim() ?? '';
  const password = () => el('password')?.value ?? '';

  // Write next to the form. #status lives at the top of <main>, above every
  // page section, so an error shown only there is off-screen for anyone looking
  // at the account card -- which is why signup appeared to fail silently.
  function say(kind, title, body) {
    const box = el('authMessage');
    if (box) {
      box.className = 'fw-auth-msg ' + kind;
      box.innerHTML = body ? `<b>${escapeHtml(title)}</b>${escapeHtml(body)}` : escapeHtml(title);
      box.hidden = false;
    }
    // Keep the global bar in sync; other modules read it.
    window.stat?.(title, kind === 'err' ? 'err' : kind === 'ok' ? 'ok' : '');
  }
  function clearSay() { const box = el('authMessage'); if (box) box.hidden = true; }
  const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Disable the buttons in flight. Without this a slow request invites repeated
  // clicks, and on signup each one burns another of the few emails per hour the
  // account is allowed -- turning one slow response into a rate-limit lockout.
  function setBusy(on, activeBtn, busyLabel) {
    for (const id of ['signIn', 'signUp', 'signInGoogle']) {
      const b = el(id);
      if (!b) continue;
      if (on) {
        if (!b.dataset.label) b.dataset.label = b.textContent;
        b.disabled = true;
        if (b === activeBtn && busyLabel) b.textContent = busyLabel;
      } else {
        b.disabled = false;
        if (b.dataset.label) { b.textContent = b.dataset.label; delete b.dataset.label; }
      }
    }
  }

  const attempt = (fn, btnId, busyLabel) => async () => {
    clearSay();
    setBusy(true, el(btnId), busyLabel);
    try {
      const r = await fn();
      if (r && r.error) throw r.error;
      return r;
    } catch (e) {
      const { title, body } = explainAuthError(e);
      say('err', title, body);
      console.error('FishWizz auth:', e);
    } finally {
      setBusy(false);
    }
  };

  // A request sent with no captcha token, while Turnstile IS configured and
  // just hasn't been completed yet, wastes a round trip and (on signup)
  // one of Supabase's few emails/hour, then shows a confusing backend
  // string. Catching this before either request fires costs nothing and
  // tells the person exactly what's missing.
  function captchaPreflight() {
    const t = turnstileState();
    if (!t.configured || t.hasToken) return true; // not in use here, or already completed
    say('err', 'Complete the verification check', t.ready ? 'Check the box above, then try again.' : 'Verification is still loading — wait a moment and try again.');
    return false;
  }

  const signIn = el('signIn');
  if (signIn) signIn.onclick = attempt(async () => {
    if (!email()) { say('err', 'Enter your email', 'We need it to find your account.'); return {}; }
    if (!password()) { say('err', 'Enter your password', ''); return {}; }
    if (!captchaPreflight()) return {};
    const r = await window.fishwizzAuth.signIn(email(), password());
    resetTurnstile();   // the token just submitted is spent either way
    if (!r.error && r.data?.session) {
      // Apply the session Supabase's own response already contains, right
      // here, instead of waiting for the separate onAuthStateChange callback
      // -- that race (this click handler declaring success and navigating
      // before the callback had actually run) is the real cause of "signed-
      // in content next to WELCOME BACK/Log In/Create Account, navigation
      // broken until refresh". By the time showPage('mission') below runs,
      // every session-dependent read in the app is already correct.
      const { changed } = applySession(r.data.session);
      if (changed) await window.loadCore?.().catch(e => window.stat?.(e.message, 'err'));
      clearSay(); window.showPage?.('mission'); window.stat?.('Signed in.', 'ok');
    }
    return r;
  }, 'signIn', 'Signing in…');

  const signUp = el('signUp');
  if (signUp) signUp.onclick = attempt(async () => {
    // Validate before spending a request. Each signup that reaches Supabase
    // consumes one of a small hourly email allowance.
    if (!email() || !email().includes('@')) {
      say('err', 'Enter a valid email address', 'We send a confirmation link there.'); return {};
    }
    if (password().length < 6) {
      say('err', 'Password is too short', 'Use at least 6 characters.'); return {};
    }
    if (!captchaPreflight()) return {};
    const r = await window.fishwizzAuth.signUp(email(), password());
    resetTurnstile();   // the token just submitted is spent either way
    if (!r.error) {
      if (r.data?.session) {
        // Same atomic-apply as signIn above.
        const { changed } = applySession(r.data.session);
        if (changed) await window.loadCore?.().catch(e => window.stat?.(e.message, 'err'));
        clearSay();
        window.showPage?.('mission');
        window.stat?.('Account ready.', 'ok');
      } else {
        // The case that looked like silence: signup SUCCEEDS but returns no
        // session because the address needs confirming. Nothing changes
        // on screen unless we say so.
        say('ok', 'Check your email',
            `We sent a confirmation link to ${email()}. Open it, then come back and sign in. ` +
            'It can take a minute, and it may land in spam.');
      }
    }
    return r;
  }, 'signUp', 'Creating…');

  const signOut = el('signOut');
  if (signOut) signOut.onclick = attempt(async () => {
    const r = await window.fishwizzAuth.signOut();
    if (!r.error) { applySession(null); clearSay(); window.stat?.('Signed out.', ''); }
    return r;
  }, 'signOut');

  const google = el('signInGoogle');
  if (google) google.onclick = attempt(
    () => window.fishwizzAuth.signInWithGoogle(), 'signInGoogle', 'Redirecting…');

  // An OAuth failure comes back as ?error=...&error_description=... on the
  // redirect, not as a thrown exception -- so without this the user lands on a
  // signed-out page with no explanation of why.
  const q = new URLSearchParams(location.search);
  if (q.get('error') || q.get('error_description')) {
    say('err', 'Sign-in did not complete',
        q.get('error_description')?.replace(/\+/g, ' ') || q.get('error'));
    history.replaceState({}, '', location.pathname);
  }

  // Result of completeEmailConfirmation() above, deferred to here because
  // #authMessage doesn't exist until index.html's markup is in the DOM. Only
  // writes #authMessage (visible on the Account page); the top #status bar
  // -- visible on every page -- is set later, in the boot IIFE, after the
  // still-queued INITIAL_SESSION repaint would otherwise clobber it. Left
  // set (not nulled) so that later call knows there's something to say.
  if (pendingAuthMessage) say(pendingAuthMessage.kind, pendingAuthMessage.title, pendingAuthMessage.body);
}