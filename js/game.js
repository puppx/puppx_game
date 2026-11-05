'use strict';
/* =========================================================
   PUPPX RAMPAGE — a tiny pixel arena survival game
   ========================================================= */

/* ---------- Canvas & scaling ---------- */
const cv = document.getElementById('game');
const ctx = cv.getContext('2d', { alpha: false });
const lightCv = document.createElement('canvas'), lctx = lightCv.getContext('2d');
let GW = 200, GH = 320, S = 2;
const SAFE = { t: 0, r: 0, b: 0, l: 0 };

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  S = Math.max(1, Math.round(Math.min(w, h) / 190));
  GW = Math.ceil(w / S); GH = Math.ceil(h / S);
  cv.width = GW; cv.height = GH; lightCv.width = GW; lightCv.height = GH;
  cv.style.width = GW * S + 'px'; cv.style.height = GH * S + 'px';
  ctx.imageSmoothingEnabled = false;
  const cs = getComputedStyle(document.getElementById('safe'));
  SAFE.t = Math.ceil(parseFloat(cs.paddingTop) / S) || 0;
  SAFE.r = Math.ceil(parseFloat(cs.paddingRight) / S) || 0;
  SAFE.b = Math.ceil(parseFloat(cs.paddingBottom) / S) || 0;
  SAFE.l = Math.ceil(parseFloat(cs.paddingLeft) / S) || 0;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

/* ---------- Helpers ---------- */
const TAU = Math.PI * 2;
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
function wpick(list) {
  let t = 0; for (const it of list) t += it[1];
  let r = Math.random() * t;
  for (const it of list) if ((r -= it[1]) <= 0) return it[0];
  return list[list.length - 1][0];
}
function vib(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { } }
function fmtTime(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + (s < 10 ? '0' : '') + s; }

/* Pixel drawing primitives (crisp, no anti-aliasing) */
function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function disc(cx, cy, r, c) {
  ctx.fillStyle = c; r = Math.round(r); cx = Math.round(cx); cy = Math.round(cy);
  for (let dy = -r; dy <= r; dy++) { const dx = Math.floor(Math.sqrt(r * r - dy * dy)); ctx.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1); }
}
function ring(cx, cy, r, c, th = 1) {
  ctx.fillStyle = c; r = Math.round(r); cx = Math.round(cx); cy = Math.round(cy);
  const ri = r - th;
  for (let dy = -r; dy <= r; dy++) {
    const xo = Math.floor(Math.sqrt(r * r - dy * dy));
    if (Math.abs(dy) > ri || ri <= 0) { ctx.fillRect(cx - xo, cy + dy, xo * 2 + 1, 1); continue; }
    const xi = Math.floor(Math.sqrt(ri * ri - dy * dy)) + 1;
    ctx.fillRect(cx - xo, cy + dy, xo - xi + 1, 1);
    ctx.fillRect(cx + xi, cy + dy, xo - xi + 1, 1);
  }
}
function pline(x0, y0, x1, y1, c, sz = 1) {
  ctx.fillStyle = c;
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0 || 1;
  for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), sz, sz);
}
function drawSpr(s, x, y, flip = false, flash = false, sc = 1, sil = false) {
  const img = sil ? s.sil : flash ? (flip ? s.ff : s.f) : (flip ? s.cf : s.c);
  const w = s.w * sc, h = s.h * sc;
  ctx.drawImage(img, Math.round(x - w / 2), Math.round(y - h / 2), w, h);
}
function shadow(x, y, w) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(Math.round(x - w / 2), Math.round(y), Math.round(w), 2); }

/* ---------- Save data ---------- */
const SAVE_KEY = 'puppx-rampage-save-v1';
const save = (() => {
  const d = { coins: 0, bestWave: 0, bestScore: 0, sel: 'pup', unlocked: { pup: true }, shop: {}, sfx: true, music: true, runs: 0, missions: [], mDone: 0 };
  try { return Object.assign(d, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { return d; }
})();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { } }
Sfx.setSfx(save.sfx); Sfx.setMusic(save.music);
function newMission() {
  const used = save.missions.map(m => m.i);
  const opts = MISSION_POOL.map((m, i) => i).filter(i => !used.includes(i));
  const i = pick(opts), def = MISSION_POOL[i];
  const tier = Math.min(def.ns.length - 1, Math.floor(save.mDone / 4) + (Math.random() < 0.3 ? 1 : 0));
  return { i, n: def.ns[tier], p: 0, r: 40 + tier * 45 + (def.k === 'kill' ? 0 : 20), done: false };
}
function ensureMissions() {
  save.missions = (save.missions || []).filter(m => MISSION_POOL[m.i]);
  while (save.missions.length < 3) save.missions.push(newMission());
}
function mission(k, amt, sub) {
  for (const m of save.missions) {
    if (m.done) continue;
    const def = MISSION_POOL[m.i];
    if (def.k !== k || (def.sub && def.sub !== 'any' && def.sub !== sub)) continue;
    m.p = def.max ? Math.max(m.p, amt) : m.p + amt;
    if (m.p >= m.n) { m.p = m.n; m.done = true; if (G && G.t !== undefined) { G.mtoast = { txt: def.txt(m.n), t: 2.8 }; Sfx.mission(); } }
  }
}

/* ---------- Game data ---------- */
const CHAR_ORDER = ['pup', 'cat', 'frog', 'bun'];
const CHARS = {
  pup: { name: 'PUP', cost: 0, hp: 5, speed: 64, dmg: 10, rate: 2.5, crit: 0.05, multi: 1, bullet: '#ffe08a', lines: ['A VERY GOOD BOY', 'BALANCED BLASTER'] },
  cat: { name: 'CAT', cost: 200, hp: 4, speed: 76, dmg: 9, rate: 2.8, crit: 0.25, multi: 1, bullet: '#ff9ad5', lines: ['FAST AND SNEAKY', '25% CRIT CHANCE'] },
  frog: { name: 'FROG', cost: 450, hp: 7, speed: 56, dmg: 12, rate: 2.0, crit: 0.05, multi: 1, start: 'orbit', bullet: '#9dff7a', lines: ['CHONKY AND TOUGH', 'STARTS WITH SPIN BONES'] },
  bun: { name: 'BUN', cost: 800, hp: 4, speed: 70, dmg: 7, rate: 3.0, crit: 0.08, multi: 2, start: 'boom', bullet: '#a8e6ff', lines: ['TWIN SHOT CHAOS', 'STARTS WITH BOOMERANG'] },
};

const SHOP = [
  { id: 'hp', name: 'MAX HP', desc: '+1 HEART', icon: 'heart', col: '#ff4d6d', max: 5, cost: l => 80 + l * 70 },
  { id: 'dmg', name: 'POWER', desc: '+10% DAMAGE', icon: 'power', col: '#ff5d5d', max: 10, cost: l => 50 + l * 40 },
  { id: 'spd', name: 'SPEED', desc: '+5% MOVE SPEED', icon: 'speed', col: '#7ae8ff', max: 5, cost: l => 60 + l * 50 },
  { id: 'mag', name: 'MAGNET', desc: '+25% PICKUP RANGE', icon: 'magnet', col: '#ff5d5d', max: 5, cost: l => 40 + l * 35 },
  { id: 'reroll', name: 'REROLL', desc: '+1 REROLL PER RUN', icon: 'reroll', col: '#ffd23f', max: 3, cost: l => 120 + l * 120 },
  { id: 'greed', name: 'GREED', desc: '+20% COINS', icon: 'coinA', col: '#ffd23f', max: 5, cost: l => 100 + l * 90 },
];

const BIOMES = [
  { name: 'MEADOW', base: ['#3f7d3b', '#45873f', '#3a7337'], speck: '#356a31', deco: ['#5fae4f', '#f2e86d', '#ff8fb1', '#ffffff'], wall: '#2e2b3f', wallHi: '#4b4766', void: '#16121f', style: 'grass', dark: 0.22, darkCol: '#140c30', amb: 'fireflies', key: 0, bpm: 0 },
  { name: 'DUNGEON', base: ['#3b3651', '#403a59', '#36314b'], speck: '#2f2a42', deco: ['#54507a', '#6b6690', '#c9b78a', '#2a2540'], wall: '#1f1b2e', wallHi: '#5a5478', void: '#0f0c17', style: 'stone', dark: 0.62, darkCol: '#05030a', amb: 'dust', key: -2, bpm: 6 },
  { name: 'LAVA LANDS', base: ['#4a2a2a', '#53302c', '#432524'], speck: '#3a1f1f', deco: ['#ff6a2b', '#ffb13b', '#2a1616', '#7a3a2a'], wall: '#251515', wallHi: '#6b3a2a', void: '#120808', style: 'lava', dark: 0.45, darkCol: '#1a0404', amb: 'embers', key: 3, bpm: 12 },
  { name: 'ICE CAVES', base: ['#8fb8dc', '#99c2e4', '#86afd4'], speck: '#7ba3c9', deco: ['#e8f6ff', '#6d9cc7', '#ffffff', '#b5dcf5'], wall: '#3d5a80', wallHi: '#8fb8dc', void: '#14202e', style: 'ice', dark: 0.2, darkCol: '#08142e', amb: 'snow', key: 5, bpm: 4 },
  { name: 'THE VOID', base: ['#1d1233', '#22163b', '#190f2d'], speck: '#140b24', deco: ['#7a4cff', '#ff4cd2', '#3b2a6b', '#5ef0ff'], wall: '#0b0614', wallHi: '#3b2a6b', void: '#05030a', style: 'void', dark: 0.68, darkCol: '#030108', amb: 'sparks', key: -4, bpm: 16 },
];

const EN = {
  slime: { hp: 18, speed: 24, r: 4, xp: 1, score: 10, spr: 'slime', col: ['#5ed15a', '#b8f28a'] },
  bat: { hp: 13, speed: 46, r: 4, xp: 1, score: 12, spr: 'bat', col: ['#9b5de5', '#5b2a9a'] },
  peeper: { hp: 34, speed: 22, r: 4, xp: 2, score: 20, spr: 'peeper', col: ['#fff4e0', '#4aa3ff'] },
  bomber: { hp: 20, speed: 36, r: 4, xp: 2, score: 20, spr: 'bomber', col: ['#3b3a52', '#ffb13b'] },
  splitter: { hp: 60, speed: 18, r: 7, xp: 3, score: 30, spr: 'slimeP', scale: 2, col: ['#ff6fb5', '#ffc2e2'] },
  mini: { hp: 10, speed: 36, r: 3, xp: 1, score: 5, spr: 'slimeP', col: ['#ff6fb5', '#ffc2e2'] },
  golem: { hp: 170, speed: 13, r: 6, xp: 6, score: 60, spr: 'golem', heavy: true, col: ['#9b8a76', '#62554a'] },
  charger: { hp: 45, speed: 26, r: 5, xp: 3, score: 30, spr: 'charger', col: ['#9a6440', '#5e3b28', '#fff4e0'] },
  ghost: { hp: 38, speed: 30, r: 4, xp: 3, score: 30, spr: 'ghost', col: ['#e8f0ff', '#a3a9c2'] },
  shroom: { hp: 55, speed: 7, r: 5, xp: 3, score: 30, spr: 'shroom', col: ['#e8344c', '#fff4e0'] },
  thief: { hp: 80, speed: 54, r: 4, xp: 10, score: 300, spr: 'thief', col: ['#ffd23f', '#fff7b0'] },
  queen: { hp: 1, speed: 40, r: 13, xp: 0, score: 3000, spr: 'queen', scale: 2, col: ['#9b5de5', '#ffd23f', '#fff4e0'] },
  king: { hp: 1, speed: 20, r: 13, xp: 0, score: 2000, spr: 'king', scale: 2, col: ['#4aa3ff', '#a8d8ff', '#ffd23f'] },
  eye: { hp: 1, speed: 30, r: 13, xp: 0, score: 2500, spr: 'eye', scale: 2, col: ['#9b5de5', '#fff4e0', '#4aa3ff'] },
};

const MOD_NONE = { id: 'none', name: '' };
const MODS = [
  { id: 'swarm', name: 'BAT SWARM', sub: 'SO MANY WINGS', col: '#c79bff', w: { bat: 22 }, spawnMul: 0.6 },
  { id: 'slime', name: 'SLIME TIME', sub: 'EXTRA SQUISHY', col: '#5ed15a', w: { slime: 18, splitter: 5 }, spawnMul: 0.75 },
  { id: 'bombs', name: 'BOMB PARTY', sub: 'POP THEM FROM AFAR', col: '#ffb13b', w: { bomber: 16 } },
  { id: 'gold', name: 'GOLD RUSH', sub: 'EVERY KILL DROPS GOLD', col: '#ffd23f', gold: true },
  { id: 'xp', name: 'DOUBLE XP', sub: 'LEVEL UP FASTER', col: '#5ef0ff', xp2: true },
  { id: 'giant', name: 'GIANTS', sub: 'MORE ELITES APPEAR', col: '#ff7a7a', giant: true },
  { id: 'fast', name: 'SPEED DEMONS', sub: 'EVERYONE GOES FAST', col: '#7ae8ff', fast: true },
  { id: 'eyes', name: 'EYE SPY', sub: 'THEY ARE WATCHING', col: '#4aa3ff', w: { peeper: 12 } },
  { id: 'haunt', name: 'HAUNTED', sub: 'GHOSTS FADE IN AND OUT', col: '#c0d8ff', w: { ghost: 14 } },
  { id: 'boars', name: 'BOAR RUSH', sub: 'WATCH FOR THE RED LINE', col: '#ff7a5a', w: { charger: 12 } },
  { id: 'spores', name: 'SPORE STORM', sub: 'MUSHROOMS EVERYWHERE', col: '#ff6a8a', w: { shroom: 8 } },
];

const UPGS = [
  { id: 'dmg', name: 'POWER UP', icon: 'power', col: '#ff5d5d', max: 8, desc: () => '+25% DAMAGE', apply() { st.dmgMul += 0.25; } },
  { id: 'rate', name: 'RAPID FIRE', icon: 'rate', col: '#ffd23f', max: 8, desc: () => '+18% FIRE RATE', apply() { st.rateMul += 0.18; } },
  { id: 'multi', name: 'MULTISHOT', icon: 'multi', col: '#ff9a3c', max: 4, desc: () => '+1 PROJECTILE', apply() { st.multi++; } },
  { id: 'pierce', name: 'PIERCE', icon: 'pierce', col: '#c0c8ff', max: 4, desc: () => 'SHOTS PIERCE +1 FOE', apply() { st.pierce++; } },
  { id: 'big', name: 'BIG SHOTS', icon: 'big', col: '#ff7ad9', max: 4, desc: () => 'BIGGER + 15% DAMAGE', apply() { st.size += 0.4; st.dmgMul += 0.15; } },
  { id: 'speed', name: 'ZOOMIES', icon: 'speed', col: '#7ae8ff', max: 5, desc: () => '+12% MOVE SPEED', apply() { st.speedMul += 0.12; } },
  { id: 'heart', name: 'BIG HEART', icon: 'heart', col: '#ff4d6d', max: 6, desc: () => '+1 MAX HP AND HEAL', apply() { st.maxHp++; P.hp = Math.min(st.maxHp, P.hp + 1); } },
  { id: 'magnet', name: 'MAGNET', icon: 'magnet', col: '#ff5d5d', max: 4, desc: () => '+50% PICKUP RANGE', apply() { st.magMul += 0.5; } },
  { id: 'crit', name: 'LUCKY HIT', icon: 'crit', col: '#ffd23f', max: 5, desc: () => '+10% CRIT CHANCE', apply() { st.crit += 0.1; } },
  { id: 'dash', name: 'DASH MASTER', icon: 'dash', col: '#7ae8ff', max: 3, desc: l => (l === 0 ? 'DASH SMASHES FOES' : '-25% DASH COOLDOWN'), apply(l) { st.dashDmg = true; if (l > 0) st.dashCd *= 0.75; } },
  { id: 'regen', name: 'REGEN', icon: 'heart', col: '#5ed15a', max: 3, desc: l => 'HEAL 1 HP EVERY ' + [30, 20, 12][l] + 'S', apply(l) { st.regen = [30, 20, 12][l]; } },
  { id: 'orbit', name: 'SPIN BONES', icon: 'orbit', col: '#fff4e0', max: 5, weapon: true, desc: l => (l === 0 ? 'BONES CIRCLE YOU' : '+1 BONE, MORE DAMAGE'), apply() { st.w.orbit++; } },
  { id: 'zap', name: 'THUNDER', icon: 'zap', col: '#ffe95c', max: 5, weapon: true, desc: l => (l === 0 ? 'ZAPS RANDOM FOES' : '+1 BOLT, ZAP FASTER'), apply() { st.w.zap++; } },
  { id: 'aura', name: 'HOT AURA', icon: 'aura', col: '#ff8c2e', max: 5, weapon: true, desc: l => (l === 0 ? 'BURN AND SLOW NEARBY' : 'BIGGER AND HOTTER'), apply() { st.w.aura++; } },
  { id: 'boom', name: 'BOOMERANG', icon: 'boom', col: '#9dff7a', max: 5, weapon: true, desc: l => (l === 0 ? 'IT ALWAYS COMES BACK' : 'MORE DAMAGE + RANGS'), apply() { st.w.boom++; } },
  { id: 'nova', name: 'STAR NOVA', icon: 'nova', col: '#7ae8ff', max: 5, weapon: true, desc: l => (l === 0 ? 'BURST OF STARS' : 'MORE STARS, FASTER'), apply() { st.w.nova++; } },
  { id: 'laser', name: 'LASER EYES', icon: 'laser', col: '#5ef0ff', max: 5, weapon: true, desc: l => (l === 0 ? 'PIERCING BEAM BLAST' : 'WIDER, FASTER BEAM'), apply() { st.w.laser++; } },
  { id: 'missile', name: 'ROCKETS', icon: 'missile', col: '#ffb13b', max: 5, weapon: true, desc: l => (l === 0 ? 'HOMING MISSILES' : 'MORE ROCKETS + BOOM'), apply() { st.w.missile++; } },
];
const SNACK = { id: 'snack', name: 'SNACK', icon: 'heart', col: '#5ed15a', max: 999, filler: true, desc: () => 'HEAL 2 HP', apply() { P.hp = Math.min(st.maxHp, P.hp + 2); } };
const COINBAG = { id: 'coins', name: 'COIN BAG', icon: 'coinA', col: '#ffd23f', max: 999, filler: true, desc: () => '+25 COINS', apply() { G.coins += 25; } };
const UPG_BY = {}; for (const u of UPGS) UPG_BY[u.id] = u;
const EVOS = {
  orbit: ['BONE STORM', 'GIANT GOLDEN BONE RING'],
  zap: ['STORM GOD', 'CHAIN LIGHTNING NONSTOP'],
  aura: ['INFERNO', 'HUGE FIELD, DOUBLE BURN'],
  boom: ['BLADE CYCLONE', 'GIANT RANGS EVERYWHERE'],
  nova: ['SUPERNOVA', 'DOUBLE PIERCING BURST'],
  laser: ['GIGA BEAM', 'FOUR SPINNING BEAMS'],
  missile: ['NUKE SWARM', 'DOUBLE ROCKETS, BIG BOOMS'],
};
const EVO_UPG = {};
for (const w in EVOS) EVO_UPG[w] = { id: 'evo_' + w, name: EVOS[w][0], icon: UPG_BY[w].icon, col: UPG_BY[w].col, max: 1, evo: w, desc: () => EVOS[w][1], apply() { st.evo[w] = true; evolveFx(w); } };

/* ---------- Missions (persistent goals that pay coins) ---------- */
const MISSION_POOL = [
  { k: 'kill', sub: 'slime', ns: [150, 400, 1000], txt: n => 'SQUISH ' + n + ' SLIMES' },
  { k: 'kill', sub: 'bat', ns: [100, 300, 800], txt: n => 'SWAT ' + n + ' BATS' },
  { k: 'kill', sub: 'bomber', ns: [40, 120, 300], txt: n => 'POP ' + n + ' BOMBS' },
  { k: 'kill', sub: 'ghost', ns: [25, 80, 200], txt: n => 'BUST ' + n + ' GHOSTS' },
  { k: 'kill', sub: 'charger', ns: [30, 90, 200], txt: n => 'STOP ' + n + ' BOARS' },
  { k: 'kill', sub: 'any', ns: [500, 1500, 4000], txt: n => 'DEFEAT ' + n + ' FOES' },
  { k: 'wave', max: true, ns: [6, 10, 15, 20], txt: n => 'REACH WAVE ' + n },
  { k: 'boss', ns: [1, 3, 6], txt: n => 'BEAT ' + n + ' BOSS' + (n > 1 ? 'ES' : '') },
  { k: 'combo', max: true, ns: [40, 80, 150], txt: n => 'HIT A ' + n + ' COMBO' },
  { k: 'chest', ns: [5, 15, 40], txt: n => 'OPEN ' + n + ' CHESTS' },
  { k: 'thief', ns: [1, 3, 8], txt: n => 'CATCH ' + n + (n > 1 ? ' THIEVES' : ' THIEF') },
  { k: 'evo', ns: [1, 3, 6], txt: n => 'EVOLVE ' + n + ' WEAPON' + (n > 1 ? 'S' : '') },
  { k: 'multi', max: true, ns: [12, 25, 40], txt: n => 'KILL ' + n + ' AT ONCE' },
  { k: 'level', max: true, ns: [10, 20, 30], txt: n => 'REACH LEVEL ' + n },
];
ensureMissions();

const TIPS = [
  'TIP: MAX A WEAPON TO EVOLVE IT', 'TIP: CATCH THE GOLD THIEF', 'TIP: RED LINE = BOAR CHARGE',
  'TIP: GHOSTS CAN ONLY BE HIT WHEN SOLID', 'TIP: SHIELDS BLOCK ONE HIT', 'TIP: FINISH GOALS FOR COINS',
  'TIP: DASH THROUGH BULLETS', 'TIP: SHOOT BOMBS NEAR CROWDS', 'TIP: KEEP THE COMBO FOR FEVER',
  'TIP: CHESTS GIVE FREE UPGRADES', 'TIP: BOSSES COME EVERY 5 WAVES', 'TIP: GOLD BUYS PERMANENT POWER',
  'TIP: SPEND COINS IN THE SHOP', 'TIP: ELITES DROP TREASURE', 'TIP: GETTING HIT BREAKS COMBO',
];
const DEATH_TITLES = ['YOU GOT BONKED', 'SQUISHED!', 'TOTALLY WIPED', 'OUCH. AGAIN?', 'SO CLOSE!'];

/* ---------- Run state ---------- */
const ARENA = 640, WALL = 14, MAX_EN = 170, CELL = 24;
const GRID_N = Math.ceil(ARENA / CELL) + 1;
const grid = Array.from({ length: GRID_N * GRID_N }, () => []);
let st = null, G = null, P = null, floorCv = null, floorCtx = null, FLOOR_LIGHTS = [];
const LIGHTS = [], GLOWS = [];
let scene = 'menu', T = 0;

function xpNeed(l) { return Math.floor(4 + l * 2.5 + l * l * 0.25); }

function newRun() {
  const ch = CHARS[save.sel], sh = save.shop;
  st = {
    maxHp: ch.hp + (sh.hp || 0), speed: ch.speed, speedMul: 1 + 0.05 * (sh.spd || 0),
    dmg: ch.dmg, dmgMul: 1 + 0.1 * (sh.dmg || 0), rate: ch.rate, rateMul: 1, crit: ch.crit,
    multi: ch.multi, pierce: 0, size: 1, bspeed: 190, magnet: 32, magMul: 1 + 0.25 * (sh.mag || 0),
    dashCd: 1.4, dashDmg: false, regen: 0, bullet: ch.bullet,
    w: { orbit: 0, zap: 0, aura: 0, boom: 0, nova: 0, laser: 0, missile: 0 }, evo: {},
  };
  P = { x: ARENA / 2, y: ARENA / 2, r: 4, hp: st.maxHp, inv: 1, shield: false, dashT: 0, dashCd: 0, dx: 1, dy: 0, ddx: 1, ddy: 0, face: 1, moving: false, anim: 0, regenT: 0, dashHit: null, lastGhost: 0 };
  G = {
    t: 0, wave: 1, waveT: 0, waveLen: 25, spawnT: 0.8, eventDone: false, kills: 0, score: 0, coins: 0,
    xp: 0, lvl: 1, need: xpNeed(1), pendingLv: 0, combo: 0, comboT: 0, bestCombo: 0, fever: 0, feverNext: 30,
    rerolls: 1 + (sh.reroll || 0), mod: MOD_NONE, boss: null, bossIdx: 0, biome: 0, newBiome: false, hpMul: 1,
    enemies: [], bullets: [], ebullets: [], gems: [], pickups: [], parts: [], floats: [], bolts: [], rings: [], ghosts: [], rocks: [],
    fireT: 0, orbA: 0, zapT: 1, auraT: 0, boomT: 1, novaT: 2, chestT: 22,
    missiles: [], beams: [], arcs: [], amb: [], laserT: 1.5, missileT: 1.2, novaEcho: 0, freeze: 0,
    mk: 0, mkT: 0, announce: null, letterbox: 0, pillar: 0, thiefT: 0, mtoast: null, hbT: 0,
    shake: 0, hitstop: 0, slowT: 0, flash: 0, flashCol: '#fff', hurtFx: 0, banner: null,
    cam: { x: P.x, y: P.y }, lv: {}, dying: 0, gemStreak: 0, gemStreakT: 0, bossBoom: null, choices: null, lvT: 0,
  };
  buildFloor(0); placeRocks();
  if (ch.start) applyUpg(UPG_BY[ch.start]);
  banner('WAVE 1', save.runs < 2 ? 'DRAG ANYWHERE TO MOVE' : 'GET READY!', save.runs < 2 ? 'SHOOTING IS AUTOMATIC' : '', '#fff');
  save.runs++; persist();
  Sfx.song('main'); Sfx.setKey(0, 0);
  scene = 'play';
}

function applyUpg(u) { const l = G.lv[u.id] || 0; u.apply(l); G.lv[u.id] = l + 1; }

/* ---------- World building ---------- */
function buildFloor(bi) {
  const b = BIOMES[bi];
  const c = document.createElement('canvas'); c.width = ARENA; c.height = ARENA;
  const g = c.getContext('2d');
  floorCtx = g; FLOOR_LIGHTS = [];
  for (let y = 0; y < ARENA; y += 8) for (let x = 0; x < ARENA; x += 8) {
    g.fillStyle = b.base[(((x * 7) ^ (y * 13)) >> 3) % 3 === 0 ? 1 : Math.random() < 0.15 ? 2 : 0];
    g.fillRect(x, y, 8, 8);
  }
  g.fillStyle = b.speck;
  for (let i = 0; i < ARENA * ARENA / 40; i++) g.fillRect(rint(0, ARENA), rint(0, ARENA), 1, 1);
  for (let i = 0; i < 520; i++) {
    const x = rint(WALL, ARENA - WALL), y = rint(WALL, ARENA - WALL);
    const k = Math.random();
    if (b.style === 'grass') {
      if (k < 0.6) { g.fillStyle = b.deco[0]; g.fillRect(x, y, 1, 2); g.fillRect(x + 2, y - 1, 1, 3); g.fillRect(x + 4, y, 1, 2); }
      else if (k < 0.85) { g.fillStyle = pick([b.deco[1], b.deco[2], b.deco[3]]); g.fillRect(x, y - 1, 1, 1); g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y + 1, 1, 1); g.fillStyle = '#ffe9a8'; g.fillRect(x, y, 1, 1); }
      else { g.fillStyle = '#356a31'; g.fillRect(x, y, 3, 2); }
    } else if (b.style === 'stone' || b.style === 'void') {
      if (k < 0.45) { g.fillStyle = b.deco[3]; let cx = x, cy = y; for (let j = 0; j < 6; j++) { g.fillRect(cx, cy, 1, 1); cx += rint(-1, 1); cy += 1; } }
      else if (k < 0.8) { g.fillStyle = b.deco[0]; g.fillRect(x, y, 2, 2); g.fillStyle = b.deco[1]; g.fillRect(x, y, 1, 1); }
      else if (k < 0.92) { g.fillStyle = b.deco[2]; g.fillRect(x, y, 3, 1); g.fillRect(x + 1, y - 1, 1, 3); }
      else { g.fillStyle = b.deco[1]; g.fillRect(x, y, 1, 1); }
    } else if (b.style === 'lava') {
      if (k < 0.18) { if (Math.random() < 0.5) FLOOR_LIGHTS.push({ x: x + 4, y: y + 2, r: 18, col: '#ff6a2b' }); g.fillStyle = b.deco[0]; let cx = x, cy = y; for (let j = 0; j < 8; j++) { g.fillRect(cx, cy, 2, 1); cx += rint(-1, 2); cy += rint(0, 1); } g.fillStyle = b.deco[1]; g.fillRect(x + 1, y, 1, 1); }
      else if (k < 0.7) { g.fillStyle = b.deco[2]; g.fillRect(x, y, 2, 2); }
      else { g.fillStyle = b.deco[3]; g.fillRect(x, y, 1, 1); }
    } else {
      if (k < 0.5) { g.fillStyle = b.deco[0]; g.fillRect(x, y, 3, 1); g.fillRect(x + 1, y + 1, 2, 1); }
      else if (k < 0.8) { g.fillStyle = b.deco[1]; let cx = x, cy = y; for (let j = 0; j < 5; j++) { g.fillRect(cx, cy, 1, 1); cx += 1; cy += rint(-1, 1); } }
      else { g.fillStyle = b.deco[2]; g.fillRect(x, y, 1, 1); g.fillRect(x + 2, y + 1, 1, 1); }
    }
  }
  if (b.style === 'void' || b.style === 'ice') {
    for (let i = 0; i < 45; i++) {
      const x = rint(WALL + 10, ARENA - WALL - 10), y = rint(WALL + 10, ARENA - WALL - 10);
      const col = b.style === 'void' ? pick(['#7a4cff', '#5ef0ff', '#ff4cd2']) : '#bff4ff';
      g.fillStyle = shade(col, -0.4); g.fillRect(x - 1, y + 1, 3, 2);
      g.fillStyle = col; g.fillRect(x, y - 3, 1, 4); g.fillRect(x - 1, y - 1, 1, 2); g.fillRect(x + 1, y - 2, 1, 3);
      g.fillStyle = '#fff'; g.fillRect(x, y - 3, 1, 1);
      FLOOR_LIGHTS.push({ x, y: y - 1, r: b.style === 'void' ? 22 : 12, col });
    }
  }
  // walls
  g.fillStyle = b.wall;
  g.fillRect(0, 0, ARENA, WALL); g.fillRect(0, ARENA - WALL, ARENA, WALL);
  g.fillRect(0, 0, WALL, ARENA); g.fillRect(ARENA - WALL, 0, WALL, ARENA);
  g.fillStyle = b.wallHi;
  for (let x = 0; x < ARENA; x += 8) for (let y = 0; y < WALL; y += 5) {
    const o = (y / 5) % 2 ? 4 : 0;
    g.fillRect(x + o, y, 7, 1); g.fillRect(x + o, ARENA - WALL + y, 7, 1);
  }
  for (let y = 0; y < ARENA; y += 8) for (let x = 0; x < WALL; x += 5) {
    const o = (x / 5) % 2 ? 4 : 0;
    g.fillRect(x, y + o, 1, 7); g.fillRect(ARENA - WALL + x, y + o, 1, 7);
  }
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(WALL, WALL, ARENA - WALL * 2, 3);
  if (b.style === 'stone' || b.style === 'lava' || b.style === 'void') {
    for (let x = 60; x < ARENA - 40; x += 90) FLOOR_LIGHTS.push({ x, y: WALL - 3, r: 52, torch: true });
    for (let y = 70; y < ARENA - 40; y += 90) { FLOOR_LIGHTS.push({ x: WALL - 2, y, r: 52, torch: true }); FLOOR_LIGHTS.push({ x: ARENA - WALL + 1, y, r: 52, torch: true }); }
  }
  floorCv = c;
}
/* Permanent marks painted onto the floor: splats, scorches, debris. */
function decalPx(x, y, col, sz) {
  if (x < WALL || y < WALL || x > ARENA - WALL || y > ARENA - WALL) return;
  floorCtx.globalAlpha = 0.6; floorCtx.fillStyle = col; floorCtx.fillRect(Math.round(x), Math.round(y), sz, sz); floorCtx.globalAlpha = 1;
}
function splat(x, y, col, r, n = 12) {
  floorCtx.globalAlpha = 0.45; floorCtx.fillStyle = shade(col, -0.25);
  for (let i = 0; i < n; i++) { const a = rnd(TAU), d = rnd(r); const px = Math.round(x + Math.cos(a) * d), py = Math.round(y + Math.sin(a) * d * 0.6); if (px > WALL && py > WALL && px < ARENA - WALL && py < ARENA - WALL) floorCtx.fillRect(px, py, rint(1, 2), 1); }
  floorCtx.globalAlpha = 1;
}
function scorch(x, y, r) {
  floorCtx.globalAlpha = 0.2; floorCtx.fillStyle = '#000';
  r = Math.round(r); x = Math.round(x); y = Math.round(y);
  for (let dy = -r; dy <= r; dy++) { const dx = Math.floor(Math.sqrt(r * r - dy * dy) * rnd(0.8, 1)); floorCtx.fillRect(x - dx, y + Math.round(dy * 0.6), dx * 2 + 1, 1); }
  floorCtx.globalAlpha = 1;
}
function shatter(e) {
  const d = EN[e.type], f = SPR[d.spr][0], sc = e.scale || 1, flip = P.x < e.x;
  const px = f.px, n = px.length, step = Math.max(1, Math.ceil(n / (e.boss ? 140 : 45)));
  const gy = e.y + f.h * sc / 2 - 1;
  for (let i = 0; i < n; i += step) {
    if (G.parts.length > 650) break;
    const q = px[i];
    const lx = ((flip ? f.w - 1 - q[0] : q[0]) - f.w / 2) * sc;
    G.parts.push({ x: e.x + lx, y: gy + rnd(-2, 2), z: (f.h - q[1]) * sc - e.z, vx: lx * rnd(3, 7) + rnd(-15, 15) + e.kx * 0.3, vy: rnd(-25, 25) + e.ky * 0.3, vz: rnd(20, 90) * (e.boss ? 1.7 : 1), t: rnd(0.5, 1.0), col: q[2], sz: sc > 1 || step > 2 ? 2 : 1, stamp: Math.random() < 0.3 });
  }
}
function isPhased(e) { return e.type === 'ghost' && (e.t % 3.4) > 2.2; }
function placeRocks() {
  G.rocks = [];
  for (let i = 0; i < 12; i++) {
    for (let k = 0; k < 20; k++) {
      const x = rnd(WALL + 30, ARENA - WALL - 30), y = rnd(WALL + 30, ARENA - WALL - 30);
      if (Math.hypot(x - P.x, y - P.y) < 70) continue;
      if (G.rocks.some(r => Math.hypot(r.x - x, r.y - y) < 50)) continue;
      G.rocks.push({ x, y, r: 6 }); break;
    }
  }
}
function pushOutRocks(o) {
  for (const r of G.rocks) {
    const dx = o.x - r.x, dy = o.y - r.y, d = Math.hypot(dx, dy), m = r.r + o.r;
    if (d < m && d > 0.01) { o.x = r.x + dx / d * m; o.y = r.y + dy / d * m; }
  }
}
function clampArena(o) {
  o.x = clamp(o.x, WALL + o.r, ARENA - WALL - o.r);
  o.y = clamp(o.y, WALL + o.r + 2, ARENA - WALL - o.r);
}

