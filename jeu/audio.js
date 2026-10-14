// Sons synthétisés en direct (aucun fichier audio). Les sons des bots sont spatialisés :
// on entend de quel côté ils tirent ou marchent.

export class Audio {
  constructor() {
    this.ctx = null;
    this.volume = 0.7;
    this.volumeAmbiance = 0.5;
    this.derniers = {};
    this.annonceur = true;
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
    // Valeurs toujours valides : une erreur audio ne doit jamais bloquer le jeu
    vol = Number.isFinite(vol) && vol > 0.0001 ? vol : 0.0001;
    duree = Number.isFinite(duree) && duree > 0.01 ? duree : 0.01;
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
    vol = Number.isFinite(vol) && vol > 0.0001 ? vol : 0.0001;
    duree = Number.isFinite(duree) && duree > 0.01 ? duree : 0.01;
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
  // Signature sonore de chaque arme
  coupDeFeu(s, id, distance = 0) {
    const loin = Math.min(1, distance / 40);
    if (id === "pistolet") {
      this.bruitFiltre(s, "lowpass", 4600 - loin * 2200, 0.7, 0.11, 0.42).connect(this.envoiReverb);
      this.bruitFiltre(s, "bandpass", 2000, 1.4, 0.05, 0.3);
      this.oscillo(s, "sine", 230, 60, 0.08, 0.5);
    } else if (id === "pompe") {
      this.bruitFiltre(s, "lowpass", 2400 - loin * 1200, 0.6, 0.34, 0.85).connect(this.envoiReverb);
      this.bruitFiltre(s, "bandpass", 700, 0.9, 0.14, 0.45);
      this.oscillo(s, "sine", 95, 28, 0.26, 0.95);
    } else if (id === "pulsar") {
      // Impulsion d'énergie : claquement + glissando électronique
      this.bruitFiltre(s, "bandpass", 2600 - loin * 1200, 1.1, 0.07, 0.4);
      this.bruitFiltre(s, "lowpass", 3000 - loin * 1500, 0.7, 0.14, 0.45).connect(this.envoiReverb);
      this.oscillo(s, "sawtooth", 1500, 180, 0.09, 0.13);
      this.oscillo(s, "square", 760, 95, 0.07, 0.08);
      this.oscillo(s, "sine", 140, 45, 0.12, 0.7);
    } else if (id === "sniper") {
      this.bruitFiltre(s, "highpass", 2600, 0.8, 0.05, 0.55);
      this.bruitFiltre(s, "lowpass", 3200 - loin * 1800, 0.6, 0.55, 0.9).connect(this.envoiReverb);
      this.oscillo(s, "sine", 75, 22, 0.42, 1.0);
      this.oscillo(s, "square", 1800, 600, 0.03, 0.08);
    } else {
      this.bruitFiltre(s, "lowpass", 3800 - loin * 1600, 0.7, 0.16, 0.55).connect(this.envoiReverb);
      this.bruitFiltre(s, "bandpass", 1400, 1.2, 0.07, 0.35);
      this.oscillo(s, "sine", 150, 42, 0.13, 0.75);
      this.oscillo(s, "square", 2600, 900, 0.025, 0.05);
    }
  }

  tirJoueur(id = "fusil") {
    if (!this.ctx) return;
    this.coupDeFeu(this.maitre, id);
    // Réarmement mécanique (pompe, verrou)
    if (id === "pompe") { this.cliquetis(0.2, 700); this.cliquetis(0.42, 1000); }
    if (id === "sniper") { this.cliquetis(0.32, 1300); this.cliquetis(0.55, 900); this.cliquetis(0.82, 1500); }
  }

  tirBot(position, distance, id = "fusil") {
    if (!this.ctx || !this.limite("tirBot" + Math.round(position.x * 10), 0.04)) return;
    this.coupDeFeu(this.sortie(position), id, distance);
  }

  cliquetis(retard, freq) {
    const t = this.ctx.currentTime + retard;
    const src = this.ctx.createBufferSource();
    src.buffer = this.bruit;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 5;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    src.connect(f).connect(g).connect(this.maitre);
    src.start(t, Math.random() * 0.5, 0.08);
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

  // ----- Armes, équipement, boutique -----
  equiper(id) {
    if (!this.ctx || !this.limite("equiper", 0.05)) return;
    if (id === "couteau") { this.bruitFiltre(this.maitre, "highpass", 5000, 1, 0.18, 0.12, 0.05); return; }
    this.cliquetis(0, 900); this.cliquetis(0.08, 1400);
  }

  couteau(touche) {
    if (!this.ctx) return;
    if (touche) { this.bruitFiltre(this.maitre, "lowpass", 900, 1, 0.12, 0.5); this.oscillo(this.maitre, "sine", 160, 60, 0.1, 0.4); }
    else {
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource(); src.buffer = this.bruit;
      const f = this.ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 2;
      f.frequency.setValueAtTime(1200, t); f.frequency.exponentialRampToValueAtTime(5000, t + 0.15);
      const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      src.connect(f).connect(g).connect(this.maitre); src.start(t, Math.random() * 0.5, 0.2);
    }
  }

  achat(ok) {
    if (!this.ctx) return;
    if (ok) { this.oscillo(this.maitre, "triangle", 1320, 1320, 0.08, 0.15); this.oscillo(this.maitre, "triangle", 1760, 1760, 0.12, 0.13, 0.06); }
    else this.oscillo(this.maitre, "triangle", 900, 600, 0.12, 0.12);
  }

  ramassage() {
    if (!this.ctx) return;
    this.cliquetis(0, 1600);
    this.cliquetis(0.07, 2200);
    [880, 1320].forEach((f, i) => this.oscillo(this.maitre, "triangle", f, f, 0.12, 0.12, 0.1 + i * 0.07));
  }

  refus() {
    if (!this.ctx) return;
    this.oscillo(this.maitre, "square", 160, 140, 0.15, 0.1);
  }

  // ----- Compétences -----
  lancer() {
    if (!this.ctx) return;
    this.bruitFiltre(this.maitre, "bandpass", 1200, 0.7, 0.25, 0.18, 0.05);
    this.cliquetis(0, 2600);
  }

  rebond(position) {
    if (!this.ctx || !this.limite("rebond", 0.08)) return;
    this.oscillo(this.sortie(position), "triangle", 2400 + Math.random() * 600, 1800, 0.06, 0.12);
  }

  fumee(position) {
    if (!this.ctx) return;
    this.bruitFiltre(this.sortie(position), "highpass", 1800, 0.5, 1.6, 0.35, 0.08);
  }

  flash(position) {
    if (!this.ctx) return;
    const s = this.sortie(position);
    this.bruitFiltre(s, "lowpass", 3000, 0.6, 0.35, 0.8).connect(this.envoiReverb);
    this.oscillo(s, "sine", 2600, 2400, 0.4, 0.15);
  }

  // Sifflement d'oreilles quand on est aveuglé
  acouphene(intensite, duree) {
    if (!this.ctx || !(intensite > 0) || !(duree > 0) || !this.limite("acouphene", 0.5)) return;
    this.oscillo(this.maitre, "sine", 3600, 3500, duree, 0.05 * intensite);
  }

  mur(position) {
    if (!this.ctx) return;
    const s = this.sortie(position);
    this.oscillo(s, "sawtooth", 140, 520, 0.45, 0.12);
    this.bruitFiltre(s, "bandpass", 600, 1, 0.5, 0.2, 0.1);
  }

  soin() {
    if (!this.ctx) return;
    [660, 880, 1100, 1320].forEach((f, i) => this.oscillo(this.maitre, "sine", f, f, 0.25, 0.1, i * 0.08));
  }

  ultime() {
    if (!this.ctx) return;
    this.bruitFiltre(this.maitre, "bandpass", 500, 0.6, 0.8, 0.35, 0.2);
    [220, 277, 330, 440].forEach((f, i) => this.oscillo(this.maitre, "triangle", f, f * 2, 0.6, 0.12, i * 0.05));
  }

  droneStart() {
    if (!this.ctx) return null;
    const o = this.ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = 118;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.value = 0.06;
    const p = this.sortie({ x: 0, y: 0, z: 0 });
    o.connect(f).connect(g).connect(p);
    o.start();
    return { o, g, p };
  }

  droneMaj(h, pos) {
    if (!h) return;
    const p = h.p;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; }
    else p.setPosition(pos.x, pos.y, pos.z);
    h.o.frequency.value = 118 + Math.sin(this.ctx.currentTime * 7) * 6;
  }

  droneStop(h) {
    if (!h) return;
    try { h.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05); h.o.stop(this.ctx.currentTime + 0.3); } catch (e) { /* déjà arrêté */ }
  }

