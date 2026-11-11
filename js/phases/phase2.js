// FASE 2 — O CAMINHO DOS QUEIXADAS
// Floresta de terra firme pela manhã: trilha de entrada, clareira do bando, mata dos troncos
// caídos, trilha da fuga e o rastro vermelho.
import { mulberry32, fbm, valueNoise, clamp, dist, hash2, formatTime } from '../core/util.js';
import { World, T } from '../engine/world.js';
import { Sprites } from '../gfx/sprites.js';
import { makeCanvas } from '../gfx/pixel.js';
import * as N from '../gfx/art-nature.js';
import * as PR from '../gfx/art-props.js';
import * as F2 from '../gfx/art-forest2.js';
import { tapirSprite } from '../gfx/art-peccary.js';
import { flipCanvas } from '../gfx/pixel.js';
import { Animal, MonkeyTroop, Flyovers, Butterfly } from '../entities/animals.js';
import { Herd, S as PS, isCalm } from '../ai/peccary.js';
import { circleBlocked } from '../ai/flowfield.js';
import { Save } from '../core/save.js';
import { TRACKS as TRACKS1 } from './phase1.js';
import * as D from './phase2-data.js';

const { TW, TH, S, px } = D;
const P = (a) => ({ x: px(a[0]), y: px(a[1]) });
const inEll = (x, y, e, k = 1) => ((x - e.x) / (e.rx * k)) ** 2 + ((y - e.y) / (e.ry * k)) ** 2;
const EQUIP = ['paneiro', 'espingarda', 'facao', 'cantil', 'lanterna', 'marmita'];

export function createPhase2(g) { return new Phase2(g); }

export class Phase2 {
  constructor(g) {
    this.g = g;
    this.id = 2; this.code = 'FASE 2'; this.title = 'O CAMINHO DOS QUEIXADAS'; this.displayTitle = 'O Caminho dos Queixadas';
    this.timeLimit = 40 * 60;
    this.todStart = 452;
    this.spawn = P([11, 107.2]);
    this.menuPath = [P([54, 90]), P([78, 95])];
    this.trackDefs = TRACKS1;
    this.covers = []; this.coverGrid = new Map();
    this.occBushes = [];
    this.herds = [];
    this.pois = [
      { name: 'Primeiro acampamento', ...P([10, 108]) }, { name: 'Trilha de entrada', ...P([28, 99]) },
      { name: 'Clareira do bando', ...P([66, 92]) }, { name: 'Mirante', ...P(D.MIRANTE.at) },
      { name: 'Passagem do norte', ...P(D.PASSAGES[0].at) }, { name: 'Passagem das pedras', ...P(D.PASSAGES[1].at) },
      { name: 'Mata dos troncos caídos', ...P([89, 61]) }, { name: 'Barreiro da anta', ...P([80, 48]) },
      { name: 'Grota do tronco', ...P(D.PUZ.trunk) }, { name: 'Trilha da fuga', ...P([136, 60]) },
      { name: 'Bifurcação', ...P(D.CHASE.fork) }, { name: 'Tronco-ponte', ...P([134, 97.5]) },
      { name: 'Lajedo', ...P(D.CHASE.top) }, { name: 'O rastro vermelho', ...P(D.HAIR) }, { name: 'Segundo acampamento', ...P(D.EXIT) },
    ];
    this.buildMissions();
  }

  // ================= missões =================
  buildMissions() {
    const g = this.g, f = () => g.flags, d = (id) => g.done.has(id);
    const nearestOf = (list, has) => {
      let best = null, bd = 1e9;
      for (const it of list) { if (has(it)) continue; const p = P(it.at); const dd = g.player ? dist(p.x, p.y, g.player.x, g.player.y) : 0; if (dd < bd) { bd = dd; best = p; } }
      return best;
    };
    const signsDone = () => D.SIGNS.filter((s) => f()['sign_' + s.id]).length;
    const patDone = () => Object.keys(D.PATTERNS).filter((k) => f()['pat_' + k]).length;
    const cluesDone = () => D.CLUES.filter((c) => f()[c.id]).length;
    this.count = { signsDone, patDone, cluesDone };
    this.missions = [
      { id: 'm1', title: 'Investigar os barulhos', progress: () => `${Math.min(2, signsDone())}/2`, hint: 'Siga a trilha para o leste. Sinais da passagem de animais brilham de leve quando você chega perto: solo revolvido, raízes quebradas, pegadas, troncos esfregados. Examine dois sinais diferentes com E.', target: () => nearestOf(D.SIGNS, (s) => f()['sign_' + s.id]) },
      { id: 'm2', title: 'Localizar o bando', hint: 'A trilha termina numa clareira grande. Na beira oeste há uma sapopema alta, escondida entre moitas: um ponto seguro para observar. Chegue agachado (C) e aperte E.', target: () => P(D.MIRANTE.at) },
      { id: 'm3', title: 'Estudar os animais', progress: () => `${Math.min(3, patDone())}/3`, hint: () => this.studyHint(), target: () => (g.player && dist(g.player.x, g.player.y, px(66), px(92)) < px(24) ? null : P(D.MIRANTE.at)) },
      { id: 'm4', title: 'Atravessar sem ser percebido', failed: () => !!this.dirty, hint: () => (this.dirty ? 'O bando percebeu você. Afaste-se (para fora da clareira) ou fique agachado numa moita até eles se acalmarem, e tente de novo. A passagem fica perigosa enquanto o bando estiver em alerta.' : 'Chegue a uma das passagens do outro lado: a do norte ou a das pedras, a nordeste. Ande agachado (C), use pedras, troncos e moitas para quebrar a linha de visão e não deixe o vento levar seu cheiro até eles. Você pode distrair o bando: sacudir o cipó do buritizeiro (sudoeste) ou rolar uma pedra solta (nordeste).'), target: () => nearestOf(D.PASSAGES, () => false) },
      {
        id: 'm5', title: 'Liberar o caminho',
        progress: () => `${[f().tangleCut, f().varaTaken, f().toroPlaced].filter(Boolean).length}/3`,
        hint: () => this.puzzleHint(),
        target: () => {
          if (!f().tangleCut) return P(D.PUZ.tangle);
          if (!g.inv.has('vara') && !f().trunkMoved) return P(D.PUZ.pole);
          if (!f().toroPlaced) { const t = this.toroPos(); const r = D.PUZ.rail; const s = f().toroS || 0; const L1 = (r[1][0] - r[0][0]) * S; return s < L1 - 1 ? { x: t.x - 18, y: t.y } : { x: t.x, y: t.y + 18 }; }
          return P(D.PUZ.lever);
        },
      },
      { id: 'm6', title: 'Sobreviver à investida', hint: () => (f().chaseStarted ? 'Corra (Shift) pela trilha para o sul. Desvie das árvores e raízes, cuidado com a lama. Na bifurcação, a direita é mais curta mas tem tucum; a esquerda é mais longa e limpa. Atravesse o tronco sobre a grota e suba no lajedo de pedra: lá o bando não sobe. Espaço esquiva das mordidas.' : 'Siga a trilha estreita para o sul, depois da grota do tronco. Fique atento.'), target: () => (f().chaseStarted ? P(D.CHASE.top) : P(D.CHASE.trigger)) },
      { id: 'm7', title: 'Encontrar o rastro vermelho', progress: () => `${(f().hair ? 1 : 0) + (f().prints ? 1 : 0)}/2`, hint: 'Desça do lajedo para a mata mais aberta ao sul. Procure pelos avermelhados presos num arbusto e examine as pegadas do veado no chão. As marcas brilham quando você chega perto.', target: () => (!f().hair ? P(D.HAIR) : !f().prints ? P(D.DEER_PRINTS_E) : null) },
      { id: 'm8', title: 'Alcançar o segundo acampamento', hint: 'Siga as pegadas do veado para o oeste, até onde a mata se abre perto da água.', target: () => P(D.EXIT) },
    ];
    this.secondary = [
      { id: 's_anta', title: 'Observador da Floresta', hint: 'Há uma anta no barreiro a noroeste da mata dos troncos caídos. Observe-a de longe (aperte E a mais de 4 metros), agachado e sem deixar o vento levar seu cheiro.', target: () => null },
      { id: 's_silent', title: 'Passos Silenciosos', failed: () => !!this.silentFail && !g.done.has('m4'), hint: 'Atravesse a clareira até uma passagem sem que nenhum queixada fique desconfiado de você (nenhum "?" amarelo por sua causa). Se falhar, volte para a trilha de entrada e tente de novo.', target: () => null },
      { id: 's_tracker', title: 'Rastreador Experiente', progress: () => `${Math.min(3, cluesDone())}/3`, hint: 'O veado deixou outras marcas pelo caminho, fora da trilha principal: brotos mordiscados, uma cama de capim, pegadas no barro, fezes. Procure com calma.', target: () => null },
    ];
  }
  currentMission() { return this.missions.find((m) => !this.g.done.has(m.id)) || null; }
  todCap() { const n = this.missions.filter((m) => this.g.done.has(m.id)).length; return 458 + n * 12; }

  studyHint() {
    const f = this.g.flags, found = Object.keys(D.PATTERNS).filter((k) => f['pat_' + k]).map((k) => D.PATTERNS[k].name.toLowerCase());
    return 'Fique escondido perto do bando (moitas, troncos, pedras) e observe com calma: um círculo aparece sobre o animal enquanto você estuda o que ele faz. Repare em como comem, em quem vigia, em como mudam de lugar e no que fazem quando estranham um barulho.' + (found.length ? ` <br><b>Já notou:</b> ${found.join('; ')}.` : '');
  }
  puzzleHint() {
    const f = this.g.flags;
    if (!f.tangleCut) return 'Um tronco enorme fecha a grota ao norte. Para movê-lo vai precisar de uma alavanca. Comece cortando o emaranhado de galhos na beira do pátio (oeste da grota) com o facão.';
    if (!this.g.inv.has('vara') && !f.trunkMoved) return 'Debaixo dos galhos havia uma vara de pau-ferro. Pegue a vara.';
    if (!f.toroPlaced) return 'A vara precisa de um apoio. Empurre o toro (tronco curto) andando contra ele: primeiro para o leste, até ficar alinhado com a grota; depois para o norte, até encostar no tronco grande.';
    return 'Com o toro de apoio encostado no tronco, use a vara como alavanca (E junto ao toro).';
  }