/* ---------- FX helpers ---------- */
function burst(x, y, cols, n, sp = 60, life = 0.5) {
  if (G.parts.length > 450) n = Math.min(n, 3);
  for (let i = 0; i < n; i++) {
    const a = rnd(TAU), v = rnd(sp * 0.3, sp);
    G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: rnd(life * 0.5, life), col: Array.isArray(cols) ? pick(cols) : cols, sz: Math.random() < 0.3 ? 2 : 1 });
  }
}
function floater(x, y, txt, col = '#fff', big = false, crit = false) {
  if (G.floats.length > 45) G.floats.shift();
  G.floats.push({ x: x + rnd(-3, 3), y, txt: String(txt), col, t: big ? 1.1 : 0.6, big, crit });
}
function banner(title, sub = '', sub2 = '', col = '#fff', time = 2.4) { G.banner = { title, sub, sub2, col, t: time, max: time }; }
function addShake(v) { G.shake = Math.max(G.shake, v); }

/* ---------- Spawning ---------- */
function pool() {
  const w = G.wave;
  const p = { slime: 10 };
  if (w >= 2) p.bat = 6;
  if (w >= 3) p.peeper = 3;
  if (w >= 4) p.bomber = 3;
  if (w >= 6) p.splitter = 3;
  if (w >= 7) p.golem = 1.5 + w * 0.05;
  if (w >= 5) p.charger = 2;
  if (w >= 6) p.shroom = 1.5;
  if (w >= 8) p.ghost = 2.5;
  if (G.mod.w) for (const k in G.mod.w) p[k] = (p[k] || 0) + G.mod.w[k];
  return Object.entries(p);
}
function spawnPos(extra = 16) {
  const R = Math.hypot(GW, GH) / 2 + extra;
  let best = null;
  for (let i = 0; i < 10; i++) {
    const a = rnd(TAU);
    const x = clamp(P.x + Math.cos(a) * R, WALL + 10, ARENA - WALL - 10);
    const y = clamp(P.y + Math.sin(a) * R, WALL + 10, ARENA - WALL - 10);
    const d = Math.hypot(x - P.x, y - P.y);
    if (!best || d > best.d) best = { x, y, d };
    if (d > 90) break;
  }
  return best;
}
function spawnEnemy(type, x, y, opts = {}) {
  const d = EN[type];
  const elite = !!opts.elite;
  const hp = d.hp * G.hpMul * (elite ? 7 : 1);
  const e = {
    type, x, y, kx: 0, ky: 0, r: d.r * (elite ? 2 : 1), hp, maxHp: hp,
    speed: d.speed * (elite ? 0.85 : 1) * rnd(0.9, 1.1) * (1 + Math.min(0.4, G.wave * 0.015)),
    t: rnd(10), flash: 0, elite, scale: (d.scale || 1) * (elite ? 2 : 1), spawnT: opts.instant ? 0 : 0.3,
    cd: rnd(1.5, 3), orbCd: 0, boomCd: 0, slow: 0, fuse: 0, dir: Math.random() < 0.5 ? 1 : -1, z: 0, cst: 'chase', aim: 0, ang: 0, life: 0,
  };
  G.enemies.push(e);
  return e;
}
function spawnTick(dt) {
  G.spawnT -= dt;
  if (G.spawnT > 0) return;
  const base = Math.max(0.18, 1.1 - G.wave * 0.07) * (G.mod.spawnMul || 1) * (G.boss ? 2.4 : 1);
  G.spawnT = base * rnd(0.7, 1.3);
  if (G.enemies.length >= MAX_EN) return;
  const n = 1 + Math.floor(Math.random() * (1.4 + G.wave / 3));
  const type = wpick(pool());
  const pos = spawnPos();
  const eliteCh = G.wave >= 3 ? (G.mod.giant ? 0.2 : 0.035) : 0;
  for (let i = 0; i < n; i++) {
    const canElite = i === 0 && !['splitter', 'golem', 'mini', 'shroom', 'charger'].includes(type);
    spawnEnemy(type, pos.x + rnd(-12, 12), pos.y + rnd(-12, 12), { elite: canElite && Math.random() < eliteCh });
  }
}
function waveEvent() {
  const k = pick(['ring', 'ring', 'stampede', 'elite']);
  if (k === 'ring') {
    const n = 12 + G.wave * 1.5 | 0, type = G.wave >= 4 && Math.random() < 0.5 ? 'bat' : 'slime';
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU;
      const x = clamp(P.x + Math.cos(a) * 95, WALL + 8, ARENA - WALL - 8), y = clamp(P.y + Math.sin(a) * 95, WALL + 8, ARENA - WALL - 8);
      spawnEnemy(type, x, y);
      burst(x, y, '#fff', 2, 20);
    }
    floater(P.x, P.y - 22, 'SURROUNDED!', '#ff7a7a', true);
  } else if (k === 'stampede') {
    const p = spawnPos(0);
    for (let i = 0; i < 10 + G.wave; i++) spawnEnemy('bat', p.x + rnd(-20, 20), p.y + rnd(-20, 20));
    floater(P.x, P.y - 22, 'STAMPEDE!', '#c79bff', true);
  } else {
    const p = spawnPos();
    spawnEnemy(pick(['slime', 'bat', 'peeper', 'bomber']), p.x, p.y, { elite: true });
    floater(P.x, P.y - 22, 'ELITE INCOMING!', '#ffd23f', true);
  }
}
function nextWave() {
  G.wave++; G.waveT = 0; G.eventDone = false;
  G.hpMul = 1 + (G.wave - 1) * 0.15 + Math.max(0, G.wave - 6) * 0.15 + Math.max(0, G.wave - 12) * 0.2;
  if (G.newBiome) {
    G.newBiome = false;
    G.biome = (G.biome + 1) % BIOMES.length;
    buildFloor(G.biome); placeRocks(); G.amb.length = 0;
    G.flash = 0.5; G.flashCol = '#fff';
    Sfx.setKey(BIOMES[G.biome].key, BIOMES[G.biome].bpm);
  }
  Sfx.wave(); mission('wave', G.wave);
  if (G.wave >= 3 && G.wave % 5 !== 0 && Math.random() < 0.35) G.thiefT = rnd(5, 14);
  if (G.wave % 5 === 0) { G.mod = MOD_NONE; spawnBoss(); return; }
  G.mod = Math.random() < 0.75 ? pick(MODS) : MOD_NONE;
  const zone = G.wave % 5 === 1 && G.wave > 1 ? 'NEW ZONE: ' + BIOMES[G.biome].name : '';
  if (G.mod.name) banner('WAVE ' + G.wave, G.mod.name, zone || G.mod.sub, G.mod.col);
  else banner('WAVE ' + G.wave, zone || pick(['HERE THEY COME', 'KEEP MOVING', 'YOU GOT THIS', 'STAY PAWSITIVE', 'NO BRAKES!']), '', '#fff');
}
function spawnBoss() {
  const kind = ['king', 'eye', 'queen'][G.bossIdx % 3];
  const hp = 1300 * Math.pow(1.9, G.bossIdx) * (1 + Math.floor(G.bossIdx / 2) * 0.3);
  const y = P.y - 110 > WALL + 30 ? P.y - 110 : P.y + 110;
  const b = spawnEnemy(kind, clamp(P.x, WALL + 30, ARENA - WALL - 30), y, {});
  b.boss = true; b.hp = b.maxHp = hp; b.r = 13; b.st = kind === 'king' ? 'walk' : 'idle'; b.stT = 1.6;
  b.name = { king: 'KING GLOOP', eye: 'THE WATCHER', queen: 'BAT QUEEN' }[kind];
  G.letterbox = 2.6;
  G.boss = b;
  banner('BOSS!', b.name, 'DEFEAT IT TO MOVE ON', '#ff4d6d', 2.8);
  Sfx.boss(); Sfx.song('boss'); addShake(5); vib([60, 40, 60]);
}

