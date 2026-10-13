/* 遊戲狀態、主迴圈、敵人湧入（director） */
(function () {
  'use strict';
  const G = window.G;

  G.newGame = function (seed) {
    const C = G.CONFIG;
    seed = seed || (Math.random() * 1e9) | 0;
    const M = G.genPalace(seed), L = G.populate(M);
    const P = {
      x: L.start.x, y: L.start.y, a: Math.random() * Math.PI * 2,
      hp: C.player.maxHealth, st: C.player.maxStamina, stDelay: 0,
      owned: { wakizashi: true }, sharp: {}, cur: 'wakizashi',
      act: 'idle', actT: 0, charge: 0, pending: null, buffer: 0,
      lastParry: -9, parryCd: 0, issenT: 0, ougi: 0, recoilT: 0, hurtT: 0,
      bob: 0, moveAmt: 0, fireNear: false,
      swingZone: 'light', swingDur: 0.2, swingTotal: 0.3, swingFrom: -1.9, swingIssen: false,
    };
    for (const b of C.blades) P.sharp[b.id] = 100;
    const S = (G.S = {
      seed, W: M.W, H: M.H, grid: M.grid, doors: new Map(), enemies: [], items: L.items, decor: L.decor, fx: [],
      spawnPts: L.spawnPts, P, time: 0, kills: 0, state: 'play', paused: false, showMap: false,
      flow: null, flowT: 0, spawnT: C.director.grace, light: 0, shake: 0, hitStop: 0, ougiFlash: 0, pickT: 0, deadT: 0,
      stats: { parry: 0, issen: 0, tome: 0, ougi: 0 },
    });
    for (let i = 0; i < M.grid.length; i++) if (G.isDoor(M.grid[i])) S.doors.set(i, { o: 0, st: 0, hold: 0 });
    // 開局：幾名足輕已在遠處房間徘徊
    const far = M.rooms.filter((r) => L.dist[r.i] >= 2);
    G.shuffle(far).slice(0, 3).forEach((r) => G.spawnEnemy('yari', r.x0 + G.rnd(1, 4), r.y0 + G.rnd(1, 4), false));
    G.buildFlow(); G.initHud(); G.updateHud(0);
    return S;
  };

  function update(dt, realDt) {
    const S = G.S, P = S.P, C = G.CONFIG.player, IN = G.IN;
    S.time += S.state === 'play' ? dt : 0;
    // 移動
    let fwd = 0, str = 0, turn = 0;
    if (S.state === 'play') {
      const k = IN.keys;
      if (k.has('w') || k.has('arrowup')) fwd += 1;
      if (k.has('s') || k.has('arrowdown')) fwd -= 1;
      if (k.has('a')) str -= 1; if (k.has('d')) str += 1;
      if (k.has('arrowleft')) turn -= 1; if (k.has('arrowright')) turn += 1;
      fwd -= IN.joy.y; str += IN.joy.x;
    }
    const m = Math.hypot(fwd, str); if (m > 1) { fwd /= m; str /= m; }
    P.a += turn * C.turnSpeed * realDt + IN.mouseDX * C.mouseSens + IN.touchDX * C.touchSens;
    IN.mouseDX = 0; IN.touchDX = 0;
    if (S.state === 'play' && dt > 0) {
      const slow = P.act === 'charge' ? 0.6 : 1;
      const sp = C.speed * (IN.keys.has('shift') ? C.runMul : 1) * slow * dt, ca = Math.cos(P.a), sa = Math.sin(P.a);
      const ox = P.x, oy = P.y;
      G.move(P, (ca * fwd - sa * str) * sp, (sa * fwd + ca * str) * sp, C.radius);
      const moved = Math.hypot(P.x - ox, P.y - oy) / dt / C.speed;
      P.moveAmt += (G.clamp(moved, 0, 1) - P.moveAmt) * Math.min(1, dt * 10); P.bob += dt * 9 * P.moveAmt;
    }
    if (dt <= 0) return;
    if (S.state === 'play') G.updateCombat(dt);

    S.light = Math.max(0, S.light - dt * 8); S.shake = Math.max(0, S.shake - dt * 2.5);
    S.ougiFlash = Math.max(0, S.ougiFlash - dt * 1.5); S.pickT = Math.max(0, S.pickT - dt);
    P.hurtT = Math.max(0, P.hurtT - dt);
    G.updateDoors(dt);
    S.flowT -= dt; if (S.flowT <= 0) { G.buildFlow(); S.flowT = 0.35; }
    G.updateEnemies(dt);
    for (const f of S.fx) f.t -= dt; S.fx = S.fx.filter((f) => f.t > 0);
    if (S.state === 'play') { pickups(); director(dt); }
    if (S.state === 'dead') { S.deadT += dt; if (S.deadT > 1.4 && !G.screenShown) G.showScreen('dead'); }
  }

  function pickups() {
    const S = G.S, P = S.P, C = G.CONFIG;
    S.items = S.items.filter((it) => {
      if (Math.hypot(it.x - P.x, it.y - P.y) > 0.6) return true;
      if (it.kind === 'blade') {
        const b = G.blade(it.id);
        P.owned[b.id] = true; P.sharp[b.id] = 100; G.startSwap(b.id);
        G.sfx('blade'); G.toast(`得 ${b.name}`); S.pickT = 0.5;
        setTimeout(() => G.toast(b.note), 1400);
        return false;
      }
      if (it.kind === 'whetstone') {
        const W = C.pickups.whetstone; let any = false;
        for (const b of C.blades) if (P.owned[b.id] && !b.infinite && P.sharp[b.id] < 100) {
          P.sharp[b.id] = Math.min(100, P.sharp[b.id] + (b.restore === 'whetstone' ? W.main : W.other)); any = true;
        }
        if (!any) return true;
        G.sfx('pickup'); G.toast('砥石：名刀鋒利度恢復'); S.pickT = 0.25; return false;
      }
      if (it.kind === 'onigiri') {
        if (P.hp >= C.player.maxHealth) return true;
        P.hp = Math.min(C.player.maxHealth, P.hp + C.pickups.onigiri.heal);
        G.sfx('pickup'); G.toast('握り飯'); S.pickT = 0.25; return false;
      }
      return true;
    });
  }

  function director(dt) {
    const S = G.S, D = G.CONFIG.director, P = S.P;
    let alive = 0; for (const e of S.enemies) if (!e.dead) alive++;
    const target = Math.min(D.maxAlive, D.startAlive + Math.floor(S.time / D.growEvery));
    S.spawnT -= dt;
    if (alive >= target || S.spawnT > 0) return;
    S.spawnT = D.spawnInterval * G.rnd(0.7, 1.3);
    const far = S.spawnPts.filter((p) => Math.hypot(p.x - P.x, p.y - P.y) > D.minSpawnDist);
    if (!far.length) return;
    let pt = null;
    for (let i = 0; i < 8 && !pt; i++) { const c = G.pick(far); if (!G.los(c.x, c.y, P.x, P.y)) pt = c; }
    pt = pt || G.pick(far);
    const mix = D.mix.filter((m) => m.t <= S.time).pop().w;
    let roll = Math.random() * Object.values(mix).reduce((a, b) => a + b, 0), type = 'yari';
    for (const k in mix) { roll -= mix[k]; if (roll <= 0) { type = k; break; } }
    G.spawnEnemy(type, pt.x, pt.y, true);
    if (type === 'tate' && Math.random() < 0.7) G.spawnEnemy('yari', pt.x + G.rnd(-0.2, 0.2), pt.y + G.rnd(-0.2, 0.2), true);
  }

  G.hurtPlayer = function (d, heavy) {
    const S = G.S, P = S.P; if (S.state !== 'play') return;
    P.hp -= d; P.hurtT = 0.45; S.shake = Math.max(S.shake, 0.3); G.sfx('hurt');
    if (heavy && P.act === 'charge') { P.act = 'idle'; P.charge = 0; }
    if (P.hp <= 0) { P.hp = 0; S.state = 'dead'; S.deadT = 0; G.IN.atkHeld = false; }
  };

  let last = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
    const S = G.S; if (!S) return;
    const running = S.state === 'play' && !S.paused && !G.screenShown;
    if (running || S.state === 'dead') {
      let gdt = dt; if (S.hitStop > 0) { S.hitStop -= dt; gdt = 0; }
      update(gdt, dt);
    }
    G.updateHud(dt);
    G.draw();
    G.clearInputEdges();
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden && G.S && G.S.state === 'play' && !G.S.paused && !G.screenShown) G.togglePause(); });

  window.addEventListener('DOMContentLoaded', () => {
    G.buildAssets(); G.initRender(); G.initUI(); G.initInput();
    G.newGame(); G.showScreen('start');
    requestAnimationFrame(frame);
  });
})();
