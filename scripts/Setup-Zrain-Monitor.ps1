# Zrain Monitor: first deployment on Firebase Spark + Cloudflare Workers/D1 Free.
# Run this script from the extracted project's scripts directory.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Need([string]$Label, [string]$Default = '') {
    $reply = Read-Host ($Label + $(if($Default) { " [$Default]" } else { '' }))
    if ([string]::IsNullOrWhiteSpace($reply)) { $reply = $Default }
    if ([string]::IsNullOrWhiteSpace($reply)) { throw "Missing: $Label" }
    return $reply.Trim()
}
function CheckExit([string]$Step) {
    if ($LASTEXITCODE -ne 0) { throw "$Step failed; deployment stopped." }
}
if (!(Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22 LTS first.' }
if (!(Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm is missing.' }
if (!(Get-Command firebase -ErrorAction SilentlyContinue)) { throw 'Install Firebase CLI first: npm install -g firebase-tools' }
Write-Host "`nZRAIN MONITOR v1.0 | Free-tier setup" -ForegroundColor Cyan
Write-Host 'You need a Firebase Spark project with Google sign-in enabled and a Cloudflare Free account.'
Write-Host 'Setup will never upgrade account plans or enable billing.'

$projectId = Need 'Firebase project ID (e.g. zrain-monitor)' 'zrain-monitor'
$siteId = Need 'Firebase Hosting site ID' 'zrain-monitor'
$apiKey = Need 'Firebase Web API key (public)'
$appId = Need 'Firebase Web App ID (public)'
$adminUid = Need 'Your Firebase Authentication user UID (first log in at Firebase Console Auth)'
$cfSubdomain = Need 'Your Cloudflare workers.dev account subdomain (without .workers.dev)'
$dbId = Need 'D1 database UUID from: npx wrangler d1 create zrain-monitor'
$extraHosts = Read-Host 'Optional extra allowed HTTPS hostnames, comma separated (blank for none)'
if ($dbId -notmatch '^[0-9a-fA-F-]{36}$') { throw 'Invalid D1 database UUID.' }
foreach($val in @($projectId,$siteId,$cfSubdomain)) { if($val -notmatch '^[a-z0-9][a-z0-9-]{2,61}$') { throw "Invalid project, site or subdomain: $val" } }
if($apiKey -notmatch '^AIza') { throw 'Firebase Web API key does not have the expected format.' }
if($appId -notmatch '^1:\d+:web:') { throw 'Firebase Web App ID does not have the expected format.' }
if($adminUid -notmatch '^[A-Za-z0-9_-]{6,128}$') { throw 'Invalid Firebase UID.' }

$backupDir = Join-Path $root ('config-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Copy-Item '.\wrangler.toml' $backupDir
Copy-Item '.\public\firebase-config.js' $backupDir
Copy-Item '.\firebase.json' $backupDir

$toml = Get-Content '.\wrangler.toml' -Raw
function SetToml([string]$key,[string]$value){
    $escaped = $value.Replace('\','\\').Replace('"','\"')
    $script:toml = [regex]::Replace($script:toml, '(?m)^'+[regex]::Escape($key)+' = ".*"$', "$key = `"$escaped`"")
}
SetToml 'database_id' $dbId
SetToml 'FIREBASE_PROJECT_ID' $projectId
SetToml 'BETA_ADMIN_UID' $adminUid
SetToml 'ALLOWED_ORIGIN' "https://$siteId.web.app"
SetToml 'ALLOWED_HOSTS' $extraHosts
[System.IO.File]::WriteAllText((Join-Path $root 'wrangler.toml'), $toml, (New-Object System.Text.UTF8Encoding($false)))

$config = @"
export const FIREBASE_CONFIG = {
  apiKey: "$apiKey",
  authDomain: "$projectId.firebaseapp.com",
  projectId: "$projectId",
  appId: "$appId"
};
export const API_ORIGIN = "https://zrain-monitor-api.$cfSubdomain.workers.dev";
"@
[System.IO.File]::WriteAllText((Join-Path $root 'public\firebase-config.js'), $config, (New-Object System.Text.UTF8Encoding($false)))
$firebaseJson = Get-Content '.\firebase.json' -Raw | ConvertFrom-Json
$firebaseJson.hosting.site = $siteId
$jsonText = $firebaseJson | ConvertTo-Json -Depth 20
[System.IO.File]::WriteAllText((Join-Path $root 'firebase.json'), $jsonText, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "`nInstalling pinned Zrain UI and tooling..." -ForegroundColor Cyan
npm install
CheckExit 'npm install'
npm run ui:sync
CheckExit 'Zrain UI sync'
npm run test:release
CheckExit 'Tests'

Write-Host "`nChecking Firebase Hosting site $siteId ..." -ForegroundColor Cyan
firebase hosting:sites:get $siteId --project $projectId
CheckExit 'Firebase Hosting site check: enable Hosting in Firebase Console first'
Write-Host "`nApplying D1 schema to remote database..." -ForegroundColor Cyan
npx wrangler d1 migrations apply zrain-monitor --remote
CheckExit 'D1 migration'
Write-Host "`nDeploying independent Cloudflare Worker..." -ForegroundColor Cyan
npx wrangler deploy
CheckExit 'Worker deploy'
Write-Host "`nDeploying Firebase Hosting..." -ForegroundColor Cyan
firebase deploy --only hosting --project $projectId
CheckExit 'Firebase Hosting deploy'
Write-Host "`nSUCCESS. Website: https://$siteId.web.app" -ForegroundColor Green
Write-Host "API: https://zrain-monitor-api.$cfSubdomain.workers.dev/api/health"
Write-Host "Original configurations backed up in: $backupDir"
Write-Host 'IMPORTANT: Test the real Render endpoints; keep UptimeRobot enabled during the seven-day parallel verification.'
