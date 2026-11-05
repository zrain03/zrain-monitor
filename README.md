<!--
Pembangun / Developer: Zrain
Dicipta / Created (rekod Git terawal / first Git evidence): 2026-10-30
Dikemas kini / Last updated: 2026-11-04
Fail / File: README.md
BM: Fail sokongan Zrain Monitor.
EN: Zrain Monitor supporting file.
-->

# Zrain Monitor v1.0 | Independent uptime and Keep-Awake platform

**Developed by Zrain** | Contact: zrain.dev@gmail.com

A new, standalone website and API monitor built for Firebase Hosting Spark + Cloudflare Workers Free + Cloudflare D1 Free. Zrain Monitor's Cron scheduler does not depend on Render, the user's browser or GitHub Actions. The product uses the official pinned Zrain UI design system without sharing user databases or authentication with Zrain Links.

## What is included

- Browser dashboard: Firebase Auth email/password + Google sign-in, email verification, password reset, private workspace, monitor cards, full monitor details, recent checks, incidents, in-app notifications, admin scheduler health, account data deletion.
- Cloudflare Worker: public `/api/health`, Firebase ID token signature/issuer/audience verification using Google's JWKS, strict owner authorization, CRUD, bounded manual checks, admin API and Cron handler.
- Scheduler: every **one minute** (to spread due work across bounded six-monitor batches); **each monitor is checked every five minutes**. GET-only HTTPS, 12-second timeout, no redirects, no response body stored. Creates incidents after two consecutive failures and closes them after two successes. Last successful status becomes UNKNOWN when the last check is older than 15 minutes.
- D1 schema and migration, 30-day check retention, daily summary history, bounded global/private-beta quotas, automated Node unit and real SQLite integration tests.
- No paid services or billing are required by the project. Free tiers still have quotas and no uptime guarantees.

**Public beta launch boundary:** Any signed-in Firebase user with a verified email may create monitors within quotas and the supported HTTPS destination allowlist. `BETA_ADMIN_UID` still grants access to administrator diagnostics. URL support is limited to known public hosting suffixes plus explicitly configured exact hostnames. Public arbitrary-domain monitoring requires stronger per-domain ownership verification and SSRF defenses; the initial beta must **not** be advertised as an unrestricted public monitoring service.

## Installation and accounts (one-time)

1. Create a **Firebase project on Spark** dedicated to Monitor, e.g. `zrain-monitor`. Enable Firebase Authentication **Email/Password** and **Google**. Register a Web app in Firebase Console and copy its public Firebase Web config: `apiKey`, `projectId`, `appId`. Enable Hosting and verify its site ID, ideally `zrain-monitor`. Add your Hosting domain in Firebase Auth **Authorized domains**. Firebase console configuration requires your login; this project never writes credentials on your behalf.
2. Sign in with the account you want to administer in Firebase Authentication and copy its UID from Firebase Console > Authentication > Users. The configured UID grants access to administrator-only System Health diagnostics. Public monitor creation is controlled separately by `PUBLIC_MONITOR_CREATION`.
3. Create a **Cloudflare Free** account. Find its Workers subdomain in Dashboard > Workers & Pages. Install Node.js 22, Firebase CLI (`npm install -g firebase-tools`), and authenticate (`firebase login`, `npx wrangler login`). No paid tiers or credit-card upgrades.
4. Keep the active repository at `Zrain\Projects\zrain-monitor`. For a **new setup only**, open PowerShell and run:

```powershell
cd "$env:USERPROFILE\Downloads\Zrain\Projects\zrain-monitor"
npm ci
npx wrangler d1 create zrain-monitor
```

5. Copy the displayed D1 `database_id`. If your database already exists, use its existing ID instead of creating a duplicate. Run:

```powershell
Unblock-File .\scripts\Setup-Zrain-Monitor.ps1
& .\scripts\Setup-Zrain-Monitor.ps1
```

6. Answer the setup prompts for Firebase project, Hosting site, Firebase Web API key, Web app ID, admin UID, Cloudflare Workers subdomain and D1 database UUID. The setup script backs up old configuration, writes public config files, checks  the pinned Zrain UI, runs tests, applies migrations and deploys Worker and Hosting. If a service has not been initialized in its console, the script stops with a clear error rather than falsely claiming deployment.
7. Test `https://<site>.web.app` and `https://zrain-monitor-api.<subdomain>.workers.dev/api/health`. Sign in, create one monitor, then inspect the Cloudflare Cron Trigger and D1 records. Use **real, confirmed Render URLs**. Avoid inventing URL paths such as `/health` if your app does not expose them.
8. For normal releases, use `npm run deploy:worker` and/or `npm run deploy:web` separately after tests and explicit review. The legacy combined `scripts\Deploy-Zrain-Monitor.ps1` also applies remote D1 migrations, so it is not intended for a web-only styling or Community Feedback update.

