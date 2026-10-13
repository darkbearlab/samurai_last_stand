/* 第一人稱持刀畫面（低解析度遊戲畫布）與蓄力弧 UI（高解析度覆蓋畫布） */
(function () {
  'use strict';
  const G = window.G;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  /* ---------- 刀 ---------- */
  function drawBlade(ctx, H, x, y, ang, b, o) {
    const L = H * 0.6 * b.len, w = Math.max(2, H * 0.016);
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    const t0 = L * 0.16, tip = L * 1.16;
    // 柄
    ctx.fillStyle = '#16110d'; ctx.fillRect(-L * 0.14, -w * 1.1, L * 0.28, w * 2.2);
    ctx.fillStyle = '#d8cfb8';
    for (let i = -L * 0.12; i < L * 0.12; i += w * 1.6) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + w * 0.7, -w * 0.8); ctx.lineTo(i + w * 1.4, 0); ctx.lineTo(i + w * 0.7, w * 0.8); ctx.fill(); }
    // 鍔、鎺
    ctx.fillStyle = '#2c2620'; ctx.beginPath(); ctx.ellipse(L * 0.145, 0, w * 0.8, w * 2.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c9a34a'; ctx.fillRect(t0 - w * 0.2, -w * 0.9, w * 1.4, w * 1.8);
    // 刀身（帶反り）
    const curve = (t) => -L * 0.06 * t * t;
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = 8; }
    ctx.fillStyle = o.dull ? '#7d8186' : '#cfd5dc';
    ctx.beginPath();
    const steps = 10;
    for (let i = 0; i <= steps; i++) { const t = i / steps, xx = t0 + (tip - t0) * t * 0.93; ctx.lineTo(xx, -w * (1 - t * 0.3) + curve(t)); }
    ctx.lineTo(tip, curve(1) + w * 0.1);
    for (let i = steps; i >= 0; i--) { const t = i / steps, xx = t0 + (tip - t0) * t * 0.93; ctx.lineTo(xx, w * 0.75 * (1 - t * 0.4) + curve(t)); }
    ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    // 刃文
    ctx.strokeStyle = o.dull ? 'rgba(200,200,200,.35)' : 'rgba(255,255,255,.85)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) { const t = i / steps, xx = t0 + (tip - t0) * t * 0.93; ctx.lineTo(xx, w * 0.3 * (1 - t * 0.4) + curve(t) + (i % 2 ? 0.6 : -0.3)); }
    ctx.stroke();
    if (o.dull) { ctx.fillStyle = '#3a3c40'; for (const t of [0.35, 0.55, 0.78]) ctx.fillRect(t0 + (tip - t0) * t, w * 0.4 + curve(t), 2, 2); }
    if (b.id === 'mikazuki') { ctx.strokeStyle = 'rgba(255,255,255,.9)'; for (const t of [0.15, 0.3, 0.45]) { ctx.beginPath(); ctx.arc(t0 + (tip - t0) * t, curve(t) - w * 0.2, w * 0.5, 0.2, Math.PI - 0.2); ctx.stroke(); } }
    ctx.restore();
    // 手與袖
    ctx.fillStyle = '#1f2436';
    ctx.beginPath(); ctx.moveTo(x + H * 0.05, y + H * 0.02); ctx.lineTo(x + H * 0.32, y + H * 0.42); ctx.lineTo(x - H * 0.02, y + H * 0.42); ctx.lineTo(x - H * 0.07, y + H * 0.05); ctx.fill();
    ctx.fillStyle = '#a87a58'; ctx.beginPath(); ctx.arc(x, y, H * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8b6347'; ctx.beginPath(); ctx.arc(x + H * 0.02, y + H * 0.02, H * 0.03, 0, Math.PI * 2); ctx.fill();
  }

  G.drawFirstPerson = function (ctx, W, H) {
    const S = G.S, P = S.P, b = G.blade(P.cur), C = G.CONFIG.player;
    const dull = !b.infinite && P.sharp[b.id] <= 0;
    let ang = -1.9, x = W * 0.7, y = H * 0.98;
    const bx = Math.cos(P.bob) * 4 * P.moveAmt, by = Math.abs(Math.sin(P.bob)) * 4 * P.moveAmt;
    let glow = null;
    if (P.fireNear && b.id === 'onimaru') glow = '#ff8a2a';
    if (P.issenT > 0) glow = '#fff3c4';

    if (P.act === 'charge') {
      const c = easeOut(P.charge);
      ang = -1.9 + c * 0.85; x += c * W * 0.05; y -= c * H * 0.07;
      const z = zoneOf(b, P.charge);
      if (z === 'sweet') glow = b.color;
      if (z === 'heavy') { x += G.rnd(-1, 1); y += G.rnd(-1, 1); glow = '#e2553b'; }
    } else if (P.act === 'swing') {
      const t = G.clamp((P.swingTotal - P.actT) / P.swingDur, 0, 1), e = easeOut(t);
      const from = P.swingFrom, to = -3.55;
      ang = from + (to - from) * e;
      x = G.lerp(W * 0.74, W * 0.42, e); y = G.lerp(H * 0.92, H * 1.06, e);
      if (t < 1) {
        const L = H * 0.6 * b.len * 1.1, a0 = Math.max(to, ang + 0.0), a1 = Math.min(from, ang + 0.9);
        ctx.fillStyle = P.swingIssen ? 'rgba(255,240,190,.55)' : P.swingZone === 'heavy' ? 'rgba(255,170,150,.35)' : 'rgba(255,255,255,.3)';
        ctx.beginPath(); ctx.arc(x, y, L, a1, a0, true); ctx.arc(x, y, L * 0.45, a0, a1, false); ctx.fill();
      }
    } else if (P.act === 'parry') {
      ang = -2.95; x = W * 0.66; y = H * 0.86;
    } else if (P.act === 'swap') {
      y += H * 0.55 * Math.sin((Math.PI * P.actT) / C.swapTime);
    }
    if (P.recoilT > 0) { x += P.recoilT * 30; ang += P.recoilT * 1.5; }
    drawBlade(ctx, H, x + bx, y + by, ang, b, { dull, glow });
  };

  function zoneOf(b, c) { return c < b.sweet[0] ? 'light' : c <= b.sweet[1] ? 'sweet' : 'heavy'; }
  G.zoneOf = zoneOf;

  /* ---------- 蓄力弧 UI ---------- */
  let ui, uctx, dpr = 1;
  G.initUI = function () { ui = G.$('ui'); uctx = ui.getContext('2d'); G.resizeUI(); };
  G.resizeUI = function () {
    if (!ui) return;
    const r = ui.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1);
    ui.width = Math.max(1, Math.round(r.width * dpr)); ui.height = Math.max(1, Math.round(r.height * dpr));
  };
  G.drawUI = function () {
    if (!uctx) return;
    const S = G.S, P = S.P, b = G.blade(P.cur), w = ui.width / dpr, h = ui.height / dpr;
    uctx.setTransform(dpr, 0, 0, dpr, 0, 0); uctx.clearRect(0, 0, w, h);
    if (S.state !== 'play') return;
    const cx = w / 2, cy = h / 2, R = Math.max(26, Math.min(w, h) * 0.065);
    const A0 = -Math.PI / 2, SPAN = Math.PI * 1.6, A = (t) => A0 + t * SPAN;
    const charging = P.act === 'charge';
    // 準星
    uctx.fillStyle = 'rgba(255,240,210,.8)'; uctx.fillRect(cx - 1, cy - 1, 2, 2);
    // 軌道與最佳區間
    uctx.lineCap = 'butt';
    uctx.strokeStyle = charging ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.08)'; uctx.lineWidth = 3;
    uctx.beginPath(); uctx.arc(cx, cy, R, A(0), A(1)); uctx.stroke();
    uctx.strokeStyle = b.color; uctx.globalAlpha = charging ? 0.85 : 0.3; uctx.lineWidth = charging ? 7 : 4;
    uctx.beginPath(); uctx.arc(cx, cy, R, A(b.sweet[0]), A(b.sweet[1])); uctx.stroke();
    uctx.globalAlpha = 1;
    if (charging) {
      const z = zoneOf(b, P.charge);
      uctx.strokeStyle = z === 'sweet' ? '#fff6dc' : z === 'heavy' ? '#e2553b' : 'rgba(255,255,255,.75)';
      uctx.lineWidth = 3; uctx.beginPath(); uctx.arc(cx, cy, R - 6, A(0), A(Math.max(0.01, P.charge))); uctx.stroke();
      uctx.font = '700 15px "Noto Serif TC", serif'; uctx.textAlign = 'center'; uctx.textBaseline = 'middle';
      uctx.fillStyle = z === 'sweet' ? b.color : z === 'heavy' ? '#e2553b' : 'rgba(255,255,255,.75)';
      uctx.fillText(G.CONFIG.zones[z].name, cx, cy + R + 16);
      if (P.st <= 0.5) { uctx.fillStyle = '#e2553b'; uctx.font = '700 12px "Noto Sans TC", sans-serif'; uctx.fillText('氣盡', cx, cy - R - 14); }
    }
    if (P.issenT > 0) {
      const k = P.issenT / G.CONFIG.player.issenWindow;
      uctx.strokeStyle = `rgba(255,236,180,${0.4 + 0.6 * k})`; uctx.lineWidth = 2;
      uctx.beginPath(); uctx.arc(cx, cy, R + 10 + (1 - k) * 8, 0, Math.PI * 2); uctx.stroke();
      uctx.font = '900 20px "Noto Serif TC", serif'; uctx.textAlign = 'center'; uctx.textBaseline = 'middle';
      uctx.fillStyle = '#ffe9b0'; uctx.fillText('一閃', cx, cy - R - 22);
    }
    if (P.parryT > 0) { uctx.strokeStyle = 'rgba(180,220,255,.8)'; uctx.lineWidth = 2; uctx.beginPath(); uctx.arc(cx, cy, R * 0.55, 0, Math.PI * 2); uctx.stroke(); }
  };
})();
