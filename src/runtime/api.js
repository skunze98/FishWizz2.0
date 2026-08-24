/**
 * Refresh-aware replacement for app.js's api().
 *
 * Same signature and same thrown-Error shape, because 49 call sites across 19
 * files call it as a bare global and none of them are being touched.
 */
export function makeApi(supabase, getSession) {
  return async function api(path, opt = {}) {
    let session = getSession();
    if (!session) session = (await supabase.auth.getSession()).data.session;
    if (!session) throw Error('Sign in first.');

    const send = token => fetch(window.SUPABASE_URL + path, {
      ...opt,
      headers: {
        apikey: window.SUPABASE_ANON,
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
        ...(opt.headers || {}),
      },
    });

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
