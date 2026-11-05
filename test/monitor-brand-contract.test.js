/**
 * Pembangun / Developer: Zrain
 * Dicipta / Created: 2026-11-04
 * Dikemas kini / Last updated: 2026-11-04
 * Fail / File: test/monitor-brand-contract.test.js
 * BM: Ujian regresi kontrak Zrain UI, menu dashboard Monitor dan rekod provenance.
 * EN: Regression tests for the Zrain UI contract, Monitor dashboard menu and provenance records.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {resolve, join, relative} from 'node:path';

// BM: Baca dari source sebenar supaya ujian tidak memerlukan hosting atau akaun luaran.
// EN: Read actual source so these tests need neither hosting nor external accounts.
const root = resolve(import.meta.dirname, '..');
const read = file => readFileSync(join(root, file), 'utf8');
const pin = 'a109401fa591afa9f66479fa8d86f1ed1679d70b';

// BM: Pastikan manifest dan lockfile mengunci commit Golden Reference yang sama.
// EN: Ensure the manifest and lockfile pin the same Golden Reference commit.
test('Zrain UI uses the supplied immutable Golden Reference commit', () => {
  const manifest = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(manifest.dependencies['@zrain/ui'], `github:zrain03/zrain-ui#${pin}`);
  assert.equal(lock.packages[''].dependencies['@zrain/ui'], manifest.dependencies['@zrain/ui']);
  assert.match(lock.packages['node_modules/@zrain/ui'].resolved, new RegExp(pin + '$'));
});

// BM: Ketiga-tiga halaman yang memiliki header/footer mesti memuatkan library tanpa mengganti navigation.
// EN: All three header/footer pages must load the library without replacing product navigation.
test('All Zrain Monitor pages mount shared identity and narrow brand CSS', () => {
  for (const page of ['index.html', 'how-it-works.html', 'privacy.html']) {
    const html = read(`public/${page}`);
    assert.match(html, /src="\/zrain-ui-config\.js"/);
    assert.match(html, /href="\/monitor-brand-alignment\.css\?v=20261104"/);
    assert.match(html, /class="(?:topbar )?zrain-header"/);
    assert.match(html, /class="[^"]*zrain-footer/);
  }
  const config = read('public/zrain-ui-config.js');
  assert.match(config, /mountZrainUI\(/);
  assert.doesNotMatch(config, /navigation\s*:/);
  assert.doesNotMatch(config, /footerLinks\s*:/);
});

// BM: Menu pengguna dan admin tidak boleh digantikan oleh menu contoh dalam shared library.
// EN: User and admin tabs must never be replaced by shared-library sample navigation.
test('Monitor dashboard still owns its original navigation and admin access gate', () => {
  const main = read('public/index.html');
  const expected = ['overview', 'monitors', 'incidents', 'settings', 'system'];
  for (const view of expected) assert.match(main, new RegExp(`data-view="${view}"`));
  assert.match(main, /data-view="system" hidden/);
  assert.match(read('public/monitor-scrollspy.js'), /mountMonitorScrollspy/);
  assert.match(read('public/app.js'), /function updateNav\(/);
});

// BM: CSS hanya menukar presentation; tiada peraturan yang menyembunyikan menu atau memintas klik.
// EN: CSS only changes presentation; it must not hide menus or intercept clicks.
test('Active and mobile navigation retain the approved accessible style', () => {
  const css = read('public/monitor-brand-alignment.css');
  assert.match(css, /#fff1e9/);
  assert.match(css, /#a64930/);
  assert.match(css, /inset 0 -2px 0 #b95136/);
  assert.match(css, /aria-current="page"/);
  assert.match(css, /aria-current="location"/);
  assert.match(css, /overflow-x: auto/);
  assert.match(css, /prefers-reduced-motion/);
});

// BM: Registry wajib menyenaraikan semua fail sumber dan tidak menghash dirinya sendiri.
// EN: Registry must cover every source file without attempting an unstable self-hash.
test('File provenance covers all active release files without invented dates', () => {
  const registry = JSON.parse(read('FILE_PROVENANCE.json'));
  const actual = [];
  function visit(folder) {
    for (const name of readdirSync(folder)) {
      // BM: Abaikan direktori dependency, metadata Git dan output sementara Firebase/Worker/coverage.
      // EN: Exclude dependency directories, Git metadata and temporary Firebase/Worker/coverage output.
      if (['node_modules', '.git', '.firebase', '.wrangler', 'coverage'].includes(name)) continue;
      // BM: Backup sejarah bukan fail release aktif; abaikan hanya direktori backup di root.
      // EN: Historical backups are not active release files; skip only root-level backup directories.
      if (folder === root && /^(?:auth-backup-|backup-|config-backup-)/.test(name)) continue;
      const item = join(folder, name);
      if (statSync(item).isDirectory()) visit(item);
      else actual.push(relative(root, item).split('\\').join('/'));
    }
  }
  visit(root);
  assert.deepEqual(Object.keys(registry.files).sort(), actual.sort());
  assert.equal(registry.files['FILE_PROVENANCE.json'].sha256, null);
  for (const entry of Object.values(registry.files)) {
    assert.equal(entry.developer, 'Zrain');
    assert.ok(entry.created);
    assert.ok(entry.last_updated);
    assert.doesNotMatch(entry.created, /(^undefined$|^null$)/);
  }
});
