// Vegetação procedural: copas, troncos com sapopemas, palmeiras, embaúbas, arbustos e plantas
import { PixBuf } from './pixel.js';
import { mulberry32, hash2 } from '../core/util.js';

export const GREENS = {
  deep: ['#11240f', '#1a3317', '#24451d', '#2f5823', '#3d6e2b', '#4e8634'],
  mid: ['#152a12', '#20401a', '#2d5622', '#3b6c2b', '#4f8536', '#669d42'],
  light: ['#1d3a16', '#2b5220', '#3a6a2a', '#4f8536', '#6aa044', '#86b852'],
  olive: ['#1e2a12', '#2e3e1a', '#3f5424', '#52692e', '#6a823a', '#86994a'],
};

// copa: aglomerados sombreados ordenados de trás para frente
export function crownSprite(seed, r, pal = GREENS.mid) {
  const S = Math.ceil(r * 2 + 8);
  const b = new PixBuf(S, S);
  const rng = mulberry32(seed);
  const c = S / 2;
  const clusters = [];
  const n = Math.round(10 + r * 0.9);
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * r * 0.72;
    const cr = r * (0.26 + rng() * 0.2);
    clusters.push({ x: c + Math.cos(a) * d, y: c + Math.sin(a) * d * 0.88, r: cr });
  }
  clusters.push({ x: c, y: c - r * 0.1, r: r * 0.55 });
  clusters.sort((a, b2) => a.y - b2.y);
  for (const k of clusters) b.shaded(k.x, k.y, k.r, k.r * 0.9, pal, seed + (k.x | 0) * 7, -0.5, -0.8, 0.35);
  // folhas soltas nas bordas
  for (let i = 0; i < r * 3; i++) {
    const a = rng() * Math.PI * 2, d = r * (0.85 + rng() * 0.2);
    const x = c + Math.cos(a) * d, y = c + Math.sin(a) * d * 0.88;
    if (b.alpha(x | 0, y | 0) === 0 && (b.alpha((x + 1) | 0, y | 0) || b.alpha((x - 1) | 0, y | 0) || b.alpha(x | 0, (y + 1) | 0))) b.px(x, y, pal[2]);
  }
  b.outline('#0b1a0a');
  return b.toCanvas();
}

// tronco com raízes tabulares (sapopemas) opcionais
export function trunkSprite(seed, h, w, buttress = 0, bark = ['#3a2a1c', '#4e3a26', '#634a32', '#7a5e40']) {
  const W = Math.ceil(w + buttress * 2 + 6), H = Math.ceil(h + 3);
  const b = new PixBuf(W, H);
  const cx = W / 2;
  const rng = mulberry32(seed);
  for (let y = 0; y < h; y++) {
    const fromBottom = h - y;
    let hw = w / 2;
    if (buttress) hw += buttress * Math.exp(-fromBottom / (h * 0.16));
    for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) {
      const t = (x - (cx - hw)) / (2 * hw);
      let idx = t < 0.22 ? 3 : t < 0.55 ? 2 : t < 0.82 ? 1 : 0;
      if (hash2(x, y >> 1, seed) < 0.18) idx = Math.max(0, idx - 1);
      if (hash2(x >> 1, y, seed + 5) < 0.06) idx = Math.min(3, idx + 1);
      b.px(x, y, bark[idx]);
    }
  }
  // sulcos verticais das sapopemas
  if (buttress) {
    for (let k = -1; k <= 1; k += 2) {
      const bx = cx + k * (w / 2 + buttress * 0.45);
      for (let y = h - Math.floor(h * 0.28); y < h; y++) b.mpx(bx + (k * (y - h * 0.7)) * 0.15, y, bark[0]);
    }
  }
  // musgo e liquens
  for (let i = 0; i < h / 3; i++) {
    const y = (rng() * h) | 0, x = cx - w / 2 + rng() * w;
    b.mpx(x, y, rng() < 0.5 ? '#5a7a3a' : '#8a9a7a');
  }
  b.outline('#140d07');
  return b.toCanvas();
}

