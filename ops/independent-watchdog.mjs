// Standalone independent monitor. No Cloudflare credentials or database access.
// The GitHub Actions run checks the public monitoring-health endpoint.
import { pathToFileURL } from 'node:url';

export const HEALTH_URL = 'https://zrain-monitor-api.zrain-dev.workers.dev/api/health/monitoring';
export const ISSUE_TITLE = '[Zrain Watchdog] Monitoring health degraded';

export async function checkHealth(fetchImpl = fetch) {
  try {
    const response = await fetchImpl(HEALTH_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
      cache: 'no-store'
    });
    return { ok: response.status === 200, status: response.status };
  } catch {
    return { ok: false, status: 'timeout-or-network-error' };
  }
}

export function decide(first, second) {
  if (first.ok && second.ok) return 'healthy';
  if (!first.ok && !second.ok) return 'degraded';
  return 'inconclusive';
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo || '')) {
    throw new Error('GitHub Actions environment is missing.');
  }
  const first = await checkHealth();
  await new Promise(resolve => setTimeout(resolve, 15000));
  const second = await checkHealth();
  const state = decide(first, second);
  console.log(`Independent monitoring result: ${state}; ${first.status}, ${second.status}`);
  if (state === 'inconclusive') return; // Avoid incident noise on one transient failure.

  const base = `https://api.github.com/repos/${repo}`;
  const api = async (method, path, body) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'zrain-monitor-independent-watchdog'
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`GitHub Issues API returned HTTP ${response.status}`);
    return response.json();
  };
  const open = await api('GET', '/issues?state=open&per_page=100');
  const issue = open.find(item => !item.pull_request && item.title === ISSUE_TITLE);
  if (state === 'degraded' && !issue) {
    const owner = repo.split('/')[0];
    await api('POST', '/issues', {
      title: ISSUE_TITLE,
      body: `Independent HTTPS checks returned unhealthy results twice.\n\nEndpoint: ${HEALTH_URL}\nFirst: ${first.status}\nSecond: ${second.status}\nDetected: ${new Date().toISOString()}\n\nCheck Cloudflare Worker, D1, and Cron in Zrain Monitor System Health. This is an availability warning, not proof that monitored websites are down.`,
      assignees: [owner]
    });
    console.log('Created one independent GitHub health incident.');
  } else if (state === 'healthy' && issue) {
    await api('POST', `/issues/${issue.number}/comments`, {
      body: `The independent monitoring-health endpoint returned HTTP 200 twice. Recovered at ${new Date().toISOString()}.`
    });
    await api('PATCH', `/issues/${issue.number}`, { state: 'closed', state_reason: 'completed' });
    console.log('Closed the independent GitHub health incident.');
  } else {
    console.log('Incident state unchanged; no duplicate GitHub issue created.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}