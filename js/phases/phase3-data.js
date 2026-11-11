// FASE 3 — Os Segredos da Várzea: dados do mapa (coordenadas em tiles de 16 px) e textos.
// Separado da lógica para poder ser usado também pelos testes automatizados.
export const TW = 160, TH = 84, S = 16;
export const px = (t) => t * S;

// ---------------------------------------------------------------- trilhas a pé
// r = núcleo de terra batida; band = mata pisável em volta (fora disso é mata fechada)
export const TRAILS = [
  // Região A — a trilha encharcada (chega da Fase 2, pelo oeste)
  { id: 'A', r: 1.0, band: 2.4, pts: [[3.5, 66], [6, 66], [10, 64.6], [15, 66], [20, 65], [25, 63], [30, 61.2], [35, 59.6], [40, 57], [44, 55]] },
  { id: 'Apaca', r: 0.6, band: 0.9, pts: [[30, 61.2], [31.6, 64], [33.6, 66.6]] },
  // Região B — trilha da anta, garganta estreita e desvio pelo atoleiro
  { id: 'B', r: 0.9, band: 1.0, pts: [[44, 55], [47, 52], [50, 49], [53, 47.2], [55.6, 46]] },
  { id: 'Bneck', r: 0.5, band: 0.0, pts: [[55.6, 46], [57.6, 45.1], [59.8, 44.2]] },
  { id: 'Bexit', r: 0.9, band: 1.1, pts: [[59.8, 44.2], [62.5, 42.8], [66, 41.5], [69, 41], [72, 42.4], [74.6, 44.4]] },
  { id: 'Bbarreiro', r: 0.6, band: 0.6, pts: [[50, 49], [49.4, 46.6]] },
  { id: 'Bpalms', r: 0.6, band: 0.6, pts: [[62.5, 42.8], [63.2, 40.4]] },
  { id: 'Bmir', r: 0.5, band: 0.6, pts: [[51.2, 48.2], [52.6, 48.6]] },
  { id: 'Bdetour', r: 0.7, band: 0.6, pts: [[50, 49], [51.6, 51], [55.5, 52.2], [59, 50.8], [61.4, 48.2], [62.6, 45.6], [62.5, 42.8]] },
  // Região C — caminho até o lago e o jirau de pesca abandonado
  { id: 'Cjirau', r: 0.6, band: 0.8, pts: [[69, 41], [70.2, 38.6]] },
  // Região E — da margem até o tapiri
  { id: 'E', r: 0.9, band: 1.4, pts: [[124.4, 66.6], [121, 68.6], [117.4, 70.4], [114, 72.4], [111, 74.2]] },
];

// áreas abertas (elipses)
export const AREAS = [
  { id: 'chegada', x: 5, y: 66, rx: 3.2, ry: 2.6, t: 'clear' },
  { id: 'pacaA', x: 33.8, y: 67.2, rx: 2.2, ry: 1.6, t: 'floor' },
  { id: 'barreiro', x: 49, y: 45.4, rx: 2.8, ry: 1.9, t: 'mud' },
  { id: 'palmas', x: 63.4, y: 39.6, rx: 2.0, ry: 1.4, t: 'floor' },
  { id: 'mirante', x: 52.8, y: 48.6, rx: 1.3, ry: 0.9, t: 'floor' },
  { id: 'jirau', x: 70.6, y: 37.4, rx: 2.3, ry: 1.5, t: 'clear' },
  { id: 'margemO', x: 74.4, y: 46.8, rx: 3.3, ry: 5.0, t: 'grass' },
  { id: 'cantoSO', x: 75.6, y: 52.8, rx: 3.4, ry: 2.6, t: 'floor' },
  { id: 'praiaS', x: 83, y: 55.6, rx: 8.6, ry: 2.6, t: 'grass' },
  { id: 'praiaD', x: 127.6, y: 25.9, rx: 1.8, ry: 1.0, t: 'sand' },
  { id: 'margemE', x: 121.4, y: 67.6, rx: 4.4, ry: 3.0, t: 'floor' },
  { id: 'beiraE', x: 124.6, y: 66.4, rx: 1.4, ry: 2.4, t: 'mud' },
  { id: 'tapiri', x: 109.5, y: 75, rx: 3.6, ry: 2.6, t: 'clear' },
];

// terreno forçado (aplicado antes de tudo)
export const OVR = [
  { x: 75.3, y: 42.7, rx: 1.6, ry: 1.1, t: 'mud' }, // a canoa atolada na lama da margem
];