/* ---------- Combat ---------- */
function spawnThief() {
  const p = spawnPos(-30);
  const e = spawnEnemy('thief', p.x, p.y, { instant: true });
  e.life = 13;
  floater(P.x, P.y - 22, 'A THIEF! CATCH IT!', '#ffd23f', true);
  Sfx.thief();
}
function announce(n) {
  const tiers = [[35, 'RAMPAGE!!!', '#ff4cd2', 3], [20, 'ULTRA KILL!!', '#ff4d6d', 2], [12, 'MEGA KILL!', '#ff8c2e', 1], [6, 'MULTI KILL!', '#ffd23f', 0]];
  const t = tiers.find(x => n >= x[0]);
  const bonus = Math.floor(n / 4);
  G.coins += bonus;
  G.announce = { txt: t[1], col: t[2], sub: n + ' KILLS  +' + bonus + ' COINS', t: 1.6, max: 1.6, tier: t[3] };
  Sfx.announce(t[3]); addShake(3 + t[3]);
  mission('multi', n);
}
function levelBlast() {
  G.pillar = 0.6;
  G.rings.push({ x: P.x, y: P.y, r: 4, vr: 300, t: 0.35, max: 0.35, col: '#ffd23f' });
  G.rings.push({ x: P.x, y: P.y, r: 2, vr: 200, t: 0.3, max: 0.3, col: '#fff' });
  burst(P.x, P.y, ['#ffd23f', '#fff7b0', '#fff'], 30, 130, 0.7);
  for (const e of G.enemies) {
    if (e.boss || e.dead) continue;
    const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy) || 1;
    if (d < 80) { e.kx += dx / d * 260; e.ky += dy / d * 260; hitEnemy(e, st.dmg * st.dmgMul, 0, 0, false, true); }
  }
  Sfx.blast(); addShake(4);
}
function evolveFx(w) {
  G.flash = 0.5; G.flashCol = '#fff'; G.slowT = 0.5;
  banner('EVOLVED!', EVOS[w][0], EVOS[w][1], '#ff4cd2', 2.8);
  for (let i = 0; i < 4; i++) G.rings.push({ x: P.x, y: P.y, r: 2 + i * 6, vr: 220, t: 0.5, max: 0.5, col: ['#ff4cd2', '#ffd23f', '#5ef0ff', '#5ed15a'][i] });
  burst(P.x, P.y, ['#ff4cd2', '#ffd23f', '#5ef0ff', '#5ed15a', '#fff'], 60, 160, 0.9);
  Sfx.evolve(); vib([50, 30, 50, 30, 120]); mission('evo', 1);
}
function ebullet(x, y, a, sp) { G.ebullets.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 2, t: 0 }); }

function hitEnemy(e, dmg, kx = 0, ky = 0, crit = false, quiet = false) {
  if (e.dead || isPhased(e)) return;
  e.hp -= dmg; e.flash = 0.08;
  const kb = e.boss ? 0 : e.heavy ? 0.25 : e.elite ? 0.4 : 1;
  e.kx += kx * kb; e.ky += ky * kb;
  if (!quiet || Math.random() < 0.35) floater(e.x, e.y - e.r - 4, Math.round(dmg) + (crit ? '!' : ''), crit ? '#ffd23f' : '#fff', false, crit);
  Sfx.hit();
  if (e.hp <= 0) killEnemy(e);
}
function dropGem(x, y, v) {
  if (G.gems.length > 220) { const g = pick(G.gems); g.v += v; return; }
  const a = rnd(TAU), s = rnd(10, 40);
  G.gems.push({ x, y, v, vx: Math.cos(a) * s, vy: Math.sin(a) * s, pull: false, sp: 0, t: rnd(10) });
}
function dropPickup(kind, x, y, extra = {}) {
  const a = rnd(TAU), s = rnd(20, 60);
  G.pickups.push(Object.assign({ kind, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: rnd(10), pull: false, sp: 0, life: kind === 'coin' ? 30 : 40 }, extra));
}
function killEnemy(e, noDrop = false) {
  if (e.dead) return;
  e.dead = true;
  const d = EN[e.type];
  burst(e.x, e.y - e.z, d.col, e.boss ? 60 : e.elite ? 26 : 5, e.elite ? 90 : 60);
  shatter(e);
  splat(e.x, e.y + e.r, d.col[0], e.r * 1.8 + 3, e.boss ? 60 : 12);
  G.rings.push({ x: e.x, y: e.y, r: 2, vr: 70, t: 0.18, max: 0.18, col: '#fff' });
  if (e.boss) { bossDefeated(e); return; }
  G.kills++; G.combo++; G.comboT = 2.4; G.mk++; G.mkT = 0.45;
  mission('kill', 1, e.type); mission('combo', G.combo);
  if (G.combo > G.bestCombo) G.bestCombo = G.combo;
  if (G.combo >= G.feverNext) {
    G.fever = 6; G.feverNext = G.combo + 40;
    floater(P.x, P.y - 20, 'FEVER MODE!', '#ff4cd2', true);
    Sfx.fever(); G.flash = 0.15; G.flashCol = '#ff4cd2'; vib(40);
  }
  G.score += Math.round(d.score * (1 + G.combo * 0.05) * (1 + G.wave * 0.1));
  if (!noDrop) {
    const xpv = d.xp * (G.mod.xp2 ? 2 : 1) * (e.elite ? 10 : 1) * (1 + Math.floor(G.wave / 8));
    if (xpv > 0) dropGem(e.x, e.y, xpv);
    if (G.mod.gold || e.elite || Math.random() < 0.045) dropPickup('coin', e.x, e.y, { v: e.elite ? rint(5, 8) : 1 });
    if (e.elite) dropPickup('chest', e.x, e.y, { big: false });
    if (e.type === 'thief') {
      for (let i = 0; i < 20; i++) dropPickup('coin', e.x, e.y, { v: 1 });
      dropPickup('chest', e.x, e.y, { big: false });
      floater(e.x, e.y - 14, 'JACKPOT!', '#ffd23f', true); Sfx.chest(); mission('thief', 1);
    }
    const r = Math.random(), hurt = P.hp < st.maxHp;
    if (r < (hurt ? 0.012 : 0.004)) dropPickup('heart', e.x, e.y);
    else if (r < 0.018) dropPickup('magnet', e.x, e.y);
    else if (r < 0.022) dropPickup('bomb', e.x, e.y);
    else if (r < 0.026) dropPickup('freeze', e.x, e.y);
    else if (r < 0.030 && !P.shield) dropPickup('shield', e.x, e.y);
  }
  if (e.type === 'splitter') for (let i = 0; i < 3; i++) { const m = spawnEnemy('mini', e.x + rnd(-6, 6), e.y + rnd(-6, 6), { instant: true }); const a = i / 3 * TAU; m.kx = Math.cos(a) * 80; m.ky = Math.sin(a) * 80; }
  if (e.type === 'bomber' && !e.exploded) { e.exploded = true; explode(e.x, e.y, 26, st.dmg * st.dmgMul * 4, false); }
  Sfx.kill();
  addShake(e.elite ? 4 : 1.2);
}
function explode(x, y, r, dmg, hurtsPlayer) {
  G.rings.push({ x, y, r: 3, vr: r * 7, t: 0.22, max: 0.22, col: '#ffb13b', fill: true, maxR: r });
  burst(x, y, ['#ffb13b', '#ff6a2b', '#ffd23f', '#fff'], 18, 110, 0.5);
  for (let i = 0; i < 8; i++) G.parts.push({ x, y, z: 2, vx: rnd(-60, 60), vy: rnd(-40, 40), vz: rnd(60, 140), t: rnd(0.5, 0.9), col: pick(['#3b3a52', '#24233a', '#ff8c2e']), sz: 2 });
  scorch(x, y, r * 0.7);
  addShake(5); Sfx.boom();
  if (hurtsPlayer && Math.hypot(P.x - x, P.y - y) < r + P.r) hurtPlayer();
  for (const e of G.enemies) {
    if (e.dead) continue;
    const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy) || 1;
    if (d < r + e.r) hitEnemy(e, dmg, dx / d * 140, dy / d * 140);
  }
}
function hurtPlayer() {
  if (P.inv > 0 || P.dashT > 0 || G.dying > 0) return;
  if (P.shield) {
    P.shield = false; P.inv = 1.0; G.hitstop = 0.05; addShake(4);
    G.rings.push({ x: P.x, y: P.y, r: 6, vr: 200, t: 0.3, max: 0.3, col: '#7ae8ff' });
    burst(P.x, P.y, ['#7ae8ff', '#d4fbff', '#fff'], 20, 100);
    floater(P.x, P.y - 14, 'BLOCKED!', '#7ae8ff', true); Sfx.shieldBreak();
    return;
  }
  P.hp--; P.inv = 1.1;
  addShake(6); G.hitstop = 0.08; G.hurtFx = 0.4;
  Sfx.hurt(); vib(90);
  burst(P.x, P.y, ['#ff4d6d', '#fff'], 14, 80);
  if (G.combo >= 10) floater(P.x, P.y - 14, 'COMBO LOST', '#ff7a7a');
  G.combo = 0; G.feverNext = 30;
  for (const e of G.enemies) {
    const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy) || 1;
    if (d < 45 && !e.boss) { e.kx += dx / d * 180; e.ky += dy / d * 180; }
  }
  if (P.hp <= 0) { P.hp = 0; G.dying = 1.8; G.slowT = 1.8; Sfx.die(); Sfx.song('menu'); }
}
function bossDefeated(b) {
  G.boss = null; G.bossIdx++; mission('boss', 1);
  G.slowT = 1.2; G.flash = 0.4; G.flashCol = '#fff'; addShake(10); vib([80, 50, 120]);
  G.bossBoom = { x: b.x, y: b.y, t: 1.2, k: 0 };
  G.kills++; G.score += Math.round(EN[b.type].score * (1 + G.bossIdx));
  dropPickup('chest', b.x, b.y, { big: true, vx: 0, vy: 0 });
  for (let i = 0; i < 18; i++) dropPickup('coin', b.x, b.y, { v: 2 });
  for (let i = 0; i < 14; i++) dropGem(b.x + rnd(-10, 10), b.y + rnd(-10, 10), 6 + G.bossIdx * 4);
  for (const e of G.enemies) if (!e.dead && e !== b) killEnemy(e);
  G.ebullets.length = 0;
  floater(b.x, b.y - 30, 'BOSS DEFEATED!', '#ffd23f', true);
  G.waveT = G.waveLen - 3.5; G.newBiome = true;
  Sfx.boom(); Sfx.chest(); Sfx.song('main');
}
function nearestEnemy(x, y, range) {
  let best = null, bd = range * range;
  for (const e of G.enemies) {
    if (e.dead || e.spawnT > 0.15 || isPhased(e)) continue;
    const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

/* ---------- Spatial grid ---------- */
function gridBuild() {
  for (const c of grid) c.length = 0;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const cx = clamp(e.x / CELL | 0, 0, GRID_N - 1), cy = clamp(e.y / CELL | 0, 0, GRID_N - 1);
    grid[cy * GRID_N + cx].push(e);
  }
}
function query(x, y, r, cb) {
  const x0 = clamp((x - r) / CELL | 0, 0, GRID_N - 1), x1 = clamp((x + r) / CELL | 0, 0, GRID_N - 1);
  const y0 = clamp((y - r) / CELL | 0, 0, GRID_N - 1), y1 = clamp((y + r) / CELL | 0, 0, GRID_N - 1);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const c = grid[cy * GRID_N + cx];
    for (let i = 0; i < c.length; i++) cb(c[i]);
  }
}

/* ---------- Input ---------- */
const keys = {};
const input = { dash: false };
const joy = { active: false, id: -1, x0: 0, y0: 0, x: 0, y: 0 };
const UI = { list: [], down: null, downId: -1 };
let usingTouch = false;

function toGame(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / S, y: (e.clientY - r.top) / S }; }
function hitBtn(p) {
  for (let i = UI.list.length - 1; i >= 0; i--) {
    const b = UI.list[i];
    if (p.x >= b.x - 2 && p.x <= b.x + b.w + 2 && p.y >= b.y - 2 && p.y <= b.y + b.h + 2) return b;
  }
  return null;
}
function dashBtnPos() { return { x: GW - SAFE.r - 26, y: GH - SAFE.b - 28, r: 16 }; }

cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  Sfx.init();
  if (e.pointerType === 'touch') usingTouch = true;
  try { cv.setPointerCapture(e.pointerId); } catch (_) { }
  const p = toGame(e);
  const b = hitBtn(p);
  if (b && b.enabled !== false) { UI.down = b.id; UI.downId = e.pointerId; return; }
  if (scene === 'play' && G.dying <= 0) {
    const d = dashBtnPos();
    if (usingTouch && Math.hypot(p.x - d.x, p.y - d.y) < d.r + 10) { input.dash = true; return; }
    if (!joy.active) Object.assign(joy, { active: true, id: e.pointerId, x0: p.x, y0: p.y, x: p.x, y: p.y });
  }
}, { passive: false });
cv.addEventListener('pointermove', e => {
  if (joy.active && e.pointerId === joy.id) {
    const p = toGame(e);
    joy.x = p.x; joy.y = p.y;
    const dx = joy.x - joy.x0, dy = joy.y - joy.y0, d = Math.hypot(dx, dy), R = 22;
    if (d > R) { joy.x0 = joy.x - dx / d * R; joy.y0 = joy.y - dy / d * R; }
  }
}, { passive: false });
function pointerEnd(e) {
  if (joy.active && e.pointerId === joy.id) joy.active = false;
  if (UI.down && e.pointerId === UI.downId) {
    const id = UI.down; UI.down = null;
    if (e.type === 'pointercancel') return;
    const b = hitBtn(toGame(e));
    if (b && b.id === id && b.enabled !== false) { b.onClick(); }
  }
}
cv.addEventListener('pointerup', pointerEnd);
cv.addEventListener('pointercancel', pointerEnd);
cv.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('keydown', e => {
  Sfx.init();
  keys[e.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (scene === 'play') {
    if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.dash = true;
    if (e.code === 'Escape' || e.code === 'KeyP') pauseGame();
  } else if (scene === 'pause') {
    if (e.code === 'Escape' || e.code === 'KeyP' || e.code === 'Enter') resumeGame();
  } else if (scene === 'levelup') {
    const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
    if (i >= 0 && G.choices && G.choices[i] && G.lvT > 0.4) chooseUpg(i);
    if (e.code === 'KeyR') doReroll();
  } else if (scene === 'menu') {
    if (e.code === 'Enter' || e.code === 'Space') tryPlay();
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') cycleChar(-1);
    if (e.code === 'ArrowRight' || e.code === 'KeyD') cycleChar(1);
  } else if (scene === 'over') {
    if ((e.code === 'Enter' || e.code === 'Space') && overT > 0.8) newRun();
  } else if (scene === 'shop' || scene === 'missions') {
    if (e.code === 'Escape') scene = 'menu';
  }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; joy.active = false; if (scene === 'play') pauseGame(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (scene === 'play') pauseGame(); Sfx.suspend(); }
  else Sfx.resume();
});

/* ---------- Scene transitions ---------- */
let overT = 0, overInfo = null;
function pauseGame() { if (scene === 'play' && G.dying <= 0) { persist(); scene = 'pause'; joy.active = false; G.shake = 0; } }
function resumeGame() { scene = 'play'; joy.active = false; lastT = performance.now(); }
function tryPlay() {
  if (!save.unlocked[save.sel]) { Sfx.nope(); return; }
  Sfx.select(); newRun();
}
function cycleChar(d) {
  const i = CHAR_ORDER.indexOf(save.sel);
  save.sel = CHAR_ORDER[(i + d + CHAR_ORDER.length) % CHAR_ORDER.length];
  persist(); Sfx.select();
}
function gameOver() {
  const greed = 1 + 0.2 * (save.shop.greed || 0);
  const bonus = G.wave * 4 + G.bossIdx * 25;
  const earned = Math.round((G.coins + bonus) * greed);
  const newBestWave = G.wave > save.bestWave, newBestScore = G.score > save.bestScore;
  save.coins += earned;
  const mlist = [];
  for (const m of save.missions) if (m.done) { mlist.push({ txt: MISSION_POOL[m.i].txt(m.n), r: m.r }); save.coins += m.r; save.mDone++; }
  save.missions = save.missions.filter(m => !m.done); ensureMissions();
  if (newBestWave) save.bestWave = G.wave;
  if (newBestScore) save.bestScore = G.score;
  persist();
  overInfo = { earned, newBestWave, newBestScore, title: pick(DEATH_TITLES), tip: pick(TIPS), missions: mlist };
  overT = 0;
  scene = 'over';
  joy.active = false;
}
function openLevelUp() {
  scene = 'levelup'; G.shake = 0;
  G.choices = rollChoices(); G.lvT = 0;
  joy.active = false; UI.down = null;
  Sfx.levelup(); vib(30);
}
function rollChoices() {
  const avail = UPGS.filter(u => (G.lv[u.id] || 0) < u.max);
  const weighted = avail.map(u => [u, u.weapon ? ((G.lv[u.id] || 0) > 0 ? 1.5 : 1.25) : 1]);
  const out = [];
  while (out.length < 3 && weighted.length) {
    const u = wpick(weighted);
    out.push(u);
    weighted.splice(weighted.findIndex(w => w[0] === u), 1);
  }
  if (out.length < 3) out.push(SNACK);
  if (out.length < 3) out.push(COINBAG);
  const evos = Object.keys(EVOS).filter(w => st.w[w] >= 5 && !st.evo[w]);
  if (evos.length && Math.random() < 0.75) out[0] = EVO_UPG[pick(evos)];
  return out.map(u => ({ u, rare: !u.filler && !u.evo && Math.random() < 0.12 && (G.lv[u.id] || 0) + 2 <= u.max }));
}
function chooseUpg(i) {
  const c = G.choices[i];
  applyUpg(c.u); if (c.rare) applyUpg(c.u);
  Sfx.select();
  burst(P.x, P.y, [c.u.col, '#fff'], 24, 90);
  floater(P.x, P.y - 16, c.u.name + (c.rare ? ' X2' : ''), c.u.col, true);
  G.pendingLv--;
  if (G.pendingLv > 0) { G.choices = rollChoices(); G.lvT = 0.2; Sfx.levelup(); }
  else { scene = 'play'; P.inv = Math.max(P.inv, 0.6); G.choices = null; lastT = performance.now(); levelBlast(); }
}
function doReroll() {
  if (G.rerolls <= 0) { Sfx.nope(); return; }
  G.rerolls--; G.choices = rollChoices(); G.lvT = 0.25; Sfx.select();
}

/* ---------- Update ---------- */
function updateGame(rdt) {
  if (G.hitstop > 0) { G.hitstop -= rdt; return; }
  let dt = rdt;
  if (G.slowT > 0) { G.slowT -= rdt; dt *= 0.3; }
  G.t += dt;
  if (G.dying > 0) {
    G.dying -= rdt;
    updateFx(dt);
    if (G.dying <= 0) gameOver();
    return;
  }
  if (!G.boss) G.waveT += dt;
  if (G.waveT >= G.waveLen) nextWave();
  if (!G.eventDone && G.waveT > G.waveLen * 0.5 && G.wave >= 2 && !G.boss) { G.eventDone = true; waveEvent(); }
  spawnTick(dt);
  G.chestT -= dt;
  if (G.chestT <= 0) { G.chestT = rnd(32, 46); const p = spawnPos(-10); G.pickups.push({ kind: 'chest', x: p.x, y: p.y, vx: 0, vy: 0, t: 0, big: false, life: 999 }); }
  if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) { G.combo = 0; G.feverNext = 30; } }
  if (G.fever > 0) G.fever -= dt;
  if (G.freeze > 0) G.freeze -= dt;
  if (G.mkT > 0) { G.mkT -= dt; if (G.mkT <= 0) { if (G.mk >= 6) announce(G.mk); G.mk = 0; } }
  if (G.thiefT > 0) { G.thiefT -= dt; if (G.thiefT <= 0 && !G.boss) spawnThief(); }
  if (P.hp === 1) { G.hbT -= dt; if (G.hbT <= 0) { G.hbT = 1.1; Sfx.heartbeat(); } }
  if (G.bossBoom) {
    const bb = G.bossBoom; bb.t -= rdt; bb.k -= rdt;
    if (bb.k <= 0) { bb.k = 0.12; const x = bb.x + rnd(-16, 16), y = bb.y + rnd(-16, 16); G.rings.push({ x, y, r: 2, vr: 120, t: 0.2, max: 0.2, col: '#ffd23f', fill: true, maxR: 14 }); burst(x, y, ['#ffd23f', '#fff', '#ff8c2e'], 10, 100); Sfx.boom(); addShake(4); }
    if (bb.t <= 0) G.bossBoom = null;
  }
  updatePlayer(dt);
  gridBuild();
  updateEnemies(dt);
  gridBuild();
  updateWeapons(dt);
  updateBullets(dt);
  updateMissiles(dt);
  updateBeams(dt);
  updateEBullets(dt);
  updatePickups(dt);
  updateFx(dt);
  G.enemies = G.enemies.filter(e => !e.dead);
  if (G.pendingLv > 0 && G.dying <= 0 && scene === 'play') openLevelUp();
}

