// Neon Strike : boucle principale, joueur, manches, effets et menus.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { construireCarte } from "./carte.js";
import { GestionBots, DIFFICULTES } from "./bots.js";
import { LogiqueArme, ModeleArme } from "./arme.js";
import { Hud } from "./hud.js";
import { Audio } from "./audio.js";
import { textureEclat, textureTrou } from "./textures.js";
import { RAYON_PERSO } from "./physique.js";

const $ = (id) => document.getElementById(id);
const DEG = Math.PI / 180;
const MANCHES_GAGNANTES = 5;
const NB_BOTS = 5;
const DUREE_MANCHE = 100;
const DUREE_PREPARATION = 5;
const RUEE_RECHARGE = 8;

// ===== Réglages (gardés dans ce navigateur) =====
const DEFAUTS = { sensibilite: 1, fov: 103, volume: 0.7, qualite: "moyenne", difficulte: "normal", fps: false };
const reglages = { ...DEFAUTS };
try { Object.assign(reglages, JSON.parse(localStorage.getItem("neonstrike-reglages") || "{}")); } catch (e) { /* stockage indisponible */ }
function sauverReglages() {
  try { localStorage.setItem("neonstrike-reglages", JSON.stringify(reglages)); } catch (e) { /* stockage indisponible */ }
}
const qualite = ["basse", "moyenne", "haute"].includes(reglages.qualite) ? reglages.qualite : "moyenne";

// ===== Rendu =====
const renderer = new THREE.WebGLRenderer({ antialias: qualite !== "basse", powerPreference: "high-performance" });
renderer.setPixelRatio(qualite === "haute" ? Math.min(devicePixelRatio, 2) : qualite === "moyenne" ? Math.min(devicePixelRatio, 1.25) : 1);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = qualite !== "basse";
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.domElement.className = "scene";
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 700);
camera.rotation.order = "YXZ";
scene.add(camera);

// Reflets réalistes : un environnement lumineux pour les surfaces métalliques.
const pmrem = new THREE.PMREMGenerator(renderer);
const environnement = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = environnement;
scene.environmentIntensity = 0.45;

const audio = new Audio();
audio.reglerVolume(reglages.volume);
const carte = construireCarte(scene, qualite);
const bots = new GestionBots(scene, carte, audio);
const modele = new ModeleArme();
const logique = new LogiqueArme();
const hud = new Hud(carte);
modele.scene.environment = environnement;
modele.scene.environmentIntensity = 0.7;
carte.barriere.activer(false);

let composer = null, bloom = null;
if (qualite !== "basse") {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const passeArme = new RenderPass(modele.scene, modele.camera);
  passeArme.clear = false;
  passeArme.clearDepth = true;
  composer.addPass(passeArme);
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.45, 0.86);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}
renderer.autoClear = composer ? true : false;

function rendre() {
  if (composer) { composer.render(); return; }
  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  renderer.render(modele.scene, modele.camera);
}

