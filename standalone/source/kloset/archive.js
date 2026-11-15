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

  function centerRack(animate = false, steps = 0) {
    const rack = $('.kl-rack'), track = $('.kl-rack-track');
    if (!looks?.length || !rack.clientWidth) return;
    const active = track.children[looks.length+index];
    const before = track.getBoundingClientRect().left;
    track.getAnimations().forEach(animation => animation.cancel());
    const drift = before-track.getBoundingClientRect().left;
    const step = active.offsetWidth + parseFloat(getComputedStyle(track).columnGap);
    const left = rack.scrollLeft + active.getBoundingClientRect().left -
      rack.getBoundingClientRect().left - (rack.clientWidth-active.offsetWidth)/2;
    rack.scrollTo({left, behavior:'auto'});
    if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const limit = looks.length*step/2;
      const distance = Math.max(-limit, Math.min(limit, drift+steps*step));
      track.animate([
        {transform:'translateX('+distance+'px)'},
        {transform:'translateX(0)'}
      ], {duration:340, easing:'cubic-bezier(.22,.61,.36,1)'});
    }
  }

  function create() {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = root + 'archive.css';
    document.head.append(css);
    dialog = document.createElement('dialog');
    dialog.id = 'kl-archive';
    dialog.setAttribute('aria-labelledby', 'kl-title');
    dialog.innerHTML = `
      <div class="kl-shell">
        <header class="kl-header">
          <span class="kl-count"></span>
          <div class="kl-cartouche"><h1 id="kl-title">The Kloset</h1></div>
          <button class="kl-close" aria-label="Close The Kloset">×</button>
        </header>
        <div class="kl-status" role="status">Opening the wardrobe…</div>
        <div class="kl-body" hidden>
          <div class="kl-spread">
            <section class="kl-stage" aria-label="Collectible outfit card">
              <div class="kl-rail" aria-hidden="true"></div>
              <div class="kl-garments" aria-hidden="true">
                <span class="kl-hanging kl-left"><i></i></span>
                <span class="kl-hanging kl-right"><i></i></span>
              </div>
              <div class="kl-card">
                <div class="kl-window">
                  <img class="kl-sprite" alt="" draggable="false">
                  <div class="kl-lockscreen" role="status" hidden>
                    <span class="kl-lock-icon" aria-hidden="true"></span>
                    <span>Coming soon</span>
                  </div>
                </div>
                <div class="kl-nameplate"><span class="kl-project"></span><h2 class="kl-name"></h2></div>
              </div>
              <button class="kl-arrow kl-prev" aria-label="Previous outfit">‹</button>
              <button class="kl-arrow kl-next" aria-label="Next outfit">›</button>
            </section>
            <section class="kl-door" aria-label="Spotted in" hidden>
              <div class="kl-memoryhead"><h3>Spotted in…</h3><div class="kl-memnav"></div></div>
              <figure class="kl-polaroid"><div class="kl-photo"></div><figcaption></figcaption></figure>
              <div class="kl-links"></div>
            </section>
          </div>
          <div class="kl-drawer">
            <nav class="kl-rack" aria-label="Jump to an outfit"><div class="kl-rack-track"></div></nav>
          </div>
        </div>
        <span class="kl-sr" aria-live="polite" aria-atomic="true"></span>
      </div>`;
    document.body.append(dialog);
    new ResizeObserver(() => centerRack()).observe($('.kl-rack'), {box:'border-box'});
    $('.kl-close').onclick = () => dialog.close();
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => {
      ++renderToken;
      dialog.querySelectorAll('.kl-sprite-outgoing').forEach(image => image.remove());
      $('.kl-sprite').getAnimations().forEach(animation => animation.cancel());
      $('.kl-sprite').hidden = looks?.[index]?.locked === true;
      window.kuSetPlaceHash?.('');
      if (typeof selected !== 'undefined' && selected === place) {
        selected = null; window.KLandSelectPlace?.('');
      }
      if (opener?.isConnected) opener.focus({preventScroll:true});
    });
    $('.kl-prev').onclick = () => go(index-1, -1);
    $('.kl-next').onclick = () => go(index+1, 1);
    const stage = $('.kl-stage');
    for (const surface of [stage, $('.kl-rack')]) {
      let start = null, swiped = false;
      surface.addEventListener('pointerdown', e => {
        if (!e.isPrimary || e.button !== 0 || (surface === stage && e.target.closest('button'))) return;
        start = {x:e.clientX, y:e.clientY, id:e.pointerId};
        swiped = false;
        if (surface === stage) surface.setPointerCapture(e.pointerId);
      });
      surface.addEventListener('pointercancel', () => { start = null; });
      surface.addEventListener('pointerup', e => {
        if (!start || e.pointerId !== start.id) return;
        const dx = e.clientX-start.x, dy = e.clientY-start.y;
        start = null;
        if (Math.abs(dx) > 38 && Math.abs(dx) > 1.35*Math.abs(dy)) {
          swiped = true;
          const direction = dx < 0 ? 1 : -1;
          go(index+direction, direction);
        }
      });
      surface.addEventListener('click', e => {
        if (!swiped) return;
        swiped = false;
        e.preventDefault();
        e.stopImmediatePropagation();
      }, true);
    }
  }

  function renderMemory(look) {
    const entries = look.locked ? [] : [...(look.photos || []), ...(look.videos || [])].filter(m => m.image || m.url);
    const door = $('.kl-door'), pager = $('.kl-memnav');
    const links = look.locked ? [] : (look.links || []).filter(item => item.url);
    door.hidden = !entries.length && !links.length;
    $('.kl-spread').classList.toggle('kl-solo', door.hidden);
    $('.kl-memoryhead').hidden = !entries.length;
    $('.kl-polaroid').hidden = !entries.length;
    pager.replaceChildren();
    $('.kl-photo').replaceChildren();
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
    for (const item of links) {
      const link=document.createElement('a');link.href=item.url;link.textContent=item.label+' ↗';
      link.target='_blank';link.rel='noopener noreferrer';$('.kl-links').append(link);
    }
  }

  function go(n, direction=0) {
    if (!looks?.length) return;
    const steps = n-index;
    index=wrap(n,looks.length); memory=0;
    const look=looks[index], number=two(index+1), token=++renderToken;
    const locked = look.locked === true;
    $('.kl-lockscreen').hidden = !locked;
    $('.kl-name').textContent=look.name; $('.kl-project').textContent=look.era;
    $('.kl-count').textContent='LOOK '+number+' / '+two(looks.length);
    const sprite = $('.kl-sprite');
    sprite.getAnimations().forEach(animation => animation.cancel());
    dialog.querySelectorAll('.kl-sprite-outgoing').forEach(image => image.remove());
    let outgoing = null;
    if (!locked && direction && sprite.complete && sprite.naturalWidth &&
        !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      outgoing = sprite.cloneNode();
      outgoing.className = 'kl-sprite-outgoing';
      outgoing.hidden = false;
      outgoing.alt = '';
      outgoing.setAttribute('aria-hidden', 'true');
      sprite.after(outgoing);
    }
    sprite.hidden = locked || !!outgoing;
    if (locked) {
      sprite.alt = '';
      sprite.removeAttribute('src');
    } else {
      sprite.alt=look.description ? look.name+'. '+look.description : look.name+' outfit';
      sprite.src=url(look.sprite);
    }
    renderMemory(look);
    const track=$('.kl-rack-track');
    [...track.children].forEach((b,i)=>b.setAttribute('aria-current',String(i===looks.length+index)));
    centerRack(direction !== 0, steps);
    $('.kl-sr').textContent='Look '+(index+1)+' of '+looks.length+', '+look.name+', '+look.era+(locked?', Coming soon':'');
    if (locked) return;
    sprite.decode().catch(()=>{}).then(()=>{
      if (token !== renderToken) {
        outgoing?.remove();
        return;
      }
      sprite.hidden = false;
      if (outgoing) {
        const timing = {duration:340, easing:'cubic-bezier(.22,.61,.36,1)'};
        const exit = outgoing.animate([
          {transform:'translateX(0)', opacity:1},
          {transform:'translateX('+(-direction*115)+'%)', opacity:.5}
        ], timing);
        exit.finished.then(() => outgoing.remove(), () => outgoing.remove());
        sprite.animate([
          {transform:'translateX('+(direction*115)+'%)', opacity:.65},
          {transform:'translateX(0)', opacity:1}
        ], timing);
      }
      for (const off of [-1,1]) {
        const neighbour = looks[wrap(index+off,looks.length)];
        if (!neighbour.locked) {
          const image = new Image();
          image.src = url(neighbour.sprite);
        }
      }
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
        for (let copy=0; copy<3; copy++) {
          for (const [i,look] of looks.entries()) {
            const position = copy*looks.length+i;
            const label = look.name+(look.locked?' — Coming soon':'');
            const b=button('Show '+label,'',()=>{
              const steps = position-(looks.length+index);
              go(index+steps, Math.sign(steps));
            });
            b.title=label;
            b.dataset.outfit=String(i);
            if (copy !== 1) {
              b.setAttribute('aria-hidden','true');
              b.tabIndex=-1;
              b.addEventListener('pointerdown', e => e.preventDefault());
            }
            if (look.locked) {
              const lock = document.createElement('span');
              lock.className = 'kl-lock-icon';
              lock.setAttribute('aria-hidden', 'true');
              b.classList.add('kl-locked-tab');
              b.append(lock);
            } else {
              const image=new Image();image.alt='';image.draggable=false;image.loading='lazy';image.src=url(look.thumbnail);
              b.append(image);
            }
            $('.kl-rack-track').append(b);
          }
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
