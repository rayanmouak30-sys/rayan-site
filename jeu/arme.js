// Arme : logique (cadence, munitions, recul, imprécision) et modèle 3D "NS-7 Vecteur".
// Le même constructeur sert à la vue à la première personne (pièces mobiles séparées)
// et aux bots (pièces fusionnées, moins de détails).
import * as THREE from "three";
import { boiteRonde, profil, revolution, membre, Assemblage, ik2, Ressort } from "./formes.js";
import { textureEclat, texturePolymere, textureAnodise, textureMarquage, textureReticule, textureTissu } from "./textures.js";

const DEG = Math.PI / 180;

export const STATS_FUSIL = {
  nom: "NS-7 Vecteur",
  cadence: 0.1,
  chargeur: 25,
  reserve: 75,
  rechargement: 2.1,       // chargeur pas vide
  rechargementVide: 2.6,   // chargeur vide : il faut réarmer
  degats: { tete: 160, corps: 40, jambes: 34 },
  precision: 0.2,
};

// Recul : décalage du viseur (degrés) pour chaque balle d'une rafale.
const MOTIF_RECUL = [
  [0, 0], [0.42, 0.02], [0.86, -0.04], [1.32, 0.05], [1.78, -0.02], [2.22, 0.06], [2.62, 0.0], [2.98, -0.08], [3.28, -0.25], [3.5, -0.55],
];
function recul(serie) {
  const i = Math.max(0, Math.floor(serie));
  if (i < MOTIF_RECUL.length) return MOTIF_RECUL[i];
  const k = i - MOTIF_RECUL.length;
  return [3.6 + Math.sin(k * 0.9) * 0.15, -0.55 + Math.sin(k * 0.5) * 1.35];
}

export class LogiqueArme {
  constructor(stats = STATS_FUSIL) {
    this.stats = stats;
    this.reinitialiser();
  }

  reinitialiser() {
    this.mun = this.stats.chargeur;
    this.reserve = this.stats.reserve;
    this.rechargeT = 0;
    this.dureeRecharge = this.stats.rechargement;
    this.rechargeVide = false;
    this.prochainTir = 0;
    this.serie = 0;
    this.dernierTir = -10;
    this.reculPitch = 0;
    this.reculYaw = 0;
    this.cibleRecul = [0, 0];
  }

  get recharge() { return this.rechargeT > 0; }
  get progressionRecharge() { return this.rechargeT > 0 ? 1 - this.rechargeT / this.dureeRecharge : -1; }

  peutTirer(temps) {
    return this.rechargeT <= 0 && this.mun > 0 && temps >= this.prochainTir;
  }

  lancerRechargement() {
    if (this.rechargeT > 0 || this.mun >= this.stats.chargeur || this.reserve <= 0) return false;
    this.rechargeVide = this.mun === 0;
    this.dureeRecharge = this.rechargeVide ? this.stats.rechargementVide : this.stats.rechargement;
    this.rechargeT = this.dureeRecharge;
    this.serie = 0;
    return true;
  }

  imprecision({ vitesse, enLAir, accroupi, vise }) {
    let e = this.stats.precision;
    if (enLAir) e += 6;
    else if (vitesse > 0.6) e += Math.min(vitesse / 6.2, 1.2) * 3.6;
    e += Math.max(0, this.serie - 2) * 0.13;
    if (accroupi) e *= 0.75;
    if (vise) e *= 0.55;
    return e;
  }

  // La cadence est tenue précisément même si les images arrivent irrégulièrement.
  tirer(temps, etat) {
    const ecart = this.imprecision(etat) * DEG;
    this.mun--;
    if (temps - this.dernierTir > this.stats.cadence * 2) this.prochainTir = temps + this.stats.cadence;
    else this.prochainTir += this.stats.cadence;
    this.dernierTir = temps;
    const r = recul(this.serie);
    const facteur = etat.vise ? 0.78 : 1;
    this.cibleRecul = [r[0] * DEG * facteur, r[1] * DEG * facteur];
    this.serie++;
    if (this.mun <= 0) this.lancerRechargement();
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * ecart;
    return { yaw: Math.cos(a) * d, pitch: Math.sin(a) * d };
  }

