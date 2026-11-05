'use strict';
/* =========================================================
   Extra content: ultimates, map props, shrines, pets, hats,
   game modes / daily challenge, achievements, bestiary, settings.
   Loaded after game.js; game.js calls into these hooks.
   ========================================================= */

/* ---------- Save data defaults ---------- */
save.settings = Object.assign({ shake: true, vib: true, fx: 'high', btn: 1, nums: true }, save.settings || {});
save.stats = Object.assign({ kills: 0, kinds: {}, runs: 0, time: 0, bosses: 0, coins: 0, chests: 0, evos: 0, thieves: 0, jackpots: 0, curses: 0, bestCombo: 0, bestMulti: 0, dailies: 0, ults: 0, nightWave: 0 }, save.stats || {});
save.ach = save.ach || {};
save.seen = save.seen || {};
save.hats = save.hats || {}; save.hat = save.hat || '';
save.pets = save.pets || {}; save.pet = save.pet || '';
save.daily = save.daily || { date: '', best: 0 };
const MENU_SCENES = ['menu', 'shop', 'missions', 'modes', 'settings', 'records', 'style'];
let lastMode = 'normal';

/* ---------- Game modes & daily challenge ---------- */
const MODES = {
  normal: { name: 'NORMAL', col: '#ff8c2e', lines: ['THE CLASSIC RUN'] },
  daily: { name: 'DAILY', col: '#5ef0ff', lines: [] },
  rush: { name: 'BOSS RUSH', col: '#ff4d6d', lines: ['BOSS AFTER BOSS', 'COINS X1.5'] },
  night: { name: 'NIGHTMARE', col: '#9b5de5', lines: ['FOES MUCH TOUGHER', 'COINS X2'], unlock: 15 },
};
const DAILY_RULES = [
  { id: 'fast', name: 'TURBO FOES', desc: 'FOES +40% SPEED, XP X1.5', spd: 1.4, xp: 1.5 },
  { id: 'glass', name: 'GLASS CANNON', desc: '1 HEART, DOUBLE DAMAGE', glass: true, dmg: 2 },
  { id: 'bossy', name: 'BOSS PARTY', desc: 'A BOSS EVERY 3 WAVES', bossEvery: 3 },
  { id: 'horde', name: 'HORDE', desc: '+60% FOES, XP X1.3', spawn: 1.6, xp: 1.3 },
  { id: 'rich', name: 'GOLD FEVER', desc: 'COINS X3, NO HEARTS DROP', coin: 3, noheal: true },
  { id: 'elite', name: 'ELITE SQUAD', desc: 'ELITES EVERYWHERE', elite: 6 },
  { id: 'arsenal', name: 'ARSENAL', desc: 'START WITH 3 WEAPONS', arsenal: true },
  { id: 'nodash', name: 'NO DASH', desc: 'NO DASH, +25% SPEED', nodash: true, pspd: 1.25 },
  { id: 'dark', name: 'LIGHTS OUT', desc: 'EVERY ZONE IS DARK', dark: 0.8 },
  { id: 'chaos', name: 'CHAOS', desc: 'A TWIST EVERY WAVE', chaos: true },
  { id: 'tank', name: 'GIANT SLAYER', desc: 'FOES X2 HP, YOU DEAL X1.6', hp: 2, dmg: 1.6 },
  { id: 'ultra', name: 'ULTRA', desc: 'ULTIMATE CHARGES X3', ult: 3 },
];
function todayKey() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function dailyRules() {
  let h = 7;
  for (const ch of todayKey()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const n = DAILY_RULES.length, a = h % n;
  let b = Math.floor(h / n) % (n - 1); if (b >= a) b++;
  return [DAILY_RULES[a], DAILY_RULES[b]];
}
function buildRules(mode) {
  const R = { hp: 1, spd: 1, spawn: 1, xp: 1, coin: 1, elite: 1, dmg: 1, pspd: 1, ult: 1, bossEvery: 5, dark: null, nodash: false, noheal: false, glass: false, chaos: false, arsenal: false, list: [] };
  const add = r => {
    for (const k in r) {
      if (!(k in R) || k === 'list') continue;
      if (typeof R[k] === 'number' && k !== 'bossEvery') R[k] *= r[k]; else R[k] = r[k];
    }
    if (r.name) R.list.push(r);
  };
  if (mode === 'night') add({ hp: 1.7, spd: 1.15, spawn: 1.3, elite: 2, coin: 2, xp: 1.2 });
  if (mode === 'rush') add({ coin: 1.5 });
  if (mode === 'daily') { add({ coin: 1.5 }); for (const r of dailyRules()) add(r); }
  return R;
}
const RULES_NONE = buildRules('normal');
function isBossWave(w) { return G.mode === 'rush' || w % G.R.bossEvery === 0; }

/* Called by newRun() once G/P/st exist. */
function setupRun(mode) {
  G.mode = mode; G.R = buildRules(mode);
  G.props = []; G.shrines = []; G.ultQ = []; G.slashes = []; G.clones = []; G.ult = 0; G.tongue = 0;
  G.hits = 0; G.cleanWave = 0; G.evoCount = 0; G.curse = false; G.buff = null; G.action = null; G.achT = 0; G.atoast = [];
  G.ultBanner = null; G.ultReady = false; G.propT = 25;
  st.dmgMul *= G.R.dmg;
  if (G.R.glass) { st.maxHp = 1; P.hp = 1; }
  if (G.R.arsenal) { const ws = ['orbit', 'zap', 'aura', 'boom', 'nova', 'laser', 'missile'].filter(w => !st.w[w]); for (let i = 0; i < 3 && ws.length; i++) { const w = ws.splice(Math.floor(Math.random() * ws.length), 1)[0]; applyUpg(UPG_BY[w]); applyUpg(UPG_BY[w]); } }
  if (mode === 'rush') { G.waveT = G.waveLen - 2.5; G.wave = 0; G.pendingLv = 3; }
  G.pet = save.pet ? { id: save.pet, x: P.x - 10, y: P.y - 10, t: 0, cd: 1 } : null;
  placeProps(); placeShrines();
  if (mode !== 'normal') {
    const m = MODES[mode];
    banner(m.name, mode === 'daily' ? G.R.list.map(r => r.name).join(' + ') : m.lines[0], mode === 'rush' ? 'GOOD LUCK!' : 'WAVE 1', m.col, 3);
  }
}
/* Called when a new zone starts. */
function newZone() { G.curse = false; placeProps(); placeShrines(); }

/* ---------- Ultimates ---------- */
const ULTS = {
  pup: { name: 'MEGA BARK', col: '#ffd23f' },
  cat: { name: 'TIME SLASH', col: '#ff9ad5' },
  frog: { name: 'GULP!', col: '#5ed15a' },
  bun: { name: 'BUNNY SQUAD', col: '#a8e6ff' },
};
function ultGain(v) {
  if (!G || G.ult >= 100) return;
  G.ult = Math.min(100, G.ult + v * G.R.ult);
}
function useUlt() {
  if (scene !== 'play' || !G || G.dying > 0 || G.ult < 100) { if (G && G.ult < 100 && scene === 'play') Sfx.nope(); return; }
  G.ult = 0; G.ultReady = false; save.stats.ults++;
  const id = save.sel, U = ULTS[id];
  G.ultBanner = { name: U.name, col: U.col, t: 1.5 };
  G.flash = 0.35; G.flashCol = U.col; addShake(6); vib([40, 30, 90]); Sfx.ult();
  P.inv = Math.max(P.inv, 1.5);
  G.rings.push({ x: P.x, y: P.y, r: 4, vr: 300, t: 0.4, max: 0.4, col: U.col });
  if (id === 'pup') G.ultQ.push({ t: 0, k: 'bark' }, { t: 0.3, k: 'bark' }, { t: 0.6, k: 'bark' });
  else if (id === 'cat') { G.freeze = Math.max(G.freeze, 3); P.inv = 3.4; for (let i = 0; i < 12; i++) G.ultQ.push({ t: 0.15 + i * 0.22, k: 'slash' }); G.ultQ.push({ t: 2.9, k: 'finale' }); }
  else if (id === 'frog') { G.tongue = 0.75; G.ultQ.push({ t: 0.75, k: 'gulp' }); }
  else G.clones = [0, 1, 2].map(i => ({ a: i * TAU / 3, t: 9, cd: i * 0.07, x: P.x, y: P.y }));
}
function onScreenEnemies(pad = 0) {
  const cx = G.cam.x, cy = G.cam.y;
  return G.enemies.filter(e => !e.dead && e.spawnT <= 0 && !isPhased(e) && Math.abs(e.x - cx) < GW / 2 + pad && Math.abs(e.y - cy) < GH / 2 + pad);
}
function runUlt(k) {
  const D = st.dmg * st.dmgMul;
  if (k === 'bark') {
    G.rings.push({ x: P.x, y: P.y, r: 6, vr: 520, t: 0.3, max: 0.3, col: '#ffd23f' }, { x: P.x, y: P.y, r: 3, vr: 420, t: 0.3, max: 0.3, col: '#fff' });
    for (const e of G.enemies) {
      if (e.dead) continue;
      const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy) || 1;
      if (d < 150) hitEnemy(e, D * 6, dx / d * 320, dy / d * 320);
    }
    G.ebullets = G.ebullets.filter(b => Math.hypot(b.x - P.x, b.y - P.y) > 150);
    burst(P.x, P.y, ['#ffd23f', '#fff7b0', '#fff'], 24, 160, 0.6);
    addShake(7); Sfx.boom();
  } else if (k === 'slash') {
    const list = onScreenEnemies(); if (!list.length) return;
    const e = pick(list);
    G.slashes.push({ x: e.x, y: e.y, a: rnd(TAU), t: 0.3 });
    burst(e.x, e.y, ['#ff9ad5', '#fff'], 8, 90, 0.4);
    e.flash = 0.2; e.hp -= D * 7; floater(e.x, e.y - 8, Math.round(D * 7) + '!', '#ff9ad5', false, true);
    if (e.hp <= 0) { const f = G.freeze; G.freeze = 0; killEnemy(e); G.freeze = f; }
    Sfx.slash();
  } else if (k === 'finale') {
    G.flash = 0.3; G.flashCol = '#ff9ad5'; addShake(6);
    for (const e of onScreenEnemies(10)) { G.slashes.push({ x: e.x, y: e.y, a: rnd(TAU), t: 0.35 }); hitEnemy(e, D * 5, 0, 0, true); }
    Sfx.slash(); Sfx.boom();
  } else if (k === 'gulp') {
    for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - P.x, e.y - P.y) < 75) hitEnemy(e, D * 12, 0, 0, true);
    if (P.hp < st.maxHp) { P.hp++; floater(P.x, P.y - 14, '+1 HP', '#5ed15a'); }
    G.rings.push({ x: P.x, y: P.y, r: 4, vr: 300, t: 0.3, max: 0.3, col: '#5ed15a', fill: true, maxR: 40 });
    burst(P.x, P.y, ['#5ed15a', '#b8f28a', '#fff'], 30, 140, 0.6);
    addShake(6); Sfx.gulp();
  }
}
function updateUlt(dt) {
  ultGain(dt * (G.boss ? 1.2 : 0.5));
  if (G.ult >= 100 && !G.ultReady) { G.ultReady = true; floater(P.x, P.y - 20, 'ULTIMATE READY!', ULTS[save.sel].col, true); Sfx.ready(); }
  for (const q of G.ultQ) { q.t -= dt; if (q.t <= 0) { q.done = true; runUlt(q.k); } }
  G.ultQ = G.ultQ.filter(q => !q.done);
  for (const s of G.slashes) s.t -= dt;
  G.slashes = G.slashes.filter(s => s.t > 0);
  if (G.tongue > 0) {
    G.tongue -= dt;
    for (const e of onScreenEnemies(20)) {
      if (e.boss) continue;
      const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
      if (d > 14) { e.x += dx / d * 280 * dt; e.y += dy / d * 280 * dt; }
    }
  }
  const D = st.dmg * st.dmgMul;
  for (const c of G.clones) {
    c.t -= dt; c.a += dt * 2.5;
    c.x = P.x + Math.cos(c.a) * 26; c.y = P.y + Math.sin(c.a) * 18;
    c.cd -= dt;
    if (c.cd <= 0) {
      const tgt = nearestEnemy(c.x, c.y, 170);
      if (tgt) {
        c.cd = 0.18;
        const a = Math.atan2(tgt.y - c.y, tgt.x - c.x);
        G.bullets.push({ x: c.x, y: c.y, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, r: 2, dmg: D * 0.8, crit: false, pierce: 1, life: 0.8, hits: [], col: '#a8e6ff' });
      } else c.cd = 0.1;
    }
    if (c.t <= 0) burst(c.x, c.y, ['#a8e6ff', '#fff'], 10, 60);
  }
  G.clones = G.clones.filter(c => c.t > 0);
  if (G.ultBanner) { G.ultBanner.t -= dt; if (G.ultBanner.t <= 0) G.ultBanner = null; }
}

