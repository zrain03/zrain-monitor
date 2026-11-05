/*
 * Pembangun / Developer: Zrain
 * Dicipta / Created (rekod Git terawal / first Git evidence): 2026-10-30
 * Dikemas kini / Last updated: 2026-11-04
 * Fail / File: public/google-auth-errors.js
 * BM: Perilaku antaramuka atau konfigurasi frontend Monitor.
 * EN: Monitor frontend behavior or configuration.
 */
// Firebase error descriptions safe to display to users. Never echo raw
// OAuth credentials, tokens, stack traces or account-identifying details.
const GOOGLE_ERRORS = Object.freeze({
  'auth/account-exists-with-different-credential': 'This email already has an account with another sign-in method. Sign in using that method, then use Settings > Connect Google to keep your account and monitor history.',
  'auth/credential-already-in-use': 'This Google account is already linked to another user. No monitor data was changed.',
  'auth/email-already-in-use': 'This email already belongs to another account. Sign in to the original account first.',
  'auth/provider-already-linked': 'Google is already connected to this account.',
  'auth/popup-blocked': 'Your browser blocked the Google window. Allow pop-ups for this site or choose Continue in this tab below.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled or the popup closed. Please try again.',
  'auth/operation-not-supported-in-this-environment': 'Google popups are not supported in this browser. Open the site in a regular browser tab or use Continue in this tab.',
  'auth/cancelled-popup-request': 'Another Google login window was opened. Close extra windows and try again.',
  'auth/unauthorized-domain': 'This website is not authorized for Google sign-in. The project owner should add zrain-monitor.web.app under Firebase Authentication > Settings > Authorized domains.',
  'auth/operation-not-allowed': 'Google sign-in is disabled for this Firebase project. Enable Google in Firebase Authentication > Sign-in method.',
  'auth/network-request-failed': 'Unable to reach Firebase. Check your connection and try again.',
  'auth/invalid-api-key': 'Firebase Web App configuration is invalid. The project owner needs to check its API key.',
  'auth/auth-domain-config-required': 'Firebase authDomain is missing. The project owner needs to check the Web App configuration.',
  'auth/web-storage-unsupported': 'This browser blocks storage required for sign-in. Try a regular browser tab with cookies and storage enabled.',
  'auth/invalid-credential': 'Firebase could not accept the Google credential. If you already have a password account, sign in with that account and use Settings > Connect Google.',
  'auth/internal-error': 'Firebase returned an internal sign-in error. Try again in a normal browser tab. If it persists, check Firebase Authentication configuration and the browser console.',
  'auth/user-disabled': 'This Firebase account is disabled. Contact Zrain support.'
});
export function googleErrorMessage(error){
  const code = typeof error?.code==='string' && /^auth\/[a-z0-9-]{1,70}$/.test(error.code) ? error.code : '';
  const description=GOOGLE_ERRORS[code]||'Google sign-in could not be completed. If this email already has a password account, sign in with that account and use Settings > Connect Google.';
  return description+(code && !['auth/popup-closed-by-user'].includes(code)?` (Firebase: ${code})`:'');
}
export function googleRedirectAvailable(error){
  return ['auth/popup-blocked','auth/operation-not-supported-in-this-environment'].includes(error?.code);
}
