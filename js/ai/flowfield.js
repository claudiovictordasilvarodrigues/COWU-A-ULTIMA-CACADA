// Campo de fluxo (busca em largura numa grade de 8 px) para os animais contornarem
// árvores, troncos e pedras em vez de tentar atravessá-los.
// A grade de "pisável" é calculada sob demanda com as mesmas colisões do mundo.

const N8 = [[1, 0, 10], [-1, 0, 10], [0, 1, 10], [0, -1, 10], [1, 1, 14], [1, -1, 14], [-1, 1, 14], [-1, -1, 14]];

export function circleBlocked(world, x, y, r) {
  for (const c of world.near(x, y)) {
    if (c.off || !c.r) continue;
    const dx = x - c.x, dy = (y - c.y) * 1.2, m = r + c.r;
    if (dx * dx + dy * dy < m * m) return true;
  }
  return false;
}

export class FlowField {
  constructor(world, { cell = 8, agentR = 4, blocked = null, maxCells = 9000 } = {}) {
    this.w = world; this.cell = cell; this.agentR = agentR; this.blocked = blocked; this.maxCells = maxCells;
    this.cols = Math.ceil(world.W / cell); this.rows = Math.ceil(world.H / cell);
    const n = this.cols * this.rows;
    this.mask = new Uint8Array(n); // 0 = desconhecido, 1 = livre, 2 = bloqueado
    this.dist = new Uint32Array(n).fill(0xffffffff);
    this.touched = [];
    this.tx = -1; this.ty = -1; this.t = -1e9;
  }

  invalidate() { this.mask.fill(0); this.tx = this.ty = -1; }

  free(i) {
    let m = this.mask[i];
    if (!m) {
      const cx = (i % this.cols) * this.cell + this.cell / 2, cy = ((i / this.cols) | 0) * this.cell + this.cell / 2;
      const r = this.agentR;
      const bad = this.w.hit(cx, cy, r) || circleBlocked(this.w, cx, cy, r) || (this.blocked && this.blocked(cx, cy));
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
    // se o alvo está numa célula bloqueada (encostado num tronco), usa a livre mais próxima
    if (!this.free(start)) {
      const sc = start % this.cols, sr = (start / this.cols) | 0;
      let found = -1;
      for (let rad = 1; rad <= 3 && found < 0; rad++)
        for (let j = -rad; j <= rad && found < 0; j++) for (let i = -rad; i <= rad; i++) {
          const c = sc + i, r = sr + j;
          if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
          const k = r * this.cols + c;
          if (this.free(k)) { found = k; break; }
        }
      if (found < 0) return false;
      start = found;
    }
    for (const i of this.touched) this.dist[i] = 0xffffffff;
    this.touched.length = 0;
    // Dijkstra simplificado com fila de baldes (custos 10/14)
    const buckets = new Map();
    const push = (i, d) => { let b = buckets.get(d); if (!b) buckets.set(d, (b = [])); b.push(i); };
    this.dist[start] = 0; this.touched.push(start); push(start, 0);
    let d = 0, count = 0, pending = 1;
    const cols = this.cols, rows = this.rows;
    while (pending > 0 && count < this.maxCells) {
      const b = buckets.get(d);
      if (!b || !b.length) { buckets.delete(d); d++; continue; }
      const i = b.pop(); pending--;
      if (this.dist[i] !== d) continue;
      count++;
      const c = i % cols, r = (i / cols) | 0;
      for (const [dx, dy, cost] of N8) {
        const nc = c + dx, nr = r + dy;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const k = nr * cols + nc;
        if (!this.free(k)) continue;
        // diagonal sem cortar quina de obstáculo
        if (dx && dy && (!this.free(r * cols + nc) || !this.free(nr * cols + c))) continue;
        const nd = d + cost;
        if (nd < this.dist[k]) {
          if (this.dist[k] === 0xffffffff) this.touched.push(k);
          this.dist[k] = nd; push(k, nd); pending++;
        }
      }
    }
    this.tCell = this.cellOf(x, y); this.t = now;
    return true;
  }

  distAt(x, y) { const i = this.cellOf(x, y); return i < 0 ? Infinity : this.dist[i] === 0xffffffff ? Infinity : this.dist[i]; }

  // direção (unitária) para descer o campo a partir de (x, y); null se fora do alcance
  dirAt(x, y) {
    const i = this.cellOf(x, y);
    if (i < 0) return null;
    const cols = this.cols, c = i % cols, r = (i / cols) | 0;
    let here = this.dist[i];
    let best = -1, bd = here;
    for (const [dx, dy] of N8) {
      const nc = c + dx, nr = r + dy;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= this.rows) continue;
      const k = nr * cols + nc;
      if (this.dist[k] < bd) { bd = this.dist[k]; best = k; }
    }
    if (best < 0) return here === 0 ? { x: 0, y: 0, arrived: true } : null;
    const tx = (best % cols) * this.cell + this.cell / 2, ty = ((best / cols) | 0) * this.cell + this.cell / 2;
    const vx = tx - x, vy = ty - y, m = Math.hypot(vx, vy) || 1;
    return { x: vx / m, y: vy / m, arrived: false };
  }
}
