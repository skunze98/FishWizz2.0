# Step 1 of provisioning: get staging into git. NO DOCKER REQUIRED.
#
# READ-ONLY against staging. Writes only into the repo. Run this before anything
# touches production -- the eight edge functions currently exist ONLY inside the
# staging project, so until this runs they are one dashboard accident away from
# being gone for good.
#
#   .\scripts\capture-staging.ps1
#
# Requires:
#   npx supabase login    (token: https://supabase.com/dashboard/account/tokens)
#   $env:SUPABASE_DB_URL  staging SESSION-pooler connection string
#                         (Dashboard -> Connect -> Session pooler)
#
# `supabase db dump` needs Docker; this calls pg_dump directly and passes
# --use-api to the function commands, so Docker/Rancher is never involved.

$ErrorActionPreference = 'Stop'

$StagingRef = 'doddeferfxzgdmzadibq'
$Functions = @(
  'ask-atlas','atlas-live-water','atlas-nearby-waters','atlas-place-search',
  'atlas-water-catalog','atlas-water-profile','atlas-weather','delete-my-account'
)

# --- validate the target BEFORE anything else -------------------------------
# Pointing this at production is the expensive mistake and costs nothing to check.
if (-not $env:SUPABASE_DB_URL) {
  Write-Host 'SUPABASE_DB_URL is not set.' -ForegroundColor Red
  Write-Host '  Dashboard -> Connect -> Session pooler  (STAGING project)'
  Write-Host '  $env:SUPABASE_DB_URL = "postgresql://postgres.<ref>:<pw>@...pooler.supabase.com:5432/postgres"'
  exit 1
}
if ($env:SUPABASE_DB_URL -notlike "*$StagingRef*") {
  Write-Host "!! SUPABASE_DB_URL does not mention $StagingRef." -ForegroundColor Red
  Write-Host '!! Refusing to run: this script must read STAGING, not production.'
  exit 1
}
if ($env:SUPABASE_DB_URL -match ':6543/') {
  Write-Host '!! That is the TRANSACTION pooler (port 6543). pg_dump needs' -ForegroundColor Red
  Write-Host '!! session-level features and cannot use it.'
  Write-Host '!! Use the SESSION pooler instead: Dashboard -> Connect -> Session pooler'
  exit 1
}

# --- locate pg_dump ---------------------------------------------------------
$PgMode = $null
if (Get-Command pg_dump -ErrorAction SilentlyContinue) {
  $PgMode = 'native'
} else {
  wsl.exe -d Ubuntu -- bash -lc 'command -v pg_dump' | Out-Null
  if ($LASTEXITCODE -eq 0) { $PgMode = 'wsl' }
}
if (-not $PgMode) {
  Write-Host 'No pg_dump found, and `supabase db dump` needs Docker.' -ForegroundColor Red
  Write-Host ''
  Write-Host 'Install the client once (client only -- no server):'
  Write-Host '    wsl -d Ubuntu -- sudo apt update'
  Write-Host '    wsl -d Ubuntu -- sudo apt install -y postgresql-client'
  exit 1
}
Write-Host "==> Using pg_dump: $PgMode" -ForegroundColor Cyan

New-Item -ItemType Directory -Force -Path 'supabase\schema' | Out-Null

# --- plumbing ---------------------------------------------------------------
# wsl.exe STRIPS QUOTES from the command argument, so any connection string
# containing ';' (legal in a generated password) is split and its tail executed
# as a shell command -- which silently corrupted both the exit code and the
# stderr redirect in the previous version of this script. Everything therefore
# goes through scripts/_pgrun.sh with plain-path arguments only, and the URL is
# handed over in a file rather than on the command line.

function ConvertTo-WslPath {
  param([string]$WindowsPath)
  $full = [System.IO.Path]::GetFullPath($WindowsPath)
  $drive = $full.Substring(0,1).ToLower()
  return '/mnt/' + $drive + ($full.Substring(2) -replace '\\','/')
}

$UrlFile = Join-Path $env:TEMP ("fw_dburl_" + [guid]::NewGuid().ToString('N') + '.txt')
$ErrFile = Join-Path $env:TEMP ("fw_pgerr_" + [guid]::NewGuid().ToString('N') + '.txt')
[System.IO.File]::WriteAllText($UrlFile, $env:SUPABASE_DB_URL, (New-Object System.Text.UTF8Encoding($false)))

function Invoke-Pg {
  param([string]$Tool, [string]$OutFile, [string[]]$PgArgs)

  if ($PgMode -eq 'native') {
    & $Tool @PgArgs $env:SUPABASE_DB_URL 1> $OutFile 2> $ErrFile
    return $LASTEXITCODE
  }
  $runner = ConvertTo-WslPath (Join-Path $PSScriptRoot '_pgrun.sh')
  $args = @('-d','Ubuntu','--','bash',$runner,$Tool,
            (ConvertTo-WslPath $UrlFile), (ConvertTo-WslPath $OutFile), (ConvertTo-WslPath $ErrFile)) + $PgArgs
  & wsl.exe @args
  return $LASTEXITCODE
}

