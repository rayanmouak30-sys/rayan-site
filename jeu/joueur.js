// Le joueur : physique (pas fixe), inventaire d'armes, tir, couteau, compétences.
// Les commandes viennent indifféremment du clavier/souris, de l'écran tactile ou d'une manette.
import * as THREE from "three";
import { RAYON_PERSO } from "./physique.js";
import { ARMES, LogiqueArme, facteurDistance } from "./armes.js";
import { CAPACITES, nouvelEtatCapacites, majRecharges } from "./capacites.js";
import { HEROS } from "./heros.js";

// Touches de capacité -> emplacement
const EMPLACEMENT_ACTION = { fumee: "c", flash: "q", signature: "e", ultime: "x" };

const DEG = Math.PI / 180;

export function nouvellesStats() {
  return { kills: 0, morts: 0, tetes: 0, tirs: 0, touches: 0, degats: 0, aces: 0, assists: 0, poses: 0, desamorcages: 0, manchesGagnees: 0, killsCouteau: 0, killsSniper: 0, clutchs: 0 };
}

export class Joueur {
  constructor(jeu) {
    this.jeu = jeu;
    this.estJoueur = true;
    this.id = "joueur";
    this.nom = "TOI";
    this.equipe = "bleu";
    this.pos = new THREE.Vector3();
    this.precedente = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.lacet = 0; this.tangage = 0;
    this.vie = 100; this.armure = 0; this.vivant = false; this.auSol = true;
    this.accroupi = false; this.hauteurYeux = 1.62;
    this.rueeT = 0; this.rueeDir = new THREE.Vector3();
    this.pasT = 0; this.sursaut = 0; this.sprint = false; this.chute = 0; this.visee = false;
    this.inventaire = { principale: null, secondaire: "pistolet" };
    this.logiques = {};
    this.armeActive = "pistolet";
    this.armePrecedente = "couteau";
    this.equipeT = 0;
    this.couteau = new LogiqueArme("couteau");
    this.heros = "kael";
    this.capacites = nouvelEtatCapacites("kael", true);
    this.ultime = 0;
    this.chargeT = 0; this.chargeDir = new THREE.Vector3(); this.touchesCharge = new Set(); this.chargeDef = null;
    this.rueeDuree = 0.27; this.rueeVitesse = 30;
    this.aveugleT = 0; this.aveugleMax = 1;
    this.porteSpike = false; this.verrou = false;
    this.credits = 800;
    this.kills = 0; this.morts = 0; this.degats = 0;
    this.stats = nouvellesStats();
    this.gachettePrecedente = false;
    this.videJoue = false;
    this.etapeRechargeSon = 0;
    this.skins = {};
    this.achatsManche = [];
  }

  get x() { return this.pos.x; }
  get z() { return this.pos.z; }
  get y() { return this.pos.y; }
  get yeux() { return this.pos.y + this.hauteurYeux; }
  get vx() { return this.vel.x; }
  get vz() { return this.vel.z; }
  get logique() { return this.armeActive === "couteau" ? this.couteau : this.logiques[this.armeActive]; }
  get def() { return ARMES[this.armeActive]; }
  get herosDef() { return HEROS[this.heros] || HEROS.kael; }

  // Choix du personnage (début de partie) : capacités neuves
  choisirHeros(id, economie) {
    this.heros = HEROS[id] ? id : "kael";
    this.capacites = nouvelEtatCapacites(this.heros, economie);
    this.ultime = 0;
  }

  // Remise en jeu (début de manche, réapparition)
  placer(x, z, lacet = 0) {
    this.pos.set(x, 0, z);
    this.precedente.copy(this.pos);
    this.vel.set(0, 0, 0);
    Object.assign(this, { lacet, tangage: 0, vie: 100, vivant: true, auSol: true, accroupi: false, hauteurYeux: 1.62, rueeT: 0, chargeT: 0, sursaut: 0, chute: 0, aveugleT: 0, verrou: false });
    this.jeu.competences.reinitialiserStatuts(this);
    for (const l of Object.values(this.logiques)) { l.rechargeT = 0; l.serie = 0; l.reculPitch = l.reculYaw = 0; l.cibleRecul = [0, 0]; }
    this.equiper(this.inventaire.principale || this.inventaire.secondaire || "couteau", true);
  }

