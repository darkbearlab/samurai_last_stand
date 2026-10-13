/* 射線引擎繪製：牆、地板、天花板、精靈 */
(function () {
  'use strict';
  const G = window.G;
  let view, cv, ctx, W = 320, H = 200, PLANE = 0.8, img, buf, zbuf;

  G.initRender = function () {
    view = G.$('view'); cv = G.$('cv'); ctx = cv.getContext('2d');
    G.resize(); addEventListener('resize', G.resize);
  };
  G.resize = function () {
    H = G.CONFIG.render.height;
    const r = view.getBoundingClientRect(), asp = r.width / Math.max(1, r.height);
    W = G.clamp(Math.round((H * asp) / 2) * 2, 240, 420);
    cv.width = W; cv.height = H;
    img = ctx.createImageData(W, H); buf = new Uint32Array(img.data.buffer); zbuf = new Float32Array(W);
    PLANE = W / H / 2; ctx.imageSmoothingEnabled = false;
    if (G.resizeUI) G.resizeUI();
  };

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
      const R = G.cast(P.x, P.y, rdx, rdy), dist = Math.max(R.dist, 0.0001);
      zbuf[x] = dist; if (!R.c) continue;
      const t = G.TEX[G.WALLTEX[R.c]];
      let tx = Math.min(63, (R.u * 64) | 0);
      if ((R.side === 0 && rdx > 0) || (R.side === 1 && rdy < 0)) tx = 63 - tx;
      const lh = H / dist, top = half - lh / 2, y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(H, Math.ceil(top + lh));
      let sh = lightAt(dist, fog); if (R.side === 1) sh = (sh * 0.74) | 0;
      const step = 64 / lh; let ty = (y0 - top) * step;
      for (let y = y0; y < y1; y++) { buf[y * W + x] = shade(t[(((ty | 0) & 63) << 6) | tx], sh); ty += step; }
    }

    const list = [];
    for (const e of S.enemies) {
      const fr = G.enemyFrame(e);
      list.push({ x: e.x, y: e.y, t: G.SPR[e.type][fr], s: e.T.scale, l: 0, b: !e.dead && (e.phase === 'windup' || e.phase === 'aim') && e.phT < 0.3 });
    }
    for (const it of S.items) {
      if (it.kind === 'blade') list.push({ x: it.x, y: it.y, t: G.SPR['blade_' + it.id], s: 0.95, l: Math.sin(S.time * 2 + it.x) * 0.02, b: true });
      else list.push({ x: it.x, y: it.y, t: G.SPR[it.kind], s: 1, l: 0 });
    }
    for (const d of S.decor) list.push({ x: d.x, y: d.y, t: G.SPR[((S.time * 6 + d.x) | 0) % 2 ? 'brazier1' : 'brazier0'], s: 1, l: 0, b: true });
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
  }

  function drawAutomap() {
    const S = G.S, s = 4, ox = W - S.W * s - 6, oy = 6;
    const col = { W: '#8a8170', P: '#5a3f2c', K: '#b8995a', S: '#e8e0cc', D: '#4f6f93' };
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
