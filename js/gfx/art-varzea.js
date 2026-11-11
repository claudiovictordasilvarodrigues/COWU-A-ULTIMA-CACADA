// Fase 3 — várzea: canoa vista de cima, Caetano sentado remando, garças, peixes, aninga,
// canarana, capivaras em várias poses, anta farejando, jirau de pesca, tapiri e ícone do remo.
// Mesmo padrão procedural das fases anteriores (PixBuf, contorno escuro, sombreamento por normal).
import { PixBuf, flipCanvas } from './pixel.js';
import { mulberry32, hash2, clamp } from '../core/util.js';

const OUT = '#120c07';
const WOOD = ['#3e2716', '#5a3a22', '#7a5232', '#9a6c44'];

// ---------- canoa (casco de itaúba) vista de cima, em 32 ângulos ----------
// O desenho é feito por amostragem inversa: cada pixel do buffer é rodado para o referencial
// do casco, o que mantém o traço de pixel art limpo em qualquer direção.
export const CANOE_LEN = 30, CANOE_HALF = 15;
export function canoeHull(idx, n = 32) {
  const S = 40, c = S / 2, a = (idx / n) * Math.PI * 2;
  const ca = Math.cos(a), sa = Math.sin(a);
  const b = new PixBuf(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x + 0.5 - c, dy = (y + 0.5 - c) / 0.82; // leve achatamento (vista 3/4)
    const u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
    const au = Math.abs(u) / CANOE_HALF;
    if (au > 1) continue;
    const hw = 4.9 * (1 - Math.pow(au, 1.9)) + 0.35;
    const av = Math.abs(v);
    if (av > hw) continue;
    let col;
    if (av > hw - 1.1) col = au > 0.86 ? WOOD[0] : WOOD[1]; // borda (amurada)
    else {
      // fundo da canoa: mais escuro no lado da sombra, com tábuas longitudinais
      // parede interna virada para a luz (vinda de cima-esquerda) fica mais clara
      const sv = v >= 0 ? 1 : -1, lit = sv * sa * -0.55 + -sv * ca * -0.75 < 0 && av > hw * 0.45;
      col = WOOD[lit ? 3 : 2];
      if (!lit && hash2(x, y, 5) < 0.2) col = WOOD[1];
      if (Math.abs(v) < 0.6 && au < 0.8) col = WOOD[1];
      if (hash2(Math.round(u * 1.5), Math.round(v), 9) < 0.06) col = '#4e3220';
    }
    // bancos (traves) em u = ±6
    if (av < hw - 0.9 && (Math.abs(u - 6.5) < 0.9 || Math.abs(u + 5.5) < 0.9)) col = '#b08458';
    b.px(x, y, col);
  }
  b.outline(OUT);
  return b.toCanvas();
}

// Caetano sentado na canoa (de costas, de frente ou de lado), com chapéu de palha
export function caetanoSeated(dir) {
  if (dir === 'left') return flipCanvas(caetanoSeated('right'));
  const b = new PixBuf(14, 16);
  const shirt = ['#7c3320', '#a5462e', '#c45e40'], skin = '#b97a4e', skinD = '#8f5a36', straw = ['#8a6a34', '#b89a52', '#d8bc72'];
  // tronco
  b.shaded(7, 10.5, 4.2, 3.6, shirt, 4);
  for (let y = 8; y < 14; y += 2) b.mrect(3, y, 9, 1, '#7c3320');
  if (dir === 'down') { b.rect(6, 7, 3, 2, skin); b.px(6, 9, skinD); }
  // cabeça
  b.shaded(7, 5.6, 2.8, 2.6, [skinD, skin, skin, '#d0946a'], 7);
  if (dir === 'down') { b.px(6, 6, '#1a120c'); b.px(8, 6, '#1a120c'); }
  if (dir === 'right') b.px(9, 6, '#1a120c');
  if (dir === 'up') b.blob(7, 6, 2.6, 2, '#2a1a10');
  // chapéu de palha
  b.shaded(7, 3.6, 5.2, 1.6, straw, 11);
  b.shaded(7, 2.6, 2.8, 1.8, straw, 12);
  b.rect(4.5, 3.2, 5, 1, '#5a3a1a');
  b.outline(OUT);
  return b.toCanvas();
}

