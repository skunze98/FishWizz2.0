# Diagnose and repair the app.fishwizz.com custom domain.
#
#   $env:CLOUDFLARE_API_TOKEN = "..."
#   .\scripts\cf-fix-domain.ps1
#
# Attaching a custom domain in Pages is TWO operations: registering the hostname
# with the Pages project, and writing a CNAME in the DNS zone. They use
# different permissions, so the first can succeed while the second silently does
# not -- which shows up as NXDOMAIN, indistinguishable at a glance from a
# propagation delay. (It is distinguishable: a propagation delay returns
# NOERROR with no answer; a missing record returns NXDOMAIN, status 3.)

$ErrorActionPreference = 'Stop'

$ProjectName = 'fishwizz'
$Zone        = 'fishwizz.com'
$Sub         = 'app'
$Hostname    = "$Sub.$Zone"
$Target      = "$ProjectName.pages.dev"

if (-not $env:CLOUDFLARE_API_TOKEN) { Write-Host 'CLOUDFLARE_API_TOKEN is not set.' -ForegroundColor Red; exit 1 }

$H = @{ Authorization = "Bearer $($env:CLOUDFLARE_API_TOKEN)"; 'Content-Type' = 'application/json' }
$Api = 'https://api.cloudflare.com/client/v4'
$script:LastErr = $null

function Invoke-CF {
  param([string]$Path, [string]$Method = 'GET', $Body = $null, [switch]$AllowFail)
  $p = @{ Uri = "$Api$Path"; Headers = $H; Method = $Method; UseBasicParsing = $true }
  if ($Body) { $p.Body = ($Body | ConvertTo-Json -Depth 10 -Compress) }
  try { $script:LastErr = $null; return ((Invoke-WebRequest @p).Content | ConvertFrom-Json) }
  catch {
    $d = $_.ErrorDetails.Message
    if (-not $d -and $_.Exception.Response) {
      try { $d = (New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd() } catch {}
    }
    $script:LastErr = $d
    if ($AllowFail) { return $null }
    Write-Host "API call failed: $Method $Path" -ForegroundColor Red
    if ($d) { Write-Host "  $d" -ForegroundColor Red }
    exit 1
  }
}

# --- zone + account ---------------------------------------------------------
$z = Invoke-CF "/zones?name=$Zone"
if (-not $z.result -or $z.result.Count -eq 0) { Write-Host "zone $Zone not visible to this token" -ForegroundColor Red; exit 1 }
$zoneId = $z.result[0].id
$acct   = if ($env:CLOUDFLARE_ACCOUNT_ID) { $env:CLOUDFLARE_ACCOUNT_ID } else { $z.result[0].account.id }
Write-Host "zone $zoneId   account $acct"

# --- 1. Pages side ----------------------------------------------------------
Write-Host ''
Write-Host '==> Pages custom domain' -ForegroundColor Cyan
$doms = Invoke-CF "/accounts/$acct/pages/projects/$ProjectName/domains" -AllowFail
if (-not $doms) {
  Write-Host '    cannot read Pages domains' -ForegroundColor Red
  if ($script:LastErr) { Write-Host "      $script:LastErr" -ForegroundColor Red }
  exit 1
}
$d = $doms.result | Where-Object { $_.name -eq $Hostname }
if ($d) { Write-Host "    $Hostname registered  (status: $($d.status))" }
else {
  Write-Host "    $Hostname NOT registered with the project -- adding"
  $r = Invoke-CF "/accounts/$acct/pages/projects/$ProjectName/domains" 'POST' @{ name = $Hostname } -AllowFail
  if ($r -and $r.success) { Write-Host '    registered' } else {
    Write-Host '    failed:' -ForegroundColor Red
    if ($script:LastErr) { Write-Host "      $script:LastErr" -ForegroundColor Red }
    exit 1
  }
}

# --- 2. DNS side ------------------------------------------------------------
Write-Host ''
Write-Host '==> DNS record' -ForegroundColor Cyan
$recs = Invoke-CF "/zones/$zoneId/dns_records?name=$Hostname" -AllowFail
if (-not $recs) {
  Write-Host '    cannot read DNS records -- token needs Zone -> DNS -> Read' -ForegroundColor Red
  if ($script:LastErr) { Write-Host "      $script:LastErr" -ForegroundColor Red }
  exit 1
}

if ($recs.result.Count -gt 0) {
  foreach ($r in $recs.result) {
    Write-Host "    exists: $($r.type)  $($r.name) -> $($r.content)   proxied=$($r.proxied)"
  }
  Write-Host ''
  Write-Host '    Record is present. If DNS still says NXDOMAIN, give it a minute --'
  Write-Host '    with the record in place this IS a propagation delay.'
  exit 0
}

Write-Host "    MISSING -- creating CNAME $Sub -> $Target (proxied)"
$new = Invoke-CF "/zones/$zoneId/dns_records" 'POST' @{
  type = 'CNAME'; name = $Sub; content = $Target; proxied = $true; ttl = 1
  comment = 'FishWizz app on Cloudflare Pages'
} -AllowFail

if ($new -and $new.success) {
  Write-Host '    created' -ForegroundColor Green
  Write-Host ''
  Write-Host "    $Hostname -> $Target (proxied)"
  Write-Host '    Certificate issuance takes a minute or two after first resolution.'
} else {
  Write-Host '    could not create it:' -ForegroundColor Red
  if ($script:LastErr) { Write-Host "      $script:LastErr" -ForegroundColor Red }
  Write-Host ''
  Write-Host '    This is the permission that is missing:' -ForegroundColor Yellow
  Write-Host '      Zone -> DNS -> Edit     on fishwizz.com'
  Write-Host ''
  Write-Host '    Or add it by hand: Cloudflare -> fishwizz.com -> DNS -> Add record'
  Write-Host "      Type CNAME   Name $Sub   Target $Target   Proxy ON"
  exit 1
}
