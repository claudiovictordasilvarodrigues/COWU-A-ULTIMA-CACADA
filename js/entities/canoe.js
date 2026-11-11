// Fase 3 — navegação: geometria dos canais, campo de correnteza, canoa com física simplificada
// (aceleração progressiva, inércia, quilha, correnteza limitada, colisões confiáveis) e troncos
// que descem o igarapé.
import { clamp, lerp, dist, hash2 } from '../core/util.js';
import { Sprites } from '../gfx/sprites.js';
import { canoeHull, caetanoSeated, CANOE_HALF } from '../gfx/art-varzea.js';
import { logSprite } from '../gfx/art-forest2.js';

const S = 16;
const SQ = 0.82; // achatamento vertical da vista 3/4 (o mesmo do desenho do casco)

// ---------------------------------------------------------------- polilinha com largura
// pts: [x, y, largura, correnteza] em tiles (x, y, largura) e px/s (correnteza)
export class Poly {
  constructor(pts) {
    this.p = pts.map(([x, y, w, c]) => ({ x: x * S, y: y * S, w: w * S, c }));
    this.seg = []; let acc = 0;
    for (let i = 0; i < this.p.length - 1; i++) {
      const a = this.p[i], b = this.p[i + 1], L = Math.hypot(b.x - a.x, b.y - a.y);
      this.seg.push({ a, b, L, acc, tx: (b.x - a.x) / L, ty: (b.y - a.y) / L });
      acc += L;
    }
    this.len = acc;
  }
  // ponto, tangente e propriedades na distância s ao longo da linha
  at(s) {
    s = clamp(s, 0, this.len);
    let g = this.seg[this.seg.length - 1];
    for (const q of this.seg) if (s <= q.acc + q.L) { g = q; break; }
    const k = clamp((s - g.acc) / g.L, 0, 1);
    return { x: g.a.x + (g.b.x - g.a.x) * k, y: g.a.y + (g.b.y - g.a.y) * k, tx: g.tx, ty: g.ty, w: lerp(g.a.w, g.b.w, k), c: lerp(g.a.c, g.b.c, k), s };
  }
  segPoint(i, t, off = 0) {
    const g = this.seg[Math.min(i, this.seg.length - 1)];
    const x = g.a.x + (g.b.x - g.a.x) * t, y = g.a.y + (g.b.y - g.a.y) * t;
    return { x: x - g.ty * off * S, y: y + g.tx * off * S };
  }
  // projeção de um ponto: distância à linha, parâmetro s e propriedades interpoladas
  project(x, y) {
    let best = null;
    for (const q of this.seg) {
      const vx = x - q.a.x, vy = y - q.a.y;
      const k = clamp((vx * q.tx + vy * q.ty) / q.L, 0, 1);
      const cx = q.a.x + (q.b.x - q.a.x) * k, cy = q.a.y + (q.b.y - q.a.y) * k;
      const d = Math.hypot(x - cx, y - cy);
      if (!best || d < best.d) best = { d, s: q.acc + k * q.L, tx: q.tx, ty: q.ty, w: lerp(q.a.w, q.b.w, k), c: lerp(q.a.c, q.b.c, k), cx, cy };
    }
    return best;
  }
}

// ---------------------------------------------------------------- campo de correnteza
// Calculado uma vez por tile de água: a água desce da lagoa para o lago (sentido inverso ao da
// viagem). Mais forte no meio do canal, fraca nas margens; parada no lago e na lagoa.
export function buildCurrent(world, polys) {
  const tw = world.tw, th = world.th, F = new Float32Array(tw * th * 2);
  for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
    const x = tx * S + 8, y = ty * S + 8;
    if (!world.isWater(x, y)) continue;
    let best = null;
    for (const P of polys) { const q = P.project(x, y); if (q.d < q.w * 0.75 && (!best || q.d < best.d)) best = q; }
    if (!best) continue;
    const prof = clamp(1 - Math.pow(best.d / (best.w * 0.5), 2) * 0.75, 0.2, 1);
    const i = (ty * tw + tx) * 2;
    F[i] = -best.tx * best.c * prof; F[i + 1] = -best.ty * best.c * prof;
  }
  return {
    at(x, y) {
      const tx = clamp((x / S) | 0, 0, tw - 1), ty = clamp((y / S) | 0, 0, th - 1), i = (ty * tw + tx) * 2;
      return { x: F[i], y: F[i + 1] };
    },
    F,
  };
}

