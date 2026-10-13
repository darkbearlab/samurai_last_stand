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
})();
