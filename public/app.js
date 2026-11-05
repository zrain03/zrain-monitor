/*
 * Pembangun / Developer: Zrain
 * Dicipta / Created (rekod Git terawal / first Git evidence): 2026-10-30
 * Dikemas kini / Last updated: 2026-11-04
 * Fail / File: public/app.js
 * BM: Perilaku antaramuka atau konfigurasi frontend Monitor.
 * EN: Monitor frontend behavior or configuration.
 */
import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {getAuth,onAuthStateChanged,GoogleAuthProvider,signInWithPopup,createUserWithEmailAndPassword,
  signInWithEmailAndPassword,sendPasswordResetEmail,sendEmailVerification,signOut,deleteUser,
  getRedirectResult,signInWithRedirect,updateProfile,linkWithPopup,setPersistence,browserLocalPersistence} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {FIREBASE_CONFIG,API_ORIGIN} from "./firebase-config.js";
import {googleErrorMessage,googleRedirectAvailable} from "./google-auth-errors.js?v=1.0.6";
const $=id=>document.getElementById(id);
const configured=!Object.values(FIREBASE_CONFIG).some(v=>String(v).includes("REPLACE_WITH"))&&!API_ORIGIN.includes("REPLACE_WITH");
let auth=null,user=null,profile=null,monitors=[],currentId=null,authMode="signin",refreshing=false;
const MY_TIME=new Intl.DateTimeFormat("en-MY",{timeZone:"Asia/Kuala_Lumpur",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false});
// BM: Tukar tarikh UTC kepada paparan MYT dengan pecahan milisaat hanya jika input menyediakannya.
// EN: Format UTC dates for Malaysian time, retaining millisecond precision only when supplied.
const time=value=>{if(!value)return "Not checked yet";const d=new Date(value);if(!Number.isFinite(d.getTime()))return "Unknown timestamp";const hasFraction=typeof value==="string"&&/\.\d{1,9}(?:(?:Z)|(?:[+-]\d{2}:?\d{2}))?$/.test(value);return MY_TIME.format(d)+(hasFraction?"."+String(d.getMilliseconds()).padStart(3,"0"):"")+" MYT";};
const text=(tag,str,cls)=>{const e=document.createElement(tag);if(cls)e.className=cls;e.textContent=String(str??"");return e;};
// BM: Tambah nod anak dan kembalikan parent untuk membina struktur UI ringkas.
// EN: Append children and return their parent for small UI compositions.
const add=(parent,...children)=>{parent.append(...children);return parent;};
const button=(label,fn,cls="button button-outline")=>{const b=text("button",label,cls);b.type="button";b.addEventListener("click",fn);return b;};
// BM: Paparkan maklumat atau ralat dalam banner berperanan status tanpa menyentuh auth.
// EN: Display information or errors in the status banner without changing authentication.
const info=(message,bad=false)=>{const b=$("banner");b.hidden=!message;b.textContent=message||"";b.style.borderColor=bad?"#e9b6b6":"";b.style.color=bad?"#a33838":"";};
const errorMessage=error=>({"auth/email-already-in-use":"This email already has an account.","auth/invalid-credential":"Incorrect email or password.","auth/popup-closed-by-user":"Google sign-in was cancelled.","auth/requires-recent-login":"For account deletion, sign out and sign in again first.",
  "auth/too-many-requests":"Too many attempts. Please try again later.",
  "auth/weak-password":"Choose a stronger password.",
  "auth/operation-not-allowed":"This sign-in method is not enabled. Please contact Zrain support.",
  "auth/unauthorized-domain":"This website domain is not authorized for Google sign-in.",
  "auth/network-request-failed":"Network error. Check your connection and try again."}[error?.code]||error?.message||"Something went wrong.");
// BM: Panggil Worker API menggunakan token pengguna aktif; pulangkan JSON atau ralat selamat.
// EN: Call the Worker API with the current user token; return JSON or a safe error.
async function api(path,options={}){
  if(!user)throw new Error("Please sign in first.");
  const token=await user.getIdToken();
  const response=await fetch(API_ORIGIN+path,{...options,headers:{Authorization:`Bearer ${token}`,...(options.body?{"Content-Type":"application/json"}:{}),...options.headers},cache:"no-store"});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||`Request failed (${response.status})`);
  return data;
}
// BM: Selaraskan visibility dashboard, tindakan akaun dan status log masuk; tiada akses admin diberikan di sini.
// EN: Synchronize dashboard/account visibility and signed-in state; this does not grant admin rights.
function setAuthState(logged){
  $("dashboard").hidden=!logged;$("signedout").hidden=logged;$("hero").hidden=logged;
  $("auth-open").hidden=logged;$("signout").hidden=!logged;
  $("account-email").hidden=!logged;
  $("account-email").textContent=user?.email||"";
  $("settings-email").textContent=user?.email||"Signed out";
  $("connect-google-panel").hidden=!logged || Boolean(user?.providerData?.some(p=>p.providerId==="google.com"));
}
let telegramPendingLink = null;

// BM: Bawa pengguna ke senarai monitor selepas menekan tindakan sambung Telegram.
// EN: Focus the monitor list after the user chooses to configure Telegram alerts.
function openMonitorChoices(){
  if(!monitors.length){
    $("add-open").scrollIntoView({behavior:"smooth",block:"center"});
    $("add-open").focus({preventScroll:true});
    info("No monitors yet. Choose Add monitor to register your website first.");
    return;
  }
  const list=$("monitor-list");
  list.scrollIntoView({behavior:"smooth",block:"start"});
  const first=list.querySelector(".monitor-title");
  first?.focus({preventScroll:true});
  info("In Active monitors, select your website name. Its alert controls will appear under Monitor details.");
}