// palmeira (açaizeiro em touceira)
export function acaiSprite(seed) {
  const W = 46, H = 64;
  const b = new PixBuf(W, H);
  const rng = mulberry32(seed);
  const n = 2 + ((rng() * 3) | 0);
  const tops = [];
  for (let i = 0; i < n; i++) {
    const bx = W / 2 + (i - (n - 1) / 2) * 3;
    const tx = W / 2 + (i - (n - 1) / 2) * 9 + (rng() - 0.5) * 6;
    const ty = 10 + rng() * 12;
    for (let y = H - 2; y > ty; y--) {
      const t = (H - 2 - y) / (H - 2 - ty);
      const x = bx + (tx - bx) * t * t;
      b.px(x, y, (y % 5 === 0) ? '#5a5040' : '#7a6e58');
      b.px(x + 1, y, '#4a4234');
    }
    tops.push([tx, ty]);
  }
  for (const [tx, ty] of tops) {
    // cacho de açaí
    b.blob(tx + 2, ty + 4, 2, 2, '#3a1a3a'); b.px(tx + 2, ty + 3, '#6a3a6a');
    const fr = 7 + ((rng() * 3) | 0);
    for (let f = 0; f < fr; f++) {
      const a = -Math.PI / 2 + (f / (fr - 1) - 0.5) * Math.PI * 1.7 + (rng() - 0.5) * 0.2;
      const len = 12 + rng() * 6;
      for (let s = 0; s < len; s++) {
        const droop = (s / len) * (s / len) * 7;
        const x = tx + Math.cos(a) * s, y = ty + Math.sin(a) * s * 0.75 + droop;
        b.px(x, y, '#3d5a26');
        if (s > 2 && s % 2 === 0) {
          const la = a + Math.PI / 2;
          for (let k = 1; k < 4; k++) {
            b.px(x + Math.cos(la) * k * 0.6, y + Math.sin(la) * k * 0.6 + k * 0.5, k === 1 ? '#5a8a3a' : '#4a7430');
            b.px(x - Math.cos(la) * k * 0.6, y - Math.sin(la) * k * 0.6 + k * 0.5, k === 1 ? '#6a9a44' : '#4a7430');
          }
        }
      }
    }
  }
  b.outline('#0e1a0a');
  return b.toCanvas();
}

// buriti (palmeira de leque)
export function buritiSprite(seed) {
  const W = 56, H = 80;
  const b = new PixBuf(W, H);
  const rng = mulberry32(seed);
  const tx = W / 2, ty = 20;
  for (let y = H - 2; y > ty; y--) { b.rect(tx - 2, y, 4, 1, y % 4 === 0 ? '#5a5248' : '#6e665a'); b.px(tx + 1, y, '#4a443a'); }
  for (let f = 0; f < 14; f++) {
    const a = (f / 14) * Math.PI * 2 + rng() * 0.2;
    const len = 14 + rng() * 6;
    for (let s = 2; s < len; s++) {
      const x = tx + Math.cos(a) * s, y = ty + Math.sin(a) * s * 0.7 + (s / len) * 4;
      const spread = s / len * 3;
      for (let k = -spread; k <= spread; k++) b.px(x + Math.sin(a) * k, y - Math.cos(a) * k * 0.7, (k | 0) % 2 ? '#4a7a2e' : '#5e9038');
    }
  }
  b.blob(tx, ty + 3, 3, 2, '#6a3a1a');
  b.outline('#0e1a0a');
  return b.toCanvas();
}

// embaúba: tronco claro com anéis e folhas palmadas prateadas
export function embaubaSprite(seed) {
  const W = 48, H = 70;
  const b = new PixBuf(W, H);
  const rng = mulberry32(seed);
  const tx = W / 2;
  for (let y = H - 2; y > 18; y--) { b.rect(tx - 1, y, 3, 1, y % 6 === 0 ? '#9a9688' : '#c8c4b4'); b.px(tx + 1, y, '#a8a494'); }
  b.line(tx, 30, tx - 10, 20, '#b8b4a4'); b.line(tx, 26, tx + 11, 18, '#b8b4a4');
  const leaves = [[tx, 14], [tx - 11, 18], [tx + 12, 16], [tx - 5, 8], [tx + 6, 7]];
  for (const [lx, ly] of leaves) {
    const lobes = 7;
    for (let k = 0; k < lobes; k++) {
      const a = (k / lobes) * Math.PI * 2 + rng();
      for (let s = 0; s < 7; s++) {
        const x = lx + Math.cos(a) * s, y = ly + Math.sin(a) * s * 0.6;
        b.px(x, y, s < 2 ? '#a8bca0' : s % 2 ? '#7f9a72' : '#93ac86');
        b.px(x + Math.sin(a), y, '#6a8660');
      }
    }
  }
  b.outline('#1a2216');
  return b.toCanvas();
}

