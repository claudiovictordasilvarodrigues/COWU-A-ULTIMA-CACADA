// Caetano: movimento, corrida, agachar, esquiva, energia, lanterna, ruído e visibilidade
import { clamp, lerp, dirFromVec, DIR_VEC } from '../core/util.js';
import { Sprites } from '../gfx/sprites.js';
import { humanSprite, LOOKS } from '../gfx/art-characters.js';

export class Player {
  constructor(g, x, y) {
    this.g = g; this.x = x; this.y = y; this.r = 4;
    this.vx = 0; this.vy = 0; this.dir = 'down'; this.frame = 0; this.anim = 0;
    this.hp = 100; this.en = 100; this.battery = 100;
    this.sneak = false; this.running = false; this.exhausted = false;
    this.dodgeT = 0; this.dodgeCd = 0; this.dodgeVX = 0; this.dodgeVY = 0;
    this.lantern = false; this.aiming = false; this.aimToggle = false; this.aimAngle = Math.PI / 2;
    this.noise = 0; this.noiseSpike = 0; this.vis = 1; this.hurtT = 0; this.invuln = 0;
    this.stepAcc = 0; this.locked = false; this.moving = false; this.inBush = false;
    this.forceCrouch = false;
    this.speedMul = 1; // fases podem reduzir a velocidade (ex.: barro grudado na bota)
  }

  noiseRadius() { return Math.max(this.noise, this.noiseSpike) * 170; }
  makeNoise(v) { this.noiseSpike = Math.max(this.noiseSpike, v); }

  hurt(n, msg) {
    if (this.invuln > 0 || this.hurtT > 0) return;
    this.hp = clamp(this.hp - n, 0, 100);
    this.hurtT = 0.9;
    this.g.audio.play('hurt');
    this.g.camera.shake(1.5, 0.25);
    if (msg) this.g.ui.toast(msg, 'warn');
  }

  toggleLantern() {
    const g = this.g;
    if (!g.inv.has('lanterna')) { g.ui.toast('Você ainda não pegou a lanterna.', 'tip'); return; }
    if (!this.lantern && this.battery <= 0) { g.ui.toast('A bateria acabou. Procure pilhas.', 'warn'); g.audio.play('click'); return; }
    this.lantern = !this.lantern;
    g.audio.play('lantern');
  }

