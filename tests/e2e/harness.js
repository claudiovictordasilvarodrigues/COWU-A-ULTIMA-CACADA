// Ajudantes injetados na página pelos testes de navegador (Playwright).
// Avançam o jogo em passos fixos, apertam teclas e movem o jogador por caminhos.
window.__T = (() => {
  const g = () => window.__game;
  const px = (t) => t * 16;
  const T = {
    log: [],
    async ff(sec, opts = {}) {
      const G = g(), dt = 1 / 30;
      for (let t = 0; t < sec; t += dt) {
        if (opts.until && opts.until()) return true;
        if (G.ui.dlg) { if (G.ui.dlg.choice) G.ui.pick(T.choiceIdx || 0); else { G.ui.dlg.shown = 9999; G.ui.dlg.done = true; G.ui.advance(); } }
        if (G.state === 'intro' && G.ui.introNext) G.ui.introNext();
        if (opts.ctrl) opts.ctrl(dt);
        G.update(dt);
        G.input.endFrame();
        await null;
      }
      return opts.until ? !!opts.until() : true;
    },
    tp(tx, ty) { const p = g().player; p.x = px(tx); p.y = px(ty); p.vx = p.vy = 0; g().camera.x = p.x; g().camera.y = p.y; },
    async press(a, sec = 0.1) { g().input.pressedSet.add(a); const G = g(); G.update(1 / 30); G.input.endFrame(); await this.ff(sec); },
    // interage com o objeto mais próximo cujo rótulo contenha "text"
    async interact(text, wait = 4, maxD = 140, teleport = true) {
      const G = g();
      const p = G.player;
      const it = G.interactables.filter((i) => (!i.enabled || i.enabled())).map((i) => ({ i, d: Math.hypot(i.x - p.x, i.y - p.y), l: typeof i.label === 'function' ? i.label() : i.label })).filter((o) => (!text || o.l.includes(text)) && o.d <= maxD).sort((a, b) => a.d - b.d)[0];
      if (!it) throw new Error('nada para interagir: ' + text);
      if (teleport) { p.x = it.i.x; p.y = it.i.y + 2; p.vx = p.vy = 0; }
      await this.ff(0.1);
      G.input.pressedSet.add('interact');
      G.update(1 / 30); G.input.endFrame();
      await this.ff(wait, { until: () => G.state === 'play' && !G.ui.dlg });
      return it.l;
    },
    keys(dirs, run = false, sneak = false) {
      const I = g().input; for (const k of ['up', 'down', 'left', 'right', 'run']) I.down.delete(k);
      for (const d of dirs) I.down.add(d);
      if (run) I.down.add('run');
      g().player.sneak = sneak;
    },
    // caminho em grade (BFS) até o alvo, respeitando colisões do mundo
    route(tx, ty) {
      const G = g(), w = G.world, p = G.player, c = 6, cols = Math.ceil(w.W / c), rows = Math.ceil(w.H / c);
      const free = (i) => { const x = (i % cols) * c + c / 2, y = ((i / cols) | 0) * c + c / 2; if (w.hit(x, y, 4.5)) return false; for (const q of w.near(x, y)) { if (q.off || !q.r) continue; const dx = x - q.x, dy = (y - q.y) * 1.2; if (dx * dx + dy * dy < (q.r + 4.5) ** 2) return false; } return true; };
      const s = Math.floor(p.y / c) * cols + Math.floor(p.x / c), goal = Math.floor(ty / c) * cols + Math.floor(tx / c);
      const prev = new Int32Array(cols * rows).fill(-1); prev[s] = s;
      const q = [s]; let h = 0, found = -1;
      while (h < q.length) { const i = q[h++]; if (i === goal || Math.hypot((i % cols) * c - tx, ((i / cols) | 0) * c - ty) < c) { found = i; break; } const cx = i % cols, cy = (i / cols) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue; const k = ny * cols + nx; if (prev[k] >= 0) continue; if (!free(k)) { prev[k] = -2; continue; } if (dx && dy && (!free(cy * cols + nx) || !free(ny * cols + cx))) continue; prev[k] = i; q.push(k); } if (q.length > 200000) break; }
      if (found < 0) return null;
      const out = []; for (let i = found; i !== s; i = prev[i]) out.push([((i % cols) * c + c / 2) / 16, (((i / cols) | 0) * c + c / 2) / 16]);
      out.reverse();
      return out.filter((_, k) => k % 3 === 2 || k === out.length - 1);
    },
    // segue uma lista de pontos (tiles), achando o caminho entre eles
    async walk(path, opts = {}) {
      let total = { ok: true, i: 0 };
      for (const pt of path) {
        const sub = this.route(px(pt[0]), px(pt[1])) || [pt];
        const r = await this.walkRaw(sub, opts);
        total.i++;
        if (!r.ok) return { ok: false, i: total.i - 1 };
        if (opts.until && opts.until()) return total;
      }
      return total;
    },
    async walkRaw(path, { run = false, sneak = false, max = 60, until = null, tol = 4 } = {}) {
      const G = g(), p = G.player;
      let i = 0;
      const ctrl = () => {
        if (i >= path.length) { this.keys([]); return; }
        const tx = px(path[i][0]), ty = px(path[i][1]);
        const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
        if (d < tol) { i++; return; }
        const dirs = [];
        if (dx > d * 0.38) dirs.push('right'); else if (dx < -d * 0.38) dirs.push('left');
        if (dy > d * 0.38) dirs.push('down'); else if (dy < -d * 0.38) dirs.push('up');
        this.keys(dirs, run, sneak);
      };
      const ok = await this.ff(max, { ctrl, until: () => i >= path.length || (until && until()) });
      this.keys([]);
      return { ok, i };
    },
    // Fase 3: rema a canoa por uma lista de pontos (px), com teclas reais (W/A/D, S para frear)
    async paddle(pts, { max = 120, until = null, slow = null, tol = 18 } = {}) {
      const G = g(), ph = G.phase; let i = 0;
      const ctrl = () => {
        const c = ph.canoe; if (!c || c.state !== 'boarded') { this.keys([]); return; }
        if (i >= pts.length) { this.keys([]); return; }
        const [tx, ty] = pts[i];
        if (Math.hypot(tx - c.x, ty - c.y) < tol) { i++; return; }
        let d = Math.atan2(ty - c.y, tx - c.x) - c.a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        const k = []; if (d > 0.1) k.push('right'); else if (d < -0.1) k.push('left');
        if (slow && slow() && c.speed > 14) k.push('down'); else if (Math.abs(d) < 0.7) k.push('up');
        this.keys(k);
      };
      const ok = await this.ff(max, { ctrl, until: () => i >= pts.length || (until && until()) });
      this.keys([]);
      return { ok, i };
    },
    channelPath(fromS = 0, toS = 1e9, step = 22) {
      const P = g().phase.main, out = [];
      for (let s = fromS; s <= Math.min(toS, P.len); s += step) { const q = P.at(s); out.push([q.x, q.y]); }
      return out;
    },
    state() {
      const G = g(), p = G.player;
      return { st: G.state, x: +(p.x / 16).toFixed(1), y: +(p.y / 16).toFixed(1), hp: Math.round(p.hp), en: Math.round(p.en), done: [...G.done], t: Math.round(G.timeLeft), flags: Object.keys(G.flags).filter((k) => G.flags[k] === true) };
    },
  };
  return T;
})();
