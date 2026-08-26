# FishWizz — deployment and hardening runbook

Everything in this file needs credentials I don't have. The code side is done
and committed; this is the part you run.

Order matters. Steps 1–4 are safe to do now against a preview URL. **Step 4 (DNS)
is the cutover.** Step 3 must be finished before step 6, because the Google
consent screen needs published legal URLs.

---

## Environments — UPDATED 2026-08-25: down to one Supabase project

The original plan (recorded below in "the production project is empty" for
history, not as current instructions) was two projects: an empty
`usanapexwjssjscmdjwv` for production, `doddeferfxzgdmzadibq` for staging.
That fell apart on two independent problems, discovered while actually
running provisioning:

1. **`usanapexwjssjscmdjwv` turned out to be inaccessible.** Neither the
   dashboard nor a fresh personal access token could see it -- it was created
   under a different Supabase login than the one now in use, and that login
   is gone. `supabase projects list` with a token from the current account
   shows exactly one project.
2. **The Supabase plan in use only allows one project anyway**, which would
   have blocked creating a fresh replacement even without problem 1.

**Decision: `doddeferfxzgdmzadibq` is now both staging and production.**
`app.fishwizz.com` and every preview deploy point at the same project, using
the same publishable key. This is a real, accepted tradeoff, not a bug:

- **Local dev and preview deploys now share a database with real public
  traffic.** The "`.env` points at staging so local dev is never one typo
  away from production" guarantee described below no longer holds, because
  there is no longer a separate production to be a typo away from. Be more
  careful with anything run locally against `.env` than this file used to
  advise.
- **No provisioning was needed** -- `doddeferfxzgdmzadibq` was already
  hardened and verified (55/55 cross-tenant checks, see step 2's status
  notes) before this decision, so nothing in that work was wasted or needs
  redoing.
- **Real beta data carries forward automatically.** No "sorry, your history
  doesn't move to production" conversation with existing testers.
### Addendum, same day: `app.fishwizz.com` is not this deployment

While chasing down why `app.fishwizz.com` still looked broken after the
decision above, it turned out the premise was incomplete, not wrong:
`usanapexwjssjscmdjwv` is not actually empty (`401 permission denied`, not
`PGRST205 table not found` -- a real hardened schema, not an unprovisioned
one), and **`app.fishwizz.com` is currently serving a separate, working
deployment against it that this session did not make.** A collaborator has
been doing real production work independently, on infrastructure this
session doesn't have access to.

Confirmed independently: this Cloudflare account's token can only see the
`atlasfishing.com` zone, not `fishwizz.com` -- when creating a *fresh* token
from scratch, `fishwizz.com` isn't even offered as a Zone Resource to select,
and there's no second account in the dashboard's account switcher to swap
to. So `fishwizz.com`'s zone is not reachable from this Cloudflare login at
all, not a permissions gap that can be fixed from this side.

**Decision, made with the user: keep building here, on infrastructure this
session actually controls, and reconcile domains later.** Concretely:

- **The real working URL for everything in this session is
  `https://fishwizz-e7d.pages.dev`** (the Cloudflare Pages project's own
  domain -- always serves the latest Production-environment deploy), not
  `app.fishwizz.com`. Supabase's `site_url` was pointed here for exactly this
  reason: an email confirmation link built from `site_url` needs to land on
  the app that actually holds the session it's confirming, and
  `app.fishwizz.com` -- being the collaborator's separate deployment against
  `usanapexwjssjscmdjwv` -- does not.
- `app.fishwizz.com`'s custom-domain attachment to *this* Pages project
  (`fishwizz`) has sat in `pending -- CNAME record not set` since the very
  first deploy today, which in hindsight is the reason nothing here has
  collided with the collaborator's live setup -- the attempted attachment
  never actually completed.
- `www.fishwizz.com` **was** successfully moved onto this session's
  `fishwizz-web` Pages project earlier today (the pre-existing content there
  happened to be byte-identical to `marketing/`, which is why it wasn't
  caught sooner). Left as-is per the user -- not reverted.
- `app.fishwizz.com/**` stays in Supabase's redirect allow-list for when
  domain access is sorted out later; it's inert until DNS actually points
  there.
- **"Worst case, we copy this work over to `fishwizz.com` once domain access
  is sorted"** -- the user's own framing, and the right way to read every
  `fishwizz-e7d.pages.dev` reference in this file from here on: a working
  stand-in, not the final address.

### Addendum, 2026-08-25: launching at `fishwizz-e7d.pages.dev`, not the domain

Decision, made with the user: the `app.fishwizz.com` collaborator conflict
above is still unresolved, so **public launch happens at
`https://fishwizz-e7d.pages.dev` for now**, not `app.fishwizz.com`. Confirmed
via a read-only Cloudflare API check that `app.fishwizz.com`'s custom-domain
attachment is still `pending -- CNAME record not set`, so this deployment and
the collaborator's remain non-colliding either way.