// barro (Região A): o primeiro trecho de lama, outros, e um atoleiro fundo
export const MUD_A = [
  { id: 'lama1', x: 12.6, y: 64.9, rx: 1.8, ry: 1.1 },
  { id: 'lama2', x: 23.2, y: 63.9, rx: 1.5, ry: 1.0 },
  { id: 'atoleiro', x: 27.4, y: 62.4, rx: 1.4, ry: 1.0, deep: true },
  { id: 'lama3', x: 36.6, y: 59.2, rx: 1.9, ry: 1.2 },
  { id: 'lamaAnta', x: 41.2, y: 56.6, rx: 1.8, ry: 1.1 },
  { id: 'atoleiroB', x: 57.4, y: 51.6, rx: 1.8, ry: 1.0, deep: true },
  { id: 'lamaB2', x: 60.4, y: 50.0, rx: 1.0, ry: 1.2, deep: true },
];
// pequenos igarapés que cortam a trilha (rasos onde a trilha cruza)
export const CREEKS_A = [
  { w: 1.3, pts: [[17.4, 44], [18, 54], [17.6, 62], [17.4, 66], [18.6, 74], [18, 82]] },
  { w: 1.1, pts: [[31, 46], [32.2, 55], [32.6, 61.2], [32.4, 63.6], [31.6, 70], [33, 82]] },
];

// ---------------------------------------------------------------- água navegável
export const LAKE = { x: 84, y: 47.5, rx: 10, ry: 6.4 };
export const LAGOON = { x: 133.5, y: 64.5, rx: 8.5, ry: 5.6 };
// igarapé principal: [x, y, largura (tiles), correnteza (px/s)] — a água desce da lagoa (E) para o lago (C)
export const CHANNEL = [
  [90.5, 44.8, 3.6, 3], [95, 41.6, 3.0, 5], [98.5, 38, 2.8, 6], [102.5, 35, 2.8, 7], [106.5, 33, 2.6, 9],
  [111, 31.2, 2.6, 13], [115.5, 29.6, 2.6, 15], [120, 28.2, 2.5, 15], [124.5, 27.6, 2.6, 14],
  [128.5, 28.4, 2.4, 17], [132, 30.6, 2.3, 24], [135, 33.6, 2.2, 27], [137.8, 37, 2.1, 27], [140, 41, 2.2, 21],
  [141.6, 45, 2.0, 13], [142.4, 48.2, 1.9, 10], [141.8, 52, 2.3, 7], [140, 56, 2.6, 5], [138, 59.4, 3.0, 3], [136, 62, 3.4, 1],
];
// passagem alternativa: braço alagado (igapó) com árvores em pé dentro d'água
export const SIDE = [
  [108.2, 32.6, 2.4, 3], [110.4, 28.8, 2.7, 3], [114, 26.2, 2.9, 3], [118.5, 25.2, 2.9, 3], [122.4, 25.7, 2.7, 4], [125, 27.3, 2.4, 6],
];
// árvores do igapó: [índice do segmento, t, deslocamento lateral (tiles), raio px]
export const IGAPO_TREES = [[1, 0.2, 0.75, 3.5], [1, 0.75, -0.8, 3.5], [2, 0.35, 0.8, 4], [2, 0.85, -0.75, 3.5], [3, 0.4, 0.85, 4], [3, 0.9, -0.8, 3.5], [4, 0.5, 0.7, 3.5]];
// pedras da correnteza (D3): [índice, t, deslocamento (tiles), raio px]
export const ROCKS_D = [[9, 0.3, 0.72, 5], [10, 0.1, -0.72, 5], [10, 0.7, 0.7, 4.5], [11, 0.35, -0.7, 5], [11, 0.9, 0.68, 4.5], [12, 0.55, -0.68, 5], [13, 0.4, 0.75, 4.5]];
// capim flutuante (canarana) que segura a canoa
export const FLOAT_GRASS = [[100.8, 37.4, 1.0], [109.4, 30.6, 0.9], [96.2, 40.4, 0.8], [131.6, 64.4, 1.2]];
// troncos caídos na lagoa (obstáculos na fuga)
export const LAGOON_SNAGS = [[131, 62.2, 5], [136.4, 66.8, 5], [129, 65.8, 4], [134.4, 69, 4]];
// praia do igarapé (descanso)
export const BEACH_D = [127.6, 25.9];
// árvores da passagem
export const GATE_TREES = [[141.0, 47.9], [143.9, 48.5]];

