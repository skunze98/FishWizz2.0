# Create the Pages project, set env vars, attach app.fishwizz.com, and deploy.
#
#   $env:CLOUDFLARE_API_TOKEN  = "..."
#   $env:CLOUDFLARE_ACCOUNT_ID = "..."      # optional; discovered if omitted
#   .\scripts\cf-setup-pages.ps1
#
# Idempotent: re-running updates rather than duplicating.
#
# WHY DIRECT UPLOAD RATHER THAN A GIT CONNECTION:
#   Connecting a Pages project to GitHub requires installing the Cloudflare
#   GitHub App, which is an OAuth flow the API cannot perform on your behalf.
#   Direct upload needs no GitHub connection at all -- it ships the dist/ that
#   `npm run build` just produced. You can attach Git later in the dashboard;
#   the project, its domain and its variables all survive that.
#
# Token scopes (https://dash.cloudflare.com/profile/api-tokens):
#   Account -> Cloudflare Pages -> Edit
#   Zone    -> DNS              -> Edit     (Pages writes the CNAME for the domain)
#   Zone    -> Zone             -> Read
#   Zone Resources: Include -> Specific zone -> fishwizz.com

$ErrorActionPreference = 'Stop'

$ProjectName = 'fishwizz'
$Hostname    = 'app.fishwizz.com'
# usanapexwjssjscmdjwv was meant to be a separate, empty production project
# (see DEPLOYMENT.md's original Environments table) but the account it was
# created under turned out to be inaccessible, and the Supabase plan in use
# only allows one project. Production and Preview now BOTH point at the
# staging project -- already hardened, already holding the real beta data --
# rather than at a second project that was never reachable. This is a
# deliberate, accepted tradeoff (recorded in DEPLOYMENT.md), not an oversight:
# every preview deploy and local `npm run dev` now shares the same database
# as real public traffic.
$ProdUrl     = 'https://doddeferfxzgdmzadibq.supabase.co'
$ProdKey     = 'sb_publishable_aRBM4TvuGEUAdOZazPoZLw_CXdoEtpp'
$StageUrl    = 'https://doddeferfxzgdmzadibq.supabase.co'
$StageKey    = 'sb_publishable_aRBM4TvuGEUAdOZazPoZLw_CXdoEtpp'

if (-not $env:CLOUDFLARE_API_TOKEN) {
  Write-Host 'CLOUDFLARE_API_TOKEN is not set.' -ForegroundColor Red; exit 1
}

$H = @{ Authorization = "Bearer $($env:CLOUDFLARE_API_TOKEN)"; 'Content-Type' = 'application/json' }
$Api = 'https://api.cloudflare.com/client/v4'

