// Renderizador Canvas 2D: chão, água animada, sombras, ordenação por profundidade, copas,
// fachos de luz, partículas, iluminação dinâmica, gradação de cor e indicadores
import { hash2, clamp } from '../core/util.js';
import { makeCanvas } from '../gfx/pixel.js';

export class Renderer {
  constructor(g, canvas) {
    this.g = g; this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1; this.cw = 1; this.ch = 1; this.zoom = 3;
    this.shadowBuf = makeCanvas(8, 8); this.sctx = this.shadowBuf.getContext('2d');
    this.lightBuf = makeCanvas(8, 8); this.lctx = this.lightBuf.getContext('2d');
    this.tmpList = [];
  }

  resize() {
    const r = this.canvas.parentElement.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.cssW = Math.max(1, r.width); this.cssH = Math.max(1, r.height);
    this.cw = Math.round(this.cssW * this.dpr); this.ch = Math.round(this.cssH * this.dpr);
    this.canvas.width = this.cw; this.canvas.height = this.ch;
    let z = Math.min(this.cw / 250, this.ch / 230);
    z = z >= 2 ? Math.floor(z) : Math.max(1, z);
    this.zoom = z;
    this.vignette = null;
  }

  view() {
    const cam = this.g.camera;
    const z = this.zoom * cam.zoom;
    const vw = this.cw / z, vh = this.ch / z;
    cam.viewW = vw; cam.viewH = vh;
    let cx = cam.x + cam.sx - vw / 2, cy = cam.y + cam.sy - vh / 2;
    cx = Math.round(cx * z) / z; cy = Math.round(cy * z) / z;
    return { z, vw, vh, cx, cy };
  }

  worldToScreen(wx, wy) {
    const v = this.lastView || this.view();
    return { x: (wx - v.cx) * v.z / this.dpr, y: (wy - v.cy) * v.z / this.dpr };
  }
  screenToWorld(sx, sy) {
    const v = this.lastView || this.view();
    return { x: sx * this.dpr / v.z + v.cx, y: sy * this.dpr / v.z + v.cy };
  }

  ensureBuf(buf, ctxName, w, h) {
    w = Math.ceil(w) + 2; h = Math.ceil(h) + 2;
    if (this[buf].width !== w || this[buf].height !== h) { this[buf].width = w; this[buf].height = h; this[ctxName] = this[buf].getContext('2d'); }
  }

