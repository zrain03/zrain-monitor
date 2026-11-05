# Pembangun / Developer: Zrain
# Dicipta / Created (rekod Git terawal / first Git evidence): 2026-10-30
# Dikemas kini / Last updated: 2026-11-04
# Fail / File: scripts/Deploy-Zrain-Monitor.ps1
# BM: Skrip operasi, konfigurasi atau deployment Monitor.
# EN: Monitor operations, configuration or deployment script.
# Use after initial setup. No secrets or billing actions are required.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$config = Get-Content '.\public\firebase-config.js' -Raw
if ($config -match 'REPLACE_WITH') { throw 'First run scripts/Setup-Zrain-Monitor.ps1.' }
$firebase = Get-Content '.\firebase.json' -Raw | ConvertFrom-Json
$toml = Get-Content '.\wrangler.toml' -Raw
if($toml -match 'REPLACE_WITH') { throw 'Configure Worker and D1 first.' }
Write-Host 'Running Zrain Monitor release checks...' -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
npm run ui:sync
if ($LASTEXITCODE -ne 0) { throw 'UI sync failed' }
npm run test:release
if ($LASTEXITCODE -ne 0) { throw 'Release tests failed' }
npx wrangler d1 migrations apply zrain-monitor --remote
if ($LASTEXITCODE -ne 0) { throw 'D1 migrations failed' }
npx wrangler deploy
if ($LASTEXITCODE -ne 0) { throw 'Worker deployment failed' }
$match = [regex]::Match($toml,'(?m)^FIREBASE_PROJECT_ID = "([^"]+)"$')
if(!$match.Success) { throw 'Firebase project missing in Wrangler configuration' }
firebase deploy --only hosting --project $match.Groups[1].Value
if ($LASTEXITCODE -ne 0) { throw 'Firebase Hosting deployment failed' }
Write-Host ('Deployed: https://' + $firebase.hosting.site + '.web.app') -ForegroundColor Green
