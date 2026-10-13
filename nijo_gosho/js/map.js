/* =====================================================================
   御所生成：N×N 個房間的格子，房間之間用襖（固定壁）分隔，
   以隨機生成樹開門保證連通，再加少量額外的門製造迴圈。
   部分隔間牆是障子，重擊可以砍穿，形成額外路線。
   地圖字元：W 外牆、P 柱、K 襖壁、S 障子、D 引き戸、0 空地
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G;

  G.genPalace = function (seed) {
    const C = G.CONFIG.map, r = G.mulberry(seed);
    const N = C.rooms, RS = C.roomSize, P = RS + 1, W = N * P + 1, H = W;
    const grid = new Array(W * H).fill(0);
    const at = (x, y) => y * W + x;

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const onX = x % P === 0, onY = y % P === 0;
      if (!onX && !onY) continue;
      const outer = x === 0 || y === 0 || x === W - 1 || y === H - 1;
      if (onX && onY) grid[at(x, y)] = 'P';
      else if (outer) grid[at(x, y)] = 'W';
      else grid[at(x, y)] = r() < C.shojiChance ? 'S' : 'K';
    }

    const rooms = [];
    for (let ry = 0; ry < N; ry++) for (let rx = 0; rx < N; rx++) rooms.push({ i: ry * N + rx, rx, ry, x0: rx * P + 1, y0: ry * P + 1, adj: [] });

    const nbs = (i) => { const rx = i % N, ry = Math.floor(i / N), o = []; if (rx > 0) o.push(i - 1); if (rx < N - 1) o.push(i + 1); if (ry > 0) o.push(i - N); if (ry < N - 1) o.push(i + N); return o; };
    const key = (a, b) => (a < b ? a + '-' + b : b + '-' + a);
    const edges = [], has = new Set();
    const stack = [Math.floor(r() * N * N)], vis = new Set(stack);
    while (stack.length) {
      const cur = stack[stack.length - 1];
      const open = G.shuffle(nbs(cur).filter((n) => !vis.has(n)), r);
      if (!open.length) { stack.pop(); continue; }
      const n = open[0]; vis.add(n); edges.push([cur, n]); has.add(key(cur, n)); stack.push(n);
    }
    for (let i = 0; i < N * N; i++) for (const n of nbs(i)) if (n > i && !has.has(key(i, n)) && r() < C.extraDoorChance) { edges.push([i, n]); has.add(key(i, n)); }

    for (const [a, b] of edges) {
      const A = rooms[a], B = rooms[b]; A.adj.push(b); B.adj.push(a);
      const off = 1 + Math.floor(r() * (RS - 2)); // 避開房間角落
      let dx, dy;
      if (A.ry === B.ry) { dx = Math.max(A.rx, B.rx) * P; dy = A.ry * P + 1 + off; }
      else { dy = Math.max(A.ry, B.ry) * P; dx = A.rx * P + 1 + off; }
      grid[at(dx, dy)] = 'D';
    }
    return { W, H, grid, rooms, N, RS, P, r, seed };
  };

  G.roomDistances = function (M, start) {
    const dist = new Array(M.rooms.length).fill(-1); dist[start] = 0; const q = [start];
    for (let i = 0; i < q.length; i++) for (const n of M.rooms[q[i]].adj) if (dist[n] < 0) { dist[n] = dist[q[i]] + 1; q.push(n); }
    return dist;
  };

  /* 放置起點、名刀、篝火、砥石，並計算敵人湧入點 */
  G.populate = function (M) {
    const r = M.r, C = G.CONFIG.map, rooms = M.rooms, RS = M.RS;
    const start = rooms[Math.floor(r() * rooms.length)];
    const dist = G.roomDistances(M, start.i);
    const others = rooms.filter((x) => x !== start).sort((a, b) => dist[a.i] - dist[b.i] || a.i - b.i);
    const n = others.length, used = new Set(), bladeRooms = [];
    for (const q of [0.12, 0.38, 0.64, 1]) {
      let k = Math.min(n - 1, Math.floor(q * (n - 1)));
      while (used.has(k)) k = (k + 1) % n;
      used.add(k); bladeRooms.push(others[k]);
    }
    const ids = G.shuffle(G.CONFIG.blades.filter((b) => !b.infinite).map((b) => b.id), r);
    const items = [], decor = [];
    bladeRooms.forEach((room, i) => items.push({ kind: 'blade', id: ids[i], x: room.x0 + RS / 2, y: room.y0 + RS / 2 }));

    const corners = [[0, 0], [RS - 1, 0], [0, RS - 1], [RS - 1, RS - 1]];
    G.shuffle(rooms.filter((x) => x !== start).slice(), r).slice(0, C.braziers).forEach((room) => {
      const c = corners[Math.floor(r() * 4)];
      decor.push({ kind: 'brazier', x: room.x0 + c[0] + 0.5, y: room.y0 + c[1] + 0.5, solid: true });
    });
    G.shuffle(rooms.filter((x) => x !== start).slice(), r).slice(0, C.whetstones).forEach((room) => {
      const ox = r() < 0.5 ? 1 : RS - 2, oy = r() < 0.5 ? 1 : RS - 2;
      items.push({ kind: 'whetstone', x: room.x0 + ox + 0.5, y: room.y0 + oy + 0.5 });
    });

    const spawnPts = [];
    for (let y = 1; y < M.H - 1; y++) for (let x = 1; x < M.W - 1; x++) {
      if (M.grid[y * M.W + x]) continue;
      if (x === 1 || y === 1 || x === M.W - 2 || y === M.H - 2) spawnPts.push({ x: x + 0.5, y: y + 0.5 });
    }
    return { start: { x: start.x0 + RS / 2, y: start.y0 + RS / 2, room: start }, items, decor, spawnPts, dist };
  };
})();
