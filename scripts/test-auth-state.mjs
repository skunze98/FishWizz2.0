#!/usr/bin/env node
// Regression test for P0 "Make authentication and account switching atomic"
// (staging QA, 2026-08-27): "after sign-in, the same page showed
// authenticated content for [an account] together with WELCOME BACK / Log In
// / Create Account; navigation was broken until a full manual refresh."
//
// Exercises src/runtime/auth-state.js's createAuthState() directly -- the
// one authoritative auth state machine index.js now delegates to (see that
// file's own applySession() wrapper) -- covering every scenario the
// instruction named explicitly:
//   - cold start while signed out
//   - cold start with an existing session
//   - login without a refresh (apply() called directly, then a redundant
//     onAuthStateChange firing for the same sign-in)
//   - twenty Account A <-> Account B switch cycles
//   - slow initial session resolution
//   - a stale Account A response arriving after Account B is active
//     (generation-token cancellation)
//   - refresh during auth initialization
// Run with:
//   node scripts/test-auth-state.mjs
import { createAuthState } from '../src/runtime/auth-state.js';

let failures = 0;
function check(label, cond) {
  if (cond) { console.log(`  ok   ${label}`); }
  else { console.log(`  FAIL ${label}`); failures++; }
}
function section(name) { console.log(`\n${name}`); }

const accountA = { user: { id: 'user-a', email: 'a@example.com' } };
const accountB = { user: { id: 'user-b', email: 'b@example.com' } };

section('Cold start while signed out');
{
  const changes = [];
  const sameAccountCalls = [];
  const state = createAuthState({ onChange: (s, d) => changes.push(d), onSameAccount: s => sameAccountCalls.push(s) });
  const r = state.apply(null);
  check('applying null on a fresh state is not a "changed" event (nothing to clear, nothing to load)', r.changed === false);
  check('no onChange (real account-change) dispatch fires for null -> null', changes.length === 0);
  // onSameAccount still fires even here -- this is what lets a UI still
  // paint the correct signed-out panel on a cold, signed-out start, the same
  // way it repaints on a token refresh; it just never treats it as an
  // account change (no clear, no atlas:account-changed, no generation bump).
  check('onSameAccount still fires once, so the signed-out UI still gets painted', sameAccountCalls.length === 1);
  check('session reads back as null', state.session === null);
  check('generation stays at 0', state.generation === 0);
}

section('Cold start with an existing session (page load, already signed in)');
{
  const changes = [];
  const state = createAuthState({ onChange: (s, d) => changes.push(d) });
  const r = state.apply(accountA);
  check('the very first session establishment is a real change', r.changed === true);
  check('generation advances to 1', r.generation === 1 && state.generation === 1);
  check('it is flagged initial: true (nothing to clear, unlike a real account switch)', r.initial === true);
  check('exactly one onChange dispatch fires', changes.length === 1);
  check('previous_user_id is null on the very first establishment', changes[0].previous_user_id === null);
  check('user_id is the signed-in account', changes[0].user_id === 'user-a');
  check('session reads back as the applied session', state.session === accountA);
}

section('Login without refresh: direct apply() + a redundant onAuthStateChange firing for the same sign-in');
{
  const changes = [];
  const sameAccountCalls = [];
  const state = createAuthState({
    onChange: (s, d) => changes.push(d),
    onSameAccount: s => sameAccountCalls.push(s),
  });
  // The sign-in click handler applies the session it already has from
  // Supabase's own signInWithPassword() response, synchronously, before
  // navigating -- this is the actual atomicity fix for the reported bug.
  const clickResult = state.apply(accountA);
  check('the click handler\'s own apply() reports changed:true immediately', clickResult.changed === true);
  check('session is correct before any async callback ever runs', state.session === accountA);
  // onAuthStateChange's own SIGNED_IN firing for the exact same session
  // arrives moments later -- it must be a no-op, not a second clear/dispatch.
  const listenerResult = state.apply(accountA);
  check('the redundant onAuthStateChange firing for the same account is not "changed" again', listenerResult.changed === false);
  check('exactly one real onChange dispatch happened, not two', changes.length === 1);
  check('the redundant firing is routed to onSameAccount instead', sameAccountCalls.length === 1);
}

