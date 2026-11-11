// Queixada (Tayassu pecari) e anta em pixel art procedural, no mesmo padrão dos animais da Fase 1:
// perfil voltado para a direita (espelhado em tempo de execução), contorno escuro, sombreamento por normal.
// O queixada tem pelagem quase preta e grisalha, crina no dorso que arrepia, focinho comprido
// com disco rosado e a mancha branca no queixo que dá nome ao bicho.
import { PixBuf } from './pixel.js';
import { hash2 } from '../core/util.js';

const OUT = '#0e0a08';
export const PECCARY_PALS = [
  ['#18130f', '#241c16', '#33291f', '#43372b'],
  ['#1e150e', '#2e2117', '#3f2f22', '#544030'],
  ['#1a1917', '#282523', '#383430', '#4b4640'],
];
const JUV_PAL = ['#3e2414', '#5a361e', '#7a4c2c', '#9a663c'];

// pose: { gait: 'walk'|'run'|'idle', frame, head: 'down'|'mid'|'up', mouth, bristle, pal, juv }
// Desenho pensado em 24x16 (adulto): corpo compacto de porco-do-mato, cernelha alta com crina,
// pernas finas visíveis, cabeça em cunha terminando no disco do focinho e a faixa branca no queixo.
export function peccarySide(o) {
  const juv = !!o.juv;
  const k = juv ? 0.72 : 1;
  const W = juv ? 18 : 25, H = juv ? 12 : 16;
  const b = new PixBuf(W, H);
  const pal = juv ? JUV_PAL : PECCARY_PALS[o.pal % PECCARY_PALS.length];
  const f = o.frame | 0, run = o.gait === 'run', walk = o.gait === 'walk';
  const X = (v) => v * k, Y = (v) => v * k;
  const lift = run && (f === 0 || f === 2) ? -1 : walk && (f === 1 || f === 3) ? -1 * (juv ? 0 : 1) * 0 : 0;
  const ground = H - 1;
  // pernas (as do lado de lá mais escuras); passada alternada
  const legTop = Y(10.5) + lift;
  const legs = [
    { x: X(5), far: true }, { x: X(7), far: false }, // traseiras
    { x: X(16), far: true }, { x: X(18), far: false }, // dianteiras
  ];
  let off;
  if (run) off = [[-2, -1, 2, 1], [0, 0, 0, 0], [2, 1, -2, -1], [0, 0, 0, 0]][f % 4];
  else if (walk) off = [[1, -1, -1, 1], [0, 0, 0, 0], [-1, 1, 1, -1], [0, 0, 0, 0]][f % 4];
  else off = [0, 0, 0, 0];
  legs.forEach((L, i) => {
    const col = L.far ? '#0c0908' : '#1c1612';
    const x0 = Math.round(L.x), x1 = Math.round(L.x + off[i]);
    const top = Math.round(legTop), h = ground - top;
    for (let y = 0; y < h; y++) { const xx = Math.round(x0 + (x1 - x0) * (y / Math.max(1, h - 1))); b.px(xx, top + y, col); }
    b.px(x1, ground, '#3a322c');
  });
  // corpo: anca, barriga e cernelha alta
  const cy = Y(7.6) + lift;
  b.shaded(X(6.2), cy + Y(0.3), X(4), Y(3.3), pal, 11 + o.pal);
  b.shaded(X(10.5), cy + Y(0.5), X(5.5), Y(3.4), pal, 12 + o.pal);
  b.shaded(X(14.6), cy - Y(0.7), X(4.2), Y(3.6), pal, 13 + o.pal);
  // pelagem grisalha (pontas claras dos pelos)
  for (let i = 0; i < (juv ? 6 : 16); i++) {
    const x = X(3 + hash2(i, 1, o.pal + 3) * 15), y = cy - Y(2.5) + hash2(i, 2, o.pal + 3) * Y(4.5);
    b.mpx(x, y, juv ? '#b8804e' : '#74685a');
  }
  if (juv) for (let x = Math.round(X(4)); x < X(16); x += 2) b.mpx(x, Math.round(cy), '#c89060');
  // crina dorsal: arrepia quando o bicho se sente ameaçado
  for (let x = Math.round(X(7)); x <= Math.round(X(17)); x++) {
    const top = Math.round(cy - Y(3.4) - (x > X(11) && x < X(16.5) ? Y(0.9) : 0));
    b.px(x, top, '#0a0807');
    if (o.bristle) { if (x % 2 === 0) { b.px(x, top - 1, '#141010'); b.px(x, top - 2, '#5a5046'); } else b.px(x, top - 1, '#3a342e'); }
  }
  b.px(Math.round(X(2)), Math.round(cy - Y(0.8)), pal[1]); b.px(Math.round(X(1.5)), Math.round(cy - Y(0.2)), pal[0]);
  // cabeça em cunha
  const hd = o.head;
  const hx = X(19.2), hy = hd === 'down' ? cy + Y(2.4) : hd === 'up' ? cy - Y(1.6) : cy + Y(0.6);
  b.shaded(hx, hy, X(3.4), Y(2.7), pal, 14 + o.pal);
  // focinho afinando até o disco
  const dir = hd === 'down' ? [0.55, 0.85] : hd === 'up' ? [0.95, -0.3] : [1, 0.18];
  const sl = juv ? 2.5 : 4;
  let sx = hx + X(2.2), sy = hy + Y(0.4);
  for (let t = 0; t <= sl; t += 0.5) {
    const x = Math.round(sx + dir[0] * t), y = Math.round(sy + dir[1] * t);
    b.px(x, y, pal[1]); b.px(x, y + 1, pal[0]);
    if (t < sl * 0.5) b.px(x, y - 1, pal[2]);
  }
  const nx = Math.round(sx + dir[0] * sl + 0.5), ny = Math.round(sy + dir[1] * sl);
  b.px(nx, ny, '#8e706a'); b.px(nx, ny + 1, '#6e524c');
  // queixo branco: faixa na mandíbula, do canto da boca até o queixo
  if (!juv) {
    for (let t = -1.2; t <= 2.2; t += 0.5) {
      const x = Math.round(hx + t), y = Math.round(hy + Y(2.2) + (hd === 'down' ? t * 0.55 : hd === 'up' ? -t * 0.15 : t * 0.1));
      b.px(x, y, t < 0 ? '#cfc8b8' : '#ece6d8');
    }
  } else b.px(Math.round(hx), Math.round(hy + 2), '#d8c8b0');
  // boca aberta mostrando a presa
  if (o.mouth) {
    const mx = Math.round(hx + X(1.5)), my = Math.round(hy + Y(1.4));
    b.px(mx, my, '#4a1612'); b.px(mx + 1, my, '#4a1612'); b.px(mx + 1, my + 1, '#f4f0e0'); b.px(mx, my - 1, '#f4f0e0');
  }
  // orelha arredondada e olho
  b.px(Math.round(hx - X(1.8)), Math.round(hy - Y(2.8)), pal[2]); b.px(Math.round(hx - X(1.2)), Math.round(hy - Y(3.3)), pal[1]); b.px(Math.round(hx - X(0.8)), Math.round(hy - Y(2.7)), pal[1]);
  b.px(Math.round(hx + X(0.6)), Math.round(hy - Y(0.9)), '#050403');
  b.outline(OUT);
  return b.toCanvas();
}

