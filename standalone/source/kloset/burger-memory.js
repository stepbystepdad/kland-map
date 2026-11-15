/* Add a click-to-play memory to the existing losing overlay; gameplay stays native. */
(() => {
  'use strict';
  const css = document.createElement('style');
  css.textContent = `
    #nb-game .nb-overlay.nb-with-memory {overflow:hidden;padding:12px;box-sizing:border-box}
    #nb-game .nb-card.nb-has-loss-video {box-sizing:border-box;max-width:460px;max-height:100%;overflow:auto;overscroll-behavior:contain;padding:18px 20px;scrollbar-gutter:stable}
    #nb-game .nb-card.nb-has-loss-video h2 {margin:6px 0 8px;font-size:clamp(23px,3vw,31px)}
    #nb-game .nb-card.nb-has-loss-video p {margin-bottom:10px}
    #nb-game .nb-card.nb-has-loss-video > .nb-primary {position:static;display:block;margin:0 auto 5px;min-height:44px}
    #nb-game .nb-loss-memory {display:flex;flex-direction:column;align-items:center;gap:10px;margin:12px 0 14px}
    #nb-game .nb-loss-memory .nb-loss-copy {max-width:43ch;margin:0;font-size:13px;line-height:1.45}
    #nb-game .nb-loss-player {box-sizing:border-box;flex:none;aspect-ratio:16/9;width:100%;background:#241824;border:2px solid #241824;border-radius:12px;overflow:hidden}
    #nb-game .nb-loss-cover {position:relative;display:block;width:100%;height:100%;padding:0;border:0;background:#241824;color:#fff8ee}
    #nb-game .nb-loss-cover img {display:block;width:100%;height:100%;object-fit:contain}
    #nb-game .nb-loss-cover span {box-sizing:border-box;position:absolute;left:50%;bottom:12px;transform:translateX(-50%);max-width:calc(100% - 20px);min-height:44px;display:flex;align-items:center;justify-content:center;border:2px solid #241824;border-radius:10px;background:#f32982;padding:10px 16px;font-weight:800;font-size:14px;line-height:1.2;box-shadow:0 3px #a30f57}
    #nb-game .nb-loss-player iframe {display:block;width:100%;height:100%;border:0}
    #nb-game .nb-loss-external {display:inline-flex;align-items:center;justify-content:center;min-height:44px;color:#701d35;font-size:13px;font-weight:800}
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
    const copy=document.createElement('p');copy.className='nb-loss-copy';copy.textContent='Watch the BAD OMEN music video to find out how the others were taken out at Nuttin’ Burger.';
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
    const external=document.createElement('a');external.className='nb-loss-external';external.href='https://www.youtube.com/watch?v=DPjcQLbagwY';external.target='_blank';external.rel='noopener';external.textContent='Watch on YouTube ↗';
    section.append(copy,player,external);card.insertBefore(section,card.querySelector('.nb-primary'));
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
