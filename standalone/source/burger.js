
/* Nuttin' Burger v0.7 — isolated draft. No dependencies. Assets injected by build. */
function installNuttinBurger(win, assets) {
  'use strict';
  if (win.NuttinBurger) return;
  const doc=win.document;
  const CFG={speed:168,spawnEvery:.62,catchWidth:53,moveSpeed:1800,stackGap:12,lives:3,points:100,hazardChance:.17,kChance:.035,kPoints:500,heartSeconds:3};
  const FOODS={"bun":{"label":"Top bun","rect":[16,65,500,250],"h":45},"base":{"label":"Bottom bun","rect":[524,84,485,230],"h":28},"patty":{"label":"Patty","rect":[1022,70,506,252],"h":30},"cheese":{"label":"Cheese","rect":[17,380,499,250],"h":20},"lettuce":{"label":"Lettuce","rect":[521,370,507,254],"h":24},"tomato":{"label":"Tomato","rect":[1033,380,483,258],"h":24},"onion":{"label":"Onion","rect":[18,678,499,262],"h":18},"pickles":{"label":"Pickles","rect":[531,680,486,267],"h":18},"sauce":{"label":"Sauce","rect":[1029,679,500,264],"h":16}};
  const HAZARDS=[{"id":"socks","label":"crusty socks","rect":[10,132,306,407]},{"id":"jocks","label":"dirty jocks","rect":[317,174,356,350]},{"id":"wash","label":"ten-in-one wash","rect":[675,92,220,440]},{"id":"chair","label":"a camping chair","rect":[896,161,327,374],"size":112},{"id":"tv","label":"a broken TV","rect":[1223,126,312,409],"size":120},{"id":"pizza","label":"mouldy pizza","rect":[9,540,330,391]},{"id":"plant","label":"a dying plant","rect":[340,539,282,396],"clip":[[340,539],[622,539],[622,692],[600,730],[602,935],[340,935]]},{"id":"weights","label":"gym weights","rect":[602,620,341,293],"clip":[[663,620],[943,620],[943,786],[937,791],[930,800],[920,810],[905,820],[896,826],[860,830],[852,913],[602,913],[602,738]]},{"id":"towel","label":"a dirty towel","rect":[916,552,341,396],"clip":[[959,552],[1257,552],[1257,948],[916,948],[916,817],[923,802],[946,802],[946,749],[957,723]]},{"id":"loofah","label":"a dirty loofah","rect":[1256,566,279,390]}];
  let direction=1,runClock=0,heartTime=0,deathTime=0,deathReason='';
  const types=['patty','cheese','lettuce','tomato','onion','pickles','sauce'];
  let needsPaint=true,mapGate=null;
  let root,canvas,ctx,raf=0,previous=0,active=false,mode='intro',W=800,H=600,player=400,target=400,items=[],stack=[],particles=[],keys=new Set(),level=1,score=0,lives=3,seq=[],stepIdx=0,spawnClock=0,elapsed=0,lastFocus,best=0,resizeObserver,loading;
  try{best=Number(win.localStorage.getItem('kland-nuttin-best-v1'))||0;}catch(e){}
  const atlas=new win.Image(),josh=new win.Image();atlas.crossOrigin='anonymous';atlas.src=assets.ingredients;josh.src=assets.josh;
  const hazards=new win.Image(),animation=new win.Image(),kBonus=new win.Image(),kitchen=new win.Image(),runSheet=new win.Image();
  hazards.src=assets.hazards;animation.src=assets.animation;kBonus.src=assets.k;kitchen.src=assets.kitchen;runSheet.src=assets.run;
  const foodSprites=new Map();
  function prepareFoodSprites(){for(const [type,food] of Object.entries(FOODS)){const [sx,sy,sw,sh]=food.rect,raw=doc.createElement('canvas');raw.width=sw;raw.height=sh;const rc=raw.getContext('2d',{willReadFrequently:true});rc.drawImage(atlas,sx,sy,sw,sh,0,0,sw,sh);let x0=0,y0=0,x1=sw-1,y1=sh-1;try{const p=rc.getImageData(0,0,sw,sh).data;let ax=sw,ay=sh,bx=-1,by=-1;for(let y=0;y<sh;y++)for(let x=0;x<sw;x++)if(p[(y*sw+x)*4+3]>8){ax=Math.min(ax,x);ay=Math.min(ay,y);bx=Math.max(bx,x);by=Math.max(by,y);}if(bx>=ax){x0=Math.max(0,ax-1);y0=Math.max(0,ay-1);x1=Math.min(sw-1,bx+1);y1=Math.min(sh-1,by+1);}}catch(e){}const crop=doc.createElement('canvas');crop.width=x1-x0+1;crop.height=y1-y0+1;crop.getContext('2d').drawImage(raw,x0,y0,crop.width,crop.height,0,0,crop.width,crop.height);foodSprites.set(type,crop);}}
  loading=Promise.all([atlas.decode(),josh.decode(),hazards.decode(),animation.decode(),kBonus.decode(),kitchen.decode(),runSheet.decode()]).then(prepareFoodSprites);loading.catch(()=>{});

  const css=`  #nb-game{position:fixed;inset:0;z-index:2147483000;background:rgba(26,16,32,.62);display:grid;place-items:center;padding:18px;font-family:"Work Sans","Trebuchet MS",Arial,sans-serif;color:#241824;touch-action:manipulation}
  #nb-game *{box-sizing:border-box}
  #nb-game button{font:inherit;cursor:pointer;color:inherit;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
  #nb-game .nb-tool:disabled{opacity:.45;cursor:default;transform:none}
  #app[data-nb-game-paused] *{animation-play-state:paused!important}
  #nb-game button:focus-visible{outline:3px solid #f32982;outline-offset:3px}
  #nb-game .nb-shell{width:min(1120px,100%);height:min(740px,100%);background:#fff8ee;border:2px solid #241824;border-radius:22px;overflow:hidden;box-shadow:0 18px 0 rgba(243,41,130,.30);display:flex;flex-direction:column}
  #nb-game .nb-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 20px;background:#241824;color:#fff3f7;border-bottom:2px solid #241824;flex-shrink:0}
  #nb-game .nb-brand{font-family:"Dela Gothic One","Arial Black",Arial,sans-serif;font-size:21px;letter-spacing:.2px;line-height:1;display:flex;align-items:center;gap:11px}
  #nb-game .nb-mark{display:grid;place-items:center;width:36px;height:36px;border-radius:11px;background:#f32982;color:#fff;font-size:18px;flex-shrink:0;box-shadow:0 3px 0 #a30f57}
  #nb-game .nb-brandtext{display:block}
  #nb-game .nb-brand small{display:block;font-family:"Work Sans",Arial,sans-serif;font-weight:800;font-size:9.5px;letter-spacing:2.4px;margin-top:6px;color:#ff9fca}
  #nb-game .nb-toolbar{display:flex;gap:8px}
  #nb-game .nb-tool{border:1.5px solid rgba(255,159,202,.5);border-radius:11px;background:#3a2740;color:#fff3f7;padding:9px 14px;font-size:12.5px;font-weight:700;min-height:44px;min-width:44px;transition:background .12s ease,transform .12s ease}
  @media(hover:hover) and (pointer:fine){#nb-game .nb-tool:hover{background:#4c3357}}
  #nb-game .nb-tool:active{transform:translateY(1px)}
  #nb-game .nb-main{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);flex:1;min-height:0}
  #nb-game .nb-ticket{background:#fff3f7;border-right:0;border-bottom:2px solid rgba(36,24,36,.14);padding:10px 18px 12px;display:grid;grid-template-columns:auto auto minmax(0,1fr) auto;grid-template-rows:auto auto auto;align-items:center;gap:0 20px;overflow:hidden;touch-action:pan-x pan-y}
  #nb-game .nb-ticket h3{grid-column:1;grid-row:1;font-family:"Dela Gothic One",Arial,sans-serif;font-size:10px;letter-spacing:2px;margin:0;color:#c91965}
  #nb-game .nb-order{grid-column:1;grid-row:2;font-family:"Dela Gothic One",Arial,sans-serif;font-size:20px;line-height:1.1;margin:0;color:#241824}
  #nb-game .nb-list{grid-column:1/-1;grid-row:3;display:flex;flex-direction:row;gap:7px;padding:9px 0 0;margin-top:9px;border-top:2px dashed rgba(243,41,130,.34);border-bottom:0;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;touch-action:pan-x;overscroll-behavior-x:contain}
  #nb-game .nb-list::-webkit-scrollbar{display:none}
  #nb-game .nb-list.nb-more{mask-image:linear-gradient(90deg,#000 calc(100% - 34px),transparent);-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 34px),transparent)}
  #nb-game .nb-food{display:flex;flex:0 0 auto;align-items:center;gap:9px;font-size:13px;font-weight:700;min-height:38px;white-space:nowrap;color:#3a2530;border:1.5px solid transparent;border-radius:12px;padding:4px 10px}
  #nb-game .nb-food canvas{width:54px;height:32px;flex-shrink:0;filter:drop-shadow(0 2px 0 rgba(36,24,36,.10))}
  #nb-game .nb-food b{margin-left:auto;font-size:13px;font-weight:800;background:#fff;border:1.5px solid rgba(36,24,36,.16);border-radius:8px;padding:3px 8px}
  #nb-game .nb-food.done{color:#7d6070}#nb-game .nb-food.done span{text-decoration:line-through}#nb-game .nb-food.now{background:#fff3f7;border-color:#f32982;box-shadow:0 0 0 2px rgba(243,41,130,.18)}
  #nb-game .nb-food.done b{background:#f32982;border-color:#c91965;color:#fff}
  #nb-game .nb-note{display:none}
  #nb-game .nb-label{grid-column:2;grid-row:1;font-family:"Dela Gothic One",Arial,sans-serif;font-size:9.5px;letter-spacing:1.6px;color:#c91965}
  #nb-game .nb-score{grid-column:2;grid-row:2;font-family:"Dela Gothic One",Arial,sans-serif;margin:0;font-size:24px;color:#241824}
  #nb-game .nb-lives{grid-column:3;grid-row:1/3;display:flex;justify-content:flex-start;align-items:center;gap:10px;color:#f32982;font-size:30px;line-height:1;margin:0}
  #nb-game .nb-best{grid-column:4;grid-row:1/3;max-width:160px;text-align:right}
  #nb-game .nb-heart{font-size:inherit}#nb-game .nb-heart.lost{color:#e8ccd8}
  #nb-game .nb-best{font-size:10.5px;font-weight:700;letter-spacing:1px;color:#a98a99}
  #nb-game .nb-stage{position:relative;overflow:hidden;min-width:0;min-height:0;background:#f2dfe6}
  #nb-game .nb-canvas{display:block;width:100%;height:100%;touch-action:none;outline:none}
  #nb-game .nb-message{position:absolute;top:14px;left:50%;transform:translateX(-50%);background:#fff8ee;border:2px solid #241824;border-radius:999px;padding:8px 18px;font-size:12px;font-weight:800;text-align:center;max-width:92%;width:max-content;pointer-events:none;box-shadow:0 3px 0 rgba(243,41,130,.35)}
  #nb-game .nb-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(26,16,32,.5);padding:20px}
  #nb-game .nb-overlay[hidden]{display:none}
  #nb-game .nb-card{max-width:390px;width:100%;text-align:center;background:#fff8ee;border:2px solid #241824;border-radius:20px;padding:26px 24px;box-shadow:0 10px 0 rgba(243,41,130,.55)}
  #nb-game .nb-card .eyebrow{font-size:10px;letter-spacing:2.4px;color:#c91965;font-weight:800}
  #nb-game .nb-card h2{font-family:"Dela Gothic One",Arial,sans-serif;font-size:31px;letter-spacing:-.5px;line-height:1.05;margin:10px 0 12px;color:#241824}
  #nb-game .nb-card p{font-size:13.5px;line-height:1.55;margin:0 0 18px;color:#5a4450}
  #nb-game .nb-primary{border:2px solid #241824;border-radius:12px;background:#f32982;color:#fff;padding:13px 26px;font-size:14.5px;font-weight:800;box-shadow:0 4px 0 #a30f57;transition:transform .12s ease,background .12s ease}
  @media(hover:hover) and (pointer:fine){#nb-game .nb-primary:hover{background:#ff3d90}}
  #nb-game .nb-primary:active{transform:translateY(2px);box-shadow:0 2px 0 #a30f57}
  #nb-game .nb-primary:disabled{opacity:.5;box-shadow:none}
  #nb-game .nb-foot{padding:9px 16px;background:#241824;color:#ffd7e6;display:flex;justify-content:space-between;gap:10px;font-size:10.5px;flex-shrink:0}
  #nb-game .nb-foot b{color:#ff9fca}
  #nb-game .nb-close{position:relative;flex:0 0 44px;width:44px;height:44px;padding:0!important;font-size:0!important;line-height:1;display:grid;place-items:center}
  #nb-game .nb-close:before,#nb-game .nb-close:after{content:'';position:absolute;width:18px;height:2px;background:currentColor;border-radius:2px;transform:rotate(45deg)}#nb-game .nb-close:after{transform:rotate(-45deg)}
  #nb-game .nb-toolbar{flex-shrink:0;align-items:center}#nb-game .nb-brand{min-width:0}#nb-game .nb-tool{white-space:nowrap}
  @media(max-width:600px) and (min-height:471px){#nb-game .nb-head{flex-wrap:wrap;gap:9px!important;padding:9px 12px!important}#nb-game .nb-brand{width:100%;justify-content:center;font-size:16px!important}#nb-game .nb-brand small{font-size:8px;letter-spacing:1.5px}#nb-game .nb-toolbar{width:100%;justify-content:center;gap:8px}#nb-game .nb-tool{padding:8px 12px!important;font-size:12px}#nb-game .nb-close{padding:0!important}}
  @media(max-width:700px){#nb-game{padding:8px}#nb-game .nb-shell{border-radius:16px;box-shadow:0 12px 0 rgba(243,41,130,.30)}#nb-game .nb-head{padding:10px 14px}#nb-game .nb-brand{font-size:17px}#nb-game .nb-mark{width:29px;height:29px;font-size:15px}#nb-game .nb-brand small{font-size:8px;letter-spacing:2px}#nb-game .nb-main{grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr)}#nb-game .nb-ticket{padding:12px 11px}#nb-game .nb-order{font-size:18px;margin:0}#nb-game .nb-food{gap:6px;font-size:12px;min-height:34px}#nb-game .nb-food canvas{width:46px;height:27px}#nb-game .nb-card{padding:20px}#nb-game .nb-card h2{font-size:25px}#nb-game .nb-note{font-size:10.5px}#nb-game .nb-score{font-size:24px}}
  @media(max-width:480px) and (min-height:471px){#nb-game{padding:6px}#nb-game .nb-main{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}#nb-game .nb-ticket{display:grid;grid-template-columns:1fr auto;align-items:center;gap:2px 10px;border-right:0;border-bottom:2px solid rgba(36,24,36,.14);padding:10px 12px 12px;background:#fff3f7}#nb-game .nb-ticket h3,#nb-game .nb-note,#nb-game .nb-label{display:none}#nb-game .nb-order{grid-column:1;grid-row:1;font-size:16px;margin:0}#nb-game .nb-score{grid-column:2;grid-row:1;font-size:20px;margin:0}#nb-game .nb-lives{grid-column:1;grid-row:2;justify-content:flex-start;gap:9px;font-size:26px;margin:7px 0 0}#nb-game .nb-best{grid-column:2;grid-row:2;display:block;font-size:10px;margin:8px 0 0;text-align:right}#nb-game .nb-list{grid-column:1/-1;grid-row:3;display:flex;flex-direction:row;gap:9px;margin-top:9px;padding:0;border:0;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;touch-action:pan-x;overscroll-behavior-x:contain}#nb-game .nb-list::-webkit-scrollbar{display:none}#nb-game .nb-list.nb-more{mask-image:linear-gradient(90deg,#000 calc(100% - 30px),transparent);-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 30px),transparent)}#nb-game .nb-food{flex:0 0 auto;flex-direction:column;justify-content:flex-start;gap:3px;min-width:78px;min-height:0;padding:9px 11px;background:#fff8ee;border:1.5px solid rgba(36,24,36,.14);border-radius:14px}#nb-game .nb-food canvas{width:62px;height:37px}#nb-game .nb-food span{font-size:11px;font-weight:700;text-align:center}#nb-game .nb-food b{margin:0;font-size:11px;padding:2px 7px;border-radius:7px}#nb-game .nb-foot span:last-child{display:none}}
  @media(max-height:470px){#nb-game{padding:5px}#nb-game .nb-head{padding:6px 12px}#nb-game .nb-brand{font-size:16px}#nb-game .nb-brand small{display:none}#nb-game .nb-mark{width:26px;height:26px;font-size:14px}#nb-game .nb-main{grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr)}#nb-game .nb-ticket{grid-template-columns:auto auto minmax(0,1fr) auto;grid-template-rows:auto auto;gap:0 14px;padding:6px 12px 8px}#nb-game .nb-ticket h3{display:none}#nb-game .nb-label{display:none}#nb-game .nb-order{grid-column:1;grid-row:1;font-size:15px;margin:0}#nb-game .nb-score{grid-column:2;grid-row:1;font-size:17px;margin:0}#nb-game .nb-lives{grid-column:3;grid-row:1;font-size:17px;margin:0;gap:7px}#nb-game .nb-best{grid-column:4;grid-row:1;font-size:9.5px;max-width:130px}#nb-game .nb-list{grid-column:1/-1;grid-row:2;margin-top:6px;padding:6px 0 0;gap:6px}#nb-game .nb-food{min-height:24px;font-size:11px}#nb-game .nb-food canvas{width:38px;height:23px}#nb-game .nb-card{padding:14px 20px;max-width:410px}#nb-game .nb-card h2{font-size:23px;margin:6px 0}#nb-game .nb-card p{font-size:12px;margin-bottom:10px}#nb-game .nb-primary{padding:9px 19px}#nb-game .nb-foot{padding:5px 10px;font-size:10px}#nb-game .nb-message{top:8px;font-size:10px;padding:5px 12px}}
`;
  function el(tag,cls,text){const e=doc.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
  function ensureFonts(){if(doc.getElementById('nb-fonts'))return;const l=doc.createElement('link');l.id='nb-fonts';l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=Work+Sans:wght@400;600;700;800;900&display=swap';doc.head.append(l);}
  const SFX={right:assets.sfxRight,wrong:assets.sfxWrong,k:assets.sfxK,level:assets.sfxLevel,over:assets.sfxOver};
  const GAIN={right:.9,wrong:.55,k:.6,level:.5,over:.6};
  const buffers={},fallbacks={};let actx=null;
  let soundOn=true;try{soundOn=win.localStorage.getItem('kland-nuttin-sound-v1')!=='0';}catch(e){}
  function setupAudio(){
    try{const AC=win.AudioContext||win.webkitAudioContext;if(AC)actx=new AC();}catch(e){}
    for(const n in SFX){const url=SFX[n];if(!url)continue;
      if(actx){try{win.fetch(url,{mode:'cors'}).then(r=>r.arrayBuffer()).then(b=>new Promise((ok,no)=>actx.decodeAudioData(b,ok,no))).then(buf=>{buffers[n]=buf;}).catch(()=>{});}catch(e){}}
      try{const a=new win.Audio(url);a.preload='auto';a.volume=GAIN[n]||.55;fallbacks[n]=a;}catch(e){}
    }
  }
  function unlockAudio(){try{if(actx&&actx.state==='suspended'){const pr=actx.resume();if(pr&&pr.catch)pr.catch(()=>{});}}catch(e){}}
  function playSfx(n){
    if(!soundOn)return;
    if(actx&&buffers[n]){try{const src=actx.createBufferSource();src.buffer=buffers[n];const g=actx.createGain();g.gain.value=GAIN[n]||.55;src.connect(g);g.connect(actx.destination);src.start(0);return;}catch(e){}}
    const base=fallbacks[n];if(!base)return;
    try{const a=base.cloneNode();a.volume=base.volume;const pr=a.play();if(pr&&pr.catch)pr.catch(()=>{});}catch(e){}
  }
  setupAudio();
  function sprite(c,type,x,y,w=106,h=FOODS[type].h){if(!atlas.complete||!atlas.naturalWidth)return;c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';const ready=foodSprites.get(type);if(ready)c.drawImage(ready,x-w/2,y-h/2,w,h);else c.drawImage(atlas,...FOODS[type].rect,x-w/2,y-h/2,w,h);}
  function burgerLayers(){let top=H-227-FOODS.base.h/2;return stack.map(type=>{const h=FOODS[type].h,overlap=Math.min(6,h*.3),y=top+overlap-h/2;top=y-h/2;return {type,y,h};});}
  function burgerTop(){const layers=burgerLayers(),last=layers[layers.length-1];return last?last.y-last.h/2:H-227-FOODS.base.h/2;}
  function objectSprite(c,it,x,y){
    if(it.type==='hazard'){
      const h=HAZARDS[it.hazard],r=h.rect,scale=(h.size||80)/Math.max(r[2],r[3]),dx=x-r[2]*scale/2,dy=y-r[3]*scale/2;
      c.save();if(h.clip){c.beginPath();h.clip.forEach(([px,py],i)=>c[i?'lineTo':'moveTo'](dx+(px-r[0])*scale,dy+(py-r[1])*scale));c.closePath();c.clip();}
      c.drawImage(hazards,...r,dx,dy,r[2]*scale,r[3]*scale);c.restore();
      return;
    }
    if(it.type==='k'){
      c.save();c.strokeStyle='#f32982';c.lineWidth=3;c.beginPath();c.arc(x,y,37,0,Math.PI*2);c.stroke();c.drawImage(kBonus,x-40,y-42,80,80);c.fillStyle='#c91965';c.font='800 11px "Work Sans",Arial,sans-serif';c.textAlign='center';c.fillText('+500',x,y+48);c.restore();return;
    }
    sprite(c,it.type,x,y,106,FOODS[it.type].h+5);
  }
  const RUN_FRAMES=[{"rect":[0,0,512,512],"anchor":[286,497],"pose":"Near leg forward; far leg trailing"},{"rect":[512,0,512,512],"anchor":[256,507],"pose":"Near leg supports; far knee passes forward"},{"rect":[0,512,512,512],"anchor":[284,486],"pose":"Far leg forward; near leg trailing"},{"rect":[512,512,512,512],"anchor":[257,495],"pose":"Far leg supports; near knee passes forward"}];
  function drawJosh(bob){
    if(mode==='dying'||mode==='over'||heartTime>0||Math.abs(target-player)>1.5||keys.has('arrowleft')||keys.has('arrowright')||keys.has('a')||keys.has('d')){
      const dying=mode==='dying'||mode==='over';const row=dying?1:heartTime>0?2:0;
      const col=dying?Math.min(3,Math.floor(deathTime*5)):heartTime>0?Math.floor((CFG.heartSeconds-heartTime)*6)%4:Math.floor(runClock*9)%4;
      if(row===0){const f=RUN_FRAMES[col],scale=.355;ctx.save();ctx.translate(player,H-36);if(direction<0)ctx.scale(-1,1);ctx.drawImage(runSheet,...f.rect,-f.anchor[0]*scale,-f.anchor[1]*scale,512*scale,512*scale);ctx.restore();return;}
      const sy=[0,370,701][row],sh=[368,331,323][row],scale=[.47,.47,.53][row];
      const anchorX=row===0?[211,220,206,210][col]:row===1?[184,179,180,193][col]:[197,197,198,188][col];
      const baseline=row===0?368:row===1?324:321;
      ctx.save();ctx.translate(player,H-36);if(row===0&&direction<0)ctx.scale(-1,1);
      ctx.drawImage(animation,col*384,sy,384,sh,-anchorX*scale,-baseline*scale,384*scale,sh*scale);ctx.restore();
    }else ctx.drawImage(josh,263,129,685,1049,player-55,H-204+bob,110,168);
  }
  function endRun(reason){if(mode!=='playing')return;lives=0;deathReason=reason;deathTime=0;heartTime=0;keys.clear();mode='dying';syncControls();ticket();message(reason);}
  function finishDeath(){playSfx('over');mode='over';overlay('You’re cooked.',deathReason+' '+score+' points. '+(level-1)+' orders served.','Try again',start);}
  function orderScroll(list){const more=()=>list.scrollWidth>list.clientWidth+1;const cue=()=>list.classList.toggle('nb-more',more()&&list.scrollLeft+list.clientWidth<list.scrollWidth-2);const nowChip=list.querySelector('.nb-food.now');if(nowChip&&more()){const lb=list.getBoundingClientRect(),cb=nowChip.getBoundingClientRect();if(cb.left<lb.left+8||cb.left+cb.width>lb.left+list.clientWidth-8)list.scrollLeft+=(cb.left-lb.left)-(list.clientWidth-cb.width)/2;}list.onscroll=cue;cue();}
  function ticket(){root.querySelector('.nb-order').textContent='Order '+String(level).padStart(2,'0');const list=root.querySelector('.nb-list');list.replaceChildren();const chip=(t,done,now,label,num)=>{const row=el('div','nb-food'+(done?' done':'')+(now?' now':''));const icon=el('canvas');const density=Math.min(3,Math.max(2,win.devicePixelRatio||1));icon.width=110*density;icon.height=64*density;const c=icon.getContext('2d');c.scale(density,density);sprite(c,t,55,32,103,FOODS[t].h*103/110);row.append(icon,el('span','',label||FOODS[t].label),el('b','',num));return row;};list.append(chip('base',true,false,'Bottom bun','✓'));seq.forEach((t,i)=>list.append(chip(t,i<stepIdx,i===stepIdx,null,i<stepIdx?'✓':String(i+1))));orderScroll(list);root.querySelector('.nb-score').textContent=score.toLocaleString();const livesEl=root.querySelector('.nb-lives');livesEl.replaceChildren();for(let i=0;i<CFG.lives;i++){livesEl.append(el('span','nb-heart'+(i<lives?'':' lost'),i<lives?'♥':'♡'));}livesEl.setAttribute('aria-label',lives+' chances left');root.querySelector('.nb-best').textContent='PERSONAL BEST '+best;root.querySelector('.nb-note').textContent=complete()?'Everything but the top bun. Catch a sesame bun!':'Catch them in this order. Anything else costs a heart.';}
  function nextType(){return seq[stepIdx]||'bun';}
  function complete(){return seq.length>0&&stepIdx>=seq.length-1;}
  function makeSeq(){const n=Math.min(8,2+level);const out=[];let last='';for(let i=0;i<n;i++){let t=types[Math.floor(Math.random()*types.length)];if(t===last&&Math.random()<.65)t=types[(types.indexOf(t)+1+Math.floor(Math.random()*(types.length-1)))%types.length];out.push(t);last=t;}out.push('bun');return out;}
  function message(text){root.querySelector('.nb-message').textContent=text;}

  // Touch buttons commit on release, once. Mouse and keyboard keep native clicks.
  function bindQuickButtons(container){
    let press=null,lastTap=null;
    const buttonFor=target=>target?.closest?.('button');
    container.addEventListener('pointerdown',e=>{
      if(e.pointerType==='mouse')return;
      const button=buttonFor(e.target);
      press=e.isPrimary!==false&&button&&!button.disabled?{id:e.pointerId,button,x:e.clientX,y:e.clientY}:null;
    },{capture:true,passive:true});
    container.addEventListener('pointermove',e=>{
      if(press?.id===e.pointerId&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>10)press=null;
    },{capture:true,passive:true});
    container.addEventListener('pointercancel',()=>{press=null;},{capture:true,passive:true});
    container.addEventListener('pointerup',e=>{
      const tap=press;press=null;
      if(!tap||tap.id!==e.pointerId||tap.button.disabled||!tap.button.isConnected||
         buttonFor(e.target)!==tap.button||Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>10)return;
      lastTap={button:tap.button,time:win.performance.now()};
      e.preventDefault();
      tap.button.click();
    },{capture:true,passive:false});
    container.addEventListener('click',e=>{
      if(e.isTrusted&&e.detail>0&&lastTap&&buttonFor(e.target)===lastTap.button&&win.performance.now()-lastTap.time<800){
        e.preventDefault();e.stopImmediatePropagation();lastTap=null;
      }
    },true);
  }
  function syncControls(){
    const button=root?.querySelector('.nb-pause');if(!button)return;
    const paused=mode==='paused';
    button.textContent=paused?'Resume':'Pause';
    button.setAttribute('aria-label',paused?'Resume game':'Pause game');
    button.disabled=mode!=='playing'&&!paused;
    root.dataset.gameMode=mode;
  }
  function pauseMap(){
    const app=doc.getElementById('app'),world=doc.getElementById('world');
    mapGate={app,wasInert:app?.inert,world};
    if(app){app.inert=true;app.dataset.nbGamePaused='true';}
    if(world)world.dataset.uiBusy='true';
  }
  function restoreMap(){
    if(!mapGate)return;
    const {app,wasInert,world}=mapGate;
    if(app){app.inert=wasInert;delete app.dataset.nbGamePaused;}
    const loader=doc.getElementById('kland-loading');
    if(world)world.dataset.uiBusy=String(!!loader&&!loader.hidden||win.matchMedia('(max-width:820px),(pointer:coarse)').matches&&!!doc.querySelector('.panel.open'));
    mapGate=null;
  }

  function overlay(title,copy,label,action){needsPaint=true;syncControls();const over=root.querySelector('.nb-overlay');over.hidden=false;over.querySelector('h2').textContent=title;over.querySelector('p').textContent=copy;const b=over.querySelector('button');b.textContent=label;b.disabled=false;b.onclick=action;b.focus();}
  function hideOverlay(){needsPaint=true;previous=win.performance.now();syncControls();root.querySelector('.nb-overlay').hidden=true;canvas.focus();}
  function order(){seq=makeSeq();stepIdx=0;items=[];stack=[];particles=[];spawnClock=.4;elapsed=0;player=W/2;target=player;ticket();message('Catch the ingredients on your ticket');}
  function start(){unlockAudio();level=1;score=0;lives=CFG.lives;heartTime=0;deathTime=0;runClock=0;direction=1;order();mode='playing';hideOverlay();}
  function pause(){if(mode!=='playing')return;mode='paused';keys.clear();overlay('On your break.','Your burger can wait. Your situationship probably can’t.','Back to work',()=>{mode='playing';hideOverlay();});}
  function close(){if(!active)return;active=false;win.cancelAnimationFrame(raf);resizeObserver?.disconnect();win.removeEventListener('resize',resize);win.removeEventListener('keydown',keydown,true);win.removeEventListener('keyup',keyup,true);doc.removeEventListener('visibilitychange',visibility);win.removeEventListener('blur',blur);root.remove();doc.querySelector('#nb-styles')?.remove();root=null;keys.clear();restoreMap();restoreFocus();}
  function restoreFocus(){const t=lastFocus;if(t&&t.focus){if(t.tabIndex<0&&!t.hasAttribute('tabindex'))t.setAttribute('tabindex','-1');try{t.focus();}catch(e){}}if(!t||doc.activeElement!==t){const c=doc.getElementById('world')||doc.getElementById('app');if(c){if(!c.hasAttribute('tabindex'))c.setAttribute('tabindex','-1');try{c.focus();}catch(e){}}}}
  function visibility(){if(doc.hidden)pause();}function blur(){keys.clear();pause();}
  function keydown(e){if(!active)return;if(e.key===' '&&e.target.closest?.('button,input,textarea,select'))return;if(['ArrowLeft','ArrowRight','a','A','d','D','Escape',' ','p','P','Tab'].includes(e.key)){e.stopImmediatePropagation();if(e.key!=='Tab')e.preventDefault();}if(e.key==='Escape'){close();return;}if(e.key==='Tab'){const focusables=[...root.querySelectorAll('button:not(:disabled),canvas[tabindex]')].filter(n=>n.getClientRects().length);const first=focusables[0],last=focusables[focusables.length-1];if(e.shiftKey&&doc.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&doc.activeElement===last){e.preventDefault();first.focus();}return;}if(e.key==='p'||e.key==='P'||(e.key===' '&&doc.activeElement===canvas))pause();keys.add(e.key.toLowerCase());}
  function keyup(e){if(['arrowleft','arrowright','a','d'].includes(e.key.toLowerCase())){e.stopImmediatePropagation();e.preventDefault();}keys.delete(e.key.toLowerCase());}
  function resize(){needsPaint=true;const r=canvas.getBoundingClientRect(),ratio=Math.min(win.devicePixelRatio||1,3);canvas.width=Math.max(1,Math.round(r.width*ratio));canvas.height=Math.max(1,Math.round(r.height*ratio));const old=W;W=600*r.width/Math.max(r.height,1);H=600;player*=W/old;target=player;for(const it of items)it.x*=W/old;ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);}
  function burst(x,y,good){for(let i=0;i<12;i++)particles.push({x,y,vx:(Math.random()-.5)*160,vy:-60-Math.random()*160,life:.7,color:good?'#f6bc36':'#a72044'});}
  function catchItem(it){
    if(it.type==='hazard'){playSfx('wrong');endRun('Taken out by '+HAZARDS[it.hazard].label+'. Instant game over.');return;}
    if(it.type==='k'){playSfx('k');
      score+=CFG.kPoints;lives=Math.min(CFG.lives,lives+1);heartTime=CFG.heartSeconds;
      best=Math.max(best,score);try{win.localStorage.setItem('kland-nuttin-best-v1',String(best));}catch(e){}
      burst(player,it.y,true);message('CAUGHT FEELINGS! +500 points · +1 life');ticket();return;
    }
if(it.type==='bun'){if(complete()){playSfx('level');stack.push('bun');score+=CFG.points*level;best=Math.max(best,score);try{win.localStorage.setItem('kland-nuttin-best-v1',String(best));}catch(e){}mode='won';ticket();burst(player,it.y,true);message('Order up!');overlay('Big stack energy.',`Order ${level} served. ${score} points. Josh is absolutely putting “executive chef” in his bio.`,'Next order',()=>{level++;order();mode='playing';hideOverlay();});}else mistake('Too soon! Save the top bun for last.');return;}if(it.type===nextType()){playSfx('right');stack.push(it.type);stepIdx++;burst(player,it.y,true);message(complete()?'Perfect. Now catch a top bun!':'Nice. Next: '+FOODS[nextType()].label+'.');ticket();}else mistake('Out of order! You need '+FOODS[nextType()].label+'.');}
  function mistake(text){playSfx('wrong');lives--;burst(player,burgerTop(),false);message(text);ticket();if(lives<=0)endRun('Three wrong catches. Josh has been promoted to customer.');}
  function spawn(){
    const roll=Math.random();
    const haz=CFG.hazardChance+Math.min(.28,(level-1)*.034);
    if(elapsed>2.5&&roll<haz+CFG.kChance){
      const special=roll<haz?'hazard':'k';
      items.push({type:special,hazard:Math.floor(Math.random()*HAZARDS.length),x:65+Math.random()*Math.max(1,W-130),y:-60,speed:CFG.speed+Math.min(level-1,10)*20});return;
    }
const want=complete()?'bun':nextType();const pick=Math.random();let type;if(pick<.58)type=want;else if(pick<.72)type='bun';else type=types[Math.floor(Math.random()*types.length)];items.push({type,x:65+Math.random()*Math.max(1,W-130),y:-40,speed:CFG.speed+Math.min(level-1,10)*30+Math.random()*30});}
  function step(dt){elapsed+=dt;runClock+=dt;heartTime=Math.max(0,heartTime-dt);if(keys.has('arrowleft')||keys.has('a'))target-=CFG.moveSpeed*(W/1000)*dt;if(keys.has('arrowright')||keys.has('d'))target+=CFG.moveSpeed*(W/1000)*dt;target=Math.max(60,Math.min(W-60,target));if(Math.abs(target-player)>1.5)direction=target>player?1:-1;player+=(target-player)*Math.min(1,dt*20);spawnClock-=dt;if(spawnClock<=0){spawn();spawnClock=Math.max(.26,CFG.spawnEvery-(level-1)*.09);}for(const it of items){const catchY=burgerTop()-(FOODS[it.type]?FOODS[it.type].h/2-Math.min(6,FOODS[it.type].h*.3):12),prev=it.y;it.y+=it.speed*dt;if(prev<=catchY&&it.y>=catchY&&Math.abs(it.x-player)<CFG.catchWidth){it.dead=true;catchItem(it);if(mode!=='playing')break;}if(it.y>H+50)it.dead=true;}items=items.filter(it=>!it.dead);}
  function roundRect(x,y,w,h,r,fill,stroke){r=Math.max(0,Math.min(r,w/2,h/2));ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=3;ctx.stroke();}}
  function drawKitchen(){
    ctx.fillStyle='#f6e5ea';ctx.fillRect(0,0,W,H);
    if(!kitchen.complete||!kitchen.naturalWidth)return;
    const scale=Math.max(W/kitchen.naturalWidth,H/kitchen.naturalHeight);
    const width=kitchen.naturalWidth*scale,height=kitchen.naturalHeight*scale;
    ctx.drawImage(kitchen,(W-width)/2,H-height,width,height);
  }
  function draw(){ctx.clearRect(0,0,W,H);drawKitchen();
    ctx.fillStyle='#24182426';ctx.beginPath();ctx.ellipse(player,H-36,43,9,0,0,7);ctx.fill();
    const bob=mode==='playing'&&Math.abs(target-player)>2?Math.sin(elapsed*18)*2:0;if(josh.complete&&josh.naturalWidth)drawJosh(bob);
    if(mode!=='dying'&&mode!=='over'){roundRect(player-66,H-215,132,9,5,'#ffffff','#241824');sprite(ctx,'base',player,H-227,112,28);burgerLayers().forEach(layer=>sprite(ctx,layer.type,player,layer.y,110,layer.h));}
    for(const it of items)objectSprite(ctx,it,it.x,it.y);
    for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/.7);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,6,6);}ctx.globalAlpha=1;
    roundRect(player-27,H-26,56,22,8,'#f32982','#241824');ctx.fillStyle='#ffffff';ctx.textAlign='center';ctx.font='800 11px "Work Sans",Arial,sans-serif';ctx.fillText('JOSH',player,H-11);
  }
  function frame(now){if(!active)return;const animated=mode==='playing'||mode==='dying'||(mode!=='paused'&&particles.length>0);const dt=Math.min((now-previous)/1000||0,.035);previous=now;if(mode==='playing')step(dt);if(mode==='dying'){deathTime+=dt;if(deathTime>=1.05)finishDeath();}if(mode!=='paused'){for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=400*dt;}particles=particles.filter(p=>p.life>0);}if(animated||needsPaint){draw();needsPaint=false;}raf=win.requestAnimationFrame(frame);}
  function open(){if(active)return;active=true;lastFocus=doc.activeElement;ensureFonts();win.KLandPopupPass?.pauseAll();root=el('div');root.id='nb-game';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','nb-title');root.innerHTML=`<div class="nb-shell"><header class="nb-head"><div class="nb-brand" id="nb-title"><span class="nb-mark" aria-hidden="true">🍔</span><span class="nb-brandtext">NUTTIN’ BURGER<small>JOSH’S HIGH-STACK SHIFT</small></span></div><div class="nb-toolbar"><button class="nb-tool nb-sound" aria-label="Sound on" aria-pressed="true">🔊</button><button class="nb-tool nb-pause" aria-label="Pause game">Pause</button><button class="nb-tool nb-close" aria-label="Close burger game" title="Close">×</button></div></header><div class="nb-main"><aside class="nb-ticket"><h3>KITCHEN TICKET</h3><div class="nb-order">Order 01</div><div class="nb-list"></div><p class="nb-note"></p><div class="nb-label">SHIFT SCORE</div><div class="nb-score">0</div><div class="nb-lives"></div><div class="nb-best"></div></aside><div class="nb-stage"><canvas class="nb-canvas" tabindex="0" aria-label="Move Josh with left and right arrow keys or drag to catch burger ingredients"></canvas><div class="nb-message" role="status" aria-live="polite">Catch feelings? Try ingredients.</div><div class="nb-overlay"><div class="nb-card"><div class="eyebrow">NUTTIN’ BUT A GOOD SHIFT</div><h2></h2><p></p><button class="nb-primary"></button></div></div></div></div><footer class="nb-foot"><span><b>DRAG</b> to move · <b>← → / A D</b> on keyboard</span><span>Lore junk = instant death · K = +500 / +1 life</span></footer></div>`;
    const style=el('style');style.id='nb-styles';style.textContent=css;doc.head.append(style);doc.body.append(root);pauseMap();bindQuickButtons(root);canvas=root.querySelector('canvas.nb-canvas');ctx=canvas.getContext('2d');root.querySelector('.nb-close').onclick=close;root.querySelector('.nb-pause').onclick=()=>{if(mode==='paused'){mode='playing';hideOverlay();}else pause();};const sndBtn=root.querySelector('.nb-sound');const syncSound=()=>{sndBtn.textContent=soundOn?'🔊':'🔇';sndBtn.setAttribute('aria-pressed',String(soundOn));sndBtn.setAttribute('aria-label',soundOn?'Sound on':'Sound off');};syncSound();sndBtn.onclick=()=>{soundOn=!soundOn;try{win.localStorage.setItem('kland-nuttin-sound-v1',soundOn?'1':'0');}catch(e){}syncSound();};
    let dragging=false,lastIn=null;const insideX=e=>{const r=canvas.getBoundingClientRect();const x=(e.clientX-r.left)*W/r.width;return (x<0||x>W)?null:x;};canvas.onpointerdown=e=>{if(mode!=='playing')return;dragging=true;const x=insideX(e);if(x===null){lastIn=null;}else if(e.pointerType==='mouse'){lastIn=x;}else{target=x;lastIn=x;}try{canvas.setPointerCapture(e.pointerId);}catch(err){}e.preventDefault();};canvas.onpointermove=e=>{if(mode!=='playing')return;const x=insideX(e);if(x===null){lastIn=null;return;}if(dragging){if(lastIn!==null)target+=x-lastIn;lastIn=x;}else if(e.pointerType==='mouse')target=x;};canvas.onpointerup=canvas.onpointercancel=()=>{dragging=false;lastIn=null;};
    win.addEventListener('keydown',keydown,true);win.addEventListener('keyup',keyup,true);doc.addEventListener('visibilitychange',visibility);win.addEventListener('blur',blur);if(win.ResizeObserver){resizeObserver=new win.ResizeObserver(resize);resizeObserver.observe(canvas);}else{win.addEventListener('resize',resize);}resize();level=1;score=0;lives=CFG.lives;order();mode='intro';overlay('A job for Josh. Finally.',"Catch your order, then the top bun. Lore junk = instant game over. Catch K for +500, +1 life and heart eyes!",'Loading sprites…',()=>{});root.querySelector('.nb-primary').disabled=true;
    loading.then(()=>{if(!active)return;ticket();overlay('A job for Josh. Finally.',"Catch your order, then the top bun. Lore junk = instant game over. Catch K for +500, +1 life and heart eyes!",'Start shift',start);}).catch(()=>{if(active)overlay('Kitchen delay.','The sprites could not load. Close and try again.','Close',close);});previous=0;raf=win.requestAnimationFrame(frame);
  }
  win.NuttinBurger={version:'0.7.2-20261110-touch',open,close,config:CFG};
  // Nuttin' Burger opens the game only: no landmark story panel, video embed or Spotify player.
  function clearStory(){try{win.KLandPopupPass?.pauseAll();}catch{}const ps=doc.getElementById('panel-story');if(ps)ps.classList.remove('open');if(!win.KLandPopupCache)doc.querySelectorAll('#story iframe').forEach(e=>e.remove());}
  if(typeof win.showPlace==='function'){const original=win.showPlace;win.showPlace=function(id,...args){if(id==='nuttin-burger'){try{win.KLandPopupPass&&win.KLandPopupPass.stopPreview&&win.KLandPopupPass.stopPreview();}catch(e){}clearStory();open();return;}return original.call(this,id,...args);};}
  const story=doc.getElementById('story');
  if(story&&story.dataset.place==='nuttin-burger'){clearStory();open();}
}

