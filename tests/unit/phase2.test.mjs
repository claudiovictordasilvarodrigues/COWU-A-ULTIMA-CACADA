import { suite, assert, eq } from '../lib.mjs';
import { makePhase2 } from '../helpers.mjs';
import { Save } from '../../js/core/save.js';
import * as D from '../../js/phases/phase2-data.js';
import { circleBlocked } from '../../js/ai/flowfield.js';

function memStore() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }
const px = D.px;

// busca em largura com o raio do jogador: o mapa é atravessável?
function reachable(w, from, extra = () => false) {
  const c = 4, cols = Math.ceil(w.W / c), rows = Math.ceil(w.H / c), seen = new Uint8Array(cols * rows);
  const ok = (i) => { const x = (i % cols) * c + 2, y = ((i / cols) | 0) * c + 2; return !w.hit(x, y, 4) && !circleBlocked(w, x, y, 4) && !extra(x, y); };
  const s = Math.floor(px(from[1]) / c) * cols + Math.floor(px(from[0]) / c), q = [s]; seen[s] = 1;
  while (q.length) { const i = q.pop(), cx = i % cols, cy = (i / cols) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue; const k = ny * cols + nx; if (seen[k]) continue; seen[k] = ok(k) ? 1 : 2; if (seen[k] === 1) q.push(k); } }
  return (pt) => { for (const [dx, dy] of [[0, 0], [6, 0], [-6, 0], [0, 6], [0, -6]]) { const i = Math.floor((px(pt[1]) + dy) / c) * cols + Math.floor((px(pt[0]) + dx) / c); if (seen[i] === 1) return true; } return false; };
}

let base = null;
async function fresh() { Save._useStorage(memStore()); return makePhase2(); }

suite('Fase 2: mapa e travessia', [
  ['o mapa é maior que o da Fase 1 e tem as 5 regiões conectadas', async () => {
    base = await fresh();
    const { g, ph } = base;
    assert(g.world.W * g.world.H > 120 * 110 * 256, 'mapa não é maior que o da Fase 1');
    // com as passagens abertas (bando estudado) e o tronco removido (puzzle resolvido)
    g.done.add('m3'); ph.trunkCol.off = true;
    const r = reachable(g.world, [11, 107.2]);
    g.done.delete('m3'); ph.trunkCol.off = false;
    for (const [n, pt] of [['A', D.SIGNS[0].at], ['B', D.MIRANTE.at], ['C', D.PUZ.lever], ['D', D.CHASE.fork], ['E (lajedo)', D.CHASE.top], ['E (saída)', D.EXIT]]) assert(r(pt), 'região inalcançável: ' + n);
  }],
  ['o tronco grande fecha a grota de verdade (sem atalho)', () => {
    const { g, ph } = base;
    assert(!ph.trunkCol.off, 'tronco deveria bloquear');
    g.done.add('m3');
    const r = reachable(g.world, [11, 107.2]);
    g.done.delete('m3');
    assert(r(D.PUZ.lever), 'deveria alcançar o puzzle');
    assert(!r(D.CHASE.trigger), 'dá para chegar à trilha da fuga sem resolver o puzzle');
  }],
  ['passagens da clareira ficam fechadas antes de estudar o bando', () => {
    const { g, ph } = base;
    assert(ph.gateClosed(), 'deveria estar fechada');
    const r = reachable(g.world, [11, 107.2]);
    assert(!r([77, 65]), 'passou pela passagem fechada');
  }],
  ['o paneiro chega da Fase 1 e os itens usados lá ficam para trás', async () => {
    const { ph } = base;
    const d = ph.carryIn({ carry: { inv: { items: [['facao', 1], ['galhos', 3], ['pilhas', 1]], found: ['caco'] }, res: { water: 3, food: 1, ammo: 4 }, tracks: ['t_tatu'] } });
    const items = new Map(d.inv.items);
    for (const id of ['paneiro', 'espingarda', 'facao', 'cantil', 'lanterna', 'marmita']) assert(items.has(id), 'faltou ' + id);
    assert(!items.has('galhos'), 'galhos deveriam ter ficado na fogueira');
    assert(items.has('pilhas'), 'pilhas perdidas');
    eq(d.res.ammo, 4); eq(d.tracks[0], 't_tatu');
  }],
]);

