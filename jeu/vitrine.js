// Vitrine 3D des menus : personnage sur son socle (animation d'apparition puis attitude de repos),
// aperçu d'une arme dans l'Arsenal, et portraits des personnages générés à partir de leur modèle 3D.
// Un seul contexte WebGL : son canvas est déplacé dans l'écran qui l'utilise.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { Personnage } from "./personnages.js";
import { HEROS, CATEGORIES } from "./heros.js";
import { piecesArme, materiauxArme, detailsArme, dessinerEcran, ARMES } from "./armes.js";

export class Vitrine {
  constructor(qualite) {
    this.qualite = qualite === "basse" ? "basse" : "moyenne";
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.localClippingEnabled = true;
    r.setClearColor(0x000000, 0);
    r.domElement.className = "vitrine-canvas";
    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);

    this.scene.add(new THREE.HemisphereLight(0xcfdcff, 0x2a2430, 1.1));
    const cle = new THREE.DirectionalLight(0xfff2e0, 2.4);
    cle.position.set(2, 4, 3);
    this.scene.add(cle);
    this.contre = new THREE.DirectionalLight(0x7cffd4, 2.2);
    this.contre.position.set(-3, 2.5, -3);
    this.scene.add(this.contre);

    // Socle lumineux aux couleurs de la catégorie
    this.socle = new THREE.Group();
    const disque = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.82, 0.08, 48), new THREE.MeshStandardMaterial({ color: 0x1a1e28, roughness: 0.4, metalness: 0.6 }));
    disque.position.y = -0.04;
    this.matAnneau = new THREE.MeshBasicMaterial({ color: 0x7cffd4, toneMapped: false });
    const anneau = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.012, 8, 64).rotateX(Math.PI / 2), this.matAnneau);
    anneau.position.y = 0.002;
    this.matHalo = new THREE.MeshBasicMaterial({ color: 0x7cffd4, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const halo = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48).rotateX(-Math.PI / 2), this.matHalo);
    halo.position.y = -0.075;
    this.socle.add(disque, anneau, halo);
    this.scene.add(this.socle);

    // Apparition : plan de découpe qui monte + anneau lumineux + faisceau
    this.decoupe = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    this.matBalayage = new THREE.MeshBasicMaterial({ color: 0x7cffd4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.balayage = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.62, 48).rotateX(-Math.PI / 2), this.matBalayage);
    this.matFaisceau = new THREE.MeshBasicMaterial({ color: 0x7cffd4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.faisceau = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 2.6, 32, 1, true).translate(0, 1.3, 0), this.matFaisceau);
    this.scene.add(this.balayage, this.faisceau);

    this.modeles = new Map();
    this.modele = null;
    this.arme = null;
    this.armes = new Map();
    this.apparitionT = 1;
    this.rotation = 0.35;
    this.rotationCible = 0.35;
    this.distance = 1;
    this.actif = false;
    this.horloge = new THREE.Timer();
    this.portraits = new Map();
    this.boucle = this.boucle.bind(this);
    this.installerSouris();
  }

  // Le canvas rejoint l'écran qui l'affiche
  attacher(conteneur) {
    if (this.renderer.domElement.parentElement !== conteneur) conteneur.appendChild(this.renderer.domElement);
    this.conteneur = conteneur;
    this.redimensionner();
  }

  redimensionner() {
    if (!this.conteneur) return;
    const w = Math.max(50, this.conteneur.clientWidth), h = Math.max(50, this.conteneur.clientHeight);
    if (this.taille && this.taille[0] === w && this.taille[1] === h) return;
    this.taille = [w, h];
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  installerSouris() {
    const el = this.renderer.domElement;
    let glisse = null;
    el.addEventListener("pointerdown", (e) => { glisse = e.clientX; el.setPointerCapture(e.pointerId); });
    el.addEventListener("pointermove", (e) => { if (glisse === null) return; this.rotationCible += (e.clientX - glisse) * 0.012; glisse = e.clientX; });
    const fin = () => { glisse = null; };
    el.addEventListener("pointerup", fin);
    el.addEventListener("pointercancel", fin);
    el.addEventListener("wheel", (e) => { e.preventDefault(); this.distance = Math.min(1.25, Math.max(0.6, this.distance + Math.sign(e.deltaY) * 0.08)); }, { passive: false });
  }

  couleurs(couleur) {
    const c = new THREE.Color(couleur);
    this.matAnneau.color.copy(c);
    this.matHalo.color.copy(c);
    this.matBalayage.color.copy(c);
    this.matFaisceau.color.copy(c);
    this.contre.color.copy(c).lerp(new THREE.Color(0xffffff), 0.35);
  }

  modeleDe(id) {
    if (!this.modeles.has(id)) {
      const m = new Personnage(id, "vitrine", this.qualite, HEROS[id].arme);
      for (const mesh of m.maillages) mesh.material.clippingPlanes = [this.decoupe];
      m.ombre.visible = false;
      this.modeles.set(id, m);
    }
    return this.modeles.get(id);
  }

  // Affiche un personnage avec son animation d'apparition
  montrerHeros(id, apparition = true) {
    const h = HEROS[id];
    if (!h) return;
    if (this.arme) { this.scene.remove(this.arme); this.arme = null; }
    if (this.modele) this.scene.remove(this.modele.racine);
    this.modele = this.modeleDe(id);
    this.idHeros = id;
    this.scene.add(this.modele.racine);
    this.modele.ressusciter();
    for (const mesh of this.modele.maillages) mesh.material.clippingPlanes = [this.decoupe];
    this.couleurs(CATEGORIES[h.categorie].couleur);
    this.apparitionT = apparition ? 0 : 1;
    this.socle.visible = true;
    this.vise = "heros";
  }

  // Aperçu d'une arme (Arsenal) avec sa finition
  montrerArme(id, skin = "standard") {
    if (this.modele) { this.scene.remove(this.modele.racine); this.modele = null; }
    if (this.arme) this.scene.remove(this.arme);
    const cle = id + "|" + skin;
    if (!this.armes.has(cle)) {
      const g = new THREE.Group();
      const { A, C, mob, points } = piecesArme(id, true);
      const mats = materiauxArme(this.qualite, skin);
      g.add(A.construire(mats, false), C.construire(mats, false));
      for (const m of Object.values(mob)) g.add(m.construire(mats, false));
      const details = detailsArme(id, g, ARMES[id].chargeur);
      if (details && details.ecran) dessinerEcran(details.ecran, ARMES[id].chargeur);
      // Centrage : l'arme tourne autour de son milieu
      const boite = new THREE.Box3().setFromObject(g);
      const centre = boite.getCenter(new THREE.Vector3());
      const pivot = new THREE.Group();
      g.position.sub(centre);
      pivot.add(g);
      pivot.userData.longueur = boite.getSize(new THREE.Vector3()).length();
      this.armes.set(cle, pivot);
      void points;
    }
    this.arme = this.armes.get(cle);
    this.scene.add(this.arme);
    this.socle.visible = false;
    this.couleurs(0x7cffd4);
    this.apparitionT = 1;
    this.vise = "arme";
  }

  demarrer() {
    if (this.actif) return;
    this.actif = true;
    this.horloge.update(performance.now());
    requestAnimationFrame(this.boucle);
  }

  arreter() { this.actif = false; }

  boucle(t) {
    if (!this.actif) return;
    requestAnimationFrame(this.boucle);
    this.horloge.update(t);
    // Le premier pas peut être négatif (horodatage de l'image antérieur au démarrage) : borné
    const dt = Math.max(0, Math.min(this.horloge.getDelta(), 0.05));
    this.redimensionner();
    this.rendre(dt);
  }

  rendre(dt) {
    this.rotation += (this.rotationCible - this.rotation) * (1 - Math.exp(-8 * dt));
    if (this.vise === "arme" && this.arme) {
      this.rotationCible += dt * 0.5;
      this.arme.rotation.set(0.12, this.rotation + Math.PI / 2, 0);
      const l = this.arme.userData.longueur || 0.8;
      this.camera.position.set(0, 0.04, l * 1.12 * this.distance);
      this.camera.lookAt(0, 0, 0);
    } else if (this.modele) {
      const m = this.modele;
      m.racine.rotation.y = this.rotation;
      m.maj({ dt, vitesse: 0, dirX: 0, dirZ: 1, vise: false, tangage: 0, recharge: -1, pose: HEROS[this.idHeros].pose });
      // Apparition
      if (this.apparitionT < 1) {
        this.apparitionT = Math.min(1, this.apparitionT + dt / 1.3);
        const e = this.apparitionT;
        const y = -0.05 + e * e * (3 - 2 * e) * 2.35;
        this.decoupe.constant = y;
        this.balayage.position.y = y;
        this.matBalayage.opacity = 0.9 * (1 - Math.max(0, e - 0.85) / 0.15);
        this.matFaisceau.opacity = 0.32 * Math.sin(e * Math.PI);
        this.balayage.scale.setScalar(1 + Math.sin(e * 20) * 0.04);
      } else {
        this.decoupe.constant = 10;
        this.matBalayage.opacity = 0;
        this.matFaisceau.opacity = 0;
      }
      const hauteur = 1.75 * (m.echelle || 1);
      const d = 4.3 * this.distance;
      this.camera.position.set(0, hauteur * 0.62, d);
      this.camera.lookAt(0, hauteur * 0.52, 0);
    }
    this.renderer.render(this.scene, this.camera);
  }

  // Portrait (tête et épaules) rendu depuis le modèle 3D -> image PNG (data URL)
  portrait(id, taille = 160) {
    if (this.portraits.has(id)) return this.portraits.get(id);
    const m = this.modeleDe(id);
    const ancien = { modele: this.modele, arme: this.arme, socle: this.socle.visible };
    if (this.modele) this.scene.remove(this.modele.racine);
    if (this.arme) this.scene.remove(this.arme);
    this.socle.visible = false;
    this.matBalayage.opacity = 0; this.matFaisceau.opacity = 0;
    this.scene.add(m.racine);
    const decoupe = this.decoupe.constant;
    this.decoupe.constant = 10;
    m.racine.rotation.y = 0.32;
    m.ressusciter();
    m.maj({ dt: 0.016, vitesse: 0, dirX: 0, dirZ: 1, vise: false, tangage: 0, recharge: -1 });
    m.racine.updateMatrixWorld(true);
    const tete = new THREE.Vector3();
    m.tete.getWorldPosition(tete);
    tete.y += 0.06 * (m.echelle || 1);
    const cam = new THREE.PerspectiveCamera(24, 1, 0.05, 20);
    cam.position.set(tete.x + 0.28, tete.y + 0.05, tete.z + 1.25);
    cam.lookAt(tete.x, tete.y - 0.04, tete.z);
    const cible = new THREE.WebGLRenderTarget(taille, taille, { samples: 4 });
    this.couleurs(CATEGORIES[HEROS[id].categorie].couleur);
    this.renderer.setRenderTarget(cible);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
    this.renderer.render(this.scene, cam);
    const pixels = new Uint8Array(taille * taille * 4);
    this.renderer.readRenderTargetPixels(cible, 0, 0, taille, taille, pixels);
    this.renderer.setRenderTarget(null);
    cible.dispose();
    const c = document.createElement("canvas");
    c.width = c.height = taille;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(taille, taille);
    for (let y = 0; y < taille; y++) img.data.set(pixels.subarray((taille - 1 - y) * taille * 4, (taille - y) * taille * 4), y * taille * 4);
    ctx.putImageData(img, 0, 0);
    const url = c.toDataURL("image/png");
    this.portraits.set(id, url);
    // Remet la scène dans son état
    this.scene.remove(m.racine);
    this.decoupe.constant = decoupe;
    this.socle.visible = ancien.socle;
    if (ancien.modele) this.scene.add(ancien.modele.racine);
    if (ancien.arme) this.scene.add(ancien.arme);
    if (this.idHeros && HEROS[this.idHeros] && this.vise === "heros") this.couleurs(CATEGORIES[HEROS[this.idHeros].categorie].couleur);
    return url;
  }
}
