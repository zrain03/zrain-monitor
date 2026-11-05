/*
 * Pembangun / Developer: Zrain
 * Dicipta / Created (rekod Git terawal / first Git evidence): 2026-10-30
 * Dikemas kini / Last updated: 2026-11-04
 * Fail / File: src/api.js
 * BM: Modul backend Worker untuk API, monitoring atau keselamatan.
 * EN: Worker backend module for APIs, monitoring or security.
 */
import {authenticate} from "./auth.js";
import {validateMonitor,nowISO,inMinutes,displayedStatus} from "./validation.js";
import {probe,recordCheck} from "./engine.js";
import {emailAlertsReady} from "./email-alerts.js";
import {getMonitoringHealth,publicMonitoringResponse} from "./monitoring-health.js";
import {telegramReady,createTelegramLink,disconnectTelegram,sendTelegramTest,TELEGRAM_BOT_USERNAME} from "./telegram-alerts.js";
// BM: Hasilkan UUID untuk rekod monitor dan operasi secara unik.
// EN: Generate unique UUIDs for monitor records and operations.
const id=()=>crypto.randomUUID();
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...headers}});
// BM: Balut ralat terhad tanpa dedahkan stack atau token.
// EN: Wrap a bounded error response without exposing stacks or tokens.
const bad=(error,status=400)=>json({error},status);
const validId=value=>/^[0-9a-f-]{36}$/.test(value);
// BM: Clamp kuota daripada env kepada sempadan keselamatan diketahui.
// EN: Clamp environment quotas to recognized safety bounds.
const num=(value,def,max)=>Math.min(max,Math.max(1,Number.parseInt(value||def,10)||def));
const isAdmin=(user,env)=>Boolean(env.BETA_ADMIN_UID && !env.BETA_ADMIN_UID.startsWith("REPLACE") && user.uid===env.BETA_ADMIN_UID);

// BM: Baca badan JSON dengan had 4 KB; input tidak sah menghasilkan ralat yang diproses oleh API.
// EN: Read a JSON body capped at 4 KB; invalid input raises an API-handled error.
async function bodyJSON(request){
  if(Number(request.headers.get("content-length")||0)>4096)throw new Error("Request body too large.");
  const content=await request.text();
  if(content.length>4096)throw new Error("Request body too large.");
  try{return JSON.parse(content);}catch{throw new Error("Invalid JSON request body.");}
}
// BM: Dapatkan monitor hanya apabila ID sah dan owner_uid padan dengan pengguna yang disahkan.
// EN: Retrieve a monitor only when its ID is valid and owner_uid matches the authenticated user.
async function own(db,uid,monitorId){
  if(!validId(monitorId))return null;
  return db.prepare("SELECT * FROM monitors WHERE id=? AND owner_uid=?").bind(monitorId,uid).first();
}
// BM: Keluarkan rahsia lease dalaman sebelum serializing monitor kepada pengguna.
// EN: Remove internal lease secrets before serializing a monitor for the owner.
function monitorOut(row){return {...row,display_status:displayedStatus(row),lease_token:undefined,lease_until:undefined};}

