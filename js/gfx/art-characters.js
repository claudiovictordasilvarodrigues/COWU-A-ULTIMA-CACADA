// Personagens humanos em pixel art procedural, 4 direções, 4 quadros de caminhada + agachado
import { PixBuf, flipCanvas } from './pixel.js';

const DARK = '#1b130d';

export const LOOKS = {
  caetano: {
    skin: '#b97a4e', skinD: '#8f5a36', hair: '#2a1a10', hat: 'straw',
    shirt: '#a5462e', shirtD: '#7c3320', shirtL: '#c45e40', plaid: true,
    pants: '#5a4a36', pantsD: '#43362a', boots: '#262222', pack: true, gun: true,
  },
  raimundo: {
    skin: '#a86d45', skinD: '#7f4f30', hair: '#e4e0d6', hat: 'none', beard: '#d8d4ca',
    shirt: '#d9d2bf', shirtD: '#b5ad98', shirtL: '#efe9da',
    pants: '#3f4a5a', pantsD: '#2f3845', boots: '#6b4a2e', stick: true,
  },
  socorro: {
    skin: '#9a6040', skinD: '#764528', hair: '#1a1210', hat: 'none', longHair: true,
    shirt: '#3f7a8a', shirtD: '#2e5c68', shirtL: '#5a96a6',
    pants: '#9a6040', pantsD: '#764528', skirt: '#8a3a5a', skirtD: '#6a2a44', boots: '#5a3a22',
  },
  ze: {
    skin: '#8a5434', skinD: '#683c22', hair: '#1a1210', hat: 'cap', cap: '#d0a42a', capD: '#9a7618',
    shirt: '#2f6f4f', shirtD: '#22533a', shirtL: '#3f8a63', sleeve: '#8a5434',
    pants: '#3a4f7a', pantsD: '#2a3a5c', boots: '#3a3a3a',
  },
};

