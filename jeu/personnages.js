// Personnages 3D : chaque héros (heros.js) est assemblé à partir de son "apparence" — morphologie,
// visage, coiffure, tenue, équipement dorsal, couleurs — sur un squelette commun animé par
// cinématique inverse (pieds posés au sol, mains sur l'arme).
// Les pièces sont des volumes procéduraux (sphères, boîtes arrondies, profils) fusionnés en maillages
// à squelette : un appel de rendu par matériau pour tout le personnage, arme comprise.
// Les couleurs d'équipe (bleu / rouge) sont portées par des bandes lumineuses pour rester lisibles.
import * as THREE from "three";
import { boiteRonde, membre, revolution, Assemblage, ik2, Ressort } from "./formes.js";
import { textureTissu, texturePlaque } from "./textures.js";
import { piecesArme } from "./armes.js";
import { HEROS } from "./heros.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const COULEURS_EQUIPE = { bleu: 0x4fd2ff, rouge: 0xff4655 };

// Mannequin du stand de tir (pas un héros jouable)
const APPARENCE_MANNEQUIN = {
  corps: "standard", taille: 1, peau: 0x8c6552, cheveux: 0x222222, yeux: 0x222222,
  tete: "casque", buste: "plastron", epaules: "legeres", dos: "sac", jambes: "cargo",
  couleurs: { armure: 0xd8cfbd, tissu: 0x8a8478, secondaire: 0x6a665c, accent: 0xffb020 },
};

const LUEURS = new Set(["accent", "lentille", "visiere", "equipe", "irisLumineux"]);

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
    visiere: new THREE.MeshStandardMaterial({ color: 0x0c0f13, roughness: 0.06, metalness: 0.9, emissive: 0x1a2a3a, emissiveIntensity: 1 }),
    coque: new THREE.MeshStandardMaterial({ color: 0xe6e9ed, roughness: 0.5, metalness: 0.2 }),
    blanc: new THREE.MeshStandardMaterial({ color: 0xe9e5df, roughness: 0.45 }),
  };
  return communs;
}

// Matériaux d'un héros pour une équipe (gardés en cache)
const cacheMateriaux = new Map();
function materiauxHeros(qualite, cle, a, teinte) {
  const id = cle + "|" + teinte;
  if (cacheMateriaux.has(id)) return cacheMateriaux.get(id);
  let c = materiauxCommuns(qualite);
  // La vitrine des menus découpe ses matériaux (animation d'apparition) : copies à part
  if (teinte === "vitrine") c = Object.fromEntries(Object.entries(c).map(([n, m]) => [n, m && m.isMaterial ? m.clone() : m]));
  const k = a.couleurs;
  const relief = qualite !== "basse";
  const equipe = COULEURS_EQUIPE[teinte] ?? k.accent;
  const mats = {
    ...c,
    tissu: new THREE.MeshStandardMaterial({ color: k.tissu, map: c.tex.tissu.map, normalMap: relief ? c.tex.tissu.normalMap : null, roughness: 0.93 }),
    tissuClair: new THREE.MeshStandardMaterial({ color: new THREE.Color(k.tissu).multiplyScalar(1.5), map: c.tex.tissu.map, normalMap: relief ? c.tex.tissu.normalMap : null, roughness: 0.93 }),
    armure: new THREE.MeshStandardMaterial({ color: k.armure, map: c.tex.plaque.map, normalMap: relief ? c.tex.plaque.normalMap : null, roughness: 0.46, metalness: 0.12 }),
    secondaire: new THREE.MeshStandardMaterial({ color: k.secondaire, roughness: 0.55, metalness: 0.15 }),
    accent: new THREE.MeshStandardMaterial({ color: k.accent, emissive: k.accent, emissiveIntensity: 0.8, roughness: 0.4 }),
    equipe: new THREE.MeshStandardMaterial({ color: equipe, emissive: equipe, emissiveIntensity: 1.1, roughness: 0.4 }),
    lentille: new THREE.MeshStandardMaterial({ color: 0x220806, emissive: equipe, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.5 }),
    peau: new THREE.MeshStandardMaterial({ color: a.peau, roughness: 0.62 }),
    cheveux: new THREE.MeshStandardMaterial({ color: a.cheveux, roughness: 0.72, metalness: 0.05 }),
    iris: new THREE.MeshStandardMaterial({ color: a.yeux, roughness: 0.2 }),
    irisLumineux: new THREE.MeshStandardMaterial({ color: a.yeux, emissive: a.yeux, emissiveIntensity: 1.6, roughness: 0.2 }),
  };
  // PC modeste : deux matériaux (couleurs portées par les sommets) = deux appels de rendu par personnage
  mats.base = new THREE.MeshLambertMaterial({ vertexColors: true });
  mats.lueur = new THREE.MeshBasicMaterial({ vertexColors: true });
  cacheMateriaux.set(id, mats);
  return mats;
}

// Ombre ronde sous les pieds (bien moins chère qu'une ombre portée calculée à chaque image)
let matOmbre = null;
function materiauOmbre() {
  if (matOmbre) return matOmbre;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const d = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  d.addColorStop(0, "rgba(0,0,0,0.55)");
  d.addColorStop(0.55, "rgba(0,0,0,0.3)");
  d.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = d;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  matOmbre = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
  return matOmbre;
}
const geoOmbre = new THREE.PlaneGeometry(1.1, 1.1).rotateX(-Math.PI / 2);
const cacheGeometries = new Map();

// Matériau du camouflage optique (personnage presque invisible)
let matCamo = null;
function materiauCamo() {
  if (!matCamo) matCamo = new THREE.MeshStandardMaterial({ color: 0x9fb4c8, roughness: 0.05, metalness: 1, transparent: true, opacity: 0.07, depthWrite: false });
  return matCamo;
}

// Niveau de détail des pièces : réduit en qualité "Faible" (moins de segments sur les formes arrondies)
let DETAIL = 1;
const seg = (n, min) => Math.max(min, Math.round(n * DETAIL));
const br = (l, h, p, r = 0.01) => boiteRonde(l, h, p, r, DETAIL < 1 ? 1 : 2);
const sphere = (r, w = 16, h = 12, ...reste) => new THREE.SphereGeometry(r, seg(w, 6), seg(h, 4), ...reste);
const rev = (points, n = 16) => revolution(points, seg(n, 6));
const membreD = (r1, r2, l) => membre(r1, r2, l, seg(12, 7));

// Longueurs du squelette (mètres)
const CUISSE = 0.44, TIBIA = 0.43, CHEVILLE = 0.085, BRAS = 0.28, AVANT_BRAS = 0.3;
const PI = Math.PI;

// Morphologie : largeur du buste (k) et épaisseur des membres (m)
function morpho(a) {
  if (a.corps === "massif") return { k: 1.12, m: 1.14 };
  if (a.corps === "fin") return { k: 0.92, m: 0.9 };
  return { k: 1, m: 1 };
}
const manches = (a) => (a.buste === "veste" || a.buste === "manteau" ? "armure" : "tissu");

// ===== Jambes =====
function piecesJambe(A, a, cote) {
  const { m } = morpho(a);
  A.ajouter(membreD(0.104 * m, 0.074 * m, CUISSE), "tissu");
  A.ajouter(br(0.13 * m, 0.08, 0.16 * m, 0.035), "tissu", { p: [0, -0.03, 0] });
  if (a.jambes === "blindees") {
    A.ajouter(br(0.14 * m, 0.25, 0.055, 0.02), "armure", { p: [0, -0.18, 0.08 * m], r: [0.08, 0, 0] });
    A.ajouter(br(0.05, 0.22, 0.12, 0.015), "armure", { p: [cote * 0.09 * m, -0.17, 0] });
    A.ajouter(br(0.1 * m, 0.012, 0.012, 0.004), "secondaire", { p: [0, -0.1, 0.11 * m] });
  } else if (a.jambes === "moulantes") {
    A.ajouter(br(0.012, 0.32, 0.03, 0.005), "secondaire", { p: [cote * 0.095 * m, -0.2, 0] });
  } else if (cote > 0) {
    A.ajouter(br(0.04, 0.17, 0.11, 0.012), "poly", { p: [0.095 * m, -0.2, 0] });       // étui sur la cuisse
    A.ajouter(br(0.012, 0.03, 0.14, 0.004), "cuir", { p: [0.075 * m, -0.13, 0] });
  } else {
    A.ajouter(br(0.05, 0.1, 0.08, 0.015), "tissuClair", { p: [-0.09 * m, -0.22, 0.02] }); // poche cargo
  }
  if (a.jambes !== "moulantes") A.ajouter(rev([[0.095 * m, -0.04], [0.098 * m, -0.06], [0.095 * m, -0.075]], 14), "cuir");
}

