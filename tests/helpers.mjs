// Utilitários dos testes: mundo e "jogo" mínimos, sem DOM, para exercitar a lógica real
import { World, T } from '../js/engine/world.js';
import { Particles } from '../js/engine/particles.js';
import { clamp } from '../js/core/util.js';

export function makeWorld(tw = 60, th = 40, fill = T.FLOOR) {
  const w = new World(tw, th);
  w.generate(() => [fill]);
  return w;
}

export class FakePlayer {
  constructor(g, x, y) {
    this.g = g; this.x = x; this.y = y; this.r = 4; this.vx = 0; this.vy = 0;
    this.hp = 100; this.en = 100; this.noise = 0; this.noiseSpike = 0; this.vis = 1;
    this.sneak = false; this.running = false; this.moving = false; this.invuln = 0; this.dodgeT = 0; this.hurtT = 0; this.dir = 'down';
    this.forceCrouch = false; this.locked = false; this.hidden = false; this.battery = 100;
  }
  noiseRadius() { return Math.max(this.noise, this.noiseSpike) * 170; }
  makeNoise(v) { this.noiseSpike = Math.max(this.noiseSpike, v); }
  hurt(n) { if (this.invuln > 0 || this.hurtT > 0) return; this.hp = clamp(this.hp - n, 0, 100); this.hurtT = 0.9; }
  // define o "modo" do jogador como o Player real calcularia
  setMode(mode) {
    this.sneak = mode === 'sneak'; this.running = mode === 'run'; this.moving = mode !== 'still';
    const sf = 1.15;
    this.noise = mode === 'run' ? 1 * sf : mode === 'walk' ? 0.42 * sf : mode === 'sneak' ? 0.13 * sf : 0;
    let vis = 1; if (this.sneak) vis *= 0.6; if (!this.moving) vis *= 0.6; this.vis = vis;
  }
  step(dt) { this.hurtT = Math.max(0, this.hurtT - dt); this.invuln = Math.max(0, this.invuln - dt); this.noiseSpike = Math.max(0, this.noiseSpike - dt * 1.2); }
}

export function makeGame(world, px = 100, py = 100) {
  const g = {
    world, time: 0, state: 'play', particles: new Particles(),
    wind: { a: 0 }, sounds: [],
    audio: { play(n, o) { g.sounds.push(n); }, setMood() {}, setDuck() {} },
    camera: { shake() {} },
    ui: { toast() {}, caption() {}, alert() {}, clearAlert() {} },
    panOf: () => 0,
    isDownwind(p, a) { const dx = a.x - p.x, dy = a.y - p.y, d = Math.hypot(dx, dy) || 1; return (dx / d) * Math.cos(g.wind.a) + (dy / d) * Math.sin(g.wind.a) > 0.72; },
  };
  g.player = new FakePlayer(g, px, py);
  return g;
}

// executa a simulação em passos fixos
export function run(g, herds, seconds, each) {
  const dt = 1 / 30;
  for (let t = 0; t < seconds; t += dt) {
    g.time += dt;
    g.player.step(dt);
    if (each && each(dt, t) === false) return t;
    for (const h of herds) h.update(dt);
  }
  return seconds;
}

// ---------- jogo falso completo para testar a lógica da Fase 2 sem navegador ----------
import { Inventory } from '../js/data/items.js';
export function makeFakeGame() {
  const g = {
    time: 0, state: 'play', flags: {}, done: new Set(), inv: new Inventory(), res: { water: 2, food: 2, ammo: 5 }, tracksKnown: new Set(),
    entities: [], airEntities: [], updaters: [], animals: [], interactables: [], triggers: [], hazards: [], lights: [], npcs: [],
    particles: new Particles(), wind: { a: 0, base: 0 }, timeLeft: 2400, stats: {}, checkpoints: [], toasts: [], alerts: [], fade: 0, letterbox: 0,
    camera: { x: 0, y: 0, follow: null, targetZoom: 1, viewW: 320, viewH: 240, shake() {}, panTo: async () => {} },
    audio: { mood: 'calm', play() {}, setMood(m) { this.mood = m; }, setDuck() {}, musicOn: true },
    ui: { toast: (t) => g.toasts.push(t), caption() {}, alert: (t) => g.alerts.push(t), clearAlert() {}, titleCard() {}, results: (rows, info) => { g.resultsShown = { rows, info }; }, intro: async () => {} },
    say: async () => {}, choice: async () => 0, wait: async () => {}, tween: async (o, k, to) => { o[k] = to; }, moveTo: async (e, x, y) => { e.x = x; e.y = y; },
    async run(fn) { const prev = g.state; g.state = 'cutscene'; try { await fn(); } finally { if (g.state === 'cutscene') g.state = prev; } },
    complete(id) { if (g.done.has(id)) return false; g.done.add(id); return true; },
    checkpoint(label) { g.checkpoints.push(label); },
    give(id, n = 1) { return g.inv.add(id, n); },
    caption() {}, panOf: () => 0,
    isDownwind(p, a) { const dx = a.x - p.x, dy = a.y - p.y, d = Math.hypot(dx, dy) || 1; return (dx / d) * Math.cos(g.wind.a) + (dy / d) * Math.sin(g.wind.a) > 0.72; },
    isInCover(x, y) { return g.phase ? g.phase.isInCover(x, y) : false; },
  };
  return g;
}

