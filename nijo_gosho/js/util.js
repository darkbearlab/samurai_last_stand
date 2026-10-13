(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.$ = (id) => document.getElementById(id);
  G.rnd = (a, b) => a + Math.random() * (b - a);
  G.rint = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  G.pick = (a) => a[Math.floor(Math.random() * a.length)];
  G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.mulberry = function (s) {
    return function () {
      s |= 0; s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  G.angDiff = function (a, b) {
    let d = (a - b) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  G.shuffle = function (a, r) {
    r = r || Math.random;
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  G.fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
})();
