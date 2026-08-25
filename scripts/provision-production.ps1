# Step 2 of provisioning: build production from what capture-staging.ps1 saved.
#
# THIS WRITES TO PRODUCTION. Safe today only because production is empty (every
# table returns PGRST205). Re-running against a production holding real data is
# NOT safe.
#
#   $env:SUPABASE_DB_URL = "<PRODUCTION session-pooler URI>"
#   .\scripts\provision-production.ps1
#
# Copies no user data. Beta rows stay in staging until you decide to migrate them.
#
# WHY psql AND NOT `supabase db push`:
#   The 32 migrations that built staging are not in this repo -- `supabase
#   migration list` shows every remote one with local:"". supabase/migrations/
#   contains only the hardening migration. So `db push` against empty production
#   would run the hardening migration alone, against a database with no tables.
#   The schema lives in the pg_dump at supabase/schema/public.sql, which db push
#   does not read (and which opens with a `\restrict` meta-command only psql
#   understands). Applying the dump with psql is the honest path.

$ErrorActionPreference = 'Stop'

$ProdRef = 'usanapexwjssjscmdjwv'
$ProdKey = 'sb_publishable_8tYJUy-EeJS1jsXSyb90Bw_Rr1Hg2ck'
$Functions = @(
  'ask-atlas','atlas-live-water','atlas-nearby-waters','atlas-place-search',
  'atlas-water-catalog','atlas-water-profile','atlas-weather','delete-my-account'
)

# --- inputs -----------------------------------------------------------------
if (-not $env:SUPABASE_DB_URL) {
  Write-Host 'SUPABASE_DB_URL is not set.' -ForegroundColor Red
  Write-Host '  It must point at PRODUCTION for this script (it pointed at staging'
  Write-Host '  during capture -- update it before running this).'
  Write-Host '  Dashboard -> Connect -> Session pooler, in the PRODUCTION project.'
  exit 1
}
if ($env:SUPABASE_DB_URL -notlike "*$ProdRef*") {
  Write-Host "!! SUPABASE_DB_URL does not mention $ProdRef." -ForegroundColor Red
  Write-Host '!! It is probably still pointing at staging from the capture step.'
  Write-Host '!! Refusing to run.'
  exit 1
}
if ($env:SUPABASE_DB_URL -match ':6543/') {
  Write-Host '!! That is the TRANSACTION pooler (6543). Use the SESSION pooler (5432).' -ForegroundColor Red
  exit 1
}

foreach ($f in @('supabase\schema\public.sql','supabase\schema\storage-policies.sql')) {
  if (-not (Test-Path $f)) { Write-Host "missing: $f -- run capture-staging.ps1 first." -ForegroundColor Red; exit 1 }
}
# Every migration in the repo, in order -- not one hardcoded filename. That
# hardcoded name (20260808120000_harden_rls.sql) no longer exists; the real
# file is 20260824101705_harden_rls.sql, renamed when its provenance was
# reconciled against staging's own migration history. Worse, pinning to one
# file silently skipped every OTHER migration that has landed since
# (20260817001741_finish_manual_gear_entry.sql,
# 20260824000000_fix_bass_species_matching.sql) -- production would have
# been provisioned from a schema two migrations behind staging with no error
# at all. Migration filenames are timestamp-prefixed, so a plain sort is a
# chronological apply order.
$MigrationFiles = @(Get-ChildItem 'supabase\migrations\*.sql' | Sort-Object Name | Select-Object -ExpandProperty FullName)
if ($MigrationFiles.Count -eq 0) { Write-Host 'missing: supabase\migrations\*.sql -- run capture-staging.ps1 first.' -ForegroundColor Red; exit 1 }

