/* Add a click-to-play memory to the existing losing overlay; gameplay stays native. */
(() => {
  'use strict';
  const css = document.createElement('style');
  css.textContent = `
    #nb-game .nb-overlay.nb-with-memory {overflow:auto;padding:12px}
    #nb-game .nb-card.nb-has-loss-video {max-width:500px;max-height:100%;overflow:auto;padding:18px 20px}
    #nb-game .nb-card.nb-has-loss-video h2 {margin:6px 0 8px;font-size:clamp(23px,3vw,31px)}
    #nb-game .nb-card.nb-has-loss-video p {margin-bottom:10px}
    #nb-game .nb-card.nb-has-loss-video > .nb-primary {position:sticky;bottom:0;z-index:2}
    #nb-game .nb-loss-memory {margin:12px 0 16px}
    #nb-game .nb-loss-memory h3 {font-size:13px;letter-spacing:.04em;margin:0 0 8px;color:#701d35}
    #nb-game .nb-loss-player {aspect-ratio:16/9;width:100%;background:#241824;border:2px solid #241824;border-radius:12px;overflow:hidden}
    #nb-game .nb-loss-cover {position:relative;display:block;width:100%;height:100%;padding:0;border:0;background:#241824;color:#fff8ee}
    #nb-game .nb-loss-cover img {display:block;width:100%;height:100%;object-fit:contain}
    #nb-game .nb-loss-cover span {position:absolute;left:50%;bottom:10px;transform:translateX(-50%);min-height:44px;display:flex;align-items:center;justify-content:center;white-space:nowrap;border:2px solid #241824;border-radius:10px;background:#f32982;padding:10px 16px;font-weight:800;font-size:14px;box-shadow:0 3px #a30f57}
    #nb-game .nb-loss-player iframe {display:block;width:100%;height:100%;border:0}
    @media(max-width:600px){#nb-game .nb-card.nb-has-loss-video{padding:14px 12px}#nb-game .nb-loss-memory{margin:10px 0 12px}}
  `;
  document.head.append(css);
  let current, observer;
  function sync() {
    if (!current) return;
    const overlay=current.querySelector('.nb-overlay'),card=overlay?.querySelector('.nb-card');
    if (!card) return;
    const losing=!overlay.hidden && card.querySelector('h2')?.textContent === 'You’re cooked.';
    const existing=card.querySelector('.nb-loss-memory');
    if (!losing) {
      existing?.remove();card.classList.remove('nb-has-loss-video');overlay.classList.remove('nb-with-memory');return;
    }
    if (existing) return;
    card.classList.add('nb-has-loss-video');overlay.classList.add('nb-with-memory');
    const section=document.createElement('section');section.className='nb-loss-memory';section.setAttribute('aria-label','BAD OMEN music video');
    const heading=document.createElement('h3');heading.textContent='BAD OMEN · Official music video';
    const player=document.createElement('div');player.className='nb-loss-player';
    const cover=document.createElement('button');cover.type='button';cover.className='nb-loss-cover';cover.setAttribute('aria-label','Play BAD OMEN official music video');
    const image=new Image();image.src='/kloset/bad-omen-video-cover.webp';image.alt='K and his co-star facing each other in the BAD OMEN music video';image.decoding='async';
    const label=document.createElement('span');label.textContent='▶ Watch BAD OMEN';cover.append(image,label);player.append(cover);
    cover.onclick=()=>{
      const iframe=document.createElement('iframe');iframe.title='BAD OMEN — Official music video';iframe.tabIndex=0;
      iframe.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';iframe.allowFullscreen=true;iframe.referrerPolicy='strict-origin-when-cross-origin';
      iframe.src='https://www.youtube-nocookie.com/embed/DPjcQLbagwY?autoplay=1&playsinline=1&rel=0';
      iframe.onload=()=>iframe.focus();player.replaceChildren(iframe);
    };
    section.append(heading,player);card.insertBefore(section,card.querySelector('.nb-primary'));
  }
  function attach() {
    const game=document.getElementById('nb-game');
    if (game===current) return;
    observer?.disconnect();current=game;
    if (game) {
      observer=new MutationObserver(sync);
      observer.observe(game.querySelector('.nb-overlay'),{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
      sync();
    }
  }
  new MutationObserver(attach).observe(document.body,{childList:true});attach();
})();
