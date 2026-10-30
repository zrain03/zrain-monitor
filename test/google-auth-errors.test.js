import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {googleErrorMessage,googleRedirectAvailable} from '../public/google-auth-errors.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Google errors show the actual safe Firebase code instead of a generic message',()=>{
  for(const code of ['auth/internal-error','auth/invalid-credential','auth/account-exists-with-different-credential','auth/unauthorized-domain','auth/network-request-failed']){
    assert.match(googleErrorMessage({code}),new RegExp(code));
  }
  assert.match(googleErrorMessage({code:'auth/account-exists-with-different-credential'}),/Connect Google/);
  assert.match(googleErrorMessage({code:'auth/unauthorized-domain'}),/Authorized domains/);
  assert.match(googleErrorMessage({code:'auth/popup-blocked'}),/pop-ups/);
  assert.match(googleErrorMessage({code:'auth/something-new'}),/auth\/something-new/);
});

test('OAuth tokens and arbitrary exception details are not shown to users',()=>{
  const secret='DO_NOT_PRINT_THIS_TOKEN';
  const msg=googleErrorMessage({code:'auth/unexpected',message:secret,customData:{credential:secret}});
  assert.doesNotMatch(msg,/DO_NOT_PRINT_THIS_TOKEN/);
  assert.doesNotMatch(googleErrorMessage({code:'bad injected\n'+secret,message:secret}),/DO_NOT_PRINT_THIS_TOKEN/);
});

test('Redirect fallback is only offered for popup-specific failures',()=>{
  assert.equal(googleRedirectAvailable({code:'auth/popup-blocked'}),true);
  assert.equal(googleRedirectAvailable({code:'auth/operation-not-supported-in-this-environment'}),true);
  assert.equal(googleRedirectAvailable({code:'auth/unauthorized-domain'}),false);
  assert.equal(googleRedirectAvailable({code:'auth/internal-error'}),false);
});

test('Production frontend links Google to the existing password account safely',()=>{
  const js=read('public/app.js'),html=read('public/index.html');
  assert.match(js,/linkWithPopup\(auth\.currentUser,provider\)/);
  assert.match(js,/getIdToken\(true\)/);
  assert.match(js,/googleErrorMessage\(err\)/);
  assert.match(js,/googleRedirectAvailable\(err\)/);
  assert.match(html,/Settings &gt; Connect Google/);
  assert.match(html,/src="\/app\.js\?v=\d+(?:\.\d+){2,3}"/);
  assert.match(html,/monitor-scrollspy\.js\?v=1\.0\.5/);
});
