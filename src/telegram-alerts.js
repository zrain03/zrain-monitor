/*
 * Pembangun / Developer: Zrain
 * Dicipta / Created (rekod Git terawal / first Git evidence): 2026-10-30
 * Dikemas kini / Last updated: 2026-11-04
 * Fail / File: src/telegram-alerts.js
 * BM: Modul backend Worker untuk API, monitoring atau keselamatan.
 * EN: Worker backend module for APIs, monitoring or security.
 */
import {nowISO, inMinutes} from './validation.js';

export const TELEGRAM_BOT_USERNAME = 'ZrainMonitorAlertsBot';
const BATCH_SIZE = 3;
const MAX_ATTEMPTS = 3;
const textResponse = (data, status=200) => new Response(JSON.stringify(data), {
  status, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
});
const validSecret = value => typeof value==='string' && /^[A-Za-z0-9_-]{32,256}$/.test(value);
export const telegramReady = env => Boolean(env.DB && typeof env.TELEGRAM_BOT_TOKEN==='string' &&
  /^\d{5,15}:[A-Za-z0-9_-]{25,}$/.test(env.TELEGRAM_BOT_TOKEN) &&
  validSecret(env.TELEGRAM_WEBHOOK_SECRET));

// BM: Bandingkan nilai rahsia tanpa membezakan kedudukan aksara bagi mengurangkan kebocoran masa.
// EN: Compare secret values without early-position differences to limit timing leaks.
function secureEqual(a,b) {
  if(typeof a!=='string'||typeof b!=='string')return false;
  const n=Math.max(a.length,b.length);let diff=a.length^b.length;
  for(let i=0;i<n;i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);
  return diff===0;
}

// BM: Hash token sambungan Telegram sebelum disimpan; token raw hanya ditunjukkan kepada pemilik.
// EN: Hash the Telegram link token before storage; only the owner receives the raw link.
async function digest(value) {
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

// BM: Hasilkan pautan sambungan Telegram sementara bagi pemilik akaun yang disahkan.
// EN: Create a temporary Telegram link for an authenticated account owner.
export async function createTelegramLink(db,uid) {
  const bytes=new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const token=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
  const stamp=nowISO();
  await db.prepare(`INSERT INTO telegram_link_tokens(owner_uid,token_hash,expires_at,created_at)
    VALUES(?,?,?,?) ON CONFLICT(owner_uid) DO UPDATE SET token_hash=excluded.token_hash,
      expires_at=excluded.expires_at,created_at=excluded.created_at`)
    .bind(uid,await digest(token),inMinutes(stamp,10),stamp).run();
  return {url:`https://t.me/${TELEGRAM_BOT_USERNAME}?start=${token}`,expires_at:inMinutes(stamp,10)};
}

// BM: Putuskan pautan Telegram milik pengguna dan batalkan penghantaran tertangguh berkaitan.
// EN: Disconnect the user-owned Telegram link and cancel related pending deliveries.
export async function disconnectTelegram(db,uid) {
  await db.batch([
    db.prepare(`DELETE FROM telegram_alert_outbox WHERE owner_uid=? AND status!='SENT'`).bind(uid),
    db.prepare(`DELETE FROM telegram_link_tokens WHERE owner_uid=?`).bind(uid),
    db.prepare(`DELETE FROM telegram_connections WHERE owner_uid=?`).bind(uid),
    db.prepare(`UPDATE telegram_alert_settings SET enabled=0,updated_at=? WHERE owner_uid=?`)
      .bind(nowISO(),uid)
  ]);
}

// BM: Hantar mesej melalui Telegram tanpa log URL yang mengandungi token rahsia.
// EN: Send via Telegram without logging request URLs containing the confidential bot token.
async function telegramSend(env,chatId,body,fetcher=fetch) {
  const response=await fetcher(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({chat_id:chatId,text:body,disable_web_page_preview:true}),
    signal:AbortSignal.timeout(10000)
  });
  // Do not log API request URLs: the path includes the confidential bot token.
  if(!response.ok)return false;
  const data=await response.json().catch(()=>null);
  return data?.ok===true;
}

