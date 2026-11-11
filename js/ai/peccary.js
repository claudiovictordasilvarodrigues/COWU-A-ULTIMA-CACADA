// Queixadas: inteligência artificial por máquina de estados + comportamento de bando.
//
// Cada animal percebe o jogador por distância, campo de visão, linha de visão, ruído e faro
// (vento), e acumula "desconfiança" (aware). O bando compartilha informação por chamados
// (bater de queixo / grunhidos) que se propagam com atraso proporcional à distância — nada
// de telepatia instantânea. A perseguição tem limite (coleira) e o animal desiste quando perde
// o rastro, quando atinge a coleira ou quando encontra uma barreira que não consegue vencer.
import { dist, clamp, angleDiff, TAU } from '../core/util.js';
import { Sprites } from '../gfx/sprites.js';
import { flipCanvas } from '../gfx/pixel.js';
import { peccarySide, peccaryFront } from '../gfx/art-peccary.js';
import { FlowField, circleBlocked } from './flowfield.js';

export const S = {
  IDLE: 'IDLE', FORAGING: 'FORAGING', WALKING: 'WALKING', ALERT: 'ALERT',
  INVESTIGATE: 'INVESTIGATE', DEFENSIVE: 'DEFENSIVE', CHASE: 'CHASE', RETURN: 'RETURN',
};
const CALM = new Set([S.IDLE, S.FORAGING, S.WALKING]);
export const isCalm = (st) => CALM.has(st);

export const TUNE = {
  sightRange: 88, fovCalm: 1.05, fovAlert: 1.55, closeSense: 20,
  hearing: 0.95, smellRange: 105,
  walkSpeed: 19, forageSpeed: 6, investigateSpeed: 25, chaseSpeed: 76, returnSpeed: 32,
  alertAt: 0.3, investigateAt: 0.62, defensiveAt: 1.0,
  separation: 10, minGap: 6.5,
  biteRange: 11, biteDamage: 9, biteCooldown: 1.25,
  threatRange: 82, lostSight: 3.4,
  callRadius: 130, callDelay: 0.22, callSpeed: 140,
};

const rnd = Math.random;

export class Peccary {
  constructor(herd, x, y, o = {}) {
    const R = o.rng || rnd;
    this.herd = herd; this.g = herd.g;
    this.x = x; this.y = y; this.kind = 'queixada'; this.visible = true;
    this.juv = !!o.juv; this.r = this.juv ? 3 : 4;
    this.pers = {
      bold: (this.juv ? 0.45 : 0.78) + R() * 0.45,
      wary: 0.85 + R() * 0.3, spd: 0.92 + R() * 0.16,
      pal: (R() * 3) | 0, sentinel: !!o.sentinel, ph: R() * 10,
    };
    this.slot = o.slot || { x: (R() - 0.5) * 56, y: (R() - 0.5) * 36 };
    this.heading = R() * TAU; this.speed = 0; this.face = Math.cos(this.heading) >= 0 ? 1 : -1;
    this.state = S.IDLE; this.prevCalm = S.FORAGING; this.stateT = 0; this.timer = 1 + R() * 3;
    this.aware = 0; this.stim = null; this.lastSeen = null; this.lastPerceivedT = -99;
    this.alertCause = null; this.reason = null; this.perc = null;
    this.anim = R() * 4; this.frame = 0; this.head = 'mid'; this.mouth = false; this.bristle = false;
    this.callCd = 0; this.biteCd = 0; this.recoilT = 0; this.stuckT = 0; this.sideStep = null;
    this.clackT = 0; this.gruntT = 2 + R() * 9; this.turnT = 0; this.losT = R() * 0.1; this.losOk = false;
    this.target = null; this.foodT = 0; this.behavior = null; this.standoffT = 0;
  }

  // ---------------- percepção ----------------
  // linha de visão: troncos grossos e pedras sempre bloqueiam; troncos caídos e moitas só
  // escondem quem está agachado. skipA ignora as moitas junto da origem (quem olha de dentro).
  los(ax, ay, bx, by, skipA = 0) {
    const w = this.g.world, d = dist(ax, ay, bx, by), n = Math.ceil(d / 5);
    const crouched = !!(this.g.player && (this.g.player.sneak || this.g.player.forceCrouch));
    for (let i = 1; i < n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      for (const c of w.near(x, y)) {
        if (c.off) continue;
        if (c.r) { if (c.r >= 2.5 && (x - c.x) ** 2 + (y - c.y) ** 2 < c.r * c.r) return false; }
        else if (c.occ && (!c.low || crouched) && x >= c.x && y >= c.y && x <= c.x + c.w && y <= c.y + c.h) return false;
      }
      if (this.herd.occludes && t * d > skipA && this.herd.occludes(x, y, crouched)) return false;
    }
    return true;
  }

  perceive(dt) {
    const g = this.g, p = g.player;
    const out = { rate: 0, seen: false, heard: 0, smelled: false, d: Infinity };
    if (!p || p.hidden || this.herd.ignorePlayer) return out;
    const d = dist(this.x, this.y, p.x, p.y);
    out.d = d;
    if (d > 280) return out;
    const alerted = !CALM.has(this.state);
    // audição: o raio de ruído do jogador (passos, galhos, esbarrões)
    const nr = p.noiseRadius() * TUNE.hearing * this.pers.wary;
    if (nr > 0 && d < nr) { const k = 1 - d / nr; out.heard = k; out.rate += 1.7 * k + 0.25; }
    // visão: alcance x visibilidade do jogador, campo de visão e linha de visão
    const range = TUNE.sightRange * p.vis * (alerted ? 1.25 : 1) * (this.head === 'down' ? 0.7 : 1);
    if (d < range) {
      const ang = Math.atan2(p.y - this.y, p.x - this.x);
      const fov = this.state === S.CHASE ? Math.PI : alerted || this.head === 'up' ? TUNE.fovAlert : TUNE.fovCalm;
      if (Math.abs(angleDiff(this.heading, ang)) < fov) {
        this.losT -= dt;
        if (this.losT <= 0) { this.losT = 0.12; this.losOk = this.los(this.x, this.y - 4, p.x, p.y - 6); }
        if (this.losOk) { out.seen = true; out.rate += 1.5 * (1 - d / range) + 0.35; }
      }
    }
    // encostou: percebe de qualquer jeito
    if (d < TUNE.closeSense * (p.vis < 0.3 ? 0.6 : 1)) { out.seen = true; out.rate += 1.6; }
    // faro: o vento leva o cheiro do jogador até o bicho
    if (d < TUNE.smellRange * (this.herd.smellMul || 1) && g.isDownwind(p, this)) { out.smelled = true; out.rate += 0.32 * (1 - d / (TUNE.smellRange * (this.herd.smellMul || 1))) + 0.08; }
    return out;
  }

