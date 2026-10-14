// Construction d'une carte à partir de sa définition (cartes.js) : matériaux, géométrie fusionnée,
// éclairage selon l'heure, météo, ciel, ville au loin, habillage, navigation des bots.
import * as THREE from "three";
import { Monde, GrilleNav } from "./physique.js";
import { decorer } from "./decor.js";
import { Assemblage } from "./formes.js";
import * as TX from "./textures.js";
import { CARTES } from "./cartes.js";

export const AMBIANCES = {
  jour: {
    nom: "Jour",
    ciel: { zenith: [0.16, 0.38, 0.82], milieu: [0.45, 0.66, 0.94], horizon: [0.84, 0.9, 0.97], halo: [1.0, 0.95, 0.85], etoiles: 0 },
    soleil: { couleur: 0xfff2df, intensite: 3.3, pos: [-22, 42, 16] },
    hemi: { ciel: 0xd6e6ff, sol: 0xa09078, intensite: 1.5 },
    brouillard: { couleur: 0xc4d8ee, pres: 90, loin: 300 },
    fenetres: 0.12, facade: 0x6a7891, exposition: 1.0, env: 1.0, torche: false,
  },
  soir: {
    nom: "Coucher de soleil",
    ciel: { zenith: [0.06, 0.1, 0.24], milieu: [0.26, 0.3, 0.52], horizon: [1.0, 0.6, 0.4], halo: [1.0, 0.7, 0.45], etoiles: 0 },
    soleil: { couleur: 0xffcf9e, intensite: 3.1, pos: [-26, 24, 18] },
    hemi: { ciel: 0xb0c8ff, sol: 0x5a4636, intensite: 1.25 },
    brouillard: { couleur: 0x6a5e78, pres: 70, loin: 240 },
    fenetres: 0.9, facade: 0x10131f, exposition: 1.15, env: 0.9, torche: false,
  },
  nuit: {
    nom: "Nuit",
    ciel: { zenith: [0.01, 0.02, 0.05], milieu: [0.03, 0.05, 0.12], horizon: [0.1, 0.12, 0.22], halo: [0.6, 0.7, 0.9], etoiles: 1 },
    soleil: { couleur: 0xa8c0ff, intensite: 1.3, pos: [20, 40, -10] },
    hemi: { ciel: 0x6a80b0, sol: 0x25252e, intensite: 1.25 },
    brouillard: { couleur: 0x0c1222, pres: 45, loin: 180 },
    fenetres: 1.3, facade: 0x05070d, exposition: 1.35, env: 0.6, torche: true,
  },
};

export const METEOS = {
  clair: { nom: "Clair" },
  pluie: { nom: "Pluie" },
  brouillard: { nom: "Brouillard" },
};

const COULEURS_METAL = { orange: "#c8642a", bleu: "#2d5d8a", gris: "#6b7380", vert: "#3f6b4c", blanc: "#c9ccd1", jaune: "#d8a520", tole: "#8a949e", toleBleue: "#3d5f86" };
const ENDUITS = { enduitSable: ["#dcc39a", 201], enduitOcre: ["#cf955e", 202], enduitBlanc: ["#e6dfd0", 203], pierre: ["#b8ab95", 204] };
const SIMPLES = {
  tuyau: { color: 0x5b636e, roughness: 0.45, metalness: 0.7 }, tuyauRouge: { color: 0x8a2c25, roughness: 0.5, metalness: 0.4 },
  cable: { color: 0x111215, roughness: 0.7 }, cadre: { color: 0x2c3038, roughness: 0.5, metalness: 0.6 },
  verre: { color: 0x1b2433, roughness: 0.08, metalness: 0.8, emissive: 0x0b1424, emissiveIntensity: 1 },
  sac: { color: 0x7d735c, roughness: 0.95 }, caoutchouc: { color: 0x1a1b1e, roughness: 0.95 }, carton: { color: 0xb08a5a, roughness: 0.9 },
  lampe: { color: 0xfff0d8, emissive: 0xffe2b8, emissiveIntensity: 2.2 }, ampoule: { color: 0xfff0c8, emissive: 0xffd28a, emissiveIntensity: 2.5 },
  led: { color: 0x7cffd4, emissive: 0x3fe0b0, emissiveIntensity: 1.5 }, ledRouge: { color: 0xff5a4a, emissive: 0xff3a2a, emissiveIntensity: 1.5 },
  fruitRouge: { color: 0xc8322f, roughness: 0.5 }, fruitJaune: { color: 0xe8b830, roughness: 0.5 }, volet: { color: 0x2f6f8f, roughness: 0.8 },
  terre: { color: 0x9a5030, roughness: 0.9 }, plante: { color: 0x3f7a3a, roughness: 0.85 },
};

