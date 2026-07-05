# Deploys the PDF converter service (converter/) to Railway and points the
# production Vercel app at it. Idempotent: safe to re-run.
#
#   .\scripts\deploy-converter.ps1
#
# Requires: railway CLI (npm i -g @railway/cli) and vercel CLI, both logged in
# (the script opens the Railway browser login if needed).

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$conv = Join-Path $repo "converter"

# --- 1) Railway auth -------------------------------------------------------
railway whoami 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Opening Railway login in your browser - click Verify..."
  railway login
  if ($LASTEXITCODE -ne 0) { throw "Railway login failed" }
}

Set-Location $conv

# --- 2) Project + service (create once, reuse afterwards) ------------------
railway status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  railway init --name docsify-pdf-converter
  if ($LASTEXITCODE -ne 0) { throw "railway init failed" }
}
railway add --service pdf-converter 2>$null | Out-Null
# (fails harmlessly if the service already exists)

# --- 3) Shared secret ------------------------------------------------------
$existing = railway variable list --service pdf-converter --kv 2>$null | Out-String
$m = [regex]::Match($existing, "CONVERT_TOKEN=(\S+)")
if ($m.Success) {
  $token = $m.Groups[1].Value
  Write-Host "Reusing existing CONVERT_TOKEN."
} else {
  $hex = "0123456789abcdef"
  $token = -join (1..48 | ForEach-Object { $hex[(Get-Random -Maximum 16)] })
  railway variable set "CONVERT_TOKEN=$token" "CONVERT_VERBOSE=1" --service pdf-converter --skip-deploys
  if ($LASTEXITCODE -ne 0) {
    # older CLI fallback syntax
    railway variables --set "CONVERT_TOKEN=$token" --set "CONVERT_VERBOSE=1" --service pdf-converter --skip-deploys
    if ($LASTEXITCODE -ne 0) { throw "setting Railway variables failed" }
  }
}

# --- 4) Deploy (streams build logs, exits when live) ------------------------
railway up --ci --service pdf-converter
if ($LASTEXITCODE -ne 0) { throw "railway up failed - see build logs above" }

# --- 5) Public domain -------------------------------------------------------
$raw = railway domain --service pdf-converter --json 2>&1 | Out-String
$dm = [regex]::Match($raw, "[a-z0-9.-]+\.up\.railway\.app")
if (-not $dm.Success) { throw "Could not determine the Railway domain from: $raw" }
$url = "https://$($dm.Value)"
Write-Host "Converter URL: $url"

# --- 6) Wait until the engine is warm ---------------------------------------
Write-Host "Waiting for the LibreOffice engine to warm up..."
$deadline = (Get-Date).AddMinutes(10)
$warm = $false
while ((Get-Date) -lt $deadline) {
  try {
    $h = Invoke-RestMethod "$url/healthz" -TimeoutSec 5
    if ($h.warm) { $warm = $true; break }
  } catch { }
  Start-Sleep -Seconds 5
}
if (-not $warm) {
  throw "Converter not healthy after 10 min. Check: railway logs --service pdf-converter -n 100"
}
Write-Host "Engine is warm."

# --- 7) Vercel production env vars ------------------------------------------
Set-Location $repo
$token | vercel env add PDF_CONVERTER_TOKEN production --force
if ($LASTEXITCODE -ne 0) { throw "vercel env add PDF_CONVERTER_TOKEN failed" }
$url | vercel env add PDF_CONVERTER_URL production --force
if ($LASTEXITCODE -ne 0) { throw "vercel env add PDF_CONVERTER_URL failed" }

# --- 8) Fresh production deployment so the env vars take effect --------------
vercel --prod --yes
if ($LASTEXITCODE -ne 0) { throw "vercel --prod failed" }

Write-Host ""
Write-Host "Done. Open a document and click the PDF download - it should return"
Write-Host "in ~1-3 s. Watch it live with:  vercel logs --follow"
Write-Host "(look for excel-to-pdf converted with engine:'remote')"