// ---------------------------------------------------------------- canoa
export const HULL = [[-11, 2.4], [-5.5, 3.6], [0, 4.2], [5.5, 3.6], [11, 2.4]];
const ACC = 44, MAXF = 64, MAXB = 22, BRAKE = 70;

export class Canoe {
  constructor(g, ph, x, y, a) {
    this.g = g; this.ph = ph; this.x = x; this.y = y; this.a = a;
    this.vx = 0; this.vy = 0; this.f = 0; this.l = 0;
    this.state = 'stuck'; // stuck (atolada na margem) | float (na água, vazia) | boarded
    this.stroke = 0; this.side = 1; this.strokeOn = false; this.rock = 0; this.rockV = 0; this.bob = 0;
    this.wakeT = 0; this.stuckT = 0; this.hits = 0; this.lastHit = -9; this.turb = 0; this.thrust = 0; this.turn = 0;
    this.sortY = y;
  }
  get speed() { return Math.hypot(this.vx, this.vy); }
  dir() { return { x: Math.cos(this.a), y: Math.sin(this.a) }; }

  // ---------- colisão ----------
  // círculos ao longo do casco (no espaço do mundo, com o achatamento da vista)
  circles(x, y, a) {
    const ca = Math.cos(a), sa = Math.sin(a);
    return HULL.map(([u, r]) => ({ x: x + ca * u, y: y + sa * u * SQ, r }));
  }
  water(x, y) { return this.g.world.isWater(x, y) && !this.g.world.blockedAt(x, y, true); }
  hitAt(x, y, a) {
    const w = this.g.world;
    for (const c of this.circles(x, y, a)) {
      for (const [dx, dy] of [[0, 0], [c.r, 0], [-c.r, 0], [0, c.r * 0.9], [0, -c.r * 0.9]]) if (!this.water(c.x + dx, c.y + dy)) return 'bank';
      for (const o of w.near(c.x, c.y)) {
        if (o.off || o.noBoat) continue;
        if (o.r) { if ((c.x - o.x) ** 2 + (c.y - o.y) ** 2 < (c.r + o.r) ** 2) return o.kind || 'obstacle'; }
        else if (o.w !== undefined) { const nx = clamp(c.x, o.x, o.x + o.w), ny = clamp(c.y, o.y, o.y + o.h); if ((c.x - nx) ** 2 + (c.y - ny) ** 2 < c.r * c.r) return o.kind || 'obstacle'; }
      }
      const lg = this.ph.logHit?.(c.x, c.y, c.r);
      if (lg) return 'log';
    }
    return null;
  }
  free(x = this.x, y = this.y, a = this.a) { return !this.hitAt(x, y, a); }

  // ---------- controle ----------
  input() {
    const inp = this.g.input;
    let thrust = 0, turn = 0;
    if (inp.joy && inp.joy.active) {
      // toque: o joystick aponta para onde a canoa deve ir; a inclinação é a força da remada
      const ax = inp.joy.x, ay = inp.joy.y, m = Math.min(1, Math.hypot(ax, ay));
      if (m > 0.2) {
        const want = Math.atan2(ay, ax);
        let d = want - this.a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        turn = clamp(d * 2.2, -1, 1);
        thrust = Math.abs(d) < 1.6 ? m * (1 - Math.abs(d) / 2.2) : -0.4 * m;
      }
    } else {
      if (inp.isDown('up')) thrust += 1;
      if (inp.isDown('down')) thrust -= 1;
      if (inp.isDown('left')) turn -= 1;
      if (inp.isDown('right')) turn += 1;
    }
    return { thrust, turn };
  }

