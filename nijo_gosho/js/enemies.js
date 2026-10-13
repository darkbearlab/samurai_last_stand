/* 敵人：生成、AI、受傷、死亡 */
(function () {
  'use strict';
  const G = window.G;

  G.spawnEnemy = function (type, x, y, awake) {
    const T = G.CONFIG.enemies[type];
    const e = { type, T, x, y, hp: T.hp, shield: T.shield || 0, dead: false, awake: !!awake, phase: 'chase', phT: 0,
      cd: G.rnd(0.5, 1.2), atkT: 0, painT: 0, poiseT: 0, wind: 1, wasPained: false, ph: Math.random() * 10, wob: 0, wt: 0, moving: false };
    G.S.enemies.push(e);
    return e;
  };

  // 招架窗口倍率：基礎升級 × 手上名刀（大典太較寬）
  G.parryMul = function () { const P = G.S.P, b = G.blade(P.cur); return P.stats.parryMul * (b.parryMul || 1); };
  function facingPlayer(e) { const P = G.S.P; return Math.abs(G.angDiff(Math.atan2(e.y - P.y, e.x - P.x), P.a)) < 1.1; }
  function distTo(e) { const P = G.S.P; return Math.hypot(P.x - e.x, P.y - e.y); }

  G.updateEnemies = function (dt) {
    const S = G.S, P = S.P, pb = G.blade(P.cur);
    const awe = pb.restore === 'parry' && P.sharp[pb.id] > 0;
    for (const e of S.enemies) {
      if (e.dead) continue;
      const T = e.T;
      e.atkT -= dt; e.painT -= dt; e.cd -= dt; e.moving = false;
      const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy);
      if (!e.awake) { if ((d < 14 && G.los(e.x, e.y, P.x, P.y)) || d < 4) e.awake = true; else continue; }
      if (e.painT > 0 || S.state !== 'play') { if (e.phase !== 'reload') e.phase = 'chase'; e.wasPained = true; continue; }
      if (e.wasPained) { e.wasPained = false; e.poiseT = G.CONFIG.poise; e.cd = Math.max(e.cd, G.CONFIG.staggerRecover); }
      e.poiseT -= dt;
      const see = G.los(e.x, e.y, P.x, P.y);
      const awed = awe && T.name !== '門板兵' && d < pb.aweRadius;
      const slow = awed ? 1.4 : 1;

      if (T.kind === 'melee') {
        if (e.phase === 'windup') {
          e.phT -= dt;
          const C = G.ps();
          if (e.phT <= 0) {
            // 出手瞬間已到：在容許時間內按下招架即成功，否則過了 parryLate 就命中
            const strikeAt = S.time + e.phT;
            const pm = G.parryMul();
            if (T.parryable && P.lastParry >= strikeAt - C.parryEarly * pm && facingPlayer(e) && d <= T.reach + 0.35) { G.onParry(e); continue; }
            if (e.phT <= -C.parryLate * pm || !T.parryable) { strike(e, d); e.phase = 'recover'; e.phT = T.recover; }
          }
          continue;
        }
        if (e.phase === 'recover') { e.phT -= dt; if (e.phT <= 0) { e.phase = 'chase'; e.cd = G.rnd(T.cooldown[0], T.cooldown[1]) * slow; } continue; }
        if (see && d <= T.reach - 0.1 && e.cd <= 0) { e.phase = 'windup'; e.phT = e.wind = T.windup * slow; G.sfx('windup', d); continue; }
        if (see && d <= T.keep) continue;
        moveToward(e, dt, see, d, T.speed);
      } else if (T.kind === 'shooter') {
        // 射出看得見、躲得開的子彈；子彈可以用招架彈回去
        if (e.phase === 'aim') { e.phT -= dt; if (e.phT <= 0) { shoot(e); e.phase = 'recover'; e.phT = T.recover; } continue; }
        if (e.phase === 'recover') { e.phT -= dt; if (e.phT <= 0) { e.phase = 'chase'; e.cd = G.rnd(T.cooldown[0], T.cooldown[1]) * slow; } continue; }
        if (see && d <= T.range && e.cd <= 0) { e.phase = 'aim'; e.phT = e.wind = T.windup * slow; G.sfx('aim', d); continue; }
        if (see && d < T.keepMin) { stepAway(e, dt, dx, dy, d, T.speed); continue; }
        if (see && d <= T.keepMax) continue;
        moveToward(e, dt, see, d, T.speed);
      } else if (T.kind === 'gun') {
        if (e.phase === 'aim') { e.phT -= dt; if (e.phT <= 0) { fire(e); e.phase = 'reload'; e.phT = T.reload; } continue; }
        if (e.phase === 'reload') { e.phT -= dt; if (e.phT <= 0) { e.phase = 'chase'; e.cd = G.rnd(T.cooldown[0], T.cooldown[1]); } else if (d < 2.5) stepAway(e, dt, dx, dy, d, T.speed * 0.6); continue; }
        if (see && d <= T.range && d >= 1.8 && e.cd <= 0) { e.phase = 'aim'; e.phT = e.wind = T.aim * slow; G.sfx('aim', d); continue; }
        if (see && d < T.keepMin) { stepAway(e, dt, dx, dy, d, T.speed); continue; }
        if (see && d <= T.keepMax) continue;
        moveToward(e, dt, see, d, T.speed);
      }
    }
    // 互相推開、不與玩家重疊
    const A = S.enemies;
    for (let i = 0; i < A.length; i++) {
      const a = A[i]; if (a.dead) continue;
      for (let j = i + 1; j < A.length; j++) {
        const b = A[j]; if (b.dead) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = 0.5;
        if (d > 0 && d < min) { const p = (min - d) / 2 / d; G.move(a, -dx * p, -dy * p, 0.25); G.move(b, dx * p, dy * p, 0.25); }
      }
      const dx = a.x - P.x, dy = a.y - P.y, d = Math.hypot(dx, dy), min = 0.55;
      if (d > 0 && d < min) { const p = (min - d) / d; G.move(a, dx * p * 0.6, dy * p * 0.6, 0.25); G.move(P, -dx * p * 0.4, -dy * p * 0.4, G.ps().radius); }
    }
  };

  function moveToward(e, dt, see, d, speed) {
    const S = G.S, P = S.P;
    let ang;
    if (see) {
      e.wt -= dt; if (e.wt <= 0) { e.wob = G.rnd(-0.45, 0.45); e.wt = G.rnd(0.6, 1.4); }
      ang = Math.atan2(P.y - e.y, P.x - e.x) + (d > 3 ? e.wob : 0);
    } else {
      const cx = Math.floor(e.x), cy = Math.floor(e.y);
      let best = null, bv = S.flow[cy * S.W + cx]; if (bv < 0) bv = 9999;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const v = S.flow[(cy + oy) * S.W + cx + ox];
        if (v >= 0 && v < bv) { bv = v; best = [cx + ox, cy + oy]; }
      }
      if (!best) return;
      ang = Math.atan2(best[1] + 0.5 - e.y, best[0] + 0.5 - e.x);
    }
    const sp = speed * dt, ox = e.x, oy = e.y;
    G.move(e, Math.cos(ang) * sp, Math.sin(ang) * sp, 0.25);
    if (Math.abs(e.x - ox) + Math.abs(e.y - oy) < sp * 0.3) { e.wob = (Math.random() < 0.5 ? -1 : 1) * G.rnd(0.9, 1.5); e.wt = 0.5; }
    e.moving = true;
  }
  function stepAway(e, dt, dx, dy, d, speed) {
    const sp = speed * dt; G.move(e, (-dx / d) * sp, (-dy / d) * sp, 0.25); e.moving = true;
  }

  /* 近戰出手：玩家在招架窗口內且面向敵人 → 被招架 */
  function strike(e, d) {
    const S = G.S, P = S.P, T = e.T;
    e.atkT = 0.2;
    if (d > T.reach + 0.35 || !G.los(e.x, e.y, P.x, P.y)) { G.sfx('whiff', d); return; }
    if (T.knock) { G.sfx('shove', d); G.move(P, ((P.x - e.x) / d) * T.knock, ((P.y - e.y) / d) * T.knock, G.ps().radius); }
    G.hurtPlayer(G.rint(T.damage[0], T.damage[1]), false);
  }

  /* 鐵砲：直線上第一個擋到的東西吃子彈，包括其他敵人與門板 */
  function fire(e) {
    const S = G.S, P = S.P, T = e.T;
    e.atkT = 0.2; const d = distTo(e);
    G.sfx('gun', d); G.addFx(e.x + (P.x - e.x) * 0.08, e.y + (P.y - e.y) * 0.08, 'smoke', 0.6, { s: 0.35, l: 0.45 });
    if (!G.los(e.x, e.y, P.x, P.y)) return;
    const ux = (P.x - e.x) / d, uy = (P.y - e.y) / d;
    let first = null, ft = d;
    for (const o of S.enemies) {
      if (o === e || o.dead) continue;
      const ox = o.x - e.x, oy = o.y - e.y, t = ox * ux + oy * uy;
      if (t < 0.3 || t > ft) continue;
      if (Math.abs(ox * uy - oy * ux) < o.T.width) { first = o; ft = t; }
    }
    if (first) {
      if (first.shield > 0) { G.sfx('wood', distTo(first)); G.addFx(first.x, first.y, 'wood', 0.25); }
      else G.hitEnemy(first, G.rint(T.damage[0], T.damage[1]) * 0.8, { stagger: 0.4, friendly: true });
      return;
    }
    const moving = P.moveAmt > 0.5 ? 0.22 : 0;
    if (Math.random() < G.clamp(0.95 - d * 0.04 - moving, 0.35, 0.95)) G.hurtPlayer(G.rint(T.damage[0], T.damage[1]), true);
  }

  function shoot(e) {
    const S = G.S, P = S.P, T = e.T;
    e.atkT = 0.2;
    const a = Math.atan2(P.y - e.y, P.x - e.x) + G.rnd(-T.spread || 0, T.spread || 0);
    S.projs.push({ x: e.x + Math.cos(a) * 0.35, y: e.y + Math.sin(a) * 0.35, vx: Math.cos(a) * T.projSpeed, vy: Math.sin(a) * T.projSpeed,
      dmg: G.rint(T.damage[0], T.damage[1]), life: 5, enemy: true, src: e });
    G.sfx('eshot', distTo(e));
  }

  /* 子彈：撞牆消失；敵彈打到玩家前若剛按過招架，會被彈回並轉為我方子彈 */
  G.updateProjs = function (dt) {
    const S = G.S, P = S.P, C = G.ps();
    S.projs = S.projs.filter((p) => {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) return false;
      if (G.solidAt(p.x, p.y)) { G.addFx(p.x - p.vx * 0.03, p.y - p.vy * 0.03, 'spark', 0.12, { b: true, l: 0.45, s: 0.15 }); return false; }
      if (p.enemy) {
        const d = Math.hypot(p.x - P.x, p.y - P.y);
        if (d < 0.75 && S.time - P.lastParry < 0.3 * G.parryMul() && S.state === 'play') {
          p.enemy = false; p.vx *= -1.6; p.vy *= -1.6; p.dmg *= 3; p.life = 3;
          G.onParry(null); return true;
        }
        if (d < 0.32) { G.hurtPlayer(p.dmg, false); return false; }
        return true;
      }
      for (const e of S.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < e.T.width + 0.1) {
          if (e.shield > 0) G.damageShield(e, p.dmg); else G.hitEnemy(e, p.dmg, { stagger: 0.6 });
          return false;
        }
      }
      return true;
    });
  };

  G.hitEnemy = function (e, dmg, o) {
    const S = G.S, P = S.P;
    const staggered = e.painT > 0.2;
    if (o.dull) e.hp = Math.max(1, e.hp - dmg * 0.3); else e.hp -= dmg;
    G.addFx(e.x + (P.x - e.x) * 0.12, e.y + (P.y - e.y) * 0.12, 'blood', 0.18, { l: 0.45 });
    G.sfx('hit', distTo(e));
    e.awake = true;
    if (e.hp <= 0) { kill(e, staggered && !o.friendly); return { killed: true }; }
    // 每一刀都會打出硬直；剛恢復的短暫期間（poise）內，輕段不會再打斷
    const st = o.stagger || 0.1;
    if (!(e.poiseT > 0 && st < 0.5)) {
      e.painT = Math.max(e.painT, st);
      if (e.phase === 'windup' || e.phase === 'aim') e.phase = 'chase';
    }
    if (o.knock) { const d = distTo(e) || 1; G.move(e, ((e.x - P.x) / d) * o.knock, ((e.y - P.y) / d) * o.knock, 0.25); }
    return { killed: false };
  };

  G.damageShield = function (e, amt) {
    e.shield -= amt; e.awake = true;
    G.sfx('wood', distTo(e)); G.addFx(e.x, e.y, 'wood', 0.3, { l: 0.45, s: 0.3 });
    e.painT = Math.max(e.painT, 0.35); if (e.phase === 'windup') e.phase = 'chase';
    if (e.shield <= 0) {
      e.shield = 0; e.type = e.T.becomes; e.T = G.CONFIG.enemies[e.type]; e.hp = Math.min(e.hp, e.T.hp);
      e.painT = 0.8; G.sfx('shieldbreak', distTo(e)); G.toast('門板破');
      for (let i = 0; i < 3; i++) G.addFx(e.x + G.rnd(-0.3, 0.3), e.y + G.rnd(-0.3, 0.3), 'wood', 0.5, { l: G.rnd(0.1, 0.6), s: 0.3 });
    }
  };

  function kill(e, tome) {
    const S = G.S, P = S.P, D = G.CONFIG.director;
    e.dead = true; e.painT = 0; S.kills++; G.sfx('die', distTo(e));
    G.onKill(tome);
    if (tome) {
      P.hp = Math.min(G.ps().maxHealth, P.hp + G.ps().tomeHeal);
      S.stats.tome++; G.toast('止め'); G.sfx('tome');
    }
    const roll = Math.random();
    if (roll < D.dropWhetstone) S.items.push({ kind: 'whetstone', x: e.x, y: e.y });
    else if (roll < D.dropWhetstone + D.dropOnigiri) S.items.push({ kind: 'onigiri', x: e.x, y: e.y });
    const dead = S.enemies.filter((x) => x.dead);
    if (dead.length > D.maxCorpses) S.enemies.splice(S.enemies.indexOf(dead[0]), 1);
  }
  G.killEnemy = kill;
})();