// de frente (vindo na direção da câmera) e de costas, para quando o bicho anda na vertical
export function peccaryFront(o) {
  const juv = !!o.juv, k = juv ? 0.72 : 1;
  const W = juv ? 12 : 16, H = juv ? 12 : 16;
  const b = new PixBuf(W, H);
  const pal = juv ? JUV_PAL : PECCARY_PALS[o.pal % PECCARY_PALS.length];
  const cx = W / 2 - 0.5, f = o.frame | 0, ground = H - 1;
  const step = f % 2;
  // pernas
  for (const [lx, ph] of [[-3, 0], [-1.2, 1], [1.2, 0], [3, 1]]) {
    const x = Math.round(cx + lx * k), top = Math.round(ground - (juv ? 3 : 4) + (ph === step ? 0 : 1));
    for (let y = top; y < ground; y++) b.px(x, y, Math.abs(lx) > 2 ? '#1c1612' : '#0c0908');
    b.px(x, ground, '#3a322c');
  }
  if (o.back) {
    b.shaded(cx, H / 2 - 0.2, 5.6 * k, 5 * k, pal, 21 + o.pal);
    for (let y = Math.round(H / 2 - 5 * k); y < H / 2 + 2 * k; y++) b.px(Math.round(cx), y, '#0a0807');
    if (o.bristle) for (let y = Math.round(H / 2 - 5 * k); y < H / 2 + 1; y += 2) { b.px(Math.round(cx) - 1, y, '#5a5046'); b.px(Math.round(cx) + 1, y + 1, '#5a5046'); }
    b.px(Math.round(cx), Math.round(H / 2 + 4.6 * k), pal[0]);
    b.px(Math.round(cx - 3.6 * k), Math.round(H / 2 - 5.2 * k), pal[2]); b.px(Math.round(cx + 3.6 * k), Math.round(H / 2 - 5.2 * k), pal[2]);
  } else {
    // ombros atrás, cabeça larga na frente
    b.shaded(cx, H / 2 - 1.6 * k, 5.6 * k, 4 * k, pal, 22 + o.pal);
    if (o.bristle) for (let x = -3; x <= 3; x++) b.px(Math.round(cx + x * k), Math.round(H / 2 - 5.6 * k) - (x % 2 ? 0 : 1), '#5a5046');
    const hy = H / 2 + (o.head === 'down' ? 1.6 : o.head === 'up' ? -0.6 : 0.6) * k;
    b.shaded(cx, hy, 3.4 * k, 3 * k, pal, 23 + o.pal);
    // orelhas e olhos
    b.px(Math.round(cx - 3.6 * k), Math.round(hy - 3 * k), pal[2]); b.px(Math.round(cx + 3.6 * k), Math.round(hy - 3 * k), pal[2]);
    b.px(Math.round(cx - 1.6 * k), Math.round(hy - 1 * k), '#050403'); b.px(Math.round(cx + 1.6 * k), Math.round(hy - 1 * k), '#050403');
    // focinho e disco
    b.rect(Math.round(cx - 0.5), Math.round(hy + 0.4 * k), 2, Math.round(2 * k), pal[1]);
    b.rect(Math.round(cx - 0.5), Math.round(hy + 2 * k), 2, 1, '#8e706a');
    // queixo branco nas bochechas
    if (!juv) { for (const dx of [-2.4, -1.6, 1.6, 2.4]) b.px(Math.round(cx + dx), Math.round(hy + 1.8), '#ece6d8'); b.px(Math.round(cx - 1), Math.round(hy + 2.8), '#ece6d8'); b.px(Math.round(cx + 1), Math.round(hy + 2.8), '#ece6d8'); }
    if (o.mouth) { b.px(Math.round(cx - 1.4), Math.round(hy + 2.2), '#f4f0e0'); b.px(Math.round(cx + 1.4), Math.round(hy + 2.2), '#f4f0e0'); }
  }
  b.outline(OUT);
  return b.toCanvas();
}

