// Habillage de la carte : architecture, équipements, signalisation, sols et ombrage de contact.
// Tout est fusionné par matériau (quelques appels de rendu seulement). Les objets décoratifs
// hors de portée n'ont pas de collision ; ceux qui gênent le passage reçoivent une boîte simple.
import * as THREE from "three";
import { Assemblage, boiteRonde, revolution } from "./formes.js";
import { textureOmbreContact, texturePeinture, textureMetal, uvMonde } from "./textures.js";

function texte(lignes, couleur, fond, l = 512, h = 128) {
  const c = document.createElement("canvas");
  c.width = l; c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = fond;
  ctx.fillRect(0, 0, l, h);
  ctx.strokeStyle = couleur;
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, l - 12, h - 12);
  ctx.fillStyle = couleur;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lignes.forEach((t, i) => {
    ctx.font = `${i === 0 ? 800 : 600} ${i === 0 ? h * 0.36 : h * 0.18}px "Orbitron", "Arial Black", Arial, sans-serif`;
    ctx.fillText(t, l / 2, lignes.length === 1 ? h / 2 : h * (i === 0 ? 0.42 : 0.78));
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export { texte as texteSignal };

// nexus = true : ajoute l'habillage propre à la carte Nexus. Les autres sections servent à toutes les cartes.
export function decorer({ groupe, monde, mat, qualite, ombres, nexus = false }) {
  const riche = qualite !== "basse";
  const A = new Assemblage();
  const mats = {
    ...mat,
    tuyau: new THREE.MeshStandardMaterial({ color: 0x5b636e, roughness: 0.45, metalness: 0.7 }),
    tuyauRouge: new THREE.MeshStandardMaterial({ color: 0x8a2c25, roughness: 0.5, metalness: 0.4 }),
    cable: new THREE.MeshStandardMaterial({ color: 0x111215, roughness: 0.7 }),
    verre: new THREE.MeshStandardMaterial({ color: 0x1b2433, roughness: 0.08, metalness: 0.8, emissive: 0x0b1424, emissiveIntensity: 1 }),
    cadre: new THREE.MeshStandardMaterial({ color: 0x2c3038, roughness: 0.5, metalness: 0.6 }),
    bois: new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.85 }),
    sac: new THREE.MeshStandardMaterial({ color: 0x6d6450, roughness: 0.95 }),
    lampe: new THREE.MeshStandardMaterial({ color: 0xfff0d8, emissive: 0xffe2b8, emissiveIntensity: 2.2, toneMapped: true }),
    led: new THREE.MeshStandardMaterial({ color: 0x7cffd4, emissive: 0x3fe0b0, emissiveIntensity: 1.5 }),
    ledRouge: new THREE.MeshStandardMaterial({ color: 0xff5a4a, emissive: 0xff3a2a, emissiveIntensity: 1.5 }),
    jaune: new THREE.MeshStandardMaterial({ color: 0xe0b020, roughness: 0.6 }),
    caoutchouc: new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: 0.95 }),
  };

  if (nexus) {
  // ----- Piliers et bandeaux sur les murs extérieurs -----
  const murExt = [
    { axe: "x", fixe: -22, sens: 1, de: -31.5, a: 31.5 },  // nord (côté bots), face intérieure vers +Z
    { axe: "x", fixe: 22, sens: -1, de: -31.5, a: 31.5 },  // sud
    { axe: "z", fixe: -32, sens: 1, de: -21.5, a: 21.5 },  // ouest
    { axe: "z", fixe: 32, sens: -1, de: -21.5, a: 21.5 },  // est
  ];
  for (const m of murExt) {
    for (let t = m.de + 2; t <= m.a - 1; t += 6) {
      const pos = m.axe === "x" ? [t, 3.5, m.fixe + m.sens * 0.18] : [m.fixe + m.sens * 0.18, 3.5, t];
      A.ajouter(uvMonde(new THREE.BoxGeometry(m.axe === "x" ? 0.7 : 0.36, 7, m.axe === "x" ? 0.36 : 0.7), m.axe === "x" ? 0.7 : 0.36, 7, m.axe === "x" ? 0.36 : 0.7, 4), "mur", { p: pos });
    }
    // Bandeau métallique à 4,6 m et rangée de fenêtres au-dessus
    const long = m.a - m.de;
    const centre = (m.a + m.de) / 2;
    const p = (dec, y) => m.axe === "x" ? [centre, y, m.fixe + m.sens * dec] : [m.fixe + m.sens * dec, y, centre];
    const dims = (l, h, e) => m.axe === "x" ? [l, h, e] : [e, h, l];
    A.ajouter(new THREE.BoxGeometry(...dims(long, 0.18, 0.12)), "sombre", { p: p(0.06, 4.6) });
    if (riche) {
      for (let t = m.de + 5; t <= m.a - 2; t += 6) {
        const c = m.axe === "x" ? [t, 5.8, m.fixe + m.sens * 0.02] : [m.fixe + m.sens * 0.02, 5.8, t];
        const d = m.axe === "x" ? [2.6, 1.3, 0.06] : [0.06, 1.3, 2.6];
        A.ajouter(new THREE.BoxGeometry(...d), "verre", { p: c });
        const dc = m.axe === "x" ? [2.8, 0.1, 0.14] : [0.14, 0.1, 2.8];
        A.ajouter(new THREE.BoxGeometry(...dc), "cadre", { p: [c[0], 6.5, c[2]] });
        A.ajouter(new THREE.BoxGeometry(...dc), "cadre", { p: [c[0], 5.1, c[2]] });
      }
    }
  }

  // ----- Tuyauterie et câbles le long du mur nord (au-dessus des têtes) -----
  for (const [y, r, matT] of [[3.9, 0.12, "tuyau"], [4.25, 0.08, "tuyauRouge"]]) {
    A.ajouter(new THREE.CylinderGeometry(r, r, 63, 12).rotateZ(Math.PI / 2), matT, { p: [0, y, -21.65] });
  }
  for (let x = -30; x <= 30; x += 4) {
    A.ajouter(boiteRonde(0.08, 0.6, 0.3, 0.01), "sombre", { p: [x, 4.05, -21.82] });
    for (const y of [3.9, 4.25]) A.ajouter(new THREE.TorusGeometry(0.13, 0.015, 6, 12).rotateY(Math.PI / 2), "sombre", { p: [x, y, -21.65], s: [1, 1, 1] });
  }
  if (riche) {
    // Câbles qui pendent entre les attaches du mur est
    for (let z = -18; z < 18; z += 6) {
      const courbe = new THREE.CatmullRomCurve3([new THREE.Vector3(31.7, 5.2, z), new THREE.Vector3(31.55, 4.6, z + 3), new THREE.Vector3(31.7, 5.2, z + 6)]);
      A.ajouter(new THREE.TubeGeometry(courbe, 16, 0.025, 6), "cable");
      const c2 = new THREE.CatmullRomCurve3([new THREE.Vector3(31.7, 5.0, z), new THREE.Vector3(31.55, 4.2, z + 3), new THREE.Vector3(31.7, 5.0, z + 6)]);
      A.ajouter(new THREE.TubeGeometry(c2, 16, 0.02, 6), "cable");
    }
  }

  // ----- Coursive suspendue le long du mur ouest (inaccessible, donne de la hauteur) -----
  A.ajouter(new THREE.BoxGeometry(1.4, 0.12, 40), "sombre", { p: [-31.2, 4.4, 0] });
  for (let z = -19.5; z <= 19.5; z += 1.5) A.ajouter(new THREE.BoxGeometry(0.04, 1, 0.04), "sombre", { p: [-30.55, 4.95, z] });
  A.ajouter(new THREE.BoxGeometry(0.05, 0.05, 40), "jaune", { p: [-30.55, 5.45, 0] });
  A.ajouter(new THREE.BoxGeometry(0.04, 0.04, 40), "sombre", { p: [-30.55, 4.95, 0] });
  for (let z = -18; z <= 18; z += 6) A.ajouter(new THREE.BoxGeometry(1.2, 0.08, 0.08), "sombre", { p: [-31.3, 4.15, z], r: [0, 0, -0.5] });

  // ----- Linteaux au-dessus des passages (portes) -----
  const linteaux = [
    [20, 11, 4, 1.2], [-20, 11, 4, 1.2], [0, 11, 7, 1.2],          // entrées côté attaque
    [20, -13, 8, 1.2], [-20, -13, 8, 1.2], [0, -13, 9, 1.2],           // fonds côté défense
  ];
  for (const [x, z, l, p] of linteaux) {
    A.ajouter(uvMonde(new THREE.BoxGeometry(l + 0.4, 1.0, p), l + 0.4, 1, p, 4), "mur", { p: [x, 4.0, z] });
    A.ajouter(new THREE.BoxGeometry(l + 0.5, 0.12, p + 0.08), "sombre", { p: [x, 3.45, z] });
    monde.ajouter(x - l / 2 - 0.2, 3.5, z - p / 2, x + l / 2 + 0.2, 4.5, z + p / 2, { type: "linteau" });
    // Cadre de porte en acier
    for (const s of [-1, 1]) A.ajouter(new THREE.BoxGeometry(0.12, 3.5, p + 0.06), "sombre", { p: [x + s * (l / 2 + 0.06), 1.75, z] });
    // Lampe sous le linteau
    A.ajouter(boiteRonde(0.9, 0.06, 0.18, 0.02), "lampe", { p: [x, 3.37, z] });
  }

  // ----- Coffrets électriques, bouches d'aération, extincteurs -----
  const coffrets = [[12.5, 1.1, -12.45, 0], [-12.5, 1.1, -12.45, 0], [31.45, 1.3, 8, -Math.PI / 2], [-31.45, 1.3, -6, Math.PI / 2], [6.5, 1.2, 10.45, Math.PI]];
  for (const [x, y, z, ry] of coffrets) {
    A.ajouter(boiteRonde(0.9, 1.3, 0.3, 0.03), "gris", { p: [x, y, z], r: [0, ry, 0] });
    const av = new THREE.Vector3(0, 0, 0.16).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
    A.ajouter(new THREE.BoxGeometry(0.06, 0.03, 0.02), "led", { p: [x + av.x + 0.25 * Math.cos(ry), y + 0.45, z + av.z - 0.25 * Math.sin(ry)], r: [0, ry, 0] });
    A.ajouter(new THREE.BoxGeometry(0.06, 0.03, 0.02), "ledRouge", { p: [x + av.x + 0.15 * Math.cos(ry), y + 0.45, z + av.z - 0.15 * Math.sin(ry)], r: [0, ry, 0] });
    A.ajouter(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8), "tuyau", { p: [x + 0.3 * Math.cos(ry), y + 1.7, z - 0.3 * Math.sin(ry)] });
  }
  for (const [x, z, ry] of [[-31.6, 12, Math.PI / 2], [31.6, -14, -Math.PI / 2], [10, -21.6, 0]]) {
    A.ajouter(boiteRonde(1.2, 0.8, 0.12, 0.02), "sombre", { p: [x, 2.6, z], r: [0, ry, 0] });
    for (let k = 0; k < 6; k++) A.ajouter(new THREE.BoxGeometry(1.0, 0.03, 0.04), "gris", { p: [x, 2.35 + k * 0.1, z], r: [0, ry, 0] });
  }

  // ----- Palettes, sacs de sable et touret de câble (avec collision simple) -----
  const palettes = [[29.5, -18, 0.3], [-29, 17.5, 0], [14, 19.5, 0.2], [-14, -19.5, -0.2]];
  for (const [x, z, ry] of palettes) {
    for (let k = 0; k < 3; k++) A.ajouter(new THREE.BoxGeometry(1.2, 0.03, 0.12), "bois", { p: [x, 0.13, z - 0.45 + k * 0.45], r: [0, ry, 0] });
    for (let k = 0; k < 3; k++) A.ajouter(new THREE.BoxGeometry(0.1, 0.11, 1.0), "bois", { p: [x - 0.5 + k * 0.5, 0.055, z], r: [0, ry, 0] });
    A.ajouter(boiteRonde(1.0, 0.7, 0.9, 0.06), "sac", { p: [x, 0.5, z], r: [0, ry, 0] });
    monde.ajouter(x - 0.65, 0, z - 0.6, x + 0.65, 0.85, z + 0.6, { type: "palette" });
  }
  for (const [x, z] of [[-9.4, 13.5], [9.4, -15]]) {
    A.ajouter(new THREE.CylinderGeometry(0.75, 0.75, 0.08, 20).rotateX(Math.PI / 2), "bois", { p: [x, 0.75, z - 0.35] });
    A.ajouter(new THREE.CylinderGeometry(0.75, 0.75, 0.08, 20).rotateX(Math.PI / 2), "bois", { p: [x, 0.75, z + 0.35] });
    A.ajouter(new THREE.CylinderGeometry(0.5, 0.5, 0.62, 20).rotateX(Math.PI / 2), "cable", { p: [x, 0.75, z] });
    monde.ajouter(x - 0.75, 0, z - 0.4, x + 0.75, 1.5, z + 0.4, { type: "touret" });
  }
  // Sacs de sable en arc sur les sites
  for (const [cx, cz, a0] of [[24, 7.5, Math.PI], [-26, 8.5, Math.PI]]) {
    for (let k = 0; k < 5; k++) {
      const a = a0 + (k - 2) * 0.28;
      const x = cx + Math.sin(a) * 1.6, z = cz + Math.cos(a) * 1.6;
      A.ajouter(boiteRonde(0.6, 0.26, 0.38, 0.1), "sac", { p: [x, 0.13, z], r: [0, a, 0] });
      A.ajouter(boiteRonde(0.6, 0.26, 0.38, 0.1), "sac", { p: [x, 0.39, z], r: [0, a + 0.15, 0] });
    }
    monde.ajouter(cx - 1.4, 0, cz - 1.9, cx + 1.4, 0.55, cz - 1.0, { type: "sacs" });
  }

  // ----- Projecteurs sur poteaux (sites A et B) -----
  for (const [x, z, ry] of [[29.5, -10.5, -2.4], [-29.5, -10.5, 2.4]]) {
    A.ajouter(new THREE.CylinderGeometry(0.08, 0.1, 6, 10), "sombre", { p: [x, 3, z] });
    A.ajouter(boiteRonde(0.7, 0.4, 0.25, 0.04), "sombre", { p: [x, 6.1, z], r: [0.5, ry, 0] });
    A.ajouter(new THREE.BoxGeometry(0.6, 0.3, 0.02), "lampe", { p: [x + Math.sin(ry) * 0.13, 6.05, z + Math.cos(ry) * 0.13], r: [0.5, ry, 0] });
    monde.ajouter(x - 0.12, 0, z - 0.12, x + 0.12, 6, z + 0.12, { type: "poteau" });
  }

  }

  // ----- Portes et détails des conteneurs (caisses de plus de 2,5 m de long) -----
  for (const b of monde.boites) {
    if (!["orange", "bleu", "gris", "vert"].includes(b.type)) continue;
    const l = b.maxX - b.minX, p = b.maxZ - b.minZ, h = b.maxY - b.minY;
    if (Math.max(l, p) < 2.5 || h < 2) continue;
    const surX = l > p;
    for (const s of [-1, 1]) {
      const cx = surX ? (s > 0 ? b.maxX + 0.01 : b.minX - 0.01) : (b.minX + b.maxX) / 2;
      const cz = surX ? (b.minZ + b.maxZ) / 2 : (s > 0 ? b.maxZ + 0.01 : b.minZ - 0.01);
      const largeur = surX ? p : l;
      for (const k of [-0.3, -0.1, 0.1, 0.3]) {
        const o = k * largeur;
        A.ajouter(new THREE.CylinderGeometry(0.025, 0.025, h - 0.3, 8), "sombre", { p: [cx + (surX ? 0 : o), b.minY + h / 2, cz + (surX ? o : 0)] });
      }
      A.ajouter(new THREE.BoxGeometry(surX ? 0.04 : largeur - 0.1, 0.12, surX ? largeur - 0.1 : 0.04), "sombre", { p: [cx, b.minY + 0.5, cz] });
    }
  }

  // ----- Ombrage de contact : bande sombre au pied de chaque obstacle -----
  const texOmbre = textureOmbreContact();
  const matOmbre = new THREE.MeshBasicMaterial({ map: texOmbre, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, color: 0x000000, opacity: 1 });
  const AO = new Assemblage();
  const largeurOmbre = 0.7;
  for (const b of monde.boites) {
    if (b.minY > 0.05 || b.type === "barriere" || b.type === "linteau" || b.type === "poteau") continue;
    const l = b.maxX - b.minX, p = b.maxZ - b.minZ;
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    const cotes = [
      [cx, b.maxZ + largeurOmbre / 2, l + largeurOmbre, 0],
      [cx, b.minZ - largeurOmbre / 2, l + largeurOmbre, Math.PI],
      [b.maxX + largeurOmbre / 2, cz, p + largeurOmbre, Math.PI / 2],
      [b.minX - largeurOmbre / 2, cz, p + largeurOmbre, -Math.PI / 2],
    ];
    for (const [x, z, lg, ry] of cotes) {
      const g = new THREE.PlaneGeometry(lg, largeurOmbre);
      g.rotateX(-Math.PI / 2);
      // v = 1 contre l'obstacle, 0 au loin (sens du dégradé)
      AO.ajouter(g, "ombre", { p: [x, 0.012, z], r: [0, ry, 0] });
    }
  }
  const ombreMesh = AO.construire({ ombre: matOmbre }, false);
  ombreMesh.renderOrder = 1;
  groupe.add(ombreMesh);

  if (nexus) {
  // ----- Sols différenciés : plaques métalliques sur les sites, asphalte aux départs -----
  const tole = textureMetal("#4a505a", 111, qualite);
  const matTole = new THREE.MeshStandardMaterial({ map: tole.map, normalMap: tole.normalMap, roughness: 0.5, metalness: 0.5, polygonOffset: true, polygonOffsetFactor: -1 });
  const SOL = new Assemblage();
  for (const [x, z, l, p] of [[22, -1, 18, 22], [-22, -1, 18, 22]]) {
    const g = new THREE.PlaneGeometry(l, p);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * l / 3, uv.getY(i) * p / 3);
    g.rotateX(-Math.PI / 2);
    SOL.ajouter(g, "tole", { p: [x, 0.004, z] });
  }
  const sols = SOL.construire({ tole: matTole }, false);
  sols.children.forEach((m) => { m.receiveShadow = ombres; });
  groupe.add(sols);

  // Lignes peintes (limites de sites et zone de départ)
  const LIGNES = new Assemblage();
  const ligne = (x, z, l, p) => { const g = new THREE.PlaneGeometry(l, p); g.rotateX(-Math.PI / 2); LIGNES.ajouter(g, "peinture", { p: [x, 0.008, z] }); };
  for (const sx of [-1, 1]) {
    const cx = sx * 22;
    ligne(cx, -12, 18, 0.12); ligne(cx, 10, 18, 0.12); ligne(cx - 9, -1, 0.12, 22); ligne(cx + 9, -1, 0.12, 22);
  }
  ligne(0, 14, 20, 0.15);
  const matPeinture = new THREE.MeshStandardMaterial({ color: 0xd9b02a, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
  groupe.add(LIGNES.construire({ peinture: matPeinture }, false));

  // ----- Panneaux de signalisation -----
  const panneaux = [
    { t: texte(["SECTEUR A", "QUAI DE CHARGEMENT 07"], "#3fa8ff", "#0d1626"), x: 31.95, y: 3.4, z: 8, ry: -Math.PI / 2, l: 3.2, h: 0.8 },
    { t: texte(["SECTEUR B", "ENTREPÔT FRIGORIFIQUE"], "#ff4f8a", "#1a0d16"), x: -31.95, y: 3.4, z: 6, ry: Math.PI / 2, l: 3.2, h: 0.8 },
    { t: texte(["NEXUS LOGISTIQUE"], "#e8e8f0", "#11141b"), x: 0, y: 5.6, z: 22 - 0.05, ry: Math.PI, l: 6, h: 1.1 },
    { t: texte(["⚠ HAUTE TENSION"], "#16181d", "#e8b419", 512, 96), x: 12.5, y: 2.1, z: -12.42, ry: 0, l: 1.1, h: 0.2 },
    { t: texte(["⚠ HAUTE TENSION"], "#16181d", "#e8b419", 512, 96), x: -12.5, y: 2.1, z: -12.42, ry: 0, l: 1.1, h: 0.2 },
    { t: texte(["ZONE DE DÉPART"], "#7cffd4", "#0b1a18"), x: 0, y: 2.4, z: 21.95, ry: Math.PI, l: 2.6, h: 0.65 },
  ];
  for (const p of panneaux) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(p.l, p.h), new THREE.MeshStandardMaterial({ map: p.t, roughness: 0.6, emissive: 0xffffff, emissiveMap: p.t, emissiveIntensity: 0.25, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.set(p.x, p.y, p.z);
    m.rotation.y = p.ry;
    groupe.add(m);
  }
  }
  // Numéros peints sur les conteneurs
  let num = 11;
  for (const b of monde.boites) {
    if (!["orange", "bleu", "gris", "vert"].includes(b.type) || b.maxY - b.minY < 2) continue;
    const surX = (b.maxX - b.minX) > (b.maxZ - b.minZ);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshStandardMaterial({ map: texturePeinture(`NX-${num++}`, "#e9e4d8", 256), transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    if (surX) { m.position.set((b.minX + b.maxX) / 2, b.maxY - 0.7, b.maxZ + 0.012); }
    else { m.position.set(b.maxX + 0.012, b.maxY - 0.7, (b.minZ + b.maxZ) / 2); m.rotation.y = Math.PI / 2; }
    groupe.add(m);
  }

  groupe.add(A.construire(mats, ombres));
}
