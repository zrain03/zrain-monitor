/* Zrain public community feedback. No account needed to read; no privileged token in the browser. */
(function () {
  'use strict';
  const threads = {'zrain-links':16,'zrain-monitor':17,'zrain-auth-starter':18,
    'zrain-ui':19,'zrain-ecosystem':20,'zrain-console':21,
    'zrain-image-tools':22,'zrain-pdf-tools':23,'zrain-document-tools':24,
    'zrain-developer-tools':25,'zrain-productivity-tools':26};
  const loader = document.currentScript;
  function node(tag, cls, value) {
    const e = document.createElement(tag);
    if(cls) e.className = cls;
    if(value !== undefined) e.textContent = value;
    return e;
  }
  function safe(url) {
    try { const u = new URL(url); return u.protocol === 'https:' &&
      (u.hostname === 'github.com' || u.hostname === 'avatars.githubusercontent.com') ? u.href : null; }
    catch { return null; }
  }
  function link(label, href, cls) {
    const a = node('a',cls,label); a.href=href; a.target='_blank'; a.rel='noopener noreferrer'; return a;
  }
  function init() {
    const product = loader?.dataset.product || document.body?.dataset.feedbackProduct;
    const id = threads[product];
    if(!id) return; /* No game feedback */
    let root = document.querySelector('[data-zrain-feedback]');
    if(!root){
      root = node('section','zr-feedback');
      root.dataset.zrainFeedback = '';
      const footer = document.querySelector('footer');
      if(footer) footer.before(root); else document.body.append(root);
    }
    if(root.dataset.mounted) return;
    root.dataset.mounted='1'; root.classList.add('zr-feedback'); root.id=root.id||'zrain-feedback';
    root.dataset.product=product;
    const issue='https://github.com/zrain03/zrain-ecosystem/issues/'+id;
    const panel=node('section','zr-feedback__panel'),head=node('div','zr-feedback__head'),
      title=node('div'),buttons=node('div','zr-feedback__buttons');
    panel.setAttribute('aria-label','Community feedback for '+product);
    title.append(node('span','zr-feedback__eyebrow','Zrain • Community voices'),
      node('h2',null,'Feedback & transparency'),
      node('p','zr-feedback__intro','Real community comments for '+product.replaceAll('-',' ')+'. Suggestions, praise and constructive criticism are all welcome. No paid or fabricated testimonials.'));
    head.append(title);
    buttons.append(link('Write a comment ↗',issue+'#issuecomment-new','zr-feedback__button'),
      link('Read on GitHub ↗',issue,'zr-feedback__button secondary'));
    const status=node('p','zr-feedback__status','Comments appear when you reach this section.');
    status.setAttribute('role','status');
    const list=node('div','zr-feedback__list'),paging=node('div','zr-feedback__toolbar');
    const info=node('p','zr-feedback__source',
      'Anyone can read; commenting requires GitHub sign-in. Each Zrain web app has its own discussion. The Zrain repository owner can delete inappropriate comments on GitHub. Constructive negative feedback stays welcome. Do not share private information. ');
    info.append(link('View the original conversation ↗',issue,'zr-feedback__permalink'));
    const refresh=node('button','zr-feedback__button secondary','Refresh comments');
    refresh.type='button';buttons.append(refresh);panel.append(head,buttons,status,list,paging,info);root.append(panel);
    let page=1,busy=false;
    function render(item){
      if(!item||typeof item.body!=='string')return;
      const card=node('article','zr-feedback__comment'),who=node('div','zr-feedback__who');
      const avatar=node('img','zr-feedback__avatar');avatar.alt='';avatar.loading='lazy';avatar.width=37;avatar.height=37;
      avatar.src=safe(item.user?.avatar_url)||'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
      const author=node('div');
      author.append(link(item.user?.login||'GitHub user',safe(item.user?.html_url)||issue,'zr-feedback__author'));
      const t=Date.parse(item.created_at);
      author.append(node('small',null,(Number.isFinite(t)?new Date(t).toLocaleDateString():'Date unavailable')+(item.user?.login==='zrain03'?' · Zrain developer':'')));
      who.append(avatar,author);
      card.append(who,node('p','zr-feedback__body',item.body.slice(0,12000)));
      if(safe(item.html_url)){
        const tools=node('div','zr-feedback__toolbar');
        tools.append(link('View comment on GitHub ↗',safe(item.html_url),'zr-feedback__permalink'));card.append(tools);
      }
      list.append(card);
    }
    async function load(){
      if(busy)return;
      busy=true;paging.replaceChildren();status.textContent='Loading authentic comments…';
      try {
        const u='https://api.github.com/repos/zrain03/zrain-ecosystem/issues/'+id+'/comments?per_page=30&page='+page;
        const resp=await fetch(u,{headers:{Accept:'application/vnd.github+json'},cache:'no-store'});
        if(!resp.ok)throw Error('GitHub HTTP '+resp.status);
        const rows=await resp.json();
        if(!Array.isArray(rows))throw Error('Unexpected data');
        rows.forEach(render);page+=1;
        status.textContent=list.children.length?'Showing '+list.children.length+' genuine public comment(s).':'No public comments yet. You can be the first.';
        if(rows.length===30){
          const more=node('button','zr-feedback__button secondary','Load more comments');
          more.type='button';more.addEventListener('click',load);paging.append(more);
        }
      }catch{
        status.textContent='Comments cannot be loaded here right now. You can still read or write on GitHub.';
        const retry=node('button','zr-feedback__button secondary','Try again');
        retry.type='button';retry.addEventListener('click',load);paging.append(retry);
      }finally{busy=false}
    }
    refresh.addEventListener('click',()=>{if(busy)return;page=1;list.replaceChildren();load()});
    if('IntersectionObserver' in window){
      const observer=new IntersectionObserver(items=>{
        if(!items.some(x=>x.isIntersecting))return;
        observer.disconnect();load();
      },{rootMargin:'250px'});
      observer.observe(root);
    }else load();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
