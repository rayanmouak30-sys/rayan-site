// Sons synthétisés en direct (aucun fichier audio). Les sons des bots sont spatialisés :
// on entend de quel côté ils tirent ou marchent.

export class Audio {
  constructor() {
    this.ctx = null;
    this.volume = 0.7;
    this.volumeAmbiance = 0.5;
    this.derniers = {};
  }

  // Évite d'empiler le même son plusieurs fois dans un temps très court.
  limite(cle, ecart) {
    const t = performance.now();
    if (t - (this.derniers[cle] || 0) < ecart * 1000) return false;
    this.derniers[cle] = t;
    return true;
  }

  demarrer() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.maitre = this.ctx.createGain();
    this.maitre.gain.value = this.volume;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.maitre.connect(comp).connect(this.ctx.destination);

    const n = this.ctx.sampleRate;
    this.bruit = this.ctx.createBuffer(1, n, n);
    const d = this.bruit.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;

    // Réverbération courte (impulsion générée) pour donner de l'espace aux tirs.
    const len = Math.floor(n * 1.1);
    const ir = this.ctx.createBuffer(2, len, n);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = ir;
    this.envoiReverb = this.ctx.createGain();
    this.envoiReverb.gain.value = 0.22;
    this.envoiReverb.connect(this.reverb).connect(this.maitre);
    this.lancerAmbiance();
  }

  // Ambiance de l'arène : vent filtré qui ondule + rumeur grave de la ville au loin.
  lancerAmbiance() {
    const ctx = this.ctx;
    this.gainAmbiance = ctx.createGain();
    this.gainAmbiance.gain.value = this.volumeAmbiance * 0.35;
    this.gainAmbiance.connect(this.maitre);
    const vent = ctx.createBufferSource();
    vent.buffer = this.bruit;
    vent.loop = true;
    const filtre = ctx.createBiquadFilter();
    filtre.type = "lowpass";
    filtre.frequency.value = 420;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(filtre.frequency);
    const gVent = ctx.createGain();
    gVent.gain.value = 0.5;
    vent.connect(filtre).connect(gVent).connect(this.gainAmbiance);
    vent.start();
    lfo.start();
    for (const [f, v] of [[55, 0.05], [82.5, 0.03], [110, 0.015]]) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = v;
      o.connect(g).connect(this.gainAmbiance);
      o.start();
    }
  }

  reglerAmbiance(v) {
    this.volumeAmbiance = v;
    if (this.gainAmbiance) this.gainAmbiance.gain.value = v * 0.35;
  }

  // Sons d'interface
  clic() {
    if (!this.ctx) return;
    this.oscillo(this.maitre, "triangle", 1400, 900, 0.06, 0.08);
  }

  survol() {
    if (!this.ctx || !this.limite("survol", 0.05)) return;
    this.oscillo(this.maitre, "sine", 2200, 2000, 0.03, 0.03);
  }

  // Balle qui passe tout près de la tête
  sifflement(position) {
    if (!this.ctx || !this.limite("siffle", 0.08)) return;
    const s = this.sortie(position);
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(3200, t);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.connect(g).connect(s);
    o.start(t);
    o.stop(t + 0.15);
    this.bruitFiltre(s, "highpass", 5000, 1, 0.08, 0.06);
  }

  reglerVolume(v) {
    this.volume = v;
    if (this.maitre) this.maitre.gain.value = v;
  }

  // Position et orientation de l'auditeur (la caméra).
  ecouteur(px, py, pz, fx, fy, fz) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    if (l.positionX) {
      const t = this.ctx.currentTime;
      l.positionX.setValueAtTime(px, t); l.positionY.setValueAtTime(py, t); l.positionZ.setValueAtTime(pz, t);
      l.forwardX.setValueAtTime(fx, t); l.forwardY.setValueAtTime(fy, t); l.forwardZ.setValueAtTime(fz, t);
      l.upX.setValueAtTime(0, t); l.upY.setValueAtTime(1, t); l.upZ.setValueAtTime(0, t);
    } else {
      l.setPosition(px, py, pz);
      l.setOrientation(fx, fy, fz, 0, 1, 0);
    }
  }

  sortie(position) {
    if (!position) return this.maitre;
    const p = this.ctx.createPanner();
    p.panningModel = "HRTF";
    p.distanceModel = "inverse";
    p.refDistance = 3;
    p.rolloffFactor = 1.1;
    p.maxDistance = 120;
    if (p.positionX) {
      p.positionX.value = position.x; p.positionY.value = position.y; p.positionZ.value = position.z;
    } else {
      p.setPosition(position.x, position.y, position.z);
    }
    p.connect(this.maitre);
    return p;
  }

  bruitFiltre(sortie, type, freq, q, duree, vol, attaque = 0.002) {
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.bruit;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attaque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    src.connect(f).connect(g).connect(sortie);
    src.start(t, Math.random() * 0.6, duree + 0.05);
    return g;
  }

  oscillo(sortie, forme, f1, f2, duree, vol, retard = 0) {
    const t = this.ctx.currentTime + retard;
    const o = this.ctx.createOscillator();
    o.type = forme;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + duree);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    o.connect(g).connect(sortie);
    o.start(t);
    o.stop(t + duree + 0.03);
  }

  // ----- Sons du jeu -----
  tirJoueur() {
    if (!this.ctx) return;
    const s = this.maitre;
    const g = this.bruitFiltre(s, "lowpass", 3800, 0.7, 0.16, 0.55);
    g.connect(this.envoiReverb);
    this.bruitFiltre(s, "bandpass", 1400, 1.2, 0.07, 0.35);
    this.oscillo(s, "sine", 150, 42, 0.13, 0.75);
    this.oscillo(s, "square", 2600, 900, 0.025, 0.05);
  }

  tirBot(position, distance) {
    if (!this.ctx) return;
    const s = this.sortie(position);
    const loin = Math.min(1, distance / 40);
    const g = this.bruitFiltre(s, "lowpass", 2600 - loin * 1500, 0.7, 0.18, 0.6);
    g.connect(this.envoiReverb);
    this.oscillo(s, "sine", 120, 40, 0.12, 0.5);
  }

  pas(position, fort = 1) {
    if (!this.ctx) return;
    const s = this.sortie(position);
    this.bruitFiltre(s, "bandpass", 420 + Math.random() * 220, 2.2, 0.09, 0.35 * fort);
    this.bruitFiltre(s, "highpass", 3000, 0.8, 0.04, 0.05 * fort);
  }

  pasJoueur(fort = 1) {
    if (!this.ctx || !this.limite("pasJoueur", 0.12)) return;
    this.bruitFiltre(this.maitre, "bandpass", 380 + Math.random() * 200, 2, 0.08, 0.12 * fort);
  }

  impact(position) {
    if (!this.ctx || !this.limite("impact", 0.03)) return;
    const s = this.sortie(position);
    this.bruitFiltre(s, "highpass", 2400, 1, 0.06, 0.18);
    if (Math.random() < 0.25) this.oscillo(s, "sine", 3200 + Math.random() * 1500, 1200, 0.18, 0.04);
  }

  touche(tete) {
    if (!this.ctx) return;
    if (tete) {
      this.oscillo(this.maitre, "triangle", 1900, 1900, 0.09, 0.22);
      this.oscillo(this.maitre, "sine", 2850, 2850, 0.14, 0.12, 0.01);
    } else {
      this.oscillo(this.maitre, "square", 1150, 1000, 0.045, 0.07);
    }
  }

  elimination(serie) {
    if (!this.ctx) return;
    const base = 520 * Math.pow(1.122, Math.min(serie, 5) - 1);
    this.oscillo(this.maitre, "triangle", base, base, 0.1, 0.2);
    this.oscillo(this.maitre, "triangle", base * 1.5, base * 1.5, 0.16, 0.18, 0.08);
  }

  degat() {
    if (!this.ctx) return;
    this.oscillo(this.maitre, "sine", 90, 50, 0.22, 0.6);
    this.bruitFiltre(this.maitre, "lowpass", 600, 1, 0.12, 0.3);
  }

  rechargement(etape) {
    if (!this.ctx) return;
    const freqs = [900, 1400, 2200];
    this.bruitFiltre(this.maitre, "bandpass", freqs[etape] || 1200, 6, 0.05, 0.25);
    this.oscillo(this.maitre, "square", (freqs[etape] || 1200) / 2, 200, 0.03, 0.05);
  }

  vide() {
    if (!this.ctx) return;
    this.bruitFiltre(this.maitre, "bandpass", 2500, 8, 0.03, 0.2);
  }

  ruee() {
    if (!this.ctx) return;
    this.bruitFiltre(this.maitre, "bandpass", 900, 0.8, 0.3, 0.35, 0.04);
    this.oscillo(this.maitre, "sine", 220, 880, 0.22, 0.12);
  }

  annonce(type) {
    if (!this.ctx) return;
    const notes = {
      debut: [[392, 0], [523, 0.12], [659, 0.24]],
      victoire: [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.3]],
      defaite: [[440, 0], [370, 0.15], [294, 0.3]],
      compte: [[880, 0]],
      manche: [[330, 0], [440, 0.14]],
    }[type] || [];
    for (const [f, r] of notes) this.oscillo(this.maitre, "triangle", f, f, 0.35, 0.16, r);
  }
}