function piecesTibia(A, a) {
  const { m } = morpho(a);
  A.ajouter(membreD(0.078 * m, 0.056 * m, TIBIA), "tissu");
  if (a.jambes === "blindees") {
    A.ajouter(br(0.12 * m, 0.14, 0.07, 0.03), "armure", { p: [0, -0.02, 0.065 * m] });
    A.ajouter(br(0.09 * m, 0.22, 0.05, 0.02), "armure", { p: [0, -0.2, 0.06 * m] });
  } else if (a.jambes === "moulantes") A.ajouter(br(0.085, 0.07, 0.035, 0.016), "secondaire", { p: [0, -0.02, 0.052 * m] });
  else A.ajouter(br(0.1, 0.12, 0.06, 0.025), "armure", { p: [0, -0.02, 0.06] });
  const botte = a.jambes === "moulantes" ? "poly" : "cuir";
  A.ajouter(rev([[0.062 * m, -TIBIA + 0.15], [0.066 * m, -TIBIA + 0.12], [0.064 * m, -TIBIA + 0.02], [0.06 * m, -TIBIA]], 14), botte);
  A.ajouter(rev([[0.067 * m, -TIBIA + 0.1], [0.068 * m, -TIBIA + 0.085], [0.066 * m, -TIBIA + 0.075]], 14), a.jambes === "moulantes" ? "accent" : "poly");
}

function piecesPied(A, a) {
  const lourd = a.jambes === "blindees";
  A.ajouter(br(lourd ? 0.115 : 0.105, 0.085, 0.24, 0.03), a.jambes === "moulantes" ? "poly" : "cuir", { p: [0, -0.03, 0.055] });
  A.ajouter(br(lourd ? 0.12 : 0.112, 0.026, 0.27, 0.01), "semelle", { p: [0, -0.072, 0.058] });
  A.ajouter(br(lourd ? 0.11 : 0.1, 0.04, 0.07, 0.02), lourd ? "metal" : "poly", { p: [0, -0.02, 0.15] });
}

// ===== Bassin, taille =====
function piecesBassin(A, a) {
  const { k } = morpho(a);
  A.ajouter(br(0.34 * k, 0.17, 0.22, 0.06), "tissu", { p: [0, 0, 0] });
  A.ajouter(br(0.335 * k, 0.05, 0.225, 0.02), "cuir", { p: [0, 0.055, 0] }); // ceinture
  A.ajouter(br(0.04, 0.035, 0.012, 0.004), a.buste === "combinaison" ? "accent" : "metal", { p: [0, 0.055, 0.115] });
  if (a.buste !== "combinaison") for (const x of [-0.12, 0.12]) A.ajouter(br(0.06, 0.07, 0.05, 0.012), "poly", { p: [x * k, 0.03, -0.11] });
  if (a.buste === "manteau") {
    // Pans du manteau : arrière et côtés (ouverts devant pour laisser passer les jambes)
    A.ajouter(br(0.34 * k, 0.56, 0.025, 0.01), "armure", { p: [0, -0.26, -0.13], r: [0.14, 0, 0] });
    for (const s of [-1, 1]) {
      A.ajouter(br(0.025, 0.52, 0.2, 0.01), "armure", { p: [s * 0.185 * k, -0.24, -0.02], r: [0, 0, s * 0.12] });
      A.ajouter(br(0.11, 0.46, 0.022, 0.01), "armure", { p: [s * 0.13 * k, -0.22, 0.12], r: [-0.1, 0, s * 0.1] });
    }
    A.ajouter(br(0.3 * k, 0.02, 0.012, 0.004), "accent", { p: [0, -0.52, -0.168], r: [0.14, 0, 0] });
  }
  if (a.buste === "armureLourde") for (const s of [-1, 1]) A.ajouter(br(0.12, 0.16, 0.05, 0.02), "armure", { p: [s * 0.13 * k, -0.08, 0.1], r: [0.1, 0, s * 0.15] }); // tassettes
}

function piecesColonne(A, a) {
  const { k } = morpho(a);
  A.ajouter(br(0.32 * k, 0.22, 0.21, 0.07), "tissu", { p: [0, 0.08, 0] });
  if (a.buste === "armureLourde") for (let i = 0; i < 2; i++) A.ajouter(br(0.24 * k, 0.055, 0.05, 0.018), "armure", { p: [0, 0.04 + i * 0.065, 0.1] });
  if (a.buste === "veste" || a.buste === "manteau") A.ajouter(br(0.33 * k, 0.2, 0.22, 0.07), manches(a), { p: [0, 0.1, 0] });
}

// ===== Buste =====
function piecesPoitrine(A, a) {
  const { k } = morpho(a);
  A.ajouter(br(0.4 * k, 0.34, 0.25, 0.09), "tissu", { p: [0, 0.12, 0] });
  A.ajouter(sphere(0.13, 16, 10), "tissu", { p: [0, 0.26, 0], s: [1.45 * k, 0.55, 0.85] }); // trapèzes
  const b = a.buste;
  if (b === "plastron") {
    A.ajouter(br(0.34 * k, 0.31, 0.06, 0.022), "armure", { p: [0, 0.12, 0.13], r: [-0.06, 0, 0] });
    A.ajouter(br(0.34 * k, 0.33, 0.05, 0.022), "armure", { p: [0, 0.13, -0.13] });
    for (const s of [-1, 1]) A.ajouter(br(0.05, 0.22, 0.23, 0.015), "tissuClair", { p: [s * 0.19 * k, 0.07, 0] });
    for (const x of [-0.1, 0.1]) A.ajouter(br(0.06, 0.03, 0.26, 0.01), "tissuClair", { p: [x * k, 0.29, 0] });
    for (const x of [-0.09, 0, 0.09]) A.ajouter(br(0.07, 0.1, 0.05, 0.012), "tissuClair", { p: [x * k, 0.03, 0.155] });
    A.ajouter(br(0.2 * k, 0.012, 0.012, 0.004), "equipe", { p: [0, 0.2, 0.162] });
    A.ajouter(br(0.26 * k, 0.03, 0.01, 0.004), "secondaire", { p: [0, 0.255, 0.155] });
    A.ajouter(rev([[0.085, 0.27], [0.1, 0.29], [0.095, 0.33], [0.075, 0.34]], 16), "tissuClair");
  } else if (b === "armureLourde") {
    A.ajouter(br(0.39 * k, 0.35, 0.085, 0.03), "armure", { p: [0, 0.13, 0.135], r: [-0.05, 0, 0] });
    A.ajouter(br(0.39 * k, 0.37, 0.07, 0.03), "armure", { p: [0, 0.14, -0.135] });
    for (const s of [-1, 1]) {
      A.ajouter(br(0.06, 0.24, 0.24, 0.02), "armure", { p: [s * 0.2 * k, 0.08, 0] });
      A.ajouter(br(0.035, 0.26, 0.012, 0.004), "secondaire", { p: [s * 0.095 * k, 0.13, 0.181], r: [-0.05, 0, 0] });
    }
    A.ajouter(br(0.16, 0.05, 0.02, 0.008), "equipe", { p: [0, 0.23, 0.18] });
    A.ajouter(rev([[0.11, 0.25], [0.135, 0.28], [0.13, 0.34], [0.1, 0.36]], 18), "armure");
  } else if (b === "veste" || b === "manteau") {
    const ouverte = b === "veste";
    if (ouverte) for (const s of [-1, 1]) A.ajouter(br(0.195 * k, 0.36, 0.27, 0.07), "armure", { p: [s * 0.108 * k, 0.11, -0.003] });
    else A.ajouter(br(0.42 * k, 0.37, 0.27, 0.08), "armure", { p: [0, 0.11, 0] });
    for (const s of [-1, 1]) A.ajouter(br(0.014, 0.3, 0.012, 0.004), "secondaire", { p: [s * (ouverte ? 0.022 : 0.035), 0.11, 0.137] });
    if (!ouverte) for (let i = 0; i < 4; i++) A.ajouter(sphere(0.009, 8, 6), "metal", { p: [0.06, 0.03 + i * 0.07, 0.139] });
    A.ajouter(rev([[0.1, 0.26], [0.13, 0.29], [0.135, ouverte ? 0.35 : 0.39], [0.115, ouverte ? 0.36 : 0.4]], 18), "armure");
    A.ajouter(br(0.05, 0.03, 0.01, 0.004), "equipe", { p: [0.11 * k, 0.21, 0.139] });
    A.ajouter(br(0.24 * k, 0.012, 0.01, 0.004), "equipe", { p: [0, 0.2, -0.139] });
    for (const s of [-1, 1]) A.ajouter(br(0.08, 0.07, 0.02, 0.01), "tissuClair", { p: [s * 0.1 * k, 0.0, 0.14] });
  } else if (b === "combinaison") {
    A.ajouter(br(0.3 * k, 0.2, 0.04, 0.02), "armure", { p: [0, 0.17, 0.125], r: [-0.05, 0, 0] });
    A.ajouter(br(0.28 * k, 0.24, 0.04, 0.02), "armure", { p: [0, 0.16, -0.125] });
    for (const s of [-1, 1]) A.ajouter(br(0.008, 0.3, 0.006, 0.003), "accent", { p: [s * 0.075 * k, 0.07, 0.128] });
    A.ajouter(br(0.14, 0.012, 0.01, 0.004), "equipe", { p: [0, 0.255, 0.148] });
    A.ajouter(br(0.2, 0.012, 0.01, 0.004), "equipe", { p: [0, 0.24, -0.147] });
    A.ajouter(rev([[0.08, 0.27], [0.092, 0.29], [0.09, 0.345], [0.075, 0.35]], 16), "tissuClair");
  } else if (b === "harnais") {
    for (const s of [-1, 1]) {
      A.ajouter(br(0.045, 0.46, 0.012, 0.004), "cuir", { p: [0, 0.12, 0.13], r: [0, 0, s * 0.62] });
      A.ajouter(br(0.045, 0.46, 0.012, 0.004), "cuir", { p: [0, 0.12, -0.13], r: [0, 0, s * 0.62] });
      A.ajouter(br(0.06, 0.08, 0.045, 0.012), "poly", { p: [s * 0.12 * k, 0.03, 0.15] });
      A.ajouter(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 8), "metal", { p: [s * 0.15 * k, 0.18, 0.15] });
    }
    A.ajouter(br(0.3 * k, 0.12, 0.04, 0.015), "armure", { p: [0, 0.2, 0.125] });
    A.ajouter(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 14).rotateX(PI / 2), "equipe", { p: [0, 0.12, 0.142] });
    A.ajouter(rev([[0.085, 0.27], [0.1, 0.29], [0.095, 0.33], [0.075, 0.34]], 16), "tissuClair");
  }
  if (a.epaules === "fourrure") A.ajouter(new THREE.TorusGeometry(0.15, 0.055, 8, 20).rotateX(PI / 2), "blanc", { p: [0, 0.29, -0.01], s: [1.25 * k, 1, 0.95] });
  piecesDos(A, a, k);
}

