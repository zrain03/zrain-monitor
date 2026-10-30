import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {deliverPendingEmailAlerts,emailAlertsReady} from '../src/email-alerts.js';

function adapter(){
  const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys = ON;');
  for(const file of ['0001_init.sql','0002_email_alerts.sql'])
    sqlite.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
  const DB={prepare(sql){let args=[];return {
    bind(...params){args=params;return this;},
    all(){return {results:sqlite.prepare(sql).all(...args)};},
    run(){const x=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(x.changes)}};}
  };}};
  const created=new Date(Date.now()-1000).toISOString();
  sqlite.prepare('INSERT INTO monitors(id,owner_uid,name,url,purpose,state,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run('m1','owner','Site A','https://a.web.app/','uptime','ACTIVE','DOWN',created,created);
  sqlite.prepare('INSERT INTO monitor_alert_settings(monitor_id,owner_uid,email_enabled,delivery_email,updated_at) VALUES(?,?,?,?,?)').run('m1','owner',1,'example@example.com',created);
  sqlite.prepare('INSERT INTO notifications(id,owner_uid,monitor_id,type,created_at) VALUES(?,?,?,?,?)').run('n1','owner','m1','DOWN',created);
  sqlite.prepare('INSERT INTO email_alert_outbox(notification_id,monitor_id,owner_uid,type,created_at,next_attempt_at) VALUES(?,?,?,?,?,?)').run('n1','m1','owner','DOWN',created,created);
  return {DB,sqlite};
}
const env=DB=>({DB,RESEND_API_KEY:'test-key',ALERT_FROM_EMAIL:'alerts@zrain.example'});

test('sender does not send when provider is unavailable',async()=>{
  const {DB}=adapter();assert.equal(emailAlertsReady({}),false);
  const x=await deliverPendingEmailAlerts({DB},async()=>{throw new Error('Should not send');});
  assert.deepEqual(x,{processed:0,sent:0,failed:0});
});
test('sender delivers one incident with provider idempotency and never sends it twice',async()=>{
  const {DB,sqlite}=adapter();let calls=0;
  const fn=async(url,options)=>{
    calls++;assert.equal(url,'https://api.resend.com/emails');
    assert.equal(options.headers['Idempotency-Key'],'zrain-monitor/n1');
    const email=JSON.parse(options.body);
    assert.deepEqual(email.to,['example@example.com']);
    assert.match(email.subject,/Downtime confirmed/);
    return new Response(JSON.stringify({id:'provider-message'}),{status:200});
  };
  assert.deepEqual(await deliverPendingEmailAlerts(env(DB),fn),{processed:1,sent:1,failed:0});
  assert.deepEqual(await deliverPendingEmailAlerts(env(DB),fn),{processed:0,sent:0,failed:0});
  assert.equal(calls,1);
  assert.equal(sqlite.prepare('SELECT status FROM email_alert_outbox').get().status,'SENT');
});
test('failed delivery records sanitized error, waits to retry, and respects disabled settings',async()=>{
  const {DB,sqlite}=adapter();
  const x=await deliverPendingEmailAlerts(env(DB),async()=>new Response('private error',{status:503}));
  assert.deepEqual(x,{processed:1,sent:0,failed:1});
  assert.equal(sqlite.prepare('SELECT status FROM email_alert_outbox').get().status,'FAILED');
  assert.equal(sqlite.prepare('SELECT last_error FROM email_alert_outbox').get().last_error,'Email provider returned HTTP 503');
  assert.equal((await deliverPendingEmailAlerts(env(DB))).processed,0);
  sqlite.prepare('UPDATE monitor_alert_settings SET email_enabled=0').run();
  sqlite.prepare('UPDATE email_alert_outbox SET next_attempt_at=?').run('2020-01-01T00:00:00.000Z');
  assert.equal((await deliverPendingEmailAlerts(env(DB))).processed,0);
});