/* ---------- Map props: barrels, crates, spikes, lava ---------- */
const PROP_SPR = {
  barrel: makeSprite(['.kkkkkk.', 'krrrrrrk', 'kRRRRRRk', 'kryyyyrk', 'krrrrrrk', 'kRRRRRRk', 'krrrrrrk', '.kkkkkk.']),
  crate: makeSprite(['kkkkkkkk', 'kBbbbbBk', 'kbBbbBbk', 'kbbBBbbk', 'kbbBBbbk', 'kbBbbBbk', 'kBbbbbBk', 'kkkkkkkk']),
  crateIce: makeSprite(['kkkkkkkk', 'kcwcccck', 'kwcccccK', 'kcccccck', 'kcccccck', 'kccccccK', 'kcccccuk', 'kkkkkkkk'].map(r => r.replace(/K/g, 'k')), { c: '#a8e6ff', u: '#6d9cc7' }),
};
function freeSpot(minD, pad = 18) {
  for (let k = 0; k < 40; k++) {
    const x = rnd(WALL + 24, ARENA - WALL - 24), y = rnd(WALL + 24, ARENA - WALL - 24);
    if (Math.hypot(x - P.x, y - P.y) < minD) continue;
    if (G.rocks.some(r => Math.hypot(r.x - x, r.y - y) < pad + 4)) continue;
    if (G.props.some(p => Math.hypot(p.x - x, p.y - y) < pad + (p.r || 0))) continue;
    if (G.shrines.some(s => Math.hypot(s.x - x, s.y - y) < 40)) continue;
    return { x, y };
  }
  return null;
}
function addProp(kind, minD = 60) {
  const s = freeSpot(minD, kind === 'lava' ? 30 : 18); if (!s) return;
  const p = { prop: true, kind, x: s.x, y: s.y, t: rnd(3), flash: 0, tick: 0 };
  if (kind === 'barrel') Object.assign(p, { r: 5, hp: 15, solid: true });
  else if (kind === 'crate') Object.assign(p, { r: 5, hp: 12, solid: true });
  else if (kind === 'spike') p.r = 9;
  else if (kind === 'lava') p.r = rint(11, 17);
  G.props.push(p);
}
function placeProps() {
  G.props = [];
  const b = BIOMES[G.biome];
  for (let i = 0; i < 11; i++) addProp('barrel');
  for (let i = 0; i < 9; i++) addProp('crate');
  for (let i = 0; i < (b.style === 'grass' ? 4 : 8); i++) addProp('spike', 80);
  if (b.style === 'lava') for (let i = 0; i < 7; i++) addProp('lava', 90);
}
function damageProp(p, dmg) {
  if (p.dead || !p.solid) return;
  p.hp -= dmg; p.flash = 0.08;
  if (p.hp > 0) return;
  p.dead = true;
  if (p.kind === 'barrel') {
    explode(p.x, p.y, 36, st.dmg * st.dmgMul * 5 + 30 * G.hpMul, false);
    floater(p.x, p.y - 10, 'BOOM!', '#ffb13b', true);
  } else {
    const ice = BIOMES[G.biome].style === 'ice';
    burst(p.x, p.y, ice ? ['#a8e6ff', '#fff'] : ['#d08a4e', '#8a4a24', '#5a3a2a'], 14, 80);
    for (let i = 0; i < 6; i++) G.parts.push({ x: p.x, y: p.y + 3, z: 4, vx: rnd(-50, 50), vy: rnd(-30, 30), vz: rnd(40, 110), t: rnd(0.5, 0.9), col: ice ? '#a8e6ff' : '#8a4a24', sz: 2, stamp: true });
    const r = Math.random();
    if (r < 0.45) for (let i = 0; i < rint(2, 4); i++) dropPickup('coin', p.x, p.y, { v: 1 });
    else if (r < 0.75) dropGem(p.x, p.y, 3 + G.wave);
    else dropPickup(pick(['heart', 'magnet', 'bomb', 'freeze', 'shield'].filter(k => k !== 'heart' || !G.R.noheal)), p.x, p.y);
    Sfx.crate();
  }
}
function propsArea(x, y, r, dmg) {
  for (const p of G.props) if (p.solid && !p.dead && Math.hypot(p.x - x, p.y - y) < r + p.r) damageProp(p, dmg);
}
function bulletProps(b) {
  for (const p of G.props) {
    if (!p.solid || p.dead) continue;
    if (Math.hypot(p.x - b.x, p.y - b.y) > p.r + b.r) continue;
    if (b.boom) { if ((p.boomCd || 0) > G.t) continue; p.boomCd = G.t + 0.3; damageProp(p, b.dmg); continue; }
    damageProp(p, b.dmg);
    if (b.pierce-- <= 0) { b.dead = true; burst(b.x, b.y, b.col, 3, 40, 0.25); return; }
  }
}
function updateProps(dt) {
  const D = st.dmg * st.dmgMul;
  for (const p of G.props) {
    p.t += dt; p.flash -= dt;
    if (p.kind === 'spike') {
      const ph = p.t % 2.6;
      p.up = ph > 1.8; p.warn = ph > 1.45 && !p.up;
      if (p.up) {
        p.tick -= dt;
        if (p.tick <= 0) {
          p.tick = 0.3;
          for (const e of G.enemies) if (!e.dead && !e.boss && Math.abs(e.x - p.x) < p.r && Math.abs(e.y - p.y) < p.r) hitEnemy(e, D * 1.5, 0, 0, false, true);
        }
        if (Math.abs(P.x - p.x) < p.r - 2 && Math.abs(P.y - p.y) < p.r - 2) hurtPlayer();
      }
    } else if (p.kind === 'lava') {
      p.tick -= dt;
      if (p.tick <= 0) { p.tick = 0.4; for (const e of G.enemies) if (!e.dead && !e.boss && Math.hypot(e.x - p.x, e.y - p.y) < p.r) hitEnemy(e, D * 0.7, 0, 0, false, true); }
      if (Math.hypot(P.x - p.x, P.y - p.y) < p.r - 3) hurtPlayer();
      if (Math.random() < dt * 3) G.parts.push({ x: p.x + rnd(-p.r, p.r) * 0.6, y: p.y + rnd(-p.r, p.r) * 0.4, vx: 0, vy: -14, t: 0.5, col: pick(['#ffb13b', '#ff6a2b']), sz: 1 });
    }
  }
  G.props = G.props.filter(p => !p.dead);
  G.propT -= dt;
  if (G.propT <= 0) { G.propT = 20; if (G.props.filter(p => p.kind === 'barrel').length < 7) { addProp('barrel', 120); addProp('crate', 120); } }
}
function drawFloorProps(c) {
  for (const p of G.props) {
    if (p.solid || !onScreen(p.x, p.y, c, 30)) continue;
    if (p.kind === 'lava') {
      disc(p.x, p.y, p.r + 1, '#2a1010');
      disc(p.x, p.y, p.r, '#e8442b');
      disc(p.x, p.y, p.r * 0.7, '#ff8c2e');
      for (let i = 0; i < 3; i++) { const a = p.t * 0.7 + i * 2.1; rect(p.x + Math.cos(a) * p.r * 0.4, p.y + Math.sin(a * 1.3) * p.r * 0.3, 2, 2, '#ffd23f'); }
      addLight(p.x, p.y, p.r * 2.4); addGlow(p.x, p.y, p.r * 1.2, '#ff6a2b');
    } else if (p.kind === 'spike') {
      rect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2, 'rgba(0,0,0,0.25)');
      for (let gy = -1; gy <= 1; gy++) for (let gx = -1; gx <= 1; gx++) {
        const x = p.x + gx * 6, y = p.y + gy * 6;
        if (p.up) { rect(x - 1, y - 3, 3, 4, '#c0c8ff'); rect(x, y - 4, 1, 2, '#ffffff'); rect(x - 1, y + 1, 3, 1, '#3b3a52'); }
        else rect(x - 1, y, 3, 1, p.warn && Math.floor(T * 14) % 2 ? '#ff4d6d' : '#3b3a52');
      }
      if (p.warn || p.up) addGlow(p.x, p.y, 10, p.up ? '#c0c8ff' : '#ff4d6d');
    }
  }
}
function drawProp(a) {
  if (a.kind === 'barrel' || a.kind === 'crate') {
    shadow(a.x, a.y + 3, 9);
    const s = a.kind === 'barrel' ? PROP_SPR.barrel : BIOMES[G.biome].style === 'ice' ? PROP_SPR.crateIce : PROP_SPR.crate;
    drawSpr(s, a.x, a.y - 1, false, a.flash > 0);
    if (a.kind === 'barrel') addGlow(a.x, a.y, 5, '#ff4d6d');
  } else if (a.kind === 'pet') drawPet();
  else if (a.kind === 'clone') {
    ctx.globalAlpha = 0.65;
    drawSpr(SPR[save.sel][Math.floor(T * 8) % 2], a.x, a.y - 1, P.face < 0, false);
    ctx.globalAlpha = 1; addGlow(a.x, a.y, 10, '#a8e6ff'); addLight(a.x, a.y, 20);
  } else drawShrine(a);
}