suite('Fase 2: missões', [
  ['Missão 1 conclui ao examinar 2 sinais diferentes (não 1)', async () => {
    const { g, ph } = await fresh();
    await ph.examineSign(D.SIGNS[0]);
    assert(!g.done.has('m1'), 'concluiu com um sinal');
    await ph.examineSign(D.SIGNS[2]);
    assert(g.done.has('m1'), 'não concluiu');
    eq(ph.currentMission().id, 'm2', 'missão atual');
  }],
  ['Missão 2 conclui só pela interação de observação', async () => {
    const { g, ph } = await fresh();
    g.tpTile(...D.MIRANTE.at);
    g.sim(2);
    assert(!g.done.has('m2'), 'concluiu sem interagir');
    await ph.observeFromMirante();
    assert(g.done.has('m2'), 'não concluiu');
  }],
  ['Missão 3: observando do mirante, o jogador aprende 3 padrões reais do bando', async () => {
    const { g, ph } = await fresh();
    g.flags.crossSeen = true; // já passou da cena da travessia
    g.done.add('m1'); g.done.add('m2');
    g.tpTile(...D.MIRANTE.at);
    g.player.setMode('still'); g.player.sneak = true; g.player.vis = 0.15;
    const ok = g.sim(240, () => g.done.has('m3'));
    assert(ok, 'padrões: ' + Object.keys(g.flags).filter((k) => k.startsWith('pat_')).join(','));
    assert(!ph.dirty, 'foi percebido no mirante');
  }],
  ['Missão 4: detectado → passagem fecha; bando calmo → reabre; travessia limpa conclui (+ Passos Silenciosos)', async () => {
    const { g, ph } = await fresh();
    g.done.add('m1'); g.done.add('m2'); g.done.add('m3');
    assert(!ph.gateClosed(), 'deveria abrir após m3');
    ph.onHerdDetect(ph.herdB, ph.herdB.members[0], { text: 'teste' });
    assert(ph.gateClosed(), 'deveria fechar com o bando em alerta');
    assert(g.alerts.some((a) => a.includes('ALERTA')), 'sem aviso de alerta');
    ph.reachPassage(D.PASSAGES[0]);
    assert(!g.done.has('m4'), 'concluiu detectado');
    ph.onHerdCalm(ph.herdB);
    assert(!ph.gateClosed(), 'não reabriu');
    ph.silentFail = false; ph.silentAttempt = true;
    ph.reachPassage(D.PASSAGES[1]);
    assert(g.done.has('m4') && g.done.has('s_silent'), 'm4/s_silent');
  }],
  ['Passos Silenciosos é opcional: falhar não impede a Missão 4', async () => {
    const { g, ph } = await fresh();
    g.done.add('m3'); ph.silentAttempt = true; ph.silentFail = true;
    ph.reachPassage(D.PASSAGES[0]);
    assert(g.done.has('m4') && !g.done.has('s_silent'), 'opcional deveria ficar pendente');
  }],
  ['Missão 5: o toro só desliza pelo trilho, empurrado por trás', async () => {
    const { g, ph } = await fresh();
    g.done.add('m4');
    const t0 = ph.toroPos();
    // empurrar de lado (para o sul) não move
    g.player.x = t0.x; g.player.y = t0.y - 16; g.player.vx = 0; g.player.vy = 54;
    for (let i = 0; i < 30; i++) ph.updateToro(1 / 30);
    eq(g.flags.toroS || 0, 0, 'moveu de lado:');
    // empurrar para o leste, vindo do oeste, move
    g.player.x = t0.x - 15; g.player.y = t0.y; g.player.vx = 54; g.player.vy = 0;
    for (let i = 0; i < 60; i++) { ph.updateToro(1 / 30); g.player.x = Math.min(g.player.x + 54 / 30, ph.toroPos().x - 14.5); }
    assert(g.flags.toroS > 40, 'não moveu: ' + g.flags.toroS);
    assert(Math.abs(ph.toroPos().y - t0.y) < 0.01, 'saiu do trilho');
  }],
  ['Missão 5: galhos → vara → toro no encaixe → alavanca libera a grota', async () => {
    const { g, ph } = await fresh();
    g.done.add('m4');
    await ph.leverAction();
    assert(!g.flags.trunkMoved, 'alavanca funcionou sem vara e sem apoio');
    await ph.cutTangle();
    assert(g.flags.tangleCut && ph.tangleCol.off, 'emaranhado');
    g.flags.varaTaken = true; g.give('vara');
    g.flags.toroS = ph.railLen(); g.flags.toroPlaced = true; ph.placeToro(g.flags.toroS);
    await ph.leverAction();
    assert(g.flags.trunkMoved && ph.trunkCol.off && g.done.has('m5'), 'tronco não saiu');
  }],
  ['Missão 6: só conta depois que a perseguição começa; o bando avança de verdade', async () => {
    const { g, ph } = await fresh();
    g.done.add('m5'); g.flags.trunkMoved = true; ph.trunkCol.off = true;
    g.tpTile(...D.CHASE.trigger);
    await ph.startChase(false);
    g.sim(2);
    assert(ph.herdD.members.filter((m) => m.state === 'CHASE').length >= 3, 'perseguidores');
    assert(g.alerts.some((a) => a.includes('CORRA')), 'aviso CORRA');
    g.tpTile(...D.CHASE.top);
    await ph.reachLajedo();
    assert(g.done.has('m6'), 'm6');
    g.sim(4);
    assert(ph.herdD.members.every((m) => m.state !== 'CHASE'), 'continuam perseguindo no lajedo');
  }],
  ['Missão 7 precisa dos pelos e das pegadas; Missão 8 só depois da 7', async () => {
    const { g, ph } = await fresh();
    ph.reachExit();
    assert(!g.done.has('m8'), 'saiu sem o rastro');
    await ph.examineHair();
    assert(!g.done.has('m7'), 'm7 com só os pelos');
    await ph.examinePrints();
    assert(g.done.has('m7'), 'm7');
  }],
  ['conclusão: salva o progresso, desbloqueia a Fase 3, mostra o texto da próxima fase', async () => {
    const { g, ph } = await fresh();
    for (const m of ph.missions) g.done.add(m.id);
    g.done.delete('m8');
    ph.reachExit();
    await new Promise((r) => setTimeout(r, 20));
    assert(g.done.has('m8'), 'm8');
    eq(g.state, 'results');
    eq(g.resultsShown.info.code, 'FASE 2 CONCLUÍDA');
    const p = Save.progress();
    assert(p.completed[2] && p.unlocked.includes(3), 'progresso');
    assert(Save.load(2).completed, 'slot da fase marcado como concluído');
  }],
  ['secundárias concedem diário e pontos, sem bloquear a fase', async () => {
    const { g, ph } = await fresh();
    for (const c of D.CLUES.slice(0, 3)) await ph.examineClue(c);
    assert(g.done.has('s_tracker'), 'Rastreador Experiente');
    assert(ph.journal().some((j) => j.title.includes('Rastreador')), 'diário');
    assert(g.flags.score >= 95, 'pontos ' + g.flags.score);
    assert(ph.secondary.every((s) => !ph.missions.includes(s)), 'secundárias separadas das principais');
  }],
]);