export function construireCarte(scene, qualite, idCarte = "nexus", options = {}) {
  const def = CARTES[idCarte] || CARTES.nexus;
  const heure = AMBIANCES[options.heure] ? options.heure : def.heure;
  const meteo = METEOS[options.meteo] ? options.meteo : "clair";
  const amb = AMBIANCES[heure];
  const L = def.limites;
  const monde = new Monde();
  const groupe = new THREE.Group();
  scene.add(groupe);
  const ombres = qualite !== "basse";
  const riche = qualite !== "basse";
  const sansRelief = qualite === "basse"; // sur PC modeste : pas de normal maps

  // ----- Matériaux créés à la demande (seules les textures utilisées sont générées) -----
  const mat = {};
  const echelles = {};
  const avecTexture = (nom, t, opts) => {
    mat[nom] = new THREE.MeshStandardMaterial({ map: t.map, normalMap: sansRelief ? null : t.normalMap, ...opts });
    echelles[nom] = t.echelle || 2;
  };
  function M(nom) {
    if (mat[nom]) return mat[nom];
    if (nom === "mur") avecTexture("mur", TX.textureBeton(qualite), { roughness: 0.92, metalness: 0.02, color: 0xe2e5ea });
    else if (nom === "sombre") { const t = TX.textureMetalSombre(qualite); mat.sombre = new THREE.MeshStandardMaterial({ map: t.map, roughness: 0.45, metalness: 0.75 }); echelles.sombre = 1; }
    else if (nom === "danger") { mat.danger = new THREE.MeshStandardMaterial({ map: TX.textureDanger().map, roughness: 0.6 }); echelles.danger = 1; }
    else if (COULEURS_METAL[nom]) avecTexture(nom, TX.textureMetal(COULEURS_METAL[nom], 40 + nom.length * 7, qualite), { roughness: 0.55, metalness: nom.startsWith("tole") ? 0.45 : 0.2 });
    else if (ENDUITS[nom]) avecTexture(nom, TX.textureEnduit(ENDUITS[nom][0], ENDUITS[nom][1], qualite), { roughness: 0.95 });
    else if (nom === "bois") avecTexture("bois", TX.textureBois(qualite), { roughness: 0.85 });
    else if (SIMPLES[nom]) mat[nom] = new THREE.MeshStandardMaterial(SIMPLES[nom]);
    else mat[nom] = new THREE.MeshStandardMaterial({ color: 0x888888 });
    return mat[nom];
  }

  const murs2D = [];
  const fixe = new Assemblage();
  const neons = new Assemblage();
  const deco = new Assemblage();

  // ----- Outils de construction offerts aux définitions de cartes -----
  function boite(cx, cz, l, p, h, type = "mur", y0 = 0, opts = {}) {
    M(type);
    fixe.ajouter(TX.uvMonde(new THREE.BoxGeometry(l, h, p), l, h, p, echelles[type] || 2), type, { p: [cx, y0 + h / 2, cz] });
    const b = monde.ajouter(cx - l / 2, y0, cz - p / 2, cx + l / 2, y0 + h, cz + p / 2, { type, ...opts });
    if (y0 < 0.5 && !opts.traversable) murs2D.push({ x: cx - l / 2, z: cz - p / 2, l, p, h: y0 + h });
    return b;
  }
  function mur(cx, cz, l, p, h, neon = null, type = "mur") {
    boite(cx, cz, l, p, h, type);
    M("sombre");
    fixe.ajouter(new THREE.BoxGeometry(l + 0.08, 0.14, p + 0.08), "sombre", { p: [cx, h + 0.07, cz] });
    fixe.ajouter(new THREE.BoxGeometry(l + 0.04, 0.22, p + 0.04), "sombre", { p: [cx, 0.11, cz] });
    if (neon) {
      const horiz = l > p;
      if (!mat["n" + neon]) mat["n" + neon] = new THREE.MeshStandardMaterial({ color: neon, emissive: neon, emissiveIntensity: 0.9 });
      neons.ajouter(new THREE.BoxGeometry(horiz ? l - 0.2 : l + 0.06, 0.03, horiz ? p + 0.06 : p - 0.2), "n" + neon, { p: [cx, h - 0.35, cz] });
    }
  }
  function caisse(cx, cz, l, p, h, type = "orange", y0 = 0) {
    boite(cx, cz, l, p, h, type, y0);
    const geo = new THREE.BoxGeometry(0.08, h, 0.08);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) fixe.ajouter(geo, "sombre", { p: [cx + sx * (l / 2 - 0.03), y0 + h / 2, cz + sz * (p / 2 - 0.03)] });
  }
  function baril(cx, cz) {
    M("bleu");
    fixe.ajouter(new THREE.CylinderGeometry(0.55, 0.55, 1.05, 20), "bleu", { p: [cx, 0.525, cz] });
    for (const y of [0.25, 0.8]) fixe.ajouter(new THREE.TorusGeometry(0.555, 0.025, 6, 24).rotateX(Math.PI / 2), "sombre", { p: [cx, y, cz] });
    monde.ajouter(cx - 0.55, 0, cz - 0.55, cx + 0.55, 1.05, cz + 0.55, { type: "baril" });
    murs2D.push({ x: cx - 0.55, z: cz - 0.55, l: 1.1, p: 1.1, h: 1.05 });
  }
  function peinture(texte, couleur, x, y, z, rotY, taille, auSol = false) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(taille, taille),
      new THREE.MeshStandardMaterial({ map: TX.texturePeinture(texte, couleur), transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
    );
    m.position.set(x, y, z);
    if (auSol) m.rotation.x = -Math.PI / 2;
    m.rotation.y = rotY;
    groupe.add(m);
  }
  let nbLampes = 0;
  function lampe(x, y, z, couleur, rotY = 0) {
    const tube = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.08).rotateY(rotY), new THREE.MeshBasicMaterial({ color: couleur }));
    tube.position.set(x, y, z);
    groupe.add(tube);
    // Peu de lumières dynamiques : chacune coûte sur chaque pixel éclairé.
    if (riche && nbLampes < 4) {
      nbLampes++;
      const l = new THREE.PointLight(couleur, heure === "nuit" ? 9 : 4, heure === "nuit" ? 14 : 10, 1.6);
      const decalX = Math.abs(rotY) > 0.1 ? (rotY > 0 ? 0.6 : -0.6) : 0;
      l.position.set(x + decalX, y - 0.3, z + (Math.abs(rotY) > 0.1 ? 0 : (z > 0 ? -0.6 : 0.6)));
      groupe.add(l);
    }
  }

  // ----- Sol -----
  const texSol = def.sol === "paves" ? TX.texturePaves(qualite) : def.sol === "industriel" ? TX.textureSolIndustriel(qualite) : TX.textureSol(qualite);
  const largeur = L.maxX - L.minX, profondeur = L.maxZ - L.minZ;
  const geoSol = new THREE.PlaneGeometry(largeur, profondeur);
  const uvs = geoSol.attributes.uv;
  for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getX(i) * largeur / texSol.echelle, uvs.getY(i) * profondeur / texSol.echelle);
  const matSol = new THREE.MeshStandardMaterial({ map: texSol.map, normalMap: sansRelief ? null : texSol.normalMap, roughness: meteo === "pluie" ? 0.22 : 0.6, metalness: meteo === "pluie" ? 0.35 : 0.08, color: def.sol === "paves" ? 0xe8e2d8 : 0xd4d8de });
  const plancher = new THREE.Mesh(geoSol, matSol);
  plancher.rotation.x = -Math.PI / 2;
  plancher.position.set((L.minX + L.maxX) / 2, 0, (L.minZ + L.maxZ) / 2);
  plancher.receiveShadow = ombres;
  groupe.add(plancher);

  // ----- Géométrie de la carte -----
  M("mur"); M("sombre");
  const api = { boite, mur, caisse, baril, peinture, lampe, M };
  def.construire(api);
  if (def.decor) {
    for (const k of ["sombre", "bois", "pierre", "jaune", "blanc", "verre", "cable", "lampe", "ampoule", "fruitRouge", "fruitJaune", "volet", "terre", "plante", "carton", "caoutchouc"]) M(k);
    def.decor({ A: deco, mats: mat, groupe, monde, riche });
  }

  // ----- Barrière de départ des attaquants -----
  let barriere = { activer() {} };
  if (def.barriere !== null && def.barriere !== undefined) {
    const zb = def.barriere;
    const matBarriere = new THREE.MeshBasicMaterial({ color: 0x3fa8ff, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide });
    const barriereMesh = new THREE.Mesh(new THREE.PlaneGeometry(largeur, 7), matBarriere);
    barriereMesh.position.set((L.minX + L.maxX) / 2, 3.5, zb);
    groupe.add(barriereMesh);
    const grille = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.PlaneGeometry(largeur, 7, Math.round(largeur), 7)), new THREE.LineBasicMaterial({ color: 0x7cc4ff, transparent: true, opacity: 0.13 }));
    grille.position.copy(barriereMesh.position);
    groupe.add(grille);
    const barriereBoite = monde.ajouter(L.minX, 0, zb - 0.1, L.maxX, 7, zb + 0.1, { type: "barriere", traversable: true });
    M("danger");
    fixe.ajouter(TX.uvMonde(new THREE.BoxGeometry(largeur, 0.04, 0.5), largeur, 0.04, 0.5, 1), "danger", { p: [(L.minX + L.maxX) / 2, 0.02, zb] });
    barriere = {
      activer(oui) {
        barriereBoite.traversable = !oui;
        barriereMesh.visible = grille.visible = oui;
      },
    };
  }

  groupe.add(fixe.construire(mat, ombres));
  groupe.add(neons.construire(mat, false));
  groupe.add(deco.construire(mat, ombres));

  // ----- Lumières -----
  const nuages = meteo === "pluie" ? 0.45 : meteo === "brouillard" ? 0.6 : 1;
  const hemi = new THREE.HemisphereLight(amb.hemi.ciel, amb.hemi.sol, amb.hemi.intensite * (meteo === "clair" ? 1 : 1.05) * (sansRelief ? 1.45 : 1));
  scene.add(hemi);
  const soleil = new THREE.DirectionalLight(amb.soleil.couleur, amb.soleil.intensite * nuages);
  soleil.position.set(...amb.soleil.pos);
  soleil.castShadow = ombres;
  if (ombres) {
    const taille = qualite === "haute" ? 4096 : 2048;
    soleil.shadow.mapSize.set(taille, taille);
    const demi = Math.max(largeur, profondeur) / 2 + 6;
    Object.assign(soleil.shadow.camera, { left: -demi, right: demi, top: demi, bottom: -demi, near: 1, far: 140 });
    soleil.shadow.bias = -0.0004;
    soleil.shadow.normalBias = 0.03;
    soleil.target.position.set((L.minX + L.maxX) / 2, 0, (L.minZ + L.maxZ) / 2);
    soleil.position.add(soleil.target.position);
  }
  scene.add(soleil);
  scene.add(soleil.target);

  // ----- Ciel -----
  const c = amb.ciel;
  const gris = meteo === "pluie" ? 0.75 : meteo === "brouillard" ? 0.55 : 0;
  const ciel = new THREE.Mesh(
    new THREE.SphereGeometry(450, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        soleilDir: { value: new THREE.Vector3(...amb.soleil.pos).normalize() },
        zenith: { value: new THREE.Vector3(...c.zenith) }, milieu: { value: new THREE.Vector3(...c.milieu) },
        horizon: { value: new THREE.Vector3(...c.horizon) }, halo: { value: new THREE.Vector3(...c.halo) },
        etoiles: { value: c.etoiles }, gris: { value: gris },
      },
      vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `
        varying vec3 vDir; uniform vec3 soleilDir, zenith, milieu, horizon, halo; uniform float etoiles, gris;
        float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        void main(){
          vec3 d = normalize(vDir);
          float h = clamp(d.y, -0.1, 1.0);
          vec3 col = mix(horizon, milieu, smoothstep(0.0, 0.2, h));
          col = mix(col, zenith, smoothstep(0.2, 0.75, h));
          float s = max(dot(d, normalize(soleilDir)), 0.0);
          col += halo * (pow(s, 600.0) * 3.0 + pow(s, 12.0) * 0.25) * (1.0 - gris);
          if (etoiles > 0.0) { float e = hash(floor(d * 300.0)); col += vec3(step(0.997, e) * (0.6 + e * 0.4)) * smoothstep(0.05, 0.4, h); }
          vec3 couvert = vec3(dot(col, vec3(0.3, 0.5, 0.2))) * 0.85 + 0.08;
          gl_FragColor = vec4(mix(col, couvert, gris), 1.0);
        }`,
    })
  );
  ciel.position.set((L.minX + L.maxX) / 2, 0, (L.minZ + L.maxZ) / 2);
  scene.add(ciel);
  const coulBrouillard = new THREE.Color(amb.brouillard.couleur);
  if (meteo === "pluie") coulBrouillard.lerp(new THREE.Color(0x8890a0), heure === "nuit" ? 0.1 : 0.6);
  scene.fog = meteo === "brouillard"
    ? new THREE.Fog(coulBrouillard.clone().lerp(new THREE.Color(0xd0d4da), heure === "nuit" ? 0.05 : 0.5), 6, 62)
    : new THREE.Fog(coulBrouillard, meteo === "pluie" ? 25 : amb.brouillard.pres, meteo === "pluie" ? 150 : amb.brouillard.loin);

  // ----- Ville au loin -----
  if (def.ville) {
    const facades = [TX.textureFacade(81), TX.textureFacade(82), TX.textureFacade(83)];
    const ville = new Assemblage();
    const matsVille = facades.map((t) => new THREE.MeshStandardMaterial({ color: amb.facade, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: amb.fenetres, roughness: 0.9 }));
    const rng = (() => { let s = 99; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    const nb = qualite === "basse" ? 28 : 46;
    for (let k = 0; k < nb; k++) {
      const a = (k / nb) * Math.PI * 2 + rng() * 0.08;
      const d = 75 + rng() * 70;
      const l = 10 + rng() * 16, h = 18 + rng() * 60;
      const g = new THREE.BoxGeometry(l, h, l);
      const u = g.attributes.uv;
      for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * l / 20, u.getY(i) * h / 40);
      ville.ajouter(g, k % 3, { p: [Math.cos(a) * d * 1.25 + (L.minX + L.maxX) / 2, h / 2 - 1, Math.sin(a) * d + (L.minZ + L.maxZ) / 2], r: [0, -a, 0] });
    }
    groupe.add(ville.construire(matsVille, false));
  }

  // ----- Habillage commun (+ spécifique à Nexus) -----
  M("gris");
  decorer({ groupe, monde, mat, qualite, ombres, nexus: def.id === "nexus" });

  // ----- Pluie : traits recyclés autour de la caméra -----
  let pluie = null;
  if (meteo === "pluie") {
    const n = qualite === "basse" ? 700 : 1600;
    const pos = new Float32Array(n * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const lignes = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: heure === "nuit" ? 0x7f8faa : 0xb8c4d4, transparent: true, opacity: 0.45, depthWrite: false }));
    lignes.frustumCulled = false;
    scene.add(lignes);
    const gouttes = [];
    for (let i = 0; i < n; i++) gouttes.push({ x: (Math.random() - 0.5) * 30, y: Math.random() * 14, z: (Math.random() - 0.5) * 30 });
    pluie = { lignes, gouttes, pos };
  }

  // ----- PC modeste : matériaux Lambert (éclairage bien moins coûteux, mêmes textures) -----
  if (sansRelief) simplifierMateriaux(groupe);

  // ----- Agrandissement : la carte est dessinée à l'échelle 1 puis élargie (hauteurs inchangées) -----
  const K = def.echelle || 1;
  const Lk = { minX: L.minX * K, maxX: L.maxX * K, minZ: L.minZ * K, maxZ: L.maxZ * K };
  const zone = (zo) => zo && { ...zo, minX: zo.minX * K, maxX: zo.maxX * K, minZ: zo.minZ * K, maxZ: zo.maxZ * K, ...(zo.x !== undefined ? { x: zo.x * K, z: zo.z * K } : {}) };
  const point = (pt) => ({ ...pt, x: pt.x * K, z: pt.z * K, ...(pt.vise ? { vise: { x: pt.vise.x * K, z: pt.vise.z * K } } : {}) });
  if (K !== 1) {
    groupe.scale.set(K, 1, K);
    for (const b of monde.boites) { b.minX *= K; b.maxX *= K; b.minZ *= K; b.maxZ *= K; }
    for (const m of murs2D) { m.x *= K; m.z *= K; m.l *= K; m.p *= K; }
    ciel.position.x *= K; ciel.position.z *= K;
    if (ombres) {
      soleil.target.position.x *= K; soleil.target.position.z *= K;
      soleil.position.set(...amb.soleil.pos).add(soleil.target.position);
      const cam = soleil.shadow.camera;
      cam.left *= K; cam.right *= K; cam.top *= K; cam.bottom *= K;
      cam.updateProjectionMatrix();
    }
  }
  const sites = Object.fromEntries(Object.entries(def.sites).map(([n, z]) => [n, zone(z)]));
  const postes = def.postes.map(point);
  const apresPose = Object.fromEntries(Object.entries(def.apresPose || {}).map(([n, l]) => [n, l.map(point)]));
  const rassemblement = Object.fromEntries(Object.entries(def.rassemblement || {}).map(([n, pt]) => [n, point(pt)]));
  const departAttaque = zone(def.departAttaque), departDefense = zone(def.departDefense);

  // ----- Navigation des bots -----
  const nav = new GrilleNav(monde, Lk.minX, Lk.maxX, Lk.minZ, Lk.maxZ, 0.5, 0.45);

  function pointDans(zone) {
    return nav.aleatoire(Math.random, zone) || { x: (zone.minX + zone.maxX) / 2, z: (zone.minZ + zone.maxZ) / 2 };
  }

  const ajouts = [groupe, hemi, soleil, soleil.target, ciel];
  if (pluie) ajouts.push(pluie.lignes);

  return {
    // Retire la carte de la scène et libère la mémoire (changement de carte)
    detruire() {
      for (const o of ajouts) {
        scene.remove(o);
        o.traverse((m) => {
          if (m.geometry) m.geometry.dispose();
          const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
          for (const x of mats) { for (const k of ["map", "normalMap", "roughnessMap", "emissiveMap"]) if (x[k]) x[k].dispose(); x.dispose(); }
        });
      }
      if (soleil.shadow && soleil.shadow.map) soleil.shadow.map.dispose();
      scene.fog = null;
    },
    def, id: def.id, nom: def.nom, limites: Lk, monde, nav, barriere, murs2D, soleil, ciel,
    postes, sites, apresPose, rassemblement,
    zoneDepartBots: departDefense, zoneDepartAttaque: departAttaque,
    ambiance: { heure, meteo, exposition: amb.exposition, env: amb.env, torche: amb.torche },
    departJoueur(camp = "attaque") { return pointDans(camp === "attaque" ? departAttaque : departDefense); },
    pointDans,
    // Point libre loin d'une position (réapparition en deathmatch)
    pointLibreLoinDe(x, z, distMin = 14) {
      for (let k = 0; k < 60; k++) {
        const p = nav.aleatoire(Math.random, { minX: Lk.minX + 1, maxX: Lk.maxX - 1, minZ: Lk.minZ + 1, maxZ: Lk.maxZ - 1 });
        if (p && Math.hypot(p.x - x, p.z - z) > distMin) return p;
      }
      return pointDans(departDefense);
    },
    majAmbiance(dt, camera) {
      if (!pluie) return;
      const { gouttes, pos } = pluie;
      const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
      for (let i = 0; i < gouttes.length; i++) {
        const g = gouttes[i];
        g.y -= 16 * dt;
        if (g.y < 0) { g.y = 10 + Math.random() * 4; g.x = (Math.random() - 0.5) * 30; g.z = (Math.random() - 0.5) * 30; }
        const x = cx + g.x, y = cy - 3 + g.y, z = cz + g.z;
        pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z;
        pos[i * 6 + 3] = x + 0.03; pos[i * 6 + 4] = y + 0.45; pos[i * 6 + 5] = z + 0.02;
      }
      pluie.lignes.geometry.attributes.position.needsUpdate = true;
    },
  };
}

// Remplace les matériaux PBR par des matériaux Lambert équivalents (rendu bien plus léger).
const CHAMPS = ["color", "map", "emissive", "emissiveMap", "emissiveIntensity", "transparent", "opacity", "side", "depthWrite", "polygonOffset", "polygonOffsetFactor", "vertexColors", "alphaTest"];
function simplifierMateriaux(racine) {
  const cache = new Map();
  racine.traverse((o) => {
    if (!o.isMesh || !o.material || !o.material.isMeshStandardMaterial) return;
    const m = o.material;
    if (!cache.has(m)) {
      const l = new THREE.MeshLambertMaterial();
      for (const k of CHAMPS) if (m[k] !== undefined) l[k] = m[k] && m[k].clone && !m[k].isTexture ? m[k].clone() : m[k];
      // Un peu de brillance perdue : on éclaircit légèrement les métaux
      if (m.metalness > 0.5) l.color.multiplyScalar(1.25);
      cache.set(m, l);
      m.dispose();
    }
    o.material = cache.get(m);
  });
}
