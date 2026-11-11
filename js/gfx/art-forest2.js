// Objetos da mata de terra firme da Fase 2 (mesmo padrão procedural da Fase 1):
// troncos caídos de vários tamanhos, raízes, toro empurrável, vara, emaranhado de galhos,
// degraus do lajedo, tronco-ponte e ícones novos.
import { PixBuf } from './pixel.js';
import { mulberry32, hash2 } from '../core/util.js';

const OUT = '#120c07';
const BARK = ['#36281a', '#4e3a28', '#6a523a', '#8a6e4e'];

// tronco deitado na horizontal
export function logSprite(seed, len, r = 5, mossy = true) {
  const W = Math.ceil(len + 6), H = Math.ceil(r * 2 + 6);
  const b = new PixBuf(W, H);
  const rng = mulberry32(seed);
  const cy = H / 2 + 1;
  for (let x = 3; x < len + 1; x++) {
    const rr = r - (x / len) * 0.8;
    for (let y = -rr; y <= rr; y++) {
      const t = (y + rr) / (2 * rr);
      let i = t < 0.25 ? 3 : t < 0.6 ? 2 : t < 0.85 ? 1 : 0;
      if (hash2(x >> 1, (y + 9) | 0, seed) < 0.13) i = Math.max(0, i - 1);
      b.px(x, cy + y, BARK[i]);
    }
  }
  // pontas com anéis
  for (const ex of [2, len + 1]) {
    b.blob(ex, cy, 2.2, r, '#7a5e40');
    b.blob(ex, cy, 1.2, r * 0.55, '#a8865a');
    b.px(ex, cy, '#5a4430');
  }
  if (mossy) for (let i = 0; i < len / 4; i++) b.mpx(4 + rng() * (len - 6), cy - r + rng() * 2.2, rng() < 0.6 ? '#4f7a32' : '#6a9a42');
  for (let i = 0; i < len / 22; i++) { const x = 8 + rng() * (len - 14); b.rect(x | 0, (cy + r * 0.3) | 0, 3, 1, '#d8b070'); }
  b.outline(OUT);
  return b.toCanvas();
}

// tronco em pé, deitado no sentido norte-sul (ponte sobre a grota)
export function logVertSprite(seed, len, r = 6) {
  const W = Math.ceil(r * 2 + 6), H = Math.ceil(len + 4);
  const b = new PixBuf(W, H);
  const cx = W / 2;
  for (let y = 2; y < len + 2; y++) for (let x = -r; x <= r; x++) {
    const t = (x + r) / (2 * r);
    let i = t < 0.22 ? 3 : t < 0.55 ? 2 : t < 0.82 ? 1 : 0;
    if (hash2((x + 9) | 0, y >> 1, seed) < 0.12) i = Math.max(0, i - 1);
    b.px(cx + x, y, BARK[i]);
  }
  for (let y = 4; y < len; y += 9) b.mpx(cx - r + 2 + ((y * 7) % 4), y, '#4f7a32');
  b.rect(cx - 2, 2, 5, 1, '#a8865a');
  b.outline(OUT);
  return b.toCanvas();
}

// raiz grande que sai do chão em arco
export function rootSprite(seed, w = 30) {
  const b = new PixBuf(w + 4, 12);
  const rng = mulberry32(seed);
  for (let x = 1; x < w + 2; x++) {
    const k = (x - 1) / w;
    const h = Math.sin(k * Math.PI) * 6 + 2;
    for (let y = 0; y < 3; y++) b.px(x, 10 - h + y, y === 0 ? '#7a5e40' : y === 1 ? '#5e4630' : '#3e2e1e');
  }
  for (let i = 0; i < 4; i++) b.mpx(3 + rng() * (w - 4), 3 + rng() * 5, '#5a7a3a');
  b.outline(OUT);
  return b.toCanvas();
}