function updatePlayer(dt) {
  let ix = 0, iy = 0;
  if (joy.active) {
    const dx = joy.x - joy.x0, dy = joy.y - joy.y0, l = Math.hypot(dx, dy);
    if (l > 2) { const m = Math.min(1, l / 13); ix = dx / l * m; iy = dy / l * m; }
  }
  const kx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  const ky = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
  if (kx || ky) { const l = Math.hypot(kx, ky); ix = kx / l; iy = ky / l; }
  const mag = Math.hypot(ix, iy);
  P.moving = mag > 0.05;
  if (P.moving) { P.dx = ix / mag; P.dy = iy / mag; if (Math.abs(ix) > 0.1) P.face = ix > 0 ? 1 : -1; }
  P.dashCd -= dt;
  if (input.dash) {
    input.dash = false;
    if (P.dashCd <= 0) {
      P.dashT = 0.17; P.dashCd = st.dashCd; P.ddx = P.dx; P.ddy = P.dy; P.dashHit = new Set();
      Sfx.dash(); burst(P.x, P.y + 4, '#fff', 6, 40, 0.3);
    }
  }
  const sp = st.speed * st.speedMul * (G.fever > 0 ? 1.2 : 1) * (G.mod.fast ? 1.2 : 1);
  let vx, vy;
  if (P.dashT > 0) {
    P.dashT -= dt; vx = P.ddx * sp * 3.6; vy = P.ddy * sp * 3.6;
    if (G.t - P.lastGhost > 0.02) { P.lastGhost = G.t; G.ghosts.push({ x: P.x, y: P.y, t: 0.22, f: Math.floor(P.anim) % 2, flip: P.face < 0 }); }
  } else { vx = ix * sp; vy = iy * sp; }
  P.x += vx * dt; P.y += vy * dt;
  clampArena(P); pushOutRocks(P);
  P.inv -= dt;
  P.anim += dt * (P.moving ? 9 : 2);
  if (st.regen) {
    P.regenT += dt;
    if (P.regenT >= st.regen) { P.regenT = 0; if (P.hp < st.maxHp) { P.hp++; floater(P.x, P.y - 12, '+1 HP', '#5ed15a'); } }
  }
  if (G.fever > 0 && Math.random() < 0.5) G.parts.push({ x: P.x + rnd(-3, 3), y: P.y + 5, vx: 0, vy: -10, t: 0.4, col: `hsl(${(G.t * 400) % 360},100%,65%)`, sz: 1 });
}

function updateEnemies(dt) {
  const fastMul = G.mod.fast ? 1.35 : 1;
  for (const e of G.enemies) {
    if (e.dead) continue;
    if (G.freeze > 0 && e.type !== 'thief') { e.flash -= dt; continue; }
    e.t += dt; e.flash -= dt; e.spawnT -= dt; e.orbCd -= dt; e.boomCd -= dt; e.slow -= dt; e.dashCd = (e.dashCd || 0) - dt;
    const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
    if (e.boss) { bossUpdate(e, dt, dx, dy, d); }
    else {
      let mx = nx, my = ny;
      let sp = e.speed * (e.slow > 0 ? 0.55 : 1) * fastMul;
      if (e.type === 'bat') { const w = Math.sin(e.t * 5) * 0.9; mx = nx - ny * w; my = ny + nx * w; }
      else if (e.type === 'peeper') {
        if (d < 55) { mx = -nx; my = -ny; } else if (d < 85) { mx = -ny * e.dir * 0.7; my = nx * e.dir * 0.7; }
        e.cd -= dt;
        if (e.cd <= 0 && d < 170 && e.spawnT <= 0) { ebullet(e.x, e.y, Math.atan2(dy, dx), 72); Sfx.eshoot(); e.cd = rnd(2.2, 3.4); if (e.elite) { ebullet(e.x, e.y, Math.atan2(dy, dx) + 0.3, 72); ebullet(e.x, e.y, Math.atan2(dy, dx) - 0.3, 72); } }
      } else if (e.type === 'bomber') {
        if (e.fuse > 0) {
          mx = my = 0; e.fuse -= dt;
          if (e.fuse <= 0) { e.exploded = true; explode(e.x, e.y, e.elite ? 40 : 26, st.dmg * st.dmgMul * 4, true); killEnemy(e); continue; }
        } else if (d < 18 + e.r) { e.fuse = 0.75; Sfx.fuse(); }
      } else if (e.type === 'charger') {
        e.cd -= dt;
        if (e.cst === 'chase') { if (d < 95 && e.cd <= 0 && e.spawnT <= 0) { e.cst = 'aim'; e.aim = 0.7; Sfx.charge(); } }
        else if (e.cst === 'aim') { mx = my = 0; e.aim -= dt; if (e.aim > 0.15) e.ang = Math.atan2(dy, dx); if (e.aim <= 0) { e.cst = 'charge'; e.aim = 0.55; } }
        else {
          mx = Math.cos(e.ang); my = Math.sin(e.ang); sp = 175 * fastMul; e.aim -= dt;
          if (Math.random() < 0.7) G.parts.push({ x: e.x + rnd(-3, 3), y: e.y + 4, vx: -mx * 20, vy: -my * 20 - 8, t: 0.4, col: pick(['#c9b78a', '#9a8a6a']), sz: 2 });
          if (e.aim <= 0) { e.cst = 'chase'; e.cd = rnd(1.4, 2.2); }
        }
      } else if (e.type === 'ghost') { const w = Math.sin(e.t * 2.5) * 0.6; mx = nx - ny * w; my = ny + nx * w; }
      else if (e.type === 'shroom') {
        e.cd -= dt;
        if (e.cd <= 0 && d < 160 && e.spawnT <= 0) {
          const n = e.elite ? 12 : 8, off = (e.alt = !e.alt) ? 0 : TAU / 16;
          for (let k = 0; k < n; k++) ebullet(e.x, e.y - 2, off + k * TAU / n, 42);
          burst(e.x, e.y - 3, ['#ff6a8a', '#ffc2e2'], 6, 40); e.cd = rnd(2.6, 3.4); Sfx.eshoot();
        }
      } else if (e.type === 'thief') {
        const w = Math.sin(e.t * 3) * 0.8; mx = -nx - ny * w; my = -ny + nx * w;
        if (d > 150) { mx *= 0.3; my *= 0.3; }
        e.life -= dt;
        if (Math.random() < 0.3) G.parts.push({ x: e.x + rnd(-4, 4), y: e.y + rnd(-4, 4), vx: 0, vy: -12, t: 0.5, col: '#fff7b0', sz: 1 });
        if (e.life <= 0) { e.dead = true; burst(e.x, e.y, ['#ffd23f', '#fff'], 14, 60); floater(e.x, e.y - 12, 'ESCAPED!', '#9a96b0', true); Sfx.nope(); continue; }
      }
      e.x += (mx * sp + e.kx) * dt; e.y += (my * sp + e.ky) * dt;
    }
    const decay = Math.min(1, dt * 7);
    e.kx -= e.kx * decay; e.ky -= e.ky * decay;
    // separation
    if (!e.boss) {
      query(e.x, e.y, e.r * 2, o => {
        if (o === e || o.dead) return;
        const ox = e.x - o.x, oy = e.y - o.y, dd = ox * ox + oy * oy, m = e.r + o.r;
        if (dd < m * m && dd > 0.0001) { const dl = Math.sqrt(dd), push = (m - dl) * 0.5; e.x += ox / dl * push; e.y += oy / dl * push; }
      });
      if (e.type !== 'ghost') pushOutRocks(e);
    }
    clampArena(e);
    // contact
    if (e.spawnT <= 0 && e.z < 8 && e.type !== 'thief' && !isPhased(e)) {
      const cd = Math.hypot(P.x - e.x, P.y - e.y);
      if (P.dashT > 0 && st.dashDmg && P.dashHit && !P.dashHit.has(e) && cd < e.r + P.r + 4) {
        P.dashHit.add(e); hitEnemy(e, st.dmg * st.dmgMul * 3, -nx * 160, -ny * 160); addShake(2);
      } else if (cd < e.r + P.r - 1) hurtPlayer();
    }
  }
}

function bossUpdate(e, dt, dx, dy, d) {
  e.stT -= dt;
  const rage = e.hp < e.maxHp * 0.5;
  if (e.type === 'king') {
    if (e.st === 'walk') {
      e.x += dx / d * 24 * dt; e.y += dy / d * 24 * dt;
      if (e.stT <= 0) { e.st = 'crouch'; e.stT = 0.45; }
    } else if (e.st === 'crouch') {
      if (e.stT <= 0) {
        e.st = 'jump'; e.stT = 0.75; e.jx0 = e.x; e.jy0 = e.y;
        e.jx1 = clamp(P.x + (P.moving ? P.dx * 25 : 0), WALL + 20, ARENA - WALL - 20);
        e.jy1 = clamp(P.y + (P.moving ? P.dy * 25 : 0), WALL + 20, ARENA - WALL - 20);
        Sfx.jump();
      }
    } else if (e.st === 'jump') {
      const p = 1 - e.stT / 0.75;
      e.x = lerp(e.jx0, e.jx1, p); e.y = lerp(e.jy0, e.jy1, p); e.z = Math.sin(Math.min(1, p) * Math.PI) * 48;
      if (e.stT <= 0) {
        e.z = 0; addShake(7); Sfx.boom(); vib(40);
        G.rings.push({ x: e.x, y: e.y, r: 4, vr: 200, t: 0.25, max: 0.25, col: '#a8d8ff' });
        burst(e.x, e.y + 8, ['#4aa3ff', '#a8d8ff', '#fff'], 20, 90);
        const n = rage ? 16 : 10, off = rnd(TAU);
        for (let i = 0; i < n; i++) ebullet(e.x, e.y, off + i * TAU / n, 58);
        if (Math.hypot(P.x - e.x, P.y - e.y) < 26) hurtPlayer();
        if (G.enemies.length < 120) for (let i = 0; i < 2; i++) spawnEnemy('slime', e.x + rnd(-14, 14), e.y + rnd(-14, 14), { instant: true });
        e.jumps = (e.jumps || 0) + 1;
        if (rage && e.jumps % 2 === 1) { e.st = 'crouch'; e.stT = 0.3; } else { e.st = 'walk'; e.stT = rage ? 1.2 : 2.0; }
      }
    }
  } else if (e.type === 'queen') {
    if (e.st === 'idle') {
      const a = G.t * 0.9, tx = P.x + Math.cos(a) * 85, ty = P.y + Math.sin(a) * 60;
      const mx = tx - e.x, my = ty - e.y, ml = Math.hypot(mx, my) || 1, sp = Math.min(70, ml * 2.5);
      e.x += mx / ml * sp * dt; e.y += my / ml * sp * dt;
      if (e.stT <= 0) { e.st = pick(['dash', 'dash', 'swarm', 'ring']); e.stT = e.st === 'dash' ? 0.8 : 0.5; e.cnt = 0; e.at = 0; e.ang = Math.atan2(dy, dx); }
    } else if (e.st === 'dash') {
      if (e.stT > 0.2) e.ang = Math.atan2(dy, dx);
      if (e.stT <= 0) { e.st = 'dashing'; e.stT = 0.55; Sfx.charge(); }
    } else if (e.st === 'dashing') {
      e.x += Math.cos(e.ang) * 290 * dt; e.y += Math.sin(e.ang) * 290 * dt;
      burst(e.x, e.y, ['#9b5de5', '#5b2a9a'], 2, 30, 0.4);
      e.at -= dt;
      if (rage && e.at <= 0) { e.at = 0.07; ebullet(e.x, e.y, e.ang + Math.PI / 2, 32); ebullet(e.x, e.y, e.ang - Math.PI / 2, 32); }
      if (e.stT <= 0) { e.dashes = (e.dashes || 0) + 1; if (rage && e.dashes % 2) { e.st = 'dash'; e.stT = 0.5; } else { e.st = 'idle'; e.stT = rage ? 0.7 : 1.2; } }
    } else if (e.st === 'swarm') {
      if (e.cnt === 0) { e.cnt = 1; const n = rage ? 10 : 6; for (let k = 0; k < n; k++) { const a = k * TAU / n; spawnEnemy('bat', e.x + Math.cos(a) * 24, e.y + Math.sin(a) * 24, { instant: true }); } Sfx.jump(); }
      if (e.stT <= 0) { e.st = 'idle'; e.stT = 1.2; }
    } else if (e.st === 'ring') {
      e.at -= dt;
      const total = rage ? 3 : 2;
      if (e.at <= 0 && e.cnt < total) { e.cnt++; e.at = 0.4; for (let k = 0; k < 18; k++) ebullet(e.x, e.y, e.cnt * 0.17 + k * TAU / 18, 60); G.rings.push({ x: e.x, y: e.y, r: 6, vr: 160, t: 0.25, max: 0.25, col: '#c79bff' }); Sfx.eshoot(); }
      else if (e.cnt >= total && e.at <= 0) { e.st = 'idle'; e.stT = 1.1; }
    }
  } else {
    const want = 80;
    const tx = P.x - dx / d * want + Math.cos(G.t * 0.7) * 30, ty = P.y - dy / d * want + Math.sin(G.t * 0.9) * 20;
    const mx = tx - e.x, my = ty - e.y, ml = Math.hypot(mx, my) || 1;
    const sp = Math.min(38, ml * 2);
    e.x += mx / ml * sp * dt; e.y += my / ml * sp * dt;
    if (e.st === 'idle') {
      if (e.stT <= 0) { e.st = pick(['spiral', 'burst', 'summon', 'spiral', 'burst']); e.stT = e.st === 'spiral' ? 2.6 : e.st === 'burst' ? 1.4 : 0.6; e.at = 0.3; e.cnt = 0; e.ang = rnd(TAU); }
    } else {
      e.at -= dt;
      if (e.st === 'spiral' && e.at <= 0) { e.at = rage ? 0.075 : 0.1; e.ang += 0.33; const arms = rage ? 3 : 2; for (let k = 0; k < arms; k++) ebullet(e.x, e.y, e.ang + k * TAU / arms, 56); Sfx.eshoot(); }
      if (e.st === 'burst' && e.at <= 0) { e.at = 0.45; const a = Math.atan2(dy, dx), n = rage ? 7 : 5; for (let k = 0; k < n; k++) ebullet(e.x, e.y, a + (k - (n - 1) / 2) * 0.22, 80); Sfx.eshoot(); }
      if (e.st === 'summon' && e.cnt === 0) { e.cnt = 1; for (let k = 0; k < (rage ? 4 : 3); k++) { const a = k * TAU / 4; spawnEnemy('peeper', e.x + Math.cos(a) * 22, e.y + Math.sin(a) * 22); } }
      if (e.stT <= 0) { e.st = 'idle'; e.stT = rage ? 0.8 : 1.3; }
    }
  }
}

