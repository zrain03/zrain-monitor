import {validateTarget,nowISO,inMinutes} from "./validation.js";
import {transition} from "./state.js";
const uid=()=>crypto.randomUUID();
const RUN_SIZE=6;

export async function probe(url,env,fetcher=fetch){
  // Recheck before every request, including after a monitor is edited.
  const safe=validateTarget(url,env);
  const started=Date.now();
  let http_status=null,success=false,error_code=null;
  try{
    const response=await fetcher(safe,{method:"GET",redirect:"manual",signal:AbortSignal.timeout(12000),headers:{"Accept":"text/plain,application/json;q=0.9,*/*;q=0.2","User-Agent":"ZrainMonitor/1.0"}});
    http_status=response.status;
    success=http_status>=200 && http_status<=299;
    if(!success)error_code="HTTP_ERROR";
    // Never consume or store the response body. Cancel to release connections.
    try{await response.body?.cancel();}catch{ /* harmless if already closed */ }
  } catch(error){
    error_code=error?.name==="TimeoutError"||error?.name==="AbortError"?"TIMEOUT":"NETWORK_ERROR";
  }
  return {success,http_status,error_code,duration_ms:Math.max(0,Date.now()-started),checked_at:nowISO()};
}

export async function recordCheck(db,monitor,result,mode="scheduled"){
  const ownership=await db.prepare("SELECT lease_token,state FROM monitors WHERE id=?").bind(monitor.id).first();
  if(!ownership || ownership.state!=="ACTIVE" || ownership.lease_token!==monitor.lease_token) {
    throw new Error("Monitor lease was revoked before saving its result.");
  }
  const next=transition(monitor,result.success);
  const last=result.checked_at;
  const statements=[
    db.prepare(`INSERT INTO check_results(id,monitor_id,checked_at,duration_ms,success,http_status,error_code,mode)
      VALUES(?,?,?,?,?,?,?,?)`).bind(uid(),monitor.id,last,result.duration_ms,result.success?1:0,result.http_status,result.error_code,mode),
    db.prepare(`UPDATE monitors SET status=?, consecutive_failures=?,consecutive_successes=?,last_checked_at=?,
      last_response_ms=?,last_http_status=?,total_checks=total_checks+1,
      next_check_at=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND lease_token=? AND state='ACTIVE'`)
      .bind(next.status,next.consecutive_failures,next.consecutive_successes,last,result.duration_ms,result.http_status,inMinutes(last,5),last,monitor.id,monitor.lease_token),
    db.prepare(`INSERT INTO daily_summaries(monitor_id,day,checks,successful,failed,total_duration_ms) VALUES(?,?,?,?,?,?)
      ON CONFLICT(monitor_id,day) DO UPDATE SET checks=checks+1,successful=successful+excluded.successful,
      failed=failed+excluded.failed,total_duration_ms=total_duration_ms+excluded.total_duration_ms`)
      .bind(monitor.id,last.slice(0,10),1,result.success?1:0,result.success?0:1,result.duration_ms)
  ];
  if(next.event==="DOWN"){
    const incident=uid();
    statements.push(db.prepare(`INSERT OR IGNORE INTO incidents(id,monitor_id,started_at,reason) VALUES(?,?,?,?)`)
      .bind(incident,monitor.id,last,result.error_code||"CHECK_FAILED"));
    const noticeId=uid();
    statements.push(db.prepare(`INSERT INTO notifications(id,owner_uid,monitor_id,type,created_at) VALUES(?,?,?,?,?)`)
      .bind(noticeId,monitor.owner_uid,monitor.id,"DOWN",last));
    statements.push(db.prepare(`INSERT INTO email_alert_outbox(notification_id,owner_uid,monitor_id,type,created_at,next_attempt_at)
      SELECT ?,?,?,?,?,? FROM monitor_alert_settings WHERE monitor_id=? AND owner_uid=? AND email_enabled=1`)
      .bind(noticeId,monitor.owner_uid,monitor.id,"DOWN",last,last,monitor.id,monitor.owner_uid));
    statements.push(db.prepare(`INSERT INTO telegram_alert_outbox(notification_id,owner_uid,monitor_id,type,created_at,next_attempt_at)
      SELECT ?,?,?,?,?,? FROM telegram_alert_settings s JOIN telegram_connections c ON c.owner_uid=s.owner_uid
      WHERE s.monitor_id=? AND s.owner_uid=? AND s.enabled=1`)
      .bind(noticeId,monitor.owner_uid,monitor.id,"DOWN",last,last,monitor.id,monitor.owner_uid));
  } else if(next.event==="RECOVERED"){
    statements.push(db.prepare(`UPDATE incidents SET resolved_at=? WHERE monitor_id=? AND resolved_at IS NULL`).bind(last,monitor.id));
    const noticeId=uid();
    statements.push(db.prepare(`INSERT INTO notifications(id,owner_uid,monitor_id,type,created_at) VALUES(?,?,?,?,?)`)
      .bind(noticeId,monitor.owner_uid,monitor.id,"RECOVERED",last));
    statements.push(db.prepare(`INSERT INTO email_alert_outbox(notification_id,owner_uid,monitor_id,type,created_at,next_attempt_at)
      SELECT ?,?,?,?,?,? FROM monitor_alert_settings WHERE monitor_id=? AND owner_uid=? AND email_enabled=1`)
      .bind(noticeId,monitor.owner_uid,monitor.id,"RECOVERED",last,last,monitor.id,monitor.owner_uid));
    statements.push(db.prepare(`INSERT INTO telegram_alert_outbox(notification_id,owner_uid,monitor_id,type,created_at,next_attempt_at)
      SELECT ?,?,?,?,?,? FROM telegram_alert_settings s JOIN telegram_connections c ON c.owner_uid=s.owner_uid
      WHERE s.monitor_id=? AND s.owner_uid=? AND s.enabled=1`)
      .bind(noticeId,monitor.owner_uid,monitor.id,"RECOVERED",last,last,monitor.id,monitor.owner_uid));
  }
  // D1 batch executes transactionally. Claim is checked before this batch below.
  await db.batch(statements);
  return next;
}

