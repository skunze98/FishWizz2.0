# Load the waterbodies reference data into a project.
#
#   $env:SUPABASE_DB_URL = "<target session-pooler URI>"
#   .\scripts\load-waterbodies.ps1
#
# waterbodies is the ONLY table whose rows move between projects. Everything
# else in staging is a beta user's personal fishing data. Production ships this
# table empty, so water search returns nothing until this runs.
#
# Goes through _pgrun.sh rather than handing the URL to wsl.exe, which strips
# quotes and splits on ';' -- a password containing one would otherwise be
# truncated and its tail executed as a shell command.

$ErrorActionPreference = 'Stop'

$Data = 'supabase\schema\waterbodies-data.sql'
if (-not (Test-Path $Data)) {
  Write-Host "$Data missing -- run capture-staging.ps1 first." -ForegroundColor Red; exit 1
}
if (-not $env:SUPABASE_DB_URL) {
  Write-Host 'SUPABASE_DB_URL is not set.' -ForegroundColor Red
  Write-Host '  Dashboard -> Connect -> Session pooler, in the TARGET project.'
  exit 1
}
if ($env:SUPABASE_DB_URL -match ':6543/') {
  Write-Host '!! Transaction pooler (6543). Use the SESSION pooler (5432).' -ForegroundColor Red; exit 1
}

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

$UrlFile = Join-Path $env:TEMP ("fw_wburl_" + [guid]::NewGuid().ToString('N') + '.txt')
$OutFile = Join-Path $env:TEMP ("fw_wbout_" + [guid]::NewGuid().ToString('N') + '.txt')
$ErrFile = Join-Path $env:TEMP ("fw_wberr_" + [guid]::NewGuid().ToString('N') + '.txt')
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

try {
  if ((Invoke-Psql @('-tAc','select count(*) from public.waterbodies')) -ne 0) { Show-Err; exit 1 }
  $before = [int](Get-Out)
  Write-Host "==> waterbodies rows before: $before"
  if ($before -gt 0) {
    Write-Host '    Already populated. The dump is a plain COPY with no conflict handling,' -ForegroundColor Yellow
    Write-Host '    so re-running would duplicate rows or violate a key. Skipping.'
    exit 0
  }

  $path = if ($PgMode -eq 'wsl') { ConvertTo-WslPath $Data } else { $Data }
  Write-Host '==> Loading (single transaction -- rolls back on any error)'
  if ((Invoke-Psql @('-v','ON_ERROR_STOP=1','--single-transaction','-f',$path)) -ne 0) { Show-Err; exit 1 }

  if ((Invoke-Psql @('-tAc','select count(*) from public.waterbodies')) -ne 0) { Show-Err; exit 1 }
  Write-Host "==> waterbodies rows after: $(Get-Out)"
}
finally { Remove-Item $UrlFile,$OutFile,$ErrFile -Force -ErrorAction SilentlyContinue }