// anta (Tapirus terrestris): corpo grande e arredondado, tromba curta, orelhas de borda branca
export function tapirSprite(frame, head = 'mid') {
  const b = new PixBuf(34, 20);
  const pal = ['#221d1a', '#332c27', '#463c35', '#5a4e45'];
  const f = frame % 4;
  const off = [[1, -1, -1, 1], [0, 0, 0, 0], [-1, 1, 1, -1], [0, 0, 0, 0]][f];
  [5, 9, 19, 23].forEach((x, i) => { b.rect(x + off[i], 13, 2, 5, i % 2 ? '#1a1512' : '#241e1a'); b.rect(x + off[i], 17, 2, 1, '#3a3430'); });
  b.shaded(14, 10, 11, 6, pal, 91);
  b.shaded(9, 9.5, 6.5, 6, pal, 92);
  const hy = head === 'down' ? 13 : 9;
  b.shaded(26, hy, 4.5, 3.6, pal, 93);
  // tromba
  for (let k = 0; k < 4; k++) b.px(30 + k, hy + 1 + (head === 'down' ? k * 0.7 : k * 0.3), pal[1]);
  b.px(33, hy + (head === 'down' ? 4 : 2), '#5a4a44');
  // crina curta e orelha
  for (let x = 20; x < 27; x++) b.px(x, hy - 4 + (x > 24 ? 1 : 0), '#120e0c');
  b.px(23, hy - 4, '#e8e2d8'); b.px(23, hy - 5, '#3a322c'); b.px(24, hy - 5, '#e8e2d8');
  b.px(27, hy - 1, '#050403');
  b.outline(OUT);
  return b.toCanvas();
}
