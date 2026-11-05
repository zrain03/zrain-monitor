/*
 * Pembangun / Developer: Zrain
 * Dicipta / Created (rekod Git terawal / first Git evidence): 2026-10-30
 * Dikemas kini / Last updated: 2026-11-04
 * Fail / File: src/worker.js
 * BM: Modul backend Worker untuk API, monitoring atau keselamatan.
 * EN: Worker backend module for APIs, monitoring or security.
 */
import {handleAPI} from "./api.js";
import {runScheduler} from "./engine.js";
import {deliverPendingEmailAlerts} from "./email-alerts.js";
import {deliverPendingTelegramAlerts,handleTelegramWebhook} from "./telegram-alerts.js";
export default {
  // BM: Bagi webhook Telegram kepada handler bertandatangan; semua laluan lain melalui API auth.
  // EN: Route Telegram webhooks to signed validation; other paths use API authentication.
  async fetch(request,env){
    if(new URL(request.url).pathname==='/telegram/webhook')
      return handleTelegramWebhook(request,env);
    return handleAPI(request,env);
  },
  // BM: Scheduler terus memeriksa uptime walaupun salah satu penghantar alert gagal.
  // EN: Scheduler continues uptime checks even when an alert provider fails.
  async scheduled(_controller,env,ctx){
    ctx.waitUntil((async()=>{
      try {await runScheduler(env);}
      finally {
        // BM: Ralat penyedia alert tidak boleh menghentikan pemeriksaan uptime.
        // EN: An alert provider failure must never stop uptime monitoring.
        try {await deliverPendingEmailAlerts(env);}catch{console.error("Email alert delivery failed.");}
        try {await deliverPendingTelegramAlerts(env);}catch{console.error("Telegram alert delivery failed.");}
      }
    })());
  }
};
