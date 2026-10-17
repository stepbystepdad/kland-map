/* Unit tests for the leaderboard Worker, run in Node with a stub KV namespace.
 *   node test_nb_worker.mjs
 */
import worker from './nb-leaderboard.js';

function fakeKV() {
  const m = new Map();
  return {
    _m: m,
    async get(k) { const e = m.get(k); return e === undefined ? null : e.value; },
    async put(k, v, opts) { m.set(k, { value: v, metadata: (opts && opts.metadata) || null }); },
    async list({ prefix = '', limit = 1000 } = {}) {
      const keys = [...m.entries()]
        .filter(([k]) => k.startsWith(prefix))
        .map(([k, e]) => ({ name: k, metadata: e.metadata }))
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      return { keys: keys.slice(0, limit), list_complete: keys.length <= limit };
    },
  };
}

const env = { NB_SCORES: fakeKV() };
const SITE = 'https://www.kevinsilvester.com';

function call(method, path, { body, origin = SITE } = {}) {
  const init = { method, headers: {} };
  if (origin) init.headers.origin = origin;
  if (body !== undefined) { init.body = typeof body === 'string' ? body : JSON.stringify(body); init.headers['content-type'] = 'application/json'; }
  return worker.fetch(new Request('https://nb.example' + path, init), env).then(async (r) => ({
    status: r.status, json: await r.text(), acao: r.headers.get('Access-Control-Allow-Origin'),
  }));
}

