/**
 * Refresh-aware replacement for app.js's api().
 *
 * Same signature and same thrown-Error shape, because 49 call sites across 19
 * files call it as a bare global and none of them are being touched.
 *
 * P0 (release-blocking stabilization, 2026-08-28): "Mission creation
 * freezes the application... unresponsive for more than 60 seconds."
 * Traced the real deployed request path end to end: this fetch() call had
 * NO timeout and no AbortController at all. If any single dependency it
 * feeds -- the Mission RPC itself, the weather edge function, or any of
 * gear-state.js's four Promise.all'd gear queries -- ever stalled on the
 * network (a slow edge function cold start, a dropped connection, anything
 * short of an outright HTTP error), the fetch's promise simply never
 * settled, and every `await api(...)` upstream hung forever with no error,
 * no timeout, and nothing for a catch block to ever run against -- exactly
 * the reported symptom. This one function is the single choke point every
 * one of those 49 call sites shares, so a bounded timeout here is the one
 * architectural correction that fixes the hang for all of them at once,
 * not just Mission building.
 *
 * DEFAULT_TIMEOUT_MS=12000 leaves real margin under the P0 acceptance bar
 * ("completes or returns a usable error within 15 seconds") even after
 * mission-v3.js's own sequential weather -> inventory -> RPC stages, since
 * a stall in any ONE of them (the realistic failure mode -- not all three
 * stalling in series) still resolves well inside that budget. Callers that
 * genuinely need a different bound (a long-running server action, a
 * deliberately fast health check) can still pass their own `signal` in
 * `opt`, which takes priority over this default entirely.
 */
const DEFAULT_TIMEOUT_MS = 12000;

export function makeApi(supabase, getSession) {
  return async function api(path, opt = {}) {
    let session = getSession();
    if (!session) session = (await supabase.auth.getSession()).data.session;
    if (!session) throw Error('Sign in first.');

    // A caller-supplied signal (opt.signal) is used as-is, never wrapped --
    // a caller that wants no timeout (or a different one) is fully in
    // control. Otherwise every attempt (the initial call AND the 401-retry
    // below) gets its own fresh timeout window -- the retry used to reuse
    // the first attempt's already-cleared timer, leaving it with no
    // protection at all if IT then stalled.
    async function send(token) {
      const controller = opt.signal ? null : new AbortController();
      const timeoutId = controller
        ? setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), opt.timeoutMs ?? DEFAULT_TIMEOUT_MS)
        : null;
      try {
        return await fetch(window.SUPABASE_URL + path, {
          ...opt,
          signal: opt.signal ?? controller?.signal,
          headers: {
            apikey: window.SUPABASE_ANON,
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
            ...(opt.headers || {}),
          },
        });
      } catch (e) {
        // AbortError from our own timeout is a real, distinct failure mode --
        // surfaced with a message an angler can actually act on ("try
        // again"), not the browser's generic "The user aborted a request."
        // A genuine network failure (offline, DNS, TLS) gets its own clear
        // message too, rather than the raw, technical fetch TypeError.
        if (e?.name === 'AbortError' || e?.name === 'TimeoutError') {
          throw Object.assign(Error('FishWizz could not reach the server in time. Check your connection and try again.'), { cause: e, timedOut: true });
        }
        throw Object.assign(Error('Could not reach FishWizz. Check your connection and try again.'), { cause: e, networkError: true });
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    }

    let response = await send(session.access_token);

    // Retry on 401 ONLY -- never 403.
    //
    // A 401 is rejected by PostgREST before the statement runs, so replaying it
    // is safe. A 403 is an RLS denial, which means the request WAS evaluated;
    // retrying a POST /rest/v1/catches on a 403 would risk a duplicate row.
    //
    // This is a backstop, not the mechanism. autoRefreshToken in supabase.js is
    // what actually keeps the token alive; this catches the narrow window where
    // a request is already in flight as the token expires.
    if (response.status === 401) {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        await supabase.auth.signOut();
        throw Error('Your FishWizz session expired. Please sign in again.');
      }
      response = await send(data.session.access_token);
    }

    // app.js's parse() -- reused deliberately so error messages stay identical.
    return window.parse(response);
  };
}