  reasonText(pc) {
    const p = this.g.player;
    if (pc.seen) return { key: 'viu', text: p.running ? 'Um queixada <b>viu</b> você correndo à vista.' : p.sneak ? 'Um queixada <b>viu</b> você: mesmo agachado, estava perto demais e sem nada na frente.' : 'Um queixada <b>viu</b> você em pé, se mexendo à vista. Agache e use troncos, pedras e moitas para quebrar a linha de visão.' };
    if (pc.heard) return { key: 'ouviu', text: `Um queixada <b>ouviu</b> você: ruído ${p.running ? 'ALTO (correndo)' : p.noiseSpike > 0.5 ? 'ALTO (galho seco, moita ou esbarrão)' : 'MÉDIO (andando em pé)'}. Agachado (C) o ruído fica BAIXO.` };
    if (pc.smelled) return { key: 'farejou', text: 'Um queixada <b>farejou</b> você: o vento estava levando o seu cheiro para o bando. Veja a seta de VENTO no minimapa.' };
    return { key: 'percebeu', text: 'Um queixada percebeu sua presença.' };
  }

  // ---------------- estímulos externos ----------------
  hear(x, y, level, kind) {
    if (this.state === S.CHASE || this.state === S.DEFENSIVE) return;
    this.stim = { x, y, kind, level, t: this.g.time };
    if (kind === 'shot') this.aware = Math.max(this.aware, 0.9);
    if (CALM.has(this.state) || this.state === S.RETURN) { this.prevCalm = CALM.has(this.state) ? this.state : S.FORAGING; this.alertCause = kind === 'player' ? 'player' : 'noise'; this.enter(S.ALERT); }
    else if (this.state === S.ALERT || this.state === S.INVESTIGATE) { if (kind !== 'player' && this.alertCause !== 'player') this.alertCause = 'noise'; this.timer = Math.max(this.timer, 0.6); }
  }

  receiveCall(c) {
    if (this.state === S.CHASE) return;
    const lvl = c.level;
    this.stim = { x: c.sx, y: c.sy, kind: 'call', level: lvl, t: this.g.time };
    if (c.cause === 'player') this.alertCause = 'player';
    if (lvl >= 2) {
      // chamado de ataque: os mais valentes e próximos entram na investida
      const d = dist(this.x, this.y, c.sx, c.sy);
      this.aware = Math.max(this.aware, 0.85);
      this.viaCall = true;
      if (this.pers.bold > 1.0 && !this.juv && d < 120 && c.cause === 'player' && this.herd.counts().chase < this.herd.maxChasers && !this.herd.playerSafe()) { this.lastSeen = { x: c.sx, y: c.sy }; this.lastPerceivedT = this.g.time; this.enter(S.CHASE); return; }
      if (this.state !== S.DEFENSIVE) this.enter(S.DEFENSIVE);
    } else if (lvl >= 1) {
      this.aware = Math.max(this.aware, c.cause === 'player' ? 0.66 : 0.4);
      if (CALM.has(this.state) || this.state === S.RETURN) { this.prevCalm = CALM.has(this.state) ? this.state : S.FORAGING; this.enter(S.ALERT); }
    }
  }

  scare() { const p = this.g.player; this.herd.hearNoise(p.x, p.y, 3, 'shot'); }

  // ---------------- máquina de estados ----------------
  enter(st) {
    const prev = this.state;
    this.state = st; this.stateT = 0; this.sideStep = null; this.sniffT = 0; this.noiseClacked = false;
    const R = rnd;
    switch (st) {
      case S.IDLE: this.timer = 1.5 + R() * 3; break;
      case S.FORAGING: this.timer = 4 + R() * 7; this.target = this.herd.calmPoint(this); break;
      case S.WALKING: this.timer = 8; break;
      case S.ALERT: this.timer = 1.1 + R() * 1.1 / this.pers.bold; this.speed *= 0.3; if (this.callCd <= 0 && this.alertCause === 'player') this.vocal('grunt'); break;
      case S.INVESTIGATE: this.timer = 7; break;
      case S.DEFENSIVE:
        this.timer = 0.75 + R() * 0.6 / this.pers.bold; this.clackT = 0; this.bristle = true;
        this.herd.emit(this, this.alertCause === 'player' && !this.viaCall ? 2 : 1);
        if (this.alertCause === 'player') this.herd.detected(this);
        break;
      case S.CHASE:
        this.bristle = true; this.timer = 0;
        if (!this.viaCall) this.herd.emit(this, 2);
        this.herd.chaseStarted(this);
        if (prev !== S.CHASE) this.vocal('grunt', 1.4);
        break;
      case S.RETURN: this.timer = 22; this.bristle = false; this.mouth = false; this.aware = Math.min(this.aware, 0.5); break;
    }
    if (CALM.has(st)) { this.bristle = false; this.mouth = false; this.alertCause = null; this.viaCall = false; }
  }

  vocal(kind, vol = 1) {
    if (kind === 'clack') this.herd.sfx('clack', this.x, this.y, 0.9 * vol);
    else if (kind === 'grunt') this.herd.sfx(this.juv ? 'squeal' : 'grunt', this.x, this.y, 0.8 * vol, this.juv ? 1.6 : 1);
  }