/* ---------- Shrines ---------- */
const SHRINE_SPR = {
  slot: makeSprite(['.kkkkkkkkk.', 'krrrrrrrrrk', 'krkkkkkkkrk', 'krkwkwkwkrk', 'krkwkwkwkrk', 'krkkkkkkkrk', 'krrrrrrrrrk', 'kryyyyyyyrk', 'krrrrrrrrrk', 'kRRRRRRRRRk', '.kkkkkkkkk.']),
  curse: makeSprite(['...kkk...', '..kgggk..', '.kgggggk.', '.kgrggrk.', '.kgggggk.', '..kgkgk..', '..kkkkk..', '.kVVVVVk.', '.kVvVvVk.', '.kVVVVVk.', 'kkkkkkkkk', 'kVVVVVVVk']),
  power: makeSprite(['....k....', '...kck...', '..kcwck..', '..kccck..', '.kcwccck.', '.kccccck.', '..kccck..', '...kck...', '....k....', '..kgggk..', '.kgggggk.', 'kGGGGGGGk', 'kkkkkkkkk']),
};
const SLOT_SYM = ['#ffd23f', '#ff4d6d', '#5ef0ff'];
function placeShrines() {
  G.shrines = [];
  for (const kind of ['slot', 'curse', 'power']) {
    const s = freeSpot(90, 30); if (!s) continue;
    G.shrines.push({ prop: true, shrine: true, kind, x: s.x, y: s.y, used: false, cost: 15 + G.wave * 2, charge: 0, spinT: 0, reels: [0, 1, 2], res: null, spawnT: 0 });
  }
}
function doAction() {
  const a = G && G.action; if (!a || scene !== 'play') return;
  const s = a.s;
  if (s.kind === 'slot') {
    if (s.spinT > 0) return;
    if (G.coins < s.cost) { Sfx.nope(); floater(s.x, s.y - 16, 'NEED ' + s.cost + ' COINS', '#ff7a7a'); return; }
    G.coins -= s.cost; s.cost = Math.round(s.cost * 1.5);
    const r = Math.random();
    s.res = r < 0.12 ? [2, 2, 2] : r < 0.24 ? [0, 0, 0] : r < 0.62 ? (() => { const v = rint(0, 2); const o = (v + rint(1, 2)) % 3; return pick([[v, v, o], [v, o, v], [o, v, v]]); })() : [0, 1, 2].sort(() => Math.random() - 0.5);
    s.spinT = 1.5; Sfx.select();
  } else if (s.kind === 'curse' && !s.used) {
    s.used = true; G.curse = true; save.stats.curses++;
    banner('CURSED!', 'FOES TOUGHER UNTIL THE NEXT ZONE', 'BUT DOUBLE XP AND GOLD', '#c79bff', 2.8);
    dropPickup('chest', s.x, s.y + 12, { big: false });
    G.flash = 0.3; G.flashCol = '#5b2a9a'; addShake(4); Sfx.curse();
    burst(s.x, s.y, ['#9b5de5', '#5b2a9a', '#000'], 30, 90);
  }
}
function slotResult(s) {
  const r = s.res;
  if (r[0] === r[1] && r[1] === r[2]) {
    if (r[0] === 2) {
      G.pendingLv += 2; G.coins += 30; save.stats.jackpots++;
      floater(s.x, s.y - 20, 'JACKPOT!!!', '#5ef0ff', true); Sfx.jackpot(); G.flash = 0.3; G.flashCol = '#5ef0ff';
      for (let i = 0; i < 15; i++) dropPickup('coin', s.x, s.y + 8, { v: 1 });
    } else { G.coins += 40; floater(s.x, s.y - 20, 'TRIPLE! +40', '#ffd23f', true); Sfx.chest(); for (let i = 0; i < 8; i++) dropPickup('coin', s.x, s.y + 8, { v: 1 }); }
    burst(s.x, s.y, ['#ffd23f', '#5ef0ff', '#fff'], 30, 120);
  } else if (r[0] === r[1] || r[1] === r[2] || r[0] === r[2]) {
    dropPickup(pick(['heart', 'magnet', 'bomb', 'freeze', 'shield'].filter(k => k !== 'heart' || !G.R.noheal)), s.x, s.y + 10);
    floater(s.x, s.y - 20, 'PAIR! PRIZE', '#5ed15a', true); Sfx.coin();
  } else { floater(s.x, s.y - 20, 'BUST!', '#9a96b0', true); Sfx.nope(); }
}
const BUFFS = [
  { k: 'dmg', name: 'DOUBLE DAMAGE', on() { st.dmgMul *= 2; }, off() { st.dmgMul /= 2; } },
  { k: 'speed', name: 'HYPER MODE', on() { st.speedMul += 0.5; st.rateMul += 0.6; }, off() { st.speedMul -= 0.5; st.rateMul -= 0.6; } },
  { k: 'magnet', name: 'MEGA MAGNET', on() { st.magMul += 6; }, off() { st.magMul -= 6; } },
  { k: 'guard', name: 'GUARDIAN', on() { P.shield = true; if (P.hp < st.maxHp) P.hp++; st.rateMul += 0.3; }, off() { st.rateMul -= 0.3; } },
];
function updateShrines(dt) {
  G.action = null;
  let best = 1e9;
  for (const s of G.shrines) {
    const d = Math.hypot(P.x - s.x, P.y - s.y);
    if (s.kind === 'slot') {
      if (s.spinT > 0) {
        s.spinT -= dt;
        for (let i = 0; i < 3; i++) if (s.spinT > 0.9 - i * 0.35) s.reels[i] = Math.floor(T * 14 + i) % 3; else s.reels[i] = s.res[i];
        if (Math.floor(T * 14) !== Math.floor((T - dt) * 14) && s.spinT > 0.2) Sfx.tick();
        if (s.spinT <= 0) slotResult(s);
      }
      if (d < 20 && d < best) { best = d; G.action = { s, label: s.spinT > 0 ? 'SPINNING...' : 'SPIN ' + s.cost }; }
    } else if (s.kind === 'curse') {
      if (!s.used && d < 20 && d < best) { best = d; G.action = { s, label: 'TAKE CURSE' }; }
    } else if (s.kind === 'power' && !s.used) {
      if (d < 16) {
        s.charge += dt; s.spawnT -= dt;
        if (Math.random() < dt * 30) G.parts.push({ x: s.x + rnd(-16, 16), y: s.y + rnd(-10, 10), vx: 0, vy: -40, t: 0.4, col: '#5ef0ff', sz: 1 });
        if (s.spawnT <= 0) { s.spawnT = 1; for (let i = 0; i < 2 && G.enemies.length < MAX_EN; i++) { const a = rnd(TAU); spawnEnemy(wpick(pool()), s.x + Math.cos(a) * 70, s.y + Math.sin(a) * 70); } Sfx.charge(); }
        if (s.charge >= 5) {
          s.used = true; G.pendingLv++;
          if (G.buff) G.buff.def.off();
          const def = pick(BUFFS); def.on(); G.buff = { def, t: 25 };
          banner('POWER!', def.name + ' FOR 25S', '+1 FREE UPGRADE', '#5ef0ff', 2.4);
          G.rings.push({ x: s.x, y: s.y, r: 4, vr: 300, t: 0.4, max: 0.4, col: '#5ef0ff' });
          burst(s.x, s.y, ['#5ef0ff', '#fff'], 30, 130); Sfx.jackpot(); G.flash = 0.25; G.flashCol = '#5ef0ff';
        }
      } else s.charge = Math.max(0, s.charge - dt * 0.5);
    }
  }
  if (G.buff) { G.buff.t -= dt; if (G.buff.t <= 0) { G.buff.def.off(); floater(P.x, P.y - 14, G.buff.def.name + ' ENDED', '#9a96b0'); G.buff = null; } }
}
function drawShrine(s) {
  shadow(s.x, s.y + 6, 12);
  const spr = SHRINE_SPR[s.kind];
  const used = s.used && s.kind !== 'slot';
  if (used) ctx.globalAlpha = 0.45;
  drawSpr(spr, s.x, s.y - 1 + (s.kind === 'power' && !used ? Math.round(Math.sin(T * 3)) : 0));
  ctx.globalAlpha = 1;
  const col = s.kind === 'slot' ? '#ffd23f' : s.kind === 'curse' ? '#9b5de5' : '#5ef0ff';
  if (!used) { addLight(s.x, s.y, 36); addGlow(s.x, s.y, 12, col); }
  if (s.kind === 'slot') {
    for (let i = 0; i < 3; i++) rect(s.x - 4 + i * 2 - 1 + i, s.y - 4, 1, 3, SLOT_SYM[s.reels[i]]);
    if (s.spinT > 0 || (s.res && s.spinT > -1.5)) {
      if (s.spinT <= 0) s.spinT -= 1 / 60;
      const bx = s.x - 17, by = s.y - 26;
      rect(bx - 1, by - 1, 36, 12, '#1b1428'); rect(bx, by, 34, 10, '#3b3a52');
      for (let i = 0; i < 3; i++) { rect(bx + 2 + i * 11, by + 2, 8, 6, '#1b1428'); rect(bx + 3 + i * 11, by + 3, 6, 4, SLOT_SYM[s.reels[i]]); }
    }
  } else if (s.kind === 'power' && !used) {
    const d = Math.hypot(P.x - s.x, P.y - s.y);
    ctx.globalAlpha = 0.35 + Math.sin(T * 4) * 0.1; ring(s.x, s.y + 2, 16, '#5ef0ff'); ctx.globalAlpha = 1;
    if (s.charge > 0) {
      const n = Math.floor(s.charge / 5 * 24);
      for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i / 24 * TAU; rect(s.x + Math.cos(a) * 16 - 1, s.y + 2 + Math.sin(a) * 16 - 1, 2, 2, '#fff'); }
    }
    if (d < 40) Font.outline(ctx, d < 16 ? 'HOLD ' + Math.max(0, 5 - s.charge).toFixed(1) : 'STAND HERE', s.x, s.y - 20, '#5ef0ff', '#1b1428', 1, 'center');
  } else if (s.kind === 'curse' && !used && Math.hypot(P.x - s.x, P.y - s.y) < 50) {
    Font.outline(ctx, 'CURSE SHRINE', s.x, s.y - 20, '#c79bff', '#1b1428', 1, 'center');
  }
}