**This reopens a problem the first addendum above thought it had closed.**
Somewhere between that addendum and step 6d being written, `site_url` was
changed *again*, from the Pages URL to `https://app.fishwizz.com` ("changed
because `{{ .SiteURL }}` in email templates should point real users at the
real app" -- true in general, wrong for who "the real app" actually is right
now). With today's decision, that setting is backwards: a real user
confirming signup on `fishwizz-e7d.pages.dev` would get an email link built
from `site_url` pointing at the collaborator's separate deployment, which
does not hold the session it's confirming. **`site_url` needs to be pointed
back to `https://fishwizz-e7d.pages.dev` before any real signups happen** --
flagged here, not yet fixed as of this addendum: this session has no
Supabase Management API token (only the Cloudflare one, used for the
read-only domain check above), so this is a dashboard action for the user,
same as the other 🔑 items in step 6d.

**Resolved, 2026-08-25 (later the same day).** The user supplied a fresh
personal access token and a direct read against the Management API
(`GET /v1/projects/doddeferfxzgdmzadibq/config/auth`) shows `site_url` is
already `https://fishwizz-e7d.pages.dev`, and `uri_allow_list` already
carries all four expected entries (`staging.fishwizz-e7d.pages.dev/**`,
`*.fishwizz-e7d.pages.dev/**`, `fishwizz-e7d.pages.dev/**`,
`app.fishwizz.com/**`). No PATCH was needed -- whatever set it back to the
Pages URL after the "changed to `app.fishwizz.com`" edit mentioned above
happened before this check, outside this session's own record. Read the
regression above as historical: it was real when written, it is not real
now. The token used for this check was a one-off, not saved anywhere in the
repo or in `.env`, and the user was advised to revoke it from
supabase.com/dashboard/account/tokens after use.

If a real second project ever becomes available (plan upgrade, or recovered
access to the original account), splitting them back apart means: create
  the project, run `scripts/capture-staging.ps1` then
  `scripts/provision-production.ps1` against it (both already written for
  exactly this), then revert the `$ProdUrl`/`$ProdKey` values in
  `scripts/cf-setup-pages.ps1` to point at it instead of staging.

The app and the marketing site are still two separate Cloudflare Pages
projects: the app (this repo, `npm run build` → `dist/`) deploys to
`app.fishwizz.com` via `scripts/cf-setup-pages.ps1`; the marketing site
(`marketing/`) deploys to `www.fishwizz.com` via
`scripts/cf-setup-marketing.ps1`. Keep that straight in every step below —
attaching `www.fishwizz.com` to the app's Pages project, or registering it as
the app's origin with Google/Supabase, points real traffic and OAuth at the
wrong project.

Nothing in the code names the project — the URL and key come from
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON` at build time.

Supabase Auth's `site_url` and `uri_allow_list` on `doddeferfxzgdmzadibq` were
updated via the Management API to include `https://app.fishwizz.com` alongside
the existing staging/preview entries (not replacing them) -- see step 6d,
which otherwise still describes this as if it were a separate project's
settings; read "the production project" there as "this same project."

The build fails if the origin in the CSP disagrees with the origin baked into
the bundle. A half-changed environment would otherwise ship an app whose every
API call is blocked by `connect-src` — which looks like an outage rather than
a config mistake.

### The production project is empty (historical -- see the update above)

I probed both projects with their publishable keys. **`usanapexwjssjscmdjwv` has
no schema at all.** Every table returns the identical
`PGRST205 "Could not find the table 'public.catches' in the schema cache"` that a
table I invented returns — so this is an unprovisioned project, not a locked-down
one.

Staging, by contrast, answers `Content-Range: */0` for the same request: the
tables exist and return no rows to the anon role.

That means production is not "the live database to harden" — it is an empty
project that has to be built out before it can serve anything (step 2b). The
running beta lives on staging, and staging is where the real angler data is
today. Plan accordingly: **staging is the one that needs hardening urgently**,
production is the one that needs provisioning.

Two rules that keep this safe:

- **Every schema change lands on staging first**, gets probed, and only then goes
  to production. That applies to the RLS migration in step 2 as much as to
  anything later.
- **`.env` points at staging**, so local development is never one typo away from
  production data.

---

## 0. Local build

```powershell
Copy-Item .env.example .env
```

```powershell
npm install
```

```powershell
npm run build
```

`npm run build` fails the build — not warns — if any precached file is missing,
if `index.html` or `pwa.js` reference a module that isn't in `dist/`, or if any
file re-declares `URL`. That last guard is what keeps the service-worker bug
from coming back.

---

## 1. Cloudflare Pages — DONE (2026-08-25)

