/* ============================================================
   Preferências, presets de dificuldade e recordes.
   Sem dependências: é o primeiro script a carregar.

   As chaves de localStorage levam o prefixo `seahorse.` porque os
   jogos da pasta dividem o domínio f-neves.github.io e o
   localStorage é por domínio.
   ============================================================ */

/* Cada preset é o conjunto fechado de números que definem a partida.
   `spawnDecay` é quanto o intervalo entre inimigos encolhe por segundo
   de partida: é ele que faz a dificuldade subir sem fim. */
const DIFFICULTIES = {
  facil: {
    label: "FÁCIL",
    lives: 4,
    enemySpeed: 0.85,
    spawnStart: 1700,
    spawnFloor: 1000,
    spawnDecay: 9,
    ammoInterval: 280,
    maxAmmo: 60,
    startAmmo: 30,
    fireDelay: 150,
    scroll: 0.85,
  },
  normal: {
    label: "NORMAL",
    lives: 3,
    enemySpeed: 1,
    spawnStart: 1400,
    spawnFloor: 700,
    spawnDecay: 12,
    ammoInterval: 350,
    maxAmmo: 50,
    startAmmo: 25,
    fireDelay: 170,
    scroll: 1,
  },
  dificil: {
    label: "BRUTAL",
    lives: 2,
    enemySpeed: 1.28,
    spawnStart: 1100,
    spawnFloor: 460,
    spawnDecay: 16,
    ammoInterval: 430,
    maxAmmo: 40,
    startAmmo: 20,
    fireDelay: 195,
    scroll: 1.2,
  },
};

/* Cada opção vira uma linha do painel de ajustes. `scope` decide em que
   plataforma ela aparece: mostrar "vibrar" no desktop seria ruído. */
const OPTIONS = [
  {
    key: "difficulty",
    label: "DIFICULDADE",
    scope: "all",
    values: ["facil", "normal", "dificil"],
    format: (value) => DIFFICULTIES[value].label,
  },
  {
    key: "sfx",
    label: "EFEITOS",
    scope: "all",
    values: [true, false],
    format: (value) => (value ? "LIGADO" : "DESLIGADO"),
  },
  {
    key: "music",
    label: "TRILHA",
    scope: "all",
    values: [true, false],
    format: (value) => (value ? "LIGADA" : "DESLIGADA"),
  },
  {
    key: "volume",
    label: "VOLUME",
    scope: "all",
    values: [0, 20, 40, 60, 80, 100],
    format: (value) => "#".repeat(value / 20) + "-".repeat(5 - value / 20),
  },
  {
    key: "hand",
    label: "CONTROLES",
    scope: "touch",
    values: ["destro", "canhoto"],
    format: (value) => (value === "destro" ? "DESTRO" : "CANHOTO"),
  },
  {
    key: "haptics",
    label: "VIBRAR",
    scope: "touch",
    values: [true, false],
    format: (value) => (value ? "LIGADO" : "DESLIGADO"),
  },
  {
    key: "crt",
    label: "EFEITO CRT",
    scope: "desktop",
    values: [true, false],
    format: (value) => (value ? "LIGADO" : "DESLIGADO"),
  },
];

const Settings = {
  STORAGE_KEY: "seahorse.settings",
  BEST_KEY: "seahorse.best",

  values: {
    difficulty: "normal",
    sfx: true,
    music: true,
    volume: 60,
    hand: "destro",
    haptics: true,
    crt: true,
  },

  /* um recorde por dificuldade: a pontuação e quanto tempo durou */
  bests: {
    facil: { score: 0, time: 0 },
    normal: { score: 0, time: 0 },
    dificil: { score: 0, time: 0 },
  },

  listeners: [],

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || "{}");
      for (const key of Object.keys(this.values)) {
        if (saved[key] !== undefined) this.values[key] = saved[key];
      }
      const bests = JSON.parse(localStorage.getItem(this.BEST_KEY) || "null");
      if (bests && typeof bests === "object") {
        for (const key of Object.keys(this.bests)) {
          const entry = bests[key];
          if (typeof entry === "number") this.bests[key].score = entry;
          else if (entry && typeof entry === "object") {
            this.bests[key] = {
              score: Number(entry.score) || 0,
              time: Number(entry.time) || 0,
            };
          }
        }
      }
    } catch (error) {
      // localStorage bloqueado (modo privado, iframe): segue nos padrões
    }
    return this;
  },

  save() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.values));
      localStorage.setItem(this.BEST_KEY, JSON.stringify(this.bests));
    } catch (error) {
      /* sem persistência, mas a sessão continua válida */
    }
  },

  get(key) {
    return this.values[key];
  },

  set(key, value) {
    if (this.values[key] === value) return value;
    this.values[key] = value;
    this.save();
    this.listeners.forEach((fn) => fn(key, value));
    return value;
  },

  /* avança (ou volta) na lista de valores possíveis daquela opção */
  cycle(key, direction) {
    const option = OPTIONS.find((item) => item.key === key);
    if (!option) return;
    const current = option.values.indexOf(this.values[key]);
    const next =
      (current + direction + option.values.length) % option.values.length;
    return this.set(key, option.values[next]);
  },

  onChange(fn) {
    this.listeners.push(fn);
  },

  difficulty() {
    return DIFFICULTIES[this.values.difficulty] || DIFFICULTIES.normal;
  },

  best(key = this.values.difficulty) {
    return this.bests[key] || { score: 0, time: 0 };
  },

  recordScore(score, time) {
    const key = this.values.difficulty;
    if (score <= this.best(key).score) return false;
    this.bests[key] = { score, time };
    this.save();
    return true;
  },

  resetBests() {
    for (const key of Object.keys(this.bests)) {
      this.bests[key] = { score: 0, time: 0 };
    }
    this.save();
  },

  /* opções válidas para a plataforma atual */
  visibleOptions(isTouch) {
    return OPTIONS.filter(
      (option) =>
        option.scope === "all" || (option.scope === "touch") === Boolean(isTouch)
    );
  },
};

Settings.load();
