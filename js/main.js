// Ponto de entrada
import { Game } from './engine/game.js';
import { createPhase1 } from './phases/phase1.js';
import { createPhase2 } from './phases/phase2.js';
import { createPhase3 } from './phases/phase3.js';

const game = new Game({ 1: createPhase1, 2: createPhase2, 3: createPhase3 });
window.__game = game;
game.boot().catch((e) => {
  console.error(e);
  const m = document.getElementById('lg-msg');
  if (m) m.textContent = 'Erro ao carregar: ' + e.message;
});
