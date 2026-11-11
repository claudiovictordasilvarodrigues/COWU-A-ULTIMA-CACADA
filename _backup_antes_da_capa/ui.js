// Interface: painel de missões, HUD, diálogos, notificações, telas, inventário e mapas
import { formatTime, formatClock, clamp } from '../core/util.js';
import { Sprites } from '../gfx/sprites.js';
import { humanSprite, LOOKS } from '../gfx/art-characters.js';
import { iconSprite, trackSprite } from '../gfx/art-props.js';
import { ITEMS, COLLECTIBLES } from '../data/items.js';
import { LORE_HTML } from '../data/lore.js';
import { Save } from '../core/save.js';

// catálogo das fases da campanha (as não implementadas aparecem só como desbloqueio)
export const PHASE_NAMES = {
  1: 'A Primeira Pegada', 2: 'O Caminho dos Queixadas', 3: 'Os Segredos da Várzea', 4: 'Os Assobios de Matinta',
};
const NOISE_WORD = (v) => (v < 0.2 ? 'BAIXO' : v < 0.62 ? 'MÉDIO' : 'ALTO');

const $ = (id) => document.getElementById(id);
const icon = (id) => Sprites.get('icon:' + id, () => iconSprite(id));

export class UI {
  constructor(g) {
    this.g = g;
    this.el = {
      timer: $('timer'), tod: $('tod'), todname: $('todname'), missions: $('missions'),
      hp: $('b-hp'), en: $('b-en'), lt: $('b-lt'), noise: $('noise'), stance: $('stance'), found: $('found'), quick: $('quick'),
      mini: $('minimap'), toasts: $('toasts'), caption: $('caption'), dialog: $('dialog'),
      dname: document.querySelector('.dlg-name'), dtext: document.querySelector('.dlg-text'), dchoices: document.querySelector('.dlg-choices'),
      dnext: document.querySelector('.dlg-next'), portrait: $('portrait'),
      mhTimer: $('mh-timer'), mhObj: $('mh-obj'), mhHp: document.querySelector('.mh-bar.hp i'), mhEn: document.querySelector('.mh-bar.en i'),
      missions2: $('missions2'), nav: $('navhud'), psec: $('psec'), msecTitle: $('msec-title'), noiseLv: $('noise-lv'), foundLbl: $('found-lbl'), alert: $('alertbar'),
    };
    this.cache = {};
    this.screenStack = [];
    this.dlg = null;
    this.hudT = 0;
    this.openHint = null;
    $('lore').innerHTML = LORE_HTML + '<div class="m-btns row"><button data-back class="btn primary">Voltar</button></div>';
    this.bind();
  }

  bind() {
    const g = this.g;
    document.querySelectorAll('[data-ui]').forEach((b) => b.addEventListener('click', () => { g.audio.play('ui'); g.toggleOverlay(b.dataset.ui); }));
    document.querySelectorAll('[data-act-ui]').forEach((b) => b.addEventListener('click', () => { g.audio.play('ui'); g.uiAction(b.dataset.actUi); }));
    document.addEventListener('click', (e) => {
      const o = e.target.closest('[data-open]');
      if (o) { g.audio.play('ui'); this.pushScreen(o.dataset.open); }
      const bk = e.target.closest('[data-back]');
      if (bk) { g.audio.play('ui'); this.popScreen(); }
    });
    $('btn-new').addEventListener('click', () => { g.audio.init(); g.audio.play('ui'); g.newGame(); });
    $('btn-continue').addEventListener('click', () => { g.audio.init(); g.audio.play('ui'); g.continueGame(); });
    $('btn-phases').addEventListener('click', () => { g.audio.init(); g.audio.play('ui'); this.renderPhases(); this.pushScreen('phases'); });
    this.el.dialog.addEventListener('click', (e) => { if (!e.target.closest('button')) this.advance(); });
    $('scr-intro').addEventListener('click', () => this.introNext && this.introNext());
    $('scrim').addEventListener('click', () => this.setDrawer(false));

    const s = g.settings;
    document.querySelectorAll('[data-set]').forEach((inp) => {
      const k = inp.dataset.set;
      if (inp.type === 'checkbox') inp.checked = !!s[k]; else inp.value = s[k];
      inp.addEventListener('input', () => {
        s[k] = inp.type === 'checkbox' ? inp.checked : parseFloat(inp.value);
        g.applySettings();
      });
    });
  }