function fireBullet(a, fev, i) {
  const crit = Math.random() < st.crit;
  const dmg = st.dmg * st.dmgMul * (crit ? 2.5 : 1);
  G.bullets.push({
    x: P.x + Math.cos(a) * 5, y: P.y + Math.sin(a) * 5 - 1, vx: Math.cos(a) * st.bspeed, vy: Math.sin(a) * st.bspeed,
    r: 2 * st.size, dmg, crit, pierce: st.pierce, life: 0.85, hits: [],
    col: fev ? `hsl(${(G.t * 500 + i * 50) % 360},100%,65%)` : crit ? '#ffd23f' : st.bullet,
  });
}
function updateWeapons(dt) {
  const fev = G.fever > 0;
  G.fireT -= dt * st.rateMul * (fev ? 2 : 1);
  if (G.fireT <= 0) {
    const tgt = nearestEnemy(P.x, P.y, 165);
    if (tgt) {
      G.fireT += 1 / st.rate; if (G.fireT < 0) G.fireT = 0;
      const a = Math.atan2(tgt.y - P.y, tgt.x - P.x), n = st.multi, spread = 0.16;
      for (let i = 0; i < n; i++) fireBullet(a + (i - (n - 1) / 2) * spread, fev, i);
      if (!P.moving) P.face = Math.cos(a) >= 0 ? 1 : -1;
      Sfx.shoot();
    } else G.fireT = 0;
  }
  const D = st.dmg * st.dmgMul, E = st.evo;
  if (st.w.orbit) {
    const lv = st.w.orbit, n = orbitN(), R = orbitR(), dmg = D * (0.7 + 0.25 * lv) * (E.orbit ? 1.6 : 1);
    G.orbA += dt * (2.8 + lv * 0.3) * (E.orbit ? 1.3 : 1);
    for (let i = 0; i < n; i++) {
      const a = G.orbA + i * TAU / n, ox = P.x + Math.cos(a) * R, oy = P.y + Math.sin(a) * R;
      if (E.orbit && Math.random() < 0.2) G.parts.push({ x: ox, y: oy, vx: 0, vy: 0, t: 0.25, col: '#ffd23f', sz: 1 });
      query(ox, oy, 16, e => {
        if (e.dead || e.orbCd > 0 || e.spawnT > 0) return;
        if (Math.hypot(e.x - ox, e.y - oy) < e.r + 4) { e.orbCd = 0.4; hitEnemy(e, dmg, Math.cos(a) * 120, Math.sin(a) * 120); }
      });
    }
  }
  if (st.w.zap) {
    const lv = st.w.zap;
    G.zapT -= dt;
    if (G.zapT <= 0) {
      G.zapT = E.zap ? 0.5 : Math.max(0.6, 2.2 - lv * 0.3);
      const cx = G.cam.x, cy = G.cam.y;
      const vis = G.enemies.filter(e => !e.dead && e.spawnT <= 0 && !isPhased(e) && Math.abs(e.x - cx) < GW / 2 && Math.abs(e.y - cy) < GH / 2);
      const dmg = D * (2 + lv * 0.6);
      let struck = 0;
      for (let k = 0; k < lv + 1 && vis.length; k++) {
        const e = vis.splice(Math.floor(Math.random() * vis.length), 1)[0];
        struck++;
        G.bolts.push({ x: e.x, y: e.y, t: 0.18 });
        burst(e.x, e.y, ['#ffe95c', '#fff'], 6, 70);
        for (const o of G.enemies) if (!o.dead && Math.hypot(o.x - e.x, o.y - e.y) < 12 + o.r) hitEnemy(o, dmg);
        if (E.zap) {
          let cur = e; const hit = new Set([e]);
          for (let j = 0; j < 4; j++) {
            let nb = null, bd = 3600;
            for (const o of G.enemies) { if (o.dead || hit.has(o) || isPhased(o)) continue; const dd = (o.x - cur.x) ** 2 + (o.y - cur.y) ** 2; if (dd < bd) { bd = dd; nb = o; } }
            if (!nb) break;
            G.arcs.push({ x1: cur.x, y1: cur.y, x2: nb.x, y2: nb.y, t: 0.16 });
            hit.add(nb); hitEnemy(nb, dmg * 0.7); cur = nb;
          }
        }
      }
      if (struck) { Sfx.zap(); addShake(1.5); }
    }
  }
  if (st.w.aura) {
    const lv = st.w.aura, R = auraR();
    G.auraT -= dt;
    if (E.aura && Math.random() < 0.8) { const a = rnd(TAU), rr = rnd(R); G.parts.push({ x: P.x + Math.cos(a) * rr, y: P.y + Math.sin(a) * rr, vx: 0, vy: -28, t: 0.5, col: pick(['#ff8c2e', '#ffd23f', '#ff3d2e']), sz: 1 }); }
    if (G.auraT <= 0) {
      G.auraT = 0.4;
      const dmg = D * (0.35 + 0.2 * lv) * (E.aura ? 2 : 1);
      query(P.x, P.y, R + 14, e => { if (!e.dead && Math.hypot(e.x - P.x, e.y - P.y) < R + e.r) { e.slow = 0.5; hitEnemy(e, dmg, 0, 0, false, true); } });
    }
  }
  if (st.w.boom) {
    const lv = st.w.boom;
    G.boomT -= dt;
    if (G.boomT <= 0) {
      G.boomT = Math.max(0.9, 2.0 - lv * 0.15);
      const count = E.boom ? 6 : lv >= 5 ? 3 : lv >= 3 ? 2 : 1;
      const tgt = nearestEnemy(P.x, P.y, 200);
      const a = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) : rnd(TAU);
      for (let i = 0; i < count; i++) {
        const aa = E.boom ? a + i * TAU / count : a + (i - (count - 1) / 2) * 0.7;
        G.bullets.push({ boom: true, evo: !!E.boom, x: P.x, y: P.y, a: aa, t: 0, out: E.boom ? 0.7 : 0.55, sp: 200, r: E.boom ? 9 : 5, dmg: D * (1.1 + 0.35 * lv) * (E.boom ? 1.5 : 1), life: 4 });
      }
    }
  }
  if (st.w.nova) {
    const lv = st.w.nova;
    G.novaT -= dt;
    if (G.novaT <= 0) { G.novaT = Math.max(1.2, 3.2 - lv * 0.35); novaBurst(0); if (E.nova) G.novaEcho = 0.18; }
    if (G.novaEcho > 0) { G.novaEcho -= dt; if (G.novaEcho <= 0) novaBurst(0.5); }
  }
  if (st.w.laser) {
    const lv = st.w.laser;
    G.laserT -= dt;
    if (G.laserT <= 0) {
      const tgt = nearestEnemy(P.x, P.y, 230);
      if (tgt || E.laser) {
        G.laserT = Math.max(1.0, 2.8 - lv * 0.3) * (E.laser ? 0.75 : 1);
        const a = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) : G.t;
        const beams = E.laser ? 4 : 1, w = 3 + lv + (E.laser ? 2 : 0), dmg = D * (2 + 0.8 * lv) * (E.laser ? 1.3 : 1);
        for (let k = 0; k < beams; k++) G.beams.push({ a: a + k * TAU / beams, len: 240, w, dmg, t: 0.32, max: 0.32, tick: 0, hit: new Set(), col: E.laser ? '#ff4cd2' : '#5ef0ff', spin: E.laser ? 2.4 : 0 });
        Sfx.laser(); addShake(2);
      } else G.laserT = 0.2;
    }
  }
  if (st.w.missile) {
    const lv = st.w.missile;
    G.missileT -= dt;
    if (G.missileT <= 0) {
      if (G.enemies.length) {
        G.missileT = Math.max(0.8, 1.9 - lv * 0.18);
        const n = [1, 1, 2, 2, 3][lv - 1] * (E.missile ? 2 : 1);
        for (let i = 0; i < n; i++) {
          const a = rnd(TAU);
          G.missiles.push({ x: P.x, y: P.y - 3, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70 - 20, tgt: null, t: 0, dmg: D * (1.5 + 0.5 * lv) * (E.missile ? 1.5 : 1), aoe: E.missile ? 26 : 16 });
        }
        Sfx.missile();
      } else G.missileT = 0.3;
    }
  }
}
function orbitN() { return st.w.orbit + 1 + (st.evo.orbit ? 3 : 0); }
function orbitR() { return st.evo.orbit ? 34 + Math.sin(G.t * 2) * 14 : 20 + st.w.orbit * 2; }
function auraR() { return (18 + st.w.aura * 5) * (st.evo.aura ? 1.5 : 1); }
function novaBurst(off2) {
  const lv = st.w.nova, ev = st.evo.nova, n = Math.round((6 + lv * 2) * (ev ? 1.5 : 1)), off = rnd(TAU);
  const D = st.dmg * st.dmgMul;
  for (let i = 0; i < n; i++) { const a = off + (i + off2) * TAU / n; G.bullets.push({ x: P.x, y: P.y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, r: 2.5, dmg: D * (0.8 + 0.3 * lv), pierce: ev ? 3 : 1, life: 0.75, hits: [], col: ev ? '#ffd23f' : '#7ae8ff', star: true }); }
  G.rings.push({ x: P.x, y: P.y, r: 4, vr: 160, t: 0.25, max: 0.25, col: ev ? '#ffd23f' : '#7ae8ff' });
  Sfx.nova();
}
function updateBeams(dt) {
  for (const b of G.beams) {
    b.t -= dt; b.a += b.spin * dt; b.tick -= dt;
    if (b.tick > 0) continue;
    b.tick = 0.08;
    const ux = Math.cos(b.a), uy = Math.sin(b.a);
    for (const e of G.enemies) {
      if (e.dead || b.hit.has(e) || e.spawnT > 0.15) continue;
      const dx = e.x - P.x, dy = e.y - P.y, t = dx * ux + dy * uy;
      if (t < 0 || t > b.len) continue;
      if (Math.abs(dx * uy - dy * ux) < e.r + b.w / 2) { b.hit.add(e); hitEnemy(e, b.dmg, ux * 60, uy * 60); burst(e.x, e.y, [b.col, '#fff'], 3, 50, 0.3); }
    }
  }
  G.beams = G.beams.filter(b => b.t > 0);
}
function missileTarget(m) {
  const c = G.enemies.filter(e => !e.dead && e.spawnT <= 0 && !isPhased(e) && Math.hypot(e.x - P.x, e.y - P.y) < 170);
  return c.length ? pick(c) : nearestEnemy(m.x, m.y, 300);
}
function updateMissiles(dt) {
  for (const m of G.missiles) {
    m.t += dt;
    if (!m.tgt || m.tgt.dead || isPhased(m.tgt)) m.tgt = missileTarget(m);
    let cur = Math.atan2(m.vy, m.vx);
    if (m.tgt && m.t > 0.12) {
      const want = Math.atan2(m.tgt.y - m.y, m.tgt.x - m.x);
      const diff = ((want - cur + Math.PI * 3) % TAU) - Math.PI;
      cur += clamp(diff, -7 * dt, 7 * dt);
    }
    const sp = Math.min(210, Math.hypot(m.vx, m.vy) + dt * 360);
    m.vx = Math.cos(cur) * sp; m.vy = Math.sin(cur) * sp;
    m.x += m.vx * dt; m.y += m.vy * dt;
    G.parts.push({ x: m.x - m.vx * 0.02, y: m.y - m.vy * 0.02, vx: rnd(-6, 6), vy: rnd(-6, 6), t: rnd(0.25, 0.45), col: pick(['#9a96b0', '#6b6690', '#c0c8ff']), sz: 2 });
    if (Math.random() < 0.6) G.parts.push({ x: m.x - m.vx * 0.015, y: m.y - m.vy * 0.015, vx: 0, vy: 0, t: 0.08, col: pick(['#ffb13b', '#ffd23f']), sz: 1 });
    const hitT = m.tgt && Math.hypot(m.tgt.x - m.x, m.tgt.y - m.y) < m.tgt.r + 3;
    if (hitT || m.t > 2.5 || m.x < WALL || m.y < WALL || m.x > ARENA - WALL || m.y > ARENA - WALL) {
      m.dead = true;
      G.rings.push({ x: m.x, y: m.y, r: 2, vr: m.aoe * 8, t: 0.18, max: 0.18, col: '#ffb13b', fill: true, maxR: m.aoe });
      burst(m.x, m.y, ['#ffb13b', '#ff6a2b', '#ffd23f', '#fff'], 10, 80, 0.4);
      scorch(m.x, m.y, m.aoe * 0.5);
      for (const e of G.enemies) { if (e.dead) continue; const dx = e.x - m.x, dy = e.y - m.y, d = Math.hypot(dx, dy) || 1; if (d < m.aoe + e.r) hitEnemy(e, m.dmg, dx / d * 100, dy / d * 100); }
      Sfx.pop(); addShake(1.5);
    }
  }
  G.missiles = G.missiles.filter(m => !m.dead);
}

function updateBullets(dt) {
  for (const b of G.bullets) {
    if (b.boom) {
      b.t += dt; b.life -= dt;
      if (b.t < b.out) { const v = b.sp * (1 - b.t / b.out * 0.9); b.x += Math.cos(b.a) * v * dt; b.y += Math.sin(b.a) * v * dt; }
      else {
        const dx = P.x - b.x, dy = P.y - b.y, d = Math.hypot(dx, dy) || 1, v = Math.min(280, 60 + (b.t - b.out) * 500);
        b.x += dx / d * v * dt; b.y += dy / d * v * dt;
        if (d < 7) b.dead = true;
      }
      if (b.life <= 0) b.dead = true;
    } else {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.x < WALL || b.y < WALL || b.x > ARENA - WALL || b.y > ARENA - WALL) b.dead = true;
    }
    if (b.dead) continue;
    query(b.x, b.y, b.r + 14, e => {
      if (b.dead || e.dead || e.spawnT > 0.15 || e.z > 12 || isPhased(e)) return;
      const rr = e.r + b.r, dx = e.x - b.x, dy = e.y - b.y;
      if (dx * dx + dy * dy > rr * rr) return;
      if (b.boom) {
        if (e.boomCd > 0) return;
        e.boomCd = 0.3; hitEnemy(e, b.dmg, Math.cos(b.a) * 80, Math.sin(b.a) * 80);
      } else {
        if (b.hits.includes(e)) return;
        b.hits.push(e);
        const l = Math.hypot(b.vx, b.vy) || 1;
        hitEnemy(e, b.dmg, b.vx / l * 70, b.vy / l * 70, b.crit);
        for (let k = 0; k < 2; k++) G.parts.push({ x: b.x, y: b.y, vx: b.vx / l * rnd(40, 90) + rnd(-30, 30), vy: b.vy / l * rnd(40, 90) + rnd(-30, 30), t: 0.15, col: k ? '#fff' : b.col, sz: 1 });
        if (b.pierce-- <= 0) { b.dead = true; burst(b.x, b.y, b.col, 3, 40, 0.25); }
      }
    });
  }
  G.bullets = G.bullets.filter(b => !b.dead);
}
function updateEBullets(dt) {
  for (const b of G.ebullets) {
    if (G.freeze <= 0) { b.x += b.vx * dt; b.y += b.vy * dt; }
    b.t += dt;
    if (b.t > 5 || b.x < WALL || b.y < WALL || b.x > ARENA - WALL || b.y > ARENA - WALL) b.dead = true;
    else if (Math.hypot(P.x - b.x, P.y - b.y) < P.r + b.r - 0.5) {
      if (P.inv <= 0 && P.dashT <= 0) { b.dead = true; hurtPlayer(); }
    }
  }
  G.ebullets = G.ebullets.filter(b => !b.dead);
}
function updatePickups(dt) {
  const mag = st.magnet * st.magMul;
  G.gemStreakT -= dt; if (G.gemStreakT <= 0) G.gemStreak = 0;
  for (const g of G.gems) {
    g.t += dt;
    const dx = P.x - g.x, dy = P.y - g.y, d = Math.hypot(dx, dy) || 1;
    if (d < mag) g.pull = true;
    if (g.pull) { g.sp += dt * 420; g.x += dx / d * g.sp * dt; g.y += dy / d * g.sp * dt; }
    else { g.x += g.vx * dt; g.y += g.vy * dt; g.vx *= 0.9; g.vy *= 0.9; }
    if (d < P.r + 4) {
      g.dead = true; G.xp += g.v;
      G.gemStreak = Math.min(24, G.gemStreak + 1); G.gemStreakT = 0.5;
      Sfx.gem(G.gemStreak);
      while (G.xp >= G.need) { G.xp -= G.need; G.lvl++; G.need = xpNeed(G.lvl); G.pendingLv++; mission('level', G.lvl); }
    }
  }
  G.gems = G.gems.filter(g => !g.dead);
  for (const p of G.pickups) {
    p.t += dt; p.life -= dt;
    const dx = P.x - p.x, dy = P.y - p.y, d = Math.hypot(dx, dy) || 1;
    if (p.kind === 'coin' && d < mag) p.pull = true;
    if (p.pull) { p.sp += dt * 420; p.x += dx / d * p.sp * dt; p.y += dy / d * p.sp * dt; }
    else { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; }
    if (p.kind !== 'chest') clampArena(Object.assign(p, { r: 3 }));
    if (p.life <= 0) p.dead = true;
    if (d < P.r + (p.kind === 'chest' ? (p.big ? 12 : 8) : 5)) { p.dead = true; collect(p); }
  }
  G.pickups = G.pickups.filter(p => !p.dead);
}
function collect(p) {
  if (p.kind === 'coin') { G.coins += p.v || 1; Sfx.coin(); }
  else if (p.kind === 'heart') { P.hp = Math.min(st.maxHp, P.hp + 1); floater(P.x, P.y - 12, '+1 HP', '#ff4d6d'); Sfx.chest(); }
  else if (p.kind === 'magnet') { for (const g of G.gems) g.pull = true; for (const q of G.pickups) if (q.kind === 'coin') q.pull = true; floater(P.x, P.y - 12, 'MAGNET!', '#ff5d5d', true); Sfx.chest(); }
  else if (p.kind === 'freeze') {
    G.freeze = 4.5; G.flash = 0.3; G.flashCol = '#a8e6ff'; addShake(3);
    floater(P.x, P.y - 12, 'FREEZE!', '#a8e6ff', true); Sfx.freeze(); vib(40);
    G.rings.push({ x: P.x, y: P.y, r: 6, vr: 400, t: 0.4, max: 0.4, col: '#d4fbff' });
  } else if (p.kind === 'shield') { P.shield = true; floater(P.x, P.y - 12, 'SHIELD!', '#7ae8ff', true); Sfx.shield(); }
  else if (p.kind === 'bomb') {
    G.flash = 0.35; G.flashCol = '#fff'; addShake(8); Sfx.boom(); vib(60);
    floater(P.x, P.y - 12, 'KABOOM!', '#ffb13b', true);
    const cx = G.cam.x, cy = G.cam.y;
    for (const e of G.enemies) if (!e.dead && Math.abs(e.x - cx) < GW / 2 + 10 && Math.abs(e.y - cy) < GH / 2 + 10) hitEnemy(e, e.boss ? st.dmg * st.dmgMul * 15 : 99999, 0, 0, false, true);
    G.ebullets.length = 0;
  } else if (p.kind === 'chest') {
    G.pendingLv += p.big ? 2 : 1;
    const n = p.big ? 12 : rint(3, 6);
    for (let i = 0; i < n; i++) dropPickup('coin', p.x, p.y, { v: 1 });
    burst(p.x, p.y, ['#ffd23f', '#fff', '#ff8c2e'], 30, 110, 0.7);
    floater(p.x, p.y - 14, p.big ? 'MEGA TREASURE!' : 'TREASURE!', '#ffd23f', true);
    Sfx.chest(); vib(30); mission('chest', 1);
  }
}
function updateFx(dt) {
  for (const p of G.parts) {
    p.t -= dt;
    if (p.z !== undefined) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vz -= 280 * dt; p.z += p.vz * dt;
      if (p.z < 0) { p.z = 0; if (p.vz < -35) { p.vz *= -0.4; p.vx *= 0.6; p.vy *= 0.6; } else { p.vz = 0; p.vx *= 0.85; p.vy *= 0.85; } }
      if (p.t <= 0 && p.stamp) decalPx(p.x, p.y, p.col, p.sz);
    } else { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; }
  }
  G.parts = G.parts.filter(p => p.t > 0);
  for (const a of G.arcs) a.t -= dt;
  G.arcs = G.arcs.filter(a => a.t > 0);
  if (G.letterbox > 0) G.letterbox -= dt;
  if (G.pillar > 0) G.pillar -= dt;
  if (G.announce) { G.announce.t -= dt; if (G.announce.t <= 0) G.announce = null; }
  if (G.mtoast) { G.mtoast.t -= dt; if (G.mtoast.t <= 0) G.mtoast = null; }
  updateAmbient(dt);
  for (const f of G.floats) { f.t -= dt; f.y -= dt * (f.big ? 14 : 26); }
  G.floats = G.floats.filter(f => f.t > 0);
  for (const r of G.rings) { r.t -= dt; r.r += r.vr * dt; if (r.maxR) r.r = Math.min(r.r, r.maxR); }
  G.rings = G.rings.filter(r => r.t > 0);
  for (const b of G.bolts) b.t -= dt;
  G.bolts = G.bolts.filter(b => b.t > 0);
  for (const g of G.ghosts) g.t -= dt;
  G.ghosts = G.ghosts.filter(g => g.t > 0);
  G.shake = Math.max(0, G.shake - dt * 25);
  G.flash -= dt; G.hurtFx -= dt;
  if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
  // camera
  const k = Math.min(1, dt * 8);
  G.cam.x += (P.x - G.cam.x) * k; G.cam.y += (P.y - G.cam.y) * k;
  const m = 24;
  G.cam.x = ARENA + m * 2 > GW ? clamp(G.cam.x, GW / 2 - m, ARENA - GW / 2 + m) : ARENA / 2;
  G.cam.y = ARENA + m * 2 > GH ? clamp(G.cam.y, GH / 2 - m, ARENA - GH / 2 + m) : ARENA / 2;
}

