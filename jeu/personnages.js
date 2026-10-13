// Personnages des bots : trois silhouettes (Avant-garde, Bastion, Spectre), équipements variés,
// squelette animé par cinématique inverse (pieds posés au sol, mains sur l'arme).
import * as THREE from "three";
import { boiteRonde, membre, revolution, Assemblage, ik2, Ressort } from "./formes.js";
import { textureTissu, texturePlaque } from "./textures.js";
import { fusilStatique, geometrieChargeur, POINTS_FUSIL } from "./arme.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const ARCHETYPES = ["avantgarde", "bastion", "spectre"];

const PALETTES = [
  { armure: 0xa8343f, tissu: 0x454a55, accent: 0xff5a4a },
  { armure: 0xb0542e, tissu: 0x4d4a3a, accent: 0xff7a3a },
  { armure: 0x8a3a5c, tissu: 0x524a44, accent: 0xff4f7a },
];

let communs = null;
function materiauxCommuns(qualite) {
  if (communs) return communs;
  const tissu = textureTissu(qualite);
  const plaque = texturePlaque(qualite);
  communs = {
    tex: { tissu, plaque },
    poly: new THREE.MeshStandardMaterial({ color: 0x1c1e23, roughness: 0.62, metalness: 0.1 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x3d424b, roughness: 0.35, metalness: 0.85 }),
    cuir: new THREE.MeshStandardMaterial({ color: 0x2c2723, roughness: 0.8 }),
    semelle: new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.95 }),
    peau: new THREE.MeshStandardMaterial({ color: 0x8c6552, roughness: 0.6 }),
    visiere: new THREE.MeshStandardMaterial({ color: 0x0c0f13, roughness: 0.06, metalness: 0.9, emissive: 0x3a0c08, emissiveIntensity: 1 }),
  };
  return communs;
}

const cachePalettes = new Map();
function materiauxPalette(qualite, i) {
  if (cachePalettes.has(i)) return cachePalettes.get(i);
  const c = materiauxCommuns(qualite);
  const p = PALETTES[i % PALETTES.length];
  const mats = {
    ...c,
    tissu: new THREE.MeshStandardMaterial({ color: p.tissu, map: c.tex.tissu.map, normalMap: c.tex.tissu.normalMap, roughness: 0.93 }),
    tissuClair: new THREE.MeshStandardMaterial({ color: new THREE.Color(p.tissu).multiplyScalar(1.5), map: c.tex.tissu.map, normalMap: c.tex.tissu.normalMap, roughness: 0.93 }),
    armure: new THREE.MeshStandardMaterial({ color: p.armure, map: c.tex.plaque.map, normalMap: c.tex.plaque.normalMap, roughness: 0.48, metalness: 0.12 }),
    accent: new THREE.MeshStandardMaterial({ color: p.accent, emissive: p.accent, emissiveIntensity: 0.55, roughness: 0.4 }),
    lentille: new THREE.MeshStandardMaterial({ color: 0x220806, emissive: p.accent, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.5 }),
  };
  cachePalettes.set(i, mats);
  return mats;
}

// Longueurs du squelette (mètres)
const CUISSE = 0.44, TIBIA = 0.43, CHEVILLE = 0.085, BRAS = 0.28, AVANT_BRAS = 0.3;

// ----- Construction des pièces par os -----
function piecesJambe(A, type, cote) {
  A.ajouter(membre(0.104, 0.074, CUISSE), "tissu");
  A.ajouter(boiteRonde(0.13, 0.08, 0.16, 0.035), "tissu", { p: [0, -0.03, 0] }); // haut de cuisse (volume)
  if (type === "bastion") A.ajouter(boiteRonde(0.13, 0.24, 0.05, 0.02), "armure", { p: [0, -0.18, 0.075], r: [0.08, 0, 0] });
  if (cote > 0) {
    A.ajouter(boiteRonde(0.04, 0.17, 0.11, 0.012), "poly", { p: [0.095, -0.2, 0] });       // étui sur la cuisse
    A.ajouter(boiteRonde(0.012, 0.03, 0.14, 0.004), "cuir", { p: [0.075, -0.13, 0] });
  } else {
    A.ajouter(boiteRonde(0.05, 0.1, 0.08, 0.015), "tissuClair", { p: [-0.09, -0.22, 0.02] }); // poche cargo
  }
  A.ajouter(revolution([[0.095, -0.04], [0.098, -0.06], [0.095, -0.075]], 14), "cuir"); // sangle haute
}

