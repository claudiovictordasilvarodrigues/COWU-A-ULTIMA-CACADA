// FASE 1 — A PRIMEIRA PEGADA
// Comunidade ribeirinha, roça e floresta de terra firme ao amanhecer.
import { mulberry32, fbm, valueNoise, clamp, dist, hash2 } from '../core/util.js';
import { World, T } from '../engine/world.js';
import { Sprites } from '../gfx/sprites.js';
import { makeCanvas, flipCanvas } from '../gfx/pixel.js';
import * as N from '../gfx/art-nature.js';
import * as PR from '../gfx/art-props.js';
import { NPC } from '../entities/npc.js';
import { Animal, MonkeyTroop, Flyovers, Butterfly } from '../entities/animals.js';
import { ITEMS } from '../data/items.js';
import { Save } from '../core/save.js';
import { formatTime } from '../core/util.js';

const TW = 120, TH = 110, S = 16;
const px = (t) => t * S;
const shoreY = (tx) => 99 + 2.4 * Math.sin(tx * 0.07) + 1.4 * Math.sin(tx * 0.19 + 1.3);
const creekY = (tx) => 52 + 5 * Math.sin(tx * 0.055 + 0.4) + 2 * Math.sin(tx * 0.16 + 2);
const creekHW = (tx) => 1.7 + 0.35 * Math.sin(tx * 0.3);

const BRIDGE_TX = 64;
const BR_CY = creekY(BRIDGE_TX), BR_HW = creekHW(BRIDGE_TX);
const BRIDGE = { x: px(BRIDGE_TX), y0: px(BR_CY - BR_HW - 1.5), y1: px(BR_CY + BR_HW + 1.6) };

const TRAILS = [
  { r: 1.15, pts: [[47, 90.6], [52, 91], [57, 90.2], [60, 86], [60, 80], [58.5, 74], [59, 70], [62, 64], [63.6, 58], [64, BR_CY + BR_HW + 1.4]] },
  { r: 1.1, pts: [[64, BR_CY - BR_HW - 1.4], [65, 41], [68, 38], [70, 35.5], [69, 30], [68, 25], [68, 21]] },
  { r: 0.9, pts: [[47, 90.6], [43, 92.5], [38, 96.5], [31, shoreY(31) - 1.2]] },
  { r: 0.8, pts: [[57.5, 90.2], [60.3, 94]] },
  { r: 0.85, pts: [[60, 86], [66, 88.6], [74, 88.8], [80, 88.6], [85, 87.4]] },
  { r: 0.75, pts: [[58.5, 74], [50, 72.4], [41, 71.2], [31, 68.4], [26, 67.4]] },
  { r: 0.7, pts: [[41, 71.2], [38, 65], [36.5, 61.4]] },
  { r: 0.75, pts: [[62, 64], [71, 66.8], [79, 70.2], [86, 67], [91, 64], [95, 62]] },
  { r: 0.7, pts: [[69, 30], [61, 28.4], [54, 30.2]] },
  { r: 0.7, pts: [[70, 35.5], [79, 33.6], [87, 29.4]] },
];
const CLEARINGS = [
  { x: 95, y: 62.5, r: 4.6 }, { x: 68, y: 20.5, r: 5 }, { x: 70, y: 36.2, r: 2.6 },
  { x: 24.5, y: 67, r: 3.4 }, { x: 36.5, y: 61, r: 1.8 }, { x: 82.5, y: 70.4, r: 2.4 },
];
// zonas onde não nascem árvores (tiles)
const KEEP_CLEAR = [
  [82, 69.4, 3.2], [55, 67, 2.4], [24.5, 66.5, 4.4], [36.5, 60.5, 2.6], [68, 20, 6], [70, 36.5, 3.4],
  [77.2, 18.4, 1.6], [59, 76, 2.2], [53, 30.2, 1.6], [88, 29, 1.8], [96.5, 63.5, 2], [64, BR_CY, 4],
];

export const TRACKS = [
  { id: 't_cotia', kind: 'cotia', name: 'Cotia', at: [27.6, 69], desc: 'Marquinhas pequenas e finas, em pares espaçados, como de bicho que anda aos pulinhos. Ao lado, cascas de castanha roídas.', options: ['Anta', 'Cotia', 'Tatu'], correct: 1, note: 'Cotia. Roedor ligeiro que enterra sementes e acaba plantando a mata.' },
  { id: 't_tatu', kind: 'tatu', name: 'Tatu', at: [44, 73.6], desc: 'Um buraco redondo no pé do barranco, terra fresca jogada para fora e riscos de unhas compridas.', options: ['Paca', 'Queixada', 'Tatu'], correct: 2, note: 'Toca de tatu. A terra ainda está úmida: cavou esta noite.' },
  { id: 't_queixada', kind: 'queixada', name: 'Queixada', at: [92.4, 65.6], desc: 'Muitas pegadas pequenas de casco partido, misturadas, e o chão todo fuçado. Um cheiro forte e azedo ainda no ar.', options: ['Veado', 'Queixada', 'Capivara'], correct: 1, note: 'Bando de queixadas. Muitos. Melhor não cruzar com eles.' },
  { id: 't_anta', kind: 'anta', name: 'Anta', at: [97.4, 59.6], desc: 'Pegada grande, com três dedos largos e arredondados, numa trilha bem batida que desce direto para a água.', options: ['Anta', 'Onça', 'Capivara'], correct: 0, note: 'Anta. Ela abre trilhas que os outros bichos também usam.' },
  { id: 't_capivara', kind: 'capivara', name: 'Capivara', at: [29.5, shoreY(29.5) - 1.6], desc: 'Pegadas de dedos largos, com uma pelezinha entre eles, coladas à beira d\'água. Perto, bolinhas de fezes em forma de grão de feijão.', options: ['Jacaré', 'Capivara', 'Cotia'], correct: 1, note: 'Capivaras. Devem estar por perto, na beira do rio.' },
  { id: 't_onca', kind: 'onca', name: 'Onça-pintada', at: [53.5, creekY(53.5) + creekHW(53.5) + 2.6], desc: 'Pegada redonda, quatro dedos e uma almofada larga, sem marca de unha. Coisa grande, que passou devagar.', options: ['Cachorro-do-mato', 'Anta', 'Onça-pintada'], correct: 2, note: 'Onça. Gato não deixa marca de unha. Passou beirando o igarapé.' },
];

const EQUIP = ['paneiro', 'espingarda', 'facao', 'cantil', 'lanterna', 'marmita'];
const HOUSE_C = { x: px(46), y: px(88) }, HOUSE_R = { x: px(70), y: px(87) }, HOUSE_Z = { x: px(55.5), y: px(89) };
const FARINHA = { x: px(80.5), y: px(86) };
const JIRAU = { x: HOUSE_C.x - 27, y: HOUSE_C.y + 14 };
const SAPOPEMA = { x: px(82), y: px(69.4) };
const BURROW = { x: SAPOPEMA.x + 17, y: SAPOPEMA.y + 5 };
const CIPO_TREE = { x: px(55), y: px(67) };
const FALLEN = { x: px(24.5), y: px(66.2) };
const OLD_CANOE = { x: px(36.4), y: px(creekY(36.4) + creekHW(36.4) + 1.7) };
const DEER_PRINT = { x: px(70), y: px(36.6) };
const CAMP = { x: px(68), y: px(21) };
const FINAL_PRINT = { x: px(72.6), y: px(20.4) };
const EYES = { x: px(77.2), y: px(18.2) };
const TRAILHEAD = { x: px(59), y: px(76) };
const GATE_Y = px(79.2);
const GALHOS = [[61.5, 26.4], [75.5, 24.8], [64.6, 32.2]];
const COLLECT = { caco: [99, 81.6], pena: [96.8, 63.8], anzol: [37.6, OLD_CANOE.y / S - 0.2], jarina: [53, 30.2], jabuti: [88.2, 29] };
const DOCK = { x0: 59.6, x1: 61.1, y0: 93.6 };

export function createPhase1(g) { return new Phase1(g); }

class Phase1 {
  constructor(g) {
    this.g = g;
    this.id = 1; this.code = 'FASE 1'; this.title = 'A PRIMEIRA PEGADA';
    this.timeLimit = 40 * 60;
    this.todStart = 302;
    this.spawn = { x: HOUSE_C.x - 2, y: HOUSE_C.y + 22 };
    this.menuPath = [{ x: px(42), y: px(90) }, { x: px(82), y: px(84) }];
    this.trackDefs = TRACKS;
    this.covers = []; this.coverGrid = new Map();
    this.pois = [
      { name: 'Sua casa', x: HOUSE_C.x, y: HOUSE_C.y }, { name: 'Seu Raimundo', x: HOUSE_R.x, y: HOUSE_R.y },
      { name: 'Casa de farinha', x: FARINHA.x, y: FARINHA.y }, { name: 'Trapiche', x: px(60.3), y: px(97) },
      { name: 'Roça', x: px(93), y: px(86) }, { name: 'Início da trilha', x: TRAILHEAD.x, y: TRAILHEAD.y },
      { name: 'Árvore caída', x: FALLEN.x, y: FALLEN.y }, { name: 'Canoa velha', x: OLD_CANOE.x, y: OLD_CANOE.y },
      { name: 'Sapopema grande', x: SAPOPEMA.x, y: SAPOPEMA.y }, { name: 'Clareira', x: px(95), y: px(62.5) },
      { name: 'Ponte', x: BRIDGE.x, y: (BRIDGE.y0 + BRIDGE.y1) / 2 }, { name: 'Pegada do veado', x: DEER_PRINT.x, y: DEER_PRINT.y },
      { name: 'Clareira do acampamento', x: CAMP.x, y: CAMP.y },
    ];
    this.buildMissions();
  }