function redimensionner() {
  renderer.setSize(innerWidth, innerHeight);
  if (composer) composer.setSize(innerWidth, innerHeight);
  modele.redimensionner(innerWidth / innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", redimensionner);
redimensionner();

// ===== Effets : traçantes, étincelles, impacts, lumière de tir =====
const effets = { traçantes: [], etincelles: [], trous: [] };
const texEclat = textureEclat();
const matTrou = new THREE.MeshBasicMaterial({ map: textureTrou(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
const geoTrou = new THREE.PlaneGeometry(0.11, 0.11);
const lumiereTir = new THREE.PointLight(0xffc27a, 0, 9, 2);
scene.add(lumiereTir);

function tracante(a, b, couleur) {
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z)]);
  const ligne = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: couleur, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(ligne);
  effets.traçantes.push({ obj: ligne, vie: 0.06 });
}

function etincelles(p, n, couleur, nombre = 9) {
  const pos = new Float32Array(nombre * 3), vit = [];
  for (let i = 0; i < nombre; i++) {
    pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
    vit.push(new THREE.Vector3(n.x + (Math.random() - 0.5) * 1.6, n.y + Math.random() * 1.2, n.z + (Math.random() - 0.5) * 1.6).multiplyScalar(2 + Math.random() * 3));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: texEclat, color: couleur, size: 0.09, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(pts);
  effets.etincelles.push({ obj: pts, vit, vie: 0.35 });
}

function trou(p, n) {
  const m = new THREE.Mesh(geoTrou, matTrou);
  m.position.set(p.x + n.x * 0.005, p.y + n.y * 0.005, p.z + n.z * 0.005);
  m.lookAt(p.x + n.x, p.y + n.y, p.z + n.z);
  m.rotation.z = Math.random() * Math.PI;
  scene.add(m);
  effets.trous.push(m);
  if (effets.trous.length > 90) scene.remove(effets.trous.shift());
}

function majEffets(dt) {
  for (let i = effets.traçantes.length - 1; i >= 0; i--) {
    const t = effets.traçantes[i];
    t.vie -= dt;
    t.obj.material.opacity = Math.max(0, t.vie / 0.06) * 0.85;
    if (t.vie <= 0) { scene.remove(t.obj); t.obj.geometry.dispose(); t.obj.material.dispose(); effets.traçantes.splice(i, 1); }
  }
  for (let i = effets.etincelles.length - 1; i >= 0; i--) {
    const e = effets.etincelles[i];
    e.vie -= dt;
    const pos = e.obj.geometry.attributes.position;
    for (let k = 0; k < e.vit.length; k++) {
      e.vit[k].y -= 9.8 * dt;
      pos.setXYZ(k, pos.getX(k) + e.vit[k].x * dt, pos.getY(k) + e.vit[k].y * dt, pos.getZ(k) + e.vit[k].z * dt);
    }
    pos.needsUpdate = true;
    e.obj.material.opacity = Math.max(0, e.vie / 0.35);
    if (e.vie <= 0) { scene.remove(e.obj); e.obj.geometry.dispose(); e.obj.material.dispose(); effets.etincelles.splice(i, 1); }
  }
  lumiereTir.intensity *= Math.exp(-35 * dt);
}

function viderEffets() {
  for (const m of effets.trous) scene.remove(m);
  effets.trous = [];
}

// ===== État du jeu =====
const joueur = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), lacet: 0, tangage: 0, vie: 100, vivant: true, auSol: true,
  accroupi: false, hauteurYeux: 1.62, rueeT: 0, rueeRecharge: 0, rueeDir: new THREE.Vector3(), pasT: 0, sursaut: 0,
};
const partie = {
  etat: "chargement", phase: "preparation", phaseT: 0, chrono: DUREE_MANCHE, manche: 0, scoreMoi: 0, scoreEux: 0,
  killsManche: 0, stats: null, compteur: 0,
};
const touches = {};
const souris = { gauche: false, droit: false, dx: 0, dy: 0 };
let temps = 0;
let visee = false;
let botsVus = [];
let vueT = 0;
let etapeRechargeSon = 0;

function nouvellesStats() {
  return { kills: 0, morts: 0, tetes: 0, tirs: 0, touches: 0, degats: 0, aces: 0 };
}

function nouvellePartie() {
  Object.assign(partie, { manche: 0, scoreMoi: 0, scoreEux: 0, stats: nouvellesStats() });
  nouvelleManche();
}

function nouvelleManche() {
  partie.manche++;
  partie.phase = "preparation";
  partie.phaseT = DUREE_PREPARATION;
  partie.compteur = DUREE_PREPARATION;
  partie.chrono = DUREE_MANCHE;
  partie.killsManche = 0;
  const d = carte.departJoueur();
  joueur.pos.set(d.x, 0, d.z);
  joueur.vel.set(0, 0, 0);
  Object.assign(joueur, { lacet: 0, tangage: 0, vie: 100, vivant: true, auSol: true, accroupi: false, hauteurYeux: 1.62, rueeT: 0, rueeRecharge: 0, sursaut: 0 });
  logique.reinitialiser();
  etapeRechargeSon = 0;
  modele.sortir();
  modele.pivot.visible = true;
  bots.nouvelleManche(reglages.difficulte, NB_BOTS);
  carte.barriere.activer(true);
  hud.vider();
  viderEffets();
  hud.annonce(`MANCHE ${partie.manche}`, "Phase de préparation", "#7cc4ff", 2.4);
}

function finManche(gagnee, titre, sous) {
  if (partie.phase !== "combat") return;
  partie.phase = "fin";
  partie.phaseT = 4;
  if (gagnee) partie.scoreMoi++; else partie.scoreEux++;
  if (gagnee && partie.killsManche >= NB_BOTS) {
    partie.stats.aces++;
    hud.annonce("ACE", "Tu as éliminé toute l'équipe", "#ffd166", 3.6);
  } else {
    hud.annonce(titre, sous, gagnee ? "#7cffd4" : "#ff5f6d", 3.6);
  }
  audio.annonce(gagnee ? "victoire" : "defaite");
}

function finPartie() {
  partie.etat = "fin";
  souris.gauche = souris.droit = false;
  if (document.pointerLockElement) document.exitPointerLock();
  const victoire = partie.scoreMoi > partie.scoreEux;
  const s = partie.stats;
  $("fin-titre").textContent = victoire ? "VICTOIRE" : "DÉFAITE";
  $("fin-titre").style.color = victoire ? "var(--cyan)" : "var(--rouge)";
  $("fin-score").textContent = `${partie.scoreMoi} manches à ${partie.scoreEux} · difficulté ${DIFFICULTES[reglages.difficulte].nom.toLowerCase()}`;
  const ratio = s.morts ? (s.kills / s.morts).toFixed(1) : String(s.kills);
  const cases = [
    [s.kills, "Éliminations"], [s.morts, "Morts"], [ratio, "Ratio K/D"],
    [s.kills ? Math.round((s.tetes / s.kills) * 100) + " %" : "0 %", "Headshots"],
    [s.tirs ? Math.round((s.touches / s.tirs) * 100) + " %" : "0 %", "Précision"],
    [Math.round(s.degats), "Dégâts infligés"],
  ];
  const conteneur = $("fin-stats");
  conteneur.innerHTML = "";
  for (const [v, l] of cases) {
    const d = document.createElement("div");
    const fort = document.createElement("strong"); fort.textContent = v;
    const sp = document.createElement("span"); sp.textContent = l;
    d.append(fort, sp);
    conteneur.appendChild(d);
  }
  afficherEcran("ecran-fin");
  $("hud").classList.add("cache");
  modele.pivot.visible = false;
}

// ===== Tir du joueur =====
const origine = new THREE.Vector3();
function directionVue(yawDecal = 0, pitchDecal = 0) {
  const yaw = joueur.lacet + logique.reculYaw + yawDecal;
  const pitch = joueur.tangage + logique.reculPitch + pitchDecal;
  return new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
}

function positionBouche() {
  const avant = directionVue();
  const droite = new THREE.Vector3(Math.cos(joueur.lacet), 0, -Math.sin(joueur.lacet));
  const k = modele.viseeK;
  return camera.position.clone().addScaledVector(avant, 0.75).addScaledVector(droite, 0.17 * (1 - k)).add(new THREE.Vector3(0, -0.13 * (1 - k) - 0.05 * k, 0));
}

function etatTir() {
  return { vitesse: Math.hypot(joueur.vel.x, joueur.vel.z), enLAir: !joueur.auSol, accroupi: joueur.accroupi, vise: visee };
}

function tirer() {
  const decal = logique.tirer(temps, etatTir());
  partie.stats.tirs++;
  const dir = directionVue(decal.yaw, decal.pitch);
  origine.copy(camera.position);
  const mur = carte.monde.rayon(origine.x, origine.y, origine.z, dir.x, dir.y, dir.z, 250);
  const tMur = mur ? mur.t : 250;
  const cible = bots.toucher(origine.x, origine.y, origine.z, dir.x, dir.y, dir.z, tMur);
  const t = cible ? cible.t : tMur;
  const fin = origine.clone().addScaledVector(dir, t);
  const bouche = positionBouche();
  tracante(bouche, fin, 0xfff0c0);
  lumiereTir.position.copy(bouche);
  lumiereTir.intensity = 6;
  modele.tir();
  audio.tirJoueur();
  bots.entendre(joueur.pos.x, joueur.pos.z, 32);

  if (cible) {
    const degats = logique.stats.degats[cible.partie];
    const tete = cible.partie === "tete";
    partie.stats.touches++;
    partie.stats.degats += Math.min(degats, cible.bot.vie);
    etincelles(fin, dir.clone().negate(), tete ? 0xff8a5c : 0xff5f6d, tete ? 16 : 8);
    const mort = bots.blesser(cible.bot, degats, joueur.pos.x, joueur.pos.z, tete);
    if (!mort) { hud.touche(tete, false); audio.touche(tete); }
  } else if (mur) {
    const n = { x: mur.nx, y: mur.ny, z: mur.nz };
    trou(fin, n);
    etincelles(fin, n, 0xffc27a);
    audio.impact(fin);
  }
}

bots.surMort = (bot, tete) => {
  partie.killsManche++;
  partie.stats.kills++;
  if (tete) partie.stats.tetes++;
  hud.fil("TOI", bot.nom, tete, "tueur");
  hud.touche(tete, true);
  audio.elimination(partie.killsManche);
  audio.touche(tete);
  if (bots.vivants().length === 0) finManche(true, "MANCHE GAGNÉE", `${partie.killsManche} élimination${partie.killsManche > 1 ? "s" : ""}`);
};

bots.surTir = (bot, depart, arrivee, touche, mur) => {
  tracante(depart, arrivee, 0xff7a6b);
  if (mur) {
    const n = { x: mur.nx, y: mur.ny, z: mur.nz };
    if (Math.random() < 0.6) trou(arrivee, n);
    if (Math.hypot(arrivee.x - joueur.pos.x, arrivee.z - joueur.pos.z) < 8) etincelles(arrivee, n, 0xffc27a, 6);
  }
  if (touche) blesserJoueur(touche.degats, bot, touche.partie === "tete");
};

function blesserJoueur(degats, bot, tete) {
  if (!joueur.vivant || partie.phase !== "combat") return;
  joueur.vie -= degats;
  joueur.sursaut = Math.min(1, joueur.sursaut + (tete ? 1 : 0.5));
  const angleAttaquant = Math.atan2(bot.x - joueur.pos.x, bot.z - joueur.pos.z);
  const angleVue = Math.atan2(-Math.sin(joueur.lacet), -Math.cos(joueur.lacet));
  hud.degat(-(angleAttaquant - angleVue), tete);
  audio.degat();
  if (joueur.vie <= 0) {
    joueur.vie = 0;
    joueur.vivant = false;
    partie.stats.morts++;
    souris.gauche = false;
    hud.fil(bot.nom, "TOI", tete, "victime");
    finManche(false, "ÉLIMINÉ", `par ${bot.nom}${tete ? " (headshot)" : ""}`);
  }
}

// ===== Joueur =====
function majJoueur(dt) {
  const monde = carte.monde;
  const enJeu = (partie.phase === "combat" || partie.phase === "preparation") && joueur.vivant;
  visee = enJeu && souris.droit && logique.rechargeT <= 0;

  // Accroupi (se relève seulement s'il y a la place)
  const veutAccroupi = enJeu && (touches.ControlLeft || touches.ControlRight || touches.KeyC);
  if (veutAccroupi) joueur.accroupi = true;
  else if (joueur.accroupi && !monde.bloque(joueur.pos.x, joueur.pos.z, joueur.pos.y, RAYON_PERSO, 1.8)) joueur.accroupi = false;
  const yeuxCible = joueur.accroupi ? 1.15 : 1.62;
  joueur.hauteurYeux += (yeuxCible - joueur.hauteurYeux) * (1 - Math.exp(-14 * dt));
  const taille = joueur.accroupi ? 1.3 : 1.8;

  // Direction voulue (codes physiques : ZQSD sur AZERTY = WASD sur QWERTY)
  const avant = enJeu ? (touches.KeyW ? 1 : 0) - (touches.KeyS ? 1 : 0) : 0;
  const cote = enJeu ? (touches.KeyD ? 1 : 0) - (touches.KeyA ? 1 : 0) : 0;
  const s = Math.sin(joueur.lacet), c = Math.cos(joueur.lacet);
  let wx = -s * avant + c * cote, wz = -c * avant - s * cote;
  const n = Math.hypot(wx, wz);
  const sprint = (touches.ShiftLeft || touches.ShiftRight) && avant > 0 && !joueur.accroupi && !visee;
  const vitesseMax = joueur.accroupi ? 2.3 : visee ? 3.6 : sprint ? 6.6 : 5.0;
  if (n > 0) { wx = wx / n * vitesseMax; wz = wz / n * vitesseMax; }

  joueur.rueeRecharge = Math.max(0, joueur.rueeRecharge - dt);
  if (joueur.rueeT > 0) {
    joueur.rueeT -= dt;
    joueur.vel.x = joueur.rueeDir.x * 19;
    joueur.vel.z = joueur.rueeDir.z * 19;
  } else {
    const k = 1 - Math.exp(-(joueur.auSol ? 14 : 2) * dt);
    joueur.vel.x += (wx - joueur.vel.x) * k;
    joueur.vel.z += (wz - joueur.vel.z) * k;
  }

  const nx = joueur.pos.x + joueur.vel.x * dt;
  if (!monde.bloque(nx, joueur.pos.z, joueur.pos.y, RAYON_PERSO, taille)) joueur.pos.x = nx; else joueur.vel.x = 0;
  const nz = joueur.pos.z + joueur.vel.z * dt;
  if (!monde.bloque(joueur.pos.x, nz, joueur.pos.y, RAYON_PERSO, taille)) joueur.pos.z = nz; else joueur.vel.z = 0;

  // Les bots sont solides
  for (const b of bots.liste) {
    if (!b.vivant) continue;
    const dx = joueur.pos.x - b.x, dz = joueur.pos.z - b.z, d = Math.hypot(dx, dz), min = RAYON_PERSO + 0.32;
    if (d > 0.001 && d < min && joueur.pos.y < 1.7) {
      const px = joueur.pos.x + dx / d * (min - d), pz = joueur.pos.z + dz / d * (min - d);
      if (!monde.bloque(px, pz, joueur.pos.y, RAYON_PERSO, taille)) { joueur.pos.x = px; joueur.pos.z = pz; }
    }
  }

  // Gravité et saut
  const avantY = joueur.pos.y;
  joueur.vel.y -= 20 * dt;
  joueur.pos.y += joueur.vel.y * dt;
  const sol = monde.hauteurSol(joueur.pos.x, joueur.pos.z, avantY);
  const etaitEnLAir = !joueur.auSol;
  if (joueur.pos.y <= sol) {
    joueur.pos.y = sol;
    joueur.vel.y = 0;
    joueur.auSol = true;
    if (etaitEnLAir && avantY - sol > 0.3) audio.pasJoueur();
  } else joueur.auSol = false;

  // Bruits de pas : on t'entend courir, pas marcher accroupi.
  const vit = Math.hypot(joueur.vel.x, joueur.vel.z);
  if (joueur.auSol && vit > 2.6 && !joueur.accroupi && !visee) {
    joueur.pasT -= dt * vit / 5;
    if (joueur.pasT <= 0) {
      joueur.pasT = 0.4;
      audio.pasJoueur();
      if (partie.phase === "combat") bots.entendre(joueur.pos.x, joueur.pos.z, sprint ? 17 : 9);
    }
  }

  // Tir et rechargement
  logique.maj(dt, temps);
  if (enJeu && partie.phase === "combat" && souris.gauche && joueur.rueeT <= 0) {
    if (logique.peutTirer(temps)) tirer();
    else if (logique.mun <= 0 && logique.reserve <= 0 && !souris.videJoue) { audio.vide(); souris.videJoue = true; }
  }
  const progression = logique.rechargeT > 0 ? 1 - logique.rechargeT / logique.stats.rechargement : -1;
  if (progression >= 0) {
    const etapes = [0.22, 0.64, 0.86];
    if (etapeRechargeSon < 3 && progression >= etapes[etapeRechargeSon]) { audio.rechargement(etapeRechargeSon); etapeRechargeSon++; }
  } else etapeRechargeSon = 0;

  // Caméra
  joueur.sursaut *= Math.exp(-8 * dt);
  const balancement = joueur.auSol && joueur.vivant ? Math.sin(temps * (sprint ? 13 : 10)) * 0.028 * Math.min(vit / 6, 1) * (1 - modele.viseeK * 0.7) : 0;
  if (joueur.vivant) {
    camera.position.set(joueur.pos.x, joueur.pos.y + joueur.hauteurYeux + balancement, joueur.pos.z);
    const penche = -(joueur.vel.x * c - joueur.vel.z * s) * 0.0035;
    camera.rotation.set(joueur.tangage + logique.reculPitch + joueur.sursaut * 0.02, joueur.lacet + logique.reculYaw, penche);
  } else {
    camera.position.y += (joueur.pos.y + 0.35 - camera.position.y) * (1 - Math.exp(-4 * dt));
    camera.rotation.z += (0.5 - camera.rotation.z) * (1 - Math.exp(-3 * dt));
    modele.pivot.visible = false;
  }

  // Champ de vision horizontal -> vertical, zoom en visée
  const hfov = reglages.fov * DEG;
  const vfov = 2 * Math.atan(Math.tan(hfov / 2) / camera.aspect);
  const vfovVisee = 2 * Math.atan(Math.tan(vfov / 2) / 1.3);
  const fovFinal = (vfov + (vfovVisee - vfov) * modele.viseeK) / DEG;
  if (Math.abs(camera.fov - fovFinal) > 0.01) { camera.fov = fovFinal; camera.updateProjectionMatrix(); }

  modele.maj({
    dt, temps, vitesse: vit, auSol: joueur.auSol, vise: visee, sprint: sprint && vit > 4,
    souris: { x: souris.dx, y: souris.dy }, recharge: progression,
  });
  souris.dx = souris.dy = 0;

  audio.ecouteur(camera.position.x, camera.position.y, camera.position.z, -s, 0, -c);
}

function ruee() {
  if (partie.phase !== "combat" || !joueur.vivant || joueur.rueeRecharge > 0) return;
  const avant = (touches.KeyW ? 1 : 0) - (touches.KeyS ? 1 : 0);
  const cote = (touches.KeyD ? 1 : 0) - (touches.KeyA ? 1 : 0);
  const s = Math.sin(joueur.lacet), c = Math.cos(joueur.lacet);
  const a = avant || cote ? avant : 1;
  let dx = -s * a + c * cote, dz = -c * a - s * cote;
  const n = Math.hypot(dx, dz) || 1;
  joueur.rueeDir.set(dx / n, 0, dz / n);
  joueur.rueeT = 0.2;
  joueur.rueeRecharge = RUEE_RECHARGE;
  audio.ruee();
}

// Bots visibles par le joueur (affichés sur la minimap)
function majVision(dt) {
  vueT -= dt;
  if (vueT > 0) return;
  vueT = 0.15;
  botsVus = [];
  if (!joueur.vivant) return;
  const avant = directionVue();
  const yeux = camera.position;
  const cosChamp = Math.cos((reglages.fov / 2 + 8) * DEG);
  for (const b of bots.liste) {
    if (!b.vivant) continue;
    const dx = b.x - yeux.x, dy = 1.4 - yeux.y, dz = b.z - yeux.z, d = Math.hypot(dx, dy, dz);
    if ((dx * avant.x + dy * avant.y + dz * avant.z) / d < cosChamp) continue;
    if (carte.monde.ligneLibre(yeux.x, yeux.y, yeux.z, b.x, 1.6, b.z) || carte.monde.ligneLibre(yeux.x, yeux.y, yeux.z, b.x, 0.9, b.z)) {
      botsVus.push(b);
      if (Math.random() < 0.3) hud.ping(b.x, b.z);
    }
  }
}

// ===== Boucle =====
function simuler(dt) {
  temps += dt;
  if (partie.phase === "preparation") {
    partie.phaseT -= dt;
    const reste = Math.ceil(partie.phaseT);
    if (reste < partie.compteur && reste <= 3 && reste > 0) { audio.annonce("compte"); hud.annonce(String(reste), "", "#e9f1ff", 0.8); }
    partie.compteur = reste;
    if (partie.phaseT <= 0) {
      partie.phase = "combat";
      carte.barriere.activer(false);
      hud.annonce("COMBAT", `Élimine les ${NB_BOTS} bots`, "#7cffd4", 1.6);
      audio.annonce("debut");
    }
  } else if (partie.phase === "combat") {
    partie.chrono -= dt;
    if (partie.chrono <= 0) finManche(false, "TEMPS ÉCOULÉ", "Les défenseurs gagnent la manche");
  } else if (partie.phase === "fin") {
    partie.phaseT -= dt;
    if (partie.phaseT <= 0) {
      if (partie.scoreMoi >= MANCHES_GAGNANTES || partie.scoreEux >= MANCHES_GAGNANTES) finPartie();
      else nouvelleManche();
    }
  }
  if (partie.etat === "jeu") {
    majJoueur(dt);
    bots.maj(dt, temps, joueur, partie.phase);
    majVision(dt);
    majEffets(dt);
    const progression = logique.rechargeT > 0 ? 1 - logique.rechargeT / logique.stats.rechargement : -1;
    const imprecision = logique.imprecision(etatTir());
    hud.maj(dt, {
      temps, vie: joueur.vie, vivant: joueur.vivant, mun: logique.mun, reserve: logique.reserve, recharge: progression,
      scoreMoi: partie.scoreMoi, scoreEux: partie.scoreEux, chrono: partie.phase === "preparation" ? partie.phaseT : partie.chrono,
      phase: partie.phase, manche: partie.manche, botsTotal: bots.liste.length, botsVivants: bots.vivants().length,
      rueeRecharge: joueur.rueeRecharge, rueeDuree: RUEE_RECHARGE, vise: modele.viseeK > 0.5,
      imprecisionPx: (Math.tan(imprecision * DEG) / Math.tan(camera.fov * DEG / 2)) * (innerHeight / 2),
      x: joueur.pos.x, z: joueur.pos.z, lacet: joueur.lacet, botsVus,
    });
  }
}

const horloge = new THREE.Timer();
let fpsT = 0, fpsN = 0;
let orbite = 0;

function boucle() {
  requestAnimationFrame(boucle);
  horloge.update();
  const dt = Math.min(horloge.getDelta(), 0.05);
  fpsT += dt; fpsN++;
  if (fpsT >= 0.5) { if (reglages.fps) $("fps").textContent = Math.round(fpsN / fpsT) + " FPS"; fpsT = 0; fpsN = 0; }

  if (partie.etat === "jeu") {
    simuler(dt);
  } else if (partie.etat === "menu") {
    // Survol cinématique de l'arène derrière le menu
    orbite += dt * 0.05;
    camera.position.set(Math.sin(orbite) * 30 + 8, 15 + Math.sin(orbite * 0.7) * 1.5, Math.cos(orbite) * 22);
    camera.lookAt(6, 0, -3);
    camera.fov = 55;
    camera.updateProjectionMatrix();
    modele.pivot.visible = false;
    majEffets(dt);
  }
  if (partie.etat !== "chargement") rendre();
}

// ===== Commandes =====
const canvas = renderer.domElement;
function verrouiller() {
  try {
    const p = canvas.requestPointerLock({ unadjustedMovement: true });
    if (p && p.catch) p.catch(() => { try { canvas.requestPointerLock(); } catch (e) { /* refusé */ } });
  } catch (e) {
    try { canvas.requestPointerLock(); } catch (e2) { /* refusé : on joue quand même */ }
  }
}

addEventListener("keydown", (e) => {
  touches[e.code] = true;
  if (partie.etat !== "jeu") {
    if (e.code === "Escape" && document.querySelector(".ecran.visible [data-retour]")) retourEcran();
    return;
  }
  if (["Space", "Tab", "ControlLeft", "KeyC", "KeyE", "KeyR"].includes(e.code)) e.preventDefault();
  if (e.code === "KeyR" && joueur.vivant && partie.phase !== "fin") logique.lancerRechargement();
  if (e.code === "KeyE") ruee();
  if (e.code === "Space" && joueur.auSol && joueur.vivant && !joueur.accroupi && partie.phase !== "fin") { joueur.vel.y = 7.2; joueur.auSol = false; }
  if (e.code === "Escape" || e.code === "KeyP") {
    if (document.pointerLockElement) document.exitPointerLock();
    pause();
  }
});
addEventListener("keyup", (e) => { touches[e.code] = false; });
addEventListener("blur", () => { for (const k in touches) touches[k] = false; souris.gauche = souris.droit = false; });

canvas.addEventListener("mousedown", (e) => {
  if (partie.etat !== "jeu") return;
  if (!document.pointerLockElement) verrouiller();
  if (e.button === 0) { souris.gauche = true; souris.videJoue = false; }
  if (e.button === 2) souris.droit = true;
});
addEventListener("mouseup", (e) => {
  if (e.button === 0) souris.gauche = false;
  if (e.button === 2) souris.droit = false;
});
addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("mousemove", (e) => {
  if (partie.etat !== "jeu" || document.pointerLockElement !== canvas || !joueur.vivant) return;
  const k = 0.0021 * reglages.sensibilite * (visee ? 0.78 : 1);
  joueur.lacet -= e.movementX * k;
  joueur.tangage = Math.max(-1.5, Math.min(1.5, joueur.tangage - e.movementY * k));
  souris.dx += e.movementX;
  souris.dy += e.movementY;
});

let verrouAvant = false;
document.addEventListener("pointerlockchange", () => {
  const verrou = document.pointerLockElement === canvas;
  if (verrouAvant && !verrou && partie.etat === "jeu") pause();
  verrouAvant = verrou;
});

// ===== Écrans et menus =====
const pile = [];
function afficherEcran(id) {
  document.querySelectorAll(".ecran").forEach((e) => e.classList.toggle("visible", e.id === id));
}
function ouvrirEcran(id) {
  const actuel = document.querySelector(".ecran.visible");
  if (actuel) pile.push(actuel.id);
  afficherEcran(id);
}
function retourEcran() {
  afficherEcran(pile.pop() || (partie.etat === "pause" ? "ecran-pause" : "ecran-menu"));
}
document.querySelectorAll("[data-ouvre]").forEach((b) => b.addEventListener("click", () => ouvrirEcran(b.dataset.ouvre)));
document.querySelectorAll("[data-retour]").forEach((b) => b.addEventListener("click", retourEcran));

function demarrerPartie() {
  audio.demarrer();
  pile.length = 0;
  afficherEcran(null);
  $("hud").classList.remove("cache");
  partie.etat = "jeu";
  nouvellePartie();
  verrouiller();
}

function pause() {
  if (partie.etat !== "jeu") return;
  partie.etat = "pause";
  souris.gauche = souris.droit = false;
  for (const k in touches) touches[k] = false;
  $("pause-score").textContent = `Manche ${partie.manche} · ${partie.scoreMoi} à ${partie.scoreEux}`;
  pile.length = 0;
  afficherEcran("ecran-pause");
}

function reprendre() {
  audio.demarrer();
  pile.length = 0;
  afficherEcran(null);
  partie.etat = "jeu";
  horloge.update();
  verrouiller();
}

function allerAuMenu() {
  partie.etat = "menu";
  pile.length = 0;
  bots.vider();
  viderEffets();
  carte.barriere.activer(false);
  $("hud").classList.add("cache");
  afficherEcran("ecran-menu");
}

$("bouton-jouer").addEventListener("click", demarrerPartie);
$("bouton-reprendre").addEventListener("click", reprendre);
$("bouton-abandon").addEventListener("click", allerAuMenu);
$("bouton-rejouer").addEventListener("click", demarrerPartie);
$("bouton-menu").addEventListener("click", allerAuMenu);

// Difficulté
const boutonsDiff = document.querySelectorAll("#choix-difficulte button");
function majDifficulte() {
  boutonsDiff.forEach((b) => { b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(b.dataset.valeur === reglages.difficulte)); });
}
boutonsDiff.forEach((b) => b.addEventListener("click", () => { reglages.difficulte = b.dataset.valeur; sauverReglages(); majDifficulte(); }));
if (!DIFFICULTES[reglages.difficulte]) reglages.difficulte = "normal";
majDifficulte();

