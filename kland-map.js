/* K Land map loader: pins an exact release so updates appear without a hard refresh. */
(function () {
  'use strict';
  var REPO = 'https://cdn.jsdelivr.net/gh/stepbystepdad/kland-map@';
  var FALLBACK = 'v1.4.13';
  var VURL = 'https://raw.githubusercontent.com/stepbystepdad/kland-map/main/version.json';
  var started = false;
  function load(version) {
    if (started) return;
    started = true;
    window.KLAND_MAP_VERSION = version;
    var s = document.createElement('script');
    s.async = false;
    s.src = REPO + version + '/bundle.js';
    document.head.appendChild(s);
  }
  var timer = setTimeout(function () { load(FALLBACK); }, 3000);
  fetch(VURL + '?t=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (j) { clearTimeout(timer); load((j && j.version) || FALLBACK); })
    .catch(function () { clearTimeout(timer); load(FALLBACK); });
})();