  // ---------------- missões ----------------
  buildMissions() {
    const g = this.g;
    const nextEquip = () => { const i = EQUIP.find((id) => !g.inv.has(id)); return i ? this.equipPos(i) : null; };
    const nearestTrack = () => {
      let best = null, bd = 1e9;
      for (const t of TRACKS) {
        if (g.tracksKnown.has(t.id)) continue;
        const x = px(t.at[0]), y = px(t.at[1]);
        if (y < BRIDGE.y1 && !g.flags.bridge) continue;
        const d = dist(x, y, g.player.x, g.player.y);
        if (d < bd) { bd = d; best = { x, y }; }
      }
      return best;
    };
    this.missions = [
      { id: 'prep', title: 'Preparar o paneiro e os equipamentos', progress: () => `${EQUIP.filter((i) => g.inv.has(i)).length}/6`, hint: 'Os equipamentos estão no jirau, ao lado da escada da sua casa, e o paneiro está no chão perto da porta. Chegue perto e aperte E.', target: nextEquip },
      { id: 'talk', title: 'Conversar com Seu Raimundo sobre o veado', hint: 'Seu Raimundo mora na casa verde, a leste da sua, depois da casa do Zé. Ele está na frente de casa, de pé desde cedo.', target: () => ({ x: HOUSE_R.x - 8, y: HOUSE_R.y + 18 }) },
      { id: 'trail', title: 'Encontrar a trilha do igarapé', hint: 'Saia da comunidade pelo caminho de terra que sobe para o norte, entre a casa do Zé e a de Seu Raimundo. O começo da trilha tem um esteio com pano vermelho amarrado.', target: () => TRAILHEAD },
      { id: 'tracks', title: 'Identificar três rastros de animais', progress: () => `${g.tracksKnown.size}/3`, hint: 'Rastros aparecem como marcas escuras no chão e brilham de leve quando você chega perto. Há rastros na beira do rio (oeste da comunidade), perto da árvore caída, no barranco, na beira do igarapé e na clareira do leste. Examine com E e escolha o bicho certo.', target: nearestTrack },
      { id: 'paca', title: 'Encontrar uma paca escondida entre as raízes', hint: 'Dona Socorro falou da sapopema grande, a leste da trilha. Chegue agachado (C), parado é ainda melhor. Olhe o vento no minimapa: se ele soprar de você para a paca, ela sente seu cheiro. Chegue pelo lado de onde o vento vem.', target: () => ({ x: SAPOPEMA.x + 20, y: SAPOPEMA.y + 10 }) },
      {
        id: 'bridge', title: 'Consertar e atravessar a pontezinha',
        progress: () => g.flags.bridge ? '' : `tábuas ${Math.min(3, g.inv.count('tabua'))}/3 · cipó ${g.inv.has('cipo') ? 1 : 0}/1`,
        hint: () => g.flags.bridge ? 'A ponte está firme. Atravesse para o lado norte do igarapé.' : 'A ponte do igarapé perdeu tábuas na última cheia. Zé disse que pode levar uma tábua da pilha ao lado da casa dele, e que a canoa velha largada na beira do igarapé, a oeste, ainda tem tábuas soltas. Para amarrar, corte cipó-titica com o facão: tem um pendurado numa árvore grande à beira da trilha.',
        target: () => {
          if (g.flags.bridge) return { x: BRIDGE.x, y: BRIDGE.y0 - 20 };
          if (g.inv.count('tabua') >= 3 && g.inv.has('cipo')) return { x: BRIDGE.x, y: BRIDGE.y1 + 8 };
          const opts = [];
          if (!g.flags.tabuaZe) opts.push({ x: HOUSE_Z.x - 46, y: HOUSE_Z.y + 6 });
          if (!g.flags.tabuasCanoa) opts.push({ x: OLD_CANOE.x, y: OLD_CANOE.y + 6 });
          if (!g.flags.cipo) opts.push({ x: CIPO_TREE.x + 14, y: CIPO_TREE.y + 4 });
          opts.sort((a, b) => dist(a.x, a.y, g.player.x, g.player.y) - dist(b.x, b.y, g.player.x, g.player.y));
          return opts[0] || { x: BRIDGE.x, y: BRIDGE.y1 + 8 };
        },
      },
      { id: 'deer', title: 'Localizar a primeira pegada do veado-vermelho', hint: 'Do outro lado do igarapé, siga a trilha para o norte até uma clareira pequena. O chão ali é mole e guarda bem as marcas.', target: () => DEER_PRINT },
      { id: 'camp', title: 'Montar um pequeno acampamento', progress: () => `galhos ${Math.min(3, g.inv.count('galhos'))}/3`, hint: 'Junte 3 feixes de galhos secos (ficam perto da trilha, ao norte da pegada) e monte o acampamento na clareira grande mais ao norte. As outras missões precisam estar concluídas.', target: () => { const i = GALHOS.findIndex((_, k) => !g.flags['galho' + k]); return g.inv.count('galhos') >= 3 || i < 0 ? CAMP : { x: px(GALHOS[i][0]), y: px(GALHOS[i][1]) }; } },
    ];
  }
  currentMission() {
    const g = this.g, order = this.missions;
    const first = order.find((m) => !g.done.has(m.id));
    if (!first) return null;
    // ao norte do igarapé, prioriza o que está ao norte
    if (g.player && g.player.y < BRIDGE.y0 && g.done.has('bridge')) {
      for (const id of ['deer', 'camp']) if (!g.done.has(id)) {
        if (id === 'camp' && !['prep', 'talk', 'trail', 'tracks', 'paca', 'bridge', 'deer'].every((k) => g.done.has(k))) {
          return order.find((m) => !g.done.has(m.id) && m.id !== 'camp') || first;
        }
        return order.find((m) => m.id === id);
      }
    }
    return first;
  }
  todCap() {
    const d = this.g.done;
    if (d.has('camp')) return 450;
    if (d.has('deer')) return 425;
    if (d.has('bridge')) return 400;
    if (d.has('trail')) return 372;
    if (d.has('talk')) return 352;
    if (d.has('prep')) return 335;
    return 322;
  }

  // ---------------- construção estática ----------------
  async buildStatic(progress) {
    const w = (this.world = new World(TW, TH));
    await progress(0.08, 'Traçando trilhas e igarapés…');
    // campos de trilha (resolução de célula 2px) e proximidade (tile)
    const cw = w.cw, ch = w.ch;
    const trail = new Float32Array(cw * ch);
    const nearT = new Float32Array(TW * TH);
    for (const tr of TRAILS) {
      for (let i = 0; i < tr.pts.length - 1; i++) {
        const [ax, ay] = tr.pts[i], [bx, by] = tr.pts[i + 1];
        const L = Math.hypot(bx - ax, by - ay), n = Math.ceil(L / 0.25);
        for (let k = 0; k <= n; k++) {
          const t = k / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
          const R = tr.r * 8;
          const cx0 = Math.floor(x * 8 - R), cx1 = Math.ceil(x * 8 + R), cy0 = Math.floor(y * 8 - R), cy1 = Math.ceil(y * 8 + R);
          for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
            if (cx < 0 || cy < 0 || cx >= cw || cy >= ch) continue;
            const d = Math.hypot(cx + 0.5 - x * 8, cy + 0.5 - y * 8) / R;
            if (d < 1) { const v = 1 - d; const i2 = cy * cw + cx; if (v > trail[i2]) trail[i2] = v; }
          }
          const RT = tr.r + 2.2;
          for (let ty = Math.floor(y - RT); ty <= Math.ceil(y + RT); ty++) for (let tx = Math.floor(x - RT); tx <= Math.ceil(x + RT); tx++) {
            if (tx < 0 || ty < 0 || tx >= TW || ty >= TH) continue;
            const d = Math.hypot(tx + 0.5 - x, ty + 0.5 - y) / RT;
            if (d < 1) nearT[ty * TW + tx] = Math.max(nearT[ty * TW + tx], 1 - d);
          }
        }
      }
    }
    this.nearTrail = (tx, ty) => { const i = (ty | 0) * TW + (tx | 0); return nearT[i] || 0; };
    await progress(0.18, 'Enchendo o rio…');

