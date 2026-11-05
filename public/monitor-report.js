/*
 * Pembangun / Developer: Zrain
 * Dicipta / Created (rekod Git terawal / first Git evidence): 2026-10-30
 * Dikemas kini / Last updated: 2026-11-04
 * Fail / File: public/monitor-report.js
 * BM: Perilaku antaramuka atau konfigurasi frontend Monitor.
 * EN: Monitor frontend behavior or configuration.
 */
/* Zrain Monitor report & HTTP glossary v1.0.12.
 * Read-only frontend: uses the existing authenticated API. No extra polling. */
const HTTP_GROUPS = [
  ["1xx \u00B7 Information", "The server received the request and is continuing to process it.", [
    [100,"Continue","The server is ready for the rest of the request."],
    [101,"Switching Protocols","The connection is changing to another protocol."],
    [102,"Processing","A legacy WebDAV response for unfinished processing (now deprecated)."],
    [103,"Early Hints","The server provides early information before its final response."]]],
  ["2xx \u00B7 Successful", "The request was received and processed successfully.", [
    [200,"OK","The server successfully answered the request."],
    [201,"Created","The requested resource was created."],
    [202,"Accepted","The request was accepted but may still be processing."],
    [203,"Non-Authoritative Information","The returned information was modified by an intermediary."],
    [204,"No Content","The request succeeded, with no response body."],
    [205,"Reset Content","The client should reset its current view."],
    [206,"Partial Content","Only the requested portion of a resource was returned."],
    [207,"Multi-Status","The response contains statuses for multiple operations."],
    [208,"Already Reported","A WebDAV resource was already listed in this response."],
    [226,"IM Used","The server returned a result using instance manipulation."]]],
  ["3xx \u00B7 Redirection", "The requested resource may be somewhere else, or cached content is still valid.", [
    [300,"Multiple Choices","Several possible representations are available."],
    [301,"Moved Permanently","The resource has a new permanent address."],
    [302,"Found","The resource is temporarily available at another address."],
    [303,"See Other","Use the address provided in the response to retrieve the result."],
    [304,"Not Modified","The cached version has not changed."],
    [307,"Temporary Redirect","Repeat the request at a temporary address without changing its method."],
    [308,"Permanent Redirect","Repeat the request at a new permanent address without changing its method."]]],
  ["4xx \u00B7 Request issue", "The server could not fulfill this request; the reason may involve the address, permissions, or request limits.", [
    [400,"Bad Request","The server could not understand the request."],
    [401,"Unauthorized","Authentication is required or invalid."],
    [402,"Payment Required","A reserved status sometimes used by services for payment restrictions."],
    [403,"Forbidden","The server refuses access."],
    [404,"Not Found","The address or resource was not found."],
    [405,"Method Not Allowed","The HTTP method is not supported at this address."],
    [406,"Not Acceptable","The requested response format is unavailable."],
    [407,"Proxy Authentication Required","The proxy needs authentication."],
    [408,"Request Timeout","The server timed out waiting for the request."],
    [409,"Conflict","The request conflicts with the resource's current state."],
    [410,"Gone","The resource is no longer available."],
    [411,"Length Required","The request must include its content length."],
    [412,"Precondition Failed","A required condition was not met."],
    [413,"Content Too Large","The submitted content exceeds the allowed size."],
    [414,"URI Too Long","The requested address is too long."],
    [415,"Unsupported Media Type","The content type is unsupported."],
    [416,"Range Not Satisfiable","The requested portion of the resource cannot be served."],
    [417,"Expectation Failed","The server cannot meet a request expectation."],
    [418,"I'm a Teapot","A playful standardized HTTP status, not a normal health check result."],
    [421,"Misdirected Request","The request was sent to a server unable to answer for this host."],
    [422,"Unprocessable Content","The format is valid, but the request cannot be processed."],
    [423,"Locked","The resource is locked."],
    [424,"Failed Dependency","Another required operation failed."],
    [425,"Too Early","The server will not risk processing this request yet."],
    [426,"Upgrade Required","The client must switch to a supported protocol."],
    [428,"Precondition Required","The server requires a conditional request."],
    [429,"Too Many Requests","The service is limiting the number of requests."],
    [431,"Request Header Fields Too Large","The request headers are too large."],
    [451,"Unavailable For Legal Reasons","Access is unavailable for legal reasons."]]],
  ["5xx \u00B7 Server issue", "The server or a service it depends on could not complete the request.", [
    [500,"Internal Server Error","The server encountered an unexpected problem."],
    [501,"Not Implemented","The server does not support the required functionality."],
    [502,"Bad Gateway","A gateway received an invalid response from another server."],
    [503,"Service Unavailable","The service is temporarily unavailable or overloaded."],
    [504,"Gateway Timeout","A gateway waited too long for another server."],
    [505,"HTTP Version Not Supported","The requested HTTP protocol version is unsupported."],
    [506,"Variant Also Negotiates","The server encountered a content negotiation configuration problem."],
    [507,"Insufficient Storage","The server lacks storage required for the request."],
    [508,"Loop Detected","The server detected an infinite loop while processing."],
    [510,"Not Extended","Additional request extensions are needed."],
    [511,"Network Authentication Required","The network requires authentication before access."]]]
];
const knownStatuses = new Map(HTTP_GROUPS.flatMap(group => group[2].map(row => [row[0],row])));
// BM: Bina nod laporan sebagai teks DOM untuk mengelakkan injection.
// EN: Build report nodes as DOM text to prevent injection.
const el = (tag,className,textValue) => {const x=document.createElement(tag);if(className)x.className=className;if(textValue!==undefined)x.textContent=String(textValue);return x;};
const safe = v => String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]);
// BM: Tolak timestamp yang tidak sah daripada paparan laporan.
// EN: Reject invalid timestamps in report rendering.
const validDate = v => {const d=new Date(v);return Number.isFinite(d.getTime())?d:null;};
const description = code => {const n=Number(code);return knownStatuses.get(n)?.[2] || (n>=100 && n<600 ? "An HTTP response outside the common codes listed in the glossary." : "No HTTP response recorded. The check may have encountered a network or timeout error.");};
// BM: Tukar jenis monitor kepada label laporan yang mudah difahami.
// EN: Map monitor purpose to a reader-friendly report label.
const purposeName = p => p==="keepawake"?"Keep-Awake monitoring":"Uptime monitoring";
const formatMs = x => x!=null && Number.isFinite(Number(x))?`${Math.round(Number(x))} ms`:"Not recorded";

