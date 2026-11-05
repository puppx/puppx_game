'use strict';
/* Synthesised chiptune sound effects + music. No audio files, so it all works offline. */
const Sfx = (() => {
  let ac = null, master, sfxG, musG, noiseBuf, timer = null;
  let sfxOn = true, musOn = true;
  const last = {};

  function init() {
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
      master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
      sfxG = ac.createGain(); sfxG.gain.value = sfxOn ? 1 : 0; sfxG.connect(master);
      musG = ac.createGain(); musG.gain.value = musOn ? 0.45 : 0; musG.connect(master);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      nextT = ac.currentTime + 0.1;
      timer = setInterval(sched, 25);
    }
    if (ac.state === 'suspended') ac.resume();
  }

  function env(g, t, vol, a, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(f, d, type = 'square', vol = 0.15, f2 = null, delay = 0, dest = sfxG, at = null) {
    if (!ac) return;
    const t = at != null ? at : ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    env(g, t, vol, 0.004, d);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + d + 0.05);
  }
  function noise(d, vol = 0.2, freq = 2000, delay = 0, type = 'lowpass', f2 = null, dest = sfxG, at = null) {
    if (!ac) return;
    const t = at != null ? at : ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    s.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = ac.createBiquadFilter(); f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + d);
    const g = ac.createGain();
    env(g, t, vol, 0.003, d);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05);
  }
  function ok(name, ms) {
    const n = performance.now();
    if (last[name] && n - last[name] < ms) return false;
    last[name] = n; return true;
  }

  /* ---------- Music sequencer ---------- */
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const SONGS = {
    menu: {
      bpm: 96, drums: false,
      prog: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
      lead: [
        [76, 0, 0, 0, 74, 0, 0, 0, 72, 0, 0, 0, 74, 0, 0, 0],
        [72, 0, 0, 0, 69, 0, 0, 0, 72, 0, 0, 0, 0, 0, 0, 0],
        [67, 0, 0, 0, 72, 0, 0, 0, 76, 0, 0, 0, 79, 0, 0, 0],
        [74, 0, 0, 0, 71, 0, 0, 0, 74, 0, 0, 0, 0, 0, 0, 0],
      ],
    },
    main: {
      bpm: 132, drums: true,
      prog: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
      lead: [
        [76, 0, 0, 74, 72, 0, 69, 0, 72, 0, 74, 0, 76, 0, 0, 0],
        [77, 0, 0, 76, 74, 0, 72, 0, 69, 0, 72, 0, 74, 0, 0, 0],
        [72, 0, 0, 74, 76, 0, 79, 0, 76, 0, 74, 0, 72, 0, 0, 0],
        [74, 0, 71, 0, 67, 0, 71, 0, 74, 0, 79, 0, 74, 0, 71, 0],
      ],
    },
    boss: {
      bpm: 152, drums: true,
      prog: [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]],
      lead: [
        [74, 0, 74, 0, 77, 0, 74, 0, 81, 0, 79, 0, 77, 0, 76, 0],
        [74, 0, 74, 0, 77, 0, 74, 0, 82, 0, 81, 0, 79, 0, 77, 0],
        [79, 0, 79, 0, 82, 0, 79, 0, 86, 0, 84, 0, 82, 0, 81, 0],
        [81, 0, 0, 0, 76, 0, 0, 0, 73, 0, 76, 0, 81, 0, 85, 0],
      ],
    },
  };
  let song = 'menu', step = 0, nextT = 0, key = 0, bpmAdd = 0;
  function sched() {
    if (!ac || ac.state !== 'running') return;
    const sp = SONGS[song];
    const dur = 60 / (sp.bpm + (song === 'menu' ? 0 : bpmAdd)) / 4;
    if (nextT < ac.currentTime - 0.2) nextT = ac.currentTime + 0.05;
    while (nextT < ac.currentTime + 0.12) {
      if (musOn) playStep(sp, step, nextT, dur);
      nextT += dur;
      step = (step + 1) % 128;
    }
  }
  function playStep(sp, s, t, dur) {
    const bar = Math.floor(s / 16) % 4, i = s % 16, tr = song === 'menu' ? 0 : key, chord = sp.prog[bar].map(n => n + tr);
    const second = s >= 64;
    if (i % 2 === 0) tone(mtof(chord[0] - 24 + (i % 8 === 6 ? 12 : 0)), dur * 1.6, 'triangle', 0.32, null, 0, musG, t);
    if (sp.drums || i % 2 === 0) tone(mtof(chord[i % 3] + 12 + (i >= 8 ? 12 : 0)), dur * 0.7, 'square', 0.035, null, 0, musG, t);
    const ln = sp.lead[bar][i] ? sp.lead[bar][i] + tr : 0;
    if (ln && (second || !sp.drums)) tone(mtof(ln), dur * 1.8, 'square', 0.055, null, 0, musG, t);
    if (sp.drums) {
      if (i % 8 === 0) tone(150, 0.12, 'sine', 0.55, 40, 0, musG, t);
      if (i % 8 === 4) noise(0.1, 0.18, 1200, 0, 'highpass', null, musG, t);
      if (i % 2 === 1) noise(0.03, 0.06, 7000, 0, 'highpass', null, musG, t);
    }
  }

  return {
    init,
    get ready() { return !!ac; },
    setSfx(on) { sfxOn = on; if (sfxG) sfxG.gain.value = on ? 1 : 0; },
    setMusic(on) { musOn = on; if (musG) musG.gain.value = on ? 0.45 : 0; },
    song(name) { if (song !== name) { song = name; step = 0; } },
    setKey(k, b) { key = k; bpmAdd = b; },
    suspend() { if (ac && ac.state === 'running') ac.suspend(); },
    resume() { if (ac && ac.state === 'suspended') ac.resume(); },
    shoot() { if (ok('shoot', 75)) tone(820 + Math.random() * 160, 0.05, 'square', 0.035, 420); },
    hit() { if (ok('hit', 45)) tone(320, 0.05, 'square', 0.05, 140); },
    kill() { if (ok('kill', 40)) { noise(0.12, 0.13, 3000, 0, 'lowpass', 300); tone(240, 0.08, 'square', 0.05, 80); } },
    gem(p) { if (ok('gem', 28)) tone(880 + p * 45, 0.06, 'triangle', 0.09, 1300 + p * 45); },
    coin() { if (ok('coin', 60)) { tone(1320, 0.05, 'square', 0.05); tone(1760, 0.12, 'square', 0.05, null, 0.05); } },
    hurt() { tone(240, 0.28, 'sawtooth', 0.16, 60); noise(0.2, 0.22, 1200); },
    dash() { noise(0.18, 0.16, 500, 0, 'bandpass', 3500); },
    levelup() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.13, 'square', 0.07, null, i * 0.06)); },
    select() { tone(660, 0.05, 'square', 0.07); tone(990, 0.09, 'square', 0.07, null, 0.04); },
    boom() { if (ok('boom', 60)) { noise(0.5, 0.35, 1600, 0, 'lowpass', 70); tone(130, 0.35, 'sine', 0.3, 30); } },
    zap() { if (ok('zap', 70)) { noise(0.15, 0.14, 4000, 0, 'highpass'); tone(1500, 0.1, 'sawtooth', 0.04, 200); } },
    nova() { tone(500, 0.2, 'triangle', 0.08, 1500); },
    chest() { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.16, 'triangle', 0.1, null, i * 0.07)); },
    fever() { [440, 554, 659, 880, 1109, 1319].forEach((f, i) => tone(f, 0.1, 'square', 0.07, null, i * 0.045)); },
    boss() { tone(80, 1.4, 'sawtooth', 0.22, 40); tone(82, 1.4, 'square', 0.1, 41); },
    fuse() { if (ok('fuse', 200)) tone(1200, 0.3, 'square', 0.03, 2400); },
    jump() { tone(200, 0.35, 'square', 0.08, 600); },
    eshoot() { if (ok('es', 100)) tone(520, 0.07, 'triangle', 0.05, 260); },
    wave() { tone(392, 0.1, 'square', 0.07); tone(523, 0.18, 'square', 0.07, null, 0.1); },
    die() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.22, 'square', 0.09, null, i * 0.16)); },
    buy() { tone(988, 0.06, 'square', 0.07); tone(1319, 0.06, 'square', 0.07, null, 0.06); tone(1976, 0.14, 'square', 0.06, null, 0.12); },
    laser() { if (ok('laser', 80)) { tone(1800, 0.3, 'sawtooth', 0.06, 300); noise(0.25, 0.1, 6000, 0, 'highpass'); } },
    missile() { if (ok('missile', 90)) noise(0.25, 0.08, 800, 0, 'bandpass', 3000); },
    pop() { if (ok('pop', 50)) { noise(0.18, 0.18, 2000, 0, 'lowpass', 120); tone(160, 0.12, 'sine', 0.15, 50); } },
    announce(t) { const base = [523, 587, 659, 784][Math.min(3, t)]; [0, 4, 7, 12, 16].forEach((n, i) => tone(base * Math.pow(2, n / 12), 0.12, 'square', 0.08, null, i * 0.05)); },
    freeze() { [2093, 1760, 1568, 1319, 1175].forEach((f, i) => tone(f, 0.25, 'triangle', 0.06, null, i * 0.04)); noise(0.5, 0.08, 8000, 0, 'highpass'); },
    shield() { tone(400, 0.3, 'sine', 0.12, 1200); tone(600, 0.3, 'triangle', 0.06, 1800, 0.05); },
    shieldBreak() { noise(0.3, 0.2, 5000, 0, 'highpass'); [1568, 1175, 784].forEach((f, i) => tone(f, 0.12, 'square', 0.06, null, i * 0.05)); },
    evolve() { [262, 330, 392, 523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.18, 'square', 0.07, null, i * 0.06)); tone(65, 1, 'sawtooth', 0.15, 130); },
    blast() { tone(200, 0.3, 'sine', 0.2, 800); noise(0.3, 0.1, 3000, 0, 'bandpass', 600); },
    thief() { [1568, 1319, 1568, 1319, 1976].forEach((f, i) => tone(f, 0.08, 'square', 0.05, null, i * 0.07)); },
    charge() { if (ok('charge', 150)) tone(150, 0.4, 'sawtooth', 0.06, 450); },
    heartbeat() { tone(70, 0.12, 'sine', 0.35, 40); tone(65, 0.12, 'sine', 0.3, 40, 0.18); },
    mission() { [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.15, 'triangle', 0.09, null, i * 0.09)); },
    ult() { [262, 392, 523, 784, 1047].forEach((f, i) => tone(f, 0.2, 'sawtooth', 0.07, null, i * 0.04)); noise(0.6, 0.25, 2000, 0, 'lowpass', 100); tone(55, 0.8, 'square', 0.12, 110); },
    ready() { [784, 1047, 1319].forEach((f, i) => tone(f, 0.12, 'triangle', 0.09, null, i * 0.07)); },
    slash() { if (ok('slash', 40)) { noise(0.12, 0.2, 6000, 0, 'highpass'); tone(1400, 0.08, 'sawtooth', 0.05, 400); } },
    gulp() { tone(300, 0.25, 'sine', 0.3, 60); tone(90, 0.3, 'square', 0.12, 45, 0.1); },
    crate() { if (ok('crate', 60)) { noise(0.15, 0.2, 900, 0, 'lowpass', 200); tone(180, 0.08, 'square', 0.08, 90); } },
    curse() { [220, 207, 196, 185].forEach((f, i) => tone(f, 0.35, 'sawtooth', 0.08, null, i * 0.12)); noise(0.8, 0.12, 400, 0, 'lowpass', 80); },
    jackpot() { [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.1, 'square', 0.08, null, i * 0.06)); },
    tick() { if (ok('tick', 50)) tone(1800, 0.02, 'square', 0.03); },
    nope() { tone(180, 0.15, 'square', 0.07, 120); },
  };
})();
