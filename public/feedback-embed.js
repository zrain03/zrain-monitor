/*
 * Pembangun / Developer: Zrain
 * Dicipta / Created: 2026-11-01 (GitHub commit e716227)
 * Dikemas kini / Last updated: 2026-11-04
 * Fail / File: public/feedback-embed.js
 * BM: Memaparkan komen komuniti awam yang tulen bagi produk ini menggunakan GitHub Issues sahaja.
 * EN: Display authentic public community comments for this product through GitHub Issues only.
 * BM: Tiada token istimewa dalam pelayar; teks pengguna dipaparkan sebagai teks, bukan HTML.
 * EN: No privileged browser token; user content is rendered as text, never HTML.
 */
(function () {
  'use strict';

  // BM: Kekalkan pemetaan thread khusus setiap produk daripada commit GitHub yang diluluskan.
  // EN: Preserve the per-product discussion mapping from the approved GitHub commit.
  const threads = {'zrain-links':16,'zrain-monitor':17,'zrain-auth-starter':18,
    'zrain-ui':19,'zrain-ecosystem':20,'zrain-console':21,
    'zrain-image-tools':22,'zrain-pdf-tools':23,'zrain-document-tools':24,
    'zrain-developer-tools':25,'zrain-productivity-tools':26};
  const loader = document.currentScript;

  // BM: Bina nod teks yang selamat supaya kandungan komen tidak dieksekusi sebagai HTML.
  // EN: Create safe text nodes so comment content cannot execute as HTML.
  function node(tag, cls, value) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (value !== undefined) e.textContent = value;
    return e;
  }

  // BM: Hanya benarkan pautan HTTPS milik GitHub atau hos avatar GitHub.
  // EN: Permit only HTTPS links hosted by GitHub or its avatar service.
  function safe(url) {
    try {
      const u = new URL(url);
      return u.protocol === 'https:' &&
        (u.hostname === 'github.com' || u.hostname === 'avatars.githubusercontent.com') ? u.href : null;
    } catch { return null; }
  }

  // BM: Pautan luar mesti membuka tab baharu tanpa akses ke window asal.
  // EN: External links must open separately without access to their opener.
  function link(label, href, cls) {
    const a = node('a', cls, label);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  }

  // BM: Lekapkan panel sebelum footer; jangan mengubah fungsi atau laluan Monitor.
  // EN: Mount the panel before the footer without changing Monitor logic or routes.
  function init() {
    const product = loader?.dataset.product || document.body?.dataset.feedbackProduct;
    const id = threads[product];
    if (!id) return;
    let root = document.querySelector('[data-zrain-feedback]');
    if (!root) {
      root = node('section', 'zr-feedback');
      root.dataset.zrainFeedback = '';
      const footer = document.querySelector('footer');
      if (footer) footer.before(root); else document.body.append(root);
    }
    if (root.dataset.mounted) return;
    root.dataset.mounted = '1';
    root.classList.add('zr-feedback');
    root.id = root.id || 'zrain-feedback';
    root.dataset.product = product;

    const issue = 'https://github.com/zrain03/zrain-ecosystem/issues/' + id;
    const panel = node('section', 'zr-feedback__panel');
    const head = node('div', 'zr-feedback__head');
    const title = node('div');
    const buttons = node('div', 'zr-feedback__buttons');
    panel.setAttribute('aria-label', 'Community feedback for ' + product);
    title.append(node('span', 'zr-feedback__eyebrow', 'Zrain • Community voices'),
      node('h2', null, 'Feedback & transparency'),
      node('p', 'zr-feedback__intro', 'Real community comments for ' + product.replaceAll('-', ' ') +
        '. Suggestions, praise and constructive criticism are all welcome. No paid or fabricated testimonials.'));
    head.append(title);
    buttons.append(link('Write a comment ↗', issue + '#issuecomment-new', 'zr-feedback__button'),
      link('Read on GitHub ↗', issue, 'zr-feedback__button secondary'));
    const status = node('p', 'zr-feedback__status', 'Comments appear when you reach this section.');
    status.setAttribute('role', 'status');
    const list = node('div', 'zr-feedback__list');
    const paging = node('div', 'zr-feedback__toolbar');
    const info = node('p', 'zr-feedback__source',
      'Anyone can read; commenting requires GitHub sign-in. Each Zrain web app has its own discussion. ' +
      'The Zrain repository owner can delete inappropriate comments on GitHub. ' +
      'Constructive negative feedback stays welcome. Do not share private information. ');
    info.append(link('View the original conversation ↗', issue, 'zr-feedback__permalink'));
    const refresh = node('button', 'zr-feedback__button secondary', 'Refresh comments');
    refresh.type = 'button';
    buttons.append(refresh);
    panel.append(head, buttons, status, list, paging, info);
    root.append(panel);
    let page = 1, busy = false;

    // BM: Paparkan author dan kandungan komen melalui textContent; URL luaran disemak.
    // EN: Render author and comment body through textContent; validate external URLs.
    function render(item) {
      if (!item || typeof item.body !== 'string') return;
      const card = node('article', 'zr-feedback__comment');
      const who = node('div', 'zr-feedback__who');
      const avatar = node('img', 'zr-feedback__avatar');
      avatar.alt = '';
      avatar.loading = 'lazy';
      avatar.width = 37;
      avatar.height = 37;
      avatar.src = safe(item.user?.avatar_url) || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
      const author = node('div');
      author.append(link(item.user?.login || 'GitHub user', safe(item.user?.html_url) || issue,
        'zr-feedback__author'));
      const created = Date.parse(item.created_at);
      author.append(node('small', null,
        (Number.isFinite(created) ? new Date(created).toLocaleDateString() : 'Date unavailable') +
        (item.user?.login === 'zrain03' ? ' · Zrain developer' : '')));
      who.append(avatar, author);
      card.append(who, node('p', 'zr-feedback__body', item.body.slice(0, 12000)));
      if (safe(item.html_url)) {
        const tools = node('div', 'zr-feedback__toolbar');
        tools.append(link('View comment on GitHub ↗', safe(item.html_url), 'zr-feedback__permalink'));
        card.append(tools);
      }
      list.append(card);
    }

    // BM: Muat komen secara paginated tanpa token; kegagalan GitHub tidak menjejaskan Monitor.
    // EN: Fetch paginated comments without a token; GitHub failures do not affect Monitor.
    async function load() {
      if (busy) return;
      busy = true;
      paging.replaceChildren();
      status.textContent = 'Loading authentic comments…';
      try {
        const url = 'https://api.github.com/repos/zrain03/zrain-ecosystem/issues/' + id +
          '/comments?per_page=30&page=' + page;
        const response = await fetch(url,
          {headers: {Accept: 'application/vnd.github+json'}, cache: 'no-store'});
        if (!response.ok) throw Error('GitHub HTTP ' + response.status);
        const rows = await response.json();
        if (!Array.isArray(rows)) throw Error('Unexpected data');
        rows.forEach(render);
        page += 1;
        status.textContent = list.children.length
          ? 'Showing ' + list.children.length + ' genuine public comment(s).'
          : 'No public comments yet. You can be the first.';
        if (rows.length === 30) {
          const more = node('button', 'zr-feedback__button secondary', 'Load more comments');
          more.type = 'button';
          more.addEventListener('click', load);
          paging.append(more);
        }
      } catch {
        status.textContent = 'Comments cannot be loaded here right now. You can still read or write on GitHub.';
        const retry = node('button', 'zr-feedback__button secondary', 'Try again');
        retry.type = 'button';
        retry.addEventListener('click', load);
        paging.append(retry);
      } finally { busy = false; }
    }

    // BM: Refresh memuat halaman awal; IntersectionObserver menjimatkan permintaan API.
    // EN: Refresh restarts pagination; IntersectionObserver avoids unnecessary API calls.
    refresh.addEventListener('click', () => {if (busy) return; page = 1; list.replaceChildren(); load();});
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(items => {
        if (!items.some(x => x.isIntersecting)) return;
        observer.disconnect();
        load();
      }, {rootMargin: '250px'});
      observer.observe(root);
    } else load();
  }

  // BM: Inisialisasi sekali selepas DOM tersedia, termasuk apabila skrip dimuat secara defer.
  // EN: Initialize once after the DOM is ready, including deferred script loading.
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
