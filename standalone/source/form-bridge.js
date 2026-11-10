/* The Squarespace shell owns its same-origin forms. The Cloudflare app sends
 * geometry only; form values and submissions stay in Squarespace. */
(() => {
  const paths=new Set(['/k-land-arrivals','/silvie-museum-submissions','/k-land-signup','/town-hall/town-hall']);
  let hostOrigin='';try{hostOrigin=new URL(document.referrer).origin;}catch{}
  const hosted=parent!==window&&['https://www.kevinsilvester.com','https://kevinsilvester.com','https://sealion-brass-7gea.squarespace.com'].includes(hostOrigin);
  const frames=new Map();let serial=0,queued=0,last='';
  const send=data=>{if(hosted)parent.postMessage(data,hostOrigin);};
  const storageKeys=['ku-v2-visited','kland-nuttin-best-v1','kland-nuttin-name-v1','kland-nuttin-visitor-v1','kland-nuttin-board-log-v1'];
  let incoming=null;
  function importState(values){
    if(!values||localStorage.getItem('kland-shell-imported-v1'))return;
    for(const key of storageKeys){const value=values[key];if(typeof value!=='string'||value.length>12000)continue;
      if(key==='ku-v2-visited'){try{const merged=[...new Set([...JSON.parse(localStorage.getItem(key)||'[]'),...JSON.parse(value)])];localStorage.setItem(key,JSON.stringify(merged));if(typeof visited!=='undefined'){merged.forEach(id=>visited.add(id));persist();renderPlaces('all');}}catch{}}
      else if(key==='kland-nuttin-best-v1')localStorage.setItem(key,String(Math.max(Number(value)||0,Number(localStorage.getItem(key))||0)));
      else if(!localStorage.getItem(key))localStorage.setItem(key,value);
    }
    localStorage.setItem('kland-shell-imported-v1','true');
  }
  function update(){queued=0;const layout=[];
    for(const [id,frame] of frames){
      if(!frame.isConnected){layout.push({id,active:false});continue;}
      const r=frame.getBoundingClientRect(),style=getComputedStyle(frame),panel=document.getElementById('panel-story'),p=panel?.getBoundingClientRect();
      const card=frame.closest('.kland-popup-view'),portal=frame.closest('.kland-form-portal');
      const active=!!p&&panel.classList.contains('open')&&document.getElementById('kland-loading')?.hidden===true&&style.visibility!=='hidden'&&(!card||!card.hidden)&&(!portal||portal.getAttribute('aria-hidden')!=='true')&&r.width>0&&r.height>0;
      const top=p?Math.max(0,p.top+56-r.top):0,bottom=p?Math.max(0,r.bottom-p.bottom+2):0,left=p?Math.max(0,p.left+2-r.left):0,right=p?Math.max(0,r.right-p.right+2):0;
      layout.push({id,active,path:frame.dataset.formPath,title:frame.title,x:r.x,y:r.y,width:r.width,height:r.height,clip:[top,right,bottom,left]});
    }
    const data=JSON.stringify(layout);if(data!==last){last=data;send({type:'kland-form-layout',layout});}
  }
  function schedule(){if(!queued)queued=requestAnimationFrame(update);}
  window.KLandSetFormSource=(frame,url)=>{
    const parsed=new URL(url,location.href);if(!paths.has(parsed.pathname))throw Error('Unknown form');
    if(!frame.dataset.formId){frame.dataset.formId='form-'+(++serial);frames.set(frame.dataset.formId,frame);new ResizeObserver(schedule).observe(frame);}
    frame.dataset.formPath=parsed.pathname;
    frame.dataset.formBusy='false';
    if(hosted){frame.src='about:blank';send({type:'kland-form-create',id:frame.dataset.formId,path:parsed.pathname,title:frame.title});}
    else {
      // A direct app preview offers a working link instead of a blocked iframe.
      const box=document.createElement('div');box.className='kland-external-form';box.style.cssText='padding:20px;border:1px solid #634052;border-radius:12px;background:#211720;color:#f8edf3';
      const text=document.createElement('p');text.textContent='Open the secure form on Kevin’s website.';
      const link=document.createElement('a');link.href='https://www.kevinsilvester.com'+parsed.pathname;link.target='_blank';link.rel='noopener';link.textContent='Open '+(parsed.pathname.includes('museum')?'art submission':parsed.pathname.includes('arrivals')?'airport check-in':parsed.pathname.includes('signup')?'newsletter signup':'Town Hall')+' ↗';link.style.color='#ff9ecb';box.append(text,link);
      queueMicrotask(()=>{frame.after(box);frame.hidden=true;frame.dataset.preloaded='true';frame.dispatchEvent(new Event('kland-form-ready'));});
    }
    schedule();
  };
  window.KLandRefreshForm=frame=>send({type:'kland-form-refresh',id:frame.dataset.formId});
  addEventListener('message',event=>{
    if(!hosted||event.source!==parent||event.origin!==hostOrigin)return;
    const data=event.data;
    if(data?.type==='kland-shell-state'){incoming=data.values;if(document.readyState!=='loading')try{importState(incoming);}catch{}}
    const frame=frames.get(data?.id);if(!frame)return;
    if(data.type==='kland-form-loaded'){frame.dataset.preloaded='true';frame.dispatchEvent(new Event('kland-form-ready'));schedule();}
    if(data.type==='kland-form-busy')frame.dataset.formBusy=String(!!data.busy);
  });
  document.addEventListener('DOMContentLoaded',()=>{
    try{importState(incoming);}catch{}
    const observer=new MutationObserver(schedule);
    for(const panel of document.querySelectorAll('.panel'))observer.observe(panel,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
    for(const portal of document.querySelectorAll('.kland-form-portal'))observer.observe(portal,{attributes:true,attributeFilter:['style','aria-hidden']});
    observer.observe(document.getElementById('kland-loading'),{attributes:true,attributeFilter:['hidden']});
    schedule();
  });
  document.addEventListener('scroll',schedule,true);addEventListener('resize',schedule);visualViewport?.addEventListener('resize',schedule);
  addEventListener('pagehide',()=>{const values={};try{for(const k of storageKeys)values[k]=localStorage.getItem(k);send({type:'kland-shell-save',values});}catch{}});
  send({type:'kland-shell-ready'});
})();
