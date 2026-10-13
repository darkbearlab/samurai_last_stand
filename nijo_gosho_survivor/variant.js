/* =====================================================================
   二條御所・生存者 —— 腦內啡版
   戰鬥邏輯與本篇相同；差別在敵人的打法、數量與地圖大小：
   - 槍足輕、門板兵：不出招，碰到就扣血（門板破了之後一樣）
   - 弓足輕（新）：射出看得見的箭，可以閃，也可以招架彈回
   - 鐵砲足輕：不再是看不見的即時命中，改成在地上畫出落點預告
   - 房間變大、敵人大量湧入、刀不會鈍：只剩耐力管理與「不要被淹沒」
   引擎與本篇共用 ../nijo_gosho/js/，這裡只覆寫設定與文字。
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G, C = G.CONFIG;
  C.version = '0.1.0・生存者';
  C.noWear = true; // 刀不會鈍

  C.text = {
    title: '二條御所・生存者',
    lead: '刀不會鈍，只會累。敵人會一波接一波湧進來，不要被淹沒。',
    rules: `<div class="rules"><p>蓄力系統照舊：準星外圈標出最佳區間。這一版每一刀都能砍到好幾個人：輕段兩人、妙段三人、重段一整片。唯一要顧的是氣。</p>
      <p>槍足輕與門板兵碰到你就會扣血；弓足輕射箭，可以閃，也可以在箭到之前按招架彈回去；鐵砲會先在你腳下畫出紅圈，紅圈填滿之前離開。</p></div>`,
  };

  /* 每一刀都打得到一群人 */
  C.zones.light.cleave = 2;
  C.zones.sweet.cleave = 3;
  C.zones.heavy.cleave = 10;

  C.player.maxHealth = 150;

  /* 大房間、寬一點的通路、少量結構牆 */
  Object.assign(C.map, { rooms: 4, roomSize: 9, shojiChance: 0.15, structChance: 0.1, extraDoorChance: 0.5, braziers: 6, whetstones: 0, onigiri: 10 });

  /* 大量湧入 */
  Object.assign(C.director, {
    grace: 3, startAlive: 18, maxAlive: 70, growEvery: 12, spawnInterval: 0.6, minSpawnDist: 9, maxCorpses: 40,
    groupSize: [2, 4],
    mix: [
      { t: 0, w: { yari: 1 } },
      { t: 20, w: { yari: 0.7, yumi: 0.3 } },
      { t: 45, w: { yari: 0.55, yumi: 0.2, teppo: 0.1, tate: 0.15 } },
      { t: 90, w: { yari: 0.45, yumi: 0.25, teppo: 0.15, tate: 0.15 } },
    ],
    dropWhetstone: 0, dropOnigiri: 0.04,
  });

  C.enemies.yari = { name: '槍足輕', kind: 'contact', hp: 20, speed: 1.9, width: 0.32, scale: 0.92, damage: [6, 9], touchCd: 0.9 };
  C.enemies.tate = { name: '門板兵', kind: 'contact', hp: 30, shield: 50, speed: 1.2, width: 0.44, scale: 1.0, damage: [8, 11], touchCd: 1.0, becomes: 'tateless' };
  C.enemies.tateless = { name: '失盾足輕', kind: 'contact', hp: 20, speed: 1.9, width: 0.32, scale: 0.92, damage: [6, 9], touchCd: 0.9 };
  C.enemies.yumi = { name: '弓足輕', kind: 'shooter', hp: 18, speed: 1.4, width: 0.32, scale: 0.92, range: 10, keepMin: 4, keepMax: 8,
    windup: 0.8, recover: 0.5, cooldown: [1.5, 2.5], damage: [6, 9], projSpeed: 6, spread: 0.05, projSprite: 'arrow' };
  C.enemies.teppo = { name: '鐵砲足輕', kind: 'lob', hp: 20, speed: 1.3, width: 0.3, scale: 0.92, range: 11, keepMin: 4, keepMax: 8,
    aim: 0.5, reload: 3.5, cooldown: [0.6, 1.2], damage: [14, 18], radius: 1.0, delay: 1.1 };

  /* 升級：沒有上限，不會轉成辭世之句；拿掉跟鋒利度有關的卡 */
  Object.assign(C.kakugo, { first: 10, step: 6, levelCap: 999 });
  C.upgrades = C.upgrades.filter((u) => !['oni2'].includes(u.id));

  /* =====================================================================
     節奏戰鬥（生存者版專用）：只剩「攻擊」與「換刀」，沒有耐力、蓄力、招架鍵
     - 第一下：一般傷害
     - 揮出後白圈往外擴，碰到基準圈時再按＝妙段，才能接下一段；每第 5 段是重擊收尾
     - 敵人貼近時紅圈往內縮，縮到基準圈時按攻擊＝反擊一閃：擋下、推開、轉向他，
       並取消其他正在逼近的紅圈；之後接住的每個妙段都是一閃傷害
     - 連到第 12 段自動發動一之太刀
     ===================================================================== */
  const RH = (C.rhythm = { early: 0.1, late: 0.08, maxThreats: 3, finisherEvery: 5, ougiEvery: 12 });
  C.zones.open = { name: '', dmg: 1.0, stagger: 0.45, cleave: 2 };
  C.zones.sweet.dmg = 1.8; C.zones.sweet.issenCleave = 3; C.zones.heavy.issenCleave = 10;
  C.walls.zoneMult.open = 0.5;
  for (const k of ['yari', 'tate', 'tateless']) C.enemies[k].threat = 0.8;
  // 每把刀的節奏：lock＝出手後鎖定時間、beat＝下一拍的時間點、tol＝判定寬度倍率、counter＝反擊判定倍率
  const BEAT = {
    wakizashi: { lock: 0.2, beat: 0.42, tol: 1.0, counter: 1.0 },
    dojikiri: { lock: 0.34, beat: 0.6, tol: 1.0, counter: 1.0 },
    onimaru: { lock: 0.36, beat: 0.64, tol: 1.25, counter: 1.0 },
    odenta: { lock: 0.28, beat: 0.52, tol: 1.0, counter: 1.5 },
    mikazuki: { lock: 0.24, beat: 0.46, tol: 0.8, counter: 1.0 },
  };
  for (const b of C.blades) Object.assign(b, BEAT[b.id]);
  C.text.desk = `<dl class="keys"><dt>WASD</dt><dd>移動（Shift 奔跑）</dd><dt>滑鼠</dt><dd>轉向；點擊畫面鎖定滑鼠</dd>
    <dt>左鍵／空白</dt><dd>攻擊：白圈碰到基準圈時再按＝接段；紅圈縮到基準圈時按＝反擊一閃</dd>
    <dt>1–5／Q／滾輪</dt><dd>換刀</dd><dt>M</dt><dd>地圖</dd><dt>Esc／P</dt><dd>暫停</dd></dl>`;
  C.text.touch = `<dl class="keys"><dt>左半邊</dt><dd>拖曳移動</dd><dt>右半邊</dt><dd>左右拖曳轉向</dd>
    <dt>斬</dt><dd>白圈碰到基準圈時再按＝接段；紅圈縮到基準圈時按＝反擊一閃</dd><dt>換</dt><dd>換刀</dd></dl>`;
  C.text.rules = `<div class="rules"><p>這一版沒有耐力和招架鍵，只看節奏。第一刀是普通傷害；揮出後白圈往外擴，碰到中央的基準圈時再按就是「妙」，可以一路接下去，每第 5 段是重擊。</p>
    <p>敵人貼近時會亮出紅圈往內縮，縮到基準圈時按攻擊就是反擊一閃：擋下、推開，並打斷其他逼近的紅圈。反擊之後接住的每一段都是一閃。連到第 12 段會自動發動一之太刀。</p></div>`;

  /* ---------- 刀劍相擊聲（合成：金屬的非諧波泛音 + 高頻雜訊） ---------- */
  const PENTA = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760];
  let linkStep = 0;
  function clash(base, v, bright) {
    [1, 2.76, 5.4, 8.93].forEach((r, i) => G.tn('sine', base * r, base * r * 0.995, 0.7 / (1 + i * 0.7), (0.1 * v) / (i + 1)));
    G.nz(0.05, bright ? 9000 : 6000, 0.3 * v, 'highpass');
  }
  G.SFX.rh_open = (v) => { G.nz(0.14, 2600, 0.25 * v, 'bandpass', 900); };
  G.SFX.rh_link = (v) => { clash(PENTA[linkStep % PENTA.length], v, false); };
  G.SFX.rh_fin = (v) => { clash(392, v, true); G.nz(0.3, 900, 0.4 * v); };
  G.SFX.rh_counter = (v) => { clash(1568, v, true); G.tn('triangle', 2400, 2380, 0.5, 0.12 * v); };
  G.SFX.rh_miss = (v) => { G.tn('square', 220, 160, 0.08, 0.05 * v); };

  /* ---------- 戰鬥更新：取代本篇的蓄力／耐力／招架 ---------- */
  const now = () => G.S.time;
  function blade() { return G.blade(G.S.P.cur); }
  function rh() { const P = G.S.P; return P.rh || (P.rh = { chain: 0, beatT0: 0, beat: 0, issen: false, flash: 0, missT: 0 }); }
  function threats() { return G.S.enemies.filter((e) => !e.dead && e.phase === 'threat').sort((a, b) => a.phT - b.phT); }
  function strike(zone, issen) {
    const P = G.S.P, b = blade();
    P.act = 'swing'; P.swingZone = zone === 'open' ? 'light' : zone; P.swingIssen = issen;
    P.swingTotal = b.lock; P.swingDur = Math.min(b.swing, b.lock * 0.8); P.actT = b.lock;
    P.pending = { zone, t: 0.03, issen };
  }
  function nextOwned(dir) {
    const P = G.S.P, list = C.blades.filter((b) => P.owned[b.id]);
    const i = list.findIndex((b) => b.id === P.cur);
    return list[(i + dir + list.length) % list.length].id;
  }
  function autoOugi() {
    const S = G.S, P = S.P; let n = 0;
    for (const e of S.enemies) {
      if (e.dead) continue;
      const dx = e.x - P.x, dy = e.y - P.y;
      if (Math.hypot(dx, dy) > C.ougi.range || Math.abs(G.angDiff(Math.atan2(dy, dx), P.a)) > 0.9 || !G.los(P.x, P.y, e.x, e.y)) continue;
      e.shield = 0; G.addFx(e.x, e.y, 'blood', 0.4, { l: 0.45, s: 0.35 }); G.killEnemy(e, false); n++;
    }
    S.ougiFlash = 0.9; S.hitStop = 0.12; S.shake = 0.6; S.stats.ougi++;
    G.sfx('ougi'); G.toast(`一之太刀　斬 ${n}`);
  }

  G.updateCombat = function (dt) {
    const S = G.S, P = S.P, IN = G.IN, R = rh(), t = now();
    P.issenT = 0; P.recoilT = Math.max(0, P.recoilT - dt); P.st = P.stats.maxStamina;
    R.flash = Math.max(0, R.flash - dt); R.missT = Math.max(0, R.missT - dt);

    // 換刀（打斷連段）
    let want = null;
    if (IN.select >= 0) { const bl = C.blades[IN.select]; if (bl && P.owned[bl.id]) want = bl.id; }
    if (IN.swapNext) want = nextOwned(IN.swapNext);
    if (want && want !== P.cur && P.act !== 'swing') { G.startSwap(want); R.chain = 0; R.issen = false; }

    if (P.act === 'swing') {
      P.actT -= dt;
      if (P.pending) { P.pending.t -= dt; if (P.pending.t <= 0) { G.resolveHit(P.pending); P.pending = null; } }
      if (P.actT <= 0) P.act = 'idle';
    } else if (P.act === 'swap') { P.actT -= dt; if (P.actT <= 0) P.act = 'idle'; }

    const b = blade();
    // 錯過這一拍：斷連
    if (R.chain > 0 && t > R.beatT0 + R.beat + RH.late * b.tol) { R.chain = 0; R.issen = false; R.missT = 0.3; G.sfx('rh_miss'); }

    if (!IN.atkPressed || P.act === 'swap') return;
    P.lastParry = t; // 箭在打到你之前按攻擊也能彈回
    const th = threats()[0];
    if (th && th.phT <= RH.early * b.counter && th.phT >= -RH.late * b.counter) {
      // 反擊一閃：轉向、擋下、推開，取消其他正在逼近的紅圈
      P.a = Math.atan2(th.y - P.y, th.x - P.x);
      G.onParry(th); P.issenT = 0;
      for (const e of S.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - P.x, e.y - P.y) || 1;
        if (e.phase === 'threat' || d < 2.2) {
          if (e !== th) { e.phase = 'chase'; e.touchCd = Math.max(e.touchCd, 0.7); }
          G.move(e, ((e.x - P.x) / d) * 0.6, ((e.y - P.y) / d) * 0.6, 0.25);
        }
      }
      R.issen = true; R.chain = Math.max(1, R.chain + 1); R.beatT0 = t; R.beat = b.beat; R.flash = 0.35;
      strike('sweet', true); G.sfx('rh_counter'); S.stats.issen++;
      return;
    }
    if (R.chain > 0 && Math.abs(t - (R.beatT0 + R.beat)) <= RH.early * b.tol) {
      // 接段：妙段；每第 N 段是重擊收尾
      R.chain++;
      const fin = R.chain % RH.finisherEvery === 0;
      strike(fin ? 'heavy' : 'sweet', R.issen);
      linkStep = R.chain; G.sfx(fin ? 'rh_fin' : 'rh_link');
      R.beatT0 = t; R.beat = b.beat; R.flash = 0.25;
      if (R.chain % RH.ougiEvery === 0) autoOugi();
      return;
    }
    if (P.act === 'idle') {
      // 第一下（或節奏亂了重新起手）
      if (R.chain > 0) { R.missT = 0.3; G.sfx('rh_miss'); }
      R.chain = 1; R.issen = false; R.beatT0 = t; R.beat = b.beat;
      strike('open', false); G.sfx('rh_open');
    }
  };

  /* ---------- 節奏 UI：基準圈、往外擴的白圈、往內縮的紅圈 ---------- */
  const baseDrawUI = G.drawUI;
  G.drawUI = function () {
    baseDrawUI();
    const S = G.S; if (!S || S.state !== 'play') return;
    const ui = document.getElementById('ui'), g = ui.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = ui.width / dpr, h = ui.height / dpr, cx = w / 2, cy = h / 2, R0 = Math.max(30, Math.min(w, h) * 0.08);
    const P = S.P, R = rh(), b = blade(), t = now();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 基準圈
    g.strokeStyle = R.issen ? 'rgba(255,233,176,.9)' : 'rgba(201,163,74,.75)'; g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, R0, 0, Math.PI * 2); g.stroke();
    // 白圈：下一拍
    if (R.chain > 0) {
      const p = (t - R.beatT0) / R.beat, band = (RH.early * b.tol) / R.beat;
      g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(cx, cy, R0 * (1 + band), 0, Math.PI * 2); g.arc(cx, cy, R0 * Math.max(0, 1 - band), 0, Math.PI * 2, true); g.fill();
      const inWin = Math.abs(p - 1) <= band;
      g.strokeStyle = inWin ? '#fff6dc' : 'rgba(255,255,255,.8)'; g.lineWidth = inWin ? 4 : 2;
      g.beginPath(); g.arc(cx, cy, Math.max(1, R0 * Math.min(p, 1.3)), 0, Math.PI * 2); g.stroke();
    }
    // 紅圈：最快打到你的那一個威脅
    const th = threats()[0];
    if (th) {
      const k = Math.max(-0.2, th.phT / th.wind), inWin = th.phT <= RH.early * b.counter && th.phT >= -RH.late * b.counter;
      g.strokeStyle = inWin ? '#ff5a3a' : 'rgba(226,85,59,.85)'; g.lineWidth = inWin ? 5 : 3;
      g.beginPath(); g.arc(cx, cy, R0 * (1 + 1.4 * Math.max(0, k)), 0, Math.PI * 2); g.stroke();
      // 威脅來自哪個方向
      const rel = G.angDiff(Math.atan2(th.y - P.y, th.x - P.x), P.a);
      g.fillStyle = '#ff5a3a'; g.beginPath(); g.arc(cx + Math.sin(rel) * R0 * 2.6, cy - Math.cos(rel) * R0 * 2.6, 5, 0, Math.PI * 2); g.fill();
    }
    // 連段數
    if (R.chain > 1 || R.flash > 0) {
      g.font = '900 22px "Noto Serif TC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = R.issen ? '#ffe9b0' : '#e8e0cc';
      g.fillText(`${R.chain} 連${R.issen ? '・一閃' : ''}`, cx, cy + R0 + 26);
    }
    if (R.missT > 0) { g.font = '700 13px "Noto Sans TC", sans-serif'; g.fillStyle = 'rgba(226,85,59,.9)'; g.fillText('亂', cx, cy - R0 - 16); }
  };
})();