  maj(dt, temps) {
    if (this.rechargeT > 0) {
      this.rechargeT -= dt;
      if (this.rechargeT <= 0) {
        const pris = Math.min(this.stats.chargeur - this.mun, this.reserve);
        this.mun += pris;
        this.reserve -= pris;
        this.rechargeT = 0;
      }
    }
    const auRepos = temps - this.dernierTir > this.stats.cadence * 1.6;
    if (auRepos) {
      this.serie = Math.max(0, this.serie - dt * 18);
      if (this.serie < 0.5) this.serie = 0;
      this.cibleRecul[0] = 0;
      this.cibleRecul[1] = 0;
    }
    const k = 1 - Math.exp(-(auRepos ? 7 : 28) * dt);
    this.reculPitch += (this.cibleRecul[0] - this.reculPitch) * k;
    this.reculYaw += (this.cibleRecul[1] - this.reculYaw) * k;
  }
}

// ===== Matériaux de l'arme =====
let materiauxArme = null;
export function materiauxFusil(qualite) {
  if (materiauxArme) return materiauxArme;
  const ano = textureAnodise(qualite);
  const poly = texturePolymere(qualite);
  materiauxArme = {
    carcasse: new THREE.MeshStandardMaterial({ color: 0x343a44, map: ano.map, roughnessMap: ano.roughnessMap, roughness: 0.55, metalness: 0.75 }),
    carcasseClaire: new THREE.MeshStandardMaterial({ color: 0x5a6270, map: ano.map, roughnessMap: ano.roughnessMap, roughness: 0.45, metalness: 0.75 }),
    polymere: new THREE.MeshStandardMaterial({ color: 0x1d2026, map: poly.map, normalMap: poly.normalMap, roughness: 0.78, metalness: 0.05 }),
    caoutchouc: new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.95 }),
    acier: new THREE.MeshStandardMaterial({ color: 0x8b929c, roughness: 0.28, metalness: 0.95 }),
    acierSombre: new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.4, metalness: 0.85 }),
    accent: new THREE.MeshStandardMaterial({ color: 0x7cffd4, emissive: 0x3fe0b0, emissiveIntensity: 0.7, roughness: 0.4 }),
    laiton: new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.3, metalness: 1 }),
    verre: new THREE.MeshStandardMaterial({ color: 0x9fd6ff, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.18, depthWrite: false }),
  };
  return materiauxArme;
}

