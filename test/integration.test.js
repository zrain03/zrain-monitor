import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {handleAPI} from "../src/api.js";
import {runScheduler} from "../src/engine.js";

function adapter(){
  const sqlite=new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  sqlite.exec(readFileSync(new URL("../migrations/0001_init.sql",import.meta.url),"utf8"));
  sqlite.exec(readFileSync(new URL("../migrations/0002_email_alerts.sql",import.meta.url),"utf8"));
  sqlite.exec(readFileSync(new URL("../migrations/0003_telegram_alerts.sql",import.meta.url),"utf8"));
  sqlite.exec(readFileSync(new URL("../migrations/0004_reliability.sql",import.meta.url),"utf8"));
  const wrap=sql=>{
    let params=[];
    return {
      bind(...values){params=values;return this;},
      first(){return sqlite.prepare(sql).get(...params)||null;},
      all(){return {results:sqlite.prepare(sql).all(...params)};},
      run(){const result=sqlite.prepare(sql).run(...params);return {meta:{changes:Number(result.changes)}};}
    };
  };
  return {sqlite,DB:{prepare:wrap,async batch(items){sqlite.exec("BEGIN");try{const r=items.map(x=>x.run());sqlite.exec("COMMIT");return r;}catch(e){sqlite.exec("ROLLBACK");throw e;}}}};
}
const env={FIREBASE_PROJECT_ID:"zrain-monitor",ALLOWED_ORIGIN:"https://zrain-monitor.web.app",BETA_ADMIN_UID:"admin",MAX_MONITORS_PER_USER:"3",MAX_GLOBAL_MONITORS:"12"};
const user=uid=>({authenticate:async()=>({uid,email:"test@example.com"})});
const req=(path,method="GET",data)=>new Request("https://zrain-monitor-api.workers.dev"+path,{method,headers:data?{"Content-Type":"application/json"}:{},body:data?JSON.stringify(data):undefined});
const j=async response=>response.json();

test("API enforces ownership, beta gate, monitor limits and deletion",async()=>{
  const {DB,sqlite}=adapter();const cfg={...env,DB};
  const input={name:"Memory Rush API",url:"https://memoryrush.onrender.com/health",purpose:"keepawake"};
  let result=await handleAPI(req("/api/monitors","POST",input),cfg,user("not-admin"));
  assert.equal(result.status,403);
  result=await handleAPI(req("/api/monitors","POST",input),cfg,user("admin"));
  assert.equal(result.status,201);
  const id=(await j(result)).id;
  assert.equal((await j(await handleAPI(req("/api/monitors"),cfg,user("admin")))).monitors.length,1);
  assert.equal((await j(await handleAPI(req("/api/monitors"),cfg,user("not-admin")))).monitors.length,0);
  assert.equal((await handleAPI(req(`/api/monitors/${id}`),cfg,user("not-admin"))).status,404);
  assert.equal((await handleAPI(req(`/api/monitors/${id}`,'DELETE'),cfg,user("not-admin"))).status,404);
  assert.equal((await handleAPI(req(`/api/monitors/${id}`,'PATCH',{name:"New API"}),cfg,user("admin"))).status,200);
  assert.equal(sqlite.prepare("SELECT name FROM monitors WHERE id=?").get(id).name,"New API");
  assert.equal((await handleAPI(req(`/api/monitors/${id}`,'PATCH',{url:"https://attacker.onrender.com/"}),cfg,user("admin"))).status,400);
  assert.equal((await handleAPI(req(`/api/monitors/${id}`,'PATCH',{state:"PAUSED"}),cfg,user("admin"))).status,200);
  assert.equal((await j(await handleAPI(req(`/api/monitors/${id}`),cfg,user("admin")))).monitor.display_status,"PAUSED");
  assert.equal((await handleAPI(req(`/api/monitors/${id}`,'DELETE'),cfg,user("admin"))).status,200);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM monitors").get().n,0);
});

