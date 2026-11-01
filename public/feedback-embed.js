/* Zrain Community Feedback • public GitHub Issues, no paid services */
(()=>{"use strict";
const threads={"guess-the-flag":14,"memory-rush":15,"zrain-links":16,"zrain-monitor":17,"zrain-auth-starter":18,"zrain-ui":19,"zrain-ecosystem":20,"zrain-console":21,"zrain-image-tools":22,"zrain-pdf-tools":23,"zrain-document-tools":24,"zrain-developer-tools":25,"zrain-productivity-tools":26,"cryptoquest":27};
const script=document.currentScript;
function el(tag,cls,label){const e=document.createElement(tag);if(cls)e.className=cls;if(label!=null)e.textContent=label;return e}
function safe(url){try{const v=new URL(url);return v.protocol==="https:"&&["github.com","avatars.githubusercontent.com"].includes(v.hostname)?v.href:null}catch{return null}}
const css=".zr-feedback{max-width:1160px;margin:54px auto 0;padding:0 22px;color:#182334;font-family:Inter,system-ui,sans-serif}.zr-feedback *{box-sizing:border-box}.zr-feedback__card{border:1px solid #e9d8cb;border-radius:24px;background:#fffdfa;padding:clamp(20px,3vw,34px);box-shadow:0 14px 35px #67402e0b}.zr-feedback__top{display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap}.zr-feedback__kicker{color:#b85338;font-weight:800;font-size:11px;letter-spacing:2px;text-transform:uppercase}.zr-feedback h2{font-size:clamp(24px,3vw,32px);letter-spacing:-1px;margin:8px 0}.zr-feedback__lead{font-size:13px;line-height:1.8;color:#677287;max-width:720px;margin:0}.zr-feedback__action{border-radius:12px;background:#bd5338;border:1px solid #bd5338;color:#fff!important;display:inline-flex;align-items:center;justify-content:center;padding:11px 16px;text-decoration:none!important;font-size:12px;font-weight:800}.zr-feedback__action--quiet{color:#83432f!important;background:#fff;border-color:#ead0c4}.zr-feedback__actions{display:flex;gap:9px;flex-wrap:wrap}.zr-feedback__state{background:#f8f1e9;border:1px solid #eddacf;padding:13px 14px;border-radius:13px;margin:20px 0 12px;font-size:12px;line-height:1.7;color:#665b57}.zr-feedback__list{display:grid;gap:12px}.zr-feedback__comment{border:1px solid #e9ddd5;border-radius:16px;padding:16px;background:#fff}.zr-feedback__person{display:flex;gap:10px;align-items:center}.zr-feedback__person img{width:36px;height:36px;border-radius:50%;object-fit:cover}.zr-feedback__person a{color:#385e54;text-decoration:none;font-size:12px;font-weight:800}.zr-feedback__person small{display:block;color:#788391;font-size:11px;margin-top:4px}.zr-feedback__body{font-size:13px;line-height:1.8;color:#2a3d50;white-space:pre-wrap;overflow-wrap:anywhere;margin:13px 0 0}.zr-feedback__info{font-size:11px;line-height:1.8;color:#75808b;margin:17px 0 0}.zr-feedback__info a{color:#b65238}@media(max-width:600px){.zr-feedback{padding:0 12px;margin-top:27px}}";
function insert(product, issueNo){
  const target=document.querySelector("[data-zrain-feedback]")||el("section","zr-feedback");
  target.classList.add("zr-feedback"); if(target.dataset.feedbackReady)return; target.dataset.feedbackReady="1";
  if(!target.parentElement){const footer=document.querySelector("footer");if(footer)footer.before(target);else document.body.append(target)}
  if(!document.querySelector("#zrain-feedback-css")){const style=el("style");style.id="zrain-feedback-css";style.textContent=css;document.head.append(style)}
  const issue="https://github.com/zrain03/zrain-ecosystem/issues/"+issueNo;
  const card=el("div","zr-feedback__card"),top=el("div","zr-feedback__top"),head=el("div"),actions=el("div","zr-feedback__actions");
  head.append(el("span","zr-feedback__kicker","Zrain • Community voices"),el("h2",null,"Feedback & transparency"),el("p","zr-feedback__lead","Real public comments, including respectful criticism and suggestions. Reviews here are not paid testimonials."));
  const write=el("a","zr-feedback__action","Write a comment ↗");write.href=issue+"#issuecomment-new";write.target="_blank";write.rel="noopener noreferrer";
  const view=el("a","zr-feedback__action zr-feedback__action--quiet","Open GitHub discussion ↗");view.href=issue;view.target="_blank";view.rel="noopener noreferrer";
  actions.append(write,view);top.append(head,actions);
  const status=el("p","zr-feedback__state","Loading real public comments…");status.setAttribute("role","status");
  const list=el("div","zr-feedback__list"),more=el("div");
  const info=el("p","zr-feedback__info","Reading does not require an account. Commenting requires GitHub sign-in. Avoid publishing personal information. Spam, abuse or private information may be moderated. Comments remain available while the GitHub discussion exists.");
  card.append(top,status,list,more,info);target.append(card);
  let page=1,busy=false;
  async function load(){
    if(busy)return;busy=true;more.replaceChildren();status.textContent="Loading public comments…";
    try {
      const res=await fetch("https://api.github.com/repos/zrain03/zrain-ecosystem/issues/"+issueNo+"/comments?per_page=50&page="+page,{headers:{"Accept":"application/vnd.github+json"}});
      if(!res.ok)throw Error("HTTP "+res.status);
      const comments=await res.json();if(!Array.isArray(comments))throw Error("Unexpected response");
      for(const item of comments){
        if(typeof item.body!=="string")continue;
        const comment=el("article","zr-feedback__comment"),person=el("div","zr-feedback__person"),profile=el("div");
        const avatar=el("img");avatar.alt="";avatar.loading="lazy";avatar.src=safe(item.user?.avatar_url)||"data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
        const author=el("a",null,item.user?.login||"GitHub user");author.href=safe(item.user?.html_url)||issue;author.rel="noopener noreferrer";author.target="_blank";
        const date=el("small",null,Number.isFinite(Date.parse(item.created_at))?new Date(item.created_at).toLocaleDateString():"Date unavailable");
        profile.append(author,date);person.append(avatar,profile);comment.append(person,el("p","zr-feedback__body",item.body.slice(0,10000)));list.append(comment);
      }
      status.textContent=list.children.length?"Showing "+list.children.length+" authentic public comments · Oldest first":"No public comments yet. You can start the conversation.";
      if(comments.length===50){const next=el("button","zr-feedback__action zr-feedback__action--quiet","Load older comments");next.type="button";next.onclick=()=>{page++;load()};more.append(next)}
    }catch{status.textContent="Cannot load comments here right now. The full conversation can still be read on GitHub.";const retry=el("button","zr-feedback__action zr-feedback__action--quiet","Try again");retry.type="button";retry.onclick=load;more.append(retry)}
    busy=false;
  }
  load();
}
function main(){
  const product=script?.dataset?.product||new URLSearchParams(location.search).get("product")||document.body?.dataset?.feedbackProduct;
  if(threads[product])return insert(product,threads[product]);
  const root=document.querySelector("[data-zrain-feedback]");if(!root)return;
  const shell=el("div","zr-feedback__card");shell.append(el("h2",null,"Zrain community feedback"));
  const intro=el("p",null,"Choose a Zrain product to read real reviews and leave feedback. Reading is public and free.");
  shell.append(intro);const ul=el("ul");
  for(const [slug,no] of Object.entries(threads)){const li=el("li"),a=el("a",null,slug.replaceAll("-"," "));a.href="/feedback.html?product="+encodeURIComponent(slug);li.append(a);ul.append(li)}shell.append(ul);root.classList.add("zr-feedback");root.append(shell);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",main,{once:true});else main();
})();