// toro curto que serve de apoio para a alavanca
export function toroSprite() {
  const b = new PixBuf(24, 14);
  for (let x = 4; x < 20; x++) for (let y = -4; y <= 4; y++) {
    const t = (y + 4) / 8;
    b.px(x, 7 + y, BARK[t < 0.25 ? 3 : t < 0.6 ? 2 : t < 0.85 ? 1 : 0]);
  }
  b.blob(4, 7, 2, 4.2, '#8a6e4e'); b.blob(4, 7, 1, 2.4, '#b8966a'); b.px(4, 7, '#6a523a');
  b.blob(20, 7, 2, 4.2, '#7a5e40');
  b.rect(9, 9, 6, 1, '#3e2e1e');
  b.outline(OUT);
  return b.toCanvas();
}

export function poleSprite() {
  const b = new PixBuf(30, 6);
  b.line(1, 4, 28, 1, '#7a5a38'); b.line(1, 5, 28, 2, '#4e3a24');
  b.px(28, 1, '#c8a46a');
  b.outline(OUT);
  return b.toCanvas();
}

// emaranhado de galhos e cipós derrubados
export function tangleSprite(seed) {
  const b = new PixBuf(36, 22);
  const rng = mulberry32(seed);
  for (let i = 0; i < 16; i++) {
    const x0 = 2 + rng() * 30, y0 = 6 + rng() * 14, a = rng() * Math.PI;
    const L = 8 + rng() * 14;
    b.line(x0, y0, x0 + Math.cos(a) * L, y0 - Math.abs(Math.sin(a)) * L * 0.6, i % 3 ? '#6a4a2e' : '#8a6a44');
  }
  for (let i = 0; i < 26; i++) b.px(3 + rng() * 30, 3 + rng() * 16, rng() < 0.5 ? '#4f7a32' : '#6a8a3a');
  for (let i = 0; i < 5; i++) b.px(4 + rng() * 28, 4 + rng() * 14, '#a87a3a');
  b.outline(OUT);
  return b.toCanvas();
}

// degraus de pedra que sobem para o lajedo
export function stepsSprite() {
  const b = new PixBuf(44, 20);
  const pal = ['#4a4840', '#626056', '#7c786c', '#969080'];
  for (let i = 0; i < 3; i++) {
    const y = 14 - i * 5, x0 = 4 + i * 2, w = 36 - i * 4;
    b.rect(x0, y, w, 5, pal[1 + (i % 2)]);
    b.rect(x0, y, w, 1, pal[3]);
    b.rect(x0, y + 4, w, 1, pal[0]);
    for (let k = 0; k < 4; k++) b.px(x0 + 3 + k * 9 + (i * 3) % 5, y + 2, pal[0]);
  }
  b.mpx(8, 12, '#5a7a3a'); b.mpx(30, 7, '#5a7a3a');
  b.outline('#141412');
  return b.toCanvas();
}

// arbusto seco (barulhento)
export const DRY = ['#2a2010', '#3e3018', '#584422', '#74592c', '#8e7036', '#a88842'];

export function fruitPile() {
  const b = new PixBuf(14, 8);
  for (let i = 0; i < 7; i++) { const x = 2 + (i * 5) % 10, y = 3 + (i % 3); b.blob(x, y, 1.6, 1.4, i % 2 ? '#7a3a1a' : '#8e4a22'); b.px(x, y - 1, '#c07a3a'); }
  b.outline(OUT);
  return b.toCanvas();
}

// ícones 16x16
export function icon2(id) {
  const b = new PixBuf(16, 16);
  if (id === 'vara') { b.line(2, 14, 13, 1, '#7a5a38'); b.line(3, 14, 14, 1, '#4e3a24'); b.px(13, 1, '#c8a46a'); }
  else if (id === 'pelos') { for (let i = 0; i < 9; i++) b.line(4 + i, 12 - (i % 3), 6 + i, 4 + (i % 4), i % 2 ? '#b8442a' : '#d8643a'); b.rect(3, 12, 10, 2, '#3a5a2a'); }
  b.outline(OUT);
  return b.toCanvas();
}
