import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {handleAPI} from '../src/api.js';
import {runScheduler} from '../src/engine.js';
import {handleTelegramWebhook,deliverPendingTelegramAlerts,telegramReady} from '../src/telegram-alerts.js';

function adapter(){
  const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys = ON;');
  for(const f of ['0001_init.sql','0002_email_alerts.sql','0003_telegram_alerts.sql','0004_reliability.sql'])
    sqlite.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
  const db={
    prepare(sql){let args=[];return {
      bind(...params){args=params;return this;},
      first(){return sqlite.prepare(sql).get(...args)||null;},
      all(){return {results:sqlite.prepare(sql).all(...args)};},
      run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}
    };},
    async batch(statements){sqlite.exec('BEGIN');try{const result=statements.map(s=>s.run());sqlite.exec('COMMIT');return result;}
      catch(e){sqlite.exec('ROLLBACK');throw e;}}
  };
  return {sqlite,DB:db};
}
const token='1234567:'+ 'a'.repeat(40);
const secret='S'.repeat(40);
const cfg=DB=>({DB,FIREBASE_PROJECT_ID:'zrain-monitor',ALLOWED_ORIGIN:'https://zrain-monitor.web.app',
  BETA_ADMIN_UID:'owner',TELEGRAM_BOT_TOKEN:token,TELEGRAM_WEBHOOK_SECRET:secret});
