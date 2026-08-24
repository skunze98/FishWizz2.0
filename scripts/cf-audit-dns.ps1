# Read the fishwizz.com zone and classify every DNS record.
#
#   $env:CLOUDFLARE_API_TOKEN = "..."
#   .\scripts\cf-audit-dns.ps1
#
# READ-ONLY. Changes nothing. This answers the question public DNS cannot:
# both apex and www are proxied, so from outside they resolve to Cloudflare's
# own IPs and the real targets are invisible.
#
# Token scopes needed (create at
# https://dash.cloudflare.com/profile/api-tokens -> Create Custom Token):
#   Zone   -> Zone   -> Read
#   Zone   -> DNS    -> Read
#   (Zone Resources: Include -> Specific zone -> fishwizz.com)

$ErrorActionPreference = 'Stop'
$Zone = if ($args[0]) { $args[0] } else { 'fishwizz.com' }

if (-not $env:CLOUDFLARE_API_TOKEN) {
  Write-Host 'CLOUDFLARE_API_TOKEN is not set.' -ForegroundColor Red
  Write-Host '  $env:CLOUDFLARE_API_TOKEN = "your-token"'
  exit 1
}

$H = @{ Authorization = "Bearer $($env:CLOUDFLARE_API_TOKEN)"; 'Content-Type' = 'application/json' }
$Api = 'https://api.cloudflare.com/client/v4'

function Invoke-CF {
  param([string]$Path, [string]$Method = 'GET', $Body = $null)
  $p = @{ Uri = "$Api$Path"; Headers = $H; Method = $Method; UseBasicParsing = $true }
  if ($Body) { $p.Body = ($Body | ConvertTo-Json -Depth 10 -Compress) }
  try {
    $r = Invoke-WebRequest @p
    return ($r.Content | ConvertFrom-Json)
  } catch {
    $resp = $_.Exception.Response
    $detail = ''
    if ($resp) {
      try { $detail = (New-Object System.IO.StreamReader($resp.GetResponseStream())).ReadToEnd() } catch {}
    }
    Write-Host "API call failed: $Method $Path" -ForegroundColor Red
    if ($detail) { Write-Host "  $detail" -ForegroundColor Red }
    exit 1
  }
}

Write-Host '==> Verifying token' -ForegroundColor Cyan
$v = Invoke-CF '/user/tokens/verify'
if (-not $v.success) { Write-Host '  token invalid'; exit 1 }
Write-Host "    $($v.result.status)"

Write-Host ''
Write-Host "==> Locating zone $Zone" -ForegroundColor Cyan
$z = Invoke-CF "/zones?name=$Zone"
if (-not $z.result -or $z.result.Count -eq 0) {
  Write-Host "  zone not found, or the token has no access to it." -ForegroundColor Red
  exit 1
}
$zoneId = $z.result[0].id
Write-Host "    id $zoneId   plan $($z.result[0].plan.name)   status $($z.result[0].status)"

Write-Host ''
Write-Host '==> DNS records' -ForegroundColor Cyan
$recs = (Invoke-CF "/zones/$zoneId/dns_records?per_page=200").result

# Squarespace's documented footprint. Anything matching is theirs; anything not
# is either yours or another vendor's and must not be deleted on my say-so.
$sqsIPs = @('198.185.159.144','198.185.159.145','198.49.23.144','198.49.23.145',
            '198.185.159.84','198.185.159.85')
function Get-Verdict {
  param($r)
  if ($r.type -in @('A','AAAA') -and $sqsIPs -contains $r.content) { return 'SQUARESPACE' }
  if ($r.content -match 'squarespace\.com$')                        { return 'SQUARESPACE' }
  if ($r.type -eq 'NS')                                             { return 'keep (delegation)' }
  if ($r.type -eq 'TXT' -and $r.content -match 'v=spf1')            { return 'keep (anti-spoofing)' }
  if ($r.type -eq 'CNAME' -and $r.content -match 'pages\.dev$')     { return 'keep (Cloudflare Pages)' }
  return 'REVIEW - not a known Squarespace record'
}

'{0,-6} {1,-28} {2,-42} {3,-7} {4}' -f 'TYPE','NAME','CONTENT','PROXY','VERDICT'
'{0,-6} {1,-28} {2,-42} {3,-7} {4}' -f '----','----','-------','-----','-------'
foreach ($r in $recs | Sort-Object type, name) {
  $c = if ($r.content.Length -gt 40) { $r.content.Substring(0,39) + '.' } else { $r.content }
  '{0,-6} {1,-28} {2,-42} {3,-7} {4}' -f $r.type, $r.name, $c, $(if ($r.proxied) {'on'} else {'off'}), (Get-Verdict $r)
}

Write-Host ''
$sqs = $recs | Where-Object { (Get-Verdict $_) -eq 'SQUARESPACE' }
$review = $recs | Where-Object { (Get-Verdict $_) -like 'REVIEW*' }
Write-Host "Squarespace records: $($sqs.Count)   Needs review: $($review.Count)   Total: $($recs.Count)" -ForegroundColor Cyan
if ($sqs.Count) {
  Write-Host ''
  Write-Host 'To remove Squarespace, delete these (do NOT do it until you have decided' -ForegroundColor Yellow
  Write-Host 'the marketing site can go -- this takes it down):' -ForegroundColor Yellow
  $sqs | ForEach-Object { "    $($_.type)  $($_.name)  ->  $($_.content)   [id $($_.id)]" }
}
if ($review.Count) {
  Write-Host ''
  Write-Host 'These are not Squarespace and are not obviously ours. Identify each before' -ForegroundColor Yellow
  Write-Host 'touching anything:' -ForegroundColor Yellow
  $review | ForEach-Object { "    $($_.type)  $($_.name)  ->  $($_.content)" }
}