  // Sons des capacités des personnages (tous synthétisés)
  capacite(type, position = null) {
    if (!this.ctx || !this.limite("cap" + type, 0.05)) return;
    const s = this.sortie(position);
    switch (type) {
      case "explosion":
        this.bruitFiltre(s, "lowpass", 1800, 0.6, 0.9, 0.85, 0.005).connect(this.envoiReverb);
        this.oscillo(s, "sine", 90, 28, 0.7, 0.7);
        break;
      case "zone":
        this.bruitFiltre(s, "bandpass", 700, 0.8, 0.8, 0.3, 0.1);
        this.oscillo(s, "triangle", 300, 180, 0.5, 0.08);
        break;
      case "feu":
        this.bruitFiltre(s, "bandpass", 1400, 0.5, 1.2, 0.35, 0.05);
        this.bruitFiltre(s, "lowpass", 500, 0.7, 1.0, 0.3, 0.02);
        break;
      case "sonar":
        this.oscillo(s, "sine", 1760, 1700, 0.35, 0.18);
        this.oscillo(s, "sine", 880, 860, 0.5, 0.08, 0.05);
        break;
      case "commotion":
        this.oscillo(s, "sine", 120, 40, 0.6, 0.6);
        this.bruitFiltre(s, "lowpass", 600, 0.7, 0.5, 0.5, 0.005);
        break;
      case "emp":
        this.oscillo(s, "sawtooth", 1800, 60, 0.45, 0.2);
        this.bruitFiltre(s, "highpass", 3000, 0.7, 0.4, 0.35, 0.003);
        break;
      case "camo":
        [1200, 1600, 2000].forEach((f, i) => this.oscillo(s, "sine", f, f * 0.6, 0.35, 0.06, i * 0.05));
        break;
      case "tourelle":
        this.bruitFiltre(s, "bandpass", 2600, 1.5, 0.06, 0.35, 0.002);
        this.oscillo(s, "square", 900, 300, 0.05, 0.06);
        break;
      case "piege":
        this.cliquetis(0, 2400);
        this.oscillo(s, "square", 600, 120, 0.25, 0.15, 0.03);
        break;
      case "teleport":
        this.oscillo(s, "sine", 300, 2400, 0.18, 0.15);
        this.bruitFiltre(s, "highpass", 4000, 0.7, 0.2, 0.2, 0.01);
        break;
      case "saut":
        this.bruitFiltre(s, "lowpass", 900, 0.6, 0.35, 0.4, 0.01);
        this.oscillo(s, "sine", 160, 420, 0.25, 0.15);
        break;
      case "trouNoir":
        this.oscillo(s, "sawtooth", 55, 30, 3.5, 0.18);
        this.bruitFiltre(s, "lowpass", 300, 1, 3.2, 0.3, 0.6);
        break;
      case "seisme":
        this.oscillo(s, "sine", 70, 20, 1.2, 0.9);
        this.bruitFiltre(s, "lowpass", 400, 0.6, 1.2, 0.8, 0.01).connect(this.envoiReverb);
        break;
      case "frappe":
        this.oscillo(s, "sine", 2400, 500, 1.1, 0.08);
        break;
      case "soin":
        [523, 659, 784].forEach((f, i) => this.oscillo(s, "sine", f, f, 0.4, 0.08, i * 0.07));
        break;
      case "bouclier":
        this.oscillo(s, "triangle", 300, 900, 0.3, 0.15);
        this.oscillo(s, "sine", 1200, 1200, 0.25, 0.06, 0.1);
        break;
      case "resurrection":
        [392, 523, 659, 784, 1047].forEach((f, i) => this.oscillo(s, "triangle", f, f, 0.6, 0.1, i * 0.09));
        break;
    }
  }

