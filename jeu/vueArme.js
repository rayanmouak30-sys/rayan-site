// Vue à la première personne : bras gantés + arme active (pistolet, fusil, pompe, précision, couteau).
// Animations : sortie de l'arme, recul à ressorts, culasse, pompe, verrou, rechargements, coups de couteau.
import * as THREE from "three";
import { boiteRonde, membre, revolution, Assemblage, ik2, Ressort } from "./formes.js";
import { textureEclat, textureReticule, textureTissu } from "./textures.js";
import { piecesArme, materiauxArme, detailsArme, dessinerEcran, ARMES } from "./armes.js";

// Placement de chaque arme dans le champ de vision
const CADRAGE = {
  fusil: { echelle: 0.9, hanche: [0.16, -0.172, -0.25], viseeZ: -0.2, recul: 1 },
  pistolet: { echelle: 0.92, hanche: [0.12, -0.1, -0.4], viseeZ: -0.4, recul: 1.25 },
  pompe: { echelle: 0.88, hanche: [0.16, -0.17, -0.23], viseeZ: -0.2, recul: 2.2 },
  sniper: { echelle: 0.82, hanche: [0.15, -0.162, -0.2], viseeZ: -0.1, recul: 2.6 },
  couteau: { echelle: 1.0, hanche: [0.17, -0.16, -0.34], viseeZ: -0.34, recul: 0 },
  pulsar: { echelle: 0.76, hanche: [0.172, -0.2, -0.27], viseeZ: -0.3, recul: 0.95 },
};

// ===== Bras et mains =====
function construireBras(qualite, cote) {
  const tissu = textureTissu(qualite);
  const mats = {
    manche: new THREE.MeshStandardMaterial({ color: 0x2c3a56, map: tissu.map, normalMap: qualite === "basse" ? null : tissu.normalMap, roughness: 0.9 }),
    gant: new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.72 }),
    renfort: new THREE.MeshStandardMaterial({ color: 0x454b57, roughness: 0.55, metalness: 0.2 }),
    accent: new THREE.MeshStandardMaterial({ color: 0x7cffd4, emissive: 0x3fe0b0, emissiveIntensity: 0.5 }),
  };
  const epaule = new THREE.Group();
  const coude = new THREE.Group();
  const main = new THREE.Group();
  epaule.add(coude);
  coude.add(main);
  coude.position.y = -0.31;
  main.position.y = -0.29;

  const A1 = new Assemblage();
  A1.ajouter(membre(0.058, 0.05, 0.31), "manche");
  epaule.add(A1.construire(mats, false));

  const A2 = new Assemblage();
  A2.ajouter(membre(0.05, 0.04, 0.29), "manche");
  A2.ajouter(revolution([[0.047, -0.2], [0.05, -0.215], [0.05, -0.245], [0.044, -0.255]], 14), "manche");
  A2.ajouter(boiteRonde(0.05, 0.045, 0.03, 0.008), "renfort", { p: [cote * 0.02, -0.1, 0.035] });
  A2.ajouter(new THREE.BoxGeometry(0.03, 0.02, 0.003), "accent", { p: [cote * 0.02, -0.1, 0.051] });
  coude.add(A2.construire(mats, false));

  const A3 = new Assemblage();
  A3.ajouter(boiteRonde(0.078, 0.09, 0.032, 0.012), "gant", { p: [0, -0.045, 0] });
  for (let i = 0; i < 4; i++) {
    const x = -0.028 + i * 0.019;
    const doigtTendu = cote > 0 && i === 0;
    A3.ajouter(new THREE.CapsuleGeometry(0.0085, doigtTendu ? 0.05 : 0.026, 3, 8), "gant", { p: [x, doigtTendu ? -0.12 : -0.1, doigtTendu ? 0.01 : 0.02], r: [doigtTendu ? 0.2 : 1.2, 0, 0] });
    if (!doigtTendu) A3.ajouter(new THREE.CapsuleGeometry(0.0082, 0.022, 3, 8), "gant", { p: [x, -0.105, 0.045], r: [2.6, 0, 0] });
  }
  A3.ajouter(new THREE.CapsuleGeometry(0.01, 0.035, 3, 8), "gant", { p: [-cote * 0.045, -0.04, 0.03], r: [0.9, 0, -cote * 0.5] });
  A3.ajouter(boiteRonde(0.07, 0.016, 0.014, 0.004), "renfort", { p: [0, -0.088, -0.016] });
  main.add(A3.construire(mats, false));
  return { epaule, coude, main };
}

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _pole = new THREE.Vector3(), _q = new THREE.Quaternion(), _qa = new THREE.Quaternion();
const DECALAGE_D = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, 0, 0));
const DECALAGE_G = new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.25, 0, 1.4));
const POCHE = new THREE.Vector3(-0.2, -0.55, -0.08);
const REPOS_G = new THREE.Vector3(-0.32, -0.62, -0.12);
const seg = (t, a, b) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };

