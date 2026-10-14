// Arsenal : catalogue des armes (statistiques, prix, recul), logique de tir commune
// et modèles 3D (pistolet, fusil à pompe, fusil d'assaut, fusil de précision, couteau).
// Repère des modèles : avant = -Z, axe du canon à y = 0, poignée vers z positif.
import * as THREE from "three";
import { boiteRonde, profil, revolution, Assemblage } from "./formes.js";
import { texturePolymere, textureAnodise, texturePeintureUsee } from "./textures.js";

const DEG = Math.PI / 180;

// ===== Catalogue =====
export const ARMES = {
  couteau: {
    id: "couteau", nom: "Lame tactique", type: "melee", emplacement: 3, prix: 0,
    degatsLeger: 50, degatsLourd: 75, portee: 2.3, cadence: 0.42, cadenceLourde: 1.0, vitesse: 5.5, equipement: 0.35,
    bot: null,
  },
  pistolet: {
    id: "pistolet", nom: "Sentinelle", type: "semi", emplacement: 2, prix: 0,
    chargeur: 12, reserve: 36, cadence: 0.15, equipement: 0.5, rechargement: 1.5, rechargementVide: 1.8,
    degats: { tete: 78, corps: 26, jambes: 22 }, chute: { debut: 20, fin: 40, min: 0.75 },
    precision: 0.35, mouvement: 1.6, air: 4, serie: 0.45, visee: 0.7, zoom: 1.15, vitesse: 4.6,
    recul: (i) => [Math.min(0.9 * (i + 1), 3.2), (i % 2 ? 0.25 : -0.25)], recuperation: 10,
    bot: { cadence: 0.32, rafale: [1, 3], facteur: 0.72 },
  },
  pompe: {
    id: "pompe", nom: "Briseur", type: "pompe", emplacement: 1, prix: 1800,
    chargeur: 6, reserve: 18, cadence: 0.9, equipement: 0.8, rechargement: 2.4, rechargementVide: 2.8, plombs: 12, dispersion: 4.2,
    degats: { tete: 30, corps: 14, jambes: 11 }, chute: { debut: 6, fin: 16, min: 0.3 },
    precision: 0.2, mouvement: 0.6, air: 2, serie: 0, visee: 0.85, zoom: 1.1, vitesse: 4.4,
    recul: () => [3.2, 0], recuperation: 7,
    bot: { cadence: 0.95, rafale: [1, 1], facteur: 1.0, portee: 10 },
  },
  fusil: {
    id: "fusil", nom: "NS-7 Vecteur", type: "auto", emplacement: 1, prix: 2900,
    chargeur: 25, reserve: 75, cadence: 0.1, equipement: 0.75, rechargement: 2.1, rechargementVide: 2.6,
    degats: { tete: 160, corps: 40, jambes: 34 }, chute: null,
    precision: 0.2, mouvement: 3.6, air: 6, serie: 0.13, visee: 0.55, zoom: 1.3, vitesse: 4.4,
    recul: (i) => {
      const M = [[0, 0], [0.42, 0.02], [0.86, -0.04], [1.32, 0.05], [1.78, -0.02], [2.22, 0.06], [2.62, 0.0], [2.98, -0.08], [3.28, -0.25], [3.5, -0.55]];
      if (i < M.length) return M[i];
      const k = i - M.length;
      return [3.6 + Math.sin(k * 0.9) * 0.15, -0.55 + Math.sin(k * 0.5) * 1.35];
    },
    recuperation: 7,
    bot: { cadence: 0.12, rafale: [3, 5], facteur: 1.0 },
  },
  // Fusil à impulsion : coque blanche, plaques bleues, lumières cyan, écran de munitions (design original)
  pulsar: {
    id: "pulsar", nom: "Pulsar P-07", type: "auto", emplacement: 1, prix: 3100, energie: true,
    chargeur: 25, reserve: 75, cadence: 0.095, equipement: 0.85, rechargement: 2.2, rechargementVide: 2.5,
    degats: { tete: 150, corps: 38, jambes: 32 }, chute: { debut: 30, fin: 55, min: 0.85 },
    precision: 0.18, mouvement: 3.4, air: 6, serie: 0.12, visee: 0.5, zoom: 1.4, vitesse: 4.3,
    couleurTrace: 0x7ff6ff, couleurFlash: 0x8ff8ff,
    recul: (i) => {
      const M = [[0, 0], [0.35, 0.03], [0.7, 0.06], [1.05, 0.08], [1.4, 0.1], [1.72, 0.14], [2.0, 0.2], [2.25, 0.28], [2.45, 0.35], [2.6, 0.42]];
      if (i < M.length) return M[i];
      const k = i - M.length;
      return [2.7 + Math.sin(k * 0.8) * 0.1, 0.42 + Math.sin(k * 0.6) * 0.9];
    },
    recuperation: 7.5,
    bot: { cadence: 0.11, rafale: [3, 5], facteur: 0.95 },
  },
  sniper: {
    id: "sniper", nom: "Aiguille", type: "verrou", emplacement: 1, prix: 4700,
    chargeur: 5, reserve: 10, cadence: 1.35, equipement: 0.9, rechargement: 2.9, rechargementVide: 3.3,
    degats: { tete: 255, corps: 150, jambes: 120 }, chute: null,
    precision: 5.5, precisionVisee: 0.04, mouvement: 6, air: 10, serie: 0, visee: 1, zoom: 3.6, lunette: true, vitesse: 4.05,
    recul: () => [4, 0], recuperation: 5,
    bot: { cadence: 1.6, rafale: [1, 1], facteur: 2.1, reactionBonus: 0.25 },
  },
};

export const ARMES_PRINCIPALES = ["pompe", "fusil", "pulsar", "sniper"];

export function facteurDistance(def, distance) {
  const c = def.chute;
  if (!c || distance <= c.debut) return 1;
  if (distance >= c.fin) return c.min;
  return 1 - (1 - c.min) * ((distance - c.debut) / (c.fin - c.debut));
}

