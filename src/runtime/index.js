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
import { supabase, SUPABASE_URL, SUPABASE_ANON } from './supabase.js';
import { makeApi } from './api.js';

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
  '/water-search.js',
  '/patch.js',
  '/mission-inventory-fit.js',
  '/mission-v3.js',
  '/map.js',
  '/launch.js',
  '/pwa.js',
  '/fishwizz-shell-v2.js',
  '/production-hardening.js',
  '/premium-product.js',
  // Cross-cutting resilience layer (error/offline banners, haptic feedback,
  // map resize on tab focus) -- app-wide, not page-specific, and boots off a
  // bare DOMContentLoaded listener rather than a readyState-guarded one, so
  // it needs the LEGACY chain's synthetic re-dispatch rather than a lazy
  // pwa.js group (which loads well after that event has already fired).
  '/field-guard.js',
];

let _session = null;
let _ready = false;
const _queue = [];
const afterLegacy = fn => (_ready ? fn() : _queue.push(fn));

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
  set(v) { if (v == null && _session) supabase.auth.signOut().catch(() => {}); },
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
  token: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
  signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
  signUp: (email, password) =>
    supabase.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + '/' } }),
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

// --- UI sync ----------------------------------------------------------------

// app.js's save() minus the session and localStorage bookkeeping, which the
// client now owns. Toggling #signedOut/#signedIn.hidden is load-bearing beyond
// the two panels: fishwizz-shell-v2.js watches those exact attributes with a
// MutationObserver and drives the welcome banner off them.
function syncAuthUi(s) {
  const el = id => document.getElementById(id);
  const out = el('signedOut'), inn = el('signedIn'), who = el('who');
  if (out) out.hidden = !!s;
  if (inn) inn.hidden = !s;
  if (who) who.textContent = s ? 'Signed in as ' + (s.user?.email || 'FishWizz angler') : 'Signed in';
  window.stat?.(s ? 'Connected to FishWizz.' : 'Sign in to use FishWizz.', s ? 'ok' : '');
}

// --- the authoritative auth event bus ---------------------------------------

supabase.auth.onAuthStateChange((event, s) => {
  const previous = _session?.user?.id ?? null;
  _session = s;
  const current = s?.user?.id ?? null;

  afterLegacy(() => {
    syncAuthUi(s);

    if (current !== previous) {
      if (previous) window.atlasClearPersonalState?.();
      // Same name and same detail shape as account-isolation.js's version --
      // 13 modules listen for this and none of them are being changed.
      document.dispatchEvent(new CustomEvent('atlas:account-changed', {
        detail: { user_id: current, previous_user_id: previous },
      }));
    }

    // Never reload on TOKEN_REFRESHED: it now fires roughly hourly, forever.
    if (s && current !== previous && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
      window.loadCore?.().catch(e => window.stat?.(e.message, 'err'));
    }
    if (event === 'SIGNED_OUT') window.atlasClearPersonalState?.();
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

(async () => {
  try {
    await importLegacySession();
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
  if (raw.includes('unable to validate email') || raw.includes('invalid email')) {
    return { title: "That email address doesn't look right", body: 'Check it for typos.' };
  }
  if (raw.includes('signups not allowed') || raw.includes('signup is disabled')) {
    return { title: 'New accounts are turned off right now', body: 'Please try again later.' };
  }
  if (raw.includes('failed to fetch') || raw.includes('networkerror') || raw.includes('load failed')) {
    return { title: 'Could not reach FishWizz', body: 'Check your connection and try again.' };
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

  const signIn = el('signIn');
  if (signIn) signIn.onclick = attempt(async () => {
    if (!email()) { say('err', 'Enter your email', 'We need it to find your account.'); return {}; }
    if (!password()) { say('err', 'Enter your password', ''); return {}; }
    const r = await window.fishwizzAuth.signIn(email(), password());
    if (!r.error) { clearSay(); window.showPage?.('mission'); window.stat?.('Signed in.', 'ok'); }
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
    const r = await window.fishwizzAuth.signUp(email(), password());
    if (!r.error) {
      if (r.data?.session) {
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
    if (!r.error) { clearSay(); window.stat?.('Signed out.', ''); }
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
}