function piecesDos(A, a, k) {
  const z = a.buste === "armureLourde" ? -0.18 : -0.165;
  switch (a.dos) {
    case "sac":
      A.ajouter(br(0.24, 0.22, 0.08, 0.025), "poly", { p: [0, 0.15, z - 0.01] });
      A.ajouter(br(0.14, 0.04, 0.02, 0.008), "accent", { p: [0, 0.2, z - 0.055] });
      break;
    case "propulseurs":
      A.ajouter(br(0.26, 0.24, 0.07, 0.025), "armure", { p: [0, 0.15, z] });
      for (const s of [-1, 1]) {
        A.ajouter(new THREE.CylinderGeometry(0.05, 0.045, 0.26, 16), "metal", { p: [s * 0.08, 0.12, z - 0.07] });
        A.ajouter(rev([[0.045, 0], [0.058, -0.04], [0.06, -0.07], [0.05, -0.07]], 16), "poly", { p: [s * 0.08, -0.01, z - 0.07] });
        A.ajouter(new THREE.CylinderGeometry(0.038, 0.038, 0.01, 14), "accent", { p: [s * 0.08, -0.075, z - 0.07] });
      }
      A.ajouter(br(0.16, 0.02, 0.02, 0.006), "secondaire", { p: [0, 0.27, z - 0.04] });
      break;
    case "reservoirs":
      A.ajouter(br(0.22, 0.2, 0.05, 0.02), "poly", { p: [0, 0.14, z + 0.01] });
      for (const s of [-1, 1]) {
        A.ajouter(new THREE.CapsuleGeometry(0.05, 0.2, 4, 14), "secondaire", { p: [s * 0.07, 0.14, z - 0.06] });
        A.ajouter(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 10), "metal", { p: [s * 0.07, 0.29, z - 0.06] });
        A.ajouter(new THREE.TorusGeometry(0.051, 0.006, 6, 18).rotateX(PI / 2), "accent", { p: [s * 0.07, 0.1, z - 0.06] });
        const tuyau = new THREE.CatmullRomCurve3([new THREE.Vector3(s * 0.07, 0.3, z - 0.06), new THREE.Vector3(s * 0.16, 0.3, z), new THREE.Vector3(s * 0.21 * k, 0.2, 0.0)]);
        A.ajouter(new THREE.TubeGeometry(tuyau, 8, 0.011, 6), "cuir");
      }
      break;
    case "antenne":
      A.ajouter(br(0.2, 0.2, 0.08, 0.02), "poly", { p: [0, 0.14, z - 0.01] });
      A.ajouter(new THREE.CylinderGeometry(0.007, 0.01, 0.42, 6), "metal", { p: [0.07, 0.42, z - 0.03] });
      A.ajouter(sphere(0.016, 8, 6), "accent", { p: [0.07, 0.64, z - 0.03] });
      A.ajouter(rev([[0.0, 0.0], [0.06, 0.02], [0.07, 0.035]], 14).rotateX(-PI / 2), "secondaire", { p: [-0.06, 0.24, z - 0.05] });
      break;
    case "ailes":
      A.ajouter(br(0.18, 0.2, 0.06, 0.02), "armure", { p: [0, 0.15, z] });
      for (const s of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const l = 0.42 - i * 0.09;
          A.ajouter(br(0.05, l, 0.018, 0.008), "armure", { p: [s * (0.14 + i * 0.07), 0.24 - i * 0.04, z - 0.05], r: [0.15, 0, s * (0.75 + i * 0.25)] });
          A.ajouter(br(0.012, l * 0.8, 0.02, 0.004), "accent", { p: [s * (0.14 + i * 0.07), 0.24 - i * 0.04, z - 0.062], r: [0.15, 0, s * (0.75 + i * 0.25)] });
        }
      }
      A.ajouter(sphere(0.035, 12, 8), "accent", { p: [0, 0.17, z - 0.035] });
      break;
    case "cape":
      A.ajouter(br(0.4 * k, 0.86, 0.02, 0.01), "secondaire", { p: [0, -0.17, z - 0.03], r: [0.11, 0, 0] });
      A.ajouter(br(0.44 * k, 0.06, 0.06, 0.02), "secondaire", { p: [0, 0.27, z + 0.03] });
      break;
    case "bouclier": {
      const hex = new THREE.CylinderGeometry(0.2, 0.2, 0.03, 6).rotateX(PI / 2).rotateZ(PI / 6);
      A.ajouter(hex, "armure", { p: [0, 0.12, z - 0.03] });
      A.ajouter(new THREE.TorusGeometry(0.19, 0.012, 6, 6).rotateZ(PI / 6), "secondaire", { p: [0, 0.12, z - 0.048] });
      A.ajouter(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 6).rotateX(PI / 2), "accent", { p: [0, 0.12, z - 0.05] });
      break;
    }
    case "generateur":
      A.ajouter(br(0.26, 0.26, 0.09, 0.03), "armure", { p: [0, 0.14, z] });
      A.ajouter(sphere(0.065, 16, 12), "accent", { p: [0, 0.15, z - 0.07] });
      A.ajouter(new THREE.TorusGeometry(0.08, 0.012, 8, 20), "metal", { p: [0, 0.15, z - 0.07] });
      A.ajouter(new THREE.TorusGeometry(0.08, 0.008, 8, 20).rotateY(PI / 2), "metal", { p: [0, 0.15, z - 0.07] });
      break;
    case "caisse":
      for (const s of [-1, 1]) A.ajouter(br(0.025, 0.5, 0.025, 0.006), "metal", { p: [s * 0.15, 0.12, z - 0.02] });
      A.ajouter(br(0.3, 0.22, 0.14, 0.02), "secondaire", { p: [0, 0.22, z - 0.09] });
      A.ajouter(br(0.26, 0.14, 0.12, 0.02), "armure", { p: [0, 0.02, z - 0.08] });
      A.ajouter(br(0.06, 0.06, 0.012, 0.005), "accent", { p: [0, 0.22, z - 0.165] });
      A.ajouter(br(0.32, 0.02, 0.02, 0.006), "metal", { p: [0, 0.34, z - 0.05] });
      break;
    case "enceintes":
      A.ajouter(br(0.3, 0.2, 0.06, 0.02), "poly", { p: [0, 0.15, z] });
      for (const s of [-1, 1]) {
        A.ajouter(br(0.13, 0.16, 0.08, 0.02), "poly", { p: [s * 0.1, 0.2, z - 0.05] });
        A.ajouter(rev([[0.0, 0.0], [0.045, 0.01], [0.052, 0.03]], 16).rotateX(-PI / 2), "secondaire", { p: [s * 0.1, 0.2, z - 0.09] });
        A.ajouter(new THREE.TorusGeometry(0.054, 0.006, 6, 18), "accent", { p: [s * 0.1, 0.2, z - 0.091] });
      }
      break;
    case "vrilles":
      A.ajouter(br(0.2, 0.06, 0.08, 0.02), "poly", { p: [0, 0.03, z - 0.02] });
      A.ajouter(new THREE.CylinderGeometry(0.075, 0.075, 0.24, 16), "visiere", { p: [0, 0.18, z - 0.05] });
      A.ajouter(sphere(0.05, 12, 8), "accent", { p: [0, 0.16, z - 0.05], s: [1, 1.6, 1] });
      A.ajouter(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16), "secondaire", { p: [0, 0.31, z - 0.05] });
      for (const s of [-1, 1]) {
        const v = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.3, z - 0.05), new THREE.Vector3(s * 0.1, 0.34, z), new THREE.Vector3(s * 0.2 * k, 0.28, 0.02), new THREE.Vector3(s * 0.23 * k, 0.12, 0.06)]);
        A.ajouter(new THREE.TubeGeometry(v, 10, 0.009, 6), "accent");
      }
      break;
    case "lames":
      for (const s of [-1, 1]) {
        A.ajouter(br(0.04, 0.5, 0.02, 0.008), "poly", { p: [0, 0.12, z - 0.02], r: [0, 0, s * 0.5] });
        A.ajouter(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 8), "metal", { p: [s * 0.13, 0.36, z - 0.02], r: [0, 0, s * 0.5] });
        A.ajouter(br(0.044, 0.012, 0.024, 0.004), "accent", { p: [s * 0.1, 0.31, z - 0.02], r: [0, 0, s * 0.5] });
      }
      break;
    case "drone":
      A.ajouter(br(0.2, 0.18, 0.06, 0.02), "poly", { p: [0, 0.14, z] });
      A.ajouter(br(0.16, 0.05, 0.16, 0.02), "armure", { p: [0, 0.16, z - 0.1], r: [PI / 2, 0, 0] });
      for (const [x, y] of [[-0.1, 0.06], [0.1, 0.06], [-0.1, 0.26], [0.1, 0.26]]) A.ajouter(new THREE.CylinderGeometry(0.05, 0.05, 0.006, 14).rotateX(PI / 2), "metal", { p: [x, y, z - 0.1] });
      A.ajouter(sphere(0.02, 10, 8), "accent", { p: [0, 0.16, z - 0.13] });
      break;
    case "carquois":
      A.ajouter(new THREE.CylinderGeometry(0.045, 0.04, 0.4, 12), "poly", { p: [0.08, 0.15, z - 0.03], r: [0, 0, -0.35] });
      for (let i = 0; i < 4; i++) A.ajouter(new THREE.ConeGeometry(0.012, 0.06, 6), "accent", { p: [0.15 + (i % 2) * 0.02, 0.37 + i * 0.008, z - 0.03 + (i - 1.5) * 0.015], r: [0, 0, -0.35] });
      break;
    case "bobines":
      A.ajouter(br(0.22, 0.22, 0.06, 0.02), "poly", { p: [0, 0.14, z] });
      for (const s of [-1, 1]) {
        A.ajouter(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 10), "metal", { p: [s * 0.075, 0.2, z - 0.06] });
        for (let i = 0; i < 4; i++) A.ajouter(new THREE.TorusGeometry(0.042, 0.01, 6, 16).rotateX(PI / 2), "accent", { p: [s * 0.075, 0.1 + i * 0.065, z - 0.06] });
        A.ajouter(sphere(0.03, 10, 8), "metal", { p: [s * 0.075, 0.37, z - 0.06] });
      }
      break;
    default:
      A.ajouter(br(0.22, 0.2, 0.08, 0.025), "poly", { p: [0, 0.15, z] });
  }
}