const user=uid=>({authenticate:async()=>({uid,email:uid+'@example.com'})});
const request=(path,method='GET',body)=>new Request('https://zrain-monitor-api.example'+path,{method,
  headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
const json=async response=>response.json();
const botMessages=[];
const telegramFetch=async(url,options)=>{
  assert.match(url,/^https:\/\/api\.telegram\.org\/bot1234567:/);
  const data=JSON.parse(options.body);
  botMessages.push(data);
  return new Response(JSON.stringify({ok:true,result:{message_id:1}}),{status:200});
};
const webhook=(message,verified=true)=>new Request('https://backend.example/telegram/webhook',{method:'POST',
  headers:{'x-telegram-bot-api-secret-token':verified?secret:'invalid','Content-Type':'application/json'},
  body:JSON.stringify({update_id:1,message:{chat:{id:1100,type:'private'},from:{id:1100},text:message}})});

async function setup(){
  const {DB,sqlite}=adapter();const env=cfg(DB);
  await handleAPI(request('/api/me'),env,user('owner'));
  const created=await json(await handleAPI(request('/api/monitors','POST',{name:'Status Site',url:'https://my-server.onrender.com/health',purpose:'uptime'}),env,user('owner')));
  return {DB,sqlite,env,id:created.id};
}
async function connect(env){
  const pending=await json(await handleAPI(request('/api/telegram/link','POST'),env,user('owner')));
  assert.match(pending.url,/^https:\/\/t\.me\/ZrainMonitorAlertsBot\?start=[a-f0-9]{48}$/);
  const start='/start '+pending.url.split('start=')[1];
  assert.equal((await handleTelegramWebhook(webhook(start,false),env,telegramFetch)).status,403);
  assert.equal((await handleTelegramWebhook(webhook(start),env,telegramFetch)).status,200);
  return start;
}

test('bot requires secrets and valid signed webhook; no account link without verified webhook',async()=>{
  const {DB,env}=await setup();
  assert.equal(telegramReady({DB}),false);
  assert.equal((await handleAPI(request('/api/telegram/link','POST'),{...env,TELEGRAM_BOT_TOKEN:undefined},user('owner'))).status,503);
  assert.equal((await handleTelegramWebhook(webhook('/start abc',false),env,telegramFetch)).status,403);
  assert.equal((await json(await handleAPI(request('/api/telegram'),env,user('owner')))).connected,false);
});

test('single-use 10-minute bot link, owner-scoped connection and disconnect via /stop',async()=>{
  const {DB,sqlite,env}=await setup();
  const start=await connect(env);
  assert.equal((await json(await handleAPI(request('/api/telegram'),env,user('owner')))).connected,true);
  assert.equal((await json(await handleAPI(request('/api/telegram'),env,user('other')))).connected,false);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM telegram_link_tokens').get().n,0);
  await handleTelegramWebhook(webhook(start),env,telegramFetch);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM telegram_connections').get().n,1);
  const rep=await handleAPI(request('/api/telegram/link','POST'),env,user('owner'));
  assert.equal(rep.status,200);
  assert.equal((await handleAPI(request('/api/telegram/link','POST'),env,user('owner'))).status,429);
  await handleTelegramWebhook(webhook('/stop'),env,telegramFetch);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM telegram_connections').get().n,0);
});

test('Telegram opt-in is independent, owner-only, and produces one alert per confirmed transition',async()=>{
  const {DB,sqlite,env,id}=await setup();
  assert.equal((await json(await handleAPI(request(`/api/monitors/${id}/alerts`),env,user('owner')))).telegram_enabled,false);
  assert.equal((await handleAPI(request(`/api/monitors/${id}/alerts`,'PATCH',{telegram_enabled:true}),env,user('owner'))).status,409);
  await connect(env);
  assert.equal((await handleAPI(request(`/api/monitors/${id}/alerts`,'PATCH',{telegram_enabled:true}),env,user('other'))).status,404);
  assert.equal((await handleAPI(request(`/api/monitors/${id}/alerts`,'PATCH',{telegram_enabled:'yes'}),env,user('owner'))).status,400);
  assert.equal((await handleAPI(request(`/api/monitors/${id}/alerts`,'PATCH',{telegram_enabled:true}),env,user('owner'))).status,200);
  const due=()=>sqlite.prepare('UPDATE monitors SET next_check_at=?,lease_until=NULL WHERE id=?').run('2020-01-01T00:00:00.000Z',id);
  const offline=async()=>new Response('error',{status:503}),online=async()=>new Response('ok',{status:200});
  await runScheduler(env,online);due();await runScheduler(env,offline);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM telegram_alert_outbox').get().n,0);
  due();await runScheduler(env,offline);
  assert.equal(sqlite.prepare('SELECT type FROM telegram_alert_outbox').get().type,'DOWN');
  botMessages.length=0;
  assert.deepEqual(await deliverPendingTelegramAlerts(env,telegramFetch),{processed:1,sent:1,failed:0});
  assert.deepEqual(await deliverPendingTelegramAlerts(env,telegramFetch),{processed:0,sent:0,failed:0});
  assert.equal(botMessages.length,1);
  assert.match(botMessages[0].text,/DOWN confirmed/);
  due();await runScheduler(env,online);due();await runScheduler(env,online);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM telegram_alert_outbox').get().n,2);
  assert.deepEqual(await deliverPendingTelegramAlerts(env,telegramFetch),{processed:1,sent:1,failed:0});
  assert.match(botMessages.at(-1).text,/RECOVERED/);
  const result=await handleAPI(request(`/api/monitors/${id}/alerts`,'PATCH',{telegram_enabled:false}),env,user('owner'));
  assert.equal(result.status,200);
  due();await runScheduler(env,offline);due();await runScheduler(env,offline);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM telegram_alert_outbox WHERE status!='SENT'").get().n,0);
});

test('failure is retried later without error details; disconnect revokes pending delivery and deletes data',async()=>{
  const {DB,sqlite,env,id}=await setup();await connect(env);
  await handleAPI(request(`/api/monitors/${id}/alerts`,'PATCH',{telegram_enabled:true}),env,user('owner'));
  const created=new Date().toISOString();
  sqlite.prepare('INSERT INTO notifications(id,owner_uid,monitor_id,type,created_at) VALUES(?,?,?,?,?)').run('n1','owner',id,'DOWN',created);
  sqlite.prepare('INSERT INTO telegram_alert_outbox(notification_id,owner_uid,monitor_id,type,created_at,next_attempt_at) VALUES(?,?,?,?,?,?)').run('n1','owner',id,'DOWN',created,created);
  assert.deepEqual(await deliverPendingTelegramAlerts(env,async()=>new Response('{"ok":false}',{status:503})),{processed:1,sent:0,failed:1});
  assert.equal(sqlite.prepare('SELECT last_error FROM telegram_alert_outbox').get().last_error,'Telegram delivery unavailable');
  assert.equal((await deliverPendingTelegramAlerts(env,telegramFetch)).processed,0);
  await handleAPI(request('/api/telegram','DELETE'),env,user('owner'));
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM telegram_alert_outbox').get().n,0);
  assert.equal((await deliverPendingTelegramAlerts(env,telegramFetch)).processed,0);
  await handleAPI(request('/api/account/data','DELETE'),env,user('owner'));
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM telegram_alert_settings').get().n,0);
});
