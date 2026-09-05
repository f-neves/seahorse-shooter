/* ============================================================
   Entidades do jogo.

   Duas regras valem para todas:

   1. Movimento é por tempo, em pixels por segundo. Nada aqui avança
      "por quadro": o jogo tem que rodar igual a 60Hz e a 144Hz.
   2. A caixa de colisão não é a moldura do sprite. Todo sprite do pack
      tem margem vazia em volta, e colidir com o vazio é o que fazia o
      jogo original parecer injusto. Cada tipo declara o seu `HIT`, em
      frações da moldura.

   Depende de assets.js (para `Assets.image`) e de settings.js.
   ============================================================ */

/* ------------------------------------------------------------
   Base: um sprite em folha horizontal, animado por acumulador
   ------------------------------------------------------------ */

class Sprite {
  constructor(game, key) {
    this.game = game;
    this.spec = SPRITES[key];
    this.image = Assets.image(key);
    this.width = this.spec.w;
    this.height = this.spec.h;
    this.frameX = 0;
    this.frameY = 0;
    this.frameTimer = 0;
    this.fps = 20;
    this.markedForDeletion = false;
  }

  /* avança a folha de sprite pelo relógio, não pelo quadro */
  animate(dt) {
    this.frameTimer += dt;
    const step = 1 / this.fps;
    while (this.frameTimer >= step) {
      this.frameTimer -= step;
      this.frameX = (this.frameX + 1) % this.spec.frames;
    }
  }

  /* caixa de colisão real, derivada da moldura pelas frações de HIT */
  hitbox() {
    const h = this.constructor.HIT;
    if (!h) return { x: this.x, y: this.y, w: this.width, h: this.height };
    return {
      x: this.x + this.width * h.x,
      y: this.y + this.height * h.y,
      w: this.width * h.w,
      h: this.height * h.h,
    };
  }

  drawFrame(context) {
    context.drawImage(
      this.image,
      this.frameX * this.width,
      this.frameY * this.height,
      this.width,
      this.height,
      Math.round(this.x),
      Math.round(this.y),
      this.width,
      this.height
    );
  }

  drawDebug(context) {
    const box = this.hitbox();
    context.save();
    context.strokeStyle = "rgba(255,255,255,0.35)";
    context.strokeRect(this.x, this.y, this.width, this.height);
    context.strokeStyle = "#5ad2e0";
    context.strokeRect(box.x, box.y, box.w, box.h);
    context.restore();
  }
}

/* ------------------------------------------------------------
   Fundo em parallax
   ------------------------------------------------------------ */

class Layer {
  constructor(game, key, speedModifier) {
    this.game = game;
    this.image = Assets.image(key);
    this.speedModifier = speedModifier;
    this.width = 1768;
    this.height = 500;
    this.x = 0;
  }

  update(dt) {
    this.x -= this.game.scroll * this.speedModifier * dt;
    // o módulo evita que um quadro longo (aba em segundo plano) pule a
    // volta ao início e abra uma costura no fundo
    if (this.x <= -this.width) this.x = this.x % this.width;
  }

  draw(context) {
    const x = Math.round(this.x);
    context.drawImage(this.image, x, 0, this.width, this.game.height);
    context.drawImage(
      this.image,
      x + this.width,
      0,
      this.width,
      this.game.height
    );
  }
}

class Background {
  constructor(game) {
    this.game = game;
    this.layers = [
      new Layer(game, "layer1", 0.2),
      new Layer(game, "layer2", 0.4),
      new Layer(game, "layer3", 1),
    ];
    // o layer4 é primeiro plano: atualiza junto, mas desenha por cima de tudo
    this.foreground = new Layer(game, "layer4", 1.5);
  }

  update(dt) {
    this.layers.forEach((layer) => layer.update(dt));
    this.foreground.update(dt);
  }

  draw(context) {
    this.layers.forEach((layer) => layer.draw(context));
  }

  drawForeground(context) {
    this.foreground.draw(context);
  }
}