// remo de madeira (ícone 16x16)
export function remoIcon() {
  const b = new PixBuf(16, 16);
  b.line(2, 14, 10, 6, '#8a6038'); b.line(3, 14, 11, 6, '#a87a4a');
  b.blob(12, 4, 2.6, 3.4, '#b88a58'); b.blob(12.5, 3.5, 1.4, 2.2, '#d0a46a');
  b.rect(1, 14, 2, 1, '#6a4428');
  b.outline(OUT);
  return b.toCanvas();
}

// ---------- garça-branca ----------
export function heronPerched(frame) {
  const b = new PixBuf(14, 22);
  const W = ['#c8ccc8', '#e0e4e0', '#f4f6f2', '#ffffff'];
  b.line(6, 15, 6, 21, '#2a2a22'); b.line(8, 15, 8, 21, '#2a2a22');
  b.shaded(7, 12, 4.2, 3.6, W, 3);
  // pescoço em S e bico amarelo
  const hx = frame % 2 ? 1 : 0;
  b.line(9, 10, 10 + hx, 6, W[2]); b.line(10, 10, 11 + hx, 6, W[1]);
  b.blob(10.5 + hx, 4.5, 1.8, 1.6, W[3]);
  b.line(12 + hx, 4, 13 + hx, 4, '#e0b020'); b.px(13 + hx, 5, '#c89010');
  b.px(11 + hx, 4, '#101010');
  b.outline('#202020');
  return b.toCanvas();
}
export function heronFlying(frame) {
  const b = new PixBuf(24, 12);
  const W = ['#c8ccc8', '#e0e4e0', '#f4f6f2', '#ffffff'];
  const up = frame % 2 === 0;
  b.shaded(12, 6, 4.5, 2, W, 5);
  for (let i = 0; i < 8; i++) { b.px(12 - i, up ? 5 - i * 0.5 : 6 + i * 0.4, W[2]); b.px(12 - i, up ? 6 - i * 0.5 : 7 + i * 0.4, W[1]); }
  b.line(16, 6, 20, 5, W[2]); b.line(20, 5, 23, 5, '#e0b020');
  b.line(8, 7, 4, 7, '#2a2a22');
  b.outline('#202020');
  return b.toCanvas();
}

// peixe saltando (aracu/jaraqui prateado)
export function fishSprite(frame) {
  const b = new PixBuf(9, 5);
  b.shaded(4, 2.5, 3.4, 1.6, ['#5a6a70', '#8a9aa0', '#b8c8cc', '#e0ecee'], 21);
  const t = frame % 2 ? 1 : 0;
  b.px(0, 1 + t, '#6a7a80'); b.px(0, 3 - t, '#6a7a80'); b.px(7, 2, '#101418');
  b.outline('#1a2024');
  return b.toCanvas();
}

// ---------- plantas da várzea ----------
// aninga (Montrichardia): talos altos com folhas em ponta de flecha, à beira d'água
export function aningaSprite(seed) {
  const rng = mulberry32(seed);
  const b = new PixBuf(18, 26);
  const n = 3 + ((rng() * 2) | 0);
  for (let i = 0; i < n; i++) {
    const x = 4 + rng() * 10, top = 6 + rng() * 8;
    b.line(x, 25, x + (rng() - 0.5) * 2, top + 3, '#4a6a2a');
    const lx = x + (rng() - 0.5) * 3, ly = top;
    b.shaded(lx, ly, 3.4, 2.6, ['#1f3a14', '#2d5220', '#3f6a2a', '#5a8a3a'], seed + i);
    b.px(lx, ly + 2, '#1a2e10'); b.px(lx - 1, ly + 3, '#1a2e10'); b.px(lx + 1, ly + 3, '#1a2e10');
  }
  b.outline('#0e1a08');
  return b.toCanvas();
}
// canarana (capim de várzea), touceira baixa
export function canaranaSprite(seed) {
  const rng = mulberry32(seed);
  const b = new PixBuf(16, 12);
  for (let i = 0; i < 12; i++) {
    const x = 2 + rng() * 12, h = 5 + rng() * 6, lean = (rng() - 0.5) * 4;
    b.line(x, 11, x + lean, 11 - h, rng() < 0.5 ? '#6a8a32' : '#86a242');
  }
  b.outline('#1a2a0e');
  return b.toCanvas();
}

