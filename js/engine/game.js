// Núcleo do jogo: laço principal, estados, cronômetro, roteiro (cutscenes), interação,
// iluminação por horário, vento, salvamento e integração com a fase atual
import { clamp, lerp, dist, DIR_VEC } from '../core/util.js';
import { Input } from '../core/input.js';
import { AudioEngine } from '../core/audio.js';
import { Save } from '../core/save.js';
import { Camera } from './camera.js';
import { Renderer } from './renderer.js';
import { Particles } from './particles.js';
import { Player } from '../entities/player.js';
import { Inventory, ITEMS } from '../data/items.js';
import { UI } from '../ui/ui.js';
import { Sprites } from '../gfx/sprites.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

// quadros-chave de luz do amanhecer (minutos desde 0h)
const LIGHT_KEYS = [
  [290, 0.8, [10, 14, 36], [70, 90, 170, 0.35], 0],
  [320, 0.7, [14, 16, 42], [100, 90, 170, 0.32], 0],
  [345, 0.58, [26, 20, 46], [190, 110, 150, 0.3], 0.05],
  [362, 0.42, [40, 24, 42], [240, 140, 100, 0.3], 0.2],
  [382, 0.24, [48, 28, 32], [255, 168, 90, 0.27], 0.45],
  [405, 0.1, [40, 28, 28], [255, 196, 120, 0.2], 0.7],
  [435, 0.03, [30, 24, 24], [255, 226, 168, 0.1], 0.85],
  [480, 0.0, [0, 0, 0], [255, 255, 255, 0], 1],
];