  update(dt) {
    const g = this.g;
    this.bob += dt;
    this.rockV += -this.rock * 22 * dt - this.rockV * 2.2 * dt;
    this.rock += this.rockV * dt;
    if (this.state !== 'boarded') { this.vx = this.vy = 0; this.f = this.l = 0; this.thrust = this.turn = 0; return; }
    const ctl = g.state === 'play' ? this.input() : { thrust: 0, turn: 0 };
    this.thrust = ctl.thrust; this.turn = ctl.turn;
    const cur = this.ph.currentAt(this.x, this.y);
    const cx = cur.x * 0.85, cy = cur.y * 0.85;
    // velocidade relativa à água, decomposta na direção da canoa (f) e de lado (l)
    let h = this.dir();
    let rx = this.vx - cx, ry = this.vy - cy;
    let f = rx * h.x + ry * h.y, l = -rx * h.y + ry * h.x;
    // leme: gira mais fácil em movimento, mas dá para virar parado (remada de lado)
    const turnRate = 1.05 + 0.9 * Math.min(1, Math.abs(f) / 40);
    const na = this.a + ctl.turn * turnRate * dt * (f < -2 ? -0.7 : 1);
    if (ctl.turn && this.free(this.x, this.y, na)) this.a = na;
    else if (ctl.turn) { this.rockV += ctl.turn * 0.6 * dt; }
    h = this.dir();
    if (ctl.thrust > 0) f = Math.min(MAXF, f + ctl.thrust * ACC * dt * (f < 0 ? 2 : 1));
    else if (ctl.thrust < 0) f = f > 0 ? Math.max(0, f - BRAKE * dt) : Math.max(-MAXB, f + ctl.thrust * ACC * 0.6 * dt);
    f *= Math.exp(-0.42 * dt);           // inércia moderada
    l *= Math.exp(-3.8 * dt);            // a quilha segura o deslizamento lateral
    if (this.ph.inFloatGrass?.(this.x, this.y)) f *= Math.exp(-1.8 * dt);
    // turbulência (evento da sombra): empurrões laterais e balanço
    if (this.turb > 0) {
      const k = this.turb;
      l += Math.sin(g.time * 3.1) * 18 * k * dt + (Math.random() - 0.5) * 40 * k * dt;
      this.rockV += (Math.random() - 0.5) * 9 * k * dt;
    }
    this.f = f; this.l = l;
    this.vx = cx + h.x * f - h.y * l;
    this.vy = cy + h.y * f + h.x * l;
    this.move(dt);
    this.sortY = this.y;
    // remadas: o remo alterna de lado; para virar, rema do lado de fora da curva
    const paddling = Math.abs(ctl.thrust) > 0.05 || Math.abs(ctl.turn) > 0.05;
    if (paddling) {
      const prev = this.stroke;
      this.stroke += dt * (ctl.thrust < 0 ? 1.1 : 1.5);
      if (Math.floor(prev) !== Math.floor(this.stroke)) {
        this.side = ctl.turn > 0.3 ? -1 : ctl.turn < -0.3 ? 1 : -this.side;
        this.strokeOn = true;
        const p = this.paddlePoint(0.2);
        g.audio.play('paddle', { pan: 0, vol: 0.55 + 0.3 * Math.abs(ctl.thrust) });
        for (let i = 0; i < 5; i++) g.particles.add({ type: 'splash', x: p.x, y: p.y, vx: (Math.random() - 0.5) * 24, vy: -10 - Math.random() * 14, g: 60, life: 0.45, color: '#d8e8f0' });
        g.particles.add({ type: 'ripple', x: p.x, y: p.y, life: 0.9, r1: 7, color: '#cfe0e4' });
        g.player.makeNoise(0.32);
      }
    } else this.strokeOn = false;
    // esteira (ondas da canoa)
    const sp = this.speed;
    this.wakeT -= dt;
    if (sp > 7 && this.wakeT <= 0) {
      this.wakeT = 0.16 - Math.min(0.08, sp / 900);
      const st = { x: this.x - h.x * 12, y: this.y - h.y * 12 * SQ };
      for (const sd of [-1, 1]) g.particles.add({ type: 'ripple', x: st.x - h.y * sd * 4, y: st.y + h.x * sd * 3, vx: -h.y * sd * 6, vy: h.x * sd * 4, life: 1.2, r1: 5 + sp / 12, color: '#bcd2d6' });
    }
    // encalhe: remando sem sair do lugar
    if (Math.abs(ctl.thrust) > 0.3 && sp < 4) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt * 2);
  }

  move(dt) {
    const steps = Math.max(1, Math.ceil(this.speed * dt / 1.5));
    const sx = this.vx * dt / steps, sy = this.vy * dt / steps;
    for (let i = 0; i < steps; i++) {
      const nx = this.x + sx, ny = this.y + sy;
      if (this.free(nx, ny, this.a)) { this.x = nx; this.y = ny; continue; }
      const what = this.hitAt(nx, ny, this.a);
      // desliza ao longo do obstáculo quando possível
      if (this.free(nx, this.y, this.a)) { this.x = nx; this.vy *= 0.4; this.bump(Math.abs(this.vy) + Math.abs(sy / dt) * 0.5, what, true); continue; }
      if (this.free(this.x, ny, this.a)) { this.y = ny; this.vx *= 0.4; this.bump(Math.abs(this.vx) + Math.abs(sx / dt) * 0.5, what, true); continue; }
      this.bump(this.speed, what, false);
      this.vx *= -0.25; this.vy *= -0.25;
      const h = this.dir(); this.f = this.vx * h.x + this.vy * h.y;
      break;
    }
  }

  bump(force, what, glancing) {
    const g = this.g;
    if (g.time - this.lastHit < (glancing ? 0.6 : 0.35)) return;
    if (force < (glancing ? 16 : 6)) return;
    this.lastHit = g.time;
    this.hits++;
    const k = clamp(force / 60, 0.2, 1);
    this.rockV += (Math.random() < 0.5 ? -1 : 1) * 4 * k;
    g.audio.play(what === 'bank' ? 'canoeScrape' : 'canoeHit', { vol: 0.5 + k * 0.6 });
    g.camera.shake(0.6 + k * 1.2, 0.18);
    g.player.makeNoise(0.6 * k + 0.2);
    for (let i = 0; i < 6; i++) g.particles.add({ type: 'splash', x: this.x + (Math.random() - 0.5) * 16, y: this.y + (Math.random() - 0.5) * 6, vx: (Math.random() - 0.5) * 30, vy: -14 - Math.random() * 10, g: 60, life: 0.5, color: '#d8e8f0' });
    this.ph.onCanoeHit?.(what, k);
  }

  // empurra a canoa para o lugar livre mais próximo (segurança contra ficar preso)
  unstick() {
    if (this.free()) return true;
    for (let r = 2; r <= 40; r += 2) for (let k = 0; k < 16; k++) {
      const an = (k / 16) * Math.PI * 2, x = this.x + Math.cos(an) * r, y = this.y + Math.sin(an) * r;
      for (const da of [0, 0.3, -0.3, 0.6, -0.6]) if (this.free(x, y, this.a + da)) { this.x = x; this.y = y; this.a += da; return true; }
    }
    return false;
  }

  paddlePoint(k = this.stroke % 1) {
    const h = this.dir(), sd = this.side;
    const along = lerp(5, -6, k); // o remo entra na frente e sai atrás
    return { x: this.x + h.x * (along - 1) - h.y * sd * 9, y: this.y + (h.y * (along - 1)) * SQ + h.x * sd * 7 };
  }

  // ---------- desenho ----------
  draw(ctx) {
    const g = this.g;
    const n = 32;
    let a = this.a; while (a < 0) a += Math.PI * 2;
    const idx = Math.round(a / (Math.PI * 2) * n) % n;
    const hull = Sprites.get('canoe:' + idx, () => canoeHull(idx, n));
    const bob = this.state === 'stuck' ? 0 : Math.round(Math.sin(this.bob * 2.2) * 0.6 + this.rock * 2);
    const x = Math.round(this.x), y = Math.round(this.y);
    // sombra/reflexo escuro na água
    ctx.globalAlpha = this.state === 'stuck' ? 0.25 : 0.32; ctx.fillStyle = this.state === 'stuck' ? '#1a1208' : '#0a1418';
    ctx.save(); ctx.translate(x, y + 2); ctx.scale(1, SQ); ctx.rotate(this.a);
    ctx.beginPath(); ctx.ellipse(0, 0, CANOE_HALF + 1, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.globalAlpha = 1;
    // o casco afunda um pouco na água (linha d'água)
    ctx.drawImage(hull, x - 20, y - 20 + bob);
    if (this.state !== 'stuck') {
      ctx.globalAlpha = 0.18 + 0.06 * Math.sin(this.bob * 3); ctx.strokeStyle = '#d8e8ec'; ctx.lineWidth = 1;
      ctx.save(); ctx.translate(x, y + bob + 1); ctx.scale(1, SQ); ctx.rotate(this.a);
      ctx.beginPath(); ctx.ellipse(0, 0, CANOE_HALF + 1.5, 6.4, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      ctx.globalAlpha = 1;
    }
    if (this.state !== 'boarded') return;
    // Caetano sentado atrás do meio, virado para a proa
    const h = this.dir();
    const sx = x - h.x * 5, sy = y - h.y * 5 * SQ + bob;
    const facing = Math.abs(h.x) > Math.abs(h.y) * 1.1 ? (h.x > 0 ? 'right' : 'left') : (h.y > 0 ? 'down' : 'up');
    const sp = Sprites.get('seat:' + facing, () => caetanoSeated(facing));
    const lean = Math.round(this.rock * 3);
    // remo: das mãos até a água, com a pá
    const pp = this.paddlePoint();
    const hx = sx + lean, hy = sy - 6;
    const behind = pp.y < hy;
    const drawPaddle = () => {
      ctx.strokeStyle = '#8a6038'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hx - h.y * this.side * 2, hy); ctx.lineTo(pp.x, pp.y - 1); ctx.stroke();
      ctx.fillStyle = '#b88a58'; ctx.beginPath(); ctx.ellipse(pp.x, pp.y, 2, 1.3, this.a, 0, Math.PI * 2); ctx.fill();
    };
    if (behind) drawPaddle();
    ctx.drawImage(sp, Math.round(sx - 7 + lean), Math.round(sy - 15));
    if (!behind) drawPaddle();
  }
}