  // ---------- telas ----------
  showScreen(name) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('show'));
    this.screenStack = name ? [name] : [];
    if (name) $('scr-' + name).classList.add('show');
    if (name === 'menu') { $('btn-continue').hidden = !this.g.hasSave(); $('btn-phases').hidden = !Save.isUnlocked(2); }
    const first = name && $('scr-' + name).querySelector('.btn.primary, .btn');
    if (first && this.g.input.lastDevice === 'keyboard') setTimeout(() => first.focus(), 30);
  }
  pushScreen(name) {
    const cur = this.screenStack[this.screenStack.length - 1];
    if (cur) $('scr-' + cur).classList.remove('show');
    this.screenStack.push(name);
    $('scr-' + name).classList.add('show');
  }
  popScreen() {
    const cur = this.screenStack.pop();
    if (cur) $('scr-' + cur).classList.remove('show');
    const prev = this.screenStack[this.screenStack.length - 1];
    if (prev) $('scr-' + prev).classList.add('show');
    else this.g.uiAction('resume');
  }
  topScreen() { return this.screenStack[this.screenStack.length - 1]; }

  // ---------- fase atual ----------
  setPhase(ph) {
    $('ph-code').textContent = ph.code;
    $('ph-title').textContent = ph.title;
    const sec = !!(ph.secondary && ph.secondary.length);
    this.el.psec.hidden = !sec;
    this.el.msecTitle.textContent = sec ? 'MISSÕES PRINCIPAIS' : 'MISSÕES';
    this.clearAlert();
    this.cache = {};
  }
  alert(text, kind = 'alert', ttl = 0) {
    const a = this.el.alert;
    if (this.alertText === text && !a.hidden) { clearTimeout(this.alertT); if (ttl) this.alertT = setTimeout(() => this.clearAlert(), ttl); return; }
    this.alertText = text;
    a.textContent = text; a.className = 'alertbar ' + kind; a.hidden = false;
    a.style.animation = 'none'; void a.offsetWidth; a.style.animation = '';
    clearTimeout(this.alertT);
    if (ttl) this.alertT = setTimeout(() => this.clearAlert(), ttl);
  }
  clearAlert() { if (this.el.alert) this.el.alert.hidden = true; this.alertText = null; clearTimeout(this.alertT); }

  loading(p, msg) { $('lg-fill').style.width = `${Math.round(p * 100)}%`; if (msg) $('lg-msg').textContent = msg; }

  setDrawer(open) {
    document.body.classList.toggle('drawer-open', open);
    $('scrim').hidden = !open || window.innerWidth > 900;
  }

  // ---------- notificações ----------
  toast(text, type = 'tip', ttl = 4200) {
    const d = document.createElement('div');
    d.className = 'toast ' + type;
    d.innerHTML = text;
    this.el.toasts.appendChild(d);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 450); }, ttl);
  }
  caption(text, pan = 0) {
    if (!this.g.settings.captions) return;
    const arrow = pan < -0.3 ? '◀ ' : pan > 0.3 ? '' : '';
    const arrowR = pan > 0.3 ? ' ▶' : '';
    this.el.caption.textContent = `${arrow}[${text}]${arrowR}`;
    this.el.caption.hidden = false;
    clearTimeout(this.capT);
    this.capT = setTimeout(() => { this.el.caption.hidden = true; }, 3800);
  }
  titleCard(code, title, sub = '', cls = '') {
    const t = $('titlecard');
    t.classList.toggle('small', cls === 'small');
    t.querySelector('.tc-code').textContent = code;
    t.querySelector('.tc-title').textContent = title;
    t.querySelector('.tc-sub').textContent = sub;
    t.hidden = false;
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(this.tcT); this.tcT = setTimeout(() => { t.hidden = true; }, 4300);
  }
  flashStance() { const s = this.el.stance; s.classList.remove('flash'); void s.offsetWidth; s.classList.add('flash'); }

  // ---------- diálogos ----------
  drawPortrait(look) {
    const c = this.el.portrait, x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    if (!look || !LOOKS[look]) { c.style.visibility = 'hidden'; return; }
    c.style.visibility = 'visible';
    x.drawImage(Sprites.get(`h:${look}:down:0:0`, () => humanSprite(LOOKS[look], 'down', 0, false)), 0, 0);
  }
  say(name, text, look) {
    return new Promise((res) => {
      this.el.dialog.hidden = false;
      this.el.dname.textContent = name || '';
      this.el.dchoices.innerHTML = '';
      this.el.dnext.hidden = false;
      this.drawPortrait(look);
      this.dlg = { text, shown: 0, done: false, res, choice: false };
      this.el.dtext.innerHTML = '';
      this.g.audio.play('page');
    });
  }
  choice(name, text, options, look) {
    return new Promise((res) => {
      this.el.dialog.hidden = false;
      this.el.dname.textContent = name || '';
      this.drawPortrait(look);
      this.el.dtext.innerHTML = text;
      this.el.dnext.hidden = true;
      this.el.dchoices.innerHTML = '';
      this.dlg = { choice: true, res, options };
      options.forEach((o, i) => {
        const b = document.createElement('button');
        b.innerHTML = `<kbd>${i + 1}</kbd>${o}`;
        b.addEventListener('click', () => this.pick(i));
        this.el.dchoices.appendChild(b);
      });
      if (this.g.input.lastDevice === 'keyboard') setTimeout(() => this.el.dchoices.firstChild?.focus(), 30);
    });
  }
  pick(i) {
    if (!this.dlg || !this.dlg.choice) return;
    if (i < 0 || i >= this.dlg.options.length) return;
    const r = this.dlg.res; this.dlg = null;
    this.el.dialog.hidden = true; this.el.dchoices.innerHTML = '';
    this.g.audio.play('ui');
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
    if (!d.done) { d.shown = d.text.length; d.done = true; this.el.dtext.textContent = d.text; return; }
    this.dlg = null;
    this.el.dialog.hidden = true;
    d.res();
  }
  hideDialog() { this.el.dialog.hidden = true; this.dlg = null; }

  // ---------- intro ----------
  intro(slides) {
    return new Promise((res) => {
      this.showScreen('intro');
      const el = $('intro-text');
      let i = -1;
      const next = () => {
        i++;
        if (i >= slides.length) { this.introNext = null; this.showScreen(null); res(); return; }
        el.style.opacity = 0;
        setTimeout(() => { el.innerHTML = slides[i]; el.style.opacity = 1; }, 350);
      };
      this.introNext = () => { this.g.audio.play('page'); next(); };
      next();
    });
  }

  // ---------- missões ----------
  renderMissions() {
    const g = this.g, list = this.el.missions;
    const cur = g.currentMission();
    list.innerHTML = '';
    this.renderList(list, g.phase.missions, cur);
    if (g.phase.secondary) this.renderList(this.el.missions2, g.phase.secondary, null);
    this.justDone = null;
    this.cache.prog = this.progressKey();
    const c = g.currentMission();
    this.el.mhObj.textContent = c ? '▸ ' + c.title : '';
  }
  renderList(list, missions, cur) {
    const g = this.g;
    list.innerHTML = '';
    for (const m of missions) {
      const li = document.createElement('li');
      const done = g.done.has(m.id);
      li.className = 'm' + (done ? ' done' : '') + (cur && cur.id === m.id ? ' current' : '');
      li.dataset.id = m.id;
      const prog = !done && m.progress ? m.progress() : '';
      li.innerHTML = `<span class="cb">✓</span><span class="mt">${m.title}${prog ? ` <span class="mp">${prog}</span>` : ''}</span><button class="mh" title="Dica" aria-label="Dica">?</button>${this.openHint === m.id ? `<div class="hint">${typeof m.hint === 'function' ? m.hint() : m.hint}</div>` : ''}`;
      li.querySelector('.mh').addEventListener('click', (e) => { e.stopPropagation(); this.openHint = this.openHint === m.id ? null : m.id; g.audio.play('ui'); this.renderMissions(); });
      if (this.justDone === m.id) li.classList.add('just');
      if (m.failed && !done && m.failed()) li.classList.add('failed');
      list.appendChild(li);
    }
  }
  progressKey() {
    const ph = this.g.phase, all = ph.missions.concat(ph.secondary || []);
    const cur = this.g.currentMission();
    return all.map((m) => (m.progress ? m.progress() : '') + (m.failed && m.failed() ? '!' : '')).join('|') + '#' + (cur ? cur.id : '');
  }
  markDone(id) { this.justDone = id; this.renderMissions(); }

  // ---------- HUD ----------
  updateHUD(dt) {
    this.hudT -= dt;
    if (this.hudT > 0) return;
    this.hudT = 0.1;
    const g = this.g, p = g.player, c = this.cache;
    const set = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
    const tl = formatTime(g.timeLeft);
    set('timer', tl, (v) => { this.el.timer.textContent = v; this.el.mhTimer.textContent = v; this.el.timer.classList.toggle('low', g.timeLeft < 300); });
    set('tod', formatClock(g.tod), (v) => { this.el.tod.textContent = v; });
    set('todn', g.todName(), (v) => { this.el.todname.textContent = v; });
    const bar = (el, k, v, max, txt) => set(k, Math.round(v), () => { el.querySelector('.fill').style.width = `${clamp(v / max, 0, 1) * 100}%`; el.querySelector('.bv').textContent = txt; });
    bar(this.el.hp, 'hp', p.hp, 100, `${Math.round(p.hp)}/100`);
    bar(this.el.en, 'en', p.en, 100, `${Math.round(p.en)}/100`);
    bar(this.el.lt, 'lt', p.battery, 100, `${Math.round(p.battery)}%`);
    set('mhhp', Math.round(p.hp), (v) => { this.el.mhHp.style.width = v + '%'; });
    set('mhen', Math.round(p.en), (v) => { this.el.mhEn.style.width = v + '%'; });
    const nz = Math.max(p.noise, p.noiseSpike);
    const lv = Math.round(nz * 5);
    set('noise', lv, (v) => {
      [...this.el.noise.children].forEach((i, k) => { i.className = k < v ? 'on' + (k >= 3 ? ' hi' : k >= 1 ? ' mid' : '') : ''; });
    });
    set('noisew', NOISE_WORD(nz), (v) => { if (this.el.noiseLv) { this.el.noiseLv.textContent = v; this.el.noiseLv.className = 'nlv ' + (v === 'ALTO' ? 'hi' : v === 'MÉDIO' ? 'mid' : 'lo'); } });
    const st = p.exhausted ? 'Exausto' : p.aiming ? 'Mirando' : p.running ? 'Correndo' : p.sneak ? (p.inBush ? 'Escondido' : 'Agachado') : p.inBush ? 'Na moita' : p.moving ? 'Andando' : 'Parado';
    set('stance', st, (v) => { this.el.stance.textContent = v; });
    const row = g.phase.panelRow ? g.phase.panelRow() : ['Itens encontrados', `${g.inv.found.size}/${COLLECTIBLES.length}`];
    set('found', row.join('|'), () => { this.el.foundLbl.textContent = row[0]; this.el.found.textContent = row[1]; });
    const q = [['cantil', `${g.res.water}/4`], ['marmita', `${g.res.food}`], ['cartucho', `${g.res.ammo}`], ['pilhas', `${g.inv.count('pilhas')}`]].filter(([id]) => (id === 'cartucho' ? g.inv.has('espingarda') : g.inv.has(id)));
    set('quick', JSON.stringify(q), () => {
      this.el.quick.innerHTML = '';
      for (const [id, t] of q) {
        const d = document.createElement('div'); d.className = 'qi'; d.title = ITEMS[id].name;
        const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16; cv.getContext('2d').drawImage(icon(id), 0, 0);
        d.appendChild(cv); d.insertAdjacentHTML('beforeend', `<b>${t}</b>`);
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
    if (!n) { if (!el.hidden) el.hidden = true; return; }
    el.hidden = false;
    el.querySelector('.nv-sp i').style.width = `${clamp(n.speed / n.max, 0, 1) * 100}%`;
    const word = n.cur < 2 ? 'parada' : n.cur < 9 ? 'fraca' : n.cur < 19 ? 'média' : 'forte';
    el.querySelector('.nv-cw').textContent = word;
    el.querySelector('.nv-arrow').style.transform = `rotate(${n.curA}rad)`;
    el.querySelector('.nv-arrow').style.opacity = n.cur < 2 ? 0.25 : 1;
    const ib = el.querySelector('.nv-in');
    ib.hidden = n.instab === null;
    if (n.instab !== null) ib.querySelector('i').style.width = `${clamp(n.instab, 0, 100)}%`;
  }

  drawMinimap() {
    const g = this.g, w = g.world, cv = this.el.mini, x = cv.getContext('2d');
    if (!w.mini) return;
    const s = w.miniScale, p = g.player;
    const W = cv.width, H = cv.height;
    x.imageSmoothingEnabled = false;
    x.fillStyle = '#0b1209'; x.fillRect(0, 0, W, H);
    const zoom = 2; // pixels do minimapa por célula
    const cxm = p.x / s, cym = p.y / s;
    const sw = W / zoom, sh = H / zoom;
    x.drawImage(w.mini, cxm - sw / 2, cym - sh / 2, sw, sh, 0, 0, W, H);
    // névoa do que não foi explorado
    x.fillStyle = 'rgba(8,12,7,0.86)';
    const fc = 32 / s * zoom;
    const ox = (cxm - sw / 2) * zoom, oy = (cym - sh / 2) * zoom;
    const i0 = Math.floor(ox / fc), j0 = Math.floor(oy / fc);
    for (let j = j0; j < j0 + H / fc + 2; j++) for (let i = i0; i < i0 + W / fc + 2; i++) {
      const ex = i >= 0 && j >= 0 && i < w.fogCols && j < w.fogRows ? w.explored[j * w.fogCols + i] : 0;
      if (!ex) x.fillRect(Math.floor(i * fc - ox), Math.floor(j * fc - oy), Math.ceil(fc) + 1, Math.ceil(fc) + 1);
    }
    const toM = (wx, wy) => [W / 2 + (wx - p.x) / s * zoom, H / 2 + (wy - p.y) / s * zoom];
    for (const n of g.npcs) { const [a, b] = toM(n.x, n.y); x.fillStyle = '#7ab8e0'; x.fillRect(a - 2, b - 2, 4, 4); }
    const t = g.currentTarget();
    if (t) {
      let [a, b] = toM(t.x, t.y);
      const out = a < 4 || b < 4 || a > W - 4 || b > H - 4;
      a = clamp(a, 5, W - 5); b = clamp(b, 5, H - 5);
      x.fillStyle = '#ffd666'; x.beginPath(); x.arc(a, b, out ? 3 : 4 + Math.sin(g.time * 5), 0, Math.PI * 2); x.fill();
    }
    // jogador
    x.save(); x.translate(W / 2, H / 2);
    const ang = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[p.dir];
    x.rotate(ang); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(6, 0); x.lineTo(-4, -4); x.lineTo(-2, 0); x.lineTo(-4, 4); x.closePath(); x.fill();
    x.restore();
    // bússola e vento
    x.fillStyle = 'rgba(0,0,0,.55)'; x.beginPath(); x.arc(W - 24, 24, 19, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#6a7a5a'; x.lineWidth = 1; x.stroke();
    x.fillStyle = '#e0654a'; x.beginPath(); x.moveTo(W - 24, 9); x.lineTo(W - 28, 24); x.lineTo(W - 20, 24); x.fill();
    x.fillStyle = '#d8d0b8'; x.beginPath(); x.moveTo(W - 24, 39); x.lineTo(W - 28, 24); x.lineTo(W - 20, 24); x.fill();
    x.font = '700 10px Nunito, sans-serif'; x.textAlign = 'center'; x.fillStyle = '#fff'; x.fillText('N', W - 24, 8);
    // vento
    x.save(); x.translate(26, H - 22);
    x.fillStyle = 'rgba(0,0,0,.55)'; x.beginPath(); x.arc(0, 0, 16, 0, Math.PI * 2); x.fill();
    x.rotate(g.wind.a);
    x.strokeStyle = '#a8d8f0'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(-9, 0); x.lineTo(9, 0); x.lineTo(5, -4); x.moveTo(9, 0); x.lineTo(5, 4);
    x.moveTo(-9, 0); x.lineTo(-12, -3); x.moveTo(-6, 0); x.lineTo(-9, -3); x.stroke();
    x.restore();
    x.font = '700 9px Nunito, sans-serif'; x.fillStyle = '#a8d8f0'; x.textAlign = 'left'; x.fillText('VENTO', 44, H - 18);
    x.fillStyle = '#7a8a6a'; x.fillText('o cheiro vai junto', 44, H - 8);
  }

  // ---------- paneiro (inventário) ----------
  renderInventory() {
    const g = this.g, inv = g.inv;
    $('inv-cap').textContent = `${inv.slotsUsed()}/${inv.cap} espaços`;
    const grid = $('inv-grid'); grid.innerHTML = '';
    const det = $('inv-detail');
    const showDet = (id) => {
      const it = ITEMS[id];
      let extra = '';
      if (id === 'cantil') extra = `<p>Água: <b>${g.res.water}/4</b> goles.</p><button class="btn" data-use="cantil">Beber (1)</button>`;
      if (id === 'marmita') extra = `<p>Porções: <b>${g.res.food}</b>.</p><button class="btn" data-use="marmita">Comer (2)</button>`;
      if (id === 'pilhas') extra = `<button class="btn" data-use="pilhas">Trocar pilhas (3)</button>`;
      if (id === 'espingarda') extra = `<p>Cartuchos: <b>${g.res.ammo}</b>.</p>`;
      det.innerHTML = `<h4>${it.name}</h4><p>${it.desc}</p>${extra}`;
      det.querySelectorAll('[data-use]').forEach((b) => b.addEventListener('click', () => { g.useItem(b.dataset.use); this.renderInventory(); showDet(id); }));
    };
    const items = [...inv.items.entries()];
    for (let i = 0; i < inv.cap; i++) {
      const s = document.createElement('div');
      s.className = 'slot';
      if (items[i]) {
        const [id, n] = items[i];
        const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16; cv.getContext('2d').drawImage(icon(id), 0, 0);
        s.appendChild(cv);
        const cnt = id === 'cantil' ? g.res.water : id === 'marmita' ? g.res.food : n > 1 ? n : '';
        if (cnt !== '') s.insertAdjacentHTML('beforeend', `<b>${cnt}</b>`);
        s.title = ITEMS[id].name;
        s.addEventListener('click', () => { grid.querySelectorAll('.slot').forEach((q) => q.classList.remove('sel')); s.classList.add('sel'); showDet(id); g.audio.play('ui'); });
      } else s.classList.add('empty');
      grid.appendChild(s);
    }
    const fg = $('inv-found'); fg.innerHTML = '';
    for (const id of COLLECTIBLES) {
      const s = document.createElement('div');
      const has = inv.found.has(id);
      s.className = 'slot' + (has ? '' : ' locked');
      const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16; cv.getContext('2d').drawImage(icon(id), 0, 0);
      s.appendChild(cv);
      s.title = has ? ITEMS[id].name : '???';
      s.addEventListener('click', () => { if (has) { showDet(id); g.audio.play('ui'); } });
      fg.appendChild(s);
    }
    const jr = $('inv-journal'), jh = $('inv-journal-h');
    const entries = g.phase.journal ? g.phase.journal() : [];
    jh.hidden = jr.hidden = !entries.length;
    jr.innerHTML = entries.map((e) => `<div class="jr"><b>${e.title}</b><span>${e.text}</span></div>`).join('');
    const tr = $('inv-tracks'); tr.innerHTML = '';
    for (const t of g.phase.trackDefs || []) {
      const known = g.tracksKnown.has(t.id);
      const d = document.createElement('div'); d.className = 'trk' + (known ? '' : ' unk');
      const cv = document.createElement('canvas'); cv.width = 28; cv.height = 22; cv.getContext('2d').drawImage(Sprites.get('trk:' + t.kind, () => trackSprite(t.kind)), 0, 0);
      d.appendChild(cv); d.insertAdjacentHTML('beforeend', `<span>${known ? t.name : 'Rastro desconhecido'}</span>`);
      tr.appendChild(d);
    }
  }

  drawBigMap() {
    const g = this.g, w = g.world, cv = $('bigmap'), x = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    x.imageSmoothingEnabled = false;
    x.fillStyle = '#0b1209'; x.fillRect(0, 0, W, H);
    const sc = Math.min(W / w.W, H / w.H);
    const ox = (W - w.W * sc) / 2, oy = (H - w.H * sc) / 2;
    x.drawImage(w.mini, ox, oy, w.W * sc, w.H * sc);
    x.fillStyle = 'rgba(10,14,8,0.92)';
    const fc = 32 * sc;
    for (let j = 0; j < w.fogRows; j++) for (let i = 0; i < w.fogCols; i++) if (!w.explored[j * w.fogCols + i]) x.fillRect(Math.floor(ox + i * fc), Math.floor(oy + j * fc), Math.ceil(fc) + 1, Math.ceil(fc) + 1);
    x.font = '700 12px Nunito, sans-serif'; x.textAlign = 'center';
    for (const poi of g.phase.pois || []) {
      const fi = Math.floor(poi.x / 32), fj = Math.floor(poi.y / 32);
      if (!w.explored[fj * w.fogCols + fi]) continue;
      const px = ox + poi.x * sc, py = oy + poi.y * sc;
      x.fillStyle = '#8fcf6a'; x.beginPath(); x.arc(px, py, 3.5, 0, Math.PI * 2); x.fill();
      x.fillStyle = 'rgba(0,0,0,.7)'; x.fillText(poi.name, px + 1, py - 7);
      x.fillStyle = '#f4ecd8'; x.fillText(poi.name, px, py - 8);
    }
    const t = g.currentTarget();
    if (t) { x.fillStyle = '#ffd666'; x.beginPath(); x.arc(ox + t.x * sc, oy + t.y * sc, 5, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#3a2a08'; x.stroke(); }
    const p = g.player;
    x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 2;
    x.beginPath(); x.arc(ox + p.x * sc, oy + p.y * sc, 5, 0, Math.PI * 2); x.fill(); x.stroke();
    x.fillStyle = '#e0654a'; x.font = '800 14px Nunito, sans-serif'; x.fillText('N ▲', W - 30, 22);
  }

  results(rows, info = {}) {
    const g = this.g, ph = g.phase, nx = ph.id + 1;
    $('r-code').textContent = info.code || `${ph.code} CONCLUÍDA`;
    $('r-title').textContent = info.title || ph.displayTitle || PHASE_NAMES[ph.id] || ph.title;
    $('results-body').innerHTML = rows.map(([k, v]) => `<div class="rstat"><span>${k}</span><b>${v}</b></div>`).join('');
    const playable = g.hasPhase(nx);
    $('r-next').innerHTML = `Próxima fase: <b>${PHASE_NAMES[nx] || 'em breve'}</b><br><span class="muted">${playable ? 'desbloqueada' : 'desbloqueada · disponível depois da sua validação'}</span>`;
    $('btn-next').hidden = !playable;
    $('btn-next').textContent = `Jogar a Fase ${nx}`;
    this.showScreen('results');
  }
  renderPhases() {
    const g = this.g, prog = Save.progress(), box = $('phase-list');
    box.innerHTML = '';
    for (let id = 1; id <= Math.max(3, ...Object.keys(PHASE_NAMES).map(Number).filter((n) => Save.isUnlocked(n) || this.g.hasPhase(n))); id++) {
      const unlocked = Save.isUnlocked(id), playable = g.hasPhase(id), done = !!prog.completed[id];
      const run = Save.load(id), inProg = run && !run.completed;
      const d = document.createElement('div');
      d.className = 'phase-item' + (unlocked ? '' : ' locked');
      d.innerHTML = `<div class="pi-code">FASE ${id}${done ? ' · <span class="ok">concluída</span>' : ''}</div><div class="pi-title">${unlocked ? PHASE_NAMES[id] : '???'}</div>`;
      const btns = document.createElement('div'); btns.className = 'pi-btns';
      if (unlocked && playable) {
        if (inProg) { const b = document.createElement('button'); b.className = 'btn primary'; b.textContent = 'Continuar'; b.onclick = () => { g.audio.play('ui'); g.playPhase(id, false); }; btns.appendChild(b); }
        const b2 = document.createElement('button'); b2.className = 'btn' + (inProg ? '' : ' primary'); b2.textContent = done || inProg ? 'Jogar do início' : 'Começar';
        b2.onclick = () => { g.audio.play('ui'); g.playPhase(id, true); }; btns.appendChild(b2);
      } else if (unlocked) btns.innerHTML = '<span class="muted">Desbloqueada · em desenvolvimento</span>';
      else btns.innerHTML = '<span class="muted">Bloqueada</span>';
      d.appendChild(btns);
      box.appendChild(d);
    }
  }
  fail(title, msg) { $('fail-title').textContent = title; $('fail-msg').textContent = msg; this.showScreen('fail'); }
}
