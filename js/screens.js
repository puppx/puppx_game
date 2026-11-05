'use strict';
/* Menu screens: mode select, settings, records (stats / badges / foes), style (hats / pets). */
const UIS = { recTab: 'stats', styleTab: 'hats', page: 0 };

function screenHeader(title, col) {
  const top = SAFE.t + 4;
  Font.outline(ctx, title, SAFE.l + 6, top + 2, '#fff', col, 3, 'left');
  coinLabel(GW - SAFE.r - 4, top + 4, save.coins, 'right', 2);
  return top;
}
function backBtn(y) {
  btn('back', GW / 2 - 50, Math.min(GH - SAFE.b - 24, y), 100, 18, 'BACK', () => { scene = 'menu'; UIS.page = 0; Sfx.select(); }, '#55506e', 2);
}
function pager(id, total, per, cx, y) {
  const pages = Math.max(1, Math.ceil(total / per));
  UIS.page = clamp(UIS.page, 0, pages - 1);
  if (pages <= 1) return;
  btn(id + 'prev', cx - 44, y, 22, 14, '<', () => { UIS.page = (UIS.page - 1 + pages) % pages; Sfx.select(); }, '#55506e', 1);
  Font.outline(ctx, (UIS.page + 1) + '/' + pages, cx, y + 4, '#c0c8ff', '#1b1428', 1, 'center');
  btn(id + 'next', cx + 22, y, 22, 14, '>', () => { UIS.page = (UIS.page + 1) % pages; Sfx.select(); }, '#55506e', 1);
}
function tabs(list, cur, onPick, y) {
  const w = Math.min(70, (GW - 20 - (list.length - 1) * 4) / list.length);
  const x0 = GW / 2 - (w * list.length + (list.length - 1) * 4) / 2;
  list.forEach(([id, label], i) => btn('tab' + id, x0 + i * (w + 4), y, w, 14, label, () => { onPick(id); UIS.page = 0; Sfx.select(); }, cur === id ? '#ff8c2e' : '#3b3a52', 1));
}

/* ---------- Mode select ---------- */
function drawModes() {
  const top = screenHeader('PLAY', '#ff8c2e');
  Font.outline(ctx, 'HERO: ' + CHARS[save.sel].name, SAFE.l + 6, top + 21, '#c0c8ff');
  const land = GW > GH * 1.25, keys = ['normal', 'daily', 'rush', 'night'];
  const cols = land ? 2 : 1, gap = 6;
  const cw = Math.min(land ? 200 : 230, (GW - 16 - gap * (cols - 1)) / cols);
  const ch = land ? Math.min(50, (GH - top - 76) / 2 - 2) : 50;
  const x0 = Math.round(GW / 2 - (cw * cols + gap * (cols - 1)) / 2), y0 = top + 32;
  keys.forEach((k, i) => {
    const x = Math.round(x0 + (i % cols) * (cw + gap)), y = Math.round(y0 + Math.floor(i / cols) * (ch + gap));
    const m = MODES[k], locked = m.unlock && save.bestWave < m.unlock;
    hotspot('mode' + k, x, y, cw, ch, () => { if (locked) { Sfx.nope(); return; } Sfx.select(); newRun(k); });
    const p = UI.down === 'mode' + k ? 1 : 0;
    drawPanel(x, y + p, cw, ch, locked ? '#3b3a52' : m.col, !p);
    rect(x + 2, y + 2 + p, cw - 4, ch - 5, '#2a2640');
    Font.draw(ctx, m.name, x + 7, y + 6 + p, locked ? '#9a96b0' : m.col, 2, 'left', '#000');
    const lines = locked ? ['REACH WAVE ' + m.unlock + ' TO UNLOCK'] : k === 'daily' ? dailyRules().map(r => r.desc).concat(['COINS X1.5']) : m.lines;
    lines.forEach((l, j) => Font.draw(ctx, l, x + 7, y + 19 + j * 8 + p, '#fff', 1));
    if (k === 'daily') Font.draw(ctx, 'BEST ' + (save.daily.date === todayKey() ? save.daily.best : 0), x + cw - 6, y + 7 + p, '#5ef0ff', 1, 'right');
    if (locked) drawSpr(Icons('lock', '#ffd23f'), x + cw - 14, y + ch / 2, false, false, 2);
  });
  backBtn(y0 + Math.ceil(keys.length / cols) * (ch + gap) + 4);
}

