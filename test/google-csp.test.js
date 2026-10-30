import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Regression: Google popup / identity libraries must not be blocked by Hosting CSP.
test('Firebase Hosting CSP permits Google authentication libraries and OAuth frames', () => {
  const json = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
  assert.equal(json.hosting.site, 'zrain-monitor');
  const header = json.hosting.headers.flatMap(item => item.headers)
    .find(header => header.key.toLowerCase() === 'content-security-policy');
  assert.ok(header, 'Hosting must keep its CSP header');
  const directives = Object.fromEntries(header.value.split(';').map(part => part.trim()).filter(Boolean)
    .map(part => { const [name, ...sources] = part.split(/\s+/); return [name, new Set(sources)]; }));
  for (const directive of ['script-src', 'connect-src', 'frame-src']) {
    for (const origin of ['https://apis.google.com', 'https://accounts.google.com']) {
      assert.ok(directives[directive]?.has(origin), `${directive} should permit ${origin}`);
    }
  }
  assert.ok(directives['style-src']?.has('https://accounts.google.com'));
  for (const directive of ['default-src', 'base-uri', 'object-src']) {
    assert.ok(directives[directive]?.has("'none'"), `${directive} must remain locked down`);
  }
  assert.ok(directives['script-src'].has('https://www.gstatic.com'));
  assert.ok(directives['connect-src'].has('https://identitytoolkit.googleapis.com'));
});
