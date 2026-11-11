import { suite, assert, eq } from '../lib.mjs';
import { makePhase3 } from '../helpers.mjs';
import { Save } from '../../js/core/save.js';
import * as D from '../../js/phases/phase3-data.js';
import { circleBlocked } from '../../js/ai/flowfield.js';
import { TS, CS, PS3 } from '../../js/ai/fauna-varzea.js';

function memStore() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }
const px = D.px;
async function fresh() { Save._useStorage(memStore()); return makePhase3(); }

// busca em largura a pé, com o raio do jogador
function reachable(w, from) {
  const c = 4, cols = Math.ceil(w.W / c), rows = Math.ceil(w.H / c), seen = new Uint8Array(cols * rows);
  const ok = (i) => { const x = (i % cols) * c + 2, y = ((i / cols) | 0) * c + 2; return !w.hit(x, y, 4) && !circleBlocked(w, x, y, 4); };
  const s = Math.floor(px(from[1]) / c) * cols + Math.floor(px(from[0]) / c), q = [s]; seen[s] = 1;
  while (q.length) { const i = q.pop(), cx = i % cols, cy = (i / cols) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue; const k = ny * cols + nx; if (seen[k]) continue; seen[k] = ok(k) ? 1 : 2; if (seen[k] === 1) q.push(k); } }
  return (pt) => { for (const [dx, dy] of [[0, 0], [6, 0], [-6, 0], [0, 6], [0, -6]]) { const i = Math.floor((px(pt[1]) + dy) / c) * cols + Math.floor((px(pt[0]) + dx) / c); if (seen[i] === 1) return true; } return false; };
}
// busca em largura pela água, testando se a canoa cabe (em algum ângulo)
function navigable(c, w, from) {
  const cell = 6, cols = Math.ceil(w.W / cell), rows = Math.ceil(w.H / cell), seen = new Uint8Array(cols * rows);
  const fits = (x, y) => { for (let a = 0; a < Math.PI; a += Math.PI / 8) if (c.free(x, y, a)) return true; return false; };
  const s = Math.floor(px(from[1]) / cell) * cols + Math.floor(px(from[0]) / cell), q = [s]; seen[s] = 1;
  while (q.length) { const i = q.pop(), cx = i % cols, cy = (i / cols) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue; const k = ny * cols + nx; if (seen[k]) continue; seen[k] = fits(nx * cell + 3, ny * cell + 3) ? 1 : 2; if (seen[k] === 1) q.push(k); } }
  return (pt) => { const i = Math.floor(px(pt[1]) / cell) * cols + Math.floor(px(pt[0]) / cell); return [0, 1, -1, cols, -cols].some((d) => seen[i + d] === 1); };
}
// leva a canoa até a água e embarca (sem passar pelas missões anteriores)
async function inCanoe(at = D.CANOE.end, a = 0.6) {
  const r = await fresh(); const { g, ph } = r;
  for (const m of ['m1', 'm2', 'm3', 'm4']) g.done.add(m);
  Object.assign(g.flags, { paddle: true, vines: true, branch: true, launched: true });
  const c = ph.canoe; c.state = 'float'; c.x = px(at[0]); c.y = px(at[1]); c.a = a; ph.canoeCol.off = true;
  await ph.embark();
  return r;
}
const steer = (g, c, tx, ty) => { let d = Math.atan2(ty - c.y, tx - c.x) - c.a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; g.input.down.clear(); if (d > 0.1) g.input.down.add('right'); else if (d < -0.1) g.input.down.add('left'); if (Math.abs(d) < 0.7) g.input.down.add('up'); };

