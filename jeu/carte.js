// La carte "Nexus" : deux sites (A à droite, B à gauche), un milieu, des couloirs et des couvertures.
// Axe X : gauche/droite. Axe Z : le joueur part en Z positif, les bots défendent en Z négatif.
import * as THREE from "three";
import { Monde, GrilleNav } from "./physique.js";
import { textureBeton, textureSol, textureMetal, textureMetalSombre, textureDanger, textureFacade, texturePeinture, uvMonde } from "./textures.js";

export const LIMITES = { minX: -32, maxX: 32, minZ: -22, maxZ: 22 };

export function construireCarte(scene, qualite) {
  const monde = new Monde();
  const groupe = new THREE.Group();
  scene.add(groupe);
  const ombres = qualite !== "basse";

  // ----- Matériaux -----
  const beton = textureBeton(qualite);
  const sol = textureSol(qualite);
  const sombre = textureMetalSombre(qualite);
  const danger = textureDanger();
  const mat = {
    mur: new THREE.MeshStandardMaterial({ map: beton.map, normalMap: beton.normalMap, roughness: 0.92, metalness: 0.02, color: 0xd8dce4 }),
    sol: new THREE.MeshStandardMaterial({ map: sol.map, normalMap: sol.normalMap, roughness: 0.55, metalness: 0.08, color: 0xc9cdd6 }),
    sombre: new THREE.MeshStandardMaterial({ map: sombre.map, roughness: 0.45, metalness: 0.75 }),
    danger: new THREE.MeshStandardMaterial({ map: danger.map, roughness: 0.6 }),
  };
  const echelles = { mur: beton.echelle, sol: sol.echelle, sombre: 1, danger: 1 };
  const metaux = {
    orange: textureMetal("#c8642a", 41, qualite),
    bleu: textureMetal("#2d5d8a", 51, qualite),
    gris: textureMetal("#6b7380", 61, qualite),
    vert: textureMetal("#3f6b4c", 71, qualite),
  };
  for (const [nom, t] of Object.entries(metaux)) {
    mat[nom] = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 0.55, metalness: 0.2 });
    echelles[nom] = t.echelle;
  }

  const murs2D = []; // pour la minimap

  function boite(cx, cz, l, p, h, type = "mur", y0 = 0, options = {}) {
    const geo = uvMonde(new THREE.BoxGeometry(l, h, p), l, h, p, echelles[type] || 2);
    const m = new THREE.Mesh(geo, mat[type]);
    m.position.set(cx, y0 + h / 2, cz);
    m.castShadow = ombres;
    m.receiveShadow = ombres;
    groupe.add(m);
    const b = monde.ajouter(cx - l / 2, y0, cz - p / 2, cx + l / 2, y0 + h, cz + p / 2, { type, mesh: m, ...options });
    if (y0 < 0.5 && !options.traversable) murs2D.push({ x: cx - l / 2, z: cz - p / 2, l, p, h: y0 + h });
    return b;
  }

  // Mur avec rebord métallique et éventuellement un néon.
  function mur(cx, cz, l, p, h, neon = null) {
    boite(cx, cz, l, p, h, "mur");
    const rebord = new THREE.Mesh(new THREE.BoxGeometry(l + 0.08, 0.14, p + 0.08), mat.sombre);
    rebord.position.set(cx, h + 0.07, cz);
    rebord.castShadow = ombres;
    groupe.add(rebord);
    const plinthe = new THREE.Mesh(new THREE.BoxGeometry(l + 0.04, 0.22, p + 0.04), mat.sombre);
    plinthe.position.set(cx, 0.11, cz);
    groupe.add(plinthe);
    if (neon) {
      const horiz = l > p;
      const n = new THREE.Mesh(
        new THREE.BoxGeometry(horiz ? l - 0.2 : p + 0.1, 0.05, horiz ? p + 0.1 : l - 0.2).rotateY(horiz ? 0 : Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: neon })
      );
      n.position.set(cx, h - 0.35, cz);
      groupe.add(n);
    }
  }

  function caisse(cx, cz, l, p, h, couleur = "orange", y0 = 0) {
    boite(cx, cz, l, p, h, couleur, y0);
    // Cornières sombres sur les arêtes verticales
    const geo = new THREE.BoxGeometry(0.08, h, 0.08);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const c = new THREE.Mesh(geo, mat.sombre);
      c.position.set(cx + sx * (l / 2 - 0.03), y0 + h / 2, cz + sz * (p / 2 - 0.03));
      groupe.add(c);
    }
  }

  function baril(cx, cz) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.05, 20), mat.bleu);
    m.position.set(cx, 0.525, cz);
    m.castShadow = m.receiveShadow = ombres;
    groupe.add(m);
    for (const y of [0.25, 0.8]) {
      const cercle = new THREE.Mesh(new THREE.TorusGeometry(0.555, 0.025, 6, 24).rotateX(Math.PI / 2), mat.sombre);
      cercle.position.set(cx, y, cz);
      groupe.add(cercle);
    }
    monde.ajouter(cx - 0.55, 0, cz - 0.55, cx + 0.55, 1.05, cz + 0.55, { type: "baril", mesh: m });
    murs2D.push({ x: cx - 0.55, z: cz - 0.55, l: 1.1, p: 1.1, h: 1.05 });
  }

  // ----- Sol -----
  const geoSol = new THREE.PlaneGeometry(64, 44);
  const uv = geoSol.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 64 / sol.echelle, uv.getY(i) * 44 / sol.echelle);
  const plancher = new THREE.Mesh(geoSol, mat.sol);
  plancher.rotation.x = -Math.PI / 2;
  plancher.receiveShadow = ombres;
  groupe.add(plancher);

  // ----- Murs extérieurs -----
  mur(0, -22.5, 66, 1, 7);
  mur(0, 22.5, 66, 1, 7);
  mur(-32.5, 0, 1, 44, 7);
  mur(32.5, 0, 1, 44, 7);

  // ----- Séparations des couloirs (ouvertes au centre pour les rotations) -----
  mur(-11, -7.25, 1, 10.5, 4.5, 0xff4f8a);
  mur(-11, 7.25, 1, 10.5, 4.5, 0xff4f8a);
  mur(11, -7.25, 1, 10.5, 4.5, 0x3fa8ff);
  mur(11, 7.25, 1, 10.5, 4.5, 0x3fa8ff);

  // ----- Entrées côté attaque : A main, mid, B main -----
  mur(14.75, 11, 6.5, 1, 4.5, 0x3fa8ff);
  mur(27, 11, 10, 1, 4.5, 0x3fa8ff);
  mur(-14.75, 11, 6.5, 1, 4.5, 0xff4f8a);
  mur(-27, 11, 10, 1, 4.5, 0xff4f8a);
  mur(-7, 11, 7, 1, 4.5);
  mur(7, 11, 7, 1, 4.5);

  // ----- Fond côté défense -----
  mur(13.75, -13, 4.5, 1, 4.5);
  mur(28, -13, 8, 1, 4.5);
  mur(-13.75, -13, 4.5, 1, 4.5);
  mur(-28, -13, 8, 1, 4.5);
  mur(-7.5, -13, 6, 1, 4.5);
  mur(7.5, -13, 6, 1, 4.5);

  // ----- Site A -----
  caisse(25, -3, 2.6, 6, 2.6, "orange");
  caisse(18, -6, 2, 2, 1.1, "gris");
  caisse(18.3, -6.2, 1.3, 1.3, 1.1, "gris", 1.1);
  caisse(14.5, 4.2, 2, 2, 1.2, "vert");
  caisse(28.5, 6.5, 3, 2, 1.5, "bleu");
  caisse(15.5, -10.5, 2, 2, 1.2, "orange");
  baril(21, 2.5);
  baril(22.2, 3.1);

  // ----- Site B -----
  caisse(-24, -4, 6, 2.6, 2.6, "bleu");
  caisse(-17, -7, 2, 2, 1.2, "gris");
  caisse(-17.2, -7.1, 1.4, 1.4, 1.2, "gris", 1.2);
  caisse(-14.5, 5, 2, 3, 1.4, "orange");
  caisse(-28, 5, 2, 2, 1.2, "vert");
  caisse(-27, -10.5, 3, 2, 2, "orange");
  baril(-20, 3);
  baril(-21.2, 2.3);

  // ----- Milieu -----
  caisse(0, 0, 3, 3, 2.4, "gris");
  caisse(-4.5, 5, 2, 2, 1.2, "orange");
  caisse(5, -4, 2, 2, 1.2, "vert");
  baril(3.5, 6.5);
  boite(-6, -7.5, 4, 0.8, 2.2, "mur");

  // ----- Zones de départ -----
  caisse(-6, 16, 2, 2, 1.2, "gris");
  caisse(7, 17, 2, 2, 1.2, "bleu");
  caisse(-8, -17, 2, 2, 1.2, "gris");
  caisse(9, -16.5, 3, 2, 2, "orange");
  boite(0, -18.5, 4, 1, 1.5, "mur");

  // ----- Barrière de départ (disparaît quand la manche commence) -----
  const matBarriere = new THREE.MeshBasicMaterial({ color: 0x3fa8ff, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide });
  const barriereMesh = new THREE.Mesh(new THREE.PlaneGeometry(64, 7, 64, 7), matBarriere);
  barriereMesh.position.set(0, 3.5, 12.6);
  groupe.add(barriereMesh);
  const grille = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.PlaneGeometry(64, 7, 64, 7)),
    new THREE.LineBasicMaterial({ color: 0x7cc4ff, transparent: true, opacity: 0.13 })
  );
  grille.position.copy(barriereMesh.position);
  groupe.add(grille);
  // Traversable pendant la construction de la grille de navigation (les bots peuvent aller partout).
  const barriereBoite = monde.ajouter(-32, 0, 12.5, 32, 7, 12.7, { type: "barriere", traversable: true });
  const bandeDanger = new THREE.Mesh(uvMonde(new THREE.BoxGeometry(64, 0.04, 0.5), 64, 0.04, 0.5, 1), mat.danger);
  bandeDanger.position.set(0, 0.02, 12.6);
  groupe.add(bandeDanger);

  const barriere = {
    activer(oui) {
      barriereBoite.traversable = !oui;
      barriereMesh.visible = grille.visible = oui;
      matBarriere.opacity = 0.07;
    },
  };

  // ----- Peintures (lettres des sites, flèches) -----
  function peinture(texte, couleur, x, y, z, rotY, taille, auSol = false) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(taille, taille),
      new THREE.MeshStandardMaterial({ map: texturePeinture(texte, couleur), transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
    );
    m.position.set(x, y, z);
    if (auSol) m.rotation.x = -Math.PI / 2;
    m.rotation.y = rotY;
    groupe.add(m);
  }
  peinture("A", "#3fa8ff", 22, 0.02, -2, 0, 6, true);
  peinture("B", "#ff4f8a", -21, 0.02, -1, 0, 6, true);
  peinture("A", "#3fa8ff", 31.99, 3, -2, -Math.PI / 2, 3.2);
  peinture("B", "#ff4f8a", -31.99, 3, -1, Math.PI / 2, 3.2);
  peinture("A ►", "#3fa8ff", 7, 2.6, 11.51, 0, 3.2);
  peinture("◄ B", "#ff4f8a", -7, 2.6, 11.51, 0, 3.2);
  peinture("MID", "#9aa6b8", 0, 3.4, -21.99, 0, 4);

  // ----- Lumières -----
  const hemi = new THREE.HemisphereLight(0xa8c4ff, 0x3a2c24, 0.75);
  scene.add(hemi);
  const soleil = new THREE.DirectionalLight(0xffd3a8, 2.6);
  soleil.position.set(-26, 30, 18);
  soleil.castShadow = ombres;
  if (ombres) {
    soleil.shadow.mapSize.set(qualite === "haute" ? 4096 : 2048, qualite === "haute" ? 4096 : 2048);
    Object.assign(soleil.shadow.camera, { left: -38, right: 38, top: 30, bottom: -30, near: 1, far: 100 });
    soleil.shadow.bias = -0.0004;
    soleil.shadow.normalBias = 0.03;
  }
  scene.add(soleil);
  scene.add(soleil.target);

  // Lampes murales néon (lumières colorées locales)
  const lampes = [
    [22, 3.6, -12.4, 0x3fa8ff], [-22, 3.6, -12.4, 0xff4f8a], [7, 3.6, 10.4, 0xffb15c], [0, 5.2, -21.9, 0xe8e8f0],
  ];
  for (const [x, y, z, c] of lampes) {
    const tube = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: c }));
    tube.position.set(x, y, z);
    groupe.add(tube);
    if (qualite !== "basse") {
      const l = new THREE.PointLight(c, 4, 10, 1.6);
      l.position.set(x, y - 0.3, z + (z > 0 ? -0.6 : 0.6));
      groupe.add(l);
    }
  }

  // ----- Ciel du soir -----
  const ciel = new THREE.Mesh(
    new THREE.SphereGeometry(450, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { soleilDir: { value: soleil.position.clone().normalize() } },
      vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `
        varying vec3 vDir; uniform vec3 soleilDir;
        void main(){
          float h = clamp(vDir.y, -0.1, 1.0);
          vec3 zenith = vec3(0.04, 0.07, 0.17);
          vec3 milieu = vec3(0.20, 0.24, 0.45);
          vec3 horizon = vec3(0.98, 0.55, 0.38);
          vec3 c = mix(horizon, milieu, smoothstep(0.0, 0.18, h));
          c = mix(c, zenith, smoothstep(0.18, 0.7, h));
          float s = max(dot(normalize(vDir), normalize(soleilDir)), 0.0);
          c += vec3(1.0, 0.7, 0.45) * pow(s, 64.0) * 1.2 + vec3(1.0, 0.5, 0.3) * pow(s, 6.0) * 0.25;
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
  );
  scene.add(ciel);
  scene.fog = new THREE.Fog(0x433e5c, 70, 230);

  // ----- Immeubles lointains -----
  const facades = [textureFacade(81), textureFacade(82), textureFacade(83)];
  const rngVille = (() => { let s = 99; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (let k = 0; k < 46; k++) {
    const a = (k / 46) * Math.PI * 2 + rngVille() * 0.08;
    const d = 75 + rngVille() * 70;
    const l = 10 + rngVille() * 16, h = 18 + rngVille() * 60;
    const t = facades[k % 3].clone();
    t.needsUpdate = true;
    t.repeat.set(l / 20, h / 40);
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(l, h, l),
      new THREE.MeshStandardMaterial({ color: 0x0a0d18, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.9, roughness: 1 })
    );
    b.position.set(Math.cos(a) * d * 1.25, h / 2 - 1, Math.sin(a) * d);
    b.rotation.y = -a;
    groupe.add(b);
  }

  // ----- Points d'apparition et postes de défense des bots -----
  const nav = new GrilleNav(monde, LIMITES.minX, LIMITES.maxX, LIMITES.minZ, LIMITES.maxZ, 0.5, 0.45);

  const postes = [
    { x: 16.5, z: -2.5, vise: { x: 20, z: 11 }, zone: "A" },
    { x: 27.8, z: 1.8, vise: { x: 20, z: 11 }, zone: "A" },
    { x: 23.5, z: -9.5, vise: { x: 12, z: 0 }, zone: "A" },
    { x: -16, z: -2.5, vise: { x: -20, z: 11 }, zone: "B" },
    { x: -28.5, z: 1.5, vise: { x: -20, z: 11 }, zone: "B" },
    { x: -21.5, z: -9.5, vise: { x: -12, z: 0 }, zone: "B" },
    { x: 0.5, z: -4, vise: { x: 0, z: 11 }, zone: "MID" },
    { x: -6, z: -9.5, vise: { x: -2, z: 11 }, zone: "MID" },
    { x: 6.5, z: -10, vise: { x: 6, z: 11 }, zone: "MID" },
  ];

  return {
    monde, nav, barriere, postes, murs2D, soleil,
    zoneDepartBots: { minX: -11, maxX: 11, minZ: -21, maxZ: -14 },
    departJoueur() {
      const p = nav.aleatoire(Math.random, { minX: -4, maxX: 4, minZ: 18, maxZ: 20.5 });
      return p || { x: 0, z: 19 };
    },
  };
}
