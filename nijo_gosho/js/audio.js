/* 合成音效（Web Audio）。之後換成真實音檔時，只要改 G.sfx。 */
(function () {
  'use strict';
  const G = window.G;
  let AC = null, NOISE = null, MASTER = null;

  G.initAudio = function () {
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      MASTER = AC.createGain(); MASTER.gain.value = 0.6; MASTER.connect(AC.destination);
      const n = AC.sampleRate; NOISE = AC.createBuffer(1, n, n);
      const d = NOISE.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { AC = null; }
  };

  function nz(dur, freq, vol, type, freqEnd, delay) {
    const t = AC.currentTime + (delay || 0), s = AC.createBufferSource(); s.buffer = NOISE;
    const f = AC.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(MASTER); s.start(t); s.stop(t + dur);
  }
  function tn(type, f0, f1, dur, vol, delay) {
    const t = AC.currentTime + (delay || 0), o = AC.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(MASTER); o.start(t); o.stop(t + dur);
  }

  const SFX = {
    swing_light(v) { nz(0.12, 3400, 0.2 * v, 'bandpass', 1400); },
    swing_sweet(v) { nz(0.16, 2800, 0.28 * v, 'bandpass', 900); },
    swing_heavy(v) { nz(0.28, 1700, 0.38 * v, 'bandpass', 450); },
    hit(v) { nz(0.12, 750, 0.45 * v); tn('sine', 150, 60, 0.12, 0.25 * v); },
    clang(v) { tn('square', 1900, 1750, 0.18, 0.06 * v); tn('triangle', 2850, 2800, 0.25, 0.08 * v); nz(0.06, 6000, 0.2 * v, 'highpass'); },
    parry(v) { tn('triangle', 2400, 2380, 0.5, 0.14 * v); tn('sine', 3600, 3580, 0.4, 0.08 * v); nz(0.05, 7000, 0.25 * v, 'highpass'); },
    issen(v) { tn('sine', 900, 2600, 0.35, 0.16 * v); nz(0.25, 5000, 0.3 * v, 'bandpass', 9000); },
    ougi(v) { tn('sawtooth', 90, 40, 1.2, 0.22 * v); nz(1.0, 3000, 0.5 * v, 'bandpass', 300); tn('sine', 1200, 2400, 0.8, 0.12 * v); },
    gun(v) { nz(0.7, 900, 0.9 * v); tn('sine', 90, 40, 0.3, 0.4 * v); },
    aim(v) { tn('square', 1500, 1500, 0.03, 0.05 * v); },
    windup(v) { tn('sawtooth', 220, 380, 0.25, 0.06 * v); },
    shove(v) { nz(0.2, 400, 0.4 * v); },
    whiff(v) { nz(0.12, 1800, 0.12 * v, 'bandpass', 700); },
    shoji(v) { nz(0.3, 2500, 0.35 * v, 'bandpass', 4500); },
    wood(v) { nz(0.15, 900, 0.35 * v); },
    shieldbreak(v) { nz(0.45, 500, 0.6 * v); tn('square', 140, 50, 0.3, 0.12 * v); },
    hurt(v) { tn('sawtooth', 300, 90, 0.25, 0.2 * v); },
    die(v) { nz(0.35, 600, 0.3 * v); tn('sawtooth', 200, 60, 0.35, 0.08 * v); },
    pickup(v) { tn('triangle', 660, 990, 0.12, 0.12 * v); },
    blade(v) { [523, 659, 784, 1046].forEach((f, i) => tn('triangle', f, f, 0.35, 0.1 * v, i * 0.08)); },
    door(v) { nz(0.35, 500, 0.1 * v, 'bandpass', 300); },
    tired(v) { tn('sine', 300, 200, 0.15, 0.08 * v); },
    tome(v) { tn('sine', 520, 260, 0.25, 0.14 * v); },
    dull(v) { tn('square', 300, 150, 0.2, 0.06 * v); },
  };

  G.sfx = function (name, dist) {
    if (!AC || !SFX[name]) return;
    const v = G.clamp(1 - (dist || 0) / 18, 0, 1);
    if (v <= 0) return;
    try { SFX[name](v); } catch (e) { /* 音效失敗不影響遊戲 */ }
  };
})();