  update(dt) {
    const g = this.g, p = g.player, H = this.herd;
    this.stateT += dt;
    this.timer -= dt;
    this.callCd -= dt; this.biteCd -= dt; this.recoilT -= dt; this.turnT -= dt; this.gruntT -= dt;
    if (this.blockedAt(this.x, this.y)) this.unstick();

    // percepção do jogador
    const pc = (this.perc = this.perceive(dt));
    if (pc.rate > 0) {
      this.aware = Math.min(1.5, this.aware + pc.rate * dt * this.pers.wary);
      if (pc.seen || pc.heard > 0.25) { this.lastSeen = { x: p.x, y: p.y }; this.lastPerceivedT = g.time; }
      else if (pc.smelled || pc.heard) { this.lastPerceivedT = g.time; if (!this.lastSeen || pc.heard) this.lastSeen = { x: p.x + (rnd() - 0.5) * pc.d * 0.4, y: p.y + (rnd() - 0.5) * pc.d * 0.4 }; }
      const strongest = pc.seen ? 'seen' : pc.heard ? 'heard' : 'smell';
      if (this.aware > TUNE.alertAt * 0.7) { this.reason = this.reasonText(pc); this.reason.ch = strongest; }
      if (this.aware >= TUNE.alertAt && (this.state === S.ALERT || this.state === S.INVESTIGATE)) this.alertCause = 'player';
    } else {
      this.aware = Math.max(0, this.aware - dt * (CALM.has(this.state) ? 0.13 : 0.07));
    }

    let tx = null, ty = null, spd = 0, dir = null;
    const st = this.state;

    if (CALM.has(st)) {
      if (this.aware >= TUNE.alertAt && pc.rate > 0) {
        this.prevCalm = st; this.alertCause = 'player';
        this.stim = { x: this.lastSeen ? this.lastSeen.x : p.x, y: this.lastSeen ? this.lastSeen.y : p.y, kind: 'player', t: g.time };
        this.enter(S.ALERT);
      }
    }

    switch (this.state) {
      case S.IDLE: {
        this.head = this.pers.sentinel && H.sentinelUp ? 'up' : 'mid';
        if (this.pers.sentinel && H.sentinelUp) { if (Math.floor(g.time * 0.8 + this.pers.ph) % 2 === 0) this.head = 'up'; }
        if (H.moving) { this.enter(S.WALKING); break; }
        if (this.pers.sentinel && H.sentinelUp) this.timer = Math.max(this.timer, 0.5);
        if (this.timer <= 0) this.enter(rnd() < 0.7 ? S.FORAGING : S.IDLE);
        if (this.gruntT <= 0) { this.gruntT = 5 + rnd() * 10; if (rnd() < 0.5) this.vocal('grunt', 0.6); }
        break;
      }
      case S.FORAGING: {
        this.head = 'down';
        if (H.moving) { this.enter(S.WALKING); break; }
        if (this.pers.sentinel && H.sentinelUp && this.foodT <= 0) { this.enter(S.IDLE); break; }
        if (this.target && dist(this.x, this.y, this.target.x, this.target.y) > 4) { tx = this.target.x; ty = this.target.y; spd = TUNE.forageSpeed; }
        if (this.foodT > 0) this.foodT -= dt;
        if (this.timer <= 0) { if (this.foodT > 0) this.enter(S.FORAGING); else this.enter(rnd() < 0.55 ? S.IDLE : S.FORAGING); }
        if (this.gruntT <= 0) { this.gruntT = 4 + rnd() * 9; if (rnd() < 0.6) this.vocal('grunt', 0.5); if (rnd() < 0.3) H.dust(this); }
        break;
      }
      case S.WALKING: {
        this.head = 'mid';
        const pt = H.calmPoint(this, true);
        tx = pt.x; ty = pt.y;
        const dd = dist(this.x, this.y, tx, ty);
        spd = TUNE.walkSpeed * (dd > 30 ? 1.5 : dd > 10 ? 1 : 0.4);
        if (!H.moving && dd < 10) this.enter(rnd() < 0.7 ? S.FORAGING : S.IDLE);
        if (!H.moving && this.timer <= 0) this.enter(S.FORAGING);
        break;
      }
      case S.ALERT: {
        // para, levanta a cabeça, encara o estímulo e fareja
        this.head = 'up';
        const s = this.stim || this.lastSeen;
        if (s) dir = this.faceToward(s.x, s.y, dt, 4);
        if (this.alertCause === 'player' && pc.rate > 0) this.timer = Math.max(this.timer, 0.25);
        // bater de queixo quando desconfia (de um barulho qualquer ou do jogador)
        if (this.stim && (this.stim.kind === 'noise' || this.stim.kind === 'food') && !this.noiseClacked && this.stateT > 0.25) {
          this.noiseClacked = true;
          if (this.pers.bold > 0.85) { this.vocal('clack', 0.7); this.mouthT = 0.5; }
        }
        this.clackT -= dt;
        if (this.aware > 0.55 && this.clackT <= 0) { this.clackT = 1.4 + rnd(); this.vocal('clack', 0.5); this.mouthT = 0.35; if (this.callCd <= 0 && this.alertCause === 'player') H.emit(this, 1); }
        if (this.aware >= TUNE.defensiveAt && (pc.seen || pc.d < 45 || (pc.heard > 0.5 && pc.d < 70))) { this.enter(S.DEFENSIVE); break; }
        if (this.timer <= 0) {
          if (this.aware >= TUNE.investigateAt || (this.stim && this.stim.kind !== 'player' && this.stim.kind !== 'call')) this.enter(S.INVESTIGATE);
          else if (this.aware < TUNE.alertAt) this.enter(this.prevCalm || S.FORAGING);
          else this.timer = 0.8;
        }
        break;
      }
      case S.INVESTIGATE: {
        this.head = this.stateT % 2 < 1.2 ? 'mid' : 'up';
        const s = this.alertCause === 'player' && this.lastSeen && g.time - this.lastPerceivedT < 2 ? this.lastSeen : (this.stim || this.lastSeen);
        if (!s) { this.enter(S.RETURN); break; }
        const d = dist(this.x, this.y, s.x, s.y);
        if (d > 14) { tx = s.x; ty = s.y; spd = TUNE.investigateSpeed * this.pers.spd; }
        else {
          this.head = 'down';
          if (!this.sniffT) this.sniffT = 1.6;
          this.sniffT -= dt;
          if (this.sniffT <= 0) {
            this.sniffT = 0;
            if (this.stim && this.stim.kind === 'food') { this.foodT = 8 + rnd() * 6; this.stim = null; this.enter(S.FORAGING); this.target = { x: this.x + (rnd() - 0.5) * 10, y: this.y + (rnd() - 0.5) * 8 }; this.timer = this.foodT; }
            else this.enter(S.RETURN);
            break;
          }
        }
        if (this.aware >= TUNE.defensiveAt && (pc.seen || pc.d < 40)) { this.enter(S.DEFENSIVE); break; }
        if (!H.inLeash(this.x, this.y, 0.85)) { this.enter(S.RETURN); break; }
        if (this.timer <= 0) this.enter(S.RETURN);
        break;
      }
      case S.DEFENSIVE: {
        // postura de ameaça: crina arrepiada, cabeça baixa, bate os dentes
        this.head = 'mid';
        const tgt = this.lastSeen || this.stim;
        if (tgt) dir = this.faceToward(tgt.x, tgt.y, dt, 6);
        this.clackT -= dt;
        if (this.clackT <= 0) { this.clackT = 0.7 + rnd() * 0.5; this.vocal('clack', 1); this.mouthT = 0.5; }
        if (this.stateT < 0.2) H.stamp(this);
        if (this.timer <= 0) {
          const near = pc.d < TUNE.threatRange * this.pers.bold * (H.aggression || 1);
          const recent = g.time - this.lastPerceivedT < 1.5;
          if (this.alertCause === 'player' && near && recent && H.inLeash(this.x, this.y) && !this.juv && !H.playerSafe()) this.enter(S.CHASE);
          else if (this.stateT > 3 || pc.d > 140 || !recent) this.enter(S.RETURN);
          else this.timer = 0.4;
        }
        break;
      }
      case S.CHASE: {
        this.head = 'mid';
        const lost = g.time - this.lastPerceivedT;
        const tgt = lost < 1.0 ? { x: p.x, y: p.y } : this.lastSeen;
        // desistência: coleira, barreira, rastro perdido
        if (!H.inLeash(this.x, this.y)) { this.giveUp('leash'); break; }
        if (lost > (H.lostSight || TUNE.lostSight)) { this.giveUp('lost'); break; }
        if (!tgt) { this.giveUp('lost'); break; }
        if (H.playerSafe() || (H.blocked && H.blocked(this.x + Math.cos(this.heading) * 10, this.y + Math.sin(this.heading) * 10) && dist(this.x, this.y, tgt.x, tgt.y) < 90 && H.blockedBetween(this.x, this.y, tgt.x, tgt.y))) { this.standoffT += dt; if (this.standoffT > 1.4) { this.giveUp('barrier'); break; } }
        else this.standoffT = Math.max(0, this.standoffT - dt);
        if (this.recoilT > 0) {
          dir = { x: -Math.cos(this.heading), y: -Math.sin(this.heading) }; spd = 40;
          this.faceKeep = true;
        } else {
          const d = dist(this.x, this.y, tgt.x, tgt.y);
          if (lost >= 1.0 && d < 10) { this.giveUp('lost'); break; }
          dir = H.pathDir(this, tgt.x, tgt.y, true);
          spd = TUNE.chaseSpeed * this.pers.spd * (H.chaseMul || 1) * (g.world.surfaceAt(this.x, this.y) === 'mud' ? 0.82 : 1);
          // arranque: fica um pouco mais rápido depois de alguns segundos de corrida
          if (this.stateT < 0.6) spd *= 0.6 + this.stateT / 1.5;
          this.tryBite(pc);
        }
        this.clackT -= dt;
        if (this.clackT <= 0) { this.clackT = 1.2 + rnd() * 1.4; this.vocal(rnd() < 0.6 ? 'clack' : 'grunt', 1); }
        break;
      }
      case S.RETURN: {
        this.head = 'mid';
        const pt = H.calmPoint(this, true);
        const d = dist(this.x, this.y, pt.x, pt.y);
        if (this.standoffT > 0) { this.standoffT -= dt; const s = this.lastSeen; if (s) dir = this.faceToward(s.x, s.y, dt, 5); this.clackT -= dt; if (this.clackT <= 0) { this.clackT = 0.9; this.vocal('clack', 0.8); this.mouthT = 0.4; } break; }
        if (d < 14 || this.timer <= 0) { this.aware = Math.min(this.aware, 0.15); this.enter(rnd() < 0.6 ? S.FORAGING : S.IDLE); break; }
        dir = H.pathDir(this, pt.x, pt.y, false);
        spd = TUNE.returnSpeed * this.pers.spd;
        if (this.aware >= TUNE.defensiveAt && pc.seen && pc.d < 60 && this.stateT > 1.5 && !H.playerSafe()) { this.alertCause = 'player'; this.enter(S.DEFENSIVE); }
        break;
      }
    }

    // boca abrindo e fechando enquanto bate o queixo
    if (this.mouthT > 0) { this.mouthT -= dt; this.mouth = Math.floor(this.mouthT * 18) % 2 === 0; } else this.mouth = false;

    // locomoção
    if (tx !== null && !dir) { const dx = tx - this.x, dy = ty - this.y, m = Math.hypot(dx, dy) || 1; dir = { x: dx / m, y: dy / m }; if (CALM.has(this.state) || this.state === S.INVESTIGATE) { const pd = H.pathDir(this, tx, ty, false, true); if (pd) dir = pd; } }
    this.locomote(dir, spd, dt);
    this.behavior = this.state === S.FORAGING ? 'forage'
      : this.state === S.IDLE && this.pers.sentinel && this.head === 'up' ? 'sentinel'
        : this.state === S.WALKING && H.moving && this.speed > 6 ? 'move'
          : (this.state === S.ALERT || this.state === S.DEFENSIVE) && this.mouthT > 0 ? 'clack' : null;
  }

