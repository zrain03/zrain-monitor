/*
 * Pembangun / Developer: Zrain
 * Dicipta / Created (rekod Git terawal / first Git evidence): 2026-10-30
 * Dikemas kini / Last updated: 2026-11-04
 * Fail / File: test/notification-card.test.js
 * BM: Ujian automatik untuk mengekalkan kontrak dan mencegah regresi.
 * EN: Automated checks to preserve contracts and prevent regressions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('notification settings uses one compact Telegram card with live status',()=>{
  const js=read('public/app.js');
  assert.match(js,/monitor-alert-panel monitor-alert-card/);
  assert.match(js,/text\("h4","Notification settings"\)/);
  assert.match(js,/text\("strong","Telegram incident alerts"\)/);
  assert.match(js,/alertStatus\.setAttribute\("aria-live","polite"\)/);
  for(const status of ['Unavailable','Not connected','Enabled','Disabled']){
    assert.ok(js.includes('"'+status+'"'),status);
  }
  assert.match(js,/refreshAlertStatus\(\);[\s\S]*?alertsBox\.append\(alertsHeader\)/);
  assert.match(js,/alerts\.telegram_enabled=saved\.telegram_enabled;[\s\S]*?refreshAlertStatus\(\)/);
  assert.match(js,/Go to Telegram setup/);
  assert.match(js,/if\(alerts\.email_available\|\|alerts\.email_enabled\)/);
  assert.match(js,/api\(`\/api\/monitors\/\$\{id\}\/alerts`/);
});

test('new card CSS stays scoped and is loaded last with a cache-busted module',()=>{
  const html=read('public/index.html');
  const css=read('public/notification-card-v1.css');
  assert.match(html,/notification-card-v1\.css\?v=1\.0\.19\.0/);
  assert.match(html,/app\.js\?v=1\.0\.22\.0/);
  assert.ok(html.indexOf('settings-experience-v1.css')<html.indexOf('notification-card-v1.css'));
  assert.match(css,/\.monitor-alert-panel\.monitor-alert-card/);
  assert.match(css,/\.monitor-alert-status\.is-enabled/);
  assert.match(css,/@media\(max-width:600px\)/);
  assert.doesNotMatch(css,/\.zrain-header|\.zrain-footer/);
});