let base = null;
suite('Fase 3: mapa e regiões', [
  ['cinco regiões ligadas: A→B→C a pé; a margem do silêncio (E) só pela água', async () => {
    base = await fresh();
    const { g, ph } = base;
    g.done.add('m2'); ph.tapir.col.off = true; ph.tapir.colOff = true;
    const r = reachable(g.world, D.SPAWN);
    for (const [n, pt] of [['A lama', D.LAMA1], ['B pegadas', D.ANTA_PRINTS], ['B mirante', D.MIRANTE], ['C jirau', D.JIRAU], ['C margem', D.SHORE_PT], ['C capivaras', D.CAPY_HOME]]) assert(r(pt), 'inalcançável a pé: ' + n);
    for (const [n, pt] of [['E margem', D.SAFE_BANK], ['E tapiri', D.TAPIRI], ['D prainha', D.BEACH_D]]) assert(!r(pt), 'deveria exigir a canoa: ' + n);
    const rE = reachable(g.world, D.SAFE_BANK);
    for (const pt of [D.PRINTS_E, D.HAIR_E, D.DIR_SIGN, D.TAPIRI]) assert(rE(pt), 'ponto da Região E isolado');
    g.done.delete('m2'); ph.tapir.col.off = false; ph.tapir.colOff = false;
  }],
  ['canoa vai do lago até a margem segura pela água (canal principal e igapó)', () => {
    const { g, ph } = base;
    const n = navigable(ph.canoe, g.world, D.CANOE.end);
    for (const [k, pt] of [['troncos', D.LOGS_ZONE.b], ['igapó', [116, 25.6]], ['correnteza', D.CURRENT_ZONE.b], ['passagem', D.PASSAGE], ['lagoa', D.TURB], ['margem', [126, 65.6]]]) assert(n(pt), 'canoa não passa: ' + k);
  }],
  ['a anta comendo na garganta fecha a passagem; o desvio pelo aningal abre outro caminho', () => {
    const { g, ph } = base;
    g.done.add('m2');
    eq(ph.tapir.state, TS.FEED); assert(ph.tapir.blocks(px(D.BOTTLENECK[0]), px(D.BOTTLENECK[1]), 20), 'anta fora da garganta');
    assert(!reachable(g.world, D.SPAWN)(D.B_GATE), 'deu para passar pela anta');
    ph.detourCol.off = true;
    assert(reachable(g.world, D.SPAWN)(D.B_GATE), 'o desvio não leva ao outro lado');
    ph.detourCol.off = false; g.done.delete('m2');
  }],
  ['antes de observar a anta, o caminho para o lago fica fechado', () => {
    const { g, ph } = base;
    ph.tapir.col.off = true; ph.tapir.colOff = true; ph.detourCol.off = true;
    assert(!reachable(g.world, D.SPAWN)(D.SHORE_PT), 'chegou ao lago sem a Missão 2');
    ph.tapir.col.off = false; ph.tapir.colOff = false; ph.detourCol.off = true;
  }],
  ['o paneiro chega da Fase 2', async () => {
    const { ph } = base;
    const d = ph.carryIn({ carry: { inv: { items: [['facao', 1], ['vara', 1], ['pelos', 1]], found: ['caco'] }, res: { water: 1, food: 0, ammo: 3 }, tracks: ['t_anta'] } });
    const items = new Map(d.inv.items);
    for (const id of ['paneiro', 'espingarda', 'facao', 'cantil', 'lanterna', 'marmita', 'pelos']) assert(items.has(id), 'faltou ' + id);
    assert(!items.has('vara'), 'a vara ficou na Fase 2');
    eq(d.res.ammo, 3); assert(d.res.food >= 2, 'marmita');
  }],
]);

