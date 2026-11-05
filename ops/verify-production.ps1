# Pembangun / Developer: Zrain
# Dicipta / Created (rekod Git terawal / first Git evidence): 2026-10-30
# Dikemas kini / Last updated: 2026-11-04
# Fail / File: ops/verify-production.ps1
# BM: Dokumentasi atau alat operasi monitoring.
# EN: Monitoring operational documentation or tooling.
# Read-only smoke test. No tokens, database changes or fake downtime.
$ErrorActionPreference = 'Stop'
$checks = @(
  @{ Name='Firebase website'; Url='https://zrain-monitor.web.app/' },
  @{ Name='Public How It Works'; Url='https://zrain-monitor.web.app/how-it-works.html' },
  @{ Name='Monitoring health (D1 + Cron)'; Url='https://zrain-monitor-api.zrain-dev.workers.dev/api/health/monitoring' },
  @{ Name='Worker liveness only'; Url='https://zrain-monitor-api.zrain-dev.workers.dev/api/health' }
)
foreach($c in $checks){
  try {
    $response = Invoke-WebRequest -Uri $c.Url -TimeoutSec 20 -UseBasicParsing
    Write-Host ($c.Name + ': HTTP ' + $response.StatusCode) -ForegroundColor Green
  } catch {
    $code = if($_.Exception.Response){[int]$_.Exception.Response.StatusCode}else{'Connection error'}
    Write-Warning ($c.Name + ': ' + $code + ' — check logs; do not assume the system is healthy')
  }
}