  render() {
    const g = this.g, ctx = this.ctx, w = g.world;
    if (!w || !w.ground) { ctx.fillStyle = '#0b120a'; ctx.fillRect(0, 0, this.cw, this.ch); return; }
    const V = (this.lastView = this.view());
    const { z, vw, vh, cx, cy } = V;
    const t = g.time;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0b120a'; ctx.fillRect(0, 0, this.cw, this.ch);
    ctx.setTransform(z, 0, 0, z, -cx * z, -cy * z);

    // chão
    const sx = Math.max(0, Math.floor(cx)), sy = Math.max(0, Math.floor(cy));
    const sw = Math.min(w.W - sx, Math.ceil(vw) + 2), sh = Math.min(w.H - sy, Math.ceil(vh) + 2);
    if (sw > 0 && sh > 0) ctx.drawImage(w.ground, sx, sy, sw, sh, sx, sy, sw, sh);
    this.drawWater(ctx, cx, cy, vw, vh, t);

    // objetos visíveis
    const list = this.tmpList; list.length = 0;
    w.queryDrawables(cx, cy, cx + vw, cy + vh, list);

    // camada de chão (rastros, ponte, galhos, sombras de contato)
    for (const d of list) if (d.layer === 'ground') this.drawItem(ctx, d);
    g.phase?.drawGround?.(ctx, V);

    // sombras projetadas pelo sol
    const sun = g.sun;
    if (sun.strength > 0.02) {
      this.ensureBuf('shadowBuf', 'sctx', vw, vh);
      const s = this.sctx;
      s.setTransform(1, 0, 0, 1, 0, 0); s.clearRect(0, 0, this.shadowBuf.width, this.shadowBuf.height);
      s.setTransform(1, 0, 0, 1, -Math.floor(cx), -Math.floor(cy));
      s.fillStyle = '#000';
      for (const d of list) {
        if (d.crown) {
          const cr = d.crown;
          s.beginPath();
          s.ellipse(d.x + cr.dx + sun.dx * (cr.h || 40) * 0.5, d.y + 4 + sun.dy * 6, cr.r * 0.95, cr.r * 0.55, 0, 0, Math.PI * 2);
          s.fill();
        }
        if (d.shadow) {
          const sh2 = d.shadow;
          s.beginPath();
          s.ellipse(d.x + (sh2.dx || 0) + sun.dx * (sh2.len || 6), d.y + (sh2.dy || 0), sh2.rx, sh2.ry, 0, 0, Math.PI * 2);
          s.fill();
        }
      }
      ctx.globalAlpha = sun.strength * 0.3;
      ctx.drawImage(this.shadowBuf, Math.floor(cx), Math.floor(cy));
      ctx.globalAlpha = 1;
    }

    // camada principal ordenada por profundidade
    const ents = [];
    for (const d of list) if (d.layer !== 'ground') ents.push(d);
    for (const e of g.entities) if (e.x > cx - 40 && e.x < cx + vw + 40 && e.y > cy - 30 && e.y < cy + vh + 60) ents.push(e);
    ents.sort((a, b) => (a.sortY ?? a.y) - (b.sortY ?? b.y));
    for (const e of ents) {
      if (e.draw && !e.sprite) e.draw(ctx, g);
      else this.drawItem(ctx, e);
    }

    // mira
    const p = g.player;
    if (p && p.aiming) {
      const ax = p.x + Math.cos(p.aimAngle) * 70, ay = p.y - 10 + Math.sin(p.aimAngle) * 70;
      ctx.globalAlpha = 0.35; ctx.strokeStyle = '#f4ecd0'; ctx.lineWidth = 1 / z * 2;
      ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(p.x, p.y - 10); ctx.lineTo(ax, ay); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 0.9; ctx.fillStyle = '#f4ecd0';
      ctx.fillRect(Math.round(ax) - 4, Math.round(ay), 3, 1); ctx.fillRect(Math.round(ax) + 2, Math.round(ay), 3, 1);
      ctx.fillRect(Math.round(ax), Math.round(ay) - 4, 1, 3); ctx.fillRect(Math.round(ax), Math.round(ay) + 2, 1, 3);
      ctx.globalAlpha = 1;
    }

    // copas (a fase pode pedir copas translúcidas sobre outros pontos: bichos, câmera)
    const clear = g.phase?.crownClear?.(V) || null;
    for (const d of list) {
      if (!d.crown) continue;
      const cr = d.crown;
      const ccx = d.x + cr.dx, ccy = d.y + cr.dy;
      let a = 1;
      if (p) {
        const dd = Math.hypot(p.x - ccx, (p.y - 12 - ccy) * 1.1);
        const inner = cr.r * 0.5 + 34, outer = cr.r + 52;
        if (dd < outer) a = 0.28 + 0.72 * clamp((dd - inner) / (outer - inner), 0, 1);
      }
      if (clear) for (const q of clear) {
        const dd = Math.hypot(q.x - ccx, (q.y - 10 - ccy) * 1.1), inner = cr.r * 0.45 + q.r * 0.4, outer = cr.r + q.r;
        if (dd < outer) a = Math.min(a, q.min + (1 - q.min) * clamp((dd - inner) / (outer - inner), 0, 1));
      }
      d.crownAlpha = d.crownAlpha === undefined ? a : d.crownAlpha + (a - d.crownAlpha) * 0.15;
      ctx.globalAlpha = d.crownAlpha;
      ctx.drawImage(cr.sprite, Math.round(ccx - cr.sprite.width / 2), Math.round(ccy - cr.sprite.height / 2));
    }
    ctx.globalAlpha = 1;
    for (const e of g.airEntities) e.drawAir ? e.drawAir(ctx) : e.draw(ctx);

    // fachos de luz entre as copas
    if (sun.strength > 0.12) this.drawShafts(ctx, cx, cy, vw, vh, t, sun);

    g.particles.draw(ctx, cx, cy, cx + vw, cy + vh, g.darkness);
    g.phase?.drawWorldOverlay?.(ctx, V);

    // iluminação
    this.drawLighting(ctx, V);
    g.phase?.drawAfterLight?.(ctx, V);

    // gradação de cor
    const tint = g.tint;
    if (tint && tint[3] > 0.01) {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = `rgba(${tint[0] | 0},${tint[1] | 0},${tint[2] | 0},${tint[3]})`;
      ctx.fillRect(cx, cy, vw, vh);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (g.flash > 0) { ctx.fillStyle = `rgba(255,250,230,${g.flash})`; ctx.fillRect(cx, cy, vw, vh); }

    // espaço de tela
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawVignette(ctx, g.vignette);
    if (g.state === 'play') { this.drawMarker(ctx, V); this.drawPrompt(ctx, V); }
    this.drawSoundCues(ctx);
    if (g.letterbox > 0) {
      const h = this.ch * 0.1 * g.letterbox;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, this.cw, h); ctx.fillRect(0, this.ch - h, this.cw, h);
    }
    if (g.fade > 0) { ctx.fillStyle = `rgba(4,6,4,${g.fade})`; ctx.fillRect(0, 0, this.cw, this.ch); }
  }