export class Game {
  // phases: { 1: createPhase1, 2: createPhase2, ... } (aceita também uma única função, como antes)
  constructor(phases) {
    this.registry = typeof phases === 'function' ? { 1: phases } : phases;
    this.built = {};
    this.canvas = document.getElementById('game');
    this.input = new Input(this.canvas);
    this.audio = new AudioEngine();
    this.settings = Save.loadSettings();
    this.camera = new Camera();
    this.renderer = new Renderer(this, this.canvas);
    this.particles = new Particles();
    this.state = 'loading';
    this.time = 0; this.last = 0;
    this.resetSessionVars();
    this.ui = new UI(this);
    this.applySettings();
    this.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (this.touch) { document.body.classList.add('touch-ui'); this.input.lastDevice = 'touch'; }
    this.input.bindTouch(document.getElementById('touch'));
    window.addEventListener('resize', () => this.renderer.resize());
    new ResizeObserver(() => this.renderer.resize()).observe(document.getElementById('stage'));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'play') this.openOverlay('pause');
      if (document.hidden) this.audio.setPaused(true); else if (this.state === 'play') this.audio.setPaused(false);
    });
    window.addEventListener('pointerdown', () => this.audio.init(), { once: true });
    window.addEventListener('keydown', () => this.audio.init(), { once: true });
  }

  resetSessionVars() {
    this.entities = []; this.airEntities = []; this.npcs = []; this.animals = []; this.updaters = [];
    this.interactables = []; this.triggers = []; this.lights = []; this.hazards = [];
    this.done = new Set(); this.flags = {}; this.inv = new Inventory(); this.res = { water: 0, food: 3, ammo: 5 };
    this.tracksKnown = new Set();
    this.wind = { a: 0.5, base: 0.5, t: 0 };
    this.sun = { dx: -1.4, dy: 0.25, strength: 0 };
    this.darkness = 0.8; this.canopyDark = 0.3; this.tint = [70, 90, 170, 0.3]; this.ambientColor = [10, 14, 36];
    this.letterbox = 0; this.fade = 0; this.flash = 0; this.vignette = 0.45;
    this.soundCues = []; this.focus = null; this.sleepers = []; this.tweens = []; this.movers = [];
    this.stats = { tracksWrong: 0, startedAt: 0 };
  }

  applySettings() {
    const s = this.settings;
    Object.assign(this.audio.vol, { master: s.master, music: s.music, sfx: s.sfx, amb: s.amb });
    this.audio.applyVolumes();
    Save.saveSettings(s);
  }
  hasSave() { return Save.has(); }

  async boot() {
    this.renderer.resize();
    requestAnimationFrame((t) => this.frame(t));
    this.ui.loading(0.05, 'Afiando o facão…');
    await nextFrame();
    await Sprites.loadManifest();
    // abre o jogo na fase em que o jogador parou (o menu mostra esse cenário ao fundo)
    let first = Save.progress().last || 1;
    if (!this.registry[first] || !Save.isUnlocked(first)) first = 1;
    await this.loadPhase(first, false);
    this.ui.loading(1, 'Pronto.');
    await nextFrame();
    this.toMenu();
  }

  // ---------- fases ----------
  hasPhase(id) { return !!this.registry[id]; }
  async loadPhase(id, showLoading = true) {
    if (this.phase && this.phase.id === id && this.world) return this.phase;
    if (!this.registry[id]) throw new Error('Fase não implementada: ' + id);
    const prevState = this.state;
    this.state = 'loading';
    if (showLoading) { this.ui.showScreen('loading'); this.ui.loading(0.02, 'Seguindo o rastro…'); await nextFrame(); }
    let ph = this.built[id];
    if (!ph) {
      ph = this.registry[id](this);
      await ph.buildStatic(async (p, m) => { this.ui.loading(p, m); await nextFrame(); });
      this.built[id] = ph;
    }
    this.phase = ph; this.world = ph.world;
    this.player = null; this.lastCheckpoint = null;
    this.ui.setPhase(ph);
    if (showLoading) { this.ui.loading(1, 'Pronto.'); await nextFrame(); }
    void prevState; // quem chamou decide o próximo estado (menu, introdução ou jogo)
    return ph;
  }

  // ---------- sessões ----------
  startSession(data) {
    this.resetSessionVars();
    this.world.clearDynamic();
    this.ui.hideDialog();
    const ph = this.phase;
    this.timeLeft = ph.timeLimit;
    this.tod = ph.todStart; this.todTarget = ph.todStart;
    let pos = ph.spawn;
    if (data && !data.cp && ph.carryIn) data = ph.carryIn(data);
    if (data) {
      this.done = new Set(data.done || []);
      this.flags = data.flags || {};
      this.inv.load(data.inv);
      this.res = Object.assign(this.res, data.res || {});
      this.tracksKnown = new Set(data.tracks || []);
      this.tod = this.todTarget = data.tod || ph.todStart;
      if (data.cp) pos = data.cp;
      this.timeLeft = data.timeLeft ?? ph.timeLimit;
    }
    this.player = new Player(this, pos.x, pos.y);
    if (data && data.player) Object.assign(this.player, { hp: data.player.hp ?? 100, en: data.player.en ?? 100, battery: data.player.battery ?? 100 });
    this.entities.push(this.player);
    ph.setupDynamic(!!data);
    this.camera.follow = this.player; this.camera.pan = null;
    this.camera.x = this.player.x; this.camera.y = this.player.y; this.camera.zoom = this.camera.targetZoom = 1;
    this.computeLight(1);
    this.ui.renderMissions();
    this.ui.cache = {};
  }

  toMenu() {
    this.state = 'menu';
    this.audio.setMood('calm');
    if (!this.player) this.startSession(null);
    this.tod = this.todTarget = 352;
    this.camera.follow = null;
    this.menuCam = { t: 0 };
    this.letterbox = 0; this.fade = 0;
    this.ui.showScreen('menu');
    this.ui.setDrawer(false);
  }

  async newGame(id = 1) {
    if (!this.registry[id]) return;
    await this.loadPhase(id);
    Save.clear(id);
    Save.setLast(id);
    // a Fase 1 começa do zero; as seguintes trazem o que Caetano carregava (paneiro, rastros)
    this.startSession(id > 1 ? { carry: Save.progress().carry } : null);
    this.ui.showScreen(null);
    this.state = 'intro';
    await this.phase.intro();
  }

  async continueGame() {
    const prog = Save.progress();
    let id = this.registry[prog.last] ? prog.last : 1;
    const d = Save.load(id);
    if (d && d.completed) {
      const nx = id + 1;
      if (this.registry[nx] && Save.isUnlocked(nx)) {
        const dn = Save.load(nx);
        if (dn && !dn.completed) return this.resumePhase(nx, dn);
        return this.newGame(nx);
      }
      if (id === 1) { await this.loadPhase(1); this.startSession(null); this.ui.showScreen(null); this.state = 'play'; this.phase.onResume?.(false); return; }
      this.ui.renderPhases(); this.ui.pushScreen('phases');
      return;
    }
    if (!d) return this.newGame(id);
    return this.resumePhase(id, d);
  }

  async resumePhase(id, d) {
    await this.loadPhase(id);
    this.startSession(d);
    this.ui.showScreen(null);
    this.state = 'play';
    this.audio.setPaused(false);
    this.ui.titleCard(this.phase.code, this.phase.title, 'Expedição retomada');
    this.phase.onResume?.(true);
  }

  // menu de fases: continua a expedição salva da fase ou começa de novo
  async playPhase(id, fresh = false) {
    if (!this.registry[id] || !Save.isUnlocked(id)) return;
    const d = Save.load(id);
    if (!fresh && d && !d.completed) return this.resumePhase(id, d);
    return this.newGame(id);
  }

  checkpoint(label = 'Progresso salvo') {
    const p = this.player;
    const data = {
      phase: this.phase.id, done: [...this.done], flags: this.flags, inv: this.inv.toJSON(), res: this.res,
      tracks: [...this.tracksKnown], tod: this.tod, cp: { x: p.x, y: p.y }, timeLeft: this.timeLeft,
      player: { hp: p.hp, en: p.en, battery: p.battery },
    };
    // cópia independente: mudanças posteriores nas flags não "vazam" para o checkpoint
    this.lastCheckpoint = JSON.parse(JSON.stringify(data));
    Save.write(data);
    this.ui.toast(`<b>Checkpoint</b> · ${label}`, 'tip', 2600);
  }

  restoreCheckpoint(resetTimer = true) {
    const src = this.lastCheckpoint || Save.load(this.phase.id);
    const d = src ? JSON.parse(JSON.stringify(src)) : null;
    if (d && resetTimer) d.timeLeft = this.phase.timeLimit;
    if (d && resetTimer) d.player = { hp: 100, en: 100, battery: Math.max(40, d.player?.battery ?? 100) };
    this.startSession(d);
    this.ui.showScreen(null);
    this.state = 'play';
    this.audio.setPaused(false);
    this.audio.setDuck(1);
    this.ui.toast('Expedição retomada do último checkpoint.', 'tip');
    this.phase.onRestore?.();
  }

  fail(title, msg) {
    if (this.state === 'fail') return;
    this.state = 'fail';
    this.audio.setPaused(true);
    this.ui.fail(title, msg);
  }

  // ---------- sobreposições ----------
  openOverlay(name) {
    if (this.state !== 'play') return;
    const map = { pause: 'pause', inventory: 'inventory', map: 'map' };
    if (!map[name]) return;
    this.state = 'overlay:' + name;
    if (name === 'inventory') this.ui.renderInventory();
    if (name === 'map') this.ui.drawBigMap();
    this.ui.showScreen(map[name]);
    this.audio.setPaused(true);
  }
  resume() {
    if (!this.state.startsWith('overlay')) return;
    this.ui.showScreen(null);
    this.state = 'play';
    this.audio.setPaused(false);
  }
  toggleOverlay(name) {
    if (this.state === 'play') this.openOverlay(name);
    else if (this.state === 'overlay:' + name) this.resume();
    else if (this.state.startsWith('overlay')) { this.ui.showScreen(null); this.state = 'play'; this.openOverlay(name); }
  }
  uiAction(a) {
    if (a === 'resume') {
      if (this.state === 'menu') { this.ui.showScreen('menu'); return; }
      if (this.state.startsWith('overlay')) this.resume();
    } else if (a === 'checkpoint') this.restoreCheckpoint(this.state === 'fail');
    else if (a === 'menu') { this.player = null; this.toMenu(); }
    else if (a === 'replay') this.newGame(this.phase.id);
    else if (a === 'next') this.newGame(this.phase.id + 1);
  }

  // ---------- laço ----------
  frame(ts) {
    const dt = clamp((ts - (this.last || ts)) / 1000, 0, 0.05);
    this.last = ts;
    try {
      this.update(dt);
      this.renderer.render();
    } catch (e) { console.error(e); }
    this.input.endFrame();
    requestAnimationFrame((t) => this.frame(t));
  }

  update(dt) {
    const inp = this.input, st = this.state;
    if (!this.world || !this.player) return;

    // diálogo aberto: avança com E/Espaço/Enter/clique; escolhas com 1-3
    if (this.ui.dlg) {
      if (this.ui.dlg.choice) { ['use1', 'use2', 'use3'].forEach((k, i) => { if (inp.pressed(k)) this.ui.pick(i); }); }
      else if (inp.pressed('interact') || inp.pressed('dodge') || inp.pressed('confirm')) this.ui.advance();
    }
    if (st === 'intro' && (inp.pressed('dodge') || inp.pressed('confirm') || inp.pressed('interact'))) this.ui.introNext?.();

    if (st === 'play') {
      if (inp.pressed('pause')) { this.openOverlay('pause'); return; }
      if (inp.pressed('inventory')) { this.openOverlay('inventory'); return; }
      if (inp.pressed('map')) { this.openOverlay('map'); return; }
      if (inp.pressed('drawer')) this.ui.setDrawer(!document.body.classList.contains('drawer-open'));
      if (inp.pressed('use1')) this.useItem('cantil');
      if (inp.pressed('use2')) this.useItem('marmita');
      if (inp.pressed('use3')) this.useItem('pilhas');
    } else if (st.startsWith('overlay')) {
      const name = st.split(':')[1];
      if (inp.pressed('pause')) {
        if (this.ui.screenStack.length > 1) this.ui.popScreen(); else this.resume();
      } else if (inp.pressed(name)) this.resume();
      return;
    } else if (st === 'fail' || st === 'results' || st === 'loading') {
      return;
    } else if ((st === 'cutscene' || st === 'menu') && inp.pressed('drawer')) this.ui.setDrawer(!document.body.classList.contains('drawer-open'));

    this.time += dt;

    if (st === 'menu') {
      this.menuCam.t += dt;
      for (const a of ['up', 'down', 'confirm']) if (inp.pressed(a)) this.ui.menuKey(a);
      const path = this.phase.menuPath;
      const k = (Math.sin(this.menuCam.t * 0.05) + 1) / 2;
      this.camera.x = lerp(path[0].x, path[1].x, k); this.camera.y = lerp(path[0].y, path[1].y, k) + Math.sin(this.menuCam.t * 0.11) * 20;
    }

    if (st === 'play' && !document.hidden) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.fail('O tempo acabou', 'O sol subiu, o rastro esfriou e Caetano perdeu a pista do veado. Volte ao último ponto seguro e tente de novo.'); return; }
    }

    this.updateTimeOfDay(dt, st === 'play');
    this.wind.t += dt;
    this.wind.a = this.wind.base + Math.sin(this.wind.t * 0.03) * 0.6 + Math.sin(this.wind.t * 0.011) * 0.4;

    if (st === 'play' || st === 'cutscene') this.player.update(dt);
    if (st === 'cutscene' || st === 'menu' || st === 'intro') { this.player.vx *= 0.8; this.player.vy *= 0.8; }

    for (const m of this.movers.slice()) this.stepMover(m, dt);
    for (const e of this.updaters) e.update(dt);
    this.particles.update(dt);
    this.ambientParticles(dt);
    this.phase.update(dt);

    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i]; tw.t = Math.min(tw.dur, tw.t + dt);
      tw.o[tw.k] = lerp(tw.from, tw.to, tw.dur ? tw.t / tw.dur : 1);
      if (tw.t >= tw.dur) { this.tweens.splice(i, 1); tw.res(); }
    }
    for (let i = this.sleepers.length - 1; i >= 0; i--) {
      const s = this.sleepers[i]; s.t -= dt;
      if (s.t <= 0) { this.sleepers.splice(i, 1); s.res(); }
    }
    for (let i = this.soundCues.length - 1; i >= 0; i--) { const c = this.soundCues[i]; c.t += dt; if (c.t >= c.life) this.soundCues.splice(i, 1); }
    this.flash = Math.max(0, this.flash - dt * 2.5);

    if (st === 'play') {
      this.focus = this.findFocus();
      if (inp.pressed('interact') && this.focus) { const f = this.focus; this.focus = null; f.action(); }
      for (const t of this.triggers) {
        if (t.fired || (t.cond && !t.cond())) continue;
        const inside = t.r ? dist(t.x, t.y, this.player.x, this.player.y) < t.r : (this.player.x >= t.x && this.player.x <= t.x + t.w && this.player.y >= t.y && this.player.y <= t.y + t.h);
        if (inside) { if (t.once !== false) t.fired = true; t.fn(); if (this.state !== 'play') break; }
      }
      this.checkHazards();
      if (this.player.hp <= 0) this.fail('Caetano desmaiou', 'Ferido e cansado, Caetano não conseguiu seguir. Descanse e retome do último ponto seguro.');
    } else this.focus = null;

    this.world.explore(this.player.x, this.player.y, 150);
    this.camera.update(dt, this.world, this.settings.shake);
    this.audio.update(dt, this.phase.audioEnv ? this.phase.audioEnv() : {});
    if (st === 'play' || st === 'cutscene') this.ui.updateHUD(dt);
    this.ui.updateDialog(dt);
  }

  // ---------- horário e luz ----------
  updateTimeOfDay(dt, playing) {
    if (playing) this.todTarget = Math.min(this.phase.todCap(), this.todTarget + dt / 22);
    const diff = this.todTarget - this.tod;
    if (diff > 0) this.tod += Math.min(diff, Math.max(dt / 22, diff * dt * 0.25));
    this.computeLight(dt);
  }
  computeLight() {
    const t = this.tod;
    let a = LIGHT_KEYS[0], b = LIGHT_KEYS[LIGHT_KEYS.length - 1];
    for (let i = 0; i < LIGHT_KEYS.length - 1; i++) if (t >= LIGHT_KEYS[i][0] && t <= LIGHT_KEYS[i + 1][0]) { a = LIGHT_KEYS[i]; b = LIGHT_KEYS[i + 1]; break; }
    if (t < LIGHT_KEYS[0][0]) b = a;
    if (t > b[0]) a = b;
    const k = a === b ? 0 : (t - a[0]) / (b[0] - a[0]);
    this.darkness = lerp(a[1], b[1], k) + (this.phase.extraDark || 0);
    this.ambientColor = a[2].map((v, i) => Math.round(lerp(v, b[2][i], k)));
    this.tint = a[3].map((v, i) => lerp(v, b[3][i], k));
    this.sun.strength = lerp(a[4], b[4], k);
    this.sun.dx = -clamp(1.8 - (t - 360) / 90, 0.5, 1.8);
    this.canopyDark = 0.28 + 0.12 * this.sun.strength;
    this.waterGlint = this.sun.strength > 0.3 ? '#fff4d8' : this.darkness > 0.5 ? '#9ab0d8' : '#f0c8c0';
  }
  todName() {
    const t = this.tod;
    return t < 330 ? 'Madrugada' : t < 375 ? 'Amanhecer' : t < 420 ? 'Manhã cedo' : t < 720 ? 'Manhã' : t < 1050 ? 'Tarde' : t < 1110 ? 'Entardecer' : 'Noite';
  }

  collectLights() {
    const L = [];
    const p = this.player;
    if (p) {
      L.push({ x: p.x, y: p.y - 6, r: 34, i: 0.38 });
      if (p.lantern) {
        let ang;
        const m = this.input.mouse;
        if (p.aiming) ang = p.aimAngle;
        else if (this.input.lastDevice === 'mouse' && m.inside && performance.now() - m.moved < 4000) {
          const s = this.renderer.worldToScreen(p.x, p.y - 8);
          ang = Math.atan2(m.y - s.y, m.x - s.x);
        } else { const v = DIR_VEC[p.dir]; ang = Math.atan2(v[1], v[0]); }
        p.lanternAngle = ang;
        L.push({ x: p.x, y: p.y - 8, r: 140, i: 1, cone: true, angle: ang, spread: 0.5, color: '255,236,180' });
        L.push({ x: p.x + Math.cos(ang) * 30, y: p.y - 8 + Math.sin(ang) * 30, r: 38, i: 0.55 });
      }
    }
    for (const l of this.lights) if (!l.off) L.push(l);
    for (const f of this.particles.list) if (f.type === 'firefly') L.push({ x: f.x, y: f.y, r: 9, i: 0.5 * (0.5 + 0.5 * Math.sin(f.t * 4 + f.seed)), color: '200,255,120' });
    return L;
  }

  ambientParticles(dt) {
    const cam = this.camera, w = this.world;
    const x0 = cam.x - cam.viewW / 2, y0 = cam.y - cam.viewH / 2;
    if (Math.random() < dt * 3) {
      const x = x0 + Math.random() * cam.viewW, y = y0 + Math.random() * cam.viewH;
      if (w.densityAt(x, y) > 0.5) this.particles.add({ type: 'leaf', x, y, z: 30 + Math.random() * 20, vx: 6 + Math.random() * 6, vy: 2, life: 6, seed: Math.random() * 9, color: ['#5a8a3a', '#8a6a34', '#a8823a', '#6a7a2a'][(Math.random() * 4) | 0] });
    }
    if (this.darkness > 0.3) {
      let n = 0; for (const p of this.particles.list) if (p.type === 'firefly') n++;
      if (n < 18 && Math.random() < dt * 4) {
        const x = x0 + Math.random() * cam.viewW, y = y0 + Math.random() * cam.viewH;
        if (!w.isWater(x, y)) this.particles.add({ type: 'firefly', x, y, life: 6 + Math.random() * 6, seed: Math.random() * 9 });
      }
    }
  }

  // ---------- percepção e ambiente ----------
  isDownwind(p, a) {
    const dx = a.x - p.x, dy = a.y - p.y, d = Math.hypot(dx, dy) || 1;
    return (dx / d) * Math.cos(this.wind.a) + (dy / d) * Math.sin(this.wind.a) > 0.72;
  }
  isInCover(x, y) { return this.phase.isInCover ? this.phase.isInCover(x, y) : false; }
  panOf(x) { return clamp((x - (this.player?.x ?? x)) / 140, -1, 1); }
  caption(text, pan = 0) {
    this.ui.caption(text, pan);
    this.soundCues.push({ pan, t: 0, life: 1.6 });
  }
  checkHazards() {
    const p = this.player;
    for (const h of this.hazards) {
      if (dist(h.x, h.y, p.x, p.y) > h.r) continue;
      if (h.type === 'tucum' && (p.moving || p.running) && p.dodgeT <= 0) p.hurt(6, 'Espinhos de tucum! Cuidado onde pisa.');
      if (h.type === 'ants') p.hurt(4, 'Formigas tucandeiras! Saia daí depressa.');
    }
  }

  findFocus() {
    const p = this.player;
    let best = null, bd = 1e9;
    const fv = DIR_VEC[p.dir];
    for (const it of this.interactables) {
      if (it.enabled && !it.enabled()) continue;
      const d = dist(it.x, it.y, p.x, p.y);
      const r = it.r || 22;
      if (d > r) continue;
      const dot = d > 1 ? ((it.x - p.x) * fv[0] + (it.y - p.y) * fv[1]) / d : 1;
      const score = d - dot * 6;
      if (score < bd) { bd = score; best = it; }
    }
    if (!best && !p.locked && this.inv.has('cantil') && this.res.water < 4) {
      for (const [dx, dy] of [[fv[0] * 12, fv[1] * 12], [12, 0], [-12, 0], [0, 12], [0, -10]]) {
        if (this.world.isWater(p.x + dx, p.y + dy)) {
          return { x: p.x + dx, y: p.y + dy, py: 10, label: 'Encher o cantil', action: () => { this.res.water = 4; this.audio.play('drink'); this.audio.play('splash', { vol: 0.4 }); this.ui.toast('Cantil cheio: <b>4 goles</b>.', 'tip'); this.phase.onEvent?.('fill'); } };
        }
      }
    }
    return best;
  }

  useItem(id) {
    const p = this.player;
    if (id === 'cantil') {
      if (!this.inv.has('cantil')) return;
      if (this.res.water <= 0) { this.ui.toast('Cantil vazio. Encha num rio ou igarapé (E perto da água).', 'tip'); return; }
      if (p.en >= 99) { this.ui.toast('Caetano não está com sede agora.', 'tip', 2000); return; }
      this.res.water--; p.en = Math.min(100, p.en + 40); p.exhausted = false;
      this.audio.play('drink'); this.ui.toast(`Um gole d'água. Energia +40 (${this.res.water}/4).`, 'tip', 2200);
    } else if (id === 'marmita') {
      if (!this.inv.has('marmita')) return;
      if (this.res.food <= 0) { this.ui.toast('A marmita está vazia.', 'warn'); return; }
      if (p.hp >= 100 && p.en >= 100) { this.ui.toast('Ainda não é hora de comer.', 'tip', 2000); return; }
      this.res.food--; p.hp = Math.min(100, p.hp + 35); p.en = Math.min(100, p.en + 25);
      this.audio.play('eat'); this.ui.toast(`Peixe assado com farinha. Vida +35, energia +25 (${this.res.food} restantes).`, 'tip', 2600);
    } else if (id === 'pilhas') {
      if (!this.inv.has('pilhas')) { this.ui.toast('Você não tem pilhas.', 'tip', 2000); return; }
      this.inv.remove('pilhas'); p.battery = 100; this.audio.play('click');
      this.ui.toast('Pilhas novas na lanterna: 100%.', 'tip');
    }
  }

  give(id, n = 1, quiet = false) {
    const ok = this.inv.add(id, n);
    if (!ok) { this.ui.toast('O paneiro está cheio.', 'warn'); return false; }
    const it = ITEMS[id];
    if (!quiet) {
      if (it.type === 'collectible') { this.audio.play('discover'); this.ui.toast(`<b>Achado:</b> ${it.name} · ${this.inv.found.size}/5`, 'discovery', 5000); }
      else { this.audio.play('pickup'); this.ui.toast(`<b>${it.name}</b>${n > 1 ? ' ×' + n : ''} no paneiro.`, 'tip', 2600); }
    }
    return true;
  }

  shoot(p) {
    if (this.res.ammo <= 0) { this.audio.play('click'); this.ui.toast('Sem cartuchos.', 'warn'); return; }
    const ax = Math.cos(p.aimAngle), ay = Math.sin(p.aimAngle);
    for (const a of this.animals) {
      if (!a.visible) continue;
      const dx = a.x - p.x, dy = a.y - p.y, along = dx * ax + dy * ay;
      if (along < 0 || along > 110) continue;
      if (Math.abs(dx * ay - dy * ax) < 14) {
        this.ui.toast('Caetano baixa a espingarda: <i>"Não. Hoje eu vim pelo veado."</i>', 'tip', 3200);
        p.aimToggle = false;
        return;
      }
    }
    this.res.ammo--;
    this.audio.play('shot');
    this.flash = 0.35;
    this.camera.shake(3, 0.35);
    p.makeNoise(1.6);
    const mx = p.x + ax * 14, my = p.y - 10 + ay * 14;
    for (let i = 0; i < 10; i++) this.particles.add({ type: 'puff', x: mx, y: my, vx: ax * 40 + (Math.random() - 0.5) * 20, vy: ay * 40 + (Math.random() - 0.5) * 20, life: 0.9, drag: 3 });
    for (let i = 0; i < 6; i++) this.particles.add({ type: 'spark', x: mx, y: my, vx: ax * 120 + (Math.random() - 0.5) * 60, vy: ay * 120 + (Math.random() - 0.5) * 60, life: 0.25 });
    for (const a of this.animals) if (dist(a.x, a.y, p.x, p.y) < 280) a.scare();
    this.caption('O tiro ecoa pela mata', 0);
    this.ui.toast(`Tiro de aviso. A mata inteira escutou. (${this.res.ammo} cartuchos)`, 'warn', 3000);
    this.phase.onEvent?.('shot');
  }

  complete(id) {
    if (this.done.has(id)) return false;
    this.done.add(id);
    const m = this.phase.missions.find((q) => q.id === id);
    const sm = !m && this.phase.secondary ? this.phase.secondary.find((q) => q.id === id) : null;
    this.audio.play('mission');
    this.ui.toast(sm ? `<b>Missão secundária</b> · ${sm.title}` : `<b>Missão concluída</b> · ${m ? m.title : id}`, 'mission', 4200);
    this.ui.markDone(id);
    this.phase.onMissionDone?.(id);
    return true;
  }
  currentMission() { return this.phase.currentMission ? this.phase.currentMission() : this.phase.missions.find((m) => !this.done.has(m.id)); }
  currentTarget() { const m = this.currentMission(); return m && m.target ? m.target() : null; }

  // ---------- roteiro ----------
  wait(sec) { return new Promise((res) => this.sleepers.push({ t: sec, res })); }
  tween(o, k, to, dur) { return new Promise((res) => { this.tweens = this.tweens.filter((t) => !(t.o === o && t.k === k)); this.tweens.push({ o, k, from: o[k], to, t: 0, dur, res }); }); }
  say(name, text, look) { return this.ui.say(name, text, look); }
  choice(name, text, opts, look) { return this.ui.choice(name, text, opts, look); }
  moveTo(e, x, y, speed = 40) { return new Promise((res) => this.movers.push({ e, x, y, speed, res })); }
  stepMover(m, dt) {
    const e = m.e, dx = m.x - e.x, dy = m.y - e.y, d = Math.hypot(dx, dy);
    if (d < 1.5) { this.movers.splice(this.movers.indexOf(m), 1); e.moving = false; e.frame = 0; m.res(); return; }
    const s = Math.min(d, m.speed * dt);
    e.x += dx / d * s; e.y += dy / d * s;
    if (e === this.player) {
      e.moving = true;
      e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      e.anim += dt * 7; e.frame = Math.floor(e.anim) % 4;
    }
  }
  async run(fn) {
    if (this.state === 'cutscene') return;
    const prev = this.state;
    this.state = 'cutscene';
    this.player.locked = true;
    this.player.lantern = this.player.lantern; // mantém
    try { await fn(); }
    catch (e) { console.error(e); }
    finally {
      if (this.state === 'cutscene') this.state = prev === 'cutscene' ? 'play' : (prev === 'intro' ? 'play' : prev);
      if (this.state === 'menu' || this.state === 'results') { /* manter */ }
      this.player.locked = false;
      this.ui.hideDialog();
    }
  }
}
