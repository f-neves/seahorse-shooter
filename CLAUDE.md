# Seahorse Shooter

**Leia `MELHORIAS.md` antes de propor qualquer plano para este jogo.** É o
backlog acordado, com o porquê de cada item, onde mexer no código e as
armadilhas conhecidas. Não montar um plano novo sem consultá-lo.

`README.md` explica a arquitetura: resolução lógica fixa 1200x500, os dois modos
`[data-mode]`, a máquina de estados e a cascata de scripts (`settings.js` →
`audio.js` → `assets.js` → `entities.js` → `menu.js` → `game.js`).

## Regras deste projeto

- **O nome `seahorse-shooter` já foi de outro jogo.** Até 02/09/2026 este
  repositório continha o King's Path, que foi renomeado para `kings-path`. Este
  repositório foi criado depois, reocupando o nome, e por isso o redirect antigo
  do GitHub não vale mais. São jogos diferentes.
- **Movimento é por tempo, em pixels por segundo, nunca por quadro.** Vale para
  posição, animação de sprite e temporizadores. O jogo tem que rodar igual a
  60Hz e a 144Hz.
- **A caixa de colisão não é a moldura do sprite.** Todo sprite do pack tem
  margem vazia, e colidir com o vazio é o que fazia o original parecer injusto.
  Cada classe declara um `static HIT` em frações da moldura, e `hitbox()`
  resolve. A tecla `G` desenha as duas caixas.
- **As folhas de sprite têm 39 colunas, não 38.** As medidas estão em
  `assets.js`, tiradas das dimensões reais dos PNG. O código original usava
  `maxFrame = 37` e a última coluna nunca aparecia.
- **Nada de `backdrop-filter` sobre o canvas.** O cenário roda atrás do menu, e
  desfocar um canvas animado obriga o navegador a reborrar a tela a cada quadro:
  medido em 19 fps com o desfoque contra 58 sem ele.
- **Som é sintetizado, não carregado.** Não adicionar arquivos de áudio: efeito
  novo vira mais um `case` no `Sound.play`.
- **Chaves de `localStorage` levam o prefixo `seahorse.`.** Os jogos da pasta
  dividem o domínio `f-neves.github.io` e o `localStorage` é por domínio.
- Testar as mudanças de interface **nos dois modos** antes de dar por pronto. O
  Playwright está na máquina; o modo touch precisa de tela deitada, porque em
  retrato o jogo pede para girar o aparelho.
- Servir por HTTP para testar (`python -m http.server`), não abrir por `file://`.
  **Encerrar o servidor ao terminar:** um `python -m http.server` esquecido com o
  diretório de trabalho dentro da pasta trava o Windows na hora de renomeá-la.
