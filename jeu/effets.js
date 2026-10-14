// Effets visuels avec réserves d'objets réutilisés (aucune création pendant le combat) :
// traçantes, étincelles, poussière d'impact, trous de balles, lumière de tir.
import * as THREE from "three";
import { textureEclat, textureTrou } from "./textures.js";

function textureFumee() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(200,200,200,0.55)");
  g.addColorStop(0.6, "rgba(170,170,170,0.18)");
  g.addColorStop(1, "rgba(150,150,150,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Effets {
  constructor(scene, qualite) {
    this.scene = scene;
    const n = qualite === "basse" ? 0.5 : 1;

    // Traçantes : segments réutilisés
    this.tracantes = [];
    for (let i = 0; i < 24; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
      const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const l = new THREE.Line(geo, mat);
      l.frustumCulled = false;
      l.visible = false;
      scene.add(l);
      this.tracantes.push({ obj: l, vie: 0 });
    }
    this.iTracante = 0;

    // Étincelles : un seul nuage de points partagé, particules recyclées
    this.maxEtincelles = Math.round(240 * n);
    const pos = new Float32Array(this.maxEtincelles * 3).fill(-1000);
    const col = new Float32Array(this.maxEtincelles * 3);
    this.geoEtincelles = new THREE.BufferGeometry();
    this.geoEtincelles.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.geoEtincelles.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(this.geoEtincelles, new THREE.PointsMaterial({ map: textureEclat(), size: 0.07, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    pts.frustumCulled = false;
    scene.add(pts);
    this.etincelles = Array.from({ length: this.maxEtincelles }, () => ({ vie: 0, max: 1, v: new THREE.Vector3(), c: new THREE.Color() }));
    this.iEtincelle = 0;

    // Poussière d'impact : sprites recyclés
    const matFumee = new THREE.SpriteMaterial({ map: textureFumee(), transparent: true, depthWrite: false, color: 0xb8b2a8 });
    this.fumees = [];
    for (let i = 0; i < Math.round(20 * n); i++) {
      const s = new THREE.Sprite(matFumee.clone());
      s.visible = false;
      scene.add(s);
      this.fumees.push({ obj: s, vie: 0, v: new THREE.Vector3() });
    }
    this.iFumee = 0;

    // Trous de balles : anneau de 90 décalcomanies
    const matTrou = new THREE.MeshBasicMaterial({ map: textureTrou(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    const geoTrou = new THREE.PlaneGeometry(0.11, 0.11);
    this.trous = [];
    for (let i = 0; i < 90; i++) {
      const m = new THREE.Mesh(geoTrou, matTrou);
      m.visible = false;
      m.matrixAutoUpdate = false;
      scene.add(m);
      this.trous.push(m);
    }
    this.iTrou = 0;

    this.lumiere = new THREE.PointLight(0xffc27a, 0, 9, 2);
    scene.add(this.lumiere);

    // Boule de feu de l'explosion du spike
    this.boule = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.boule.visible = false;
    scene.add(this.boule);
    this.bouleT = 1;
    this._a = new THREE.Vector3();

    // Effets des capacités : petites explosions, ondes au sol, colonnes d'apparition (réserves réutilisées)
    const geoBoule = new THREE.SphereGeometry(1, 16, 12);
    this.boules = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(geoBoule, new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      m.visible = false;
      scene.add(m);
      this.boules.push({ obj: m, t: 1, duree: 0.5, rayon: 1 });
    }
    const geoAnneau = new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2);
    this.anneaux = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(geoAnneau, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      m.visible = false;
      scene.add(m);
      this.anneaux.push({ obj: m, t: 1, duree: 0.6, rayon: 1 });
    }
    const geoColonne = new THREE.CylinderGeometry(0.55, 0.55, 3, 20, 1, true).translate(0, 1.5, 0);
    this.colonnes = [];
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(geoColonne, new THREE.MeshBasicMaterial({ color: 0x7cffd4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      m.visible = false;
      scene.add(m);
      this.colonnes.push({ obj: m, t: 1 });
    }
  }

  // Explosion d'une capacité (grenade, obus...) : boule de feu à la taille du rayon d'effet
  petiteExplosion(p, rayon = 4, couleur = 0xffa040) {
    const b = this.boules.find((x) => x.t >= 1) || this.boules[0];
    b.obj.position.set(p.x, p.y + 0.4, p.z);
    b.obj.material.color.setHex(couleur);
    b.obj.visible = true;
    b.t = 0; b.duree = 0.45; b.rayon = rayon * 0.75;
    this.lumiere.color.setHex(couleur);
    this.lumiere.position.set(p.x, p.y + 1, p.z);
    this.lumiere.intensity = 40;
    this.etincellesEn(p, { x: 0, y: 1.6, z: 0 }, couleur, 22);
    this.etincellesEn(p, { x: 0, y: 1.2, z: 0 }, 0xffe08a, 14);
  }

  // Onde circulaire au sol qui s'agrandit (sonar, commotion, IEM, séisme...)
  anneau(p, rayon, couleur = 0xffffff, duree = 0.6, hauteur = 0.06) {
    const a = this.anneaux.find((x) => x.t >= 1) || this.anneaux[0];
    a.obj.position.set(p.x, (p.y || 0) + hauteur, p.z);
    a.obj.material.color.setHex(couleur);
    a.obj.visible = true;
    a.t = 0; a.duree = duree; a.rayon = rayon;
    a.obj.scale.setScalar(0.2);
  }

  // Colonne de lumière (apparition, résurrection)
  apparition(p, couleur = 0x7cffd4) {
    const c = this.colonnes.find((x) => x.t >= 1) || this.colonnes[0];
    c.obj.position.set(p.x, p.y || 0, p.z);
    c.obj.material.color.setHex(couleur);
    c.obj.visible = true;
    c.t = 0;
    this.anneau(p, 1.6, couleur, 0.7);
  }

  tracante(a, b, couleur, vie = 0.06) {
    const t = this.tracantes[this.iTracante++ % this.tracantes.length];
    const p = t.obj.geometry.attributes.position;
    p.setXYZ(0, a.x, a.y, a.z);
    p.setXYZ(1, b.x, b.y, b.z);
    p.needsUpdate = true;
    t.obj.material.color.setHex(couleur);
    t.obj.material.opacity = 0.9;
    t.obj.visible = true;
    t.vie = t.max = vie;
  }

  etincellesEn(p, n, couleur, nombre = 9) {
    const pos = this.geoEtincelles.attributes.position, col = this.geoEtincelles.attributes.color;
    for (let k = 0; k < nombre; k++) {
      const i = this.iEtincelle++ % this.maxEtincelles;
      const e = this.etincelles[i];
      e.vie = e.max = 0.2 + Math.random() * 0.25;
      e.v.set(n.x + (Math.random() - 0.5) * 1.4, n.y + Math.random() * 1.1, n.z + (Math.random() - 0.5) * 1.4).multiplyScalar(2 + Math.random() * 3.5);
      e.c.setHex(couleur);
      pos.setXYZ(i, p.x, p.y, p.z);
      col.setXYZ(i, e.c.r, e.c.g, e.c.b);
    }
    pos.needsUpdate = col.needsUpdate = true;
  }

  poussiere(p, n) {
    const f = this.fumees[this.iFumee++ % this.fumees.length];
    f.obj.position.set(p.x + n.x * 0.05, p.y + n.y * 0.05, p.z + n.z * 0.05);
    f.v.set(n.x * 0.6, 0.25 + n.y * 0.4, n.z * 0.6);
    f.vie = 0.6;
    f.obj.scale.setScalar(0.15);
    f.obj.material.opacity = 0.7;
    f.obj.visible = true;
  }

  trou(p, n) {
    const m = this.trous[this.iTrou++ % this.trous.length];
    m.position.set(p.x + n.x * 0.004, p.y + n.y * 0.004, p.z + n.z * 0.004);
    this._a.set(p.x + n.x, p.y + n.y, p.z + n.z);
    m.lookAt(this._a);
    m.rotateZ(Math.random() * Math.PI);
    m.updateMatrix();
    m.visible = true;
  }

  flashTir(p, couleur = 0xffc27a) {
    this.lumiere.color.setHex(couleur);
    this.lumiere.position.copy(p);
    this.lumiere.intensity = 6;
  }

  explosion(p) {
    this.boule.position.set(p.x, p.y, p.z);
    this.boule.visible = true;
    this.bouleT = 0;
    this.lumiere.position.set(p.x, p.y + 2, p.z);
    this.lumiere.distance = 45;
    this.lumiere.intensity = 120;
    for (let i = 0; i < 4; i++) this.etincellesEn(p, { x: 0, y: 1.5, z: 0 }, i % 2 ? 0xffa040 : 0xffe08a, 40);
  }

  vider() {
    for (const m of this.trous) m.visible = false;
    this.boule.visible = false;
    for (const x of [...this.boules, ...this.anneaux, ...this.colonnes]) { x.t = 1; x.obj.visible = false; }
  }

  maj(dt) {
    for (const t of this.tracantes) {
      if (t.vie <= 0) continue;
      t.vie -= dt;
      t.obj.material.opacity = Math.max(0, t.vie / t.max) * 0.9;
      if (t.vie <= 0) t.obj.visible = false;
    }
    const pos = this.geoEtincelles.attributes.position, col = this.geoEtincelles.attributes.color;
    let actif = false;
    for (let i = 0; i < this.maxEtincelles; i++) {
      const e = this.etincelles[i];
      if (e.vie <= 0) continue;
      actif = true;
      e.vie -= dt;
      e.v.y -= 9.8 * dt;
      pos.setXYZ(i, pos.getX(i) + e.v.x * dt, pos.getY(i) + e.v.y * dt, pos.getZ(i) + e.v.z * dt);
      const k = Math.max(0, e.vie / e.max);
      col.setXYZ(i, e.c.r * k, e.c.g * k, e.c.b * k);
      if (e.vie <= 0) pos.setXYZ(i, 0, -1000, 0);
    }
    if (actif) pos.needsUpdate = col.needsUpdate = true;
    for (const f of this.fumees) {
      if (f.vie <= 0) continue;
      f.vie -= dt;
      f.obj.position.addScaledVector(f.v, dt);
      f.obj.scale.setScalar(0.15 + (0.6 - f.vie) * 0.9);
      f.obj.material.opacity = Math.max(0, f.vie / 0.6) * 0.6;
      if (f.vie <= 0) f.obj.visible = false;
    }
    for (const b of this.boules) {
      if (b.t >= 1) continue;
      b.t = Math.min(1, b.t + dt / b.duree);
      const e = 1 - (1 - b.t) * (1 - b.t);
      b.obj.scale.setScalar(0.3 + e * b.rayon);
      b.obj.material.opacity = (1 - b.t) * 0.85;
      if (b.t >= 1) b.obj.visible = false;
    }
    for (const a of this.anneaux) {
      if (a.t >= 1) continue;
      a.t = Math.min(1, a.t + dt / a.duree);
      a.obj.scale.setScalar(0.2 + a.t * a.rayon);
      a.obj.material.opacity = (1 - a.t) * 0.9;
      if (a.t >= 1) a.obj.visible = false;
    }
    for (const c of this.colonnes) {
      if (c.t >= 1) continue;
      c.t = Math.min(1, c.t + dt / 0.9);
      c.obj.scale.set(1 - c.t * 0.6, 0.3 + c.t * 0.9, 1 - c.t * 0.6);
      c.obj.material.opacity = Math.sin(c.t * Math.PI) * 0.55;
      if (c.t >= 1) c.obj.visible = false;
    }
    this.lumiere.intensity *= Math.exp(-(this.bouleT < 1 ? 5 : 35) * dt);
    if (this.bouleT < 1) {
      this.bouleT += dt / 0.8;
      this.boule.scale.setScalar(1 + this.bouleT * 16);
      this.boule.material.opacity = Math.max(0, 1 - this.bouleT);
      if (this.bouleT >= 1) { this.boule.visible = false; this.lumiere.distance = 9; }
    }
  }
}