// ===== Logique de tir commune =====
export class LogiqueArme {
  constructor(id) {
    this.id = id;
    this.def = ARMES[id];
    this.reinitialiser();
  }

  reinitialiser() {
    const d = this.def;
    this.mun = d.chargeur ?? 0;
    this.reserve = d.reserve ?? 0;
    this.rechargeT = 0;
    this.dureeRecharge = d.rechargement || 1;
    this.rechargeVide = false;
    this.prochainTir = 0;
    this.serie = 0;
    this.dernierTir = -10;
    this.reculPitch = 0;
    this.reculYaw = 0;
    this.cibleRecul = [0, 0];
  }

  get stats() { return this.def; }
  get recharge() { return this.rechargeT > 0; }
  get progressionRecharge() { return this.rechargeT > 0 ? 1 - this.rechargeT / this.dureeRecharge : -1; }
  get progressionCycle() {
    // Pompe / verrou : animation de réarmement entre deux tirs
    if (this.def.type !== "pompe" && this.def.type !== "verrou") return -1;
    const t = (this.horloge || 0) - this.dernierTir;
    return t >= 0 && t < this.def.cadence ? t / this.def.cadence : -1;
  }

  // gachetteNeuve : le bouton vient d'être pressé (armes semi-automatiques et à réarmement)
  peutTirer(temps, gachetteNeuve) {
    const d = this.def;
    if (d.type === "melee") return temps >= this.prochainTir;
    if (this.rechargeT > 0 || this.mun <= 0 || temps < this.prochainTir) return false;
    if (d.type !== "auto" && !gachetteNeuve) return false;
    return true;
  }

  lancerRechargement() {
    const d = this.def;
    if (d.type === "melee" || this.rechargeT > 0 || this.mun >= d.chargeur || this.reserve <= 0) return false;
    this.rechargeVide = this.mun === 0;
    this.dureeRecharge = this.rechargeVide ? d.rechargementVide : d.rechargement;
    this.rechargeT = this.dureeRecharge;
    this.serie = 0;
    return true;
  }

  imprecision({ vitesse, enLAir, accroupi, vise }) {
    const d = this.def;
    if (d.type === "melee") return 0;
    let e = d.lunette && vise ? d.precisionVisee : d.precision;
    if (enLAir) e += d.air;
    else if (vitesse > 0.6) e += Math.min(vitesse / 6.2, 1.2) * d.mouvement;
    e += Math.max(0, this.serie - 2) * d.serie;
    if (accroupi) e *= 0.75;
    if (vise && !d.lunette) e *= d.visee;
    return e;
  }

  // Retourne la liste des décalages (un par balle ou plomb).
  tirer(temps, etat, lourd = false) {
    const d = this.def;
    this.dernierTir = temps;
    if (d.type === "melee") {
      this.prochainTir = temps + (lourd ? d.cadenceLourde : d.cadence);
      return [];
    }
    const ecart = this.imprecision(etat) * DEG;
    this.mun--;
    if (d.type === "auto" && temps - this.prochainTir < d.cadence) this.prochainTir += d.cadence;
    else this.prochainTir = temps + d.cadence;
    const r = d.recul(Math.floor(this.serie));
    const f = etat.vise ? 0.78 : 1;
    this.cibleRecul = [r[0] * DEG * f, r[1] * DEG * f];
    this.serie++;
    if (this.mun <= 0) this.lancerRechargement();
    const decalages = [];
    const n = d.plombs || 1;
    for (let i = 0; i < n; i++) {
      const disp = d.plombs ? d.dispersion * DEG * (etat.vise ? 0.8 : 1) : 0;
      const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * (ecart + disp);
      decalages.push({ yaw: Math.cos(a) * rr, pitch: Math.sin(a) * rr });
    }
    return decalages;
  }

  maj(dt, temps) {
    this.horloge = temps;
    const d = this.def;
    if (this.rechargeT > 0) {
      this.rechargeT -= dt;
      if (this.rechargeT <= 0) {
        const pris = Math.min(d.chargeur - this.mun, this.reserve);
        this.mun += pris;
        this.reserve -= pris;
        this.rechargeT = 0;
      }
    }
    if (d.type === "melee") return;
    const auRepos = temps - this.dernierTir > Math.max(d.cadence * 1.6, 0.12);
    if (auRepos) {
      this.serie = Math.max(0, this.serie - dt * 18);
      if (this.serie < 0.5) this.serie = 0;
      this.cibleRecul[0] = 0;
      this.cibleRecul[1] = 0;
    }
    const k = 1 - Math.exp(-(auRepos ? d.recuperation : 28) * dt);
    this.reculPitch += (this.cibleRecul[0] - this.reculPitch) * k;
    this.reculYaw += (this.cibleRecul[1] - this.reculYaw) * k;
  }
}

// ===== Skins (finitions débloquables) =====
export const SKINS = {
  standard: { nom: "Standard", carcasse: 0x343a44, claire: 0x5a6270, polymere: 0x1d2026, accent: 0x7cffd4, metal: 0.75, coque: 0xb9bfc7, plaque: 0x2a5bd0, lumiere: 0x45f0ff },
  neon: { nom: "Néon", carcasse: 0x1a1f2e, claire: 0x283350, polymere: 0x121522, accent: 0x3fa8ff, metal: 0.6, lueur: 1.6, coque: 0x2a3350, plaque: 0x3fa8ff, lumiere: 0x3fa8ff },
  braise: { nom: "Braise", carcasse: 0x3a1c16, claire: 0x7a2c18, polymere: 0x1e1212, accent: 0xff7a2a, metal: 0.55, lueur: 1.4, coque: 0x3e2c27, plaque: 0xd4561e, lumiere: 0xffa040 },
  carbone: { nom: "Carbone", carcasse: 0x17181b, claire: 0x2a2c31, polymere: 0x0f1012, accent: 0xe8e8f0, metal: 0.4, coque: 0x2c2e33, plaque: 0x17181b, lumiere: 0xe8e8f0 },
  arctique: { nom: "Arctique", carcasse: 0xd8dde4, claire: 0x9fb4c8, polymere: 0x5c6c80, accent: 0x7cc4ff, metal: 0.35, coque: 0xd3dbe4, plaque: 0x7cc4ff, lumiere: 0x9fe0ff },
  toxique: { nom: "Toxique", carcasse: 0x1f2a1a, claire: 0x3c5a22, polymere: 0x141a10, accent: 0x9cff3a, metal: 0.5, lueur: 1.5, coque: 0x2e3c25, plaque: 0x6fbf2a, lumiere: 0x9cff3a },
  or: { nom: "Or royal", carcasse: 0x8a6a22, claire: 0xc9a24a, polymere: 0x231c12, accent: 0xffe08a, metal: 1.0, coque: 0xd6c48f, plaque: 0x8a6a22, lumiere: 0xffe08a },
};

