// Outils de modelage : volumes arrondis, profils extrudés biseautés, membres effilés,
// fusion des pièces par matériau (moins d'appels de rendu) et cinématique inverse à deux os.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Boîte aux arêtes arrondies.
export function boiteRonde(l, h, p, rayon = 0.01, segments = 2) {
  return new RoundedBoxGeometry(l, h, p, segments, Math.min(rayon, l / 2.01, h / 2.01, p / 2.01));
}

// Profil 2D (points [avant, haut] en mètres) extrudé sur une épaisseur, avec biseau.
// Le profil est dessiné vu de côté : x = vers l'avant (sera -Z), y = vers le haut.
export function profil(points, epaisseur, biseau = 0.002, trous = []) {
  const forme = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const t of trous) forme.holes.push(new THREE.Path(t.map(([x, y]) => new THREE.Vector2(x, y))));
  const geo = new THREE.ExtrudeGeometry(forme, {
    depth: Math.max(0.0005, epaisseur - biseau * 2), bevelEnabled: biseau > 0, bevelThickness: biseau, bevelSize: biseau, bevelSegments: 1, curveSegments: 6,
  });
  geo.translate(0, 0, -(epaisseur - biseau * 2) / 2);
  geo.rotateY(Math.PI / 2); // x du profil -> -Z (vers l'avant), épaisseur -> X
  return geo;
}

// Membre effilé (cuisse, bras...) dirigé vers -Y depuis l'origine, extrémités arrondies.
export function membre(r1, r2, longueur, segments = 12) {
  const pts = [];
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI / 2;
    pts.push(new THREE.Vector2(Math.sin(a) * r1, Math.cos(a) * r1 * 0.6));
  }
  pts.push(new THREE.Vector2(r1 * 1.02, -longueur * 0.25));
  pts.push(new THREE.Vector2((r1 + r2) / 2, -longueur * 0.6));
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI / 2;
    pts.push(new THREE.Vector2(Math.cos(a) * r2, -longueur - Math.sin(a) * r2 * 0.6));
  }
  pts.reverse();
  return new THREE.LatheGeometry(pts, segments);
}

// Forme de révolution générique à partir de [rayon, y].
export function revolution(points, segments = 16) {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments);
}

// Collecte des pièces puis fusion : une seule géométrie (donc un seul appel de rendu) par matériau.
export class Assemblage {
  constructor() { this.pieces = new Map(); }

  // transform : { p: [x,y,z], r: [rx,ry,rz], s: [sx,sy,sz] | nombre }
  ajouter(geo, cleMateriau, t = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(t.r || [0, 0, 0])));
    const s = typeof t.s === "number" ? [t.s, t.s, t.s] : t.s || [1, 1, 1];
    m.compose(new THREE.Vector3(...(t.p || [0, 0, 0])), q, new THREE.Vector3(...s));
    g.applyMatrix4(m);
    for (const nom of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(nom)) g.deleteAttribute(nom);
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.clearGroups();
    if (!this.pieces.has(cleMateriau)) this.pieces.set(cleMateriau, []);
    this.pieces.get(cleMateriau).push(g);
    return this;
  }

  // Rend les pièces brutes (géométries déjà placées) et vide l'assemblage.
  extraire() {
    const p = this.pieces;
    this.pieces = new Map();
    return p;
  }

  // Retourne un Group contenant un Mesh par matériau.
  construire(materiaux, ombres = true) {
    const groupe = new THREE.Group();
    for (const [cle, geos] of this.pieces) {
      const fusion = mergeGeometries(geos, false);
      for (const g of geos) g.dispose();
      const mesh = new THREE.Mesh(fusion, materiaux[cle]);
      mesh.castShadow = ombres;
      mesh.receiveShadow = ombres;
      groupe.add(mesh);
    }
    this.pieces.clear();
    return groupe;
  }
}

// ===== Cinématique inverse à deux os =====
// os1 et os2 ont leur axe de repos vers -Y. cible et pole sont exprimés dans l'espace du parent de os1.
const _d = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3(), _f = new THREE.Vector3();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _coude = new THREE.Vector3(), _bout = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

function base(dirOs, plan, q) {
  _y.copy(dirOs).negate();                        // l'os pointe vers -Y
  _z.copy(plan).addScaledVector(_y, -plan.dot(_y)).normalize();
  _x.crossVectors(_y, _z);
  _m.makeBasis(_x, _y, _z);
  return q.setFromRotationMatrix(_m);
}

export function ik2(os1, os2, l1, l2, cible, pole) {
  _d.subVectors(cible, os1.position);
  const dist = THREE.MathUtils.clamp(_d.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  _d.normalize();
  _w.subVectors(pole, os1.position);
  _w.addScaledVector(_d, -_w.dot(_d));
  if (_w.lengthSq() < 1e-8) _w.set(0, 0, 1).addScaledVector(_d, -_d.z);
  _w.normalize();
  const a = Math.acos(THREE.MathUtils.clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1));
  _u.copy(_d).multiplyScalar(Math.cos(a)).addScaledVector(_w, Math.sin(a));
  _coude.copy(os1.position).addScaledVector(_u, l1);
  _bout.copy(os1.position).addScaledVector(_d, dist);
  _f.subVectors(_bout, _coude).normalize();
  base(_u, _w, _q1);
  base(_f, _w, _q2);
  os1.quaternion.copy(_q1);
  os2.quaternion.copy(_q1).invert().multiply(_q2);
}

// Ressort amorti (sensation de recul, balancement) : x tend vers la cible.
export class Ressort {
  constructor(raideur = 180, amortissement = 18) {
    this.k = raideur; this.c = amortissement; this.x = 0; this.v = 0;
  }
  impulsion(v) { this.v += v; }
  maj(dt, cible = 0) {
    const a = -this.k * (this.x - cible) - this.c * this.v;
    this.v += a * dt;
    this.x += this.v * dt;
    return this.x;
  }
}