  // Nouvelle arme : elle remplace celle du même emplacement (munitions pleines)
  donnerArme(id, equiper = true) {
    const def = ARMES[id];
    if (def.emplacement === 1) this.inventaire.principale = id;
    else if (def.emplacement === 2) this.inventaire.secondaire = id;
    this.logiques[id] = new LogiqueArme(id);
    if (equiper) this.equiper(id, true);
  }

  retirerArme(id) {
    if (this.inventaire.principale === id) this.inventaire.principale = null;
    if (this.inventaire.secondaire === id) this.inventaire.secondaire = null;
    delete this.logiques[id];
    if (this.armeActive === id) this.equiper(this.inventaire.principale || this.inventaire.secondaire || "couteau", true);
  }

  // Réinitialise l'équipement (mort, changement de camp)
  equipementDeBase() {
    this.inventaire = { principale: null, secondaire: null };
    this.logiques = {};
    this.donnerArme("pistolet", false);
    this.armure = 0;
  }

  possede(id) { return id === "couteau" || this.inventaire.principale === id || this.inventaire.secondaire === id; }

  equiper(id, force = false) {
    if (!this.possede(id) || (!force && id === this.armeActive)) return;
    if (id !== this.armeActive) this.armePrecedente = this.armeActive;
    if (this.logique && this.logique.rechargeT > 0) this.logique.rechargeT = 0;
    this.armeActive = id;
    const def = ARMES[id];
    this.equipeT = def.equipement;
    this.jeu.vue.equiper(id, this.skins[id] || "standard", def.equipement);
    this.jeu.audio.equiper(id);
    this.etapeRechargeSon = 0;
  }

  emplacement(n) {
    const id = n === 1 ? this.inventaire.principale : n === 2 ? this.inventaire.secondaire : "couteau";
    if (id) this.equiper(id);
  }

  armeSuivante(sens) {
    const ordre = [this.inventaire.principale, this.inventaire.secondaire, "couteau"].filter(Boolean);
    const i = ordre.indexOf(this.armeActive);
    this.equiper(ordre[(i + sens + ordre.length) % ordre.length]);
  }

