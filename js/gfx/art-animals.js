// Animais em pixel art procedural (perfil voltado para a direita; espelhado em tempo de execução)
import { PixBuf, flipCanvas } from './pixel.js';

const DARK = '#1a120c';

function finish(b) { b.outline(DARK); return b.toCanvas(); }

export function pacaSprite(frame) {
  const b = new PixBuf(22, 14);
  const pal = ['#4a2c16', '#6b4022', '#875432', '#a06a40'];
  const l = frame % 2;
  b.rect(6 + l, 10, 2, 2, '#3a2214'); b.rect(14 - l, 10, 2, 2, '#3a2214');
  b.shaded(10, 7, 7, 4, pal, 11);
  b.shaded(16.5, 6.5, 3.5, 3, pal, 12);
  b.blob(10, 9.6, 5.5, 1.3, '#c9a87e', true);
  b.rect(15, 3, 2, 2, '#5a3420');
  b.px(18, 5, '#120a06'); b.px(20, 7, '#d08a80');
  for (let i = 0; i < 5; i++) b.mpx(4 + i * 2, 6, '#efe3c8');
  for (let i = 0; i < 5; i++) b.mpx(5 + i * 2, 8, '#efe3c8');
  for (let i = 0; i < 3; i++) b.mpx(6 + i * 3, 4, '#d9c9a8');
  return finish(b);
}

export function cotiaSprite(frame) {
  const b = new PixBuf(20, 14);
  const pal = ['#5e3412', '#82481a', '#a8642a', '#c48038'];
  const l = frame % 2;
  b.rect(5 + l, 9, 1, 3, '#3a2010'); b.rect(7 - l, 9, 1, 3, '#3a2010');
  b.rect(12 + l, 9, 1, 3, '#3a2010'); b.rect(14 - l, 9, 1, 3, '#3a2010');
  b.shaded(9, 7, 6, 3.2, pal, 21);
  b.blob(5, 7, 2.5, 2.6, '#4a2a10', true);
  b.shaded(15, 6, 3, 2.4, pal, 22);
  b.rect(14, 3, 1, 2, '#6a3a16');
  b.px(16, 5, '#120a06'); b.px(18, 6, '#2a1608');
  return finish(b);
}

export function capivaraSprite(frame, swim = false) {
  const b = new PixBuf(28, 17);
  const pal = ['#4e3620', '#6e4e30', '#8a6440', '#a27a52'];
  const l = frame % 2;
  if (!swim) {
    b.rect(7 + l, 12, 3, 3, '#3a2818'); b.rect(17 - l, 12, 3, 3, '#3a2818');
  }
  b.shaded(12, 9, 9, 5, pal, 31);
  b.shaded(21, 7.5, 4.5, 3.6, pal, 32);
  b.rect(23, 6, 3, 4, pal[2]); b.rect(23, 9, 3, 1, pal[1]);
  b.rect(19, 3, 2, 2, '#4a3220');
  b.px(22, 6, '#120a06'); b.px(25, 7, '#2a1a10');
  if (swim) {
    for (let y = 10; y < 17; y++) for (let x = 0; x < 28; x++) {
      const i = (y * 28 + x) * 4; b.d[i + 3] = 0;
    }
  }
  return finish(b);
}

export function jacuSprite(frame) {
  const b = new PixBuf(19, 15);
  const pal = ['#1f1a14', '#2f281e', '#3f3628', '#524634'];
  const peck = frame === 1;
  b.rect(8, 11, 1, 3, '#b05a5a'); b.rect(10, 11, 1, 3, '#b05a5a');
  b.shaded(4, 8, 4.5, 2, pal, 41);
  b.shaded(9, 8, 5, 3.6, pal, 42);
  const hx = 14, hy = peck ? 8 : 4;
  b.rect(12, hy + 1, 2, 8 - hy, pal[1]);
  b.shaded(hx, hy, 2.4, 2.2, pal, 43);
  b.px(hx + 1, hy - 1, '#e8e4dc'); b.px(hx + 3, hy, '#9a8a7a'); b.px(hx + 3, hy + 1, '#9a8a7a');
  b.px(hx, hy + 2, '#c0302a'); b.px(hx, hy + 3, '#c0302a');
  for (let i = 0; i < 4; i++) b.mpx(7 + i * 2, 7, '#6a5e4a');
  return finish(b);
}

