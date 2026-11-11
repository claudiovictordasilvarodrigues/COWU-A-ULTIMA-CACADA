// FASE 2 — dados do mapa (coordenadas em tiles de 16 px) e textos.
// Separado da lógica para poder ser usado também pelos testes automatizados.
export const TW = 150, TH = 120, S = 16;
export const px = (t) => t * S;

// trilhas: r = núcleo de terra batida; band = mata pisável em volta (fora disso é mata fechada)
export const TRAILS = [
  { id: 'A', r: 1.1, band: 3.2, pts: [[9, 108], [14, 105.5], [19, 102], [25, 99.5], [31, 98.5], [36, 95.5], [41, 92.5], [47, 91]] },
  { id: 'A2', r: 0.7, band: 1.4, pts: [[14, 105.5], [12.5, 110], [15, 113]] },
  { id: 'bicho', r: 0.7, band: 0.9, pts: [[38, 107], [40, 101], [41.5, 95], [44, 89], [49, 86]] },
  { id: 'PN', r: 0.85, band: 0.5, pts: [[66, 80], [66, 74], [70, 69], [77, 65], [85, 62], [92, 61]] },
  { id: 'PNE', r: 0.85, band: 0.5, pts: [[81, 85], [85, 81], [88, 77], [90, 72], [93, 66], [95, 61], [98, 59.5]] },
  { id: 'C', r: 1.0, band: 1.2, pts: [[92, 61], [98, 59.5], [104, 58.5]] },
  { id: 'Canta', r: 0.8, band: 1.0, pts: [[90, 62], [87, 57], [84, 52.5], [81, 49.5]] },
  { id: 'C2', r: 1.0, band: 1.0, pts: [[104, 49], [106, 46], [110, 44], [116, 42], [122, 41]] },
  { id: 'D', r: 1.0, band: 1.15, pts: [[122, 41], [128, 43], [133, 47], [136, 52], [135.5, 57], [138, 62], [136.5, 67], [135, 72], [135, 77]] },
  { id: 'Dbaixada', r: 0.8, band: 0.6, pts: [[133, 47.5], [129, 50.5], [125.5, 52.5]] },
  { id: 'Desq', r: 0.85, band: 0.55, pts: [[135, 77], [130, 81], [127.5, 86], [130, 91], [134, 94]] },
  { id: 'Ddir', r: 0.8, band: 0.5, pts: [[135, 77], [138.5, 81], [139.5, 86], [137.5, 91], [134, 94]] },
  { id: 'ponte', r: 0.45, band: 0.1, pts: [[134, 93.5], [134, 96], [134, 100.6]] },
  { id: 'E', r: 1.0, band: 1.6, pts: [[128, 106.5], [124, 110], [118, 112.5], [112, 113.5], [106, 113], [101, 113]] },
  { id: 'E2', r: 0.7, band: 1.0, pts: [[124, 110], [131, 113.3], [138, 114]] },
];

// áreas abertas (elipses): clareiras e bolsões de mata pisável
export const AREAS = [
  { id: 'camp1', x: 10, y: 108, rx: 3.6, ry: 3, t: 'clear' },
  { id: 'B', x: 66, y: 92, rx: 19, ry: 13, t: 'clear' },
  { id: 'Cmata', x: 89, y: 61, rx: 11, ry: 6, t: 'floor' },
  { id: 'Cpatio', x: 101, y: 59.5, rx: 6.5, ry: 3.6, t: 'clear' },
  { id: 'barreiro', x: 80, y: 48, rx: 5, ry: 3.6, t: 'mud' },
  { id: 'Cnorte', x: 108, y: 46.2, rx: 5.5, ry: 3.2, t: 'floor' },
  { id: 'baixada', x: 124, y: 53, rx: 3.6, ry: 2.6, t: 'clear' },
  { id: 'E', x: 118, y: 112.5, rx: 18, ry: 4.6, t: 'meadow' },
];
export const B_CENTER = { x: 66, y: 92, rx: 19, ry: 13 };
export const VARZEA = { x: 93, y: 113, rx: 5, ry: 4.5 };
export const LAJEDO = { x: 134, y: 104.6, rx: 9.5, ry: 3.8 };
export const POND = { x: 78.5, y: 46.5, r: 1.4 };
export const GORGE = { x: 104, half: 1.6, y0: 48.6, y1: 57.2, wall: 6, ditch: { x0: 97.8, x1: 102.4, y0: 48.6, y1: 52.4 } };
export const GULLY = { y0: 96, y1: 99.6, x0: 110 };
export const BRIDGE = { x: 134, y0: 95.6, y1: 100.3, w: 1.4 };
export const MUD_D = { y0: 66.5, y1: 75.5, x0: 130, x1: 141 };

// sinais da passagem do bando (Missão 1: examinar 2 diferentes)
export const SIGNS = [
  { id: 'fucado', at: [19.5, 101], name: 'Solo revolvido', text: 'A terra foi virada de cabeça pra baixo, num pedaço enorme. Focinho de bicho, muitos focinhos, cavando atrás de raiz e minhoca.' },
  { id: 'raizes', at: [25, 100.6], name: 'Raízes quebradas', text: 'Raízes arrancadas e roídas, ainda soltando seiva. Quebraram faz pouco. Dente forte, de bicho que mastiga coquinho duro.' },
  { id: 'pegadas', at: [30.5, 97.6], name: 'Pegadas de casco partido', text: 'Pegada pequena de casco partido, centenas delas, umas por cima das outras. Não é um bicho: é um bando inteiro passando junto.' },
  { id: 'esfregao', at: [37, 94.2], name: 'Tronco esfregado', text: 'Lama seca esfregada no tronco até a altura do joelho, e um cheiro azedo, forte. Queixada marca o caminho assim.' },
];

