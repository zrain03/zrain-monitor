// Zrain Monitor navigation follows the section actually being read, not the
// previously clicked tab or an outdated URL hash. No monitoring/auth changes.
export const SECTION_ORDER = ["overview", "monitors", "incidents", "settings", "system"];
export const ANCHORS = {
  overview:"dashboard", monitors:"monitors", incidents:"incidents",
  settings:"settings", system:"system"
};

// The reading line is below the fixed header and roughly one quarter of the
// remaining viewport. It detects a section while its heading is visible.
export function readingLine(viewportHeight, headerHeight) {
  const h = Math.max(320,Number(viewportHeight)||768);
  const top = Math.max(0,Number(headerHeight)||0);
  return Math.min(h-12,top+Math.max(48,(h-top)*.25));
}

export function visibleSection(sectionTops,line,{admin=false,atBottom=false}={}) {
  const order=admin?SECTION_ORDER:SECTION_ORDER.slice(0,-1);
  if(atBottom)return order[order.length-1];
  let current="overview";
  for(const name of order){
    const top=Number(sectionTops[name]);
    if(Number.isFinite(top)&&top<=line)current=name;
  }
  return current;
}

export function mountMonitorScrollspy(doc,win) {
  const nav=doc.querySelector(".zrain-header .topnav");
  const header=doc.querySelector(".zrain-header");
  const dashboard=doc.getElementById("dashboard");
  const system=doc.getElementById("system");
  const systemLink=nav?.querySelector('[data-view="system"]');
  if(!nav||!header||!dashboard||!systemLink)return null;
  const anchors=[...nav.querySelectorAll("a[data-view]")];
  const elements=Object.fromEntries(SECTION_ORDER.map(name=>[name,doc.getElementById(ANCHORS[name])]));
  if(SECTION_ORDER.some(name=>!elements[name]))return null;
  let current=null;
  let pending=false;
  function paint(view) {
    if(current===view)return;
    current=view;
    for(const anchor of anchors){
      const selected=anchor.dataset.view===view;
      anchor.classList.toggle("current",selected);
      if(selected)anchor.setAttribute("aria-current","location");
      else anchor.removeAttribute("aria-current");
    }
    // On narrow screens, bring the highlighted tab into the *horizontal*
    // nav viewport only. scrollIntoView would also move the whole webpage.
    const active=anchors.find(a=>a.dataset.view===view);
    if(!active||nav.scrollWidth<=nav.clientWidth)return;
    const navRect=nav.getBoundingClientRect(),r=active.getBoundingClientRect();
    const offset=r.left<navRect.left?r.left-navRect.left:r.right>navRect.right?r.right-navRect.right:0;
    if(offset&&typeof nav.scrollTo==="function")nav.scrollTo({left:nav.scrollLeft+offset,behavior:"auto"});
  }
  function recalculate() {
    const admin=!system.hidden&&!dashboard.hidden;
    systemLink.hidden=!admin;
    const height=header.getBoundingClientRect().height;
    doc.documentElement.style.setProperty("--monitor-header-offset",`${Math.ceil(height+16)}px`);
    if(dashboard.hidden){paint("overview");return;}
    const threshold=readingLine(win.innerHeight||doc.documentElement.clientHeight,height);
    const tops=Object.fromEntries(SECTION_ORDER.map(name=>[name,elements[name].getBoundingClientRect().top]));
    const atBottom=win.scrollY+(win.innerHeight||0)>=doc.documentElement.scrollHeight-10 && (win.scrollY||0)>0;
    paint(visibleSection(tops,threshold,{admin,atBottom}));
  }
  function schedule(){
    if(pending)return;
    pending=true;
    const raf=win.requestAnimationFrame || (cb=>cb());
    raf(()=>{pending=false;recalculate();});
  }
  for(const a of anchors){a.addEventListener("click",()=>{
    if(a.hidden||dashboard.hidden)return;
    paint(a.dataset.view);
    // Native anchor navigation handles smooth scrolling and back/forward.
    // Scroll listeners then choose the actually visible section.
  });}
  win.addEventListener("scroll",schedule,{passive:true});
  win.addEventListener("resize",schedule);
  win.addEventListener("hashchange",schedule);
  win.addEventListener("pageshow",schedule);
  win.addEventListener("load",schedule);
  if(typeof win.MutationObserver==="function"){
    const observer=new win.MutationObserver(schedule);
    observer.observe(dashboard,{attributes:true,attributeFilter:["hidden"]});
    observer.observe(system,{attributes:true,attributeFilter:["hidden"]});
  }
  recalculate();
  return {recalculate};
}

if(typeof document!=="undefined"&&typeof window!=="undefined"){
  mountMonitorScrollspy(document,window);
}
