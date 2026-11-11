(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // js/core/util.js
  var clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  var lerp = (a, b, t) => a + (b - a) * t;
  var dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  var TAU = Math.PI * 2;
  var easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  function mulberry32(seed) {
    let s = seed >>> 0;
    return function() {
      s = s + 1831565813 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hash2(x, y, s = 0) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041) | 0;
    h = Math.imul(h ^ h >>> 13, 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function valueNoise(x, y, s = 0) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s);
    const c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  function fbm(x, y, s = 0, oct = 3) {
    let t = 0, a = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) {
      t += valueNoise(x * f, y * f, s + i * 17) * a;
      n += a;
      a *= 0.5;
      f *= 2;
    }
    return t / n;
  }
  function formatTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  function formatClock(min) {
    const h = Math.floor(min / 60) % 24, m = Math.floor(min % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  function angleDiff(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    return d;
  }
  function dirFromVec(x, y) {
    if (Math.abs(x) > Math.abs(y)) return x > 0 ? "right" : "left";
    return y > 0 ? "down" : "up";
  }
  var DIR_VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  // js/core/input.js
  var KEYMAP = {
    KeyW: "up",
    ArrowUp: "up",
    KeyS: "down",
    ArrowDown: "down",
    KeyA: "left",
    ArrowLeft: "left",
    KeyD: "right",
    ArrowRight: "right",
    ShiftLeft: "run",
    ShiftRight: "run",
    KeyE: "interact",
    KeyF: "lantern",
    Space: "dodge",
    KeyI: "inventory",
    KeyM: "map",
    Escape: "pause",
    KeyP: "pause",
    KeyC: "sneak",
    ControlLeft: "sneak",
    KeyQ: "aim",
    Digit1: "use1",
    Digit2: "use2",
    Digit3: "use3",
    Enter: "confirm",
    Tab: "drawer"
  };
  var Input = class {
    constructor(canvas) {
      this.canvas = canvas;
      this.down = /* @__PURE__ */ new Set();
      this.pressedSet = /* @__PURE__ */ new Set();
      this.mouse = { x: 0, y: 0, moved: -1e9, inside: false };
      this.joy = { x: 0, y: 0, active: false, id: null };
      this.lastDevice = "keyboard";
      this.listeners = [];
      window.addEventListener("keydown", (e) => {
        const a = KEYMAP[e.code];
        if (!a) return;
        const tag = e.target && e.target.tagName || "";
        if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
        if (a !== "pause" || true) e.preventDefault();
        this.lastDevice = "keyboard";
        if (!e.repeat) {
          this.pressedSet.add(a);
          this.emit(a);
        }
        this.down.add(a);
      });
      window.addEventListener("keyup", (e) => {
        const a = KEYMAP[e.code];
        if (a) this.down.delete(a);
      });
      window.addEventListener("blur", () => this.down.clear());
      canvas.addEventListener("mousemove", (e) => {
        const r = canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - r.left;
        this.mouse.y = e.clientY - r.top;
        this.mouse.moved = performance.now();
        this.mouse.inside = true;
        this.lastDevice = "mouse";
      });
      canvas.addEventListener("mouseleave", () => {
        this.mouse.inside = false;
      });
      canvas.addEventListener("contextmenu", (e) => e.preventDefault());
      canvas.addEventListener("mousedown", (e) => {
        if (e.button === 2) {
          this.down.add("aim");
          this.pressedSet.add("aim");
        }
        if (e.button === 0) {
          this.pressedSet.add("click");
          this.emit("click");
        }
      });
      window.addEventListener("mouseup", (e) => {
        if (e.button === 2) this.down.delete("aim");
      });
    }
    on(fn) {
      this.listeners.push(fn);
    }
    emit(a) {
      for (const f of this.listeners) f(a);
    }
    isDown(a) {
      return this.down.has(a);
    }
    pressed(a) {
      return this.pressedSet.has(a);
    }
    endFrame() {
      this.pressedSet.clear();
    }
    axis() {
      if (this.joy.active) {
        const m2 = Math.hypot(this.joy.x, this.joy.y);
        if (m2 < 0.18) return { x: 0, y: 0, m: 0 };
        return { x: this.joy.x, y: this.joy.y, m: Math.min(1, m2) };
      }
      let x = 0, y = 0;
      if (this.down.has("left")) x -= 1;
      if (this.down.has("right")) x += 1;
      if (this.down.has("up")) y -= 1;
      if (this.down.has("down")) y += 1;
      const m = Math.hypot(x, y);
      if (m > 0) {
        x /= m;
        y /= m;
      }
      return { x, y, m: m > 0 ? 1 : 0 };
    }
    bindTouch(root) {
      const joy = root.querySelector("#joy");
      const knob = root.querySelector("#joy-knob");
      const R = 46;
      const setKnob = (dx, dy) => {
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
      };
      const start = (e) => {
        e.preventDefault();
        this.lastDevice = "touch";
        this.joy.active = true;
        this.joy.id = e.pointerId;
        joy.setPointerCapture(e.pointerId);
        move(e);
      };
      const move = (e) => {
        if (!this.joy.active || e.pointerId !== this.joy.id) return;
        const r = joy.getBoundingClientRect();
        let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        const m = Math.hypot(dx, dy);
        if (m > R) {
          dx = dx / m * R;
          dy = dy / m * R;
        }
        this.joy.x = dx / R;
        this.joy.y = dy / R;
        setKnob(dx, dy);
      };
      const end = (e) => {
        if (e.pointerId !== this.joy.id) return;
        this.joy.active = false;
        this.joy.x = 0;
        this.joy.y = 0;
        setKnob(0, 0);
      };
      joy.addEventListener("pointerdown", start);
      joy.addEventListener("pointermove", move);
      joy.addEventListener("pointerup", end);
      joy.addEventListener("pointercancel", end);
      root.querySelectorAll("[data-act]").forEach((b) => {
        const a = b.dataset.act;
        b.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          this.lastDevice = "touch";
          this.down.add(a);
          this.pressedSet.add(a);
          this.emit(a);
          b.classList.add("on");
        });
        const up = () => {
          this.down.delete(a);
          b.classList.remove("on");
        };
        b.addEventListener("pointerup", up);
        b.addEventListener("pointercancel", up);
        b.addEventListener("pointerleave", up);
      });
    }
  };

  // js/core/audio.js
  var mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  var AudioEngine = class {
    constructor() {
      this.ctx = null;
      this.vol = { master: 0.8, music: 0.5, sfx: 0.85, amb: 0.75 };
      this.mood = "calm";
      this.env = { dawn: 1, river: 0, riverPan: 0, insects: 1, frogs: 1, birds: 1, quiet: 0, fire: 0, rain: 0 };
      this.nextAmb = {};
      this.musicOn = true;
    }
    init() {
      if (this.ctx) {
        this.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain();
      this.comp = c.createDynamicsCompressor();
      this.comp.threshold.value = -14;
      this.comp.ratio.value = 4;
      this.master.connect(this.comp);
      this.comp.connect(c.destination);
      this.musicG = c.createGain();
      this.musicG.connect(this.master);
      this.musicMix = c.createGain();
      this.musicMix.connect(this.musicG);
      this.sfxG = c.createGain();
      this.sfxG.connect(this.master);
      this.ambG = c.createGain();
      this.ambG.connect(this.master);
      this.duck = c.createGain();
      this.duck.connect(this.ambG);
      this.reverb = c.createConvolver();
      this.reverb.buffer = this.makeIR(3.2, 2.6);
      this.revOut = c.createGain();
      this.revOut.gain.value = 0.55;
      this.reverb.connect(this.revOut);
      this.revOut.connect(this.master);
      this.noise = this.makeNoise(3);
      this.applyVolumes();
      this.startAmbientBeds();
      this.startMusic();
    }
    resume() {
      if (this.ctx && this.ctx.state !== "running") this.ctx.resume().catch(() => {
      });
    }
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
    out(pan = 0, bus = "sfx", rev = 0) {
      const c = this.ctx;
      const g = c.createGain();
      const p = c.createStereoPanner ? c.createStereoPanner() : null;
      const dest = bus === "music" ? this.musicMix : bus === "amb" ? this.duck : this.sfxG;
      if (p) {
        p.pan.value = clamp(pan, -1, 1);
        g.connect(p);
        p.connect(dest);
        if (rev > 0) {
          const s = c.createGain();
          s.gain.value = rev;
          p.connect(s);
          s.connect(this.reverb);
        }
      } else {
        g.connect(dest);
      }
      return g;
    }
    noiseBurst({ t = 0, dur = 0.08, type = "bandpass", f = 1500, q = 1, vol = 0.3, pan = 0, bus = "sfx", rev = 0, f2 = null, attack = 3e-3 }) {
      vol = Math.max(2e-4, vol);
      const c = this.ctx;
      const now = c.currentTime + Math.max(0, t);
      const s = c.createBufferSource();
      s.buffer = this.noise;
      s.playbackRate.value = 0.8 + Math.random() * 0.4;
      const fl = c.createBiquadFilter();
      fl.type = type;
      fl.frequency.setValueAtTime(f, now);
      fl.Q.value = q;
      if (f2) fl.frequency.exponentialRampToValueAtTime(f2, now + dur);
      const g = this.out(pan, bus, rev);
      const e = c.createGain();
      e.gain.setValueAtTime(1e-4, now);
      e.gain.exponentialRampToValueAtTime(vol, now + attack);
      e.gain.exponentialRampToValueAtTime(1e-4, now + dur);
      s.connect(fl);
      fl.connect(e);
      e.connect(g);
      s.start(now, Math.random() * 2);
      s.stop(now + dur + 0.05);
    }
    tone({ t = 0, f = 440, f2 = null, dur = 0.2, type = "sine", vol = 0.2, pan = 0, bus = "sfx", rev = 0, attack = 0.01, vib = 0, vibRate = 5, curve = "exp" }) {
      vol = Math.max(2e-4, vol);
      const c = this.ctx;
      const now = c.currentTime + Math.max(0, t);
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f, now);
      if (f2) {
        if (curve === "exp") o.frequency.exponentialRampToValueAtTime(f2, now + dur);
        else o.frequency.linearRampToValueAtTime(f2, now + dur);
      }
      if (vib) {
        const l = c.createOscillator();
        const lg = c.createGain();
        l.frequency.value = vibRate;
        lg.gain.value = vib;
        l.connect(lg);
        lg.connect(o.frequency);
        l.start(now);
        l.stop(now + dur + 0.1);
      }
      const e = c.createGain();
      e.gain.setValueAtTime(1e-4, now);
      e.gain.exponentialRampToValueAtTime(vol, now + attack);
      e.gain.exponentialRampToValueAtTime(1e-4, now + dur);
      o.connect(e);
      e.connect(this.out(pan, bus, rev));
      o.start(now);
      o.stop(now + dur + 0.05);
      return o;
    }
    // ---------- leitos de ambiente ----------
    startAmbientBeds() {
      const c = this.ctx;
      const loop = (type, f, q, gain) => {
        const s = c.createBufferSource();
        s.buffer = this.noise;
        s.loop = true;
        const fl = c.createBiquadFilter();
        fl.type = type;
        fl.frequency.value = f;
        fl.Q.value = q;
        const g = c.createGain();
        g.gain.value = gain;
        s.connect(fl);
        fl.connect(g);
        g.connect(this.duck);
        s.start();
        return { s, fl, g };
      };
      this.bedWind = loop("lowpass", 380, 0.6, 0.05);
      this.bedLeaves = loop("bandpass", 3200, 0.5, 0.012);
      this.bedRiver = loop("lowpass", 900, 0.7, 0);
      const rp = c.createStereoPanner ? c.createStereoPanner() : null;
      if (rp) {
        this.bedRiver.g.disconnect();
        this.bedRiver.g.connect(rp);
        rp.connect(this.duck);
        this.riverPanner = rp;
      }
      this.bedFire = loop("bandpass", 700, 0.4, 0);
      this.bedRain = loop("highpass", 1400, 0.4, 0);
      this.bedRainLow = loop("lowpass", 500, 0.5, 0);
      this.bedHerd = loop("lowpass", 240, 0.8, 0);
      this.bedHerdLeaves = loop("bandpass", 1900, 0.7, 0);
      if (c.createStereoPanner) {
        const hp = c.createStereoPanner();
        for (const b of [this.bedHerd, this.bedHerdLeaves]) {
          b.g.disconnect();
          b.g.connect(hp);
        }
        hp.connect(this.duck);
        this.herdPanner = hp;
      }
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = 4600;
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 5200;
      bp.Q.value = 6;
      const am = c.createGain();
      am.gain.value = 0;
      const lfo = c.createOscillator();
      lfo.frequency.value = 38;
      const lg = c.createGain();
      lg.gain.value = 0.5;
      lfo.connect(lg);
      lg.connect(am.gain);
      const ig = c.createGain();
      ig.gain.value = 0;
      o.connect(bp);
      bp.connect(am);
      am.connect(ig);
      ig.connect(this.duck);
      o.start();
      lfo.start();
      this.bedInsects = ig;
    }
    setDuck(v, time = 1.5) {
      if (this.ctx) this.duck.gain.setTargetAtTime(v, this.ctx.currentTime, time / 3);
    }
    update(dt, env) {
      if (!this.ctx || this.ctx.state !== "running") return;
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
      this.bedInsects.gain.setTargetAtTime(6e-3 * E.insects * swell * q, t, 0.8);
      this.sched("bird", 1.2 + Math.random() * 3.5 / Math.max(0.2, E.birds * q), () => this.songbird((Math.random() * 2 - 1) * 0.9, 0.05 + Math.random() * 0.05));
      if (E.dawn > 0.2) this.sched("inambu", 9 + Math.random() * 14, () => this.inambu((Math.random() * 2 - 1) * 0.8, 0.07 * E.dawn * q));
      if (E.frogs > 0.05) this.sched("frog", 0.6 + Math.random() * 2.5, () => this.frog(Math.random() * 2 - 1, 0.05 * E.frogs * q));
      if (E.fire > 0.05) this.sched("crackle", 0.1 + Math.random() * 0.4, () => this.noiseBurst({ dur: 0.03, type: "highpass", f: 2500, vol: 0.12 * E.fire, bus: "amb" }));
    }
    sched(key, interval, fn) {
      const t = this.ctx.currentTime;
      if (this.nextAmb[key] === void 0) this.nextAmb[key] = t + Math.random() * interval;
      if (t >= this.nextAmb[key]) {
        this.nextAmb[key] = t + interval;
        fn();
      }
    }
    songbird(pan, vol) {
      const base = 2200 + Math.random() * 2400, n = 2 + (Math.random() * 5 | 0);
      for (let i = 0; i < n; i++) {
        const f = base * (0.85 + Math.random() * 0.4);
        this.tone({ t: i * (0.07 + Math.random() * 0.05), f, f2: f * (0.7 + Math.random() * 0.7), dur: 0.06 + Math.random() * 0.06, vol, pan, bus: "amb", rev: 0.3 });
      }
    }
    // inambu: assobio trêmulo e descendente típico do amanhecer
    inambu(pan, vol) {
      for (let i = 0; i < 3; i++) this.tone({ t: i * 0.9, f: 1250 + i * 60, f2: 1150 + i * 60, dur: 0.8, vol, pan, bus: "amb", rev: 0.6, vib: 18, vibRate: 9, attack: 0.15 });
    }
    frog(pan, vol) {
      const f = 140 + Math.random() * 160;
      for (let i = 0; i < 3; i++) this.tone({ t: i * 0.07, f, f2: f * 0.8, type: "sawtooth", dur: 0.05, vol, pan, bus: "amb", rev: 0.2 });
    }
    // ---------- trilha generativa ----------
    startMusic() {
      this.beat = 0;
      this.nextNote = this.ctx.currentTime + 0.5;
      this.tempo = 68;
      this.chords = [[57, 64, 72], [62, 66, 69], [57, 64, 72], [55, 62, 67]];
      this.musicTimer = setInterval(() => this.musicTick(), 90);
    }
    // troca de clima musical com transição suave (abaixa a mixagem, troca, sobe de novo)
    setMood(m) {
      if (this.mood === m) return;
      this.mood = m;
      this.tempo = m === "chase" ? 96 : 68;
      if (!this.ctx) return;
      const t = this.ctx.currentTime, g = this.musicMix.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0.15, t + 0.45);
      g.linearRampToValueAtTime(1, t + (m === "chase" ? 1.2 : 2.6));
    }
    musicTick() {
      if (!this.ctx || this.ctx.state !== "running" || !this.musicOn) return;
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
      if (mood === "calm") {
        if (inBar === 0) for (const n of ch) this.pad(mtof(n - 12), t, 4.2, 0.035);
        if (inBar % 2 === 0 && Math.random() < 0.7) {
          const n = ch[inBar / 2 % 3] + (Math.random() < 0.3 ? 12 : 0);
          this.pluck(mtof(n), t, 0.06);
        }
        if (inBar === 3 || inBar === 7) this.noiseBurst({ t, dur: 0.05, type: "highpass", f: 6e3, vol: 0.025, bus: "music" });
        if (bar % 2 === 1 && inBar === 2 && Math.random() < 0.55) this.flutePhrase(t);
      } else if (mood === "mystery") {
        if (inBar === 0) {
          this.pad(mtof(45), t, 4.5, 0.05);
          this.pad(mtof(52), t, 4.5, 0.03);
          if (bar % 2) this.pad(mtof(58), t, 4.5, 0.018);
        }
        if (inBar === 4 && Math.random() < 0.5) this.tone({ t, f: mtof(81 + (Math.random() < 0.5 ? 1 : 0)), dur: 2.4, vol: 0.02, bus: "music", rev: 0.9, attack: 0.8, vib: 4 });
      } else if (mood === "tension") {
        if (inBar % 2 === 0) this.tone({ t, f: mtof(45), dur: 0.25, type: "triangle", vol: 0.08, bus: "music" });
        if (inBar === 0) this.pad(mtof(46), t, 4, 0.04);
      } else if (mood === "stealth") {
        if (inBar % 4 === 0) this.tone({ t, f: mtof(45), f2: mtof(45) * 0.98, dur: 0.6, type: "sine", vol: 0.07, bus: "music" });
        if (inBar === 0) this.pad(mtof(52), t, 4.4, 0.025);
        if (inBar % 2 === 1 && Math.random() < 0.5) this.noiseBurst({ t, dur: 0.04, type: "highpass", f: 7e3, vol: 0.018, bus: "music" });
        if (bar % 4 === 3 && inBar === 6) this.tone({ t, f: mtof(76), dur: 1.4, vol: 0.016, bus: "music", rev: 0.8, attack: 0.3, vib: 5 });
      } else if (mood === "chase") {
        const h = 60 / this.tempo / 4;
        const bass = [45, 45, 48, 45, 50, 45, 48, 43][inBar];
        this.tone({ t, f: mtof(bass - 12), dur: 0.22, type: "triangle", vol: 0.11, bus: "music" });
        this.tone({ t: t + h, f: mtof(bass), dur: 0.12, type: "triangle", vol: 0.05, bus: "music" });
        if (inBar % 2 === 0) {
          this.tone({ t, f: 95, f2: 42, dur: 0.28, type: "sine", vol: 0.28, bus: "music" });
          this.noiseBurst({ t, dur: 0.07, type: "lowpass", f: 300, vol: 0.12, bus: "music" });
        }
        if (inBar === 3 || inBar === 7) {
          this.noiseBurst({ t, dur: 0.12, f: 1800, q: 0.7, vol: 0.09, bus: "music", rev: 0.2 });
          this.tone({ t, f: 180, f2: 110, dur: 0.15, type: "triangle", vol: 0.08, bus: "music" });
        }
        this.noiseBurst({ t: t + h, dur: 0.03, type: "highpass", f: 6500, vol: 0.03, bus: "music" });
        if (inBar === 0) {
          for (const n of [57, 60, 64]) this.tone({ t, f: mtof(n), dur: 3.6, type: "sawtooth", vol: 0.012, bus: "music", rev: 0.4, attack: 0.3, vib: 9, vibRate: 11 });
        }
      } else if (mood === "dread") {
        if (inBar === 0 || inBar === 3) this.tone({ t, f: 52, f2: 40, dur: 0.35, type: "sine", vol: 0.18, bus: "music" });
        if (inBar === 0) {
          this.pad(mtof(40), t, 4.6, 0.05);
          this.tone({ t, f: mtof(64) * 1.01, dur: 4, vol: 0.012, bus: "music", rev: 0.9, attack: 1.2, vib: 6, vibRate: 0.7 });
        }
      } else if (mood === "relief") {
        if (inBar === 0) for (const n of ch) this.pad(mtof(n - 12), t, 4.6, 0.03);
        if (inBar === 4 && Math.random() < 0.6) this.flutePhrase(t);
      } else if (mood === "camp") {
        if (inBar === 0) for (const n of ch) this.pad(mtof(n - 12), t, 4.2, 0.03);
        if (inBar % 4 === 0) this.pluck(mtof(ch[0]), t, 0.05);
      }
    }
    pad(f, t, dur, vol) {
      const c = this.ctx, now = c.currentTime + t;
      const g = this.out(0, "music", 0.5);
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900;
      const e = c.createGain();
      e.gain.setValueAtTime(1e-4, now);
      e.gain.exponentialRampToValueAtTime(vol, now + 1.2);
      e.gain.exponentialRampToValueAtTime(1e-4, now + dur);
      lp.connect(e);
      e.connect(g);
      for (const d of [-6, 6]) {
        const o = c.createOscillator();
        o.type = "triangle";
        o.frequency.value = f;
        o.detune.value = d;
        o.connect(lp);
        o.start(now);
        o.stop(now + dur + 0.1);
      }
    }
    pluck(f, t, vol) {
      this.tone({ t, f, dur: 1.1, type: "triangle", vol, bus: "music", rev: 0.35, attack: 4e-3 });
      this.tone({ t, f: f * 2, dur: 0.35, type: "sine", vol: vol * 0.4, bus: "music", attack: 3e-3 });
    }
    flutePhrase(t) {
      const notes = [69, 72, 74, 76, 79, 81];
      let tt = t;
      const n = 3 + (Math.random() * 3 | 0);
      let idx = Math.random() * notes.length | 0;
      for (let i = 0; i < n; i++) {
        idx = clamp(idx + (Math.random() * 3 | 0) - 1, 0, notes.length - 1);
        const d = 0.4 + Math.random() * 0.5;
        this.tone({ t: tt, f: mtof(notes[idx]), dur: d + 0.2, vol: 0.03, bus: "music", rev: 0.7, attack: 0.08, vib: 4, vibRate: 5 });
        tt += d;
      }
    }
    // ---------- efeitos ----------
    play(name, o = {}) {
      if (!this.ctx || this.ctx.state !== "running") return;
      const pan = o.pan || 0, v = o.vol ?? 1;
      switch (name) {
        case "step": {
          const s = o.surface;
          if (s === "leaves") this.noiseBurst({ dur: 0.07, f: 2600, q: 0.6, vol: 0.09 * v, pan });
          else if (s === "wood") {
            this.tone({ f: 140, f2: 90, dur: 0.06, type: "triangle", vol: 0.12 * v, pan });
            this.noiseBurst({ dur: 0.03, type: "lowpass", f: 1200, vol: 0.06 * v, pan });
          } else if (s === "water") this.noiseBurst({ dur: 0.16, f: 900, f2: 2500, q: 1.2, vol: 0.12 * v, pan });
          else if (s === "mud") this.noiseBurst({ dur: 0.12, type: "lowpass", f: 420, vol: 0.16 * v, pan });
          else if (s === "sand") this.noiseBurst({ dur: 0.06, type: "highpass", f: 3500, vol: 0.05 * v, pan });
          else if (s === "grass") this.noiseBurst({ dur: 0.06, f: 3600, q: 0.8, vol: 0.05 * v, pan });
          else this.noiseBurst({ dur: 0.05, type: "lowpass", f: 900, vol: 0.09 * v, pan });
          break;
        }
        case "twig":
          for (let i = 0; i < 3; i++) this.noiseBurst({ t: i * 0.025 + Math.random() * 0.01, dur: 0.025, type: "highpass", f: 1800, vol: 0.35 * v, pan, rev: 0.25 });
          break;
        case "pickup":
          this.tone({ f: 784, dur: 0.12, type: "triangle", vol: 0.12, attack: 5e-3 });
          this.tone({ t: 0.08, f: 1175, dur: 0.22, type: "triangle", vol: 0.12, attack: 5e-3 });
          break;
        case "mission":
          [523, 659, 784, 1046].forEach((f, i) => this.tone({ t: i * 0.09, f, dur: 0.5, type: "triangle", vol: 0.1, rev: 0.4 }));
          break;
        case "discover":
          [880, 1318].forEach((f, i) => this.tone({ t: i * 0.12, f, dur: 0.7, vol: 0.08, rev: 0.6 }));
          break;
        case "ui":
          this.tone({ f: 660, dur: 0.05, type: "square", vol: 0.03 });
          break;
        case "wrong":
          this.tone({ f: 220, f2: 180, dur: 0.25, type: "triangle", vol: 0.1 });
          break;
        case "lantern":
          this.noiseBurst({ dur: 0.02, type: "highpass", f: 3e3, vol: 0.2 });
          this.tone({ f: 2400, dur: 0.03, type: "square", vol: 0.02 });
          break;
        case "hammer":
          for (let i = 0; i < 4; i++) {
            this.tone({ t: i * 0.42, f: 120, f2: 60, dur: 0.12, type: "triangle", vol: 0.25, rev: 0.3 });
            this.noiseBurst({ t: i * 0.42, dur: 0.05, type: "lowpass", f: 1500, vol: 0.2 });
          }
          break;
        case "cut":
          this.noiseBurst({ dur: 0.12, f: 3e3, f2: 900, q: 2, vol: 0.25 });
          break;
        case "drink":
          for (let i = 0; i < 3; i++) this.tone({ t: i * 0.18, f: 300, f2: 500, dur: 0.1, vol: 0.08 });
          break;
        case "eat":
          for (let i = 0; i < 3; i++) this.noiseBurst({ t: i * 0.2, dur: 0.06, type: "lowpass", f: 800, vol: 0.15 });
          break;
        case "splash":
          this.noiseBurst({ dur: 0.45, f: 1800, f2: 500, q: 0.8, vol: 0.25 * v, pan, rev: 0.3 });
          break;
        case "dodge":
          this.noiseBurst({ dur: 0.18, f: 600, f2: 2400, q: 1, vol: 0.12 });
          break;
        case "hurt":
          this.tone({ f: 200, f2: 90, dur: 0.18, type: "square", vol: 0.06 });
          this.noiseBurst({ dur: 0.1, type: "lowpass", f: 600, vol: 0.2 });
          break;
        case "shot":
          this.noiseBurst({ dur: 0.6, type: "lowpass", f: 2600, f2: 300, vol: 0.6, rev: 0.8, attack: 1e-3 });
          this.tone({ f: 90, f2: 40, dur: 0.4, type: "sine", vol: 0.5 });
          break;
        case "click":
          this.tone({ f: 1800, dur: 0.03, type: "square", vol: 0.04 });
          break;
        case "flap":
          for (let i = 0; i < 7; i++) this.noiseBurst({ t: i * 0.07, dur: 0.06, type: "lowpass", f: 1400 - i * 80, vol: 0.18 * v, pan });
          this.tone({ f: 1500, f2: 1100, dur: 0.15, type: "sawtooth", vol: 0.03 * v, pan, rev: 0.3 });
          break;
        case "monkey":
          for (let i = 0; i < 6; i++) {
            const f = 1100 + Math.random() * 900;
            this.tone({ t: i * 0.09, f, f2: f * 1.3, dur: 0.07, type: "triangle", vol: 0.07 * v, pan, rev: 0.4 });
          }
          break;
        case "arara":
          for (let i = 0; i < 3; i++) this.noiseBurst({ t: i * 0.35, dur: 0.22, f: 1300, q: 3, vol: 0.12 * v, pan, rev: 0.6 });
          break;
        case "rustle":
          this.noiseBurst({ dur: 0.35, f: 2200, q: 0.5, vol: 0.12 * v, pan });
          break;
        case "capivara":
          this.tone({ f: 420, f2: 380, dur: 0.12, type: "square", vol: 0.03 * v, pan });
          break;
        case "chicken":
          for (let i = 0; i < 3; i++) this.tone({ t: i * 0.12, f: 700, f2: 560, dur: 0.09, type: "sawtooth", vol: 0.025 * v, pan });
          break;
        case "whistle":
          this.whistle(pan, o.dur || 2.6, v);
          break;
        case "sting": {
          for (const f of [55, 58.3, 82.4]) this.tone({ f, dur: 4, type: "sawtooth", vol: 0.05, rev: 0.8, attack: 1.2 });
          this.tone({ t: 0.6, f: 1760, dur: 3, vol: 0.02, rev: 1, attack: 1, vib: 12 });
          break;
        }
        case "heart":
          this.tone({ f: 60, f2: 40, dur: 0.15, vol: 0.25 });
          this.tone({ t: 0.22, f: 55, f2: 38, dur: 0.15, vol: 0.18 });
          break;
        case "page":
          this.noiseBurst({ dur: 0.12, f: 4e3, f2: 2e3, q: 0.5, vol: 0.06 });
          break;
        case "fire":
          this.noiseBurst({ dur: 0.8, f: 400, f2: 1200, q: 0.4, vol: 0.2 });
          break;
        // ---------- queixadas ----------
        case "grunt": {
          const f = (o.pitch || 1) * (95 + Math.random() * 30);
          this.tone({ f, f2: f * 0.7, dur: 0.16 + Math.random() * 0.08, type: "sawtooth", vol: 0.05 * v, pan, rev: 0.2 });
          this.noiseBurst({ dur: 0.14, type: "lowpass", f: 500, vol: 0.09 * v, pan });
          break;
        }
        case "clack": {
          const n = 4 + (Math.random() * 4 | 0);
          for (let i = 0; i < n; i++) {
            const tt = i * (0.055 + Math.random() * 0.02);
            this.noiseBurst({ t: tt, dur: 0.018, type: "highpass", f: 2200, vol: 0.22 * v, pan, rev: 0.15, attack: 1e-3 });
            this.tone({ t: tt, f: 1300 + Math.random() * 300, dur: 0.02, type: "square", vol: 0.025 * v, pan, attack: 1e-3 });
          }
          break;
        }
        case "squeal":
          this.tone({ f: 700 + Math.random() * 200, f2: 1100, dur: 0.18, type: "sawtooth", vol: 0.03 * v, pan, rev: 0.3 });
          break;
        case "bite":
          this.noiseBurst({ dur: 0.05, type: "highpass", f: 1800, vol: 0.3, pan, attack: 1e-3 });
          this.tone({ f: 120, f2: 70, dur: 0.18, type: "sawtooth", vol: 0.08, pan });
          break;
        case "knock":
          for (let i = 0; i < 3; i++) this.tone({ t: i * 0.16, f: 230, f2: 170, dur: 0.09, type: "triangle", vol: 0.22 * v, pan, rev: 0.5 });
          break;
        case "fruits":
          for (let i = 0; i < 6; i++) {
            this.noiseBurst({ t: i * 0.09 + Math.random() * 0.05, dur: 0.05, type: "lowpass", f: 900, vol: 0.2 * v, pan, rev: 0.2 });
          }
          this.noiseBurst({ dur: 0.5, f: 2400, q: 0.5, vol: 0.12 * v, pan });
          break;
        case "thud":
          this.tone({ f: 70, f2: 35, dur: 0.6, type: "sine", vol: 0.45 * v, pan, rev: 0.4 });
          this.noiseBurst({ dur: 0.5, type: "lowpass", f: 600, f2: 150, vol: 0.3 * v, pan, rev: 0.3 });
          break;
        case "roll":
          for (let i = 0; i < 8; i++) this.noiseBurst({ t: i * 0.11, dur: 0.1, type: "lowpass", f: 300 + i * 20, vol: 0.18 * v, pan });
          break;
        case "creak":
          this.tone({ f: 180, f2: 260, dur: 0.5, type: "sawtooth", vol: 0.03 * v, pan, vib: 30, vibRate: 23 });
          break;
        case "bush":
          this.noiseBurst({ dur: 0.22, f: 3200, q: 0.4, vol: 0.12 * v, pan });
          this.noiseBurst({ t: 0.05, dur: 0.12, type: "highpass", f: 4500, vol: 0.06 * v, pan });
          break;
        case "stone":
          this.noiseBurst({ dur: 0.04, type: "highpass", f: 2500, vol: 0.2 * v, pan });
          this.tone({ f: 900, f2: 600, dur: 0.05, type: "triangle", vol: 0.05 * v, pan });
          break;
        case "tapir":
          this.tone({ f: 2400, f2: 1800, dur: 0.5, type: "sine", vol: 0.03 * v, pan, rev: 0.6, vib: 40, vibRate: 13 });
          break;
        // ---------- várzea (Fase 3) ----------
        case "paddle":
          this.noiseBurst({ dur: 0.22, f: 700, f2: 1800, q: 0.9, vol: 0.13 * v, pan, rev: 0.15 });
          this.noiseBurst({ t: 0.12, dur: 0.12, type: "lowpass", f: 500, vol: 0.06 * v, pan });
          break;
        case "canoeHit":
          this.tone({ f: 150, f2: 85, dur: 0.22, type: "triangle", vol: 0.22 * v, pan, rev: 0.3 });
          this.noiseBurst({ dur: 0.08, type: "lowpass", f: 900, vol: 0.18 * v, pan });
          break;
        case "canoeScrape":
          this.noiseBurst({ dur: 0.35, f: 500, f2: 260, q: 1.4, vol: 0.14 * v, pan });
          break;
        case "fishjump":
          this.noiseBurst({ dur: 0.12, f: 2600, f2: 1200, q: 1, vol: 0.08 * v, pan });
          this.noiseBurst({ t: 0.7, dur: 0.18, f: 1600, f2: 600, q: 1, vol: 0.1 * v, pan, rev: 0.2 });
          break;
        case "mudslosh":
          this.noiseBurst({ dur: 0.2, type: "lowpass", f: 380, f2: 220, vol: 0.18 * v, pan });
          break;
        case "frogs":
          for (let i = 0; i < 4; i++) this.frog((Math.random() * 2 - 1) * 0.8, 0.05 * v);
          break;
        case "waves":
          for (let i = 0; i < 3; i++) this.noiseBurst({ t: i * 0.5, dur: 0.9, type: "lowpass", f: 700, f2: 300, vol: 0.18 * v, pan, rev: 0.4, attack: 0.25 });
          break;
        case "thunder": {
          const far = o.far ? 0.5 : 1;
          this.noiseBurst({ dur: 2.8 * (o.far ? 1.3 : 1), type: "lowpass", f: o.far ? 160 : 420, f2: 60, vol: 0.5 * v * far, pan, rev: 0.8, attack: o.far ? 0.4 : 0.02 });
          if (!o.far) this.noiseBurst({ dur: 0.25, type: "lowpass", f: 1600, f2: 400, vol: 0.25 * v, pan });
          break;
        }
        case "deep": {
          const k = o.far ? 0.55 : 1;
          this.tone({ f: 48, f2: 34, dur: 3.2, type: "sine", vol: 0.4 * v * k, pan, rev: 0.7, attack: 0.6, vib: 3, vibRate: 2.5, curve: "lin" });
          this.tone({ t: 0.3, f: 72, f2: 55, dur: 2.4, type: "triangle", vol: 0.06 * v * k, pan, rev: 0.8, attack: 0.5 });
          this.noiseBurst({ dur: 2.6, type: "lowpass", f: 140, vol: 0.18 * v * k, pan, rev: 0.6, attack: 0.8 });
          break;
        }
        case "bigsplash":
          this.noiseBurst({ dur: 1.2, f: 1400, f2: 300, q: 0.6, vol: 0.45 * v, pan, rev: 0.5, attack: 5e-3 });
          this.tone({ f: 90, f2: 40, dur: 0.7, type: "sine", vol: 0.35 * v, pan, rev: 0.4 });
          break;
      }
    }
    // assobio misterioso: glissando agudo com vibrato e muito reverb
    whistle(pan, dur, v = 1) {
      const c = this.ctx, now = c.currentTime;
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(1700, now);
      o.frequency.linearRampToValueAtTime(2550, now + dur * 0.45);
      o.frequency.linearRampToValueAtTime(2450, now + dur * 0.7);
      o.frequency.exponentialRampToValueAtTime(1500, now + dur);
      const l = c.createOscillator();
      l.frequency.value = 6.5;
      const lg = c.createGain();
      lg.gain.value = 22;
      l.connect(lg);
      lg.connect(o.frequency);
      const e = c.createGain();
      e.gain.setValueAtTime(1e-4, now);
      e.gain.exponentialRampToValueAtTime(0.09 * v, now + 0.25);
      e.gain.setValueAtTime(0.09 * v, now + dur * 0.75);
      e.gain.exponentialRampToValueAtTime(1e-4, now + dur);
      o.connect(e);
      e.connect(this.out(pan, "sfx", 0.9));
      o.start(now);
      l.start(now);
      o.stop(now + dur + 0.1);
      l.stop(now + dur + 0.1);
    }
  };

  // js/core/save.js
  var KEY = "ultimaCacada.save.v1";
  var SKEY = "ultimaCacada.settings.v1";
  var PKEY = "ultimaCacada.progress.v1";
  var store = null;
  function ls() {
    if (store) return store;
    try {
      return globalThis.localStorage;
    } catch {
      return null;
    }
  }
  function safeGet(k) {
    try {
      return JSON.parse(ls().getItem(k));
    } catch {
      return null;
    }
  }
  function safeSet(k, v) {
    try {
      ls().setItem(k, JSON.stringify(v));
      return true;
    } catch {
      return false;
    }
  }
  function safeDel(k) {
    try {
      ls().removeItem(k);
    } catch {
    }
  }
  var keyFor = (phase) => !phase || phase === 1 ? KEY : `ultimaCacada.save.p${phase}.v1`;
  function defaultProgress() {
    return { unlocked: [1], completed: {}, last: 1, carry: null, journal: [] };
  }
  var Save = {
    // permite trocar o armazenamento nos testes automatizados
    _useStorage(s) {
      store = s;
    },
    keyFor,
    load(phase = 1) {
      return safeGet(keyFor(phase));
    },
    write(data) {
      const ok = safeSet(keyFor(data.phase), { ...data, savedAt: Date.now() });
      if (data.phase && !data.completed) Save.setLast(data.phase);
      return ok;
    },
    clear(phase = 1) {
      safeDel(keyFor(phase));
    },
    clearAll() {
      for (let i = 1; i <= 9; i++) safeDel(keyFor(i));
      safeDel(PKEY);
    },
    has(phase) {
      if (phase) {
        const d = safeGet(keyFor(phase));
        return !!(d && d.phase);
      }
      for (let i = 1; i <= 9; i++) {
        const d = safeGet(keyFor(i));
        if (d && d.phase) return true;
      }
      return false;
    },
    // ---------- progresso entre fases ----------
    progress() {
      const p = Object.assign(defaultProgress(), safeGet(PKEY) || {});
      const p1 = safeGet(KEY);
      if (p1 && p1.completed && !p.completed[1]) {
        p.completed[1] = { at: p1.savedAt || Date.now() };
        if (!p.unlocked.includes(2)) p.unlocked.push(2);
        if (!p.carry) p.carry = { tracks: p1.tracks || [], found: p1.found || [] };
      }
      return p;
    },
    saveProgress(p) {
      return safeSet(PKEY, p);
    },
    completePhase(id, info = {}) {
      const p = Save.progress();
      p.completed[id] = { ...p.completed[id] || {}, ...info, at: Date.now() };
      if (!p.unlocked.includes(id + 1)) p.unlocked.push(id + 1);
      if (info.carry) p.carry = info.carry;
      p.last = id;
      Save.saveProgress(p);
      return p;
    },
    setLast(id) {
      const p = Save.progress();
      if (p.last !== id) {
        p.last = id;
        Save.saveProgress(p);
      }
    },
    isUnlocked(id) {
      return id === 1 || Save.progress().unlocked.includes(id);
    },
    loadSettings() {
      return Object.assign({ master: 0.8, music: 0.5, sfx: 0.85, amb: 0.75, captions: true, markers: true, shake: true, visualSound: true }, safeGet(SKEY) || {});
    },
    saveSettings(s) {
      safeSet(SKEY, s);
    }
  };

  // js/engine/camera.js
  var Camera = class {
    constructor() {
      this.x = 0;
      this.y = 0;
      this.zoom = 1;
      this.targetZoom = 1;
      this.shakeT = 0;
      this.shakeI = 0;
      this.sx = 0;
      this.sy = 0;
      this.follow = null;
      this.pan = null;
      this.lookX = 0;
      this.lookY = 0;
      this.viewW = 320;
      this.viewH = 240;
    }
    shake(i = 2, t = 0.3) {
      this.shakeI = Math.max(this.shakeI, i);
      this.shakeT = Math.max(this.shakeT, t);
    }
    panTo(x, y, dur = 1.5) {
      return new Promise((res) => {
        this.pan = { fx: this.x, fy: this.y, tx: x, ty: y, t: 0, dur, res };
      });
    }
    release() {
      this.pan = null;
    }
    update(dt, world, enableShake = true) {
      if (this.pan && !this.pan.res && this.pan.t >= this.pan.dur && this.follow) this.pan = null;
      if (this.pan) {
        const p = this.pan;
        p.t = Math.min(p.dur, p.t + dt);
        const k = easeInOut(p.t / p.dur);
        this.x = lerp(p.fx, p.tx, k);
        this.y = lerp(p.fy, p.ty, k);
        if (p.t >= p.dur && p.res) {
          const r = p.res;
          p.res = null;
          r();
        }
      } else if (this.follow) {
        const f = this.follow;
        this.lookX = lerp(this.lookX, (f.vx || 0) * 0.35, Math.min(1, dt * 2));
        this.lookY = lerp(this.lookY, (f.vy || 0) * 0.35, Math.min(1, dt * 2));
        const tx = f.x + this.lookX, ty = f.y - 8 + this.lookY;
        const k = 1 - Math.pow(25e-4, dt);
        this.x = lerp(this.x, tx, k);
        this.y = lerp(this.y, ty, k);
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
        this.sx = (Math.random() * 2 - 1) * i;
        this.sy = (Math.random() * 2 - 1) * i;
      } else {
        this.sx = this.sy = 0;
        this.shakeI = 0;
      }
    }
  };

  // js/gfx/pixel.js
  var cache = /* @__PURE__ */ new Map();
  function rgb(hex) {
    if (Array.isArray(hex)) return hex;
    let c = cache.get(hex);
    if (c) return c;
    let h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map((x) => x + x).join("");
    c = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    cache.set(hex, c);
    return c;
  }
  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, w | 0);
    c.height = Math.max(1, h | 0);
    return c;
  }
  function flipCanvas(cv) {
    const c = makeCanvas(cv.width, cv.height);
    const x = c.getContext("2d");
    x.translate(cv.width, 0);
    x.scale(-1, 1);
    x.drawImage(cv, 0, 0);
    return c;
  }
  var PixBuf = class {
    constructor(w, h) {
      this.w = w | 0;
      this.h = h | 0;
      this.d = new Uint8ClampedArray(this.w * this.h * 4);
    }
    px(x, y, col, a = 255) {
      x |= 0;
      y |= 0;
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      const i = (y * this.w + x) * 4, c = rgb(col);
      if (a >= 255) {
        this.d[i] = c[0];
        this.d[i + 1] = c[1];
        this.d[i + 2] = c[2];
        this.d[i + 3] = 255;
        return;
      }
      const t = a / 255, oa = this.d[i + 3] / 255;
      if (oa === 0) {
        this.d[i] = c[0];
        this.d[i + 1] = c[1];
        this.d[i + 2] = c[2];
        this.d[i + 3] = a;
        return;
      }
      this.d[i] = this.d[i] + (c[0] - this.d[i]) * t;
      this.d[i + 1] = this.d[i + 1] + (c[1] - this.d[i + 1]) * t;
      this.d[i + 2] = this.d[i + 2] + (c[2] - this.d[i + 2]) * t;
      this.d[i + 3] = Math.max(this.d[i + 3], a);
    }
    alpha(x, y) {
      x |= 0;
      y |= 0;
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
      return this.d[(y * this.w + x) * 4 + 3];
    }
    // pinta somente onde já existe pixel (máscara)
    mpx(x, y, col) {
      if (this.alpha(x, y) > 0) this.px(x, y, col);
    }
    rect(x, y, w, h, col) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, col);
    }
    clear(x, y, w = 1, h = 1) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const X = x + i, Y = y + j;
        if (X >= 0 && Y >= 0 && X < this.w && Y < this.h) this.d[(Y * this.w + X) * 4 + 3] = 0;
      }
    }
    mrect(x, y, w, h, col) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.mpx(x + i, y + j, col);
    }
    blob(cx, cy, rx, ry, col, mask = false) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
          if (dx * dx + dy * dy <= 1) mask ? this.mpx(x, y, col) : this.px(x, y, col);
        }
    }
    // elipse com sombreamento por normal (luz vinda de cima-esquerda) e pontilhado
    shaded(cx, cy, rx, ry, pal, seed = 0, lx = -0.55, ly = -0.75, dither = 0.28) {
      const n = pal.length;
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
          const d2 = dx * dx + dy * dy;
          if (d2 > 1) continue;
          const nz = Math.sqrt(1 - d2);
          const l = dx * lx + dy * ly + nz * 0.55;
          let t = (l + 0.75) / 1.85 + (hash2(x, y, seed) - 0.5) * dither;
          this.px(x, y, pal[clamp(Math.floor(t * n), 0, n - 1)]);
        }
    }
    line(x0, y0, x1, y1, col) {
      x0 |= 0;
      y0 |= 0;
      x1 |= 0;
      y1 |= 0;
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let e = dx + dy;
      for (; ; ) {
        this.px(x0, y0, col);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * e;
        if (e2 >= dy) {
          e += dy;
          x0 += sx;
        }
        if (e2 <= dx) {
          e += dx;
          y0 += sy;
        }
      }
    }
    outline(col = "#1b130d", alphaMin = 1) {
      const w = this.w, h = this.h, s = this.d, out = new Uint8ClampedArray(s);
      const c = rgb(col);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (s[i + 3] >= alphaMin) continue;
        const nb = (xx, yy) => xx >= 0 && yy >= 0 && xx < w && yy < h && s[(yy * w + xx) * 4 + 3] > 140;
        if (nb(x - 1, y) || nb(x + 1, y) || nb(x, y - 1) || nb(x, y + 1)) {
          out[i] = c[0];
          out[i + 1] = c[1];
          out[i + 2] = c[2];
          out[i + 3] = 255;
        }
      }
      this.d = out;
      return this;
    }
    toCanvas() {
      const c = makeCanvas(this.w, this.h);
      c.getContext("2d").putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
      return c;
    }
  };

  // js/engine/renderer.js
  var Renderer = class {
    constructor(g, canvas) {
      this.g = g;
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.dpr = 1;
      this.cw = 1;
      this.ch = 1;
      this.zoom = 3;
      this.shadowBuf = makeCanvas(8, 8);
      this.sctx = this.shadowBuf.getContext("2d");
      this.lightBuf = makeCanvas(8, 8);
      this.lctx = this.lightBuf.getContext("2d");
      this.tmpList = [];
    }
    resize() {
      const r = this.canvas.parentElement.getBoundingClientRect();
      this.dpr = Math.min(window.devicePixelRatio || 1, 3);
      this.cssW = Math.max(1, r.width);
      this.cssH = Math.max(1, r.height);
      this.cw = Math.round(this.cssW * this.dpr);
      this.ch = Math.round(this.cssH * this.dpr);
      this.canvas.width = this.cw;
      this.canvas.height = this.ch;
      let z = Math.min(this.cw / 250, this.ch / 230);
      z = z >= 2 ? Math.floor(z) : Math.max(1, z);
      this.zoom = z;
      this.vignette = null;
    }
    view() {
      const cam = this.g.camera;
      const z = this.zoom * cam.zoom;
      const vw = this.cw / z, vh = this.ch / z;
      cam.viewW = vw;
      cam.viewH = vh;
      let cx = cam.x + cam.sx - vw / 2, cy = cam.y + cam.sy - vh / 2;
      cx = Math.round(cx * z) / z;
      cy = Math.round(cy * z) / z;
      return { z, vw, vh, cx, cy };
    }
    worldToScreen(wx, wy) {
      const v = this.lastView || this.view();
      return { x: (wx - v.cx) * v.z / this.dpr, y: (wy - v.cy) * v.z / this.dpr };
    }
    screenToWorld(sx, sy) {
      const v = this.lastView || this.view();
      return { x: sx * this.dpr / v.z + v.cx, y: sy * this.dpr / v.z + v.cy };
    }
    ensureBuf(buf, ctxName, w, h) {
      w = Math.ceil(w) + 2;
      h = Math.ceil(h) + 2;
      if (this[buf].width !== w || this[buf].height !== h) {
        this[buf].width = w;
        this[buf].height = h;
        this[ctxName] = this[buf].getContext("2d");
      }
    }
    render() {
      const g = this.g, ctx = this.ctx, w = g.world;
      if (!w || !w.ground) {
        ctx.fillStyle = "#0b120a";
        ctx.fillRect(0, 0, this.cw, this.ch);
        return;
      }
      const V = this.lastView = this.view();
      const { z, vw, vh, cx, cy } = V;
      const t = g.time;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#0b120a";
      ctx.fillRect(0, 0, this.cw, this.ch);
      ctx.setTransform(z, 0, 0, z, -cx * z, -cy * z);
      const sx = Math.max(0, Math.floor(cx)), sy = Math.max(0, Math.floor(cy));
      const sw = Math.min(w.W - sx, Math.ceil(vw) + 2), sh = Math.min(w.H - sy, Math.ceil(vh) + 2);
      if (sw > 0 && sh > 0) ctx.drawImage(w.ground, sx, sy, sw, sh, sx, sy, sw, sh);
      this.drawWater(ctx, cx, cy, vw, vh, t);
      const list = this.tmpList;
      list.length = 0;
      w.queryDrawables(cx, cy, cx + vw, cy + vh, list);
      for (const d of list) if (d.layer === "ground") this.drawItem(ctx, d);
      g.phase?.drawGround?.(ctx, V);
      const sun = g.sun;
      if (sun.strength > 0.02) {
        this.ensureBuf("shadowBuf", "sctx", vw, vh);
        const s = this.sctx;
        s.setTransform(1, 0, 0, 1, 0, 0);
        s.clearRect(0, 0, this.shadowBuf.width, this.shadowBuf.height);
        s.setTransform(1, 0, 0, 1, -Math.floor(cx), -Math.floor(cy));
        s.fillStyle = "#000";
        for (const d of list) {
          if (d.crown) {
            const cr = d.crown;
            s.beginPath();
            s.ellipse(d.x + cr.dx + sun.dx * (cr.h || 40) * 0.5, d.y + 4 + sun.dy * 6, cr.r * 0.95, cr.r * 0.55, 0, 0, Math.PI * 2);
            s.fill();
          }
          if (d.shadow) {
            const sh2 = d.shadow;
            s.beginPath();
            s.ellipse(d.x + (sh2.dx || 0) + sun.dx * (sh2.len || 6), d.y + (sh2.dy || 0), sh2.rx, sh2.ry, 0, 0, Math.PI * 2);
            s.fill();
          }
        }
        ctx.globalAlpha = sun.strength * 0.3;
        ctx.drawImage(this.shadowBuf, Math.floor(cx), Math.floor(cy));
        ctx.globalAlpha = 1;
      }
      const ents = [];
      for (const d of list) if (d.layer !== "ground") ents.push(d);
      for (const e of g.entities) if (e.x > cx - 40 && e.x < cx + vw + 40 && e.y > cy - 30 && e.y < cy + vh + 60) ents.push(e);
      ents.sort((a, b) => (a.sortY ?? a.y) - (b.sortY ?? b.y));
      for (const e of ents) {
        if (e.draw && !e.sprite) e.draw(ctx, g);
        else this.drawItem(ctx, e);
      }
      const p = g.player;
      if (p && p.aiming) {
        const ax = p.x + Math.cos(p.aimAngle) * 70, ay = p.y - 10 + Math.sin(p.aimAngle) * 70;
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = "#f4ecd0";
        ctx.lineWidth = 1 / z * 2;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 10);
        ctx.lineTo(ax, ay);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "#f4ecd0";
        ctx.fillRect(Math.round(ax) - 4, Math.round(ay), 3, 1);
        ctx.fillRect(Math.round(ax) + 2, Math.round(ay), 3, 1);
        ctx.fillRect(Math.round(ax), Math.round(ay) - 4, 1, 3);
        ctx.fillRect(Math.round(ax), Math.round(ay) + 2, 1, 3);
        ctx.globalAlpha = 1;
      }
      const clear = g.phase?.crownClear?.(V) || null;
      for (const d of list) {
        if (!d.crown) continue;
        const cr = d.crown;
        const ccx = d.x + cr.dx, ccy = d.y + cr.dy;
        let a = 1;
        if (p) {
          const dd = Math.hypot(p.x - ccx, (p.y - 12 - ccy) * 1.1);
          const inner = cr.r * 0.5 + 34, outer = cr.r + 52;
          if (dd < outer) a = 0.28 + 0.72 * clamp((dd - inner) / (outer - inner), 0, 1);
        }
        if (clear) for (const q of clear) {
          const dd = Math.hypot(q.x - ccx, (q.y - 10 - ccy) * 1.1), inner = cr.r * 0.45 + q.r * 0.4, outer = cr.r + q.r;
          if (dd < outer) a = Math.min(a, q.min + (1 - q.min) * clamp((dd - inner) / (outer - inner), 0, 1));
        }
        d.crownAlpha = d.crownAlpha === void 0 ? a : d.crownAlpha + (a - d.crownAlpha) * 0.15;
        ctx.globalAlpha = d.crownAlpha;
        ctx.drawImage(cr.sprite, Math.round(ccx - cr.sprite.width / 2), Math.round(ccy - cr.sprite.height / 2));
      }
      ctx.globalAlpha = 1;
      for (const e of g.airEntities) e.drawAir ? e.drawAir(ctx) : e.draw(ctx);
      if (sun.strength > 0.12) this.drawShafts(ctx, cx, cy, vw, vh, t, sun);
      g.particles.draw(ctx, cx, cy, cx + vw, cy + vh, g.darkness);
      g.phase?.drawWorldOverlay?.(ctx, V);
      this.drawLighting(ctx, V);
      g.phase?.drawAfterLight?.(ctx, V);
      const tint = g.tint;
      if (tint && tint[3] > 0.01) {
        ctx.globalCompositeOperation = "soft-light";
        ctx.fillStyle = `rgba(${tint[0] | 0},${tint[1] | 0},${tint[2] | 0},${tint[3]})`;
        ctx.fillRect(cx, cy, vw, vh);
        ctx.globalCompositeOperation = "source-over";
      }
      if (g.flash > 0) {
        ctx.fillStyle = `rgba(255,250,230,${g.flash})`;
        ctx.fillRect(cx, cy, vw, vh);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.drawVignette(ctx, g.vignette);
      if (g.state === "play") {
        this.drawMarker(ctx, V);
        this.drawPrompt(ctx, V);
      }
      this.drawSoundCues(ctx);
      if (g.letterbox > 0) {
        const h = this.ch * 0.1 * g.letterbox;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, this.cw, h);
        ctx.fillRect(0, this.ch - h, this.cw, h);
      }
      if (g.fade > 0) {
        ctx.fillStyle = `rgba(4,6,4,${g.fade})`;
        ctx.fillRect(0, 0, this.cw, this.ch);
      }
    }
    drawItem(ctx, d) {
      if (d.draw) {
        d.draw(ctx, this.g);
        return;
      }
      if (!d.sprite) return;
      ctx.drawImage(d.sprite, Math.round(d.x - d.ax), Math.round(d.y - d.ay));
    }
    drawWater(ctx, cx, cy, vw, vh, t) {
      const w = this.g.world;
      const tx0 = Math.max(0, Math.floor(cx / 16)), ty0 = Math.max(0, Math.floor(cy / 16));
      const tx1 = Math.min(w.tw - 1, Math.ceil((cx + vw) / 16)), ty1 = Math.min(w.th - 1, Math.ceil((cy + vh) / 16));
      const glint = this.g.waterGlint || "#e8f0f4";
      ctx.fillStyle = glint;
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        const wt = w.waterTiles[ty * w.tw + tx];
        if (!wt) continue;
        const speed = wt === 1 ? 7 : 4;
        for (let k = 0; k < 2; k++) {
          const h1 = hash2(tx, ty, k * 3 + 1), h2 = hash2(tx, ty, k * 3 + 2);
          const px6 = tx * 16 + ((h1 * 16 - t * speed) % 16 + 16) % 16;
          const py = ty * 16 + Math.floor(h2 * 16);
          if (!w.isWater(px6, py) || !w.isWater(px6 + 3, py)) continue;
          const a = 0.12 + 0.12 * Math.sin(t * 1.5 + h1 * 20);
          ctx.globalAlpha = a * (wt === 1 ? 1 : 0.6);
          ctx.fillRect(Math.floor(px6), py, wt === 1 ? 4 : 3, 1);
        }
      }
      ctx.globalAlpha = 1;
    }
    drawShafts(ctx, cx, cy, vw, vh, t, sun) {
      const w = this.g.world;
      ctx.globalCompositeOperation = "screen";
      const g0x = Math.floor(cx / 72) - 1, g1x = Math.ceil((cx + vw) / 72) + 1;
      const g0y = Math.floor(cy / 72) - 1, g1y = Math.ceil((cy + vh) / 72) + 2;
      for (let gy = g0y; gy <= g1y; gy++) for (let gx = g0x; gx <= g1x; gx++) {
        if (hash2(gx, gy, 77) > 0.22) continue;
        const bx = gx * 72 + hash2(gx, gy, 78) * 50, by = gy * 72 + hash2(gx, gy, 79) * 50;
        if (w.densityAt(bx, by) < 0.45) continue;
        const pulse = 0.6 + 0.4 * Math.sin(t * 0.35 + gx * 1.3 + gy);
        const a = 0.07 * sun.strength * pulse;
        const wdt = 7 + hash2(gx, gy, 80) * 9;
        const len = 70;
        const skew = sun.dx * -26;
        const grd = ctx.createLinearGradient(bx, by - len, bx, by);
        grd.addColorStop(0, `rgba(255,236,170,0)`);
        grd.addColorStop(0.5, `rgba(255,232,160,${a})`);
        grd.addColorStop(1, `rgba(255,220,150,${a * 1.4})`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.moveTo(bx + skew, by - len);
        ctx.lineTo(bx + skew + wdt, by - len);
        ctx.lineTo(bx + wdt * 1.6, by);
        ctx.lineTo(bx - wdt * 0.6, by);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = a * 3;
        ctx.fillStyle = "rgba(255,230,160,1)";
        ctx.beginPath();
        ctx.ellipse(bx + wdt * 0.5, by, wdt * 1.1, wdt * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        if (Math.random() < 0.02) this.g.particles.add({ type: "dust", x: bx + Math.random() * wdt, y: by - Math.random() * len * 0.8, vx: 1, vy: 2, life: 4, seed: Math.random() * 9, a: sun.strength });
      }
      ctx.globalCompositeOperation = "source-over";
    }
    drawLighting(ctx, V) {
      const g = this.g, w = g.world, { vw, vh, cx, cy } = V;
      const dark = g.darkness, canopy = g.canopyDark;
      if (dark < 0.01 && canopy < 0.01) return;
      this.ensureBuf("lightBuf", "lctx", vw, vh);
      const L = this.lctx, ox = Math.floor(cx), oy = Math.floor(cy);
      L.setTransform(1, 0, 0, 1, 0, 0);
      L.globalCompositeOperation = "source-over";
      L.clearRect(0, 0, this.lightBuf.width, this.lightBuf.height);
      const amb = g.ambientColor;
      L.fillStyle = `rgba(${amb[0]},${amb[1]},${amb[2]},${dark})`;
      L.fillRect(0, 0, this.lightBuf.width, this.lightBuf.height);
      if (canopy > 0.01 && w.densityCanvas) {
        L.imageSmoothingEnabled = true;
        L.globalAlpha = canopy;
        L.drawImage(w.densityCanvas, ox / 16, oy / 16, this.lightBuf.width / 16, this.lightBuf.height / 16, 0, 0, this.lightBuf.width, this.lightBuf.height);
        L.globalAlpha = 1;
      }
      L.globalCompositeOperation = "destination-out";
      L.setTransform(1, 0, 0, 1, -ox, -oy);
      const lights = g.collectLights(V);
      for (const l of lights) {
        if (l.x < cx - l.r || l.x > cx + vw + l.r || l.y < cy - l.r || l.y > cy + vh + l.r) continue;
        const fl = l.flicker ? 0.9 + Math.sin(g.time * 13 + l.x) * 0.05 + Math.random() * 0.05 : 1;
        const r = l.r * fl;
        if (l.cone) {
          L.save();
          L.translate(l.x, l.y);
          L.rotate(l.angle);
          const grd = L.createRadialGradient(0, 0, 4, 0, 0, r);
          grd.addColorStop(0, `rgba(0,0,0,${l.i})`);
          grd.addColorStop(0.7, `rgba(0,0,0,${l.i * 0.6})`);
          grd.addColorStop(1, "rgba(0,0,0,0)");
          L.fillStyle = grd;
          L.beginPath();
          L.moveTo(0, 0);
          L.arc(0, 0, r, -l.spread, l.spread);
          L.closePath();
          L.fill();
          L.restore();
        } else {
          const grd = L.createRadialGradient(l.x, l.y, 0, l.x, l.y, r);
          grd.addColorStop(0, `rgba(0,0,0,${l.i})`);
          grd.addColorStop(0.5, `rgba(0,0,0,${l.i * 0.55})`);
          grd.addColorStop(1, "rgba(0,0,0,0)");
          L.fillStyle = grd;
          L.fillRect(l.x - r, l.y - r, r * 2, r * 2);
        }
      }
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.lightBuf, ox, oy);
      ctx.globalCompositeOperation = "lighter";
      for (const l of lights) {
        if (!l.color) continue;
        const r = l.r * 0.7;
        const grd = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, r);
        grd.addColorStop(0, `rgba(${l.color},${0.16 * dark + 0.04})`);
        grd.addColorStop(1, `rgba(${l.color},0)`);
        ctx.fillStyle = grd;
        ctx.fillRect(l.x - r, l.y - r, r * 2, r * 2);
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.imageSmoothingEnabled = false;
    }
    drawVignette(ctx, strength = 0.5) {
      if (!this.vignette) {
        const c = makeCanvas(this.cw, this.ch), x = c.getContext("2d");
        const grd = x.createRadialGradient(this.cw / 2, this.ch / 2, Math.min(this.cw, this.ch) * 0.35, this.cw / 2, this.ch / 2, Math.max(this.cw, this.ch) * 0.75);
        grd.addColorStop(0, "rgba(0,0,0,0)");
        grd.addColorStop(1, "rgba(0,0,0,1)");
        x.fillStyle = grd;
        x.fillRect(0, 0, this.cw, this.ch);
        this.vignette = c;
      }
      ctx.globalAlpha = strength;
      ctx.drawImage(this.vignette, 0, 0);
      ctx.globalAlpha = 1;
    }
    drawMarker(ctx, V) {
      const g = this.g;
      if (!g.settings.markers) return;
      const tgt = g.currentTarget();
      if (!tgt) return;
      const { z, vw, vh, cx, cy } = V;
      const sx = (tgt.x - cx) * z, sy = (tgt.y - 18 - cy) * z;
      const m = 34 * this.dpr;
      const d = Math.hypot(tgt.x - g.player.x, tgt.y - g.player.y);
      const bob = Math.sin(g.time * 4) * 3 * this.dpr;
      ctx.save();
      if (sx > m && sy > m && sx < this.cw - m && sy < this.ch - m) {
        if (d < 26) {
          ctx.restore();
          return;
        }
        ctx.translate(sx, sy + bob);
        ctx.fillStyle = "rgba(255,214,102,0.95)";
        ctx.strokeStyle = "rgba(40,24,8,0.9)";
        ctx.lineWidth = 2 * this.dpr;
        const s = 6 * this.dpr;
        ctx.beginPath();
        ctx.moveTo(-s, -s);
        ctx.lineTo(s, -s);
        ctx.lineTo(0, s * 0.6);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
      } else {
        const ang = Math.atan2(sy - this.ch / 2, sx - this.cw / 2);
        const ex = this.cw / 2 + Math.cos(ang) * (this.cw / 2 - m), ey = this.ch / 2 + Math.sin(ang) * (this.ch / 2 - m);
        const px6 = clamp(ex, m, this.cw - m), py = clamp(ey, m, this.ch - m);
        ctx.translate(px6, py);
        ctx.save();
        ctx.rotate(ang);
        ctx.fillStyle = "rgba(255,214,102,0.9)";
        ctx.strokeStyle = "rgba(40,24,8,0.9)";
        ctx.lineWidth = 2 * this.dpr;
        const s = 8 * this.dpr;
        ctx.beginPath();
        ctx.moveTo(s, 0);
        ctx.lineTo(-s * 0.6, -s * 0.7);
        ctx.lineTo(-s * 0.2, 0);
        ctx.lineTo(-s * 0.6, s * 0.7);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
        ctx.restore();
        ctx.font = `700 ${11 * this.dpr}px Nunito, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        const txt = `${Math.round(d / 16)} m`;
        const ty = Math.sin(ang) > 0.3 ? -16 * this.dpr : 22 * this.dpr;
        ctx.fillText(txt, 1, ty + 1);
        ctx.fillStyle = "#ffe6a0";
        ctx.fillText(txt, 0, ty);
      }
      ctx.restore();
    }
    drawPrompt(ctx, V) {
      const g = this.g, f = g.focus;
      if (!f) return;
      const { z, cx, cy } = V;
      const sx = (f.x - cx) * z, sy = (f.y - (f.py ?? 22) - cy) * z;
      const label = typeof f.label === "function" ? f.label() : f.label;
      const key = g.input.lastDevice === "touch" ? "\u270B" : "E";
      const fs = 12 * this.dpr;
      ctx.font = `700 ${fs}px Nunito, sans-serif`;
      const tw = ctx.measureText(label).width;
      const kw = fs * 1.6, pad = fs * 0.6, h = fs * 1.9;
      const W = kw + pad * 3 + tw;
      const x = Math.round(sx - W / 2), y = Math.round(sy - h);
      ctx.fillStyle = "rgba(14,18,10,0.82)";
      this.rr(ctx, x, y, W, h, 6 * this.dpr);
      ctx.fill();
      ctx.strokeStyle = "rgba(232,200,120,0.6)";
      ctx.lineWidth = 1 * this.dpr;
      ctx.stroke();
      ctx.fillStyle = "#e8c878";
      this.rr(ctx, x + pad, y + (h - kw * 0.9) / 2, kw, kw * 0.9, 4 * this.dpr);
      ctx.fill();
      ctx.fillStyle = "#1c140a";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(key, x + pad + kw / 2, y + h / 2 + 1);
      ctx.fillStyle = "#f4ecd8";
      ctx.textAlign = "left";
      ctx.fillText(label, x + pad * 2 + kw, y + h / 2 + 1);
      ctx.textBaseline = "alphabetic";
    }
    drawSoundCues(ctx) {
      const g = this.g;
      if (!g.settings.visualSound) return;
      for (const c of g.soundCues) {
        const k = c.t / c.life, a = (1 - k) * 0.8;
        const left = c.pan < -0.25, right = c.pan > 0.25;
        const x = left ? 24 * this.dpr : right ? this.cw - 24 * this.dpr : this.cw / 2;
        const y = left || right ? this.ch * 0.45 : 46 * this.dpr;
        ctx.strokeStyle = `rgba(255,235,180,${a})`;
        ctx.lineWidth = 2 * this.dpr;
        for (let i = 0; i < 3; i++) {
          const r = (10 + i * 8 + k * 10) * this.dpr;
          ctx.beginPath();
          if (left) ctx.arc(x + 30 * this.dpr, y, r, Math.PI * 0.75, Math.PI * 1.25);
          else if (right) ctx.arc(x - 30 * this.dpr, y, r, -Math.PI * 0.25, Math.PI * 0.25);
          else ctx.arc(x, y + 20 * this.dpr, r, Math.PI * 1.25, Math.PI * 1.75);
          ctx.stroke();
        }
      }
    }
    rr(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  };

  // js/engine/particles.js
  var Particles = class {
    constructor() {
      this.list = [];
      this.max = 700;
    }
    add(p) {
      if (this.list.length >= this.max) return;
      p.life = p.life ?? 1;
      p.t = 0;
      p.vx = p.vx || 0;
      p.vy = p.vy || 0;
      p.z = p.z || 0;
      this.list.push(p);
    }
    update(dt) {
      const L = this.list;
      for (let i = L.length - 1; i >= 0; i--) {
        const p = L[i];
        p.t += dt;
        if (p.t >= p.life) {
          L[i] = L[L.length - 1];
          L.pop();
          continue;
        }
        switch (p.type) {
          case "leaf":
            p.x += (p.vx + Math.sin(p.t * 3 + p.seed) * 10) * dt;
            p.y += p.vy * dt;
            p.z = Math.max(0, p.z - 9 * dt);
            if (p.z === 0) {
              p.vx *= 0.9;
              p.vy = 0;
            }
            break;
          case "firefly":
            p.x += Math.sin(p.t * 1.3 + p.seed) * 8 * dt;
            p.y += Math.cos(p.t * 1.7 + p.seed) * 6 * dt;
            break;
          case "dust":
            p.x += p.vx * dt + Math.sin(p.t + p.seed) * 2 * dt;
            p.y += p.vy * dt;
            break;
          case "smoke":
            p.x += (p.vx + Math.sin(p.t * 2 + p.seed) * 4) * dt;
            p.y += p.vy * dt;
            p.vy *= 0.995;
            break;
          default:
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.g) p.vy += p.g * dt;
            if (p.drag) {
              p.vx *= 1 - p.drag * dt;
              p.vy *= 1 - p.drag * dt;
            }
        }
      }
    }
    draw(ctx, vx0, vy0, vx1, vy1, darkness) {
      for (const p of this.list) {
        if (p.x < vx0 - 10 || p.x > vx1 + 10 || p.y < vy0 - 30 || p.y > vy1 + 10) continue;
        const k = p.t / p.life;
        switch (p.type) {
          case "leaf": {
            ctx.globalAlpha = Math.min(1, (1 - k) * 3);
            ctx.fillStyle = p.color;
            const flip = Math.sin(p.t * 6 + p.seed) > 0;
            ctx.fillRect(Math.round(p.x), Math.round(p.y - p.z), flip ? 2 : 1, flip ? 1 : 2);
            break;
          }
          case "firefly": {
            const a = (0.5 + 0.5 * Math.sin(p.t * 4 + p.seed)) * Math.min(1, (1 - k) * 4) * darkness;
            ctx.globalAlpha = a;
            ctx.fillStyle = "#e8ff8a";
            ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
            ctx.globalAlpha = a * 0.3;
            ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 3);
            break;
          }
          case "dust":
            ctx.globalAlpha = Math.sin(k * Math.PI) * 0.6 * (p.a || 1);
            ctx.fillStyle = "#fff4c8";
            ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
            break;
          case "smoke":
            ctx.globalAlpha = (1 - k) * 0.25;
            ctx.fillStyle = "#c8c4bc";
            {
              const s = 2 + k * 6;
              ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
            }
            break;
          case "splash":
            ctx.globalAlpha = 1 - k;
            ctx.fillStyle = p.color || "#d8e8f0";
            ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
            break;
          case "ripple": {
            ctx.globalAlpha = (1 - k) * 0.55;
            ctx.strokeStyle = p.color || "#d8e4e8";
            ctx.lineWidth = 1;
            const r = (p.r0 || 2) + k * (p.r1 || 10);
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, r, r * 0.45, 0, 0, Math.PI * 2);
            ctx.stroke();
            break;
          }
          case "spark":
            ctx.globalAlpha = 1 - k;
            ctx.fillStyle = p.color || "#ffd860";
            ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
            break;
          case "puff":
            ctx.globalAlpha = (1 - k) * 0.6;
            ctx.fillStyle = p.color || "#e8e4dc";
            {
              const s = 2 + k * 10;
              ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
            }
            break;
        }
      }
      ctx.globalAlpha = 1;
    }
    lights() {
      return this.list.filter((p) => p.type === "firefly");
    }
  };

  // js/gfx/sprites.js
  var cache2 = /* @__PURE__ */ new Map();
  var overrides = /* @__PURE__ */ new Map();
  var Sprites = {
    get(key, gen) {
      const o = overrides.get(key);
      if (o) return o;
      let c = cache2.get(key);
      if (!c) {
        c = gen();
        cache2.set(key, c);
      }
      return c;
    },
    override(key, img) {
      overrides.set(key, img);
    },
    // Manifesto opcional: { "chave": "assets/arquivo.png", ... }
    async loadManifest(url = "assets/sprites.json") {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) return 0;
        const m = await r.json();
        const jobs = Object.entries(m).map(([k, src]) => new Promise((res) => {
          const img = new Image();
          img.onload = () => {
            overrides.set(k, img);
            res();
          };
          img.onerror = () => res();
          img.src = src;
        }));
        await Promise.all(jobs);
        return jobs.length;
      } catch {
        return 0;
      }
    },
    get size() {
      return cache2.size;
    }
  };

  // js/gfx/art-characters.js
  var DARK = "#1b130d";
  var LOOKS = {
    caetano: {
      skin: "#b97a4e",
      skinD: "#8f5a36",
      hair: "#2a1a10",
      hat: "straw",
      shirt: "#a5462e",
      shirtD: "#7c3320",
      shirtL: "#c45e40",
      plaid: true,
      pants: "#5a4a36",
      pantsD: "#43362a",
      boots: "#262222",
      pack: true,
      gun: true
    },
    raimundo: {
      skin: "#a86d45",
      skinD: "#7f4f30",
      hair: "#e4e0d6",
      hat: "none",
      beard: "#d8d4ca",
      shirt: "#d9d2bf",
      shirtD: "#b5ad98",
      shirtL: "#efe9da",
      pants: "#3f4a5a",
      pantsD: "#2f3845",
      boots: "#6b4a2e",
      stick: true
    },
    socorro: {
      skin: "#9a6040",
      skinD: "#764528",
      hair: "#1a1210",
      hat: "none",
      longHair: true,
      shirt: "#3f7a8a",
      shirtD: "#2e5c68",
      shirtL: "#5a96a6",
      pants: "#9a6040",
      pantsD: "#764528",
      skirt: "#8a3a5a",
      skirtD: "#6a2a44",
      boots: "#5a3a22"
    },
    ze: {
      skin: "#8a5434",
      skinD: "#683c22",
      hair: "#1a1210",
      hat: "cap",
      cap: "#d0a42a",
      capD: "#9a7618",
      shirt: "#2f6f4f",
      shirtD: "#22533a",
      shirtL: "#3f8a63",
      sleeve: "#8a5434",
      pants: "#3a4f7a",
      pantsD: "#2a3a5c",
      boots: "#3a3a3a"
    }
  };
  function humanSprite(L, dir, frame, crouch) {
    if (dir === "left") return flipCanvas(humanSprite(L, "right", frame, crouch));
    const b = new PixBuf(18, 27);
    const p = (x, y, w, h, c) => b.rect(x + 1, y + 2, w, h, c);
    const step = frame === 1 ? 1 : frame === 3 ? -1 : 0;
    const cy = crouch ? 3 : 0, bob = step !== 0 && !crouch ? 1 : 0, U = cy + bob;
    const lt = 17 + cy;
    const side = dir === "right", up = dir === "up", down = dir === "down";
    const pack = "#8a6a3a", packD = "#6e522a";
    const weave = (x0, y0, w, h) => {
      p(x0, y0, w, h, pack);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x + y) % 2 === 0) p(x0 + x, y0 + y, 1, 1, packD);
      p(x0, y0, w, 1, "#5e4422");
    };
    if (side && L.pack) {
      weave(2, 10 + U, 3, 8);
    }
    if (side && L.gun) p(3, 2 + U, 1, 9, "#3b3b40");
    if (!side) {
      if (crouch) {
        p(4, lt, 3, 22 - lt, L.pants);
        p(9, lt, 3, 22 - lt, L.pants);
        p(4, 22, 3, 2, L.boots);
        p(9, 22, 3, 2, L.boots);
      } else {
        const lL = step === 1 ? 1 : 0, rL = step === -1 ? 1 : 0;
        p(5, lt, 3, 22 - lt - lL, L.pants);
        p(7, lt, 1, 22 - lt - lL, L.pantsD);
        p(5, 22 - lL, 3, 2, L.boots);
        p(8, lt, 3, 22 - lt - rL, L.pants);
        p(10, lt, 1, 22 - lt - rL, L.pantsD);
        p(8, 22 - rL, 3, 2, L.boots);
      }
    } else {
      if (crouch) {
        p(5, lt, 6, 22 - lt, L.pants);
        p(4, 22, 4, 2, L.boots);
        p(9, 22, 3, 2, L.boots);
      } else if (step === 0) {
        p(6, lt, 4, 22 - lt, L.pants);
        p(9, lt, 1, 22 - lt, L.pantsD);
        p(6, 22, 5, 2, L.boots);
      } else {
        const fc = step === 1 ? L.pants : L.pantsD, bc = step === 1 ? L.pantsD : L.pants;
        p(5, lt, 2, 22 - lt, bc);
        p(4, 22, 3, 2, L.boots);
        p(8, lt, 2, 22 - lt, fc);
        p(9, 22, 3, 2, L.boots);
      }
    }
    const tx = side ? 5 : 4, tw = side ? 6 : 8;
    p(tx, 11 + U, tw, 6, L.shirt);
    if (!side) {
      p(4, 11 + U, 1, 6, L.shirtL);
      p(11, 11 + U, 1, 6, L.shirtD);
    } else p(10, 11 + U, 1, 6, L.shirtD);
    if (L.plaid) {
      p(tx, 13 + U, tw, 1, L.shirtD);
      p(tx + (side ? 2 : 3), 11 + U, 1, 6, L.shirtD);
      p(tx, 15 + U, tw, 1, L.shirtL);
    }
    if (L.skirt) {
      p(3, 16 + U, 10, 3, L.skirt);
      p(2, 19 + U, 12, 2, L.skirt);
      p(2, 20 + U, 12, 1, L.skirtD);
    } else p(tx, 17 + U, tw, 1, "#3a2618");
    if (!L.skirt && down) p(7, 17 + U, 2, 1, "#c9a54a");
    if (down && L.pack) {
      p(5, 11 + U, 1, 6, packD);
      p(10, 11 + U, 1, 6, packD);
    }
    if (down && L.gun) {
      for (let i = 0; i < 6; i++) p(11 - i, 11 + U + i, 1, 1, "#4a3020");
      p(2, 5 + U, 1, 6, "#3b3b40");
    }
    const sleeve = L.sleeve || L.shirtD;
    if (!side) {
      const aL = step === -1 ? 1 : 0, aR = step === 1 ? 1 : 0;
      p(2, 11 + U, 2, 5 + aL, sleeve);
      p(2, 16 + U + aL, 2, 1, L.skin);
      p(12, 11 + U, 2, 5 + aR, sleeve);
      p(12, 16 + U + aR, 2, 1, L.skin);
    }
    if (up && L.pack) weave(4, 10 + U, 8, 8);
    if (up && L.gun) {
      p(12, 3 + U, 1, 9, "#3b3b40");
      p(12, 12 + U, 2, 3, "#6a4022");
    }
    if (side) {
      const s = step;
      p(7 + s, 11 + U, 2, 5, sleeve);
      p(7 + s * 2, 16 + U, 2, 1, L.skin);
    }
    if (down) {
      p(5, 4 + U, 6, 6, L.skin);
      p(10, 4 + U, 1, 6, L.skinD);
      p(6, 10 + U, 4, 1, L.skinD);
      p(6, 7 + U, 1, 1, DARK);
      p(9, 7 + U, 1, 1, DARK);
      p(7, 9 + U, 2, 1, L.skinD);
      if (L.beard) {
        p(5, 8 + U, 6, 2, L.beard);
        p(7, 9 + U, 2, 1, L.skinD);
      }
      p(5, 4 + U, 1, 2, L.hair);
      p(10, 4 + U, 1, 2, L.hair);
      if (L.longHair) {
        p(4, 4 + U, 1, 7, L.hair);
        p(11, 4 + U, 1, 7, L.hair);
      }
    } else if (up) {
      p(5, 4 + U, 6, 6, L.hair);
      p(6, 10 + U, 4, 1, L.skinD);
      if (L.longHair) p(4, 4 + U, 8, 9, L.hair);
    } else {
      p(5, 4 + U, 6, 6, L.skin);
      p(5, 4 + U, 3, 4, L.hair);
      p(9, 7 + U, 1, 1, DARK);
      p(11, 7 + U, 1, 2, L.skin);
      p(9, 9 + U, 2, 1, L.skinD);
      p(7, 6 + U, 1, 2, L.skinD);
      p(6, 10 + U, 4, 1, L.skinD);
      if (L.beard) p(8, 8 + U, 4, 2, L.beard);
      if (L.longHair) p(4, 4 + U, 3, 8, L.hair);
    }
    if (L.hat === "straw") {
      p(2, 3 + U, 12, 2, "#d9b66a");
      p(2, 4 + U, 12, 1, "#b8934a");
      p(4, 0 + U, side ? 7 : 8, 3, "#e2c27a");
      p(4, 2 + U, side ? 7 : 8, 1, "#6a3a22");
      p(5, 0 + U, 2, 1, "#f0d690");
    } else if (L.hat === "cap") {
      p(5, 2 + U, 6, 3, L.cap);
      if (down) p(5, 4 + U, 6, 1, L.capD);
      if (side) p(10, 4 + U, 3, 1, L.capD);
    } else {
      p(5, 3 + U, 6, 2, L.hair);
      if (L.longHair) p(6, 1 + U, 4, 2, L.hair);
    }
    if (L.stick) {
      const x = down ? 14 : side ? 11 : 1;
      p(x, 12 + U, 1, 24 - (12 + U), "#7a5a3a");
    }
    b.outline(DARK);
    return b.toCanvas();
  }

  // js/entities/player.js
  var Player = class {
    constructor(g, x, y) {
      this.g = g;
      this.x = x;
      this.y = y;
      this.r = 4;
      this.vx = 0;
      this.vy = 0;
      this.dir = "down";
      this.frame = 0;
      this.anim = 0;
      this.hp = 100;
      this.en = 100;
      this.battery = 100;
      this.sneak = false;
      this.running = false;
      this.exhausted = false;
      this.dodgeT = 0;
      this.dodgeCd = 0;
      this.dodgeVX = 0;
      this.dodgeVY = 0;
      this.lantern = false;
      this.aiming = false;
      this.aimToggle = false;
      this.aimAngle = Math.PI / 2;
      this.noise = 0;
      this.noiseSpike = 0;
      this.vis = 1;
      this.hurtT = 0;
      this.invuln = 0;
      this.stepAcc = 0;
      this.locked = false;
      this.moving = false;
      this.inBush = false;
      this.forceCrouch = false;
      this.speedMul = 1;
    }
    noiseRadius() {
      return Math.max(this.noise, this.noiseSpike) * 170;
    }
    makeNoise(v) {
      this.noiseSpike = Math.max(this.noiseSpike, v);
    }
    hurt(n, msg) {
      if (this.invuln > 0 || this.hurtT > 0) return;
      this.hp = clamp(this.hp - n, 0, 100);
      this.hurtT = 0.9;
      this.g.audio.play("hurt");
      this.g.camera.shake(1.5, 0.25);
      if (msg) this.g.ui.toast(msg, "warn");
    }
    toggleLantern() {
      const g = this.g;
      if (!g.inv.has("lanterna")) {
        g.ui.toast("Voc\xEA ainda n\xE3o pegou a lanterna.", "tip");
        return;
      }
      if (!this.lantern && this.battery <= 0) {
        g.ui.toast("A bateria acabou. Procure pilhas.", "warn");
        g.audio.play("click");
        return;
      }
      this.lantern = !this.lantern;
      g.audio.play("lantern");
    }
    update(dt) {
      const g = this.g, inp = g.input, w = g.world;
      this.hurtT = Math.max(0, this.hurtT - dt);
      this.invuln = Math.max(0, this.invuln - dt);
      this.dodgeCd = Math.max(0, this.dodgeCd - dt);
      this.noiseSpike = Math.max(0, this.noiseSpike - dt * 1.2);
      if (this.lantern) {
        this.battery = Math.max(0, this.battery - dt / 3.2);
        if (this.battery <= 0) {
          this.lantern = false;
          g.ui.toast("A lanterna apagou: sem bateria.", "warn");
        }
      }
      if (this.locked) {
        this.vx = this.vy = 0;
        this.moving = false;
        this.frame = 0;
        this.noise = lerp(this.noise, 0, Math.min(1, dt * 4));
        return;
      }
      if (inp.pressed("sneak")) {
        this.sneak = !this.sneak;
        g.ui.flashStance();
      }
      if (inp.pressed("lantern")) this.toggleLantern();
      if (inp.pressed("aim") && inp.lastDevice === "touch") this.aimToggle = !this.aimToggle;
      const hasGun = g.inv.has("espingarda");
      this.aiming = hasGun && (inp.isDown("aim") && inp.lastDevice !== "touch" || this.aimToggle);
      const a = inp.axis();
      const surface = w.surfaceAt(this.x, this.y);
      let speed = 54;
      this.running = inp.isDown("run") && a.m > 0 && !this.exhausted && !this.aiming;
      if (this.running) {
        speed = 94;
        this.sneak = false;
      } else if (this.sneak) speed = 27;
      if (this.exhausted) speed *= 0.75;
      if (this.aiming) speed *= 0.5;
      if (surface === "mud") speed *= 0.6;
      else if (surface === "sand") speed *= 0.9;
      else if (surface === "water") speed *= 0.72;
      speed *= this.speedMul ?? 1;
      if (this.aiming) {
        const m = inp.mouse;
        if (inp.lastDevice === "mouse" && m.inside) {
          const s = g.renderer.worldToScreen(this.x, this.y - 10);
          this.aimAngle = Math.atan2(m.y - s.y, m.x - s.x);
        } else if (a.m > 0) this.aimAngle = Math.atan2(a.y, a.x);
        else {
          const v = DIR_VEC[this.dir];
          this.aimAngle = Math.atan2(v[1], v[0]);
        }
      }
      if (inp.pressed("dodge") || this.aiming && inp.pressed("click")) {
        if (this.aiming) g.shoot(this);
        else if (this.dodgeCd <= 0 && this.en >= 12 && inp.pressed("dodge")) {
          const v = a.m > 0 ? [a.x, a.y] : DIR_VEC[this.dir];
          this.dodgeVX = v[0];
          this.dodgeVY = v[1];
          this.dodgeT = 0.22;
          this.dodgeCd = 0.55;
          this.en -= 14;
          this.invuln = 0.3;
          this.makeNoise(0.75);
          g.audio.play("dodge");
          for (let i = 0; i < 6; i++) g.particles.add({ type: "puff", x: this.x + (Math.random() - 0.5) * 6, y: this.y, vx: -v[0] * 20, vy: -v[1] * 20, life: 0.4, color: "#b8a888" });
        }
      }
      let tvx, tvy;
      if (this.dodgeT > 0) {
        this.dodgeT -= dt;
        tvx = this.dodgeVX * 190;
        tvy = this.dodgeVY * 190;
        this.vx = tvx;
        this.vy = tvy;
      } else {
        tvx = a.x * speed * a.m;
        tvy = a.y * speed * a.m;
        const k = 1 - Math.pow(5e-4, dt);
        this.vx = lerp(this.vx, tvx, k);
        this.vy = lerp(this.vy, tvy, k);
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
          g.audio.play("step", { surface, vol });
          if (surface === "mud" || surface === "water") g.particles.add({ type: "ripple", x: this.x, y: this.y, life: 0.6, r1: 5, color: "#8a7a5a" });
          else if (this.running && (surface === "dirt" || surface === "sand")) g.particles.add({ type: "puff", x: this.x, y: this.y, vx: -this.vx * 0.1, vy: -2, life: 0.5, color: "#c8b088" });
          if (this.running && surface === "leaves" && Math.random() < 0.4) g.particles.add({ type: "leaf", x: this.x, y: this.y, z: 2, vx: (Math.random() - 0.5) * 20, vy: 0, life: 1.2, seed: Math.random() * 9, color: "#8a6a34" });
        }
      } else {
        this.frame = 0;
        this.anim = 0;
      }
      const sf = { leaves: 1.15, grass: 0.85, wood: 1.25, mud: 1, water: 1.2, sand: 0.8, dirt: 0.9 }[surface] || 1;
      let target = 0;
      if (this.dodgeT > 0) target = 0.8;
      else if (this.moving) target = (this.running ? 1 : this.sneak ? 0.13 : 0.42) * sf;
      this.noise = lerp(this.noise, target, Math.min(1, dt * 6));
      this.inBush = g.isInCover(this.x, this.y);
      let vis = 1;
      if (this.sneak) vis *= 0.6;
      if (!this.moving) vis *= 0.6;
      if (this.inBush) vis *= 0.4;
      if (this.lantern && g.darkness > 0.3) vis = Math.min(1, vis + 0.35);
      this.vis = vis;
      if (this.running) this.en -= 11 * dt;
      else this.en += (this.moving ? this.sneak ? 3 : 2 : 5) * dt;
      this.en = clamp(this.en, 0, 100);
      if (this.en <= 0 && !this.exhausted) {
        this.exhausted = true;
        g.ui.toast("Caetano est\xE1 exausto. Ande devagar ou beba \xE1gua (tecla 1).", "warn");
      }
      if (this.exhausted && this.en >= 25) this.exhausted = false;
    }
    sprite() {
      const crouch = this.sneak || this.forceCrouch;
      const key = `h:caetano:${this.dir}:${this.frame}:${crouch ? 1 : 0}`;
      return Sprites.get(key, () => humanSprite(LOOKS.caetano, this.dir, this.frame, crouch));
    }
    draw(ctx) {
      const s = this.sprite();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + 1, 6, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (this.hurtT > 0 && Math.floor(this.hurtT * 14) % 2 === 0) ctx.globalAlpha = 0.45;
      if (this.dodgeT > 0) {
        ctx.globalAlpha = 0.3;
        ctx.drawImage(s, Math.round(this.x - 9 - this.dodgeVX * 8), Math.round(this.y - 25 - this.dodgeVY * 8));
        ctx.globalAlpha = 1;
      }
      ctx.drawImage(s, Math.round(this.x - 9), Math.round(this.y - 25));
      ctx.globalAlpha = 1;
    }
  };

  // js/data/items.js
  var ITEMS = {
    paneiro: { name: "Paneiro", type: "equip", desc: "Cesto tran\xE7ado de fibra, levado nas costas. Serve de mochila: guarda at\xE9 12 tipos de coisa." },
    espingarda: { name: "Espingarda velha", type: "equip", desc: "De um cano s\xF3, herdada do pai. Segure Q (ou bot\xE3o direito) para mirar." },
    facao: { name: "Fac\xE3o", type: "equip", desc: "Ferramenta de todo dia: corta cip\xF3, abre picada, limpa peixe." },
    cantil: { name: "Cantil", type: "consumable", desc: "Recupera energia. Encha em qualquer rio ou igarap\xE9 (E perto da \xE1gua). Tecla 1." },
    lanterna: { name: "Lanterna", type: "equip", desc: "Acende e apaga com F. A bateria acaba: economize." },
    marmita: { name: "Marmita", type: "consumable", desc: "Peixe assado com farinha. Recupera vida e energia. Tecla 2." },
    cartucho: { name: "Cartuchos", type: "material", desc: "Poucos e caros. Um tiro faz barulho que espanta tudo num raio grande." },
    fumo: { name: "Fumo de rolo", type: "key", desc: 'Presente de Seu Raimundo. "Pede licen\xE7a quando entrar na mata."' },
    tabua: { name: "T\xE1bua", type: "material", desc: "T\xE1bua de madeira boa para remendar a ponte." },
    cipo: { name: "Cip\xF3-titica", type: "material", desc: "Cip\xF3 forte e flex\xEDvel, usado para amarrar e tran\xE7ar." },
    galhos: { name: "Feixe de galhos secos", type: "material", desc: "Lenha para a fogueira do acampamento." },
    pilhas: { name: "Pilhas", type: "consumable", desc: "Recarregam a lanterna. Tecla 3." },
    caderno: { name: "Caderno de rastros", type: "key", desc: "Onde Caetano anota os rastros que j\xE1 sabe reconhecer." },
    vara: { name: "Vara de pau-ferro", type: "material", desc: "Uma vara grossa e muito dura. Com um bom apoio, vira alavanca." },
    remo: { name: "Remo de pau", type: "key", desc: "Remo velho achado num jirau de pesca abandonado. A p\xE1 est\xE1 gasta, mas ainda empurra \xE1gua." },
    pelos: { name: "Pelos avermelhados", type: "key", desc: "Tufo de pelos ruivos preso num espinho. Do veado-vermelho, sem d\xFAvida." },
    // achados (colecionáveis)
    caco: { name: "Caco de cer\xE2mica", type: "collectible", desc: "Fragmento de cer\xE2mica com pintura vermelha. Cacos assim aparecem com frequ\xEAncia em \xE1reas de terra preta, sinal de que povos antigos viveram aqui muito antes da comunidade." },
    pena: { name: "Pena de mutum", type: "collectible", desc: "Pena preta e lustrosa de mutum, ave grande que vive no ch\xE3o da mata." },
    anzol: { name: "Anzol antigo", type: "collectible", desc: "Anzol de ferro, enferrujado, esquecido na canoa velha. Algu\xE9m pescou muito com ele." },
    jarina: { name: "Semente de jarina", type: "collectible", desc: 'Semente dur\xEDssima de uma palmeira, chamada de "marfim vegetal" e usada para fazer biojoias.' },
    jabuti: { name: "Casco de jabuti", type: "collectible", desc: "Casco vazio e limpo pelo tempo. O bicho morreu de velho, longe de tudo." }
  };
  var COLLECTIBLES = ["caco", "pena", "anzol", "jarina", "jabuti"];
  var Inventory = class {
    constructor(cap = 12) {
      this.cap = cap;
      this.items = /* @__PURE__ */ new Map();
      this.found = /* @__PURE__ */ new Set();
    }
    slotsUsed() {
      return this.items.size;
    }
    has(id, n = 1) {
      return (this.items.get(id) || 0) >= n;
    }
    count(id) {
      return this.items.get(id) || 0;
    }
    add(id, n = 1) {
      const def = ITEMS[id];
      if (def && def.type === "collectible") {
        this.found.add(id);
        return true;
      }
      if (!this.items.has(id) && this.items.size >= this.cap) return false;
      this.items.set(id, (this.items.get(id) || 0) + n);
      return true;
    }
    remove(id, n = 1) {
      const c = (this.items.get(id) || 0) - n;
      if (c <= 0) this.items.delete(id);
      else this.items.set(id, c);
    }
    toJSON() {
      return { items: [...this.items], found: [...this.found] };
    }
    load(d) {
      this.items = new Map(d?.items || []);
      this.found = new Set(d?.found || []);
    }
  };

  // js/gfx/art-props.js
  var DARK2 = "#160f09";
  function houseSprite(seed, paint = "#4f7f9a", roof = "zinc") {
    const W = 80, H = 74;
    const b = new PixBuf(W, H);
    const rng = mulberry32(seed);
    const paintD = shade(paint, 0.78), paintL = shade(paint, 1.12);
    for (const x of [8, 22, 38, 54, 70]) {
      b.rect(x, 56, 3, 14, "#4a3420");
      b.rect(x + 2, 56, 1, 14, "#33240f");
    }
    b.rect(4, 52, 72, 5, "#7a5232");
    for (let x = 4; x < 76; x += 6) b.rect(x, 52, 1, 5, "#5a3a22");
    b.rect(4, 56, 72, 1, "#3a2614");
    for (let y = 28; y < 52; y++) {
      const board = Math.floor((y - 28) / 4);
      for (let x = 6; x < 74; x++) {
        let col = board % 2 ? paint : paintL;
        if ((y - 28) % 4 === 3) col = paintD;
        if (hash2(x >> 2, board, seed) < 0.12) col = "#8a6a4a";
        b.px(x, y, col);
      }
    }
    b.rect(34, 34, 12, 18, "#3a2416");
    b.rect(35, 35, 10, 17, "#5a3a24");
    b.rect(39, 35, 1, 17, "#3a2416");
    b.px(43, 43, "#c9a54a");
    for (const wx of [12, 56]) {
      b.rect(wx, 36, 12, 10, "#1a1410");
      b.rect(wx + 1, 37, 10, 8, "#2a2018");
      b.rect(wx - 4, 36, 4, 10, "#6a4a2e");
      b.rect(wx + 12, 36, 4, 10, "#6a4a2e");
      b.rect(wx + 5, 36, 1, 10, "#4a3420");
    }
    for (let y = 2; y < 30; y++) {
      const inset = Math.max(0, 3 - y);
      for (let x = inset; x < W - inset; x++) {
        let col;
        if (roof === "zinc") {
          col = x % 4 === 0 ? "#7c8388" : x % 4 === 1 ? "#b4bbc0" : "#9aa1a6";
          if (hash2(x >> 2, y >> 2, seed + 3) < 0.1) col = "#8a5a3a";
        } else {
          col = (y + x % 3) % 3 === 0 ? "#8a6a34" : (x + y * 3) % 7 === 0 ? "#d4b06a" : "#b08a4a";
        }
        b.px(x, y, col);
      }
    }
    b.rect(0, 15, W, 2, roof === "zinc" ? "#6a7076" : "#7a5a2a");
    b.rect(0, 28, W, 2, "#2a2016");
    for (let y = 58; y < 72; y += 3) b.rect(35, y, 10, 1, "#7a5232");
    b.rect(34, 57, 1, 15, "#4a3420");
    b.rect(45, 57, 1, 15, "#4a3420");
    b.rect(8, 49, 4, 3, "#a85a3a");
    b.blob(10, 47, 3, 2, "#3f7a2e");
    if (rng() < 0.6) {
      b.rect(66, 49, 4, 3, "#a85a3a");
      b.blob(68, 47, 3, 2, "#c84a6a");
    }
    b.outline(DARK2);
    return b.toCanvas();
  }
  function casaFarinhaSprite(seed) {
    const W = 78, H = 62;
    const b = new PixBuf(W, H);
    b.rect(6, 30, 66, 28, "#6e5438");
    for (let i = 0; i < 80; i++) b.px(6 + hash2(i, 1, seed) * 66, 30 + hash2(i, 2, seed) * 28, "#5a442c");
    b.shaded(39, 44, 16, 8, ["#3a2a20", "#5a4232", "#7a5a42", "#94704e"], seed);
    b.blob(39, 43, 13, 6, "#2a2a2a");
    b.blob(39, 43, 11, 4.5, "#7a7a74");
    b.blob(37, 42, 6, 2, "#d8cfa8");
    b.rect(28, 50, 22, 2, "#e07a2a");
    b.rect(31, 51, 16, 1, "#ffb040");
    b.shaded(14, 50, 5, 4, ["#6e522a", "#8a6a3a", "#a4834a"], seed + 4);
    b.blob(14, 47, 4, 1.5, "#e8dcb8");
    b.shaded(64, 51, 5, 4, ["#6e522a", "#8a6a3a", "#a4834a"], seed + 5);
    for (let y = 22; y < 44; y++) b.rect(60 + (y % 2 ? 0 : 1), y, 3, 1, y % 2 ? "#b89a5a" : "#8a6a34");
    for (const x of [5, 70]) {
      b.rect(x, 18, 3, 40, "#4a3420");
    }
    for (let y = 0; y < 24; y++) for (let x = 0; x < W; x++) {
      const col = (y + x % 3) % 3 === 0 ? "#8a6a34" : (x + y * 3) % 7 === 0 ? "#d4b06a" : "#b08a4a";
      b.px(x, y, col);
    }
    b.rect(0, 22, W, 2, "#5a4220");
    b.outline(DARK2);
    return b.toCanvas();
  }
  function canoeSprite(seed, broken = false) {
    const W = 50, H = 14;
    const b = new PixBuf(W, H);
    for (let x = 2; x < W - 2; x++) {
      const t = (x - 2) / (W - 4);
      const hw = Math.sin(t * Math.PI) * 5.2 + 0.6;
      for (let y = -hw; y <= hw; y++) {
        const edge = Math.abs(y) > hw - 1.4;
        let col = edge ? broken ? "#5a5444" : "#5a3a22" : broken ? "#6e6a58" : "#8a5e38";
        if (!edge && y > 0) col = broken ? "#5e5a4a" : "#6e4a2c";
        b.px(x, 7 + y, col);
      }
    }
    for (const x of [16, 33]) b.rect(x, 3, 2, 8, broken ? "#4a4638" : "#a07a4a");
    if (broken) {
      for (let i = 0; i < 18; i++) b.mpx(6 + hash2(i, 7, seed) * 38, 3 + hash2(i, 8, seed) * 8, "#4f6e34");
      b.rect(22, 9, 7, 4, "#2a2418");
    } else {
      b.line(36, 10, 47, 2, "#c8a46a");
      b.rect(45, 1, 3, 3, "#c8a46a");
    }
    b.outline(DARK2);
    return b.toCanvas();
  }
  function jiraoSprite() {
    const b = new PixBuf(34, 20);
    for (const x of [2, 30]) b.rect(x, 8, 2, 12, "#4a3420");
    b.rect(0, 6, 34, 4, "#8a6240");
    for (let x = 0; x < 34; x += 4) b.rect(x, 6, 1, 4, "#6a4a2e");
    b.rect(0, 9, 34, 1, "#4a3420");
    b.outline(DARK2);
    return b.toCanvas();
  }
  function fenceSprite(len = 32) {
    const b = new PixBuf(len + 2, 14);
    for (let x = 0; x < len; x += 8) b.rect(x, 1, 2, 12, "#5a4028");
    b.rect(0, 4, len, 1, "#7a5a38");
    b.rect(0, 8, len, 1, "#7a5a38");
    b.outline(DARK2);
    return b.toCanvas();
  }
  function trailPostSprite() {
    const b = new PixBuf(12, 26);
    b.rect(5, 4, 3, 21, "#5a4028");
    b.rect(7, 4, 1, 21, "#3e2c1a");
    b.rect(3, 6, 7, 3, "#c8322a");
    b.rect(8, 9, 2, 5, "#c8322a");
    b.rect(9, 13, 1, 3, "#a82a22");
    b.rect(5, 15, 3, 1, "#2a1a10");
    b.rect(5, 18, 3, 1, "#2a1a10");
    b.outline(DARK2);
    return b.toCanvas();
  }
  function woodpileSprite() {
    const b = new PixBuf(30, 16);
    for (let i = 0; i < 4; i++) {
      b.rect(1, 12 - i * 3, 28, 3, i % 2 ? "#8a6240" : "#a07448");
      b.rect(1, 12 - i * 3, 28, 1, "#c09060");
    }
    b.outline(DARK2);
    return b.toCanvas();
  }
  function sticksSprite() {
    const b = new PixBuf(18, 10);
    b.line(1, 7, 16, 3, "#7a5a38");
    b.line(2, 4, 15, 8, "#8a6a44");
    b.line(3, 6, 16, 6, "#6a4a2e");
    b.rect(8, 3, 2, 6, "#c8a24a");
    b.outline(DARK2);
    return b.toCanvas();
  }
  function cipoSprite(len = 40) {
    const b = new PixBuf(12, len);
    for (let y = 0; y < len; y++) {
      const x = 6 + Math.sin(y * 0.25) * 2.5;
      b.px(x, y, "#5a4a2a");
      b.px(x + 1, y, "#3e321c");
      if (y % 7 === 0) {
        b.px(x + 2, y, "#4f7a32");
        b.px(x + 3, y - 1, "#4f7a32");
      }
    }
    b.outline("#0e0a06");
    return b.toCanvas();
  }
  function fireFrames() {
    const frames = [];
    for (let f = 0; f < 4; f++) {
      const b = new PixBuf(18, 20);
      b.rect(2, 15, 14, 3, "#5a3a22");
      b.line(2, 18, 15, 13, "#4a2e1a");
      b.line(2, 13, 15, 18, "#6a4428");
      for (const [x, y] of [[1, 17], [16, 17], [3, 19], [14, 19]]) b.rect(x, y, 2, 1, "#6e6a64");
      const rng = mulberry32(100 + f);
      for (let y = 2; y < 16; y++) {
        const t = (16 - y) / 14;
        const hw = Math.max(0.5, (1 - t) * 5 + Math.sin(y * 0.8 + f * 1.7) * 1.2);
        for (let x = 9 - hw; x < 9 + hw; x++) {
          const c = t > 0.7 ? "#ffd860" : t > 0.4 ? rng() < 0.5 ? "#ffa030" : "#ffc040" : "#e85a1a";
          b.px(x + Math.sin(y + f) * 0.6, y, c);
        }
      }
      frames.push(b.toCanvas());
    }
    return frames;
  }
  function trackSprite(kind) {
    const b = new PixBuf(28, 22);
    const col = "#2a1c10", hi = "#7a6040";
    const print = (x, y, pts) => {
      for (const [dx, dy] of pts) {
        b.px(x + dx, y + dy, col);
        b.px(x + dx, y + dy - 1, hi);
      }
    };
    switch (kind) {
      case "cotia":
        for (let i = 0; i < 4; i++) print(4 + i * 6, 6 + i % 2 * 6, [[0, 0], [1, 0], [0, 1], [2, -1], [-1, -1]]);
        break;
      case "tatu":
        b.blob(14, 11, 7, 5, "#3a2a18");
        b.blob(14, 12, 5, 3, "#120c06");
        for (let i = 0; i < 12; i++) b.px(4 + hash2(i, 1, 9) * 20, 15 + hash2(i, 2, 9) * 6, "#8a6a44");
        break;
      case "queixada":
        for (let i = 0; i < 9; i++) {
          const x = 3 + hash2(i, 3, 4) * 22, y = 3 + hash2(i, 4, 4) * 16;
          print(x, y, [[0, 0], [0, 1], [2, 0], [2, 1]]);
        }
        break;
      case "anta":
        for (let i = 0; i < 2; i++) {
          const x = 7 + i * 12, y = 8 + i * 6;
          print(x, y, [[0, 0], [1, 0], [2, 1], [-2, 1], [-1, 0], [0, 3], [3, 3], [-3, 3], [0, 4], [1, 4], [-1, 4]]);
        }
        break;
      case "capivara":
        for (let i = 0; i < 3; i++) print(5 + i * 8, 8 + i % 2 * 5, [[0, 0], [1, -1], [2, -1], [3, 0], [1, 1], [2, 1], [1, 2], [2, 2]]);
        b.rect(22, 16, 2, 1, "#3a2a18");
        b.rect(19, 18, 2, 1, "#3a2a18");
        b.rect(24, 18, 2, 1, "#3a2a18");
        break;
      case "onca":
        for (let i = 0; i < 2; i++) {
          const x = 8 + i * 11, y = 10 - i * 3;
          b.blob(x, y + 2, 2.5, 2, col);
          for (const [dx, dy] of [[-3, -2], [-1, -3], [1, -3], [3, -2]]) b.px(x + dx, y + dy, col);
        }
        break;
      case "veado":
        for (let i = 0; i < 3; i++) {
          const x = 6 + i * 7, y = 14 - i * 4;
          print(x, y, [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2], [1, 3]]);
        }
        break;
    }
    return b.toCanvas();
  }
  function iconSprite(id) {
    const b = new PixBuf(16, 16);
    switch (id) {
      case "espingarda":
        b.line(1, 12, 13, 2, "#3b3b40");
        b.line(2, 12, 14, 2, "#5a5a62");
        b.rect(1, 11, 4, 3, "#6a4022");
        b.rect(6, 9, 2, 2, "#2a2a2a");
        break;
      case "facao":
        b.line(3, 13, 13, 3, "#c8ccd0");
        b.line(4, 13, 14, 3, "#9aa0a6");
        b.rect(1, 12, 4, 3, "#4a2a14");
        b.px(14, 2, "#e8ecef");
        break;
      case "cantil":
        b.shaded(8, 9, 5, 5.5, ["#2e4a2a", "#3f6438", "#557e4a", "#6e9a60"], 3);
        b.rect(6, 2, 4, 3, "#8a8a8a");
        b.rect(7, 1, 2, 1, "#5a5a5a");
        b.rect(4, 7, 8, 1, "#7a6040");
        break;
      case "lanterna":
        b.rect(3, 6, 8, 5, "#c8a020");
        b.rect(3, 6, 8, 1, "#e8c840");
        b.rect(11, 5, 3, 7, "#9a9aa0");
        b.rect(12, 6, 2, 5, "#f8f0c0");
        b.rect(6, 7, 2, 2, "#2a2a2a");
        break;
      case "marmita":
        b.shaded(8, 9, 6, 4.5, ["#6e7278", "#90969c", "#b4bac0", "#d4d8dc"], 4);
        b.rect(2, 6, 12, 2, "#a4aab0");
        b.rect(6, 4, 4, 2, "#6e7278");
        break;
      case "paneiro":
        b.rect(3, 4, 10, 10, "#8a6a3a");
        for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) if ((x + y) % 2 === 0) b.px(3 + x, 4 + y, "#6e522a");
        b.rect(3, 4, 10, 1, "#5e4422");
        b.line(4, 4, 6, 1, "#5e4422");
        b.line(12, 4, 10, 1, "#5e4422");
        break;
      case "tabua":
        b.rect(1, 6, 14, 4, "#9a7048");
        b.rect(1, 6, 14, 1, "#c09060");
        b.px(4, 8, "#6a4a2e");
        b.px(11, 7, "#6a4a2e");
        break;
      case "cipo":
        for (let i = 0; i < 4; i++) b.blob(8, 8, 6 - i, 5 - i, i % 2 ? "#6a5a32" : "#4e4224");
        b.rect(7, 7, 3, 2, "#2a2214");
        break;
      case "galhos":
        b.line(1, 12, 14, 5, "#7a5a38");
        b.line(2, 6, 14, 12, "#8a6a44");
        b.line(2, 9, 14, 9, "#6a4a2e");
        b.rect(7, 6, 2, 6, "#c8a24a");
        break;
      case "fumo":
        b.blob(8, 8, 6, 3.5, "#5a3a1a");
        for (let x = 3; x < 14; x += 2) b.rect(x, 5, 1, 7, "#3e2610");
        b.rect(7, 4, 2, 9, "#c8a24a");
        break;
      case "pilhas":
        b.rect(3, 4, 4, 9, "#2a5ac8");
        b.rect(9, 4, 4, 9, "#2a5ac8");
        b.rect(3, 4, 4, 2, "#d8c040");
        b.rect(9, 4, 4, 2, "#d8c040");
        b.rect(4, 3, 2, 1, "#c0c0c0");
        b.rect(10, 3, 2, 1, "#c0c0c0");
        break;
      case "cartucho":
        b.rect(5, 3, 6, 10, "#b82a22");
        b.rect(5, 11, 6, 3, "#c8a040");
        b.rect(5, 3, 6, 1, "#d84a3a");
        break;
      case "caco":
        b.rect(3, 4, 10, 8, "#c27a4a");
        b.clear(3, 4, 2, 2);
        b.clear(12, 10, 1, 2);
        b.line(4, 7, 12, 7, "#7a2a1a");
        b.line(5, 9, 11, 10, "#7a2a1a");
        b.rect(6, 5, 3, 1, "#e8d0a0");
        break;
      case "pena":
        b.line(3, 14, 12, 2, "#d8d0c0");
        for (let i = 0; i < 9; i++) {
          b.line(4 + i, 12 - i * 1.2, 7 + i, 13 - i * 1.2, "#1a1a22");
          b.px(5 + i, 11 - i * 1.2, "#2a3a5a");
        }
        break;
      case "anzol":
        for (let y = 2; y < 10; y++) b.px(9, y, "#8a5a3a");
        b.px(9, 10, "#8a5a3a");
        b.px(8, 11, "#8a5a3a");
        b.px(7, 12, "#8a5a3a");
        b.px(6, 12, "#8a5a3a");
        b.px(5, 11, "#8a5a3a");
        b.px(5, 10, "#8a5a3a");
        b.px(6, 9, "#a87a4a");
        b.rect(8, 1, 3, 2, "#6a4a2e");
        break;
      case "jarina":
        b.shaded(8, 8, 5.5, 6, ["#a89878", "#c8b898", "#e0d4b8", "#f0e8d4"], 7);
        b.rect(7, 2, 2, 2, "#6a5a3a");
        break;
      case "jabuti":
        b.shaded(8, 9, 7, 5, ["#3a2a14", "#5a4220", "#7a5a2e", "#a07a3a"], 8);
        for (const [x, y] of [[5, 8], [8, 7], [11, 8], [6, 11], [10, 11]]) b.rect(x, y, 2, 2, "#c8a24a");
        break;
      case "caderno":
        b.rect(3, 2, 10, 12, "#6a4a2e");
        b.rect(4, 3, 8, 10, "#e8dcc0");
        for (let y = 5; y < 12; y += 2) b.rect(5, y, 6, 1, "#a89878");
        b.rect(3, 2, 1, 12, "#3a2a1a");
        break;
      default:
        b.blob(8, 8, 5, 5, "#c8a24a");
    }
    b.outline("#120c07");
    return b.toCanvas();
  }
  function shade(hex, f) {
    const h = hex.replace("#", "");
    const c = [0, 2, 4].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * f))));
    return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
  }

  // js/data/lore.js
  var LORE_HTML = `
<h3>Sobre as lendas deste jogo</h3>
<p><b>A \xDAltima Ca\xE7ada</b> \xE9 uma obra de fic\xE7\xE3o. A comunidade de S\xE3o Sebasti\xE3o do Igarap\xE9 Grande, seus moradores e o enredo foram inventados. As figuras lend\xE1rias que aparecem ao longo da campanha v\xEAm do imagin\xE1rio popular amaz\xF4nico, mas o jogo as reconta com liberdade.</p>
<h4>O que vem da tradi\xE7\xE3o</h4>
<ul>
<li><b>Curupira</b>: protetor da mata, de p\xE9s virados para tr\xE1s, que confunde ca\xE7adores. \xC9 uma das figuras mais antigas do pa\xEDs: o padre Jos\xE9 de Anchieta j\xE1 o mencionava em carta de 1560.</li>
<li><b>Matinta Pereira</b>: entidade associada a um assobio agudo na noite, ora ave, ora mulher idosa que volta para pedir tabaco, caf\xE9 ou comida. \xC9 muito presente no Par\xE1 e em partes do Amazonas, com muitas varia\xE7\xF5es locais.</li>
<li><b>Cobra Grande / Boi\xFAna</b>: serpente gigantesca dos rios e lagos, ligada \xE0 origem de igarap\xE9s e a naufr\xE1gios. As vers\xF5es mudam bastante de lugar para lugar.</li>
<li><b>Boto</b>: o boto que se transforma em rapaz vestido de branco e frequenta festas \xE9 narrado em toda a Amaz\xF4nia ribeirinha.</li>
<li><b>Iara</b>: "senhora das \xE1guas", nome de origem tupi. A imagem atual de sereia de cabelos longos mistura ra\xEDzes ind\xEDgenas com influ\xEAncias europeias.</li>
<li><b>Mapinguari</b>: criatura enorme, peluda e de cheiro forte, com relatos sobretudo no Acre, Amazonas, Par\xE1 e Rond\xF4nia.</li>
<li>Oferecer <b>fumo</b> aos donos da mata e "pedir licen\xE7a" ao entrar na floresta s\xE3o pr\xE1ticas citadas em muitos relatos regionais.</li>
</ul>
<h4>O que \xE9 cria\xE7\xE3o do jogo</h4>
<ul>
<li>A ideia de que os encantados interferem juntos numa mesma ca\xE7ada e o motivo disso.</li>
<li>O encontro do viajante de branco com o canto no lago, que combina boto e Iara numa s\xF3 cena.</li>
<li>Di\xE1logos, promessas, enigmas e falas atribu\xEDdas \xE0s entidades.</li>
</ul>
<p>Essas tradi\xE7\xF5es s\xE3o compartilhadas por povos ind\xEDgenas, caboclos, ribeirinhos e quilombolas, com origens diversas. O jogo n\xE3o atribui nenhuma delas a um povo ind\xEDgena espec\xEDfico.</p>
<p class="small">Os animais do jogo s\xE3o esp\xE9cies reais da Amaz\xF4nia. No Brasil, a ca\xE7a de animais silvestres \xE9 regulada por lei; aqui, ela existe apenas como fic\xE7\xE3o.</p>
`;

  // js/ui/ui.js
  var PHASE_NAMES = {
    1: "A Primeira Pegada",
    2: "O Caminho dos Queixadas",
    3: "Os Segredos da V\xE1rzea",
    4: "Os Assobios de Matinta"
  };
  var NOISE_WORD = (v) => v < 0.2 ? "BAIXO" : v < 0.62 ? "M\xC9DIO" : "ALTO";
  var $ = (id) => document.getElementById(id);
  var icon = (id) => Sprites.get("icon:" + id, () => iconSprite(id));
  var UI = class {
    constructor(g) {
      this.g = g;
      this.el = {
        timer: $("timer"),
        tod: $("tod"),
        todname: $("todname"),
        missions: $("missions"),
        hp: $("b-hp"),
        en: $("b-en"),
        lt: $("b-lt"),
        noise: $("noise"),
        stance: $("stance"),
        found: $("found"),
        quick: $("quick"),
        mini: $("minimap"),
        toasts: $("toasts"),
        caption: $("caption"),
        dialog: $("dialog"),
        dname: document.querySelector(".dlg-name"),
        dtext: document.querySelector(".dlg-text"),
        dchoices: document.querySelector(".dlg-choices"),
        dnext: document.querySelector(".dlg-next"),
        portrait: $("portrait"),
        mhTimer: $("mh-timer"),
        mhObj: $("mh-obj"),
        mhHp: document.querySelector(".mh-bar.hp i"),
        mhEn: document.querySelector(".mh-bar.en i"),
        missions2: $("missions2"),
        nav: $("navhud"),
        psec: $("psec"),
        msecTitle: $("msec-title"),
        noiseLv: $("noise-lv"),
        foundLbl: $("found-lbl"),
        alert: $("alertbar")
      };
      this.cache = {};
      this.screenStack = [];
      this.dlg = null;
      this.hudT = 0;
      this.openHint = null;
      $("lore").innerHTML = LORE_HTML + '<div class="m-btns row"><button data-back class="btn primary">Voltar</button></div>';
      this.bind();
    }
    bind() {
      const g = this.g;
      document.querySelectorAll("[data-ui]").forEach((b) => b.addEventListener("click", () => {
        g.audio.play("ui");
        g.toggleOverlay(b.dataset.ui);
      }));
      document.querySelectorAll("[data-act-ui]").forEach((b) => b.addEventListener("click", () => {
        g.audio.play("ui");
        g.uiAction(b.dataset.actUi);
      }));
      document.addEventListener("click", (e) => {
        const o = e.target.closest("[data-open]");
        if (o) {
          g.audio.play("ui");
          this.pushScreen(o.dataset.open);
        }
        const bk = e.target.closest("[data-back]");
        if (bk) {
          g.audio.play("ui");
          this.popScreen();
        }
      });
      $("btn-new").addEventListener("click", () => {
        g.audio.init();
        g.audio.play("ui");
        g.newGame();
      });
      $("btn-continue").addEventListener("click", () => {
        g.audio.init();
        g.audio.play("ui");
        g.continueGame();
      });
      $("btn-phases").addEventListener("click", () => {
        g.audio.init();
        g.audio.play("ui");
        this.renderPhases();
        this.pushScreen("phases");
      });
      $("btn-quit").addEventListener("click", () => {
        g.audio.init();
        g.audio.play("ui");
        this.quitGame();
      });
      this.el.dialog.addEventListener("click", (e) => {
        if (!e.target.closest("button")) this.advance();
      });
      $("scr-intro").addEventListener("click", () => this.introNext && this.introNext());
      $("scrim").addEventListener("click", () => this.setDrawer(false));
      const s = g.settings;
      document.querySelectorAll("[data-set]").forEach((inp) => {
        const k = inp.dataset.set;
        if (inp.type === "checkbox") inp.checked = !!s[k];
        else inp.value = s[k];
        inp.addEventListener("input", () => {
          s[k] = inp.type === "checkbox" ? inp.checked : parseFloat(inp.value);
          g.applySettings();
        });
      });
    }
    // ---------- capa (menu principal) ----------
    quitGame() {
      try {
        window.close();
      } catch (e) {
      }
      const m = $("cover-msg");
      m.textContent = "O navegador n\xE3o deixa o jogo fechar a aba sozinho. Pode fech\xE1-la quando quiser: seu progresso fica salvo.";
      m.hidden = false;
      clearTimeout(this.quitT);
      this.quitT = setTimeout(() => {
        m.hidden = true;
      }, 6e3);
    }
    menuKey(act) {
      if (this.screenStack[this.screenStack.length - 1] !== "menu") return;
      const ae = document.activeElement;
      if (act === "confirm") {
        if (ae && ae.tagName === "BUTTON" && ae.closest("#scr-menu")) {
          ae.click();
          return;
        }
        (this.g.hasSave() ? $("btn-continue") : $("btn-new")).click();
        return;
      }
      const items = [...document.querySelectorAll("#scr-menu .hot")].filter((b) => !b.hidden);
      let i = items.indexOf(ae);
      i = i < 0 ? 0 : (i + (act === "down" ? 1 : -1) + items.length) % items.length;
      items[i].focus();
    }
    // ---------- telas ----------
    showScreen(name) {
      document.querySelectorAll(".screen").forEach((s) => s.classList.remove("show"));
      this.screenStack = name ? [name] : [];
      if (name) $("scr-" + name).classList.add("show");
      if (name === "menu") {
        $("btn-continue").hidden = !this.g.hasSave();
        $("btn-phases").hidden = !Save.isUnlocked(2);
      }
      const first = name && $("scr-" + name).querySelector(".btn.primary, .btn");
      if (first && this.g.input.lastDevice === "keyboard") setTimeout(() => first.focus(), 30);
    }
    pushScreen(name) {
      const cur = this.screenStack[this.screenStack.length - 1];
      if (cur) $("scr-" + cur).classList.remove("show");
      this.screenStack.push(name);
      $("scr-" + name).classList.add("show");
    }
    popScreen() {
      const cur = this.screenStack.pop();
      if (cur) $("scr-" + cur).classList.remove("show");
      const prev = this.screenStack[this.screenStack.length - 1];
      if (prev) $("scr-" + prev).classList.add("show");
      else this.g.uiAction("resume");
    }
    topScreen() {
      return this.screenStack[this.screenStack.length - 1];
    }
    // ---------- fase atual ----------
    setPhase(ph) {
      $("ph-code").textContent = ph.code;
      $("ph-title").textContent = ph.title;
      const sec = !!(ph.secondary && ph.secondary.length);
      this.el.psec.hidden = !sec;
      this.el.msecTitle.textContent = sec ? "MISS\xD5ES PRINCIPAIS" : "MISS\xD5ES";
      this.clearAlert();
      this.cache = {};
    }
    alert(text, kind = "alert", ttl = 0) {
      const a = this.el.alert;
      if (this.alertText === text && !a.hidden) {
        clearTimeout(this.alertT);
        if (ttl) this.alertT = setTimeout(() => this.clearAlert(), ttl);
        return;
      }
      this.alertText = text;
      a.textContent = text;
      a.className = "alertbar " + kind;
      a.hidden = false;
      a.style.animation = "none";
      void a.offsetWidth;
      a.style.animation = "";
      clearTimeout(this.alertT);
      if (ttl) this.alertT = setTimeout(() => this.clearAlert(), ttl);
    }
    clearAlert() {
      if (this.el.alert) this.el.alert.hidden = true;
      this.alertText = null;
      clearTimeout(this.alertT);
    }
    loading(p, msg) {
      $("lg-fill").style.width = `${Math.round(p * 100)}%`;
      if (msg) $("lg-msg").textContent = msg;
    }
    setDrawer(open) {
      document.body.classList.toggle("drawer-open", open);
      $("scrim").hidden = !open || window.innerWidth > 900;
    }
    // ---------- notificações ----------
    toast(text, type = "tip", ttl = 4200) {
      const d = document.createElement("div");
      d.className = "toast " + type;
      d.innerHTML = text;
      this.el.toasts.appendChild(d);
      while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
      setTimeout(() => {
        d.classList.add("out");
        setTimeout(() => d.remove(), 450);
      }, ttl);
    }
    caption(text, pan = 0) {
      if (!this.g.settings.captions) return;
      const arrow = pan < -0.3 ? "\u25C0 " : pan > 0.3 ? "" : "";
      const arrowR = pan > 0.3 ? " \u25B6" : "";
      this.el.caption.textContent = `${arrow}[${text}]${arrowR}`;
      this.el.caption.hidden = false;
      clearTimeout(this.capT);
      this.capT = setTimeout(() => {
        this.el.caption.hidden = true;
      }, 3800);
    }
    titleCard(code, title, sub = "", cls = "") {
      const t = $("titlecard");
      t.classList.toggle("small", cls === "small");
      t.querySelector(".tc-code").textContent = code;
      t.querySelector(".tc-title").textContent = title;
      t.querySelector(".tc-sub").textContent = sub;
      t.hidden = false;
      t.style.animation = "none";
      void t.offsetWidth;
      t.style.animation = "";
      clearTimeout(this.tcT);
      this.tcT = setTimeout(() => {
        t.hidden = true;
      }, 4300);
    }
    flashStance() {
      const s = this.el.stance;
      s.classList.remove("flash");
      void s.offsetWidth;
      s.classList.add("flash");
    }
    // ---------- diálogos ----------
    drawPortrait(look) {
      const c = this.el.portrait, x = c.getContext("2d");
      x.clearRect(0, 0, c.width, c.height);
      if (!look || !LOOKS[look]) {
        c.style.visibility = "hidden";
        return;
      }
      c.style.visibility = "visible";
      x.drawImage(Sprites.get(`h:${look}:down:0:0`, () => humanSprite(LOOKS[look], "down", 0, false)), 0, 0);
    }
    say(name, text, look) {
      return new Promise((res) => {
        this.el.dialog.hidden = false;
        this.el.dname.textContent = name || "";
        this.el.dchoices.innerHTML = "";
        this.el.dnext.hidden = false;
        this.drawPortrait(look);
        this.dlg = { text, shown: 0, done: false, res, choice: false };
        this.el.dtext.innerHTML = "";
        this.g.audio.play("page");
      });
    }
    choice(name, text, options, look) {
      return new Promise((res) => {
        this.el.dialog.hidden = false;
        this.el.dname.textContent = name || "";
        this.drawPortrait(look);
        this.el.dtext.innerHTML = text;
        this.el.dnext.hidden = true;
        this.el.dchoices.innerHTML = "";
        this.dlg = { choice: true, res, options };
        options.forEach((o, i) => {
          const b = document.createElement("button");
          b.innerHTML = `<kbd>${i + 1}</kbd>${o}`;
          b.addEventListener("click", () => this.pick(i));
          this.el.dchoices.appendChild(b);
        });
        if (this.g.input.lastDevice === "keyboard") setTimeout(() => this.el.dchoices.firstChild?.focus(), 30);
      });
    }
    pick(i) {
      if (!this.dlg || !this.dlg.choice) return;
      if (i < 0 || i >= this.dlg.options.length) return;
      const r = this.dlg.res;
      this.dlg = null;
      this.el.dialog.hidden = true;
      this.el.dchoices.innerHTML = "";
      this.g.audio.play("ui");
      r(i);
    }
    updateDialog(dt) {
      const d = this.dlg;
      if (!d || d.choice || d.done) return;
      d.shown = Math.min(d.text.length, d.shown + dt * 55);
      this.el.dtext.textContent = d.text.slice(0, Math.floor(d.shown));
      if (d.shown >= d.text.length) d.done = true;
    }
    advance() {
      const d = this.dlg;
      if (!d || d.choice) return;
      if (!d.done) {
        d.shown = d.text.length;
        d.done = true;
        this.el.dtext.textContent = d.text;
        return;
      }
      this.dlg = null;
      this.el.dialog.hidden = true;
      d.res();
    }
    hideDialog() {
      this.el.dialog.hidden = true;
      this.dlg = null;
    }
    // ---------- intro ----------
    intro(slides) {
      return new Promise((res) => {
        this.showScreen("intro");
        const el = $("intro-text");
        let i = -1;
        const next = () => {
          i++;
          if (i >= slides.length) {
            this.introNext = null;
            this.showScreen(null);
            res();
            return;
          }
          el.style.opacity = 0;
          setTimeout(() => {
            el.innerHTML = slides[i];
            el.style.opacity = 1;
          }, 350);
        };
        this.introNext = () => {
          this.g.audio.play("page");
          next();
        };
        next();
      });
    }
    // ---------- missões ----------
    renderMissions() {
      const g = this.g, list = this.el.missions;
      const cur = g.currentMission();
      list.innerHTML = "";
      this.renderList(list, g.phase.missions, cur);
      if (g.phase.secondary) this.renderList(this.el.missions2, g.phase.secondary, null);
      this.justDone = null;
      this.cache.prog = this.progressKey();
      const c = g.currentMission();
      this.el.mhObj.textContent = c ? "\u25B8 " + c.title : "";
    }
    renderList(list, missions, cur) {
      const g = this.g;
      list.innerHTML = "";
      for (const m of missions) {
        const li = document.createElement("li");
        const done = g.done.has(m.id);
        li.className = "m" + (done ? " done" : "") + (cur && cur.id === m.id ? " current" : "");
        li.dataset.id = m.id;
        const prog = !done && m.progress ? m.progress() : "";
        li.innerHTML = `<span class="cb">\u2713</span><span class="mt">${m.title}${prog ? ` <span class="mp">${prog}</span>` : ""}</span><button class="mh" title="Dica" aria-label="Dica">?</button>${this.openHint === m.id ? `<div class="hint">${typeof m.hint === "function" ? m.hint() : m.hint}</div>` : ""}`;
        li.querySelector(".mh").addEventListener("click", (e) => {
          e.stopPropagation();
          this.openHint = this.openHint === m.id ? null : m.id;
          g.audio.play("ui");
          this.renderMissions();
        });
        if (this.justDone === m.id) li.classList.add("just");
        if (m.failed && !done && m.failed()) li.classList.add("failed");
        list.appendChild(li);
      }
    }
    progressKey() {
      const ph = this.g.phase, all = ph.missions.concat(ph.secondary || []);
      const cur = this.g.currentMission();
      return all.map((m) => (m.progress ? m.progress() : "") + (m.failed && m.failed() ? "!" : "")).join("|") + "#" + (cur ? cur.id : "");
    }
    markDone(id) {
      this.justDone = id;
      this.renderMissions();
    }
    // ---------- HUD ----------
    updateHUD(dt) {
      this.hudT -= dt;
      if (this.hudT > 0) return;
      this.hudT = 0.1;
      const g = this.g, p = g.player, c = this.cache;
      const set = (k, v, fn) => {
        if (c[k] !== v) {
          c[k] = v;
          fn(v);
        }
      };
      const tl = formatTime(g.timeLeft);
      set("timer", tl, (v) => {
        this.el.timer.textContent = v;
        this.el.mhTimer.textContent = v;
        this.el.timer.classList.toggle("low", g.timeLeft < 300);
      });
      set("tod", formatClock(g.tod), (v) => {
        this.el.tod.textContent = v;
      });
      set("todn", g.todName(), (v) => {
        this.el.todname.textContent = v;
      });
      const bar = (el, k, v, max, txt) => set(k, Math.round(v), () => {
        el.querySelector(".fill").style.width = `${clamp(v / max, 0, 1) * 100}%`;
        el.querySelector(".bv").textContent = txt;
      });
      bar(this.el.hp, "hp", p.hp, 100, `${Math.round(p.hp)}/100`);
      bar(this.el.en, "en", p.en, 100, `${Math.round(p.en)}/100`);
      bar(this.el.lt, "lt", p.battery, 100, `${Math.round(p.battery)}%`);
      set("mhhp", Math.round(p.hp), (v) => {
        this.el.mhHp.style.width = v + "%";
      });
      set("mhen", Math.round(p.en), (v) => {
        this.el.mhEn.style.width = v + "%";
      });
      const nz = Math.max(p.noise, p.noiseSpike);
      const lv = Math.round(nz * 5);
      set("noise", lv, (v) => {
        [...this.el.noise.children].forEach((i, k) => {
          i.className = k < v ? "on" + (k >= 3 ? " hi" : k >= 1 ? " mid" : "") : "";
        });
      });
      set("noisew", NOISE_WORD(nz), (v) => {
        if (this.el.noiseLv) {
          this.el.noiseLv.textContent = v;
          this.el.noiseLv.className = "nlv " + (v === "ALTO" ? "hi" : v === "M\xC9DIO" ? "mid" : "lo");
        }
      });
      const st = p.exhausted ? "Exausto" : p.aiming ? "Mirando" : p.running ? "Correndo" : p.sneak ? p.inBush ? "Escondido" : "Agachado" : p.inBush ? "Na moita" : p.moving ? "Andando" : "Parado";
      set("stance", st, (v) => {
        this.el.stance.textContent = v;
      });
      const row = g.phase.panelRow ? g.phase.panelRow() : ["Itens encontrados", `${g.inv.found.size}/${COLLECTIBLES.length}`];
      set("found", row.join("|"), () => {
        this.el.foundLbl.textContent = row[0];
        this.el.found.textContent = row[1];
      });
      const q = [["cantil", `${g.res.water}/4`], ["marmita", `${g.res.food}`], ["cartucho", `${g.res.ammo}`], ["pilhas", `${g.inv.count("pilhas")}`]].filter(([id]) => id === "cartucho" ? g.inv.has("espingarda") : g.inv.has(id));
      set("quick", JSON.stringify(q), () => {
        this.el.quick.innerHTML = "";
        for (const [id, t] of q) {
          const d = document.createElement("div");
          d.className = "qi";
          d.title = ITEMS[id].name;
          const cv = document.createElement("canvas");
          cv.width = 16;
          cv.height = 16;
          cv.getContext("2d").drawImage(icon(id), 0, 0);
          d.appendChild(cv);
          d.insertAdjacentHTML("beforeend", `<b>${t}</b>`);
          this.el.quick.appendChild(d);
        }
      });
      this.updateNav(g.phase.navInfo ? g.phase.navInfo() : null);
      const pk = this.progressKey();
      if (pk !== c.prog) this.renderMissions();
      this.drawMinimap();
    }
    // painel discreto da canoa: velocidade, correnteza (direção e força) e balanço no perigo
    updateNav(n) {
      const el = this.el.nav;
      if (!el) return;
      if (!n) {
        if (!el.hidden) el.hidden = true;
        return;
      }
      el.hidden = false;
      el.querySelector(".nv-sp i").style.width = `${clamp(n.speed / n.max, 0, 1) * 100}%`;
      const word = n.cur < 2 ? "parada" : n.cur < 9 ? "fraca" : n.cur < 19 ? "m\xE9dia" : "forte";
      el.querySelector(".nv-cw").textContent = word;
      el.querySelector(".nv-arrow").style.transform = `rotate(${n.curA}rad)`;
      el.querySelector(".nv-arrow").style.opacity = n.cur < 2 ? 0.25 : 1;
      const ib = el.querySelector(".nv-in");
      ib.hidden = n.instab === null;
      if (n.instab !== null) ib.querySelector("i").style.width = `${clamp(n.instab, 0, 100)}%`;
    }
    drawMinimap() {
      const g = this.g, w = g.world, cv = this.el.mini, x = cv.getContext("2d");
      if (!w.mini) return;
      const s = w.miniScale, p = g.player;
      const W = cv.width, H = cv.height;
      x.imageSmoothingEnabled = false;
      x.fillStyle = "#0b1209";
      x.fillRect(0, 0, W, H);
      const zoom = 2;
      const cxm = p.x / s, cym = p.y / s;
      const sw = W / zoom, sh = H / zoom;
      x.drawImage(w.mini, cxm - sw / 2, cym - sh / 2, sw, sh, 0, 0, W, H);
      x.fillStyle = "rgba(8,12,7,0.86)";
      const fc = 32 / s * zoom;
      const ox = (cxm - sw / 2) * zoom, oy = (cym - sh / 2) * zoom;
      const i0 = Math.floor(ox / fc), j0 = Math.floor(oy / fc);
      for (let j = j0; j < j0 + H / fc + 2; j++) for (let i = i0; i < i0 + W / fc + 2; i++) {
        const ex = i >= 0 && j >= 0 && i < w.fogCols && j < w.fogRows ? w.explored[j * w.fogCols + i] : 0;
        if (!ex) x.fillRect(Math.floor(i * fc - ox), Math.floor(j * fc - oy), Math.ceil(fc) + 1, Math.ceil(fc) + 1);
      }
      const toM = (wx, wy) => [W / 2 + (wx - p.x) / s * zoom, H / 2 + (wy - p.y) / s * zoom];
      for (const n of g.npcs) {
        const [a, b] = toM(n.x, n.y);
        x.fillStyle = "#7ab8e0";
        x.fillRect(a - 2, b - 2, 4, 4);
      }
      const t = g.currentTarget();
      if (t) {
        let [a, b] = toM(t.x, t.y);
        const out = a < 4 || b < 4 || a > W - 4 || b > H - 4;
        a = clamp(a, 5, W - 5);
        b = clamp(b, 5, H - 5);
        x.fillStyle = "#ffd666";
        x.beginPath();
        x.arc(a, b, out ? 3 : 4 + Math.sin(g.time * 5), 0, Math.PI * 2);
        x.fill();
      }
      x.save();
      x.translate(W / 2, H / 2);
      const ang = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[p.dir];
      x.rotate(ang);
      x.fillStyle = "#fff";
      x.beginPath();
      x.moveTo(6, 0);
      x.lineTo(-4, -4);
      x.lineTo(-2, 0);
      x.lineTo(-4, 4);
      x.closePath();
      x.fill();
      x.restore();
      x.fillStyle = "rgba(0,0,0,.55)";
      x.beginPath();
      x.arc(W - 24, 24, 19, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = "#6a7a5a";
      x.lineWidth = 1;
      x.stroke();
      x.fillStyle = "#e0654a";
      x.beginPath();
      x.moveTo(W - 24, 9);
      x.lineTo(W - 28, 24);
      x.lineTo(W - 20, 24);
      x.fill();
      x.fillStyle = "#d8d0b8";
      x.beginPath();
      x.moveTo(W - 24, 39);
      x.lineTo(W - 28, 24);
      x.lineTo(W - 20, 24);
      x.fill();
      x.font = "700 10px Nunito, sans-serif";
      x.textAlign = "center";
      x.fillStyle = "#fff";
      x.fillText("N", W - 24, 8);
      x.save();
      x.translate(26, H - 22);
      x.fillStyle = "rgba(0,0,0,.55)";
      x.beginPath();
      x.arc(0, 0, 16, 0, Math.PI * 2);
      x.fill();
      x.rotate(g.wind.a);
      x.strokeStyle = "#a8d8f0";
      x.lineWidth = 2;
      x.beginPath();
      x.moveTo(-9, 0);
      x.lineTo(9, 0);
      x.lineTo(5, -4);
      x.moveTo(9, 0);
      x.lineTo(5, 4);
      x.moveTo(-9, 0);
      x.lineTo(-12, -3);
      x.moveTo(-6, 0);
      x.lineTo(-9, -3);
      x.stroke();
      x.restore();
      x.font = "700 9px Nunito, sans-serif";
      x.fillStyle = "#a8d8f0";
      x.textAlign = "left";
      x.fillText("VENTO", 44, H - 18);
      x.fillStyle = "#7a8a6a";
      x.fillText("o cheiro vai junto", 44, H - 8);
    }
    // ---------- paneiro (inventário) ----------
    renderInventory() {
      const g = this.g, inv = g.inv;
      $("inv-cap").textContent = `${inv.slotsUsed()}/${inv.cap} espa\xE7os`;
      const grid = $("inv-grid");
      grid.innerHTML = "";
      const det = $("inv-detail");
      const showDet = (id) => {
        const it = ITEMS[id];
        let extra = "";
        if (id === "cantil") extra = `<p>\xC1gua: <b>${g.res.water}/4</b> goles.</p><button class="btn" data-use="cantil">Beber (1)</button>`;
        if (id === "marmita") extra = `<p>Por\xE7\xF5es: <b>${g.res.food}</b>.</p><button class="btn" data-use="marmita">Comer (2)</button>`;
        if (id === "pilhas") extra = `<button class="btn" data-use="pilhas">Trocar pilhas (3)</button>`;
        if (id === "espingarda") extra = `<p>Cartuchos: <b>${g.res.ammo}</b>.</p>`;
        det.innerHTML = `<h4>${it.name}</h4><p>${it.desc}</p>${extra}`;
        det.querySelectorAll("[data-use]").forEach((b) => b.addEventListener("click", () => {
          g.useItem(b.dataset.use);
          this.renderInventory();
          showDet(id);
        }));
      };
      const items = [...inv.items.entries()];
      for (let i = 0; i < inv.cap; i++) {
        const s = document.createElement("div");
        s.className = "slot";
        if (items[i]) {
          const [id, n] = items[i];
          const cv = document.createElement("canvas");
          cv.width = 16;
          cv.height = 16;
          cv.getContext("2d").drawImage(icon(id), 0, 0);
          s.appendChild(cv);
          const cnt = id === "cantil" ? g.res.water : id === "marmita" ? g.res.food : n > 1 ? n : "";
          if (cnt !== "") s.insertAdjacentHTML("beforeend", `<b>${cnt}</b>`);
          s.title = ITEMS[id].name;
          s.addEventListener("click", () => {
            grid.querySelectorAll(".slot").forEach((q) => q.classList.remove("sel"));
            s.classList.add("sel");
            showDet(id);
            g.audio.play("ui");
          });
        } else s.classList.add("empty");
        grid.appendChild(s);
      }
      const fg = $("inv-found");
      fg.innerHTML = "";
      for (const id of COLLECTIBLES) {
        const s = document.createElement("div");
        const has = inv.found.has(id);
        s.className = "slot" + (has ? "" : " locked");
        const cv = document.createElement("canvas");
        cv.width = 16;
        cv.height = 16;
        cv.getContext("2d").drawImage(icon(id), 0, 0);
        s.appendChild(cv);
        s.title = has ? ITEMS[id].name : "???";
        s.addEventListener("click", () => {
          if (has) {
            showDet(id);
            g.audio.play("ui");
          }
        });
        fg.appendChild(s);
      }
      const jr = $("inv-journal"), jh = $("inv-journal-h");
      const entries = g.phase.journal ? g.phase.journal() : [];
      jh.hidden = jr.hidden = !entries.length;
      jr.innerHTML = entries.map((e) => `<div class="jr"><b>${e.title}</b><span>${e.text}</span></div>`).join("");
      const tr = $("inv-tracks");
      tr.innerHTML = "";
      for (const t of g.phase.trackDefs || []) {
        const known = g.tracksKnown.has(t.id);
        const d = document.createElement("div");
        d.className = "trk" + (known ? "" : " unk");
        const cv = document.createElement("canvas");
        cv.width = 28;
        cv.height = 22;
        cv.getContext("2d").drawImage(Sprites.get("trk:" + t.kind, () => trackSprite(t.kind)), 0, 0);
        d.appendChild(cv);
        d.insertAdjacentHTML("beforeend", `<span>${known ? t.name : "Rastro desconhecido"}</span>`);
        tr.appendChild(d);
      }
    }
    drawBigMap() {
      const g = this.g, w = g.world, cv = $("bigmap"), x = cv.getContext("2d");
      const W = cv.width, H = cv.height;
      x.imageSmoothingEnabled = false;
      x.fillStyle = "#0b1209";
      x.fillRect(0, 0, W, H);
      const sc = Math.min(W / w.W, H / w.H);
      const ox = (W - w.W * sc) / 2, oy = (H - w.H * sc) / 2;
      x.drawImage(w.mini, ox, oy, w.W * sc, w.H * sc);
      x.fillStyle = "rgba(10,14,8,0.92)";
      const fc = 32 * sc;
      for (let j = 0; j < w.fogRows; j++) for (let i = 0; i < w.fogCols; i++) if (!w.explored[j * w.fogCols + i]) x.fillRect(Math.floor(ox + i * fc), Math.floor(oy + j * fc), Math.ceil(fc) + 1, Math.ceil(fc) + 1);
      x.font = "700 12px Nunito, sans-serif";
      x.textAlign = "center";
      for (const poi of g.phase.pois || []) {
        const fi = Math.floor(poi.x / 32), fj = Math.floor(poi.y / 32);
        if (!w.explored[fj * w.fogCols + fi]) continue;
        const px6 = ox + poi.x * sc, py = oy + poi.y * sc;
        x.fillStyle = "#8fcf6a";
        x.beginPath();
        x.arc(px6, py, 3.5, 0, Math.PI * 2);
        x.fill();
        x.fillStyle = "rgba(0,0,0,.7)";
        x.fillText(poi.name, px6 + 1, py - 7);
        x.fillStyle = "#f4ecd8";
        x.fillText(poi.name, px6, py - 8);
      }
      const t = g.currentTarget();
      if (t) {
        x.fillStyle = "#ffd666";
        x.beginPath();
        x.arc(ox + t.x * sc, oy + t.y * sc, 5, 0, Math.PI * 2);
        x.fill();
        x.strokeStyle = "#3a2a08";
        x.stroke();
      }
      const p = g.player;
      x.fillStyle = "#fff";
      x.strokeStyle = "#000";
      x.lineWidth = 2;
      x.beginPath();
      x.arc(ox + p.x * sc, oy + p.y * sc, 5, 0, Math.PI * 2);
      x.fill();
      x.stroke();
      x.fillStyle = "#e0654a";
      x.font = "800 14px Nunito, sans-serif";
      x.fillText("N \u25B2", W - 30, 22);
    }
    results(rows, info = {}) {
      const g = this.g, ph = g.phase, nx = ph.id + 1;
      $("r-code").textContent = info.code || `${ph.code} CONCLU\xCDDA`;
      $("r-title").textContent = info.title || ph.displayTitle || PHASE_NAMES[ph.id] || ph.title;
      $("results-body").innerHTML = rows.map(([k, v]) => `<div class="rstat"><span>${k}</span><b>${v}</b></div>`).join("");
      const playable = g.hasPhase(nx);
      $("r-next").innerHTML = `Pr\xF3xima fase: <b>${PHASE_NAMES[nx] || "em breve"}</b><br><span class="muted">${playable ? "desbloqueada" : "desbloqueada \xB7 dispon\xEDvel depois da sua valida\xE7\xE3o"}</span>`;
      $("btn-next").hidden = !playable;
      $("btn-next").textContent = `Jogar a Fase ${nx}`;
      this.showScreen("results");
    }
    renderPhases() {
      const g = this.g, prog = Save.progress(), box = $("phase-list");
      box.innerHTML = "";
      for (let id = 1; id <= Math.max(3, ...Object.keys(PHASE_NAMES).map(Number).filter((n) => Save.isUnlocked(n) || this.g.hasPhase(n))); id++) {
        const unlocked = Save.isUnlocked(id), playable = g.hasPhase(id), done = !!prog.completed[id];
        const run = Save.load(id), inProg = run && !run.completed;
        const d = document.createElement("div");
        d.className = "phase-item" + (unlocked ? "" : " locked");
        d.innerHTML = `<div class="pi-code">FASE ${id}${done ? ' \xB7 <span class="ok">conclu\xEDda</span>' : ""}</div><div class="pi-title">${unlocked ? PHASE_NAMES[id] : "???"}</div>`;
        const btns = document.createElement("div");
        btns.className = "pi-btns";
        if (unlocked && playable) {
          if (inProg) {
            const b = document.createElement("button");
            b.className = "btn primary";
            b.textContent = "Continuar";
            b.onclick = () => {
              g.audio.play("ui");
              g.playPhase(id, false);
            };
            btns.appendChild(b);
          }
          const b2 = document.createElement("button");
          b2.className = "btn" + (inProg ? "" : " primary");
          b2.textContent = done || inProg ? "Jogar do in\xEDcio" : "Come\xE7ar";
          b2.onclick = () => {
            g.audio.play("ui");
            g.playPhase(id, true);
          };
          btns.appendChild(b2);
        } else if (unlocked) btns.innerHTML = '<span class="muted">Desbloqueada \xB7 em desenvolvimento</span>';
        else btns.innerHTML = '<span class="muted">Bloqueada</span>';
        d.appendChild(btns);
        box.appendChild(d);
      }
    }
    fail(title, msg) {
      $("fail-title").textContent = title;
      $("fail-msg").textContent = msg;
      this.showScreen("fail");
    }
  };

  // js/engine/game.js
  var nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
  var LIGHT_KEYS = [
    [290, 0.8, [10, 14, 36], [70, 90, 170, 0.35], 0],
    [320, 0.7, [14, 16, 42], [100, 90, 170, 0.32], 0],
    [345, 0.58, [26, 20, 46], [190, 110, 150, 0.3], 0.05],
    [362, 0.42, [40, 24, 42], [240, 140, 100, 0.3], 0.2],
    [382, 0.24, [48, 28, 32], [255, 168, 90, 0.27], 0.45],
    [405, 0.1, [40, 28, 28], [255, 196, 120, 0.2], 0.7],
    [435, 0.03, [30, 24, 24], [255, 226, 168, 0.1], 0.85],
    [480, 0, [0, 0, 0], [255, 255, 255, 0], 1]
  ];
  var Game = class {
    // phases: { 1: createPhase1, 2: createPhase2, ... } (aceita também uma única função, como antes)
    constructor(phases) {
      this.registry = typeof phases === "function" ? { 1: phases } : phases;
      this.built = {};
      this.canvas = document.getElementById("game");
      this.input = new Input(this.canvas);
      this.audio = new AudioEngine();
      this.settings = Save.loadSettings();
      this.camera = new Camera();
      this.renderer = new Renderer(this, this.canvas);
      this.particles = new Particles();
      this.state = "loading";
      this.time = 0;
      this.last = 0;
      this.resetSessionVars();
      this.ui = new UI(this);
      this.applySettings();
      this.touch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
      if (this.touch) {
        document.body.classList.add("touch-ui");
        this.input.lastDevice = "touch";
      }
      this.input.bindTouch(document.getElementById("touch"));
      window.addEventListener("resize", () => this.renderer.resize());
      new ResizeObserver(() => this.renderer.resize()).observe(document.getElementById("stage"));
      document.addEventListener("visibilitychange", () => {
        if (document.hidden && this.state === "play") this.openOverlay("pause");
        if (document.hidden) this.audio.setPaused(true);
        else if (this.state === "play") this.audio.setPaused(false);
      });
      window.addEventListener("pointerdown", () => this.audio.init(), { once: true });
      window.addEventListener("keydown", () => this.audio.init(), { once: true });
    }
    resetSessionVars() {
      this.entities = [];
      this.airEntities = [];
      this.npcs = [];
      this.animals = [];
      this.updaters = [];
      this.interactables = [];
      this.triggers = [];
      this.lights = [];
      this.hazards = [];
      this.done = /* @__PURE__ */ new Set();
      this.flags = {};
      this.inv = new Inventory();
      this.res = { water: 0, food: 3, ammo: 5 };
      this.tracksKnown = /* @__PURE__ */ new Set();
      this.wind = { a: 0.5, base: 0.5, t: 0 };
      this.sun = { dx: -1.4, dy: 0.25, strength: 0 };
      this.darkness = 0.8;
      this.canopyDark = 0.3;
      this.tint = [70, 90, 170, 0.3];
      this.ambientColor = [10, 14, 36];
      this.letterbox = 0;
      this.fade = 0;
      this.flash = 0;
      this.vignette = 0.45;
      this.soundCues = [];
      this.focus = null;
      this.sleepers = [];
      this.tweens = [];
      this.movers = [];
      this.stats = { tracksWrong: 0, startedAt: 0 };
    }
    applySettings() {
      const s = this.settings;
      Object.assign(this.audio.vol, { master: s.master, music: s.music, sfx: s.sfx, amb: s.amb });
      this.audio.applyVolumes();
      Save.saveSettings(s);
    }
    hasSave() {
      return Save.has();
    }
    async boot() {
      this.renderer.resize();
      requestAnimationFrame((t) => this.frame(t));
      this.ui.loading(0.05, "Afiando o fac\xE3o\u2026");
      await nextFrame();
      await Sprites.loadManifest();
      let first = Save.progress().last || 1;
      if (!this.registry[first] || !Save.isUnlocked(first)) first = 1;
      await this.loadPhase(first, false);
      this.ui.loading(1, "Pronto.");
      await nextFrame();
      this.toMenu();
    }
    // ---------- fases ----------
    hasPhase(id) {
      return !!this.registry[id];
    }
    async loadPhase(id, showLoading = true) {
      if (this.phase && this.phase.id === id && this.world) return this.phase;
      if (!this.registry[id]) throw new Error("Fase n\xE3o implementada: " + id);
      const prevState = this.state;
      this.state = "loading";
      if (showLoading) {
        this.ui.showScreen("loading");
        this.ui.loading(0.02, "Seguindo o rastro\u2026");
        await nextFrame();
      }
      let ph = this.built[id];
      if (!ph) {
        ph = this.registry[id](this);
        await ph.buildStatic(async (p, m) => {
          this.ui.loading(p, m);
          await nextFrame();
        });
        this.built[id] = ph;
      }
      this.phase = ph;
      this.world = ph.world;
      this.player = null;
      this.lastCheckpoint = null;
      this.ui.setPhase(ph);
      if (showLoading) {
        this.ui.loading(1, "Pronto.");
        await nextFrame();
      }
      void prevState;
      return ph;
    }
    // ---------- sessões ----------
    startSession(data) {
      this.resetSessionVars();
      this.world.clearDynamic();
      this.ui.hideDialog();
      const ph = this.phase;
      this.timeLeft = ph.timeLimit;
      this.tod = ph.todStart;
      this.todTarget = ph.todStart;
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
      this.camera.follow = this.player;
      this.camera.pan = null;
      this.camera.x = this.player.x;
      this.camera.y = this.player.y;
      this.camera.zoom = this.camera.targetZoom = 1;
      this.computeLight(1);
      this.ui.renderMissions();
      this.ui.cache = {};
    }
    toMenu() {
      this.state = "menu";
      this.audio.setMood("calm");
      if (!this.player) this.startSession(null);
      this.tod = this.todTarget = 352;
      this.camera.follow = null;
      this.menuCam = { t: 0 };
      this.letterbox = 0;
      this.fade = 0;
      this.ui.showScreen("menu");
      this.ui.setDrawer(false);
    }
    async newGame(id = 1) {
      if (!this.registry[id]) return;
      await this.loadPhase(id);
      Save.clear(id);
      Save.setLast(id);
      this.startSession(id > 1 ? { carry: Save.progress().carry } : null);
      this.ui.showScreen(null);
      this.state = "intro";
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
        if (id === 1) {
          await this.loadPhase(1);
          this.startSession(null);
          this.ui.showScreen(null);
          this.state = "play";
          this.phase.onResume?.(false);
          return;
        }
        this.ui.renderPhases();
        this.ui.pushScreen("phases");
        return;
      }
      if (!d) return this.newGame(id);
      return this.resumePhase(id, d);
    }
    async resumePhase(id, d) {
      await this.loadPhase(id);
      this.startSession(d);
      this.ui.showScreen(null);
      this.state = "play";
      this.audio.setPaused(false);
      this.ui.titleCard(this.phase.code, this.phase.title, "Expedi\xE7\xE3o retomada");
      this.phase.onResume?.(true);
    }
    // menu de fases: continua a expedição salva da fase ou começa de novo
    async playPhase(id, fresh = false) {
      if (!this.registry[id] || !Save.isUnlocked(id)) return;
      const d = Save.load(id);
      if (!fresh && d && !d.completed) return this.resumePhase(id, d);
      return this.newGame(id);
    }
    checkpoint(label = "Progresso salvo") {
      const p = this.player;
      const data = {
        phase: this.phase.id,
        done: [...this.done],
        flags: this.flags,
        inv: this.inv.toJSON(),
        res: this.res,
        tracks: [...this.tracksKnown],
        tod: this.tod,
        cp: { x: p.x, y: p.y },
        timeLeft: this.timeLeft,
        player: { hp: p.hp, en: p.en, battery: p.battery }
      };
      this.lastCheckpoint = JSON.parse(JSON.stringify(data));
      Save.write(data);
      this.ui.toast(`<b>Checkpoint</b> \xB7 ${label}`, "tip", 2600);
    }
    restoreCheckpoint(resetTimer = true) {
      const src = this.lastCheckpoint || Save.load(this.phase.id);
      const d = src ? JSON.parse(JSON.stringify(src)) : null;
      if (d && resetTimer) d.timeLeft = this.phase.timeLimit;
      if (d && resetTimer) d.player = { hp: 100, en: 100, battery: Math.max(40, d.player?.battery ?? 100) };
      this.startSession(d);
      this.ui.showScreen(null);
      this.state = "play";
      this.audio.setPaused(false);
      this.audio.setDuck(1);
      this.ui.toast("Expedi\xE7\xE3o retomada do \xFAltimo checkpoint.", "tip");
      this.phase.onRestore?.();
    }
    fail(title, msg) {
      if (this.state === "fail") return;
      this.state = "fail";
      this.audio.setPaused(true);
      this.ui.fail(title, msg);
    }
    // ---------- sobreposições ----------
    openOverlay(name) {
      if (this.state !== "play") return;
      const map = { pause: "pause", inventory: "inventory", map: "map" };
      if (!map[name]) return;
      this.state = "overlay:" + name;
      if (name === "inventory") this.ui.renderInventory();
      if (name === "map") this.ui.drawBigMap();
      this.ui.showScreen(map[name]);
      this.audio.setPaused(true);
    }
    resume() {
      if (!this.state.startsWith("overlay")) return;
      this.ui.showScreen(null);
      this.state = "play";
      this.audio.setPaused(false);
    }
    toggleOverlay(name) {
      if (this.state === "play") this.openOverlay(name);
      else if (this.state === "overlay:" + name) this.resume();
      else if (this.state.startsWith("overlay")) {
        this.ui.showScreen(null);
        this.state = "play";
        this.openOverlay(name);
      }
    }
    uiAction(a) {
      if (a === "resume") {
        if (this.state === "menu") {
          this.ui.showScreen("menu");
          return;
        }
        if (this.state.startsWith("overlay")) this.resume();
      } else if (a === "checkpoint") this.restoreCheckpoint(this.state === "fail");
      else if (a === "menu") {
        this.player = null;
        this.toMenu();
      } else if (a === "replay") this.newGame(this.phase.id);
      else if (a === "next") this.newGame(this.phase.id + 1);
    }
    // ---------- laço ----------
    frame(ts) {
      const dt = clamp((ts - (this.last || ts)) / 1e3, 0, 0.05);
      this.last = ts;
      try {
        this.update(dt);
        this.renderer.render();
      } catch (e) {
        console.error(e);
      }
      this.input.endFrame();
      requestAnimationFrame((t) => this.frame(t));
    }
    update(dt) {
      const inp = this.input, st = this.state;
      if (!this.world || !this.player) return;
      if (this.ui.dlg) {
        if (this.ui.dlg.choice) {
          ["use1", "use2", "use3"].forEach((k, i) => {
            if (inp.pressed(k)) this.ui.pick(i);
          });
        } else if (inp.pressed("interact") || inp.pressed("dodge") || inp.pressed("confirm")) this.ui.advance();
      }
      if (st === "intro" && (inp.pressed("dodge") || inp.pressed("confirm") || inp.pressed("interact"))) this.ui.introNext?.();
      if (st === "play") {
        if (inp.pressed("pause")) {
          this.openOverlay("pause");
          return;
        }
        if (inp.pressed("inventory")) {
          this.openOverlay("inventory");
          return;
        }
        if (inp.pressed("map")) {
          this.openOverlay("map");
          return;
        }
        if (inp.pressed("drawer")) this.ui.setDrawer(!document.body.classList.contains("drawer-open"));
        if (inp.pressed("use1")) this.useItem("cantil");
        if (inp.pressed("use2")) this.useItem("marmita");
        if (inp.pressed("use3")) this.useItem("pilhas");
      } else if (st.startsWith("overlay")) {
        const name = st.split(":")[1];
        if (inp.pressed("pause")) {
          if (this.ui.screenStack.length > 1) this.ui.popScreen();
          else this.resume();
        } else if (inp.pressed(name)) this.resume();
        return;
      } else if (st === "fail" || st === "results" || st === "loading") {
        return;
      } else if ((st === "cutscene" || st === "menu") && inp.pressed("drawer")) this.ui.setDrawer(!document.body.classList.contains("drawer-open"));
      this.time += dt;
      if (st === "menu") {
        this.menuCam.t += dt;
        for (const a of ["up", "down", "confirm"]) if (inp.pressed(a)) this.ui.menuKey(a);
        const path = this.phase.menuPath;
        const k = (Math.sin(this.menuCam.t * 0.05) + 1) / 2;
        this.camera.x = lerp(path[0].x, path[1].x, k);
        this.camera.y = lerp(path[0].y, path[1].y, k) + Math.sin(this.menuCam.t * 0.11) * 20;
      }
      if (st === "play" && !document.hidden) {
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.fail("O tempo acabou", "O sol subiu, o rastro esfriou e Caetano perdeu a pista do veado. Volte ao \xFAltimo ponto seguro e tente de novo.");
          return;
        }
      }
      this.updateTimeOfDay(dt, st === "play");
      this.wind.t += dt;
      this.wind.a = this.wind.base + Math.sin(this.wind.t * 0.03) * 0.6 + Math.sin(this.wind.t * 0.011) * 0.4;
      if (st === "play" || st === "cutscene") this.player.update(dt);
      if (st === "cutscene" || st === "menu" || st === "intro") {
        this.player.vx *= 0.8;
        this.player.vy *= 0.8;
      }
      for (const m of this.movers.slice()) this.stepMover(m, dt);
      for (const e of this.updaters) e.update(dt);
      this.particles.update(dt);
      this.ambientParticles(dt);
      this.phase.update(dt);
      for (let i = this.tweens.length - 1; i >= 0; i--) {
        const tw = this.tweens[i];
        tw.t = Math.min(tw.dur, tw.t + dt);
        tw.o[tw.k] = lerp(tw.from, tw.to, tw.dur ? tw.t / tw.dur : 1);
        if (tw.t >= tw.dur) {
          this.tweens.splice(i, 1);
          tw.res();
        }
      }
      for (let i = this.sleepers.length - 1; i >= 0; i--) {
        const s = this.sleepers[i];
        s.t -= dt;
        if (s.t <= 0) {
          this.sleepers.splice(i, 1);
          s.res();
        }
      }
      for (let i = this.soundCues.length - 1; i >= 0; i--) {
        const c = this.soundCues[i];
        c.t += dt;
        if (c.t >= c.life) this.soundCues.splice(i, 1);
      }
      this.flash = Math.max(0, this.flash - dt * 2.5);
      if (st === "play") {
        this.focus = this.findFocus();
        if (inp.pressed("interact") && this.focus) {
          const f = this.focus;
          this.focus = null;
          f.action();
        }
        for (const t of this.triggers) {
          if (t.fired || t.cond && !t.cond()) continue;
          const inside = t.r ? dist(t.x, t.y, this.player.x, this.player.y) < t.r : this.player.x >= t.x && this.player.x <= t.x + t.w && this.player.y >= t.y && this.player.y <= t.y + t.h;
          if (inside) {
            if (t.once !== false) t.fired = true;
            t.fn();
            if (this.state !== "play") break;
          }
        }
        this.checkHazards();
        if (this.player.hp <= 0) this.fail("Caetano desmaiou", "Ferido e cansado, Caetano n\xE3o conseguiu seguir. Descanse e retome do \xFAltimo ponto seguro.");
      } else this.focus = null;
      this.world.explore(this.player.x, this.player.y, 150);
      this.camera.update(dt, this.world, this.settings.shake);
      this.audio.update(dt, this.phase.audioEnv ? this.phase.audioEnv() : {});
      if (st === "play" || st === "cutscene") this.ui.updateHUD(dt);
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
      for (let i = 0; i < LIGHT_KEYS.length - 1; i++) if (t >= LIGHT_KEYS[i][0] && t <= LIGHT_KEYS[i + 1][0]) {
        a = LIGHT_KEYS[i];
        b = LIGHT_KEYS[i + 1];
        break;
      }
      if (t < LIGHT_KEYS[0][0]) b = a;
      if (t > b[0]) a = b;
      const k = a === b ? 0 : (t - a[0]) / (b[0] - a[0]);
      this.darkness = lerp(a[1], b[1], k) + (this.phase.extraDark || 0);
      this.ambientColor = a[2].map((v, i) => Math.round(lerp(v, b[2][i], k)));
      this.tint = a[3].map((v, i) => lerp(v, b[3][i], k));
      this.sun.strength = lerp(a[4], b[4], k);
      this.sun.dx = -clamp(1.8 - (t - 360) / 90, 0.5, 1.8);
      this.canopyDark = 0.28 + 0.12 * this.sun.strength;
      this.waterGlint = this.sun.strength > 0.3 ? "#fff4d8" : this.darkness > 0.5 ? "#9ab0d8" : "#f0c8c0";
    }
    todName() {
      const t = this.tod;
      return t < 330 ? "Madrugada" : t < 375 ? "Amanhecer" : t < 420 ? "Manh\xE3 cedo" : t < 720 ? "Manh\xE3" : t < 1050 ? "Tarde" : t < 1110 ? "Entardecer" : "Noite";
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
          else if (this.input.lastDevice === "mouse" && m.inside && performance.now() - m.moved < 4e3) {
            const s = this.renderer.worldToScreen(p.x, p.y - 8);
            ang = Math.atan2(m.y - s.y, m.x - s.x);
          } else {
            const v = DIR_VEC[p.dir];
            ang = Math.atan2(v[1], v[0]);
          }
          p.lanternAngle = ang;
          L.push({ x: p.x, y: p.y - 8, r: 140, i: 1, cone: true, angle: ang, spread: 0.5, color: "255,236,180" });
          L.push({ x: p.x + Math.cos(ang) * 30, y: p.y - 8 + Math.sin(ang) * 30, r: 38, i: 0.55 });
        }
      }
      for (const l of this.lights) if (!l.off) L.push(l);
      for (const f of this.particles.list) if (f.type === "firefly") L.push({ x: f.x, y: f.y, r: 9, i: 0.5 * (0.5 + 0.5 * Math.sin(f.t * 4 + f.seed)), color: "200,255,120" });
      return L;
    }
    ambientParticles(dt) {
      const cam = this.camera, w = this.world;
      const x0 = cam.x - cam.viewW / 2, y0 = cam.y - cam.viewH / 2;
      if (Math.random() < dt * 3) {
        const x = x0 + Math.random() * cam.viewW, y = y0 + Math.random() * cam.viewH;
        if (w.densityAt(x, y) > 0.5) this.particles.add({ type: "leaf", x, y, z: 30 + Math.random() * 20, vx: 6 + Math.random() * 6, vy: 2, life: 6, seed: Math.random() * 9, color: ["#5a8a3a", "#8a6a34", "#a8823a", "#6a7a2a"][Math.random() * 4 | 0] });
      }
      if (this.darkness > 0.3) {
        let n = 0;
        for (const p of this.particles.list) if (p.type === "firefly") n++;
        if (n < 18 && Math.random() < dt * 4) {
          const x = x0 + Math.random() * cam.viewW, y = y0 + Math.random() * cam.viewH;
          if (!w.isWater(x, y)) this.particles.add({ type: "firefly", x, y, life: 6 + Math.random() * 6, seed: Math.random() * 9 });
        }
      }
    }
    // ---------- percepção e ambiente ----------
    isDownwind(p, a) {
      const dx = a.x - p.x, dy = a.y - p.y, d = Math.hypot(dx, dy) || 1;
      return dx / d * Math.cos(this.wind.a) + dy / d * Math.sin(this.wind.a) > 0.72;
    }
    isInCover(x, y) {
      return this.phase.isInCover ? this.phase.isInCover(x, y) : false;
    }
    panOf(x) {
      return clamp((x - (this.player?.x ?? x)) / 140, -1, 1);
    }
    caption(text, pan = 0) {
      this.ui.caption(text, pan);
      this.soundCues.push({ pan, t: 0, life: 1.6 });
    }
    checkHazards() {
      const p = this.player;
      for (const h of this.hazards) {
        if (dist(h.x, h.y, p.x, p.y) > h.r) continue;
        if (h.type === "tucum" && (p.moving || p.running) && p.dodgeT <= 0) p.hurt(6, "Espinhos de tucum! Cuidado onde pisa.");
        if (h.type === "ants") p.hurt(4, "Formigas tucandeiras! Saia da\xED depressa.");
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
        if (score < bd) {
          bd = score;
          best = it;
        }
      }
      if (!best && !p.locked && this.inv.has("cantil") && this.res.water < 4) {
        for (const [dx, dy] of [[fv[0] * 12, fv[1] * 12], [12, 0], [-12, 0], [0, 12], [0, -10]]) {
          if (this.world.isWater(p.x + dx, p.y + dy)) {
            return { x: p.x + dx, y: p.y + dy, py: 10, label: "Encher o cantil", action: () => {
              this.res.water = 4;
              this.audio.play("drink");
              this.audio.play("splash", { vol: 0.4 });
              this.ui.toast("Cantil cheio: <b>4 goles</b>.", "tip");
              this.phase.onEvent?.("fill");
            } };
          }
        }
      }
      return best;
    }
    useItem(id) {
      const p = this.player;
      if (id === "cantil") {
        if (!this.inv.has("cantil")) return;
        if (this.res.water <= 0) {
          this.ui.toast("Cantil vazio. Encha num rio ou igarap\xE9 (E perto da \xE1gua).", "tip");
          return;
        }
        if (p.en >= 99) {
          this.ui.toast("Caetano n\xE3o est\xE1 com sede agora.", "tip", 2e3);
          return;
        }
        this.res.water--;
        p.en = Math.min(100, p.en + 40);
        p.exhausted = false;
        this.audio.play("drink");
        this.ui.toast(`Um gole d'\xE1gua. Energia +40 (${this.res.water}/4).`, "tip", 2200);
      } else if (id === "marmita") {
        if (!this.inv.has("marmita")) return;
        if (this.res.food <= 0) {
          this.ui.toast("A marmita est\xE1 vazia.", "warn");
          return;
        }
        if (p.hp >= 100 && p.en >= 100) {
          this.ui.toast("Ainda n\xE3o \xE9 hora de comer.", "tip", 2e3);
          return;
        }
        this.res.food--;
        p.hp = Math.min(100, p.hp + 35);
        p.en = Math.min(100, p.en + 25);
        this.audio.play("eat");
        this.ui.toast(`Peixe assado com farinha. Vida +35, energia +25 (${this.res.food} restantes).`, "tip", 2600);
      } else if (id === "pilhas") {
        if (!this.inv.has("pilhas")) {
          this.ui.toast("Voc\xEA n\xE3o tem pilhas.", "tip", 2e3);
          return;
        }
        this.inv.remove("pilhas");
        p.battery = 100;
        this.audio.play("click");
        this.ui.toast("Pilhas novas na lanterna: 100%.", "tip");
      }
    }
    give(id, n = 1, quiet = false) {
      const ok = this.inv.add(id, n);
      if (!ok) {
        this.ui.toast("O paneiro est\xE1 cheio.", "warn");
        return false;
      }
      const it = ITEMS[id];
      if (!quiet) {
        if (it.type === "collectible") {
          this.audio.play("discover");
          this.ui.toast(`<b>Achado:</b> ${it.name} \xB7 ${this.inv.found.size}/5`, "discovery", 5e3);
        } else {
          this.audio.play("pickup");
          this.ui.toast(`<b>${it.name}</b>${n > 1 ? " \xD7" + n : ""} no paneiro.`, "tip", 2600);
        }
      }
      return true;
    }
    shoot(p) {
      if (this.res.ammo <= 0) {
        this.audio.play("click");
        this.ui.toast("Sem cartuchos.", "warn");
        return;
      }
      const ax = Math.cos(p.aimAngle), ay = Math.sin(p.aimAngle);
      for (const a of this.animals) {
        if (!a.visible) continue;
        const dx = a.x - p.x, dy = a.y - p.y, along = dx * ax + dy * ay;
        if (along < 0 || along > 110) continue;
        if (Math.abs(dx * ay - dy * ax) < 14) {
          this.ui.toast('Caetano baixa a espingarda: <i>"N\xE3o. Hoje eu vim pelo veado."</i>', "tip", 3200);
          p.aimToggle = false;
          return;
        }
      }
      this.res.ammo--;
      this.audio.play("shot");
      this.flash = 0.35;
      this.camera.shake(3, 0.35);
      p.makeNoise(1.6);
      const mx = p.x + ax * 14, my = p.y - 10 + ay * 14;
      for (let i = 0; i < 10; i++) this.particles.add({ type: "puff", x: mx, y: my, vx: ax * 40 + (Math.random() - 0.5) * 20, vy: ay * 40 + (Math.random() - 0.5) * 20, life: 0.9, drag: 3 });
      for (let i = 0; i < 6; i++) this.particles.add({ type: "spark", x: mx, y: my, vx: ax * 120 + (Math.random() - 0.5) * 60, vy: ay * 120 + (Math.random() - 0.5) * 60, life: 0.25 });
      for (const a of this.animals) if (dist(a.x, a.y, p.x, p.y) < 280) a.scare();
      this.caption("O tiro ecoa pela mata", 0);
      this.ui.toast(`Tiro de aviso. A mata inteira escutou. (${this.res.ammo} cartuchos)`, "warn", 3e3);
      this.phase.onEvent?.("shot");
    }
    complete(id) {
      if (this.done.has(id)) return false;
      this.done.add(id);
      const m = this.phase.missions.find((q) => q.id === id);
      const sm = !m && this.phase.secondary ? this.phase.secondary.find((q) => q.id === id) : null;
      this.audio.play("mission");
      this.ui.toast(sm ? `<b>Miss\xE3o secund\xE1ria</b> \xB7 ${sm.title}` : `<b>Miss\xE3o conclu\xEDda</b> \xB7 ${m ? m.title : id}`, "mission", 4200);
      this.ui.markDone(id);
      this.phase.onMissionDone?.(id);
      return true;
    }
    currentMission() {
      return this.phase.currentMission ? this.phase.currentMission() : this.phase.missions.find((m) => !this.done.has(m.id));
    }
    currentTarget() {
      const m = this.currentMission();
      return m && m.target ? m.target() : null;
    }
    // ---------- roteiro ----------
    wait(sec) {
      return new Promise((res) => this.sleepers.push({ t: sec, res }));
    }
    tween(o, k, to, dur) {
      return new Promise((res) => {
        this.tweens = this.tweens.filter((t) => !(t.o === o && t.k === k));
        this.tweens.push({ o, k, from: o[k], to, t: 0, dur, res });
      });
    }
    say(name, text, look) {
      return this.ui.say(name, text, look);
    }
    choice(name, text, opts, look) {
      return this.ui.choice(name, text, opts, look);
    }
    moveTo(e, x, y, speed = 40) {
      return new Promise((res) => this.movers.push({ e, x, y, speed, res }));
    }
    stepMover(m, dt) {
      const e = m.e, dx = m.x - e.x, dy = m.y - e.y, d = Math.hypot(dx, dy);
      if (d < 1.5) {
        this.movers.splice(this.movers.indexOf(m), 1);
        e.moving = false;
        e.frame = 0;
        m.res();
        return;
      }
      const s = Math.min(d, m.speed * dt);
      e.x += dx / d * s;
      e.y += dy / d * s;
      if (e === this.player) {
        e.moving = true;
        e.dir = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? "right" : "left" : dy > 0 ? "down" : "up";
        e.anim += dt * 7;
        e.frame = Math.floor(e.anim) % 4;
      }
    }
    async run(fn) {
      if (this.state === "cutscene") return;
      const prev = this.state;
      this.state = "cutscene";
      this.player.locked = true;
      this.player.lantern = this.player.lantern;
      try {
        await fn();
      } catch (e) {
        console.error(e);
      } finally {
        if (this.state === "cutscene") this.state = prev === "cutscene" ? "play" : prev === "intro" ? "play" : prev;
        if (this.state === "menu" || this.state === "results") {
        }
        this.player.locked = false;
        this.ui.hideDialog();
      }
    }
  };

  // js/engine/world.js
  var T = { FLOOR: 0, GRASS: 1, DIRT: 2, SAND: 3, MUD: 4, RIVER: 5, CREEK: 6, ROCA: 7, WOOD: 8, CLEAR: 9, ROCK: 10, GULLY: 11, STONE: 12, THICKET: 13, SHALLOW: 14 };
  var SURFACE = ["leaves", "grass", "dirt", "sand", "mud", "water", "water", "dirt", "wood", "leaves", "stone", "leaves", "stone", "leaves", "water"];
  var SOLID = (t) => t === T.ROCK || t === T.GULLY || t === T.THICKET;
  var PAL = {
    0: [[50, 46, 28], [62, 54, 32], [42, 52, 28]],
    1: [[82, 122, 46], [100, 140, 56], [70, 106, 40]],
    2: [[136, 104, 66], [120, 90, 56], [150, 118, 76]],
    3: [[214, 192, 140], [198, 174, 120], [228, 208, 158]],
    4: [[82, 66, 44], [68, 54, 36], [96, 78, 52]],
    7: [[118, 72, 44], [100, 60, 36], [132, 84, 52]],
    8: [[124, 86, 54], [104, 70, 42], [146, 104, 66]],
    9: [[70, 80, 40], [84, 94, 46], [60, 70, 36]],
    10: [[92, 88, 76], [74, 70, 60], [110, 104, 90]],
    11: [[30, 24, 16], [22, 18, 12], [40, 32, 20]],
    12: [[122, 116, 98], [104, 98, 84], [138, 130, 110]],
    13: [[34, 44, 22], [26, 36, 18], [42, 54, 26]],
    14: [[74, 70, 46], [62, 60, 40], [88, 84, 58]]
  };
  var World = class {
    constructor(tw, th) {
      this.tw = tw;
      this.th = th;
      this.W = tw * 16;
      this.H = th * 16;
      this.cw = this.W / 2;
      this.ch = this.H / 2;
      this.ter = new Uint8Array(this.cw * this.ch);
      this.dep = new Float32Array(this.cw * this.ch);
      this.margin = 24;
      this.colGrid = /* @__PURE__ */ new Map();
      this.colliders = [];
      this.drawGrid = /* @__PURE__ */ new Map();
      this.drawables = [];
      this.walkOverrides = [];
      this.blockers = [];
      this.density = new Float32Array(tw * th);
      this.fogCols = Math.ceil(this.W / 32);
      this.fogRows = Math.ceil(this.H / 32);
      this.explored = new Uint8Array(this.fogCols * this.fogRows);
      this.crowns = [];
    }
    generate(sampler) {
      let i = 0;
      for (let cy = 0; cy < this.ch; cy++) {
        const ty = (cy * 2 + 1) / 16;
        for (let cx = 0; cx < this.cw; cx++, i++) {
          const r = sampler((cx * 2 + 1) / 16, ty);
          this.ter[i] = r[0];
          this.dep[i] = r[1] || 0;
        }
      }
    }
    terrainAt(x, y) {
      const cx = x / 2 | 0, cy = y / 2 | 0;
      if (x < 0 || y < 0 || cx >= this.cw || cy >= this.ch) return 255;
      return this.ter[cy * this.cw + cx];
    }
    isWaterT(t) {
      return t === T.RIVER || t === T.CREEK;
    }
    isWater(x, y) {
      return this.isWaterT(this.terrainAt(x, y));
    }
    surfaceAt(x, y) {
      for (const o of this.walkOverrides) if (o.active() && x >= o.x && y >= o.y && x <= o.x + o.w && y <= o.y + o.h) return "wood";
      const t = this.terrainAt(x, y);
      return SURFACE[t] || "dirt";
    }
    blockedAt(x, y, canWater = false) {
      if (x < this.margin || y < this.margin || x > this.W - this.margin || y > this.H - this.margin) return true;
      for (const o of this.walkOverrides) if (o.active() && x >= o.x && y >= o.y && x <= o.x + o.w && y <= o.y + o.h) return false;
      for (const b of this.blockers) if (b.active() && x >= b.x && y >= b.y && x <= b.x + b.w && y <= b.y + b.h) return true;
      const t = this.terrainAt(x, y);
      if (t === 255) return true;
      if (SOLID(t)) return true;
      if (!canWater && this.isWaterT(t)) return true;
      return false;
    }
    // ---------- colisores ----------
    _key(x, y, s) {
      return (x / s | 0) + "," + (y / s | 0);
    }
    addCollider(c) {
      this.colliders.push(c);
      const x0 = c.r ? c.x - c.r : c.x, y0 = c.r ? c.y - c.r : c.y;
      const x1 = c.r ? c.x + c.r : c.x + c.w, y1 = c.r ? c.y + c.r : c.y + c.h;
      for (let gy = Math.floor(y0 / 64); gy <= Math.floor(y1 / 64); gy++)
        for (let gx = Math.floor(x0 / 64); gx <= Math.floor(x1 / 64); gx++) {
          const k = gx + "," + gy;
          if (!this.colGrid.has(k)) this.colGrid.set(k, []);
          this.colGrid.get(k).push(c);
        }
      return c;
    }
    clearDynamic() {
      const keep = this.colliders.filter((c) => !c.dyn);
      this.colliders = [];
      this.colGrid = /* @__PURE__ */ new Map();
      for (const c of keep) this.addCollider(c);
      this.walkOverrides = [];
      this.blockers = [];
    }
    near(x, y) {
      const out = [];
      const gx = Math.floor(x / 64), gy = Math.floor(y / 64);
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const a = this.colGrid.get(gx + i + "," + (gy + j));
        if (a) {
          for (const c of a) if (!out.includes(c)) out.push(c);
        }
      }
      return out;
    }
    hit(x, y, r, canWater = false) {
      const k = r * 0.7;
      const pts = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r * 0.6], [k, k], [-k, k], [k, -k * 0.6], [-k, -k * 0.6]];
      for (const [dx, dy] of pts) if (this.blockedAt(x + dx, y + dy, canWater)) return true;
      for (const c of this.near(x, y)) {
        if (c.off) continue;
        if (c.w !== void 0) {
          const nx = clamp(x, c.x, c.x + c.w), ny = clamp(y, c.y, c.y + c.h);
          if ((x - nx) ** 2 + (y - ny) ** 2 < r * r) return true;
        }
      }
      return false;
    }
    moveCircle(e, dx, dy, r, canWater = false) {
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3));
      const sx = dx / steps, sy = dy / steps;
      let bx = false, by = false;
      for (let s = 0; s < steps; s++) {
        if (sx && !this.hit(e.x + sx, e.y, r, canWater)) e.x += sx;
        else if (sx) bx = true;
        if (sy && !this.hit(e.x, e.y + sy, r, canWater)) e.y += sy;
        else if (sy) by = true;
      }
      for (const c of this.near(e.x, e.y)) {
        if (c.off || !c.r) continue;
        const ddx = e.x - c.x, ddy = (e.y - c.y) * 1.2, d = Math.hypot(ddx, ddy), m = r + c.r;
        if (d < m && d > 1e-3) {
          const px6 = e.x + ddx / d * (m - d), py = e.y + ddy / d * (m - d) / 1.2;
          if (!this.hit(px6, py, r * 0.6, canWater)) {
            e.x = px6;
            e.y = py;
          }
        }
      }
      return { bx, by };
    }
    // ---------- desenháveis estáticos ----------
    addDrawable(d) {
      this.drawables.push(d);
      const k = this._key(d.x, d.y, 128);
      if (!this.drawGrid.has(k)) this.drawGrid.set(k, []);
      this.drawGrid.get(k).push(d);
      if (d.crown) this.crowns.push(d);
      return d;
    }
    queryDrawables(x0, y0, x1, y1, out) {
      for (let gy = Math.floor((y0 - 96) / 128); gy <= Math.floor((y1 + 160) / 128); gy++)
        for (let gx = Math.floor((x0 - 96) / 128); gx <= Math.floor((x1 + 96) / 128); gx++) {
          const a = this.drawGrid.get(gx + "," + gy);
          if (a) {
            for (const d of a) if (!d.hidden) out.push(d);
          }
        }
      return out;
    }
    addDensity(x, y, r, v = 1) {
      const t0x = Math.floor((x - r) / 16), t1x = Math.floor((x + r) / 16);
      const t0y = Math.floor((y - r) / 16), t1y = Math.floor((y + r) / 16);
      for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) {
        if (tx < 0 || ty < 0 || tx >= this.tw || ty >= this.th) continue;
        const d = Math.hypot(tx * 16 + 8 - x, ty * 16 + 8 - y) / r;
        if (d < 1) this.density[ty * this.tw + tx] = Math.min(1, this.density[ty * this.tw + tx] + (1 - d) * v);
      }
    }
    densityAt(x, y) {
      const tx = x / 16 | 0, ty = y / 16 | 0;
      if (tx < 0 || ty < 0 || tx >= this.tw || ty >= this.th) return 1;
      return this.density[ty * this.tw + tx];
    }
    buildDensityCanvas() {
      const c = makeCanvas(this.tw, this.th), x = c.getContext("2d");
      const id = x.createImageData(this.tw, this.th);
      for (let i = 0; i < this.density.length; i++) {
        id.data[i * 4 + 3] = Math.round(this.density[i] * 255);
      }
      x.putImageData(id, 0, 0);
      this.densityCanvas = c;
    }
    // ---------- chão pré-renderizado ----------
    renderGround() {
      const W = this.W, H = this.H;
      const cv = makeCanvas(W, H);
      const ctx = cv.getContext("2d");
      const id = ctx.createImageData(W, H);
      const D = id.data;
      const cw = this.cw;
      const wet = new Uint8Array(this.cw * this.ch);
      for (let cy = 0; cy < this.ch; cy++) for (let cx = 0; cx < cw; cx++) {
        const i = cy * cw + cx;
        if (!this.isWaterT(this.ter[i])) continue;
        for (let j = -3; j <= 3; j++) for (let k = -3; k <= 3; k++) {
          const x = cx + k, y = cy + j;
          if (x < 0 || y < 0 || x >= cw || y >= this.ch) continue;
          const n = y * cw + x;
          if (!this.isWaterT(this.ter[n])) {
            const dd = 4 - Math.max(Math.abs(j), Math.abs(k));
            if (dd > wet[n]) wet[n] = dd;
          }
        }
      }
      for (let y = 0; y < H; y++) {
        const cy = y >> 1;
        for (let x = 0; x < W; x++) {
          const cx = x >> 1, ci = cy * cw + cx;
          const t = this.ter[ci];
          let r, g, b;
          const h = hash2(x, y, 7);
          if (t === T.RIVER || t === T.CREEK) {
            const d = clamp(this.dep[ci], 0, 1);
            const sh = t === T.RIVER ? [156, 136, 94] : [74, 54, 34];
            const dp = t === T.RIVER ? [96, 82, 56] : [24, 18, 14];
            const n = fbm(x * 0.02, y * 0.05, 31, 2) * 0.25;
            const k = clamp(d + n - 0.12, 0, 1);
            r = sh[0] + (dp[0] - sh[0]) * k;
            g = sh[1] + (dp[1] - sh[1]) * k;
            b = sh[2] + (dp[2] - sh[2]) * k;
            if (h < 4e-3) {
              r += 30;
              g += 30;
              b += 26;
            }
          } else {
            const P3 = PAL[t] || PAL[0];
            const n = fbm(cx * 0.045, cy * 0.045, 5 + t, 3);
            const a = P3[0], c2 = P3[1];
            r = a[0] + (c2[0] - a[0]) * n;
            g = a[1] + (c2[1] - a[1]) * n;
            b = a[2] + (c2[2] - a[2]) * n;
            if (hash2(cx >> 1, cy >> 1, 9 + t) < 0.18) {
              r = (r + P3[2][0]) / 2;
              g = (g + P3[2][1]) / 2;
              b = (b + P3[2][2]) / 2;
            }
            const f = 0.92 + h * 0.14;
            r *= f;
            g *= f;
            b *= f;
            if (t === T.FLOOR || t === T.CLEAR) {
              const lh = hash2(x >> 1, y, 13);
              if (lh < 0.05) {
                const c = LEAF[(lh * 1e3 | 0) % LEAF.length];
                r = c[0];
                g = c[1];
                b = c[2];
              }
            } else if (t === T.GRASS) {
              if (h > 0.9) {
                r *= 0.8;
                g *= 0.85;
              } else if (h < 0.04) {
                r += 24;
                g += 30;
                b += 10;
              }
            } else if (t === T.DIRT) {
              if (h < 0.015) {
                r = 170;
                g = 150;
                b = 120;
              }
            } else if (t === T.ROCA) {
              if ((y >> 3) % 3 === 0) {
                r *= 0.82;
                g *= 0.8;
                b *= 0.8;
              }
            } else if (t === T.WOOD) {
              if (x % 6 === 0) {
                r *= 0.7;
                g *= 0.7;
                b *= 0.7;
              } else if (y % 18 === 0 && x % 12 < 2) {
                r *= 0.6;
                g *= 0.6;
                b *= 0.6;
              }
            } else if (t === T.SAND) {
              if (h < 0.03) {
                r -= 30;
                g -= 30;
                b -= 30;
              }
            } else if (t === T.ROCK || t === T.STONE) {
              const bn = fbm(x * 0.07, y * 0.09, 41, 3), bk = 0.72 + bn * 0.55;
              r *= bk;
              g *= bk;
              b *= bk;
              const cr = hash2(x >> 2, y >> 2, 23);
              if (cr < 0.08 || Math.abs(fbm(x * 0.05, y * 0.05, 43, 2) - 0.5) < 0.012) {
                r *= 0.6;
                g *= 0.6;
                b *= 0.58;
              } else if (h > 0.97) {
                r += 18;
                g += 18;
                b += 14;
              }
              if (t === T.ROCK && fbm(x * 0.04, y * 0.04, 47, 2) > 0.62) {
                r = r * 0.6 + 14;
                g = g * 0.7 + 34;
                b *= 0.55;
              }
              if (t === T.STONE && hash2(x >> 3, y >> 3, 29) < 0.12) {
                r = r * 0.7 + 20;
                g = g * 0.8 + 30;
                b *= 0.6;
              }
            } else if (t === T.SHALLOW) {
              const wn = fbm(x * 0.03, y * 0.08, 53, 2);
              r = r * 0.8 + 18 * wn;
              g = g * 0.85 + 30 * wn;
              b = b * 0.9 + 34 * wn;
              if (h < 0.02) {
                r += 40;
                g += 40;
                b += 34;
              } else if (h > 0.985) {
                r = 120;
                g = 108;
                b = 84;
              }
            } else if (t === T.GULLY) {
              const d2 = clamp(this.dep[ci], 0, 1);
              r *= 1 - d2 * 0.5;
              g *= 1 - d2 * 0.5;
              b *= 1 - d2 * 0.45;
              if (h < 0.05) {
                r += 20;
                g += 14;
                b += 6;
              }
            }
            const w = wet[ci];
            if (w) {
              const k = 1 - w * 0.07;
              r *= k;
              g *= k;
              b *= k * 0.98;
            }
          }
          const p = (y * W + x) * 4;
          D[p] = r;
          D[p + 1] = g;
          D[p + 2] = b;
          D[p + 3] = 255;
        }
      }
      ctx.putImageData(id, 0, 0);
      this.ground = cv;
      this.groundCtx = ctx;
      return ctx;
    }
    buildMiniMap() {
      const s = 8;
      const c = makeCanvas(Math.ceil(this.W / s), Math.ceil(this.H / s));
      const x = c.getContext("2d");
      x.imageSmoothingEnabled = true;
      x.drawImage(this.ground, 0, 0, c.width, c.height);
      x.globalAlpha = 0.55;
      x.imageSmoothingEnabled = true;
      const dc = this.densityCanvas;
      if (dc) {
        const tmp = makeCanvas(dc.width, dc.height), tx = tmp.getContext("2d");
        tx.drawImage(dc, 0, 0);
        tx.globalCompositeOperation = "source-in";
        tx.fillStyle = "#16301a";
        tx.fillRect(0, 0, dc.width, dc.height);
        x.drawImage(tmp, 0, 0, c.width, c.height);
      }
      x.globalAlpha = 1;
      this.mini = c;
      this.miniScale = s;
    }
    explore(x, y, r = 150) {
      const c0 = Math.floor((x - r) / 32), c1 = Math.floor((x + r) / 32);
      const r0 = Math.floor((y - r) / 32), r1 = Math.floor((y + r) / 32);
      for (let j = r0; j <= r1; j++) for (let i = c0; i <= c1; i++) {
        if (i < 0 || j < 0 || i >= this.fogCols || j >= this.fogRows) continue;
        if (Math.hypot(i * 32 + 16 - x, j * 32 + 16 - y) < r) this.explored[j * this.fogCols + i] = 1;
      }
    }
  };
  var LEAF = [[110, 70, 30], [140, 90, 36], [96, 60, 30], [150, 116, 50], [80, 70, 34], [120, 50, 30], [70, 80, 36]];

  // js/gfx/art-nature.js
  var GREENS = {
    deep: ["#11240f", "#1a3317", "#24451d", "#2f5823", "#3d6e2b", "#4e8634"],
    mid: ["#152a12", "#20401a", "#2d5622", "#3b6c2b", "#4f8536", "#669d42"],
    light: ["#1d3a16", "#2b5220", "#3a6a2a", "#4f8536", "#6aa044", "#86b852"],
    olive: ["#1e2a12", "#2e3e1a", "#3f5424", "#52692e", "#6a823a", "#86994a"]
  };
  function crownSprite(seed, r, pal = GREENS.mid) {
    const S8 = Math.ceil(r * 2 + 8);
    const b = new PixBuf(S8, S8);
    const rng = mulberry32(seed);
    const c = S8 / 2;
    const clusters = [];
    const n = Math.round(10 + r * 0.9);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * r * 0.72;
      const cr = r * (0.26 + rng() * 0.2);
      clusters.push({ x: c + Math.cos(a) * d, y: c + Math.sin(a) * d * 0.88, r: cr });
    }
    clusters.push({ x: c, y: c - r * 0.1, r: r * 0.55 });
    clusters.sort((a, b2) => a.y - b2.y);
    for (const k of clusters) b.shaded(k.x, k.y, k.r, k.r * 0.9, pal, seed + (k.x | 0) * 7, -0.5, -0.8, 0.35);
    for (let i = 0; i < r * 3; i++) {
      const a = rng() * Math.PI * 2, d = r * (0.85 + rng() * 0.2);
      const x = c + Math.cos(a) * d, y = c + Math.sin(a) * d * 0.88;
      if (b.alpha(x | 0, y | 0) === 0 && (b.alpha(x + 1 | 0, y | 0) || b.alpha(x - 1 | 0, y | 0) || b.alpha(x | 0, y + 1 | 0))) b.px(x, y, pal[2]);
    }
    b.outline("#0b1a0a");
    return b.toCanvas();
  }
  function trunkSprite(seed, h, w, buttress = 0, bark = ["#3a2a1c", "#4e3a26", "#634a32", "#7a5e40"]) {
    const W = Math.ceil(w + buttress * 2 + 6), H = Math.ceil(h + 3);
    const b = new PixBuf(W, H);
    const cx = W / 2;
    const rng = mulberry32(seed);
    for (let y = 0; y < h; y++) {
      const fromBottom = h - y;
      let hw = w / 2;
      if (buttress) hw += buttress * Math.exp(-fromBottom / (h * 0.16));
      for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) {
        const t = (x - (cx - hw)) / (2 * hw);
        let idx = t < 0.22 ? 3 : t < 0.55 ? 2 : t < 0.82 ? 1 : 0;
        if (hash2(x, y >> 1, seed) < 0.18) idx = Math.max(0, idx - 1);
        if (hash2(x >> 1, y, seed + 5) < 0.06) idx = Math.min(3, idx + 1);
        b.px(x, y, bark[idx]);
      }
    }
    if (buttress) {
      for (let k = -1; k <= 1; k += 2) {
        const bx = cx + k * (w / 2 + buttress * 0.45);
        for (let y = h - Math.floor(h * 0.28); y < h; y++) b.mpx(bx + k * (y - h * 0.7) * 0.15, y, bark[0]);
      }
    }
    for (let i = 0; i < h / 3; i++) {
      const y = rng() * h | 0, x = cx - w / 2 + rng() * w;
      b.mpx(x, y, rng() < 0.5 ? "#5a7a3a" : "#8a9a7a");
    }
    b.outline("#140d07");
    return b.toCanvas();
  }
  function acaiSprite(seed) {
    const W = 46, H = 64;
    const b = new PixBuf(W, H);
    const rng = mulberry32(seed);
    const n = 2 + (rng() * 3 | 0);
    const tops = [];
    for (let i = 0; i < n; i++) {
      const bx = W / 2 + (i - (n - 1) / 2) * 3;
      const tx = W / 2 + (i - (n - 1) / 2) * 9 + (rng() - 0.5) * 6;
      const ty = 10 + rng() * 12;
      for (let y = H - 2; y > ty; y--) {
        const t = (H - 2 - y) / (H - 2 - ty);
        const x = bx + (tx - bx) * t * t;
        b.px(x, y, y % 5 === 0 ? "#5a5040" : "#7a6e58");
        b.px(x + 1, y, "#4a4234");
      }
      tops.push([tx, ty]);
    }
    for (const [tx, ty] of tops) {
      b.blob(tx + 2, ty + 4, 2, 2, "#3a1a3a");
      b.px(tx + 2, ty + 3, "#6a3a6a");
      const fr = 7 + (rng() * 3 | 0);
      for (let f = 0; f < fr; f++) {
        const a = -Math.PI / 2 + (f / (fr - 1) - 0.5) * Math.PI * 1.7 + (rng() - 0.5) * 0.2;
        const len = 12 + rng() * 6;
        for (let s = 0; s < len; s++) {
          const droop = s / len * (s / len) * 7;
          const x = tx + Math.cos(a) * s, y = ty + Math.sin(a) * s * 0.75 + droop;
          b.px(x, y, "#3d5a26");
          if (s > 2 && s % 2 === 0) {
            const la = a + Math.PI / 2;
            for (let k = 1; k < 4; k++) {
              b.px(x + Math.cos(la) * k * 0.6, y + Math.sin(la) * k * 0.6 + k * 0.5, k === 1 ? "#5a8a3a" : "#4a7430");
              b.px(x - Math.cos(la) * k * 0.6, y - Math.sin(la) * k * 0.6 + k * 0.5, k === 1 ? "#6a9a44" : "#4a7430");
            }
          }
        }
      }
    }
    b.outline("#0e1a0a");
    return b.toCanvas();
  }
  function buritiSprite(seed) {
    const W = 56, H = 80;
    const b = new PixBuf(W, H);
    const rng = mulberry32(seed);
    const tx = W / 2, ty = 20;
    for (let y = H - 2; y > ty; y--) {
      b.rect(tx - 2, y, 4, 1, y % 4 === 0 ? "#5a5248" : "#6e665a");
      b.px(tx + 1, y, "#4a443a");
    }
    for (let f = 0; f < 14; f++) {
      const a = f / 14 * Math.PI * 2 + rng() * 0.2;
      const len = 14 + rng() * 6;
      for (let s = 2; s < len; s++) {
        const x = tx + Math.cos(a) * s, y = ty + Math.sin(a) * s * 0.7 + s / len * 4;
        const spread = s / len * 3;
        for (let k = -spread; k <= spread; k++) b.px(x + Math.sin(a) * k, y - Math.cos(a) * k * 0.7, (k | 0) % 2 ? "#4a7a2e" : "#5e9038");
      }
    }
    b.blob(tx, ty + 3, 3, 2, "#6a3a1a");
    b.outline("#0e1a0a");
    return b.toCanvas();
  }
  function embaubaSprite(seed) {
    const W = 48, H = 70;
    const b = new PixBuf(W, H);
    const rng = mulberry32(seed);
    const tx = W / 2;
    for (let y = H - 2; y > 18; y--) {
      b.rect(tx - 1, y, 3, 1, y % 6 === 0 ? "#9a9688" : "#c8c4b4");
      b.px(tx + 1, y, "#a8a494");
    }
    b.line(tx, 30, tx - 10, 20, "#b8b4a4");
    b.line(tx, 26, tx + 11, 18, "#b8b4a4");
    const leaves = [[tx, 14], [tx - 11, 18], [tx + 12, 16], [tx - 5, 8], [tx + 6, 7]];
    for (const [lx, ly] of leaves) {
      const lobes = 7;
      for (let k = 0; k < lobes; k++) {
        const a = k / lobes * Math.PI * 2 + rng();
        for (let s = 0; s < 7; s++) {
          const x = lx + Math.cos(a) * s, y = ly + Math.sin(a) * s * 0.6;
          b.px(x, y, s < 2 ? "#a8bca0" : s % 2 ? "#7f9a72" : "#93ac86");
          b.px(x + Math.sin(a), y, "#6a8660");
        }
      }
    }
    b.outline("#1a2216");
    return b.toCanvas();
  }
  function bushSprite(seed, r = 8, pal = GREENS.mid) {
    const S8 = Math.ceil(r * 2.6 + 6);
    const b = new PixBuf(S8, Math.ceil(r * 2 + 6));
    const rng = mulberry32(seed);
    const cx = S8 / 2, cy = b.h - r - 2;
    const parts = [];
    for (let i = 0; i < 6; i++) parts.push({ x: cx + (rng() - 0.5) * r * 1.6, y: cy + (rng() - 0.3) * r * 0.7, r: r * (0.45 + rng() * 0.3) });
    parts.sort((a, c) => a.y - c.y);
    for (const p of parts) b.shaded(p.x, p.y, p.r, p.r * 0.85, pal, seed + (p.x | 0));
    b.outline("#0b1a0a");
    return b.toCanvas();
  }
  function fernSprite(seed) {
    const b = new PixBuf(26, 16);
    const rng = mulberry32(seed);
    for (let f = 0; f < 7; f++) {
      const a = Math.PI + f / 6 * Math.PI + (rng() - 0.5) * 0.2;
      for (let s = 0; s < 11; s++) {
        const x = 13 + Math.cos(a) * s, y = 14 + Math.sin(a) * s * 0.8 + s * s / 30;
        b.px(x, y, "#3f6e2a");
        if (s % 2 === 0 && s > 1) {
          b.px(x, y - 1, "#5a8e3a");
          b.px(x, y + 1, "#2e5420");
        }
      }
    }
    b.outline("#0b1a0a");
    return b.toCanvas();
  }
  function heliconiaSprite(seed) {
    const b = new PixBuf(24, 28);
    const rng = mulberry32(seed);
    for (let i = 0; i < 4; i++) {
      const x0 = 6 + i * 4, top = 4 + rng() * 6;
      for (let y = 26; y > top + 6; y--) b.px(x0, y, "#3a5a2a");
      b.shaded(x0 + (i % 2 ? 3 : -3), top + 6, 3, 6, ["#244a1c", "#2f6024", "#3f7a2e", "#55943a"], seed + i);
    }
    const bx = 12, by = 6;
    for (let k = 0; k < 5; k++) {
      const x = bx + (k % 2 ? 2 : -2), y = by + k * 3;
      b.rect(x, y, 3, 2, "#d23a22");
      b.px(x + (k % 2 ? 2 : 0), y, "#f0c030");
    }
    b.outline("#120c08");
    return b.toCanvas();
  }
  function tucumSprite(seed) {
    const b = new PixBuf(30, 24);
    const rng = mulberry32(seed);
    for (let f = 0; f < 9; f++) {
      const a = Math.PI + f / 8 * Math.PI + (rng() - 0.5) * 0.3;
      for (let s = 0; s < 13; s++) {
        const x = 15 + Math.cos(a) * s, y = 22 + Math.sin(a) * s * 0.9 + s * s / 28;
        b.px(x, y, "#2a3a1e");
        if (s % 2) {
          b.px(x + 1, y - 1, "#4a5e30");
          b.px(x - 1, y + 1, "#1e2a14");
        }
        if (s % 3 === 0) b.px(x, y - 1, "#d8d0b0");
      }
    }
    b.outline("#0b100a");
    return b.toCanvas();
  }
  function manivaSprite(seed) {
    const b = new PixBuf(16, 20);
    const rng = mulberry32(seed);
    b.line(8, 19, 8, 7, "#9a3a2a");
    b.line(8, 12, 4, 8, "#9a3a2a");
    b.line(8, 10, 12, 6, "#9a3a2a");
    for (const [lx, ly] of [[8, 6], [4, 8], [12, 6]]) {
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k - 2) * 0.6 + (rng() - 0.5) * 0.2;
        for (let s = 1; s < 5; s++) b.px(lx + Math.cos(a) * s, ly + Math.sin(a) * s, s < 3 ? "#5a9a3a" : "#3f7a2a");
      }
    }
    b.outline("#101a0a");
    return b.toCanvas();
  }
  function bananaSprite(seed) {
    const b = new PixBuf(40, 48);
    const rng = mulberry32(seed);
    b.rect(19, 24, 3, 23, "#6a7a3a");
    b.rect(21, 24, 1, 23, "#4e5a2a");
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.55 + (rng() - 0.5) * 0.2;
      for (let s = 2; s < 18; s++) {
        const x = 20 + Math.cos(a) * s, y = 24 + Math.sin(a) * s + s * s / 40;
        const wdt = Math.sin(s / 18 * Math.PI) * 3;
        for (let k = -wdt; k <= wdt; k++) b.px(x - Math.sin(a) * k, y + Math.cos(a) * k, k < 0 ? "#6aa63e" : "#4e8a2e");
        b.px(x, y, "#9ac060");
      }
    }
    b.outline("#101a0a");
    return b.toCanvas();
  }
  function rockSprite(seed, r = 6) {
    const b = new PixBuf(Math.ceil(r * 2.4 + 4), Math.ceil(r * 1.6 + 4));
    b.shaded(b.w / 2, b.h / 2 + 1, r * 1.1, r * 0.7, ["#3a3a36", "#55554e", "#6e6e64", "#8a8a7e"], seed);
    b.mpx(b.w / 2 - 2, b.h / 2 - 1, "#5a7a3a");
    b.outline("#141412");
    return b.toCanvas();
  }
  function fallenTreeSprite(seed) {
    const W = 104, H = 34;
    const b = new PixBuf(W, H);
    const rng = mulberry32(seed);
    b.shaded(12, 15, 11, 13, ["#2e2216", "#3e2e1e", "#4e3a26", "#5e4a32"], seed);
    for (let i = 0; i < 14; i++) {
      const a = rng() * Math.PI * 2;
      b.line(12, 15, 12 + Math.cos(a) * 13, 15 + Math.sin(a) * 14, "#3a2a1a");
    }
    b.blob(12, 15, 5, 6, "#5a4630");
    for (let x = 18; x < W - 4; x++) {
      const r = 7 - (x - 18) * 0.03;
      for (let y = -r; y <= r; y++) {
        const t = (y + r) / (2 * r);
        const col = t < 0.25 ? "#8a6e4e" : t < 0.6 ? "#6a523a" : t < 0.85 ? "#4e3a28" : "#36281a";
        b.px(x, 16 + y, hash2(x >> 1, y | 0, seed) < 0.12 ? "#4e3a28" : col);
      }
    }
    for (let i = 0; i < 26; i++) b.mpx(20 + rng() * (W - 28), 10 + rng() * 5, rng() < 0.6 ? "#4f7a32" : "#6a9a42");
    b.line(60, 10, 66, 2, "#5a4430");
    b.line(82, 20, 90, 30, "#5a4430");
    b.line(40, 21, 36, 31, "#4e3a28");
    b.rect(50, 22, 3, 1, "#d8b070");
    b.rect(52, 23, 3, 1, "#c89a5a");
    b.rect(72, 9, 3, 1, "#d8b070");
    b.outline("#120c07");
    return b.toCanvas();
  }
  function twigSprite(seed) {
    const b = new PixBuf(10, 6);
    b.line(1, 4, 8, 2, "#8a7050");
    b.line(4, 3, 6, 1, "#8a7050");
    b.px(2, 4, "#c8b088");
    b.px(7, 2, "#c8b088");
    return b.toCanvas();
  }

  // js/entities/npc.js
  var NPC = class {
    constructor(g, id, name, look, x, y, dir = "down") {
      this.g = g;
      this.id = id;
      this.name = name;
      this.look = look;
      this.x = x;
      this.y = y;
      this.dir = dir;
      this.baseDir = dir;
      this.frame = 0;
      this.r = 4;
      this.talked = false;
      this.bob = Math.random() * 10;
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
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + 1, 6, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.drawImage(s, Math.round(this.x - 9), Math.round(this.y - 25));
    }
  };

  // js/gfx/art-animals.js
  var DARK3 = "#1a120c";
  function finish(b) {
    b.outline(DARK3);
    return b.toCanvas();
  }
  function pacaSprite(frame) {
    const b = new PixBuf(22, 14);
    const pal = ["#4a2c16", "#6b4022", "#875432", "#a06a40"];
    const l = frame % 2;
    b.rect(6 + l, 10, 2, 2, "#3a2214");
    b.rect(14 - l, 10, 2, 2, "#3a2214");
    b.shaded(10, 7, 7, 4, pal, 11);
    b.shaded(16.5, 6.5, 3.5, 3, pal, 12);
    b.blob(10, 9.6, 5.5, 1.3, "#c9a87e", true);
    b.rect(15, 3, 2, 2, "#5a3420");
    b.px(18, 5, "#120a06");
    b.px(20, 7, "#d08a80");
    for (let i = 0; i < 5; i++) b.mpx(4 + i * 2, 6, "#efe3c8");
    for (let i = 0; i < 5; i++) b.mpx(5 + i * 2, 8, "#efe3c8");
    for (let i = 0; i < 3; i++) b.mpx(6 + i * 3, 4, "#d9c9a8");
    return finish(b);
  }
  function cotiaSprite(frame) {
    const b = new PixBuf(20, 14);
    const pal = ["#5e3412", "#82481a", "#a8642a", "#c48038"];
    const l = frame % 2;
    b.rect(5 + l, 9, 1, 3, "#3a2010");
    b.rect(7 - l, 9, 1, 3, "#3a2010");
    b.rect(12 + l, 9, 1, 3, "#3a2010");
    b.rect(14 - l, 9, 1, 3, "#3a2010");
    b.shaded(9, 7, 6, 3.2, pal, 21);
    b.blob(5, 7, 2.5, 2.6, "#4a2a10", true);
    b.shaded(15, 6, 3, 2.4, pal, 22);
    b.rect(14, 3, 1, 2, "#6a3a16");
    b.px(16, 5, "#120a06");
    b.px(18, 6, "#2a1608");
    return finish(b);
  }
  function capivaraSprite(frame, swim = false) {
    const b = new PixBuf(28, 17);
    const pal = ["#4e3620", "#6e4e30", "#8a6440", "#a27a52"];
    const l = frame % 2;
    if (!swim) {
      b.rect(7 + l, 12, 3, 3, "#3a2818");
      b.rect(17 - l, 12, 3, 3, "#3a2818");
    }
    b.shaded(12, 9, 9, 5, pal, 31);
    b.shaded(21, 7.5, 4.5, 3.6, pal, 32);
    b.rect(23, 6, 3, 4, pal[2]);
    b.rect(23, 9, 3, 1, pal[1]);
    b.rect(19, 3, 2, 2, "#4a3220");
    b.px(22, 6, "#120a06");
    b.px(25, 7, "#2a1a10");
    if (swim) {
      for (let y = 10; y < 17; y++) for (let x = 0; x < 28; x++) {
        const i = (y * 28 + x) * 4;
        b.d[i + 3] = 0;
      }
    }
    return finish(b);
  }
  function jacuSprite(frame) {
    const b = new PixBuf(19, 15);
    const pal = ["#1f1a14", "#2f281e", "#3f3628", "#524634"];
    const peck = frame === 1;
    b.rect(8, 11, 1, 3, "#b05a5a");
    b.rect(10, 11, 1, 3, "#b05a5a");
    b.shaded(4, 8, 4.5, 2, pal, 41);
    b.shaded(9, 8, 5, 3.6, pal, 42);
    const hx = 14, hy = peck ? 8 : 4;
    b.rect(12, hy + 1, 2, 8 - hy, pal[1]);
    b.shaded(hx, hy, 2.4, 2.2, pal, 43);
    b.px(hx + 1, hy - 1, "#e8e4dc");
    b.px(hx + 3, hy, "#9a8a7a");
    b.px(hx + 3, hy + 1, "#9a8a7a");
    b.px(hx, hy + 2, "#c0302a");
    b.px(hx, hy + 3, "#c0302a");
    for (let i = 0; i < 4; i++) b.mpx(7 + i * 2, 7, "#6a5e4a");
    return finish(b);
  }
  function birdFlySprite(frame, pal = ["#1f1a14", "#2f281e", "#433a2c", "#5a4e3a"], accent = "#c0302a") {
    const b = new PixBuf(22, 14);
    const up = frame % 2 === 0;
    b.shaded(11, 7, 2.2, 4.5, pal, 51);
    if (up) {
      b.shaded(5, 4, 5, 2, pal, 52);
      b.shaded(17, 4, 5, 2, pal, 53);
    } else {
      b.shaded(5, 9, 5, 1.8, pal, 54);
      b.shaded(17, 9, 5, 1.8, pal, 55);
    }
    b.rect(10, 11, 3, 2, pal[1]);
    b.px(11, 2, accent);
    return finish(b);
  }
  function araraSprite(frame) {
    const b = new PixBuf(28, 20);
    const up = frame % 2 === 0;
    const red = ["#7a1010", "#a81818", "#cc2a22", "#e2483a"];
    const wy = up ? 5 : 12;
    for (const s of [-1, 1]) {
      for (let i = 0; i < 10; i++) {
        const x = 14 + s * (3 + i), y = wy + (up ? i * 0.15 : -i * 0.15);
        const col = i < 4 ? "#cc2a22" : i < 6 ? "#e8c22a" : i < 8 ? "#2a8a3a" : "#2a5ac8";
        b.rect(x, y, 1, 3, col);
      }
    }
    b.shaded(14, 8, 2.6, 5, red, 61);
    for (let y = 13; y < 20; y++) b.rect(13 + (y - 13) % 2, y, 2, 1, y > 16 ? "#2a5ac8" : "#cc2a22");
    b.rect(13, 2, 3, 2, "#e8e0d0");
    b.px(14, 1, "#2a2a2a");
    return finish(b);
  }
  function macacoSprite(frame) {
    const b = new PixBuf(16, 17);
    const pal = ["#3a2614", "#5a3c20", "#7a5430", "#94683e"];
    const leap = frame === 2;
    for (let i = 0; i < 7; i++) b.px(2 + (i > 4 ? 1 : 0), 6 + i, pal[1]);
    b.px(3, 5, pal[1]);
    b.px(4, 4, pal[1]);
    if (leap) {
      b.shaded(8, 9, 5, 3, pal, 71);
      b.rect(12, 8, 3, 1, pal[1]);
      b.rect(1, 10, 3, 1, pal[1]);
    } else {
      b.shaded(8, 10, 4, 4.2, pal, 72);
      b.rect(5, 13, 2, 2, pal[0]);
      b.rect(9, 13, 2, 2, pal[0]);
      b.rect(4 + frame % 2, 9, 1, 3, pal[1]);
      b.rect(11 - frame % 2, 9, 1, 3, pal[1]);
    }
    b.shaded(8, 5, 3.2, 3, pal, 73);
    b.rect(6, 5, 4, 3, "#d9b88a");
    b.rect(6, 2, 4, 2, "#1e140a");
    b.px(7, 5, "#120a06");
    b.px(9, 5, "#120a06");
    b.px(8, 7, "#8a6040");
    return finish(b);
  }
  function galinhaSprite(frame) {
    const b = new PixBuf(12, 12);
    const pal = ["#a88a6a", "#c8b090", "#e8dcc8", "#f8f2e6"];
    const peck = frame === 1;
    b.rect(5, 9, 1, 2, "#d0902a");
    b.rect(7, 9, 1, 2, "#d0902a");
    b.shaded(5.5, 7, 4, 2.8, pal, 81);
    b.rect(1, 4, 2, 3, pal[2]);
    const hy = peck ? 6 : 3;
    b.shaded(9, hy, 1.8, 1.8, pal, 82);
    b.px(9, hy - 2, "#c82020");
    b.px(10, hy - 2, "#c82020");
    b.px(11, hy, "#d0902a");
    b.px(9, hy, "#120a06");
    b.px(10, hy + 2, "#c82020");
    return finish(b);
  }
  function butterflySprite(frame) {
    const b = new PixBuf(7, 6);
    const open = frame % 2 === 0;
    if (open) {
      b.rect(0, 1, 3, 3, "#2a6aff");
      b.rect(4, 1, 3, 3, "#2a6aff");
      b.px(1, 2, "#8ab8ff");
      b.px(5, 2, "#8ab8ff");
    } else {
      b.rect(2, 1, 1, 3, "#1a4ac8");
      b.rect(4, 1, 1, 3, "#1a4ac8");
    }
    b.rect(3, 1, 1, 4, "#1a1a1a");
    return b.toCanvas();
  }

  // js/entities/animals.js
  var KIND = {
    paca: { gen: pacaSprite, w: 22, ax: 11, ay: 12, speed: 15, flee: 72, hearing: 0.85, sight: 46, smell: 80, wander: 34, rate: 6, name: "paca" },
    cotia: { gen: cotiaSprite, w: 20, ax: 10, ay: 12, speed: 24, flee: 118, hearing: 1, sight: 72, smell: 90, wander: 70, rate: 9, name: "cotia" },
    capivara: { gen: capivaraSprite, w: 28, ax: 14, ay: 15, speed: 11, flee: 56, hearing: 0.55, sight: 84, smell: 70, wander: 40, rate: 4, name: "capivara" },
    jacu: { gen: jacuSprite, w: 19, ax: 10, ay: 13, speed: 8, flee: 0, hearing: 0.75, sight: 66, smell: 0, wander: 30, rate: 3, name: "jacu", flies: true },
    galinha: { gen: galinhaSprite, w: 12, ax: 6, ay: 11, speed: 12, flee: 48, hearing: 0.35, sight: 30, smell: 0, wander: 46, rate: 6, name: "galinha", tame: true }
  };
  function spr(kind, frame, flip, variant = "") {
    const K = KIND[kind];
    return Sprites.get(`a:${kind}:${frame}:${flip ? 1 : 0}:${variant}`, () => {
      const c = variant === "swim" ? capivaraSprite(frame, true) : K.gen(frame);
      return flip ? flipCanvas(c) : c;
    });
  }
  var Animal = class {
    constructor(g, kind, x, y, o = {}) {
      this.g = g;
      this.kind = kind;
      this.K = KIND[kind];
      this.x = x;
      this.y = y;
      this.home = { x, y };
      this.r = 3;
      this.state = "idle";
      this.timer = Math.random() * 3;
      this.aware = 0;
      this.face = Math.random() < 0.5 ? 1 : -1;
      this.frame = 0;
      this.anim = 0;
      this.z = 0;
      this.target = null;
      this.burrow = o.burrow || null;
      this.water = o.water || null;
      this.visible = true;
      this.observed = false;
      this.id = o.id || kind;
      this.fleeT = 0;
      this.vx = 0;
      this.vy = 0;
    }
    perceive(dt) {
      const p = this.g.player, K = this.K;
      if (["hide", "away", "fly", "land"].includes(this.state)) return 0;
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
      if ((this.state === "idle" || this.state === "wander" || this.state === "graze") && this.aware > 0.45) {
        this.state = "alert";
        this.timer = 1.2;
        this.face = p.x > this.x ? 1 : -1;
      }
      switch (this.state) {
        case "idle":
        case "graze":
          if (this.timer <= 0) {
            const a = Math.random() * Math.PI * 2, r = Math.random() * K.wander;
            this.target = { x: this.home.x + Math.cos(a) * r, y: this.home.y + Math.sin(a) * r };
            this.state = "wander";
            this.timer = 6;
          }
          break;
        case "wander": {
          const dx = this.target.x - this.x, dy = this.target.y - this.y, d = Math.hypot(dx, dy);
          if (d < 3 || this.timer <= 0) {
            this.state = Math.random() < 0.5 ? "graze" : "idle";
            this.timer = 1.5 + Math.random() * 4;
          } else {
            mvx = dx / d;
            mvy = dy / d;
            spd = K.speed;
          }
          break;
        }
        case "alert":
          this.face = p.x > this.x ? 1 : -1;
          if (this.aware >= 1) this.react();
          else if (this.aware < 0.2 && this.timer <= 0) {
            this.state = "idle";
            this.timer = 1 + Math.random() * 2;
          }
          break;
        case "flee": {
          this.fleeT -= dt;
          let dx, dy;
          if (this.target) {
            dx = this.target.x - this.x;
            dy = this.target.y - this.y;
          } else {
            dx = this.x - p.x;
            dy = this.y - p.y;
          }
          const d = Math.hypot(dx, dy) || 1;
          mvx = dx / d;
          mvy = dy / d;
          spd = K.flee;
          if (this.target && (d < 5 || this.fleeT < -3)) this.arrive();
          else if (!this.target && this.fleeT <= 0) {
            this.state = "return";
            this.timer = 10;
          }
          break;
        }
        case "return": {
          const dx = this.home.x - this.x, dy = this.home.y - this.y, d = Math.hypot(dx, dy);
          if (d < 6 || this.timer <= 0) {
            this.state = "idle";
            this.timer = 2;
            this.aware = Math.min(this.aware, 0.3);
          } else {
            mvx = dx / d;
            mvy = dy / d;
            spd = K.speed * 1.4;
          }
          break;
        }
        case "hide":
          if (this.timer <= 0) {
            const d = dist(this.x, this.y, p.x, p.y);
            if (d > 70 || p.noise < 0.2) {
              this.state = "idle";
              this.visible = true;
              this.aware = 0.35;
              this.timer = 2;
              g.onAnimalEvent?.(this, "peek");
            } else this.timer = 3;
          }
          break;
        case "swim": {
          this.z = 0;
          if (this.timer <= 0) {
            this.state = "return";
            this.timer = 12;
          }
          break;
        }
        case "fly": {
          this.z = Math.min(30, this.z + dt * 40);
          const dx = this.x - p.x, dy = this.y - p.y, d = Math.hypot(dx, dy) || 1;
          this.x += dx / d * 75 * dt + this.vx * dt;
          this.y += dy / d * 50 * dt - 12 * dt;
          this.anim += dt * 14;
          this.frame = Math.floor(this.anim) % 2;
          if (this.timer <= 0) {
            this.state = "away";
            this.visible = false;
            this.timer = 16 + Math.random() * 10;
          }
          return;
        }
        case "away":
          if (this.timer <= 0 && dist(this.home.x, this.home.y, p.x, p.y) > 110) {
            this.x = this.home.x + (Math.random() - 0.5) * 30;
            this.y = this.home.y;
            this.z = 30;
            this.state = "land";
            this.visible = true;
          } else if (this.timer <= 0) this.timer = 4;
          return;
        case "land":
          this.z = Math.max(0, this.z - dt * 25);
          this.anim += dt * 14;
          this.frame = Math.floor(this.anim) % 2;
          if (this.z <= 0) {
            this.state = "idle";
            this.timer = 2;
            this.aware = 0;
          }
          return;
      }
      if (spd > 0) {
        const canWater = this.kind === "capivara";
        const ox = this.x, oy = this.y;
        const r = g.world.moveCircle(this, mvx * spd * dt, mvy * spd * dt, this.r, canWater);
        if (r.bx && r.by || Math.hypot(this.x - ox, this.y - oy) < spd * dt * 0.2) {
          const a = Math.atan2(mvy, mvx) + (Math.random() < 0.5 ? 1.2 : -1.2);
          g.world.moveCircle(this, Math.cos(a) * spd * dt, Math.sin(a) * spd * dt, this.r, canWater);
          if (this.state === "wander") this.timer -= 0.3;
        }
        if (Math.abs(mvx) > 0.1) this.face = mvx > 0 ? 1 : -1;
        this.anim += dt * K.rate * (spd / K.speed > 2 ? 2 : 1);
        this.frame = Math.floor(this.anim) % 2;
        if (this.kind === "capivara" && this.state === "flee" && g.world.isWater(this.x, this.y)) this.arrive();
      } else {
        this.frame = this.state === "graze" && Math.sin(g.time * 3 + this.home.x) > 0.3 ? 1 : 0;
        if (this.kind === "paca" || this.kind === "cotia") this.frame = 0;
      }
    }
    react() {
      const g = this.g, p = g.player;
      this.aware = 1;
      const pan = g.panOf(this.x);
      switch (this.kind) {
        case "paca":
          this.state = "flee";
          this.target = this.burrow ? { ...this.burrow } : null;
          this.fleeT = 3;
          g.audio.play("rustle", { pan });
          g.onAnimalEvent?.(this, "flee");
          break;
        case "capivara":
          this.state = "flee";
          this.target = this.water ? { x: this.water.x + (Math.random() - 0.5) * 30, y: this.water.y } : null;
          this.fleeT = 3;
          g.audio.play("capivara", { pan });
          g.onAnimalEvent?.(this, "flee");
          break;
        case "jacu":
          this.state = "fly";
          this.timer = 2.6;
          this.vx = (Math.random() - 0.5) * 30;
          g.audio.play("flap", { pan, vol: 0.9 });
          g.onAnimalEvent?.(this, "fly");
          break;
        case "galinha":
          this.state = "flee";
          this.target = null;
          this.fleeT = 1.2;
          g.audio.play("chicken", { pan });
          break;
        default:
          this.state = "flee";
          this.target = null;
          this.fleeT = 2.5;
          g.audio.play("rustle", { pan, vol: 0.7 });
          g.onAnimalEvent?.(this, "flee");
      }
    }
    arrive() {
      if (this.kind === "paca") {
        this.state = "hide";
        this.visible = false;
        this.timer = 20 + Math.random() * 8;
        this.g.onAnimalEvent?.(this, "hide");
      } else if (this.kind === "capivara") {
        this.state = "swim";
        this.timer = 14 + Math.random() * 6;
        this.g.audio.play("splash", { pan: this.g.panOf(this.x), vol: 0.8 });
        for (let i = 0; i < 2; i++) this.g.particles.add({ type: "ripple", x: this.x, y: this.y, life: 1, r1: 12 });
      } else {
        this.state = "idle";
        this.timer = 2;
      }
    }
    scare() {
      if (!["hide", "away", "fly", "flee", "swim"].includes(this.state)) this.react();
    }
    draw(ctx) {
      if (!this.visible) return;
      const K = this.K, flip = this.face < 0;
      const swim = this.kind === "capivara" && this.g.world.isWater(this.x, this.y);
      if (this.state === "fly" || this.state === "land" || this.z > 0) return;
      const s = spr(this.kind, this.frame, flip, swim ? "swim" : "");
      if (!swim) {
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + 1, K.w * 0.33, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      const bobY = swim ? Math.sin(this.g.time * 2 + this.home.x) * 0.6 + 4 : 0;
      ctx.drawImage(s, Math.round(this.x - K.ax), Math.round(this.y - K.ay + bobY));
      if (swim && Math.random() < 0.02) this.g.particles.add({ type: "ripple", x: this.x, y: this.y + 2, life: 1.2, r1: 10 });
      this.drawAware(ctx, this.y - K.ay - 4);
    }
    drawAir(ctx) {
      if (!this.visible || !(this.state === "fly" || this.state === "land" || this.z > 0)) return;
      const s = Sprites.get(`a:jacufly:${this.frame}`, () => birdFlySprite(this.frame));
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, 5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.drawImage(s, Math.round(this.x - 11), Math.round(this.y - 7 - this.z));
    }
    drawAware(ctx, y) {
      if (this.aware < 0.25 || this.state === "flee" || this.K.tame) return;
      const x = Math.round(this.x);
      y = Math.round(y);
      const alert = this.aware >= 0.75;
      ctx.fillStyle = alert ? "#ff5a3a" : "#f4f0e0";
      if (alert) {
        ctx.fillRect(x, y - 6, 1, 4);
        ctx.fillRect(x, y - 1, 1, 1);
      } else {
        ctx.fillRect(x - 1, y - 6, 3, 1);
        ctx.fillRect(x + 1, y - 5, 1, 1);
        ctx.fillRect(x, y - 4, 1, 1);
        ctx.fillRect(x, y - 1, 1, 1);
      }
    }
  };
  var MonkeyTroop = class {
    constructor(g, nodes, n = 4) {
      this.g = g;
      this.nodes = nodes;
      this.cool = 0;
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
        g.audio.play("monkey", { pan: g.panOf(cx) });
        g.caption("Macacos-prego agitados na copa", g.panOf(cx));
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
          if (k >= 1) {
            m.hop = null;
            m.frame = 0;
          }
        } else {
          m.t -= dt;
          m.frame = Math.sin(g.time * 2 + m.x) > 0.6 ? 1 : 0;
          if (m.t <= 0) {
            m.t = 4 + Math.random() * 8;
            const opts = this.nodes.filter((n) => n !== m.node && dist(n.x, n.y, m.x, m.y) < 80);
            if (opts.length && Math.random() < 0.6) this.startHop(m, opts[Math.random() * opts.length | 0]);
          }
        }
      }
    }
    startHop(m, n) {
      const tx = n.x + (Math.random() - 0.5) * 12, ty = n.y + (Math.random() - 0.5) * 6;
      m.hop = { fx: m.x, fy: m.y, tx, ty, t: 0, dur: 0.5 + dist(m.x, m.y, tx, ty) / 140 };
      m.face = tx > m.x ? 1 : -1;
      m.node = n;
      if (Math.random() < 0.5) for (let i = 0; i < 3; i++) this.g.particles.add({ type: "leaf", x: m.x, y: m.y + 20, z: 22, vx: (Math.random() - 0.5) * 16, vy: 2, life: 3, seed: Math.random() * 9, color: "#4f7a32" });
    }
    draw(ctx) {
      for (const m of this.monkeys) {
        const s = Sprites.get(`a:macaco:${m.frame}:${m.face < 0 ? 1 : 0}`, () => {
          const c = macacoSprite(m.frame);
          return m.face < 0 ? flipCanvas(c) : c;
        });
        ctx.drawImage(s, Math.round(m.x - 8), Math.round(m.y - 14));
      }
    }
  };
  var Flyovers = class {
    constructor(g) {
      this.g = g;
      this.list = [];
      this.t = 20 + Math.random() * 20;
    }
    update(dt) {
      const g = this.g, cam = g.camera;
      this.t -= dt;
      if (this.t <= 0) {
        this.t = 45 + Math.random() * 60;
        const dir = Math.random() < 0.5 ? 1 : -1;
        const n = 2 + (Math.random() * 3 | 0);
        const y = cam.y - cam.viewH * 0.3 + Math.random() * cam.viewH * 0.4;
        for (let i = 0; i < n; i++) this.list.push({ x: cam.x - dir * (cam.viewW / 2 + 40 + i * 18), y: y + i % 2 * 10, vx: dir * 70, t: 0, life: 12 });
        g.audio.play("arara", { pan: -dir * 0.7, vol: 0.8 });
        g.caption("Araras passam gritando sobre a mata", -dir * 0.7);
      }
      for (let i = this.list.length - 1; i >= 0; i--) {
        const b = this.list[i];
        b.t += dt;
        b.x += b.vx * dt;
        b.y += Math.sin(b.t * 2 + i) * 4 * dt;
        if (b.t > b.life) this.list.splice(i, 1);
      }
    }
    draw(ctx) {
      for (const b of this.list) {
        const f = Math.floor(b.t * 6) % 2;
        const s = Sprites.get(`a:arara:${f}:${b.vx < 0 ? 1 : 0}`, () => {
          const c = araraSprite(f);
          return c;
        });
        ctx.save();
        ctx.translate(Math.round(b.x), Math.round(b.y));
        ctx.rotate(b.vx > 0 ? Math.PI / 2 : -Math.PI / 2);
        ctx.drawImage(s, -14, -10);
        ctx.restore();
      }
    }
  };
  var Butterfly = class {
    constructor(g, x, y) {
      this.g = g;
      this.x = x;
      this.y = y;
      this.hx = x;
      this.hy = y;
      this.t = Math.random() * 10;
      this.z = 8;
    }
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
  };

  // js/phases/phase1.js
  var TW = 120;
  var TH = 110;
  var S = 16;
  var px = (t) => t * S;
  var shoreY = (tx) => 99 + 2.4 * Math.sin(tx * 0.07) + 1.4 * Math.sin(tx * 0.19 + 1.3);
  var creekY = (tx) => 52 + 5 * Math.sin(tx * 0.055 + 0.4) + 2 * Math.sin(tx * 0.16 + 2);
  var creekHW = (tx) => 1.7 + 0.35 * Math.sin(tx * 0.3);
  var BRIDGE_TX = 64;
  var BR_CY = creekY(BRIDGE_TX);
  var BR_HW = creekHW(BRIDGE_TX);
  var BRIDGE = { x: px(BRIDGE_TX), y0: px(BR_CY - BR_HW - 1.5), y1: px(BR_CY + BR_HW + 1.6) };
  var TRAILS = [
    { r: 1.15, pts: [[47, 90.6], [52, 91], [57, 90.2], [60, 86], [60, 80], [58.5, 74], [59, 70], [62, 64], [63.6, 58], [64, BR_CY + BR_HW + 1.4]] },
    { r: 1.1, pts: [[64, BR_CY - BR_HW - 1.4], [65, 41], [68, 38], [70, 35.5], [69, 30], [68, 25], [68, 21]] },
    { r: 0.9, pts: [[47, 90.6], [43, 92.5], [38, 96.5], [31, shoreY(31) - 1.2]] },
    { r: 0.8, pts: [[57.5, 90.2], [60.3, 94]] },
    { r: 0.85, pts: [[60, 86], [66, 88.6], [74, 88.8], [80, 88.6], [85, 87.4]] },
    { r: 0.75, pts: [[58.5, 74], [50, 72.4], [41, 71.2], [31, 68.4], [26, 67.4]] },
    { r: 0.7, pts: [[41, 71.2], [38, 65], [36.5, 61.4]] },
    { r: 0.75, pts: [[62, 64], [71, 66.8], [79, 70.2], [86, 67], [91, 64], [95, 62]] },
    { r: 0.7, pts: [[69, 30], [61, 28.4], [54, 30.2]] },
    { r: 0.7, pts: [[70, 35.5], [79, 33.6], [87, 29.4]] }
  ];
  var CLEARINGS = [
    { x: 95, y: 62.5, r: 4.6 },
    { x: 68, y: 20.5, r: 5 },
    { x: 70, y: 36.2, r: 2.6 },
    { x: 24.5, y: 67, r: 3.4 },
    { x: 36.5, y: 61, r: 1.8 },
    { x: 82.5, y: 70.4, r: 2.4 }
  ];
  var KEEP_CLEAR = [
    [82, 69.4, 3.2],
    [55, 67, 2.4],
    [24.5, 66.5, 4.4],
    [36.5, 60.5, 2.6],
    [68, 20, 6],
    [70, 36.5, 3.4],
    [77.2, 18.4, 1.6],
    [59, 76, 2.2],
    [53, 30.2, 1.6],
    [88, 29, 1.8],
    [96.5, 63.5, 2],
    [64, BR_CY, 4]
  ];
  var TRACKS = [
    { id: "t_cotia", kind: "cotia", name: "Cotia", at: [27.6, 69], desc: "Marquinhas pequenas e finas, em pares espa\xE7ados, como de bicho que anda aos pulinhos. Ao lado, cascas de castanha ro\xEDdas.", options: ["Anta", "Cotia", "Tatu"], correct: 1, note: "Cotia. Roedor ligeiro que enterra sementes e acaba plantando a mata." },
    { id: "t_tatu", kind: "tatu", name: "Tatu", at: [44, 73.6], desc: "Um buraco redondo no p\xE9 do barranco, terra fresca jogada para fora e riscos de unhas compridas.", options: ["Paca", "Queixada", "Tatu"], correct: 2, note: "Toca de tatu. A terra ainda est\xE1 \xFAmida: cavou esta noite." },
    { id: "t_queixada", kind: "queixada", name: "Queixada", at: [92.4, 65.6], desc: "Muitas pegadas pequenas de casco partido, misturadas, e o ch\xE3o todo fu\xE7ado. Um cheiro forte e azedo ainda no ar.", options: ["Veado", "Queixada", "Capivara"], correct: 1, note: "Bando de queixadas. Muitos. Melhor n\xE3o cruzar com eles." },
    { id: "t_anta", kind: "anta", name: "Anta", at: [97.4, 59.6], desc: "Pegada grande, com tr\xEAs dedos largos e arredondados, numa trilha bem batida que desce direto para a \xE1gua.", options: ["Anta", "On\xE7a", "Capivara"], correct: 0, note: "Anta. Ela abre trilhas que os outros bichos tamb\xE9m usam." },
    { id: "t_capivara", kind: "capivara", name: "Capivara", at: [29.5, shoreY(29.5) - 1.6], desc: "Pegadas de dedos largos, com uma pelezinha entre eles, coladas \xE0 beira d'\xE1gua. Perto, bolinhas de fezes em forma de gr\xE3o de feij\xE3o.", options: ["Jacar\xE9", "Capivara", "Cotia"], correct: 1, note: "Capivaras. Devem estar por perto, na beira do rio." },
    { id: "t_onca", kind: "onca", name: "On\xE7a-pintada", at: [53.5, creekY(53.5) + creekHW(53.5) + 2.6], desc: "Pegada redonda, quatro dedos e uma almofada larga, sem marca de unha. Coisa grande, que passou devagar.", options: ["Cachorro-do-mato", "Anta", "On\xE7a-pintada"], correct: 2, note: "On\xE7a. Gato n\xE3o deixa marca de unha. Passou beirando o igarap\xE9." }
  ];
  var EQUIP = ["paneiro", "espingarda", "facao", "cantil", "lanterna", "marmita"];
  var HOUSE_C = { x: px(46), y: px(88) };
  var HOUSE_R = { x: px(70), y: px(87) };
  var HOUSE_Z = { x: px(55.5), y: px(89) };
  var FARINHA = { x: px(80.5), y: px(86) };
  var JIRAU = { x: HOUSE_C.x - 27, y: HOUSE_C.y + 14 };
  var SAPOPEMA = { x: px(82), y: px(69.4) };
  var BURROW = { x: SAPOPEMA.x + 17, y: SAPOPEMA.y + 5 };
  var CIPO_TREE = { x: px(55), y: px(67) };
  var FALLEN = { x: px(24.5), y: px(66.2) };
  var OLD_CANOE = { x: px(36.4), y: px(creekY(36.4) + creekHW(36.4) + 1.7) };
  var DEER_PRINT = { x: px(70), y: px(36.6) };
  var CAMP = { x: px(68), y: px(21) };
  var FINAL_PRINT = { x: px(72.6), y: px(20.4) };
  var EYES = { x: px(77.2), y: px(18.2) };
  var TRAILHEAD = { x: px(59), y: px(76) };
  var GATE_Y = px(79.2);
  var GALHOS = [[61.5, 26.4], [75.5, 24.8], [64.6, 32.2]];
  var COLLECT = { caco: [99, 81.6], pena: [96.8, 63.8], anzol: [37.6, OLD_CANOE.y / S - 0.2], jarina: [53, 30.2], jabuti: [88.2, 29] };
  var DOCK = { x0: 59.6, x1: 61.1, y0: 93.6 };
  function createPhase1(g) {
    return new Phase1(g);
  }
  var Phase1 = class {
    constructor(g) {
      this.g = g;
      this.id = 1;
      this.code = "FASE 1";
      this.title = "A PRIMEIRA PEGADA";
      this.timeLimit = 40 * 60;
      this.todStart = 302;
      this.spawn = { x: HOUSE_C.x - 2, y: HOUSE_C.y + 22 };
      this.menuPath = [{ x: px(42), y: px(90) }, { x: px(82), y: px(84) }];
      this.trackDefs = TRACKS;
      this.covers = [];
      this.coverGrid = /* @__PURE__ */ new Map();
      this.pois = [
        { name: "Sua casa", x: HOUSE_C.x, y: HOUSE_C.y },
        { name: "Seu Raimundo", x: HOUSE_R.x, y: HOUSE_R.y },
        { name: "Casa de farinha", x: FARINHA.x, y: FARINHA.y },
        { name: "Trapiche", x: px(60.3), y: px(97) },
        { name: "Ro\xE7a", x: px(93), y: px(86) },
        { name: "In\xEDcio da trilha", x: TRAILHEAD.x, y: TRAILHEAD.y },
        { name: "\xC1rvore ca\xEDda", x: FALLEN.x, y: FALLEN.y },
        { name: "Canoa velha", x: OLD_CANOE.x, y: OLD_CANOE.y },
        { name: "Sapopema grande", x: SAPOPEMA.x, y: SAPOPEMA.y },
        { name: "Clareira", x: px(95), y: px(62.5) },
        { name: "Ponte", x: BRIDGE.x, y: (BRIDGE.y0 + BRIDGE.y1) / 2 },
        { name: "Pegada do veado", x: DEER_PRINT.x, y: DEER_PRINT.y },
        { name: "Clareira do acampamento", x: CAMP.x, y: CAMP.y }
      ];
      this.buildMissions();
    }
    // ---------------- missões ----------------
    buildMissions() {
      const g = this.g;
      const nextEquip = () => {
        const i = EQUIP.find((id) => !g.inv.has(id));
        return i ? this.equipPos(i) : null;
      };
      const nearestTrack = () => {
        let best = null, bd = 1e9;
        for (const t of TRACKS) {
          if (g.tracksKnown.has(t.id)) continue;
          const x = px(t.at[0]), y = px(t.at[1]);
          if (y < BRIDGE.y1 && !g.flags.bridge) continue;
          const d = dist(x, y, g.player.x, g.player.y);
          if (d < bd) {
            bd = d;
            best = { x, y };
          }
        }
        return best;
      };
      this.missions = [
        { id: "prep", title: "Preparar o paneiro e os equipamentos", progress: () => `${EQUIP.filter((i) => g.inv.has(i)).length}/6`, hint: "Os equipamentos est\xE3o no jirau, ao lado da escada da sua casa, e o paneiro est\xE1 no ch\xE3o perto da porta. Chegue perto e aperte E.", target: nextEquip },
        { id: "talk", title: "Conversar com Seu Raimundo sobre o veado", hint: "Seu Raimundo mora na casa verde, a leste da sua, depois da casa do Z\xE9. Ele est\xE1 na frente de casa, de p\xE9 desde cedo.", target: () => ({ x: HOUSE_R.x - 8, y: HOUSE_R.y + 18 }) },
        { id: "trail", title: "Encontrar a trilha do igarap\xE9", hint: "Saia da comunidade pelo caminho de terra que sobe para o norte, entre a casa do Z\xE9 e a de Seu Raimundo. O come\xE7o da trilha tem um esteio com pano vermelho amarrado.", target: () => TRAILHEAD },
        { id: "tracks", title: "Identificar tr\xEAs rastros de animais", progress: () => `${g.tracksKnown.size}/3`, hint: "Rastros aparecem como marcas escuras no ch\xE3o e brilham de leve quando voc\xEA chega perto. H\xE1 rastros na beira do rio (oeste da comunidade), perto da \xE1rvore ca\xEDda, no barranco, na beira do igarap\xE9 e na clareira do leste. Examine com E e escolha o bicho certo.", target: nearestTrack },
        { id: "paca", title: "Encontrar uma paca escondida entre as ra\xEDzes", hint: "Dona Socorro falou da sapopema grande, a leste da trilha. Chegue agachado (C), parado \xE9 ainda melhor. Olhe o vento no minimapa: se ele soprar de voc\xEA para a paca, ela sente seu cheiro. Chegue pelo lado de onde o vento vem.", target: () => ({ x: SAPOPEMA.x + 20, y: SAPOPEMA.y + 10 }) },
        {
          id: "bridge",
          title: "Consertar e atravessar a pontezinha",
          progress: () => g.flags.bridge ? "" : `t\xE1buas ${Math.min(3, g.inv.count("tabua"))}/3 \xB7 cip\xF3 ${g.inv.has("cipo") ? 1 : 0}/1`,
          hint: () => g.flags.bridge ? "A ponte est\xE1 firme. Atravesse para o lado norte do igarap\xE9." : "A ponte do igarap\xE9 perdeu t\xE1buas na \xFAltima cheia. Z\xE9 disse que pode levar uma t\xE1bua da pilha ao lado da casa dele, e que a canoa velha largada na beira do igarap\xE9, a oeste, ainda tem t\xE1buas soltas. Para amarrar, corte cip\xF3-titica com o fac\xE3o: tem um pendurado numa \xE1rvore grande \xE0 beira da trilha.",
          target: () => {
            if (g.flags.bridge) return { x: BRIDGE.x, y: BRIDGE.y0 - 20 };
            if (g.inv.count("tabua") >= 3 && g.inv.has("cipo")) return { x: BRIDGE.x, y: BRIDGE.y1 + 8 };
            const opts = [];
            if (!g.flags.tabuaZe) opts.push({ x: HOUSE_Z.x - 46, y: HOUSE_Z.y + 6 });
            if (!g.flags.tabuasCanoa) opts.push({ x: OLD_CANOE.x, y: OLD_CANOE.y + 6 });
            if (!g.flags.cipo) opts.push({ x: CIPO_TREE.x + 14, y: CIPO_TREE.y + 4 });
            opts.sort((a, b) => dist(a.x, a.y, g.player.x, g.player.y) - dist(b.x, b.y, g.player.x, g.player.y));
            return opts[0] || { x: BRIDGE.x, y: BRIDGE.y1 + 8 };
          }
        },
        { id: "deer", title: "Localizar a primeira pegada do veado-vermelho", hint: "Do outro lado do igarap\xE9, siga a trilha para o norte at\xE9 uma clareira pequena. O ch\xE3o ali \xE9 mole e guarda bem as marcas.", target: () => DEER_PRINT },
        { id: "camp", title: "Montar um pequeno acampamento", progress: () => `galhos ${Math.min(3, g.inv.count("galhos"))}/3`, hint: "Junte 3 feixes de galhos secos (ficam perto da trilha, ao norte da pegada) e monte o acampamento na clareira grande mais ao norte. As outras miss\xF5es precisam estar conclu\xEDdas.", target: () => {
          const i = GALHOS.findIndex((_, k) => !g.flags["galho" + k]);
          return g.inv.count("galhos") >= 3 || i < 0 ? CAMP : { x: px(GALHOS[i][0]), y: px(GALHOS[i][1]) };
        } }
      ];
    }
    currentMission() {
      const g = this.g, order = this.missions;
      const first = order.find((m) => !g.done.has(m.id));
      if (!first) return null;
      if (g.player && g.player.y < BRIDGE.y0 && g.done.has("bridge")) {
        for (const id of ["deer", "camp"]) if (!g.done.has(id)) {
          if (id === "camp" && !["prep", "talk", "trail", "tracks", "paca", "bridge", "deer"].every((k) => g.done.has(k))) {
            return order.find((m) => !g.done.has(m.id) && m.id !== "camp") || first;
          }
          return order.find((m) => m.id === id);
        }
      }
      return first;
    }
    todCap() {
      const d = this.g.done;
      if (d.has("camp")) return 450;
      if (d.has("deer")) return 425;
      if (d.has("bridge")) return 400;
      if (d.has("trail")) return 372;
      if (d.has("talk")) return 352;
      if (d.has("prep")) return 335;
      return 322;
    }
    // ---------------- construção estática ----------------
    async buildStatic(progress) {
      const w = this.world = new World(TW, TH);
      await progress(0.08, "Tra\xE7ando trilhas e igarap\xE9s\u2026");
      const cw = w.cw, ch = w.ch;
      const trail = new Float32Array(cw * ch);
      const nearT = new Float32Array(TW * TH);
      for (const tr of TRAILS) {
        for (let i = 0; i < tr.pts.length - 1; i++) {
          const [ax, ay] = tr.pts[i], [bx, by] = tr.pts[i + 1];
          const L = Math.hypot(bx - ax, by - ay), n = Math.ceil(L / 0.25);
          for (let k = 0; k <= n; k++) {
            const t = k / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
            const R = tr.r * 8;
            const cx0 = Math.floor(x * 8 - R), cx1 = Math.ceil(x * 8 + R), cy0 = Math.floor(y * 8 - R), cy1 = Math.ceil(y * 8 + R);
            for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
              if (cx < 0 || cy < 0 || cx >= cw || cy >= ch) continue;
              const d = Math.hypot(cx + 0.5 - x * 8, cy + 0.5 - y * 8) / R;
              if (d < 1) {
                const v = 1 - d;
                const i2 = cy * cw + cx;
                if (v > trail[i2]) trail[i2] = v;
              }
            }
            const RT = tr.r + 2.2;
            for (let ty = Math.floor(y - RT); ty <= Math.ceil(y + RT); ty++) for (let tx = Math.floor(x - RT); tx <= Math.ceil(x + RT); tx++) {
              if (tx < 0 || ty < 0 || tx >= TW || ty >= TH) continue;
              const d = Math.hypot(tx + 0.5 - x, ty + 0.5 - y) / RT;
              if (d < 1) nearT[ty * TW + tx] = Math.max(nearT[ty * TW + tx], 1 - d);
            }
          }
        }
      }
      this.nearTrail = (tx, ty) => {
        const i = (ty | 0) * TW + (tx | 0);
        return nearT[i] || 0;
      };
      await progress(0.18, "Enchendo o rio\u2026");
      w.generate((tx, ty) => {
        const n = fbm(tx * 0.15, ty * 0.15, 3, 3);
        const n2 = valueNoise(tx * 0.6, ty * 0.6, 8);
        const sy = shoreY(tx) + (n - 0.5) * 0.8;
        if (tx > DOCK.x0 && tx < DOCK.x1 && ty > DOCK.y0 && ty < sy + 4.2) return [T.WOOD];
        if (ty > sy) return [T.RIVER, clamp((ty - sy) / 5, 0, 1)];
        const cy = creekY(tx), hw = creekHW(tx) + (n - 0.5) * 0.5, dc = Math.abs(ty - cy);
        if (dc < hw) return [T.CREEK, clamp((hw - dc) / hw, 0, 1)];
        if (dc < hw + 0.7 + n2 * 0.7) return [T.MUD];
        if (ty > sy - 2.2 - n * 1.2) return [T.SAND];
        const tf = trail[Math.floor(ty * 8) * cw + Math.floor(tx * 8)];
        if (tf > 0.42 + (n2 - 0.5) * 0.3) return [T.DIRT];
        const ce = ((tx - 60) / 25) ** 2 + ((ty - 90) / 10) ** 2;
        if (ce < 1 + (n - 0.5) * 0.5) return [T.GRASS];
        if (tx > 84 + n * 1.5 && tx < 103 - n * 1.5 && ty > 79 + n2 && ty < 94.5) return [T.ROCA];
        for (const c of CLEARINGS) if (Math.hypot(tx - c.x, ty - c.y) / c.r < 1 + (n - 0.5) * 0.5) return [T.CLEAR];
        if (n > 0.7 && Math.abs(ty - cy) < 7) return [T.MUD];
        return [T.FLOOR];
      });
      w.waterTiles = new Uint8Array(TW * TH);
      for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) {
        const t = w.terrainAt(tx * 16 + 8, ty * 16 + 8);
        w.waterTiles[ty * TW + tx] = t === T.RIVER ? 1 : t === T.CREEK ? 2 : 0;
      }
      await progress(0.38, "Plantando a floresta\u2026");
      this.placeVegetation();
      await progress(0.6, "Erguendo as palafitas\u2026");
      this.placeProps();
      await progress(0.7, "Espalhando folhas no ch\xE3o\u2026");
      const gctx = w.renderGround();
      this.decorateGround(gctx);
      await progress(0.9, "Desenhando o mapa\u2026");
      w.buildDensityCanvas();
      w.buildMiniMap();
      this.buildMist();
      await progress(0.98, "Quase l\xE1\u2026");
    }
    addCover(x, y, r) {
      const c = { x, y, r };
      this.covers.push(c);
      const k = (x / 64 | 0) + "," + (y / 64 | 0);
      if (!this.coverGrid.has(k)) this.coverGrid.set(k, []);
      this.coverGrid.get(k).push(c);
    }
    isInCover(x, y) {
      const gx = x / 64 | 0, gy = y / 64 | 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const a = this.coverGrid.get(gx + i + "," + (gy + j));
        if (a) {
          for (const c of a) if ((x - c.x) ** 2 + ((y - c.y) * 1.4) ** 2 < c.r * c.r) return true;
        }
      }
      return false;
    }
    tree(x, y, size, seed) {
      const w = this.world;
      const v = seed % 6;
      let th, tw2, bt, cr, pal;
      if (size === "big") {
        th = 36 + v % 3 * 4;
        tw2 = 9;
        bt = 7 + v % 2 * 2;
        cr = 36 + v % 3 * 4;
        pal = GREENS.deep;
      } else if (size === "mid") {
        th = 24 + v % 3 * 3;
        tw2 = 6;
        bt = v % 2 ? 3 : 0;
        cr = 22 + v % 3 * 3;
        pal = v % 2 ? GREENS.mid : GREENS.olive;
      } else {
        th = 15 + v % 2 * 3;
        tw2 = 4;
        bt = 0;
        cr = 13 + v % 2 * 2;
        pal = GREENS.light;
      }
      const trunk = Sprites.get(`tr:${size}:${v}`, () => trunkSprite(500 + v * 13 + size.length, th, tw2, bt, size === "small" ? ["#4a3a2a", "#5e4a36", "#76604a", "#8e785e"] : void 0));
      const crown = Sprites.get(`cr:${size}:${v}`, () => crownSprite(900 + v * 31 + size.length * 7, cr, pal));
      const d = w.addDrawable({ x, y, sprite: trunk, ax: trunk.width / 2, ay: trunk.height - 2, crown: { sprite: crown, dx: 0, dy: -th - cr * 0.3, r: cr, h: th }, kind: "tree", size });
      w.addCollider({ x, y: y - 2, r: tw2 / 2 + (bt ? bt * 0.6 : 0) + 1 });
      w.addDensity(x, y - th - cr * 0.3, cr * 1.05, size === "big" ? 1 : 0.8);
      return d;
    }
    placeVegetation() {
      const w = this.world, rng = mulberry32(1337);
      const terr = (tx, ty) => w.terrainAt(tx * 16, ty * 16);
      const blockedKeep = (tx, ty, extra = 0) => KEEP_CLEAR.some(([x, y, r]) => Math.hypot(tx - x, ty - y) < r + extra);
      const bigs = [];
      this.canopyNodes = [];
      const specials = [
        [SAPOPEMA.x, SAPOPEMA.y, "big", 2],
        [CIPO_TREE.x, CIPO_TREE.y, "big", 4],
        [px(65.4), px(19.2), "mid", 1],
        [px(70.8), px(19.4), "mid", 3],
        [px(64), px(16), "big", 0],
        [px(74), px(15.5), "big", 5]
      ];
      for (const [x, y, s, v] of specials) {
        const d = this.tree(x, y, s, v);
        bigs.push([x / S, y / S]);
        this.canopyNodes.push({ x: d.x, y: d.y + d.crown.dy });
      }
      for (let ty = 3; ty < TH - 2; ty += 1.9) for (let tx = 2; tx < TW - 2; tx += 1.9) {
        const x = tx + rng() * 1.7, y = ty + rng() * 1.7;
        const t = terr(x, y);
        const nearCreek = Math.abs(y - creekY(x)) < 6.5;
        if (t === T.MUD) {
          if (rng() < 0.25 && !blockedKeep(x, y)) this.palm(px(x), px(y), rng() < 0.6 ? "acai" : "buriti", rng() * 9 | 0);
          else if (rng() < 0.3) this.plant(px(x), px(y), "heliconia", rng() * 9 | 0);
          continue;
        }
        if (t !== T.FLOOR) {
          if (t === T.CLEAR && rng() < 0.12 && !blockedKeep(x, y)) this.plant(px(x), px(y), rng() < 0.5 ? "fern" : "bush", rng() * 9 | 0);
          continue;
        }
        if (blockedKeep(x, y)) continue;
        const nt = this.nearTrail(x, y);
        if (nt > 0.05) {
          if (nt < 0.45 && rng() < 0.35) this.plant(px(x), px(y), rng() < 0.4 ? "fern" : "bush", rng() * 9 | 0);
          continue;
        }
        if (y > 78.5 && y < 81) continue;
        const r = rng();
        if (r < 0.11 && !bigs.some(([bx, by]) => Math.hypot(bx - x, by - y) < 5)) {
          const d = this.tree(px(x), px(y), "big", rng() * 6 | 0);
          bigs.push([x, y]);
          this.canopyNodes.push({ x: d.x, y: d.y + d.crown.dy });
        } else if (r < 0.44) {
          const d = this.tree(px(x), px(y), "mid", rng() * 6 | 0);
          if (rng() < 0.3) this.canopyNodes.push({ x: d.x, y: d.y + d.crown.dy });
        } else if (r < 0.54) this.tree(px(x), px(y), "small", rng() * 6 | 0);
        else if (r < 0.66 && nearCreek) this.palm(px(x), px(y), "acai", rng() * 9 | 0);
        else if (r < 0.69) this.palm(px(x), px(y), "embauba", rng() * 9 | 0);
        else if (r < 0.74) this.palm(px(x), px(y), "acai", rng() * 9 | 0);
        else this.plant(px(x), px(y), rng() < 0.55 ? "bush" : rng() < 0.6 ? "fern" : "heliconia", rng() * 9 | 0);
      }
      for (let i = 0; i < 1500; i++) {
        const x = 3 + rng() * (TW - 6), y = 4 + rng() * (TH - 8);
        if (terr(x, y) !== T.FLOOR || blockedKeep(x, y, -0.6)) continue;
        const nt = this.nearTrail(x, y);
        if (nt > 0.55) continue;
        this.plant(px(x), px(y), rng() < 0.6 ? "bush" : "fern", rng() * 9 | 0);
      }
      const village = [[40, 85, "banana"], [43, 84.5, "acai"], [52, 85, "banana"], [64.5, 84.5, "acai"], [66, 85.5, "banana"], [76, 84.6, "banana"], [37, 88, "embauba"], [84, 83, "embauba"], [51, 86, "acai"], [62.5, 91.6, "banana"], [75.5, 91.5, "acai"], [33, 92, "acai"], [104, 82, "embauba"], [105, 90, "acai"]];
      for (const [x, y, k] of village) {
        if (k === "banana") this.plant(px(x), px(y), "banana", x * 7 | 0);
        else this.palm(px(x), px(y), k, x * 3 | 0);
      }
      this.tucumSpots = [[21.5, 64.4], [27.6, 63.9], [20.6, 68.9], [29.4, 70.4]];
      for (const [x, y] of this.tucumSpots) this.plant(px(x), px(y), "tucum", x * 5 | 0);
    }
    palm(x, y, kind, v) {
      const w = this.world;
      const s = kind === "acai" ? Sprites.get("pa:acai:" + v % 5, () => acaiSprite(70 + v % 5)) : kind === "buriti" ? Sprites.get("pa:bur:" + v % 3, () => buritiSprite(80 + v % 3)) : Sprites.get("pa:emb:" + v % 4, () => embaubaSprite(90 + v % 4));
      w.addDrawable({ x, y, sprite: s, ax: s.width / 2, ay: s.height - 2, shadow: { rx: kind === "buriti" ? 14 : 10, ry: 4, dx: -8, len: 10 } });
      w.addCollider({ x, y: y - 1, r: kind === "buriti" ? 3 : 2 });
      w.addDensity(x, y - s.height * 0.75, kind === "buriti" ? 22 : 16, 0.35);
    }
    plant(x, y, kind, v) {
      const w = this.world;
      let s;
      if (kind === "bush") s = Sprites.get("bu:" + v % 6, () => bushSprite(200 + v % 6, 7 + v % 3, v % 2 ? GREENS.mid : GREENS.light));
      else if (kind === "fern") s = Sprites.get("fe:" + v % 4, () => fernSprite(300 + v % 4));
      else if (kind === "heliconia") s = Sprites.get("he:" + v % 3, () => heliconiaSprite(400 + v % 3));
      else if (kind === "tucum") s = Sprites.get("tu:" + v % 2, () => tucumSprite(420 + v % 2));
      else if (kind === "banana") s = Sprites.get("ba:" + v % 3, () => bananaSprite(440 + v % 3));
      else if (kind === "maniva") s = Sprites.get("ma:" + v % 4, () => manivaSprite(460 + v % 4));
      w.addDrawable({ x, y, sprite: s, ax: s.width / 2, ay: s.height - 2 });
      if (kind === "bush") this.addCover(x, y - 4, 10 + v % 3);
      if (kind === "banana") w.addCollider({ x, y: y - 1, r: 2 });
    }
    placeProps() {
      const w = this.world;
      const add = (x, y, s, o = {}) => w.addDrawable({ x, y, sprite: s, ax: o.ax ?? s.width / 2, ay: o.ay ?? s.height - 2, ...o });
      const houses = [[HOUSE_C, "#4f7f9a", "zinc", 1], [HOUSE_Z, "#c07a6a", "palha", 2], [HOUSE_R, "#5f8a5a", "zinc", 3]];
      for (const [h, paint, roof, seed] of houses) {
        const s = Sprites.get("house:" + seed, () => houseSprite(seed, paint, roof));
        add(h.x, h.y, s, { ax: 40, ay: 72, shadow: { rx: 40, ry: 8, dx: -10, dy: -4, len: 14 } });
        w.addCollider({ x: h.x - 38, y: h.y - 46, w: 76, h: 40 });
      }
      const cf = Sprites.get("farinha", () => casaFarinhaSprite(5));
      add(FARINHA.x, FARINHA.y, cf, { ax: 39, ay: 60, shadow: { rx: 38, ry: 8, dx: -8, dy: -2, len: 14 } });
      w.addCollider({ x: FARINHA.x, y: FARINHA.y - 16, r: 14 });
      w.addCollider({ x: FARINHA.x - 33, y: FARINHA.y - 6, r: 3 });
      w.addCollider({ x: FARINHA.x + 32, y: FARINHA.y - 6, r: 3 });
      const jr = Sprites.get("jirau", () => jiraoSprite());
      add(JIRAU.x, JIRAU.y, jr, { ax: 17, ay: 19 });
      w.addCollider({ x: JIRAU.x - 16, y: JIRAU.y - 8, w: 32, h: 7 });
      const wp = Sprites.get("woodpile", () => woodpileSprite());
      add(HOUSE_Z.x - 50, HOUSE_Z.y + 2, wp, { ax: 15, ay: 14 });
      w.addCollider({ x: HOUSE_Z.x - 64, y: HOUSE_Z.y - 8, w: 28, h: 9 });
      const fence = Sprites.get("fence", () => fenceSprite(32));
      for (let x = 84; x < 103; x += 2) add(px(x), px(78.8), fence, { ax: 0, ay: 13 });
      for (let y = 79; y < 94; y += 1.6) for (let x = 85.5; x < 102; x += 1.4) {
        if (Math.abs(x - 93.5) < 0.8) continue;
        if (w.terrainAt(px(x), px(y)) === T.ROCA) this.plant(px(x) + y * 3 % 2, px(y), "maniva", x * 7 + y * 3 | 0);
      }
      this.moored = [{ x: px(DOCK.x0) - 26, y: px(shoreY(DOCK.x0) + 1.6), s: 1 }, { x: px(DOCK.x1) + 26, y: px(shoreY(DOCK.x1) + 2.4), s: 2 }, { x: px(DOCK.x1) + 30, y: px(shoreY(DOCK.x1) + 0.6), s: 3 }];
      for (const [x, y] of [[DOCK.x0, DOCK.y0 + 1], [DOCK.x1, DOCK.y0 + 1], [DOCK.x0, shoreY(60) + 3.5], [DOCK.x1, shoreY(60) + 3.5]]) {
        const post = Sprites.get("post", () => {
          const c = makeCanvas(4, 12);
          const x2 = c.getContext("2d");
          x2.fillStyle = "#4a3420";
          x2.fillRect(0, 0, 4, 12);
          x2.fillStyle = "#2e2010";
          x2.fillRect(3, 0, 1, 12);
          return c;
        });
        add(px(x), px(y), post, { ax: 2, ay: 10 });
      }
      const oc = Sprites.get("canoe:broken", () => canoeSprite(9, true));
      add(OLD_CANOE.x, OLD_CANOE.y, oc, { ax: 25, ay: 11 });
      w.addCollider({ x: OLD_CANOE.x - 22, y: OLD_CANOE.y - 7, w: 44, h: 6 });
      const ft = Sprites.get("fallen", () => fallenTreeSprite(77));
      add(FALLEN.x, FALLEN.y, ft, { ax: 52, ay: 24, shadow: { rx: 48, ry: 5, dy: 2, len: 6 } });
      w.addCollider({ x: FALLEN.x - 50, y: FALLEN.y - 12, w: 98, h: 11 });
      const tp = Sprites.get("trailpost", () => trailPostSprite());
      add(TRAILHEAD.x, TRAILHEAD.y, tp, { ax: 6, ay: 24 });
      w.addCollider({ x: TRAILHEAD.x, y: TRAILHEAD.y - 1, r: 2 });
      const rng = mulberry32(55);
      for (let i = 0; i < 70; i++) {
        const tx = 3 + rng() * (TW - 6);
        const ty = rng() < 0.5 ? creekY(tx) + (rng() < 0.5 ? -1 : 1) * (creekHW(tx) + 0.6 + rng()) : shoreY(tx) - 0.4 - rng() * 1.5;
        if (Math.abs(tx - BRIDGE_TX) < 3 || tx > 58 && tx < 63 && ty > 90) continue;
        const t = w.terrainAt(px(tx), px(ty));
        if (t === T.RIVER || t === T.CREEK || t === T.WOOD) continue;
        const s = Sprites.get("rock:" + i % 5, () => rockSprite(600 + i % 5, 3 + i % 5));
        add(px(tx), px(ty), s, { ax: s.width / 2, ay: s.height - 2 });
        if (i % 5 > 2) w.addCollider({ x: px(tx), y: px(ty) - 2, r: 3 + i % 5 - 2 });
      }
      this.twigs = [];
      const tr = mulberry32(99);
      for (const t of TRAILS.slice(0, 2).concat(TRAILS.slice(5))) {
        for (let i = 0; i < t.pts.length - 1; i++) {
          if (tr() < 0.35) continue;
          const [ax, ay] = t.pts[i], [bx, by] = t.pts[i + 1];
          const k = 0.3 + tr() * 0.4, x = px(ax + (bx - ax) * k) + (tr() - 0.5) * 8, y = px(ay + (by - ay) * k) + (tr() - 0.5) * 8;
          if (y > GATE_Y) continue;
          const s = Sprites.get("twig:" + i % 3, () => twigSprite(i));
          add(x, y, s, { ax: 5, ay: 3, layer: "ground" });
          this.twigs.push({ x, y, cd: 0 });
        }
      }
    }
    decorateGround(ctx) {
      const w = this.world, rng = mulberry32(4242);
      ctx.strokeStyle = "rgba(40,28,16,0.75)";
      ctx.lineWidth = 2;
      for (const d of w.drawables) {
        if (d.kind !== "tree" || d.size !== "big") continue;
        for (let k = 0; k < 5; k++) {
          const a = rng() * Math.PI * 2, L = 14 + rng() * 14;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y - 2);
          ctx.quadraticCurveTo(d.x + Math.cos(a) * L * 0.5 + (rng() - 0.5) * 6, d.y + Math.sin(a) * L * 0.25, d.x + Math.cos(a) * L, d.y + Math.sin(a) * L * 0.45);
          ctx.stroke();
        }
      }
      for (let i = 0; i < 9e3; i++) {
        const x = rng() * w.W, y = rng() * w.H, t = w.terrainAt(x, y);
        if (t === T.FLOOR || t === T.CLEAR) {
          const r = rng();
          if (r < 0.45) {
            ctx.fillStyle = ["#7a5428", "#8e6a30", "#5e4420", "#9a7a3a", "#6a3a1e"][rng() * 5 | 0];
            ctx.fillRect(x | 0, y | 0, 2 + (rng() * 2 | 0), 1);
            ctx.fillRect((x | 0) + 1, (y | 0) + 1, 1, 1);
          } else if (r < 0.7) {
            ctx.fillStyle = "#3f6a2a";
            ctx.fillRect(x | 0, y | 0, 1, 2);
            ctx.fillStyle = "#5a8a3a";
            ctx.fillRect((x | 0) - 1, y | 0, 1, 1);
            ctx.fillRect((x | 0) + 1, y | 0, 1, 1);
          } else if (r < 0.8) {
            ctx.fillStyle = "#4a3a24";
            ctx.fillRect(x | 0, y | 0, 4, 1);
          }
        } else if (t === T.GRASS) {
          ctx.fillStyle = rng() < 0.5 ? "#6a9a3a" : "#4e7a2a";
          ctx.fillRect(x | 0, y | 0, 1, 2);
          ctx.fillRect((x | 0) + 2, (y | 0) + 1, 1, 2);
          if (rng() < 0.05) {
            ctx.fillStyle = ["#f0e070", "#f0f0f0", "#e07ab0"][rng() * 3 | 0];
            ctx.fillRect(x | 0, (y | 0) - 1, 1, 1);
          }
        } else if (t === T.SAND && rng() < 0.3) {
          ctx.fillStyle = "rgba(120,100,70,0.5)";
          ctx.fillRect(x | 0, y | 0, 1, 1);
        }
      }
      ctx.fillStyle = "rgba(110,90,60,0.6)";
      for (let i = 0; i < 40; i++) {
        const x = px(48 + i * 0.35), y = px(shoreY(48 + i * 0.35) - 1.4) + i % 2 * 3;
        ctx.fillRect(x | 0, y | 0, 2, 1);
      }
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = i % 2 ? "#c8a040" : "#8a5a2a";
        ctx.fillRect(BURROW.x + 10 + rng() * 24 | 0, BURROW.y + rng() * 14 | 0, 2, 2);
      }
      ctx.fillStyle = "rgba(30,24,18,0.6)";
      ctx.beginPath();
      ctx.ellipse(CAMP.x, CAMP.y + 6, 9, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    buildMist() {
      const c = makeCanvas(64, 28), x = c.getContext("2d");
      const grd = x.createRadialGradient(32, 14, 2, 32, 14, 30);
      grd.addColorStop(0, "rgba(230,236,240,0.9)");
      grd.addColorStop(1, "rgba(230,236,240,0)");
      x.save();
      x.scale(1, 0.45);
      x.fillStyle = grd;
      x.translate(0, 0);
      x.restore();
      x.fillStyle = grd;
      x.fillRect(0, 0, 64, 28);
      this.mistSprite = c;
      const rng = mulberry32(8);
      this.mist = [];
      for (let i = 0; i < 70; i++) {
        const tx = rng() * TW;
        this.mist.push({ x: px(tx), y: px(shoreY(tx) + 0.5 + rng() * 3), s: 1 + rng() * 1.5, sp: 3 + rng() * 4 });
      }
      for (let i = 0; i < 70; i++) {
        const tx = rng() * TW;
        this.mist.push({ x: px(tx), y: px(creekY(tx)) + (rng() - 0.5) * 30, s: 0.8 + rng(), sp: 2 + rng() * 3 });
      }
    }
    equipPos(id) {
      const offs = { espingarda: -13, facao: -6, cantil: 0, lanterna: 6, marmita: 12 };
      if (id === "paneiro") return { x: HOUSE_C.x + 16, y: HOUSE_C.y + 9 };
      return { x: JIRAU.x + offs[id], y: JIRAU.y - 11 };
    }
    // ---------------- elementos dinâmicos ----------------
    setupDynamic(fromSave) {
      const g = this.g, w = this.world, f = g.flags;
      this.eyes = { a: 0 };
      this.whistleT = 0;
      this.gateMsgT = 0;
      this.finished = false;
      g.lights = [];
      for (const id of EQUIP) {
        if (g.inv.has(id)) continue;
        const pos = this.equipPos(id);
        const icon3 = Sprites.get("icon:" + id, () => iconSprite(id));
        const ent = { x: pos.x, y: pos.y, sortY: JIRAU.y + 1, draw: (ctx) => {
          if (!ent.gone) ctx.drawImage(icon3, Math.round(ent.x - 8), Math.round(ent.y - 12));
        } };
        if (id === "paneiro") ent.sortY = pos.y;
        g.entities.push(ent);
        g.interactables.push({
          x: pos.x,
          y: id === "paneiro" ? pos.y + 2 : JIRAU.y + 6,
          r: 18,
          py: 26,
          label: `Pegar ${ITEMS[id].name.toLowerCase()}`,
          enabled: () => !ent.gone,
          action: () => {
            ent.gone = true;
            g.give(id);
            this.onEquip(id);
          }
        });
      }
      this.raimundo = new NPC(g, "raimundo", "Seu Raimundo", "raimundo", HOUSE_R.x - 10, HOUSE_R.y + 12, "down");
      this.socorro = new NPC(g, "socorro", "Dona Socorro", "socorro", FARINHA.x - 22, FARINHA.y - 4, "right");
      this.ze = new NPC(g, "ze", "Z\xE9", "ze", px(60.35), px(shoreY(60.35) + 2.2), "down");
      for (const n of [this.raimundo, this.socorro, this.ze]) {
        g.npcs.push(n);
        g.entities.push(n);
        g.updaters.push(n);
      }
      g.interactables.push({ x: this.raimundo.x, y: this.raimundo.y + 4, r: 26, py: 30, label: () => g.done.has("talk") ? "Conversar com Seu Raimundo" : "Perguntar sobre o veado", action: () => this.talkRaimundo() });
      g.interactables.push({ x: this.socorro.x, y: this.socorro.y + 4, r: 26, py: 30, label: "Conversar com Dona Socorro", action: () => this.talkSocorro() });
      g.interactables.push({ x: this.ze.x, y: this.ze.y - 4, r: 26, py: 30, label: "Conversar com Z\xE9", action: () => this.talkZe() });
      for (const m of this.moored) {
        const s = Sprites.get("canoe:" + m.s, () => m.s % 2 ? canoeSprite(m.s) : flipCanvas(canoeSprite(m.s)));
        g.entities.push({ x: m.x, y: m.y, draw: (ctx) => {
          const b = Math.sin(g.time * 1.4 + m.s) * 0.8;
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = "#1a140a";
          ctx.beginPath();
          ctx.ellipse(m.x, m.y + 2, 22, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.drawImage(s, Math.round(m.x - 25), Math.round(m.y - 10 + b));
        } });
      }
      g.interactables.push({ x: HOUSE_Z.x - 50, y: HOUSE_Z.y + 8, r: 22, py: 22, label: "Pegar uma t\xE1bua", enabled: () => !f.tabuaZe, action: () => {
        if (!g.done.has("talk") && !f.zeTalked) {
          g.run(async () => {
            await g.say("Caetano", "Essas t\xE1buas s\xE3o do Z\xE9. Melhor perguntar antes.", "caetano");
          });
          return;
        }
        f.tabuaZe = true;
        g.give("tabua");
        this.bridgeHint();
      } });
      g.interactables.push({ x: OLD_CANOE.x, y: OLD_CANOE.y + 6, r: 26, py: 20, label: "Soltar t\xE1buas da canoa velha", enabled: () => !f.tabuasCanoa, action: () => {
        if (!g.inv.has("facao")) {
          g.ui.toast("Precisa do fac\xE3o para soltar as t\xE1buas.", "tip");
          return;
        }
        f.tabuasCanoa = true;
        g.audio.play("cut");
        g.give("tabua", 2);
        this.bridgeHint();
      } });
      const cipo = Sprites.get("cipo", () => cipoSprite(44));
      g.entities.push({ x: CIPO_TREE.x + 10, y: CIPO_TREE.y + 1, draw: (ctx) => {
        if (!f.cipo) ctx.drawImage(cipo, Math.round(CIPO_TREE.x + 4), Math.round(CIPO_TREE.y - 44 + Math.sin(g.time) * 0.5));
      } });
      g.interactables.push({ x: CIPO_TREE.x + 12, y: CIPO_TREE.y + 4, r: 22, py: 30, label: "Cortar cip\xF3-titica", enabled: () => !f.cipo, action: () => {
        if (!g.inv.has("facao")) {
          g.ui.toast("Sem o fac\xE3o n\xE3o d\xE1 para cortar o cip\xF3.", "tip");
          return;
        }
        f.cipo = true;
        g.audio.play("cut");
        g.give("cipo");
        this.bridgeHint();
        for (let i = 0; i < 8; i++) g.particles.add({ type: "leaf", x: CIPO_TREE.x + 10, y: CIPO_TREE.y, z: 20 + Math.random() * 20, vx: (Math.random() - 0.5) * 20, vy: 2, life: 3, seed: Math.random() * 9, color: "#4f7a32" });
      } });
      w.walkOverrides.push({ x: BRIDGE.x - 11, y: BRIDGE.y0, w: 22, h: BRIDGE.y1 - BRIDGE.y0, active: () => !!f.bridge });
      g.interactables.push({ x: BRIDGE.x, y: BRIDGE.y1 + 4, r: 26, py: 18, label: () => g.inv.count("tabua") >= 3 && g.inv.has("cipo") ? "Consertar a ponte" : "Examinar a ponte", enabled: () => !f.bridge, action: () => this.bridgeAction() });
      w.blockers.push({ x: 0, y: GATE_Y - 6, w: w.W, h: 6, active: () => !(g.done.has("prep") && g.done.has("talk")) });
      for (const t of TRACKS) {
        const x = px(t.at[0]), y = px(t.at[1]);
        g.interactables.push({ x, y, r: 22, py: 12, label: () => g.tracksKnown.has(t.id) ? `Rastro de ${t.name.toLowerCase()}` : "Examinar rastro", enabled: () => !g.tracksKnown.has(t.id), action: () => this.examineTrack(t) });
      }
      this.paca = new Animal(g, "paca", BURROW.x + 18, BURROW.y + 8, { burrow: { ...BURROW }, id: "paca" });
      this.paca.home = { x: BURROW.x + 22, y: BURROW.y + 10 };
      const animals = [this.paca];
      for (const [x, y] of [[30, 72], [70, 58.6], [62, 31], [88, 74]]) animals.push(new Animal(g, "cotia", px(x), px(y)));
      for (const [x, y] of [[40, 64.5], [76.5, 40], [89, 71.5], [50, 24], [103, 66]]) {
        for (let i = 0; i < 2; i++) animals.push(new Animal(g, "jacu", px(x) + i * 12, px(y) + i * 5));
      }
      for (let i = 0; i < 4; i++) {
        const tx = 24 + i * 2.6;
        animals.push(new Animal(g, "capivara", px(tx), px(shoreY(tx) - 1.4 - i % 2), { water: { x: px(tx), y: px(shoreY(tx) + 2.2) } }));
      }
      for (const [x, y] of [[44, 91.5], [53, 92], [67, 90.5], [72, 91]]) animals.push(new Animal(g, "galinha", px(x), px(y)));
      for (const a of animals) {
        g.animals.push(a);
        g.entities.push(a);
        g.updaters.push(a);
        g.airEntities.push(a);
      }
      g.onAnimalEvent = (a, ev) => this.onAnimalEvent(a, ev);
      const self = this;
      g.interactables.push({
        get x() {
          return self.paca.visible ? self.paca.x : BURROW.x;
        },
        get y() {
          return self.paca.visible ? self.paca.y : BURROW.y + 4;
        },
        get r() {
          return self.paca.visible ? 48 : 26;
        },
        py: 14,
        label: () => self.paca.visible ? "Observar a paca" : "Examinar as ra\xEDzes",
        enabled: () => !g.done.has("paca"),
        action: () => self.observePaca()
      });
      const south = this.canopyNodes.filter((n) => n.x > px(32) && n.x < px(52) && n.y > px(56) && n.y < px(72));
      const north = this.canopyNodes.filter((n) => n.x > px(52) && n.x < px(80) && n.y > px(10) && n.y < px(34));
      const pickNodes = (arr, base) => arr.length >= 3 ? arr : base;
      const fallbackS = [{ x: px(40), y: px(61) }, { x: px(44), y: px(63) }, { x: px(47), y: px(60) }, { x: px(42), y: px(66) }];
      const fallbackN = [{ x: px(60), y: px(24) }, { x: px(64), y: px(27) }, { x: px(58), y: px(30) }, { x: px(66), y: px(31) }];
      for (const nodes of [pickNodes(south, fallbackS), pickNodes(north, fallbackN)]) {
        const tr = new MonkeyTroop(g, nodes, 4);
        g.updaters.push(tr);
        g.airEntities.push(tr);
      }
      const fo = new Flyovers(g);
      g.updaters.push(fo);
      g.airEntities.push(fo);
      for (const [x, y] of [[95, 62], [68, 36], [24, 67], [62, 88], [36, 60], [70, 22]]) {
        const b = new Butterfly(g, px(x), px(y));
        g.updaters.push(b);
        g.entities.push(b);
      }
      for (const [id, [tx, ty]] of Object.entries(COLLECT)) {
        if (g.inv.found.has(id)) continue;
        const x = px(tx), y = px(ty);
        const icon3 = Sprites.get("icon:" + id, () => iconSprite(id));
        const ent = { x, y, draw: (ctx) => {
          if (ent.gone) return;
          ctx.globalAlpha = 0.95;
          ctx.drawImage(icon3, Math.round(x - 8), Math.round(y - 10));
          ctx.globalAlpha = 1;
          if (Math.sin(g.time * 3 + x) > 0.92) {
            ctx.fillStyle = "#fff6c8";
            ctx.fillRect(Math.round(x + 3), Math.round(y - 9), 1, 1);
            ctx.fillRect(Math.round(x + 2), Math.round(y - 8), 3, 1);
            ctx.fillRect(Math.round(x + 3), Math.round(y - 7), 1, 1);
          }
        } };
        g.entities.push(ent);
        g.interactables.push({ x, y, r: 18, py: 16, label: `Pegar ${ITEMS[id].name.toLowerCase()}`, enabled: () => !ent.gone, action: () => {
          ent.gone = true;
          g.give(id);
          g.ui.toast(ITEMS[id].desc, "discovery", 6500);
        } });
      }
      g.interactables.push({ x: FALLEN.x + 30, y: FALLEN.y + 6, r: 22, py: 18, label: "Revirar o oco do tronco", enabled: () => !f.pilhas, action: () => {
        f.pilhas = true;
        g.give("pilhas");
        g.ui.toast("Uma lata velha de ca\xE7ador, esquecida no oco: duas pilhas ainda boas.", "discovery", 4500);
      } });
      GALHOS.forEach(([tx, ty], i) => {
        if (f["galho" + i]) return;
        const x = px(tx), y = px(ty);
        const s = Sprites.get("sticks", () => sticksSprite());
        const ent = { x, y, draw: (ctx) => {
          if (!f["galho" + i]) ctx.drawImage(s, Math.round(x - 9), Math.round(y - 8));
        } };
        g.entities.push(ent);
        g.interactables.push({ x, y, r: 18, py: 14, label: "Juntar galhos secos", enabled: () => !f["galho" + i], action: () => {
          f["galho" + i] = true;
          g.give("galhos");
        } });
      });
      g.interactables.push({ x: DEER_PRINT.x, y: DEER_PRINT.y, r: 24, py: 12, label: "Investigar o sinal do veado", enabled: () => !g.done.has("deer"), action: () => this.deerPrint() });
      g.interactables.push({ x: CAMP.x, y: CAMP.y + 4, r: 26, py: 18, label: "Montar acampamento", enabled: () => !f.camp, action: () => this.campAction() });
      this.fireFrames = Sprites.get("fireframes", () => fireFrames());
      this.fireLight = { x: CAMP.x, y: CAMP.y + 2, r: 70, i: 0.9, flicker: true, color: "255,170,80", off: !f.camp };
      g.lights.push(this.fireLight);
      g.entities.push({ x: CAMP.x, y: CAMP.y + 8, draw: (ctx) => this.drawCamp(ctx) });
      this.windowLights = [];
      for (const h of [HOUSE_C, HOUSE_Z, HOUSE_R]) for (const dx of [-22, 22]) {
        const l = { x: h.x + dx, y: h.y - 30, r: 30, i: 0.6, color: "255,190,110" };
        this.windowLights.push(l);
        g.lights.push(l);
      }
      const lamp = { x: HOUSE_R.x + 24, y: HOUSE_R.y - 12, r: 46, i: 0.8, flicker: true, color: "255,180,90" };
      this.windowLights.push(lamp);
      g.lights.push(lamp);
      g.lights.push({ x: FARINHA.x, y: FARINHA.y - 12, r: 52, i: 0.85, flicker: true, color: "255,150,70" });
      g.hazards = this.tucumSpots.map(([x, y]) => ({ x: px(x), y: px(y) - 3, r: 9, type: "tucum" }));
      this.antHill = { x: FALLEN.x - 44, y: FALLEN.y + 12 };
      g.hazards.push({ x: this.antHill.x, y: this.antHill.y, r: 12, type: "ants" });
      this.setupTriggers();
      if (!fromSave) {
        g.fade = 1;
      }
    }
    setupTriggers() {
      const g = this.g, f = g.flags;
      g.triggers.push({ x: TRAILHEAD.x, y: TRAILHEAD.y + 4, r: 34, cond: () => !g.done.has("trail"), fn: () => this.reachTrail() });
      g.triggers.push({ x: SAPOPEMA.x + 10, y: SAPOPEMA.y + 10, r: 110, cond: () => !g.done.has("paca") && !f.pacaTip, fn: () => {
        f.pacaTip = true;
        g.ui.toast("<b>Dica</b> \xB7 Frutas ro\xEDdas no ch\xE3o: a paca est\xE1 por perto. Agache (C), ande devagar e fique de olho no vento do minimapa.", "tip", 7e3);
      } });
      g.triggers.push({ x: BRIDGE.x - 30, y: BRIDGE.y0 - 70, w: 60, h: 60, cond: () => !!f.bridge && !g.done.has("bridge"), fn: () => this.crossedBridge() });
      g.triggers.push({ x: OLD_CANOE.x, y: OLD_CANOE.y, r: 70, cond: () => !f.canoeSeen, fn: () => {
        f.canoeSeen = true;
        g.ui.toast("Uma canoa velha, rachada e cheia de musgo, largada na lama.", "discovery", 3800);
      } });
      g.triggers.push({ x: FALLEN.x, y: FALLEN.y, r: 80, cond: () => !f.fallenSeen, fn: () => {
        f.fallenSeen = true;
        g.ui.toast("Uma \xE1rvore enorme ca\xEDda. Cuidado com o tucum espinhento ao redor e com o formigueiro.", "discovery", 4500);
      } });
      g.triggers.push({ x: px(95), y: px(62.5), r: 70, cond: () => !f.clearSeen, fn: () => {
        f.clearSeen = true;
        g.ui.toast("Uma clareira cheia de pegadas. Muitos bichos passam por aqui para chegar \xE0 \xE1gua.", "discovery", 4500);
      } });
      g.triggers.push({ x: px(56), y: px(53.5), r: 90, cond: () => !f.oncaTip && g.done.has("trail"), fn: () => {
        f.oncaTip = true;
        g.caption("Sil\xEAncio estranho perto do igarap\xE9", 0);
      } });
      for (const t of this.twigs) {
        g.triggers.push({ x: t.x, y: t.y, r: 7, once: false, fn: () => {
          const p = g.player;
          if (t.cd > g.time || !p.moving || p.sneak) return;
          t.cd = g.time + 3;
          g.audio.play("twig", { pan: 0, vol: p.running ? 1 : 0.8 });
          p.makeNoise(0.95);
          g.caption("Um galho seco estala sob a bota", 0);
          if (!f.twigTip) {
            f.twigTip = true;
            g.ui.toast("<b>Dica</b> \xB7 Galhos secos estalam e espantam os bichos. Agachado (C), voc\xEA pisa com cuidado.", "tip", 6e3);
          }
        } });
      }
    }
    // ---------------- ações e roteiro ----------------
    async intro() {
      const g = this.g;
      await g.ui.intro([
        '<span class="place">S\xE3o Sebasti\xE3o do Igarap\xE9 Grande</span>Uma comunidade ribeirinha \xE0s margens de um rio de \xE1guas barrentas, em algum lugar da Amaz\xF4nia.',
        "\xC9 ver\xE3o. As \xE1guas baixaram e as praias apareceram de novo no rio.",
        "Na conversa de ontem, no trapiche, falaram de um <b>veado-vermelho</b> grande, visto l\xE1 para os lados do buritizal antigo.",
        "Caetano quase n\xE3o dormiu. Antes de o sol nascer, j\xE1 estava de p\xE9."
      ]);
      g.player.dir = "down";
      g.letterbox = 1;
      g.audio.setMood("calm");
      await g.run(async () => {
        g.camera.targetZoom = 1.25;
        await g.tween(g, "fade", 0, 2.5);
        g.ui.titleCard("FASE 1", "A Primeira Pegada", "Amanhecer \xB7 comunidade ribeirinha");
        await g.wait(3.2);
        await g.say("Caetano", "Ainda t\xE1 escuro... Mas o veado anda \xE9 cedo. Hoje eu trago esse bicho.", "caetano");
        await g.say("Caetano", "Deixei tudo no jirau, do lado da escada. Primeiro, arrumar o paneiro.", "caetano");
        g.camera.targetZoom = 1;
        await g.tween(g, "letterbox", 0, 0.8);
      });
      g.state = "play";
      g.stats.startedAt = g.timeLeft;
      const mob = g.input.lastDevice === "touch";
      g.ui.toast(mob ? "<b>Dica</b> \xB7 Use o joystick para andar e \u270B para interagir." : "<b>Dica</b> \xB7 Ande com <kbd>WASD</kbd> ou setas. Interaja com <kbd>E</kbd>.", "tip", 6500);
      setTimeout(() => g.state === "play" && g.ui.toast(mob ? '<b>Dica</b> \xB7 "\u2630 Miss\xF5es" abre o painel com objetivos e dicas.' : "<b>Dica</b> \xB7 O painel \xE0 direita mostra as miss\xF5es. Clique em <b>?</b> para ver dicas.", "tip", 6500), 7e3);
      g.checkpoint("In\xEDcio da expedi\xE7\xE3o");
    }
    onEquip(id) {
      const g = this.g;
      if (id === "lanterna") g.ui.toast(g.input.lastDevice === "touch" ? '<b>Dica</b> \xB7 Ainda est\xE1 escuro. Toque em "Luz" para acender a lanterna.' : "<b>Dica</b> \xB7 Ainda est\xE1 escuro. Aperte <kbd>F</kbd> para acender a lanterna. A bateria acaba!", "tip", 6e3);
      if (id === "cantil") g.ui.toast("O cantil est\xE1 vazio. Encha no rio, logo ali na praia (chegue na \xE1gua e aperte E).", "tip", 6e3);
      if (id === "marmita") g.ui.toast("Marmita com peixe assado e farinha: 3 por\xE7\xF5es. Tecla <kbd>2</kbd> para comer.", "tip", 4500);
      if (id === "espingarda") g.ui.toast("A espingarda velha: 5 cartuchos. Mirar com <kbd>Q</kbd> ou bot\xE3o direito. Mas tiro faz barulho...", "tip", 5500);
      if (EQUIP.every((e) => g.inv.has(e))) {
        g.complete("prep");
        g.run(async () => {
          await g.say("Caetano", "Paneiro nas costas, espingarda, fac\xE3o, cantil, lanterna e a marmita. T\xE1 tudo aqui.", "caetano");
          await g.say("Caetano", "Seu Raimundo disse que viu o bicho. Vou l\xE1 falar com ele antes de sair.", "caetano");
        }).then(() => {
          g.ui.toast(g.input.lastDevice === "touch" ? '<b>Dica</b> \xB7 "Correr" gasta energia. "Agachar" deixa voc\xEA silencioso.' : "<b>Dica</b> \xB7 <kbd>Shift</kbd> corre (gasta energia). <kbd>C</kbd> agacha e silencia os passos. <kbd>I</kbd> abre o paneiro.", "tip", 7e3);
        });
      }
    }
    async talkRaimundo() {
      const g = this.g, R = "raimundo", C = "caetano";
      if (g.done.has("talk")) {
        await g.run(async () => {
          const lines = [
            "Vai com Deus, meu filho. E n\xE3o esquece de pedir licen\xE7a.",
            "O igarap\xE9 velho fica pro norte. A ponte t\xE1 estragada desde a cheia, fala com o Z\xE9.",
            "Mata de manh\xE3 cedo \xE9 cheia de vida. Escuta mais do que anda."
          ];
          await g.say("Seu Raimundo", lines[(g.time | 0) % lines.length], R);
        });
        return;
      }
      if (!g.done.has("prep")) {
        await g.run(async () => {
          await g.say("Seu Raimundo", "Bom dia, Caetano. Vai sair assim, de m\xE3o abanando? Pega tuas coisas primeiro, rapaz.", R);
        });
        return;
      }
      await g.run(async () => {
        g.camera.targetZoom = 1.2;
        await g.tween(g, "letterbox", 1, 0.5);
        await g.say("Seu Raimundo", "Bom dia, Caetano. Acordaste antes dos galos hoje.", R);
        await g.say("Caetano", "Bom dia, Seu Raimundo. Me disseram que o senhor viu o veado-vermelho.", C);
        await g.say("Seu Raimundo", "Vi sim. Ontem, quase de noitinha. Bicho grande, de pelo bem vermelho. Passou pro rumo do igarap\xE9 velho, depois da trilha do norte.", R);
        await g.say("Seu Raimundo", "Ia pro lado do buritizal antigo. Lugar onde ningu\xE9m mais anda.", R);
        await g.say("Caetano", "Ent\xE3o \xE9 pra l\xE1 que eu vou.", C);
        g.audio.setDuck(0.4, 1);
        await g.wait(0.8);
        await g.say("Seu Raimundo", "Escuta uma coisa, meu filho...", R);
        await g.say("Seu Raimundo", '"Tem bicho que a gente segue. Mas tem bicho que leva a gente para onde n\xE3o devia entrar."', R);
        g.audio.setDuck(1, 2);
        await g.say("Caetano", "O senhor e suas hist\xF3rias... Eu volto antes de a lua encher.", C);
        await g.say("Seu Raimundo", "Ent\xE3o leva isso aqui. Fumo de rolo. E pede licen\xE7a quando entrar na mata.", R);
        g.give("fumo");
        await g.say("Seu Raimundo", "A ponte do igarap\xE9 t\xE1 quebrada desde a cheia. O Z\xE9 sabe onde tem t\xE1bua. Ele t\xE1 l\xE1 no trapiche.", R);
        g.camera.targetZoom = 1;
        await g.tween(g, "letterbox", 0, 0.5);
      });
      g.complete("talk");
      g.checkpoint("Conversa com Seu Raimundo");
    }
    async talkSocorro() {
      const g = this.g, S22 = "socorro", C = "caetano", f = g.flags;
      await g.run(async () => {
        if (!f.socorro) {
          await g.say("Dona Socorro", "\xC9gua, Caetano, j\xE1 de p\xE9? O forno nem esquentou direito.", S22);
          await g.say("Caetano", "Vou atr\xE1s do veado-vermelho, Dona Socorro.", C);
          await g.say("Dona Socorro", "Hum. Ent\xE3o presta aten\xE7\xE3o nos bichos pequenos tamb\xE9m. L\xE1 pra sapopema grande, a leste da trilha, toda madrugada aparece paca comendo fruta ca\xEDda.", S22);
          await g.say("Dona Socorro", "Chega devagarinho, abaixado, e n\xE3o fica com o vento nas costas, que ela sente o cheiro de longe.", S22);
          await g.say("Dona Socorro", "E toma um beiju pra levar. Ningu\xE9m ca\xE7a de barriga vazia.", S22);
          f.socorro = true;
          g.res.food += 1;
          g.audio.play("pickup");
          g.ui.toast("Dona Socorro colocou um beiju na marmita: <b>+1 por\xE7\xE3o</b>.", "tip", 4e3);
        } else {
          await g.say("Dona Socorro", "A sapopema fica a leste da trilha, depois de uma descida. Vai devagar!", S22);
        }
      });
    }
    async talkZe() {
      const g = this.g, Z = "ze", C = "caetano", f = g.flags;
      await g.run(async () => {
        if (!f.zeTalked) {
          await g.say("Z\xE9", "\xCA, Caetano! Vai pro mato? Eu t\xF4 aqui esperando o mapar\xE1 beliscar.", Z);
          await g.say("Caetano", "Vou pro igarap\xE9 velho. Seu Raimundo disse que a ponte quebrou.", C);
          await g.say("Z\xE9", "Quebrou foi nada, a cheia levou metade das t\xE1buas! Leva uma daquelas da pilha do lado da minha casa.", Z);
          await g.say("Z\xE9", "E tem uma canoa velha largada na beira do igarap\xE9, l\xE1 pro poente. Ainda tem t\xE1bua boa nela. Com o fac\xE3o tu solta.", Z);
          await g.say("Z\xE9", "Pra amarrar, cip\xF3-titica. Tem um pendurado numa \xE1rvore grande na beira da trilha, antes do igarap\xE9.", Z);
          f.zeTalked = true;
        } else {
          const lines = ["Tr\xEAs t\xE1buas e um cip\xF3 bom. Amarra bem amarrado, que o igarap\xE9 \xE9 fundo.", "Se vir capivara na praia, nem corre: ela se joga n'\xE1gua na hora.", "O peixe hoje t\xE1 de greve..."];
          await g.say("Z\xE9", lines[(g.time | 0) % lines.length], Z);
        }
      });
    }
    bridgeHint() {
      const g = this.g;
      const t = g.inv.count("tabua"), c = g.inv.has("cipo");
      if (t >= 3 && c) g.ui.toast("Material completo: <b>3 t\xE1buas e cip\xF3</b>. V\xE1 at\xE9 a ponte do igarap\xE9.", "tip", 4500);
    }
    async bridgeAction() {
      const g = this.g, f = g.flags;
      const t = g.inv.count("tabua"), c = g.inv.has("cipo");
      if (t < 3 || !c) {
        f.bridgeSeen = true;
        await g.run(async () => {
          await g.say("Caetano", "A ponte t\xE1 sem v\xE1rias t\xE1buas. Do jeito que t\xE1, eu caio n'\xE1gua.", "caetano");
          await g.say("Caetano", `Preciso de 3 t\xE1buas e um cip\xF3 forte pra amarrar. Tenho ${Math.min(t, 3)} t\xE1bua${t === 1 ? "" : "s"}${c ? " e o cip\xF3" : " e nenhum cip\xF3"}.`, "caetano");
        });
        return;
      }
      await g.run(async () => {
        await g.tween(g, "fade", 1, 0.6);
        g.audio.play("hammer");
        await g.wait(1.9);
        g.inv.remove("tabua", 3);
        g.inv.remove("cipo");
        f.bridge = true;
        await g.tween(g, "fade", 0, 0.6);
        await g.say("Caetano", "Pronto. T\xE1bua encaixada e amarrada com cip\xF3-titica. Agora aguenta.", "caetano");
      });
      g.ui.toast("Ponte consertada. Atravesse para o outro lado.", "mission", 3500);
    }
    async crossedBridge() {
      const g = this.g;
      g.complete("bridge");
      g.checkpoint("Do outro lado do igarap\xE9");
      await g.wait(0.6);
      await g.run(async () => {
        g.audio.setDuck(0.25, 1.2);
        g.audio.setMood("mystery");
        await g.wait(1.2);
        g.audio.play("whistle", { pan: -0.85, dur: 2.8 });
        g.caption("Um assobio longo e agudo, vindo de dentro da mata", -0.85);
        await g.tween(g, "letterbox", 1, 0.6);
        const p = g.player;
        g.camera.follow = null;
        await g.camera.panTo(p.x - 70, p.y - 30, 2);
        await g.wait(1.2);
        await g.say("Caetano", "...", "caetano");
        await g.say("Caetano", "Isso n\xE3o \xE9 passarinho que eu conhe\xE7a.", "caetano");
        g.audio.play("whistle", { pan: -0.4, dur: 1.6, vol: 0.5 });
        g.caption("O assobio de novo, mais distante", -0.4);
        await g.wait(1.8);
        await g.camera.panTo(p.x, p.y - 8, 1.2);
        g.camera.follow = p;
        await g.tween(g, "letterbox", 0, 0.6);
        g.audio.setDuck(1, 3);
      });
      setTimeout(() => g.audio.setMood("calm"), 35e3);
      g.ui.toast("Siga a trilha para o norte e procure sinais do veado.", "tip", 4500);
    }
    async reachTrail() {
      const g = this.g;
      g.complete("trail");
      g.checkpoint("In\xEDcio da trilha");
      await g.run(async () => {
        await g.say("Caetano", "O pano vermelho no esteio. Daqui pra frente \xE9 mata.", "caetano");
        g.player.forceCrouch = true;
        await g.wait(0.5);
        await g.say("Caetano", "Com licen\xE7a, mata. Eu venho s\xF3 de passagem.", "caetano");
        g.player.forceCrouch = false;
      });
      g.ui.toast("<b>Dica</b> \xB7 Os rastros brilham de leve quando voc\xEA chega perto. Examine com <kbd>E</kbd>.", "tip", 6500);
      setTimeout(() => g.state === "play" && g.ui.toast("<b>Dica</b> \xB7 O medidor de <b>Ru\xEDdo</b> no painel mostra quanto barulho voc\xEA faz. Bichos escutam, enxergam e sentem o cheiro levado pelo vento.", "tip", 7500), 7e3);
    }
    async examineTrack(t) {
      const g = this.g;
      await g.run(async () => {
        g.player.forceCrouch = true;
        g.camera.targetZoom = 1.35;
        await g.say("Caetano", t.desc, "caetano");
        let solved = false;
        while (!solved) {
          const i = await g.choice("Que bicho deixou este rastro?", "Escolha com aten\xE7\xE3o:", t.options, "caetano");
          if (i === t.correct) {
            solved = true;
            g.tracksKnown.add(t.id);
            g.audio.play("discover");
            await g.say("Caetano", t.note, "caetano");
          } else {
            g.stats.tracksWrong++;
            g.audio.play("wrong");
            await g.say("Caetano", "N\xE3o... olhando de novo, n\xE3o bate. Repara no formato e no que tem em volta.", "caetano");
          }
        }
        g.camera.targetZoom = 1;
        g.player.forceCrouch = false;
      });
      g.ui.toast(`<b>Caderno de rastros</b> \xB7 ${t.name} anotado (${g.tracksKnown.size}/6)`, "discovery", 3500);
      if (g.tracksKnown.size >= 3) g.complete("tracks");
    }
    async observePaca() {
      const g = this.g, pa = this.paca;
      if (!pa.visible) {
        await g.run(async () => {
          await g.say("Caetano", "Tem um buraco entre as sapopemas e cheiro de bicho. A paca entrou na toca.", "caetano");
          await g.say("Caetano", "Melhor me afastar um pouco, esperar quieto e voltar devagar, agachado.", "caetano");
        });
        return;
      }
      if (pa.aware >= 0.95 || pa.state === "flee") {
        g.ui.toast("A paca percebeu voc\xEA!", "warn", 2e3);
        return;
      }
      await g.run(async () => {
        g.camera.follow = null;
        g.camera.targetZoom = 1.5;
        await g.camera.panTo((pa.x + g.player.x) / 2, (pa.y + g.player.y) / 2 - 6, 1);
        await g.say("Caetano", "L\xE1 est\xE1 ela... pintadinha de branco, roendo um caro\xE7o entre as ra\xEDzes.", "caetano");
        await g.say("Caetano", "Bicho desconfiado. Se ela n\xE3o me viu, \xE9 porque t\xF4 aprendendo.", "caetano");
        g.camera.targetZoom = 1;
        g.camera.follow = g.player;
      });
      g.complete("paca");
      g.checkpoint("A paca da sapopema");
    }
    async deerPrint() {
      const g = this.g;
      await g.run(async () => {
        g.player.forceCrouch = true;
        g.camera.follow = null;
        g.camera.targetZoom = 1.6;
        await g.camera.panTo(DEER_PRINT.x, DEER_PRINT.y - 6, 1.1);
        await g.tween(g, "letterbox", 1, 0.4);
        await g.say("Caetano", "Casco fendido, pontudo, bem fundo na lama...", "caetano");
        await g.say("Caetano", "\xC9 veado-vermelho, sim. E \xE9 grande.", "caetano");
        await g.say("Caetano", "A borda ainda t\xE1 \xFAmida. Passou faz pouco tempo, rumo norte.", "caetano");
        g.camera.targetZoom = 1;
        await g.tween(g, "letterbox", 0, 0.4);
        await g.camera.panTo(g.player.x, g.player.y - 8, 0.8);
        g.camera.follow = g.player;
        g.player.forceCrouch = false;
        await g.say("Caetano", "O sol t\xE1 subindo. Vou armar um acampamento na clareira l\xE1 na frente e seguir o rastro com calma. Preciso de lenha seca.", "caetano");
      });
      g.complete("deer");
      g.checkpoint("Primeira pegada do veado");
    }
    async campAction() {
      const g = this.g, f = g.flags;
      const req = ["prep", "talk", "trail", "tracks", "paca", "bridge", "deer"];
      const missing = this.missions.filter((m) => req.includes(m.id) && !g.done.has(m.id));
      if (missing.length) {
        g.ui.toast(`Antes de armar a rede, ainda falta: <b>${missing.map((m) => m.title.toLowerCase()).join("; ")}</b>.`, "warn", 6500);
        return;
      }
      if (g.inv.count("galhos") < 3) {
        g.ui.toast(`Preciso de 3 feixes de galhos secos para a fogueira (${g.inv.count("galhos")}/3).`, "tip", 4e3);
        return;
      }
      await g.run(async () => {
        await g.tween(g, "fade", 1, 0.7);
        g.audio.play("cut");
        await g.wait(0.6);
        g.audio.play("fire");
        g.inv.remove("galhos", 3);
        f.camp = true;
        this.fireLight.off = false;
        g.audio.setMood("camp");
        await g.wait(0.8);
        await g.tween(g, "fade", 0, 0.8);
        await g.say("Caetano", "Rede armada entre as \xE1rvores, fogo aceso. Daqui eu sigo o rastro.", "caetano");
      });
      g.complete("camp");
      this.finalScene();
    }
    async finalScene() {
      const g = this.g, p = g.player;
      this.finished = true;
      await g.run(async () => {
        await g.tween(g, "letterbox", 1, 0.6);
        await g.say("Caetano", "Pera\xED... ali na beira da clareira.", "caetano");
        await g.moveTo(p, FINAL_PRINT.x - 10, FINAL_PRINT.y + 4, 32);
        p.dir = "right";
        p.forceCrouch = true;
        await g.wait(0.6);
        await g.say("Caetano", "Outra pegada... e essa \xE9 de agora mesmo.", "caetano");
        g.audio.setDuck(0.05, 2.5);
        g.audio.musicOn = false;
        g.caption("A mata fica em sil\xEAncio de repente", 0);
        await g.wait(1.6);
        g.camera.follow = null;
        g.camera.targetZoom = 1.35;
        await g.camera.panTo(EYES.x - 6, EYES.y - 4, 3.2);
        await g.wait(1.4);
        g.audio.play("sting");
        g.audio.play("heart");
        await g.tween(this.eyes, "a", 1, 0.35);
        await g.wait(0.9);
        await g.tween(this.eyes, "a", 0, 0.12);
        await g.wait(0.15);
        await g.tween(this.eyes, "a", 1, 0.12);
        await g.wait(1.1);
        g.audio.play("heart");
        await g.tween(this.eyes, "a", 0, 0.6);
        g.audio.play("rustle", { pan: 0.6 });
        for (let i = 0; i < 14; i++) g.particles.add({ type: "leaf", x: EYES.x + (Math.random() - 0.5) * 16, y: EYES.y + 4, z: 4 + Math.random() * 10, vx: (Math.random() - 0.5) * 30, vy: 4, life: 2.5, seed: Math.random() * 9, color: "#4f7a32" });
        await g.wait(1.4);
        g.audio.play("flap", { pan: 0.5 });
        g.caption("Aves levantam voo de uma vez", 0.5);
        await g.wait(1);
        g.camera.targetZoom = 1.1;
        await g.camera.panTo(p.x, p.y - 8, 1.6);
        p.forceCrouch = false;
        await g.say("Caetano", "...Tem algu\xE9m a\xED?", "caetano");
        await g.wait(1);
        g.audio.musicOn = true;
        g.audio.setDuck(1, 4);
        await g.tween(g, "fade", 1, 2.2);
      });
      this.completePhase();
    }
    completePhase() {
      const g = this.g;
      g.state = "results";
      const used = this.timeLimit - g.timeLeft;
      Save.write({ phase: 1, completed: true, done: [...g.done], tracks: [...g.tracksKnown], found: [...g.inv.found] });
      Save.completePhase(1, { time: used, carry: { inv: g.inv.toJSON(), res: { ...g.res }, tracks: [...g.tracksKnown], found: [...g.inv.found] } });
      g.ui.results([
        ["Tempo da expedi\xE7\xE3o", formatTime(used)],
        ["Rastros identificados", `${g.tracksKnown.size}/6`],
        ["Palpites errados", `${g.stats.tracksWrong}`],
        ["Achados", `${g.inv.found.size}/5`],
        ["Cartuchos usados", `${5 - g.res.ammo}`]
      ]);
    }
    onResume() {
    }
    onAnimalEvent(a, ev) {
      const g = this.g;
      if (ev === "fly") {
        const pan = g.panOf(a.x);
        if (!a._capT || g.time - a._capT > 6) {
          a._capT = g.time;
          g.caption("Jacus levantam voo, assustados", pan);
        }
        for (const o of g.animals) if (o !== a && o.kind === "jacu" && dist(o.x, o.y, a.x, a.y) < 40) o.scare();
      }
      if (a === this.paca && ev === "flee" && !g.done.has("paca")) {
        g.caption("Algo corre entre as folhas e some nas ra\xEDzes", g.panOf(a.x));
        if (!g.flags.pacaFled) {
          g.flags.pacaFled = true;
          g.ui.toast("A paca fugiu para a toca. Afaste-se, espere um pouco e volte agachado, com o vento a favor.", "tip", 6e3);
        }
      }
      if (a.kind === "capivara" && ev === "flee" && !g.flags.capCap) {
        g.flags.capCap = true;
        g.caption("Capivaras se jogam no rio", g.panOf(a.x));
      }
    }
    // ---------------- atualização ----------------
    update(dt) {
      const g = this.g, p = g.player;
      if (!p) return;
      const dk = clamp(g.darkness * 1.6, 0, 1);
      for (const l of this.windowLights || []) l.i = 0.75 * dk;
      if (g.state === "play") {
        const gateClosed = !(g.done.has("prep") && g.done.has("talk"));
        if (gateClosed && p.y < GATE_Y + 14 && g.time > this.gateMsgT) {
          this.gateMsgT = g.time + 6;
          g.ui.toast(!g.done.has("prep") ? 'Caetano: <i>"Ainda n\xE3o peguei minhas coisas."</i>' : 'Caetano: <i>"Antes, quero ouvir o que Seu Raimundo viu."</i>', "tip", 3e3);
        }
        if (!this.finished && g.done.has("bridge") && !g.done.has("deer") && Math.random() < dt / 40) {
          g.audio.play("whistle", { pan: (Math.random() - 0.5) * 1.6, dur: 1.8, vol: 0.35 });
          g.caption("Um assobio distante", 0);
        }
      }
      if (g.flags.camp && Math.random() < dt * 8) g.particles.add({ type: "smoke", x: CAMP.x + (Math.random() - 0.5) * 4, y: CAMP.y - 6, vx: 3, vy: -9, life: 3, seed: Math.random() * 9 });
      if (g.flags.camp && Math.random() < dt * 3) g.particles.add({ type: "spark", x: CAMP.x, y: CAMP.y - 4, vx: (Math.random() - 0.5) * 10, vy: -20, life: 0.8, color: "#ffb040" });
      if (Math.random() < dt * 3) g.particles.add({ type: "smoke", x: FARINHA.x + 10, y: FARINHA.y - 50, vx: 4, vy: -7, life: 4, seed: Math.random() * 9 });
    }
    audioEnv() {
      const g = this.g, p = g.player;
      if (!p) return {};
      const tx = p.x / S;
      const dr = px(shoreY(tx)) - p.y, dc = Math.abs(px(creekY(tx)) - p.y);
      const river = Math.max(clamp(1 - dr / 260, 0, 1), clamp(1 - dc / 140, 0, 1) * 0.55);
      const dk = clamp(g.darkness * 1.4, 0, 1);
      const fire = g.flags.camp ? clamp(1 - dist(p.x, p.y, CAMP.x, CAMP.y) / 140, 0, 1) : 0;
      return { river, riverPan: 0, dawn: clamp(g.darkness * 2, 0, 1), insects: 0.5 + dk * 0.8, frogs: dk * clamp(river * 1.4, 0.2, 1), birds: 1 - dk * 0.5, fire };
    }
    // ---------------- desenho específico ----------------
    drawGround(ctx, V) {
      const g = this.g, f = g.flags, p = g.player, t = g.time;
      const bx = BRIDGE.x, y0 = BRIDGE.y0, y1 = BRIDGE.y1;
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(bx - 12, y0 + 2, 26, y1 - y0);
      for (const [dx, yy] of [[-12, y0], [10, y0], [-12, y1 - 6], [10, y1 - 6], [-12, (y0 + y1) / 2 - 3], [10, (y0 + y1) / 2 - 3]]) {
        ctx.fillStyle = "#3a2614";
        ctx.fillRect(bx + dx, yy, 3, 7);
      }
      ctx.fillStyle = "#5a3e24";
      ctx.fillRect(bx - 11, y0, 2, y1 - y0);
      ctx.fillRect(bx + 9, y0, 2, y1 - y0);
      const n = Math.floor((y1 - y0) / 5);
      for (let i = 0; i < n; i++) {
        const broken = !f.bridge && (i % 3 === 1 || i % 5 === 3 || i > n / 2 - 2 && i < n / 2 + 1);
        if (broken) {
          if (i % 4 === 0) {
            ctx.fillStyle = "#4a3420";
            ctx.fillRect(bx - 9, y0 + i * 5 + 1, 7, 3);
          }
          continue;
        }
        const y = y0 + i * 5;
        ctx.fillStyle = i % 2 ? "#8a6240" : "#9a7048";
        ctx.fillRect(bx - 10, y, 21, 4);
        ctx.fillStyle = "#b08458";
        ctx.fillRect(bx - 10, y, 21, 1);
        ctx.fillStyle = "#3a2a18";
        ctx.fillRect(bx - 10, y + 4, 21, 1);
      }
      if (f.bridge) {
        ctx.fillStyle = "#6a5a2a";
        for (let i = 0; i < n; i += 2) {
          ctx.fillRect(bx - 12, y0 + i * 5 + 1, 2, 2);
          ctx.fillRect(bx + 10, y0 + i * 5 + 1, 2, 2);
        }
      }
      for (const tr of TRACKS) {
        const x = px(tr.at[0]), y = px(tr.at[1]);
        if (x < V.cx - 30 || x > V.cx + V.vw + 30 || y < V.cy - 30 || y > V.cy + V.vh + 30) continue;
        const s = Sprites.get("trk:" + tr.kind, () => trackSprite(tr.kind));
        const known = g.tracksKnown.has(tr.id);
        ctx.globalAlpha = known ? 0.55 : 0.9;
        ctx.drawImage(s, Math.round(x - 14), Math.round(y - 11));
        if (!known && p && dist(x, y, p.x, p.y) < 70 && g.done.has("trail")) {
          const a = 0.25 + 0.25 * Math.sin(t * 3 + x);
          ctx.globalAlpha = a;
          ctx.strokeStyle = "#ffe8a0";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(x, y, 15, 9, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      const ds = Sprites.get("trk:veado", () => trackSprite("veado"));
      ctx.globalAlpha = 0.95;
      ctx.drawImage(ds, Math.round(DEER_PRINT.x - 14), Math.round(DEER_PRINT.y - 11));
      if (g.done.has("deer")) {
        ctx.globalAlpha = 0.6;
        for (let i = 1; i < 6; i++) ctx.drawImage(ds, Math.round(DEER_PRINT.x - 14 - i * 2 + Math.sin(i) * 6), Math.round(DEER_PRINT.y - 11 - i * 22));
        ctx.globalAlpha = 0.95;
        ctx.drawImage(ds, Math.round(FINAL_PRINT.x - 14), Math.round(FINAL_PRINT.y - 11));
      }
      if (!g.done.has("deer") && p && dist(DEER_PRINT.x, DEER_PRINT.y, p.x, p.y) < 80) {
        ctx.globalAlpha = 0.3 + 0.25 * Math.sin(t * 3);
        ctx.strokeStyle = "#ffd666";
        ctx.beginPath();
        ctx.ellipse(DEER_PRINT.x, DEER_PRINT.y, 16, 10, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const ah = this.antHill;
      if (!ah) return;
      ctx.fillStyle = "#6a4a2a";
      ctx.beginPath();
      ctx.ellipse(ah.x, ah.y, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#4a3018";
      ctx.fillRect(ah.x - 1, ah.y - 1, 2, 2);
      ctx.fillStyle = "#120a06";
      for (let i = 0; i < 10; i++) {
        const a = t * 0.8 + i * 0.63;
        ctx.fillRect(Math.round(ah.x + Math.cos(a) * (5 + i % 3 * 3)), Math.round(ah.y + Math.sin(a * 1.3) * (3 + i % 2 * 2)), 1, 1);
      }
    }
    drawCamp(ctx) {
      const g = this.g;
      if (!g.flags.camp) return;
      const a = { x: px(65.4) + 3, y: px(19.2) - 12 }, b = { x: px(70.8) - 3, y: px(19.4) - 12 };
      ctx.strokeStyle = "#d8c8a0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo((a.x + b.x) / 2, a.y + 12, b.x, b.y);
      ctx.stroke();
      const cols = ["#c8322a", "#e8c22a", "#2a8a5a", "#2a5ac8"];
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = cols[i];
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a.x + 10, a.y + 2 + i);
        ctx.quadraticCurveTo((a.x + b.x) / 2, a.y + 14 + i, b.x - 10, b.y + 2 + i);
        ctx.stroke();
      }
      const fr = this.fireFrames[Math.floor(g.time * 9) % 4];
      ctx.drawImage(fr, Math.round(CAMP.x - 9), Math.round(CAMP.y - 12));
      const ic = Sprites.get("icon:paneiro", () => iconSprite("paneiro"));
      ctx.drawImage(ic, Math.round(CAMP.x + 14), Math.round(CAMP.y - 8));
    }
    drawWorldOverlay(ctx, V) {
      const g = this.g;
      const a = clamp((g.darkness - 0.08) * 1.3, 0, 0.6);
      if (a <= 0.01) return;
      const t = g.time;
      for (const m of this.mist) {
        const x = m.x + t * m.sp % 200 - 100;
        if (x < V.cx - 120 || x > V.cx + V.vw + 120 || m.y < V.cy - 40 || m.y > V.cy + V.vh + 40) continue;
        ctx.globalAlpha = a * 0.45;
        ctx.drawImage(this.mistSprite, x - 32 * m.s, m.y - 14 * m.s, 64 * m.s, 28 * m.s);
      }
      ctx.globalAlpha = 1;
    }
    drawAfterLight(ctx) {
      const e = this.eyes;
      if (!e || e.a <= 0) return;
      const g = this.g;
      ctx.globalCompositeOperation = "lighter";
      for (const dx of [-3, 3]) {
        const x = EYES.x + dx, y = EYES.y;
        const grd = ctx.createRadialGradient(x, y, 0, x, y, 8);
        grd.addColorStop(0, `rgba(230,255,140,${0.5 * e.a})`);
        grd.addColorStop(1, "rgba(230,255,140,0)");
        ctx.fillStyle = grd;
        ctx.fillRect(x - 8, y - 8, 16, 16);
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = e.a;
      ctx.fillStyle = "#f4ffb0";
      ctx.fillRect(EYES.x - 4, EYES.y, 2, 1);
      ctx.fillRect(EYES.x + 2, EYES.y, 2, 1);
      ctx.globalAlpha = 1;
      void g;
    }
  };

  // js/gfx/art-forest2.js
  var OUT = "#120c07";
  var BARK = ["#36281a", "#4e3a28", "#6a523a", "#8a6e4e"];
  function logSprite(seed, len, r = 5, mossy = true) {
    const W = Math.ceil(len + 6), H = Math.ceil(r * 2 + 6);
    const b = new PixBuf(W, H);
    const rng = mulberry32(seed);
    const cy = H / 2 + 1;
    for (let x = 3; x < len + 1; x++) {
      const rr = r - x / len * 0.8;
      for (let y = -rr; y <= rr; y++) {
        const t = (y + rr) / (2 * rr);
        let i = t < 0.25 ? 3 : t < 0.6 ? 2 : t < 0.85 ? 1 : 0;
        if (hash2(x >> 1, y + 9 | 0, seed) < 0.13) i = Math.max(0, i - 1);
        b.px(x, cy + y, BARK[i]);
      }
    }
    for (const ex of [2, len + 1]) {
      b.blob(ex, cy, 2.2, r, "#7a5e40");
      b.blob(ex, cy, 1.2, r * 0.55, "#a8865a");
      b.px(ex, cy, "#5a4430");
    }
    if (mossy) for (let i = 0; i < len / 4; i++) b.mpx(4 + rng() * (len - 6), cy - r + rng() * 2.2, rng() < 0.6 ? "#4f7a32" : "#6a9a42");
    for (let i = 0; i < len / 22; i++) {
      const x = 8 + rng() * (len - 14);
      b.rect(x | 0, cy + r * 0.3 | 0, 3, 1, "#d8b070");
    }
    b.outline(OUT);
    return b.toCanvas();
  }
  function logVertSprite(seed, len, r = 6) {
    const W = Math.ceil(r * 2 + 6), H = Math.ceil(len + 4);
    const b = new PixBuf(W, H);
    const cx = W / 2;
    for (let y = 2; y < len + 2; y++) for (let x = -r; x <= r; x++) {
      const t = (x + r) / (2 * r);
      let i = t < 0.22 ? 3 : t < 0.55 ? 2 : t < 0.82 ? 1 : 0;
      if (hash2(x + 9 | 0, y >> 1, seed) < 0.12) i = Math.max(0, i - 1);
      b.px(cx + x, y, BARK[i]);
    }
    for (let y = 4; y < len; y += 9) b.mpx(cx - r + 2 + y * 7 % 4, y, "#4f7a32");
    b.rect(cx - 2, 2, 5, 1, "#a8865a");
    b.outline(OUT);
    return b.toCanvas();
  }
  function rootSprite(seed, w = 30) {
    const b = new PixBuf(w + 4, 12);
    const rng = mulberry32(seed);
    for (let x = 1; x < w + 2; x++) {
      const k = (x - 1) / w;
      const h = Math.sin(k * Math.PI) * 6 + 2;
      for (let y = 0; y < 3; y++) b.px(x, 10 - h + y, y === 0 ? "#7a5e40" : y === 1 ? "#5e4630" : "#3e2e1e");
    }
    for (let i = 0; i < 4; i++) b.mpx(3 + rng() * (w - 4), 3 + rng() * 5, "#5a7a3a");
    b.outline(OUT);
    return b.toCanvas();
  }
  function toroSprite() {
    const b = new PixBuf(24, 14);
    for (let x = 4; x < 20; x++) for (let y = -4; y <= 4; y++) {
      const t = (y + 4) / 8;
      b.px(x, 7 + y, BARK[t < 0.25 ? 3 : t < 0.6 ? 2 : t < 0.85 ? 1 : 0]);
    }
    b.blob(4, 7, 2, 4.2, "#8a6e4e");
    b.blob(4, 7, 1, 2.4, "#b8966a");
    b.px(4, 7, "#6a523a");
    b.blob(20, 7, 2, 4.2, "#7a5e40");
    b.rect(9, 9, 6, 1, "#3e2e1e");
    b.outline(OUT);
    return b.toCanvas();
  }
  function poleSprite() {
    const b = new PixBuf(30, 6);
    b.line(1, 4, 28, 1, "#7a5a38");
    b.line(1, 5, 28, 2, "#4e3a24");
    b.px(28, 1, "#c8a46a");
    b.outline(OUT);
    return b.toCanvas();
  }
  function tangleSprite(seed) {
    const b = new PixBuf(36, 22);
    const rng = mulberry32(seed);
    for (let i = 0; i < 16; i++) {
      const x0 = 2 + rng() * 30, y0 = 6 + rng() * 14, a = rng() * Math.PI;
      const L = 8 + rng() * 14;
      b.line(x0, y0, x0 + Math.cos(a) * L, y0 - Math.abs(Math.sin(a)) * L * 0.6, i % 3 ? "#6a4a2e" : "#8a6a44");
    }
    for (let i = 0; i < 26; i++) b.px(3 + rng() * 30, 3 + rng() * 16, rng() < 0.5 ? "#4f7a32" : "#6a8a3a");
    for (let i = 0; i < 5; i++) b.px(4 + rng() * 28, 4 + rng() * 14, "#a87a3a");
    b.outline(OUT);
    return b.toCanvas();
  }
  function stepsSprite() {
    const b = new PixBuf(44, 20);
    const pal = ["#4a4840", "#626056", "#7c786c", "#969080"];
    for (let i = 0; i < 3; i++) {
      const y = 14 - i * 5, x0 = 4 + i * 2, w = 36 - i * 4;
      b.rect(x0, y, w, 5, pal[1 + i % 2]);
      b.rect(x0, y, w, 1, pal[3]);
      b.rect(x0, y + 4, w, 1, pal[0]);
      for (let k = 0; k < 4; k++) b.px(x0 + 3 + k * 9 + i * 3 % 5, y + 2, pal[0]);
    }
    b.mpx(8, 12, "#5a7a3a");
    b.mpx(30, 7, "#5a7a3a");
    b.outline("#141412");
    return b.toCanvas();
  }
  var DRY = ["#2a2010", "#3e3018", "#584422", "#74592c", "#8e7036", "#a88842"];
  function fruitPile() {
    const b = new PixBuf(14, 8);
    for (let i = 0; i < 7; i++) {
      const x = 2 + i * 5 % 10, y = 3 + i % 3;
      b.blob(x, y, 1.6, 1.4, i % 2 ? "#7a3a1a" : "#8e4a22");
      b.px(x, y - 1, "#c07a3a");
    }
    b.outline(OUT);
    return b.toCanvas();
  }
  function icon2(id) {
    const b = new PixBuf(16, 16);
    if (id === "vara") {
      b.line(2, 14, 13, 1, "#7a5a38");
      b.line(3, 14, 14, 1, "#4e3a24");
      b.px(13, 1, "#c8a46a");
    } else if (id === "pelos") {
      for (let i = 0; i < 9; i++) b.line(4 + i, 12 - i % 3, 6 + i, 4 + i % 4, i % 2 ? "#b8442a" : "#d8643a");
      b.rect(3, 12, 10, 2, "#3a5a2a");
    }
    b.outline(OUT);
    return b.toCanvas();
  }

  // js/gfx/art-peccary.js
  var OUT2 = "#0e0a08";
  var PECCARY_PALS = [
    ["#18130f", "#241c16", "#33291f", "#43372b"],
    ["#1e150e", "#2e2117", "#3f2f22", "#544030"],
    ["#1a1917", "#282523", "#383430", "#4b4640"]
  ];
  var JUV_PAL = ["#3e2414", "#5a361e", "#7a4c2c", "#9a663c"];
  function peccarySide(o) {
    const juv = !!o.juv;
    const k = juv ? 0.72 : 1;
    const W = juv ? 18 : 25, H = juv ? 12 : 16;
    const b = new PixBuf(W, H);
    const pal = juv ? JUV_PAL : PECCARY_PALS[o.pal % PECCARY_PALS.length];
    const f = o.frame | 0, run = o.gait === "run", walk = o.gait === "walk";
    const X = (v) => v * k, Y = (v) => v * k;
    const lift = run && (f === 0 || f === 2) ? -1 : walk && (f === 1 || f === 3) ? -1 * (juv ? 0 : 1) * 0 : 0;
    const ground = H - 1;
    const legTop = Y(10.5) + lift;
    const legs = [
      { x: X(5), far: true },
      { x: X(7), far: false },
      // traseiras
      { x: X(16), far: true },
      { x: X(18), far: false }
      // dianteiras
    ];
    let off;
    if (run) off = [[-2, -1, 2, 1], [0, 0, 0, 0], [2, 1, -2, -1], [0, 0, 0, 0]][f % 4];
    else if (walk) off = [[1, -1, -1, 1], [0, 0, 0, 0], [-1, 1, 1, -1], [0, 0, 0, 0]][f % 4];
    else off = [0, 0, 0, 0];
    legs.forEach((L, i) => {
      const col = L.far ? "#0c0908" : "#1c1612";
      const x0 = Math.round(L.x), x1 = Math.round(L.x + off[i]);
      const top = Math.round(legTop), h = ground - top;
      for (let y = 0; y < h; y++) {
        const xx = Math.round(x0 + (x1 - x0) * (y / Math.max(1, h - 1)));
        b.px(xx, top + y, col);
      }
      b.px(x1, ground, "#3a322c");
    });
    const cy = Y(7.6) + lift;
    b.shaded(X(6.2), cy + Y(0.3), X(4), Y(3.3), pal, 11 + o.pal);
    b.shaded(X(10.5), cy + Y(0.5), X(5.5), Y(3.4), pal, 12 + o.pal);
    b.shaded(X(14.6), cy - Y(0.7), X(4.2), Y(3.6), pal, 13 + o.pal);
    for (let i = 0; i < (juv ? 6 : 16); i++) {
      const x = X(3 + hash2(i, 1, o.pal + 3) * 15), y = cy - Y(2.5) + hash2(i, 2, o.pal + 3) * Y(4.5);
      b.mpx(x, y, juv ? "#b8804e" : "#74685a");
    }
    if (juv) for (let x = Math.round(X(4)); x < X(16); x += 2) b.mpx(x, Math.round(cy), "#c89060");
    for (let x = Math.round(X(7)); x <= Math.round(X(17)); x++) {
      const top = Math.round(cy - Y(3.4) - (x > X(11) && x < X(16.5) ? Y(0.9) : 0));
      b.px(x, top, "#0a0807");
      if (o.bristle) {
        if (x % 2 === 0) {
          b.px(x, top - 1, "#141010");
          b.px(x, top - 2, "#5a5046");
        } else b.px(x, top - 1, "#3a342e");
      }
    }
    b.px(Math.round(X(2)), Math.round(cy - Y(0.8)), pal[1]);
    b.px(Math.round(X(1.5)), Math.round(cy - Y(0.2)), pal[0]);
    const hd = o.head;
    const hx = X(19.2), hy = hd === "down" ? cy + Y(2.4) : hd === "up" ? cy - Y(1.6) : cy + Y(0.6);
    b.shaded(hx, hy, X(3.4), Y(2.7), pal, 14 + o.pal);
    const dir = hd === "down" ? [0.55, 0.85] : hd === "up" ? [0.95, -0.3] : [1, 0.18];
    const sl = juv ? 2.5 : 4;
    let sx = hx + X(2.2), sy = hy + Y(0.4);
    for (let t = 0; t <= sl; t += 0.5) {
      const x = Math.round(sx + dir[0] * t), y = Math.round(sy + dir[1] * t);
      b.px(x, y, pal[1]);
      b.px(x, y + 1, pal[0]);
      if (t < sl * 0.5) b.px(x, y - 1, pal[2]);
    }
    const nx = Math.round(sx + dir[0] * sl + 0.5), ny = Math.round(sy + dir[1] * sl);
    b.px(nx, ny, "#8e706a");
    b.px(nx, ny + 1, "#6e524c");
    if (!juv) {
      for (let t = -1.2; t <= 2.2; t += 0.5) {
        const x = Math.round(hx + t), y = Math.round(hy + Y(2.2) + (hd === "down" ? t * 0.55 : hd === "up" ? -t * 0.15 : t * 0.1));
        b.px(x, y, t < 0 ? "#cfc8b8" : "#ece6d8");
      }
    } else b.px(Math.round(hx), Math.round(hy + 2), "#d8c8b0");
    if (o.mouth) {
      const mx = Math.round(hx + X(1.5)), my = Math.round(hy + Y(1.4));
      b.px(mx, my, "#4a1612");
      b.px(mx + 1, my, "#4a1612");
      b.px(mx + 1, my + 1, "#f4f0e0");
      b.px(mx, my - 1, "#f4f0e0");
    }
    b.px(Math.round(hx - X(1.8)), Math.round(hy - Y(2.8)), pal[2]);
    b.px(Math.round(hx - X(1.2)), Math.round(hy - Y(3.3)), pal[1]);
    b.px(Math.round(hx - X(0.8)), Math.round(hy - Y(2.7)), pal[1]);
    b.px(Math.round(hx + X(0.6)), Math.round(hy - Y(0.9)), "#050403");
    b.outline(OUT2);
    return b.toCanvas();
  }
  function peccaryFront(o) {
    const juv = !!o.juv, k = juv ? 0.72 : 1;
    const W = juv ? 12 : 16, H = juv ? 12 : 16;
    const b = new PixBuf(W, H);
    const pal = juv ? JUV_PAL : PECCARY_PALS[o.pal % PECCARY_PALS.length];
    const cx = W / 2 - 0.5, f = o.frame | 0, ground = H - 1;
    const step = f % 2;
    for (const [lx, ph] of [[-3, 0], [-1.2, 1], [1.2, 0], [3, 1]]) {
      const x = Math.round(cx + lx * k), top = Math.round(ground - (juv ? 3 : 4) + (ph === step ? 0 : 1));
      for (let y = top; y < ground; y++) b.px(x, y, Math.abs(lx) > 2 ? "#1c1612" : "#0c0908");
      b.px(x, ground, "#3a322c");
    }
    if (o.back) {
      b.shaded(cx, H / 2 - 0.2, 5.6 * k, 5 * k, pal, 21 + o.pal);
      for (let y = Math.round(H / 2 - 5 * k); y < H / 2 + 2 * k; y++) b.px(Math.round(cx), y, "#0a0807");
      if (o.bristle) for (let y = Math.round(H / 2 - 5 * k); y < H / 2 + 1; y += 2) {
        b.px(Math.round(cx) - 1, y, "#5a5046");
        b.px(Math.round(cx) + 1, y + 1, "#5a5046");
      }
      b.px(Math.round(cx), Math.round(H / 2 + 4.6 * k), pal[0]);
      b.px(Math.round(cx - 3.6 * k), Math.round(H / 2 - 5.2 * k), pal[2]);
      b.px(Math.round(cx + 3.6 * k), Math.round(H / 2 - 5.2 * k), pal[2]);
    } else {
      b.shaded(cx, H / 2 - 1.6 * k, 5.6 * k, 4 * k, pal, 22 + o.pal);
      if (o.bristle) for (let x = -3; x <= 3; x++) b.px(Math.round(cx + x * k), Math.round(H / 2 - 5.6 * k) - (x % 2 ? 0 : 1), "#5a5046");
      const hy = H / 2 + (o.head === "down" ? 1.6 : o.head === "up" ? -0.6 : 0.6) * k;
      b.shaded(cx, hy, 3.4 * k, 3 * k, pal, 23 + o.pal);
      b.px(Math.round(cx - 3.6 * k), Math.round(hy - 3 * k), pal[2]);
      b.px(Math.round(cx + 3.6 * k), Math.round(hy - 3 * k), pal[2]);
      b.px(Math.round(cx - 1.6 * k), Math.round(hy - 1 * k), "#050403");
      b.px(Math.round(cx + 1.6 * k), Math.round(hy - 1 * k), "#050403");
      b.rect(Math.round(cx - 0.5), Math.round(hy + 0.4 * k), 2, Math.round(2 * k), pal[1]);
      b.rect(Math.round(cx - 0.5), Math.round(hy + 2 * k), 2, 1, "#8e706a");
      if (!juv) {
        for (const dx of [-2.4, -1.6, 1.6, 2.4]) b.px(Math.round(cx + dx), Math.round(hy + 1.8), "#ece6d8");
        b.px(Math.round(cx - 1), Math.round(hy + 2.8), "#ece6d8");
        b.px(Math.round(cx + 1), Math.round(hy + 2.8), "#ece6d8");
      }
      if (o.mouth) {
        b.px(Math.round(cx - 1.4), Math.round(hy + 2.2), "#f4f0e0");
        b.px(Math.round(cx + 1.4), Math.round(hy + 2.2), "#f4f0e0");
      }
    }
    b.outline(OUT2);
    return b.toCanvas();
  }
  function tapirSprite(frame, head = "mid") {
    const b = new PixBuf(34, 20);
    const pal = ["#221d1a", "#332c27", "#463c35", "#5a4e45"];
    const f = frame % 4;
    const off = [[1, -1, -1, 1], [0, 0, 0, 0], [-1, 1, 1, -1], [0, 0, 0, 0]][f];
    [5, 9, 19, 23].forEach((x, i) => {
      b.rect(x + off[i], 13, 2, 5, i % 2 ? "#1a1512" : "#241e1a");
      b.rect(x + off[i], 17, 2, 1, "#3a3430");
    });
    b.shaded(14, 10, 11, 6, pal, 91);
    b.shaded(9, 9.5, 6.5, 6, pal, 92);
    const hy = head === "down" ? 13 : 9;
    b.shaded(26, hy, 4.5, 3.6, pal, 93);
    for (let k = 0; k < 4; k++) b.px(30 + k, hy + 1 + (head === "down" ? k * 0.7 : k * 0.3), pal[1]);
    b.px(33, hy + (head === "down" ? 4 : 2), "#5a4a44");
    for (let x = 20; x < 27; x++) b.px(x, hy - 4 + (x > 24 ? 1 : 0), "#120e0c");
    b.px(23, hy - 4, "#e8e2d8");
    b.px(23, hy - 5, "#3a322c");
    b.px(24, hy - 5, "#e8e2d8");
    b.px(27, hy - 1, "#050403");
    b.outline(OUT2);
    return b.toCanvas();
  }

  // js/ai/flowfield.js
  var N8 = [[1, 0, 10], [-1, 0, 10], [0, 1, 10], [0, -1, 10], [1, 1, 14], [1, -1, 14], [-1, 1, 14], [-1, -1, 14]];
  function circleBlocked(world, x, y, r) {
    for (const c of world.near(x, y)) {
      if (c.off || !c.r) continue;
      const dx = x - c.x, dy = (y - c.y) * 1.2, m = r + c.r;
      if (dx * dx + dy * dy < m * m) return true;
    }
    return false;
  }
  var FlowField = class {
    constructor(world, { cell = 8, agentR = 4, blocked = null, maxCells = 9e3 } = {}) {
      this.w = world;
      this.cell = cell;
      this.agentR = agentR;
      this.blocked = blocked;
      this.maxCells = maxCells;
      this.cols = Math.ceil(world.W / cell);
      this.rows = Math.ceil(world.H / cell);
      const n = this.cols * this.rows;
      this.mask = new Uint8Array(n);
      this.dist = new Uint32Array(n).fill(4294967295);
      this.touched = [];
      this.tx = -1;
      this.ty = -1;
      this.t = -1e9;
    }
    invalidate() {
      this.mask.fill(0);
      this.tx = this.ty = -1;
    }
    free(i) {
      let m = this.mask[i];
      if (!m) {
        const cx = i % this.cols * this.cell + this.cell / 2, cy = (i / this.cols | 0) * this.cell + this.cell / 2;
        const r = this.agentR;
        const bad = this.w.hit(cx, cy, r) || circleBlocked(this.w, cx, cy, r) || this.blocked && this.blocked(cx, cy);
        m = this.mask[i] = bad ? 2 : 1;
      }
      return m === 1;
    }
    cellOf(x, y) {
      const cx = Math.floor(x / this.cell), cy = Math.floor(y / this.cell);
      if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return -1;
      return cy * this.cols + cx;
    }
    // recalcula as distâncias a partir do alvo (ex.: o jogador). Barato: limitado a maxCells.
    compute(x, y, now = 0, minInterval = 0.25) {
      let start = this.cellOf(x, y);
      if (start < 0) return false;
      if (start === this.tCell && now - this.t < 2) return true;
      if (now - this.t < minInterval && this.tCell >= 0) return true;
      if (!this.free(start)) {
        const sc = start % this.cols, sr = start / this.cols | 0;
        let found = -1;
        for (let rad = 1; rad <= 3 && found < 0; rad++)
          for (let j = -rad; j <= rad && found < 0; j++) for (let i = -rad; i <= rad; i++) {
            const c = sc + i, r = sr + j;
            if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
            const k = r * this.cols + c;
            if (this.free(k)) {
              found = k;
              break;
            }
          }
        if (found < 0) return false;
        start = found;
      }
      for (const i of this.touched) this.dist[i] = 4294967295;
      this.touched.length = 0;
      const buckets = /* @__PURE__ */ new Map();
      const push = (i, d2) => {
        let b = buckets.get(d2);
        if (!b) buckets.set(d2, b = []);
        b.push(i);
      };
      this.dist[start] = 0;
      this.touched.push(start);
      push(start, 0);
      let d = 0, count = 0, pending = 1;
      const cols = this.cols, rows = this.rows;
      while (pending > 0 && count < this.maxCells) {
        const b = buckets.get(d);
        if (!b || !b.length) {
          buckets.delete(d);
          d++;
          continue;
        }
        const i = b.pop();
        pending--;
        if (this.dist[i] !== d) continue;
        count++;
        const c = i % cols, r = i / cols | 0;
        for (const [dx, dy, cost] of N8) {
          const nc = c + dx, nr = r + dy;
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
          const k = nr * cols + nc;
          if (!this.free(k)) continue;
          if (dx && dy && (!this.free(r * cols + nc) || !this.free(nr * cols + c))) continue;
          const nd = d + cost;
          if (nd < this.dist[k]) {
            if (this.dist[k] === 4294967295) this.touched.push(k);
            this.dist[k] = nd;
            push(k, nd);
            pending++;
          }
        }
      }
      this.tCell = this.cellOf(x, y);
      this.t = now;
      return true;
    }
    distAt(x, y) {
      const i = this.cellOf(x, y);
      return i < 0 ? Infinity : this.dist[i] === 4294967295 ? Infinity : this.dist[i];
    }
    // direção (unitária) para descer o campo a partir de (x, y); null se fora do alcance
    dirAt(x, y) {
      const i = this.cellOf(x, y);
      if (i < 0) return null;
      const cols = this.cols, c = i % cols, r = i / cols | 0;
      let here = this.dist[i];
      let best = -1, bd = here;
      for (const [dx, dy] of N8) {
        const nc = c + dx, nr = r + dy;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= this.rows) continue;
        const k = nr * cols + nc;
        if (this.dist[k] < bd) {
          bd = this.dist[k];
          best = k;
        }
      }
      if (best < 0) return here === 0 ? { x: 0, y: 0, arrived: true } : null;
      const tx = best % cols * this.cell + this.cell / 2, ty = (best / cols | 0) * this.cell + this.cell / 2;
      const vx = tx - x, vy = ty - y, m = Math.hypot(vx, vy) || 1;
      return { x: vx / m, y: vy / m, arrived: false };
    }
  };

  // js/ai/peccary.js
  var S2 = {
    IDLE: "IDLE",
    FORAGING: "FORAGING",
    WALKING: "WALKING",
    ALERT: "ALERT",
    INVESTIGATE: "INVESTIGATE",
    DEFENSIVE: "DEFENSIVE",
    CHASE: "CHASE",
    RETURN: "RETURN"
  };
  var CALM = /* @__PURE__ */ new Set([S2.IDLE, S2.FORAGING, S2.WALKING]);
  var isCalm = (st) => CALM.has(st);
  var TUNE = {
    sightRange: 88,
    fovCalm: 1.05,
    fovAlert: 1.55,
    closeSense: 20,
    hearing: 0.95,
    smellRange: 105,
    walkSpeed: 19,
    forageSpeed: 6,
    investigateSpeed: 25,
    chaseSpeed: 76,
    returnSpeed: 32,
    alertAt: 0.3,
    investigateAt: 0.62,
    defensiveAt: 1,
    separation: 10,
    minGap: 6.5,
    biteRange: 11,
    biteDamage: 9,
    biteCooldown: 1.25,
    threatRange: 82,
    lostSight: 3.4,
    callRadius: 130,
    callDelay: 0.22,
    callSpeed: 140
  };
  var rnd = Math.random;
  var Peccary = class {
    constructor(herd, x, y, o = {}) {
      const R = o.rng || rnd;
      this.herd = herd;
      this.g = herd.g;
      this.x = x;
      this.y = y;
      this.kind = "queixada";
      this.visible = true;
      this.juv = !!o.juv;
      this.r = this.juv ? 3 : 4;
      this.pers = {
        bold: (this.juv ? 0.45 : 0.78) + R() * 0.45,
        wary: 0.85 + R() * 0.3,
        spd: 0.92 + R() * 0.16,
        pal: R() * 3 | 0,
        sentinel: !!o.sentinel,
        ph: R() * 10
      };
      this.slot = o.slot || { x: (R() - 0.5) * 56, y: (R() - 0.5) * 36 };
      this.heading = R() * TAU;
      this.speed = 0;
      this.face = Math.cos(this.heading) >= 0 ? 1 : -1;
      this.state = S2.IDLE;
      this.prevCalm = S2.FORAGING;
      this.stateT = 0;
      this.timer = 1 + R() * 3;
      this.aware = 0;
      this.stim = null;
      this.lastSeen = null;
      this.lastPerceivedT = -99;
      this.alertCause = null;
      this.reason = null;
      this.perc = null;
      this.anim = R() * 4;
      this.frame = 0;
      this.head = "mid";
      this.mouth = false;
      this.bristle = false;
      this.callCd = 0;
      this.biteCd = 0;
      this.recoilT = 0;
      this.stuckT = 0;
      this.sideStep = null;
      this.clackT = 0;
      this.gruntT = 2 + R() * 9;
      this.turnT = 0;
      this.losT = R() * 0.1;
      this.losOk = false;
      this.target = null;
      this.foodT = 0;
      this.behavior = null;
      this.standoffT = 0;
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
          if (c.r) {
            if (c.r >= 2.5 && (x - c.x) ** 2 + (y - c.y) ** 2 < c.r * c.r) return false;
          } else if (c.occ && (!c.low || crouched) && x >= c.x && y >= c.y && x <= c.x + c.w && y <= c.y + c.h) return false;
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
      const nr = p.noiseRadius() * TUNE.hearing * this.pers.wary;
      if (nr > 0 && d < nr) {
        const k = 1 - d / nr;
        out.heard = k;
        out.rate += 1.7 * k + 0.25;
      }
      const range = TUNE.sightRange * p.vis * (alerted ? 1.25 : 1) * (this.head === "down" ? 0.7 : 1);
      if (d < range) {
        const ang = Math.atan2(p.y - this.y, p.x - this.x);
        const fov = this.state === S2.CHASE ? Math.PI : alerted || this.head === "up" ? TUNE.fovAlert : TUNE.fovCalm;
        if (Math.abs(angleDiff(this.heading, ang)) < fov) {
          this.losT -= dt;
          if (this.losT <= 0) {
            this.losT = 0.12;
            this.losOk = this.los(this.x, this.y - 4, p.x, p.y - 6);
          }
          if (this.losOk) {
            out.seen = true;
            out.rate += 1.5 * (1 - d / range) + 0.35;
          }
        }
      }
      if (d < TUNE.closeSense * (p.vis < 0.3 ? 0.6 : 1)) {
        out.seen = true;
        out.rate += 1.6;
      }
      if (d < TUNE.smellRange * (this.herd.smellMul || 1) && g.isDownwind(p, this)) {
        out.smelled = true;
        out.rate += 0.32 * (1 - d / (TUNE.smellRange * (this.herd.smellMul || 1))) + 0.08;
      }
      return out;
    }
    reasonText(pc) {
      const p = this.g.player;
      if (pc.seen) return { key: "viu", text: p.running ? "Um queixada <b>viu</b> voc\xEA correndo \xE0 vista." : p.sneak ? "Um queixada <b>viu</b> voc\xEA: mesmo agachado, estava perto demais e sem nada na frente." : "Um queixada <b>viu</b> voc\xEA em p\xE9, se mexendo \xE0 vista. Agache e use troncos, pedras e moitas para quebrar a linha de vis\xE3o." };
      if (pc.heard) return { key: "ouviu", text: `Um queixada <b>ouviu</b> voc\xEA: ru\xEDdo ${p.running ? "ALTO (correndo)" : p.noiseSpike > 0.5 ? "ALTO (galho seco, moita ou esbarr\xE3o)" : "M\xC9DIO (andando em p\xE9)"}. Agachado (C) o ru\xEDdo fica BAIXO.` };
      if (pc.smelled) return { key: "farejou", text: "Um queixada <b>farejou</b> voc\xEA: o vento estava levando o seu cheiro para o bando. Veja a seta de VENTO no minimapa." };
      return { key: "percebeu", text: "Um queixada percebeu sua presen\xE7a." };
    }
    // ---------------- estímulos externos ----------------
    hear(x, y, level, kind) {
      if (this.state === S2.CHASE || this.state === S2.DEFENSIVE) return;
      this.stim = { x, y, kind, level, t: this.g.time };
      if (kind === "shot") this.aware = Math.max(this.aware, 0.9);
      if (CALM.has(this.state) || this.state === S2.RETURN) {
        this.prevCalm = CALM.has(this.state) ? this.state : S2.FORAGING;
        this.alertCause = kind === "player" ? "player" : "noise";
        this.enter(S2.ALERT);
      } else if (this.state === S2.ALERT || this.state === S2.INVESTIGATE) {
        if (kind !== "player" && this.alertCause !== "player") this.alertCause = "noise";
        this.timer = Math.max(this.timer, 0.6);
      }
    }
    receiveCall(c) {
      if (this.state === S2.CHASE) return;
      const lvl = c.level;
      this.stim = { x: c.sx, y: c.sy, kind: "call", level: lvl, t: this.g.time };
      if (c.cause === "player") this.alertCause = "player";
      if (lvl >= 2) {
        const d = dist(this.x, this.y, c.sx, c.sy);
        this.aware = Math.max(this.aware, 0.85);
        this.viaCall = true;
        if (this.pers.bold > 1 && !this.juv && d < 120 && c.cause === "player" && this.herd.counts().chase < this.herd.maxChasers && !this.herd.playerSafe()) {
          this.lastSeen = { x: c.sx, y: c.sy };
          this.lastPerceivedT = this.g.time;
          this.enter(S2.CHASE);
          return;
        }
        if (this.state !== S2.DEFENSIVE) this.enter(S2.DEFENSIVE);
      } else if (lvl >= 1) {
        this.aware = Math.max(this.aware, c.cause === "player" ? 0.66 : 0.4);
        if (CALM.has(this.state) || this.state === S2.RETURN) {
          this.prevCalm = CALM.has(this.state) ? this.state : S2.FORAGING;
          this.enter(S2.ALERT);
        }
      }
    }
    scare() {
      const p = this.g.player;
      this.herd.hearNoise(p.x, p.y, 3, "shot");
    }
    // ---------------- máquina de estados ----------------
    enter(st) {
      const prev = this.state;
      this.state = st;
      this.stateT = 0;
      this.sideStep = null;
      this.sniffT = 0;
      this.noiseClacked = false;
      const R = rnd;
      switch (st) {
        case S2.IDLE:
          this.timer = 1.5 + R() * 3;
          break;
        case S2.FORAGING:
          this.timer = 4 + R() * 7;
          this.target = this.herd.calmPoint(this);
          break;
        case S2.WALKING:
          this.timer = 8;
          break;
        case S2.ALERT:
          this.timer = 1.1 + R() * 1.1 / this.pers.bold;
          this.speed *= 0.3;
          if (this.callCd <= 0 && this.alertCause === "player") this.vocal("grunt");
          break;
        case S2.INVESTIGATE:
          this.timer = 7;
          break;
        case S2.DEFENSIVE:
          this.timer = 0.75 + R() * 0.6 / this.pers.bold;
          this.clackT = 0;
          this.bristle = true;
          this.herd.emit(this, this.alertCause === "player" && !this.viaCall ? 2 : 1);
          if (this.alertCause === "player") this.herd.detected(this);
          break;
        case S2.CHASE:
          this.bristle = true;
          this.timer = 0;
          if (!this.viaCall) this.herd.emit(this, 2);
          this.herd.chaseStarted(this);
          if (prev !== S2.CHASE) this.vocal("grunt", 1.4);
          break;
        case S2.RETURN:
          this.timer = 22;
          this.bristle = false;
          this.mouth = false;
          this.aware = Math.min(this.aware, 0.5);
          break;
      }
      if (CALM.has(st)) {
        this.bristle = false;
        this.mouth = false;
        this.alertCause = null;
        this.viaCall = false;
      }
    }
    vocal(kind, vol = 1) {
      if (kind === "clack") this.herd.sfx("clack", this.x, this.y, 0.9 * vol);
      else if (kind === "grunt") this.herd.sfx(this.juv ? "squeal" : "grunt", this.x, this.y, 0.8 * vol, this.juv ? 1.6 : 1);
    }
    update(dt) {
      const g = this.g, p = g.player, H = this.herd;
      this.stateT += dt;
      this.timer -= dt;
      this.callCd -= dt;
      this.biteCd -= dt;
      this.recoilT -= dt;
      this.turnT -= dt;
      this.gruntT -= dt;
      if (this.blockedAt(this.x, this.y)) this.unstick();
      const pc = this.perc = this.perceive(dt);
      if (pc.rate > 0) {
        this.aware = Math.min(1.5, this.aware + pc.rate * dt * this.pers.wary);
        if (pc.seen || pc.heard > 0.25) {
          this.lastSeen = { x: p.x, y: p.y };
          this.lastPerceivedT = g.time;
        } else if (pc.smelled || pc.heard) {
          this.lastPerceivedT = g.time;
          if (!this.lastSeen || pc.heard) this.lastSeen = { x: p.x + (rnd() - 0.5) * pc.d * 0.4, y: p.y + (rnd() - 0.5) * pc.d * 0.4 };
        }
        const strongest = pc.seen ? "seen" : pc.heard ? "heard" : "smell";
        if (this.aware > TUNE.alertAt * 0.7) {
          this.reason = this.reasonText(pc);
          this.reason.ch = strongest;
        }
        if (this.aware >= TUNE.alertAt && (this.state === S2.ALERT || this.state === S2.INVESTIGATE)) this.alertCause = "player";
      } else {
        this.aware = Math.max(0, this.aware - dt * (CALM.has(this.state) ? 0.13 : 0.07));
      }
      let tx = null, ty = null, spd = 0, dir = null;
      const st = this.state;
      if (CALM.has(st)) {
        if (this.aware >= TUNE.alertAt && pc.rate > 0) {
          this.prevCalm = st;
          this.alertCause = "player";
          this.stim = { x: this.lastSeen ? this.lastSeen.x : p.x, y: this.lastSeen ? this.lastSeen.y : p.y, kind: "player", t: g.time };
          this.enter(S2.ALERT);
        }
      }
      switch (this.state) {
        case S2.IDLE: {
          this.head = this.pers.sentinel && H.sentinelUp ? "up" : "mid";
          if (this.pers.sentinel && H.sentinelUp) {
            if (Math.floor(g.time * 0.8 + this.pers.ph) % 2 === 0) this.head = "up";
          }
          if (H.moving) {
            this.enter(S2.WALKING);
            break;
          }
          if (this.pers.sentinel && H.sentinelUp) this.timer = Math.max(this.timer, 0.5);
          if (this.timer <= 0) this.enter(rnd() < 0.7 ? S2.FORAGING : S2.IDLE);
          if (this.gruntT <= 0) {
            this.gruntT = 5 + rnd() * 10;
            if (rnd() < 0.5) this.vocal("grunt", 0.6);
          }
          break;
        }
        case S2.FORAGING: {
          this.head = "down";
          if (H.moving) {
            this.enter(S2.WALKING);
            break;
          }
          if (this.pers.sentinel && H.sentinelUp && this.foodT <= 0) {
            this.enter(S2.IDLE);
            break;
          }
          if (this.target && dist(this.x, this.y, this.target.x, this.target.y) > 4) {
            tx = this.target.x;
            ty = this.target.y;
            spd = TUNE.forageSpeed;
          }
          if (this.foodT > 0) this.foodT -= dt;
          if (this.timer <= 0) {
            if (this.foodT > 0) this.enter(S2.FORAGING);
            else this.enter(rnd() < 0.55 ? S2.IDLE : S2.FORAGING);
          }
          if (this.gruntT <= 0) {
            this.gruntT = 4 + rnd() * 9;
            if (rnd() < 0.6) this.vocal("grunt", 0.5);
            if (rnd() < 0.3) H.dust(this);
          }
          break;
        }
        case S2.WALKING: {
          this.head = "mid";
          const pt = H.calmPoint(this, true);
          tx = pt.x;
          ty = pt.y;
          const dd = dist(this.x, this.y, tx, ty);
          spd = TUNE.walkSpeed * (dd > 30 ? 1.5 : dd > 10 ? 1 : 0.4);
          if (!H.moving && dd < 10) this.enter(rnd() < 0.7 ? S2.FORAGING : S2.IDLE);
          if (!H.moving && this.timer <= 0) this.enter(S2.FORAGING);
          break;
        }
        case S2.ALERT: {
          this.head = "up";
          const s = this.stim || this.lastSeen;
          if (s) dir = this.faceToward(s.x, s.y, dt, 4);
          if (this.alertCause === "player" && pc.rate > 0) this.timer = Math.max(this.timer, 0.25);
          if (this.stim && (this.stim.kind === "noise" || this.stim.kind === "food") && !this.noiseClacked && this.stateT > 0.25) {
            this.noiseClacked = true;
            if (this.pers.bold > 0.85) {
              this.vocal("clack", 0.7);
              this.mouthT = 0.5;
            }
          }
          this.clackT -= dt;
          if (this.aware > 0.55 && this.clackT <= 0) {
            this.clackT = 1.4 + rnd();
            this.vocal("clack", 0.5);
            this.mouthT = 0.35;
            if (this.callCd <= 0 && this.alertCause === "player") H.emit(this, 1);
          }
          if (this.aware >= TUNE.defensiveAt && (pc.seen || pc.d < 45 || pc.heard > 0.5 && pc.d < 70)) {
            this.enter(S2.DEFENSIVE);
            break;
          }
          if (this.timer <= 0) {
            if (this.aware >= TUNE.investigateAt || this.stim && this.stim.kind !== "player" && this.stim.kind !== "call") this.enter(S2.INVESTIGATE);
            else if (this.aware < TUNE.alertAt) this.enter(this.prevCalm || S2.FORAGING);
            else this.timer = 0.8;
          }
          break;
        }
        case S2.INVESTIGATE: {
          this.head = this.stateT % 2 < 1.2 ? "mid" : "up";
          const s = this.alertCause === "player" && this.lastSeen && g.time - this.lastPerceivedT < 2 ? this.lastSeen : this.stim || this.lastSeen;
          if (!s) {
            this.enter(S2.RETURN);
            break;
          }
          const d = dist(this.x, this.y, s.x, s.y);
          if (d > 14) {
            tx = s.x;
            ty = s.y;
            spd = TUNE.investigateSpeed * this.pers.spd;
          } else {
            this.head = "down";
            if (!this.sniffT) this.sniffT = 1.6;
            this.sniffT -= dt;
            if (this.sniffT <= 0) {
              this.sniffT = 0;
              if (this.stim && this.stim.kind === "food") {
                this.foodT = 8 + rnd() * 6;
                this.stim = null;
                this.enter(S2.FORAGING);
                this.target = { x: this.x + (rnd() - 0.5) * 10, y: this.y + (rnd() - 0.5) * 8 };
                this.timer = this.foodT;
              } else this.enter(S2.RETURN);
              break;
            }
          }
          if (this.aware >= TUNE.defensiveAt && (pc.seen || pc.d < 40)) {
            this.enter(S2.DEFENSIVE);
            break;
          }
          if (!H.inLeash(this.x, this.y, 0.85)) {
            this.enter(S2.RETURN);
            break;
          }
          if (this.timer <= 0) this.enter(S2.RETURN);
          break;
        }
        case S2.DEFENSIVE: {
          this.head = "mid";
          const tgt = this.lastSeen || this.stim;
          if (tgt) dir = this.faceToward(tgt.x, tgt.y, dt, 6);
          this.clackT -= dt;
          if (this.clackT <= 0) {
            this.clackT = 0.7 + rnd() * 0.5;
            this.vocal("clack", 1);
            this.mouthT = 0.5;
          }
          if (this.stateT < 0.2) H.stamp(this);
          if (this.timer <= 0) {
            const near = pc.d < TUNE.threatRange * this.pers.bold * (H.aggression || 1);
            const recent = g.time - this.lastPerceivedT < 1.5;
            if (this.alertCause === "player" && near && recent && H.inLeash(this.x, this.y) && !this.juv && !H.playerSafe()) this.enter(S2.CHASE);
            else if (this.stateT > 3 || pc.d > 140 || !recent) this.enter(S2.RETURN);
            else this.timer = 0.4;
          }
          break;
        }
        case S2.CHASE: {
          this.head = "mid";
          const lost = g.time - this.lastPerceivedT;
          const tgt = lost < 1 ? { x: p.x, y: p.y } : this.lastSeen;
          if (!H.inLeash(this.x, this.y)) {
            this.giveUp("leash");
            break;
          }
          if (lost > (H.lostSight || TUNE.lostSight)) {
            this.giveUp("lost");
            break;
          }
          if (!tgt) {
            this.giveUp("lost");
            break;
          }
          if (H.playerSafe() || H.blocked && H.blocked(this.x + Math.cos(this.heading) * 10, this.y + Math.sin(this.heading) * 10) && dist(this.x, this.y, tgt.x, tgt.y) < 90 && H.blockedBetween(this.x, this.y, tgt.x, tgt.y)) {
            this.standoffT += dt;
            if (this.standoffT > 1.4) {
              this.giveUp("barrier");
              break;
            }
          } else this.standoffT = Math.max(0, this.standoffT - dt);
          if (this.recoilT > 0) {
            dir = { x: -Math.cos(this.heading), y: -Math.sin(this.heading) };
            spd = 40;
            this.faceKeep = true;
          } else {
            const d = dist(this.x, this.y, tgt.x, tgt.y);
            if (lost >= 1 && d < 10) {
              this.giveUp("lost");
              break;
            }
            dir = H.pathDir(this, tgt.x, tgt.y, true);
            spd = TUNE.chaseSpeed * this.pers.spd * (H.chaseMul || 1) * (g.world.surfaceAt(this.x, this.y) === "mud" ? 0.82 : 1);
            if (this.stateT < 0.6) spd *= 0.6 + this.stateT / 1.5;
            this.tryBite(pc);
          }
          this.clackT -= dt;
          if (this.clackT <= 0) {
            this.clackT = 1.2 + rnd() * 1.4;
            this.vocal(rnd() < 0.6 ? "clack" : "grunt", 1);
          }
          break;
        }
        case S2.RETURN: {
          this.head = "mid";
          const pt = H.calmPoint(this, true);
          const d = dist(this.x, this.y, pt.x, pt.y);
          if (this.standoffT > 0) {
            this.standoffT -= dt;
            const s = this.lastSeen;
            if (s) dir = this.faceToward(s.x, s.y, dt, 5);
            this.clackT -= dt;
            if (this.clackT <= 0) {
              this.clackT = 0.9;
              this.vocal("clack", 0.8);
              this.mouthT = 0.4;
            }
            break;
          }
          if (d < 14 || this.timer <= 0) {
            this.aware = Math.min(this.aware, 0.15);
            this.enter(rnd() < 0.6 ? S2.FORAGING : S2.IDLE);
            break;
          }
          dir = H.pathDir(this, pt.x, pt.y, false);
          spd = TUNE.returnSpeed * this.pers.spd;
          if (this.aware >= TUNE.defensiveAt && pc.seen && pc.d < 60 && this.stateT > 1.5 && !H.playerSafe()) {
            this.alertCause = "player";
            this.enter(S2.DEFENSIVE);
          }
          break;
        }
      }
      if (this.mouthT > 0) {
        this.mouthT -= dt;
        this.mouth = Math.floor(this.mouthT * 18) % 2 === 0;
      } else this.mouth = false;
      if (tx !== null && !dir) {
        const dx = tx - this.x, dy = ty - this.y, m = Math.hypot(dx, dy) || 1;
        dir = { x: dx / m, y: dy / m };
        if (CALM.has(this.state) || this.state === S2.INVESTIGATE) {
          const pd = H.pathDir(this, tx, ty, false, true);
          if (pd) dir = pd;
        }
      }
      this.locomote(dir, spd, dt);
      this.behavior = this.state === S2.FORAGING ? "forage" : this.state === S2.IDLE && this.pers.sentinel && this.head === "up" ? "sentinel" : this.state === S2.WALKING && H.moving && this.speed > 6 ? "move" : (this.state === S2.ALERT || this.state === S2.DEFENSIVE) && this.mouthT > 0 ? "clack" : null;
    }
    giveUp(why) {
      this.standoffT = why === "barrier" || why === "leash" ? 1.4 + rnd() : 0;
      this.enter(S2.RETURN);
      this.herd.gaveUp(this, why);
    }
    faceToward(x, y, dt, rate) {
      const a = Math.atan2(y - this.y, x - this.x);
      this.heading += clamp(angleDiff(this.heading, a), -rate * dt, rate * dt);
      return null;
    }
    tryBite(pc) {
      const g = this.g, p = g.player;
      if (this.biteCd > 0 || g.state !== "play" || pc.d > TUNE.biteRange + this.r) return;
      if (g.time - (this.herd.lastBiteT ?? -99) < this.herd.biteInterval) return;
      this.herd.lastBiteT = g.time;
      this.biteCd = TUNE.biteCooldown + rnd() * 0.5;
      this.recoilT = 0.55;
      if (p.invuln > 0 || p.dodgeT > 0) return;
      if (this.herd.mercy && p.hp < 40 && rnd() < 0.5) {
        this.vocal("clack", 1);
        this.mouthT = 0.5;
        return;
      }
      const before = p.hp;
      p.hurt(this.herd.biteDamage || TUNE.biteDamage, this.herd.biteMsg());
      if (p.hp < before) {
        g.audio.play("bite", { pan: g.panOf(this.x) });
        const dx = p.x - this.x, dy = p.y - this.y, m = Math.hypot(dx, dy) || 1;
        g.world.moveCircle(p, dx / m * 10, dy / m * 10, p.r);
        p.vx += dx / m * 60;
        p.vy += dy / m * 60;
        for (let i = 0; i < 5; i++) g.particles.add({ type: "puff", x: p.x, y: p.y - 2, vx: (rnd() - 0.5) * 30, vy: (rnd() - 0.5) * 20, life: 0.5, color: "#9a8a6a" });
        this.herd.bit(this);
      }
    }
    // move com virada gradual, separação, desvio de obstáculos e passos curtos (nunca atravessa colisores)
    locomote(dir, spd, dt) {
      const H = this.herd, g = this.g;
      let dx = 0, dy = 0;
      if (dir && spd > 0) {
        dx = dir.x;
        dy = dir.y;
      }
      for (const o of H.members) {
        if (o === this) continue;
        const ox2 = this.x - o.x, oy2 = this.y - o.y, d = Math.hypot(ox2, oy2);
        if (d < TUNE.separation && d > 0.01) {
          const k = (TUNE.separation - d) / TUNE.separation;
          dx += ox2 / d * k * 1.3;
          dy += oy2 / d * k * 1.3;
        }
      }
      if (this.state !== S2.CHASE && g.player) {
        const ox2 = this.x - g.player.x, oy2 = this.y - g.player.y, d = Math.hypot(ox2, oy2);
        if (d < 14 && d > 0.01) {
          dx += ox2 / d * 1.2;
          dy += oy2 / d * 1.2;
        }
      }
      if (this.sideStep) {
        this.sideStep.t -= dt;
        dx = this.sideStep.x;
        dy = this.sideStep.y;
        if (this.sideStep.t <= 0) this.sideStep = null;
      }
      const m = Math.hypot(dx, dy);
      const want = m > 0.05 ? Math.atan2(dy, dx) : this.heading;
      let h = want;
      if (m > 0.05 && spd > 0) {
        const look = 9 + spd * 0.12;
        if (this.blockedAt(this.x + Math.cos(want) * look, this.y + Math.sin(want) * look)) {
          for (const off of [0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
            const a = want + off * (this.avoidSide || 1);
            if (!this.blockedAt(this.x + Math.cos(a) * look, this.y + Math.sin(a) * look)) {
              h = a;
              this.avoidSide = Math.sign(off) * (this.avoidSide || 1) || 1;
              break;
            }
          }
        }
      }
      const turn = (this.state === S2.CHASE ? 7 : this.state === S2.RETURN ? 4.5 : 3) * dt;
      if (!this.faceKeep) this.heading += clamp(angleDiff(this.heading, h), -turn, turn);
      this.faceKeep = false;
      const target = m > 0.05 ? spd : 0;
      this.speed += clamp(target - this.speed, -140 * dt, (this.state === S2.CHASE ? 110 : 40) * dt);
      if (this.speed < 0.5 && target === 0) this.speed = 0;
      let mvx = Math.cos(this.heading) * this.speed * dt, mvy = Math.sin(this.heading) * this.speed * dt;
      if (target === 0 && m > 0.05) {
        mvx = dx / m * 6 * dt;
        mvy = dy / m * 6 * dt;
      }
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
      const vx = Math.cos(this.heading);
      if (Math.abs(vx) > 0.2) {
        const nf = vx > 0 ? 1 : -1;
        if (nf !== this.face) {
          this.face = nf;
          this.turnT = 0.14;
        }
      }
      this.anim += dt * (this.speed > 45 ? 13 : this.speed > 3 ? 4 + this.speed * 0.25 : 0) * this.pers.spd;
      this.frame = Math.floor(this.anim) % 4;
      if (this.speed > 3 && g.world.surfaceAt(this.x, this.y) === "mud" && rnd() < dt * this.speed * 0.08) g.particles.add({ type: "ripple", x: this.x, y: this.y, life: 0.6, r1: 4, color: "#6a5a3a" });
      if (this.speed > 50 && rnd() < dt * 10) g.particles.add({ type: "puff", x: this.x - Math.cos(this.heading) * 6, y: this.y, vx: -Math.cos(this.heading) * 12, vy: -3, life: 0.5, color: "#9a8466" });
      if (this.speed > 50 && rnd() < dt * 4) g.particles.add({ type: "leaf", x: this.x, y: this.y, z: 2, vx: (rnd() - 0.5) * 30, vy: 0, life: 1.2, seed: rnd() * 9, color: "#8a6a34" });
    }
    blockedAt(x, y) {
      const w = this.g.world;
      return w.hit(x, y, this.r) || circleBlocked(w, x, y, this.r) || this.herd.blocked && this.herd.blocked(x, y);
    }
    // nasceu ou foi empurrado para dentro de um obstáculo: procura o ponto livre mais próximo
    unstick() {
      for (let r = 2; r <= 40; r += 2) for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const x = this.x + Math.cos(a) * r, y = this.y + Math.sin(a) * r;
        if (!this.blockedAt(x, y)) {
          this.x = x;
          this.y = y;
          return;
        }
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
      let view = "side";
      if (this.turnT > 0) view = "front";
      else if (moving && Math.abs(vy) > 0.85) view = vy > 0 ? "front" : "back";
      const gait = this.speed > 45 ? "run" : moving ? "walk" : "idle";
      let head = this.head;
      if (this.state === S2.FORAGING && Math.sin(this.g.time * 5 + this.pers.ph) > 0.4) head = "mid";
      const fr = view === "side" ? this.frame : this.frame % 2;
      const flip = view === "side" && this.face < 0;
      const k = `q:${view}:${gait}:${fr}:${head}:${this.mouth ? 1 : 0}:${this.bristle ? 1 : 0}:${this.pers.pal}:${this.juv ? 1 : 0}:${flip ? 1 : 0}`;
      const o = { gait, frame: fr, head, mouth: this.mouth, bristle: this.bristle, pal: this.pers.pal, juv: this.juv, back: view === "back" };
      const c = Sprites.get(k, () => {
        if (view === "side") {
          const s = peccarySide(o);
          return flip ? flipCanvas(s) : s;
        }
        return peccaryFront(o);
      });
      return { c, view };
    }
    draw(ctx) {
      const g = this.g;
      const { c, view } = this.sprite();
      const juv = this.juv;
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + 1, juv ? 5 : view === "side" ? 8 : 6, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      const ay = view === "side" ? juv ? 10 : 13 : c.height - 1;
      const bob = this.state === S2.DEFENSIVE && this.stateT < 0.25 ? -1 : 0;
      ctx.drawImage(c, Math.round(this.x - c.width / 2), Math.round(this.y - ay + bob));
      this.drawAware(ctx, Math.round(this.y - ay - 3));
      if (this.mouth && this.mouthT > 0 && view === "side") {
        ctx.fillStyle = "#f4f0e0";
        ctx.globalAlpha = 0.8;
        const hx = this.x + this.face * (juv ? 7 : 11), hy = this.y - ay + (juv ? 5 : 7);
        ctx.fillRect(Math.round(hx + this.face * 3), Math.round(hy - 3), 1, 1);
        ctx.fillRect(Math.round(hx + this.face * 4), Math.round(hy - 1), 1, 1);
        ctx.globalAlpha = 1;
      }
      void g;
    }
    drawAware(ctx, y) {
      const st = this.state, p = this.g.player;
      if (!p || dist(this.x, this.y, p.x, p.y) > 190) return;
      const x = Math.round(this.x);
      if (st === S2.DEFENSIVE || st === S2.CHASE) {
        ctx.fillStyle = "#ff5a3a";
        ctx.fillRect(x, y - 7, 1, 4);
        ctx.fillRect(x, y - 2, 1, 1);
        ctx.fillStyle = "#3a0a04";
        ctx.fillRect(x + 1, y - 7, 1, 4);
      } else if (st === S2.ALERT || st === S2.INVESTIGATE) {
        ctx.fillStyle = this.alertCause === "player" ? "#ffd666" : "#f4f0e0";
        ctx.fillRect(x - 1, y - 7, 3, 1);
        ctx.fillRect(x + 1, y - 6, 1, 1);
        ctx.fillRect(x, y - 5, 1, 1);
        ctx.fillRect(x, y - 2, 1, 1);
      } else if (this.aware > 0.12) {
        const k = clamp(this.aware / TUNE.alertAt, 0, 1);
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = "#1a140c";
        ctx.fillRect(x - 4, y - 3, 8, 2);
        ctx.fillStyle = k > 0.7 ? "#ffb040" : "#f4ecd0";
        ctx.fillRect(x - 4, y - 3, Math.max(1, Math.round(8 * k)), 2);
        ctx.globalAlpha = 1;
      }
    }
  };
  var Herd = class {
    constructor(g, o) {
      this.g = g;
      this.id = o.id || "herd";
      this.members = [];
      this.anchor = { x: o.x, y: o.y };
      this.route = o.route || [{ x: o.x, y: o.y }];
      this.routeIdx = 0;
      this.moveEvery = o.moveEvery || [38, 58];
      this.moveT = o.firstMove ?? this.moveEvery[0];
      this.moving = false;
      this.moveTo = null;
      this.spread = o.spread || 1;
      this.leash = o.leash || { x: o.x, y: o.y, r: 260 };
      this.blocked = o.blocked || null;
      this.safe = o.safe || null;
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
      this.mode = "calm";
      this.calmT = 0;
      this.episode = null;
      this.sentinelUp = false;
      this.sentinelT = 6;
      this.active = true;
      this.sleepDist = o.sleepDist || 760;
      this.flowP = new FlowField(g.world, { blocked: this.blocked, maxCells: o.flowCells || 9e3 });
      this.flowH = new FlowField(g.world, { blocked: this.blocked, maxCells: o.flowCells || 9e3 });
      this.biteMsgShown = false;
    }
    add(x, y, o = {}) {
      const m = new Peccary(this, x, y, o);
      this.members.push(m);
      return m;
    }
    calmPoint(m, live = false) {
      const a = this.anchor;
      const jit = live ? 0 : 1;
      return { x: a.x + m.slot.x * this.spread + (Math.random() - 0.5) * 18 * jit, y: a.y + m.slot.y * this.spread + (Math.random() - 0.5) * 12 * jit };
    }
    playerSafe() {
      const p = this.g.player;
      return !!(this.safe && p && this.safe(p.x, p.y));
    }
    inLeash(x, y, k = 1) {
      const L = this.leash;
      return L.r === Infinity || dist(x, y, L.x, L.y) < L.r * k;
    }
    blockedBetween(ax, ay, bx, by) {
      if (!this.blocked) return false;
      const n = Math.ceil(dist(ax, ay, bx, by) / 6);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        if (this.blocked(ax + (bx - ax) * t, ay + (by - ay) * t)) return true;
      }
      return false;
    }
    // direção de caminho: linha reta quando livre; campo de fluxo quando há obstáculos no meio
    pathDir(m, tx, ty, toPlayer, softOnly = false) {
      const d = dist(m.x, m.y, tx, ty);
      const direct = () => {
        const vx = tx - m.x, vy = ty - m.y, k = Math.hypot(vx, vy) || 1;
        return { x: vx / k, y: vy / k };
      };
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
        if (w.hit(x, y, r + 1) || circleBlocked(w, x, y, r + 1) || this.blocked && this.blocked(x, y)) return false;
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
        this.calls.push({ to: m, at: now + TUNE.callDelay * (0.6 + Math.random() * 0.8) + d / TUNE.callSpeed, level, sx, sy, cause: from.alertCause || "noise", from });
      }
    }
    hearNoise(x, y, loud, kind = "noise") {
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
      if (!this.episode.chase) {
        this.episode.chase = true;
        this.on.chase?.(m);
      }
    }
    gaveUp(m, why) {
      this.on.giveUp?.(m, why);
    }
    bit(m) {
      this.on.bite?.(m);
    }
    biteMsg() {
      if (this.biteMsgShown) return null;
      this.biteMsgShown = true;
      return "Mordida de queixada! Corra, esquive (Espa\xE7o) ou se afaste at\xE9 o bando desistir.";
    }
    sfx(name, x, y, vol = 1, pitch = 1) {
      const p = this.g.player;
      if (!p) return;
      const d = dist(x, y, p.x, p.y);
      if (d > 340) return;
      this.g.audio.play(name, { pan: this.g.panOf(x), vol: vol * (1 - d / 340) * (d < 60 ? 1 : 0.85), pitch });
    }
    stamp(m) {
      if (Math.random() < 0.3) this.g.particles.add({ type: "puff", x: m.x, y: m.y, vx: (Math.random() - 0.5) * 10, vy: -3, life: 0.5, color: "#8a7a5a" });
    }
    dust(m) {
      for (let i = 0; i < 3; i++) this.g.particles.add({ type: "puff", x: m.x + m.face * 8, y: m.y, vx: (Math.random() - 0.5) * 8, vy: -2, life: 0.6, color: "#7a6a4a" });
    }
    counts() {
      const c = { calm: 0, alert: 0, defensive: 0, chase: 0, ret: 0, moving: 0 };
      for (const m of this.members) {
        if (CALM.has(m.state)) c.calm++;
        else if (m.state === S2.ALERT || m.state === S2.INVESTIGATE) c.alert++;
        else if (m.state === S2.DEFENSIVE) c.defensive++;
        else if (m.state === S2.CHASE) c.chase++;
        else c.ret++;
        if (m.speed > 6) c.moving++;
      }
      return c;
    }
    update(dt) {
      const g = this.g, p = g.player;
      if (!p) return;
      const nearest = this.members.reduce((a, m) => Math.min(a, dist(m.x, m.y, p.x, p.y)), Infinity);
      this.active = nearest < this.sleepDist || this.mode !== "calm";
      if (!this.active) return;
      for (let i = this.calls.length - 1; i >= 0; i--) {
        const c2 = this.calls[i];
        if (g.time < c2.at) continue;
        this.calls.splice(i, 1);
        if (c2.direct) {
          const m = c2.to;
          if (c2.kind === "shot") {
            m.aware = Math.max(m.aware, 0.95);
            m.alertCause = "player";
            m.lastSeen = { x: c2.sx, y: c2.sy };
            m.lastPerceivedT = g.time;
            if (m.state !== S2.CHASE) m.enter(S2.DEFENSIVE);
          } else m.hear(c2.sx, c2.sy, c2.loud, c2.kind);
        } else c2.to.receiveCall(c2);
      }
      if (this.mode === "calm") {
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
          let lag = 0;
          for (const m of this.members) lag = Math.max(lag, dist(m.x, m.y, this.anchor.x + m.slot.x * this.spread, this.anchor.y + m.slot.y * this.spread));
          const sp = TUNE.walkSpeed * 0.75 * this.walkMul * (lag > 40 ? 0.2 : 1);
          if (d < 2) {
            this.moving = false;
            this.moveT = this.moveEvery[0] + Math.random() * (this.moveEvery[1] - this.moveEvery[0]);
            this.on.arrive?.(this.moveTo);
          } else {
            this.anchor.x += dx / d * Math.min(d, sp * dt);
            this.anchor.y += dy / d * Math.min(d, sp * dt);
          }
        }
        this.sentinelT -= dt;
        if (this.sentinelT <= 0) {
          this.sentinelUp = !this.sentinelUp;
          this.sentinelT = this.sentinelUp ? 5 + Math.random() * 3 : 9 + Math.random() * 8;
        }
      }
      for (const m of this.members) m.update(dt);
      for (let i = 0; i < this.members.length; i++) for (let j = i + 1; j < this.members.length; j++) {
        const a = this.members[i], b = this.members[j];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d < TUNE.minGap && d > 0.01) {
          const push = (TUNE.minGap - d) / 2, ux = dx / d * push, uy = dy / d * push;
          if (!a.blockedAt(a.x - ux, a.y - uy)) {
            a.x -= ux;
            a.y -= uy;
          }
          if (!b.blockedAt(b.x + ux, b.y + uy)) {
            b.x += ux;
            b.y += uy;
          }
        }
      }
      const c = this.counts();
      const prev = this.mode;
      this.mode = c.chase ? "chase" : c.defensive ? "alarmed" : c.alert || c.ret ? "suspicious" : "calm";
      if (this.mode === "calm") {
        this.calmT += dt;
        if (this.episode && this.calmT > 2.5) {
          const ep = this.episode;
          this.episode = null;
          this.biteMsgShown = false;
          this.on.calm?.(ep);
        }
      } else this.calmT = 0;
      if (prev !== this.mode) this.on.mode?.(this.mode, prev);
    }
    // bichos que estão vendo o jogador agora (para a interface e para as missões)
    watchers() {
      return this.members.filter((m) => m.perc && (m.perc.seen || m.perc.heard > 0.3));
    }
  };

  // js/phases/phase2-data.js
  var phase2_data_exports = {};
  __export(phase2_data_exports, {
    AREAS: () => AREAS,
    BRIDGE: () => BRIDGE2,
    BUSHES_B: () => BUSHES_B,
    B_CENTER: () => B_CENTER,
    CHASE: () => CHASE,
    CLUES: () => CLUES,
    DEER_PRINTS_E: () => DEER_PRINTS_E,
    DRY_ZONES: () => DRY_ZONES,
    EXIT: () => EXIT,
    FINAL_TREE: () => FINAL_TREE,
    GORGE: () => GORGE,
    GULLY: () => GULLY,
    HAIR: () => HAIR,
    HERD_ROUTE: () => HERD_ROUTE,
    LAJEDO: () => LAJEDO,
    LOGS_B: () => LOGS_B,
    LOGS_C: () => LOGS_C,
    MIRANTE: () => MIRANTE,
    MUD_D: () => MUD_D,
    MYSTERY: () => MYSTERY,
    PASSAGES: () => PASSAGES,
    PATTERNS: () => PATTERNS,
    POND: () => POND,
    PUZ: () => PUZ,
    RED_TRAIL: () => RED_TRAIL,
    ROCKS_B: () => ROCKS_B,
    ROOTS_C: () => ROOTS_C,
    ROOTS_D: () => ROOTS_D,
    S: () => S3,
    SIGNS: () => SIGNS,
    SLALOM_TREES: () => SLALOM_TREES,
    STONE_PUSH: () => STONE_PUSH,
    TAPIR_HOME: () => TAPIR_HOME,
    TH: () => TH2,
    TRAILS: () => TRAILS2,
    TUCUM_D: () => TUCUM_D,
    TW: () => TW2,
    VARZEA: () => VARZEA,
    VINE: () => VINE,
    px: () => px2
  });
  var TW2 = 150;
  var TH2 = 120;
  var S3 = 16;
  var px2 = (t) => t * S3;
  var TRAILS2 = [
    { id: "A", r: 1.1, band: 3.2, pts: [[9, 108], [14, 105.5], [19, 102], [25, 99.5], [31, 98.5], [36, 95.5], [41, 92.5], [47, 91]] },
    { id: "A2", r: 0.7, band: 1.4, pts: [[14, 105.5], [12.5, 110], [15, 113]] },
    { id: "bicho", r: 0.7, band: 0.9, pts: [[38, 107], [40, 101], [41.5, 95], [44, 89], [49, 86]] },
    { id: "PN", r: 0.85, band: 0.5, pts: [[66, 80], [66, 74], [70, 69], [77, 65], [85, 62], [92, 61]] },
    { id: "PNE", r: 0.85, band: 0.5, pts: [[81, 85], [85, 81], [88, 77], [90, 72], [93, 66], [95, 61], [98, 59.5]] },
    { id: "C", r: 1, band: 1.2, pts: [[92, 61], [98, 59.5], [104, 58.5]] },
    { id: "Canta", r: 0.8, band: 1, pts: [[90, 62], [87, 57], [84, 52.5], [81, 49.5]] },
    { id: "C2", r: 1, band: 1, pts: [[104, 49], [106, 46], [110, 44], [116, 42], [122, 41]] },
    { id: "D", r: 1, band: 1.15, pts: [[122, 41], [128, 43], [133, 47], [136, 52], [135.5, 57], [138, 62], [136.5, 67], [135, 72], [135, 77]] },
    { id: "Dbaixada", r: 0.8, band: 0.6, pts: [[133, 47.5], [129, 50.5], [125.5, 52.5]] },
    { id: "Desq", r: 0.85, band: 0.55, pts: [[135, 77], [130, 81], [127.5, 86], [130, 91], [134, 94]] },
    { id: "Ddir", r: 0.8, band: 0.5, pts: [[135, 77], [138.5, 81], [139.5, 86], [137.5, 91], [134, 94]] },
    { id: "ponte", r: 0.45, band: 0.1, pts: [[134, 93.5], [134, 96], [134, 100.6]] },
    { id: "E", r: 1, band: 1.6, pts: [[128, 106.5], [124, 110], [118, 112.5], [112, 113.5], [106, 113], [101, 113]] },
    { id: "E2", r: 0.7, band: 1, pts: [[124, 110], [131, 113.3], [138, 114]] }
  ];
  var AREAS = [
    { id: "camp1", x: 10, y: 108, rx: 3.6, ry: 3, t: "clear" },
    { id: "B", x: 66, y: 92, rx: 19, ry: 13, t: "clear" },
    { id: "Cmata", x: 89, y: 61, rx: 11, ry: 6, t: "floor" },
    { id: "Cpatio", x: 101, y: 59.5, rx: 6.5, ry: 3.6, t: "clear" },
    { id: "barreiro", x: 80, y: 48, rx: 5, ry: 3.6, t: "mud" },
    { id: "Cnorte", x: 108, y: 46.2, rx: 5.5, ry: 3.2, t: "floor" },
    { id: "baixada", x: 124, y: 53, rx: 3.6, ry: 2.6, t: "clear" },
    { id: "E", x: 118, y: 112.5, rx: 18, ry: 4.6, t: "meadow" }
  ];
  var B_CENTER = { x: 66, y: 92, rx: 19, ry: 13 };
  var VARZEA = { x: 93, y: 113, rx: 5, ry: 4.5 };
  var LAJEDO = { x: 134, y: 104.6, rx: 9.5, ry: 3.8 };
  var POND = { x: 78.5, y: 46.5, r: 1.4 };
  var GORGE = { x: 104, half: 1.6, y0: 48.6, y1: 57.2, wall: 6, ditch: { x0: 97.8, x1: 102.4, y0: 48.6, y1: 52.4 } };
  var GULLY = { y0: 96, y1: 99.6, x0: 110 };
  var BRIDGE2 = { x: 134, y0: 95.6, y1: 100.3, w: 1.4 };
  var MUD_D = { y0: 66.5, y1: 75.5, x0: 130, x1: 141 };
  var SIGNS = [
    { id: "fucado", at: [19.5, 101], name: "Solo revolvido", text: "A terra foi virada de cabe\xE7a pra baixo, num peda\xE7o enorme. Focinho de bicho, muitos focinhos, cavando atr\xE1s de raiz e minhoca." },
    { id: "raizes", at: [25, 100.6], name: "Ra\xEDzes quebradas", text: "Ra\xEDzes arrancadas e ro\xEDdas, ainda soltando seiva. Quebraram faz pouco. Dente forte, de bicho que mastiga coquinho duro." },
    { id: "pegadas", at: [30.5, 97.6], name: "Pegadas de casco partido", text: "Pegada pequena de casco partido, centenas delas, umas por cima das outras. N\xE3o \xE9 um bicho: \xE9 um bando inteiro passando junto." },
    { id: "esfregao", at: [37, 94.2], name: "Tronco esfregado", text: "Lama seca esfregada no tronco at\xE9 a altura do joelho, e um cheiro azedo, forte. Queixada marca o caminho assim." }
  ];
  var CLUES = [
    { id: "c_galho", at: [15, 113], text: "Brotos de emba\xFAba mordiscados na altura do peito de um veado. Corte limpo, de dente de baixo." },
    { id: "c_cama", at: [57, 81.6], text: "Capim deitado em roda, ainda morno: o veado dormiu aqui, na beira da clareira, antes de o bando chegar." },
    { id: "c_lama", at: [83.4, 49.6], text: "No barro do barreiro, a pegada fina do veado bem ao lado da pata larga da anta. Passaram pelo mesmo caminho." },
    { id: "c_fezes", at: [138, 114], text: "Fezes de veado, frescas, em bolinhas. Ele parou aqui faz pouco tempo." }
  ];
  var ROCKS_B = [[55, 86.5, 11], [61.5, 81.8, 9], [75.5, 84, 10], [79, 99, 10], [58.5, 101, 9]];
  var LOGS_B = [[64.5, 85.2, 56], [69.5, 103.2, 48], [81.5, 92, 40], [53, 97.5, 40]];
  var BUSHES_B = [[52.5, 93.5], [57.5, 83.8], [82.8, 87.5], [77.5, 80.8], [72.5, 101], [62.5, 104], [84.2, 84.2], [49.8, 88.5], [60, 95.8], [74.5, 93.2]];
  var DRY_ZONES = [[63.5, 80.4, 1.5], [55.5, 102.3, 1.4], [84, 95.8, 1.3], [26.5, 97.4, 1.2]];
  var HERD_ROUTE = [[66, 93], [73, 88], [64.5, 98.5], [60, 94.5]];
  var MIRANTE = { tree: [49.2, 85.4], at: [50.4, 87.2] };
  var VINE = { at: [52.4, 100.2], palm: [60, 103.4], land: [60.6, 102.2] };
  var STONE_PUSH = { at: [77, 82.5], land: [71.5, 88.5] };
  var PASSAGES = [
    { id: "PN", at: [66, 77.5], gate: [64, 77.4, 4, 0.9], name: "passagem do norte" },
    { id: "PNE", at: [86.6, 79.6], gate: [84, 77.4, 5.6, 4.4], name: "passagem das pedras" }
  ];
  var PUZ = {
    trunk: [104, 53.2],
    trunkLen: 66,
    rollTo: [100.1, 50.4],
    tangle: [97.6, 57.6],
    pole: [97.4, 58.2],
    rail: [[97.2, 60.6], [104, 60.6], [104, 55.4]],
    lever: [104, 56.6]
  };
  var LOGS_C = [[84, 63.6, 64, 5], [93, 57.6, 54, 5], [82, 58.6, 40, 4], [96, 63.4, 40, 4]];
  var ROOTS_C = [[87.5, 60.2, 34], [90, 65.2, 30], [79.8, 61.8, 26]];
  var TAPIR_HOME = [80, 48.2];
  var CHASE = {
    hollow: [124.2, 53],
    trigger: [135.6, 51.4],
    cp2: [135, 77.2],
    fork: [135, 78.5],
    spawn2: [[136.6, 66], [136, 67.5], [137.2, 64.5], [135.6, 69], [136.4, 62.8]],
    top: [134, 104.2]
  };
  var SLALOM_TREES = [[135.2, 54.4, "mid"], [137.4, 56.8, "mid"], [136.4, 59.6, "big"], [137.9, 64.2, "mid"], [135.6, 64.8, "small"], [137.4, 69.8, "mid"]];
  var ROOTS_D = [[136.8, 53.4, 22], [135.4, 58.4, 24], [138.4, 61, 18], [136, 66.2, 22]];
  var TUCUM_D = [[139.9, 83.6], [140.2, 87.6], [138.6, 89.4], [139, 85.4]];
  var HAIR = [124.4, 111];
  var DEER_PRINTS_E = [118, 113.4];
  var MYSTERY = [27.6, 103];
  var FINAL_TREE = [103.6, 110.8];
  var EXIT = [101.2, 113.2];
  var RED_TRAIL = [[131, 107.6], [128.5, 108.8], [126, 110], [121.5, 111.6], [115, 113.3], [109.5, 113.6], [104.8, 113.2]];
  var PATTERNS = {
    forage: { name: "Fu\xE7am o ch\xE3o juntos", text: "Eles fu\xE7am o ch\xE3o quase grudados uns nos outros. Cabe\xE7a baixa: nessa hora enxergam pouco, mas escutam tudo." },
    sentinel: { name: "Sempre tem um vigia", text: "Enquanto o bando come, um fica de cabe\xE7a erguida, virando de um lado pro outro. \xC9 ele quem d\xE1 o aviso." },
    move: { name: "Mudam de lugar juntos", text: "De tempos em tempos o bando inteiro levanta e muda de canto da clareira, num caminho que se repete." },
    clack: { name: "Batem os dentes quando desconfiam", text: "Quando estranham um barulho, param, levantam a cabe\xE7a e batem os dentes. O estalo passa o aviso para os outros." }
  };

  // js/phases/phase2.js
  var { TW: TW3, TH: TH3, S: S4, px: px3 } = phase2_data_exports;
  var P = (a) => ({ x: px3(a[0]), y: px3(a[1]) });
  var inEll = (x, y, e, k = 1) => ((x - e.x) / (e.rx * k)) ** 2 + ((y - e.y) / (e.ry * k)) ** 2;
  var EQUIP2 = ["paneiro", "espingarda", "facao", "cantil", "lanterna", "marmita"];
  function createPhase2(g) {
    return new Phase2(g);
  }
  var Phase2 = class {
    constructor(g) {
      this.g = g;
      this.id = 2;
      this.code = "FASE 2";
      this.title = "O CAMINHO DOS QUEIXADAS";
      this.displayTitle = "O Caminho dos Queixadas";
      this.timeLimit = 40 * 60;
      this.todStart = 452;
      this.spawn = P([11, 107.2]);
      this.menuPath = [P([54, 90]), P([78, 95])];
      this.trackDefs = TRACKS;
      this.covers = [];
      this.coverGrid = /* @__PURE__ */ new Map();
      this.occBushes = [];
      this.herds = [];
      this.pois = [
        { name: "Primeiro acampamento", ...P([10, 108]) },
        { name: "Trilha de entrada", ...P([28, 99]) },
        { name: "Clareira do bando", ...P([66, 92]) },
        { name: "Mirante", ...P(MIRANTE.at) },
        { name: "Passagem do norte", ...P(PASSAGES[0].at) },
        { name: "Passagem das pedras", ...P(PASSAGES[1].at) },
        { name: "Mata dos troncos ca\xEDdos", ...P([89, 61]) },
        { name: "Barreiro da anta", ...P([80, 48]) },
        { name: "Grota do tronco", ...P(PUZ.trunk) },
        { name: "Trilha da fuga", ...P([136, 60]) },
        { name: "Bifurca\xE7\xE3o", ...P(CHASE.fork) },
        { name: "Tronco-ponte", ...P([134, 97.5]) },
        { name: "Lajedo", ...P(CHASE.top) },
        { name: "O rastro vermelho", ...P(HAIR) },
        { name: "Segundo acampamento", ...P(EXIT) }
      ];
      this.buildMissions();
    }
    // ================= missões =================
    buildMissions() {
      const g = this.g, f = () => g.flags, d = (id) => g.done.has(id);
      const nearestOf = (list, has) => {
        let best = null, bd = 1e9;
        for (const it of list) {
          if (has(it)) continue;
          const p = P(it.at);
          const dd = g.player ? dist(p.x, p.y, g.player.x, g.player.y) : 0;
          if (dd < bd) {
            bd = dd;
            best = p;
          }
        }
        return best;
      };
      const signsDone = () => SIGNS.filter((s) => f()["sign_" + s.id]).length;
      const patDone = () => Object.keys(PATTERNS).filter((k) => f()["pat_" + k]).length;
      const cluesDone = () => CLUES.filter((c) => f()[c.id]).length;
      this.count = { signsDone, patDone, cluesDone };
      this.missions = [
        { id: "m1", title: "Investigar os barulhos", progress: () => `${Math.min(2, signsDone())}/2`, hint: "Siga a trilha para o leste. Sinais da passagem de animais brilham de leve quando voc\xEA chega perto: solo revolvido, ra\xEDzes quebradas, pegadas, troncos esfregados. Examine dois sinais diferentes com E.", target: () => nearestOf(SIGNS, (s) => f()["sign_" + s.id]) },
        { id: "m2", title: "Localizar o bando", hint: "A trilha termina numa clareira grande. Na beira oeste h\xE1 uma sapopema alta, escondida entre moitas: um ponto seguro para observar. Chegue agachado (C) e aperte E.", target: () => P(MIRANTE.at) },
        { id: "m3", title: "Estudar os animais", progress: () => `${Math.min(3, patDone())}/3`, hint: () => this.studyHint(), target: () => g.player && dist(g.player.x, g.player.y, px3(66), px3(92)) < px3(24) ? null : P(MIRANTE.at) },
        { id: "m4", title: "Atravessar sem ser percebido", failed: () => !!this.dirty, hint: () => this.dirty ? "O bando percebeu voc\xEA. Afaste-se (para fora da clareira) ou fique agachado numa moita at\xE9 eles se acalmarem, e tente de novo. A passagem fica perigosa enquanto o bando estiver em alerta." : "Chegue a uma das passagens do outro lado: a do norte ou a das pedras, a nordeste. Ande agachado (C), use pedras, troncos e moitas para quebrar a linha de vis\xE3o e n\xE3o deixe o vento levar seu cheiro at\xE9 eles. Voc\xEA pode distrair o bando: sacudir o cip\xF3 do buritizeiro (sudoeste) ou rolar uma pedra solta (nordeste).", target: () => nearestOf(PASSAGES, () => false) },
        {
          id: "m5",
          title: "Liberar o caminho",
          progress: () => `${[f().tangleCut, f().varaTaken, f().toroPlaced].filter(Boolean).length}/3`,
          hint: () => this.puzzleHint(),
          target: () => {
            if (!f().tangleCut) return P(PUZ.tangle);
            if (!g.inv.has("vara") && !f().trunkMoved) return P(PUZ.pole);
            if (!f().toroPlaced) {
              const t = this.toroPos();
              const r = PUZ.rail;
              const s = f().toroS || 0;
              const L1 = (r[1][0] - r[0][0]) * S4;
              return s < L1 - 1 ? { x: t.x - 18, y: t.y } : { x: t.x, y: t.y + 18 };
            }
            return P(PUZ.lever);
          }
        },
        { id: "m6", title: "Sobreviver \xE0 investida", hint: () => f().chaseStarted ? "Corra (Shift) pela trilha para o sul. Desvie das \xE1rvores e ra\xEDzes, cuidado com a lama. Na bifurca\xE7\xE3o, a direita \xE9 mais curta mas tem tucum; a esquerda \xE9 mais longa e limpa. Atravesse o tronco sobre a grota e suba no lajedo de pedra: l\xE1 o bando n\xE3o sobe. Espa\xE7o esquiva das mordidas." : "Siga a trilha estreita para o sul, depois da grota do tronco. Fique atento.", target: () => f().chaseStarted ? P(CHASE.top) : P(CHASE.trigger) },
        { id: "m7", title: "Encontrar o rastro vermelho", progress: () => `${(f().hair ? 1 : 0) + (f().prints ? 1 : 0)}/2`, hint: "Des\xE7a do lajedo para a mata mais aberta ao sul. Procure pelos avermelhados presos num arbusto e examine as pegadas do veado no ch\xE3o. As marcas brilham quando voc\xEA chega perto.", target: () => !f().hair ? P(HAIR) : !f().prints ? P(DEER_PRINTS_E) : null },
        { id: "m8", title: "Alcan\xE7ar o segundo acampamento", hint: "Siga as pegadas do veado para o oeste, at\xE9 onde a mata se abre perto da \xE1gua.", target: () => P(EXIT) }
      ];
      this.secondary = [
        { id: "s_anta", title: "Observador da Floresta", hint: "H\xE1 uma anta no barreiro a noroeste da mata dos troncos ca\xEDdos. Observe-a de longe (aperte E a mais de 4 metros), agachado e sem deixar o vento levar seu cheiro.", target: () => null },
        { id: "s_silent", title: "Passos Silenciosos", failed: () => !!this.silentFail && !g.done.has("m4"), hint: 'Atravesse a clareira at\xE9 uma passagem sem que nenhum queixada fique desconfiado de voc\xEA (nenhum "?" amarelo por sua causa). Se falhar, volte para a trilha de entrada e tente de novo.', target: () => null },
        { id: "s_tracker", title: "Rastreador Experiente", progress: () => `${Math.min(3, cluesDone())}/3`, hint: "O veado deixou outras marcas pelo caminho, fora da trilha principal: brotos mordiscados, uma cama de capim, pegadas no barro, fezes. Procure com calma.", target: () => null }
      ];
    }
    currentMission() {
      return this.missions.find((m) => !this.g.done.has(m.id)) || null;
    }
    todCap() {
      const n = this.missions.filter((m) => this.g.done.has(m.id)).length;
      return 458 + n * 12;
    }
    studyHint() {
      const f = this.g.flags, found = Object.keys(PATTERNS).filter((k) => f["pat_" + k]).map((k) => PATTERNS[k].name.toLowerCase());
      return "Fique escondido perto do bando (moitas, troncos, pedras) e observe com calma: um c\xEDrculo aparece sobre o animal enquanto voc\xEA estuda o que ele faz. Repare em como comem, em quem vigia, em como mudam de lugar e no que fazem quando estranham um barulho." + (found.length ? ` <br><b>J\xE1 notou:</b> ${found.join("; ")}.` : "");
    }
    puzzleHint() {
      const f = this.g.flags;
      if (!f.tangleCut) return "Um tronco enorme fecha a grota ao norte. Para mov\xEA-lo vai precisar de uma alavanca. Comece cortando o emaranhado de galhos na beira do p\xE1tio (oeste da grota) com o fac\xE3o.";
      if (!this.g.inv.has("vara") && !f.trunkMoved) return "Debaixo dos galhos havia uma vara de pau-ferro. Pegue a vara.";
      if (!f.toroPlaced) return "A vara precisa de um apoio. Empurre o toro (tronco curto) andando contra ele: primeiro para o leste, at\xE9 ficar alinhado com a grota; depois para o norte, at\xE9 encostar no tronco grande.";
      return "Com o toro de apoio encostado no tronco, use a vara como alavanca (E junto ao toro).";
    }
    // ================= construção estática =================
    async buildStatic(progress) {
      const w = this.world = new World(TW3, TH3);
      await progress(0.08, "Abrindo trilhas de bicho\u2026");
      const cw = w.cw, ch = w.ch;
      const core = new Float32Array(cw * ch), band = new Float32Array(cw * ch);
      const nearT = new Float32Array(TW3 * TH3);
      for (const tr of TRAILS2) {
        for (let i = 0; i < tr.pts.length - 1; i++) {
          const [ax, ay] = tr.pts[i], [bx, by] = tr.pts[i + 1];
          const L2 = Math.hypot(bx - ax, by - ay), n = Math.ceil(L2 / 0.25);
          for (let k = 0; k <= n; k++) {
            const t = k / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
            const R = tr.r * 8, RB = (tr.r + tr.band) * 8;
            const c0x = Math.floor(x * 8 - RB), c1x = Math.ceil(x * 8 + RB), c0y = Math.floor(y * 8 - RB), c1y = Math.ceil(y * 8 + RB);
            for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
              if (cx < 0 || cy < 0 || cx >= cw || cy >= ch) continue;
              const dd = Math.hypot(cx + 0.5 - x * 8, cy + 0.5 - y * 8);
              const i2 = cy * cw + cx;
              if (dd < R) {
                const v = 1 - dd / R;
                if (v > core[i2]) core[i2] = v;
              }
              if (dd < RB) {
                const v = 1 - dd / RB;
                if (v > band[i2]) band[i2] = v;
              }
            }
            const RT = tr.r + 1.2;
            for (let ty = Math.floor(y - RT); ty <= Math.ceil(y + RT); ty++) for (let tx = Math.floor(x - RT); tx <= Math.ceil(x + RT); tx++) {
              if (tx < 0 || ty < 0 || tx >= TW3 || ty >= TH3) continue;
              const dd = Math.hypot(tx + 0.5 - x, ty + 0.5 - y) / RT;
              if (dd < 1) nearT[ty * TW3 + tx] = Math.max(nearT[ty * TW3 + tx], 1 - dd);
            }
          }
        }
      }
      this.nearTrail = (tx, ty) => nearT[(ty | 0) * TW3 + (tx | 0)] || 0;
      await progress(0.16, "Fechando a mata\u2026");
      const G = GORGE, L = LAJEDO, V = VARZEA;
      w.generate((tx, ty) => {
        const n = fbm(tx * 0.15, ty * 0.15, 3, 3), n2 = valueNoise(tx * 0.6, ty * 0.6, 8);
        const ci = Math.floor(ty * 8) * cw + Math.floor(tx * 8);
        const ev = inEll(tx, ty, V) + (fbm(tx * 0.35, ty * 0.35, 19, 2) - 0.5) * 0.9;
        if (ev < 1) return [T.CREEK, clamp((1 - ev) * 1.6, 0, 1)];
        if (ev < 1.5 && ty > 106) return [T.MUD];
        if (ty > GULLY.y0 + (n - 0.5) * 0.5 && ty < GULLY.y1 + (n2 - 0.5) * 0.3 && tx > GULLY.x0) return [T.GULLY, clamp(1 - Math.abs(ty - (GULLY.y0 + GULLY.y1) / 2) / 2, 0, 1)];
        if (ty > G.y0 && ty < G.y1) {
          const ax = Math.abs(tx - G.x);
          if (tx > G.ditch.x0 && tx < G.ditch.x1 && ty < G.ditch.y1) return [T.GULLY, 0.6];
          if (ax <= G.half) return [T.DIRT];
          if (ax < G.wall + (n - 0.5) * 3 && ty > G.y0 + (n2 - 0.5) * 0.8 && ty < G.y1 - 0.2 + (n - 0.5) * 1.2) return [T.ROCK];
          if (ax < G.half + 1.2) return [T.ROCK];
        }
        if (inEll(tx, ty, L) < 1 + (n - 0.5) * 0.15 || Math.abs(tx - BRIDGE2.x) < 2 && ty > 99.4 && ty < 101.4) return [T.STONE];
        const inArea = AREAS.find((a) => inEll(tx, ty, a) < 1 + (n - 0.5) * 0.35);
        const walk = band[ci] > 0.02 || inArea;
        if (!walk) return [T.THICKET];
        if (inEll(tx, ty, { x: POND.x, y: POND.y, rx: POND.r, ry: POND.r * 0.8 }) < 1) return [T.CREEK, 0.5];
        const tf = core[ci];
        const mudD = tx > MUD_D.x0 && tx < MUD_D.x1 && ty > MUD_D.y0 + (n - 0.5) && ty < MUD_D.y1 + (n2 - 0.5);
        if (mudD) return [T.MUD];
        if (inArea && inArea.t === "mud") return [T.MUD];
        if (inEll(tx, ty, { x: 70, y: 96.2, rx: 3.4, ry: 2 }) < 1 + (n - 0.5) * 0.6) return [T.MUD];
        if (tf > 0.42 + (n2 - 0.5) * 0.3) return [T.DIRT];
        if (inArea && inArea.t === "clear") return [T.CLEAR];
        if (inArea && inArea.t === "meadow") return [n > 0.5 ? T.GRASS : T.FLOOR];
        return [T.FLOOR];
      });
      w.waterTiles = new Uint8Array(TW3 * TH3);
      for (let ty = 0; ty < TH3; ty++) for (let tx = 0; tx < TW3; tx++) {
        const t = w.terrainAt(tx * 16 + 8, ty * 16 + 8);
        w.waterTiles[ty * TW3 + tx] = t === T.RIVER ? 1 : t === T.CREEK ? 2 : 0;
      }
      await progress(0.32, "Plantando a floresta\u2026");
      this.placeVegetation();
      await progress(0.55, "Derrubando troncos\u2026");
      this.placeProps();
      await progress(0.68, "Espalhando folhas e pegadas\u2026");
      const gctx = w.renderGround();
      this.decorateGround(gctx);
      await progress(0.9, "Desenhando o mapa\u2026");
      w.buildDensityCanvas();
      w.buildMiniMap();
      Sprites.get("icon:vara", () => icon2("vara"));
      Sprites.get("icon:pelos", () => icon2("pelos"));
      await progress(0.98, "Quase l\xE1\u2026");
    }
    addCover(x, y, r, occ = true) {
      const c = { x, y, r };
      this.covers.push(c);
      const k = (x / 64 | 0) + "," + (y / 64 | 0);
      if (!this.coverGrid.has(k)) this.coverGrid.set(k, []);
      this.coverGrid.get(k).push(c);
      if (occ) this.occBushes.push(c);
    }
    isInCover(x, y) {
      const gx = x / 64 | 0, gy = y / 64 | 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const a = this.coverGrid.get(gx + i + "," + (gy + j));
        if (a) {
          for (const c of a) if ((x - c.x) ** 2 + ((y - c.y) * 1.4) ** 2 < c.r * c.r) return true;
        }
      }
      return false;
    }
    // moitas de esconderijo bloqueiam a visão quando o jogador está agachado
    occludes(x, y, crouched) {
      if (!crouched) return false;
      for (const c of this.occBushes) if ((x - c.x) ** 2 + ((y - c.y) * 1.4) ** 2 < (c.r * 0.8) ** 2) return true;
      return false;
    }
    tree(x, y, size, seed, collide = true) {
      const w = this.world, v = seed % 6;
      let th, tw2, bt, cr, pal;
      if (size === "big") {
        th = 36 + v % 3 * 4;
        tw2 = 9;
        bt = 7 + v % 2 * 2;
        cr = 36 + v % 3 * 4;
        pal = GREENS.deep;
      } else if (size === "mid") {
        th = 24 + v % 3 * 3;
        tw2 = 6;
        bt = v % 2 ? 3 : 0;
        cr = 22 + v % 3 * 3;
        pal = v % 2 ? GREENS.mid : GREENS.olive;
      } else {
        th = 15 + v % 2 * 3;
        tw2 = 4;
        bt = 0;
        cr = 13 + v % 2 * 2;
        pal = GREENS.light;
      }
      const trunk = Sprites.get(`tr:${size}:${v}`, () => trunkSprite(500 + v * 13 + size.length, th, tw2, bt, size === "small" ? ["#4a3a2a", "#5e4a36", "#76604a", "#8e785e"] : void 0));
      const crown = Sprites.get(`cr:${size}:${v}`, () => crownSprite(900 + v * 31 + size.length * 7, cr, pal));
      const d = w.addDrawable({ x, y, sprite: trunk, ax: trunk.width / 2, ay: trunk.height - 2, crown: { sprite: crown, dx: 0, dy: -th - cr * 0.3, r: cr, h: th }, kind: "tree", size });
      if (collide) w.addCollider({ x, y: y - 2, r: tw2 / 2 + (bt ? bt * 0.6 : 0) + 1 });
      w.addDensity(x, y - th - cr * 0.3, cr * 1.05, size === "big" ? 1 : 0.8);
      return d;
    }
    palm(x, y, kind, v, collide = true) {
      const w = this.world;
      const s = kind === "acai" ? Sprites.get("pa:acai:" + v % 5, () => acaiSprite(70 + v % 5)) : kind === "buriti" ? Sprites.get("pa:bur:" + v % 3, () => buritiSprite(80 + v % 3)) : Sprites.get("pa:emb:" + v % 4, () => embaubaSprite(90 + v % 4));
      w.addDrawable({ x, y, sprite: s, ax: s.width / 2, ay: s.height - 2, shadow: { rx: kind === "buriti" ? 14 : 10, ry: 4, dx: -8, len: 10 } });
      if (collide) w.addCollider({ x, y: y - 1, r: kind === "buriti" ? 3 : 2 });
      w.addDensity(x, y - s.height * 0.75, kind === "buriti" ? 22 : 16, 0.35);
    }
    plant(x, y, kind, v, cover = true) {
      const w = this.world;
      let s;
      if (kind === "bush") s = Sprites.get("bu:" + v % 6, () => bushSprite(200 + v % 6, 7 + v % 3, v % 2 ? GREENS.mid : GREENS.light));
      else if (kind === "bigbush") s = Sprites.get("bb:" + v % 3, () => bushSprite(260 + v % 3, 11, GREENS.mid));
      else if (kind === "dry") s = Sprites.get("dry:" + v % 3, () => bushSprite(280 + v % 3, 8 + v % 2, DRY));
      else if (kind === "fern") s = Sprites.get("fe:" + v % 4, () => fernSprite(300 + v % 4));
      else if (kind === "heliconia") s = Sprites.get("he:" + v % 3, () => heliconiaSprite(400 + v % 3));
      else if (kind === "tucum") s = Sprites.get("tu:" + v % 2, () => tucumSprite(420 + v % 2));
      w.addDrawable({ x, y, sprite: s, ax: s.width / 2, ay: s.height - 2, kind });
      if (cover && kind === "bush") this.addCover(x, y - 4, 10 + v % 3, false);
      return s;
    }
    placeVegetation() {
      const w = this.world, rng = mulberry32(2024);
      const terr = (tx, ty) => w.terrainAt(tx * 16, ty * 16);
      const keep = (tx, ty, r = 0) => {
        const pts = [MIRANTE.at, VINE.at, VINE.palm, STONE_PUSH.at, PUZ.tangle, ...PUZ.rail, PUZ.lever, HAIR, DEER_PRINTS_E, FINAL_TREE, EXIT, MYSTERY, ...SIGNS.map((s) => s.at), ...CLUES.map((c) => c.at), ...HERD_ROUTE, TAPIR_HOME, CHASE.hollow];
        return pts.some(([x, y]) => Math.hypot(tx - x, ty - y) < 2.6 + r);
      };
      const zones = [[101, 57, 7], [80, 48, 6.5], [134, 99, 4], [104, 51, 5], [124.4, 111, 4], [103.6, 112, 5], [124, 53, 4]];
      const keepZone = (tx, ty) => zones.some(([x, y, r]) => Math.hypot(tx - x, ty - y) < r);
      for (let ty = 2; ty < TH3 - 1; ty += 1.7) for (let tx = 1; tx < TW3 - 1; tx += 1.7) {
        const x = tx + rng() * 1.5, y = ty + rng() * 1.5;
        const t = terr(x, y);
        if (t === T.THICKET) {
          let edge = false;
          for (const [dx, dy] of [[1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6], [2.6, 0], [-2.6, 0], [0, 2.6]]) {
            const t2 = terr(x + dx, y + dy);
            if (t2 !== T.THICKET && t2 !== T.ROCK && t2 !== 255) {
              edge = true;
              break;
            }
          }
          const r2 = rng();
          if (edge && (keep(x, y, 2.2) || keepZone(x, y))) {
            if (rng() < 0.8) this.plant(px3(x), px3(y), rng() < 0.6 ? "bigbush" : "fern", rng() * 9 | 0, false);
            continue;
          }
          if (edge) {
            if (r2 < 0.34) this.tree(px3(x), px3(y), rng() < 0.4 ? "big" : "mid", rng() * 6 | 0, false);
            else if (r2 < 0.5) this.palm(px3(x), px3(y), rng() < 0.6 ? "acai" : "embauba", rng() * 9 | 0, false);
            else if (r2 < 0.62) this.tree(px3(x), px3(y), "small", rng() * 6 | 0, false);
            if (rng() < 0.85) this.plant(px3(x + (rng() - 0.5)), px3(y + 0.4), rng() < 0.6 ? "bigbush" : rng() < 0.5 ? "fern" : "heliconia", rng() * 9 | 0, false);
            if (rng() < 0.6) this.plant(px3(x + (rng() - 0.5) * 1.2), px3(y - 0.5), rng() < 0.7 ? "bush" : "fern", rng() * 9 | 0, false);
          } else if (r2 < 0.3) this.tree(px3(x), px3(y), rng() < 0.5 ? "big" : "mid", rng() * 6 | 0, false);
          else if (r2 < 0.42) this.palm(px3(x), px3(y), "acai", rng() * 9 | 0, false);
          continue;
        }
        if (t === T.ROCK || t === T.STONE || t === T.GULLY || t === 255) continue;
        if (keep(x, y)) continue;
        const nt = this.nearTrail(x, y);
        if (t === T.MUD) {
          if (nt < 0.1 && rng() < 0.2 && !inEll(x, y, B_CENTER, 0.8)) this.palm(px3(x), px3(y), rng() < 0.5 ? "buriti" : "acai", rng() * 9 | 0);
          continue;
        }
        if (t === T.RIVER || t === T.CREEK) continue;
        if (t === T.CLEAR && inEll(x, y, B_CENTER, 1) >= 1) {
          if (rng() < 0.12) this.plant(px3(x), px3(y), rng() < 0.6 ? "fern" : "heliconia", rng() * 9 | 0);
          continue;
        }
        if (inEll(x, y, B_CENTER, 1) < 1) {
          if (inEll(x, y, B_CENTER, 1) > 0.65 && rng() < 0.18) this.plant(px3(x), px3(y), rng() < 0.6 ? "fern" : "heliconia", rng() * 9 | 0);
          continue;
        }
        if (nt > 0.05) {
          if (nt < 0.4 && rng() < 0.3) this.plant(px3(x), px3(y), rng() < 0.4 ? "fern" : "bush", rng() * 9 | 0);
          continue;
        }
        if (x > 120 && y > 40 && y < 101) continue;
        const r = rng();
        const meadow = y > 106 && x > 98;
        if (meadow) {
          if (r < 0.06) this.tree(px3(x), px3(y), "mid", rng() * 6 | 0);
          else if (r < 0.1) this.palm(px3(x), px3(y), "embauba", rng() * 9 | 0);
          else if (r < 0.28) this.plant(px3(x), px3(y), rng() < 0.5 ? "fern" : "heliconia", rng() * 9 | 0);
          continue;
        }
        if (r < 0.1) this.tree(px3(x), px3(y), "big", rng() * 6 | 0);
        else if (r < 0.32) this.tree(px3(x), px3(y), "mid", rng() * 6 | 0);
        else if (r < 0.4) this.tree(px3(x), px3(y), "small", rng() * 6 | 0);
        else if (r < 0.48) this.palm(px3(x), px3(y), rng() < 0.7 ? "acai" : "embauba", rng() * 9 | 0);
        else this.plant(px3(x), px3(y), rng() < 0.55 ? "bush" : rng() < 0.6 ? "fern" : "heliconia", rng() * 9 | 0);
      }
      this.canopyA = [];
      for (const [x, y, s] of [[18, 98.4, "big"], [23, 104.5, "big"], [29, 102.6, "mid"], [34, 92.3, "big"], [16, 101.6, "mid"]]) {
        const d = this.tree(px3(x), px3(y), s, x * 3 | 0);
        this.canopyA.push({ x: d.x, y: d.y + d.crown.dy });
      }
      this.tree(px3(MIRANTE.tree[0]), px3(MIRANTE.tree[1]), "big", 2);
      for (const [x, y, s] of SLALOM_TREES) this.tree(px3(x), px3(y), s, x * 7 + y | 0);
      this.tree(px3(FINAL_TREE[0]), px3(FINAL_TREE[1]), "big", 5);
    }
    placeProps() {
      const w = this.world;
      const add = (x, y, s, o = {}) => w.addDrawable({ x, y, sprite: s, ax: o.ax ?? s.width / 2, ay: o.ay ?? s.height - 2, ...o });
      for (const [x, y, r] of ROCKS_B) {
        const s = Sprites.get("boulder:" + r, () => rockSprite(640 + r, r));
        add(px3(x), px3(y), s, { shadow: { rx: r * 1.1, ry: 3, len: 6 } });
        w.addCollider({ x: px3(x) - r * 0.95, y: px3(y) - r * 0.55, w: r * 1.9, h: r * 0.75, occ: true });
        this.addCover(px3(x), px3(y) + 6, r * 1.1, false);
      }
      for (const [x, y, len] of LOGS_B) {
        const s = Sprites.get("log:" + len, () => logSprite(len, len, 5));
        add(px3(x), px3(y), s, { ay: s.height - 3, shadow: { rx: len * 0.5, ry: 3, len: 4 } });
        w.addCollider({ x: px3(x) - len / 2, y: px3(y) - 9, w: len, h: 8, occ: true, low: true });
      }
      for (const [x, y] of BUSHES_B) {
        this.plant(px3(x) - 5, px3(y) + 1, "bigbush", x * 3 | 0, false);
        this.plant(px3(x) + 6, px3(y), "bush", y * 5 | 0, false);
        this.addCover(px3(x), px3(y) - 3, 15);
      }
      this.dryZones = DRY_ZONES.map(([x, y, r]) => ({ x: px3(x), y: px3(y), r: r * S4, cd: 0 }));
      for (const z of this.dryZones) for (let k = 0; k < 5; k++) {
        const a = k * 1.3, rr = z.r * (0.2 + k % 3 * 0.3);
        this.plant(z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr * 0.6, "dry", k + (z.x | 0), false);
      }
      this.tree(px3(VINE.at[0]) - 6, px3(VINE.at[1]) - 6, "mid", 3);
      this.palm(px3(VINE.palm[0]), px3(VINE.palm[1]), "buriti", 1);
      for (const [x, y] of [[78.5, 80.2], [79.6, 81.2], [76, 80.8]]) {
        const s = Sprites.get("rock:3", () => rockSprite(603, 6));
        add(px3(x), px3(y), s);
      }
      for (const [x, y, len, r] of LOGS_C) {
        const s = Sprites.get(`logc:${len}:${r}`, () => logSprite(len + 7, len, r));
        add(px3(x), px3(y), s, { ay: s.height - 3, shadow: { rx: len * 0.5, ry: 3, len: 4 } });
        w.addCollider({ x: px3(x) - len / 2, y: px3(y) - r * 2 + 1, w: len, h: r * 2 - 1, occ: true, low: true });
      }
      for (const [x, y, wd] of ROOTS_C.concat(ROOTS_D)) {
        const s = Sprites.get("root:" + wd, () => rootSprite(wd, wd));
        add(px3(x), px3(y), s, { ay: s.height - 2 });
        w.addCollider({ x: px3(x) - wd / 2 + 2, y: px3(y) - 5, w: wd - 4, h: 4 });
      }
      const ft = Sprites.get("fallen", () => fallenTreeSprite(77));
      add(px3(82), px3(66.6), ft, { ax: 52, ay: 24, shadow: { rx: 48, ry: 5, dy: 2, len: 6 } });
      w.addCollider({ x: px3(82) - 50, y: px3(66.6) - 12, w: 98, h: 11, occ: true, low: true });
      const rng = mulberry32(77);
      for (let i = 0; i < 140; i++) {
        const tx = 96 + rng() * 16, ty = 46 + rng() * 13;
        const t = w.terrainAt(px3(tx), px3(ty));
        if (t !== T.ROCK) continue;
        const big = Math.abs(tx - GORGE.x) > 2.6 && rng() < 0.6;
        const rr = big ? 7 + i % 4 * 2 : 3 + i % 4;
        const s = Sprites.get("rk:" + rr + ":" + i % 3, () => rockSprite(620 + rr * 3 + i % 3, rr));
        add(px3(tx), px3(ty), s);
        if (rng() < 0.25) this.plant(px3(tx) + 3, px3(ty) - 2, "fern", i, false);
      }
      for (let i = 0; i < 30; i++) {
        const a = rng() * Math.PI * 2, k = 0.6 + rng() * 0.45;
        const tx = LAJEDO.x + Math.cos(a) * LAJEDO.rx * k, ty = LAJEDO.y + Math.sin(a) * LAJEDO.ry * k;
        const s = Sprites.get("rock:" + i % 5, () => rockSprite(600 + i % 5, 3 + i % 5));
        if (Math.abs(tx - BRIDGE2.x) < 3 && ty < LAJEDO.y) continue;
        add(px3(tx), px3(ty), s);
        if (i % 3 === 0) w.addCollider({ x: px3(tx), y: px3(ty) - 2, r: 3 });
      }
      const steps = Sprites.get("steps", () => stepsSprite());
      add(px3(BRIDGE2.x), px3(101.2), steps, { ay: 14, layer: "ground" });
      for (const [x, y] of TUCUM_D) this.plant(px3(x), px3(y), "tucum", x * 5 | 0, false);
      this.twigs = [];
      const tr = mulberry32(99);
      for (const t of TRAILS2.filter((q) => ["A", "PN", "PNE", "C2", "E"].includes(q.id))) {
        for (let i = 0; i < t.pts.length - 1; i++) {
          if (tr() < 0.4) continue;
          const [ax, ay] = t.pts[i], [bx, by] = t.pts[i + 1];
          const k = 0.3 + tr() * 0.4, x = px3(ax + (bx - ax) * k) + (tr() - 0.5) * 8, y = px3(ay + (by - ay) * k) + (tr() - 0.5) * 8;
          const s = Sprites.get("twig:" + i % 3, () => twigSprite(i));
          add(x, y, s, { ax: 5, ay: 3, layer: "ground" });
          this.twigs.push({ x, y, cd: 0 });
        }
      }
    }
    decorateGround(ctx) {
      const w = this.world, rng = mulberry32(5151);
      ctx.strokeStyle = "rgba(40,28,16,0.75)";
      ctx.lineWidth = 2;
      for (const d of w.drawables) {
        if (d.kind !== "tree" || d.size !== "big") continue;
        if (w.terrainAt(d.x, d.y) === T.THICKET && rng() < 0.6) continue;
        for (let k = 0; k < 5; k++) {
          const a = rng() * Math.PI * 2, L2 = 14 + rng() * 14;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y - 2);
          ctx.quadraticCurveTo(d.x + Math.cos(a) * L2 * 0.5 + (rng() - 0.5) * 6, d.y + Math.sin(a) * L2 * 0.25, d.x + Math.cos(a) * L2, d.y + Math.sin(a) * L2 * 0.45);
          ctx.stroke();
        }
      }
      for (let i = 0; i < 16e3; i++) {
        const x = rng() * w.W, y = rng() * w.H, t = w.terrainAt(x, y);
        if (t === T.FLOOR || t === T.CLEAR) {
          const r = rng();
          if (r < 0.45) {
            ctx.fillStyle = ["#7a5428", "#8e6a30", "#5e4420", "#9a7a3a", "#6a3a1e"][rng() * 5 | 0];
            ctx.fillRect(x | 0, y | 0, 2 + (rng() * 2 | 0), 1);
            ctx.fillRect((x | 0) + 1, (y | 0) + 1, 1, 1);
          } else if (r < 0.7) {
            ctx.fillStyle = "#3f6a2a";
            ctx.fillRect(x | 0, y | 0, 1, 2);
            ctx.fillStyle = "#5a8a3a";
            ctx.fillRect((x | 0) - 1, y | 0, 1, 1);
            ctx.fillRect((x | 0) + 1, y | 0, 1, 1);
          } else if (r < 0.8) {
            ctx.fillStyle = "#4a3a24";
            ctx.fillRect(x | 0, y | 0, 4, 1);
          }
        } else if (t === T.THICKET) {
          ctx.fillStyle = rng() < 0.5 ? "#1e2e14" : "#2c3a1a";
          ctx.fillRect(x | 0, y | 0, 2, 2);
          if (rng() < 0.3) {
            ctx.fillStyle = "#3a5a26";
            ctx.fillRect(x | 0, (y | 0) - 1, 1, 3);
          }
        } else if (t === T.GRASS) {
          ctx.fillStyle = rng() < 0.5 ? "#6a9a3a" : "#4e7a2a";
          ctx.fillRect(x | 0, y | 0, 1, 2);
          ctx.fillRect((x | 0) + 2, (y | 0) + 1, 1, 2);
          if (rng() < 0.06) {
            ctx.fillStyle = ["#f0e070", "#f0f0f0", "#e07ab0", "#ff8a4a"][rng() * 4 | 0];
            ctx.fillRect(x | 0, (y | 0) - 1, 1, 1);
          }
        } else if (t === T.MUD && rng() < 0.4) {
          ctx.fillStyle = rng() < 0.5 ? "rgba(40,30,18,0.6)" : "rgba(120,100,70,0.4)";
          ctx.fillRect(x | 0, y | 0, 2, 1);
        }
      }
      for (let y = 0; y < w.H; y += 2) for (let x = 0; x < w.W; x += 2) {
        const t = w.terrainAt(x, y);
        if (t === T.GULLY && w.terrainAt(x, y - 4) !== T.GULLY) {
          ctx.fillStyle = "rgba(120,96,60,0.8)";
          ctx.fillRect(x, y, 2, 2);
        }
        if (t === T.STONE && w.terrainAt(x, y + 4) !== T.STONE) {
          ctx.fillStyle = "rgba(30,28,22,0.75)";
          ctx.fillRect(x, y, 2, 3);
        }
        if (t === T.STONE && w.terrainAt(x, y - 4) !== T.STONE) {
          ctx.fillStyle = "rgba(200,196,170,0.6)";
          ctx.fillRect(x, y, 2, 1);
        }
        if (t === T.ROCK && w.terrainAt(x, y + 4) !== T.ROCK) {
          ctx.fillStyle = "rgba(30,28,22,0.6)";
          ctx.fillRect(x, y, 2, 2);
        }
      }
      const churn = (cx, cy, r, n) => {
        for (let i = 0; i < n; i++) {
          const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * r;
          const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.6;
          ctx.fillStyle = rng() < 0.5 ? "#3a2814" : "#5a4024";
          ctx.fillRect(x | 0, y | 0, 2 + (rng() * 3 | 0), 2);
          if (rng() < 0.3) {
            ctx.fillStyle = "#7a5a34";
            ctx.fillRect(x | 0, (y | 0) - 1, 2, 1);
          }
        }
      };
      churn(px3(19.5), px3(101), 26, 160);
      for (const [x, y] of [[23, 101], [33, 97], [44, 90], [61, 94], [70, 89], [64, 99], [57, 91], [73, 97], [124, 53]]) churn(px3(x), px3(y), 18 + rng() * 14, 90);
      const pk = Sprites.get("trk:queixada", () => trackSprite("queixada"));
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < 70; i++) {
        const tr = TRAILS2[[0, 2, 0, 9][i % 4]];
        const k = rng() * (tr.pts.length - 1), i0 = Math.floor(k), f = k - i0;
        const [ax, ay] = tr.pts[i0], [bx, by] = tr.pts[Math.min(i0 + 1, tr.pts.length - 1)];
        ctx.drawImage(pk, Math.round(px3(ax + (bx - ax) * f) - 14 + (rng() - 0.5) * 20), Math.round(px3(ay + (by - ay) * f) - 11 + (rng() - 0.5) * 12));
      }
      for (let i = 0; i < 30; i++) ctx.drawImage(pk, Math.round(px3(66) + (rng() - 0.5) * 420), Math.round(px3(92) + (rng() - 0.5) * 260));
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(30,24,18,0.6)";
      ctx.beginPath();
      ctx.ellipse(px3(10), px3(108.3), 9, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(80,70,60,0.7)";
      for (let i = 0; i < 12; i++) ctx.fillRect(px3(10) - 6 + rng() * 12, px3(108.3) - 3 + rng() * 6, 2, 1);
    }
    // ================= estado dinâmico =================
    carryIn(data) {
      const c = data.carry || {};
      const items = new Map(c.inv?.items || []);
      for (const id of EQUIP2) if (!items.has(id)) items.set(id, 1);
      if (!items.has("fumo")) items.set("fumo", 1);
      for (const id of ["galhos", "tabua", "cipo"]) items.delete(id);
      return {
        done: [],
        flags: {},
        tracks: c.tracks || [],
        tod: this.todStart,
        inv: { items: [...items], found: c.inv?.found || c.found || [] },
        res: { water: c.res?.water ?? 2, food: Math.max(2, c.res?.food ?? 2), ammo: c.res?.ammo ?? 5 }
      };
    }
    setupDynamic(fromSave) {
      const g = this.g, w = this.world, f = g.flags;
      f.score = f.score || 0;
      f.journal = f.journal || [];
      this.dirty = false;
      this.silentFail = false;
      this.silentAttempt = false;
      this.studyT = {};
      this.studyTarget = null;
      this.gateMsgT = 0;
      this.bumpT = 0;
      this.bumpCd = 0;
      this.distractCd = { vine: 0, stone: 0 };
      this.distantT = 6;
      this.lastPos = null;
      this.chaseActive = false;
      this.chaseEnded = false;
      this.finished = false;
      this.rollingStone = null;
      this.fruitT = 0;
      this.capT = {};
      this.timers = [];
      this.herds = [];
      g.lights = [];
      g.onAnimalEvent = (a, ev) => this.onAnimalEvent(a, ev);
      for (const s of SIGNS) {
        const p = P(s.at);
        g.interactables.push({ x: p.x, y: p.y, r: 24, py: 12, label: () => f["sign_" + s.id] ? s.name : "Examinar o sinal", enabled: () => !f["sign_" + s.id], action: () => this.examineSign(s) });
      }
      const my = P(MYSTERY);
      g.interactables.push({ x: my.x, y: my.y, r: 22, py: 12, label: "Examinar as pegadas do veado", enabled: () => !f.mystery, action: () => this.examineMystery() });
      for (const c of CLUES) {
        const p = P(c.at);
        g.interactables.push({ x: p.x, y: p.y, r: 22, py: 12, label: "Examinar", enabled: () => !f[c.id], action: () => this.examineClue(c) });
      }
      const animals = [];
      for (const [x, y] of [[20, 106], [33, 101], [112, 115], [96, 61]]) animals.push(new Animal(g, "cotia", px3(x), px3(y)));
      for (const [x, y] of [[16, 100.5], [28, 96.8], [106, 46.5], [120, 110]]) for (let i = 0; i < 2; i++) animals.push(new Animal(g, "jacu", px3(x) + i * 12, px3(y) + i * 5));
      for (const a of animals) {
        g.animals.push(a);
        g.entities.push(a);
        g.updaters.push(a);
        g.airEntities.push(a);
      }
      const tr = new MonkeyTroop(g, this.canopyA, 3);
      g.updaters.push(tr);
      g.airEntities.push(tr);
      const fo = new Flyovers(g);
      g.updaters.push(fo);
      g.airEntities.push(fo);
      for (const [x, y] of [[12, 104], [24, 101], [52, 92], [80, 50], [116, 112], [128, 113], [108, 113]]) {
        const b = new Butterfly(g, px3(x), px3(y));
        g.updaters.push(b);
        g.entities.push(b);
      }
      const B = B_CENTER;
      const herdB = this.herdB = new Herd(g, {
        id: "clareira",
        x: px3(HERD_ROUTE[0][0]),
        y: px3(HERD_ROUTE[0][1]),
        route: HERD_ROUTE.map(P),
        moveEvery: [32, 48],
        firstMove: 24,
        leash: { x: px3(B.x), y: px3(B.y), r: px3(19) },
        occludes: (x, y, c) => this.occludes(x, y, c),
        maxChasers: 4,
        biteDamage: 9,
        smellMul: 0.8,
        on: {
          detect: (m, r) => this.onHerdDetect(herdB, m, r),
          chase: (m) => this.onHerdChase(herdB, m),
          calm: () => this.onHerdCalm(herdB),
          giveUp: (m, why) => this.onGiveUp(herdB, m, why),
          move: () => this.onHerdMove(herdB)
        }
      });
      const R = mulberry32(31);
      const slot = (i, n) => {
        const a = i / n * Math.PI * 2 + R() * 0.5, rr = 12 + R() * 20;
        return { x: Math.cos(a) * rr * 1.25, y: Math.sin(a) * rr * 0.75 };
      };
      const nB = f.crossSeen ? 12 : 6;
      for (let i = 0; i < nB; i++) {
        const s = slot(i, 12);
        const m = herdB.add(herdB.anchor.x + s.x, herdB.anchor.y + s.y, { slot: s, juv: i === 3 || i === 9, sentinel: i === 0, rng: R });
        if (fromSave || true) m.enter(i % 3 ? S2.FORAGING : S2.IDLE);
      }
      this.herds.push(herdB);
      if (!f.crossSeen) {
        const col = this.herdCol = new Herd(g, {
          id: "coluna",
          x: px3(39.9),
          y: px3(102.4),
          route: [[39.9, 102.4], [40.4, 99.5], [41.6, 95], [44, 89.2], [49, 86.2], [58, 90]].map(P),
          moveEvery: [0.05, 0.1],
          firstMove: 9999,
          spread: 0.45,
          walkMul: 1.9,
          ignorePlayer: true,
          leash: { x: px3(46), y: px3(96), r: px3(22) },
          maxChasers: 3,
          on: { detect: (m, r) => this.onHerdDetect(col, m, r), chase: (m) => this.onHerdChase(col, m), calm: () => this.onHerdCalm(col), arrive: (pt) => this.onColumnArrive(pt) }
        });
        for (let i = 0; i < 6; i++) {
          const s = slot(i + 6, 12);
          col.add(col.anchor.x + s.x * 0.45, col.anchor.y + s.y * 0.45, { slot: s, juv: i === 3, rng: R }).enter(S2.IDLE);
        }
        this.herds.push(col);
      } else this.herdCol = null;
      const herdD = this.herdD = new Herd(g, {
        id: "fuga",
        x: px3(CHASE.hollow[0]),
        y: px3(CHASE.hollow[1]),
        leash: { x: 0, y: 0, r: Infinity },
        lostSight: 7,
        smellMul: 2.2,
        aggression: 1.6,
        maxChasers: 6,
        biteDamage: 7,
        mercy: true,
        chaseMul: 0.93,
        biteInterval: 1.1,
        blocked: (x, y) => y > px3(100.25),
        safe: (x, y) => y > px3(100.7),
        sleepDist: 900,
        flowCells: 14e3,
        on: { detect: (m, r) => this.onHerdDetect(herdD, m, r), chase: (m) => this.onHerdChase(herdD, m), calm: () => this.onHerdCalm(herdD), giveUp: (m, why) => this.onGiveUp(herdD, m, why), bite: () => {
          g.camera.shake(1.2, 0.2);
          this.bites = (this.bites || 0) + 1;
        } }
      });
      for (let i = 0; i < 5; i++) {
        const s = { x: (i - 2) * 9, y: (i % 2 - 0.5) * 12 };
        const m = herdD.add(herdD.anchor.x + s.x, herdD.anchor.y + s.y, { slot: s, rng: R });
        m.pers.bold = Math.max(m.pers.bold, 1.05);
        m.enter(S2.FORAGING);
      }
      this.herds.push(herdD);
      for (const h of this.herds) {
        g.updaters.push(h);
        for (const m of h.members) {
          g.entities.push(m);
          g.animals.push(m);
        }
      }
      this.tapir = new Tapir(g, P(TAPIR_HOME), this);
      g.entities.push(this.tapir);
      g.updaters.push(this.tapir);
      const self = this;
      g.interactables.push({
        get x() {
          return self.tapir.x;
        },
        get y() {
          return self.tapir.y;
        },
        r: 170,
        py: 20,
        label: () => dist(self.tapir.x, self.tapir.y, g.player.x, g.player.y) < 60 ? "Perto demais: afaste-se" : "Observar a anta de longe",
        enabled: () => self.tapir.visible && !g.done.has("s_anta") && self.tapir.state !== "flee",
        action: () => this.observeTapir()
      });
      const mir = P(MIRANTE.at);
      g.interactables.push({ x: mir.x, y: mir.y, r: 26, py: 30, label: "Observar o bando do alto da sapopema", enabled: () => !g.done.has("m2"), action: () => this.observeFromMirante() });
      const vine = P(VINE.at);
      g.interactables.push({ x: vine.x, y: vine.y, r: 22, py: 26, label: () => this.distractCd.vine > g.time ? "O cip\xF3 ainda balan\xE7a\u2026" : "Sacudir o cip\xF3 do buritizeiro", enabled: () => true, action: () => this.useVine() });
      const sp = P(STONE_PUSH.at);
      g.interactables.push({ x: sp.x, y: sp.y, r: 22, py: 18, label: () => this.distractCd.stone > g.time ? "Procurar outra pedra solta\u2026" : "Rolar uma pedra solta barranco abaixo", enabled: () => true, action: () => this.useStone() });
      for (const ps of PASSAGES) {
        const [gx, gy, gw, gh] = ps.gate;
        w.blockers.push({ x: px3(gx), y: px3(gy), w: gw * S4, h: gh * S4, active: () => this.gateClosed() });
      }
      const trunk = P(PUZ.trunk);
      this.trunk = { x: trunk.x, y: trunk.y, rot: 0, a: 1 };
      if (f.trunkMoved) {
        const rt = P(PUZ.rollTo);
        this.trunk.x = rt.x;
        this.trunk.y = rt.y;
        this.trunk.rot = 0.35;
      }
      this.trunkCol = w.addCollider({ x: trunk.x - PUZ.trunkLen / 2, y: trunk.y - 8, w: PUZ.trunkLen, h: 10, dyn: true, off: !!f.trunkMoved });
      const big = Sprites.get("bigtrunk", () => logSprite(4040, PUZ.trunkLen + 18, 8));
      g.entities.push({ get x() {
        return self.trunk.x;
      }, get y() {
        return self.trunk.y;
      }, draw: (ctx) => {
        const t = self.trunk;
        ctx.save();
        ctx.translate(Math.round(t.x), Math.round(t.y));
        ctx.rotate(t.rot);
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.ellipse(0, 2, big.width / 2, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.drawImage(big, -Math.round(big.width / 2), -big.height + 4);
        ctx.restore();
      } });
      const tg = P(PUZ.tangle), tgs = Sprites.get("tangle", () => tangleSprite(8));
      this.tangleCol = w.addCollider({ x: tg.x - 14, y: tg.y - 7, w: 28, h: 8, dyn: true, off: !!f.tangleCut });
      g.entities.push({ x: tg.x, y: tg.y + 1, draw: (ctx) => {
        if (!f.tangleCut) ctx.drawImage(tgs, Math.round(tg.x - 18), Math.round(tg.y - 18));
      } });
      g.interactables.push({ x: tg.x, y: tg.y + 6, r: 24, py: 24, label: "Cortar o emaranhado de galhos", enabled: () => !f.tangleCut, action: () => this.cutTangle() });
      const pole = P(PUZ.pole), pls = Sprites.get("pole", () => poleSprite());
      g.entities.push({ x: pole.x, y: pole.y, draw: (ctx) => {
        if (f.tangleCut && !f.varaTaken) ctx.drawImage(pls, Math.round(pole.x - 15), Math.round(pole.y - 4));
      } });
      g.interactables.push({ x: pole.x, y: pole.y + 3, r: 22, py: 14, label: "Pegar a vara de pau-ferro", enabled: () => f.tangleCut && !f.varaTaken, action: () => {
        f.varaTaken = true;
        g.give("vara");
        g.ui.toast("Vara grossa de pau-ferro: n\xE3o verga. Serve de alavanca, se tiver apoio.", "tip", 4500);
      } });
      this.toroCol = w.addCollider({ x: 0, y: 0, w: 20, h: 8, dyn: true });
      this.placeToro(f.toroS || 0);
      const tos = Sprites.get("toro", () => toroSprite());
      g.entities.push({ get x() {
        return self.toroPos().x;
      }, get y() {
        return self.toroPos().y + 4;
      }, draw: (ctx) => {
        const t = self.toroPos();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.ellipse(t.x, t.y + 3, 11, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.drawImage(tos, Math.round(t.x - 12), Math.round(t.y - 9));
      } });
      const lv = P(PUZ.lever);
      g.interactables.push({ x: lv.x, y: lv.y, r: 26, py: 22, label: () => this.leverReady() ? "Usar a vara como alavanca" : "Examinar o tronco ca\xEDdo", enabled: () => !f.trunkMoved && (f.toroPlaced || dist(g.player.x, g.player.y, trunk.x, trunk.y) < 40), action: () => this.leverAction() });
      g.interactables.push({ x: trunk.x, y: trunk.y + 10, r: 22, py: 22, label: "Examinar o tronco ca\xEDdo", enabled: () => !f.trunkMoved && !f.toroPlaced, action: () => this.leverAction() });
      w.walkOverrides.push({ x: px3(BRIDGE2.x) - 11, y: px3(BRIDGE2.y0), w: 22, h: px3(BRIDGE2.y1) - px3(BRIDGE2.y0), active: () => true });
      const bl = Sprites.get("bridgelog", () => logVertSprite(31, px3(BRIDGE2.y1) - px3(BRIDGE2.y0) + 10, 6));
      this.bridgeSprite = bl;
      g.hazards = TUCUM_D.map(([x, y]) => ({ x: px3(x), y: px3(y) - 3, r: 9, type: "tucum" }));
      const hair = P(HAIR);
      this.plantHair = Sprites.get("bu:1", () => bushSprite(201, 8, GREENS.light));
      g.entities.push({ x: hair.x, y: hair.y, draw: (ctx) => {
        ctx.drawImage(this.plantHair, Math.round(hair.x - this.plantHair.width / 2), Math.round(hair.y - this.plantHair.height + 2));
        if (!f.hair) {
          ctx.fillStyle = "#c8502a";
          for (const [dx, dy] of [[-3, -8], [-2, -9], [2, -6], [3, -7], [0, -10]]) ctx.fillRect(Math.round(hair.x + dx), Math.round(hair.y + dy), 1, 2);
        }
      } });
      g.interactables.push({ x: hair.x, y: hair.y, r: 22, py: 22, label: "Examinar os pelos presos no espinho", enabled: () => !f.hair, action: () => this.examineHair() });
      const dp = P(DEER_PRINTS_E);
      g.interactables.push({ x: dp.x, y: dp.y, r: 22, py: 12, label: "Examinar as pegadas do veado", enabled: () => !f.prints, action: () => this.examinePrints() });
      this.setupTriggers();
      if (!fromSave) g.fade = 0;
      if (fromSave && f.chaseStarted && !g.done.has("m6")) this.resumeChase();
      if (g.done.has("m6")) for (const m of herdD.members) m.enter(S2.FORAGING);
    }
    setupTriggers() {
      const g = this.g, f = g.flags;
      g.triggers.push({ x: px3(31.5), y: px3(92.2), w: px3(5), h: px3(11), cond: () => !f.crossSeen, fn: () => this.crossingScene() });
      for (const ps of PASSAGES) {
        const p = P(ps.at);
        g.triggers.push({ x: p.x, y: p.y, r: 20, once: false, cond: () => !g.done.has("m4"), fn: () => this.reachPassage(ps) });
        g.triggers.push({ x: p.x, y: p.y + 20, r: 46, once: false, cond: () => this.gateClosed() && !g.done.has("m4"), fn: () => this.gateMessage() });
      }
      g.triggers.push({ x: px3(100), y: px3(60), r: 70, cond: () => !f.puzzleTip && g.done.has("m4"), fn: () => {
        f.puzzleTip = true;
        g.ui.toast("<b>Dica</b> \xB7 Um tronco enorme fecha a grota. Olhe em volta: galhos, uma vara, um toro solto\u2026", "tip", 6e3);
      } });
      g.triggers.push({ x: px3(116), y: px3(42), r: 40, cond: () => f.trunkMoved && !f.cpD, fn: () => {
        f.cpD = true;
        g.checkpoint("Trilha da fuga");
        g.audio.setMood("stealth");
        g.caption("Um cheiro azedo no ar... e sil\xEAncio demais", 0.6);
      } });
      g.triggers.push({ x: px3(CHASE.trigger[0]), y: px3(CHASE.trigger[1]), r: 30, cond: () => !f.chaseStarted && g.done.has("m5"), fn: () => this.startChase(true) });
      g.triggers.push({ x: px3(CHASE.cp2[0]), y: px3(CHASE.cp2[1]), r: 34, cond: () => f.chaseStarted && !f.chaseCp2 && !g.done.has("m6"), fn: () => {
        f.chaseCp2 = true;
        g.checkpoint("Bifurca\xE7\xE3o");
        g.caption("Esquerda: trilha longa e limpa. Direita: atalho no meio do tucum", 0);
      } });
      g.triggers.push({ x: px3(LAJEDO.x) - px3(7), y: px3(101.7), w: px3(14), h: px3(5), cond: () => !g.done.has("m6") && f.chaseStarted, fn: () => this.reachLajedo() });
      g.triggers.push({ x: px3(124), y: px3(109), r: 70, cond: () => !f.eTip && g.done.has("m6"), fn: () => {
        f.eTip = true;
        g.audio.setMood("relief");
        g.caption("A mata fica quieta. S\xF3 passarinho", 0);
        g.ui.toast("A mata abre e fica silenciosa. Procure sinais do veado.", "tip", 4500);
      } });
      g.triggers.push({ x: px3(EXIT[0]), y: px3(EXIT[1]), r: 26, once: false, cond: () => !this.finished, fn: () => this.reachExit() });
      for (const t of this.twigs) {
        g.triggers.push({ x: t.x, y: t.y, r: 7, once: false, fn: () => {
          const p = g.player;
          if (t.cd > g.time || !p.moving || p.sneak) return;
          t.cd = g.time + 3;
          g.audio.play("twig", { pan: 0, vol: p.running ? 1 : 0.8 });
          p.makeNoise(0.95);
          g.caption("Um galho seco estala sob a bota", 0);
        } });
      }
    }
    // ================= roteiro =================
    async intro() {
      const g = this.g;
      await g.ui.intro([
        '<span class="place">Mata de terra firme \xB7 manh\xE3</span>Caetano desmontou o primeiro acampamento com o orvalho ainda pingando das folhas.',
        "O rastro do veado-vermelho seguia para o leste, por trilhas de bicho que se cruzam no meio da floresta.",
        "Depois de alguns minutos de caminhada, o ch\xE3o come\xE7ou a mudar: terra revirada, ra\xEDzes quebradas, pegadas por todo lado."
      ]);
      g.player.dir = "right";
      g.letterbox = 1;
      g.fade = 1;
      g.audio.setMood("calm");
      await g.run(async () => {
        g.camera.targetZoom = 1.2;
        await g.tween(g, "fade", 0, 2);
        g.ui.titleCard("FASE 2", "O Caminho dos Queixadas", "Manh\xE3 \xB7 floresta de terra firme");
        await g.wait(3.4);
        await g.say("Caetano", "Terra revirada, raiz ro\xEDda... Isso aqui n\xE3o foi bicho sozinho, n\xE3o.", "caetano");
        g.audio.play("grunt", { pan: 0.8, vol: 0.35 });
        g.caption("Um ronco grave, longe, para o leste", 0.8);
        await g.wait(1.2);
        await g.say("Caetano", "O veado passou por aqui. Mas tem mais algu\xE9m andando nessa mata. Vou com calma e olhar os sinais.", "caetano");
        g.camera.targetZoom = 1;
        await g.tween(g, "letterbox", 0, 0.8);
      });
      g.state = "play";
      g.stats.startedAt = g.timeLeft;
      g.ui.toast("<b>Dica</b> \xB7 Os sinais do bando brilham de leve quando voc\xEA chega perto. Examine com <kbd>E</kbd>.", "tip", 6500);
      setTimeout(() => g.state === "play" && g.ui.toast("<b>Dica</b> \xB7 O medidor de <b>Ru\xEDdo</b> mostra BAIXO, M\xC9DIO ou ALTO. Agachado (<kbd>C</kbd>) \xE9 baixo; andando, m\xE9dio; correndo, alto.", "tip", 7500), 8e3);
      g.checkpoint("In\xEDcio da Fase 2");
    }
    addScore(n, label) {
      const f = this.g.flags;
      f.score = (f.score || 0) + n;
      if (label) this.g.ui.toast(`<b>+${n}</b> explora\xE7\xE3o \xB7 ${label}`, "discovery", 2600);
    }
    addJournal(title, text) {
      const f = this.g.flags;
      f.journal = f.journal || [];
      if (!f.journal.some((j) => j.title === title)) f.journal.push({ title, text });
    }
    journal() {
      return this.g.flags.journal || [];
    }
    panelRow() {
      return ["Explora\xE7\xE3o", `${this.g.flags.score || 0} pts`];
    }
    async examineSign(s) {
      const g = this.g, f = g.flags;
      await g.run(async () => {
        g.player.forceCrouch = true;
        g.camera.targetZoom = 1.3;
        await g.say("Caetano", s.text, "caetano");
        g.camera.targetZoom = 1;
        g.player.forceCrouch = false;
      });
      f["sign_" + s.id] = true;
      this.addScore(10, s.name);
      this.addJournal("Sinal: " + s.name, s.text);
      if (this.count.signsDone() >= 2 && !g.done.has("m1")) {
        g.complete("m1");
        g.ui.toast("O bando seguiu para o leste. Siga a trilha e encontre os animais, sem chegar perto demais.", "tip", 5500);
        g.checkpoint("Sinais do bando");
      }
    }
    async examineMystery() {
      const g = this.g, f = g.flags;
      await g.run(async () => {
        g.player.forceCrouch = true;
        g.camera.targetZoom = 1.4;
        await g.say("Caetano", "Pegada do veado... indo pro norte. E aqui do lado, a mesma pegada, fresca igual, voltando pro sul.", "caetano");
        await g.say("Caetano", "Como \xE9 que um bicho vai e volta pisando em cima do pr\xF3prio rastro, sem errar um passo?", "caetano");
        g.audio.setDuck(0.3, 0.6);
        await g.wait(0.8);
        await g.say("Caetano", "...Deve ter sido o vento mexendo nas folhas. Deve.", "caetano");
        g.audio.setDuck(1, 2);
        g.camera.targetZoom = 1;
        g.player.forceCrouch = false;
      });
      f.mystery = true;
      this.addScore(10, "pegadas estranhas");
      this.addJournal("Pegadas que v\xE3o e voltam", "O rastro do veado parecia seguir para dois lados ao mesmo tempo, com a mesma idade. N\xE3o faz sentido.");
    }
    async examineClue(c) {
      const g = this.g, f = g.flags;
      await g.run(async () => {
        g.player.forceCrouch = true;
        await g.say("Caetano", c.text, "caetano");
        g.player.forceCrouch = false;
      });
      f[c.id] = true;
      this.addScore(15, "pista do veado");
      this.addJournal("Pista do veado", c.text);
      if (this.count.cluesDone() >= 3 && !g.done.has("s_tracker")) {
        g.complete("s_tracker");
        this.addScore(50, "Rastreador Experiente");
        this.addJournal("Conquista: Rastreador Experiente", "Tr\xEAs pistas do veado-vermelho encontradas fora da trilha principal.");
      }
    }
    async crossingScene() {
      const g = this.g, f = g.flags, col = this.herdCol, p = g.player;
      f.crossSeen = true;
      if (!col) return;
      col.moveT = 0;
      col.moving = false;
      col.routeIdx = 0;
      this.later(9, () => {
        col.ignorePlayer = false;
      });
      await g.run(async () => {
        await g.tween(g, "letterbox", 1, 0.5);
        g.audio.play("grunt", { pan: 0.6, vol: 0.8 });
        g.caption("Um ru\xEDdo crescente entre as \xE1rvores: galhos mexendo", 0.6);
        g.camera.follow = null;
        await g.camera.panTo(px3(40.6), px3(97), 1.6);
        p.forceCrouch = true;
        await g.wait(3.4);
        g.audio.play("clack", { pan: 0.5, vol: 0.6 });
        await g.say("Caetano", "Queixada! Um bando inteiro atravessando a trilha...", "caetano");
        await g.wait(1.2);
        await g.say("Caetano", "Se eles me cercam no meio da mata, n\xE3o tem \xE1rvore que me salve. Preciso achar outro caminho... e ver pra onde eles v\xE3o.", "caetano");
        await g.camera.panTo(p.x, p.y - 8, 1.2);
        g.camera.follow = p;
        p.forceCrouch = false;
        await g.tween(g, "letterbox", 0, 0.5);
      });
      this.addJournal("Um bando inteiro", "Uma fila de queixadas cruzou a trilha \xE0 frente, rumo a uma clareira a leste. Barulho de cascos e bater de dentes.");
      g.ui.toast("<b>Dica</b> \xB7 Agachado (<kbd>C</kbd>) voc\xEA faz ru\xEDdo BAIXO e fica menos vis\xEDvel. Queixada enxerga mal, mas escuta e fareja muito bem.", "tip", 7500);
    }
    onColumnArrive(pt) {
      const col = this.herdCol;
      if (!col || col.routeIdx < col.route.length - 1) return;
      const B = this.herdB;
      for (const m of col.members) {
        m.herd = B;
        B.members.push(m);
        m.slot = { x: (Math.random() - 0.5) * 60, y: (Math.random() - 0.5) * 34 };
        if (isCalm(m.state)) m.enter(S2.WALKING);
      }
      col.members = [];
      this.herds = this.herds.filter((h) => h !== col);
      const i = this.g.updaters.indexOf(col);
      if (i >= 0) this.g.updaters.splice(i, 1);
      this.herdCol = null;
    }
    async observeFromMirante() {
      const g = this.g, p = g.player, B = this.herdB;
      if (B.mode !== "calm") {
        g.ui.toast("O bando est\xE1 agitado. Espere ele se acalmar antes de observar.", "warn", 3500);
        return;
      }
      await g.run(async () => {
        p.hidden = true;
        p.forceCrouch = true;
        await g.tween(g, "letterbox", 1, 0.5);
        g.camera.follow = null;
        g.camera.targetZoom = 0.9;
        await g.camera.panTo(B.anchor.x - 30, B.anchor.y - 10, 1.8);
        g.audio.setMood("stealth");
        await g.say("Caetano", `L\xE1 est\xE3o eles. ${B.members.length > 8 ? "Doze, treze..." : "Seis, sete..."} contando os filhotes no meio.`, "caetano");
        await g.say("Caetano", "Fu\xE7am o ch\xE3o sem parar. Bicho de cheiro forte, que escuta longe. Do jeito que o vento est\xE1, eles v\xE3o saber de mim antes de me ver.", "caetano");
        await g.say("Caetano", "Pra passar, eu preciso entender como esse bando se mexe.", "caetano");
        await g.camera.panTo(p.x, p.y - 8, 1.2);
        g.camera.follow = p;
        g.camera.targetZoom = 1;
        await g.tween(g, "letterbox", 0, 0.5);
        p.hidden = false;
        p.forceCrouch = false;
      });
      g.complete("m2");
      this.addJournal("A clareira do bando", "Uma clareira grande, cheia de terra fu\xE7ada e um barreiro no meio. O bando passa a manh\xE3 ali.");
      g.checkpoint("Mirante da clareira");
      g.ui.toast("<b>Estudar</b> \xB7 Fique escondido perto do bando e observe. Um c\xEDrculo aparece sobre o animal enquanto voc\xEA aprende o que ele faz.", "tip", 7500);
      p.sneak = true;
    }
    useVine() {
      const g = this.g, f = g.flags;
      if (this.distractCd.vine > g.time) {
        g.ui.toast("O cip\xF3 ainda est\xE1 balan\xE7ando. Espere um pouco.", "tip", 2e3);
        return;
      }
      this.distractCd.vine = g.time + 22;
      const pl = P(VINE.palm), land = P(VINE.land);
      g.player.makeNoise(0.22);
      g.audio.play("rustle", { pan: g.panOf(pl.x), vol: 0.9 });
      setTimeout(() => g.audio.play("fruits", { pan: g.panOf(land.x), vol: 1 }), 300);
      for (let i = 0; i < 14; i++) g.particles.add({ type: "leaf", x: pl.x + (Math.random() - 0.5) * 30, y: pl.y - 10, z: 30 + Math.random() * 20, vx: (Math.random() - 0.5) * 30, vy: 4, life: 3, seed: Math.random() * 9, color: i % 3 ? "#4f7a32" : "#8a4a22" });
      this.fruitT = g.time + 25;
      this.herdB.hearNoise(land.x, land.y, 3.2, "food");
      g.caption("Frutos de buriti despencam do alto", g.panOf(land.x));
      if (!f.vineUsed) {
        f.vineUsed = true;
        this.addScore(5, "distra\xE7\xE3o");
        g.ui.toast("Os queixadas adoram buriti: quem estiver perto vai l\xE1 conferir e comer um pouco.", "tip", 5e3);
      }
    }
    useStone() {
      const g = this.g, f = g.flags;
      if (this.distractCd.stone > g.time) {
        g.ui.toast("Procurando outra pedra solta\u2026", "tip", 1800);
        return;
      }
      this.distractCd.stone = g.time + 18;
      const a = P(STONE_PUSH.at), b = P(STONE_PUSH.land);
      this.rollingStone = { x: a.x, y: a.y - 4, fx: a.x, fy: a.y - 4, tx: b.x, ty: b.y, t: 0, dur: 1.3 };
      g.audio.play("roll", { pan: g.panOf(a.x), vol: 0.8 });
      g.player.makeNoise(0.2);
      if (!f.stoneUsed) {
        f.stoneUsed = true;
        this.addScore(5, "distra\xE7\xE3o");
      }
    }
    async cutTangle() {
      const g = this.g, f = g.flags;
      if (!g.inv.has("facao")) {
        g.ui.toast("Sem o fac\xE3o n\xE3o d\xE1 pra cortar esses galhos.", "tip");
        return;
      }
      await g.run(async () => {
        for (let i = 0; i < 3; i++) {
          g.audio.play("cut");
          await g.wait(0.35);
        }
        f.tangleCut = true;
        this.tangleCol.off = true;
        const tg = P(PUZ.tangle);
        for (let i = 0; i < 16; i++) g.particles.add({ type: "leaf", x: tg.x + (Math.random() - 0.5) * 24, y: tg.y, z: 6 + Math.random() * 10, vx: (Math.random() - 0.5) * 30, vy: 2, life: 2, seed: Math.random() * 9, color: i % 2 ? "#6a4a2e" : "#4f7a32" });
        await g.say("Caetano", "Embaixo dos galhos tem uma vara de pau-ferro. Madeira que n\xE3o quebra.", "caetano");
      });
      this.invalidateFlows();
    }
    // ---- toro empurrável ----
    railLen() {
      const r = PUZ.rail;
      let L = 0;
      for (let i = 0; i < r.length - 1; i++) L += Math.hypot(r[i + 1][0] - r[i][0], r[i + 1][1] - r[i][1]) * S4;
      return L;
    }
    railAt(s) {
      const r = PUZ.rail;
      let acc = 0;
      for (let i = 0; i < r.length - 1; i++) {
        const L = Math.hypot(r[i + 1][0] - r[i][0], r[i + 1][1] - r[i][1]) * S4;
        if (s <= acc + L || i === r.length - 2) {
          const k = clamp((s - acc) / L, 0, 1);
          return { x: px3(r[i][0] + (r[i + 1][0] - r[i][0]) * k), y: px3(r[i][1] + (r[i + 1][1] - r[i][1]) * k), seg: i, dir: { x: (r[i + 1][0] - r[i][0]) * S4 / L, y: (r[i + 1][1] - r[i][1]) * S4 / L }, acc, L };
        }
        acc += L;
      }
      return null;
    }
    toroPos() {
      return this.railAt(this.g.flags.toroS || 0);
    }
    placeToro(s) {
      const t = this.railAt(s);
      Object.assign(this.toroCol, { x: t.x - 10, y: t.y - 5, w: 20, h: 8 });
      this.reindex(this.toroCol);
    }
    reindex(c) {
      const w = this.world;
      for (const [k, arr] of w.colGrid) {
        const i = arr.indexOf(c);
        if (i >= 0) arr.splice(i, 1);
        if (!arr.length) w.colGrid.delete(k);
      }
      const x0 = c.x, y0 = c.y, x1 = c.x + c.w, y1 = c.y + c.h;
      for (let gy = Math.floor(y0 / 64); gy <= Math.floor(y1 / 64); gy++) for (let gx = Math.floor(x0 / 64); gx <= Math.floor(x1 / 64); gx++) {
        const k = gx + "," + gy;
        if (!w.colGrid.has(k)) w.colGrid.set(k, []);
        w.colGrid.get(k).push(c);
      }
    }
    updateToro(dt) {
      const g = this.g, f = g.flags, p = g.player;
      if (f.toroPlaced || f.trunkMoved) return;
      const t = this.toroPos();
      if (dist(p.x, p.y, t.x, t.y) > 22) {
        this.toroPushT = 0;
        return;
      }
      const sp = Math.hypot(p.vx, p.vy);
      if (sp < 20 || g.state !== "play") return;
      const ux = p.vx / sp, uy = p.vy / sp;
      const rel = { x: t.x - p.x, y: t.y - p.y };
      if (rel.x * ux + rel.y * uy < 4) return;
      const L = this.railLen(), s0 = f.toroS || 0;
      const here = this.railAt(s0), cands = [here];
      if (s0 > 0 && Math.abs(s0 - here.acc) < 1 && here.seg > 0) cands.push(this.railAt(s0 - 1));
      if (Math.abs(s0 - (here.acc + here.L)) < 1) cands.push(this.railAt(Math.min(L, s0 + 1)));
      let best = 0, bdot = 0.55;
      for (const c of cands) {
        const dt2 = c.dir.x * ux + c.dir.y * uy;
        if (Math.abs(dt2) > bdot) {
          bdot = Math.abs(dt2);
          best = Math.sign(dt2);
        }
      }
      if (!best) return;
      const ns = clamp(s0 + best * Math.min(sp, 54) * 0.55 * dt, 0, L);
      if (ns === s0) return;
      const np = this.railAt(ns);
      const qx = clamp(p.x, np.x - 10, np.x + 10), qy = clamp(p.y, np.y - 5, np.y + 3);
      if ((p.x - qx) ** 2 + (p.y - qy) ** 2 < (p.r + 0.5) ** 2) return;
      f.toroS = ns;
      this.placeToro(ns);
      this.toroPushT = (this.toroPushT || 0) + dt;
      if (this.toroPushT > 0.45) {
        this.toroPushT = 0;
        g.audio.play("roll", { vol: 0.35 });
        g.particles.add({ type: "puff", x: np.x, y: np.y + 3, vx: 0, vy: -3, life: 0.6, color: "#8a7a5a" });
        p.makeNoise(0.3);
      }
      if (!f.toroTip) {
        f.toroTip = true;
        g.ui.toast("O toro rola pesado pelo ch\xE3o. Empurre at\xE9 ele encostar no tronco grande.", "tip", 4500);
      }
      if (ns >= L - 0.5) {
        f.toroPlaced = true;
        g.audio.play("thud", { vol: 0.5 });
        g.ui.toast("O toro encaixou junto ao tronco: um apoio firme para a alavanca.", "tip", 4500);
        this.invalidateFlows();
      }
    }
    leverReady() {
      return this.g.flags.toroPlaced && this.g.inv.has("vara");
    }
    async leverAction() {
      const g = this.g, f = g.flags;
      if (f.trunkMoved) return;
      if (!this.leverReady()) {
        await g.run(async () => {
          await g.say("Caetano", "Tronco pesado demais pra empurrar no bra\xE7o. E a grota \xE9 estreita, n\xE3o tem como passar por cima.", "caetano");
          if (!f.toroPlaced && !g.inv.has("vara")) await g.say("Caetano", "Com uma alavanca e um bom apoio, ele rola pra vala do lado. Preciso de uma vara forte... e de alguma coisa pra apoiar.", "caetano");
          else if (!g.inv.has("vara")) await g.say("Caetano", "O apoio est\xE1 no lugar. Falta uma vara forte pra servir de alavanca.", "caetano");
          else await g.say("Caetano", "Tenho a vara, mas sem apoio ela s\xF3 escorrega. Aquele toro curto ali no p\xE1tio serve, se eu empurrar at\xE9 aqui.", "caetano");
        });
        return;
      }
      await g.run(async () => {
        g.player.dir = "up";
        await g.say("Caetano", "Vara por baixo, toro de apoio... Agora vai.", "caetano");
        g.audio.play("creak", { vol: 1 });
        await g.wait(0.6);
        g.audio.play("creak", { vol: 1.2 });
        g.camera.shake(1, 0.4);
        await g.wait(0.5);
        g.audio.play("roll", { vol: 1 });
        const rt = P(PUZ.rollTo);
        g.tween(this.trunk, "rot", 0.35, 1.1);
        g.tween(this.trunk, "x", rt.x, 1.1);
        await g.tween(this.trunk, "y", rt.y, 1.1);
        g.audio.play("thud", { vol: 1 });
        g.camera.shake(3, 0.5);
        for (let i = 0; i < 18; i++) g.particles.add({ type: "puff", x: rt.x + (Math.random() - 0.5) * 50, y: rt.y, vx: (Math.random() - 0.5) * 30, vy: -6, life: 1, color: "#9a8a6a" });
        this.trunkCol.off = true;
        f.trunkMoved = true;
        g.inv.remove("vara");
        await g.say("Caetano", "Rolou pra vala. O caminho est\xE1 aberto.", "caetano");
      });
      this.invalidateFlows();
      g.complete("m5");
      g.checkpoint("Grota do tronco");
      g.ui.toast("Siga para o norte e depois para o leste pela trilha estreita.", "tip", 4500);
    }
    invalidateFlows() {
      for (const h of this.herds) {
        h.flowP.invalidate();
        h.flowH.invalidate();
      }
    }
    async observeTapir() {
      const g = this.g, tp = this.tapir, p = g.player;
      const d = dist(tp.x, tp.y, p.x, p.y);
      if (d < 60) {
        g.ui.toast("Muito perto: a anta vai se assustar. Afaste-se e observe de longe.", "warn", 3e3);
        return;
      }
      if (tp.aware > 0.6) {
        g.ui.toast("A anta est\xE1 desconfiada. Fique quieto e espere.", "tip", 2500);
        return;
      }
      await g.run(async () => {
        p.hidden = true;
        g.camera.follow = null;
        g.camera.targetZoom = 1.4;
        await g.camera.panTo((tp.x + p.x) / 2, (tp.y + p.y) / 2 - 6, 1);
        await g.say("Caetano", "Uma anta. Grandona, focinho de tromba, comendo folha na beira do barreiro.", "caetano");
        await g.say("Caetano", "Ela abre as trilhas que os outros bichos usam. Melhor deixar quieta.", "caetano");
        g.camera.targetZoom = 1;
        g.camera.follow = p;
        p.hidden = false;
      });
      g.complete("s_anta");
      this.addScore(50, "Observador da Floresta");
      this.addJournal("Conquista: Observador da Floresta", "Uma anta no barreiro, observada de longe, sem que ela percebesse.");
    }
    // ---------- perseguição ----------
    async startChase(scripted) {
      const g = this.g, f = g.flags, p = g.player, H = this.herdD;
      if (f.chaseStarted && this.chaseActive) return;
      if (scripted) g.checkpoint("Antes da investida");
      f.chaseStarted = true;
      this.chaseActive = true;
      this.chaseEnded = false;
      if (scripted) {
        await g.run(async () => {
          p.makeNoise(1);
          g.audio.play("twig", { vol: 1.2 });
          g.caption("Um galho seco estala alto sob a bota", 0);
          await g.wait(0.45);
          for (const m of H.members) {
            m.alertCause = "player";
            m.aware = 1.3;
            m.lastSeen = { x: p.x, y: p.y };
            m.lastPerceivedT = g.time;
            m.enter(S2.DEFENSIVE);
          }
          g.audio.play("clack", { pan: -0.6, vol: 1.2 });
          await g.tween(g, "letterbox", 1, 0.35);
          g.camera.follow = null;
          await g.camera.panTo(px3(129.5), px3(50.2), 0.8);
          g.caption("Bater de dentes na baixada: o bando!", -0.6);
          g.camera.shake(2, 0.5);
          await g.wait(0.8);
          await g.camera.panTo(p.x, p.y - 8, 0.45);
          g.camera.follow = p;
          await g.tween(g, "letterbox", 0, 0.3);
        });
      }
      this.releaseChasers();
      g.audio.setMood("chase");
      g.ui.alert("CORRA! ENCONTRE UM CAMINHO SEGURO!", "run", 6e3);
      g.ui.toast("<kbd>Shift</kbd> corre \xB7 <kbd>Espa\xE7o</kbd> esquiva \xB7 procure terreno alto onde o bando n\xE3o suba.", "warn", 6e3);
    }
    // agenda no tempo do jogo (respeita pausa e diálogos)
    later(sec, fn) {
      this.timers.push({ t: this.g.time + sec, fn });
    }
    releaseChasers() {
      const g = this.g, p = g.player;
      this.herdD.members.forEach((m, i) => {
        this.later(0.7 + i * 0.35, () => {
          if (!this.chaseActive) return;
          m.alertCause = "player";
          m.aware = 1.3;
          m.lastSeen = { x: p.x, y: p.y };
          m.lastPerceivedT = g.time;
          m.viaCall = i > 0;
          if (m.state !== S2.CHASE) m.enter(S2.CHASE);
        });
      });
    }
    resumeChase() {
      const g = this.g, H = this.herdD;
      const pts = CHASE.spawn2;
      H.members.forEach((m, i) => {
        const q = P(pts[i % pts.length]);
        m.x = q.x;
        m.y = q.y;
        m.heading = Math.PI / 2;
        m.enter(S2.ALERT);
      });
      this.chaseActive = true;
      this.later(1.8, () => {
        g.audio.play("clack", { pan: 0, vol: 1 });
        g.caption("Cascos e dentes vindo pela trilha!", 0);
        this.releaseChasers();
        g.audio.setMood("chase");
        g.ui.alert("CORRA! ENCONTRE UM CAMINHO SEGURO!", "run", 5e3);
      });
    }
    async reachLajedo() {
      const g = this.g, f = g.flags;
      if (!f.chaseStarted) return;
      this.chaseActive = false;
      this.chaseEnded = true;
      g.complete("m6");
      g.ui.alert("A SALVO! O BANDO N\xC3O CONSEGUE SUBIR NO LAJEDO.", "safe", 4e3);
      g.audio.setMood("relief");
      g.player.en = Math.max(g.player.en, 30);
      this.addJournal("A grande investida", "Cinco queixadas sa\xEDram da baixada batendo os dentes. Corri pela trilha, atravessei o tronco sobre a grota e subi no lajedo. L\xE1 em cima eles n\xE3o chegam.");
      this.later(2.5, () => {
        for (const m of this.herdD.members) if (m.state === S2.CHASE) m.giveUp("barrier");
      });
      g.checkpoint("Lajedo");
      await g.wait(1.5);
      await g.run(async () => {
        await g.say("Caetano", "Ufa... Ficaram l\xE1 embaixo, batendo os dentes. Daqui eles n\xE3o sobem.", "caetano");
      });
      g.ui.toast("Des\xE7a pelo outro lado do lajedo, para o sul, e procure o rastro do veado.", "tip", 5e3);
    }
    async examineHair() {
      const g = this.g, f = g.flags;
      await g.run(async () => {
        g.player.forceCrouch = true;
        g.camera.targetZoom = 1.4;
        await g.say("Caetano", "Pelo vermelho, comprido, preso no espinho. Do veado. Passou raspando aqui, faz pouco.", "caetano");
        g.camera.targetZoom = 1;
        g.player.forceCrouch = false;
      });
      f.hair = true;
      g.give("pelos", 1, true);
      this.addScore(10, "pelos do veado");
      this.checkRed();
    }
    async examinePrints() {
      const g = this.g, f = g.flags;
      await g.run(async () => {
        g.player.forceCrouch = true;
        g.camera.targetZoom = 1.4;
        await g.say("Caetano", "Casco fino, pontudo, o mesmo da clareira de ontem. A passada \xE9 larga: ele estava andando tranquilo, pro poente.", "caetano");
        g.camera.targetZoom = 1;
        g.player.forceCrouch = false;
      });
      f.prints = true;
      this.addScore(10, "pegadas do veado");
      this.checkRed();
    }
    checkRed() {
      const g = this.g, f = g.flags;
      if (f.hair && f.prints && !g.done.has("m7")) {
        g.complete("m7");
        this.addJournal("O rastro vermelho", "Pelos ruivos num espinho e pegadas frescas indo para o oeste, na dire\xE7\xE3o da \xE1gua.");
        g.checkpoint("Rastro vermelho");
        g.ui.toast("Siga as pegadas para o oeste, at\xE9 a beira da \xE1gua.", "tip", 4500);
      }
    }
    reachExit() {
      const g = this.g;
      if (this.finished) return;
      if (!g.done.has("m7")) {
        if (g.time > this.gateMsgT) {
          this.gateMsgT = g.time + 6;
          g.ui.toast('Caetano: <i>"Antes de seguir, quero ter certeza do rastro. Cad\xEA os sinais do veado?"</i>', "tip", 3500);
        }
        return;
      }
      this.finished = true;
      g.complete("m8");
      this.finalScene();
    }
    async finalScene() {
      const g = this.g, p = g.player;
      await g.run(async () => {
        g.audio.setMood("mystery");
        await g.tween(g, "letterbox", 1, 0.6);
        await g.say("Caetano", "A mata abre aqui, e o ch\xE3o fica mole. Tem \xE1gua perto: \xE9 a v\xE1rzea.", "caetano");
        const tr = P(FINAL_TREE);
        await g.moveTo(p, tr.x + 6, tr.y + 10, 30);
        p.dir = "up";
        p.forceCrouch = true;
        g.camera.follow = null;
        g.camera.targetZoom = 1.5;
        await g.camera.panTo(tr.x + 2, tr.y - 12, 1.2);
        await g.say("Caetano", "Pegada nova do veado... e mais pelo vermelho, preso na casca.", "caetano");
        this.marksA = 0;
        await g.tween(this, "marksA", 1, 0.8);
        await g.say("Caetano", "Mas isso aqui no tronco n\xE3o \xE9 unha de bicho. Risco fino, dando volta, feito tran\xE7a de palha.", "caetano");
        await g.say("Caetano", "Quem \xE9 que marca \xE1rvore desse jeito, no meio do nada?", "caetano");
        g.audio.setDuck(0.1, 1.5);
        await g.wait(1);
        g.audio.play("whistle", { pan: -0.85, dur: 2.4, vol: 0.45 });
        g.caption("Um som distante, que n\xE3o parece de bicho", -0.85);
        await g.wait(1.4);
        p.forceCrouch = false;
        p.dir = "down";
        await g.camera.panTo(p.x + 40, p.y - 10, 1.2);
        await g.wait(0.8);
        await g.say("Caetano", "...Tem algu\xE9m a\xED?", "caetano");
        await g.wait(1.4);
        g.audio.setDuck(1, 3);
        g.camera.targetZoom = 1.1;
        await g.camera.panTo(px3(VARZEA.x + 2), px3(VARZEA.y - 1), 2.6);
        g.ui.titleCard("FASE 2 CONCLU\xCDDA", "PR\xD3XIMA FASE: OS SEGREDOS DA V\xC1RZEA", "", "small");
        await g.wait(3.6);
        await g.tween(g, "fade", 1, 1.8);
      });
      this.completePhase();
    }
    completePhase() {
      const g = this.g, f = g.flags;
      g.state = "results";
      const used = this.timeLimit - g.timeLeft;
      const carry = { inv: g.inv.toJSON(), res: { ...g.res }, tracks: [...g.tracksKnown], found: [...g.inv.found] };
      Save.write({ phase: 2, completed: true, done: [...g.done], flags: { score: f.score, journal: f.journal } });
      Save.completePhase(2, { time: used, score: f.score || 0, carry, secondary: this.secondary.filter((m) => g.done.has(m.id)).map((m) => m.id) });
      g.ui.results([
        ["Tempo da expedi\xE7\xE3o", formatTime(used)],
        ["Sinais do bando examinados", `${this.count.signsDone()}/4`],
        ["Padr\xF5es do bando", `${this.count.patDone()}/4`],
        ["Miss\xF5es secund\xE1rias", `${this.secondary.filter((m) => g.done.has(m.id)).length}/3`],
        ["Pistas do veado", `${this.count.cluesDone()}/4`],
        ["Pontos de explora\xE7\xE3o", `${f.score || 0}`]
      ], { code: "FASE 2 CONCLU\xCDDA", title: "O Caminho dos Queixadas" });
    }
    onResume() {
    }
    onRestore() {
      const g = this.g;
      g.ui.clearAlert();
      g.audio.setMood(this.g.flags.chaseStarted && !g.done.has("m6") ? "chase" : "calm");
    }
    // ================= reações do bando =================
    gateClosed() {
      const g = this.g;
      return !g.done.has("m4") && (!g.done.has("m3") || this.dirty);
    }
    gateMessage() {
      const g = this.g;
      if (g.time < this.gateMsgT) return;
      this.gateMsgT = g.time + 7;
      if (!g.done.has("m3")) g.ui.toast('Caetano: <i>"Antes de cruzar, quero entender como esse bando se mexe."</i> (estude os animais)', "tip", 4500);
      else g.ui.toast("Com o bando em alerta, entrar na passagem estreita \xE9 arriscado: se vierem atr\xE1s, n\xE3o tem pra onde correr. Afaste-se ou esconda-se at\xE9 eles se acalmarem.", "warn", 6e3);
    }
    reachPassage(ps) {
      const g = this.g;
      if (g.done.has("m4") || this.gateClosed()) return;
      g.complete("m4");
      this.addJournal("A travessia", `Cruzei a clareira at\xE9 a ${ps.name} sem que o bando me percebesse.`);
      if (!this.silentFail && this.silentAttempt) {
        g.complete("s_silent");
        this.addScore(50, "Passos Silenciosos");
        this.addJournal("Conquista: Passos Silenciosos", "Atravessei a clareira do bando sem que nenhum queixada desconfiasse de mim.");
      }
      g.audio.setMood("calm");
      g.checkpoint("Do outro lado da clareira");
      g.ui.toast("Siga a trilha para o norte, pela mata dos troncos ca\xEDdos.", "tip", 4500);
    }
    onHerdDetect(herd, m, reason) {
      const g = this.g;
      if (herd === this.herdD) return;
      if (!g.done.has("m4")) {
        this.dirty = true;
        this.silentFail = true;
      }
      g.ui.alert("ALERTA: O BANDO PERCEBEU SUA PRESEN\xC7A!", "alert", 4500);
      if (reason && reason.text) g.ui.toast(reason.text, "warn", 7e3);
      g.audio.setMood("tension");
      if (!g.flags.detectTip) {
        g.flags.detectTip = true;
        setTimeout(() => g.ui.toast("<b>Dica</b> \xB7 Quando eles batem os dentes, recue. Para escapar, saia da clareira ou fique agachado numa moita, longe da vista, at\xE9 o bando se acalmar.", "tip", 7e3), 1500);
      }
    }
    onHerdChase(herd, m) {
      const g = this.g;
      if (herd === this.herdD) {
        if (!g.flags.chaseStarted && g.done.has("m5")) this.startChase(false);
        return;
      }
      g.camera.shake(1.5, 0.3);
      g.ui.toast("Eles est\xE3o avan\xE7ando! Corra para longe da clareira.", "warn", 4e3);
    }
    onGiveUp(herd, m, why) {
      const g = this.g;
      if (herd === this.herdD && this.chaseActive && !herd.members.some((q) => q.state === S2.CHASE) && why === "lost") {
        this.chaseActive = false;
        g.ui.alert("O BANDO PERDEU SEU RASTRO. SIGA PARA O LAJEDO!", "info", 4500);
        g.audio.setMood("stealth");
      }
    }
    onHerdCalm(herd) {
      const g = this.g;
      if (herd === this.herdD) return;
      if (this.dirty) {
        this.dirty = false;
        g.ui.toast("O bando se acalmou e voltou a comer. Pode tentar atravessar de novo.", "tip", 5e3);
      }
      g.ui.clearAlert();
      if (this.inClearing()) g.audio.setMood("stealth");
      else g.audio.setMood("calm");
    }
    onHerdMove(herd) {
      const g = this.g, p = g.player;
      if (herd === this.herdB && p && dist(p.x, p.y, herd.anchor.x, herd.anchor.y) < 360) g.caption("O bando levanta e muda de lugar", g.panOf(herd.moveTo.x));
    }
    onAnimalEvent(a, ev) {
      const g = this.g;
      if (ev === "fly") {
        if (!a._capT || g.time - a._capT > 6) {
          a._capT = g.time;
          g.caption("Jacus levantam voo, assustados", g.panOf(a.x));
        }
        for (const o of g.animals) if (o !== a && o.kind === "jacu" && dist(o.x, o.y, a.x, a.y) < 40) o.scare();
      }
    }
    inClearing() {
      const p = this.g.player;
      return p && inEll(p.x / S4, p.y / S4, B_CENTER, 1.08) < 1;
    }
    // ================= atualização =================
    update(dt) {
      const g = this.g, p = g.player, f = g.flags;
      if (!p || !this.world) return;
      const playing = g.state === "play";
      for (let i = this.timers.length - 1; i >= 0; i--) if (g.time >= this.timers[i].t) {
        const tm = this.timers[i];
        this.timers.splice(i, 1);
        tm.fn();
      }
      this.unstick(p);
      if (playing) {
        this.bumpCd -= dt;
        if (this.lastPos) {
          const want = Math.hypot(p.vx, p.vy), got = Math.hypot(p.x - this.lastPos.x, p.y - this.lastPos.y) / Math.max(dt, 1e-3);
          const nearToro = !f.toroPlaced && dist(p.x, p.y, this.toroPos().x, this.toroPos().y) < 26;
          if (want > 46 && got < want * 0.22 && !p.locked && !nearToro) {
            this.bumpT += dt;
            if (this.bumpT > 0.12 && this.bumpCd <= 0) {
              this.bumpCd = 2.2;
              this.bumpT = 0;
              p.makeNoise(p.running ? 0.75 : 0.5);
              g.audio.play("stone", { vol: 0.6 });
              if (this.nearHerd(220)) g.caption("Caetano esbarra no mato: barulho!", 0);
            }
          } else this.bumpT = 0;
        }
        for (const z of this.dryZones) {
          if (!p.moving || dist(p.x, p.y, z.x, z.y) > z.r || g.time < z.cd) continue;
          z.cd = g.time + 0.7;
          p.makeNoise(p.sneak ? 0.36 : p.running ? 0.95 : 0.62);
          g.audio.play("bush", { vol: p.sneak ? 0.5 : 1 });
          if (!f.dryTip) {
            f.dryTip = true;
            g.caption("Folhas secas estalam na moita", 0);
            g.ui.toast("Arbusto seco faz barulho mesmo agachado. Contorne quando der.", "tip", 4500);
          }
        }
        this.updateToro(dt);
        this.updateStudy(dt);
        this.updateCrossing();
        this.updateChase(dt);
        if (!f.crossSeen && p.x < px3(36)) {
          this.distantT -= dt;
          if (this.distantT <= 0) {
            this.distantT = 7 + Math.random() * 7;
            g.audio.play(Math.random() < 0.6 ? "grunt" : "clack", { pan: 0.75, vol: 0.25 + p.x / px3(36) * 0.3 });
            if (!f.firstNoise) {
              f.firstNoise = true;
              g.caption("Grunhidos e um bater de dentes, longe, a leste", 0.75);
            }
          }
        }
      }
      this.lastPos = { x: p.x, y: p.y };
      const rs = this.rollingStone;
      if (rs) {
        rs.t += dt;
        const k = Math.min(1, rs.t / rs.dur);
        rs.x = rs.fx + (rs.tx - rs.fx) * k;
        rs.y = rs.fy + (rs.ty - rs.fy) * k - Math.sin(k * Math.PI * 3) * (1 - k) * 4;
        if (Math.random() < dt * 20) g.particles.add({ type: "puff", x: rs.x, y: rs.y + 2, vx: 0, vy: -2, life: 0.4, color: "#9a8a6a" });
        if (k >= 1) {
          this.rollingStone = null;
          g.audio.play("thud", { pan: g.panOf(rs.tx), vol: 0.5 });
          g.audio.play("stone", { pan: g.panOf(rs.tx), vol: 1 });
          this.herdB.hearNoise(rs.tx, rs.ty, 2.8, "noise");
          g.caption("Uma pedra rola e bate l\xE1 embaixo", g.panOf(rs.tx));
          this.landed = { x: rs.tx, y: rs.ty, t: g.time };
        }
      }
      if (f.chaseStarted && this.chaseActive && playing) {
        if (p.running) p.en = Math.min(100, p.en + 6 * dt);
      }
    }
    nearHerd(r) {
      const p = this.g.player;
      for (const h of this.herds) for (const m of h.members) if (dist(m.x, m.y, p.x, p.y) < r) return true;
      return false;
    }
    unstick(p) {
      const w = this.world;
      if (!w.hit(p.x, p.y, p.r * 0.7) && !circleBlocked(w, p.x, p.y, p.r * 0.7)) return;
      for (let r = 3; r <= 40; r += 3) for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
        if (!w.hit(x, y, p.r) && !circleBlocked(w, x, y, p.r)) {
          p.x = x;
          p.y = y;
          return;
        }
      }
    }
    // estudo do bando: observar escondido um animal fazendo algo
    updateStudy(dt) {
      const g = this.g, p = g.player, f = g.flags;
      this.studyTarget = null;
      if (!g.done.has("m2") || g.done.has("m3")) return;
      const B = this.herdB;
      if (B.mode === "alarmed" || B.mode === "chase") return;
      const mir = P(MIRANTE.at), atMirante = dist(p.x, p.y, mir.x, mir.y) < 44;
      let best = null, bd = atMirante ? 330 : 175;
      for (const m of B.members) {
        if (!m.behavior || f["pat_" + m.behavior]) continue;
        const d = dist(m.x, m.y, p.x, p.y);
        if (d > bd) continue;
        if (atMirante ? !this.treeLos(p.x, p.y - 8, m.x, m.y - 4) : !m.los(p.x, p.y - 8, m.x, m.y - 4, 18)) continue;
        if (p.running || m.perc && m.perc.seen) continue;
        best = m;
        bd = d;
      }
      if (!best) {
        for (const k2 in this.studyT) this.studyT[k2] = Math.max(0, this.studyT[k2] - dt * 0.5);
        return;
      }
      const k = best.behavior;
      const need = k === "clack" ? 0.35 : 2.4;
      this.studyT[k] = (this.studyT[k] || 0) + dt * (p.moving ? 0.6 : 1);
      this.studyTarget = { m: best, k, t: this.studyT[k] / need };
      if (this.studyT[k] >= need) {
        f["pat_" + k] = true;
        const P22 = PATTERNS[k];
        g.audio.play("discover");
        g.ui.toast(`<b>Padr\xE3o do bando</b> \xB7 ${P22.text} (${Math.min(3, this.count.patDone())}/3)`, "discovery", 7e3);
        this.addJournal("Padr\xE3o: " + P22.name, P22.text);
        this.addScore(10);
        if (this.count.patDone() >= 3) {
          g.complete("m3");
          g.checkpoint("Estudo do bando");
          g.ui.toast("Agora atravesse at\xE9 uma das passagens (norte ou nordeste) sem ser percebido. Agachado atr\xE1s de troncos e pedras voc\xEA some; contorne arbustos secos; repare no vento.", "tip", 9e3);
        }
      }
    }
    treeLos(ax, ay, bx, by) {
      const w = this.world, n = Math.ceil(dist(ax, ay, bx, by) / 6);
      for (let i = 2; i < n; i++) {
        const t = i / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
        for (const c of w.near(x, y)) if (!c.off && c.r >= 4 && (x - c.x) ** 2 + (y - c.y) ** 2 < c.r * c.r) return false;
      }
      return true;
    }
    updateCrossing() {
      const g = this.g, p = g.player;
      if (g.done.has("m4") || !g.done.has("m3")) return;
      const inside = this.inClearing();
      if (inside && !this.silentAttempt) {
        this.silentAttempt = true;
      }
      if (!inside && p.x < px3(46) && this.silentAttempt) {
        if (this.silentFail && this.herdB.mode === "calm") {
          this.silentFail = false;
          g.ui.toast("Nova tentativa de Passos Silenciosos.", "tip", 2500);
        }
        this.silentAttempt = false;
      }
      if (this.silentAttempt && !this.silentFail) {
        for (const m of this.herdB.members) if (!isCalm(m.state) && m.alertCause === "player") {
          this.silentFail = true;
          g.ui.toast("Um queixada desconfiou de voc\xEA: <b>Passos Silenciosos</b> falhou nesta tentativa.", "warn", 4e3);
          break;
        }
      }
      if (inside && this.herdB.mode === "calm" && g.audio.mood === "calm") g.audio.setMood("stealth");
    }
    updateChase(dt) {
      const g = this.g, p = g.player;
      if (!this.chaseActive) return;
      let close = 99;
      for (const m of this.herdD.members) if (m.state === S2.CHASE) close = Math.min(close, dist(m.x, m.y, p.x, p.y));
      if (close < 26 && Math.random() < dt * 3) g.camera.shake(0.8, 0.15);
      if (close > 260 && !this.herdD.members.some((m) => m.state === S2.CHASE || m.state === S2.DEFENSIVE)) {
        this.chaseActive = false;
        g.ui.alert("O BANDO FICOU PARA TR\xC1S. SIGA PARA O LAJEDO!", "info", 4e3);
        g.audio.setMood("stealth");
      }
    }
    audioEnv() {
      const g = this.g, p = g.player;
      if (!p) return {};
      let herd = 0, pan = 0, wsum = 0;
      for (const h of this.herds) for (const m of h.members) {
        const d = dist(m.x, m.y, p.x, p.y);
        if (d > 420) continue;
        const k = (1 - d / 420) * (m.speed > 30 ? 1.6 : m.speed > 4 ? 0.8 : 0.3);
        herd += k;
        pan += g.panOf(m.x) * k;
        wsum += k;
      }
      const tx = p.x / S4, ty = p.y / S4;
      const water = clamp(1 - Math.hypot(tx - VARZEA.x, ty - VARZEA.y) / 16, 0, 1) + clamp(1 - Math.hypot(tx - POND.x, ty - POND.y) / 8, 0, 0.4);
      const quiet = ty > 106 && tx > 99 ? 0.5 : 0;
      return { river: water * 0.8, riverPan: clamp((VARZEA.x - tx) / -10, -0.8, 0.8), dawn: 0, insects: 0.55 - quiet * 0.4, frogs: water * 0.4, birds: 1 - quiet * 0.3, fire: 0, herd: clamp(herd / 3, 0, 1.4), herdPan: wsum ? pan / wsum : 0, quiet };
    }
    // ================= desenho =================
    drawGround(ctx, V) {
      const g = this.g, f = g.flags, p = g.player, t = g.time;
      const vis = (x, y, m = 40) => x > V.cx - m && x < V.cx + V.vw + m && y > V.cy - m && y < V.cy + V.vh + m;
      const glint = (x, y, rx = 15, ry = 9, col = "#ffe8a0") => {
        if (!p || dist(x, y, p.x, p.y) > 72) return;
        ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 3 + x);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      };
      const bx = px3(BRIDGE2.x), by0 = px3(BRIDGE2.y0) - 4;
      if (vis(bx, by0 + 40, 80)) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = "#000";
        ctx.fillRect(bx - 6, by0 + 6, 14, this.bridgeSprite.height - 4);
        ctx.globalAlpha = 1;
        ctx.drawImage(this.bridgeSprite, Math.round(bx - this.bridgeSprite.width / 2), Math.round(by0));
      }
      const ds = Sprites.get("trk:veado", () => trackSprite("veado"));
      const qs = Sprites.get("trk:queixada", () => trackSprite("queixada"));
      for (const s of SIGNS) {
        const q = P(s.at);
        if (!vis(q.x, q.y)) continue;
        if (s.id === "pegadas") {
          ctx.drawImage(qs, Math.round(q.x - 14), Math.round(q.y - 11));
          ctx.drawImage(qs, Math.round(q.x - 4), Math.round(q.y - 6));
        }
        if (!f["sign_" + s.id]) glint(q.x, q.y);
      }
      const my = P(MYSTERY);
      if (vis(my.x, my.y)) {
        ctx.globalAlpha = 0.9;
        ctx.drawImage(ds, Math.round(my.x - 18), Math.round(my.y - 12));
        ctx.save();
        ctx.translate(Math.round(my.x + 8), Math.round(my.y + 2));
        ctx.scale(1, -1);
        ctx.drawImage(ds, -14, -11);
        ctx.restore();
        ctx.globalAlpha = 1;
        if (!f.mystery) glint(my.x, my.y, 18, 10, "#ffd666");
      }
      for (const c of CLUES) {
        const q = P(c.at);
        if (!vis(q.x, q.y) || f[c.id]) continue;
        if (c.id === "c_lama" || c.id === "c_fezes") {
          ctx.globalAlpha = 0.85;
          ctx.drawImage(ds, Math.round(q.x - 14), Math.round(q.y - 11));
          ctx.globalAlpha = 1;
        } else if (c.id === "c_cama") {
          ctx.fillStyle = "rgba(160,150,80,0.55)";
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, 11, 6, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        glint(q.x, q.y, 13, 8, "#ffd666");
      }
      if (g.done.has("m6")) for (let i = 0; i < RED_TRAIL.length; i++) {
        const q = P(RED_TRAIL[i]);
        if (!vis(q.x, q.y)) continue;
        ctx.globalAlpha = 0.75;
        ctx.save();
        ctx.translate(Math.round(q.x), Math.round(q.y));
        ctx.scale(-1, 1);
        ctx.drawImage(ds, -14, -11);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      const dp = P(DEER_PRINTS_E);
      if (vis(dp.x, dp.y)) {
        ctx.drawImage(ds, Math.round(dp.x - 14), Math.round(dp.y - 11));
        if (!f.prints) glint(dp.x, dp.y, 16, 10, "#ffd666");
      }
      const hr = P(HAIR);
      if (!f.hair) glint(hr.x, hr.y - 4, 12, 9, "#ff9a6a");
      const vz = P([VARZEA.x, VARZEA.y]);
      if (vis(vz.x, vz.y, 120)) {
        for (let i = 0; i < 22; i++) {
          const a = hash2(i, 3, 77) * Math.PI * 2, rr = Math.sqrt(hash2(i, 4, 77)) * 0.75;
          const x = vz.x + Math.cos(a) * VARZEA.rx * S4 * rr + Math.sin(t * 0.4 + i) * 3, y = vz.y + Math.sin(a) * VARZEA.ry * S4 * rr;
          ctx.globalAlpha = 0.18 + 0.16 * Math.sin(t * 1.3 + i * 1.7);
          ctx.fillStyle = i % 3 ? "#d8e4e0" : "#f0e8c8";
          ctx.fillRect(Math.round(x), Math.round(y), 3 + i % 3, 1);
        }
        ctx.globalAlpha = 1;
      }
      if (this.fruitT > t) {
        const fl = P(VINE.land);
        const fp = Sprites.get("fruits", () => fruitPile());
        ctx.drawImage(fp, Math.round(fl.x - 7), Math.round(fl.y - 4));
      }
      if (this.landed && t - this.landed.t < 20) {
        const rk = Sprites.get("rock:3", () => rockSprite(603, 6));
        ctx.drawImage(rk, Math.round(this.landed.x - rk.width / 2), Math.round(this.landed.y - rk.height + 2));
      }
      if (this.rollingStone) {
        const rk = Sprites.get("rock:3", () => rockSprite(603, 6));
        ctx.drawImage(rk, Math.round(this.rollingStone.x - rk.width / 2), Math.round(this.rollingStone.y - rk.height + 2));
      }
      if (!f.toroPlaced && g.done.has("m4")) {
        const end = P(PUZ.rail[2]);
        ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 2);
        ctx.strokeStyle = "#e8d8a0";
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(Math.round(end.x - 11), Math.round(end.y - 5), 22, 9);
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      if (!g.done.has("m2")) {
        const m = P(MIRANTE.at);
        glint(m.x, m.y, 14, 8);
      }
      if (g.done.has("m2")) {
        for (const k of ["VINE", "STONE_PUSH"]) {
          const q = P(phase2_data_exports[k].at);
          if (vis(q.x, q.y)) glint(q.x, q.y, 10, 6, "#a8d8f0");
        }
      }
    }
    // copas ficam translúcidas sobre os queixadas próximos e sobre o foco das cenas
    crownClear(V) {
      const g = this.g, p = g.player, out = this._clear || (this._clear = []);
      out.length = 0;
      if (!p) return out;
      if (g.state === "cutscene" && !g.camera.follow) out.push({ x: g.camera.x, y: g.camera.y + 8, r: 60, min: 0.3 });
      for (const h of this.herds) for (const m of h.members) {
        if (m.x < V.cx - 40 || m.x > V.cx + V.vw + 40 || m.y < V.cy - 20 || m.y > V.cy + V.vh + 60) continue;
        if (dist(m.x, m.y, p.x, p.y) < 240) out.push({ x: m.x, y: m.y, r: 18, min: 0.4 });
      }
      if (this.tapir && this.tapir.visible && dist(this.tapir.x, this.tapir.y, p.x, p.y) < 240) out.push({ x: this.tapir.x, y: this.tapir.y, r: 22, min: 0.4 });
      return out;
    }
    drawWorldOverlay(ctx) {
      const st = this.studyTarget;
      if (st) {
        const m = st.m, x = m.x, y = m.y - 22;
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = "rgba(20,14,6,0.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "#a8e0ff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(st.t, 0, 1));
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    drawAfterLight(ctx) {
      if (!this.marksA) return;
      const tr = P(FINAL_TREE);
      ctx.globalAlpha = this.marksA * 0.85;
      ctx.fillStyle = "#d8c8a0";
      for (let i = 0; i < 7; i++) {
        const y = Math.round(tr.y - 32 + i * 3);
        for (let k = 0; k < 3; k++) {
          ctx.fillRect(Math.round(tr.x - 3 + k + i % 2 * 2), y + k, 1, 1);
          ctx.fillRect(Math.round(tr.x + 3 - k - i % 2 * 2), y + k, 1, 1);
        }
      }
      ctx.fillStyle = "#5a3a24";
      ctx.fillRect(Math.round(tr.x - 1), Math.round(tr.y - 12), 3, 2);
      ctx.fillRect(Math.round(tr.x - 2), Math.round(tr.y - 14), 1, 2);
      ctx.fillRect(Math.round(tr.x + 2), Math.round(tr.y - 14), 1, 2);
      ctx.globalAlpha = 1;
    }
  };
  var Tapir = class {
    constructor(g, home, phase) {
      this.g = g;
      this.ph = phase;
      this.x = home.x;
      this.y = home.y;
      this.home = { ...home };
      this.state = "graze";
      this.timer = 3;
      this.aware = 0;
      this.face = 1;
      this.anim = 0;
      this.frame = 0;
      this.visible = true;
      this.target = null;
      this.whistleT = 8;
    }
    update(dt) {
      const g = this.g, p = g.player;
      if (!p) return;
      const d = dist(this.x, this.y, p.x, p.y);
      this.timer -= dt;
      this.whistleT -= dt;
      if (!this.visible) {
        if (this.timer <= 0 && d > 200) {
          this.visible = true;
          this.state = "graze";
          this.aware = 0;
          this.x = this.home.x;
          this.y = this.home.y;
        }
        return;
      }
      if (d > 500) return;
      let s = 0;
      const nr = p.noiseRadius() * 0.8;
      if (d < nr) s += 1.6 * (1 - d / nr) + 0.2;
      const sr = 64 * p.vis;
      if (d < sr) s += 1.2 * (1 - d / sr) + 0.2;
      if (d < 90 && g.isDownwind(p, this)) s += 0.7;
      if (d < 44) s += 1.5;
      this.aware = s > 0 ? Math.min(1.3, this.aware + s * dt) : Math.max(0, this.aware - dt * 0.25);
      let mx = 0, my = 0, sp = 0;
      if (this.state !== "flee" && this.aware >= 1) {
        this.state = "flee";
        this.timer = 3;
        g.audio.play("tapir", { pan: g.panOf(this.x), vol: 1 });
        g.audio.play("splash", { pan: g.panOf(this.x), vol: 0.6 });
        g.caption("A anta dispara para dentro da mata", g.panOf(this.x));
        if (!g.done.has("s_anta")) g.ui.toast("A anta se assustou. Ela volta depois de um tempo, se voc\xEA se afastar.", "tip", 4500);
      }
      if (this.state === "flee") {
        const tx = this.home.x - 60, ty = this.home.y - 40;
        const dx = tx - this.x, dy = ty - this.y, m = Math.hypot(dx, dy) || 1;
        mx = dx / m;
        my = dy / m;
        sp = 70;
        if (m < 8 || this.timer <= 0) {
          this.visible = false;
          this.timer = 35;
        }
      } else if (this.state === "walk") {
        const dx = this.target.x - this.x, dy = this.target.y - this.y, m = Math.hypot(dx, dy) || 1;
        mx = dx / m;
        my = dy / m;
        sp = 9;
        if (m < 3 || this.timer <= 0) {
          this.state = "graze";
          this.timer = 4 + Math.random() * 6;
        }
      } else if (this.timer <= 0) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * 40;
        this.target = { x: this.home.x + Math.cos(a) * r, y: this.home.y + Math.sin(a) * r * 0.6 };
        this.state = "walk";
        this.timer = 8;
      }
      if (sp) {
        const ox = this.x;
        this.g.world.moveCircle(this, mx * sp * dt, my * sp * dt, 5, true);
        if (Math.abs(this.x - ox) > 0.01) this.face = this.x > ox ? 1 : -1;
        this.anim += dt * (sp > 30 ? 10 : 3);
        this.frame = Math.floor(this.anim) % 4;
      }
      if (this.whistleT <= 0) {
        this.whistleT = 14 + Math.random() * 14;
        if (d < 300) {
          g.audio.play("tapir", { pan: g.panOf(this.x), vol: 0.5 * (1 - d / 300) });
          if (!g.flags.tapirCap) {
            g.flags.tapirCap = true;
            g.caption("Um assobio fino vindo do barreiro", g.panOf(this.x));
          }
        }
      }
    }
    draw(ctx) {
      if (!this.visible) return;
      const head = this.state === "graze" && Math.sin(this.g.time * 0.8) > -0.3 ? "down" : "mid";
      const k = `tapir:${this.frame}:${head}:${this.face < 0 ? 1 : 0}`;
      const s = Sprites.get(k, () => {
        const c = tapirSprite(this.frame, head);
        return this.face < 0 ? flipCanvas(c) : c;
      });
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + 1, 13, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.drawImage(s, Math.round(this.x - 17), Math.round(this.y - 18));
      if (this.aware > 0.3 && this.state !== "flee") {
        const x = Math.round(this.x), y = Math.round(this.y - 23);
        ctx.fillStyle = "#f4f0e0";
        ctx.fillRect(x - 1, y - 6, 3, 1);
        ctx.fillRect(x + 1, y - 5, 1, 1);
        ctx.fillRect(x, y - 4, 1, 1);
        ctx.fillRect(x, y - 1, 1, 1);
      }
    }
  };

  // js/gfx/art-varzea.js
  var OUT3 = "#120c07";
  var WOOD = ["#3e2716", "#5a3a22", "#7a5232", "#9a6c44"];
  var CANOE_HALF = 15;
  function canoeHull(idx, n = 32) {
    const S8 = 40, c = S8 / 2, a = idx / n * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const b = new PixBuf(S8, S8);
    for (let y = 0; y < S8; y++) for (let x = 0; x < S8; x++) {
      const dx = x + 0.5 - c, dy = (y + 0.5 - c) / 0.82;
      const u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
      const au = Math.abs(u) / CANOE_HALF;
      if (au > 1) continue;
      const hw = 4.9 * (1 - Math.pow(au, 1.9)) + 0.35;
      const av = Math.abs(v);
      if (av > hw) continue;
      let col;
      if (av > hw - 1.1) col = au > 0.86 ? WOOD[0] : WOOD[1];
      else {
        const sv = v >= 0 ? 1 : -1, lit = sv * sa * -0.55 + -sv * ca * -0.75 < 0 && av > hw * 0.45;
        col = WOOD[lit ? 3 : 2];
        if (!lit && hash2(x, y, 5) < 0.2) col = WOOD[1];
        if (Math.abs(v) < 0.6 && au < 0.8) col = WOOD[1];
        if (hash2(Math.round(u * 1.5), Math.round(v), 9) < 0.06) col = "#4e3220";
      }
      if (av < hw - 0.9 && (Math.abs(u - 6.5) < 0.9 || Math.abs(u + 5.5) < 0.9)) col = "#b08458";
      b.px(x, y, col);
    }
    b.outline(OUT3);
    return b.toCanvas();
  }
  function caetanoSeated(dir) {
    if (dir === "left") return flipCanvas(caetanoSeated("right"));
    const b = new PixBuf(14, 16);
    const shirt = ["#7c3320", "#a5462e", "#c45e40"], skin = "#b97a4e", skinD = "#8f5a36", straw = ["#8a6a34", "#b89a52", "#d8bc72"];
    b.shaded(7, 10.5, 4.2, 3.6, shirt, 4);
    for (let y = 8; y < 14; y += 2) b.mrect(3, y, 9, 1, "#7c3320");
    if (dir === "down") {
      b.rect(6, 7, 3, 2, skin);
      b.px(6, 9, skinD);
    }
    b.shaded(7, 5.6, 2.8, 2.6, [skinD, skin, skin, "#d0946a"], 7);
    if (dir === "down") {
      b.px(6, 6, "#1a120c");
      b.px(8, 6, "#1a120c");
    }
    if (dir === "right") b.px(9, 6, "#1a120c");
    if (dir === "up") b.blob(7, 6, 2.6, 2, "#2a1a10");
    b.shaded(7, 3.6, 5.2, 1.6, straw, 11);
    b.shaded(7, 2.6, 2.8, 1.8, straw, 12);
    b.rect(4.5, 3.2, 5, 1, "#5a3a1a");
    b.outline(OUT3);
    return b.toCanvas();
  }
  function remoIcon() {
    const b = new PixBuf(16, 16);
    b.line(2, 14, 10, 6, "#8a6038");
    b.line(3, 14, 11, 6, "#a87a4a");
    b.blob(12, 4, 2.6, 3.4, "#b88a58");
    b.blob(12.5, 3.5, 1.4, 2.2, "#d0a46a");
    b.rect(1, 14, 2, 1, "#6a4428");
    b.outline(OUT3);
    return b.toCanvas();
  }
  function heronPerched(frame) {
    const b = new PixBuf(14, 22);
    const W = ["#c8ccc8", "#e0e4e0", "#f4f6f2", "#ffffff"];
    b.line(6, 15, 6, 21, "#2a2a22");
    b.line(8, 15, 8, 21, "#2a2a22");
    b.shaded(7, 12, 4.2, 3.6, W, 3);
    const hx = frame % 2 ? 1 : 0;
    b.line(9, 10, 10 + hx, 6, W[2]);
    b.line(10, 10, 11 + hx, 6, W[1]);
    b.blob(10.5 + hx, 4.5, 1.8, 1.6, W[3]);
    b.line(12 + hx, 4, 13 + hx, 4, "#e0b020");
    b.px(13 + hx, 5, "#c89010");
    b.px(11 + hx, 4, "#101010");
    b.outline("#202020");
    return b.toCanvas();
  }
  function heronFlying(frame) {
    const b = new PixBuf(24, 12);
    const W = ["#c8ccc8", "#e0e4e0", "#f4f6f2", "#ffffff"];
    const up = frame % 2 === 0;
    b.shaded(12, 6, 4.5, 2, W, 5);
    for (let i = 0; i < 8; i++) {
      b.px(12 - i, up ? 5 - i * 0.5 : 6 + i * 0.4, W[2]);
      b.px(12 - i, up ? 6 - i * 0.5 : 7 + i * 0.4, W[1]);
    }
    b.line(16, 6, 20, 5, W[2]);
    b.line(20, 5, 23, 5, "#e0b020");
    b.line(8, 7, 4, 7, "#2a2a22");
    b.outline("#202020");
    return b.toCanvas();
  }
  function fishSprite(frame) {
    const b = new PixBuf(9, 5);
    b.shaded(4, 2.5, 3.4, 1.6, ["#5a6a70", "#8a9aa0", "#b8c8cc", "#e0ecee"], 21);
    const t = frame % 2 ? 1 : 0;
    b.px(0, 1 + t, "#6a7a80");
    b.px(0, 3 - t, "#6a7a80");
    b.px(7, 2, "#101418");
    b.outline("#1a2024");
    return b.toCanvas();
  }
  function aningaSprite(seed) {
    const rng = mulberry32(seed);
    const b = new PixBuf(18, 26);
    const n = 3 + (rng() * 2 | 0);
    for (let i = 0; i < n; i++) {
      const x = 4 + rng() * 10, top = 6 + rng() * 8;
      b.line(x, 25, x + (rng() - 0.5) * 2, top + 3, "#4a6a2a");
      const lx = x + (rng() - 0.5) * 3, ly = top;
      b.shaded(lx, ly, 3.4, 2.6, ["#1f3a14", "#2d5220", "#3f6a2a", "#5a8a3a"], seed + i);
      b.px(lx, ly + 2, "#1a2e10");
      b.px(lx - 1, ly + 3, "#1a2e10");
      b.px(lx + 1, ly + 3, "#1a2e10");
    }
    b.outline("#0e1a08");
    return b.toCanvas();
  }
  function canaranaSprite(seed) {
    const rng = mulberry32(seed);
    const b = new PixBuf(16, 12);
    for (let i = 0; i < 12; i++) {
      const x = 2 + rng() * 12, h = 5 + rng() * 6, lean = (rng() - 0.5) * 4;
      b.line(x, 11, x + lean, 11 - h, rng() < 0.5 ? "#6a8a32" : "#86a242");
    }
    b.outline("#1a2a0e");
    return b.toCanvas();
  }
  function capySprite(frame, pose = "walk") {
    const b = new PixBuf(28, 17);
    const pal = ["#4e3620", "#6e4e30", "#8a6440", "#a27a52"];
    const l = frame % 2;
    if (pose === "rest") {
      b.shaded(12, 11.5, 9.5, 3.8, pal, 33);
      b.shaded(21.5, 11, 4.4, 3.1, pal, 34);
      b.rect(23.5, 10, 3, 3, pal[2]);
      b.rect(19, 7, 2, 2, "#4a3220");
      b.rect(22, 10, 2, 1, "#2a1a10");
      if (l) b.mrect(8, 8, 8, 1, pal[3]);
    } else {
      const hy = pose === "graze" ? 2.6 : pose === "alert" ? -1.2 : 0;
      if (pose === "walk") {
        b.rect(7 + l, 12, 3, 3, "#3a2818");
        b.rect(17 - l, 12, 3, 3, "#3a2818");
      } else {
        b.rect(7, 12, 3, 3, "#3a2818");
        b.rect(17, 12, 3, 3, "#3a2818");
      }
      b.shaded(12, 9, 9, 5, pal, 31);
      b.shaded(21, 7.5 + hy, 4.5, 3.6, pal, 32);
      b.rect(23, 6 + hy, 3, 4, pal[2]);
      b.rect(23, 9 + hy, 3, 1, pal[1]);
      b.rect(19, 3 + hy, 2, 2, "#4a3220");
      b.px(22, 6 + hy, "#120a06");
      b.px(25, 7 + hy, "#2a1a10");
      if (pose === "graze") for (let i = 0; i < 3; i++) b.px(24 + i, 13, "#5a8a32");
    }
    b.outline("#1a120c");
    return b.toCanvas();
  }
  function tapirSniff(frame) {
    const b = new PixBuf(34, 20);
    const pal = ["#221d1a", "#332c27", "#463c35", "#5a4e45"];
    [5, 9, 19, 23].forEach((x, i) => {
      b.rect(x, 13, 2, 5, i % 2 ? "#1a1512" : "#241e1a");
      b.rect(x, 17, 2, 1, "#3a3430");
    });
    b.shaded(14, 10, 11, 6, pal, 91);
    b.shaded(9, 9.5, 6.5, 6, pal, 92);
    const hy = 7;
    b.shaded(26, hy, 4.5, 3.6, pal, 93);
    const curl = frame % 2;
    for (let k = 0; k < 4; k++) b.px(30 + k, hy - k * 0.6 - curl * (k > 2 ? 1 : 0), pal[1]);
    b.px(33, hy - 3 - curl, "#5a4a44");
    for (let x = 20; x < 27; x++) b.px(x, hy - 4 + (x > 24 ? 1 : 0), "#120e0c");
    b.px(23, hy - 4, "#e8e2d8");
    b.px(23, hy - 5, "#3a322c");
    b.px(24, hy - 5, "#e8e2d8");
    b.px(27, hy - 1, "#050403");
    b.outline("#0e0a08");
    return b.toCanvas();
  }
  function jirauSprite(withPaddle) {
    const b = new PixBuf(40, 28);
    for (const x of [4, 34]) {
      b.rect(x, 8, 2, 19, "#4a3420");
      b.px(x - 1, 8, "#4a3420");
      b.px(x + 2, 8, "#4a3420");
    }
    for (let i = 0; i < 9; i++) b.line(2, 10 + i % 2, 38, 9 + i % 3, i % 2 ? "#7a5a38" : "#8e6e48");
    b.rect(10, 10, 6, 1, "#3a2a18");
    b.rect(24, 11, 5, 1, "#3a2a18");
    for (let i = 0; i < 8; i++) b.px(6 + hash2(i, 1, 4) * 28, 8 + hash2(i, 2, 4) * 3, "#4f7a32");
    if (withPaddle) {
      b.line(20, 26, 30, 4, "#8a6038");
      b.line(21, 26, 31, 4, "#a87a4a");
      b.blob(31, 3, 2, 3, "#b88a58");
    }
    b.outline(OUT3);
    return b.toCanvas();
  }
  function tapiriSprite() {
    const W = 60, H = 48;
    const b = new PixBuf(W, H);
    for (const x of [8, 50]) b.rect(x, 20, 3, 27, "#4a3420");
    b.rect(29, 16, 2, 31, "#4a3420");
    for (let y = 4; y < 24; y++) {
      const w = 6 + (y - 4) * 1.35;
      for (let x = 30 - w; x <= 30 + w; x++) {
        const t = hash2(x | 0, y, 77);
        b.px(x, y, y > 21 ? "#6e5a2a" : t < 0.3 ? "#8a7234" : t < 0.7 ? "#a68a44" : "#c0a456");
      }
    }
    for (let x = 4; x < 56; x += 3) b.line(x, 23, x + 1, 26, "#8a7234");
    b.rect(29, 3, 2, 2, "#5a4422");
    b.blob(30, 44, 18, 3, "#5e4a30");
    b.blob(24, 44, 3, 1.4, "#2a2018");
    b.outline(OUT3);
    return b.toCanvas();
  }
  function branchSprite() {
    const b = new PixBuf(40, 14);
    b.line(2, 8, 36, 6, "#5a4430");
    b.line(2, 9, 36, 7, "#6e5238");
    b.line(3, 10, 35, 8, "#4a3624");
    b.line(14, 7, 20, 1, "#5a4430");
    b.line(26, 7, 31, 12, "#5a4430");
    for (let i = 0; i < 6; i++) b.blob(18 + i * 3, 2 + i % 2, 2, 1.5, i % 2 ? "#3f6a2a" : "#4f8536");
    b.outline(OUT3);
    return b.toCanvas();
  }
  function lilyCluster(ctx, x, y, seed, a = 1) {
    const r = mulberry32(seed);
    ctx.globalAlpha = a;
    for (let i = 0; i < 5; i++) {
      const px6 = x + (r() - 0.5) * 16, py = y + (r() - 0.5) * 8, s = 2 + r() * 2;
      ctx.fillStyle = r() < 0.5 ? "#3f6a2a" : "#4f8536";
      ctx.beginPath();
      ctx.ellipse(px6, py, s, s * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2a4a1c";
      ctx.fillRect(Math.round(px6), Math.round(py - s * 0.6), 1, Math.ceil(s * 0.6));
      if (r() < 0.2) {
        ctx.fillStyle = "#c890d8";
        ctx.fillRect(Math.round(px6 + 1), Math.round(py - 1), 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  // js/entities/canoe.js
  var S5 = 16;
  var SQ = 0.82;
  var Poly = class {
    constructor(pts) {
      this.p = pts.map(([x, y, w, c]) => ({ x: x * S5, y: y * S5, w: w * S5, c }));
      this.seg = [];
      let acc = 0;
      for (let i = 0; i < this.p.length - 1; i++) {
        const a = this.p[i], b = this.p[i + 1], L = Math.hypot(b.x - a.x, b.y - a.y);
        this.seg.push({ a, b, L, acc, tx: (b.x - a.x) / L, ty: (b.y - a.y) / L });
        acc += L;
      }
      this.len = acc;
    }
    // ponto, tangente e propriedades na distância s ao longo da linha
    at(s) {
      s = clamp(s, 0, this.len);
      let g = this.seg[this.seg.length - 1];
      for (const q of this.seg) if (s <= q.acc + q.L) {
        g = q;
        break;
      }
      const k = clamp((s - g.acc) / g.L, 0, 1);
      return { x: g.a.x + (g.b.x - g.a.x) * k, y: g.a.y + (g.b.y - g.a.y) * k, tx: g.tx, ty: g.ty, w: lerp(g.a.w, g.b.w, k), c: lerp(g.a.c, g.b.c, k), s };
    }
    segPoint(i, t, off = 0) {
      const g = this.seg[Math.min(i, this.seg.length - 1)];
      const x = g.a.x + (g.b.x - g.a.x) * t, y = g.a.y + (g.b.y - g.a.y) * t;
      return { x: x - g.ty * off * S5, y: y + g.tx * off * S5 };
    }
    // projeção de um ponto: distância à linha, parâmetro s e propriedades interpoladas
    project(x, y) {
      let best = null;
      for (const q of this.seg) {
        const vx = x - q.a.x, vy = y - q.a.y;
        const k = clamp((vx * q.tx + vy * q.ty) / q.L, 0, 1);
        const cx = q.a.x + (q.b.x - q.a.x) * k, cy = q.a.y + (q.b.y - q.a.y) * k;
        const d = Math.hypot(x - cx, y - cy);
        if (!best || d < best.d) best = { d, s: q.acc + k * q.L, tx: q.tx, ty: q.ty, w: lerp(q.a.w, q.b.w, k), c: lerp(q.a.c, q.b.c, k), cx, cy };
      }
      return best;
    }
  };
  function buildCurrent(world, polys) {
    const tw = world.tw, th = world.th, F = new Float32Array(tw * th * 2);
    for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
      const x = tx * S5 + 8, y = ty * S5 + 8;
      if (!world.isWater(x, y)) continue;
      let best = null;
      for (const P3 of polys) {
        const q = P3.project(x, y);
        if (q.d < q.w * 0.75 && (!best || q.d < best.d)) best = q;
      }
      if (!best) continue;
      const prof = clamp(1 - Math.pow(best.d / (best.w * 0.5), 2) * 0.75, 0.2, 1);
      const i = (ty * tw + tx) * 2;
      F[i] = -best.tx * best.c * prof;
      F[i + 1] = -best.ty * best.c * prof;
    }
    return {
      at(x, y) {
        const tx = clamp(x / S5 | 0, 0, tw - 1), ty = clamp(y / S5 | 0, 0, th - 1), i = (ty * tw + tx) * 2;
        return { x: F[i], y: F[i + 1] };
      },
      F
    };
  }
  var HULL = [[-11, 2.4], [-5.5, 3.6], [0, 4.2], [5.5, 3.6], [11, 2.4]];
  var ACC = 44;
  var MAXF = 64;
  var MAXB = 22;
  var BRAKE = 70;
  var Canoe = class {
    constructor(g, ph, x, y, a) {
      this.g = g;
      this.ph = ph;
      this.x = x;
      this.y = y;
      this.a = a;
      this.vx = 0;
      this.vy = 0;
      this.f = 0;
      this.l = 0;
      this.state = "stuck";
      this.stroke = 0;
      this.side = 1;
      this.strokeOn = false;
      this.rock = 0;
      this.rockV = 0;
      this.bob = 0;
      this.wakeT = 0;
      this.stuckT = 0;
      this.hits = 0;
      this.lastHit = -9;
      this.turb = 0;
      this.thrust = 0;
      this.turn = 0;
      this.sortY = y;
    }
    get speed() {
      return Math.hypot(this.vx, this.vy);
    }
    dir() {
      return { x: Math.cos(this.a), y: Math.sin(this.a) };
    }
    // ---------- colisão ----------
    // círculos ao longo do casco (no espaço do mundo, com o achatamento da vista)
    circles(x, y, a) {
      const ca = Math.cos(a), sa = Math.sin(a);
      return HULL.map(([u, r]) => ({ x: x + ca * u, y: y + sa * u * SQ, r }));
    }
    water(x, y) {
      return this.g.world.isWater(x, y) && !this.g.world.blockedAt(x, y, true);
    }
    hitAt(x, y, a) {
      const w = this.g.world;
      for (const c of this.circles(x, y, a)) {
        for (const [dx, dy] of [[0, 0], [c.r, 0], [-c.r, 0], [0, c.r * 0.9], [0, -c.r * 0.9]]) if (!this.water(c.x + dx, c.y + dy)) return "bank";
        for (const o of w.near(c.x, c.y)) {
          if (o.off || o.noBoat) continue;
          if (o.r) {
            if ((c.x - o.x) ** 2 + (c.y - o.y) ** 2 < (c.r + o.r) ** 2) return o.kind || "obstacle";
          } else if (o.w !== void 0) {
            const nx = clamp(c.x, o.x, o.x + o.w), ny = clamp(c.y, o.y, o.y + o.h);
            if ((c.x - nx) ** 2 + (c.y - ny) ** 2 < c.r * c.r) return o.kind || "obstacle";
          }
        }
        const lg = this.ph.logHit?.(c.x, c.y, c.r);
        if (lg) return "log";
      }
      return null;
    }
    free(x = this.x, y = this.y, a = this.a) {
      return !this.hitAt(x, y, a);
    }
    // ---------- controle ----------
    input() {
      const inp = this.g.input;
      let thrust = 0, turn = 0;
      if (inp.joy && inp.joy.active) {
        const ax = inp.joy.x, ay = inp.joy.y, m = Math.min(1, Math.hypot(ax, ay));
        if (m > 0.2) {
          const want = Math.atan2(ay, ax);
          let d = want - this.a;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          turn = clamp(d * 2.2, -1, 1);
          thrust = Math.abs(d) < 1.6 ? m * (1 - Math.abs(d) / 2.2) : -0.4 * m;
        }
      } else {
        if (inp.isDown("up")) thrust += 1;
        if (inp.isDown("down")) thrust -= 1;
        if (inp.isDown("left")) turn -= 1;
        if (inp.isDown("right")) turn += 1;
      }
      return { thrust, turn };
    }
    update(dt) {
      const g = this.g;
      this.bob += dt;
      this.rockV += -this.rock * 22 * dt - this.rockV * 2.2 * dt;
      this.rock += this.rockV * dt;
      if (this.state !== "boarded") {
        this.vx = this.vy = 0;
        this.f = this.l = 0;
        this.thrust = this.turn = 0;
        return;
      }
      const ctl = g.state === "play" ? this.input() : { thrust: 0, turn: 0 };
      this.thrust = ctl.thrust;
      this.turn = ctl.turn;
      const cur = this.ph.currentAt(this.x, this.y);
      const cx = cur.x * 0.85, cy = cur.y * 0.85;
      let h = this.dir();
      let rx = this.vx - cx, ry = this.vy - cy;
      let f = rx * h.x + ry * h.y, l = -rx * h.y + ry * h.x;
      const turnRate = 1.05 + 0.9 * Math.min(1, Math.abs(f) / 40);
      const na = this.a + ctl.turn * turnRate * dt * (f < -2 ? -0.7 : 1);
      if (ctl.turn && this.free(this.x, this.y, na)) this.a = na;
      else if (ctl.turn) {
        this.rockV += ctl.turn * 0.6 * dt;
      }
      h = this.dir();
      if (ctl.thrust > 0) f = Math.min(MAXF, f + ctl.thrust * ACC * dt * (f < 0 ? 2 : 1));
      else if (ctl.thrust < 0) f = f > 0 ? Math.max(0, f - BRAKE * dt) : Math.max(-MAXB, f + ctl.thrust * ACC * 0.6 * dt);
      f *= Math.exp(-0.42 * dt);
      l *= Math.exp(-3.8 * dt);
      if (this.ph.inFloatGrass?.(this.x, this.y)) f *= Math.exp(-1.8 * dt);
      if (this.turb > 0) {
        const k = this.turb;
        l += Math.sin(g.time * 3.1) * 18 * k * dt + (Math.random() - 0.5) * 40 * k * dt;
        this.rockV += (Math.random() - 0.5) * 9 * k * dt;
      }
      this.f = f;
      this.l = l;
      this.vx = cx + h.x * f - h.y * l;
      this.vy = cy + h.y * f + h.x * l;
      this.move(dt);
      this.sortY = this.y;
      const paddling = Math.abs(ctl.thrust) > 0.05 || Math.abs(ctl.turn) > 0.05;
      if (paddling) {
        const prev = this.stroke;
        this.stroke += dt * (ctl.thrust < 0 ? 1.1 : 1.5);
        if (Math.floor(prev) !== Math.floor(this.stroke)) {
          this.side = ctl.turn > 0.3 ? -1 : ctl.turn < -0.3 ? 1 : -this.side;
          this.strokeOn = true;
          const p = this.paddlePoint(0.2);
          g.audio.play("paddle", { pan: 0, vol: 0.55 + 0.3 * Math.abs(ctl.thrust) });
          for (let i = 0; i < 5; i++) g.particles.add({ type: "splash", x: p.x, y: p.y, vx: (Math.random() - 0.5) * 24, vy: -10 - Math.random() * 14, g: 60, life: 0.45, color: "#d8e8f0" });
          g.particles.add({ type: "ripple", x: p.x, y: p.y, life: 0.9, r1: 7, color: "#cfe0e4" });
          g.player.makeNoise(0.32);
        }
      } else this.strokeOn = false;
      const sp = this.speed;
      this.wakeT -= dt;
      if (sp > 7 && this.wakeT <= 0) {
        this.wakeT = 0.16 - Math.min(0.08, sp / 900);
        const st = { x: this.x - h.x * 12, y: this.y - h.y * 12 * SQ };
        for (const sd of [-1, 1]) g.particles.add({ type: "ripple", x: st.x - h.y * sd * 4, y: st.y + h.x * sd * 3, vx: -h.y * sd * 6, vy: h.x * sd * 4, life: 1.2, r1: 5 + sp / 12, color: "#bcd2d6" });
      }
      if (Math.abs(ctl.thrust) > 0.3 && sp < 4) this.stuckT += dt;
      else this.stuckT = Math.max(0, this.stuckT - dt * 2);
    }
    move(dt) {
      const steps = Math.max(1, Math.ceil(this.speed * dt / 1.5));
      const sx = this.vx * dt / steps, sy = this.vy * dt / steps;
      for (let i = 0; i < steps; i++) {
        const nx = this.x + sx, ny = this.y + sy;
        if (this.free(nx, ny, this.a)) {
          this.x = nx;
          this.y = ny;
          continue;
        }
        const what = this.hitAt(nx, ny, this.a);
        if (this.free(nx, this.y, this.a)) {
          this.x = nx;
          this.vy *= 0.4;
          this.bump(Math.abs(this.vy) + Math.abs(sy / dt) * 0.5, what, true);
          continue;
        }
        if (this.free(this.x, ny, this.a)) {
          this.y = ny;
          this.vx *= 0.4;
          this.bump(Math.abs(this.vx) + Math.abs(sx / dt) * 0.5, what, true);
          continue;
        }
        this.bump(this.speed, what, false);
        this.vx *= -0.25;
        this.vy *= -0.25;
        const h = this.dir();
        this.f = this.vx * h.x + this.vy * h.y;
        break;
      }
    }
    bump(force, what, glancing) {
      const g = this.g;
      if (g.time - this.lastHit < (glancing ? 0.6 : 0.35)) return;
      if (force < (glancing ? 16 : 6)) return;
      this.lastHit = g.time;
      this.hits++;
      const k = clamp(force / 60, 0.2, 1);
      this.rockV += (Math.random() < 0.5 ? -1 : 1) * 4 * k;
      g.audio.play(what === "bank" ? "canoeScrape" : "canoeHit", { vol: 0.5 + k * 0.6 });
      g.camera.shake(0.6 + k * 1.2, 0.18);
      g.player.makeNoise(0.6 * k + 0.2);
      for (let i = 0; i < 6; i++) g.particles.add({ type: "splash", x: this.x + (Math.random() - 0.5) * 16, y: this.y + (Math.random() - 0.5) * 6, vx: (Math.random() - 0.5) * 30, vy: -14 - Math.random() * 10, g: 60, life: 0.5, color: "#d8e8f0" });
      this.ph.onCanoeHit?.(what, k);
    }
    // empurra a canoa para o lugar livre mais próximo (segurança contra ficar preso)
    unstick() {
      if (this.free()) return true;
      for (let r = 2; r <= 40; r += 2) for (let k = 0; k < 16; k++) {
        const an = k / 16 * Math.PI * 2, x = this.x + Math.cos(an) * r, y = this.y + Math.sin(an) * r;
        for (const da of [0, 0.3, -0.3, 0.6, -0.6]) if (this.free(x, y, this.a + da)) {
          this.x = x;
          this.y = y;
          this.a += da;
          return true;
        }
      }
      return false;
    }
    paddlePoint(k = this.stroke % 1) {
      const h = this.dir(), sd = this.side;
      const along = lerp(5, -6, k);
      return { x: this.x + h.x * (along - 1) - h.y * sd * 9, y: this.y + h.y * (along - 1) * SQ + h.x * sd * 7 };
    }
    // ---------- desenho ----------
    draw(ctx) {
      const g = this.g;
      const n = 32;
      let a = this.a;
      while (a < 0) a += Math.PI * 2;
      const idx = Math.round(a / (Math.PI * 2) * n) % n;
      const hull = Sprites.get("canoe:" + idx, () => canoeHull(idx, n));
      const bob = this.state === "stuck" ? 0 : Math.round(Math.sin(this.bob * 2.2) * 0.6 + this.rock * 2);
      const x = Math.round(this.x), y = Math.round(this.y);
      ctx.globalAlpha = this.state === "stuck" ? 0.25 : 0.32;
      ctx.fillStyle = this.state === "stuck" ? "#1a1208" : "#0a1418";
      ctx.save();
      ctx.translate(x, y + 2);
      ctx.scale(1, SQ);
      ctx.rotate(this.a);
      ctx.beginPath();
      ctx.ellipse(0, 0, CANOE_HALF + 1, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.drawImage(hull, x - 20, y - 20 + bob);
      if (this.state !== "stuck") {
        ctx.globalAlpha = 0.18 + 0.06 * Math.sin(this.bob * 3);
        ctx.strokeStyle = "#d8e8ec";
        ctx.lineWidth = 1;
        ctx.save();
        ctx.translate(x, y + bob + 1);
        ctx.scale(1, SQ);
        ctx.rotate(this.a);
        ctx.beginPath();
        ctx.ellipse(0, 0, CANOE_HALF + 1.5, 6.4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      if (this.state !== "boarded") return;
      const h = this.dir();
      const sx = x - h.x * 5, sy = y - h.y * 5 * SQ + bob;
      const facing = Math.abs(h.x) > Math.abs(h.y) * 1.1 ? h.x > 0 ? "right" : "left" : h.y > 0 ? "down" : "up";
      const sp = Sprites.get("seat:" + facing, () => caetanoSeated(facing));
      const lean = Math.round(this.rock * 3);
      const pp = this.paddlePoint();
      const hx = sx + lean, hy = sy - 6;
      const behind = pp.y < hy;
      const drawPaddle = () => {
        ctx.strokeStyle = "#8a6038";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hx - h.y * this.side * 2, hy);
        ctx.lineTo(pp.x, pp.y - 1);
        ctx.stroke();
        ctx.fillStyle = "#b88a58";
        ctx.beginPath();
        ctx.ellipse(pp.x, pp.y, 2, 1.3, this.a, 0, Math.PI * 2);
        ctx.fill();
      };
      if (behind) drawPaddle();
      ctx.drawImage(sp, Math.round(sx - 7 + lean), Math.round(sy - 15));
      if (!behind) drawPaddle();
    }
  };
  var DriftLogs = class {
    constructor(g, ph, poly, s0, s1, n = 5, seed = 7) {
      this.g = g;
      this.ph = ph;
      this.P = poly;
      this.s0 = s0;
      this.s1 = s1;
      this.list = [];
      for (let i = 0; i < n; i++) this.list.push(this.spawn(s1 - i / n * (s1 - s0), i + seed));
    }
    spawn(s, k) {
      const len = 22 + hash2(k, 1, 3) * 16;
      return { s, off: (hash2(k, 2, 3) - 0.5) * 0.9, len, r: 3.4, spin: (hash2(k, 4, 3) - 0.5) * 0.5, ang: 0, x: 0, y: 0, k, t: hash2(k, 5, 3) * 9 };
    }
    update(dt) {
      for (const L of this.list) {
        const q = this.P.at(L.s);
        L.s -= (q.c + 5) * dt;
        L.t += dt;
        if (L.s < this.s0) {
          Object.assign(L, this.spawn(this.s1 + Math.random() * 60, L.k + 17));
          L.k += 17;
        }
        const p = this.P.at(L.s), half = p.w * 0.5 - 7;
        L.off = clamp(L.off, -half / S5, half / S5);
        L.x = p.x - p.ty * L.off * S5;
        L.y = p.y + p.tx * L.off * S5;
        L.ang = Math.atan2(p.ty, p.tx) + L.spin + Math.sin(L.t * 0.6) * 0.15;
        if (Math.random() < dt * 1.2) this.g.particles.add({ type: "ripple", x: L.x + Math.cos(L.ang) * L.len * 0.5, y: L.y + Math.sin(L.ang) * L.len * 0.5 * SQ, life: 1, r1: 5, color: "#bcd2d6" });
      }
    }
    // distância de um círculo ao tronco (cápsula)
    hit(x, y, r) {
      for (const L of this.list) {
        const ca = Math.cos(L.ang), sa = Math.sin(L.ang) * SQ, h = L.len / 2;
        const vx = x - L.x, vy = y - L.y;
        const t = clamp(vx * ca + vy * sa, -h, h);
        const qx = L.x + ca * t, qy = L.y + sa * t;
        if ((x - qx) ** 2 + (y - qy) ** 2 < (r + L.r) ** 2) return L;
      }
      return null;
    }
    nudge(L, x, y) {
      const p = this.P.at(L.s);
      L.off += Math.sign(-(x - L.x) * p.ty + (y - L.y) * p.tx || 1) * -0.25;
    }
    draw(ctx, V) {
      for (const L of this.list) {
        if (L.x < V.cx - 40 || L.x > V.cx + V.vw + 40 || L.y < V.cy - 40 || L.y > V.cy + V.vh + 40) continue;
        const len = Math.round(L.len);
        const s = Sprites.get("drift:" + len, () => logSprite(5100 + len, len, 3.5, true));
        ctx.save();
        ctx.translate(Math.round(L.x), Math.round(L.y));
        ctx.scale(1, SQ);
        ctx.rotate(L.ang);
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = "#0a1418";
        ctx.beginPath();
        ctx.ellipse(0, 2, len / 2 + 2, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.drawImage(s, -Math.round(s.width / 2), -Math.round(s.height / 2) + Math.round(Math.sin(L.t * 1.7) * 0.6));
        ctx.restore();
      }
    }
  };

  // js/ai/fauna-varzea.js
  function sense(g, a, K, los) {
    const p = g.player, out = { s: 0, heard: false, seen: false, smelled: false, d: 1e9 };
    if (!p || p.hidden) return out;
    const d = dist(a.x, a.y, p.x, p.y);
    out.d = d;
    if (d > 320) return out;
    const nr = p.noiseRadius() * K.hearing;
    if (nr > 0 && d < nr) {
      out.s += 2 * (1 - d / nr) + 0.3;
      out.heard = true;
    }
    const sr = K.sight * (p.vis ?? 1);
    if (d < sr && (!los || los(a.x, a.y - 4, p.x, p.y - 8))) {
      out.s += 1.5 * (1 - d / sr) + 0.2;
      out.seen = true;
    }
    if (K.smell && d < K.smell && g.isDownwind(p, a)) {
      out.s += K.smellW ?? 1;
      out.smelled = true;
    }
    return out;
  }
  function moveBody(g, e, mx, my, sp, dt, r = 4, canWater = false) {
    const c = e.col;
    if (c) c.off = true;
    const ox = e.x, oy = e.y;
    g.world.moveCircle(e, mx * sp * dt, my * sp * dt, r, canWater);
    if (c) c.off = !!e.colOff;
    return Math.hypot(e.x - ox, e.y - oy);
  }
  function drawAwareIcon(ctx, x, y, kind) {
    x = Math.round(x);
    y = Math.round(y);
    ctx.fillStyle = "rgba(20,14,6,0.75)";
    ctx.fillRect(x - 2, y - 8, 5, 9);
    ctx.fillStyle = kind === "!" ? "#ff7a4a" : "#ffe08a";
    if (kind === "!") {
      ctx.fillRect(x, y - 7, 1, 4);
      ctx.fillRect(x, y - 1, 1, 1);
    } else {
      ctx.fillRect(x - 1, y - 7, 3, 1);
      ctx.fillRect(x + 1, y - 6, 1, 1);
      ctx.fillRect(x, y - 5, 1, 1);
      ctx.fillRect(x, y - 3, 1, 1);
      ctx.fillRect(x, y - 1, 1, 1);
    }
  }
  var shadow = (ctx, x, y, rx, ry, a = 0.28) => {
    ctx.globalAlpha = a;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  };
  var TS = { WALK: "CAMINHAR", FEED: "ALIMENTAR", SNIFF: "FAREJAR", ALERT: "ALERTA", FLEE: "FUGIR", RETURN: "RETORNAR", GONE: "SUMIDA" };
  var TAPIR_K = { hearing: 0.75, sight: 54, smell: 88, smellW: 0.7 };
  var TapirV = class {
    // route: [{ x, y, feed: [min, max] | null, hold?: true }] ao longo da trilha da anta
    constructor(g, ph, route, startIdx = 0, o = {}) {
      this.g = g;
      this.ph = ph;
      this.route = route;
      this.i = startIdx;
      this.dirn = 1;
      const n = route[startIdx];
      this.x = n.x;
      this.y = n.y;
      this.state = TS.FEED;
      this.timer = n.feed ? lerp(n.feed[0], n.feed[1], Math.random()) : 3;
      this.aware = 0;
      this.face = 1;
      this.anim = 0;
      this.frame = 0;
      this.visible = true;
      this.head = "down";
      this.prev = null;
      this.trampled = false;
      this.fleeTo = null;
      this.goneT = 0;
      this.sniffT = 0;
      this.r = 5;
      this.rng = o.rng || Math.random;
      this.col = g.world.addCollider({ x: this.x, y: this.y - 2, r: 7, dyn: true, kind: "tapir", noBoat: true });
      this.events = [];
    }
    calm() {
      return [TS.WALK, TS.FEED, TS.SNIFF, TS.RETURN].includes(this.state);
    }
    enter(s, t = 0) {
      this.prev = this.state;
      this.state = s;
      this.timer = t;
      this.g.onAnimalEvent?.(this, "tapir:" + s);
    }
    node() {
      return this.route[this.i];
    }
    update(dt) {
      const g = this.g, p = g.player;
      if (!p) return;
      this.timer -= dt;
      if (this.state === TS.GONE) {
        this.colOff = true;
        this.col.off = true;
        if (this.timer <= 0 && dist(this.x, this.y, p.x, p.y) > 150) {
          this.visible = true;
          this.aware = 0;
          this.colOff = false;
          this.col.off = false;
          this.enter(TS.RETURN);
          this.ph.onTapirEvent?.("volta");
        }
        return;
      }
      const sn = this.state === TS.FLEE ? { s: 0, d: dist(this.x, this.y, p.x, p.y) } : sense(g, this, TAPIR_K, this.ph.los ? (a, b, c, d) => this.ph.los(a, b, c, d) : null);
      this.lastSense = sn;
      const sens = this.state === TS.FEED ? 0.75 : 1;
      if (sn.s > 0) this.aware = Math.min(1.3, this.aware + sn.s * dt * sens);
      else this.aware = Math.max(0, this.aware - dt * 0.22);
      if (this.calm()) {
        if (this.aware >= 1) return this.startFlee();
        if (this.aware >= 0.62) {
          this.enter(TS.ALERT, 2.6);
          this.face = p.x > this.x ? 1 : -1;
        } else if (this.aware >= 0.3 && this.state !== TS.SNIFF && this.sniffT <= 0) {
          this.resumeTo = this.state;
          this.enter(TS.SNIFF, 1.8 + this.rng() * 1.4);
          this.sniffT = 6;
        }
      }
      this.sniffT -= dt;
      let mx = 0, my = 0, sp = 0;
      switch (this.state) {
        case TS.FEED: {
          this.head = Math.sin(g.time * 0.9 + this.x) > -0.4 ? "down" : "mid";
          const n = this.node();
          const hold = n.hold && this.ph.holdTapir?.(this);
          if (this.rng() < dt * 0.12) {
            const rem = this.timer;
            this.resumeTo = TS.FEED;
            this.enter(TS.SNIFF, 1.5 + this.rng());
            this.timer2 = rem;
            break;
          }
          if (!hold && this.timer <= 0) this.nextNode();
          break;
        }
        case TS.SNIFF:
          this.head = "up";
          if (this.lastSense && this.lastSense.d < 200 && this.aware > 0.2) this.face = p.x > this.x ? 1 : -1;
          if (this.timer <= 0) {
            const r = this.resumeTo || TS.WALK;
            this.state = r;
            this.timer = r === TS.FEED ? Math.max(this.timer2 ?? 4, 4) : 0;
            this.timer2 = null;
          }
          break;
        case TS.ALERT:
          this.head = "mid";
          this.face = p.x > this.x ? 1 : -1;
          if (this.aware >= 1) return this.startFlee();
          if (this.timer <= 0 && this.aware < 0.5) {
            const a = this.route[Math.min(this.route.length - 1, this.i + 1)], b = this.route[Math.max(0, this.i - 1)];
            this.dirn = dist(a.x, a.y, p.x, p.y) > dist(b.x, b.y, p.x, p.y) ? 1 : -1;
            this.i = clamp(this.i + this.dirn, 0, this.route.length - 1);
            this.enter(TS.WALK);
            this.changed = true;
            this.ph.onTapirEvent?.("desvia");
          }
          break;
        case TS.WALK:
        case TS.RETURN: {
          const n = this.node();
          const dx = n.x - this.x, dy = n.y - this.y, d = Math.hypot(dx, dy);
          if (d < 3) {
            if (this.state === TS.RETURN) this.state = TS.WALK;
            if (n.feed) {
              this.state = TS.FEED;
              this.timer = lerp(n.feed[0], n.feed[1], this.rng()) * (n.hold && !this.changed ? 1 : 0.8);
              this.changed = false;
            } else this.nextNode(true);
            break;
          }
          mx = dx / d;
          my = dy / d;
          sp = this.state === TS.RETURN ? 9 : 11;
          this.head = "mid";
          if (this.rng() < dt * 0.05) {
            this.resumeTo = this.state;
            this.enter(TS.SNIFF, 1.2 + this.rng());
          }
          break;
        }
        case TS.FLEE: {
          const t = this.fleeTo;
          const n = this.route[t.i];
          const dx = n.x - this.x, dy = n.y - this.y, d = Math.hypot(dx, dy);
          if (d < 4) {
            if (t.i === t.end) {
              this.visible = false;
              this.enter(TS.GONE, 28 + this.rng() * 12);
              this.i = t.end;
              this.dirn = t.end === 0 ? 1 : -1;
              this.ph.onTapirEvent?.("sumiu");
              break;
            }
            t.i += t.step;
            break;
          }
          mx = dx / d;
          my = dy / d;
          sp = 64;
          if (!this.trampled && dist(this.x, this.y, p.x, p.y) < 12) {
            this.trampled = true;
            p.hurt?.(9, "A anta passou por cima de Caetano na disparada!");
            const k = Math.hypot(p.x - this.x, p.y - this.y) || 1;
            g.world.moveCircle(p, (p.x - this.x) / k * 8 + my * 6, (p.y - this.y) / k * 8 - mx * 6, p.r);
          }
          break;
        }
      }
      if (sp) {
        this.colOff = this.state === TS.FLEE;
        const moved = moveBody(g, this, mx, my, sp, dt, 5, false);
        if (Math.abs(mx) > 0.1) this.face = mx > 0 ? 1 : -1;
        this.anim += dt * (sp > 30 ? 11 : 3.4);
        this.frame = Math.floor(this.anim) % 4;
        this.stuckT = moved < sp * dt * 0.2 ? (this.stuckT || 0) + dt : 0;
        if (this.stuckT > 1.5) {
          this.x = lerp(this.x, this.node().x, 0.5);
          this.y = lerp(this.y, this.node().y, 0.5);
          this.stuckT = 0;
        }
      } else this.frame = 0;
      this.col.x = this.x;
      this.col.y = this.y - 2;
      this.col.off = !!this.colOff || !this.visible;
      this.ph.reindex?.(this.col);
    }
    nextNode(passing = false) {
      let ni = this.i + this.dirn;
      if (ni < 0 || ni >= this.route.length) {
        this.dirn *= -1;
        ni = this.i + this.dirn;
      }
      this.i = ni;
      this.state = TS.WALK;
      this.timer = 0;
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
      g.audio.play("tapir", { pan: g.panOf(this.x), vol: 1 });
      g.audio.play("rustle", { pan: g.panOf(this.x), vol: 1 });
      g.caption("A anta dispara pela trilha, quebrando galhos", g.panOf(this.x));
      this.ph.onTapirEvent?.("fuga");
    }
    // bloqueando a garganta?
    blocks(x0, y0, r) {
      return this.visible && this.state !== TS.FLEE && dist(this.x, this.y, x0, y0) < r;
    }
    draw(ctx) {
      if (!this.visible) return;
      const st = this.state;
      let k, gen;
      if (st === TS.SNIFF) {
        const f = Math.floor(this.g.time * 3) % 2;
        k = `tapS:${f}:${this.face < 0 ? 1 : 0}`;
        gen = () => {
          const c = tapirSniff(f);
          return this.face < 0 ? flipCanvas(c) : c;
        };
      } else {
        const head = st === TS.FEED ? this.head : "mid";
        k = `tapir:${this.frame}:${head}:${this.face < 0 ? 1 : 0}`;
        gen = () => {
          const c = tapirSprite(this.frame, head);
          return this.face < 0 ? flipCanvas(c) : c;
        };
      }
      const s = Sprites.get(k, gen);
      shadow(ctx, this.x, this.y + 1, 13, 3);
      ctx.drawImage(s, Math.round(this.x - 17), Math.round(this.y - 18));
      if (st === TS.ALERT) drawAwareIcon(ctx, this.x, this.y - 22, "!");
      else if (this.aware > 0.3 && st !== TS.FLEE) drawAwareIcon(ctx, this.x, this.y - 22, "?");
    }
  };
  var CS = { REST: "DESCANSAR", WALK: "CAMINHAR", GRAZE: "ALIMENTAR", ENTER: "ENTRAR_AGUA", SWIM: "NADAR", EXIT: "SAIR_AGUA", ALERT: "ALERTA", FLEE: "FUGIR" };
  var CAPY_K = { hearing: 0.6, sight: 92, smell: 70, smellW: 0.8 };
  var CapyGroup = class {
    // home: { x, y, rx, ry } (prainha onde o grupo vive); safe: ponto no meio do lago
    constructor(g, ph, home, safe) {
      this.g = g;
      this.ph = ph;
      this.home = home;
      this.safe = safe;
      this.members = [];
      this.mode = "calm";
      this.calmT = 0;
      this.alarmedAt = -99;
    }
    add(x, y, o = {}) {
      const c = new Capy(this.g, this, x, y, o);
      this.members.push(c);
      return c;
    }
    // um indivíduo avisa: os outros reagem com atraso (latido passado de um para o outro)
    alarm(src) {
      const g = this.g;
      if (this.mode !== "flee") {
        this.mode = "flee";
        this.alarmedAt = g.time;
        this.ph.onCapyAlarm?.(src);
      }
      this.calmT = 0;
      for (const m of this.members) {
        if (m === src || m.state === CS.FLEE || m.alarmAt) continue;
        const d = dist(m.x, m.y, src.x, src.y);
        m.alarmAt = g.time + 0.25 + d / 130 + Math.random() * 0.3;
      }
    }
    update(dt) {
      for (const m of this.members) m.update(dt);
      if (this.mode === "flee") {
        const quiet = this.members.every((m) => m.aware < 0.25);
        const inWater = this.members.every((m) => m.state === CS.FLEE ? m.sub > 0.6 : true);
        if (quiet && inWater) this.calmT += dt;
        else this.calmT = 0;
        if (this.calmT > 16) {
          this.mode = "calm";
          for (const m of this.members) if (m.state === CS.SWIM || m.state === CS.FLEE) {
            m.state = CS.EXIT;
            m.target = m.homeSpot();
          }
          this.ph.onCapyCalm?.();
        }
      }
    }
    calmNow() {
      return this.mode === "calm" && this.members.every((m) => m.state !== CS.FLEE && m.state !== CS.ALERT && m.aware < 0.45);
    }
  };
  var Capy = class {
    constructor(g, group, x, y, o = {}) {
      this.g = g;
      this.group = group;
      this.x = x;
      this.y = y;
      this.r = 3.5;
      this.juv = !!o.juv;
      this.state = o.state || CS.REST;
      this.timer = 3 + Math.random() * 10;
      this.face = Math.random() < 0.5 ? 1 : -1;
      this.frame = 0;
      this.anim = 0;
      this.aware = 0;
      this.sub = g.world.isWater(x, y) ? 1 : 0;
      this.target = null;
      this.alarmAt = 0;
      this.wakeT = 0;
      if (this.state === CS.SWIM) this.target = this.waterSpot(40);
    }
    water() {
      return this.g.world.isWater(this.x, this.y);
    }
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
        const x = (from === "safe" ? s.x : this.x) + Math.cos(a) * d, y = (from === "safe" ? s.y : this.y) + Math.sin(a) * d * 0.7;
        if (w.isWater(x, y) && w.isWater(x + 8, y) && w.isWater(x - 8, y)) return { x, y };
      }
      return { x: s.x, y: s.y };
    }
    update(dt) {
      const g = this.g, p = g.player, G = this.group;
      if (!p) return;
      this.timer -= dt;
      const sn = sense(g, this, CAPY_K, null);
      const inW = this.sub > 0.6;
      const k = inW ? 0.45 : this.state === CS.REST ? 0.7 : 1;
      if (sn.s > 0 && this.state !== CS.FLEE) this.aware = Math.min(1.3, this.aware + sn.s * dt * k);
      else this.aware = Math.max(0, this.aware - dt * 0.3);
      if (this.alarmAt && g.time >= this.alarmAt) {
        this.alarmAt = 0;
        this.flee();
      }
      if (this.state !== CS.FLEE && this.state !== CS.ALERT && !inW) {
        if (this.aware >= 1) {
          this.flee();
          G.alarm(this);
        } else if (this.aware >= 0.45) {
          this.prevState = this.state;
          this.state = CS.ALERT;
          this.timer = 2.2;
          this.face = p.x > this.x ? 1 : -1;
        }
      } else if (inW && this.aware >= 1 && this.state !== CS.FLEE) {
        this.state = CS.SWIM;
        this.target = this.waterSpot(40, "safe");
        this.aware = 0.6;
      }
      let mx = 0, my = 0, sp = 0;
      const go = (t, speed) => {
        const dx = t.x - this.x, dy = t.y - this.y, d = Math.hypot(dx, dy);
        if (d < 3) return true;
        mx = dx / d;
        my = dy / d;
        sp = speed;
        return false;
      };
      switch (this.state) {
        case CS.REST:
          if (this.timer <= 0) {
            this.state = CS.GRAZE;
            this.timer = 6 + Math.random() * 8;
          }
          break;
        case CS.GRAZE:
          if (Math.random() < dt * 0.4) {
            this.target = { x: this.x + (Math.random() - 0.5) * 14, y: this.y + (Math.random() - 0.5) * 6 };
          }
          if (this.target && go(this.target, 5)) this.target = null;
          if (this.timer <= 0) {
            const r = Math.random();
            if (r < 0.22) {
              this.state = CS.ENTER;
              this.target = this.waterSpot(30);
            } else if (r < 0.6) {
              this.state = CS.WALK;
              this.target = this.homeSpot();
              this.timer = 10;
            } else {
              this.state = CS.REST;
              this.timer = 8 + Math.random() * 12;
            }
          }
          break;
        case CS.WALK:
          if (go(this.target, 11) || this.timer <= 0) {
            this.state = Math.random() < 0.5 ? CS.GRAZE : CS.REST;
            this.timer = 5 + Math.random() * 8;
          }
          break;
        case CS.ENTER:
          if (go(this.target, 9)) {
            this.state = CS.SWIM;
            this.timer = 10 + Math.random() * 12;
            this.target = this.waterSpot(40);
          }
          break;
        case CS.SWIM:
          if (go(this.target, 8)) this.target = this.waterSpot(36);
          if (this.timer <= 0 && G.mode === "calm") {
            this.state = CS.EXIT;
            this.target = this.homeSpot();
          }
          break;
        case CS.EXIT:
          if (go(this.target, 8)) {
            this.state = CS.REST;
            this.timer = 6 + Math.random() * 10;
          }
          break;
        case CS.ALERT:
          this.face = p.x > this.x ? 1 : -1;
          if (this.aware >= 1) {
            this.flee();
            G.alarm(this);
            break;
          }
          if (this.timer <= 0 && this.aware < 0.4) {
            this.state = this.prevState === CS.ALERT ? CS.GRAZE : this.prevState || CS.GRAZE;
            this.timer = Math.max(this.timer, 3);
          }
          break;
        case CS.FLEE:
          if (!this.target) this.target = this.waterSpot(40, "safe");
          if (go(this.target, this.sub > 0.6 ? 16 : 34)) {
            this.state = CS.SWIM;
            this.timer = 30;
            this.target = this.waterSpot(30, "safe");
          }
          break;
      }
      if (sp) {
        const was = this.water();
        const moved = moveBody(g, this, mx, my, sp, dt, this.r, true);
        this.stuckT = moved < sp * dt * 0.25 ? (this.stuckT || 0) + dt : 0;
        if (this.stuckT > 1.2) {
          this.stuckT = 0;
          this.unstuck = (this.unstuck || 0) + 1;
          if (this.unstuck > 3 && this.target) {
            this.x = lerp(this.x, this.target.x, 0.35);
            this.y = lerp(this.y, this.target.y, 0.35);
            this.unstuck = 0;
          } else this.target = this.state === CS.FLEE || this.state === CS.ENTER || this.state === CS.SWIM ? this.waterSpot(40, "safe") : this.homeSpot();
        }
        if (Math.abs(mx) > 0.15) this.face = mx > 0 ? 1 : -1;
        this.anim += dt * (sp > 20 ? 9 : 4);
        this.frame = Math.floor(this.anim) % 2;
        const now = this.water();
        if (was !== now) {
          g.audio.play("splash", { pan: g.panOf(this.x), vol: 0.35 });
          for (let i = 0; i < 5; i++) g.particles.add({ type: "splash", x: this.x, y: this.y, vx: (Math.random() - 0.5) * 20, vy: -12 - Math.random() * 10, g: 60, life: 0.5 });
        }
        if (now) {
          this.wakeT -= dt;
          if (this.wakeT <= 0) {
            this.wakeT = 0.35;
            g.particles.add({ type: "ripple", x: this.x - mx * 6, y: this.y, life: 1.1, r1: 6, color: "#bcd2d6" });
          }
        }
      } else this.frame = 0;
      const tgt = this.water() ? 1 : 0;
      this.sub += (tgt - this.sub) * Math.min(1, dt * 2.6);
    }
    flee() {
      if (this.state === CS.FLEE) return;
      this.state = CS.FLEE;
      this.target = this.sub > 0.6 ? this.waterSpot(40, "safe") : this.nearestWater();
      this.g.audio.play("capivara", { pan: this.g.panOf(this.x), vol: 1.2 });
      this.g.audio.play("capivara", { pan: this.g.panOf(this.x), vol: 0.9, t: 0.15 });
    }
    nearestWater() {
      const w = this.g.world;
      let best = null, bd = 1e9;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) for (let r = 12; r <= 90; r += 12) {
        const x = this.x + Math.cos(a) * r, y = this.y + Math.sin(a) * r * 0.8;
        if (w.isWater(x, y) && w.isWater(x + 10 * Math.cos(a), y + 10 * Math.sin(a))) {
          if (r < bd) {
            bd = r;
            best = { x: x + Math.cos(a) * 14, y: y + Math.sin(a) * 10 };
          }
          break;
        }
      }
      return best || this.waterSpot(40, "safe");
    }
    draw(ctx) {
      const st = this.state;
      const pose = st === CS.REST ? "rest" : st === CS.GRAZE ? "graze" : st === CS.ALERT ? "alert" : "walk";
      const fl = this.face < 0 ? 1 : 0, f = this.frame;
      const s = Sprites.get(`capy:${pose}:${f}:${fl}`, () => {
        const c = capySprite(f, pose);
        return fl ? flipCanvas(c) : c;
      });
      const sc = this.juv ? 0.72 : 1;
      const w = Math.round(28 * sc), h = Math.round(17 * sc);
      const vis = Math.round(h * (1 - 0.56 * this.sub));
      const bob = this.sub > 0.5 ? Math.round(Math.sin(this.g.time * 2 + this.x) * 0.6) : 0;
      if (this.sub < 0.5) shadow(ctx, this.x, this.y + 1, 10 * sc, 2.5 * sc);
      ctx.drawImage(s, 0, 0, 28, Math.max(1, Math.round(17 * (1 - 0.56 * this.sub))), Math.round(this.x - w / 2), Math.round(this.y - h + 2 + (h - vis) + bob), w, vis);
      if (this.sub > 0.15) {
        ctx.globalAlpha = 0.5 * this.sub;
        ctx.strokeStyle = "#d0e0e4";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + 2 + bob, 9 * sc, 2.2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (st === CS.ALERT) drawAwareIcon(ctx, this.x, this.y - h - 1, "?");
      else if (st === CS.FLEE && this.sub < 0.5) drawAwareIcon(ctx, this.x, this.y - h - 1, "!");
    }
  };
  var PS3 = { HIDDEN: "ESCONDIDA", EMERGE: "SAINDO", FORAGE: "FORRAGEAR", WALK: "CAMINHAR", ALERT: "ALERTA", FLEE: "FUGIR", HIDE: "ESCONDER", DIVE: "MERGULHAR" };
  var PACA_K = { hearing: 1.25, sight: 44, smell: 80, smellW: 0.9 };
  var PacaV = class {
    constructor(g, ph, den, o = {}) {
      this.g = g;
      this.ph = ph;
      this.den = { ...den };
      this.x = den.x;
      this.y = den.y;
      this.r = 3;
      this.id = o.id || "paca";
      this.state = PS3.HIDDEN;
      this.visible = false;
      this.timer = 2 + Math.random() * 6;
      this.aware = 0;
      this.base = o.shade || 0;
      this.face = 1;
      this.frame = 0;
      this.anim = 0;
      this.target = null;
      this.outT = 0;
    }
    // a paca sai quando a mata escurece: entardecer, tempestade ou sombra fechada
    activity() {
      const g = this.g, shade2 = g.world.densityAt(this.den.x, this.den.y);
      return clamp(this.base + (g.darkness - 0.12) * 2.4 + shade2 * 0.45 + (this.ph.stormLevel?.() || 0) * 0.4, 0, 1);
    }
    update(dt) {
      const g = this.g, p = g.player;
      if (!p) return;
      this.timer -= dt;
      const sn = this.visible ? sense(g, this, PACA_K, this.ph.los ? (a, b, c, d) => this.ph.los(a, b, c, d) : null) : { s: 0, d: dist(this.x, this.y, p.x, p.y) };
      if (sn.s > 0) this.aware = Math.min(1.3, this.aware + sn.s * dt * 1.2);
      else this.aware = Math.max(0, this.aware - dt * 0.35);
      let mx = 0, my = 0, sp = 0;
      const go = (t, s) => {
        const dx = t.x - this.x, dy = t.y - this.y, d = Math.hypot(dx, dy);
        if (d < 2.5) return true;
        mx = dx / d;
        my = dy / d;
        sp = s;
        return false;
      };
      if (this.visible && [PS3.FORAGE, PS3.WALK, PS3.EMERGE].includes(this.state)) {
        if (this.aware >= 1) this.flee();
        else if (this.aware >= 0.4) {
          this.state = PS3.ALERT;
          this.timer = 0.9 + Math.random() * 0.8;
        }
      }
      switch (this.state) {
        case PS3.HIDDEN:
          if (this.timer <= 0) {
            this.timer = 5 + Math.random() * 7;
            const quiet = sn.d > 95 && p.noiseRadius() < sn.d;
            if (quiet && Math.random() < this.activity()) {
              this.visible = true;
              this.state = PS3.EMERGE;
              this.timer = 1.6;
              this.x = this.den.x;
              this.y = this.den.y;
              this.aware = 0;
              this.ph.onPacaEvent?.(this, "sai");
            }
          }
          break;
        case PS3.EMERGE:
          if (this.timer <= 0) {
            this.state = PS3.FORAGE;
            this.timer = 4 + Math.random() * 5;
            this.outT = 25 + Math.random() * 25;
          }
          break;
        case PS3.FORAGE:
          this.outT -= dt;
          if (this.timer <= 0) {
            const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 30;
            this.target = { x: this.den.x + Math.cos(a) * r, y: this.den.y + Math.sin(a) * r * 0.6 };
            this.state = PS3.WALK;
            this.timer = 6;
          }
          if (this.outT <= 0 || this.activity() < 0.15) {
            this.state = PS3.HIDE;
            this.target = this.den;
          }
          break;
        case PS3.WALK:
          this.outT -= dt;
          if (go(this.target, 13) || this.timer <= 0) {
            this.state = PS3.FORAGE;
            this.timer = 2.5 + Math.random() * 4;
          }
          break;
        case PS3.ALERT:
          if (this.aware >= 1) this.flee();
          else if (this.timer <= 0 && this.aware < 0.3) {
            this.state = PS3.FORAGE;
            this.timer = 2 + Math.random() * 3;
          }
          break;
        case PS3.FLEE:
          if (go(this.target, 60)) {
            if (this.target.water) {
              this.state = PS3.DIVE;
              this.visible = false;
              this.timer = 25 + Math.random() * 15;
              g.audio.play("splash", { pan: g.panOf(this.x), vol: 0.7 });
              for (let i = 0; i < 6; i++) g.particles.add({ type: "splash", x: this.x, y: this.y, vx: (Math.random() - 0.5) * 24, vy: -14, g: 60, life: 0.5 });
              g.particles.add({ type: "ripple", x: this.x, y: this.y, life: 1.4, r1: 10 });
            } else {
              this.state = PS3.HIDDEN;
              this.visible = false;
              this.timer = 25 + Math.random() * 15;
            }
            this.ph.onPacaEvent?.(this, "esconde");
          }
          break;
        case PS3.HIDE:
          if (go(this.target, 16)) {
            this.state = PS3.HIDDEN;
            this.visible = false;
            this.timer = 15 + Math.random() * 15;
          }
          break;
        case PS3.DIVE:
          if (this.timer <= 0) {
            this.state = PS3.HIDDEN;
            this.x = this.den.x;
            this.y = this.den.y;
            this.timer = 4;
          }
          break;
      }
      if (sp) {
        moveBody(g, this, mx, my, sp, dt, this.r, this.state === PS3.FLEE && this.target?.water);
        if (Math.abs(mx) > 0.1) this.face = mx > 0 ? 1 : -1;
        this.anim += dt * (sp > 30 ? 12 : 5);
        this.frame = Math.floor(this.anim) % 2;
      } else this.frame = this.state === PS3.FORAGE ? Math.floor(g.time * 2.5) % 2 : 0;
    }
    flee() {
      const g = this.g;
      const w = this.ph.nearWater?.(this.x, this.y, 60);
      const dd = dist(this.x, this.y, this.den.x, this.den.y);
      this.target = w && dist(this.x, this.y, w.x, w.y) < dd ? { ...w, water: true } : { ...this.den };
      this.state = PS3.FLEE;
      g.audio.play("rustle", { pan: g.panOf(this.x), vol: 0.5 });
      g.caption("Algo pequeno dispara entre as ra\xEDzes", g.panOf(this.x));
    }
    draw(ctx) {
      if (!this.visible) return;
      const fl = this.face < 0 ? 1 : 0, f = this.frame;
      const s = Sprites.get(`a:paca:${f}:${fl}:`, () => {
        const c = pacaSprite(f);
        return fl ? flipCanvas(c) : c;
      });
      const up = this.state === PS3.ALERT ? 1 : 0;
      shadow(ctx, this.x, this.y + 1, 7, 2);
      ctx.drawImage(s, Math.round(this.x - 11), Math.round(this.y - 12 - up));
      if (this.state === PS3.ALERT) drawAwareIcon(ctx, this.x, this.y - 15, "?");
    }
  };
  var Heron = class {
    constructor(g, ph, x, y) {
      this.g = g;
      this.ph = ph;
      this.x = x;
      this.y = y;
      this.home = { x, y };
      this.state = "perch";
      this.t = Math.random() * 9;
      this.vx = 0;
      this.vy = 0;
      this.z = 0;
      this.timer = 0;
      this.face = Math.random() < 0.5 ? 1 : -1;
    }
    update(dt) {
      const g = this.g, p = g.player;
      this.t += dt;
      if (!p) return;
      if (this.state === "perch") {
        const d = dist(this.x, this.y, p.x, p.y);
        const fast = (this.ph.canoeSpeed?.() || 0) > 26 || p.running;
        if (d < 52 || d < 90 && fast || p.noiseRadius() > d * 1.2 && d < 140 || this.ph.silence?.()) this.fly();
      } else if (this.state === "fly") {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.z = Math.min(60, this.z + 22 * dt);
        this.timer -= dt;
        if (this.timer <= 0) {
          this.state = "away";
          this.timer = 25 + Math.random() * 20;
        }
      } else if (this.state === "away") {
        this.timer -= dt;
        if (this.timer <= 0 && !this.ph.silence?.() && dist(this.home.x, this.home.y, p.x, p.y) > 160) {
          this.state = "perch";
          this.x = this.home.x;
          this.y = this.home.y;
          this.z = 0;
        }
      }
    }
    fly() {
      const g = this.g, p = g.player;
      const a = Math.atan2(this.y - p.y, this.x - p.x) + (Math.random() - 0.5) * 0.8;
      this.vx = Math.cos(a) * 46;
      this.vy = Math.sin(a) * 30 - 8;
      this.face = this.vx > 0 ? 1 : -1;
      this.state = "fly";
      this.timer = 6;
      g.audio.play("flap", { pan: g.panOf(this.x), vol: 0.7 });
      this.ph.onBirdFly?.(this);
    }
    draw(ctx) {
      if (this.state === "away") return;
      const fl = this.face < 0 ? 1 : 0;
      if (this.state === "perch") {
        const f = Math.floor(this.t * 0.6) % 2;
        const s = Sprites.get(`heronP:${f}:${fl}`, () => {
          const c = heronPerched(f);
          return fl ? flipCanvas(c) : c;
        });
        ctx.drawImage(s, Math.round(this.x - 7), Math.round(this.y - 21));
      }
    }
    drawAir(ctx) {
      if (this.state !== "fly") return;
      const f = Math.floor(this.t * 6) % 2, fl = this.face < 0 ? 1 : 0;
      const s = Sprites.get(`heronF:${f}:${fl}`, () => {
        const c = heronFlying(f);
        return fl ? flipCanvas(c) : c;
      });
      ctx.drawImage(s, Math.round(this.x - 12), Math.round(this.y - 8 - this.z));
    }
  };

  // js/phases/phase3-data.js
  var phase3_data_exports = {};
  __export(phase3_data_exports, {
    ANTA_PRINTS: () => ANTA_PRINTS,
    AREAS: () => AREAS2,
    BARREIRO: () => BARREIRO,
    BEACH_D: () => BEACH_D,
    BOTTLENECK: () => BOTTLENECK,
    B_GATE: () => B_GATE,
    CANOE: () => CANOE,
    CAPY_HOME: () => CAPY_HOME,
    CAPY_SAFE: () => CAPY_SAFE,
    CHANNEL: () => CHANNEL,
    CLUES: () => CLUES2,
    CREEKS_A: () => CREEKS_A,
    CURRENT_ZONE: () => CURRENT_ZONE,
    DETOUR_GATE: () => DETOUR_GATE,
    DIRECTIONS: () => DIRECTIONS,
    DIR_RIGHT: () => DIR_RIGHT,
    DIR_SIGN: () => DIR_SIGN,
    FLOAT_GRASS: () => FLOAT_GRASS,
    GATE_TREES: () => GATE_TREES,
    HAIR_E: () => HAIR_E,
    HERONS: () => HERONS,
    IGAPO_TREES: () => IGAPO_TREES,
    JIRAU: () => JIRAU2,
    LAGOON: () => LAGOON,
    LAGOON_SNAGS: () => LAGOON_SNAGS,
    LAKE: () => LAKE,
    LAMA1: () => LAMA1,
    LOGS_ZONE: () => LOGS_ZONE,
    MARK_TREE: () => MARK_TREE,
    MIRANTE: () => MIRANTE2,
    MUD_A: () => MUD_A,
    OVR: () => OVR,
    PACA_DENS: () => PACA_DENS,
    PALMS: () => PALMS,
    PASSAGE: () => PASSAGE,
    PRINTS_E: () => PRINTS_E,
    ROCKS_D: () => ROCKS_D,
    S: () => S6,
    SAFE_BANK: () => SAFE_BANK,
    SHORE_PT: () => SHORE_PT,
    SIDE: () => SIDE,
    SIGNS_A: () => SIGNS_A,
    SILENCE: () => SILENCE,
    SPAWN: () => SPAWN,
    TAPIRI: () => TAPIRI,
    TH: () => TH4,
    TRAILS: () => TRAILS3,
    TURB: () => TURB,
    TW: () => TW4,
    px: () => px4
  });
  var TW4 = 160;
  var TH4 = 84;
  var S6 = 16;
  var px4 = (t) => t * S6;
  var TRAILS3 = [
    // Região A — a trilha encharcada (chega da Fase 2, pelo oeste)
    { id: "A", r: 1, band: 2.4, pts: [[3.5, 66], [6, 66], [10, 64.6], [15, 66], [20, 65], [25, 63], [30, 61.2], [35, 59.6], [40, 57], [44, 55]] },
    { id: "Apaca", r: 0.6, band: 0.9, pts: [[30, 61.2], [31.6, 64], [33.6, 66.6]] },
    // Região B — trilha da anta, garganta estreita e desvio pelo atoleiro
    { id: "B", r: 0.9, band: 1, pts: [[44, 55], [47, 52], [50, 49], [53, 47.2], [55.6, 46]] },
    { id: "Bneck", r: 0.5, band: 0, pts: [[55.6, 46], [57.6, 45.1], [59.8, 44.2]] },
    { id: "Bexit", r: 0.9, band: 1.1, pts: [[59.8, 44.2], [62.5, 42.8], [66, 41.5], [69, 41], [72, 42.4], [74.6, 44.4]] },
    { id: "Bbarreiro", r: 0.6, band: 0.6, pts: [[50, 49], [49.4, 46.6]] },
    { id: "Bpalms", r: 0.6, band: 0.6, pts: [[62.5, 42.8], [63.2, 40.4]] },
    { id: "Bmir", r: 0.5, band: 0.6, pts: [[51.2, 48.2], [52.6, 48.6]] },
    { id: "Bdetour", r: 0.7, band: 0.6, pts: [[50, 49], [51.6, 51], [55.5, 52.2], [59, 50.8], [61.4, 48.2], [62.6, 45.6], [62.5, 42.8]] },
    // Região C — caminho até o lago e o jirau de pesca abandonado
    { id: "Cjirau", r: 0.6, band: 0.8, pts: [[69, 41], [70.2, 38.6]] },
    // Região E — da margem até o tapiri
    { id: "E", r: 0.9, band: 1.4, pts: [[124.4, 66.6], [121, 68.6], [117.4, 70.4], [114, 72.4], [111, 74.2]] }
  ];
  var AREAS2 = [
    { id: "chegada", x: 5, y: 66, rx: 3.2, ry: 2.6, t: "clear" },
    { id: "pacaA", x: 33.8, y: 67.2, rx: 2.2, ry: 1.6, t: "floor" },
    { id: "barreiro", x: 49, y: 45.4, rx: 2.8, ry: 1.9, t: "mud" },
    { id: "palmas", x: 63.4, y: 39.6, rx: 2, ry: 1.4, t: "floor" },
    { id: "mirante", x: 52.8, y: 48.6, rx: 1.3, ry: 0.9, t: "floor" },
    { id: "jirau", x: 70.6, y: 37.4, rx: 2.3, ry: 1.5, t: "clear" },
    { id: "margemO", x: 74.4, y: 46.8, rx: 3.3, ry: 5, t: "grass" },
    { id: "cantoSO", x: 75.6, y: 52.8, rx: 3.4, ry: 2.6, t: "floor" },
    { id: "praiaS", x: 83, y: 55.6, rx: 8.6, ry: 2.6, t: "grass" },
    { id: "praiaD", x: 127.6, y: 25.9, rx: 1.8, ry: 1, t: "sand" },
    { id: "margemE", x: 121.4, y: 67.6, rx: 4.4, ry: 3, t: "floor" },
    { id: "beiraE", x: 124.6, y: 66.4, rx: 1.4, ry: 2.4, t: "mud" },
    { id: "tapiri", x: 109.5, y: 75, rx: 3.6, ry: 2.6, t: "clear" }
  ];
  var OVR = [
    { x: 75.3, y: 42.7, rx: 1.6, ry: 1.1, t: "mud" }
    // a canoa atolada na lama da margem
  ];
  var MUD_A = [
    { id: "lama1", x: 12.6, y: 64.9, rx: 1.8, ry: 1.1 },
    { id: "lama2", x: 23.2, y: 63.9, rx: 1.5, ry: 1 },
    { id: "atoleiro", x: 27.4, y: 62.4, rx: 1.4, ry: 1, deep: true },
    { id: "lama3", x: 36.6, y: 59.2, rx: 1.9, ry: 1.2 },
    { id: "lamaAnta", x: 41.2, y: 56.6, rx: 1.8, ry: 1.1 },
    { id: "atoleiroB", x: 57.4, y: 51.6, rx: 1.8, ry: 1, deep: true },
    { id: "lamaB2", x: 60.4, y: 50, rx: 1, ry: 1.2, deep: true }
  ];
  var CREEKS_A = [
    { w: 1.3, pts: [[17.4, 44], [18, 54], [17.6, 62], [17.4, 66], [18.6, 74], [18, 82]] },
    { w: 1.1, pts: [[31, 46], [32.2, 55], [32.6, 61.2], [32.4, 63.6], [31.6, 70], [33, 82]] }
  ];
  var LAKE = { x: 84, y: 47.5, rx: 10, ry: 6.4 };
  var LAGOON = { x: 133.5, y: 64.5, rx: 8.5, ry: 5.6 };
  var CHANNEL = [
    [90.5, 44.8, 3.6, 3],
    [95, 41.6, 3, 5],
    [98.5, 38, 2.8, 6],
    [102.5, 35, 2.8, 7],
    [106.5, 33, 2.6, 9],
    [111, 31.2, 2.6, 13],
    [115.5, 29.6, 2.6, 15],
    [120, 28.2, 2.5, 15],
    [124.5, 27.6, 2.6, 14],
    [128.5, 28.4, 2.4, 17],
    [132, 30.6, 2.3, 24],
    [135, 33.6, 2.2, 27],
    [137.8, 37, 2.1, 27],
    [140, 41, 2.2, 21],
    [141.6, 45, 2, 13],
    [142.4, 48.2, 1.9, 10],
    [141.8, 52, 2.3, 7],
    [140, 56, 2.6, 5],
    [138, 59.4, 3, 3],
    [136, 62, 3.4, 1]
  ];
  var SIDE = [
    [108.2, 32.6, 2.4, 3],
    [110.4, 28.8, 2.7, 3],
    [114, 26.2, 2.9, 3],
    [118.5, 25.2, 2.9, 3],
    [122.4, 25.7, 2.7, 4],
    [125, 27.3, 2.4, 6]
  ];
  var IGAPO_TREES = [[1, 0.2, 0.75, 3.5], [1, 0.75, -0.8, 3.5], [2, 0.35, 0.8, 4], [2, 0.85, -0.75, 3.5], [3, 0.4, 0.85, 4], [3, 0.9, -0.8, 3.5], [4, 0.5, 0.7, 3.5]];
  var ROCKS_D = [[9, 0.3, 0.72, 5], [10, 0.1, -0.72, 5], [10, 0.7, 0.7, 4.5], [11, 0.35, -0.7, 5], [11, 0.9, 0.68, 4.5], [12, 0.55, -0.68, 5], [13, 0.4, 0.75, 4.5]];
  var FLOAT_GRASS = [[100.8, 37.4, 1], [109.4, 30.6, 0.9], [96.2, 40.4, 0.8], [131.6, 64.4, 1.2]];
  var LAGOON_SNAGS = [[131, 62.2, 5], [136.4, 66.8, 5], [129, 65.8, 4], [134.4, 69, 4]];
  var BEACH_D = [127.6, 25.9];
  var GATE_TREES = [[141, 47.9], [143.9, 48.5]];
  var SPAWN = [5.2, 66];
  var SIGNS_A = [
    { id: "capivara", at: [21.8, 65.8], name: "Pegadas de capivara", text: "Quatro dedos na frente, tr\xEAs atr\xE1s, com membrana entre eles. Capivara. Um grupo inteiro desceu pra \xE1gua por aqui." },
    { id: "paca", at: [28.8, 60], name: "Ra\xEDzes ro\xEDdas", text: "Raiz ro\xEDda rente ao ch\xE3o, dente fino e afiado, e um buraco escondido entre as sapopemas. Toca de paca. Ela s\xF3 sai quando escurece." }
  ];
  var LAMA1 = [12.8, 64.6];
  var ANTA_PRINTS = [41.2, 56.4];
  var MIRANTE2 = [52.8, 48.6];
  var BOTTLENECK = [57.6, 45.1];
  var PALMS = [63.4, 39.6];
  var BARREIRO = [49, 45.4];
  var DETOUR_GATE = [51.4, 50.5];
  var B_GATE = [66.8, 41.4];
  var JIRAU2 = [70.6, 37.2];
  var SHORE_PT = [73.6, 47.6];
  var CANOE = { start: [76, 43.4], end: [78.8, 45.6] };
  var CAPY_HOME = [83, 55.4];
  var CAPY_SAFE = [85.6, 48.6];
  var HERONS = [[80.6, 42.6], [90.4, 53.4], [100.4, 35.8]];
  var PACA_DENS = [{ id: "A", at: [33.8, 67.4], shade: 0.42 }, { id: "C", at: [74.2, 52.8], shade: 0.3 }, { id: "E1", at: [119.2, 70.8], shade: 0.12 }, { id: "E2", at: [112.6, 73.8], shade: 0.12 }];
  var LOGS_ZONE = { a: [106.8, 33], b: [126.8, 28] };
  var CURRENT_ZONE = { a: [129.2, 28.8], b: [140.4, 41.6] };
  var PASSAGE = [142.4, 48.2];
  var SILENCE = [142, 50.8];
  var TURB = [135.6, 62.6];
  var SAFE_BANK = [124.8, 66.2];
  var MARK_TREE = [126.4, 62.8];
  var PRINTS_E = [122.4, 68.2];
  var HAIR_E = [118.6, 69.6];
  var DIR_SIGN = [115.4, 71.6];
  var TAPIRI = [109.4, 74.6];
  var CLUES2 = [
    { id: "c_cocos", at: [33, 65.8], name: "Coquinhos ro\xEDdos", text: "Uma pilha de coquinhos de tucum\xE3 ro\xEDdos, com furinhos certinhos. Paca come escondida e larga as cascas na porta da toca." },
    { id: "c_banho", at: [48.2, 44.6], name: "Lama\xE7al de banho", text: "O barro aqui est\xE1 alisado e cheio de marcas de corpo grande. \xC9 onde a anta rola pra se livrar dos carrapatos." },
    { id: "c_ossos", at: [74, 49.4], name: "Espinhas de peixe", text: "Espinhas de peixe e penas brancas embaixo do galho seco. Poleiro de gar\xE7a: ela pesca na beira e come aqui." },
    { id: "c_fezes", at: [79.4, 56.4], name: "Fezes de capivara", text: "Bolinhas ovais, verdes por dentro, um monte junto. O grupo de capivaras dorme na prainha e come o capim da beira." },
    { id: "c_jacare", at: [88.8, 55.6], name: "Rastro de jacar\xE9", text: "Um sulco arrastado pela areia, com patas dos dois lados, entrando na \xE1gua. Jacar\xE9. Melhor n\xE3o pisar no rabo de ningu\xE9m." },
    { id: "c_ariranha", at: [127.2, 25.4], name: "Escorregador de ariranha", text: "Barranco liso, escorregadio, com escamas no ch\xE3o. As ariranhas descem por aqui brincando, direto pra \xE1gua." }
  ];
  var DIRECTIONS = ["Para o sul, para a beira da lagoa", "Para o oeste, para o alto da mata", "Para o norte, de volta ao igarap\xE9"];
  var DIR_RIGHT = 1;

  // js/phases/phase3.js
  var { TW: TW5, TH: TH5, S: S7, px: px5 } = phase3_data_exports;
  var P2 = (a) => ({ x: px5(a[0]), y: px5(a[1]) });
  var inEll2 = (x, y, e, k = 1) => ((x - e.x) / (e.rx * k)) ** 2 + ((y - e.y) / (e.ry * k)) ** 2;
  var EQUIP3 = ["paneiro", "espingarda", "facao", "cantil", "lanterna", "marmita"];
  var isWaterT = (t) => t === T.RIVER || t === T.CREEK;
  function createPhase3(g) {
    return new Phase3(g);
  }
  var Phase3 = class {
    constructor(g) {
      this.g = g;
      this.id = 3;
      this.code = "FASE 3";
      this.title = "OS SEGREDOS DA V\xC1RZEA";
      this.displayTitle = "Os Segredos da V\xE1rzea";
      this.timeLimit = 40 * 60;
      this.todStart = 830;
      this.spawn = P2(SPAWN);
      this.menuPath = [P2([78, 50]), P2([96, 40])];
      this.trackDefs = TRACKS;
      this.covers = [];
      this.coverGrid = /* @__PURE__ */ new Map();
      this.prints = [];
      this.waves = [];
      this.boils = [];
      this.fish = [];
      this.timers = [];
      this.rain = 0;
      this.markA = 0;
      this.pois = [
        { name: "Trilha encharcada", ...P2([14, 65]) },
        { name: "Pegadas da anta", ...P2(ANTA_PRINTS) },
        { name: "Passagem da anta", ...P2(BOTTLENECK) },
        { name: "Barreiro", ...P2(BARREIRO) },
        { name: "Jirau abandonado", ...P2(JIRAU2) },
        { name: "Lago das capivaras", ...P2([84, 47.5]) },
        { name: "Canoa", ...P2(CANOE.start) },
        { name: "Igarap\xE9 dos reflexos", ...P2([112, 31]) },
        { name: "Igap\xF3", ...P2([116, 25]) },
        { name: "Prainha", ...P2(BEACH_D) },
        { name: "Correnteza", ...P2([135, 33]) },
        { name: "Passagem entre as \xE1rvores", ...P2(PASSAGE) },
        { name: "Margem do sil\xEAncio", ...P2([134, 64]) },
        { name: "Tapiri", ...P2(TAPIRI) }
      ];
      this.buildMissions();
    }
    // ================= missões =================
    buildMissions() {
      const g = this.g, f = () => g.flags, d = (id) => g.done.has(id);
      const n = (...ks) => ks.filter((k) => f()[k]).length;
      const cluesDone = () => CLUES2.filter((c) => f()[c.id]).length;
      const natDone = () => n("obs_anta", "obs_capi", "obs_paca");
      this.count = { cluesDone, natDone };
      const canoeP = () => this.canoe ? { x: this.canoe.x, y: this.canoe.y } : P2(CANOE.start);
      this.missions = [
        {
          id: "m1",
          title: "Entrar na v\xE1rzea",
          progress: () => `${n("m1_trail", "m1_mud", "m1_marks")}/3`,
          hint: () => !f().m1_trail ? "Siga a trilha que vem da Fase 2, para o leste, at\xE9 o primeiro igarap\xE9 raso." : !f().m1_mud ? "O ch\xE3o virou barro. Examine (E) o primeiro trecho de lama na trilha: repare no que o barro faz com a bota." : "Procure marcas recentes de bicho perto da trilha: pegadas na beira do igarap\xE9, ra\xEDzes ro\xEDdas. Elas brilham de leve quando voc\xEA chega perto.",
          target: () => !f().m1_trail ? P2([17.4, 65.6]) : !f().m1_mud ? P2(LAMA1) : this.nearest(SIGNS_A.map((s) => s.at))
        },
        {
          id: "m2",
          title: "Encontrar a anta",
          progress: () => `${n("m2_prints", "m2_follow", "m2_obs")}/3`,
          hint: () => !f().m2_prints ? "No fim da trilha encharcada h\xE1 uma pegada grande, de tr\xEAs dedos, no barro. Examine." : !f().m2_follow ? "Siga a trilha da anta para o nordeste. Ande agachado (C): anta enxerga mal, mas escuta e fareja muito bem." : "Observe a anta de longe (E, a mais de 3,5 metros), sem deixar o vento levar seu cheiro. Do monte de ra\xEDzes ao lado da trilha se v\xEA bem a passagem.",
          target: () => !f().m2_prints ? P2(ANTA_PRINTS) : !f().m2_follow ? P2([50, 49]) : P2(MIRANTE2)
        },
        {
          id: "m3",
          title: "Atravessar a passagem bloqueada",
          hint: () => "A anta come justo na garganta estreita da trilha e o corpo dela fecha a passagem. Voc\xEA pode esperar ela se afastar (ela segue para as palmeiras e volta de tempos em tempos) ou abrir caminho pelo aningal ao sul e atravessar o atoleiro. Assustar a anta tamb\xE9m abre caminho, mas ela pode passar por cima de voc\xEA.",
          target: () => P2(B_GATE)
        },
        {
          id: "m4",
          title: "Investigar o lago",
          progress: () => `${n("m4_group", "m4_shore", "m4_canoe")}/3`,
          hint: () => !f().m4_shore ? "Siga para o leste at\xE9 a beira do lago. Na prainha ao sul vive um grupo de capivaras: chegue devagar." : !f().m4_group ? "Procure o grupo de capivaras na prainha ao sul do lago." : "Tem alguma coisa presa na lama da margem oeste, ao norte. Examine.",
          target: () => !f().m4_shore ? P2(SHORE_PT) : !f().m4_group ? P2([81, 54.6]) : P2(CANOE.start)
        },
        {
          id: "m5",
          title: "Recuperar a canoa",
          progress: () => `${n("paddle", "vines", "branch", "launched")}/4`,
          hint: () => this.canoeHint(),
          target: () => !f().paddle ? P2(JIRAU2) : !f().vines || !f().branch ? canoeP() : !f().launched ? this.pushTarget() : canoeP()
        },
        {
          id: "m6",
          title: "Atravessar o igarap\xE9",
          progress: () => `${n("m6_learn", "m6_logs", "m6_current")}/3`,
          hint: () => !f().m6_learn ? "<kbd>W</kbd> rema para a frente, <kbd>S</kbd> freia ou rema de r\xE9, <kbd>A</kbd>/<kbd>D</kbd> viram. A canoa demora a ganhar e a perder velocidade: antecipe as curvas." : !f().m6_logs ? "Troncos descem o igarap\xE9 com a correnteza. Desvie deles. O bra\xE7o alagado ao norte (igap\xF3) \xE9 mais calmo, mas tem \xE1rvores dentro d'\xE1gua." : !f().m6_current ? "A correnteza fica forte entre as pedras. Rema pela parte de dentro das curvas, onde a \xE1gua corre menos, e n\xE3o force contra as pedras." : "Siga o igarap\xE9 at\xE9 a passagem estreita entre duas \xE1rvores enormes.",
          target: () => !f().m6_logs ? P2(LOGS_ZONE.b) : !f().m6_current ? P2(CURRENT_ZONE.b) : P2(PASSAGE)
        },
        {
          id: "m7",
          title: "Investigar a movimenta\xE7\xE3o na \xE1gua",
          progress: () => `${n("m7_waves", "m7_escape", "m7_mark")}/3`,
          hint: () => !f().m7_waves ? "Siga para a lagoa escura ao sul e fique atento \xE0 \xE1gua." : !f().m7_escape ? "Reduza a velocidade (S) na \xE1gua que ferve e depois leve a canoa at\xE9 a margem segura, a oeste da lagoa, antes que a turbul\xEAncia aumente. Evite os troncos." : "Examine a \xE1rvore meio submersa na beira da lagoa.",
          target: () => !f().m7_waves ? P2(TURB) : !f().m7_escape ? P2(SAFE_BANK) : P2(MARK_TREE)
        },
        {
          id: "m8",
          title: "Localizar o rastro do veado",
          progress: () => `${n("m8_land", "m8_prints", "m8_hair", "m8_dir")}/4`,
          hint: () => !f().m8_land ? "Desembarque na margem oeste da lagoa (E perto da terra)." : !f().m8_prints ? "Procure pegadas recentes do veado no barro da margem." : !f().m8_hair ? "Procure pelos vermelhos presos num arbusto, mais para dentro da mata." : "Examine os galhos quebrados mais adiante e descubra para onde o veado seguiu.",
          target: () => !f().m8_land ? P2(SAFE_BANK) : !f().m8_prints ? P2(PRINTS_E) : !f().m8_hair ? P2(HAIR_E) : P2(DIR_SIGN)
        },
        { id: "m9", title: "Alcan\xE7ar o abrigo", hint: "Siga o rastro at\xE9 o antigo tapiri, antes que a tempestade piore.", target: () => P2(TAPIRI) }
      ];
      this.secondary = [
        { id: "s_nat", title: "Naturalista da V\xE1rzea", progress: () => `${natDone()}/3`, hint: "Observe (E) uma anta, uma capivara e uma paca sem provoc\xE1-las. A paca \xE9 t\xEDmida e sai das tocas quando a mata escurece: procure ra\xEDzes perto da \xE1gua, em sil\xEAncio.", target: () => null },
        { id: "s_rem", title: "Remador Experiente", failed: () => !!this.rowFail && !g.done.has("s_rem"), hint: "Atravesse o trecho dos troncos (do lago at\xE9 depois do igap\xF3) sem bater em nada. Se bater, volte remando at\xE9 o come\xE7o do trecho para tentar de novo.", target: () => null },
        { id: "s_rastro", title: "Rastreador das Margens", progress: () => `${Math.min(4, cluesDone())}/4`, hint: "Bichos da v\xE1rzea deixam sinais nas margens: cascas ro\xEDdas, lama\xE7al de banho, espinhas de peixe, fezes, rastro arrastado, escorregador de barro. Encontre quatro.", target: () => null }
      ];
    }
    currentMission() {
      return this.missions.find((m) => !this.g.done.has(m.id)) || null;
    }
    todCap() {
      const n = this.missions.filter((m) => this.g.done.has(m.id)).length;
      return 842 + n * 24;
    }
    nearest(list) {
      const p = this.g.player;
      let best = null, bd = 1e9;
      for (const a of list) {
        const q = P2(a);
        const d = p ? dist(q.x, q.y, p.x, p.y) : 0;
        if (d < bd) {
          bd = d;
          best = q;
        }
      }
      return best;
    }
    canoeHint() {
      const f = this.g.flags;
      if (!f.paddle) return "Canoa sem remo n\xE3o anda. Procure no antigo jirau de pesca, na trilha ao norte do lago.";
      if (!f.vines) return "Cip\xF3s e ra\xEDzes de aninga prendem a canoa. Corte com o fac\xE3o (E perto da canoa).";
      if (!f.branch) return "Um galho grosso caiu por cima da canoa. Tire o galho (E).";
      if (!f.launched) return "Empurre a canoa para a \xE1gua: fique atr\xE1s dela (do lado da mata) e ande na dire\xE7\xE3o do lago.";
      return "A canoa est\xE1 boiando. Embarque com E.";
    }
    // ================= construção estática =================
    async buildStatic(progress) {
      const w = this.world = new World(TW5, TH5);
      await progress(0.06, "Molhando as trilhas\u2026");
      const cw = w.cw, ch = w.ch;
      const core = new Float32Array(cw * ch), band = new Float32Array(cw * ch);
      const nearT = new Float32Array(TW5 * TH5);
      for (const tr of TRAILS3) {
        for (let i = 0; i < tr.pts.length - 1; i++) {
          const [ax, ay] = tr.pts[i], [bx, by] = tr.pts[i + 1];
          const L = Math.hypot(bx - ax, by - ay), n = Math.ceil(L / 0.25);
          for (let k = 0; k <= n; k++) {
            const t = k / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
            const R = tr.r * 8, RB = (tr.r + tr.band) * 8;
            const c0x = Math.floor(x * 8 - RB), c1x = Math.ceil(x * 8 + RB), c0y = Math.floor(y * 8 - RB), c1y = Math.ceil(y * 8 + RB);
            for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
              if (cx < 0 || cy < 0 || cx >= cw || cy >= ch) continue;
              const dd = Math.hypot(cx + 0.5 - x * 8, cy + 0.5 - y * 8), i2 = cy * cw + cx;
              if (dd < R) {
                const v = 1 - dd / R;
                if (v > core[i2]) core[i2] = v;
              }
              if (dd < RB) {
                const v = 1 - dd / RB;
                if (v > band[i2]) band[i2] = v;
              }
            }
            const RT = tr.r + 1.2;
            for (let ty = Math.floor(y - RT); ty <= Math.ceil(y + RT); ty++) for (let tx = Math.floor(x - RT); tx <= Math.ceil(x + RT); tx++) {
              if (tx < 0 || ty < 0 || tx >= TW5 || ty >= TH5) continue;
              const dd = Math.hypot(tx + 0.5 - x, ty + 0.5 - y) / RT;
              if (dd < 1) nearT[ty * TW5 + tx] = Math.max(nearT[ty * TW5 + tx], 1 - dd);
            }
          }
        }
      }
      this.nearTrail = (tx, ty) => nearT[(ty | 0) * TW5 + (tx | 0)] || 0;
      this.main = new Poly(CHANNEL);
      this.side = new Poly(SIDE);
      const creeks = CREEKS_A.map((c) => new Poly(c.pts.map(([x, y]) => [x, y, c.w, 0])));
      await progress(0.14, "Enchendo o lago e os igarap\xE9s\u2026");
      const chanD = new Float32Array(cw * ch).fill(9), chanK = new Uint8Array(cw * ch);
      const markPoly = (Pl, kind) => {
        for (const q of Pl.seg) {
          const m = Math.max(q.a.w, q.b.w) * 0.5 + 12;
          const x0 = Math.floor((Math.min(q.a.x, q.b.x) - m) / 2), x1 = Math.ceil((Math.max(q.a.x, q.b.x) + m) / 2);
          const y0 = Math.floor((Math.min(q.a.y, q.b.y) - m) / 2), y1 = Math.ceil((Math.max(q.a.y, q.b.y) + m) / 2);
          for (let cy = Math.max(0, y0); cy <= Math.min(ch - 1, y1); cy++) for (let cx = Math.max(0, x0); cx <= Math.min(cw - 1, x1); cx++) {
            const x = cx * 2 + 1, y = cy * 2 + 1;
            const vx = x - q.a.x, vy = y - q.a.y, k = clamp((vx * q.tx + vy * q.ty) / q.L, 0, 1);
            const dd = Math.hypot(x - (q.a.x + (q.b.x - q.a.x) * k), y - (q.a.y + (q.b.y - q.a.y) * k));
            const hw = lerp(q.a.w, q.b.w, k) * 0.5;
            const r = dd / hw, i = cy * cw + cx;
            if (r < chanD[i]) {
              chanD[i] = r;
              chanK[i] = kind;
            }
          }
        }
      };
      markPoly(this.main, 1);
      markPoly(this.side, 2);
      for (const c of creeks) markPoly(c, 3);
      w.generate((tx, ty) => {
        const n = fbm(tx * 0.15, ty * 0.15, 3, 3), n2 = valueNoise(tx * 0.6, ty * 0.6, 8);
        const ci = Math.floor(ty * 8) * cw + Math.floor(tx * 8);
        for (const o of OVR) if (inEll2(tx, ty, o) < 1) return [o.t === "mud" ? T.MUD : T.FLOOR];
        const el = inEll2(tx, ty, LAKE) + (fbm(tx * 0.3, ty * 0.3, 19, 2) - 0.5) * 0.3;
        if (el < 1) return [T.RIVER, clamp((1 - el) * 1.5, 0, 1)];
        const eg = inEll2(tx, ty, LAGOON) + (fbm(tx * 0.3, ty * 0.3, 23, 2) - 0.5) * 0.25;
        if (eg < 1) return [T.CREEK, clamp((1 - eg) * 1.3 + 0.2, 0, 1)];
        const cr = chanD[ci] + (n2 - 0.5) * 0.12;
        if (chanK[ci] === 1 && cr < 1) return [T.RIVER, clamp(1 - cr, 0, 1)];
        if (chanK[ci] === 2 && cr < 1) return [T.CREEK, clamp(0.8 - cr * 0.6, 0, 1)];
        const walkBand = band[ci] > 0.02;
        if (chanK[ci] === 3 && cr < 1) return walkBand ? [T.SHALLOW] : [T.CREEK, clamp(0.7 - cr * 0.5, 0, 1)];
        const inArea = AREAS2.find((a) => inEll2(tx, ty, a) < 1 + (n - 0.5) * 0.3);
        if (!walkBand && !inArea) return [T.THICKET];
        for (const m of MUD_A) if (inEll2(tx, ty, m) < 1 + (n - 0.5) * 0.5) return [T.MUD];
        if (inArea && inArea.t === "mud") return [T.MUD];
        if (inArea && inArea.t === "sand") return [T.SAND];
        const tf = core[ci];
        if (tf > 0.45 + (n2 - 0.5) * 0.3) return [n > 0.62 ? T.MUD : T.DIRT];
        if (inArea && inArea.t === "grass") return [n > 0.45 ? T.GRASS : T.MUD];
        if (inArea && inArea.t === "clear") return [T.CLEAR];
        return [T.FLOOR];
      });
      w.waterTiles = new Uint8Array(TW5 * TH5);
      for (let ty = 0; ty < TH5; ty++) for (let tx = 0; tx < TW5; tx++) {
        const t = w.terrainAt(tx * 16 + 8, ty * 16 + 8);
        w.waterTiles[ty * TW5 + tx] = t === T.RIVER ? 1 : t === T.CREEK ? 2 : 0;
      }
      this.current = buildCurrent(w, [this.main, this.side]);
      this.buildNav();
      await progress(0.3, "Plantando a v\xE1rzea\u2026");
      this.placeVegetation();
      await progress(0.5, "Espalhando troncos e pedras\u2026");
      this.placeProps();
      await progress(0.66, "Marcando o barro\u2026");
      const gctx = w.renderGround();
      this.decorateGround(gctx);
      await progress(0.9, "Desenhando o mapa\u2026");
      w.buildDensityCanvas();
      w.buildMiniMap();
      Sprites.get("icon:remo", () => remoIcon());
      Sprites.get("icon:pelos", () => icon2("pelos"));
      await progress(0.98, "Quase l\xE1\u2026");
    }
    // pontos de recuperação da canoa (no meio da água, com o sentido da viagem)
    buildNav() {
      const out = [];
      const add = (x, y, a) => out.push({ x, y, a });
      const lake = [CANOE.end, [81.5, 47.2], [86, 46.4], [89.4, 45.2]].map(P2);
      for (let i = 0; i < lake.length - 1; i++) {
        const a = lake[i], b = lake[i + 1], an = Math.atan2(b.y - a.y, b.x - a.x);
        for (let t = 0; t < 1; t += 0.25) add(lerp(a.x, b.x, t), lerp(a.y, b.y, t), an);
      }
      for (const Pl of [this.main, this.side]) for (let s = 0; s <= Pl.len; s += 12) {
        const q = Pl.at(s);
        add(q.x, q.y, Math.atan2(q.ty, q.tx));
      }
      const lg = [[136, 62], [133, 63.6], [129.6, 64.8], [126.4, 65.8]].map(P2);
      for (let i = 0; i < lg.length - 1; i++) {
        const a = lg[i], b = lg[i + 1], an = Math.atan2(b.y - a.y, b.x - a.x);
        for (let t = 0; t < 1; t += 0.34) add(lerp(a.x, b.x, t), lerp(a.y, b.y, t), an);
      }
      this.nav = out;
    }
    addCover(x, y, r) {
      const c = { x, y, r };
      this.covers.push(c);
      const k = (x / 64 | 0) + "," + (y / 64 | 0);
      if (!this.coverGrid.has(k)) this.coverGrid.set(k, []);
      this.coverGrid.get(k).push(c);
    }
    isInCover(x, y) {
      const gx = x / 64 | 0, gy = y / 64 | 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const a = this.coverGrid.get(gx + i + "," + (gy + j));
        if (a) {
          for (const c of a) if ((x - c.x) ** 2 + ((y - c.y) * 1.4) ** 2 < c.r * c.r) return true;
        }
      }
      return false;
    }
    tree(x, y, size, seed, collide = true) {
      const w = this.world, v = seed % 6;
      let th, tw2, bt, cr, pal;
      if (size === "huge") {
        th = 46;
        tw2 = 12;
        bt = 10;
        cr = 46;
        pal = GREENS.deep;
      } else if (size === "big") {
        th = 36 + v % 3 * 4;
        tw2 = 9;
        bt = 7 + v % 2 * 2;
        cr = 36 + v % 3 * 4;
        pal = GREENS.deep;
      } else if (size === "mid") {
        th = 24 + v % 3 * 3;
        tw2 = 6;
        bt = v % 2 ? 3 : 0;
        cr = 22 + v % 3 * 3;
        pal = v % 2 ? GREENS.mid : GREENS.olive;
      } else {
        th = 15 + v % 2 * 3;
        tw2 = 4;
        bt = 0;
        cr = 13 + v % 2 * 2;
        pal = GREENS.light;
      }
      const trunk = Sprites.get(`tr:${size}:${v}`, () => trunkSprite(500 + v * 13 + size.length, th, tw2, bt, size === "small" ? ["#4a3a2a", "#5e4a36", "#76604a", "#8e785e"] : void 0));
      const crown = Sprites.get(`cr:${size}:${v}`, () => crownSprite(900 + v * 31 + size.length * 7, cr, pal));
      const d = w.addDrawable({ x, y, sprite: trunk, ax: trunk.width / 2, ay: trunk.height - 2, crown: { sprite: crown, dx: 0, dy: -th - cr * 0.3, r: cr, h: th }, kind: "tree", size });
      if (collide) w.addCollider({ x, y: y - 2, r: tw2 / 2 + (bt ? bt * 0.6 : 0) + 1, kind: "tree" });
      w.addDensity(x, y - th - cr * 0.3, cr * 1.05, size === "big" || size === "huge" ? 1 : 0.8);
      return d;
    }
    palm(x, y, kind, v, collide = true) {
      const w = this.world;
      const s = kind === "acai" ? Sprites.get("pa:acai:" + v % 5, () => acaiSprite(70 + v % 5)) : kind === "buriti" ? Sprites.get("pa:bur:" + v % 3, () => buritiSprite(80 + v % 3)) : Sprites.get("pa:emb:" + v % 4, () => embaubaSprite(90 + v % 4));
      w.addDrawable({ x, y, sprite: s, ax: s.width / 2, ay: s.height - 2, shadow: { rx: kind === "buriti" ? 14 : 10, ry: 4, dx: -8, len: 10 } });
      if (collide) w.addCollider({ x, y: y - 1, r: kind === "buriti" ? 3 : 2, kind: "tree" });
      w.addDensity(x, y - s.height * 0.75, kind === "buriti" ? 22 : 16, 0.35);
    }
    plant(x, y, kind, v, cover = true) {
      const w = this.world;
      let s;
      if (kind === "bush") s = Sprites.get("bu:" + v % 6, () => bushSprite(200 + v % 6, 7 + v % 3, v % 2 ? GREENS.mid : GREENS.light));
      else if (kind === "bigbush") s = Sprites.get("bb:" + v % 3, () => bushSprite(260 + v % 3, 11, GREENS.mid));
      else if (kind === "fern") s = Sprites.get("fe:" + v % 4, () => fernSprite(300 + v % 4));
      else if (kind === "heliconia") s = Sprites.get("he:" + v % 3, () => heliconiaSprite(400 + v % 3));
      else if (kind === "aninga" || kind === "canarana") {
        s = kind === "aninga" ? Sprites.get("an:" + v % 5, () => aningaSprite(700 + v % 5)) : Sprites.get("cn:" + v % 4, () => canaranaSprite(740 + v % 4));
        const sp = s, ph = (x * 0.13 + y * 0.07) % 6.28, X = Math.round(x - sp.width / 2), Y = Math.round(y - sp.height + 2), cut = Math.round(sp.height * 0.55);
        w.addDrawable({ x, y, kind, draw: (ctx, g) => {
          const off = Math.round(Math.sin(g.time * 1.4 + ph) * (0.6 + 0.5 * g.wind.a));
          ctx.drawImage(sp, 0, 0, sp.width, cut, X + off, Y, sp.width, cut);
          ctx.drawImage(sp, 0, cut, sp.width, sp.height - cut, X, Y + cut, sp.width, sp.height - cut);
        } });
        return s;
      }
      w.addDrawable({ x, y, sprite: s, ax: s.width / 2, ay: s.height - 2, kind });
      if (cover && kind === "bush") this.addCover(x, y - 4, 10 + v % 3);
      return s;
    }
    placeVegetation() {
      const w = this.world, rng = mulberry32(3033);
      const terr = (tx, ty) => w.terrainAt(tx * 16, ty * 16);
      const nearWater = (x, y, r = 1.6) => {
        for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r * 0.7, r * 0.7], [-r * 0.7, r * 0.7], [r * 0.7, -r * 0.7], [-r * 0.7, -r * 0.7]]) if (isWaterT(terr(x + dx, y + dy))) return true;
        return false;
      };
      const keepPts = [LAMA1, ANTA_PRINTS, MIRANTE2, BOTTLENECK, PALMS, BARREIRO, DETOUR_GATE, B_GATE, JIRAU2, SHORE_PT, CANOE.start, CANOE.end, MARK_TREE, PRINTS_E, HAIR_E, DIR_SIGN, TAPIRI, SAFE_BANK, ...SIGNS_A.map((s) => s.at), ...CLUES2.map((c) => c.at), ...PACA_DENS.map((p) => p.at), ...HERONS];
      const keep = (tx, ty, r = 0) => keepPts.some(([x, y]) => Math.hypot(tx - x, ty - y) < 2.4 + r);
      for (let ty = 2; ty < TH5 - 1; ty += 1.6) for (let tx = 1; tx < TW5 - 1; tx += 1.6) {
        const x = tx + rng() * 1.4, y = ty + rng() * 1.4;
        const t = terr(x, y);
        if (t === 255 || isWaterT(t) || t === T.SHALLOW) continue;
        if (t === T.THICKET) {
          let edge = false;
          for (const [dx, dy] of [[1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6], [2.6, 0], [-2.6, 0], [0, 2.6]]) {
            const t2 = terr(x + dx, y + dy);
            if (t2 !== T.THICKET && t2 !== 255) {
              edge = true;
              break;
            }
          }
          const r2 = rng(), wet = nearWater(x, y, 1.4);
          if (edge && keep(x, y, 2)) {
            if (rng() < 0.7) this.plant(px5(x), px5(y), rng() < 0.6 ? "bigbush" : "fern", rng() * 9 | 0, false);
            continue;
          }
          if (edge && wet) {
            const waterAbove = isWaterT(terr(x, y - 1.5)) || isWaterT(terr(x, y - 2.6)) || isWaterT(terr(x, y - 3.6));
            if (r2 < 0.22 && !waterAbove) this.tree(px5(x), px5(y), rng() < 0.4 ? "big" : "mid", rng() * 6 | 0, false);
            else if (r2 < 0.3 && waterAbove) this.tree(px5(x), px5(y), "small", rng() * 6 | 0, false);
            else if (r2 < 0.5 && !waterAbove) this.palm(px5(x), px5(y), rng() < 0.55 ? "buriti" : "acai", rng() * 9 | 0, false);
            if (rng() < 0.75) this.plant(px5(x + (rng() - 0.5)), px5(y + 0.3), rng() < 0.55 ? "aninga" : "canarana", rng() * 9 | 0, false);
            continue;
          }
          if (edge) {
            if (r2 < 0.34) this.tree(px5(x), px5(y), rng() < 0.4 ? "big" : "mid", rng() * 6 | 0, false);
            else if (r2 < 0.5) this.palm(px5(x), px5(y), rng() < 0.6 ? "acai" : "embauba", rng() * 9 | 0, false);
            else if (r2 < 0.62) this.tree(px5(x), px5(y), "small", rng() * 6 | 0, false);
            if (rng() < 0.85) this.plant(px5(x + (rng() - 0.5)), px5(y + 0.4), rng() < 0.6 ? "bigbush" : rng() < 0.5 ? "fern" : "heliconia", rng() * 9 | 0, false);
            if (rng() < 0.5) this.plant(px5(x + (rng() - 0.5) * 1.2), px5(y - 0.5), rng() < 0.7 ? "bush" : "fern", rng() * 9 | 0, false);
          } else if (r2 < 0.32) {
            if (!isWaterT(terr(x, y - 2.4)) && !isWaterT(terr(x, y - 3.6))) this.tree(px5(x), px5(y), rng() < 0.5 ? "big" : "mid", rng() * 6 | 0, false);
          } else if (r2 < 0.44 && !isWaterT(terr(x, y - 2.2))) this.palm(px5(x), px5(y), rng() < 0.5 ? "acai" : "buriti", rng() * 9 | 0, false);
          continue;
        }
        if (keep(x, y)) continue;
        const nt = this.nearTrail(x, y);
        if (nearWater(x, y, 1)) {
          if (rng() < 0.35) this.plant(px5(x), px5(y), rng() < 0.5 ? "canarana" : "aninga", rng() * 9 | 0);
          continue;
        }
        if (t === T.MUD) {
          if (nt < 0.1 && rng() < 0.15) this.palm(px5(x), px5(y), "buriti", rng() * 9 | 0);
          continue;
        }
        if (t === T.SAND || t === T.CLEAR) {
          if (rng() < 0.1) this.plant(px5(x), px5(y), "fern", rng() * 9 | 0);
          continue;
        }
        if (nt > 0.05) {
          if (nt < 0.4 && rng() < 0.3) this.plant(px5(x), px5(y), rng() < 0.4 ? "fern" : "bush", rng() * 9 | 0);
          continue;
        }
        const r = rng();
        if (r < 0.08) this.tree(px5(x), px5(y), "big", rng() * 6 | 0);
        else if (r < 0.26) this.tree(px5(x), px5(y), "mid", rng() * 6 | 0);
        else if (r < 0.36) this.palm(px5(x), px5(y), rng() < 0.6 ? "acai" : "buriti", rng() * 9 | 0);
        else this.plant(px5(x), px5(y), rng() < 0.5 ? "bush" : rng() < 0.6 ? "fern" : "heliconia", rng() * 9 | 0);
      }
      for (const [i, t, off, r] of IGAPO_TREES) {
        const q = this.side.segPoint(i, t, off);
        const d = this.tree(q.x, q.y, i % 2 ? "mid" : "big", i * 7 + t * 10 | 0, false);
        this.world.addCollider({ x: q.x, y: q.y - 2, r, kind: "tree" });
        d.inWater = true;
      }
      for (const [x, y] of GATE_TREES) {
        this.tree(px5(x), px5(y), "huge", 3, false);
        this.world.addCollider({ x: px5(x), y: px5(y) - 2, r: 7, kind: "tree" });
      }
      this.tree(px5(MIRANTE2[0]) - 14, px5(MIRANTE2[1]) - 6, "big", 2);
      for (const [x, y] of [[118, 66.4], [114.4, 70.2], [121.2, 71.4], [107, 73.6], [112, 77.4]]) this.tree(px5(x), px5(y), "big", (x | 0) % 6);
    }
    placeProps() {
      const w = this.world;
      const add = (x, y, s, o = {}) => w.addDrawable({ x, y, sprite: s, ax: o.ax ?? s.width / 2, ay: o.ay ?? s.height - 2, ...o });
      this.rocks = [];
      for (const [i, t, off, r] of ROCKS_D) {
        const q = this.main.segPoint(i, t, off);
        const s = Sprites.get("wrock:" + r, () => rockSprite(660 + r * 3, r));
        add(q.x, q.y + r * 0.4, s, { ay: s.height - 2 });
        w.addCollider({ x: q.x, y: q.y, r: r + 0.5, kind: "rock", noBoat: false });
        this.rocks.push({ x: q.x, y: q.y, r });
      }
      this.snags = [];
      for (const [x, y, r] of LAGOON_SNAGS) {
        const s = Sprites.get("snag:" + r, () => trunkSprite(820 + r, 16 + r, 5, 2, ["#2a2620", "#3a342c", "#4a443a", "#5a5448"]));
        add(px5(x), px5(y), s, { ay: s.height - 3 });
        w.addCollider({ x: px5(x), y: px5(y) - 1, r, kind: "snag" });
        this.snags.push({ x: px5(x), y: px5(y), r });
      }
      const mt = P2(MARK_TREE);
      this.markTreeSprite = Sprites.get("marktree", () => trunkSprite(870, 52, 11, 5, ["#2a2620", "#3a342c", "#4e463a", "#665c4c"]));
      add(mt.x, mt.y, this.markTreeSprite, { ay: this.markTreeSprite.height - 4 });
      w.addCollider({ x: mt.x, y: mt.y - 1, r: 8, kind: "snag" });
      for (const [x, y] of HERONS) {
        const s = Sprites.get("perch", () => logSprite(4400, 18, 2.5, false));
        add(px5(x) + 2, px5(y) + 2, s, { ay: 6 });
      }
      const jr = P2(JIRAU2);
      this.jirau = { x: jr.x, y: jr.y };
      w.addCollider({ x: jr.x - 16, y: jr.y - 6, w: 4, h: 5 });
      w.addCollider({ x: jr.x + 13, y: jr.y - 6, w: 4, h: 5 });
      const tp = P2(TAPIRI);
      this.tapiriSprite = Sprites.get("tapiri", () => tapiriSprite());
      add(tp.x, tp.y + 8, this.tapiriSprite, { ay: this.tapiriSprite.height - 2 });
      for (const dx of [-21, 21]) w.addCollider({ x: tp.x + dx, y: tp.y + 4, r: 2.5 });
      for (const [x, y] of [[62.4, 38.8], [64.6, 39], [63.6, 37.8]]) this.palm(px5(x), px5(y), "acai", x * 3 | 0, false);
      for (const [x, y] of [[51.6, 47.6], [53.8, 49.6], [45.6, 53.6], [77.4, 52.6], [80.2, 57.2], [73.4, 45.6], [120.6, 69.8]]) {
        this.plant(px5(x), px5(y), "bigbush", x * 3 | 0, false);
        this.addCover(px5(x), px5(y) - 3, 13);
      }
      for (const d of PACA_DENS) {
        const s = Sprites.get("root:26", () => rootSprite(26, 26));
        add(px5(d.at[0]), px5(d.at[1]) - 3, s, { ay: s.height - 2 });
      }
      this.floatGrass = FLOAT_GRASS.map(([x, y, r]) => ({ x: px5(x), y: px5(y), r: r * S7 }));
    }
    decorateGround(ctx) {
      const w = this.world, rng = mulberry32(6262);
      ctx.strokeStyle = "rgba(40,28,16,0.75)";
      ctx.lineWidth = 2;
      for (const d of w.drawables) {
        if (d.kind !== "tree" || d.size !== "big" && d.size !== "huge") continue;
        if (w.terrainAt(d.x, d.y) === T.THICKET && rng() < 0.6) continue;
        for (let k = 0; k < 5; k++) {
          const a = rng() * Math.PI * 2, L2 = 14 + rng() * 14;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y - 2);
          ctx.quadraticCurveTo(d.x + Math.cos(a) * L2 * 0.5 + (rng() - 0.5) * 6, d.y + Math.sin(a) * L2 * 0.25, d.x + Math.cos(a) * L2, d.y + Math.sin(a) * L2 * 0.45);
          ctx.stroke();
        }
      }
      for (let i = 0; i < 17e3; i++) {
        const x = rng() * w.W, y = rng() * w.H, t = w.terrainAt(x, y);
        if (t === T.FLOOR || t === T.CLEAR) {
          const r = rng();
          if (r < 0.45) {
            ctx.fillStyle = ["#7a5428", "#8e6a30", "#5e4420", "#9a7a3a", "#6a3a1e"][rng() * 5 | 0];
            ctx.fillRect(x | 0, y | 0, 2 + (rng() * 2 | 0), 1);
          } else if (r < 0.7) {
            ctx.fillStyle = "#3f6a2a";
            ctx.fillRect(x | 0, y | 0, 1, 2);
          } else if (r < 0.78) {
            ctx.fillStyle = "rgba(30,40,40,0.25)";
            ctx.fillRect(x | 0, y | 0, 3, 1);
          }
        } else if (t === T.THICKET) {
          ctx.fillStyle = rng() < 0.5 ? "#1e2e14" : "#2c3a1a";
          ctx.fillRect(x | 0, y | 0, 2, 2);
        } else if (t === T.GRASS) {
          ctx.fillStyle = rng() < 0.5 ? "#6a9a3a" : "#4e7a2a";
          ctx.fillRect(x | 0, y | 0, 1, 2);
          ctx.fillRect((x | 0) + 2, (y | 0) + 1, 1, 2);
        } else if (t === T.MUD) {
          const r = rng();
          if (r < 0.35) {
            ctx.fillStyle = "rgba(40,30,18,0.55)";
            ctx.fillRect(x | 0, y | 0, 3, 1);
          } else if (r < 0.45) {
            ctx.fillStyle = "rgba(150,140,110,0.35)";
            ctx.fillRect(x | 0, y | 0, 2, 1);
          }
        } else if (t === T.RIVER || t === T.CREEK) {
          if (rng() < 0.02 && this.current.at(x, y).x === 0 && !w.isWater(x + 18, y) !== !w.isWater(x - 18, y)) lilyCluster(ctx, x, y, i, 0.9);
        }
      }
      for (let y = 0; y < w.H; y += 2) for (let x = 0; x < w.W; x += 2) {
        const t = w.terrainAt(x, y);
        if (t === T.RIVER) {
          ctx.fillStyle = "rgba(46,62,52,0.42)";
          ctx.fillRect(x, y, 2, 2);
        } else if (t === T.CREEK) {
          ctx.fillStyle = "rgba(18,34,32,0.38)";
          ctx.fillRect(x, y, 2, 2);
        } else if (t === T.SHALLOW) {
          ctx.fillStyle = "rgba(60,80,76,0.25)";
          ctx.fillRect(x, y, 2, 2);
        }
      }
      for (let y = 0; y < w.H; y += 2) for (let x = 0; x < w.W; x += 2) {
        const t = w.terrainAt(x, y);
        if (!isWaterT(t) && t !== T.THICKET && isWaterT(w.terrainAt(x, y + 4))) {
          ctx.fillStyle = "rgba(60,44,26,0.7)";
          ctx.fillRect(x, y, 2, 2);
        }
        if (isWaterT(t) && !isWaterT(w.terrainAt(x, y - 3))) {
          ctx.fillStyle = "rgba(20,16,10,0.5)";
          ctx.fillRect(x, y, 2, 2);
        }
      }
      const draw = (kind, at, n = 1, sp = 10, a = 0.6) => {
        const s = Sprites.get("trk:" + kind, () => trackSprite(kind));
        ctx.globalAlpha = a;
        for (let i = 0; i < n; i++) ctx.drawImage(s, Math.round(px5(at[0]) - 14 + (i - (n - 1) / 2) * sp), Math.round(px5(at[1]) - 11 + i % 2 * 4));
        ctx.globalAlpha = 1;
      };
      draw("capivara", SIGNS_A[0].at, 3, 12);
      draw("anta", ANTA_PRINTS, 2, 16, 0.8);
      for (const pt of [[46, 53], [48.6, 50.4], [51.6, 48.3], [54.6, 46.6], [59, 44.6], [61.6, 43.2]]) draw("anta", pt, 1, 0, 0.45);
      draw("capivara", [80.6, 55.6], 2, 14, 0.5);
      draw("capivara", [86.4, 54.8], 2, 14, 0.5);
      draw("veado", PRINTS_E, 2, 14, 0.75);
      for (const pt of [[120.4, 68.8], [117.4, 70.8], [113.6, 72.6]]) draw("veado", pt, 1, 0, 0.55);
      ctx.fillStyle = "rgba(30,24,18,0.6)";
      ctx.beginPath();
      ctx.ellipse(px5(TAPIRI[0]) - 6, px5(TAPIRI[1]) + 6, 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // ================= estado dinâmico =================
    carryIn(data) {
      const c = data.carry || {};
      const items = new Map(c.inv?.items || []);
      for (const id of EQUIP3) if (!items.has(id)) items.set(id, 1);
      if (!items.has("fumo")) items.set("fumo", 1);
      for (const id of ["galhos", "tabua", "cipo", "vara"]) items.delete(id);
      return {
        done: [],
        flags: {},
        tracks: c.tracks || [],
        tod: this.todStart,
        inv: { items: [...items], found: c.inv?.found || c.found || [] },
        res: { water: c.res?.water ?? 2, food: Math.max(2, c.res?.food ?? 2), ammo: c.res?.ammo ?? 5 }
      };
    }
    setupDynamic(fromSave) {
      const g = this.g, w = this.world, f = g.flags;
      f.score = f.score || 0;
      f.journal = f.journal || [];
      this.timers = [];
      this.prints = [];
      this.fish = [];
      this.splashT = 0;
      this.fishT = 3;
      this.gateMsgT = 0;
      this.mudTipT = 0;
      this.ev = null;
      this.instab = 0;
      this.rowAttempt = false;
      this.rowFail = false;
      this.learnD = 0;
      this.learnTurn = 0;
      this.finished = false;
      this.rain = f.rainOn ? clamp(f.rainT / 160 + 0.15, 0, 1) : 0;
      this.thunderT = 8;
      this.lightT = 6;
      this.waves = [];
      this.shadows = [];
      this.bigShadow = null;
      this.boils = [];
      this.tapirRelease = f.tapirFree ? 0 : null;
      this.lastPos = null;
      this.landSpot = null;
      this.birdShadow = null;
      this.markA = f.m7_mark ? 1 : 0;
      g.lights = [];
      g.onAnimalEvent = (a, ev) => this.onAnimalEvent(a, ev);
      const self = this;
      const lm = P2(LAMA1);
      g.interactables.push({ x: lm.x, y: lm.y, r: 26, py: 12, label: "Examinar o trecho de lama", enabled: () => !f.m1_mud, action: () => this.examineMud() });
      for (const s of SIGNS_A) {
        const p = P2(s.at);
        g.interactables.push({ x: p.x, y: p.y, r: 24, py: 12, label: "Examinar as marcas", enabled: () => !f["sign_" + s.id], action: () => this.examineSign(s) });
      }
      const ap = P2(ANTA_PRINTS);
      g.interactables.push({ x: ap.x, y: ap.y, r: 26, py: 12, label: "Examinar a pegada grande", enabled: () => !f.m2_prints && g.done.has("m1"), action: () => this.examineTapirPrints() });
      for (const c of CLUES2) {
        const p = P2(c.at);
        g.interactables.push({ x: p.x, y: p.y, r: 22, py: 12, label: "Examinar", enabled: () => !f[c.id], action: () => this.examineClue(c) });
      }
      const R = mulberry32(fromSave ? 77 : 31);
      const route = [
        { ...P2(BARREIRO), feed: [35, 55] },
        { ...P2([50, 48.6]) },
        { ...P2([53, 47.2]) },
        { ...P2(BOTTLENECK), feed: [14, 22], hold: true },
        { ...P2([60.2, 44]) },
        { ...P2([62.6, 42.6]) },
        { ...P2([63.2, 40.2]), feed: [32, 48] }
      ];
      this.tapir = new TapirV(g, this, route, f.tapirFree ? 6 : 3, { rng: R });
      if (f.tapirFree) {
        this.tapir.dirn = -1;
      }
      g.entities.push(this.tapir);
      g.updaters.push(this.tapir);
      g.interactables.push({
        get x() {
          return self.tapir.x;
        },
        get y() {
          return self.tapir.y;
        },
        r: 230,
        py: 22,
        label: () => dist(self.tapir.x, self.tapir.y, g.player.x, g.player.y) < 56 ? "Perto demais: afaste-se" : "Observar a anta de longe",
        enabled: () => f.m2_prints && !f.m2_obs && self.tapir.visible && self.tapir.calm() && self.los(g.player.x, g.player.y - 8, self.tapir.x, self.tapir.y - 6),
        action: () => this.observeTapir()
      });
      const cg = this.capys = new CapyGroup(g, this, { x: px5(CAPY_HOME[0]), y: px5(CAPY_HOME[1]) - 2, rx: px5(5.6), ry: px5(1.2) }, P2(CAPY_SAFE));
      const spots = [[80, 55.6, CS.REST], [82.2, 56, CS.REST, true], [84.6, 55.2, CS.GRAZE], [86.6, 55.8, CS.GRAZE], [81.4, 54.8, CS.GRAZE, true], [85.4, 52.2, CS.SWIM], [83.4, 52, CS.SWIM]];
      for (const [x, y, st2, juv] of spots) cg.add(px5(x), px5(y), { state: st2, juv });
      g.updaters.push(cg);
      for (const m of cg.members) {
        g.entities.push(m);
        g.animals.push(m);
      }
      g.interactables.push({
        get x() {
          return self.capyCenter().x;
        },
        get y() {
          return self.capyCenter().y;
        },
        r: 260,
        py: 24,
        label: () => dist(self.capyCenter().x, self.capyCenter().y, g.player.x, g.player.y) < 64 ? "Perto demais: afaste-se" : "Observar as capivaras",
        enabled: () => !f.obs_capi && !this.boarded() && cg.calmNow() && f.m4_group,
        action: () => this.observeCapys()
      });
      this.pacas = PACA_DENS.map((d) => new PacaV(g, this, P2(d.at), { id: d.id, shade: d.shade }));
      for (const pc of this.pacas) {
        g.entities.push(pc);
        g.updaters.push(pc);
        g.interactables.push({ get x() {
          return pc.x;
        }, get y() {
          return pc.y;
        }, r: 170, py: 16, label: () => dist(pc.x, pc.y, g.player.x, g.player.y) < 30 ? "Perto demais" : "Observar a paca", enabled: () => !f.obs_paca && pc.visible && [PS3.FORAGE, PS3.WALK, PS3.EMERGE].includes(pc.state) && pc.aware < 0.5 && !this.boarded(), action: () => this.observePaca(pc) });
      }
      this.herons = HERONS.map(([x, y]) => new Heron(g, this, px5(x), px5(y)));
      for (const h of this.herons) {
        g.entities.push(h);
        g.updaters.push(h);
        g.airEntities.push(h);
      }
      const small = [];
      for (const [x, y] of [[9, 63.6], [26, 59.4], [46, 56.4]]) small.push(new Animal(g, "cotia", px5(x), px5(y)));
      for (const [x, y] of [[14, 68], [70, 39.4], [119.6, 66]]) for (let i = 0; i < 2; i++) small.push(new Animal(g, "jacu", px5(x) + i * 12, px5(y) + i * 5));
      for (const a of small) {
        g.animals.push(a);
        g.entities.push(a);
        g.updaters.push(a);
        g.airEntities.push(a);
      }
      const fo = new Flyovers(g);
      g.updaters.push(fo);
      g.airEntities.push(fo);
      for (const [x, y] of [[8, 64], [24, 60], [44, 52.6], [72, 41], [76.4, 50]]) {
        const b = new Butterfly(g, px5(x), px5(y));
        g.updaters.push(b);
        g.entities.push(b);
      }
      const dg = P2(DETOUR_GATE);
      this.detourCol = w.addCollider({ x: dg.x - 20, y: dg.y - 12, w: 40, h: 26, dyn: true, off: !!f.detourCut });
      g.entities.push({ x: dg.x, y: dg.y + 6, draw: (ctx, gg) => {
        if (f.detourCut) return;
        for (let i = 0; i < 6; i++) {
          const s = Sprites.get("an:" + i % 5, () => aningaSprite(700 + i % 5));
          ctx.drawImage(s, Math.round(dg.x - 22 + i * 7 + Math.sin(gg.time + i) * 0.5), Math.round(dg.y - 18 + i % 2 * 5));
        }
      } });
      g.interactables.push({ x: dg.x, y: dg.y + 4, r: 26, py: 22, label: () => g.done.has("m2") ? "Abrir caminho pelo aningal" : "Aningal fechado", enabled: () => !f.detourCut, action: () => this.cutDetour() });
      const bg = P2(B_GATE);
      w.blockers.push({ x: bg.x - 6, y: bg.y - 26, w: 10, h: 52, active: () => !g.done.has("m2") });
      const jr = this.jirau;
      g.entities.push({ x: jr.x, y: jr.y + 4, draw: (ctx) => {
        const s = Sprites.get("jirau:" + (f.paddle ? 0 : 1), () => jirauSprite(!f.paddle));
        ctx.drawImage(s, Math.round(jr.x - 20), Math.round(jr.y - 24));
      } });
      g.interactables.push({ x: jr.x, y: jr.y + 2, r: 26, py: 26, label: "Pegar o remo no jirau", enabled: () => !f.paddle, action: () => this.takePaddle() });
      const cs = P2(CANOE.start), ce = P2(CANOE.end);
      this.railA = cs;
      this.railB = ce;
      this.railLen = dist(cs.x, cs.y, ce.x, ce.y);
      const ang = Math.atan2(ce.y - cs.y, ce.x - cs.x);
      this.sLaunch = this.railLen;
      for (let s0 = 0; s0 <= this.railLen; s0 += 1) {
        const bx = cs.x + Math.cos(ang) * (s0 - 16), by = cs.y + Math.sin(ang) * (s0 - 16);
        if (w.isWater(bx, by) || w.hit(bx, by, 4)) {
          this.sLaunch = Math.max(8, s0 - 1);
          break;
        }
      }
      const st = f.canoe;
      this.canoe = new Canoe(g, this, st ? st.x : cs.x, st ? st.y : cs.y, st ? st.a : ang);
      if (f.launched) this.canoe.state = "float";
      else {
        const s0 = f.canoeS || 0;
        this.canoe.x = cs.x + Math.cos(ang) * s0;
        this.canoe.y = cs.y + Math.sin(ang) * s0;
      }
      this.canoeCol = w.addCollider({ x: this.canoe.x, y: this.canoe.y - 1, r: 9, dyn: true, off: !!f.launched, noBoat: true });
      g.entities.push(this.canoe);
      g.updaters.push({ update: (dt) => this.canoe.update(dt) });
      g.entities.push({ get x() {
        return self.canoe.x;
      }, get y() {
        return self.canoe.y + 3;
      }, draw: (ctx) => this.drawCanoeBinds(ctx) });
      g.interactables.push({ get x() {
        return self.canoe.x;
      }, get y() {
        return self.canoe.y;
      }, r: 32, py: 18, label: "Examinar a canoa abandonada", enabled: () => !f.m4_canoe && !f.launched, action: () => this.examineCanoe() });
      g.interactables.push({ get x() {
        return self.canoe.x;
      }, get y() {
        return self.canoe.y;
      }, r: 32, py: 18, label: "Cortar os cip\xF3s que prendem a canoa", enabled: () => f.m4_canoe && !f.vines, action: () => this.cutVines() });
      g.interactables.push({ get x() {
        return self.canoe.x + 6;
      }, get y() {
        return self.canoe.y - 2;
      }, r: 30, py: 22, label: "Tirar o galho de cima da canoa", enabled: () => f.m4_canoe && f.vines && !f.branch, action: () => this.removeBranch() });
      g.interactables.push({ get x() {
        return self.canoe.x;
      }, get y() {
        return self.canoe.y;
      }, r: 34, py: 18, label: "Embarcar na canoa", enabled: () => this.canoe.state === "float", action: () => this.embark() });
      g.interactables.push({ get x() {
        return self.landSpot ? self.landSpot.x : self.canoe.x;
      }, get y() {
        return self.landSpot ? self.landSpot.y : self.canoe.y;
      }, r: 60, py: 14, label: "Desembarcar", enabled: () => this.boarded() && !!this.landSpot && this.canoe.speed < 24 && !(this.ev && this.ev.stage !== "done"), action: () => this.disembark() });
      g.interactables.push({ get x() {
        return self.canoe.x;
      }, get y() {
        return self.canoe.y;
      }, r: 40, py: 20, label: "Desencalhar a canoa", enabled: () => this.boarded() && this.canoe.stuckT > 2.2, action: () => this.recoverCanoe() });
      this.drift = new DriftLogs(g, this, this.main, this.main.project(...Object.values(P2(LOGS_ZONE.a))).s, this.main.project(...Object.values(P2(LOGS_ZONE.b))).s + 30, 5);
      const mt = P2(MARK_TREE);
      g.interactables.push({ x: mt.x, y: mt.y, r: 48, py: 40, label: "Examinar a \xE1rvore meio submersa", enabled: () => f.m7_escape && !f.m7_mark, action: () => this.examineMark() });
      const pe = P2(PRINTS_E);
      g.interactables.push({ x: pe.x, y: pe.y, r: 24, py: 12, label: "Examinar as pegadas no barro", enabled: () => f.m8_land && !f.m8_prints, action: () => this.examinePrintsE() });
      const he = P2(HAIR_E);
      g.entities.push({ x: he.x, y: he.y, draw: (ctx) => {
        const s = Sprites.get("bu:1", () => bushSprite(201, 8, GREENS.light));
        ctx.drawImage(s, Math.round(he.x - s.width / 2), Math.round(he.y - s.height + 2));
        if (!f.m8_hair) {
          ctx.fillStyle = "#c8502a";
          for (const [dx, dy] of [[-3, -8], [-2, -9], [2, -6], [3, -7], [0, -10]]) ctx.fillRect(Math.round(he.x + dx), Math.round(he.y + dy), 1, 2);
        }
      } });
      g.interactables.push({ x: he.x, y: he.y, r: 22, py: 22, label: "Examinar os pelos presos no arbusto", enabled: () => f.m8_prints && !f.m8_hair, action: () => this.examineHairE() });
      const ds = P2(DIR_SIGN);
      g.entities.push({ x: ds.x, y: ds.y, draw: (ctx) => {
        const s = Sprites.get("twig:9", () => twigSprite(9));
        ctx.drawImage(s, Math.round(ds.x - 6), Math.round(ds.y - 4));
        ctx.drawImage(s, Math.round(ds.x - 1), Math.round(ds.y - 1));
      } });
      g.interactables.push({ x: ds.x, y: ds.y, r: 22, py: 14, label: "Examinar os galhos quebrados", enabled: () => f.m8_hair && !f.m8_dir, action: () => this.examineDirection() });
      this.setupTriggers();
      if (f.canoe && f.canoe.state === "boarded") this.board(true);
      else if (f.launched) this.canoe.unstick();
    }
    setupTriggers() {
      const g = this.g, f = g.flags;
      g.triggers.push({ x: px5(17.4), y: px5(65.6), r: 34, cond: () => !f.m1_trail, fn: () => {
        f.m1_trail = true;
        g.caption("\xC1gua rasa correndo por cima da trilha", 0);
        g.ui.toast("Igarap\xE9 raso: d\xE1 para atravessar a p\xE9, mas a \xE1gua segura o passo e espirra.", "tip", 4500);
        this.checkM1();
      } });
      g.triggers.push({ x: px5(50), y: px5(49), r: 44, cond: () => f.m2_prints && !f.m2_follow, fn: () => {
        f.m2_follow = true;
        g.caption("Um assobio fino, mais adiante na trilha", 0.6);
        g.audio.play("tapir", { pan: 0.6, vol: 0.6 });
        g.ui.toast("A trilha da anta segue para o nordeste. Do monte de ra\xEDzes \xE0 direita d\xE1 para ver a passagem.", "tip", 5e3);
      } });
      g.triggers.push({ x: px5(B_GATE[0]) - 40, y: px5(B_GATE[1]), r: 36, once: false, cond: () => !g.done.has("m2"), fn: () => {
        if (g.time < this.gateMsgT) return;
        this.gateMsgT = g.time + 7;
        g.ui.toast('Caetano: <i>"Antes de seguir pro lago, quero entender por onde anda essa anta."</i>', "tip", 4e3);
      } });
      g.triggers.push({ x: px5(B_GATE[0]), y: px5(B_GATE[1]), r: 30, cond: () => g.done.has("m2") && !g.done.has("m3"), fn: () => this.crossedB() });
      g.triggers.push({ x: px5(SHORE_PT[0]), y: px5(SHORE_PT[1]), r: 34, cond: () => !f.m4_shore && g.done.has("m3"), fn: () => {
        f.m4_shore = true;
        g.caption("\xC1gua parada, sapos, gar\xE7as na beira", 0.4);
        g.audio.setMood("calm");
        this.checkM4();
      } });
      g.triggers.push({ x: px5(LOGS_ZONE.a[0]), y: px5(LOGS_ZONE.a[1]), r: 46, once: false, cond: () => this.boarded() && !g.done.has("s_rem"), fn: () => {
        if (!this.rowAttempt || this.rowFail) {
          if (this.rowFail) g.ui.toast("Nova tentativa de <b>Remador Experiente</b>: atravesse os troncos sem bater.", "tip", 3e3);
          this.rowAttempt = true;
          this.rowFail = false;
        }
      } });
      g.triggers.push({ x: px5(LOGS_ZONE.b[0]), y: px5(23), w: px5(1.2), h: px5(9), once: false, cond: () => this.boarded() && (!f.m6_logs || this.rowAttempt && !g.done.has("s_rem")), fn: () => this.passLogs() });
      g.triggers.push({ x: px5(CURRENT_ZONE.b[0]), y: px5(CURRENT_ZONE.b[1]), r: 38, cond: () => this.boarded() && !f.m6_current, fn: () => {
        f.m6_current = true;
        f.m6_logs = true;
        g.ui.toast("Passou a correnteza. A \xE1gua acalma de novo.", "tip", 3500);
        g.checkpoint("Depois da correnteza");
        this.syncCanoe();
      } });
      g.triggers.push({ x: px5(CURRENT_ZONE.a[0]), y: px5(CURRENT_ZONE.a[1]), r: 36, cond: () => this.boarded() && !f.curTip, fn: () => {
        f.curTip = true;
        g.caption("A \xE1gua ronca entre as pedras", 0.5);
        g.ui.toast("<b>Correnteza</b> \xB7 Ela empurra a canoa para tr\xE1s e para fora das curvas. Reme firme pela parte de dentro e desvie das pedras. A seta no painel da canoa mostra para onde a \xE1gua corre.", "tip", 7500);
      } });
      g.triggers.push({ x: px5(PASSAGE[0]), y: px5(PASSAGE[1]), r: 26, cond: () => this.boarded() && !g.done.has("m6"), fn: () => this.reachPassage() });
      g.triggers.push({ x: px5(SILENCE[0]), y: px5(SILENCE[1]), r: 36, cond: () => this.boarded() && g.done.has("m6") && !f.m7_escape && !this.ev, fn: () => this.startSilence() });
      g.triggers.push({ x: px5(TAPIRI[0]), y: px5(TAPIRI[1]), r: 30, once: false, cond: () => !this.finished && !this.boarded(), fn: () => this.reachTapiri() });
      g.triggers.push({ x: px5(BEACH_D[0]), y: px5(BEACH_D[1]), r: 40, cond: () => !f.beachTip && this.boarded(), fn: () => {
        f.beachTip = true;
        g.ui.toast("Uma prainha na margem: d\xE1 para desembarcar (E) e descansar as pernas.", "tip", 4e3);
      } });
    }
    // ================= roteiro =================
    async intro() {
      const g = this.g;
      await g.ui.intro([
        '<span class="place">Beira da v\xE1rzea \xB7 in\xEDcio da tarde</span>Caetano deixou o segundo acampamento quando o sol j\xE1 passava do meio do c\xE9u. As pegadas do veado-vermelho seguiam para a \xE1gua.',
        "A floresta muda devagar. O ch\xE3o fica mole, pequenos igarap\xE9s cortam a trilha e as \xE1rvores crescem com os p\xE9s dentro d'\xE1gua.",
        "Por aqui andam antas, capivaras e pacas. E o rastro do veado parece continuar do outro lado de um igarap\xE9."
      ]);
      g.player.dir = "right";
      g.letterbox = 1;
      g.fade = 1;
      g.audio.setMood("calm");
      await g.run(async () => {
        g.camera.targetZoom = 1.2;
        await g.tween(g, "fade", 0, 2);
        g.ui.titleCard("FASE 3", "Os Segredos da V\xE1rzea", "Tarde \xB7 v\xE1rzea do igarap\xE9");
        await g.wait(3.4);
        await g.say("Caetano", "O ch\xE3o aqui \xE9 s\xF3 barro. Cada passo afunda a bota.", "caetano");
        g.audio.play("frogs", { vol: 0.8 });
        await g.wait(0.6);
        await g.say("Caetano", "Daqui pra frente \xE9 v\xE1rzea. Bicho de \xE1gua, bicho de beira... e o veado passou bem no meio disso tudo.", "caetano");
        g.camera.targetZoom = 1;
        await g.tween(g, "letterbox", 0, 0.8);
      });
      g.state = "play";
      g.stats.startedAt = g.timeLeft;
      g.ui.toast("<b>Dica</b> \xB7 Barro e \xE1gua rasa deixam Caetano mais lento e fazem barulho. A bota sai cheia de lama: o passo demora a voltar ao normal.", "tip", 6500);
      g.checkpoint("In\xEDcio da Fase 3");
    }
    addScore(n, label) {
      const f = this.g.flags;
      f.score = (f.score || 0) + n;
      if (label) this.g.ui.toast(`<b>+${n}</b> explora\xE7\xE3o \xB7 ${label}`, "discovery", 2600);
    }
    addJournal(title, text) {
      const f = this.g.flags;
      f.journal = f.journal || [];
      if (!f.journal.some((j) => j.title === title)) f.journal.push({ title, text });
    }
    journal() {
      return this.g.flags.journal || [];
    }
    panelRow() {
      return ["Explora\xE7\xE3o", `${this.g.flags.score || 0} pts`];
    }
    later(sec, fn) {
      this.timers.push({ t: this.g.time + sec, fn });
    }
    async look(text, zoom = 1.35) {
      const g = this.g;
      await g.run(async () => {
        g.player.forceCrouch = true;
        g.camera.targetZoom = zoom;
        await g.say("Caetano", text, "caetano");
        g.camera.targetZoom = 1;
        g.player.forceCrouch = false;
      });
    }
    // ---------- Missão 1 ----------
    async examineMud() {
      const g = this.g, f = g.flags;
      await g.run(async () => {
        g.player.forceCrouch = true;
        g.camera.targetZoom = 1.35;
        await g.say("Caetano", "Barro mole, de v\xE1rzea. Afunda at\xE9 o tornozelo e gruda na bota.", "caetano");
        await g.say("Caetano", 'Aqui n\xE3o d\xE1 pra correr: cada passo faz "chop" e o bicho escuta de longe.', "caetano");
        g.camera.targetZoom = 1;
        g.player.forceCrouch = false;
      });
      f.m1_mud = true;
      this.addScore(5, "lama da v\xE1rzea");
      this.addJournal("A v\xE1rzea", "O ch\xE3o da v\xE1rzea \xE9 barro mole. Segura o passo e faz barulho. A bota sai pesada de lama.");
      this.checkM1();
    }
    async examineSign(s) {
      const g = this.g, f = g.flags;
      await this.look(s.text);
      f["sign_" + s.id] = true;
      f.m1_marks = true;
      if (s.id === "capivara") g.tracksKnown.add("t_capivara");
      this.addScore(10, s.name);
      this.addJournal("Sinal: " + s.name, s.text);
      this.checkM1();
    }
    checkM1() {
      const g = this.g, f = g.flags;
      if (f.m1_trail && f.m1_mud && f.m1_marks && !g.done.has("m1")) {
        g.complete("m1");
        g.checkpoint("Trilha encharcada");
        g.ui.toast("Siga a trilha para o leste. No fim dela, procure sinais de bicho grande.", "tip", 5e3);
      }
    }
    // ---------- Missão 2 e 3: a anta ----------
    async examineTapirPrints() {
      const g = this.g, f = g.flags;
      await g.run(async () => {
        g.player.forceCrouch = true;
        g.camera.targetZoom = 1.4;
        await g.say("Caetano", "Tr\xEAs dedos largos, redondos, afundados no barro. Pegada de anta, e das grandes.", "caetano");
        await g.say("Caetano", "A \xE1gua ainda est\xE1 entrando na marca: passou faz pouco. Foi pela trilha estreita, pro nordeste.", "caetano");
        g.camera.targetZoom = 1;
        g.player.forceCrouch = false;
      });
      f.m2_prints = true;
      g.tracksKnown.add("t_anta");
      this.addScore(10, "pegada de anta");
      this.addJournal("Pegada de anta", "Tr\xEAs dedos largos e redondos, fundos no barro, ainda enchendo de \xE1gua. A anta seguiu pela trilha estreita para o nordeste.");
    }
    async observeTapir() {
      const g = this.g, f = g.flags, tp = this.tapir, p = g.player;
      const d = dist(tp.x, tp.y, p.x, p.y);
      if (d < 56) {
        g.ui.toast("Muito perto: a anta vai se assustar. Afaste-se e observe de longe.", "warn", 3e3);
        return;
      }
      if (tp.aware > 0.5) {
        g.ui.toast("A anta est\xE1 desconfiada, de tromba erguida. Fique quieto e espere ela se acalmar.", "tip", 3e3);
        return;
      }
      await g.run(async () => {
        g.camera.follow = null;
        g.camera.targetZoom = 1.35;
        await g.camera.panTo((tp.x + p.x) / 2, (tp.y + p.y) / 2 - 6, 1.1);
        await g.say("Caetano", "L\xE1 est\xE1 ela. Bicho enorme, comendo broto bem no meio da trilha.", "caetano");
        await g.say("Caetano", "Mexe a tromba pra todo lado: \xE9 com o nariz que ela enxerga. Se eu passar por ali agora, ela me sente.", "caetano");
        await g.say("Caetano", "Ou eu espero ela sair do caminho... ou dou a volta por outro lugar.", "caetano");
        await g.camera.panTo(p.x, p.y - 8, 0.9);
        g.camera.follow = p;
        g.camera.targetZoom = 1;
      });
      f.m2_obs = true;
      f.m2_follow = true;
      if (!f.obs_anta) {
        f.obs_anta = true;
        this.addScore(20, "anta observada");
        this.checkNat();
      }
      this.addJournal("A anta da garganta", "Uma anta comendo bem no meio da passagem estreita. O corpo dela fecha o caminho. Ela segue para as palmeiras e volta de tempos em tempos.");
      g.complete("m2");
      this.tapirRelease = g.time + 22 + Math.random() * 18;
      g.checkpoint("Trilha da anta");
      g.ui.toast("Espere a anta sair da passagem, ou abra caminho pelo <b>aningal</b> ao sul da trilha e atravesse o atoleiro.", "tip", 7e3);
    }
    holdTapir() {
      const g = this.g;
      return !g.done.has("m2") || this.tapirRelease !== null && g.time < this.tapirRelease;
    }
    async cutDetour() {
      const g = this.g, f = g.flags;
      if (!g.done.has("m2")) {
        g.ui.toast("Aningal fechado, alto e cheio de espinho. Sem motivo pra abrir picada aqui... por enquanto.", "tip", 3500);
        return;
      }
      await g.run(async () => {
        for (let i = 0; i < 4; i++) {
          g.audio.play("cut");
          await g.wait(0.32);
        }
        const dg = P2(DETOUR_GATE);
        for (let i = 0; i < 18; i++) g.particles.add({ type: "leaf", x: dg.x + (Math.random() - 0.5) * 34, y: dg.y, z: 8 + Math.random() * 10, vx: (Math.random() - 0.5) * 30, vy: 2, life: 2, seed: Math.random() * 9, color: i % 2 ? "#2d5220" : "#5a8a3a" });
        f.detourCut = true;
        this.detourCol.off = true;
        await g.say("Caetano", "Picada aberta. Do outro lado \xE9 atoleiro: vai ser devagar e barulhento, mas a anta fica longe.", "caetano");
      });
      g.player.makeNoise(0.9);
    }
    crossedB() {
      const g = this.g, f = g.flags;
      g.complete("m3");
      f.tapirFree = true;
      this.tapirRelease = 0;
      this.addJournal("A passagem da anta", f.detourCut ? "Dei a volta pelo aningal e pelo atoleiro. A anta ficou na trilha dela." : "Passei pela garganta estreita da trilha da anta.");
      g.checkpoint("Al\xE9m da passagem da anta");
      g.ui.toast("Siga para o leste at\xE9 o lago.", "tip", 4e3);
    }
    // ---------- Missão 4 e 5: lago e canoa ----------
    capyCenter() {
      const m = this.capys.members;
      let x = 0, y = 0;
      for (const c of m) {
        x += c.x;
        y += c.y;
      }
      return { x: x / m.length, y: y / m.length };
    }
    async observeCapys() {
      const g = this.g, f = g.flags, c = this.capyCenter(), p = g.player;
      if (dist(c.x, c.y, p.x, p.y) < 64) {
        g.ui.toast("Perto demais: as capivaras v\xE3o correr para a \xE1gua.", "warn", 3e3);
        return;
      }
      await g.run(async () => {
        g.camera.follow = null;
        g.camera.targetZoom = 1.3;
        await g.camera.panTo((c.x + p.x) / 2, (c.y + p.y) / 2 - 6, 1);
        await g.say("Caetano", "Capivara deitada na prainha, filhote no meio, e duas nadando com s\xF3 o focinho de fora.", "caetano");
        await g.say("Caetano", "Uma fica de olho enquanto as outras cochilam. Se ela latir, vai todo mundo pra \xE1gua.", "caetano");
        await g.camera.panTo(p.x, p.y - 8, 0.8);
        g.camera.follow = p;
        g.camera.targetZoom = 1;
      });
      f.obs_capi = true;
      this.addScore(20, "capivaras observadas");
      this.addJournal("As capivaras do lago", "Um grupo de sete capivaras vive na prainha ao sul do lago. Descansam, pastam o capim da beira e entram na \xE1gua para nadar. Quando uma se assusta, late, e o grupo todo mergulha.");
      this.checkNat();
    }
    async observePaca(pc) {
      const g = this.g, f = g.flags, p = g.player;
      if (dist(pc.x, pc.y, p.x, p.y) < 30) {
        g.ui.toast("Perto demais: a paca vai sumir na toca.", "warn", 2500);
        return;
      }
      await g.run(async () => {
        g.camera.targetZoom = 1.4;
        await g.say("Caetano", "Uma paca, saindo da toca entre as ra\xEDzes. Pelo pintado de branco, orelha atenta pra tudo.", "caetano");
        await g.say("Caetano", "S\xF3 sai quando escurece. Qualquer barulho e ela some de novo, ou pula na \xE1gua.", "caetano");
        g.camera.targetZoom = 1;
      });
      f.obs_paca = true;
      this.addScore(25, "paca observada");
      this.addJournal("A paca da toca", "Pacas vivem em tocas entre ra\xEDzes, perto da \xE1gua. Saem \xE0 tardinha e \xE0 noite, muito atentas: no menor ru\xEDdo, fogem para a toca ou mergulham.");
      this.checkNat();
    }
    checkNat() {
      const g = this.g;
      if (this.count.natDone() >= 3 && !g.done.has("s_nat")) {
        g.complete("s_nat");
        this.addScore(60, "Naturalista da V\xE1rzea");
        this.addJournal("Conquista: Naturalista da V\xE1rzea", "Anta, capivaras e paca observadas sem que nenhuma se assustasse.");
      }
    }
    checkM4() {
      const g = this.g, f = g.flags;
      if (f.m4_group && f.m4_shore && f.m4_canoe && !g.done.has("m4")) {
        g.complete("m4");
        g.checkpoint("Lago das capivaras");
      }
    }
    async examineCanoe() {
      const g = this.g, f = g.flags;
      await g.run(async () => {
        g.player.forceCrouch = true;
        g.camera.targetZoom = 1.4;
        await g.say("Caetano", "Uma canoa de ita\xFAba, meio enterrada no barro. Algu\xE9m largou ela aqui faz tempo.", "caetano");
        await g.say("Caetano", "O casco est\xE1 inteiro. Mas tem cip\xF3 e raiz de aninga amarrando tudo, e um galho pesado em cima.", "caetano");
        if (!f.paddle) await g.say("Caetano", "E canoa sem remo n\xE3o vai a lugar nenhum. Vi um jirau de pesca velho na trilha, pro norte.", "caetano");
        g.camera.targetZoom = 1;
        g.player.forceCrouch = false;
      });
      f.m4_canoe = true;
      f.m4_shore = true;
      this.addJournal("A canoa abandonada", "Uma canoa de ita\xFAba presa na lama da margem oeste do lago, amarrada por cip\xF3s e coberta por um galho.");
      this.checkM4();
    }
    async takePaddle() {
      const g = this.g, f = g.flags;
      await g.run(async () => {
        await g.say("Caetano", "Um remo de pau, esquecido no jirau. A p\xE1 est\xE1 gasta, mas serve.", "caetano");
      });
      f.paddle = true;
      g.give("remo");
    }
    async cutVines() {
      const g = this.g, f = g.flags;
      if (!g.inv.has("facao")) {
        g.ui.toast("Sem o fac\xE3o n\xE3o d\xE1 pra cortar esses cip\xF3s.", "tip");
        return;
      }
      await g.run(async () => {
        for (let i = 0; i < 4; i++) {
          g.audio.play("cut");
          await g.wait(0.3);
        }
        for (let i = 0; i < 14; i++) g.particles.add({ type: "leaf", x: this.canoe.x + (Math.random() - 0.5) * 30, y: this.canoe.y, z: 4 + Math.random() * 6, vx: (Math.random() - 0.5) * 30, vy: 2, life: 2, seed: Math.random() * 9, color: i % 2 ? "#4e4224" : "#4f7a32" });
        f.vines = true;
        await g.say("Caetano", "Pronto, os cip\xF3s soltaram.", "caetano");
      });
    }
    async removeBranch() {
      const g = this.g, f = g.flags;
      await g.run(async () => {
        g.audio.play("creak", { vol: 1 });
        await g.say("Caetano", "Galho pesado... Vai, no ombro...", "caetano");
        this.branchRoll = 0;
        await g.tween(this, "branchRoll", 1, 0.9);
        g.audio.play("thud", { vol: 0.8 });
        g.camera.shake(1.5, 0.3);
        for (let i = 0; i < 10; i++) g.particles.add({ type: "puff", x: this.canoe.x - 22 + Math.random() * 10, y: this.canoe.y + 2, vx: (Math.random() - 0.5) * 20, vy: -4, life: 0.8, color: "#7a6a4a" });
        f.branch = true;
        await g.say("Caetano", "Agora \xE9 empurrar ela pra \xE1gua. De tr\xE1s pra frente, devagar.", "caetano");
      });
      g.ui.toast("Fique atr\xE1s da canoa (do lado da mata) e ande na dire\xE7\xE3o do lago para empurrar.", "tip", 5e3);
    }
    pushTarget() {
      const c = this.canoe, a = Math.atan2(this.railB.y - this.railA.y, this.railB.x - this.railA.x);
      return { x: c.x - Math.cos(a) * 20, y: c.y - Math.sin(a) * 20 };
    }
    updatePush(dt) {
      const g = this.g, f = g.flags, p = g.player, c = this.canoe;
      if (f.launched || g.state !== "play") return;
      const a = Math.atan2(this.railB.y - this.railA.y, this.railB.x - this.railA.x), ux = Math.cos(a), uy = Math.sin(a);
      const back = { x: c.x - ux * 15, y: c.y - uy * 15 };
      if (dist(p.x, p.y, back.x, back.y) > 13) {
        this.pushT = 0;
        return;
      }
      const sp = Math.hypot(p.vx, p.vy);
      if (sp < 18) return;
      if ((p.vx * ux + p.vy * uy) / sp < 0.55) return;
      if (!f.vines || !f.branch) {
        if (g.time > (this.pushMsgT || 0)) {
          this.pushMsgT = g.time + 4;
          g.ui.toast(!f.vines ? "A canoa n\xE3o mexe: cip\xF3s e ra\xEDzes ainda prendem o casco." : "Com aquele galho em cima, n\xE3o tem for\xE7a que mova a canoa.", "tip", 3e3);
        }
        return;
      }
      const s0 = f.canoeS || 0, ns = Math.min(this.sLaunch, s0 + Math.min(sp, 54) * 0.5 * dt);
      f.canoeS = ns;
      c.x = this.railA.x + ux * ns;
      c.y = this.railA.y + uy * ns;
      c.sortY = c.y;
      this.canoeCol.x = c.x;
      this.canoeCol.y = c.y - 1;
      this.reindex(this.canoeCol);
      this.pushT = (this.pushT || 0) + dt;
      if (this.pushT > 0.5) {
        this.pushT = 0;
        g.audio.play("canoeScrape", { vol: 0.5 });
        g.particles.add({ type: "puff", x: c.x - ux * 10, y: c.y + 3, vx: 0, vy: -3, life: 0.6, color: "#6a5a3a" });
        p.makeNoise(0.4);
      }
      if (ns >= this.sLaunch - 0.5) {
        f.launched = true;
        c.state = "float";
        this.canoeCol.off = true;
        g.tween(c, "x", this.railB.x, 0.9);
        g.tween(c, "y", this.railB.y, 0.9).then(() => c.unstick());
        g.audio.play("splash", { vol: 1 });
        for (let i = 0; i < 12; i++) g.particles.add({ type: "splash", x: c.x + (Math.random() - 0.5) * 24, y: c.y, vx: (Math.random() - 0.5) * 30, vy: -16 - Math.random() * 12, g: 60, life: 0.6 });
        g.particles.add({ type: "ripple", x: c.x, y: c.y, life: 1.6, r1: 22 });
        g.ui.toast("A canoa desliza e boia! Embarque com <kbd>E</kbd>.", "tip", 5e3);
      }
    }
    drawCanoeBinds(ctx) {
      const f = this.g.flags, c = this.canoe;
      if (f.launched) return;
      if (!f.vines) {
        ctx.strokeStyle = "#4e4224";
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(c.x - 14 + i * 9, c.y - 5);
          ctx.quadraticCurveTo(c.x - 10 + i * 9, c.y + 2, c.x - 18 + i * 10, c.y + 8);
          ctx.stroke();
        }
        const s = Sprites.get("an:2", () => aningaSprite(702));
        ctx.drawImage(s, Math.round(c.x - 22), Math.round(c.y - 20));
      }
      if (!f.branch) {
        const s = Sprites.get("branch", () => branchSprite()), k = this.branchRoll || 0;
        ctx.save();
        ctx.translate(Math.round(c.x - 2 - k * 24), Math.round(c.y - 4 + k * 6));
        ctx.rotate(-0.25 + k * 0.6);
        ctx.drawImage(s, -20, -7);
        ctx.restore();
      }
    }
    // ---------- embarque / desembarque ----------
    boarded() {
      return this.canoe && this.canoe.state === "boarded";
    }
    canoeSpeed() {
      return this.boarded() ? this.canoe.speed : 0;
    }
    async embark() {
      const g = this.g, f = g.flags;
      if (!f.paddle) {
        g.ui.toast("Sem remo n\xE3o d\xE1: a canoa vai rodar \xE0 toa no lago. Procure um remo.", "tip", 3500);
        return;
      }
      this.board(false);
      if (!g.done.has("m4")) {
        f.m4_group = f.m4_shore = f.m4_canoe = true;
        this.checkM4();
      }
      if (!g.done.has("m5")) {
        g.complete("m5");
        this.addJournal("A canoa", "Remo do jirau, cip\xF3s cortados, galho tirado e um empurr\xE3o: a canoa velha boiou de novo.");
        this.syncCanoe();
        g.checkpoint("Canoa na \xE1gua");
        g.ui.toast("<b>Canoa</b> \xB7 <kbd>W</kbd> rema para a frente \xB7 <kbd>S</kbd> freia / r\xE9 \xB7 <kbd>A</kbd> <kbd>D</kbd> viram \xB7 <kbd>E</kbd> desembarca perto de uma margem.", "tip", 9e3);
        if (g.touch || g.input.lastDevice === "touch") g.ui.toast("No toque: aponte o joystick para onde quer ir; quanto mais longe do centro, mais forte a remada.", "tip", 8e3);
        setTimeout(() => this.boarded() && g.ui.toast("O igarap\xE9 sai do lago a nordeste. Aprenda a controlar a canoa no lago antes de seguir.", "tip", 6e3), 6e3);
      }
    }
    board(restoring) {
      const g = this.g, p = g.player, c = this.canoe;
      c.state = "boarded";
      this.canoeCol.off = true;
      g.entities = g.entities.filter((e) => e !== p);
      p.locked = true;
      p.x = c.x;
      p.y = c.y;
      p.vx = p.vy = 0;
      p.sneak = false;
      p.lantern = p.lantern && restoring;
      if (!c.free()) c.unstick();
      g.audio.play("splash", { vol: 0.4 });
      if (!restoring) g.audio.play("canoeHit", { vol: 0.4 });
    }
    findLandSpot() {
      const g = this.g, c = this.canoe, w = this.world, h = c.dir();
      let best = null, bd = 1e9;
      for (const sd of [-1, 1]) for (const al of [-10, 0, 10, 18]) for (let d = 10; d <= 34; d += 4) {
        const x = c.x + h.x * al - h.y * sd * d, y = c.y + h.y * al + h.x * sd * d;
        if (w.isWater(x, y) || w.hit(x, y, 4.5) || circleBlocked(w, x, y, 4.5)) continue;
        const dd = d + Math.abs(al) * 0.5;
        if (dd < bd) {
          bd = dd;
          best = { x, y };
        }
        break;
      }
      void g;
      return best;
    }
    disembark(spot = this.landSpot) {
      const g = this.g, p = g.player, c = this.canoe, f = g.flags;
      if (!spot) return;
      c.state = "float";
      c.vx = c.vy = 0;
      c.f = c.l = 0;
      p.locked = false;
      p.x = spot.x;
      p.y = spot.y;
      p.vx = p.vy = 0;
      if (!g.entities.includes(p)) g.entities.push(p);
      g.audio.play("splash", { vol: 0.5 });
      g.audio.play("step", { surface: "mud", vol: 1 });
      g.camera.follow = p;
      if (dist(c.x, c.y, px5(SAFE_BANK[0]), px5(SAFE_BANK[1])) < 110 && f.m7_escape && !f.m8_land) {
        f.m8_land = true;
        g.ui.toast("Em terra firme de novo. Procure o rastro do veado.", "tip", 4e3);
      }
    }
    recoverCanoe() {
      const g = this.g, c = this.canoe;
      let best = null, bd = 1e9;
      for (const q of this.nav) {
        const d = dist(q.x, q.y, c.x, c.y);
        if (d < bd && c.free(q.x, q.y, q.a)) {
          bd = d;
          best = q;
        }
      }
      if (!best) return;
      g.run(async () => {
        g.audio.play("paddle", { vol: 1 });
        g.audio.play("canoeScrape", { vol: 0.8 });
        await g.tween(g, "fade", 0.6, 0.25);
        c.x = best.x;
        c.y = best.y;
        c.a = best.a;
        c.vx = c.vy = 0;
        c.f = c.l = 0;
        c.stuckT = 0;
        g.player.x = c.x;
        g.player.y = c.y;
        await g.tween(g, "fade", 0, 0.3);
        g.caption("Caetano empurra com o remo e solta a canoa", 0);
      });
    }
    syncCanoe() {
      const c = this.canoe;
      if (c) this.g.flags.canoe = { x: c.x, y: c.y, a: c.a, state: c.state };
    }
    cp(label) {
      this.syncCanoe();
      this.g.checkpoint(label);
    }
    currentAt(x, y) {
      return this.current.at(x, y);
    }
    inFloatGrass(x, y) {
      return this.floatGrass.some((q) => dist(q.x, q.y, x, y) < q.r);
    }
    logHit(x, y, r) {
      const L = this.drift && this.drift.hit(x, y, r);
      if (L) this.drift.nudge(L, x, y);
      return L;
    }
    onCanoeHit(what, k) {
      const g = this.g;
      if (this.rowAttempt && !this.rowFail && !g.done.has("s_rem")) {
        this.rowFail = true;
        g.ui.toast("A canoa bateu: <b>Remador Experiente</b> falhou nesta tentativa.", "warn", 3500);
      }
      if (this.ev && this.ev.stage === "strike") {
        this.instab = Math.min(100, this.instab + (what === "bank" ? 3 : 8) + k * 8);
        if (k > 0.4) g.caption("A canoa bate e quase vira!", 0);
      }
      if (!g.flags.hitTip) {
        g.flags.hitTip = true;
        g.ui.toast("A canoa pesada n\xE3o para de uma vez: freie com <kbd>S</kbd> antes das curvas e dos obst\xE1culos.", "tip", 5e3);
      }
    }
    // ---------- Missão 6: igarapé ----------
    passLogs() {
      const g = this.g, f = g.flags;
      if (this.rowAttempt && !this.rowFail && !g.done.has("s_rem")) {
        g.complete("s_rem");
        this.addScore(60, "Remador Experiente");
        this.addJournal("Conquista: Remador Experiente", "Atravessei o trecho dos troncos sem encostar em nada.");
      }
      this.rowAttempt = false;
      if (!f.m6_logs) {
        f.m6_logs = true;
        f.m6_learn = true;
        g.ui.toast("Os troncos ficaram para tr\xE1s.", "tip", 3e3);
        this.cp("Trecho dos troncos");
      }
    }
    reachPassage() {
      const g = this.g, f = g.flags;
      f.m6_learn = f.m6_logs = f.m6_current = true;
      g.complete("m6");
      this.addJournal("O igarap\xE9 dos reflexos", "Remei contra a correnteza, desviei de troncos e pedras e passei entre duas suma\xFAmas enormes, com as ra\xEDzes dentro d'\xE1gua.");
      this.cp("Passagem entre as \xE1rvores");
      g.ui.toast("Depois das \xE1rvores, o igarap\xE9 desce para uma lagoa de \xE1gua escura.", "tip", 4500);
    }
    // ---------- Missão 7: a sombra nas águas ----------
    silence() {
      return !!(this.ev && this.ev.stage !== "done");
    }
    async startSilence() {
      const g = this.g, c = this.canoe;
      this.cp("Antes da margem do sil\xEAncio");
      this.ev = { stage: "silence", t: 0 };
      this.instab = 0;
      g.audio.setMood("mystery");
      g.audio.setDuck(0.35, 3);
      g.caption("A mata inteira se cala", 0);
      for (const h of this.herons) if (h.state === "perch") h.fly();
      const s0 = this.main.project(c.x, c.y).s;
      this.waves = [];
      for (let i = 0; i < 4; i++) this.waves.push({ s: s0 - 70 - i * 22, w: 1 - i * 0.15, t: 0 });
      this.thunderAt = g.time + 3;
      await g.wait(1.6);
      await g.run(async () => {
        g.letterbox = 0.6;
        const q = this.main.at(s0 - 60);
        g.camera.follow = null;
        await g.camera.panTo(lerp(c.x, q.x, 0.6), lerp(c.y, q.y, 0.6), 1.2);
        await g.say("Caetano", "Os sapos pararam. Os passarinhos tamb\xE9m...", "caetano");
        await g.camera.panTo(c.x, c.y - 8, 0.9);
        g.camera.follow = g.player;
        await g.tween(g, "letterbox", 0, 0.4);
      });
    }
    updateEvent(dt) {
      const g = this.g, f = g.flags, ev = this.ev, c = this.canoe, p = g.player;
      if (!ev || ev.stage === "done") return;
      ev.t += dt;
      for (const wv of this.waves) {
        wv.s += 86 * dt;
        wv.t += dt;
      }
      this.waves = this.waves.filter((wv) => wv.s < this.main.len + 60);
      if (ev.stage === "silence") {
        const cs = this.main.project(c.x, c.y).s;
        for (const wv of this.waves) if (!wv.hit && Math.abs(wv.s - cs) < 14) {
          wv.hit = true;
          const q = this.main.at(cs);
          c.vx -= q.tx * 22 * wv.w;
          c.vy -= q.ty * 22 * wv.w;
          c.rockV += 4 * wv.w;
          g.camera.shake(0.8, 0.2);
        }
        if (!f.m7_waves && this.waves.some((wv) => Math.abs(wv.s - cs) < 18)) {
          f.m7_waves = true;
          c.rockV += 5;
          g.audio.play("waves", { vol: 1 });
          g.ui.toast("Ondas grandes subindo o igarap\xE9... <b>contra a correnteza</b>.", "warn", 5e3);
          this.later(1.2, () => g.state === "play" && g.ui.toast('Caetano: <i>"\xC1gua n\xE3o corre pra cima sozinha. Tem coisa grande a\xED embaixo."</i>', "tip", 5e3));
        }
        if (f.m7_waves && ev.t > 4.5 && (dist(c.x, c.y, px5(TURB[0]), px5(TURB[1])) < 120 || ev.t > 30)) {
          ev.stage = "shadow";
          ev.t = 0;
          const h = c.dir();
          this.bigShadow = { x: c.x - h.y * 160, y: c.y + h.x * 160, vx: h.y * 52, vy: -h.x * 52, t: 0, len: 150, a: 0 };
          g.audio.setMood("dread");
          g.audio.play("deep", { vol: 0.9 });
          g.caption("Um ronco grave, vindo do fundo", 0);
          g.ui.alert("REDUZA A VELOCIDADE! A \xC1GUA FERVE \xC0 FRENTE", "alert", 6e3);
          g.ui.toast("Segure <kbd>S</kbd> para frear. Atravesse a \xE1gua revolta devagar.", "warn", 6e3);
          this.boils = [];
        }
      } else if (ev.stage === "shadow") {
        const tz = P2(TURB), dz = dist(c.x, c.y, tz.x, tz.y), inZ = dz < 40;
        c.turb = inZ ? 0.6 : 0.15;
        if (inZ) {
          const sp = c.speed;
          if (sp > 20) {
            this.instab = Math.min(75, this.instab + (sp - 20) * dt * 2.6);
            if (Math.random() < dt * 4) {
              c.rockV += (Math.random() - 0.5) * 6;
              g.camera.shake(1, 0.15);
            }
            if (!this.fastMsg) {
              this.fastMsg = true;
              g.caption("R\xE1pido demais! A canoa joga de um lado pro outro", 0);
            }
          }
          ev.inZ = true;
        }
        if (inZ) ev.zt = (ev.zt || 0) + dt;
        const past = dist(c.x, c.y, px5(SAFE_BANK[0]), px5(SAFE_BANK[1])) < dist(tz.x, tz.y, px5(SAFE_BANK[0]), px5(SAFE_BANK[1]));
        if (ev.t > 3 && (ev.inZ && !inZ || ev.zt > 5 || past && ev.t > 8 || ev.t > 26)) this.strike();
      }
      if ((ev.stage === "silence" || ev.stage === "shadow") && dist(c.x, c.y, px5(SAFE_BANK[0]), px5(SAFE_BANK[1])) < 70) {
        f.m7_waves = true;
        this.strike(true);
      }
      if (ev.stage === "strike") {
        c.turb = Math.min(1, 0.45 + ev.t * 0.025);
        this.instab = Math.min(100, this.instab + dt * (1.2 + ev.t * 0.05));
        if (Math.random() < dt * 0.8) {
          c.rockV += (Math.random() - 0.5) * 5;
          this.boil(c.x + (Math.random() - 0.5) * 80, c.y + (Math.random() - 0.5) * 50, 0.7);
        }
        if (ev.t > 2 && dist(c.x, c.y, px5(SAFE_BANK[0]), px5(SAFE_BANK[1])) < 40) this.escape();
        else if (this.instab >= 100) {
          ev.stage = "done";
          c.turb = 0;
          this.bigShadow = null;
          g.audio.play("bigsplash", { vol: 1 });
          g.fail("A canoa virou", "A \xE1gua revolta virou a canoa e Caetano mal conseguiu nadar at\xE9 a beira. Volte ao ponto seguro e tente de novo: freie na \xE1gua que ferve e n\xE3o bata nos troncos.");
        }
      }
      const bs = this.bigShadow;
      if (bs) {
        bs.t += dt;
        bs.x += bs.vx * dt;
        bs.y += bs.vy * dt;
        bs.a = Math.min(1, bs.t / 1.5) * (bs.t > 8 ? Math.max(0, 1 - (bs.t - 8) / 2) : 1);
        if (Math.random() < dt * 8) g.particles.add({ type: "ripple", x: bs.x + (Math.random() - 0.5) * 40, y: bs.y + (Math.random() - 0.5) * 20, life: 1.2, r1: 6, color: "#a8c0c4" });
        if (bs.t > 10) this.bigShadow = null;
      }
      for (const b of this.boils) b.t += dt;
      this.boils = this.boils.filter((b) => b.t < 2.5);
      if (ev.stage === "shadow" && Math.random() < dt * 6) {
        const tz = P2(TURB);
        this.boil(tz.x + (Math.random() - 0.5) * 70, tz.y + (Math.random() - 0.5) * 40, 1);
      }
      void p;
    }
    boil(x, y, k) {
      if (!this.world.isWater(x, y)) return;
      this.boils.push({ x, y, t: 0, k });
      if (Math.random() < 0.4) this.g.particles.add({ type: "splash", x, y, vx: (Math.random() - 0.5) * 10, vy: -8, g: 50, life: 0.4, color: "#c8dce0" });
    }
    strike(pushBack = false) {
      const g = this.g, c = this.canoe, ev = this.ev;
      ev.stage = "strike";
      ev.t = 0;
      {
        const bx = px5(SAFE_BANK[0]), by = px5(SAFE_BANK[1]), d = dist(c.x, c.y, bx, by) || 1, k = pushBack ? 60 : 38;
        c.vx = (c.x - bx) / d * k;
        c.vy = (c.y - by) / d * k;
      }
      const h = c.dir();
      const sx = c.x + h.x * 26 - h.y * 22, sy = c.y + h.y * 26 + h.x * 18;
      g.audio.play("bigsplash", { vol: 1.2 });
      g.audio.play("deep", { vol: 1 });
      g.camera.shake(4, 0.8);
      g.flash = 0.25;
      c.rockV += 12;
      this.instab = Math.max(this.instab, 18);
      for (let i = 0; i < 40; i++) g.particles.add({ type: "splash", x: sx + (Math.random() - 0.5) * 14, y: sy, vx: (Math.random() - 0.5) * 70, vy: -40 - Math.random() * 60, g: 120, life: 1.1, color: i % 3 ? "#e0eef2" : "#a8c4c8" });
      for (let i = 0; i < 4; i++) g.particles.add({ type: "ripple", x: sx, y: sy, life: 1.5 + i * 0.4, r1: 20 + i * 14, color: "#d0e2e6" });
      g.caption("Alguma coisa enorme bate na \xE1gua, do lado da canoa!", -0.3);
      g.ui.alert("A CANOA BALAN\xC7A! LEVE-A AT\xC9 A MARGEM SEGURA!", "run", 8e3);
      g.audio.setMood("chase");
      if (this.bigShadow) {
        this.bigShadow.vx *= -0.6;
        this.bigShadow.vy *= -0.6;
      }
    }
    async escape() {
      const g = this.g, f = g.flags, c = this.canoe, ev = this.ev;
      ev.stage = "done";
      c.turb = 0;
      f.m7_escape = true;
      g.ui.alert("A SALVO NA MARGEM!", "safe", 3500);
      g.audio.setMood("mystery");
      g.audio.setDuck(0.5, 2);
      const spot = this.findLandSpot() || P2(SAFE_BANK);
      this.disembark(spot);
      f.m8_land = true;
      this.cp("Margem do sil\xEAncio");
      await g.run(async () => {
        await g.say("Caetano", "Terra... Terra firme.", "caetano");
        await g.say("Caetano", "O que foi aquilo? A canoa quase virou... e n\xE3o tinha vento nenhum.", "caetano");
      });
      g.ui.toast("Examine a \xE1rvore meio submersa na beira da lagoa.", "tip", 4500);
    }
    async examineMark() {
      const g = this.g, f = g.flags, p = g.player;
      const mt = P2(MARK_TREE);
      await g.run(async () => {
        await g.tween(g, "letterbox", 1, 0.5);
        p.dir = "right";
        g.camera.follow = null;
        g.camera.targetZoom = 1.5;
        await g.camera.panTo(mt.x, mt.y - 24, 1.2);
        this.markA = 0;
        await g.tween(this, "markA", 1, 1);
        await g.say("Caetano", "A casca arrancada em volta do tronco, num risco largo, liso, dando a volta inteira...", "caetano");
        await g.say("Caetano", "Isso n\xE3o foi peixe... Nem tronco de rio.", "caetano");
        g.camera.targetZoom = 1.1;
        await g.camera.panTo(px5(LAGOON.x), px5(LAGOON.y), 2.4);
        this.bigShadow = { x: px5(LAGOON.x) - 60, y: px5(LAGOON.y) + 10, vx: 22, vy: -6, t: 0, len: 170, a: 0, fade: true };
        await g.wait(1.6);
        g.audio.play("deep", { vol: 0.8, far: true });
        g.caption("Um som grave ecoa ao longe, debaixo d'\xE1gua", 0.4);
        await g.wait(2.6);
        await g.camera.panTo(p.x, p.y - 8, 1.2);
        g.camera.follow = p;
        g.camera.targetZoom = 1;
        await g.tween(g, "letterbox", 0, 0.5);
      });
      this.bigShadow = null;
      f.m7_mark = true;
      this.addJournal("A sombra nas \xE1guas", "Na lagoa escura a mata se calou, ondas subiram o rio contra a correnteza, uma sombra comprida passou por baixo da canoa e algo enorme bateu na \xE1gua. Numa \xE1rvore meio submersa, um risco largo e liso dando a volta no tronco. N\xE3o foi peixe. Nem tronco de rio.");
      this.addScore(20, "a marca na \xE1rvore");
      g.complete("m7");
      f.rainOn = true;
      f.rainT = f.rainT || 0;
      g.audio.setMood("stealth");
      g.audio.setDuck(1, 3);
      this.cp("A marca na \xE1rvore");
      g.ui.toast("Come\xE7a a chover. Procure o rastro do veado na margem antes que a tempestade engrosse.", "tip", 5500);
    }
    // ---------- Missão 8 e 9 ----------
    async examinePrintsE() {
      const g = this.g, f = g.flags;
      await this.look("Pegada fina do veado, fresquinha. A chuva ainda nem apagou a borda.");
      f.m8_prints = true;
      this.addScore(10, "pegadas do veado");
      this.checkM8();
    }
    async examineHairE() {
      const g = this.g, f = g.flags;
      await this.look("Pelo vermelho preso no espinho, na altura do peito. \xC9 ele. Passou raspando, com pressa.");
      f.m8_hair = true;
      g.give("pelos", 1, true);
      this.addScore(10, "pelos do veado");
      this.checkM8();
    }
    async examineDirection() {
      const g = this.g, f = g.flags;
      let ok = false;
      await g.run(async () => {
        g.player.forceCrouch = true;
        g.camera.targetZoom = 1.35;
        await g.say("Caetano", "Galhinho quebrado, folha virada com o lado claro pra cima, e as pegadas mais fundas na ponta do casco...", "caetano");
        const i = await g.choice("Caetano", "Para onde o veado seguiu?", DIRECTIONS, "caetano");
        if (i === DIR_RIGHT) {
          ok = true;
          await g.say("Caetano", "Pro oeste, subindo pra terra mais alta. Fugindo da \xE1gua... e da chuva.", "caetano");
        } else await g.say("Caetano", "N\xE3o... a ponta do casco afunda pro lado que ele vai. E os galhos quebram na dire\xE7\xE3o do passo. Olha de novo.", "caetano");
        g.camera.targetZoom = 1;
        g.player.forceCrouch = false;
      });
      if (ok) {
        f.m8_dir = true;
        this.addScore(15, "dire\xE7\xE3o do rastro");
        this.checkM8();
      }
    }
    checkM8() {
      const g = this.g, f = g.flags;
      if (f.m8_land && f.m8_prints && f.m8_hair && f.m8_dir && !g.done.has("m8")) {
        g.complete("m8");
        this.addJournal("O rastro na chuva", "Pegadas frescas, pelos ruivos e galhos quebrados: o veado subiu para o oeste, para longe da \xE1gua.");
        this.cp("Rastro do veado");
        g.ui.toast("Siga para o oeste. Tem um tapiri velho na mata: um bom abrigo para a tempestade.", "tip", 5e3);
      }
    }
    reachTapiri() {
      const g = this.g;
      if (this.finished) return;
      if (!g.done.has("m8")) {
        if (g.time > this.gateMsgT) {
          this.gateMsgT = g.time + 6;
          g.ui.toast('Caetano: <i>"Um tapiri velho... Mas antes quero ter certeza do rastro."</i>', "tip", 3500);
        }
        return;
      }
      this.finished = true;
      this.finalScene();
    }
    async finalScene() {
      const g = this.g, p = g.player, tp = P2(TAPIRI);
      await g.run(async () => {
        g.audio.setMood("mystery");
        await g.tween(g, "letterbox", 1, 0.6);
        this.rainBoost = 1;
        g.audio.play("thunder", { vol: 1 });
        g.flash = 0.4;
        await g.moveTo(p, tp.x - 2, tp.y + 2, 34);
        p.dir = "down";
        await g.say("Caetano", "Bem na hora. A chuva desabou.", "caetano");
        p.forceCrouch = true;
        await g.say("Caetano", "Paneiro molhado por fora, seco por dentro. Cantil, marmita, os pelos do veado... tudo aqui.", "caetano");
        for (let i = 0; i < 2; i++) {
          p.lantern = true;
          g.audio.play("lantern");
          await g.wait(0.18);
          p.lantern = false;
          g.audio.play("click");
          await g.wait(0.5);
        }
        p.lantern = true;
        g.audio.play("lantern");
        await g.say("Caetano", "Pronto. Pelo menos uma luzinha.", "caetano");
        g.camera.follow = null;
        g.camera.targetZoom = 1.1;
        await g.camera.panTo(tp.x - 90, tp.y - 20, 2.2);
        await g.wait(1);
        g.audio.setDuck(0.25, 1.5);
        g.audio.play("whistle", { pan: -0.85, dur: 2.8, vol: 0.5 });
        g.caption("Um assobio longo atravessa a mata", -0.85);
        await g.wait(2.2);
        await g.camera.panTo(tp.x, tp.y - 10, 1);
        p.forceCrouch = false;
        p.dir = "left";
        await g.say("Caetano", "Quem t\xE1 a\xED?", "caetano");
        await g.wait(1.8);
        g.audio.play("whistle", { pan: -0.3, dur: 2.2, vol: 0.85 });
        g.caption("Outro assobio, desta vez mais perto", -0.3);
        await g.wait(1);
        g.camera.targetZoom = 1.7;
        await g.camera.panTo(tp.x - 30, tp.y - 6, 1.4);
        this.birdShadow = { x: tp.x - 70, y: tp.y - 18, t: 0 };
        g.audio.play("flap", { pan: -0.4, vol: 0.6 });
        await g.wait(1.4);
        await g.tween(g, "fade", 1, 1.6);
        g.ui.titleCard("FASE 3 CONCLU\xCDDA", "PR\xD3XIMA FASE: OS ASSOBIOS DE MATINTA", "", "small");
        await g.wait(3.6);
      });
      g.complete("m9");
      this.completePhase();
    }
    completePhase() {
      const g = this.g, f = g.flags;
      g.state = "results";
      const used = this.timeLimit - g.timeLeft;
      const carry = { inv: g.inv.toJSON(), res: { ...g.res }, tracks: [...g.tracksKnown], found: [...g.inv.found] };
      Save.write({ phase: 3, completed: true, done: [...g.done], flags: { score: f.score, journal: f.journal } });
      Save.completePhase(3, { time: used, score: f.score || 0, carry, secondary: this.secondary.filter((m) => g.done.has(m.id)).map((m) => m.id) });
      g.ui.results([
        ["Tempo da expedi\xE7\xE3o", formatTime(used)],
        ["Bichos observados", `${this.count.natDone()}/3`],
        ["Miss\xF5es secund\xE1rias", `${this.secondary.filter((m) => g.done.has(m.id)).length}/3`],
        ["Pistas das margens", `${this.count.cluesDone()}/${CLUES2.length}`],
        ["Pontos de explora\xE7\xE3o", `${f.score || 0}`]
      ], { code: "FASE 3 CONCLU\xCDDA", title: "Os Segredos da V\xE1rzea" });
    }
    onResume() {
    }
    onRestore() {
      const g = this.g;
      g.ui.clearAlert();
      g.audio.setMood("calm");
      g.audio.setDuck(1, 0.5);
    }
    // ---------- pistas opcionais ----------
    async examineClue(c) {
      const g = this.g, f = g.flags;
      await this.look(c.text, 1.3);
      f[c.id] = true;
      this.addScore(15, c.name.toLowerCase());
      this.addJournal("Pista: " + c.name, c.text);
      if (this.count.cluesDone() >= 4 && !g.done.has("s_rastro")) {
        g.complete("s_rastro");
        this.addScore(50, "Rastreador das Margens");
        this.addJournal("Conquista: Rastreador das Margens", "Quatro pistas de bichos da v\xE1rzea encontradas nas margens.");
      }
    }
    // ---------- reações da fauna ----------
    onTapirEvent(kind) {
      const g = this.g;
      if (kind === "fuga" && !g.done.has("m2")) g.ui.toast("A anta se assustou e sumiu na mata. Ela volta depois de um tempo, se voc\xEA se afastar e ficar quieto.", "tip", 5e3);
      if (kind === "desvia" && dist(this.tapir.x, this.tapir.y, g.player.x, g.player.y) < 260) g.caption("A anta desconfia e muda de rumo", g.panOf(this.tapir.x));
    }
    onCapyAlarm(src) {
      const g = this.g;
      g.caption("Latidos curtos: as capivaras correm para a \xE1gua", g.panOf(src.x));
      if (!g.flags.capyTip) {
        g.flags.capyTip = true;
        g.ui.toast("As capivaras se assustaram e foram para a \xE1gua. Elas voltam para a prainha quando tudo fica quieto.", "tip", 5e3);
      }
    }
    onCapyCalm() {
    }
    onPacaEvent(pc, kind) {
      const g = this.g;
      if (kind === "sai" && dist(pc.x, pc.y, g.player.x, g.player.y) < 200 && !g.flags.pacaTip) {
        g.flags.pacaTip = true;
        g.caption("Um farfalhar mi\xFAdo entre as ra\xEDzes", g.panOf(pc.x));
      }
    }
    onBirdFly(h) {
      const g = this.g;
      if (!h._cap || g.time - h._cap > 20) {
        h._cap = g.time;
        if (dist(h.x, h.y, g.player.x, g.player.y) < 300) g.caption("Uma gar\xE7a levanta voo da beira", g.panOf(h.x));
      }
    }
    onAnimalEvent(a, ev) {
      const g = this.g;
      if (ev === "fly") {
        for (const o of g.animals) if (o !== a && o.kind === "jacu" && dist(o.x, o.y, a.x, a.y) < 40) o.scare();
      }
    }
    // ================= utilitários =================
    los(ax, ay, bx, by) {
      const w = this.world, n = Math.ceil(dist(ax, ay, bx, by) / 6);
      for (let i = 2; i < n - 1; i++) {
        const t = i / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
        for (const c of w.near(x, y)) if (!c.off && c.r >= 3 && c.kind !== "tapir" && (x - c.x) ** 2 + (y - c.y) ** 2 < c.r * c.r) return false;
      }
      return true;
    }
    nearWater(x, y, r) {
      const w = this.world;
      let best = null, bd = 1e9;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) for (let d = 8; d <= r; d += 8) {
        const qx = x + Math.cos(a) * d, qy = y + Math.sin(a) * d;
        if (w.isWater(qx, qy)) {
          if (d < bd) {
            bd = d;
            best = { x: qx, y: qy };
          }
          break;
        }
      }
      return best;
    }
    reindex(c) {
      const w = this.world;
      const r = c.r || 0, x0 = c.r ? c.x - r : c.x, y0 = c.r ? c.y - r : c.y, x1 = c.r ? c.x + r : c.x + c.w, y1 = c.r ? c.y + r : c.y + c.h;
      const key = `${Math.floor(x0 / 64)},${Math.floor(y0 / 64)},${Math.floor(x1 / 64)},${Math.floor(y1 / 64)}`;
      if (c._key === key) return;
      c._key = key;
      for (const [k, arr] of w.colGrid) {
        const i = arr.indexOf(c);
        if (i >= 0) arr.splice(i, 1);
        if (!arr.length) w.colGrid.delete(k);
      }
      for (let gy = Math.floor(y0 / 64); gy <= Math.floor(y1 / 64); gy++) for (let gx = Math.floor(x0 / 64); gx <= Math.floor(x1 / 64); gx++) {
        const k = gx + "," + gy;
        if (!w.colGrid.has(k)) w.colGrid.set(k, []);
        w.colGrid.get(k).push(c);
      }
    }
    unstick(p) {
      const w = this.world;
      if (!w.hit(p.x, p.y, p.r * 0.7) && !circleBlocked(w, p.x, p.y, p.r * 0.7)) return;
      for (let r = 3; r <= 40; r += 3) for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
        if (!w.hit(x, y, p.r) && !circleBlocked(w, x, y, p.r)) {
          p.x = x;
          p.y = y;
          return;
        }
      }
    }
    stormLevel() {
      return this.rain;
    }
    dusk() {
      return clamp((this.g.tod - 1e3) / 90, 0, 1);
    }
    get extraDark() {
      const g = this.g, p = g.player;
      let d = this.dusk() * 0.22 + this.rain * 0.36 + (this.silence() ? 0.12 : 0);
      if (p && p.x > px5(110) && p.y > px5(54)) d += 0.06;
      return d;
    }
    // tarde dourada que vira tempestade: ajusta a luz depois do cálculo padrão do horário
    applyWeather() {
      const g = this.g, r = this.rain, dk = this.dusk(), sil = this.silence() ? 1 : 0;
      const gold = clamp((g.tod - 930) / 80, 0, 1) * (1 - r);
      g.sun.strength *= (1 - r * 0.9) * (1 - dk * 0.5) * (1 - sil * 0.5);
      const tA = 0.12 * gold + 0.26 * r + 0.1 * sil;
      const mix = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
      let tint = [255, 196, 120];
      tint = mix(tint, [90, 110, 140], clamp(r + sil * 0.8, 0, 1));
      g.tint = [...tint, tA];
      if (r > 0.05 || sil) g.ambientColor = [16, 22, 30];
      else if (dk > 0) g.ambientColor = [40, 26, 30];
      g.vignette = 0.45 + r * 0.15 + sil * 0.1;
    }
    // ================= atualização =================
    update(dt) {
      const g = this.g, p = g.player, f = g.flags;
      if (!p || !this.world || !this.canoe) return;
      const playing = g.state === "play";
      for (let i = this.timers.length - 1; i >= 0; i--) if (g.time >= this.timers[i].t) {
        const tm = this.timers[i];
        this.timers.splice(i, 1);
        tm.fn();
      }
      this.drift.update(dt);
      const c = this.canoe;
      if (this.boarded()) {
        p.locked = true;
        p.x = c.x;
        p.y = c.y;
        p.vx = c.vx;
        p.vy = c.vy;
        p.moving = c.speed > 4;
        p.running = false;
        p.noise = lerp(p.noise, Math.min(0.5, c.speed / 120), Math.min(1, dt * 4));
        if (Math.abs(c.thrust) > 0.3) p.en = Math.max(15, p.en - 1.2 * dt);
        else p.en = Math.min(100, p.en + 3 * dt);
        if (!c.free()) c.unstick();
        this.landSpot = c.speed < 24 ? this.findLandSpot() : null;
        if (playing) {
          if (!f.m6_learn && g.done.has("m5")) {
            this.learnD += c.speed * dt;
            this.learnTurn += Math.abs(c.turn) * dt;
            if (this.learnD > 160 && this.learnTurn > 0.8) {
              f.m6_learn = true;
              g.ui.toast("Pegou o jeito do remo. Siga pelo igarap\xE9 a nordeste do lago.", "tip", 4500);
            }
          }
          if (c.stuckT > 2.2 && !this.stuckTip) {
            this.stuckTip = true;
            g.ui.toast("A canoa encalhou. Aperte <kbd>E</kbd> para desencalhar com o remo.", "tip", 4500);
          }
          if (c.stuckT < 0.5) this.stuckTip = false;
        }
      } else {
        this.landSpot = null;
        this.unstick(p);
        if (playing) this.updatePush(dt);
      }
      if (playing) {
        this.updateMud(dt);
        if (!f.m4_group && g.done.has("m3")) {
          for (const m of this.capys.members) if (dist(m.x, m.y, p.x, p.y) < 170 && this.los(p.x, p.y - 8, m.x, m.y - 4)) {
            f.m4_group = true;
            g.ui.toast("L\xE1 est\xE3o elas: um grupo de capivaras na prainha do lago. Chegue com calma.", "tip", 4500);
            this.checkM4();
            break;
          }
        }
        if (f.rainOn) {
          f.rainT = (f.rainT || 0) + dt;
        }
      }
      this.rain = f.rainOn ? clamp(0.15 + (f.rainT || 0) / 160 + (f.m8_prints ? 0.1 : 0) + (f.m8_hair ? 0.1 : 0) + (this.rainBoost || 0), 0, 1) : 0;
      this.updateEvent(dt);
      this.updateWeatherFx(dt);
      this.updateFish(dt);
      if (this.birdShadow) this.birdShadow.t += dt;
      this.applyWeather();
    }
    updateMud(dt) {
      const g = this.g, p = g.player, f = g.flags;
      if (this.boarded()) {
        p.speedMul = 1;
        return;
      }
      const surf = this.world.surfaceAt(p.x, p.y);
      const deep = MUD_A.some((m) => m.deep && inEll2(p.x / S7, p.y / S7, m) < 1);
      if (surf === "mud") p.mudT = deep ? 3.2 : 2.4;
      else p.mudT = Math.max(0, (p.mudT || 0) - dt);
      p.speedMul = deep && surf === "mud" ? 0.62 : p.mudT > 0 ? 0.82 + (1 - Math.min(1, p.mudT / 2.4)) * 0.18 : 1;
      if (p.moving && (surf === "mud" || surf === "water")) {
        this.stepAcc = (this.stepAcc || 0) + Math.hypot(p.vx, p.vy) * dt;
        if (this.stepAcc > 9) {
          this.stepAcc = 0;
          const side = this.prints.length % 2 ? 1 : -1, ang = Math.atan2(p.vy, p.vx);
          if (surf === "mud") this.prints.push({ x: p.x - Math.sin(ang) * side * 2, y: p.y + Math.cos(ang) * side * 1.5, a: ang, t: g.time });
          if (this.prints.length > 90) this.prints.shift();
          const n = surf === "water" ? 4 : 2;
          for (let i = 0; i < n; i++) g.particles.add({ type: "splash", x: p.x + (Math.random() - 0.5) * 4, y: p.y, vx: (Math.random() - 0.5) * 20, vy: -10 - Math.random() * 10, g: 70, life: 0.4, color: surf === "water" ? "#d0e0e4" : "#6a5434" });
          if (deep) {
            p.makeNoise(p.sneak ? 0.35 : 0.6);
            g.audio.play("mudslosh", { vol: 0.6 });
          }
        }
      }
      if (deep && !f.deepTip) {
        f.deepTip = true;
        g.ui.toast("<b>Atoleiro</b> \xB7 O barro fundo prende a bota: Caetano anda bem devagar e cada passo faz barulho, mesmo agachado.", "tip", 5500);
      }
    }
    updateWeatherFx(dt) {
      const g = this.g, r = this.rain;
      if (this.ev && this.ev.stage !== "done" && g.time > (this.thunderAt || 0)) {
        this.thunderAt = g.time + 9 + Math.random() * 10;
        g.audio.play("thunder", { vol: 0.35, far: true });
      }
      if (r > 0.45) {
        this.lightT -= dt;
        if (this.lightT <= 0) {
          this.lightT = 7 + Math.random() * 10 * (1.4 - r);
          g.flash = 0.35 + Math.random() * 0.2;
          const delay = 400 + Math.random() * 1600;
          setTimeout(() => g.audio.play("thunder", { vol: 0.6 + r * 0.4 }), delay);
          if (!g.flags.thunderCap) {
            g.flags.thunderCap = true;
            g.caption("Rel\xE2mpago... e o trov\xE3o rolando pela v\xE1rzea", 0);
          }
        }
      }
      if (r > 0.05) {
        const cam = g.camera, n = Math.round(r * 30 * dt * 10);
        for (let i = 0; i < n; i++) {
          const x = cam.x + (Math.random() - 0.5) * cam.viewW, y = cam.y + (Math.random() - 0.5) * cam.viewH;
          if (this.world.isWater(x, y) || this.world.terrainAt(x, y) === T.MUD) g.particles.add({ type: "ripple", x, y, life: 0.6, r1: 3, color: "#c8d8e0" });
        }
      }
    }
    updateFish(dt) {
      const g = this.g, p = g.player;
      for (const fi of this.fish) fi.t += dt;
      this.fish = this.fish.filter((fi) => fi.t < fi.dur);
      if (this.silence() || g.state !== "play") return;
      this.fishT -= dt;
      if (this.fishT > 0) return;
      this.fishT = 2.5 + Math.random() * 5;
      for (let k = 0; k < 10; k++) {
        const x = p.x + (Math.random() - 0.5) * 220, y = p.y + (Math.random() - 0.5) * 150;
        if (!this.world.isWater(x, y) || !this.world.isWater(x + 8, y) || dist(x, y, p.x, p.y) < 30) continue;
        const dir = Math.random() < 0.5 ? 1 : -1;
        this.fish.push({ x, y, dir, t: 0, dur: 0.75 });
        g.particles.add({ type: "ripple", x, y, life: 0.9, r1: 6, color: "#d0e0e4" });
        setTimeout(() => {
          g.particles.add({ type: "ripple", x: x + dir * 14, y, life: 1, r1: 7, color: "#d0e0e4" });
          for (let i = 0; i < 4; i++) g.particles.add({ type: "splash", x: x + dir * 14, y, vx: (Math.random() - 0.5) * 14, vy: -12, g: 60, life: 0.4 });
        }, 700);
        g.audio.play("fishjump", { pan: g.panOf(x), vol: 0.6 });
        if (!g.flags.fishCap) {
          g.flags.fishCap = true;
          g.caption("Um peixe salta e cai de volta na \xE1gua", g.panOf(x));
        }
        break;
      }
    }
    audioEnv() {
      const g = this.g, p = g.player;
      if (!p || !this.canoe) return {};
      const cur = this.current.at(p.x, p.y);
      const near = this.main.project(p.x, p.y);
      const flow = clamp(near.c / 27 * (1 - clamp((near.d - near.w) / 120, 0, 1)), 0, 1);
      const lake = clamp(1 - Math.sqrt(inEll2(p.x / S7, p.y / S7, LAKE, 1.8)), 0, 1);
      const quiet = this.silence() ? 0.95 : 0;
      void cur;
      return { river: Math.max(flow, lake * 0.25), riverPan: clamp((near.cx - p.x) / 120, -0.8, 0.8), dawn: 0, insects: (0.6 + this.dusk() * 0.3) * (1 - this.rain * 0.6), frogs: 0.4 + lake * 0.4 + this.rain * 0.5, birds: 1 - this.rain * 0.7 - this.dusk() * 0.4, fire: 0, herd: 0, herdPan: 0, quiet, rain: this.rain };
    }
    // info para o painel da canoa
    navInfo() {
      if (!this.boarded()) return null;
      const c = this.canoe, cur = this.current.at(c.x, c.y), cs = Math.hypot(cur.x, cur.y);
      return { speed: c.speed, max: 64, cur: cs, curA: Math.atan2(cur.y, cur.x), heading: c.a, instab: this.ev && this.ev.stage !== "done" && this.ev.stage !== "silence" ? this.instab : null };
    }
    // ================= desenho =================
    drawGround(ctx, V) {
      const g = this.g, f = g.flags, p = g.player, t = g.time;
      if (!this.drift) return;
      const vis = (x, y, m = 40) => x > V.cx - m && x < V.cx + V.vw + m && y > V.cy - m && y < V.cy + V.vh + m;
      const glint = (x, y, rx = 15, ry = 9, col = "#ffe8a0") => {
        if (!p || dist(x, y, p.x, p.y) > 76) return;
        ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 3 + x);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      };
      const w = this.world;
      const tx0 = Math.max(0, Math.floor(V.cx / 16)), tx1 = Math.min(w.tw - 1, Math.ceil((V.cx + V.vw) / 16)), ty0 = Math.max(0, Math.floor(V.cy / 16)), ty1 = Math.min(w.th - 1, Math.ceil((V.cy + V.vh) / 16));
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        if (!w.waterTiles[ty * w.tw + tx]) continue;
        const h = hash2(tx, ty, 41);
        if (h > 0.5) continue;
        const cur = this.current.at(tx * 16 + 8, ty * 16 + 8);
        const off = (t * (6 + Math.hypot(cur.x, cur.y) * 0.6) + h * 50) % 16;
        const dx = cur.x || cur.y ? cur.x / Math.hypot(cur.x, cur.y) : 1, dy = cur.x || cur.y ? cur.y / Math.hypot(cur.x, cur.y) : 0;
        const x = tx * 16 + 8 + dx * (off - 8), y = ty * 16 + 4 + h * 10 + dy * (off - 8) * 0.5;
        if (!w.isWater(x, y)) continue;
        ctx.globalAlpha = (0.08 + 0.1 * Math.sin(t * 1.6 + h * 30)) * (1 - this.rain * 0.5);
        ctx.fillStyle = h < 0.2 ? "#f0f4e8" : "#a8c8cc";
        ctx.fillRect(Math.round(x), Math.round(y), 3 + (h * 10 | 0) % 3, 1);
      }
      ctx.globalAlpha = 1;
      for (const d of w.queryDrawables(V.cx, V.cy, V.cx + V.vw, V.cy + V.vh, this._qd || (this._qd = []))) {
        if (!d.crown || !w.isWater(d.x, d.y + 14)) continue;
        const wob = Math.sin(t * 0.9 + d.x) * 1.5;
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = "#0c2018";
        ctx.beginPath();
        ctx.ellipse(d.x + wob, d.y + 14 + d.crown.r * 0.2, d.crown.r * 0.8, d.crown.r * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      this._qd.length = 0;
      ctx.globalAlpha = 1;
      for (const r of this.rocks) if (vis(r.x, r.y)) {
        ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 5 + r.x);
        ctx.strokeStyle = "#e8f0f0";
        ctx.beginPath();
        ctx.ellipse(r.x, r.y + 2, r.r + 3, r.r * 0.6 + 1, 0, 0, Math.PI);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (const q of this.floatGrass) if (vis(q.x, q.y, 60)) {
        for (let i = 0; i < 6; i++) {
          const a = i * 1.1, rr = q.r * (0.3 + i % 3 * 0.25);
          const s = Sprites.get("cn:" + i % 4, () => canaranaSprite(740 + i % 4));
          ctx.drawImage(s, Math.round(q.x + Math.cos(a) * rr - 8 + Math.sin(t + i) * 0.8), Math.round(q.y + Math.sin(a) * rr * 0.5 - 8));
        }
      }
      ctx.fillStyle = "#2a1c10";
      for (const pr of this.prints) {
        const age = t - pr.t;
        if (age > 40 || !vis(pr.x, pr.y)) continue;
        ctx.globalAlpha = 0.55 * (1 - age / 40);
        ctx.save();
        ctx.translate(Math.round(pr.x), Math.round(pr.y));
        ctx.rotate(pr.a);
        ctx.fillRect(-2, -1, 4, 2);
        ctx.fillRect(1, -1, 1, 2);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      this.drift.draw(ctx, V);
      for (const wv of this.waves) {
        const q = this.main.at(wv.s);
        if (!vis(q.x, q.y, 60)) continue;
        ctx.globalAlpha = 0.5 * wv.w;
        ctx.strokeStyle = "#d8e8ec";
        ctx.lineWidth = 1;
        const an = Math.atan2(q.ty, q.tx);
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(an);
        ctx.beginPath();
        ctx.ellipse(0, 0, 6, q.w * 0.45, 0, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
        ctx.globalAlpha = 0.25 * wv.w;
        ctx.beginPath();
        ctx.ellipse(-5, 0, 6, q.w * 0.4, 0, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      if (!this.silence()) {
        const k = Math.floor(t / 9), sx = hash2(k, 1, 5), sy = hash2(k, 2, 5);
        const x = V.cx + sx * V.vw, y = V.cy + sy * V.vh, ph = t % 9 / 9;
        if (w.isWater(x, y) && w.isWater(x + 20, y)) {
          ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.18;
          ctx.fillStyle = "#081210";
          ctx.beginPath();
          ctx.ellipse(x + ph * 30, y, 9, 3, 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      const bs = this.bigShadow;
      if (bs && bs.a > 0) {
        const an = Math.atan2(bs.vy, bs.vx), segs = 14;
        for (let i = 0; i < segs; i++) {
          const k = i / segs, off = Math.sin(t * 2.2 - k * 5) * 10 * k;
          const x = bs.x - Math.cos(an) * bs.len * k - Math.sin(an) * off, y = bs.y - Math.sin(an) * bs.len * k + Math.cos(an) * off;
          if (!w.isWater(x, y)) continue;
          const r = 12 * (1 - k * 0.6) + 4;
          ctx.globalAlpha = 0.34 * bs.a * (1 - k * 0.4);
          ctx.fillStyle = "#050c0a";
          ctx.beginPath();
          ctx.ellipse(x, y, r, r * 0.55, an, 0, Math.PI * 2);
          ctx.fill();
          if (i % 3 === 0) {
            ctx.globalAlpha = 0.12 * bs.a;
            ctx.strokeStyle = "#b8d0d0";
            ctx.beginPath();
            ctx.ellipse(x, y, r + 4, (r + 4) * 0.55, an, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      }
      for (const b of this.boils) {
        if (!vis(b.x, b.y)) continue;
        const k = b.t / 2.5;
        ctx.globalAlpha = (1 - k) * 0.6 * b.k;
        ctx.strokeStyle = "#e0ecee";
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, 2 + k * 10, (2 + k * 10) * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#e8f2f4";
        ctx.fillRect(Math.round(b.x), Math.round(b.y - 1), 1, 1);
      }
      ctx.globalAlpha = 1;
      const sm = P2(LAMA1);
      if (!f.m1_mud) glint(sm.x, sm.y, 18, 9);
      for (const s of SIGNS_A) {
        const q = P2(s.at);
        if (!f["sign_" + s.id]) glint(q.x, q.y);
        if (s.id === "paca" && vis(q.x, q.y)) {
          const rs = Sprites.get("root:22", () => rootSprite(22, 22));
          ctx.drawImage(rs, Math.round(q.x - 11), Math.round(q.y - 6));
        }
      }
      if (g.done.has("m1") && !f.m2_prints) {
        const q = P2(ANTA_PRINTS);
        glint(q.x, q.y, 18, 10, "#ffd666");
      }
      for (const c of CLUES2) {
        const q = P2(c.at);
        if (!vis(q.x, q.y) || f[c.id]) continue;
        glint(q.x, q.y, 13, 8, "#ffd666");
        if (c.id === "c_cocos") {
          ctx.fillStyle = "#6a4a28";
          for (let i = 0; i < 6; i++) ctx.fillRect(Math.round(q.x - 4 + i % 3 * 3), Math.round(q.y - 1 + (i / 3 | 0) * 2), 2, 1);
        }
        if (c.id === "c_fezes") {
          ctx.fillStyle = "#3a4a22";
          for (let i = 0; i < 7; i++) ctx.fillRect(Math.round(q.x - 4 + i % 4 * 2), Math.round(q.y + (i / 4 | 0) * 2), 1, 1);
        }
        if (c.id === "c_jacare") {
          ctx.strokeStyle = "rgba(40,30,18,0.6)";
          ctx.beginPath();
          ctx.moveTo(q.x - 14, q.y - 2);
          ctx.quadraticCurveTo(q.x, q.y + 3, q.x + 14, q.y);
          ctx.stroke();
        }
        if (c.id === "c_ossos") {
          ctx.fillStyle = "#e8e0d0";
          ctx.fillRect(Math.round(q.x - 3), Math.round(q.y), 6, 1);
          for (let i = 0; i < 3; i++) ctx.fillRect(Math.round(q.x - 2 + i * 2), Math.round(q.y - 1), 1, 3);
        }
      }
      if (f.m7_escape && !f.m7_mark) {
        const q = P2(MARK_TREE);
        glint(q.x, q.y - 10, 16, 10, "#ffd666");
      }
      if (f.m8_land && !f.m8_prints) {
        const q = P2(PRINTS_E);
        glint(q.x, q.y, 16, 10, "#ffd666");
      }
      if (f.m8_prints && !f.m8_hair) {
        const q = P2(HAIR_E);
        glint(q.x, q.y - 4, 12, 9, "#ff9a6a");
      }
      if (f.m8_hair && !f.m8_dir) {
        const q = P2(DIR_SIGN);
        glint(q.x, q.y, 14, 8, "#ffd666");
      }
      if (!f.paddle && g.done.has("m3")) {
        const q = this.jirau;
        if (vis(q.x, q.y)) glint(q.x, q.y - 4, 18, 9, "#a8d8f0");
      }
      if (!f.launched && f.branch && f.vines) {
        const q = this.pushTarget();
        ctx.globalAlpha = 0.3 + 0.15 * Math.sin(t * 2);
        ctx.strokeStyle = "#e8d8a0";
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, 7, 4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }
    crownClear(V) {
      const g = this.g, p = g.player, out = this._clear || (this._clear = []);
      out.length = 0;
      if (!p || !this.canoe) return out;
      if (g.state === "cutscene" && !g.camera.follow) out.push({ x: g.camera.x, y: g.camera.y + 8, r: 60, min: 0.3 });
      if (this.boarded()) out.push({ x: this.canoe.x, y: this.canoe.y, r: 80, min: 0.18 });
      const add = (a, r) => {
        if (a.visible === false) return;
        if (a.x < V.cx - 40 || a.x > V.cx + V.vw + 40 || a.y < V.cy - 20 || a.y > V.cy + V.vh + 60) return;
        if (dist(a.x, a.y, p.x, p.y) < 240) out.push({ x: a.x, y: a.y, r, min: 0.4 });
      };
      add(this.tapir, 22);
      for (const m of this.capys.members) add(m, 16);
      for (const pc of this.pacas) add(pc, 12);
      if (this.bigShadow) out.push({ x: this.bigShadow.x, y: this.bigShadow.y, r: 90, min: 0.3 });
      return out;
    }
    drawWorldOverlay(ctx, V) {
      const g = this.g, t = g.time;
      for (const fi of this.fish) {
        const k = fi.t / fi.dur, x = fi.x + fi.dir * 14 * k, y = fi.y - Math.sin(k * Math.PI) * 10;
        const s = Sprites.get("fish:" + (fi.dir < 0 ? 1 : 0), () => {
          const c = fishSprite(0);
          return fi.dir < 0 ? flipCanvas(c) : c;
        });
        ctx.save();
        ctx.translate(Math.round(x), Math.round(y));
        ctx.rotate((k - 0.5) * 1.6 * fi.dir);
        ctx.drawImage(s, -4, -2);
        ctx.restore();
      }
      const fogs = [[84, 47.5, 10, 0.07], [116, 26, 7, 0.08], [133.5, 64.5, 9, 0.12 + this.rain * 0.08], [50, 46, 6, 0.05]];
      for (const [fx, fy, fr, fa] of fogs) {
        const x = px5(fx) + Math.sin(t * 0.05 + fx) * 20, y = px5(fy), r = fr * S7;
        if (x < V.cx - r || x > V.cx + V.vw + r || y < V.cy - r || y > V.cy + V.vh + r) continue;
        const grd = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
        grd.addColorStop(0, `rgba(210,220,220,${fa * (1 + this.dusk())})`);
        grd.addColorStop(1, "rgba(210,220,220,0)");
        ctx.fillStyle = grd;
        ctx.fillRect(x - r, y - r * 0.7, r * 2, r * 1.4);
      }
    }
    drawAfterLight(ctx, V) {
      const g = this.g, t = g.time;
      if (this.markA > 0) {
        const mt = P2(MARK_TREE);
        ctx.globalAlpha = this.markA * 0.85;
        ctx.fillStyle = "#c8bca0";
        ctx.fillRect(Math.round(mt.x - 7), Math.round(mt.y - 30), 14, 4);
        ctx.fillStyle = "#8a7e66";
        ctx.fillRect(Math.round(mt.x - 7), Math.round(mt.y - 26), 14, 1);
        ctx.fillStyle = "#e0d4b4";
        for (let i = 0; i < 7; i++) ctx.fillRect(Math.round(mt.x - 6 + i * 2), Math.round(mt.y - 29 + i % 2), 1, 1);
        ctx.fillStyle = "#c8bca0";
        ctx.fillRect(Math.round(mt.x - 6), Math.round(mt.y - 18), 12, 3);
        ctx.globalAlpha = 1;
      }
      const bsh = this.birdShadow;
      if (bsh) {
        const x = bsh.x + bsh.t * 70, y = bsh.y + Math.sin(bsh.t * 3) * 3;
        ctx.globalAlpha = Math.max(0, 0.75 - bsh.t * 0.35);
        ctx.fillStyle = "#05070a";
        ctx.beginPath();
        ctx.moveTo(x - 10, y);
        ctx.lineTo(x, y - 2 - Math.sin(bsh.t * 14) * 3);
        ctx.lineTo(x + 10, y);
        ctx.lineTo(x + 4, y + 1);
        ctx.lineTo(x, y + 4);
        ctx.lineTo(x - 4, y + 1);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      const r = this.rain;
      if (r > 0.02) {
        const n = Math.round(60 + r * 260);
        ctx.strokeStyle = "rgba(200,214,230,0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const h1 = hash2(i, 1, 99), h2 = hash2(i, 2, 99);
          const y = V.cy + (h2 * V.vh + t * (260 + h1 * 80)) % (V.vh + 20) - 10;
          const x = V.cx + (h1 * V.vw + t * 30 + (y - V.cy) * 0.18) % V.vw;
          ctx.moveTo(x, y);
          ctx.lineTo(x - 2, y - 7);
        }
        ctx.stroke();
        ctx.fillStyle = `rgba(30,40,56,${r * 0.12})`;
        ctx.fillRect(V.cx, V.cy, V.vw, V.vh);
      }
    }
  };

  // js/main.js
  var game = new Game({ 1: createPhase1, 2: createPhase2, 3: createPhase3 });
  window.__game = game;
  game.boot().catch((e) => {
    console.error(e);
    const m = document.getElementById("lg-msg");
    if (m) m.textContent = "Erro ao carregar: " + e.message;
  });
})();