/* ---------- Settings ---------- */
function drawSettings() {
  const top = screenHeader('SETTINGS', '#3f7f99');
  const S2 = save.settings, onoff = v => (v ? 'ON' : 'OFF');
  const items = [
    ['SOUND FX', onoff(save.sfx), () => { save.sfx = !save.sfx; Sfx.setSfx(save.sfx); }],
    ['MUSIC', onoff(save.music), () => { save.music = !save.music; Sfx.setMusic(save.music); }],
    ['SCREEN SHAKE', onoff(S2.shake), () => { S2.shake = !S2.shake; }],
    ['VIBRATION', onoff(S2.vib), () => { S2.vib = !S2.vib; vib(40); }],
    ['EFFECTS', S2.fx === 'high' ? 'HIGH' : 'LOW', () => { S2.fx = S2.fx === 'high' ? 'low' : 'high'; }],
    ['BUTTON SIZE', ['SMALL', 'MEDIUM', 'LARGE'][S2.btn], () => { S2.btn = (S2.btn + 1) % 3; }],
    ['DAMAGE NUMBERS', onoff(S2.nums), () => { S2.nums = !S2.nums; }],
  ];
  const land = GW > GH * 1.25, cols = land ? 2 : 1, gap = 6;
  const rw = Math.min(220, (GW - 16 - gap * (cols - 1)) / cols), rh = 20;
  const x0 = Math.round(GW / 2 - (rw * cols + gap * (cols - 1)) / 2), y0 = top + 26;
  items.forEach(([label, val, fn], i) => {
    const x = Math.round(x0 + (i % cols) * (rw + gap)), y = Math.round(y0 + Math.floor(i / cols) * (rh + 4));
    drawPanel(x, y, rw, rh, '#2e2b45');
    Font.draw(ctx, label, x + 6, y + 7, '#fff', 1);
    const on = val !== 'OFF' && val !== 'LOW';
    btn('set' + i, x + rw - 58, y + 3, 54, 13, val, () => { fn(); persist(); Sfx.select(); }, on ? '#3f9b52' : '#55506e', 1);
  });
  const by = y0 + Math.ceil(items.length / cols) * (rh + 4) + 4;
  Font.outline(ctx, 'LOW EFFECTS HELPS OLDER PHONES', GW / 2, by, '#9a96b0', '#1b1428', 1, 'center');
  backBtn(by + 12);
}

