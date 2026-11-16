import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import vm from 'node:vm';
import worker from '../source/worker.js';
import './mobile-controls.test.mjs';
import './form-bridge.test.mjs';
const root=new URL('../dist/',import.meta.url);
const html=await readFile(new URL('index.html',root),'utf8');
let scripts=0;
for(const match of html.matchAll(/<script\b([^>]*)>(.*?)<\/script>/gs)){
 const source=/src="([^"]+)"/.exec(match[1]);
 const code=source?await readFile(new URL('.'+source[1],root),'utf8'):match[2];
 new vm.Script(code,{filename:source?.[1]||'inline'});scripts++;
}
for(const match of html.matchAll(/(?:href|src)="(\/assets\/[^\"]+)"/g))await readFile(new URL('.'+match[1],root));
const nativeFetch=globalThis.fetch;
const upstream=[];
globalThis.fetch=async(url,opts)=>{upstream.push({url,opts});return new Response('{"top":[],"total":0}',{status:200});};
try {
 const origin='https://kland-test.pages.dev';
 let response=await worker.fetch(new Request(origin+'/api/scores'),{});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{top:[],total:0});
 assert.equal(upstream[0].url,'https://kland-nuttin-leaderboard.kevinsilvestermusic.workers.dev/scores');
 const payload=JSON.stringify({name:'Test',score:100,orders:1});
 response=await worker.fetch(new Request(origin+'/api/scores',{method:'POST',headers:{Origin:origin},body:payload}),{});
 assert.equal(response.status,200);assert.equal(upstream[1].opts.body,payload);
 response=await worker.fetch(new Request(origin+'/api/scores',{method:'POST',headers:{Origin:'https://example.com'},body:payload}),{});
 assert.equal(response.status,403);assert.equal(upstream.length,2);
 response=await worker.fetch(new Request(origin+'/api/scores',{method:'POST',headers:{Origin:origin},body:'x'.repeat(4097)}),{});
 assert.equal(response.status,413);assert.equal(upstream.length,2);
 response=await worker.fetch(new Request(origin+'/api/scores',{method:'DELETE'}),{});
 assert.equal(response.status,405);
 let staticHit=false;await worker.fetch(new Request(origin+'/assets/example.webp'),{ASSETS:{fetch:async()=>{staticHit=true;return new Response('asset');}}});assert.ok(staticHit);
} finally {globalThis.fetch=nativeFetch;}
console.log(`${scripts} delivered scripts parsed; referenced assets exist; 6 Worker routing/validation checks passed.`);
