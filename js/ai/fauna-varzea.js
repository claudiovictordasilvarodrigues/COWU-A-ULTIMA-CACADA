// Fase 3 — fauna da várzea com comportamentos próprios.
// Componentes comuns (percepção por som, visão com linha de visada e faro pelo vento; movimento
// com colisão; ícones de desconfiança), mas cada espécie tem a sua máquina de estados:
//   Anta     — CAMINHAR, ALIMENTAR, FAREJAR, ALERTA, FUGIR, RETORNAR (+ SUMIDA depois de fugir)
//   Capivara — DESCANSAR, CAMINHAR, ALIMENTAR, ENTRAR NA ÁGUA, NADAR, SAIR DA ÁGUA, ALERTA, FUGIR
//   Paca     — ESCONDIDA, SAINDO, FORRAGEAR, CAMINHAR, ALERTA (congela), FUGIR, ESCONDER/MERGULHAR
//   Garça    — POUSADA, VOANDO
import { clamp, dist, lerp } from '../core/util.js';
import { Sprites } from '../gfx/sprites.js';
import { flipCanvas } from '../gfx/pixel.js';
import { tapirSprite } from '../gfx/art-peccary.js';
import { pacaSprite } from '../gfx/art-animals.js';
import { capySprite, tapirSniff, heronPerched, heronFlying } from '../gfx/art-varzea.js';

// ---------------------------------------------------------------- percepção comum
// K: { hearing (multiplica o raio de ruído), sight (px, escala com a visibilidade), smell (px, só a favor do vento) }
export function sense(g, a, K, los) {
  const p = g.player, out = { s: 0, heard: false, seen: false, smelled: false, d: 1e9 };
  if (!p || p.hidden) return out;
  const d = dist(a.x, a.y, p.x, p.y); out.d = d;
  if (d > 320) return out;
  const nr = p.noiseRadius() * K.hearing;
  if (nr > 0 && d < nr) { out.s += 2 * (1 - d / nr) + 0.3; out.heard = true; }
  const sr = K.sight * (p.vis ?? 1);
  if (d < sr && (!los || los(a.x, a.y - 4, p.x, p.y - 8))) { out.s += 1.5 * (1 - d / sr) + 0.2; out.seen = true; }
  if (K.smell && d < K.smell && g.isDownwind(p, a)) { out.s += K.smellW ?? 1; out.smelled = true; }
  return out;
}
export function moveBody(g, e, mx, my, sp, dt, r = 4, canWater = false) {
  const c = e.col; if (c) c.off = true;
  const ox = e.x, oy = e.y;
  g.world.moveCircle(e, mx * sp * dt, my * sp * dt, r, canWater);
  if (c) c.off = !!e.colOff;
  return Math.hypot(e.x - ox, e.y - oy);
}
// "?" (desconfiado) ou "!" (alarmado) sobre o bicho
export function drawAwareIcon(ctx, x, y, kind) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = 'rgba(20,14,6,0.75)'; ctx.fillRect(x - 2, y - 8, 5, 9);
  ctx.fillStyle = kind === '!' ? '#ff7a4a' : '#ffe08a';
  if (kind === '!') { ctx.fillRect(x, y - 7, 1, 4); ctx.fillRect(x, y - 1, 1, 1); }
  else { ctx.fillRect(x - 1, y - 7, 3, 1); ctx.fillRect(x + 1, y - 6, 1, 1); ctx.fillRect(x, y - 5, 1, 1); ctx.fillRect(x, y - 3, 1, 1); ctx.fillRect(x, y - 1, 1, 1); }
}
const shadow = (ctx, x, y, rx, ry, a = 0.28) => { ctx.globalAlpha = a; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; };

// ================================================================ ANTA
export const TS = { WALK: 'CAMINHAR', FEED: 'ALIMENTAR', SNIFF: 'FAREJAR', ALERT: 'ALERTA', FLEE: 'FUGIR', RETURN: 'RETORNAR', GONE: 'SUMIDA' };
const TAPIR_K = { hearing: 0.75, sight: 54, smell: 88, smellW: 0.7 };

