const SAFE_PLATFORMS = ["onrender.com","web.app","firebaseapp.com","pages.dev","workers.dev","vercel.app","netlify.app"];

export function validateTarget(input, env={}) {
  if (typeof input !== "string" || input.length>2048 || !input.trim()) throw new Error("Provide a valid public HTTPS URL.");
  let value;
  try { value = new URL(input.trim()); } catch { throw new Error("Provide a valid HTTPS URL."); }
  if(value.protocol!=="https:" || value.username || value.password || value.port || value.hash) {
    throw new Error("Only public HTTPS URLs without credentials, custom ports or fragments are supported.");
  }
  const hostname=value.hostname.toLowerCase();
  if (!/^[a-z0-9.-]{4,253}$/.test(hostname) || hostname.startsWith(".") || hostname.endsWith(".") || hostname.includes("..") ||
      hostname.split(".").some(label=>!label || label.length>63 || label.startsWith("-") || label.endsWith("-")) ||
      /^\d+(?:\.\d+){3}$/.test(hostname) || hostname.startsWith("xn--") || hostname.includes(".xn--")) {
    throw new Error("Only valid public DNS hostnames are supported.");
  }
  const extras=String(env.ALLOWED_HOSTS||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
  const permitted=extras.includes(hostname)||SAFE_PLATFORMS.some(s=>hostname.endsWith("."+s));
  if(!permitted)throw new Error("This domain is not enabled for the private beta. Contact the administrator.");
  value.hostname=hostname;
  value.hash="";
  return value.href;
}
export function validateMonitor(payload,env={}) {
  if (!payload || typeof payload!=="object" || Array.isArray(payload))throw new Error("Invalid request body.");
  const name=typeof payload.name==="string"?payload.name.trim():"";
  if(name.length<2||name.length>70)throw new Error("Name must have 2 to 70 characters.");
  if(!["uptime","keepawake"].includes(payload.purpose))throw new Error("Select Uptime or Keep-Awake.");
  return {name,url:validateTarget(payload.url,env),purpose:payload.purpose};
}
export const nowISO=()=>new Date().toISOString();
export const inMinutes=(date,n)=>new Date(Date.parse(date)+n*60000).toISOString();
export const isFresh=(last,now=Date.now())=>typeof last==="string" && now-Date.parse(last)<15*60*1000 && now>=Date.parse(last);
export function displayedStatus(monitor,time=Date.now()){
  if(monitor.state==="PAUSED") return "PAUSED";
  if(!isFresh(monitor.last_checked_at,time))return "UNKNOWN";
  return monitor.status;
}