export function bushSprite(seed, r = 8, pal = GREENS.mid) {
  const S = Math.ceil(r * 2.6 + 6);
  const b = new PixBuf(S, Math.ceil(r * 2 + 6));
  const rng = mulberry32(seed);
  const cx = S / 2, cy = b.h - r - 2;
  const parts = [];
  for (let i = 0; i < 6; i++) parts.push({ x: cx + (rng() - 0.5) * r * 1.6, y: cy + (rng() - 0.3) * r * 0.7, r: r * (0.45 + rng() * 0.3) });
  parts.sort((a, c) => a.y - c.y);
  for (const p of parts) b.shaded(p.x, p.y, p.r, p.r * 0.85, pal, seed + (p.x | 0));
  b.outline('#0b1a0a');
  return b.toCanvas();
}

export function fernSprite(seed) {
  const b = new PixBuf(26, 16);
  const rng = mulberry32(seed);
  for (let f = 0; f < 7; f++) {
    const a = Math.PI + (f / 6) * Math.PI + (rng() - 0.5) * 0.2;
    for (let s = 0; s < 11; s++) {
      const x = 13 + Math.cos(a) * s, y = 14 + Math.sin(a) * s * 0.8 + (s * s) / 30;
      b.px(x, y, '#3f6e2a');
      if (s % 2 === 0 && s > 1) { b.px(x, y - 1, '#5a8e3a'); b.px(x, y + 1, '#2e5420'); }
    }
  }
  b.outline('#0b1a0a');
  return b.toCanvas();
}

export function heliconiaSprite(seed) {
  const b = new PixBuf(24, 28);
  const rng = mulberry32(seed);
  for (let i = 0; i < 4; i++) {
    const x0 = 6 + i * 4, top = 4 + rng() * 6;
    for (let y = 26; y > top + 6; y--) b.px(x0, y, '#3a5a2a');
    b.shaded(x0 + (i % 2 ? 3 : -3), top + 6, 3, 6, ['#244a1c', '#2f6024', '#3f7a2e', '#55943a'], seed + i);
  }
  // brácteas vermelhas e amarelas em zigue-zague
  const bx = 12, by = 6;
  for (let k = 0; k < 5; k++) {
    const x = bx + (k % 2 ? 2 : -2), y = by + k * 3;
    b.rect(x, y, 3, 2, '#d23a22'); b.px(x + (k % 2 ? 2 : 0), y, '#f0c030');
  }
  b.outline('#120c08');
  return b.toCanvas();
}

// tucum: palmeira baixa e espinhosa
export function tucumSprite(seed) {
  const b = new PixBuf(30, 24);
  const rng = mulberry32(seed);
  for (let f = 0; f < 9; f++) {
    const a = Math.PI + (f / 8) * Math.PI + (rng() - 0.5) * 0.3;
    for (let s = 0; s < 13; s++) {
      const x = 15 + Math.cos(a) * s, y = 22 + Math.sin(a) * s * 0.9 + (s * s) / 28;
      b.px(x, y, '#2a3a1e');
      if (s % 2) { b.px(x + 1, y - 1, '#4a5e30'); b.px(x - 1, y + 1, '#1e2a14'); }
      if (s % 3 === 0) b.px(x, y - 1, '#d8d0b0');
    }
  }
  b.outline('#0b100a');
  return b.toCanvas();
}

