// Définitions des cartes. Convention commune : les attaquants partent en Z positif (sud),
// les défenseurs en Z négatif (nord), les deux sites (A à l'est, B à l'ouest) sont côté défense.
import * as THREE from "three";
import { boiteRonde, revolution } from "./formes.js";
import { textureBache } from "./textures.js";

// ======================= NEXUS (port logistique) =======================
const nexus = {
  id: "nexus",
  echelle: 1.15, // carte élargie de 15 % (positions et largeurs ; les hauteurs ne changent pas)
  nom: "Nexus",
  description: "Port logistique : conteneurs, longs murs de béton, trois couloirs.",
  limites: { minX: -32, maxX: 32, minZ: -22, maxZ: 22 },
  sol: "beton",
  heure: "jour",
  ville: true,
  barriere: 12.6,
  departAttaque: { minX: -4, maxX: 4, minZ: 18, maxZ: 20.5 },
  departDefense: { minX: -11, maxX: 11, minZ: -21, maxZ: -14 },
  sites: {
    A: { minX: 15, maxX: 29, minZ: -10, maxZ: 6, x: 22, z: -1 },
    B: { minX: -29, maxX: -15, minZ: -10, maxZ: 6, x: -22, z: -1 },
  },
  postes: [
    { x: 16.5, z: -2.5, vise: { x: 20, z: 11 }, zone: "A" },
    { x: 27.8, z: 1.8, vise: { x: 20, z: 11 }, zone: "A" },
    { x: 23.5, z: -9.5, vise: { x: 12, z: 0 }, zone: "A" },
    { x: -16, z: -2.5, vise: { x: -20, z: 11 }, zone: "B" },
    { x: -28.5, z: 1.5, vise: { x: -20, z: 11 }, zone: "B" },
    { x: -21.5, z: -9.5, vise: { x: -12, z: 0 }, zone: "B" },
    { x: 0.5, z: -4, vise: { x: 0, z: 11 }, zone: "MID" },
    { x: -6, z: -9.5, vise: { x: -2, z: 11 }, zone: "MID" },
    { x: 6.5, z: -10, vise: { x: 6, z: 11 }, zone: "MID" },
  ],
  // Points de rassemblement des attaquants avant d'entrer sur un site
  rassemblement: { A: { x: 20, z: 15 }, B: { x: -20, z: 15 } },
  // Postes tenus par les attaquants après la pose du spike (autour de chaque site)
  apresPose: {
    A: [{ x: 20, z: 9 }, { x: 13, z: 2 }, { x: 27, z: 8 }],
    B: [{ x: -20, z: 9 }, { x: -13, z: 2 }, { x: -27, z: 8 }],
  },
  construire({ mur, caisse, baril, boite, peinture, lampe }) {
    mur(0, -22.5, 66, 1, 7); mur(0, 22.5, 66, 1, 7); mur(-32.5, 0, 1, 44, 7); mur(32.5, 0, 1, 44, 7);
    mur(-11, -7.25, 1, 10.5, 4.5, 0xff4f8a); mur(-11, 7.25, 1, 10.5, 4.5, 0xff4f8a);
    mur(11, -7.25, 1, 10.5, 4.5, 0x3fa8ff); mur(11, 7.25, 1, 10.5, 4.5, 0x3fa8ff);
    mur(14.75, 11, 6.5, 1, 4.5, 0x3fa8ff); mur(27, 11, 10, 1, 4.5, 0x3fa8ff);
    mur(-14.75, 11, 6.5, 1, 4.5, 0xff4f8a); mur(-27, 11, 10, 1, 4.5, 0xff4f8a);
    mur(-7, 11, 7, 1, 4.5); mur(7, 11, 7, 1, 4.5);
    mur(13.75, -13, 4.5, 1, 4.5); mur(28, -13, 8, 1, 4.5); mur(-13.75, -13, 4.5, 1, 4.5); mur(-28, -13, 8, 1, 4.5);
    mur(-7.5, -13, 6, 1, 4.5); mur(7.5, -13, 6, 1, 4.5);
    caisse(25, -3, 2.6, 6, 2.6, "orange"); caisse(18, -6, 2, 2, 1.1, "gris"); caisse(18.3, -6.2, 1.3, 1.3, 1.1, "gris", 1.1);
    caisse(14.5, 4.2, 2, 2, 1.2, "vert"); caisse(28.5, 6.5, 3, 2, 1.5, "bleu"); caisse(15.5, -10.5, 2, 2, 1.2, "orange");
    baril(21, 2.5); baril(22.2, 3.1);
    caisse(-24, -4, 6, 2.6, 2.6, "bleu"); caisse(-17, -7, 2, 2, 1.2, "gris"); caisse(-17.2, -7.1, 1.4, 1.4, 1.2, "gris", 1.2);
    caisse(-14.5, 5, 2, 3, 1.4, "orange"); caisse(-28, 5, 2, 2, 1.2, "vert"); caisse(-27, -10.5, 3, 2, 2, "orange");
    baril(-20, 3); baril(-21.2, 2.3);
    caisse(0, 0, 3, 3, 2.4, "gris"); caisse(-4.5, 5, 2, 2, 1.2, "orange"); caisse(5, -4, 2, 2, 1.2, "vert"); baril(3.5, 6.5);
    boite(-6, -7.5, 4, 0.8, 2.2, "mur");
    caisse(-6, 16, 2, 2, 1.2, "gris"); caisse(7, 17, 2, 2, 1.2, "bleu"); caisse(-8, -17, 2, 2, 1.2, "gris"); caisse(9, -16.5, 3, 2, 2, "orange");
    boite(0, -18.5, 4, 1, 1.5, "mur");
    peinture("A", "#3fa8ff", 22, 0.02, -2, 0, 6, true); peinture("B", "#ff4f8a", -21, 0.02, -1, 0, 6, true);
    peinture("A", "#3fa8ff", 31.99, 3, -2, -Math.PI / 2, 3.2); peinture("B", "#ff4f8a", -31.99, 3, -1, Math.PI / 2, 3.2);
    peinture("A ►", "#3fa8ff", 7, 2.6, 11.51, 0, 3.2); peinture("◄ B", "#ff4f8a", -7, 2.6, 11.51, 0, 3.2);
    peinture("MID", "#9aa6b8", 0, 3.4, -21.99, 0, 4);
    lampe(22, 3.6, -12.4, 0x3fa8ff); lampe(-22, 3.6, -12.4, 0xff4f8a); lampe(7, 3.6, 10.4, 0xffb15c); lampe(0, 5.2, -21.9, 0xe8e8f0);
  },
};