// ===== Tête : visage, coiffures, casques, masques =====
const CRANE = { p: [0, 0.095, -0.005], s: [0.96, 1.08, 1.06] };

// Coupe d'une sphère (portion avant ou arrière) : phi = 0 vers -X, PI/2 vers l'avant (+Z)
function calotte(r, thetaDebut, thetaLong, ouvertureAvant = 0, n = 22) {
  if (!ouvertureAvant) return sphere(r, n, 12, 0, PI * 2, thetaDebut, thetaLong);
  return sphere(r, n, 12, PI / 2 + ouvertureAvant / 2, PI * 2 - ouvertureAvant, thetaDebut, thetaLong);
}
function avant(r, largeur, thetaDebut, thetaLong, n = 18) {
  return sphere(r, n, 8, PI / 2 - largeur / 2, largeur, thetaDebut, thetaLong);
}

function visage(A, a) {
  const fin = a.corps === "fin" ? 0.94 : a.corps === "massif" ? 1.05 : 1;
  A.ajouter(sphere(0.1, 24, 18), "peau", { p: CRANE.p, s: [CRANE.s[0] * fin, CRANE.s[1], CRANE.s[2]] });
  A.ajouter(sphere(0.085, 20, 14), "peau", { p: [0, 0.035, 0.022], s: [0.92 * fin, 1, 0.95] });     // mâchoire
  A.ajouter(br(0.11 * fin, 0.016, 0.03, 0.007), "peau", { p: [0, 0.109, 0.086] });                          // arcade
  A.ajouter(br(0.022, 0.044, 0.03, 0.009), "peau", { p: [0, 0.064, 0.103], r: [-0.18, 0, 0] });             // nez
  A.ajouter(sphere(0.0135, 10, 8), "peau", { p: [0, 0.047, 0.113] });
  for (const s of [-1, 1]) {
    A.ajouter(sphere(0.0145, 12, 8), "blanc", { p: [s * 0.034, 0.088, 0.088], s: [1.1, 0.72, 0.6] });
    A.ajouter(sphere(0.0085, 10, 8), a.yeuxLumineux ? "irisLumineux" : "iris", { p: [s * 0.034, 0.088, 0.0955], s: [1, 1, 0.5] });
    A.ajouter(br(0.032, 0.0075, 0.012, 0.003), "cheveux", { p: [s * 0.035, 0.113, 0.1], r: [0, 0, -s * 0.1] }); // sourcils
    A.ajouter(sphere(0.024, 10, 8), "peau", { p: [s * 0.094 * fin, 0.08, 0.0], s: [0.45, 1, 0.75] }); // oreilles
  }
  A.ajouter(br(0.034, 0.0055, 0.01, 0.0025), "cuir", { p: [0, 0.02, 0.1] });                               // bouche
  if (a.cicatrice) A.ajouter(br(0.005, 0.06, 0.004, 0.002), "cuir", { p: [-0.05, 0.085, 0.098], r: [0, 0, 0.3] });
}

