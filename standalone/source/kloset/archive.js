/* The Kloset owns only its landmark. Other locations keep the installed map handler. */
(() => {
  'use strict';
  const root = '/kloset/';
  const place = 'the-kloset';
  const originalShowPlace = window.showPlace;
  let dialog, opener, looks, pending, waitingForEntry = false, index = 0, memory = 0, renderToken = 0;
  const two = n => String(n).padStart(2, '0');
  const $ = selector => dialog.querySelector(selector);
  const url = path => new URL(path, location.origin + root).href;
  const wrap = (n, count) => (n % count + count) % count;
  const button = (label, text, action) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('aria-label', label); b.textContent = text;
    b.addEventListener('click', action);
    return b;
  };

  function create() {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = root + 'archive.css';
    document.head.append(css);
    dialog = document.createElement('dialog');
    dialog.id = 'kl-archive';
    dialog.setAttribute('aria-labelledby', 'kl-title');
    dialog.innerHTML = `
      <div class="kl-shell">
        <header class="kl-header"><div class="kl-wordmark"><span class="kl-star" aria-hidden="true">★</span>
          <h1 id="kl-title">The Kloset</h1></div><span class="kl-tag">Fashion archive</span>
          <button class="kl-close" aria-label="Close The Kloset">×</button></header>
        <div class="kl-status" role="status">Opening the wardrobe…</div>
        <div class="kl-body" hidden>
          <div class="kl-spread">
            <section class="kl-stage" aria-label="Collectible outfit card">
              <div class="kl-card"><div class="kl-cardline"><span>K LAND ★</span><span class="kl-id"></span></div>
                <div class="kl-window"><span aria-hidden="true" class="kl-decal kl-d1">✦</span>
                  <span aria-hidden="true" class="kl-decal kl-d2">♡</span><span aria-hidden="true" class="kl-decal kl-d3">✧</span>
                  <img class="kl-sprite" alt="" draggable="false"></div>
                <div class="kl-nameplate"><span class="kl-project"></span><h2 class="kl-name"></h2></div></div>
              <button class="kl-arrow kl-prev" aria-label="Previous outfit">‹</button>
              <button class="kl-arrow kl-next" aria-label="Next outfit">›</button>
            </section>
            <section class="kl-notes" aria-label="Outfit details">
              <div class="kl-count"></div><h3>Wardrobe notes</h3><p class="kl-description"></p>
              <p class="kl-fact" hidden></p>
              <section class="kl-memories" aria-label="Spotted in" hidden>
                <div class="kl-memoryhead"><h3>Spotted in…</h3><div class="kl-memnav"></div></div>
                <figure class="kl-polaroid"><div class="kl-photo"></div><figcaption></figcaption></figure>
              </section><div class="kl-links"></div>
            </section>
          </div>
          <nav class="kl-rack" aria-label="Jump to an outfit"></nav>
        </div>
        <span class="kl-sr" aria-live="polite" aria-atomic="true"></span>
      </div>`;
    document.body.append(dialog);
    $('.kl-close').onclick = () => dialog.close();
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => {
      window.kuSetPlaceHash?.('');
      if (typeof selected !== 'undefined' && selected === place) {
        selected = null; window.KLandSelectPlace?.('');
      }
      if (opener?.isConnected) opener.focus({preventScroll:true});
    });
    $('.kl-prev').onclick = () => go(index-1, -1);
    $('.kl-next').onclick = () => go(index+1, 1);
    let start;
    const stage = $('.kl-stage');
    stage.addEventListener('pointerdown', e => {
      if (!e.isPrimary || e.button !== 0 || e.target.closest('button')) return;
      start = {x:e.clientX, y:e.clientY, id:e.pointerId};
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointercancel', () => { start = null; });
    stage.addEventListener('pointerup', e => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX-start.x, dy = e.clientY-start.y;
      start = null;
      if (Math.abs(dx) > 38 && Math.abs(dx) > 1.35*Math.abs(dy)) {
        const direction = dx < 0 ? 1 : -1;
        go(index+direction, direction);
      }
    });
  }

  function renderMemory(look) {
    const entries = [...(look.photos || []), ...(look.videos || [])].filter(m => m.image || m.url);
    const group = $('.kl-memories'), pager = $('.kl-memnav');
    pager.replaceChildren(); $('.kl-photo').replaceChildren(); group.hidden = !entries.length;
    if (entries.length) {
      const m = entries[memory];
      if (entries.length > 1) {
        const step = n => {memory = wrap(memory+n,entries.length); renderMemory(look);};
        pager.append(button('Previous memory','‹',()=>step(-1)),document.createTextNode((memory+1)+' / '+entries.length),
                     button('Next memory','›',()=>step(1)));
      }
      const el = document.createElement(m.url ? 'a' : 'div');
      if (m.url) {el.href=m.url; el.target='_blank'; el.rel='noopener noreferrer'; el.setAttribute('aria-label',m.label+' (opens in new tab)');}
      if (m.image) {
        const img = new Image(); img.alt = m.alt || m.label; img.decoding='async'; img.src=url(m.image);
        img.onerror=()=>{img.remove(); if(!m.url) $('.kl-polaroid figcaption').textContent=m.label;};
        el.append(img);
      }
      if (m.url) {const play=document.createElement('span'); play.className='kl-watch';play.textContent='Watch video ↗';el.append(play);}
      $('.kl-photo').append(el); $('.kl-polaroid figcaption').textContent=m.label;
    }
    $('.kl-links').replaceChildren();
    for (const item of look.links || []) {
      if (!item.url) continue;
      const link=document.createElement('a');link.href=item.url;link.textContent=item.label+' ↗';
      link.target='_blank';link.rel='noopener noreferrer';$('.kl-links').append(link);
    }
  }

  function go(n, direction=0) {
    if (!looks?.length) return;
    index=wrap(n,looks.length); memory=0;
    const look=looks[index], number=two(index+1), token=++renderToken;
    $('.kl-id').textContent='K / '+two(look.order);
    $('.kl-name').textContent=look.name; $('.kl-project').textContent=look.era;
    $('.kl-description').textContent=look.description;
    $('.kl-fact').hidden=!look.fact; $('.kl-fact').textContent=look.fact||'';
    $('.kl-count').textContent='LOOK '+number+' / '+two(looks.length);
    const sprite=$('.kl-sprite');sprite.alt=look.name+' outfit';sprite.src=url(look.sprite);
    if (direction && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const card=$('.kl-card');
      card.getAnimations().forEach(a=>a.cancel());
      card.animate([{opacity:.7,transform:'translateX('+direction*15+'px) rotate('+direction*1.7+'deg)'},{opacity:1,transform:'none'}],{duration:210,easing:'ease-out'});
    }
    renderMemory(look);
    const rack=$('.kl-rack');
    [...rack.children].forEach((b,i)=>b.setAttribute('aria-current',String(i===index)));
    const active=rack.children[index];
    rack.scrollLeft += active.getBoundingClientRect().left-rack.getBoundingClientRect().left-(rack.clientWidth-active.offsetWidth)/2;
    $('.kl-sr').textContent='Look '+(index+1)+' of '+looks.length+', '+look.name+', '+look.era;
    sprite.decode().catch(()=>{}).then(()=>{
      if (token !== renderToken) return;
      for (const off of [-1,1]) {const img=new Image(); img.src=url(looks[wrap(index+off,looks.length)].sprite);}
    });
  }

  async function load() {
    if (!looks) {
      if (!pending) pending=fetch(root+'collection.json').then(r=>{
        if (!r.ok) throw new Error('wardrobe');
        return r.json();
      }).then(data=>{
        if (!Array.isArray(data) || !data.length) throw new Error('wardrobe');
        looks=data.sort((a,b)=>a.order-b.order);
        for (const [i,look] of looks.entries()) {
          const b=button('Show '+look.name,'',()=>go(i,Math.sign(i-index)));
          const image=new Image();image.alt='';image.loading='lazy';image.src=url(look.thumbnail);
          b.title=look.name; b.append(image); $('.kl-rack').append(b);
        }
      }).finally(()=>{pending=null;});
      try { await pending; } catch {
        $('.kl-status').replaceChildren('The wardrobe couldn’t load. ',button('Retry opening the wardrobe','Try again',load));return;
      }
    }
    $('.kl-status').hidden=true;$('.kl-body').hidden=false;go(index);
  }
  function openArchive(focus) {
    const loader = document.getElementById('kland-loading');
    if (loader && !loader.hidden) {
      if (!waitingForEntry) {
        waitingForEntry = true;
        document.addEventListener('kland-enter', () => {
          waitingForEntry = false; openArchive(focus);
        }, {once:true});
      }
      return;
    }
    if (!dialog) create();
    if (dialog.open) return;
    const mapTrigger=document.querySelector('[data-place-id="the-kloset"]');
    opener=mapTrigger||document.activeElement;
    window.closePanels?.();
    if (typeof selected !== 'undefined') selected=place;
    if (typeof visited !== 'undefined') visited.add(place);
    window.KLandSelectPlace?.(place);window.KLandRefreshVisits?.();window.kuSetPlaceHash?.(place);
    if (focus && typeof DATA !== 'undefined') {
      const p=DATA.locations.find(p=>p.id===place), pos=window.mapPos(p);
      window.focusXY(pos.x,pos.y,Math.max(state.min*1.55,innerWidth<=820?.9:.82),true);
    }
    dialog.showModal();$('.kl-close').focus({preventScroll:true});load();
  }
  window.showPlace=function(id,focus,...rest) {
    if (id===place) return openArchive(focus);
    return originalShowPlace.call(this,id,focus,...rest);
  };
  window.addEventListener('keydown', e=>{
    if (!dialog?.open) return;
    if (e.key==='Escape') {e.preventDefault();e.stopImmediatePropagation();dialog.close();return;}
    if (e.key==='ArrowLeft' || e.key==='ArrowRight') {
      e.preventDefault();e.stopImmediatePropagation();
      const dir=e.key==='ArrowLeft'?-1:1; go(index+dir,dir);
    }
  },true);
})();