// Pièces fixes du fusil. Repère : avant = -Z, axe du canon à y = 0, poignée vers z = +0.1.
// Les profils sont dessinés vu de côté : [distance vers l'avant, hauteur].
export function fusilStatique(A, detail) {
  // Carcasse supérieure
  A.ajouter(profil([[-0.12, -0.005], [0.215, -0.005], [0.215, 0.034], [0.2, 0.046], [-0.1, 0.046], [-0.12, 0.032]], 0.05, 0.003), "carcasse");
  // Carcasse inférieure + puits de chargeur
  A.ajouter(profil([[-0.115, -0.004], [0.125, -0.004], [0.125, -0.03], [0.1, -0.078], [0.028, -0.078], [0.018, -0.034], [-0.04, -0.034], [-0.115, -0.024]], 0.046, 0.003), "carcasseClaire");
  // Pontet (évidé)
  A.ajouter(profil([[-0.07, -0.03], [0.02, -0.03], [0.02, -0.074], [-0.07, -0.074]], 0.012, 0.0015, [[[-0.058, -0.036], [0.01, -0.036], [0.01, -0.066], [-0.058, -0.066]]]), "carcasseClaire");
  // Poignée ergonomique (rainures pour les doigts sur l'avant)
  A.ajouter(profil([[-0.058, -0.033], [-0.098, -0.033], [-0.14, -0.148], [-0.126, -0.162], [-0.094, -0.158], [-0.086, -0.14], [-0.079, -0.122], [-0.083, -0.105], [-0.072, -0.088], [-0.075, -0.07], [-0.064, -0.052]], 0.033, 0.004), "polymere");
  // Garde-main avec fentes M-LOK
  const fentes = [];
  if (detail) for (let i = 0; i < 5; i++) { const f0 = 0.245 + i * 0.05; fentes.push([[f0, -0.01], [f0 + 0.032, -0.01], [f0 + 0.032, 0.002], [f0, 0.002]]); }
  A.ajouter(profil([[0.205, -0.03], [0.5, -0.03], [0.51, -0.018], [0.51, 0.036], [0.5, 0.045], [0.205, 0.045]], 0.058, 0.004, fentes), "carcasse");
  // Rail supérieur et ses crans
  A.ajouter(boiteRonde(0.024, 0.008, 0.6, 0.002), "carcasse", { p: [0, 0.05, -0.185] });
  if (detail) {
    const cran = boiteRonde(0.026, 0.006, 0.0055, 0.0008, 1);
    for (let i = 0; i < 54; i++) A.ajouter(cran, "carcasse", { p: [0, 0.057, 0.105 - i * 0.011] });
  }
  // Canon et frein de bouche
  A.ajouter(new THREE.CylinderGeometry(0.011, 0.011, 0.13, 16).rotateX(Math.PI / 2), "acierSombre", { p: [0, 0.006, -0.56] });
  A.ajouter(revolution([[0.0115, 0], [0.017, 0.002], [0.018, 0.012], [0.016, 0.014], [0.018, 0.03], [0.016, 0.032], [0.018, 0.05], [0.017, 0.062], [0.0115, 0.066]], 18).rotateX(-Math.PI / 2), "acierSombre", { p: [0, 0.006, -0.622] });
  if (detail) for (const s of [-1, 1]) for (const k of [0, 1]) A.ajouter(boiteRonde(0.004, 0.006, 0.012, 0.001, 1), "polymere", { p: [s * 0.017, 0.006, -0.643 - k * 0.018] });
  // Tube de crosse et crosse squelettique
  A.ajouter(new THREE.CylinderGeometry(0.016, 0.016, 0.2, 16).rotateX(Math.PI / 2), "carcasseClaire", { p: [0, 0.018, 0.21] });
  A.ajouter(profil([[-0.19, 0.04], [-0.335, 0.046], [-0.352, 0.032], [-0.352, -0.088], [-0.334, -0.098], [-0.3, -0.092], [-0.205, -0.02], [-0.182, 0.0]], 0.038, 0.004, [[[-0.318, 0.026], [-0.235, 0.022], [-0.318, -0.062]]]), "polymere");
  A.ajouter(boiteRonde(0.04, 0.142, 0.016, 0.005), "caoutchouc", { p: [0, -0.023, 0.358] });
  // Embase et boîtier du viseur point rouge (cadre ouvert dans l'axe de visée)
  A.ajouter(boiteRonde(0.034, 0.01, 0.06, 0.002), "carcasse", { p: [0, 0.064, -0.03] });
  const cadre = new THREE.Shape([[-0.026, 0.06], [0.026, 0.06], [0.026, 0.1], [0.018, 0.108], [-0.018, 0.108], [-0.026, 0.1]].map(([x, y]) => new THREE.Vector2(x, y)));
  cadre.holes.push(new THREE.Path([[-0.02, 0.066], [0.02, 0.066], [0.02, 0.1], [-0.02, 0.1]].map(([x, y]) => new THREE.Vector2(x, y))));
  A.ajouter(new THREE.ExtrudeGeometry(cadre, { depth: 0.046, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: 1 }), "carcasse", { p: [0, 0, -0.056] });
  if (detail) {
    A.ajouter(boiteRonde(0.008, 0.012, 0.014, 0.002), "carcasse", { p: [0.03, 0.084, -0.033] }); // molette de réglage
    for (const [f, y] of [[-0.075, -0.016], [0.06, -0.016], [0.105, 0.03], [-0.02, 0.03]]) {
      for (const s of [-1, 1]) A.ajouter(new THREE.CylinderGeometry(0.0035, 0.0035, 0.003, 10).rotateZ(Math.PI / 2), "acier", { p: [s * 0.0245, y, -f] });
    }
    A.ajouter(boiteRonde(0.003, 0.018, 0.07, 0.001, 1), "acierSombre", { p: [0.0245, 0.019, -0.04] }); // fenêtre d'éjection
    A.ajouter(new THREE.BoxGeometry(0.002, 0.004, 0.2), "accent", { p: [0.0295, 0.028, -0.35] });
    A.ajouter(new THREE.BoxGeometry(0.002, 0.004, 0.2), "accent", { p: [-0.0295, 0.028, -0.35] });
  }
}

