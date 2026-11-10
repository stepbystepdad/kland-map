/* Public Squarespace shell for the Cloudflare-hosted K Land app. */
(() => {
  const APP_ORIGIN='https://kland-kevinsilvester.pages.dev';
  const frame=document.getElementById('kland-app-frame');if(!frame)return;
  document.body.append(frame);
  const paths=new Set(['/k-land-arrivals','/silvie-museum-submissions','/k-land-signup','/town-hall/town-hall']);
  const keys=['ku-v2-visited','kland-nuttin-best-v1','kland-nuttin-name-v1','kland-nuttin-visitor-v1','kland-nuttin-board-log-v1'];
  const forms=new Map();
  function send(data){frame.contentWindow.postMessage(data,APP_ORIGIN);}
  function create(id,path,title){
    if(forms.has(id)||!paths.has(path)||!/^form-\d+$/.test(id))return;
    const form=document.createElement('iframe');form.title=title||'K Land form';form.loading='eager';
    form.style.cssText='position:fixed;z-index:2147483000;border:0;visibility:hidden;pointer-events:none;background:#100b10';form.inert=true;
    form.addEventListener('load',()=>{send({type:'kland-form-loaded',id});form.contentWindow.postMessage({type:'kland-form-status-request'},location.origin);});
    forms.set(id,form);document.body.append(form);form.src=path+'?kland-embed=1';
  }
  addEventListener('message',event=>{
    if(event.source===frame.contentWindow&&event.origin===APP_ORIGIN){
      const d=event.data;if(!d||typeof d!=='object')return;
      if(d.type==='kland-shell-ready'){const values={};try{for(const k of keys)values[k]=localStorage.getItem(k);}catch{}send({type:'kland-shell-state',values});}
      if(d.type==='kland-shell-save'){try{for(const key of keys)if(typeof d.values?.[key]==='string'&&d.values[key].length<12000)localStorage.setItem(key,d.values[key]);}catch{}}
      if(d.type==='kland-hash'&&typeof d.hash==='string'&&/^#place=[a-z0-9-]+$|^$/.test(d.hash))history.replaceState(null,'',location.pathname+location.search+d.hash);
      if(d.type==='kland-form-create')create(d.id,d.path,d.title);
      if(d.type==='kland-form-refresh'){const form=forms.get(d.id);form?.contentWindow.postMessage({type:'kland-form-refresh'},location.origin);}
      if(d.type==='kland-form-layout'&&Array.isArray(d.layout)){
        const rect=frame.getBoundingClientRect();
        for(const item of d.layout){const form=forms.get(item.id);if(!form)continue;
          const valid=[item.x,item.y,item.width,item.height,...(item.clip||[])].every(v=>Number.isFinite(v)&&Math.abs(v)<20000);
          const active=item.active&&valid;form.inert=!active;form.setAttribute('aria-hidden',String(!active));
          Object.assign(form.style,{visibility:active?'visible':'hidden',pointerEvents:active?'auto':'none'});
          if(active)Object.assign(form.style,{left:(rect.left+item.x)+'px',top:(rect.top+item.y)+'px',width:item.width+'px',height:item.height+'px',clipPath:'inset('+item.clip.map(v=>v+'px').join(' ')+' round 10px)'});
        }
      }
      return;
    }
    if(event.origin===location.origin&&event.data?.type==='kland-form-status')for(const [id,form] of forms)if(event.source===form.contentWindow)send({type:'kland-form-busy',id,busy:!!event.data.busy});
  });
  frame.src=APP_ORIGIN+'/'+location.hash;
})();
