// Construções, objetos de cena, rastros e ícones de itens (pixel art procedural)
import { PixBuf } from './pixel.js';
import { mulberry32, hash2 } from '../core/util.js';

const DARK = '#160f09';

// casa de palafita ribeirinha
export function houseSprite(seed, paint = '#4f7f9a', roof = 'zinc') {
  const W = 80, H = 74;
  const b = new PixBuf(W, H);
  const rng = mulberry32(seed);
  const paintD = shade(paint, 0.78), paintL = shade(paint, 1.12);
  // esteios
  for (const x of [8, 22, 38, 54, 70]) { b.rect(x, 56, 3, 14, '#4a3420'); b.rect(x + 2, 56, 1, 14, '#33240f'); }
  // assoalho / varanda
  b.rect(4, 52, 72, 5, '#7a5232'); for (let x = 4; x < 76; x += 6) b.rect(x, 52, 1, 5, '#5a3a22'); b.rect(4, 56, 72, 1, '#3a2614');
  // paredes de tábuas pintadas
  for (let y = 28; y < 52; y++) {
    const board = Math.floor((y - 28) / 4);
    for (let x = 6; x < 74; x++) {
      let col = (board % 2) ? paint : paintL;
      if ((y - 28) % 4 === 3) col = paintD;
      if (hash2(x >> 2, board, seed) < 0.12) col = '#8a6a4a'; // tinta descascada
      b.px(x, y, col);
    }
  }
  // porta
  b.rect(34, 34, 12, 18, '#3a2416'); b.rect(35, 35, 10, 17, '#5a3a24'); b.rect(39, 35, 1, 17, '#3a2416'); b.px(43, 43, '#c9a54a');
  // janelas com tramelas abertas
  for (const wx of [12, 56]) {
    b.rect(wx, 36, 12, 10, '#1a1410');
    b.rect(wx + 1, 37, 10, 8, '#2a2018');
    b.rect(wx - 4, 36, 4, 10, '#6a4a2e'); b.rect(wx + 12, 36, 4, 10, '#6a4a2e');
    b.rect(wx + 5, 36, 1, 10, '#4a3420');
  }
  // telhado
  for (let y = 2; y < 30; y++) {
    const inset = Math.max(0, 3 - y);
    for (let x = inset; x < W - inset; x++) {
      let col;
      if (roof === 'zinc') {
        col = (x % 4 === 0) ? '#7c8388' : (x % 4 === 1 ? '#b4bbc0' : '#9aa1a6');
        if (hash2(x >> 2, y >> 2, seed + 3) < 0.1) col = '#8a5a3a';
      } else {
        col = ((y + (x % 3)) % 3 === 0) ? '#8a6a34' : ((x + y * 3) % 7 === 0 ? '#d4b06a' : '#b08a4a');
      }
      b.px(x, y, col);
    }
  }
  b.rect(0, 15, W, 2, roof === 'zinc' ? '#6a7076' : '#7a5a2a');
  b.rect(0, 28, W, 2, '#2a2016');
  // escada
  for (let y = 58; y < 72; y += 3) b.rect(35, y, 10, 1, '#7a5232');
  b.rect(34, 57, 1, 15, '#4a3420'); b.rect(45, 57, 1, 15, '#4a3420');
  // vasos de planta
  b.rect(8, 49, 4, 3, '#a85a3a'); b.blob(10, 47, 3, 2, '#3f7a2e');
  if (rng() < 0.6) { b.rect(66, 49, 4, 3, '#a85a3a'); b.blob(68, 47, 3, 2, '#c84a6a'); }
  b.outline(DARK);
  return b.toCanvas();
}