// Chargeur courbe (pièce séparée : il sort pendant le rechargement).
export function geometrieChargeur(detail) {
  const A = new Assemblage();
  A.ajouter(profil([[0.098, -0.06], [0.108, -0.12], [0.123, -0.18], [0.138, -0.228], [0.08, -0.242], [0.068, -0.19], [0.052, -0.13], [0.038, -0.06]], 0.027, 0.003), "polymere");
  A.ajouter(profil([[0.074, -0.236], [0.142, -0.222], [0.146, -0.238], [0.078, -0.254]], 0.031, 0.003), "carcasseClaire");
  if (detail) for (let i = 0; i < 4; i++) A.ajouter(boiteRonde(0.03, 0.005, 0.045, 0.0015, 1), "polymere", { p: [0, -0.1 - i * 0.03, -0.075 - i * 0.012], r: [0.22, 0, 0] });
  return A;
}

// Construit le fusil. fp = vue à la première personne (pièces mobiles séparées et marquages).
export function construireFusil(qualite, fp) {
  const mats = materiauxFusil(qualite);
  const groupe = new THREE.Group();
  const A = new Assemblage();
  fusilStatique(A, fp);
  groupe.add(A.construire(mats, !fp));

  const chargeur = geometrieChargeur(fp).construire(mats, !fp);
  groupe.add(chargeur);

  const pieces = { chargeur };
  if (fp) {
    const culasse = new THREE.Mesh(boiteRonde(0.004, 0.014, 0.06, 0.001, 1), mats.acier);
    culasse.position.set(0.0235, 0.019, -0.04);
    groupe.add(culasse);
    const levier = new THREE.Mesh(profil([[-0.13, 0.03], [-0.112, 0.03], [-0.112, 0.042], [-0.13, 0.042]], 0.05, 0.002), mats.carcasseClaire);
    groupe.add(levier);
    const detente = new THREE.Mesh(profil([[-0.006, 0], [0.004, 0], [-0.004, -0.024], [-0.012, -0.022]], 0.006, 0.001), mats.acier);
    detente.position.set(0, -0.036, 0.018);
    groupe.add(detente);
    const verre = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.034), mats.verre);
    verre.position.set(0, 0.083, -0.04);
    groupe.add(verre);
    const reticule = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.03), new THREE.MeshBasicMaterial({ map: textureReticule(), transparent: true, depthWrite: false, toneMapped: false }));
    reticule.position.set(0, 0.0815, -0.045);
    groupe.add(reticule);
    const marque = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.025), new THREE.MeshStandardMaterial({ map: textureMarquage("NS-7", "VECTEUR · 5.56 NEON"), transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    marque.position.set(-0.0262, -0.018, -0.03);
    marque.rotation.y = -Math.PI / 2;
    groupe.add(marque);
    Object.assign(pieces, { culasse, levier, detente, reticule });
  }

  return {
    groupe, pieces,
    points: POINTS_FUSIL,
  };
}

export const POINTS_FUSIL = {
      mainDroite: new THREE.Vector3(0, -0.075, 0.098),
      mainGauche: new THREE.Vector3(0, -0.04, -0.27),
      chargeur: new THREE.Vector3(0, -0.13, -0.09),
      levier: new THREE.Vector3(0, 0.04, 0.125),
      ejection: new THREE.Vector3(0.028, 0.02, -0.04),
      bouche: new THREE.Vector3(0, 0.006, -0.69),
      viseur: new THREE.Vector3(0, 0.0815, -0.04),
};