## Keep-Awake migration: do not turn off UptimeRobot immediately

1. Record every real UptimeRobot URL, method and interval currently used for Guess The Flag or Memory Rush. Determine which hosts are Render backends versus Firebase-hosted frontends.
2. Confirm whether the targets are in an allowed hosting suffix. Only choose safe GET endpoints that have no side effects or user data.
3. Add these URL(s) to Zrain Monitor using **Keep-Awake** purpose; record the first check and actual intervals. The 5-minute interval can reduce inactivity sleep, but Render service limits, restarts and service-hour quotas may still apply.
4. Leave UptimeRobot enabled for **at least seven days**. Compare timestamps, Cron run history, target backend logs, successful requests and cold starts. Then disable individual UptimeRobot monitors one at a time while confirming the game remains operational. Re-enable the old monitor if Zrain Monitor misses runs.
5. Never claim 100% uptime from a finite set of checks. Dashboard shows observed checks and stale/unknown data where appropriate.

## API endpoints

All except `GET /api/health` require `Authorization: Bearer <Firebase ID token>`:

| Method | Route | Description |
|---|---|---|
| GET | `/api/me` | Current user and quota |
| GET, POST | `/api/monitors` | List and create beta monitors |
| GET, PATCH, DELETE | `/api/monitors/:id` | Read, rename, change purpose, pause/resume, delete |
| GET | `/api/monitors/:id/checks` | Recent checks, optional `limit` |
| GET | `/api/monitors/:id/incidents` | Incidents |
| GET | `/api/monitors/:id/summary` | Daily summaries |
| POST | `/api/monitors/:id/check-now` | Rate-limited manual check |
| GET | `/api/notifications` | Recent incident events |
| POST | `/api/notifications/read` | Mark notifications read |
| GET | `/api/admin/system` | Administrator-only scheduler diagnostics |
| DELETE | `/api/account/data` | Remove all of caller's monitoring data |

Account deletion in frontend uses this data deletion API then Firebase Auth deletion. A recent sign-in may be required by Firebase. If Firebase account deletion fails after data removal, sign in again and retry or contact support.

## Reliability and capacity notes

- Free Workers have per-invocation CPU and subrequest ceilings. Every Cron run claims at most six due monitors; monitor checks run every five minutes. A one-minute Cron prevents many due monitors waiting five extra minutes for another batch, but this is still best-effort.
- Scheduler runs are stored in D1. A successful Cron invocation is different from a successful target check. Two consecutive target failures confirm downtime; a missed scheduler run never turns a target DOWN by itself.
- When the service is paused or a concurrent job wins its lease, abandoned work is not recorded as a successful check.
- D1 detailed check results older than 30 days are removed in batches, and daily summaries are kept for 90 days. Incident history remains until deletion.
- Monitoring on Render Free cannot override the hosting company's free instance-hour quota. 24/7 operation of multiple free services may exhaust available hours.
- Only `https` and known public hosting suffixes are accepted during private beta. No localhost, IP literal, custom ports, embedded credentials, automatic redirect or response-body storage.
- Firebase Auth sign-in methods and authorized domains **must** be configured in Firebase Console. The sample Firebase Web API key is a public client identifier and must be provided after creating the Firebase project; do not share service-account secrets.

## Local development and testing

```powershell
npm ci
npm run ui:sync
npm test
npm run test:release
npm run db:local
npm run dev
```

Call `http://localhost:8787/cdn-cgi/local/scheduled` to test the scheduled handler. Local Firebase Auth requires a real test project and a configured frontend; static unit tests do not prove live Firebase sign-in works.

## Security and privacy

No passwords, private keys, Google service-account credentials or GitHub tokens are included in the repository. Auth tokens are verified with Google's published Firebase RS256 public keys. Each monitor query is scoped to the authenticated owner. Admin UID is configured in Wrangler and checked server-side. CORS only permits the configured Firebase Hosting origin. Data deletion cascades monitoring records through D1 foreign keys. Privacy Policy is at `/privacy.html` and support email is **zrain.dev@gmail.com**.

## Repository and deployment policy

This is an **independent product** with an existing **private GitHub repository** at `github.com/zrain03/zrain-monitor`, default branch `master`. Do not combine its database or authentication with Zrain Links. GitHub Actions runs tests and the optional independent-watchdog workflow, not the core monitoring scheduler. Cloudflare Worker + D1 + Cron and Firebase Hosting have been deployed; this documentation does not assert that every authenticated user flow or Telegram delivery was manually verified.

## GitHub source sync (existing private repository / Repositori private sedia ada)