  // ================= construção estática =================
  async buildStatic(progress) {
    const w = (this.world = new World(TW, TH));
    await progress(0.08, 'Abrindo trilhas de bicho…');
    const cw = w.cw, ch = w.ch;
    const core = new Float32Array(cw * ch), band = new Float32Array(cw * ch);
    const nearT = new Float32Array(TW * TH);
    for (const tr of D.TRAILS) {
      for (let i = 0; i < tr.pts.length - 1; i++) {
        const [ax, ay] = tr.pts[i], [bx, by] = tr.pts[i + 1];
        const L = Math.hypot(bx - ax, by - ay), n = Math.ceil(L / 0.25);
        for (let k = 0; k <= n; k++) {
          const t = k / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
          const R = tr.r * 8, RB = (tr.r + tr.band) * 8;
          const c0x = Math.floor(x * 8 - RB), c1x = Math.ceil(x * 8 + RB), c0y = Math.floor(y * 8 - RB), c1y = Math.ceil(y * 8 + RB);
          for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
            if (cx < 0 || cy < 0 || cx >= cw || cy >= ch) continue;
            const dd = Math.hypot(cx + 0.5 - x * 8, cy + 0.5 - y * 8);
            const i2 = cy * cw + cx;
            if (dd < R) { const v = 1 - dd / R; if (v > core[i2]) core[i2] = v; }
            if (dd < RB) { const v = 1 - dd / RB; if (v > band[i2]) band[i2] = v; }
          }
          const RT = tr.r + 1.2;
          for (let ty = Math.floor(y - RT); ty <= Math.ceil(y + RT); ty++) for (let tx = Math.floor(x - RT); tx <= Math.ceil(x + RT); tx++) {
            if (tx < 0 || ty < 0 || tx >= TW || ty >= TH) continue;
            const dd = Math.hypot(tx + 0.5 - x, ty + 0.5 - y) / RT;
            if (dd < 1) nearT[ty * TW + tx] = Math.max(nearT[ty * TW + tx], 1 - dd);
          }
        }
      }
    }
    this.nearTrail = (tx, ty) => nearT[(ty | 0) * TW + (tx | 0)] || 0;
    await progress(0.16, 'Fechando a mata…');
    const G = D.GORGE, L = D.LAJEDO, V = D.VARZEA;
    w.generate((tx, ty) => {
      const n = fbm(tx * 0.15, ty * 0.15, 3, 3), n2 = valueNoise(tx * 0.6, ty * 0.6, 8);
      const ci = Math.floor(ty * 8) * cw + Math.floor(tx * 8);
      // várzea ao fundo
      const ev = inEll(tx, ty, V) + (fbm(tx * 0.35, ty * 0.35, 19, 2) - 0.5) * 0.9;
      if (ev < 1) return [T.CREEK, clamp((1 - ev) * 1.6, 0, 1)];
      if (ev < 1.5 && ty > 106) return [T.MUD];
      // grota com o tronco-ponte
      if (ty > D.GULLY.y0 + (n - 0.5) * 0.5 && ty < D.GULLY.y1 + (n2 - 0.5) * 0.3 && tx > D.GULLY.x0) return [T.GULLY, clamp(1 - Math.abs(ty - (D.GULLY.y0 + D.GULLY.y1) / 2) / 2, 0, 1)];
      // grota do tronco: paredes de pedra e a vala a oeste
      if (ty > G.y0 && ty < G.y1) {
        const ax = Math.abs(tx - G.x);
        if (tx > G.ditch.x0 && tx < G.ditch.x1 && ty < G.ditch.y1) return [T.GULLY, 0.6];
        if (ax <= G.half) return [T.DIRT];
        if (ax < G.wall + (n - 0.5) * 3 && ty > G.y0 + (n2 - 0.5) * 0.8 && ty < G.y1 - 0.2 + (n - 0.5) * 1.2) return [T.ROCK];
        if (ax < G.half + 1.2) return [T.ROCK];
      }
      // lajedo (pedra alta) e degraus
      if (inEll(tx, ty, L) < 1 + (n - 0.5) * 0.15 || (Math.abs(tx - D.BRIDGE.x) < 2 && ty > 99.4 && ty < 101.4)) return [T.STONE];
      const inArea = D.AREAS.find((a) => inEll(tx, ty, a) < 1 + (n - 0.5) * 0.35);
      const walk = band[ci] > 0.02 || inArea;
      if (!walk) return [T.THICKET];
      if (inEll(tx, ty, { x: D.POND.x, y: D.POND.y, rx: D.POND.r, ry: D.POND.r * 0.8 }) < 1) return [T.CREEK, 0.5];
      const tf = core[ci];
      const mudD = tx > D.MUD_D.x0 && tx < D.MUD_D.x1 && ty > D.MUD_D.y0 + (n - 0.5) && ty < D.MUD_D.y1 + (n2 - 0.5);
      if (mudD) return [T.MUD];
      if (inArea && inArea.t === 'mud') return [T.MUD];
      if (inEll(tx, ty, { x: 70, y: 96.2, rx: 3.4, ry: 2 }) < 1 + (n - 0.5) * 0.6) return [T.MUD];
      if (tf > 0.42 + (n2 - 0.5) * 0.3) return [T.DIRT];
      if (inArea && inArea.t === 'clear') return [T.CLEAR];
      if (inArea && inArea.t === 'meadow') return [n > 0.5 ? T.GRASS : T.FLOOR];
      return [T.FLOOR];
    });
    w.waterTiles = new Uint8Array(TW * TH);
    for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) {
      const t = w.terrainAt(tx * 16 + 8, ty * 16 + 8);
      w.waterTiles[ty * TW + tx] = t === T.RIVER ? 1 : t === T.CREEK ? 2 : 0;
    }
    await progress(0.32, 'Plantando a floresta…');
    this.placeVegetation();
    await progress(0.55, 'Derrubando troncos…');
    this.placeProps();
    await progress(0.68, 'Espalhando folhas e pegadas…');
    const gctx = w.renderGround();
    this.decorateGround(gctx);
    await progress(0.9, 'Desenhando o mapa…');
    w.buildDensityCanvas();
    w.buildMiniMap();
    Sprites.get('icon:vara', () => F2.icon2('vara'));
    Sprites.get('icon:pelos', () => F2.icon2('pelos'));
    await progress(0.98, 'Quase lá…');
  }

  addCover(x, y, r, occ = true) {
    const c = { x, y, r };
    this.covers.push(c);
    const k = ((x / 64) | 0) + ',' + ((y / 64) | 0);
    if (!this.coverGrid.has(k)) this.coverGrid.set(k, []);
    this.coverGrid.get(k).push(c);
    if (occ) this.occBushes.push(c);
  }
  isInCover(x, y) {
    const gx = (x / 64) | 0, gy = (y / 64) | 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const a = this.coverGrid.get((gx + i) + ',' + (gy + j));
      if (a) for (const c of a) if ((x - c.x) ** 2 + ((y - c.y) * 1.4) ** 2 < c.r * c.r) return true;
    }
    return false;
  }
  // moitas de esconderijo bloqueiam a visão quando o jogador está agachado
  occludes(x, y, crouched) {
    if (!crouched) return false;
    for (const c of this.occBushes) if ((x - c.x) ** 2 + ((y - c.y) * 1.4) ** 2 < (c.r * 0.8) ** 2) return true;
    return false;
  }

  tree(x, y, size, seed, collide = true) {
    const w = this.world, v = seed % 6;
    let th, tw2, bt, cr, pal;
    if (size === 'big') { th = 36 + (v % 3) * 4; tw2 = 9; bt = 7 + (v % 2) * 2; cr = 36 + (v % 3) * 4; pal = N.GREENS.deep; }
    else if (size === 'mid') { th = 24 + (v % 3) * 3; tw2 = 6; bt = v % 2 ? 3 : 0; cr = 22 + (v % 3) * 3; pal = v % 2 ? N.GREENS.mid : N.GREENS.olive; }
    else { th = 15 + (v % 2) * 3; tw2 = 4; bt = 0; cr = 13 + (v % 2) * 2; pal = N.GREENS.light; }
    const trunk = Sprites.get(`tr:${size}:${v}`, () => N.trunkSprite(500 + v * 13 + size.length, th, tw2, bt, size === 'small' ? ['#4a3a2a', '#5e4a36', '#76604a', '#8e785e'] : undefined));
    const crown = Sprites.get(`cr:${size}:${v}`, () => N.crownSprite(900 + v * 31 + size.length * 7, cr, pal));
    const d = w.addDrawable({ x, y, sprite: trunk, ax: trunk.width / 2, ay: trunk.height - 2, crown: { sprite: crown, dx: 0, dy: -th - cr * 0.3, r: cr, h: th }, kind: 'tree', size });
    if (collide) w.addCollider({ x, y: y - 2, r: tw2 / 2 + (bt ? bt * 0.6 : 0) + 1 });
    w.addDensity(x, y - th - cr * 0.3, cr * 1.05, size === 'big' ? 1 : 0.8);
    return d;
  }
  palm(x, y, kind, v, collide = true) {
    const w = this.world;
    const s = kind === 'acai' ? Sprites.get('pa:acai:' + (v % 5), () => N.acaiSprite(70 + v % 5)) : kind === 'buriti' ? Sprites.get('pa:bur:' + (v % 3), () => N.buritiSprite(80 + v % 3)) : Sprites.get('pa:emb:' + (v % 4), () => N.embaubaSprite(90 + v % 4));
    w.addDrawable({ x, y, sprite: s, ax: s.width / 2, ay: s.height - 2, shadow: { rx: kind === 'buriti' ? 14 : 10, ry: 4, dx: -8, len: 10 } });
    if (collide) w.addCollider({ x, y: y - 1, r: kind === 'buriti' ? 3 : 2 });
    w.addDensity(x, y - s.height * 0.75, kind === 'buriti' ? 22 : 16, 0.35);
  }
  plant(x, y, kind, v, cover = true) {
    const w = this.world;
    let s;
    if (kind === 'bush') s = Sprites.get('bu:' + (v % 6), () => N.bushSprite(200 + v % 6, 7 + (v % 3), v % 2 ? N.GREENS.mid : N.GREENS.light));
    else if (kind === 'bigbush') s = Sprites.get('bb:' + (v % 3), () => N.bushSprite(260 + v % 3, 11, N.GREENS.mid));
    else if (kind === 'dry') s = Sprites.get('dry:' + (v % 3), () => N.bushSprite(280 + v % 3, 8 + (v % 2), F2.DRY));
    else if (kind === 'fern') s = Sprites.get('fe:' + (v % 4), () => N.fernSprite(300 + v % 4));
    else if (kind === 'heliconia') s = Sprites.get('he:' + (v % 3), () => N.heliconiaSprite(400 + v % 3));
    else if (kind === 'tucum') s = Sprites.get('tu:' + (v % 2), () => N.tucumSprite(420 + v % 2));
    w.addDrawable({ x, y, sprite: s, ax: s.width / 2, ay: s.height - 2, kind });
    if (cover && kind === 'bush') this.addCover(x, y - 4, 10 + (v % 3), false);
    return s;
  }

  placeVegetation() {
    const w = this.world, rng = mulberry32(2024);
    const terr = (tx, ty) => w.terrainAt(tx * 16, ty * 16);
    const keep = (tx, ty, r = 0) => {
      // nada de árvore aleatória em cima de pontos importantes
      const pts = [D.MIRANTE.at, D.VINE.at, D.VINE.palm, D.STONE_PUSH.at, D.PUZ.tangle, ...D.PUZ.rail, D.PUZ.lever, D.HAIR, D.DEER_PRINTS_E, D.FINAL_TREE, D.EXIT, D.MYSTERY, ...D.SIGNS.map((s) => s.at), ...D.CLUES.map((c) => c.at), ...D.HERD_ROUTE, D.TAPIR_HOME, D.CHASE.hollow];
      return pts.some(([x, y]) => Math.hypot(tx - x, ty - y) < 2.6 + r);
    };
    const zones = [[101, 57, 7], [80, 48, 6.5], [134, 99, 4], [104, 51, 5], [124.4, 111, 4], [103.6, 112, 5], [124, 53, 4]];
    const keepZone = (tx, ty) => zones.some(([x, y, r]) => Math.hypot(tx - x, ty - y) < r);
    // anel de mata fechada: árvores e moitas na borda dão a sensação de floresta densa
    for (let ty = 2; ty < TH - 1; ty += 1.7) for (let tx = 1; tx < TW - 1; tx += 1.7) {
      const x = tx + rng() * 1.5, y = ty + rng() * 1.5;
      const t = terr(x, y);
      if (t === T.THICKET) {
        // distância até a área pisável
        let edge = false;
        for (const [dx, dy] of [[1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6], [2.6, 0], [-2.6, 0], [0, 2.6]]) { const t2 = terr(x + dx, y + dy); if (t2 !== T.THICKET && t2 !== T.ROCK && t2 !== 255) { edge = true; break; } }
        const r = rng();
        // perto de pontos importantes, a borda da mata fica baixa (moitas), para não esconder nada
        if (edge && (keep(x, y, 2.2) || keepZone(x, y))) { if (rng() < 0.8) this.plant(px(x), px(y), rng() < 0.6 ? 'bigbush' : 'fern', (rng() * 9) | 0, false); continue; }
        if (edge) {
          if (r < 0.34) this.tree(px(x), px(y), rng() < 0.4 ? 'big' : 'mid', (rng() * 6) | 0, false);
          else if (r < 0.5) this.palm(px(x), px(y), rng() < 0.6 ? 'acai' : 'embauba', (rng() * 9) | 0, false);
          else if (r < 0.62) this.tree(px(x), px(y), 'small', (rng() * 6) | 0, false);
          if (rng() < 0.85) this.plant(px(x + (rng() - 0.5)), px(y + 0.4), rng() < 0.6 ? 'bigbush' : rng() < 0.5 ? 'fern' : 'heliconia', (rng() * 9) | 0, false);
          if (rng() < 0.6) this.plant(px(x + (rng() - 0.5) * 1.2), px(y - 0.5), rng() < 0.7 ? 'bush' : 'fern', (rng() * 9) | 0, false);
        } else if (r < 0.3) this.tree(px(x), px(y), rng() < 0.5 ? 'big' : 'mid', (rng() * 6) | 0, false);
        else if (r < 0.42) this.palm(px(x), px(y), 'acai', (rng() * 9) | 0, false);
        continue;
      }
      if (t === T.ROCK || t === T.STONE || t === T.GULLY || t === 255) continue;
      if (keep(x, y)) continue;
      const nt = this.nearTrail(x, y);
      if (t === T.MUD) { if (nt < 0.1 && rng() < 0.2 && !inEll(x, y, D.B_CENTER, 0.8)) this.palm(px(x), px(y), rng() < 0.5 ? 'buriti' : 'acai', (rng() * 9) | 0); continue; }
      if (t === T.RIVER || t === T.CREEK) continue;
      // clareiras e pátios ficam abertos: só samambaia e flores
      if (t === T.CLEAR && inEll(x, y, D.B_CENTER, 1) >= 1) { if (rng() < 0.12) this.plant(px(x), px(y), rng() < 0.6 ? 'fern' : 'heliconia', (rng() * 9) | 0); continue; }
      if (inEll(x, y, D.B_CENTER, 1) < 1) {
        // clareira: aberta no meio, algumas samambaias e capim na borda
        if (inEll(x, y, D.B_CENTER, 1) > 0.65 && rng() < 0.18) this.plant(px(x), px(y), rng() < 0.6 ? 'fern' : 'heliconia', (rng() * 9) | 0);
        continue;
      }
      if (nt > 0.05) { if (nt < 0.4 && rng() < 0.3) this.plant(px(x), px(y), rng() < 0.4 ? 'fern' : 'bush', (rng() * 9) | 0); continue; }
      // trilha D e passagens: só o que foi colocado à mão
      if (x > 120 && y > 40 && y < 101) continue;
      const r = rng();
      const meadow = y > 106 && x > 98;
      if (meadow) {
        if (r < 0.06) this.tree(px(x), px(y), 'mid', (rng() * 6) | 0);
        else if (r < 0.1) this.palm(px(x), px(y), 'embauba', (rng() * 9) | 0);
        else if (r < 0.28) this.plant(px(x), px(y), rng() < 0.5 ? 'fern' : 'heliconia', (rng() * 9) | 0);
        continue;
      }
      if (r < 0.1) this.tree(px(x), px(y), 'big', (rng() * 6) | 0);
      else if (r < 0.32) this.tree(px(x), px(y), 'mid', (rng() * 6) | 0);
      else if (r < 0.4) this.tree(px(x), px(y), 'small', (rng() * 6) | 0);
      else if (r < 0.48) this.palm(px(x), px(y), rng() < 0.7 ? 'acai' : 'embauba', (rng() * 9) | 0);
      else this.plant(px(x), px(y), rng() < 0.55 ? 'bush' : rng() < 0.6 ? 'fern' : 'heliconia', (rng() * 9) | 0);
    }
    // macacos precisam de copas na trilha de entrada
    this.canopyA = [];
    for (const [x, y, s] of [[18, 98.4, 'big'], [23, 104.5, 'big'], [29, 102.6, 'mid'], [34, 92.3, 'big'], [16, 101.6, 'mid']]) { const d = this.tree(px(x), px(y), s, (x * 3) | 0); this.canopyA.push({ x: d.x, y: d.y + d.crown.dy }); }
    // mirante: sapopema alta na beira da clareira
    this.tree(px(D.MIRANTE.tree[0]), px(D.MIRANTE.tree[1]), 'big', 2);
    // árvores do slalom da fuga
    for (const [x, y, s] of D.SLALOM_TREES) this.tree(px(x), px(y), s, (x * 7 + y) | 0);
    // árvore das marcas estranhas no final
    this.tree(px(D.FINAL_TREE[0]), px(D.FINAL_TREE[1]), 'big', 5);
  }

  placeProps() {
    const w = this.world;
    const add = (x, y, s, o = {}) => w.addDrawable({ x, y, sprite: s, ax: o.ax ?? s.width / 2, ay: o.ay ?? s.height - 2, ...o });
    // clareira do bando: pedras, troncos, moitas, arbustos secos
    for (const [x, y, r] of D.ROCKS_B) {
      const s = Sprites.get('boulder:' + r, () => N.rockSprite(640 + r, r));
      add(px(x), px(y), s, { shadow: { rx: r * 1.1, ry: 3, len: 6 } });
      w.addCollider({ x: px(x) - r * 0.95, y: px(y) - r * 0.55, w: r * 1.9, h: r * 0.75, occ: true });
      this.addCover(px(x), px(y) + 6, r * 1.1, false);
    }
    for (const [x, y, len] of D.LOGS_B) {
      const s = Sprites.get('log:' + len, () => F2.logSprite(len, len, 5));
      add(px(x), px(y), s, { ay: s.height - 3, shadow: { rx: len * 0.5, ry: 3, len: 4 } });
      w.addCollider({ x: px(x) - len / 2, y: px(y) - 9, w: len, h: 8, occ: true, low: true });
    }
    for (const [x, y] of D.BUSHES_B) { this.plant(px(x) - 5, px(y) + 1, 'bigbush', (x * 3) | 0, false); this.plant(px(x) + 6, px(y), 'bush', (y * 5) | 0, false); this.addCover(px(x), px(y) - 3, 15); }
    this.dryZones = D.DRY_ZONES.map(([x, y, r]) => ({ x: px(x), y: px(y), r: r * S, cd: 0 }));
    for (const z of this.dryZones) for (let k = 0; k < 5; k++) { const a = k * 1.3, rr = z.r * (0.2 + (k % 3) * 0.3); this.plant(z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr * 0.6, 'dry', k + (z.x | 0), false); }
    this.tree(px(D.VINE.at[0]) - 6, px(D.VINE.at[1]) - 6, 'mid', 3);
    this.palm(px(D.VINE.palm[0]), px(D.VINE.palm[1]), 'buriti', 1);
    for (const [x, y] of [[78.5, 80.2], [79.6, 81.2], [76, 80.8]]) { const s = Sprites.get('rock:' + 3, () => N.rockSprite(603, 6)); add(px(x), px(y), s); }

    // mata dos troncos caídos
    for (const [x, y, len, r] of D.LOGS_C) {
      const s = Sprites.get(`logc:${len}:${r}`, () => F2.logSprite(len + 7, len, r));
      add(px(x), px(y), s, { ay: s.height - 3, shadow: { rx: len * 0.5, ry: 3, len: 4 } });
      w.addCollider({ x: px(x) - len / 2, y: px(y) - r * 2 + 1, w: len, h: r * 2 - 1, occ: true, low: true });
    }
    for (const [x, y, wd] of D.ROOTS_C.concat(D.ROOTS_D)) {
      const s = Sprites.get('root:' + wd, () => F2.rootSprite(wd, wd));
      add(px(x), px(y), s, { ay: s.height - 2 });
      w.addCollider({ x: px(x) - wd / 2 + 2, y: px(y) - 5, w: wd - 4, h: 4 });
    }
    const ft = Sprites.get('fallen', () => N.fallenTreeSprite(77));
    add(px(82), px(66.6), ft, { ax: 52, ay: 24, shadow: { rx: 48, ry: 5, dy: 2, len: 6 } });
    w.addCollider({ x: px(82) - 50, y: px(66.6) - 12, w: 98, h: 11, occ: true, low: true });
    // pedras do pátio, do lajedo e da grota
    const rng = mulberry32(77);
    for (let i = 0; i < 140; i++) {
      const tx = 96 + rng() * 16, ty = 46 + rng() * 13;
      const t = w.terrainAt(px(tx), px(ty));
      if (t !== T.ROCK) continue;
      const big = Math.abs(tx - D.GORGE.x) > 2.6 && rng() < 0.6;
      const rr = big ? 7 + (i % 4) * 2 : 3 + (i % 4);
      const s = Sprites.get('rk:' + rr + ':' + (i % 3), () => N.rockSprite(620 + rr * 3 + (i % 3), rr));
      add(px(tx), px(ty), s);
      if (rng() < 0.25) this.plant(px(tx) + 3, px(ty) - 2, 'fern', i, false);
    }
    for (let i = 0; i < 30; i++) {
      const a = rng() * Math.PI * 2, k = 0.6 + rng() * 0.45;
      const tx = D.LAJEDO.x + Math.cos(a) * D.LAJEDO.rx * k, ty = D.LAJEDO.y + Math.sin(a) * D.LAJEDO.ry * k;
      const s = Sprites.get('rock:' + (i % 5), () => N.rockSprite(600 + i % 5, 3 + (i % 5)));
      if (Math.abs(tx - D.BRIDGE.x) < 3 && ty < D.LAJEDO.y) continue;
      add(px(tx), px(ty), s);
      if (i % 3 === 0) w.addCollider({ x: px(tx), y: px(ty) - 2, r: 3 });
    }
    const steps = Sprites.get('steps', () => F2.stepsSprite());
    add(px(D.BRIDGE.x), px(101.2), steps, { ay: 14, layer: 'ground' });
    // tucum espinhento na bifurcação da direita
    for (const [x, y] of D.TUCUM_D) this.plant(px(x), px(y), 'tucum', (x * 5) | 0, false);
    // galhos secos que estalam
    this.twigs = [];
    const tr = mulberry32(99);
    for (const t of D.TRAILS.filter((q) => ['A', 'PN', 'PNE', 'C2', 'E'].includes(q.id))) {
      for (let i = 0; i < t.pts.length - 1; i++) {
        if (tr() < 0.4) continue;
        const [ax, ay] = t.pts[i], [bx, by] = t.pts[i + 1];
        const k = 0.3 + tr() * 0.4, x = px(ax + (bx - ax) * k) + (tr() - 0.5) * 8, y = px(ay + (by - ay) * k) + (tr() - 0.5) * 8;
        const s = Sprites.get('twig:' + (i % 3), () => N.twigSprite(i));
        add(x, y, s, { ax: 5, ay: 3, layer: 'ground' });
        this.twigs.push({ x, y, cd: 0 });
      }
    }
  }

  decorateGround(ctx) {
    const w = this.world, rng = mulberry32(5151);
    // raízes das árvores grandes
    ctx.strokeStyle = 'rgba(40,28,16,0.75)'; ctx.lineWidth = 2;
    for (const d of w.drawables) {
      if (d.kind !== 'tree' || d.size !== 'big') continue;
      if (w.terrainAt(d.x, d.y) === T.THICKET && rng() < 0.6) continue;
      for (let k = 0; k < 5; k++) {
        const a = rng() * Math.PI * 2, L2 = 14 + rng() * 14;
        ctx.beginPath(); ctx.moveTo(d.x, d.y - 2);
        ctx.quadraticCurveTo(d.x + Math.cos(a) * L2 * 0.5 + (rng() - 0.5) * 6, d.y + Math.sin(a) * L2 * 0.25, d.x + Math.cos(a) * L2, d.y + Math.sin(a) * L2 * 0.45);
        ctx.stroke();
      }
    }
    // folhas e brotos; mata fechada fica mais escura e emaranhada
    for (let i = 0; i < 16000; i++) {
      const x = rng() * w.W, y = rng() * w.H, t = w.terrainAt(x, y);
      if (t === T.FLOOR || t === T.CLEAR) {
        const r = rng();
        if (r < 0.45) { ctx.fillStyle = ['#7a5428', '#8e6a30', '#5e4420', '#9a7a3a', '#6a3a1e'][(rng() * 5) | 0]; ctx.fillRect(x | 0, y | 0, 2 + (rng() * 2 | 0), 1); ctx.fillRect((x | 0) + 1, (y | 0) + 1, 1, 1); }
        else if (r < 0.7) { ctx.fillStyle = '#3f6a2a'; ctx.fillRect(x | 0, y | 0, 1, 2); ctx.fillStyle = '#5a8a3a'; ctx.fillRect((x | 0) - 1, y | 0, 1, 1); ctx.fillRect((x | 0) + 1, y | 0, 1, 1); }
        else if (r < 0.8) { ctx.fillStyle = '#4a3a24'; ctx.fillRect(x | 0, y | 0, 4, 1); }
      } else if (t === T.THICKET) {
        ctx.fillStyle = rng() < 0.5 ? '#1e2e14' : '#2c3a1a'; ctx.fillRect(x | 0, y | 0, 2, 2);
        if (rng() < 0.3) { ctx.fillStyle = '#3a5a26'; ctx.fillRect(x | 0, (y | 0) - 1, 1, 3); }
      } else if (t === T.GRASS) {
        ctx.fillStyle = rng() < 0.5 ? '#6a9a3a' : '#4e7a2a'; ctx.fillRect(x | 0, y | 0, 1, 2); ctx.fillRect((x | 0) + 2, (y | 0) + 1, 1, 2);
        if (rng() < 0.06) { ctx.fillStyle = ['#f0e070', '#f0f0f0', '#e07ab0', '#ff8a4a'][(rng() * 4) | 0]; ctx.fillRect(x | 0, (y | 0) - 1, 1, 1); }
      } else if (t === T.MUD && rng() < 0.4) { ctx.fillStyle = rng() < 0.5 ? 'rgba(40,30,18,0.6)' : 'rgba(120,100,70,0.4)'; ctx.fillRect(x | 0, y | 0, 2, 1); }
    }
    // bordas da grota e do lajedo (relevo)
    for (let y = 0; y < w.H; y += 2) for (let x = 0; x < w.W; x += 2) {
      const t = w.terrainAt(x, y);
      if (t === T.GULLY && w.terrainAt(x, y - 4) !== T.GULLY) { ctx.fillStyle = 'rgba(120,96,60,0.8)'; ctx.fillRect(x, y, 2, 2); }
      if (t === T.STONE && w.terrainAt(x, y + 4) !== T.STONE) { ctx.fillStyle = 'rgba(30,28,22,0.75)'; ctx.fillRect(x, y, 2, 3); }
      if (t === T.STONE && w.terrainAt(x, y - 4) !== T.STONE) { ctx.fillStyle = 'rgba(200,196,170,0.6)'; ctx.fillRect(x, y, 2, 1); }
      if (t === T.ROCK && w.terrainAt(x, y + 4) !== T.ROCK) { ctx.fillStyle = 'rgba(30,28,22,0.6)'; ctx.fillRect(x, y, 2, 2); }
    }
    // solo fuçado pelo bando (trilha de entrada e clareira)
    const churn = (cx, cy, r, n) => {
      for (let i = 0; i < n; i++) {
        const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * r;
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.6;
        ctx.fillStyle = rng() < 0.5 ? '#3a2814' : '#5a4024'; ctx.fillRect(x | 0, y | 0, 2 + (rng() * 3 | 0), 2);
        if (rng() < 0.3) { ctx.fillStyle = '#7a5a34'; ctx.fillRect(x | 0, (y | 0) - 1, 2, 1); }
      }
    };
    churn(px(19.5), px(101), 26, 160);
    for (const [x, y] of [[23, 101], [33, 97], [44, 90], [61, 94], [70, 89], [64, 99], [57, 91], [73, 97], [124, 53]]) churn(px(x), px(y), 18 + rng() * 14, 90);
    // pegadas de casco partido espalhadas
    const pk = Sprites.get('trk:queixada', () => PR.trackSprite('queixada'));
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 70; i++) {
      const tr = D.TRAILS[[0, 2, 0, 9][i % 4]];
      const k = rng() * (tr.pts.length - 1), i0 = Math.floor(k), f = k - i0;
      const [ax, ay] = tr.pts[i0], [bx, by] = tr.pts[Math.min(i0 + 1, tr.pts.length - 1)];
      ctx.drawImage(pk, Math.round(px(ax + (bx - ax) * f) - 14 + (rng() - 0.5) * 20), Math.round(px(ay + (by - ay) * f) - 11 + (rng() - 0.5) * 12));
    }
    for (let i = 0; i < 30; i++) ctx.drawImage(pk, Math.round(px(66) + (rng() - 0.5) * 420), Math.round(px(92) + (rng() - 0.5) * 260));
    ctx.globalAlpha = 1;
    // cinzas do primeiro acampamento
    ctx.fillStyle = 'rgba(30,24,18,0.6)'; ctx.beginPath(); ctx.ellipse(px(10), px(108.3), 9, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(80,70,60,0.7)'; for (let i = 0; i < 12; i++) ctx.fillRect(px(10) - 6 + rng() * 12, px(108.3) - 3 + rng() * 6, 2, 1);
  }

  // ================= estado dinâmico =================
  carryIn(data) {
    const c = data.carry || {};
    const items = new Map(c.inv?.items || []);
    for (const id of EQUIP) if (!items.has(id)) items.set(id, 1);
    if (!items.has('fumo')) items.set('fumo', 1);
    for (const id of ['galhos', 'tabua', 'cipo']) items.delete(id);
    return {
      done: [], flags: {}, tracks: c.tracks || [], tod: this.todStart,
      inv: { items: [...items], found: c.inv?.found || c.found || [] },
      res: { water: c.res?.water ?? 2, food: Math.max(2, c.res?.food ?? 2), ammo: c.res?.ammo ?? 5 },
    };
  }

  setupDynamic(fromSave) {
    const g = this.g, w = this.world, f = g.flags;
    f.score = f.score || 0; f.journal = f.journal || [];
    this.dirty = false; this.silentFail = false; this.silentAttempt = false;
    this.studyT = {}; this.studyTarget = null; this.gateMsgT = 0; this.bumpT = 0; this.bumpCd = 0; this.distractCd = { vine: 0, stone: 0 };
    this.distantT = 6; this.lastPos = null; this.chaseActive = false; this.chaseEnded = false; this.finished = false;
    this.rollingStone = null; this.fruitT = 0; this.capT = {}; this.timers = [];
    this.herds = [];
    g.lights = [];
    g.onAnimalEvent = (a, ev) => this.onAnimalEvent(a, ev);

    // ---------- sinais (missão 1) ----------
    for (const s of D.SIGNS) {
      const p = P(s.at);
      g.interactables.push({ x: p.x, y: p.y, r: 24, py: 12, label: () => (f['sign_' + s.id] ? s.name : 'Examinar o sinal'), enabled: () => !f['sign_' + s.id], action: () => this.examineSign(s) });
    }
    const my = P(D.MYSTERY);
    g.interactables.push({ x: my.x, y: my.y, r: 22, py: 12, label: 'Examinar as pegadas do veado', enabled: () => !f.mystery, action: () => this.examineMystery() });
    for (const c of D.CLUES) {
      const p = P(c.at);
      g.interactables.push({ x: p.x, y: p.y, r: 22, py: 12, label: 'Examinar', enabled: () => !f[c.id], action: () => this.examineClue(c) });
    }

    // ---------- pequenos animais ----------
    const animals = [];
    for (const [x, y] of [[20, 106], [33, 101], [112, 115], [96, 61]]) animals.push(new Animal(g, 'cotia', px(x), px(y)));
    for (const [x, y] of [[16, 100.5], [28, 96.8], [106, 46.5], [120, 110]]) for (let i = 0; i < 2; i++) animals.push(new Animal(g, 'jacu', px(x) + i * 12, px(y) + i * 5));
    for (const a of animals) { g.animals.push(a); g.entities.push(a); g.updaters.push(a); g.airEntities.push(a); }
    const tr = new MonkeyTroop(g, this.canopyA, 3); g.updaters.push(tr); g.airEntities.push(tr);
    const fo = new Flyovers(g); g.updaters.push(fo); g.airEntities.push(fo);
    for (const [x, y] of [[12, 104], [24, 101], [52, 92], [80, 50], [116, 112], [128, 113], [108, 113]]) { const b = new Butterfly(g, px(x), px(y)); g.updaters.push(b); g.entities.push(b); }

    // ---------- bando da clareira ----------
    const B = D.B_CENTER;
    const herdB = (this.herdB = new Herd(g, {
      id: 'clareira', x: px(D.HERD_ROUTE[0][0]), y: px(D.HERD_ROUTE[0][1]), route: D.HERD_ROUTE.map(P), moveEvery: [32, 48], firstMove: 24,
      leash: { x: px(B.x), y: px(B.y), r: px(19) }, occludes: (x, y, c) => this.occludes(x, y, c), maxChasers: 4, biteDamage: 9, smellMul: 0.8,
      on: {
        detect: (m, r) => this.onHerdDetect(herdB, m, r), chase: (m) => this.onHerdChase(herdB, m), calm: () => this.onHerdCalm(herdB),
        giveUp: (m, why) => this.onGiveUp(herdB, m, why), move: () => this.onHerdMove(herdB),
      },
    }));
    const R = mulberry32(31);
    const slot = (i, n) => { const a = (i / n) * Math.PI * 2 + R() * 0.5, rr = 12 + R() * 20; return { x: Math.cos(a) * rr * 1.25, y: Math.sin(a) * rr * 0.75 }; };
    const nB = f.crossSeen ? 12 : 6;
    for (let i = 0; i < nB; i++) {
      const s = slot(i, 12);
      const m = herdB.add(herdB.anchor.x + s.x, herdB.anchor.y + s.y, { slot: s, juv: i === 3 || i === 9, sentinel: i === 0, rng: R });
      if (fromSave || true) m.enter(i % 3 ? PS.FORAGING : PS.IDLE);
    }
    this.herds.push(herdB);
    // coluna que atravessa a trilha (história): depois entra para o bando
    if (!f.crossSeen) {
      const col = (this.herdCol = new Herd(g, {
        id: 'coluna', x: px(39.9), y: px(102.4), route: [[39.9, 102.4], [40.4, 99.5], [41.6, 95], [44, 89.2], [49, 86.2], [58, 90]].map(P), moveEvery: [0.05, 0.1], firstMove: 9999, spread: 0.45, walkMul: 1.9, ignorePlayer: true,
        leash: { x: px(46), y: px(96), r: px(22) }, maxChasers: 3,
        on: { detect: (m, r) => this.onHerdDetect(col, m, r), chase: (m) => this.onHerdChase(col, m), calm: () => this.onHerdCalm(col), arrive: (pt) => this.onColumnArrive(pt) },
      }));
      for (let i = 0; i < 6; i++) { const s = slot(i + 6, 12); col.add(col.anchor.x + s.x * 0.45, col.anchor.y + s.y * 0.45, { slot: s, juv: i === 3, rng: R }).enter(PS.IDLE); }
      this.herds.push(col);
    } else this.herdCol = null;

    // ---------- grupo da trilha da fuga ----------
    const herdD = (this.herdD = new Herd(g, {
      id: 'fuga', x: px(D.CHASE.hollow[0]), y: px(D.CHASE.hollow[1]), leash: { x: 0, y: 0, r: Infinity }, lostSight: 7, smellMul: 2.2, aggression: 1.6, maxChasers: 6, biteDamage: 7, mercy: true, chaseMul: 0.93, biteInterval: 1.1,
      blocked: (x, y) => y > px(100.25), safe: (x, y) => y > px(100.7), sleepDist: 900, flowCells: 14000,
      on: { detect: (m, r) => this.onHerdDetect(herdD, m, r), chase: (m) => this.onHerdChase(herdD, m), calm: () => this.onHerdCalm(herdD), giveUp: (m, why) => this.onGiveUp(herdD, m, why), bite: () => { g.camera.shake(1.2, 0.2); this.bites = (this.bites || 0) + 1; } },
    }));
    for (let i = 0; i < 5; i++) { const s = { x: (i - 2) * 9, y: ((i % 2) - 0.5) * 12 }; const m = herdD.add(herdD.anchor.x + s.x, herdD.anchor.y + s.y, { slot: s, rng: R }); m.pers.bold = Math.max(m.pers.bold, 1.05); m.enter(PS.FORAGING); }
    this.herds.push(herdD);
    for (const h of this.herds) { g.updaters.push(h); for (const m of h.members) { g.entities.push(m); g.animals.push(m); } }

    // ---------- anta ----------
    this.tapir = new Tapir(g, P(D.TAPIR_HOME), this);
    g.entities.push(this.tapir); g.updaters.push(this.tapir);
    const self = this;
    g.interactables.push({
      get x() { return self.tapir.x; }, get y() { return self.tapir.y; }, r: 170, py: 20,
      label: () => (dist(self.tapir.x, self.tapir.y, g.player.x, g.player.y) < 60 ? 'Perto demais: afaste-se' : 'Observar a anta de longe'),
      enabled: () => self.tapir.visible && !g.done.has('s_anta') && self.tapir.state !== 'flee',
      action: () => this.observeTapir(),
    });

    // ---------- clareira: mirante, distrações, passagens ----------
    const mir = P(D.MIRANTE.at);
    g.interactables.push({ x: mir.x, y: mir.y, r: 26, py: 30, label: 'Observar o bando do alto da sapopema', enabled: () => !g.done.has('m2'), action: () => this.observeFromMirante() });
    const vine = P(D.VINE.at);
    g.interactables.push({ x: vine.x, y: vine.y, r: 22, py: 26, label: () => (this.distractCd.vine > g.time ? 'O cipó ainda balança…' : 'Sacudir o cipó do buritizeiro'), enabled: () => true, action: () => this.useVine() });
    const sp = P(D.STONE_PUSH.at);
    g.interactables.push({ x: sp.x, y: sp.y, r: 22, py: 18, label: () => (this.distractCd.stone > g.time ? 'Procurar outra pedra solta…' : 'Rolar uma pedra solta barranco abaixo'), enabled: () => true, action: () => this.useStone() });
    for (const ps of D.PASSAGES) {
      const [gx, gy, gw, gh] = ps.gate;
      w.blockers.push({ x: px(gx), y: px(gy), w: gw * S, h: gh * S, active: () => this.gateClosed() });
    }

    // ---------- puzzle dos troncos ----------
    const trunk = P(D.PUZ.trunk);
    this.trunk = { x: trunk.x, y: trunk.y, rot: 0, a: 1 };
    if (f.trunkMoved) { const rt = P(D.PUZ.rollTo); this.trunk.x = rt.x; this.trunk.y = rt.y; this.trunk.rot = 0.35; }
    this.trunkCol = w.addCollider({ x: trunk.x - D.PUZ.trunkLen / 2, y: trunk.y - 8, w: D.PUZ.trunkLen, h: 10, dyn: true, off: !!f.trunkMoved });
    const big = Sprites.get('bigtrunk', () => F2.logSprite(4040, D.PUZ.trunkLen + 18, 8));
    g.entities.push({ get x() { return self.trunk.x; }, get y() { return self.trunk.y; }, draw: (ctx) => {
      const t = self.trunk;
      ctx.save(); ctx.translate(Math.round(t.x), Math.round(t.y)); ctx.rotate(t.rot);
      ctx.globalAlpha = 0.3; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, 2, big.width / 2, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      ctx.drawImage(big, -Math.round(big.width / 2), -big.height + 4); ctx.restore();
    } });
    // emaranhado e vara
    const tg = P(D.PUZ.tangle), tgs = Sprites.get('tangle', () => F2.tangleSprite(8));
    this.tangleCol = w.addCollider({ x: tg.x - 14, y: tg.y - 7, w: 28, h: 8, dyn: true, off: !!f.tangleCut });
    g.entities.push({ x: tg.x, y: tg.y + 1, draw: (ctx) => { if (!f.tangleCut) ctx.drawImage(tgs, Math.round(tg.x - 18), Math.round(tg.y - 18)); } });
    g.interactables.push({ x: tg.x, y: tg.y + 6, r: 24, py: 24, label: 'Cortar o emaranhado de galhos', enabled: () => !f.tangleCut, action: () => this.cutTangle() });
    const pole = P(D.PUZ.pole), pls = Sprites.get('pole', () => F2.poleSprite());
    g.entities.push({ x: pole.x, y: pole.y, draw: (ctx) => { if (f.tangleCut && !f.varaTaken) ctx.drawImage(pls, Math.round(pole.x - 15), Math.round(pole.y - 4)); } });
    g.interactables.push({ x: pole.x, y: pole.y + 3, r: 22, py: 14, label: 'Pegar a vara de pau-ferro', enabled: () => f.tangleCut && !f.varaTaken, action: () => { f.varaTaken = true; g.give('vara'); g.ui.toast('Vara grossa de pau-ferro: não verga. Serve de alavanca, se tiver apoio.', 'tip', 4500); } });
    // toro empurrável
    this.toroCol = w.addCollider({ x: 0, y: 0, w: 20, h: 8, dyn: true });
    this.placeToro(f.toroS || 0);
    const tos = Sprites.get('toro', () => F2.toroSprite());
    g.entities.push({ get x() { return self.toroPos().x; }, get y() { return self.toroPos().y + 4; }, draw: (ctx) => { const t = self.toroPos(); ctx.globalAlpha = 0.3; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(t.x, t.y + 3, 11, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; ctx.drawImage(tos, Math.round(t.x - 12), Math.round(t.y - 9)); } });
    const lv = P(D.PUZ.lever);
    g.interactables.push({ x: lv.x, y: lv.y, r: 26, py: 22, label: () => (this.leverReady() ? 'Usar a vara como alavanca' : 'Examinar o tronco caído'), enabled: () => !f.trunkMoved && (f.toroPlaced || dist(g.player.x, g.player.y, trunk.x, trunk.y) < 40), action: () => this.leverAction() });
    g.interactables.push({ x: trunk.x, y: trunk.y + 10, r: 22, py: 22, label: 'Examinar o tronco caído', enabled: () => !f.trunkMoved && !f.toroPlaced, action: () => this.leverAction() });

    // ---------- ponte e lajedo ----------
    w.walkOverrides.push({ x: px(D.BRIDGE.x) - 11, y: px(D.BRIDGE.y0), w: 22, h: px(D.BRIDGE.y1) - px(D.BRIDGE.y0), active: () => true });
    const bl = Sprites.get('bridgelog', () => F2.logVertSprite(31, px(D.BRIDGE.y1) - px(D.BRIDGE.y0) + 10, 6));
    this.bridgeSprite = bl;
    g.hazards = D.TUCUM_D.map(([x, y]) => ({ x: px(x), y: px(y) - 3, r: 9, type: 'tucum' }));

    // ---------- rastro vermelho e final ----------
    const hair = P(D.HAIR);
    this.plantHair = Sprites.get('bu:1', () => N.bushSprite(201, 8, N.GREENS.light));
    g.entities.push({ x: hair.x, y: hair.y, draw: (ctx) => {
      ctx.drawImage(this.plantHair, Math.round(hair.x - this.plantHair.width / 2), Math.round(hair.y - this.plantHair.height + 2));
      if (!f.hair) { ctx.fillStyle = '#c8502a'; for (const [dx, dy] of [[-3, -8], [-2, -9], [2, -6], [3, -7], [0, -10]]) ctx.fillRect(Math.round(hair.x + dx), Math.round(hair.y + dy), 1, 2); }
    } });
    g.interactables.push({ x: hair.x, y: hair.y, r: 22, py: 22, label: 'Examinar os pelos presos no espinho', enabled: () => !f.hair, action: () => this.examineHair() });
    const dp = P(D.DEER_PRINTS_E);
    g.interactables.push({ x: dp.x, y: dp.y, r: 22, py: 12, label: 'Examinar as pegadas do veado', enabled: () => !f.prints, action: () => this.examinePrints() });

    this.setupTriggers();
    if (!fromSave) g.fade = 0;
    // retomando no meio da perseguição: o bando vem pela trilha, por trás
    if (fromSave && f.chaseStarted && !g.done.has('m6')) this.resumeChase();
    if (g.done.has('m6')) for (const m of herdD.members) m.enter(PS.FORAGING);
  }

  setupTriggers() {
    const g = this.g, f = g.flags;
    // a coluna de queixadas atravessa a trilha à frente
    g.triggers.push({ x: px(31.5), y: px(92.2), w: px(5), h: px(11), cond: () => !f.crossSeen, fn: () => this.crossingScene() });
    // passagens: concluir a travessia
    for (const ps of D.PASSAGES) {
      const p = P(ps.at);
      g.triggers.push({ x: p.x, y: p.y, r: 20, once: false, cond: () => !g.done.has('m4'), fn: () => this.reachPassage(ps) });
      g.triggers.push({ x: p.x, y: p.y + 20, r: 46, once: false, cond: () => this.gateClosed() && !g.done.has('m4'), fn: () => this.gateMessage() });
    }
    // dica perto do toro
    g.triggers.push({ x: px(100), y: px(60), r: 70, cond: () => !f.puzzleTip && g.done.has('m4'), fn: () => { f.puzzleTip = true; g.ui.toast('<b>Dica</b> · Um tronco enorme fecha a grota. Olhe em volta: galhos, uma vara, um toro solto…', 'tip', 6000); } });
    // tronco liberado: checkpoint antes da trilha da fuga
    g.triggers.push({ x: px(116), y: px(42), r: 40, cond: () => f.trunkMoved && !f.cpD, fn: () => { f.cpD = true; g.checkpoint('Trilha da fuga'); g.audio.setMood('stealth'); g.caption('Um cheiro azedo no ar... e silêncio demais', 0.6); } });
    // a grande perseguição
    g.triggers.push({ x: px(D.CHASE.trigger[0]), y: px(D.CHASE.trigger[1]), r: 30, cond: () => !f.chaseStarted && g.done.has('m5'), fn: () => this.startChase(true) });
    g.triggers.push({ x: px(D.CHASE.cp2[0]), y: px(D.CHASE.cp2[1]), r: 34, cond: () => f.chaseStarted && !f.chaseCp2 && !g.done.has('m6'), fn: () => { f.chaseCp2 = true; g.checkpoint('Bifurcação'); g.caption('Esquerda: trilha longa e limpa. Direita: atalho no meio do tucum', 0); } });
    // lajedo: a salvo
    g.triggers.push({ x: px(D.LAJEDO.x) - px(7), y: px(101.7), w: px(14), h: px(5), cond: () => !g.done.has('m6') && f.chaseStarted, fn: () => this.reachLajedo() });
    // rastro vermelho: dica ao entrar
    g.triggers.push({ x: px(124), y: px(109), r: 70, cond: () => !f.eTip && g.done.has('m6'), fn: () => { f.eTip = true; g.audio.setMood('relief'); g.caption('A mata fica quieta. Só passarinho', 0); g.ui.toast('A mata abre e fica silenciosa. Procure sinais do veado.', 'tip', 4500); } });
    // saída
    g.triggers.push({ x: px(D.EXIT[0]), y: px(D.EXIT[1]), r: 26, once: false, cond: () => !this.finished, fn: () => this.reachExit() });
    // galhos que estalam
    for (const t of this.twigs) {
      g.triggers.push({ x: t.x, y: t.y, r: 7, once: false, fn: () => {
        const p = g.player;
        if (t.cd > g.time || !p.moving || p.sneak) return;
        t.cd = g.time + 3;
        g.audio.play('twig', { pan: 0, vol: p.running ? 1 : 0.8 });
        p.makeNoise(0.95);
        g.caption('Um galho seco estala sob a bota', 0);
      } });
    }
  }

  // ================= roteiro =================
  async intro() {
    const g = this.g;
    await g.ui.intro([
      '<span class="place">Mata de terra firme · manhã</span>Caetano desmontou o primeiro acampamento com o orvalho ainda pingando das folhas.',
      'O rastro do veado-vermelho seguia para o leste, por trilhas de bicho que se cruzam no meio da floresta.',
      'Depois de alguns minutos de caminhada, o chão começou a mudar: terra revirada, raízes quebradas, pegadas por todo lado.',
    ]);
    g.player.dir = 'right';
    g.letterbox = 1; g.fade = 1;
    g.audio.setMood('calm');
    await g.run(async () => {
      g.camera.targetZoom = 1.2;
      await g.tween(g, 'fade', 0, 2);
      g.ui.titleCard('FASE 2', 'O Caminho dos Queixadas', 'Manhã · floresta de terra firme');
      await g.wait(3.4);
      await g.say('Caetano', 'Terra revirada, raiz roída... Isso aqui não foi bicho sozinho, não.', 'caetano');
      g.audio.play('grunt', { pan: 0.8, vol: 0.35 });
      g.caption('Um ronco grave, longe, para o leste', 0.8);
      await g.wait(1.2);
      await g.say('Caetano', 'O veado passou por aqui. Mas tem mais alguém andando nessa mata. Vou com calma e olhar os sinais.', 'caetano');
      g.camera.targetZoom = 1;
      await g.tween(g, 'letterbox', 0, 0.8);
    });
    g.state = 'play';
    g.stats.startedAt = g.timeLeft;
    g.ui.toast('<b>Dica</b> · Os sinais do bando brilham de leve quando você chega perto. Examine com <kbd>E</kbd>.', 'tip', 6500);
    setTimeout(() => g.state === 'play' && g.ui.toast('<b>Dica</b> · O medidor de <b>Ruído</b> mostra BAIXO, MÉDIO ou ALTO. Agachado (<kbd>C</kbd>) é baixo; andando, médio; correndo, alto.', 'tip', 7500), 8000);
    g.checkpoint('Início da Fase 2');
  }

  addScore(n, label) { const f = this.g.flags; f.score = (f.score || 0) + n; if (label) this.g.ui.toast(`<b>+${n}</b> exploração · ${label}`, 'discovery', 2600); }
  addJournal(title, text) { const f = this.g.flags; f.journal = f.journal || []; if (!f.journal.some((j) => j.title === title)) f.journal.push({ title, text }); }
  journal() { return this.g.flags.journal || []; }
  panelRow() { return ['Exploração', `${this.g.flags.score || 0} pts`]; }

  async examineSign(s) {
    const g = this.g, f = g.flags;
    await g.run(async () => {
      g.player.forceCrouch = true; g.camera.targetZoom = 1.3;
      await g.say('Caetano', s.text, 'caetano');
      g.camera.targetZoom = 1; g.player.forceCrouch = false;
    });
    f['sign_' + s.id] = true;
    this.addScore(10, s.name);
    this.addJournal('Sinal: ' + s.name, s.text);
    if (this.count.signsDone() >= 2 && !g.done.has('m1')) {
      g.complete('m1');
      g.ui.toast('O bando seguiu para o leste. Siga a trilha e encontre os animais, sem chegar perto demais.', 'tip', 5500);
      g.checkpoint('Sinais do bando');
    }
  }

  async examineMystery() {
    const g = this.g, f = g.flags;
    await g.run(async () => {
      g.player.forceCrouch = true; g.camera.targetZoom = 1.4;
      await g.say('Caetano', 'Pegada do veado... indo pro norte. E aqui do lado, a mesma pegada, fresca igual, voltando pro sul.', 'caetano');
      await g.say('Caetano', 'Como é que um bicho vai e volta pisando em cima do próprio rastro, sem errar um passo?', 'caetano');
      g.audio.setDuck(0.3, 0.6);
      await g.wait(0.8);
      await g.say('Caetano', '...Deve ter sido o vento mexendo nas folhas. Deve.', 'caetano');
      g.audio.setDuck(1, 2);
      g.camera.targetZoom = 1; g.player.forceCrouch = false;
    });
    f.mystery = true;
    this.addScore(10, 'pegadas estranhas');
    this.addJournal('Pegadas que vão e voltam', 'O rastro do veado parecia seguir para dois lados ao mesmo tempo, com a mesma idade. Não faz sentido.');
  }

  async examineClue(c) {
    const g = this.g, f = g.flags;
    await g.run(async () => { g.player.forceCrouch = true; await g.say('Caetano', c.text, 'caetano'); g.player.forceCrouch = false; });
    f[c.id] = true;
    this.addScore(15, 'pista do veado');
    this.addJournal('Pista do veado', c.text);
    if (this.count.cluesDone() >= 3 && !g.done.has('s_tracker')) {
      g.complete('s_tracker');
      this.addScore(50, 'Rastreador Experiente');
      this.addJournal('Conquista: Rastreador Experiente', 'Três pistas do veado-vermelho encontradas fora da trilha principal.');
    }
  }

  async crossingScene() {
    const g = this.g, f = g.flags, col = this.herdCol, p = g.player;
    f.crossSeen = true;
    if (!col) return;
    col.moveT = 0; col.moving = false;
    col.routeIdx = 0;
    this.later(9, () => { col.ignorePlayer = false; });
    await g.run(async () => {
      await g.tween(g, 'letterbox', 1, 0.5);
      g.audio.play('grunt', { pan: 0.6, vol: 0.8 });
      g.caption('Um ruído crescente entre as árvores: galhos mexendo', 0.6);
      g.camera.follow = null;
      await g.camera.panTo(px(40.6), px(97), 1.6);
      p.forceCrouch = true;
      await g.wait(3.4);
      g.audio.play('clack', { pan: 0.5, vol: 0.6 });
      await g.say('Caetano', 'Queixada! Um bando inteiro atravessando a trilha...', 'caetano');
      await g.wait(1.2);
      await g.say('Caetano', 'Se eles me cercam no meio da mata, não tem árvore que me salve. Preciso achar outro caminho... e ver pra onde eles vão.', 'caetano');
      await g.camera.panTo(p.x, p.y - 8, 1.2);
      g.camera.follow = p;
      p.forceCrouch = false;
      await g.tween(g, 'letterbox', 0, 0.5);
    });
    this.addJournal('Um bando inteiro', 'Uma fila de queixadas cruzou a trilha à frente, rumo a uma clareira a leste. Barulho de cascos e bater de dentes.');
    g.ui.toast('<b>Dica</b> · Agachado (<kbd>C</kbd>) você faz ruído BAIXO e fica menos visível. Queixada enxerga mal, mas escuta e fareja muito bem.', 'tip', 7500);
  }

  onColumnArrive(pt) {
    const col = this.herdCol;
    if (!col || col.routeIdx < col.route.length - 1) return;
    // a coluna se junta ao bando da clareira
    const B = this.herdB;
    for (const m of col.members) {
      m.herd = B; B.members.push(m);
      m.slot = { x: (Math.random() - 0.5) * 60, y: (Math.random() - 0.5) * 34 };
      if (isCalm(m.state)) m.enter(PS.WALKING);
    }
    col.members = [];
    this.herds = this.herds.filter((h) => h !== col);
    const i = this.g.updaters.indexOf(col); if (i >= 0) this.g.updaters.splice(i, 1);
    this.herdCol = null;
  }

  async observeFromMirante() {
    const g = this.g, p = g.player, B = this.herdB;
    if (B.mode !== 'calm') { g.ui.toast('O bando está agitado. Espere ele se acalmar antes de observar.', 'warn', 3500); return; }
    await g.run(async () => {
      p.hidden = true; p.forceCrouch = true;
      await g.tween(g, 'letterbox', 1, 0.5);
      g.camera.follow = null; g.camera.targetZoom = 0.9;
      await g.camera.panTo(B.anchor.x - 30, B.anchor.y - 10, 1.8);
      g.audio.setMood('stealth');
      await g.say('Caetano', `Lá estão eles. ${B.members.length > 8 ? 'Doze, treze...' : 'Seis, sete...'} contando os filhotes no meio.`, 'caetano');
      await g.say('Caetano', 'Fuçam o chão sem parar. Bicho de cheiro forte, que escuta longe. Do jeito que o vento está, eles vão saber de mim antes de me ver.', 'caetano');
      await g.say('Caetano', 'Pra passar, eu preciso entender como esse bando se mexe.', 'caetano');
      await g.camera.panTo(p.x, p.y - 8, 1.2);
      g.camera.follow = p; g.camera.targetZoom = 1;
      await g.tween(g, 'letterbox', 0, 0.5);
      p.hidden = false; p.forceCrouch = false;
    });
    g.complete('m2');
    this.addJournal('A clareira do bando', 'Uma clareira grande, cheia de terra fuçada e um barreiro no meio. O bando passa a manhã ali.');
    g.checkpoint('Mirante da clareira');
    g.ui.toast('<b>Estudar</b> · Fique escondido perto do bando e observe. Um círculo aparece sobre o animal enquanto você aprende o que ele faz.', 'tip', 7500);
    p.sneak = true;
  }

  useVine() {
    const g = this.g, f = g.flags;
    if (this.distractCd.vine > g.time) { g.ui.toast('O cipó ainda está balançando. Espere um pouco.', 'tip', 2000); return; }
    this.distractCd.vine = g.time + 22;
    const pl = P(D.VINE.palm), land = P(D.VINE.land);
    g.player.makeNoise(0.22);
    g.audio.play('rustle', { pan: g.panOf(pl.x), vol: 0.9 });
    setTimeout(() => g.audio.play('fruits', { pan: g.panOf(land.x), vol: 1 }), 300);
    for (let i = 0; i < 14; i++) g.particles.add({ type: 'leaf', x: pl.x + (Math.random() - 0.5) * 30, y: pl.y - 10, z: 30 + Math.random() * 20, vx: (Math.random() - 0.5) * 30, vy: 4, life: 3, seed: Math.random() * 9, color: i % 3 ? '#4f7a32' : '#8a4a22' });
    this.fruitT = g.time + 25;
    this.herdB.hearNoise(land.x, land.y, 3.2, 'food');
    g.caption('Frutos de buriti despencam do alto', g.panOf(land.x));
    if (!f.vineUsed) { f.vineUsed = true; this.addScore(5, 'distração'); g.ui.toast('Os queixadas adoram buriti: quem estiver perto vai lá conferir e comer um pouco.', 'tip', 5000); }
  }

  useStone() {
    const g = this.g, f = g.flags;
    if (this.distractCd.stone > g.time) { g.ui.toast('Procurando outra pedra solta…', 'tip', 1800); return; }
    this.distractCd.stone = g.time + 18;
    const a = P(D.STONE_PUSH.at), b = P(D.STONE_PUSH.land);
    this.rollingStone = { x: a.x, y: a.y - 4, fx: a.x, fy: a.y - 4, tx: b.x, ty: b.y, t: 0, dur: 1.3 };
    g.audio.play('roll', { pan: g.panOf(a.x), vol: 0.8 });
    g.player.makeNoise(0.2);
    if (!f.stoneUsed) { f.stoneUsed = true; this.addScore(5, 'distração'); }
  }

  async cutTangle() {
    const g = this.g, f = g.flags;
    if (!g.inv.has('facao')) { g.ui.toast('Sem o facão não dá pra cortar esses galhos.', 'tip'); return; }
    await g.run(async () => {
      for (let i = 0; i < 3; i++) { g.audio.play('cut'); await g.wait(0.35); }
      f.tangleCut = true; this.tangleCol.off = true;
      const tg = P(D.PUZ.tangle);
      for (let i = 0; i < 16; i++) g.particles.add({ type: 'leaf', x: tg.x + (Math.random() - 0.5) * 24, y: tg.y, z: 6 + Math.random() * 10, vx: (Math.random() - 0.5) * 30, vy: 2, life: 2, seed: Math.random() * 9, color: i % 2 ? '#6a4a2e' : '#4f7a32' });
      await g.say('Caetano', 'Embaixo dos galhos tem uma vara de pau-ferro. Madeira que não quebra.', 'caetano');
    });
    this.invalidateFlows();
  }

  // ---- toro empurrável ----
  railLen() { const r = D.PUZ.rail; let L = 0; for (let i = 0; i < r.length - 1; i++) L += Math.hypot(r[i + 1][0] - r[i][0], r[i + 1][1] - r[i][1]) * S; return L; }
  railAt(s) {
    const r = D.PUZ.rail; let acc = 0;
    for (let i = 0; i < r.length - 1; i++) {
      const L = Math.hypot(r[i + 1][0] - r[i][0], r[i + 1][1] - r[i][1]) * S;
      if (s <= acc + L || i === r.length - 2) { const k = clamp((s - acc) / L, 0, 1); return { x: px(r[i][0] + (r[i + 1][0] - r[i][0]) * k), y: px(r[i][1] + (r[i + 1][1] - r[i][1]) * k), seg: i, dir: { x: (r[i + 1][0] - r[i][0]) * S / L, y: (r[i + 1][1] - r[i][1]) * S / L }, acc, L }; }
      acc += L;
    }
    return null;
  }
  toroPos() { return this.railAt(this.g.flags.toroS || 0); }
  placeToro(s) {
    const t = this.railAt(s);
    Object.assign(this.toroCol, { x: t.x - 10, y: t.y - 5, w: 20, h: 8 });
    this.reindex(this.toroCol);
  }
  reindex(c) {
    const w = this.world;
    for (const [k, arr] of w.colGrid) { const i = arr.indexOf(c); if (i >= 0) arr.splice(i, 1); if (!arr.length) w.colGrid.delete(k); }
    const x0 = c.x, y0 = c.y, x1 = c.x + c.w, y1 = c.y + c.h;
    for (let gy = Math.floor(y0 / 64); gy <= Math.floor(y1 / 64); gy++) for (let gx = Math.floor(x0 / 64); gx <= Math.floor(x1 / 64); gx++) {
      const k = gx + ',' + gy; if (!w.colGrid.has(k)) w.colGrid.set(k, []); w.colGrid.get(k).push(c);
    }
  }
  updateToro(dt) {
    const g = this.g, f = g.flags, p = g.player;
    if (f.toroPlaced || f.trunkMoved) return;
    const t = this.toroPos();
    if (dist(p.x, p.y, t.x, t.y) > 22) { this.toroPushT = 0; return; }
    const sp = Math.hypot(p.vx, p.vy);
    if (sp < 20 || g.state !== 'play') return;
    const ux = p.vx / sp, uy = p.vy / sp;
    // o jogador precisa estar atrás do toro, empurrando na direção do trilho
    const rel = { x: t.x - p.x, y: t.y - p.y };
    if (rel.x * ux + rel.y * uy < 4) return;
    const L = this.railLen(), s0 = f.toroS || 0;
    const here = this.railAt(s0), cands = [here];
    if (s0 > 0 && Math.abs(s0 - here.acc) < 1 && here.seg > 0) cands.push(this.railAt(s0 - 1));
    if (Math.abs(s0 - (here.acc + here.L)) < 1) cands.push(this.railAt(Math.min(L, s0 + 1)));
    let best = 0, bdot = 0.55;
    for (const c of cands) { const dt2 = c.dir.x * ux + c.dir.y * uy; if (Math.abs(dt2) > bdot) { bdot = Math.abs(dt2); best = Math.sign(dt2); } }
    if (!best) return;
    const ns = clamp(s0 + best * Math.min(sp, 54) * 0.55 * dt, 0, L);
    if (ns === s0) return;
    const np = this.railAt(ns);
    // não deixa o toro passar por cima do jogador
    const qx = clamp(p.x, np.x - 10, np.x + 10), qy = clamp(p.y, np.y - 5, np.y + 3);
    if ((p.x - qx) ** 2 + (p.y - qy) ** 2 < (p.r + 0.5) ** 2) return;
    f.toroS = ns; this.placeToro(ns);
    this.toroPushT = (this.toroPushT || 0) + dt;
    if (this.toroPushT > 0.45) { this.toroPushT = 0; g.audio.play('roll', { vol: 0.35 }); g.particles.add({ type: 'puff', x: np.x, y: np.y + 3, vx: 0, vy: -3, life: 0.6, color: '#8a7a5a' }); p.makeNoise(0.3); }
    if (!f.toroTip) { f.toroTip = true; g.ui.toast('O toro rola pesado pelo chão. Empurre até ele encostar no tronco grande.', 'tip', 4500); }
    if (ns >= L - 0.5) {
      f.toroPlaced = true;
      g.audio.play('thud', { vol: 0.5 });
      g.ui.toast('O toro encaixou junto ao tronco: um apoio firme para a alavanca.', 'tip', 4500);
      this.invalidateFlows();
    }
  }
  leverReady() { return this.g.flags.toroPlaced && this.g.inv.has('vara'); }
  async leverAction() {
    const g = this.g, f = g.flags;
    if (f.trunkMoved) return;
    if (!this.leverReady()) {
      await g.run(async () => {
        await g.say('Caetano', 'Tronco pesado demais pra empurrar no braço. E a grota é estreita, não tem como passar por cima.', 'caetano');
        if (!f.toroPlaced && !g.inv.has('vara')) await g.say('Caetano', 'Com uma alavanca e um bom apoio, ele rola pra vala do lado. Preciso de uma vara forte... e de alguma coisa pra apoiar.', 'caetano');
        else if (!g.inv.has('vara')) await g.say('Caetano', 'O apoio está no lugar. Falta uma vara forte pra servir de alavanca.', 'caetano');
        else await g.say('Caetano', 'Tenho a vara, mas sem apoio ela só escorrega. Aquele toro curto ali no pátio serve, se eu empurrar até aqui.', 'caetano');
      });
      return;
    }
    await g.run(async () => {
      g.player.dir = 'up';
      await g.say('Caetano', 'Vara por baixo, toro de apoio... Agora vai.', 'caetano');
      g.audio.play('creak', { vol: 1 });
      await g.wait(0.6);
      g.audio.play('creak', { vol: 1.2 });
      g.camera.shake(1, 0.4);
      await g.wait(0.5);
      g.audio.play('roll', { vol: 1 });
      const rt = P(D.PUZ.rollTo);
      g.tween(this.trunk, 'rot', 0.35, 1.1);
      g.tween(this.trunk, 'x', rt.x, 1.1);
      await g.tween(this.trunk, 'y', rt.y, 1.1);
      g.audio.play('thud', { vol: 1 });
      g.camera.shake(3, 0.5);
      for (let i = 0; i < 18; i++) g.particles.add({ type: 'puff', x: rt.x + (Math.random() - 0.5) * 50, y: rt.y, vx: (Math.random() - 0.5) * 30, vy: -6, life: 1, color: '#9a8a6a' });
      this.trunkCol.off = true; f.trunkMoved = true;
      g.inv.remove('vara');
      await g.say('Caetano', 'Rolou pra vala. O caminho está aberto.', 'caetano');
    });
    this.invalidateFlows();
    g.complete('m5');
    g.checkpoint('Grota do tronco');
    g.ui.toast('Siga para o norte e depois para o leste pela trilha estreita.', 'tip', 4500);
  }
  invalidateFlows() { for (const h of this.herds) { h.flowP.invalidate(); h.flowH.invalidate(); } }

  async observeTapir() {
    const g = this.g, tp = this.tapir, p = g.player;
    const d = dist(tp.x, tp.y, p.x, p.y);
    if (d < 60) { g.ui.toast('Muito perto: a anta vai se assustar. Afaste-se e observe de longe.', 'warn', 3000); return; }
    if (tp.aware > 0.6) { g.ui.toast('A anta está desconfiada. Fique quieto e espere.', 'tip', 2500); return; }
    await g.run(async () => {
      p.hidden = true;
      g.camera.follow = null; g.camera.targetZoom = 1.4;
      await g.camera.panTo((tp.x + p.x) / 2, (tp.y + p.y) / 2 - 6, 1);
      await g.say('Caetano', 'Uma anta. Grandona, focinho de tromba, comendo folha na beira do barreiro.', 'caetano');
      await g.say('Caetano', 'Ela abre as trilhas que os outros bichos usam. Melhor deixar quieta.', 'caetano');
      g.camera.targetZoom = 1; g.camera.follow = p; p.hidden = false;
    });
    g.complete('s_anta');
    this.addScore(50, 'Observador da Floresta');
    this.addJournal('Conquista: Observador da Floresta', 'Uma anta no barreiro, observada de longe, sem que ela percebesse.');
  }

  // ---------- perseguição ----------
  async startChase(scripted) {
    const g = this.g, f = g.flags, p = g.player, H = this.herdD;
    if (f.chaseStarted && this.chaseActive) return;
    if (scripted) g.checkpoint('Antes da investida');
    f.chaseStarted = true; this.chaseActive = true; this.chaseEnded = false;
    if (scripted) {
      await g.run(async () => {
        p.makeNoise(1);
        g.audio.play('twig', { vol: 1.2 });
        g.caption('Um galho seco estala alto sob a bota', 0);
        await g.wait(0.45);
        for (const m of H.members) { m.alertCause = 'player'; m.aware = 1.3; m.lastSeen = { x: p.x, y: p.y }; m.lastPerceivedT = g.time; m.enter(PS.DEFENSIVE); }
        g.audio.play('clack', { pan: -0.6, vol: 1.2 });
        await g.tween(g, 'letterbox', 1, 0.35);
        g.camera.follow = null;
        await g.camera.panTo(px(129.5), px(50.2), 0.8);
        g.caption('Bater de dentes na baixada: o bando!', -0.6);
        g.camera.shake(2, 0.5);
        await g.wait(0.8);
        await g.camera.panTo(p.x, p.y - 8, 0.45);
        g.camera.follow = p;
        await g.tween(g, 'letterbox', 0, 0.3);
      });
    }
    this.releaseChasers();
    g.audio.setMood('chase');
    g.ui.alert('CORRA! ENCONTRE UM CAMINHO SEGURO!', 'run', 6000);
    g.ui.toast('<kbd>Shift</kbd> corre · <kbd>Espaço</kbd> esquiva · procure terreno alto onde o bando não suba.', 'warn', 6000);
  }
  // agenda no tempo do jogo (respeita pausa e diálogos)
  later(sec, fn) { this.timers.push({ t: this.g.time + sec, fn }); }
  releaseChasers() {
    const g = this.g, p = g.player;
    // primeiro a ameaça (batem os dentes), depois a investida: dá ao jogador um segundo para reagir
    this.herdD.members.forEach((m, i) => {
      this.later(0.7 + i * 0.35, () => {
        if (!this.chaseActive) return;
        m.alertCause = 'player'; m.aware = 1.3; m.lastSeen = { x: p.x, y: p.y }; m.lastPerceivedT = g.time; m.viaCall = i > 0;
        if (m.state !== PS.CHASE) m.enter(PS.CHASE);
      });
    });
  }
  resumeChase() {
    const g = this.g, H = this.herdD;
    const pts = D.CHASE.spawn2;
    H.members.forEach((m, i) => { const q = P(pts[i % pts.length]); m.x = q.x; m.y = q.y; m.heading = Math.PI / 2; m.enter(PS.ALERT); });
    this.chaseActive = true;
    this.later(1.8, () => {
      g.audio.play('clack', { pan: 0, vol: 1 });
      g.caption('Cascos e dentes vindo pela trilha!', 0);
      this.releaseChasers();
      g.audio.setMood('chase');
      g.ui.alert('CORRA! ENCONTRE UM CAMINHO SEGURO!', 'run', 5000);
    });
  }
  async reachLajedo() {
    const g = this.g, f = g.flags;
    if (!f.chaseStarted) return;
    this.chaseActive = false; this.chaseEnded = true;
    g.complete('m6');
    g.ui.alert('A SALVO! O BANDO NÃO CONSEGUE SUBIR NO LAJEDO.', 'safe', 4000);
    g.audio.setMood('relief');
    g.player.en = Math.max(g.player.en, 30);
    this.addJournal('A grande investida', 'Cinco queixadas saíram da baixada batendo os dentes. Corri pela trilha, atravessei o tronco sobre a grota e subi no lajedo. Lá em cima eles não chegam.');
    this.later(2.5, () => { for (const m of this.herdD.members) if (m.state === PS.CHASE) m.giveUp('barrier'); });
    g.checkpoint('Lajedo');
    await g.wait(1.5);
    await g.run(async () => { await g.say('Caetano', 'Ufa... Ficaram lá embaixo, batendo os dentes. Daqui eles não sobem.', 'caetano'); });
    g.ui.toast('Desça pelo outro lado do lajedo, para o sul, e procure o rastro do veado.', 'tip', 5000);
  }

  async examineHair() {
    const g = this.g, f = g.flags;
    await g.run(async () => {
      g.player.forceCrouch = true; g.camera.targetZoom = 1.4;
      await g.say('Caetano', 'Pelo vermelho, comprido, preso no espinho. Do veado. Passou raspando aqui, faz pouco.', 'caetano');
      g.camera.targetZoom = 1; g.player.forceCrouch = false;
    });
    f.hair = true; g.give('pelos', 1, true);
    this.addScore(10, 'pelos do veado');
    this.checkRed();
  }
  async examinePrints() {
    const g = this.g, f = g.flags;
    await g.run(async () => {
      g.player.forceCrouch = true; g.camera.targetZoom = 1.4;
      await g.say('Caetano', 'Casco fino, pontudo, o mesmo da clareira de ontem. A passada é larga: ele estava andando tranquilo, pro poente.', 'caetano');
      g.camera.targetZoom = 1; g.player.forceCrouch = false;
    });
    f.prints = true;
    this.addScore(10, 'pegadas do veado');
    this.checkRed();
  }
  checkRed() {
    const g = this.g, f = g.flags;
    if (f.hair && f.prints && !g.done.has('m7')) {
      g.complete('m7');
      this.addJournal('O rastro vermelho', 'Pelos ruivos num espinho e pegadas frescas indo para o oeste, na direção da água.');
      g.checkpoint('Rastro vermelho');
      g.ui.toast('Siga as pegadas para o oeste, até a beira da água.', 'tip', 4500);
    }
  }

  reachExit() {
    const g = this.g;
    if (this.finished) return;
    if (!g.done.has('m7')) {
      if (g.time > this.gateMsgT) { this.gateMsgT = g.time + 6; g.ui.toast('Caetano: <i>"Antes de seguir, quero ter certeza do rastro. Cadê os sinais do veado?"</i>', 'tip', 3500); }
      return;
    }
    this.finished = true;
    g.complete('m8');
    this.finalScene();
  }

  async finalScene() {
    const g = this.g, p = g.player;
    await g.run(async () => {
      g.audio.setMood('mystery');
      await g.tween(g, 'letterbox', 1, 0.6);
      await g.say('Caetano', 'A mata abre aqui, e o chão fica mole. Tem água perto: é a várzea.', 'caetano');
      const tr = P(D.FINAL_TREE);
      await g.moveTo(p, tr.x + 6, tr.y + 10, 30);
      p.dir = 'up'; p.forceCrouch = true;
      g.camera.follow = null; g.camera.targetZoom = 1.5;
      await g.camera.panTo(tr.x + 2, tr.y - 12, 1.2);
      await g.say('Caetano', 'Pegada nova do veado... e mais pelo vermelho, preso na casca.', 'caetano');
      this.marksA = 0; await g.tween(this, 'marksA', 1, 0.8);
      await g.say('Caetano', 'Mas isso aqui no tronco não é unha de bicho. Risco fino, dando volta, feito trança de palha.', 'caetano');
      await g.say('Caetano', 'Quem é que marca árvore desse jeito, no meio do nada?', 'caetano');
      g.audio.setDuck(0.1, 1.5);
      await g.wait(1);
      g.audio.play('whistle', { pan: -0.85, dur: 2.4, vol: 0.45 });
      g.caption('Um som distante, que não parece de bicho', -0.85);
      await g.wait(1.4);
      p.forceCrouch = false; p.dir = 'down';
      await g.camera.panTo(p.x + 40, p.y - 10, 1.2);
      await g.wait(0.8);
      await g.say('Caetano', '...Tem alguém aí?', 'caetano');
      await g.wait(1.4);
      g.audio.setDuck(1, 3);
      g.camera.targetZoom = 1.1;
      await g.camera.panTo(px(D.VARZEA.x + 2), px(D.VARZEA.y - 1), 2.6);
      g.ui.titleCard('FASE 2 CONCLUÍDA', 'PRÓXIMA FASE: OS SEGREDOS DA VÁRZEA', '', 'small');
      await g.wait(3.6);
      await g.tween(g, 'fade', 1, 1.8);
    });
    this.completePhase();
  }

  completePhase() {
    const g = this.g, f = g.flags;
    g.state = 'results';
    const used = this.timeLimit - g.timeLeft;
    const carry = { inv: g.inv.toJSON(), res: { ...g.res }, tracks: [...g.tracksKnown], found: [...g.inv.found] };
    Save.write({ phase: 2, completed: true, done: [...g.done], flags: { score: f.score, journal: f.journal } });
    Save.completePhase(2, { time: used, score: f.score || 0, carry, secondary: this.secondary.filter((m) => g.done.has(m.id)).map((m) => m.id) });
    g.ui.results([
      ['Tempo da expedição', formatTime(used)],
      ['Sinais do bando examinados', `${this.count.signsDone()}/4`],
      ['Padrões do bando', `${this.count.patDone()}/4`],
      ['Missões secundárias', `${this.secondary.filter((m) => g.done.has(m.id)).length}/3`],
      ['Pistas do veado', `${this.count.cluesDone()}/4`],
      ['Pontos de exploração', `${f.score || 0}`],
    ], { code: 'FASE 2 CONCLUÍDA', title: 'O Caminho dos Queixadas' });
  }

  onResume() {}
  onRestore() { const g = this.g; g.ui.clearAlert(); g.audio.setMood(this.g.flags.chaseStarted && !g.done.has('m6') ? 'chase' : 'calm'); }

  // ================= reações do bando =================
  gateClosed() { const g = this.g; return !g.done.has('m4') && (!g.done.has('m3') || this.dirty); }
  gateMessage() {
    const g = this.g;
    if (g.time < this.gateMsgT) return;
    this.gateMsgT = g.time + 7;
    if (!g.done.has('m3')) g.ui.toast('Caetano: <i>"Antes de cruzar, quero entender como esse bando se mexe."</i> (estude os animais)', 'tip', 4500);
    else g.ui.toast('Com o bando em alerta, entrar na passagem estreita é arriscado: se vierem atrás, não tem pra onde correr. Afaste-se ou esconda-se até eles se acalmarem.', 'warn', 6000);
  }
  reachPassage(ps) {
    const g = this.g;
    if (g.done.has('m4') || this.gateClosed()) return;
    g.complete('m4');
    this.addJournal('A travessia', `Cruzei a clareira até a ${ps.name} sem que o bando me percebesse.`);
    if (!this.silentFail && this.silentAttempt) {
      g.complete('s_silent');
      this.addScore(50, 'Passos Silenciosos');
      this.addJournal('Conquista: Passos Silenciosos', 'Atravessei a clareira do bando sem que nenhum queixada desconfiasse de mim.');
    }
    g.audio.setMood('calm');
    g.checkpoint('Do outro lado da clareira');
    g.ui.toast('Siga a trilha para o norte, pela mata dos troncos caídos.', 'tip', 4500);
  }
  onHerdDetect(herd, m, reason) {
    const g = this.g;
    if (herd === this.herdD) return;
    if (!g.done.has('m4')) { this.dirty = true; this.silentFail = true; }
    g.ui.alert('ALERTA: O BANDO PERCEBEU SUA PRESENÇA!', 'alert', 4500);
    if (reason && reason.text) g.ui.toast(reason.text, 'warn', 7000);
    g.audio.setMood('tension');
    if (!g.flags.detectTip) { g.flags.detectTip = true; setTimeout(() => g.ui.toast('<b>Dica</b> · Quando eles batem os dentes, recue. Para escapar, saia da clareira ou fique agachado numa moita, longe da vista, até o bando se acalmar.', 'tip', 7000), 1500); }
  }
  onHerdChase(herd, m) {
    const g = this.g;
    if (herd === this.herdD) { if (!g.flags.chaseStarted && g.done.has('m5')) this.startChase(false); return; }
    g.camera.shake(1.5, 0.3);
    g.ui.toast('Eles estão avançando! Corra para longe da clareira.', 'warn', 4000);
  }
  onGiveUp(herd, m, why) {
    const g = this.g;
    if (herd === this.herdD && this.chaseActive && !herd.members.some((q) => q.state === PS.CHASE) && why === 'lost') {
      this.chaseActive = false;
      g.ui.alert('O BANDO PERDEU SEU RASTRO. SIGA PARA O LAJEDO!', 'info', 4500);
      g.audio.setMood('stealth');
    }
  }
  onHerdCalm(herd) {
    const g = this.g;
    if (herd === this.herdD) return;
    if (this.dirty) {
      this.dirty = false;
      g.ui.toast('O bando se acalmou e voltou a comer. Pode tentar atravessar de novo.', 'tip', 5000);
    }
    g.ui.clearAlert();
    if (this.inClearing()) g.audio.setMood('stealth'); else g.audio.setMood('calm');
  }
  onHerdMove(herd) {
    const g = this.g, p = g.player;
    if (herd === this.herdB && p && dist(p.x, p.y, herd.anchor.x, herd.anchor.y) < 360) g.caption('O bando levanta e muda de lugar', g.panOf(herd.moveTo.x));
  }
  onAnimalEvent(a, ev) {
    const g = this.g;
    if (ev === 'fly') { if (!a._capT || g.time - a._capT > 6) { a._capT = g.time; g.caption('Jacus levantam voo, assustados', g.panOf(a.x)); } for (const o of g.animals) if (o !== a && o.kind === 'jacu' && dist(o.x, o.y, a.x, a.y) < 40) o.scare(); }
  }

  inClearing() { const p = this.g.player; return p && inEll(p.x / S, p.y / S, D.B_CENTER, 1.08) < 1; }

  // ================= atualização =================
  update(dt) {
    const g = this.g, p = g.player, f = g.flags;
    if (!p || !this.world) return;
    const playing = g.state === 'play';
    for (let i = this.timers.length - 1; i >= 0; i--) if (g.time >= this.timers[i].t) { const tm = this.timers[i]; this.timers.splice(i, 1); tm.fn(); }

    // segurança: nunca deixa o jogador preso dentro de um obstáculo
    this.unstick(p);

    if (playing) {
      // esbarrões fazem barulho
      this.bumpCd -= dt;
      if (this.lastPos) {
        const want = Math.hypot(p.vx, p.vy), got = Math.hypot(p.x - this.lastPos.x, p.y - this.lastPos.y) / Math.max(dt, 1e-3);
        const nearToro = !f.toroPlaced && dist(p.x, p.y, this.toroPos().x, this.toroPos().y) < 26;
        if (want > 46 && got < want * 0.22 && !p.locked && !nearToro) { this.bumpT += dt; if (this.bumpT > 0.12 && this.bumpCd <= 0) { this.bumpCd = 2.2; this.bumpT = 0; p.makeNoise(p.running ? 0.75 : 0.5); g.audio.play('stone', { vol: 0.6 }); if (this.nearHerd(220)) g.caption('Caetano esbarra no mato: barulho!', 0); } }
        else this.bumpT = 0;
      }
      // arbustos secos
      for (const z of this.dryZones) {
        if (!p.moving || dist(p.x, p.y, z.x, z.y) > z.r || g.time < z.cd) continue;
        z.cd = g.time + 0.7;
        p.makeNoise(p.sneak ? 0.36 : p.running ? 0.95 : 0.62);
        g.audio.play('bush', { vol: p.sneak ? 0.5 : 1 });
        if (!f.dryTip) { f.dryTip = true; g.caption('Folhas secas estalam na moita', 0); g.ui.toast('Arbusto seco faz barulho mesmo agachado. Contorne quando der.', 'tip', 4500); }
      }
      this.updateToro(dt);
      this.updateStudy(dt);
      this.updateCrossing();
      this.updateChase(dt);
      // primeiros ruídos do bando na trilha de entrada
      if (!f.crossSeen && p.x < px(36)) {
        this.distantT -= dt;
        if (this.distantT <= 0) { this.distantT = 7 + Math.random() * 7; g.audio.play(Math.random() < 0.6 ? 'grunt' : 'clack', { pan: 0.75, vol: 0.25 + (p.x / px(36)) * 0.3 }); if (!f.firstNoise) { f.firstNoise = true; g.caption('Grunhidos e um bater de dentes, longe, a leste', 0.75); } }
      }
    }
    this.lastPos = { x: p.x, y: p.y };

    // pedra rolando (distração)
    const rs = this.rollingStone;
    if (rs) {
      rs.t += dt;
      const k = Math.min(1, rs.t / rs.dur);
      rs.x = rs.fx + (rs.tx - rs.fx) * k; rs.y = rs.fy + (rs.ty - rs.fy) * k - Math.sin(k * Math.PI * 3) * (1 - k) * 4;
      if (Math.random() < dt * 20) g.particles.add({ type: 'puff', x: rs.x, y: rs.y + 2, vx: 0, vy: -2, life: 0.4, color: '#9a8a6a' });
      if (k >= 1) {
        this.rollingStone = null;
        g.audio.play('thud', { pan: g.panOf(rs.tx), vol: 0.5 }); g.audio.play('stone', { pan: g.panOf(rs.tx), vol: 1 });
        this.herdB.hearNoise(rs.tx, rs.ty, 2.8, 'noise');
        g.caption('Uma pedra rola e bate lá embaixo', g.panOf(rs.tx));
        this.landed = { x: rs.tx, y: rs.ty, t: g.time };
      }
    }
    if (f.chaseStarted && this.chaseActive && playing) {
      // adrenalina: correr gasta menos energia durante a investida
      if (p.running) p.en = Math.min(100, p.en + 6 * dt);
    }
  }

  nearHerd(r) { const p = this.g.player; for (const h of this.herds) for (const m of h.members) if (dist(m.x, m.y, p.x, p.y) < r) return true; return false; }

  unstick(p) {
    const w = this.world;
    if (!w.hit(p.x, p.y, p.r * 0.7) && !circleBlocked(w, p.x, p.y, p.r * 0.7)) return;
    for (let r = 3; r <= 40; r += 3) for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
      if (!w.hit(x, y, p.r) && !circleBlocked(w, x, y, p.r)) { p.x = x; p.y = y; return; }
    }
  }

  // estudo do bando: observar escondido um animal fazendo algo
  updateStudy(dt) {
    const g = this.g, p = g.player, f = g.flags;
    this.studyTarget = null;
    if (!g.done.has('m2') || g.done.has('m3')) return;
    const B = this.herdB;
    if (B.mode === 'alarmed' || B.mode === 'chase') return;
    // do alto da sapopema (mirante) se enxerga a clareira inteira por cima das moitas
    const mir = P(D.MIRANTE.at), atMirante = dist(p.x, p.y, mir.x, mir.y) < 44;
    let best = null, bd = atMirante ? 330 : 175;
    for (const m of B.members) {
      if (!m.behavior || f['pat_' + m.behavior]) continue;
      const d = dist(m.x, m.y, p.x, p.y);
      if (d > bd) continue;
      if (atMirante ? !this.treeLos(p.x, p.y - 8, m.x, m.y - 4) : !m.los(p.x, p.y - 8, m.x, m.y - 4, 18)) continue;
      // o jogador precisa estar quieto: parado ou agachado, sem ser visto agora
      if (p.running || (m.perc && m.perc.seen)) continue;
      best = m; bd = d;
    }
    if (!best) { for (const k in this.studyT) this.studyT[k] = Math.max(0, this.studyT[k] - dt * 0.5); return; }
    const k = best.behavior;
    const need = k === 'clack' ? 0.35 : 2.4;
    this.studyT[k] = (this.studyT[k] || 0) + dt * (p.moving ? 0.6 : 1);
    this.studyTarget = { m: best, k, t: this.studyT[k] / need };
    if (this.studyT[k] >= need) {
      f['pat_' + k] = true;
      const P2 = D.PATTERNS[k];
      g.audio.play('discover');
      g.ui.toast(`<b>Padrão do bando</b> · ${P2.text} (${Math.min(3, this.count.patDone())}/3)`, 'discovery', 7000);
      this.addJournal('Padrão: ' + P2.name, P2.text);
      this.addScore(10);
      if (this.count.patDone() >= 3) {
        g.complete('m3');
        g.checkpoint('Estudo do bando');
        g.ui.toast('Agora atravesse até uma das passagens (norte ou nordeste) sem ser percebido. Agachado atrás de troncos e pedras você some; contorne arbustos secos; repare no vento.', 'tip', 9000);
      }
    }
  }

  treeLos(ax, ay, bx, by) {
    const w = this.world, n = Math.ceil(dist(ax, ay, bx, by) / 6);
    for (let i = 2; i < n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      for (const c of w.near(x, y)) if (!c.off && c.r >= 4 && (x - c.x) ** 2 + (y - c.y) ** 2 < c.r * c.r) return false;
    }
    return true;
  }

  updateCrossing() {
    const g = this.g, p = g.player;
    if (g.done.has('m4') || !g.done.has('m3')) return;
    const inside = this.inClearing();
    // começa uma tentativa ao entrar na clareira; volta para a trilha de entrada para recomeçar
    if (inside && !this.silentAttempt) { this.silentAttempt = true; }
    if (!inside && p.x < px(46) && this.silentAttempt) { if (this.silentFail && this.herdB.mode === 'calm') { this.silentFail = false; g.ui.toast('Nova tentativa de Passos Silenciosos.', 'tip', 2500); } this.silentAttempt = false; }
    if (this.silentAttempt && !this.silentFail) {
      for (const m of this.herdB.members) if (!isCalm(m.state) && m.alertCause === 'player') { this.silentFail = true; g.ui.toast('Um queixada desconfiou de você: <b>Passos Silenciosos</b> falhou nesta tentativa.', 'warn', 4000); break; }
    }
    if (inside && this.herdB.mode === 'calm' && g.audio.mood === 'calm') g.audio.setMood('stealth');
  }

  updateChase(dt) {
    const g = this.g, p = g.player;
    if (!this.chaseActive) return;
    // tremor discreto quando os bichos chegam bem perto
    let close = 99;
    for (const m of this.herdD.members) if (m.state === PS.CHASE) close = Math.min(close, dist(m.x, m.y, p.x, p.y));
    if (close < 26 && Math.random() < dt * 3) g.camera.shake(0.8, 0.15);
    if (close > 260 && !this.herdD.members.some((m) => m.state === PS.CHASE || m.state === PS.DEFENSIVE)) {
      this.chaseActive = false;
      g.ui.alert('O BANDO FICOU PARA TRÁS. SIGA PARA O LAJEDO!', 'info', 4000);
      g.audio.setMood('stealth');
    }
  }

  audioEnv() {
    const g = this.g, p = g.player;
    if (!p) return {};
    let herd = 0, pan = 0, wsum = 0;
    for (const h of this.herds) for (const m of h.members) {
      const d = dist(m.x, m.y, p.x, p.y);
      if (d > 420) continue;
      const k = (1 - d / 420) * (m.speed > 30 ? 1.6 : m.speed > 4 ? 0.8 : 0.3);
      herd += k; pan += g.panOf(m.x) * k; wsum += k;
    }
    const tx = p.x / S, ty = p.y / S;
    const water = clamp(1 - Math.hypot(tx - D.VARZEA.x, ty - D.VARZEA.y) / 16, 0, 1) + clamp(1 - Math.hypot(tx - D.POND.x, ty - D.POND.y) / 8, 0, 0.4);
    const quiet = ty > 106 && tx > 99 ? 0.5 : 0;
    return { river: water * 0.8, riverPan: clamp((D.VARZEA.x - tx) / -10, -0.8, 0.8), dawn: 0, insects: 0.55 - quiet * 0.4, frogs: water * 0.4, birds: 1 - quiet * 0.3, fire: 0, herd: clamp(herd / 3, 0, 1.4), herdPan: wsum ? pan / wsum : 0, quiet };
  }

  // ================= desenho =================
  drawGround(ctx, V) {
    const g = this.g, f = g.flags, p = g.player, t = g.time;
    const vis = (x, y, m = 40) => x > V.cx - m && x < V.cx + V.vw + m && y > V.cy - m && y < V.cy + V.vh + m;
    const glint = (x, y, rx = 15, ry = 9, col = '#ffe8a0') => {
      if (!p || dist(x, y, p.x, p.y) > 72) return;
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 3 + x); ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    };
    // tronco-ponte
    const bx = px(D.BRIDGE.x), by0 = px(D.BRIDGE.y0) - 4;
    if (vis(bx, by0 + 40, 80)) {
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#000'; ctx.fillRect(bx - 6, by0 + 6, 14, this.bridgeSprite.height - 4); ctx.globalAlpha = 1;
      ctx.drawImage(this.bridgeSprite, Math.round(bx - this.bridgeSprite.width / 2), Math.round(by0));
    }
    // sinais e pistas
    const ds = Sprites.get('trk:veado', () => PR.trackSprite('veado'));
    const qs = Sprites.get('trk:queixada', () => PR.trackSprite('queixada'));
    for (const s of D.SIGNS) { const q = P(s.at); if (!vis(q.x, q.y)) continue; if (s.id === 'pegadas') { ctx.drawImage(qs, Math.round(q.x - 14), Math.round(q.y - 11)); ctx.drawImage(qs, Math.round(q.x - 4), Math.round(q.y - 6)); } if (!f['sign_' + s.id]) glint(q.x, q.y); }
    const my = P(D.MYSTERY);
    if (vis(my.x, my.y)) { ctx.globalAlpha = 0.9; ctx.drawImage(ds, Math.round(my.x - 18), Math.round(my.y - 12)); ctx.save(); ctx.translate(Math.round(my.x + 8), Math.round(my.y + 2)); ctx.scale(1, -1); ctx.drawImage(ds, -14, -11); ctx.restore(); ctx.globalAlpha = 1; if (!f.mystery) glint(my.x, my.y, 18, 10, '#ffd666'); }
    for (const c of D.CLUES) { const q = P(c.at); if (!vis(q.x, q.y) || f[c.id]) continue; if (c.id === 'c_lama' || c.id === 'c_fezes') { ctx.globalAlpha = 0.85; ctx.drawImage(ds, Math.round(q.x - 14), Math.round(q.y - 11)); ctx.globalAlpha = 1; } else if (c.id === 'c_cama') { ctx.fillStyle = 'rgba(160,150,80,0.55)'; ctx.beginPath(); ctx.ellipse(q.x, q.y, 11, 6, 0, 0, Math.PI * 2); ctx.fill(); } glint(q.x, q.y, 13, 8, '#ffd666'); }
    // rastro vermelho: pegadas que levam para o oeste
    if (g.done.has('m6')) for (let i = 0; i < D.RED_TRAIL.length; i++) { const q = P(D.RED_TRAIL[i]); if (!vis(q.x, q.y)) continue; ctx.globalAlpha = 0.75; ctx.save(); ctx.translate(Math.round(q.x), Math.round(q.y)); ctx.scale(-1, 1); ctx.drawImage(ds, -14, -11); ctx.restore(); ctx.globalAlpha = 1; }
    const dp = P(D.DEER_PRINTS_E);
    if (vis(dp.x, dp.y)) { ctx.drawImage(ds, Math.round(dp.x - 14), Math.round(dp.y - 11)); if (!f.prints) glint(dp.x, dp.y, 16, 10, '#ffd666'); }
    const hr = P(D.HAIR); if (!f.hair) glint(hr.x, hr.y - 4, 12, 9, '#ff9a6a');
    // reflexos na água da várzea
    const vz = P([D.VARZEA.x, D.VARZEA.y]);
    if (vis(vz.x, vz.y, 120)) {
      for (let i = 0; i < 22; i++) {
        const a = hash2(i, 3, 77) * Math.PI * 2, rr = Math.sqrt(hash2(i, 4, 77)) * 0.75;
        const x = vz.x + Math.cos(a) * D.VARZEA.rx * S * rr + Math.sin(t * 0.4 + i) * 3, y = vz.y + Math.sin(a) * D.VARZEA.ry * S * rr;
        ctx.globalAlpha = 0.18 + 0.16 * Math.sin(t * 1.3 + i * 1.7); ctx.fillStyle = i % 3 ? '#d8e4e0' : '#f0e8c8';
        ctx.fillRect(Math.round(x), Math.round(y), 3 + (i % 3), 1);
      }
      ctx.globalAlpha = 1;
    }
    // frutos caídos e pedra que rolou
    if (this.fruitT > t) { const fl = P(D.VINE.land); const fp = Sprites.get('fruits', () => F2.fruitPile()); ctx.drawImage(fp, Math.round(fl.x - 7), Math.round(fl.y - 4)); }
    if (this.landed && t - this.landed.t < 20) { const rk = Sprites.get('rock:3', () => N.rockSprite(603, 6)); ctx.drawImage(rk, Math.round(this.landed.x - rk.width / 2), Math.round(this.landed.y - rk.height + 2)); }
    if (this.rollingStone) { const rk = Sprites.get('rock:3', () => N.rockSprite(603, 6)); ctx.drawImage(rk, Math.round(this.rollingStone.x - rk.width / 2), Math.round(this.rollingStone.y - rk.height + 2)); }
    // marca de encaixe do toro
    if (!f.toroPlaced && g.done.has('m4')) { const end = P(D.PUZ.rail[2]); ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 2); ctx.strokeStyle = '#e8d8a0'; ctx.setLineDash([2, 2]); ctx.strokeRect(Math.round(end.x - 11), Math.round(end.y - 5), 22, 9); ctx.setLineDash([]); ctx.globalAlpha = 1; }
    // interativos da clareira
    if (!g.done.has('m2')) { const m = P(D.MIRANTE.at); glint(m.x, m.y, 14, 8); }
    if (g.done.has('m2')) { for (const k of ['VINE', 'STONE_PUSH']) { const q = P(D[k].at); if (vis(q.x, q.y)) glint(q.x, q.y, 10, 6, '#a8d8f0'); } }
  }

  // copas ficam translúcidas sobre os queixadas próximos e sobre o foco das cenas
  crownClear(V) {
    const g = this.g, p = g.player, out = this._clear || (this._clear = []);
    out.length = 0;
    if (!p) return out;
    if (g.state === 'cutscene' && !g.camera.follow) out.push({ x: g.camera.x, y: g.camera.y + 8, r: 60, min: 0.3 });
    for (const h of this.herds) for (const m of h.members) {
      if (m.x < V.cx - 40 || m.x > V.cx + V.vw + 40 || m.y < V.cy - 20 || m.y > V.cy + V.vh + 60) continue;
      if (dist(m.x, m.y, p.x, p.y) < 240) out.push({ x: m.x, y: m.y, r: 18, min: 0.4 });
    }
    if (this.tapir && this.tapir.visible && dist(this.tapir.x, this.tapir.y, p.x, p.y) < 240) out.push({ x: this.tapir.x, y: this.tapir.y, r: 22, min: 0.4 });
    return out;
  }

  drawWorldOverlay(ctx) {
    const st = this.studyTarget;
    if (st) {
      const m = st.m, x = m.x, y = m.y - 22;
      ctx.globalAlpha = 0.85; ctx.strokeStyle = 'rgba(20,14,6,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#a8e0ff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(st.t, 0, 1)); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  drawAfterLight(ctx) {
    if (!this.marksA) return;
    const tr = P(D.FINAL_TREE);
    // riscos finos em trança, na casca clara por baixo
    ctx.globalAlpha = this.marksA * 0.85; ctx.fillStyle = '#d8c8a0';
    for (let i = 0; i < 7; i++) {
      const y = Math.round(tr.y - 32 + i * 3);
      for (let k = 0; k < 3; k++) { ctx.fillRect(Math.round(tr.x - 3 + k + (i % 2) * 2), y + k, 1, 1); ctx.fillRect(Math.round(tr.x + 3 - k - (i % 2) * 2), y + k, 1, 1); }
    }
    ctx.fillStyle = '#5a3a24'; ctx.fillRect(Math.round(tr.x - 1), Math.round(tr.y - 12), 3, 2); ctx.fillRect(Math.round(tr.x - 2), Math.round(tr.y - 14), 1, 2); ctx.fillRect(Math.round(tr.x + 2), Math.round(tr.y - 14), 1, 2);
    ctx.globalAlpha = 1;
  }
}