export class TapirV {
  // route: [{ x, y, feed: [min, max] | null, hold?: true }] ao longo da trilha da anta
  constructor(g, ph, route, startIdx = 0, o = {}) {
    this.g = g; this.ph = ph; this.route = route; this.i = startIdx; this.dirn = 1;
    const n = route[startIdx]; this.x = n.x; this.y = n.y;
    this.state = TS.FEED; this.timer = n.feed ? lerp(n.feed[0], n.feed[1], Math.random()) : 3;
    this.aware = 0; this.face = 1; this.anim = 0; this.frame = 0; this.visible = true; this.head = 'down';
    this.prev = null; this.trampled = false; this.fleeTo = null; this.goneT = 0; this.sniffT = 0; this.r = 5;
    this.rng = o.rng || Math.random;
    this.col = g.world.addCollider({ x: this.x, y: this.y - 2, r: 7, dyn: true, kind: 'tapir', noBoat: true });
    this.events = [];
  }
  calm() { return [TS.WALK, TS.FEED, TS.SNIFF, TS.RETURN].includes(this.state); }
  enter(s, t = 0) { this.prev = this.state; this.state = s; this.timer = t; this.g.onAnimalEvent?.(this, 'tapir:' + s); }
  node() { return this.route[this.i]; }
  update(dt) {
    const g = this.g, p = g.player;
    if (!p) return;
    this.timer -= dt;
    if (this.state === TS.GONE) {
      this.colOff = true; this.col.off = true;
      if (this.timer <= 0 && dist(this.x, this.y, p.x, p.y) > 150) {
        // volta para a rotina pela ponta da trilha onde sumiu
        this.visible = true; this.aware = 0; this.colOff = false; this.col.off = false;
        this.enter(TS.RETURN); this.ph.onTapirEvent?.('volta');
      }
      return;
    }
    // ---------- percepção ----------
    const sn = this.state === TS.FLEE ? { s: 0, d: dist(this.x, this.y, p.x, p.y) } : sense(g, this, TAPIR_K, this.ph.los ? (a, b, c, d) => this.ph.los(a, b, c, d) : null);
    this.lastSense = sn;
    const sens = this.state === TS.FEED ? 0.75 : 1; // comendo, de cabeça baixa, demora mais a perceber
    if (sn.s > 0) this.aware = Math.min(1.3, this.aware + sn.s * dt * sens);
    else this.aware = Math.max(0, this.aware - dt * 0.22);
    if (this.calm()) {
      if (this.aware >= 1) return this.startFlee();
      if (this.aware >= 0.62) { this.enter(TS.ALERT, 2.6); this.face = p.x > this.x ? 1 : -1; }
      else if (this.aware >= 0.3 && this.state !== TS.SNIFF && this.sniffT <= 0) { this.resumeTo = this.state; this.enter(TS.SNIFF, 1.8 + this.rng() * 1.4); this.sniffT = 6; }
    }
    this.sniffT -= dt;
    let mx = 0, my = 0, sp = 0;
    switch (this.state) {
      case TS.FEED: {
        this.head = Math.sin(g.time * 0.9 + this.x) > -0.4 ? 'down' : 'mid';
        const n = this.node();
        const hold = n.hold && this.ph.holdTapir?.(this);
        // variação natural: pequenos passos enquanto pasta, e às vezes ergue a tromba para farejar
        if (this.rng() < dt * 0.12) { const rem = this.timer; this.resumeTo = TS.FEED; this.enter(TS.SNIFF, 1.5 + this.rng()); this.timer2 = rem; break; }
        if (!hold && this.timer <= 0) this.nextNode();
        break;
      }
      case TS.SNIFF:
        this.head = 'up';
        if (this.lastSense && this.lastSense.d < 200 && this.aware > 0.2) this.face = p.x > this.x ? 1 : -1;
        if (this.timer <= 0) { const r = this.resumeTo || TS.WALK; this.state = r; this.timer = r === TS.FEED ? Math.max(this.timer2 ?? 4, 4) : 0; this.timer2 = null; }
        break;
      case TS.ALERT:
        this.head = 'mid';
        this.face = p.x > this.x ? 1 : -1;
        if (this.aware >= 1) return this.startFlee();
        if (this.timer <= 0 && this.aware < 0.5) {
          // muda de trajetória: segue pelo lado oposto ao de onde veio o incômodo
          const a = this.route[Math.min(this.route.length - 1, this.i + 1)], b = this.route[Math.max(0, this.i - 1)];
          this.dirn = dist(a.x, a.y, p.x, p.y) > dist(b.x, b.y, p.x, p.y) ? 1 : -1;
          this.i = clamp(this.i + this.dirn, 0, this.route.length - 1);
          this.enter(TS.WALK); this.changed = true;
          this.ph.onTapirEvent?.('desvia');
        }
        break;
      case TS.WALK:
      case TS.RETURN: {
        const n = this.node();
        const dx = n.x - this.x, dy = n.y - this.y, d = Math.hypot(dx, dy);
        if (d < 3) {
          if (this.state === TS.RETURN) this.state = TS.WALK;
          if (n.feed) { this.state = TS.FEED; this.timer = lerp(n.feed[0], n.feed[1], this.rng()) * (n.hold && !this.changed ? 1 : 0.8); this.changed = false; }
          else this.nextNode(true);
          break;
        }
        mx = dx / d; my = dy / d; sp = this.state === TS.RETURN ? 9 : 11;
        this.head = 'mid';
        if (this.rng() < dt * 0.05) { this.resumeTo = this.state; this.enter(TS.SNIFF, 1.2 + this.rng()); }
        break;
      }
      case TS.FLEE: {
        const t = this.fleeTo;
        const n = this.route[t.i];
        const dx = n.x - this.x, dy = n.y - this.y, d = Math.hypot(dx, dy);
        if (d < 4) {
          if (t.i === t.end) { this.visible = false; this.enter(TS.GONE, 28 + this.rng() * 12); this.i = t.end; this.dirn = t.end === 0 ? 1 : -1; this.ph.onTapirEvent?.('sumiu'); break; }
          t.i += t.step;
          break;
        }
        mx = dx / d; my = dy / d; sp = 64;
        // passa por cima de quem estiver no caminho
        if (!this.trampled && dist(this.x, this.y, p.x, p.y) < 12) { this.trampled = true; p.hurt?.(9, 'A anta passou por cima de Caetano na disparada!'); const k = Math.hypot(p.x - this.x, p.y - this.y) || 1; g.world.moveCircle(p, (p.x - this.x) / k * 8 + my * 6, (p.y - this.y) / k * 8 - mx * 6, p.r); }
        break;
      }
    }
    if (sp) {
      this.colOff = this.state === TS.FLEE;
      const moved = moveBody(g, this, mx, my, sp, dt, 5, false);
      if (Math.abs(mx) > 0.1) this.face = mx > 0 ? 1 : -1;
      this.anim += dt * (sp > 30 ? 11 : 3.4); this.frame = Math.floor(this.anim) % 4;
      this.stuckT = moved < sp * dt * 0.2 ? (this.stuckT || 0) + dt : 0;
      if (this.stuckT > 1.5) { this.x = lerp(this.x, this.node().x, 0.5); this.y = lerp(this.y, this.node().y, 0.5); this.stuckT = 0; }
    } else this.frame = 0;
    // o corpo da anta é um obstáculo (bloqueia a garganta estreita)
    this.col.x = this.x; this.col.y = this.y - 2; this.col.off = !!this.colOff || !this.visible;
    this.ph.reindex?.(this.col);
  }
  nextNode(passing = false) {
    let ni = this.i + this.dirn;
    if (ni < 0 || ni >= this.route.length) { this.dirn *= -1; ni = this.i + this.dirn; }
    this.i = ni;
    this.state = TS.WALK; this.timer = 0;
    void passing;
  }
  startFlee() {
    const g = this.g, p = g.player;
    const a = this.route[0], b = this.route[this.route.length - 1];
    const end = dist(a.x, a.y, p.x, p.y) > dist(b.x, b.y, p.x, p.y) ? 0 : this.route.length - 1;
    const step = end > this.i ? 1 : -1;
    this.fleeTo = { end, step, i: end === this.i ? end : this.i + step };
    this.trampled = false;
    this.enter(TS.FLEE);
    g.audio.play('tapir', { pan: g.panOf(this.x), vol: 1 }); g.audio.play('rustle', { pan: g.panOf(this.x), vol: 1 });
    g.caption('A anta dispara pela trilha, quebrando galhos', g.panOf(this.x));
    this.ph.onTapirEvent?.('fuga');
  }
  // bloqueando a garganta?
  blocks(x0, y0, r) { return this.visible && this.state !== TS.FLEE && dist(this.x, this.y, x0, y0) < r; }
  draw(ctx) {
    if (!this.visible) return;
    const st = this.state;
    let k, gen;
    if (st === TS.SNIFF) { const f = Math.floor(this.g.time * 3) % 2; k = `tapS:${f}:${this.face < 0 ? 1 : 0}`; gen = () => { const c = tapirSniff(f); return this.face < 0 ? flipCanvas(c) : c; }; }
    else { const head = st === TS.FEED ? this.head : 'mid'; k = `tapir:${this.frame}:${head}:${this.face < 0 ? 1 : 0}`; gen = () => { const c = tapirSprite(this.frame, head); return this.face < 0 ? flipCanvas(c) : c; }; }
    const s = Sprites.get(k, gen);
    shadow(ctx, this.x, this.y + 1, 13, 3);
    ctx.drawImage(s, Math.round(this.x - 17), Math.round(this.y - 18));
    if (st === TS.ALERT) drawAwareIcon(ctx, this.x, this.y - 22, '!');
    else if (this.aware > 0.3 && st !== TS.FLEE) drawAwareIcon(ctx, this.x, this.y - 22, '?');
  }
}