`scripts/cf-setup-pages.ps1` did this end to end: created the `fishwizz` Pages
project, set both the Production and Preview environment variables, built,
deployed via `wrangler pages deploy` (direct upload, not a GitHub connection —
see the script's own header for why: the Cloudflare GitHub App is an OAuth
install the API can't do on your behalf), and attached `app.fishwizz.com`.
Re-run it any time to redeploy; it's idempotent.

Because of the single-project decision above, **both environments now carry
the same values**:

```
VITE_SUPABASE_URL=https://doddeferfxzgdmzadibq.supabase.co
VITE_SUPABASE_ANON=sb_publishable_aRBM4TvuGEUAdOZazPoZLw_CXdoEtpp
```

The publishable key is public by design — it identifies the project, it doesn't
authorize anything. Row Level Security (step 2) is what protects the data.

If a second project becomes available later and these get split back apart
(see the note under Environments above), restore the Production
Branch/Build-command/Output-directory settings a from-scratch dashboard
project would need — `main`, `npm run build`, `dist`, Node 20+ — and give
Production its own distinct values again.

If you want a stable staging URL rather than per-commit preview URLs, add
`staging.fishwizz.com` as a custom domain bound to a long-lived `staging` branch.
It picks up the Preview environment variables automatically.

Verify on the `*.pages.dev` URL before touching DNS:

```powershell
(Invoke-WebRequest -Uri "https://<your-project>.pages.dev/" -Method Head -UseBasicParsing).Headers
```

Then open it and confirm in DevTools → Application → Service Workers that the
worker reaches **activated** and Cache Storage is populated. It should show 17
entries. Reload in airplane mode — the shell should still come up. This has
never worked in production before, so it's worth actually looking.

---

## 2. Supabase hardening 🔑 — do this before any real traffic

**Harden staging first, and treat it as urgent.** Staging holds the live beta and
every real angler's catches, spots, and photos — it is the only project with data
to lose. Production is empty (see above), so it gets provisioned and hardened in
one pass afterwards.

I confirmed one thing from outside already: in staging, the anon role can still
*reach* every table — requests return `200`, not `401` — and
`app_release_status` returns rows to a completely unauthenticated caller. User
tables return zero rows, which is consistent with RLS filtering correctly, but
that is not proof: an empty table looks identical from outside. Only the
authenticated cross-tenant probe in step 2c can tell those apart.

The `revoke all on all tables in schema public from anon` in the migration is
what removes that reachability.

**Status as of 2026-08-24, staging only — read before repeating any of a–d:**

- **Anonymous REST reachability — confirmed closed.** A direct probe against
  every FishWizz table (all 22, from `profiles` to `data_source_runs`) returned
  `401`, not `200`. The gap described two paragraphs up no longer exists on
  staging. The only remaining `anon` grants found were PostGIS metadata
  objects, not FishWizz tables.
- **Migration provenance — reconciled.** Staging's migration history stores the
  executable SQL for `20260824101705_harden_rls`. On 2026-08-24 that SQL was
  pulled from `supabase_migrations.schema_migrations`, normalized by removing
  comments and whitespace, and compared with the repository migration: both
  normalized to 1,539 characters with no difference. The repository file is
  now recorded under the real applied name,
  `supabase/migrations/20260824101705_harden_rls.sql`, so staging history and
  production provisioning share one canonical version.
- **Cross-tenant isolation — official probe passed.** Two dedicated,
  admin-confirmed staging accounts were each seeded through the authenticated
  REST API with a catch, rod and reel; account A was additionally seeded in
  every per-user table so no check could hide behind an empty result. The plain
  probe passed `31 passed, 0 failed, 0 inconclusive`. After fixing the probe to
  use `user_id` as `user_fishing_profiles`' primary key and to actually exercise
  UPDATE as well as DELETE, `--destructive` passed
  `55 passed, 0 failed, 0 inconclusive`. The forged-`owner_id` insert was denied
  with 403 and no cross-tenant read, update or delete succeeded.
- **Dashboard settings (step d) — mostly done.** Refresh token rotation +
  reuse detection (10s interval), sign-in/sign-up/OTP rate limits (30→10 per 5
  min), and all three storage buckets (`public = false`) are confirmed on
  staging. **CAPTCHA is deliberately still off** — enabling it needs a
  Turnstile secret *and* matching frontend token integration (step 5); doing
  one without the other would lock out real sign-ins, so this is correctly
  sequenced, not skipped. Leaked-password protection is unavailable on this
  project's plan (Supabase Pro-only) — a known, accepted gap, not a mistake.

**a. The audit against staging is already done — the migration below was
rewritten from its results on 2026-08-10.** Read the header comment at the
top of `supabase/migrations/20260824101705_harden_rls.sql` before touching
anything else in this section: it records that an earlier version of this
migration (FORCE ROW LEVEL SECURITY, `search_path = ''` on every SECURITY
DEFINER function, a parallel set of policies, an assertion that only
whitelisted 2 reference tables instead of the real 8) **would have damaged
this database**, and that the real audit found RLS already enabled on all 27
tables, `owns_row()` already correct, all five SECURITY DEFINER functions
already pinning `search_path`, and all three storage buckets already scoped
correctly. The current file is deliberately small because of that — it is
only the genuine deltas, not a full rewrite. Do not reintroduce any of the
four things its own comments say were deliberately left out.

Production has never been audited (see step a2 — it doesn't have a schema
yet to audit). Once it's provisioned from the same schema and the same
migration, its posture will match staging's, but confirm with `report.sql`
after provisioning rather than assuming.

**a2. Provision production — SKIPPED, not needed.** Per the Environments update
above, there is no longer a separate empty production project to provision;
`doddeferfxzgdmzadibq` already carries the schema and the hardening migration.
The two scripts below (`capture-staging.ps1`, `provision-production.ps1`) are
kept and were both exercised and fixed on 2026-08-25 (the latter had a stale
hardcoded migration filename that silently skipped two real migrations --
fixed to apply every file in `supabase/migrations/` instead) so they're ready
to use if a second project ever becomes available. Read on for how they work,
but there is currently nothing to run here.

**First, authenticate once** with a personal access token from
<https://supabase.com/dashboard/account/tokens>:

```powershell
npx supabase login
```

**No Docker needed.** `supabase db dump` shells out to a containerised pg_dump,
but the scripts use pg_dump directly and pass `--use-api` to the function
commands, so nothing here touches Docker. One-time client install:

```powershell
wsl -d Ubuntu -- sudo apt update
```

```powershell
wsl -d Ubuntu -- sudo apt install -y postgresql-client
```

(WSL will prompt for your Ubuntu sudo password.)

**Then capture staging into git — this is read-only and urgent on its own:**

Use the **Session pooler** string (port 5432) from Dashboard -> Connect. The
transaction pooler (6543) cannot serve pg_dump, and the direct
`db.<ref>.supabase.co` host is IPv6-only on newer projects, which will not
resolve from WSL. Percent-encode any `@ : / ? # [ ] ;` in the password.

```powershell
$env:SUPABASE_DB_URL = "postgresql://postgres.doddeferfxzgdmzadibq:<pw>@...pooler.supabase.com:5432/postgres"
```

```powershell
.\scripts\capture-staging.ps1
```

It dumps the schema (structure only, no rows), roles and grants, and **downloads
all eight edge functions**. That last part matters beyond this migration: the
edge function source exists *only* inside the staging project right now. It is
not in git, so today a dashboard accident loses it permanently. Running this and
committing closes that gap whether or not you provision production.

Read `supabase/schema/public.sql` before going further — this is the moment to
notice anything in staging you don't want carried forward — and check the
downloaded functions for hardcoded secrets or staging URLs. Then commit
`supabase/`.

**Then build production:**

```powershell
.\scripts\provision-production.ps1
```

It refuses to run unless production still answers `404` on a known table, so it
cannot be pointed at a database that has real data (verified: production returns
404, staging returns 200 and would abort). It applies the schema, then the
hardening migration, then deploys the functions. **It copies no data.**

Three things the CLI does not carry. Production isn't usable until all three
are done by hand. (A fourth item, storage buckets, used to be listed here too
-- it isn't manual: `provision-production.ps1` applies
`supabase/schema/storage-policies.sql`, which creates `inventory-photos`,
`catch-photos`, and `gear-photos` -- all **private** -- before the RLS
hardening migration runs. Confirm all three show `public = false` in step 2d
rather than re-creating them.)

- **Edge function secrets.** Only `ask-atlas` needs one: `OPENAI_API_KEY` and
  `ATLAS_AI_MODEL`. The other seven functions hit free, keyless public
  endpoints (Open-Meteo for weather, MN/WI DNR ArcGIS and USGS for water
  data, Nominatim for place search) and need no secret at all. Without it,
  `ask-atlas` deploys fine and then silently falls back to its rules-based
  answer instead of an AI one — not a hard failure, but worth knowing which
  mode you're getting. **This is a live, current gap on `doddeferfxzgdmzadibq`
  right now**, not just future-provisioning scaffolding -- set it there today
  if AI-powered answers matter:
  ```powershell
  npx supabase secrets set OPENAI_API_KEY=... --project-ref doddeferfxzgdmzadibq
  npx supabase secrets set ATLAS_AI_MODEL=... --project-ref doddeferfxzgdmzadibq
  ```
- **Auth configuration.** Site URL, redirect allow-list, Google provider, rate
  limits, Turnstile — steps 2d and 6d. These differ per project; copying
  staging's values verbatim is wrong.
- **Reference data.** `waterbodies` ships empty, so water search returns nothing
  until it's seeded. This is the one table where you almost certainly *do* want
  staging's rows — dump it `--data-only` while linked to staging.

**Decide about the beta data.** Real angler data lives only in staging. Either
migrate it deliberately, or launch production clean and tell beta users their
history doesn't carry over. Both are defensible; drifting into it isn't.

**b. Apply the migration.** `supabase/migrations/20260824101705_harden_rls.sql`
is idempotent and wrapped in a transaction that aborts if anything is still
open (`commit` only runs if all three of its steps succeed). It does exactly
three things: revoke `anon`'s grants on every table/sequence (defence in
depth — RLS already returns zero rows to `anon`, this makes the tables
unreachable outright instead of merely empty); default `catches.owner_id` to
`auth.uid()` for consistency with `water_spots`/`mission_feedback`/
`fishing_sessions`, which already default it; and assert that posture (RLS
enabled everywhere except the PostGIS-owned `spatial_ref_sys` table, and no
`using (true)` policy on anything that isn't one of the 11 known shared
reference tables). If the assertion fails, the transaction rolls back and
tells you exactly which table or policy is wrong — nothing to pre-fill by
hand first.

