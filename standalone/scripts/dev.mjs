// Managed-preview entry point. No writes to the production score board.
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import worker from '../source/worker.js';
const root=resolve('standalone/dist');
const port=Number(process.env.PORT||process.argv[process.argv.indexOf('--port')+1]||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.avif':'image/avif','.svg':'image/svg+xml','.mp3':'audio/mpeg','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif'};
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://'+req.headers.host);
    if(url.pathname==='/api/scores'){
      if(req.method!=='GET'){res.writeHead(405);res.end('Score submissions are disabled in the local preview.');return;}
      const response=await worker.fetch(new Request(url,{headers:req.headers}),{});
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    const info=await stat(path);if(!info.isFile())throw Error('Not a file');
    const data=await readFile(path), headers={'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':path.includes('/assets/')?'public, max-age=31536000, immutable':'no-store','Accept-Ranges':'bytes'};
    const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range||'');
    if(range){const start=Number(range[1]),end=Math.min(range[2]?Number(range[2]):data.length-1,data.length-1);if(start>end){res.writeHead(416);res.end();return;}res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${data.length}`,'Content-Length':end-start+1});res.end(data.subarray(start,end+1));}
    else {res.writeHead(200,{...headers,'Content-Length':data.length});res.end(req.method==='HEAD'?undefined:data);}
  } catch {res.writeHead(404);res.end('Not found');}
});
server.listen(Number.isFinite(port)?port:4173,'0.0.0.0',()=>console.log('K Land managed preview ready'));