export function casaFarinhaSprite(seed) {
  const W = 78, H = 62;
  const b = new PixBuf(W, H);
  // chão de terra batida
  b.rect(6, 30, 66, 28, '#6e5438');
  for (let i = 0; i < 80; i++) b.px(6 + (hash2(i, 1, seed) * 66), 30 + hash2(i, 2, seed) * 28, '#5a442c');
  // forno de barro
  b.shaded(39, 44, 16, 8, ['#3a2a20', '#5a4232', '#7a5a42', '#94704e'], seed);
  b.blob(39, 43, 13, 6, '#2a2a2a'); b.blob(39, 43, 11, 4.5, '#7a7a74'); b.blob(37, 42, 6, 2, '#d8cfa8');
  b.rect(28, 50, 22, 2, '#e07a2a'); b.rect(31, 51, 16, 1, '#ffb040');
  // paneiros de mandioca
  b.shaded(14, 50, 5, 4, ['#6e522a', '#8a6a3a', '#a4834a'], seed + 4); b.blob(14, 47, 4, 1.5, '#e8dcb8');
  b.shaded(64, 51, 5, 4, ['#6e522a', '#8a6a3a', '#a4834a'], seed + 5);
  // tipiti pendurado
  for (let y = 22; y < 44; y++) b.rect(60 + ((y % 2) ? 0 : 1), y, 3, 1, (y % 2) ? '#b89a5a' : '#8a6a34');
  // esteios
  for (const x of [5, 70]) { b.rect(x, 18, 3, 40, '#4a3420'); }
  // telhado de palha
  for (let y = 0; y < 24; y++) for (let x = 0; x < W; x++) {
    const col = ((y + (x % 3)) % 3 === 0) ? '#8a6a34' : ((x + y * 3) % 7 === 0 ? '#d4b06a' : '#b08a4a');
    b.px(x, y, col);
  }
  b.rect(0, 22, W, 2, '#5a4220');
  b.outline(DARK);
  return b.toCanvas();
}

export function canoeSprite(seed, broken = false) {
  const W = 50, H = 14;
  const b = new PixBuf(W, H);
  for (let x = 2; x < W - 2; x++) {
    const t = (x - 2) / (W - 4);
    const hw = Math.sin(t * Math.PI) * 5.2 + 0.6;
    for (let y = -hw; y <= hw; y++) {
      const edge = Math.abs(y) > hw - 1.4;
      let col = edge ? (broken ? '#5a5444' : '#5a3a22') : (broken ? '#6e6a58' : '#8a5e38');
      if (!edge && y > 0) col = broken ? '#5e5a4a' : '#6e4a2c';
      b.px(x, 7 + y, col);
    }
  }
  for (const x of [16, 33]) b.rect(x, 3, 2, 8, broken ? '#4a4638' : '#a07a4a');
  if (broken) {
    for (let i = 0; i < 18; i++) b.mpx(6 + hash2(i, 7, seed) * 38, 3 + hash2(i, 8, seed) * 8, '#4f6e34');
    b.rect(22, 9, 7, 4, '#2a2418');
  } else {
    b.line(36, 10, 47, 2, '#c8a46a'); b.rect(45, 1, 3, 3, '#c8a46a');
  }
  b.outline(DARK);
  return b.toCanvas();
}

export function jiraoSprite() {
  const b = new PixBuf(34, 20);
  for (const x of [2, 30]) b.rect(x, 8, 2, 12, '#4a3420');
  b.rect(0, 6, 34, 4, '#8a6240'); for (let x = 0; x < 34; x += 4) b.rect(x, 6, 1, 4, '#6a4a2e');
  b.rect(0, 9, 34, 1, '#4a3420');
  b.outline(DARK);
  return b.toCanvas();
}

export function fenceSprite(len = 32) {
  const b = new PixBuf(len + 2, 14);
  for (let x = 0; x < len; x += 8) b.rect(x, 1, 2, 12, '#5a4028');
  b.rect(0, 4, len, 1, '#7a5a38'); b.rect(0, 8, len, 1, '#7a5a38');
  b.outline(DARK);
  return b.toCanvas();
}