One thing to expect: applying the `catches.owner_id` default is a no-op if
it's already set (the migration checks first and logs which happened), so
running it more than once is safe.

**c. Prove it.** This is the step that turns "policies exist" into "no user can
reach another user's data". Run it against each project in turn by pointing
`FISHWIZZ_SUPABASE_URL` / `FISHWIZZ_SUPABASE_KEY` at that project:

```powershell
node --env-file=.env .\scripts\rls-probe.mjs
```

The probe must pass against **production** too, not just staging — production is
the one holding real anglers' data, and it is the project this audit has never
been run against.

Needs two throwaway accounts in `.env` (`FISHWIZZ_PROBE_A_*`, `FISHWIZZ_PROBE_B_*`),
created separately in each project.
Seed both with a catch and some gear first, and seed account A in every
per-user table, or checks come back inconclusive. Inconclusive now exits
nonzero. Once the plain run has zero inconclusive checks, run:

```powershell
node --env-file=.env .\scripts\rls-probe.mjs --destructive
```

The destructive mode probes cross-tenant UPDATE and DELETE. It is opt-in
because the DELETE would remove account A's test row if RLS were broken.

**d. Dashboard settings.**

- **Authentication → Sessions:** enable **refresh token rotation** and **reuse
  detection**.
- **Authentication → Rate limits:** tighten sign-in, sign-up, and OTP.
- **Authentication → Attack protection:** enable **CAPTCHA (Cloudflare
  Turnstile)** and paste the secret from step 5. This is the real fix for
  credential-stuffing and signup abuse — see the note in step 5 about why the
  Cloudflare WAF can't do it.
