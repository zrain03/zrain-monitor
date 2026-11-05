/*
 * Pembangun / Developer: Zrain
 * Dicipta / Created (rekod Git terawal / first Git evidence): Unknown / Belum disahkan
 * Dikemas kini / Last updated: 2026-11-04
 * Fail / File: Zrain-Fast-E2E-Edge-Ready.mjs
 * BM: Fail sokongan Zrain Monitor.
 * EN: Zrain Monitor supporting file.
 */
import {
  existsSync, mkdtempSync, readFileSync,
  writeFileSync, rmSync
} from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const root = resolve(
  process.env.USERPROFILE ?? process.env.HOME ?? '.',
  'Downloads', 'zrain-monitor'
);

const cli = join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const fixture = 'https://zrain-monitor-e2e-fixture.zrain-dev.workers.dev/health';
const monitorName = 'Zrain E2E Test';
const dbName = 'zrain-monitor';

const deadline = Date.now() + 8 * 60000 + 30000;

let temp = null;
let workerDown = false;
let downBegin = null;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const msg = text =>
  console.log(`[${new Date().toLocaleTimeString()}] ${text}`);

function assertTime() {
  if (Date.now() >= deadline) {
    throw new Error('Test time limit reached.');
  }
}

function safeId(id) {
  if (typeof id !== 'string' ||
      !/^[a-zA-Z0-9_-]{8,80}$/.test(id)) {
    throw new Error('Unexpected monitor ID.');
  }
  return id;
}

function wrangler(args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 90000,
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
    env: {
      ...process.env,
      CI: 'true',
      WRANGLER_SEND_METRICS: 'false'
    }
  });

  if (result.error || result.status !== 0) {
    throw new Error(
      `Wrangler failed: ${args[0]} ${args[1] ?? ''}\n` +
      (result.stderr || result.stdout ||
       result.error?.message || '').slice(-1000)
    );
  }

  return (result.stdout || '').trim();
}

function sql(query) {
  const raw = wrangler([
    'd1', 'execute', dbName,
    '--remote', '--json', '--yes',
    '--command', query
  ]);

  let result;
  try {
    result = JSON.parse(raw);
  } catch {
    throw new Error('Wrangler did not return valid JSON.');
  }

  if (!Array.isArray(result) || !result[0]?.success) {
    throw new Error('D1 operation was not confirmed.');
  }

  return {
    rows: result[0].results ?? [],
    changes: result[0].meta?.changes ?? 0
  };
}

function getMonitor() {
  const rows = sql(`
    SELECT m.id,m.name,m.url,m.state,m.status,
           m.total_checks,m.last_http_status,
           COALESCE(s.enabled,0) AS telegram_enabled,
           (
             SELECT COUNT(*)
             FROM telegram_connections c
             WHERE c.owner_uid=m.owner_uid
           ) AS connected
    FROM monitors m
    LEFT JOIN telegram_alert_settings s
      ON s.monitor_id=m.id
      AND s.owner_uid=m.owner_uid
    WHERE m.name='Zrain E2E Test'
      AND m.url='${fixture}'
    LIMIT 2
  `).rows;

  if (rows.length !== 1) {
    throw new Error(
      `Expected exactly one ${monitorName} monitor; found ${rows.length}.`
    );
  }

  const monitor = rows[0];
  safeId(monitor.id);

  if (
    monitor.state !== 'ACTIVE' ||
    Number(monitor.telegram_enabled) !== 1 ||
    Number(monitor.connected) !== 1
  ) {
    throw new Error(
      'Test monitor must be ACTIVE, Telegram enabled and connected.'
    );
  }

  return monitor;
}

function forceDue(id) {
  assertTime();

  const result = sql(`
    UPDATE monitors
    SET next_check_at='2000-01-01T00:00:00.000Z'
    WHERE id='${safeId(id)}'
      AND name='Zrain E2E Test'
      AND url='${fixture}'
      AND state='ACTIVE'
  `);

  if (result.changes !== 1) {
    throw new Error('Expected exactly one test monitor update.');
  }
}

async function waitForCheck(previous, expectedHTTP) {
  while (true) {
    assertTime();
    await sleep(8000);

    const monitor = getMonitor();

    if (Number(monitor.total_checks) > previous) {
      const actualHTTP = Number(monitor.last_http_status);

      msg(
        `Real check: HTTP ${actualHTTP}, ` +
        `state=${monitor.status}, ` +
        `total=${monitor.total_checks}`
      );

      if (actualHTTP !== expectedHTTP) {
        throw new Error(
          `Expected HTTP ${expectedHTTP}, got ${actualHTTP}.`
        );
      }

      return monitor;
    }
  }
}

async function performCheck(expectedHTTP) {
  const monitor = getMonitor();
  forceDue(monitor.id);

  return waitForCheck(
    Number(monitor.total_checks),
    expectedHTTP
  );
}

function fixtureSource(status) {
  const state = status === 503
    ? 'SIMULATED_DOWN'
    : 'SIMULATED_UP';

  return `
export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname !== '/health') {
      return new Response('Not found', { status: 404 });
    }

    return new Response(
      JSON.stringify({ state: '${state}' }),
      {
        status: ${status},
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );
  }
};
`;
}