const cacheMateriaux = new Map();
export function materiauxArme(qualite, skin = "standard") {
  const cle = qualite + skin;
  if (cacheMateriaux.has(cle)) return cacheMateriaux.get(cle);
  const s = SKINS[skin] || SKINS.standard;
  const ano = textureAnodise(qualite);
  const poly = texturePolymere(qualite);
  const m = {
    carcasse: new THREE.MeshStandardMaterial({ color: s.carcasse, map: ano.map, roughnessMap: ano.roughnessMap, roughness: 0.55, metalness: s.metal }),
    carcasseClaire: new THREE.MeshStandardMaterial({ color: s.claire, map: ano.map, roughnessMap: ano.roughnessMap, roughness: 0.45, metalness: s.metal }),
    polymere: new THREE.MeshStandardMaterial({ color: s.polymere, map: poly.map, normalMap: qualite === "basse" ? null : poly.normalMap, roughness: 0.78, metalness: 0.05 }),
    caoutchouc: new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.95 }),
    acier: new THREE.MeshStandardMaterial({ color: 0x9aa1ab, roughness: 0.25, metalness: 0.95 }),
    acierSombre: new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.4, metalness: 0.85 }),
    accent: new THREE.MeshStandardMaterial({ color: s.accent, emissive: s.accent, emissiveIntensity: s.lueur || 0.7, roughness: 0.4 }),
    laiton: new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.3, metalness: 1 }),
    cartouche: new THREE.MeshStandardMaterial({ color: 0xa8302a, roughness: 0.5 }),
    verre: new THREE.MeshStandardMaterial({ color: 0x9fd6ff, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.18, depthWrite: false }),
    lentille: new THREE.MeshStandardMaterial({ color: 0x1a2a40, roughness: 0.05, metalness: 0.9, emissive: 0x0a1a30, emissiveIntensity: 1 }),
    lame: new THREE.MeshStandardMaterial({ color: 0xc8ced8, roughness: 0.18, metalness: 1 }),
  };
  // Pulsar : peinture usée (les éclats laissent voir le métal), plaques colorées, lumières, câbles
  const peint = texturePeintureUsee(qualite);
  const cartes = qualite === "basse" ? { map: peint.map } : { map: peint.map, roughnessMap: peint.roughnessMap, metalnessMap: peint.metalnessMap };
  m.coque = new THREE.MeshStandardMaterial({ color: s.coque, ...cartes, roughness: qualite === "basse" ? 0.45 : 1, metalness: qualite === "basse" ? 0.15 : 1 });
  m.coqueGrise = new THREE.MeshStandardMaterial({ color: 0x8b919b, ...cartes, roughness: qualite === "basse" ? 0.5 : 1, metalness: qualite === "basse" ? 0.25 : 1 });
  m.plaque = new THREE.MeshStandardMaterial({ color: s.plaque, map: peint.map, roughness: 0.42, metalness: 0.3 });
  m.lumiere = new THREE.MeshStandardMaterial({ color: s.lumiere, emissive: s.lumiere, emissiveIntensity: 1.4, roughness: 0.3 });
  m.cable = new THREE.MeshStandardMaterial({ color: 0xb3262a, roughness: 0.55, metalness: 0.05 });
  cacheMateriaux.set(cle, m);
  return m;
}

// ===== Modèles =====
// Chaque constructeur remplit : A (pièces fixes), chargeur (sort au rechargement), mobiles (pièces animées)
// et renvoie les points d'accroche (mains, bouche, viseur...).