export function trailPostSprite() {
  const b = new PixBuf(12, 26);
  b.rect(5, 4, 3, 21, '#5a4028'); b.rect(7, 4, 1, 21, '#3e2c1a');
  b.rect(3, 6, 7, 3, '#c8322a'); b.rect(8, 9, 2, 5, '#c8322a'); b.rect(9, 13, 1, 3, '#a82a22');
  b.rect(5, 15, 3, 1, '#2a1a10'); b.rect(5, 18, 3, 1, '#2a1a10');
  b.outline(DARK);
  return b.toCanvas();
}

export function woodpileSprite() {
  const b = new PixBuf(30, 16);
  for (let i = 0; i < 4; i++) { b.rect(1, 12 - i * 3, 28, 3, i % 2 ? '#8a6240' : '#a07448'); b.rect(1, 12 - i * 3, 28, 1, '#c09060'); }
  b.outline(DARK);
  return b.toCanvas();
}

export function planksSprite() {
  const b = new PixBuf(22, 10);
  b.rect(1, 2, 20, 3, '#9a7048'); b.rect(1, 2, 20, 1, '#c09060');
  b.rect(3, 5, 18, 3, '#8a6240'); b.rect(3, 5, 18, 1, '#b08458');
  b.outline(DARK);
  return b.toCanvas();
}

export function sticksSprite() {
  const b = new PixBuf(18, 10);
  b.line(1, 7, 16, 3, '#7a5a38'); b.line(2, 4, 15, 8, '#8a6a44'); b.line(3, 6, 16, 6, '#6a4a2e');
  b.rect(8, 3, 2, 6, '#c8a24a');
  b.outline(DARK);
  return b.toCanvas();
}

export function cipoSprite(len = 40) {
  const b = new PixBuf(12, len);
  for (let y = 0; y < len; y++) {
    const x = 6 + Math.sin(y * 0.25) * 2.5;
    b.px(x, y, '#5a4a2a'); b.px(x + 1, y, '#3e321c');
    if (y % 7 === 0) { b.px(x + 2, y, '#4f7a32'); b.px(x + 3, y - 1, '#4f7a32'); }
  }
  b.outline('#0e0a06');
  return b.toCanvas();
}

export function fireFrames() {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const b = new PixBuf(18, 20);
    b.rect(2, 15, 14, 3, '#5a3a22'); b.line(2, 18, 15, 13, '#4a2e1a'); b.line(2, 13, 15, 18, '#6a4428');
    for (const [x, y] of [[1, 17], [16, 17], [3, 19], [14, 19]]) b.rect(x, y, 2, 1, '#6e6a64');
    const rng = mulberry32(100 + f);
    for (let y = 2; y < 16; y++) {
      const t = (16 - y) / 14;
      const hw = Math.max(0.5, (1 - t) * 5 + Math.sin(y * 0.8 + f * 1.7) * 1.2);
      for (let x = 9 - hw; x < 9 + hw; x++) {
        const c = t > 0.7 ? '#ffd860' : t > 0.4 ? (rng() < 0.5 ? '#ffa030' : '#ffc040') : '#e85a1a';
        b.px(x + Math.sin(y + f) * 0.6, y, c);
      }
    }
    frames.push(b.toCanvas());
  }
  return frames;
}

export function hammockCanvas() { return null; }