/* ------------------------------------------------------------
   Projétil
   ------------------------------------------------------------ */

class Projectile {
  static SPEED = 620;

  constructor(game, x, y) {
    this.game = game;
    this.x = x;
    this.y = y;
    this.width = 28;
    this.height = 10;
    this.image = Assets.image("projectile");
    this.markedForDeletion = false;
  }

  update(dt) {
    this.x += Projectile.SPEED * dt;
    // o original apagava o tiro a 80% da tela, o que deixava uma faixa
    // à direita onde nenhum inimigo podia ser atingido
    if (this.x > this.game.width) this.markedForDeletion = true;
  }

  hitbox() {
    return { x: this.x, y: this.y, w: this.width, h: this.height };
  }

  draw(context) {
    context.drawImage(this.image, Math.round(this.x), Math.round(this.y));
  }
}

/* ------------------------------------------------------------
   Engrenagens que saltam do inimigo destruído
   ------------------------------------------------------------ */

class Particle {
  static GRAVITY = 1800;

  constructor(game, x, y) {
    this.game = game;
    this.x = x;
    this.y = y;
    this.image = Assets.image("gears");
    this.frameX = Math.floor(Math.random() * 3);
    this.frameY = Math.floor(Math.random() * 3);
    this.spriteSize = 50;
    this.size = this.spriteSize * (Math.random() * 0.5 + 0.5);
    this.speedX = Math.random() * 360 - 180;
    this.speedY = Math.random() * -900;
    this.angle = 0;
    this.va = Math.random() * 12 - 6;
    this.bounced = 0;
    this.bottomBounceBoundary = Math.random() * 80 + 60;
    this.markedForDeletion = false;
  }

  update(dt) {
    this.angle += this.va * dt;
    this.speedY += Particle.GRAVITY * dt;
    this.x -= (this.speedX + this.game.scroll) * dt;
    this.y += this.speedY * dt;

    const floor = this.game.height - this.bottomBounceBoundary;
    if (this.y > floor && this.bounced < 2 && this.speedY > 0) {
      this.bounced++;
      this.speedY *= -0.75;
    }
    if (this.y > this.game.height + this.size || this.x < -this.size) {
      this.markedForDeletion = true;
    }
  }

  draw(context) {
    context.save();
    context.translate(this.x, this.y);
    context.rotate(this.angle);
    context.drawImage(
      this.image,
      this.frameX * this.spriteSize,
      this.frameY * this.spriteSize,
      this.spriteSize,
      this.spriteSize,
      this.size * -0.5,
      this.size * -0.5,
      this.size,
      this.size
    );
    context.restore();
  }
}

/* ------------------------------------------------------------
   Explosões
   ------------------------------------------------------------ */

class Explosion extends Sprite {
  constructor(game, key, x, y, scale = 1) {
    super(game, key);
    this.fps = 20;
    this.scale = scale;
    this.drawW = this.width * scale;
    this.drawH = this.height * scale;
    this.x = x - this.drawW * 0.5;
    this.y = y - this.drawH * 0.5;
  }

  update(dt) {
    this.x -= this.game.scroll * dt;
    this.frameTimer += dt;
    const step = 1 / this.fps;
    while (this.frameTimer >= step) {
      this.frameTimer -= step;
      this.frameX++;
      // sem `%`: a explosão toca uma vez e some, não fica em laço
      if (this.frameX >= this.spec.frames) {
        this.markedForDeletion = true;
        return;
      }
    }
  }

  draw(context) {
    if (this.frameX >= this.spec.frames) return;
    context.drawImage(
      this.image,
      this.frameX * this.width,
      0,
      this.width,
      this.height,
      Math.round(this.x),
      Math.round(this.y),
      this.drawW,
      this.drawH
    );
  }
}

class SmokeExplosion extends Explosion {
  constructor(game, x, y, scale) {
    super(game, "smoke", x, y, scale);
  }
}