function piecesFusil(A, C, mob, detail) {
  A.ajouter(profil([[-0.12, -0.005], [0.215, -0.005], [0.215, 0.034], [0.2, 0.046], [-0.1, 0.046], [-0.12, 0.032]], 0.05, 0.003), "carcasse");
  A.ajouter(profil([[-0.115, -0.004], [0.125, -0.004], [0.125, -0.03], [0.1, -0.078], [0.028, -0.078], [0.018, -0.034], [-0.04, -0.034], [-0.115, -0.024]], 0.046, 0.003), "carcasseClaire");
  A.ajouter(profil([[-0.07, -0.03], [0.02, -0.03], [0.02, -0.074], [-0.07, -0.074]], 0.012, 0.0015, [[[-0.058, -0.036], [0.01, -0.036], [0.01, -0.066], [-0.058, -0.066]]]), "carcasseClaire");
  A.ajouter(profil([[-0.058, -0.033], [-0.098, -0.033], [-0.14, -0.148], [-0.126, -0.162], [-0.094, -0.158], [-0.086, -0.14], [-0.079, -0.122], [-0.083, -0.105], [-0.072, -0.088], [-0.075, -0.07], [-0.064, -0.052]], 0.033, 0.004), "polymere");
  const fentes = [];
  if (detail) for (let i = 0; i < 5; i++) { const f0 = 0.245 + i * 0.05; fentes.push([[f0, -0.01], [f0 + 0.032, -0.01], [f0 + 0.032, 0.002], [f0, 0.002]]); }
  A.ajouter(profil([[0.205, -0.03], [0.5, -0.03], [0.51, -0.018], [0.51, 0.036], [0.5, 0.045], [0.205, 0.045]], 0.058, 0.004, fentes), "carcasse");
  A.ajouter(boiteRonde(0.024, 0.008, 0.6, 0.002), "carcasse", { p: [0, 0.05, -0.185] });
  if (detail) { const cran = boiteRonde(0.026, 0.006, 0.0055, 0.0008, 1); for (let i = 0; i < 54; i++) A.ajouter(cran, "carcasse", { p: [0, 0.057, 0.105 - i * 0.011] }); }
  A.ajouter(new THREE.CylinderGeometry(0.011, 0.011, 0.13, 16).rotateX(Math.PI / 2), "acierSombre", { p: [0, 0.006, -0.56] });
  A.ajouter(revolution([[0.0115, 0], [0.017, 0.002], [0.018, 0.012], [0.016, 0.014], [0.018, 0.03], [0.016, 0.032], [0.018, 0.05], [0.017, 0.062], [0.0115, 0.066]], 18).rotateX(-Math.PI / 2), "acierSombre", { p: [0, 0.006, -0.622] });
  A.ajouter(new THREE.CylinderGeometry(0.016, 0.016, 0.2, 16).rotateX(Math.PI / 2), "carcasseClaire", { p: [0, 0.018, 0.21] });
  A.ajouter(profil([[-0.19, 0.04], [-0.335, 0.046], [-0.352, 0.032], [-0.352, -0.088], [-0.334, -0.098], [-0.3, -0.092], [-0.205, -0.02], [-0.182, 0.0]], 0.038, 0.004, [[[-0.318, 0.026], [-0.235, 0.022], [-0.318, -0.062]]]), "polymere");
  A.ajouter(boiteRonde(0.04, 0.142, 0.016, 0.005), "caoutchouc", { p: [0, -0.023, 0.358] });
  A.ajouter(boiteRonde(0.034, 0.01, 0.06, 0.002), "carcasse", { p: [0, 0.064, -0.03] });
  const cadre = new THREE.Shape([[-0.026, 0.06], [0.026, 0.06], [0.026, 0.1], [0.018, 0.108], [-0.018, 0.108], [-0.026, 0.1]].map(([x, y]) => new THREE.Vector2(x, y)));
  cadre.holes.push(new THREE.Path([[-0.02, 0.066], [0.02, 0.066], [0.02, 0.1], [-0.02, 0.1]].map(([x, y]) => new THREE.Vector2(x, y))));
  A.ajouter(new THREE.ExtrudeGeometry(cadre, { depth: 0.046, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: 1 }), "carcasse", { p: [0, 0, -0.056] });
  if (detail) {
    for (const [f, y] of [[-0.075, -0.016], [0.06, -0.016], [0.105, 0.03], [-0.02, 0.03]]) for (const s of [-1, 1]) A.ajouter(new THREE.CylinderGeometry(0.0035, 0.0035, 0.003, 10).rotateZ(Math.PI / 2), "acier", { p: [s * 0.0245, y, -f] });
    A.ajouter(boiteRonde(0.003, 0.018, 0.07, 0.001, 1), "acierSombre", { p: [0.0245, 0.019, -0.04] });
    A.ajouter(new THREE.BoxGeometry(0.002, 0.004, 0.2), "accent", { p: [0.0295, 0.028, -0.35] });
    A.ajouter(new THREE.BoxGeometry(0.002, 0.004, 0.2), "accent", { p: [-0.0295, 0.028, -0.35] });
    mob.culasse.ajouter(boiteRonde(0.004, 0.014, 0.06, 0.001, 1), "acier", { p: [0.0235, 0.019, -0.04] });
    mob.levier.ajouter(profil([[-0.13, 0.03], [-0.112, 0.03], [-0.112, 0.042], [-0.13, 0.042]], 0.05, 0.002), "carcasseClaire");
  }
  C.ajouter(profil([[0.098, -0.06], [0.108, -0.12], [0.123, -0.18], [0.138, -0.228], [0.08, -0.242], [0.068, -0.19], [0.052, -0.13], [0.038, -0.06]], 0.027, 0.003), "polymere");
  C.ajouter(profil([[0.074, -0.236], [0.142, -0.222], [0.146, -0.238], [0.078, -0.254]], 0.031, 0.003), "carcasseClaire");
  return {
    mainDroite: [0, -0.075, 0.098], mainGauche: [0, -0.04, -0.27], chargeur: [0, -0.13, -0.09], levier: [0, 0.04, 0.125],
    ejection: [0.028, 0.02, -0.04], bouche: [0, 0.006, -0.69], viseur: [0, 0.0815, -0.04], reticule: true,
  };
}