// ================================================================ CAPIVARAS
export const CS = { REST: 'DESCANSAR', WALK: 'CAMINHAR', GRAZE: 'ALIMENTAR', ENTER: 'ENTRAR_AGUA', SWIM: 'NADAR', EXIT: 'SAIR_AGUA', ALERT: 'ALERTA', FLEE: 'FUGIR' };
const CAPY_K = { hearing: 0.6, sight: 92, smell: 70, smellW: 0.8 };

export class CapyGroup {
  // home: { x, y, rx, ry } (prainha onde o grupo vive); safe: ponto no meio do lago
  constructor(g, ph, home, safe) {
    this.g = g; this.ph = ph; this.home = home; this.safe = safe; this.members = [];
    this.mode = 'calm'; this.calmT = 0; this.alarmedAt = -99;
  }
  add(x, y, o = {}) { const c = new Capy(this.g, this, x, y, o); this.members.push(c); return c; }
  // um indivíduo avisa: os outros reagem com atraso (latido passado de um para o outro)
  alarm(src) {
    const g = this.g;
    if (this.mode !== 'flee') { this.mode = 'flee'; this.alarmedAt = g.time; this.ph.onCapyAlarm?.(src); }
    this.calmT = 0;
    for (const m of this.members) {
      if (m === src || m.state === CS.FLEE || m.alarmAt) continue;
      const d = dist(m.x, m.y, src.x, src.y);
      m.alarmAt = g.time + 0.25 + d / 130 + Math.random() * 0.3;
    }
  }
  update(dt) {
    for (const m of this.members) m.update(dt);
    if (this.mode === 'flee') {
      const quiet = this.members.every((m) => m.aware < 0.25);
      const inWater = this.members.every((m) => (m.state === CS.FLEE ? m.sub > 0.6 : true));
      if (quiet && inWater) this.calmT += dt; else this.calmT = 0;
      if (this.calmT > 16) {
        this.mode = 'calm';
        for (const m of this.members) if (m.state === CS.SWIM || m.state === CS.FLEE) { m.state = CS.EXIT; m.target = m.homeSpot(); }
        this.ph.onCapyCalm?.();
      }
    }
  }
  calmNow() { return this.mode === 'calm' && this.members.every((m) => m.state !== CS.FLEE && m.state !== CS.ALERT && m.aware < 0.45); }
}