// ======================================================================
// Anta: pasta perto do barreiro; percebe por som, visão e faro; foge e volta mais tarde
// ======================================================================
class Tapir {
  constructor(g, home, phase) {
    this.g = g; this.ph = phase; this.x = home.x; this.y = home.y; this.home = { ...home };
    this.state = 'graze'; this.timer = 3; this.aware = 0; this.face = 1; this.anim = 0; this.frame = 0; this.visible = true; this.target = null; this.whistleT = 8;
  }
  update(dt) {
    const g = this.g, p = g.player;
    if (!p) return;
    const d = dist(this.x, this.y, p.x, p.y);
    this.timer -= dt; this.whistleT -= dt;
    if (!this.visible) { if (this.timer <= 0 && d > 200) { this.visible = true; this.state = 'graze'; this.aware = 0; this.x = this.home.x; this.y = this.home.y; } return; }
    if (d > 500) return;
    let s = 0;
    const nr = p.noiseRadius() * 0.8; if (d < nr) s += 1.6 * (1 - d / nr) + 0.2;
    const sr = 64 * p.vis; if (d < sr) s += 1.2 * (1 - d / sr) + 0.2;
    if (d < 90 && g.isDownwind(p, this)) s += 0.7;
    if (d < 44) s += 1.5;
    this.aware = s > 0 ? Math.min(1.3, this.aware + s * dt) : Math.max(0, this.aware - dt * 0.25);
    let mx = 0, my = 0, sp = 0;
    if (this.state !== 'flee' && this.aware >= 1) {
      this.state = 'flee'; this.timer = 3;
      g.audio.play('tapir', { pan: g.panOf(this.x), vol: 1 }); g.audio.play('splash', { pan: g.panOf(this.x), vol: 0.6 });
      g.caption('A anta dispara para dentro da mata', g.panOf(this.x));
      if (!g.done.has('s_anta')) g.ui.toast('A anta se assustou. Ela volta depois de um tempo, se você se afastar.', 'tip', 4500);
    }
    if (this.state === 'flee') {
      const tx = this.home.x - 60, ty = this.home.y - 40;
      const dx = tx - this.x, dy = ty - this.y, m = Math.hypot(dx, dy) || 1;
      mx = dx / m; my = dy / m; sp = 70;
      if (m < 8 || this.timer <= 0) { this.visible = false; this.timer = 35; }
    } else if (this.state === 'walk') {
      const dx = this.target.x - this.x, dy = this.target.y - this.y, m = Math.hypot(dx, dy) || 1;
      mx = dx / m; my = dy / m; sp = 9;
      if (m < 3 || this.timer <= 0) { this.state = 'graze'; this.timer = 4 + Math.random() * 6; }
    } else if (this.timer <= 0) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 40;
      this.target = { x: this.home.x + Math.cos(a) * r, y: this.home.y + Math.sin(a) * r * 0.6 }; this.state = 'walk'; this.timer = 8;
    }
    if (sp) {
      const ox = this.x;
      this.g.world.moveCircle(this, mx * sp * dt, my * sp * dt, 5, true);
      if (Math.abs(this.x - ox) > 0.01) this.face = this.x > ox ? 1 : -1;
      this.anim += dt * (sp > 30 ? 10 : 3); this.frame = Math.floor(this.anim) % 4;
    }
    if (this.whistleT <= 0) { this.whistleT = 14 + Math.random() * 14; if (d < 300) { g.audio.play('tapir', { pan: g.panOf(this.x), vol: 0.5 * (1 - d / 300) }); if (!g.flags.tapirCap) { g.flags.tapirCap = true; g.caption('Um assobio fino vindo do barreiro', g.panOf(this.x)); } } }
  }
  draw(ctx) {
    if (!this.visible) return;
    const head = this.state === 'graze' && Math.sin(this.g.time * 0.8) > -0.3 ? 'down' : 'mid';
    const k = `tapir:${this.frame}:${head}:${this.face < 0 ? 1 : 0}`;
    const s = Sprites.get(k, () => { const c = tapirSprite(this.frame, head); return this.face < 0 ? flipCanvas(c) : c; });
    ctx.globalAlpha = 0.28; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(this.x, this.y + 1, 13, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.drawImage(s, Math.round(this.x - 17), Math.round(this.y - 18));
    if (this.aware > 0.3 && this.state !== 'flee') {
      const x = Math.round(this.x), y = Math.round(this.y - 23);
      ctx.fillStyle = '#f4f0e0'; ctx.fillRect(x - 1, y - 6, 3, 1); ctx.fillRect(x + 1, y - 5, 1, 1); ctx.fillRect(x, y - 4, 1, 1); ctx.fillRect(x, y - 1, 1, 1);
    }
  }
}

export { makeCanvas, hash2 };
