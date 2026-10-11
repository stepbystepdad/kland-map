/* K Land map loader: pins an exact release so updates appear without a hard refresh. */
(function () {
  'use strict';
  var REPO = 'https://cdn.jsdelivr.net/gh/stepbystepdad/kland-map@';
  var FALLBACK = 'v1.1.1';
  function load(version, retry) {
    window.KLAND_MAP_VERSION = version;
    var s = document.createElement('script');
    s.async = false;
    s.onerror = function () { if (!retry) load(FALLBACK, true); };
    s.src = REPO + version + '/bundle.js';
    document.head.appendChild(s);
  }
  fetch('https://raw.githubusercontent.com/stepbystepdad/kland-map/main/version.json', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (j) { load((j && j.version) || FALLBACK); })
    .catch(function () { load(FALLBACK); });
})();
