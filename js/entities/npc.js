// Moradores da comunidade
import { dist, dirFromVec } from '../core/util.js';
import { Sprites } from '../gfx/sprites.js';
import { humanSprite, LOOKS } from '../gfx/art-characters.js';

export class NPC {
  constructor(g, id, name, look, x, y, dir = 'down') {
    this.g = g; this.id = id; this.name = name; this.look = look;
    this.x = x; this.y = y; this.dir = dir; this.baseDir = dir; this.frame = 0; this.r = 4;
    this.talked = false; this.bob = Math.random() * 10;
    g.world.addCollider({ x, y, r: 4, dyn: true });
  }
  update(dt) {
    const p = this.g.player;
    const d = dist(this.x, this.y, p.x, p.y);
    if (d < 46) this.dir = dirFromVec(p.x - this.x, p.y - this.y);
    else this.dir = this.baseDir;
    this.bob += dt;
  }
  draw(ctx) {
    const s = Sprites.get(`h:${this.look}:${this.dir}:0:0`, () => humanSprite(LOOKS[this.look], this.dir, 0, false));
    ctx.globalAlpha = 0.28; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(this.x, this.y + 1, 6, 2.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.drawImage(s, Math.round(this.x - 9), Math.round(this.y - 25));
  }
}
