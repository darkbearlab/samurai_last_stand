/* 射線引擎繪製：牆、地板、天花板、精靈 */
(function () {
  'use strict';
  const G = window.G;
  let view, cv, ctx, W = 320, H = 200, PLANE = 0.8, img, buf, zbuf;
  // 紙牆（障子、障子戸）每一欄的資訊：用來畫出對面的影子
  let farD, pTop, pLh, pTx, pTex;

  G.initRender = function () {
    view = G.$('view'); cv = G.$('cv'); ctx = cv.getContext('2d');
    G.resize(); addEventListener('resize', G.resize);
    // iOS 轉向時尺寸會晚一點才穩定，多量幾次
    const late = () => { G.resize(); setTimeout(G.resize, 150); setTimeout(G.resize, 500); };
    addEventListener('orientationchange', late);
    if (window.visualViewport) visualViewport.addEventListener('resize', G.resize);
  };
  G.resize = function () {
    H = G.CONFIG.render.height;
    const r = view.getBoundingClientRect(), asp = r.width / Math.max(1, r.height);
    W = G.clamp(Math.round((H * asp) / 2) * 2, 240, 420);
    cv.width = W; cv.height = H;
    img = ctx.createImageData(W, H); buf = new Uint32Array(img.data.buffer); zbuf = new Float32Array(W);
    farD = new Float32Array(W); pTop = new Float32Array(W); pLh = new Float32Array(W); pTx = new Int32Array(W); pTex = new Array(W);
    PLANE = W / H / 2; ctx.imageSmoothingEnabled = false;
    if (G.resizeUI) G.resizeUI();
  };

  G.marks = [];
  G.viewSize = () => [W, H];
  function shade(c, s) { return 0xff000000 | ((((c >>> 16) & 255) * s) >> 8 << 16) | ((((c >>> 8) & 255) * s) >> 8 << 8) | (((c & 255) * s) >> 8); }
  function lightAt(d, fog) { const v = 1.08 - d / fog; return v <= 0 ? 0 : v >= 1 ? 256 : (v * 256) | 0; }

  G.enemyFrame = function (e) {
    if (e.dead) return 'dead';
    if (e.painT > 0) return 'pain';
    if (e.atkT > 0) return 'atk';
    if (e.phase === 'windup' || e.phase === 'aim') return 'wind';
    if (e.phase === 'reload') return 'reload';
    return e.moving && ((G.S.time * 4 + e.ph) | 0) % 2 ? 'w1' : 'w0';
  };

  function renderWorld() {
    const S = G.S, P = S.P, half = H >> 1, dirX = Math.cos(P.a), dirY = Math.sin(P.a), plX = -dirY * PLANE, plY = dirX * PLANE;
    const fog = G.CONFIG.render.fog * (1 + S.light * 0.5), fT = G.TEX.tatami, cT = G.TEX.ceil;
    const rd0x = dirX - plX, rd0y = dirY - plY, rd1x = dirX + plX, rd1y = dirY + plY;
    for (let y = half; y < H; y++) {
      const rowDist = half / (y - half + 0.5), sx = (rowDist * (rd1x - rd0x)) / W, sy = (rowDist * (rd1y - rd0y)) / W;
      let fx = P.x + rowDist * rd0x, fy = P.y + rowDist * rd0y;
      const sh = lightAt(rowDist, fog), rf = y * W, rc = (H - 1 - y) * W;
      for (let x = 0; x < W; x++) {
        const ti = ((((fy * 64) | 0) & 63) << 6) | (((fx * 64) | 0) & 63);
        buf[rf + x] = shade(fT[ti], sh); buf[rc + x] = shade(cT[ti], (sh * 0.85) | 0);
        fx += sx; fy += sy;
      }
    }
    for (let x = 0; x < W; x++) {
      const cam = (2 * x) / W - 1, rdx = dirX + plX * cam, rdy = dirY + plY * cam;
      const R = G.cast(P.x, P.y, rdx, rdy, true);
      let c = R.c, dist = Math.max(R.dist, 0.0001), u = R.u, side = R.side;
      pTex[x] = null;
      if (R.pc) { // 前面是紙牆：畫紙牆，記下後面實牆的距離
        farD[x] = dist; c = R.pc; dist = Math.max(R.pd, 0.0001); u = R.pu; side = R.pside;
      }
      zbuf[x] = dist; if (!c) continue;
      const t = G.TEX[G.WALLTEX[c]];
      let tx = Math.min(63, (u * 64) | 0);
      if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) tx = 63 - tx;
      const lh = H / dist, top = half - lh / 2, y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(H, Math.ceil(top + lh));
      if (R.pc) { pTex[x] = t; pTop[x] = top; pLh[x] = lh; pTx[x] = tx; }
      let sh = lightAt(dist, fog); if (side === 1) sh = (sh * 0.74) | 0;
      const step = 64 / lh; let ty = (y0 - top) * step;
      for (let y = y0; y < y1; y++) { buf[y * W + x] = shade(t[(((ty | 0) & 63) << 6) | tx], sh); ty += step; }
    }

    const list = []; G.marks.length = 0;
    for (const e of S.enemies) {
      const fr = G.enemyFrame(e);
      list.push({ kind: e.dead ? 0 : 'enemy', e, x: e.x, y: e.y, t: G.SPR[e.type][fr], s: e.T.scale, l: 0, b: !e.dead && (e.phase === 'windup' || e.phase === 'aim') && e.phT < 0.3 });
    }
    for (const it of S.items) {
      if (it.kind === 'blade') list.push({ x: it.x, y: it.y, t: G.SPR['blade_' + it.id], s: 0.95, l: Math.sin(S.time * 2 + it.x) * 0.02, b: true });
      else list.push({ x: it.x, y: it.y, t: G.SPR[it.kind], s: 1, l: 0 });
    }
    for (const d of S.decor) list.push({ kind: 'fire', x: d.x, y: d.y, t: G.SPR[((S.time * 6 + d.x) | 0) % 2 ? 'brazier1' : 'brazier0'], s: 1, l: 0, b: true });
    for (const p of S.projs) list.push({ x: p.x, y: p.y, t: G.SPR[p.enemy ? 'bullet' : 'pbullet'], s: 0.22, l: 0.42, b: true });
    for (const f of S.fx) list.push({ x: f.x, y: f.y, t: G.SPR[f.spr], s: f.s, l: f.l, b: f.b });
    for (const s of list) s.d = (s.x - P.x) ** 2 + (s.y - P.y) ** 2;
    list.sort((a, b) => b.d - a.d);
    const invDet = 1 / (plX * dirY - dirX * plY);
    for (const s of list) {
      const sx = s.x - P.x, sy = s.y - P.y, tX = invDet * (dirY * sx - dirX * sy), tY = invDet * (-plY * sx + plX * sy);
      if (tY < 0.15) continue;
      const scrX = (W / 2) * (1 + tX / tY), full = H / tY, sz = full * s.s, bottom = half + full / 2 - s.l * full, top = bottom - sz, left = scrX - sz / 2;
      const x0 = Math.max(0, Math.ceil(left)), x1 = Math.min(W, Math.ceil(left + sz)), y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(H, Math.ceil(bottom));
      if (x0 >= x1 || y0 >= y1) continue;
      if (s.e && !s.e.dead && (s.e.phase === 'windup' || s.e.phase === 'aim')) {
        const col = G.clamp(scrX | 0, 0, W - 1), e = s.e;
        if (tY < zbuf[col]) G.marks.push({ x: scrX, y: top + sz * 0.02, p: (e.wind - e.phT) / e.wind, wind: e.wind, gun: e.T.kind === 'gun', shot: e.T.kind === 'shooter', dist: tY });
      }
      const sh = s.b ? 256 : lightAt(tY, fog), k = 64 / sz, t = s.t;
      for (let x = x0; x < x1; x++) {
        if (tY >= zbuf[x]) continue;
        const tx = ((x - left) * k) | 0;
        for (let y = y0; y < y1; y++) {
          const c = t[((((y - top) * k) | 0) << 6) + tx];
          if (c === undefined || c >>> 24 < 128) continue;
          buf[y * W + x] = shade(c, sh);
        }
      }
    }
    paperShadows(list, P, dirX, dirY, plX, plY, invDet, half);
  }

  /* 紙牆後面的敵人與篝火，在紙上透出影子／火光 */
  function paperShadows(list, P, dirX, dirY, plX, plY, invDet, half) {
    for (const s of list) {
      const shadow = s.kind === 'enemy', glow = s.kind === 'fire';
      if (!shadow && !glow) continue;
      const sx = s.x - P.x, sy = s.y - P.y, tX = invDet * (dirY * sx - dirX * sy), tY = invDet * (-plY * sx + plX * sy);
      if (tY < 0.15 || tY > 14) continue;
      const scrX = (W / 2) * (1 + tX / tY), full = H / tY, sz = full * s.s, bottom = half + full / 2 - s.l * full, top = bottom - sz, left = scrX - sz / 2;
      const x0 = Math.max(0, Math.ceil(left)), x1 = Math.min(W, Math.ceil(left + sz)), y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(H, Math.ceil(bottom));
      if (x0 >= x1 || y0 >= y1) continue;
      const k = 64 / sz, t = s.t;
      for (let x = x0; x < x1; x++) {
        const pt = pTex[x];
        if (!pt || tY <= zbuf[x] || tY >= farD[x]) continue;
        // 離紙越近影子越深、越清楚
        const gap = tY - zbuf[x], dark = shadow ? (gap < 0.6 ? 120 : gap < 2 ? 160 : 195) : 0;
        const tx = ((x - left) * k) | 0, ptop = pTop[x], plh = pLh[x], ptx = pTx[x];
        for (let y = y0; y < y1; y++) {
          const c = t[((((y - top) * k) | 0) << 6) + tx];
          if (c === undefined || c >>> 24 < 128) continue;
          const vy = (((y - ptop) / plh) * 64) | 0;
          if (vy < 0 || vy > 63) continue;
          const paper = pt[(vy << 6) | ptx];
          if ((paper & 255) < 170) continue; // 只有紙的部分透影，木格不透
          const i = y * W + x, b = buf[i];
          if (shadow) buf[i] = shade(b, dark);
          else buf[i] = 0xff000000 | (Math.min(255, ((b >>> 16) & 255) * 0.8) << 16) | (Math.min(255, ((b >>> 8) & 255) * 1.05 + 20) << 8) | Math.min(255, (b & 255) * 1.1 + 70);
        }
      }
    }
  }

  function drawAutomap() {
    const S = G.S, s = 4, ox = W - S.W * s - 6, oy = 6;
    const col = { W: '#8a8170', P: '#5a3f2c', K: '#b8995a', S: '#e8e0cc', D: '#4f6f93', J: '#9fb6cf' };
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(ox - 2, oy - 2, S.W * s + 4, S.H * s + 4);
    for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) { const c = S.grid[y * S.W + x]; if (c) { ctx.fillStyle = col[c]; ctx.fillRect(ox + x * s, oy + y * s, s, s); } }
    for (const d of S.decor) { ctx.fillStyle = '#ff8a2a'; ctx.fillRect(ox + d.x * s - 1, oy + d.y * s - 1, 2, 2); }
    for (const it of S.items) { ctx.fillStyle = it.kind === 'blade' ? G.blade(it.id).color : '#9a8f78'; const z = it.kind === 'blade' ? 3 : 2; ctx.fillRect(ox + it.x * s - z / 2, oy + it.y * s - z / 2, z, z); }
    ctx.fillStyle = '#e2553b'; for (const e of S.enemies) if (!e.dead) ctx.fillRect(ox + e.x * s - 1, oy + e.y * s - 1, 2, 2);
    const P = S.P; ctx.fillStyle = '#fff'; ctx.fillRect(ox + P.x * s - 1.5, oy + P.y * s - 1.5, 3, 3);
    ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(ox + P.x * s, oy + P.y * s); ctx.lineTo(ox + (P.x + Math.cos(P.a) * 2) * s, oy + (P.y + Math.sin(P.a) * 2) * s); ctx.stroke();
  }

  G.draw = function () {
    const S = G.S, P = S.P;
    renderWorld(); ctx.putImageData(img, 0, 0);
    if (S.state !== 'dead') G.drawFirstPerson(ctx, W, H);
    if (S.ougiFlash > 0) { ctx.fillStyle = `rgba(255,250,235,${Math.min(0.9, S.ougiFlash)})`; ctx.fillRect(0, 0, W, H); }
    if (P.hurtT > 0) { ctx.fillStyle = `rgba(170,20,10,${Math.min(0.5, P.hurtT)})`; ctx.fillRect(0, 0, W, H); }
    if (S.pickT > 0) { ctx.fillStyle = `rgba(255,220,150,${S.pickT * 0.6})`; ctx.fillRect(0, 0, W, H); }
    if (S.state === 'dead') { ctx.fillStyle = `rgba(70,0,0,${Math.min(0.65, S.deadT * 0.5)})`; ctx.fillRect(0, 0, W, H); }
    if (S.showMap) drawAutomap();
    const sh = S.shake > 0 ? S.shake * 6 : 0;
    cv.style.transform = sh ? `translate(${G.rnd(-sh, sh).toFixed(1)}px,${G.rnd(-sh, sh).toFixed(1)}px)` : '';
    G.drawUI();
  };
})();