export function humanSprite(L, dir, frame, crouch) {
  if (dir === 'left') return flipCanvas(humanSprite(L, 'right', frame, crouch));
  const b = new PixBuf(18, 27);
  const p = (x, y, w, h, c) => b.rect(x + 1, y + 2, w, h, c);
  const step = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  const cy = crouch ? 3 : 0, bob = step !== 0 && !crouch ? 1 : 0, U = cy + bob;
  const lt = 17 + cy;
  const side = dir === 'right', up = dir === 'up', down = dir === 'down';
  const pack = '#8a6a3a', packD = '#6e522a';
  const weave = (x0, y0, w, h) => {
    p(x0, y0, w, h, pack);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x + y) % 2 === 0) p(x0 + x, y0 + y, 1, 1, packD);
    p(x0, y0, w, 1, '#5e4422');
  };

  // mochila (paneiro) atrás no perfil
  if (side && L.pack) { weave(2, 10 + U, 3, 8); }
  if (side && L.gun) p(3, 2 + U, 1, 9, '#3b3b40');

  // pernas
  if (!side) {
    if (crouch) {
      p(4, lt, 3, 22 - lt, L.pants); p(9, lt, 3, 22 - lt, L.pants);
      p(4, 22, 3, 2, L.boots); p(9, 22, 3, 2, L.boots);
    } else {
      const lL = step === 1 ? 1 : 0, rL = step === -1 ? 1 : 0;
      p(5, lt, 3, 22 - lt - lL, L.pants); p(7, lt, 1, 22 - lt - lL, L.pantsD); p(5, 22 - lL, 3, 2, L.boots);
      p(8, lt, 3, 22 - lt - rL, L.pants); p(10, lt, 1, 22 - lt - rL, L.pantsD); p(8, 22 - rL, 3, 2, L.boots);
    }
  } else {
    if (crouch) { p(5, lt, 6, 22 - lt, L.pants); p(4, 22, 4, 2, L.boots); p(9, 22, 3, 2, L.boots); }
    else if (step === 0) { p(6, lt, 4, 22 - lt, L.pants); p(9, lt, 1, 22 - lt, L.pantsD); p(6, 22, 5, 2, L.boots); }
    else {
      const fc = step === 1 ? L.pants : L.pantsD, bc = step === 1 ? L.pantsD : L.pants;
      p(5, lt, 2, 22 - lt, bc); p(4, 22, 3, 2, L.boots);
      p(8, lt, 2, 22 - lt, fc); p(9, 22, 3, 2, L.boots);
    }
  }

  // tronco
  const tx = side ? 5 : 4, tw = side ? 6 : 8;
  p(tx, 11 + U, tw, 6, L.shirt);
  if (!side) { p(4, 11 + U, 1, 6, L.shirtL); p(11, 11 + U, 1, 6, L.shirtD); }
  else p(10, 11 + U, 1, 6, L.shirtD);
  if (L.plaid) { p(tx, 13 + U, tw, 1, L.shirtD); p(tx + (side ? 2 : 3), 11 + U, 1, 6, L.shirtD); p(tx, 15 + U, tw, 1, L.shirtL); }
  if (L.skirt) {
    p(3, 16 + U, 10, 3, L.skirt); p(2, 19 + U, 12, 2, L.skirt); p(2, 20 + U, 12, 1, L.skirtD);
  } else p(tx, 17 + U, tw, 1, '#3a2618');
  if (!L.skirt && down) p(7, 17 + U, 2, 1, '#c9a54a');

  // alças da mochila e bandoleira (frente)
  if (down && L.pack) { p(5, 11 + U, 1, 6, packD); p(10, 11 + U, 1, 6, packD); }
  if (down && L.gun) { for (let i = 0; i < 6; i++) p(11 - i, 11 + U + i, 1, 1, '#4a3020'); p(2, 5 + U, 1, 6, '#3b3b40'); }

  // braços
  const sleeve = L.sleeve || L.shirtD;
  if (!side) {
    const aL = step === -1 ? 1 : 0, aR = step === 1 ? 1 : 0;
    p(2, 11 + U, 2, 5 + aL, sleeve); p(2, 16 + U + aL, 2, 1, L.skin);
    p(12, 11 + U, 2, 5 + aR, sleeve); p(12, 16 + U + aR, 2, 1, L.skin);
  }

  // costas: paneiro trançado e espingarda
  if (up && L.pack) weave(4, 10 + U, 8, 8);
  if (up && L.gun) { p(12, 3 + U, 1, 9, '#3b3b40'); p(12, 12 + U, 2, 3, '#6a4022'); }

  if (side) {
    const s = step;
    p(7 + s, 11 + U, 2, 5, sleeve); p(7 + s * 2, 16 + U, 2, 1, L.skin);
  }

  // cabeça
  if (down) {
    p(5, 4 + U, 6, 6, L.skin); p(10, 4 + U, 1, 6, L.skinD); p(6, 10 + U, 4, 1, L.skinD);
    p(6, 7 + U, 1, 1, DARK); p(9, 7 + U, 1, 1, DARK); p(7, 9 + U, 2, 1, L.skinD);
    if (L.beard) { p(5, 8 + U, 6, 2, L.beard); p(7, 9 + U, 2, 1, L.skinD); }
    p(5, 4 + U, 1, 2, L.hair); p(10, 4 + U, 1, 2, L.hair);
    if (L.longHair) { p(4, 4 + U, 1, 7, L.hair); p(11, 4 + U, 1, 7, L.hair); }
  } else if (up) {
    p(5, 4 + U, 6, 6, L.hair); p(6, 10 + U, 4, 1, L.skinD);
    if (L.longHair) p(4, 4 + U, 8, 9, L.hair);
  } else {
    p(5, 4 + U, 6, 6, L.skin); p(5, 4 + U, 3, 4, L.hair);
    p(9, 7 + U, 1, 1, DARK); p(11, 7 + U, 1, 2, L.skin); p(9, 9 + U, 2, 1, L.skinD);
    p(7, 6 + U, 1, 2, L.skinD); p(6, 10 + U, 4, 1, L.skinD);
    if (L.beard) p(8, 8 + U, 4, 2, L.beard);
    if (L.longHair) p(4, 4 + U, 3, 8, L.hair);
  }

  // chapéu / boné / cabelo
  if (L.hat === 'straw') {
    p(2, 3 + U, 12, 2, '#d9b66a'); p(2, 4 + U, 12, 1, '#b8934a');
    p(4, 0 + U, side ? 7 : 8, 3, '#e2c27a'); p(4, 2 + U, side ? 7 : 8, 1, '#6a3a22');
    p(5, 0 + U, 2, 1, '#f0d690');
  } else if (L.hat === 'cap') {
    p(5, 2 + U, 6, 3, L.cap);
    if (down) p(5, 4 + U, 6, 1, L.capD);
    if (side) p(10, 4 + U, 3, 1, L.capD);
  } else {
    p(5, 3 + U, 6, 2, L.hair);
    if (L.longHair) p(6, 1 + U, 4, 2, L.hair);
  }

  if (L.stick) {
    const x = down ? 14 : side ? 11 : 1;
    p(x, 12 + U, 1, 24 - (12 + U), '#7a5a3a');
  }

  b.outline(DARK);
  return b.toCanvas();
}

// retrato ampliado para a caixa de diálogo
export function portrait(L) {
  return humanSprite(L, 'down', 0, false);
}
