# Testes — A Última Caçada

## 1. Testes de lógica (sem instalar nada)

Abra o jogo por um servidor local (o mesmo que você já usa para jogar) e acesse:

```
http://localhost:PORTA/tests/index.html
```

Rodam no próprio navegador e não mexem no save do jogo (usam um armazenamento em memória).

Com Node.js instalado, dá para rodar o mesmo conjunto no terminal, na pasta do projeto:

```
node tests/run-unit.mjs
```

O que cobrem (58 testes):

- **Persistência**: um slot por fase (a Fase 1 mantém a chave antiga), desbloqueio da Fase 2 ao concluir a 1, migração de saves antigos, recomeçar uma fase sem apagar o progresso, Fase 3 desbloqueada mas não jogável, falha do armazenamento sem derrubar o jogo.
- **IA dos queixadas**: os 8 estados; bando calmo não percebe jogador quieto; jogador em pé é percebido e o motivo é informado; agachado e escondido não é percebido; distração gera ALERT → INVESTIGATE sem acusar o jogador; aviso entre animais com atraso; DEFENSIVE → CHASE; desistência por coleira, por perder o rastro e por área segura; nenhum quadro com animal dentro de tronco de árvore; campo de fluxo contornando parede; mordida só em jogo ativo e com intervalo.
- **Fase 3**: as cinco regiões ligadas (A→B→C a pé; a margem do silêncio só pela água); a canoa cabe do lago até a margem segura pelo canal e pelo igapó; a anta fecha a garganta e o aningal abre o desvio; o caminho para o lago só abre depois de observar a anta; paneiro vindo da Fase 2.
- **Canoa**: atolada → presa por cipó e galho → empurrada → boiando → embarcada → desembarcada; aceleração e inércia; não atravessa pedras; correnteza empurra mas dá para subir o trecho mais forte; desencalhar; estado da canoa salvo no checkpoint.
- **Fauna da várzea**: anta (comer → farejar/alerta → fugir → sumir → voltar à rotina; segura a garganta até a Missão 2); capivaras (aviso passado com atraso, fuga para a água, volta à prainha); paca (escondida de dia, sai quando escurece, some no barulho); estados diferentes por espécie.
- **Missões da Fase 3**: as 9 principais com suas condições reais; Remador Experiente falha ao bater e conclui num trecho limpo; o evento da sombra pode virar a canoa (falha) e pode ser vencido; direção errada do rastro não conta; o abrigo salva, conclui a fase e desbloqueia só a Fase 4; secundárias opcionais.
- **Fase 2**: mapa maior que o da Fase 1, com as 5 regiões conectadas; tronco e passagens bloqueando de verdade; itens trazidos da Fase 1; condições de conclusão das 8 missões; secundárias opcionais com diário e pontos; salvamento e desbloqueio da Fase 3 ao concluir.

## 2. Testes de navegador (jogo real, ponta a ponta)

Precisam do pacote Playwright e de Chrome ou Chromium:

```
npm i -D playwright
npx playwright install chromium
node tests/e2e/run.mjs
```

Se já tiver o Chrome instalado: `CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" node tests/e2e/run.mjs` (no PowerShell, defina a variável com `$env:CHROME_PATH="..."`).

O script sobe um servidor próprio, abre o jogo e joga 38 roteiros: Fase 1 (menu, equipamentos, conversa, colisão, save após recarregar, conclusão liberando a Fase 2), Fase 2 inteira (as 8 missões, a travessia com distração, o puzzle empurrando o toro, a perseguição com a IA de verdade, a anta), detecção e nova tentativa, desmaio e volta ao checkpoint, cronômetro e pausa, persistência após recarregar, Fase 3 inteira jogada com teclas reais (barro, anta, desvio do aningal, capivaras, remo, cipós, galho, empurrar a canoa, remar o igarapé até a passagem, virar a canoa e voltar ao checkpoint, frear na água revolta, chegar à margem, rastro na chuva, tapiri), salvamento após recarregar, Fase 4 só desbloqueada, Fases 1 e 2 ainda jogáveis e console sem erros. Se algo falhar, ele salva uma captura `tests/e2e/falha-N.png`.

## 3. Conferência manual (o que só uma pessoa avalia)

- [ ] Som com fones: grunhidos e bater de dentes vindos do lado certo; ruído do bando aumentando ao se aproximar; troca suave da música ambiente para a da perseguição e de volta.
- [ ] A perseguição é emocionante e justa no teclado e no celular (joystick + botões).
- [ ] Os tremores de tela são discretos (e desligáveis em Opções → Tremor de câmera).
- [ ] O motivo da detecção (viu, ouviu, farejou) aparece e faz sentido na hora.
- [ ] Desempenho estável num computador mais modesto e num celular (o teste automatizado mediu 60 quadros/s na clareira e na perseguição, numa máquina de desenvolvimento).
- [ ] Leitura dos textos e dicas em tela pequena (painel em gaveta).

### Fase 3 (conferência manual)

- [ ] A canoa no teclado e no celular: W/S/A/D e o joystick (aponte para onde quer ir) são confortáveis; a inércia é desafiadora sem ser irritante.
- [ ] O painel da canoa (velocidade e seta da correnteza) é legível e não atrapalha.
- [ ] O evento da sombra assusta: silêncio, ondas subindo o rio, sombra passando por baixo, golpe na água e fuga até a margem. A Cobra Grande não aparece por inteiro.
- [ ] Chuva, relâmpagos e escurecimento do fim da tarde ficam bonitos e não pesam no celular.
- [ ] A cena final do tapiri (lanterna falhando, dois assobios, sombra de ave) prepara bem a Matinta Pereira.
- [ ] Ritmo: cerca de 40 minutos jogando com calma, sem esperas forçadas.

`tests/sprites.html` mostra as poses dos queixadas e da anta ampliadas, para revisar a arte.
