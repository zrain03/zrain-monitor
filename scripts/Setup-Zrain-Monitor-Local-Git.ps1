# Pembangun / Developer: Zrain
# Dicipta / Created (rekod Git terawal / first Git evidence): 2026-10-30
# Dikemas kini / Last updated: 2026-11-04
# Fail / File: scripts/Setup-Zrain-Monitor-Local-Git.ps1
# BM: Skrip operasi, konfigurasi atau deployment Monitor.
# EN: Monitor operations, configuration or deployment script.
# Optional local source control setup; does not publish files or commit secrets.
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
Push-Location $project
try {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git is not installed.' }
  if (-not (Test-Path (Join-Path $project '.git'))) {
    & git init
    if ($LASTEXITCODE -ne 0) { throw 'Git init failed.' }
  }
  Write-Host 'Local Git is available. No files were staged or uploaded.' -ForegroundColor Green
  & git status --short
  Write-Host 'Review source and .gitignore before creating a PRIVATE remote repository and committing.'
} finally { Pop-Location }