// BM: Ambil status sambungan Telegram bagi owner dan bina semula kawalan bergantung pada hasil API.
// EN: Fetch owner-scoped Telegram connection state and render controls from the API result.
async function loadTelegramSettings(checkConnection=false){
  const section=$("telegram-settings");
  if(!section||!user)return;
  try{
    const status=await api("/api/telegram");
    const linked=Boolean(status.connected);
    if(linked)telegramPendingLink=null;
    section.replaceChildren();
    const state=text("span",!status.available?"Unavailable":linked?"Connected":"Not connected",
      "telegram-status "+(!status.available?"is-unavailable":linked?"is-connected":"is-disconnected"));
    const heading=text("div","","telegram-connection-heading");
    add(heading,text("strong","Connection status"),state);
    section.append(heading);
    const summary=text("p",!status.available
      ? "Telegram delivery is not available on this deployment yet. In-app event history still works."
      : linked
      ? `Your Telegram connection is active. ${status.enabled_monitors||0} website(s) have incident alerts enabled. Use Send test message to confirm delivery, or /status in the bot to see the latest incident delivery log.`
      : "Your Telegram chat is not linked yet. Connect it below, then check again after tapping Start in Telegram.",
      "telegram-connection-copy");
    section.append(summary);

    const actions=text("div","","telegram-actions");
    if(linked){
      actions.append(button("Choose a monitor to enable alerts",openMonitorChoices,"button button-primary"));
      const disconnect=button("Disconnect Telegram",async()=>{
        if(!confirm("Disconnect Telegram? Pending Telegram alerts will be cancelled."))return;
        disconnect.disabled=true;
        try{
          await api("/api/telegram",{method:"DELETE"});
          telegramPendingLink=null;
          await loadTelegramSettings();
          if(currentId)await selectMonitor(currentId,false);
          info("Telegram disconnected. Existing monitor checks are unchanged.");
        }catch(e){info(errorMessage(e),true);}finally{disconnect.disabled=false;}
      },"button button-outline");
      actions.append(disconnect);
    }else if(status.available){
      const connect=button(telegramPendingLink?"Generate a new connection link":"Connect Telegram",async()=>{
        connect.disabled=true;
        try{
          const link=await api("/api/telegram/link",{method:"POST"});
          telegramPendingLink={url:link.url,expires_at:link.expires_at};
          await loadTelegramSettings();
          info("Connection link ready. Open Telegram, tap Start, then come back and check the connection.");
        }catch(e){info(errorMessage(e),true);}
        finally{connect.disabled=false;}
      },"button button-primary");
      actions.append(connect);
    }
    if(linked&&status.available){
      const test=button("Send test message",async()=>{
        test.disabled=true;
        try{
          const result=await api('/api/telegram/test',{method:'POST'});
          info(result.message||'Test message sent. Open Telegram to confirm receipt.');
          await loadTelegramSettings();
        }catch(e){info(errorMessage(e),true);await loadTelegramSettings();}
        finally{test.disabled=false;}
      },'button button-outline');
      actions.append(test);
    }
    if(status.available){
      const check=button("Check connection",async()=>{
        check.disabled=true;
        try{await loadTelegramSettings(true);}
        catch(e){info(errorMessage(e),true);}
        finally{check.disabled=false;}
      },"button button-outline");
      actions.append(check);
    }
    section.append(actions);
    if(linked){
      const log=text('div','','telegram-delivery-panel');
      log.append(text('h4','Telegram delivery log'));
      log.append(text('p','Recent confirmed incident alerts and delivery tests. SENT means the Telegram API accepted the message; it does not prove that the notification was read.','muted small'));
      try {
        const history=await api('/api/telegram/deliveries');
        const events=history.deliveries||[];
        if(!events.length){
          log.append(text('p','No Telegram deliveries yet. Use Send test message to verify that your connection can receive messages.','telegram-empty'));
        } else for(const event of events){
          const item=text('div','','telegram-delivery-item');
          const label=event.type==='TEST'?'Test message':`${event.type} · ${event.monitor_name||'Monitor'}`;
          const statusLabel=event.status==='SENT'?'Sent':event.status==='SENDING'?'Sending':
            event.status==='FAILED'?(event.attempts>=3?'Failed after retries':'Retry pending'):'Queued';
          add(item,text('strong',label),text('span',statusLabel,'telegram-delivery-state state-'+event.status.toLowerCase()),
            text('small',time(event.sent_at||event.created_at)));
          log.append(item);
        }
      }catch {
        log.append(text('p','Delivery history is temporarily unavailable. Monitor checks continue normally.','muted small'));
      }
      section.append(log);
    }

    if(!linked&&status.available&&telegramPendingLink){
      const linkInfo=text("div","","telegram-link-box");
      const link=text("a","Open @ZrainMonitorAlertsBot in Telegram","telegram-link-button");
      link.href=telegramPendingLink.url;
      link.target="_blank";link.rel="noopener noreferrer";
      const expiry=telegramPendingLink.expires_at?new Date(telegramPendingLink.expires_at):null;
      const validExpiry=expiry&&Number.isFinite(expiry.getTime());
      add(linkInfo,link,text("p",validExpiry
        ? `Link expires at ${time(telegramPendingLink.expires_at)}. In Telegram tap Start, then return and select Check connection.`
        : "Link expires after 10 minutes. In Telegram tap Start, then return and select Check connection.","muted small"));
      section.append(linkInfo);
    }
    if(checkConnection){
      const feedback=text("p",linked
        ? "Connection confirmed. Next: select a website in Active monitors and enable Telegram alerts for that website."
        : telegramPendingLink
        ? "Not connected yet. Open the Telegram link above, tap Start in that chat, then choose Check connection again."
        : "Not connected. Select Connect Telegram first, tap Start in the bot chat, then check the connection.",
        "telegram-feedback");
      feedback.setAttribute("role","status");
      section.append(feedback);
    }
  }catch(e){
    section.replaceChildren(text("p","Unable to check Telegram connection: "+errorMessage(e),"telegram-feedback"));
  }
}
// BM: Muat data owner dan monitor selepas auth, kemudian kemas kini workspace tanpa mendedahkan akaun lain.
// EN: Load authenticated owner data and monitors, then refresh the private workspace.
async function load(){
  if(refreshing||!user)return;
  refreshing=true;$("refresh-all").disabled=true;
  try{
    const [me,data,notifications]=await Promise.all([api("/api/me"),api("/api/monitors"),api("/api/notifications")]);
    profile=me;monitors=data.monitors||[];
    renderList();renderNotifications(notifications.notifications||[]);
    const capacity=$('capacity-info');
    if(capacity && me.capacity){
      const c=me.capacity;
      capacity.textContent=`Public beta capacity: ${c.used}/${c.limit} total slots used. Your monitors: ${c.mine}/${c.mine_limit}. `+
        (c.can_add?'You can add another monitor.':c.mine>=c.mine_limit?'Your account has reached its monitor limit.':'The public beta is currently full. Existing monitoring continues.');
      capacity.className='capacity-info'+(!c.can_add?' capacity-full':'');
    }
    $("add-open").disabled=false;
    $("add-open").title="Add a public HTTPS website or API to monitor (up to 5 per account)";
    $("system").hidden=!profile.admin;
    if(profile.admin)await loadSystem();
    await loadTelegramSettings();
    if(currentId && monitors.some(m=>m.id===currentId))await selectMonitor(currentId,false);
    else {
      const panel=text("div","","monitor-empty-guidance");
      add(panel,text("h3",monitors.length?"Choose a website to manage":"Add your first monitor"),
        text("p",monitors.length
          ? "Find your website under Active monitors, select its name, then enable Telegram alerts here."
          : "Choose Add monitor near the top to register a public HTTPS website or API. Afterwards, return here to set up its alerts."));
      panel.append(button(monitors.length?"Show Active monitors":"Go to Add monitor",openMonitorChoices,"button button-primary"));
      $("monitor-detail").replaceChildren(panel);
    }
  }catch(e){info(errorMessage(e),true);}finally{refreshing=false;$("refresh-all").disabled=false;}
}
// BM: Paparkan senarai monitor yang sudah diperoleh daripada API owner sahaja.
// EN: Render the monitor list previously fetched from owner-authorized API routes.
function renderList(){
  const list=$("monitor-list");list.replaceChildren();
  const counts={UP:0,DOWN:0,VERIFYING:0,other:0};
  for(const mon of monitors){const stat=mon.display_status||"UNKNOWN";if(counts[stat]!==undefined)counts[stat]++;else counts.other++;}
  $("metric-up").textContent=counts.UP;$("metric-down").textContent=counts.DOWN;
  $("metric-verifying").textContent=counts.VERIFYING;$("metric-other").textContent=counts.other;
  if(!monitors.length){list.append(text("div","No websites have been added yet. Choose Add monitor above to start checking your public HTTPS website or API.","empty-state"));return;}
  for(const mon of monitors){
    const card=text("article","","monitor-card");const glyph=text("span",mon.purpose==="keepawake"?"♡":"↗","monitor-icon");
    const main=text("div","","monitor-main");
    const heading=button(mon.name,()=>selectMonitor(mon.id),"monitor-title");
    heading.setAttribute("aria-label",`Open details and alert settings for ${mon.name}`);
    const meta=text("div","","monitor-meta");add(meta,text("span",mon.purpose==="keepawake"?"Keep-Awake":"Uptime"),text("span",`Last checked: ${time(mon.last_checked_at)}`),text("span",mon.last_response_ms==null?"No response yet":`${mon.last_response_ms} ms`));
    add(main,heading,text("div",mon.url,"monitor-url"),meta);
    const status=text("span",mon.display_status||"UNKNOWN",`status-badge status-${mon.display_status||"UNKNOWN"}`);
    add(card,glyph,main,status);card.append(text("span","Manage alerts","monitor-manage-hint"));list.append(card);
  }
}
// BM: Paparkan sejarah notifikasi dalaman tanpa memerlukan penghantaran Telegram sebenar.
// EN: Render private in-app notification history independently of actual Telegram delivery.
function renderNotifications(rows){
  const list=$("notification-list");list.replaceChildren();
  if(!rows.length){list.append(text("div","No incidents yet. Notifications appear after confirmed downtime and recovery.","empty-state"));return;}
  for(const notification of rows){
    const name=monitors.find(m=>m.id===notification.monitor_id)?.name||"Deleted monitor";
    const item=text("article","","event-item");const title=notification.type==="DOWN"?"Downtime confirmed":"Service recovered";
    add(item,text("h3",`${title} • ${name}`),text("p",`${time(notification.created_at)}${notification.read_at?"":" • Unread"}`));list.append(item);
  }
}
// BM: Paparkan metrik ringkas dengan label yang boleh difahami.
// EN: Build an accessible labeled metric cell.
function statCell(label,value){const c=text("div","","mini-stat");return add(c,text("span",label),text("strong",value));}
function latencyChart(rows){
  const container=text("div","","latency-chart");
  const samples=(rows||[]).slice(0,30).reverse().map(x=>Number(x.duration_ms)).filter(Number.isFinite);
  if(!samples.length)return text("p","No latency measurements yet.","muted small");
  const w=640,h=140,pad=12,max=Math.max(1,...samples),min=0;
  const points=samples.map((value,i)=>{
    const x=pad+(samples.length===1?0:i*(w-2*pad)/(samples.length-1));
    const y=h-pad-(value-min)/(max-min)*(h-2*pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("viewBox",`0 0 ${w} ${h}`);svg.setAttribute("role","img");
  svg.setAttribute("aria-label",`Response time history for ${samples.length} checks; maximum ${max} milliseconds`);
  const grid=document.createElementNS("http://www.w3.org/2000/svg","line");
  for(const [a,v] of [["x1",pad],["x2",w-pad],["y1",h-pad],["y2",h-pad]])grid.setAttribute(a,String(v));
  grid.setAttribute("stroke","#eedfd5");
  const polyline=document.createElementNS("http://www.w3.org/2000/svg","polyline");
  polyline.setAttribute("points",points.join(" "));polyline.setAttribute("fill","none");
  polyline.setAttribute("stroke","#c45335");polyline.setAttribute("stroke-width","3");
  polyline.setAttribute("stroke-linecap","round");polyline.setAttribute("stroke-linejoin","round");
  svg.append(grid,polyline);
  add(container,text("p",`Last ${samples.length} checks • Max ${max} ms`,"muted small"),svg);
  return container;
}
// BM: Baca butiran dan sejarah bagi monitor yang dipilih; parameter scroll mengawal navigasi sahaja.
// EN: Load selected monitor detail/history; scroll controls navigation only.
async function selectMonitor(id,scroll=true){
  const mon=monitors.find(m=>m.id===id);if(!mon)return;
  currentId=id;const pane=$("monitor-detail");pane.replaceChildren(text("div","Loading monitor details…","empty-state"));
  try{
    const [checks,incidents,summary,alerts]=await Promise.all([api(`/api/monitors/${id}/checks`),api(`/api/monitors/${id}/incidents`),api(`/api/monitors/${id}/summary`),api(`/api/monitors/${id}/alerts`)]);
    if(currentId!==id)return;
    const header=text("div","","detail-top"),wrap=text("div");
    add(wrap,text("h3",mon.name,"detail-title"),text("div",mon.url,"detail-url"));add(header,wrap,text("span",mon.display_status||"UNKNOWN",`status-badge status-${mon.display_status||"UNKNOWN"}`));
    const actions=text("div","","detail-actions");
    actions.append(button("Check now",async()=>{
      if(!confirm(`Run a manual check of ${mon.name}? There is a five-minute cooldown.`))return;
      try{await api(`/api/monitors/${id}/check-now`,{method:"POST"});info("Manual check completed.");await load();}catch(e){info(errorMessage(e),true);}
    }),button(mon.state==="ACTIVE"?"Pause":"Resume",async()=>{
      try{await api(`/api/monitors/${id}`,{method:"PATCH",body:JSON.stringify({state:mon.state==="ACTIVE"?"PAUSED":"ACTIVE"})});await load();}catch(e){info(errorMessage(e),true);}
    }),button("Rename",async()=>{
      const name=prompt("New monitor name",mon.name);if(name===null)return;
      try{await api(`/api/monitors/${id}`,{method:"PATCH",body:JSON.stringify({name})});await load();}catch(e){info(errorMessage(e),true);}
    }),button("Delete",async()=>{
      if(!confirm(`Permanently delete ${mon.name} and its monitoring history?`))return;
      try{await api(`/api/monitors/${id}`,{method:"DELETE"});currentId=null;await load();info("Monitor deleted.");}catch(e){info(errorMessage(e),true);}
    },"button button-outline danger"));
    // A compact notification card keeps the channel, status and action together.
    // Backend alert preferences, ownership checks and delivery logic are unchanged.
    const alertsBox=text("section","","monitor-alert-panel monitor-alert-card");
    alertsBox.setAttribute("aria-label",`Notification settings for ${mon.name}`);
    const alertsHeader=text("div","","monitor-alert-heading");
    const headingCopy=text("div","","monitor-alert-heading-copy");
    const headingLine=text("div","","monitor-alert-heading-line");
    const bell=text("span","","monitor-alert-bell");
    bell.setAttribute("aria-hidden","true");
    add(headingLine,bell,text("h4","Notification settings"));
    add(headingCopy,headingLine,text("p","Get notified when this monitor goes DOWN or RECOVERED.","muted small"));
    const alertStatus=text("span","","monitor-alert-status");
    alertStatus.setAttribute("role","status");
    alertStatus.setAttribute("aria-live","polite");
    function refreshAlertStatus(){
      const state=!alerts.telegram_available?"Unavailable":
        !alerts.telegram_connected?"Not connected":
        alerts.telegram_enabled?"Enabled":"Disabled";
      alertStatus.textContent=state;
      alertStatus.className="monitor-alert-status is-"+state.toLowerCase().replaceAll(" ","-");
    }
    refreshAlertStatus();
    add(alertsHeader,headingCopy,alertStatus);
    alertsBox.append(alertsHeader);

    const channel=text("div","","monitor-alert-channel");
    const telegramIcon=text("span","➤","monitor-alert-telegram-icon");
    telegramIcon.setAttribute("aria-hidden","true");
    const channelCopy=text("div","","monitor-alert-channel-copy");
    const telegramTitle=text("strong","Telegram incident alerts");
    const telegramCopy=text("p",!alerts.telegram_available
      ? "Telegram delivery is not configured. Confirmed events still appear in Event history."
      : !alerts.telegram_connected
      ? "Connect Telegram in Account & notifications, then enable alerts for this website."
      : "Receive messages for confirmed DOWN and RECOVERED events.","muted small");
    add(channelCopy,telegramTitle,telegramCopy);
    add(channel,telegramIcon,channelCopy);
    alertsBox.append(channel);

    const actionsRow=text("div","","monitor-alert-actions");
    const telegramButton=button(alerts.telegram_enabled?"Disable Telegram alerts":"Enable Telegram alerts",async()=>{
      const enabling=!alerts.telegram_enabled;
      telegramButton.disabled=true;
      try{
        const saved=await api(`/api/monitors/${id}/alerts`,{method:"PATCH",body:JSON.stringify({telegram_enabled:enabling})});
        alerts.telegram_enabled=saved.telegram_enabled;
        telegramButton.textContent=alerts.telegram_enabled?"Disable Telegram alerts":"Enable Telegram alerts";
        refreshAlertStatus();
        info(alerts.telegram_enabled?"Telegram alerts enabled for this monitor.":"Telegram alerts disabled for this monitor.");
      }catch(e){info(errorMessage(e),true);}
      finally{telegramButton.disabled=false;}
    },"button button-outline monitor-alert-action");
    telegramButton.disabled=!alerts.telegram_enabled && (!alerts.telegram_available||!alerts.telegram_connected);
    if(alerts.telegram_connected||alerts.telegram_enabled){
      actionsRow.append(telegramButton);
    }else if(alerts.telegram_available){
      actionsRow.append(button("Go to Telegram setup",()=>{
        $("settings").scrollIntoView({behavior:"smooth",block:"start"});updateNav("settings");
      },"button button-primary monitor-alert-action"));
    }
    if(actionsRow.childNodes.length)alertsBox.append(actionsRow);

    // Keep existing optional email alerts functional when a sender is configured.
    if(alerts.email_available||alerts.email_enabled){
      const emailSection=text("div","","monitor-alert-email");
      const alertsTitle=text("strong","Email incident alerts");
      const alertsCopy=text("p",alerts.email_available
        ? "Optional emails for confirmed DOWN and RECOVERED events."
        : "Email sending has not been configured yet.","muted small");
      const alertsButton=button(alerts.email_enabled?"Disable email alerts":"Enable email alerts",async()=>{
        const enabling=!alerts.email_enabled;
        if(enabling && !confirm(`Send DOWN and RECOVERED email alerts for ${mon.name} to ${alerts.email}?`))return;
        alertsButton.disabled=true;
        try{
          const saved=await api(`/api/monitors/${id}/alerts`,{method:"PATCH",body:JSON.stringify({email_enabled:enabling})});
          alerts.email_enabled=saved.email_enabled;
          alertsButton.textContent=alerts.email_enabled?"Disable email alerts":"Enable email alerts";
          info(alerts.email_enabled?"Email alerts enabled for this monitor.":"Email alerts disabled for this monitor.");
        }catch(e){info(errorMessage(e),true);}
        finally{alertsButton.disabled=false;}
      },"button button-outline monitor-alert-action");
      alertsButton.disabled=!alerts.email_available && !alerts.email_enabled;
      add(emailSection,alertsTitle,alertsCopy,alertsButton);
      alertsBox.append(emailSection);
    }
    const last30=summary.days||[];
    const successes=last30.reduce((n,d)=>n+Number(d.successful||0),0);
    const total=last30.reduce((n,d)=>n+Number(d.checks||0),0);
    const uptime=total?`${(successes/total*100).toFixed(2)}%` :"No data";
    const grid=text("div","","detail-grid");add(grid,statCell("Observed success",uptime),statCell("Total checks",String(total)),statCell("Last response",mon.last_response_ms==null?"—":`${mon.last_response_ms} ms`),statCell("Last checked",time(mon.last_checked_at)));
    const table=text("div","","history-list");
    const th=text("div","","history-row header");add(th,...["Checked at (MYT)","Result","HTTP","Latency"].map(s=>text("span",s)));table.append(th);
    for(const x of checks.checks||[]){const row=text("div","","history-row");add(row,text("span",time(x.checked_at)),text("span",x.success?"✓ UP":"× FAIL"),text("span",x.http_status??x.error_code??"—"),text("span",`${x.duration_ms} ms`));table.append(row);}
    if(!(checks.checks||[]).length)table.append(text("div","No checks yet.","empty-state"));
    const incidentList=text("div","","event-list");
    for(const x of incidents.incidents||[]){const item=text("div","","event-item");add(item,text("h3",x.resolved_at?"Resolved incident":"Ongoing incident"),text("p",`Started ${time(x.started_at)}${x.resolved_at?` • Recovered ${time(x.resolved_at)}`:""} • ${x.reason}`));incidentList.append(item);}
    if(!(incidents.incidents||[]).length)incidentList.append(text("div","No confirmed incidents.","empty-state"));
    pane.replaceChildren(header,actions,alertsBox,grid,text("h4","Response time","details-heading"),latencyChart(checks.checks),text("h4","Recent checks","details-heading"),table,text("h4","Incident history","details-heading"),incidentList);
    if(scroll){$("monitors").scrollIntoView({behavior:"smooth",block:"start"});updateNav("monitors");}
  }catch(e){pane.replaceChildren(text("div",errorMessage(e),"empty-state"));}
}
// BM: Muat diagnostik scheduler khas pentadbir melalui authorization backend, bukan UI semata-mata.
// EN: Load admin-only scheduler diagnostics through backend authorization, not UI hiding alone.
async function loadSystem(){
  if(!profile?.admin)return;
  const container=$("system-content");
  try{
    const data=await api("/api/admin/system"),last=data.last_run,h=data.health||{};
    const grid=text("div","","detail-grid");
    add(grid,statCell("Monitoring health",h.state||'Unknown'),
      statCell("Database",h.database_ok?'Connected':'Unavailable'),
      statCell("Cron",h.scheduler_ok?'Running':'Not verified'),
      statCell("Last completed Cron",time(last?.finished_at)),
      statCell("Checks completed (last run)",`${last?.succeeded??0}/${last?.claimed??0}`),
      statCell("Active monitors",`${data.monitors?.active||0}/${data.limits.global}`));
    const note=h.state==='HEALTHY'
      ? 'Latest database query and Cron completed successfully. This is not a guarantee that all monitored websites are online.'
      : `Monitoring degraded: ${h.reason||'unknown'}. Worker liveness alone is insufficient. Review Cron, D1 and Worker logs.`;
    container.replaceChildren(grid,text('p',note,'muted small'),
      text('p','Independent watchdog: check /api/health/monitoring periodically from a separate service. It returns HTTP 503 if Cron or database health is degraded.','muted small'));
    if(last?.error)container.append(text('p','Latest scheduler warning: '+last.error,'muted small'));
  }catch(e){container.textContent=errorMessage(e);}
}
// BM: Tandakan hanya tab yang sedang aktif dan kemas kini aria-current untuk accessibility.
// EN: Mark only the active tab and synchronize aria-current for accessibility.
function updateNav(id){document.querySelectorAll(".topnav a").forEach(a=>{const current=a.dataset.view===id;a.classList.toggle("current",current);if(current)a.setAttribute("aria-current","location");else a.removeAttribute("aria-current");});}
function openDialog(id){const dlg=$(id);if(!dlg.open)dlg.showModal();}
// BM: Tutup dialog hanya jika ia benar-benar terbuka.
// EN: Close a dialog only when it is actually open.
function closeDialog(id){const dlg=$(id);if(dlg.open)dlg.close();}
// Authentication UI follows the tested Zrain Links flows, while Monitor
// keeps its own Firebase project, backend and per-user security boundaries.
const authDialog=$("auth-dialog");
// BM: Tukar atribut hidden pada elemen yang sudah wujud.
// EN: Toggle the hidden attribute of an existing element.
const show=(id,yes)=>{$(id).hidden=!yes;};
function message(id,value,ok=false){const el=$(id);el.textContent=value||"";el.classList.toggle("ok",ok);}
// BM: Selaraskan tajuk dan kapsyen dialog untuk mod auth semasa.
// EN: Synchronize authentication dialog heading and caption for the current mode.
function authHeading(title,caption){$("auth-heading").textContent=title;$("auth-caption").textContent=caption;}
function authFormView(){
  show("verification-panel",false);show("reset-password-panel",false);
  show("auth-tabs",true);show("auth-form",true);show("google-auth-section",true);
}
// BM: Paparkan langkah email verification tanpa mendakwa mesej telah dihantar semula.
// EN: Show email-verification guidance without claiming that a new email was sent.
function verificationView(account){
  authHeading("Verify your email","One quick step before you can manage your monitors.");
  $("verify-email").textContent=account.email||"your email";
  show("verification-panel",true);show("reset-password-panel",false);
  show("auth-tabs",false);show("auth-form",false);show("google-auth-section",false);
  message("verification-message","");openDialog("auth-dialog");
}
// BM: Tukar mod sign in/sign up dengan memelihara kawalan Firebase Auth.
// EN: Change sign-in/sign-up view while preserving Firebase authentication controls.
function setMode(mode){
  authMode=mode;authFormView();
  for(const tab of document.querySelectorAll("[data-auth-mode]")){
    const active=tab.dataset.authMode===mode;
    tab.classList.toggle("active",active);tab.setAttribute("aria-pressed",String(active));
  }
  const signingIn=mode==="signin";
  authHeading(signingIn?"Welcome back":"Create your account",
    signingIn?"Sign in to manage your monitors.":"Sign up to manage your Zrain Monitor account.");
  $("auth-submit").textContent=signingIn?"Sign in →":"Create account →";
  $("auth-password").autocomplete=signingIn?"current-password":"new-password";
  $("auth-password").minLength=signingIn?1:12;
  $("password-hint").textContent=signingIn?"":"(at least 12 characters)";
  show("forgot-password-row",signingIn);
  show("signup-name-section",!signingIn);show("password-guidance",!signingIn);
  $("full-name").disabled=signingIn;$("full-name").required=!signingIn;
  show("confirm-password-section",!signingIn);
  $("confirm-password").disabled=signingIn;$("confirm-password").required=!signingIn;
  $("confirm-password").value="";
  for(const [inputId,buttonId] of [["auth-password","toggle-password"],["confirm-password","toggle-confirm-password"]]){
    $(inputId).type="password";$(buttonId).textContent="Show";$(buttonId).setAttribute("aria-pressed","false");
  }
  show("google-redirect",false);message("auth-message","");message("google-message","");
}
// BM: Buka modal auth pada keadaan awal yang sesuai untuk pengguna.
// EN: Open the authentication modal in the appropriate initial view.
function openAuth(){
  if(auth?.currentUser && !auth.currentUser.emailVerified){verificationView(auth.currentUser);return;}
  setMode("signin");openDialog("auth-dialog");$("auth-email").focus({preventScroll:true});
}
// BM: Tukar dialog untuk aliran reset kata laluan.
// EN: Switch the dialog to the password-reset flow.
function resetPasswordView(){
  authHeading("Reset your password","We'll email you a secure password reset link.");
  show("verification-panel",false);show("auth-tabs",false);show("auth-form",false);
  show("google-auth-section",false);show("reset-password-panel",true);
  $("reset-email").value=$("auth-email").value.trim();message("reset-message","");
  $("reset-email").focus({preventScroll:true});
}
// BM: Tukar jenis input kata laluan dan label butang tanpa mengubah nilainya.
// EN: Toggle password input visibility and button labeling without changing its value.
function toggleVisibility(inputId,buttonId){
  const input=$(inputId),button=$(buttonId),showing=input.type==="password";
  input.type=showing?"text":"password";button.textContent=showing?"Hide":"Show";
  button.setAttribute("aria-pressed",String(showing));
  button.setAttribute("aria-label",(showing?"Hide ":"Show ")+(inputId==="confirm-password"?"confirmation password":"password"));
}
// BM: Aktifkan pengalaman owner selepas token Firebase dan status pengesahan dikemas kini.
// EN: Activate owner UI after Firebase token and verification state are refreshed.
async function activateVerifiedUser(){
  info("");setAuthState(true);closeDialog("auth-dialog");await load();
}
// BM: Sediakan Firebase, event handler dan status awal selepas DOM boleh digunakan.
// EN: Initialize Firebase, event handlers and initial state when the DOM is ready.
async function ready(){
  setMode("signin");
  if(!configured){info("Setup needed: configure Firebase and Cloudflare Worker in firebase-config.js before sign-in.",true);$("hero-start").disabled=true;return;}
  try{
    auth=getAuth(initializeApp(FIREBASE_CONFIG));
    await setPersistence(auth,browserLocalPersistence);
    getRedirectResult(auth).catch(err=>{setMode("signin");openDialog("auth-dialog");message("google-message",googleErrorMessage(err));});
  }catch(e){info(errorMessage(e),true);return;}
  onAuthStateChanged(auth,async next=>{
    if(user?.uid!==next?.uid)telegramPendingLink=null;
    user=next;
    if(!next){profile=null;monitors=[];currentId=null;setAuthState(false);return;}
    await next.reload().catch(()=>{});
    // Ignore an obsolete callback after sign-out or switching accounts.
    if(auth.currentUser?.uid!==next.uid)return;
    if(!next.emailVerified){setAuthState(false);verificationView(next);return;}
    await activateVerifiedUser();
  });
}
$("hero-start").addEventListener("click",openAuth);
$("auth-open").addEventListener("click",openAuth);
$("signout").addEventListener("click",async()=>{if(auth)await signOut(auth);});
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closeDialog(b.dataset.close)));
for(const id of ["auth-dialog","create-dialog"]){$(id).addEventListener("click",e=>{if(e.target===$(id))closeDialog(id);});}
document.querySelectorAll("[data-auth-mode]").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.authMode)));
$("toggle-password").addEventListener("click",()=>toggleVisibility("auth-password","toggle-password"));
$("toggle-confirm-password").addEventListener("click",()=>toggleVisibility("confirm-password","toggle-confirm-password"));
$("auth-form").addEventListener("submit",async event=>{
  event.preventDefault();const submit=$("auth-submit");submit.disabled=true;message("auth-message","");
  try{
    if(!auth)throw new Error("Authentication is still loading. Please try again.");
    const email=$("auth-email").value.trim(),password=$("auth-password").value;
    if(authMode==="signup"){
      const fullName=$("full-name").value.trim().replace(/\s+/g," ");
      if(!fullName||fullName.length>80)throw new Error("Enter your full name (up to 80 characters).");
      if(password.length<12)throw new Error("Use at least 12 characters for your password.");
      if(password!==$("confirm-password").value)throw new Error("Passwords do not match. Please check both fields.");
      const credential=await createUserWithEmailAndPassword(auth,email,password);
      await updateProfile(credential.user,{displayName:fullName});
      await sendEmailVerification(credential.user);
      $("auth-password").value="";$("confirm-password").value="";
      verificationView(credential.user);
      message("verification-message","Firebase accepted the verification email request. Check your inbox and spam folder.",true);
    }else{
      const credential=await signInWithEmailAndPassword(auth,email,password);
      $("auth-password").value="";
      if(!credential.user.emailVerified)verificationView(credential.user);
    }
  }catch(err){message("auth-message",errorMessage(err));}finally{submit.disabled=false;}
});
$("reset-password").addEventListener("click",resetPasswordView);
$("back-to-signin").addEventListener("click",()=>setMode("signin"));
$("reset-password-form").addEventListener("submit",async event=>{
  event.preventDefault();const submit=$("reset-submit");submit.disabled=true;submit.textContent="Sending…";message("reset-message","");
  try{
    if(!auth)throw new Error("Firebase is not ready.");
    await sendPasswordResetEmail(auth,$("reset-email").value.trim());
    message("reset-message","If this address belongs to an email/password account, you will receive a reset link. Check your inbox and spam folder.",true);
  }catch(err){
    message("reset-message",err.code==="auth/too-many-requests"?"Too many attempts. Try again later.":err.code==="auth/invalid-email"?"Please enter a valid email address.":"Reset instructions could not be sent right now. Try again later.");
  }finally{submit.disabled=false;submit.textContent="Send reset link";}
});
$("verified-button").addEventListener("click",async()=>{
  const button=$("verified-button");button.disabled=true;
  try{
    const current=auth?.currentUser;
    if(!current){setMode("signin");return;}
    await current.reload();
    if(!current.emailVerified){message("verification-message","Email is still unverified. If you have not received a link, select Send verification email below.");return;}
    await current.getIdToken(true);user=current;await activateVerifiedUser();
  }catch(err){message("verification-message",errorMessage(err));}finally{button.disabled=false;}
});
$("resend-verification").addEventListener("click",async()=>{
  const current=auth?.currentUser;
  if(!current){message("verification-message","Please sign in again before requesting a verification email.");return;}
  const button=$("resend-verification");button.disabled=true;button.textContent="Sending…";
  message("verification-message","");
  try{
    await sendEmailVerification(current);
    message("verification-message","Firebase accepted the verification email request. Check your inbox, spam and All Mail.",true);
  }catch(err){message("verification-message",errorMessage(err));}
  finally{button.disabled=false;button.textContent="Send verification email";}
});
$("switch-account").addEventListener("click",async()=>{
  if(auth)await signOut(auth);setMode("signin");
});
$("google-login").addEventListener("click",async()=>{
  const button=$("google-login");button.disabled=true;$("google-label").textContent="Opening Google…";
  show("google-redirect",false);message("google-message","Opening Google's secure sign-in window…");
  try{
    if(!auth)throw new Error("Authentication is still loading.");
    const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:"select_account"});
    const credential=await signInWithPopup(auth,provider);
    if(!credential.user.emailVerified)verificationView(credential.user);
  }catch(err){
    message("google-message",googleErrorMessage(err));
    if(googleRedirectAvailable(err))show("google-redirect",true);
  }finally{button.disabled=false;$("google-label").textContent="Continue with Google";}
});
$("google-redirect").addEventListener("click",async()=>{
  const button=$("google-redirect");button.disabled=true;
  message("google-message","Redirecting to Google's sign-in page…");
  try{
    if(!auth)throw new Error("Authentication is still loading.");
    const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:"select_account"});
    await signInWithRedirect(auth,provider);
  }catch(err){message("google-message",googleErrorMessage(err));button.disabled=false;}
});
$("connect-google").addEventListener("click",async()=>{
  const button=$("connect-google");button.disabled=true;message("connect-google-message","");
  try{
    if(!auth?.currentUser||!user?.emailVerified)throw new Error("Sign in and verify your email first.");
    const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:"select_account"});
    const credential=await linkWithPopup(auth.currentUser,provider);
    await credential.user.getIdToken(true);user=credential.user;
    setAuthState(true);message("connect-google-message","Google connected to your existing account.",true);info("Google connected to your existing account.");
  }catch(err){message("connect-google-message",["auth/credential-already-in-use","auth/email-already-in-use"].includes(err.code)?"That Google identity is already associated with another account. No monitors were changed.":googleErrorMessage(err));}
  finally{button.disabled=false;}
});
$("add-open").addEventListener("click",()=>openDialog("create-dialog"));
$("create-form").addEventListener("submit",async e=>{
  e.preventDefault();$("create-submit").disabled=true;$("create-message").textContent="";
  try{await api("/api/monitors",{method:"POST",body:JSON.stringify({name:$("create-name").value,url:$("create-url").value,purpose:$("create-purpose").value})});closeDialog("create-dialog");$("create-form").reset();await load();info("Monitor created. The first check is queued.");}
  catch(err){$("create-message").textContent=errorMessage(err);}finally{$("create-submit").disabled=false;}
});
$("refresh-all").addEventListener("click",load);
$("refresh-system").addEventListener("click",loadSystem);
$("mark-read").addEventListener("click",async()=>{try{await api("/api/notifications/read",{method:"POST"});await load();}catch(e){info(errorMessage(e),true);}});
$("delete-data").addEventListener("click",async()=>{
  if(!user||!confirm("Delete your monitors and all history permanently, then delete your Firebase account? This cannot be undone."))return;
  try{await api("/api/account/data",{method:"DELETE"});await deleteUser(user);info("Account and monitor data deleted.");}
  catch(e){info("Monitor data deletion was requested. "+errorMessage(e)+" If needed, contact zrain.dev@gmail.com.",true);}
});
document.querySelectorAll(".topnav a").forEach(a=>a.addEventListener("click",()=>updateNav(a.dataset.view)));
// zrain-monitor-report-v1.0.12: read-only monitoring summary and HTTP glossary.
import {installMonitorReports} from "./monitor-report.js?v=1.0.14.6";
installMonitorReports({api,getMonitors:()=>monitors,formatTime:time});
ready();
