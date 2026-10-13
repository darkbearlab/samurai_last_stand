/* 碰撞、視線、射線、門、尋路 */
(function () {
  'use strict';
  const G = window.G;

  G.isDoor = (c) => c === 'D' || c === 'J';
  G.isPaper = (c) => c === 'S' || c === 'J'; // 紙糊的：會透出對面的影子
  G.cell = function (x, y) { const S = G.S; if (x < 0 || y < 0 || x >= S.W || y >= S.H) return 'W'; return S.grid[y * S.W + x]; };
  G.doorOpen = function (x, y) { const d = G.S.doors.get(y * G.S.W + x); return d ? d.o : 0; };
  G.solidAt = function (x, y) {
    const cx = Math.floor(x), cy = Math.floor(y), c = G.cell(cx, cy);
    if (!c) return false;
    if (G.isDoor(c)) return G.doorOpen(cx, cy) < 0.9;
    return true;
  };
  G.blocked = function (x, y, r) {
    if (G.solidAt(x - r, y - r) || G.solidAt(x + r, y - r) || G.solidAt(x - r, y + r) || G.solidAt(x + r, y + r)) return true;
    for (const d of G.S.decor) if (d.solid && Math.abs(d.x - x) < r + 0.22 && Math.abs(d.y - y) < r + 0.22) return true;
    return false;
  };
  G.move = function (e, dx, dy, r) {
    if (!G.blocked(e.x + dx, e.y, r)) e.x += dx;
    if (!G.blocked(e.x, e.y + dy, r)) e.y += dy;
  };
  G.los = function (x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.hypot(dx, dy) / 0.2);
    for (let i = 1; i < n; i++) {
      const x = Math.floor(x0 + (dx * i) / n), y = Math.floor(y0 + (dy * i) / n), c = G.cell(x, y);
      if (c && !(G.isDoor(c) && G.doorOpen(x, y) > 0.8)) return false;
    }
    return true;
  };

  const RAY = (G.RAY = { c: 0, dist: 64, side: 0, u: 0, mx: 0, my: 0, pc: 0, pd: 0, pu: 0, pside: 0 });
  /* seePaper：碰到紙牆時先記下（pc/pd/pu），再繼續找後面的實牆 */
  G.cast = function (px, py, rdx, rdy, seePaper) {
    let mx = px | 0, my = py | 0;
    const ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx), ddy = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
    let stx, sty, sdx, sdy;
    if (rdx < 0) { stx = -1; sdx = (px - mx) * ddx; } else { stx = 1; sdx = (mx + 1 - px) * ddx; }
    if (rdy < 0) { sty = -1; sdy = (py - my) * ddy; } else { sty = 1; sdy = (my + 1 - py) * ddy; }
    RAY.c = 0; RAY.dist = 64; RAY.pc = 0;
    for (let i = 0; i < 128; i++) {
      let side;
      if (sdx < sdy) { sdx += ddx; mx += stx; side = 0; } else { sdy += ddy; my += sty; side = 1; }
      const c = G.cell(mx, my); if (!c) continue;
      const d = side === 0 ? sdx - ddx : sdy - ddy;
      let u = side === 0 ? py + d * rdy : px + d * rdx; u -= Math.floor(u);
      if (G.isDoor(c)) { const o = G.doorOpen(mx, my); if (u < o) continue; u -= o; }
      if (seePaper && !RAY.pc && G.isPaper(c)) { RAY.pc = c; RAY.pd = d; RAY.pu = u; RAY.pside = side; continue; }
      RAY.c = c; RAY.dist = d; RAY.side = side; RAY.u = u; RAY.mx = mx; RAY.my = my;
      return RAY;
    }
    return RAY;
  };

  /* 引き戸：有人靠近就自動拉開，沒人時延遲關上 */
  G.updateDoors = function (dt) {
    const S = G.S;
    for (const [k, d] of S.doors) {
      const x = k % S.W, y = (k / S.W) | 0, cx = x + 0.5, cy = y + 0.5;
      let near = Math.hypot(S.P.x - cx, S.P.y - cy) < 1.35, occ = (S.P.x | 0) === x && (S.P.y | 0) === y;
      for (const e of S.enemies) {
        if (e.dead) continue;
        if (!near && Math.hypot(e.x - cx, e.y - cy) < 1.35) near = true;
        if ((e.x | 0) === x && (e.y | 0) === y) occ = true;
      }
      if (near) { if (d.st === 0 || d.st === 3) { d.st = 1; G.sfx('door', Math.hypot(S.P.x - cx, S.P.y - cy)); } d.hold = 1.2; }
      if (d.st === 1) { d.o += dt * 2.4; if (d.o >= 1) { d.o = 1; d.st = 2; } }
      else if (d.st === 2) { if (!near) { d.hold -= dt; if (d.hold <= 0 && !occ) d.st = 3; } }
      else if (d.st === 3) { if (occ) d.st = 1; else { d.o -= dt * 2.4; if (d.o <= 0) { d.o = 0; d.st = 0; } } }
    }
  };

  /* 以玩家為源點的 BFS 流場，敵人看不到玩家時沿著它走 */
  G.buildFlow = function () {
    const S = G.S, n = S.W * S.H;
    if (!S.flow) S.flow = new Int16Array(n);
    const D = S.flow; D.fill(-1);
    const s = Math.floor(S.P.y) * S.W + Math.floor(S.P.x); D[s] = 0; const q = [s];
    for (let i = 0; i < q.length; i++) {
      const c = q[i], cx = c % S.W, cy = (c / S.W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= S.W || ny >= S.H) continue;
        const k = ny * S.W + nx; if (D[k] >= 0) continue;
        const ch = S.grid[k]; if (ch && !G.isDoor(ch)) continue;
        D[k] = D[c] + 1; q.push(k);
      }
    }
  };

  G.addFx = function (x, y, spr, t, o) {
    G.S.fx.push(Object.assign({ x, y, spr, t: t || 0.2, l: 0.4, s: 0.22, b: false }, o || {}));
  };
})();