export function manivaSprite(seed) {
  const b = new PixBuf(16, 20);
  const rng = mulberry32(seed);
  b.line(8, 19, 8, 7, '#9a3a2a'); b.line(8, 12, 4, 8, '#9a3a2a'); b.line(8, 10, 12, 6, '#9a3a2a');
  for (const [lx, ly] of [[8, 6], [4, 8], [12, 6]]) {
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k - 2) * 0.6 + (rng() - 0.5) * 0.2;
      for (let s = 1; s < 5; s++) b.px(lx + Math.cos(a) * s, ly + Math.sin(a) * s, s < 3 ? '#5a9a3a' : '#3f7a2a');
    }
  }
  b.outline('#101a0a');
  return b.toCanvas();
}

export function bananaSprite(seed) {
  const b = new PixBuf(40, 48);
  const rng = mulberry32(seed);
  b.rect(19, 24, 3, 23, '#6a7a3a'); b.rect(21, 24, 1, 23, '#4e5a2a');
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.55 + (rng() - 0.5) * 0.2;
    for (let s = 2; s < 18; s++) {
      const x = 20 + Math.cos(a) * s, y = 24 + Math.sin(a) * s + (s * s) / 40;
      const wdt = Math.sin((s / 18) * Math.PI) * 3;
      for (let k = -wdt; k <= wdt; k++) b.px(x - Math.sin(a) * k, y + Math.cos(a) * k, k < 0 ? '#6aa63e' : '#4e8a2e');
      b.px(x, y, '#9ac060');
    }
  }
  b.outline('#101a0a');
  return b.toCanvas();
}

export function rockSprite(seed, r = 6) {
  const b = new PixBuf(Math.ceil(r * 2.4 + 4), Math.ceil(r * 1.6 + 4));
  b.shaded(b.w / 2, b.h / 2 + 1, r * 1.1, r * 0.7, ['#3a3a36', '#55554e', '#6e6e64', '#8a8a7e'], seed);
  b.mpx(b.w / 2 - 2, b.h / 2 - 1, '#5a7a3a');
  b.outline('#141412');
  return b.toCanvas();
}

// troncos de pássaros/ árvore caída
export function fallenTreeSprite(seed) {
  const W = 104, H = 34;
  const b = new PixBuf(W, H);
  const rng = mulberry32(seed);
  // placa de raízes
  b.shaded(12, 15, 11, 13, ['#2e2216', '#3e2e1e', '#4e3a26', '#5e4a32'], seed);
  for (let i = 0; i < 14; i++) { const a = rng() * Math.PI * 2; b.line(12, 15, 12 + Math.cos(a) * 13, 15 + Math.sin(a) * 14, '#3a2a1a'); }
  b.blob(12, 15, 5, 6, '#5a4630');
  // tronco
  for (let x = 18; x < W - 4; x++) {
    const r = 7 - (x - 18) * 0.03;
    for (let y = -r; y <= r; y++) {
      const t = (y + r) / (2 * r);
      const col = t < 0.25 ? '#8a6e4e' : t < 0.6 ? '#6a523a' : t < 0.85 ? '#4e3a28' : '#36281a';
      b.px(x, 16 + y, hash2(x >> 1, y | 0, seed) < 0.12 ? '#4e3a28' : col);
    }
  }
  for (let i = 0; i < 26; i++) b.mpx(20 + rng() * (W - 28), 10 + rng() * 5, rng() < 0.6 ? '#4f7a32' : '#6a9a42');
  // galhos quebrados
  b.line(60, 10, 66, 2, '#5a4430'); b.line(82, 20, 90, 30, '#5a4430'); b.line(40, 21, 36, 31, '#4e3a28');
  // orelhas-de-pau
  b.rect(50, 22, 3, 1, '#d8b070'); b.rect(52, 23, 3, 1, '#c89a5a'); b.rect(72, 9, 3, 1, '#d8b070');
  b.outline('#120c07');
  return b.toCanvas();
}

export function twigSprite(seed) {
  const b = new PixBuf(10, 6);
  b.line(1, 4, 8, 2, '#8a7050'); b.line(4, 3, 6, 1, '#8a7050'); b.px(2, 4, '#c8b088'); b.px(7, 2, '#c8b088');
  return b.toCanvas();
}