// ---------------------------------------------------------------- pontos da história
export const SPAWN = [5.2, 66];
export const SIGNS_A = [
  { id: 'capivara', at: [21.8, 65.8], name: 'Pegadas de capivara', text: 'Quatro dedos na frente, três atrás, com membrana entre eles. Capivara. Um grupo inteiro desceu pra água por aqui.' },
  { id: 'paca', at: [28.8, 60.0], name: 'Raízes roídas', text: 'Raiz roída rente ao chão, dente fino e afiado, e um buraco escondido entre as sapopemas. Toca de paca. Ela só sai quando escurece.' },
];
export const LAMA1 = [12.8, 64.6];
export const ANTA_PRINTS = [41.2, 56.4];
export const MIRANTE = [52.8, 48.6];
export const BOTTLENECK = [57.6, 45.1];
export const PALMS = [63.4, 39.6];
export const BARREIRO = [49, 45.4];
export const DETOUR_GATE = [51.4, 50.5];
export const B_GATE = [66.8, 41.4];
export const JIRAU = [70.6, 37.2];
export const SHORE_PT = [73.6, 47.6];
export const CANOE = { start: [76.0, 43.4], end: [78.8, 45.6] };
export const CAPY_HOME = [83, 55.4];
export const CAPY_SAFE = [85.6, 48.6];
export const HERONS = [[80.6, 42.6], [90.4, 53.4], [100.4, 35.8]];
export const PACA_DENS = [{ id: 'A', at: [33.8, 67.4], shade: 0.42 }, { id: 'C', at: [74.2, 52.8], shade: 0.3 }, { id: 'E1', at: [119.2, 70.8], shade: 0.12 }, { id: 'E2', at: [112.6, 73.8], shade: 0.12 }];

// marcos da navegação
export const LOGS_ZONE = { a: [106.8, 33], b: [126.8, 28] };   // trecho dos troncos (Remador Experiente)
export const CURRENT_ZONE = { a: [129.2, 28.8], b: [140.4, 41.6] };
export const PASSAGE = [142.4, 48.2];
export const SILENCE = [142.0, 50.8];
export const TURB = [135.6, 62.6];
export const SAFE_BANK = [124.8, 66.2];
export const MARK_TREE = [126.4, 62.8];
export const PRINTS_E = [122.4, 68.2];
export const HAIR_E = [118.6, 69.6];
export const DIR_SIGN = [115.4, 71.6];
export const TAPIRI = [109.4, 74.6];

// pistas opcionais deixadas por animais (Rastreador das Margens: 4 de 6)
export const CLUES = [
  { id: 'c_cocos', at: [33.0, 65.8], name: 'Coquinhos roídos', text: 'Uma pilha de coquinhos de tucumã roídos, com furinhos certinhos. Paca come escondida e larga as cascas na porta da toca.' },
  { id: 'c_banho', at: [48.2, 44.6], name: 'Lamaçal de banho', text: 'O barro aqui está alisado e cheio de marcas de corpo grande. É onde a anta rola pra se livrar dos carrapatos.' },
  { id: 'c_ossos', at: [74.0, 49.4], name: 'Espinhas de peixe', text: 'Espinhas de peixe e penas brancas embaixo do galho seco. Poleiro de garça: ela pesca na beira e come aqui.' },
  { id: 'c_fezes', at: [79.4, 56.4], name: 'Fezes de capivara', text: 'Bolinhas ovais, verdes por dentro, um monte junto. O grupo de capivaras dorme na prainha e come o capim da beira.' },
  { id: 'c_jacare', at: [88.8, 55.6], name: 'Rastro de jacaré', text: 'Um sulco arrastado pela areia, com patas dos dois lados, entrando na água. Jacaré. Melhor não pisar no rabo de ninguém.' },
  { id: 'c_ariranha', at: [127.2, 25.4], name: 'Escorregador de ariranha', text: 'Barranco liso, escorregadio, com escamas no chão. As ariranhas descem por aqui brincando, direto pra água.' },
];

// textos curtos de apoio
export const DIRECTIONS = ['Para o sul, para a beira da lagoa', 'Para o oeste, para o alto da mata', 'Para o norte, de volta ao igarapé'];
export const DIR_RIGHT = 1;