# --- production must still be empty -----------------------------------------
Write-Host '==> Confirming production is still empty' -ForegroundColor Cyan
$status = 0
try {
  $r = Invoke-WebRequest -Uri "https://$ProdRef.supabase.co/rest/v1/catches?select=id&limit=1" `
        -Headers @{ apikey = $ProdKey } -UseBasicParsing -ErrorAction Stop
  $status = $r.StatusCode
} catch { $status = [int]$_.Exception.Response.StatusCode }
if ($status -ne 404) {
  Write-Host "!! Expected 404 (no schema) but got $status." -ForegroundColor Red
  Write-Host '!! Production is no longer empty. STOP and re-plan.'
  exit 1
}
Write-Host '    confirmed empty (404)'

# --- psql plumbing (same wsl-quoting avoidance as capture) -------------------
$PgMode = $null
if (Get-Command psql -ErrorAction SilentlyContinue) { $PgMode = 'native' }
else {
  wsl.exe -d Ubuntu -- bash -lc 'command -v psql' | Out-Null
  if ($LASTEXITCODE -eq 0) { $PgMode = 'wsl' }
}
if (-not $PgMode) { Write-Host 'psql not found. wsl -d Ubuntu -- sudo apt install -y postgresql-client' -ForegroundColor Red; exit 1 }

function ConvertTo-WslPath {
  param([string]$WindowsPath)
  $full = [System.IO.Path]::GetFullPath($WindowsPath)
  return '/mnt/' + $full.Substring(0,1).ToLower() + ($full.Substring(2) -replace '\\','/')
}

$UrlFile = Join-Path $env:TEMP ("fw_produrl_" + [guid]::NewGuid().ToString('N') + '.txt')
$OutFile = Join-Path $env:TEMP ("fw_psqlout_" + [guid]::NewGuid().ToString('N') + '.txt')
$ErrFile = Join-Path $env:TEMP ("fw_psqlerr_" + [guid]::NewGuid().ToString('N') + '.txt')
[System.IO.File]::WriteAllText($UrlFile, $env:SUPABASE_DB_URL, (New-Object System.Text.UTF8Encoding($false)))

function Invoke-Psql {
  param([string[]]$PsqlArgs)
  if ($PgMode -eq 'native') {
    & psql @PsqlArgs $env:SUPABASE_DB_URL 1> $OutFile 2> $ErrFile
    return $LASTEXITCODE
  }
  $runner = ConvertTo-WslPath (Join-Path $PSScriptRoot '_pgrun.sh')
  $a = @('-d','Ubuntu','--','bash',$runner,'psql',
         (ConvertTo-WslPath $UrlFile), (ConvertTo-WslPath $OutFile), (ConvertTo-WslPath $ErrFile)) + $PsqlArgs
  & wsl.exe @a
  return $LASTEXITCODE
}

function Show-Err { param([string]$What)
  Write-Host "$What failed" -ForegroundColor Red
  if (Test-Path $ErrFile) { Write-Host ((Get-Content $ErrFile -Raw).Trim()) -ForegroundColor Red }
}
function Remove-Temp { Remove-Item $UrlFile,$OutFile,$ErrFile -Force -ErrorAction SilentlyContinue }

try {
  Write-Host ''
  Write-Host '==> Preflight: connecting to production' -ForegroundColor Cyan
  if ((Invoke-Psql @('-tAc','select current_database()')) -ne 0) { Show-Err 'psql'; exit 1 }
  Write-Host "    connected"

  # ON_ERROR_STOP=1 stops execution on error, but psql is AUTOCOMMIT: every
  # statement before the error has already committed. That is exactly how the
  # first attempt left production with 9 of 27 tables. --single-transaction (set
  # per-step below) wraps each file so a failure rolls the whole file back and
  # production stays genuinely empty. Verified the dumps contain nothing that
  # cannot run in a transaction -- no CONCURRENTLY, VACUUM, or ALTER SYSTEM.
  #
  # A pg_dump of --schema=public opens by creating the schema and commenting on
  # it. Both collide with a fresh Supabase project, which already has a `public`
  # schema owned by a role we are not. Rewrite those two statements rather than
  # editing the captured dump, which should stay a faithful copy of staging.
  $applied = Join-Path $env:TEMP ("fw_public_applied_" + [guid]::NewGuid().ToString('N') + '.sql')
  $sql = [System.IO.File]::ReadAllText('supabase\schema\public.sql')
  $changes = @()
  if ($sql -match '(?m)^CREATE SCHEMA public;') {
    $sql = $sql -replace '(?m)^CREATE SCHEMA public;', 'CREATE SCHEMA IF NOT EXISTS public;'
    $changes += 'CREATE SCHEMA public -> IF NOT EXISTS'
  }
  if ($sql -match '(?m)^COMMENT ON SCHEMA public') {
    $sql = $sql -replace '(?m)^(COMMENT ON SCHEMA public.*)$', '-- $1  -- skipped: we do not own the public schema'
    $changes += 'COMMENT ON SCHEMA public -> skipped (not owner)'
  }
  # Defensive; the current dump has none, but a future capture might.
  if ($sql -match '(?m)^CREATE EXTENSION (?!IF NOT EXISTS)') {
    $sql = $sql -replace '(?m)^CREATE EXTENSION (?!IF NOT EXISTS)', 'CREATE EXTENSION IF NOT EXISTS '
    $changes += 'CREATE EXTENSION -> IF NOT EXISTS'
  }
  [System.IO.File]::WriteAllText($applied, $sql, (New-Object System.Text.UTF8Encoding($false)))
  if ($changes.Count) {
    Write-Host ''
    Write-Host '==> Adjusted for a fresh Supabase project:' -ForegroundColor Cyan
    $changes | ForEach-Object { Write-Host "    $_" }
  }

  $steps = @(
    @{ File='supabase\schema\extensions.sql';       Label='extensions (postgis, pg_trgm)' },
    @{ File=$applied;                               Label='public schema' },
    @{ File='supabase\schema\storage-policies.sql'; Label='storage buckets + policies' }
  )
  foreach ($m in $MigrationFiles) {
    # SelfTransaction if the file wraps itself in BEGIN/COMMIT (harden_rls
    # does, to abort atomically on its own assertion failures) -- detected
    # per-file rather than by name, so a future migration isn't silently
    # mis-applied the way the hardcoded single filename was.
    $selfWrapped = [System.IO.File]::ReadAllText($m) -match '(?im)^\s*begin\s*;'
    $steps += @{ File = $m; Label = "migration: $(Split-Path $m -Leaf)"; SelfTransaction = $selfWrapped }
  }
  foreach ($s in $steps) {
    Write-Host ''
    Write-Host "==> Applying $($s.Label)" -ForegroundColor Cyan
    $path = if ($PgMode -eq 'wsl') { ConvertTo-WslPath $s.File } else { $s.File }
    $psqlArgs = @('-v','ON_ERROR_STOP=1')
    if (-not $s.SelfTransaction) { $psqlArgs += '--single-transaction' }
    if ((Invoke-Psql ($psqlArgs + @('-f',$path))) -ne 0) { Show-Err $s.Label; exit 1 }
    Write-Host "    ok"
  }
}
finally {
  Remove-Temp
  if ($applied) { Remove-Item $applied -Force -ErrorAction SilentlyContinue }
}

Write-Host ''
Write-Host '==> Deploying edge functions (--use-api: no Docker)' -ForegroundColor Cyan
Write-Host '    (--project-ref is explicit, so the linked project is irrelevant)'
foreach ($fn in $Functions) {
  Write-Host "    $fn"
  npx --yes supabase functions deploy $fn --project-ref $ProdRef --use-api
  if ($LASTEXITCODE -ne 0) { Write-Host "    !! $fn failed" -ForegroundColor Yellow }
}

Write-Host @'

==> Done with what can be scripted.

THREE THINGS LEFT, none of which the schema dump carries:

  1. EDGE FUNCTION SECRETS -- exactly one non-Supabase secret is used by the
     captured source (plus a model name):
       npx supabase secrets set OPENAI_API_KEY=... --project-ref usanapexwjssjscmdjwv
       npx supabase secrets set ATLAS_AI_MODEL=... --project-ref usanapexwjssjscmdjwv
     SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY are injected automatically.
     Functions deploy fine without secrets and then fail at runtime.

  2. AUTH CONFIGURATION -- Site URL, redirect allow-list, Google provider,
     rate limits, refresh-token rotation, Turnstile. DEPLOYMENT.md steps 2d
     and 6d. Per-project; copying staging verbatim is wrong.

  3. REFERENCE DATA -- waterbodies ships empty, so water search returns
     nothing. Load the dump capture-staging.ps1 already made:
       .scriptsload-waterbodies.ps1
     (Do NOT hand the URL to wsl.exe directly -- it strips quotes and splits on
     ';', which silently corrupts the connection string.)
     This is the ONLY table whose rows should move from staging. Everything
     else there is a beta user's personal fishing data.

Then verify from outside -- the only thing that actually proves RLS:
  node .\scripts\rls-probe.mjs      (FISHWIZZ_* pointed at production)
'@
