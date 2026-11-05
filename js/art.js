'use strict';
/* All pixel art lives here as text grids. Each char is a palette key; '.' is transparent. */
const PAL = {
  k: '#1b1428', n: '#0d0a12', w: '#fff4e0', W: '#ffffff',
  b: '#d08a4e', B: '#8a4a24', p: '#ff7aa8', g: '#a3a9c2', G: '#636a88',
  y: '#ffd23f', o: '#ff8c2e', r: '#e8344c', R: '#9e1f3a',
  e: '#5ed15a', E: '#2f8a3c', l: '#b8f28a', s: '#5ed15a',
  u: '#4aa3ff', U: '#2a5bd1', v: '#9b5de5', V: '#5b2a9a',
  d: '#3b3a52', D: '#24233a', c: '#7ae8ff', m: '#ff4cd2', x: '#ffffff',
};

const LEGS_A = '.kk....kk.';
const LEGS_B = '..kk..kk..';

const SPR_SRC = {
  pup: [
    '.kk....kk.',
    'kbbk..kbbk',
    'kbbkkkkbbk',
    'kbwwwwwwbk',
    'kbwnwwnwbk',
    '.kwwkkwwk.',
    '.kwwwpwwk.',
    '..kkkkkk..',
    '.kbbwwbbk.',
    '.kbbbbbbk.',
  ],
  cat: [
    '.k......k.',
    'kgk....kgk',
    'kggkkkkggk',
    'kggggggggk',
    'kgynggnygk',
    '.kggppggk.',
    '.kgwwwwgk.',
    '..kkkkkk..',
    '.kggwwggk.',
    '.kggggggk.',
  ],
  frog: [
    '.kkk..kkk.',
    'kwnwkkwnwk',
    'kwwweewwwk',
    'keeeeeeeek',
    'kpeeeeeepk',
    'keekkkkeek',
    '.keeeeeek.',
    '..kkkkkk..',
    '.keelleek.',
    '.keeeeeek.',
  ],
  bun: [
    '..kk..kk..',
    '.kwpkkwpk.',
    '.kwpkkwpk.',
    '.kwwwwwwk.',
    'kwwwwwwwwk',
    'kwnwwwwnwk',
    'kwwwppwwwk',
    '.kwwwwwwk.',
    '..kkkkkk..',
    '.kwwuuwwk.',
  ],
  slimeA: [
    '..kkkk..',
    '.kllssk.',
    'klsssssk',
    'ksnssnsk',
    'kssssssk',
    '.kkkkkk.',
  ],
  slimeB: [
    '........',
    '..kkkk..',
    '.klsssk.',
    'ksnssnsk',
    'kssssssk',
    'kkkkkkkk',
  ],
  batA: [
    'kk.......kk',
    'kvk.kkk.kvk',
    'kvvkvvvkvvk',
    '.kkvrvrvkk.',
    '...kvvvk...',
    '....kkk....',
  ],
  batB: [
    '...........',
    '....kkk....',
    '..kkvvvkk..',
    '.kvvrvrvvk.',
    'kvvkvvvkvvk',
    'kk..kkk..kk',
  ],
  peeper: [
    '..kkkk..',
    '.kwwwwk.',
    'kwwuuwwk',
    'kwunnuwk',
    'kwunnuwk',
    'kwwuuwwk',
    '.kwrwwk.',
    '..kkkk..',
  ],
  bomberA: [
    '......yo.',
    '.....k...',
    '....k....',
    '..kkkkk..',
    '.kdwdddk.',
    'kdwdddddk',
    'kdddddddk',
    'kdrddrddk',
    'kdddddddk',
    '.kdddddk.',
    '..kkkkk..',
  ],
  bomberB: [
    '......oy.',
    '.....k...',
    '....k....',
    '..kkkkk..',
    '.kdwdddk.',
    'kdwdddddk',
    'kdddddddk',
    'kdrddrddk',
    'kdddddddk',
    '.kdddddk.',
    '.kk...kk.',
  ],
  golemA: [
    '...kkkkkk...',
    '..kggggggk..',
    '.kgyggggygk.',
    '.kggggggggk.',
    'kkgGGGGGGgkk',
    'kgkggggggkgk',
    'kgkggggggkgk',
    'kkkGGGGGGkkk',
    '..kggkkggk..',
    '..kgk..kgk..',
    '..kkk..kkk..',
  ],
  golemB: [
    '...kkkkkk...',
    '..kggggggk..',
    '.kgyggggygk.',
    '.kggggggggk.',
    'kkgGGGGGGgkk',
    'kgkggggggkgk',
    'kgkggggggkgk',
    'kkkGGGGGGkkk',
    '..kggkkggk..',
    '.kgk....kgk.',
    '.kkk....kkk.',
  ],
  king: [
    '....y..y..y.....',
    '....yyyyyyy.....',
    '...kkkkkkkkk....',
    '..kllssssssssk..',
    '.klsssssssssssk.',
    'klsssssssssssssk',
    'ksssnnssssnnsssk',
    'ksssnwssssnwsssk',
    'kssssssssssssssk',
    'kssssskkkksssssk',
    'kssssssssssssssk',
    '.kssssssssssssk.',
    '..kkkkkkkkkkkk..',
  ],
  eye: [
    '....kkkkkkkk....',
    '..kkvvvvvvvvkk..',
    '.kvvwwwwwwwwvvk.',
    '.kvwrwwwwwwrwvk.',
    'kvwwwwuuuuwwwwvk',
    'kvwwwuuuuuuwwwvk',
    'kvwwuunnnnuuwwvk',
    'kvwwuunnnnuuwwvk',
    'kvwwuunnnnuuwwvk',
    'kvwwwuuuuuuwwwvk',
    'kvwwwwuuuuwwwwvk',
    '.kvwrwwwwwwwwvk.',
    '.kvvwwwwwwwwvvk.',
    '..kkvvvvvvvvkk..',
    '...kv.kv.kv.k...',
    '...v..v..v..v...',
  ],
  chest: [
    '.kkkkkkkk.',
    'kbbbbbbbbk',
    'kBBBBBBBBk',
    'kyyyyyyyyk',
    'kbbbyybbbk',
    'kbbbkkbbbk',
    'kBBBBBBBBk',
    'kkkkkkkkkk',
  ],
  rock: [
    '...kkkkkk...',
    '..kgggggGk..',
    '.kglgggggGk.',
    'kgllggggGGGk',
    'kglgggggGGGk',
    'kggggggGGGGk',
    '.kGGGGGGGGk.',
    '..kkkkkkkk..',
  ],
  bone: [
    'kk...kk',
    'kwkkkwk',
    'kwwwwwk',
    'kwkkkwk',
    'kk...kk',
  ],
  boomer: [
    'kkkkk.',
    'kllllk',
    'klkkkk',
    'klk...',
    'klk...',
    'kkk...',
  ],
  chargerA: [
    '..kkkkkkk....',
    '.kBBBBBBBkk..',
    'kBbbbbbbbbk..',
    'kbbbbbbbbnbkk',
    'kbbbbbbbbbbpk',
    'kbbbbbbbbbwwk',
    '.kbbkkkkbbkk.',
    '.kkk....kkk..',
  ],
  chargerB: [
    '..kkkkkkk....',
    '.kBBBBBBBkk..',
    'kBbbbbbbbbk..',
    'kbbbbbbbbnbkk',
    'kbbbbbbbbbbpk',
    'kbbbbbbbbbwwk',
    '.kbbk..kbbkk.',
    '..kk....kk...',
  ],
  ghostA: [
    '..kkkkk..',
    '.kwwwwwk.',
    'kwwwwwwwk',
    'kwnwwwnwk',
    'kwnwwwnwk',
    'kwwwwwwwk',
    'kwwwkwwwk',
    'kwwwwwwwk',
    'kwk.kwk.k',
  ],
  ghostB: [
    '..kkkkk..',
    '.kwwwwwk.',
    'kwwwwwwwk',
    'kwnwwwnwk',
    'kwnwwwnwk',
    'kwwwwwwwk',
    'kwwwkwwwk',
    'kwwwwwwwk',
    '.kwk.kwk.',
  ],
  shroom: [
    '..kkkkk..',
    '.krrwrrk.',
    'krwrrrwrk',
    'krrrrrrrk',
    'kkkkkkkkk',
    '..kwwwk..',
    '..knwnk..',
    '..kwwwk..',
    '..kkkkk..',
  ],
  thiefA: [
    '..k...k..',
    '.kyk.kyk.',
    '.kyyyyyk.',
    'kynyyynyk',
    'kyyywyyyk',
    '.kyyyyyk.',
    '..kkkkk..',
    '.kyk.kyk.',
    '.kk...kk.',
  ],
  thiefB: [
    '..k...k..',
    '.kyk.kyk.',
    '.kyyyyyk.',
    'kynyyynyk',
    'kyyywyyyk',
    '.kyyyyyk.',
    '..kkkkk..',
    '..kykyk..',
    '..kk.kk..',
  ],
  queenA: [
    '......yyyy......',
    'kk....kkkk....kk',
    'kvk..kvvvvk..kvk',
    'kvvkkvvvvvvkkvvk',
    'kvvvvvrvvrvvvvvk',
    'kvvvvvvvvvvvvvvk',
    '.kvvvvwvvwvvvvk.',
    '.kvvkvvvvvvkvvk.',
    '..kk.kvvvvk.kk..',
    '.....kvvvvk.....',
    '......kkkk......',
  ],
  queenB: [
    '......yyyy......',
    '......kkkk......',
    '.....kvvvvk.....',
    '.kkkkvvvvvvkkkk.',
    'kvvvvvrvvrvvvvvk',
    'kvvvvvvvvvvvvvvk',
    '.kvvvvwvvwvvvvk.',
    'kvvvkvvvvvvkvvvk',
    'kvk..kvvvvk..kvk',
    'kk...kvvvvk...kk',
    '......kkkk......',
  ],
  missile: [
    '.kkkk..',
    'kwwwwrk',
    '.kkkk..',
  ],
  bomb: [
    '....yo',
    '...k..',
    '.kkkk.',
    'kdwddk',
    'kddddk',
    'kddddk',
    '.kkkk.',
  ],
};

