/*
 * Pembangun / Developer: Zrain
 * Dicipta / Created (rekod Git terawal / first Git evidence): 2026-10-30
 * Dikemas kini / Last updated: 2026-11-04
 * Fail / File: src/email-alerts.js
 * BM: Modul backend Worker untuk API, monitoring atau keselamatan.
 * EN: Worker backend module for APIs, monitoring or security.
 */
import {nowISO,inMinutes} from './validation.js';

const BATCH_SIZE = 3;
const MAX_ATTEMPTS = 3;
// BM: Semak format alamat penerima dan panjang sebelum penghantaran.
// EN: Validate recipient email shape and length before delivery.
const validEmail = value => typeof value === 'string' && value.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// BM: Benarkan email delivery hanya apabila konfigurasi penyedia lengkap.
// EN: Enable email delivery only when provider configuration is complete.
export const emailAlertsReady = env => Boolean(env.RESEND_API_KEY &&
  typeof env.ALERT_FROM_EMAIL === 'string' && validEmail(env.ALERT_FROM_EMAIL));

// BM: Cuba hantar e-mel tertangguh tanpa membenarkan provider menghentikan scheduler.
// EN: Attempt queued email delivery without allowing provider failures to stop scheduling.
export async function deliverPendingEmailAlerts(env, fetcher=fetch) {
  if (!env.DB || !emailAlertsReady(env)) return {processed:0, sent:0, failed:0};
  const db = env.DB;
  const stamp = nowISO();
  const rows = await db.prepare(`SELECT o.notification_id,o.monitor_id,o.owner_uid,o.type,o.created_at,o.attempts,
      m.name, s.delivery_email
    FROM email_alert_outbox o
    JOIN monitors m ON m.id=o.monitor_id AND m.owner_uid=o.owner_uid
    JOIN monitor_alert_settings s ON s.monitor_id=o.monitor_id AND s.owner_uid=o.owner_uid
    WHERE s.email_enabled=1 AND s.delivery_email IS NOT NULL AND o.created_at>=s.updated_at AND o.attempts<?
      AND o.next_attempt_at<=?
      AND (o.status IN ('PENDING','FAILED') OR (o.status='SENDING' AND o.claim_until<?))
    ORDER BY o.created_at ASC LIMIT ?`)
    .bind(MAX_ATTEMPTS,stamp,stamp,BATCH_SIZE).all();
  let processed=0,sent=0,failed=0;
  for (const row of rows.results||[]) {
    // A monitor can be paused or its alert preference revoked between selection and delivery.
    if(!validEmail(row.delivery_email)) continue;
    const token=crypto.randomUUID();
    const claim=await db.prepare(`UPDATE email_alert_outbox SET status='SENDING',claim_token=?,
      claim_until=?,attempts=attempts+1 WHERE notification_id=? AND attempts<?
      AND next_attempt_at<=? AND (status IN ('PENDING','FAILED')
        OR (status='SENDING' AND claim_until<?))
      AND EXISTS (SELECT 1 FROM monitor_alert_settings s WHERE s.monitor_id=email_alert_outbox.monitor_id
        AND s.owner_uid=email_alert_outbox.owner_uid AND s.email_enabled=1
        AND email_alert_outbox.created_at>=s.updated_at)`)
      .bind(token,inMinutes(stamp,2),row.notification_id,MAX_ATTEMPTS,stamp,stamp).run();
    if(claim.meta?.changes!==1) continue;
    processed++;
    const title=row.type==='DOWN'?'Downtime confirmed':'Service recovered';
    const name=String(row.name||'Website').replace(/[\r\n\t]/g,' ').slice(0,70);
    const subject=`Zrain Monitor: ${title} - ${name}`;
    const email={from:env.ALERT_FROM_EMAIL,to:[row.delivery_email],subject,
      text:`${title}\nMonitor: ${name}\nEvent time: ${row.created_at}\n\nOpen https://zrain-monitor.web.app/ to view the incident.\n\nYou enabled these alerts for this monitor. You can turn them off in Monitor details.`};
    let ok=false,providerId=null,error='Delivery unavailable';
    try {
      const response=await fetcher('https://api.resend.com/emails',{
        method:'POST',signal:AbortSignal.timeout(10000),
        headers:{'Authorization':`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json',
          'Idempotency-Key':`zrain-monitor/${row.notification_id}`},
        body:JSON.stringify(email)
      });
      if(response.ok){
        const body=await response.json().catch(()=>({}));
        ok=typeof body.id==='string' && body.id.length>0;
        providerId=ok?body.id:null;
        if(!ok)error='Email provider returned no message ID';
      }else error=`Email provider returned HTTP ${response.status}`;
    }catch{error='Email provider request failed';}
    if(ok){
      await db.prepare(`UPDATE email_alert_outbox SET status='SENT',sent_at=?,provider_id=?,
        last_error=NULL,claim_token=NULL,claim_until=NULL WHERE notification_id=? AND claim_token=?`)
        .bind(nowISO(),providerId,row.notification_id,token).run();
      sent++;
    }else{
      // Retry within one hour; use the same provider idempotency key to suppress duplicates.
      const delay=[5,15,60][Math.min(row.attempts,2)];
      await db.prepare(`UPDATE email_alert_outbox SET status='FAILED',next_attempt_at=?,
        last_error=?,claim_token=NULL,claim_until=NULL WHERE notification_id=? AND claim_token=?`)
        .bind(inMinutes(nowISO(),delay),error,row.notification_id,token).run();
      failed++;
    }
  }
  return {processed,sent,failed};
}
