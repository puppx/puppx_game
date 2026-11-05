'use strict';
/* Tiny 5px-tall bitmap font. Everything is drawn in caps. */
const FONT_SRC = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'],
  7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '##.'],
  ' ': ['..', '..', '..', '..', '..'],
  '.': ['.', '.', '.', '.', '#'],
  ',': ['.', '.', '.', '#', '#'],
  '!': ['#', '#', '#', '.', '#'],
  '?': ['##.', '..#', '.#.', '...', '.#.'],
  ':': ['.', '#', '.', '#', '.'],
  '-': ['...', '...', '###', '...', '...'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  '/': ['..#', '..#', '.#.', '#..', '#..'],
  '%': ['#.#', '..#', '.#.', '#..', '#.#'],
  "'": ['#', '#', '.', '.', '.'],
  '(': ['.#', '#.', '#.', '#.', '.#'],
  ')': ['#.', '.#', '.#', '.#', '#.'],
  '<': ['..#', '.#.', '#..', '.#.', '..#'],
  '>': ['#..', '.#.', '..#', '.#.', '#..'],
  '*': ['...', '#.#', '.#.', '#.#', '...'],
  '=': ['...', '###', '...', '###', '...'],
  '#': ['.#.#.', '#####', '#####', '.###.', '..#..'], // heart
};

const Font = (() => {
  const cache = new Map();
  function rows(ch) { return FONT_SRC[ch] || FONT_SRC['?']; }
  function glyph(ch, color) {
    const key = ch + color;
    let g = cache.get(key);
    if (g) return g;
    const r = rows(ch);
    const w = r[0].length;
    const c = document.createElement('canvas');
    c.width = w; c.height = 5;
    const x = c.getContext('2d');
    x.fillStyle = color;
    for (let y = 0; y < 5; y++) for (let i = 0; i < w; i++) if (r[y][i] === '#') x.fillRect(i, y, 1, 1);
    g = { c, w };
    cache.set(key, g);
    return g;
  }
  function width(str, s = 1) {
    str = String(str).toUpperCase();
    let w = 0;
    for (const ch of str) w += (rows(ch)[0].length + 1) * s;
    return Math.max(0, w - s);
  }
  function raw(ctx, str, x, y, color, s) {
    let cx = x;
    for (const ch of str) {
      const g = glyph(ch, color);
      ctx.drawImage(g.c, cx, y, g.w * s, 5 * s);
      cx += (g.w + 1) * s;
    }
  }
  function prep(str, x, s, align) {
    str = String(str).toUpperCase();
    const w = width(str, s);
    if (align === 'center') x -= w / 2;
    else if (align === 'right') x -= w;
    return [str, Math.round(x), w];
  }
  /** Draw text with an optional drop shadow. Returns width. */
  function draw(ctx, str, x, y, color = '#fff', s = 1, align = 'left', shadow = null) {
    const [t, px, w] = prep(str, x, s, align);
    y = Math.round(y);
    if (shadow) raw(ctx, t, px, y + s, shadow, s);
    raw(ctx, t, px, y, color, s);
    return w;
  }
  /** Draw text with a full 1px outline (great for busy backgrounds). */
  function outline(ctx, str, x, y, color = '#fff', oc = '#1b1428', s = 1, align = 'left') {
    const [t, px, w] = prep(str, x, s, align);
    y = Math.round(y);
    raw(ctx, t, px - 1, y, oc, s); raw(ctx, t, px + 1, y, oc, s);
    raw(ctx, t, px, y - 1, oc, s); raw(ctx, t, px, y + 1 + (s > 1 ? s - 1 : 0), oc, s);
    raw(ctx, t, px, y, color, s);
    return w;
  }
  return { draw, outline, width };
})();