/* Small icons, auto-outlined. 'x' = icon colour, 'w' = highlight. */
const ICON_SRC = {
  power: ['.....xx', '....xxx', '...xxx.', 'x.xxx..', '.xxx...', '.xx....', 'x.x....'],
  rate: ['....xx.', '...xx..', '..xx...', '.xxxxx.', '...xx..', '..xx...', '.xx....'],
  multi: ['x..x..x', 'x..x..x', '.x.x.x.', '.x.x.x.', '..xxx..', '..xxx..', '...x...'],
  pierce: ['...x...', '..xxx..', '.x.x.x.', '...x...', '...x...', '..x.x..', '.x...x.'],
  big: ['..xxx..', '.xxxxx.', 'xxwxxxx', 'xwxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..'],
  speed: ['..xxx..', '..xxx..', '..xxx..', '..xxxx.', '..xxxxx', 'xxxxxxx', 'xxxxxxx'],
  heart: ['.xx.xx.', 'xwxxxxx', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'],
  magnet: ['ww...ww', 'xx...xx', 'xx...xx', 'xx...xx', 'xxx.xxx', '.xxxxx.', '..xxx..'],
  crit: ['...x...', '...x...', 'xxxxxxx', '.xxxxx.', '..xxx..', '.xx.xx.', 'x.....x'],
  dash: ['x..x...', '.x..x..', '..x..x.', '...x..x', '..x..x.', '.x..x..', 'x..x...'],
  orbit: ['.......', 'x.....x', 'xx...xx', '.xxxxx.', 'xx...xx', 'x.....x', '.......'],
  zap: ['.xxxx..', 'xxxxxxx', '.xxxxx.', '...w...', '..ww...', '...w...', '..w....'],
  aura: ['...x...', '..xx...', '..xxx.x', '.xxwxx.', 'xxwwwxx', 'xxwwwxx', '.xxxxx.'],
  boom: ['.xxx...', 'xxxxx..', 'xx.xxx.', 'x...xxx', '.....xx', '......x'],
  nova: ['x..x..x', '.x...x.', '..xxx..', 'xxxwxxx', '..xxx..', '.x...x.', 'x..x..x'],
  lock: ['.xxx.', 'x...x', 'x...x', 'xxxxx', 'xxwxx', 'xxxxx'],
  hp: ['.xx.xx.', 'xwxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'],
  coinA: ['.xxx.', 'xxwxx', 'xwxox', 'xxxox', '.ooo.'],
  coinB: ['.x.', 'xwx', 'xxx', 'xox', '.o.'],
  gem: ['.x.', 'xwx', 'xxx', '.x.'],
  laser: ['xx.....', 'xwx....', '.xwx...', '..xwx..', '...xwx.', '....xwx', '.....xx'],
  missile: ['....xx.', '...xwxx', '..xxxx.', '.xxxx..', 'oxxx...', 'ox.....', 'o......'],
  freeze: ['x..x..x', '.x.x.x.', '..xwx..', 'xxwwwxx', '..xwx..', '.x.x.x.', 'x..x..x'],
  shield: ['xxxxxxx', 'xwwxxxx', 'xwxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'],
  evo: ['...x...', '..xwx..', 'xxxwxxx', '.xwwwx.', '..xxx..', '.xx.xx.', 'xx...xx'],
  flag: ['xwww...', 'xwwwww.', 'xwwww..', 'xww....', 'x......', 'x......', 'x......'],
  reroll: ['.xxxx..', 'x....x.', 'x...xxx', 'x....x.', 'x......', '.x...x.', '..xxx..'],
};

function makeSprite(rows, over = {}, outline = null) {
  const w = rows[0].length, h = rows.length;
  for (let i = 0; i < h; i++) if (rows[i].length !== w) console.warn('sprite row width mismatch', rows, i);
  const pad = outline ? 1 : 0;
  const W = w + pad * 2, H = h + pad * 2;
  const mk = fn => { const c = document.createElement('canvas'); c.width = W; c.height = H; fn(c.getContext('2d')); return c; };
  const col = ch => over[ch] || PAL[ch] || '#f0f';
  const paint = (g, mode) => {
    if (outline) {
      g.fillStyle = mode === 'sil' ? '#000' : outline;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (rows[y][x] === '.') continue;
        g.fillRect(x, y + 1, 1, 1); g.fillRect(x + 2, y + 1, 1, 1);
        g.fillRect(x + 1, y, 1, 1); g.fillRect(x + 1, y + 2, 1, 1);
      }
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === '.') continue;
      g.fillStyle = mode === 'flash' ? '#ffffff' : mode === 'sil' ? '#0d0a12' : col(ch);
      g.fillRect(x + pad, y + pad, 1, 1);
    }
  };
  const px = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rows[y][x] !== '.') px.push([x + pad, y + pad, col(rows[y][x])]);
  const c = mk(g => paint(g, 'n'));
  const f = mk(g => paint(g, 'flash'));
  const sil = mk(g => paint(g, 'sil'));
  const flip = src => mk(g => { g.translate(W, 0); g.scale(-1, 1); g.drawImage(src, 0, 0); });
  return { w: W, h: H, c, f, sil, px, cf: flip(c), ff: flip(f) };
}