**BM:** Repository `zrain03/zrain-monitor` sudah wujud dengan branch `master`. Jangan jalankan skrip *create repository* lama atau `git init` lagi. Sebelum push, pastikan integrasi Community Feedback daripada commit GitHub `e716227` tidak hilang, buat backup, dan jalankan ujian pada snapshot yang hendak di-commit. Jangan stage backup, `.env`, `.firebase`, `node_modules` atau fail credential. Jangan gunakan force push.

**EN:** The existing private repository is `zrain03/zrain-monitor` on `master`. Do not reinitialize or recreate it. Preserve the Community Feedback changes from GitHub commit `e716227`, back up first, and test the exact source before publishing. Never stage backups, `.env`, `.firebase`, `node_modules` or credentials, and never force-push.

**BM:** Untuk sync yang menjaga working tree tempatan, gunakan skrip `Publish-Zrain-Monitor-Verified-2026-11-04.ps1` yang dibekalkan bersama pakej ZIP serahan. Skrip menggunakan clone sementara pada tip remote, memasang fail source yang telah diaudit, menjalankan test, memeriksa remote tidak berubah, dan kemudian push biasa. Source aktif tempatan tidak dipadam. Simpan backup sebelum menjalankan operasi.

**EN:** Use the accompanying `Publish-Zrain-Monitor-Verified-2026-11-04.ps1` script to stage an isolated temporary clone at the current remote tip, overlay the audited source, run tests, confirm the remote has not advanced, and perform a normal push. The active project tree is not deleted or reset. Keep the pre-push backup.

## Public beta access (October 2026)

Anyone with a signed-in, verified Firebase account can create and manage their own monitors when `PUBLIC_MONITOR_CREATION=true` is deployed. Accounts are isolated by verified UID and existing ownership checks. Each user has a limited monitor quota, global beta capacity is 30 with a six-monitor-per-minute scheduler batch (best-effort and subject to Cloudflare Free limits), and supported public HTTPS hosting destinations remain restricted by the existing validation rules. The System Health administrator dashboard remains admin-only. Do not claim that arbitrary private/internal URLs can be monitored.

## 2026-11-04 engineering repair / Pembaikan engineering

**BM:** Source aktif ialah `Zrain/Projects/zrain-monitor/`; arahan pemasangan terkini telah diselaraskan. ZIP yang telah dibaiki mempin Zrain UI kepada commit `a109401fa591afa9f66479fa8d86f1ed1679d70b` dan menggunakan Golden Reference header/footer pada Dashboard, How it works dan Privacy. Dashboard routing, Firebase Auth, Worker, D1, Cron dan Telegram tidak ditukar. Baca `docs/REPAIR_AUDIT_2026-11-04.md` sebelum merge, deploy atau commit.

**EN:** The canonical workspace is `Zrain/Projects/zrain-monitor/`; installation instructions above now reflect the agreed location. The repaired source pins Zrain UI to commit `a109401fa591afa9f66479fa8d86f1ed1679d70b` and uses the Golden Reference header/footer on Dashboard, How it works and Privacy. Dashboard routing, Firebase Auth, Worker, D1, Cron and Telegram are unchanged. Read `docs/REPAIR_AUDIT_2026-11-04.md` before merging, deploying or committing.

## Community feedback preservation / Pengekalan maklum balas komuniti (2026-11-04)

**BM:** Fail `public/feedback-embed.js` dan `public/feedback.css` serta rujukannya pada tiga halaman dipulihkan daripada fungsi yang diterbitkan pada commit GitHub `e716227` (1 November 2026). CSP Firebase hanya membenarkan `api.github.com` dan `avatars.githubusercontent.com` untuk memaparkan komen awam. Komen dipaparkan sebagai teks untuk mengelakkan HTML tidak dipercayai. Pelawat boleh membaca tanpa login, tetapi menulis komen memerlukan akaun GitHub. Moderasi hanya dibuat oleh pengendali repository di GitHub, bukan melalui butang admin khas Monitor. Had rate limit atau ralat GitHub menyebabkan pautan ke thread dipaparkan sebagai fallback.

**EN:** `public/feedback-embed.js`, `public/feedback.css`, and the corresponding references on all three pages restore the Community Feedback functionality introduced in GitHub commit `e716227` (1 November 2026). Firebase CSP narrowly allows `api.github.com` and `avatars.githubusercontent.com` for public comments. Comments render as plain text, not untrusted HTML. Reading requires no login; writing requires a GitHub account. Moderation occurs through GitHub repository permissions, not a Monitor admin endpoint. On GitHub failure or rate limits, users retain a link to the discussion.

**BM / EN:** See `docs/COMPLETION_AUDIT_2026-11-04.md` for the exact verification scope and remaining manual checks.
