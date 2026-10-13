// Musique dynamique composée en direct (aucun fichier) : un séquenceur joue des couches
// (nappe, basse, batterie, arpège) dont l'intensité suit l'action : menu, achat, combat, spike posé, dernier survivant.

// La mineur : la - fa - do - sol (i - VI - III - VII)
const ACCORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const note = (n) => 440 * Math.pow(2, (n - 69) / 12);

const ETATS = {
  silence: { tempo: 90, nappe: 0, basse: 0, kick: 0, caisse: 0, charley: 0, arpege: 0 },
  menu: { tempo: 84, nappe: 0.55, basse: 0.25, kick: 0, caisse: 0, charley: 0.08, arpege: 0.18 },
  calme: { tempo: 96, nappe: 0.35, basse: 0.3, kick: 0.35, caisse: 0, charley: 0.15, arpege: 0.12 },
  achat: { tempo: 100, nappe: 0.45, basse: 0.35, kick: 0.25, caisse: 0, charley: 0.18, arpege: 0.25 },
  combat: { tempo: 112, nappe: 0.25, basse: 0.45, kick: 0.5, caisse: 0.3, charley: 0.25, arpege: 0.1 },
  spike: { tempo: 136, nappe: 0.3, basse: 0.55, kick: 0.6, caisse: 0.4, charley: 0.35, arpege: 0.35 },
  tension: { tempo: 72, nappe: 0.5, basse: 0.5, kick: 0.55, caisse: 0, charley: 0, arpege: 0 },
};

export class Musique {
  constructor(audio) {
    this.audio = audio;
    this.volume = 0.45;
    this.nom = "silence";
    this.etatCourant = ETATS.silence;
    this.pas = 0;
    this.prochain = 0;
    this.minuterie = null;
    this.gains = null;
  }

  // Démarre le séquenceur (après une action de l'utilisateur, à cause des règles des navigateurs)
  demarrer() {
    const ctx = this.audio.ctx;
    if (!ctx || this.gains) return;
    this.sortie = ctx.createGain();
    this.sortie.gain.value = this.volume * 0.5;
    this.sortie.connect(this.audio.maitre);
    this.gains = {};
    for (const k of ["nappe", "basse", "kick", "caisse", "charley", "arpege"]) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.sortie);
      this.gains[k] = g;
    }
    // Filtre de la nappe : une lente respiration
    this.filtreNappe = ctx.createBiquadFilter();
    this.filtreNappe.type = "lowpass";
    this.filtreNappe.frequency.value = 900;
    this.filtreNappe.connect(this.gains.nappe);
    this.prochain = ctx.currentTime + 0.1;
    this.appliquer();
    this.minuterie = setInterval(() => this.planifier(), 30);
  }

  reglerVolume(v) {
    this.volume = v;
    if (this.sortie) this.sortie.gain.setTargetAtTime(v * 0.5, this.audio.ctx.currentTime, 0.1);
  }

  etat(nom) {
    if (!ETATS[nom] || nom === this.nom) return;
    this.nom = nom;
    this.etatCourant = ETATS[nom];
    this.appliquer();
  }

  appliquer() {
    if (!this.gains) return;
    const t = this.audio.ctx.currentTime;
    for (const [k, g] of Object.entries(this.gains)) g.gain.setTargetAtTime(this.etatCourant[k], t, 0.8);
  }

  // Petits motifs joués une seule fois
  jingle(type) {
    const ctx = this.audio.ctx;
    if (!ctx || !this.sortie) return;
    const t = ctx.currentTime + 0.05;
    const suites = {
      victoire: [[69, 0], [72, 0.15], [76, 0.3], [81, 0.45], [76, 0.6], [81, 0.75]],
      defaite: [[69, 0], [67, 0.25], [64, 0.5], [57, 0.8]],
      manche: [[76, 0], [81, 0.12]],
      perdue: [[64, 0], [60, 0.18]],
    };
    for (const [n, r] of suites[type] || []) this.voix("triangle", note(n), t + r, 0.35, 0.2, this.sortie);
  }

  voix(forme, freq, t, duree, vol, sortie, attaque = 0.005) {
    const ctx = this.audio.ctx;
    const o = ctx.createOscillator();
    o.type = forme;
    o.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attaque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    o.connect(g).connect(sortie);
    o.start(t);
    o.stop(t + duree + 0.05);
    return o;
  }

  bruit(t, duree, vol, freq, type, sortie) {
    const ctx = this.audio.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.audio.bruit;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    src.connect(f).connect(g).connect(sortie);
    src.start(t, Math.random() * 0.5, duree + 0.02);
  }

  planifier() {
    const ctx = this.audio.ctx;
    if (!ctx || ctx.state !== "running") return;
    const e = this.etatCourant;
    const doubleCroche = 60 / e.tempo / 4;
    // Si l'onglet a été mis en pause, on repart proprement
    if (this.prochain < ctx.currentTime - 0.5) this.prochain = ctx.currentTime + 0.05;
    while (this.prochain < ctx.currentTime + 0.15) {
      this.jouerPas(this.pas, this.prochain, doubleCroche);
      this.prochain += doubleCroche;
      this.pas = (this.pas + 1) % 64;
    }
  }

  jouerPas(p, t, dc) {
    const e = this.etatCourant;
    const mesure = Math.floor(p / 16), dans = p % 16;
    const accord = ACCORDS[mesure % 4];
    const g = this.gains;
    if (dans === 0 && e.nappe > 0) {
      for (const n of accord) for (const d of [-6, 6]) {
        const o = this.voix("sawtooth", note(n), t, dc * 16 * 1.05, 0.05, this.filtreNappe, dc * 5);
        o.detune.value = d;
      }
      this.filtreNappe.frequency.setTargetAtTime(700 + (mesure % 2) * 500, t, 1.5);
    }
    if (e.basse > 0 && (this.nom === "tension" ? dans % 8 === 0 : dans % 4 === 0 || dans === 14)) {
      this.voix(this.nom === "spike" ? "square" : "triangle", note(accord[0] - 24), t, dc * 3, 0.32, g.basse);
    }
    if (e.kick > 0 && (this.nom === "tension" ? dans === 0 || dans === 3 : dans % 4 === 0)) {
      const o = this.voix("sine", 120, t, 0.25, 0.9, g.kick);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.18);
    }
    if (e.caisse > 0 && (dans === 4 || dans === 12)) this.bruit(t, 0.16, 0.5, 1800, "bandpass", g.caisse);
    if (e.charley > 0 && dans % 2 === 0) this.bruit(t, dans % 4 === 2 ? 0.06 : 0.03, 0.35, 7000, "highpass", g.charley);
    if (e.arpege > 0 && dans % (this.nom === "spike" ? 1 : 2) === 0) {
      const n = accord[(dans / (this.nom === "spike" ? 1 : 2)) % 3] + (dans >= 8 ? 12 : 0);
      this.voix("triangle", note(n + 12), t, dc * 1.6, 0.1, g.arpege);
    }
  }
}
