# FishWizz — deployment and hardening runbook

Everything in this file needs credentials I don't have. The code side is done
and committed; this is the part you run.

Order matters. Steps 1–4 are safe to do now against a preview URL. **Step 4 (DNS)
is the cutover.** Step 3 must be finished before step 6, because the Google
consent screen needs published legal URLs.

---

## Environments

| | Supabase project | Serves |
|---|---|---|
| **Production** | `usanapexwjssjscmdjwv.supabase.co` | `app.fishwizz.com` |
| **Staging** | `doddeferfxzgdmzadibq.supabase.co` | preview deploys and local dev |

The app and the marketing site are two separate Cloudflare Pages projects:
the app (this repo, `npm run build` → `dist/`) deploys to `app.fishwizz.com`
via `scripts/cf-setup-pages.ps1`; the marketing site (`marketing/`) deploys
to `www.fishwizz.com` via `scripts/cf-setup-marketing.ps1`. Keep that straight
in every step below — attaching `www.fishwizz.com` to the app's Pages project,
or registering it as the app's origin with Google/Supabase, points real
traffic and OAuth at the wrong project.

Nothing in the code names either project — the URL and key come from
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON` at build time. Switching environments
is a config change.

### The production project is empty

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

The build fails if the origin in the CSP disagrees with the origin baked into the
bundle. A half-changed environment would otherwise ship an app whose every API
call is blocked by `connect-src` — which looks like an outage rather than a
config mistake.

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

## 1. Cloudflare Pages 🔑

Create a Pages project connected to `skunze98/Atlas-Fishing-OS`:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | `20` or newer |

Under **Settings → Environment variables**, set the two environments to *different
projects*. This is the whole point of the Pages Production/Preview split — every
preview deploy and every branch automatically exercises staging, and only `main`
touches production.

**Production environment** (branch `main`):

```
VITE_SUPABASE_URL=https://usanapexwjssjscmdjwv.supabase.co
VITE_SUPABASE_ANON=sb_publishable_8tYJUy-EeJS1jsXSyb90Bw_Rr1Hg2ck
```

(Key verified against the project: it authenticates to `usanapexwjssjscmdjwv`
and is correctly rejected by staging.)

**Preview environment** (every other branch):

```
VITE_SUPABASE_URL=https://doddeferfxzgdmzadibq.supabase.co
VITE_SUPABASE_ANON=sb_publishable_aRBM4TvuGEUAdOZazPoZLw_CXdoEtpp
```

The publishable key is public by design — it identifies the project, it doesn't
authorize anything. Row Level Security (step 2) is what protects the data.

If you want a stable staging URL rather than per-commit preview URLs, add
`staging.fishwizz.com` as a custom domain bound to a long-lived `staging` branch.
It picks up the Preview environment variables automatically.

**Do not test production on a `*.pages.dev` production URL and assume it's
harmless** — the production deploy talks to the production database regardless of
which hostname you reached it through.

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

**a2. Provision production.** Production is empty, so there is nothing to harden
there yet. Two scripts do this; the CLI is pinned as a devDependency, so no
global install.

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
  mode you're getting.
  ```powershell
  npx supabase secrets set OPENAI_API_KEY=... --project-ref usanapexwjssjscmdjwv
  npx supabase secrets set ATLAS_AI_MODEL=... --project-ref usanapexwjssjscmdjwv
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

**They have not been legally reviewed.** Get a lawyer's pass on GDPR legal bases,
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

Create a Turnstile widget for `fishwizz.com`. Put the **secret** in Supabase
(step 2d) — that's what enforces it on the auth endpoints themselves rather than
just in the UI, which is what makes it worth doing.

---

## 6. Google sign-in 🔑

**Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID
(Web application):**

| Field | Value |
|---|---|
| Authorized JavaScript origins | `https://app.fishwizz.com`, plus `https://staging.fishwizz.com` if you add one |
| Authorized redirect URIs | `https://usanapexwjssjscmdjwv.supabase.co/auth/v1/callback` **and** `https://doddeferfxzgdmzadibq.supabase.co/auth/v1/callback` |

**The redirect URI is the Supabase callback, not your app URL.** This is the
single most common way this is misconfigured.

**Both project callbacks go on one OAuth client.** Google allows multiple
authorized redirect URIs, so a single client covers production and staging. If
you register only the production one, Google sign-in works on `app` and fails on
every preview deploy with `redirect_uri_mismatch` — which reads like a code bug
and isn't.

Then enable the provider in **both** Supabase projects (step 6c), pasting the
same Client ID and Secret into each.

**OAuth consent screen:** external, app name FishWizz, support email, privacy
policy `https://app.fishwizz.com/privacy.html`, terms
`https://app.fishwizz.com/terms.html` — these are served from the app's Pages
project (they live in `public/`, not `marketing/`), and marketing's own footer
already links there. Request only `email`, `profile`, `openid`
— all non-sensitive, so no Google verification review is required, but the URLs
must resolve. Publish it (leaving it in Testing caps you at 100 users and expires
refresh tokens after 7 days).

**6c. Supabase → Authentication → Providers → Google:** enable in **both**
projects, pasting the same Client ID and Secret into each.

**6d. Supabase → Authentication → URL Configuration** — these differ per project,
and getting them backwards is how a staging sign-in silently redirects a tester
into production:

*Production project (`usanapexwjssjscmdjwv`):*

- Site URL: `https://app.fishwizz.com`
- Redirect URLs: `https://app.fishwizz.com/**`, and `https://localhost/**` (the
  Capacitor origin, for the mobile wrappers)

*Staging project (`doddeferfxzgdmzadibq`):*

- Site URL: `https://staging.fishwizz.com` if you add one, otherwise your Pages
  preview domain
- Redirect URLs: `https://staging.fishwizz.com/**`,
  `https://<your-project>.pages.dev/**` (covers preview deploys),
  `http://localhost:5173/**` and `http://localhost:4173/**` for local dev

Keep `localhost` out of the production project's allow-list. It is the one entry
that lets a locally-running page complete a real production sign-in.

### One decision to make: PKCE vs. email confirmation

With `flowType: 'pkce'`, a signup confirmation link clicked on a **different
device** fails, because the code verifier lives in the originating browser. A
user who signs up on a laptop and opens the email on their phone will hit an
error.

Recommended fix: change the Supabase **Confirm signup** email template to

```
{{ .SiteURL }}/?token_hash={{ .TokenHash }}&type=email
```

and I'll add the matching `verifyOtp()` call to the runtime. That's
device-independent and correct. The alternatives — disabling email confirmation
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

Sentry (npm, now that there's a build step) for client JS and Edge Functions,
plus UptimeRobot or Cloudflare Health Checks.

**`beforeSend` must scrub latitude, longitude, user email, and the
`fishwizz.auth` localStorage key.** This app handles precise GPS; leaking
coordinates to a third party would contradict the privacy policy on day one.

Also worth doing in the same pass: the 13 bare `catch{}` blocks across
`account-isolation.js` (×4), `gear-catalog.js`, `inventory-pro.js` (×2),
`mission-condition-qa.js`, `mission-inventory-fit.js`, `mission-v3.js`,
`onboarding.js`, `session-pro.js` and `water-brief.js` swallow failures —
including authorization failures — so monitoring won't see them until they're
logged.

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

| Item | Why it's not done |
|---|---|
| `report.sql` output | Needs your Supabase access; the migration's section 6 depends on it |
| Legal review | Needs a lawyer |
| `spatial.js` | Dead since a rename; it has **never executed in production**. Wiring it in belongs in its own change, not a hosting migration |