function Show-PgFailure {
  param([int]$Code, [string]$What)
  $err = ''
  if (Test-Path $ErrFile) { $err = (Get-Content $ErrFile -Raw -ErrorAction SilentlyContinue) }
  Write-Host ''
  Write-Host "$What failed (exit $Code)" -ForegroundColor Red
  if ($err) { Write-Host $err.Trim() -ForegroundColor Red }
  Write-Host ''
  Write-Host 'Most likely causes, in order:' -ForegroundColor Yellow
  Write-Host '  1. Not the session pooler. Dashboard -> Connect -> Session pooler'
  Write-Host '     (port 5432). Transaction pooler (6543) cannot serve pg_dump, and'
  Write-Host '     direct db.<ref>.supabase.co is IPv6-only on newer projects, which'
  Write-Host '     will not resolve from WSL.'
  Write-Host '  2. Wrong password, or the URL was truncated when you pasted it.'
  Write-Host '     If the password contains @ : / ? # [ ] or ;, it must be'
  Write-Host '     percent-encoded in the URI (@ -> %40, ; -> %3B), otherwise the'
  Write-Host '     host is parsed from the wrong side of it.'
  Write-Host '  3. Project paused. A free-tier project sleeps after inactivity --'
  Write-Host '     open it in the dashboard to wake it, then re-run.'
}

function Remove-Temp {
  Remove-Item $UrlFile, $ErrFile -Force -ErrorAction SilentlyContinue
}

try {
  # --- preflight ------------------------------------------------------------
  Write-Host ''
  Write-Host '==> Preflight: connecting' -ForegroundColor Cyan
  $probe = Join-Path $env:TEMP ("fw_probe_" + [guid]::NewGuid().ToString('N') + '.txt')
  $code = Invoke-Pg 'psql' $probe @('-tAc','select version()')
  if ($code -ne 0) { Show-PgFailure $code 'psql'; Remove-Item $probe -Force -EA SilentlyContinue; Remove-Temp; exit 1 }
  $ver = (Get-Content $probe -Raw -EA SilentlyContinue).Trim()
  Remove-Item $probe -Force -EA SilentlyContinue
  Write-Host "    connected: $($ver.Substring(0,[Math]::Min(64,$ver.Length)))"

  # --- dumps ----------------------------------------------------------------
  $dumps = @(
    @{ Out='supabase\schema\public.sql';            Args=@('--schema-only','--no-owner','--no-privileges','--schema=public');          Label='public schema' },
    @{ Out='supabase\schema\auth_storage.sql';      Args=@('--schema-only','--no-owner','--no-privileges','--schema=auth','--schema=storage'); Label='auth + storage schema' },
    @{ Out='supabase\schema\waterbodies-data.sql';  Args=@('--data-only','--no-owner','--table=public.waterbodies');                    Label='waterbodies reference data' }
  )

  Write-Host ''
  Write-Host '==> Dumping (structure only, except waterbodies)' -ForegroundColor Cyan
  foreach ($d in $dumps) {
    $code = Invoke-Pg 'pg_dump' $d.Out $d.Args
    if ($code -ne 0) { Show-PgFailure $code "pg_dump ($($d.Label))"; Remove-Temp; exit 1 }
    $n = (Get-Content $d.Out -EA SilentlyContinue | Measure-Object -Line).Lines
    Write-Host ("    {0}  ({1} lines)" -f $d.Out, $n)
  }
}
finally {
  Remove-Temp
}

Write-Host ''
Write-Host '==> Downloading edge function source (--use-api: no Docker)' -ForegroundColor Cyan
foreach ($fn in $Functions) {
  Write-Host "    $fn"
  npx --yes supabase functions download $fn --project-ref $StagingRef --use-api
  if ($LASTEXITCODE -ne 0) { Write-Host "    !! $fn failed -- note it and continue" -ForegroundColor Yellow }
}

Write-Host ''
Write-Host '==> Captured:' -ForegroundColor Cyan
Get-ChildItem -Recurse -File 'supabase\schema','supabase\functions' -ErrorAction SilentlyContinue |
  ForEach-Object { "    $($_.FullName.Replace((Get-Location).Path + '\',''))" }

Write-Host @'

Next:
  1. READ supabase\schema\public.sql before applying it anywhere. This is the
     moment to notice anything in staging you do not want carried forward.
  2. Check the downloaded functions for hardcoded secrets or staging URLs --
     they were written against staging. Anything secret belongs in
     `supabase secrets set`, not in committed source.
  3. git add supabase; git commit. This alone closes the DR gap: the edge
     functions stop being unrecoverable.
  4. Then: .\scripts\provision-production.ps1
'@