// ave voando, vista de cima
export function birdFlySprite(frame, pal = ['#1f1a14', '#2f281e', '#433a2c', '#5a4e3a'], accent = '#c0302a') {
  const b = new PixBuf(22, 14);
  const up = frame % 2 === 0;
  b.shaded(11, 7, 2.2, 4.5, pal, 51);
  if (up) { b.shaded(5, 4, 5, 2, pal, 52); b.shaded(17, 4, 5, 2, pal, 53); }
  else { b.shaded(5, 9, 5, 1.8, pal, 54); b.shaded(17, 9, 5, 1.8, pal, 55); }
  b.rect(10, 11, 3, 2, pal[1]);
  b.px(11, 2, accent);
  return finish(b);
}

export function araraSprite(frame) {
  const b = new PixBuf(28, 20);
  const up = frame % 2 === 0;
  const red = ['#7a1010', '#a81818', '#cc2a22', '#e2483a'];
  const wy = up ? 5 : 12;
  for (const s of [-1, 1]) {
    for (let i = 0; i < 10; i++) {
      const x = 14 + s * (3 + i), y = wy + (up ? i * 0.15 : -i * 0.15);
      const col = i < 4 ? '#cc2a22' : i < 6 ? '#e8c22a' : i < 8 ? '#2a8a3a' : '#2a5ac8';
      b.rect(x, y, 1, 3, col);
    }
  }
  b.shaded(14, 8, 2.6, 5, red, 61);
  for (let y = 13; y < 20; y++) b.rect(13 + ((y - 13) % 2), y, 2, 1, y > 16 ? '#2a5ac8' : '#cc2a22');
  b.rect(13, 2, 3, 2, '#e8e0d0'); b.px(14, 1, '#2a2a2a');
  return finish(b);
}

export function macacoSprite(frame) {
  const b = new PixBuf(16, 17);
  const pal = ['#3a2614', '#5a3c20', '#7a5430', '#94683e'];
  const leap = frame === 2;
  // cauda
  for (let i = 0; i < 7; i++) b.px(2 + (i > 4 ? 1 : 0), 6 + i, pal[1]);
  b.px(3, 5, pal[1]); b.px(4, 4, pal[1]);
  if (leap) { b.shaded(8, 9, 5, 3, pal, 71); b.rect(12, 8, 3, 1, pal[1]); b.rect(1, 10, 3, 1, pal[1]); }
  else {
    b.shaded(8, 10, 4, 4.2, pal, 72);
    b.rect(5, 13, 2, 2, pal[0]); b.rect(9, 13, 2, 2, pal[0]);
    b.rect(4 + (frame % 2), 9, 1, 3, pal[1]); b.rect(11 - (frame % 2), 9, 1, 3, pal[1]);
  }
  b.shaded(8, 5, 3.2, 3, pal, 73);
  b.rect(6, 5, 4, 3, '#d9b88a');
  b.rect(6, 2, 4, 2, '#1e140a');
  b.px(7, 5, '#120a06'); b.px(9, 5, '#120a06'); b.px(8, 7, '#8a6040');
  return finish(b);
}

export function galinhaSprite(frame) {
  const b = new PixBuf(12, 12);
  const pal = ['#a88a6a', '#c8b090', '#e8dcc8', '#f8f2e6'];
  const peck = frame === 1;
  b.rect(5, 9, 1, 2, '#d0902a'); b.rect(7, 9, 1, 2, '#d0902a');
  b.shaded(5.5, 7, 4, 2.8, pal, 81);
  b.rect(1, 4, 2, 3, pal[2]);
  const hy = peck ? 6 : 3;
  b.shaded(9, hy, 1.8, 1.8, pal, 82);
  b.px(9, hy - 2, '#c82020'); b.px(10, hy - 2, '#c82020');
  b.px(11, hy, '#d0902a'); b.px(9, hy, '#120a06'); b.px(10, hy + 2, '#c82020');
  return finish(b);
}

export function butterflySprite(frame) {
  const b = new PixBuf(7, 6);
  const open = frame % 2 === 0;
  if (open) { b.rect(0, 1, 3, 3, '#2a6aff'); b.rect(4, 1, 3, 3, '#2a6aff'); b.px(1, 2, '#8ab8ff'); b.px(5, 2, '#8ab8ff'); }
  else { b.rect(2, 1, 1, 3, '#1a4ac8'); b.rect(4, 1, 1, 3, '#1a4ac8'); }
  b.rect(3, 1, 1, 4, '#1a1a1a');
  return b.toCanvas();
}

export { flipCanvas };
