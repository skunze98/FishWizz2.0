# Deploy the FishWizz marketing site to Cloudflare Pages at www.fishwizz.com.
# This is intentionally separate from scripts/cf-setup-pages.ps1, which deploys
# the actual FishWizz application to app.fishwizz.com.
#
# Required environment variables:
#   $env:CLOUDFLARE_API_TOKEN  = "..."
#   $env:CLOUDFLARE_ACCOUNT_ID = "..."   # optional; derived from fishwizz.com when possible
#
# Token permissions:
#   Account -> Cloudflare Pages -> Edit
#   Zone    -> DNS              -> Edit
#   Zone    -> Zone             -> Read

$ErrorActionPreference = 'Stop'
$ProjectName = 'fishwizz-web'
$Hostname = 'www.fishwizz.com'
$SiteDir = 'marketing'
$Api = 'https://api.cloudflare.com/client/v4'

if (-not $env:CLOUDFLARE_API_TOKEN) {
  Write-Host 'CLOUDFLARE_API_TOKEN is not set.' -ForegroundColor Red
  exit 1
}
if (-not (Test-Path "$SiteDir\index.html")) {
  Write-Host "$SiteDir/index.html is missing." -ForegroundColor Red
  exit 1
}

$H = @{ Authorization = "Bearer $($env:CLOUDFLARE_API_TOKEN)"; 'Content-Type' = 'application/json' }
function Invoke-CF {
  param([string]$Path,[string]$Method='GET',$Body=$null,[switch]$AllowFail)
  $p = @{ Uri="$Api$Path"; Headers=$H; Method=$Method; UseBasicParsing=$true }
  if ($Body) { $p.Body = ($Body | ConvertTo-Json -Depth 12 -Compress) }
  try { return ((Invoke-WebRequest @p).Content | ConvertFrom-Json) }
  catch {
    $detail = $_.ErrorDetails.Message
    if ($AllowFail) { $script:LastCFError=$detail; return $null }
    Write-Host "Cloudflare API failed: $Method $Path" -ForegroundColor Red
    if ($detail) { Write-Host $detail -ForegroundColor Red }
    exit 1
  }
}

Write-Host '==> Verifying Cloudflare token' -ForegroundColor Cyan
$v = Invoke-CF '/user/tokens/verify'
if (-not $v.success) { Write-Host 'Invalid Cloudflare token.' -ForegroundColor Red; exit 1 }

$acct = $env:CLOUDFLARE_ACCOUNT_ID
if (-not $acct) {
  $zone = Invoke-CF '/zones?name=fishwizz.com' -AllowFail
  if ($zone -and $zone.result.Count -gt 0) { $acct = $zone.result[0].account.id }
}
if (-not $acct) {
  Write-Host 'Could not determine Cloudflare account. Set CLOUDFLARE_ACCOUNT_ID.' -ForegroundColor Red
  exit 1
}
$env:CLOUDFLARE_ACCOUNT_ID = $acct

Write-Host "==> Cloudflare Pages project '$ProjectName'" -ForegroundColor Cyan
$proj = Invoke-CF "/accounts/$acct/pages/projects/$ProjectName" -AllowFail
if (-not $proj -or -not $proj.success) {
  $created = Invoke-CF "/accounts/$acct/pages/projects" 'POST' @{
    name = $ProjectName
    production_branch = 'main'
  } -AllowFail
  if (-not $created -or -not $created.success) {
    Write-Host 'Could not create the Pages project. Confirm Pages Edit permission.' -ForegroundColor Red
    if ($script:LastCFError) { Write-Host $script:LastCFError -ForegroundColor Red }
    exit 1
  }
  Write-Host '    created'
} else {
  Write-Host '    exists'
}

Write-Host "==> Deploying $SiteDir/" -ForegroundColor Cyan
npx --yes wrangler@latest pages deploy $SiteDir --project-name $ProjectName --branch main
if ($LASTEXITCODE -ne 0) { Write-Host 'Wrangler deploy failed.' -ForegroundColor Red; exit 1 }

Write-Host "==> Attaching $Hostname" -ForegroundColor Cyan
$domains = Invoke-CF "/accounts/$acct/pages/projects/$ProjectName/domains" -AllowFail
if ($domains -and ($domains.result | Where-Object { $_.name -eq $Hostname })) {
  Write-Host '    already attached'
} else {
  $script:LastCFError = $null
  $attached = Invoke-CF "/accounts/$acct/pages/projects/$ProjectName/domains" 'POST' @{ name=$Hostname } -AllowFail
  if (-not $attached -or -not $attached.success) {
    Write-Host "Could not attach $Hostname automatically." -ForegroundColor Yellow
    Write-Host 'The most common reason is that www.fishwizz.com is still attached to an older Pages project or DNS record.' -ForegroundColor Yellow
    if ($script:LastCFError) { Write-Host $script:LastCFError -ForegroundColor Yellow }
    Write-Host "Open Cloudflare -> Workers & Pages -> $ProjectName -> Custom domains and attach $Hostname after removing only the old www binding." -ForegroundColor Yellow
    exit 1
  }
  Write-Host '    attached'
}

Write-Host ''
Write-Host "Landing page deployed to https://$Hostname" -ForegroundColor Green
Write-Host 'FishWizz app remains separate at https://app.fishwizz.com' -ForegroundColor Green
