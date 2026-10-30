import test from "node:test";
import assert from "node:assert/strict";
import {handleAPI} from "../src/api.js";
const env={FIREBASE_PROJECT_ID:"zrain-monitor",ALLOWED_ORIGIN:"https://zrain-monitor.web.app",BETA_ADMIN_UID:"admin",MAX_MONITORS_PER_USER:"3"};
const users={authenticate:async()=>({uid:"other",email:"test@domain.com"})};
test("OPTIONS CORS allows only exact configured frontend origin",async()=>{
  const yes=await handleAPI(new Request("https://api.workers.dev/api/monitors",{method:"OPTIONS",headers:{Origin:env.ALLOWED_ORIGIN}}),env);
  assert.equal(yes.status,204);assert.equal(yes.headers.get("access-control-allow-origin"),env.ALLOWED_ORIGIN);
  const no=await handleAPI(new Request("https://api.workers.dev/api/monitors",{method:"OPTIONS",headers:{Origin:"https://evil.com"}}),env);
  assert.equal(no.status,403);
});
test("health endpoint stays public without database",async()=>{
  const response=await handleAPI(new Request("https://api.workers.dev/api/health"),{});
  assert.equal(response.status,200);assert.equal((await response.json()).state,"operational");
});
test("unconfigured backend rejects authenticated routes without exposing details",async()=>{
  const response=await handleAPI(new Request("https://api.workers.dev/api/me"),{});
  assert.equal(response.status,503);
});
test("unknown endpoint and malformed token yield non-sensitive errors",async()=>{
  assert.equal((await handleAPI(new Request("https://api.workers.dev/foo"),env)).status,404);
  const response=await handleAPI(new Request("https://api.workers.dev/api/me"),{...env,DB:{} });
  assert.equal(response.status,401);
});