  giveUp(why) {
    this.standoffT = why === 'barrier' || why === 'leash' ? 1.4 + rnd() : 0;
    this.enter(S.RETURN);
    this.herd.gaveUp(this, why);
  }

  faceToward(x, y, dt, rate) {
    const a = Math.atan2(y - this.y, x - this.x);
    this.heading += clamp(angleDiff(this.heading, a), -rate * dt, rate * dt);
    return null;
  }

  tryBite(pc) {
    const g = this.g, p = g.player;
    if (this.biteCd > 0 || g.state !== 'play' || pc.d > TUNE.biteRange + this.r) return;
    if (g.time - (this.herd.lastBiteT ?? -99) < this.herd.biteInterval) return; // o bando não morde todo de uma vez
    this.herd.lastBiteT = g.time;
    this.biteCd = TUNE.biteCooldown + rnd() * 0.5;
    this.recoilT = 0.55;
    if (p.invuln > 0 || p.dodgeT > 0) return;
    // com o jogador muito ferido, parte das investidas vira só ameaça (bater de dentes)
    if (this.herd.mercy && p.hp < 40 && rnd() < 0.5) { this.vocal('clack', 1); this.mouthT = 0.5; return; }
    const before = p.hp;
    p.hurt(this.herd.biteDamage || TUNE.biteDamage, this.herd.biteMsg());
    if (p.hp < before) {
      g.audio.play('bite', { pan: g.panOf(this.x) });
      const dx = p.x - this.x, dy = p.y - this.y, m = Math.hypot(dx, dy) || 1;
      g.world.moveCircle(p, dx / m * 10, dy / m * 10, p.r);
      p.vx += dx / m * 60; p.vy += dy / m * 60;
      for (let i = 0; i < 5; i++) g.particles.add({ type: 'puff', x: p.x, y: p.y - 2, vx: (rnd() - 0.5) * 30, vy: (rnd() - 0.5) * 20, life: 0.5, color: '#9a8a6a' });
      this.herd.bit(this);
    }
  }