function piecesPistolet(A, C, mob, detail) {
  // Carcasse polymère, rail sous le canon, pontet, poignée
  A.ajouter(profil([[-0.085, -0.004], [0.09, -0.004], [0.09, -0.02], [0.04, -0.023], [0.0, -0.025], [-0.085, -0.021]], 0.024, 0.002), "polymere");
  A.ajouter(profil([[-0.02, -0.021], [0.035, -0.021], [0.042, -0.052], [-0.016, -0.052]], 0.011, 0.0015, [[[-0.011, -0.027], [0.03, -0.027], [0.034, -0.045], [-0.008, -0.045]]]), "polymere");
  A.ajouter(profil([[-0.032, -0.021], [-0.086, -0.021], [-0.106, -0.12], [-0.098, -0.13], [-0.056, -0.13], [-0.047, -0.112], [-0.041, -0.062]], 0.03, 0.004), "polymere");
  A.ajouter(new THREE.CylinderGeometry(0.0072, 0.0072, 0.02, 12).rotateX(Math.PI / 2), "acierSombre", { p: [0, 0.012, -0.098] });
  if (detail) {
    A.ajouter(new THREE.BoxGeometry(0.003, 0.004, 0.06), "accent", { p: [0.0125, -0.012, -0.03] });
    A.ajouter(new THREE.BoxGeometry(0.003, 0.004, 0.06), "accent", { p: [-0.0125, -0.012, -0.03] });
  }
  // Culasse mobile (recule à chaque tir) avec organes de visée
  mob.culasse.ajouter(profil([[-0.1, -0.004], [0.094, -0.004], [0.098, 0.004], [0.098, 0.022], [0.088, 0.031], [-0.092, 0.031], [-0.1, 0.022]], 0.026, 0.002), "carcasse");
  mob.culasse.ajouter(boiteRonde(0.004, 0.008, 0.006, 0.001, 1), "accent", { p: [0, 0.035, -0.085] });
  mob.culasse.ajouter(boiteRonde(0.006, 0.007, 0.006, 0.001, 1), "acierSombre", { p: [0.007, 0.034, 0.088] });
  mob.culasse.ajouter(boiteRonde(0.006, 0.007, 0.006, 0.001, 1), "acierSombre", { p: [-0.007, 0.034, 0.088] });
  if (detail) for (let i = 0; i < 6; i++) mob.culasse.ajouter(new THREE.BoxGeometry(0.027, 0.016, 0.002), "acierSombre", { p: [0, 0.015, 0.065 + i * 0.005] });
  // Chargeur dans la poignée
  C.ajouter(profil([[-0.095, -0.03], [-0.06, -0.03], [-0.052, -0.124], [-0.098, -0.124]], 0.021, 0.002), "acierSombre");
  C.ajouter(profil([[-0.1, -0.124], [-0.052, -0.124], [-0.05, -0.136], [-0.1, -0.136]], 0.03, 0.002), "polymere");
  return {
    mainDroite: [0, -0.075, 0.075], mainGauche: [-0.03, -0.09, 0.05], chargeur: [0, -0.13, 0.075], levier: [0, 0.02, 0.08],
    ejection: [0.014, 0.02, -0.01], bouche: [0, 0.012, -0.11], viseur: [0, 0.036, 0], reticule: false,
  };
}

function piecesPompe(A, C, mob, detail) {
  A.ajouter(profil([[-0.1, -0.032], [0.15, -0.032], [0.15, 0.03], [0.13, 0.04], [-0.08, 0.04], [-0.1, 0.026]], 0.052, 0.003), "carcasse");
  A.ajouter(new THREE.CylinderGeometry(0.015, 0.015, 0.48, 16).rotateX(Math.PI / 2), "acierSombre", { p: [0, 0.016, -0.39] });
  A.ajouter(new THREE.CylinderGeometry(0.013, 0.013, 0.4, 14).rotateX(Math.PI / 2), "acierSombre", { p: [0, -0.016, -0.35] });
  A.ajouter(boiteRonde(0.012, 0.006, 0.46, 0.002), "carcasse", { p: [0, 0.034, -0.38] });   // bande de visée
  A.ajouter(new THREE.SphereGeometry(0.0045, 8, 6), "accent", { p: [0, 0.04, -0.6] });          // guidon
  A.ajouter(profil([[-0.07, -0.032], [0.02, -0.032], [0.02, -0.072], [-0.07, -0.072]], 0.012, 0.0015, [[[-0.06, -0.038], [0.012, -0.038], [0.012, -0.064], [-0.06, -0.064]]]), "carcasseClaire");
  A.ajouter(profil([[-0.06, -0.03], [-0.1, -0.03], [-0.135, -0.13], [-0.12, -0.142], [-0.088, -0.137], [-0.072, -0.075]], 0.034, 0.004), "polymere");
  A.ajouter(profil([[-0.1, 0.034], [-0.38, 0.044], [-0.4, 0.024], [-0.4, -0.09], [-0.37, -0.102], [-0.2, -0.045], [-0.1, -0.03]], 0.04, 0.004), "polymere");
  A.ajouter(boiteRonde(0.042, 0.13, 0.02, 0.006), "caoutchouc", { p: [0, -0.033, 0.405] });
  if (detail) {
    for (let i = 0; i < 4; i++) A.ajouter(new THREE.CylinderGeometry(0.009, 0.009, 0.05, 10), "cartouche", { p: [-0.03, 0.0, -0.02 + i * 0.022] });
    A.ajouter(new THREE.BoxGeometry(0.003, 0.004, 0.18), "accent", { p: [0.0265, 0.02, -0.02] });
  }
  // Pompe (glisse d'avant en arrière)
  mob.pompe.ajouter(boiteRonde(0.05, 0.048, 0.17, 0.012), "polymere", { p: [0, -0.016, -0.33] });
  if (detail) for (let i = 0; i < 6; i++) mob.pompe.ajouter(new THREE.TorusGeometry(0.025, 0.003, 4, 16), "polymere", { p: [0, -0.016, -0.27 - i * 0.022] });
  C.ajouter(new THREE.CylinderGeometry(0.009, 0.009, 0.05, 10), "cartouche", { p: [0, -0.045, -0.03] });
  return {
    mainDroite: [0, -0.07, 0.09], mainGauche: [0, -0.045, -0.33], chargeur: [0, -0.05, -0.03], levier: [0, -0.016, -0.33],
    ejection: [0.027, 0.012, -0.03], bouche: [0, 0.016, -0.64], viseur: [0, 0.04, -0.2], reticule: false,
  };
}

