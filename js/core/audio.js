// Áudio procedural com Web Audio API: ambiente da mata, trilha generativa e efeitos com estéreo
import { clamp } from './util.js';

const SCALE_A_DORIAN = [57, 59, 60, 62, 64, 66, 67]; // A B C D E F# G
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.vol = { master: 0.8, music: 0.5, sfx: 0.85, amb: 0.75 };
    this.mood = 'calm';
    this.env = { dawn: 1, river: 0, riverPan: 0, insects: 1, frogs: 1, birds: 1, quiet: 0, fire: 0, rain: 0 };
    this.nextAmb = {};
    this.musicOn = true;
  }

  init() {
    if (this.ctx) { this.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain();
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 4;
    this.master.connect(this.comp); this.comp.connect(c.destination);

    this.musicG = c.createGain(); this.musicG.connect(this.master);
    this.musicMix = c.createGain(); this.musicMix.connect(this.musicG);
    this.sfxG = c.createGain(); this.sfxG.connect(this.master);
    this.ambG = c.createGain(); this.ambG.connect(this.master);
    this.duck = c.createGain(); this.duck.connect(this.ambG);

    this.reverb = c.createConvolver();
    this.reverb.buffer = this.makeIR(3.2, 2.6);
    this.revOut = c.createGain(); this.revOut.gain.value = 0.55;
    this.reverb.connect(this.revOut); this.revOut.connect(this.master);

    this.noise = this.makeNoise(3);
    this.applyVolumes();
    this.startAmbientBeds();
    this.startMusic();
  }

  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); }
  setPaused(p) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(p ? this.vol.master * 0.25 : this.vol.master, t, 0.2);
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.musicG.gain.setTargetAtTime(this.vol.music * 0.55, t, 0.05);
    this.sfxG.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.ambG.gain.setTargetAtTime(this.vol.amb, t, 0.05);
  }

  makeNoise(sec) {
    const c = this.ctx, len = c.sampleRate * sec;
    const b = c.createBuffer(1, len, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  makeIR(sec, decay) {
    const c = this.ctx, len = c.sampleRate * sec;
    const b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  // ---------- utilitários de síntese ----------
  out(pan = 0, bus = 'sfx', rev = 0) {
    const c = this.ctx;
    const g = c.createGain();
    const p = c.createStereoPanner ? c.createStereoPanner() : null;
    const dest = bus === 'music' ? this.musicMix : bus === 'amb' ? this.duck : this.sfxG;
    if (p) { p.pan.value = clamp(pan, -1, 1); g.connect(p); p.connect(dest); if (rev > 0) { const s = c.createGain(); s.gain.value = rev; p.connect(s); s.connect(this.reverb); } }
    else { g.connect(dest); }
    return g;
  }
  noiseBurst({ t = 0, dur = 0.08, type = 'bandpass', f = 1500, q = 1, vol = 0.3, pan = 0, bus = 'sfx', rev = 0, f2 = null, attack = 0.003 }) {
    vol = Math.max(0.0002, vol); const c = this.ctx; const now = c.currentTime + Math.max(0, t);
    const s = c.createBufferSource(); s.buffer = this.noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, now); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, now + dur);
    const g = this.out(pan, bus, rev);
    const e = c.createGain();
    e.gain.setValueAtTime(0.0001, now);
    e.gain.exponentialRampToValueAtTime(vol, now + attack);
    e.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    s.connect(fl); fl.connect(e); e.connect(g);
    s.start(now, Math.random() * 2); s.stop(now + dur + 0.05);
  }
  tone({ t = 0, f = 440, f2 = null, dur = 0.2, type = 'sine', vol = 0.2, pan = 0, bus = 'sfx', rev = 0, attack = 0.01, vib = 0, vibRate = 5, curve = 'exp' }) {
    vol = Math.max(0.0002, vol); const c = this.ctx; const now = c.currentTime + Math.max(0, t);
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, now);
    if (f2) {
      if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(f2, now + dur);
      else o.frequency.linearRampToValueAtTime(f2, now + dur);
    }
    if (vib) {
      const l = c.createOscillator(); const lg = c.createGain();
      l.frequency.value = vibRate; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency);
      l.start(now); l.stop(now + dur + 0.1);
    }
    const e = c.createGain();
    e.gain.setValueAtTime(0.0001, now);
    e.gain.exponentialRampToValueAtTime(vol, now + attack);
    e.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(e); e.connect(this.out(pan, bus, rev));
    o.start(now); o.stop(now + dur + 0.05);
    return o;
  }

  // ---------- leitos de ambiente ----------
  startAmbientBeds() {
    const c = this.ctx;
    const loop = (type, f, q, gain) => {
      const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
      const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = c.createGain(); g.gain.value = gain;
      s.connect(fl); fl.connect(g); g.connect(this.duck); s.start();
      return { s, fl, g };
    };
    this.bedWind = loop('lowpass', 380, 0.6, 0.05);
    this.bedLeaves = loop('bandpass', 3200, 0.5, 0.012);
    this.bedRiver = loop('lowpass', 900, 0.7, 0.0);
    const rp = c.createStereoPanner ? c.createStereoPanner() : null;
    if (rp) { this.bedRiver.g.disconnect(); this.bedRiver.g.connect(rp); rp.connect(this.duck); this.riverPanner = rp; }
    this.bedFire = loop('bandpass', 700, 0.4, 0.0);
    this.bedRain = loop('highpass', 1400, 0.4, 0.0);
    this.bedRainLow = loop('lowpass', 500, 0.5, 0.0);
    // bando de queixadas andando: ronco grave de cascos + farfalhar de folhas
    this.bedHerd = loop('lowpass', 240, 0.8, 0.0);
    this.bedHerdLeaves = loop('bandpass', 1900, 0.7, 0.0);
    if (c.createStereoPanner) {
      const hp = c.createStereoPanner();
      for (const b of [this.bedHerd, this.bedHerdLeaves]) { b.g.disconnect(); b.g.connect(hp); }
      hp.connect(this.duck); this.herdPanner = hp;
    }

    // cigarras / insetos: oscilador com modulação de amplitude
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 4600;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 6;
    const am = c.createGain(); am.gain.value = 0;
    const lfo = c.createOscillator(); lfo.frequency.value = 38; const lg = c.createGain(); lg.gain.value = 0.5;
    lfo.connect(lg); lg.connect(am.gain);
    const ig = c.createGain(); ig.gain.value = 0.0;
    o.connect(bp); bp.connect(am); am.connect(ig); ig.connect(this.duck);
    o.start(); lfo.start();
    this.bedInsects = ig;
  }

  setDuck(v, time = 1.5) { if (this.ctx) this.duck.gain.setTargetAtTime(v, this.ctx.currentTime, time / 3); }

  update(dt, env) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    Object.assign(this.env, env);
    const t = this.ctx.currentTime, E = this.env;
    const q = 1 - E.quiet;
    this.bedRiver.g.gain.setTargetAtTime(0.12 * E.river, t, 0.4);
    if (this.riverPanner) this.riverPanner.pan.setTargetAtTime(clamp(E.riverPan, -0.8, 0.8), t, 0.4);
    this.bedFire.g.gain.setTargetAtTime(0.05 * E.fire, t, 0.3);
    this.bedRain.g.gain.setTargetAtTime(0.07 * (E.rain || 0), t, 0.8);
    this.bedRainLow.g.gain.setTargetAtTime(0.06 * (E.rain || 0), t, 0.8);
    const herd = clamp(E.herd || 0, 0, 1.5);
    this.bedHerd.g.gain.setTargetAtTime(0.16 * herd, t, 0.35);
    this.bedHerdLeaves.g.gain.setTargetAtTime(0.03 * herd * (0.6 + 0.4 * Math.sin(t * 7.3)), t, 0.15);
    if (this.herdPanner) this.herdPanner.pan.setTargetAtTime(clamp(E.herdPan || 0, -0.85, 0.85), t, 0.3);
    this.bedWind.g.gain.setTargetAtTime(0.04 + 0.03 * Math.sin(t * 0.23), t, 0.5);
    const swell = 0.5 + 0.5 * Math.sin(t * 0.17);
    this.bedInsects.gain.setTargetAtTime(0.006 * E.insects * swell * q, t, 0.8);

    // eventos esparsos
    this.sched('bird', 1.2 + Math.random() * 3.5 / Math.max(0.2, E.birds * q), () => this.songbird((Math.random() * 2 - 1) * 0.9, 0.05 + Math.random() * 0.05));
    if (E.dawn > 0.2) this.sched('inambu', 9 + Math.random() * 14, () => this.inambu((Math.random() * 2 - 1) * 0.8, 0.07 * E.dawn * q));
    if (E.frogs > 0.05) this.sched('frog', 0.6 + Math.random() * 2.5, () => this.frog((Math.random() * 2 - 1), 0.05 * E.frogs * q));
    if (E.fire > 0.05) this.sched('crackle', 0.1 + Math.random() * 0.4, () => this.noiseBurst({ dur: 0.03, type: 'highpass', f: 2500, vol: 0.12 * E.fire, bus: 'amb' }));
  }
  sched(key, interval, fn) {
    const t = this.ctx.currentTime;
    if (this.nextAmb[key] === undefined) this.nextAmb[key] = t + Math.random() * interval;
    if (t >= this.nextAmb[key]) { this.nextAmb[key] = t + interval; fn(); }
  }

  songbird(pan, vol) {
    const base = 2200 + Math.random() * 2400, n = 2 + ((Math.random() * 5) | 0);
    for (let i = 0; i < n; i++) {
      const f = base * (0.85 + Math.random() * 0.4);
      this.tone({ t: i * (0.07 + Math.random() * 0.05), f, f2: f * (0.7 + Math.random() * 0.7), dur: 0.06 + Math.random() * 0.06, vol, pan, bus: 'amb', rev: 0.3 });
    }
  }
  // inambu: assobio trêmulo e descendente típico do amanhecer
  inambu(pan, vol) {
    for (let i = 0; i < 3; i++) this.tone({ t: i * 0.9, f: 1250 + i * 60, f2: 1150 + i * 60, dur: 0.8, vol, pan, bus: 'amb', rev: 0.6, vib: 18, vibRate: 9, attack: 0.15 });
  }
  frog(pan, vol) {
    const f = 140 + Math.random() * 160;
    for (let i = 0; i < 3; i++) this.tone({ t: i * 0.07, f, f2: f * 0.8, type: 'sawtooth', dur: 0.05, vol, pan, bus: 'amb', rev: 0.2 });
  }

  // ---------- trilha generativa ----------
  startMusic() {
    this.beat = 0; this.nextNote = this.ctx.currentTime + 0.5;
    this.tempo = 68;
    this.chords = [[57, 64, 72], [62, 66, 69], [57, 64, 72], [55, 62, 67]]; // Am, D, Am, G
    this.musicTimer = setInterval(() => this.musicTick(), 90);
  }
  // troca de clima musical com transição suave (abaixa a mixagem, troca, sobe de novo)
  setMood(m) {
    if (this.mood === m) return;
    this.mood = m;
    this.tempo = m === 'chase' ? 96 : 68;
    if (!this.ctx) return;
    const t = this.ctx.currentTime, g = this.musicMix.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0.15, t + 0.45);
    g.linearRampToValueAtTime(1, t + (m === 'chase' ? 1.2 : 2.6));
  }
  musicTick() {
    if (!this.ctx || this.ctx.state !== 'running' || !this.musicOn) return;
    const spb = 60 / this.tempo;
    while (this.nextNote < this.ctx.currentTime + 0.35) {
      this.playBeat(this.beat, this.nextNote - this.ctx.currentTime);
      this.nextNote += spb / 2;
      this.beat++;
    }
  }
  playBeat(b, t) {
    const mood = this.mood;
    const bar = Math.floor(b / 8), inBar = b % 8;
    const ch = this.chords[bar % 4];
    if (mood === 'calm') {
      if (inBar === 0) for (const n of ch) this.pad(mtof(n - 12), t, 4.2, 0.035);
      if (inBar % 2 === 0 && Math.random() < 0.7) {
        const n = ch[(inBar / 2) % 3] + (Math.random() < 0.3 ? 12 : 0);
        this.pluck(mtof(n), t, 0.06);
      }
      if (inBar === 3 || inBar === 7) this.noiseBurst({ t, dur: 0.05, type: 'highpass', f: 6000, vol: 0.025, bus: 'music' });
      if (bar % 2 === 1 && inBar === 2 && Math.random() < 0.55) this.flutePhrase(t);
    } else if (mood === 'mystery') {
      if (inBar === 0) { this.pad(mtof(45), t, 4.5, 0.05); this.pad(mtof(52), t, 4.5, 0.03); if (bar % 2) this.pad(mtof(58), t, 4.5, 0.018); }
      if (inBar === 4 && Math.random() < 0.5) this.tone({ t, f: mtof(81 + (Math.random() < 0.5 ? 1 : 0)), dur: 2.4, vol: 0.02, bus: 'music', rev: 0.9, attack: 0.8, vib: 4 });
    } else if (mood === 'tension') {
      if (inBar % 2 === 0) this.tone({ t, f: mtof(45), dur: 0.25, type: 'triangle', vol: 0.08, bus: 'music' });
      if (inBar === 0) this.pad(mtof(46), t, 4, 0.04);
    } else if (mood === 'stealth') {
      // pulso grave e contido, pratinho de chocalho: tensão sem pressa
      if (inBar % 4 === 0) this.tone({ t, f: mtof(45), f2: mtof(45) * 0.98, dur: 0.6, type: 'sine', vol: 0.07, bus: 'music' });
      if (inBar === 0) this.pad(mtof(52), t, 4.4, 0.025);
      if (inBar % 2 === 1 && Math.random() < 0.5) this.noiseBurst({ t, dur: 0.04, type: 'highpass', f: 7000, vol: 0.018, bus: 'music' });
      if (bar % 4 === 3 && inBar === 6) this.tone({ t, f: mtof(76), dur: 1.4, vol: 0.016, bus: 'music', rev: 0.8, attack: 0.3, vib: 5 });
    } else if (mood === 'chase') {
      // perseguição: tambores graves, ostinato e cordas em trêmulo
      const h = 60 / this.tempo / 4;
      const bass = [45, 45, 48, 45, 50, 45, 48, 43][inBar];
      this.tone({ t, f: mtof(bass - 12), dur: 0.22, type: 'triangle', vol: 0.11, bus: 'music' });
      this.tone({ t: t + h, f: mtof(bass), dur: 0.12, type: 'triangle', vol: 0.05, bus: 'music' });
      if (inBar % 2 === 0) { this.tone({ t, f: 95, f2: 42, dur: 0.28, type: 'sine', vol: 0.28, bus: 'music' }); this.noiseBurst({ t, dur: 0.07, type: 'lowpass', f: 300, vol: 0.12, bus: 'music' }); }
      if (inBar === 3 || inBar === 7) { this.noiseBurst({ t, dur: 0.12, f: 1800, q: 0.7, vol: 0.09, bus: 'music', rev: 0.2 }); this.tone({ t, f: 180, f2: 110, dur: 0.15, type: 'triangle', vol: 0.08, bus: 'music' }); }
      this.noiseBurst({ t: t + h, dur: 0.03, type: 'highpass', f: 6500, vol: 0.03, bus: 'music' });
      if (inBar === 0) { for (const n of [57, 60, 64]) this.tone({ t, f: mtof(n), dur: 3.6, type: 'sawtooth', vol: 0.012, bus: 'music', rev: 0.4, attack: 0.3, vib: 9, vibRate: 11 }); }
    } else if (mood === 'dread') {
      // pavor: pulso grave lento como um coração, nota sustentada desafinada
      if (inBar === 0 || inBar === 3) this.tone({ t, f: 52, f2: 40, dur: 0.35, type: 'sine', vol: 0.18, bus: 'music' });
      if (inBar === 0) { this.pad(mtof(40), t, 4.6, 0.05); this.tone({ t, f: mtof(64) * 1.01, dur: 4, vol: 0.012, bus: 'music', rev: 0.9, attack: 1.2, vib: 6, vibRate: 0.7 }); }
    } else if (mood === 'relief') {
      if (inBar === 0) for (const n of ch) this.pad(mtof(n - 12), t, 4.6, 0.03);
      if (inBar === 4 && Math.random() < 0.6) this.flutePhrase(t);
    } else if (mood === 'camp') {
      if (inBar === 0) for (const n of ch) this.pad(mtof(n - 12), t, 4.2, 0.03);
      if (inBar % 4 === 0) this.pluck(mtof(ch[0]), t, 0.05);
    }
  }
  pad(f, t, dur, vol) {
    const c = this.ctx, now = c.currentTime + t;
    const g = this.out(0, 'music', 0.5);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const e = c.createGain(); e.gain.setValueAtTime(0.0001, now);
    e.gain.exponentialRampToValueAtTime(vol, now + 1.2);
    e.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    lp.connect(e); e.connect(g);
    for (const d of [-6, 6]) {
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = d;
      o.connect(lp); o.start(now); o.stop(now + dur + 0.1);
    }
  }
  pluck(f, t, vol) {
    this.tone({ t, f, dur: 1.1, type: 'triangle', vol, bus: 'music', rev: 0.35, attack: 0.004 });
    this.tone({ t, f: f * 2, dur: 0.35, type: 'sine', vol: vol * 0.4, bus: 'music', attack: 0.003 });
  }
  flutePhrase(t) {
    const notes = [69, 72, 74, 76, 79, 81];
    let tt = t; const n = 3 + ((Math.random() * 3) | 0);
    let idx = (Math.random() * notes.length) | 0;
    for (let i = 0; i < n; i++) {
      idx = clamp(idx + ((Math.random() * 3) | 0) - 1, 0, notes.length - 1);
      const d = 0.4 + Math.random() * 0.5;
      this.tone({ t: tt, f: mtof(notes[idx]), dur: d + 0.2, vol: 0.03, bus: 'music', rev: 0.7, attack: 0.08, vib: 4, vibRate: 5 });
      tt += d;
    }
  }

  // ---------- efeitos ----------
  play(name, o = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const pan = o.pan || 0, v = o.vol ?? 1;
    switch (name) {
      case 'step': {
        const s = o.surface;
        if (s === 'leaves') this.noiseBurst({ dur: 0.07, f: 2600, q: 0.6, vol: 0.09 * v, pan });
        else if (s === 'wood') { this.tone({ f: 140, f2: 90, dur: 0.06, type: 'triangle', vol: 0.12 * v, pan }); this.noiseBurst({ dur: 0.03, type: 'lowpass', f: 1200, vol: 0.06 * v, pan }); }
        else if (s === 'water') this.noiseBurst({ dur: 0.16, f: 900, f2: 2500, q: 1.2, vol: 0.12 * v, pan });
        else if (s === 'mud') this.noiseBurst({ dur: 0.12, type: 'lowpass', f: 420, vol: 0.16 * v, pan });
        else if (s === 'sand') this.noiseBurst({ dur: 0.06, type: 'highpass', f: 3500, vol: 0.05 * v, pan });
        else if (s === 'grass') this.noiseBurst({ dur: 0.06, f: 3600, q: 0.8, vol: 0.05 * v, pan });
        else this.noiseBurst({ dur: 0.05, type: 'lowpass', f: 900, vol: 0.09 * v, pan });
        break;
      }
      case 'twig':
        for (let i = 0; i < 3; i++) this.noiseBurst({ t: i * 0.025 + Math.random() * 0.01, dur: 0.025, type: 'highpass', f: 1800, vol: 0.35 * v, pan, rev: 0.25 });
        break;
      case 'pickup':
        this.tone({ f: 784, dur: 0.12, type: 'triangle', vol: 0.12, attack: 0.005 });
        this.tone({ t: 0.08, f: 1175, dur: 0.22, type: 'triangle', vol: 0.12, attack: 0.005 });
        break;
      case 'mission':
        [523, 659, 784, 1046].forEach((f, i) => this.tone({ t: i * 0.09, f, dur: 0.5, type: 'triangle', vol: 0.1, rev: 0.4 }));
        break;
      case 'discover':
        [880, 1318].forEach((f, i) => this.tone({ t: i * 0.12, f, dur: 0.7, vol: 0.08, rev: 0.6 }));
        break;
      case 'ui': this.tone({ f: 660, dur: 0.05, type: 'square', vol: 0.03 }); break;
      case 'wrong': this.tone({ f: 220, f2: 180, dur: 0.25, type: 'triangle', vol: 0.1 }); break;
      case 'lantern': this.noiseBurst({ dur: 0.02, type: 'highpass', f: 3000, vol: 0.2 }); this.tone({ f: 2400, dur: 0.03, type: 'square', vol: 0.02 }); break;
      case 'hammer':
        for (let i = 0; i < 4; i++) { this.tone({ t: i * 0.42, f: 120, f2: 60, dur: 0.12, type: 'triangle', vol: 0.25, rev: 0.3 }); this.noiseBurst({ t: i * 0.42, dur: 0.05, type: 'lowpass', f: 1500, vol: 0.2 }); }
        break;
      case 'cut': this.noiseBurst({ dur: 0.12, f: 3000, f2: 900, q: 2, vol: 0.25 }); break;
      case 'drink': for (let i = 0; i < 3; i++) this.tone({ t: i * 0.18, f: 300, f2: 500, dur: 0.1, vol: 0.08 }); break;
      case 'eat': for (let i = 0; i < 3; i++) this.noiseBurst({ t: i * 0.2, dur: 0.06, type: 'lowpass', f: 800, vol: 0.15 }); break;
      case 'splash': this.noiseBurst({ dur: 0.45, f: 1800, f2: 500, q: 0.8, vol: 0.25 * v, pan, rev: 0.3 }); break;
      case 'dodge': this.noiseBurst({ dur: 0.18, f: 600, f2: 2400, q: 1, vol: 0.12 }); break;
      case 'hurt': this.tone({ f: 200, f2: 90, dur: 0.18, type: 'square', vol: 0.06 }); this.noiseBurst({ dur: 0.1, type: 'lowpass', f: 600, vol: 0.2 }); break;
      case 'shot':
        this.noiseBurst({ dur: 0.6, type: 'lowpass', f: 2600, f2: 300, vol: 0.6, rev: 0.8, attack: 0.001 });
        this.tone({ f: 90, f2: 40, dur: 0.4, type: 'sine', vol: 0.5 });
        break;
      case 'click': this.tone({ f: 1800, dur: 0.03, type: 'square', vol: 0.04 }); break;
      case 'flap':
        for (let i = 0; i < 7; i++) this.noiseBurst({ t: i * 0.07, dur: 0.06, type: 'lowpass', f: 1400 - i * 80, vol: 0.18 * v, pan });
        this.tone({ f: 1500, f2: 1100, dur: 0.15, type: 'sawtooth', vol: 0.03 * v, pan, rev: 0.3 });
        break;
      case 'monkey':
        for (let i = 0; i < 6; i++) { const f = 1100 + Math.random() * 900; this.tone({ t: i * 0.09, f, f2: f * 1.3, dur: 0.07, type: 'triangle', vol: 0.07 * v, pan, rev: 0.4 }); }
        break;
      case 'arara':
        for (let i = 0; i < 3; i++) this.noiseBurst({ t: i * 0.35, dur: 0.22, f: 1300, q: 3, vol: 0.12 * v, pan, rev: 0.6 });
        break;
      case 'rustle': this.noiseBurst({ dur: 0.35, f: 2200, q: 0.5, vol: 0.12 * v, pan }); break;
      case 'capivara': this.tone({ f: 420, f2: 380, dur: 0.12, type: 'square', vol: 0.03 * v, pan }); break;
      case 'chicken': for (let i = 0; i < 3; i++) this.tone({ t: i * 0.12, f: 700, f2: 560, dur: 0.09, type: 'sawtooth', vol: 0.025 * v, pan }); break;
      case 'whistle': this.whistle(pan, o.dur || 2.6, v); break;
      case 'sting': {
        for (const f of [55, 58.3, 82.4]) this.tone({ f, dur: 4, type: 'sawtooth', vol: 0.05, rev: 0.8, attack: 1.2 });
        this.tone({ t: 0.6, f: 1760, dur: 3, vol: 0.02, rev: 1, attack: 1, vib: 12 });
        break;
      }
      case 'heart': this.tone({ f: 60, f2: 40, dur: 0.15, vol: 0.25 }); this.tone({ t: 0.22, f: 55, f2: 38, dur: 0.15, vol: 0.18 }); break;
      case 'page': this.noiseBurst({ dur: 0.12, f: 4000, f2: 2000, q: 0.5, vol: 0.06 }); break;
      case 'fire': this.noiseBurst({ dur: 0.8, f: 400, f2: 1200, q: 0.4, vol: 0.2 }); break;
      // ---------- queixadas ----------
      case 'grunt': {
        const f = (o.pitch || 1) * (95 + Math.random() * 30);
        this.tone({ f, f2: f * 0.7, dur: 0.16 + Math.random() * 0.08, type: 'sawtooth', vol: 0.05 * v, pan, rev: 0.2 });
        this.noiseBurst({ dur: 0.14, type: 'lowpass', f: 500, vol: 0.09 * v, pan });
        break;
      }
      case 'clack': {
        // o "bater de queixo" que dá nome ao bicho
        const n = 4 + ((Math.random() * 4) | 0);
        for (let i = 0; i < n; i++) {
          const tt = i * (0.055 + Math.random() * 0.02);
          this.noiseBurst({ t: tt, dur: 0.018, type: 'highpass', f: 2200, vol: 0.22 * v, pan, rev: 0.15, attack: 0.001 });
          this.tone({ t: tt, f: 1300 + Math.random() * 300, dur: 0.02, type: 'square', vol: 0.025 * v, pan, attack: 0.001 });
        }
        break;
      }
      case 'squeal': this.tone({ f: 700 + Math.random() * 200, f2: 1100, dur: 0.18, type: 'sawtooth', vol: 0.03 * v, pan, rev: 0.3 }); break;
      case 'bite':
        this.noiseBurst({ dur: 0.05, type: 'highpass', f: 1800, vol: 0.3, pan, attack: 0.001 });
        this.tone({ f: 120, f2: 70, dur: 0.18, type: 'sawtooth', vol: 0.08, pan });
        break;
      case 'knock': for (let i = 0; i < 3; i++) this.tone({ t: i * 0.16, f: 230, f2: 170, dur: 0.09, type: 'triangle', vol: 0.22 * v, pan, rev: 0.5 }); break;
      case 'fruits': for (let i = 0; i < 6; i++) { this.noiseBurst({ t: i * 0.09 + Math.random() * 0.05, dur: 0.05, type: 'lowpass', f: 900, vol: 0.2 * v, pan, rev: 0.2 }); } this.noiseBurst({ dur: 0.5, f: 2400, q: 0.5, vol: 0.12 * v, pan }); break;
      case 'thud':
        this.tone({ f: 70, f2: 35, dur: 0.6, type: 'sine', vol: 0.45 * v, pan, rev: 0.4 });
        this.noiseBurst({ dur: 0.5, type: 'lowpass', f: 600, f2: 150, vol: 0.3 * v, pan, rev: 0.3 });
        break;
      case 'roll': for (let i = 0; i < 8; i++) this.noiseBurst({ t: i * 0.11, dur: 0.1, type: 'lowpass', f: 300 + i * 20, vol: 0.18 * v, pan }); break;
      case 'creak': this.tone({ f: 180, f2: 260, dur: 0.5, type: 'sawtooth', vol: 0.03 * v, pan, vib: 30, vibRate: 23 }); break;
      case 'bush': this.noiseBurst({ dur: 0.22, f: 3200, q: 0.4, vol: 0.12 * v, pan }); this.noiseBurst({ t: 0.05, dur: 0.12, type: 'highpass', f: 4500, vol: 0.06 * v, pan }); break;
      case 'stone': this.noiseBurst({ dur: 0.04, type: 'highpass', f: 2500, vol: 0.2 * v, pan }); this.tone({ f: 900, f2: 600, dur: 0.05, type: 'triangle', vol: 0.05 * v, pan }); break;
      case 'tapir': this.tone({ f: 2400, f2: 1800, dur: 0.5, type: 'sine', vol: 0.03 * v, pan, rev: 0.6, vib: 40, vibRate: 13 }); break;
      // ---------- várzea (Fase 3) ----------
      case 'paddle': this.noiseBurst({ dur: 0.22, f: 700, f2: 1800, q: 0.9, vol: 0.13 * v, pan, rev: 0.15 }); this.noiseBurst({ t: 0.12, dur: 0.12, type: 'lowpass', f: 500, vol: 0.06 * v, pan }); break;
      case 'canoeHit': this.tone({ f: 150, f2: 85, dur: 0.22, type: 'triangle', vol: 0.22 * v, pan, rev: 0.3 }); this.noiseBurst({ dur: 0.08, type: 'lowpass', f: 900, vol: 0.18 * v, pan }); break;
      case 'canoeScrape': this.noiseBurst({ dur: 0.35, f: 500, f2: 260, q: 1.4, vol: 0.14 * v, pan }); break;
      case 'fishjump': this.noiseBurst({ dur: 0.12, f: 2600, f2: 1200, q: 1, vol: 0.08 * v, pan }); this.noiseBurst({ t: 0.7, dur: 0.18, f: 1600, f2: 600, q: 1, vol: 0.1 * v, pan, rev: 0.2 }); break;
      case 'mudslosh': this.noiseBurst({ dur: 0.2, type: 'lowpass', f: 380, f2: 220, vol: 0.18 * v, pan }); break;
      case 'frogs': for (let i = 0; i < 4; i++) this.frog((Math.random() * 2 - 1) * 0.8, 0.05 * v); break;
      case 'waves': for (let i = 0; i < 3; i++) this.noiseBurst({ t: i * 0.5, dur: 0.9, type: 'lowpass', f: 700, f2: 300, vol: 0.18 * v, pan, rev: 0.4, attack: 0.25 }); break;
      case 'thunder': {
        const far = o.far ? 0.5 : 1;
        this.noiseBurst({ dur: 2.8 * (o.far ? 1.3 : 1), type: 'lowpass', f: o.far ? 160 : 420, f2: 60, vol: 0.5 * v * far, pan, rev: 0.8, attack: o.far ? 0.4 : 0.02 });
        if (!o.far) this.noiseBurst({ dur: 0.25, type: 'lowpass', f: 1600, f2: 400, vol: 0.25 * v, pan });
        break;
      }
      case 'deep': {
        // ronco grave da criatura: quase abaixo do que se ouve, com tremor lento
        const k = o.far ? 0.55 : 1;
        this.tone({ f: 48, f2: 34, dur: 3.2, type: 'sine', vol: 0.4 * v * k, pan, rev: 0.7, attack: 0.6, vib: 3, vibRate: 2.5, curve: 'lin' });
        this.tone({ t: 0.3, f: 72, f2: 55, dur: 2.4, type: 'triangle', vol: 0.06 * v * k, pan, rev: 0.8, attack: 0.5 });
        this.noiseBurst({ dur: 2.6, type: 'lowpass', f: 140, vol: 0.18 * v * k, pan, rev: 0.6, attack: 0.8 });
        break;
      }
      case 'bigsplash': this.noiseBurst({ dur: 1.2, f: 1400, f2: 300, q: 0.6, vol: 0.45 * v, pan, rev: 0.5, attack: 0.005 }); this.tone({ f: 90, f2: 40, dur: 0.7, type: 'sine', vol: 0.35 * v, pan, rev: 0.4 }); break;
    }
  }

  // assobio misterioso: glissando agudo com vibrato e muito reverb
  whistle(pan, dur, v = 1) {
    const c = this.ctx, now = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(1700, now);
    o.frequency.linearRampToValueAtTime(2550, now + dur * 0.45);
    o.frequency.linearRampToValueAtTime(2450, now + dur * 0.7);
    o.frequency.exponentialRampToValueAtTime(1500, now + dur);
    const l = c.createOscillator(); l.frequency.value = 6.5; const lg = c.createGain(); lg.gain.value = 22;
    l.connect(lg); lg.connect(o.frequency);
    const e = c.createGain(); e.gain.setValueAtTime(0.0001, now);
    e.gain.exponentialRampToValueAtTime(0.09 * v, now + 0.25);
    e.gain.setValueAtTime(0.09 * v, now + dur * 0.75);
    e.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(e); e.connect(this.out(pan, 'sfx', 0.9));
    o.start(now); l.start(now); o.stop(now + dur + 0.1); l.stop(now + dur + 0.1);
  }
}
