/* Keep mobile controls on the pointer release path, without waiting for a
 * compatibility click. Native mouse and keyboard activation stay intact. */
(() => {
  document.documentElement.dataset.mobileControls = '20261110-v1';
  const targetOf = node => node?.closest?.('#app > .nav button,.fountain-home');
  const pointers = new Set();
  let press = null, lastTap = null;
  const reset = () => { pointers.clear(); press = null; };
  document.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') return;
    pointers.add(event.pointerId);
    const target = targetOf(event.target);
    press = pointers.size === 1 && event.isPrimary !== false && target && !target.closest('[inert]')
      ? {id:event.pointerId, target, x:event.clientX, y:event.clientY} : null;
  }, {capture:true, passive:true});
  document.addEventListener('pointermove', event => {
    if (press?.id === event.pointerId && Math.hypot(event.clientX-press.x,event.clientY-press.y) >= 10) press = null;
  }, {capture:true, passive:true});
  document.addEventListener('pointerup', event => {
    const tap = press; press = null; pointers.delete(event.pointerId);
    if (!tap || tap.id !== event.pointerId || pointers.size ||
        Math.hypot(event.clientX-tap.x,event.clientY-tap.y) >= 10 ||
        targetOf(event.target) !== tap.target || tap.target.closest('[inert]') ||
        (tap.target.matches('.fountain-home') && moved)) return;
    event.preventDefault();
    lastTap = {target:tap.target, time:performance.now()};
    tap.target.click();
    document.documentElement.dataset.mobileControl = tap.target.dataset.panel || 'homepage';
  }, {capture:true, passive:false});
  document.addEventListener('pointercancel', event => {pointers.delete(event.pointerId);press=null;}, {capture:true, passive:true});
  document.addEventListener('click', event => {
    if (!event.isTrusted || event.detail === 0 || !lastTap ||
        performance.now()-lastTap.time > 800 || targetOf(event.target) !== lastTap.target) return;
    event.preventDefault(); event.stopImmediatePropagation(); lastTap = null;
  }, true);
  addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => {if(document.hidden)reset();});

  const fountain = document.querySelector('.fountain-home');
  if (fountain) {
    fountain.style.setProperty('--fountain-x',(parseFloat(fountain.style.left)+parseFloat(fountain.style.width)/2)+'px');
    fountain.style.setProperty('--fountain-y',(parseFloat(fountain.style.top)+parseFloat(fountain.style.height)/2)+'px');
  }
  const style = document.createElement('style');
  style.textContent = `
    #app > .nav,#app > .nav button{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
    @media(max-width:820px),(pointer:coarse),(max-height:600px){
      #world .fountain-home{left:var(--fountain-x)!important;top:var(--fountain-y)!important;width:max(112px,calc(48px / var(--map-scale)))!important;height:max(58.5px,calc(48px / var(--map-scale)))!important;transform:translate(-50%,-50%);clip-path:none;touch-action:none}
      #world #spots .map-place-label[data-label-for="beach"]{transform:translateX(-50%) scale(clamp(.6,calc(var(--map-scale) * 1.7),1));transform-origin:50% 0}
    }`;
  document.head.append(style);
})();
