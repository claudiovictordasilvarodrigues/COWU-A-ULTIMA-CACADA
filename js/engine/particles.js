// Sistema de partículas: folhas, poeira em fachos de luz, vaga-lumes, respingos, fumaça, brilhos
export class Particles {
  constructor() { this.list = []; this.max = 700; }
  add(p) {
    if (this.list.length >= this.max) return;
    p.life = p.life ?? 1; p.t = 0; p.vx = p.vx || 0; p.vy = p.vy || 0; p.z = p.z || 0;
    this.list.push(p);
  }
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.t += dt;
      if (p.t >= p.life) { L[i] = L[L.length - 1]; L.pop(); continue; }
      switch (p.type) {
        case 'leaf':
          p.x += (p.vx + Math.sin(p.t * 3 + p.seed) * 10) * dt; p.y += p.vy * dt;
          p.z = Math.max(0, p.z - 9 * dt);
          if (p.z === 0) { p.vx *= 0.9; p.vy = 0; }
          break;
        case 'firefly':
          p.x += Math.sin(p.t * 1.3 + p.seed) * 8 * dt; p.y += Math.cos(p.t * 1.7 + p.seed) * 6 * dt;
          break;
        case 'dust':
          p.x += p.vx * dt + Math.sin(p.t + p.seed) * 2 * dt; p.y += p.vy * dt;
          break;
        case 'smoke':
          p.x += (p.vx + Math.sin(p.t * 2 + p.seed) * 4) * dt; p.y += p.vy * dt; p.vy *= 0.995;
          break;
        default:
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.g) p.vy += p.g * dt;
          if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; }
      }
    }
  }
  draw(ctx, vx0, vy0, vx1, vy1, darkness) {
    for (const p of this.list) {
      if (p.x < vx0 - 10 || p.x > vx1 + 10 || p.y < vy0 - 30 || p.y > vy1 + 10) continue;
      const k = p.t / p.life;
      switch (p.type) {
        case 'leaf': {
          ctx.globalAlpha = Math.min(1, (1 - k) * 3);
          ctx.fillStyle = p.color;
          const flip = Math.sin(p.t * 6 + p.seed) > 0;
          ctx.fillRect(Math.round(p.x), Math.round(p.y - p.z), flip ? 2 : 1, flip ? 1 : 2);
          break;
        }
        case 'firefly': {
          const a = (0.5 + 0.5 * Math.sin(p.t * 4 + p.seed)) * Math.min(1, (1 - k) * 4) * darkness;
          ctx.globalAlpha = a; ctx.fillStyle = '#e8ff8a';
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
          ctx.globalAlpha = a * 0.3; ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 3);
          break;
        }
        case 'dust':
          ctx.globalAlpha = Math.sin(k * Math.PI) * 0.6 * (p.a || 1); ctx.fillStyle = '#fff4c8';
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
          break;
        case 'smoke':
          ctx.globalAlpha = (1 - k) * 0.25; ctx.fillStyle = '#c8c4bc';
          { const s = 2 + k * 6; ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s); }
          break;
        case 'splash':
          ctx.globalAlpha = 1 - k; ctx.fillStyle = p.color || '#d8e8f0';
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
          break;
        case 'ripple': {
          ctx.globalAlpha = (1 - k) * 0.55; ctx.strokeStyle = p.color || '#d8e4e8'; ctx.lineWidth = 1;
          const r = (p.r0 || 2) + k * (p.r1 || 10);
          ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case 'spark':
          ctx.globalAlpha = 1 - k; ctx.fillStyle = p.color || '#ffd860';
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
          break;
        case 'puff':
          ctx.globalAlpha = (1 - k) * 0.6; ctx.fillStyle = p.color || '#e8e4dc';
          { const s = 2 + k * 10; ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s); }
          break;
      }
    }
    ctx.globalAlpha = 1;
  }
  lights() { return this.list.filter((p) => p.type === 'firefly'); }
}
