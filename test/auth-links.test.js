import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8').replace(/^\uFEFF/,'');

test('Monitor authentication uses the same compact Zrain Links dialog structure',()=>{
  const html=read('public/index.html'),css=read('public/auth-links.css'),js=read('public/app.js');
  for(const id of ['auth-dialog','auth-heading','auth-caption','auth-tabs','signin-tab','signup-tab','full-name','auth-email','auth-password','confirm-password','toggle-password','toggle-confirm-password','reset-password-panel','reset-password-form','reset-email','reset-submit','back-to-signin','verification-panel','verify-email','verified-button','resend-verification','switch-account','google-login','google-label','google-message','google-redirect','auth-message','auth-submit','connect-google-panel','connect-google']){
    assert.match(html,new RegExp(`id="${id}"`),`Missing ${id}`);
  }
  assert.match(html,/class="google-icon"/);
  assert.match(html,/id="signup-tab"[^>]*>Create account/);
  assert.match(html,/id="signin-tab"[^>]*>Sign in/);
  assert.match(html,/src="\/app\.js\?v=\d+(?:\.\d+){2,3}"/);
  assert.match(html,/href="\/auth-links\.css\?v=1\.0\.3"/);
  assert.match(css,/width:min\(460px,calc\(100vw - 28px\)\)/);
  assert.match(css,/\.auth-dialog \[hidden\]/);
  assert.match(css,/@media\(max-width:540px\)/);
  assert.match(js,/updateProfile\(credential\.user,\{displayName:fullName\}\)/);
  assert.match(js,/sendEmailVerification\(credential\.user\)/);
  assert.match(js,/await current\.reload\(\)/);
  assert.match(js,/await current\.getIdToken\(true\)/);
  assert.match(js,/sendPasswordResetEmail/);
  assert.match(js,/signInWithPopup/);
  assert.match(js,/signInWithRedirect/);
  assert.match(js,/linkWithPopup/);
  assert.match(js,/await setPersistence\(auth,browserLocalPersistence\)/);
  assert.match(js,/setAuthState\(true\)/);
  assert.match(js,/getIdToken\(\)/);
  assert.match(js,/create-form/);
});

test('authentication copy is Monitor-specific and never links accounts across Zrain products',()=>{
  const html=read('public/index.html'),js=read('public/app.js');
  const dialog=html.slice(html.indexOf('<dialog id="auth-dialog"'),html.indexOf('<dialog id="create-dialog"'));
  assert.match(dialog,/Zrain Monitor/);
  assert.doesNotMatch(dialog,/Zrain Links|create and manage links/);
  assert.match(dialog,/Sign in with a verified account to create up to 3 monitors for approved public HTTPS websites and APIs/i);
  assert.doesNotMatch(js,/zrain-links\.web\.app|zrain-links\.zrain-dev/);
  assert.match(js,/\bAPI_ORIGIN\b/);
});

test('authentication fields and button IDs are unique',()=>{
  const html=read('public/index.html'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(new Set(ids).size,ids.length);
  assert.match(html,/<dialog id="create-dialog"/);
  assert.match(html,/id="monitor-detail"/);
});


test('existing Firebase Console users are not falsely told verification was sent',()=>{
  const html=read('public/index.html'),js=read('public/app.js');
  const dialog=html.slice(html.indexOf('<dialog id="auth-dialog"'),html.indexOf('<dialog id="create-dialog"'));
  assert.doesNotMatch(dialog,/We have sent a verification link/);
  assert.match(dialog,/not verified yet/);
  assert.match(dialog,/id="resend-verification" type="button">Send verification email/);
  assert.match(js,/await sendEmailVerification\(current\)/);
  assert.match(js,/Firebase accepted the verification email request/);
  assert.match(js,/catch\(err\)\{message\("verification-message",errorMessage\(err\)\);\}/);
  assert.match(js,/button\.textContent="Sending…"/);
  assert.match(html,/src="\/app\.js\?v=\d+(?:\.\d+){2,3}"/);
});
