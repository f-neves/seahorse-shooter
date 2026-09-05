/* ============================================================
   Seahorse Shooter

   Resolução lógica fixa: o jogo sempre raciocina em 1200x500. A camada
   de tela só escala esse retângulo para o espaço disponível, respeitando
   o devicePixelRatio. Nada no código de jogo lê o tamanho da janela.

   Depende de settings.js, audio.js, assets.js, entities.js e menu.js.
   ============================================================ */

const GAME_W = 1200;
const GAME_H = 500;

const canvas = document.querySelector("#game");
const c = canvas.getContext("2d");

const appEl = document.querySelector("#app");
const screenEl = document.querySelector("#screen");
const hudEl = document.querySelector("#hud");
const hintsEl = document.querySelector("#hints");
const dockEl = document.querySelector("#dock");
const loaderEl = document.querySelector("#loader");
const loaderBar = document.querySelector("#loaderBar");

const scoreEl = document.querySelector("#scoreEl");
const bestEl = document.querySelector("#bestEl");
const clockEl = document.querySelector("#clockEl");
const livesEl = document.querySelector("#livesEl");
const ammoFill = document.querySelector("#ammoFill");
const ammoText = document.querySelector("#ammoText");
const powerEl = document.querySelector("#powerEl");
const powerTime = document.querySelector("#powerTime");

const buttonUp = document.querySelector("#buttonUp");
const buttonDown = document.querySelector("#buttonDown");
const buttonFire = document.querySelector("#buttonFire");
const buttonPause = document.querySelector("#buttonPause");

/* ---------- estados ---------- */

const LOADING = "loading";
const MENU = "menu";
const PLAYING = "playing";
const PAUSED = "paused";
const OVER = "over";

let state = LOADING;

/* ============================================================
   1. Modo de entrada e escala de tela
   ============================================================ */

const coarsePointer = window.matchMedia("(hover: none) and (pointer: coarse)");
let isTouch = coarsePointer.matches;
let fitScale = 1;

function applyMode() {
  document.body.dataset.mode = isTouch ? "touch" : "desktop";
  UI.setTouch(isTouch);
}

function setState(next) {
  state = next;
  document.body.dataset.state = next;
}

function resizeScreen() {
  let availW;
  let availH;

  if (isTouch) {
    // a doca ocupa a base; o HUD flutua sobre o jogo e não rouba espaço
    availW = appEl.clientWidth;
    availH = appEl.clientHeight - dockEl.offsetHeight;
  } else {
    // o gabinete precisa caber com HUD em cima e dicas embaixo
    const chrome = hudEl.offsetHeight + hintsEl.offsetHeight + 96;
    availW = Math.min(window.innerWidth - 56, 1320);
    availH = window.innerHeight - chrome;
  }

  fitScale = Math.max(
    0.15,
    Math.min(availW / GAME_W, availH / GAME_H, isTouch ? 2 : 1.15)
  );

  screenEl.style.width = Math.round(GAME_W * fitScale) + "px";
  screenEl.style.height = Math.round(GAME_H * fitScale) + "px";

  // buffer do canvas em pixels físicos: a arte é grande, não interessa
  // desenhar 1200x500 e deixar o navegador esticar
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const render = Math.min(fitScale * dpr, 2);
  canvas.width = Math.round(GAME_W * render);
  canvas.height = Math.round(GAME_H * render);
  c.setTransform(render, 0, 0, render, 0, 0);

  // no celular o HUD flutua sobre o topo do jogo: os inimigos precisam
  // nascer abaixo dele para não ficarem escondidos atrás do placar
  if (game) {
    game.topInset = isTouch
      ? Math.min(GAME_H * 0.25, hudEl.offsetHeight / fitScale)
      : 0;
  }
}

coarsePointer.addEventListener("change", (event) => {
  isTouch = event.matches;
  applyMode();
  resizeScreen();
});

window.addEventListener("resize", resizeScreen);
window.addEventListener("orientationchange", () =>
  requestAnimationFrame(resizeScreen)
);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", resizeScreen);
}

/* ============================================================
   2. O jogo
   ============================================================ */

class Game {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.topInset = 0;
    this.debug = false;