export async function checkOne(db,monitor,env,fetcher=fetch){
  const result=await probe(monitor.url,env,fetcher);
  await recordCheck(db,monitor,result);
  return result;
}
export async function runScheduler(env,fetcher=fetch){
  const db=env.DB,started=nowISO(),runId=uid();
  await db.prepare(`INSERT INTO scheduler_runs(id,started_at) VALUES(?,?)`).bind(runId,started).run();
  let claimed=0,succeeded=0,failed=0,error=null;
  try{
    const due=await db.prepare(`SELECT * FROM monitors WHERE state='ACTIVE' AND next_check_at<=?
      AND (lease_until IS NULL OR lease_until<?) ORDER BY next_check_at LIMIT ?`).bind(started,started,RUN_SIZE).all();
    const list=[];
    for(const row of due.results||[]){
      const lease=uid();
      const changed=await db.prepare(`UPDATE monitors SET lease_token=?,lease_until=? WHERE id=? AND state='ACTIVE'
        AND next_check_at<=? AND (lease_until IS NULL OR lease_until<?)`)
        .bind(lease,inMinutes(started,2),row.id,started,started).run();
      if(changed.meta?.changes===1){list.push({...row,lease_token:lease});claimed++;}
    }
    // At most 6 outgoing checks per Cron run; retain Cloudflare Free connection and subrequest headroom.
    const results=await Promise.allSettled(list.map(async monitor=>checkOne(db,monitor,env,fetcher)));
    for(const r of results)r.status==="fulfilled"?succeeded++:failed++;
    // Even if a monitor failed to persist, the next run will retry after its lease expires.
    if(failed)error="Some checks failed to persist. Review Worker logs.";
    const old=new Date(Date.parse(started)-31*86400000).toISOString();
    // Limited periodic cleanup; prevents unbounded detail storage.
    await db.prepare(`DELETE FROM check_results WHERE id IN (SELECT id FROM check_results WHERE checked_at<? LIMIT 300)`).bind(old).run();
    await db.prepare(`DELETE FROM scheduler_runs WHERE id IN (SELECT id FROM scheduler_runs WHERE started_at<? LIMIT 50)`).bind(old).run();
    await db.prepare(`DELETE FROM daily_summaries WHERE rowid IN (SELECT rowid FROM daily_summaries WHERE day<? LIMIT 200)`).bind(new Date(Date.parse(started)-91*86400000).toISOString().slice(0,10)).run();
    // Test messages are diagnostics only, not business-critical incident history.
    await db.prepare(`DELETE FROM telegram_test_deliveries WHERE id IN (SELECT id FROM telegram_test_deliveries WHERE created_at<? LIMIT 100)`).bind(old).run();
  }catch(e){error=String(e?.message||e).slice(0,160);}
  await db.prepare(`UPDATE scheduler_runs SET finished_at=?,claimed=?,succeeded=?,failed=?,error=? WHERE id=?`)
    .bind(nowISO(),claimed,succeeded,failed,error,runId).run();
  if(error)throw new Error(error);
  return {claimed,succeeded,failed};
}