// rastros no chão (sem contorno, pintados como sulcos escuros)
export function trackSprite(kind) {
  const b = new PixBuf(28, 22);
  const col = '#2a1c10', hi = '#7a6040';
  const print = (x, y, pts) => { for (const [dx, dy] of pts) { b.px(x + dx, y + dy, col); b.px(x + dx, y + dy - 1, hi); } };
  switch (kind) {
    case 'cotia':
      for (let i = 0; i < 4; i++) print(4 + i * 6, 6 + (i % 2) * 6, [[0, 0], [1, 0], [0, 1], [2, -1], [-1, -1]]);
      break;
    case 'tatu':
      b.blob(14, 11, 7, 5, '#3a2a18'); b.blob(14, 12, 5, 3, '#120c06');
      for (let i = 0; i < 12; i++) b.px(4 + hash2(i, 1, 9) * 20, 15 + hash2(i, 2, 9) * 6, '#8a6a44');
      break;
    case 'queixada':
      for (let i = 0; i < 9; i++) { const x = 3 + hash2(i, 3, 4) * 22, y = 3 + hash2(i, 4, 4) * 16; print(x, y, [[0, 0], [0, 1], [2, 0], [2, 1]]); }
      break;
    case 'anta':
      for (let i = 0; i < 2; i++) { const x = 7 + i * 12, y = 8 + i * 6; print(x, y, [[0, 0], [1, 0], [2, 1], [-2, 1], [-1, 0], [0, 3], [3, 3], [-3, 3], [0, 4], [1, 4], [-1, 4]]); }
      break;
    case 'capivara':
      for (let i = 0; i < 3; i++) print(5 + i * 8, 8 + (i % 2) * 5, [[0, 0], [1, -1], [2, -1], [3, 0], [1, 1], [2, 1], [1, 2], [2, 2]]);
      b.rect(22, 16, 2, 1, '#3a2a18'); b.rect(19, 18, 2, 1, '#3a2a18'); b.rect(24, 18, 2, 1, '#3a2a18');
      break;
    case 'onca':
      for (let i = 0; i < 2; i++) { const x = 8 + i * 11, y = 10 - i * 3; b.blob(x, y + 2, 2.5, 2, col); for (const [dx, dy] of [[-3, -2], [-1, -3], [1, -3], [3, -2]]) b.px(x + dx, y + dy, col); }
      break;
    case 'veado':
      for (let i = 0; i < 3; i++) { const x = 6 + i * 7, y = 14 - i * 4; print(x, y, [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2], [1, 3]]); }
      break;
  }
  return b.toCanvas();
}