/* ---------- Pets ---------- */
const PETS = [
  { id: 'drone', name: 'DRONE', cost: 300, desc: 'RAPID TINY LASERS', rate: 0.35, dmg: 0.35, col: '#5ef0ff', rows: ['.ggg.', 'gcwcg', 'ggggg', '.g.g.'] },
  { id: 'bird', name: 'BIRDIE', cost: 400, desc: 'TRIPLE FEATHERS', rate: 1.2, dmg: 0.6, col: '#ffd23f', rows: ['..yy.', '.ynyo', 'yyyy.', '.yy..'] },
  { id: 'goo', name: 'GOO PAL', cost: 450, desc: 'SLOWING GOO BALLS', rate: 0.9, dmg: 1.0, col: '#5ed15a', rows: ['.ee.', 'elee', 'enen', 'eeee'] },
  { id: 'spark', name: 'SPARKY', cost: 600, desc: 'ZAPS NEARBY FOES', rate: 1.0, dmg: 1.6, col: '#ffe95c', rows: ['..y..', '.yyy.', 'yywyy', '.yyy.', '..y..'] },
];
const PETS_BY = {}; for (const p of PETS) { PETS_BY[p.id] = p; p.spr = makeSprite(p.rows, {}, '#1b1428'); }
function updatePet(dt) {
  const pt = G.pet; if (!pt) return;
  const def = PETS_BY[pt.id];
  const tx = P.x - P.face * 13, ty = P.y - 9, k = Math.min(1, dt * 5);
  pt.x += (tx - pt.x) * k; pt.y += (ty - pt.y) * k; pt.t += dt; pt.cd -= dt;
  if (pt.cd > 0) return;
  const tgt = nearestEnemy(pt.x, pt.y, 140);
  if (!tgt) { pt.cd = 0.2; return; }
  pt.cd = def.rate;
  const D = st.dmg * st.dmgMul * def.dmg, a = Math.atan2(tgt.y - pt.y, tgt.x - pt.x);
  const shot = (aa, sp, r, extra) => G.bullets.push(Object.assign({ x: pt.x, y: pt.y, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, r, dmg: D, crit: false, pierce: 0, life: 0.8, hits: [], col: def.col }, extra || {}));
  if (pt.id === 'drone') shot(a, 240, 1.5);
  else if (pt.id === 'bird') { for (let i = -1; i <= 1; i++) shot(a + i * 0.25, 200, 2); }
  else if (pt.id === 'goo') shot(a, 120, 3, { slow: true, life: 1.2 });
  else { G.arcs.push({ x1: pt.x, y1: pt.y, x2: tgt.x, y2: tgt.y, t: 0.14 }); hitEnemy(tgt, D); burst(tgt.x, tgt.y, ['#ffe95c', '#fff'], 4, 50); }
}
function drawPet() {
  const pt = G.pet, def = PETS_BY[pt.id];
  shadow(pt.x, pt.y + 9, 5);
  drawSpr(def.spr, pt.x, pt.y + Math.round(Math.sin(pt.t * 5) * 1.5), P.face < 0);
  addLight(pt.x, pt.y, 18); addGlow(pt.x, pt.y, 6, def.col);
}