function piecesSniper(A, C, mob, detail) {
  A.ajouter(profil([[-0.12, -0.02], [0.2, -0.02], [0.2, 0.03], [0.18, 0.038], [-0.1, 0.038], [-0.12, 0.028]], 0.046, 0.003), "carcasse");
  A.ajouter(profil([[0.2, -0.036], [0.56, -0.03], [0.57, -0.015], [0.57, 0.02], [0.2, 0.026]], 0.054, 0.004, detail ? [[[0.26, -0.016], [0.32, -0.016], [0.32, 0.004], [0.26, 0.004]], [[0.36, -0.016], [0.42, -0.016], [0.42, 0.004], [0.36, 0.004]], [[0.46, -0.016], [0.52, -0.016], [0.52, 0.004], [0.46, 0.004]]] : []), "carcasse");
  A.ajouter(new THREE.CylinderGeometry(0.012, 0.013, 0.42, 16).rotateX(Math.PI / 2), "acierSombre", { p: [0, 0.004, -0.77] });
  A.ajouter(revolution([[0.012, 0], [0.022, 0.004], [0.022, 0.07], [0.018, 0.074], [0.012, 0.074]], 16).rotateX(-Math.PI / 2), "acierSombre", { p: [0, 0.004, -0.97] });
  A.ajouter(profil([[-0.12, 0.028], [-0.43, 0.038], [-0.45, 0.022], [-0.45, -0.1], [-0.41, -0.112], [-0.28, -0.085], [-0.19, -0.13], [-0.155, -0.12], [-0.13, -0.065], [-0.1, -0.02]], 0.042, 0.004, [[[-0.265, -0.012], [-0.2, -0.012], [-0.21, -0.062], [-0.255, -0.052]]]), "polymere");
  A.ajouter(boiteRonde(0.045, 0.15, 0.02, 0.006), "caoutchouc", { p: [0, -0.04, 0.455] });
  A.ajouter(profil([[-0.05, -0.02], [0.02, -0.02], [0.02, -0.06], [-0.05, -0.06]], 0.012, 0.0015, [[[-0.04, -0.026], [0.012, -0.026], [0.012, -0.052], [-0.04, -0.052]]]), "carcasseClaire");
  // Lunette : tube, cloches avant et arrière, tourelles, colliers
  A.ajouter(new THREE.CylinderGeometry(0.019, 0.019, 0.26, 18).rotateX(Math.PI / 2), "carcasse", { p: [0, 0.078, -0.07] });
  A.ajouter(revolution([[0.019, 0], [0.03, 0.04], [0.03, 0.08], [0.027, 0.085]], 18).rotateX(-Math.PI / 2), "carcasse", { p: [0, 0.078, -0.2] });
  A.ajouter(revolution([[0.027, -0.05], [0.025, -0.01], [0.019, 0]], 18).rotateX(-Math.PI / 2), "carcasse", { p: [0, 0.078, 0.06] });
  A.ajouter(new THREE.CircleGeometry(0.026, 18), "lentille", { p: [0, 0.078, -0.286], r: [0, Math.PI, 0] });
  A.ajouter(new THREE.CylinderGeometry(0.011, 0.011, 0.02, 12), "carcasseClaire", { p: [0, 0.105, -0.07] });
  A.ajouter(new THREE.CylinderGeometry(0.011, 0.011, 0.02, 12).rotateZ(Math.PI / 2), "carcasseClaire", { p: [0.027, 0.078, -0.07] });
  for (const z of [-0.14, 0.0]) A.ajouter(boiteRonde(0.03, 0.04, 0.02, 0.004), "carcasse", { p: [0, 0.052, z] });
  if (detail) {
    for (const s of [-1, 1]) A.ajouter(new THREE.CylinderGeometry(0.005, 0.005, 0.2, 8).rotateX(Math.PI / 2), "acierSombre", { p: [s * 0.012, -0.042, -0.46] });
    A.ajouter(new THREE.BoxGeometry(0.002, 0.004, 0.16), "accent", { p: [0.028, 0.0, -0.4] });
  }
  mob.levier.ajouter(new THREE.CylinderGeometry(0.004, 0.004, 0.05, 8).rotateZ(Math.PI / 2), "acier", { p: [0.045, 0.015, 0.03] });
  mob.levier.ajouter(new THREE.SphereGeometry(0.009, 10, 8), "acierSombre", { p: [0.07, 0.015, 0.03] });
  C.ajouter(boiteRonde(0.03, 0.06, 0.07, 0.004), "polymere", { p: [0, -0.045, -0.06] });
  return {
    mainDroite: [0, -0.075, 0.17], mainGauche: [0, -0.05, -0.38], chargeur: [0, -0.07, -0.06], levier: [0.07, 0.015, 0.03],
    ejection: [0.026, 0.012, 0.0], bouche: [0, 0.004, -1.0], viseur: [0, 0.078, 0.1], reticule: false,
  };
}

function piecesCouteau(A, C, mob, detail) {
  A.ajouter(profil([[0.0, -0.002], [0.17, -0.002], [0.23, 0.016], [0.165, 0.03], [0.0, 0.03]], 0.006, 0.0012), "lame", { p: [0, -0.014, 0] });
  A.ajouter(boiteRonde(0.008, 0.012, 0.15, 0.002), "acierSombre", { p: [0, 0.018, -0.075] });
  A.ajouter(boiteRonde(0.05, 0.016, 0.022, 0.004), "carcasse", { p: [0, 0.0, 0.012] });
  A.ajouter(revolution([[0.0, 0], [0.016, 0.004], [0.017, 0.03], [0.015, 0.05], [0.017, 0.08], [0.018, 0.1], [0.012, 0.112], [0.0, 0.114]], 14).rotateX(Math.PI / 2), "polymere", { p: [0, 0, 0.024] });
  if (detail) A.ajouter(new THREE.TorusGeometry(0.0165, 0.002, 4, 16), "accent", { p: [0, 0, 0.07] });
  return {
    mainDroite: [0, -0.012, 0.075], mainGauche: [-0.2, -0.3, 0.3], chargeur: [0, 0, 0], levier: [0, 0, 0],
    ejection: [0, 0, 0], bouche: [0, 0, -0.23], viseur: [0, 0, 0], reticule: false,
  };
}

