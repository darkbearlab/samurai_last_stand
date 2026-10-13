/* 儀表列、提示訊息、標題／暫停／戰死畫面 */
(function () {
  'use strict';
  const G = window.G;
  const $ = G.$;
  let cache = {}, toastT = 0;

  G.initHud = function () {
    $('slots').innerHTML = G.CONFIG.blades.map((b, i) =>
      `<div class="slot" id="slot-${b.id}" title="${b.name}"><span class="k">${i + 1}</span><span class="m">${b.mark}</span><span class="s"><i></i></span></div>`).join('');
    cache = {};
  };

  function setW(id, pct) { const k = 'w' + id, v = Math.round(pct * 1000) / 10; if (cache[k] !== v) { cache[k] = v; $(id).style.width = v + '%'; } }
  function setT(id, t) { if (cache[id] !== t) { cache[id] = t; $(id).textContent = t; } }
  function setC(el, cls, on) { const k = el.id + cls; if (cache[k] !== on) { cache[k] = on; el.classList.toggle(cls, on); } }

  G.updateHud = function (dt) {
    const S = G.S, P = S.P, C = G.CONFIG.player, b = G.blade(P.cur);
    setW('bHp', P.hp / C.maxHealth); setT('vHp', String(Math.ceil(P.hp)));
    setC($('hpCell'), 'low', P.hp <= 30);
    setW('bSt', P.st / C.maxStamina);
    setT('bName', b.name);
    setW('bSharp', b.infinite ? 1 : P.sharp[b.id] / 100);
    setC($('sharpCell'), 'dull', !b.infinite && P.sharp[b.id] <= 0);
    setC($('sharpCell'), 'inf', !!b.infinite);
    setW('bOugi', P.ougi / G.CONFIG.ougi.max);
    setC($('ougiCell'), 'ready', P.ougi >= G.CONFIG.ougi.max);
    setT('vTime', G.fmtTime(S.time)); setT('vKills', String(S.kills));
    for (const bl of G.CONFIG.blades) {
      const el = $('slot-' + bl.id);
      setC(el, 'own', !!P.owned[bl.id]); setC(el, 'cur', P.cur === bl.id);
      setC(el, 'dull', !!P.owned[bl.id] && !bl.infinite && P.sharp[bl.id] <= 0);
      const k = 'sl' + bl.id, v = bl.infinite ? 100 : Math.round(P.sharp[bl.id] || 0);
      if (cache[k] !== v) { cache[k] = v; el.querySelector('i').style.width = v + '%'; }
    }
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('show'); }
  };

  G.toast = function (t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); toastT = 1.6; };

  const desk = `<dl class="keys">
    <dt>WASD</dt><dd>移動（Shift 奔跑）</dd>
    <dt>滑鼠</dt><dd>轉向；點擊畫面鎖定滑鼠</dd>
    <dt>左鍵按住</dt><dd>蓄力，放開出刀（也可用空白鍵或 J）</dd>
    <dt>右鍵</dt><dd>招架（K）；成功後立刻再按攻擊即為一閃</dd>
    <dt>R</dt><dd>一之太刀（量表滿時）</dd>
    <dt>1–5／Q／滾輪</dt><dd>換刀</dd>
    <dt>M</dt><dd>地圖</dd><dt>Esc／P</dt><dd>暫停</dd></dl>`;
  const touch = `<dl class="keys">
    <dt>左半邊</dt><dd>拖曳移動</dd><dt>右半邊</dt><dd>左右拖曳轉向</dd>
    <dt>斬</dt><dd>按住蓄力，放開出刀</dd><dt>受</dt><dd>招架；成功後立刻按斬為一閃</dd>
    <dt>換／奧</dt><dd>換刀／一之太刀</dd></dl><p class="hint">橫向持握手機會比較好玩。</p>`;
  const rules = `<p>按住蓄力時，準星外圈會標出這把刀的<b>最佳區間</b>。在區間內放開是「妙」：傷害高、刀耗損少、累積一之太刀。太輕砍不痛，太重則傷刀，但能破門板、砍穿障子。</p>
    <p>四把名刀散落在御所各處。名刀不會斷，只會變鈍；每把刀各有恢復鋒利度的方式。</p>`;

  G.screenShown = true;
  G.showScreen = function (kind) {
    const S = G.S;
    G.screenShown = true; $('screen').hidden = false; G.IN.atkHeld = false;
    if (document.pointerLockElement) try { document.exitPointerLock(); } catch (e) { /* 忽略 */ }
    const stats = S ? `<div class="stats">
      <div><span class="lbl">存活</span><span class="val">${G.fmtTime(S.time)}</span></div>
      <div><span class="lbl">斬殺</span><span class="val">${S.kills}</span></div>
      <div><span class="lbl">招架</span><span class="val">${S.stats.parry}</span></div>
      <div><span class="lbl">一閃</span><span class="val">${S.stats.issen}</span></div>
      <div><span class="lbl">止め</span><span class="val">${S.stats.tome}</span></div>
      <div><span class="lbl">一之太刀</span><span class="val">${S.stats.ougi}</span></div>
      <div><span class="lbl">名刀</span><span class="val">${Object.keys(S.P.owned).length - 1}/4</span></div></div>` : '';
    const html = {
      start: `<div class="eyebrow">永祿八年五月十九日 · 原型 v${G.CONFIG.version}</div><h1>二條御所</h1>
        <p class="lead">御所已被包圍。手上只有一把脇差。去把散落在各房間的名刀收回來。</p>
        ${rules}${G.isTouch ? touch : desk}
        <p class="hint">這個原型只驗證刀戰手感：敵人會無止境地湧入，撐到倒下為止。火災、階段與結局尚未實作。</p>
        <div class="row"><button class="btn" id="go" type="button">出陣</button><a class="back" href="../index.html">← 選擇人物</a></div>`,
      pause: `<div class="eyebrow">暫停</div><h1>一息</h1>${stats}<p class="hint">地圖種子 ${S && S.seed}</p><button class="btn" id="go" type="button">繼續</button>`,
      dead: `<div class="eyebrow">於此戰死</div><h1>力盡</h1>${stats}<p class="hint">地圖種子 ${S && S.seed}</p><button class="btn" id="go" type="button">再戰</button>`,
    }[kind];
    $('panel').innerHTML = html;
    $('go').addEventListener('click', () => {
      G.initAudio();
      if (kind === 'pause') G.S.paused = false; else G.newGame();
      G.hideScreen();
    });
    $('go').focus();
  };
  G.hideScreen = function () { G.screenShown = false; $('screen').hidden = true; if (!G.isTouch && G.lockPointer) G.lockPointer(); };
  G.togglePause = function () {
    const S = G.S; if (!S || S.state !== 'play' || G.screenShown && !S.paused) return;
    S.paused = !S.paused; if (S.paused) G.showScreen('pause'); else G.hideScreen();
  };
})();