    this.rules = Settings.difficulty();
    this.background = new Background(this);
    this.player = new Player(this);

    this.enemies = [];
    this.particles = [];
    this.explosions = [];

    this.reset();
  }

  reset() {
    this.rules = Settings.difficulty();
    this.enemies.length = 0;
    this.particles.length = 0;
    this.explosions.length = 0;
    this.player.reset();

    this.score = 0;
    this.lives = this.rules.lives;
    this.ammo = this.rules.startAmmo;
    this.ammoTimer = 0;
    this.elapsed = 0;
    this.enemyTimer = 0;
    this.spawnInterval = this.rules.spawnStart;
    this.scroll = 60 * this.rules.scroll;
    this.shake = 0;
    this.flash = 0;
    this.lastFiredAt = 0;
  }

  /* ---------- ritmo da partida ---------- */

  /* a dificuldade sobe sozinha: o intervalo entre inimigos encolhe e o
     cenário acelera, sem fim e sem degraus */
  get ramp() {
    return Math.min(1, this.elapsed / 120000);
  }

  currentSpawnInterval() {
    const seconds = this.elapsed / 1000;
    return Math.max(
      this.rules.spawnFloor,
      this.rules.spawnStart - seconds * this.rules.spawnDecay
    );
  }

  /* ---------- laço ---------- */

  update(dt) {
    this.elapsed += dt * 1000;
    this.scroll = 60 * this.rules.scroll * (1 + this.ramp * 0.6);

    this.background.update(dt);
    this.player.update(dt);

    // munição volta sozinha, é o que segura o dedo no gatilho
    this.ammoTimer += dt * 1000;
    while (this.ammoTimer >= this.rules.ammoInterval) {
      this.ammoTimer -= this.rules.ammoInterval;
      if (this.ammo < this.rules.maxAmmo) this.ammo++;
    }

    this.enemyTimer += dt * 1000;
    if (this.enemyTimer >= this.spawnInterval) {
      this.enemyTimer = 0;
      this.spawnInterval = this.currentSpawnInterval();
      this.addEnemy();
    }

    this.updateEnemies(dt);
    this.updateDebris(dt);

    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 60);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.6);
  }

  /* no menu o cenário roda com alguns peixes ao fundo, sem jogador */
  updateAttract(dt) {
    this.elapsed += dt * 1000;
    this.background.update(dt);

    this.enemyTimer += dt * 1000;
    if (this.enemyTimer >= 1500) {
      this.enemyTimer = 0;
      this.enemies.push(
        Math.random() < 0.5 ? new Angler1(this) : new Angler2(this)
      );
    }

    this.enemies.forEach((enemy) => enemy.update(dt));
    this.enemies = this.enemies.filter((enemy) => !enemy.markedForDeletion);
    this.updateDebris(dt);
  }

  /* depois de perder, o cenário continua e as explosões terminam */
  updateOver(dt) {
    this.background.update(dt);
    this.enemies.forEach((enemy) => enemy.update(dt));
    this.enemies = this.enemies.filter((enemy) => !enemy.markedForDeletion);
    this.updateDebris(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 60);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.6);
  }

  updateDebris(dt) {
    this.particles.forEach((particle) => particle.update(dt));
    this.particles = this.particles.filter((p) => !p.markedForDeletion);

    this.explosions.forEach((explosion) => explosion.update(dt));
    this.explosions = this.explosions.filter((e) => !e.markedForDeletion);
  }

  updateEnemies(dt) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(dt);

      if (enemy.markedForDeletion) {
        this.enemies.splice(i, 1);
        continue;
      }

      if (overlaps(this.player.hitbox(), enemy.hitbox())) {
        this.ram(enemy);
        this.enemies.splice(i, 1);
        if (state !== PLAYING) return;
        continue;
      }

      for (let j = this.player.projectiles.length - 1; j >= 0; j--) {
        const shot = this.player.projectiles[j];
        if (!overlaps(shot.hitbox(), enemy.hitbox())) continue;

        this.player.projectiles.splice(j, 1);
        this.spawnParticles(enemy, 1);

        if (enemy.hurt()) {
          this.kill(enemy);
          this.enemies.splice(i, 1);
        } else {
          Sound.play("hit");
        }
        break;
      }
    }
  }

  /* ---------- acontecimentos ---------- */

  addEnemy() {
    // teto de segurança: uma baleia morta perto de uma leva de peixes solta
    // cinco drones de uma vez, e o intervalo de nascimento só encolhe
    if (this.enemies.length >= 18) return;

    const seconds = this.elapsed / 1000;
    const roll = Math.random();

    // a baleia só aparece depois que o jogador se acostumou aos peixes
    if (seconds > 25 && roll < 0.1) return this.enemies.push(new HiveWhale(this));
    if (roll < 0.12) return this.enemies.push(new LuckyFish(this));
    if (seconds > 12 && roll < 0.55) return this.enemies.push(new Angler2(this));
    return this.enemies.push(new Angler1(this));
  }

  /* inimigo destruído a tiro */
  kill(enemy) {
    this.score += enemy.score;
    this.spawnParticles(enemy, Math.min(12, enemy.score));
    this.addExplosion(enemy);

    if (enemy.type === "lucky") {
      this.player.enterPowerUp();
    } else if (enemy.type === "hive") {
      // a baleia se abre e solta a ninhada
      for (let i = 0; i < 5; i++) {
        this.enemies.push(
          new Drone(
            this,
            enemy.x + Math.random() * enemy.width,
            enemy.y + Math.random() * enemy.height * 0.5
          )
        );
      }
      this.shake = 14;
      Sound.play("big");
      Sound.vibrate(30);
    } else {
      Sound.play("explode");
      Sound.vibrate(10);
    }
  }

  /* o jogador encostou num inimigo */
  ram(enemy) {
    this.addExplosion(enemy);
    this.spawnParticles(enemy, 6);

    if (!this.player.hurt()) {
      // já estava invulnerável: o inimigo morre, o jogador não perde vida
      Sound.play("explode");
      return;
    }

    this.lives--;
    this.shake = 18;
    this.flash = 1;
    Sound.play("damage");
    Sound.vibrate([30, 40, 60]);
    renderLives();

    if (this.lives <= 0) endRun();
  }

  spawnParticles(enemy, count) {
    // teto de partículas: uma baleia com ninhada podia encher a tela e
    // derrubar o quadro no celular
    const room = Math.max(0, 90 - this.particles.length);
    const total = Math.min(count, room);
    for (let i = 0; i < total; i++) {
      this.particles.push(
        new Particle(
          this,
          enemy.x + enemy.width * 0.5,
          enemy.y + enemy.height * 0.5
        )
      );
    }
  }

  addExplosion(enemy) {
    const x = enemy.x + enemy.width * 0.5;
    const y = enemy.y + enemy.height * 0.5;
    const scale = Math.max(0.7, Math.min(2, enemy.width / 200));
    this.explosions.push(
      Math.random() < 0.5
        ? new SmokeExplosion(this, x, y, scale)
        : new FireExplosion(this, x, y, scale)
    );
  }

  /* ---------- desenho ---------- */

  draw(context) {
    context.save();

    if (this.shake > 0) {
      const amount = this.shake;
      context.translate(
        (Math.random() - 0.5) * amount,
        (Math.random() - 0.5) * amount
      );
    }

    this.background.draw(context);
    this.particles.forEach((particle) => particle.draw(context));
    this.enemies.forEach((enemy) => enemy.draw(context));
    if (state !== MENU && state !== LOADING) this.player.draw(context);
    this.explosions.forEach((explosion) => explosion.draw(context));
    this.background.drawForeground(context);

    context.restore();

    if (this.flash > 0) {
      context.save();
      context.fillStyle = "rgba(255, 64, 64, " + this.flash * 0.34 + ")";
      context.fillRect(0, 0, this.width, this.height);
      context.restore();
    }
  }
}