function piecesTibia(A, type) {
  A.ajouter(membre(0.078, 0.056, TIBIA), "tissu");
  if (type !== "spectre") A.ajouter(boiteRonde(0.1, 0.12, 0.06, 0.025), "armure", { p: [0, -0.02, 0.06] }); // genouillère
  else A.ajouter(boiteRonde(0.09, 0.08, 0.04, 0.018), "poly", { p: [0, -0.02, 0.055] });
  // Tige de la botte
  A.ajouter(revolution([[0.062, -TIBIA + 0.15], [0.066, -TIBIA + 0.12], [0.064, -TIBIA + 0.02], [0.06, -TIBIA]], 14), "cuir");
  A.ajouter(revolution([[0.067, -TIBIA + 0.1], [0.068, -TIBIA + 0.085], [0.066, -TIBIA + 0.075]], 14), "poly");
}

function piecesPied(A) {
  A.ajouter(boiteRonde(0.105, 0.085, 0.24, 0.03), "cuir", { p: [0, -0.03, 0.055] });
  A.ajouter(boiteRonde(0.112, 0.026, 0.27, 0.01), "semelle", { p: [0, -0.072, 0.058] });
  A.ajouter(boiteRonde(0.1, 0.04, 0.07, 0.02), "poly", { p: [0, -0.02, 0.15] }); // coque avant
}

function piecesBassin(A, type) {
  A.ajouter(boiteRonde(0.34, 0.17, 0.22, 0.06), "tissu", { p: [0, 0, 0] });
  A.ajouter(boiteRonde(0.335, 0.05, 0.225, 0.02), "cuir", { p: [0, 0.055, 0] }); // ceinture
  A.ajouter(boiteRonde(0.04, 0.035, 0.012, 0.004), "metal", { p: [0, 0.055, 0.115] }); // boucle
  for (const x of [-0.12, 0.12]) A.ajouter(boiteRonde(0.06, 0.07, 0.05, 0.012), "poly", { p: [x, 0.03, -0.11] }); // pochettes
  if (type === "spectre") {
    // Pans de veste qui retombent sur les hanches
    A.ajouter(boiteRonde(0.13, 0.2, 0.02, 0.008), "tissuClair", { p: [-0.1, -0.1, -0.1], r: [0.1, 0, 0] });
    A.ajouter(boiteRonde(0.13, 0.2, 0.02, 0.008), "tissuClair", { p: [0.1, -0.1, -0.1], r: [0.1, 0, 0] });
  }
}

function piecesColonne(A) {
  A.ajouter(boiteRonde(0.32, 0.22, 0.21, 0.07), "tissu", { p: [0, 0.08, 0] });
}

