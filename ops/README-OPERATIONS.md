# Zrain Monitor — v1.0.21 operational runbook

## Health endpoints
- `/api/health`: Worker liveness ONLY. HTTP 200 does not mean monitoring runs.
- `/api/health/monitoring`: Cron and D1 health; HTTP 200 healthy, 503 degraded. No private monitor information is exposed.
- Admin System Health: detailed last run, D1 and Cron status; only the configured admin can read it.
- A recent successful Cron indicates the scheduler ran, NOT that every website is online.

## Independent watchdog (manual setup)
Create a separate external HTTP monitor (e.g. service outside the Zrain Monitor Worker) against:
`https://zrain-monitor-api.zrain-dev.workers.dev/api/health/monitoring`
Use 5-minute checks, treat non-2xx / timeout as alert. Verify this externally; the included test suite cannot create a monitoring account on your behalf. This endpoint is public and each check causes two small D1 queries; do not use an unusually high request frequency.

## Telegram users
- Open Settings > Connect Telegram, tap Start in the bot.
- Bot message `/status` reports connected status and count of monitors with alerts enabled.
- `/help` lists commands; `/stop` disconnects.
- Then enable incident alerts PER MONITOR in Monitor details.
- Click Send test message in Settings; 5-minute cooldown, per-account. It does not cause downtime.
- Delivery log shows latest test messages and confirmed incident deliveries for that account only.
- `SENT` means the Telegram API accepted delivery, not that the user read the message.
- DOWN/RECOVERED require confirmed transitions; test messages are separate.

## Before deploying
1. Inspect local source changes and ensure no secrets in any staged files.
2. Export a REMOTE D1 backup **before** migration or deployment (backup helper is provided).
3. Apply `0004_reliability.sql` to remote D1. This is additive and retains old data.
4. Run `npm run test:release` and inspect results.
5. Deploy Worker FIRST; then deploy Firebase Hosting.
6. Verify monitoring-health endpoint, Firebase site, bot /status and test message.
7. Do not disrupt actual apps for testing. Confirm real DOWN/RECOVERED on a dedicated test endpoint only.

## Backups & Git
- `scripts/Backup-Zrain-Monitor.ps1` makes a timestamped remote D1 SQL export outside the repository. The database backup is sensitive; do not publish or upload it in a public repository.
- `.gitignore` excludes secrets and local SQL backups. Audit `git status` and `git diff --cached` before commit.
- `.github/workflows/tests.yml` runs release tests on GitHub only after you have created a **private** remote repository and pushed the code. The script does not create a GitHub repository or push automatically.
- For ongoing safety, configure an external scheduled backup separately. Running the helper once is not automated recurring backup.

## On-device optional setup
- Run `scripts/Setup-Zrain-Monitor-Local-Git.ps1` to initialize local Git; it does not push or commit.
- Run `scripts/Register-Zrain-Monitor-Daily-Backup.ps1` if you want an optional 21:00 local Windows backup task. It is **not cloud-reliable** when the laptop is off.
- Run `ops/verify-production.ps1` after deploy for read-only smoke checks; a 503 from the detailed health endpoint requires investigation.
- Configure GitHub private repository, an independent uptime watcher, and hosted backup credentials on their respective services separately; these require authenticated external actions and cannot be silently provisioned by this patch.
