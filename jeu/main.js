// Neon Strike : initialisation, rendu, boucle principale (physique à pas fixe), joueur, manches et menus.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { construireCarte } from "./carte.js";
import { GestionBots, DIFFICULTES } from "./bots.js";
import { LogiqueArme, ModeleArme } from "./arme.js";
import { Hud } from "./hud.js";
import { Audio } from "./audio.js";
import { Effets } from "./effets.js";
import { RAYON_PERSO } from "./physique.js";

const $ = (id) => document.getElementById(id);
const DEG = Math.PI / 180;
const MANCHES_GAGNANTES = 5;
const NB_BOTS = 5;
const DUREE_MANCHE = 100;
const DUREE_PREPARATION = 5;
const RUEE_RECHARGE = 8;
const PAS = 1 / 60; // pas fixe de la simulation (indépendant des images par seconde)

// ===== Réglages (gardés dans ce navigateur) =====
const DEFAUTS = { sensibilite: 1, fov: 103, volume: 0.7, ambiance: 0.5, bob: 1, qualite: "moyenne", difficulte: "normal", fps: false };
const reglages = { ...DEFAUTS };
try { Object.assign(reglages, JSON.parse(localStorage.getItem("neonstrike-reglages") || "{}")); } catch (e) { /* stockage indisponible */ }
function sauverReglages() {
  try { localStorage.setItem("neonstrike-reglages", JSON.stringify(reglages)); } catch (e) { /* stockage indisponible */ }
}
const qualite = ["basse", "moyenne", "haute"].includes(reglages.qualite) ? reglages.qualite : "moyenne";

// ===== Profils graphiques =====
const PROFILS = {
  basse: { ratio: Math.min(devicePixelRatio, 1), ombres: false, msaa: 0, bloom: false },
  moyenne: { ratio: Math.min(devicePixelRatio, 1.25), ombres: true, msaa: 4, bloom: true },
  haute: { ratio: Math.min(devicePixelRatio, 2), ombres: true, msaa: 4, bloom: true },
};
const profil = PROFILS[qualite];

const renderer = new THREE.WebGLRenderer({ antialias: !profil.msaa, powerPreference: "high-performance" });
renderer.setPixelRatio(profil.ratio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = profil.ombres;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.domElement.className = "scene";
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 700);
camera.rotation.order = "YXZ";
scene.add(camera);

const audio = new Audio();
audio.reglerVolume(reglages.volume);
audio.reglerAmbiance(reglages.ambiance);
const carte = construireCarte(scene, qualite);
const bots = new GestionBots(scene, carte, audio, qualite);
const modele = new ModeleArme(qualite);
const logique = new LogiqueArme();
const hud = new Hud(carte);
const effets = new Effets(scene, qualite);
carte.barriere.activer(false);

// Reflets : l'environnement du monde vient du ciel du soir (cohérent avec l'éclairage),
// celui de l'arme d'un studio neutre (elle reste lisible partout).
const pmrem = new THREE.PMREMGenerator(renderer);
const sceneCiel = new THREE.Scene();
sceneCiel.add(carte.ciel.clone());
const solCiel = new THREE.Mesh(new THREE.CircleGeometry(400, 16), new THREE.MeshBasicMaterial({ color: 0x2a2730 }));
solCiel.rotation.x = -Math.PI / 2;
solCiel.position.y = -2;
sceneCiel.add(solCiel);
scene.environment = pmrem.fromScene(sceneCiel, 0, 1, 1000).texture;
scene.environmentIntensity = 0.9;
modele.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
modele.scene.environmentIntensity = 0.65;