// ===== Bras et mains à la première personne =====
function construireBras(qualite, cote) {
  const tissu = textureTissu(qualite);
  const mats = {
    manche: new THREE.MeshStandardMaterial({ color: 0x26324a, map: tissu.map, normalMap: tissu.normalMap, roughness: 0.9 }),
    gant: new THREE.MeshStandardMaterial({ color: 0x1a1c21, roughness: 0.72 }),
    renfort: new THREE.MeshStandardMaterial({ color: 0x3a3f49, roughness: 0.55, metalness: 0.2 }),
    accent: new THREE.MeshStandardMaterial({ color: 0x7cffd4, emissive: 0x3fe0b0, emissiveIntensity: 0.5 }),
  };
  const epaule = new THREE.Group();
  const coude = new THREE.Group();
  const main = new THREE.Group();
  epaule.add(coude);
  coude.add(main);
  coude.position.y = -0.31;
  main.position.y = -0.29;

  const A1 = new Assemblage();
  A1.ajouter(membre(0.058, 0.05, 0.31), "manche");
  epaule.add(A1.construire(mats, false));

  const A2 = new Assemblage();
  A2.ajouter(membre(0.05, 0.04, 0.29), "manche");
  A2.ajouter(revolution([[0.047, -0.2], [0.05, -0.215], [0.05, -0.245], [0.044, -0.255]], 14), "manche");
  A2.ajouter(boiteRonde(0.05, 0.045, 0.03, 0.008), "renfort", { p: [cote * 0.02, -0.1, 0.035] });
  A2.ajouter(new THREE.BoxGeometry(0.03, 0.02, 0.003), "accent", { p: [cote * 0.02, -0.1, 0.051] });
  coude.add(A2.construire(mats, false));

  // Main gantée : paume, doigts repliés, pouce, renfort sur les phalanges.
  const A3 = new Assemblage();
  A3.ajouter(boiteRonde(0.078, 0.09, 0.032, 0.012), "gant", { p: [0, -0.045, 0] });
  for (let i = 0; i < 4; i++) {
    const x = -0.028 + i * 0.019;
    const doigtTendu = cote > 0 && i === 0;
    A3.ajouter(new THREE.CapsuleGeometry(0.0085, doigtTendu ? 0.05 : 0.026, 3, 8), "gant", { p: [x, doigtTendu ? -0.12 : -0.1, doigtTendu ? 0.01 : 0.02], r: [doigtTendu ? 0.2 : 1.2, 0, 0] });
    if (!doigtTendu) A3.ajouter(new THREE.CapsuleGeometry(0.0082, 0.022, 3, 8), "gant", { p: [x, -0.105, 0.045], r: [2.6, 0, 0] });
  }
  A3.ajouter(new THREE.CapsuleGeometry(0.01, 0.035, 3, 8), "gant", { p: [-cote * 0.045, -0.04, 0.03], r: [0.9, 0, -cote * 0.5] });
  A3.ajouter(boiteRonde(0.07, 0.016, 0.014, 0.004), "renfort", { p: [0, -0.088, -0.016] });
  main.add(A3.construire(mats, false));
  return { epaule, coude, main };
}

// ===== Modèle à la première personne =====
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _pole = new THREE.Vector3(), _q = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _qd = new THREE.Quaternion();
const DECALAGE_D = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, 0, 0));
const DECALAGE_G = new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.25, 0, 1.4));
const POCHE = new THREE.Vector3(-0.2, -0.55, -0.08);

export class ModeleArme {
  constructor(qualite = "moyenne") {
    this.qualite = qualite;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.01, 10);
    this.scene.add(new THREE.HemisphereLight(0xc4d6ff, 0x2a2018, 0.9));
    const cle = new THREE.DirectionalLight(0xffdcb8, 2.4);
    cle.position.set(-1.2, 2, 1.2);
    this.scene.add(cle);
    const contre = new THREE.DirectionalLight(0x7fb0ff, 1.1);
    contre.position.set(1.4, 0.6, -1.2);
    this.scene.add(contre);