    w.generate((tx, ty) => {
      const n = fbm(tx * 0.15, ty * 0.15, 3, 3);
      const n2 = valueNoise(tx * 0.6, ty * 0.6, 8);
      const sy = shoreY(tx) + (n - 0.5) * 0.8;
      if (tx > DOCK.x0 && tx < DOCK.x1 && ty > DOCK.y0 && ty < sy + 4.2) return [T.WOOD];
      if (ty > sy) return [T.RIVER, clamp((ty - sy) / 5, 0, 1)];
      const cy = creekY(tx), hw = creekHW(tx) + (n - 0.5) * 0.5, dc = Math.abs(ty - cy);
      if (dc < hw) return [T.CREEK, clamp((hw - dc) / hw, 0, 1)];
      if (dc < hw + 0.7 + n2 * 0.7) return [T.MUD];
      if (ty > sy - 2.2 - n * 1.2) return [T.SAND];
      const tf = trail[Math.floor(ty * 8) * cw + Math.floor(tx * 8)];
      if (tf > 0.42 + (n2 - 0.5) * 0.3) return [T.DIRT];
      const ce = ((tx - 60) / 25) ** 2 + ((ty - 90) / 10) ** 2;
      if (ce < 1 + (n - 0.5) * 0.5) return [T.GRASS];
      if (tx > 84 + n * 1.5 && tx < 103 - n * 1.5 && ty > 79 + n2 && ty < 94.5) return [T.ROCA];
      for (const c of CLEARINGS) if (Math.hypot(tx - c.x, ty - c.y) / c.r < 1 + (n - 0.5) * 0.5) return [T.CLEAR];
      if (n > 0.7 && Math.abs(ty - cy) < 7) return [T.MUD];
      return [T.FLOOR];
    });
    w.waterTiles = new Uint8Array(TW * TH);
    for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) {
      const t = w.terrainAt(tx * 16 + 8, ty * 16 + 8);
      w.waterTiles[ty * TW + tx] = t === T.RIVER ? 1 : t === T.CREEK ? 2 : 0;
    }
    await progress(0.38, 'Plantando a floresta…');
    this.placeVegetation();
    await progress(0.6, 'Erguendo as palafitas…');
    this.placeProps();
    await progress(0.7, 'Espalhando folhas no chão…');
    const gctx = w.renderGround();
    this.decorateGround(gctx);
    await progress(0.9, 'Desenhando o mapa…');
    w.buildDensityCanvas();
    w.buildMiniMap();
    this.buildMist();
    await progress(0.98, 'Quase lá…');
  }

  addCover(x, y, r) {
    const c = { x, y, r };
    this.covers.push(c);
    const k = ((x / 64) | 0) + ',' + ((y / 64) | 0);
    if (!this.coverGrid.has(k)) this.coverGrid.set(k, []);
    this.coverGrid.get(k).push(c);
  }
  isInCover(x, y) {
    const gx = (x / 64) | 0, gy = (y / 64) | 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const a = this.coverGrid.get((gx + i) + ',' + (gy + j));
      if (a) for (const c of a) if ((x - c.x) ** 2 + ((y - c.y) * 1.4) ** 2 < c.r * c.r) return true;
    }
    return false;
  }

  tree(x, y, size, seed) {
    const w = this.world;
    const v = seed % 6;
    let th, tw2, bt, cr, pal;
    if (size === 'big') { th = 36 + (v % 3) * 4; tw2 = 9; bt = 7 + (v % 2) * 2; cr = 36 + (v % 3) * 4; pal = N.GREENS.deep; }
    else if (size === 'mid') { th = 24 + (v % 3) * 3; tw2 = 6; bt = v % 2 ? 3 : 0; cr = 22 + (v % 3) * 3; pal = v % 2 ? N.GREENS.mid : N.GREENS.olive; }
    else { th = 15 + (v % 2) * 3; tw2 = 4; bt = 0; cr = 13 + (v % 2) * 2; pal = N.GREENS.light; }
    const trunk = Sprites.get(`tr:${size}:${v}`, () => N.trunkSprite(500 + v * 13 + size.length, th, tw2, bt, size === 'small' ? ['#4a3a2a', '#5e4a36', '#76604a', '#8e785e'] : undefined));
    const crown = Sprites.get(`cr:${size}:${v}`, () => N.crownSprite(900 + v * 31 + size.length * 7, cr, pal));
    const d = w.addDrawable({ x, y, sprite: trunk, ax: trunk.width / 2, ay: trunk.height - 2, crown: { sprite: crown, dx: 0, dy: -th - cr * 0.3, r: cr, h: th }, kind: 'tree', size });
    w.addCollider({ x, y: y - 2, r: tw2 / 2 + (bt ? bt * 0.6 : 0) + 1 });
    w.addDensity(x, y - th - cr * 0.3, cr * 1.05, size === 'big' ? 1 : 0.8);
    return d;
  }

  placeVegetation() {
    const w = this.world, rng = mulberry32(1337);
    const terr = (tx, ty) => w.terrainAt(tx * 16, ty * 16);
    const blockedKeep = (tx, ty, extra = 0) => KEEP_CLEAR.some(([x, y, r]) => Math.hypot(tx - x, ty - y) < r + extra);
    const bigs = [];
    this.canopyNodes = [];

    // árvores explícitas
    const specials = [
      [SAPOPEMA.x, SAPOPEMA.y, 'big', 2], [CIPO_TREE.x, CIPO_TREE.y, 'big', 4], [px(65.4), px(19.2), 'mid', 1], [px(70.8), px(19.4), 'mid', 3],
      [px(64), px(16), 'big', 0], [px(74), px(15.5), 'big', 5],
    ];
    for (const [x, y, s, v] of specials) { const d = this.tree(x, y, s, v); bigs.push([x / S, y / S]); this.canopyNodes.push({ x: d.x, y: d.y + d.crown.dy }); }

    for (let ty = 3; ty < TH - 2; ty += 1.9) for (let tx = 2; tx < TW - 2; tx += 1.9) {
      const x = tx + rng() * 1.7, y = ty + rng() * 1.7;
      const t = terr(x, y);
      const nearCreek = Math.abs(y - creekY(x)) < 6.5;
      if (t === T.MUD) {
        if (rng() < 0.25 && !blockedKeep(x, y)) this.palm(px(x), px(y), rng() < 0.6 ? 'acai' : 'buriti', (rng() * 9) | 0);
        else if (rng() < 0.3) this.plant(px(x), px(y), 'heliconia', (rng() * 9) | 0);
        continue;
      }
      if (t !== T.FLOOR) {
        if (t === T.CLEAR && rng() < 0.12 && !blockedKeep(x, y)) this.plant(px(x), px(y), rng() < 0.5 ? 'fern' : 'bush', (rng() * 9) | 0);
        continue;
      }
      if (blockedKeep(x, y)) continue;
      const nt = this.nearTrail(x, y);
      if (nt > 0.05) { if (nt < 0.45 && rng() < 0.35) this.plant(px(x), px(y), rng() < 0.4 ? 'fern' : 'bush', (rng() * 9) | 0); continue; }
      if (y > 78.5 && y < 81) continue; // faixa da cerca de mata atrás da comunidade fica mais limpa
      const r = rng();
      if (r < 0.11 && !bigs.some(([bx, by]) => Math.hypot(bx - x, by - y) < 5)) { const d = this.tree(px(x), px(y), 'big', (rng() * 6) | 0); bigs.push([x, y]); this.canopyNodes.push({ x: d.x, y: d.y + d.crown.dy }); }
      else if (r < 0.44) { const d = this.tree(px(x), px(y), 'mid', (rng() * 6) | 0); if (rng() < 0.3) this.canopyNodes.push({ x: d.x, y: d.y + d.crown.dy }); }
      else if (r < 0.54) this.tree(px(x), px(y), 'small', (rng() * 6) | 0);
      else if (r < 0.66 && nearCreek) this.palm(px(x), px(y), 'acai', (rng() * 9) | 0);
      else if (r < 0.69) this.palm(px(x), px(y), 'embauba', (rng() * 9) | 0);
      else if (r < 0.74) this.palm(px(x), px(y), 'acai', (rng() * 9) | 0);
      else this.plant(px(x), px(y), rng() < 0.55 ? 'bush' : rng() < 0.6 ? 'fern' : 'heliconia', (rng() * 9) | 0);
    }
    // sub-bosque extra (arbustos de esconderijo)
    for (let i = 0; i < 1500; i++) {
      const x = 3 + rng() * (TW - 6), y = 4 + rng() * (TH - 8);
      if (terr(x, y) !== T.FLOOR || blockedKeep(x, y, -0.6)) continue;
      const nt = this.nearTrail(x, y);
      if (nt > 0.55) continue;
      this.plant(px(x), px(y), rng() < 0.6 ? 'bush' : 'fern', (rng() * 9) | 0);
    }
    // comunidade: frutíferas, bananeiras, açaizeiros e embaúbas
    const village = [[40, 85, 'banana'], [43, 84.5, 'acai'], [52, 85, 'banana'], [64.5, 84.5, 'acai'], [66, 85.5, 'banana'], [76, 84.6, 'banana'], [37, 88, 'embauba'], [84, 83, 'embauba'], [51, 86, 'acai'], [62.5, 91.6, 'banana'], [75.5, 91.5, 'acai'], [33, 92, 'acai'], [104, 82, 'embauba'], [105, 90, 'acai']];
    for (const [x, y, k] of village) { if (k === 'banana') this.plant(px(x), px(y), 'banana', (x * 7) | 0); else this.palm(px(x), px(y), k, (x * 3) | 0); }
    // tucum espinhento perto da árvore caída
    this.tucumSpots = [[21.5, 64.4], [27.6, 63.9], [20.6, 68.9], [29.4, 70.4]];
    for (const [x, y] of this.tucumSpots) this.plant(px(x), px(y), 'tucum', (x * 5) | 0);
  }

  palm(x, y, kind, v) {
    const w = this.world;
    const s = kind === 'acai' ? Sprites.get('pa:acai:' + (v % 5), () => N.acaiSprite(70 + v % 5)) : kind === 'buriti' ? Sprites.get('pa:bur:' + (v % 3), () => N.buritiSprite(80 + v % 3)) : Sprites.get('pa:emb:' + (v % 4), () => N.embaubaSprite(90 + v % 4));
    w.addDrawable({ x, y, sprite: s, ax: s.width / 2, ay: s.height - 2, shadow: { rx: kind === 'buriti' ? 14 : 10, ry: 4, dx: -8, len: 10 } });
    w.addCollider({ x, y: y - 1, r: kind === 'buriti' ? 3 : 2 });
    w.addDensity(x, y - s.height * 0.75, kind === 'buriti' ? 22 : 16, 0.35);
  }

  plant(x, y, kind, v) {
    const w = this.world;
    let s;
    if (kind === 'bush') s = Sprites.get('bu:' + (v % 6), () => N.bushSprite(200 + v % 6, 7 + (v % 3), v % 2 ? N.GREENS.mid : N.GREENS.light));
    else if (kind === 'fern') s = Sprites.get('fe:' + (v % 4), () => N.fernSprite(300 + v % 4));
    else if (kind === 'heliconia') s = Sprites.get('he:' + (v % 3), () => N.heliconiaSprite(400 + v % 3));
    else if (kind === 'tucum') s = Sprites.get('tu:' + (v % 2), () => N.tucumSprite(420 + v % 2));
    else if (kind === 'banana') s = Sprites.get('ba:' + (v % 3), () => N.bananaSprite(440 + v % 3));
    else if (kind === 'maniva') s = Sprites.get('ma:' + (v % 4), () => N.manivaSprite(460 + v % 4));
    w.addDrawable({ x, y, sprite: s, ax: s.width / 2, ay: s.height - 2 });
    if (kind === 'bush') this.addCover(x, y - 4, 10 + (v % 3));
    if (kind === 'banana') w.addCollider({ x, y: y - 1, r: 2 });
  }

  placeProps() {
    const w = this.world;
    const add = (x, y, s, o = {}) => w.addDrawable({ x, y, sprite: s, ax: o.ax ?? s.width / 2, ay: o.ay ?? s.height - 2, ...o });
    // casas de palafita
    const houses = [[HOUSE_C, '#4f7f9a', 'zinc', 1], [HOUSE_Z, '#c07a6a', 'palha', 2], [HOUSE_R, '#5f8a5a', 'zinc', 3]];
    for (const [h, paint, roof, seed] of houses) {
      const s = Sprites.get('house:' + seed, () => PR.houseSprite(seed, paint, roof));
      add(h.x, h.y, s, { ax: 40, ay: 72, shadow: { rx: 40, ry: 8, dx: -10, dy: -4, len: 14 } });
      w.addCollider({ x: h.x - 38, y: h.y - 46, w: 76, h: 40 });
    }
    const cf = Sprites.get('farinha', () => PR.casaFarinhaSprite(5));
    add(FARINHA.x, FARINHA.y, cf, { ax: 39, ay: 60, shadow: { rx: 38, ry: 8, dx: -8, dy: -2, len: 14 } });
    w.addCollider({ x: FARINHA.x, y: FARINHA.y - 16, r: 14 });
    w.addCollider({ x: FARINHA.x - 33, y: FARINHA.y - 6, r: 3 }); w.addCollider({ x: FARINHA.x + 32, y: FARINHA.y - 6, r: 3 });
    // jirau dos equipamentos
    const jr = Sprites.get('jirau', () => PR.jiraoSprite());
    add(JIRAU.x, JIRAU.y, jr, { ax: 17, ay: 19 });
    w.addCollider({ x: JIRAU.x - 16, y: JIRAU.y - 8, w: 32, h: 7 });
    // pilha de tábuas do Zé
    const wp = Sprites.get('woodpile', () => PR.woodpileSprite());
    add(HOUSE_Z.x - 50, HOUSE_Z.y + 2, wp, { ax: 15, ay: 14 });
    w.addCollider({ x: HOUSE_Z.x - 64, y: HOUSE_Z.y - 8, w: 28, h: 9 });
    // cerca e manivas da roça
    const fence = Sprites.get('fence', () => PR.fenceSprite(32));
    for (let x = 84; x < 103; x += 2) add(px(x), px(78.8), fence, { ax: 0, ay: 13 });
    for (let y = 79; y < 94; y += 1.6) for (let x = 85.5; x < 102; x += 1.4) {
      if (Math.abs(x - 93.5) < 0.8) continue;
      if (w.terrainAt(px(x), px(y)) === T.ROCA) this.plant(px(x) + ((y * 3) % 2), px(y), 'maniva', ((x * 7 + y * 3) | 0));
    }
    // canoas no trapiche (balançam: desenhadas como entidades)
    this.moored = [{ x: px(DOCK.x0) - 26, y: px(shoreY(DOCK.x0) + 1.6), s: 1 }, { x: px(DOCK.x1) + 26, y: px(shoreY(DOCK.x1) + 2.4), s: 2 }, { x: px(DOCK.x1) + 30, y: px(shoreY(DOCK.x1) + 0.6), s: 3 }];
    for (const [x, y] of [[DOCK.x0, DOCK.y0 + 1], [DOCK.x1, DOCK.y0 + 1], [DOCK.x0, shoreY(60) + 3.5], [DOCK.x1, shoreY(60) + 3.5]]) {
      const post = Sprites.get('post', () => { const c = makeCanvas(4, 12); const x2 = c.getContext('2d'); x2.fillStyle = '#4a3420'; x2.fillRect(0, 0, 4, 12); x2.fillStyle = '#2e2010'; x2.fillRect(3, 0, 1, 12); return c; });
      add(px(x), px(y), post, { ax: 2, ay: 10 });
    }
    // canoa abandonada (fonte de tábuas)
    const oc = Sprites.get('canoe:broken', () => PR.canoeSprite(9, true));
    add(OLD_CANOE.x, OLD_CANOE.y, oc, { ax: 25, ay: 11 });
    w.addCollider({ x: OLD_CANOE.x - 22, y: OLD_CANOE.y - 7, w: 44, h: 6 });
    // árvore caída
    const ft = Sprites.get('fallen', () => N.fallenTreeSprite(77));
    add(FALLEN.x, FALLEN.y, ft, { ax: 52, ay: 24, shadow: { rx: 48, ry: 5, dy: 2, len: 6 } });
    w.addCollider({ x: FALLEN.x - 50, y: FALLEN.y - 12, w: 98, h: 11 });
    // esteio da trilha
    const tp = Sprites.get('trailpost', () => PR.trailPostSprite());
    add(TRAILHEAD.x, TRAILHEAD.y, tp, { ax: 6, ay: 24 });
    w.addCollider({ x: TRAILHEAD.x, y: TRAILHEAD.y - 1, r: 2 });
    // pedras na beira do igarapé e do rio
    const rng = mulberry32(55);
    for (let i = 0; i < 70; i++) {
      const tx = 3 + rng() * (TW - 6);
      const ty = rng() < 0.5 ? creekY(tx) + (rng() < 0.5 ? -1 : 1) * (creekHW(tx) + 0.6 + rng()) : shoreY(tx) - 0.4 - rng() * 1.5;
      if (Math.abs(tx - BRIDGE_TX) < 3 || (tx > 58 && tx < 63 && ty > 90)) continue;
      const t = w.terrainAt(px(tx), px(ty));
      if (t === T.RIVER || t === T.CREEK || t === T.WOOD) continue;
      const s = Sprites.get('rock:' + (i % 5), () => N.rockSprite(600 + i % 5, 3 + (i % 5)));
      add(px(tx), px(ty), s, { ax: s.width / 2, ay: s.height - 2 });
      if (i % 5 > 2) w.addCollider({ x: px(tx), y: px(ty) - 2, r: 3 + (i % 5) - 2 });
    }
    // galhos secos que estalam (armadilhas de ruído) ao longo das trilhas
    this.twigs = [];
    const tr = mulberry32(99);
    for (const t of TRAILS.slice(0, 2).concat(TRAILS.slice(5))) {
      for (let i = 0; i < t.pts.length - 1; i++) {
        if (tr() < 0.35) continue;
        const [ax, ay] = t.pts[i], [bx, by] = t.pts[i + 1];
        const k = 0.3 + tr() * 0.4, x = px(ax + (bx - ax) * k) + (tr() - 0.5) * 8, y = px(ay + (by - ay) * k) + (tr() - 0.5) * 8;
        if (y > GATE_Y) continue;
        const s = Sprites.get('twig:' + (i % 3), () => N.twigSprite(i));
        add(x, y, s, { ax: 5, ay: 3, layer: 'ground' });
        this.twigs.push({ x, y, cd: 0 });
      }
    }
  }

  decorateGround(ctx) {
    const w = this.world, rng = mulberry32(4242);
    // raízes das árvores grandes
    ctx.strokeStyle = 'rgba(40,28,16,0.75)'; ctx.lineWidth = 2;
    for (const d of w.drawables) {
      if (d.kind !== 'tree' || d.size !== 'big') continue;
      for (let k = 0; k < 5; k++) {
        const a = rng() * Math.PI * 2, L = 14 + rng() * 14;
        ctx.beginPath(); ctx.moveTo(d.x, d.y - 2);
        ctx.quadraticCurveTo(d.x + Math.cos(a) * L * 0.5 + (rng() - 0.5) * 6, d.y + Math.sin(a) * L * 0.25, d.x + Math.cos(a) * L, d.y + Math.sin(a) * L * 0.45);
        ctx.stroke();
      }
    }
    // folhas, brotos e gravetos no chão da mata
    for (let i = 0; i < 9000; i++) {
      const x = rng() * w.W, y = rng() * w.H, t = w.terrainAt(x, y);
      if (t === T.FLOOR || t === T.CLEAR) {
        const r = rng();
        if (r < 0.45) { ctx.fillStyle = ['#7a5428', '#8e6a30', '#5e4420', '#9a7a3a', '#6a3a1e'][(rng() * 5) | 0]; ctx.fillRect(x | 0, y | 0, 2 + (rng() * 2 | 0), 1); ctx.fillRect((x | 0) + 1, (y | 0) + 1, 1, 1); }
        else if (r < 0.7) { ctx.fillStyle = '#3f6a2a'; ctx.fillRect(x | 0, y | 0, 1, 2); ctx.fillStyle = '#5a8a3a'; ctx.fillRect((x | 0) - 1, y | 0, 1, 1); ctx.fillRect((x | 0) + 1, y | 0, 1, 1); }
        else if (r < 0.8) { ctx.fillStyle = '#4a3a24'; ctx.fillRect(x | 0, y | 0, 4, 1); }
      } else if (t === T.GRASS) {
        ctx.fillStyle = rng() < 0.5 ? '#6a9a3a' : '#4e7a2a'; ctx.fillRect(x | 0, y | 0, 1, 2); ctx.fillRect((x | 0) + 2, (y | 0) + 1, 1, 2);
        if (rng() < 0.05) { ctx.fillStyle = ['#f0e070', '#f0f0f0', '#e07ab0'][(rng() * 3) | 0]; ctx.fillRect(x | 0, (y | 0) - 1, 1, 1); }
      } else if (t === T.SAND && rng() < 0.3) { ctx.fillStyle = 'rgba(120,100,70,0.5)'; ctx.fillRect(x | 0, y | 0, 1, 1); }
    }
    // marcas de pneu de carrinho e pés descalços na comunidade? (pegadas humanas na areia)
    ctx.fillStyle = 'rgba(110,90,60,0.6)';
    for (let i = 0; i < 40; i++) { const x = px(48 + i * 0.35), y = px(shoreY(48 + i * 0.35) - 1.4) + (i % 2) * 3; ctx.fillRect(x | 0, y | 0, 2, 1); }
    // restos de frutas roídas perto da sapopema (pista da paca)
    for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? '#c8a040' : '#8a5a2a'; ctx.fillRect((BURROW.x + 10 + rng() * 24) | 0, (BURROW.y + rng() * 14) | 0, 2, 2); }
    // círculo de fogueira antigo na clareira do acampamento
    ctx.fillStyle = 'rgba(30,24,18,0.6)'; ctx.beginPath(); ctx.ellipse(CAMP.x, CAMP.y + 6, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
  }

  buildMist() {
    const c = makeCanvas(64, 28), x = c.getContext('2d');
    const grd = x.createRadialGradient(32, 14, 2, 32, 14, 30);
    grd.addColorStop(0, 'rgba(230,236,240,0.9)'); grd.addColorStop(1, 'rgba(230,236,240,0)');
    x.save(); x.scale(1, 0.45); x.fillStyle = grd; x.translate(0, 0); x.restore();
    x.fillStyle = grd; x.fillRect(0, 0, 64, 28);
    this.mistSprite = c;
    const rng = mulberry32(8);
    this.mist = [];
    for (let i = 0; i < 70; i++) { const tx = rng() * TW; this.mist.push({ x: px(tx), y: px(shoreY(tx) + 0.5 + rng() * 3), s: 1 + rng() * 1.5, sp: 3 + rng() * 4 }); }
    for (let i = 0; i < 70; i++) { const tx = rng() * TW; this.mist.push({ x: px(tx), y: px(creekY(tx)) + (rng() - 0.5) * 30, s: 0.8 + rng(), sp: 2 + rng() * 3 }); }
  }

  equipPos(id) {
    const offs = { espingarda: -13, facao: -6, cantil: 0, lanterna: 6, marmita: 12 };
    if (id === 'paneiro') return { x: HOUSE_C.x + 16, y: HOUSE_C.y + 9 };
    return { x: JIRAU.x + offs[id], y: JIRAU.y - 11 };
  }

  // ---------------- elementos dinâmicos ----------------
  setupDynamic(fromSave) {
    const g = this.g, w = this.world, f = g.flags;
    this.eyes = { a: 0 };
    this.whistleT = 0;
    this.gateMsgT = 0;
    this.finished = false;
    g.lights = [];

    // equipamentos
    for (const id of EQUIP) {
      if (g.inv.has(id)) continue;
      const pos = this.equipPos(id);
      const icon = Sprites.get('icon:' + id, () => PR.iconSprite(id));
      const ent = { x: pos.x, y: pos.y, sortY: JIRAU.y + 1, draw: (ctx) => { if (!ent.gone) ctx.drawImage(icon, Math.round(ent.x - 8), Math.round(ent.y - 12)); } };
      if (id === 'paneiro') ent.sortY = pos.y;
      g.entities.push(ent);
      g.interactables.push({
        x: pos.x, y: id === 'paneiro' ? pos.y + 2 : JIRAU.y + 6, r: 18, py: 26, label: `Pegar ${ITEMS[id].name.toLowerCase()}`,
        enabled: () => !ent.gone,
        action: () => {
          ent.gone = true; g.give(id);
          this.onEquip(id);
        },
      });
    }

    // moradores
    this.raimundo = new NPC(g, 'raimundo', 'Seu Raimundo', 'raimundo', HOUSE_R.x - 10, HOUSE_R.y + 12, 'down');
    this.socorro = new NPC(g, 'socorro', 'Dona Socorro', 'socorro', FARINHA.x - 22, FARINHA.y - 4, 'right');
    this.ze = new NPC(g, 'ze', 'Zé', 'ze', px(60.35), px(shoreY(60.35) + 2.2), 'down');
    for (const n of [this.raimundo, this.socorro, this.ze]) { g.npcs.push(n); g.entities.push(n); g.updaters.push(n); }
    g.interactables.push({ x: this.raimundo.x, y: this.raimundo.y + 4, r: 26, py: 30, label: () => g.done.has('talk') ? 'Conversar com Seu Raimundo' : 'Perguntar sobre o veado', action: () => this.talkRaimundo() });
    g.interactables.push({ x: this.socorro.x, y: this.socorro.y + 4, r: 26, py: 30, label: 'Conversar com Dona Socorro', action: () => this.talkSocorro() });
    g.interactables.push({ x: this.ze.x, y: this.ze.y - 4, r: 26, py: 30, label: 'Conversar com Zé', action: () => this.talkZe() });

    // canoas que balançam
    for (const m of this.moored) {
      const s = Sprites.get('canoe:' + m.s, () => (m.s % 2 ? PR.canoeSprite(m.s) : flipCanvas(PR.canoeSprite(m.s))));
      g.entities.push({ x: m.x, y: m.y, draw: (ctx) => {
        const b = Math.sin(g.time * 1.4 + m.s) * 0.8;
        ctx.globalAlpha = 0.25; ctx.fillStyle = '#1a140a'; ctx.beginPath(); ctx.ellipse(m.x, m.y + 2, 22, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        ctx.drawImage(s, Math.round(m.x - 25), Math.round(m.y - 10 + b));
      } });
    }

    // tábuas e cipó
    g.interactables.push({ x: HOUSE_Z.x - 50, y: HOUSE_Z.y + 8, r: 22, py: 22, label: 'Pegar uma tábua', enabled: () => !f.tabuaZe, action: () => {
      if (!g.done.has('talk') && !f.zeTalked) { g.run(async () => { await g.say('Caetano', 'Essas tábuas são do Zé. Melhor perguntar antes.', 'caetano'); }); return; }
      f.tabuaZe = true; g.give('tabua'); this.bridgeHint();
    } });
    g.interactables.push({ x: OLD_CANOE.x, y: OLD_CANOE.y + 6, r: 26, py: 20, label: 'Soltar tábuas da canoa velha', enabled: () => !f.tabuasCanoa, action: () => {
      if (!g.inv.has('facao')) { g.ui.toast('Precisa do facão para soltar as tábuas.', 'tip'); return; }
      f.tabuasCanoa = true; g.audio.play('cut'); g.give('tabua', 2); this.bridgeHint();
    } });
    const cipo = Sprites.get('cipo', () => PR.cipoSprite(44));
    g.entities.push({ x: CIPO_TREE.x + 10, y: CIPO_TREE.y + 1, draw: (ctx) => { if (!f.cipo) ctx.drawImage(cipo, Math.round(CIPO_TREE.x + 4), Math.round(CIPO_TREE.y - 44 + Math.sin(g.time) * 0.5)); } });
    g.interactables.push({ x: CIPO_TREE.x + 12, y: CIPO_TREE.y + 4, r: 22, py: 30, label: 'Cortar cipó-titica', enabled: () => !f.cipo, action: () => {
      if (!g.inv.has('facao')) { g.ui.toast('Sem o facão não dá para cortar o cipó.', 'tip'); return; }
      f.cipo = true; g.audio.play('cut'); g.give('cipo'); this.bridgeHint();
      for (let i = 0; i < 8; i++) g.particles.add({ type: 'leaf', x: CIPO_TREE.x + 10, y: CIPO_TREE.y, z: 20 + Math.random() * 20, vx: (Math.random() - 0.5) * 20, vy: 2, life: 3, seed: Math.random() * 9, color: '#4f7a32' });
    } });

    // ponte
    w.walkOverrides.push({ x: BRIDGE.x - 11, y: BRIDGE.y0, w: 22, h: BRIDGE.y1 - BRIDGE.y0, active: () => !!f.bridge });
    g.interactables.push({ x: BRIDGE.x, y: BRIDGE.y1 + 4, r: 26, py: 18, label: () => (g.inv.count('tabua') >= 3 && g.inv.has('cipo')) ? 'Consertar a ponte' : 'Examinar a ponte', enabled: () => !f.bridge, action: () => this.bridgeAction() });

    // portão invisível: só sai da comunidade depois de se preparar
    w.blockers.push({ x: 0, y: GATE_Y - 6, w: w.W, h: 6, active: () => !(g.done.has('prep') && g.done.has('talk')) });

    // rastros
    for (const t of TRACKS) {
      const x = px(t.at[0]), y = px(t.at[1]);
      g.interactables.push({ x, y, r: 22, py: 12, label: () => g.tracksKnown.has(t.id) ? `Rastro de ${t.name.toLowerCase()}` : 'Examinar rastro', enabled: () => !g.tracksKnown.has(t.id), action: () => this.examineTrack(t) });
    }

    // paca e outros animais
    this.paca = new Animal(g, 'paca', BURROW.x + 18, BURROW.y + 8, { burrow: { ...BURROW }, id: 'paca' });
    this.paca.home = { x: BURROW.x + 22, y: BURROW.y + 10 };
    const animals = [this.paca];
    for (const [x, y] of [[30, 72], [70, 58.6], [62, 31], [88, 74]]) animals.push(new Animal(g, 'cotia', px(x), px(y)));
    for (const [x, y] of [[40, 64.5], [76.5, 40], [89, 71.5], [50, 24], [103, 66]]) {
      for (let i = 0; i < 2; i++) animals.push(new Animal(g, 'jacu', px(x) + i * 12, px(y) + i * 5));
    }
    for (let i = 0; i < 4; i++) {
      const tx = 24 + i * 2.6;
      animals.push(new Animal(g, 'capivara', px(tx), px(shoreY(tx) - 1.4 - (i % 2)), { water: { x: px(tx), y: px(shoreY(tx) + 2.2) } }));
    }
    for (const [x, y] of [[44, 91.5], [53, 92], [67, 90.5], [72, 91]]) animals.push(new Animal(g, 'galinha', px(x), px(y)));
    for (const a of animals) { g.animals.push(a); g.entities.push(a); g.updaters.push(a); g.airEntities.push(a); }
    g.onAnimalEvent = (a, ev) => this.onAnimalEvent(a, ev);
    // interação da paca (posição dinâmica)
    const self = this;
    g.interactables.push({
      get x() { return self.paca.visible ? self.paca.x : BURROW.x; },
      get y() { return self.paca.visible ? self.paca.y : BURROW.y + 4; },
      get r() { return self.paca.visible ? 48 : 26; },
      py: 14,
      label: () => self.paca.visible ? 'Observar a paca' : 'Examinar as raízes',
      enabled: () => !g.done.has('paca'),
      action: () => self.observePaca(),
    });

    // macacos na copa
    const south = this.canopyNodes.filter((n) => n.x > px(32) && n.x < px(52) && n.y > px(56) && n.y < px(72));
    const north = this.canopyNodes.filter((n) => n.x > px(52) && n.x < px(80) && n.y > px(10) && n.y < px(34));
    const pickNodes = (arr, base) => arr.length >= 3 ? arr : base;
    const fallbackS = [{ x: px(40), y: px(61) }, { x: px(44), y: px(63) }, { x: px(47), y: px(60) }, { x: px(42), y: px(66) }];
    const fallbackN = [{ x: px(60), y: px(24) }, { x: px(64), y: px(27) }, { x: px(58), y: px(30) }, { x: px(66), y: px(31) }];
    for (const nodes of [pickNodes(south, fallbackS), pickNodes(north, fallbackN)]) {
      const tr = new MonkeyTroop(g, nodes, 4);
      g.updaters.push(tr); g.airEntities.push(tr);
    }
    const fo = new Flyovers(g); g.updaters.push(fo); g.airEntities.push(fo);
    for (const [x, y] of [[95, 62], [68, 36], [24, 67], [62, 88], [36, 60], [70, 22]]) { const b = new Butterfly(g, px(x), px(y)); g.updaters.push(b); g.entities.push(b); }

    // achados
    for (const [id, [tx, ty]] of Object.entries(COLLECT)) {
      if (g.inv.found.has(id)) continue;
      const x = px(tx), y = px(ty);
      const icon = Sprites.get('icon:' + id, () => PR.iconSprite(id));
      const ent = { x, y, draw: (ctx) => {
        if (ent.gone) return;
        ctx.globalAlpha = 0.95; ctx.drawImage(icon, Math.round(x - 8), Math.round(y - 10));
        ctx.globalAlpha = 1;
        if (Math.sin(g.time * 3 + x) > 0.92) { ctx.fillStyle = '#fff6c8'; ctx.fillRect(Math.round(x + 3), Math.round(y - 9), 1, 1); ctx.fillRect(Math.round(x + 2), Math.round(y - 8), 3, 1); ctx.fillRect(Math.round(x + 3), Math.round(y - 7), 1, 1); }
      } };
      g.entities.push(ent);
      g.interactables.push({ x, y, r: 18, py: 16, label: `Pegar ${ITEMS[id].name.toLowerCase()}`, enabled: () => !ent.gone, action: () => { ent.gone = true; g.give(id); g.ui.toast(ITEMS[id].desc, 'discovery', 6500); } });
    }
    // lata velha com pilhas na árvore caída
    g.interactables.push({ x: FALLEN.x + 30, y: FALLEN.y + 6, r: 22, py: 18, label: 'Revirar o oco do tronco', enabled: () => !f.pilhas, action: () => {
      f.pilhas = true; g.give('pilhas');
      g.ui.toast('Uma lata velha de caçador, esquecida no oco: duas pilhas ainda boas.', 'discovery', 4500);
    } });

    // galhos secos para o acampamento
    GALHOS.forEach(([tx, ty], i) => {
      if (f['galho' + i]) return;
      const x = px(tx), y = px(ty);
      const s = Sprites.get('sticks', () => PR.sticksSprite());
      const ent = { x, y, draw: (ctx) => { if (!f['galho' + i]) ctx.drawImage(s, Math.round(x - 9), Math.round(y - 8)); } };
      g.entities.push(ent);
      g.interactables.push({ x, y, r: 18, py: 14, label: 'Juntar galhos secos', enabled: () => !f['galho' + i], action: () => { f['galho' + i] = true; g.give('galhos'); } });
    });

    // pegada do veado
    g.interactables.push({ x: DEER_PRINT.x, y: DEER_PRINT.y, r: 24, py: 12, label: 'Investigar o sinal do veado', enabled: () => !g.done.has('deer'), action: () => this.deerPrint() });
    // acampamento
    g.interactables.push({ x: CAMP.x, y: CAMP.y + 4, r: 26, py: 18, label: 'Montar acampamento', enabled: () => !f.camp, action: () => this.campAction() });
    this.fireFrames = Sprites.get('fireframes', () => PR.fireFrames());
    this.fireLight = { x: CAMP.x, y: CAMP.y + 2, r: 70, i: 0.9, flicker: true, color: '255,170,80', off: !f.camp };
    g.lights.push(this.fireLight);
    g.entities.push({ x: CAMP.x, y: CAMP.y + 8, draw: (ctx) => this.drawCamp(ctx) });

    // luzes da comunidade
    this.windowLights = [];
    for (const h of [HOUSE_C, HOUSE_Z, HOUSE_R]) for (const dx of [-22, 22]) { const l = { x: h.x + dx, y: h.y - 30, r: 30, i: 0.6, color: '255,190,110' }; this.windowLights.push(l); g.lights.push(l); }
    const lamp = { x: HOUSE_R.x + 24, y: HOUSE_R.y - 12, r: 46, i: 0.8, flicker: true, color: '255,180,90' };
    this.windowLights.push(lamp); g.lights.push(lamp);
    g.lights.push({ x: FARINHA.x, y: FARINHA.y - 12, r: 52, i: 0.85, flicker: true, color: '255,150,70' });

    // perigos
    g.hazards = this.tucumSpots.map(([x, y]) => ({ x: px(x), y: px(y) - 3, r: 9, type: 'tucum' }));
    this.antHill = { x: FALLEN.x - 44, y: FALLEN.y + 12 };
    g.hazards.push({ x: this.antHill.x, y: this.antHill.y, r: 12, type: 'ants' });

    // gatilhos
    this.setupTriggers();

    if (!fromSave) { g.fade = 1; }
  }

  setupTriggers() {
    const g = this.g, f = g.flags;
    g.triggers.push({ x: TRAILHEAD.x, y: TRAILHEAD.y + 4, r: 34, cond: () => !g.done.has('trail'), fn: () => this.reachTrail() });
    g.triggers.push({ x: SAPOPEMA.x + 10, y: SAPOPEMA.y + 10, r: 110, cond: () => !g.done.has('paca') && !f.pacaTip, fn: () => {
      f.pacaTip = true;
      g.ui.toast('<b>Dica</b> · Frutas roídas no chão: a paca está por perto. Agache (C), ande devagar e fique de olho no vento do minimapa.', 'tip', 7000);
    } });
    g.triggers.push({ x: BRIDGE.x - 30, y: BRIDGE.y0 - 70, w: 60, h: 60, cond: () => !!f.bridge && !g.done.has('bridge'), fn: () => this.crossedBridge() });
    g.triggers.push({ x: OLD_CANOE.x, y: OLD_CANOE.y, r: 70, cond: () => !f.canoeSeen, fn: () => { f.canoeSeen = true; g.ui.toast('Uma canoa velha, rachada e cheia de musgo, largada na lama.', 'discovery', 3800); } });
    g.triggers.push({ x: FALLEN.x, y: FALLEN.y, r: 80, cond: () => !f.fallenSeen, fn: () => { f.fallenSeen = true; g.ui.toast('Uma árvore enorme caída. Cuidado com o tucum espinhento ao redor e com o formigueiro.', 'discovery', 4500); } });
    g.triggers.push({ x: px(95), y: px(62.5), r: 70, cond: () => !f.clearSeen, fn: () => { f.clearSeen = true; g.ui.toast('Uma clareira cheia de pegadas. Muitos bichos passam por aqui para chegar à água.', 'discovery', 4500); } });
    g.triggers.push({ x: px(56), y: px(53.5), r: 90, cond: () => !f.oncaTip && g.done.has('trail'), fn: () => { f.oncaTip = true; g.caption('Silêncio estranho perto do igarapé', 0); } });
    // galhos que estalam
    for (const t of this.twigs) {
      g.triggers.push({ x: t.x, y: t.y, r: 7, once: false, fn: () => {
        const p = g.player;
        if (t.cd > g.time || !p.moving || p.sneak) return;
        t.cd = g.time + 3;
        g.audio.play('twig', { pan: 0, vol: p.running ? 1 : 0.8 });
        p.makeNoise(0.95);
        g.caption('Um galho seco estala sob a bota', 0);
        if (!f.twigTip) { f.twigTip = true; g.ui.toast('<b>Dica</b> · Galhos secos estalam e espantam os bichos. Agachado (C), você pisa com cuidado.', 'tip', 6000); }
      } });
    }
  }

  // ---------------- ações e roteiro ----------------
  async intro() {
    const g = this.g;
    await g.ui.intro([
      '<span class="place">São Sebastião do Igarapé Grande</span>Uma comunidade ribeirinha às margens de um rio de águas barrentas, em algum lugar da Amazônia.',
      'É verão. As águas baixaram e as praias apareceram de novo no rio.',
      'Na conversa de ontem, no trapiche, falaram de um <b>veado-vermelho</b> grande, visto lá para os lados do buritizal antigo.',
      'Caetano quase não dormiu. Antes de o sol nascer, já estava de pé.',
    ]);
    g.player.dir = 'down';
    g.letterbox = 1;
    g.audio.setMood('calm');
    await g.run(async () => {
      g.camera.targetZoom = 1.25;
      await g.tween(g, 'fade', 0, 2.5);
      g.ui.titleCard('FASE 1', 'A Primeira Pegada', 'Amanhecer · comunidade ribeirinha');
      await g.wait(3.2);
      await g.say('Caetano', 'Ainda tá escuro... Mas o veado anda é cedo. Hoje eu trago esse bicho.', 'caetano');
      await g.say('Caetano', 'Deixei tudo no jirau, do lado da escada. Primeiro, arrumar o paneiro.', 'caetano');
      g.camera.targetZoom = 1;
      await g.tween(g, 'letterbox', 0, 0.8);
    });
    g.state = 'play';
    g.stats.startedAt = g.timeLeft;
    const mob = g.input.lastDevice === 'touch';
    g.ui.toast(mob ? '<b>Dica</b> · Use o joystick para andar e ✋ para interagir.' : '<b>Dica</b> · Ande com <kbd>WASD</kbd> ou setas. Interaja com <kbd>E</kbd>.', 'tip', 6500);
    setTimeout(() => g.state === 'play' && g.ui.toast(mob ? '<b>Dica</b> · "☰ Missões" abre o painel com objetivos e dicas.' : '<b>Dica</b> · O painel à direita mostra as missões. Clique em <b>?</b> para ver dicas.', 'tip', 6500), 7000);
    g.checkpoint('Início da expedição');
  }

  onEquip(id) {
    const g = this.g;
    if (id === 'lanterna') g.ui.toast(g.input.lastDevice === 'touch' ? '<b>Dica</b> · Ainda está escuro. Toque em "Luz" para acender a lanterna.' : '<b>Dica</b> · Ainda está escuro. Aperte <kbd>F</kbd> para acender a lanterna. A bateria acaba!', 'tip', 6000);
    if (id === 'cantil') g.ui.toast('O cantil está vazio. Encha no rio, logo ali na praia (chegue na água e aperte E).', 'tip', 6000);
    if (id === 'marmita') g.ui.toast('Marmita com peixe assado e farinha: 3 porções. Tecla <kbd>2</kbd> para comer.', 'tip', 4500);
    if (id === 'espingarda') g.ui.toast('A espingarda velha: 5 cartuchos. Mirar com <kbd>Q</kbd> ou botão direito. Mas tiro faz barulho...', 'tip', 5500);
    if (EQUIP.every((e) => g.inv.has(e))) {
      g.complete('prep');
      g.run(async () => {
        await g.say('Caetano', 'Paneiro nas costas, espingarda, facão, cantil, lanterna e a marmita. Tá tudo aqui.', 'caetano');
        await g.say('Caetano', 'Seu Raimundo disse que viu o bicho. Vou lá falar com ele antes de sair.', 'caetano');
      }).then(() => {
        g.ui.toast(g.input.lastDevice === 'touch' ? '<b>Dica</b> · "Correr" gasta energia. "Agachar" deixa você silencioso.' : '<b>Dica</b> · <kbd>Shift</kbd> corre (gasta energia). <kbd>C</kbd> agacha e silencia os passos. <kbd>I</kbd> abre o paneiro.', 'tip', 7000);
      });
    }
  }

  async talkRaimundo() {
    const g = this.g, R = 'raimundo', C = 'caetano';
    if (g.done.has('talk')) {
      await g.run(async () => {
        const lines = [
          'Vai com Deus, meu filho. E não esquece de pedir licença.',
          'O igarapé velho fica pro norte. A ponte tá estragada desde a cheia, fala com o Zé.',
          'Mata de manhã cedo é cheia de vida. Escuta mais do que anda.',
        ];
        await g.say('Seu Raimundo', lines[(g.time | 0) % lines.length], R);
      });
      return;
    }
    if (!g.done.has('prep')) {
      await g.run(async () => {
        await g.say('Seu Raimundo', 'Bom dia, Caetano. Vai sair assim, de mão abanando? Pega tuas coisas primeiro, rapaz.', R);
      });
      return;
    }
    await g.run(async () => {
      g.camera.targetZoom = 1.2; await g.tween(g, 'letterbox', 1, 0.5);
      await g.say('Seu Raimundo', 'Bom dia, Caetano. Acordaste antes dos galos hoje.', R);
      await g.say('Caetano', 'Bom dia, Seu Raimundo. Me disseram que o senhor viu o veado-vermelho.', C);
      await g.say('Seu Raimundo', 'Vi sim. Ontem, quase de noitinha. Bicho grande, de pelo bem vermelho. Passou pro rumo do igarapé velho, depois da trilha do norte.', R);
      await g.say('Seu Raimundo', 'Ia pro lado do buritizal antigo. Lugar onde ninguém mais anda.', R);
      await g.say('Caetano', 'Então é pra lá que eu vou.', C);
      g.audio.setDuck(0.4, 1);
      await g.wait(0.8);
      await g.say('Seu Raimundo', 'Escuta uma coisa, meu filho...', R);
      await g.say('Seu Raimundo', '"Tem bicho que a gente segue. Mas tem bicho que leva a gente para onde não devia entrar."', R);
      g.audio.setDuck(1, 2);
      await g.say('Caetano', 'O senhor e suas histórias... Eu volto antes de a lua encher.', C);
      await g.say('Seu Raimundo', 'Então leva isso aqui. Fumo de rolo. E pede licença quando entrar na mata.', R);
      g.give('fumo');
      await g.say('Seu Raimundo', 'A ponte do igarapé tá quebrada desde a cheia. O Zé sabe onde tem tábua. Ele tá lá no trapiche.', R);
      g.camera.targetZoom = 1; await g.tween(g, 'letterbox', 0, 0.5);
    });
    g.complete('talk');
    g.checkpoint('Conversa com Seu Raimundo');
  }

  async talkSocorro() {
    const g = this.g, S2 = 'socorro', C = 'caetano', f = g.flags;
    await g.run(async () => {
      if (!f.socorro) {
        await g.say('Dona Socorro', 'Égua, Caetano, já de pé? O forno nem esquentou direito.', S2);
        await g.say('Caetano', 'Vou atrás do veado-vermelho, Dona Socorro.', C);
        await g.say('Dona Socorro', 'Hum. Então presta atenção nos bichos pequenos também. Lá pra sapopema grande, a leste da trilha, toda madrugada aparece paca comendo fruta caída.', S2);
        await g.say('Dona Socorro', 'Chega devagarinho, abaixado, e não fica com o vento nas costas, que ela sente o cheiro de longe.', S2);
        await g.say('Dona Socorro', 'E toma um beiju pra levar. Ninguém caça de barriga vazia.', S2);
        f.socorro = true;
        g.res.food += 1;
        g.audio.play('pickup');
        g.ui.toast('Dona Socorro colocou um beiju na marmita: <b>+1 porção</b>.', 'tip', 4000);
      } else {
        await g.say('Dona Socorro', 'A sapopema fica a leste da trilha, depois de uma descida. Vai devagar!', S2);
      }
    });
  }

  async talkZe() {
    const g = this.g, Z = 'ze', C = 'caetano', f = g.flags;
    await g.run(async () => {
      if (!f.zeTalked) {
        await g.say('Zé', 'Ê, Caetano! Vai pro mato? Eu tô aqui esperando o mapará beliscar.', Z);
        await g.say('Caetano', 'Vou pro igarapé velho. Seu Raimundo disse que a ponte quebrou.', C);
        await g.say('Zé', 'Quebrou foi nada, a cheia levou metade das tábuas! Leva uma daquelas da pilha do lado da minha casa.', Z);
        await g.say('Zé', 'E tem uma canoa velha largada na beira do igarapé, lá pro poente. Ainda tem tábua boa nela. Com o facão tu solta.', Z);
        await g.say('Zé', 'Pra amarrar, cipó-titica. Tem um pendurado numa árvore grande na beira da trilha, antes do igarapé.', Z);
        f.zeTalked = true;
      } else {
        const lines = ['Três tábuas e um cipó bom. Amarra bem amarrado, que o igarapé é fundo.', 'Se vir capivara na praia, nem corre: ela se joga n\'água na hora.', 'O peixe hoje tá de greve...'];
        await g.say('Zé', lines[(g.time | 0) % lines.length], Z);
      }
    });
  }

  bridgeHint() {
    const g = this.g;
    const t = g.inv.count('tabua'), c = g.inv.has('cipo');
    if (t >= 3 && c) g.ui.toast('Material completo: <b>3 tábuas e cipó</b>. Vá até a ponte do igarapé.', 'tip', 4500);
  }

  async bridgeAction() {
    const g = this.g, f = g.flags;
    const t = g.inv.count('tabua'), c = g.inv.has('cipo');
    if (t < 3 || !c) {
      f.bridgeSeen = true;
      await g.run(async () => {
        await g.say('Caetano', 'A ponte tá sem várias tábuas. Do jeito que tá, eu caio n\'água.', 'caetano');
        await g.say('Caetano', `Preciso de 3 tábuas e um cipó forte pra amarrar. Tenho ${Math.min(t, 3)} tábua${t === 1 ? '' : 's'}${c ? ' e o cipó' : ' e nenhum cipó'}.`, 'caetano');
      });
      return;
    }
    await g.run(async () => {
      await g.tween(g, 'fade', 1, 0.6);
      g.audio.play('hammer');
      await g.wait(1.9);
      g.inv.remove('tabua', 3); g.inv.remove('cipo');
      f.bridge = true;
      await g.tween(g, 'fade', 0, 0.6);
      await g.say('Caetano', 'Pronto. Tábua encaixada e amarrada com cipó-titica. Agora aguenta.', 'caetano');
    });
    g.ui.toast('Ponte consertada. Atravesse para o outro lado.', 'mission', 3500);
  }

  async crossedBridge() {
    const g = this.g;
    g.complete('bridge');
    g.checkpoint('Do outro lado do igarapé');
    await g.wait(0.6);
    await g.run(async () => {
      g.audio.setDuck(0.25, 1.2);
      g.audio.setMood('mystery');
      await g.wait(1.2);
      g.audio.play('whistle', { pan: -0.85, dur: 2.8 });
      g.caption('Um assobio longo e agudo, vindo de dentro da mata', -0.85);
      await g.tween(g, 'letterbox', 1, 0.6);
      const p = g.player;
      g.camera.follow = null;
      await g.camera.panTo(p.x - 70, p.y - 30, 2);
      await g.wait(1.2);
      await g.say('Caetano', '...', 'caetano');
      await g.say('Caetano', 'Isso não é passarinho que eu conheça.', 'caetano');
      g.audio.play('whistle', { pan: -0.4, dur: 1.6, vol: 0.5 });
      g.caption('O assobio de novo, mais distante', -0.4);
      await g.wait(1.8);
      await g.camera.panTo(p.x, p.y - 8, 1.2);
      g.camera.follow = p;
      await g.tween(g, 'letterbox', 0, 0.6);
      g.audio.setDuck(1, 3);
    });
    setTimeout(() => g.audio.setMood('calm'), 35000);
    g.ui.toast('Siga a trilha para o norte e procure sinais do veado.', 'tip', 4500);
  }

  async reachTrail() {
    const g = this.g;
    g.complete('trail');
    g.checkpoint('Início da trilha');
    await g.run(async () => {
      await g.say('Caetano', 'O pano vermelho no esteio. Daqui pra frente é mata.', 'caetano');
      g.player.forceCrouch = true;
      await g.wait(0.5);
      await g.say('Caetano', 'Com licença, mata. Eu venho só de passagem.', 'caetano');
      g.player.forceCrouch = false;
    });
    g.ui.toast('<b>Dica</b> · Os rastros brilham de leve quando você chega perto. Examine com <kbd>E</kbd>.', 'tip', 6500);
    setTimeout(() => g.state === 'play' && g.ui.toast('<b>Dica</b> · O medidor de <b>Ruído</b> no painel mostra quanto barulho você faz. Bichos escutam, enxergam e sentem o cheiro levado pelo vento.', 'tip', 7500), 7000);
  }

  async examineTrack(t) {
    const g = this.g;
    await g.run(async () => {
      g.player.forceCrouch = true;
      g.camera.targetZoom = 1.35;
      await g.say('Caetano', t.desc, 'caetano');
      let solved = false;
      while (!solved) {
        const i = await g.choice('Que bicho deixou este rastro?', 'Escolha com atenção:', t.options, 'caetano');
        if (i === t.correct) {
          solved = true;
          g.tracksKnown.add(t.id);
          g.audio.play('discover');
          await g.say('Caetano', t.note, 'caetano');
        } else {
          g.stats.tracksWrong++;
          g.audio.play('wrong');
          await g.say('Caetano', 'Não... olhando de novo, não bate. Repara no formato e no que tem em volta.', 'caetano');
        }
      }
      g.camera.targetZoom = 1;
      g.player.forceCrouch = false;
    });
    g.ui.toast(`<b>Caderno de rastros</b> · ${t.name} anotado (${g.tracksKnown.size}/6)`, 'discovery', 3500);
    if (g.tracksKnown.size >= 3) g.complete('tracks');
  }

  async observePaca() {
    const g = this.g, pa = this.paca;
    if (!pa.visible) {
      await g.run(async () => {
        await g.say('Caetano', 'Tem um buraco entre as sapopemas e cheiro de bicho. A paca entrou na toca.', 'caetano');
        await g.say('Caetano', 'Melhor me afastar um pouco, esperar quieto e voltar devagar, agachado.', 'caetano');
      });
      return;
    }
    if (pa.aware >= 0.95 || pa.state === 'flee') { g.ui.toast('A paca percebeu você!', 'warn', 2000); return; }
    await g.run(async () => {
      g.camera.follow = null;
      g.camera.targetZoom = 1.5;
      await g.camera.panTo((pa.x + g.player.x) / 2, (pa.y + g.player.y) / 2 - 6, 1);
      await g.say('Caetano', 'Lá está ela... pintadinha de branco, roendo um caroço entre as raízes.', 'caetano');
      await g.say('Caetano', 'Bicho desconfiado. Se ela não me viu, é porque tô aprendendo.', 'caetano');
      g.camera.targetZoom = 1;
      g.camera.follow = g.player;
    });
    g.complete('paca');
    g.checkpoint('A paca da sapopema');
  }

  async deerPrint() {
    const g = this.g;
    await g.run(async () => {
      g.player.forceCrouch = true;
      g.camera.follow = null; g.camera.targetZoom = 1.6;
      await g.camera.panTo(DEER_PRINT.x, DEER_PRINT.y - 6, 1.1);
      await g.tween(g, 'letterbox', 1, 0.4);
      await g.say('Caetano', 'Casco fendido, pontudo, bem fundo na lama...', 'caetano');
      await g.say('Caetano', 'É veado-vermelho, sim. E é grande.', 'caetano');
      await g.say('Caetano', 'A borda ainda tá úmida. Passou faz pouco tempo, rumo norte.', 'caetano');
      g.camera.targetZoom = 1; await g.tween(g, 'letterbox', 0, 0.4);
      await g.camera.panTo(g.player.x, g.player.y - 8, 0.8);
      g.camera.follow = g.player;
      g.player.forceCrouch = false;
      await g.say('Caetano', 'O sol tá subindo. Vou armar um acampamento na clareira lá na frente e seguir o rastro com calma. Preciso de lenha seca.', 'caetano');
    });
    g.complete('deer');
    g.checkpoint('Primeira pegada do veado');
  }

  async campAction() {
    const g = this.g, f = g.flags;
    const req = ['prep', 'talk', 'trail', 'tracks', 'paca', 'bridge', 'deer'];
    const missing = this.missions.filter((m) => req.includes(m.id) && !g.done.has(m.id));
    if (missing.length) {
      g.ui.toast(`Antes de armar a rede, ainda falta: <b>${missing.map((m) => m.title.toLowerCase()).join('; ')}</b>.`, 'warn', 6500);
      return;
    }
    if (g.inv.count('galhos') < 3) { g.ui.toast(`Preciso de 3 feixes de galhos secos para a fogueira (${g.inv.count('galhos')}/3).`, 'tip', 4000); return; }
    await g.run(async () => {
      await g.tween(g, 'fade', 1, 0.7);
      g.audio.play('cut');
      await g.wait(0.6);
      g.audio.play('fire');
      g.inv.remove('galhos', 3);
      f.camp = true;
      this.fireLight.off = false;
      g.audio.setMood('camp');
      await g.wait(0.8);
      await g.tween(g, 'fade', 0, 0.8);
      await g.say('Caetano', 'Rede armada entre as árvores, fogo aceso. Daqui eu sigo o rastro.', 'caetano');
    });
    g.complete('camp');
    this.finalScene();
  }

  async finalScene() {
    const g = this.g, p = g.player;
    this.finished = true;
    await g.run(async () => {
      await g.tween(g, 'letterbox', 1, 0.6);
      await g.say('Caetano', 'Peraí... ali na beira da clareira.', 'caetano');
      await g.moveTo(p, FINAL_PRINT.x - 10, FINAL_PRINT.y + 4, 32);
      p.dir = 'right';
      p.forceCrouch = true;
      await g.wait(0.6);
      await g.say('Caetano', 'Outra pegada... e essa é de agora mesmo.', 'caetano');
      g.audio.setDuck(0.05, 2.5);
      g.audio.musicOn = false;
      g.caption('A mata fica em silêncio de repente', 0);
      await g.wait(1.6);
      g.camera.follow = null;
      g.camera.targetZoom = 1.35;
      await g.camera.panTo(EYES.x - 6, EYES.y - 4, 3.2);
      await g.wait(1.4);
      g.audio.play('sting');
      g.audio.play('heart');
      await g.tween(this.eyes, 'a', 1, 0.35);
      await g.wait(0.9);
      await g.tween(this.eyes, 'a', 0, 0.12); await g.wait(0.15);
      await g.tween(this.eyes, 'a', 1, 0.12);
      await g.wait(1.1);
      g.audio.play('heart');
      await g.tween(this.eyes, 'a', 0, 0.6);
      g.audio.play('rustle', { pan: 0.6 });
      for (let i = 0; i < 14; i++) g.particles.add({ type: 'leaf', x: EYES.x + (Math.random() - 0.5) * 16, y: EYES.y + 4, z: 4 + Math.random() * 10, vx: (Math.random() - 0.5) * 30, vy: 4, life: 2.5, seed: Math.random() * 9, color: '#4f7a32' });
      await g.wait(1.4);
      g.audio.play('flap', { pan: 0.5 });
      g.caption('Aves levantam voo de uma vez', 0.5);
      await g.wait(1);
      g.camera.targetZoom = 1.1;
      await g.camera.panTo(p.x, p.y - 8, 1.6);
      p.forceCrouch = false;
      await g.say('Caetano', '...Tem alguém aí?', 'caetano');
      await g.wait(1);
      g.audio.musicOn = true;
      g.audio.setDuck(1, 4);
      await g.tween(g, 'fade', 1, 2.2);
    });
    this.completePhase();
  }

  completePhase() {
    const g = this.g;
    g.state = 'results';
    const used = this.timeLimit - g.timeLeft;
    Save.write({ phase: 1, completed: true, done: [...g.done], tracks: [...g.tracksKnown], found: [...g.inv.found] });
    // leva para a Fase 2 o que Caetano tem no paneiro e o caderno de rastros
    Save.completePhase(1, { time: used, carry: { inv: g.inv.toJSON(), res: { ...g.res }, tracks: [...g.tracksKnown], found: [...g.inv.found] } });
    g.ui.results([
      ['Tempo da expedição', formatTime(used)],
      ['Rastros identificados', `${g.tracksKnown.size}/6`],
      ['Palpites errados', `${g.stats.tracksWrong}`],
      ['Achados', `${g.inv.found.size}/5`],
      ['Cartuchos usados', `${5 - g.res.ammo}`],
    ]);
  }

  onResume() {}

  onAnimalEvent(a, ev) {
    const g = this.g;
    if (ev === 'fly') {
      const pan = g.panOf(a.x);
      if (!a._capT || g.time - a._capT > 6) { a._capT = g.time; g.caption('Jacus levantam voo, assustados', pan); }
      for (const o of g.animals) if (o !== a && o.kind === 'jacu' && dist(o.x, o.y, a.x, a.y) < 40) o.scare();
    }
    if (a === this.paca && ev === 'flee' && !g.done.has('paca')) {
      g.caption('Algo corre entre as folhas e some nas raízes', g.panOf(a.x));
      if (!g.flags.pacaFled) { g.flags.pacaFled = true; g.ui.toast('A paca fugiu para a toca. Afaste-se, espere um pouco e volte agachado, com o vento a favor.', 'tip', 6000); }
    }
    if (a.kind === 'capivara' && ev === 'flee' && !g.flags.capCap) { g.flags.capCap = true; g.caption('Capivaras se jogam no rio', g.panOf(a.x)); }
  }

  // ---------------- atualização ----------------
  update(dt) {
    const g = this.g, p = g.player;
    if (!p) return;
    const dk = clamp(g.darkness * 1.6, 0, 1);
    for (const l of this.windowLights || []) l.i = 0.75 * dk;
    if (g.state === 'play') {
      // aviso do "portão" da comunidade
      const gateClosed = !(g.done.has('prep') && g.done.has('talk'));
      if (gateClosed && p.y < GATE_Y + 14 && g.time > this.gateMsgT) {
        this.gateMsgT = g.time + 6;
        g.ui.toast(!g.done.has('prep') ? 'Caetano: <i>"Ainda não peguei minhas coisas."</i>' : 'Caetano: <i>"Antes, quero ouvir o que Seu Raimundo viu."</i>', 'tip', 3000);
      }
      if (!this.finished && g.done.has('bridge') && !g.done.has('deer') && Math.random() < dt / 40) {
        g.audio.play('whistle', { pan: (Math.random() - 0.5) * 1.6, dur: 1.8, vol: 0.35 });
        g.caption('Um assobio distante', 0);
      }
    }
    // fumaça da fogueira
    if (g.flags.camp && Math.random() < dt * 8) g.particles.add({ type: 'smoke', x: CAMP.x + (Math.random() - 0.5) * 4, y: CAMP.y - 6, vx: 3, vy: -9, life: 3, seed: Math.random() * 9 });
    if (g.flags.camp && Math.random() < dt * 3) g.particles.add({ type: 'spark', x: CAMP.x, y: CAMP.y - 4, vx: (Math.random() - 0.5) * 10, vy: -20, life: 0.8, color: '#ffb040' });
    // fumaça do forno de farinha
    if (Math.random() < dt * 3) g.particles.add({ type: 'smoke', x: FARINHA.x + 10, y: FARINHA.y - 50, vx: 4, vy: -7, life: 4, seed: Math.random() * 9 });
  }

  audioEnv() {
    const g = this.g, p = g.player;
    if (!p) return {};
    const tx = p.x / S;
    const dr = px(shoreY(tx)) - p.y, dc = Math.abs(px(creekY(tx)) - p.y);
    const river = Math.max(clamp(1 - dr / 260, 0, 1), clamp(1 - dc / 140, 0, 1) * 0.55);
    const dk = clamp(g.darkness * 1.4, 0, 1);
    const fire = g.flags.camp ? clamp(1 - dist(p.x, p.y, CAMP.x, CAMP.y) / 140, 0, 1) : 0;
    return { river, riverPan: 0, dawn: clamp(g.darkness * 2, 0, 1), insects: 0.5 + dk * 0.8, frogs: dk * clamp(river * 1.4, 0.2, 1), birds: 1 - dk * 0.5, fire };
  }

  // ---------------- desenho específico ----------------
  drawGround(ctx, V) {
    const g = this.g, f = g.flags, p = g.player, t = g.time;
    // ponte
    const bx = BRIDGE.x, y0 = BRIDGE.y0, y1 = BRIDGE.y1;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(bx - 12, y0 + 2, 26, y1 - y0);
    for (const [dx, yy] of [[-12, y0], [10, y0], [-12, y1 - 6], [10, y1 - 6], [-12, (y0 + y1) / 2 - 3], [10, (y0 + y1) / 2 - 3]]) { ctx.fillStyle = '#3a2614'; ctx.fillRect(bx + dx, yy, 3, 7); }
    ctx.fillStyle = '#5a3e24'; ctx.fillRect(bx - 11, y0, 2, y1 - y0); ctx.fillRect(bx + 9, y0, 2, y1 - y0);
    const n = Math.floor((y1 - y0) / 5);
    for (let i = 0; i < n; i++) {
      const broken = !f.bridge && (i % 3 === 1 || i % 5 === 3 || (i > n / 2 - 2 && i < n / 2 + 1));
      if (broken) { if (i % 4 === 0) { ctx.fillStyle = '#4a3420'; ctx.fillRect(bx - 9, y0 + i * 5 + 1, 7, 3); } continue; }
      const y = y0 + i * 5;
      ctx.fillStyle = i % 2 ? '#8a6240' : '#9a7048'; ctx.fillRect(bx - 10, y, 21, 4);
      ctx.fillStyle = '#b08458'; ctx.fillRect(bx - 10, y, 21, 1);
      ctx.fillStyle = '#3a2a18'; ctx.fillRect(bx - 10, y + 4, 21, 1);
    }
    if (f.bridge) { ctx.fillStyle = '#6a5a2a'; for (let i = 0; i < n; i += 2) { ctx.fillRect(bx - 12, y0 + i * 5 + 1, 2, 2); ctx.fillRect(bx + 10, y0 + i * 5 + 1, 2, 2); } }
    // rastros
    for (const tr of TRACKS) {
      const x = px(tr.at[0]), y = px(tr.at[1]);
      if (x < V.cx - 30 || x > V.cx + V.vw + 30 || y < V.cy - 30 || y > V.cy + V.vh + 30) continue;
      const s = Sprites.get('trk:' + tr.kind, () => PR.trackSprite(tr.kind));
      const known = g.tracksKnown.has(tr.id);
      ctx.globalAlpha = known ? 0.55 : 0.9;
      ctx.drawImage(s, Math.round(x - 14), Math.round(y - 11));
      if (!known && p && dist(x, y, p.x, p.y) < 70 && g.done.has('trail')) {
        const a = 0.25 + 0.25 * Math.sin(t * 3 + x);
        ctx.globalAlpha = a; ctx.strokeStyle = '#ffe8a0'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(x, y, 15, 9, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // pegadas do veado
    const ds = Sprites.get('trk:veado', () => PR.trackSprite('veado'));
    ctx.globalAlpha = 0.95; ctx.drawImage(ds, Math.round(DEER_PRINT.x - 14), Math.round(DEER_PRINT.y - 11));
    if (g.done.has('deer')) {
      ctx.globalAlpha = 0.6;
      for (let i = 1; i < 6; i++) ctx.drawImage(ds, Math.round(DEER_PRINT.x - 14 - i * 2 + Math.sin(i) * 6), Math.round(DEER_PRINT.y - 11 - i * 22));
      ctx.globalAlpha = 0.95; ctx.drawImage(ds, Math.round(FINAL_PRINT.x - 14), Math.round(FINAL_PRINT.y - 11));
    }
    if (!g.done.has('deer') && p && dist(DEER_PRINT.x, DEER_PRINT.y, p.x, p.y) < 80) {
      ctx.globalAlpha = 0.3 + 0.25 * Math.sin(t * 3); ctx.strokeStyle = '#ffd666';
      ctx.beginPath(); ctx.ellipse(DEER_PRINT.x, DEER_PRINT.y, 16, 10, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // formigueiro de tucandeiras
    const ah = this.antHill;
    if (!ah) return;
    ctx.fillStyle = '#6a4a2a'; ctx.beginPath(); ctx.ellipse(ah.x, ah.y, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4a3018'; ctx.fillRect(ah.x - 1, ah.y - 1, 2, 2);
    ctx.fillStyle = '#120a06';
    for (let i = 0; i < 10; i++) { const a = t * 0.8 + i * 0.63; ctx.fillRect(Math.round(ah.x + Math.cos(a) * (5 + (i % 3) * 3)), Math.round(ah.y + Math.sin(a * 1.3) * (3 + (i % 2) * 2)), 1, 1); }
  }

  drawCamp(ctx) {
    const g = this.g;
    if (!g.flags.camp) return;
    const a = { x: px(65.4) + 3, y: px(19.2) - 12 }, b = { x: px(70.8) - 3, y: px(19.4) - 12 };
    ctx.strokeStyle = '#d8c8a0'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, a.y + 12, b.x, b.y); ctx.stroke();
    const cols = ['#c8322a', '#e8c22a', '#2a8a5a', '#2a5ac8'];
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = cols[i]; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a.x + 10, a.y + 2 + i); ctx.quadraticCurveTo((a.x + b.x) / 2, a.y + 14 + i, b.x - 10, b.y + 2 + i); ctx.stroke();
    }
    const fr = this.fireFrames[Math.floor(g.time * 9) % 4];
    ctx.drawImage(fr, Math.round(CAMP.x - 9), Math.round(CAMP.y - 12));
    const ic = Sprites.get('icon:paneiro', () => PR.iconSprite('paneiro'));
    ctx.drawImage(ic, Math.round(CAMP.x + 14), Math.round(CAMP.y - 8));
  }

  drawWorldOverlay(ctx, V) {
    const g = this.g;
    const a = clamp((g.darkness - 0.08) * 1.3, 0, 0.6);
    if (a <= 0.01) return;
    const t = g.time;
    for (const m of this.mist) {
      const x = m.x + ((t * m.sp) % 200) - 100;
      if (x < V.cx - 120 || x > V.cx + V.vw + 120 || m.y < V.cy - 40 || m.y > V.cy + V.vh + 40) continue;
      ctx.globalAlpha = a * 0.45;
      ctx.drawImage(this.mistSprite, x - 32 * m.s, m.y - 14 * m.s, 64 * m.s, 28 * m.s);
    }
    ctx.globalAlpha = 1;
  }

  drawAfterLight(ctx) {
    const e = this.eyes;
    if (!e || e.a <= 0) return;
    const g = this.g;
    ctx.globalCompositeOperation = 'lighter';
    for (const dx of [-3, 3]) {
      const x = EYES.x + dx, y = EYES.y;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, 8);
      grd.addColorStop(0, `rgba(230,255,140,${0.5 * e.a})`); grd.addColorStop(1, 'rgba(230,255,140,0)');
      ctx.fillStyle = grd; ctx.fillRect(x - 8, y - 8, 16, 16);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = e.a;
    ctx.fillStyle = '#f4ffb0';
    ctx.fillRect(EYES.x - 4, EYES.y, 2, 1); ctx.fillRect(EYES.x + 2, EYES.y, 2, 1);
    ctx.globalAlpha = 1;
    void g;
  }
}
