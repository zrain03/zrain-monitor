/**
 * Pembangun / Developer: Zrain
 * Dicipta / Created: 2026-11-04
 * Dikemas kini / Last updated: 2026-11-05
 * Fail / File: test/community-feedback.test.js
 * BM: Wajib gunakan widget rasmi Zrain Community pada ketiga-tiga halaman Monitor.
 * EN: Enforce the official Zrain Community widget across all three Monitor pages.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {resolve, join} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = file => readFileSync(join(root, file), 'utf8');

// BM: Pemeriksaan ini menghalang pengembalian GitHub Issues sebagai produk maklum balas.
// EN: Block accidental reintroduction of GitHub Issues as the feedback platform.
test('All Monitor public pages embed official Zrain Community, never legacy GitHub feedback', () => {
  for (const page of ['index.html', 'how-it-works.html', 'privacy.html']) {
    const html = read(`public/${page}`);
    assert.match(html, /id="zrain-community" class="zrain-community-slot"/);
    assert.match(html, /src="https:\/\/zrain-community\.web\.app\/embed\.js" data-product="zrain-monitor" data-target="#zrain-community"/);
    assert.equal((html.match(/data-product="zrain-monitor"/g) ?? []).length, 1);
    assert.ok(html.indexOf('id="zrain-community"') < html.indexOf('<footer'));
    assert.doesNotMatch(html, /feedback-embed\.js|feedback\.css|api\.github\.com|github\.com\/zrain03\/zrain-ecosystem\/issues/i);
  }
  assert.equal(existsSync(join(root, 'public/feedback-embed.js')), false);
  assert.equal(existsSync(join(root, 'public/feedback.css')), false);
  assert.match(read('public/monitor-brand-alignment.css'), /\.zrain-community-slot\s*\{/);
});

// BM: Hanya origine rasmi diberikan akses script/iframe; asal Google auth kekal.
// EN: Permit the official script/frame origin only; preserve existing Google authentication.
test('Hosting CSP allows Zrain Community embed and removes legacy GitHub feedback origins', () => {
  const hosting = JSON.parse(read('firebase.json')).hosting;
  const policy = hosting.headers.flatMap(row => row.headers)
    .find(header => header.key.toLowerCase() === 'content-security-policy')?.value;
  assert.ok(policy);
  const segments = Object.fromEntries(policy.split(';').map(x => x.trim()).filter(Boolean).map(x => {
    const [k, ...values] = x.split(/\s+/);
    return [k, values];
  }));
  assert.ok(segments['script-src'].includes('https://zrain-community.web.app'));
  assert.ok(segments['frame-src'].includes('https://zrain-community.web.app'));
  assert.ok(segments['script-src'].includes('https://accounts.google.com'));
  assert.ok(segments['frame-src'].includes('https://zrain-monitor.firebaseapp.com'));
  assert.ok(!segments['connect-src'].includes('https://api.github.com'));
  assert.ok(!segments['img-src'].includes('https://avatars.githubusercontent.com'));
  assert.ok(segments['base-uri'].includes("'none'"));
  assert.ok(segments['object-src'].includes("'none'"));
});
