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
    // 這一局的數值複本：升級只改這裡，不動 CONFIG
    P.stats = JSON.parse(JSON.stringify(C.player));
    P.bl = {}; for (const b of C.blades) P.bl[b.id] = JSON.parse(JSON.stringify(b));
    P.up = {}; P.trail = [];
    const S = (G.S = {
      seed, W: M.W, H: M.H, grid: M.grid, doors: new Map(), enemies: [], items: L.items, decor: L.decor, fx: [],
      spawnPts: L.spawnPts, P, time: 0, kills: 0, state: 'play', paused: false, showMap: false,
      flow: null, flowT: 0, spawnT: C.director.grace, light: 0, shake: 0, hitStop: 0, ougiFlash: 0, pickT: 0, deadT: 0,
      stats: { parry: 0, issen: 0, tome: 0, ougi: 0 }, projs: [], lobs: [],
      kakugo: 0, kakugoNeed: C.kakugo.first, level: 0, jisei: 0, pendingUp: 0,
    });
    for (let i = 0; i < M.grid.length; i++) if (G.isDoor(M.grid[i])) S.doors.set(i, { o: 0, st: 0, hold: 0 });
    S.wallHp = new Float32Array(M.grid.length);
    for (let i = 0; i < M.grid.length; i++) { const w = C.walls.breakable[M.grid[i]]; if (w) S.wallHp[i] = w.hp; }
    // 開局：幾名足輕已在遠處房間徘徊
    const far = M.rooms.filter((r) => L.dist[r.i] >= 2);
    G.shuffle(far).slice(0, 3).forEach((r) => G.spawnEnemy('yari', r.x0 + G.rnd(1, 4), r.y0 + G.rnd(1, 4), false));
    G.buildFlow(); G.initHud(); G.updateHud(0); G.showJisei();
    if (G.clearLines) G.clearLines();
    if (C.intro) startIntro(C.intro);
    return S;
  };

  /* 開場：面前站一個兵，台詞跑完之前他不會動 */
  function startIntro(I) {
    const S = G.S, P = S.P;
    let best = P.a, bd = 0;
    for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2, R = G.cast(P.x, P.y, Math.cos(a), Math.sin(a)); if (R.dist > bd) { bd = R.dist; best = a; } }
    P.a = best;
    if (I.enemy) {
      const d = Math.min(I.dist || 2.4, bd - 0.6);
      const e = G.spawnEnemy(I.enemy, P.x + Math.cos(best) * d, P.y + Math.sin(best) * d, true);
      e.frozen = true; S.introEnemy = e;
    }
    let t = 0;
    for (const l of I.lines) { setTimeout(() => { if (G.S === S) G.say(l.text, { who: l.who, dur: l.dur }); }, (l.at != null ? l.at : t) * 1000); t += l.dur || 1.6; }
    S.introT = I.lines.reduce((m, l) => Math.max(m, (l.at || 0) + (l.dur || 1.6)), 0);
    S.spawnT = Math.max(S.spawnT, S.introT + 2);
  }

  function update(dt, realDt) {
    const S = G.S, P = S.P, C = G.ps(), IN = G.IN;
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
    if (S.introT > 0) { S.introT -= dt; if (S.introT <= 0 && S.introEnemy) { S.introEnemy.frozen = false; S.introEnemy.cd = 0.8; } }
    if (S.state === 'play') G.updateCombat(dt);

    S.light = Math.max(0, S.light - dt * 8); S.shake = Math.max(0, S.shake - dt * 2.5);
    S.ougiFlash = Math.max(0, S.ougiFlash - dt * 1.5); S.pickT = Math.max(0, S.pickT - dt);
    P.hurtT = Math.max(0, P.hurtT - dt);
    G.updateDoors(dt);
    S.flowT -= dt; if (S.flowT <= 0) { G.buildFlow(); S.flowT = 0.35; }
    G.updateEnemies(dt); G.updateProjs(dt); G.updateLobs(dt);
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
        G.sfx('pickup'); G.toast(G.TX('whetstone', '砥石：名刀鋒利度恢復')); S.pickT = 0.25; return false;
      }
      if (it.kind === 'onigiri') {
        const st = P.stats;
        if (P.hp >= st.maxHealth) return true;
        P.hp = Math.min(st.maxHealth, P.hp + st.onigiriHeal);
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
    const gs = D.groupSize || [1, 1], n = G.rint(gs[0], gs[1]);
    for (let i = 0; i < n; i++) G.spawnEnemy(type, pt.x + G.rnd(-0.25, 0.25), pt.y + G.rnd(-0.25, 0.25), true);
    if (type === 'tate' && Math.random() < 0.7) G.spawnEnemy('yari', pt.x + G.rnd(-0.2, 0.2), pt.y + G.rnd(-0.2, 0.2), true);
  }

  /* 覺悟：每次斬殺累積，滿了就升級（三選一）；主模式到上限後改為念出辭世之句 */
  G.onKill = function (tome) {
    const S = G.S, K = G.CONFIG.kakugo;
    S.kakugo += 1 + (tome ? K.tomeBonus : 0);
    while (S.kakugo >= S.kakugoNeed) {
      S.kakugo -= S.kakugoNeed; S.kakugoNeed += K.step;
      if (S.level + S.pendingUp < K.levelCap || S.endless) S.pendingUp++;
      else if (S.jisei < G.CONFIG.jisei.length) { S.jisei++; G.showJisei(); }
    }
  };

  G.hurtPlayer = function (d, heavy) {
    const S = G.S, P = S.P; if (S.state !== 'play') return;
    d *= P.stats.dmgTaken;
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
    if (S.pendingUp > 0 && S.state === 'play' && !G.screenShown) G.showUpgrade();
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
