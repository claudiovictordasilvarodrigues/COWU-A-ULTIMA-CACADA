// Salvamento em LocalStorage (com tolerância a falhas)
// - Cada fase tem seu próprio "slot" de expedição em andamento (a Fase 1 mantém a chave original).
// - O progresso geral (fases concluídas, desbloqueios, diário, itens levados de uma fase
//   para a outra) fica numa chave separada, para não ser apagado ao recomeçar uma fase.
const KEY = 'ultimaCacada.save.v1';
const SKEY = 'ultimaCacada.settings.v1';
const PKEY = 'ultimaCacada.progress.v1';

let store = null;
function ls() {
  if (store) return store;
  try { return globalThis.localStorage; } catch { return null; }
}
function safeGet(k) { try { return JSON.parse(ls().getItem(k)); } catch { return null; } }
function safeSet(k, v) { try { ls().setItem(k, JSON.stringify(v)); return true; } catch { return false; } }
function safeDel(k) { try { ls().removeItem(k); } catch { /* ignora */ } }

const keyFor = (phase) => (!phase || phase === 1 ? KEY : `ultimaCacada.save.p${phase}.v1`);

function defaultProgress() { return { unlocked: [1], completed: {}, last: 1, carry: null, journal: [] }; }

export const Save = {
  // permite trocar o armazenamento nos testes automatizados
  _useStorage(s) { store = s; },
  keyFor,

  load(phase = 1) { return safeGet(keyFor(phase)); },
  write(data) {
    const ok = safeSet(keyFor(data.phase), { ...data, savedAt: Date.now() });
    if (data.phase && !data.completed) Save.setLast(data.phase);
    return ok;
  },
  clear(phase = 1) { safeDel(keyFor(phase)); },
  clearAll() { for (let i = 1; i <= 9; i++) safeDel(keyFor(i)); safeDel(PKEY); },
  has(phase) {
    if (phase) { const d = safeGet(keyFor(phase)); return !!(d && d.phase); }
    for (let i = 1; i <= 9; i++) { const d = safeGet(keyFor(i)); if (d && d.phase) return true; }
    return false;
  },

  // ---------- progresso entre fases ----------
  progress() {
    const p = Object.assign(defaultProgress(), safeGet(PKEY) || {});
    // migração: um save antigo da Fase 1 concluída desbloqueia a Fase 2
    const p1 = safeGet(KEY);
    if (p1 && p1.completed && !p.completed[1]) {
      p.completed[1] = { at: p1.savedAt || Date.now() };
      if (!p.unlocked.includes(2)) p.unlocked.push(2);
      if (!p.carry) p.carry = { tracks: p1.tracks || [], found: p1.found || [] };
    }
    return p;
  },
  saveProgress(p) { return safeSet(PKEY, p); },
  completePhase(id, info = {}) {
    const p = Save.progress();
    p.completed[id] = { ...(p.completed[id] || {}), ...info, at: Date.now() };
    if (!p.unlocked.includes(id + 1)) p.unlocked.push(id + 1);
    if (info.carry) p.carry = info.carry;
    p.last = id;
    Save.saveProgress(p);
    return p;
  },
  setLast(id) { const p = Save.progress(); if (p.last !== id) { p.last = id; Save.saveProgress(p); } },
  isUnlocked(id) { return id === 1 || Save.progress().unlocked.includes(id); },

  loadSettings() {
    return Object.assign({ master: 0.8, music: 0.5, sfx: 0.85, amb: 0.75, captions: true, markers: true, shake: true, visualSound: true }, safeGet(SKEY) || {});
  },
  saveSettings(s) { safeSet(SKEY, s); },
};