// ---------- capivara em poses (perfil para a direita) ----------
// pose: 'walk' | 'graze' | 'rest' | 'alert'
export function capySprite(frame, pose = 'walk') {
  const b = new PixBuf(28, 17);
  const pal = ['#4e3620', '#6e4e30', '#8a6440', '#a27a52'];
  const l = frame % 2;
  if (pose === 'rest') {
    // deitada: corpo baixo e comprido, cabeça apoiada, olho quase fechado
    b.shaded(12, 11.5, 9.5, 3.8, pal, 33);
    b.shaded(21.5, 11, 4.4, 3.1, pal, 34);
    b.rect(23.5, 10, 3, 3, pal[2]);
    b.rect(19, 7, 2, 2, '#4a3220');
    b.rect(22, 10, 2, 1, '#2a1a10');
    // respiração
    if (l) b.mrect(8, 8, 8, 1, pal[3]);
  } else {
    const hy = pose === 'graze' ? 2.6 : pose === 'alert' ? -1.2 : 0;
    if (pose === 'walk') { b.rect(7 + l, 12, 3, 3, '#3a2818'); b.rect(17 - l, 12, 3, 3, '#3a2818'); }
    else { b.rect(7, 12, 3, 3, '#3a2818'); b.rect(17, 12, 3, 3, '#3a2818'); }
    b.shaded(12, 9, 9, 5, pal, 31);
    b.shaded(21, 7.5 + hy, 4.5, 3.6, pal, 32);
    b.rect(23, 6 + hy, 3, 4, pal[2]); b.rect(23, 9 + hy, 3, 1, pal[1]);
    b.rect(19, 3 + hy, 2, 2, '#4a3220');
    b.px(22, 6 + hy, '#120a06'); b.px(25, 7 + hy, '#2a1a10');
    if (pose === 'graze') for (let i = 0; i < 3; i++) b.px(24 + i, 13, '#5a8a32');
  }
  b.outline('#1a120c');
  return b.toCanvas();
}

// anta farejando: cabeça erguida, tromba virada para cima
export function tapirSniff(frame) {
  const b = new PixBuf(34, 20);
  const pal = ['#221d1a', '#332c27', '#463c35', '#5a4e45'];
  [5, 9, 19, 23].forEach((x, i) => { b.rect(x, 13, 2, 5, i % 2 ? '#1a1512' : '#241e1a'); b.rect(x, 17, 2, 1, '#3a3430'); });
  b.shaded(14, 10, 11, 6, pal, 91);
  b.shaded(9, 9.5, 6.5, 6, pal, 92);
  const hy = 7;
  b.shaded(26, hy, 4.5, 3.6, pal, 93);
  const curl = frame % 2;
  for (let k = 0; k < 4; k++) b.px(30 + k, hy - k * 0.6 - curl * (k > 2 ? 1 : 0), pal[1]);
  b.px(33, hy - 3 - curl, '#5a4a44');
  for (let x = 20; x < 27; x++) b.px(x, hy - 4 + (x > 24 ? 1 : 0), '#120e0c');
  b.px(23, hy - 4, '#e8e2d8'); b.px(23, hy - 5, '#3a322c'); b.px(24, hy - 5, '#e8e2d8');
  b.px(27, hy - 1, '#050403');
  b.outline('#0e0a08');
  return b.toCanvas();
}