  // ----- Spike -----
  spikeBip(position, urgent) {
    if (!this.ctx) return;
    this.oscillo(this.sortie(position), "square", urgent ? 1900 : 1500, urgent ? 1900 : 1500, 0.07, 0.18);
  }

  spikePose() {
    if (!this.ctx) return;
    [0, 0.12, 0.24].forEach((r) => this.oscillo(this.maitre, "square", 1200, 1200, 0.08, 0.12, r));
    this.oscillo(this.maitre, "sawtooth", 200, 60, 0.6, 0.2, 0.3);
  }

  spikeDesamorce(fini) {
    if (!this.ctx) return;
    if (fini) [880, 1175, 1760].forEach((f, i) => this.oscillo(this.maitre, "triangle", f, f, 0.3, 0.16, i * 0.1));
    else this.cliquetis(0, 2000);
  }

  explosion(position) {
    if (!this.ctx) return;
    const s = this.sortie(position);
    this.bruitFiltre(s, "lowpass", 1400, 0.5, 2.4, 1.0, 0.01).connect(this.envoiReverb);
    this.oscillo(s, "sine", 60, 18, 1.6, 1.0);
    this.bruitFiltre(this.maitre, "lowpass", 300, 0.5, 1.8, 0.6, 0.02);
  }

  // ----- Annonceur vocal (synthèse vocale du navigateur, en français) -----
  parler(texte) {
    if (!this.annonceur || !("speechSynthesis" in window) || this.volume <= 0) return;
    try {
      const synth = window.speechSynthesis;
      if (synth.pending || synth.speaking) synth.cancel();
      const u = new SpeechSynthesisUtterance(texte);
      u.lang = "fr-FR";
      const voix = synth.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith("fr"));
      if (voix.length) u.voice = voix.find((v) => /google|thomas|amelie|hortense|paul|julie/i.test(v.name)) || voix[0];
      u.rate = 1.08;
      u.pitch = 0.85;
      u.volume = Math.min(1, this.volume * 1.2);
      synth.speak(u);
    } catch (e) { /* synthèse vocale indisponible */ }
  }
}
