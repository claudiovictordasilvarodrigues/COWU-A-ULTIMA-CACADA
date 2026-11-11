// Animais com IA baseada em estados: percepção por audição, visão e faro (vento)
import { dist, clamp } from '../core/util.js';
import { Sprites } from '../gfx/sprites.js';
import { flipCanvas } from '../gfx/pixel.js';
import { pacaSprite, cotiaSprite, capivaraSprite, jacuSprite, birdFlySprite, galinhaSprite, macacoSprite, araraSprite, butterflySprite } from '../gfx/art-animals.js';

const KIND = {
  paca: { gen: pacaSprite, w: 22, ax: 11, ay: 12, speed: 15, flee: 72, hearing: 0.85, sight: 46, smell: 80, wander: 34, rate: 6, name: 'paca' },
  cotia: { gen: cotiaSprite, w: 20, ax: 10, ay: 12, speed: 24, flee: 118, hearing: 1.0, sight: 72, smell: 90, wander: 70, rate: 9, name: 'cotia' },
  capivara: { gen: capivaraSprite, w: 28, ax: 14, ay: 15, speed: 11, flee: 56, hearing: 0.55, sight: 84, smell: 70, wander: 40, rate: 4, name: 'capivara' },
  jacu: { gen: jacuSprite, w: 19, ax: 10, ay: 13, speed: 8, flee: 0, hearing: 0.75, sight: 66, smell: 0, wander: 30, rate: 3, name: 'jacu', flies: true },
  galinha: { gen: galinhaSprite, w: 12, ax: 6, ay: 11, speed: 12, flee: 48, hearing: 0.35, sight: 30, smell: 0, wander: 46, rate: 6, name: 'galinha', tame: true },
};

function spr(kind, frame, flip, variant = '') {
  const K = KIND[kind];
  return Sprites.get(`a:${kind}:${frame}:${flip ? 1 : 0}:${variant}`, () => {
    const c = variant === 'swim' ? capivaraSprite(frame, true) : K.gen(frame);
    return flip ? flipCanvas(c) : c;
  });
}

export class Animal {
  constructor(g, kind, x, y, o = {}) {
    this.g = g; this.kind = kind; this.K = KIND[kind];
    this.x = x; this.y = y; this.home = { x, y }; this.r = 3;
    this.state = 'idle'; this.timer = Math.random() * 3; this.aware = 0;
    this.face = Math.random() < 0.5 ? 1 : -1; this.frame = 0; this.anim = 0; this.z = 0;
    this.target = null; this.burrow = o.burrow || null; this.water = o.water || null;
    this.visible = true; this.observed = false; this.id = o.id || kind;
    this.fleeT = 0; this.vx = 0; this.vy = 0;
  }

  perceive(dt) {
    const p = this.g.player, K = this.K;
    if (['hide', 'away', 'fly', 'land'].includes(this.state)) return 0;
    const d = dist(this.x, this.y, p.x, p.y);
    if (d > 260) return 0;
    let s = 0;
    const nr = p.noiseRadius() * K.hearing;
    if (nr > 0 && d < nr) s += 2.2 * (1 - d / nr) + 0.35;
    const sr = K.sight * p.vis;
    if (d < sr) s += 1.6 * (1 - d / sr) + 0.2;
    if (K.smell && d < K.smell && this.g.isDownwind(p, this)) s += 1.1;
    if (K.tame) s *= p.running ? 1 : 0.15;
    return s;
  }