function piecesPoitrine(A, type) {
  const large = type === "bastion" ? 1.08 : type === "spectre" ? 0.94 : 1;
  A.ajouter(boiteRonde(0.4 * large, 0.34, 0.25, 0.09), "tissu", { p: [0, 0.12, 0] });
  A.ajouter(new THREE.SphereGeometry(0.13, 16, 10), "tissu", { p: [0, 0.26, 0], s: [1.45 * large, 0.55, 0.85] }); // trapèzes
  // Porte-plaques
  A.ajouter(boiteRonde(0.34 * large, 0.31, 0.06, 0.022), "armure", { p: [0, 0.12, 0.13], r: [-0.06, 0, 0] });
  A.ajouter(boiteRonde(0.34 * large, 0.33, 0.05, 0.022), "armure", { p: [0, 0.13, -0.13] });
  A.ajouter(boiteRonde(0.05, 0.22, 0.23, 0.015), "tissuClair", { p: [0.19 * large, 0.07, 0] });   // flancs
  A.ajouter(boiteRonde(0.05, 0.22, 0.23, 0.015), "tissuClair", { p: [-0.19 * large, 0.07, 0] });
  for (const x of [-0.1, 0.1]) A.ajouter(boiteRonde(0.06, 0.03, 0.26, 0.01), "tissuClair", { p: [x * large, 0.29, 0], r: [0, 0, 0] }); // bretelles
  // Poches à chargeurs et radio
  if (type !== "spectre") for (const x of [-0.09, 0, 0.09]) A.ajouter(boiteRonde(0.07, 0.1, 0.05, 0.012), "tissuClair", { p: [x * large, 0.03, 0.155] });
  else A.ajouter(boiteRonde(0.2, 0.08, 0.04, 0.012), "tissuClair", { p: [0, 0.03, 0.15] });
  A.ajouter(boiteRonde(0.06, 0.1, 0.04, 0.01), "poly", { p: [-0.1, 0.2, -0.16] });
  A.ajouter(new THREE.CylinderGeometry(0.004, 0.004, 0.24, 6), "poly", { p: [-0.12, 0.36, -0.16] });
  A.ajouter(boiteRonde(0.2, 0.012, 0.012, 0.004), "accent", { p: [0, 0.2, 0.142] }); // bande d'équipe
  // Col
  A.ajouter(revolution([[0.085, 0.27], [0.1, 0.29], [0.095, 0.33], [0.075, 0.34]], 16), "tissuClair");
  if (type === "bastion") {
    A.ajouter(boiteRonde(0.3, 0.24, 0.16, 0.03), "poly", { p: [0, 0.14, -0.2] });       // sac lourd
    A.ajouter(boiteRonde(0.14, 0.05, 0.05, 0.01), "accent", { p: [0, 0.2, -0.282] });
  } else {
    A.ajouter(boiteRonde(0.22, 0.2, 0.08, 0.025), "poly", { p: [0, 0.15, -0.17] });    // sac d'hydratation
  }
}

function piecesTete(A, type) {
  A.ajouter(new THREE.CylinderGeometry(0.055, 0.065, 0.1, 12), "tissu", { p: [0, -0.06, 0] }); // cou
  // Crâne (cagoule sombre ou peau sous le masque)
  A.ajouter(new THREE.SphereGeometry(0.11, 18, 14), "tissu", { p: [0, 0.07, 0.005], s: [1, 1.15, 1.08] });
  if (type === "avantgarde") {
    // Casque balistique avec coques d'oreilles et visière fumée
    A.ajouter(new THREE.SphereGeometry(0.128, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), "armure", { p: [0, 0.09, -0.005], s: [1.08, 1.02, 1.15] });
    A.ajouter(revolution([[0.128, 0], [0.132, -0.01], [0.128, -0.018]], 22), "poly", { p: [0, 0.085, -0.005], s: [1.08, 1, 1.15] });
    for (const s of [-1, 1]) A.ajouter(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 16).rotateZ(Math.PI / 2), "poly", { p: [s * 0.115, 0.055, 0] });
    A.ajouter(new THREE.SphereGeometry(0.135, 22, 10, -Math.PI * 0.35, Math.PI * 0.7, Math.PI * 0.42, Math.PI * 0.22), "visiere", { p: [0, 0.08, 0.008] });
    A.ajouter(boiteRonde(0.12, 0.045, 0.04, 0.015), "poly", { p: [0, -0.005, 0.085] }); // protège-mâchoire
    A.ajouter(boiteRonde(0.035, 0.03, 0.03, 0.006), "metal", { p: [0, 0.17, 0.085] });  // fixation lunettes
  } else if (type === "bastion") {
    // Casque intégral avec respirateur et deux optiques
    A.ajouter(boiteRonde(0.24, 0.24, 0.25, 0.09), "armure", { p: [0, 0.08, 0] });
    A.ajouter(new THREE.CylinderGeometry(0.045, 0.055, 0.06, 16).rotateX(Math.PI / 2), "poly", { p: [0, 0.0, 0.13] });
    for (const s of [-1, 1]) {
      A.ajouter(new THREE.CylinderGeometry(0.028, 0.028, 0.03, 14).rotateX(Math.PI / 2), "poly", { p: [s * 0.045, 0.085, 0.125] });
      A.ajouter(new THREE.CylinderGeometry(0.02, 0.02, 0.01, 14).rotateX(Math.PI / 2), "lentille", { p: [s * 0.045, 0.085, 0.142] });
      A.ajouter(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12).rotateZ(Math.PI / 2), "poly", { p: [s * 0.065, -0.01, 0.1] });
    }
    A.ajouter(boiteRonde(0.18, 0.014, 0.014, 0.004), "accent", { p: [0, 0.16, 0.118] });
  } else {
    // Capuche, masque facial et lunettes
    A.ajouter(new THREE.SphereGeometry(0.135, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), "tissuClair", { p: [0, 0.07, -0.012], s: [1, 1.08, 1.12] });
    A.ajouter(boiteRonde(0.16, 0.09, 0.07, 0.03), "poly", { p: [0, 0.0, 0.07] });
    A.ajouter(boiteRonde(0.17, 0.045, 0.05, 0.018), "poly", { p: [0, 0.085, 0.085] });
    for (const s of [-1, 1]) A.ajouter(boiteRonde(0.055, 0.032, 0.012, 0.01), "lentille", { p: [s * 0.036, 0.086, 0.112] });
  }
}

