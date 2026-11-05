/**
 * Pembangun / Developer: Zrain
 * Dicipta / Created: 2026-11-05
 * Dikemas kini / Last updated: 2026-11-05
 * Fail / File: test/ui-sync-eol.test.js
 * BM: Uji bahawa CRLF/LF setara untuk aset teks dan logo binari kekal byte-tepat.
 * EN: Verify CRLF/LF text equivalence while preserving byte-exact binary logo checks.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// BM: Gunakan fixture sementara supaya ujian tidak mengubah source sebenar.
// EN: Isolate fixtures in a temporary directory so tests never modify actual source.
const sourceScript = fileURLToPath(new URL('../scripts/sync-zrain-ui.mjs', import.meta.url));

function withFixture(callback) {
  const dir = mkdtempSync(join(tmpdir(), 'zrain-monitor-ui-eol-'));
  try {
    for (const sub of ['scripts', 'public', 'node_modules/@zrain/ui/src', 'node_modules/@zrain/ui/assets']) {
      mkdirSync(join(dir, sub), {recursive: true});
    }
    copyFileSync(sourceScript, join(dir, 'scripts/sync-zrain-ui.mjs'));
    writeFileSync(join(dir, 'package.json'), JSON.stringify({type:'module', zrainUi:{publicDir:'public'}}));
    return callback(dir);
  } finally { rmSync(dir, {recursive:true, force:true}); }
}
function run(dir, check) {
  return spawnSync(process.execPath, [join(dir, 'scripts/sync-zrain-ui.mjs'), ...(check ? ['--check']:[])],
    {cwd:dir, encoding:'utf8'});
}

test('ui:check accepts CRLF/LF-only differences without modifying source assets', () => withFixture(dir => {
  const css='/* shared */\n.x { color: red; }\n';
  const js='// shared\nexport const ui = true;\n';
  writeFileSync(join(dir,'node_modules/@zrain/ui/src/brand.css'), css.replaceAll('\n','\r\n'));
  writeFileSync(join(dir,'node_modules/@zrain/ui/src/zrain-ui.js'), js);
  writeFileSync(join(dir,'public/brand.css'), css);
  writeFileSync(join(dir,'public/zrain-ui.js'), js.replaceAll('\n','\r\n'));
  for(const p of ['node_modules/@zrain/ui/assets/zrain-logo.webp','public/zrain-logo.webp'])
    writeFileSync(join(dir,p), Buffer.from([0,255,2,3]));
  const beforeCss=readFileSync(join(dir,'public/brand.css'));
  const beforeJs=readFileSync(join(dir,'public/zrain-ui.js'));
  assert.equal(run(dir,true).status,0);
  assert.equal(run(dir,false).status,0);
  assert.deepEqual(readFileSync(join(dir,'public/brand.css')),beforeCss);
  assert.deepEqual(readFileSync(join(dir,'public/zrain-ui.js')),beforeJs);
}));

test('ui:check rejects actual text and binary differences; sync repairs both', () => withFixture(dir => {
  writeFileSync(join(dir,'node_modules/@zrain/ui/src/brand.css'), '.a{color:blue}\r\n');
  writeFileSync(join(dir,'node_modules/@zrain/ui/src/zrain-ui.js'), 'export const ok=true;\n');
  writeFileSync(join(dir,'node_modules/@zrain/ui/assets/zrain-logo.webp'), Buffer.from([1,2,3]));
  writeFileSync(join(dir,'public/brand.css'), '.a{color:red}\n');
  writeFileSync(join(dir,'public/zrain-ui.js'), 'export const ok=true;\n');
  writeFileSync(join(dir,'public/zrain-logo.webp'), Buffer.from([9,9,9]));
  assert.notEqual(run(dir,true).status,0);
  assert.equal(run(dir,false).status,0);
  assert.equal(run(dir,true).status,0);
  assert.equal(readFileSync(join(dir,'public/brand.css'),'utf8'),'.a{color:blue}\n');
  assert.deepEqual(readFileSync(join(dir,'public/zrain-logo.webp')), Buffer.from([1,2,3]));
}));