// ---------- construções ----------
// jirau de pesca abandonado: estrado de varas sobre forquilhas
export function jirauSprite(withPaddle) {
  const b = new PixBuf(40, 28);
  for (const x of [4, 34]) { b.rect(x, 8, 2, 19, '#4a3420'); b.px(x - 1, 8, '#4a3420'); b.px(x + 2, 8, '#4a3420'); }
  for (let i = 0; i < 9; i++) b.line(2, 10 + (i % 2), 38, 9 + (i % 3), i % 2 ? '#7a5a38' : '#8e6e48');
  b.rect(10, 10, 6, 1, '#3a2a18'); b.rect(24, 11, 5, 1, '#3a2a18');
  for (let i = 0; i < 8; i++) b.px(6 + hash2(i, 1, 4) * 28, 8 + hash2(i, 2, 4) * 3, '#4f7a32');
  if (withPaddle) { b.line(20, 26, 30, 4, '#8a6038'); b.line(21, 26, 31, 4, '#a87a4a'); b.blob(31, 3, 2, 3, '#b88a58'); }
  b.outline(OUT);
  return b.toCanvas();
}

// tapiri: abrigo de esteios e cobertura de palha de buriti, aberto dos lados
export function tapiriSprite() {
  const W = 60, H = 48;
  const b = new PixBuf(W, H);
  for (const x of [8, 50]) b.rect(x, 20, 3, 27, '#4a3420');
  b.rect(29, 16, 2, 31, '#4a3420');
  // cobertura
  for (let y = 4; y < 24; y++) {
    const w = 6 + (y - 4) * 1.35;
    for (let x = 30 - w; x <= 30 + w; x++) {
      const t = hash2(x | 0, y, 77);
      b.px(x, y, y > 21 ? '#6e5a2a' : t < 0.3 ? '#8a7234' : t < 0.7 ? '#a68a44' : '#c0a456');
    }
  }
  for (let x = 4; x < 56; x += 3) b.line(x, 23, x + 1, 26, '#8a7234');
  b.rect(29, 3, 2, 2, '#5a4422');
  // chão batido e restos de fogo
  b.blob(30, 44, 18, 3, '#5e4a30');
  b.blob(24, 44, 3, 1.4, '#2a2018');
  b.outline(OUT);
  return b.toCanvas();
}

// galho grosso que prende a canoa
export function branchSprite() {
  const b = new PixBuf(40, 14);
  b.line(2, 8, 36, 6, '#5a4430'); b.line(2, 9, 36, 7, '#6e5238'); b.line(3, 10, 35, 8, '#4a3624');
  b.line(14, 7, 20, 1, '#5a4430'); b.line(26, 7, 31, 12, '#5a4430');
  for (let i = 0; i < 6; i++) b.blob(18 + i * 3, 2 + (i % 2), 2, 1.5, i % 2 ? '#3f6a2a' : '#4f8536');
  b.outline(OUT);
  return b.toCanvas();
}

// mureru / aguapé (plantas flutuantes) desenhadas no chão-água
export function lilyCluster(ctx, x, y, seed, a = 1) {
  const r = mulberry32(seed);
  ctx.globalAlpha = a;
  for (let i = 0; i < 5; i++) {
    const px = x + (r() - 0.5) * 16, py = y + (r() - 0.5) * 8, s = 2 + r() * 2;
    ctx.fillStyle = r() < 0.5 ? '#3f6a2a' : '#4f8536';
    ctx.beginPath(); ctx.ellipse(px, py, s, s * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a4a1c'; ctx.fillRect(Math.round(px), Math.round(py - s * 0.6), 1, Math.ceil(s * 0.6));
    if (r() < 0.2) { ctx.fillStyle = '#c890d8'; ctx.fillRect(Math.round(px + 1), Math.round(py - 1), 1, 1); }
  }
  ctx.globalAlpha = 1;
}

export { clamp };