test("cron verifies DOWN after two failures and UP after two recovery checks",async()=>{
  const {sqlite,DB}=adapter();const cfg={...env,DB};
  const created=await handleAPI(req("/api/monitors","POST",{name:"My Server",url:"https://my-server.onrender.com/health",purpose:"uptime"}),cfg,user("admin"));
  const id=(await j(created)).id;
  const offline=async()=>new Response("Unavailable",{status:503});
  const online=async()=>new Response("Healthy",{status:200});
  const resetDue=()=>sqlite.prepare("UPDATE monitors SET next_check_at=?,lease_until=NULL WHERE id=?").run("2020-01-01T00:00:00.000Z",id);
  assert.deepEqual(await runScheduler(cfg,offline),{claimed:1,succeeded:1,failed:0});
  assert.equal(sqlite.prepare("SELECT status FROM monitors").get().status,"VERIFYING");
  resetDue();await runScheduler(cfg,offline);
  assert.equal(sqlite.prepare("SELECT status FROM monitors").get().status,"DOWN");
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM incidents WHERE resolved_at IS NULL").get().n,1);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM notifications WHERE type='DOWN'").get().n,1);
  resetDue();await runScheduler(cfg,online);
  assert.equal(sqlite.prepare("SELECT status FROM monitors").get().status,"DOWN");
  resetDue();await runScheduler(cfg,online);
  assert.equal(sqlite.prepare("SELECT status FROM monitors").get().status,"UP");
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM incidents WHERE resolved_at IS NOT NULL").get().n,1);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM notifications WHERE type='RECOVERED'").get().n,1);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM check_results").get().n,4);
  assert.equal(sqlite.prepare("SELECT checks FROM daily_summaries").get().checks,4);
  const recent=await handleAPI(req(`/api/monitors/${id}/checks`),cfg,user("admin"));
  assert.equal((await j(recent)).checks.length,4);
  const incidents=await handleAPI(req(`/api/monitors/${id}/incidents`),cfg,user("admin"));
  assert.equal((await j(incidents)).incidents.length,1);
  const diagnostics=await handleAPI(req("/api/admin/system"),cfg,user("admin"));
  assert.equal(diagnostics.status,200);
  assert.equal((await handleAPI(req("/api/admin/system"),cfg,user("other"))).status,403);
});

test("delete account data cascades all monitoring history",async()=>{
  const {DB,sqlite}=adapter();const cfg={...env,DB};
  await handleAPI(req("/api/monitors","POST",{name:"My Server",url:"https://my-server.onrender.com/health",purpose:"uptime"}),cfg,user("admin"));
  await runScheduler(cfg,async()=>new Response("ok",{status:200}));
  assert.equal((await handleAPI(req("/api/account/data","DELETE"),cfg,user("admin"))).status,200);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM monitors").get().n,0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM check_results").get().n,0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM daily_summaries").get().n,0);
});

test('email alerts stay opt-in, owner-scoped, and are queued only for confirmed transitions',async()=>{
  const {sqlite,DB}=adapter();
  const cfg={...env,DB,RESEND_API_KEY:'test-secret',ALERT_FROM_EMAIL:'Alerts <alerts@zrain.example>'};
  // The sender uses a bare verified address in this release configuration.
  cfg.ALERT_FROM_EMAIL='alerts@zrain.example';
  const created=await handleAPI(req('/api/monitors','POST',{name:'Status API',url:'https://my-server.onrender.com/health',purpose:'uptime'}),cfg,user('admin'));
  const id=(await j(created)).id;
  const get=()=>handleAPI(req(`/api/monitors/${id}/alerts`),cfg,user('admin'));
  assert.equal((await j(await get())).email_enabled,false);
  assert.equal((await handleAPI(req(`/api/monitors/${id}/alerts`,'PATCH',{email_enabled:true}),cfg,user('other'))).status,404);
  assert.equal((await handleAPI(req(`/api/monitors/${id}/alerts`,'PATCH',{email_enabled:'true'}),cfg,user('admin'))).status,400);
  const online=async()=>new Response('ok',{status:200});
  const offline=async()=>new Response('not ok',{status:503});
  const due=()=>sqlite.prepare('UPDATE monitors SET next_check_at=?,lease_until=NULL WHERE id=?').run('2020-01-01T00:00:00.000Z',id);
  await runScheduler(cfg,online);due();await runScheduler(cfg,offline);due();await runScheduler(cfg,offline);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM notifications').get().n,1);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM email_alert_outbox').get().n,0);
  assert.equal((await handleAPI(req(`/api/monitors/${id}/alerts`,'PATCH',{email_enabled:true}),cfg,user('admin'))).status,200);
  assert.equal((await j(await get())).delivery_email,'test@example.com');
  due();await runScheduler(cfg,offline);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM email_alert_outbox').get().n,0);
  due();await runScheduler(cfg,online);due();await runScheduler(cfg,online);
  assert.equal(sqlite.prepare('SELECT type FROM email_alert_outbox').get().type,'RECOVERED');
  assert.equal((await handleAPI(req(`/api/monitors/${id}/alerts`,'PATCH',{email_enabled:false}),cfg,user('admin'))).status,200);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM email_alert_outbox').get().n,0);
});

test('email alerts cannot be enabled without provider credentials',async()=>{
  const {DB}=adapter();const cfg={...env,DB};
  const created=await handleAPI(req('/api/monitors','POST',{name:'Status API',url:'https://my-server.onrender.com/health',purpose:'uptime'}),cfg,user('admin'));
  const id=(await j(created)).id;
  assert.equal((await handleAPI(req(`/api/monitors/${id}/alerts`,'PATCH',{email_enabled:true}),cfg,user('admin'))).status,503);
  assert.equal((await j(await handleAPI(req(`/api/monitors/${id}/alerts`),cfg,user('admin')))).email_available,false);
});
