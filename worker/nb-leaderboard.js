/* Nuttin' Burger leaderboard Worker.
 *
 * Free plan: Workers plus KV, and unlike a free Supabase project it is never paused for being idle.
 * Bindings: NB_SCORES, a KV namespace.
 *
 *   GET  /scores   -> { top: [...], total: n }
 *   POST /scores   -> { ok: true, rank, total, top }
 *   anything else  -> 404, "/" is a health check
 *
 * Rows live at s:<999999-score>:<at>:<id>, so the key order is already best-score-first and the top
 * of the board is one list() call. The row rides along in the key's metadata, so listing costs no
 * extra reads. There is no client key to leak: the Worker holds the KV binding, which means the
 * range checks, the per-run dedupe and the hourly cap cannot be bypassed from the browser.
 */
var TOP = 20;
var MAX_SCORE = 500000;
var MAX_ORDERS = 500;
var MAX_NAME = 24;
var PER_HOUR = 30;
var MAX_KEY = 999999;
var SITE_ORIGINS = ['https://www.kevinsilvester.com', 'https://kevinsilvester.com'];
var RUN_TTL = 604800;

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': SITE_ORIGINS.indexOf(origin) >= 0 ? origin : SITE_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(body, status, headers) {
  var h = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  for (var k in headers) h[k] = headers[k];
  return new Response(JSON.stringify(body), { status: status, headers: h });
}

function cleanName(v) {
  return String(v == null ? '' : v)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME);
}

function whole(v) {
  var n = Number(v);
  return isFinite(n) ? Math.round(n) : NaN;
}

function pad(n, w) {
  var s = String(n);
  while (s.length < w) s = '0' + s;
  return s;
}

function entryKey(score, at, id) {
  return 's:' + pad(MAX_KEY - score, 6) + ':' + pad(at, 13) + ':' + id;
}

function rowFromKey(k) {
  var m = k.metadata || {};
  return {
    name: m.n || 'anon',
    score: m.s || 0,
    orders: m.o || 0,
    at: Number(String(k.name).split(':')[2]) || 0
  };
}

function topRows(env) {
  return env.NB_SCORES.list({ prefix: 's:', limit: TOP }).then(function (list) {
    return (list.keys || []).map(rowFromKey);
  });
}

function total(env) {
  return env.NB_SCORES.get('meta:count').then(function (v) {
    return Number(v) || 0;
  });
}

function board(env, headers) {
  return Promise.all([topRows(env), total(env)]).then(function (r) {
    return json({ top: r[0], total: r[1] }, 200, headers);
  });
}

function submit(env, body, headers) {
  var id = String(body.id || '');
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) return Promise.resolve(json({ ok: false, error: 'bad run id' }, 400, headers));

  var name = cleanName(body.name);
  if (!name) return Promise.resolve(json({ ok: false, error: 'name required' }, 400, headers));

  var score = whole(body.score);
  var orders = whole(body.orders) || 0;
  if (!(score >= 1 && score <= MAX_SCORE)) return Promise.resolve(json({ ok: false, error: 'score out of range' }, 400, headers));
  if (!(orders >= 0 && orders <= MAX_ORDERS)) return Promise.resolve(json({ ok: false, error: 'orders out of range' }, 400, headers));

  var visitor = String(body.visitor || '').slice(0, 64);
  var hour = Math.floor(Date.now() / 3600000);
  var rlKey = 'rl:' + (visitor || 'anon') + ':' + hour;

  return env.NB_SCORES.get('run:' + id).then(function (seen) {
    if (seen) return json({ ok: false, error: 'that run is already on the board' }, 409, headers);
    return env.NB_SCORES.get(rlKey).then(function (used) {
      if ((Number(used) || 0) >= PER_HOUR) return json({ ok: false, error: 'slow down' }, 429, headers);
      return env.NB_SCORES.put(rlKey, String((Number(used) || 0) + 1), { expirationTtl: 7200 })
        .then(function () {
          var at = Date.now();
          return env.NB_SCORES.put(entryKey(score, at, id), '', { metadata: { n: name, s: score, o: orders } });
        })
        .then(function () { return env.NB_SCORES.put('run:' + id, '1', { expirationTtl: RUN_TTL }); })
        .then(function () {
          return total(env).then(function (count) {
            count += 1;
            return env.NB_SCORES.put('meta:count', String(count)).then(function () { return count; });
          });
        })
        .then(function (count) {
          return topRows(env).then(function (top) {
            var rank = 0;
            for (var i = 0; i < top.length; i++) {
              if (top[i].name === name && top[i].score === score) { rank = i + 1; break; }
            }
            return json({ ok: true, rank: rank || null, total: count, top: top }, 200, headers);
          });
        });
    });
  });
}

export default {
  fetch: function (request, env) {
    var url = new URL(request.url);
    var headers = cors(request.headers.get('Origin') || '');
    if (request.method === 'OPTIONS') return Promise.resolve(new Response(null, { status: 204, headers: headers }));

    if (url.pathname === '/scores' && request.method === 'GET') return board(env, headers);
    if (url.pathname === '/' && request.method === 'GET') {
      return Promise.resolve(json({ ok: true, board: 'nuttin-burger' }, 200, headers));
    }
    if (url.pathname === '/scores' && request.method === 'POST') {
      return request.text().then(function (t) {
        var body = null;
        try { body = t ? JSON.parse(t) : {}; } catch (e) { body = null; }
        if (!body || typeof body !== 'object') return json({ ok: false, error: 'bad json' }, 400, headers);
        return submit(env, body, headers);
      });
    }
    return Promise.resolve(json({ ok: false, error: 'not found' }, 404, headers));
  }
};