  // ----- Physique (pas fixe) -----
  physique(dt, cmd, enJeu) {
    const jeu = this.jeu, monde = jeu.carte.monde;
    this.precedente.copy(this.pos);
    const actif = enJeu && this.vivant;
    const def = this.def;
    const cycle = this.logique ? this.logique.progressionCycle : -1;
    this.visee = actif && cmd.viser && def.type !== "melee" && this.logique.rechargeT <= 0 && this.rueeT <= 0 && this.equipeT <= 0 && !(def.type === "verrou" && cycle >= 0) && !this.verrou;

    const veutAccroupi = actif && cmd.accroupi;
    if (veutAccroupi) this.accroupi = true;
    else if (this.accroupi && !monde.bloque(this.pos.x, this.pos.z, this.pos.y, RAYON_PERSO, 1.8)) this.accroupi = false;
    const yeuxCible = this.accroupi ? 1.15 : 1.62;
    this.hauteurYeux += (yeuxCible - this.hauteurYeux) * (1 - Math.exp(-14 * dt));
    const taille = this.accroupi ? 1.3 : 1.8;

    const bouge = actif && !this.verrou;
    const avant = bouge ? cmd.avant : 0;
    const cote = bouge ? cmd.cote : 0;
    const s = Math.sin(this.lacet), c = Math.cos(this.lacet);
    let wx = -s * avant + c * cote, wz = -c * avant - s * cote;
    const n = Math.hypot(wx, wz);
    this.sprint = cmd.sprint && avant > 0.3 && !this.accroupi && !this.visee;
    const base = (def.vitesse || 5) * jeu.competences.facteurVitesse(this);
    const vitesseMax = this.accroupi ? 2.0 : this.visee ? base * (def.lunette ? 0.55 : 0.72) : this.sprint ? base * 1.3 : base;
    if (n > 0) { const k = Math.min(1, n); wx = wx / n * vitesseMax * k; wz = wz / n * vitesseMax * k; }

    if (this.rueeT > 0) {
      this.rueeT -= dt;
      const k = Math.max(0, this.rueeT / this.rueeDuree);
      this.vel.x = this.rueeDir.x * this.rueeVitesse * (0.45 + 0.55 * k);
      this.vel.z = this.rueeDir.z * this.rueeVitesse * (0.45 + 0.55 * k);
    } else if (this.chargeT > 0) {
      // Charge du bélier : course droite qui percute les ennemis sur le passage
      this.chargeT -= dt;
      const d = this.chargeDef;
      this.vel.x = this.chargeDir.x * d.vitesse;
      this.vel.z = this.chargeDir.z * d.vitesse;
      for (const c of jeu.competences.ennemis(this)) {
        if (this.touchesCharge.has(c) || Math.hypot(c.x - this.pos.x, c.z - this.pos.z) > 1.15) continue;
        this.touchesCharge.add(c);
        c.commotionT = Math.max(c.commotionT || 0, d.commotion || 1.5);
        jeu.competences.degats(c, d.degats || 45, this, "brax_belier");
        jeu.audio.capacite("commotion", { x: c.x, y: 1, z: c.z });
      }
    } else {
      const k = 1 - Math.exp(-(this.auSol ? (n > 0 ? 12 : 16) : 2) * dt);
      this.vel.x += (wx - this.vel.x) * k;
      this.vel.z += (wz - this.vel.z) * k;
    }

    // Déplacement découpé en sous-pas : impossible de traverser un mur, même avec la ruée
    const dist = Math.hypot(this.vel.x, this.vel.z) * dt;
    const sousPas = Math.max(1, Math.ceil(dist / 0.15));
    for (let i = 0; i < sousPas; i++) {
      const nx = this.pos.x + this.vel.x * dt / sousPas;
      if (!monde.bloque(nx, this.pos.z, this.pos.y, RAYON_PERSO, taille)) this.pos.x = nx; else this.vel.x = 0;
      const nz = this.pos.z + this.vel.z * dt / sousPas;
      if (!monde.bloque(this.pos.x, nz, this.pos.y, RAYON_PERSO, taille)) this.pos.z = nz; else this.vel.z = 0;
    }

    for (const b of jeu.bots.liste) {
      if (!b.vivant) continue;
      const dx = this.pos.x - b.x, dz = this.pos.z - b.z, d = Math.hypot(dx, dz), min = RAYON_PERSO + 0.32;
      if (d > 0.001 && d < min && this.pos.y < 1.7) {
        const px = this.pos.x + dx / d * (min - d), pz = this.pos.z + dz / d * (min - d);
        if (!monde.bloque(px, pz, this.pos.y, RAYON_PERSO, taille)) { this.pos.x = px; this.pos.z = pz; }
      }
    }

    if (actif && cmd.saut && this.auSol && !this.accroupi && !this.verrou) { this.vel.y = 7.2; this.auSol = false; }
    const avantY = this.pos.y;
    this.vel.y -= 20 * dt;
    this.pos.y += this.vel.y * dt;
    const solY = monde.hauteurSol(this.pos.x, this.pos.z, avantY);
    const etaitEnLAir = !this.auSol;
    if (this.pos.y <= solY) {
      if (etaitEnLAir && this.vel.y < -4) { this.chute = Math.min(1, -this.vel.y / 9); jeu.audio.pasJoueur(1.4); }
      this.pos.y = solY;
      this.vel.y = 0;
      this.auSol = true;
    } else this.auSol = false;

    // Bruits de pas : on t'entend courir, pas marcher accroupi ni en visée.
    const vit = Math.hypot(this.vel.x, this.vel.z);
    if (this.auSol && vit > 2.6 && !this.accroupi && !this.visee) {
      this.pasT -= dt * vit / 5;
      if (this.pasT <= 0) {
        this.pasT = 0.4;
        jeu.audio.pasJoueur(this.sprint ? 1.2 : 1);
        if (enJeu) jeu.bots.entendre(this.pos.x, this.pos.z, this.sprint ? 17 : 9, this);
      }
    }
  }

