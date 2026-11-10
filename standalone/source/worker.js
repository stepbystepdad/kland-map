// Only score requests invoke the Worker; Pages serves static files directly.
// Keep the existing leaderboard and all of its validation/rate limits intact.
const BOARD = 'https://kland-nuttin-leaderboard.kevinsilvestermusic.workers.dev/scores';
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/scores') return env.ASSETS.fetch(request);
    if (!['GET','POST'].includes(request.method)) return new Response('Method not allowed',{status:405,headers:{Allow:'GET, POST'}});
    if (request.method==='POST' && request.headers.get('Origin')!==url.origin) return new Response('Origin not allowed',{status:403});
    let body;
    if(request.method==='POST') {
      body=await request.text();
      if(body.length>4096)return new Response('Request too large',{status:413});
    }
    try {
      const upstream=await fetch(BOARD,{method:request.method,headers:{'Content-Type':'application/json'},body});
      return new Response(upstream.body,{status:upstream.status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    } catch {
      return Response.json({ok:false,error:'Leaderboard temporarily unavailable'},{status:502});
    }
  }
};