// ======================= BAZAR (marché couvert de bâches) =======================
const bazar = {
  id: "bazar",
  echelle: 1.15, // carte élargie de 15 % (positions et largeurs ; les hauteurs ne changent pas)
  nom: "Bazar",
  description: "Marché aux ruelles étroites : étals, bâches colorées, fontaine au milieu.",
  limites: { minX: -28, maxX: 28, minZ: -24, maxZ: 24 },
  sol: "paves",
  heure: "jour",
  ville: true,
  barriere: 15.4,
  departAttaque: { minX: -5, maxX: 5, minZ: 18, maxZ: 22 },
  departDefense: { minX: -10, maxX: 10, minZ: -23, maxZ: -18 },
  sites: {
    A: { minX: 16, maxX: 26, minZ: -11, maxZ: 6, x: 21, z: -3 },
    B: { minX: -26, maxX: -16, minZ: -11, maxZ: 6, x: -21, z: -3 },
  },
  postes: [
    { x: -25.5, z: -7, vise: { x: -26, z: 12 }, zone: "B" },
    { x: -16, z: -10, vise: { x: -12, z: 9 }, zone: "B" },
    { x: -24, z: 3.5, vise: { x: -26, z: 14 }, zone: "B" },
    { x: 25.5, z: -7, vise: { x: 26, z: 12 }, zone: "A" },
    { x: 16, z: -11, vise: { x: 12, z: 8 }, zone: "A" },
    { x: 24, z: 3, vise: { x: 26, z: 14 }, zone: "A" },
    { x: 0, z: -10, vise: { x: 0, z: 12 }, zone: "MID" },
    { x: -4.5, z: -12, vise: { x: -4, z: 10 }, zone: "MID" },
    { x: 4.5, z: -12, vise: { x: 4, z: 10 }, zone: "MID" },
  ],
  rassemblement: { A: { x: 25.5, z: 16 }, B: { x: -25.5, z: 16 } },
  apresPose: {
    A: [{ x: 26, z: 9 }, { x: 10, z: 9 }, { x: 18, z: -13 }],
    B: [{ x: -26, z: 9 }, { x: -10, z: 9 }, { x: -18, z: -13 }],
  },
  construire({ mur, boite, caisse, peinture, lampe }) {
    // Façades extérieures (hauteurs variées pour une silhouette de vieille ville)
    mur(-14, -24.5, 30, 1, 8, null, "enduitSable"); mur(15, -24.5, 28, 1, 7, null, "enduitOcre");
    mur(-14, 24.5, 30, 1, 7, null, "enduitBlanc"); mur(15, 24.5, 28, 1, 8, null, "enduitSable");
    mur(-28.5, 0, 1, 50, 7.5, null, "enduitOcre"); mur(28.5, 0, 1, 50, 7.5, null, "enduitBlanc");
    // Îlots de maisons
    mur(-10, 1, 8, 14, 5.5, null, "enduitOcre");
    mur(10, -1, 8, 14, 5.5, null, "enduitSable");
    mur(-19, 12, 10, 4, 5, null, "enduitBlanc");
    mur(19, 12, 10, 4, 5, null, "enduitOcre");
    mur(-19, -15, 10, 2, 4.5, null, "enduitSable");
    mur(19, -15, 10, 2, 4.5, null, "enduitBlanc");
    mur(0, -15, 8, 2, 4, null, "enduitOcre");
    boite(0, 13, 6, 1, 2.2, "enduitBlanc");
    // Fontaine au milieu
    boite(0, 0, 3.2, 3.2, 0.85, "pierre");
    // Étals, caisses de fruits, charrettes
    caisse(-22, -4, 2.4, 1, 1.05, "bois"); caisse(-18, 2.2, 1, 2.4, 1.05, "bois");
    caisse(20, -2, 2.4, 1, 1.05, "bois"); caisse(24, -8, 1, 2.4, 1.05, "bois");
    caisse(-25, -10, 2, 2, 1.2, "bois"); caisse(-17, -8.5, 1.2, 1.2, 1.2, "bois"); caisse(-17, -8.5, 1, 1, 0.9, "bois", 1.2);
    caisse(25, 2.5, 2, 2, 1.2, "bois"); caisse(17.5, -10, 1.2, 1.2, 1.2, "bois");
    caisse(-21, 7.5, 2.2, 1.2, 1.1, "bois"); caisse(21, 7.5, 2.2, 1.2, 1.1, "bois");
    caisse(-3, -8, 1.4, 1.4, 1.2, "bois"); caisse(3, 5.5, 1.4, 1.4, 1.2, "bois");
    caisse(-8, 18.5, 2, 2, 1.2, "bois"); caisse(8, 19.5, 2, 2, 1.2, "bois");
    caisse(-6, -19.5, 2, 2, 1.2, "bois"); caisse(6.5, -20, 3, 1, 1.5, "bois");
    peinture("A", "#2d7fd8", 21, 0.02, -3, 0, 5, true); peinture("B", "#d83a6a", -21, 0.02, -3, 0, 5, true);
    peinture("A ►", "#2d7fd8", 19, 3, 14.01, 0, 2.6); peinture("◄ B", "#d83a6a", -19, 3, 14.01, 0, 2.6);
    lampe(-14.4, 3.4, -3, 0xffc27a, Math.PI / 2); lampe(14.4, 3.4, -3, 0xffc27a, -Math.PI / 2);
  },
  decor({ A, mats, groupe, monde, riche }) {
    // Bâches au-dessus des étals (pas de collision : on passe dessous)
    const baches = [
      [-22, -4, 3.2, 2.2, "#c8322f", "#f0e3c8"], [-18, 2.2, 2.2, 3.2, "#2f6fc8", "#f0e3c8"],
      [20, -2, 3.2, 2.2, "#e0a21a", "#f0e3c8"], [24, -8, 2.2, 3.2, "#2f9c5f", "#f0e3c8"],
      [-3, 13.2, 6.4, 2.2, "#7a3fb0", "#f0e3c8"],
    ];
    for (const [x, z, l, p, c1, c2] of baches) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(l, p), new THREE.MeshStandardMaterial({ map: textureBache(c1, c2), side: THREE.DoubleSide, roughness: 0.9 }));
      m.rotation.x = -Math.PI / 2 + 0.18;
      m.position.set(x, 2.55, z);
      m.castShadow = true;
      groupe.add(m);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) A.ajouter(new THREE.CylinderGeometry(0.035, 0.035, 2.6, 6), "bois", { p: [x + sx * (l / 2 - 0.1), 1.3, z + sz * (p / 2 - 0.1)] });
      // Fruits et sacs d'épices sur l'étal
      for (let k = 0; k < 6; k++) A.ajouter(new THREE.SphereGeometry(0.09, 8, 6), k % 2 ? "fruitRouge" : "fruitJaune", { p: [x - l / 4 + (k % 3) * 0.3, 1.12, z - 0.15 + Math.floor(k / 3) * 0.3] });
    }
    // Eau de la fontaine
    const eau = new THREE.Mesh(new THREE.CircleGeometry(1.35, 24), new THREE.MeshStandardMaterial({ color: 0x3a8fb0, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.85 }));
    eau.rotation.x = -Math.PI / 2;
    eau.position.set(0, 0.8, 0);
    groupe.add(eau);
    A.ajouter(new THREE.CylinderGeometry(0.18, 0.25, 1.6, 12), "pierre", { p: [0, 1.6, 0] });
    A.ajouter(new THREE.CylinderGeometry(0.6, 0.3, 0.2, 16), "pierre", { p: [0, 2.4, 0] });
    // Guirlandes lumineuses au-dessus de la rue centrale
    for (const z of [-10, -4, 2, 8]) {
      const courbe = new THREE.CatmullRomCurve3([new THREE.Vector3(-6, 5.2, z), new THREE.Vector3(0, 4.3, z + 0.3), new THREE.Vector3(6, 5.2, z)]);
      A.ajouter(new THREE.TubeGeometry(courbe, 16, 0.015, 5), "cable");
      for (let k = 1; k < 10; k++) {
        const p = courbe.getPoint(k / 10);
        A.ajouter(new THREE.SphereGeometry(0.06, 8, 6), "ampoule", { p: [p.x, p.y - 0.08, p.z] });
      }
    }
    // Volets, auvents et pots de fleurs le long des façades des îlots
    const facades = [[-14.02, -4, -1], [-14.02, 5, -1], [-5.98, -4, 1], [-5.98, 5, 1], [5.98, -6, -1], [5.98, 3, -1], [14.02, -6, 1], [14.02, 3, 1]];
    for (const [x, z, s] of facades) {
      A.ajouter(new THREE.BoxGeometry(0.06, 1.1, 1.3), "volet", { p: [x + s * 0.03, 3.4, z] });
      A.ajouter(new THREE.BoxGeometry(0.05, 0.08, 1.5), "bois", { p: [x + s * 0.04, 2.8, z] });
      if (riche) {
        A.ajouter(revolution([[0.22, 0], [0.28, 0.35], [0.24, 0.42]], 12), "terre", { p: [x + s * 0.4, 0, z + 1.4] });
        A.ajouter(new THREE.SphereGeometry(0.32, 10, 8), "plante", { p: [x + s * 0.4, 0.62, z + 1.4], s: [1, 0.8, 1] });
      }
    }
    // Arches au-dessus des entrées principales (A et B)
    for (const sx of [-1, 1]) {
      A.ajouter(new THREE.BoxGeometry(4.2, 0.8, 1.2), "pierre", { p: [sx * 26, 4.6, 12] });
      monde.ajouter(sx * 26 - 2.1, 4.2, 11.4, sx * 26 + 2.1, 5, 12.6, { type: "linteau" });
    }
  },
};

