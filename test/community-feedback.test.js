/**
 * Pembangun / Developer: Zrain
 * Dicipta / Created: 2026-11-04
 * Dikemas kini / Last updated: 2026-11-04
 * Fail / File: test/community-feedback.test.js
 * BM: Sahkan Community Feedback daripada commit GitHub lama tidak hilang semasa penyatuan Monitor.
 * EN: Verify the earlier GitHub Community Feedback feature survives Monitor source consolidation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve, join} from 'node:path';
const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(join(root, path), 'utf8');

// BM: Setiap halaman public mesti menggunakan fail yang sama dan thread Monitor yang betul.
// EN: Every public page must use the same assets and the correct Monitor issue thread.
test('Community Feedback assets remain on all public pages', () => {
  const widget = read('public/feedback-embed.js');
  const css = read('public/feedback.css');
  for (const page of ['index.html', 'how-it-works.html', 'privacy.html']) {
    const html = read(`public/${page}`);
    assert.match(html, /href="\/feedback\.css\?v=20261104"/);
    assert.match(html, /src="\/feedback-embed\.js\?v=20261104" data-product="zrain-monitor"/);
    assert.ok(html.indexOf('feedback-embed.js') > html.indexOf('<footer'));
  }
  assert.match(widget, /'zrain-monitor':17/);
  assert.match(widget, /api\.github\.com\/repos\/zrain03\/zrain-ecosystem\/issues\//);
  assert.match(widget, /\.textContent = value/);
  assert.doesNotMatch(widget, /\.innerHTML\s*=/);
  assert.match(css, /\.zr-feedback\{/);
});

// BM: CSP hanya meluluskan GitHub API/avatar diperlukan; sekatan OAuth asal dikekalkan.
// EN: CSP only adds necessary GitHub API/avatar origins and retains original OAuth restrictions.
test('Hosting CSP permits only necessary community feedback origins', () => {
  const hosting = JSON.parse(read('firebase.json')).hosting;
  const policy = hosting.headers.flatMap(row => row.headers)
    .find(header => header.key.toLowerCase() === 'content-security-policy')?.value;
  assert.ok(policy);
  assert.match(policy, /connect-src 'self' https:\/\/api\.github\.com/);
  assert.match(policy, /img-src 'self' data: https:\/\/avatars\.githubusercontent\.com/);
  assert.match(policy, /base-uri 'none'/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /https:\/\/accounts\.google\.com/);
});