const SPR = (() => {
  const S = SPR_SRC;
  const withLegs = (body, a, b) => [makeSprite(body.concat([a])), makeSprite(body.concat([b]))];
  const slimeCols = { s: '#ff6fb5', l: '#ffc2e2' };
  return {
    pup: withLegs(S.pup, LEGS_A, LEGS_B),
    cat: withLegs(S.cat, LEGS_A, LEGS_B),
    frog: withLegs(S.frog, LEGS_A, LEGS_B),
    bun: withLegs(S.bun, LEGS_A, LEGS_B),
    slime: [makeSprite(S.slimeA), makeSprite(S.slimeB)],
    slimeP: [makeSprite(S.slimeA, slimeCols), makeSprite(S.slimeB, slimeCols)],
    bat: [makeSprite(S.batA), makeSprite(S.batB)],
    peeper: [makeSprite(S.peeper), makeSprite(S.peeper, { r: '#ff9ab0', u: '#7ad0ff' })],
    bomber: [makeSprite(S.bomberA), makeSprite(S.bomberB)],
    golem: [makeSprite(S.golemA, { g: '#9b8a76', G: '#62554a' }), makeSprite(S.golemB, { g: '#9b8a76', G: '#62554a' })],
    king: [makeSprite(S.king, { s: '#4aa3ff', l: '#a8d8ff' })],
    eye: [makeSprite(S.eye)],
    chest: [makeSprite(S.chest)],
    rock: [makeSprite(S.rock)],
    bone: [makeSprite(S.bone)],
    boomer: [makeSprite(S.boomer)],
    bomb: [makeSprite(S.bomb)],
    charger: [makeSprite(S.chargerA, { b: '#9a6440', B: '#5e3b28' }), makeSprite(S.chargerB, { b: '#9a6440', B: '#5e3b28' })],
    ghost: [makeSprite(S.ghostA, { w: '#e8f0ff', n: '#3b3a52' }), makeSprite(S.ghostB, { w: '#e8f0ff', n: '#3b3a52' })],
    shroom: [makeSprite(S.shroom)],
    thief: [makeSprite(S.thiefA), makeSprite(S.thiefB)],
    queen: [makeSprite(S.queenA), makeSprite(S.queenB)],
    missile: [makeSprite(S.missile)],
    boneG: [makeSprite(S.bone, { w: '#ffd23f' })],
    boomerG: [makeSprite(S.boomer, { l: '#ff4cd2' })],
  };
})();