function Invoke-CF {
  param([string]$Path, [string]$Method = 'GET', $Body = $null, [switch]$AllowFail)
  $p = @{ Uri = "$Api$Path"; Headers = $H; Method = $Method; UseBasicParsing = $true }
  if ($Body) { $p.Body = ($Body | ConvertTo-Json -Depth 12 -Compress) }
  try { return ((Invoke-WebRequest @p).Content | ConvertFrom-Json) }
  catch {
    # PowerShell 5.1 usually puts the response body in ErrorDetails.Message.
    # The response stream is often already consumed by then, so try that first
    # -- reading the stream alone silently produced an empty error.
    $detail = $_.ErrorDetails.Message
    if (-not $detail -and $_.Exception.Response) {
      try { $detail = (New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd() } catch {}
    }
    if ($AllowFail) { $script:LastCFError = $detail; return $null }
    Write-Host "API call failed: $Method $Path" -ForegroundColor Red
    if ($detail) { Write-Host "  $detail" -ForegroundColor Red }
    else { Write-Host "  (no response body; status $($_.Exception.Response.StatusCode.value__))" -ForegroundColor Red }
    exit 1
  }
}

Write-Host '==> Verifying token' -ForegroundColor Cyan
$v = Invoke-CF '/user/tokens/verify'
if (-not $v.success) { Write-Host '  invalid token' -ForegroundColor Red; exit 1 }
Write-Host "    $($v.result.status)"

$acct = $env:CLOUDFLARE_ACCOUNT_ID
if (-not $acct) {
  # Prefer deriving the account from the zone. Listing /accounts requires
  # "Account Settings: Read", which is a SEPARATE permission from Pages access
  # -- a token can be fully able to manage Pages in an account while being
  # unable to enumerate that account. The zone object carries account.id, and
  # we already need Zone:Read.
  $z = Invoke-CF "/zones?name=fishwizz.com" -AllowFail
  if ($z -and $z.result -and $z.result.Count -gt 0 -and $z.result[0].account.id) {
    $acct = $z.result[0].account.id
    Write-Host "    account $acct  (from zone fishwizz.com)"
  }
}
if (-not $acct) {
  $a = Invoke-CF '/accounts' -AllowFail
  if ($a -and $a.result -and $a.result.Count -eq 1) {
    $acct = $a.result[0].id
    Write-Host "    account $acct  ($($a.result[0].name))"
  } elseif ($a -and $a.result -and $a.result.Count -gt 1) {
    Write-Host '  Multiple accounts; set CLOUDFLARE_ACCOUNT_ID to pick one:' -ForegroundColor Yellow
    $a.result | ForEach-Object { "    $($_.id)  $($_.name)" }
    exit 1
  }
}
if (-not $acct) {
  Write-Host '  Could not determine the account id.' -ForegroundColor Red
  Write-Host ''
  Write-Host '  This is normal: enumerating /accounts needs "Account Settings: Read",'
  Write-Host '  which is separate from Pages access. You do not need to add it --'
  Write-Host '  just supply the id directly. It is in any dashboard URL:'
  Write-Host '    https://dash.cloudflare.com/<ACCOUNT_ID>/...'
  Write-Host ''
  Write-Host '    $env:CLOUDFLARE_ACCOUNT_ID = "<that id>"'
  Write-Host ''
  Write-Host '  If the zone lookup also came back empty, the token is missing'
  Write-Host '  Zone -> Zone -> Read on fishwizz.com.'
  exit 1
}

# --- project ----------------------------------------------------------------
Write-Host ''
Write-Host '==> Checking Pages permission' -ForegroundColor Cyan
# Probe the list endpoint first. Without this, a permission failure is
# indistinguishable from "project does not exist" -- the script would sail past
# it and report a confusing error from the create call instead.
$script:LastCFError = $null
$list = Invoke-CF "/accounts/$acct/pages/projects" -AllowFail
if (-not $list -or -not $list.success) {
  if ($script:LastCFError -match '"code":\s*10000' -or $script:LastCFError -match 'Authentication error') {
    Write-Host '    DENIED -- the token cannot access Pages on this account.' -ForegroundColor Red
    Write-Host ''
    Write-Host '    Zone permissions do not cover Pages, and a token missing this one'
    Write-Host '    still verifies as "active", which is why it got this far.'
    Write-Host ''
    Write-Host '    Fix at https://dash.cloudflare.com/profile/api-tokens -> edit the token:'
    Write-Host '      Permissions:'
    Write-Host '        Account -> Cloudflare Pages -> Edit'
    Write-Host '      Account Resources:'
    Write-Host "        Include -> the account 7d9f595d487674d0231766c993c3cc59"
    Write-Host ''
    Write-Host '    Both halves matter. Adding the permission while leaving Account'
    Write-Host '    Resources unset produces exactly this error.'
    exit 1
  }
  Write-Host '    could not list Pages projects:' -ForegroundColor Red
  if ($script:LastCFError) { Write-Host "      $script:LastCFError" -ForegroundColor Red }
  exit 1
}
Write-Host "    ok ($($list.result.Count) existing project(s))"

Write-Host ''
Write-Host "==> Pages project '$ProjectName'" -ForegroundColor Cyan
$proj = Invoke-CF "/accounts/$acct/pages/projects/$ProjectName" -AllowFail

# Only affects a build Cloudflare itself triggers (e.g. if this project is
# ever attached to Git) -- this deploy uses direct upload, so the value that
# actually ends up in the bundle comes from .env / the shell during the
# `npm run build` below. Set here too so the two don't drift if that changes.
$TurnstileSiteKey = if ($env:VITE_TURNSTILE_SITE_KEY) { $env:VITE_TURNSTILE_SITE_KEY }
  elseif (Test-Path '.env') { ([regex]::Match((Get-Content '.env' -Raw), '(?m)^VITE_TURNSTILE_SITE_KEY=(\S*)$')).Groups[1].Value } else { '' }

$envVars = @{
  VITE_SUPABASE_URL  = @{ type = 'plain_text'; value = $ProdUrl }
  VITE_SUPABASE_ANON = @{ type = 'plain_text'; value = $ProdKey }
}
$previewVars = @{
  VITE_SUPABASE_URL  = @{ type = 'plain_text'; value = $StageUrl }
  VITE_SUPABASE_ANON = @{ type = 'plain_text'; value = $StageKey }
}
if ($TurnstileSiteKey) {
  # A Turnstile SITE key is public by design (same as the Supabase publishable
  # key above) -- safe to set on both environments even though CAPTCHA is
  # currently enforced against the one merged project either way.
  $envVars.VITE_TURNSTILE_SITE_KEY = @{ type = 'plain_text'; value = $TurnstileSiteKey }
  $previewVars.VITE_TURNSTILE_SITE_KEY = @{ type = 'plain_text'; value = $TurnstileSiteKey }
}
$deployCfg = @{
  production = @{ env_vars = $envVars }
  preview    = @{ env_vars = $previewVars }
}

if ($proj -and $proj.success) {
  Write-Host '    exists -- updating environment variables'
  Invoke-CF "/accounts/$acct/pages/projects/$ProjectName" 'PATCH' @{ deployment_configs = $deployCfg } | Out-Null
} else {
  # Create with the minimum the API accepts, then PATCH the configuration.
  # Creating with deployment_configs inline is rejected by some API versions,
  # and a combined failure gives no clue which half was at fault.
  Write-Host '    creating (direct upload)'
  $created = Invoke-CF "/accounts/$acct/pages/projects" 'POST' @{
    name              = $ProjectName
    production_branch = 'production-readiness'
  } -AllowFail

  if (-not $created -or -not $created.success) {
    Write-Host '    create failed:' -ForegroundColor Red
    if ($script:LastCFError) { Write-Host "      $script:LastCFError" -ForegroundColor Red }
    Write-Host ''
    Write-Host '    Most likely causes:' -ForegroundColor Yellow
    Write-Host '      * Token lacks Account -> Cloudflare Pages -> Edit. Zone scopes are'
    Write-Host '        not enough, and this is the one that is easy to miss because the'
    Write-Host '        token still verifies as active.'
    Write-Host '      * Account Resources on the token does not include this account.'
    Write-Host "      * A project named '$ProjectName' already exists but is not visible"
    Write-Host '        to this token.'
    Write-Host ''
    Write-Host '    Creating it once in the dashboard also works -- Workers & Pages ->'
    Write-Host '    Create -> Pages -> Upload assets. Re-running this script then'
    Write-Host '    configures and deploys it.'
    exit 1
  }
  Write-Host '    created'
  Invoke-CF "/accounts/$acct/pages/projects/$ProjectName" 'PATCH' @{ deployment_configs = $deployCfg } | Out-Null
}
Write-Host '    production -> production Supabase; preview -> staging Supabase'

# --- deploy the build we already have ---------------------------------------
Write-Host ''
Write-Host '==> Building against production' -ForegroundColor Cyan
# Build here rather than trusting whatever is in dist/. A stale dist is silent:
# it deploys happily, passes the production-origin check, and ships an old
# bundle -- which is exactly what happened on the first run. The bundle hash is
# the only visible difference, and nobody checks that.
#
# Pass -NoBuild to deploy an existing dist/ deliberately.
if ($args -contains '-NoBuild') {
  Write-Host '    skipped (-NoBuild)'
} else {
  $prevUrl = $env:VITE_SUPABASE_URL; $prevKey = $env:VITE_SUPABASE_ANON
  $env:VITE_SUPABASE_URL = $ProdUrl; $env:VITE_SUPABASE_ANON = $ProdKey
  npm run build
  $buildCode = $LASTEXITCODE
  $env:VITE_SUPABASE_URL = $prevUrl; $env:VITE_SUPABASE_ANON = $prevKey
  if ($buildCode -ne 0) { Write-Host '  build failed' -ForegroundColor Red; exit 1 }
}

Write-Host ''
Write-Host '==> Deploying dist/' -ForegroundColor Cyan
if (-not (Test-Path 'dist\index.html')) {
  Write-Host '  dist/ is missing or empty.' -ForegroundColor Red
  exit 1
}
# Confirm the build we are about to ship targets $ProdUrl (now the staging
# project, deliberately -- see the comment where $ProdUrl is set above) and
# not some other origin from a stale or half-configured .env.
$bundle = Get-ChildItem 'dist\assets' -Filter 'main.*.js' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($bundle) {
  $content = Get-Content $bundle.FullName -Raw
  $prodRef = ([regex]::Match($ProdUrl, 'https://([a-z0-9]+)\.supabase\.co')).Groups[1].Value
  if ($content -notmatch [regex]::Escape($prodRef)) {
    Write-Host "  !! dist/ contains no $prodRef Supabase origin. Rebuild." -ForegroundColor Red
    exit 1
  }
  Write-Host '    verified: bundle targets the intended Supabase project'
}

$env:CLOUDFLARE_ACCOUNT_ID = $acct
npx --yes wrangler@latest pages deploy dist --project-name $ProjectName --branch production-readiness
if ($LASTEXITCODE -ne 0) { Write-Host 'wrangler deploy failed' -ForegroundColor Red; exit 1 }

# --- custom domain ----------------------------------------------------------
Write-Host ''
Write-Host "==> Attaching $Hostname" -ForegroundColor Cyan
$existing = Invoke-CF "/accounts/$acct/pages/projects/$ProjectName/domains" -AllowFail
if ($existing -and ($existing.result | Where-Object { $_.name -eq $Hostname })) {
  Write-Host '    already attached'
} else {
  $r = Invoke-CF "/accounts/$acct/pages/projects/$ProjectName/domains" 'POST' @{ name = $Hostname } -AllowFail
  if ($r -and $r.success) { Write-Host '    attached -- Cloudflare manages the DNS record' }
  else {
    Write-Host '    could not attach automatically.' -ForegroundColor Yellow
    Write-Host '    Add it in the dashboard: Pages -> ' + $ProjectName + ' -> Custom domains'
    Write-Host '    (needs Zone -> DNS -> Edit on fishwizz.com)'
  }
}

Write-Host @"

Deployed. Next, and this is NOT optional for sign-in to work:

  Supabase (doddeferfxzgdmzadibq -- the only project; see the comment on
  `$ProdUrl` above) -> Authentication -> URL Configuration
    Site URL:       https://$Hostname
    Redirect URLs:  https://$Hostname/**
    (add this ALONGSIDE the existing staging/preview redirect URLs --
    do not replace them, or preview deploys and local dev stop working)

  Google Cloud -> OAuth client -> Authorized JavaScript origins
    https://$Hostname
    (the redirect URI stays the Supabase callback, not this host)

The PKCE verifier is stored per-origin, so sign-in only works from the exact
host in that allow-list.

Nothing here touched www or the apex -- the Squarespace site is untouched.
"@
