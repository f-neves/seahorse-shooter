/* ============================================================
   Navegação dos painéis: menu, opções, recordes, como jogar,
   pausa e fim de partida.

   Só cuida de interface. Quem manda no jogo é o game.js, que registra
   os callbacks em UI.init().

   Depende de settings.js e audio.js.
   ============================================================ */

const UI = {
  panel: document.querySelector("#panel"),
  optionList: document.querySelector("#optionList"),
  recordTable: document.querySelector("#recordTable"),

  menuDifficulty: document.querySelector("#menuDifficulty"),
  menuBest: document.querySelector("#menuBest"),
  overScore: document.querySelector("#overScore"),
  overTime: document.querySelector("#overTime"),
  overBest: document.querySelector("#overBest"),
  overBadge: document.querySelector("#overBadge"),

  view: "menu",
  optionsReturn: "menu",
  actions: {},
  isTouch: false,

  pad: (value) => String(value).padStart(5, "0"),

  clock(ms) {
    const total = Math.floor(ms / 1000);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return minutes + ":" + String(seconds).padStart(2, "0");
  },

  init(actions) {
    this.actions = actions;
    this.buildOptions();
    this.panel.addEventListener("click", (event) => this.onClick(event));
    window.addEventListener("keydown", (event) => this.onKeyDown(event), true);
    Settings.onChange((key) => this.onSettingChange(key));
    this.applyBodyFlags();
    return this;
  },

  /* o conjunto de opções muda entre desktop e celular */
  setTouch(isTouch) {
    if (this.isTouch === isTouch && this.optionList.children.length) return;
    this.isTouch = isTouch;
    this.buildOptions();
    document.body.classList.toggle("is-touch", isTouch);
  },

  /* ---------- construção das telas ---------- */

  buildOptions() {
    this.optionList.textContent = "";
    for (const option of Settings.visibleOptions(this.isTouch)) {
      const row = document.createElement("button");
      row.className = "option";
      row.type = "button";
      row.dataset.nav = "";
      row.dataset.option = option.key;

      const label = document.createElement("span");
      label.className = "option-label";
      label.textContent = option.label;

      const value = document.createElement("span");
      value.className = "option-value";
      value.dataset.value = option.key;
      value.textContent = option.format(Settings.get(option.key));

      row.append(label, value);
      this.optionList.append(row);
    }
  },

  refreshOptionValues() {
    for (const option of Settings.visibleOptions(this.isTouch)) {
      const cell = this.optionList.querySelector(`[data-value="${option.key}"]`);
      if (cell) cell.textContent = option.format(Settings.get(option.key));
    }
  },

  buildRecords() {
    this.recordTable.textContent = "";
    for (const [key, preset] of Object.entries(DIFFICULTIES)) {
      const best = Settings.best(key);
      const row = document.createElement("li");
      row.className = "record-row";
      if (key === Settings.get("difficulty")) row.classList.add("is-current");

      const name = document.createElement("span");
      name.className = "record-name";
      name.textContent = preset.label;

      const value = document.createElement("span");
      value.className = "record-value";
      value.textContent = this.pad(best.score);

      const time = document.createElement("span");
      time.className = "record-time";
      time.textContent = best.score ? this.clock(best.time) : "--:--";

      row.append(name, time, value);
      this.recordTable.append(row);
    }
  },

  refreshMenu() {
    this.menuDifficulty.textContent = Settings.difficulty().label;
    this.menuBest.textContent = this.pad(Settings.best().score);
  },

  /* ---------- troca de tela ---------- */

  show(view) {
    this.view = view;
    this.panel.dataset.view = view;
    this.panel.classList.add("is-open");
    document.body.classList.add("is-paneled");

    if (view === "menu") this.refreshMenu();
    if (view === "options") this.refreshOptionValues();
    if (view === "records") this.buildRecords();

    // toda tela abre pelo topo. Sem isto, uma tela mais alta que o painel
    // (o "como jogar" no celular deitado) abria rolada até o fim, porque
    // focar o primeiro item de navegação arrastava o painel até ele
    this.panel.scrollTop = 0;
    this.focusFirst();
  },

  hide() {
    this.panel.classList.remove("is-open");
    document.body.classList.remove("is-paneled");
    const focused = document.activeElement;
    if (focused && this.panel.contains(focused)) focused.blur();
  },

  showOver({ score, time, best, isRecord }) {
    this.overScore.textContent = this.pad(score);
    this.overTime.textContent = this.clock(time);
    this.overBest.textContent = this.pad(best.score);
    this.overBadge.hidden = !isRecord;
    this.show("over");
  },

  /* ---------- navegação ---------- */

  items() {
    const screen = this.panel.querySelector(`[data-screen="${this.view}"]`);
    return screen ? Array.from(screen.querySelectorAll("[data-nav]")) : [];
  },

  focusFirst() {
    const items = this.items();
    if (items.length) items[0].focus({ preventScroll: true });
  },

  moveFocus(step) {
    const items = this.items();
    if (!items.length) return;
    const current = items.indexOf(document.activeElement);
    const next = (current + step + items.length) % items.length;
    items[next].focus();
    Sound.play("select");
  },

  onClick(event) {
    const row = event.target.closest("[data-option]");
    if (row) {
      this.changeOption(row.dataset.option, 1);
      return;
    }
    const button = event.target.closest("[data-action]");
    if (button) this.run(button.dataset.action);
  },

  changeOption(key, direction) {
    Settings.cycle(key, direction);
    this.refreshOptionValues();
    Sound.play("select");
  },

  run(action) {
    Sound.play(action === "play" ? "start" : "select");

    switch (action) {
      case "play":
        this.hide();
        this.actions.onPlay();
        break;
      case "options":
        this.optionsReturn = this.view;
        this.show("options");
        break;
      case "records":
        this.show("records");
        break;
      case "help":
        this.helpReturn = this.view;
        this.show("help");
        break;
      case "reset":
        Settings.resetBests();
        this.buildRecords();
        break;
      case "resume":
        this.hide();
        this.actions.onResume();
        break;
      case "quit":
        this.actions.onQuit();
        this.show("menu");
        break;
      case "back":
        if (this.view === "options") this.show(this.optionsReturn);
        else if (this.view === "help") this.show(this.helpReturn || "menu");
        else this.show("menu");
        break;
    }
  },

  onKeyDown(event) {
    if (!this.panel.classList.contains("is-open")) return;

    const focused = document.activeElement;
    const onOption = focused && focused.dataset && focused.dataset.option;

    switch (event.key) {
      case "ArrowUp":
      case "w":
      case "W":
        event.preventDefault();
        this.moveFocus(-1);
        break;
      case "ArrowDown":
      case "s":
      case "S":
        event.preventDefault();
        this.moveFocus(1);
        break;
      case "ArrowLeft":
        if (!onOption) return;
        event.preventDefault();
        this.changeOption(focused.dataset.option, -1);
        break;
      case "ArrowRight":
        if (!onOption) return;
        event.preventDefault();
        this.changeOption(focused.dataset.option, 1);
        break;
      case "Escape":
        event.preventDefault();
        if (this.view === "pause") this.run("resume");
        else if (this.view !== "menu" && this.view !== "over") this.run("back");
        break;
      default:
        return;
    }
    // impede que o jogo veja a mesma tecla
    event.stopPropagation();
  },

  /* ---------- reflexos das preferências no documento ---------- */

  applyBodyFlags() {
    document.body.classList.toggle("no-crt", !Settings.get("crt"));
    document.body.classList.toggle("lefty", Settings.get("hand") === "canhoto");
  },

  onSettingChange(key) {
    if (key === "crt" || key === "hand") this.applyBodyFlags();
    if (key === "difficulty") this.refreshMenu();
    if (this.actions.onSettingChange) this.actions.onSettingChange(key);
  },
};
