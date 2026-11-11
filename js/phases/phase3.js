// FASE 3 — OS SEGREDOS DA VÁRZEA
// Tarde que vira tempestade: trilha encharcada, passagem da anta, lago das capivaras,
// igarapé dos reflexos (navegação de canoa) e a margem do silêncio.
import { mulberry32, fbm, valueNoise, clamp, dist, hash2, formatTime, lerp } from '../core/util.js';
import { World, T } from '../engine/world.js';
import { Sprites } from '../gfx/sprites.js';
import { flipCanvas } from '../gfx/pixel.js';
import * as N from '../gfx/art-nature.js';
import * as PR from '../gfx/art-props.js';
import * as F2 from '../gfx/art-forest2.js';
import * as V3 from '../gfx/art-varzea.js';
import { Flyovers, Butterfly, Animal } from '../entities/animals.js';
import { Poly, buildCurrent, Canoe, DriftLogs, SQ } from '../entities/canoe.js';
import { TapirV, TS, CapyGroup, CS, PacaV, PS3, Heron } from '../ai/fauna-varzea.js';
import { circleBlocked } from '../ai/flowfield.js';
import { Save } from '../core/save.js';
import { TRACKS as TRACKS1 } from './phase1.js';
import * as D from './phase3-data.js';

const { TW, TH, S, px } = D;
const P = (a) => ({ x: px(a[0]), y: px(a[1]) });
const inEll = (x, y, e, k = 1) => ((x - e.x) / (e.rx * k)) ** 2 + ((y - e.y) / (e.ry * k)) ** 2;
const EQUIP = ['paneiro', 'espingarda', 'facao', 'cantil', 'lanterna', 'marmita'];
const isWaterT = (t) => t === T.RIVER || t === T.CREEK;

export function createPhase3(g) { return new Phase3(g); }

export class Phase3 {
  constructor(g) {
    this.g = g;
    this.id = 3; this.code = 'FASE 3'; this.title = 'OS SEGREDOS DA VÁRZEA'; this.displayTitle = 'Os Segredos da Várzea';
    this.timeLimit = 40 * 60;
    this.todStart = 830;
    this.spawn = P(D.SPAWN);
    this.menuPath = [P([78, 50]), P([96, 40])];
    this.trackDefs = TRACKS1;
    this.covers = []; this.coverGrid = new Map();
    this.prints = []; this.waves = []; this.boils = []; this.fish = []; this.timers = []; this.rain = 0; this.markA = 0;
    this.pois = [
      { name: 'Trilha encharcada', ...P([14, 65]) }, { name: 'Pegadas da anta', ...P(D.ANTA_PRINTS) }, { name: 'Passagem da anta', ...P(D.BOTTLENECK) },
      { name: 'Barreiro', ...P(D.BARREIRO) }, { name: 'Jirau abandonado', ...P(D.JIRAU) }, { name: 'Lago das capivaras', ...P([84, 47.5]) },
      { name: 'Canoa', ...P(D.CANOE.start) }, { name: 'Igarapé dos reflexos', ...P([112, 31]) }, { name: 'Igapó', ...P([116, 25]) },
      { name: 'Prainha', ...P(D.BEACH_D) }, { name: 'Correnteza', ...P([135, 33]) }, { name: 'Passagem entre as árvores', ...P(D.PASSAGE) },
      { name: 'Margem do silêncio', ...P([134, 64]) }, { name: 'Tapiri', ...P(D.TAPIRI) },
    ];
    this.buildMissions();
  }

  // ================= missões =================
  buildMissions() {
    const g = this.g, f = () => g.flags, d = (id) => g.done.has(id);
    const n = (...ks) => ks.filter((k) => f()[k]).length;
    const cluesDone = () => D.CLUES.filter((c) => f()[c.id]).length;
    const natDone = () => n('obs_anta', 'obs_capi', 'obs_paca');
    this.count = { cluesDone, natDone };
    const canoeP = () => (this.canoe ? { x: this.canoe.x, y: this.canoe.y } : P(D.CANOE.start));
    this.missions = [
      {
        id: 'm1', title: 'Entrar na várzea', progress: () => `${n('m1_trail', 'm1_mud', 'm1_marks')}/3`,
        hint: () => (!f().m1_trail ? 'Siga a trilha que vem da Fase 2, para o leste, até o primeiro igarapé raso.' : !f().m1_mud ? 'O chão virou barro. Examine (E) o primeiro trecho de lama na trilha: repare no que o barro faz com a bota.' : 'Procure marcas recentes de bicho perto da trilha: pegadas na beira do igarapé, raízes roídas. Elas brilham de leve quando você chega perto.'),
        target: () => (!f().m1_trail ? P([17.4, 65.6]) : !f().m1_mud ? P(D.LAMA1) : this.nearest(D.SIGNS_A.map((s) => s.at))),
      },
      {
        id: 'm2', title: 'Encontrar a anta', progress: () => `${n('m2_prints', 'm2_follow', 'm2_obs')}/3`,
        hint: () => (!f().m2_prints ? 'No fim da trilha encharcada há uma pegada grande, de três dedos, no barro. Examine.' : !f().m2_follow ? 'Siga a trilha da anta para o nordeste. Ande agachado (C): anta enxerga mal, mas escuta e fareja muito bem.' : 'Observe a anta de longe (E, a mais de 3,5 metros), sem deixar o vento levar seu cheiro. Do monte de raízes ao lado da trilha se vê bem a passagem.'),
        target: () => (!f().m2_prints ? P(D.ANTA_PRINTS) : !f().m2_follow ? P([50, 49]) : P(D.MIRANTE)),
      },
      {
        id: 'm3', title: 'Atravessar a passagem bloqueada',
        hint: () => 'A anta come justo na garganta estreita da trilha e o corpo dela fecha a passagem. Você pode esperar ela se afastar (ela segue para as palmeiras e volta de tempos em tempos) ou abrir caminho pelo aningal ao sul e atravessar o atoleiro. Assustar a anta também abre caminho, mas ela pode passar por cima de você.',
        target: () => P(D.B_GATE),
      },
      {
        id: 'm4', title: 'Investigar o lago', progress: () => `${n('m4_group', 'm4_shore', 'm4_canoe')}/3`,
        hint: () => (!f().m4_shore ? 'Siga para o leste até a beira do lago. Na prainha ao sul vive um grupo de capivaras: chegue devagar.' : !f().m4_group ? 'Procure o grupo de capivaras na prainha ao sul do lago.' : 'Tem alguma coisa presa na lama da margem oeste, ao norte. Examine.'),
        target: () => (!f().m4_shore ? P(D.SHORE_PT) : !f().m4_group ? P([81, 54.6]) : P(D.CANOE.start)),
      },
      {
        id: 'm5', title: 'Recuperar a canoa', progress: () => `${n('paddle', 'vines', 'branch', 'launched')}/4`,
        hint: () => this.canoeHint(),
        target: () => (!f().paddle ? P(D.JIRAU) : !f().vines || !f().branch ? canoeP() : !f().launched ? this.pushTarget() : canoeP()),
      },
      {
        id: 'm6', title: 'Atravessar o igarapé', progress: () => `${n('m6_learn', 'm6_logs', 'm6_current')}/3`,
        hint: () => (!f().m6_learn ? '<kbd>W</kbd> rema para a frente, <kbd>S</kbd> freia ou rema de ré, <kbd>A</kbd>/<kbd>D</kbd> viram. A canoa demora a ganhar e a perder velocidade: antecipe as curvas.' : !f().m6_logs ? 'Troncos descem o igarapé com a correnteza. Desvie deles. O braço alagado ao norte (igapó) é mais calmo, mas tem árvores dentro d\'água.' : !f().m6_current ? 'A correnteza fica forte entre as pedras. Rema pela parte de dentro das curvas, onde a água corre menos, e não force contra as pedras.' : 'Siga o igarapé até a passagem estreita entre duas árvores enormes.'),
        target: () => (!f().m6_logs ? P(D.LOGS_ZONE.b) : !f().m6_current ? P(D.CURRENT_ZONE.b) : P(D.PASSAGE)),
      },
      {
        id: 'm7', title: 'Investigar a movimentação na água', progress: () => `${n('m7_waves', 'm7_escape', 'm7_mark')}/3`,
        hint: () => (!f().m7_waves ? 'Siga para a lagoa escura ao sul e fique atento à água.' : !f().m7_escape ? 'Reduza a velocidade (S) na água que ferve e depois leve a canoa até a margem segura, a oeste da lagoa, antes que a turbulência aumente. Evite os troncos.' : 'Examine a árvore meio submersa na beira da lagoa.'),
        target: () => (!f().m7_waves ? P(D.TURB) : !f().m7_escape ? P(D.SAFE_BANK) : P(D.MARK_TREE)),
      },
      {
        id: 'm8', title: 'Localizar o rastro do veado', progress: () => `${n('m8_land', 'm8_prints', 'm8_hair', 'm8_dir')}/4`,
        hint: () => (!f().m8_land ? 'Desembarque na margem oeste da lagoa (E perto da terra).' : !f().m8_prints ? 'Procure pegadas recentes do veado no barro da margem.' : !f().m8_hair ? 'Procure pelos vermelhos presos num arbusto, mais para dentro da mata.' : 'Examine os galhos quebrados mais adiante e descubra para onde o veado seguiu.'),
        target: () => (!f().m8_land ? P(D.SAFE_BANK) : !f().m8_prints ? P(D.PRINTS_E) : !f().m8_hair ? P(D.HAIR_E) : P(D.DIR_SIGN)),
      },
      { id: 'm9', title: 'Alcançar o abrigo', hint: 'Siga o rastro até o antigo tapiri, antes que a tempestade piore.', target: () => P(D.TAPIRI) },
    ];
    this.secondary = [
      { id: 's_nat', title: 'Naturalista da Várzea', progress: () => `${natDone()}/3`, hint: 'Observe (E) uma anta, uma capivara e uma paca sem provocá-las. A paca é tímida e sai das tocas quando a mata escurece: procure raízes perto da água, em silêncio.', target: () => null },
      { id: 's_rem', title: 'Remador Experiente', failed: () => !!this.rowFail && !g.done.has('s_rem'), hint: 'Atravesse o trecho dos troncos (do lago até depois do igapó) sem bater em nada. Se bater, volte remando até o começo do trecho para tentar de novo.', target: () => null },
      { id: 's_rastro', title: 'Rastreador das Margens', progress: () => `${Math.min(4, cluesDone())}/4`, hint: 'Bichos da várzea deixam sinais nas margens: cascas roídas, lamaçal de banho, espinhas de peixe, fezes, rastro arrastado, escorregador de barro. Encontre quatro.', target: () => null },
    ];
  }
  currentMission() { return this.missions.find((m) => !this.g.done.has(m.id)) || null; }
  todCap() { const n = this.missions.filter((m) => this.g.done.has(m.id)).length; return 842 + n * 24; }
  nearest(list) {
    const p = this.g.player; let best = null, bd = 1e9;
    for (const a of list) { const q = P(a); const d = p ? dist(q.x, q.y, p.x, p.y) : 0; if (d < bd) { bd = d; best = q; } }
    return best;
  }
  canoeHint() {
    const f = this.g.flags;
    if (!f.paddle) return 'Canoa sem remo não anda. Procure no antigo jirau de pesca, na trilha ao norte do lago.';
    if (!f.vines) return 'Cipós e raízes de aninga prendem a canoa. Corte com o facão (E perto da canoa).';
    if (!f.branch) return 'Um galho grosso caiu por cima da canoa. Tire o galho (E).';
    if (!f.launched) return 'Empurre a canoa para a água: fique atrás dela (do lado da mata) e ande na direção do lago.';
    return 'A canoa está boiando. Embarque com E.';
  }

