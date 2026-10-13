/* =====================================================================
   御前比武 —— 鎖定式一對一決鬥原型
   - 永遠鎖定並面向對手；左邊移動，右邊是「攻」「守」兩顆搖桿鍵
   - 攻：按住後往左／右拖曳就位，放開從那一側揮出；在中間按住不動是刺擊
   - 守：敵人出手前按住並推向攻擊來的方向；時機好＝格擋（敵人硬直），否則只是防禦（扣架勢）
   - 刺擊擋不住，只能靠移動閃開
   - 雙方都有生命與架勢；架勢滿了會崩，崩的時候吃的傷害更重
   畫面、貼圖、音效沿用 ../nijo_gosho/js；這裡只寫決鬥本身。
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G, C = G.CONFIG;
  C.enemies = {}; // 不建本篇的足輕圖
  const $ = (id) => document.getElementById(id);

  /* ---------- 數值 ---------- */
  const D = {
    dead: 18,            // 拖曳多少像素才算選了左右
    thrustHold: 0.28,    // 在中間按住多久變成刺擊
    parryWin: 0.22,      // 推到方向後多久之內被打到算格擋
    player: { hp: 100, speed: 2.6, posMax: 100, posRegen: 16 },
    atk: { windup: 0.14, recover: 0.3, dmg: 22, posDmg: 12, reach: 2.15, thrustWind: 0.2, thrustReach: 2.5, thrustDmg: 30, thrustPos: 18 },
    block: { pos: 16 }, parry: { pos: 30, stun: 1.0 },
    foe: { hp: 100, posMax: 100, posRegen: 12, keep: 1.75, wind: 0.75, thrustWind: 0.85, recover: 0.5, whiffRecover: 0.95,
      cd: [0.8, 1.7], dmg: 18, thrustDmg: 26, reach: 2.2, thrustReach: 2.6,
      pBlock: 0.4, pCorrect: 0.75, pParry: 0.15, pDodge: 0.3, thrustChance: 0.22, speed: 1.6 },
  };
  const FOES = ['松永', '岩成', '池田', '三好', '篠原', '十河'];
  const NAMES = ['新左衛門', '主税', '兵庫', '右京', '小太郎', '左馬助'];

  /* ---------- 敵方武士的精靈圖 ---------- */
  const TS = 64;
  function makeTex(draw) {
    const c = document.createElement('canvas'); c.width = c.height = TS;
    const g = c.getContext('2d', { willReadFrequently: true }); draw(g);
    return new Uint32Array(g.getImageData(0, 0, TS, TS).data.buffer.slice(0));
  }
  function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  function poly(g, ...p) { g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.closePath(); g.fill(); }
  function line(g, x0, y0, x1, y1, w, c) { g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  function body(g) {
    g.fillStyle = '#2b2236'; poly(g, 22, 44, 42, 44, 45, 60, 34, 60, 32, 52, 30, 60, 19, 60);
    g.fillStyle = '#1a1412'; g.fillRect(19, 60, 10, 3); g.fillRect(35, 60, 10, 3);
    g.fillStyle = '#3a1414'; g.fillRect(19, 38, 26, 8);
    g.fillStyle = '#c8a050'; g.fillRect(19, 40, 26, 1); g.fillRect(19, 43, 26, 1);
    g.fillStyle = '#3a1414'; poly(g, 20, 22, 44, 22, 43, 39, 21, 39);
    g.fillStyle = '#c8a050'; for (let i = 0; i < 4; i++) g.fillRect(21, 25 + i * 3.5, 22, 1);
    g.fillStyle = '#2a0e0e'; g.fillRect(13, 21, 9, 13); g.fillRect(42, 21, 9, 13);
    g.fillStyle = '#c8a050'; [24, 28, 32].forEach((y) => { g.fillRect(13, y, 9, 1); g.fillRect(42, y, 9, 1); });
    // 兜：鉢、しころ、前立
    g.fillStyle = '#1d1a18'; poly(g, 14, 18, 50, 18, 46, 13, 18, 13); circle(g, 32, 12, 8);
    g.fillStyle = '#7a1c14'; g.fillRect(26, 14, 12, 6);
    g.fillStyle = '#e8d090'; g.fillRect(28, 15, 2, 1.5); g.fillRect(34, 15, 2, 1.5);
    g.fillStyle = '#c9a34a'; poly(g, 29, 6, 35, 6, 34, 1, 30, 1);
  }
  function arm(g, x0, y0, x1, y1) { line(g, x0, y0, x1, y1, 4, '#3a1414'); g.fillStyle = '#b07f5c'; circle(g, x1, y1, 2.2); }
  function sword(g, hx, hy, tx, ty) {
    const dx = tx - hx, dy = ty - hy, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    line(g, hx - ux * 7, hy - uy * 7, hx, hy, 2.6, '#16110d');
    line(g, hx + ux * 1.5, hy + uy * 1.5, tx, ty, 1.6, '#d3d7dc');
    g.fillStyle = '#2c2620'; circle(g, hx + ux, hy + uy, 2);
  }
  function streak(g, x0, y0, x1, y1) { g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - 10, x1, y1); g.stroke(); }
  const FRAMES = {
    idle(g) { body(g); arm(g, 21, 26, 30, 38); arm(g, 43, 26, 34, 38); sword(g, 32, 37, 40, 10); },
    idle2(g) { body(g); arm(g, 21, 26, 30, 39); arm(g, 43, 26, 34, 39); sword(g, 32, 38, 38, 11); },
    windL(g) { body(g); arm(g, 21, 26, 18, 18); arm(g, 43, 26, 20, 20); sword(g, 19, 19, 4, 2); },
    windR(g) { body(g); arm(g, 43, 26, 46, 18); arm(g, 21, 26, 44, 20); sword(g, 45, 19, 60, 2); },
    windT(g) {
      body(g); arm(g, 21, 26, 30, 38); arm(g, 43, 26, 36, 38);
      g.fillStyle = 'rgba(226,60,40,1)'; circle(g, 33, 33, 6); g.fillStyle = '#ffe0d0'; circle(g, 33, 33, 2.5);
      line(g, 36, 40, 44, 46, 2.6, '#16110d');
    },
    swingL(g) { body(g); arm(g, 21, 26, 40, 40); arm(g, 43, 26, 42, 40); sword(g, 42, 41, 60, 54); streak(g, 6, 6, 58, 50); },
    swingR(g) { body(g); arm(g, 43, 26, 24, 40); arm(g, 21, 26, 22, 40); sword(g, 22, 41, 4, 54); streak(g, 58, 6, 6, 50); },
    thrust(g) {
      body(g); arm(g, 21, 26, 28, 34); arm(g, 43, 26, 36, 34);
      g.fillStyle = '#8c9298'; poly(g, 22, 30, 32, 18, 42, 30, 32, 42); g.fillStyle = '#e8ecf0'; poly(g, 25, 30, 32, 21, 39, 30, 32, 39);
    },
    blockL(g) { body(g); arm(g, 21, 26, 16, 32); arm(g, 43, 26, 18, 36); sword(g, 16, 34, 14, 6); },
    blockR(g) { body(g); arm(g, 43, 26, 48, 32); arm(g, 21, 26, 46, 36); sword(g, 48, 34, 50, 6); },
    stun(g) { FRAMES.idle2(g); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,40,30,.4)'; g.fillRect(0, 0, 64, 64); g.globalCompositeOperation = 'source-over'; },
    dead(g) {
      g.fillStyle = '#5b1712'; g.beginPath(); g.ellipse(34, 61, 24, 3, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2b2236'; g.beginPath(); g.ellipse(40, 58, 13, 4, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3a1414'; g.beginPath(); g.ellipse(26, 57, 10, 5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1d1a18'; circle(g, 12, 57, 4.5); line(g, 44, 62, 62, 58, 1.4, '#d3d7dc');
    },
  };

  /* ---------- 場地 ---------- */
  function buildArena() {
    const N = 13, grid = new Array(N * N).fill(0);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (x === 0 || y === 0 || x === N - 1 || y === N - 1) grid[y * N + x] = x % 4 === 0 && y % 4 === 0 ? 'P' : (y === 0 ? 'K' : 'W');
    }
    for (const [x, y] of [[0, 0], [N - 1, 0], [0, N - 1], [N - 1, N - 1]]) grid[y * N + x] = 'P';
    return { N, grid };
  }

  /* ---------- 狀態 ---------- */
  let round = 1;
  function newBout(r) {
    round = r;
    const A = buildArena(), k = r - 1;
    const F = Object.assign({}, D.foe, {
      wind: D.foe.wind * Math.pow(0.93, k), thrustWind: D.foe.thrustWind * Math.pow(0.95, k),
      pBlock: Math.min(0.8, D.foe.pBlock + 0.07 * k), pParry: Math.min(0.45, D.foe.pParry + 0.05 * k),
      pDodge: Math.min(0.6, D.foe.pDodge + 0.05 * k), cd: [D.foe.cd[0] * Math.pow(0.92, k), D.foe.cd[1] * Math.pow(0.92, k)],
      hp: D.foe.hp + 15 * k,
    });
    const foe = { type: 'samurai', T: { scale: 1.0, width: 0.4 }, F, name: `${FOES[(r - 1) % FOES.length]}${NAMES[(r * 3) % NAMES.length]}`,
      x: 6.5, y: 3.4, hp: F.hp, pos: 0, state: 'idle', t: 0, dir: null, frame: 'idle', guard: null, guardT: 0, parryNext: false,
      dodgeT: 0, dodgeDir: 1, cd: 1.2, lastHit: -9, swingT: 0, strafe: Math.random() < 0.5 ? 1 : -1, dead: false, ph: 0, phase: '' };
    const P = { x: 6.5, y: 9.6, a: -Math.PI / 2, hp: D.player.hp, pos: 0, hurtT: 0, bob: 0, moveAmt: 0, stun: 0, lastHit: -9,
      atk: null, aimHold: 0, guard: null, parryFlash: 0 };
    G.S = { W: A.N, H: A.N, grid: A.grid, doors: new Map(), wallHp: new Float32Array(A.N * A.N),
      decor: [{ x: 2.5, y: 2.5, solid: true }, { x: 10.5, y: 2.5, solid: true }, { x: 2.5, y: 10.5, solid: true }, { x: 10.5, y: 10.5, solid: true }],
      items: [], enemies: [foe], fx: [], projs: [], lobs: [], P, foe, time: 0, state: 'play', light: 0, shake: 0, hitStop: 0,
      ougiFlash: 0, pickT: 0, deadT: 0, showMap: false, endT: 0 };
  }
  G.enemyFrame = (e) => e.frame;

  /* ---------- 輸入：移動搖桿、攻／守兩顆搖桿鍵 ---------- */
  const IN = { keys: new Set(), joy: { x: 0, y: 0 }, atk: { down: false, dx: 0 }, def: { down: false, dx: 0 }, atkReleased: false };
  const isTouch = matchMedia('(pointer: coarse)').matches;
  let screenShown = true;
  function initInput() {
    addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); IN.keys.add(k); if (k === 'escape' || k === 'p') togglePause(); });
    addEventListener('keyup', (e) => IN.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => { IN.keys.clear(); IN.atk.down = IN.def.down = false; });
    const cv = $('cv'), view = $('view');
    view.addEventListener('contextmenu', (e) => e.preventDefault());
    view.addEventListener('mousedown', (e) => {
      if (isTouch || screenShown) return;
      if (document.pointerLockElement !== cv) { try { const p = cv.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* 不支援時改看滑鼠位置 */ } }
      if (e.button === 0) { IN.atk.down = true; IN.atk.dx = 0; }
      if (e.button === 2) { IN.def.down = true; IN.def.dx = 0; }
    });
    addEventListener('mouseup', (e) => {
      if (isTouch) return;
      if (e.button === 0 && IN.atk.down) { IN.atk.down = false; IN.atkReleased = true; }
      if (e.button === 2) IN.def.down = false;
    });
    addEventListener('mousemove', (e) => {
      if (isTouch) return;
      const mx = document.pointerLockElement === cv ? e.movementX : e.movementX || 0;
      if (IN.atk.down) IN.atk.dx = G.clamp(IN.atk.dx + mx, -60, 60);
      if (IN.def.down) IN.def.dx = G.clamp(IN.def.dx + mx, -60, 60);
    });
    if (!isTouch) return;
    const touchEl = $('touch'), knob = $('knob'); touchEl.hidden = false;
    let stickId = null, o = null;
    touchEl.addEventListener('touchstart', (e) => {
      if (e.target.closest('.stick')) return; e.preventDefault();
      const r = touchEl.getBoundingClientRect();
      for (const t of e.changedTouches) if (t.clientX < r.left + r.width * 0.5 && stickId === null) {
        stickId = t.identifier; o = { x: t.clientX, y: t.clientY }; knob.hidden = false; knob.style.left = t.clientX - r.left + 'px'; knob.style.top = t.clientY - r.top + 'px';
      }
    }, { passive: false });
    touchEl.addEventListener('touchmove', (e) => {
      e.preventDefault(); const r = touchEl.getBoundingClientRect();
      for (const t of e.changedTouches) if (t.identifier === stickId) {
        const dx = t.clientX - o.x, dy = t.clientY - o.y, m = Math.hypot(dx, dy), c = Math.min(m, 50) / (m || 1);
        IN.joy.x = (dx * c) / 50; IN.joy.y = (dy * c) / 50;
        knob.style.left = o.x - r.left + dx * c + 'px'; knob.style.top = o.y - r.top + dy * c + 'px';
      }
    }, { passive: false });
    const end = (e) => { for (const t of e.changedTouches) if (t.identifier === stickId) { stickId = null; IN.joy.x = IN.joy.y = 0; knob.hidden = true; } };
    touchEl.addEventListener('touchend', end); touchEl.addEventListener('touchcancel', end);
    const stick = (id, st, onUp) => {
      const el = $(id), dot = el.querySelector('i'); let pid = null, x0 = 0;
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); pid = e.pointerId; x0 = e.clientX; st.down = true; st.dx = 0; el.classList.add('on'); try { el.setPointerCapture(pid); } catch (err) { /* 忽略 */ } });
      el.addEventListener('pointermove', (e) => { if (e.pointerId !== pid) return; st.dx = G.clamp(e.clientX - x0, -60, 60); dot.style.transform = `translate(${st.dx * 0.6}px,0)`; });
      const up = (e) => { if (e.pointerId !== pid) return; pid = null; st.down = false; el.classList.remove('on'); dot.style.transform = ''; if (onUp) onUp(); };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    };
    stick('sAtk', IN.atk, () => { IN.atkReleased = true; });
    stick('sDef', IN.def);
  }
  const dirOf = (dx) => (dx < -D.dead ? 'L' : dx > D.dead ? 'R' : 'C');

  /* ---------- 文字提示 ---------- */
  let toastT = 0;
  function toast(t) { const el = $('toast'); el.textContent = t; el.className = 'show'; toastT = 1.1; }

  /* ---------- 玩家 ---------- */
  function updatePlayer(dt) {
    const S = G.S, P = S.P, F = S.foe;
    P.hurtT = Math.max(0, P.hurtT - dt); P.parryFlash = Math.max(0, P.parryFlash - dt);
    if (S.time - P.lastHit > 1) P.pos = Math.max(0, P.pos - D.player.posRegen * dt);
    // 鎖定：永遠面向對手
    P.a = Math.atan2(F.y - P.y, F.x - P.x);
    // 移動（相對於面向）
    let fwd = 0, str = 0; const k = IN.keys;
    if (k.has('w') || k.has('arrowup')) fwd += 1; if (k.has('s') || k.has('arrowdown')) fwd -= 1;
    if (k.has('a') || k.has('arrowleft')) str -= 1; if (k.has('d') || k.has('arrowright')) str += 1;
    fwd -= IN.joy.y; str += IN.joy.x;
    const m = Math.hypot(fwd, str); if (m > 1) { fwd /= m; str /= m; }
    const slow = P.stun > 0 ? 0.3 : P.guard || P.atk ? 0.65 : 1;
    const sp = D.player.speed * slow * dt, ca = Math.cos(P.a), sa = Math.sin(P.a), ox = P.x, oy = P.y;
    G.move(P, (ca * fwd - sa * str) * sp, (sa * fwd + ca * str) * sp, 0.22);
    const d = Math.hypot(F.x - P.x, F.y - P.y);
    if (d < 0.9) { P.x = F.x - Math.cos(P.a) * 0.9; P.y = F.y - Math.sin(P.a) * 0.9; }
    const moved = Math.hypot(P.x - ox, P.y - oy) / Math.max(dt, 1e-4) / D.player.speed;
    P.moveAmt += (G.clamp(moved, 0, 1) - P.moveAmt) * Math.min(1, dt * 10); P.bob += dt * 9 * P.moveAmt;

    if (P.stun > 0) { P.stun -= dt; P.atk = null; P.guard = null; IN.atkReleased = false; return; }

    // 攻擊：按住選方向，放開出手；中間按住不動＝刺擊
    if (P.atk && P.atk.phase === 'swing') {
      P.atk.t += dt;
      const strikeAt = P.atk.dir === 'T' ? D.atk.thrustWind : D.atk.windup;
      if (!P.atk.hit && P.atk.t >= strikeAt) { P.atk.hit = true; playerStrike(P.atk.dir); }
      if (P.atk.t >= strikeAt + D.atk.recover) P.atk = null;
      IN.atkReleased = false;
    } else if (IN.atk.down) {
      const dir = dirOf(IN.atk.dx);
      P.aimHold = dir === 'C' ? P.aimHold + dt : 0;
      P.atk = { phase: 'aim', dir: dir === 'C' ? (P.aimHold >= D.thrustHold ? 'T' : 'C') : dir };
    } else if (P.atk && P.atk.phase === 'aim') {
      const dir = P.atk.dir;
      P.atk = dir === 'C' ? null : { phase: 'swing', dir, t: 0, hit: false };
      if (P.atk) { G.sfx(dir === 'T' ? 'swing_heavy' : 'swing_sweet'); foeReact(dir); }
      P.aimHold = 0;
    }
    IN.atkReleased = false;

    // 防守：推向攻擊來的方向；中間沒有作用
    if (IN.def.down && !(P.atk && P.atk.phase === 'swing')) {
      const gd = dirOf(IN.def.dx);
      if (gd === 'C') P.guard = null;
      else if (!P.guard || P.guard.dir !== gd) P.guard = { dir: gd, t0: S.time };
    } else P.guard = null;
  }

  function playerStrike(dir) {
    const S = G.S, P = S.P, F = S.foe, d = Math.hypot(F.x - P.x, F.y - P.y);
    if (F.dead) return;
    const reach = dir === 'T' ? D.atk.thrustReach : D.atk.reach;
    if (d > reach + 0.1) { G.sfx('whiff'); return; }
    const hx = F.x + (P.x - F.x) * 0.3, hy = F.y + (P.y - F.y) * 0.3;
    if (dir === 'T') {
      if (F.dodgeT > 0) { toast('被閃開'); G.sfx('whiff'); return; }
      return hurtFoe(D.atk.thrustDmg, D.atk.thrustPos, hx, hy);
    }
    if (F.guard === dir && F.guardT > 0 && F.state !== 'stun') {
      F.guardT = 0;
      if (F.parryNext) { // 被對手格擋：自己硬直
        P.stun = 0.75; P.pos += 22; P.lastHit = S.time; S.hitStop = 0.08; S.shake = 0.3;
        G.sfx('parry'); G.addFx(hx, hy, 'spark', 0.2, { b: true, l: 0.5, s: 0.35 }); toast('被格擋');
        checkPlayerBreak(); return;
      }
      F.pos += D.block.pos + 6; F.lastHit = S.time; G.sfx('clang'); G.addFx(hx, hy, 'spark', 0.15, { b: true, l: 0.5, s: 0.25 });
      checkFoeBreak(); return;
    }
    hurtFoe(D.atk.dmg, D.atk.posDmg, hx, hy);
  }
  function hurtFoe(dmg, pos, hx, hy) {
    const S = G.S, F = S.foe;
    const broken = F.state === 'stun' && F.broken;
    F.hp -= dmg * (broken ? 1.6 : 1); F.pos += pos; F.lastHit = S.time;
    G.sfx('hit'); G.addFx(hx, hy, 'blood', 0.2, { l: 0.5 }); S.hitStop = 0.06; S.shake = 0.25;
    if (F.hp <= 0) { F.hp = 0; F.dead = true; F.state = 'dead'; F.frame = 'dead'; G.sfx('die'); S.state = 'won'; S.endT = 0; toast('勝負あり'); return; }
    if (F.state === 'wind' || F.state === 'idle') { F.state = 'stun'; F.t = 0.35; F.broken = false; }
    checkFoeBreak();
  }
  function checkFoeBreak() { const F = G.S.foe; if (F.pos >= F.F.posMax) { F.pos = 40; F.state = 'stun'; F.t = 1.4; F.broken = true; toast('崩し'); G.sfx('shieldbreak'); } }
  function checkPlayerBreak() { const P = G.S.P; if (P.pos >= D.player.posMax) { P.pos = 40; P.stun = 1.2; toast('架勢崩'); G.sfx('shieldbreak'); } }

  /* ---------- 對手 AI ---------- */
  function foeReact(dir) {
    const F = G.S.foe, X = F.F;
    if (F.state !== 'idle') return; // 出招中、收招中、硬直中都來不及反應
    if (dir === 'T') { if (Math.random() < X.pDodge) { F.dodgeT = 0.45; F.dodgeDir = Math.random() < 0.5 ? -1 : 1; } return; }
    if (Math.random() < X.pBlock) {
      F.guard = Math.random() < X.pCorrect ? dir : dir === 'L' ? 'R' : 'L';
      F.guardT = 0.6; F.parryNext = Math.random() < X.pParry;
    }
  }
  function updateFoe(dt) {
    const S = G.S, P = S.P, F = S.foe, X = F.F;
    if (F.dead) return;
    const dx = P.x - F.x, dy = P.y - F.y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
    if (S.time - F.lastHit > 1) F.pos = Math.max(0, F.pos - X.posRegen * dt);
    F.guardT -= dt; F.dodgeT -= dt; F.swingT -= dt;
    if (F.guardT <= 0) F.guard = null;
    if (F.dodgeT > 0) G.move(F, -uy * F.dodgeDir * 4 * dt, ux * F.dodgeDir * 4 * dt, 0.25);

    if (F.state === 'stun') { F.t -= dt; F.frame = 'stun'; if (F.t <= 0) { F.state = 'idle'; F.cd = Math.max(F.cd, 0.5); F.broken = false; } return; }
    if (F.state === 'wind') {
      F.t += dt; F.frame = 'wind' + F.dir;
      if (F.dir !== 'T' && d > 1.3) G.move(F, ux * X.speed * 0.5 * dt, uy * X.speed * 0.5 * dt, 0.25);
      if (F.t >= F.dur) foeStrike();
      return;
    }
    if (F.state === 'recover') { F.t -= dt; F.frame = F.swingT > 0 ? F.swingFrame : 'idle'; if (F.t <= 0) { F.state = 'idle'; F.cd = G.rnd(X.cd[0], X.cd[1]); } return; }

    // idle：保持距離、繞圈、找機會出手
    F.cd -= dt;
    let mx = 0, my = 0;
    if (d > X.keep + 0.25) { mx += ux; my += uy; } else if (d < X.keep - 0.4) { mx -= ux; my -= uy; }
    if (Math.random() < dt * 0.4) F.strafe *= -1;
    mx += -uy * F.strafe * 0.6; my += ux * F.strafe * 0.6;
    const ox = F.x, oy = F.y;
    G.move(F, mx * X.speed * dt, my * X.speed * dt, 0.25);
    F.ph += Math.hypot(F.x - ox, F.y - oy) * 6;
    F.frame = F.guardT > 0 && F.guard ? 'block' + F.guard : (F.ph | 0) % 2 ? 'idle2' : 'idle';
    if (F.cd <= 0 && d < X.reach + 0.4 && P.stun <= 0.3) {
      F.dir = Math.random() < X.thrustChance ? 'T' : Math.random() < 0.5 ? 'L' : 'R';
      F.state = 'wind'; F.t = 0; F.dur = F.dir === 'T' ? X.thrustWind : X.wind; F.guard = null; F.guardT = 0;
      F.tx = ux; F.ty = uy; F.ox = F.x; F.oy = F.y;
      G.sfx(F.dir === 'T' ? 'thrust_warn' : 'windup');
    } else if (F.cd <= 0 && P.stun > 0.3 && d < X.reach + 0.4) {
      F.dir = Math.random() < 0.5 ? 'L' : 'R'; F.state = 'wind'; F.t = F.dur = X.wind * 0.6; F.t = 0;
      F.tx = ux; F.ty = uy; F.ox = F.x; F.oy = F.y; G.sfx('windup');
    }
  }
  function foeStrike() {
    const S = G.S, P = S.P, F = S.foe, X = F.F, d = Math.hypot(P.x - F.x, P.y - F.y);
    F.state = 'recover'; F.t = X.recover; F.swingT = 0.14; F.swingFrame = F.dir === 'T' ? 'thrust' : 'swing' + F.dir;
    const hx = P.x + (F.x - P.x) * 0.35, hy = P.y + (F.y - P.y) * 0.35;
    if (F.dir === 'T') {
      // 刺擊：沿出招當下的方向直線刺出；橫移離開這條線就能閃過
      const rx = P.x - F.ox, ry = P.y - F.oy, along = rx * F.tx + ry * F.ty, lat = Math.abs(rx * F.ty - ry * F.tx);
      if (along > 0 && along < X.thrustReach && lat < 0.45) return hurtPlayer(X.thrustDmg, 14, hx, hy);
      F.t = X.whiffRecover; G.sfx('whiff'); toast('閃'); return;
    }
    if (d > X.reach + 0.25) { F.t = X.whiffRecover * 0.7; G.sfx('whiff'); return; }
    if (P.guard && P.guard.dir === F.dir) {
      if (S.time - P.guard.t0 <= D.parryWin) {
        F.state = 'stun'; F.t = D.parry.stun; F.broken = false; F.pos += D.parry.pos; F.lastHit = S.time;
        P.parryFlash = 0.3; S.hitStop = 0.1; S.shake = 0.3;
        G.sfx('parry'); G.addFx(hx, hy, 'spark', 0.22, { b: true, l: 0.5, s: 0.4 }); toast('格擋');
        checkFoeBreak(); return;
      }
      P.pos += D.block.pos; P.lastHit = S.time; G.sfx('clang'); G.addFx(hx, hy, 'spark', 0.15, { b: true, l: 0.5, s: 0.25 });
      checkPlayerBreak(); return;
    }
    hurtPlayer(X.dmg, 10, hx, hy);
  }
  function hurtPlayer(dmg, pos, hx, hy) {
    const S = G.S, P = S.P;
    P.hp -= dmg; P.pos += pos; P.lastHit = S.time; P.hurtT = 0.45; S.shake = 0.35;
    G.sfx('hurt'); G.addFx(hx, hy, 'blood', 0.2, { l: 0.5 });
    if (P.hp <= 0) { P.hp = 0; S.state = 'dead'; S.deadT = 0; toast('敗'); return; }
    checkPlayerBreak();
  }

  /* ---------- 第一人稱的刀 ---------- */
  function blade(ctx, H, x, y, ang, len, glow) {
    const L = H * 0.6 * len, w = Math.max(2, H * 0.016);
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = '#16110d'; ctx.fillRect(-L * 0.14, -w * 1.1, L * 0.28, w * 2.2);
    ctx.fillStyle = '#c8402c'; for (let i = -L * 0.12; i < L * 0.12; i += w * 1.6) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + w * 0.7, -w * 0.8); ctx.lineTo(i + w * 1.4, 0); ctx.lineTo(i + w * 0.7, w * 0.8); ctx.fill(); }
    ctx.fillStyle = '#2c2620'; ctx.beginPath(); ctx.ellipse(L * 0.145, 0, w * 0.8, w * 2.4, 0, 0, Math.PI * 2); ctx.fill();
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 9; }
    ctx.fillStyle = '#d6dbe0'; ctx.beginPath();
    const t0 = L * 0.16, tip = L * 1.16;
    for (let i = 0; i <= 10; i++) { const t = i / 10; ctx.lineTo(t0 + (tip - t0) * t * 0.93, -w * (1 - t * 0.3) - L * 0.06 * t * t); }
    ctx.lineTo(tip, -L * 0.06 + w * 0.1);
    for (let i = 10; i >= 0; i--) { const t = i / 10; ctx.lineTo(t0 + (tip - t0) * t * 0.93, w * 0.75 * (1 - t * 0.4) - L * 0.06 * t * t); }
    ctx.fill(); ctx.shadowBlur = 0; ctx.restore();
    ctx.fillStyle = '#1f2436'; ctx.beginPath(); ctx.moveTo(x + H * 0.05, y + H * 0.02); ctx.lineTo(x + H * 0.36, H * 1.05); ctx.lineTo(x + H * 0.02, H * 1.05); ctx.lineTo(x - H * 0.07, y + H * 0.05); ctx.fill();
    ctx.fillStyle = '#a87a58'; ctx.beginPath(); ctx.arc(x, y, H * 0.05, 0, Math.PI * 2); ctx.fill();
  }
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  G.drawFirstPerson = function (ctx, W, H) {
    const S = G.S, P = S.P;
    let x = W * 0.66, y = H * 1.0, a = -1.95, len = 1, glow = null;
    const bx = Math.cos(P.bob) * 3 * P.moveAmt, by = Math.abs(Math.sin(P.bob)) * 3 * P.moveAmt;
    if (P.atk && P.atk.phase === 'aim') {
      const dir = P.atk.dir;
      if (dir === 'L') { x = W * 0.3; y = H * 0.86; a = -1.15; glow = '#c9a34a'; }
      else if (dir === 'R') { x = W * 0.76; y = H * 0.86; a = -2.0; glow = '#c9a34a'; }
      else if (dir === 'T') { x = W * 0.56; y = H * 0.98; a = -1.62; len = 0.62; glow = '#e2553b'; }
      else { x = W * 0.6; y = H * 0.98; a = -1.75; len = 0.8 + Math.min(1, P.aimHold / D.thrustHold) * -0.15; }
    } else if (P.atk && P.atk.phase === 'swing') {
      const dir = P.atk.dir, strikeAt = dir === 'T' ? D.atk.thrustWind : D.atk.windup, t = ease(G.clamp(P.atk.t / (strikeAt + 0.06), 0, 1));
      if (dir === 'L') { x = G.lerp(W * 0.3, W * 0.78, t); y = G.lerp(H * 0.86, H * 1.04, t); a = G.lerp(-1.15, 0.3, t); }
      else if (dir === 'R') { x = G.lerp(W * 0.76, W * 0.24, t); y = G.lerp(H * 0.86, H * 1.04, t); a = G.lerp(-2.0, -3.45, t); }
      else { x = W * 0.54; y = G.lerp(H * 0.98, H * 0.8, t); a = -1.6; len = G.lerp(0.62, 1.05, t); }
    } else if (P.guard) {
      if (P.guard.dir === 'L') { x = W * 0.3; y = H * 0.96; a = -1.42; } else { x = W * 0.72; y = H * 0.96; a = -1.72; }
      glow = P.parryFlash > 0 ? '#ffffff' : 'rgba(150,190,240,1)';
    }
    if (P.stun > 0) { a += 0.6; y += H * 0.08; }
    blade(ctx, H, x + bx, y + by, a, len, glow);
  };

  /* ---------- UI：方向預告、雙方的生命與架勢 ---------- */
  let ui, ug, dpr = 1;
  G.resizeUI = function () { if (!ui) return; const r = ui.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1); ui.width = Math.max(1, r.width * dpr); ui.height = Math.max(1, r.height * dpr); };
  function bar(x, y, w, h, v, col, label) {
    ug.fillStyle = 'rgba(0,0,0,.55)'; ug.fillRect(x, y, w, h);
    ug.fillStyle = col; ug.fillRect(x, y, w * G.clamp(v, 0, 1), h);
    ug.strokeStyle = 'rgba(232,224,204,.35)'; ug.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    if (label) { ug.fillStyle = 'rgba(232,224,204,.8)'; ug.font = '11px "Noto Serif TC", serif'; ug.textAlign = 'right'; ug.textBaseline = 'middle'; ug.fillText(label, x - 6, y + h / 2); }
  }
  function chevron(cx, cy, dir, s, col, fill) {
    ug.strokeStyle = col; ug.fillStyle = col; ug.lineWidth = 3; ug.beginPath();
    const k = dir === 'L' ? -1 : 1;
    ug.moveTo(cx - k * s * 0.4, cy - s); ug.lineTo(cx + k * s * 0.5, cy); ug.lineTo(cx - k * s * 0.4, cy + s);
    if (fill) { ug.closePath(); ug.fill(); } else ug.stroke();
  }
  G.drawUI = function () {
    if (!ug) return;
    const S = G.S, P = S.P, F = S.foe, w = ui.width / dpr, h = ui.height / dpr, cx = w / 2, cy = h * 0.47, R = Math.max(70, Math.min(w, h) * 0.18);
    ug.setTransform(dpr, 0, 0, dpr, 0, 0); ug.clearRect(0, 0, w, h);
    // 對手的出招預告：左右是箭頭，刺擊是中央的紅圈
    if (F.state === 'wind') {
      const p = G.clamp(F.t / F.dur, 0, 1);
      if (F.dir === 'T') {
        ug.strokeStyle = `rgba(226,60,40,${0.5 + p * 0.5})`; ug.lineWidth = 4;
        ug.beginPath(); ug.arc(cx, cy, R * (1.2 - p * 0.75), 0, Math.PI * 2); ug.stroke();
        ug.font = '900 26px "Noto Serif TC", serif'; ug.textAlign = 'center'; ug.textBaseline = 'middle'; ug.fillStyle = '#ff6a4a'; ug.fillText('突', cx, cy - R * 0.7);
      } else {
        const sx = F.dir === 'L' ? cx - R : cx + R;
        chevron(sx, cy, F.dir === 'L' ? 'R' : 'L', 18, `rgba(255,${Math.round(240 - p * 170)},${Math.round(220 - p * 190)},1)`, p > 0.65);
        ug.strokeStyle = 'rgba(255,255,255,.25)'; ug.lineWidth = 2; ug.beginPath(); ug.arc(sx, cy, 26, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ug.stroke();
      }
    }
    if (F.guardT > 0 && F.guard && F.state === 'idle') { const sx = F.guard === 'L' ? cx - R * 0.55 : cx + R * 0.55; ug.fillStyle = 'rgba(120,160,210,.6)'; ug.fillRect(sx - 3, cy - 22, 6, 44); }
    // 自己的架式
    if (P.atk && P.atk.phase === 'aim') {
      if (P.atk.dir === 'L' || P.atk.dir === 'R') chevron(P.atk.dir === 'L' ? cx - R * 0.75 : cx + R * 0.75, cy + R * 0.9, P.atk.dir === 'L' ? 'R' : 'L', 12, '#c9a34a', true);
      else { const k = Math.min(1, P.aimHold / D.thrustHold); ug.strokeStyle = P.atk.dir === 'T' ? '#e2553b' : 'rgba(201,163,74,.8)'; ug.lineWidth = 3; ug.beginPath(); ug.arc(cx, cy + R * 0.9, 12, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ug.stroke(); }
    }
    if (P.guard) { const sx = P.guard.dir === 'L' ? cx - R * 0.8 : cx + R * 0.8; ug.fillStyle = P.parryFlash > 0 ? '#ffffff' : 'rgba(150,190,240,.75)'; ug.fillRect(sx - 4, cy + R * 0.55, 8, 40); }
    // 對手的名字、生命、架勢
    const bw = Math.min(260, w * 0.5), bx0 = cx - bw / 2;
    ug.fillStyle = '#e8e0cc'; ug.font = '900 16px "Noto Serif TC", serif'; ug.textAlign = 'center'; ug.textBaseline = 'alphabetic';
    ug.fillText(`第 ${round} 試合　${F.name}`, cx, 28);
    bar(bx0, 36, bw, 7, F.hp / F.F.hp, '#c8402c'); bar(bx0, 46, bw, 4, F.pos / F.F.posMax, '#c9a34a');
    // 自己
    const pw = Math.min(200, w * 0.35);
    bar(70, h - 34, pw, 8, P.hp / D.player.hp, '#c8402c', '命'); bar(70, h - 20, pw, 5, P.pos / D.player.posMax, '#c9a34a', '勢');
    ug.fillStyle = 'rgba(255,240,210,.7)'; ug.fillRect(cx - 1, cy - 1, 2, 2);
  };

  /* ---------- 畫面切換 ---------- */
  function showScreen(kind) {
    screenShown = true; $('screen').hidden = false;
    if (document.pointerLockElement) try { document.exitPointerLock(); } catch (e) { /* 忽略 */ }
    const ctl = isTouch
      ? `<dl class="keys"><dt>左半邊</dt><dd>拖曳移動（永遠面向對手）</dd><dt>攻</dt><dd>按住往左／右拖曳就位，放開揮出；在中間按住不動是刺擊</dd><dt>守</dt><dd>對手出手前按住，推向攻擊來的方向；時機好是格擋</dd></dl>`
      : `<dl class="keys"><dt>WASD</dt><dd>移動（永遠面向對手）</dd><dt>左鍵按住</dt><dd>攻：按住時滑鼠往左／右移動就位，放開揮出；不動按住是刺擊</dd><dt>右鍵按住</dt><dd>守：按住時滑鼠推向攻擊來的方向；時機好是格擋</dd><dt>Esc</dt><dd>暫停</dd></dl>`;
    const html = {
      start: `<div class="eyebrow">試作 · 鎖定式一對一</div><h1>御前比武</h1>
        <p class="lead">在將軍面前，一對一。看清對手的刀從哪一邊來。</p>
        <div class="rules"><p>對手出手前，畫面左右會亮起箭頭：從那一側砍來。這時按住「守」推向同一側，剛推到就被砍中是<b>格擋</b>（對手硬直），推得太早只是防禦（扣架勢）。中央的紅圈與「突」是刺擊，擋不住，只能橫移閃開。</p>
        <p>雙方都有架勢條，被擋、被格擋、挨打都會累積；滿了就崩，崩的時候吃的傷害更重。</p></div>
        ${ctl}<div class="row"><button class="btn" id="go" type="button">開始</button><a class="back" href="../index.html">← 選擇人物</a></div>`,
      won: `<div class="eyebrow">第 ${round} 試合</div><h1>勝</h1><p class="lead">下一位對手會更快、更會擋。</p><div class="row"><button class="btn" id="go" type="button">下一試合</button><a class="back" href="../index.html">← 選擇人物</a></div>`,
      dead: `<div class="eyebrow">第 ${round} 試合</div><h1>敗</h1><div class="row"><button class="btn" id="go" type="button">從頭再來</button><a class="back" href="../index.html">← 選擇人物</a></div>`,
      pause: `<div class="eyebrow">暫停</div><h1>一息</h1><div class="row"><button class="btn" id="go" type="button">繼續</button></div>`,
    }[kind];
    $('panel').innerHTML = html;
    $('go').addEventListener('click', () => {
      G.initAudio();
      if (kind === 'won') newBout(round + 1); else if (kind === 'dead' || kind === 'start') newBout(kind === 'start' ? 1 : 1);
      if (kind === 'pause') G.S.paused = false;
      screenShown = false; $('screen').hidden = true;
      if (!isTouch) { try { const p = $('cv').requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* 忽略 */ } }
    });
  }
  function togglePause() { const S = G.S; if (!S || S.state !== 'play') return; if (screenShown && !S.paused) return; S.paused = !S.paused; if (S.paused) showScreen('pause'); else { screenShown = false; $('screen').hidden = true; } }

  /* ---------- 主迴圈 ---------- */
  let last = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
    const S = G.S; if (!S) return;
    if (!screenShown && !S.paused) {
      let gdt = dt; if (S.hitStop > 0) { S.hitStop -= dt; gdt = 0; }
      if (gdt > 0) {
        S.time += gdt;
        if (S.state === 'play') { updatePlayer(gdt); updateFoe(gdt); }
        else if (S.state === 'won') { S.endT += gdt; S.foe.frame = 'dead'; if (S.endT > 1.4) showScreen('won'); }
        else if (S.state === 'dead') { S.deadT += gdt; if (S.deadT > 1.4) showScreen('dead'); }
        for (const f of S.fx) f.t -= gdt; S.fx = S.fx.filter((f) => f.t > 0);
        S.shake = Math.max(0, S.shake - gdt * 2.5);
      }
    }
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').className = ''; }
    G.draw();
  }

  G.SFX.thrust_warn = (v) => { G.tn('sawtooth', 160, 90, 0.4, 0.12 * v); G.nz(0.3, 1200, 0.2 * v, 'bandpass', 400); };
  window.G.duelDebug = { D, IN, newBout, foeStrike, playerStrike, dirOf };

  window.addEventListener('DOMContentLoaded', () => {
    G.buildAssets();
    G.SPR.samurai = {};
    for (const k in FRAMES) G.SPR.samurai[k] = makeTex(FRAMES[k]);
    newBout(1);
    G.initRender(); ui = $('ui'); ug = ui.getContext('2d'); G.resizeUI();
    initInput(); showScreen('start');
    requestAnimationFrame(frame);
  });
})();
