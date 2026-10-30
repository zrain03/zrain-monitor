# Zrain Monitor v1.0 | Independent uptime and Keep-Awake platform

**Developed by Zrain** | Contact: zrain.dev@gmail.com

A new, standalone website and API monitor built for Firebase Hosting Spark + Cloudflare Workers Free + Cloudflare D1 Free. Zrain Monitor's Cron scheduler does not depend on Render, the user's browser or GitHub Actions. The product uses the official pinned Zrain UI design system without sharing user databases or authentication with Zrain Links.

## What is included

- Browser dashboard: Firebase Auth email/password + Google sign-in, email verification, password reset, private workspace, monitor cards, full monitor details, recent checks, incidents, in-app notifications, admin scheduler health, account data deletion.
- Cloudflare Worker: public `/api/health`, Firebase ID token signature/issuer/audience verification using Google's JWKS, strict owner authorization, CRUD, bounded manual checks, admin API and Cron handler.
- Scheduler: every **one minute** (to spread due work across bounded three-monitor batches); **each monitor is checked every five minutes**. GET-only HTTPS, 12-second timeout, no redirects, no response body stored. Creates incidents after two consecutive failures and closes them after two successes. Last successful status becomes UNKNOWN when the last check is older than 15 minutes.
- D1 schema and migration, 30-day check retention, daily summary history, bounded global/private-beta quotas, automated Node unit and real SQLite integration tests.
- No paid services or billing are required by the project. Free tiers still have quotas and no uptime guarantees.

**Public beta launch boundary:** Any signed-in Firebase user with a verified email may create monitors within quotas and the supported HTTPS destination allowlist. `BETA_ADMIN_UID` still grants access to administrator diagnostics. URL support is limited to known public hosting suffixes plus explicitly configured exact hostnames. Public arbitrary-domain monitoring requires stronger per-domain ownership verification and SSRF defenses; the initial beta must **not** be advertised as an unrestricted public monitoring service.

## Installation and accounts (one-time)

1. Create a **Firebase project on Spark** dedicated to Monitor, e.g. `zrain-monitor`. Enable Firebase Authentication **Email/Password** and **Google**. Register a Web app in Firebase Console and copy its public Firebase Web config: `apiKey`, `projectId`, `appId`. Enable Hosting and verify its site ID, ideally `zrain-monitor`. Add your Hosting domain in Firebase Auth **Authorized domains**. Firebase console configuration requires your login; this project never writes credentials on your behalf.
2. Sign in with the account you want to administer in Firebase Authentication and copy its UID from Firebase Console > Authentication > Users. The configured UID grants access to administrator-only System Health diagnostics. Public monitor creation is controlled separately by `PUBLIC_MONITOR_CREATION`.
3. Create a **Cloudflare Free** account. Find its Workers subdomain in Dashboard > Workers & Pages. Install Node.js 22, Firebase CLI (`npm install -g firebase-tools`), and authenticate (`firebase login`, `npx wrangler login`). No paid tiers or credit-card upgrades.
4. Extract the ZIP into `Downloads\zrain-monitor`. In PowerShell run:

```powershell
cd "$env:USERPROFILE\Downloads\zrain-monitor"
npm install
npx wrangler d1 create zrain-monitor
```

5. Copy the displayed D1 `database_id`. If your database already exists, use its existing ID instead of creating a duplicate. Run:

```powershell
Unblock-File .\scripts\Setup-Zrain-Monitor.ps1
& .\scripts\Setup-Zrain-Monitor.ps1
```

6. Answer the setup prompts for Firebase project, Hosting site, Firebase Web API key, Web app ID, admin UID, Cloudflare Workers subdomain and D1 database UUID. The setup script backs up old configuration, writes public config files, checks  the pinned Zrain UI, runs tests, applies migrations and deploys Worker and Hosting. If a service has not been initialized in its console, the script stops with a clear error rather than falsely claiming deployment.
7. Test `https://<site>.web.app` and `https://zrain-monitor-api.<subdomain>.workers.dev/api/health`. Sign in, create one monitor, then inspect the Cloudflare Cron Trigger and D1 records. Use **real, confirmed Render URLs**. Avoid inventing URL paths such as `/health` if your app does not expose them.
8. For later releases run `scripts\Deploy-Zrain-Monitor.ps1` after changing code and running local tests.

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

- Free Workers have per-invocation CPU and subrequest ceilings. Every Cron run claims at most three due monitors; monitor checks run every five minutes. A one-minute Cron prevents many due monitors waiting five extra minutes for another batch, but this is still best-effort.
- Scheduler runs are stored in D1. A successful Cron invocation is different from a successful target check. Two consecutive target failures confirm downtime; a missed scheduler run never turns a target DOWN by itself.
- When the service is paused or a concurrent job wins its lease, abandoned work is not recorded as a successful check.
- D1 detailed check results older than 30 days are removed in batches, and daily summaries are kept for 90 days. Incident history remains until deletion.
- Monitoring on Render Free cannot override the hosting company's free instance-hour quota. 24/7 operation of multiple free services may exhaust available hours.
- Only `https` and known public hosting suffixes are accepted during private beta. No localhost, IP literal, custom ports, embedded credentials, automatic redirect or response-body storage.
- Firebase Auth sign-in methods and authorized domains **must** be configured in Firebase Console. The sample Firebase Web API key is a public client identifier and must be provided after creating the Firebase project; do not share service-account secrets.

## Local development and testing

```powershell
npm install
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

This is an **independent project** intended for `github.com/zrain03/zrain-monitor`. Do not merge its database or authentication into Zrain Links. GitHub Actions is used solely for tests, not periodic monitoring. An actual GitHub repository and Cloudflare/Firebase services must be created and connected by the owner; those deployments cannot be inferred from local passing tests.

## Publish this independent repository

The repository does not exist until created under your GitHub account. With GitHub CLI installed and authenticated using `gh auth login`:

```powershell
Unblock-File .\scripts\Publish-Zrain-Monitor.ps1
& .\scripts\Publish-Zrain-Monitor.ps1
```

This script initializes Git, commits project files, creates `zrain03/zrain-monitor` (if no origin exists), and pushes the `main` branch. It does not deploy or change existing game repositories. If GitHub CLI is unavailable, create an empty public repository using the GitHub website, then use standard `git init`, `git add`, `git commit`, `git remote add origin`, and `git push -u origin main` steps.


## Public beta access (October 2026)

Anyone with a signed-in, verified Firebase account can create and manage their own monitors when `PUBLIC_MONITOR_CREATION=true` is deployed. Accounts are isolated by verified UID and existing ownership checks. Each user has a limited monitor quota, global beta capacity is 12 until scheduler capacity is validated for a higher load, and supported public HTTPS hosting destinations remain restricted by the existing validation rules. The System Health administrator dashboard remains admin-only. Do not claim that arbitrary private/internal URLs can be monitored.