function coiffure(A, a) {
  const c = a.coiffure;
  if (!c) return;
  const cap = (r = 0.106, inclinaison = -0.32) => A.ajouter(calotte(r, 0, PI * 0.5), "cheveux", { p: [0, 0.1, -0.008], s: [0.97, 1.02, 1.06], r: [inclinaison, 0, 0] });
  switch (c) {
    case "courte":
      cap();
      for (const s of [-1, 1]) A.ajouter(br(0.012, 0.04, 0.025, 0.005), "cheveux", { p: [s * 0.093, 0.1, 0.02] });
      break;
    case "rasee":
      A.ajouter(calotte(0.1025, 0, PI * 0.47), "cheveux", { p: [0, 0.1, -0.008], s: [0.97, 1.03, 1.06], r: [-0.3, 0, 0] });
      break;
    case "meche":
      cap();
      A.ajouter(br(0.13, 0.03, 0.07, 0.014), "cheveux", { p: [0.015, 0.175, 0.06], r: [0.45, 0, -0.22] });
      A.ajouter(br(0.05, 0.08, 0.03, 0.012), "cheveux", { p: [0.075, 0.13, 0.08], r: [0.2, 0, -0.35] });
      break;
    case "crete":
      A.ajouter(calotte(0.1025, 0, PI * 0.47), "cheveux", { p: [0, 0.1, -0.008], s: [0.97, 1.03, 1.06], r: [-0.3, 0, 0] });
      for (let i = 0; i < 7; i++) {
        const t = -0.55 + i * 0.36, h = 0.075 - Math.abs(i - 2) * 0.007;
        A.ajouter(br(0.026, h, 0.05, 0.01), "cheveux", { p: [0, 0.095 + 0.112 * Math.cos(t), -0.005 + 0.115 * Math.sin(t)], r: [t, 0, 0] });
      }
      break;
    case "pics":
      cap(0.108);
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * PI * 2, inc = 0.5 + (i % 2) * 0.35;
        const dx = Math.sin(ang) * Math.sin(inc), dz = Math.cos(ang) * Math.sin(inc) - 0.35, dy = Math.cos(inc);
        const n = new THREE.Vector3(dx, dy, dz).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
        const e = new THREE.Euler().setFromQuaternion(q);
        A.ajouter(new THREE.ConeGeometry(0.024, 0.085, 6), "cheveux", { p: [n.x * 0.1, 0.11 + n.y * 0.1, -0.01 + n.z * 0.1], r: [e.x, e.y, e.z] });
      }
      break;
    case "queue":
      cap();
      A.ajouter(sphere(0.036, 12, 10), "cheveux", { p: [0, 0.18, -0.085] });
      A.ajouter(new THREE.CapsuleGeometry(0.027, 0.2, 4, 10), "cheveux", { p: [0, 0.07, -0.135], r: [0.4, 0, 0] });
      A.ajouter(new THREE.TorusGeometry(0.03, 0.007, 6, 14).rotateX(PI / 2), "secondaire", { p: [0, 0.165, -0.1], r: [0.5, 0, 0] });
      break;
    case "longue":
      cap(0.108, -0.25);
      A.ajouter(br(0.2, 0.32, 0.05, 0.022), "cheveux", { p: [0, -0.01, -0.082], r: [0.12, 0, 0] });
      for (const s of [-1, 1]) A.ajouter(br(0.035, 0.24, 0.06, 0.014), "cheveux", { p: [s * 0.093, 0.03, 0.02], r: [0, 0, s * 0.05] });
      break;
    case "chignon":
      cap(0.106, -0.4);
      A.ajouter(sphere(0.047, 14, 10), "cheveux", { p: [0, 0.19, -0.075] });
      for (const s of [-1, 1]) A.ajouter(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 6), "secondaire", { p: [s * 0.02, 0.2, -0.075], r: [0, 0, s * 1.1] });
      break;
    case "tresses":
      cap(0.106, -0.35);
      for (const s of [-1, 1]) {
        for (let i = 0; i < 6; i++) A.ajouter(sphere(0.022, 10, 8), "cheveux", { p: [s * 0.045, 0.07 - i * 0.05, -0.1 - i * 0.01], s: [1, 1.25, 1] });
        A.ajouter(new THREE.CylinderGeometry(0.018, 0.018, 0.025, 10), "secondaire", { p: [s * 0.045, -0.24, -0.16] });
      }
      break;
    case "carre":
      A.ajouter(calotte(0.116, 0, PI * 0.64, 1.9), "cheveux", { p: [0, 0.09, -0.008], s: [1, 1.04, 1.06], r: [-0.12, 0, 0] });
      A.ajouter(calotte(0.112, 0, PI * 0.3), "cheveux", { p: [0, 0.095, -0.004], s: [0.98, 1.05, 1.07], r: [-0.1, 0, 0] });
      A.ajouter(br(0.15, 0.035, 0.045, 0.014), "cheveux", { p: [0, 0.158, 0.085], r: [0.35, 0, 0] });
      break;
    case "boucles":
      cap(0.11);
      for (let i = 0; i < 18; i++) {
        const ang = i * 2.4, inc = 0.25 + (i / 18) * 1.25;
        const x = Math.sin(ang) * Math.sin(inc), y = Math.cos(inc), z = Math.cos(ang) * Math.sin(inc) - 0.25;
        A.ajouter(new THREE.IcosahedronGeometry(0.045, 0), "cheveux", { p: [x * 0.112, 0.105 + y * 0.11, -0.012 + z * 0.112] });
      }
      break;
  }
}

function barbe(A, a) {
  if (!a.barbe) return;
  if (a.barbe === "courte" || a.barbe === "pleine") {
    const r = a.barbe === "pleine" ? 0.093 : 0.0885;
    A.ajouter(avant(r, 2.6, PI * (a.barbe === "pleine" ? 0.56 : 0.6), PI * 0.38), "cheveux", { p: [0, 0.035, 0.022], s: [0.92, 1, 0.95] });
  }
  A.ajouter(br(0.042, 0.009, 0.012, 0.004), "cheveux", { p: [0, 0.031, 0.102] });
  if (a.barbe === "bouc") A.ajouter(br(0.03, 0.035, 0.03, 0.01), "cheveux", { p: [0, -0.02, 0.085] });
}

function lunettes(A, a) {
  if (a.lunettes === "visiere") {
    A.ajouter(sphere(0.111, 24, 4, PI / 2 - 1.05, 2.1, PI * 0.45, PI * 0.075), "accent", { p: CRANE.p, s: CRANE.s });
  } else if (a.lunettes === "lunettes") {
    for (const s of [-1, 1]) {
      A.ajouter(br(0.036, 0.024, 0.008, 0.007), "visiere", { p: [s * 0.035, 0.088, 0.106] });
      A.ajouter(br(0.006, 0.006, 0.09, 0.002), "metal", { p: [s * 0.09, 0.092, 0.06] });
    }
    A.ajouter(br(0.02, 0.005, 0.006, 0.002), "metal", { p: [0, 0.094, 0.108] });
  } else if (a.lunettes === "monocle") {
    A.ajouter(new THREE.TorusGeometry(0.017, 0.004, 6, 16), "metal", { p: [0.034, 0.088, 0.106] });
    A.ajouter(new THREE.CylinderGeometry(0.015, 0.015, 0.004, 14).rotateX(PI / 2), "lentille", { p: [0.034, 0.088, 0.106] });
    A.ajouter(br(0.006, 0.008, 0.09, 0.002), "metal", { p: [0.075, 0.09, 0.06], r: [0, 0.35, 0] });
    A.ajouter(br(0.02, 0.03, 0.03, 0.006), "metal", { p: [0.097, 0.088, 0.02] });
  }
}

function masque(A, a) {
  if (a.masque === "foulard") {
    A.ajouter(avant(0.095, 3.0, PI * 0.47, PI * 0.42), "secondaire", { p: [0, 0.035, 0.022], s: [0.94, 1.02, 0.98] });
    A.ajouter(new THREE.CylinderGeometry(0.068, 0.075, 0.09, 16), "secondaire", { p: [0, -0.04, 0] });
    A.ajouter(br(0.04, 0.12, 0.02, 0.008), "secondaire", { p: [0.02, -0.06, -0.08], r: [0.3, 0, 0.2] });
  } else if (a.masque === "demi") {
    A.ajouter(avant(0.093, 2.5, PI * 0.45, PI * 0.42), "poly", { p: [0, 0.035, 0.022], s: [0.94, 1.02, 0.98] });
    for (const x of [-0.016, 0, 0.016]) A.ajouter(br(0.004, 0.03, 0.004, 0.0015), "accent", { p: [x, 0.012, 0.112] });
    A.ajouter(new THREE.CylinderGeometry(0.062, 0.068, 0.08, 14), "poly", { p: [0, -0.04, 0] });
  } else if (a.masque === "respirateur") {
    A.ajouter(avant(0.094, 2.3, PI * 0.46, PI * 0.4), "poly", { p: [0, 0.035, 0.022], s: [0.94, 1.02, 0.98] });
    for (const s of [-1, 1]) {
      A.ajouter(new THREE.CylinderGeometry(0.026, 0.026, 0.04, 14), "metal", { p: [s * 0.055, 0.0, 0.1], r: [PI / 2 - 0.4, 0, s * 0.6] });
      A.ajouter(new THREE.CylinderGeometry(0.02, 0.02, 0.005, 14), "accent", { p: [s * 0.067, -0.008, 0.118], r: [PI / 2 - 0.4, 0, s * 0.6] });
    }
    A.ajouter(br(0.04, 0.03, 0.02, 0.008), "secondaire", { p: [0, 0.015, 0.112] });
    for (const s of [-1, 1]) A.ajouter(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 14).rotateX(PI / 2), "visiere", { p: [s * 0.034, 0.09, 0.103] });
  }
}