function updateAmbient(dt) {
  const b = BIOMES[G.biome], cx = G.cam.x, cy = G.cam.y;
  if (G.amb.length < 40 && Math.random() < dt * 25) {
    const x = cx + rnd(-GW / 2 - 10, GW / 2 + 10), y = cy + rnd(-GH / 2 - 10, GH / 2 + 10);
    let a;
    if (b.amb === 'fireflies') a = { x, y, vx: rnd(-8, 8), vy: rnd(-8, 8), t: rnd(3, 6), col: '#e8ff7a', glow: '#c8ff3a', blink: true, wander: true };
    else if (b.amb === 'dust') a = { x, y, vx: rnd(-4, 4), vy: rnd(2, 6), t: rnd(3, 6), col: '#8a84a8' };
    else if (b.amb === 'embers') a = { x, y: cy + GH / 2 + 5, vx: rnd(-6, 6), vy: rnd(-34, -16), t: rnd(3, 6), col: pick(['#ff8c2e', '#ffd23f', '#ff4d2e']), glow: '#ff6a2b', wob: true };
    else if (b.amb === 'snow') a = { x, y: cy - GH / 2 - 5, vx: rnd(4, 12), vy: rnd(14, 26), t: rnd(5, 9), col: '#ffffff', wob: true, big: Math.random() < 0.3 };
    else a = { x, y, vx: 0, vy: rnd(-6, -2), t: rnd(2, 4), col: pick(['#7a4cff', '#ff4cd2', '#5ef0ff']), glow: '#7a4cff', blink: true };
    G.amb.push(a);
  }
  for (const a of G.amb) {
    a.t -= dt;
    if (a.wander && Math.random() < dt * 2) { a.vx = rnd(-10, 10); a.vy = rnd(-10, 10); }
    a.x += (a.vx + (a.wob ? Math.sin(a.t * 3) * 6 : 0)) * dt; a.y += a.vy * dt;
  }
  G.amb = G.amb.filter(a => a.t > 0 && Math.abs(a.x - cx) < GW / 2 + 40 && Math.abs(a.y - cy) < GH / 2 + 40);
}

/* ---------- Drawing: world ---------- */
function camOrigin() {
  const sx = G.shake > 0 ? rnd(-G.shake, G.shake) : 0, sy = G.shake > 0 ? rnd(-G.shake, G.shake) : 0;
  return { x: Math.round(G.cam.x - GW / 2 + sx), y: Math.round(G.cam.y - GH / 2 + sy) };
}
function drawFloor(cx, cy, voidCol) {
  rect(0, 0, GW, GH, voidCol);
  const sx = Math.max(0, cx), sy = Math.max(0, cy), ex = Math.min(ARENA, cx + GW), ey = Math.min(ARENA, cy + GH);
  if (ex > sx && ey > sy) ctx.drawImage(floorCv, sx, sy, ex - sx, ey - sy, sx - cx, sy - cy, ex - sx, ey - sy);
}
function hex6(c) { return c && c[0] === '#' ? (c.length === 4 ? '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c) : '#ff4cd2'; }
function addLight(x, y, r) { if (LIGHTS.length < 220) LIGHTS.push([x, y, r]); }
function addGlow(x, y, r, col) { if (GLOWS.length < 260) GLOWS.push([x, y, r, hex6(col)]); }
function renderLights(c) {
  const b = BIOMES[G.biome];
  const dark = b.dark;
  if (dark > 0) {
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, GW, GH);
    lctx.globalAlpha = dark; lctx.fillStyle = b.darkCol; lctx.fillRect(0, 0, GW, GH); lctx.globalAlpha = 1;
    lctx.globalCompositeOperation = 'destination-out';
    for (const l of LIGHTS) { const r = Math.max(2, l[2]); lctx.drawImage(LIGHT_SPR, Math.round(l[0] - c.x - r), Math.round(l[1] - c.y - r), Math.round(r * 2), Math.round(r * 2)); }
    lctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(lightCv, 0, 0);
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const g of GLOWS) { const r = Math.max(2, g[2]); ctx.drawImage(Glow(g[3]), Math.round(g[0] - c.x - r), Math.round(g[1] - c.y - r), Math.round(r * 2), Math.round(r * 2)); }
  ctx.globalCompositeOperation = 'source-over';
  LIGHTS.length = 0; GLOWS.length = 0;
}
function pthick(x0, y0, x1, y1, c, w) {
  ctx.fillStyle = c;
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / Math.max(1, w / 2)) || 1;
  for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + (x1 - x0) * i / n - w / 2), Math.round(y0 + (y1 - y0) * i / n - w / 2), w, w);
}
function telegraph(x, y, a, len) {
  const ux = Math.cos(a), uy = Math.sin(a);
  for (let i = 6; i < len; i += 4) if (Math.floor(i / 4 + T * 20) % 3) rect(x + ux * i - 1, y + uy * i - 1, 2, 2, '#ff4d6d');
  addGlow(x + ux * 16, y + uy * 16, 10, '#ff4d6d');
}
function drawSprSq(s, x, y, flip, flash, sc, sx, sy) {
  const img = flash ? (flip ? s.ff : s.f) : (flip ? s.cf : s.c);
  const w = Math.round(s.w * sc * sx), h = Math.round(s.h * sc * sy);
  ctx.drawImage(img, Math.round(x - w / 2), Math.round(y + s.h * sc / 2 - h), w, h);
}
function onScreen(x, y, c, m = 20) { return x > c.x - m && x < c.x + GW + m && y > c.y - m && y < c.y + GH + m; }

function drawWorld() {
  const c = camOrigin();
  drawFloor(c.x, c.y, BIOMES[G.biome].void);
  ctx.save(); ctx.translate(-c.x, -c.y);
  for (const l of FLOOR_LIGHTS) {
    if (!onScreen(l.x, l.y, c, 40)) continue;
    if (l.torch) {
      rect(l.x - 1, l.y, 3, 4, '#3b2a1a'); rect(l.x - 2, l.y - 1, 5, 1, '#5a4030');
      const fl = Math.floor(T * 12 + l.x + l.y) % 3;
      rect(l.x - 1, l.y - 3 - fl % 2, 3, 3, '#ff8c2e'); rect(l.x, l.y - 4 - fl, 1, 2, '#ffd23f');
      addLight(l.x, l.y, l.r + Math.sin(T * 9 + l.x) * 3); addGlow(l.x, l.y - 2, 12, '#ff8c2e');
      if (Math.random() < 0.03) G.parts.push({ x: l.x, y: l.y - 4, vx: rnd(-5, 5), vy: -20, t: 0.6, col: '#ffb13b', sz: 1 });
    } else { addLight(l.x, l.y, l.r * (0.85 + Math.sin(T * 3 + l.x) * 0.15)); addGlow(l.x, l.y, l.r * 0.5, l.col); }
  }
  // aura
  if (st.w.aura) {
    const R = auraR(), ev = st.evo.aura, a1 = ev ? '#ff3d2e' : '#ff8c2e';
    ctx.globalAlpha = (ev ? 0.22 : 0.16) + Math.sin(T * 8) * 0.04; disc(P.x, P.y, R, a1);
    ctx.globalAlpha = 0.5; ring(P.x, P.y, R, ev ? '#ffd23f' : '#ffb13b'); ctx.globalAlpha = 1;
    addLight(P.x, P.y, R + 14); addGlow(P.x, P.y, R * 0.8, a1);
  }
  // rings (filled first)
  for (const r of G.rings) if (r.fill) { ctx.globalAlpha = Math.max(0, r.t / r.max) * 0.8; disc(r.x, r.y, r.r, r.col); disc(r.x, r.y, r.r * 0.6, '#fff'); ctx.globalAlpha = 1; addLight(r.x, r.y, r.r * 2.5 + 10); addGlow(r.x, r.y, r.r * 1.4 + 4, r.col); }
  // gems
  for (const g of G.gems) {
    if (!onScreen(g.x, g.y, c)) continue;
    const col = g.v >= 20 ? '#ff4d6d' : g.v >= 5 ? '#5ed15a' : '#5ef0ff';
    drawSpr(Icons('gem', col), g.x, g.y + Math.sin(g.t * 5) * 1);
    addGlow(g.x, g.y, g.v >= 5 ? 7 : 4, col);
  }
  // pickups
  for (const p of G.pickups) {
    if (!onScreen(p.x, p.y, c)) continue;
    if (p.life < 5 && Math.floor(p.t * 8) % 2) continue;
    const bob = Math.sin(p.t * 4) * 1.5;
    if (p.kind === 'coin') drawSpr(Icons(Math.floor(p.t * 6) % 2 ? 'coinA' : 'coinB'), p.x, p.y + bob);
    else if (p.kind === 'heart') { shadow(p.x, p.y + 4, 6); drawSpr(Icons('hp', '#ff4d6d'), p.x, p.y + bob - 2); }
    else if (p.kind === 'magnet') { shadow(p.x, p.y + 4, 6); drawSpr(Icons('magnet', '#ff5d5d'), p.x, p.y + bob - 2); }
    else if (p.kind === 'freeze') { shadow(p.x, p.y + 4, 6); drawSpr(Icons('freeze', '#a8e6ff'), p.x, p.y + bob - 2); addGlow(p.x, p.y - 2, 9, '#a8e6ff'); addLight(p.x, p.y, 18); }
    else if (p.kind === 'shield') { shadow(p.x, p.y + 4, 6); drawSpr(Icons('shield', '#7ae8ff'), p.x, p.y + bob - 2); addGlow(p.x, p.y - 2, 9, '#7ae8ff'); addLight(p.x, p.y, 18); }
    else if (p.kind === 'bomb') { shadow(p.x, p.y + 4, 6); drawSpr(SPR.bomb[0], p.x, p.y + bob - 2, false, Math.floor(p.t * 6) % 2 === 0); }
    else if (p.kind === 'chest') {
      const sc = p.big ? 2 : 1;
      shadow(p.x, p.y + 4 * sc, 10 * sc);
      ctx.globalAlpha = 0.3 + Math.sin(p.t * 5) * 0.15; disc(p.x, p.y, 9 * sc, '#ffd23f'); ctx.globalAlpha = 1;
      drawSpr(SPR.chest[0], p.x, p.y + bob * 0.5 - 2, false, Math.floor(p.t * 3) % 4 === 0, sc);
      addLight(p.x, p.y, 34 * sc); addGlow(p.x, p.y, 12 * sc, '#ffd23f');
      if (Math.random() < 0.15) G.parts.push({ x: p.x + rnd(-8, 8) * sc, y: p.y + rnd(-6, 4) * sc, vx: 0, vy: -15, t: 0.4, col: '#fff7b0', sz: 1 });
    }
  }
  // actors (y-sorted)
  const actors = [];
  for (const e of G.enemies) if (!e.dead && onScreen(e.x, e.y, c, 40)) actors.push(e);
  for (const r of G.rocks) if (onScreen(r.x, r.y, c)) actors.push(r);
  actors.push(P);
  actors.sort((a, b) => a.y - b.y);
  for (const g of G.ghosts) {
    ctx.globalAlpha = g.t / 0.22 * 0.5;
    drawSpr(SPR[save.sel][g.f], g.x, g.y - 1, g.flip, true);
  }
  ctx.globalAlpha = 1;
  for (const a of actors) {
    if (a === P) drawPlayer();
    else if (a.type) drawEnemy(a);
    else { shadow(a.x, a.y + 3, 12); drawSpr(SPR.rock[0], a.x, a.y - 1); }
  }
  if (G.pillar > 0) {
    const k = G.pillar / 0.6, w = Math.max(1, Math.round(14 * k));
    ctx.globalAlpha = 0.7 * k; rect(P.x - w / 2, c.y, w, P.y - c.y + 4, '#fff7b0'); rect(P.x - w / 4, c.y, Math.max(1, w / 2), P.y - c.y + 4, '#fff'); ctx.globalAlpha = 1;
    addLight(P.x, P.y, 90 * k + 20); addGlow(P.x, P.y, 30, '#ffd23f');
  }
  // orbitals
  if (st.w.orbit) {
    const n = orbitN(), R = orbitR(), bs = st.evo.orbit ? SPR.boneG[0] : SPR.bone[0];
    for (let i = 0; i < n; i++) { const a = G.orbA + i * TAU / n, x = P.x + Math.cos(a) * R, y = P.y + Math.sin(a) * R; drawSpr(bs, x, y); addLight(x, y, 12); if (st.evo.orbit) addGlow(x, y, 7, '#ffd23f'); }
  }
  // bullets
  for (const b of G.bullets) {
    if (!onScreen(b.x, b.y, c)) continue;
    if (b.boom) {
      const bs = b.evo ? SPR.boomerG[0] : SPR.boomer[0], k = b.evo ? 2 : 1;
      ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y)); ctx.rotate(Math.floor(b.t * 16) % 4 * Math.PI / 2);
      ctx.drawImage(bs.c, -3 * k, -3 * k, bs.w * k, bs.h * k); ctx.restore();
      addLight(b.x, b.y, 14 * k); if (b.evo) addGlow(b.x, b.y, 10, '#ff4cd2');
    } else {
      const s = Math.max(2, Math.round(b.r * 1.5));
      ctx.globalAlpha = 0.5; pline(b.x - b.vx * 0.03, b.y - b.vy * 0.03, b.x, b.y, b.col, 1); ctx.globalAlpha = 1;
      addGlow(b.x, b.y, 4 + s, b.col); if (b.crit || b.star) addLight(b.x, b.y, 12);
      rect(b.x - s / 2 - 1, b.y - s / 2 - 1, s + 2, s + 2, '#1b1428');
      rect(b.x - s / 2, b.y - s / 2, s, s, b.col);
      rect(b.x - s / 2, b.y - s / 2, Math.max(1, s / 2), Math.max(1, s / 2), '#fff');
    }
  }
  // enemy bullets
  for (const b of G.ebullets) {
    if (!onScreen(b.x, b.y, c)) continue;
    const blink = Math.floor(b.t * 12) % 2;
    rect(b.x - 3, b.y - 3, 6, 6, '#1b1428');
    rect(b.x - 2, b.y - 2, 4, 4, blink ? '#ff4d6d' : '#ff9ab0');
    rect(b.x - 1, b.y - 1, 2, 2, '#fff');
    addGlow(b.x, b.y, 7, '#ff4d6d'); addLight(b.x, b.y, 10);
  }
  // missiles
  for (const m of G.missiles) {
    ctx.save(); ctx.translate(Math.round(m.x), Math.round(m.y)); ctx.rotate(Math.atan2(m.vy, m.vx));
    ctx.drawImage(SPR.missile[0].c, -4, -2); ctx.restore();
    addLight(m.x, m.y, 14); addGlow(m.x - m.vx * 0.02, m.y - m.vy * 0.02, 6, '#ffb13b');
  }
  // laser beams
  for (const b of G.beams) {
    const k = b.t / b.max, w = Math.max(1, Math.round(b.w * (0.5 + 0.5 * k)) + (Math.floor(T * 30) % 2));
    const ex = P.x + Math.cos(b.a) * b.len, ey = P.y + Math.sin(b.a) * b.len;
    pthick(P.x, P.y, ex, ey, b.col, w + 2);
    pthick(P.x, P.y, ex, ey, '#ffffff', Math.max(1, w - 2));
    disc(P.x, P.y, w + 1, '#fff');
    for (let i = 0; i < b.len; i += 22) { const x = P.x + Math.cos(b.a) * i, y = P.y + Math.sin(b.a) * i; addLight(x, y, 18 + w); if (i % 44 === 0) addGlow(x, y, 8 + w, b.col); }
  }
  // chain lightning arcs
  for (const a of G.arcs) {
    let x = a.x1, y = a.y1;
    for (let i = 1; i <= 4; i++) {
      const nx = i === 4 ? a.x2 : lerp(a.x1, a.x2, i / 4) + rnd(-5, 5), ny = i === 4 ? a.y2 : lerp(a.y1, a.y2, i / 4) + rnd(-5, 5);
      pline(x, y, nx, ny, '#ffffff', 1); x = nx; y = ny;
    }
    addGlow((a.x1 + a.x2) / 2, (a.y1 + a.y2) / 2, 14, '#ffe95c'); addLight((a.x1 + a.x2) / 2, (a.y1 + a.y2) / 2, 30);
  }
  // lightning
  for (const b of G.bolts) {
    let x = b.x + rnd(-6, 6), y = c.y - 4;
    const segs = 8, stepY = (b.y - y) / segs;
    for (let i = 0; i < segs; i++) {
      const nx = i === segs - 1 ? b.x : b.x + rnd(-8, 8), ny = y + stepY;
      pline(x, y, nx, ny, '#fff', 2); pline(x + 1, y, nx + 1, ny, '#ffe95c', 1);
      x = nx; y = ny;
    }
    ctx.globalAlpha = 0.6; disc(b.x, b.y, 8, '#ffe95c'); ctx.globalAlpha = 1;
    addLight(b.x, b.y, 64); addGlow(b.x, b.y, 22, '#ffe95c');
  }
  // rings (outline)
  for (const r of G.rings) if (!r.fill) { ctx.globalAlpha = Math.max(0, r.t / r.max); ring(r.x, r.y, r.r, r.col, 2); ctx.globalAlpha = 1; }
  // particles
  for (const p of G.parts) { ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x), Math.round(p.y - (p.z || 0)), p.sz, p.sz); }
  // ambience
  for (const a of G.amb) {
    if (a.blink && Math.sin(a.t * 5) < -0.3) continue;
    ctx.fillStyle = a.col; ctx.fillRect(Math.round(a.x), Math.round(a.y), a.big ? 2 : 1, a.big ? 2 : 1);
    if (a.glow) addGlow(a.x, a.y, 5, a.glow);
  }
  ctx.restore();
  renderLights(c);
  ctx.save(); ctx.translate(-c.x, -c.y);
  // floaters
  for (const f of G.floats) {
    if (f.big) { if (Math.floor(f.t * 10) % 2 || f.t > 0.4) Font.outline(ctx, f.txt, f.x, f.y, f.col, '#1b1428', 1, 'center'); }
    else Font.outline(ctx, f.txt, f.x, f.y, f.col, '#1b1428', f.crit && f.t > 0.45 ? 2 : 1, 'center');
  }
  ctx.restore();
  return c;
}
function drawPlayer() {
  addLight(P.x, P.y, 66 + Math.sin(T * 7) * 2);
  if (P.shield) { ring(P.x, P.y - 1, 9, Math.floor(T * 8) % 2 ? '#7ae8ff' : '#d4fbff'); addGlow(P.x, P.y, 12, '#7ae8ff'); }
  if (G.dying > 0) {
    const f = Math.floor(G.t * 10) % 2;
    shadow(P.x, P.y + 5, 8);
    drawSpr(SPR[save.sel][0], P.x, P.y - 1, f === 0, f === 1);
    return;
  }
  if (P.inv > 0 && P.dashT <= 0 && Math.floor(P.inv * 14) % 2) return;
  const fr = P.moving ? Math.floor(P.anim) % 2 : 0;
  const bob = P.moving ? (fr ? -1 : 0) : Math.round(Math.sin(P.anim) * 0.5);
  shadow(P.x, P.y + 5, 8);
  drawSpr(SPR[save.sel][fr], P.x, P.y - 1 + bob, P.face < 0, P.dashT > 0);
}
function drawEnemy(e) {
  const d = EN[e.type], fr = SPR[d.spr];
  const f = fr[Math.floor(e.t * (e.type === 'bat' || e.type === 'queen' ? 10 : 5)) % fr.length];
  let flip = P.x < e.x;
  if (e.type === 'thief') flip = !flip;
  if (e.type === 'charger' && e.cst !== 'chase') flip = Math.cos(e.ang) < 0;
  let flash = e.flash > 0;
  if (e.type === 'bomber' && e.fuse > 0) flash = Math.floor(e.fuse * 16) % 2 === 0;
  if (e.type === 'peeper' && e.cd < 0.4) flash = Math.floor(e.cd * 20) % 2 === 0;
  const sc = e.scale;
  if (e.spawnT > 0) ctx.globalAlpha = Math.max(0.2, 1 - e.spawnT / 0.3);
  if (e.type === 'ghost') ctx.globalAlpha = isPhased(e) ? 0.22 : 0.85;
  if ((e.type === 'charger' && e.cst === 'aim') || (e.type === 'queen' && e.st === 'dash')) telegraph(e.x, e.y, e.ang, e.boss ? 220 : 110);
  if (e.boss) addLight(e.x, e.y - (e.z || 0), 44);
  else if (e.elite) { addLight(e.x, e.y, 22); addGlow(e.x, e.y, 12, '#ffd23f'); }
  if (e.type === 'thief') { addLight(e.x, e.y, 28); addGlow(e.x, e.y, 10, '#ffd23f'); }
  if (e.type === 'ghost' && !isPhased(e)) addGlow(e.x, e.y, 9, '#a8c8ff');
  if ((e.type === 'peeper' && e.cd < 0.4) || (e.type === 'bomber' && e.fuse > 0)) addGlow(e.x, e.y, 10, '#ff4d6d');
  if (e.boss) {
    const z = e.z || 0;
    shadow(e.x, e.y + f.h * sc / 2 - 2, Math.max(10, f.w * sc * (1 - z / 90)));
    if (e.type === 'king' && e.st === 'crouch') {
      const w = f.w * 2 + 4, h = Math.round(f.h * 2 * 0.8);
      ctx.drawImage(flash ? f.f : f.c, Math.round(e.x - w / 2), Math.round(e.y + f.h - h), w, h);
    } else {
      const hover = e.type !== 'king' ? Math.sin(G.t * 3) * 2 - 4 : 0;
      drawSpr(f, e.x, e.y - z + hover, false, flash, 2);
    }
  } else {
    if (e.elite) ring(e.x, e.y + f.h * sc / 2 - 1, Math.round(e.r + 2), Math.floor(T * 6) % 2 ? '#ffd23f' : '#fff7b0');
    shadow(e.x, e.y + f.h * sc / 2 - 1, f.w * sc * 0.7);
    const bob = e.type === 'bat' ? Math.round(Math.sin(e.t * 8) * 1.5) - 3 : 0;
    const sq = e.flash > 0;
    drawSprSq(f, e.x, e.y + bob, flip, flash, sc, sq ? 1.25 : 1, sq ? 0.8 : 1);
    if (G.freeze > 0 && e.type !== 'thief') { ctx.globalAlpha = 0.45; drawSpr(f, e.x, e.y + bob, flip, true, sc); ctx.globalAlpha = 1; }
    if ((e.elite || e.type === 'golem' || e.type === 'splitter') && e.hp < e.maxHp) {
      const w = Math.max(10, e.r * 2), y = e.y - f.h * sc / 2 - 4;
      rect(e.x - w / 2 - 1, y - 1, w + 2, 4, '#1b1428');
      rect(e.x - w / 2, y, w * Math.max(0, e.hp / e.maxHp), 2, e.elite ? '#ffd23f' : '#ff4d6d');
    }
  }
  ctx.globalAlpha = 1;
}