export class VueArme {
  constructor(qualite = "moyenne") {
    this.qualite = qualite;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.01, 10);
    this.scene.add(new THREE.HemisphereLight(0xd4e2ff, 0x4a4036, 1.25));
    const cle = new THREE.DirectionalLight(0xfff0dc, 2.6);
    cle.position.set(-1.2, 2, 1.2);
    this.scene.add(cle);
    const contre = new THREE.DirectionalLight(0x9fc4ff, 1.2);
    contre.position.set(1.4, 0.6, -1.2);
    this.scene.add(contre);

    this.pivot = new THREE.Group();
    this.arme = new THREE.Group();
    this.pivot.add(this.arme);
    this.scene.add(this.pivot);

    this.brasD = construireBras(qualite, 1);
    this.brasG = construireBras(qualite, -1);
    this.brasD.epaule.position.set(0.22, -0.3, 0.12);
    this.brasG.epaule.position.set(-0.17, -0.3, 0.04);
    this.scene.add(this.brasD.epaule, this.brasG.epaule);

    // Flash du canon (déplacé sur l'arme active)
    const matFlash = this.matFlash = new THREE.MeshBasicMaterial({ map: textureEclat(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffd6a0, toneMapped: false });
    this.flash = new THREE.Group();
    const etoile = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), matFlash);
    const cone1 = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.22), matFlash);
    cone1.rotation.x = Math.PI / 2; cone1.position.z = -0.08;
    const cone2 = cone1.clone(); cone2.rotation.y = Math.PI / 2;
    this.flash.add(etoile, cone1, cone2);
    this.flash.visible = false;
    this.lumiereFlash = new THREE.PointLight(0xffc27a, 0, 1.2);

    // Douilles éjectées (réserve réutilisée)
    const matsBase = materiauxArme(qualite, "standard");
    this.geoDouille = new THREE.CylinderGeometry(0.0045, 0.0045, 0.028, 8).rotateX(Math.PI / 2);
    this.geoCartouche = new THREE.CylinderGeometry(0.009, 0.009, 0.05, 10).rotateX(Math.PI / 2);
    this.douilles = [];
    for (let i = 0; i < 8; i++) {
      const d = new THREE.Mesh(this.geoDouille, matsBase.laiton);
      d.visible = false;
      this.scene.add(d);
      this.douilles.push({ mesh: d, vie: 0, v: new THREE.Vector3(), w: new THREE.Vector3() });
    }
    this.iDouille = 0;
    this.matsBase = matsBase;

    this.cache = new Map();
    this.modele = null;
    this.ressortZ = new Ressort(260, 22);
    this.ressortRx = new Ressort(220, 20);
    this.ressortRz = new Ressort(180, 16);
    this.ressortY = new Ressort(160, 18);
    this.flashT = 0;
    this.culasseT = 1;
    this.balance = new THREE.Vector2();
    this.sortie = 1;
    this.dureeSortie = 0.6;
    this.viseeK = 0;
    this.sprintK = 0;
    this.mouvementK = 0;
    this.pas = 0;
    this.amplitudeBob = 1;
    this.coupT = 1;
    this.coupLourd = false;
    this.coupSens = 1;
    this.cycleEjecte = false;
    this.inspectT = 1;
  }

  redimensionner(ratio) {
    this.camera.aspect = ratio;
    this.camera.updateProjectionMatrix();
  }

  construireModele(id, skin) {
    const mats = materiauxArme(this.qualite, skin);
    const { A, C, mob, points } = piecesArme(id, true);
    const racine = new THREE.Group();
    const groupe = new THREE.Group();
    racine.add(groupe);
    const cfg = CADRAGE[id];
    racine.scale.setScalar(cfg.echelle);
    groupe.add(A.construire(mats, false));
    const chargeur = C.construire(mats, false);
    const culasse = mob.culasse.construire(mats, false);
    const levier = mob.levier.construire(mats, false);
    const pompe = mob.pompe.construire(mats, false);
    groupe.add(chargeur, culasse, levier, pompe);
    if (points.reticule) {
      const verre = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.034), mats.verre);
      verre.position.set(0, points.viseur.y + 0.0015, points.viseur.z);
      const reticule = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.03), new THREE.MeshBasicMaterial({ map: textureReticule(), transparent: true, depthWrite: false, toneMapped: false }));
      reticule.position.set(points.viseur.x, points.viseur.y, points.viseur.z - 0.005);
      groupe.add(verre, reticule);
    }
    const details = detailsArme(id, groupe, ARMES[id].chargeur);
    racine.visible = false;
    this.arme.add(racine);
    return {
      id, racine, groupe, cfg, points, ecran: details ? details.ecran : null, matLumiere: mats.lumiere,
      pieces: { chargeur, culasse, levier, pompe },
      chargeurRepos: chargeur.position.clone(),
      hanche: new THREE.Vector3(...cfg.hanche),
      visee: new THREE.Vector3(0, -points.viseur.y * cfg.echelle, cfg.viseeZ),
    };
  }

  // Sort une arme (animation de sortie de durée "duree").
  equiper(id, skin = "standard", duree = 0.6) {
    const cle = id + "|" + skin;
    if (!this.cache.has(cle)) this.cache.set(cle, this.construireModele(id, skin));
    const m = this.cache.get(cle);
    if (this.modele && this.modele !== m) this.modele.racine.visible = false;
    this.modele = m;
    m.racine.visible = true;
    m.groupe.add(this.flash);
    m.groupe.add(this.lumiereFlash);
    this.flash.position.copy(m.points.bouche);
    this.lumiereFlash.position.copy(m.points.bouche);
    const def = ARMES[id];
    this.matFlash.color.setHex(def.couleurFlash || 0xffd6a0);
    this.lumiereFlash.color.setHex(def.couleurFlash || 0xffc27a);
    this.sortie = 1;
    this.dureeSortie = Math.max(0.2, duree);
    this.coupT = 1;
    this.inspectT = 1;
    this.flash.visible = false;
  }

  // Précharge les modèles (évite un à-coup au premier changement d'arme)
  prechauffer(ids, skins = {}) {
    for (const id of ids) {
      const cle = id + "|" + (skins[id] || "standard");
      if (!this.cache.has(cle)) this.cache.set(cle, this.construireModele(id, skins[id] || "standard"));
    }
  }

  inspecter() { if (this.sortie <= 0 && this.coupT >= 1) this.inspectT = 0; }

  tir() {
    const m = this.modele;
    if (!m) return;
    const k = m.cfg.recul;
    this.ressortZ.impulsion(1.6 * k);
    this.ressortRx.impulsion((3.2 + Math.random() * 0.8) * k);
    this.ressortRz.impulsion((Math.random() - 0.5) * 2.2);
    this.ressortY.impulsion(0.25 * k);
    this.flashT = 0.04;
    this.flash.visible = true;
    this.flash.rotation.z = Math.random() * Math.PI;
    this.flash.scale.setScalar((0.75 + Math.random() * 0.5) * (m.id === "pompe" ? 1.5 : m.id === "sniper" ? 1.3 : m.id === "pistolet" ? 0.75 : 1));
    this.lumiereFlash.intensity = 2.5;
    this.culasseT = 0;
    this.inspectT = 1;
    this.cycleEjecte = false;
    this.pulsT = 1;
    if (m.id === "fusil" || m.id === "pistolet") this.ejecterDouille(false);
  }

  coup(lourd) {
    this.coupT = 0;
    this.coupLourd = lourd;
    this.coupSens = -this.coupSens;
    this.inspectT = 1;
  }

  ejecterDouille(cartouche) {
    const m = this.modele;
    const d = this.douilles[this.iDouille++ % this.douilles.length];
    d.mesh.geometry = cartouche ? this.geoCartouche : this.geoDouille;
    d.mesh.material = cartouche ? this.matsBase.cartouche : this.matsBase.laiton;
    m.groupe.updateMatrixWorld(true);
    d.mesh.position.copy(m.points.ejection).applyMatrix4(m.groupe.matrixWorld);
    m.groupe.getWorldQuaternion(d.mesh.quaternion);
    d.v.set(1.6 + Math.random() * 0.6, 1.1 + Math.random() * 0.5, 0.4 + Math.random() * 0.3);
    d.w.set(Math.random() * 20, Math.random() * 30, Math.random() * 10);
    d.vie = 0.7;
    d.mesh.visible = true;
  }

  // e : { dt, temps, vitesse, auSol, vise, sprint, souris:{x,y}, recharge (0..1 ou -1), rechargeVide, cycle (0..1 ou -1), dureeCoup }
  maj(e) {
    const m = this.modele;
    if (!m) return;
    const dt = e.dt;
    const id = m.id;
    this.viseeK += ((e.vise ? 1 : 0) - this.viseeK) * (1 - Math.exp(-(id === "sniper" ? 12 : 15) * dt));
    this.sprintK += ((e.sprint && !e.vise ? 1 : 0) - this.sprintK) * (1 - Math.exp(-9 * dt));
    this.sortie = Math.max(0, this.sortie - dt / this.dureeSortie);
    const sortie = this.sortie * this.sortie;

    const rz = this.ressortZ.maj(dt), rrx = this.ressortRx.maj(dt), rrz = this.ressortRz.maj(dt), ry = this.ressortY.maj(dt);
    this.flashT -= dt;
    if (this.flashT <= 0) this.flash.visible = false;
    this.lumiereFlash.intensity *= Math.exp(-45 * dt);
    this.culasseT = Math.min(1, this.culasseT + dt / 0.06);
    // Pulsar : les lumières pulsent à chaque tir, l'écran affiche les munitions
    if (m.ecran) dessinerEcran(m.ecran, e.recharge >= 0 ? 0 : e.mun);
    if (m.id === "pulsar") {
      this.pulsT = Math.max(0, (this.pulsT || 0) - dt * 6);
      m.matLumiere.emissiveIntensity = 1.4 + this.pulsT * 2.4;
    }

    const sx = Math.max(-1, Math.min(1, -e.souris.x * 0.004));
    const sy = Math.max(-1, Math.min(1, e.souris.y * 0.004));
    this.balance.x += (sx - this.balance.x) * (1 - Math.exp(-9 * dt));
    this.balance.y += (sy - this.balance.y) * (1 - Math.exp(-9 * dt));

    const mouvement = e.auSol ? Math.min(e.vitesse / 6, 1.2) : 0;
    this.mouvementK += (mouvement - this.mouvementK) * (1 - Math.exp(-8 * dt));
    this.pas += dt * (e.sprint ? 13 : 10) * (0.4 + this.mouvementK * 0.6);
    const amp = (1 - this.viseeK * 0.88) * this.mouvementK * this.amplitudeBob;
    const bobX = Math.sin(this.pas * 0.5) * 0.011 * amp;
    const bobY = -Math.abs(Math.cos(this.pas * 0.5)) * 0.012 * amp;
    const respiration = Math.sin(e.temps * 1.5) * 0.0018 * (1 - this.viseeK * 0.8);

    this.pivot.position.lerpVectors(m.hanche, m.visee, this.viseeK);
    this.pivot.position.x += bobX + this.balance.x * 0.025 * (1 - this.viseeK * 0.7) - this.sprintK * 0.02;
    this.pivot.position.y += bobY + respiration + this.balance.y * 0.018 * (1 - this.viseeK * 0.7) - sortie * 0.3 - this.sprintK * 0.04;
    this.pivot.rotation.set(
      this.balance.y * 0.06 - this.sprintK * 0.32 + sortie * 0.9,
      this.balance.x * 0.1 + this.sprintK * 0.62,
      this.balance.x * 0.08 + this.sprintK * 0.32 + bobX * 2 + (id === "couteau" ? sortie * 2.4 : 0)
    );

    let rotX = rrx * 0.02, rotY = 0, rotZ = rrz * 0.02, posX = 0, posY = ry * 0.004, posZ = rz * 0.022;
    const pc = m.pieces;
    pc.chargeur.position.copy(m.chargeurRepos);
    pc.chargeur.rotation.set(0, 0, 0);
    pc.chargeur.visible = true;
    pc.levier.position.set(0, 0, 0);
    pc.levier.rotation.set(0, 0, 0);
    pc.pompe.position.set(0, 0, 0);
    pc.culasse.position.set(0, 0, 0);
    let mixGauche = 0, mixPoche = 0, mixLevier = 0, mixDroiteLevier = 0, gaucheSuitPompe = false, gaucheRepos = false;

    // ----- Rechargements -----
    const r = e.recharge;
    if (r >= 0 && id !== "pompe" && id !== "couteau") {
      const vide = e.rechargeVide;
      const fin = vide ? 0.78 : 0.86;
      const pose = seg(r, 0, 0.12) * (1 - seg(r, 0.9, 1));
      const incl = id === "pistolet" ? 0.55 : 0.42;
      rotX += -0.18 * pose; rotZ += incl * pose; posY += 0.012 * pose;
      const versChargeur = seg(r, 0.1, 0.2), sortieChargeur = seg(r, 0.22, 0.34), retour = seg(r, 0.5, 0.64), insertion = seg(r, 0.64, 0.72);
      mixGauche = versChargeur * (1 - seg(r, fin, Math.min(1, fin + 0.12)));
      mixPoche = sortieChargeur * (1 - retour);
      if (r > 0.22 && r < 0.72) {
        const bas = sortieChargeur * (1 - retour) * 0.32 + (1 - insertion) * retour * 0.06;
        pc.chargeur.position.y = m.chargeurRepos.y - bas;
        pc.chargeur.position.z = m.chargeurRepos.z + bas * (id === "pistolet" ? 0.05 : 0.25);
        pc.chargeur.rotation.x = -bas * (id === "pistolet" ? 0.1 : 0.6);
        pc.chargeur.visible = bas < 0.3;
      }
      if (r >= 0.71 && r < 0.76) { posZ += 0.01 * Math.sin(((r - 0.71) / 0.05) * Math.PI); rotX += 0.03; }
      if (vide) {
        if (id === "sniper") {
          mixDroiteLevier = seg(r, 0.78, 0.84) * (1 - seg(r, 0.93, 0.99));
          const leve = seg(r, 0.83, 0.86) * (1 - seg(r, 0.92, 0.94));
          pc.levier.rotation.z = leve * 0.9;
          pc.levier.position.z = seg(r, 0.86, 0.88) * (1 - seg(r, 0.89, 0.92)) * 0.07;
        } else {
          mixLevier = seg(r, 0.78, 0.84) * (1 - seg(r, 0.92, 0.98));
          const tire = seg(r, 0.84, 0.88) * (1 - seg(r, 0.89, 0.91));
          if (id === "pistolet") pc.culasse.position.z = tire * 0.03;
          else pc.levier.position.z = tire * 0.06;
          if (r > 0.89 && r < 0.92) posZ += 0.006;
        }
      }
    } else if (r >= 0 && id === "pompe") {
      // Cartouches insérées une à une par la fenêtre sous la carcasse
      const pose = seg(r, 0, 0.1) * (1 - seg(r, 0.92, 1));
      rotX += 0.12 * pose; rotZ += -0.5 * pose; posY += 0.02 * pose;
      const n = 4;
      const u = Math.min(0.999, Math.max(0, (r - 0.1) / 0.8)) * n;
      const f = u - Math.floor(u);
      if (r > 0.1 && r < 0.9) {
        mixPoche = 1 - seg(f, 0.25, 0.5);
        mixGauche = seg(f, 0.25, 0.5) * (1 - seg(f, 0.8, 1));
        pc.chargeur.visible = f > 0.4 && f < 0.75;
      } else {
        mixGauche = 0;
      }
    }

    // ----- Réarmement (pompe / verrou) -----
    const c = e.cycle;
    if (c >= 0 && r < 0) {
      if (id === "pompe") {
        const recul = seg(c, 0.18, 0.38) * (1 - seg(c, 0.42, 0.62));
        pc.pompe.position.z = recul * 0.085;
        gaucheSuitPompe = true;
        rotZ += recul * 0.08;
        rotX += recul * 0.05;
        if (c > 0.34 && !this.cycleEjecte) { this.cycleEjecte = true; this.ejecterDouille(true); }
      } else if (id === "sniper") {
        mixDroiteLevier = seg(c, 0.06, 0.2) * (1 - seg(c, 0.74, 0.9));
        const leve = seg(c, 0.2, 0.28) * (1 - seg(c, 0.62, 0.7));
        const tire = seg(c, 0.3, 0.44) * (1 - seg(c, 0.5, 0.62));
        pc.levier.rotation.z = leve * 0.9;
        pc.levier.position.z = tire * 0.07;
        rotZ += mixDroiteLevier * 0.16;
        rotX += mixDroiteLevier * 0.04;
        if (c > 0.42 && !this.cycleEjecte) { this.cycleEjecte = true; this.ejecterDouille(false); }
      }
    }

    // ----- Culasse et couteau -----
    if (id === "fusil") pc.culasse.position.z = Math.sin(this.culasseT * Math.PI) * 0.03;
    if (id === "pistolet" && r < 0) pc.culasse.position.z = Math.sin(this.culasseT * Math.PI) * 0.026 + (e.mun === 0 ? 0.026 : 0);
    if (id === "couteau") {
      gaucheRepos = true;
      const duree = this.coupLourd ? 0.6 : 0.36;
      this.coupT = Math.min(1, this.coupT + dt / duree);
      if (this.coupT < 1) {
        const t = this.coupT;
        if (this.coupLourd) {
          const arme = seg(t, 0, 0.3), frappe = seg(t, 0.3, 0.45), retour = seg(t, 0.6, 1);
          posZ += (arme * 0.08 - frappe * 0.3) * (1 - retour);
          posY += (arme * 0.06 - frappe * 0.04) * (1 - retour);
          rotX += (arme * 0.7 - frappe * 1.1) * (1 - retour);
        } else {
          const s = this.coupSens;
          const arc = seg(t, 0, 0.45), retour = seg(t, 0.55, 1);
          posX += (s * 0.12 - arc * s * 0.32) * (1 - retour);
          posZ += -Math.sin(arc * Math.PI) * 0.1 * (1 - retour);
          rotY += (s * 0.9 - arc * s * 1.8) * (1 - retour);
          rotZ += s * 0.6 * Math.sin(arc * Math.PI) * (1 - retour);
        }
      }
    }
    // Inspection de l'arme (touche Y)
    if (this.inspectT < 1) {
      this.inspectT = Math.min(1, this.inspectT + dt / 2.2);
      const k = seg(this.inspectT, 0, 0.2) * (1 - seg(this.inspectT, 0.8, 1));
      const tour = seg(this.inspectT, 0.25, 0.75);
      rotZ += k * (0.7 - tour * 1.2);
      rotY += k * 0.5;
      rotX += k * 0.2;
      posX -= k * 0.05;
    }

    this.arme.rotation.set(rotX, rotY, rotZ);
    this.arme.position.set(posX, posY, posZ);

    for (const d of this.douilles) {
      if (d.vie <= 0) continue;
      d.vie -= dt;
      d.v.y -= 9.8 * dt;
      d.mesh.position.addScaledVector(d.v, dt);
      d.mesh.rotation.x += d.w.x * dt; d.mesh.rotation.y += d.w.y * dt;
      if (d.vie <= 0) d.mesh.visible = false;
    }

    this.placerMains({ mixGauche, mixPoche, mixLevier, mixDroiteLevier, gaucheSuitPompe, gaucheRepos });
  }

  // Cinématique inverse : les mains suivent les points de prise de l'arme.
  placerMains(o) {
    const m = this.modele;
    this.pivot.updateMatrixWorld(true);
    const mat = m.groupe.matrixWorld;
    m.groupe.getWorldQuaternion(_qa);

    _v.copy(m.points.mainDroite).applyMatrix4(mat);
    if (o.mixDroiteLevier > 0) {
      _v2.copy(m.points.levier);
      _v2.z += m.pieces.levier.position.z;
      _v2.y -= 0.03;
      _v2.applyMatrix4(mat);
      _v.lerp(_v2, o.mixDroiteLevier);
    }
    ik2(this.brasD.epaule, this.brasD.coude, 0.31, 0.34, _v, _pole.set(0.6, -0.5, 0.4));
    this.orienterMain(this.brasD, _qa, DECALAGE_D);

    if (o.gaucheRepos) {
      _v.copy(REPOS_G);
    } else {
      _v.copy(m.points.mainGauche);
      if (o.gaucheSuitPompe) _v.z += m.pieces.pompe.position.z;
      _v.applyMatrix4(mat);
      if (o.mixGauche > 0) { _v2.copy(m.points.chargeur).applyMatrix4(mat); _v.lerp(_v2, o.mixGauche); }
      if (o.mixPoche > 0) _v.lerp(POCHE, o.mixPoche);
      if (o.mixLevier > 0) {
        _v2.copy(m.points.levier);
        _v2.z += m.pieces.levier.position.z + (m.id === "pistolet" ? m.pieces.culasse.position.z : 0);
        _v2.applyMatrix4(mat);
        _v.lerp(_v2, o.mixLevier);
      }
    }
    ik2(this.brasG.epaule, this.brasG.coude, 0.31, 0.34, _v, _pole.set(-0.7, -0.6, 0.1));
    this.orienterMain(this.brasG, _qa, DECALAGE_G);
  }

  orienterMain(bras, qArme, decalage) {
    bras.epaule.updateMatrixWorld(true);
    bras.coude.getWorldQuaternion(_q);
    bras.main.quaternion.copy(_q.invert()).multiply(qArme).multiply(decalage);
  }
}