const Icons = (() => {
  const cache = new Map();
  return function icon(name, color = '#fff', oc = '#1b1428') {
    const key = name + color + oc;
    let s = cache.get(key);
    if (!s) {
      if (cache.size > 200) cache.clear();
      const o = color === '#fff' ? {} : { x: color };
      if (name === 'coinA' || name === 'coinB') { o.x = '#ffd23f'; o.o = '#e08a1e'; }
      s = makeSprite(ICON_SRC[name], o, oc);
      cache.set(key, s);
    }
    return s;
  };
})();

/* Lighten (f>0) or darken (f<0) a hex colour. */
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = f < 0 ? 0 : 255, p = Math.abs(f);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

/* Stepped radial sprites used by the lighting system (crisp pixel bands). */
function bandedDisc(size, steps, colorFn) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), R = size / 2;
  for (let i = 0; i < steps; i++) {
    const r = Math.round(R * (1 - i / steps));
    g.fillStyle = colorFn(i);
    for (let dy = -r; dy < r; dy++) { const dx = Math.round(Math.sqrt(r * r - (dy + 0.5) * (dy + 0.5))); g.fillRect(R - dx, R + dy, dx * 2, 1); }
  }
  return c;
}
const LIGHT_SPR = bandedDisc(48, 6, i => `rgba(0,0,0,${0.22 + i * 0.12})`);
const Glow = (() => {
  const cache = new Map();
  return function glow(col) {
    let c = cache.get(col);
    if (!c) {
      if (cache.size > 100) cache.clear();
      const n = parseInt(col.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
      c = bandedDisc(24, 4, i => `rgba(${r},${g},${b},${0.08 + i * 0.07})`);
      cache.set(col, c);
    }
    return c;
  };
})();