suite('Fase 3: canoa', [
  ['atolada → presa por cipó e galho → empurrada → boiando → embarcada → desembarcada', async () => {
    const { g, ph } = await fresh();
    const c = ph.canoe, f = g.flags;
    for (const m of ['m1', 'm2', 'm3']) g.done.add(m);
    eq(c.state, 'stuck');
    const a = Math.atan2(ph.railB.y - ph.railA.y, ph.railB.x - ph.railA.x);
    const push = (n) => { g.player.x = c.x - Math.cos(a) * 22; g.player.y = c.y - Math.sin(a) * 22; for (let i = 0; i < n && !f.launched; i++) { g.player.vx = Math.cos(a) * 54; g.player.vy = Math.sin(a) * 54; g.world.moveCircle(g.player, g.player.vx / 30, g.player.vy / 30, 4); g.step(); } };
    push(90);
    eq(f.canoeS || 0, 0, 'mexeu presa por cipós:');
    await ph.examineCanoe(); await ph.cutVines();
    assert(f.vines, 'cipós'); push(90); eq(f.canoeS || 0, 0, 'mexeu com o galho em cima:');
    await ph.removeBranch(); assert(f.branch, 'galho');
    push(600);
    assert(f.launched && c.state === 'float', 'não foi para a água: s=' + f.canoeS);
    g.sim(1.2); assert(g.world.isWater(c.x, c.y) && c.free(), 'canoa não está boiando livre');
    await ph.embark();
    assert(!ph.boarded(), 'embarcou sem remo');
    await ph.takePaddle(); await ph.embark();
    assert(ph.boarded() && g.done.has('m5'), 'embarque / Missão 5');
    assert(!g.entities.includes(g.player) && g.player.locked, 'Caetano deveria estar sentado na canoa');
    // volta para a margem e desembarca
    c.vx = c.vy = 0; c.y = px(D.SHORE_PT[1]); c.a = Math.PI / 2;
    for (c.x = px(D.SHORE_PT[0]); !c.free(); c.x += 2);
    g.step();
    assert(ph.landSpot, 'sem margem para desembarcar perto da terra');
    ph.disembark();
    assert(!ph.boarded() && c.state === 'float' && g.entities.includes(g.player) && !g.player.locked, 'desembarque');
    assert(!g.world.isWater(g.player.x, g.player.y), 'desembarcou na água');
  }],
  ['a canoa acelera e desacelera aos poucos (inércia), sem atravessar pedras', async () => {
    const rk = D.ROCKS_D[1];
    const { g, ph } = await inCanoe();
    const c = ph.canoe, rock = ph.rocks[1];
    const q = ph.main.segPoint(rk[0], rk[1], 0);
    c.x = q.x - 60 * Math.cos(-0.1); c.y = q.y; c.a = Math.atan2(rock.y - c.y, rock.x - c.x); c.unstick();
    g.input.down.add('up');
    const sp = []; let overlap = false;
    for (let i = 0; i < 150; i++) { g.step(); sp.push(c.speed); for (const h of c.circles(c.x, c.y, c.a)) if (Math.hypot(h.x - rock.x, h.y - rock.y) < h.r + rock.r - 0.5) overlap = true; }
    assert(sp[3] < sp[20], 'não acelerou aos poucos');
    assert(!overlap, 'a canoa entrou na pedra');
    g.input.down.clear(); c.x = px(84); c.y = px(47.5); c.a = 0; c.vx = 50; c.vy = 0; c.f = 50;
    g.step(); const v1 = c.speed; g.sim(0.5); const v2 = c.speed;
    assert(v2 > 10 && v2 < v1, 'sem inércia: ' + v1.toFixed(1) + ' → ' + v2.toFixed(1));
  }],
  ['a correnteza empurra, mas dá para subir o trecho mais forte remando', async () => {
    const { g, ph } = await inCanoe();
    const c = ph.canoe, s = ph.main.project(px(135), px(33.6)).s, q = ph.main.at(s);
    c.x = q.x; c.y = q.y; c.a = Math.atan2(q.ty, q.tx); c.unstick();
    const cur = ph.currentAt(c.x, c.y);
    assert(Math.hypot(cur.x, cur.y) > 15, 'correnteza fraca no trecho forte');
    g.sim(3); const back = ph.main.project(c.x, c.y).s;
    assert(back < s - 10, 'parada, a canoa deveria descer com a água');
    c.x = q.x; c.y = q.y; c.a = Math.atan2(q.ty, q.tx); c.vx = c.vy = 0; c.f = c.l = 0;
    const tgt = ph.main.at(s + 120);
    for (let i = 0; i < 300; i++) { steer(g, c, tgt.x, tgt.y); g.step(); }
    assert(ph.main.project(c.x, c.y).s > s + 60, 'não conseguiu subir a correnteza');
  }],
  ['canoa encalhada pode ser recuperada, e o estado é salvo no checkpoint', async () => {
    const { g, ph } = await inCanoe([110, 31.4], -0.3);
    const c = ph.canoe;
    c.stuckT = 3;
    const it = g.interactables.find((i) => (typeof i.label === 'function' ? i.label() : i.label) === 'Desencalhar a canoa');
    assert(it && it.enabled(), 'opção de desencalhar');
    c.x += 5; ph.recoverCanoe(); await new Promise((r) => setTimeout(r, 5));
    assert(c.free() && c.stuckT === 0, 'não recuperou');
    ph.cp('teste');
    const fc = g.flags.canoe;
    assert(fc && fc.state === 'boarded' && Math.abs(fc.x - c.x) < 1, 'estado da canoa não foi para o checkpoint');
  }],
]);

