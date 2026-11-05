/*
 * Pembangun / Developer: Zrain
 * Dicipta / Created (rekod Git terawal / first Git evidence): 2026-10-30
 * Dikemas kini / Last updated: 2026-11-04
 * Fail / File: test/scrollspy.test.js
 * BM: Ujian automatik untuk mengekalkan kontrak dan mencegah regresi.
 * EN: Automated checks to preserve contracts and prevent regressions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readingLine,visibleSection,mountMonitorScrollspy} from '../public/monitor-scrollspy.js';

const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');

test('navigation anchors match all five real sections with System Health admin-only',()=>{
  for(const id of ['dashboard','monitors','incidents','settings','system'])
    assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/data-view="overview"/);
  assert.match(html,/data-view="system" hidden>System Health/);
  assert.match(html,/src="\/monitor-scrollspy\.js\?v=1\.0\.5"/);
  assert.match(css,/--monitor-header-offset/);
  assert.match(css,/overflow-x:auto/);
});

test('reading line detects sections when visible, not only at top of browser',()=>{
  assert.ok(readingLine(840,120)>280);
  assert.equal(visibleSection({overview:-850,monitors:-600,incidents:-320,settings:-90,system:235},readingLine(840,120),{admin:true}),'system');
  assert.equal(visibleSection({overview:-1200,monitors:-600,incidents:-80,settings:350,system:720},readingLine(840,120),{admin:true}),'incidents');
  assert.equal(visibleSection({overview:50,monitors:800,incidents:1000,settings:1500,system:2000},readingLine(840,120),{admin:true}),'overview');
  assert.equal(visibleSection({overview:-1200,monitors:-600,incidents:-80,settings:350,system:720},readingLine(840,120),{admin:false,atBottom:true}),'settings');
  assert.equal(visibleSection({overview:-1200,monitors:-600,incidents:-80,settings:350,system:720},readingLine(840,120),{admin:true,atBottom:true}),'system');
});

test('scroll, hidden admin state and clicks keep only the visible tab active',()=>{
  let tops={overview:10,monitors:800,incidents:1400,settings:2000,system:2500};
  const listeners={};
  const items=[];
  const nav={scrollWidth:500,clientWidth:500,scrollLeft:0,querySelectorAll:()=>items};
  const header={getBoundingClientRect:()=>({height:120})};
  const dashboard={hidden:false};
  const system={hidden:false};
  const body={style:{setProperty(){}},scrollHeight:4000,clientHeight:840};
  const target={dashboard: {getBoundingClientRect:()=>({top:tops.overview})},monitors:{getBoundingClientRect:()=>({top:tops.monitors})},incidents:{getBoundingClientRect:()=>({top:tops.incidents})},settings:{getBoundingClientRect:()=>({top:tops.settings})},system:{getBoundingClientRect:()=>({top:tops.system})}};
  for(const key of ['overview','monitors','incidents','settings','system']){
    const classes=new Set();const attributes=new Map(); const events={};
    const a={dataset:{view:key},hidden:key==='system',classes,events,
      classList:{toggle:(k,v)=>v?classes.add(k):classes.delete(k)},
      setAttribute:(k,v)=>attributes.set(k,v),removeAttribute:k=>attributes.delete(k),
      getAttribute:k=>attributes.get(k),addEventListener:(k,fn)=>events[k]=fn};
    items.push(a);
  }
  nav.querySelector=()=>items[4];
  const document={querySelector:s=>s.includes('topnav')?nav:header,getElementById:id=>id==='dashboard'?Object.assign(target.dashboard,dashboard):id==='system'?Object.assign(target.system,system):target[id],documentElement:body};
  const win={innerHeight:840,scrollY:0,addEventListener:(type,fn)=>listeners[type]=fn,requestAnimationFrame:fn=>fn()};
  const controller=mountMonitorScrollspy(document,win);
  assert.ok(controller);
  assert.ok(items[0].classes.has('current'));
  // At lower page screenshot, System Health heading has arrived in reading area.
  tops={overview:-2000,monitors:-1500,incidents:-950,settings:-470,system:225};
  win.scrollY=2000;listeners.scroll();
  assert.ok(items[4].classes.has('current'));
  assert.ok(!items[0].classes.has('current'));
  assert.equal(items.filter(x=>x.classes.has('current')).length,1);
  // Admin-only section vanishes without leaving the navigation link highlighted.
  target.system.hidden=true; controller.recalculate();
  assert.equal(items[4].hidden,true);
  assert.ok(items[3].classes.has('current'));
  // When signed out, the nav falls back safely to overview.
  target.dashboard.hidden=true;controller.recalculate();
  assert.ok(items[0].classes.has('current'));
});