// ---------------------------------------------------------------- troncos à deriva
export class DriftLogs {
  constructor(g, ph, poly, s0, s1, n = 5, seed = 7) {
    this.g = g; this.ph = ph; this.P = poly; this.s0 = s0; this.s1 = s1; this.list = [];
    for (let i = 0; i < n; i++) this.list.push(this.spawn(s1 - (i / n) * (s1 - s0), i + seed));
  }
  spawn(s, k) {
    const len = 22 + hash2(k, 1, 3) * 16;
    return { s, off: (hash2(k, 2, 3) - 0.5) * 0.9, len, r: 3.4, spin: (hash2(k, 4, 3) - 0.5) * 0.5, ang: 0, x: 0, y: 0, k, t: hash2(k, 5, 3) * 9 };
  }
  update(dt) {
    for (const L of this.list) {
      const q = this.P.at(L.s);
      L.s -= (q.c + 5) * dt;           // desce com a correnteza
      L.t += dt;
      if (L.s < this.s0) { Object.assign(L, this.spawn(this.s1 + Math.random() * 60, L.k + 17)); L.k += 17; }
      const p = this.P.at(L.s), half = p.w * 0.5 - 7;
      L.off = clamp(L.off, -half / S, half / S);
      L.x = p.x - p.ty * L.off * S; L.y = p.y + p.tx * L.off * S;
      L.ang = Math.atan2(p.ty, p.tx) + L.spin + Math.sin(L.t * 0.6) * 0.15;
      if (Math.random() < dt * 1.2) this.g.particles.add({ type: 'ripple', x: L.x + Math.cos(L.ang) * L.len * 0.5, y: L.y + Math.sin(L.ang) * L.len * 0.5 * SQ, life: 1, r1: 5, color: '#bcd2d6' });
    }
  }
  // distância de um círculo ao tronco (cápsula)
  hit(x, y, r) {
    for (const L of this.list) {
      const ca = Math.cos(L.ang), sa = Math.sin(L.ang) * SQ, h = L.len / 2;
      const vx = x - L.x, vy = y - L.y;
      const t = clamp(vx * ca + vy * sa, -h, h);
      const qx = L.x + ca * t, qy = L.y + sa * t;
      if ((x - qx) ** 2 + (y - qy) ** 2 < (r + L.r) ** 2) return L;
    }
    return null;
  }
  nudge(L, x, y) { const p = this.P.at(L.s); L.off += Math.sign(-(x - L.x) * p.ty + (y - L.y) * p.tx || 1) * -0.25; }
  draw(ctx, V) {
    for (const L of this.list) {
      if (L.x < V.cx - 40 || L.x > V.cx + V.vw + 40 || L.y < V.cy - 40 || L.y > V.cy + V.vh + 40) continue;
      const len = Math.round(L.len);
      const s = Sprites.get('drift:' + len, () => logSprite(5100 + len, len, 3.5, true));
      ctx.save(); ctx.translate(Math.round(L.x), Math.round(L.y)); ctx.scale(1, SQ); ctx.rotate(L.ang);
      ctx.globalAlpha = 0.3; ctx.fillStyle = '#0a1418'; ctx.beginPath(); ctx.ellipse(0, 2, len / 2 + 2, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      ctx.drawImage(s, -Math.round(s.width / 2), -Math.round(s.height / 2) + Math.round(Math.sin(L.t * 1.7) * 0.6));
      ctx.restore();
    }
  }
}

export { dist, SQ };