function piecesPulsar(A, C, mob, detail) {
  // Coque supérieure massive (blanche) avec nez biseauté
  A.ajouter(profil([[-0.14, -0.02], [0.46, -0.02], [0.5, 0.0], [0.5, 0.055], [0.44, 0.086], [-0.06, 0.086], [-0.14, 0.06]], 0.082, 0.006), "coque");
  // Carcasse inférieure grise et puits du chargeur
  A.ajouter(profil([[-0.12, -0.02], [0.3, -0.02], [0.3, -0.046], [0.24, -0.062], [0.0, -0.062], [-0.05, -0.042], [-0.12, -0.042]], 0.07, 0.004), "coqueGrise");
  // Plaques latérales bleues et poignée de transport
  A.ajouter(profil([[-0.12, 0.0], [0.1, 0.0], [0.13, 0.04], [0.12, 0.076], [-0.1, 0.076]], 0.09, 0.004), "plaque");
  A.ajouter(profil([[-0.02, 0.084], [0.13, 0.084], [0.12, 0.112], [0.0, 0.112]], 0.05, 0.004, detail ? [[[0.02, 0.09], [0.1, 0.09], [0.095, 0.104], [0.025, 0.104]]] : []), "plaque");
  // Fenêtres lumineuses sur les flancs (cadre noir + bande cyan)
  for (const sx of [-1, 1]) {
    A.ajouter(boiteRonde(0.006, 0.032, 0.29, 0.003), "acierSombre", { p: [sx * 0.041, 0.028, -0.21] });
    A.ajouter(new THREE.BoxGeometry(0.004, 0.016, 0.25), "lumiere", { p: [sx * 0.044, 0.028, -0.21] });
  }
  // Rail supérieur et viseur holographique
  A.ajouter(boiteRonde(0.03, 0.012, 0.36, 0.003), "acierSombre", { p: [0, 0.092, -0.26] });
  if (detail) { const cran = boiteRonde(0.032, 0.006, 0.006, 0.001, 1); for (let i = 0; i < 26; i++) A.ajouter(cran, "acierSombre", { p: [0, 0.099, -0.1 - i * 0.013] }); }
  // Viseur sur rehausse : la carcasse reste basse dans l'image quand on vise
  const cadre = new THREE.Shape([[-0.024, 0.14], [0.024, 0.14], [0.024, 0.178], [0.016, 0.185], [-0.016, 0.185], [-0.024, 0.178]].map(([x, y]) => new THREE.Vector2(x, y)));
  cadre.holes.push(new THREE.Path([[-0.019, 0.146], [0.019, 0.146], [0.019, 0.18], [-0.019, 0.18]].map(([x, y]) => new THREE.Vector2(x, y))));
  A.ajouter(new THREE.ExtrudeGeometry(cadre, { depth: 0.036, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: 1 }), "acierSombre", { p: [0, 0, -0.06] });
  A.ajouter(boiteRonde(0.034, 0.05, 0.05, 0.005), "acierSombre", { p: [0, 0.118, -0.04] });
  A.ajouter(new THREE.BoxGeometry(0.036, 0.004, 0.03), "lumiere", { p: [0, 0.142, -0.042] });
  // Bloc avant à double canon (noir) et bouches lumineuses
  A.ajouter(boiteRonde(0.074, 0.048, 0.19, 0.012), "acierSombre", { p: [0, 0.034, -0.585] });
  A.ajouter(boiteRonde(0.07, 0.042, 0.16, 0.012), "acierSombre", { p: [0, -0.024, -0.57] });
  A.ajouter(boiteRonde(0.08, 0.02, 0.12, 0.006), "coqueGrise", { p: [0, 0.064, -0.56] });
  for (const [y, z] of [[0.034, -0.681], [-0.024, -0.651]]) {
    A.ajouter(new THREE.CylinderGeometry(0.019, 0.019, 0.006, 18).rotateX(Math.PI / 2), "acierSombre", { p: [0, y, z - 0.001] });
    A.ajouter(new THREE.CylinderGeometry(0.012, 0.012, 0.004, 16).rotateX(Math.PI / 2), "lumiere", { p: [0, y, z - 0.004] });
  }
  if (detail) for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) A.ajouter(new THREE.BoxGeometry(0.004, 0.008, 0.03), "lumiere", { p: [sx * 0.038, 0.04, -0.53 - i * 0.045] });
    A.ajouter(boiteRonde(0.004, 0.03, 0.1, 0.002), "coqueGrise", { p: [sx * 0.037, -0.024, -0.57] });
  }
  // Tube sous le canon avec bagues et bande rouge
  A.ajouter(new THREE.CylinderGeometry(0.036, 0.036, 0.32, 20).rotateX(Math.PI / 2), "acierSombre", { p: [0, -0.078, -0.34] });
  A.ajouter(revolution([[0.036, 0], [0.039, 0.01], [0.039, 0.03], [0.03, 0.04], [0.0, 0.04]], 20).rotateX(-Math.PI / 2), "acierSombre", { p: [0, -0.078, -0.5] });
  A.ajouter(new THREE.CylinderGeometry(0.0375, 0.0375, 0.022, 20).rotateX(Math.PI / 2), "cable", { p: [0, -0.078, -0.48] });
  if (detail) for (let i = 0; i < 4; i++) A.ajouter(new THREE.TorusGeometry(0.0365, 0.003, 6, 22), "coqueGrise", { p: [0, -0.078, -0.22 - i * 0.055] });
  A.ajouter(boiteRonde(0.05, 0.03, 0.2, 0.006), "coqueGrise", { p: [0, -0.05, -0.33] });
  // Câbles rouges qui descendent du flanc vers le tube
  for (const sx of detail ? [-1, 1] : [1]) {
    const courbe = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx * 0.042, 0.0, -0.06), new THREE.Vector3(sx * 0.05, -0.035, -0.12),
      new THREE.Vector3(sx * 0.042, -0.06, -0.2), new THREE.Vector3(sx * 0.03, -0.072, -0.26),
    ]);
    A.ajouter(new THREE.TubeGeometry(courbe, detail ? 20 : 8, 0.0065, 8), "cable");
  }
  // Poignée pistolet et pontet
  A.ajouter(profil([[-0.03, -0.045], [-0.085, -0.045], [-0.12, -0.16], [-0.105, -0.176], [-0.07, -0.171], [-0.06, -0.14], [-0.052, -0.11], [-0.045, -0.08]], 0.034, 0.004), "polymere");
  A.ajouter(profil([[-0.07, -0.04], [0.02, -0.04], [0.02, -0.08], [-0.07, -0.08]], 0.012, 0.0015, [[[-0.058, -0.046], [0.01, -0.046], [0.01, -0.072], [-0.058, -0.072]]]), "coqueGrise");
  // Crosse squelettique et talon caoutchouc
  A.ajouter(profil([[-0.14, 0.05], [-0.36, 0.062], [-0.38, 0.042], [-0.38, -0.09], [-0.355, -0.102], [-0.3, -0.096], [-0.16, -0.036]], 0.048, 0.005, [[[-0.335, 0.036], [-0.2, 0.03], [-0.335, -0.066]]]), "coqueGrise");
  A.ajouter(boiteRonde(0.052, 0.156, 0.022, 0.006), "caoutchouc", { p: [0, -0.02, 0.39] });
  A.ajouter(boiteRonde(0.05, 0.02, 0.2, 0.005), "plaque", { p: [0, 0.058, 0.26] });
  // Chargeur à cellule d'énergie (sort au rechargement)
  C.ajouter(profil([[0.06, -0.06], [0.16, -0.06], [0.175, -0.2], [0.08, -0.206]], 0.046, 0.004), "polymere");
  C.ajouter(profil([[0.078, -0.198], [0.178, -0.192], [0.18, -0.214], [0.08, -0.218]], 0.05, 0.003), "coqueGrise");
  C.ajouter(new THREE.BoxGeometry(0.048, 0.008, 0.07), "lumiere", { p: [0, -0.13, -0.12], r: [0.1, 0, 0] });
  // Levier d'armement (sur le flanc droit)
  mob.levier.ajouter(boiteRonde(0.014, 0.012, 0.03, 0.003), "acierSombre", { p: [0.048, 0.05, 0.02] });
  return {
    mainDroite: [0, -0.082, 0.07], mainGauche: [0, -0.082, -0.33], chargeur: [0, -0.14, -0.11], levier: [0.05, 0.05, 0.02],
    ejection: [0.04, 0.03, -0.06], bouche: [0, 0.034, -0.69], viseur: [0, 0.163, -0.04], reticule: true,
  };
}