function accessoire(A, a) {
  switch (a.accessoire) {
    case "oreillette":
      A.ajouter(br(0.022, 0.035, 0.03, 0.008), "metal", { p: [0.1, 0.075, 0.01] });
      A.ajouter(new THREE.CylinderGeometry(0.003, 0.003, 0.09, 6), "poly", { p: [0.085, 0.045, 0.06], r: [1.1, 0, 0.35] });
      A.ajouter(sphere(0.007, 8, 6), "accent", { p: [0.068, 0.025, 0.1] });
      break;
    case "bandeau":
      A.ajouter(new THREE.TorusGeometry(0.104, 0.009, 6, 26).rotateX(PI / 2), "secondaire", { p: [0, 0.14, -0.004], s: [0.98, 1, 1.07], r: [-0.18, 0, 0] });
      for (const s of [-1, 1]) A.ajouter(br(0.02, 0.17, 0.004, 0.002), "secondaire", { p: [s * 0.025, 0.07, -0.13], r: [0.35, 0, s * 0.25] });
      break;
    case "diademe":
      A.ajouter(new THREE.TorusGeometry(0.104, 0.0045, 6, 26).rotateX(PI / 2), "secondaire", { p: [0, 0.145, -0.004], s: [0.98, 1, 1.07], r: [-0.25, 0, 0] });
      A.ajouter(new THREE.OctahedronGeometry(0.014, 0), "accent", { p: [0, 0.16, 0.106], s: [0.8, 1.2, 0.5] });
      break;
    case "casqueAudio":
      A.ajouter(new THREE.TorusGeometry(0.118, 0.011, 8, 24, PI), "poly", { p: [0, 0.095, -0.01] });
      for (const s of [-1, 1]) {
        A.ajouter(new THREE.CylinderGeometry(0.047, 0.047, 0.035, 18).rotateZ(PI / 2), "poly", { p: [s * 0.108, 0.075, 0] });
        A.ajouter(new THREE.TorusGeometry(0.035, 0.006, 6, 18).rotateY(PI / 2), "accent", { p: [s * 0.127, 0.075, 0] });
      }
      break;
    case "halo":
      A.ajouter(new THREE.TorusGeometry(0.125, 0.009, 8, 36).rotateX(PI / 2), "accent", { p: [0, 0.3, -0.05], r: [-0.3, 0, 0] });
      break;
    case "couronne":
      for (let i = 0; i < 5; i++) {
        const ang = -1.2 + i * 0.6;
        A.ajouter(new THREE.OctahedronGeometry(0.02, 0), "accent", { p: [Math.sin(ang) * 0.13, 0.25 + (i % 2) * 0.03, Math.cos(ang) * 0.13 - 0.02], s: [0.6, 1.8, 0.6] });
      }
      A.ajouter(br(0.004, 0.06, 0.004, 0.0015), "accent", { p: [0.05, 0.16, 0.085], r: [0, 0, 0.5] });
      break;
    case "fleurs":
      for (let i = 0; i < 4; i++) {
        const cx = -0.085 + (i % 2) * 0.015, cy = 0.13 + i * 0.025, cz = 0.04 - i * 0.03;
        for (let p = 0; p < 5; p++) {
          const ang = (p / 5) * PI * 2;
          A.ajouter(sphere(0.011, 6, 5), "secondaire", { p: [cx - 0.01, cy + Math.cos(ang) * 0.015, cz + Math.sin(ang) * 0.015] });
        }
        A.ajouter(sphere(0.008, 6, 5), "accent", { p: [cx - 0.016, cy, cz] });
      }
      break;
  }
}

function piecesTete(A, a) {
  const t = a.tete;
  if (t === "casque") {
    A.ajouter(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 14), "tissu", { p: [0, -0.04, 0] });
    A.ajouter(br(0.25, 0.26, 0.26, 0.09), "armure", { p: [0, 0.085, 0] });
    A.ajouter(br(0.19, 0.035, 0.03, 0.01), "lentille", { p: [0, 0.1, 0.123] });
    A.ajouter(br(0.21, 0.06, 0.04, 0.015), "poly", { p: [0, 0.02, 0.115] });
    for (const s of [-1, 1]) A.ajouter(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 14).rotateZ(PI / 2), "poly", { p: [s * 0.128, 0.07, 0] });
    A.ajouter(br(0.035, 0.03, 0.22, 0.01), "secondaire", { p: [0, 0.218, -0.01] });
    A.ajouter(br(0.12, 0.012, 0.012, 0.004), "equipe", { p: [0, 0.165, 0.126] });
    return;
  }
  // Cou
  A.ajouter(new THREE.CylinderGeometry(0.048, 0.056, 0.12, 14), "peau", { p: [0, -0.03, 0] });
  visage(A, a);
  if (t === "casqueVisiere") {
    A.ajouter(calotte(0.128, 0, PI * 0.56), "armure", { p: [0, 0.1, -0.005], s: [1.06, 1.02, 1.12] });
    A.ajouter(rev([[0.128, 0], [0.133, -0.01], [0.128, -0.02]], 22), "poly", { p: [0, 0.095, -0.005], s: [1.06, 1, 1.12] });
    A.ajouter(sphere(0.133, 22, 6, PI / 2 - 0.95, 1.9, PI * 0.38, PI * 0.16), "visiere", { p: [0, 0.098, 0.004] });
    for (const s of [-1, 1]) A.ajouter(new THREE.CylinderGeometry(0.042, 0.042, 0.035, 16).rotateZ(PI / 2), "poly", { p: [s * 0.125, 0.065, 0] });
    A.ajouter(br(0.1, 0.012, 0.012, 0.004), "equipe", { p: [0, 0.2, 0.09], r: [-0.6, 0, 0] });
  } else if (t === "capuche") {
    A.ajouter(calotte(0.138, 0, PI * 0.33), "secondaire", { p: [0, 0.092, -0.012], s: [1.0, 1.1, 1.1] });
    A.ajouter(calotte(0.138, PI * 0.33, PI * 0.42, 1.5), "secondaire", { p: [0, 0.092, -0.012], s: [1.0, 1.1, 1.1] });
    A.ajouter(br(0.24, 0.12, 0.08, 0.03), "secondaire", { p: [0, -0.06, -0.06] });
  } else {
    coiffure(A, a);
  }
  barbe(A, a);
  masque(A, a);
  lunettes(A, a);
  accessoire(A, a);
}

// ===== Bras =====
function piecesBras(A, a, cote) {
  const { m } = morpho(a);
  A.ajouter(membreD(0.072 * m, 0.06 * m, BRAS), manches(a));
  const lourdes = a.epaules === "lourdes" || (a.epaules === "asym" && cote < 0);
  if (lourdes) {
    A.ajouter(sphere(0.105 * m, 16, 10, 0, PI * 2, 0, PI * 0.5), "armure", { p: [cote * 0.012, 0.0, 0], s: [1.08, 1.2, 1.12] });
    A.ajouter(sphere(0.1 * m, 16, 6, 0, PI * 2, PI * 0.42, PI * 0.1), "secondaire", { p: [cote * 0.012, 0.0, 0], s: [1.1, 1.2, 1.14] });
    if (a.epaules === "asym") A.ajouter(br(0.06, 0.12, 0.16, 0.02), "armure", { p: [cote * 0.08, -0.05, 0], r: [0, 0, cote * 0.35] });
  } else if (a.epaules === "legeres" || a.epaules === "asym") {
    A.ajouter(sphere(0.075 * m, 14, 8, 0, PI * 2, 0, PI * 0.5), "armure", { p: [cote * 0.008, -0.01, 0], s: [1, 1.3, 1.1] });
  }
  A.ajouter(rev([[0.066 * m, -0.12], [0.07 * m, -0.125], [0.07 * m, -0.145], [0.066 * m, -0.15]], 14), "equipe"); // brassard d'équipe
}