    this.pivot = new THREE.Group();
    this.arme = new THREE.Group();
    this.pivot.add(this.arme);
    this.scene.add(this.pivot);

    const f = construireFusil(qualite, true);
    this.fusil = f;
    this.arme.add(f.groupe);
    this.pieces = f.pieces;
    this.points = f.points;
    this.chargeurRepos = f.pieces.chargeur.position.clone();

    this.brasD = construireBras(qualite, 1);
    this.brasG = construireBras(qualite, -1);
    this.brasD.epaule.position.set(0.22, -0.3, 0.12);
    this.brasG.epaule.position.set(-0.17, -0.3, 0.04);
    this.scene.add(this.brasD.epaule, this.brasG.epaule);

    // Flash du canon : étoile + deux plans en croix
    const matFlash = new THREE.MeshBasicMaterial({ map: textureEclat(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffd6a0, toneMapped: false });
    this.flash = new THREE.Group();
    const etoile = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), matFlash);
    const cone1 = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.22), matFlash);
    cone1.rotation.x = Math.PI / 2; cone1.position.z = -0.08;
    const cone2 = cone1.clone(); cone2.rotation.y = Math.PI / 2;
    this.flash.add(etoile, cone1, cone2);
    this.flash.position.copy(this.points.bouche);
    this.flash.visible = false;
    f.groupe.add(this.flash);
    this.lumiereFlash = new THREE.PointLight(0xffc27a, 0, 1.2);
    this.lumiereFlash.position.copy(this.points.bouche);
    f.groupe.add(this.lumiereFlash);

    // Douilles éjectées (réserve réutilisée, aucune création pendant le jeu)
    const mats = materiauxFusil(qualite);
    const geoDouille = new THREE.CylinderGeometry(0.0045, 0.0045, 0.028, 8).rotateX(Math.PI / 2);
    this.douilles = [];
    for (let i = 0; i < 8; i++) {
      const d = new THREE.Mesh(geoDouille, mats.laiton);
      d.visible = false;
      this.scene.add(d);
      this.douilles.push({ mesh: d, vie: 0, v: new THREE.Vector3(), w: new THREE.Vector3() });
    }
    this.iDouille = 0;

    this.echelle = 0.9;
    this.arme.scale.setScalar(this.echelle);
    this.hanche = new THREE.Vector3(0.16, -0.172, -0.25);
    this.visee = new THREE.Vector3(0, -this.points.viseur.y * this.echelle, -0.2);

    this.ressortZ = new Ressort(260, 22);
    this.ressortRx = new Ressort(220, 20);
    this.ressortRz = new Ressort(180, 16);
    this.ressortY = new Ressort(160, 18);
    this.flashT = 0;
    this.culasseT = 1;
    this.detenteT = 1;
    this.balance = new THREE.Vector2();
    this.sortie = 1;
    this.viseeK = 0;
    this.sprintK = 0;
    this.mouvementK = 0;
    this.pas = 0;
    this.amplitudeBob = 1;
  }

  redimensionner(ratio) {
    this.camera.aspect = ratio;
    this.camera.updateProjectionMatrix();
  }

  tir() {
    this.ressortZ.impulsion(1.6);
    this.ressortRx.impulsion(3.2 + Math.random() * 0.8);
    this.ressortRz.impulsion((Math.random() - 0.5) * 2.2);
    this.ressortY.impulsion(0.25);
    this.flashT = 0.04;
    this.flash.visible = true;
    this.flash.rotation.z = Math.random() * Math.PI;
    this.flash.scale.setScalar(0.75 + Math.random() * 0.5);
    this.lumiereFlash.intensity = 2.5;
    this.culasseT = 0;
    this.detenteT = 0;
    this.ejecterDouille();
  }

  ejecterDouille() {
    const d = this.douilles[this.iDouille++ % this.douilles.length];
    this.fusil.groupe.updateMatrixWorld(true);
    d.mesh.position.copy(this.points.ejection).applyMatrix4(this.fusil.groupe.matrixWorld);
    this.fusil.groupe.getWorldQuaternion(d.mesh.quaternion);
    d.v.set(1.6 + Math.random() * 0.6, 1.1 + Math.random() * 0.5, 0.4 + Math.random() * 0.3);
    d.w.set(Math.random() * 20, Math.random() * 30, Math.random() * 10);
    d.vie = 0.7;
    d.mesh.visible = true;
  }

  sortir() { this.sortie = 1; }

  static seg(t, a, b) { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); }

  // e : { dt, temps, vitesse, auSol, vise, sprint, souris:{x,y}, recharge (0..1 ou -1), rechargeVide }
  maj(e) {
    const dt = e.dt, seg = ModeleArme.seg;
    this.viseeK += ((e.vise ? 1 : 0) - this.viseeK) * (1 - Math.exp(-15 * dt));
    this.sprintK += ((e.sprint && !e.vise ? 1 : 0) - this.sprintK) * (1 - Math.exp(-9 * dt));
    this.sortie = Math.max(0, this.sortie - dt * 2.2);
    const sortie = this.sortie * this.sortie;

    const rz = this.ressortZ.maj(dt), rrx = this.ressortRx.maj(dt), rrz = this.ressortRz.maj(dt), ry = this.ressortY.maj(dt);

    this.flashT -= dt;
    if (this.flashT <= 0) this.flash.visible = false;
    this.lumiereFlash.intensity *= Math.exp(-45 * dt);
    this.culasseT = Math.min(1, this.culasseT + dt / 0.06);
    this.detenteT = Math.min(1, this.detenteT + dt / 0.08);

    const sx = Math.max(-1, Math.min(1, -e.souris.x * 0.004));
    const sy = Math.max(-1, Math.min(1, e.souris.y * 0.004));
    this.balance.x += (sx - this.balance.x) * (1 - Math.exp(-9 * dt));
    this.balance.y += (sy - this.balance.y) * (1 - Math.exp(-9 * dt));

    // Mouvement de marche en "huit", atténué en visée
    const mouvement = e.auSol ? Math.min(e.vitesse / 6, 1.2) : 0;
    this.mouvementK += (mouvement - this.mouvementK) * (1 - Math.exp(-8 * dt));
    this.pas += dt * (e.sprint ? 13 : 10) * (0.4 + this.mouvementK * 0.6);
    const amp = (1 - this.viseeK * 0.88) * this.mouvementK * this.amplitudeBob;
    const bobX = Math.sin(this.pas * 0.5) * 0.011 * amp;
    const bobY = -Math.abs(Math.cos(this.pas * 0.5)) * 0.012 * amp;
    const respiration = Math.sin(e.temps * 1.5) * 0.0018 * (1 - this.viseeK * 0.8);

    this.pivot.position.lerpVectors(this.hanche, this.visee, this.viseeK);
    this.pivot.position.x += bobX + this.balance.x * 0.025 * (1 - this.viseeK * 0.7) - this.sprintK * 0.02;
    this.pivot.position.y += bobY + respiration + this.balance.y * 0.018 * (1 - this.viseeK * 0.7) - sortie * 0.3 - this.sprintK * 0.04;
    this.pivot.rotation.set(
      this.balance.y * 0.06 - this.sprintK * 0.32 + sortie * 0.9,
      this.balance.x * 0.1 + this.sprintK * 0.62,
      this.balance.x * 0.08 + this.sprintK * 0.32 + bobX * 2
    );

    let rotX = rrx * 0.02, rotZ = rrz * 0.02, posY = ry * 0.004, posZ = rz * 0.022;
    const pc = this.pieces;
    pc.chargeur.position.copy(this.chargeurRepos);
    pc.chargeur.rotation.set(0, 0, 0);
    pc.chargeur.visible = true;
    pc.levier.position.set(0, 0, 0);
    let mixGauche = 0, mixPoche = 0, mixLevier = 0;
    const r = e.recharge;
    if (r >= 0) {
      const vide = e.rechargeVide;
      const fin = vide ? 0.78 : 0.86;
      const pose = seg(r, 0, 0.12) * (1 - seg(r, 0.9, 1));
      rotX += -0.18 * pose; rotZ += 0.42 * pose; posY += 0.012 * pose;
      const versChargeur = seg(r, 0.1, 0.2), sortieChargeur = seg(r, 0.22, 0.34), retour = seg(r, 0.5, 0.64), insertion = seg(r, 0.64, 0.72);
      mixGauche = versChargeur * (1 - seg(r, fin, Math.min(1, fin + 0.12)));
      mixPoche = sortieChargeur * (1 - retour);
      if (r > 0.22 && r < 0.72) {
        // Le chargeur suit la main : il descend hors de l'écran puis remonte dans le puits.
        const bas = sortieChargeur * (1 - retour) * 0.32 + (1 - insertion) * retour * 0.06;
        pc.chargeur.position.y = this.chargeurRepos.y - bas;
        pc.chargeur.position.z = this.chargeurRepos.z + bas * 0.25;
        pc.chargeur.rotation.x = -bas * 0.6;
        pc.chargeur.visible = bas < 0.3;
      }
      if (r >= 0.71 && r < 0.76) { posZ += 0.01 * Math.sin(((r - 0.71) / 0.05) * Math.PI); rotX += 0.03; }
      if (vide) {
        mixLevier = seg(r, 0.78, 0.84) * (1 - seg(r, 0.92, 0.98));
        const tire = seg(r, 0.84, 0.88) * (1 - seg(r, 0.89, 0.91));
        pc.levier.position.z = tire * 0.06;
        if (r > 0.89 && r < 0.92) posZ += 0.006;
      }
    }
    pc.culasse.position.z = -0.04 + Math.sin(this.culasseT * Math.PI) * 0.03;
    pc.detente.rotation.x = -Math.sin(this.detenteT * Math.PI) * 0.25;

    this.arme.rotation.set(rotX, 0, rotZ);
    this.arme.position.set(0, posY, posZ);

    for (const d of this.douilles) {
      if (d.vie <= 0) continue;
      d.vie -= dt;
      d.v.y -= 9.8 * dt;
      d.mesh.position.addScaledVector(d.v, dt);
      d.mesh.rotation.x += d.w.x * dt; d.mesh.rotation.y += d.w.y * dt;
      if (d.vie <= 0) d.mesh.visible = false;
    }

    this.placerMains(mixGauche, mixPoche, mixLevier);
  }

  // Cinématique inverse : les mains suivent les points de prise de l'arme.
  placerMains(mixGauche, mixPoche, mixLevier) {
    this.pivot.updateMatrixWorld(true);
    const m = this.fusil.groupe.matrixWorld;
    this.fusil.groupe.getWorldQuaternion(_qa);

    _v.copy(this.points.mainDroite).applyMatrix4(m);
    ik2(this.brasD.epaule, this.brasD.coude, 0.31, 0.34, _v, _pole.set(0.6, -0.5, 0.4));
    this.orienterMain(this.brasD, _qa, DECALAGE_D);

    _v.copy(this.points.mainGauche).applyMatrix4(m);
    if (mixGauche > 0) { _v2.copy(this.points.chargeur).applyMatrix4(m); _v.lerp(_v2, mixGauche); }
    if (mixPoche > 0) _v.lerp(POCHE, mixPoche);
    if (mixLevier > 0) {
      _v2.copy(this.points.levier);
      _v2.z += this.pieces.levier.position.z;
      _v2.applyMatrix4(m);
      _v.lerp(_v2, mixLevier);
    }
    ik2(this.brasG.epaule, this.brasG.coude, 0.31, 0.34, _v, _pole.set(-0.7, -0.6, 0.1));
    this.orienterMain(this.brasG, _qa, DECALAGE_G);
  }

  orienterMain(bras, qArme, decalage) {
    bras.epaule.updateMatrixWorld(true);
    bras.coude.getWorldQuaternion(_q);
    bras.main.quaternion.copy(_q.invert()).multiply(qArme).multiply(decalage);
  }
}
