# Melhorias · Seahorse Shooter

Backlog acordado. **Esta é a fonte primária para planejar trabalho neste jogo.**
Cada item diz o porquê, onde mexer e o que já se sabe que dá errado.

Última revisão: **05/09/2026**, na sessão que reescreveu o jogo.

---

## O que já foi feito

A reescrita de 05/09/2026 partiu do código de tutorial (dois arquivos, 683
linhas, sem menu, sem pausa, sem som e com os controles de toque quebrados) e
entregou o jogo no mesmo padrão dos outros quatro da pasta.

**Bugs corrigidos, todos confirmados no navegador antes e depois:**

- `buttons.js` era código de outro jogo. Falava com `keys.w.pressed` e
  `player.velocity.y`, que não existiam aqui, e lançava `keys is not defined` a
  cada toque. O celular era injogável. O arquivo foi removido e a entrada de
  toque refeita com pointer events.
- `this.game.amo` no `enterPowerUp`, um typo: `undefined < 50` é falso, e o
  power-up nunca recarregava a munição.
- `frameX++` duas vezes no `Explosion.update`, uma dentro do timer e outra fora.
  As explosões queimavam os 8 quadros em 4 e praticamente não apareciam.
- `(this.speedX = Math.random() * -1), 2 - 0.2` na HiveWhale: vírgula no lugar do
  ponto decimal de `-1.2`, com `2 - 0.2` virando expressão morta.
- `background.layer4.update()` chamado duas vezes por quadro, com o primeiro
  plano correndo no dobro da velocidade do resto do parallax.
- HUD desenhado antes do jogador e dos inimigos, que passavam por cima do placar
  e da mensagem de fim.
- `draw` antes de `update` no laço, desenhando sempre o quadro anterior.
- `lastTime = 0` com `animate(0)`: o segundo quadro recebia um `deltaTime` igual
  ao tempo desde a navegação e engolia segundos da partida. Medido: 7,7 no
  relógio com 5,8s de jogo.
- `debug = true` no construtor: o jogo publicado mostrava hitboxes e vidas.
- Projéteis apagados a 80% da largura, deixando uma faixa de 240px à direita onde
  nenhum inimigo podia ser atingido.
- Animação de sprite e movimento por quadro, não por tempo.
- `maxFrame = 37` com folhas de 39 colunas: a última coluna nunca aparecia.
- `e.key` sensível a caixa: Caps Lock quebrava os controles.
- Tiro no `keydown` sem cadência, virando metralhadora pela repetição automática
  do teclado do sistema.
- 588 KB de PNG duplicado na raiz, idênticos byte a byte aos de `assets/`.

**Acrescentado:** menu inicial com opções, recordes e "como jogar"; pausa por
`Esc`, por botão e por troca de aba; três dificuldades; vidas com
invulnerabilidade piscante; partida sem fim com dificuldade crescente; recordes
por dificuldade em `localStorage`; som sintetizado em WebAudio; vibração;
tremida de tela e clarão no dano; clarão branco no inimigo que leva tiro; layout
próprio para computador e para celular; `.nojekyll`, favicon e descrição.

**Uma armadilha nova, cara e já paga:** `#loader` tinha `display: flex` no CSS,
que vence o atributo `hidden`. O carregador invisível ficava por cima do menu
comendo todo clique. Sempre que um elemento com `display` explícito for escondido
por atributo, escrever também a regra `[hidden] { display: none }`.

---

## Ordem recomendada do que falta

### 1. Chefe de fase · o maior buraco do jogo

A partida é uma reta: os mesmos cinco inimigos até morrer. Um chefe a cada 90
segundos daria arco à sessão e um motivo para guardar o turbo.

Onde: `Game.addEnemy` já é o ponto de decisão, e `Game.update` já tem o relógio.
Faltaria uma classe `Boss` em `entities.js` com padrão de tiro (o jogo ainda não
tem projétil de inimigo) e um estado de "chefe em cena" que segura o nascimento
normal.

**Armadilha:** o pack não tem sprite de chefe. A HiveWhale ampliada com mais
vidas e um padrão de drones é o caminho barato e honesto.

### 2. Tiro de inimigo

Hoje o inimigo só machuca por contato, então a única habilidade cobrada é
posicionar. Um projétil inimigo (o `projectile.png` espelhado serve) transforma o
jogo de "desvie" em "desvie e mire".

Onde: `entities.js` ganha `EnemyProjectile`; `Game.updateEnemies` já percorre
tudo e é onde a colisão entraria. O `Angler2`, que já oscila, é o candidato.

**Armadilha:** com tiro inimigo, as 2 ou 3 vidas atuais viram pouco. Rebalancear
`DIFFICULTIES` junto, não depois.

### 3. Combo e multiplicador

Matar em sequência sem levar dano deveria valer mais. Dá profundidade ao placar
sem mexer em nada do movimento.

Onde: contador em `Game`, zerado no `ram()`, exibido no HUD ao lado do score.

### 4. Guardar o tempo além do recorde

`Settings.bests` já grava `{score, time}` e a tela de recordes já mostra os dois.
Falta uma linha de "melhor tempo" independente do placar, para quem joga de
sobrevivência.

### 5. Chuveirinho de partículas mais barato

O teto de 90 partículas resolve o pior caso, mas cada uma faz
`save/translate/rotate/restore`. Num celular antigo isso pesa. Um pool de objetos
e o desenho sem rotação para as menores resolveria.

**Antes de otimizar, medir.** Na máquina de desenvolvimento a partida roda a
58 fps e o cenário artificialmente cheio (19 inimigos, 4 baleias) a 45. Já se
tentou converter as folhas para `ImageBitmap` apostando que as folhas gigantes
custavam caro: medido 54,0 contra 54,9 fps, dentro da variação. Foi revertido.

### 6. Dificuldade "sem fim" mais interessante

Hoje só o intervalo de nascimento e a velocidade sobem. Poderia mudar a mistura
de inimigos por faixa de tempo, com levas temáticas (só drones, só baleias).

Onde: `Game.addEnemy`, que já lê `this.elapsed`.

---

## Coisas que valem saber

**O nome do repositório já foi de outro jogo.** Até 02/09/2026,
`f-neves/seahorse-shooter` era o King's Path, renomeado para `kings-path`. Este
repositório reocupou o nome, e o redirect antigo do GitHub morreu.

**As folhas de sprite são enormes.** `hivewhale.png` tem 15600x227. Não abrir no
editor de imagem sem necessidade, e não recortar: `assets.js` já tem as medidas.

**A cauda do cavalo-marinho sai pela base de propósito.** O limite vertical é
`height - height * 0.5`, o enquadramento do original. Quem "consertar" isso vai
achar que é bug.

**O canvas deitado não enche a tela do celular.** 1200x500 é 2,4:1 e o celular
deitado é 2,16:1, então sobram barras pretas nas laterais. Medido num 844x390:
canvas de 727x303 com doca de 87px. É letterbox honesto; encher a largura exigiria
cortar o topo e a base do campo de jogo.