/* ---------- Hats ---------- */
const HATS = [
  { id: 'party', name: 'PARTY HAT', cost: 80, rows: ['..y..', '..m..', '.mcm.', '.cmc.', 'mcmcm'] },
  { id: 'flower', name: 'FLOWER', cost: 60, side: true, rows: ['.p.', 'pyp', '.p.'] },
  { id: 'shades', name: 'SHADES', cost: 100, eyes: true, rows: ['nnnnnnnn', '.nn..nn.'] },
  { id: 'top', name: 'TOP HAT', cost: 120, rows: ['.ddd.', '.ddd.', '.rrr.', 'ddddd'] },
  { id: 'chef', name: 'CHEF', cost: 140, rows: ['ww.ww', 'wwwww', '.www.', '.ggg.'] },
  { id: 'crown', name: 'CROWN', cost: 150, rows: ['y.y.y', 'yyyyy', 'yryuy'] },
  { id: 'horns', name: 'HORNS', cost: 180, rows: ['r......r', 'rr....rr', '.rr..rr.'] },
  { id: 'wizard', name: 'WIZARD', cost: 200, rows: ['...vv.', '..vvv.', '.vvyv.', '.vvvv.', 'vvvvvv'] },
  { id: 'halo', name: 'HALO', cost: 250, float: true, rows: ['.yyyy.', 'y....y', '.yyyy.'] },
];
const HATS_BY = {}; for (const h of HATS) { HATS_BY[h.id] = h; h.spr = makeSprite(h.rows, {}, '#1b1428'); }
const EYE_ROW = { pup: 4, cat: 4, frog: 1, bun: 5 };
function drawHat(x, y, ch, flip, sc = 1, hatId = save.hat) {
  const h = HATS_BY[hatId]; if (!h) return;
  const s = h.spr, top = y - SPR[ch][0].h * sc / 2;
  if (h.eyes) drawSpr(s, x, top + (EYE_ROW[ch] + 0.5) * sc, flip, false, sc);
  else if (h.float) drawSpr(s, x, top - 3 * sc + Math.round(Math.sin(T * 3)) * sc, flip, false, sc);
  else if (h.side) drawSpr(s, x + (flip ? -3 : 3) * sc, top + sc, flip, false, sc);
  else drawSpr(s, x, top - s.h * sc / 2 + 2 * sc, flip, false, sc);
}