const CONSTRUCTEURS = { fusil: piecesFusil, pistolet: piecesPistolet, pompe: piecesPompe, sniper: piecesSniper, couteau: piecesCouteau, pulsar: piecesPulsar };

// Détails non fusionnables (transparents ou animés) : écran numérique des munitions et marquage du Pulsar.
// Retourne { ecran } quand l'arme possède un écran, sinon null.
export function detailsArme(id, groupe, chargeurMax = 25) {
  if (id !== "pulsar") return null;
  const c = document.createElement("canvas");
  c.width = 128; c.height = 80;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const ecran = { ctx: c.getContext("2d"), tex, valeur: null, max: chargeurMax };
  dessinerEcran(ecran, chargeurMax);
  const boitier = new THREE.Mesh(boiteRonde(0.082, 0.058, 0.012, 0.004), new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.5, metalness: 0.6 }));
  const vitre = new THREE.Mesh(new THREE.PlaneGeometry(0.074, 0.048), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  // Écran sur le flanc gauche, incliné vers le tireur
  const support = new THREE.Group();
  support.position.set(-0.05, 0.05, 0.03);
  support.rotation.order = "YXZ";
  support.rotation.set(-0.4, -Math.PI / 2, 0);
  vitre.position.z = 0.0065;
  support.add(boitier, vitre);
  groupe.add(support);
  // Marquage « 07 » sur les deux flancs
  const m = document.createElement("canvas");
  m.width = 256; m.height = 128;
  const g = m.getContext("2d");
  g.font = "italic 900 96px Orbitron, Arial Black, Arial, sans-serif";
  g.lineWidth = 8; g.strokeStyle = "#e9e2d0"; g.fillStyle = "#c8322c";
  g.strokeText("07", 20, 100); g.fillText("07", 20, 100);
  g.font = "700 22px Orbitron, Arial, sans-serif"; g.fillStyle = "#2a5bd0";
  g.fillText("PULSAR", 150, 40);
  const tm = new THREE.CanvasTexture(m);
  tm.colorSpace = THREE.SRGBColorSpace;
  const matMarque = new THREE.MeshStandardMaterial({ map: tm, transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const sx of [-1, 1]) {
    const marque = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.06), matMarque);
    marque.position.set(sx * 0.0425, 0.035, -0.43);
    marque.rotation.y = sx * Math.PI / 2;
    groupe.add(marque);
  }
  return { ecran };
}

// Écran des munitions : gros chiffres cyan et jauge
export function dessinerEcran(ecran, valeur) {
  if (ecran.valeur === valeur) return;
  ecran.valeur = valeur;
  const g = ecran.ctx, W = 128, H = 80;
  const bas = valeur <= Math.ceil(ecran.max * 0.2);
  const couleur = bas ? "#ff5a5a" : "#5ff3ff";
  g.fillStyle = "#04121a";
  g.fillRect(0, 0, W, H);
  g.strokeStyle = couleur; g.globalAlpha = 0.5; g.lineWidth = 3; g.strokeRect(3, 3, W - 6, H - 6); g.globalAlpha = 1;
  g.fillStyle = couleur;
  g.shadowColor = couleur; g.shadowBlur = 10;
  g.font = "800 46px Orbitron, Arial Black, Arial, sans-serif";
  g.textAlign = "center";
  g.fillText(String(Math.max(0, valeur)), 50, 58);
  g.shadowBlur = 0;
  const k = Math.max(0, valeur) / ecran.max;
  for (let i = 0; i < 3; i++) {
    g.globalAlpha = k > i / 3 ? 1 : 0.2;
    g.fillRect(96 + i * 9, 18, 6, 46);
  }
  g.globalAlpha = 1;
  ecran.tex.needsUpdate = true;
}

// Construit les assemblages d'une arme. detail = vue à la première personne.
export function piecesArme(id, detail) {
  const A = new Assemblage(), C = new Assemblage();
  const mob = { culasse: new Assemblage(), levier: new Assemblage(), pompe: new Assemblage() };
  const p = CONSTRUCTEURS[id](A, C, mob, detail);
  const points = {};
  for (const [k, v] of Object.entries(p)) points[k] = Array.isArray(v) ? new THREE.Vector3(...v) : v;
  return { A, C, mob, points };
}
