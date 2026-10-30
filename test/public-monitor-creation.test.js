import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const api=fs.readFileSync(new URL('../src/api.js',import.meta.url),'utf8');
const config=fs.readFileSync(new URL('../wrangler.toml',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const validation=fs.readFileSync(new URL('../src/validation.js',import.meta.url),'utf8');
test('public monitor creation is enabled by config without granting admin role',()=>{
  assert.match(api,/if\(!isAdmin\(user,env\) && env\.PUBLIC_MONITOR_CREATION!=="true"\)return fail/);
  const guard=api.match(/if\((!isAdmin\(user,env\) && env\.PUBLIC_MONITOR_CREATION!=="true")\)return fail/);
  assert.ok(guard);
  const denied=Function('user','env','isAdmin', 'return ('+guard[1]+');');
  assert.equal(denied({uid:'ordinary'}, {PUBLIC_MONITOR_CREATION:'true'},()=>false),false);
  assert.equal(denied({uid:'ordinary'}, {},()=>false),true);
  assert.equal(denied({uid:'admin'}, {},()=>true),false);
  assert.match(config,/^PUBLIC_MONITOR_CREATION\s*=\s*"true"$/m);
  assert.match(config,/^MAX_GLOBAL_MONITORS\s*=\s*"12"$/m);
  assert.match(api,/if\(!isAdmin\(user,env\)\)return fail\("Forbidden\.",403\)/);
});
test('public onboarding retains account, ownership and abuse barriers',()=>{
  // Preserve the actual injectable Firebase auth boundary AND its 401 failure path.
  assert.match(api,/\(dependencies\.authenticate\|\|authenticate\)\(request,env\)/);
  assert.match(api,/catch\{return fail\("Sign in with a verified account\.",401\);\}/);
  assert.match(api,/validateMonitor\(await bodyJSON\(request\),env\)/);
  assert.match(api,/monitor\.id,user\.uid/);
  assert.match(api,/MAX_MONITORS_PER_USER/);
  assert.match(api,/MAX_GLOBAL_MONITORS/);
  assert.match(validation,/https/i);
  assert.match(html,/5-minute checks[^<]*Public beta/i);
  assert.doesNotMatch(html,/5-minute checks[^<]*Private beta/i);
  assert.doesNotMatch(html,/monitor creation is limited to (the )?administrator/i);
  assert.match(html,/create up to 3 monitors for approved public HTTPS websites and APIs/);
});
