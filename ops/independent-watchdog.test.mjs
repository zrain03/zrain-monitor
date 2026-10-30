import test from 'node:test';
import assert from 'node:assert/strict';
import {checkHealth, decide, ISSUE_TITLE} from './independent-watchdog.mjs';
test('health status 200 counts as healthy', async () => {
  assert.deepEqual(await checkHealth(async () => ({status:200})), {ok:true,status:200});
});
test('non-200 and network failures count as unhealthy', async () => {
  assert.deepEqual(await checkHealth(async () => ({status:503})), {ok:false,status:503});
  assert.equal((await checkHealth(async () => {throw new Error('network')})).ok,false);
});
test('two agreeing checks determine transition; mixed results do not', () => {
  assert.equal(decide({ok:true},{ok:true}), 'healthy');
  assert.equal(decide({ok:false},{ok:false}), 'degraded');
  assert.equal(decide({ok:true},{ok:false}), 'inconclusive');
  assert.equal(ISSUE_TITLE, '[Zrain Watchdog] Monitoring health degraded');
});