/* ---------- Drawing: UI widgets ---------- */
function btn(id, x, y, w, h, label, onClick, col = '#ff8c2e', s = 2, enabled = true) {
  x = Math.round(x); y = Math.round(y);
  UI.list.push({ id, x, y, w, h, onClick, enabled });
  const pressed = UI.down === id;
  drawPanel(x, y + (pressed ? 1 : 0), w, h, enabled ? col : '#55506e', !pressed);
  const tc = enabled ? (col === '#ffd23f' || col === '#7ae8ff' || col === '#9dff7a' ? '#1b1428' : '#fff') : '#9a96b0';
  if (label) Font.draw(ctx, label, x + w / 2, y + (pressed ? 1 : 0) + Math.round(h / 2 - 2.5 * s) - 1, tc, s, 'center', tc === '#fff' ? shade(col, -0.45) : null);
}
function hotspot(id, x, y, w, h, onClick) { UI.list.push({ id, x, y, w, h, onClick, enabled: true }); }
function drawPanel(x, y, w, h, col, raised = true) {
  x = Math.round(x); y = Math.round(y);
  const dk = '#1b1428';
  rect(x + 1, y - 1, w - 2, h + (raised ? 3 : 2), dk);
  rect(x - 1, y + 1, w + 2, h - 2 + (raised ? 1 : 0), dk);
  rect(x, y, w, h + (raised ? 1 : 0), dk);
  if (raised) rect(x + 1, y + h - 1, w - 2, 2, shade(col, -0.35));
  rect(x, y, w, h - (raised ? 1 : 0), col);
  rect(x + 1, y + 1, w - 2, 1, shade(col, 0.35));
  rect(x, y + 1, 1, h - 3, shade(col, 0.15));
}
function coinLabel(x, y, n, align = 'right', s = 1) {
  const txt = String(n), w = Font.width(txt, s) + 8;
  const sx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  drawSpr(Icons('coinA'), sx + 3, y + 2.5 * s);
  Font.outline(ctx, txt, sx + 8, y, '#ffd23f', '#1b1428', s);
}

/* ---------- Drawing: HUD ---------- */
function drawHUD() {
  const L = SAFE.l + 3, R = GW - SAFE.r - 3, top = SAFE.t + 2;
  // xp bar
  rect(L, top, R - L, 5, '#1b1428');
  rect(L + 1, top + 1, (R - L - 2) * Math.min(1, G.xp / G.need), 3, '#5ef0ff');
  rect(L + 1, top + 1, (R - L - 2) * Math.min(1, G.xp / G.need), 1, '#d4fbff');
  // hearts
  const hy = top + 8;
  const per = Math.max(5, Math.floor((GW * 0.45) / 8));
  for (let i = 0; i < st.maxHp; i++) {
    const full = i < P.hp;
    const hx = L + 4 + (i % per) * 8, hhy = hy + 4 + Math.floor(i / per) * 8;
    const pulse = P.hp === 1 && full && Math.floor(T * 4) % 2 ? -1 : 0;
    drawSpr(Icons('hp', full ? '#ff4d6d' : '#3b3a52'), hx, hhy + pulse);
  }
  if (P.shield) drawSpr(Icons('shield', '#7ae8ff'), L + 4 + Math.min(st.maxHp, per) * 8, hy + 4);
  const rows = Math.ceil(st.maxHp / per);
  Font.outline(ctx, 'LV ' + G.lvl, L + 1, hy + rows * 8 + 3, '#5ef0ff');
  // pause button
  const pb = { x: R - 14, y: hy, w: 14, h: 13 };
  btn('pause', pb.x, pb.y, pb.w, pb.h, '', pauseGame, '#55506e', 1);
  rect(pb.x + 4, pb.y + 3 + (UI.down === 'pause' ? 1 : 0), 2, 6, '#fff'); rect(pb.x + 8, pb.y + 3 + (UI.down === 'pause' ? 1 : 0), 2, 6, '#fff');
  coinLabel(R - 18, hy + 4, G.coins);
  // wave
  const cx = GW / 2;
  if (G.boss) {
    const b = G.boss, w = Math.min(GW - 60, 160);
    Font.outline(ctx, b.name, cx, hy + 1, '#ff7a7a', '#1b1428', 1, 'center');
    rect(cx - w / 2 - 1, hy + 8, w + 2, 6, '#1b1428');
    rect(cx - w / 2, hy + 9, w * Math.max(0, b.hp / b.maxHp), 4, '#ff4d6d');
    rect(cx - w / 2, hy + 9, w * Math.max(0, b.hp / b.maxHp), 1, '#ff9ab0');
  } else {
    Font.outline(ctx, 'WAVE ' + G.wave, cx, hy + 1, '#fff', '#1b1428', 1, 'center');
    const w = 34;
    rect(cx - w / 2 - 1, hy + 8, w + 2, 4, '#1b1428');
    rect(cx - w / 2, hy + 9, w * Math.min(1, G.waveT / G.waveLen), 2, G.mod.col || '#ffd23f');
    if (G.mod.name) Font.outline(ctx, G.mod.name, cx, hy + 15, G.mod.col, '#1b1428', 1, 'center');
  }
  if (G.mtoast && Math.floor(G.mtoast.t * 6) % 4) Font.outline(ctx, 'GOAL DONE: ' + G.mtoast.txt, cx, hy + 24, '#5ed15a', '#1b1428', 1, 'center');
  if (G.freeze > 0) Font.outline(ctx, 'FROZEN ' + Math.ceil(G.freeze), cx, GH - SAFE.b - 14, '#a8e6ff', '#1b1428', 1, 'center');
  // combo
  if (G.combo >= 5) {
    const y = Math.round(GH * 0.3);
    const pulse = G.comboT > 2.2 ? 1 : 0;
    const col = G.fever > 0 ? `hsl(${(T * 400) % 360},100%,65%)` : G.combo >= 20 ? '#ff8c2e' : '#fff';
    Font.outline(ctx, G.combo + 'X', L + 1, y - pulse, col, '#1b1428', 2);
    Font.outline(ctx, 'COMBO', L + 1, y + 12, '#c0c8ff');
    const bw = 30;
    rect(L, y + 19, bw + 2, 4, '#1b1428');
    if (G.fever > 0) rect(L + 1, y + 20, bw * G.fever / 6, 2, col);
    else rect(L + 1, y + 20, bw * Math.min(1, G.comboT / 2.4), 2, '#c0c8ff');
    if (G.fever > 0) Font.outline(ctx, 'FEVER!', L + 1, y + 25, col);
  }
  // dash button (touch)
  if (usingTouch) {
    const d = dashBtnPos(), ready = P.dashCd <= 0;
    ctx.globalAlpha = 0.85;
    disc(d.x, d.y + 1, d.r + 1, '#1b1428');
    disc(d.x, d.y, d.r, ready ? '#7ae8ff' : '#3b3a52');
    if (!ready) {
      const p = 1 - Math.max(0, P.dashCd) / st.dashCd, h = Math.round(d.r * 2 * p);
      ctx.save(); ctx.beginPath(); ctx.rect(d.x - d.r, d.y + d.r - h, d.r * 2 + 1, h + 1); ctx.clip();
      disc(d.x, d.y, d.r, '#3f7f99'); ctx.restore();
    }
    ring(d.x, d.y, d.r, ready ? '#d4fbff' : '#55506e');
    ctx.globalAlpha = 1;
    Font.draw(ctx, 'DASH', d.x, d.y - 2, ready ? '#1b1428' : '#9a96b0', 1, 'center');
  }
  // joystick
  if (joy.active) {
    ctx.globalAlpha = 0.35; ring(joy.x0, joy.y0, 22, '#fff', 2); ctx.globalAlpha = 0.6;
    const dx = joy.x - joy.x0, dy = joy.y - joy.y0, l = Math.hypot(dx, dy), m = Math.min(l, 22) / (l || 1);
    disc(joy.x0 + dx * m, joy.y0 + dy * m, 8, '#fff'); ctx.globalAlpha = 1;
  }
}
function drawIndicators(c) {
  const list = [];
  for (const p of G.pickups) if (p.kind === 'chest') list.push([p, '#ffd23f']);
  if (G.boss) list.push([G.boss, '#ff4d6d']);
  for (const e of G.enemies) if (e.type === 'thief' && !e.dead) list.push([e, '#ffd23f']);
  const m = 12, top = SAFE.t + 34, bot = SAFE.b + 12;
  for (const [o, col] of list) {
    const sx = o.x - c.x, sy = o.y - c.y;
    if (sx > 0 && sx < GW && sy > 0 && sy < GH) continue;
    const cx = GW / 2, cy = GH / 2, dx = sx - cx, dy = sy - cy;
    const k = Math.min((GW / 2 - m) / Math.abs(dx || 0.001), (GH / 2 - m) / Math.abs(dy || 0.001));
    const x = clamp(cx + dx * k, m, GW - m), y = clamp(cy + dy * k, top, GH - bot);
    const a = Math.atan2(dy, dx), pulse = Math.floor(T * 4) % 2;
    disc(x, y, 5 + pulse, '#1b1428'); disc(x, y, 4 + pulse, col);
    for (let i = 0; i < 4; i++) rect(x + Math.cos(a) * (7 + i) - 1, y + Math.sin(a) * (7 + i) - 1, 3 - i * 0.5, 3 - i * 0.5, col);
    if (o.kind === 'chest') rect(x - 2, y - 1, 4, 3, '#8a4a24'); else Font.draw(ctx, '!', x, y - 2, '#fff', 1, 'center');
  }
}
function drawBanner() {
  const b = G.banner; if (!b) return;
  const age = b.max - b.t, slide = Math.min(1, age / 0.18), out = Math.min(1, b.t / 0.25);
  const y = Math.round(GH * 0.24);
  const h = b.sub2 ? 40 : b.sub ? 32 : 22;
  ctx.globalAlpha = 0.65 * out; rect(0, y - 6, GW, h, '#1b1428'); ctx.globalAlpha = 1;
  const off = (1 - slide) * GW;
  const ts = Font.width(b.title, 3) < GW - 10 ? 3 : 2;
  Font.outline(ctx, b.title, GW / 2 - off, y, b.col, '#1b1428', ts, 'center');
  if (b.sub) Font.outline(ctx, b.sub, GW / 2 + off, y + 5 * ts + 4, b.title === 'BOSS!' ? '#fff' : (b.col === '#fff' ? '#ffd23f' : '#fff'), '#1b1428', 1, 'center');
  if (b.sub2) Font.outline(ctx, b.sub2, GW / 2 + off, y + 5 * ts + 12, '#c0c8ff', '#1b1428', 1, 'center');
}
function drawLetterbox() {
  if (G.letterbox <= 0) return;
  const k = Math.min(1, (2.6 - G.letterbox) / 0.3, G.letterbox / 0.3), h = Math.round(24 * k);
  rect(0, 0, GW, h + SAFE.t, '#000'); rect(0, GH - h - SAFE.b, GW, h + SAFE.b, '#000');
}
function drawAnnounce() {
  const a = G.announce; if (!a) return;
  if (a.t < 0.3 && Math.floor(a.t * 20) % 2) return;
  const age = a.max - a.t, y = Math.round(GH * (G.banner || G.letterbox > 0 ? 0.6 : 0.4));
  let s = age < 0.1 ? 4 : 3; while (s > 1 && Font.width(a.txt, s) > GW - 8) s--;
  const col = a.tier >= 3 ? ['#ff4cd2', '#ffd23f', '#5ef0ff', '#5ed15a'][Math.floor(T * 12) % 4] : a.col;
  Font.outline(ctx, a.txt, GW / 2 + (age < 0.25 ? rnd(-2, 2) : 0), y, col, '#1b1428', s, 'center');
  Font.outline(ctx, a.sub, GW / 2, y + 5 * s + 4, '#fff', '#1b1428', 1, 'center');
}
function drawScreenFx() {
  if (G.freeze > 0) {
    const k = Math.min(1, G.freeze);
    ctx.globalAlpha = 0.14 * k; rect(0, 0, GW, GH, '#a8e6ff');
    ctx.globalAlpha = 0.6 * k; rect(0, 0, GW, 3, '#e8f6ff'); rect(0, GH - 3, GW, 3, '#e8f6ff'); rect(0, 0, 3, GH, '#e8f6ff'); rect(GW - 3, 0, 3, GH, '#e8f6ff');
    ctx.globalAlpha = 1;
  }
  if (G.fever > 0) {
    const col = `hsl(${(T * 300) % 360},100%,60%)`;
    ctx.globalAlpha = 0.6; rect(0, 0, GW, 2, col); rect(0, GH - 2, GW, 2, col); rect(0, 0, 2, GH, col); rect(GW - 2, 0, 2, GH, col); ctx.globalAlpha = 1;
  }
  const low = P.hp === 1 && G.dying <= 0 ? 0.18 + Math.sin(T * 6) * 0.1 : 0;
  const hurt = Math.max(0, G.hurtFx) * 1.2;
  const a = Math.max(low, hurt);
  if (a > 0) {
    ctx.globalAlpha = Math.min(0.6, a);
    for (let i = 0; i < 4; i++) { const w = 3 + i * 3; ctx.globalAlpha = Math.min(0.6, a) * (1 - i * 0.25); rect(0, 0, GW, w, '#ff1744'); rect(0, GH - w, GW, w, '#ff1744'); rect(0, 0, w, GH, '#ff1744'); rect(GW - w, 0, w, GH, '#ff1744'); }
    ctx.globalAlpha = 1;
  }
  if (G.flash > 0) { ctx.globalAlpha = Math.min(0.8, G.flash * 2); rect(0, 0, GW, GH, G.flashCol); ctx.globalAlpha = 1; }
}

/* ---------- Menu background ---------- */
const menuBg = { x: 200, y: 200, mobs: [] };
function initMenuBg() {
  if (!floorCv) buildFloor(0);
  menuBg.mobs = [];
  const types = ['slime', 'bat', 'slime', 'peeper', 'bomber', 'slime'];
  for (let i = 0; i < 9; i++) menuBg.mobs.push({ type: types[i % types.length], x: rnd(GW), y: rnd(GH), vx: rnd(-14, 14), vy: rnd(-10, 10), t: rnd(10) });
}
function drawMenuBg(dt) {
  menuBg.x += dt * 9; menuBg.y += dt * 5;
  const span = ARENA - WALL * 2 - Math.max(GW, GH) - 20;
  const ox = WALL + 10 + Math.abs(((menuBg.x % (span * 2)) + span * 2) % (span * 2) - span);
  const oy = WALL + 10 + Math.abs(((menuBg.y % (span * 2)) + span * 2) % (span * 2) - span);
  drawFloor(Math.round(ox), Math.round(oy), '#16121f');
  for (const m of menuBg.mobs) {
    m.t += dt; m.x += m.vx * dt; m.y += m.vy * dt;
    if (m.x < -10) m.x = GW + 10; if (m.x > GW + 10) m.x = -10;
    if (m.y < -10) m.y = GH + 10; if (m.y > GH + 10) m.y = -10;
    const fr = SPR[EN[m.type].spr];
    drawSpr(fr[Math.floor(m.t * 5) % fr.length], m.x, m.y + (m.type === 'bat' ? Math.sin(m.t * 6) * 2 : 0), m.vx < 0);
  }
  ctx.globalAlpha = 0.55; rect(0, 0, GW, GH, '#1b1428'); ctx.globalAlpha = 1;
}

