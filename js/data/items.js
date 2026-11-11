// Definições de itens
export const ITEMS = {
  paneiro: { name: 'Paneiro', type: 'equip', desc: 'Cesto trançado de fibra, levado nas costas. Serve de mochila: guarda até 12 tipos de coisa.' },
  espingarda: { name: 'Espingarda velha', type: 'equip', desc: 'De um cano só, herdada do pai. Segure Q (ou botão direito) para mirar.' },
  facao: { name: 'Facão', type: 'equip', desc: 'Ferramenta de todo dia: corta cipó, abre picada, limpa peixe.' },
  cantil: { name: 'Cantil', type: 'consumable', desc: 'Recupera energia. Encha em qualquer rio ou igarapé (E perto da água). Tecla 1.' },
  lanterna: { name: 'Lanterna', type: 'equip', desc: 'Acende e apaga com F. A bateria acaba: economize.' },
  marmita: { name: 'Marmita', type: 'consumable', desc: 'Peixe assado com farinha. Recupera vida e energia. Tecla 2.' },
  cartucho: { name: 'Cartuchos', type: 'material', desc: 'Poucos e caros. Um tiro faz barulho que espanta tudo num raio grande.' },
  fumo: { name: 'Fumo de rolo', type: 'key', desc: 'Presente de Seu Raimundo. "Pede licença quando entrar na mata."' },
  tabua: { name: 'Tábua', type: 'material', desc: 'Tábua de madeira boa para remendar a ponte.' },
  cipo: { name: 'Cipó-titica', type: 'material', desc: 'Cipó forte e flexível, usado para amarrar e trançar.' },
  galhos: { name: 'Feixe de galhos secos', type: 'material', desc: 'Lenha para a fogueira do acampamento.' },
  pilhas: { name: 'Pilhas', type: 'consumable', desc: 'Recarregam a lanterna. Tecla 3.' },
  caderno: { name: 'Caderno de rastros', type: 'key', desc: 'Onde Caetano anota os rastros que já sabe reconhecer.' },
  vara: { name: 'Vara de pau-ferro', type: 'material', desc: 'Uma vara grossa e muito dura. Com um bom apoio, vira alavanca.' },
  remo: { name: 'Remo de pau', type: 'key', desc: 'Remo velho achado num jirau de pesca abandonado. A pá está gasta, mas ainda empurra água.' },
  pelos: { name: 'Pelos avermelhados', type: 'key', desc: 'Tufo de pelos ruivos preso num espinho. Do veado-vermelho, sem dúvida.' },
  // achados (colecionáveis)
  caco: { name: 'Caco de cerâmica', type: 'collectible', desc: 'Fragmento de cerâmica com pintura vermelha. Cacos assim aparecem com frequência em áreas de terra preta, sinal de que povos antigos viveram aqui muito antes da comunidade.' },
  pena: { name: 'Pena de mutum', type: 'collectible', desc: 'Pena preta e lustrosa de mutum, ave grande que vive no chão da mata.' },
  anzol: { name: 'Anzol antigo', type: 'collectible', desc: 'Anzol de ferro, enferrujado, esquecido na canoa velha. Alguém pescou muito com ele.' },
  jarina: { name: 'Semente de jarina', type: 'collectible', desc: 'Semente duríssima de uma palmeira, chamada de "marfim vegetal" e usada para fazer biojoias.' },
  jabuti: { name: 'Casco de jabuti', type: 'collectible', desc: 'Casco vazio e limpo pelo tempo. O bicho morreu de velho, longe de tudo.' },
};

export const COLLECTIBLES = ['caco', 'pena', 'anzol', 'jarina', 'jabuti'];

export class Inventory {
  constructor(cap = 12) { this.cap = cap; this.items = new Map(); this.found = new Set(); }
  slotsUsed() { return this.items.size; }
  has(id, n = 1) { return (this.items.get(id) || 0) >= n; }
  count(id) { return this.items.get(id) || 0; }
  add(id, n = 1) {
    const def = ITEMS[id];
    if (def && def.type === 'collectible') { this.found.add(id); return true; }
    if (!this.items.has(id) && this.items.size >= this.cap) return false;
    this.items.set(id, (this.items.get(id) || 0) + n);
    return true;
  }
  remove(id, n = 1) {
    const c = (this.items.get(id) || 0) - n;
    if (c <= 0) this.items.delete(id); else this.items.set(id, c);
  }
  toJSON() { return { items: [...this.items], found: [...this.found] }; }
  load(d) { this.items = new Map(d?.items || []); this.found = new Set(d?.found || []); }
}
