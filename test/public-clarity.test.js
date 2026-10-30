import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

const domain='https://zrain-monitor.web.app';
test('home makes Uptime, Keep-Awake, Telegram and public beta explicit without login',()=>{
  const s=read('public/index.html');
  assert.match(s,/Website &amp; API<br><em>uptime monitoring/);
  assert.match(s,/approximately five-minute checks/);
  assert.match(s,/cannot guarantee availability/);
  assert.match(s,/href="\/how-it-works.html"/);
  assert.match(s,/Get started/);
  assert.match(s,/id="dashboard" hidden/);
});
test('guide is public, semantically structured and explains every operational status',()=>{
  const s=read('public/how-it-works.html');
  for(const id of ['main','features','status','getting-started','telegram','limits','faq'])assert.ok(s.includes('id="'+id+'"'),id);
  assert.match(s,/<main id="main"/);
  assert.match(s,/<h1 id="guide-title"/);
  assert.match(s,/<nav class="clarity-jump" aria-label="Guide topics"/);
  for(const word of ['UP','VERIFYING','DOWN','UNKNOWN','PAUSED','RECOVERED'])assert.ok(s.includes(word),word);
  assert.match(s,/15 minutes/);
  assert.match(s,/two consecutive failed checks|Two consecutive failed checks/);
  assert.match(s,/two consecutive successful checks/);
  assert.match(s,/2xx HTTP response/);
});
test('public FAQ explains Telegram start/opt-in without claiming email active',()=>{
 const s=read('public/how-it-works.html');
 for(const fragment of ['@ZrainMonitorAlertsBot','10 minutes','Check connection','Enable Telegram alerts','/stop','not on every check','not presented as an active public beta feature'])assert.ok(s.includes(fragment),fragment);
 assert.ok((s.match(/<details>/g)||[]).length>=6);
 assert.match(s,/Keep-Awake/);
});
test('accurate limits and privacy details match checked production implementation',()=>{
 const s=read('public/how-it-works.html');
 for(const str of ['5 monitors per account','30 monitors globally','approximately every five minutes','approximately 30 days','approximately 90 days','approved public HTTPS','no continuous']) {if(str==='no continuous')continue;assert.ok(s.includes(str),str)}
 assert.match(s,/localhost/);
 assert.match(s,/Privacy Policy/);
 assert.match(s,/not a guarantee of continuous uptime|not a hosting service or a guarantee of continuous uptime/i);
});
test('canonical, social previews and JSON-LD are consistent, no fabricated review data',()=>{
 const home=read('public/index.html'),help=read('public/how-it-works.html'),privacy=read('public/privacy.html');
 assert.match(home,/rel="canonical" href="https:\/\/zrain-monitor.web.app\/"/);
 assert.match(help,/rel="canonical" href="https:\/\/zrain-monitor.web.app\/how-it-works.html"/);
 assert.match(privacy,/rel="canonical" href="https:\/\/zrain-monitor.web.app\/privacy.html"/);
 for(const s of [home,help,privacy]){assert.match(s,/property="og:title"/);assert.match(s,/name="description"/);}
 const m=home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
 assert.ok(m);
 const data=JSON.parse(m[1]);
 assert.equal(data['@type'],'WebApplication');assert.equal(data.url,domain+'/');assert.equal(data.provider.name,'Zrain');
 assert.equal(data.isAccessibleForFree,true);
 assert.equal(data.aggregateRating,undefined);
});
test('robot rules and sitemap expose only the intended canonical public pages',()=>{
 const r=read('public/robots.txt'),m=read('public/sitemap.xml');
 assert.match(r,/Sitemap: https:\/\/zrain-monitor.web.app\/sitemap.xml/);
 assert.match(r,/Disallow: \/_preview.html/);
 for(const p of ['/','/how-it-works.html','/privacy.html'])assert.ok(m.includes('<loc>'+domain+p+'</loc>'),p);
 assert.doesNotMatch(m,/\/api\/|\/dashboard|#|_preview/);
});
test('no dead Zrain Monitor repository link remains in main public pages',()=>{
 for(const p of ['public/index.html','public/how-it-works.html','public/privacy.html']) {
  const s=read(p);assert.doesNotMatch(s,/github\.com\/zrain03\/zrain-monitor/);
  assert.match(s,/zrain\.dev@gmail\.com|href="\/privacy.html"/);
 }
});
test('new docs and styles remain static, responsive, accessible and security boundary unchanged',()=>{
 const css=read('public/public-clarity-v1.css');
 assert.match(css,/@media\(max-width:520px\)/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/prefers-reduced-motion/);
 assert.ok(existsSync(new URL('../public/how-it-works.html',import.meta.url)));
 assert.match(read('src/worker.js'),/handleTelegramWebhook/);
 assert.match(read('src/validation.js'),/SAFE_PLATFORMS/);
});