  update(dt) {
    const g = this.g, inp = g.input, w = g.world;
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.noiseSpike = Math.max(0, this.noiseSpike - dt * 1.2);

    if (this.lantern) {
      this.battery = Math.max(0, this.battery - dt / 3.2);
      if (this.battery <= 0) { this.lantern = false; g.ui.toast('A lanterna apagou: sem bateria.', 'warn'); }
    }

    if (this.locked) {
      this.vx = this.vy = 0; this.moving = false; this.frame = 0;
      this.noise = lerp(this.noise, 0, Math.min(1, dt * 4));
      return;
    }

    if (inp.pressed('sneak')) { this.sneak = !this.sneak; g.ui.flashStance(); }
    if (inp.pressed('lantern')) this.toggleLantern();
    if (inp.pressed('aim') && inp.lastDevice === 'touch') this.aimToggle = !this.aimToggle;
    const hasGun = g.inv.has('espingarda');
    this.aiming = hasGun && (inp.isDown('aim') && inp.lastDevice !== 'touch' || this.aimToggle);

    const a = inp.axis();
    const surface = w.surfaceAt(this.x, this.y);
    let speed = 54;
    this.running = inp.isDown('run') && a.m > 0 && !this.exhausted && !this.aiming;
    if (this.running) { speed = 94; this.sneak = false; }
    else if (this.sneak) speed = 27;
    if (this.exhausted) speed *= 0.75;
    if (this.aiming) speed *= 0.5;
    if (surface === 'mud') speed *= 0.6;
    else if (surface === 'sand') speed *= 0.9;
    else if (surface === 'water') speed *= 0.72;
    speed *= this.speedMul ?? 1;

    // mira
    if (this.aiming) {
      const m = inp.mouse;
      if (inp.lastDevice === 'mouse' && m.inside) {
        const s = g.renderer.worldToScreen(this.x, this.y - 10);
        this.aimAngle = Math.atan2(m.y - s.y, m.x - s.x);
      } else if (a.m > 0) this.aimAngle = Math.atan2(a.y, a.x);
      else { const v = DIR_VEC[this.dir]; this.aimAngle = Math.atan2(v[1], v[0]); }
    }

    // esquiva / tiro
    if (inp.pressed('dodge') || (this.aiming && inp.pressed('click'))) {
      if (this.aiming) g.shoot(this);
      else if (this.dodgeCd <= 0 && this.en >= 12 && inp.pressed('dodge')) {
        const v = a.m > 0 ? [a.x, a.y] : DIR_VEC[this.dir];
        this.dodgeVX = v[0]; this.dodgeVY = v[1]; this.dodgeT = 0.22; this.dodgeCd = 0.55;
        this.en -= 14; this.invuln = 0.3; this.makeNoise(0.75);
        g.audio.play('dodge');
        for (let i = 0; i < 6; i++) g.particles.add({ type: 'puff', x: this.x + (Math.random() - 0.5) * 6, y: this.y, vx: -v[0] * 20, vy: -v[1] * 20, life: 0.4, color: '#b8a888' });
      }
    }

    let tvx, tvy;
    if (this.dodgeT > 0) {
      this.dodgeT -= dt;
      tvx = this.dodgeVX * 190; tvy = this.dodgeVY * 190;
      this.vx = tvx; this.vy = tvy;
    } else {
      tvx = a.x * speed * a.m; tvy = a.y * speed * a.m;
      const k = 1 - Math.pow(0.0005, dt);
      this.vx = lerp(this.vx, tvx, k); this.vy = lerp(this.vy, tvy, k);
    }
    const ox = this.x, oy = this.y;
    w.moveCircle(this, this.vx * dt, this.vy * dt, this.r);
    const moved = Math.hypot(this.x - ox, this.y - oy);
    this.moving = moved > 0.15;

    if (this.aiming) {
      this.dir = dirFromVec(Math.cos(this.aimAngle), Math.sin(this.aimAngle));
    } else if (a.m > 0) this.dir = dirFromVec(a.x, a.y);

    if (this.moving) {
      this.anim += dt * (this.running ? 11 : this.sneak ? 4.5 : 7.5);
      this.frame = Math.floor(this.anim) % 4;
      this.stepAcc += moved;
      const stepLen = this.running ? 14 : this.sneak ? 8 : 10;
      if (this.stepAcc > stepLen) {
        this.stepAcc = 0;
        const vol = this.running ? 1 : this.sneak ? 0.3 : 0.65;
        g.audio.play('step', { surface, vol });
        if (surface === 'mud' || surface === 'water') g.particles.add({ type: 'ripple', x: this.x, y: this.y, life: 0.6, r1: 5, color: '#8a7a5a' });
        else if (this.running && (surface === 'dirt' || surface === 'sand')) g.particles.add({ type: 'puff', x: this.x, y: this.y, vx: -this.vx * 0.1, vy: -2, life: 0.5, color: '#c8b088' });
        if (this.running && surface === 'leaves' && Math.random() < 0.4) g.particles.add({ type: 'leaf', x: this.x, y: this.y, z: 2, vx: (Math.random() - 0.5) * 20, vy: 0, life: 1.2, seed: Math.random() * 9, color: '#8a6a34' });
      }
    } else { this.frame = 0; this.anim = 0; }

    // ruído
    const sf = { leaves: 1.15, grass: 0.85, wood: 1.25, mud: 1, water: 1.2, sand: 0.8, dirt: 0.9 }[surface] || 1;
    let target = 0;
    if (this.dodgeT > 0) target = 0.8;
    else if (this.moving) target = (this.running ? 1 : this.sneak ? 0.13 : 0.42) * sf;
    this.noise = lerp(this.noise, target, Math.min(1, dt * 6));

    // visibilidade
    this.inBush = g.isInCover(this.x, this.y);
    let vis = 1;
    if (this.sneak) vis *= 0.6;
    if (!this.moving) vis *= 0.6;
    if (this.inBush) vis *= 0.4;
    if (this.lantern && g.darkness > 0.3) vis = Math.min(1, vis + 0.35);
    this.vis = vis;

    // energia
    if (this.running) this.en -= 11 * dt;
    else this.en += (this.moving ? (this.sneak ? 3 : 2) : 5) * dt;
    this.en = clamp(this.en, 0, 100);
    if (this.en <= 0 && !this.exhausted) { this.exhausted = true; g.ui.toast('Caetano está exausto. Ande devagar ou beba água (tecla 1).', 'warn'); }
    if (this.exhausted && this.en >= 25) this.exhausted = false;
  }

  sprite() {
    const crouch = this.sneak || this.forceCrouch;
    const key = `h:caetano:${this.dir}:${this.frame}:${crouch ? 1 : 0}`;
    return Sprites.get(key, () => humanSprite(LOOKS.caetano, this.dir, this.frame, crouch));
  }

  draw(ctx) {
    const s = this.sprite();
    ctx.globalAlpha = 0.28; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(this.x, this.y + 1, 6, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    if (this.hurtT > 0 && Math.floor(this.hurtT * 14) % 2 === 0) ctx.globalAlpha = 0.45;
    if (this.dodgeT > 0) { ctx.globalAlpha = 0.3; ctx.drawImage(s, Math.round(this.x - 9 - this.dodgeVX * 8), Math.round(this.y - 25 - this.dodgeVY * 8)); ctx.globalAlpha = 1; }
    ctx.drawImage(s, Math.round(this.x - 9), Math.round(this.y - 25));
    ctx.globalAlpha = 1;
  }
}