// ======================= HANGAR (zone industrielle) =======================
const hangar = {
  id: "hangar",
  echelle: 1.15, // carte élargie de 15 % (positions et largeurs ; les hauteurs ne changent pas)
  nom: "Hangar",
  description: "Entrepôt industriel : site A sous la halle, site B au milieu des conteneurs.",
  limites: { minX: -32, maxX: 32, minZ: -24, maxZ: 24 },
  sol: "industriel",
  heure: "soir",
  ville: true,
  barriere: 15,
  departAttaque: { minX: 0, maxX: 10, minZ: 18, maxZ: 22 },
  departDefense: { minX: -6, maxX: 4, minZ: -23, maxZ: -18 },
  sites: {
    A: { minX: 12, maxX: 27, minZ: -21, maxZ: -8, x: 19, z: -13 },
    B: { minX: -27, maxX: -12, minZ: -18, maxZ: -4, x: -20, z: -10 },
  },
  postes: [
    { x: 12.5, z: -12.5, vise: { x: 12.5, z: -4 }, zone: "A" },
    { x: 28.5, z: -11, vise: { x: 24, z: -4 }, zone: "A" },
    { x: 9, z: -22, vise: { x: 5, z: -12.5 }, zone: "A" },
    { x: -25, z: -7.5, vise: { x: -24, z: 6 }, zone: "B" },
    { x: -15, z: -9, vise: { x: -12, z: 2 }, zone: "B" },
    { x: -29.5, z: -15, vise: { x: -24, z: 5 }, zone: "B" },
    { x: -2, z: -14, vise: { x: -2, z: 10 }, zone: "MID" },
    { x: 2.5, z: -8, vise: { x: 4, z: 10 }, zone: "MID" },
    { x: -5, z: -17, vise: { x: -7, z: 2 }, zone: "MID" },
  ],
  rassemblement: { A: { x: 24, z: 2 }, B: { x: -25.5, z: 11 } },
  apresPose: {
    A: [{ x: 12.5, z: -2 }, { x: 24, z: -1 }, { x: 3, z: -12.5 }],
    B: [{ x: -24, z: 8 }, { x: -10, z: 0 }, { x: -12, z: -14 }],
  },
  construire({ mur, boite, caisse, baril, peinture, lampe }) {
    mur(0, -24.5, 66, 1, 8, null, "tole"); mur(0, 24.5, 66, 1, 8, null, "tole");
    mur(-32.5, 0, 1, 50, 8, null, "tole"); mur(32.5, 0, 1, 50, 8, null, "tole");
    // Halle du site A (portes à l'ouest et au sud)
    mur(6, -19, 1, 10, 6.5, null, "toleBleue"); mur(6, -8, 1, 6, 6.5, null, "toleBleue");
    mur(8.5, -5, 5, 1, 6.5, null, "toleBleue"); mur(18, -5, 8, 1, 6.5, null, "toleBleue"); mur(29, -5, 6, 1, 6.5, null, "toleBleue");
    // Rayonnages dans la halle
    caisse(12, -16.5, 5, 1.2, 3.2, "gris"); caisse(22, -16.5, 6, 1.2, 3.2, "gris"); caisse(17, -10.5, 4, 1.2, 3.2, "gris");
    caisse(27, -21, 4, 1.2, 3.2, "gris");
    // Cour des conteneurs (site B)
    mur(-29.5, 4, 5, 1, 4.5); mur(-14.5, 4, 13, 1, 4.5); mur(-8, -6, 1, 8, 4.5);
    caisse(-22, -12, 6, 2.6, 2.6, "bleu"); caisse(-22, -12, 6, 2.6, 2.6, "orange", 2.6);
    caisse(-28.5, -2, 2.6, 6, 2.6, "vert"); caisse(-14, -17, 2.6, 5, 2.6, "gris");
    caisse(-18, -6, 2, 2, 1.2, "bois"); caisse(-24.5, -6, 1.4, 1.4, 1.2, "bois");
    // Milieu : chariot élévateur, glissières béton, palettes
    caisse(-1, -4, 2.6, 0.6, 0.9, "mur"); caisse(3, 3, 0.6, 2.6, 0.9, "mur");
    caisse(1.5, -12, 1.4, 2.4, 2.1, "jaune"); caisse(-3.5, -9, 1.2, 1.2, 1.4, "bois");
    baril(-4, 6); baril(-3, 6.6);
    // Côté attaque : camion, conteneur, caisses
    caisse(14, 11, 2.6, 7, 3.2, "blanc"); caisse(26, 6, 2.6, 6, 2.6, "gris"); caisse(18, 2, 2, 2, 1.2, "bois");
    caisse(-14, 12, 2, 2, 1.2, "bois"); caisse(-20, 9, 8, 1, 2.2, "mur"); caisse(4, 17, 2, 2, 1.2, "bois");
    caisse(-4, -20, 2, 2, 1.2, "bois"); caisse(2.5, -21, 2, 1, 1.4, "gris");
    peinture("A", "#3fa8ff", 19, 0.02, -13, 0, 5, true); peinture("B", "#ff4f8a", -20, 0.02, -9, 0, 5, true);
    peinture("A", "#3fa8ff", 18, 4.5, -4.49, 0, 3); peinture("B ▼", "#ff4f8a", -24, 2.6, 4.51, 0, 2.6);
    lampe(8.5, 5.6, -4.4, 0xffd9a8); lampe(18, 5.6, -4.4, 0xffd9a8); lampe(29, 5.6, -4.4, 0xffd9a8); lampe(-14.5, 3.6, 4.6, 0xff4f8a);
  },
  decor({ A, groupe, monde, riche }) {
    // Poutres et rampes lumineuses au-dessus de la halle
    for (let x = 9; x <= 30; x += 5) {
      A.ajouter(new THREE.BoxGeometry(0.3, 0.4, 19), "sombre", { p: [x, 6.4, -14.5] });
      A.ajouter(new THREE.BoxGeometry(0.2, 0.06, 6), "lampe", { p: [x, 6.18, -14.5] });
    }
    // Cartons sur les rayonnages
    const etageres = [[12, -16.5, 5], [22, -16.5, 6], [17, -10.5, 4], [27, -21, 4]];
    for (const [x, z, l] of etageres) {
      for (const y of [1.15, 2.3]) {
        A.ajouter(new THREE.BoxGeometry(l + 0.1, 0.05, 1.3), "jaune", { p: [x, y, z] });
        for (let k = 0; k < Math.floor(l / 0.9); k++) A.ajouter(boiteRonde(0.7, 0.55, 0.8, 0.03), "carton", { p: [x - l / 2 + 0.5 + k * 0.9, y + 0.3, z] });
      }
    }
    // Cabine du camion
    A.ajouter(boiteRonde(2.5, 2.3, 2, 0.15), "blanc", { p: [14, 1.35, 6.4] });
    A.ajouter(new THREE.BoxGeometry(2.2, 0.9, 0.05), "verre", { p: [14, 2.1, 5.38] });
    for (const [x, z] of [[12.75, 7], [15.25, 7], [12.75, 13], [15.25, 13], [12.75, 6.6], [15.25, 6.6]]) A.ajouter(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 16).rotateZ(Math.PI / 2), "caoutchouc", { p: [x, 0.5, z] });
    monde.ajouter(12.75, 0, 5.4, 15.25, 2.5, 7.5, { type: "camion" });
    // Fourches du chariot élévateur
    A.ajouter(new THREE.BoxGeometry(0.12, 0.06, 1.2), "sombre", { p: [1.1, 0.1, -13.8] });
    A.ajouter(new THREE.BoxGeometry(0.12, 0.06, 1.2), "sombre", { p: [1.9, 0.1, -13.8] });
    A.ajouter(new THREE.BoxGeometry(1.4, 2.6, 0.12), "sombre", { p: [1.5, 1.3, -13.2] });
    // Bandes jaunes au sol devant les portes de la halle
    for (const [x, z, l, p] of [[12.5, -4.2, 3, 0.4], [24, -4.2, 4, 0.4], [6.8, -12.5, 0.4, 3]]) {
      const g = new THREE.PlaneGeometry(l, p); g.rotateX(-Math.PI / 2);
      A.ajouter(g, "jaune", { p: [x, 0.01, z] });
    }
  },
};