// BM: Pasang bahagian laporan pada dashboard sedia ada dan gunakan API auth yang disuntik.
// EN: Mount report controls on the existing dashboard using the injected authenticated API.
export function installMonitorReports({api,getMonitors,formatTime}) {
  const monitoringSection=document.getElementById("monitors");
  const detail=document.getElementById("monitor-detail");
  if(!monitoringSection||!detail) return;

  function glossary(){
    const area=el("details","zm-http-guide");
    const head=el("summary",null,"HTTP status guide \u00B7 What does each code mean?");
    const intro=el("p","zm-explainer","HTTP stands for Hypertext Transfer Protocol. The code describes how a website or API responded to a check. A 2xx result usually means success; 4xx and 5xx indicate issues. A network timeout may have no HTTP code at all.");
    area.append(head,intro);
    for(const [name,meaning,entries] of HTTP_GROUPS){
      const group=el("details","zm-code-group");group.append(el("summary",null,name),el("p","zm-muted",meaning));
      const table=el("div","zm-code-list");
      for(const [code,title,detail] of entries){const row=el("div","zm-code-row");row.append(el("strong",null,code),el("b",null,title),el("span",null,detail));table.append(row);}
      group.append(table);area.append(group);
    }
    area.append(el("p","zm-footnote","A successful HTTP response does not prove that sign-in, databases, or every feature of the application works. Monitoring checks only the configured URL."));
    return area;
  }
  const observer=new MutationObserver(()=>{
    if(detail.querySelector(".history-list") && !detail.querySelector(".zm-http-guide")) detail.append(glossary());
  });
  observer.observe(detail,{childList:true});
  if(detail.querySelector(".history-list")) detail.append(glossary());

  const section=el("section","zm-report-card");section.id="reports";
  const heading=el("div","zm-report-heading");
  const title=el("div");title.append(el("p","zm-kicker","MONITORING REPORT"),el("h3",null,"A report everyone can understand"),el("p","zm-muted","A clear snapshot of your recorded checks. Generate a report, download a standalone HTML copy, or print to PDF."));
  heading.append(title);
  const controls=el("div","zm-report-controls");
  const label=el("label",null,"Service");label.htmlFor="zm-report-monitor";
  const select=el("select");select.id="zm-report-monitor";select.setAttribute("aria-label","Choose a service for the monitoring report");
  const rangeLabel=el("label",null,"Time window");rangeLabel.htmlFor="zm-report-range";
  const range=el("select");range.id="zm-report-range";
  for(const [value,name] of [["24","Last 24 hours"],["48","Last 48 hours"],["168","Last 7 days"]]) {const option=el("option",null,name);option.value=value;if(value==="48")option.selected=true;range.append(option);}
  const build=el("button","button button-primary zm-report-button","Generate report");build.type="button";
  const print=el("button","button button-primary zm-report-button","Print / Save as PDF");print.type="button";print.disabled=true;print.title="For a clean PDF, turn off Headers and footers in your browser print settings.";
  const download=el("button","button button-primary zm-report-button","Download HTML");download.type="button";download.disabled=true;
  const serviceField=el("div","zm-report-field");serviceField.append(label,select);
  const rangeField=el("div","zm-report-field");rangeField.append(rangeLabel,range);
  const actions=el("div","zm-report-actions");actions.append(build,print,download);
  controls.append(serviceField,rangeField,actions);
  const message=el("p","zm-report-feedback zm-muted");message.setAttribute("role","status");
  const output=el("div","zm-report-output");output.id="zm-report-output";
  section.append(heading,controls,message,output);
  monitoringSection.append(section);

  function updateOptions(){
    const current=select.value;
    select.replaceChildren();
    for(const mon of getMonitors()) {const option=el("option",null,mon.name);option.value=String(mon.id);select.append(option);}
    if([...select.options].some(o=>o.value===current))select.value=current;
    build.disabled=!select.options.length;
    if(!select.options.length) {
      message.textContent="Sign in and add a monitor to create a report.";
    } else if(message.textContent==="Sign in and add a monitor to create a report.") {
      message.textContent="Choose a service and time window, then generate your report.";
    }
  }
  select.addEventListener("focus",updateOptions);
  build.addEventListener("focus",updateOptions);
  const monitorList=document.getElementById("monitor-list");
  if(monitorList) new MutationObserver(updateOptions).observe(monitorList,{childList:true});
  // Fetch every stored check in the selected window using bounded pages.
  async function fetchWindowChecks(monitorId,cutoff){
    const limit=250,maxPages=40;
    const all=[];
    let before=null;
    for(let page=0;page<maxPages;page++){
      const url=`/api/monitors/${encodeURIComponent(monitorId)}/checks?limit=${limit}${before?`&before=${encodeURIComponent(before)}`:""}`;
      const data=await api(url);
      if(!Array.isArray(data?.checks)||typeof data.has_more!=="boolean"){
        throw Error("The monitoring history API needs updating before a complete report can be created.");
      }
      const chunk=data.checks;
      if(chunk.length>limit)throw Error("Monitoring history returned an oversized page.");
      for(const row of chunk){
        const date=validDate(row.checked_at);
        if(date&&date.getTime()>=cutoff&&date.getTime()<=Date.now()+60000)all.push(row);
      }
      const last=chunk[chunk.length-1]?.checked_at;
      const oldest=validDate(last);
      if(!data.has_more || (oldest&&oldest.getTime()<cutoff))return all;
      if(!oldest||last===before||chunk.length===0){
        throw Error("History pagination did not advance; report not generated to avoid misleading totals.");
      }
      before=last;
    }
    throw Error("The requested history exceeded the safe pagination limit. No partial report was generated.");
  }
  const reportState={html:"",text:""};
  build.addEventListener("click",async()=>{
    updateOptions();const mon=getMonitors().find(x=>String(x.id)===select.value);
    if(!mon) {message.textContent="Select a monitor first.";return;}
    build.disabled=true;print.disabled=true;download.disabled=true;
    message.textContent="Reading your recorded checks and incident history\u2026";
    try{
      const hours=Number(range.value);const cutoff=Date.now()-hours*3600*1000;
      const [allChecks,incidentsData,summaryData] = await Promise.all([
        fetchWindowChecks(mon.id,cutoff),
        api(`/api/monitors/${encodeURIComponent(mon.id)}/incidents`),
        api(`/api/monitors/${encodeURIComponent(mon.id)}/summary`)
      ]);
      const checks=allChecks.filter(x=>{const d=validDate(x.checked_at);return d&&d.getTime()>=cutoff&&d.getTime()<=Date.now()+60000;})
        .sort((a,b)=>validDate(a.checked_at)-validDate(b.checked_at));
      const allIncidents=Array.isArray(incidentsData.incidents)?incidentsData.incidents:[];
      const incidents=allIncidents.filter(x=>{const start=validDate(x.started_at);const end=validDate(x.resolved_at);return start && start.getTime()<=Date.now() && (!end || end.getTime()>=cutoff);});
      const total=checks.length;const good=checks.filter(x=>Boolean(x.success)).length;
      const bad=total-good;
      const successfulRate=total?`${(good/total*100).toFixed(1)}%`:"No data";
      const latencies=checks.map(x=>Number(x.duration_ms)).filter(x=>Number.isFinite(x)&&x>=0);
      const average=latencies.length?`${Math.round(latencies.reduce((a,b)=>a+b,0)/latencies.length)} ms`:"No data";
      const first=checks[0]?.checked_at;const last=checks[checks.length-1]?.checked_at;
      const sampleStart=first?formatTime(first):"No checks in the selected window";
      const sampleEnd=last?formatTime(last):"\u2014";
      const gaps=[];for(let i=1;i<checks.length;i++)gaps.push((validDate(checks[i].checked_at)-validDate(checks[i-1].checked_at))/60000);
      const maxGap=gaps.length?`${Math.max(...gaps).toFixed(1)} minutes`:"Not enough checks";
      const actualSpan=first&&last?`${((validDate(last)-validDate(first))/3600000).toFixed(1)} hours between first and last recorded checks`:"No recorded checks";
      const summaryDays=Array.isArray(summaryData.days)?summaryData.days:[];
      const warning=total===0?"No checks were returned within this time window. This does not mean the service was down.":
        `This report includes all ${total} stored checks found within the selected window. The monitor may have started later, and missed scheduled checks cannot be reconstructed. ${actualSpan}. This is not proof of uninterrupted uptime.`;
      const outcome=total===0?"Not enough information":bad>0?"Some checks failed": "All included checks succeeded";
      const rows=checks.slice(-32).reverse().map(x=>{
        const code=x.http_status==null?"\u2014":String(x.http_status);
        return `<tr><td>${safe(formatTime(x.checked_at))}</td><td style="white-space:nowrap">${x.success?"Successful":"Failed"}</td><td>${safe(code)}</td><td>${safe(description(code))}</td><td>${safe(formatMs(x.duration_ms))}</td></tr>`;
      }).join("");
      const incidentRows=incidents.slice(0,10).map(x=>`<li><strong>${x.resolved_at?"Recovered":"Ongoing"}</strong> \u2014 started ${safe(formatTime(x.started_at))}${x.resolved_at?`, ended ${safe(formatTime(x.resolved_at))}`:""}. ${safe(x.reason||"No reason recorded.")}</li>`).join("");
      const created=formatTime(new Date().toISOString());
      const html=`<article class="zm-report-sheet" aria-label="Generated monitoring report">
        <div class="zm-report-brand"><img class="zm-report-logo" src="/zrain-logo.webp" alt="Zrain logo" width="41" height="41" style="display:block;width:41px;height:41px;object-fit:contain;border-radius:11px"><span><b>Zrain Monitor</b><small>Independent monitoring report</small></span></div>
        <p class="zm-kicker">MONITORING SUMMARY \u00B7 ${safe(hours===168?"7 DAYS":`${hours} HOURS`)}</p>
        <h2>${safe(mon.name)}</h2><p class="zm-report-lead">${safe(outcome)}. This report translates recorded website/API checks into plain language for a general audience.</p>
        <div class="zm-report-tiles"><div><small>Checks included</small><strong>${total}</strong></div><div><small>Successful checks</small><strong>${good} / ${total}</strong></div><div><small>Observed check success</small><strong>${successfulRate}</strong></div><div><small>Average response</small><strong>${average}</strong></div></div>
        <h3>What was monitored?</h3><dl class="zm-facts"><div><dt>Service address</dt><dd>${safe(mon.url)}</dd></div><div><dt>Purpose</dt><dd>${safe(purposeName(mon.purpose))}</dd></div><div><dt>Current observed status</dt><dd>${safe(mon.display_status||"UNKNOWN")} (as last reported)</dd></div><div><dt>Report created</dt><dd>${safe(created)}</dd></div><div><dt>Requested window</dt><dd>Last ${hours} hours</dd></div><div><dt>Earliest included check</dt><dd>${safe(sampleStart)}</dd></div><div><dt>Latest included check</dt><dd>${safe(sampleEnd)}</dd></div><div><dt>Longest gap in included checks</dt><dd>${safe(maxGap)}</dd></div><div><dt>Actual recorded history span</dt><dd>${safe(actualSpan)}</dd></div></dl>
        <h3>What do these results mean?</h3><p>${bad>0?`${bad} of the included checks failed, which may signal a temporary outage, an HTTP error, or a network problem.`:total?"Every check included in this report received a successful response.":"There are no recent check results available to evaluate."} A successful check means that this particular URL responded when tested. It does not prove that the entire app, sign-in, or databases were working.</p>
        <p class="zm-report-notice"><strong>Important limitation:</strong> ${safe(warning)} Monitoring does not measure every second between checks. A 100% check success rate is not guaranteed 100% uptime. Times are shown in MYT (Malaysia Time, UTC+08:00).</p>
        <h3>Confirmed incident history</h3><p>${incidents.length?`${incidents.length} incidents overlap the selected time window.`:"No confirmed incidents were returned for the selected time window."}</p>${incidentRows?`<ul>${incidentRows}</ul>`:""}
        <h3>Recent recorded checks</h3><p class="zm-muted">Showing up to 32 checks within the selected window, newest first. HTTP: 200 means the server responded successfully; 404 means the requested address was not found; 500 means a server error; 503 means temporarily unavailable.</p>
        <div class="zm-report-table-scroll"><table><thead><tr><th>Checked at (MYT)</th><th>Result</th><th>HTTP</th><th>Meaning</th><th>Response time</th></tr></thead><tbody>${rows||'<tr><td colspan="5">No recorded checks in this window.</td></tr>'}</tbody></table></div>
        <p class="zm-report-footer">Generated by Zrain Monitor \u00B7 Developed by Zrain \u00B7 This report contains observed monitoring results, not a guarantee of uninterrupted service.</p>
      </article>`;
      output.innerHTML=html;
      reportState.html=html;reportState.text=mon.name;
      message.textContent=`Report generated with ${total} checks in the selected time window. Full stored window loaded. The table shows only the latest 32 checks; timestamps and gaps indicate actual recorded coverage.`;
      print.disabled=false;download.disabled=false;
      output.scrollIntoView({behavior:"smooth",block:"nearest"});
    }catch(error){message.textContent=`Could not build the report: ${error.message||"Unable to read monitoring data."}`;}
    finally{build.disabled=false;}
  });
  print.addEventListener("click",()=>{
    if(!reportState.html)return;
    document.body.classList.add("zm-print-report");
    const cleanup=()=>document.body.classList.remove("zm-print-report");
    window.addEventListener("afterprint",cleanup,{once:true});
    window.print();
  });
  download.addEventListener("click",()=>{
    if(!reportState.html)return;
    const standalone=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Monitoring Report | Zrain</title><style>${document.querySelector('link[href*="monitor-report"]')?"body{font:14px/1.6 Inter,Segoe UI,Arial,sans-serif;background:#fffaf6;color:#172231;margin:0;padding:30px}article{max-width:960px;margin:auto;background:white;padding:38px;border:1px solid #eddfd7;border-radius:18px}h2{font-size:34px}h3{margin-top:28px;color:#a8452e}.zm-report-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.zm-report-tiles>div{padding:16px;border-radius:12px;background:#fff4ed}.zm-report-tiles small,.zm-report-tiles strong{display:block}.zm-report-tiles strong{font-size:21px}.zm-facts>div{display:flex;gap:16px;border-bottom:1px solid #eee;padding:8px}.zm-facts dt{width:40%;color:#667286}.zm-facts dd{margin:0;overflow-wrap:anywhere}.zm-report-notice{background:#fff4e9;padding:16px;border-radius:12px}.zm-report-table-scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:12px}th,td{padding:10px;border-bottom:1px solid #eaded5;text-align:left;vertical-align:top}th:nth-child(2),td:nth-child(2){min-width:76px;white-space:nowrap;word-break:normal;overflow-wrap:normal}.zm-report-logo{display:block;width:41px;height:41px;object-fit:contain;border-radius:11px}.zm-report-brand{display:flex;gap:12px;align-items:center}.zm-report-brand small{display:block;color:#667286}.zm-kicker{color:#bd5338;font-size:11px;font-weight:800;letter-spacing:1px}.zm-report-footer{margin-top:32px;color:#667286;font-size:11px}.zm-report-lead{font-size:16px;color:#526071}@media(max-width:700px){body{padding:10px}article{padding:18px}.zm-report-tiles{grid-template-columns:repeat(2,1fr)}.zm-facts>div{display:block}.zm-facts dt{width:auto}}@page{size:A4;margin:12mm 13mm}@media print{body{background:white;padding:0}article{border:0;padding:0}h2{font-size:28px}h3{margin-top:18px}.zm-facts>div{padding:4px 0}.zm-report-notice{padding:10px}table{font-size:10px;line-height:1.2}th,td{padding:5px 5px}tr{break-inside:avoid}.zm-report-tiles>div{padding:12px}}":""}</style></head><body>${reportState.html.replace('src="/zrain-logo.webp"', 'src="data:image/webp;base64,UklGRjoKAABXRUJQVlA4WAoAAAAQAAAAPwAAPwAAQUxQSF8EAAABR+UgkiRFuqzj8+8YHwxERA7+l1vCGMYmtLCwsoyFnDnHkcM0jfmktnE059Jc7gmFbds2kJLu/v9w0x8i+j8BlL2veJgqcI7qL7Auhm7NDnAX/Fjb3kiSbVvvC5h78syqyXkHpjq1qc9eTm12orTJ+Zwi55zzmOnh7gZ8AszMLWJ2ICImgN0lAgEBYgAMj1T2DY/RhQf1QUQQBDM4BCMhkTyIZao1Mb3WylwwvZbe51K1lzKT2WN1Lz1O7fDizQvnTNOT3trknON07vEw5VrrtdTTqZz7U/oeTk/bu5/51IdfVRGNvdILJV1CgUBn/vSn3tzdTXNukcOBz332EzzCF28+/v7rr5z7DZjjJz7BfLlq3CsCIU588wun4iYtec41Uy0QXInbNjYO3/v8hBvk0O7pFSCyGHnAzE++6pEtU96lBEAeZ8LzK7rSn/7z+aElPGTcRjtM/6phUdr5+mri9uAQh5t7edOvyQLdv/xtalsCDrIeb4nt8Jc/sCCt/O0/tW/ZNd4Arf7rd/YBnJ69wLXssz1I4PjuH1gOR8na1uA+svjyJYuB3o64JpAh8oBCVcJowv5xQ9wCzL2wHIpryeCGh0wtShbmTpZw2DHu0M89LLfGumwNuBTZUYUMJll7vHI4shr6WvaJe8B8mlfozRX32bs3l0Ia/48eVoT5uiG3xP3oZoFEN3gLuFu1kQU7W7YHZD1C3NJLMEO04i43DltDDctBQnZx263y9EkXA9DZMzx8WgggFndwyEqyx/21sqyKa8nCoivsEK5zWaH2xkZdCltlNWtgZzmkuOXWZFiNkIVAT8ggvU57OIRtowkg5MrGdJKbMshisgFZLvasUYDcQsYFZbNAoExhNT2IN6GA7D6n6JLtSmTMBgEFyJZsEZOVY4UMYcwA4WEry0I9BBxwMAkowSFkS0gQWosCwek8AxkyIAKJAIG4FogEuMwaxhQaCQEFEgiJQhKVjQECgUnWo4AmBMKiQpDFxCEGAQELuFD6fAUJhCBEQhIIJAGBYEhACJerLCfXKyQsC6hhVYEwKoCM84mszJe3bI7IcpCwVQEy/PXcWWnz3ygrKhiiLBt0QRki1P6vy2WFy/VX/6gZZFWTJVEiCrKY9PL3nzknQ2jtlz+3i2ZFAiCyHNigxh/+aW5hMdyfv/HPYwPUQXBAQkjYnszHv3z/emFjO//4i5ephWRh1QAxjIIqQDv+74u/OPesJefLl9+7P/aWsK4gYVVW03O8e+/rd+ew2edvPv6Bl7WSNQS2rJdifvCjj7xu3Dq9fPP08gQmgSBhFCORYCC5f/vH3zz7yIfEG/Tw7JnnP//hUOfXnrDUudXrgXYI7cShps+2pE719QdeWbhVLGmn/5zM8dgqh0ls89RCSrvP8+nS6Z7uPL4umWRH6f3+7m11sh/NZLURYC6kH/ucbr80+mEqsq+ktQKq0WhJICYBSAsUVfYWkCAggAzgAmE07C8EwCBhlCCRsDMAVlA4ILQFAACwGACdASpAAEAAPkkejEUioaEVCZ4sKASEoAtkebdbHP7fDch7wB6AH6u9Zl5R2aAdf/99/F3z38pepLKdvlOJfeI/yz/DZLp9H/x/GhpL/lXqAfzr/Geox9B+ff57/4f+C/cz+tfYP/IP5//qP7N+9XGTfqmzoxNKuVEc8VaSnbPgLpfq5yOdS2mZEYGiZG5453EUc4XSYSOX1aJSpuktzSvhAiJZIH/rlqZJJ1rBbV3+D7trZ8oizUCqPTLdvOBVonV6gKtqNLPM6yzcAAD+//DFd/5175QBoxt8AnNRgBz8Hwjs2n71kWHvSCeXKQi5GSXS1y0+3n7Rp9z006NXX2LC83npCkVPSIcet5Lesq0ELkHupCkiKxkm2RP4RmnooYCvhwzSzqWkKEPDX9S05tTu7ZLn070edHBY2Z8b1mZzPZA1tbB3+C94GHzYOtCgRZ3SZO06ja8rkA79mWmtztyhDs5QzScHBTjunBySmlgL/C5+Ry6SUABJn+NgYP4FlqVFK047lDxwAq3gVHR6AK/Sm1eRHbxffSgTS451AVCLV9qSIiIHgvZ5XXw0dlp4L3//wAGhrPIZwIMnrWXadlZNbMrVWWEET9cOVNqXuI+jx87kfXcgJ3nWbPuxB2bTWIeVT9XxuUYXpu7F/3uH0AebQWOB7p0/tESvDDeecXMz72/I/X++yTaujMCerBQcx8yX//zQMczdeBd+IT7oQf7Pm7LpsST9D3ysA1ZMha4PeORn5/JP82+LhS6pSdikBILnTCyd+u5JHxUWWIHz5rMbM4fhFLv5OzL72i/RMXbqXzVKTK3B4O85604p/kmr2Dfial0bicTHiZexfJewocX5987kpsDRQMo0fMybrfAFo0pH2+n7BqeM/Ii/faD6HWIY5yHwWm4o/PBXhuUQz5OWGv51JuBjuyRyHiWSKYbIMRn1qt/qks1OZC+xNDEEvkbzUA8e1eZFUGBRbBx9BoZ5EBqyk0VPK4nLFggTfaYg1xYadAyy919+i6fzYz0CN1EeeIuNXjX9mZ7PrTSKAv/4+BKRE81pWiwrnF7uzjRtBMpZ/7rkf+Gn8W6nTVs4wNPEfXsQF/iKn7pjxzwJD9vrzdY2B0hf2dxe/+mcVYNv7X/W9Arv4VawwUK3g6MKoLHy1mQaNt8Fb7+H4fQe1M7wa7Wk6McP41rYU3n/znv1ORd1n89UeQdzyNXYReVA+YHmboEadf5x9E5MgSH8H8xDogPZz/gwGzPJ8OqaHwvwN4F5Dn8cpm2akbZqrkV107wHHf+YOEHNB9TnbmABfaYopKAga18dG/qaviPOzKVkEFELSbkzZJWDvASmL9pxYf4qM5TEsywkfWIalwP4RE8dVMPwIYLyN9pokbMOAoTMGtbWkquuEhpbENXnVoSURLNAwTnIzSgyTfyzvL1wKKYs6nFdOuI8bftXkcYJsAhN0SETnrDISPf/x5L6R//E4TPL+c7QvMF2zMB7NAL5z6ie5zQYQTH5qtQ4U29hlQjGbZe+0D1RlOwCt/QuEthMvurdICw4l/uRkmRCgR/9B2kSiZvmQZ606yOlIZrfH7FKVRh/Q71M0IufIG35WbBTPWvjTyuxHQ7dvZXR1qZa17ab6pbsjANVv7xoWQ3D74r2BGzRzw7O+IY9mXoMN4/tXpZrnCysBF9X4ZjPG/9HwUEMTEtL5xLHwkws7/1/qzG+5yK7bwLF23U3emhGRL7yz7OGWXaRnSfPuomjXR3/Fdw3221uGL3oum5yjET2gq7G204j403nTvOT3Vy/39climljTirfwid5bqEcQsq0wvnWkpE/AqR+GX+v7AoerWG4+4ZAwUkeAwtFNz/wkfrOeb4blan8Fjzn2I2om2vaeJ6VP3DG6AvOm729dKRXjb2cfofFWjVoEnbSP2M1qBWZ3T6fqE3Us07rIxSFeX2IbAugAA=="')}</body></html>`;
    const blob=new Blob([standalone],{type:"text/html;charset=utf-8"});const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="Zrain-Monitor-Report.html";a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  updateOptions();
}