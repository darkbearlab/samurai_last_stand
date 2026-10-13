/* =====================================================================
   二條御所（暫名）— 數值與內容設定
   改平衡、改刀、改敵人，主要都在這個檔案。
   ===================================================================== */
(function () {
  'use strict';
  const G = (window.G = window.G || {});

  G.CONFIG = {
    version: '0.1.0',

    render: { height: 200, fog: 11 },

    player: {
      speed: 3.2, runMul: 1.45, turnSpeed: 2.6,
      mouseSens: 0.0022, touchSens: 0.006, radius: 0.22,
      maxHealth: 100,
      maxStamina: 100, staminaRegen: 38, staminaDelay: 0.45,
      chargeTime: 0.85,    // 從 0 蓄到滿所需秒數
      chargeCost: 36,      // 蓄滿總共消耗的氣
      tapCost: 6,          // 每次出手最低消耗
      parryCost: 12, parryCooldown: 0.25,
      // 招架判定：敵人頭上的擴張圈碰到外圈的那一刻為出手瞬間，
      // 在出手前 parryEarly 秒到出手後 parryLate 秒之間按下招架即成功
      parryEarly: 0.35, parryLate: 0.2,
      issenWindow: 0.9, issenMult: 3,
      swapTime: 0.3,
      tomeHeal: 10,        // 對硬直中的敵人補上致命一刀時回血（暫定）
      onigiriHeal: 20, dmgTaken: 1, parryMul: 1, parrySt: 8,
      inputBuffer: 0.18,
    },

    // 蓄力段落：c < sweet[0] 為輕，sweet 區間內為妙，超過為重
    zones: {
      light: { name: '輕', dmg: 0.55, stagger: 0.3 },
      sweet: { name: '妙', dmg: 1.5, stagger: 0.6 },
      heavy: { name: '重', dmg: 1.9, stagger: 0.9, knock: 0.55 },
    },

    /* 每把刀：數值、蓄力段落倍率（zoneDmg 會覆蓋 zones 的 dmg）、
       第一人稱的持法（stance）與砍法（swing），以及色調。
       stance/swing 的座標以畫面寬高的比例表示，角度 -π/2 為正上方。 */
    blades: [
      { id: 'wakizashi', name: '脇差', mark: '脇', role: '不會鈍的備用短刀', color: '#c9c2b0', len: 0.7,
        reach: 1.35, arc: 0.8, damage: 13, sweet: [0.12, 0.42], chargeMul: 1.4,
        swing: 0.15, recover: 0.12, infinite: true, canBreakShield: false,
        steel: '#cfd2d6', hamon: 'rgba(255,255,255,.7)', glow: null, trail: 'rgba(255,255,255,.25)',
        stance: { x: 0.76, y: 0.98, a: -1.75, lift: 0.04 }, swingPath: { x0: 0.78, y0: 0.9, x1: 0.56, y1: 1.02, a0: -1.3, a1: -2.9 },
        note: '不會變鈍；出手最快、威力最弱、破不了門板' },
      { id: 'dojikiri', name: '童子切安綱', mark: '童', role: '破盾、貫穿', color: '#c0392b', len: 1.05,
        reach: 1.75, arc: 0.8, damage: 28, sweet: [0.45, 0.72],
        swing: 0.28, recover: 0.24, wear: { light: 4, sweet: 2, heavy: 7 },
        pierce: true, pierceRange: 3.0, shieldMult: 2, restore: 'whetstone',
        steel: '#ddd2cf', hamon: 'rgba(255,235,230,.85)', glow: null, heavyGlow: '#c0392b', trail: 'rgba(220,90,70,.35)',
        stance: { x: 0.8, y: 0.96, a: -1.42, lift: 0.08 }, swingPath: { x0: 0.6, y0: 0.62, x1: 0.48, y1: 1.18, a0: -1.62, a1: -2.25 },
        note: '八相構。重段對門板傷害加倍，並貫穿身後的敵人；砥石恢復最多' },
      { id: 'onimaru', name: '鬼丸國綱', mark: '鬼', role: '不挑時機的重刀', color: '#e0782c', len: 0.98,
        reach: 1.7, arc: 1.35, damage: 34, sweet: [0.3, 0.58], zoneDmg: { light: 0.85, sweet: 1.1, heavy: 1.3 },
        swing: 0.26, recover: 0.22, wear: { light: 4, sweet: 3, heavy: 6 },
        sweetCleave: 2, restore: 'fire', fireRadius: 2.8, fireRate: 12,
        steel: '#bdb6ad', hamon: 'rgba(255,170,90,.8)', glow: null, fireGlow: '#ff7a1a', trail: 'rgba(255,140,60,.35)',
        stance: { x: 0.84, y: 1.0, a: -2.85, lift: 0.05 }, swingPath: { x0: 0.92, y0: 0.82, x1: 0.24, y1: 0.86, a0: -0.3, a1: -2.95 },
        note: '脇構。基礎攻擊最高、蓄力段落差距小、橫掃最寬；附近有火就恢復' },
      { id: 'odenta', name: '大典太光世', mark: '典', role: '招架', color: '#d9b54a', len: 0.95,
        reach: 1.8, arc: 0.85, damage: 26, sweet: [0.4, 0.75],
        swing: 0.2, recover: 0.14, wear: { light: 4, sweet: 2, heavy: 6 },
        restore: 'parry', parryRestore: 20, parryMul: 1.5, aweRadius: 2.6,
        steel: '#e3dac2', hamon: 'rgba(255,240,200,.85)', glow: null, parryGlow: '#f0c75a', trail: 'rgba(240,200,110,.3)',
        stance: { x: 0.64, y: 1.0, a: -2.05, lift: 0.05 }, swingPath: { x0: 0.68, y0: 0.9, x1: 0.48, y1: 1.02, a0: -1.55, a1: -2.6 },
        note: '中段構。招架窗口寬 1.5 倍、近處足輕畏縮；招架成功時恢復' },
      { id: 'mikazuki', name: '三日月宗近', mark: '三', role: '高手刀', color: '#8fb8e8', len: 1.0,
        reach: 1.8, arc: 0.8, damage: 26, sweet: [0.48, 0.6], zoneDmg: { light: 0.55, sweet: 2.0, heavy: 1.7 },
        swing: 0.22, recover: 0.18, wear: { light: 3, sweet: 0, heavy: 4 },
        restore: 'sweet', sweetRestore: 4,
        steel: '#dbe6f4', hamon: 'rgba(225,240,255,.95)', glow: 'rgba(160,200,255,.6)', trail: 'rgba(160,200,255,.45)',
        stance: { x: 0.7, y: 0.66, a: -2.2, lift: 0.06 }, swingPath: { x0: 0.78, y0: 0.5, x1: 0.3, y1: 1.08, a0: -1.15, a1: -3.45 },
        note: '上段構。妙段兩倍傷害、最耐用，但最佳區間最窄；命中最佳區間時恢復' },
    ],

    enemies: {
      yari: { name: '槍足輕', kind: 'melee', hp: 34, speed: 1.7, width: 0.32, scale: 0.92,
        reach: 2.0, keep: 1.5, windup: 0.8, recover: 0.6, cooldown: [1.2, 2.0],
        damage: [10, 14], parryable: true },
      teppo: { name: '鐵砲足輕', kind: 'gun', hp: 28, speed: 1.5, width: 0.3, scale: 0.92,
        range: 10, keepMin: 3.5, keepMax: 7, aim: 1.1, reload: 4.5, cooldown: [0.6, 1.4],
        damage: [18, 26] },
      tate: { name: '門板兵', kind: 'melee', hp: 40, shield: 70, speed: 1.05, width: 0.44, scale: 1.0,
        reach: 1.3, keep: 1.0, windup: 0.75, recover: 0.7, cooldown: [1.4, 2.2],
        damage: [7, 10], knock: 0.7, parryable: true, becomes: 'tateless' },
      tateless: { name: '失盾足輕', kind: 'melee', hp: 30, speed: 1.6, width: 0.32, scale: 0.92,
        reach: 1.25, keep: 0.9, windup: 0.65, recover: 0.5, cooldown: [1.0, 1.6],
        damage: [6, 9], parryable: true },
    },

    pickups: {
      whetstone: { name: '砥石', main: 40, other: 15 },
      onigiri: { name: '握り飯', heal: 20 },
    },

    director: {
      grace: 6, startAlive: 4, maxAlive: 14, growEvery: 35,
      spawnInterval: 2.2, minSpawnDist: 8, maxCorpses: 30,
      mix: [
        { t: 0, w: { yari: 1 } },
        { t: 40, w: { yari: 0.65, teppo: 0.35 } },
        { t: 80, w: { yari: 0.5, teppo: 0.25, tate: 0.25 } },
      ],
      dropWhetstone: 0.3, dropOnigiri: 0.2,
    },

    staggerRecover: 0.7, // 硬直結束後，敵人至少要等這麼久才會再出手
    poise: 0.45,         // 剛從硬直恢復的這段時間內，輕段打不出新的硬直

    /* 覺悟：斬殺累積，滿了三選一升級。主模式到 levelCap 後改為念出辭世之句。 */
    kakugo: { first: 6, step: 3, levelCap: 10, tomeBonus: 1 },
    jisei: ['五月雨は', '露か涙か', '不如帰', '我が名をあげよ', '雲の上まで'],

    /* 升級卡：max 為可疊加上限；blade 表示只有持有那把刀時才會出現 */
    upgrades: [
      { id: 'hp', text: '最大生命 +25', max: 3, apply: (P) => { P.stats.maxHealth += 25; P.hp += 25; } },
      { id: 'tome', text: '止め回血 +6', max: 3, apply: (P) => { P.stats.tomeHeal += 6; } },
      { id: 'onigiri', text: '握り飯回血 +10', max: 3, apply: (P) => { P.stats.onigiriHeal += 10; } },
      { id: 'stmax', text: '最大氣 +25', max: 3, apply: (P) => { P.stats.maxStamina += 25; P.st += 25; } },
      { id: 'stregen', text: '氣回復速度 +30%', max: 3, apply: (P) => { P.stats.staminaRegen *= 1.3; } },
      { id: 'charge', text: '蓄力耗氣 -20%', max: 3, apply: (P) => { P.stats.chargeCost *= 0.8; } },
      { id: 'armor', text: '受到傷害 -12%', max: 3, apply: (P) => { P.stats.dmgTaken *= 0.88; } },
      { id: 'parrywin', text: '招架窗口 +20%', max: 3, apply: (P) => { P.stats.parryMul += 0.2; } },
      { id: 'parryst', text: '招架成功回氣 +15', max: 3, apply: (P) => { P.stats.parrySt += 15; } },
      { id: 'waki', blade: 'wakizashi', text: '脇差：攻擊 +25%', max: 3, apply: (P) => { P.bl.wakizashi.damage *= 1.25; } },
      { id: 'doji1', blade: 'dojikiri', text: '童子切：對門板傷害 +50%', max: 3, apply: (P) => { P.bl.dojikiri.shieldMult += 1; } },
      { id: 'doji2', blade: 'dojikiri', text: '童子切：貫穿距離 +1', max: 3, apply: (P) => { P.bl.dojikiri.pierceRange += 1; } },
      { id: 'oni1', blade: 'onimaru', text: '鬼丸：基礎攻擊 +15%', max: 3, apply: (P) => { P.bl.onimaru.damage *= 1.15; } },
      { id: 'oni2', blade: 'onimaru', text: '鬼丸：感火半徑 +1', max: 3, apply: (P) => { P.bl.onimaru.fireRadius += 1; } },
      { id: 'oden1', blade: 'odenta', text: '大典太：招架窗口 +20%', max: 3, apply: (P) => { P.bl.odenta.parryMul += 0.2; } },
      { id: 'oden2', blade: 'odenta', text: '大典太：畏縮範圍 +1', max: 3, apply: (P) => { P.bl.odenta.aweRadius += 1; } },
      { id: 'mika1', blade: 'mikazuki', text: '三日月：妙段倍率 +0.3', max: 3, apply: (P) => { P.bl.mikazuki.zoneDmg.sweet += 0.3; } },
      { id: 'mika2', blade: 'mikazuki', text: '三日月：最佳區間加寬', max: 3, apply: (P) => { const s = P.bl.mikazuki.sweet; s[0] -= 0.025; s[1] += 0.025; } },
    ],

    ougi: { max: 100, sweetGain: 8, parryGain: 18, issenGain: 12, range: 9 },

    /* 可破壞的牆：外牆（W）與柱（P）是結構，打不壞；其餘依耐久值。
       zoneMult：各蓄力段落對牆的傷害倍率 */
    walls: {
      breakable: { S: { hp: 20, fx: 'paper', sfx: 'shoji' }, J: { hp: 20, fx: 'paper', sfx: 'shoji' },
                   K: { hp: 60, fx: 'wood', sfx: 'shieldbreak' }, D: { hp: 45, fx: 'wood', sfx: 'shieldbreak' } },
      zoneMult: { light: 0.3, sweet: 0.6, heavy: 1.2 }, bulletMult: 0.6,
    },
    map: { rooms: 4, roomSize: 5, shojiChance: 0.2, structChance: 0.15, paperDoorChance: 0.45, extraDoorChance: 0.25, braziers: 4, whetstones: 7, onigiri: 4 },
  };

  // 遊戲中取得的是這一局的複本（會被升級修改）；沒有進行中的局時取設定原值
  G.blade = (id) => (G.S && G.S.P.bl ? G.S.P.bl[id] : G.CONFIG.blades.find((b) => b.id === id));
  G.ps = () => (G.S ? G.S.P.stats : G.CONFIG.player);
})();