/* ---------- Bestiary ---------- */
const BESTIARY = [
  { id: 'slime', name: 'SLIME', desc: 'SQUISHY AND SLOW' },
  { id: 'bat', name: 'BAT', desc: 'FAST ZIGZAG FLYER' },
  { id: 'peeper', name: 'PEEPER', desc: 'KEEPS AWAY, SHOOTS' },
  { id: 'bomber', name: 'BOMBER', desc: 'RUNS UP AND BLOWS' },
  { id: 'splitter', name: 'BIG SLIME', desc: 'SPLITS INTO 3' },
  { id: 'mini', name: 'MINI SLIME', desc: 'TINY BUT QUICK' },
  { id: 'golem', name: 'GOLEM', desc: 'SLOW. HUGE HP' },
  { id: 'charger', name: 'BOAR', desc: 'RED LINE = CHARGE' },
  { id: 'ghost', name: 'GHOST', desc: 'HIT IT WHEN SOLID' },
  { id: 'shroom', name: 'SPORE SHROOM', desc: 'SPORES ALL AROUND' },
  { id: 'thief', name: 'GOLD THIEF', desc: 'CATCH FOR JACKPOT' },
  { id: 'king', name: 'KING GLOOP', desc: 'BOSS: JUMP SLAMS' },
  { id: 'eye', name: 'THE WATCHER', desc: 'BOSS: BULLET SPIRAL' },
  { id: 'queen', name: 'BAT QUEEN', desc: 'BOSS: DASH + SWARM' },
];
function seeEnemy(type) {
  if (save.seen[type]) return;
  save.seen[type] = 1;
  const b = BESTIARY.find(x => x.id === type);
  if (b && G && G.atoast && save.runs > 1) G.atoast.push({ txt: 'NEW FOE: ' + b.name, col: '#5ef0ff', t: 2.4 });
}

