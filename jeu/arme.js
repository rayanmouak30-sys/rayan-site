// Arme du joueur : statistiques, recul, imprécision, rechargement et modèle 3D vu à la première personne.
import * as THREE from "three";
import { textureEclat } from "./textures.js";

const DEG = Math.PI / 180;

export const STATS_FUSIL = {
  nom: "Vecteur",
  cadence: 0.1,          // secondes entre deux balles
  chargeur: 25,
  reserve: 75,
  rechargement: 2.3,
  degats: { tete: 160, corps: 40, jambes: 34 },
  precision: 0.2,        // degrés, première balle immobile
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
    this.prochainTir = 0;
    this.serie = 0;
    this.dernierTir = -10;
    this.reculPitch = 0;   // radians, ajoutés à la vue
    this.reculYaw = 0;
    this.cibleRecul = [0, 0];
  }

  get recharge() { return this.rechargeT > 0; }

  peutTirer(temps) {
    return this.rechargeT <= 0 && this.mun > 0 && temps >= this.prochainTir;
  }

  lancerRechargement() {
    if (this.rechargeT > 0 || this.mun >= this.stats.chargeur || this.reserve <= 0) return false;
    this.rechargeT = this.stats.rechargement;
    this.serie = 0;
    return true;
  }

  // Imprécision en degrés selon le mouvement.
  imprecision({ vitesse, enLAir, accroupi, vise }) {
    let e = this.stats.precision;
    if (enLAir) e += 6;
    else if (vitesse > 0.6) e += Math.min(vitesse / 6.2, 1.2) * 3.6;
    e += Math.max(0, this.serie - 2) * 0.13;
    if (accroupi) e *= 0.75;
    if (vise) e *= 0.55;
    return e;
  }

  // Appelé quand une balle part. Retourne le décalage aléatoire (yaw, pitch) en radians.
  tirer(temps, etat) {
    const ecart = this.imprecision(etat) * DEG;
    this.mun--;
    this.prochainTir = temps + this.stats.cadence;
    this.dernierTir = temps;
    const r = recul(this.serie);
    const facteur = etat.vise ? 0.78 : 1;
    this.cibleRecul = [r[0] * DEG * facteur, r[1] * DEG * facteur];
    this.serie++;
    if (this.mun <= 0) this.lancerRechargement();
    // Point aléatoire dans un disque (répartition uniforme)
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
    // Le viseur suit la cible de recul rapidement, puis revient doucement au repos.
    const k = 1 - Math.exp(-(auRepos ? 7 : 28) * dt);
    this.reculPitch += (this.cibleRecul[0] - this.reculPitch) * k;
    this.reculYaw += (this.cibleRecul[1] - this.reculYaw) * k;
  }
}

// ===== Modèle 3D =====
export class ModeleArme {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
    this.scene.add(new THREE.HemisphereLight(0xbcd2ff, 0x2a2018, 1.1));
    const d = new THREE.DirectionalLight(0xffd8b0, 2.2);
    d.position.set(-1, 2, 1.5);
    this.scene.add(d);
    const contre = new THREE.DirectionalLight(0x6fa8ff, 0.9);
    contre.position.set(1.5, 0.5, -1);
    this.scene.add(contre);

    this.pivot = new THREE.Group();   // position générale (hanche / visée)
    this.arme = new THREE.Group();    // animations (recul, rechargement)
    this.pivot.add(this.arme);
    this.scene.add(this.pivot);

    const polymere = new THREE.MeshStandardMaterial({ color: 0x1c2029, roughness: 0.55, metalness: 0.25 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x3b414d, roughness: 0.32, metalness: 0.85 });
    const clair = new THREE.MeshStandardMaterial({ color: 0x8a93a3, roughness: 0.4, metalness: 0.7 });
    const neon = new THREE.MeshBasicMaterial({ color: 0x7cffd4 });
    const manche = new THREE.MeshStandardMaterial({ color: 0x24324d, roughness: 0.85 });
    const gant = new THREE.MeshStandardMaterial({ color: 0x17191f, roughness: 0.7 });

