import test from "node:test";
import assert from "node:assert/strict";
import {validateTarget,validateMonitor,displayedStatus} from "../src/validation.js";
import {transition} from "../src/state.js";
const ENV={ALLOWED_HOSTS:"my-example.com"};
test("public HTTPS Render, Firebase, Cloudflare, Vercel URLs are accepted",()=>{
  for(const host of ["api.onrender.com","zrain.web.app","custom.pages.dev","zrain.workers.dev","play.vercel.app","test.netlify.app","my-example.com"]){
    assert.equal(validateTarget(`https://${host}/health?ping=1`,ENV),`https://${host}/health?ping=1`);
  }
});
test("SSRF and unsafe destinations are rejected before network access",()=>{
  const invalid=["http://api.onrender.com","https://localhost", "https://127.0.0.1/",
    "https://10.0.0.1/", "https://192.168.1.1/","https://metadata.google.internal/",
    "https://username:pass@api.onrender.com/", "https://api.onrender.com:8443/", "https://api.onrender.com/path#secret",
    "https://api.onrender.com.evil.org", "https://onrender.com/", "https://evil.example.com/","https://[::1]/",
    "file:///etc/passwd","https://xn--p1ai.com","https://foo..onrender.com/"];
  for(const target of invalid)assert.throws(()=>validateTarget(target,ENV),undefined,target);
});
test("monitor creation validates name, purpose and URL",()=>{
  assert.deepEqual(validateMonitor({name:" Test API ",purpose:"uptime",url:"https://api.onrender.com/health"},ENV),{
    name:"Test API",purpose:"uptime",url:"https://api.onrender.com/health"});
  assert.throws(()=>validateMonitor({name:"x",purpose:"uptime",url:"https://api.onrender.com"},ENV));
  assert.throws(()=>validateMonitor({name:"Test",purpose:"random",url:"https://api.onrender.com"},ENV));
});
test("stale last check is Unknown rather than old UP",()=>{
  const now=Date.parse("2026-10-28T10:30:00Z");
  assert.equal(displayedStatus({state:"ACTIVE",status:"UP",last_checked_at:"2026-10-28T10:00:00Z"},now),"UNKNOWN");
  assert.equal(displayedStatus({state:"ACTIVE",status:"UP",last_checked_at:"2026-10-28T10:29:00Z"},now),"UP");
  assert.equal(displayedStatus({state:"PAUSED",status:"UP",last_checked_at:null},now),"PAUSED");
});
test("state machine requires two failures and two successes for recovery",()=>{
  let state={status:"UNKNOWN",consecutive_failures:0,consecutive_successes:0};
  state=transition(state,true);assert.equal(state.status,"UP");
  state=transition(state,false);assert.equal(state.status,"VERIFYING");assert.equal(state.event,null);
  state=transition(state,false);assert.equal(state.status,"DOWN");assert.equal(state.event,"DOWN");
  state=transition(state,false);assert.equal(state.event,null);
  state=transition(state,true);assert.equal(state.status,"DOWN");assert.equal(state.event,null);
  state=transition(state,true);assert.equal(state.status,"UP");assert.equal(state.event,"RECOVERED");
});
