/* =====================================================================
   二條御所・銃 —— 搞笑變體
   所有刀都變成熱兵器，敵人也是。名刀的個性照舊，只是改用子彈表達。
   這個檔案在主程式之後載入，只覆寫設定、文字、美術與第一人稱畫面；
   引擎、地圖、升級、辭世之句都與本篇共用 ../nijo_gosho/js/。
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G, C = G.CONFIG;
  C.version = '0.1.0・銃';

  /* ---------- 文字 ---------- */
  C.text = {
    eyebrow: '永銃八年五月十九日',
    title: '二條御所・銃',
    lead: '三好長銃率軍包圍了御所。手上只有一把短筒。去把散落在各房間的名銃收回來。不要問為什麼名刀都變成了槍。',
    rules: `<div class="rules"><p>按住蓄力瞄準，準星外圈標出這把槍的<b>最佳區間</b>。在區間內放開是「妙」：傷害高、省彈、累積一之太砲。太輕打不痛，太重則多耗彈藥，但能轟破門板、打穿障子。</p>
      <p>槍足輕射出的子彈看得見、躲得開；在子彈打到你的前一刻按招架，可以把它彈回去。鐵砲足輕的子彈一樣看不見也躲不掉。</p></div>`,
    meito: '名銃',
    dull: (b) => `${b.name} 沒彈了`,
    isDull: '沒彈了',
    needMeito: '需持名銃',
    ougiReady: '一之太砲 可發動',
    ougiDone: (n) => `一之太砲　轟 ${n}`,
    whetstone: '火藥樽：名銃彈藥補充',
  };

  /* ---------- 開場：走同一條字幕管線（G.say） ---------- */
  C.intro = {
    enemy: 'yari', dist: 2.4,
    lines: [
      { at: 0.3, who: 'narr', text: 'Today is Sunday in Kyoto', dur: 2.4 },
      { at: 2.9, who: '長銃足輕', text: 'Huh?', dur: 1.2 },
      { at: 4.2, who: 'player', text: 'Shoot!', dur: 1.3 },
    ],
  };

  /* ---------- 名銃：個性同本篇，距離與角度改成槍 ---------- */
  const B = Object.fromEntries(C.blades.map((b) => [b.id, b]));
  Object.assign(B.wakizashi, { name: '短筒', mark: '短', role: '打不完的備用短槍', reach: 9, arc: 0.1,
    note: '彈藥無限；連射最快、威力最弱、打不穿門板',
    gun: { len: 0.42, bore: 1.0, wood: '#5a3d26', metal: '#4a4a50', band: '#9a9aa0' } });
  Object.assign(B.dojikiri, { name: '童子切安綱・大筒', mark: '童', role: '破盾、貫穿', reach: 10, arc: 0.1, pierceRange: 14,
    note: '重段一發貫穿整排敵人與門板；火藥樽補充最多',
    gun: { len: 0.62, bore: 1.9, wood: '#4a2a1c', metal: '#2e2a2a', band: '#c0392b' } });
  Object.assign(B.onimaru, { name: '鬼丸國綱・散彈筒', mark: '鬼', role: '不挑時機的散彈', reach: 5, arc: 0.6, sweetCleave: 3,
    note: '近距離散彈，一次打一片；附近有火就自動裝填',
    gun: { len: 0.55, bore: 1.4, flare: true, wood: '#3a2418', metal: '#3a3430', band: '#e0782c' } });
  Object.assign(B.odenta, { name: '大典太光世・護身筒', mark: '典', role: '彈返（招架）', reach: 8, arc: 0.1,
    note: '招架窗口寬 1.5 倍，連子彈都彈得回去；招架成功時自動裝填',
    gun: { len: 0.5, bore: 1.2, wood: '#5a4020', metal: '#5a4a2a', band: '#d9b54a' } });
  Object.assign(B.mikazuki, { name: '三日月宗近・長銃', mark: '三', role: '狙擊', reach: 16, arc: 0.06,
    note: '妙段兩倍傷害、最省彈，但最佳區間最窄；命中最佳區間時自動裝填',
    gun: { len: 0.82, bore: 0.9, wood: '#3a2c22', metal: '#2a3442', band: '#8fb8e8', moon: true } });
  for (const u of C.upgrades) u.text = u.text.replace('脇差', '短筒').replace('鋒利', '彈藥');

  /* ---------- 敵人：槍兵改成射出可見子彈；失盾後也一樣 ---------- */
  const gunner = { kind: 'shooter', hp: 34, speed: 1.5, width: 0.32, scale: 0.92, range: 9, keepMin: 3, keepMax: 6,
    windup: 0.9, recover: 0.6, cooldown: [1.4, 2.4], damage: [9, 13], projSpeed: 5, spread: 0.06 };
  C.enemies.yari = Object.assign({ name: '長銃足輕' }, gunner);
  C.enemies.tateless = Object.assign({ name: '失盾足輕' }, gunner, { hp: 30 });

  /* ---------- 美術：敵人換槍、名刀換名銃、砥石換火藥樽 ---------- */
  const teppo = G.ENEMY_DRAW.teppo;
  const headband = (color) => (g, f) => {
    teppo(g, f === 'reload' ? 'w0' : f);
    g.fillStyle = color; g.fillRect(13, 15, 38, 2); g.fillRect(48, 15, 3, 7);
  };
  G.ENEMY_DRAW.yari = headband('#c8402c');
  G.ENEMY_DRAW.tateless = headband('#3a5a86');

  G.drawBladeItem = function (g, b) {
    const d = b.gun;
    g.fillStyle = '#2a1c14'; g.fillRect(16, 52, 3, 11); g.fillRect(45, 52, 3, 11); g.fillRect(14, 52, 36, 3);
    g.fillStyle = d.wood; g.fillRect(36, 44, 18, 6); g.fillRect(48, 44, 6, 9);
    g.fillStyle = d.metal; g.fillRect(8, 45 - d.bore, 34, 2 + d.bore * 2);
    g.fillStyle = d.band; g.fillRect(12, 44 - d.bore, 2, 4 + d.bore * 2); g.fillRect(26, 44 - d.bore, 2, 4 + d.bore * 2);
    if (d.flare) { g.fillStyle = d.metal; g.fillRect(5, 42, 4, 8); }
    if (d.moon) { g.strokeStyle = '#fff'; g.lineWidth = 0.8; g.beginPath(); g.arc(20, 46, 1.6, 0.2, Math.PI - 0.2); g.stroke(); }
  };
  G.ITEMGEN.whetstone = function (g) {
    g.fillStyle = '#6b4a2b'; g.beginPath(); g.ellipse(32, 52, 12, 11, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a3a3e'; g.fillRect(20, 45, 24, 2); g.fillRect(20, 57, 24, 2);
    g.fillStyle = '#e8e0cc'; g.fillRect(28, 49, 8, 6);
    g.fillStyle = '#c8402c'; g.fillRect(30, 50, 4, 4);
  };

  /* ---------- 音效：揮刀聲換成槍聲 ---------- */
  const nz = G.nz, tn = G.tn;
  G.SFX.swing_light = (v) => { nz(0.18, 2600, 0.5 * v); tn('square', 220, 80, 0.06, 0.12 * v); };
  G.SFX.swing_sweet = (v) => { nz(0.28, 1800, 0.7 * v); tn('sine', 140, 50, 0.18, 0.25 * v); };
  G.SFX.swing_heavy = (v) => { nz(0.7, 700, 0.95 * v); tn('sawtooth', 90, 30, 0.45, 0.3 * v); };
  G.SFX.issen = (v) => { nz(0.2, 3000, 0.6 * v); tn('sine', 2400, 900, 0.35, 0.15 * v); };
  G.SFX.dull = (v) => { tn('square', 900, 880, 0.04, 0.08 * v); tn('square', 900, 880, 0.04, 0.08 * v, 0.08); };

  /* ---------- 第一人稱：持槍、瞄準、後座力、槍口火光、彈道 ---------- */
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  function drawGun(ctx, H, x, y, ang, b, o) {
    const d = b.gun, L = H * 1.1 * d.len, w = Math.max(2, H * 0.014) * d.bore;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    // 槍托
    ctx.fillStyle = d.wood; ctx.beginPath(); ctx.moveTo(-L * 0.35, -w * 2.2); ctx.lineTo(L * 0.25, -w * 1.2); ctx.lineTo(L * 0.25, w * 1.6); ctx.lineTo(-L * 0.35, w * 3.2); ctx.fill();
    // 槍管
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = 9; }
    ctx.fillStyle = o.dull ? '#5a5a5e' : d.metal; ctx.fillRect(0, -w, L, w * 2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(0, -w, L, Math.max(1, w * 0.5));
    ctx.fillStyle = d.band; for (const t of [0.3, 0.6, 0.92]) ctx.fillRect(L * t, -w * 1.3, Math.max(2, w * 0.8), w * 2.6);
    if (d.flare) { ctx.fillStyle = d.metal; ctx.beginPath(); ctx.moveTo(L, -w); ctx.lineTo(L + w * 3, -w * 2.6); ctx.lineTo(L + w * 3, w * 2.6); ctx.lineTo(L, w); ctx.fill(); }
    if (d.moon) { ctx.strokeStyle = 'rgba(235,245,255,.95)'; ctx.lineWidth = 1; for (const t of [0.15, 0.45, 0.75]) { ctx.beginPath(); ctx.arc(L * t, 0, w * 0.6, 0.2, Math.PI - 0.2); ctx.stroke(); } }
    // 火繩
    ctx.fillStyle = '#ff8a2a'; ctx.fillRect(L * 0.12, -w * 2, 2, 2);
    const tip = L + (d.flare ? w * 3 : 0);
    if (o.flash) {
      ctx.fillStyle = '#ffe9a8'; ctx.beginPath();
      for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, r = i % 2 ? w * 2 : w * (5 + d.bore * 2); ctx.lineTo(tip + Math.cos(a) * r + w * 2, Math.sin(a) * r); }
      ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(tip + w * 2, 0, w * 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#1f2436';
    ctx.beginPath(); ctx.moveTo(x + H * 0.05, y + H * 0.02); ctx.lineTo(x + H * 0.36, H * 1.05); ctx.lineTo(x + H * 0.02, H * 1.05); ctx.lineTo(x - H * 0.07, y + H * 0.05); ctx.fill();
    ctx.fillStyle = '#a87a58'; ctx.beginPath(); ctx.arc(x, y, H * 0.05, 0, Math.PI * 2); ctx.fill();
    return { mx: x + Math.cos(ang) * tip, my: y + Math.sin(ang) * tip };
  }

  G.drawFirstPerson = function (ctx, W, H) {
    const S = G.S, P = S.P, b = G.blade(P.cur), Cp = G.ps();
    const dull = !b.infinite && P.sharp[b.id] <= 0;
    let x = W * 0.7, y = H * 1.0, ang = -2.0, glow = null, flash = false, tracer = false;
    const bx = Math.cos(P.bob) * 4 * P.moveAmt, by = Math.abs(Math.sin(P.bob)) * 4 * P.moveAmt;
    if (P.fireNear && b.fireGlow) glow = b.fireGlow;
    if (P.issenT > 0) glow = '#fff3c4';
    if (P.act === 'charge') {
      const c = easeOut(P.charge), z = G.zoneOf(b, P.charge);
      x = G.lerp(W * 0.7, W * 0.6, c); y = G.lerp(H * 1.0, H * 0.9, c); ang = G.lerp(-2.0, -1.75, c);
      if (z === 'sweet') glow = b.color;
      if (z === 'heavy') { x += G.rnd(-1, 1); y += G.rnd(-1, 1); glow = '#e2553b'; }
    } else if (P.act === 'swing') {
      const el = P.swingTotal - P.actT, k = 1 - G.clamp(el / P.swingTotal, 0, 1);
      const kick = (P.swingZone === 'heavy' ? 1.6 : P.swingZone === 'sweet' ? 1.1 : 0.7) * k * k;
      x = W * 0.62 + kick * W * 0.04; y = H * 0.92 + kick * H * 0.12; ang = -1.78 - kick * 0.35;
      flash = el < 0.07; tracer = el < 0.09;
    } else if (P.act === 'parry') {
      ang = -2.95; x = W * 0.66; y = H * 0.86; if (b.parryGlow) glow = b.parryGlow;
    } else if (P.act === 'swap') {
      y += H * 0.55 * Math.sin((Math.PI * P.actT) / Cp.swapTime);
    }
    if (P.recoilT > 0) { x += P.recoilT * 30; ang += P.recoilT * 1.5; }
    const m = drawGun(ctx, H, x + bx, y + by, ang, b, { dull, glow, flash });
    if (tracer) {
      ctx.strokeStyle = P.swingIssen ? 'rgba(255,240,190,.9)' : b.gun.band; ctx.lineWidth = P.swingZone === 'heavy' ? 2 : 1;
      const spread = b.arc > 0.3 ? 5 : 1;
      for (let i = 0; i < spread; i++) {
        ctx.beginPath(); ctx.moveTo(m.mx, m.my);
        ctx.lineTo(W / 2 + (spread > 1 ? (i - 2) * W * 0.05 : 0), H / 2 + (spread > 1 ? G.rnd(-8, 8) : 0)); ctx.stroke();
      }
    }
  };
})();
