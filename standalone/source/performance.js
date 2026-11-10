// Optional diagnostics: measurements are exposed as DOM attributes, never sent.
(() => {
  const enabled = new URLSearchParams(location.search).has('diagnostics');
  if (!enabled) return;
  const stats = {longTasks:0, blockingMs:0, worstInteractionMs:0};
  let panel;
  function show() {
    if (!panel) return;
    Object.assign(panel.dataset, Object.fromEntries(Object.entries(stats).map(([k,v])=>[k,String(Math.round(v))])));
    panel.textContent = `Ready ${stats.readyMs ? (stats.readyMs/1000).toFixed(2)+'s' : '…'} · blocking ${Math.round(stats.blockingMs)}ms · worst input ${Math.round(stats.worstInteractionMs)}ms`;
  }
  try { new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {stats.longTasks++;stats.blockingMs+=Math.max(0,entry.duration-50);}
    show();
  }).observe({type:'longtask',buffered:true}); } catch {}
  try { new PerformanceObserver(list => {
    for (const entry of list.getEntries()) if(entry.interactionId) stats.worstInteractionMs=Math.max(stats.worstInteractionMs,entry.duration);
    show();
  }).observe({type:'event',durationThreshold:16,buffered:true}); } catch {}
  document.addEventListener('DOMContentLoaded',()=>{
    panel=document.createElement('output');panel.id='kland-diagnostics';
    panel.style.cssText='position:fixed;top:0;left:0;z-index:2147483647;background:#141016;color:#fff;font:11px monospace;padding:5px;pointer-events:none';
    document.body.append(panel);
    const loader=document.getElementById('kland-loading');
    const observer=new MutationObserver(()=>{
      if(loader.dataset.renderReady==='true'&&!stats.readyMs){stats.readyMs=performance.now();show();}
    });observer.observe(loader,{attributes:true,attributeFilter:['data-render-ready']});
    if(loader.dataset.renderReady==='true')stats.readyMs=performance.now();
    show();
  });
})();
