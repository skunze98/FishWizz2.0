// P1 (release-blocking stabilization, 2026-08-28): "One tab displayed the
// current 'Gear' navigation and expanded species catalog. A fresh tab on
// the same production URL displayed the older 'Arsenal' shell, a shorter
// species list, and 'Getting your fishing ready...'."
//
// Root cause, confirmed live against the deployed target, not guessed: this
// worker used to be a bare `return env.ASSETS.fetch(request)` proxy with no
// header logic of its own -- relying entirely on dist/_headers (rendered by
// scripts/postbuild.mjs) to set Cache-Control. But `_headers` is a
// Cloudflare *Pages* convention; Workers Static Assets (what this project
// actually deploys to -- see direct-cloudflare-assets-upload.mjs) never
// reads it at all. Confirmed live: `curl .../_headers` on the deployed
// Worker returns the raw _headers TEMPLATE FILE content as a plain served
// asset -- proof the rules inside it were never being applied, not just
// theory. Every response -- index.html, sw.js, and every one of the ~70
// non-content-hashed public/*.js legacy scripts (app.js, gear-state.js,
// mission-v3.js, ...) -- was instead served with whatever Cloudflare's own
// default asset caching does, observed live returning `CF-Cache-Status:
// HIT` on index.html and sw.js. Those files' CONTENT changes on every
// deploy while their FILENAME never does, so a cached edge copy of any one
// of them (gear-state.js in particular explains the exact reported
// symptom: an old cached copy silently running next to this deploy's new
// index.html/nav shell) is indistinguishable from a real, current file
// until that cache entry happens to expire or get purged -- exactly "one
// tab shows the new version, a fresh tab shows the old one."
//
// The fix has to live in this worker's own fetch handler, since it is the
// one thing whose headers Cloudflare's Workers Assets binding actually
// honors on this deployment target:
//   - /assets/* (Vite's own bundle output) is content-hashed by Vite
//     itself -- the filename changes the instant the content does, so it is
//     genuinely safe to cache forever, at every layer, browser and edge
//     alike.
//   - Everything else keeps the same filename release over release. Served
//     `no-cache` (not merely a short max-age) so both the browser AND
//     Cloudflare's edge must revalidate with origin on every request --
//     the only way to guarantee a stale cached copy can never silently win
//     a race against a fresh deploy again.
export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const url = new URL(request.url);
    const headers = new Headers(response.headers);
    if (/^\/assets\//.test(url.pathname)) {
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      headers.set('Cache-Control', 'no-cache');
    }
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