suite('Fase 3: fauna (estados próprios)', [
  ['anta: ALIMENTAR → FAREJAR/ALERTA com barulho → FUGIR → SUMIDA → RETORNAR', async () => {
    const { g, ph } = await fresh();
    const tp = ph.tapir, seen = new Set();
    g.player.x = tp.x - 150; g.player.y = tp.y; g.player.setMode('still');
    g.sim(4, () => { seen.add(tp.state); return false; });
    assert(seen.has(TS.FEED) && !seen.has(TS.FLEE), 'deveria seguir comendo com o jogador quieto e longe');
    g.player.x = tp.x - 70; g.player.setMode('walk');
    g.sim(8, () => { seen.add(tp.state); return tp.state === TS.FLEE; });
    assert(seen.has(TS.SNIFF) || seen.has(TS.ALERT), 'não farejou nem ficou alerta antes');
    g.player.setMode('run'); g.player.x = tp.x - 40;
    g.sim(4, () => tp.state === TS.FLEE);
    eq(tp.state, TS.FLEE, 'estado');
    g.player.setMode('still'); g.player.x = px(20); g.player.y = px(65);
    g.sim(60, () => tp.state === TS.RETURN || tp.state === TS.WALK);
    assert(tp.visible && (tp.state === TS.RETURN || tp.state === TS.WALK), 'não voltou para a rotina: ' + tp.state);
  }],
  ['anta segura a garganta até a Missão 2 e depois segue a rota (com variações)', async () => {
    const { g, ph } = await fresh();
    const tp = ph.tapir; g.player.x = px(20); g.player.y = px(65);
    g.sim(80); assert(tp.blocks(px(D.BOTTLENECK[0]), px(D.BOTTLENECK[1]), 24), 'saiu da garganta antes da hora');
    g.done.add('m2'); ph.tapirRelease = g.time + 2;
    const nodes = new Set(); g.sim(160, () => { nodes.add(tp.i); return false; });
    assert(nodes.size >= 3, 'não percorreu a trilha: ' + [...nodes]);
  }],
  ['capivaras: o aviso passa de uma para outra com atraso, fogem para a água e voltam', async () => {
    const { g, ph } = await fresh();
    const G = ph.capys, m0 = G.members.find((m) => m.state !== CS.SWIM);
    m0.aware = 1.2; m0.state = CS.GRAZE; g.player.x = m0.x - 30; g.player.y = m0.y;
    g.step();
    assert(G.mode === 'flee', 'grupo não entrou em alerta');
    const fleeing = () => G.members.filter((m) => m.state === CS.FLEE).length;
    const first = fleeing();
    assert(first < G.members.length, 'todas fugiram no mesmo instante (telepatia)');
    g.player.x = px(20); g.player.y = px(65); g.player.setMode('still');
    g.sim(3);
    assert(fleeing() + G.members.filter((m) => m.state === CS.SWIM).length > first, 'o aviso não se propagou');
    g.sim(8);
    assert(G.members.filter((m) => m.sub > 0.6).length >= 4, 'não entraram na água');
    g.sim(60, () => G.mode === 'calm');
    eq(G.mode, 'calm', 'grupo');
    g.sim(25);
    assert(G.members.filter((m) => m.sub < 0.4).length >= 3, 'não voltaram para a prainha');
  }],
  ['paca: escondida de dia, sai quando escurece e some no primeiro barulho', async () => {
    const { g, ph } = await fresh();
    const pc = ph.pacas.find((p) => p.id === 'E1');
    g.player.x = px(20); g.player.y = px(65); g.darkness = 0;
    g.sim(40); assert(!pc.visible, 'paca da margem saiu em plena tarde');
    g.darkness = 0.55;
    g.sim(60, () => pc.visible); assert(pc.visible, 'não saiu ao escurecer');
    g.player.x = pc.x - 50; g.player.y = pc.y; g.player.setMode('run');
    g.sim(4, () => !pc.visible || pc.state === PS3.FLEE);
    assert(pc.state === PS3.FLEE || !pc.visible, 'não fugiu do barulho');
  }],
  ['as três espécies têm máquinas de estado diferentes', () => {
    const t = new Set(Object.values(TS)), c = new Set(Object.values(CS)), p = new Set(Object.values(PS3));
    assert(c.has('NADAR') && c.has('ENTRAR_AGUA') && !t.has('NADAR'), 'capivara');
    assert(t.has('FAREJAR') && t.has('RETORNAR') && !c.has('FAREJAR'), 'anta');
    assert(p.has('ESCONDIDA') && p.has('MERGULHAR') && !t.has('ESCONDIDA'), 'paca');
  }],
]);