function overlaps(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

let game = null;

/* ============================================================
   3. HUD
   ============================================================ */

let hudScore = -1;
let hudAmmo = -1;
let hudClock = -1;
let hudLives = -1;
let hudPower = -1;

const pad = (value) => String(value).padStart(5, "0");

function clockText(ms) {
  const total = Math.floor(ms / 1000);
  return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
}

function renderLives() {
  if (hudLives === game.lives) return;
  hudLives = game.lives;
  livesEl.textContent = "";
  for (let i = 0; i < game.rules.lives; i++) {
    const pip = document.createElement("i");
    pip.className = "pip" + (i < game.lives ? "" : " is-spent");
    livesEl.append(pip);
  }
}

function renderBest() {
  bestEl.textContent = pad(Settings.best().score);
}

/* só escreve no DOM quando o número muda: o laço roda 60 vezes por
   segundo e reescrever texto igual custa layout à toa */
function renderHud() {
  if (hudScore !== game.score) {
    hudScore = game.score;
    scoreEl.textContent = pad(game.score);
  }

  const ammo = Math.floor(game.ammo);
  if (hudAmmo !== ammo) {
    hudAmmo = ammo;
    ammoFill.style.width = (ammo / game.rules.maxAmmo) * 100 + "%";
    ammoText.textContent = ammo;
  }

  const seconds = Math.floor(game.elapsed / 1000);
  if (hudClock !== seconds) {
    hudClock = seconds;
    clockEl.textContent = clockText(game.elapsed);
  }

  const power = game.player.powerUp ? Math.ceil(game.player.powerUpTimer / 1000) : 0;
  if (hudPower !== power) {
    hudPower = power;
    powerEl.hidden = power === 0;
    if (power) powerTime.textContent = power;
  }

  ammoFill.classList.toggle("is-power", game.player.powerUp);
  livesEl.classList.toggle("is-low", game.lives === 1);
}

function resetHud() {
  hudScore = hudAmmo = hudClock = hudLives = hudPower = -1;
  renderLives();
  renderHud();
  renderBest();
}

/* ============================================================
   4. Máquina de estados
   ============================================================ */

function startRun() {
  game.reset();
  clearKeys();
  resetHud();
  UI.hide();
  setState(PLAYING);
  Sound.wantMusic(true);
}

function pauseRun() {
  if (state !== PLAYING) return;
  setState(PAUSED);
  clearKeys();
  Sound.stopMusic();
  UI.show("pause");
}

function resumeRun() {
  if (state !== PAUSED) return;
  UI.hide();
  setState(PLAYING);
  Sound.wantMusic(true);
}

function quitToMenu() {
  Sound.wantMusic(false);
  game.reset();
  clearKeys();
  setState(MENU);
}

function endRun() {
  if (state !== PLAYING) return;

  const score = game.score;
  const time = game.elapsed;

  game.addExplosion(game.player);
  game.spawnParticles(game.player, 14);
  game.shake = 24;
  game.flash = 1;
  Sound.play("over");
  Sound.vibrate([60, 60, 120]);
  Sound.wantMusic(false);
  setState(OVER);

  const isRecord = Settings.recordScore(score, time);
  renderBest();
  // o HUD não é mais atualizado fora de PLAYING: escreve o estado final
  // agora, senão o painel e a barra de cima mostram números diferentes
  renderHud();

  // um respiro antes do painel, para a explosão terminar na tela
  setTimeout(() => {
    if (state !== OVER) return;
    UI.showOver({ score, time, best: Settings.best(), isRecord });
  }, 1200);
}

/* ============================================================
   5. Laço
   ============================================================ */

let lastTime = null;

function animate(timeStamp) {
  requestAnimationFrame(animate);

  // o primeiro quadro precisa de dt zero: `lastTime = 0` com um timestamp
  // de rAF (que conta desde a navegação) engolia segundos de partida
  let dt = lastTime === null ? 0 : (timeStamp - lastTime) / 1000;
  lastTime = timeStamp;
  // teto: voltar de uma aba em segundo plano não pode teleportar o jogo
  if (dt > 1 / 20) dt = 1 / 20;

  if (state === PLAYING) {
    game.update(dt);
    renderHud();
  } else if (state === MENU) {
    game.updateAttract(dt);
  } else if (state === OVER) {
    game.updateOver(dt);
  }
  // em PAUSED nada avança: o desenho abaixo repete o último quadro

  c.clearRect(0, 0, GAME_W, GAME_H);
  game.draw(c);
}

/* ============================================================
   6. Entrada
   ============================================================ */

const keys = { up: false, down: false, fire: false };

const KEY_MAP = {
  w: "up",
  W: "up",
  ArrowUp: "up",
  s: "down",
  S: "down",
  ArrowDown: "down",
  " ": "fire",
  e: "fire",
  E: "fire",
  k: "fire",
  K: "fire",
};

function clearKeys() {
  keys.up = keys.down = keys.fire = false;
  if (game) game.player.dir = 0;
  document.querySelectorAll(".pad.is-down").forEach((pad) => {
    pad.classList.remove("is-down");
  });
}

function applyDirection() {
  if (!game) return;
  game.player.dir = keys.up ? -1 : keys.down ? 1 : 0;
}

/* o tiro tem cadência própria: segurar a tecla não pode virar metralhadora
   nem depender da repetição automática do teclado do sistema */
function tryFire() {
  if (state !== PLAYING) return;
  const now = performance.now();
  if (now - game.lastFiredAt < game.rules.fireDelay) return;
  if (game.player.shoot()) game.lastFiredAt = now;
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (state === PLAYING) {
      event.preventDefault();
      pauseRun();
    }
    return;
  }
  // `game` só existe depois que as imagens carregam
  if ((event.key === "g" || event.key === "G") && game) {
    game.debug = !game.debug;
    return;
  }
  if (state !== PLAYING) return;

  const action = KEY_MAP[event.key];
  if (!action) return;
  event.preventDefault();
  if (event.repeat) return;
  keys[action] = true;
  applyDirection();
  if (action === "fire") tryFire();
});