  // move com virada gradual, separação, desvio de obstáculos e passos curtos (nunca atravessa colisores)
  locomote(dir, spd, dt) {
    const H = this.herd, g = this.g;
    let dx = 0, dy = 0;
    if (dir && spd > 0) { dx = dir.x; dy = dir.y; }
    // separação entre os animais e do jogador (fora da perseguição)
    for (const o of H.members) {
      if (o === this) continue;
      const ox = this.x - o.x, oy = this.y - o.y, d = Math.hypot(ox, oy);
      if (d < TUNE.separation && d > 0.01) { const k = (TUNE.separation - d) / TUNE.separation; dx += ox / d * k * 1.3; dy += oy / d * k * 1.3; }
    }
    if (this.state !== S.CHASE && g.player) {
      const ox = this.x - g.player.x, oy = this.y - g.player.y, d = Math.hypot(ox, oy);
      if (d < 14 && d > 0.01) { dx += ox / d * 1.2; dy += oy / d * 1.2; }
    }
    if (this.sideStep) { this.sideStep.t -= dt; dx = this.sideStep.x; dy = this.sideStep.y; if (this.sideStep.t <= 0) this.sideStep = null; }
    const m = Math.hypot(dx, dy);
    const want = m > 0.05 ? Math.atan2(dy, dx) : this.heading;
    // antecipa obstáculo à frente e escolhe o lado livre
    let h = want;
    if (m > 0.05 && spd > 0) {
      const look = 9 + spd * 0.12;
      if (this.blockedAt(this.x + Math.cos(want) * look, this.y + Math.sin(want) * look)) {
        for (const off of [0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
          const a = want + off * (this.avoidSide || 1);
          if (!this.blockedAt(this.x + Math.cos(a) * look, this.y + Math.sin(a) * look)) { h = a; this.avoidSide = Math.sign(off) * (this.avoidSide || 1) || 1; break; }
        }
      }
    }
    const turn = (this.state === S.CHASE ? 7 : this.state === S.RETURN ? 4.5 : 3) * dt;
    if (!this.faceKeep) this.heading += clamp(angleDiff(this.heading, h), -turn, turn);
    this.faceKeep = false;
    const target = m > 0.05 ? spd : 0;
    this.speed += clamp(target - this.speed, -140 * dt, (this.state === S.CHASE ? 110 : 40) * dt);
    if (this.speed < 0.5 && target === 0) this.speed = 0;
    // passo efetivo: quando há separação forte, permite deslizar mesmo parado
    let mvx = Math.cos(this.heading) * this.speed * dt, mvy = Math.sin(this.heading) * this.speed * dt;
    if (target === 0 && m > 0.05) { mvx = dx / m * 6 * dt; mvy = dy / m * 6 * dt; }
    const ox = this.x, oy = this.y;
    this.tryMove(mvx, mvy);
    const moved = Math.hypot(this.x - ox, this.y - oy);
    if (this.speed > 8 && moved < this.speed * dt * 0.25) {
      this.stuckT += dt;
      if (this.stuckT > 0.35 && !this.sideStep) {
        const a = this.heading + (rnd() < 0.5 ? 1 : -1) * (1.2 + rnd());
        this.sideStep = { x: Math.cos(a), y: Math.sin(a), t: 0.35 + rnd() * 0.3 };
        this.stuckT = 0;
      }
    } else this.stuckT = 0;
    // animação
    const vx = Math.cos(this.heading);
    if (Math.abs(vx) > 0.2) { const nf = vx > 0 ? 1 : -1; if (nf !== this.face) { this.face = nf; this.turnT = 0.14; } }
    this.anim += dt * (this.speed > 45 ? 13 : this.speed > 3 ? 4 + this.speed * 0.25 : 0) * this.pers.spd;
    this.frame = Math.floor(this.anim) % 4;
    if (this.speed > 3 && g.world.surfaceAt(this.x, this.y) === 'mud' && rnd() < dt * this.speed * 0.08) g.particles.add({ type: 'ripple', x: this.x, y: this.y, life: 0.6, r1: 4, color: '#6a5a3a' });
    if (this.speed > 50 && rnd() < dt * 10) g.particles.add({ type: 'puff', x: this.x - Math.cos(this.heading) * 6, y: this.y, vx: -Math.cos(this.heading) * 12, vy: -3, life: 0.5, color: '#9a8466' });
    if (this.speed > 50 && rnd() < dt * 4) g.particles.add({ type: 'leaf', x: this.x, y: this.y, z: 2, vx: (rnd() - 0.5) * 30, vy: 0, life: 1.2, seed: rnd() * 9, color: '#8a6a34' });
  }

  blockedAt(x, y) {
    const w = this.g.world;
    return w.hit(x, y, this.r) || circleBlocked(w, x, y, this.r) || (this.herd.blocked && this.herd.blocked(x, y));
  }

  // nasceu ou foi empurrado para dentro de um obstáculo: procura o ponto livre mais próximo
  unstick() {
    for (let r = 2; r <= 40; r += 2) for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const x = this.x + Math.cos(a) * r, y = this.y + Math.sin(a) * r;
      if (!this.blockedAt(x, y)) { this.x = x; this.y = y; return; }
    }
  }