  etatTir() {
    return { vitesse: Math.hypot(this.vel.x, this.vel.z), enLAir: !this.auSol, accroupi: this.accroupi, vise: this.visee, commotion: this.commotionT > 0 };
  }

  // ----- Armes (pas fixe) -----
  armes(dt, temps, cmd, peutTirer) {
    const jeu = this.jeu;
    this.equipeT = Math.max(0, this.equipeT - dt);
    for (const l of Object.values(this.logiques)) l.maj(this.rechargeRapideT > 0 && l.rechargeT > 0 ? dt * 2 : dt, temps);
    this.couteau.maj(dt, temps);
    const L = this.logique;
    const def = L.def;
    const gachetteNeuve = cmd.tir && !this.gachettePrecedente;
    const lourdNeuf = cmd.viser && !this.viserPrecedent;
    this.gachettePrecedente = cmd.tir;
    this.viserPrecedent = cmd.viser;
    if (!this.vivant || !peutTirer || this.rueeT > 0 || this.chargeT > 0 || this.equipeT > 0 || this.verrou) return;

    if (def.type === "melee") {
      if (cmd.tir && L.peutTirer(temps)) this.coupCouteau(temps, false);
      else if (lourdNeuf && L.peutTirer(temps)) this.coupCouteau(temps, true);
      return;
    }
    if (cmd.tir) {
      const kc = jeu.competences.facteurCadence(this);
      if (kc > 1 && L.prochainTir > temps) L.prochainTir -= (kc - 1) * dt;
      let coups = 0;
      while (L.peutTirer(temps, gachetteNeuve && coups === 0) && coups++ < 2) this.tirer(temps);
      if (L.mun <= 0 && L.reserve <= 0 && !this.videJoue && gachetteNeuve) { jeu.audio.vide(); this.videJoue = true; }
    } else this.videJoue = false;
    if (L.mun <= 0 && L.rechargeT <= 0 && L.reserve > 0) L.lancerRechargement();

    const progression = L.progressionRecharge;
    if (progression >= 0) {
      const etapes = L.rechargeVide ? [0.24, 0.72, 0.86] : [0.24, 0.72, 0.8];
      if (this.etapeRechargeSon < 3 && progression >= etapes[this.etapeRechargeSon]) { jeu.audio.rechargement(this.etapeRechargeSon, def.id); this.etapeRechargeSon++; }
    } else this.etapeRechargeSon = 0;
  }

  directionVue(cible, yawDecal = 0, pitchDecal = 0) {
    const L = this.logique;
    const yaw = this.lacet + L.reculYaw + yawDecal;
    const pitch = this.tangage + L.reculPitch + pitchDecal;
    return cible.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  }

  positionBouche(cible) {
    const k = this.jeu.vue.viseeK;
    const s = Math.sin(this.lacet), c = Math.cos(this.lacet);
    this.directionVue(cible);
    cible.multiplyScalar(0.75);
    cible.x += this.pos.x + c * 0.17 * (1 - k);
    cible.y += this.yeux - 0.13 * (1 - k) - 0.05 * k;
    cible.z += this.pos.z - s * 0.17 * (1 - k);
    return cible;
  }

