# Seahorse Shooter

**[Jogar agora](https://f-neves.github.io/seahorse-shooter/)** · publicado pelo
GitHub Pages a partir do `main`.

Shoot'em up lateral em Canvas 2D numa cidade a vapor submersa. Sem dependências,
sem build e sem um único arquivo de áudio: o som é sintetizado em WebAudio. É só
servir a pasta por HTTP.

```bash
python -m http.server 8000
# http://localhost:8000
```

## Arquivos

Os scripts carregam nesta ordem, cada um dependendo só dos anteriores:

| arquivo       | papel                                                             |
| ------------- | ----------------------------------------------------------------- |
| `settings.js` | preferências, presets de dificuldade e recordes em `localStorage`  |
| `audio.js`    | efeitos e trilha sintetizados em WebAudio, vibração                |
| `assets.js`   | tabela de sprites (medidas reais dos PNG) e carregador de imagens  |
| `entities.js` | jogador, inimigos, projéteis, partículas, explosões e o parallax   |
| `menu.js`     | painéis de menu, opções, recordes, como jogar, pausa e fim         |
| `game.js`     | escala de tela, máquina de estados, laço, colisões e entrada       |
| `index.html`  | HUD, tela, painéis e doca de controles                             |
| `style.css`   | apresentação, com os dois modos `[data-mode]`                      |

`settings.js`, `audio.js` e `assets.js` não conhecem o jogo. `menu.js` só mexe em
interface e recebe os callbacks em `UI.init()`. `game.js` é quem amarra tudo.

## Como a tela funciona

O jogo raciocina sempre numa **resolução lógica fixa de 1200x500**. Nada no
código de jogo lê o tamanho real da janela: quem faz a ponte é `resizeScreen()`,
que

1. mede o espaço disponível (diferente em cada modo),
2. escolhe um fator de escala que caiba nele,
3. dimensiona o elemento `#screen` em pixels CSS,
4. cria o buffer do canvas em pixels **físicos** (escala x `devicePixelRatio`,
   limitado a 2x) e aplica `setTransform`.

A arte do pack é grande e desenhada à mão, então não há `imagePixelated` nem
`imageSmoothingEnabled = false`: a interpolação ajuda em vez de atrapalhar.

## Os dois modos

O modo é decidido por `matchMedia('(hover: none) and (pointer: coarse)')` e
gravado em `document.body.dataset.mode`. Ele é reavaliado quando o navegador
muda de ideia (tablet que ganha teclado, por exemplo).

**`desktop`** · gabinete de arcade centralizado: moldura com brilho, barra de HUD
acima da tela, linhas de varredura e vinheta sobre o canvas (desligáveis nas
opções) e as teclas indicadas embaixo. Nenhum botão de toque existe na página.

**`touch`** · o jogo ocupa toda a área acima da doca. O HUD flutua sobre o topo
respeitando `safe-area-inset-top`, e os inimigos nascem abaixo dele (`topInset`).
A doca fica na base com `safe-area-inset-bottom`: subir, descer, pausa e tiro,
com a opção destro/canhoto espelhando tudo. Em retrato o jogo pede para girar o
aparelho: 1200x500 em pé vira uma tira ilegível.

## Estados

`loading` → `menu` → `playing` ⇄ `paused` → `over` → `menu`. O estado atual vai
para `body[data-state]`, que o CSS usa para esconder o HUD no menu e desativar a
doca fora da partida. No `menu` o cenário roda em modo atração, com peixes
passando ao fundo e sem jogador.

## Regras da partida

Partida sem fim, contra o relógio no sentido de que a dificuldade sobe sozinha:
o intervalo entre inimigos encolhe `spawnDecay` milissegundos por segundo até um
piso, e o cenário acelera até 1,6x. Acaba quando as vidas terminam.

| inimigo   | vidas | pontos | detalhe                                   |
| --------- | ----- | ------ | ----------------------------------------- |
| Angler1   | 2     | 2      | o mais comum                              |
| Angler2   | 3     | 3      | sobe e desce, entra depois de 12s          |
| LuckyFish | 3     | 5      | solta o turbo: munição cheia e tiro duplo |
| HiveWhale | 15    | 20     | entra depois de 25s, solta cinco drones   |
| Drone     | 3     | 4      | rápido e errático, só sai da baleia       |

Cada tiro gasta munição, que se recupera a cada `ammoInterval`. É o que impede
segurar o gatilho para sempre. Encostar num inimigo custa uma vida e dá 1,6s de
invulnerabilidade piscando.

## Som sem arquivos

`audio.js` não carrega nada: monta um `AudioContext` no primeiro gesto do
usuário e gera cada efeito com osciladores e ruído filtrado. A trilha é uma
pentatônica menor em Lá agendada com lookahead, porque `setInterval` sozinho não
tem precisão rítmica. O repositório fica sem um byte de áudio.