// BM: Proses laluan Worker: CORS, autentikasi, autorisasi pemilik, kuota dan respons JSON.
// EN: Handle Worker routes: CORS, authentication, owner authorization, quotas and JSON responses.
export async function handleAPI(request,env,dependencies={}){
  const origin=request.headers.get("origin");
  const permitted=origin && origin===env.ALLOWED_ORIGIN;
  const cors=permitted?{"Access-Control-Allow-Origin":origin,"Vary":"Origin","Access-Control-Allow-Headers":"Authorization,Content-Type","Access-Control-Allow-Methods":"GET,POST,PATCH,DELETE,OPTIONS","Access-Control-Max-Age":"600"}:{};
  if(request.method==="OPTIONS")return new Response(null,{status:permitted?204:403,headers:cors});
  const url=new URL(request.url),path=url.pathname;
  const send=(value,status=200)=>json(value,status,cors);
  const fail=(message,status=400)=>send({error:message},status);
  if(path==="/api/health" && request.method==="GET")return send({service:"zrain-monitor",state:"operational",meaning:"Worker liveness only. See /api/health/monitoring for DB and scheduler health."});
  if(path==="/api/health/monitoring" && request.method==="GET")return publicMonitoringResponse(await getMonitoringHealth(env.DB));
  if(!path.startsWith("/api/"))return fail("Not found.",404);
  if(!env.DB||!env.FIREBASE_PROJECT_ID||env.FIREBASE_PROJECT_ID.startsWith("REPLACE"))return fail("Server configuration incomplete.",503);
  if(origin&&!permitted)return fail("Origin not allowed.",403);
  let user;
  try{user=await (dependencies.authenticate||authenticate)(request,env);}catch{return fail("Sign in with a verified account.",401);}
  const db=env.DB;
  try{
    if(path==="/api/me" && request.method==="GET"){
      const stamp=nowISO();
      await db.prepare(`INSERT INTO users(uid,email,created_at,last_seen_at) VALUES(?,?,?,?)
        ON CONFLICT(uid) DO UPDATE SET email=excluded.email,last_seen_at=excluded.last_seen_at`)
        .bind(user.uid,user.email,stamp,stamp).run();
      const [mine,global]=await Promise.all([
        db.prepare('SELECT COUNT(*) AS n FROM monitors WHERE owner_uid=?').bind(user.uid).first(),
        db.prepare('SELECT COUNT(*) AS n FROM monitors').first()
      ]);
      const perUserLimit=num(env.MAX_MONITORS_PER_USER,3,10),globalLimit=num(env.MAX_GLOBAL_MONITORS,12,40);
      return send({uid:user.uid,email:user.email,admin:isAdmin(user,env),max_monitors:perUserLimit,
        capacity:{used:global?.n||0,limit:globalLimit,mine:mine?.n||0,mine_limit:perUserLimit,
          can_add:(global?.n||0)<globalLimit&&(mine?.n||0)<perUserLimit}});
    }
    if(path==="/api/telegram"&&request.method==="GET"){
      const linked=await db.prepare(`SELECT connected_at FROM telegram_connections WHERE owner_uid=?`).bind(user.uid).first();
      const enabled=linked?await db.prepare(`SELECT COUNT(*) AS n FROM telegram_alert_settings WHERE owner_uid=? AND enabled=1`).bind(user.uid).first():null;
      return send({connected:Boolean(linked),available:telegramReady(env),
        connected_at:linked?.connected_at||null,enabled_monitors:enabled?.n||0,
        bot_username:TELEGRAM_BOT_USERNAME});
    }
    if(path==="/api/telegram/link"&&request.method==="POST"){
      if(!telegramReady(env))return fail("Telegram alerts are not configured yet.",503);
      const stamp=nowISO();
      const existing=await db.prepare(`SELECT created_at FROM telegram_link_tokens WHERE owner_uid=?`).bind(user.uid).first();
      if(existing && Date.parse(stamp)-Date.parse(existing.created_at)<60000)
        return fail("Wait one minute before generating another connection link.",429);
      await db.prepare(`INSERT INTO users(uid,email,created_at,last_seen_at) VALUES(?,?,?,?)
        ON CONFLICT(uid) DO UPDATE SET email=excluded.email,last_seen_at=excluded.last_seen_at`)
        .bind(user.uid,user.email,stamp,stamp).run();
      return send(await createTelegramLink(db,user.uid));
    }
    if(path==="/api/telegram"&&request.method==="DELETE"){
      await disconnectTelegram(db,user.uid);
      return send({ok:true});
    }
    if(path==="/api/telegram/test"&&request.method==="POST"){
      if(!telegramReady(env))return fail("Telegram alerts are not configured yet.",503);
      const outcome=await sendTelegramTest(env,user.uid,dependencies.fetch||fetch);
      if(outcome.reason==='not_connected')return fail("Connect Telegram in Settings first.",409);
      if(outcome.reason==='cooldown')return fail("A test was requested recently. Try again after five minutes.",429);
      if(!outcome.sent)return fail('Test message was not delivered. Check that you have not blocked the bot; try again later.',502);
      return send({ok:true,delivery:'SENT',message:'Test message accepted by Telegram. Open the bot to confirm.'});
    }
    if(path==="/api/telegram/deliveries"&&request.method==="GET"){
      const [events,tests]=await Promise.all([
        db.prepare(`SELECT o.notification_id,o.type,o.created_at,o.status,o.attempts,o.sent_at,m.name AS monitor_name
          FROM telegram_alert_outbox o JOIN monitors m ON m.id=o.monitor_id AND m.owner_uid=o.owner_uid
          WHERE o.owner_uid=? ORDER BY o.created_at DESC LIMIT 20`).bind(user.uid).all(),
        db.prepare(`SELECT id,created_at,status,sent_at FROM telegram_test_deliveries
          WHERE owner_uid=? ORDER BY created_at DESC LIMIT 10`).bind(user.uid).all()
      ]);
      const items=[...(events.results||[]).map(x=>({type:x.type,monitor_name:x.monitor_name,
        status:x.status,attempts:x.attempts,created_at:x.created_at,sent_at:x.sent_at})),
        ...(tests.results||[]).map(x=>({type:'TEST',monitor_name:null,status:x.status,
          attempts:1,created_at:x.created_at,sent_at:x.sent_at}))]
        .sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,20);
      return send({deliveries:items});
    }
    if(path==="/api/monitors"&&request.method==="GET"){
      const rows=await db.prepare("SELECT * FROM monitors WHERE owner_uid=? ORDER BY created_at DESC LIMIT 30").bind(user.uid).all();
      return send({monitors:(rows.results||[]).map(monitorOut)});
    }
    if(path==="/api/monitors"&&request.method==="POST"){
      // Public beta: creation is opt-in through a Worker env flag.
      // Existing HTTPS host allowlist and user/global quotas remain enforced.
      // Arbitrary custom domains still require stronger destination verification.
      if(!isAdmin(user,env) && env.PUBLIC_MONITOR_CREATION!=="true")return fail("Monitor creation is not open to the public on this deployment.",403);
      const data=validateMonitor(await bodyJSON(request),env);
      const exists=await db.prepare("SELECT COUNT(*) AS n FROM monitors WHERE owner_uid=?").bind(user.uid).first();
      if((exists?.n||0)>=num(env.MAX_MONITORS_PER_USER,3,10))return fail("Your monitor limit is reached.",409);
      const global=await db.prepare("SELECT COUNT(*) AS n FROM monitors").first();
      if((global?.n||0)>=num(env.MAX_GLOBAL_MONITORS,12,40))return fail("Beta capacity reached.",409);
      const created=nowISO(),monitorId=id();
      // A conditional, single-statement INSERT closes the quota race if users submit simultaneously.
      const inserted=await db.prepare(`INSERT INTO monitors(id,owner_uid,name,url,purpose,state,status,next_check_at,created_at,updated_at)
       SELECT ?,?,?,?,?,'ACTIVE','UNKNOWN',?,?,?
       WHERE (SELECT COUNT(*) FROM monitors WHERE owner_uid=?)<? AND (SELECT COUNT(*) FROM monitors)<?`)
        .bind(monitorId,user.uid,data.name,data.url,data.purpose,created,created,created,
          user.uid,num(env.MAX_MONITORS_PER_USER,3,10),num(env.MAX_GLOBAL_MONITORS,12,40)).run();
      if(inserted.meta?.changes!==1)return fail('Beta capacity or your monitor limit was reached. Please refresh.',409);
      return send({id:monitorId},201);
    }
    if(path==="/api/notifications"&&request.method==="GET"){
      const rows=await db.prepare("SELECT id,monitor_id,type,created_at,read_at FROM notifications WHERE owner_uid=? ORDER BY created_at DESC LIMIT 50").bind(user.uid).all();
      return send({notifications:rows.results||[]});
    }
    if(path==="/api/notifications/read"&&request.method==="POST"){
      await db.prepare("UPDATE notifications SET read_at=? WHERE owner_uid=? AND read_at IS NULL").bind(nowISO(),user.uid).run();
      return send({ok:true});
    }
    if(path==="/api/admin/system"&&request.method==="GET"){
      if(!isAdmin(user,env))return fail("Forbidden.",403);
      const [run,stats]=await Promise.all([
        db.prepare("SELECT * FROM scheduler_runs ORDER BY started_at DESC LIMIT 1").first(),
        db.prepare("SELECT COUNT(*) AS monitors,SUM(CASE WHEN state='ACTIVE' THEN 1 ELSE 0 END) AS active FROM monitors").first()
      ]);
      const monitoring=await getMonitoringHealth(db);
      return send({last_run:run||null,monitors:stats||{monitors:0,active:0},
        health:{state:monitoring.healthy?'HEALTHY':'DEGRADED',reason:monitoring.reason,database_ok:monitoring.reason!=='database_unavailable',
          scheduler_ok:monitoring.healthy,last_finished_at:run?.finished_at||null},
        limits:{global:num(env.MAX_GLOBAL_MONITORS,12,40),per_user:num(env.MAX_MONITORS_PER_USER,3,10)}});
    }
    if(path==="/api/account/data"&&request.method==="DELETE"){
      const rows=await db.prepare("SELECT id FROM monitors WHERE owner_uid=?").bind(user.uid).all();
      // Foreign keys cascade results, incidents, notifications and daily summaries.
      for(const item of rows.results||[])await db.prepare("DELETE FROM monitors WHERE id=? AND owner_uid=?").bind(item.id,user.uid).run();
      await db.prepare("DELETE FROM notifications WHERE owner_uid=?").bind(user.uid).run();
      await db.prepare("DELETE FROM users WHERE uid=?").bind(user.uid).run();
      return send({ok:true,detail:"Monitor data deleted. Delete your Firebase account in the app to finish."});
    }
    const match=/^\/api\/monitors\/([\w-]+)(?:\/(checks|incidents|summary|check-now|alerts))?$/.exec(path);
    if(!match)return fail("Not found.",404);
    const monitor=await own(db,user.uid,match[1]);
    if(!monitor)return fail("Monitor not found.",404);
    const action=match[2];
    if(!action && request.method==="GET")return send({monitor:monitorOut(monitor)});
    if(!action && request.method==="PATCH"){
      const patch=await bodyJSON(request);
      if(Object.keys(patch).some(k=>!["name","purpose","state"].includes(k)))return fail("Only name, purpose or state may be updated.");
      const name=patch.name===undefined?monitor.name:patch.name;
      const purpose=patch.purpose===undefined?monitor.purpose:patch.purpose;
      validateMonitor({name,url:monitor.url,purpose},env);
      const state=patch.state===undefined?monitor.state:patch.state;
      if(!["ACTIVE","PAUSED"].includes(state))return fail("State must be ACTIVE or PAUSED.");
      await db.prepare(`UPDATE monitors SET name=?,purpose=?,state=?,next_check_at=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND owner_uid=?`)
        .bind(name.trim(),purpose,state,state==="ACTIVE"?nowISO():monitor.next_check_at,nowISO(),monitor.id,user.uid).run();
      return send({ok:true});
    }
    if(!action && request.method==="DELETE"){
      await db.prepare("DELETE FROM monitors WHERE id=? AND owner_uid=?").bind(monitor.id,user.uid).run();
      return send({ok:true});
    }
    if(action==="alerts"&&request.method==="GET"){
      const [row,telegramSetting,connected]=await Promise.all([
        db.prepare(`SELECT email_enabled,delivery_email FROM monitor_alert_settings
          WHERE monitor_id=? AND owner_uid=?`).bind(monitor.id,user.uid).first(),
        db.prepare(`SELECT enabled FROM telegram_alert_settings WHERE monitor_id=? AND owner_uid=?`)
          .bind(monitor.id,user.uid).first(),
        db.prepare(`SELECT connected_at FROM telegram_connections WHERE owner_uid=?`).bind(user.uid).first()
      ]);
      return send({email_enabled:row?.email_enabled===1,email:user.email||null,
        delivery_email:row?.email_enabled===1?row.delivery_email:null,
        email_available:emailAlertsReady(env),telegram_enabled:telegramSetting?.enabled===1,
        telegram_connected:Boolean(connected),telegram_available:telegramReady(env)});
    }
    if(action==="alerts"&&request.method==="PATCH"){
      const patch=await bodyJSON(request);
      if(!patch || typeof patch!=="object" || Array.isArray(patch) || Object.keys(patch).length!==1)
        return fail("Only one alert preference may be changed.",400);
      if(Object.hasOwn(patch,"telegram_enabled")){
        if(typeof patch.telegram_enabled!=="boolean")return fail("telegram_enabled must be a boolean.",400);
        if(patch.telegram_enabled){
          if(!telegramReady(env))return fail("Telegram alerts are not configured yet.",503);
          const linked=await db.prepare(`SELECT 1 AS connected FROM telegram_connections WHERE owner_uid=?`).bind(user.uid).first();
          if(!linked)return fail("Connect your Telegram account in Settings first.",409);
        }
        await db.prepare(`INSERT INTO telegram_alert_settings(monitor_id,owner_uid,enabled,updated_at)
          VALUES(?,?,?,?) ON CONFLICT(monitor_id) DO UPDATE SET enabled=excluded.enabled,updated_at=excluded.updated_at`)
          .bind(monitor.id,user.uid,patch.telegram_enabled?1:0,nowISO()).run();
        if(!patch.telegram_enabled)
          await db.prepare(`DELETE FROM telegram_alert_outbox WHERE monitor_id=? AND owner_uid=? AND status!='SENT'`)
            .bind(monitor.id,user.uid).run();
        return send({ok:true,telegram_enabled:patch.telegram_enabled});
      }
      if(typeof patch.email_enabled!=="boolean")return fail("Only the email_enabled boolean is accepted.",400);
      if(patch.email_enabled && !emailAlertsReady(env))return fail("Email alerts are not configured yet.",503);
      const email=user.email;
      if(patch.email_enabled && (typeof email!=="string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254))
        return fail("A verified account email is required to enable alerts.",400);
      await db.prepare(`INSERT INTO monitor_alert_settings(monitor_id,owner_uid,email_enabled,delivery_email,updated_at)
        VALUES(?,?,?,?,?) ON CONFLICT(monitor_id) DO UPDATE SET email_enabled=excluded.email_enabled,
          delivery_email=excluded.delivery_email,updated_at=excluded.updated_at`)
        .bind(monitor.id,user.uid,patch.email_enabled?1:0,patch.email_enabled?email:null,nowISO()).run();
      // A revoked preference must also discard previously queued mail.
      if(!patch.email_enabled){
        await db.prepare(`DELETE FROM email_alert_outbox WHERE monitor_id=? AND owner_uid=? AND status!='SENT'`)
          .bind(monitor.id,user.uid).run();
      }
      return send({ok:true,email_enabled:patch.email_enabled});
    }
    if(action==="checks"&&request.method==="GET"){
      // Cursor pagination: return at most 250 rows per response. Keep the
      // authorization/ownership check above this route unchanged.
      const limit=num(url.searchParams.get("limit"),30,250);
      const before=url.searchParams.get("before");
      if(before && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(before) ||
          !Number.isFinite(Date.parse(before))))return fail("Invalid checks cursor.",400);
      const sql=`SELECT checked_at,duration_ms,success,http_status,error_code,mode
        FROM check_results WHERE monitor_id=? ${before?"AND checked_at<?":""} ORDER BY checked_at DESC LIMIT ?`;
      const rows=before
        ? await db.prepare(sql).bind(monitor.id,before,limit+1).all()
        : await db.prepare(sql).bind(monitor.id,limit+1).all();
      const results=rows.results||[];
      return send({checks:results.slice(0,limit),has_more:results.length>limit});
    }
    if(action==="incidents"&&request.method==="GET"){
      const rows=await db.prepare("SELECT id,started_at,resolved_at,reason FROM incidents WHERE monitor_id=? ORDER BY started_at DESC LIMIT 50").bind(monitor.id).all();
      return send({incidents:rows.results||[]});
    }
    if(action==="summary"&&request.method==="GET"){
      const rows=await db.prepare("SELECT day,checks,successful,failed,total_duration_ms FROM daily_summaries WHERE monitor_id=? ORDER BY day DESC LIMIT 90").bind(monitor.id).all();
      return send({days:rows.results||[]});
    }
    if(action==="check-now"&&request.method==="POST"){
      if(monitor.state!=="ACTIVE")return fail("Resume the monitor before checking.",409);
      const current=nowISO();
      if(monitor.last_checked_at && Date.parse(current)-Date.parse(monitor.last_checked_at)<5*60000)return fail("Check Now has a five-minute cooldown.",429);
      const lease=id();
      const claim=await db.prepare(`UPDATE monitors SET lease_token=?,lease_until=? WHERE id=? AND owner_uid=? AND state='ACTIVE'
        AND (lease_until IS NULL OR lease_until<?) AND (last_checked_at IS NULL OR last_checked_at<?)`)
        .bind(lease,inMinutes(current,2),monitor.id,user.uid,current,inMinutes(current,-5)).run();
      if(claim.meta?.changes!==1)return fail("A check is already running or was performed recently.",409);
      const result=await probe(monitor.url,env,dependencies.fetch||fetch);
      await recordCheck(db,{...monitor,lease_token:lease},result,"manual");
      return send({result});
    }
    return fail("Method not allowed.",405);
  }catch(error){
    if(error instanceof Error && /^(Provide|Only|Invalid|Name must|Select|This domain|State must|Request body)/.test(error.message))return fail(error.message,400);
    // Do not reveal private SQL, tokens or internal infrastructure details.
    console.error("API operation failed:",error);
    return fail("The service could not complete this request.",500);
  }
}