function piecesBras(A, type, cote) {
  A.ajouter(membre(0.072, 0.06, BRAS), "tissu");
  if (type === "bastion") A.ajouter(new THREE.SphereGeometry(0.1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), "armure", { p: [cote * 0.01, 0.0, 0], s: [1.05, 1.2, 1.1] });
  else A.ajouter(new THREE.SphereGeometry(0.075, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), "armure", { p: [cote * 0.008, -0.01, 0], s: [1, 1.3, 1.1] });
  A.ajouter(boiteRonde(0.04, 0.05, 0.004, 0.002), "accent", { p: [cote * 0.065, -0.1, 0], r: [0, Math.PI / 2, 0] }); // écusson
}

function piecesAvantBras(A, type, cote) {
  A.ajouter(membre(0.062, 0.048, 0.26), "tissu");
  A.ajouter(revolution([[0.052, -0.17], [0.056, -0.19], [0.056, -0.24], [0.048, -0.255]], 14), "poly"); // manchette du gant
  if (type !== "spectre") A.ajouter(boiteRonde(0.07, 0.12, 0.06, 0.02), "armure", { p: [0, -0.1, 0.02] });
}

function piecesMain(A, cote) {
  A.ajouter(boiteRonde(0.075, 0.085, 0.032, 0.012), "poly", { p: [0, -0.04, 0] });
  A.ajouter(boiteRonde(0.072, 0.045, 0.05, 0.016), "poly", { p: [0, -0.085, 0.018] }); // doigts repliés
  A.ajouter(new THREE.CapsuleGeometry(0.011, 0.03, 3, 8), "poly", { p: [-cote * 0.04, -0.035, 0.028], r: [0.9, 0, -cote * 0.4] });
}

// ----- Le personnage -----
const _cible = new THREE.Vector3(), _pole = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const POINT_POCHE = new THREE.Vector3(-0.14, -0.32, 0.12);