/* ---------- Records: stats, badges, bestiary ---------- */
function drawRecords() {
  const top = screenHeader('RECORDS', '#ffd23f');
  tabs([['stats', 'STATS'], ['badges', 'BADGES'], ['foes', 'FOES']], UIS.recTab, id => { UIS.recTab = id; }, top + 22);
  const areaY = top + 42, areaB = GH - SAFE.b - 46, areaH = areaB - areaY;
  const s = save.stats;
  if (UIS.recTab === 'stats') {
    const tm = Math.floor(s.time / 60);
    const lines = [
      ['RUNS PLAYED', s.runs], ['TIME PLAYED', Math.floor(tm / 60) + 'H ' + (tm % 60) + 'M'], ['FOES DEFEATED', s.kills],
      ['BOSSES BEATEN', s.bosses], ['BEST WAVE', save.bestWave], ['BEST SCORE', save.bestScore], ['BEST COMBO', s.bestCombo],
      ['BIGGEST MULTI KILL', s.bestMulti], ['CHESTS OPENED', s.chests], ['EVOLUTIONS', s.evos], ['THIEVES CAUGHT', s.thieves],
      ['ULTIMATES USED', s.ults], ['JACKPOTS', s.jackpots], ['DAILY RUNS', s.dailies], ['COINS EARNED', Math.round(s.coins)],
      ['BADGES', Object.keys(save.ach).length + '/' + ACHS.length], ['FOES FOUND', BESTIARY.filter(b => save.seen[b.id]).length + '/' + BESTIARY.length],
    ];
    const cols = GW > GH * 1.25 ? 2 : 1, cw = Math.min(170, (GW - 24) / cols), perCol = Math.ceil(lines.length / cols);
    const x0 = GW / 2 - (cw * cols + (cols - 1) * 8) / 2, lh = Math.max(8, Math.min(11, Math.floor(areaH / perCol)));
    lines.forEach(([k, v], i) => {
      const x = x0 + Math.floor(i / perCol) * (cw + 8), y = areaY + (i % perCol) * lh;
      Font.outline(ctx, k, x, y, '#c0c8ff');
      Font.outline(ctx, String(v), x + cw, y, '#fff', '#1b1428', 1, 'right');
    });
  } else if (UIS.recTab === 'badges') {
    const cols = GW > GH * 1.25 ? 2 : 1, rh = 22, rw = Math.min(220, (GW - 16 - (cols - 1) * 6) / cols);
    const rows = Math.max(1, Math.floor(areaH / (rh + 3))), per = rows * cols;
    const x0 = GW / 2 - (rw * cols + (cols - 1) * 6) / 2;
    const list = ACHS.slice(UIS.page * per, UIS.page * per + per);
    list.forEach((a, i) => {
      const got = !!save.ach[a.id];
      const x = Math.round(x0 + (i % cols) * (rw + 6)), y = Math.round(areaY + Math.floor(i / cols) * (rh + 3));
      drawPanel(x, y, rw, rh, got ? '#4a4020' : '#2e2b45');
      drawSpr(Icons('crit', got ? '#ffd23f' : '#3b3a52'), x + 9, y + 10);
      Font.draw(ctx, a.name, x + 18, y + 4, got ? '#ffd23f' : '#fff', 1);
      Font.draw(ctx, a.desc, x + 18, y + 12, '#9a96b0', 1);
      if (got) Font.draw(ctx, 'DONE', x + rw - 5, y + 4, '#5ed15a', 1, 'right');
      else coinLabel(x + rw - 4, y + 4, a.r, 'right');
    });
    pager('ach', ACHS.length, per, GW / 2, areaB + 2);
  } else {
    const cols = Math.max(1, Math.floor((GW - 16) / 96)), cw = Math.floor((GW - 16 - (cols - 1) * 4) / cols), chh = 30;
    const rows = Math.max(1, Math.floor(areaH / (chh + 4))), per = rows * cols;
    const list = BESTIARY.slice(UIS.page * per, UIS.page * per + per);
    list.forEach((b, i) => {
      const seen = !!save.seen[b.id];
      const x = 8 + (i % cols) * (cw + 4), y = Math.round(areaY + Math.floor(i / cols) * (chh + 4));
      drawPanel(x, y, cw, chh, '#2e2b45');
      const spr = SPR[EN[b.id].spr][0], sc = spr.w > 12 ? 1 : 2;
      drawSpr(spr, x + 14, y + 14, false, false, sc, !seen);
      Font.draw(ctx, seen ? b.name : '???', x + 28, y + 4, seen ? '#fff' : '#9a96b0', 1);
      Font.draw(ctx, seen ? b.desc : 'NOT FOUND YET', x + 28, y + 12, '#9a96b0', 1);
      if (seen) Font.draw(ctx, 'KO ' + (save.stats.kinds[b.id] || 0), x + 28, y + 20, '#ffd23f', 1);
    });
    pager('foe', BESTIARY.length, per, GW / 2, areaB + 2);
  }
  backBtn(GH - SAFE.b - 24);
}