  update(dt) {
    const g = this.g, p = g.player, K = this.K;
    const s = this.perceive(dt);
    if (s > 0) this.aware = Math.min(1.4, this.aware + s * dt * 1.15);
    else this.aware = Math.max(0, this.aware - dt * 0.3);
    this.timer -= dt;
    let mvx = 0, mvy = 0, spd = 0;

    if ((this.state === 'idle' || this.state === 'wander' || this.state === 'graze') && this.aware > 0.45) {
      this.state = 'alert'; this.timer = 1.2;
      this.face = p.x > this.x ? 1 : -1;
    }

    switch (this.state) {
      case 'idle':
      case 'graze':
        if (this.timer <= 0) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * K.wander;
          this.target = { x: this.home.x + Math.cos(a) * r, y: this.home.y + Math.sin(a) * r };
          this.state = 'wander'; this.timer = 6;
        }
        break;
      case 'wander': {
        const dx = this.target.x - this.x, dy = this.target.y - this.y, d = Math.hypot(dx, dy);
        if (d < 3 || this.timer <= 0) { this.state = Math.random() < 0.5 ? 'graze' : 'idle'; this.timer = 1.5 + Math.random() * 4; }
        else { mvx = dx / d; mvy = dy / d; spd = K.speed; }
        break;
      }
      case 'alert':
        this.face = p.x > this.x ? 1 : -1;
        if (this.aware >= 1) this.react();
        else if (this.aware < 0.2 && this.timer <= 0) { this.state = 'idle'; this.timer = 1 + Math.random() * 2; }
        break;
      case 'flee': {
        this.fleeT -= dt;
        let dx, dy;
        if (this.target) { dx = this.target.x - this.x; dy = this.target.y - this.y; }
        else { dx = this.x - p.x; dy = this.y - p.y; }
        const d = Math.hypot(dx, dy) || 1;
        mvx = dx / d; mvy = dy / d; spd = K.flee;
        if (this.target && (d < 5 || this.fleeT < -3)) this.arrive();
        else if (!this.target && this.fleeT <= 0) { this.state = 'return'; this.timer = 10; }
        break;
      }
      case 'return': {
        const dx = this.home.x - this.x, dy = this.home.y - this.y, d = Math.hypot(dx, dy);
        if (d < 6 || this.timer <= 0) { this.state = 'idle'; this.timer = 2; this.aware = Math.min(this.aware, 0.3); }
        else { mvx = dx / d; mvy = dy / d; spd = K.speed * 1.4; }
        break;
      }
      case 'hide':
        if (this.timer <= 0) {
          const d = dist(this.x, this.y, p.x, p.y);
          if (d > 70 || p.noise < 0.2) { this.state = 'idle'; this.visible = true; this.aware = 0.35; this.timer = 2; g.onAnimalEvent?.(this, 'peek'); }
          else this.timer = 3;
        }
        break;
      case 'swim': {
        this.z = 0;
        if (this.timer <= 0) { this.state = 'return'; this.timer = 12; }
        break;
      }
      case 'fly': {
        this.z = Math.min(30, this.z + dt * 40);
        const dx = this.x - p.x, dy = this.y - p.y, d = Math.hypot(dx, dy) || 1;
        this.x += (dx / d) * 75 * dt + this.vx * dt; this.y += (dy / d) * 50 * dt - 12 * dt;
        this.anim += dt * 14; this.frame = Math.floor(this.anim) % 2;
        if (this.timer <= 0) { this.state = 'away'; this.visible = false; this.timer = 16 + Math.random() * 10; }
        return;
      }
      case 'away':
        if (this.timer <= 0 && dist(this.home.x, this.home.y, p.x, p.y) > 110) {
          this.x = this.home.x + (Math.random() - 0.5) * 30; this.y = this.home.y; this.z = 30;
          this.state = 'land'; this.visible = true;
        } else if (this.timer <= 0) this.timer = 4;
        return;
      case 'land':
        this.z = Math.max(0, this.z - dt * 25);
        this.anim += dt * 14; this.frame = Math.floor(this.anim) % 2;
        if (this.z <= 0) { this.state = 'idle'; this.timer = 2; this.aware = 0; }
        return;
    }