// Paramètres
function lierReglage(id, cle, format) {
  const champ = $("r-" + id), sortie = $("o-" + id);
  champ.value = reglages[cle];
  if (sortie) sortie.textContent = format(reglages[cle]);
  champ.addEventListener("input", () => {
    reglages[cle] = parseFloat(champ.value);
    if (sortie) sortie.textContent = format(reglages[cle]);
    if (cle === "volume") audio.reglerVolume(reglages.volume);
    sauverReglages();
  });
}
lierReglage("sensibilite", "sensibilite", (v) => v.toFixed(2));
lierReglage("fov", "fov", (v) => v + "°");
lierReglage("volume", "volume", (v) => Math.round(v * 100) + " %");
$("r-qualite").value = qualite;
$("r-qualite").addEventListener("change", (e) => {
  reglages.qualite = e.target.value;
  sauverReglages();
  $("note-qualite").hidden = reglages.qualite === qualite;
});
$("r-fps").checked = !!reglages.fps;
$("fps").hidden = !reglages.fps;
$("r-fps").addEventListener("change", (e) => { reglages.fps = e.target.checked; $("fps").hidden = !reglages.fps; sauverReglages(); });

// ===== Démarrage =====
partie.etat = "menu";
afficherEcran("ecran-menu");
boucle();

// Accès pour les tests automatiques uniquement (adresse ...?test)
if (new URLSearchParams(location.search).has("test")) {
  window.__neon = {
    partie, joueur, bots, logique, carte, demarrerPartie, camera, touches, souris,
    avancer(secondes) { for (let t = 0; t < secondes; t += 1 / 60) { if (partie.etat !== "jeu") break; simuler(1 / 60); } },
  };
}
