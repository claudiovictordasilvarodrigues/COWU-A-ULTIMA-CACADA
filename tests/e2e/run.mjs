// Testes de ponta a ponta no navegador (Playwright + Chrome/Chromium).
// Uso:  node tests/e2e/run.mjs            (precisa do pacote "playwright" instalado)
//       CHROME_PATH=/caminho/do/chrome node tests/e2e/run.mjs
// O script sobe um servidor estático próprio, abre o jogo e joga roteiros reais.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

let pw;
try { pw = await import('playwright'); }
catch {
  try { pw = await import(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright/index.mjs'); }
  catch { console.log('Playwright não encontrado. Instale com "npm i -D playwright" (ou defina PLAYWRIGHT_PATH). Testes de navegador NÃO executados.'); process.exit(2); }
}

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const URL0 = `http://localhost:${server.address().port}/index.html`;
const harness = fs.readFileSync(path.join(ROOT, 'tests/e2e/harness.js'), 'utf8');

const launch = { headless: true };
if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
else if (fs.existsSync('/usr/bin/google-chrome')) launch.executablePath = '/usr/bin/google-chrome';
const browser = await pw.chromium.launch(launch);
const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource|fonts\.g/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));

const results = [];
let current = '';
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
async function test(name, fn) {
  current = name; const t0 = Date.now();
  try { await fn(); results.push([true, name, Date.now() - t0]); console.log(`  ✓ ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`); }
  catch (e) { results.push([false, name, e.message]); console.log(`  ✗ ${name}\n      ${e.message}`); await page.screenshot({ path: path.join(ROOT, `tests/e2e/falha-${results.length}.png`) }).catch(() => {}); }
}
const E = (fn, arg) => page.evaluate(fn, arg);
async function open(clear = false) {
  if (clear) { await page.goto(URL0); await E(() => localStorage.clear()); }
  await page.goto(URL0);
  await page.waitForFunction(() => window.__game && window.__game.state === 'menu', null, { timeout: 60000 });
  await page.addScriptTag({ content: harness });
}
const waitState = (st, ms = 60000) => page.waitForFunction((s) => window.__game && window.__game.state === s && window.__game.player, st, { timeout: ms });
const st = () => E(() => __T.state());

console.log('A Última Caçada — testes de navegador');

// ---------------------------------------------------------------- Fase 1
await test('Fase 1: abre o menu sem erros e sem a Fase 2 liberada', async () => {
  await open(true);
  ok(await E(() => document.getElementById('btn-phases').hidden), 'botão Fases deveria estar oculto');
  ok(await E(() => __game.phase.id === 1), 'menu deveria abrir na Fase 1');
});
await test('Fase 1: nova expedição, equipamentos e conversa com Seu Raimundo', async () => {
  await E(() => { __game.newGame(1); });
  await E(() => __T.ff(30, { until: () => __game.state === 'play' }));
  ok(await E(() => __game.phase.title === 'A PRIMEIRA PEGADA' && __game.phase.missions.length === 8), 'fase 1 com 8 missões');
  for (let i = 0; i < 6; i++) await E(() => __T.interact('Pegar', 3, 400));
  ok(await E(() => __game.done.has('prep')), 'missão prep não concluída');
  await E(() => __T.ff(6, { until: () => __game.state === 'play' && !__game.ui.dlg }));
  await E(() => __T.interact('Perguntar sobre o veado', 20, 600));
  ok(await E(() => __game.done.has('talk')), 'missão talk não concluída');
});
await test('Fase 1: movimento e colisão (não atravessa a casa)', async () => {
  // parte da porta de casa e anda para o norte, contra a parede da palafita
  await E(() => { const p = __game.player, s = __game.phase.spawn; p.x = s.x; p.y = s.y; });
  const before = await st();
  await E(() => __T.ff(2.5, { ctrl: () => __T.keys(['up']) }));
  await E(() => __T.keys([]));
  const after = await st();
  ok(after.y < before.y, 'jogador deveria ter andado para o norte');
  ok(before.y - after.y < 2.2, 'jogador atravessou a casa');
  ok(await E(() => { const p = __game.player; return !__game.world.hit(p.x, p.y, p.r - 1); }), 'jogador está dentro de um colisor');
});
await test('Fase 1: salvamento persiste após recarregar a página', async () => {
  await open(false);
  ok(await E(() => !document.getElementById('btn-continue').hidden), 'botão Continuar deveria aparecer');
  await E(() => __game.continueGame());
  await waitState('play');
  const s = await st();
  ok(s.done.includes('prep') && s.done.includes('talk'), 'missões salvas não foram restauradas');
});
await test('Fase 1: conclusão libera a Fase 2 (sem pular etapas da Fase 1)', async () => {
  await E(() => __game.phase.completePhase());
  await page.waitForTimeout(300);
  ok(await E(() => __game.state === 'results'), 'tela de resultados');
  ok(await E(() => !document.getElementById('btn-next').hidden && document.getElementById('btn-next').textContent.includes('Fase 2')), 'botão Jogar a Fase 2');
  ok(await E(() => JSON.parse(localStorage.getItem('ultimaCacada.progress.v1')).unlocked.includes(2)), 'fase 2 não desbloqueada');
});

