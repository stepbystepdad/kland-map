import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Exercise event sequences from phones: release, compatibility click, movement,
// multiple fingers, cancellation, and keyboard/mouse fallback.
const listeners = new Map();
const context = {
  moved: false, performance: {now:()=>1000},
  addEventListener: (type, fn) => listeners.set(type, fn),
  document: {
    documentElement:{dataset:{}}, head:{append(){}},
    createElement:()=>({}), querySelector:()=>null,
    addEventListener:(type, fn)=>listeners.set(type,fn)
  }
};
vm.runInNewContext(await readFile(new URL('../source/mobile-controls.js',import.meta.url),'utf8'),context);
const target = (fountain=false) => ({
  activations:0, inert:false, dataset:{panel:'characters'},
  closest(selector){return selector==='[inert]' ? (this.inert?this:null) : this;},
  matches(){return fountain;}, click(){this.activations++;}
});
const nav=target(), fountain=target(true);
function event(type, element=nav, extra={}) {
  const value={target:element,pointerId:1,pointerType:'touch',isPrimary:true,
    clientX:100,clientY:100,isTrusted:true,detail:1,preventDefault(){this.prevented=true;},
    stopImmediatePropagation(){this.stopped=true;},...extra};
  listeners.get(type)(value);return value;
}
event('pointerdown'); event('pointerup'); assert.equal(nav.activations,1);
assert.equal(event('click').stopped,true,'native compatibility click must not toggle twice');
assert.equal(event('click',nav,{detail:0}).stopped,undefined,'keyboard remains available');
event('pointerdown'); event('pointermove',nav,{clientX:106}); event('pointerup',nav,{clientX:106});
assert.equal(nav.activations,2,'small finger wobble remains a tap');
event('pointerdown'); event('pointermove',nav,{clientX:111}); event('pointerup',nav,{clientX:111});
assert.equal(nav.activations,2,'a drag does not activate');
event('pointerdown'); event('pointerdown',nav,{pointerId:2,isPrimary:false});
event('pointerup',nav,{pointerId:2}); event('pointerup'); assert.equal(nav.activations,2,'pinch does not activate');
event('pointerdown'); event('pointercancel'); event('pointerup'); assert.equal(nav.activations,2);
event('pointerdown',nav,{pointerType:'mouse'}); event('pointerup',nav,{pointerType:'mouse'});
assert.equal(nav.activations,2,'mouse stays on native click path');
nav.inert=true; event('pointerdown'); event('pointerup'); nav.inert=false; assert.equal(nav.activations,2);
event('pointerdown'); event('pointerup',fountain); assert.equal(nav.activations,2,'release on another control does not activate');
event('pointerdown',fountain); event('pointerup',fountain); assert.equal(fountain.activations,1);
context.moved=true; event('pointerdown',fountain); event('pointerup',fountain);
assert.equal(fountain.activations,1,'map drag guard remains active');
event('pointerdown'); listeners.get('blur')(); event('pointerup'); assert.equal(nav.activations,2);
console.log('Mobile control release, duplicate-click, movement, pinch and cancellation checks passed.');