// pistas extras do veado (Rastreador Experiente: 3 de 4)
export const CLUES = [
  { id: 'c_galho', at: [15, 113], text: 'Brotos de embaúba mordiscados na altura do peito de um veado. Corte limpo, de dente de baixo.' },
  { id: 'c_cama', at: [57, 81.6], text: 'Capim deitado em roda, ainda morno: o veado dormiu aqui, na beira da clareira, antes de o bando chegar.' },
  { id: 'c_lama', at: [83.4, 49.6], text: 'No barro do barreiro, a pegada fina do veado bem ao lado da pata larga da anta. Passaram pelo mesmo caminho.' },
  { id: 'c_fezes', at: [138, 114], text: 'Fezes de veado, frescas, em bolinhas. Ele parou aqui faz pouco tempo.' },
];

// esconderijos e elementos da clareira (B)
export const ROCKS_B = [[55, 86.5, 11], [61.5, 81.8, 9], [75.5, 84, 10], [79, 99, 10], [58.5, 101, 9]];
export const LOGS_B = [[64.5, 85.2, 56], [69.5, 103.2, 48], [81.5, 92, 40], [53, 97.5, 40]];
export const BUSHES_B = [[52.5, 93.5], [57.5, 83.8], [82.8, 87.5], [77.5, 80.8], [72.5, 101], [62.5, 104], [84.2, 84.2], [49.8, 88.5], [60, 95.8], [74.5, 93.2]];
export const DRY_ZONES = [[63.5, 80.4, 1.5], [55.5, 102.3, 1.4], [84, 95.8, 1.3], [26.5, 97.4, 1.2]];
export const HERD_ROUTE = [[66, 93], [73, 88], [64.5, 98.5], [60, 94.5]];
export const MIRANTE = { tree: [49.2, 85.4], at: [50.4, 87.2] };
export const VINE = { at: [52.4, 100.2], palm: [60, 103.4], land: [60.6, 102.2] };
export const STONE_PUSH = { at: [77, 82.5], land: [71.5, 88.5] };
export const PASSAGES = [
  { id: 'PN', at: [66, 77.5], gate: [64, 77.4, 4, 0.9], name: 'passagem do norte' },
  { id: 'PNE', at: [86.6, 79.6], gate: [84, 77.4, 5.6, 4.4], name: 'passagem das pedras' },
];

// puzzle dos troncos (C)
export const PUZ = {
  trunk: [104, 53.2], trunkLen: 66,
  rollTo: [100.1, 50.4],
  tangle: [97.6, 57.6], pole: [97.4, 58.2],
  rail: [[97.2, 60.6], [104, 60.6], [104, 55.4]],
  lever: [104, 56.6],
};
export const LOGS_C = [[84, 63.6, 64, 5], [93, 57.6, 54, 5], [82, 58.6, 40, 4], [96, 63.4, 40, 4]];
export const ROOTS_C = [[87.5, 60.2, 34], [90, 65.2, 30], [79.8, 61.8, 26]];
export const TAPIR_HOME = [80, 48.2];

// trilha da fuga (D)
export const CHASE = {
  hollow: [124.2, 53], trigger: [135.6, 51.4], cp2: [135, 77.2], fork: [135, 78.5],
  spawn2: [[136.6, 66], [136, 67.5], [137.2, 64.5], [135.6, 69], [136.4, 62.8]],
  top: [134, 104.2],
};
export const SLALOM_TREES = [[135.2, 54.4, 'mid'], [137.4, 56.8, 'mid'], [136.4, 59.6, 'big'], [137.9, 64.2, 'mid'], [135.6, 64.8, 'small'], [137.4, 69.8, 'mid']];
export const ROOTS_D = [[136.8, 53.4, 22], [135.4, 58.4, 24], [138.4, 61, 18], [136, 66.2, 22]];
export const TUCUM_D = [[139.9, 83.6], [140.2, 87.6], [138.6, 89.4], [139, 85.4]];

// rastro vermelho (E) e final
export const HAIR = [124.4, 111];
export const DEER_PRINTS_E = [118, 113.4];
export const MYSTERY = [27.6, 103];
export const FINAL_TREE = [103.6, 110.8];
export const EXIT = [101.2, 113.2];
export const RED_TRAIL = [[131, 107.6], [128.5, 108.8], [126, 110], [121.5, 111.6], [115, 113.3], [109.5, 113.6], [104.8, 113.2]];

export const PATTERNS = {
  forage: { name: 'Fuçam o chão juntos', text: 'Eles fuçam o chão quase grudados uns nos outros. Cabeça baixa: nessa hora enxergam pouco, mas escutam tudo.' },
  sentinel: { name: 'Sempre tem um vigia', text: 'Enquanto o bando come, um fica de cabeça erguida, virando de um lado pro outro. É ele quem dá o aviso.' },
  move: { name: 'Mudam de lugar juntos', text: 'De tempos em tempos o bando inteiro levanta e muda de canto da clareira, num caminho que se repete.' },
  clack: { name: 'Batem os dentes quando desconfiam', text: 'Quando estranham um barulho, param, levantam a cabeça e batem os dentes. O estalo passa o aviso para os outros.' },
};