- **Storage:** confirm `inventory-photos`, `catch-photos`, and `gear-photos`
  all show `public = false` after the migration.
- **Edge Functions:** confirm weather/water provider keys are set as secrets and
  never echoed into a response body.

---

## 3. Legal pages — before step 6

`public/privacy.html` and `public/terms.html` are drafted and live at
`/privacy.html` and `/terms.html`.

**Legal review deliberately skipped for now (2026-08-25, user's call)** --
the pages ship as drafted, unreviewed. A real risk for a real public launch
with real user data; the user's own call to make and defer, not this
session's to push back on. Get a lawyer's pass on GDPR legal bases,
limitation of liability, and governing law (currently assuming Minnesota). Also
create and monitor `privacy@fishwizz.com` and `support@fishwizz.com` — both are
cited in the documents and Google checks that the privacy URL resolves.

---

## 4. DNS and Cloudflare security 🔑

There are two Pages projects and this step touches both:

1. In the **app** Pages project (built from this repo), Custom domains → add
   `app.fishwizz.com` (`scripts/cf-fix-domain.ps1` diagnoses/repairs this
   attachment if it doesn't take). In the **marketing** Pages project
   (`fishwizz-web`, built from `marketing/`), Custom domains → add
   `www.fishwizz.com` (`scripts/cf-setup-marketing.ps1` does this end to end).
2. Add a **Redirect Rule**: `fishwizz.com/*` → `https://www.fishwizz.com/$1`,
   301 — the apex sends visitors to the marketing site, not the app. This is
   a UX nicety, not an auth requirement: the app's own Google sign-in flow
   starts and ends entirely at `app.fishwizz.com` (a user reaches it via a
   normal link from marketing, a fresh navigation, before ever starting
   sign-in), so the PKCE code verifier never needs to survive an apex→www
   origin change the way an earlier version of this plan assumed.
3. SSL/TLS → **Full (strict)**, minimum TLS **1.2**, **Always Use HTTPS**,
   **Automatic HTTPS Rewrites** — apply to both projects.
4. Enable **Bot Fight Mode** and **Web Analytics** (cookieless) — both projects.
5. Add a rate-limiting rule on the site origin — the app matters most here,
   since it's the one fronting Supabase auth/API traffic.
6. HSTS: start at a **low max-age** and ramp up. Don't enable preload until
   you're certain — it is effectively irreversible.

### What Cloudflare can and cannot protect

The browser talks to `<ref>.supabase.co` **directly**. PostgREST and GoTrue
traffic never traverses Cloudflare, so a WAF rule on `/auth` or
`/rest/v1/rpc/...` at `fishwizz.com` does nothing — the original assessment's
proposed fix for this gap doesn't work as written. What actually closes it is
Supabase's own Turnstile support and rate limits (step 2d).

If abuse ever materialises, the real option is a Cloudflare Worker at
`api.fishwizz.com` proxying to Supabase, which would put a genuine WAF in front
of PostgREST. It costs a hop and a moving part; don't build it pre-emptively.

---

## 5. Turnstile 🔑

**Frontend side is done.** `src/runtime/turnstile.js` renders a Turnstile
widget above the Log In / Create account buttons and passes its token as
`captchaToken` on both `signInWithPassword` and `signUp`. It's driven entirely
by `VITE_TURNSTILE_SITE_KEY`: blank (the default), it loads no script and
sends no token, so it's already deployed and inert. Verified end-to-end
locally with Cloudflare's public always-pass test site key
(`1x00000000000000000000AA`) — widget rendered, challenge auto-passed, token
reached the API call.

**Done, confirmed 2026-08-25.** All three items below turned out to already
be complete, contradicting this section's own "still needed" framing --
verified directly rather than assumed:

1. A real Turnstile widget exists (`VITE_TURNSTILE_SITE_KEY` in `.env` is
   `0x4AAAAAAEbpjrC7KkmOi31L`, not the always-pass test key from local
   verification above).
2. That site key is live in the deployed bundle --
   `https://fishwizz-e7d.pages.dev/assets/main.*.js` contains the literal
   key string, confirming `cf-setup-pages.ps1` picked it up from `.env` the
   same way it picked up `VITE_SENTRY_DSN`.
3. The **secret** key is set in Supabase: the Management API's
   `config/auth` response shows `security_captcha_enabled: true` and
   `security_captcha_provider: "turnstile"` on `doddeferfxzgdmzadibq`.

CAPTCHA is fully enforced end-to-end, not just wired and inert.

The CSP (`public/_headers.template`) already allows
`https://challenges.cloudflare.com` for `script-src`/`frame-src` -- the one
deliberate third-party origin in the policy, added for this reason alone.

---

## 6. Google sign-in 🔑

**Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID
(Web application):**

| Field | Value |
|---|---|
| Authorized JavaScript origins | `https://app.fishwizz.com`, plus `https://staging.fishwizz.com` if you add one |
| Authorized redirect URIs | `https://doddeferfxzgdmzadibq.supabase.co/auth/v1/callback` |

**The redirect URI is the Supabase callback, not your app URL.** This is the
single most common way this is misconfigured.

Only one project's callback exists to register now (see the Environments
update near the top of this file) -- if a real separate production project
ever gets provisioned later, add its callback here too rather than replacing
this one; Google allows multiple redirect URIs on one client.

**OAuth consent screen:** external, app name FishWizz, support email, privacy
policy `https://app.fishwizz.com/privacy.html`, terms
`https://app.fishwizz.com/terms.html` — these are served from the app's Pages
project (they live in `public/`, not `marketing/`), and marketing's own footer
already links there. Request only `email`, `profile`, `openid`
— all non-sensitive, so no Google verification review is required, but the URLs
must resolve. Publish it (leaving it in Testing caps you at 100 users and expires
refresh tokens after 7 days).

**6c. Supabase → Authentication → Providers → Google:** enable on
`doddeferfxzgdmzadibq`, pasting in the Client ID and Secret.

**6d. Supabase → Authentication → URL Configuration — partially done.** With one
project now serving both roles, this is one set of settings, not two per-project
sets. `site_url` and `uri_allow_list` were already updated via the Management
API on 2026-08-25 to add `app.fishwizz.com` alongside the existing staging/
preview entries (not replacing them):

- Site URL: `https://app.fishwizz.com` (was the staging Pages URL; changed
  because `{{ .SiteURL }}` in email templates should point real users at the
  real app)
- Redirect URLs (current): `https://staging.fishwizz-e7d.pages.dev/**`,
  `https://*.fishwizz-e7d.pages.dev/**`, `https://app.fishwizz.com/**`

**Still needed by hand:** add `https://localhost/**` for the Capacitor mobile
wrapper, and `http://localhost:5173/**` / `http://localhost:4173/**` for local
dev, if not already covered.

**The tradeoff this creates, stated plainly:** because it's the same project,
anyone running the app locally against `.env` (which points here) or from a
preview deploy can now complete a sign-in that is indistinguishable from a
real production sign-in -- there is no separate project left to keep
`localhost` out of. This is the direct consequence of the single-project
decision, not a new mistake; see the Environments section for the full
tradeoff.

### One decision to make: PKCE vs. email confirmation

With `flowType: 'pkce'`, a signup confirmation link clicked on a **different
device** fails, because the code verifier lives in the originating browser. A
user who signs up on a laptop and opens the email on their phone will hit an
error.

**Runtime side is done.** `src/runtime/index.js` now calls
`supabase.auth.verifyOtp({ token_hash, type })` on boot whenever the URL
carries `?token_hash=...&type=...`, before the legacy scripts run. It handles
both outcomes: on success it shows "Email confirmed" and opens the Mission
page; on an expired/reused link it shows a plain-language error in the global
status bar (visible on every page, not just Account) and tells the user to
try signing in or re-registering. Verified against the real Supabase endpoint
with a deliberately bogus token — got back a real `403 otp_expired` and
surfaced it correctly. If the URL carries no `token_hash`, this is a total
no-op, so it's safe to ship ahead of the template change below.

**Still needed from you 🔑:** change the Supabase **Confirm signup** email
template to

```
{{ .SiteURL }}/?token_hash={{ .TokenHash }}&type=email
```

Until that template change is made, confirmation links keep using the old
PKCE `?code=` format and this new code path is simply never triggered — no
risk in deploying it early. The alternatives — disabling email confirmation
for the beta, or switching to implicit flow (which puts tokens in the URL
fragment) — are both worse.

---

## 7. Enforce the CSP

The CSP currently ships as `Content-Security-Policy-Report-Only` so a mistake
can't take the site down on cutover day. After a deploy's worth of real traffic,
review the reports, then in `public/_headers.template` rename the header to
`Content-Security-Policy` and redeploy.

Known and accepted: `style-src` needs `'unsafe-inline'` because eight modules
inject `<style>` elements at runtime. Removing that is its own project.

---

## 7b. Transactional email (SMTP) — launch blocker

**Deliberately skipped for now (2026-08-25, user's call).** The consequence
was stated plainly before this was decided, not just silently accepted: real
signups work at first (Supabase's built-in sender allows a couple emails/hour)
and then start returning `429 email rate limit exceeded`, which looks like
the app is broken rather than a config gap. Acceptable for a slow trickle of
users landing at `fishwizz-e7d.pages.dev`, not for anything that should be
called a real public launch. Revisit this before driving real traffic volume
at the site — the steps below are unchanged and ready whenever that happens.

Supabase`s built-in email sender allows only a couple of messages per hour and
is explicitly not for production. Without custom SMTP most people who try to
sign up simply cannot: the signup returns HTTP 429 `email rate limit exceeded`.
That is not a corner case — it is what made account creation appear to fail
silently on production.

**The current SPF record is `v=spf1 -all`** — literally *this domain sends no
mail*. Until that changes, every confirmation email is legitimately rejected by
the recipient, no matter which provider you configure.

### 1. Pick a provider and add the domain

Resend, Postmark, SES, Mailgun and SendGrid all work. Add `fishwizz.com` in the
provider dashboard; it will show you DKIM records unique to your domain.

### 2. Save the DKIM records it shows

```json
[
  { "type": "CNAME", "name": "resend._domainkey", "content": "..." }
]
```

### 3. Apply the DNS

```powershell
.scriptscf-setup-email-dns.ps1 -Provider resend -DkimFile .dkim.json -WhatIf
```

```powershell
.scriptscf-setup-email-dns.ps1 -Provider resend -DkimFile .dkim.json
```

It updates SPF **in place** rather than adding one — two SPF records is a hard
failure, not a warning — writes a monitor-only DMARC, and leaves DKIM CNAMEs
unproxied (an orange-clouded DKIM record returns Cloudflare`s answer and the
signature check fails).

### 4. Configure SMTP in Supabase — on BOTH projects

Project Settings → Authentication → SMTP Settings → Enable custom SMTP.
Sender `no-reply@fishwizz.com`, port 587 with STARTTLS unless told otherwise.

Staging sends confirmation emails too. A beta tester hitting the built-in
limiter fails in exactly the way this is meant to fix.

Then raise Authentication → Rate Limits, which stay low even after SMTP is set.

### 5. Prove it before trusting it

Sign up with a real address, confirm the mail arrives and is **not** in spam,
and check the headers show `dkim=pass` and `spf=pass` (Gmail: Show original).
Only then tighten SPF to `-all` and raise DMARC to `p=quarantine`.

---
## 8. Monitoring 🔑

**Client-side JS side is done.** `src/runtime/sentry.js` (`@sentry/browser`,
now a real dependency) initializes only when `VITE_SENTRY_DSN` is set --
blank, it's a complete no-op, no script load, no network, safe to have
shipped ahead of this step. It registers `captureConsoleIntegration`, so
every `console.error(...)` already scattered through `public/` becomes a
Sentry event with no further wiring -- see the note below. `beforeSend`/
`beforeBreadcrumb` scrub latitude, longitude, user email, and the
`fishwizz.auth` session (by storage-key name and by JWT shape, so it's still
caught if it reaches a breadcrumb some other way) before anything leaves the
browser.

**Items 1 and 2 below are done (2026-08-25).** A Sentry project exists,
`VITE_SENTRY_DSN` is confirmed set on both the Production and Preview
environments of the `fishwizz` Cloudflare Pages project (verified via the
API, not just assumed from the script exiting 0), and its ingest origin
(`https://o4511973160845312.ingest.us.sentry.io`) is live in `connect-src`
on the deployed site -- checked both in the built `dist/_headers` and in the
actual response headers from `https://fishwizz-e7d.pages.dev/`. The bundle
also carries the real DSN, confirming `npm run build` picked it up from
`.env` via `scripts/cf-setup-pages.ps1`'s new `Get-DotEnvVar` helper (which
also fixed a pre-existing bug: `$env:$Name` is not valid PowerShell variable
expansion, so the old Turnstile-only version of this lookup silently never
worked from the shell env, only from `.env`).

**Item 3, code side done (2026-08-25).** `supabase/functions/_shared/sentry.ts`
mirrors the client file: a no-op until the `SENTRY_DSN` function secret is
set, same scrub list (lat/lon, email, bearer tokens/JWTs) applied
server-side via `beforeSend`. All 8 edge functions now import
`reportError(e, {function:'...'})` and call it from their catch block. Three
functions (`atlas-live-water`, `atlas-water-catalog`, `atlas-weather`) had no
top-level try/catch at all before this -- added one around each handler body
so an uncaught error gets both a real 500 response and a Sentry event
instead of whatever the runtime does with an unhandled rejection.

**Still needed from you 🔑, to make it live rather than just written:**

3a. Set the secret (same DSN as `VITE_SENTRY_DSN`, its Sentry project org
    supports both a browser and a server key on one DSN):
    ```powershell
    npx supabase secrets set SENTRY_DSN=... --project-ref doddeferfxzgdmzadibq
    ```
3b. Deploy the 8 functions so the new code (and the secret) actually take
    effect:
    ```powershell
    npx supabase functions deploy --project-ref doddeferfxzgdmzadibq
    ```
    Both are live-production actions on real traffic -- confirm before
    running them, don't just assume the code sitting in git is equivalent to
    it being deployed.
4. UptimeRobot or Cloudflare Health Checks for uptime, separate from error
   monitoring.

The 13 bare `catch{}` blocks this note used to list (`account-isolation.js`
×4, `gear-catalog.js`, `inventory-pro.js` ×2, `mission-condition-qa.js`,
`mission-inventory-fit.js`, `mission-v3.js`, `onboarding.js`, `session-pro.js`,
`water-brief.js`) are fixed -- a fresh sweep found 5 of those 9 files had
already picked up logging in other commits since this was written, and found
5 more silent ones this list never named (`angler-profile.js`, `today.js` x2,
`waters-pro.js` x2, `water-search.js` x2) plus 3 that were dead code
(bare-identifier writes a non-strict classic script can never actually throw)
removed outright rather than logged. All now follow the same
`console.error('FishWizz: ...', e)` convention, which is exactly what
`captureConsoleIntegration` above picks up.

Run a full week under monitoring before submitting to either app store.

---

## 9. App stores

- **Google Play** ($25 one-time): Bubblewrap/TWA is the simpler path.
- **Apple** ($99/yr): needs a Mac + Xcode via Capacitor. `native/capacitor.config.ts`
  now points at `../dist`. Budget one rejection cycle — Guideline 4.2 targets
  thin WebView wrappers, though the camera gear intake and geolocation Mission
  building should clear it.

Both stores require the privacy policy URL and an in-app account deletion path.
Deletion already exists (`delete-my-account`), and the policy is step 3.

---

## Still open

| Item | Status |
|---|---|
| `report.sql` output | **Done 2026-08-25** -- ran clean against `doddeferfxzgdmzadibq`. RLS enabled on all 28 real tables, exactly one tightly owner-scoped policy each (`owns_row()`/`auth.uid()`), `spatial_ref_sys` the one documented PostGIS exception. All 4 storage buckets private, including `uploads` (see below). No new gaps found; matches the posture already documented in step 2. |
| The `uploads` storage bucket | Confirmed real (not just orphaned policies) and correctly private, with the same size/mime-type limits as the other three -- but unreferenced anywhere in the app code. Harmless as-is; low-priority cleanup (drop it, or wire it in) whenever someone remembers what it was for. |
| Legal review | **Deliberately skipped for now (2026-08-25, user's call).** Pages ship as drafted, unreviewed. Real risk for a real launch; deferred, not forgotten. |
| `spatial.js` | **Done 2026-08-25**, as its own change per this row's original instruction. Confirmed genuinely unreferenced anywhere (not in the LEGACY chain, not in any `pwa.js` group) before touching it. Added to `pwa.js`'s `mission` group alongside the other Mission-page enhancement modules -- renders a "Spatial Mentor" card (compass bearing to the selected water, first-cast/second-cast guidance, wind relation) after `#planSummary` once a position and water are both selected. Verified end-to-end in a live dev server: loads with no console errors, correct placeholder with no position selected, and correct bearing math with one (58.1° computed for a real coordinate pair, bucketed to the right compass direction) |
| `OPENAI_API_KEY` / `ATLAS_AI_MODEL` | **Declined by choice (2026-08-25), to minimize cost.** A key was generated and verified to authenticate correctly, but the OpenAI account has no funded API credits (ChatGPT subscription doesn't cover API usage -- separate billing). User chose not to add credits rather than pursue it further. `ask-atlas` stays in its rules-based fallback -- verified working, not degraded -- until this is revisited. The model name given (`gpt-5.6-luna`) was never actually validated against a real request, since billing failed first; re-check it against a real model name at platform.openai.com/docs/models whenever this gets revisited. |
| CAPTCHA (Turnstile) | **Confirmed live end-to-end, 2026-08-25** -- real site key deployed in the bundle, secret enabled on `doddeferfxzgdmzadibq` (`security_captcha_enabled: true`). Not just wired, actually enforcing. |
| `site_url` (Supabase Auth) | **Confirmed correct, 2026-08-25** -- `https://fishwizz-e7d.pages.dev`, `uri_allow_list` has all four expected entries. The regression flagged in the launch addendum above is not currently real. |
| Monitoring (Sentry) | **Client-side live as of 2026-08-25** -- DSN set on Cloudflare Pages (both environments, verified via API), CSP `connect-src` carries the ingest origin, confirmed in the deployed response headers and bundle. **Edge Functions: code written and committed 2026-08-25** (`_shared/sentry.ts`, wired into all 8 functions) but not yet deployed or given a `SENTRY_DSN` secret -- see step 8 item 3a/3b. |
| Transactional email (SMTP) | **Deliberately skipped for now (2026-08-25, user's call).** Signups cap out on Supabase's built-in limiter (a couple/hour) -- fine for a trickle of early users, not for real public traffic volume. Needs an email provider account (recommended: Resend) whenever this gets revisited. |
| DNS cutover / Cloudflare security hardening | Not started (step 4) |