(function(){const assets={"ingredients":"https://cdn.jsdelivr.net/gh/stepbystepdad/kland-nuttin-burger@v7/ingredients.webp","josh":"https://cdn.jsdelivr.net/gh/stepbystepdad/kland-nuttin-burger@v7/josh.webp","hazards":"https://cdn.jsdelivr.net/gh/stepbystepdad/kland-nuttin-burger@v7/hazards.webp","animation":"https://cdn.jsdelivr.net/gh/stepbystepdad/kland-nuttin-burger@v7/animation.webp","k":"https://cdn.jsdelivr.net/gh/stepbystepdad/kland-nuttin-burger@v7/k.webp","kitchen":"https://cdn.jsdelivr.net/gh/stepbystepdad/kland-nuttin-burger@v7/kitchen.webp","run":"https://cdn.jsdelivr.net/gh/stepbystepdad/kland-nuttin-burger@v7/run.webp","sfxRight":"https://cdn.jsdelivr.net/gh/stepbystepdad/kland-nuttin-burger@v7/sfx-right.mp3","sfxWrong":"https://cdn.jsdelivr.net/gh/stepbystepdad/kland-nuttin-burger@v7/sfx-wrong.mp3","sfxK":"https://cdn.jsdelivr.net/gh/stepbystepdad/kland-nuttin-burger@v7/sfx-k.mp3","sfxLevel":"https://cdn.jsdelivr.net/gh/stepbystepdad/kland-nuttin-burger@v7/sfx-level.mp3","sfxOver":"https://cdn.jsdelivr.net/gh/stepbystepdad/kland-nuttin-burger@v7/sfx-over.mp3"};let watchedFrame=null;function install(){const f=document.getElementById("ku-map-frame");if(f){if(f!==watchedFrame){watchedFrame=f;f.addEventListener("load",install);}try{const w=f.contentWindow;if(w&&w.document&&w.document.readyState!=="loading"&&w.document.documentElement.dataset.polish==="20261027"&&typeof w.showPlace==="function"){installNuttinBurger(w,assets);return true;}}catch(e){}return false;}if(typeof window.showPlace==="function"){try{installNuttinBurger(window,assets);return true;}catch(e){}}return false;}if(install())return;let tries=0;const timer=setInterval(()=>{if(install()||++tries>240)clearInterval(timer);},500);})();
