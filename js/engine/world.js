// Mundo: terreno em grade fina, colisões, objetos estáticos e pré-renderização do chão
import { hash2, fbm, clamp } from '../core/util.js';
import { makeCanvas } from '../gfx/pixel.js';

// 10+ : terrenos usados a partir da Fase 2 (ROCHA e GROTA são intransponíveis; LAJEDO é pedra caminhável)
// 14  : RASO (Fase 3): água rasa de igarapé, dá para atravessar a pé (mais devagar e com respingos)
export const T = { FLOOR: 0, GRASS: 1, DIRT: 2, SAND: 3, MUD: 4, RIVER: 5, CREEK: 6, ROCA: 7, WOOD: 8, CLEAR: 9, ROCK: 10, GULLY: 11, STONE: 12, THICKET: 13, SHALLOW: 14 };
export const SURFACE = ['leaves', 'grass', 'dirt', 'sand', 'mud', 'water', 'water', 'dirt', 'wood', 'leaves', 'stone', 'leaves', 'stone', 'leaves', 'water'];
const SOLID = (t) => t === T.ROCK || t === T.GULLY || t === T.THICKET;

const PAL = {
  0: [[50, 46, 28], [62, 54, 32], [42, 52, 28]],
  1: [[82, 122, 46], [100, 140, 56], [70, 106, 40]],
  2: [[136, 104, 66], [120, 90, 56], [150, 118, 76]],
  3: [[214, 192, 140], [198, 174, 120], [228, 208, 158]],
  4: [[82, 66, 44], [68, 54, 36], [96, 78, 52]],
  7: [[118, 72, 44], [100, 60, 36], [132, 84, 52]],
  8: [[124, 86, 54], [104, 70, 42], [146, 104, 66]],
  9: [[70, 80, 40], [84, 94, 46], [60, 70, 36]],
  10: [[92, 88, 76], [74, 70, 60], [110, 104, 90]],
  11: [[30, 24, 16], [22, 18, 12], [40, 32, 20]],
  12: [[122, 116, 98], [104, 98, 84], [138, 130, 110]],
  13: [[34, 44, 22], [26, 36, 18], [42, 54, 26]],
  14: [[74, 70, 46], [62, 60, 40], [88, 84, 58]],
};

export class World {
  constructor(tw, th) {
    this.tw = tw; this.th = th;
    this.W = tw * 16; this.H = th * 16;
    this.cw = this.W / 2; this.ch = this.H / 2;
    this.ter = new Uint8Array(this.cw * this.ch);
    this.dep = new Float32Array(this.cw * this.ch);
    this.margin = 24;
    this.colGrid = new Map(); this.colliders = [];
    this.drawGrid = new Map(); this.drawables = [];
    this.walkOverrides = []; this.blockers = [];
    this.density = new Float32Array(tw * th);
    this.fogCols = Math.ceil(this.W / 32); this.fogRows = Math.ceil(this.H / 32);
    this.explored = new Uint8Array(this.fogCols * this.fogRows);
    this.crowns = [];
  }

  generate(sampler) {
    let i = 0;
    for (let cy = 0; cy < this.ch; cy++) {
      const ty = (cy * 2 + 1) / 16;
      for (let cx = 0; cx < this.cw; cx++, i++) {
        const r = sampler((cx * 2 + 1) / 16, ty);
        this.ter[i] = r[0]; this.dep[i] = r[1] || 0;
      }
    }
  }

  terrainAt(x, y) {
    const cx = (x / 2) | 0, cy = (y / 2) | 0;
    if (x < 0 || y < 0 || cx >= this.cw || cy >= this.ch) return 255;
    return this.ter[cy * this.cw + cx];
  }
  isWaterT(t) { return t === T.RIVER || t === T.CREEK; }
  isWater(x, y) { return this.isWaterT(this.terrainAt(x, y)); }
  surfaceAt(x, y) {
    for (const o of this.walkOverrides) if (o.active() && x >= o.x && y >= o.y && x <= o.x + o.w && y <= o.y + o.h) return 'wood';
    const t = this.terrainAt(x, y);
    return SURFACE[t] || 'dirt';
  }

