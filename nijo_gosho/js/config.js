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
      chargeTime: 1.0,     // 從 0 蓄到滿所需秒數
      chargeCost: 36,      // 蓄滿總共消耗的氣
      tapCost: 6,          // 每次出手最低消耗
      parryCost: 14, parryWindow: 0.24, parryCooldown: 0.4,
      issenWindow: 0.9, issenMult: 3,
      swapTime: 0.3,
      tomeHeal: 10,        // 對硬直中的敵人補上致命一刀時回血（暫定）
      inputBuffer: 0.18,
    },

    // 蓄力段落：c < sweet[0] 為輕，sweet 區間內為妙，超過為重
    zones: {
      light: { name: '輕', dmg: 0.55, stagger: 0.12 },
      sweet: { name: '妙', dmg: 1.25, stagger: 0.28 },
      heavy: { name: '重', dmg: 1.9, stagger: 0.7, knock: 0.55 },
    },

    blades: [
      { id: 'wakizashi', name: '脇差', mark: '脇', color: '#c9c2b0', len: 0.72,
        reach: 1.35, arc: 0.8, damage: 13, sweet: [0.12, 0.42], chargeMul: 1.4,
        swing: 0.15, recover: 0.12, infinite: true, canBreakShield: false,
        note: '不會變鈍；出手最快、威力最弱、破不了門板' },
      { id: 'dojikiri', name: '童子切安綱', mark: '童', color: '#d4553b', len: 1.0,
        reach: 1.75, arc: 0.8, damage: 24, sweet: [0.45, 0.72],
        swing: 0.26, recover: 0.22, wear: { light: 4, sweet: 2, heavy: 7 },
        pierce: true, restore: 'whetstone',
        note: '重段貫穿整排敵人與門板；砥石恢復最多' },
      { id: 'onimaru', name: '鬼丸國綱', mark: '鬼', color: '#e0782c', len: 0.95,
        reach: 1.7, arc: 1.25, damage: 20, sweet: [0.3, 0.58],
        swing: 0.24, recover: 0.2, wear: { light: 4, sweet: 2, heavy: 6 },
        sweetCleave: 2, restore: 'fire', fireRadius: 2.8, fireRate: 12,
        note: '斬擊範圍最寬；附近有火就持續恢復' },
      { id: 'odenta', name: '大典太光世', mark: '典', color: '#d9b54a', len: 0.95,
        reach: 1.8, arc: 0.85, damage: 30, sweet: [0.55, 0.82],
        swing: 0.3, recover: 0.26, wear: { light: 5, sweet: 2, heavy: 6 },
        restore: 'parry', parryRestore: 20, aweRadius: 2.6,
        note: '持刀時近處足輕畏縮；招架成功時恢復' },
      { id: 'mikazuki', name: '三日月宗近', mark: '三', color: '#8fb8e8', len: 1.0,
        reach: 1.8, arc: 0.8, damage: 28, sweet: [0.5, 0.6],
        swing: 0.22, recover: 0.18, wear: { light: 4, sweet: 0, heavy: 5 },
        restore: 'sweet', sweetRestore: 4,
        note: '最佳區間最窄；命中最佳區間時恢復' },
    ],

    enemies: {
      yari: { name: '槍足輕', kind: 'melee', hp: 40, speed: 1.7, width: 0.32, scale: 0.92,
        reach: 2.0, keep: 1.5, windup: 0.6, recover: 0.55, cooldown: [1.0, 1.8],
        damage: [10, 14], parryable: true },
      teppo: { name: '鐵砲足輕', kind: 'gun', hp: 30, speed: 1.5, width: 0.3, scale: 0.92,
        range: 10, keepMin: 3.5, keepMax: 7, aim: 1.1, reload: 4.5, cooldown: [0.6, 1.4],
        damage: [18, 26] },
      tate: { name: '門板兵', kind: 'melee', hp: 40, shield: 70, speed: 1.05, width: 0.44, scale: 1.0,
        reach: 1.3, keep: 1.0, windup: 0.55, recover: 0.7, cooldown: [1.4, 2.2],
        damage: [7, 10], knock: 0.7, parryable: true, becomes: 'tateless' },
      tateless: { name: '失盾足輕', kind: 'melee', hp: 35, speed: 1.6, width: 0.32, scale: 0.92,
        reach: 1.25, keep: 0.9, windup: 0.45, recover: 0.5, cooldown: [0.9, 1.5],
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

    ougi: { max: 100, sweetGain: 8, parryGain: 18, issenGain: 12, range: 9 },

    map: { rooms: 4, roomSize: 5, shojiChance: 0.2, paperDoorChance: 0.45, extraDoorChance: 0.25, braziers: 4, whetstones: 7, onigiri: 4 },
  };

  G.blade = (id) => G.CONFIG.blades.find((b) => b.id === id);
})();
