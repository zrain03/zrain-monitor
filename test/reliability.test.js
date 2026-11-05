/*
 * Pembangun / Developer: Zrain
 * Dicipta / Created (rekod Git terawal / first Git evidence): 2026-10-30
 * Dikemas kini / Last updated: 2026-11-04
 * Fail / File: test/reliability.test.js
 * BM: Ujian automatik untuk mengekalkan kontrak dan mencegah regresi.
 * EN: Automated checks to preserve contracts and prevent regressions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {handleAPI} from '../src/api.js';
import {handleTelegramWebhook} from '../src/telegram-alerts.js';
import {getMonitoringHealth,publicMonitoringResponse} from '../src/monitoring-health.js';

function db() {
  const sqlite=new DatabaseSync(':memory:'); sqlite.exec('PRAGMA foreign_keys=ON');
  for(const name of ['0001_init','0002_email_alerts','0003_telegram_alerts','0004_reliability'])
    sqlite.exec(readFileSync(new URL(`../migrations/${name}.sql`,import.meta.url),'utf8'));
  const DB={prepare(sql){let args=[];return{
    bind(...values){args=values;return this;},
    first(){return sqlite.prepare(sql).get(...args)||null;},
    all(){return{results:sqlite.prepare(sql).all(...args)};},
    run(){const x=sqlite.prepare(sql).run(...args);return{meta:{changes:Number(x.changes)}};}
  };},async batch(statements){sqlite.exec('BEGIN');try{const x=statements.map(s=>s.run());sqlite.exec('COMMIT');return x;}
    catch(e){sqlite.exec('ROLLBACK');throw e;}}};
  return{sqlite,DB};
}
const token='1234567:'+ 'a'.repeat(40),secret='S'.repeat(40);
const cfg=DB=>({DB,FIREBASE_PROJECT_ID:'zrain-monitor',ALLOWED_ORIGIN:'https://zrain-monitor.web.app',
  BETA_ADMIN_UID:'owner',TELEGRAM_BOT_TOKEN:token,TELEGRAM_WEBHOOK_SECRET:secret,
  PUBLIC_MONITOR_CREATION:'true',MAX_GLOBAL_MONITORS:'12',MAX_MONITORS_PER_USER:'3'});
const auth=uid=>({authenticate:async()=>({uid,email:`${uid}@example.com`})});
const req=(path,method='GET',body)=>new Request('https://zrain-monitor-api.test'+path,{method,
  headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
const payload=async response=>response.json();
const bot=(text)=>new Request('https://zrain-monitor-api.test/telegram/webhook',{method:'POST',
  headers:{'x-telegram-bot-api-secret-token':secret,'content-type':'application/json'},
  body:JSON.stringify({message:{chat:{id:1100,type:'private'},from:{id:1100},text}})});
const sent=[];
const sender=async (_url,opts)=>{sent.push(JSON.parse(opts.body).text);return new Response(JSON.stringify({ok:true}),{status:200});};
async function linked(env){
  await handleAPI(req('/api/me'),env,auth('owner'));
  const link=await payload(await handleAPI(req('/api/telegram/link','POST'),env,auth('owner')));
  await handleTelegramWebhook(bot('/start '+link.url.split('start=')[1]),env,sender);
}

test('health separates Worker liveness, D1 and Cron heartbeat and does not expose SQL',async()=>{
  const {sqlite,DB}=db();const env=cfg(DB);
  let res=await handleAPI(req('/api/health'),env); assert.equal(res.status,200);
  res=await handleAPI(req('/api/health/monitoring'),env);assert.equal(res.status,503);
  assert.equal((await payload(res)).monitoring,'unhealthy');
  const id=crypto.randomUUID(); const recent=new Date().toISOString();
  sqlite.prepare('INSERT INTO scheduler_runs(id,started_at,finished_at) VALUES(?,?,?)').run(id,recent,recent);
  const good=await getMonitoringHealth(DB);assert.equal(good.healthy,true);
  assert.equal((await publicMonitoringResponse(good).json()).monitoring,'healthy');
  assert.equal((await handleAPI(req('/api/health/monitoring'),env)).status,200);
  sqlite.prepare('UPDATE scheduler_runs SET finished_at=?').run('2020-01-01T00:00:00.000Z');
  assert.equal((await getMonitoringHealth(DB)).reason,'scheduler_stale');
  sqlite.prepare('UPDATE scheduler_runs SET finished_at=?,error=?').run(recent,'error with private details');
  assert.equal((await getMonitoringHealth(DB)).reason,'scheduler_error');
  const broken=await handleAPI(req('/api/health/monitoring'),{...env,DB:{prepare(){throw new Error('super-secret');}}});
  assert.equal(broken.status,503);assert.doesNotMatch(await broken.text(),/super-secret/);
});

test('Telegram /start acknowledges active link; /status shows enabled monitor count without account identity',async()=>{
  sent.length=0;const{sqlite,DB}=db();const env=cfg(DB);await linked(env);
  assert.match(sent.at(-1),/connection ACTIVE/);
  assert.match(sent.at(-1),/No website alerts enabled yet/);
  await handleTelegramWebhook(bot('/status'),env,sender);
  assert.match(sent.at(-1),/Websites with alerts enabled: 0/);
  assert.doesNotMatch(sent.at(-1),/owner@example/);
  await handleTelegramWebhook(bot('/help'),env,sender);assert.match(sent.at(-1),/\/status/);
  await handleTelegramWebhook(bot('/stop'),env,sender);assert.match(sent.at(-1),/disconnected/);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM telegram_connections').get().n,0);
});

test('test message rate limit, owner-scoped history, no fake incidents, account deletion cascade',async()=>{
  sent.length=0;const{sqlite,DB}=db();const env=cfg(DB);await linked(env);
  const testMsg=await handleAPI(req('/api/telegram/test','POST'),env,{...auth('owner'),fetch:sender});
  assert.equal(testMsg.status,200);assert.match(sent.at(-1),/test message/);
  const second=await handleAPI(req('/api/telegram/test','POST'),env,{...auth('owner'),fetch:sender});
  assert.equal(second.status,429);
  const own=await payload(await handleAPI(req('/api/telegram/deliveries'),env,auth('owner')));
  const other=await payload(await handleAPI(req('/api/telegram/deliveries'),env,auth('other')));
  assert.equal(own.deliveries[0].type,'TEST');assert.equal(own.deliveries[0].status,'SENT');
  assert.equal(other.deliveries.length,0);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM incidents').get().n,0);
  await handleAPI(req('/api/account/data','DELETE'),env,auth('owner'));
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM telegram_test_deliveries').get().n,0);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM telegram_test_limits').get().n,0);
});

test('failed Telegram test returns error and is recorded without exposing secrets',async()=>{
  const {DB}=db();const env=cfg(DB);await linked(env);
  const broken=async()=>new Response(JSON.stringify({ok:false,description:'private token internal'}),{status:403});
  const result=await handleAPI(req('/api/telegram/test','POST'),env,{...auth('owner'),fetch:broken});
  assert.equal(result.status,502);
  assert.doesNotMatch(await result.text(),/private token internal/);
  const hist=await payload(await handleAPI(req('/api/telegram/deliveries'),env,auth('owner')));
  assert.equal(hist.deliveries[0].status,'FAILED');
});

test('capacity returned to account and public health does not reveal monitor names',async()=>{
  const{DB}=db();const env=cfg(DB);
  const me=await payload(await handleAPI(req('/api/me'),env,auth('owner')));
  assert.equal(me.capacity.used,0);assert.equal(me.capacity.limit,12);assert.equal(me.capacity.can_add,true);
  const created=await handleAPI(req('/api/monitors','POST',{name:'Sample Site',url:'https://my-server.onrender.com/health',purpose:'uptime'}),env,auth('owner'));
  assert.equal(created.status,201);
  assert.equal((await payload(await handleAPI(req('/api/me'),env,auth('owner')))).capacity.mine,1);
  assert.doesNotMatch(await (await handleAPI(req('/api/health/monitoring'),env)).text(),/Sample Site/);
});

test('frontend includes status, delivery log, cooldown guide and accessible labels',()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../public/reliability-v1.css',import.meta.url),'utf8');
  assert.match(js,/Send test message/);assert.match(js,/telegram\/deliveries/);
  assert.match(html,/id="capacity-info"[^>]*role="status"/);
  assert.match(css,/\.telegram-delivery-item/);
  assert.doesNotMatch(js,/â€¦|â€¢|â€”|Ã—/);
  assert.doesNotMatch(html,/â€¦|â†’|Ã—/);
});


test('public beta INSERT respects concurrent-safe global quota',async()=>{
  const {sqlite,DB}=db();const env={...cfg(DB),MAX_GLOBAL_MONITORS:'1'};
  const body={name:'Site One',url:'https://my-server.onrender.com/health',purpose:'uptime'};
  const a=await handleAPI(req('/api/monitors','POST',body),env,auth('owner'));
  const b=await handleAPI(req('/api/monitors','POST',body),env,auth('other'));
  assert.equal(a.status,201);assert.equal(b.status,409);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM monitors').get().n,1);
});

test('scheduler can run recently but overdue ACTIVE checks still produce degraded health',async()=>{
  const {sqlite,DB}=db();const env=cfg(DB);
  await handleAPI(req('/api/monitors','POST',{name:'Site One',url:'https://my-server.onrender.com/health',purpose:'uptime'}),env,auth('owner'));
  const timestamp=new Date().toISOString();
  sqlite.prepare('INSERT INTO scheduler_runs(id,started_at,finished_at) VALUES(?,?,?)').run(crypto.randomUUID(),timestamp,timestamp);
  assert.equal((await getMonitoringHealth(DB)).healthy,true);
  sqlite.prepare('UPDATE monitors SET next_check_at=?').run('2020-01-01T00:00:00.000Z');
  const degraded=await getMonitoringHealth(DB);
  assert.equal(degraded.healthy,false);assert.equal(degraded.reason,'checks_overdue');
  const response=await handleAPI(req('/api/health/monitoring'),env);
  assert.equal(response.status,503);
});
