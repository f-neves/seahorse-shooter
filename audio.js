/* ============================================================
   Som sintetizado em WebAudio.

   O repositório não tem (e não precisa ter) arquivos de áudio: cada
   efeito é gerado na hora por osciladores e ruído filtrado. Isso deixa
   o jogo com zero asset de som e nenhuma requisição de rede.

   Depende de settings.js.
   ============================================================ */

const Sound = {
  ctx: null,
  master: null,
  sfxBus: null,
  musicBus: null,
  noiseBuffer: null,

  unlocked: false,
  musicWanted: false,
  musicTimer: null,
  step: 0,
  nextNoteAt: 0,

  /* trilha: pentatônica menor em Lá, oito semicolcheias que repetem */
  TEMPO: 0.15,
  ARP: [220, 261.63, 293.66, 329.63, 392, 329.63, 293.66, 261.63],
  BASS: [110, 0, 82.41, 0, 98, 0, 110, 0],

  init() {
    Settings.onChange((key) => {
      if (key === "volume" || key === "music" || key === "sfx") {
        this.applyVolume();
      }
    });

    // o navegador só libera áudio depois de um gesto do usuário
    const unlock = () => {
      this.ensureContext();
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
      this.unlocked = true;
      if (this.musicWanted) this.startMusic();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock);

    return this;
  },

  ensureContext() {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
    } catch (error) {
      return null; // navegador sem WebAudio: o jogo roda mudo
    }

    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);

    // ruído branco de dois segundos, reaproveitado por toda explosão
    const frames = this.ctx.sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

    this.applyVolume();
    return this.ctx;
  },

  masterVolume() {
    return Settings.get("volume") / 100;
  },

  applyVolume() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.setValueAtTime(this.masterVolume(), now);
    this.sfxBus.gain.setValueAtTime(Settings.get("sfx") ? 1 : 0, now);
    this.musicBus.gain.setValueAtTime(Settings.get("music") ? 0.5 : 0, now);

    if (!Settings.get("music") || this.masterVolume() === 0) this.stopMusic();
    else if (this.musicWanted) this.startMusic();
  },

  /* ---------- blocos de síntese ---------- */

  tone({
    type = "square",
    from,
    to = from,
    gain = 0.2,
    attack = 0.005,
    dur = 0.15,
    at = 0,
  }) {
    const ctx = this.ctx;
    const start = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    if (to !== from) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + dur);
    }

    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    osc.connect(amp).connect(this.sfxBus);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  },

  noise({ gain = 0.3, dur = 0.3, cutoff = 1200, sweep = 200, at = 0 }) {
    const ctx = this.ctx;
    const start = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();

    src.buffer = this.noiseBuffer;
    src.loop = true;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, start);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(60, sweep),
      start + dur
    );

    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    src.connect(filter).connect(amp).connect(this.sfxBus);
    src.start(start);
    src.stop(start + dur + 0.02);
  },

  /* ---------- efeitos ---------- */

  play(name) {
    if (!Settings.get("sfx") || this.masterVolume() === 0) return;
    if (!this.ensureContext()) return;
    if (this.ctx.state === "suspended") return;

    switch (name) {
      case "laser":
        this.tone({ type: "square", from: 900, to: 220, gain: 0.13, dur: 0.1 });
        break;
      case "double":
        this.tone({ type: "square", from: 900, to: 220, gain: 0.11, dur: 0.1 });
        this.tone({
          type: "square",
          from: 620,
          to: 160,
          gain: 0.09,
          dur: 0.12,
          at: 0.02,
        });
        break;
      case "empty":
        this.tone({ type: "square", from: 150, to: 110, gain: 0.05, dur: 0.05 });
        break;
      case "hit":
        this.noise({ gain: 0.13, dur: 0.09, cutoff: 2600, sweep: 900 });
        break;
      case "explode":
        this.noise({ gain: 0.3, dur: 0.42, cutoff: 1400, sweep: 90 });
        this.tone({ type: "triangle", from: 180, to: 42, gain: 0.16, dur: 0.34 });
        break;
      case "big":
        this.noise({ gain: 0.38, dur: 0.75, cutoff: 1000, sweep: 60 });
        this.tone({ type: "triangle", from: 130, to: 32, gain: 0.2, dur: 0.6 });
        break;
      case "power":
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
          this.tone({
            type: "square",
            from: freq,
            gain: 0.12,
            dur: 0.13,
            at: i * 0.06,
          })
        );
        break;
      case "damage":
        this.tone({ type: "sawtooth", from: 320, to: 70, gain: 0.22, dur: 0.4 });
        this.noise({ gain: 0.16, dur: 0.25, cutoff: 700, sweep: 100 });
        break;
      case "select":
        this.tone({ type: "square", from: 660, gain: 0.09, dur: 0.05 });
        break;
      case "start":
        [392, 523.25, 659.25].forEach((freq, i) =>
          this.tone({
            type: "square",
            from: freq,
            gain: 0.13,
            dur: 0.16,
            at: i * 0.09,
          })
        );
        break;
      case "over":
        [392, 329.63, 261.63, 196].forEach((freq, i) =>
          this.tone({
            type: "triangle",
            from: freq,
            gain: 0.18,
            dur: 0.34,
            at: i * 0.17,
          })
        );
        break;
    }
  },

  /* ---------- trilha ---------- */

  wantMusic(on) {
    this.musicWanted = on;
    if (on) this.startMusic();
    else this.stopMusic();
  },

  startMusic() {
    if (this.musicTimer) return;
    if (!this.unlocked || !Settings.get("music") || this.masterVolume() === 0) {
      return;
    }
    if (!this.ensureContext()) return;
    if (this.ctx.state === "suspended") this.ctx.resume();

    this.step = 0;
    this.nextNoteAt = this.ctx.currentTime + 0.1;
    // agendador com lookahead: setInterval sozinho não tem precisão rítmica
    this.musicTimer = setInterval(() => this.scheduleMusic(), 40);
  },

  stopMusic() {
    if (!this.musicTimer) return;
    clearInterval(this.musicTimer);
    this.musicTimer = null;
  },

  scheduleMusic() {
    if (!this.ctx) return;
    while (this.nextNoteAt < this.ctx.currentTime + 0.2) {
      const at = this.nextNoteAt - this.ctx.currentTime;
      const slot = this.step % 8;

      this.musicVoice({
        type: "triangle",
        freq: this.ARP[slot],
        gain: 0.05,
        dur: 0.22,
        at,
      });
      const bass = this.BASS[slot];
      if (bass) {
        this.musicVoice({ type: "sine", freq: bass, gain: 0.1, dur: 0.34, at });
      }

      this.nextNoteAt += this.TEMPO;
      this.step++;
    }
  },

  musicVoice({ type, freq, gain, dur, at }) {
    const start = this.ctx.currentTime + Math.max(0, at);
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(amp).connect(this.musicBus);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  },

  vibrate(pattern) {
    if (!Settings.get("haptics")) return;
    if (navigator.vibrate) navigator.vibrate(pattern);
  },
};

Sound.init();
