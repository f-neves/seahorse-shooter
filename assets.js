/* ============================================================
   Tabela de sprites e carregador de imagens.

   As medidas não são chute: saem das dimensões reais dos PNG do pack.
   Todas as folhas de personagem têm 39 colunas (o código original usava
   `maxFrame = 37`, e a última coluna nunca aparecia).

     player.png     4680x380  = 39 x 120  ·  2 fileiras (normal, turbo)
     angler1.png    8892x507  = 39 x 228  ·  3 fileiras de cor
     angler2.png    8307x337  = 39 x 213  ·  2 fileiras
     lucky.png      3861x190  = 39 x  99  ·  2 fileiras
     hivewhale.png 15600x227  = 39 x 400  ·  1 fileira
     drone.png      4485x190  = 39 x 115  ·  2 fileiras
     *Explosion.png 1600x200  =  8 x 200
     layerN.png     1768x500

   Sem dependências: carrega antes de todo o resto.
   ============================================================ */

const SPRITES = {
  player: { src: "assets/player.png", w: 120, h: 190, frames: 39 },
  angler1: { src: "assets/angler1.png", w: 228, h: 169, frames: 39 },
  angler2: { src: "assets/angler2.png", w: 213, h: 165, frames: 39 },
  lucky: { src: "assets/lucky.png", w: 99, h: 95, frames: 39 },
  hivewhale: { src: "assets/hivewhale.png", w: 400, h: 227, frames: 39 },
  drone: { src: "assets/drone.png", w: 115, h: 95, frames: 39 },
  smoke: { src: "assets/smokeExplosion.png", w: 200, h: 200, frames: 8 },
  fire: { src: "assets/fireExplosion.png", w: 200, h: 200, frames: 8 },
  projectile: { src: "assets/projectile.png", w: 28, h: 10, frames: 1 },
  gears: { src: "assets/gears.png", w: 50, h: 50, frames: 9 },
  layer1: { src: "assets/layer1.png", w: 1768, h: 500, frames: 1 },
  layer2: { src: "assets/layer2.png", w: 1768, h: 500, frames: 1 },
  layer3: { src: "assets/layer3.png", w: 1768, h: 500, frames: 1 },
  layer4: { src: "assets/layer4.png", w: 1768, h: 500, frames: 1 },
};

const Assets = {
  images: {},
  loaded: 0,
  total: 0,

  image(key) {
    return this.images[key];
  },

  /* Resolve quando toda imagem tiver terminado, com ou sem erro: uma
     imagem quebrada não pode travar o jogo na tela de carregamento.

     Chegamos a converter cada folha em ImageBitmap, apostando que as
     folhas gigantes (a da baleia tem 15600px de largura) sairiam mais
     baratas por quadro. Medido em cenário cheio: 54,0 contra 54,9 fps,
     dentro da variação entre execuções. O navegador já guarda a imagem
     decodificada, então o <img> fica. */
  load(onProgress) {
    const keys = Object.keys(SPRITES);
    this.total = keys.length;
    this.loaded = 0;

    return Promise.all(
      keys.map(
        (key) =>
          new Promise((resolve) => {
            const image = new Image();
            const done = () => {
              this.loaded++;
              if (onProgress) onProgress(this.loaded, this.total);
              resolve(key);
            };
            image.addEventListener("load", done, { once: true });
            image.addEventListener("error", done, { once: true });
            image.src = SPRITES[key].src;
            this.images[key] = image;
          })
      )
    );
  },
};
