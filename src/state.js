/*
 * Pembangun / Developer: Zrain
 * Dicipta / Created (rekod Git terawal / first Git evidence): 2026-10-30
 * Dikemas kini / Last updated: 2026-11-04
 * Fail / File: src/state.js
 * BM: Modul backend Worker untuk API, monitoring atau keselamatan.
 * EN: Worker backend module for APIs, monitoring or security.
 */
// Pure state machine: only real checks change status, not missed Cron runs.
// BM: Tukar keadaan selepas dua kegagalan atau dua kejayaan berturut-turut supaya tidak memberi amaran palsu.
// EN: Transition after two consecutive failures or successes to reduce false alarms.
export function transition(previous,success){
  const failures=success?0:(previous.consecutive_failures||0)+1;
  const successes=success?(previous.consecutive_successes||0)+1:0;
  let status=previous.status||"UNKNOWN",event=null;
  if(success){
    if(status==="DOWN" && successes>=2){status="UP";event="RECOVERED";}
    else if(status!=="DOWN")status="UP";
  } else if(failures>=2){
    if(status!=="DOWN")event="DOWN";
    status="DOWN";
  } else if(status!=="DOWN")status="VERIFYING";
  return {status,consecutive_failures:failures,consecutive_successes:successes,event};
}
