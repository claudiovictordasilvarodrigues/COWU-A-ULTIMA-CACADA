// Câmera suave com antecipação, zoom dramático, tremor e panorâmicas roteirizadas
import { lerp, clamp, easeInOut } from '../core/util.js';

export class Camera {
  constructor() {
    this.x = 0; this.y = 0; this.zoom = 1; this.targetZoom = 1;
    this.shakeT = 0; this.shakeI = 0; this.sx = 0; this.sy = 0;
    this.follow = null; this.pan = null; this.lookX = 0; this.lookY = 0;
    this.viewW = 320; this.viewH = 240;
  }
  shake(i = 2, t = 0.3) { this.shakeI = Math.max(this.shakeI, i); this.shakeT = Math.max(this.shakeT, t); }
  panTo(x, y, dur = 1.5) {
    return new Promise((res) => { this.pan = { fx: this.x, fy: this.y, tx: x, ty: y, t: 0, dur, res }; });
  }
  release() { this.pan = null; }
  update(dt, world, enableShake = true) {
    // panorâmica terminada + alguém para seguir: volta a acompanhar (antes a câmera ficava presa)
    if (this.pan && !this.pan.res && this.pan.t >= this.pan.dur && this.follow) this.pan = null;
    if (this.pan) {
      const p = this.pan;
      p.t = Math.min(p.dur, p.t + dt);
      const k = easeInOut(p.t / p.dur);
      this.x = lerp(p.fx, p.tx, k); this.y = lerp(p.fy, p.ty, k);
      if (p.t >= p.dur && p.res) { const r = p.res; p.res = null; r(); }
    } else if (this.follow) {
      const f = this.follow;
      this.lookX = lerp(this.lookX, (f.vx || 0) * 0.35, Math.min(1, dt * 2));
      this.lookY = lerp(this.lookY, (f.vy || 0) * 0.35, Math.min(1, dt * 2));
      const tx = f.x + this.lookX, ty = f.y - 8 + this.lookY;
      const k = 1 - Math.pow(0.0025, dt);
      this.x = lerp(this.x, tx, k); this.y = lerp(this.y, ty, k);
    }
    this.zoom = lerp(this.zoom, this.targetZoom, 1 - Math.pow(0.05, dt));
    if (world) {
      const hw = this.viewW / 2, hh = this.viewH / 2;
      this.x = world.W > this.viewW ? clamp(this.x, hw, world.W - hw) : world.W / 2;
      this.y = world.H > this.viewH ? clamp(this.y, hh, world.H - hh) : world.H / 2;
    }
    if (this.shakeT > 0 && enableShake) {
      this.shakeT -= dt;
      const i = this.shakeI * Math.min(1, this.shakeT * 4);
      this.sx = (Math.random() * 2 - 1) * i; this.sy = (Math.random() * 2 - 1) * i;
    } else { this.sx = this.sy = 0; this.shakeI = 0; }
  }
}