// ===== Post-traitement =====
// Étalonnage léger appliqué en fin de chaîne : contraste, saturation, vignette discrète.
const Etalonnage = {
  uniforms: { tDiffuse: { value: null }, contraste: { value: 1.07 }, saturation: { value: 1.08 }, vignette: { value: 0.22 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float contraste, saturation, vignette; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = (c.rgb - 0.5) * contraste + 0.5;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, saturation);
      vec2 d = vUv - 0.5;
      col *= 1.0 - vignette * smoothstep(0.35, 0.85, length(d * vec2(1.25, 1.0)));
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
};

let composer = null;
if (profil.msaa || profil.bloom) {
  const cible = new THREE.WebGLRenderTarget(innerWidth * profil.ratio, innerHeight * profil.ratio, { type: THREE.HalfFloatType, samples: profil.msaa });
  composer = new EffectComposer(renderer, cible);
  composer.addPass(new RenderPass(scene, camera));
  const passeArme = new RenderPass(modele.scene, modele.camera);
  passeArme.clear = false;
  passeArme.clearDepth = true;
  composer.addPass(passeArme);
  if (profil.bloom) composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.3, 0.35, 0.92));
  composer.addPass(new OutputPass());
  composer.addPass(new ShaderPass(Etalonnage));
}
renderer.autoClear = !!composer;

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

// ===== État du jeu =====
const joueur = {
  pos: new THREE.Vector3(), precedente: new THREE.Vector3(), vel: new THREE.Vector3(), lacet: 0, tangage: 0, vie: 100, vivant: true, auSol: true,
  accroupi: false, hauteurYeux: 1.62, rueeT: 0, rueeRecharge: 0, rueeDir: new THREE.Vector3(), pasT: 0, sursaut: 0, sprint: false, chute: 0,
};
const partie = {
  etat: "chargement", phase: "preparation", phaseT: 0, chrono: DUREE_MANCHE, manche: 0, scoreMoi: 0, scoreEux: 0,
  killsManche: 0, stats: null, compteur: 0,
};
const touches = {};
const souris = { gauche: false, droit: false, dx: 0, dy: 0, videJoue: false };
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
  joueur.precedente.copy(joueur.pos);
  joueur.vel.set(0, 0, 0);
  Object.assign(joueur, { lacet: 0, tangage: 0, vie: 100, vivant: true, auSol: true, accroupi: false, hauteurYeux: 1.62, rueeT: 0, rueeRecharge: 0, sursaut: 0, chute: 0 });
  camera.rotation.z = 0;
  logique.reinitialiser();
  etapeRechargeSon = 0;
  modele.sortir();
  bots.nouvelleManche(reglages.difficulte, NB_BOTS);
  carte.barriere.activer(true);
  hud.vider();
  effets.vider();
  hud.annonce(`MANCHE ${partie.manche}`, "Phase de préparation", "#7cc4ff", 2.4);
  audio.annonce("manche");
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
const oeil = new THREE.Vector3(), dirTir = new THREE.Vector3(), finTir = new THREE.Vector3(), bouche = new THREE.Vector3(), normale = new THREE.Vector3();
function directionVue(cible, yawDecal = 0, pitchDecal = 0) {
  const yaw = joueur.lacet + logique.reculYaw + yawDecal;
  const pitch = joueur.tangage + logique.reculPitch + pitchDecal;
  return cible.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
}

function positionBouche(cible) {
  const k = modele.viseeK;
  const s = Math.sin(joueur.lacet), c = Math.cos(joueur.lacet);
  directionVue(cible);
  cible.multiplyScalar(0.75);
  cible.x += oeil.x + c * 0.17 * (1 - k);
  cible.y += oeil.y - 0.13 * (1 - k) - 0.05 * k;
  cible.z += oeil.z - s * 0.17 * (1 - k);
  return cible;
}

function etatTir() {
  return { vitesse: Math.hypot(joueur.vel.x, joueur.vel.z), enLAir: !joueur.auSol, accroupi: joueur.accroupi, vise: visee };
}