  tirer(temps) {
    const jeu = this.jeu, L = this.logique, def = L.def;
    const decalages = L.tirer(temps, this.etatTir());
    this.stats.tirs++;
    if (this.camoT > 0) this.camoRevelT = 0.6;
    const oeil = _oeil.set(this.pos.x, this.yeux, this.pos.z);
    this.positionBouche(_bouche);
    jeu.effets.flashTir(_bouche, def.couleurFlash);
    if (def.energie) { this.directionVue(_dir); jeu.effets.etincellesEn(_bouche, _dir, def.couleurFlash, 3); }
    jeu.vue.tir();
    jeu.audio.tirJoueur(def.id);
    jeu.bots.entendre(this.pos.x, this.pos.z, 34, this);
    const touches = new Map();
    decalages.forEach((d, i) => {
      this.directionVue(_dir, d.yaw, d.pitch);
      const mur = jeu.carte.monde.rayon(oeil.x, oeil.y, oeil.z, _dir.x, _dir.y, _dir.z, 250);
      const tMur = mur ? mur.t : 250;
      const cible = jeu.bots.toucher(this, oeil.x, oeil.y, oeil.z, _dir.x, _dir.y, _dir.z, tMur);
      const t = cible ? cible.t : tMur;
      _fin.copy(oeil).addScaledVector(_dir, t);
      if (i < (def.plombs ? 5 : 1)) jeu.effets.tracante(_bouche, _fin, def.couleurTrace || 0xffe9b8, def.plombs ? 0.04 : def.energie ? 0.08 : 0.06);
      if (i === 0) jeu.signalerTir(this, _bouche, _fin, def.id);
      if (cible) {
        const degats = def.degats[cible.partie] * facteurDistance(def, t);
        const e = touches.get(cible.cible) || { degats: 0, tete: false };
        e.degats += degats;
        e.tete = e.tete || cible.partie === "tete";
        touches.set(cible.cible, e);
        _n.copy(_dir).negate();
        jeu.effets.etincellesEn(_fin, _n, cible.partie === "tete" ? 0xffb070 : 0xff6a5a, cible.partie === "tete" ? 12 : def.plombs ? 2 : 7);
      } else if (mur) {
        _n.set(mur.nx, mur.ny, mur.nz);
        if (mur.boite.competence) jeu.competences.degatsObjet(mur.boite.competence, def.degats.corps);
        else jeu.effets.trou(_fin, _n);
        if (i < 4) { jeu.effets.etincellesEn(_fin, _n, def.energie ? def.couleurTrace : 0xffc27a, def.plombs ? 2 : 6); jeu.effets.poussiere(_fin, _n); }
        if (i === 0) jeu.audio.impact(_fin);
      }
    });
    if (touches.size) this.stats.touches++;
    for (const [c, e] of touches) jeu.infliger(c, e.degats, this, e.tete, def.id);
  }

  coupCouteau(temps, lourd) {
    const jeu = this.jeu, def = ARMES.couteau;
    this.couteau.tirer(temps, this.etatTir(), lourd);
    jeu.vue.coup(lourd);
    jeu.audio.couteau(false);
    const oeil = _oeil.set(this.pos.x, this.yeux, this.pos.z);
    this.directionVue(_dir);
    const mur = jeu.carte.monde.rayon(oeil.x, oeil.y, oeil.z, _dir.x, _dir.y, _dir.z, def.portee);
    // Petit cône : trois rayons pour ne pas exiger une précision parfaite au corps à corps
    let cible = null;
    for (const dy of [0, -0.12, 0.12]) {
      this.directionVue(_dir, dy * 0.6, dy);
      const c = jeu.bots.toucher(this, oeil.x, oeil.y, oeil.z, _dir.x, _dir.y, _dir.z, mur ? mur.t : def.portee);
      if (c && (!cible || c.t < cible.t)) cible = c;
    }
    if (cible) {
      const b = cible.cible;
      // Coup dans le dos : dégâts triplés
      const dos = Math.cos(b.yaw) * -Math.cos(this.lacet) + Math.sin(b.yaw) * -Math.sin(this.lacet) > 0.4;
      const degats = dos ? 150 : lourd ? def.degatsLourd : def.degatsLeger;
      jeu.audio.couteau(true);
      _fin.copy(oeil).addScaledVector(_dir, cible.t);
      jeu.effets.etincellesEn(_fin, _n.copy(_dir).negate(), 0xff6a5a, 8);
      this.stats.touches++;
      jeu.infliger(b, degats, this, cible.partie === "tete", "couteau");
    } else if (mur) {
      _fin.copy(oeil).addScaledVector(_dir, mur.t);
      _n.set(mur.nx, mur.ny, mur.nz);
      jeu.effets.etincellesEn(_fin, _n, 0xffe0a0, 6);
      jeu.audio.impact(_fin);
    }
  }

  // ----- Compétences -----
  ruee(cmd, def) {
    const avant = cmd.avant, cote = cmd.cote;
    const s = Math.sin(this.lacet), c = Math.cos(this.lacet);
    const a = Math.abs(avant) > 0.2 || Math.abs(cote) > 0.2 ? avant : 1;
    const dx = -s * a + c * cote, dz = -c * a - s * cote;
    const n = Math.hypot(dx, dz) || 1;
    this.rueeDir.set(dx / n, 0, dz / n);
    this.rueeDuree = def.duree || 0.27;
    this.rueeVitesse = def.vitesse || 30;
    this.rueeT = this.rueeDuree;
    this.jeu.audio.ruee();
  }

