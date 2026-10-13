/* =====================================================================
   玩家戰鬥：蓄力、出刀判定、招架、一閃、一之太刀、換刀、鋒利度
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G;

  G.updateCombat = function (dt) {
    const S = G.S, P = S.P, C = G.ps(), IN = G.IN;
    let b = G.blade(P.cur);
    P.parryCd -= dt; P.issenT -= dt; P.recoilT = Math.max(0, P.recoilT - dt); P.buffer -= dt;

    if (P.act === 'idle' || P.act === 'swap') {
      P.stDelay -= dt; if (P.stDelay <= 0) P.st = Math.min(C.maxStamina, P.st + C.staminaRegen * dt);
    }

    // 換刀
    let want = null;
    if (IN.select >= 0) { const bl = G.CONFIG.blades[IN.select]; if (bl && P.owned[bl.id]) want = bl.id; }
    if (IN.swapNext) want = nextOwned(IN.swapNext);
    if (want && want !== P.cur && (P.act === 'idle' || P.act === 'charge' || P.act === 'swap')) startSwap(want);

    if (IN.ougiPressed) tryOugi();

    if (IN.parryPressed && (P.act === 'idle' || P.act === 'charge') && P.parryCd <= 0) {
      if (P.st >= C.parryCost) {
        P.act = 'parry'; P.actT = 0.32; P.lastParry = S.time; P.parryCd = C.parryCooldown;
        P.st -= C.parryCost; P.stDelay = C.staminaDelay; G.sfx('swing_light');
      } else tired();
    }

    if (IN.atkPressed) P.buffer = C.inputBuffer;
    if (P.buffer > 0 && P.act === 'idle') {
      P.buffer = 0;
      if (P.issenT > 0) doIssen();
      else if (P.st >= C.tapCost) { P.act = 'charge'; P.charge = 0; P.st -= C.tapCost; P.stDelay = C.staminaDelay; }
      else tired();
    }

    b = G.blade(P.cur);
    if (P.act === 'charge') {
      if (IN.atkHeld) {
        const dc = Math.min((dt * (b.chargeMul || 1)) / C.chargeTime, 1 - P.charge), cost = dc * C.chargeCost;
        if (P.st >= cost) { P.charge += dc; P.st -= cost; } else { P.charge += P.st / C.chargeCost; P.st = 0; }
        P.stDelay = C.staminaDelay;
      } else release(b);
    }
    if (P.act === 'swing') {
      P.actT -= dt;
      if (P.pending) { P.pending.t -= dt; if (P.pending.t <= 0) { resolveHit(P.pending); P.pending = null; } }
      if (P.actT <= 0) P.act = 'idle';
    } else if (P.act === 'parry' || P.act === 'swap') {
      P.actT -= dt; if (P.actT <= 0) P.act = 'idle';
    }

    // 鬼丸：附近有火就恢復
    P.fireNear = false;
    const oniCfg = G.CONFIG.blades.find((x) => x.restore === 'fire'), oni = oniCfg && G.blade(oniCfg.id);
    if (oni && P.owned[oni.id]) {
      for (const d of S.decor) if (Math.hypot(d.x - P.x, d.y - P.y) <= oni.fireRadius) { P.fireNear = true; break; }
      if (P.fireNear) P.sharp[oni.id] = Math.min(100, P.sharp[oni.id] + oni.fireRate * dt);
    }
  };

  function nextOwned(dir) {
    const P = G.S.P, list = G.CONFIG.blades.filter((b) => P.owned[b.id]);
    const i = list.findIndex((b) => b.id === P.cur);
    return list[(i + dir + list.length) % list.length].id;
  }
  function startSwap(id) {
    const P = G.S.P; P.cur = id; P.act = 'swap'; P.actT = G.ps().swapTime; P.charge = 0; P.pending = null;
    const b = G.blade(id); G.toast(`${b.name}：${b.role}`);
  }
  G.startSwap = startSwap;
  function tired() { G.sfx('tired'); G.toast('氣不足'); }

  function release(b) {
    const P = G.S.P, z = G.zoneOf(b, P.charge);
    P.act = 'swing'; P.swingZone = z; P.swingIssen = false;
    P.swingDur = b.swing * (z === 'heavy' ? 1.2 : 1); P.swingTotal = P.swingDur + b.recover; P.actT = P.swingTotal;
    P.swingFrom = -1.9 + (1 - Math.pow(1 - P.charge, 3)) * 0.85;
    P.pending = { zone: z, t: P.swingDur * 0.4, issen: false };
    G.sfx('swing_' + z);
  }
  function doIssen() {
    const S = G.S, P = S.P, b = G.blade(P.cur);
    P.issenT = 0; P.act = 'swing'; P.swingZone = 'sweet'; P.swingIssen = true;
    P.swingDur = 0.12; P.swingTotal = 0.12 + b.recover * 0.6; P.actT = P.swingTotal; P.swingFrom = -1.3;
    P.pending = { zone: 'sweet', t: 0.04, issen: true };
    G.sfx('issen'); S.stats.issen++;
  }

  function resolveHit(p) {
    const S = G.S, P = S.P, b = G.blade(P.cur), Z = G.CONFIG.zones[p.zone], O = G.CONFIG.ougi;
    const dull = !b.infinite && P.sharp[b.id] <= 0;
    const pierce = p.zone === 'heavy' && b.pierce && !dull;
    const reach = pierce ? b.pierceRange : b.reach, arc = pierce ? 0.5 : b.arc;
    const zd = b.zoneDmg && b.zoneDmg[p.zone] != null ? b.zoneDmg[p.zone] : Z.dmg;
    const mult = zd * (p.issen ? G.ps().issenMult : 1);

    const cands = [];
    for (const e of S.enemies) {
      if (e.dead) continue;
      const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy);
      if (d > reach + e.T.width) continue;
      const ang = Math.atan2(dy, dx), da = Math.abs(G.angDiff(ang, P.a));
      if (da > arc / 2 + Math.atan2(e.T.width, Math.max(d, 0.1))) continue;
      if (!G.los(P.x, P.y, e.x, e.y)) continue;
      cands.push({ e, d, ang });
    }
    cands.sort((a, c) => a.d - c.d);
    const maxT = p.issen ? 1 : p.zone === 'heavy' ? 6 : p.zone === 'sweet' && b.sweetCleave ? b.sweetCleave : 1;
    let hits = 0, blocked = false;
    for (const c of cands) {
      if (hits >= maxT) break;
      const e = c.e;
      if (!pierce && !p.issen) {
        let behindShield = false;
        for (const s of cands) { if (s === c) break; if (s.e.shield > 0 && Math.abs(G.angDiff(s.ang, c.ang)) < 0.4) { behindShield = true; break; } }
        if (behindShield) continue;
      }
      if (e.shield > 0) {
        const canBreak = !dull && (pierce || p.issen || (p.zone === 'heavy' && b.canBreakShield !== false));
        if (canBreak) { G.damageShield(e, b.damage * mult * (b.shieldMult || 1)); hits++; continue; }
        G.sfx('clang'); G.addFx(e.x + (P.x - e.x) * 0.2, e.y + (P.y - e.y) * 0.2, 'spark', 0.12, { b: true, l: 0.45 });
        blocked = true; hits++; break;
      }
      const dmg = b.damage * mult * G.rnd(0.95, 1.1);
      G.hitEnemy(e, dmg, { dull, knock: Z.knock || 0, stagger: dull ? 0.5 : Z.stagger });
      hits++;
    }

    // 打牆：沒砍到人時砍到面前的牆；重段即使砍到人也會連牆一起破
    if (hits === 0 || p.zone === 'heavy') hitWall(b.damage * mult * G.CONFIG.walls.zoneMult[p.zone] * (dull ? 0.3 : 1), (pierce ? b.pierceRange : b.reach) + 0.4);

    if (hits > 0 && !b.infinite) {
      const before = P.sharp[b.id];
      let w = p.issen ? 0 : b.wear[p.zone]; if (blocked) w += 2;
      P.sharp[b.id] = Math.max(0, P.sharp[b.id] - w);
      if (p.zone === 'sweet' && b.restore === 'sweet' && !blocked) P.sharp[b.id] = Math.min(100, P.sharp[b.id] + b.sweetRestore);
      if (before > 0 && P.sharp[b.id] <= 0) { G.toast(G.TX('dull', `${b.name} 鈍了`, b)); G.sfx('dull'); }
    }
    if (hits > 0 && !blocked) {
      if (p.zone === 'sweet') gainOugi(O.sweetGain * Math.min(hits, 2));
      if (p.issen) gainOugi(O.issenGain);
      S.hitStop = p.zone === 'heavy' || p.issen ? 0.07 : 0.035;
      S.shake = Math.max(S.shake, p.zone === 'heavy' ? 0.35 : 0.15);
    }
    if (blocked) P.recoilT = 0.25;
  }

  function hitWall(amt, reach) {
    const P = G.S.P, R = G.cast(P.x, P.y, Math.cos(P.a), Math.sin(P.a));
    if (!R.c || R.dist > reach) return;
    if (G.damageWall(R.mx, R.my, amt)) G.S.shake = Math.max(G.S.shake, 0.25);
  }

  function gainOugi(n) {
    const S = G.S, P = S.P, O = G.CONFIG.ougi, was = P.ougi;
    P.ougi = Math.min(O.max, P.ougi + n);
    if (was < O.max && P.ougi >= O.max) G.toast(G.TX('ougiReady', '一之太刀 可發動'));
  }
  G.gainOugi = gainOugi;

  /* 招架成功 */
  G.onParry = function (e) {
    const S = G.S, P = S.P, C = G.ps(), b = G.blade(P.cur);
    G.sfx('parry');
    if (e) { e.painT = 1.1; e.phase = 'chase'; G.addFx(e.x + (P.x - e.x) * 0.45, e.y + (P.y - e.y) * 0.45, 'spark', 0.18, { b: true, l: 0.5, s: 0.3 }); }
    else G.addFx(P.x + Math.cos(P.a) * 0.6, P.y + Math.sin(P.a) * 0.6, 'spark', 0.18, { b: true, l: 0.5, s: 0.3 });
    P.issenT = C.issenWindow; P.st = Math.min(C.maxStamina, P.st + C.parrySt);
    gainOugi(G.CONFIG.ougi.parryGain);
    if (b.restore === 'parry') P.sharp[b.id] = Math.min(100, P.sharp[b.id] + b.parryRestore);
    S.stats.parry++; S.hitStop = 0.08; S.shake = Math.max(S.shake, 0.2);
  };

  /* 一之太刀：視野內所有敵人一刀兩斷，手上的名刀變鈍 */
  function tryOugi() {
    const S = G.S, P = S.P, O = G.CONFIG.ougi, b = G.blade(P.cur);
    if (P.ougi < O.max) return;
    if (b.infinite) { G.toast(G.TX('needMeito', '需持名刀')); return; }
    if (P.sharp[b.id] <= 0) { G.toast(G.TX('isDull', '刀已鈍')); return; }
    if (P.act === 'swap') return;
    P.ougi = 0; P.sharp[b.id] = 0; S.stats.ougi++;
    let n = 0;
    for (const e of S.enemies) {
      if (e.dead) continue;
      const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy);
      if (d > O.range) continue;
      if (Math.abs(G.angDiff(Math.atan2(dy, dx), P.a)) > 0.75) continue;
      if (!G.los(P.x, P.y, e.x, e.y)) continue;
      e.shield = 0; G.addFx(e.x, e.y, 'blood', 0.4, { l: 0.45, s: 0.35 }); G.killEnemy(e, false); n++;
    }
    // 視野內的牆也一起斬開（結構牆除外）
    for (let k = -6; k <= 6; k++) {
      const a = P.a + k * 0.12, R = G.cast(P.x, P.y, Math.cos(a), Math.sin(a));
      if (R.c && R.dist <= O.range) G.damageWall(R.mx, R.my, 999);
    }
    P.act = 'swing'; P.swingZone = 'heavy'; P.swingIssen = true; P.swingDur = 0.2; P.swingTotal = 0.5; P.actT = 0.5; P.swingFrom = -1.0; P.pending = null;
    S.ougiFlash = 0.9; S.hitStop = 0.15; S.shake = 0.6;
    G.sfx('ougi'); G.toast(G.TX('ougiDone', `一之太刀　斬 ${n}`, n));
  }
})();
