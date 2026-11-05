/*
 * Pembangun / Developer: Zrain
 * Dicipta / Created (rekod Git terawal / first Git evidence): 2026-10-30
 * Dikemas kini / Last updated: 2026-11-04
 * Fail / File: ops/e2e-fixture/worker.js
 * BM: Dokumentasi atau alat operasi monitoring.
 * EN: Monitoring operational documentation or tooling.
 */
// Isolated monitoring test fixture: 25 minutes UP, 25 minutes DOWN, then UP forever.
// Designed ONLY for an explicitly created TEST monitor. No database, secrets or user data.
const STARTED_AT_MS = 1793341674808;
export default {
  fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== '/health') return new Response('Not found', { status: 404 });
    const elapsed = Math.max(0, Date.now() - STARTED_AT_MS);
    const down = elapsed >= 25 * 60000 && elapsed < 50 * 60000;
    return new Response(down ? 'SIMULATED_DOWN' : 'SIMULATED_UP', {
      status: down ? 503 : 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Zrain-Scenario': 'Controlled-E2E-Test'
      }
    });
  }
};