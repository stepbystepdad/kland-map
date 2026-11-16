import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../source/form-bridge.js',import.meta.url),'utf8');
function layout(path,rect,panelRect){
 const messages=[];let paint;
 const frame={isConnected:true,dataset:{},getBoundingClientRect:()=>rect,
  closest:s=>s==='.kland-popup-view'?{hidden:false}:null};
 const panel={classList:{contains:()=>true},getBoundingClientRect:()=>panelRect};
 const parent={postMessage:data=>messages.push(data)};
 const sandbox={window:{},parent,URL,location:{href:'https://kland-test.pages.dev/'},
  document:{referrer:'https://www.kevinsilvester.com/kland',readyState:'loading',addEventListener(){},
   getElementById:id=>id==='panel-story'?panel:{hidden:true}},
  getComputedStyle:()=>({visibility:'visible'}),ResizeObserver:class{observe(){}},
  requestAnimationFrame:fn=>{paint=fn;return 1;},addEventListener(){},visualViewport:null};
 vm.runInNewContext(code,sandbox);
 sandbox.window.KLandSetFormSource(frame,'https://www.kevinsilvester.com'+path);
 paint();return messages.find(m=>m.type==='kland-form-layout').layout[0];
}
for(const dimensions of [
 [966,211,498,495,{left:940,right:1490,top:78,bottom:677}],
 [26,160,338,520,{left:10,right:380,top:14,bottom:754}],
 [26,160,338,520,{left:10,right:380,top:14,bottom:550}],
 [26,30,338,520,{left:10,right:380,top:14,bottom:550}],
 [26,125,728,520,{left:10,right:800,top:14,bottom:300}]
]){
 const [x,y,width,height,p]=dimensions,r={x,y,width,height,left:x,right:x+width,top:y,bottom:y+height};
 const item=layout('/town-hall/town-hall',r,p);
 assert.equal(item.active,true);assert.deepEqual(Array.from(item.clip),[0,0,0,0]);
 assert.ok(item.y>=p.top+56);assert.ok(item.y+item.height<=p.bottom-2);
 assert.ok(item.x>=p.left+2);assert.ok(item.x+item.width<=p.right-2);
 assert.ok(item.height>0);
 const other=layout('/k-land-arrivals',r,p);
 assert.equal(other.height,height);assert.equal(other.y,y);
}
const hidden=layout('/town-hall/town-hall',{x:10,y:900,left:10,top:900,right:350,bottom:1420,width:340,height:520},{left:0,right:390,top:14,bottom:750});
assert.equal(hidden.active,false);assert.equal(hidden.height,0);
console.log('Town Hall viewport exposes its scroll bottom at desktop, phone, keyboard and landscape sizes; other forms retain their geometry.');