// ---------------------------------------------------------------- Fase 2
await test('Fase 2: inicia pelo botão dos resultados, com o paneiro da Fase 1', async () => {
  await page.click('#btn-next');
  await page.waitForFunction(() => __game.phase && __game.phase.id === 2 && __game.player, null, { timeout: 60000 });
  await E(() => __T.ff(30, { until: () => __game.state === 'play' }));
  const s = await E(() => ({ st: __game.state, title: document.getElementById('ph-title').textContent, inv: ['paneiro', 'espingarda', 'facao', 'cantil', 'lanterna', 'marmita'].every((i) => __game.inv.has(i)), m: __game.phase.missions.length, s2: __game.phase.secondary.length, t: __game.timeLeft }));
  ok(s.st === 'play', 'estado ' + s.st);
  ok(s.title === 'O CAMINHO DOS QUEIXADAS', 'título do painel');
  ok(s.inv, 'equipamentos não vieram da Fase 1');
  ok(s.m === 8 && s.s2 === 3, '8 missões principais e 3 secundárias');
  ok(Math.round(s.t) === 2400, 'cronômetro de 40 minutos');
});
await test('Fase 2: cronômetro anda durante o jogo e para na pausa', async () => {
  const t0 = await E(() => __game.timeLeft);
  await E(() => __T.ff(3));
  const t1 = await E(() => __game.timeLeft);
  ok(t0 - t1 > 2.5, 'cronômetro não andou');
  const t2 = await E(() => { __game.openOverlay('pause'); const a = __game.timeLeft; for (let i = 0; i < 60; i++) __game.update(1 / 30); const b = __game.timeLeft; __game.resume(); return [a, b]; });
  ok(Math.abs(t2[0] - t2[1]) < 0.001, 'cronômetro andou durante a pausa');
});
await test('Missão 1: examinar dois sinais diferentes', async () => {
  await E(() => __T.walk([[19, 101.5]]));
  await E(() => __T.interact('Examinar o sinal'));
  ok(!(await E(() => __game.done.has('m1'))), 'm1 não deveria concluir com 1 sinal');
  await E(() => __T.walk([[25, 100]]));
  await E(() => __T.interact('Examinar o sinal'));
  ok(await E(() => __game.done.has('m1')), 'm1 não concluiu');
});
await test('Bando atravessa a trilha (cena) e se junta à clareira', async () => {
  await E(() => __T.walk([[28, 99], [33, 97]], { until: () => __game.state === 'cutscene' }));
  await E(() => __T.ff(40, { until: () => __game.state === 'play' && !__game.phase.herdCol }));
  ok(await E(() => __game.phase.herdB.members.length === 12), 'bando deveria ter 12 animais');
});
await test('Missão 2: observar do mirante', async () => {
  await E(() => __T.walk([[40, 93], [46, 90.5], [50.4, 88]], { sneak: true }));
  await E(() => __T.interact('Observar o bando', 15));
  ok(await E(() => __game.done.has('m2')), 'm2 não concluiu');
});
await test('Missão 3: identificar três padrões observando escondido', async () => {
  await E(() => __T.ff(200, { until: () => __game.done.has('m3') }));
  ok(await E(() => __game.done.has('m3')), 'm3 não concluiu: ' + JSON.stringify(await E(() => Object.keys(__game.flags).filter((k) => k.startsWith('pat_')))));
});
await test('Salvamento no meio da Fase 2 persiste após recarregar', async () => {
  await open(false);
  await E(() => __game.continueGame());
  await page.waitForFunction(() => __game.phase && __game.phase.id === 2 && __game.state === 'play', null, { timeout: 60000 });
  const s = await st();
  ok(['m1', 'm2', 'm3'].every((m) => s.done.includes(m)), 'missões não restauradas: ' + s.done);
  ok(await E(() => __game.phase.herdB.members.length === 12), 'bando não restaurado');
});
await test('IA: ser visto em pé perto do bando dispara o alerta e fecha a passagem', async () => {
  await E(() => __T.tp(50.4, 88.6));
  const anchor = await E(() => [__game.phase.herdB.anchor.x / 16, __game.phase.herdB.anchor.y / 16]);
  await E((a) => __T.walk([[a[0] - 3, a[1]]], { max: 30, until: () => __game.phase.dirty }), anchor);
  ok(await E(() => __game.phase.dirty), 'bando deveria ter percebido o jogador');
  ok(await E(() => !document.getElementById('alertbar').hidden && document.getElementById('alertbar').textContent.includes('ALERTA')), 'aviso de alerta não apareceu');
  ok(await E(() => __game.phase.gateClosed()), 'passagem deveria fechar com o bando em alerta');
  ok(await E(() => __game.phase.herdB.members.some((m) => m.state === 'DEFENSIVE' || m.state === 'CHASE')), 'nenhum animal em DEFENSIVE/CHASE');
});
await test('IA: o bando desiste ao perder o jogador e a travessia pode ser tentada de novo', async () => {
  await E(() => __game.player.hp = 100);
  await E(() => __T.walk([[47, 91], [36, 95.5], [30, 98.6]], { run: true, max: 40 }));
  const calm = await E(() => __T.ff(60, { until: () => !__game.phase.dirty && __game.phase.herdB.mode === 'calm' }));
  ok(calm, 'bando não se acalmou');
  ok(await E(() => !__game.phase.gateClosed()), 'passagem deveria reabrir');
  ok(await E(() => __game.state === 'play'), 'jogador deveria ter escapado');
});
await test('Missão 4: distração (cipó) e travessia agachada até a passagem', async () => {
  await E(() => { __game.player.hp = 100; });
  await E(() => __T.walk([[46, 91], [50.4, 92], [51.5, 98], [52.4, 100.4]], { sneak: true, max: 60 }));
  await E(() => __T.interact('Sacudir o cipó'));
  await E(() => __T.ff(3));
  const ok4 = await E(() => __T.walk([[51.5, 96], [51, 90], [53, 85.6], [57, 83.4], [59.5, 83.7], [63, 83.6], [65.3, 81.8], [66, 79.5], [66, 77.4]], { sneak: true, max: 120, until: () => __game.done.has('m4') || __game.phase.dirty }));
  if (!(await E(() => __game.done.has('m4')))) {
    // se o bando percebeu, foge, espera e tenta de novo (como o jogador faria)
    await E(() => __T.walk([[50, 88], [40, 93]], { run: true, max: 40 }));
    await E(() => __T.ff(60, { until: () => !__game.phase.dirty && __game.phase.herdB.mode === 'calm' }));
    await E(() => __T.walk([[50, 88], [53, 85.6], [57, 83.4], [63, 83.6], [65.3, 81.8], [66, 77.4]], { sneak: true, max: 120, until: () => __game.done.has('m4') }));
  }
  void ok4;
  ok(await E(() => __game.done.has('m4')), 'm4 não concluiu');
});
await test('Missão 5: puzzle (galhos, vara, toro empurrado, alavanca)', async () => {
  await E(() => __T.walk([[66, 74], [77, 65], [92, 61], [97.6, 59.4]], { max: 80 }));
  await E(() => __T.interact('Cortar o emaranhado'));
  await E(() => __T.interact('Pegar a vara'));
  ok(await E(() => __game.inv.has('vara')), 'vara não pega');
  await E(() => __T.walk([[95.6, 60.6]]));
  await E(() => __T.ff(8, { ctrl: () => __T.keys(['right']), until: () => __game.flags.toroS >= 6.8 * 16 - 1 }));
  await E(() => __T.walk([[104, 62.4]]));
  await E(() => __T.ff(10, { ctrl: () => __T.keys(['up']), until: () => __game.flags.toroPlaced }));
  await E(() => __T.keys([]));
  ok(await E(() => __game.flags.toroPlaced), 'toro não encaixou');
  await E(() => __T.interact('alavanca', 15));
  ok(await E(() => __game.done.has('m5') && __game.phase.trunkCol.off), 'm5 não concluiu');
});
await test('Missão 6: a grande perseguição (fuga real, com IA perseguindo)', async () => {
  await E(() => __T.walk([[104, 50], [110, 44], [122, 41], [128, 43], [133, 47]], { max: 80 }));
  await E(() => __T.walk([[135.6, 51.4]], { max: 20, until: () => __game.state === 'cutscene' }));
  await E(() => __T.ff(10, { until: () => __game.state === 'play' }));
  ok(await E(() => __game.flags.chaseStarted), 'perseguição não começou');
  await E(() => __T.ff(1.5));
  ok(await E(() => __game.phase.herdD.members.filter((m) => m.state === 'CHASE').length >= 3), 'o bando não avançou');
  ok(await E(() => document.getElementById('alertbar').textContent.includes('CORRA')), 'aviso CORRA não apareceu');
  const route = [[136, 53], [136.4, 56.4], [137.2, 61], [136.4, 67], [135, 72], [135, 77], [130, 81], [127.5, 86], [130, 91], [134, 94], [134, 98], [134, 102.5]];
  await E((r) => __T.walk(r, { run: true, max: 60, until: () => __game.done.has('m6') || __game.state === 'fail' }), route);
  const s = await st();
  ok(s.st !== 'fail', 'Caetano desmaiou na fuga');
  ok(s.done.includes('m6'), 'm6 não concluiu');
  await E(() => __T.ff(6));
  ok(await E(() => __game.phase.herdD.members.every((m) => m.state !== 'CHASE')), 'o bando não abandonou a perseguição no lajedo');
});
await test('Falha e recuperação: desmaiar volta ao checkpoint', async () => {
  await E(() => { __game.player.hp = 0; });
  await E(() => __T.ff(0.2));
  ok(await E(() => __game.state === 'fail'), 'tela de falha não apareceu');
  await page.click('#scr-fail [data-act-ui="checkpoint"]');
  await waitState('play');
  const s = await st();
  ok(s.hp === 100 && s.done.includes('m6'), 'checkpoint não restaurado');
  ok(Math.round(await E(() => __game.timeLeft)) === 2400, 'regra de falha da Fase 1: cronômetro volta a 40:00');
});
await test('Secundária: Observador da Floresta (anta) é opcional e concluível', async () => {
  ok(!(await E(() => __game.done.has('s_anta'))), 'já concluída?');
  await E(() => __T.tp(84.5, 53.8));
  await E(() => { __game.player.sneak = true; __game.wind.base = 0.9; });
  await E(() => __T.ff(1));
  await E(() => __T.interact('Observar a anta', 15, 400, false));
  ok(await E(() => __game.done.has('s_anta')), 'observação da anta não concluiu: ' + await E(() => __game.phase.tapir.aware));
});
await test('Missões 7 e 8: rastro vermelho, cena final, Fase 2 concluída e Fase 3 liberada', async () => {
  await E(() => __T.tp(127, 105.5));
  await E(() => __T.walk([[124.4, 110.3]], { max: 30 }));
  await E(() => __T.interact('pelos'));
  await E(() => __T.interact('pegadas do veado'));
  ok(await E(() => __game.done.has('m7')), 'm7 não concluiu');
  await E(() => __T.walk([[118, 112.5], [106, 113], [102, 113.2]], { max: 60, until: () => __game.state === 'cutscene' }));
  await E(() => __T.ff(40, { until: () => __game.state === 'results' }));
  const r = await E(() => ({ st: __game.state, code: document.getElementById('r-code').textContent, next: document.getElementById('r-next').textContent, btn: document.getElementById('btn-next').hidden, btxt: document.getElementById('btn-next').textContent, prog: JSON.parse(localStorage.getItem('ultimaCacada.progress.v1')) }));
  ok(r.st === 'results', 'resultados não apareceram');
  ok(r.code === 'FASE 2 CONCLUÍDA', 'código ' + r.code);
  ok(r.next.includes('Os Segredos da Várzea'), 'próxima fase ' + r.next);
  ok(!r.btn && r.btxt.includes('Fase 3'), 'botão para jogar a Fase 3');
  ok(r.prog.completed[2] && r.prog.unlocked.includes(3), 'progresso não salvo');
});

