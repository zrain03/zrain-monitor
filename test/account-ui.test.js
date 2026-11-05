/*
 * Pembangun / Developer: Zrain
 * Dicipta / Created (rekod Git terawal / first Git evidence): 2026-10-30
 * Dikemas kini / Last updated: 2026-11-04
 * Fail / File: test/account-ui.test.js
 * BM: Ujian automatik untuk mengekalkan kontrak dan mencegah regresi.
 * EN: Automated checks to preserve contracts and prevent regressions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = file => readFileSync(new URL('../'+file,import.meta.url),'utf8').replace(/^\uFEFF/,'');

test('Settings shows account email inside subtle Zrain outlined identity while retaining its original element ID',()=>{
  const html=read('public/index.html');
  const css=read('public/style.css');
  assert.match(html,/<div class="account-identity" aria-label="Account email"><span class="account-identity-label">ACCOUNT EMAIL<\/span><p id="settings-email" class="account-identity-email">Signed out<\/p><\/div>/);
  assert.match(css,/#settings \.account-identity \{/);
  assert.match(css,/border:1px solid #ecd8cd/);
  assert.match(css,/overflow-wrap:anywhere/);
  assert.match(read('public/app.js'),/\$\("settings-email"\)\.textContent=user\?\.email\|\|"Signed out"/);
  assert.equal((html.match(/id="settings-email"/g)||[]).length,1);
});

test('New monitor example is generic, no app-specific sample or functional form changes',()=>{
  const html=read('public/index.html');
  assert.match(html,/id="create-name" type="text" minlength="2" maxlength="70" required placeholder="My Website or API"/);
  assert.doesNotMatch(html,/placeholder="Memory Rush Backend"/);
  assert.match(html,/id="create-url" type="url" required placeholder="https:\/\/example\.onrender\.com\/health"/);
  assert.match(html,/id="create-purpose"/);
  assert.match(html,/href="\/style\.css\?v=1\.0\.9"/);
  assert.match(read('public/app.js'),/\$\("create-name"\)\.value/);
});