// BM: Hadkan mesej ujian setiap owner dan rekod kejayaan sebenar, bukan insiden palsu.
// EN: Rate-limit per-owner test messages and record actual delivery, not fake incidents.
export async function sendTelegramTest(env,uid,fetcher=fetch) {
  const db=env.DB;
  const linked=await db.prepare('SELECT chat_id FROM telegram_connections WHERE owner_uid=?').bind(uid).first();
  if(!linked)return {sent:false,reason:'not_connected'};
  const stamp=nowISO(),next=inMinutes(stamp,5),id=crypto.randomUUID();
  // Atomic per-user cooldown; parallel requests cannot bypass the limit.
  const claim=await db.prepare(`INSERT INTO telegram_test_limits(owner_uid,next_allowed_at) VALUES(?,?)
    ON CONFLICT(owner_uid) DO UPDATE SET next_allowed_at=excluded.next_allowed_at
    WHERE telegram_test_limits.next_allowed_at<=?`).bind(uid,next,stamp).run();
  if(claim.meta?.changes!==1)return {sent:false,reason:'cooldown'};
  await db.prepare(`INSERT INTO telegram_test_deliveries(id,owner_uid,created_at,status)
    VALUES(?,?,?,'SENDING')`).bind(id,uid,stamp).run();
  const stillLinked=await db.prepare('SELECT chat_id FROM telegram_connections WHERE owner_uid=?').bind(uid).first();
  let sent=false;
  if(stillLinked?.chat_id===linked.chat_id) {
    try {sent=await telegramSend(env,linked.chat_id,
      '✅ Zrain Monitor test message\n\nYour Telegram connection can receive messages from this bot.\n\nThis is only a delivery test, not a downtime alert. Enable alerts separately for each website in your dashboard.\n\nhttps://zrain-monitor.web.app/',fetcher);}
    catch {sent=false;}
  }
  await db.prepare(`UPDATE telegram_test_deliveries SET status=?,sent_at=? WHERE id=? AND owner_uid=?`)
    .bind(sent?'SENT':'FAILED',sent?nowISO():null,id,uid).run();
  return {sent,reason:sent?'sent':'delivery_failed'};
}

// BM: Hantar ringkasan status kepada chat Telegram yang telah dipautkan.
// EN: Send a status summary only to an already linked Telegram chat.
async function sendBotStatus(env,chatId,fetcher) {
  const linked=await env.DB.prepare('SELECT owner_uid,connected_at FROM telegram_connections WHERE chat_id=?').bind(chatId).first();
  if(!linked) {
    await telegramSend(env,chatId,'Zrain Monitor: this Telegram chat is not linked. Sign in at https://zrain-monitor.web.app/, open Settings and select Connect Telegram.',fetcher).catch(()=>{});
    return;
  }
  const [enabled,recent,test]=await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS n FROM telegram_alert_settings WHERE owner_uid=? AND enabled=1').bind(linked.owner_uid).first(),
    env.DB.prepare(`SELECT type,status,created_at FROM telegram_alert_outbox
      WHERE owner_uid=? ORDER BY created_at DESC LIMIT 3`).bind(linked.owner_uid).all(),
    env.DB.prepare('SELECT status,created_at FROM telegram_test_deliveries WHERE owner_uid=? ORDER BY created_at DESC LIMIT 1').bind(linked.owner_uid).first()
  ]);
  const count=enabled?.n||0;
  const rows=(recent.results||[]).map(e=>`${e.type}: ${e.status} (${e.created_at})`);
  const body=`✅ Zrain Monitor Telegram connection ACTIVE\n\nWebsites with alerts enabled: ${count}\n${count?'Confirmed incident messages will be sent for those monitors.':'No website alerts enabled yet. Open your dashboard, choose a monitor, and enable Telegram alerts.'}\n\nLast test message: ${test?`${test.status} (${test.created_at})`:'None yet'}\nRecent incident deliveries:\n${rows.length?rows.join('\n'):'No incident alert deliveries yet.'}\n\nSend /help for commands or /stop to disconnect.\nhttps://zrain-monitor.web.app/`;
  await telegramSend(env,chatId,body,fetcher).catch(()=>{});
}