/* ---------- Achievements ---------- */
const ACHS = [
  { id: 'first', name: 'FIRST BLOOD', desc: 'DEFEAT A FOE', r: 10, c: s => s.kills >= 1 },
  { id: 'k1k', name: 'BRAWLER', desc: 'DEFEAT 1000 FOES', r: 50, c: s => s.kills >= 1000 },
  { id: 'k10k', name: 'EXTERMINATOR', desc: 'DEFEAT 10000 FOES', r: 250, c: s => s.kills >= 10000 },
  { id: 'slime', name: 'SLIME SLAYER', desc: 'SQUISH 500 SLIMES', r: 60, c: s => (s.kinds.slime || 0) >= 500 },
  { id: 'boss1', name: 'BOSS HUNTER', desc: 'BEAT A BOSS', r: 40, c: s => s.bosses >= 1 },
  { id: 'boss10', name: 'BOSS MASTER', desc: 'BEAT 10 BOSSES', r: 150, c: s => s.bosses >= 10 },
  { id: 'w10', name: 'SURVIVOR', desc: 'REACH WAVE 10', r: 50, c: () => save.bestWave >= 10 },
  { id: 'w25', name: 'LEGEND', desc: 'REACH WAVE 25', r: 250, c: () => save.bestWave >= 25 },
  { id: 'combo', name: 'COMBO KING', desc: 'HIT A 100 COMBO', r: 80, c: s => s.bestCombo >= 100 },
  { id: 'rampage', name: 'RAMPAGE!', desc: 'KILL 35 AT ONCE', r: 80, c: s => s.bestMulti >= 35 },
  { id: 'evo', name: 'EVOLVED', desc: 'EVOLVE A WEAPON', r: 60, c: s => s.evos >= 1 },
  { id: 'evo3', name: 'FULL POWER', desc: '3 EVOLUTIONS IN A RUN', r: 150, c: (s, g) => g && g.evoCount >= 3 },
  { id: 'thief', name: 'GOTCHA!', desc: 'CATCH A THIEF', r: 40, c: s => s.thieves >= 1 },
  { id: 'jackpot', name: 'HIGH ROLLER', desc: 'HIT A SLOT JACKPOT', r: 80, c: s => s.jackpots >= 1 },
  { id: 'curse', name: 'DARK DEAL', desc: 'ACCEPT A CURSE', r: 30, c: s => s.curses >= 1 },
  { id: 'ult', name: 'ULTIMATE!', desc: 'USE AN ULTIMATE', r: 30, c: s => s.ults >= 1 },
  { id: 'hat', name: 'FASHIONISTA', desc: 'BUY A HAT', r: 30, c: () => Object.keys(save.hats).length >= 1 },
  { id: 'pet', name: 'BEST FRIENDS', desc: 'ADOPT A PET', r: 50, c: () => Object.keys(save.pets).length >= 1 },
  { id: 'zoo', name: 'ZOOKEEPER', desc: 'DISCOVER EVERY FOE', r: 150, c: () => BESTIARY.every(b => save.seen[b.id]) },
  { id: 'daily', name: 'DAILY DOER', desc: 'FINISH A DAILY RUN', r: 40, c: s => s.dailies >= 1 },
  { id: 'rush', name: 'RUSHER', desc: '3 BOSSES IN BOSS RUSH', r: 120, c: (s, g) => g && g.mode === 'rush' && g.bossIdx >= 3 },
  { id: 'night', name: 'NIGHT OWL', desc: 'WAVE 10 IN NIGHTMARE', r: 200, c: s => s.nightWave >= 10 },
  { id: 'chars', name: 'COLLECTOR', desc: 'UNLOCK ALL HEROES', r: 150, c: () => CHAR_ORDER.every(c => save.unlocked[c]) },
  { id: 'rich', name: 'TYCOON', desc: 'EARN 5000 COINS', r: 200, c: s => s.coins >= 5000 },
  { id: 'clean', name: 'UNTOUCHABLE', desc: 'WAVE 5 WITHOUT A HIT', r: 100, c: (s, g) => g && g.cleanWave >= 5 },
];
function checkAch(g) {
  const got = [];
  for (const a of ACHS) if (!save.ach[a.id] && a.c(save.stats, g)) { save.ach[a.id] = 1; save.coins += a.r; got.push(a); }
  if (got.length) {
    persist();
    if (g && g.atoast) for (const a of got) g.atoast.push({ txt: 'BADGE: ' + a.name + ' +' + a.r, col: '#ffd23f', t: 2.6 });
    Sfx.mission();
  }
  return got;
}