export async function makePhase2(fromCarry = null) {
  const { createPhase2 } = await import('../js/phases/phase2.js');
  const g = makeFakeGame();
  const ph = createPhase2(g);
  g.phase = ph;
  await ph.buildStatic(async () => {});
  g.world = ph.world;
  const d = ph.carryIn({ carry: fromCarry });
  g.inv.load(d.inv); Object.assign(g.res, d.res); g.tracksKnown = new Set(d.tracks);
  g.player = new FakePlayer(g, ph.spawn.x, ph.spawn.y);
  ph.setupDynamic(false);
  // passo de simulação do jogo: atualizadores + fase + gatilhos
  g.step = (dt = 1 / 30) => {
    g.time += dt; g.player.step(dt);
    for (const u of g.updaters) u.update(dt);
    ph.update(dt);
    if (g.state === 'play') for (const t of g.triggers) {
      if (t.fired || (t.cond && !t.cond())) continue;
      const p = g.player;
      const inside = t.r ? Math.hypot(t.x - p.x, t.y - p.y) < t.r : (p.x >= t.x && p.x <= t.x + t.w && p.y >= t.y && p.y <= t.y + t.h);
      if (inside) { if (t.once !== false) t.fired = true; t.fn(); }
    }
  };
  g.sim = (sec, until) => { for (let t = 0; t < sec; t += 1 / 30) { if (until && until()) return true; g.step(); } return until ? !!until() : true; };
  g.tpTile = (tx, ty) => { g.player.x = tx * 16; g.player.y = ty * 16; };
  return { g, ph };
}

// ---------- Fase 3 ----------
export async function makePhase3(fromCarry = null) {
  const { createPhase3 } = await import('../js/phases/phase3.js');
  const g = makeFakeGame();
  g.tod = 830; g.darkness = 0; g.sun = { strength: 1, dx: -1, dy: 0.2 }; g.tint = [0, 0, 0, 0]; g.ambientColor = [0, 0, 0]; g.flash = 0; g.vignette = 0.45;
  g.input = { down: new Set(), joy: { active: false, x: 0, y: 0 }, isDown(a) { return this.down.has(a); }, pressed() { return false; }, lastDevice: 'keyboard' };
  g.ui.toast = (t) => g.toasts.push(t);
  const ph = createPhase3(g);
  g.phase = ph;
  await ph.buildStatic(async () => {});
  g.world = ph.world;
  const d = ph.carryIn({ carry: fromCarry });
  g.inv.load(d.inv); Object.assign(g.res, d.res); g.tracksKnown = new Set(d.tracks);
  g.player = new FakePlayer(g, ph.spawn.x, ph.spawn.y);
  g.entities.push(g.player);
  ph.setupDynamic(false);
  g.step = (dt = 1 / 30) => {
    g.time += dt; g.player.step(dt);
    for (const u of g.updaters) u.update(dt);
    ph.update(dt);
    if (g.state === 'play') for (const t of g.triggers) {
      if (t.fired || (t.cond && !t.cond())) continue;
      const p = g.player;
      const inside = t.r ? Math.hypot(t.x - p.x, t.y - p.y) < t.r : (p.x >= t.x && p.x <= t.x + t.w && p.y >= t.y && p.y <= t.y + t.h);
      if (inside) { if (t.once !== false) t.fired = true; t.fn(); }
    }
  };
  g.sim = (sec, until) => { for (let t = 0; t < sec; t += 1 / 30) { if (until && until()) return true; g.step(); } return until ? !!until() : true; };
  g.tpTile = (tx, ty) => { g.player.x = tx * 16; g.player.y = ty * 16; };
  g.fail = (t) => { g.state = 'fail'; g.failed = t; };
  return { g, ph };
}
