/*
 * Pembangun / Developer: Zrain
 * Dicipta / Created (rekod Git terawal / first Git evidence): 2026-10-30
 * Dikemas kini / Last updated: 2026-11-04
 * Fail / File: test/settings-experience.test.js
 * BM: Ujian automatik untuk mengekalkan kontrak dan mencegah regresi.
 * EN: Automated checks to preserve contracts and prevent regressions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('settings has independent account, Telegram, and deletion panels',()=>{
  const html=read('public/index.html');
  for(const id of ['settings-account-title','telegram-title','telegram-settings','settings-danger-title','delete-data','settings-email'])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.match(html,/class="settings-card settings-layout"/);
  assert.match(html,/class="telegram-steps"/);
  assert.match(html,/Read the Privacy Policy/);
  assert.match(html,/settings-experience-v1\.css\?v=1\.0\.18\.0/);
});

test('Telegram check explains each outcome and retains a generated link while waiting',()=>{
  const js=read('public/app.js');
  assert.match(js,/async function loadTelegramSettings\(checkConnection=false\)/);
  assert.match(js,/telegramPendingLink=\{url:link\.url,expires_at:link\.expires_at\}/);
  assert.match(js,/Not connected yet\. Open the Telegram link above/);
  assert.match(js,/Connection confirmed\. Next: select a website in Active monitors/);
  assert.match(js,/function openMonitorChoices\(\)/);
  assert.match(js,/list\.querySelector\("\.monitor-title"\)/);
  assert.match(js,/select a website in Active monitors/i);
});

test('public beta add monitor button follows the backend feature flag, not admin status',()=>{
  const js=read('public/app.js');
  assert.match(js,/\$\("add-open"\)\.disabled=false/);
  assert.match(js,/\$\("add-open"\)\.addEventListener\("click",\(\)=>openDialog\("create-dialog"\)\)/);
  assert.doesNotMatch(js,/Private beta monitor creation is restricted to the administrator/);
  const api=read('src/api.js');
  assert.match(api,/PUBLIC_MONITOR_CREATION/);
  assert.match(api,/MAX_MONITORS_PER_USER/);
});

test('monitor guidance gives a direct action, keeps existing in-app event history',()=>{
  const html=read('public/index.html');const js=read('public/app.js');
  assert.match(html,/How monitoring and Telegram alerts work/);
  assert.match(js,/Show Active monitors/);
  assert.match(js,/Go to Telegram setup/);
  assert.match(js,/Telegram incident alerts/);
  assert.match(js,/alert[s]?\.telegram_enabled/);
  assert.match(html,/id="notification-list"/);
  assert.match(html,/id="connect-google-panel"/);
});

test('responsive styling uses Zrain palette and does not change shared header/footer',()=>{
  const css=read('public/settings-experience-v1.css');
  assert.match(css,/#settings \.settings-card\.settings-layout/);
  assert.match(css,/@media\(max-width:600px\)/);
  assert.doesNotMatch(css,/\.zrain-header|\.zrain-footer/);
});