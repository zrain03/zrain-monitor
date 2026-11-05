/*
 * Pembangun / Developer: Zrain
 * Dicipta / Created (rekod Git terawal / first Git evidence): 2026-10-30
 * Dikemas kini / Last updated: 2026-11-04
 * Fail / File: test/auth.test.js
 * BM: Ujian automatik untuk mengekalkan kontrak dan mencegah regresi.
 * EN: Automated checks to preserve contracts and prevent regressions.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {verifyClaims,authenticate} from "../src/auth.js";
const time=Math.floor(Date.now()/1000);
const header={alg:"RS256",kid:"valid-key"};
const payload={iss:"https://securetoken.google.com/zrain-monitor",aud:"zrain-monitor",sub:"123",exp:time+3600,iat:time-20,auth_time:time-40,email_verified:true,email:"example@domain.com"};
test("Firebase tokens validate all issuer, audience, timestamps and verified email claims",()=>{
  assert.equal(verifyClaims(header,payload,"zrain-monitor").uid,"123");
  for(const bad of [
    {iss:"https://securetoken.google.com/other"},{aud:"other"},{sub:""},{exp:time-10},{iat:time+100},
    {auth_time:time+100},{email_verified:false}
  ])assert.throws(()=>verifyClaims(header,{...payload,...bad},"zrain-monitor"));
  assert.throws(()=>verifyClaims({alg:"none",kid:"valid-key"},payload,"zrain-monitor"));
});
test("missing bearer token is rejected",async()=>{
  await assert.rejects(authenticate(new Request("https://api.example.com/api/me"),{FIREBASE_PROJECT_ID:"zrain-monitor"}));
});

test("Firebase RS256 cryptographic signature verifies, tampered payload fails",async()=>{
  const keyPair=await crypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
  const jwk=await crypto.subtle.exportKey("jwk",keyPair.publicKey);
  const fetcher=async()=>new Response(JSON.stringify({keys:[{...jwk,kid:"test-signing-key",alg:"RS256",use:"sig"}]}),{
    status:200,headers:{"cache-control":"public,max-age=3600"}});
  const b64=value=>Buffer.from(JSON.stringify(value)).toString("base64url");
  const head=b64({alg:"RS256",kid:"test-signing-key",typ:"JWT"});
  const body=b64(payload);
  const signed=new TextEncoder().encode(head+"."+body);
  const sig=Buffer.from(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",keyPair.privateKey,signed)).toString("base64url");
  const token=head+"."+body+"."+sig;
  const req=new Request("https://api.example.com/api/me",{headers:{Authorization:"Bearer "+token}});
  const user=await authenticate(req,{FIREBASE_PROJECT_ID:"zrain-monitor"},fetcher);
  assert.equal(user.uid,"123");
  const forgedPayload=b64({...payload,sub:"attacker"});
  await assert.rejects(authenticate(new Request("https://api.example.com/api/me",{headers:{Authorization:`Bearer ${head}.${forgedPayload}.${sig}`}}),{FIREBASE_PROJECT_ID:"zrain-monitor"},fetcher));
});
