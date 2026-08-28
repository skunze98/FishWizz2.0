/**
 * The one authoritative authentication state machine (P0, staging QA,
 * 2026-08-27: "signed-in content rendered together with WELCOME BACK / Log
 * In / Create Account; navigation broken until refresh"). Pulled out of
 * index.js into its own dependency-free module (no Leaflet/CSS imports)
 * specifically so it's directly unit-testable in plain Node -- see
 * scripts/test-auth-state.mjs.
 *
 * Root cause of the reported bug, confirmed by tracing the actual sequence:
 * the sign-in click handler declared success and navigated the instant
 * supabase.auth.signInWithPassword()'s own promise resolved, without
 * waiting for the SEPARATE onAuthStateChange callback that was the only
 * thing updating the session state everything else reads live. Supabase JS
 * does not guarantee that callback fires before the caller's own promise
 * settles -- a real, documented gap, not a timing coincidence.
 *
 * createAuthState() returns one object that is the single source of truth
 * for "what session is active, and is that a real account change". Both
 * the onAuthStateChange listener AND a sign-in click handler that already
 * has the session in hand (from Supabase's own response) call apply() on
 * it -- whichever gets there first wins atomically; the second, redundant
 * application of the same session is a no-op, not a double clear-and-
 * dispatch.
 */
export function createAuthState({ onChange, onSameAccount } = {}) {
  let session = null;
  let generation = 0;
  let everEstablished = false;

  function apply(s) {
    const previous = session?.user?.id ?? null;
    const current = s?.user?.id ?? null;
    if (current === previous) {
      // Not a real change: a token refresh, or this exact session was
      // already applied (most commonly by a sign-in handler calling apply()
      // directly, moments before onAuthStateChange's own redundant firing
      // for the same sign-in).
      session = s;
      onSameAccount?.(s);
      return { changed: false, generation };
    }
    const wasInitial = !everEstablished;
    everEstablished = true;
    session = s;
    generation++;
    const detail = { user_id: current, previous_user_id: previous, generation, initial: wasInitial };
    onChange?.(s, detail);
    return { changed: true, generation, initial: wasInitial };
  }

  return {
    apply,
    get session() { return session; },
    get generation() { return generation; },
  };
}