  tryMove(dx, dy) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 2));
    const sx = dx / steps, sy = dy / steps;
    for (let s = 0; s < steps; s++) {
      if (sx && !this.blockedAt(this.x + sx, this.y)) this.x += sx;
      if (sy && !this.blockedAt(this.x, this.y + sy)) this.y += sy;
    }
  }

  // ---------------- desenho ----------------
  sprite() {
    const moving = this.speed > 3;
    const vy = Math.sin(this.heading);
    let view = 'side';
    if (this.turnT > 0) view = 'front';
    else if (moving && Math.abs(vy) > 0.85) view = vy > 0 ? 'front' : 'back';
    const gait = this.speed > 45 ? 'run' : moving ? 'walk' : 'idle';
    let head = this.head;
    if (this.state === S.FORAGING && Math.sin(this.g.time * 5 + this.pers.ph) > 0.4) head = 'mid';
    const fr = view === 'side' ? this.frame : this.frame % 2;
    const flip = view === 'side' && this.face < 0;
    const k = `q:${view}:${gait}:${fr}:${head}:${this.mouth ? 1 : 0}:${this.bristle ? 1 : 0}:${this.pers.pal}:${this.juv ? 1 : 0}:${flip ? 1 : 0}`;
    const o = { gait, frame: fr, head, mouth: this.mouth, bristle: this.bristle, pal: this.pers.pal, juv: this.juv, back: view === 'back' };
    const c = Sprites.get(k, () => {
      if (view === 'side') { const s = peccarySide(o); return flip ? flipCanvas(s) : s; }
      return peccaryFront(o);
    });
    return { c, view };
  }

  draw(ctx) {
    const g = this.g;
    const { c, view } = this.sprite();
    const juv = this.juv;
    ctx.globalAlpha = 0.28; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(this.x, this.y + 1, juv ? 5 : view === 'side' ? 8 : 6, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    const ay = view === 'side' ? (juv ? 10 : 13) : c.height - 1;
    const bob = this.state === S.DEFENSIVE && this.stateT < 0.25 ? -1 : 0;
    ctx.drawImage(c, Math.round(this.x - c.width / 2), Math.round(this.y - ay + bob));
    this.drawAware(ctx, Math.round(this.y - ay - 3));
    if (this.mouth && this.mouthT > 0 && view === 'side') {
      ctx.fillStyle = '#f4f0e0'; ctx.globalAlpha = 0.8;
      const hx = this.x + this.face * (juv ? 7 : 11), hy = this.y - ay + (juv ? 5 : 7);
      ctx.fillRect(Math.round(hx + this.face * 3), Math.round(hy - 3), 1, 1); ctx.fillRect(Math.round(hx + this.face * 4), Math.round(hy - 1), 1, 1);
      ctx.globalAlpha = 1;
    }
    void g;
  }

  drawAware(ctx, y) {
    const st = this.state, p = this.g.player;
    if (!p || dist(this.x, this.y, p.x, p.y) > 190) return;
    const x = Math.round(this.x);
    if (st === S.DEFENSIVE || st === S.CHASE) {
      ctx.fillStyle = '#ff5a3a'; ctx.fillRect(x, y - 7, 1, 4); ctx.fillRect(x, y - 2, 1, 1);
      ctx.fillStyle = '#3a0a04'; ctx.fillRect(x + 1, y - 7, 1, 4);
    } else if (st === S.ALERT || st === S.INVESTIGATE) {
      ctx.fillStyle = this.alertCause === 'player' ? '#ffd666' : '#f4f0e0';
      ctx.fillRect(x - 1, y - 7, 3, 1); ctx.fillRect(x + 1, y - 6, 1, 1); ctx.fillRect(x, y - 5, 1, 1); ctx.fillRect(x, y - 2, 1, 1);
    } else if (this.aware > 0.12) {
      // medidor discreto de desconfiança: ajuda o jogador a entender o que está acontecendo
      const k = clamp(this.aware / TUNE.alertAt, 0, 1);
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#1a140c'; ctx.fillRect(x - 4, y - 3, 8, 2);
      ctx.fillStyle = k > 0.7 ? '#ffb040' : '#f4ecd0'; ctx.fillRect(x - 4, y - 3, Math.max(1, Math.round(8 * k)), 2);
      ctx.globalAlpha = 1;
    }
  }
}