    const ajout = (geo, m, x, y, z, rx = 0, parent = this.arme) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.rotation.x = rx;
      parent.add(mesh);
      return mesh;
    };

    ajout(new THREE.BoxGeometry(0.07, 0.085, 0.36), polymere, 0, 0, 0);
    ajout(new THREE.BoxGeometry(0.074, 0.03, 0.2), metal, 0, 0.03, 0.02);
    ajout(new THREE.BoxGeometry(0.045, 0.014, 0.42), metal, 0, 0.05, -0.06);
    for (let i = 0; i < 9; i++) ajout(new THREE.BoxGeometry(0.047, 0.004, 0.01), metal, 0, 0.058, 0.08 - i * 0.04);
    ajout(new THREE.BoxGeometry(0.078, 0.07, 0.26), polymere, 0, -0.005, -0.3);
    ajout(new THREE.CylinderGeometry(0.013, 0.013, 0.22, 12).rotateX(Math.PI / 2), metal, 0, 0.005, -0.52);
    ajout(new THREE.CylinderGeometry(0.021, 0.021, 0.07, 12).rotateX(Math.PI / 2), metal, 0, 0.005, -0.66);
    // Organes de visée : guidon à l'avant, deux montants à l'arrière (on vise entre les deux).
    ajout(new THREE.BoxGeometry(0.044, 0.03, 0.02), metal, 0, 0.066, -0.37);
    ajout(new THREE.BoxGeometry(0.006, 0.016, 0.008), neon, 0, 0.089, -0.37);
    ajout(new THREE.BoxGeometry(0.05, 0.012, 0.026), metal, 0, 0.066, 0.13);
    ajout(new THREE.BoxGeometry(0.008, 0.022, 0.014), metal, 0.014, 0.086, 0.13);
    ajout(new THREE.BoxGeometry(0.008, 0.022, 0.014), metal, -0.014, 0.086, 0.13);
    ajout(new THREE.BoxGeometry(0.052, 0.085, 0.2), polymere, 0, -0.015, 0.27);
    ajout(new THREE.BoxGeometry(0.056, 0.11, 0.035), polymere, 0, -0.03, 0.385);
    this.chargeur = ajout(new THREE.BoxGeometry(0.042, 0.17, 0.075), metal, 0, -0.115, -0.07, 0.22);
    ajout(new THREE.BoxGeometry(0.042, 0.13, 0.05), polymere, 0, -0.1, 0.11, -0.32);
    ajout(new THREE.BoxGeometry(0.004, 0.012, 0.3), neon, 0.0365, 0.012, -0.05);
    ajout(new THREE.BoxGeometry(0.004, 0.012, 0.3), neon, -0.0365, 0.012, -0.05);
    ajout(new THREE.BoxGeometry(0.08, 0.008, 0.2), neon, 0, -0.04, -0.3);

    // Bras et mains
    const brasD = ajout(new THREE.CapsuleGeometry(0.048, 0.26, 4, 10), manche, 0.07, -0.2, 0.26, 1.15);
    brasD.rotation.z = -0.35;
    ajout(new THREE.BoxGeometry(0.06, 0.07, 0.09), gant, 0.01, -0.09, 0.13);
    const brasG = ajout(new THREE.CapsuleGeometry(0.046, 0.3, 4, 10), manche, -0.11, -0.16, -0.18, 1.3);
    brasG.rotation.z = 0.7;
    ajout(new THREE.BoxGeometry(0.085, 0.05, 0.1), gant, -0.02, -0.05, -0.3);

    // Flash du canon
    const tex = textureEclat();
    const matFlash = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffd9a0 });
    this.flash = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), matFlash);
      p.rotation.z = (k * Math.PI) / 3;
      if (k === 1) p.rotation.y = Math.PI / 2;
      if (k === 2) { p.rotation.x = Math.PI / 2; p.scale.set(0.6, 1.6, 1); }
      this.flash.add(p);
    }
    this.flash.position.set(0, 0.005, -0.74);
    this.flash.visible = false;
    this.arme.add(this.flash);
    this.lumiereFlash = new THREE.PointLight(0xffc27a, 0, 1.5);
    this.lumiereFlash.position.set(0, 0.02, -0.7);
    this.arme.add(this.lumiereFlash);

    this.arme.scale.setScalar(0.62);
    this.hanche = new THREE.Vector3(0.17, -0.165, -0.39);
    this.visee = new THREE.Vector3(0, -0.057, -0.32);
    this.pivot.position.copy(this.hanche);

    this.kick = 0;
    this.flashT = 0;
    this.balance = new THREE.Vector2();
    this.sortie = 1;      // animation de sortie de l'arme (1 = cachée)
    this.viseeK = 0;
    this.sprintK = 0;
  }

  redimensionner(ratio) {
    this.camera.aspect = ratio;
    this.camera.updateProjectionMatrix();
  }

  tir() {
    this.kick = 1;
    this.flashT = 0.045;
    this.flash.visible = true;
    this.flash.rotation.z = Math.random() * Math.PI;
    this.flash.scale.setScalar(0.8 + Math.random() * 0.5);
    this.lumiereFlash.intensity = 3;
  }

  sortir() { this.sortie = 1; }

  // etat : { dt, temps, vitesse, auSol, vise, sprint, souris: {x,y}, recharge: 0..1 ou -1 }
  maj(e) {
    const dt = e.dt;
    this.viseeK += ((e.vise ? 1 : 0) - this.viseeK) * (1 - Math.exp(-14 * dt));
    this.sprintK += ((e.sprint && !e.vise ? 1 : 0) - this.sprintK) * (1 - Math.exp(-8 * dt));
    this.sortie = Math.max(0, this.sortie - dt * 2.5);
    this.kick *= Math.exp(-16 * dt);
    this.flashT -= dt;
    if (this.flashT <= 0) this.flash.visible = false;
    this.lumiereFlash.intensity *= Math.exp(-40 * dt);

    // Balancement selon la souris (l'arme traîne un peu derrière la vue)
    const sx = Math.max(-1, Math.min(1, -e.souris.x * 0.004));
    const sy = Math.max(-1, Math.min(1, e.souris.y * 0.004));
    this.balance.x += (sx - this.balance.x) * (1 - Math.exp(-10 * dt));
    this.balance.y += (sy - this.balance.y) * (1 - Math.exp(-10 * dt));

    const mouvement = e.auSol ? Math.min(e.vitesse / 6, 1.3) : 0;
    const t = e.temps * (e.sprint ? 13 : 10);
    const amp = (1 - this.viseeK * 0.85);
    const bobX = Math.cos(t * 0.5) * 0.012 * mouvement * amp;
    const bobY = -Math.abs(Math.sin(t * 0.5)) * 0.014 * mouvement * amp;
    const respiration = Math.sin(e.temps * 1.6) * 0.0025 * amp;

    this.pivot.position.lerpVectors(this.hanche, this.visee, this.viseeK);
    this.pivot.position.x += bobX + this.balance.x * 0.03 * amp - this.sprintK * 0.03;
    this.pivot.position.y += bobY + respiration + this.balance.y * 0.02 * amp - this.sortie * 0.35 - this.sprintK * 0.05;
    this.pivot.rotation.set(this.balance.y * 0.08 + this.sprintK * -0.25, this.balance.x * 0.12 + this.sprintK * 0.55, this.balance.x * 0.1 + this.sprintK * 0.25);

    // Recul + rechargement
    let rx = this.kick * 0.07, rz = 0, py = 0, pz = this.kick * 0.03;
    let chargeurY = 0;
    if (e.recharge >= 0) {
      const r = e.recharge;
      const pose = Math.min(1, r / 0.18, (1 - r) / 0.15);
      rx += -0.25 * pose; rz += 0.55 * pose; py -= 0.035 * pose;
      if (r > 0.22 && r < 0.62) chargeurY = -Math.min(1, (r - 0.22) / 0.1) * 0.35;
      if (r >= 0.62 && r < 0.78) chargeurY = -0.35 * (1 - (r - 0.62) / 0.16);
      if (r > 0.82 && r < 0.92) pz += Math.sin(((r - 0.82) / 0.1) * Math.PI) * 0.025;
    }
    this.chargeur.position.y = -0.115 + chargeurY;
    this.chargeur.visible = chargeurY > -0.3;
    this.arme.rotation.set(rx, 0, rz);
    this.arme.position.set(0, py, pz);
  }
}