    if (spd > 0) {
      const canWater = this.kind === 'capivara';
      const ox = this.x, oy = this.y;
      const r = g.world.moveCircle(this, mvx * spd * dt, mvy * spd * dt, this.r, canWater);
      if ((r.bx && r.by) || (Math.hypot(this.x - ox, this.y - oy) < spd * dt * 0.2)) {
        // desvio simples quando bloqueado
        const a = Math.atan2(mvy, mvx) + (Math.random() < 0.5 ? 1.2 : -1.2);
        g.world.moveCircle(this, Math.cos(a) * spd * dt, Math.sin(a) * spd * dt, this.r, canWater);
        if (this.state === 'wander') this.timer -= 0.3;
      }
      if (Math.abs(mvx) > 0.1) this.face = mvx > 0 ? 1 : -1;
      this.anim += dt * K.rate * (spd / K.speed > 2 ? 2 : 1);
      this.frame = Math.floor(this.anim) % 2;
      if (this.kind === 'capivara' && this.state === 'flee' && g.world.isWater(this.x, this.y)) this.arrive();
    } else {
      this.frame = (this.state === 'graze' && Math.sin(g.time * 3 + this.home.x) > 0.3) ? 1 : 0;
      if (this.kind === 'paca' || this.kind === 'cotia') this.frame = 0;
    }
  }

  react() {
    const g = this.g, p = g.player;
    this.aware = 1;
    const pan = g.panOf(this.x);
    switch (this.kind) {
      case 'paca':
        this.state = 'flee'; this.target = this.burrow ? { ...this.burrow } : null; this.fleeT = 3;
        g.audio.play('rustle', { pan }); g.onAnimalEvent?.(this, 'flee');
        break;
      case 'capivara':
        this.state = 'flee'; this.target = this.water ? { x: this.water.x + (Math.random() - 0.5) * 30, y: this.water.y } : null; this.fleeT = 3;
        g.audio.play('capivara', { pan }); g.onAnimalEvent?.(this, 'flee');
        break;
      case 'jacu':
        this.state = 'fly'; this.timer = 2.6; this.vx = (Math.random() - 0.5) * 30;
        g.audio.play('flap', { pan, vol: 0.9 });
        g.onAnimalEvent?.(this, 'fly');
        break;
      case 'galinha':
        this.state = 'flee'; this.target = null; this.fleeT = 1.2; g.audio.play('chicken', { pan });
        break;
      default:
        this.state = 'flee'; this.target = null; this.fleeT = 2.5;
        g.audio.play('rustle', { pan, vol: 0.7 }); g.onAnimalEvent?.(this, 'flee');
    }
  }

  arrive() {
    if (this.kind === 'paca') { this.state = 'hide'; this.visible = false; this.timer = 20 + Math.random() * 8; this.g.onAnimalEvent?.(this, 'hide'); }
    else if (this.kind === 'capivara') {
      this.state = 'swim'; this.timer = 14 + Math.random() * 6;
      this.g.audio.play('splash', { pan: this.g.panOf(this.x), vol: 0.8 });
      for (let i = 0; i < 2; i++) this.g.particles.add({ type: 'ripple', x: this.x, y: this.y, life: 1, r1: 12 });
    } else { this.state = 'idle'; this.timer = 2; }
  }

  scare() { if (!['hide', 'away', 'fly', 'flee', 'swim'].includes(this.state)) this.react(); }

  draw(ctx) {
    if (!this.visible) return;
    const K = this.K, flip = this.face < 0;
    const swim = this.kind === 'capivara' && this.g.world.isWater(this.x, this.y);
    if (this.state === 'fly' || this.state === 'land' || (this.z > 0)) return; // desenhado na camada aérea
    const s = spr(this.kind, this.frame, flip, swim ? 'swim' : '');
    if (!swim) {
      ctx.globalAlpha = 0.25; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(this.x, this.y + 1, K.w * 0.33, 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
    const bobY = swim ? Math.sin(this.g.time * 2 + this.home.x) * 0.6 + 4 : 0;
    ctx.drawImage(s, Math.round(this.x - K.ax), Math.round(this.y - K.ay + bobY));
    if (swim && Math.random() < 0.02) this.g.particles.add({ type: 'ripple', x: this.x, y: this.y + 2, life: 1.2, r1: 10 });
    this.drawAware(ctx, this.y - K.ay - 4);
  }

  drawAir(ctx) {
    if (!this.visible || !(this.state === 'fly' || this.state === 'land' || this.z > 0)) return;
    const s = Sprites.get(`a:jacufly:${this.frame}`, () => birdFlySprite(this.frame));
    ctx.globalAlpha = 0.2; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(this.x, this.y, 5, 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.drawImage(s, Math.round(this.x - 11), Math.round(this.y - 7 - this.z));
  }

  drawAware(ctx, y) {
    if (this.aware < 0.25 || this.state === 'flee' || this.K.tame) return;
    const x = Math.round(this.x);
    y = Math.round(y);
    const alert = this.aware >= 0.75;
    ctx.fillStyle = alert ? '#ff5a3a' : '#f4f0e0';
    if (alert) { ctx.fillRect(x, y - 6, 1, 4); ctx.fillRect(x, y - 1, 1, 1); }
    else { ctx.fillRect(x - 1, y - 6, 3, 1); ctx.fillRect(x + 1, y - 5, 1, 1); ctx.fillRect(x, y - 4, 1, 1); ctx.fillRect(x, y - 1, 1, 1); }
  }
}

// ---------- macacos-prego na copa ----------
export class MonkeyTroop {
  constructor(g, nodes, n = 4) {
    this.g = g; this.nodes = nodes; this.cool = 0;
    this.monkeys = [];
    for (let i = 0; i < n; i++) {
      const nd = nodes[i % nodes.length];
      this.monkeys.push({ node: nd, x: nd.x + (Math.random() - 0.5) * 10, y: nd.y, hop: null, t: Math.random() * 5, frame: 0, face: 1 });
    }
  }
  update(dt) {
    const g = this.g, p = g.player;
    this.cool -= dt;
    let near = false;
    for (const m of this.monkeys) if (dist(m.x, m.y + 30, p.x, p.y) < 95) near = true;
    if (near && this.cool <= 0) {
      this.cool = 7;
      const cx = this.monkeys[0].x;
      g.audio.play('monkey', { pan: g.panOf(cx) });
      g.caption('Macacos-prego agitados na copa', g.panOf(cx));
      for (const m of this.monkeys) {
        const far = this.nodes.filter((n) => dist(n.x, n.y, m.x, m.y) < 90).sort((a, b) => dist(b.x, b.y + 30, p.x, p.y) - dist(a.x, a.y + 30, p.x, p.y))[0];
        if (far && far !== m.node) this.startHop(m, far);
      }
    }
    for (const m of this.monkeys) {
      if (m.hop) {
        m.hop.t += dt / m.hop.dur;
        const k = Math.min(1, m.hop.t);
        m.x = m.hop.fx + (m.hop.tx - m.hop.fx) * k;
        m.y = m.hop.fy + (m.hop.ty - m.hop.fy) * k - Math.sin(k * Math.PI) * 14;
        m.frame = 2;
        if (k >= 1) { m.hop = null; m.frame = 0; }
      } else {
        m.t -= dt;
        m.frame = Math.sin(g.time * 2 + m.x) > 0.6 ? 1 : 0;
        if (m.t <= 0) {
          m.t = 4 + Math.random() * 8;
          const opts = this.nodes.filter((n) => n !== m.node && dist(n.x, n.y, m.x, m.y) < 80);
          if (opts.length && Math.random() < 0.6) this.startHop(m, opts[(Math.random() * opts.length) | 0]);
        }
      }
    }
  }
  startHop(m, n) {
    const tx = n.x + (Math.random() - 0.5) * 12, ty = n.y + (Math.random() - 0.5) * 6;
    m.hop = { fx: m.x, fy: m.y, tx, ty, t: 0, dur: 0.5 + dist(m.x, m.y, tx, ty) / 140 };
    m.face = tx > m.x ? 1 : -1; m.node = n;
    if (Math.random() < 0.5) for (let i = 0; i < 3; i++) this.g.particles.add({ type: 'leaf', x: m.x, y: m.y + 20, z: 22, vx: (Math.random() - 0.5) * 16, vy: 2, life: 3, seed: Math.random() * 9, color: '#4f7a32' });
  }
  draw(ctx) {
    for (const m of this.monkeys) {
      const s = Sprites.get(`a:macaco:${m.frame}:${m.face < 0 ? 1 : 0}`, () => { const c = macacoSprite(m.frame); return m.face < 0 ? flipCanvas(c) : c; });
      ctx.drawImage(s, Math.round(m.x - 8), Math.round(m.y - 14));
    }
  }
}

// ---------- revoadas de araras e periquitos sobre a mata (decorativo) ----------
export class Flyovers {
  constructor(g) { this.g = g; this.list = []; this.t = 20 + Math.random() * 20; }
  update(dt) {
    const g = this.g, cam = g.camera;
    this.t -= dt;
    if (this.t <= 0) {
      this.t = 45 + Math.random() * 60;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const n = 2 + ((Math.random() * 3) | 0);
      const y = cam.y - cam.viewH * 0.3 + Math.random() * cam.viewH * 0.4;
      for (let i = 0; i < n; i++) this.list.push({ x: cam.x - dir * (cam.viewW / 2 + 40 + i * 18), y: y + (i % 2) * 10, vx: dir * 70, t: 0, life: 12 });
      g.audio.play('arara', { pan: -dir * 0.7, vol: 0.8 });
      g.caption('Araras passam gritando sobre a mata', -dir * 0.7);
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i]; b.t += dt; b.x += b.vx * dt; b.y += Math.sin(b.t * 2 + i) * 4 * dt;
      if (b.t > b.life) this.list.splice(i, 1);
    }
  }
  draw(ctx) {
    for (const b of this.list) {
      const f = Math.floor(b.t * 6) % 2;
      const s = Sprites.get(`a:arara:${f}:${b.vx < 0 ? 1 : 0}`, () => { const c = araraSprite(f); return c; });
      ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y)); ctx.rotate(b.vx > 0 ? Math.PI / 2 : -Math.PI / 2);
      ctx.drawImage(s, -14, -10); ctx.restore();
    }
  }
}

// ---------- borboletas morfo ----------
export class Butterfly {
  constructor(g, x, y) { this.g = g; this.x = x; this.y = y; this.hx = x; this.hy = y; this.t = Math.random() * 10; this.z = 8; }
  update(dt) {
    this.t += dt;
    this.x = this.hx + Math.sin(this.t * 0.7) * 26 + Math.sin(this.t * 2.3) * 6;
    this.y = this.hy + Math.cos(this.t * 0.5) * 16;
    this.z = 8 + Math.sin(this.t * 3) * 3;
  }
  draw(ctx) {
    const f = Math.floor(this.t * 10) % 2;
    const s = Sprites.get(`a:bf:${f}`, () => butterflySprite(f));
    ctx.drawImage(s, Math.round(this.x - 3), Math.round(this.y - this.z));
  }
}

export { clamp };
