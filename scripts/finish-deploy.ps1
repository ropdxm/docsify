# Final step after the converter is live on Railway: points production Vercel
# at it and redeploys. Reads the token straight from Railway - nothing to paste.
#
#   .\scripts\finish-deploy.ps1

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot

# Token and domain from the already-deployed Railway service.
Set-Location (Join-Path $repo "converter")
$kv = railway variable list --service pdf-converter --kv 2>&1 | Out-String
$tm = [regex]::Match($kv, "CONVERT_TOKEN=([0-9a-f]+)")
if (-not $tm.Success) { throw "CONVERT_TOKEN not found - is the service deployed? (railway status)" }
$token = $tm.Groups[1].Value

$raw = railway domain --service pdf-converter --json 2>&1 | Out-String
$dm = [regex]::Match($raw, "[a-z0-9.-]+\.up\.railway\.app")
if (-not $dm.Success) { throw "Railway domain not found: $raw" }
$url = "https://$($dm.Value)"
Write-Host "Converter: $url"

# Production env vars + fresh deployment (env vars only apply to new deploys).
Set-Location $repo
$token | vercel env add PDF_CONVERTER_TOKEN production --force
if ($LASTEXITCODE -ne 0) { throw "vercel env add PDF_CONVERTER_TOKEN failed" }
$url | vercel env add PDF_CONVERTER_URL production --force
if ($LASTEXITCODE -ne 0) { throw "vercel env add PDF_CONVERTER_URL failed" }

vercel --prod --yes
if ($LASTEXITCODE -ne 0) { throw "vercel --prod failed" }

Write-Host ""
Write-Host "Done. Click a PDF download on www.docsify.xyz - expect ~1-3 s."
Write-Host "Live check:  vercel logs --follow   (look for engine:'remote')"