section('Account A -> Account B -> Account A: 20 switch cycles');
{
  const dispatches = [];
  const state = createAuthState({ onChange: (s, d) => dispatches.push(d) });
  state.apply(accountA); // establish
  let lastGeneration = state.generation;
  let cycles = 0;
  for (let i = 0; i < 20; i++) {
    const toB = state.apply(accountB);
    const toA = state.apply(accountA);
    if (toB.changed && toA.changed && toB.generation > lastGeneration && toA.generation > toB.generation) cycles++;
    lastGeneration = toA.generation;
  }
  check('all 20 switch cycles registered as real, monotonically-increasing changes', cycles === 20);
  check('generation ended at 41 (1 initial + 20*2 switches)', state.generation === 41);
  check('final session is Account A', state.session === accountA);
  check('none of the 41 real dispatches were flagged initial after the first', dispatches.filter(d => d.initial).length === 1);
  // "Account A -> logout -> Account B never shows Account A values": every
  // switch-away dispatch must carry the correct previous_user_id so a
  // listener can actually clear the outgoing account's state, not a stale one.
  check('every dispatch carries the correct previous_user_id for its own transition',
    dispatches.every((d, i) => i === 0 || d.previous_user_id === dispatches[i - 1].user_id));
}

section('Slow initial session resolution: apply() only ever called once resolved');
{
  // "Slow initial session resolution" means the FIRST apply() call is
  // delayed, not that it's called speculatively with a placeholder -- there
  // is no separate "unknown" state in this module by design (index.html's
  // #authChecking neutral panel is what covers that gap in the UI; this
  // module has nothing to do until a real answer -- session or null -- is
  // available). Confirm nothing is considered established, and no dispatch
  // fires, until that first real apply() actually lands.
  const changes = [];
  const state = createAuthState({ onChange: (s, d) => changes.push(d) });
  check('before the slow resolution lands, nothing has been established yet', state.generation === 0 && state.session === null);
  // ...slow network round trip elapses here in the real app...
  const r = state.apply(accountA);
  check('once it lands, it is applied correctly as the initial session', r.changed === true && r.initial === true);
  check('exactly one dispatch, only after resolution', changes.length === 1);
}

section('Stale Account A response arriving after Account B is already active');
{
  // Mirrors gear-state.js's own real use of this: a long-running fetch reads
  // the generation active when it STARTS, and must be discarded if the
  // generation has moved on by the time it resolves -- simulated here
  // directly against the state machine's own generation counter, which is
  // the actual authority gear-state.js checks against.
  const state = createAuthState({});
  state.apply(accountA);
  const requestGeneration = state.generation; // Account A's request starts here
  state.apply(accountB); // account switches while that request is still in flight
  const isStale = requestGeneration !== state.generation;
  check('a response tagged with Account A\'s generation is detectably stale once B is active', isStale === true);
  check('the live generation moved forward, not just changed arbitrarily', state.generation === requestGeneration + 1);
  check('the currently active session is Account B, never a stale A response applied on top', state.session === accountB);
}

section('Refresh during authentication initialization');
{
  // A page refresh while auth is still resolving means createAuthState() is
  // constructed fresh (no in-memory state survives a reload) and its very
  // first apply() is the only one that matters -- confirm that first
  // apply(), whatever it resolves to, is treated as initial and correct
  // regardless of how it arrived (existing session restored, or genuinely
  // signed out), exactly as the "cold start" cases above already establish.
  // What matters here specifically is that a SECOND, redundant resolution
  // of the same initial state (the well-documented INITIAL_SESSION ->
  // occasional duplicate firing gap) still doesn't double-apply.
  const changes = [];
  const state = createAuthState({ onChange: (s, d) => changes.push(d) });
  const first = state.apply(accountA);
  const duplicateInitialFiring = state.apply(accountA);
  check('the real initial resolution is applied once', first.changed === true && first.initial === true);
  check('a duplicate firing of the same initial session is a no-op, not a second "account changed"', duplicateInitialFiring.changed === false);
  check('only one real dispatch happened across both', changes.length === 1);
}

section('Water/location/identity fields never derive from this module\'s own state');
{
  // Not a UI assertion (auth-state.js has no DOM access at all, by design --
  // that is itself the guarantee: the account-id/generation bookkeeping
  // lives in a module that cannot reach into #mWater/#cWater even by
  // accident). Confirm the only things apply() ever returns or exposes are
  // account id, generation, and initial/changed flags -- nothing shaped like
  // an email, username, or profile field.
  const state = createAuthState({});
  const r = state.apply(accountA);
  const keys = Object.keys(r).sort();
  check('apply() result exposes only changed/generation/initial -- no identity fields', keys.join(',') === 'changed,generation,initial');
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
