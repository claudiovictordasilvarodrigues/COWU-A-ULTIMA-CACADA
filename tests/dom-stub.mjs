// Canvas/DOM mínimo para rodar a construção das fases no Node (sem navegador).
// Só registra as chamadas; os testes verificam lógica, colisão e progresso, não pixels.
if (typeof globalThis.document === 'undefined') {
  const noop = () => {};
  const grad = { addColorStop: noop };
  const makeCtx = (cv) => new Proxy({ canvas: cv }, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createImageData') return (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
      if (k === 'getImageData') return (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
      return noop;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  class FakeCanvas { constructor() { this.width = 1; this.height = 1; this._ctx = null; } getContext() { return this._ctx || (this._ctx = makeCtx(this)); } }
  globalThis.document = { createElement: (tag) => (tag === 'canvas' ? new FakeCanvas() : {}) };
  globalThis.ImageData = class { constructor(d, w, h) { this.data = d; this.width = w; this.height = h; } };
}
export {};
