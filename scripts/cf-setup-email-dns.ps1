# Configure fishwizz.com DNS for transactional email.
#
#   $env:CLOUDFLARE_API_TOKEN = "..."
#   .\scripts\cf-setup-email-dns.ps1 -Provider resend
#   .\scripts\cf-setup-email-dns.ps1 -Provider resend -DkimFile .\dkim.json
#   .\scripts\cf-setup-email-dns.ps1 -Provider resend -WhatIf     # show, change nothing
#
# WHY THIS IS NEEDED: Supabase's built-in email sender allows only a couple of
# messages per hour and is explicitly not for production. Without custom SMTP,
# most people who try to sign up simply cannot -- which is the HTTP 429
# "email rate limit exceeded" that made account creation appear to fail.
#
# Custom SMTP needs DNS to prove FishWizz may send as fishwizz.com. Three
# records matter:
#   SPF    which servers may send            (one TXT, merged -- never duplicated)
#   DKIM   cryptographic signature           (provider-generated, so passed in)
#   DMARC  what to do when SPF/DKIM fail     (one TXT, generated here)
#
# THE CURRENT SPF IS `v=spf1 -all` -- "this domain sends no mail". Until it
# changes, every confirmation email is legitimately rejected by the recipient.

[CmdletBinding()]
param(
  [ValidateSet('resend','postmark','ses','mailgun','sendgrid')]
  [string]$Provider = 'resend',
  [string]$DkimFile,
  [string]$Zone = 'fishwizz.com',
  [ValidateSet('none','quarantine','reject')]
  [string]$DmarcPolicy = 'none',
  [string]$DmarcRua,
  [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'

# SPF include for each provider. Verify against your provider's own docs --
# these change, and a wrong include silently fails SPF.
$SpfInclude = @{
  resend   = 'include:amazonses.com'
  postmark = 'include:spf.mtasv.net'
  ses      = 'include:amazonses.com'
  mailgun  = 'include:mailgun.org'
  sendgrid = 'include:sendgrid.net'
}[$Provider]

if (-not $env:CLOUDFLARE_API_TOKEN) {
  Write-Host 'CLOUDFLARE_API_TOKEN is not set.' -ForegroundColor Red
  Write-Host "  Needs Zone -> DNS -> Edit on $Zone"
  exit 1
}

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

$z = Invoke-CF "/zones?name=$Zone"
if (-not $z.result -or $z.result.Count -eq 0) { Write-Host "zone $Zone not visible to this token" -ForegroundColor Red; exit 1 }
$zoneId = $z.result[0].id
Write-Host "zone $Zone  ($zoneId)"
Write-Host "provider: $Provider"
if ($WhatIf) { Write-Host 'WHATIF MODE -- nothing will be changed' -ForegroundColor Yellow }

function Get-Records { param([string]$Type, [string]$Name)
  (Invoke-CF "/zones/$zoneId/dns_records?type=$Type&name=$Name&per_page=100").result
}

function Set-Txt {
  param([string]$Name, [string]$Content, [string]$Label, [string]$MatchPrefix)
  $existing = @(Get-Records 'TXT' $Name | Where-Object { $_.content -like "$MatchPrefix*" })
  if ($existing.Count -gt 1) {
    Write-Host "  !! $Label`: $($existing.Count) records already match '$MatchPrefix'." -ForegroundColor Red
    $existing | ForEach-Object { Write-Host "       $($_.content)" }
    Write-Host '     Multiple SPF or DMARC records are a hard failure -- resolve by hand.' -ForegroundColor Red
    return
  }
  if ($existing.Count -eq 1) {
    if ($existing[0].content.Trim('"') -eq $Content) { Write-Host "  = $Label already correct"; return }
    Write-Host "  ~ $Label"
    Write-Host "      was: $($existing[0].content)"
    Write-Host "      now: $Content"
    if (-not $WhatIf) {
      Invoke-CF "/zones/$zoneId/dns_records/$($existing[0].id)" 'PUT' `
        @{ type='TXT'; name=$Name; content=$Content; ttl=1 } | Out-Null
    }
  } else {
    Write-Host "  + $Label"
    Write-Host "      $Content"
    if (-not $WhatIf) {
      Invoke-CF "/zones/$zoneId/dns_records" 'POST' `
        @{ type='TXT'; name=$Name; content=$Content; ttl=1; comment='FishWizz transactional email' } | Out-Null
    }
  }
}

# --- SPF --------------------------------------------------------------------
# Exactly one SPF record is permitted. Two means every check fails, so this
# always updates in place rather than adding.
Write-Host ''
Write-Host '==> SPF' -ForegroundColor Cyan
$spf = "v=spf1 $SpfInclude ~all"
Set-Txt -Name $Zone -Content $spf -Label 'SPF' -MatchPrefix 'v=spf1'
Write-Host '    ~all (softfail) not -all: during cutover a strict -all bounces mail'
Write-Host '    from any sender you have not listed yet. Tighten once delivery is proven.'

# --- DMARC ------------------------------------------------------------------
Write-Host ''
Write-Host '==> DMARC' -ForegroundColor Cyan
$dmarc = "v=DMARC1; p=$DmarcPolicy"
if ($DmarcRua) { $dmarc += "; rua=mailto:$DmarcRua" }
$dmarc += '; fo=1; adkim=r; aspf=r'
Set-Txt -Name "_dmarc.$Zone" -Content $dmarc -Label 'DMARC' -MatchPrefix 'v=DMARC1'
if ($DmarcPolicy -eq 'none') {
  Write-Host '    p=none is monitor-only, which is the correct start. Moving straight to'
  Write-Host '    p=reject before you know what is sending as fishwizz.com will silently'
  Write-Host '    drop real mail. Raise it after a couple of weeks of clean reports.'
}

# --- DKIM -------------------------------------------------------------------
Write-Host ''
Write-Host '==> DKIM' -ForegroundColor Cyan
if (-not $DkimFile) {
  Write-Host '    No -DkimFile given, so DKIM was not configured.' -ForegroundColor Yellow
  Write-Host ''
  Write-Host '    DKIM keys are generated per-domain by the provider, so they cannot be'
  Write-Host '    derived here. Add the domain in the provider dashboard, copy the'
  Write-Host '    records it shows, and save them as JSON:'
  Write-Host ''
  Write-Host '      [' -ForegroundColor DarkGray
  Write-Host '        { "type": "CNAME", "name": "resend._domainkey", "content": "..." },' -ForegroundColor DarkGray
  Write-Host '        { "type": "TXT",   "name": "s1._domainkey",     "content": "p=MIGf..." }' -ForegroundColor DarkGray
  Write-Host '      ]' -ForegroundColor DarkGray
  Write-Host ''
  Write-Host '    Then re-run with -DkimFile .\dkim.json'
} elseif (-not (Test-Path $DkimFile)) {
  Write-Host "    $DkimFile not found." -ForegroundColor Red
} else {
  $dkim = Get-Content $DkimFile -Raw | ConvertFrom-Json
  foreach ($r in $dkim) {
    $fqdn = if ($r.name -like "*$Zone") { $r.name } else { "$($r.name).$Zone" }
    $have = @(Get-Records $r.type $fqdn)
    if ($have.Count -gt 0 -and $have[0].content.Trim('"') -eq $r.content) {
      Write-Host "  = $($r.type) $fqdn already correct"; continue
    }
    $body = @{ type=$r.type; name=$fqdn; content=$r.content; ttl=1; comment='FishWizz DKIM' }
    # DKIM CNAMEs must NOT be proxied -- an orange-clouded record returns
    # Cloudflare's own answer and the signature check fails.
    if ($r.type -eq 'CNAME') { $body.proxied = $false }
    if ($have.Count -gt 0) {
      Write-Host "  ~ $($r.type) $fqdn"
      if (-not $WhatIf) { Invoke-CF "/zones/$zoneId/dns_records/$($have[0].id)" 'PUT' $body | Out-Null }
    } else {
      Write-Host "  + $($r.type) $fqdn"
      if (-not $WhatIf) { Invoke-CF "/zones/$zoneId/dns_records" 'POST' $body | Out-Null }
    }
  }
}

# --- verify -----------------------------------------------------------------
if (-not $WhatIf) {
  Write-Host ''
  Write-Host '==> Verifying from public DNS' -ForegroundColor Cyan
  Start-Sleep -Seconds 3
  foreach ($n in @($Zone, "_dmarc.$Zone")) {
    try {
      $r = Invoke-RestMethod -Uri "https://dns.google/resolve?name=$n&type=TXT" -UseBasicParsing
      $vals = @($r.Answer | Where-Object { $_.data -match 'spf1|DMARC1' } | ForEach-Object { $_.data.Trim('"') })
      if ($vals.Count -eq 0) { Write-Host "    $n : not visible yet (propagation)" }
      elseif ($vals.Count -gt 1) { Write-Host "    $n : $($vals.Count) records -- MUST be exactly one" -ForegroundColor Red }
      else { Write-Host "    $n : $($vals[0])" }
    } catch { Write-Host "    $n : lookup failed" -ForegroundColor Yellow }
  }
}

Write-Host @"

DNS done. The other half is in Supabase -- DNS alone sends nothing:

  Project Settings -> Authentication -> SMTP Settings -> Enable custom SMTP
    Sender email :  no-reply@$Zone
    Sender name  :  FishWizz
    Host/Port/User/Pass from $Provider
    Port 587 with STARTTLS unless the provider says otherwise

  Do this on BOTH projects. Staging sends confirmation emails too, and a
  beta tester hitting the built-in limiter fails exactly the way this set
  out to fix.

  Then raise Authentication -> Rate Limits, which stay low even with custom
  SMTP configured.

Verify before trusting it:
  1. Sign up on app.fishwizz.com with a real address you can read
  2. Confirm the mail arrives and is NOT in spam
  3. Check the headers show dkim=pass and spf=pass
     (Gmail: open the message -> Show original)

Only then tighten SPF to -all and raise DMARC to p=quarantine.
"@
