const CERTS_URL="https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
let cached={keys:[],expires:0};
function fromBase64Url(part){
  const bin=atob(part.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(part.length/4)*4,"="));
  return Uint8Array.from(bin,c=>c.charCodeAt(0));
}
export function verifyClaims(header,payload,projectId,now=Math.floor(Date.now()/1000)){
  if(header?.alg!=="RS256" || typeof header.kid!=="string" || !header.kid)throw new Error("Invalid token algorithm.");
  if(!projectId || projectId.startsWith("REPLACE"))throw new Error("Authentication is not configured.");
  if(payload?.iss!==`https://securetoken.google.com/${projectId}` || payload.aud!==projectId ||
      typeof payload.sub!=="string" || !payload.sub || payload.sub.length>128 ||
      typeof payload.exp!=="number" || payload.exp<=now ||
      typeof payload.iat!=="number" || payload.iat>now || payload.iat<=0 ||
      typeof payload.auth_time!=="number" || payload.auth_time>now || payload.auth_time<=0) {
    throw new Error("Invalid Firebase ID token claims.");
  }
  if(payload.email_verified!==true)throw new Error("Verify your email address before using Monitor.");
  return {uid:payload.sub,email:typeof payload.email==="string"?payload.email:null};
}
async function publicKey(kid,fetcher){
  if(!cached.keys.length||Date.now()>=cached.expires||!cached.keys.some(k=>k.kid===kid)){
    const res=await fetcher(CERTS_URL,{headers:{Accept:"application/json"}});
    if(!res.ok)throw new Error("Firebase key service unavailable.");
    const data=await res.json();
    if(!Array.isArray(data.keys)||!data.keys.length)throw new Error("Firebase keys unavailable.");
    const maxAge=Number(/max-age=(\d+)/i.exec(res.headers.get("cache-control")||"")?.[1]||300);
    cached={keys:data.keys,expires:Date.now()+Math.max(60,Math.min(maxAge,3600))*1000};
  }
  const key=cached.keys.find(k=>k.kid===kid && k.kty==="RSA" && k.alg==="RS256" && k.use==="sig");
  if(!key)throw new Error("Firebase token key not found.");
  return crypto.subtle.importKey("jwk",key,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
}
export async function authenticate(request,env,fetcher=fetch){
  const authorization=request.headers.get("authorization")||"";
  if(!authorization.startsWith("Bearer "))throw new Error("Sign in required.");
  const token=authorization.slice(7);
  if(token.length>8192)throw new Error("Invalid token.");
  const parts=token.split(".");
  if(parts.length!==3)throw new Error("Invalid token.");
  let header,payload;
  try{
    header=JSON.parse(new TextDecoder().decode(fromBase64Url(parts[0])));
    payload=JSON.parse(new TextDecoder().decode(fromBase64Url(parts[1])));
  }catch{throw new Error("Invalid token.");}
  const claims=verifyClaims(header,payload,env.FIREBASE_PROJECT_ID);
  const key=await publicKey(header.kid,fetcher);
  const verified=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,fromBase64Url(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
  if(!verified)throw new Error("Invalid token signature.");
  return claims;
}