function piecesAvantBras(A, a, cote) {
  const { m } = morpho(a);
  A.ajouter(membreD(0.062 * m, 0.048 * m, 0.26), manches(a));
  A.ajouter(rev([[0.052 * m, -0.17], [0.056 * m, -0.19], [0.056 * m, -0.24], [0.048 * m, -0.255]], 14), "poly");
  if (a.buste === "plastron" || a.buste === "armureLourde" || a.buste === "harnais") A.ajouter(br(0.07 * m, 0.12, 0.06, 0.02), "armure", { p: [0, -0.1, 0.02] });
  if (a.buste === "combinaison") A.ajouter(rev([[0.054 * m, -0.2], [0.057 * m, -0.205], [0.057 * m, -0.215], [0.054 * m, -0.22]], 14), "accent");
}

function piecesMain(A, cote) {
  A.ajouter(br(0.075, 0.085, 0.032, 0.012), "poly", { p: [0, -0.04, 0] });
  A.ajouter(br(0.072, 0.045, 0.05, 0.016), "poly", { p: [0, -0.085, 0.018] });
  A.ajouter(new THREE.CapsuleGeometry(0.011, 0.03, 3, 8), "poly", { p: [-cote * 0.04, -0.035, 0.028], r: [0.9, 0, -cote * 0.4] });
}

// ----- Le personnage -----
const _cible = new THREE.Vector3(), _pole = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Quaternion();
const POINT_POCHE = new THREE.Vector3(-0.14, -0.32, 0.12);
const HANCHE_GAUCHE = new THREE.Vector3(-0.2, -0.36, 0.06);