/* ---------- Screens ---------- */
function drawTitle(cx, y, big) {
  const word = 'PUPPX', s = big ? 4 : 3;
  let x = cx - Font.width(word, s) / 2;
  for (let i = 0; i < word.length; i++) {
    const ch = word[i], yy = y + Math.round(Math.sin(T * 3 + i * 0.8) * 2);
    const col = ['#ff8c2e', '#ffd23f', '#5ed15a', '#5ef0ff', '#ff4cd2'][i];
    Font.draw(ctx, ch, x, yy + 2, shade(col, -0.55), s);
    Font.outline(ctx, ch, x, yy, col, '#1b1428', s);
    x += Font.width(ch, s) + s;
  }
  Font.outline(ctx, 'RAMPAGE', cx, y + 5 * s + 6, '#fff', '#ff4d6d', 2, 'center');
  return y + 5 * s + 5 + 12;
}
function drawMenu() {
  const land = GW > GH * 1.25;
  const top = SAFE.t + 4;
  coinLabel(GW - SAFE.r - 4, top + 2, save.coins, 'right', 2);
  if (save.bestWave) Font.outline(ctx, 'BEST WAVE ' + save.bestWave, SAFE.l + 4, top + 4, '#c0c8ff');
  const colA = land ? GW * 0.3 : GW / 2, colB = land ? GW * 0.72 : GW / 2;
  const ty = land ? Math.max(top + 16, GH * 0.1) : Math.max(top + 18, GH * 0.12);
  drawTitle(colA, ty, GW >= 150);
  // character
  const id = save.sel, ch = CHARS[id], unlocked = !!save.unlocked[id];
  const cy = land ? GH * 0.62 : GH * 0.42;
  const sc = 4, fr = SPR[id][Math.floor(T * 4) % 2];
  shadow(colA, cy + fr.h * sc / 2 - 2, 28);
  drawSpr(fr, colA, cy + Math.round(Math.sin(T * 4)) , false, false, sc, !unlocked);
  if (!unlocked) drawSpr(Icons('lock', '#ffd23f'), colA, cy, false, false, 2);
  btn('prev', colA - 60, cy - 11, 20, 22, '<', () => cycleChar(-1), '#55506e', 2);
  btn('next', colA + 40, cy - 11, 20, 22, '>', () => cycleChar(1), '#55506e', 2);
  let ly = cy + fr.h * sc / 2 + 4;
  Font.outline(ctx, ch.name, colA, ly, unlocked ? '#fff' : '#9a96b0', '#1b1428', 2, 'center');
  ly += 13;
  for (const l of ch.lines) { Font.outline(ctx, l, colA, ly, '#c0c8ff', '#1b1428', 1, 'center'); ly += 8; }
  // buttons
  let by = land ? GH * 0.3 : Math.max(ly + 10, GH * 0.66);
  const bw = Math.min(130, GW - 40);
  if (unlocked) btn('play', colB - bw / 2, by, bw, 26, 'PLAY', tryPlay, '#ff8c2e', 3);
  else {
    const can = save.coins >= ch.cost;
    btn('unlock', colB - bw / 2, by, bw, 26, '', () => {
      if (save.coins >= ch.cost) { save.coins -= ch.cost; save.unlocked[id] = true; persist(); Sfx.buy(); } else Sfx.nope();
    }, can ? '#ffd23f' : '#55506e', 2, true);
    const p = UI.down === 'unlock' ? 1 : 0;
    Font.draw(ctx, 'UNLOCK', colB - 12, by + 6 + p, can ? '#1b1428' : '#9a96b0', 2, 'center');
    coinLabel(colB + bw / 2 - 6, by + 16 + p, ch.cost, 'right', 1);
  }
  by += 34;
  const hw2 = (bw - 6) / 2;
  btn('shop', colB - bw / 2, by, hw2, 20, 'SHOP', () => { scene = 'shop'; Sfx.select(); }, '#9b5de5', 2);
  btn('goals', colB - bw / 2 + hw2 + 6, by, hw2, 20, 'GOALS', () => { scene = 'missions'; Sfx.select(); }, '#3f9b52', 2);
  by += 28;
  const hw = (bw - 6) / 2;
  btn('sfx', colB - bw / 2, by, hw, 16, save.sfx ? 'SFX ON' : 'SFX OFF', () => { save.sfx = !save.sfx; Sfx.setSfx(save.sfx); persist(); Sfx.select(); }, save.sfx ? '#3f7f99' : '#55506e', 1);
  btn('mus', colB - bw / 2 + hw + 6, by, hw, 16, save.music ? 'MUSIC ON' : 'MUSIC OFF', () => { save.music = !save.music; Sfx.setMusic(save.music); persist(); Sfx.select(); }, save.music ? '#3f7f99' : '#55506e', 1);
  if (!Sfx.ready) Font.outline(ctx, 'TAP ANYWHERE FOR SOUND', GW / 2, GH - SAFE.b - 10, '#9a96b0', '#1b1428', 1, 'center');
}
function drawShop() {
  const top = SAFE.t + 4, land = GW > GH * 1.25;
  Font.outline(ctx, 'SHOP', SAFE.l + 6, top + 2, '#fff', '#9b5de5', 3, 'left');
  coinLabel(GW - SAFE.r - 4, top + 4, save.coins, 'right', 2);
  Font.outline(ctx, 'PERMANENT UPGRADES', SAFE.l + 6, top + 21, '#c0c8ff');
  const cols = land ? 2 : 1, gap = 6;
  const areaW = GW - SAFE.l - SAFE.r - 12;
  const rw = Math.min(240, (areaW - gap * (cols - 1)) / cols);
  const totalW = rw * cols + gap * (cols - 1);
  const x0 = (GW - totalW) / 2, y0 = top + 32, rh = 30;
  SHOP.forEach((it, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const x = Math.round(x0 + c * (rw + gap)), y = Math.round(y0 + r * (rh + 5));
    const lv = save.shop[it.id] || 0, maxed = lv >= it.max, cost = maxed ? 0 : it.cost(lv), can = !maxed && save.coins >= cost;
    drawPanel(x, y, rw, rh, '#2e2b45');
    drawSpr(Icons(it.icon, it.col), x + 11, y + 11, false, false, 2);
    Font.draw(ctx, it.name, x + 22, y + 4, '#fff', 1);
    Font.draw(ctx, it.desc, x + 22, y + 12, '#9a96b0', 1);
    for (let k = 0; k < it.max; k++) rect(x + 22 + k * 5, y + 20, 4, 4, k < lv ? it.col : '#1b1428');
    const bw = 40;
    btn('buy' + it.id, x + rw - bw - 4, y + 6, bw, 16, maxed ? 'MAX' : '', () => {
      const l = save.shop[it.id] || 0;
      if (l >= it.max) return;
      const cc = it.cost(l);
      if (save.coins >= cc) { save.coins -= cc; save.shop[it.id] = l + 1; persist(); Sfx.buy(); } else Sfx.nope();
    }, maxed ? '#55506e' : can ? '#ffd23f' : '#55506e', 1, !maxed);
    if (!maxed) coinLabel(x + rw - bw / 2 - 4 + 4, y + 11 + (UI.down === 'buy' + it.id ? 1 : 0), cost, 'center');
  });
  const rows = Math.ceil(SHOP.length / cols);
  const by = Math.min(GH - SAFE.b - 26, y0 + rows * (rh + 5) + 6);
  btn('back', GW / 2 - 50, by, 100, 20, 'BACK', () => { scene = 'menu'; Sfx.select(); }, '#55506e', 2);
}
function drawMissions() {
  const top = SAFE.t + 4;
  Font.outline(ctx, 'GOALS', SAFE.l + 6, top + 2, '#fff', '#3f9b52', 3, 'left');
  coinLabel(GW - SAFE.r - 4, top + 4, save.coins, 'right', 2);
  Font.outline(ctx, 'FINISH GOALS TO EARN COINS', SAFE.l + 6, top + 21, '#c0c8ff');
  const rw = Math.min(260, GW - 16), x = Math.round(GW / 2 - rw / 2);
  let y = top + 34;
  for (const m of save.missions) {
    const def = MISSION_POOL[m.i];
    drawPanel(x, y, rw, 32, m.done ? '#2f5a3a' : '#2e2b45');
    drawSpr(Icons('flag', m.done ? '#5ed15a' : '#ffd23f'), x + 11, y + 13, false, false, 2);
    Font.draw(ctx, def.txt(m.n), x + 22, y + 5, '#fff', 1);
    const bw = rw - 70;
    rect(x + 22, y + 14, bw, 5, '#1b1428'); rect(x + 23, y + 15, (bw - 2) * Math.min(1, m.p / m.n), 3, m.done ? '#5ed15a' : '#ffd23f');
    Font.draw(ctx, m.done ? 'DONE!' : Math.floor(m.p) + ' / ' + m.n, x + 22, y + 23, m.done ? '#5ed15a' : '#9a96b0', 1);
    coinLabel(x + rw - 8, y + 13, m.r, 'right', 1);
    y += 38;
  }
  Font.outline(ctx, 'COINS ARE PAID WHEN A RUN ENDS', GW / 2, y + 2, '#9a96b0', '#1b1428', 1, 'center');
  btn('back', GW / 2 - 50, Math.min(GH - SAFE.b - 26, y + 16), 100, 20, 'BACK', () => { scene = 'menu'; Sfx.select(); }, '#55506e', 2);
}
function drawLevelUp(dt) {
  G.lvT += dt;
  ctx.globalAlpha = 0.72; rect(0, 0, GW, GH, '#120e1c'); ctx.globalAlpha = 1;
  const land = GW > GH * 1.25;
  const top = SAFE.t + 6;
  const bounce = Math.max(0, 1 - G.lvT * 4) * 8;
  const tY = land ? top + 2 : Math.max(top + 4, GH * 0.12);
  Font.outline(ctx, 'LEVEL UP!', GW / 2, tY - bounce, `hsl(${(T * 200) % 360},100%,70%)`, '#1b1428', 3, 'center');
  Font.outline(ctx, G.pendingLv > 1 ? 'PICK ONE  (' + G.pendingLv + ' TO GO)' : 'PICK ONE', GW / 2, tY + 19, '#c0c8ff', '#1b1428', 1, 'center');
  const ch = G.choices || [];
  const ready = G.lvT > 0.4;
  if (land) {
    const cw = Math.min(118, (GW - 24 - SAFE.l - SAFE.r) / 3), chh = Math.min(96, GH - tY - 60);
    const x0 = GW / 2 - (cw * 3 + 12) / 2;
    ch.forEach((c, i) => drawCard(c, x0 + i * (cw + 6), tY + 30, cw, chh, i, true, ready));
  } else {
    const cw = Math.min(GW - 16, 230), chh = 38, x = GW / 2 - cw / 2;
    const y0 = tY + 32;
    ch.forEach((c, i) => drawCard(c, x, y0 + i * (chh + 8), cw, chh, i, false, ready));
  }
  const by = land ? GH - SAFE.b - 22 : Math.min(GH - SAFE.b - 26, tY + 32 + 3 * 46 + 6);
  btn('reroll', GW / 2 - 45, by, 90, 18, 'REROLL ' + G.rerolls, doReroll, G.rerolls > 0 ? '#3f7f99' : '#55506e', 1, G.rerolls > 0);
}
function drawCard(c, x, y, w, h, i, vertical, ready) {
  const appear = Math.min(1, Math.max(0, (G.lvT - i * 0.07) / 0.18));
  if (appear <= 0) return;
  const oy = Math.round((1 - appear) * 20);
  y = Math.round(y + oy); x = Math.round(x);
  const id = 'card' + i;
  if (ready) hotspot(id, x, y, w, h, () => chooseUpg(i));
  const pressed = UI.down === id;
  const lv = G.lv[c.u.id] || 0;
  const col = c.u.evo ? ['#ff4cd2', '#ffd23f', '#5ef0ff', '#5ed15a'][Math.floor(T * 8) % 4] : c.rare ? (Math.floor(T * 6) % 2 ? '#ffd23f' : '#ffe98a') : '#3a3558';
  drawPanel(x, y + (pressed ? 1 : 0), w, h, col, !pressed);
  rect(x + 2, y + 2 + (pressed ? 1 : 0), w - 4, h - 5, '#2a2640');
  const py = y + (pressed ? 1 : 0);
  const badge = c.u.evo ? 'EVOLVE!' : c.u.filler ? '' : lv === 0 ? 'NEW!' : 'LV ' + (lv + 1 + (c.rare ? 1 : 0));
  if (vertical) {
    drawSpr(Icons(c.u.icon, c.u.col), x + w / 2, py + 16, false, false, 2);
    const ns = Font.width(c.u.name, 2) <= w - 6 ? 2 : 1;
    Font.draw(ctx, c.u.name, x + w / 2, py + 30, c.u.col, ns, 'center', '#000');
    wrapText(c.u.desc(lv), x + w / 2, py + 44, w - 8, '#fff');
    if (badge) Font.draw(ctx, badge, x + w / 2, py + h - 12, c.u.evo ? '#ff4cd2' : lv === 0 ? '#5ed15a' : '#c0c8ff', 1, 'center');
    if (c.rare) Font.draw(ctx, 'RARE X2', x + w / 2, py + 4, '#ffd23f', 1, 'center');
  } else {
    drawSpr(Icons(c.u.icon, c.u.col), x + 16, py + h / 2 - 1, false, false, 2);
    Font.draw(ctx, c.u.name, x + 32, py + 7, c.u.col, 2, 'left', '#000');
    Font.draw(ctx, c.u.desc(lv), x + 32, py + 22, '#fff', 1);
    if (badge) Font.draw(ctx, badge, x + w - 6, py + 6, c.u.evo ? '#ff4cd2' : lv === 0 ? '#5ed15a' : '#c0c8ff', 1, 'right');
    if (c.rare) Font.draw(ctx, 'RARE X2', x + w - 6, py + 22, '#ffd23f', 1, 'right');
  }
  if (!usingTouch) Font.draw(ctx, String(i + 1), x + 4, py + 4, '#55506e', 1);
}
function wrapText(str, cx, y, w, col) {
  const words = str.split(' '); let line = '', ly = y;
  for (const wd of words) {
    const t = line ? line + ' ' + wd : wd;
    if (Font.width(t) > w && line) { Font.draw(ctx, line, cx, ly, col, 1, 'center'); line = wd; ly += 8; }
    else line = t;
  }
  if (line) Font.draw(ctx, line, cx, ly, col, 1, 'center');
}
function drawPause() {
  ctx.globalAlpha = 0.75; rect(0, 0, GW, GH, '#120e1c'); ctx.globalAlpha = 1;
  const cx = GW / 2; let y = Math.max(SAFE.t + 10, GH * 0.16);
  Font.outline(ctx, 'PAUSED', cx, y, '#fff', '#9b5de5', 3, 'center');
  y += 22;
  Font.outline(ctx, 'WAVE ' + G.wave + '   ' + fmtTime(G.t) + '   KO ' + G.kills, cx, y, '#c0c8ff', '#1b1428', 1, 'center');
  y += 12;
  // owned upgrades
  const owned = UPGS.filter(u => G.lv[u.id]);
  const per = Math.max(1, Math.floor((GW - 20) / 22));
  owned.forEach((u, i) => {
    const x = cx - (Math.min(per, owned.length) * 22) / 2 + (i % per) * 22 + 11, yy = y + Math.floor(i / per) * 24 + 8;
    drawSpr(Icons(u.icon, u.col), x, yy, false, false, 2);
    Font.outline(ctx, String(G.lv[u.id]), x + 7, yy + 4, '#fff');
    if (st.evo[u.id]) drawSpr(Icons('evo', '#ff4cd2'), x - 7, yy - 7);
  });
  y += Math.ceil(owned.length / per) * 24 + 10;
  const bw = Math.min(130, GW - 40);
  y = Math.min(y, GH - SAFE.b - 96);
  btn('resume', cx - bw / 2, y, bw, 24, 'RESUME', resumeGame, '#5ed15a', 2); y += 32;
  const hw = (bw - 6) / 2;
  btn('psfx', cx - bw / 2, y, hw, 16, save.sfx ? 'SFX ON' : 'SFX OFF', () => { save.sfx = !save.sfx; Sfx.setSfx(save.sfx); persist(); }, save.sfx ? '#3f7f99' : '#55506e', 1);
  btn('pmus', cx - bw / 2 + hw + 6, y, hw, 16, save.music ? 'MUSIC ON' : 'MUSIC OFF', () => { save.music = !save.music; Sfx.setMusic(save.music); persist(); }, save.music ? '#3f7f99' : '#55506e', 1);
  y += 24;
  btn('quit', cx - bw / 2, y, bw, 18, 'GIVE UP', () => { P.hp = 0; scene = 'play'; G.dying = 0.01; }, '#c23a5a', 1);
}
function drawGameOver(dt) {
  overT += dt;
  ctx.globalAlpha = Math.min(0.8, overT * 2); rect(0, 0, GW, GH, '#120e1c'); ctx.globalAlpha = 1;
  const land = GW > GH * 1.25, cx = GW / 2, oi = overInfo;
  let y = Math.max(SAFE.t + 8, land ? 8 : GH * 0.1);
  const ts = Font.width(oi.title, 3) < GW - 12 ? 3 : 2;
  Font.outline(ctx, oi.title, cx, y + Math.max(0, 1 - overT * 3) * -20, '#ff4d6d', '#1b1428', ts, 'center');
  y += 5 * ts + 8;
  const stats = [['WAVE', G.wave, oi.newBestWave], ['TIME', fmtTime(G.t)], ['KILLS', G.kills], ['LEVEL', G.lvl], ['BEST COMBO', G.bestCombo]];
  const sw = Math.min(150, GW - 30);
  stats.forEach(([k, v, best], i) => {
    if (overT < 0.2 + i * 0.08) return;
    const yy = y + i * 9;
    Font.outline(ctx, k, cx - sw / 2, yy, '#c0c8ff');
    Font.outline(ctx, String(v), cx + sw / 2, yy, best ? '#ffd23f' : '#fff', '#1b1428', 1, 'right');
  });
  y += stats.length * 9 + 4;
  if (overT > 0.7) {
    Font.outline(ctx, 'SCORE', cx, y, '#c0c8ff', '#1b1428', 1, 'center');
    Font.outline(ctx, String(G.score), cx, y + 8, oi.newBestScore ? '#ffd23f' : '#fff', '#1b1428', 2, 'center');
    if (oi.newBestScore && Math.floor(T * 4) % 2) Font.outline(ctx, 'NEW BEST!', cx, y + 21, '#ffd23f', '#1b1428', 1, 'center');
  }
  y += 30;
  if (overT > 0.9) coinLabel(cx, y, '+' + oi.earned, 'center', 2);
  y += 18;
  for (const m of oi.missions) { if (overT > 1.1) Font.outline(ctx, 'GOAL: ' + m.txt + '  +' + m.r, cx, y, '#5ed15a', '#1b1428', 1, 'center'); y += 9; }
  Font.outline(ctx, oi.tip, cx, Math.min(y, GH - SAFE.b - 58), '#9a96b0', '#1b1428', 1, 'center');
  y += 12;
  if (overT > 0.8) {
    const bw = Math.min(130, GW - 40);
    const by = Math.min(y, GH - SAFE.b - 46);
    btn('retry', cx - bw / 2, by, bw, 24, 'RETRY', () => { Sfx.select(); newRun(); }, '#ff8c2e', 2);
    btn('menu', cx - bw / 2, by + 30, bw, 16, 'MENU', () => { Sfx.select(); scene = 'menu'; Sfx.song('menu'); initMenuBg(); }, '#55506e', 1);
  }
}

/* ---------- Main loop ---------- */
let lastT = performance.now();
function frame(now) {
  const rdt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
  lastT = now; T += rdt;
  UI.list = [];
  if (scene === 'play') updateGame(rdt);
  if (scene === 'menu' || scene === 'shop' || scene === 'missions') {
    drawMenuBg(rdt);
    if (scene === 'menu') drawMenu(); else if (scene === 'shop') drawShop(); else drawMissions();
  } else {
    if (scene === 'over') updateFx(rdt * 0.5);
    const c = drawWorld();
    if (scene === 'play' || scene === 'pause' || scene === 'levelup') { drawIndicators(c); drawHUD(); drawLetterbox(); drawAnnounce(); drawBanner(); }
    drawScreenFx();
    if (scene === 'pause') drawPause();
    else if (scene === 'levelup') drawLevelUp(rdt);
    else if (scene === 'over') drawGameOver(rdt);
  }
  requestAnimationFrame(frame);
}
initMenuBg();
Sfx.song('menu');
requestAnimationFrame(frame);

/* Small hook for automated testing / debugging from the console. */
window.__rampage = { get scene() { return scene; }, get G() { return G; }, get P() { return P; }, get st() { return st; }, get UI() { return UI; }, keys, input, newRun, nextWave, chooseUpg, save, buildFloor, placeRocks, spawnEnemy, spawnBoss, spawnThief, announce, applyUpg, UPG_BY, EVO_UPG, dropPickup };
