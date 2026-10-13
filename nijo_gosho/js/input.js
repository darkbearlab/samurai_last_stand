/* 輸入：鍵盤、滑鼠（指標鎖定）、觸控 */
(function () {
  'use strict';
  const G = window.G;
  const IN = (G.IN = { keys: new Set(), atkHeld: false, atkPressed: false, parryPressed: false, ougiPressed: false,
    swapNext: 0, select: -1, mouseDX: 0, touchDX: 0, joy: { x: 0, y: 0 } });
  G.isTouch = matchMedia('(pointer: coarse)').matches;

  G.clearInputEdges = function () { IN.atkPressed = false; IN.parryPressed = false; IN.ougiPressed = false; IN.swapNext = 0; IN.select = -1; };
  function atkDown() { if (!IN.atkHeld) IN.atkPressed = true; IN.atkHeld = true; }
  function atkUp() { IN.atkHeld = false; }

  G.initInput = function () {
    const cv = G.$('cv');
    addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(k)) e.preventDefault();
      if (e.repeat) return;
      IN.keys.add(k);
      if (!G.S) return;
      if (k === ' ' || k === 'j') atkDown();
      if (k === 'k') IN.parryPressed = true;
      if (k === 'r') IN.ougiPressed = true;
      if (k >= '1' && k <= '5') IN.select = +k - 1;
      if (k === 'q') IN.swapNext = 1;
      if (k === 'm' || k === 'tab') G.S.showMap = !G.S.showMap;
      if (k === 'p' || k === 'escape') G.togglePause();
    });
    addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); IN.keys.delete(k); if (k === ' ' || k === 'j') atkUp(); });
    addEventListener('blur', () => { IN.keys.clear(); atkUp(); });

    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    G.$('ui').addEventListener('contextmenu', (e) => e.preventDefault());
    G.$('view').addEventListener('mousedown', (e) => {
      if (G.isTouch || !G.S || G.S.state !== 'play' || G.S.paused || G.screenShown) return;
      if (document.pointerLockElement !== cv) { lock(); return; }
      if (e.button === 0) atkDown();
      if (e.button === 2) IN.parryPressed = true;
    });
    addEventListener('mouseup', (e) => { if (!G.isTouch && e.button === 0) atkUp(); });
    addEventListener('mousemove', (e) => { if (document.pointerLockElement === cv) IN.mouseDX += e.movementX; });
    addEventListener('wheel', (e) => { if (document.pointerLockElement === cv) IN.swapNext = e.deltaY > 0 ? 1 : -1; }, { passive: true });
    let wasLocked = false;
    document.addEventListener('pointerlockchange', () => {
      const l = document.pointerLockElement === cv;
      if (wasLocked && !l && G.S && G.S.state === 'play' && !G.S.paused && !G.screenShown) G.togglePause();
      wasLocked = l;
    });
    G.lockPointer = lock;
    function lock() { try { const p = cv.requestPointerLock && cv.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* 不支援時改用鍵盤轉向 */ } }

    if (!G.isTouch) return;
    const touchEl = G.$('touch'), knob = G.$('knob');
    touchEl.hidden = false;
    let stickId = null, stickO = null, lookId = null, lookX = 0;
    touchEl.addEventListener('touchstart', (e) => {
      if (e.target.closest('.tbtn')) return; e.preventDefault();
      const r = touchEl.getBoundingClientRect();
      for (const t of e.changedTouches) {
        if (t.clientX < r.left + r.width * 0.45 && stickId === null) {
          stickId = t.identifier; stickO = { x: t.clientX, y: t.clientY }; knob.hidden = false;
          knob.style.left = t.clientX - r.left + 'px'; knob.style.top = t.clientY - r.top + 'px';
        } else if (lookId === null) { lookId = t.identifier; lookX = t.clientX; }
      }
    }, { passive: false });
    touchEl.addEventListener('touchmove', (e) => {
      e.preventDefault(); const r = touchEl.getBoundingClientRect();
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          const dx = t.clientX - stickO.x, dy = t.clientY - stickO.y, m = Math.hypot(dx, dy), c = Math.min(m, 50) / (m || 1);
          IN.joy.x = (dx * c) / 50; IN.joy.y = (dy * c) / 50;
          knob.style.left = stickO.x - r.left + dx * c + 'px'; knob.style.top = stickO.y - r.top + dy * c + 'px';
        } else if (t.identifier === lookId) { IN.touchDX += t.clientX - lookX; lookX = t.clientX; }
      }
    }, { passive: false });
    const end = (e) => { for (const t of e.changedTouches) { if (t.identifier === stickId) { stickId = null; IN.joy.x = IN.joy.y = 0; knob.hidden = true; } if (t.identifier === lookId) lookId = null; } };
    touchEl.addEventListener('touchend', end); touchEl.addEventListener('touchcancel', end);
    const hold = (id, down, up) => {
      const el = G.$(id);
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.classList.add('on'); down(); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => el.addEventListener(ev, () => { if (!el.classList.contains('on')) return; el.classList.remove('on'); if (up) up(); }));
    };
    hold('tAtk', atkDown, atkUp);
    hold('tParry', () => (IN.parryPressed = true));
    hold('tSwap', () => (IN.swapNext = 1));
    hold('tOugi', () => (IN.ougiPressed = true));
  };
})();