class FireExplosion extends Explosion {
  constructor(game, x, y, scale) {
    super(game, "fire", x, y, scale);
  }
}

/* ------------------------------------------------------------
   Jogador
   ------------------------------------------------------------ */

class Player extends Sprite {
  static HIT = { x: 0.24, y: 0.12, w: 0.48, h: 0.6 };
  static SPEED = 300;
  static POWER_MS = 9000;
  static INVULNERABLE_MS = 1600;

  constructor(game) {
    super(game, "player");
    this.fps = 24;
    this.reset();
  }

  reset() {
    this.x = 24;
    this.y = this.game.height * 0.5 - this.height * 0.5;
    this.frameX = 0;
    this.frameY = 0;
    this.projectiles = [];
    this.powerUp = false;
    this.powerUpTimer = 0;
    this.invulnerable = 0;
    this.dir = 0;
  }

  update(dt) {
    this.y += this.dir * Player.SPEED * dt;

    // metade da cauda pode sair pela base: é o enquadramento do original
    const min = 0;
    const max = this.game.height - this.height * 0.5;
    if (this.y < min) this.y = min;
    else if (this.y > max) this.y = max;

    this.projectiles.forEach((projectile) => projectile.update(dt));
    this.projectiles = this.projectiles.filter((p) => !p.markedForDeletion);

    this.animate(dt);

    if (this.invulnerable > 0) this.invulnerable -= dt * 1000;

    if (this.powerUp) {
      this.powerUpTimer -= dt * 1000;
      this.frameY = 1;
      if (this.powerUpTimer <= 0) {
        this.powerUp = false;
        this.powerUpTimer = 0;
        this.frameY = 0;
      }
    }
  }

  draw(context) {
    this.projectiles.forEach((projectile) => projectile.draw(context));

    // piscar durante a invulnerabilidade, para o dano ficar legível
    const blinking =
      this.invulnerable > 0 && Math.floor(this.invulnerable / 90) % 2 === 0;
    if (blinking) context.globalAlpha = 0.35;
    this.drawFrame(context);
    context.globalAlpha = 1;

    if (this.game.debug) this.drawDebug(context);
  }

  shoot() {
    if (this.game.ammo < 1) {
      Sound.play("empty");
      return false;
    }
    this.game.ammo--;
    this.projectiles.push(new Projectile(this.game, this.x + 84, this.y + 28));
    if (this.powerUp && this.game.ammo >= 1) {
      this.game.ammo--;
      this.projectiles.push(new Projectile(this.game, this.x + 84, this.y + 96));
      Sound.play("double");
    } else {
      Sound.play("laser");
    }
    return true;
  }

  enterPowerUp() {
    this.powerUp = true;
    this.powerUpTimer = Player.POWER_MS;
    // o original tinha `this.game.amo`, um typo: a recarga nunca acontecia
    this.game.ammo = this.game.rules.maxAmmo;
    Sound.play("power");
    Sound.vibrate(20);
  }

  hurt() {
    if (this.invulnerable > 0) return false;
    this.invulnerable = Player.INVULNERABLE_MS;
    return true;
  }
}

/* ------------------------------------------------------------
   Inimigos
   ------------------------------------------------------------ */

class Enemy extends Sprite {
  constructor(game, key) {
    super(game, key);
    this.x = game.width;
    this.speedX = 0;
    this.wobble = 0;
    this.wobbleAmp = 0;
    this.wobbleSpeed = 0;
    this.flash = 0;
    this.type = "";
  }

  /* Posição vertical inicial dentro da área jogável. No celular o HUD
     flutua sobre o topo do jogo, e `topInset` mantém os inimigos abaixo
     dele: nascer escondido atrás do placar não é dificuldade, é azar. */
  placeY() {
    const top = this.game.topInset;
    const max = Math.max(top, this.game.height * 0.95 - this.height);
    this.y = top + Math.random() * (max - top);
    this.baseY = this.y;
  }

