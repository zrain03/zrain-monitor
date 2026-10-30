import {handleAPI} from "./api.js";
import {runScheduler} from "./engine.js";
import {deliverPendingEmailAlerts} from "./email-alerts.js";
import {deliverPendingTelegramAlerts,handleTelegramWebhook} from "./telegram-alerts.js";
export default {
  async fetch(request,env){
    if(new URL(request.url).pathname==='/telegram/webhook')
      return handleTelegramWebhook(request,env);
    return handleAPI(request,env);
  },
  async scheduled(_controller,env,ctx){
    ctx.waitUntil((async()=>{
      try {await runScheduler(env);}
      finally {
        // An email provider failure must never stop uptime monitoring.
        try {await deliverPendingEmailAlerts(env);}catch{console.error("Email alert delivery failed.");}
        try {await deliverPendingTelegramAlerts(env);}catch{console.error("Telegram alert delivery failed.");}
      }
    })());
  }
};