suite('Fase 3: missões', [
  ['Missão 1 precisa das três tarefas (trilha, lama, marcas)', async () => {
    const { g, ph } = await fresh();
    await ph.examineMud(); await ph.examineSign(D.SIGNS_A[0]);
    assert(!g.done.has('m1'), 'concluiu sem seguir a trilha');
    g.tpTile(17.4, 65.6); g.sim(0.2);
    assert(g.done.has('m1'), 'não concluiu');
    eq(ph.currentMission().id, 'm2');
  }],
  ['Missão 2: pegadas → seguir → observar de longe, sem espantar', async () => {
    const { g, ph } = await fresh();
    g.done.add('m1');
    await ph.examineTapirPrints();
    g.tpTile(50, 49); g.sim(0.2); assert(g.flags.m2_follow, 'seguir a trilha');
    g.tpTile(D.BOTTLENECK[0] - 2, D.BOTTLENECK[1] + 0.6); g.player.setMode('still');
    await ph.observeTapir(); assert(!g.done.has('m2'), 'observou de perto demais');
    g.tpTile(...D.MIRANTE); ph.tapir.aware = 0;
    await ph.observeTapir();
    assert(g.done.has('m2') && g.flags.obs_anta, 'Missão 2 / observação da anta');
  }],
  ['Missão 3 só conclui do outro lado, depois da Missão 2', async () => {
    const { g, ph } = await fresh();
    g.tpTile(...D.B_GATE); g.sim(0.2); assert(!g.done.has('m3'), 'concluiu sem a Missão 2');
    g.done.add('m2'); g.tpTile(D.B_GATE[0] - 6, D.B_GATE[1]); g.sim(0.2); g.tpTile(...D.B_GATE); g.sim(0.2);
    assert(g.done.has('m3'), 'não concluiu');
  }],
  ['Missões 4 e 5: grupo, margem, canoa; remo, cipós, galho, empurrão e embarque', async () => {
    const { g, ph } = await fresh();
    for (const m of ['m1', 'm2', 'm3']) g.done.add(m);
    g.tpTile(...D.SHORE_PT); g.sim(0.2);
    const c = ph.capys.members[0]; g.player.x = c.x - 120; g.player.y = c.y - 10; g.player.setMode('still'); g.sim(0.2);
    await ph.examineCanoe();
    assert(g.done.has('m4'), 'Missão 4: ' + ['m4_group', 'm4_shore', 'm4_canoe'].map((k) => g.flags[k]));
    await ph.takePaddle(); await ph.cutVines(); await ph.removeBranch();
    eq(ph.missions.find((m) => m.id === 'm5').progress(), '3/4');
  }],
  ['Missão 6 e Remador Experiente: bater falha a tentativa, trecho limpo conclui', async () => {
    const { g, ph } = await inCanoe([105, 34], -0.4);
    const c = ph.canoe;
    c.x = px(D.LOGS_ZONE.a[0]); c.y = px(D.LOGS_ZONE.a[1]); c.unstick(); g.step();
    assert(ph.rowAttempt, 'tentativa não começou');
    ph.onCanoeHit('rock', 0.5);
    assert(ph.rowFail, 'batida não falhou a tentativa');
    c.x = px(D.LOGS_ZONE.b[0]) + 4; c.y = px(D.LOGS_ZONE.b[1]); c.unstick(); g.step();
    assert(g.flags.m6_logs && !g.done.has('s_rem'), 'troncos / secundária indevida');
    c.x = px(D.LOGS_ZONE.a[0]); c.y = px(D.LOGS_ZONE.a[1]); c.unstick(); g.step(); g.step();
    assert(ph.rowAttempt && !ph.rowFail, 'nova tentativa');
    c.x = px(D.LOGS_ZONE.b[0]) + 4; c.y = px(D.LOGS_ZONE.b[1]); c.unstick(); g.step();
    assert(g.done.has('s_rem'), 'Remador Experiente');
    c.x = px(D.PASSAGE[0]); c.y = px(D.PASSAGE[1]); c.unstick(); g.step();
    assert(g.done.has('m6'), 'Missão 6');
  }],
  ['Missão 7: o evento pode falhar (canoa vira) e pode ser vencido', async () => {
    const { g, ph } = await inCanoe([141.8, 52], 1.6);
    g.done.add('m6');
    g.step();
    assert(ph.ev && ph.ev.stage === 'silence', 'silêncio não começou');
    g.sim(8, () => g.flags.m7_waves);
    assert(g.flags.m7_waves, 'as ondas não passaram pela canoa');
    ph.strike(); assert(ph.ev.stage === 'strike', 'golpe');
    ph.instab = 99; g.sim(1);
    eq(g.state, 'fail', 'virar a canoa deveria falhar');
    // nova tentativa: chega à margem a tempo
    const r2 = await inCanoe([141.8, 52], 1.6); const g2 = r2.g, ph2 = r2.ph;
    g2.done.add('m6'); g2.step(); g2.flags.m7_waves = true; ph2.strike();
    g2.sim(2.2);
    ph2.canoe.x = px(D.SAFE_BANK[0]) + 14; ph2.canoe.y = px(D.SAFE_BANK[1]); ph2.canoe.unstick(); g2.step();
    await new Promise((r) => setTimeout(r, 5));
    assert(g2.flags.m7_escape && !ph2.boarded(), 'fuga até a margem');
    await ph2.examineMark();
    assert(g2.done.has('m7') && g2.flags.rainOn, 'Missão 7 / chuva');
  }],
  ['Missão 8: a direção errada não conta; a certa conclui', async () => {
    const { g, ph } = await fresh();
    Object.assign(g.flags, { m7_escape: true, m8_land: true });
    await ph.examinePrintsE(); await ph.examineHairE();
    g.choice = async () => 0; await ph.examineDirection();
    assert(!g.flags.m8_dir, 'direção errada aceita');
    g.choice = async () => D.DIR_RIGHT; await ph.examineDirection();
    assert(g.done.has('m8'), 'Missão 8');
  }],
  ['Missão 9: abrigo conclui a fase, salva e desbloqueia só a Fase 4', async () => {
    const { g, ph } = await fresh();
    for (const m of ph.missions) g.done.add(m.id);
    g.done.delete('m9');
    g.tpTile(...D.TAPIRI); g.sim(0.1);
    await new Promise((r) => setTimeout(r, 30));
    assert(g.done.has('m9'), 'm9'); eq(g.state, 'results');
    eq(g.resultsShown.info.code, 'FASE 3 CONCLUÍDA');
    const p = Save.progress();
    assert(p.completed[3] && p.unlocked.includes(4), 'progresso');
    assert(Save.load(3).completed, 'slot da Fase 3');
  }],
  ['secundárias são opcionais e dão diário e pontos', async () => {
    const { g, ph } = await fresh();
    for (const c of D.CLUES.slice(0, 4)) await ph.examineClue(c);
    assert(g.done.has('s_rastro'), 'Rastreador das Margens');
    Object.assign(g.flags, { obs_anta: true, obs_capi: true }); ph.checkNat(); assert(!g.done.has('s_nat'), 'Naturalista com 2 de 3');
    g.flags.obs_paca = true; ph.checkNat(); assert(g.done.has('s_nat'), 'Naturalista');
    assert(ph.journal().some((j) => j.title.includes('Naturalista')) && g.flags.score > 100, 'diário/pontos');
    assert(ph.secondary.every((s) => !ph.missions.includes(s)) && ph.missions.length === 9, '9 principais, secundárias separadas');
  }],
]);