// BM: Proses webhook Telegram setelah semakan secret dan pengasingan setiap pemilik.
// EN: Process Telegram webhooks after secret verification and per-owner isolation.
export async function handleTelegramWebhook(request,env,fetcher=fetch) {
  if(!telegramReady(env))return textResponse({ok:false},503);
  if(!secureEqual(request.headers.get('x-telegram-bot-api-secret-token'),env.TELEGRAM_WEBHOOK_SECRET))
    return textResponse({ok:false},403);
  if(request.method!=='POST')return textResponse({ok:false},405);
  if(Number(request.headers.get('content-length')||0)>4096)return textResponse({ok:false},413);
  const raw=await request.text();
  if(raw.length>4096)return textResponse({ok:false},413);
  let update;
  try{update=JSON.parse(raw);}catch{return textResponse({ok:true});}
  const message=update?.message;
  if(message?.chat?.type!=='private' || !Number.isSafeInteger(message.chat.id) ||
      !Number.isSafeInteger(message.from?.id) || message.chat.id!==message.from.id ||
      typeof message.text!=='string')return textResponse({ok:true});
  const chatId=String(message.chat.id);
  const content=message.text.trim();
  if(content==='/stop'){
    const linked=await env.DB.prepare(`SELECT owner_uid FROM telegram_connections WHERE chat_id=?`).bind(chatId).first();
    if(linked)await disconnectTelegram(env.DB,linked.owner_uid);
    await telegramSend(env,chatId,'Zrain Monitor: this Telegram chat has been disconnected. You can reconnect from your dashboard.',fetcher).catch(()=>{});
    return textResponse({ok:true});
  }
  if(content==='/status' || content==='/start') {
    await sendBotStatus(env,chatId,fetcher);
    return textResponse({ok:true});
  }
  if(content==='/help') {
    await telegramSend(env,chatId,'Zrain Monitor bot commands:\n/status - Check connection and incident delivery log\n/help - Show these commands\n/stop - Disconnect this Telegram chat\n\nTo send a test message or enable incident alerts, sign in at https://zrain-monitor.web.app/ and open Settings.',fetcher).catch(()=>{});
    return textResponse({ok:true});
  }
  const match=/^\/start ([a-f0-9]{48})$/.exec(content);
  if(!match)return textResponse({ok:true});
  const tokenHash=await digest(match[1]);
  const stamp=nowISO();
  const pending=await env.DB.prepare(`SELECT owner_uid FROM telegram_link_tokens WHERE token_hash=? AND expires_at>?`)
    .bind(tokenHash,stamp).first();
  if(!pending){
    await telegramSend(env,chatId,'This connection link expired or has already been used. Please generate a new link in Zrain Monitor.',fetcher).catch(()=>{});
    return textResponse({ok:true});
  }
  const previous=await env.DB.prepare(`SELECT owner_uid FROM telegram_connections WHERE chat_id=?`).bind(chatId).first();
  if(previous && previous.owner_uid!==pending.owner_uid){
    await telegramSend(env,chatId,'This chat is linked to another Zrain Monitor account. Disconnect it first using /stop.',fetcher).catch(()=>{});
    return textResponse({ok:true});
  }
  // Atomic check + consume: a link can bind at most once, even if Telegram retries a webhook.
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO telegram_connections(owner_uid,chat_id,connected_at)
      SELECT owner_uid,?,? FROM telegram_link_tokens WHERE token_hash=? AND expires_at>?
      ON CONFLICT(owner_uid) DO UPDATE SET chat_id=excluded.chat_id,connected_at=excluded.connected_at`)
      .bind(chatId,stamp,tokenHash,stamp),
    env.DB.prepare(`DELETE FROM telegram_link_tokens WHERE token_hash=?`).bind(tokenHash)
  ]);
  await sendBotStatus(env,chatId,fetcher);
  return textResponse({ok:true});
}

// BM: Hantar batch notifikasi tertangguh dengan had cubaan dan pengendalian kegagalan.
// EN: Deliver a bounded batch of queued alerts with attempt limits and failure handling.
export async function deliverPendingTelegramAlerts(env,fetcher=fetch) {
  if(!telegramReady(env))return {processed:0,sent:0,failed:0};
  const db=env.DB,stamp=nowISO();
  const result=await db.prepare(`SELECT o.notification_id,o.monitor_id,o.owner_uid,o.type,o.created_at,
      m.name,c.chat_id
    FROM telegram_alert_outbox o
    JOIN monitors m ON m.id=o.monitor_id AND m.owner_uid=o.owner_uid
    JOIN telegram_alert_settings s ON s.monitor_id=o.monitor_id AND s.owner_uid=o.owner_uid
    JOIN telegram_connections c ON c.owner_uid=o.owner_uid
    WHERE s.enabled=1 AND o.created_at>=s.updated_at AND o.created_at>=c.connected_at
      AND o.attempts<? AND o.next_attempt_at<=?
      AND (o.status IN ('PENDING','FAILED') OR (o.status='SENDING' AND o.claim_until<?))
    ORDER BY o.created_at ASC LIMIT ?`).bind(MAX_ATTEMPTS,stamp,stamp,BATCH_SIZE).all();
  let processed=0,sent=0,failed=0;
  for(const row of result.results||[]){
    const claimToken=crypto.randomUUID();
    const claim=await db.prepare(`UPDATE telegram_alert_outbox SET status='SENDING',claim_token=?,
      claim_until=?,attempts=attempts+1 WHERE notification_id=? AND attempts<?
      AND next_attempt_at<=? AND (status IN ('PENDING','FAILED') OR (status='SENDING' AND claim_until<?))
      AND EXISTS(SELECT 1 FROM telegram_alert_settings s JOIN telegram_connections c ON c.owner_uid=s.owner_uid
        WHERE s.monitor_id=telegram_alert_outbox.monitor_id AND s.owner_uid=telegram_alert_outbox.owner_uid
        AND s.enabled=1 AND telegram_alert_outbox.created_at>=s.updated_at
        AND telegram_alert_outbox.created_at>=c.connected_at)`)
      .bind(claimToken,inMinutes(stamp,2),row.notification_id,MAX_ATTEMPTS,stamp,stamp).run();
    if(claim.meta?.changes!==1)continue;
    // Preferences or account links may have changed while this task was claiming the item.
    const live=await db.prepare(`SELECT c.chat_id FROM telegram_alert_settings s
      JOIN telegram_connections c ON c.owner_uid=s.owner_uid
      WHERE s.monitor_id=? AND s.owner_uid=? AND s.enabled=1`).bind(row.monitor_id,row.owner_uid).first();
    if(!live || live.chat_id!==row.chat_id){
      await db.prepare(`DELETE FROM telegram_alert_outbox WHERE notification_id=? AND claim_token=?`)
        .bind(row.notification_id,claimToken).run();
      continue;
    }
    processed++;
    const monitor=String(row.name||'Website').replace(/[\r\n\t]/g,' ').slice(0,70);
    const heading=row.type==='DOWN'?'DOWN confirmed':'Service RECOVERED';
    const body=`Zrain Monitor: ${heading}\nMonitor: ${monitor}\nTime (UTC): ${row.created_at}\n\nView details: https://zrain-monitor.web.app/\n\nManage alerts in your Monitor details.`;
    let ok=false;
    try {ok=await telegramSend(env,row.chat_id,body,fetcher);}catch{ok=false;}
    if(ok){
      sent++;
      await db.prepare(`UPDATE telegram_alert_outbox SET status='SENT',sent_at=?,claim_token=NULL,
        claim_until=NULL,last_error=NULL WHERE notification_id=? AND claim_token=?`)
        .bind(nowISO(),row.notification_id,claimToken).run();
    }else{
      failed++;
      await db.prepare(`UPDATE telegram_alert_outbox SET status='FAILED',next_attempt_at=?,
        claim_token=NULL,claim_until=NULL,last_error='Telegram delivery unavailable'
        WHERE notification_id=? AND claim_token=?`)
        .bind(inMinutes(nowISO(),10),row.notification_id,claimToken).run();
    }
  }
  return {processed,sent,failed};
}