// ---------- ícones (16x16) e itens no mundo ----------
export function iconSprite(id) {
  const b = new PixBuf(16, 16);
  switch (id) {
    case 'espingarda':
      b.line(1, 12, 13, 2, '#3b3b40'); b.line(2, 12, 14, 2, '#5a5a62'); b.rect(1, 11, 4, 3, '#6a4022'); b.rect(6, 9, 2, 2, '#2a2a2a'); break;
    case 'facao':
      b.line(3, 13, 13, 3, '#c8ccd0'); b.line(4, 13, 14, 3, '#9aa0a6'); b.rect(1, 12, 4, 3, '#4a2a14'); b.px(14, 2, '#e8ecef'); break;
    case 'cantil':
      b.shaded(8, 9, 5, 5.5, ['#2e4a2a', '#3f6438', '#557e4a', '#6e9a60'], 3); b.rect(6, 2, 4, 3, '#8a8a8a'); b.rect(7, 1, 2, 1, '#5a5a5a'); b.rect(4, 7, 8, 1, '#7a6040'); break;
    case 'lanterna':
      b.rect(3, 6, 8, 5, '#c8a020'); b.rect(3, 6, 8, 1, '#e8c840'); b.rect(11, 5, 3, 7, '#9a9aa0'); b.rect(12, 6, 2, 5, '#f8f0c0'); b.rect(6, 7, 2, 2, '#2a2a2a'); break;
    case 'marmita':
      b.shaded(8, 9, 6, 4.5, ['#6e7278', '#90969c', '#b4bac0', '#d4d8dc'], 4); b.rect(2, 6, 12, 2, '#a4aab0'); b.rect(6, 4, 4, 2, '#6e7278'); break;
    case 'paneiro':
      b.rect(3, 4, 10, 10, '#8a6a3a'); for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) if ((x + y) % 2 === 0) b.px(3 + x, 4 + y, '#6e522a'); b.rect(3, 4, 10, 1, '#5e4422'); b.line(4, 4, 6, 1, '#5e4422'); b.line(12, 4, 10, 1, '#5e4422'); break;
    case 'tabua':
      b.rect(1, 6, 14, 4, '#9a7048'); b.rect(1, 6, 14, 1, '#c09060'); b.px(4, 8, '#6a4a2e'); b.px(11, 7, '#6a4a2e'); break;
    case 'cipo':
      for (let i = 0; i < 4; i++) b.blob(8, 8, 6 - i, 5 - i, i % 2 ? '#6a5a32' : '#4e4224'); b.rect(7, 7, 3, 2, '#2a2214'); break;
    case 'galhos':
      b.line(1, 12, 14, 5, '#7a5a38'); b.line(2, 6, 14, 12, '#8a6a44'); b.line(2, 9, 14, 9, '#6a4a2e'); b.rect(7, 6, 2, 6, '#c8a24a'); break;
    case 'fumo':
      b.blob(8, 8, 6, 3.5, '#5a3a1a'); for (let x = 3; x < 14; x += 2) b.rect(x, 5, 1, 7, '#3e2610'); b.rect(7, 4, 2, 9, '#c8a24a'); break;
    case 'pilhas':
      b.rect(3, 4, 4, 9, '#2a5ac8'); b.rect(9, 4, 4, 9, '#2a5ac8'); b.rect(3, 4, 4, 2, '#d8c040'); b.rect(9, 4, 4, 2, '#d8c040'); b.rect(4, 3, 2, 1, '#c0c0c0'); b.rect(10, 3, 2, 1, '#c0c0c0'); break;
    case 'cartucho':
      b.rect(5, 3, 6, 10, '#b82a22'); b.rect(5, 11, 6, 3, '#c8a040'); b.rect(5, 3, 6, 1, '#d84a3a'); break;
    case 'caco':
      b.rect(3, 4, 10, 8, '#c27a4a'); b.clear(3, 4, 2, 2); b.clear(12, 10, 1, 2); b.line(4, 7, 12, 7, '#7a2a1a'); b.line(5, 9, 11, 10, '#7a2a1a'); b.rect(6, 5, 3, 1, '#e8d0a0'); break;
    case 'pena':
      b.line(3, 14, 12, 2, '#d8d0c0'); for (let i = 0; i < 9; i++) { b.line(4 + i, 12 - i * 1.2, 7 + i, 13 - i * 1.2, '#1a1a22'); b.px(5 + i, 11 - i * 1.2, '#2a3a5a'); } break;
    case 'anzol':
      for (let y = 2; y < 10; y++) b.px(9, y, '#8a5a3a'); b.px(9, 10, '#8a5a3a'); b.px(8, 11, '#8a5a3a'); b.px(7, 12, '#8a5a3a'); b.px(6, 12, '#8a5a3a'); b.px(5, 11, '#8a5a3a'); b.px(5, 10, '#8a5a3a'); b.px(6, 9, '#a87a4a'); b.rect(8, 1, 3, 2, '#6a4a2e'); break;
    case 'jarina':
      b.shaded(8, 8, 5.5, 6, ['#a89878', '#c8b898', '#e0d4b8', '#f0e8d4'], 7); b.rect(7, 2, 2, 2, '#6a5a3a'); break;
    case 'jabuti':
      b.shaded(8, 9, 7, 5, ['#3a2a14', '#5a4220', '#7a5a2e', '#a07a3a'], 8); for (const [x, y] of [[5, 8], [8, 7], [11, 8], [6, 11], [10, 11]]) b.rect(x, y, 2, 2, '#c8a24a'); break;
    case 'caderno':
      b.rect(3, 2, 10, 12, '#6a4a2e'); b.rect(4, 3, 8, 10, '#e8dcc0'); for (let y = 5; y < 12; y += 2) b.rect(5, y, 6, 1, '#a89878'); b.rect(3, 2, 1, 12, '#3a2a1a'); break;
    default:
      b.blob(8, 8, 5, 5, '#c8a24a');
  }
  b.outline('#120c07');
  return b.toCanvas();
}

function shade(hex, f) {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * f))));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
