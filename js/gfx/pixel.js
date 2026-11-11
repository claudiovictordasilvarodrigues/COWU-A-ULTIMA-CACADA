// Buffer de pixels para gerar pixel art procedural (sprites provisórios)
import { hash2, clamp } from '../core/util.js';

const cache = new Map();
export function rgb(hex) {
  if (Array.isArray(hex)) return hex;
  let c = cache.get(hex);
  if (c) return c;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  c = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  cache.set(hex, c);
  return c;
}
export function mix(a, b, t) {
  a = rgb(a); b = rgb(b);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
export function shadeHex(hex, f) {
  const c = rgb(hex);
  return [clamp(c[0] * f, 0, 255), clamp(c[1] * f, 0, 255), clamp(c[2] * f, 0, 255)];
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
  return c;
}

export function flipCanvas(cv) {
  const c = makeCanvas(cv.width, cv.height);
  const x = c.getContext('2d');
  x.translate(cv.width, 0); x.scale(-1, 1); x.drawImage(cv, 0, 0);
  return c;
}

export class PixBuf {
  constructor(w, h) { this.w = w | 0; this.h = h | 0; this.d = new Uint8ClampedArray(this.w * this.h * 4); }
  px(x, y, col, a = 255) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4, c = rgb(col);
    if (a >= 255) { this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = 255; return; }
    const t = a / 255, oa = this.d[i + 3] / 255;
    if (oa === 0) { this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = a; return; }
    this.d[i] = this.d[i] + (c[0] - this.d[i]) * t;
    this.d[i + 1] = this.d[i + 1] + (c[1] - this.d[i + 1]) * t;
    this.d[i + 2] = this.d[i + 2] + (c[2] - this.d[i + 2]) * t;
    this.d[i + 3] = Math.max(this.d[i + 3], a);
  }
  alpha(x, y) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0; return this.d[(y * this.w + x) * 4 + 3]; }
  // pinta somente onde já existe pixel (máscara)
  mpx(x, y, col) { if (this.alpha(x, y) > 0) this.px(x, y, col); }
  rect(x, y, w, h, col) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, col); }
  clear(x, y, w = 1, h = 1) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const X = x + i, Y = y + j; if (X >= 0 && Y >= 0 && X < this.w && Y < this.h) this.d[(Y * this.w + X) * 4 + 3] = 0; } }
  mrect(x, y, w, h, col) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.mpx(x + i, y + j, col); }
  blob(cx, cy, rx, ry, col, mask = false) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) mask ? this.mpx(x, y, col) : this.px(x, y, col);
      }
  }
  // elipse com sombreamento por normal (luz vinda de cima-esquerda) e pontilhado
  shaded(cx, cy, rx, ry, pal, seed = 0, lx = -0.55, ly = -0.75, dither = 0.28) {
    const n = pal.length;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        const d2 = dx * dx + dy * dy;
        if (d2 > 1) continue;
        const nz = Math.sqrt(1 - d2);
        const l = dx * lx + dy * ly + nz * 0.55;
        let t = (l + 0.75) / 1.85 + (hash2(x, y, seed) - 0.5) * dither;
        this.px(x, y, pal[clamp(Math.floor(t * n), 0, n - 1)]);
      }
  }
  line(x0, y0, x1, y1, col) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      this.px(x0, y0, col);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  outline(col = '#1b130d', alphaMin = 1) {
    const w = this.w, h = this.h, s = this.d, out = new Uint8ClampedArray(s);
    const c = rgb(col);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (s[i + 3] >= alphaMin) continue;
      const nb = (xx, yy) => xx >= 0 && yy >= 0 && xx < w && yy < h && s[(yy * w + xx) * 4 + 3] > 140;
      if (nb(x - 1, y) || nb(x + 1, y) || nb(x, y - 1) || nb(x, y + 1)) {
        out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = 255;
      }
    }
    this.d = out;
    return this;
  }
  toCanvas() {
    const c = makeCanvas(this.w, this.h);
    c.getContext('2d').putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
    return c;
  }
}