  blockedAt(x, y, canWater = false) {
    if (x < this.margin || y < this.margin || x > this.W - this.margin || y > this.H - this.margin) return true;
    for (const o of this.walkOverrides) if (o.active() && x >= o.x && y >= o.y && x <= o.x + o.w && y <= o.y + o.h) return false;
    for (const b of this.blockers) if (b.active() && x >= b.x && y >= b.y && x <= b.x + b.w && y <= b.y + b.h) return true;
    const t = this.terrainAt(x, y);
    if (t === 255) return true;
    if (SOLID(t)) return true;
    if (!canWater && this.isWaterT(t)) return true;
    return false;
  }

  // ---------- colisores ----------
  _key(x, y, s) { return ((x / s) | 0) + ',' + ((y / s) | 0); }
  addCollider(c) {
    this.colliders.push(c);
    const x0 = c.r ? c.x - c.r : c.x, y0 = c.r ? c.y - c.r : c.y;
    const x1 = c.r ? c.x + c.r : c.x + c.w, y1 = c.r ? c.y + c.r : c.y + c.h;
    for (let gy = Math.floor(y0 / 64); gy <= Math.floor(y1 / 64); gy++)
      for (let gx = Math.floor(x0 / 64); gx <= Math.floor(x1 / 64); gx++) {
        const k = gx + ',' + gy;
        if (!this.colGrid.has(k)) this.colGrid.set(k, []);
        this.colGrid.get(k).push(c);
      }
    return c;
  }
  clearDynamic() {
    const keep = this.colliders.filter((c) => !c.dyn);
    this.colliders = []; this.colGrid = new Map();
    for (const c of keep) this.addCollider(c);
    this.walkOverrides = []; this.blockers = [];
  }
  near(x, y) {
    const out = [];
    const gx = Math.floor(x / 64), gy = Math.floor(y / 64);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const a = this.colGrid.get((gx + i) + ',' + (gy + j));
      if (a) for (const c of a) if (!out.includes(c)) out.push(c);
    }
    return out;
  }
  hit(x, y, r, canWater = false) {
    const k = r * 0.7;
    const pts = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r * 0.6], [k, k], [-k, k], [k, -k * 0.6], [-k, -k * 0.6]];
    for (const [dx, dy] of pts) if (this.blockedAt(x + dx, y + dy, canWater)) return true;
    for (const c of this.near(x, y)) {
      if (c.off) continue;
      if (c.w !== undefined) {
        const nx = clamp(x, c.x, c.x + c.w), ny = clamp(y, c.y, c.y + c.h);
        if ((x - nx) ** 2 + (y - ny) ** 2 < r * r) return true;
      }
    }
    return false;
  }
  moveCircle(e, dx, dy, r, canWater = false) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3));
    const sx = dx / steps, sy = dy / steps;
    let bx = false, by = false;
    for (let s = 0; s < steps; s++) {
      if (sx && !this.hit(e.x + sx, e.y, r, canWater)) e.x += sx; else if (sx) bx = true;
      if (sy && !this.hit(e.x, e.y + sy, r, canWater)) e.y += sy; else if (sy) by = true;
    }
    // empurra para fora de troncos (círculos), deslizando
    for (const c of this.near(e.x, e.y)) {
      if (c.off || !c.r) continue;
      const ddx = e.x - c.x, ddy = (e.y - c.y) * 1.2, d = Math.hypot(ddx, ddy), m = r + c.r;
      if (d < m && d > 0.001) {
        const px = e.x + (ddx / d) * (m - d), py = e.y + (ddy / d) * (m - d) / 1.2;
        if (!this.hit(px, py, r * 0.6, canWater)) { e.x = px; e.y = py; }
      }
    }
    return { bx, by };
  }

  // ---------- desenháveis estáticos ----------
  addDrawable(d) {
    this.drawables.push(d);
    const k = this._key(d.x, d.y, 128);
    if (!this.drawGrid.has(k)) this.drawGrid.set(k, []);
    this.drawGrid.get(k).push(d);
    if (d.crown) this.crowns.push(d);
    return d;
  }
  queryDrawables(x0, y0, x1, y1, out) {
    for (let gy = Math.floor((y0 - 96) / 128); gy <= Math.floor((y1 + 160) / 128); gy++)
      for (let gx = Math.floor((x0 - 96) / 128); gx <= Math.floor((x1 + 96) / 128); gx++) {
        const a = this.drawGrid.get(gx + ',' + gy);
        if (a) for (const d of a) if (!d.hidden) out.push(d);
      }
    return out;
  }

  addDensity(x, y, r, v = 1) {
    const t0x = Math.floor((x - r) / 16), t1x = Math.floor((x + r) / 16);
    const t0y = Math.floor((y - r) / 16), t1y = Math.floor((y + r) / 16);
    for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) {
      if (tx < 0 || ty < 0 || tx >= this.tw || ty >= this.th) continue;
      const d = Math.hypot(tx * 16 + 8 - x, ty * 16 + 8 - y) / r;
      if (d < 1) this.density[ty * this.tw + tx] = Math.min(1, this.density[ty * this.tw + tx] + (1 - d) * v);
    }
  }
  densityAt(x, y) {
    const tx = (x / 16) | 0, ty = (y / 16) | 0;
    if (tx < 0 || ty < 0 || tx >= this.tw || ty >= this.th) return 1;
    return this.density[ty * this.tw + tx];
  }
  buildDensityCanvas() {
    const c = makeCanvas(this.tw, this.th), x = c.getContext('2d');
    const id = x.createImageData(this.tw, this.th);
    for (let i = 0; i < this.density.length; i++) { id.data[i * 4 + 3] = Math.round(this.density[i] * 255); }
    x.putImageData(id, 0, 0);
    this.densityCanvas = c;
  }

  // ---------- chão pré-renderizado ----------
  renderGround() {
    const W = this.W, H = this.H;
    const cv = makeCanvas(W, H);
    const ctx = cv.getContext('2d');
    const id = ctx.createImageData(W, H);
    const D = id.data;
    const cw = this.cw;
    // proximidade de água para margens molhadas
    const wet = new Uint8Array(this.cw * this.ch);
    for (let cy = 0; cy < this.ch; cy++) for (let cx = 0; cx < cw; cx++) {
      const i = cy * cw + cx;
      if (!this.isWaterT(this.ter[i])) continue;
      for (let j = -3; j <= 3; j++) for (let k = -3; k <= 3; k++) {
        const x = cx + k, y = cy + j;
        if (x < 0 || y < 0 || x >= cw || y >= this.ch) continue;
        const n = y * cw + x;
        if (!this.isWaterT(this.ter[n])) { const dd = 4 - Math.max(Math.abs(j), Math.abs(k)); if (dd > wet[n]) wet[n] = dd; }
      }
    }
    for (let y = 0; y < H; y++) {
      const cy = y >> 1;
      for (let x = 0; x < W; x++) {
        const cx = x >> 1, ci = cy * cw + cx;
        const t = this.ter[ci];
        let r, g, b;
        const h = hash2(x, y, 7);
        if (t === T.RIVER || t === T.CREEK) {
          const d = clamp(this.dep[ci], 0, 1);
          const sh = t === T.RIVER ? [156, 136, 94] : [74, 54, 34];
          const dp = t === T.RIVER ? [96, 82, 56] : [24, 18, 14];
          const n = fbm(x * 0.02, y * 0.05, 31, 2) * 0.25;
          const k = clamp(d + n - 0.12, 0, 1);
          r = sh[0] + (dp[0] - sh[0]) * k; g = sh[1] + (dp[1] - sh[1]) * k; b = sh[2] + (dp[2] - sh[2]) * k;
          if (h < 0.004) { r += 30; g += 30; b += 26; }
        } else {
          const P = PAL[t] || PAL[0];
          const n = fbm(cx * 0.045, cy * 0.045, 5 + t, 3);
          const a = P[0], c2 = P[1];
          r = a[0] + (c2[0] - a[0]) * n; g = a[1] + (c2[1] - a[1]) * n; b = a[2] + (c2[2] - a[2]) * n;
          if (hash2(cx >> 1, cy >> 1, 9 + t) < 0.18) { r = (r + P[2][0]) / 2; g = (g + P[2][1]) / 2; b = (b + P[2][2]) / 2; }
          const f = 0.92 + h * 0.14; r *= f; g *= f; b *= f;
          if (t === T.FLOOR || t === T.CLEAR) {
            const lh = hash2(x >> 1, y, 13);
            if (lh < 0.05) { const c = LEAF[(lh * 1000 | 0) % LEAF.length]; r = c[0]; g = c[1]; b = c[2]; }
          } else if (t === T.GRASS) {
            if (h > 0.9) { r *= 0.8; g *= 0.85; } else if (h < 0.04) { r += 24; g += 30; b += 10; }
          } else if (t === T.DIRT) {
            if (h < 0.015) { r = 170; g = 150; b = 120; }
          } else if (t === T.ROCA) {
            if (((y >> 3) % 3) === 0) { r *= 0.82; g *= 0.8; b *= 0.8; }
          } else if (t === T.WOOD) {
            if (x % 6 === 0) { r *= 0.7; g *= 0.7; b *= 0.7; }
            else if (y % 18 === 0 && x % 12 < 2) { r *= 0.6; g *= 0.6; b *= 0.6; }
          } else if (t === T.SAND) {
            if (h < 0.03) { r -= 30; g -= 30; b -= 30; }
          } else if (t === T.ROCK || t === T.STONE) {
            // pedra: blocos irregulares, fendas escuras e musgo
            const bn = fbm(x * 0.07, y * 0.09, 41, 3), bk = 0.72 + bn * 0.55;
            r *= bk; g *= bk; b *= bk;
            const cr = hash2(x >> 2, y >> 2, 23);
            if (cr < 0.08 || Math.abs(fbm(x * 0.05, y * 0.05, 43, 2) - 0.5) < 0.012) { r *= 0.6; g *= 0.6; b *= 0.58; } else if (h > 0.97) { r += 18; g += 18; b += 14; }
            if (t === T.ROCK && fbm(x * 0.04, y * 0.04, 47, 2) > 0.62) { r = r * 0.6 + 14; g = g * 0.7 + 34; b *= 0.55; }
            if (t === T.STONE && hash2(x >> 3, y >> 3, 29) < 0.12) { r = r * 0.7 + 20; g = g * 0.8 + 30; b *= 0.6; }
          } else if (t === T.SHALLOW) {
            // água rasa sobre o barro: reflexo claro e seixos
            const wn = fbm(x * 0.03, y * 0.08, 53, 2);
            r = r * 0.8 + 18 * wn; g = g * 0.85 + 30 * wn; b = b * 0.9 + 34 * wn;
            if (h < 0.02) { r += 40; g += 40; b += 34; } else if (h > 0.985) { r = 120; g = 108; b = 84; }
          } else if (t === T.GULLY) {
            const d2 = clamp(this.dep[ci], 0, 1); r *= 1 - d2 * 0.5; g *= 1 - d2 * 0.5; b *= 1 - d2 * 0.45;
            if (h < 0.05) { r += 20; g += 14; b += 6; }
          }
          const w = wet[ci];
          if (w) { const k = 1 - w * 0.07; r *= k; g *= k; b *= k * 0.98; }
        }
        const p = (y * W + x) * 4;
        D[p] = r; D[p + 1] = g; D[p + 2] = b; D[p + 3] = 255;
      }
    }
    ctx.putImageData(id, 0, 0);
    this.ground = cv;
    this.groundCtx = ctx;
    return ctx;
  }

  buildMiniMap() {
    const s = 8;
    const c = makeCanvas(Math.ceil(this.W / s), Math.ceil(this.H / s));
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = true;
    x.drawImage(this.ground, 0, 0, c.width, c.height);
    // copas escurecem o minimapa
    x.globalAlpha = 0.55;
    x.imageSmoothingEnabled = true;
    const dc = this.densityCanvas;
    if (dc) {
      const tmp = makeCanvas(dc.width, dc.height), tx = tmp.getContext('2d');
      tx.drawImage(dc, 0, 0); tx.globalCompositeOperation = 'source-in'; tx.fillStyle = '#16301a'; tx.fillRect(0, 0, dc.width, dc.height);
      x.drawImage(tmp, 0, 0, c.width, c.height);
    }
    x.globalAlpha = 1;
    this.mini = c; this.miniScale = s;
  }

  explore(x, y, r = 150) {
    const c0 = Math.floor((x - r) / 32), c1 = Math.floor((x + r) / 32);
    const r0 = Math.floor((y - r) / 32), r1 = Math.floor((y + r) / 32);
    for (let j = r0; j <= r1; j++) for (let i = c0; i <= c1; i++) {
      if (i < 0 || j < 0 || i >= this.fogCols || j >= this.fogRows) continue;
      if (Math.hypot(i * 32 + 16 - x, j * 32 + 16 - y) < r) this.explored[j * this.fogCols + i] = 1;
    }
  }
}

const LEAF = [[110, 70, 30], [140, 90, 36], [96, 60, 30], [150, 116, 50], [80, 70, 34], [120, 50, 30], [70, 80, 36]];