// ======================================================================
// Bando: rota, âncora, sentinela, chamados com atraso, coleira e caminhos
// ======================================================================
export class Herd {
  constructor(g, o) {
    this.g = g; this.id = o.id || 'herd';
    this.members = [];
    this.anchor = { x: o.x, y: o.y };
    this.route = o.route || [{ x: o.x, y: o.y }];
    this.routeIdx = 0;
    this.moveEvery = o.moveEvery || [38, 58];
    this.moveT = o.firstMove ?? this.moveEvery[0];
    this.moving = false; this.moveTo = null;
    this.spread = o.spread || 1;
    this.leash = o.leash || { x: o.x, y: o.y, r: 260 };
    this.blocked = o.blocked || null;
    this.safe = o.safe || null; // lugares onde o jogador fica fora do alcance (ex.: lajedo)
    this.occludes = o.occludes || null;
    this.chaseMul = o.chaseMul || 1;
    this.lostSight = o.lostSight || TUNE.lostSight;
    this.smellMul = o.smellMul || 1;
    this.aggression = o.aggression || 1;
    this.maxChasers = o.maxChasers || 5;
    this.walkMul = o.walkMul || 1;
    this.mercy = !!o.mercy;
    this.biteInterval = o.biteInterval ?? 0.9;
    this.ignorePlayer = !!o.ignorePlayer;
    this.biteDamage = o.biteDamage || TUNE.biteDamage;
    this.on = o.on || {};
    this.calls = [];
    this.mode = 'calm'; this.calmT = 0; this.episode = null;
    this.sentinelUp = false; this.sentinelT = 6;
    this.active = true; this.sleepDist = o.sleepDist || 760;
    this.flowP = new FlowField(g.world, { blocked: this.blocked, maxCells: o.flowCells || 9000 });
    this.flowH = new FlowField(g.world, { blocked: this.blocked, maxCells: o.flowCells || 9000 });
    this.biteMsgShown = false;
  }

  add(x, y, o = {}) { const m = new Peccary(this, x, y, o); this.members.push(m); return m; }

  calmPoint(m, live = false) {
    const a = this.anchor;
    const jit = live ? 0 : 1;
    return { x: a.x + m.slot.x * this.spread + (Math.random() - 0.5) * 18 * jit, y: a.y + m.slot.y * this.spread + (Math.random() - 0.5) * 12 * jit };
  }

  playerSafe() { const p = this.g.player; return !!(this.safe && p && this.safe(p.x, p.y)); }
  inLeash(x, y, k = 1) { const L = this.leash; return L.r === Infinity || dist(x, y, L.x, L.y) < L.r * k; }

  blockedBetween(ax, ay, bx, by) {
    if (!this.blocked) return false;
    const n = Math.ceil(dist(ax, ay, bx, by) / 6);
    for (let i = 1; i < n; i++) { const t = i / n; if (this.blocked(ax + (bx - ax) * t, ay + (by - ay) * t)) return true; }
    return false;
  }

  // direção de caminho: linha reta quando livre; campo de fluxo quando há obstáculos no meio
  pathDir(m, tx, ty, toPlayer, softOnly = false) {
    const d = dist(m.x, m.y, tx, ty);
    const direct = () => { const vx = tx - m.x, vy = ty - m.y, k = Math.hypot(vx, vy) || 1; return { x: vx / k, y: vy / k }; };
    if (d < 20) return direct();
    if (!m._pathT || this.g.time - m._pathT > 0.3) {
      m._pathT = this.g.time;
      m._clear = this.clearLine(m.x, m.y, tx, ty, m.r);
    }
    if (m._clear) return direct();
    const ff = toPlayer ? this.flowP : this.flowH;
    ff.compute(tx, ty, this.g.time, toPlayer ? 0.25 : 1.5);
    const fd = ff.dirAt(m.x, m.y);
    if (fd && !fd.arrived) return fd;
    return softOnly ? null : direct();
  }

  clearLine(ax, ay, bx, by, r) {
    const n = Math.ceil(dist(ax, ay, bx, by) / 6);
    const w = this.g.world;
    for (let i = 1; i <= n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      if (w.hit(x, y, r + 1) || circleBlocked(w, x, y, r + 1) || (this.blocked && this.blocked(x, y))) return false;
    }
    return true;
  }

  // chamados: o aviso chega aos outros com atraso proporcional à distância
  emit(from, level) {
    if (from.callCd > 0 && level < 2) return;
    from.callCd = level >= 2 ? 1.5 : 3.5;
    const sx = from.lastSeen ? from.lastSeen.x : from.stim ? from.stim.x : from.x;
    const sy = from.lastSeen ? from.lastSeen.y : from.stim ? from.stim.y : from.y;
    const now = this.g.time;
    for (const m of this.members) {
      if (m === from) continue;
      const d = dist(m.x, m.y, from.x, from.y);
      if (d > TUNE.callRadius * (level >= 2 ? 1.2 : 1)) continue;
      this.calls.push({ to: m, at: now + TUNE.callDelay * (0.6 + Math.random() * 0.8) + d / TUNE.callSpeed, level, sx, sy, cause: from.alertCause || 'noise', from });
    }
  }

  hearNoise(x, y, loud, kind = 'noise') {
    for (const m of this.members) {
      const d = dist(m.x, m.y, x, y);
      if (d > loud * 60) continue;
      const delay = d / 340 + Math.random() * 0.2;
      this.calls.push({ to: m, at: this.g.time + delay, direct: true, sx: x + (Math.random() - 0.5) * 8, sy: y + (Math.random() - 0.5) * 8, kind, loud: loud * (1 - d / (loud * 60)) });
    }
  }