function tirer() {
  const decal = logique.tirer(temps, etatTir());
  partie.stats.tirs++;
  oeil.set(joueur.pos.x, joueur.pos.y + joueur.hauteurYeux, joueur.pos.z);
  directionVue(dirTir, decal.yaw, decal.pitch);
  // Même géométrie pour l'affichage et pour le calcul : les murs arrêtent les balles avant les bots.
  const mur = carte.monde.rayon(oeil.x, oeil.y, oeil.z, dirTir.x, dirTir.y, dirTir.z, 250);
  const tMur = mur ? mur.t : 250;
  const cible = bots.toucher(oeil.x, oeil.y, oeil.z, dirTir.x, dirTir.y, dirTir.z, tMur);
  const t = cible ? cible.t : tMur;
  finTir.copy(oeil).addScaledVector(dirTir, t);
  positionBouche(bouche);
  effets.tracante(bouche, finTir, 0xffe9b8);
  effets.flashTir(bouche);
  modele.tir();
  audio.tirJoueur();
  bots.entendre(joueur.pos.x, joueur.pos.z, 32);

  if (cible) {
    const degats = logique.stats.degats[cible.partie];
    const tete = cible.partie === "tete";
    partie.stats.touches++;
    partie.stats.degats += Math.min(degats, cible.bot.vie);
    normale.copy(dirTir).negate();
    effets.etincellesEn(finTir, normale, tete ? 0xffb070 : 0xff6a5a, tete ? 14 : 7);
    const mort = bots.blesser(cible.bot, degats, joueur.pos.x, joueur.pos.z, tete);
    if (!mort) { hud.touche(tete, false); audio.touche(tete); }
  } else if (mur) {
    normale.set(mur.nx, mur.ny, mur.nz);
    effets.trou(finTir, normale);
    effets.etincellesEn(finTir, normale, 0xffc27a, 6);
    effets.poussiere(finTir, normale);
    audio.impact(finTir);
  }
}

bots.surMort = (bot, tete) => {
  partie.killsManche++;
  partie.stats.kills++;
  if (tete) partie.stats.tetes++;
  hud.fil("TOI", bot.nom, tete, "tueur");
  hud.touche(tete, true);
  hud.elimination(partie.killsManche, tete);
  audio.elimination(partie.killsManche);
  if (bots.vivants().length === 0) finManche(true, "MANCHE GAGNÉE", `${partie.killsManche} élimination${partie.killsManche > 1 ? "s" : ""}`);
};