  drawItem(ctx, d) {
    if (d.draw) { d.draw(ctx, this.g); return; }
    if (!d.sprite) return;
    ctx.drawImage(d.sprite, Math.round(d.x - d.ax), Math.round(d.y - d.ay));
  }

  drawWater(ctx, cx, cy, vw, vh, t) {
    const w = this.g.world;
    const tx0 = Math.max(0, Math.floor(cx / 16)), ty0 = Math.max(0, Math.floor(cy / 16));
    const tx1 = Math.min(w.tw - 1, Math.ceil((cx + vw) / 16)), ty1 = Math.min(w.th - 1, Math.ceil((cy + vh) / 16));
    const glint = this.g.waterGlint || '#e8f0f4';
    ctx.fillStyle = glint;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const wt = w.waterTiles[ty * w.tw + tx];
      if (!wt) continue;
      const speed = wt === 1 ? 7 : 4;
      for (let k = 0; k < 2; k++) {
        const h1 = hash2(tx, ty, k * 3 + 1), h2 = hash2(tx, ty, k * 3 + 2);
        const px = tx * 16 + ((h1 * 16 - t * speed) % 16 + 16) % 16;
        const py = ty * 16 + Math.floor(h2 * 16);
        if (!w.isWater(px, py) || !w.isWater(px + 3, py)) continue;
        const a = 0.12 + 0.12 * Math.sin(t * 1.5 + h1 * 20);
        ctx.globalAlpha = a * (wt === 1 ? 1 : 0.6);
        ctx.fillRect(Math.floor(px), py, wt === 1 ? 4 : 3, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  drawShafts(ctx, cx, cy, vw, vh, t, sun) {
    const w = this.g.world;
    ctx.globalCompositeOperation = 'screen';
    const g0x = Math.floor(cx / 72) - 1, g1x = Math.ceil((cx + vw) / 72) + 1;
    const g0y = Math.floor(cy / 72) - 1, g1y = Math.ceil((cy + vh) / 72) + 2;
    for (let gy = g0y; gy <= g1y; gy++) for (let gx = g0x; gx <= g1x; gx++) {
      if (hash2(gx, gy, 77) > 0.22) continue;
      const bx = gx * 72 + hash2(gx, gy, 78) * 50, by = gy * 72 + hash2(gx, gy, 79) * 50;
      if (w.densityAt(bx, by) < 0.45) continue;
      const pulse = 0.6 + 0.4 * Math.sin(t * 0.35 + gx * 1.3 + gy);
      const a = 0.07 * sun.strength * pulse;
      const wdt = 7 + hash2(gx, gy, 80) * 9;
      const len = 70;
      const skew = sun.dx * -26;
      const grd = ctx.createLinearGradient(bx, by - len, bx, by);
      grd.addColorStop(0, `rgba(255,236,170,0)`); grd.addColorStop(0.5, `rgba(255,232,160,${a})`); grd.addColorStop(1, `rgba(255,220,150,${a * 1.4})`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(bx + skew, by - len); ctx.lineTo(bx + skew + wdt, by - len);
      ctx.lineTo(bx + wdt * 1.6, by); ctx.lineTo(bx - wdt * 0.6, by); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = a * 3;
      ctx.fillStyle = 'rgba(255,230,160,1)';
      ctx.beginPath(); ctx.ellipse(bx + wdt * 0.5, by, wdt * 1.1, wdt * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      if (Math.random() < 0.02) this.g.particles.add({ type: 'dust', x: bx + Math.random() * wdt, y: by - Math.random() * len * 0.8, vx: 1, vy: 2, life: 4, seed: Math.random() * 9, a: sun.strength });
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  drawLighting(ctx, V) {
    const g = this.g, w = g.world, { vw, vh, cx, cy } = V;
    const dark = g.darkness, canopy = g.canopyDark;
    if (dark < 0.01 && canopy < 0.01) return;
    this.ensureBuf('lightBuf', 'lctx', vw, vh);
    const L = this.lctx, ox = Math.floor(cx), oy = Math.floor(cy);
    L.setTransform(1, 0, 0, 1, 0, 0);
    L.globalCompositeOperation = 'source-over';
    L.clearRect(0, 0, this.lightBuf.width, this.lightBuf.height);
    const amb = g.ambientColor;
    L.fillStyle = `rgba(${amb[0]},${amb[1]},${amb[2]},${dark})`;
    L.fillRect(0, 0, this.lightBuf.width, this.lightBuf.height);
    if (canopy > 0.01 && w.densityCanvas) {
      L.imageSmoothingEnabled = true;
      L.globalAlpha = canopy;
      L.drawImage(w.densityCanvas, ox / 16, oy / 16, this.lightBuf.width / 16, this.lightBuf.height / 16, 0, 0, this.lightBuf.width, this.lightBuf.height);
      L.globalAlpha = 1;
    }
    L.globalCompositeOperation = 'destination-out';
    L.setTransform(1, 0, 0, 1, -ox, -oy);
    const lights = g.collectLights(V);
    for (const l of lights) {
      if (l.x < cx - l.r || l.x > cx + vw + l.r || l.y < cy - l.r || l.y > cy + vh + l.r) continue;
      const fl = l.flicker ? 0.9 + Math.sin(g.time * 13 + l.x) * 0.05 + Math.random() * 0.05 : 1;
      const r = l.r * fl;
      if (l.cone) {
        L.save(); L.translate(l.x, l.y); L.rotate(l.angle);
        const grd = L.createRadialGradient(0, 0, 4, 0, 0, r);
        grd.addColorStop(0, `rgba(0,0,0,${l.i})`); grd.addColorStop(0.7, `rgba(0,0,0,${l.i * 0.6})`); grd.addColorStop(1, 'rgba(0,0,0,0)');
        L.fillStyle = grd;
        L.beginPath(); L.moveTo(0, 0); L.arc(0, 0, r, -l.spread, l.spread); L.closePath(); L.fill();
        L.restore();
      } else {
        const grd = L.createRadialGradient(l.x, l.y, 0, l.x, l.y, r);
        grd.addColorStop(0, `rgba(0,0,0,${l.i})`); grd.addColorStop(0.5, `rgba(0,0,0,${l.i * 0.55})`); grd.addColorStop(1, 'rgba(0,0,0,0)');
        L.fillStyle = grd;
        L.fillRect(l.x - r, l.y - r, r * 2, r * 2);
      }
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.lightBuf, ox, oy);
    // brilho colorido aditivo
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      if (!l.color) continue;
      const r = l.r * 0.7;
      const grd = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, r);
      grd.addColorStop(0, `rgba(${l.color},${0.16 * dark + 0.04})`); grd.addColorStop(1, `rgba(${l.color},0)`);
      ctx.fillStyle = grd; ctx.fillRect(l.x - r, l.y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = false;
  }

  drawVignette(ctx, strength = 0.5) {
    if (!this.vignette) {
      const c = makeCanvas(this.cw, this.ch), x = c.getContext('2d');
      const grd = x.createRadialGradient(this.cw / 2, this.ch / 2, Math.min(this.cw, this.ch) * 0.35, this.cw / 2, this.ch / 2, Math.max(this.cw, this.ch) * 0.75);
      grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,1)');
      x.fillStyle = grd; x.fillRect(0, 0, this.cw, this.ch);
      this.vignette = c;
    }
    ctx.globalAlpha = strength; ctx.drawImage(this.vignette, 0, 0); ctx.globalAlpha = 1;
  }

  drawMarker(ctx, V) {
    const g = this.g;
    if (!g.settings.markers) return;
    const tgt = g.currentTarget();
    if (!tgt) return;
    const { z, vw, vh, cx, cy } = V;
    const sx = (tgt.x - cx) * z, sy = (tgt.y - 18 - cy) * z;
    const m = 34 * this.dpr;
    const d = Math.hypot(tgt.x - g.player.x, tgt.y - g.player.y);
    const bob = Math.sin(g.time * 4) * 3 * this.dpr;
    ctx.save();
    if (sx > m && sy > m && sx < this.cw - m && sy < this.ch - m) {
      if (d < 26) { ctx.restore(); return; }
      ctx.translate(sx, sy + bob);
      ctx.fillStyle = 'rgba(255,214,102,0.95)'; ctx.strokeStyle = 'rgba(40,24,8,0.9)'; ctx.lineWidth = 2 * this.dpr;
      const s = 6 * this.dpr;
      ctx.beginPath(); ctx.moveTo(-s, -s); ctx.lineTo(s, -s); ctx.lineTo(0, s * 0.6); ctx.closePath(); ctx.stroke(); ctx.fill();
    } else {
      const ang = Math.atan2(sy - this.ch / 2, sx - this.cw / 2);
      const ex = this.cw / 2 + Math.cos(ang) * (this.cw / 2 - m), ey = this.ch / 2 + Math.sin(ang) * (this.ch / 2 - m);
      const px = clamp(ex, m, this.cw - m), py = clamp(ey, m, this.ch - m);
      ctx.translate(px, py);
      ctx.save(); ctx.rotate(ang);
      ctx.fillStyle = 'rgba(255,214,102,0.9)'; ctx.strokeStyle = 'rgba(40,24,8,0.9)'; ctx.lineWidth = 2 * this.dpr;
      const s = 8 * this.dpr;
      ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 0.6, -s * 0.7); ctx.lineTo(-s * 0.2, 0); ctx.lineTo(-s * 0.6, s * 0.7); ctx.closePath(); ctx.stroke(); ctx.fill();
      ctx.restore();
      ctx.font = `700 ${11 * this.dpr}px Nunito, sans-serif`; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const txt = `${Math.round(d / 16)} m`;
      const ty = Math.sin(ang) > 0.3 ? -16 * this.dpr : 22 * this.dpr;
      ctx.fillText(txt, 1, ty + 1); ctx.fillStyle = '#ffe6a0'; ctx.fillText(txt, 0, ty);
    }
    ctx.restore();
  }

  drawPrompt(ctx, V) {
    const g = this.g, f = g.focus;
    if (!f) return;
    const { z, cx, cy } = V;
    const sx = (f.x - cx) * z, sy = (f.y - (f.py ?? 22) - cy) * z;
    const label = typeof f.label === 'function' ? f.label() : f.label;
    const key = g.input.lastDevice === 'touch' ? '✋' : 'E';
    const fs = 12 * this.dpr;
    ctx.font = `700 ${fs}px Nunito, sans-serif`;
    const tw = ctx.measureText(label).width;
    const kw = fs * 1.6, pad = fs * 0.6, h = fs * 1.9;
    const W = kw + pad * 3 + tw;
    const x = Math.round(sx - W / 2), y = Math.round(sy - h);
    ctx.fillStyle = 'rgba(14,18,10,0.82)'; this.rr(ctx, x, y, W, h, 6 * this.dpr); ctx.fill();
    ctx.strokeStyle = 'rgba(232,200,120,0.6)'; ctx.lineWidth = 1 * this.dpr; ctx.stroke();
    ctx.fillStyle = '#e8c878'; this.rr(ctx, x + pad, y + (h - kw * 0.9) / 2, kw, kw * 0.9, 4 * this.dpr); ctx.fill();
    ctx.fillStyle = '#1c140a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(key, x + pad + kw / 2, y + h / 2 + 1);
    ctx.fillStyle = '#f4ecd8'; ctx.textAlign = 'left';
    ctx.fillText(label, x + pad * 2 + kw, y + h / 2 + 1);
    ctx.textBaseline = 'alphabetic';
  }

  drawSoundCues(ctx) {
    const g = this.g;
    if (!g.settings.visualSound) return;
    for (const c of g.soundCues) {
      const k = c.t / c.life, a = (1 - k) * 0.8;
      const left = c.pan < -0.25, right = c.pan > 0.25;
      const x = left ? 24 * this.dpr : right ? this.cw - 24 * this.dpr : this.cw / 2;
      const y = left || right ? this.ch * 0.45 : 46 * this.dpr;
      ctx.strokeStyle = `rgba(255,235,180,${a})`; ctx.lineWidth = 2 * this.dpr;
      for (let i = 0; i < 3; i++) {
        const r = (10 + i * 8 + k * 10) * this.dpr;
        ctx.beginPath();
        if (left) ctx.arc(x + 30 * this.dpr, y, r, Math.PI * 0.75, Math.PI * 1.25);
        else if (right) ctx.arc(x - 30 * this.dpr, y, r, -Math.PI * 0.25, Math.PI * 0.25);
        else ctx.arc(x, y + 20 * this.dpr, r, Math.PI * 1.25, Math.PI * 1.75);
        ctx.stroke();
      }
    }
  }

  rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
}