  detected(m) {
    if (this.episode && this.episode.detected) return;
    if (!this.episode) this.episode = { t: this.g.time };
    this.episode.detected = true;
    this.on.detect?.(m, m.reason || m.reasonText(m.perc || { seen: true }));
  }
  chaseStarted(m) {
    if (!this.episode) this.episode = { t: this.g.time };
    if (!this.episode.chase) { this.episode.chase = true; this.on.chase?.(m); }
  }
  gaveUp(m, why) { this.on.giveUp?.(m, why); }
  bit(m) { this.on.bite?.(m); }
  biteMsg() {
    if (this.biteMsgShown) return null;
    this.biteMsgShown = true;
    return 'Mordida de queixada! Corra, esquive (Espaço) ou se afaste até o bando desistir.';
  }

  sfx(name, x, y, vol = 1, pitch = 1) {
    const p = this.g.player;
    if (!p) return;
    const d = dist(x, y, p.x, p.y);
    if (d > 340) return;
    this.g.audio.play(name, { pan: this.g.panOf(x), vol: vol * (1 - d / 340) * (d < 60 ? 1 : 0.85), pitch });
  }
  stamp(m) { if (Math.random() < 0.3) this.g.particles.add({ type: 'puff', x: m.x, y: m.y, vx: (Math.random() - 0.5) * 10, vy: -3, life: 0.5, color: '#8a7a5a' }); }
  dust(m) { for (let i = 0; i < 3; i++) this.g.particles.add({ type: 'puff', x: m.x + m.face * 8, y: m.y, vx: (Math.random() - 0.5) * 8, vy: -2, life: 0.6, color: '#7a6a4a' }); }

  counts() {
    const c = { calm: 0, alert: 0, defensive: 0, chase: 0, ret: 0, moving: 0 };
    for (const m of this.members) {
      if (CALM.has(m.state)) c.calm++;
      else if (m.state === S.ALERT || m.state === S.INVESTIGATE) c.alert++;
      else if (m.state === S.DEFENSIVE) c.defensive++;
      else if (m.state === S.CHASE) c.chase++;
      else c.ret++;
      if (m.speed > 6) c.moving++;
    }
    return c;
  }

  update(dt) {
    const g = this.g, p = g.player;
    if (!p) return;
    // longe do jogador e calmo: dorme (economiza processamento)
    const nearest = this.members.reduce((a, m) => Math.min(a, dist(m.x, m.y, p.x, p.y)), Infinity);
    this.active = nearest < this.sleepDist || this.mode !== 'calm';
    if (!this.active) return;

    // entrega os chamados que chegaram
    for (let i = this.calls.length - 1; i >= 0; i--) {
      const c = this.calls[i];
      if (g.time < c.at) continue;
      this.calls.splice(i, 1);
      if (c.direct) {
        const m = c.to;
        if (c.kind === 'shot') { m.aware = Math.max(m.aware, 0.95); m.alertCause = 'player'; m.lastSeen = { x: c.sx, y: c.sy }; m.lastPerceivedT = g.time; if (m.state !== S.CHASE) m.enter(S.DEFENSIVE); }
        else m.hear(c.sx, c.sy, c.loud, c.kind);
      } else c.to.receiveCall(c);
    }

    // rota de pastoreio: o bando muda de lugar de tempos em tempos
    if (this.mode === 'calm') {
      if (!this.moving) {
        this.moveT -= dt;
        if (this.moveT <= 0 && this.route.length > 1) {
          this.routeIdx = (this.routeIdx + 1) % this.route.length;
          this.moveTo = this.route[this.routeIdx];
          this.moving = true;
          this.on.move?.(this.moveTo);
        }
      } else {
        const dx = this.moveTo.x - this.anchor.x, dy = this.moveTo.y - this.anchor.y, d = Math.hypot(dx, dy);
        // a âncora não se afasta dos animais (o bando anda junto)
        let lag = 0;
        for (const m of this.members) lag = Math.max(lag, dist(m.x, m.y, this.anchor.x + m.slot.x * this.spread, this.anchor.y + m.slot.y * this.spread));
        const sp = TUNE.walkSpeed * 0.75 * this.walkMul * (lag > 40 ? 0.2 : 1);
        if (d < 2) { this.moving = false; this.moveT = this.moveEvery[0] + Math.random() * (this.moveEvery[1] - this.moveEvery[0]); this.on.arrive?.(this.moveTo); }
        else { this.anchor.x += dx / d * Math.min(d, sp * dt); this.anchor.y += dy / d * Math.min(d, sp * dt); }
      }
      // sentinela: de tempos em tempos, levanta a cabeça e vigia
      this.sentinelT -= dt;
      if (this.sentinelT <= 0) { this.sentinelUp = !this.sentinelUp; this.sentinelT = this.sentinelUp ? 5 + Math.random() * 3 : 9 + Math.random() * 8; }
    }

    for (const m of this.members) m.update(dt);

    // distância mínima entre os animais (correção suave)
    for (let i = 0; i < this.members.length; i++) for (let j = i + 1; j < this.members.length; j++) {
      const a = this.members[i], b = this.members[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d < TUNE.minGap && d > 0.01) {
        const push = (TUNE.minGap - d) / 2, ux = dx / d * push, uy = dy / d * push;
        if (!a.blockedAt(a.x - ux, a.y - uy)) { a.x -= ux; a.y -= uy; }
        if (!b.blockedAt(b.x + ux, b.y + uy)) { b.x += ux; b.y += uy; }
      }
    }

    // modo do bando
    const c = this.counts();
    const prev = this.mode;
    this.mode = c.chase ? 'chase' : c.defensive ? 'alarmed' : c.alert || c.ret ? 'suspicious' : 'calm';
    if (this.mode === 'calm') {
      this.calmT += dt;
      if (this.episode && this.calmT > 2.5) { const ep = this.episode; this.episode = null; this.biteMsgShown = false; this.on.calm?.(ep); }
    } else this.calmT = 0;
    if (prev !== this.mode) this.on.mode?.(this.mode, prev);
  }

  // bichos que estão vendo o jogador agora (para a interface e para as missões)
  watchers() { return this.members.filter((m) => m.perc && (m.perc.seen || m.perc.heard > 0.3)); }
}
