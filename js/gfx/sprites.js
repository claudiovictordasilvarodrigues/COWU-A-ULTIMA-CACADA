// Registro central de sprites.
// Todo sprite é pedido por uma chave. Se existir um PNG registrado para a chave
// (via assets/sprites.json), ele substitui o sprite procedural automaticamente.
const cache = new Map();
const overrides = new Map();

export const Sprites = {
  get(key, gen) {
    const o = overrides.get(key);
    if (o) return o;
    let c = cache.get(key);
    if (!c) { c = gen(); cache.set(key, c); }
    return c;
  },
  override(key, img) { overrides.set(key, img); },
  // Manifesto opcional: { "chave": "assets/arquivo.png", ... }
  async loadManifest(url = 'assets/sprites.json') {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) return 0;
      const m = await r.json();
      const jobs = Object.entries(m).map(([k, src]) => new Promise((res) => {
        const img = new Image();
        img.onload = () => { overrides.set(k, img); res(); };
        img.onerror = () => res();
        img.src = src;
      }));
      await Promise.all(jobs);
      return jobs.length;
    } catch { return 0; }
  },
  get size() { return cache.size; },
};