  // ================= construção estática =================
  async buildStatic(progress) {
    const w = (this.world = new World(TW, TH));
    await progress(0.06, 'Molhando as trilhas…');
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
            const dd = Math.hypot(cx + 0.5 - x * 8, cy + 0.5 - y * 8), i2 = cy * cw + cx;
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
    this.main = new Poly(D.CHANNEL); this.side = new Poly(D.SIDE);
    const creeks = D.CREEKS_A.map((c) => new Poly(c.pts.map(([x, y]) => [x, y, c.w, 0])));
    await progress(0.14, 'Enchendo o lago e os igarapés…');
    // pré-cálculo da distância aos canais em células de 8 px (só perto deles)
    const chanD = new Float32Array(cw * ch).fill(9), chanK = new Uint8Array(cw * ch);
    const markPoly = (Pl, kind) => {
      for (const q of Pl.seg) {
        const m = Math.max(q.a.w, q.b.w) * 0.5 + 12;
        const x0 = Math.floor((Math.min(q.a.x, q.b.x) - m) / 2), x1 = Math.ceil((Math.max(q.a.x, q.b.x) + m) / 2);
        const y0 = Math.floor((Math.min(q.a.y, q.b.y) - m) / 2), y1 = Math.ceil((Math.max(q.a.y, q.b.y) + m) / 2);
        for (let cy = Math.max(0, y0); cy <= Math.min(ch - 1, y1); cy++) for (let cx = Math.max(0, x0); cx <= Math.min(cw - 1, x1); cx++) {
          const x = cx * 2 + 1, y = cy * 2 + 1;
          const vx = x - q.a.x, vy = y - q.a.y, k = clamp((vx * q.tx + vy * q.ty) / q.L, 0, 1);
          const dd = Math.hypot(x - (q.a.x + (q.b.x - q.a.x) * k), y - (q.a.y + (q.b.y - q.a.y) * k));
          const hw = lerp(q.a.w, q.b.w, k) * 0.5;
          const r = dd / hw, i = cy * cw + cx;
          if (r < chanD[i]) { chanD[i] = r; chanK[i] = kind; }
        }
      }
    };
    markPoly(this.main, 1); markPoly(this.side, 2);
    for (const c of creeks) markPoly(c, 3);
    w.generate((tx, ty) => {
      const n = fbm(tx * 0.15, ty * 0.15, 3, 3), n2 = valueNoise(tx * 0.6, ty * 0.6, 8);
      const ci = Math.floor(ty * 8) * cw + Math.floor(tx * 8);
      for (const o of D.OVR) if (inEll(tx, ty, o) < 1) return [o.t === 'mud' ? T.MUD : T.FLOOR];
      // lago, lagoa e canais
      const el = inEll(tx, ty, D.LAKE) + (fbm(tx * 0.3, ty * 0.3, 19, 2) - 0.5) * 0.3;
      if (el < 1) return [T.RIVER, clamp((1 - el) * 1.5, 0, 1)];
      const eg = inEll(tx, ty, D.LAGOON) + (fbm(tx * 0.3, ty * 0.3, 23, 2) - 0.5) * 0.25;
      if (eg < 1) return [T.CREEK, clamp((1 - eg) * 1.3 + 0.2, 0, 1)];
      const cr = chanD[ci] + (n2 - 0.5) * 0.12;
      if (chanK[ci] === 1 && cr < 1) return [T.RIVER, clamp(1 - cr, 0, 1)];
      if (chanK[ci] === 2 && cr < 1) return [T.CREEK, clamp(0.8 - cr * 0.6, 0, 1)];
      const walkBand = band[ci] > 0.02;
      if (chanK[ci] === 3 && cr < 1) return walkBand ? [T.SHALLOW] : [T.CREEK, clamp(0.7 - cr * 0.5, 0, 1)];
      const inArea = D.AREAS.find((a) => inEll(tx, ty, a) < 1 + (n - 0.5) * 0.3);
      if (!walkBand && !inArea) return [T.THICKET];
      for (const m of D.MUD_A) if (inEll(tx, ty, m) < 1 + (n - 0.5) * 0.5) return [T.MUD];
      if (inArea && inArea.t === 'mud') return [T.MUD];
      if (inArea && inArea.t === 'sand') return [T.SAND];
      const tf = core[ci];
      if (tf > 0.45 + (n2 - 0.5) * 0.3) return [n > 0.62 ? T.MUD : T.DIRT];
      if (inArea && inArea.t === 'grass') return [n > 0.45 ? T.GRASS : T.MUD];
      if (inArea && inArea.t === 'clear') return [T.CLEAR];
      return [T.FLOOR];
    });
    w.waterTiles = new Uint8Array(TW * TH);
    for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) {
      const t = w.terrainAt(tx * 16 + 8, ty * 16 + 8);
      w.waterTiles[ty * TW + tx] = t === T.RIVER ? 1 : t === T.CREEK ? 2 : 0;
    }
    this.current = buildCurrent(w, [this.main, this.side]);
    this.buildNav();
    await progress(0.3, 'Plantando a várzea…');
    this.placeVegetation();
    await progress(0.5, 'Espalhando troncos e pedras…');
    this.placeProps();
    await progress(0.66, 'Marcando o barro…');
    const gctx = w.renderGround();
    this.decorateGround(gctx);
    await progress(0.9, 'Desenhando o mapa…');
    w.buildDensityCanvas();
    w.buildMiniMap();
    Sprites.get('icon:remo', () => V3.remoIcon());
    Sprites.get('icon:pelos', () => F2.icon2('pelos'));
    await progress(0.98, 'Quase lá…');
  }

  // pontos de recuperação da canoa (no meio da água, com o sentido da viagem)
  buildNav() {
    const out = [];
    const add = (x, y, a) => out.push({ x, y, a });
    const lake = [D.CANOE.end, [81.5, 47.2], [86, 46.4], [89.4, 45.2]].map(P);
    for (let i = 0; i < lake.length - 1; i++) { const a = lake[i], b = lake[i + 1], an = Math.atan2(b.y - a.y, b.x - a.x); for (let t = 0; t < 1; t += 0.25) add(lerp(a.x, b.x, t), lerp(a.y, b.y, t), an); }
    for (const Pl of [this.main, this.side]) for (let s = 0; s <= Pl.len; s += 12) { const q = Pl.at(s); add(q.x, q.y, Math.atan2(q.ty, q.tx)); }
    const lg = [[136, 62], [133, 63.6], [129.6, 64.8], [126.4, 65.8]].map(P);
    for (let i = 0; i < lg.length - 1; i++) { const a = lg[i], b = lg[i + 1], an = Math.atan2(b.y - a.y, b.x - a.x); for (let t = 0; t < 1; t += 0.34) add(lerp(a.x, b.x, t), lerp(a.y, b.y, t), an); }
    this.nav = out;
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

  tree(x, y, size, seed, collide = true) {
    const w = this.world, v = seed % 6;
    let th, tw2, bt, cr, pal;
    if (size === 'huge') { th = 46; tw2 = 12; bt = 10; cr = 46; pal = N.GREENS.deep; }
    else if (size === 'big') { th = 36 + (v % 3) * 4; tw2 = 9; bt = 7 + (v % 2) * 2; cr = 36 + (v % 3) * 4; pal = N.GREENS.deep; }
    else if (size === 'mid') { th = 24 + (v % 3) * 3; tw2 = 6; bt = v % 2 ? 3 : 0; cr = 22 + (v % 3) * 3; pal = v % 2 ? N.GREENS.mid : N.GREENS.olive; }
    else { th = 15 + (v % 2) * 3; tw2 = 4; bt = 0; cr = 13 + (v % 2) * 2; pal = N.GREENS.light; }
    const trunk = Sprites.get(`tr:${size}:${v}`, () => N.trunkSprite(500 + v * 13 + size.length, th, tw2, bt, size === 'small' ? ['#4a3a2a', '#5e4a36', '#76604a', '#8e785e'] : undefined));
    const crown = Sprites.get(`cr:${size}:${v}`, () => N.crownSprite(900 + v * 31 + size.length * 7, cr, pal));
    const d = w.addDrawable({ x, y, sprite: trunk, ax: trunk.width / 2, ay: trunk.height - 2, crown: { sprite: crown, dx: 0, dy: -th - cr * 0.3, r: cr, h: th }, kind: 'tree', size });
    if (collide) w.addCollider({ x, y: y - 2, r: tw2 / 2 + (bt ? bt * 0.6 : 0) + 1, kind: 'tree' });
    w.addDensity(x, y - th - cr * 0.3, cr * 1.05, size === 'big' || size === 'huge' ? 1 : 0.8);
    return d;
  }
  palm(x, y, kind, v, collide = true) {
    const w = this.world;
    const s = kind === 'acai' ? Sprites.get('pa:acai:' + (v % 5), () => N.acaiSprite(70 + v % 5)) : kind === 'buriti' ? Sprites.get('pa:bur:' + (v % 3), () => N.buritiSprite(80 + v % 3)) : Sprites.get('pa:emb:' + (v % 4), () => N.embaubaSprite(90 + v % 4));
    w.addDrawable({ x, y, sprite: s, ax: s.width / 2, ay: s.height - 2, shadow: { rx: kind === 'buriti' ? 14 : 10, ry: 4, dx: -8, len: 10 } });
    if (collide) w.addCollider({ x, y: y - 1, r: kind === 'buriti' ? 3 : 2, kind: 'tree' });
    w.addDensity(x, y - s.height * 0.75, kind === 'buriti' ? 22 : 16, 0.35);
  }
  plant(x, y, kind, v, cover = true) {
    const w = this.world;
    let s;
    if (kind === 'bush') s = Sprites.get('bu:' + (v % 6), () => N.bushSprite(200 + v % 6, 7 + (v % 3), v % 2 ? N.GREENS.mid : N.GREENS.light));
    else if (kind === 'bigbush') s = Sprites.get('bb:' + (v % 3), () => N.bushSprite(260 + v % 3, 11, N.GREENS.mid));
    else if (kind === 'fern') s = Sprites.get('fe:' + (v % 4), () => N.fernSprite(300 + v % 4));
    else if (kind === 'heliconia') s = Sprites.get('he:' + (v % 3), () => N.heliconiaSprite(400 + v % 3));
    else if (kind === 'aninga' || kind === 'canarana') {
      s = kind === 'aninga' ? Sprites.get('an:' + (v % 5), () => V3.aningaSprite(700 + v % 5)) : Sprites.get('cn:' + (v % 4), () => V3.canaranaSprite(740 + v % 4));
      // planta de beira d'água balança com o vento (a parte de cima oscila)
      const sp = s, ph = (x * 0.13 + y * 0.07) % 6.28, X = Math.round(x - sp.width / 2), Y = Math.round(y - sp.height + 2), cut = Math.round(sp.height * 0.55);
      w.addDrawable({ x, y, kind, draw: (ctx, g) => {
        const off = Math.round(Math.sin(g.time * 1.4 + ph) * (0.6 + 0.5 * g.wind.a));
        ctx.drawImage(sp, 0, 0, sp.width, cut, X + off, Y, sp.width, cut);
        ctx.drawImage(sp, 0, cut, sp.width, sp.height - cut, X, Y + cut, sp.width, sp.height - cut);
      } });
      return s;
    }
    w.addDrawable({ x, y, sprite: s, ax: s.width / 2, ay: s.height - 2, kind });
    if (cover && kind === 'bush') this.addCover(x, y - 4, 10 + (v % 3));
    return s;
  }

  placeVegetation() {
    const w = this.world, rng = mulberry32(3033);
    const terr = (tx, ty) => w.terrainAt(tx * 16, ty * 16);
    const nearWater = (x, y, r = 1.6) => { for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r * 0.7, r * 0.7], [-r * 0.7, r * 0.7], [r * 0.7, -r * 0.7], [-r * 0.7, -r * 0.7]]) if (isWaterT(terr(x + dx, y + dy))) return true; return false; };
    const keepPts = [D.LAMA1, D.ANTA_PRINTS, D.MIRANTE, D.BOTTLENECK, D.PALMS, D.BARREIRO, D.DETOUR_GATE, D.B_GATE, D.JIRAU, D.SHORE_PT, D.CANOE.start, D.CANOE.end, D.MARK_TREE, D.PRINTS_E, D.HAIR_E, D.DIR_SIGN, D.TAPIRI, D.SAFE_BANK, ...D.SIGNS_A.map((s) => s.at), ...D.CLUES.map((c) => c.at), ...D.PACA_DENS.map((p) => p.at), ...D.HERONS];
    const keep = (tx, ty, r = 0) => keepPts.some(([x, y]) => Math.hypot(tx - x, ty - y) < 2.4 + r);
    for (let ty = 2; ty < TH - 1; ty += 1.6) for (let tx = 1; tx < TW - 1; tx += 1.6) {
      const x = tx + rng() * 1.4, y = ty + rng() * 1.4;
      const t = terr(x, y);
      if (t === 255 || isWaterT(t) || t === T.SHALLOW) continue;
      if (t === T.THICKET) {
        let edge = false;
        for (const [dx, dy] of [[1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6], [2.6, 0], [-2.6, 0], [0, 2.6]]) { const t2 = terr(x + dx, y + dy); if (t2 !== T.THICKET && t2 !== 255) { edge = true; break; } }
        const r = rng(), wet = nearWater(x, y, 1.4);
        if (edge && keep(x, y, 2)) { if (rng() < 0.7) this.plant(px(x), px(y), rng() < 0.6 ? 'bigbush' : 'fern', (rng() * 9) | 0, false); continue; }
        if (edge && wet) {
          // beira d'água: buritis, açaís, aninga e canarana; árvore de copa grande só onde a copa
          // não cobre o canal (água ao norte esconderia a canoa)
          const waterAbove = isWaterT(terr(x, y - 1.5)) || isWaterT(terr(x, y - 2.6)) || isWaterT(terr(x, y - 3.6));
          if (r < 0.22 && !waterAbove) this.tree(px(x), px(y), rng() < 0.4 ? 'big' : 'mid', (rng() * 6) | 0, false);
          else if (r < 0.3 && waterAbove) this.tree(px(x), px(y), 'small', (rng() * 6) | 0, false);
          else if (r < 0.5 && !waterAbove) this.palm(px(x), px(y), rng() < 0.55 ? 'buriti' : 'acai', (rng() * 9) | 0, false);
          if (rng() < 0.75) this.plant(px(x + (rng() - 0.5)), px(y + 0.3), rng() < 0.55 ? 'aninga' : 'canarana', (rng() * 9) | 0, false);
          continue;
        }
        if (edge) {
          if (r < 0.34) this.tree(px(x), px(y), rng() < 0.4 ? 'big' : 'mid', (rng() * 6) | 0, false);
          else if (r < 0.5) this.palm(px(x), px(y), rng() < 0.6 ? 'acai' : 'embauba', (rng() * 9) | 0, false);
          else if (r < 0.62) this.tree(px(x), px(y), 'small', (rng() * 6) | 0, false);
          if (rng() < 0.85) this.plant(px(x + (rng() - 0.5)), px(y + 0.4), rng() < 0.6 ? 'bigbush' : rng() < 0.5 ? 'fern' : 'heliconia', (rng() * 9) | 0, false);
          if (rng() < 0.5) this.plant(px(x + (rng() - 0.5) * 1.2), px(y - 0.5), rng() < 0.7 ? 'bush' : 'fern', (rng() * 9) | 0, false);
        } else if (r < 0.32) { if (!isWaterT(terr(x, y - 2.4)) && !isWaterT(terr(x, y - 3.6))) this.tree(px(x), px(y), rng() < 0.5 ? 'big' : 'mid', (rng() * 6) | 0, false); }
        else if (r < 0.44 && !isWaterT(terr(x, y - 2.2))) this.palm(px(x), px(y), rng() < 0.5 ? 'acai' : 'buriti', (rng() * 9) | 0, false);
        continue;
      }
      if (keep(x, y)) continue;
      const nt = this.nearTrail(x, y);
      if (nearWater(x, y, 1.0)) { if (rng() < 0.35) this.plant(px(x), px(y), rng() < 0.5 ? 'canarana' : 'aninga', (rng() * 9) | 0); continue; }
      if (t === T.MUD) { if (nt < 0.1 && rng() < 0.15) this.palm(px(x), px(y), 'buriti', (rng() * 9) | 0); continue; }
      if (t === T.SAND || t === T.CLEAR) { if (rng() < 0.1) this.plant(px(x), px(y), 'fern', (rng() * 9) | 0); continue; }
      if (nt > 0.05) { if (nt < 0.4 && rng() < 0.3) this.plant(px(x), px(y), rng() < 0.4 ? 'fern' : 'bush', (rng() * 9) | 0); continue; }
      const r = rng();
      if (r < 0.08) this.tree(px(x), px(y), 'big', (rng() * 6) | 0);
      else if (r < 0.26) this.tree(px(x), px(y), 'mid', (rng() * 6) | 0);
      else if (r < 0.36) this.palm(px(x), px(y), rng() < 0.6 ? 'acai' : 'buriti', (rng() * 9) | 0);
      else this.plant(px(x), px(y), rng() < 0.5 ? 'bush' : rng() < 0.6 ? 'fern' : 'heliconia', (rng() * 9) | 0);
    }
    // árvores em pé dentro d'água no igapó (a canoa precisa desviar)
    for (const [i, t, off, r] of D.IGAPO_TREES) { const q = this.side.segPoint(i, t, off); const d = this.tree(q.x, q.y, i % 2 ? 'mid' : 'big', (i * 7 + (t * 10) | 0), false); this.world.addCollider({ x: q.x, y: q.y - 2, r, kind: 'tree' }); d.inWater = true; }
    // as duas árvores enormes da passagem
    for (const [x, y] of D.GATE_TREES) { this.tree(px(x), px(y), 'huge', 3, false); this.world.addCollider({ x: px(x), y: px(y) - 2, r: 7, kind: 'tree' }); }
    // sapopema do mirante da anta e árvores da margem do silêncio
    this.tree(px(D.MIRANTE[0]) - 14, px(D.MIRANTE[1]) - 6, 'big', 2);
    for (const [x, y] of [[118, 66.4], [114.4, 70.2], [121.2, 71.4], [107, 73.6], [112, 77.4]]) this.tree(px(x), px(y), 'big', (x | 0) % 6);
  }

  placeProps() {
    const w = this.world;
    const add = (x, y, s, o = {}) => w.addDrawable({ x, y, sprite: s, ax: o.ax ?? s.width / 2, ay: o.ay ?? s.height - 2, ...o });
    // pedras da correnteza (molhadas, com espuma desenhada à parte)
    this.rocks = [];
    for (const [i, t, off, r] of D.ROCKS_D) {
      const q = this.main.segPoint(i, t, off);
      const s = Sprites.get('wrock:' + r, () => N.rockSprite(660 + r * 3, r));
      add(q.x, q.y + r * 0.4, s, { ay: s.height - 2 });
      w.addCollider({ x: q.x, y: q.y, r: r + 0.5, kind: 'rock', noBoat: false });
      this.rocks.push({ x: q.x, y: q.y, r });
    }
    // troncos mortos na lagoa
    this.snags = [];
    for (const [x, y, r] of D.LAGOON_SNAGS) {
      const s = Sprites.get('snag:' + r, () => N.trunkSprite(820 + r, 16 + r, 5, 2, ['#2a2620', '#3a342c', '#4a443a', '#5a5448']));
      add(px(x), px(y), s, { ay: s.height - 3 });
      w.addCollider({ x: px(x), y: px(y) - 1, r, kind: 'snag' });
      this.snags.push({ x: px(x), y: px(y), r });
    }
    // árvore meio submersa com as marcas
    const mt = P(D.MARK_TREE);
    this.markTreeSprite = Sprites.get('marktree', () => N.trunkSprite(870, 52, 11, 5, ['#2a2620', '#3a342c', '#4e463a', '#665c4c']));
    add(mt.x, mt.y, this.markTreeSprite, { ay: this.markTreeSprite.height - 4 });
    w.addCollider({ x: mt.x, y: mt.y - 1, r: 8, kind: 'snag' });
    // galhos secos (poleiros das garças)
    for (const [x, y] of D.HERONS) { const s = Sprites.get('perch', () => F2.logSprite(4400, 18, 2.5, false)); add(px(x) + 2, px(y) + 2, s, { ay: 6 }); }
    // jirau de pesca
    const jr = P(D.JIRAU);
    this.jirau = { x: jr.x, y: jr.y };
    w.addCollider({ x: jr.x - 16, y: jr.y - 6, w: 4, h: 5 }); w.addCollider({ x: jr.x + 13, y: jr.y - 6, w: 4, h: 5 });
    // tapiri
    const tp = P(D.TAPIRI);
    this.tapiriSprite = Sprites.get('tapiri', () => V3.tapiriSprite());
    add(tp.x, tp.y + 8, this.tapiriSprite, { ay: this.tapiriSprite.height - 2 });
    for (const dx of [-21, 21]) w.addCollider({ x: tp.x + dx, y: tp.y + 4, r: 2.5 });
    // barreiro e palmeiras da anta
    for (const [x, y] of [[62.4, 38.8], [64.6, 39.0], [63.6, 37.8]]) this.palm(px(x), px(y), 'acai', (x * 3) | 0, false);
    // moitas de esconderijo perto do mirante e na prainha
    for (const [x, y] of [[51.6, 47.6], [53.8, 49.6], [45.6, 53.6], [77.4, 52.6], [80.2, 57.2], [73.4, 45.6], [120.6, 69.8]]) { this.plant(px(x), px(y), 'bigbush', (x * 3) | 0, false); this.addCover(px(x), px(y) - 3, 13); }
    // raízes nas tocas de paca
    for (const d of D.PACA_DENS) { const s = Sprites.get('root:26', () => F2.rootSprite(26, 26)); add(px(d.at[0]), px(d.at[1]) - 3, s, { ay: s.height - 2 }); }
    // canarana flutuante
    this.floatGrass = D.FLOAT_GRASS.map(([x, y, r]) => ({ x: px(x), y: px(y), r: r * S }));
  }

  decorateGround(ctx) {
    const w = this.world, rng = mulberry32(6262);
    ctx.strokeStyle = 'rgba(40,28,16,0.75)'; ctx.lineWidth = 2;
    for (const d of w.drawables) {
      if (d.kind !== 'tree' || (d.size !== 'big' && d.size !== 'huge')) continue;
      if (w.terrainAt(d.x, d.y) === T.THICKET && rng() < 0.6) continue;
      for (let k = 0; k < 5; k++) {
        const a = rng() * Math.PI * 2, L2 = 14 + rng() * 14;
        ctx.beginPath(); ctx.moveTo(d.x, d.y - 2);
        ctx.quadraticCurveTo(d.x + Math.cos(a) * L2 * 0.5 + (rng() - 0.5) * 6, d.y + Math.sin(a) * L2 * 0.25, d.x + Math.cos(a) * L2, d.y + Math.sin(a) * L2 * 0.45);
        ctx.stroke();
      }
    }
    for (let i = 0; i < 17000; i++) {
      const x = rng() * w.W, y = rng() * w.H, t = w.terrainAt(x, y);
      if (t === T.FLOOR || t === T.CLEAR) {
        const r = rng();
        if (r < 0.45) { ctx.fillStyle = ['#7a5428', '#8e6a30', '#5e4420', '#9a7a3a', '#6a3a1e'][(rng() * 5) | 0]; ctx.fillRect(x | 0, y | 0, 2 + (rng() * 2 | 0), 1); }
        else if (r < 0.7) { ctx.fillStyle = '#3f6a2a'; ctx.fillRect(x | 0, y | 0, 1, 2); }
        else if (r < 0.78) { ctx.fillStyle = 'rgba(30,40,40,0.25)'; ctx.fillRect(x | 0, y | 0, 3, 1); } // poças
      } else if (t === T.THICKET) {
        ctx.fillStyle = rng() < 0.5 ? '#1e2e14' : '#2c3a1a'; ctx.fillRect(x | 0, y | 0, 2, 2);
      } else if (t === T.GRASS) {
        ctx.fillStyle = rng() < 0.5 ? '#6a9a3a' : '#4e7a2a'; ctx.fillRect(x | 0, y | 0, 1, 2); ctx.fillRect((x | 0) + 2, (y | 0) + 1, 1, 2);
      } else if (t === T.MUD) {
        // barro: rachaduras, poças brilhantes e marcas
        const r = rng();
        if (r < 0.35) { ctx.fillStyle = 'rgba(40,30,18,0.55)'; ctx.fillRect(x | 0, y | 0, 3, 1); }
        else if (r < 0.45) { ctx.fillStyle = 'rgba(150,140,110,0.35)'; ctx.fillRect(x | 0, y | 0, 2, 1); }
      } else if (t === T.RIVER || t === T.CREEK) {
        // aguapé e mureru nas beiras paradas
        if (rng() < 0.02 && this.current.at(x, y).x === 0 && !w.isWater(x + 18, y) !== !w.isWater(x - 18, y)) V3.lilyCluster(ctx, x, y, i, 0.9);
      }
    }
    // água da várzea: barrenta no lago e no igarapé, escura e esverdeada na lagoa e no igapó
    for (let y = 0; y < w.H; y += 2) for (let x = 0; x < w.W; x += 2) {
      const t = w.terrainAt(x, y);
      if (t === T.RIVER) { ctx.fillStyle = 'rgba(46,62,52,0.42)'; ctx.fillRect(x, y, 2, 2); }
      else if (t === T.CREEK) { ctx.fillStyle = 'rgba(18,34,32,0.38)'; ctx.fillRect(x, y, 2, 2); }
      else if (t === T.SHALLOW) { ctx.fillStyle = 'rgba(60,80,76,0.25)'; ctx.fillRect(x, y, 2, 2); }
    }
    // barrancos dos igarapés e margens molhadas
    for (let y = 0; y < w.H; y += 2) for (let x = 0; x < w.W; x += 2) {
      const t = w.terrainAt(x, y);
      if (!isWaterT(t) && t !== T.THICKET && isWaterT(w.terrainAt(x, y + 4))) { ctx.fillStyle = 'rgba(60,44,26,0.7)'; ctx.fillRect(x, y, 2, 2); }
      if (isWaterT(t) && !isWaterT(w.terrainAt(x, y - 3))) { ctx.fillStyle = 'rgba(20,16,10,0.5)'; ctx.fillRect(x, y, 2, 2); }
    }
    // pegadas e sinais estáticos
    const draw = (kind, at, n = 1, sp = 10, a = 0.6) => { const s = Sprites.get('trk:' + kind, () => PR.trackSprite(kind)); ctx.globalAlpha = a; for (let i = 0; i < n; i++) ctx.drawImage(s, Math.round(px(at[0]) - 14 + (i - (n - 1) / 2) * sp), Math.round(px(at[1]) - 11 + (i % 2) * 4)); ctx.globalAlpha = 1; };
    draw('capivara', D.SIGNS_A[0].at, 3, 12);
    draw('anta', D.ANTA_PRINTS, 2, 16, 0.8);
    for (const pt of [[46, 53], [48.6, 50.4], [51.6, 48.3], [54.6, 46.6], [59, 44.6], [61.6, 43.2]]) draw('anta', pt, 1, 0, 0.45);
    draw('capivara', [80.6, 55.6], 2, 14, 0.5); draw('capivara', [86.4, 54.8], 2, 14, 0.5);
    draw('veado', D.PRINTS_E, 2, 14, 0.75);
    for (const pt of [[120.4, 68.8], [117.4, 70.8], [113.6, 72.6]]) draw('veado', pt, 1, 0, 0.55);
    // cinzas antigas no tapiri
    ctx.fillStyle = 'rgba(30,24,18,0.6)'; ctx.beginPath(); ctx.ellipse(px(D.TAPIRI[0]) - 6, px(D.TAPIRI[1]) + 6, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
  }

  // ================= estado dinâmico =================
  carryIn(data) {
    const c = data.carry || {};
    const items = new Map(c.inv?.items || []);
    for (const id of EQUIP) if (!items.has(id)) items.set(id, 1);
    if (!items.has('fumo')) items.set('fumo', 1);
    for (const id of ['galhos', 'tabua', 'cipo', 'vara']) items.delete(id);
    return {
      done: [], flags: {}, tracks: c.tracks || [], tod: this.todStart,
      inv: { items: [...items], found: c.inv?.found || c.found || [] },
      res: { water: c.res?.water ?? 2, food: Math.max(2, c.res?.food ?? 2), ammo: c.res?.ammo ?? 5 },
    };
  }

  setupDynamic(fromSave) {
    const g = this.g, w = this.world, f = g.flags;
    f.score = f.score || 0; f.journal = f.journal || [];
    this.timers = []; this.prints = []; this.fish = []; this.splashT = 0; this.fishT = 3; this.gateMsgT = 0; this.mudTipT = 0;
    this.ev = null; this.instab = 0; this.rowAttempt = false; this.rowFail = false; this.learnD = 0; this.learnTurn = 0; this.finished = false;
    this.rain = f.rainOn ? clamp(f.rainT / 160 + 0.15, 0, 1) : 0; this.thunderT = 8; this.lightT = 6; this.waves = []; this.shadows = []; this.bigShadow = null; this.boils = [];
    this.tapirRelease = f.tapirFree ? 0 : null; this.lastPos = null; this.landSpot = null; this.birdShadow = null; this.markA = f.m7_mark ? 1 : 0;
    g.lights = [];
    g.onAnimalEvent = (a, ev) => this.onAnimalEvent(a, ev);
    const self = this;

    // ---------- Região A ----------
    const lm = P(D.LAMA1);
    g.interactables.push({ x: lm.x, y: lm.y, r: 26, py: 12, label: 'Examinar o trecho de lama', enabled: () => !f.m1_mud, action: () => this.examineMud() });
    for (const s of D.SIGNS_A) { const p = P(s.at); g.interactables.push({ x: p.x, y: p.y, r: 24, py: 12, label: 'Examinar as marcas', enabled: () => !f['sign_' + s.id], action: () => this.examineSign(s) }); }
    const ap = P(D.ANTA_PRINTS);
    g.interactables.push({ x: ap.x, y: ap.y, r: 26, py: 12, label: 'Examinar a pegada grande', enabled: () => !f.m2_prints && g.done.has('m1'), action: () => this.examineTapirPrints() });
    for (const c of D.CLUES) { const p = P(c.at); g.interactables.push({ x: p.x, y: p.y, r: 22, py: 12, label: 'Examinar', enabled: () => !f[c.id], action: () => this.examineClue(c) }); }

    // ---------- fauna ----------
    const R = mulberry32(fromSave ? 77 : 31);
    const route = [
      { ...P(D.BARREIRO), feed: [35, 55] }, { ...P([50, 48.6]) }, { ...P([53, 47.2]) },
      { ...P(D.BOTTLENECK), feed: [14, 22], hold: true }, { ...P([60.2, 44]) }, { ...P([62.6, 42.6]) }, { ...P([63.2, 40.2]), feed: [32, 48] },
    ];
    this.tapir = new TapirV(g, this, route, f.tapirFree ? 6 : 3, { rng: R });
    if (f.tapirFree) { this.tapir.dirn = -1; }
    g.entities.push(this.tapir); g.updaters.push(this.tapir);
    g.interactables.push({
      get x() { return self.tapir.x; }, get y() { return self.tapir.y; }, r: 230, py: 22,
      label: () => (dist(self.tapir.x, self.tapir.y, g.player.x, g.player.y) < 56 ? 'Perto demais: afaste-se' : 'Observar a anta de longe'),
      enabled: () => f.m2_prints && !f.m2_obs && self.tapir.visible && self.tapir.calm() && self.los(g.player.x, g.player.y - 8, self.tapir.x, self.tapir.y - 6),
      action: () => this.observeTapir(),
    });
    const cg = (this.capys = new CapyGroup(g, this, { x: px(D.CAPY_HOME[0]), y: px(D.CAPY_HOME[1]) - 2, rx: px(5.6), ry: px(1.2) }, P(D.CAPY_SAFE)));
    const spots = [[80, 55.6, CS.REST], [82.2, 56.0, CS.REST, true], [84.6, 55.2, CS.GRAZE], [86.6, 55.8, CS.GRAZE], [81.4, 54.8, CS.GRAZE, true], [85.4, 52.2, CS.SWIM], [83.4, 52.0, CS.SWIM]];
    for (const [x, y, st, juv] of spots) cg.add(px(x), px(y), { state: st, juv });
    g.updaters.push(cg); for (const m of cg.members) { g.entities.push(m); g.animals.push(m); }
    g.interactables.push({
      get x() { return self.capyCenter().x; }, get y() { return self.capyCenter().y; }, r: 260, py: 24,
      label: () => (dist(self.capyCenter().x, self.capyCenter().y, g.player.x, g.player.y) < 64 ? 'Perto demais: afaste-se' : 'Observar as capivaras'),
      enabled: () => !f.obs_capi && !this.boarded() && cg.calmNow() && f.m4_group,
      action: () => this.observeCapys(),
    });
    this.pacas = D.PACA_DENS.map((d) => new PacaV(g, this, P(d.at), { id: d.id, shade: d.shade }));
    for (const pc of this.pacas) {
      g.entities.push(pc); g.updaters.push(pc);
      g.interactables.push({ get x() { return pc.x; }, get y() { return pc.y; }, r: 170, py: 16, label: () => (dist(pc.x, pc.y, g.player.x, g.player.y) < 30 ? 'Perto demais' : 'Observar a paca'), enabled: () => !f.obs_paca && pc.visible && [PS3.FORAGE, PS3.WALK, PS3.EMERGE].includes(pc.state) && pc.aware < 0.5 && !this.boarded(), action: () => this.observePaca(pc) });
    }
    this.herons = D.HERONS.map(([x, y]) => new Heron(g, this, px(x), px(y)));
    for (const h of this.herons) { g.entities.push(h); g.updaters.push(h); g.airEntities.push(h); }
    const small = [];
    for (const [x, y] of [[9, 63.6], [26, 59.4], [46, 56.4]]) small.push(new Animal(g, 'cotia', px(x), px(y)));
    for (const [x, y] of [[14, 68], [70, 39.4], [119.6, 66]]) for (let i = 0; i < 2; i++) small.push(new Animal(g, 'jacu', px(x) + i * 12, px(y) + i * 5));
    for (const a of small) { g.animals.push(a); g.entities.push(a); g.updaters.push(a); g.airEntities.push(a); }
    const fo = new Flyovers(g); g.updaters.push(fo); g.airEntities.push(fo);
    for (const [x, y] of [[8, 64], [24, 60], [44, 52.6], [72, 41], [76.4, 50]]) { const b = new Butterfly(g, px(x), px(y)); g.updaters.push(b); g.entities.push(b); }

    // ---------- Região B: aningal do desvio, portão para o lago ----------
    const dg = P(D.DETOUR_GATE);
    this.detourCol = w.addCollider({ x: dg.x - 20, y: dg.y - 12, w: 40, h: 26, dyn: true, off: !!f.detourCut });
    g.entities.push({ x: dg.x, y: dg.y + 6, draw: (ctx, gg) => { if (f.detourCut) return; for (let i = 0; i < 6; i++) { const s = Sprites.get('an:' + (i % 5), () => V3.aningaSprite(700 + i % 5)); ctx.drawImage(s, Math.round(dg.x - 22 + i * 7 + Math.sin(gg.time + i) * 0.5), Math.round(dg.y - 18 + (i % 2) * 5)); } } });
    g.interactables.push({ x: dg.x, y: dg.y + 4, r: 26, py: 22, label: () => (g.done.has('m2') ? 'Abrir caminho pelo aningal' : 'Aningal fechado'), enabled: () => !f.detourCut, action: () => this.cutDetour() });
    const bg = P(D.B_GATE);
    w.blockers.push({ x: bg.x - 6, y: bg.y - 26, w: 10, h: 52, active: () => !g.done.has('m2') });

    // ---------- Região C: jirau, canoa ----------
    const jr = this.jirau;
    g.entities.push({ x: jr.x, y: jr.y + 4, draw: (ctx) => { const s = Sprites.get('jirau:' + (f.paddle ? 0 : 1), () => V3.jirauSprite(!f.paddle)); ctx.drawImage(s, Math.round(jr.x - 20), Math.round(jr.y - 24)); } });
    g.interactables.push({ x: jr.x, y: jr.y + 2, r: 26, py: 26, label: 'Pegar o remo no jirau', enabled: () => !f.paddle, action: () => this.takePaddle() });
    const cs = P(D.CANOE.start), ce = P(D.CANOE.end);
    this.railA = cs; this.railB = ce; this.railLen = dist(cs.x, cs.y, ce.x, ce.y);
    const ang = Math.atan2(ce.y - cs.y, ce.x - cs.x);
    // ponto em que a proa e o meio já estão na água: dali ela desliza sozinha
    // empurra até onde Caetano ainda pisa em terra atrás da popa; dali ela desliza sozinha
    this.sLaunch = this.railLen;
    for (let s0 = 0; s0 <= this.railLen; s0 += 1) { const bx = cs.x + Math.cos(ang) * (s0 - 16), by = cs.y + Math.sin(ang) * (s0 - 16); if (w.isWater(bx, by) || w.hit(bx, by, 4)) { this.sLaunch = Math.max(8, s0 - 1); break; } }
    const st = f.canoe;
    this.canoe = new Canoe(g, this, st ? st.x : cs.x, st ? st.y : cs.y, st ? st.a : ang);
    if (f.launched) this.canoe.state = 'float';
    else { const s0 = f.canoeS || 0; this.canoe.x = cs.x + Math.cos(ang) * s0; this.canoe.y = cs.y + Math.sin(ang) * s0; }
    this.canoeCol = w.addCollider({ x: this.canoe.x, y: this.canoe.y - 1, r: 9, dyn: true, off: !!f.launched, noBoat: true });
    g.entities.push(this.canoe); g.updaters.push({ update: (dt) => this.canoe.update(dt) });
    g.entities.push({ get x() { return self.canoe.x; }, get y() { return self.canoe.y + 3; }, draw: (ctx) => this.drawCanoeBinds(ctx) });
    g.interactables.push({ get x() { return self.canoe.x; }, get y() { return self.canoe.y; }, r: 32, py: 18, label: 'Examinar a canoa abandonada', enabled: () => !f.m4_canoe && !f.launched, action: () => this.examineCanoe() });
    g.interactables.push({ get x() { return self.canoe.x; }, get y() { return self.canoe.y; }, r: 32, py: 18, label: 'Cortar os cipós que prendem a canoa', enabled: () => f.m4_canoe && !f.vines, action: () => this.cutVines() });
    g.interactables.push({ get x() { return self.canoe.x + 6; }, get y() { return self.canoe.y - 2; }, r: 30, py: 22, label: 'Tirar o galho de cima da canoa', enabled: () => f.m4_canoe && f.vines && !f.branch, action: () => this.removeBranch() });
    g.interactables.push({ get x() { return self.canoe.x; }, get y() { return self.canoe.y; }, r: 34, py: 18, label: 'Embarcar na canoa', enabled: () => this.canoe.state === 'float', action: () => this.embark() });
    g.interactables.push({ get x() { return self.landSpot ? self.landSpot.x : self.canoe.x; }, get y() { return self.landSpot ? self.landSpot.y : self.canoe.y; }, r: 60, py: 14, label: 'Desembarcar', enabled: () => this.boarded() && !!this.landSpot && this.canoe.speed < 24 && !(this.ev && this.ev.stage !== 'done'), action: () => this.disembark() });
    g.interactables.push({ get x() { return self.canoe.x; }, get y() { return self.canoe.y; }, r: 40, py: 20, label: 'Desencalhar a canoa', enabled: () => this.boarded() && this.canoe.stuckT > 2.2, action: () => this.recoverCanoe() });
    this.drift = new DriftLogs(g, this, this.main, this.main.project(...Object.values(P(D.LOGS_ZONE.a))).s, this.main.project(...Object.values(P(D.LOGS_ZONE.b))).s + 30, 5);

    // ---------- Região E ----------
    const mt = P(D.MARK_TREE);
    g.interactables.push({ x: mt.x, y: mt.y, r: 48, py: 40, label: 'Examinar a árvore meio submersa', enabled: () => f.m7_escape && !f.m7_mark, action: () => this.examineMark() });
    const pe = P(D.PRINTS_E);
    g.interactables.push({ x: pe.x, y: pe.y, r: 24, py: 12, label: 'Examinar as pegadas no barro', enabled: () => f.m8_land && !f.m8_prints, action: () => this.examinePrintsE() });
    const he = P(D.HAIR_E);
    g.entities.push({ x: he.x, y: he.y, draw: (ctx) => { const s = Sprites.get('bu:1', () => N.bushSprite(201, 8, N.GREENS.light)); ctx.drawImage(s, Math.round(he.x - s.width / 2), Math.round(he.y - s.height + 2)); if (!f.m8_hair) { ctx.fillStyle = '#c8502a'; for (const [dx, dy] of [[-3, -8], [-2, -9], [2, -6], [3, -7], [0, -10]]) ctx.fillRect(Math.round(he.x + dx), Math.round(he.y + dy), 1, 2); } } });
    g.interactables.push({ x: he.x, y: he.y, r: 22, py: 22, label: 'Examinar os pelos presos no arbusto', enabled: () => f.m8_prints && !f.m8_hair, action: () => this.examineHairE() });
    const ds = P(D.DIR_SIGN);
    g.entities.push({ x: ds.x, y: ds.y, draw: (ctx) => { const s = Sprites.get('twig:9', () => N.twigSprite(9)); ctx.drawImage(s, Math.round(ds.x - 6), Math.round(ds.y - 4)); ctx.drawImage(s, Math.round(ds.x - 1), Math.round(ds.y - 1)); } });
    g.interactables.push({ x: ds.x, y: ds.y, r: 22, py: 14, label: 'Examinar os galhos quebrados', enabled: () => f.m8_hair && !f.m8_dir, action: () => this.examineDirection() });

    this.setupTriggers();
    // restauração: canoa e embarque
    if (f.canoe && f.canoe.state === 'boarded') this.board(true);
    else if (f.launched) this.canoe.unstick();
  }

  setupTriggers() {
    const g = this.g, f = g.flags;
    g.triggers.push({ x: px(17.4), y: px(65.6), r: 34, cond: () => !f.m1_trail, fn: () => { f.m1_trail = true; g.caption('Água rasa correndo por cima da trilha', 0); g.ui.toast('Igarapé raso: dá para atravessar a pé, mas a água segura o passo e espirra.', 'tip', 4500); this.checkM1(); } });
    g.triggers.push({ x: px(50), y: px(49), r: 44, cond: () => f.m2_prints && !f.m2_follow, fn: () => { f.m2_follow = true; g.caption('Um assobio fino, mais adiante na trilha', 0.6); g.audio.play('tapir', { pan: 0.6, vol: 0.6 }); g.ui.toast('A trilha da anta segue para o nordeste. Do monte de raízes à direita dá para ver a passagem.', 'tip', 5000); } });
    g.triggers.push({ x: px(D.B_GATE[0]) - 40, y: px(D.B_GATE[1]), r: 36, once: false, cond: () => !g.done.has('m2'), fn: () => { if (g.time < this.gateMsgT) return; this.gateMsgT = g.time + 7; g.ui.toast('Caetano: <i>"Antes de seguir pro lago, quero entender por onde anda essa anta."</i>', 'tip', 4000); } });
    g.triggers.push({ x: px(D.B_GATE[0]), y: px(D.B_GATE[1]), r: 30, cond: () => g.done.has('m2') && !g.done.has('m3'), fn: () => this.crossedB() });
    g.triggers.push({ x: px(D.SHORE_PT[0]), y: px(D.SHORE_PT[1]), r: 34, cond: () => !f.m4_shore && g.done.has('m3'), fn: () => { f.m4_shore = true; g.caption('Água parada, sapos, garças na beira', 0.4); g.audio.setMood('calm'); this.checkM4(); } });
    // navegação
    g.triggers.push({ x: px(D.LOGS_ZONE.a[0]), y: px(D.LOGS_ZONE.a[1]), r: 46, once: false, cond: () => this.boarded() && !g.done.has('s_rem'), fn: () => { if (!this.rowAttempt || this.rowFail) { if (this.rowFail) g.ui.toast('Nova tentativa de <b>Remador Experiente</b>: atravesse os troncos sem bater.', 'tip', 3000); this.rowAttempt = true; this.rowFail = false; } } });
    g.triggers.push({ x: px(D.LOGS_ZONE.b[0]), y: px(23), w: px(1.2), h: px(9), once: false, cond: () => this.boarded() && (!f.m6_logs || (this.rowAttempt && !g.done.has('s_rem'))), fn: () => this.passLogs() });
    g.triggers.push({ x: px(D.CURRENT_ZONE.b[0]), y: px(D.CURRENT_ZONE.b[1]), r: 38, cond: () => this.boarded() && !f.m6_current, fn: () => { f.m6_current = true; f.m6_logs = true; g.ui.toast('Passou a correnteza. A água acalma de novo.', 'tip', 3500); g.checkpoint('Depois da correnteza'); this.syncCanoe(); } });
    g.triggers.push({ x: px(D.CURRENT_ZONE.a[0]), y: px(D.CURRENT_ZONE.a[1]), r: 36, cond: () => this.boarded() && !f.curTip, fn: () => { f.curTip = true; g.caption('A água ronca entre as pedras', 0.5); g.ui.toast('<b>Correnteza</b> · Ela empurra a canoa para trás e para fora das curvas. Reme firme pela parte de dentro e desvie das pedras. A seta no painel da canoa mostra para onde a água corre.', 'tip', 7500); } });
    g.triggers.push({ x: px(D.PASSAGE[0]), y: px(D.PASSAGE[1]), r: 26, cond: () => this.boarded() && !g.done.has('m6'), fn: () => this.reachPassage() });
    g.triggers.push({ x: px(D.SILENCE[0]), y: px(D.SILENCE[1]), r: 36, cond: () => this.boarded() && g.done.has('m6') && !f.m7_escape && !this.ev, fn: () => this.startSilence() });
    g.triggers.push({ x: px(D.TAPIRI[0]), y: px(D.TAPIRI[1]), r: 30, once: false, cond: () => !this.finished && !this.boarded(), fn: () => this.reachTapiri() });
    g.triggers.push({ x: px(D.BEACH_D[0]), y: px(D.BEACH_D[1]), r: 40, cond: () => !f.beachTip && this.boarded(), fn: () => { f.beachTip = true; g.ui.toast('Uma prainha na margem: dá para desembarcar (E) e descansar as pernas.', 'tip', 4000); } });
  }

  // ================= roteiro =================
  async intro() {
    const g = this.g;
    await g.ui.intro([
      '<span class="place">Beira da várzea · início da tarde</span>Caetano deixou o segundo acampamento quando o sol já passava do meio do céu. As pegadas do veado-vermelho seguiam para a água.',
      'A floresta muda devagar. O chão fica mole, pequenos igarapés cortam a trilha e as árvores crescem com os pés dentro d\'água.',
      'Por aqui andam antas, capivaras e pacas. E o rastro do veado parece continuar do outro lado de um igarapé.',
    ]);
    g.player.dir = 'right';
    g.letterbox = 1; g.fade = 1;
    g.audio.setMood('calm');
    await g.run(async () => {
      g.camera.targetZoom = 1.2;
      await g.tween(g, 'fade', 0, 2);
      g.ui.titleCard('FASE 3', 'Os Segredos da Várzea', 'Tarde · várzea do igarapé');
      await g.wait(3.4);
      await g.say('Caetano', 'O chão aqui é só barro. Cada passo afunda a bota.', 'caetano');
      g.audio.play('frogs', { vol: 0.8 });
      await g.wait(0.6);
      await g.say('Caetano', 'Daqui pra frente é várzea. Bicho de água, bicho de beira... e o veado passou bem no meio disso tudo.', 'caetano');
      g.camera.targetZoom = 1;
      await g.tween(g, 'letterbox', 0, 0.8);
    });
    g.state = 'play';
    g.stats.startedAt = g.timeLeft;
    g.ui.toast('<b>Dica</b> · Barro e água rasa deixam Caetano mais lento e fazem barulho. A bota sai cheia de lama: o passo demora a voltar ao normal.', 'tip', 6500);
    g.checkpoint('Início da Fase 3');
  }

  addScore(n, label) { const f = this.g.flags; f.score = (f.score || 0) + n; if (label) this.g.ui.toast(`<b>+${n}</b> exploração · ${label}`, 'discovery', 2600); }
  addJournal(title, text) { const f = this.g.flags; f.journal = f.journal || []; if (!f.journal.some((j) => j.title === title)) f.journal.push({ title, text }); }
  journal() { return this.g.flags.journal || []; }
  panelRow() { return ['Exploração', `${this.g.flags.score || 0} pts`]; }
  later(sec, fn) { this.timers.push({ t: this.g.time + sec, fn }); }
  async look(text, zoom = 1.35) {
    const g = this.g;
    await g.run(async () => { g.player.forceCrouch = true; g.camera.targetZoom = zoom; await g.say('Caetano', text, 'caetano'); g.camera.targetZoom = 1; g.player.forceCrouch = false; });
  }

  // ---------- Missão 1 ----------
  async examineMud() {
    const g = this.g, f = g.flags;
    await g.run(async () => {
      g.player.forceCrouch = true; g.camera.targetZoom = 1.35;
      await g.say('Caetano', 'Barro mole, de várzea. Afunda até o tornozelo e gruda na bota.', 'caetano');
      await g.say('Caetano', 'Aqui não dá pra correr: cada passo faz "chop" e o bicho escuta de longe.', 'caetano');
      g.camera.targetZoom = 1; g.player.forceCrouch = false;
    });
    f.m1_mud = true;
    this.addScore(5, 'lama da várzea');
    this.addJournal('A várzea', 'O chão da várzea é barro mole. Segura o passo e faz barulho. A bota sai pesada de lama.');
    this.checkM1();
  }
  async examineSign(s) {
    const g = this.g, f = g.flags;
    await this.look(s.text);
    f['sign_' + s.id] = true; f.m1_marks = true;
    if (s.id === 'capivara') g.tracksKnown.add('t_capivara');
    this.addScore(10, s.name);
    this.addJournal('Sinal: ' + s.name, s.text);
    this.checkM1();
  }
  checkM1() {
    const g = this.g, f = g.flags;
    if (f.m1_trail && f.m1_mud && f.m1_marks && !g.done.has('m1')) {
      g.complete('m1');
      g.checkpoint('Trilha encharcada');
      g.ui.toast('Siga a trilha para o leste. No fim dela, procure sinais de bicho grande.', 'tip', 5000);
    }
  }

  // ---------- Missão 2 e 3: a anta ----------
  async examineTapirPrints() {
    const g = this.g, f = g.flags;
    await g.run(async () => {
      g.player.forceCrouch = true; g.camera.targetZoom = 1.4;
      await g.say('Caetano', 'Três dedos largos, redondos, afundados no barro. Pegada de anta, e das grandes.', 'caetano');
      await g.say('Caetano', 'A água ainda está entrando na marca: passou faz pouco. Foi pela trilha estreita, pro nordeste.', 'caetano');
      g.camera.targetZoom = 1; g.player.forceCrouch = false;
    });
    f.m2_prints = true; g.tracksKnown.add('t_anta');
    this.addScore(10, 'pegada de anta');
    this.addJournal('Pegada de anta', 'Três dedos largos e redondos, fundos no barro, ainda enchendo de água. A anta seguiu pela trilha estreita para o nordeste.');
  }
  async observeTapir() {
    const g = this.g, f = g.flags, tp = this.tapir, p = g.player;
    const d = dist(tp.x, tp.y, p.x, p.y);
    if (d < 56) { g.ui.toast('Muito perto: a anta vai se assustar. Afaste-se e observe de longe.', 'warn', 3000); return; }
    if (tp.aware > 0.5) { g.ui.toast('A anta está desconfiada, de tromba erguida. Fique quieto e espere ela se acalmar.', 'tip', 3000); return; }
    await g.run(async () => {
      g.camera.follow = null; g.camera.targetZoom = 1.35;
      await g.camera.panTo((tp.x + p.x) / 2, (tp.y + p.y) / 2 - 6, 1.1);
      await g.say('Caetano', 'Lá está ela. Bicho enorme, comendo broto bem no meio da trilha.', 'caetano');
      await g.say('Caetano', 'Mexe a tromba pra todo lado: é com o nariz que ela enxerga. Se eu passar por ali agora, ela me sente.', 'caetano');
      await g.say('Caetano', 'Ou eu espero ela sair do caminho... ou dou a volta por outro lugar.', 'caetano');
      await g.camera.panTo(p.x, p.y - 8, 0.9);
      g.camera.follow = p; g.camera.targetZoom = 1;
    });
    f.m2_obs = true; f.m2_follow = true;
    if (!f.obs_anta) { f.obs_anta = true; this.addScore(20, 'anta observada'); this.checkNat(); }
    this.addJournal('A anta da garganta', 'Uma anta comendo bem no meio da passagem estreita. O corpo dela fecha o caminho. Ela segue para as palmeiras e volta de tempos em tempos.');
    g.complete('m2');
    this.tapirRelease = g.time + 22 + Math.random() * 18;
    g.checkpoint('Trilha da anta');
    g.ui.toast('Espere a anta sair da passagem, ou abra caminho pelo <b>aningal</b> ao sul da trilha e atravesse o atoleiro.', 'tip', 7000);
  }
  holdTapir() { const g = this.g; return !g.done.has('m2') || (this.tapirRelease !== null && g.time < this.tapirRelease); }
  async cutDetour() {
    const g = this.g, f = g.flags;
    if (!g.done.has('m2')) { g.ui.toast('Aningal fechado, alto e cheio de espinho. Sem motivo pra abrir picada aqui... por enquanto.', 'tip', 3500); return; }
    await g.run(async () => {
      for (let i = 0; i < 4; i++) { g.audio.play('cut'); await g.wait(0.32); }
      const dg = P(D.DETOUR_GATE);
      for (let i = 0; i < 18; i++) g.particles.add({ type: 'leaf', x: dg.x + (Math.random() - 0.5) * 34, y: dg.y, z: 8 + Math.random() * 10, vx: (Math.random() - 0.5) * 30, vy: 2, life: 2, seed: Math.random() * 9, color: i % 2 ? '#2d5220' : '#5a8a3a' });
      f.detourCut = true; this.detourCol.off = true;
      await g.say('Caetano', 'Picada aberta. Do outro lado é atoleiro: vai ser devagar e barulhento, mas a anta fica longe.', 'caetano');
    });
    g.player.makeNoise(0.9);
  }
  crossedB() {
    const g = this.g, f = g.flags;
    g.complete('m3');
    f.tapirFree = true; this.tapirRelease = 0;
    this.addJournal('A passagem da anta', f.detourCut ? 'Dei a volta pelo aningal e pelo atoleiro. A anta ficou na trilha dela.' : 'Passei pela garganta estreita da trilha da anta.');
    g.checkpoint('Além da passagem da anta');
    g.ui.toast('Siga para o leste até o lago.', 'tip', 4000);
  }

  // ---------- Missão 4 e 5: lago e canoa ----------
  capyCenter() { const m = this.capys.members; let x = 0, y = 0; for (const c of m) { x += c.x; y += c.y; } return { x: x / m.length, y: y / m.length }; }
  async observeCapys() {
    const g = this.g, f = g.flags, c = this.capyCenter(), p = g.player;
    if (dist(c.x, c.y, p.x, p.y) < 64) { g.ui.toast('Perto demais: as capivaras vão correr para a água.', 'warn', 3000); return; }
    await g.run(async () => {
      g.camera.follow = null; g.camera.targetZoom = 1.3;
      await g.camera.panTo((c.x + p.x) / 2, (c.y + p.y) / 2 - 6, 1);
      await g.say('Caetano', 'Capivara deitada na prainha, filhote no meio, e duas nadando com só o focinho de fora.', 'caetano');
      await g.say('Caetano', 'Uma fica de olho enquanto as outras cochilam. Se ela latir, vai todo mundo pra água.', 'caetano');
      await g.camera.panTo(p.x, p.y - 8, 0.8);
      g.camera.follow = p; g.camera.targetZoom = 1;
    });
    f.obs_capi = true;
    this.addScore(20, 'capivaras observadas');
    this.addJournal('As capivaras do lago', 'Um grupo de sete capivaras vive na prainha ao sul do lago. Descansam, pastam o capim da beira e entram na água para nadar. Quando uma se assusta, late, e o grupo todo mergulha.');
    this.checkNat();
  }
  async observePaca(pc) {
    const g = this.g, f = g.flags, p = g.player;
    if (dist(pc.x, pc.y, p.x, p.y) < 30) { g.ui.toast('Perto demais: a paca vai sumir na toca.', 'warn', 2500); return; }
    await g.run(async () => {
      g.camera.targetZoom = 1.4;
      await g.say('Caetano', 'Uma paca, saindo da toca entre as raízes. Pelo pintado de branco, orelha atenta pra tudo.', 'caetano');
      await g.say('Caetano', 'Só sai quando escurece. Qualquer barulho e ela some de novo, ou pula na água.', 'caetano');
      g.camera.targetZoom = 1;
    });
    f.obs_paca = true;
    this.addScore(25, 'paca observada');
    this.addJournal('A paca da toca', 'Pacas vivem em tocas entre raízes, perto da água. Saem à tardinha e à noite, muito atentas: no menor ruído, fogem para a toca ou mergulham.');
    this.checkNat();
  }
  checkNat() {
    const g = this.g;
    if (this.count.natDone() >= 3 && !g.done.has('s_nat')) {
      g.complete('s_nat'); this.addScore(60, 'Naturalista da Várzea');
      this.addJournal('Conquista: Naturalista da Várzea', 'Anta, capivaras e paca observadas sem que nenhuma se assustasse.');
    }
  }
  checkM4() {
    const g = this.g, f = g.flags;
    if (f.m4_group && f.m4_shore && f.m4_canoe && !g.done.has('m4')) {
      g.complete('m4');
      g.checkpoint('Lago das capivaras');
    }
  }
  async examineCanoe() {
    const g = this.g, f = g.flags;
    await g.run(async () => {
      g.player.forceCrouch = true; g.camera.targetZoom = 1.4;
      await g.say('Caetano', 'Uma canoa de itaúba, meio enterrada no barro. Alguém largou ela aqui faz tempo.', 'caetano');
      await g.say('Caetano', 'O casco está inteiro. Mas tem cipó e raiz de aninga amarrando tudo, e um galho pesado em cima.', 'caetano');
      if (!f.paddle) await g.say('Caetano', 'E canoa sem remo não vai a lugar nenhum. Vi um jirau de pesca velho na trilha, pro norte.', 'caetano');
      g.camera.targetZoom = 1; g.player.forceCrouch = false;
    });
    f.m4_canoe = true; f.m4_shore = true;
    this.addJournal('A canoa abandonada', 'Uma canoa de itaúba presa na lama da margem oeste do lago, amarrada por cipós e coberta por um galho.');
    this.checkM4();
  }
  async takePaddle() {
    const g = this.g, f = g.flags;
    await g.run(async () => {
      await g.say('Caetano', 'Um remo de pau, esquecido no jirau. A pá está gasta, mas serve.', 'caetano');
    });
    f.paddle = true; g.give('remo');
  }
  async cutVines() {
    const g = this.g, f = g.flags;
    if (!g.inv.has('facao')) { g.ui.toast('Sem o facão não dá pra cortar esses cipós.', 'tip'); return; }
    await g.run(async () => {
      for (let i = 0; i < 4; i++) { g.audio.play('cut'); await g.wait(0.3); }
      for (let i = 0; i < 14; i++) g.particles.add({ type: 'leaf', x: this.canoe.x + (Math.random() - 0.5) * 30, y: this.canoe.y, z: 4 + Math.random() * 6, vx: (Math.random() - 0.5) * 30, vy: 2, life: 2, seed: Math.random() * 9, color: i % 2 ? '#4e4224' : '#4f7a32' });
      f.vines = true;
      await g.say('Caetano', 'Pronto, os cipós soltaram.', 'caetano');
    });
  }
  async removeBranch() {
    const g = this.g, f = g.flags;
    await g.run(async () => {
      g.audio.play('creak', { vol: 1 });
      await g.say('Caetano', 'Galho pesado... Vai, no ombro...', 'caetano');
      this.branchRoll = 0;
      await g.tween(this, 'branchRoll', 1, 0.9);
      g.audio.play('thud', { vol: 0.8 }); g.camera.shake(1.5, 0.3);
      for (let i = 0; i < 10; i++) g.particles.add({ type: 'puff', x: this.canoe.x - 22 + Math.random() * 10, y: this.canoe.y + 2, vx: (Math.random() - 0.5) * 20, vy: -4, life: 0.8, color: '#7a6a4a' });
      f.branch = true;
      await g.say('Caetano', 'Agora é empurrar ela pra água. De trás pra frente, devagar.', 'caetano');
    });
    g.ui.toast('Fique atrás da canoa (do lado da mata) e ande na direção do lago para empurrar.', 'tip', 5000);
  }
  pushTarget() { const c = this.canoe, a = Math.atan2(this.railB.y - this.railA.y, this.railB.x - this.railA.x); return { x: c.x - Math.cos(a) * 20, y: c.y - Math.sin(a) * 20 }; }
  updatePush(dt) {
    const g = this.g, f = g.flags, p = g.player, c = this.canoe;
    if (f.launched || g.state !== 'play') return;
    const a = Math.atan2(this.railB.y - this.railA.y, this.railB.x - this.railA.x), ux = Math.cos(a), uy = Math.sin(a);
    const back = { x: c.x - ux * 15, y: c.y - uy * 15 };
    if (dist(p.x, p.y, back.x, back.y) > 13) { this.pushT = 0; return; }
    const sp = Math.hypot(p.vx, p.vy);
    if (sp < 18) return;
    if ((p.vx * ux + p.vy * uy) / sp < 0.55) return;
    if (!f.vines || !f.branch) { if (g.time > (this.pushMsgT || 0)) { this.pushMsgT = g.time + 4; g.ui.toast(!f.vines ? 'A canoa não mexe: cipós e raízes ainda prendem o casco.' : 'Com aquele galho em cima, não tem força que mova a canoa.', 'tip', 3000); } return; }
    const s0 = f.canoeS || 0, ns = Math.min(this.sLaunch, s0 + Math.min(sp, 54) * 0.5 * dt);
    f.canoeS = ns;
    c.x = this.railA.x + ux * ns; c.y = this.railA.y + uy * ns; c.sortY = c.y;
    this.canoeCol.x = c.x; this.canoeCol.y = c.y - 1; this.reindex(this.canoeCol);
    this.pushT = (this.pushT || 0) + dt;
    if (this.pushT > 0.5) { this.pushT = 0; g.audio.play('canoeScrape', { vol: 0.5 }); g.particles.add({ type: 'puff', x: c.x - ux * 10, y: c.y + 3, vx: 0, vy: -3, life: 0.6, color: '#6a5a3a' }); p.makeNoise(0.4); }
    if (ns >= this.sLaunch - 0.5) {
      f.launched = true; c.state = 'float'; this.canoeCol.off = true;
      // desliza o resto do caminho até boiar de vez
      g.tween(c, 'x', this.railB.x, 0.9); g.tween(c, 'y', this.railB.y, 0.9).then(() => c.unstick());
      g.audio.play('splash', { vol: 1 });
      for (let i = 0; i < 12; i++) g.particles.add({ type: 'splash', x: c.x + (Math.random() - 0.5) * 24, y: c.y, vx: (Math.random() - 0.5) * 30, vy: -16 - Math.random() * 12, g: 60, life: 0.6 });
      g.particles.add({ type: 'ripple', x: c.x, y: c.y, life: 1.6, r1: 22 });
      g.ui.toast('A canoa desliza e boia! Embarque com <kbd>E</kbd>.', 'tip', 5000);
    }
  }
  drawCanoeBinds(ctx) {
    const f = this.g.flags, c = this.canoe;
    if (f.launched) return;
    if (!f.vines) {
      ctx.strokeStyle = '#4e4224'; ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(c.x - 14 + i * 9, c.y - 5); ctx.quadraticCurveTo(c.x - 10 + i * 9, c.y + 2, c.x - 18 + i * 10, c.y + 8); ctx.stroke(); }
      const s = Sprites.get('an:2', () => V3.aningaSprite(702)); ctx.drawImage(s, Math.round(c.x - 22), Math.round(c.y - 20));
    }
    if (!f.branch) {
      const s = Sprites.get('branch', () => V3.branchSprite()), k = this.branchRoll || 0;
      ctx.save(); ctx.translate(Math.round(c.x - 2 - k * 24), Math.round(c.y - 4 + k * 6)); ctx.rotate(-0.25 + k * 0.6); ctx.drawImage(s, -20, -7); ctx.restore();
    }
  }

  // ---------- embarque / desembarque ----------
  boarded() { return this.canoe && this.canoe.state === 'boarded'; }
  canoeSpeed() { return this.boarded() ? this.canoe.speed : 0; }
  async embark() {
    const g = this.g, f = g.flags;
    if (!f.paddle) { g.ui.toast('Sem remo não dá: a canoa vai rodar à toa no lago. Procure um remo.', 'tip', 3500); return; }
    this.board(false);
    if (!g.done.has('m4')) { f.m4_group = f.m4_shore = f.m4_canoe = true; this.checkM4(); }
    if (!g.done.has('m5')) {
      g.complete('m5');
      this.addJournal('A canoa', 'Remo do jirau, cipós cortados, galho tirado e um empurrão: a canoa velha boiou de novo.');
      this.syncCanoe(); g.checkpoint('Canoa na água');
      g.ui.toast('<b>Canoa</b> · <kbd>W</kbd> rema para a frente · <kbd>S</kbd> freia / ré · <kbd>A</kbd> <kbd>D</kbd> viram · <kbd>E</kbd> desembarca perto de uma margem.', 'tip', 9000);
      if (g.touch || g.input.lastDevice === 'touch') g.ui.toast('No toque: aponte o joystick para onde quer ir; quanto mais longe do centro, mais forte a remada.', 'tip', 8000);
      setTimeout(() => this.boarded() && g.ui.toast('O igarapé sai do lago a nordeste. Aprenda a controlar a canoa no lago antes de seguir.', 'tip', 6000), 6000);
    }
  }
  board(restoring) {
    const g = this.g, p = g.player, c = this.canoe;
    c.state = 'boarded'; this.canoeCol.off = true;
    g.entities = g.entities.filter((e) => e !== p);
    p.locked = true; p.x = c.x; p.y = c.y; p.vx = p.vy = 0; p.sneak = false; p.lantern = p.lantern && restoring;
    if (!c.free()) c.unstick();
    g.audio.play('splash', { vol: 0.4 });
    if (!restoring) g.audio.play('canoeHit', { vol: 0.4 });
  }
  findLandSpot() {
    const g = this.g, c = this.canoe, w = this.world, h = c.dir();
    let best = null, bd = 1e9;
    for (const sd of [-1, 1]) for (const al of [-10, 0, 10, 18]) for (let d = 10; d <= 34; d += 4) {
      const x = c.x + h.x * al - h.y * sd * d, y = c.y + h.y * al + h.x * sd * d;
      if (w.isWater(x, y) || w.hit(x, y, 4.5) || circleBlocked(w, x, y, 4.5)) continue;
      const dd = d + Math.abs(al) * 0.5;
      if (dd < bd) { bd = dd; best = { x, y }; }
      break;
    }
    void g;
    return best;
  }
  disembark(spot = this.landSpot) {
    const g = this.g, p = g.player, c = this.canoe, f = g.flags;
    if (!spot) return;
    c.state = 'float'; c.vx = c.vy = 0; c.f = c.l = 0;
    p.locked = false; p.x = spot.x; p.y = spot.y; p.vx = p.vy = 0;
    if (!g.entities.includes(p)) g.entities.push(p);
    g.audio.play('splash', { vol: 0.5 }); g.audio.play('step', { surface: 'mud', vol: 1 });
    g.camera.follow = p;
    if (dist(c.x, c.y, px(D.SAFE_BANK[0]), px(D.SAFE_BANK[1])) < 110 && f.m7_escape && !f.m8_land) { f.m8_land = true; g.ui.toast('Em terra firme de novo. Procure o rastro do veado.', 'tip', 4000); }
  }
  recoverCanoe() {
    const g = this.g, c = this.canoe;
    let best = null, bd = 1e9;
    for (const q of this.nav) {
      const d = dist(q.x, q.y, c.x, c.y);
      if (d < bd && c.free(q.x, q.y, q.a)) { bd = d; best = q; }
    }
    if (!best) return;
    g.run(async () => {
      g.audio.play('paddle', { vol: 1 }); g.audio.play('canoeScrape', { vol: 0.8 });
      await g.tween(g, 'fade', 0.6, 0.25);
      c.x = best.x; c.y = best.y; c.a = best.a; c.vx = c.vy = 0; c.f = c.l = 0; c.stuckT = 0;
      g.player.x = c.x; g.player.y = c.y;
      await g.tween(g, 'fade', 0, 0.3);
      g.caption('Caetano empurra com o remo e solta a canoa', 0);
    });
  }
  syncCanoe() { const c = this.canoe; if (c) this.g.flags.canoe = { x: c.x, y: c.y, a: c.a, state: c.state }; }
  cp(label) { this.syncCanoe(); this.g.checkpoint(label); }
  currentAt(x, y) { return this.current.at(x, y); }
  inFloatGrass(x, y) { return this.floatGrass.some((q) => dist(q.x, q.y, x, y) < q.r); }
  logHit(x, y, r) { const L = this.drift && this.drift.hit(x, y, r); if (L) this.drift.nudge(L, x, y); return L; }
  onCanoeHit(what, k) {
    const g = this.g;
    if (this.rowAttempt && !this.rowFail && !g.done.has('s_rem')) { this.rowFail = true; g.ui.toast('A canoa bateu: <b>Remador Experiente</b> falhou nesta tentativa.', 'warn', 3500); }
    if (this.ev && this.ev.stage === 'strike') { this.instab = Math.min(100, this.instab + (what === 'bank' ? 3 : 8) + k * 8); if (k > 0.4) g.caption('A canoa bate e quase vira!', 0); }
    if (!g.flags.hitTip) { g.flags.hitTip = true; g.ui.toast('A canoa pesada não para de uma vez: freie com <kbd>S</kbd> antes das curvas e dos obstáculos.', 'tip', 5000); }
  }

  // ---------- Missão 6: igarapé ----------
  passLogs() {
    const g = this.g, f = g.flags;
    if (this.rowAttempt && !this.rowFail && !g.done.has('s_rem')) {
      g.complete('s_rem'); this.addScore(60, 'Remador Experiente');
      this.addJournal('Conquista: Remador Experiente', 'Atravessei o trecho dos troncos sem encostar em nada.');
    }
    this.rowAttempt = false;
    if (!f.m6_logs) {
      f.m6_logs = true; f.m6_learn = true;
      g.ui.toast('Os troncos ficaram para trás.', 'tip', 3000);
      this.cp('Trecho dos troncos');
    }
  }
  reachPassage() {
    const g = this.g, f = g.flags;
    f.m6_learn = f.m6_logs = f.m6_current = true;
    g.complete('m6');
    this.addJournal('O igarapé dos reflexos', 'Remei contra a correnteza, desviei de troncos e pedras e passei entre duas sumaúmas enormes, com as raízes dentro d\'água.');
    this.cp('Passagem entre as árvores');
    g.ui.toast('Depois das árvores, o igarapé desce para uma lagoa de água escura.', 'tip', 4500);
  }

  // ---------- Missão 7: a sombra nas águas ----------
  silence() { return !!(this.ev && this.ev.stage !== 'done'); }
  async startSilence() {
    const g = this.g, c = this.canoe;
    this.cp('Antes da margem do silêncio');
    this.ev = { stage: 'silence', t: 0 };
    this.instab = 0;
    g.audio.setMood('mystery'); g.audio.setDuck(0.35, 3);
    g.caption('A mata inteira se cala', 0);
    for (const h of this.herons) if (h.state === 'perch') h.fly();
    // ondas grandes subindo o rio, contra a correnteza
    const s0 = this.main.project(c.x, c.y).s;
    this.waves = [];
    for (let i = 0; i < 4; i++) this.waves.push({ s: s0 - 70 - i * 22, w: 1 - i * 0.15, t: 0 });
    this.thunderAt = g.time + 3;
    await g.wait(1.6);
    await g.run(async () => {
      g.letterbox = 0.6;
      const q = this.main.at(s0 - 60);
      g.camera.follow = null;
      await g.camera.panTo(lerp(c.x, q.x, 0.6), lerp(c.y, q.y, 0.6), 1.2);
      await g.say('Caetano', 'Os sapos pararam. Os passarinhos também...', 'caetano');
      await g.camera.panTo(c.x, c.y - 8, 0.9);
      g.camera.follow = g.player;
      await g.tween(g, 'letterbox', 0, 0.4);
    });
  }
  updateEvent(dt) {
    const g = this.g, f = g.flags, ev = this.ev, c = this.canoe, p = g.player;
    if (!ev || ev.stage === 'done') return;
    ev.t += dt;
    // ondas: sobem o canal (no sentido da viagem), passando pela canoa
    for (const wv of this.waves) { wv.s += 86 * dt; wv.t += dt; }
    this.waves = this.waves.filter((wv) => wv.s < this.main.len + 60);
    if (ev.stage === 'silence') {
      const cs = this.main.project(c.x, c.y).s;
      for (const wv of this.waves) if (!wv.hit && Math.abs(wv.s - cs) < 14) {
        // a onda passa por baixo e empurra a canoa de volta
        wv.hit = true; const q = this.main.at(cs); c.vx -= q.tx * 22 * wv.w; c.vy -= q.ty * 22 * wv.w; c.rockV += 4 * wv.w; g.camera.shake(0.8, 0.2);
      }
      if (!f.m7_waves && this.waves.some((wv) => Math.abs(wv.s - cs) < 18)) {
        f.m7_waves = true;
        c.rockV += 5; g.audio.play('waves', { vol: 1 });
        g.ui.toast('Ondas grandes subindo o igarapé... <b>contra a correnteza</b>.', 'warn', 5000);
        this.later(1.2, () => g.state === 'play' && g.ui.toast('Caetano: <i>"Água não corre pra cima sozinha. Tem coisa grande aí embaixo."</i>', 'tip', 5000));
      }
      if (f.m7_waves && ev.t > 4.5 && (dist(c.x, c.y, px(D.TURB[0]), px(D.TURB[1])) < 120 || ev.t > 30)) {
        ev.stage = 'shadow'; ev.t = 0;
        // sombra comprida que atravessa por baixo da canoa
        const h = c.dir();
        this.bigShadow = { x: c.x - h.y * 160, y: c.y + h.x * 160, vx: h.y * 52, vy: -h.x * 52, t: 0, len: 150, a: 0 };
        g.audio.setMood('dread'); g.audio.play('deep', { vol: 0.9 });
        g.caption('Um ronco grave, vindo do fundo', 0);
        g.ui.alert('REDUZA A VELOCIDADE! A ÁGUA FERVE À FRENTE', 'alert', 6000);
        g.ui.toast('Segure <kbd>S</kbd> para frear. Atravesse a água revolta devagar.', 'warn', 6000);
        this.boils = [];
      }
    } else if (ev.stage === 'shadow') {
      const tz = P(D.TURB), dz = dist(c.x, c.y, tz.x, tz.y), inZ = dz < 40;
      c.turb = inZ ? 0.6 : 0.15;
      if (inZ) {
        const sp = c.speed;
        if (sp > 20) { this.instab = Math.min(75, this.instab + (sp - 20) * dt * 2.6); if (Math.random() < dt * 4) { c.rockV += (Math.random() - 0.5) * 6; g.camera.shake(1, 0.15); } if (!this.fastMsg) { this.fastMsg = true; g.caption('Rápido demais! A canoa joga de um lado pro outro', 0); } }
        ev.inZ = true;
      }
      if (inZ) ev.zt = (ev.zt || 0) + dt;
      const past = dist(c.x, c.y, px(D.SAFE_BANK[0]), px(D.SAFE_BANK[1])) < dist(tz.x, tz.y, px(D.SAFE_BANK[0]), px(D.SAFE_BANK[1]));
      if (ev.t > 3 && ((ev.inZ && !inZ) || ev.zt > 5 || (past && ev.t > 8) || ev.t > 26)) this.strike();
    }
    // ninguém chega à margem sem passar pelo susto
    if ((ev.stage === 'silence' || ev.stage === 'shadow') && dist(c.x, c.y, px(D.SAFE_BANK[0]), px(D.SAFE_BANK[1])) < 70) { f.m7_waves = true; this.strike(true); }
    if (ev.stage === 'strike') {
      c.turb = Math.min(1, 0.45 + ev.t * 0.025);
      this.instab = Math.min(100, this.instab + dt * (1.2 + ev.t * 0.05));
      if (Math.random() < dt * 0.8) { c.rockV += (Math.random() - 0.5) * 5; this.boil(c.x + (Math.random() - 0.5) * 80, c.y + (Math.random() - 0.5) * 50, 0.7); }
      if (ev.t > 2 && dist(c.x, c.y, px(D.SAFE_BANK[0]), px(D.SAFE_BANK[1])) < 40) this.escape();
      else if (this.instab >= 100) {
        ev.stage = 'done'; c.turb = 0; this.bigShadow = null;
        g.audio.play('bigsplash', { vol: 1 });
        g.fail('A canoa virou', 'A água revolta virou a canoa e Caetano mal conseguiu nadar até a beira. Volte ao ponto seguro e tente de novo: freie na água que ferve e não bata nos troncos.');
      }
    }
    // sombra grande: atravessa devagar
    const bs = this.bigShadow;
    if (bs) {
      bs.t += dt; bs.x += bs.vx * dt; bs.y += bs.vy * dt; bs.a = Math.min(1, bs.t / 1.5) * (bs.t > 8 ? Math.max(0, 1 - (bs.t - 8) / 2) : 1);
      if (Math.random() < dt * 8) g.particles.add({ type: 'ripple', x: bs.x + (Math.random() - 0.5) * 40, y: bs.y + (Math.random() - 0.5) * 20, life: 1.2, r1: 6, color: '#a8c0c4' });
      if (bs.t > 10) this.bigShadow = null;
    }
    for (const b of this.boils) b.t += dt;
    this.boils = this.boils.filter((b) => b.t < 2.5);
    if (ev.stage === 'shadow' && Math.random() < dt * 6) { const tz = P(D.TURB); this.boil(tz.x + (Math.random() - 0.5) * 70, tz.y + (Math.random() - 0.5) * 40, 1); }
    void p;
  }
  boil(x, y, k) {
    if (!this.world.isWater(x, y)) return;
    this.boils.push({ x, y, t: 0, k });
    if (Math.random() < 0.4) this.g.particles.add({ type: 'splash', x, y, vx: (Math.random() - 0.5) * 10, vy: -8, g: 50, life: 0.4, color: '#c8dce0' });
  }
  strike(pushBack = false) {
    const g = this.g, c = this.canoe, ev = this.ev;
    ev.stage = 'strike'; ev.t = 0;
    // o golpe na água empurra a canoa para longe da margem
    { const bx = px(D.SAFE_BANK[0]), by = px(D.SAFE_BANK[1]), d = dist(c.x, c.y, bx, by) || 1, k = pushBack ? 60 : 38; c.vx = (c.x - bx) / d * k; c.vy = (c.y - by) / d * k; }
    const h = c.dir();
    const sx = c.x + h.x * 26 - h.y * 22, sy = c.y + h.y * 26 + h.x * 18;
    g.audio.play('bigsplash', { vol: 1.2 }); g.audio.play('deep', { vol: 1 });
    g.camera.shake(4, 0.8); g.flash = 0.25;
    c.rockV += 12; this.instab = Math.max(this.instab, 18);
    for (let i = 0; i < 40; i++) g.particles.add({ type: 'splash', x: sx + (Math.random() - 0.5) * 14, y: sy, vx: (Math.random() - 0.5) * 70, vy: -40 - Math.random() * 60, g: 120, life: 1.1, color: i % 3 ? '#e0eef2' : '#a8c4c8' });
    for (let i = 0; i < 4; i++) g.particles.add({ type: 'ripple', x: sx, y: sy, life: 1.5 + i * 0.4, r1: 20 + i * 14, color: '#d0e2e6' });
    g.caption('Alguma coisa enorme bate na água, do lado da canoa!', -0.3);
    g.ui.alert('A CANOA BALANÇA! LEVE-A ATÉ A MARGEM SEGURA!', 'run', 8000);
    g.audio.setMood('chase');
    if (this.bigShadow) { this.bigShadow.vx *= -0.6; this.bigShadow.vy *= -0.6; }
  }
  async escape() {
    const g = this.g, f = g.flags, c = this.canoe, ev = this.ev;
    ev.stage = 'done'; c.turb = 0;
    f.m7_escape = true;
    g.ui.alert('A SALVO NA MARGEM!', 'safe', 3500);
    g.audio.setMood('mystery'); g.audio.setDuck(0.5, 2);
    const spot = this.findLandSpot() || P(D.SAFE_BANK);
    this.disembark(spot);
    f.m8_land = true;
    this.cp('Margem do silêncio');
    await g.run(async () => {
      await g.say('Caetano', 'Terra... Terra firme.', 'caetano');
      await g.say('Caetano', 'O que foi aquilo? A canoa quase virou... e não tinha vento nenhum.', 'caetano');
    });
    g.ui.toast('Examine a árvore meio submersa na beira da lagoa.', 'tip', 4500);
  }
  async examineMark() {
    const g = this.g, f = g.flags, p = g.player;
    const mt = P(D.MARK_TREE);
    await g.run(async () => {
      await g.tween(g, 'letterbox', 1, 0.5);
      p.dir = 'right';
      g.camera.follow = null; g.camera.targetZoom = 1.5;
      await g.camera.panTo(mt.x, mt.y - 24, 1.2);
      this.markA = 0; await g.tween(this, 'markA', 1, 1);
      await g.say('Caetano', 'A casca arrancada em volta do tronco, num risco largo, liso, dando a volta inteira...', 'caetano');
      await g.say('Caetano', 'Isso não foi peixe... Nem tronco de rio.', 'caetano');
      g.camera.targetZoom = 1.1;
      await g.camera.panTo(px(D.LAGOON.x), px(D.LAGOON.y), 2.4);
      this.bigShadow = { x: px(D.LAGOON.x) - 60, y: px(D.LAGOON.y) + 10, vx: 22, vy: -6, t: 0, len: 170, a: 0, fade: true };
      await g.wait(1.6);
      g.audio.play('deep', { vol: 0.8, far: true });
      g.caption('Um som grave ecoa ao longe, debaixo d\'água', 0.4);
      await g.wait(2.6);
      await g.camera.panTo(p.x, p.y - 8, 1.2);
      g.camera.follow = p; g.camera.targetZoom = 1;
      await g.tween(g, 'letterbox', 0, 0.5);
    });
    this.bigShadow = null;
    f.m7_mark = true;
    this.addJournal('A sombra nas águas', 'Na lagoa escura a mata se calou, ondas subiram o rio contra a correnteza, uma sombra comprida passou por baixo da canoa e algo enorme bateu na água. Numa árvore meio submersa, um risco largo e liso dando a volta no tronco. Não foi peixe. Nem tronco de rio.');
    this.addScore(20, 'a marca na árvore');
    g.complete('m7');
    f.rainOn = true; f.rainT = f.rainT || 0;
    g.audio.setMood('stealth'); g.audio.setDuck(1, 3);
    this.cp('A marca na árvore');
    g.ui.toast('Começa a chover. Procure o rastro do veado na margem antes que a tempestade engrosse.', 'tip', 5500);
  }

  // ---------- Missão 8 e 9 ----------
  async examinePrintsE() {
    const g = this.g, f = g.flags;
    await this.look('Pegada fina do veado, fresquinha. A chuva ainda nem apagou a borda.');
    f.m8_prints = true; this.addScore(10, 'pegadas do veado'); this.checkM8();
  }
  async examineHairE() {
    const g = this.g, f = g.flags;
    await this.look('Pelo vermelho preso no espinho, na altura do peito. É ele. Passou raspando, com pressa.');
    f.m8_hair = true; g.give('pelos', 1, true); this.addScore(10, 'pelos do veado'); this.checkM8();
  }
  async examineDirection() {
    const g = this.g, f = g.flags;
    let ok = false;
    await g.run(async () => {
      g.player.forceCrouch = true; g.camera.targetZoom = 1.35;
      await g.say('Caetano', 'Galhinho quebrado, folha virada com o lado claro pra cima, e as pegadas mais fundas na ponta do casco...', 'caetano');
      const i = await g.choice('Caetano', 'Para onde o veado seguiu?', D.DIRECTIONS, 'caetano');
      if (i === D.DIR_RIGHT) { ok = true; await g.say('Caetano', 'Pro oeste, subindo pra terra mais alta. Fugindo da água... e da chuva.', 'caetano'); }
      else await g.say('Caetano', 'Não... a ponta do casco afunda pro lado que ele vai. E os galhos quebram na direção do passo. Olha de novo.', 'caetano');
      g.camera.targetZoom = 1; g.player.forceCrouch = false;
    });
    if (ok) { f.m8_dir = true; this.addScore(15, 'direção do rastro'); this.checkM8(); }
  }
  checkM8() {
    const g = this.g, f = g.flags;
    if (f.m8_land && f.m8_prints && f.m8_hair && f.m8_dir && !g.done.has('m8')) {
      g.complete('m8');
      this.addJournal('O rastro na chuva', 'Pegadas frescas, pelos ruivos e galhos quebrados: o veado subiu para o oeste, para longe da água.');
      this.cp('Rastro do veado');
      g.ui.toast('Siga para o oeste. Tem um tapiri velho na mata: um bom abrigo para a tempestade.', 'tip', 5000);
    }
  }
  reachTapiri() {
    const g = this.g;
    if (this.finished) return;
    if (!g.done.has('m8')) {
      if (g.time > this.gateMsgT) { this.gateMsgT = g.time + 6; g.ui.toast('Caetano: <i>"Um tapiri velho... Mas antes quero ter certeza do rastro."</i>', 'tip', 3500); }
      return;
    }
    this.finished = true;
    this.finalScene();
  }
  async finalScene() {
    const g = this.g, p = g.player, tp = P(D.TAPIRI);
    await g.run(async () => {
      g.audio.setMood('mystery');
      await g.tween(g, 'letterbox', 1, 0.6);
      this.rainBoost = 1;
      g.audio.play('thunder', { vol: 1 }); g.flash = 0.4;
      await g.moveTo(p, tp.x - 2, tp.y + 2, 34);
      p.dir = 'down';
      await g.say('Caetano', 'Bem na hora. A chuva desabou.', 'caetano');
      p.forceCrouch = true;
      await g.say('Caetano', 'Paneiro molhado por fora, seco por dentro. Cantil, marmita, os pelos do veado... tudo aqui.', 'caetano');
      // tenta acender uma luz: falha, falha, acende
      for (let i = 0; i < 2; i++) { p.lantern = true; g.audio.play('lantern'); await g.wait(0.18); p.lantern = false; g.audio.play('click'); await g.wait(0.5); }
      p.lantern = true; g.audio.play('lantern');
      await g.say('Caetano', 'Pronto. Pelo menos uma luzinha.', 'caetano');
      g.camera.follow = null; g.camera.targetZoom = 1.1;
      await g.camera.panTo(tp.x - 90, tp.y - 20, 2.2);
      await g.wait(1);
      g.audio.setDuck(0.25, 1.5);
      g.audio.play('whistle', { pan: -0.85, dur: 2.8, vol: 0.5 });
      g.caption('Um assobio longo atravessa a mata', -0.85);
      await g.wait(2.2);
      await g.camera.panTo(tp.x, tp.y - 10, 1);
      p.forceCrouch = false; p.dir = 'left';
      await g.say('Caetano', 'Quem tá aí?', 'caetano');
      await g.wait(1.8);
      g.audio.play('whistle', { pan: -0.3, dur: 2.2, vol: 0.85 });
      g.caption('Outro assobio, desta vez mais perto', -0.3);
      await g.wait(1);
      g.camera.targetZoom = 1.7;
      await g.camera.panTo(tp.x - 30, tp.y - 6, 1.4);
      this.birdShadow = { x: tp.x - 70, y: tp.y - 18, t: 0 };
      g.audio.play('flap', { pan: -0.4, vol: 0.6 });
      await g.wait(1.4);
      await g.tween(g, 'fade', 1, 1.6);
      g.ui.titleCard('FASE 3 CONCLUÍDA', 'PRÓXIMA FASE: OS ASSOBIOS DE MATINTA', '', 'small');
      await g.wait(3.6);
    });
    g.complete('m9');
    this.completePhase();
  }
  completePhase() {
    const g = this.g, f = g.flags;
    g.state = 'results';
    const used = this.timeLimit - g.timeLeft;
    const carry = { inv: g.inv.toJSON(), res: { ...g.res }, tracks: [...g.tracksKnown], found: [...g.inv.found] };
    Save.write({ phase: 3, completed: true, done: [...g.done], flags: { score: f.score, journal: f.journal } });
    Save.completePhase(3, { time: used, score: f.score || 0, carry, secondary: this.secondary.filter((m) => g.done.has(m.id)).map((m) => m.id) });
    g.ui.results([
      ['Tempo da expedição', formatTime(used)],
      ['Bichos observados', `${this.count.natDone()}/3`],
      ['Missões secundárias', `${this.secondary.filter((m) => g.done.has(m.id)).length}/3`],
      ['Pistas das margens', `${this.count.cluesDone()}/${D.CLUES.length}`],
      ['Pontos de exploração', `${f.score || 0}`],
    ], { code: 'FASE 3 CONCLUÍDA', title: 'Os Segredos da Várzea' });
  }
  onResume() {}
  onRestore() { const g = this.g; g.ui.clearAlert(); g.audio.setMood('calm'); g.audio.setDuck(1, 0.5); }

  // ---------- pistas opcionais ----------
  async examineClue(c) {
    const g = this.g, f = g.flags;
    await this.look(c.text, 1.3);
    f[c.id] = true;
    this.addScore(15, c.name.toLowerCase());
    this.addJournal('Pista: ' + c.name, c.text);
    if (this.count.cluesDone() >= 4 && !g.done.has('s_rastro')) {
      g.complete('s_rastro'); this.addScore(50, 'Rastreador das Margens');
      this.addJournal('Conquista: Rastreador das Margens', 'Quatro pistas de bichos da várzea encontradas nas margens.');
    }
  }

  // ---------- reações da fauna ----------
  onTapirEvent(kind) {
    const g = this.g;
    if (kind === 'fuga' && !g.done.has('m2')) g.ui.toast('A anta se assustou e sumiu na mata. Ela volta depois de um tempo, se você se afastar e ficar quieto.', 'tip', 5000);
    if (kind === 'desvia' && dist(this.tapir.x, this.tapir.y, g.player.x, g.player.y) < 260) g.caption('A anta desconfia e muda de rumo', g.panOf(this.tapir.x));
  }
  onCapyAlarm(src) {
    const g = this.g;
    g.caption('Latidos curtos: as capivaras correm para a água', g.panOf(src.x));
    if (!g.flags.capyTip) { g.flags.capyTip = true; g.ui.toast('As capivaras se assustaram e foram para a água. Elas voltam para a prainha quando tudo fica quieto.', 'tip', 5000); }
  }
  onCapyCalm() {}
  onPacaEvent(pc, kind) { const g = this.g; if (kind === 'sai' && dist(pc.x, pc.y, g.player.x, g.player.y) < 200 && !g.flags.pacaTip) { g.flags.pacaTip = true; g.caption('Um farfalhar miúdo entre as raízes', g.panOf(pc.x)); } }
  onBirdFly(h) { const g = this.g; if (!h._cap || g.time - h._cap > 20) { h._cap = g.time; if (dist(h.x, h.y, g.player.x, g.player.y) < 300) g.caption('Uma garça levanta voo da beira', g.panOf(h.x)); } }
  onAnimalEvent(a, ev) { const g = this.g; if (ev === 'fly') for (const o of g.animals) if (o !== a && o.kind === 'jacu' && dist(o.x, o.y, a.x, a.y) < 40) o.scare(); }

  // ================= utilitários =================
  los(ax, ay, bx, by) {
    const w = this.world, n = Math.ceil(dist(ax, ay, bx, by) / 6);
    for (let i = 2; i < n - 1; i++) {
      const t = i / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      for (const c of w.near(x, y)) if (!c.off && c.r >= 3 && c.kind !== 'tapir' && (x - c.x) ** 2 + (y - c.y) ** 2 < c.r * c.r) return false;
    }
    return true;
  }
  nearWater(x, y, r) {
    const w = this.world; let best = null, bd = 1e9;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) for (let d = 8; d <= r; d += 8) { const qx = x + Math.cos(a) * d, qy = y + Math.sin(a) * d; if (w.isWater(qx, qy)) { if (d < bd) { bd = d; best = { x: qx, y: qy }; } break; } }
    return best;
  }
  reindex(c) {
    const w = this.world;
    const r = c.r || 0, x0 = c.r ? c.x - r : c.x, y0 = c.r ? c.y - r : c.y, x1 = c.r ? c.x + r : c.x + c.w, y1 = c.r ? c.y + r : c.y + c.h;
    const key = `${Math.floor(x0 / 64)},${Math.floor(y0 / 64)},${Math.floor(x1 / 64)},${Math.floor(y1 / 64)}`;
    if (c._key === key) return;
    c._key = key;
    for (const [k, arr] of w.colGrid) { const i = arr.indexOf(c); if (i >= 0) arr.splice(i, 1); if (!arr.length) w.colGrid.delete(k); }
    for (let gy = Math.floor(y0 / 64); gy <= Math.floor(y1 / 64); gy++) for (let gx = Math.floor(x0 / 64); gx <= Math.floor(x1 / 64); gx++) {
      const k = gx + ',' + gy; if (!w.colGrid.has(k)) w.colGrid.set(k, []); w.colGrid.get(k).push(c);
    }
  }
  unstick(p) {
    const w = this.world;
    if (!w.hit(p.x, p.y, p.r * 0.7) && !circleBlocked(w, p.x, p.y, p.r * 0.7)) return;
    for (let r = 3; r <= 40; r += 3) for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
      if (!w.hit(x, y, p.r) && !circleBlocked(w, x, y, p.r)) { p.x = x; p.y = y; return; }
    }
  }
  stormLevel() { return this.rain; }
  dusk() { return clamp((this.g.tod - 1000) / 90, 0, 1); }
  get extraDark() {
    const g = this.g, p = g.player;
    let d = this.dusk() * 0.22 + this.rain * 0.36 + (this.silence() ? 0.12 : 0);
    if (p && p.x > px(110) && p.y > px(54)) d += 0.06; // a margem do silêncio é mais escura
    return d;
  }
  // tarde dourada que vira tempestade: ajusta a luz depois do cálculo padrão do horário
  applyWeather() {
    const g = this.g, r = this.rain, dk = this.dusk(), sil = this.silence() ? 1 : 0;
    const gold = clamp((g.tod - 930) / 80, 0, 1) * (1 - r);
    g.sun.strength *= (1 - r * 0.9) * (1 - dk * 0.5) * (1 - sil * 0.5);
    const tA = 0.12 * gold + 0.26 * r + 0.1 * sil;
    const mix = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
    let tint = [255, 196, 120];
    tint = mix(tint, [90, 110, 140], clamp(r + sil * 0.8, 0, 1));
    g.tint = [...tint, tA];
    if (r > 0.05 || sil) g.ambientColor = [16, 22, 30];
    else if (dk > 0) g.ambientColor = [40, 26, 30];
    g.vignette = 0.45 + r * 0.15 + sil * 0.1;
  }

  // ================= atualização =================
  update(dt) {
    const g = this.g, p = g.player, f = g.flags;
    if (!p || !this.world || !this.canoe) return;
    const playing = g.state === 'play';
    for (let i = this.timers.length - 1; i >= 0; i--) if (g.time >= this.timers[i].t) { const tm = this.timers[i]; this.timers.splice(i, 1); tm.fn(); }
    this.drift.update(dt);
    const c = this.canoe;
    if (this.boarded()) {
      p.locked = true; p.x = c.x; p.y = c.y; p.vx = c.vx; p.vy = c.vy; p.moving = c.speed > 4; p.running = false;
      p.noise = lerp(p.noise, Math.min(0.5, c.speed / 120), Math.min(1, dt * 4));
      if (Math.abs(c.thrust) > 0.3) p.en = Math.max(15, p.en - 1.2 * dt); else p.en = Math.min(100, p.en + 3 * dt);
      if (!c.free()) c.unstick();
      this.landSpot = c.speed < 24 ? this.findLandSpot() : null;
      if (playing) {
        // aprender a remar: distância e curvas
        if (!f.m6_learn && g.done.has('m5')) {
          this.learnD += c.speed * dt; this.learnTurn += Math.abs(c.turn) * dt;
          if (this.learnD > 160 && this.learnTurn > 0.8) { f.m6_learn = true; g.ui.toast('Pegou o jeito do remo. Siga pelo igarapé a nordeste do lago.', 'tip', 4500); }
        }
        if (c.stuckT > 2.2 && !this.stuckTip) { this.stuckTip = true; g.ui.toast('A canoa encalhou. Aperte <kbd>E</kbd> para desencalhar com o remo.', 'tip', 4500); }
        if (c.stuckT < 0.5) this.stuckTip = false;
      }
    } else {
      this.landSpot = null;
      this.unstick(p);
      if (playing) this.updatePush(dt);
    }
    if (playing) {
      this.updateMud(dt);
      // capivaras à vista
      if (!f.m4_group && g.done.has('m3')) for (const m of this.capys.members) if (dist(m.x, m.y, p.x, p.y) < 170 && this.los(p.x, p.y - 8, m.x, m.y - 4)) { f.m4_group = true; g.ui.toast('Lá estão elas: um grupo de capivaras na prainha do lago. Chegue com calma.', 'tip', 4500); this.checkM4(); break; }
      // tempestade progressiva
      if (f.rainOn) { f.rainT = (f.rainT || 0) + dt; }
    }
    this.rain = f.rainOn ? clamp(0.15 + (f.rainT || 0) / 160 + (f.m8_prints ? 0.1 : 0) + (f.m8_hair ? 0.1 : 0) + (this.rainBoost || 0), 0, 1) : 0;
    this.updateEvent(dt);
    this.updateWeatherFx(dt);
    this.updateFish(dt);
    if (this.birdShadow) this.birdShadow.t += dt;
    this.applyWeather();
  }

  updateMud(dt) {
    const g = this.g, p = g.player, f = g.flags;
    if (this.boarded()) { p.speedMul = 1; return; }
    const surf = this.world.surfaceAt(p.x, p.y);
    const deep = D.MUD_A.some((m) => m.deep && inEll(p.x / S, p.y / S, m) < 1);
    if (surf === 'mud') p.mudT = deep ? 3.2 : 2.4;
    else p.mudT = Math.max(0, (p.mudT || 0) - dt);
    // barro grudado na bota: o passo demora a voltar ao normal
    p.speedMul = deep && surf === 'mud' ? 0.62 : p.mudT > 0 ? 0.82 + (1 - Math.min(1, p.mudT / 2.4)) * 0.18 : 1;
    if (p.moving && (surf === 'mud' || surf === 'water')) {
      this.stepAcc = (this.stepAcc || 0) + Math.hypot(p.vx, p.vy) * dt;
      if (this.stepAcc > 9) {
        this.stepAcc = 0;
        const side = (this.prints.length % 2) ? 1 : -1, ang = Math.atan2(p.vy, p.vx);
        if (surf === 'mud') this.prints.push({ x: p.x - Math.sin(ang) * side * 2, y: p.y + Math.cos(ang) * side * 1.5, a: ang, t: g.time });
        if (this.prints.length > 90) this.prints.shift();
        const n = surf === 'water' ? 4 : 2;
        for (let i = 0; i < n; i++) g.particles.add({ type: 'splash', x: p.x + (Math.random() - 0.5) * 4, y: p.y, vx: (Math.random() - 0.5) * 20, vy: -10 - Math.random() * 10, g: 70, life: 0.4, color: surf === 'water' ? '#d0e0e4' : '#6a5434' });
        if (deep) { p.makeNoise(p.sneak ? 0.35 : 0.6); g.audio.play('mudslosh', { vol: 0.6 }); }
      }
    }
    if (deep && !f.deepTip) { f.deepTip = true; g.ui.toast('<b>Atoleiro</b> · O barro fundo prende a bota: Caetano anda bem devagar e cada passo faz barulho, mesmo agachado.', 'tip', 5500); }
  }

  updateWeatherFx(dt) {
    const g = this.g, r = this.rain;
    // trovões distantes durante o evento; relâmpagos quando a chuva engrossa
    if (this.ev && this.ev.stage !== 'done' && g.time > (this.thunderAt || 0)) { this.thunderAt = g.time + 9 + Math.random() * 10; g.audio.play('thunder', { vol: 0.35, far: true }); }
    if (r > 0.45) {
      this.lightT -= dt;
      if (this.lightT <= 0) {
        this.lightT = 7 + Math.random() * 10 * (1.4 - r);
        g.flash = 0.35 + Math.random() * 0.2;
        const delay = 400 + Math.random() * 1600;
        setTimeout(() => g.audio.play('thunder', { vol: 0.6 + r * 0.4 }), delay);
        if (!g.flags.thunderCap) { g.flags.thunderCap = true; g.caption('Relâmpago... e o trovão rolando pela várzea', 0); }
      }
    }
    // pingos na água e nas poças
    if (r > 0.05) {
      const cam = g.camera, n = Math.round(r * 30 * dt * 10);
      for (let i = 0; i < n; i++) {
        const x = cam.x + (Math.random() - 0.5) * cam.viewW, y = cam.y + (Math.random() - 0.5) * cam.viewH;
        if (this.world.isWater(x, y) || this.world.terrainAt(x, y) === T.MUD) g.particles.add({ type: 'ripple', x, y, life: 0.6, r1: 3, color: '#c8d8e0' });
      }
    }
  }

  updateFish(dt) {
    const g = this.g, p = g.player;
    for (const fi of this.fish) fi.t += dt;
    this.fish = this.fish.filter((fi) => fi.t < fi.dur);
    if (this.silence() || g.state !== 'play') return;
    this.fishT -= dt;
    if (this.fishT > 0) return;
    this.fishT = 2.5 + Math.random() * 5;
    for (let k = 0; k < 10; k++) {
      const x = p.x + (Math.random() - 0.5) * 220, y = p.y + (Math.random() - 0.5) * 150;
      if (!this.world.isWater(x, y) || !this.world.isWater(x + 8, y) || dist(x, y, p.x, p.y) < 30) continue;
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.fish.push({ x, y, dir, t: 0, dur: 0.75 });
      g.particles.add({ type: 'ripple', x, y, life: 0.9, r1: 6, color: '#d0e0e4' });
      setTimeout(() => { g.particles.add({ type: 'ripple', x: x + dir * 14, y, life: 1, r1: 7, color: '#d0e0e4' }); for (let i = 0; i < 4; i++) g.particles.add({ type: 'splash', x: x + dir * 14, y, vx: (Math.random() - 0.5) * 14, vy: -12, g: 60, life: 0.4 }); }, 700);
      g.audio.play('fishjump', { pan: g.panOf(x), vol: 0.6 });
      if (!g.flags.fishCap) { g.flags.fishCap = true; g.caption('Um peixe salta e cai de volta na água', g.panOf(x)); }
      break;
    }
  }

  audioEnv() {
    const g = this.g, p = g.player;
    if (!p || !this.canoe) return {};
    const cur = this.current.at(p.x, p.y);
    const near = this.main.project(p.x, p.y);
    const flow = clamp((near.c / 27) * (1 - clamp((near.d - near.w) / 120, 0, 1)), 0, 1);
    const lake = clamp(1 - Math.sqrt(inEll(p.x / S, p.y / S, D.LAKE, 1.8)), 0, 1);
    const quiet = this.silence() ? 0.95 : 0;
    void cur;
    return { river: Math.max(flow, lake * 0.25), riverPan: clamp((near.cx - p.x) / 120, -0.8, 0.8), dawn: 0, insects: (0.6 + this.dusk() * 0.3) * (1 - this.rain * 0.6), frogs: 0.4 + lake * 0.4 + this.rain * 0.5, birds: 1 - this.rain * 0.7 - this.dusk() * 0.4, fire: 0, herd: 0, herdPan: 0, quiet, rain: this.rain };
  }

  // info para o painel da canoa
  navInfo() {
    if (!this.boarded()) return null;
    const c = this.canoe, cur = this.current.at(c.x, c.y), cs = Math.hypot(cur.x, cur.y);
    return { speed: c.speed, max: 64, cur: cs, curA: Math.atan2(cur.y, cur.x), heading: c.a, instab: this.ev && this.ev.stage !== 'done' && this.ev.stage !== 'silence' ? this.instab : null };
  }

  // ================= desenho =================
  drawGround(ctx, V) {
    const g = this.g, f = g.flags, p = g.player, t = g.time;
    if (!this.drift) return;
    const vis = (x, y, m = 40) => x > V.cx - m && x < V.cx + V.vw + m && y > V.cy - m && y < V.cy + V.vh + m;
    const glint = (x, y, rx = 15, ry = 9, col = '#ffe8a0') => {
      if (!p || dist(x, y, p.x, p.y) > 76) return;
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 3 + x); ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    };
    // reflexos animados na água: brilho que corre com a correnteza e copas refletidas
    const w = this.world;
    const tx0 = Math.max(0, Math.floor(V.cx / 16)), tx1 = Math.min(w.tw - 1, Math.ceil((V.cx + V.vw) / 16)), ty0 = Math.max(0, Math.floor(V.cy / 16)), ty1 = Math.min(w.th - 1, Math.ceil((V.cy + V.vh) / 16));
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!w.waterTiles[ty * w.tw + tx]) continue;
      const h = hash2(tx, ty, 41);
      if (h > 0.5) continue;
      const cur = this.current.at(tx * 16 + 8, ty * 16 + 8);
      const off = ((t * (6 + Math.hypot(cur.x, cur.y) * 0.6) + h * 50) % 16);
      const dx = cur.x || cur.y ? cur.x / (Math.hypot(cur.x, cur.y)) : 1, dy = cur.x || cur.y ? cur.y / Math.hypot(cur.x, cur.y) : 0;
      const x = tx * 16 + 8 + dx * (off - 8), y = ty * 16 + 4 + h * 10 + dy * (off - 8) * 0.5;
      if (!w.isWater(x, y)) continue;
      ctx.globalAlpha = (0.08 + 0.1 * Math.sin(t * 1.6 + h * 30)) * (1 - this.rain * 0.5); ctx.fillStyle = h < 0.2 ? '#f0f4e8' : '#a8c8cc';
      ctx.fillRect(Math.round(x), Math.round(y), 3 + ((h * 10) | 0) % 3, 1);
    }
    ctx.globalAlpha = 1;
    for (const d of w.queryDrawables(V.cx, V.cy, V.cx + V.vw, V.cy + V.vh, this._qd || (this._qd = []))) {
      if (!d.crown || !w.isWater(d.x, d.y + 14)) continue;
      const wob = Math.sin(t * 0.9 + d.x) * 1.5;
      ctx.globalAlpha = 0.16; ctx.fillStyle = '#0c2018';
      ctx.beginPath(); ctx.ellipse(d.x + wob, d.y + 14 + d.crown.r * 0.2, d.crown.r * 0.8, d.crown.r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    }
    this._qd.length = 0;
    ctx.globalAlpha = 1;
    // espuma nas pedras da correnteza
    for (const r of this.rocks) if (vis(r.x, r.y)) { ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 5 + r.x); ctx.strokeStyle = '#e8f0f0'; ctx.beginPath(); ctx.ellipse(r.x, r.y + 2, r.r + 3, r.r * 0.6 + 1, 0, 0, Math.PI); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // capim flutuante (balança na água)
    for (const q of this.floatGrass) if (vis(q.x, q.y, 60)) {
      for (let i = 0; i < 6; i++) { const a = i * 1.1, rr = q.r * (0.3 + (i % 3) * 0.25); const s = Sprites.get('cn:' + (i % 4), () => V3.canaranaSprite(740 + i % 4)); ctx.drawImage(s, Math.round(q.x + Math.cos(a) * rr - 8 + Math.sin(t + i) * 0.8), Math.round(q.y + Math.sin(a) * rr * 0.5 - 8)); }
    }
    // pegadas de bota no barro (somem com o tempo)
    ctx.fillStyle = '#2a1c10';
    for (const pr of this.prints) {
      const age = t - pr.t; if (age > 40 || !vis(pr.x, pr.y)) continue;
      ctx.globalAlpha = 0.55 * (1 - age / 40);
      ctx.save(); ctx.translate(Math.round(pr.x), Math.round(pr.y)); ctx.rotate(pr.a); ctx.fillRect(-2, -1, 4, 2); ctx.fillRect(1, -1, 1, 2); ctx.restore();
    }
    ctx.globalAlpha = 1;
    // troncos à deriva
    this.drift.draw(ctx, V);
    // ondas do evento
    for (const wv of this.waves) {
      const q = this.main.at(wv.s); if (!vis(q.x, q.y, 60)) continue;
      ctx.globalAlpha = 0.5 * wv.w; ctx.strokeStyle = '#d8e8ec'; ctx.lineWidth = 1;
      const an = Math.atan2(q.ty, q.tx);
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(an); ctx.beginPath(); ctx.ellipse(0, 0, 6, q.w * 0.45, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      ctx.globalAlpha = 0.25 * wv.w; ctx.beginPath(); ctx.ellipse(-5, 0, 6, q.w * 0.4, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke(); ctx.restore();
    }
    ctx.globalAlpha = 1;
    // sombras sob a água: peixes grandes de vez em quando e a sombra enorme do evento
    if (!this.silence()) {
      const k = Math.floor(t / 9), sx = hash2(k, 1, 5), sy = hash2(k, 2, 5);
      const x = V.cx + sx * V.vw, y = V.cy + sy * V.vh, ph = (t % 9) / 9;
      if (w.isWater(x, y) && w.isWater(x + 20, y)) { ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.18; ctx.fillStyle = '#081210'; ctx.beginPath(); ctx.ellipse(x + ph * 30, y, 9, 3, 0.2, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    }
    const bs = this.bigShadow;
    if (bs && bs.a > 0) {
      const an = Math.atan2(bs.vy, bs.vx), segs = 14;
      for (let i = 0; i < segs; i++) {
        const k = i / segs, off = Math.sin(t * 2.2 - k * 5) * 10 * k;
        const x = bs.x - Math.cos(an) * bs.len * k - Math.sin(an) * off, y = bs.y - Math.sin(an) * bs.len * k + Math.cos(an) * off;
        if (!w.isWater(x, y)) continue;
        const r = 12 * (1 - k * 0.6) + 4;
        ctx.globalAlpha = 0.34 * bs.a * (1 - k * 0.4); ctx.fillStyle = '#050c0a';
        ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55, an, 0, Math.PI * 2); ctx.fill();
        // borda clara: a luz passando pela água agitada
        if (i % 3 === 0) { ctx.globalAlpha = 0.12 * bs.a; ctx.strokeStyle = '#b8d0d0'; ctx.beginPath(); ctx.ellipse(x, y, r + 4, (r + 4) * 0.55, an, 0, Math.PI * 2); ctx.stroke(); }
      }
      ctx.globalAlpha = 1;
    }
    // água fervendo (turbulência)
    for (const b of this.boils) { if (!vis(b.x, b.y)) continue; const k = b.t / 2.5; ctx.globalAlpha = (1 - k) * 0.6 * b.k; ctx.strokeStyle = '#e0ecee'; ctx.beginPath(); ctx.ellipse(b.x, b.y, 2 + k * 10, (2 + k * 10) * 0.5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = '#e8f2f4'; ctx.fillRect(Math.round(b.x), Math.round(b.y - 1), 1, 1); }
    ctx.globalAlpha = 1;
    // sinais que brilham
    const sm = P(D.LAMA1); if (!f.m1_mud) glint(sm.x, sm.y, 18, 9);
    for (const s of D.SIGNS_A) { const q = P(s.at); if (!f['sign_' + s.id]) glint(q.x, q.y); if (s.id === 'paca' && vis(q.x, q.y)) { const rs = Sprites.get('root:22', () => F2.rootSprite(22, 22)); ctx.drawImage(rs, Math.round(q.x - 11), Math.round(q.y - 6)); } }
    if (g.done.has('m1') && !f.m2_prints) { const q = P(D.ANTA_PRINTS); glint(q.x, q.y, 18, 10, '#ffd666'); }
    for (const c of D.CLUES) { const q = P(c.at); if (!vis(q.x, q.y) || f[c.id]) continue; glint(q.x, q.y, 13, 8, '#ffd666'); if (c.id === 'c_cocos') { ctx.fillStyle = '#6a4a28'; for (let i = 0; i < 6; i++) ctx.fillRect(Math.round(q.x - 4 + (i % 3) * 3), Math.round(q.y - 1 + (i / 3 | 0) * 2), 2, 1); } if (c.id === 'c_fezes') { ctx.fillStyle = '#3a4a22'; for (let i = 0; i < 7; i++) ctx.fillRect(Math.round(q.x - 4 + (i % 4) * 2), Math.round(q.y + (i / 4 | 0) * 2), 1, 1); } if (c.id === 'c_jacare') { ctx.strokeStyle = 'rgba(40,30,18,0.6)'; ctx.beginPath(); ctx.moveTo(q.x - 14, q.y - 2); ctx.quadraticCurveTo(q.x, q.y + 3, q.x + 14, q.y); ctx.stroke(); } if (c.id === 'c_ossos') { ctx.fillStyle = '#e8e0d0'; ctx.fillRect(Math.round(q.x - 3), Math.round(q.y), 6, 1); for (let i = 0; i < 3; i++) ctx.fillRect(Math.round(q.x - 2 + i * 2), Math.round(q.y - 1), 1, 3); } }
    if (f.m7_escape && !f.m7_mark) { const q = P(D.MARK_TREE); glint(q.x, q.y - 10, 16, 10, '#ffd666'); }
    if (f.m8_land && !f.m8_prints) { const q = P(D.PRINTS_E); glint(q.x, q.y, 16, 10, '#ffd666'); }
    if (f.m8_prints && !f.m8_hair) { const q = P(D.HAIR_E); glint(q.x, q.y - 4, 12, 9, '#ff9a6a'); }
    if (f.m8_hair && !f.m8_dir) { const q = P(D.DIR_SIGN); glint(q.x, q.y, 14, 8, '#ffd666'); }
    if (!f.paddle && g.done.has('m3')) { const q = this.jirau; if (vis(q.x, q.y)) glint(q.x, q.y - 4, 18, 9, '#a8d8f0'); }
    // rastro do empurrão da canoa
    if (!f.launched && f.branch && f.vines) { const q = this.pushTarget(); ctx.globalAlpha = 0.3 + 0.15 * Math.sin(t * 2); ctx.strokeStyle = '#e8d8a0'; ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.ellipse(q.x, q.y, 7, 4, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
  }

  crownClear(V) {
    const g = this.g, p = g.player, out = this._clear || (this._clear = []);
    out.length = 0;
    if (!p || !this.canoe) return out;
    if (g.state === 'cutscene' && !g.camera.follow) out.push({ x: g.camera.x, y: g.camera.y + 8, r: 60, min: 0.3 });
    if (this.boarded()) out.push({ x: this.canoe.x, y: this.canoe.y, r: 80, min: 0.18 });
    const add = (a, r) => { if (a.visible === false) return; if (a.x < V.cx - 40 || a.x > V.cx + V.vw + 40 || a.y < V.cy - 20 || a.y > V.cy + V.vh + 60) return; if (dist(a.x, a.y, p.x, p.y) < 240) out.push({ x: a.x, y: a.y, r, min: 0.4 }); };
    add(this.tapir, 22); for (const m of this.capys.members) add(m, 16); for (const pc of this.pacas) add(pc, 12);
    if (this.bigShadow) out.push({ x: this.bigShadow.x, y: this.bigShadow.y, r: 90, min: 0.3 });
    return out;
  }

  drawWorldOverlay(ctx, V) {
    const g = this.g, t = g.time;
    // peixes saltando
    for (const fi of this.fish) {
      const k = fi.t / fi.dur, x = fi.x + fi.dir * 14 * k, y = fi.y - Math.sin(k * Math.PI) * 10;
      const s = Sprites.get('fish:' + (fi.dir < 0 ? 1 : 0), () => { const c = V3.fishSprite(0); return fi.dir < 0 ? flipCanvas(c) : c; });
      ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate((k - 0.5) * 1.6 * fi.dir); ctx.drawImage(s, -4, -2); ctx.restore();
    }
    // neblina leve sobre o lago, o igapó e a lagoa
    const fogs = [[84, 47.5, 10, 0.07], [116, 26, 7, 0.08], [133.5, 64.5, 9, 0.12 + this.rain * 0.08], [50, 46, 6, 0.05]];
    for (const [fx, fy, fr, fa] of fogs) {
      const x = px(fx) + Math.sin(t * 0.05 + fx) * 20, y = px(fy), r = fr * S;
      if (x < V.cx - r || x > V.cx + V.vw + r || y < V.cy - r || y > V.cy + V.vh + r) continue;
      const grd = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
      grd.addColorStop(0, `rgba(210,220,220,${fa * (1 + this.dusk())})`); grd.addColorStop(1, 'rgba(210,220,220,0)');
      ctx.fillStyle = grd; ctx.fillRect(x - r, y - r * 0.7, r * 2, r * 1.4);
    }
  }

  drawAfterLight(ctx, V) {
    const g = this.g, t = g.time;
    // marcas na árvore meio submersa: um risco largo e liso dando a volta no tronco
    if (this.markA > 0) {
      const mt = P(D.MARK_TREE);
      ctx.globalAlpha = this.markA * 0.85;
      ctx.fillStyle = '#c8bca0'; ctx.fillRect(Math.round(mt.x - 7), Math.round(mt.y - 30), 14, 4);
      ctx.fillStyle = '#8a7e66'; ctx.fillRect(Math.round(mt.x - 7), Math.round(mt.y - 26), 14, 1);
      ctx.fillStyle = '#e0d4b4'; for (let i = 0; i < 7; i++) ctx.fillRect(Math.round(mt.x - 6 + i * 2), Math.round(mt.y - 29 + (i % 2)), 1, 1);
      ctx.fillStyle = '#c8bca0'; ctx.fillRect(Math.round(mt.x - 6), Math.round(mt.y - 18), 12, 3);
      ctx.globalAlpha = 1;
    }
    // sombra de ave atravessando a vegetação (final)
    const bsh = this.birdShadow;
    if (bsh) {
      const x = bsh.x + bsh.t * 70, y = bsh.y + Math.sin(bsh.t * 3) * 3;
      ctx.globalAlpha = Math.max(0, 0.75 - bsh.t * 0.35); ctx.fillStyle = '#05070a';
      ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x, y - 2 - Math.sin(bsh.t * 14) * 3); ctx.lineTo(x + 10, y); ctx.lineTo(x + 4, y + 1); ctx.lineTo(x, y + 4); ctx.lineTo(x - 4, y + 1); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // chuva
    const r = this.rain;
    if (r > 0.02) {
      const n = Math.round(60 + r * 260);
      ctx.strokeStyle = 'rgba(200,214,230,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const h1 = hash2(i, 1, 99), h2 = hash2(i, 2, 99);
        const y = V.cy + ((h2 * V.vh + t * (260 + h1 * 80)) % (V.vh + 20)) - 10;
        const x = V.cx + ((h1 * V.vw + t * 30 + (y - V.cy) * 0.18) % V.vw);
        ctx.moveTo(x, y); ctx.lineTo(x - 2, y - 7);
      }
      ctx.stroke();
      ctx.fillStyle = `rgba(30,40,56,${r * 0.12})`; ctx.fillRect(V.cx, V.cy, V.vw, V.vh);
    }
  }
}

export { lerp };