export class Personnage {
  constructor(type, palette, qualite) {
    this.type = type;
    const mats = materiauxPalette(qualite, palette);
    const ombres = qualite !== "basse";
    // Les pièces de l'arme reprennent les matériaux du corps (moins de matériaux = moins d'appels de rendu).
    const correspondance = { carcasse: "metal", carcasseClaire: "metal", acierSombre: "metal", acier: "metal", polymere: "poly", caoutchouc: "semelle", accent: "accent" };

    // Squelette : chaque pièce rigide est rattachée à un os. Le corps entier devient un maillage
    // à squelette (un seul appel de rendu par matériau pour tout le personnage, arme comprise).
    this.racine = new THREE.Group();
    const os = [];
    const pieces = [];
    const nouvelOs = (parent) => { const b = new THREE.Bone(); os.push(b); if (parent) parent.add(b); return b; };
    const habiller = (b, fn, ...args) => { const A = new Assemblage(); fn(A, ...args); pieces.push({ os: b, pieces: A.extraire() }); };

    this.corps = nouvelOs(null);
    this.racine.add(this.corps);

    this.jambes = [-1, 1].map((cote) => {
      const hanche = nouvelOs(this.corps);
      const genou = nouvelOs(hanche);
      const pied = nouvelOs(genou);
      hanche.position.set(cote * 0.1, 0.915, 0);
      genou.position.y = -CUISSE;
      pied.position.y = -TIBIA;
      habiller(hanche, piecesJambe, type, cote);
      habiller(genou, piecesTibia, type);
      habiller(pied, piecesPied);
      return { cote, hanche, genou, pied, cible: new THREE.Vector3(cote * 0.11, CHEVILLE, 0) };
    });

    this.bassin = nouvelOs(this.corps);
    this.bassin.position.y = 0.955;
    habiller(this.bassin, piecesBassin, type);
    this.colonne = nouvelOs(this.bassin);
    this.colonne.position.y = 0.08;
    habiller(this.colonne, piecesColonne);
    this.poitrine = nouvelOs(this.colonne);
    this.poitrine.position.y = 0.18;
    habiller(this.poitrine, piecesPoitrine, type);
    this.tete = nouvelOs(this.poitrine);
    this.tete.position.set(0, 0.385, 0.015);
    habiller(this.tete, piecesTete, type);

    const largeur = type === "bastion" ? 0.235 : type === "spectre" ? 0.21 : 0.22;
    this.bras = [-1, 1].map((cote) => {
      const epaule = nouvelOs(this.poitrine);
      const coude = nouvelOs(epaule);
      const main = nouvelOs(coude);
      epaule.position.set(cote * largeur, 0.26, 0);
      coude.position.y = -BRAS;
      main.position.y = -0.26;
      habiller(epaule, piecesBras, type, cote);
      habiller(coude, piecesAvantBras, type, cote);
      habiller(main, piecesMain, cote);
      return { cote, epaule, coude, main };
    });

    // Fusil : un os attaché à la poitrine, le chargeur a son propre os (il sort au rechargement)
    this.fusil = nouvelOs(this.poitrine);
    this.fusil.rotation.order = "YXZ";
    this.chargeur = nouvelOs(this.fusil);
    habiller(this.fusil, (A) => fusilStatique(A, false));
    habiller(this.chargeur, (A) => { const C = geometrieChargeur(false); for (const [k, g] of C.extraire()) for (const geo of g) A.pieces.has(k) ? A.pieces.get(k).push(geo) : A.pieces.set(k, [geo]); });
    this.points = POINTS_FUSIL;
    this.chargeurRepos = new THREE.Vector3();

    // Fusion en maillages à squelette (pose de repos = pose de liaison)
    this.racine.updateMatrixWorld(true);
    const parMateriau = new Map();
    for (const { os: b, pieces: p } of pieces) {
      const indice = os.indexOf(b);
      for (const [cle, geos] of p) {
        const cleFinale = correspondance[cle] || cle;
        for (const g of geos) {
          g.applyMatrix4(b.matrixWorld);
          const n = g.attributes.position.count;
          g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(new Uint16Array(n * 4).fill(0).map((v, i) => (i % 4 === 0 ? indice : 0)), 4));
          g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((v, i) => (i % 4 === 0 ? 1 : 0)), 4));
          if (!parMateriau.has(cleFinale)) parMateriau.set(cleFinale, []);
          parMateriau.get(cleFinale).push(g);
        }
      }
    }
    this.squelette = new THREE.Skeleton(os);
    this.maillages = [];
    for (const [cle, geos] of parMateriau) {
      const geo = mergeGeometries(geos, false);
      for (const g of geos) g.dispose();
      const m = new THREE.SkinnedMesh(geo, mats[cle]);
      m.castShadow = ombres;
      m.receiveShadow = ombres;
      m.frustumCulled = false;
      this.racine.add(m);
      m.bind(this.squelette);
      this.maillages.push(m);
    }

    // État d'animation
    this.phase = Math.random();
    this.marcheK = 0;
    this.viseK = 0;
    this.courseK = 0;
    this.respire = Math.random() * 6;
    this.ressortTir = new Ressort(300, 24);
    this.ressortImpactX = new Ressort(120, 10);
    this.ressortImpactY = new Ressort(120, 10);
    this.mortT = -1;
    this.chute = 0;
    this.hancheY = 0.92;
  }

  tir() { this.ressortTir.impulsion(2.2); }

  // Réaction à un impact : direction locale (x : gauche/droite, z : avant/arrière)
  impact(dx, dz, fort) {
    const k = fort ? 5 : 3;
    this.ressortImpactX.impulsion(-dz * k);
    this.ressortImpactY.impulsion(dx * k);
  }

  mourir(sens) {
    this.mortT = 0;
    this.chute = sens;
  }

  // e : { dt, vitesse, dirX, dirZ (direction du mouvement dans le repère du personnage), vise (bool), tangage, recharge (-1 ou 0..1) }
  maj(e) {
    const dt = e.dt;
    const lisse = (k) => 1 - Math.exp(-k * dt);
    const mort = this.mortT >= 0;
    if (mort) this.mortT += dt;

    const v = mort ? 0 : e.vitesse;
    this.marcheK += (Math.min(v / 1.2, 1) - this.marcheK) * lisse(8);
    this.courseK += (Math.min(Math.max((v - 3) / 2, 0), 1) - this.courseK) * lisse(5);
    this.viseK += ((e.vise && !mort ? 1 : 0) - this.viseK) * lisse(7);
    this.respire += dt * 1.7;

    // --- Jambes : phase de pas proportionnelle à la distance parcourue (pas de glissement) ---
    const demiFoulee = 0.2 + 0.26 * Math.min(v / 5.2, 1);
    if (v > 0.05) this.phase = (this.phase + (v * dt) / (4 * demiFoulee)) % 1;
    const w = this.marcheK;
    const rebond = 0.028 * w * (0.5 + 0.5 * Math.cos(this.phase * Math.PI * 4));
    let hancheY = 0.915 - rebond - this.courseK * 0.03;
    if (mort) {
      // Les genoux cèdent puis les jambes se tendent pendant la chute en arrière.
      const t = this.mortT;
      const plie = Math.min(1, t / 0.22) * (1 - Math.min(1, Math.max(0, (t - 0.2) / 0.4)));
      hancheY = 0.9 - plie * 0.25;
    }

    for (const j of this.jambes) {
      j.hanche.position.set(j.cote * 0.1, hancheY, 0);
      if (!mort) {
        const t = (this.phase + (j.cote > 0 ? 0.5 : 0)) % 1;
        let avance, leve = 0;
        if (t < 0.5) avance = demiFoulee - (t / 0.5) * 2 * demiFoulee;
        else {
          const u = (t - 0.5) / 0.5;
          const s = u * u * (3 - 2 * u);
          avance = -demiFoulee + s * 2 * demiFoulee;
          leve = Math.sin(Math.PI * u) * (0.09 + this.courseK * 0.08);
        }
        j.cible.set(j.cote * 0.11 + e.dirX * avance * w, CHEVILLE + leve * w, e.dirZ * avance * w);
      }
      _pole.set(j.cote * 0.12, hancheY - 0.4, 1.2);
      ik2(j.hanche, j.genou, CUISSE, TIBIA, _cible.copy(j.cible).setY(Math.min(j.cible.y, hancheY - 0.05)), _pole);
      // Pied à plat (on annule la rotation de la jambe), pointe levée pendant le pas
      _q.copy(j.hanche.quaternion).multiply(j.genou.quaternion).invert();
      j.pied.quaternion.copy(_q);
    }

    // --- Buste ---
    const balance = Math.sin(this.phase * Math.PI * 2) * w;
    const ix = this.ressortImpactX.maj(dt), iy = this.ressortImpactY.maj(dt), rt = this.ressortTir.maj(dt);
    this.bassin.position.set(0, hancheY + 0.04, 0);
    this.bassin.rotation.set(0, balance * 0.09, 0);
    this.colonne.rotation.set(0.05 + this.courseK * 0.14 + ix * 0.05, -balance * 0.13 + iy * 0.05, 0);
    const tangage = (e.tangage || 0) * this.viseK;
    this.poitrine.rotation.set(-tangage * 0.55 - rt * 0.012, -balance * 0.06, 0);
    this.poitrine.scale.setScalar(1 + Math.sin(this.respire) * 0.006);
    this.tete.rotation.set(-tangage * 0.45, balance * 0.05, 0);

    // --- Fusil : prêt (canon vers le bas) ou épaulé ---
    const k = this.viseK;
    this.fusil.position.set(0.085 * (1 - k) + 0.06 * k, 0.07 * (1 - k) + 0.22 * k, 0.3 + 0.05 * k - rt * 0.02);
    this.fusil.rotation.set(-0.55 * (1 - k) - this.courseK * 0.2 * (1 - k), Math.PI - 0.08 * (1 - k), 0.25 * (1 - k));

    // --- Bras : les mains tiennent le fusil (une fois éliminé, l'arme tombe et les bras retombent) ---
    this.fusil.updateMatrix();
    const [g, d] = this.bras;
    if (mort && this.mortT > 0.25) {
      this.fusil.scale.setScalar(0.0001);
      for (const b of this.bras) ik2(b.epaule, b.coude, BRAS, AVANT_BRAS, _cible.set(b.cote * 0.32, -0.25, 0.08), _pole.set(b.cote * 0.6, 0, -0.4));
    } else {
      this.fusil.scale.setScalar(1);
    _cible.copy(this.points.mainDroite).applyMatrix4(this.fusil.matrix);
    ik2(d.epaule, d.coude, BRAS, AVANT_BRAS, _cible, _pole.set(0.5, -0.2, -0.3));
    _cible.copy(this.points.mainGauche).applyMatrix4(this.fusil.matrix);
    this.chargeur.position.copy(this.chargeurRepos);
    this.chargeur.scale.setScalar(1);
    const r = e.recharge;
    if (r >= 0 && !mort) {
      // Main gauche : chargeur -> ceinture -> chargeur -> garde-main
      const versChargeur = Math.min(1, r / 0.2), poche = r > 0.25 && r < 0.65 ? Math.sin(((r - 0.25) / 0.4) * Math.PI) : 0;
      const retour = r > 0.8 ? (r - 0.8) / 0.2 : 0;
      _p.copy(this.points.chargeur).applyMatrix4(this.fusil.matrix);
      _cible.lerp(_p, versChargeur * (1 - retour));
      _cible.lerp(POINT_POCHE, poche);
      if (r > 0.25 && r < 0.65) { this.chargeur.position.y = this.chargeurRepos.y - poche * 0.25; if (poche > 0.8) this.chargeur.scale.setScalar(0.0001); }
    }
    ik2(g.epaule, g.coude, BRAS, AVANT_BRAS, _cible, _pole.set(-0.5, -0.5, -0.1));
    }

    // --- Élimination : le corps s'affaisse puis bascule ---
    if (mort) {
      const t = this.mortT;
      const k1 = Math.min(1, Math.max(0, (t - 0.12) / 0.55));
      const e1 = k1 * k1 * (3 - 2 * k1);
      this.corps.rotation.set(-e1 * 1.5, 0, e1 * this.chute * 0.25);
      this.corps.position.set(0, e1 * 0.13, -e1 * 0.15);
      this.colonne.rotation.x = 0.35 * Math.min(1, t / 0.2) * (1 - e1);
      this.tete.rotation.x = e1 * 0.5;
    }
  }
}