let pass = 0, fail = 0;
function check(label, ok, extra) {
  if (ok) { pass++; console.log('  ok   ' + label); }
  else { fail++; console.log('  FAIL ' + label + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

const run = (id, score, orders, name = 'KEV', visitor = 'v-' + id) => call('POST', '/scores', { body: { id, name, score, orders, visitor } });
const get = () => call('GET', '/scores');

console.log('worker: contract and validation');
let r = await call('OPTIONS', '/scores');
check('preflight is 204 with our origin', r.status === 204 && r.acao === SITE, r);
r = await get();
check('empty board reads as an empty top and zero total', r.status === 200 && JSON.parse(r.json).top.length === 0 && JSON.parse(r.json).total === 0, r.json);
r = await call('GET', '/');
check('health check answers', r.status === 200, r.json);
r = await call('GET', '/nope');
check('unknown path is 404', r.status === 404, r.status);
r = await call('GET', '/scores', { origin: 'https://evil.example' });
check('foreign origin is not echoed, so the browser blocks it', r.acao === SITE, r.acao);

console.log('worker: insert, order and rank');
r = await run('run-aaaaaaaa', 1200, 3, 'ALPHA');
let j = JSON.parse(r.json);
check('first insert ranks 1 of 1', r.status === 200 && j.rank === 1 && j.total === 1, j);
check('insert returns the board', j.top.length === 1 && j.top[0].name === 'ALPHA' && j.top[0].score === 1200 && j.top[0].orders === 3, j.top);
r = await run('run-bbbbbbbb', 500, 1, 'BRAVO');
check('weaker score ranks 2', JSON.parse(r.json).rank === 2, r.json);
r = await run('run-cccccccc', 999, 2, 'CHARLIE');
check('middle score ranks 2, pushing the other down', JSON.parse(r.json).rank === 2, r.json);
r = await get();
j = JSON.parse(r.json);
check('board reads best first', j.top.map((x) => x.score).join(',') === '1200,999,500', j.top);
check('total counts every shift', j.total === 3, j.total);
r = await run('run-aaaaaaaa', 1200, 3, 'ALPHA');
check('replaying a run id is refused with 409', r.status === 409, r.status);

console.log('worker: limits');
check('score 0 is refused', (await run('run-dddddddd', 0, 0)).status === 400);
check('score above the cap is refused', (await run('run-eeeeeeee', 999999, 0)).status === 400);
check('absurd orders are refused', (await run('run-ffffffff', 100, 9999)).status === 400);
check('missing name is refused', (await run('run-gggggggg', 100, 1, '   ')).status === 400);
check('a short/garbage run id is refused', (await call('POST', '/scores', { body: { id: 'x', name: 'A', score: 5, orders: 0 } })).status === 400);
check('malformed json is refused', (await call('POST', '/scores', { body: 'not json{' })).status === 400);
r = await run('run-hhhhhhhh', 77, 0, '  CHARLIE   SPACE  ');
check('a long name is trimmed to 24 characters', JSON.parse(r.json).top.some((x) => x.name === 'CHARLIE SPACE'), JSON.parse(r.json).top);
r = await run('run-iiiiiiii', 88, 0, 'ctrl\u0007chars\nhere');
check('control characters are stripped from the name', JSON.parse(r.json).top.some((x) => x.name === 'ctrl chars here'), JSON.parse(r.json).top);

console.log('worker: hourly cap per browser');
const flood = 'flood-visitor';
let last = null;
for (let i = 0; i < 31; i++) last = await run('flood-' + String(i).padStart(8, '0'), 100 + i, 0, 'FLOOD', flood);
check('the 31st shift from one browser in an hour is refused with 429', last.status === 429, last.status);
const other = await run('other-visitor-run', 150, 0, 'OTHER', 'someone-else');
check('another browser is unaffected by that cap', other.status === 200, other.status);

console.log('worker: board window');
for (let i = 0; i < 25; i++) await run('window-' + String(i).padStart(8, '0'), 1000 + i, 0, 'W' + i, 'visitor-w' + i);
r = await get();
j = JSON.parse(r.json);
check('the board is capped at 20 rows', j.top.length === 20, j.top.length);
check('the board still starts with the best score', j.top[0].score === 1200, j.top[0]);
check('and descends from there', j.top.every((x, i) => i === 0 || j.top[i - 1].score >= x.score), j.top.map((x) => x.score));
r = await run('run-outside-top', 10, 0, 'TINY', 'visitor-tiny');
check('a score outside the top 20 reports no rank', JSON.parse(r.json).rank === null, JSON.parse(r.json).rank);

console.log('worker: a board list that lags the write');
// Cloudflare's KV list index trails a put, so a top-of-board list taken right after a write can still
// be missing the row that was just written. The reply must not depend on that list catching up.
function laggyKV(lagMs) {
  const m = new Map();
  const born = new Map();
  return {
    _m: m,
    async get(k) { const e = m.get(k); return e === undefined ? null : e.value; },
    async put(k, v, opts) {
      m.set(k, { value: v, metadata: (opts && opts.metadata) || null });
      born.set(k, Date.now());
    },
    async list({ prefix = '', limit = 1000 } = {}) {
      const now = Date.now();
      const keys = [...m.entries()]
        .filter(([k]) => k.startsWith(prefix))
        .filter(([k]) => !(born.has(k) && now - born.get(k) < lagMs))
        .map(([k, e]) => ({ name: k, metadata: e.metadata }))
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      return { keys: keys.slice(0, limit), list_complete: keys.length <= limit };
    },
  };
}

const lagEnv = { NB_SCORES: laggyKV(400) };
const lagRun = (id, score, orders, name, visitor) =>
  worker.fetch(new Request('https://nb.example/scores', {
    method: 'POST',
    headers: { origin: SITE, 'content-type': 'application/json' },
    body: JSON.stringify({ id, name, score, orders, visitor }),
  }), lagEnv).then(async (r) => ({ status: r.status, json: JSON.parse(await r.text()) }));

let g = await lagRun('lag-run-0001', 900, 1, 'FIRST', 'v-lag1');
check('a row still ranks while its own key lags out of the list',
  g.status === 200 && g.json.rank === 1 && g.json.top.length === 1 && g.json.top[0].name === 'FIRST', g.json);

await new Promise((res) => setTimeout(res, 500));
g = await lagRun('lag-run-0002', 400, 1, 'SECOND', 'v-lag2');
check('a later row sees the earlier one and takes rank 2',
  g.status === 200 && g.json.rank === 2 && g.json.top.length === 2 && g.json.top[1].name === 'SECOND', g.json);

g = await lagRun('lag-run-0003', 9000, 1, 'KING', 'v-lag3');
check('a row better than the lagging board still takes rank 1',
  g.status === 200 && g.json.rank === 1 && g.json.top[0].name === 'KING', g.json);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
