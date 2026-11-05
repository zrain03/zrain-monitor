# Pembangun / Developer: Zrain
# Dicipta / Created (rekod Git terawal / first Git evidence): 2026-10-30
# Dikemas kini / Last updated: 2026-11-04
# Fail / File: scripts/Publish-Zrain-Monitor.ps1
# BM: Penghadang operasi legasi: skrip lama ditulis semasa repo belum wujud, dan tersasar ke branch main.
# EN: Legacy safety gate: the old script predated the repository and targeted the wrong main branch.
# BM: Jangan stage semua backup tempatan atau cuba mencipta semula repository private yang sudah ada.
# EN: Never stage all local historical backups or recreate the existing private repository.
$ErrorActionPreference = 'Stop'
throw @'
Deprecated Zrain Monitor GitHub publisher. No files were staged, committed or pushed.
The official repository already exists as zrain03/zrain-monitor (private), branch master.
Use the verified 2026-11-04 GitHub-ready ZIP and its Publish-Zrain-Monitor-Verified-2026-11-04.ps1 instead.
That workflow clones remote master, preserves Community Feedback, runs tests and pushes without force.
'@