export class Personnage {
  // heros : identifiant (heros.js) ; teinte : "bleu", "rouge" (bandes d'équipe), "neutre", "vitrine" ou "mannequin"
  constructor(heros, teinte, qualite, armeId = "fusil") {
    const h = HEROS[heros];
    const a = h ? h.apparence : APPARENCE_MANNEQUIN;
    this.heros = h ? heros : "mannequin";
    this.teinte = teinte;
    this.armeId = armeId;
    this.apparence = a;
    const mats = materiauxHeros(qualite, this.heros, a, teinte);
    this.mats = mats;
    const simple = qualite === "basse";
    // Les pièces de l'arme reprennent les matériaux du corps (moins de matériaux = moins d'appels de rendu).
    const correspondance = { carcasse: "metal", carcasseClaire: "metal", acierSombre: "metal", acier: "metal", polymere: "poly", caoutchouc: "semelle", laiton: "metal", cartouche: "accent", lame: "metal", verre: "poly", lentille: "lentille", coque: "coque", coqueGrise: "metal", plaque: "secondaire", lumiere: "accent", cable: "cuir" };

    this.racine = new THREE.Group();
    this.echelle = a.taille || 1;
    const os = [];
    const pieces = [];
    const cleCache = this.heros + "|" + armeId + (simple ? "|" + teinte : "");
    const enCache = cacheGeometries.get(cleCache);
    DETAIL = simple ? 0.6 : 1;
    const nouvelOs = (parent) => { const b = new THREE.Bone(); os.push(b); if (parent) parent.add(b); return b; };
    const habiller = (b, fn, ...args) => { if (enCache) return; const A = new Assemblage(); fn(A, ...args); pieces.push({ os: b, pieces: A.extraire() }); };

    this.corps = nouvelOs(null);
    this.corps.scale.setScalar(this.echelle);
    this.racine.add(this.corps);

    this.jambes = [-1, 1].map((cote) => {
      const hanche = nouvelOs(this.corps);
      const genou = nouvelOs(hanche);
      const pied = nouvelOs(genou);
      hanche.position.set(cote * 0.1, 0.915, 0);
      genou.position.y = -CUISSE;
      pied.position.y = -TIBIA;
      habiller(hanche, piecesJambe, a, cote);
      habiller(genou, piecesTibia, a);
      habiller(pied, piecesPied, a);
      return { cote, hanche, genou, pied, cible: new THREE.Vector3(cote * 0.11, CHEVILLE, 0) };
    });

    this.bassin = nouvelOs(this.corps);
    this.bassin.position.y = 0.955;
    habiller(this.bassin, piecesBassin, a);
    this.colonne = nouvelOs(this.bassin);
    this.colonne.position.y = 0.08;
    habiller(this.colonne, piecesColonne, a);
    this.poitrine = nouvelOs(this.colonne);
    this.poitrine.position.y = 0.18;
    habiller(this.poitrine, piecesPoitrine, a);
    this.tete = nouvelOs(this.poitrine);
    this.tete.position.set(0, 0.385, 0.015);
    habiller(this.tete, piecesTete, a);

    const largeur = 0.22 * morpho(a).k;
    this.bras = [-1, 1].map((cote) => {
      const epaule = nouvelOs(this.poitrine);
      const coude = nouvelOs(epaule);
      const main = nouvelOs(coude);
      epaule.position.set(cote * largeur, 0.26, 0);
      coude.position.y = -BRAS;
      main.position.y = -0.26;
      habiller(epaule, piecesBras, a, cote);
      habiller(coude, piecesAvantBras, a, cote);
      habiller(main, piecesMain, cote);
      return { cote, epaule, coude, main };
    });

    // Arme : un os attaché à la poitrine, le chargeur a son propre os (il sort au rechargement)
    this.fusil = nouvelOs(this.poitrine);
    this.fusil.rotation.order = "YXZ";
    this.chargeur = nouvelOs(this.fusil);
    let points;
    if (enCache) points = enCache.points;
    else {
      const arme = piecesArme(armeId, false);
      points = arme.points;
      const fixes = arme.A.extraire();
      for (const mob of Object.values(arme.mob)) for (const [k, g] of mob.extraire()) fixes.has(k) ? fixes.get(k).push(...g) : fixes.set(k, [...g]);
      pieces.push({ os: this.fusil, pieces: fixes });
      pieces.push({ os: this.chargeur, pieces: arme.C.extraire() });
    }
    this.points = points;
    this.chargeurRepos = new THREE.Vector3();

    // Fusion en maillages à squelette (pose de repos = pose de liaison)
    this.racine.updateMatrixWorld(true);
    let geometries = enCache ? enCache.geometries : null;
    if (!geometries) {
      const parMateriau = new Map();
      const couleur = new THREE.Color();
      for (const { os: b, pieces: p } of pieces) {
        const indice = os.indexOf(b);
        for (const [cle, geos] of p) {
          const cleMat = correspondance[cle] || cle;
          const cleFinale = simple ? (LUEURS.has(cleMat) ? "lueur" : "base") : cleMat;
          if (simple) {
            const mat = mats[cleMat];
            couleur.copy(mat ? mat.color : couleur.setHex(0x888888));
            if (mat && mat.emissive && LUEURS.has(cleMat)) couleur.copy(mat.emissive).multiplyScalar(cleMat === "visiere" ? 0.3 : 1);
          }
          for (const g of geos) {
            g.applyMatrix4(b.matrixWorld);
            const n = g.attributes.position.count;
            g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(new Uint16Array(n * 4).map((v, i) => (i % 4 === 0 ? indice : 0)), 4));
            g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((v, i) => (i % 4 === 0 ? 1 : 0)), 4));
            if (simple) {
              const col = new Float32Array(n * 3);
              for (let i = 0; i < n; i++) { col[i * 3] = couleur.r; col[i * 3 + 1] = couleur.g; col[i * 3 + 2] = couleur.b; }
              g.setAttribute("color", new THREE.BufferAttribute(col, 3));
            }
            if (!parMateriau.has(cleFinale)) parMateriau.set(cleFinale, []);
            parMateriau.get(cleFinale).push(g);
          }
        }
      }
      geometries = new Map();
      for (const [cle, geos] of parMateriau) {
        geometries.set(cle, mergeGeometries(geos, false));
        for (const g of geos) g.dispose();
      }
      cacheGeometries.set(cleCache, { geometries, points });
    }
    this.squelette = new THREE.Skeleton(os);
    this.maillages = [];
    for (const [cle, geo] of geometries) {
      const m = new THREE.SkinnedMesh(geo, mats[cle]);
      m.castShadow = Personnage.ombresPortees;
      m.receiveShadow = !simple;
      m.frustumCulled = false;
      m.userData.materiau = mats[cle];
      this.racine.add(m);
      m.bind(this.squelette);
      this.maillages.push(m);
    }
    this.ombre = new THREE.Mesh(geoOmbre, materiauOmbre());
    this.ombre.position.y = 0.02;
    this.ombre.renderOrder = -1;
    this.ombre.visible = !Personnage.ombresPortees;
    this.racine.add(this.ombre);

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
    this.camoK = 0;
    this.poseK = 0;
    this.horloge = Math.random() * 10;
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

  // Remet le personnage debout (nouvelle manche, réapparition)
  ressusciter() {
    this.mortT = -1;
    this.corps.rotation.set(0, 0, 0);
    this.corps.position.set(0, 0, 0);
    this.fusil.scale.setScalar(1);
    this.racine.visible = true;
    this.racine.position.y = 0;
    this.ombre.visible = !Personnage.ombresPortees;
    this.camoufler(false);
  }

  // Camouflage optique : le personnage devient un reflet presque invisible
  camoufler(actif) {
    if (this.camoK === (actif ? 1 : 0)) return;
    this.camoK = actif ? 1 : 0;
    for (const m of this.maillages) m.material = actif ? materiauCamo() : m.userData.materiau;
    this.ombre.visible = !actif && !Personnage.ombresPortees;
    for (const m of this.maillages) m.castShadow = !actif && Personnage.ombresPortees;
  }

  // e : { dt, vitesse, dirX, dirZ (direction du mouvement dans le repère du personnage), vise (bool), tangage, recharge (-1 ou 0..1),
  //       pose (vitrine : "garde", "pret", "epaule", "inspection", "decontracte") }
  maj(e) {
    const dt = Math.max(0, Math.min(e.dt, 0.1));
    const lisse = (k) => 1 - Math.exp(-k * dt);
    const mort = this.mortT >= 0;
    if (mort) this.mortT += dt;
    this.horloge += dt;

    const v = mort ? 0 : e.vitesse;
    this.marcheK += (Math.min(v / 1.2, 1) - this.marcheK) * lisse(8);
    this.courseK += (Math.min(Math.max((v - 3) / 2, 0), 1) - this.courseK) * lisse(5);
    this.viseK += ((e.vise && !mort ? 1 : 0) - this.viseK) * lisse(7);
    this.respire += dt * 1.7;
    const pose = !mort && v < 0.3 ? e.pose || null : null;
    this.poseK += ((pose ? 1 : 0) - this.poseK) * lisse(4);

    // --- Jambes : phase de pas proportionnelle à la distance parcourue (pas de glissement) ---
    const demiFoulee = 0.2 + 0.26 * Math.min(v / 5.2, 1);
    if (v > 0.05) this.phase = (this.phase + (v * dt) / (4 * demiFoulee)) % 1;
    const w = this.marcheK;
    const rebond = 0.028 * w * (0.5 + 0.5 * Math.cos(this.phase * Math.PI * 4));
    let hancheY = 0.915 - rebond - this.courseK * 0.03;
    // Vitrine : appui alterné d'une jambe sur l'autre
    const appui = pose ? Math.sin(this.horloge * 0.7) * 0.025 * this.poseK : 0;
    if (mort) {
      const t = this.mortT;
      const plie = Math.min(1, t / 0.22) * (1 - Math.min(1, Math.max(0, (t - 0.2) / 0.4)));
      hancheY = 0.9 - plie * 0.25;
    }

    for (const j of this.jambes) {
      j.hanche.position.set(j.cote * 0.1 + appui, hancheY - Math.abs(appui) * 0.3, 0);
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
        const ecart = pose ? 0.045 * this.poseK : 0;
        j.cible.set(j.cote * (0.11 + ecart) + e.dirX * avance * w, CHEVILLE + leve * w, e.dirZ * avance * w + (pose && j.cote < 0 ? 0.06 * this.poseK : 0));
      }
      _pole.set(j.cote * 0.12, hancheY - 0.4, 1.2);
      ik2(j.hanche, j.genou, CUISSE, TIBIA, _cible.copy(j.cible).setY(Math.min(j.cible.y, hancheY - 0.05)), _pole);
      _q.copy(j.hanche.quaternion).multiply(j.genou.quaternion).invert();
      j.pied.quaternion.copy(_q);
    }

    // --- Buste ---
    const balance = Math.sin(this.phase * Math.PI * 2) * w;
    const ix = this.ressortImpactX.maj(dt), iy = this.ressortImpactY.maj(dt), rt = this.ressortTir.maj(dt);
    this.bassin.position.set(appui * 0.6, hancheY + 0.04, 0);
    this.bassin.rotation.set(0, balance * 0.09, -appui * 1.2);
    this.colonne.rotation.set(0.05 + this.courseK * 0.14 + ix * 0.05, -balance * 0.13 + iy * 0.05, appui * 1.4);
    const tangage = (e.tangage || 0) * this.viseK;
    this.poitrine.rotation.set(-tangage * 0.55 - rt * 0.012, -balance * 0.06, 0);
    this.poitrine.scale.setScalar(1 + Math.sin(this.respire) * 0.006);
    this.tete.rotation.set(-tangage * 0.45, balance * 0.05, 0);

    // --- Fusil : prêt (canon vers le bas) ou épaulé ---
    const k = this.viseK;
    this.fusil.position.set(0.085 * (1 - k) + 0.06 * k, 0.07 * (1 - k) + 0.22 * k, 0.3 + 0.05 * k - rt * 0.02);
    this.fusil.rotation.set(-0.55 * (1 - k) - this.courseK * 0.2 * (1 - k), Math.PI - 0.08 * (1 - k), 0.25 * (1 - k));
    let mainGaucheLibre = 0;
    if (pose && this.poseK > 0.01) mainGaucheLibre = this.animerPose(pose, this.poseK);

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
      if (mainGaucheLibre > 0) _cible.lerp(HANCHE_GAUCHE, mainGaucheLibre);
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

  // Attitudes de repos propres à chaque personnage (menu de sélection). Retourne la part de main gauche libre.
  animerPose(pose, k) {
    const t = this.horloge;
    const f = this.fusil, tete = this.tete;
    const mix = (a, b) => a + (b - a) * k;
    let libre = 0;
    if (pose === "garde") {
      // Arme basse, regarde autour de lui
      tete.rotation.y += Math.sin(t * 0.45) * 0.45 * k;
      tete.rotation.x += Math.sin(t * 0.3) * 0.05 * k;
    } else if (pose === "pret") {
      // Arme à mi-hauteur, prête à épauler, petits ajustements
      f.position.y = mix(f.position.y, 0.15);
      f.rotation.x = mix(f.rotation.x, -0.25 + Math.sin(t * 1.1) * 0.03);
      f.rotation.z = mix(f.rotation.z, 0.12);
      tete.rotation.y += Math.sin(t * 0.8) * 0.12 * k;
      this.poitrine.rotation.y += Math.sin(t * 0.8) * 0.06 * k;
    } else if (pose === "epaule") {
      // Arme posée sur l'épaule droite, main gauche sur la hanche
      f.position.set(mix(f.position.x, 0.2), mix(f.position.y, 0.32), mix(f.position.z, 0.02));
      f.rotation.set(mix(f.rotation.x, 1.15 + Math.sin(t * 0.6) * 0.03), mix(f.rotation.y, Math.PI + 0.15), mix(f.rotation.z, -0.2));
      tete.rotation.y += (-0.2 + Math.sin(t * 0.35) * 0.3) * k;
      libre = k;
    } else if (pose === "inspection") {
      // Fait tourner l'arme pour l'examiner, regard sur l'arme
      const c = (Math.sin(t * 0.55) + 1) / 2;
      f.position.set(mix(f.position.x, 0.03), mix(f.position.y, 0.12), mix(f.position.z, 0.36));
      f.rotation.set(mix(f.rotation.x, -0.15), mix(f.rotation.y, Math.PI - 0.5 * c), mix(f.rotation.z, 0.9 * c));
      tete.rotation.x += 0.3 * k;
      tete.rotation.y += -0.15 * c * k;
    } else if (pose === "decontracte") {
      // Arme tenue d'une main, canon vers le sol, main gauche sur la hanche
      f.position.set(mix(f.position.x, 0.17), mix(f.position.y, -0.05), mix(f.position.z, 0.2));
      f.rotation.set(mix(f.rotation.x, -0.85), mix(f.rotation.y, Math.PI - 0.35), mix(f.rotation.z, 0.35));
      tete.rotation.y += Math.sin(t * 0.5) * 0.3 * k;
      tete.rotation.z += Math.sin(t * 0.25) * 0.06 * k;
      libre = k;
    }
    return libre;
  }
}

// Qualité élevée : vraies ombres portées (sinon une ombre ronde, bien moins coûteuse)
Personnage.ombresPortees = false;