async function deployFixture(status) {
  assertTime();

  writeFileSync(
    join(temp, 'worker.mjs'),
    fixtureSource(status)
  );

  if (status === 503) workerDown = true;

  wrangler([
    'deploy',
    '--config',
    join(temp, 'wrangler.toml')
  ]);

  // Confirm the actual HTTP response after deployment.
  const until = Math.min(Date.now() + 75000, deadline);
  let observed = 'no response';

  while (Date.now() < until) {
    try {
      const response = await fetch(
        `${fixture}?verify=${Date.now()}-${Math.random()}`,
        {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
          signal: AbortSignal.timeout(10000)
        }
      );

      observed = response.status;

      if (observed === status) {
        if (status === 200) workerDown = false;

        msg(`Isolated test Worker confirmed: HTTP ${status}`);
        return;
      }
    } catch (error) {
      observed = error?.name || 'network error';
    }

    await sleep(3000);
  }

  throw new Error(
    `Worker returned ${observed}, expected HTTP ${status}.`
  );
}
async function verifyDelivery(id) {
  while (Date.now() < deadline) {
    const rows = sql(`
      SELECT type,status,created_at,sent_at
      FROM telegram_alert_outbox
      WHERE monitor_id='${safeId(id)}'
        AND created_at>='${downBegin}'
      ORDER BY created_at DESC
      LIMIT 20
    `).rows;

    const down = rows.find(row => row.type === 'DOWN');
    const recovered = rows.find(
      row => row.type === 'RECOVERED'
    );

    msg(
      `Telegram: DOWN=${down?.status || 'not queued'}, ` +
      `RECOVERED=${recovered?.status || 'not queued'}`
    );

    if (
      down?.status === 'SENT' &&
      recovered?.status === 'SENT'
    ) {
      return true;
    }

    await sleep(12000);
  }

  return false;
}

async function main() {
  if (!existsSync(join(root, 'wrangler.toml')) ||
      !existsSync(cli)) {
    throw new Error('Zrain Monitor or local Wrangler missing.');
  }

  const config = readFileSync(
    join(root, 'wrangler.toml'),
    'utf8'
  );

  if (
    !/name\s*=\s*"zrain-monitor-api"/.test(config) ||
    !/database_name\s*=\s*"zrain-monitor"/.test(config)
  ) {
    throw new Error('Unexpected project configuration.');
  }

  let monitor = getMonitor();

  msg('Test monitor verified.');
  msg(`Initial state: ${monitor.status}`);
  msg('Telegram connection and alerts verified.');

  temp = mkdtempSync(join(tmpdir(), 'zrain-fast-e2e-'));

  writeFileSync(
    join(temp, 'wrangler.toml'),
    `name = "zrain-monitor-e2e-fixture"
main = "worker.mjs"
compatibility_date = "2026-10-01"
workers_dev = true
`
  );

  await deployFixture(200);

  if (monitor.status === 'DOWN') {
    msg('Recovering previous DOWN state first.');

    for (let i = 0; i < 2; i++) {
      monitor = await performCheck(200);
    }

    if (monitor.status !== 'UP') {
      throw new Error('Initial recovery failed.');
    }
  } else if (monitor.status === 'VERIFYING') {
    monitor = await performCheck(200);
  }

  downBegin = new Date().toISOString();

  await deployFixture(503);

  msg('Starting two genuine DOWN checks.');

  for (let i = 0; i < 2; i++) {
    monitor = await performCheck(503);
  }

  if (monitor.status !== 'DOWN') {
    throw new Error(`DOWN not confirmed: ${monitor.status}`);
  }

  msg('DOWN CONFIRMED by Zrain Monitor.');

  await deployFixture(200);

  msg('Starting two genuine RECOVERED checks.');

  for (let i = 0; i < 2; i++) {
    monitor = await performCheck(200);
  }

  if (monitor.status !== 'UP') {
    throw new Error(
      `RECOVERY not confirmed: ${monitor.status}`
    );
  }

  msg('RECOVERY CONFIRMED by Zrain Monitor.');

  const delivered = await verifyDelivery(monitor.id);

  if (delivered) {
    msg(
      'PASS: DOWN and RECOVERED both marked SENT in Telegram!'
    );
  } else {
    msg(
      'Monitoring transitions passed, but Telegram delivery ' +
      'was not fully confirmed within the test limit.'
    );
    process.exitCode = 1;
  }
}

try {
  await main();
} catch (error) {
  console.error(`TEST STOPPED: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (workerDown && temp) {
    try {
      msg('Restoring isolated Worker to HTTP 200.');

      writeFileSync(
        join(temp, 'worker.mjs'),
        fixtureSource(200)
      );

      wrangler([
        'deploy',
        '--config',
        join(temp, 'wrangler.toml')
      ]);

      let restored = false;

      for (let i = 0; i < 15; i++) {
        try {
          const response = await fetch(
            `${fixture}?restore=${Date.now()}-${i}`,
            {
              cache: 'no-store',
              signal: AbortSignal.timeout(10000)
            }
          );

          if (response.status === 200) {
            restored = true;
            break;
          }
        } catch {}

        await sleep(3000);
      }

      if (!restored) {
        throw new Error(
          'HTTP 200 not yet confirmed after restoration.'
        );
      }

      msg('Isolated Worker confirmed restored to UP.');
    } catch (error) {
      console.error(
        'WARNING: Could not restore fixture:',
        error.message
      );
    }
  }

  if (temp) {
    rmSync(temp, {
      recursive: true,
      force: true
    });
  }
}