// ---------------------------------------------------------------- Fase 3
const P3 = (x, y) => [x * 16, y * 16];
await test('Fase 3: inicia pelo botão dos resultados, com o paneiro e 9 missões', async () => {
  await page.click('#btn-next');
  await page.waitForFunction(() => __game.phase && __game.phase.id === 3 && __game.player, null, { timeout: 60000 });
  await E(() => __T.ff(30, { until: () => __game.state === 'play' }));
  const s = await E(() => ({ st: __game.state, title: document.getElementById('ph-title').textContent, inv: ['paneiro', 'espingarda', 'facao', 'cantil', 'lanterna', 'marmita', 'pelos'].every((i) => __game.inv.has(i)), m: __game.phase.missions.length, s2: __game.phase.secondary.length, t: __game.timeLeft }));
  ok(s.st === 'play', 'estado ' + s.st);
  ok(s.title === 'OS SEGREDOS DA VÁRZEA', 'título do painel');
  ok(s.inv, 'equipamentos não vieram da Fase 2');
  ok(s.m === 9 && s.s2 === 3, '9 missões principais e 3 secundárias');
  ok(Math.round(s.t) === 2400, 'cronômetro de 40 minutos');
});
await test('Fase 3: cronômetro anda e para na pausa', async () => {
  const t0 = await E(() => __game.timeLeft);
  await E(() => __T.ff(2));
  ok(t0 - (await E(() => __game.timeLeft)) > 1.5, 'cronômetro não andou');
  const t2 = await E(() => { __game.openOverlay('pause'); const a = __game.timeLeft; for (let i = 0; i < 60; i++) __game.update(1 / 30); const b = __game.timeLeft; __game.resume(); return [a, b]; });
  ok(Math.abs(t2[0] - t2[1]) < 0.001, 'cronômetro andou na pausa');
});
await test('Missão 1 (várzea): igarapé raso, lama que segura o passo, marcas de bicho', async () => {
  await E(() => __T.walk([[12, 65]]));
  const sp = await E(() => { const p = __game.player; p.x = 12.6 * 16; p.y = 64.9 * 16; __T.keys(['right']); __game.update(1 / 30); for (let i = 0; i < 20; i++) __game.update(1 / 30); const v = Math.hypot(p.vx, p.vy); __T.keys([]); return [v, p.speedMul]; });
  ok(sp[0] < 40, 'o barro não segurou o passo: ' + sp[0].toFixed(1));
  await E(() => __T.interact('trecho de lama'));
  await E(() => __T.walk([[17.4, 65.6], [21.6, 65.4]]));
  await E(() => __T.interact('Examinar as marcas'));
  ok(await E(() => __game.done.has('m1')), 'm1: ' + JSON.stringify(await st()));
  ok(await E(() => __game.phase.prints.length > 0), 'sem pegadas de bota no barro');
});
await test('Missão 2: pegada da anta, seguir a trilha, observar de longe', async () => {
  await E(() => __T.walk([[30, 61.2], [40, 57], [41, 56.6]]));
  await E(() => __T.interact('pegada grande'));
  await E(() => __T.walk([[44, 55], [47, 52], [50, 49], [52.8, 48.6]], { sneak: true }));
  await E(() => { __game.player.sneak = true; __game.wind.base = 3.6; });
  await E(() => __T.ff(25, { until: () => __game.phase.tapir.calm() && __game.phase.tapir.aware < 0.3 && __game.phase.tapir.visible }));
  await E(() => __T.interact('Observar a anta', 15, 400, false));
  ok(await E(() => __game.done.has('m2')), 'm2 não concluiu: anta ' + (await E(() => [__game.phase.tapir.state, __game.phase.tapir.aware.toFixed(2)])));
});
await test('IA da anta: ao chegar perto, desconfia (farejar/alerta) antes de fugir', async () => {
  const seen = await E(async () => { const s = new Set(); const tp = __game.phase.tapir; await __T.walk([[55, 46.6]], { max: 20, until: () => { s.add(tp.state); return tp.state === 'FUGIR'; } }); await __T.ff(3, { until: () => { s.add(tp.state); return false; } }); return [...s]; });
  ok(seen.some((x) => x === 'FAREJAR' || x === 'ALERTA'), 'sem reação gradual: ' + seen);
});
await test('Missão 3: atravessar pelo desvio do aningal (ou pela garganta livre)', async () => {
  await E(() => { __game.player.hp = 100; });
  await E(() => __T.walk([[50.6, 49.8]]));
  await E(() => __T.interact('aningal', 6));
  ok(await E(() => __game.flags.detourCut), 'aningal não foi aberto');
  await E(() => __T.walk([[51.6, 51], [55.5, 52.2], [59, 50.8], [61.4, 48.2], [62.6, 45.6], [62.5, 42.8], [66.8, 41.4]], { max: 120, until: () => __game.done.has('m3') }));
  ok(await E(() => __game.done.has('m3')), 'm3 não concluiu: ' + JSON.stringify(await st()));
});
await test('Salvamento no meio da Fase 3 persiste após recarregar', async () => {
  await open(false);
  await E(() => __game.continueGame());
  await page.waitForFunction(() => __game.phase && __game.phase.id === 3 && __game.state === 'play', null, { timeout: 60000 });
  const s = await st();
  ok(['m1', 'm2', 'm3'].every((m) => s.done.includes(m)), 'missões não restauradas: ' + s.done);
  ok(s.x > 60, 'posição do checkpoint não restaurada');
});
await test('Missão 4: lago, capivaras e a canoa abandonada', async () => {
  await E(() => __T.walk([[69, 41], [72, 42.4], [73.6, 47.6]]));
  await E(() => __T.walk([[75.6, 52.4], [77.4, 54.2]], { sneak: true, until: () => __game.flags.m4_group }));
  ok(await E(() => __game.flags.m4_group && __game.flags.m4_shore), 'grupo/margem');
  await E(() => __T.walk([[73.4, 46], [74.2, 43.4]]));
  await E(() => __T.interact('canoa abandonada'));
  ok(await E(() => __game.done.has('m4')), 'm4 não concluiu');
});
await test('IA das capivaras: correr perto assusta o grupo, que vai para a água', async () => {
  await E(() => __T.walk([[75.6, 52.4], [79, 55.2]], { run: true, max: 30, until: () => __game.phase.capys.mode === 'flee' }));
  ok(await E(() => __game.phase.capys.mode === 'flee'), 'o grupo não se assustou');
  await E(() => __T.ff(8));
  ok(await E(() => __game.phase.capys.members.filter((m) => m.sub > 0.6).length >= 4), 'não entraram na água');
});
await test('Missão 5: remo no jirau, cipós, galho, empurrar a canoa e embarcar', async () => {
  const w5 = await E(() => __T.walk([[73.4, 47], [72, 42.4], [70.6, 39]]));
  ok(w5.ok, 'não chegou ao jirau: ' + JSON.stringify([w5, await st(), await E(() => [__T.route(74.6 * 16, 46 * 16)?.length, __game.state, __game.ui.dlg && __game.ui.dlg.text])]));
  await E(() => __T.interact('remo'));
  await E(() => __T.walk([[72, 42.4], [74.4, 43.2]]));
  await E(() => __T.interact('cipós'));
  await E(() => __T.interact('galho'));
  ok(await E(() => __game.flags.vines && __game.flags.branch && __game.inv.has('remo')), 'preparação da canoa');
  await E(() => { const c = __game.phase.canoe, ph = __game.phase, a = Math.atan2(ph.railB.y - ph.railA.y, ph.railB.x - ph.railA.x); __T.tp((c.x - Math.cos(a) * 20) / 16, (c.y - Math.sin(a) * 20) / 16); });
  await E(() => __T.ff(12, { ctrl: () => __T.keys(['right', 'down']), until: () => __game.flags.launched }));
  await E(() => __T.keys([]));
  ok(await E(() => __game.flags.launched), 'a canoa não foi empurrada para a água');
  await E(() => __T.ff(1.2));
  await E(() => __T.interact('Embarcar', 4, 80));
  ok(await E(() => __game.done.has('m5') && __game.phase.boarded()), 'embarque');
  ok(await E(() => !document.getElementById('navhud').hidden), 'painel da canoa não apareceu');
});
await test('Missão 6: remar pelo igarapé (troncos, correnteza, passagem entre as árvores)', async () => {
  await E(() => __T.paddle([[81.5 * 16, 47.2 * 16], [86 * 16, 46.4 * 16], [89.4 * 16, 45.2 * 16]], { max: 40 }));
  const sPass = await E(() => __game.phase.main.project(42.4 * 16 * 3.33, 48.2 * 16).s);
  void sPass;
  await E(() => __T.paddle(__T.channelPath(0, __game.phase.main.project(142.4 * 16, 48.6 * 16).s + 10), { max: 220, until: () => __game.done.has('m6') }));
  const s = await E(() => ({ done: __game.done.has('m6'), f: ['m6_learn', 'm6_logs', 'm6_current'].map((k) => !!__game.flags[k]), hits: __game.phase.canoe.hits, cp: __T.state() }));
  ok(s.done, 'm6 não concluiu: ' + JSON.stringify(s));
});
await test('Evento da sombra: virar a canoa falha e o checkpoint recomeça antes da lagoa', async () => {
  const sEnd = await E(() => __game.phase.main.len);
  await E((L) => __T.paddle(__T.channelPath(__game.phase.main.project(__game.player.x, __game.player.y).s, L), { max: 60, until: () => __game.phase.ev && __game.phase.ev.stage === 'shadow' }), sEnd);
  ok(await E(() => __game.flags.m7_waves), 'ondas contra a correnteza não foram vistas');
  await E(() => __T.paddle([[135.6 * 16, 62.6 * 16], [133 * 16, 63.6 * 16]], { max: 30, slow: () => true, until: () => __game.phase.ev.stage === 'strike' }));
  await E(() => __T.ff(10, { until: () => __game.phase.ev.stage === 'strike' }));
  ok(await E(() => __game.phase.ev.stage === 'strike'), 'o golpe na água não aconteceu');
  await E(() => { __game.phase.instab = 99.5; });
  await E(() => __T.ff(2, { until: () => __game.state === 'fail' }));
  ok(await E(() => __game.state === 'fail'), 'a canoa deveria ter virado');
  await page.click('#scr-fail [data-act-ui="checkpoint"]');
  await waitState('play');
  ok(await E(() => __game.phase.boarded() && !__game.flags.m7_escape), 'não voltou para a canoa antes do evento');
});
await test('Missão 7: frear na água revolta, chegar à margem segura e examinar a marca', async () => {
  const L = await E(() => __game.phase.main.len);
  await E((Lx) => __T.paddle(__T.channelPath(__game.phase.main.project(__game.player.x, __game.player.y).s, Lx), { max: 60, until: () => __game.phase.ev && __game.phase.ev.stage === 'shadow' }), L);
  await E(() => __T.paddle([[135.6 * 16, 62.6 * 16], [133 * 16, 63.6 * 16], [130 * 16, 64.6 * 16], [127.2 * 16, 65.6 * 16], [125.6 * 16, 66.1 * 16]], { max: 60, slow: () => __game.phase.ev && __game.phase.ev.stage === 'shadow', until: () => __game.flags.m7_escape }));
  await E(() => __T.ff(10, { until: () => __game.state === 'play' && !__game.ui.dlg }));
  ok(await E(() => __game.flags.m7_escape && !__game.phase.boarded()), 'não escapou para a margem: ' + JSON.stringify(await E(() => [__game.phase.ev, __game.phase.instab, __T.state()])));
  await E(() => __T.interact('meio submersa', 20, 200));
  ok(await E(() => __game.done.has('m7')), 'm7 não concluiu');
  ok(await E(() => __game.flags.rainOn), 'a chuva não começou');
});
await test('Missões 8 e 9: rastro na chuva, tapiri, Fase 3 concluída e Fase 4 só desbloqueada', async () => {
  await E(() => __T.walk([[122.6, 67.8]]));
  await E(() => __T.interact('pegadas no barro'));
  await E(() => __T.walk([[119, 69.4]]));
  await E(() => __T.interact('pelos presos'));
  await E(() => __T.walk([[115.6, 71.2]]));
  await E(() => { __T.choiceIdx = 1; });
  await E(() => __T.interact('galhos quebrados'));
  await E(() => { __T.choiceIdx = 0; });
  ok(await E(() => __game.done.has('m8')), 'm8 não concluiu');
  await E(() => __T.walk([[113, 73], [109.6, 74.8]], { max: 40, until: () => __game.state === 'cutscene' }));
  await E(() => __T.ff(60, { until: () => __game.state === 'results' }));
  const r = await E(() => ({ st: __game.state, code: document.getElementById('r-code').textContent, next: document.getElementById('r-next').textContent, btn: document.getElementById('btn-next').hidden, prog: JSON.parse(localStorage.getItem('ultimaCacada.progress.v1')), has4: __game.hasPhase(4) }));
  ok(r.st === 'results' && r.code === 'FASE 3 CONCLUÍDA', 'resultados: ' + r.code);
  ok(r.next.includes('Os Assobios de Matinta'), 'próxima fase ' + r.next);
  ok(r.btn && !r.has4, 'não deveria existir Fase 4 jogável');
  ok(r.prog.completed[3] && r.prog.unlocked.includes(4), 'progresso');
});
await test('Persistência após concluir: recarregar e continuar não entra na Fase 4', async () => {
  await open(false);
  ok(await E(() => !document.getElementById('btn-phases').hidden), 'botão Fases deveria aparecer');
  await E(() => __game.continueGame());
  await page.waitForTimeout(800);
  const s = await E(() => ({ top: __game.ui.topScreen(), phase: __game.phase.id, list: document.getElementById('phase-list').textContent }));
  ok(s.top === 'phases' && s.phase === 3, 'deveria abrir a lista de fases');
  ok(s.list.includes('Os Assobios de Matinta') && s.list.includes('em desenvolvimento'), 'Fase 4 desbloqueada/em desenvolvimento: ' + s.list);
});
await test('Fase 2 continua jogável depois da Fase 3 (menu Fases)', async () => {
  await E(() => { __game.playPhase(2, true); });
  await page.waitForFunction(() => __game.phase.id === 2 && __game.player, null, { timeout: 60000 });
  await E(() => __T.ff(30, { until: () => __game.state === 'play' }));
  ok(await E(() => __game.phase.id === 2 && __game.state === 'play' && document.getElementById('ph-title').textContent === 'O CAMINHO DOS QUEIXADAS'), 'fase 2 não abriu');
  ok(await E(() => document.getElementById('navhud').hidden), 'painel da canoa não deveria aparecer na Fase 2');
});
await test('Fase 1 continua jogável depois das Fases 2 e 3 (menu Fases)', async () => {
  await E(() => { __game.playPhase(1, true); });
  await page.waitForFunction(() => __game.phase.id === 1 && __game.player, null, { timeout: 60000 });
  await E(() => __T.ff(30, { until: () => __game.state === 'play' }));
  ok(await E(() => __game.phase.id === 1 && __game.state === 'play' && document.getElementById('ph-title').textContent === 'A PRIMEIRA PEGADA'), 'fase 1 não abriu');
  ok(await E(() => document.getElementById('psec').hidden), 'missões secundárias não deveriam aparecer na Fase 1');
  ok(await E(() => { const p = JSON.parse(localStorage.getItem('ultimaCacada.progress.v1')); return p.completed[2] && p.completed[3]; }), 'recomeçar a Fase 1 apagou o progresso das outras fases');
});
await test('Console sem erros', async () => { ok(errors.length === 0, errors.slice(0, 5).join(' | ')); });

await browser.close();
server.close();
const fails = results.filter((r) => !r[0]);
console.log(`\n${results.length - fails.length}/${results.length} testes de navegador passaram.`);
process.exit(fails.length ? 1 : 0);
