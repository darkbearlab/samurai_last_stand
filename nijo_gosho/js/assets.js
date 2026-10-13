/* =====================================================================
   程序生成美術：牆面、地板、天花板貼圖（64×64）與精靈圖。
   之後要換成手繪圖時，讓 G.TEX[名稱] / G.SPR[名稱] 變成 64×64 的
   Uint32Array（RGBA，little-endian）即可，其他程式不用改。
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G;
  const TS = 64; G.TS = TS;
  const TEX = (G.TEX = {}), SPR = (G.SPR = {});

  /* ---------- 繪圖小工具 ---------- */
  function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  function ell(g, x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); g.fill(); }
  function poly(g, ...p) { g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.closePath(); g.fill(); }
  function line(g, x0, y0, x1, y1, w, c) { g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  function star(g, x, y, R, r, n, c) { g.fillStyle = c; g.beginPath(); for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2, rr = i % 2 ? r : R; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); }
  function grain(g, amt, r) {
    const d = g.getImageData(0, 0, TS, TS), p = d.data;
    for (let i = 0; i < p.length; i += 4) { if (!p[i + 3]) continue; const n = (r() - 0.5) * amt; p[i] += n; p[i + 1] += n; p[i + 2] += n; }
    g.putImageData(d, 0, 0);
  }
  function makeTex(draw, seed) {
    const c = document.createElement('canvas'); c.width = c.height = TS;
    const g = c.getContext('2d', { willReadFrequently: true });
    draw(g, G.mulberry(seed || 7));
    return new Uint32Array(g.getImageData(0, 0, TS, TS).data.buffer.slice(0));
  }

  /* ---------- 牆面與地板 ---------- */
  const TEXGEN = {
    plaster(g, r) { // 白壁 + 長押 + 腰板
      g.fillStyle = '#cfc6b2'; g.fillRect(0, 0, 64, 64);
      grain(g, 14, r);
      g.fillStyle = '#4b3526'; g.fillRect(0, 6, 64, 5); g.fillStyle = '#6a4b34'; g.fillRect(0, 6, 64, 1);
      g.fillStyle = '#3e2c20'; g.fillRect(0, 42, 64, 22);
      g.fillStyle = '#2e2018'; for (let x = 0; x < 64; x += 8) g.fillRect(x, 42, 1, 22);
      g.fillStyle = '#5a4130'; g.fillRect(0, 42, 64, 2);
    },
    fusuma(g, r) { // 金地の襖（固定壁）
      for (let y = 0; y < 64; y += 8) for (let x = -4; x < 64; x += 8) {
        const v = r() * 18 - 9; g.fillStyle = `rgb(${196 + v},${163 + v},${92 + v * 0.6})`;
        g.fillRect(x + ((y / 8) % 2 ? 4 : 0), y, 8, 8);
      }
      g.fillStyle = '#3d5a3a'; ell(g, 14, 60, 22, 9); ell(g, 52, 62, 20, 7);
      g.fillStyle = '#4a3424'; g.fillRect(40, 22, 3, 32);
      g.fillStyle = '#2f4a30'; ell(g, 40, 22, 12, 4.5); ell(g, 47, 31, 9, 3.5); ell(g, 33, 30, 8, 3.2);
      g.fillStyle = '#1b1411'; g.fillRect(0, 0, 64, 2); g.fillRect(0, 62, 64, 2); g.fillRect(0, 0, 2, 64); g.fillRect(62, 0, 2, 64);
      grain(g, 8, r);
    },
    door(g, r) { // 引き戸の襖：波紋様
      g.fillStyle = '#d8cfb8'; g.fillRect(0, 0, 64, 64);
      for (let row = 0; row < 11; row++) for (let col = -1; col < 6; col++) {
        const cx = col * 14 + (row % 2 ? 7 : 0), cy = row * 6 + 6;
        g.fillStyle = '#d8cfb8'; g.beginPath(); g.arc(cx, cy, 7, Math.PI, 0); g.fill();
        g.strokeStyle = '#4f6f93'; g.lineWidth = 1;
        for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(cx, cy, 6.5 - k * 2.2, Math.PI, 0); g.stroke(); }
      }
      g.fillStyle = '#1b1411'; g.fillRect(0, 0, 64, 3); g.fillRect(0, 61, 64, 3); g.fillRect(0, 0, 3, 64); g.fillRect(61, 0, 3, 64);
      g.fillStyle = '#1b1411'; circle(g, 52, 34, 3.5); g.fillStyle = '#c9a34a'; circle(g, 52, 34, 2.5); g.fillStyle = '#1b1411'; circle(g, 52, 34, 1.4);
      grain(g, 8, r);
    },
    shoji(g, r) { // 障子：重擊可砍穿
      g.fillStyle = '#ece6d6'; g.fillRect(0, 0, 64, 64);
      grain(g, 8, r);
      g.fillStyle = '#6b4e36';
      for (const x of [0, 16, 32, 48]) g.fillRect(x, 0, 2, 48);
      for (let y = 0; y <= 48; y += 12) g.fillRect(0, y, 64, 2);
      g.fillRect(62, 0, 2, 48);
      g.fillStyle = '#5a4130'; g.fillRect(0, 48, 64, 16); g.fillStyle = '#4a3424'; g.fillRect(0, 48, 64, 2);
    },
    shojiDoor(g, r) { // 腰付障子の引き戸：看得到對面的影子
      g.fillStyle = '#ece6d6'; g.fillRect(0, 0, 64, 64);
      grain(g, 8, r);
      g.fillStyle = '#6b4e36';
      for (const x of [16, 32, 48]) g.fillRect(x, 0, 1, 46);
      for (let y = 12; y < 46; y += 11) g.fillRect(0, y, 64, 1);
      g.fillStyle = '#3e2a1c'; g.fillRect(0, 0, 64, 3); g.fillRect(0, 0, 3, 64); g.fillRect(61, 0, 3, 64);
      g.fillStyle = '#5a4130'; g.fillRect(0, 46, 64, 18); g.fillStyle = '#3e2a1c'; g.fillRect(0, 46, 64, 2);
      g.fillStyle = '#2a1c14'; g.fillRect(53, 52, 3, 8);
    },
    pillar(g, r) {
      g.fillStyle = '#5a3f2c'; g.fillRect(0, 0, 64, 64);
      for (let x = 0; x < 64; x++) { const v = Math.sin(x * 0.55) + r() * 0.6; g.fillStyle = `rgba(30,18,10,${v > 0.9 ? 0.32 : 0.12})`; g.fillRect(x, 0, 1, 64); }
      g.fillStyle = '#2a1c14'; g.fillRect(0, 0, 3, 64); g.fillRect(61, 0, 3, 64);
      grain(g, 10, r);
    },
    tatami(g, r) {
      for (let y = 0; y < 64; y += 2) { const v = r() * 16 - 8; g.fillStyle = `rgb(${150 + v},${146 + v},${92 + v * 0.5})`; g.fillRect(0, y, 64, 2); }
      g.fillStyle = 'rgba(80,70,40,.35)'; for (let y = 1; y < 64; y += 2) g.fillRect(0, y, 64, 1);
      g.fillStyle = '#1d1f1a'; g.fillRect(0, 0, 64, 4); g.fillStyle = '#3b4a35'; g.fillRect(0, 1, 64, 1);
      grain(g, 10, r);
    },
    ceil(g, r) {
      for (let x = 0; x < 64; x += 16) { const v = r() * 14; g.fillStyle = `rgb(${50 + v},${36 + v * 0.7},${26 + v * 0.5})`; g.fillRect(x, 0, 16, 64); }
      g.fillStyle = '#22170f'; for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 3, 64);
      grain(g, 10, r);
    },
  };

  /* ---------- 敵人 ---------- */
  const COL = {
    hat: '#1d1815', rim: '#4a3c30', mon: '#c9a34a', skin: '#b07f5c', dou: '#2a211d', douHi: '#43352d',
    lace: '#9b3a2b', lace2: '#3a5a86', sleeve: '#2a3048', hakama: '#252a3a', waraji: '#8c7a56',
    wood: '#6e4c2f', iron: '#2a2a2e', steel: '#d3d7dc', steelDk: '#8c9298',
  };
  function body(g, step) {
    g.fillStyle = COL.hakama; poly(g, 22, 44, 42, 44, 44 + step, 60, 35, 60, 32, 50, 29, 60, 20 - step, 60);
    g.fillStyle = COL.waraji; g.fillRect(19 - step, 60, 10, 3); g.fillRect(35 + step, 60, 10, 3);
    g.fillStyle = COL.dou; g.fillRect(20, 38, 24, 8);
    g.fillStyle = COL.lace; g.fillRect(20, 40, 24, 1); g.fillRect(20, 43, 24, 1);
    g.fillStyle = '#120e0c'; for (let x = 26; x < 44; x += 6) g.fillRect(x, 38, 1, 8);
    g.fillStyle = COL.dou; poly(g, 21, 22, 43, 22, 42, 39, 22, 39);
    g.fillStyle = COL.douHi; g.fillRect(23, 23, 18, 2);
    g.fillStyle = COL.lace; for (let i = 0; i < 3; i++) g.fillRect(22, 27 + i * 4, 20, 1);
    g.fillStyle = COL.mon; circle(g, 32, 31, 2.2); g.fillStyle = COL.dou; circle(g, 32, 31, 1);
    g.fillStyle = COL.dou; g.fillRect(15, 22, 8, 11); g.fillRect(41, 22, 8, 11);
    g.fillStyle = COL.lace2; [25, 28].forEach((y) => { g.fillRect(15, y, 8, 1); g.fillRect(41, y, 8, 1); });
  }
  function hat(g, dy) {
    g.fillStyle = COL.hat; poly(g, 11, 15 + dy, 32, 4 + dy, 53, 15 + dy, 51, 17 + dy, 13, 17 + dy);
    g.fillStyle = COL.rim; g.fillRect(13, 15 + dy, 38, 1);
    g.fillStyle = COL.mon; circle(g, 32, 10 + dy, 1.8);
  }
  function head(g, dy) {
    dy = dy || 0;
    g.fillStyle = COL.skin; circle(g, 32, 17 + dy, 5.5);
    g.fillStyle = '#1a120e'; g.fillRect(29, 16 + dy, 2, 1.5); g.fillRect(33, 16 + dy, 2, 1.5);
    hat(g, dy);
  }
  function arm(g, x0, y0, x1, y1) { line(g, x0, y0, x1, y1, 4, COL.sleeve); g.fillStyle = COL.skin; circle(g, x1, y1, 2.2); }
  function glint(g, x, y) {
    g.strokeStyle = 'rgba(255,255,240,1)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x + 6, y); g.moveTo(x, y - 6); g.lineTo(x, y + 6); g.stroke();
    g.fillStyle = '#fff'; circle(g, x, y, 1.8);
  }
  function board(g, x0, y0, x1, y1) {
    g.fillStyle = '#6f5034'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.fillStyle = '#5a3f28'; for (let x = x0 + 7; x < x1; x += 7) g.fillRect(x, y0, 1, y1 - y0);
    g.fillStyle = COL.iron; g.fillRect(x0, y0 + 8, x1 - x0, 3); g.fillRect(x0, y1 - 11, x1 - x0, 3);
    g.fillStyle = '#8f9096'; for (let x = x0 + 3; x < x1; x += 7) { g.fillRect(x, y0 + 9, 1, 1); g.fillRect(x, y1 - 10, 1, 1); }
    g.fillStyle = '#3e2a1a'; g.fillRect(x0, y0, x1 - x0, 1); g.fillRect(x0, y0, 1, y1 - y0); g.fillRect(x1 - 1, y0, 1, y1 - y0);
    g.strokeStyle = 'rgba(230,225,210,1)'; g.lineWidth = 2; g.beginPath(); g.arc((x0 + x1) / 2, (y0 + y1) / 2 + 3, 7, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#0b0806'; g.fillRect((x0 + x1) / 2 - 5, y0 + 14, 10, 2);
  }

  function drawYari(g, f) {
    const step = f === 'w1' ? 2 : 0;
    body(g, step); head(g, f === 'wind' ? 1 : 0);
    if (f === 'wind') {
      line(g, 55, 47, 36, 31, 2.4, COL.wood);
      g.fillStyle = COL.steel; poly(g, 27, 27, 33, 21, 39, 27, 33, 33);
      arm(g, 44, 25, 47, 41); arm(g, 20, 25, 40, 34);
      glint(g, 33, 27);
    } else if (f === 'atk') {
      arm(g, 44, 25, 38, 38); arm(g, 20, 25, 26, 38);
      g.fillStyle = COL.steelDk; poly(g, 20, 31, 32, 15, 44, 31, 32, 47);
      g.fillStyle = COL.steel; poly(g, 23, 31, 32, 18, 41, 31, 32, 44);
      g.fillStyle = '#fff'; g.fillRect(31, 21, 2, 20);
    } else {
      line(g, 47, 3, 47, 62, 2.2, COL.wood);
      g.fillStyle = COL.steel; poly(g, 45.5, 10, 47, 0, 48.5, 10, 47, 12);
      g.fillStyle = '#111'; g.fillRect(45.5, 11, 3, 2);
      arm(g, 44, 25, 47, 33); arm(g, 20, 25, 45, 42);
    }
  }
  function drawTeppo(g, f) {
    const step = f === 'w1' ? 2 : 0;
    body(g, step);
    if (f === 'wind' || f === 'atk') {
      head(g, 2);
      g.fillStyle = COL.wood; ell(g, 38, 35, 8, 4);
      arm(g, 20, 26, 29, 33); arm(g, 44, 26, 38, 35);
      g.fillStyle = COL.iron; circle(g, 30, 29, 4.5); g.fillStyle = '#000'; circle(g, 30, 29, 2.2);
      g.fillStyle = '#ff8a2a'; circle(g, 37, 31, 2.2); g.fillStyle = '#ffe2a0'; circle(g, 37, 31, 1);
      if (f === 'atk') { star(g, 30, 28, 14, 5, 8, '#ffcf6a'); star(g, 30, 28, 8, 3, 8, '#fff6d8'); }
    } else if (f === 'reload') {
      head(g);
      g.fillStyle = COL.iron; g.fillRect(45, 6, 3, 42); g.fillStyle = COL.wood; g.fillRect(44, 44, 5, 15);
      line(g, 42, 1, 42, 16, 1.2, '#c9a77a');
      arm(g, 44, 25, 42, 14); arm(g, 20, 25, 45, 42);
    } else {
      head(g);
      g.save(); g.translate(32, 36); g.rotate(-0.38);
      g.fillStyle = COL.iron; g.fillRect(-25, -1.5, 40, 3);
      g.fillStyle = COL.wood; g.fillRect(8, -2.5, 17, 5);
      g.restore();
      arm(g, 20, 25, 23, 41); arm(g, 44, 25, 40, 33);
      g.fillStyle = '#ff8a2a'; circle(g, 37, 33, 1.3);
    }
  }
  function drawTate(g, f) {
    const step = f === 'w1' ? 2 : 0;
    g.fillStyle = COL.hakama; g.fillRect(22 - step, 55, 8, 6); g.fillRect(34 + step, 55, 8, 6);
    g.fillStyle = COL.waraji; g.fillRect(21 - step, 60, 10, 3); g.fillRect(33 + step, 60, 10, 3);
    hat(g, -1);
    if (f === 'wind' || f === 'atk') board(g, 6, 7, 58, 61); else board(g, 10, 11, 54, 59);
    if (f === 'atk') { g.fillStyle = '#fff'; g.fillRect(2, 30, 3, 1); g.fillRect(59, 30, 3, 1); g.fillRect(1, 36, 4, 1); g.fillRect(59, 36, 4, 1); }
  }
  function drawTateless(g, f) {
    const step = f === 'w1' ? 2 : 0;
    body(g, step); head(g, f === 'wind' ? 1 : 0);
    if (f === 'wind') { arm(g, 44, 25, 42, 11); line(g, 42, 11, 36, 1, 1.8, COL.steel); arm(g, 20, 25, 40, 13); glint(g, 37, 3); }
    else if (f === 'atk') { arm(g, 44, 25, 34, 36); arm(g, 20, 25, 30, 36); line(g, 18, 48, 48, 20, 2, COL.steel); }
    else { arm(g, 44, 25, 48, 40); line(g, 48, 40, 52, 55, 1.6, COL.steel); arm(g, 20, 25, 22, 38); }
  }
  function drawDead(g, set) {
    g.fillStyle = '#5b1712'; ell(g, 34, 61, 24, 3);
    g.fillStyle = COL.hakama; ell(g, 40, 58, 13, 4);
    g.fillStyle = COL.dou; ell(g, 26, 57, 10, 5);
    g.fillStyle = COL.skin; circle(g, 13, 57, 3.5);
    g.fillStyle = COL.hat; ell(g, 7, 59, 7, 2.5);
    if (set === 'yari') line(g, 3, 62, 61, 55, 1.6, COL.wood);
    if (set === 'teppo') line(g, 18, 62, 50, 60, 2.5, COL.iron);
    if (set === 'tateless') line(g, 46, 62, 60, 60, 1.4, COL.steel);
    if (set === 'tate') { g.fillStyle = '#6f5034'; g.fillRect(12, 52, 48, 9); g.fillStyle = COL.iron; g.fillRect(12, 54, 48, 2); }
  }
  // 變體可以替換這些繪製函式（在 buildAssets 之前）
  const ENEMY_DRAW = (G.ENEMY_DRAW = { yari: drawYari, teppo: drawTeppo, tate: drawTate, tateless: drawTateless });
  G.ENEMY_FRAMES = ['w0', 'w1', 'wind', 'atk', 'reload', 'pain', 'dead'];

  /* ---------- 道具與特效 ---------- */
  function drawBladeItem(g, b) {
    g.fillStyle = 'rgba(0,0,0,1)'; ell(g, 32, 63, 6, 1);
    g.fillStyle = COL.steelDk; poly(g, 30, 26, 34, 26, 33.6, 60, 32, 63, 30.4, 60);
    g.fillStyle = COL.steel; poly(g, 31, 26, 33, 26, 32.6, 60, 32, 62, 31.4, 60);
    g.fillStyle = '#c9a34a'; g.fillRect(30, 24, 4, 3);
    g.fillStyle = '#2c2620'; ell(g, 32, 23, 6, 2);
    g.fillStyle = '#16110d'; g.fillRect(30.5, 6, 3, 16);
    g.fillStyle = '#d8cfb8'; for (let y = 8; y < 20; y += 3) poly(g, 32, y, 33.5, y + 1.5, 32, y + 3, 30.5, y + 1.5);
    g.fillStyle = '#2c2620'; g.fillRect(30.5, 4, 3, 2);
    line(g, 33, 20, 40, 30, 1.4, b.color); line(g, 40, 30, 38, 39, 1.4, b.color);
    if (b.id === 'mikazuki') { g.strokeStyle = '#ffffff'; g.lineWidth = 0.8; for (const y of [34, 43, 52]) { g.beginPath(); g.arc(32, y, 1.6, 0.2, Math.PI - 0.2); g.stroke(); } }
  }
  G.drawBladeItem = drawBladeItem;
  const ITEMGEN = (G.ITEMGEN = {
    whetstone(g) {
      g.fillStyle = '#4a3424'; g.fillRect(18, 57, 28, 6);
      g.fillStyle = '#9a8f78'; g.fillRect(21, 50, 22, 8);
      g.fillStyle = '#b8ae96'; g.fillRect(21, 50, 22, 2);
      g.fillStyle = '#7d735f'; g.fillRect(21, 56, 22, 2);
    },
    onigiri(g) {
      g.fillStyle = '#f2efe6'; poly(g, 32, 46, 42, 62, 22, 62);
      g.fillStyle = '#d9d4c6'; g.fillRect(24, 60, 16, 2);
      g.fillStyle = '#1d2a1e'; g.fillRect(28, 55, 8, 7);
    },
    brazier0(g) { brazier(g, 0); },
    brazier1(g) { brazier(g, 1); },
    spark(g) { star(g, 32, 32, 22, 5, 6, '#ffe6a0'); star(g, 32, 32, 10, 3, 6, '#ffffff'); },
    blood(g) { g.fillStyle = '#a3201a'; circle(g, 32, 32, 13); circle(g, 20, 40, 7); circle(g, 44, 25, 6); g.fillStyle = '#d4372b'; circle(g, 30, 30, 5); },
    paper(g) { g.fillStyle = '#efe9da'; poly(g, 10, 20, 24, 14, 22, 28); poly(g, 34, 8, 50, 14, 40, 24); poly(g, 30, 40, 44, 36, 46, 52); poly(g, 12, 44, 22, 40, 20, 54); },
    wood(g) { g.fillStyle = '#6f5034'; poly(g, 8, 30, 30, 22, 32, 26, 10, 34); poly(g, 36, 12, 44, 10, 50, 36, 44, 38); poly(g, 20, 44, 40, 48, 38, 52, 18, 48); },
    smoke(g) { g.fillStyle = '#8a8680'; circle(g, 32, 34, 16); circle(g, 20, 28, 10); circle(g, 44, 26, 11); g.fillStyle = '#a19c95'; circle(g, 30, 28, 9); },
    bullet(g) { g.fillStyle = '#ff9a2a'; circle(g, 32, 32, 20); g.fillStyle = '#ffd27a'; circle(g, 32, 32, 13); g.fillStyle = '#fff6d8'; circle(g, 32, 32, 7); },
    pbullet(g) { g.fillStyle = '#7fd1ff'; circle(g, 32, 32, 20); g.fillStyle = '#cfefff'; circle(g, 32, 32, 13); g.fillStyle = '#ffffff'; circle(g, 32, 32, 7); },
  });
  function brazier(g, k) {
    line(g, 32, 41, 22, 63, 1.6, '#151515'); line(g, 32, 41, 42, 63, 1.6, '#151515'); line(g, 32, 41, 32, 63, 1.6, '#151515');
    g.fillStyle = '#222'; poly(g, 20, 30, 44, 30, 40, 42, 24, 42);
    g.fillStyle = '#ff8a2a'; for (let x = 24; x < 40; x += 5) g.fillRect(x, 33, 2, 6);
    const s = k ? 1 : -1;
    g.fillStyle = '#c4361c'; poly(g, 20, 31, 25 + s * 2, 12, 31, 20, 37 - s * 2, 6, 44, 31);
    g.fillStyle = '#ff8a2a'; poly(g, 23, 31, 28, 15 + s * 2, 33, 22, 37, 12 - s * 2, 41, 31);
    g.fillStyle = '#ffd27a'; poly(g, 27, 31, 31, 19 - s, 35, 23, 38, 31);
    g.fillStyle = '#fff3c4'; ell(g, 32, 29, 3, 2);
    g.fillStyle = '#ffd27a'; g.fillRect(26 + s * 3, 4, 1, 1); g.fillRect(38 - s * 2, 2, 1, 1);
  }

  /* ---------- 建置 ---------- */
  G.buildAssets = function () {
    let seed = 11;
    for (const k in TEXGEN) TEX[k] = makeTex(TEXGEN[k], seed++);
    for (const set in ENEMY_DRAW) {
      if (!G.CONFIG.enemies[set]) continue;
      SPR[set] = {};
      for (const f of G.ENEMY_FRAMES) {
        SPR[set][f] = makeTex((g) => {
          if (f === 'dead') { drawDead(g, set); return; }
          const ff = f === 'pain' ? 'w0' : f === 'reload' && set !== 'teppo' ? 'w0' : f;
          ENEMY_DRAW[set](g, ff);
          if (f === 'pain') { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,40,30,.45)'; g.fillRect(0, 0, 64, 64); g.globalCompositeOperation = 'source-over'; }
        }, seed++);
      }
    }
    for (const b of G.CONFIG.blades) if (!b.infinite) SPR['blade_' + b.id] = makeTex((g) => G.drawBladeItem(g, b), seed++);
    for (const k in ITEMGEN) SPR[k] = makeTex((g, r) => ITEMGEN[k](g, r), seed++);
  };

  G.WALLTEX = { W: 'plaster', K: 'fusuma', S: 'shoji', D: 'door', J: 'shojiDoor', P: 'pillar' };
})();