  update(dt) {
    this.x -= (this.speedX + this.game.scroll) * dt;
    if (this.wobbleAmp) {
      this.wobble += this.wobbleSpeed * dt;
      this.y = this.baseY + Math.sin(this.wobble) * this.wobbleAmp;
    }
    if (this.x + this.width < 0) this.markedForDeletion = true;
    if (this.flash > 0) this.flash -= dt * 1000;
    this.animate(dt);
  }

  draw(context) {
    this.drawFrame(context);

    // clarão branco no quadro em que leva tiro: sem ele, acertar um
    // inimigo de 15 vidas não dá nenhum retorno visual
    if (this.flash > 0) {
      context.save();
      context.globalCompositeOperation = "lighter";
      context.globalAlpha = Math.min(0.6, this.flash / 90);
      this.drawFrame(context);
      context.restore();
    }

    if (this.game.debug) {
      this.drawDebug(context);
      context.save();
      context.fillStyle = "#fff";
      context.font = '10px "Press Start 2P", monospace';
      context.fillText(this.lives, this.x, this.y - 4);
      context.restore();
    }
  }

  hurt(amount = 1) {
    this.lives -= amount;
    this.flash = 90;
    return this.lives <= 0;
  }
}

class Angler1 extends Enemy {
  static HIT = { x: 0.1, y: 0.22, w: 0.74, h: 0.54 };

  constructor(game) {
    super(game, "angler1");
    this.frameY = Math.floor(Math.random() * 3);
    this.lives = 2;
    this.score = 2;
    this.type = "angler1";
    this.speedX = (Math.random() * 60 + 40) * game.rules.enemySpeed;
    this.placeY();
  }
}

class Angler2 extends Enemy {
  static HIT = { x: 0.1, y: 0.24, w: 0.76, h: 0.5 };

  constructor(game) {
    super(game, "angler2");
    this.frameY = Math.floor(Math.random() * 2);
    this.lives = 3;
    this.score = 3;
    this.type = "angler2";
    this.speedX = (Math.random() * 70 + 55) * game.rules.enemySpeed;
    this.placeY();
    // sobe e desce devagar: obriga a mirar em vez de segurar o tiro
    this.wobbleAmp = 26;
    this.wobbleSpeed = Math.random() * 1.4 + 0.8;
  }
}

class LuckyFish extends Enemy {
  static HIT = { x: 0.12, y: 0.14, w: 0.74, h: 0.72 };

  constructor(game) {
    super(game, "lucky");
    this.frameY = Math.floor(Math.random() * 2);
    this.lives = 3;
    this.score = 5;
    this.type = "lucky";
    this.speedX = (Math.random() * 80 + 70) * game.rules.enemySpeed;
    this.placeY();
    this.wobbleAmp = 18;
    this.wobbleSpeed = Math.random() * 2 + 1.6;
  }
}

class HiveWhale extends Enemy {
  static HIT = { x: 0.07, y: 0.16, w: 0.82, h: 0.6 };

  constructor(game) {
    super(game, "hivewhale");
    this.frameY = 0;
    this.lives = 15;
    this.score = 20;
    this.type = "hive";
    // no original: `(this.speedX = Math.random() * -1), 2 - 0.2`, com uma
    // vírgula no lugar do ponto decimal de -1.2
    this.speedX = (Math.random() * 25 + 18) * game.rules.enemySpeed;
    this.placeY();
  }
}

class Drone extends Enemy {
  static HIT = { x: 0.12, y: 0.16, w: 0.72, h: 0.66 };

  constructor(game, x, y) {
    super(game, "drone");
    this.frameY = Math.floor(Math.random() * 2);
    this.lives = 3;
    this.score = 4;
    this.type = "drone";
    this.speedX = (Math.random() * 190 + 110) * game.rules.enemySpeed;
    this.x = x;
    this.y = Math.max(0, Math.min(y, game.height - this.height));
    this.baseY = this.y;
    this.wobbleAmp = 34;
    this.wobbleSpeed = Math.random() * 3 + 2.4;
  }
}