/* ---------- Style: hats & pets ---------- */
function drawStyle() {
  const top = screenHeader('STYLE', '#ff4cd2');
  tabs([['hats', 'HATS'], ['pets', 'PETS']], UIS.styleTab, id => { UIS.styleTab = id; }, top + 22);
  const land = GW > GH * 1.25;
  // preview
  const pvX = land ? SAFE.l + 50 : GW / 2, pvY = land ? GH / 2 + 4 : top + 66;
  const fr = SPR[save.sel][Math.floor(T * 4) % 2], sc = 3;
  shadow(pvX, pvY + fr.h * sc / 2 - 2, 24);
  drawSpr(fr, pvX, pvY, false, false, sc);
  drawHat(pvX, pvY, save.sel, false, sc);
  if (save.pet) drawSpr(PETS_BY[save.pet].spr, pvX + 26, pvY - 14 + Math.round(Math.sin(T * 5) * 2), false, false, 2);
  // grid
  const isHat = UIS.styleTab === 'hats';
  const items = [{ id: '', name: 'NONE', cost: 0 }].concat(isHat ? HATS : PETS);
  const gx0 = land ? SAFE.l + 104 : 8, gx1 = GW - SAFE.r - 8;
  const gy0 = land ? top + 42 : pvY + 32, gy1 = GH - SAFE.b - 46;
  const cw = 58, chh = 40, cols = Math.max(1, Math.floor((gx1 - gx0 + 4) / (cw + 4)));
  const rows = Math.max(1, Math.floor((gy1 - gy0) / (chh + 4))), per = rows * cols;
  const ox = Math.round(gx0 + ((gx1 - gx0) - (cols * (cw + 4) - 4)) / 2);
  items.slice(UIS.page * per, UIS.page * per + per).forEach((it, i) => {
    const x = ox + (i % cols) * (cw + 4), y = Math.round(gy0 + Math.floor(i / cols) * (chh + 4));
    const owned = !it.id || (isHat ? save.hats[it.id] : save.pets[it.id]);
    const equipped = (isHat ? save.hat : save.pet) === it.id;
    const id = 'sty' + (it.id || 'none');
    hotspot(id, x, y, cw, chh, () => {
      if (owned) { if (isHat) save.hat = it.id; else save.pet = it.id; persist(); Sfx.select(); }
      else if (save.coins >= it.cost) { save.coins -= it.cost; (isHat ? save.hats : save.pets)[it.id] = 1; if (isHat) save.hat = it.id; else save.pet = it.id; persist(); Sfx.buy(); checkAch(null); }
      else Sfx.nope();
    });
    const p = UI.down === id ? 1 : 0;
    drawPanel(x, y + p, cw, chh, equipped ? '#ff4cd2' : '#2e2b45', !p);
    if (it.id) drawSpr(it.spr, x + cw / 2, y + 13 + p, false, false, 2);
    else Font.draw(ctx, '-', x + cw / 2, y + 10 + p, '#9a96b0', 2, 'center');
    Font.draw(ctx, it.name, x + cw / 2, y + 24 + p, '#fff', 1, 'center');
    if (equipped) Font.draw(ctx, 'ON', x + cw / 2, y + 31 + p, '#1b1428', 1, 'center');
    else if (owned) Font.draw(ctx, 'OWNED', x + cw / 2, y + 31 + p, '#5ed15a', 1, 'center');
    else coinLabel(x + cw / 2, y + 31 + p, it.cost, 'center');
  });
  if (!isHat && save.pet) Font.outline(ctx, PETS_BY[save.pet].desc, pvX, pvY + 22, '#c0c8ff', '#1b1428', 1, 'center');
  pager('sty', items.length, per, GW / 2, gy1 + 2);
  backBtn(GH - SAFE.b - 24);
}

function drawExtraScreen() {
  if (scene === 'modes') drawModes();
  else if (scene === 'settings') drawSettings();
  else if (scene === 'records') drawRecords();
  else if (scene === 'style') drawStyle();
}

/* Start everything once all scripts have loaded. */
boot();
