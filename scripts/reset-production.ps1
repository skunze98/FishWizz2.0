# Drop everything in production's public schema so provisioning can start clean.
#
#   $env:SUPABASE_DB_URL = "<PRODUCTION session-pooler URI>"
#   .\scripts\reset-production.ps1
#
# WHY THIS EXISTS: the first provisioning attempt applied the schema dump with
# ON_ERROR_STOP=1 but WITHOUT --single-transaction. psql is autocommit, so when
# it stopped at the missing postgis type, the 9 tables it had already created
# stayed committed. provision-production.ps1 now uses --single-transaction so
# this cannot recur; this script cleans up the one time it did.
#
# THIS IS DESTRUCTIVE. It refuses to run if it finds any rows, so it cannot
# quietly delete real data -- but read the guards before trusting that sentence.

$ErrorActionPreference = 'Stop'

$ProdRef  = 'usanapexwjssjscmdjwv'
$StageRef = 'doddeferfxzgdmzadibq'

if (-not $env:SUPABASE_DB_URL) {
  Write-Host 'SUPABASE_DB_URL is not set.' -ForegroundColor Red; exit 1
}
if ($env:SUPABASE_DB_URL -like "*$StageRef*") {
  Write-Host '!! That is STAGING. It holds the live beta and every real angler.' -ForegroundColor Red
  Write-Host '!! Refusing, emphatically.'
  exit 1
}
if ($env:SUPABASE_DB_URL -notlike "*$ProdRef*") {
  Write-Host "!! SUPABASE_DB_URL mentions neither $ProdRef nor a project I recognise." -ForegroundColor Red
  Write-Host '!! Refusing to drop a schema in an unknown database.'
  exit 1
}

# --- psql plumbing ----------------------------------------------------------
$PgMode = $null
if (Get-Command psql -ErrorAction SilentlyContinue) { $PgMode = 'native' }
else {
  wsl.exe -d Ubuntu -- bash -lc 'command -v psql' | Out-Null
  if ($LASTEXITCODE -eq 0) { $PgMode = 'wsl' }
}
if (-not $PgMode) { Write-Host 'psql not found.' -ForegroundColor Red; exit 1 }

function ConvertTo-WslPath {
  param([string]$WindowsPath)
  $full = [System.IO.Path]::GetFullPath($WindowsPath)
  return '/mnt/' + $full.Substring(0,1).ToLower() + ($full.Substring(2) -replace '\\','/')
}

$UrlFile = Join-Path $env:TEMP ("fw_rsturl_" + [guid]::NewGuid().ToString('N') + '.txt')
$OutFile = Join-Path $env:TEMP ("fw_rstout_" + [guid]::NewGuid().ToString('N') + '.txt')
$ErrFile = Join-Path $env:TEMP ("fw_rsterr_" + [guid]::NewGuid().ToString('N') + '.txt')
$SqlFile = Join-Path $env:TEMP ("fw_rstsql_" + [guid]::NewGuid().ToString('N') + '.sql')
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
function Get-Out { if (Test-Path $OutFile) { (Get-Content $OutFile -Raw).Trim() } else { '' } }
function Show-Err { if (Test-Path $ErrFile) { Write-Host ((Get-Content $ErrFile -Raw).Trim()) -ForegroundColor Red } }
function Remove-Temp { Remove-Item $UrlFile,$OutFile,$ErrFile,$SqlFile -Force -ErrorAction SilentlyContinue }

try {
  Write-Host '==> Connecting' -ForegroundColor Cyan
  if ((Invoke-Psql @('-tAc','select current_database()')) -ne 0) { Show-Err; exit 1 }

  Write-Host ''
  Write-Host '==> What is in public right now' -ForegroundColor Cyan
  if ((Invoke-Psql @('-tAc',"select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")) -ne 0) { Show-Err; exit 1 }
  $tableCount = [int](Get-Out)
  Write-Host "    tables: $tableCount"
  if ($tableCount -eq 0) { Write-Host '    already clean -- nothing to do.'; exit 0 }

  # The real safety check: refuse if ANY table holds rows. A half-provisioned
  # schema is empty by definition; anything with data is not something this
  # script should be deleting.
  $countSql = @'
select coalesce(sum(cnt),0) from (
  select (xpath('/row/c/text()',
          query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name),
                       false, true, '')))[1]::text::bigint as cnt
  from information_schema.tables
  where table_schema='public' and table_type='BASE TABLE'
    and table_name <> 'spatial_ref_sys'
) t
'@
  [System.IO.File]::WriteAllText($SqlFile, $countSql, (New-Object System.Text.UTF8Encoding($false)))
  $p = if ($PgMode -eq 'wsl') { ConvertTo-WslPath $SqlFile } else { $SqlFile }
  if ((Invoke-Psql @('-tA','-f',$p)) -ne 0) { Show-Err; exit 1 }
  $rows = [int64](Get-Out)
  Write-Host "    rows across all tables (excluding spatial_ref_sys): $rows"

  if ($rows -gt 0) {
    Write-Host ''
    Write-Host "!! $rows rows found. This is not an empty half-provisioned schema." -ForegroundColor Red
    Write-Host '!! Refusing to drop it. Investigate before resetting anything.'
    exit 1
  }

  Write-Host ''
  Write-Host "About to DROP SCHEMA public CASCADE on $ProdRef ($tableCount tables, 0 rows)." -ForegroundColor Yellow
  Write-Host 'This also drops postgis/pg_trgm from public; provisioning reinstalls them.'
  $ok = Read-Host "Type RESET PRODUCTION to proceed"
  if ($ok -ne 'RESET PRODUCTION') { Write-Host 'Aborted.'; exit 1 }

  # Recreate with the grants a Supabase project expects. The hardening
  # migration tightens anon afterwards.
  $resetSql = @'
begin;
drop schema if exists public cascade;
create schema public;
alter schema public owner to pg_database_owner;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
commit;
'@
  [System.IO.File]::WriteAllText($SqlFile, $resetSql, (New-Object System.Text.UTF8Encoding($false)))
  $p = if ($PgMode -eq 'wsl') { ConvertTo-WslPath $SqlFile } else { $SqlFile }
  Write-Host ''
  Write-Host '==> Resetting' -ForegroundColor Cyan
  if ((Invoke-Psql @('-v','ON_ERROR_STOP=1','-f',$p)) -ne 0) { Show-Err; exit 1 }

  if ((Invoke-Psql @('-tAc',"select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")) -ne 0) { Show-Err; exit 1 }
  Write-Host "    tables now: $(Get-Out)"
}
finally { Remove-Temp }

Write-Host @'

Reset complete. Production should answer 404 again -- confirm, then re-provision:

  .\scripts\provision-production.ps1

That run uses --single-transaction, so a failure rolls back instead of
leaving a half-built schema.
'@