/* ---------- Per-frame hook & events ---------- */
function updateExtras(dt) {
  updateProps(dt); updateShrines(dt); updatePet(dt); updateUlt(dt);
  G.achT -= dt;
  if (G.achT <= 0) { G.achT = 3; checkAch(G); }
  if (G.atoast.length) { G.atoast[0].t -= dt; if (G.atoast[0].t <= 0) G.atoast.shift(); }
}
function onKill(e) {
  save.stats.kills++;
  save.stats.kinds[e.type] = (save.stats.kinds[e.type] || 0) + 1;
  if (e.type === 'thief') save.stats.thieves++;
  ultGain(e.elite ? 10 : e.type === 'thief' ? 25 : 1.4);
}
function onBossDown() { save.stats.bosses++; ultGain(35); }
function onEvolve() { save.stats.evos++; G.evoCount++; }
/* Called from gameOver(): records stats, daily best and badges. Returns extra info for the results screen. */
function runEnded(earned) {
  const s = save.stats;
  s.runs++; s.time += G.t; s.coins += earned;
  s.bestCombo = Math.max(s.bestCombo, G.bestCombo);
  if (G.mode === 'night') s.nightWave = Math.max(s.nightWave, G.wave);
  let dailyBest = false;
  if (G.mode === 'daily') {
    s.dailies++;
    const k = todayKey();
    if (save.daily.date !== k) save.daily = { date: k, best: 0 };
    if (G.score > save.daily.best) { save.daily.best = G.score; dailyBest = true; }
  }
  const achs = checkAch(G);
  return { achs, dailyBest };
}

/* ---------- Touch buttons for ultimate & shrine actions ---------- */
function btnK() { return [0.8, 1, 1.25][save.settings.btn] || 1; }
function ultBtnPos() {
  const k = btnK(), d = dashBtnPos();
  return usingTouch ? { x: d.x - d.r - 16 * k - 6, y: d.y + 6, r: 13 * k } : { x: GW - SAFE.r - 20, y: GH - SAFE.b - 20, r: 13 };
}
function actionBtnRect() { return { x: GW / 2 - 40, y: GH - SAFE.b - 50 * btnK(), w: 80, h: 18 }; }
function touchExtras(p) {
  const u = ultBtnPos();
  if (Math.hypot(p.x - u.x, p.y - u.y) < u.r + 6) { useUlt(); return true; }
  if (G.action) { const a = actionBtnRect(); if (p.x > a.x - 4 && p.x < a.x + a.w + 4 && p.y > a.y - 4 && p.y < a.y + a.h + 4) { doAction(); return true; } }
  return false;
}
function drawHudExtras() {
  // ultimate button
  const u = ultBtnPos(), full = G.ult >= 100, U = ULTS[save.sel];
  ctx.globalAlpha = 0.9;
  disc(u.x, u.y + 1, u.r + 1, '#1b1428');
  disc(u.x, u.y, u.r, full ? U.col : '#3b3a52');
  if (!full) {
    const h = Math.round(u.r * 2 * G.ult / 100);
    ctx.save(); ctx.beginPath(); ctx.rect(u.x - u.r - 1, u.y + u.r - h, u.r * 2 + 2, h + 1); ctx.clip();
    disc(u.x, u.y, u.r, shade(U.col, -0.45)); ctx.restore();
  } else { ring(u.x, u.y, u.r + 2 + Math.floor(T * 6) % 2, RAINBOW[Math.floor(T * 10) % 8], 1); }
  ring(u.x, u.y, u.r, full ? '#fff' : '#55506e');
  ctx.globalAlpha = 1;
  Font.draw(ctx, 'ULT', u.x, u.y - 5, full ? '#1b1428' : '#9a96b0', 1, 'center');
  Font.draw(ctx, usingTouch ? Math.floor(G.ult) + '%' : 'Q', u.x, u.y + 1, full ? '#1b1428' : '#c0c8ff', 1, 'center');
  // shrine action
  if (G.action) {
    const a = actionBtnRect();
    btn('action', a.x, a.y, a.w, a.h, G.action.label + (usingTouch ? '' : ' (F)'), doAction, G.action.s.kind === 'curse' ? '#9b5de5' : '#ffd23f', 1);
  }
  // status tags
  let ty = SAFE.t + 44;
  const L = SAFE.l + 4;
  if (G.mode !== 'normal') { Font.outline(ctx, MODES[G.mode].name, L, ty, MODES[G.mode].col); ty += 8; }
  if (G.curse) { Font.outline(ctx, 'CURSED', L, ty, '#c79bff'); ty += 8; }
  if (G.buff) { Font.outline(ctx, G.buff.def.name + ' ' + Math.ceil(G.buff.t), L, ty, '#5ef0ff'); ty += 8; }
  // toasts
  if (G.atoast.length) { const a = G.atoast[0]; Font.outline(ctx, a.txt, GW / 2, GH - SAFE.b - (G.action ? 70 : 52) * btnK(), a.col, '#1b1428', 1, 'center'); }
  // ultimate banner
  if (G.ultBanner) {
    const b = G.ultBanner, s = Font.width(b.name, 3) < GW - 8 ? 3 : 2;
    Font.outline(ctx, b.name, GW / 2 + (b.t > 1.3 ? rnd(-2, 2) : 0), GH * 0.32, b.col, '#1b1428', s, 'center');
  }
}
function drawUltFx() {
  for (const s of G.slashes) {
    const k = s.t / 0.3, l = 16, ux = Math.cos(s.a) * l, uy = Math.sin(s.a) * l;
    ctx.globalAlpha = Math.min(1, k * 1.5);
    pthick(s.x - ux, s.y - uy, s.x + ux, s.y + uy, '#ff9ad5', 3);
    pthick(s.x - ux, s.y - uy, s.x + ux, s.y + uy, '#ffffff', 1);
    ctx.globalAlpha = 1; addGlow(s.x, s.y, 10, '#ff9ad5');
  }
  if (G.tongue > 0) {
    const list = onScreenEnemies().filter(e => !e.boss).sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y)).slice(0, 8);
    for (const e of list) { pthick(P.x, P.y, e.x, e.y, '#ff7aa8', 2); rect(e.x - 2, e.y - 2, 4, 4, '#ff4d6d'); }
  }
}