window.addEventListener("keyup", (event) => {
  const action = KEY_MAP[event.key];
  if (!action) return;
  keys[action] = false;
  applyDirection();
});

// o navegador perde o keyup quando a aba sai de foco
window.addEventListener("blur", clearKeys);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state === PLAYING) pauseRun();
});

/* pointer events cobrem toque, mouse e caneta de uma vez: o arquivo
   antigo só escutava `touchstart` e nem funcionava */
function bindHold(element, action) {
  const press = (event) => {
    event.preventDefault();
    if (state !== PLAYING) return;
    keys[action] = true;
    applyDirection();
    element.classList.add("is-down");
    if (action === "fire") tryFire();
    if (element.setPointerCapture && event.pointerId !== undefined) {
      try {
        element.setPointerCapture(event.pointerId);
      } catch (error) {
        /* alguns navegadores recusam a captura, seguimos sem ela */
      }
    }
  };

  const release = (event) => {
    if (event) event.preventDefault();
    keys[action] = false;
    applyDirection();
    element.classList.remove("is-down");
  };

  element.addEventListener("pointerdown", press);
  element.addEventListener("pointerup", release);
  element.addEventListener("pointercancel", release);
  element.addEventListener("lostpointercapture", release);
  element.addEventListener("contextmenu", (event) => event.preventDefault());
}

bindHold(buttonUp, "up");
bindHold(buttonDown, "down");
bindHold(buttonFire, "fire");
buttonPause.addEventListener("click", pauseRun);

// segurar o botão de tiro dispara em cadência, sem precisar tamborilar
setInterval(() => {
  if (keys.fire && state === PLAYING) tryFire();
}, 40);

document.addEventListener("dblclick", (event) => event.preventDefault(), {
  passive: false,
});

/* ============================================================
   7. Início
   ============================================================ */

UI.init({
  onPlay: startRun,
  onResume: resumeRun,
  onQuit: quitToMenu,
  onSettingChange: (key) => {
    if (key === "difficulty" && state !== PLAYING) {
      game.rules = Settings.difficulty();
      game.reset();
      resetHud();
    }
  },
});

applyMode();
setState(LOADING);

Assets.load((loaded, total) => {
  loaderBar.style.width = Math.round((loaded / total) * 100) + "%";
}).then(() => {
  game = new Game(GAME_W, GAME_H);
  resizeScreen();
  if (document.fonts) document.fonts.ready.then(resizeScreen);

  resetHud();
  loaderEl.hidden = true;
  setState(MENU);
  UI.show("menu");
  requestAnimationFrame(animate);
});