bots.surTir = (bot, depart, arrivee, touche, mur) => {
  effets.tracante(depart, arrivee, 0xff8a70, 0.05);
  if (mur) {
    normale.set(mur.nx, mur.ny, mur.nz);
    if (Math.random() < 0.6) effets.trou(arrivee, normale);
    if (Math.hypot(arrivee.x - joueur.pos.x, arrivee.z - joueur.pos.z) < 8) { effets.etincellesEn(arrivee, normale, 0xffc27a, 5); audio.impact(arrivee); }
  } else if (!touche && Math.hypot(arrivee.x - joueur.pos.x, arrivee.z - joueur.pos.z) < 3) {
    audio.sifflement(arrivee);
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

// ===== Physique et actions du joueur (pas fixe) =====
function physiqueJoueur(dt) {
  const monde = carte.monde;
  joueur.precedente.copy(joueur.pos);
  const enJeu = (partie.phase === "combat" || partie.phase === "preparation") && joueur.vivant;
  visee = enJeu && souris.droit && logique.rechargeT <= 0 && joueur.rueeT <= 0;

  const veutAccroupi = enJeu && (touches.ControlLeft || touches.ControlRight || touches.KeyC);
  if (veutAccroupi) joueur.accroupi = true;
  else if (joueur.accroupi && !monde.bloque(joueur.pos.x, joueur.pos.z, joueur.pos.y, RAYON_PERSO, 1.8)) joueur.accroupi = false;
  const yeuxCible = joueur.accroupi ? 1.15 : 1.62;
  joueur.hauteurYeux += (yeuxCible - joueur.hauteurYeux) * (1 - Math.exp(-14 * dt));
  const taille = joueur.accroupi ? 1.3 : 1.8;

  // Codes physiques des touches : ZQSD sur AZERTY = WASD sur QWERTY. La diagonale n'est pas plus rapide.
  const avant = enJeu ? (touches.KeyW ? 1 : 0) - (touches.KeyS ? 1 : 0) : 0;
  const cote = enJeu ? (touches.KeyD ? 1 : 0) - (touches.KeyA ? 1 : 0) : 0;
  const s = Math.sin(joueur.lacet), c = Math.cos(joueur.lacet);
  let wx = -s * avant + c * cote, wz = -c * avant - s * cote;
  const n = Math.hypot(wx, wz);
  joueur.sprint = (touches.ShiftLeft || touches.ShiftRight) && avant > 0 && !joueur.accroupi && !visee;
  const vitesseMax = joueur.accroupi ? 2.3 : visee ? 3.6 : joueur.sprint ? 6.6 : 5.0;
  if (n > 0) { wx = wx / n * vitesseMax; wz = wz / n * vitesseMax; }

  joueur.rueeRecharge = Math.max(0, joueur.rueeRecharge - dt);
  if (joueur.rueeT > 0) {
    joueur.rueeT -= dt;
    const k = Math.max(0, joueur.rueeT / 0.2);
    joueur.vel.x = joueur.rueeDir.x * (8 + 12 * k);
    joueur.vel.z = joueur.rueeDir.z * (8 + 12 * k);
  } else {
    // Accélération rapide au sol (contre-strafe réactif), contrôle limité en l'air
    const k = 1 - Math.exp(-(joueur.auSol ? (n > 0 ? 12 : 16) : 2) * dt);
    joueur.vel.x += (wx - joueur.vel.x) * k;
    joueur.vel.z += (wz - joueur.vel.z) * k;
  }

  // Déplacement découpé en sous-pas : impossible de traverser un mur, même avec la ruée
  const dist = Math.hypot(joueur.vel.x, joueur.vel.z) * dt;
  const sousPas = Math.max(1, Math.ceil(dist / 0.15));
  for (let i = 0; i < sousPas; i++) {
    const nx = joueur.pos.x + joueur.vel.x * dt / sousPas;
    if (!monde.bloque(nx, joueur.pos.z, joueur.pos.y, RAYON_PERSO, taille)) joueur.pos.x = nx; else joueur.vel.x = 0;
    const nz = joueur.pos.z + joueur.vel.z * dt / sousPas;
    if (!monde.bloque(joueur.pos.x, nz, joueur.pos.y, RAYON_PERSO, taille)) joueur.pos.z = nz; else joueur.vel.z = 0;
  }

  for (const b of bots.liste) {
    if (!b.vivant) continue;
    const dx = joueur.pos.x - b.x, dz = joueur.pos.z - b.z, d = Math.hypot(dx, dz), min = RAYON_PERSO + 0.32;
    if (d > 0.001 && d < min && joueur.pos.y < 1.7) {
      const px = joueur.pos.x + dx / d * (min - d), pz = joueur.pos.z + dz / d * (min - d);
      if (!monde.bloque(px, pz, joueur.pos.y, RAYON_PERSO, taille)) { joueur.pos.x = px; joueur.pos.z = pz; }
    }
  }

  const avantY = joueur.pos.y;
  joueur.vel.y -= 20 * dt;
  joueur.pos.y += joueur.vel.y * dt;
  const solY = monde.hauteurSol(joueur.pos.x, joueur.pos.z, avantY);
  const etaitEnLAir = !joueur.auSol;
  if (joueur.pos.y <= solY) {
    if (etaitEnLAir && joueur.vel.y < -4) { joueur.chute = Math.min(1, -joueur.vel.y / 9); audio.pasJoueur(1.4); }
    joueur.pos.y = solY;
    joueur.vel.y = 0;
    joueur.auSol = true;
  } else joueur.auSol = false;

  // Bruits de pas : on t'entend courir, pas marcher accroupi ni en visée.
  const vit = Math.hypot(joueur.vel.x, joueur.vel.z);
  if (joueur.auSol && vit > 2.6 && !joueur.accroupi && !visee) {
    joueur.pasT -= dt * vit / 5;
    if (joueur.pasT <= 0) {
      joueur.pasT = 0.4;
      audio.pasJoueur(joueur.sprint ? 1.2 : 1);
      if (partie.phase === "combat") bots.entendre(joueur.pos.x, joueur.pos.z, joueur.sprint ? 17 : 9);
    }
  }

  // Tir et rechargement
  logique.maj(dt, temps);
  if (enJeu && partie.phase === "combat" && souris.gauche && joueur.rueeT <= 0) {
    let coups = 0;
    while (logique.peutTirer(temps) && coups++ < 2) tirer();
    if (logique.mun <= 0 && logique.reserve <= 0 && !souris.videJoue) { audio.vide(); souris.videJoue = true; }
  }
  const progression = logique.progressionRecharge;
  if (progression >= 0) {
    const etapes = logique.rechargeVide ? [0.24, 0.72, 0.86] : [0.24, 0.72, 0.8];
    if (etapeRechargeSon < 3 && progression >= etapes[etapeRechargeSon]) { audio.rechargement(etapeRechargeSon); etapeRechargeSon++; }
  } else etapeRechargeSon = 0;
}

// ===== Caméra et arme (à chaque image, avec interpolation) =====
const posCam = new THREE.Vector3();
function majCamera(dt, alpha) {
  const vit = Math.hypot(joueur.vel.x, joueur.vel.z);
  const s = Math.sin(joueur.lacet), c = Math.cos(joueur.lacet);
  joueur.sursaut *= Math.exp(-8 * dt);
  joueur.chute *= Math.exp(-9 * dt);
  posCam.lerpVectors(joueur.precedente, joueur.pos, alpha);
  if (joueur.vivant) {
    const amp = reglages.bob * (1 - modele.viseeK * 0.75);
    const balancement = joueur.auSol ? Math.sin(temps * (joueur.sprint ? 13 : 10)) * 0.022 * Math.min(vit / 6, 1) * amp : 0;
    camera.position.set(posCam.x, posCam.y + joueur.hauteurYeux + balancement - joueur.chute * 0.06, posCam.z);
    const penche = -(joueur.vel.x * c - joueur.vel.z * s) * 0.0028 * reglages.bob;
    camera.rotation.set(joueur.tangage + logique.reculPitch + joueur.sursaut * 0.02, joueur.lacet + logique.reculYaw, penche);
    modele.pivot.visible = true;
  } else {
    camera.position.y += (joueur.pos.y + 0.35 - camera.position.y) * (1 - Math.exp(-4 * dt));
    camera.rotation.z += (0.5 - camera.rotation.z) * (1 - Math.exp(-3 * dt));
    modele.pivot.visible = false;
  }

  const hfov = reglages.fov * DEG;
  const vfov = 2 * Math.atan(Math.tan(hfov / 2) / camera.aspect);
  const vfovVisee = 2 * Math.atan(Math.tan(vfov / 2) / 1.3);
  const fovFinal = (vfov + (vfovVisee - vfov) * modele.viseeK) / DEG;
  if (Math.abs(camera.fov - fovFinal) > 0.01) { camera.fov = fovFinal; camera.updateProjectionMatrix(); }

  modele.amplitudeBob = reglages.bob;
  modele.maj({
    dt, temps, vitesse: vit, auSol: joueur.auSol, vise: visee, sprint: joueur.sprint && vit > 4,
    souris: { x: souris.dx, y: souris.dy }, recharge: logique.progressionRecharge, rechargeVide: logique.rechargeVide,
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
  const dx = -s * a + c * cote, dz = -c * a - s * cote;
  const n = Math.hypot(dx, dz) || 1;
  joueur.rueeDir.set(dx / n, 0, dz / n);
  joueur.rueeT = 0.2;
  joueur.rueeRecharge = RUEE_RECHARGE;
  audio.ruee();
  hud.ruee();
}

// Ennemis visibles par le joueur (affichés sur la minimap)
const avantVue = new THREE.Vector3();
function majVision(dt) {
  vueT -= dt;
  if (vueT > 0) return;
  vueT = 0.15;
  botsVus = [];
  if (!joueur.vivant) return;
  directionVue(avantVue);
  const ox = joueur.pos.x, oy = joueur.pos.y + joueur.hauteurYeux, oz = joueur.pos.z;
  const cosChamp = Math.cos((reglages.fov / 2 + 8) * DEG);
  for (const b of bots.liste) {
    if (!b.vivant) continue;
    const dx = b.x - ox, dy = 1.4 - oy, dz = b.z - oz, d = Math.hypot(dx, dy, dz);
    if ((dx * avantVue.x + dy * avantVue.y + dz * avantVue.z) / d < cosChamp) continue;
    if (carte.monde.ligneLibre(ox, oy, oz, b.x, 1.6, b.z) || carte.monde.ligneLibre(ox, oy, oz, b.x, 0.9, b.z)) {
      botsVus.push(b);
      if (Math.random() < 0.3) hud.ping(b.x, b.z);
    }
  }
}

// Une étape de simulation (règles, joueur, bots) à pas fixe.
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
  if (partie.etat !== "jeu") return;
  physiqueJoueur(dt);
  bots.maj(dt, temps, joueur, partie.phase);
  majVision(dt);
}

// Mises à jour visuelles (à chaque image)
function majVisuels(dt, alpha) {
  majCamera(dt, alpha);
  effets.maj(dt);
  const imprecision = logique.imprecision(etatTir());
  hud.maj(dt, {
    temps, vie: joueur.vie, vivant: joueur.vivant, mun: logique.mun, reserve: logique.reserve, recharge: logique.progressionRecharge,
    scoreMoi: partie.scoreMoi, scoreEux: partie.scoreEux, chrono: partie.phase === "preparation" ? partie.phaseT : partie.chrono,
    phase: partie.phase, manche: partie.manche, botsTotal: bots.liste.length, botsVivants: bots.vivants().length,
    rueeRecharge: joueur.rueeRecharge, rueeDuree: RUEE_RECHARGE, vise: modele.viseeK > 0.5,
    imprecisionPx: (Math.tan(imprecision * DEG) / Math.tan(camera.fov * DEG / 2)) * (innerHeight / 2),
    x: joueur.pos.x, z: joueur.pos.z, lacet: joueur.lacet, botsVus,
  });
}

// ===== Boucle =====
const horloge = new THREE.Timer();
let accumulateur = 0;
let fpsT = 0, fpsN = 0;
let orbite = 0;

function boucle(t) {
  requestAnimationFrame(boucle);
  horloge.update(t);
  const dt = Math.min(horloge.getDelta(), 0.1);
  fpsT += dt; fpsN++;
  if (fpsT >= 0.5) { if (reglages.fps) $("fps").textContent = Math.round(fpsN / fpsT) + " FPS"; fpsT = 0; fpsN = 0; }

  if (partie.etat === "jeu") {
    accumulateur += dt;
    let n = 0;
    while (accumulateur >= PAS && n++ < 8) { simuler(PAS); accumulateur -= PAS; }
    if (n >= 8) accumulateur = 0;
    if (partie.etat === "jeu") majVisuels(dt, accumulateur / PAS);
  } else if (partie.etat === "menu") {
    // Survol cinématique de l'arène derrière le menu
    orbite += dt * 0.05;
    camera.position.set(Math.sin(orbite) * 30 + 8, 15 + Math.sin(orbite * 0.7) * 1.5, Math.cos(orbite) * 22);
    camera.lookAt(6, 0, -3);
    camera.fov = 55;
    camera.updateProjectionMatrix();
    modele.pivot.visible = false;
    effets.maj(dt);
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
// Perte du focus (alt-tab, notification) : on met en pause et on relâche toutes les touches.
addEventListener("blur", () => {
  for (const k in touches) touches[k] = false;
  souris.gauche = souris.droit = false;
  if (partie.etat === "jeu") pause();
});

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
  // Une nouvelle qualité graphique s'applique en rechargeant la page depuis le menu (les réglages sont gardés).
  if (document.querySelector("#ecran-reglages.visible") && reglages.qualite !== qualite && partie.etat === "menu") { location.reload(); return; }
  afficherEcran(pile.pop() || (partie.etat === "pause" ? "ecran-pause" : "ecran-menu"));
}
document.querySelectorAll("[data-ouvre]").forEach((b) => b.addEventListener("click", () => { audio.demarrer(); audio.clic(); ouvrirEcran(b.dataset.ouvre); }));
document.querySelectorAll("[data-retour]").forEach((b) => b.addEventListener("click", () => { audio.clic(); retourEcran(); }));
document.querySelectorAll("button, .bouton-lien").forEach((b) => b.addEventListener("mouseenter", () => audio.survol()));

function demarrerPartie() {
  audio.demarrer();
  audio.clic();
  pile.length = 0;
  afficherEcran(null);
  $("hud").classList.remove("cache");
  partie.etat = "jeu";
  accumulateur = 0;
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
  audio.clic();
  pile.length = 0;
  afficherEcran(null);
  partie.etat = "jeu";
  accumulateur = 0;
  verrouiller();
}

function allerAuMenu() {
  audio.clic();
  partie.etat = "menu";
  pile.length = 0;
  bots.vider();
  effets.vider();
  carte.barriere.activer(false);
  $("hud").classList.add("cache");
  afficherEcran("ecran-menu");
}

function pleinEcran() {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
  } catch (e) { /* non disponible */ }
}

$("bouton-jouer").addEventListener("click", demarrerPartie);
$("bouton-reprendre").addEventListener("click", reprendre);
$("bouton-abandon").addEventListener("click", allerAuMenu);
$("bouton-rejouer").addEventListener("click", demarrerPartie);
$("bouton-menu").addEventListener("click", allerAuMenu);
$("r-plein-ecran").addEventListener("click", pleinEcran);
document.addEventListener("fullscreenchange", () => { $("r-plein-ecran").textContent = document.fullscreenElement ? "Quitter le plein écran" : "Passer en plein écran"; });

// Difficulté
const boutonsDiff = document.querySelectorAll("#choix-difficulte button");
function majDifficulte() {
  boutonsDiff.forEach((b) => { b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(b.dataset.valeur === reglages.difficulte)); });
}
boutonsDiff.forEach((b) => b.addEventListener("click", () => { audio.demarrer(); audio.clic(); reglages.difficulte = b.dataset.valeur; sauverReglages(); majDifficulte(); }));
if (!DIFFICULTES[reglages.difficulte]) reglages.difficulte = "normal";
majDifficulte();

// Paramètres
function lierReglage(id, cle, format, apres) {
  const champ = $("r-" + id), sortie = $("o-" + id);
  champ.value = reglages[cle];
  if (sortie) sortie.textContent = format(reglages[cle]);
  champ.addEventListener("input", () => {
    reglages[cle] = parseFloat(champ.value);
    if (sortie) sortie.textContent = format(reglages[cle]);
    if (apres) apres(reglages[cle]);
    sauverReglages();
  });
}
lierReglage("sensibilite", "sensibilite", (v) => v.toFixed(2));
lierReglage("fov", "fov", (v) => v + "°");
lierReglage("volume", "volume", (v) => Math.round(v * 100) + " %", (v) => audio.reglerVolume(v));
lierReglage("ambiance", "ambiance", (v) => Math.round(v * 100) + " %", (v) => audio.reglerAmbiance(v));
lierReglage("bob", "bob", (v) => Math.round(v * 100) + " %");
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
requestAnimationFrame(boucle);

// Accès pour les tests automatiques uniquement (adresse ...?test)
if (new URLSearchParams(location.search).has("test")) {
  window.__neon = {
    partie, joueur, bots, logique, carte, demarrerPartie, camera, touches, souris, modele, effets, renderer,
    avancer(secondes) {
      for (let t = 0; t < secondes; t += PAS) {
        if (partie.etat !== "jeu") break;
        simuler(PAS);
        if (partie.etat === "jeu") majVisuels(PAS, 1);
      }
    },
  };
}
