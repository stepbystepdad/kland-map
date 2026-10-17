/* Nuttin' Burger leaderboard, shared through a Cloudflare Worker.
 *
 * This lives in the map bundle rather than in the game because the bundle is loaded through
 * version.json, so it ships without editing the Squarespace code block that pins
 * kland-nuttin-burger at a tag. It runs in the parent page, not in the map iframe, because the
 * game stops key propagation for a, d, space and friends while a shift is running, so a name field
 * inside the game would silently drop those letters. The game's own DOM is the only thing read out
 * of the iframe, and it is read defensively: if that markup changes, the board button and the
 * score hook simply stop appearing and the game plays exactly as it did before.
 *
 * The endpoint below is a public Cloudflare Worker URL holding the KV binding, so there is no key
 * in this file to leak and no way to bypass the Worker's own checks. See worker/nb-leaderboard.js
 * and worker/README.md in the kland-map repo.
 */
;(function () {
  'use strict';

  var API = '__NB_API__';
  var TOP = 20;
  var NAME_KEY = 'kland-nuttin-name-v1';
  var VID_KEY = 'kland-nuttin-visitor-v1';
  var LOG_KEY = 'kland-nuttin-board-log-v1';
  var GAME_BEST_KEY = 'kland-nuttin-best-v1';
  var MAX_SCORE = 500000;
  var MAX_NAME = 24;
  var PER_HOUR = 12;

  // not wired up yet, or Squarespace is in edit mode: stay completely out of the way
  if (!/^https?:\/\//.test(API)) return;
  if (document.body.classList.contains('sqs-edit-mode-active')) return;
  if (typeof frame === 'undefined' || !frame) return;

  /* ---------- storage and formatting ---------- */

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function uuid() {
    var c = window.crypto || window.msCrypto;
    if (c && c.randomUUID) return c.randomUUID();
    var b = new Uint8Array(16);
    if (c && c.getRandomValues) c.getRandomValues(b);
    else for (var j = 0; j < 16; j++) b[j] = Math.floor(Math.random() * 256);
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = '';
    for (var i = 0; i < 16; i++) h += ('0' + b[i].toString(16)).slice(-2);
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  function visitor() {
    var v = lsGet(VID_KEY);
    if (!v) { v = uuid(); lsSet(VID_KEY, v); }
    return v;
  }

  function cleanName(n) {
    return String(n == null ? '' : n)
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_NAME);
  }
  function storedName() { return cleanName(lsGet(NAME_KEY) || ''); }
  function rememberName(n) { n = cleanName(n); if (n) lsSet(NAME_KEY, n); return n; }

  function digits(s) { return Number(String(s == null ? '' : s).replace(/[^0-9]/g, '')) || 0; }
  function fmt(n) { try { return Number(n).toLocaleString(); } catch (e) { return String(n); } }

  function recentSubmits() {
    var a;
    try { a = JSON.parse(lsGet(LOG_KEY) || '[]'); } catch (e) { a = []; }
    if (!a || typeof a.length !== 'number') a = [];
    var now = Date.now();
    return a.filter(function (t) { return typeof t === 'number' && now - t < 3600000; });
  }
  function noteSubmit() {
    var a = recentSubmits();
    a.push(Date.now());
    lsSet(LOG_KEY, JSON.stringify(a));
  }

  /* ---------- the Worker's two endpoints ---------- */

  var TIMEOUT = 8000;

  function call(path, opts) {
    opts = opts || {};
    opts.cache = 'no-store';
    if (opts.body) opts.headers = { 'Content-Type': 'application/json' };
    // a stalled connection should end as the friendly failure message rather than a panel stuck on
    // "Saving your shift..." for as long as the browser holds the request open
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = 0;
    if (ctl) { opts.signal = ctl.signal; timer = setTimeout(function () { ctl.abort(); }, TIMEOUT); }
    var stop = function () { if (timer) { clearTimeout(timer); timer = 0; } };
    return fetch(API.replace(/\/+$/, '') + path, opts).then(function (r) {
      return r.text().then(function (t) {
        stop();
        var data = null;
        if (t) { try { data = JSON.parse(t); } catch (e) { data = null; } }
        if (!r.ok || (data && data.ok === false)) {
          throw new Error((data && data.error) || ('HTTP ' + r.status));
        }
        return data || {};
      });
    }, function (err) { stop(); throw err; });
  }

  function fetchBoard() { return call('/scores'); }
  function postScore(row) { return call('/scores', { method: 'POST', body: JSON.stringify(row) }); }

  /* ---------- styles ---------- */

  var CSS = [
    '#nb-board-root{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:12px;padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));font-family:"Work Sans","Trebuchet MS",Arial,sans-serif;color:#241824;overflow:auto}',
    '#nb-board-root[hidden]{display:none}',
    '#nb-board-root *{box-sizing:border-box}',
    '#nb-board-root .nbb-scrim{position:absolute;inset:0;background:rgba(26,16,32,.66)}',
    '#nb-board-root .nbb-card{position:relative;width:min(440px,100%);max-height:100%;min-height:0;display:flex;flex-direction:column;background:#fff8ee;border:2px solid #241824;border-radius:20px;padding:20px 20px 16px;box-shadow:0 10px 0 rgba(243,41,130,.55)}',
    '#nb-board-root .nbb-head{flex:0 0 auto;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-bottom:2px solid rgba(36,24,36,.14);padding-bottom:12px}',
    '#nb-board-root .nbb-head h2{margin:0;color:#241824;font-family:"Dela Gothic One","Arial Black",Arial,sans-serif;font-size:22px;line-height:1.05;letter-spacing:0;text-transform:none}',
    '#nb-board-root .nbb-sub{margin:6px 0 0;color:#c91965;font-size:10.5px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase}',
    '#nb-board-root .nbb-x{flex:0 0 auto;width:44px;height:44px;min-width:44px;border:1.5px solid rgba(36,24,36,.25);background:#fff3f7;border-radius:11px;font-size:15px;font-weight:800;line-height:1;cursor:pointer;color:#241824}',
    '#nb-board-root .nbb-run{flex:0 0 auto;padding:12px 0 0}',
    '#nb-board-root .nbb-run[hidden]{display:none}',
    '#nb-board-root .nbb-msg{margin:0;color:#241824;font-size:12.5px;font-weight:700;line-height:1.35}',
    '#nb-board-root .nbb-inputrow{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}',
    '#nb-board-root .nbb-inputrow[hidden]{display:none}',
    '#nb-board-root .nbb-input{flex:1 1 130px;min-width:0;min-height:44px;padding:8px 11px;font:700 13px "Work Sans",Arial,sans-serif;color:#241824;background:#fff3f7;border:2px solid #241824;border-radius:11px}',
    '#nb-board-root .nbb-run-go,#nb-board-root .nbb-run-no{cursor:pointer;font-weight:800;border:2px solid #241824;border-radius:11px;padding:11px 16px;font-size:12.5px}',
    '#nb-board-root .nbb-run-go{color:#fff;background:#f32982;box-shadow:0 4px 0 #a30f57}',
    '#nb-board-root .nbb-run-no{color:#241824;background:transparent;border-color:rgba(36,24,36,.25)}',
    '#nb-board-root .nbb-rows{list-style:none;margin:12px 0 0;padding:0;overflow:auto;-webkit-overflow-scrolling:touch;flex:1 1 auto;min-height:0;display:flex;flex-direction:column;gap:6px}',
    '#nb-board-root .nbb-row{display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:baseline;gap:2px 10px;background:#fff3f7;border:1.5px solid rgba(36,24,36,.14);border-radius:12px;padding:9px 12px}',
    '#nb-board-root .nbb-row.mine{border-color:#f32982;box-shadow:0 3px 0 rgba(243,41,130,.35)}',
    '#nb-board-root .nbb-rank{font-family:"Dela Gothic One",Arial,sans-serif;font-size:15px;color:#c91965}',
    '#nb-board-root .nbb-row:nth-child(-n+3) .nbb-rank{color:#f32982}',
    '#nb-board-root .nbb-name{color:#241824;font-weight:800;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#nb-board-root .nbb-orders{grid-column:2;color:#a98a99;font-size:10.5px;font-weight:700;letter-spacing:.6px}',
    '#nb-board-root .nbb-score{color:#241824;font-family:"Dela Gothic One",Arial,sans-serif;font-size:16px;text-align:right}',
    '#nb-board-root .nbb-status{flex:0 0 auto;margin:10px 0 0;color:#a98a99;font-size:11.5px;font-weight:700;min-height:16px}',
    '#nb-board-root .nbb-foot{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;border-top:2px solid rgba(36,24,36,.14);padding-top:12px}',
    '#nb-board-root .nbb-you{color:#241824;font-size:11.5px;font-weight:700}',
    '#nb-board-root .nbb-btn{cursor:pointer;font-weight:800;border:2px solid #241824;border-radius:11px;padding:9px 14px;font-size:12.5px}',
    '#nb-board-root .nbb-ghost{background:#fff3f7;color:#241824}',
    '@media(max-width:560px){#nb-board-root{padding:8px;padding:max(8px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left))}#nb-board-root .nbb-card{padding:14px 13px 11px;border-radius:16px}#nb-board-root .nbb-head h2{font-size:19px}#nb-board-root .nbb-x{width:40px;height:40px;min-width:40px}#nb-board-root .nbb-run-go,#nb-board-root .nbb-run-no{padding:10px 13px}#nb-board-root .nbb-name{font-size:13px}#nb-board-root .nbb-score{font-size:15px}}'
  ].join('\n');

  function ensureFonts() {
    if (document.getElementById('nbb-fonts')) return;
    var l = document.createElement('link');
    l.id = 'nbb-fonts';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=Work+Sans:wght@400;600;700;800;900&display=swap';
    document.head.appendChild(l);
  }

  /* ---------- the board overlay ---------- */

  var board, rowsEl, statusEl, youEl, titleEl, subEl, runEl, msgEl, inputRowEl, inputEl, runGo, runNo;
  var lastBoard = null;
  var pending = { score: 0, orders: 0 };

  function buildBoard() {
    if (board) return;
    ensureFonts();
    var style = document.createElement('style');
    style.id = 'nb-board-styles';
    style.textContent = CSS;
    document.head.appendChild(style);

    board = document.createElement('div');
    board.id = 'nb-board-root';
    board.hidden = true;
    board.innerHTML = [
      '<div class="nbb-scrim" data-close="1"></div>',
      '<div class="nbb-card" role="dialog" aria-modal="true" aria-labelledby="nbb-title">',
      '<div class="nbb-head"><div><h2 id="nbb-title">TOP SHIFTS</h2>',
      '<p class="nbb-sub" id="nbb-sub"></p></div>',
      '<button type="button" class="nbb-x" data-close="1" aria-label="Close">\u2715</button></div>',
      '<div class="nbb-run" hidden><p class="nbb-msg" role="status" aria-live="polite"></p>',
      '<div class="nbb-inputrow" hidden><input class="nbb-input" maxlength="24" type="text" placeholder="Your name" aria-label="Name to show on the leaderboard">',
      '<button type="button" class="nbb-run-go">Save my score</button><button type="button" class="nbb-run-no">No thanks</button></div></div>',
      '<ol class="nbb-rows"></ol>',
      '<p class="nbb-status"></p>',
      '<div class="nbb-foot"><span class="nbb-you"></span>',
      '<button type="button" class="nbb-btn nbb-ghost" data-act="rename">Change name</button></div>',
      '</div>'
    ].join('');
    document.body.appendChild(board);

    rowsEl = board.querySelector('.nbb-rows');
    statusEl = board.querySelector('.nbb-status');
    youEl = board.querySelector('.nbb-you');
    titleEl = board.querySelector('#nbb-title');
    subEl = board.querySelector('#nbb-sub');
    runEl = board.querySelector('.nbb-run');
    msgEl = board.querySelector('.nbb-msg');
    inputRowEl = board.querySelector('.nbb-inputrow');
    inputEl = board.querySelector('.nbb-input');
    runGo = board.querySelector('.nbb-run-go');
    runNo = board.querySelector('.nbb-run-no');

    runGo.addEventListener('click', function () {
      var n = rememberName(inputEl.value);
      if (!n) { inputEl.focus(); return; }
      inputRowEl.hidden = true;
      submitRun(pending.score, pending.orders, n);
    });
    inputEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') runGo.click(); });
    runNo.addEventListener('click', function () {
      inputRowEl.hidden = true;
      msgEl.textContent = 'No score sent. Your personal best still counts.';
    });

    board.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      if (t.getAttribute('data-close')) closeBoard();
      else if (t.getAttribute('data-act') === 'rename') promptName();
    });
  }

  function renderBoard(state) {
    buildBoard();
    var rows = state.rows || [];
    var nm = storedName();
    var best = digits(lsGet(GAME_BEST_KEY));
    rowsEl.textContent = '';
    statusEl.textContent = state.status || '';
    youEl.textContent = nm
      ? 'Playing as ' + nm + (best ? ' \u00b7 personal best ' + fmt(best) : '')
      : (best ? 'Personal best ' + fmt(best) + ' \u00b7 no name saved yet' : 'No name saved yet');
    if (!rows.length && !state.status) statusEl.textContent = 'No shifts logged yet. Be the first.';
    rows.forEach(function (r, i) {
      var li = document.createElement('li');
      li.className = 'nbb-row' + (nm && r.name === nm ? ' mine' : '');
      var rank = document.createElement('span');
      rank.className = 'nbb-rank';
      rank.textContent = '#' + (i + 1);
      var name = document.createElement('span');
      name.className = 'nbb-name';
      name.textContent = r.name || 'anon';
      var score = document.createElement('span');
      score.className = 'nbb-score';
      score.textContent = fmt(r.score);
      li.append(rank, name, score);
      if (r.orders) {
        var o = document.createElement('span');
        o.className = 'nbb-orders';
        o.textContent = (Number(r.orders) === 1 ? '1 order served' : r.orders + ' orders served');
        li.append(o);
      }
      rowsEl.append(li);
    });
  }

  function refreshBoard() {
    renderBoard({ status: 'Loading the board\u2026' });
    return fetchBoard().then(function (r) {
      lastBoard = r.top || [];
      renderBoard({ rows: lastBoard, status: r.total ? r.total + ' shifts logged' : '' });
    }).catch(function () {
      renderBoard({ rows: [], status: 'The board is unavailable right now.' });
    });
  }

  // One card carries both halves: the run result (and its name field) on top, the board below.
  // Open from a finished run, or from the toolbar button to just read the board.
  function openBoard(mode, run) {
    buildBoard();
    var isRun = mode === 'run';
    titleEl.textContent = isRun ? 'YOU\u2019RE COOKED' : 'TOP SHIFTS';
    subEl.textContent = isRun && run
      ? 'You scored ' + fmt(run.score) + (run.orders ? ' \u00b7 ' + run.orders + (Number(run.orders) === 1 ? ' order' : ' orders') + ' served' : '') + '.'
      : 'Nuttin\u2019 Burger \u00b7 Josh\u2019s High-Stack Shift';
    runEl.hidden = !isRun;
    if (!isRun) { inputRowEl.hidden = true; msgEl.textContent = ''; }
    else if (run) pending = run;
    if (board.hidden) {
      board.hidden = false;
      if (!isRun) pauseGame(true);
      var x = board.querySelector('.nbb-x');
      if (x && x.focus) x.focus();
    }
    refreshBoard();
  }

  function closeBoard() {
    if (!board || board.hidden) return;
    board.hidden = true;
    runEl.hidden = true;
    pauseGame(false);
    var c = gameCanvas();
    if (c && c.focus) c.focus();
  }

  /* ---------- post-run flow ---------- */

  function afterRun(score, orders) {
    pending = { score: score, orders: orders };
    if (score < 1 || score > MAX_SCORE) return;
    openBoard('run', { score: score, orders: orders });
    if (recentSubmits().length >= PER_HOUR) {
      msgEl.textContent = 'That is a lot of shifts at once. Board submissions are paused for a bit \u2014 your personal best still stands.';
      return;
    }
    var nm = storedName();
    if (!nm) {
      msgEl.textContent = 'You scored ' + fmt(score) + '. Put a name on the board?';
      inputRowEl.hidden = false;
      try { inputEl.focus(); } catch (e) {}
      return;
    }
    inputRowEl.hidden = true;
    submitRun(score, orders, nm);
  }

  function submitRun(score, orders, nm) {
    noteSubmit();
    runEl.hidden = false;
    msgEl.textContent = 'Saving your shift\u2026';
    postScore({ id: uuid(), name: nm, score: score, orders: orders, visitor: visitor() })
      .then(function (r) {
        var rank = Number(r.rank) || 0;
        // report the save before touching the board, so a render problem can never be mistaken for
        // a submission that did not land
        msgEl.textContent = rank
          ? 'Saved \u2014 ' + nm + ' is #' + rank + ' with ' + fmt(score) + '.'
          : 'Saved \u2014 ' + fmt(score) + ' for ' + nm + '. Not in the top ' + TOP + ' yet.';
        try {
          lastBoard = r.top || lastBoard;
          renderBoard({ rows: lastBoard || [], status: r.total ? r.total + ' shifts logged' : '' });
        } catch (e) {}
      })
      .catch(function () {
        msgEl.textContent = 'Could not reach the board just now. Your score still counts as a personal best.';
      });
  }

  function promptName() {
    var nm = storedName();
    var next = window.prompt('Name to show on the Nuttin\u2019 Burger board (up to ' + MAX_NAME + ' characters)', nm || '');
    if (next === null) return;
    next = rememberName(next);
    renderBoard({ rows: lastBoard || [], status: next ? 'Saved as ' + next + '.' : 'Name left as it was.' });
  }

  /* ---------- watching the game ---------- */

  var doc = null, observer = null, pausedByMe = false, lastCard = '', boardBtn = null;

  function gameRoot() { return doc && doc.getElementById('nb-game'); }
  function gameCanvas() { var g = gameRoot(); return g && g.querySelector('canvas.nb-canvas'); }

  // The board lives in the parent page, so the game would keep stepping behind it. Borrow the
  // game's own pause toggle instead, and give it back on close unless the player had paused it.
  function pauseGame(on) {
    var g = gameRoot();
    var btn = g && g.querySelector('.nb-pause');
    if (!btn) { pausedByMe = false; return; }
    var over = g.querySelector('.nb-overlay');
    var shown = over && !over.hidden;
    var paused = shown && /on your break/i.test((over.querySelector('h2') || {}).textContent || '');
    if (on) {
      if (paused) { pausedByMe = false; return; }
      btn.click();
      pausedByMe = true;
    } else if (pausedByMe) {
      btn.click();
      pausedByMe = false;
    }
  }

  function ensureBoardButton(g) {
    if (boardBtn && doc && doc.contains(boardBtn)) return;
    var bar = g.querySelector('.nb-toolbar');
    if (!bar) return;
    var b = doc.createElement('button');
    b.type = 'button';
    b.className = 'nb-tool nb-board';
    b.textContent = '\ud83c\udfc6 Board';
    b.setAttribute('aria-label', 'Open the Nuttin\u2019 Burger leaderboard');
    b.addEventListener('click', function () { openBoard('view'); });
    var closeBtn = bar.querySelector('.nb-close');
    bar.insertBefore(b, closeBtn || null);
    boardBtn = b;
  }

  function readPanelScore(g) {
    var el = g.querySelector('.nb-score');
    return el ? digits(el.textContent) : 0;
  }

  function checkForFinishedRun(g) {
    var over = g.querySelector('.nb-overlay');
    if (!over) return;
    // The game reuses one overlay node for the intro, pause, "order served" and "you're cooked"
    // cards, so a hidden overlay means the last card was dismissed and the next showing is a new
    // run. Without that reset the second death of a session would never be recorded.
    if (over.hidden) { lastCard = ''; return; }
    var h2 = (over.querySelector('h2') || {}).textContent || '';
    if (h2 === lastCard) return;
    lastCard = h2;
    if (!/cooked/i.test(h2)) return;
    var p = (over.querySelector('p') || {}).textContent || '';
    var m = /([\d,]+)\s+points/.exec(p);
    var o = /(\d+)\s+orders?\s+served/.exec(p);
    afterRun(m ? digits(m[1]) : readPanelScore(g), o ? digits(o[1]) : 0);
  }

  function tick() {
    var g = gameRoot();
    if (!g) {
      boardBtn = null;
      if (board && !board.hidden) closeBoard();
      return;
    }
    ensureBoardButton(g);
    checkForFinishedRun(g);
  }

  function watch() {
    var d;
    try { d = frame.contentDocument; } catch (e) { d = null; }
    if (!d) return;
    if (d !== doc) {
      doc = d;
      if (observer) observer.disconnect();
      if (window.MutationObserver) {
        observer = new MutationObserver(tick);
        observer.observe(d.documentElement, {
          childList: true, subtree: true, characterData: true,
          attributes: true, attributeFilter: ['hidden', 'style', 'class']
        });
      }
    }
    tick();
  }

  frame.addEventListener('load', watch);
  window.setInterval(tick, 1000);
  window.setInterval(watch, 3000);
  watch();
})();