export class Capy {
  constructor(g, group, x, y, o = {}) {
    this.g = g; this.group = group; this.x = x; this.y = y; this.r = 3.5;
    this.juv = !!o.juv; this.state = o.state || CS.REST; this.timer = 3 + Math.random() * 10;
    this.face = Math.random() < 0.5 ? 1 : -1; this.frame = 0; this.anim = 0; this.aware = 0;
    this.sub = g.world.isWater(x, y) ? 1 : 0; this.target = null; this.alarmAt = 0; this.wakeT = 0;
    if (this.state === CS.SWIM) this.target = this.waterSpot(40);
  }
  water() { return this.g.world.isWater(this.x, this.y); }
  homeSpot() {
    const h = this.group.home, w = this.g.world;
    for (let k = 0; k < 20; k++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
      const x = h.x + Math.cos(a) * h.rx * r, y = h.y + Math.sin(a) * h.ry * r;
      if (!w.isWater(x, y) && !w.hit(x, y, 4, true)) return { x, y };
    }
    return { x: h.x, y: h.y };
  }
  waterSpot(r = 50, from = this) {
    const w = this.g.world, s = this.group.safe;
    for (let k = 0; k < 30; k++) {
      const a = Math.random() * Math.PI * 2, d = 10 + Math.random() * r;
      const x = (from === 'safe' ? s.x : this.x) + Math.cos(a) * d, y = (from === 'safe' ? s.y : this.y) + Math.sin(a) * d * 0.7;
      if (w.isWater(x, y) && w.isWater(x + 8, y) && w.isWater(x - 8, y)) return { x, y };
    }
    return { x: s.x, y: s.y };
  }
  update(dt) {
    const g = this.g, p = g.player, G = this.group;
    if (!p) return;
    this.timer -= dt;
    // ---------- percepção (na água, longe da margem, elas se sentem seguras) ----------
    const sn = sense(g, this, CAPY_K, null);
    const inW = this.sub > 0.6;
    const k = inW ? 0.45 : this.state === CS.REST ? 0.7 : 1;
    if (sn.s > 0 && this.state !== CS.FLEE) this.aware = Math.min(1.3, this.aware + sn.s * dt * k);
    else this.aware = Math.max(0, this.aware - dt * 0.3);
    if (this.alarmAt && g.time >= this.alarmAt) { this.alarmAt = 0; this.flee(); }
    if (this.state !== CS.FLEE && this.state !== CS.ALERT && !inW) {
      if (this.aware >= 1) { this.flee(); G.alarm(this); }
      else if (this.aware >= 0.45) { this.prevState = this.state; this.state = CS.ALERT; this.timer = 2.2; this.face = p.x > this.x ? 1 : -1; }
    } else if (inW && this.aware >= 1 && this.state !== CS.FLEE) { this.state = CS.SWIM; this.target = this.waterSpot(40, 'safe'); this.aware = 0.6; }
    let mx = 0, my = 0, sp = 0;
    const go = (t, speed) => { const dx = t.x - this.x, dy = t.y - this.y, d = Math.hypot(dx, dy); if (d < 3) return true; mx = dx / d; my = dy / d; sp = speed; return false; };
    switch (this.state) {
      case CS.REST:
        if (this.timer <= 0) { this.state = CS.GRAZE; this.timer = 6 + Math.random() * 8; }
        break;
      case CS.GRAZE:
        if (Math.random() < dt * 0.4) { this.target = { x: this.x + (Math.random() - 0.5) * 14, y: this.y + (Math.random() - 0.5) * 6 }; }
        if (this.target && go(this.target, 5)) this.target = null;
        if (this.timer <= 0) {
          const r = Math.random();
          if (r < 0.22) { this.state = CS.ENTER; this.target = this.waterSpot(30); }
          else if (r < 0.6) { this.state = CS.WALK; this.target = this.homeSpot(); this.timer = 10; }
          else { this.state = CS.REST; this.timer = 8 + Math.random() * 12; }
        }
        break;
      case CS.WALK:
        if (go(this.target, 11) || this.timer <= 0) { this.state = Math.random() < 0.5 ? CS.GRAZE : CS.REST; this.timer = 5 + Math.random() * 8; }
        break;
      case CS.ENTER:
        if (go(this.target, 9)) { this.state = CS.SWIM; this.timer = 10 + Math.random() * 12; this.target = this.waterSpot(40); }
        break;
      case CS.SWIM:
        if (go(this.target, 8)) this.target = this.waterSpot(36);
        if (this.timer <= 0 && G.mode === 'calm') { this.state = CS.EXIT; this.target = this.homeSpot(); }
        break;
      case CS.EXIT:
        if (go(this.target, 8)) { this.state = CS.REST; this.timer = 6 + Math.random() * 10; }
        break;
      case CS.ALERT:
        this.face = p.x > this.x ? 1 : -1;
        if (this.aware >= 1) { this.flee(); G.alarm(this); break; }
        if (this.timer <= 0 && this.aware < 0.4) { this.state = this.prevState === CS.ALERT ? CS.GRAZE : this.prevState || CS.GRAZE; this.timer = Math.max(this.timer, 3); }
        break;
      case CS.FLEE:
        if (!this.target) this.target = this.waterSpot(40, 'safe');
        if (go(this.target, this.sub > 0.6 ? 16 : 34)) { this.state = CS.SWIM; this.timer = 30; this.target = this.waterSpot(30, 'safe'); }
        break;
    }
    if (sp) {
      const was = this.water();
      const moved = moveBody(g, this, mx, my, sp, dt, this.r, true);
      // preso num obstáculo: escolhe outro destino (e, em último caso, escorrega até ele)
      this.stuckT = moved < sp * dt * 0.25 ? (this.stuckT || 0) + dt : 0;
      if (this.stuckT > 1.2) {
        this.stuckT = 0; this.unstuck = (this.unstuck || 0) + 1;
        if (this.unstuck > 3 && this.target) { this.x = lerp(this.x, this.target.x, 0.35); this.y = lerp(this.y, this.target.y, 0.35); this.unstuck = 0; }
        else this.target = this.state === CS.FLEE || this.state === CS.ENTER || this.state === CS.SWIM ? this.waterSpot(40, 'safe') : this.homeSpot();
      }
      if (Math.abs(mx) > 0.15) this.face = mx > 0 ? 1 : -1;
      this.anim += dt * (sp > 20 ? 9 : 4); this.frame = Math.floor(this.anim) % 2;
      const now = this.water();
      if (was !== now) { g.audio.play('splash', { pan: g.panOf(this.x), vol: 0.35 }); for (let i = 0; i < 5; i++) g.particles.add({ type: 'splash', x: this.x, y: this.y, vx: (Math.random() - 0.5) * 20, vy: -12 - Math.random() * 10, g: 60, life: 0.5 }); }
      if (now) { this.wakeT -= dt; if (this.wakeT <= 0) { this.wakeT = 0.35; g.particles.add({ type: 'ripple', x: this.x - mx * 6, y: this.y, life: 1.1, r1: 6, color: '#bcd2d6' }); } }
    } else this.frame = 0;
    // transição terra/água: o corpo afunda e emerge aos poucos
    const tgt = this.water() ? 1 : 0;
    this.sub += (tgt - this.sub) * Math.min(1, dt * 2.6);
  }
  flee() {
    if (this.state === CS.FLEE) return;
    this.state = CS.FLEE; this.target = this.sub > 0.6 ? this.waterSpot(40, 'safe') : this.nearestWater();
    this.g.audio.play('capivara', { pan: this.g.panOf(this.x), vol: 1.2 });
    this.g.audio.play('capivara', { pan: this.g.panOf(this.x), vol: 0.9, t: 0.15 });
  }
  nearestWater() {
    const w = this.g.world; let best = null, bd = 1e9;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) for (let r = 12; r <= 90; r += 12) {
      const x = this.x + Math.cos(a) * r, y = this.y + Math.sin(a) * r * 0.8;
      if (w.isWater(x, y) && w.isWater(x + 10 * Math.cos(a), y + 10 * Math.sin(a))) { if (r < bd) { bd = r; best = { x: x + Math.cos(a) * 14, y: y + Math.sin(a) * 10 }; } break; }
    }
    return best || this.waterSpot(40, 'safe');
  }
  draw(ctx) {
    const st = this.state;
    const pose = st === CS.REST ? 'rest' : st === CS.GRAZE ? 'graze' : st === CS.ALERT ? 'alert' : 'walk';
    const fl = this.face < 0 ? 1 : 0, f = this.frame;
    const s = Sprites.get(`capy:${pose}:${f}:${fl}`, () => { const c = capySprite(f, pose); return fl ? flipCanvas(c) : c; });
    const sc = this.juv ? 0.72 : 1;
    const w = Math.round(28 * sc), h = Math.round(17 * sc);
    const vis = Math.round(h * (1 - 0.56 * this.sub));
    const bob = this.sub > 0.5 ? Math.round(Math.sin(this.g.time * 2 + this.x) * 0.6) : 0;
    if (this.sub < 0.5) shadow(ctx, this.x, this.y + 1, 10 * sc, 2.5 * sc);
    ctx.drawImage(s, 0, 0, 28, Math.max(1, Math.round(17 * (1 - 0.56 * this.sub))), Math.round(this.x - w / 2), Math.round(this.y - h + 2 + (h - vis) + bob), w, vis);
    if (this.sub > 0.15) {
      ctx.globalAlpha = 0.5 * this.sub; ctx.strokeStyle = '#d0e0e4'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(this.x, this.y + 2 + bob, 9 * sc, 2.2, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (st === CS.ALERT) drawAwareIcon(ctx, this.x, this.y - h - 1, '?');
    else if (st === CS.FLEE && this.sub < 0.5) drawAwareIcon(ctx, this.x, this.y - h - 1, '!');
  }
}

// ================================================================ PACA
export const PS3 = { HIDDEN: 'ESCONDIDA', EMERGE: 'SAINDO', FORAGE: 'FORRAGEAR', WALK: 'CAMINHAR', ALERT: 'ALERTA', FLEE: 'FUGIR', HIDE: 'ESCONDER', DIVE: 'MERGULHAR' };
const PACA_K = { hearing: 1.25, sight: 44, smell: 80, smellW: 0.9 };

export class PacaV {
  constructor(g, ph, den, o = {}) {
    this.g = g; this.ph = ph; this.den = { ...den }; this.x = den.x; this.y = den.y; this.r = 3; this.id = o.id || 'paca';
    this.state = PS3.HIDDEN; this.visible = false; this.timer = 2 + Math.random() * 6; this.aware = 0; this.base = o.shade || 0;
    this.face = 1; this.frame = 0; this.anim = 0; this.target = null; this.outT = 0;
  }
  // a paca sai quando a mata escurece: entardecer, tempestade ou sombra fechada
  activity() {
    const g = this.g, shade = g.world.densityAt(this.den.x, this.den.y);
    return clamp(this.base + (g.darkness - 0.12) * 2.4 + shade * 0.45 + (this.ph.stormLevel?.() || 0) * 0.4, 0, 1);
  }
  update(dt) {
    const g = this.g, p = g.player;
    if (!p) return;
    this.timer -= dt;
    const sn = this.visible ? sense(g, this, PACA_K, this.ph.los ? (a, b, c, d) => this.ph.los(a, b, c, d) : null) : { s: 0, d: dist(this.x, this.y, p.x, p.y) };
    if (sn.s > 0) this.aware = Math.min(1.3, this.aware + sn.s * dt * 1.2); else this.aware = Math.max(0, this.aware - dt * 0.35);
    let mx = 0, my = 0, sp = 0;
    const go = (t, s) => { const dx = t.x - this.x, dy = t.y - this.y, d = Math.hypot(dx, dy); if (d < 2.5) return true; mx = dx / d; my = dy / d; sp = s; return false; };
    if (this.visible && [PS3.FORAGE, PS3.WALK, PS3.EMERGE].includes(this.state)) {
      if (this.aware >= 1) this.flee();
      else if (this.aware >= 0.4) { this.state = PS3.ALERT; this.timer = 0.9 + Math.random() * 0.8; }
    }
    switch (this.state) {
      case PS3.HIDDEN:
        if (this.timer <= 0) {
          this.timer = 5 + Math.random() * 7;
          const quiet = sn.d > 95 && p.noiseRadius() < sn.d;
          if (quiet && Math.random() < this.activity()) { this.visible = true; this.state = PS3.EMERGE; this.timer = 1.6; this.x = this.den.x; this.y = this.den.y; this.aware = 0; this.ph.onPacaEvent?.(this, 'sai'); }
        }
        break;
      case PS3.EMERGE:
        if (this.timer <= 0) { this.state = PS3.FORAGE; this.timer = 4 + Math.random() * 5; this.outT = 25 + Math.random() * 25; }
        break;
      case PS3.FORAGE:
        this.outT -= dt;
        if (this.timer <= 0) { const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 30; this.target = { x: this.den.x + Math.cos(a) * r, y: this.den.y + Math.sin(a) * r * 0.6 }; this.state = PS3.WALK; this.timer = 6; }
        if (this.outT <= 0 || this.activity() < 0.15) { this.state = PS3.HIDE; this.target = this.den; }
        break;
      case PS3.WALK:
        this.outT -= dt;
        if (go(this.target, 13) || this.timer <= 0) { this.state = PS3.FORAGE; this.timer = 2.5 + Math.random() * 4; }
        break;
      case PS3.ALERT:
        // congela, orelhas em pé
        if (this.aware >= 1) this.flee();
        else if (this.timer <= 0 && this.aware < 0.3) { this.state = PS3.FORAGE; this.timer = 2 + Math.random() * 3; }
        break;
      case PS3.FLEE:
        if (go(this.target, 60)) {
          if (this.target.water) { this.state = PS3.DIVE; this.visible = false; this.timer = 25 + Math.random() * 15; g.audio.play('splash', { pan: g.panOf(this.x), vol: 0.7 }); for (let i = 0; i < 6; i++) g.particles.add({ type: 'splash', x: this.x, y: this.y, vx: (Math.random() - 0.5) * 24, vy: -14, g: 60, life: 0.5 }); g.particles.add({ type: 'ripple', x: this.x, y: this.y, life: 1.4, r1: 10 }); }
          else { this.state = PS3.HIDDEN; this.visible = false; this.timer = 25 + Math.random() * 15; }
          this.ph.onPacaEvent?.(this, 'esconde');
        }
        break;
      case PS3.HIDE:
        if (go(this.target, 16)) { this.state = PS3.HIDDEN; this.visible = false; this.timer = 15 + Math.random() * 15; }
        break;
      case PS3.DIVE:
        if (this.timer <= 0) { this.state = PS3.HIDDEN; this.x = this.den.x; this.y = this.den.y; this.timer = 4; }
        break;
    }
    if (sp) { moveBody(g, this, mx, my, sp, dt, this.r, this.state === PS3.FLEE && this.target?.water); if (Math.abs(mx) > 0.1) this.face = mx > 0 ? 1 : -1; this.anim += dt * (sp > 30 ? 12 : 5); this.frame = Math.floor(this.anim) % 2; }
    else this.frame = this.state === PS3.FORAGE ? Math.floor(g.time * 2.5) % 2 : 0;
  }
  flee() {
    const g = this.g;
    // foge para a toca ou mergulha, o que estiver mais perto
    const w = this.ph.nearWater?.(this.x, this.y, 60);
    const dd = dist(this.x, this.y, this.den.x, this.den.y);
    this.target = w && dist(this.x, this.y, w.x, w.y) < dd ? { ...w, water: true } : { ...this.den };
    this.state = PS3.FLEE;
    g.audio.play('rustle', { pan: g.panOf(this.x), vol: 0.5 });
    g.caption('Algo pequeno dispara entre as raízes', g.panOf(this.x));
  }
  draw(ctx) {
    if (!this.visible) return;
    const fl = this.face < 0 ? 1 : 0, f = this.frame;
    const s = Sprites.get(`a:paca:${f}:${fl}:`, () => { const c = pacaSprite(f); return fl ? flipCanvas(c) : c; });
    const up = this.state === PS3.ALERT ? 1 : 0;
    shadow(ctx, this.x, this.y + 1, 7, 2);
    ctx.drawImage(s, Math.round(this.x - 11), Math.round(this.y - 12 - up));
    if (this.state === PS3.ALERT) drawAwareIcon(ctx, this.x, this.y - 15, '?');
  }
}

// ================================================================ GARÇA
export class Heron {
  constructor(g, ph, x, y) { this.g = g; this.ph = ph; this.x = x; this.y = y; this.home = { x, y }; this.state = 'perch'; this.t = Math.random() * 9; this.vx = 0; this.vy = 0; this.z = 0; this.timer = 0; this.face = Math.random() < 0.5 ? 1 : -1; }
  update(dt) {
    const g = this.g, p = g.player; this.t += dt;
    if (!p) return;
    if (this.state === 'perch') {
      const d = dist(this.x, this.y, p.x, p.y);
      const fast = (this.ph.canoeSpeed?.() || 0) > 26 || p.running;
      if ((d < 52) || (d < 90 && fast) || (p.noiseRadius() > d * 1.2 && d < 140) || this.ph.silence?.()) this.fly();
    } else if (this.state === 'fly') {
      this.x += this.vx * dt; this.y += this.vy * dt; this.z = Math.min(60, this.z + 22 * dt);
      this.timer -= dt;
      if (this.timer <= 0) { this.state = 'away'; this.timer = 25 + Math.random() * 20; }
    } else if (this.state === 'away') {
      this.timer -= dt;
      if (this.timer <= 0 && !this.ph.silence?.() && dist(this.home.x, this.home.y, p.x, p.y) > 160) { this.state = 'perch'; this.x = this.home.x; this.y = this.home.y; this.z = 0; }
    }
  }
  fly() {
    const g = this.g, p = g.player;
    const a = Math.atan2(this.y - p.y, this.x - p.x) + (Math.random() - 0.5) * 0.8;
    this.vx = Math.cos(a) * 46; this.vy = Math.sin(a) * 30 - 8; this.face = this.vx > 0 ? 1 : -1;
    this.state = 'fly'; this.timer = 6;
    g.audio.play('flap', { pan: g.panOf(this.x), vol: 0.7 });
    this.ph.onBirdFly?.(this);
  }
  draw(ctx) {
    if (this.state === 'away') return;
    const fl = this.face < 0 ? 1 : 0;
    if (this.state === 'perch') {
      const f = Math.floor(this.t * 0.6) % 2;
      const s = Sprites.get(`heronP:${f}:${fl}`, () => { const c = heronPerched(f); return fl ? flipCanvas(c) : c; });
      ctx.drawImage(s, Math.round(this.x - 7), Math.round(this.y - 21));
    }
  }
  drawAir(ctx) {
    if (this.state !== 'fly') return;
    const f = Math.floor(this.t * 6) % 2, fl = this.face < 0 ? 1 : 0;
    const s = Sprites.get(`heronF:${f}:${fl}`, () => { const c = heronFlying(f); return fl ? flipCanvas(c) : c; });
    ctx.drawImage(s, Math.round(this.x - 12), Math.round(this.y - 8 - this.z));
  }
}
