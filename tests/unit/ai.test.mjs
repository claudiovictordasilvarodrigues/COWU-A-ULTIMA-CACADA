import { suite, assert, eq } from '../lib.mjs';
import { makeWorld, makeGame, run } from '../helpers.mjs';
import { Herd, S, TUNE } from '../../js/ai/peccary.js';
import { FlowField } from '../../js/ai/flowfield.js';

function setup({ trees = 40, herdX = 500, leash = 260, ...o } = {}) {
  const w = makeWorld(60, 40);
  for (let i = 0; i < trees; i++) w.addCollider({ x: 100 + (i * 97) % 700, y: 100 + (i * 53) % 450, r: 5 });
  const g = makeGame(w, 120, 320);
  g.wind.a = Math.PI; // vento do bando para o jogador: nada de faro
  const ev = [];
  const h = new Herd(g, { x: herdX, y: 320, leash: { x: herdX, y: 320, r: leash }, ...o, on: { detect: (m, r) => ev.push(['detect', r.key]), chase: () => ev.push(['chase']), giveUp: (m, w2) => ev.push(['giveup', w2]), calm: () => ev.push(['calm']) } });
  for (let i = 0; i < 10; i++) h.add(herdX + (i % 4) * 12 - 18, 300 + ((i / 4) | 0) * 14, { juv: i === 9, sentinel: i === 0 });
  return { w, g, h, ev };
}
const overlapTree = (h, w) => h.members.some((m) => w.colliders.some((c) => c.r && Math.hypot(m.x - c.x, (m.y - c.y) * 1.2) < c.r + m.r - 0.75));

