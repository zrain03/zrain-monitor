import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8").replace(/^\uFEFF/,"");
test("the app owns a standalone Worker, D1 and scheduled handler, not Render",()=>{
  const wrangler=read("wrangler.toml"),worker=read("src/worker.js");
  assert.match(wrangler,/crons = \["\* \* \* \* \*"\]/);
  assert.match(wrangler,/database_name = "zrain-monitor"/);
  assert.match(worker,/scheduled\(_controller,env,ctx\)/);
  assert.doesNotMatch(wrangler,/render\.com/i);
});
test("all frontend modules parse and match important user actions",()=>{
  const html=read("public/index.html"),js=read("public/app.js"),css=read("public/style.css");
  for(const id of ["auth-form","create-form","monitor-list","monitor-detail","notification-list","system-content","delete-data","google-login","create-purpose"]){
    assert.match(html,new RegExp(`id="${id}"`));
  }
  assert.match(js,/sendEmailVerification/);
  assert.match(js,/deleteUser\(user\)/);
  assert.match(js,/latencyChart\(checks\.checks\)/);
  assert.match(css,/@media\(max-width:720px\)/);
  assert.ok(existsSync(new URL("../public/zrain-logo.webp",import.meta.url)));
});
test("official UI is pinned and only public configuration is shipped",()=>{
  const packageJson=JSON.parse(read("package.json"));
  assert.match(packageJson.dependencies["@zrain/ui"],/^github:zrain03\/zrain-ui#[a-f0-9]{40}$/);
  const config = read("public/firebase-config.js");
  // The same release checks must work before AND after the setup script
  // replaces public Firebase identifiers with the real Web App settings.
  const field = key => {
    const match = config.match(new RegExp(`\\b${key}:\\s*"([^"]+)"`));
    assert.ok(match, `Missing Firebase field: ${key}`);
    return match[1];
  };
  const apiKey = field("apiKey");
  const projectId = field("projectId");
  const authDomain = field("authDomain");
  const appId = field("appId");
  const apiOrigin = config.match(/export const API_ORIGIN\s*=\s*"([^"]+)"/)?.[1];
  assert.ok(apiOrigin, "API origin must be configured or have a placeholder");
  if (projectId === "REPLACE_WITH_FIREBASE_PROJECT_ID") {
    assert.equal(apiKey, "REPLACE_WITH_FIREBASE_WEB_API_KEY");
    assert.equal(appId, "REPLACE_WITH_FIREBASE_WEB_APP_ID");
    assert.equal(authDomain, "REPLACE_WITH_FIREBASE_PROJECT_ID.firebaseapp.com");
    assert.equal(apiOrigin, "https://zrain-monitor-api.REPLACE_WITH_WORKERS_SUBDOMAIN.workers.dev");
  } else {
    assert.match(projectId, /^[a-z0-9][a-z0-9-]{2,61}$/);
    assert.match(apiKey, /^AIza[A-Za-z0-9_-]{20,}$/);
    assert.match(appId, /^1:\d+:web:[A-Za-z0-9]+$/);
    assert.equal(authDomain, `${projectId}.firebaseapp.com`);
    assert.match(apiOrigin, /^https:\/\/zrain-monitor-api\.[a-z0-9-]+\.workers\.dev$/);
    assert.match(read("wrangler.toml"), new RegExp(`FIREBASE_PROJECT_ID = "${projectId}"`));
    assert.equal(JSON.parse(read("firebase.json")).hosting.site, projectId);
  }
  assert.doesNotMatch(config, /BEGIN PRIVATE KEY|private_key|service_account/i);
  assert.match(read(".gitignore"),/\.dev\.vars/);
  assert.match(read("public/privacy.html"),/zrain\.dev@gmail\.com/);
});
test("no misleading exact-time guarantees in UI and README",()=>{
  assert.match(read("public/index.html"),/Keep-Awake/);
  assert.match(read("README.md"),/no uptime guarantees|cannot guarantee/);
  assert.match(read("src/validation.js"),/15\*60\*1000/);
});