// ======================= STAND DE TIR =======================
const stand = {
  id: "stand",
  nom: "Stand de tir",
  description: "Couloirs d'entraînement avec cibles mobiles.",
  limites: { minX: -12, maxX: 12, minZ: -44, maxZ: 8 },
  sol: "industriel",
  heure: "jour",
  ville: true,
  barriere: null,
  departAttaque: { minX: -1, maxX: 1, minZ: 3, maxZ: 4 },
  departDefense: { minX: -10, maxX: 10, minZ: -42, maxZ: -30 },
  sites: {},
  postes: [],
  rassemblement: {},
  apresPose: { A: [], B: [] },
  construire({ mur, boite, caisse, peinture }) {
    mur(0, -44.5, 26, 1, 6, null, "tole"); mur(0, 8.5, 26, 1, 4); mur(-12.5, -18, 1, 54, 6, null, "tole"); mur(12.5, -18, 1, 54, 6, null, "tole");
    boite(0, 0.5, 24, 0.8, 1.05, "bois");
    for (const x of [-8, -4, 4, 8]) boite(x, -1.5, 0.15, 3.2, 1.6, "mur");
    for (const z of [-10, -20, -30, -40]) peinture(String(-z) + " m", "#e8e8f0", -11.95, 2.5, z, Math.PI / 2, 1.6);
  },
};

export const CARTES = { nexus, bazar, hangar, stand };
export const CARTES_JOUABLES = ["nexus", "bazar", "hangar"];