suite('IA dos queixadas', [
  ['bando calmo não percebe jogador parado e longe', () => {
    const { g, h, ev } = setup();
    g.player.setMode('still');
    run(g, [h], 20);
    eq(ev.length, 0, 'eventos:');
    assert(h.members.every((m) => ['IDLE', 'FORAGING', 'WALKING'].includes(m.state)), 'algum animal saiu da calma');
  }],
  ['jogador andando em pé até o bando é percebido e o motivo é informado', () => {
    const { g, h, ev } = setup();
    g.player.setMode('walk');
    run(g, [h], 20, (dt) => { g.player.x += 54 * dt; if (ev.some((e) => e[0] === 'detect')) return false; });
    const d = ev.find((e) => e[0] === 'detect');
    assert(d, 'não detectou');
    assert(['viu', 'ouviu', 'farejou'].includes(d[1]), 'motivo ' + d[1]);
  }],
  ['agachado e escondido a 80 px não é percebido', () => {
    const { g, h, ev } = setup();
    g.player.x = 400; g.player.setMode('still'); g.player.sneak = true; g.player.vis = 0.6 * 0.6 * 0.4; g.player.noise = 0;
    h.moveT = 999;
    run(g, [h], 15);
    assert(!ev.some((e) => e[0] === 'detect'), 'detectou indevidamente');
  }],
  ['barulho de distração: ALERT e depois INVESTIGATE, sem acusar o jogador', () => {
    const { g, h, ev } = setup();
    h.hearNoise(560, 300, 3, 'noise');
    run(g, [h], 0.8);
    assert(h.members.some((m) => m.state === S.ALERT), 'ninguém ficou em ALERT');
    run(g, [h], 3);
    assert(h.members.some((m) => m.state === S.INVESTIGATE), 'ninguém foi investigar');
    assert(!ev.some((e) => e[0] === 'detect'), 'acusou detecção do jogador');
  }],
  ['o aviso se propaga com atraso (não é telepatia)', () => {
    const { g, h } = setup();
    const a = h.members[0];
    a.alertCause = 'player'; a.lastSeen = { x: 400, y: 320 };
    a.enter(S.ALERT);
    h.emit(a, 1);
    const far = h.members.reduce((b, m) => (m !== a && Math.hypot(m.x - a.x, m.y - a.y) > Math.hypot(b.x - a.x, b.y - a.y) ? m : b), h.members[1]);
    run(g, [h], 0.05);
    eq(far.state === S.ALERT, false, 'chegou instantaneamente:');
    run(g, [h], 1.6);
    assert(h.calls.length === 0, 'chamados pendentes');
    assert(h.members.filter((m) => m.state !== S.IDLE && m.state !== S.FORAGING && m.state !== S.WALKING).length >= 3, 'aviso não chegou');
  }],
  ['perto demais: DEFENSIVE (bater de queixo) e depois CHASE', () => {
    const { g, h } = setup();
    g.player.x = 455; g.player.setMode('walk');
    const seen = new Set();
    run(g, [h], 6, () => { for (const m of h.members) seen.add(m.state); });
    assert(seen.has(S.DEFENSIVE), 'não passou por DEFENSIVE');
    assert(seen.has(S.CHASE), 'não passou para CHASE');
    assert(g.sounds.includes('clack'), 'não bateu os dentes');
  }],
  ['fugindo além da coleira, o bando desiste e volta a ficar calmo', () => {
    const { g, h, ev } = setup();
    g.player.x = 455; g.player.setMode('walk');
    run(g, [h], 20, () => { if (h.mode === 'chase') return false; });
    g.player.setMode('run');
    run(g, [h], 12, (dt) => { g.player.x = Math.max(30, g.player.x - 94 * dt); });
    assert(ev.some((e) => e[0] === 'giveup' && e[1] === 'leash'), 'não desistiu pela coleira');
    g.player.setMode('still');
    run(g, [h], 30);
    eq(h.mode, 'calm', 'modo do bando');
    assert(ev.some((e) => e[0] === 'calm'), 'evento de calma');
  }],
  ['perdendo o jogador de vista (escondido), o perseguidor desiste', () => {
    const { g, h, ev } = setup({ leash: 2000 });
    g.player.x = 455; g.player.setMode('walk');
    run(g, [h], 20, () => { if (h.mode === 'chase') return false; });
    g.player.hidden = true;
    run(g, [h], 12);
    assert(ev.some((e) => e[0] === 'giveup' && e[1] === 'lost'), 'não desistiu ao perder o rastro');
  }],
  ['área segura (lajedo): perseguidores param e voltam', () => {
    let safe = false;
    const { g, h, ev } = setup({ leash: 4000, safe: () => safe });
    g.player.x = 455; g.player.setMode('walk');
    run(g, [h], 20, () => { if (h.mode === 'chase') return false; });
    safe = true;
    run(g, [h], 6);
    assert(ev.some((e) => e[0] === 'giveup' && e[1] === 'barrier'), 'não desistiu na área segura');
    assert(h.members.every((m) => m.state !== S.CHASE), 'ainda perseguindo');
  }],
  ['nunca atravessam troncos de árvore, nem perseguindo no meio da mata', () => {
    const { g, h, w } = setup({ trees: 120, leash: 3000 });
    g.player.x = 455; g.player.setMode('walk');
    let bad = 0;
    run(g, [h], 40, (dt, t) => {
      // jogador corre em zigue-zague entre as árvores
      g.player.x = 300 + Math.sin(t * 0.7) * 250; g.player.y = 320 + Math.cos(t * 0.5) * 150;
      if (t > 0.1 && overlapTree(h, w)) bad++; // o 1º quadro pode nascer encostado; o bicho se solta sozinho
    });
    eq(bad, 0, 'quadros com sobreposição:');
  }],
  ['campo de fluxo contorna uma parede', () => {
    const w = makeWorld(40, 30);
    w.addCollider({ x: 300, y: 100, w: 16, h: 280 }); // parede vertical
    const ff = new FlowField(w);
    ff.compute(500, 240, 0);
    const d = ff.dirAt(200, 240);
    assert(d && !d.arrived, 'sem direção');
    assert(Math.abs(d.y) > 0.3, 'deveria desviar para cima ou para baixo da parede, veio ' + JSON.stringify(d));
  }],
  ['mordida só no jogo ativo, com intervalo', () => {
    const { g, h } = setup();
    const m = h.members[0];
    g.player.x = m.x + 6; g.player.y = m.y;
    m.alertCause = 'player'; m.lastSeen = { x: g.player.x, y: g.player.y }; m.lastPerceivedT = 0; m.enter(S.CHASE);
    g.state = 'cutscene';
    m.tryBite({ d: 6 }); eq(g.player.hp, 100, 'mordeu em cena');
    g.state = 'play'; m.biteCd = 0;
    m.tryBite({ d: 6 }); assert(g.player.hp < 100, 'não mordeu');
    const hp = g.player.hp; m.tryBite({ d: 6 }); eq(g.player.hp, hp, 'mordeu sem intervalo');
  }],
  ['estados do enunciado existem na máquina', () => {
    for (const k of ['IDLE', 'FORAGING', 'WALKING', 'ALERT', 'INVESTIGATE', 'DEFENSIVE', 'CHASE', 'RETURN']) assert(S[k] === k, k);
    assert(TUNE.chaseSpeed < 94, 'queixada mais rápido que o jogador correndo: fuga impossível');
  }],
]);