  // Téléportation : point libre le plus loin possible devant (jamais à travers un mur)
  teleporter(def) {
    const monde = this.jeu.carte.monde;
    const s = Math.sin(this.lacet), c = Math.cos(this.lacet);
    const dx = -s, dz = -c;
    let meilleur = 0;
    for (let d = 0.5; d <= (def.portee || 8); d += 0.25) {
      const x = this.pos.x + dx * d, z = this.pos.z + dz * d;
      if (!monde.ligneLibre(this.pos.x, this.pos.y + 1, this.pos.z, x, this.pos.y + 1, z)) break;
      if (!monde.bloque(x, z, this.pos.y, RAYON_PERSO, 1.8)) meilleur = d;
    }
    if (meilleur < 1.5) return false;
    const depart = { x: this.pos.x, y: this.pos.y, z: this.pos.z };
    this.pos.x += dx * meilleur;
    this.pos.z += dz * meilleur;
    this.precedente.copy(this.pos);
    this.jeu.effets.apparition(depart, 0xb07cff);
    this.jeu.effets.apparition({ x: this.pos.x, y: this.pos.y, z: this.pos.z }, 0xd0b0ff);
    this.jeu.audio.capacite("teleport");
    return true;
  }

  // nom : action "fumee" (C), "flash" (A/Q), "signature" (E) ou "ultime" (X). Retourne true si la capacité a servi.
  utiliser(nom, cmd, enCombat) {
    const jeu = this.jeu;
    if (!this.vivant || this.verrou) return false;
    if (this.empT > 0) return false;
    const slot = EMPLACEMENT_ACTION[nom];
    if (!slot) return false;
    const etat = this.capacites[slot];
    const id = etat.id, def = CAPACITES[id];
    if (slot === "x") { if (this.ultime < etat.points) return false; }
    else if (etat.charges <= 0) return false;
    let ok = false;
    switch (def.famille) {
      case "ruee": ok = enCombat; if (ok) this.ruee(cmd, def); break;
      case "saut":
        ok = this.auSol || this.pos.y < 0.4;
        if (ok) { this.vel.y = def.impulsion || 8.5; this.auSol = false; jeu.audio.capacite("saut"); jeu.effets.anneau({ x: this.pos.x, y: this.pos.y, z: this.pos.z }, 1.3, 0xff3fa0, 0.4); }
        break;
      case "blink": ok = this.teleporter(def); break;
      case "charge": {
        const s = Math.sin(this.lacet), c = Math.cos(this.lacet);
        this.chargeDir.set(-s, 0, -c);
        this.chargeDef = def;
        this.chargeT = def.duree || 0.45;
        this.touchesCharge.clear();
        jeu.audio.ruee();
        ok = true;
        break;
      }
      default:
        this.directionVue(_dir);
        ok = jeu.competences.executer(this, id, { dir: _dir.clone() });
    }
    if (!ok) return false;
    if (slot === "x") this.ultime = 0;
    else etat.charges--;
    return true;
  }

  majEffets(dt) {
    this.jeu.competences.majStatuts(this, dt);
    majRecharges(this.capacites, dt);
    this.aveugleT = Math.max(0, this.aveugleT - dt);
  }

  // Après une élimination pendant Frénésie : soin et signature rechargée
  remplirMunitions() {
    for (const l of Object.values(this.logiques)) { l.reserve = l.def.reserve ?? l.reserve; if (l.rechargeT <= 0) l.mun = l.def.chargeur ?? l.mun; }
  }

  gagnerUltime(n = 1) { this.ultime = Math.min(this.capacites.x.points, this.ultime + n); }
}

const _oeil = new THREE.Vector3(), _dir = new THREE.Vector3(), _fin = new THREE.Vector3(), _bouche = new THREE.Vector3(), _n = new THREE.Vector3();
export { DEG };
