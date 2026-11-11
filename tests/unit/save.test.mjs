import { suite, assert, eq } from '../lib.mjs';
import { Save } from '../../js/core/save.js';

function memStore() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; }

suite('Persistência (save.js)', [
  ['cada fase tem seu slot; a Fase 1 mantém a chave antiga', () => {
    const st = memStore(); Save._useStorage(st);
    Save.write({ phase: 1, done: ['prep'] });
    Save.write({ phase: 2, done: ['m1'] });
    assert(st._m.has('ultimaCacada.save.v1'), 'chave da Fase 1 mudou');
    assert(st._m.has('ultimaCacada.save.p2.v1'), 'slot da Fase 2 ausente');
    eq(Save.load(1).done[0], 'prep'); eq(Save.load(2).done[0], 'm1');
  }],
  ['gravar uma fase em andamento marca a última fase jogada', () => {
    Save._useStorage(memStore());
    Save.write({ phase: 2, done: [] });
    eq(Save.progress().last, 2);
  }],
  ['concluir a Fase 1 desbloqueia a 2 e leva o paneiro', () => {
    Save._useStorage(memStore());
    assert(!Save.isUnlocked(2), 'fase 2 não deveria estar liberada');
    Save.completePhase(1, { carry: { inv: { items: [['facao', 1]] } } });
    assert(Save.isUnlocked(2), 'fase 2 não liberada');
    eq(Save.progress().carry.inv.items[0][0], 'facao');
  }],
  ['save antigo da Fase 1 concluída (antes da Fase 2 existir) é migrado', () => {
    const st = memStore(); Save._useStorage(st);
    st.setItem('ultimaCacada.save.v1', JSON.stringify({ phase: 1, completed: true, tracks: ['t_tatu'], found: ['caco'] }));
    assert(Save.isUnlocked(2), 'migração não liberou a Fase 2');
    eq(Save.progress().carry.tracks[0], 't_tatu');
  }],
  ['recomeçar uma fase não apaga o progresso nem as outras fases', () => {
    Save._useStorage(memStore());
    Save.write({ phase: 2, done: ['m1'] });
    Save.completePhase(1, {});
    Save.clear(1);
    assert(Save.load(2), 'slot da Fase 2 foi apagado');
    assert(Save.isUnlocked(2), 'desbloqueio perdido');
  }],
  ['concluir a Fase 2 desbloqueia a 3 (que não é jogável)', () => {
    Save._useStorage(memStore());
    Save.completePhase(1, {}); Save.completePhase(2, { score: 120 });
    assert(Save.isUnlocked(3), 'fase 3 não desbloqueada');
    eq(Save.progress().completed[2].score, 120);
  }],
  ['armazenamento indisponível não derruba o jogo', () => {
    Save._useStorage({ getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } });
    eq(Save.load(1), null); eq(Save.write({ phase: 1 }), false); assert(Save.progress().unlocked.includes(1));
  }],
]);
