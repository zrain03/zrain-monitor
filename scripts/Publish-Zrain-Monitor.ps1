# Optional one-command GitHub publication, after GitHub CLI (gh) is installed and authenticated.
# Never runs a deployment; it only backs up source code to your GitHub repository.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if (!(Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git is not installed.' }
if (!(Get-Command gh -ErrorAction SilentlyContinue)) { throw 'Install GitHub CLI from https://cli.github.com and run gh auth login.' }
gh auth status
if ($LASTEXITCODE -ne 0) { throw 'Run gh auth login to connect your GitHub account.' }
if (!(Test-Path '.git')) { git init; git branch -M main }
if ($LASTEXITCODE -ne 0) { throw 'Git init failed.' }
git add .
if ($LASTEXITCODE -ne 0) { throw 'Git add failed.' }
git diff --cached --stat
git diff --cached --quiet
if ($LASTEXITCODE -eq 1) {
    git commit -m 'feat: initial Zrain Monitor independent beta'
    if ($LASTEXITCODE -ne 0) { throw 'Git commit failed.' }
}
$existing = git remote get-url origin 2>$null
if ($LASTEXITCODE -eq 0 -and $existing) {
    if ($existing -notmatch 'zrain03/zrain-monitor') { throw "Existing origin is not Zrain Monitor: $existing" }
    git push -u origin main
    if ($LASTEXITCODE -ne 0) { throw 'Git push failed.' }
} else {
    # gh creates the repository, remote and first push, without rewriting other repositories.
    gh repo create zrain03/zrain-monitor --public --source . --remote origin --push
    if ($LASTEXITCODE -ne 0) { throw 'GitHub repository creation/push failed.' }
}
git status -sb
