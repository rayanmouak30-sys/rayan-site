// Neon Strike : rendu adaptatif, boucle à pas fixe, killcam et spectateur, menus, boutique, fin de partie.
// Les modules : carte (décor), joueur, bots, règles des modes, compétences, interface, sons, musique, profil, réseau.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { construireCarte } from "./carte.js";
import { CARTES, CARTES_JOUABLES } from "./cartes.js";
import { GestionBots, DIFFICULTES, appliquerDegats } from "./bots.js";
import { ARMES, SKINS } from "./armes.js";
import { VueArme } from "./vueArme.js";
import { Personnage } from "./personnages.js";
import { Hud } from "./hud.js";
import { Audio } from "./audio.js";
import { Musique } from "./musique.js";
import { Effets } from "./effets.js";
import { Competences, AGENTS, CAPACITES } from "./competences.js";
import { Joueur, nouvellesStats } from "./joueur.js";
import { Regles, MODES, DEFIS, ARTICLES, OBJECTIF_DM } from "./regles.js";
import { Profil, SUCCES, NIVEAUX_SKINS, etatCompte, envoyerResultat, classement } from "./profil.js";
import { Controles } from "./controles.js";
import { Reseau, PartieEnLigne, adresseParDefaut } from "./reseau.js";

const $ = (id) => document.getElementById(id);
const DEG = Math.PI / 180;
const PAS = 1 / 60;
const TEST = new URLSearchParams(location.search).has("test");

// ===== Réglages (gardés dans ce navigateur) =====
const DEFAUTS = {
  sensibilite: 1, sensibiliteManette: 1, fov: 103, volume: 0.7, musique: 0.45, ambiance: 0.5, annonceur: true, bob: 1,
  qualite: "auto", resolutionDynamique: true, luminosite: 1, fps: false,
  difficulte: "normal", mode: "spike", carte: "nexus", heure: "jour", meteo: "clair", allies: true, defi: "libre", serveur: "", carteEnLigne: "nexus",
};
const reglages = { ...DEFAUTS };
try { Object.assign(reglages, JSON.parse(localStorage.getItem("neonstrike-reglages") || "{}")); } catch (e) { /* stockage indisponible */ }
if (!["auto", "basse", "moyenne", "haute"].includes(reglages.qualite)) reglages.qualite = "auto";
if (!MODES[reglages.mode]) reglages.mode = "spike";
if (!CARTES_JOUABLES.includes(reglages.carte)) reglages.carte = "nexus";
function sauverReglages() {
  try { localStorage.setItem("neonstrike-reglages", JSON.stringify(reglages)); } catch (e) { /* stockage indisponible */ }
}

// ===== Qualité : détection automatique de la carte graphique =====
function detecterQualite() {
  let nom = "";
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return { qualite: "basse", gpu: "inconnue" };
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    nom = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    const perte = gl.getExtension("WEBGL_lose_context");
    if (perte) perte.loseContext();
  } catch (e) { /* détection impossible */ }
  const mobile = matchMedia("(pointer: coarse)").matches;
  const integre = /intel|hd graphics|uhd|iris|mali|adreno|powervr|swiftshader|llvmpipe|software|basic render|radeon\(tm\) graphics|radeon graphics|vega \d+ graphics/i.test(nom) && !/apple m\d/i.test(nom);
  const coeurs = navigator.hardwareConcurrency || 4;
  return { qualite: mobile || integre || coeurs <= 2 ? "basse" : "moyenne", gpu: nom };
}
const detection = detecterQualite();
const qualite = reglages.qualite === "auto" ? detection.qualite : reglages.qualite;

const PROFILS = {
  basse: { ratio: Math.min(devicePixelRatio, 1), ombres: false, aa: false, post: false },
  moyenne: { ratio: Math.min(devicePixelRatio, 1.25), ombres: true, aa: true, post: false },
  haute: { ratio: Math.min(devicePixelRatio, 2), ombres: true, aa: false, post: true },
};
const profil = PROFILS[qualite];

const renderer = new THREE.WebGLRenderer({ antialias: profil.aa, powerPreference: "high-performance" });
renderer.setPixelRatio(profil.ratio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = profil.ombres;
renderer.shadowMap.type = THREE.PCFShadowMap;
// Ombres du décor calculées une seule fois (il ne bouge pas) ; les personnages ont une ombre ronde.
renderer.shadowMap.autoUpdate = qualite === "haute";
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.domElement.className = "scene";
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 700);
camera.rotation.order = "YXZ";
scene.add(camera);
// Lampe torche (cartes de nuit)
const torche = new THREE.SpotLight(0xfff0d8, 0, 34, 0.42, 0.6, 1.3);
torche.position.set(0.2, -0.15, 0);
torche.target.position.set(0, -0.1, -1);
camera.add(torche, torche.target);
torche.visible = false;

// ===== Modules =====
const audio = new Audio();
audio.reglerVolume(reglages.volume);
audio.reglerAmbiance(reglages.ambiance);
audio.annonceur = reglages.annonceur;
const musique = new Musique(audio);
musique.volume = reglages.musique;
const profilJ = new Profil();
const controles = new Controles(renderer.domElement);
const vue = new VueArme(qualite);
const effets = new Effets(scene, qualite);
const reseau = new Reseau();
if (qualite === "haute") Personnage.ombresPortees = true;

const jeu = {
  scene, qualite, audio, musique, effets, vue, reglages, profil: profilJ,
  carte: null, bots: null, joueur: null, hud: null, competences: null, regles: null,
  difficulte: DIFFICULTES[reglages.difficulte] || DIFFICULTES.normal,
  progression: null,
};

let carte = null;
let envTexture = null;
const pmrem = new THREE.PMREMGenerator(renderer);
vue.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
vue.scene.environmentIntensity = 0.7;

function chargerCarte(id, heure, meteo) {
  if (heure === "aleatoire") heure = ["jour", "soir", "nuit"][Math.floor(Math.random() * 3)];
  if (meteo === "aleatoire") meteo = ["clair", "clair", "pluie", "brouillard"][Math.floor(Math.random() * 4)];
  if (carte && carte.id === id && carte.ambiance.heure === heure && carte.ambiance.meteo === meteo) return carte;
  if (carte) carte.detruire();
  carte = construireCarte(scene, qualite, id, { heure, meteo });
  jeu.carte = carte;
  if (jeu.bots) { jeu.bots.vider(); jeu.bots.carte = carte; }
  if (jeu.competences) jeu.competences.changerCarte(carte);
  if (jeu.hud) jeu.hud.changerCarte(carte);
  effets.vider();
  // Reflets : environnement tiré du ciel de la carte
  const sceneCiel = new THREE.Scene();
  sceneCiel.add(carte.ciel.clone());
  const sol = new THREE.Mesh(new THREE.CircleGeometry(400, 16), new THREE.MeshBasicMaterial({ color: carte.ambiance.heure === "nuit" ? 0x15161c : 0x4a4740 }));
  sol.rotation.x = -Math.PI / 2;
  sol.position.y = -2;
  sceneCiel.add(sol);
  if (envTexture) envTexture.dispose();
  envTexture = pmrem.fromScene(sceneCiel, 0, 1, 1000).texture;
  sol.geometry.dispose();
  sol.material.dispose();
  scene.environment = envTexture;
  scene.environmentIntensity = carte.ambiance.env;
  renderer.toneMappingExposure = carte.ambiance.exposition * reglages.luminosite;
  torche.visible = !!carte.ambiance.torche;
  torche.intensity = carte.ambiance.torche ? 38 : 0;
  renderer.shadowMap.needsUpdate = true;
  carte.barriere.activer(false);
  return carte;
}

chargerCarte(reglages.carte, reglages.heure, reglages.meteo);
const bots = new GestionBots(scene, carte, audio, qualite);
const joueur = new Joueur(jeu);
const competences = new Competences(scene, carte, audio, qualite);
const regles = new Regles(jeu);
const hud = new Hud(carte);
const enLigne = new PartieEnLigne(jeu, reseau);
Object.assign(jeu, { bots, joueur, competences, regles, hud });
bots.joueur = joueur;
bots.competences = competences;
competences.combattants = () => bots.combattants();
competences.estEnnemi = (a, b) => bots.estEnnemi(a, b);

// ===== Post-traitement (qualité élevée seulement) =====
const Etalonnage = {
  uniforms: { tDiffuse: { value: null }, contraste: { value: 1.05 }, saturation: { value: 1.1 }, vignette: { value: 0.12 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float contraste, saturation, vignette; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = (c.rgb - 0.5) * contraste + 0.5;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, saturation);
      vec2 d = vUv - 0.5;
      col *= 1.0 - vignette * smoothstep(0.4, 0.9, length(d * vec2(1.25, 1.0)));
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
};
let composer = null;
if (profil.post) {
  const cible = new THREE.WebGLRenderTarget(innerWidth * profil.ratio, innerHeight * profil.ratio, { type: THREE.HalfFloatType, samples: 4 });
  composer = new EffectComposer(renderer, cible);
  composer.addPass(new RenderPass(scene, camera));
  const passeArme = new RenderPass(vue.scene, vue.camera);
  passeArme.clear = false;
  passeArme.clearDepth = true;
  composer.addPass(passeArme);
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.28, 0.35, 0.92));
  composer.addPass(new OutputPass());
  composer.addPass(new ShaderPass(Etalonnage));
}
renderer.autoClear = !!composer;

function rendre(avecArme) {
  if (composer) { if (!avecArme) vue.pivot.visible = false; composer.render(); return; }
  renderer.clear();
  renderer.render(scene, camera);
  if (avecArme) {
    renderer.clearDepth();
    renderer.render(vue.scene, vue.camera);
  }
}

// Résolution dynamique : baisse la résolution interne quand les images ralentissent
const dyn = { echelle: 1, t: 0, n: 0, bon: 0 };
function appliquerResolution(e) {
  dyn.echelle = e;
  renderer.setPixelRatio(profil.ratio * e);
  if (composer) { composer.setPixelRatio(profil.ratio * e); composer.setSize(innerWidth, innerHeight); }
}
function majResolution(dt) {
  if (!reglages.resolutionDynamique) { if (dyn.echelle !== 1) appliquerResolution(1); return; }
  dyn.t += dt; dyn.n++;
  if (dyn.t < 1) return;
  const fps = dyn.n / dyn.t;
  dyn.t = 0; dyn.n = 0;
  if (fps < 50 && dyn.echelle > 0.6) { dyn.bon = 0; appliquerResolution(Math.max(0.6, +(dyn.echelle - 0.1).toFixed(2))); }
  else if (fps > 57 && dyn.echelle < 1) { if (++dyn.bon >= 3) { dyn.bon = 0; appliquerResolution(Math.min(1, +(dyn.echelle + 0.1).toFixed(2))); } }
  else dyn.bon = 0;
}

function redimensionner() {
  renderer.setSize(innerWidth, innerHeight);
  if (composer) composer.setSize(innerWidth, innerHeight);
  vue.redimensionner(innerWidth / innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", redimensionner);
redimensionner();

// ===== État de la partie =====
const partie = { etat: "chargement", mode: "spike" };
let temps = 0;
let vueT = 0;
let ennemisVus = [];
let ordresOuverts = false;
let boutiqueOuverte = false;
let killcam = null;
let spectateur = null;
let mortCamT = 0;
let modeleJoueur = null;
let teinteT = 0, teinteCouleur = null;
let salon = null;

// Enregistrement des 5 dernières secondes (killcam)
const enregistrement = [];
let enregistrementT = 0;
function enregistrer() {
  const f = { t: temps, j: { x: joueur.x, y: joueur.y, z: joueur.z, l: joueur.lacet, g: joueur.tangage, v: joueur.vivant, s: Math.hypot(joueur.vel.x, joueur.vel.z) }, b: new Map() };
  for (const b of bots.liste) f.b.set(b, { x: b.x, z: b.z, yaw: b.yaw, pitch: b.pitch, v: b.vivant, s: b.vitesse });
  enregistrement.push(f);
  while (enregistrement.length && temps - enregistrement[0].t > 5) enregistrement.shift();
}

// ===== Dégâts, éliminations =====
const couleurDe = (c) => (c && (c.estJoueur || (regles.mode !== "deathmatch" && partie.mode !== "enligne" && c.equipe === joueur.equipe)) ? "#7cffd4" : "#ff6b78");

jeu.infliger = (c, degats, auteur, tete, arme) => {
  if (!c || !c.vivant) return;
  if (regles.mode === "stand" && regles.defi && DEFIS[regles.defi.id].tete && !tete && !c.estJoueur) {
    if (auteur === joueur) { hud.touche(false, false); audio.touche(false); }
    return;
  }
  if (c.estJoueur) { jeu.blesserJoueur(degats, auteur, tete, arme); return; }
  if (c.distant) {
    reseau.envoyer({ t: "touche", cible: c.distantId, degats: Math.round(degats), tete, arme });
    if (auteur === joueur) { hud.touche(tete, false); audio.touche(tete); joueur.stats.degats += degats; }
    return;
  }
  const avant = c.vie + (c.armure || 0);
  const mort = bots.blesser(c, degats, auteur, tete, arme);
  if (auteur === joueur) {
    joueur.stats.degats += Math.min(degats, avant);
    if (!mort) { hud.touche(tete, false); audio.touche(tete); }
  }
};

jeu.blesserJoueur = (degats, auteur, tete, arme) => {
  if (!joueur.vivant) return;
  const actif = regles.mode === "deathmatch" || regles.mode === "stand" || partie.mode === "enligne" || regles.phase === "combat" || regles.phase === "spike";
  if (!actif) return;
  const reel = appliquerDegats(joueur, degats);
  regles.degatsRecusManche = (regles.degatsRecusManche || 0) + reel;
  joueur.sursaut = Math.min(1, joueur.sursaut + (tete ? 1 : 0.5));
  if (auteur) {
    const angleAttaquant = Math.atan2(auteur.x - joueur.x, auteur.z - joueur.z);
    const angleVue = Math.atan2(-Math.sin(joueur.lacet), -Math.cos(joueur.lacet));
    hud.degat(-(angleAttaquant - angleVue), tete);
  } else hud.degat(0, true);
  audio.degat();
  if (joueur.vie <= 0) mortJoueur(auteur, tete, arme);
};

function mortJoueur(tueur, tete, arme) {
  joueur.vie = 0;
  joueur.vivant = false;
  joueur.stats.morts++;
  joueur.morts++;
  joueur.verrou = false;
  controles.souris.gauche = false;
  mortCamT = 0;
  if (partie.mode === "enligne") enLigne.mortLocale(tueur, tete, arme);
  else {
    hud.fil(tueur ? tueur.nom : "", "TOI", tete, "victime", arme, [couleurDe(tueur), "#7cffd4"]);
    regles.surMort(joueur, tueur, tete, arme);
  }
  // Killcam : on revoit les dernières secondes depuis les yeux du tueur
  const duree = enregistrement.length ? Math.min(3.2, temps - enregistrement[0].t - 0.2) : 0;
  if (tueur && !tueur.estJoueur && tueur.modele && duree > 1) killcam = { tueur, attente: 0.7, t: 0, duree, debut: temps - duree, tete, arme };
}

bots.surMort = (victime, tueur, tete, arme) => {
  if (tueur === joueur) {
    joueur.stats.kills++;
    if (tete) joueur.stats.tetes++;
    if (arme === "couteau") { joueur.stats.killsCouteau++; profilJ.debloquer("lame"); }
    if (arme === "sniper") joueur.stats.killsSniper++;
    if (arme && regles.mode !== "stand") profilJ.noterKillArme(arme);
    const n = MODES[regles.mode].equipes ? (regles.killsManche || 0) + 1 : 1;
    hud.touche(tete, true);
    if (regles.mode !== "stand") hud.elimination(n, tete);
    audio.elimination(n);
    if (n === 3) audio.parler("Triple élimination !");
    if (n === 4) audio.parler("Quadruple élimination !");
  }
  if (regles.mode !== "stand") {
    hud.fil(tueur ? (tueur === joueur ? "TOI" : tueur.nom) : "", victime.nom, tete, tueur === joueur ? "tueur" : "", arme, [couleurDe(tueur), couleurDe(victime)]);
  }
  regles.surMort(victime, tueur, tete, arme);
  notifierSucces();
};

const _n = new THREE.Vector3();
bots.surTir = (bot, depart, arrivee, touche, mur, plomb) => {
  if (!plomb || Math.random() < 0.25) effets.tracante(depart, arrivee, 0xff8a70, 0.05);
  if (mur) {
    _n.set(mur.nx, mur.ny, mur.nz);
    if (mur.boite.competence) competences.degatsMur(mur.boite.competence, 30);
    else if (Math.random() < 0.6) effets.trou(arrivee, _n);
    if (Math.hypot(arrivee.x - joueur.x, arrivee.z - joueur.z) < 8) { effets.etincellesEn(arrivee, _n, 0xffc27a, 5); audio.impact(arrivee); }
  } else if (!touche && joueur.vivant && Math.hypot(arrivee.x - joueur.x, arrivee.z - joueur.z) < 3) {
    audio.sifflement(arrivee);
  }
  if (touche) jeu.infliger(touche.cible, touche.degats, bot, touche.partie === "tete", bot.arme);
};

bots.surSite = (equipe, site) => {
  if (equipe === joueur.equipe && audio.limite("site" + site, 8)) hud.fil("Équipe", `Ennemis repérés sur ${site} !`, false, "info", null, ["#5ad8ff", "#e9f1ff"]);
};

competences.surAveugle = (c, intensite, duree) => {
  if (c.estJoueur) {
    joueur.aveugleT = Math.max(joueur.aveugleT, duree);
    joueur.aveugleMax = Math.max(0.1, joueur.aveugleT);
    audio.acouphene(intensite, duree);
  } else c.aveugleT = Math.max(c.aveugleT || 0, duree * 0.9);
};

competences.surRevele = (c, duree, equipe) => {
  if (equipe !== joueur.equipe) return;
  c.reveleT = Math.max(c.reveleT || 0, duree);
  hud.ping(c.x, c.z);
  bots.informer(equipe, c.x, c.z);
};

jeu.signalerTir = (c, o, f, arme) => {
  if (partie.mode === "enligne") reseau.envoyer({ t: "tir", o: [+o.x.toFixed(2), +o.y.toFixed(2), +o.z.toFixed(2)], f: [+f.x.toFixed(2), +f.y.toFixed(2), +f.z.toFixed(2)], a: arme });
};

// Ultimes des agents
jeu.ultime = (lanceur, id) => {
  audio.ultime();
  hud.activerCapacite("ultime");
  const allies = MODES[regles.mode].equipes ? bots.liste.filter((b) => b.vivant && !b.mannequin && b.equipe === joueur.equipe) : [];
  if (id === "surcharge") { joueur.surchargeT = 10; teinte("rgba(63,224,176,0.5)", 10); hud.annonce("SURCHARGE", "Cadence et vitesse augmentées", "#7cffd4", 1.6); }
  else if (id === "bastion") {
    for (const c of [joueur, ...allies]) { c.armure = Math.max(c.armure || 0, 50); c.vie = Math.min(100, c.vie + 50); }
    teinte("rgba(63,127,255,0.6)", 1.5);
    hud.annonce("BASTION", "Toute l'équipe est protégée", "#8ab4ff", 1.6);
  } else if (id === "sonar") {
    for (const c of bots.combattants()) if (c.vivant && !c.mannequin && bots.estEnnemi(joueur, c)) { c.reveleT = 6; bots.informer(joueur.equipe, c.x, c.z); }
    teinte("rgba(255,209,102,0.5)", 1.2);
    hud.annonce("SONAR", "Ennemis révélés", "#ffd166", 1.6);
  } else if (id === "renouveau") {
    for (const c of [joueur, ...allies]) c.vie = 100;
    teinte("rgba(156,255,58,0.5)", 1.5);
    hud.annonce("RENOUVEAU", "Équipe soignée", "#9cff3a", 1.6);
  }
  audio.parler(CAPACITES[id].nom + " !");
};
function teinte(couleur, duree) { teinteCouleur = couleur; teinteT = duree; }

// ===== Événements des règles =====
jeu.preparerManche = () => {
  hud.vider();
  effets.vider();
  competences.vider();
  killcam = null;
  spectateur = null;
  enregistrement.length = 0;
  mortCamT = 0;
  camera.rotation.z = 0;
  fermerBoutique(false);
};

jeu.finManche = (recap, ace) => {
  hud.recap(recap);
  if (ace) { hud.annonce("ACE", "Tu as éliminé toute l'équipe adverse !", "#ffd166", 3.4); profilJ.debloquer("ace"); audio.parler("Ace !"); }
  else hud.annonce(recap.gagnee ? "MANCHE GAGNÉE" : "MANCHE PERDUE", recap.raison, recap.gagnee ? "#7cffd4" : "#ff5f6d", 3);
  audio.annonce(recap.gagnee ? "victoire" : "defaite");
  musique.jingle(recap.gagnee ? "manche" : "perdue");
  musique.etat("achat");
  if (!ace) setTimeout(() => audio.parler(recap.gagnee ? "Manche gagnée." : "Manche perdue."), 600);
  notifierSucces();
};

jeu.surReapparition = () => { killcam = null; hud.killcam(null); mortCamT = 0; camera.rotation.z = 0; };
jeu.surAchat = () => {};
jeu.surEvenement = (type, qui) => {
  if (type === "premierSang" && qui === joueur) profilJ.debloquer("premierSang");
  if (type === "pose" && qui === joueur) profilJ.debloquer("artificier");
  if (type === "desamorce" && qui === joueur) profilJ.debloquer("demineur");
  if (type === "clutch" && qui >= 2) profilJ.debloquer("clutch");
  notifierSucces();
};
jeu.surKillEnLigne = (tete, arme) => {
  joueur.stats.kills++;
  if (tete) joueur.stats.tetes++;
  if (arme === "couteau") profilJ.debloquer("lame");
  hud.touche(tete, true);
  hud.elimination(1, tete);
  audio.elimination(1);
  notifierSucces();
};

// Petite bannière quand un succès est débloqué
function notifierSucces() {
  for (const id of profilJ.prendreNouveaux()) {
    const s = SUCCES[id];
    const d = document.createElement("div");
    d.className = "toast";
    d.innerHTML = "<span class='icone'></span><div class='corps'><strong></strong><span class='texte'></span></div>";
    d.querySelector(".icone").textContent = s.icone;
    d.querySelector("strong").textContent = "Succès débloqué : " + s.nom;
    d.querySelector(".texte").textContent = s.texte;
    $("notification").appendChild(d);
    audio.achat(true);
    setTimeout(() => d.classList.add("part"), 4200);
    setTimeout(() => d.remove(), 4800);
    succesDeLaPartie.push(id);
  }
  profilJ.sauver();
}
let succesDeLaPartie = [];

// ===== Fin de partie =====
jeu.finPartie = () => {
  partie.etat = "fin";
  controles.relacher();
  fermerBoutique(false);
  basculerOrdres(false);
  if (document.pointerLockElement) document.exitPointerLock();
  const s = joueur.stats;
  const mode = partie.mode;
  let victoire = false, titre = "", sous = "";
  if (mode === "stand") {
    const d = regles.defi, def = DEFIS[d.id];
    victoire = true;
    titre = "DÉFI TERMINÉ";
    sous = def.score === "temps" ? `${def.nom} : ${d.score.toFixed(2)} s` : `${def.nom} : ${d.score} cible${d.score > 1 ? "s" : ""}`;
  } else if (mode === "deathmatch") {
    const meilleur = Math.max(0, ...bots.liste.map((b) => b.kills || 0));
    victoire = joueur.kills >= meilleur && joueur.kills > 0;
    titre = victoire ? "VICTOIRE" : "DÉFAITE";
    sous = `Tu as fait ${joueur.kills} élimination${joueur.kills > 1 ? "s" : ""} · meilleur adversaire : ${meilleur}`;
  } else if (mode === "enligne") {
    victoire = enLigne.gagnant === reseau.id;
    titre = victoire ? "VICTOIRE" : "DÉFAITE";
    sous = `Gagnant : ${enLigne.nom(enLigne.gagnant)}`;
  } else {
    victoire = regles.scores.bleu > regles.scores.rouge;
    titre = victoire ? "VICTOIRE" : "DÉFAITE";
    sous = `${regles.scores.bleu} manches à ${regles.scores.rouge} · ${MODES[mode].nom} · difficulté ${jeu.difficulte.nom.toLowerCase()}`;
  }
  $("fin-titre").textContent = titre;
  $("fin-titre").style.color = victoire ? "var(--cyan)" : "var(--rouge)";
  $("fin-score").textContent = sous;
  const ratio = s.morts ? (s.kills / s.morts).toFixed(1) : String(s.kills);
  const precision = s.tirs ? Math.round((s.touches / s.tirs) * 100) + " %" : "0 %";
  const tetes = s.kills ? Math.round((s.tetes / s.kills) * 100) + " %" : "0 %";
  remplirStats($("fin-stats"), mode === "stand"
    ? [[regles.defi.cibles, "Cibles"], [precision, "Précision"], [tetes, "Headshots"]]
    : [[s.kills, "Éliminations"], [s.morts, "Morts"], [ratio, "Ratio K/D"], [tetes, "Headshots"], [precision, "Précision"], [Math.round(s.degats), "Dégâts infligés"]]);

  // Profil : XP, niveau, succès
  const resultat = {
    mode: mode === "enligne" ? "deathmatch" : mode, victoire, kills: s.kills, morts: s.morts, tetes: s.tetes, aces: s.aces, poses: s.poses,
    desamorcages: s.desamorcages, manchesGagnees: s.manchesGagnees, scoreEux: regles.scores.rouge, difficulte: reglages.difficulte, killsSniper: s.killsSniper,
  };
  if (mode === "stand") Object.assign(resultat, { termine: regles.defi.etat === "fini" && regles.defi.id !== "libre", defi: regles.defi.id, score: regles.defi.score, typeScore: DEFIS[regles.defi.id].score });
  const avantNiveau = profilJ.d.niveau;
  const { xp, niveaux } = profilJ.terminerPartie(resultat);
  const finXp = $("fin-xp");
  finXp.innerHTML = "<div class='xp-ligne'><span></span><span></span></div><div class='xp-barre'><i></i></div>";
  finXp.querySelectorAll("span")[0].textContent = `+${xp} XP`;
  finXp.querySelectorAll("span")[1].textContent = `Niveau ${profilJ.d.niveau}${niveaux ? " · NIVEAU SUPÉRIEUR !" : ""}${resultat.record ? " · NOUVEAU RECORD !" : ""}`;
  setTimeout(() => { finXp.querySelector("i").style.width = Math.round(profilJ.progression * 100) + "%"; }, 60);
  const finSucces = $("fin-succes");
  finSucces.innerHTML = "";
  for (const id of [...succesDeLaPartie, ...profilJ.prendreNouveaux()]) {
    const d = document.createElement("div");
    d.className = "succes-mini";
    d.textContent = SUCCES[id].icone + " " + SUCCES[id].nom;
    finSucces.appendChild(d);
  }
  succesDeLaPartie = [];
  for (const [skin, n] of Object.entries(NIVEAUX_SKINS)) if (n > avantNiveau && n <= profilJ.d.niveau) {
    const d = document.createElement("div");
    d.className = "succes-mini";
    d.textContent = "🎨 Skin débloqué : " + SKINS[skin].nom;
    finSucces.appendChild(d);
  }
  // Classement en ligne
  const note = $("fin-classement");
  note.textContent = "";
  if (["spike", "elimination", "deathmatch"].includes(resultat.mode)) {
    if (profilJ.compte && profilJ.compte.connecte) {
      note.textContent = "Envoi au classement…";
      envoyerResultat({ ...resultat, xp, niveau: profilJ.d.niveau }).then((r) => { note.textContent = r && r.ok ? "Résultat enregistré au classement en ligne." : (r && r.erreur) || "Classement indisponible pour le moment."; });
    } else note.textContent = "Connecte-toi sur le site (page Compte) pour apparaître au classement en ligne.";
  }
  musique.jingle(victoire ? "victoire" : "defaite");
  musique.etat("menu");
  audio.parler(mode === "stand" ? "Défi terminé." : victoire ? "Victoire !" : "Défaite.");
  $("bouton-rejouer").textContent = mode === "enligne" ? "RETOUR AU SALON" : "REJOUER";
  afficherEcran("ecran-fin");
  $("hud").classList.add("cache");
  $("tactile").classList.add("cache");
  vue.pivot.visible = false;
  majBadge();
};

function remplirStats(conteneur, cases) {
  conteneur.innerHTML = "";
  for (const [v, l] of cases) {
    const d = document.createElement("div");
    const fort = document.createElement("strong"); fort.textContent = v;
    const sp = document.createElement("span"); sp.textContent = l;
    d.append(fort, sp);
    conteneur.appendChild(d);
  }
}

// ===== Actions ponctuelles du joueur =====
function enCombat() {
  return partie.mode === "enligne" || regles.mode === "deathmatch" || regles.mode === "stand" || regles.phase === "combat" || regles.phase === "spike";
}

function traiterActions() {
  const enJeu = partie.etat === "jeu";
  for (const a of controles.prendreActions()) {
    if (a === "pause") { if (boutiqueOuverte) fermerBoutique(true); else if (ordresOuverts) basculerOrdres(false); else pause(); continue; }
    if (!enJeu) continue;
    if (a === "boutique") { if (boutiqueOuverte) fermerBoutique(true); else ouvrirBoutique(); continue; }
    if (boutiqueOuverte) continue;
    if (a === "ordres") { basculerOrdres(!ordresOuverts); continue; }
    if (ordresOuverts && /^(arme[123]|ordre[45])$/.test(a)) { donnerOrdre(Number(a.slice(-1))); continue; }
    if (!joueur.vivant) {
      if (a === "armeSuivante" || a === "arme1") changerSpectateur(1);
      continue;
    }
    switch (a) {
      case "recharger": if (joueur.logique.lancerRechargement()) joueur.etapeRechargeSon = 0; break;
      case "arme1": joueur.emplacement(1); break;
      case "arme2": joueur.emplacement(2); break;
      case "arme3": joueur.emplacement(3); break;
      case "armeSuivante": joueur.armeSuivante(1); break;
      case "armePrecedente": joueur.armeSuivante(-1); break;
      case "inspecter": vue.inspecter(); break;
      case "lacher": if (joueur.porteSpike && regles.spike) regles.lacherSpike(joueur); break;
      case "fumee":
      case "flash":
      case "signature":
      case "ultime": {
        if (partie.mode === "enligne" && (a !== "signature" || !["ruee", "soin"].includes(joueur.agentDef.signature))) { hud.annonce("", "Compétence indisponible en ligne", "#94a7c9", 1); break; }
        if (!enCombat() && a !== "signature") { audio.refus(); break; }
        if (joueur.utiliser(a, controles.cmd, enCombat())) hud.activerCapacite(a);
        else audio.refus();
        break;
      }
    }
  }
}

// ===== Ordres aux coéquipiers =====
function listeOrdres() {
  const def = regles.campJoueur === "defense";
  return ["Suivez-moi", def ? "Défendez A" : "Allez sur A", def ? "Défendez B" : "Allez sur B", "Tenez vos positions", "Jouez librement"];
}
function basculerOrdres(ouvert) {
  if (ouvert) {
    const allies = bots.liste.some((b) => b.equipe === joueur.equipe && !b.mannequin);
    if (!allies || !MODES[regles.mode].equipes || partie.mode === "enligne") { hud.annonce("", "Pas de coéquipiers dans ce mode", "#94a7c9", 1.2); return; }
  }
  ordresOuverts = ouvert;
  hud.ordres(ouvert, listeOrdres());
}
function donnerOrdre(n) {
  const types = [{ type: "suivre" }, { type: "site", site: "A" }, { type: "site", site: "B" }, { type: "tenir" }, null];
  bots.ordonner(joueur.equipe, types[n - 1]);
  basculerOrdres(false);
  hud.fil("TOI", "« " + listeOrdres()[n - 1] + " »", false, "info", null, ["#7cffd4", "#e9f1ff"]);
  audio.clic();
  const repondeur = bots.liste.find((b) => b.equipe === joueur.equipe && b.vivant);
  if (repondeur) setTimeout(() => hud.fil(repondeur.nom, "Bien reçu !", false, "info", null, ["#5ad8ff", "#e9f1ff"]), 500);
}

// ===== Spectateur (après la mort, en mode équipe) =====
function changerSpectateur(sens) {
  const allies = bots.liste.filter((b) => b.vivant && b.equipe === joueur.equipe && !b.mannequin);
  if (!allies.length) { spectateur = null; return; }
  const i = spectateur ? allies.indexOf(spectateur.cible) : -1;
  const cible = allies[(i + sens + allies.length) % allies.length];
  spectateur = { cible, lacet: cible.yaw + Math.PI, tangage: 0 };
}

// ===== Simulation (pas fixe) =====
const CMD_VIDE = { avant: 0, cote: 0, sprint: false, accroupi: false, saut: false, tir: false, viser: false, interagir: false };
function simuler(dt) {
  temps += dt;
  const enLigneActif = partie.mode === "enligne";
  const phase = enLigneActif || regles.mode === "deathmatch" || regles.mode === "stand" ? "combat" : regles.phase;
  const enJeu = phase === "preparation" || phase === "combat" || phase === "spike";
  const cmd = boutiqueOuverte || partie.etat !== "jeu" ? CMD_VIDE : controles.cmd;
  joueur.majEffets(dt);
  joueur.physique(dt, cmd, enJeu);
  joueur.armes(dt, temps, cmd, phase === "combat" || phase === "spike");
  if (enLigneActif) enLigne.maj(dt);
  else regles.maj(dt, cmd);
  bots.maj(dt, temps, phase);
  competences.maj(dt);
  majVision(dt);
  enregistrementT -= dt;
  if (enregistrementT <= 0) { enregistrementT = 0.05; enregistrer(); }
}

// Ennemis visibles par le joueur (minimap) + révélés par le drone ou le sonar
const avantVue = new THREE.Vector3();
function majVision(dt) {
  vueT -= dt;
  if (vueT > 0) return;
  vueT = 0.15;
  ennemisVus = [];
  const ox = joueur.x, oy = joueur.yeux, oz = joueur.z;
  if (joueur.vivant) joueur.directionVue(avantVue);
  const cosChamp = Math.cos((reglages.fov / 2 + 8) * DEG);
  const equipes = MODES[regles.mode].equipes && partie.mode !== "enligne";
  for (const b of bots.liste) {
    if (!b.vivant || b.mannequin || !bots.estEnnemi(joueur, b)) continue;
    if (b.reveleT > 0) { ennemisVus.push(b); continue; }
    if (!joueur.vivant) continue;
    const dx = b.x - ox, dy = 1.4 - oy, dz = b.z - oz, d = Math.hypot(dx, dy, dz);
    if ((dx * avantVue.x + dy * avantVue.y + dz * avantVue.z) / d < cosChamp) continue;
    if (bots.vueLibre(ox, oy, oz, b.x, 1.6, b.z) || bots.vueLibre(ox, oy, oz, b.x, 0.9, b.z)) {
      ennemisVus.push(b);
      if (Math.random() < 0.3) hud.ping(b.x, b.z);
      // Les coéquipiers profitent de l'info (appel radio)
      if (equipes && Math.random() < 0.1) bots.informer(joueur.equipe, b.x, b.z);
    }
  }
}

// ===== Caméra (à chaque image) =====
const posCam = new THREE.Vector3();
function fovVertical(hfovDeg) {
  return 2 * Math.atan(Math.tan(hfovDeg * DEG / 2) / camera.aspect);
}

function majCamera(dt, alpha) {
  const vit = Math.hypot(joueur.vel.x, joueur.vel.z);
  const s = Math.sin(joueur.lacet), c = Math.cos(joueur.lacet);
  joueur.sursaut *= Math.exp(-8 * dt);
  joueur.chute *= Math.exp(-9 * dt);
  posCam.lerpVectors(joueur.precedente, joueur.pos, alpha);
  const def = joueur.def;
  const L = joueur.logique;
  const regard = controles.prendreRegard();
  let zoom = 1;

  if (joueur.vivant) {
    const zoomActuel = 1 + ((def.zoom || 1) - 1) * vue.viseeK;
    const k = 0.0021 * reglages.sensibilite * (joueur.visee ? 0.78 : 1) / Math.pow(zoomActuel, 0.75);
    if (!boutiqueOuverte && partie.etat === "jeu") {
      joueur.lacet -= regard.dx * k;
      joueur.tangage = Math.max(-1.5, Math.min(1.5, joueur.tangage - regard.dy * k));
    }
    const amp = reglages.bob * (1 - vue.viseeK * 0.75);
    const balancement = joueur.auSol ? Math.sin(temps * (joueur.sprint ? 13 : 10)) * 0.022 * Math.min(vit / 6, 1) * amp : 0;
    camera.position.set(posCam.x, posCam.y + joueur.hauteurYeux + balancement - joueur.chute * 0.06, posCam.z);
    const penche = -(joueur.vel.x * c - joueur.vel.z * s) * 0.0028 * reglages.bob;
    camera.rotation.set(joueur.tangage + L.reculPitch + joueur.sursaut * 0.02, joueur.lacet + L.reculYaw, penche);
    zoom = zoomActuel;
    hud.killcam(null);
  } else {
    mortCamT += dt;
    if (killcam && mortCamT > killcam.attente && killcam.t < killcam.duree) {
      killcam.t += dt;
      majKillcam();
      return { zoom: 1, armeVisible: false, killcam: true };
    }
    if (killcam && killcam.t >= killcam.duree) { killcam = null; hud.killcam(null); }
    if (MODES[regles.mode].equipes && partie.mode !== "enligne" && mortCamT > 1.2 && !killcam) {
      if (!spectateur || !spectateur.cible.vivant) changerSpectateur(1);
      if (spectateur) {
        const b = spectateur.cible;
        let d = b.yaw + Math.PI - spectateur.lacet;
        d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
        spectateur.lacet += d * (1 - Math.exp(-8 * dt));
        spectateur.tangage += (b.pitch - spectateur.tangage) * (1 - Math.exp(-8 * dt));
        camera.position.set(b.x, b.yeux, b.z);
        camera.rotation.set(spectateur.tangage, spectateur.lacet, 0);
        restaurations.push([b.modele.racine, b.modele.racine.position.clone(), b.modele.racine.rotation.y, b.modele.racine.visible]);
        b.modele.racine.visible = false;
        hud.killcam("SPECTATEUR · " + b.nom + " · clic pour changer");
        if (controles.souris.gauche) { controles.souris.gauche = false; changerSpectateur(1); }
        return { zoom: 1, armeVisible: false, killcam: true, spectateur: true };
      }
    }
    camera.position.y += (joueur.pos.y + 0.35 - camera.position.y) * (1 - Math.exp(-4 * dt));
    camera.rotation.z += (0.5 - camera.rotation.z) * (1 - Math.exp(-3 * dt));
    if (!killcam) hud.killcam(regles.mode === "deathmatch" || partie.mode === "enligne" ? "Réapparition…" : null);
    return { zoom: 1, armeVisible: false };
  }

  vue.amplitudeBob = reglages.bob;
  vue.maj({
    dt, temps, vitesse: vit, auSol: joueur.auSol, vise: joueur.visee, sprint: joueur.sprint && vit > 4,
    souris: { x: regard.dx, y: regard.dy }, recharge: L.progressionRecharge, rechargeVide: L.rechargeVide, cycle: L.progressionCycle, mun: L.mun,
  });
  audio.ecouteur(camera.position.x, camera.position.y, camera.position.z, -s, 0, -c);
  return { zoom, armeVisible: true };
}

// Killcam : rejoue l'enregistrement depuis les yeux du tueur
const restaurations = [];
function majKillcam() {
  const kc = killcam;
  const tCible = kc.debut + kc.t;
  let f = enregistrement[enregistrement.length - 1];
  for (const x of enregistrement) if (x.t >= tCible) { f = x; break; }
  const tueur = f.b.get(kc.tueur);
  for (const [b, e] of f.b) {
    if (!b.modele) continue;
    const r = b.modele.racine;
    restaurations.push([r, r.position.clone(), r.rotation.y, r.visible]);
    r.position.set(e.x, 0, e.z);
    r.rotation.y = e.yaw;
    r.visible = e.v;
  }
  // Le joueur, vu par le tueur
  const arme = joueur.inventaire.principale || joueur.inventaire.secondaire || "pistolet";
  if (!modeleJoueur || modeleJoueur.armeId !== arme) {
    if (modeleJoueur) scene.remove(modeleJoueur.racine);
    modeleJoueur = new Personnage("avantgarde", 4, qualite, arme);
    scene.add(modeleJoueur.racine);
  }
  modeleJoueur.racine.visible = true;
  modeleJoueur.racine.position.set(f.j.x, f.j.y, f.j.z);
  modeleJoueur.racine.rotation.y = f.j.l + Math.PI;
  modeleJoueur.maj({ dt: 1 / 60, vitesse: f.j.s, dirX: 0, dirZ: 1, vise: true, tangage: f.j.g, recharge: -1 });
  if (tueur) {
    camera.position.set(tueur.x, 1.6, tueur.z);
    camera.rotation.set(tueur.pitch || 0, tueur.yaw + Math.PI, 0);
    kc.tueur.modele.racine.visible = false;
  }
  hud.killcam(`KILLCAM · Éliminé par ${kc.tueur.nom}${kc.arme && ARMES[kc.arme] ? " (" + ARMES[kc.arme].nom + ")" : ""}${kc.tete ? " · headshot" : ""}`);
}
function restaurerKillcam() {
  for (const [r, p, y, v] of restaurations) { r.position.copy(p); r.rotation.y = y; r.visible = v; }
  restaurations.length = 0;
  if (modeleJoueur) modeleJoueur.racine.visible = false;
}

// ===== Interface (à chaque image) =====
function textePhase() {
  if (partie.mode === "enligne") return `PREMIER À ${enLigne.objectif}`;
  const r = regles;
  if (r.mode === "deathmatch") return `PREMIER À ${OBJECTIF_DM}`;
  if (r.mode === "stand") return DEFIS[r.defi.id].nom.toUpperCase();
  if (r.phase === "preparation") return "ACHAT";
  if (r.phase === "spike") return "SPIKE POSÉ";
  if (r.phase === "combat") return `MANCHE ${r.manche}`;
  return "";
}

function texteAide() {
  if (!joueur.vivant || partie.mode === "enligne") return "";
  const r = regles;
  if (r.mode === "stand") return `${etiquette("KeyB")} : changer d'arme · Échap : quitter`;
  if (r.mode === "deathmatch") return `${etiquette("KeyB")} : changer d'arme`;
  if (r.phase === "preparation") return `${etiquette("KeyB")} : boutique · ${etiquette("KeyV")} : ordres à l'équipe`;
  const s = r.spike;
  if (s && r.phase === "combat" && joueur.porteSpike) return joueur.dansSite ? `Maintiens ${etiquette("KeyF")} pour poser le spike` : "Tu portes le spike : va sur le site A ou B";
  if (s && s.etat === "pose" && r.campJoueur === "defense" && Math.hypot(joueur.x - s.x, joueur.z - s.z) < 2.5) return `Maintiens ${etiquette("KeyF")} pour désamorcer`;
  return "";
}

function majVisuels(dt, alpha) {
  const cam = majCamera(dt, alpha);
  effets.maj(dt);
  carte.majAmbiance(dt, camera);
  const def = joueur.def;
  const L = joueur.logique;

  // Champ de vision et zoom (lunette du sniper)
  const lunette = joueur.vivant && def.lunette && vue.viseeK > 0.88;
  if (!cam.killcam) {
    const vfov = fovVertical(reglages.fov);
    const fovFinal = (2 * Math.atan(Math.tan(vfov / 2) / cam.zoom)) / DEG;
    if (Math.abs(camera.fov - fovFinal) > 0.01) { camera.fov = fovFinal; camera.updateProjectionMatrix(); }
  } else {
    const fov = fovVertical(reglages.fov) / DEG;
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }
  vue.pivot.visible = cam.armeVisible && !lunette;

  // Marqueurs des ennemis révélés
  competences.majMarqueurs(bots.liste.filter((b) => b.vivant && b.reveleT > 0 && bots.estEnnemi(joueur, b)), temps);
  teinteT = Math.max(0, teinteT - dt);

  const imprecision = L.imprecision(joueur.etatTir());
  const enEquipe = MODES[regles.mode].equipes && partie.mode !== "enligne";
  const allies = enEquipe ? bots.liste.filter((b) => b.equipe === joueur.equipe && !b.mannequin) : [];
  const ennemis = enEquipe ? bots.liste.filter((b) => b.equipe !== joueur.equipe && !b.mannequin) : [];
  let scoreMoi = 0, scoreTete = 0;
  if (partie.mode === "enligne") {
    scoreMoi = (enLigne.scores[reseau.id] || { kills: 0 }).kills;
    scoreTete = Math.max(0, ...enLigne.classement().filter((l) => !l.moi).map((l) => l.kills));
  } else if (regles.mode === "deathmatch") {
    scoreMoi = joueur.kills;
    scoreTete = Math.max(0, ...bots.liste.map((b) => b.kills || 0));
  }
  const defi = regles.mode === "stand" ? regles.defi : null;
  const resume = partie.mode === "enligne" ? { mode: "enligne", phase: "combat", scores: { bleu: 0, rouge: 0 }, spike: null, chrono: 0 } : regles.resume();
  hud.maj(dt, {
    temps, joueur, regles: resume,
    recharge: L.progressionRecharge,
    vise: vue.viseeK > 0.5 && def.type !== "melee", lunette, couteau: def.type === "melee",
    masquerViseur: !joueur.vivant || lunette || (vue.viseeK > 0.5 && def.type !== "melee"),
    imprecisionPx: (Math.tan(imprecision * DEG) / Math.tan(camera.fov * DEG / 2)) * (innerHeight / 2),
    chrono: resume.chrono,
    textePhase: textePhase(),
    texteCamp: partie.mode === "enligne" ? "EN LIGNE · " + (salon ? salon.code : "") : regles.mode === "deathmatch" ? "DEATHMATCH" : regles.mode === "stand" ? "STAND DE TIR" : regles.campJoueur === "attaque" ? "ATTAQUE" : "DÉFENSE",
    equipeMoi: enEquipe ? [allies.length + 1, allies.filter((b) => b.vivant).length + (joueur.vivant ? 1 : 0)] : [0, 0],
    equipeEux: enEquipe ? [ennemis.length, ennemis.filter((b) => b.vivant).length] : [0, 0],
    scoreMoi, scoreTete,
    defiScore: defi ? defi.cibles : 0,
    defiObjectif: defi ? (DEFIS[defi.id].cibles ? "/" + DEFIS[defi.id].cibles : DEFIS[defi.id].duree ? "60 s" : "∞") : "",
    aide: texteAide(),
    credits: enEquipe && (regles.phase === "preparation" || boutiqueOuverte) ? joueur.credits : null,
    progression: jeu.progression,
    aveugle: joueur.aveugleT > 0 ? Math.min(1, joueur.aveugleT / Math.min(1.2, joueur.aveugleMax)) : 0,
    teinte: teinteT > 0 || joueur.surchargeT > 0 ? teinteCouleur : null,
    fumees: competences.fumees, spike: resume.spike,
    allies: allies.filter((b) => b.vivant).map((b) => ({ x: b.x, z: b.z, porteSpike: !!(regles.spike && regles.spike.porteur === b) })),
    ennemisVus,
    vue: joueur.vivant ? { x: joueur.x, z: joueur.z, lacet: joueur.lacet } : null,
  });

  // Tableau des scores (Tab)
  if (controles.cmd.tableau && partie.etat === "jeu") hud.tableau(true, ...donneesTableau());
  else hud.tableau(false);
  return cam;
}

function donneesTableau() {
  if (partie.mode === "enligne") return [`EN LIGNE · ${salon ? salon.code : ""}`, enLigne.classement().map((l) => ({ nom: l.nom, kills: l.kills, morts: l.morts, joueur: l.moi, equipe: l.moi ? "moi" : "eux" }))];
  if (regles.mode === "deathmatch") {
    const lignes = [{ nom: joueur.nom, kills: joueur.kills, morts: joueur.morts, joueur: true, equipe: "moi", vivant: joueur.vivant }, ...bots.liste.map((b) => ({ nom: b.nom, kills: b.kills, morts: b.morts, equipe: "eux", vivant: b.vivant }))];
    return ["DEATHMATCH", lignes.sort((a, b) => b.kills - a.kills)];
  }
  if (regles.mode === "stand") return ["STAND DE TIR", [{ nom: joueur.nom, kills: joueur.stats.kills, morts: 0, joueur: true, equipe: "moi" }]];
  const moi = [{ nom: joueur.nom, kills: joueur.stats.kills, morts: joueur.stats.morts, extra: "¤" + joueur.credits, joueur: true, equipe: "moi", vivant: joueur.vivant }];
  for (const b of bots.liste) if (b.equipe === joueur.equipe) moi.push({ nom: b.nom, kills: b.kills, morts: b.morts, extra: "¤" + b.credits, equipe: "moi", vivant: b.vivant });
  const eux = bots.liste.filter((b) => b.equipe !== joueur.equipe).map((b) => ({ nom: b.nom, kills: b.kills, morts: b.morts, equipe: "eux", vivant: b.vivant }));
  return [`${MODES[regles.mode].nom.toUpperCase()} · ${regles.scores.bleu} – ${regles.scores.rouge}`, [...moi, ...eux]];
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
  if (fpsT >= 0.5) { if (reglages.fps) $("fps").textContent = Math.round(fpsN / fpsT) + " FPS · " + Math.round(dyn.echelle * 100) + " %"; fpsT = 0; fpsN = 0; }
  const manette = controles.maj(dt, reglages);
  if (manette && partie.etat !== "jeu") navigationManette(manette);
  traiterActions();

  const simu = partie.etat === "jeu" || (partie.etat === "pause" && partie.mode === "enligne");
  if (simu) {
    accumulateur += dt;
    let n = 0;
    while (accumulateur >= PAS && n++ < 8) { simuler(PAS); accumulateur -= PAS; }
    if (n >= 8) accumulateur = 0;
  }
  if (partie.etat === "jeu" || (simu && partie.etat === "pause")) {
    const cam = majVisuels(dt, accumulateur / PAS);
    if (partie.etat === "jeu") majResolution(dt);
    rendre(cam.armeVisible && vue.pivot.visible);
    if (cam.killcam) restaurerKillcam();
    return;
  }
  if (partie.etat === "menu" || partie.etat === "chargement") {
    // Survol cinématique de l'arène derrière le menu
    orbite += dt * 0.05;
    const L = carte.limites;
    const cx = (L.minX + L.maxX) / 2, cz = (L.minZ + L.maxZ) / 2;
    camera.position.set(cx + Math.sin(orbite) * 30 + 8, 15 + Math.sin(orbite * 0.7) * 1.5, cz + Math.cos(orbite) * 22);
    camera.lookAt(cx + 6, 0, cz - 3);
    camera.fov = 55;
    camera.updateProjectionMatrix();
    effets.maj(dt);
    carte.majAmbiance(dt, camera);
  }
  if (partie.etat !== "chargement") rendre(partie.etat === "pause" && joueur.vivant);
}

// ===== Entrées =====
const canvas = renderer.domElement;
function verrouiller() {
  if (controles.tactileActif) return;
  try {
    const p = canvas.requestPointerLock({ unadjustedMovement: true });
    if (p && p.catch) p.catch(() => { try { canvas.requestPointerLock(); } catch (e) { /* refusé */ } });
  } catch (e) {
    try { canvas.requestPointerLock(); } catch (e2) { /* refusé : on joue quand même */ }
  }
}

addEventListener("keydown", (e) => {
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT")) return;
  if (partie.etat !== "jeu") {
    controles.apprendre(e);
    if (e.code === "Escape" && document.querySelector(".ecran.visible [data-retour]")) retourEcran();
    return;
  }
  if (["Space", "Tab", "ControlLeft", "KeyC", "KeyE", "KeyR", "KeyQ", "KeyX", "KeyF", "KeyB", "KeyV", "KeyG"].includes(e.code)) e.preventDefault();
  controles.clavierBas(e);
});
addEventListener("keyup", (e) => controles.clavierHaut(e));
addEventListener("blur", () => {
  controles.relacher();
  if (partie.etat === "jeu" && partie.mode !== "enligne") pause();
});
canvas.addEventListener("mousedown", (e) => {
  if (partie.etat !== "jeu") return;
  if (!document.pointerLockElement && !controles.tactileActif) verrouiller();
  if (e.button === 0) controles.souris.gauche = true;
  if (e.button === 2) controles.souris.droit = true;
});
addEventListener("mouseup", (e) => {
  if (e.button === 0) controles.souris.gauche = false;
  if (e.button === 2) controles.souris.droit = false;
});
addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("mousemove", (e) => {
  if (partie.etat !== "jeu" || document.pointerLockElement !== canvas) return;
  controles.regard.dx += e.movementX;
  controles.regard.dy += e.movementY;
});
addEventListener("wheel", (e) => { if (partie.etat === "jeu" && document.pointerLockElement === canvas) controles.molette(e); }, { passive: true });

let verrouAvant = false;
document.addEventListener("pointerlockchange", () => {
  const verrou = document.pointerLockElement === canvas;
  if (verrouAvant && !verrou && partie.etat === "jeu" && !boutiqueOuverte) pause();
  verrouAvant = verrou;
});

controles.enJeu = () => partie.etat === "jeu";
controles.installerTactile($("tactile"));
function etiquette(code) { return controles.etiquette(code); }
controles.surDisposition = () => { hud.etiquettesTouches(etiquette); remplirCommandes(); };

// Navigation dans les menus à la manette
function navigationManette(m) {
  const ecran = document.querySelector(".ecran.visible");
  if (!ecran) return;
  const boutons = [...ecran.querySelectorAll("button:not([disabled]), a.bouton-lien, input, select")].filter((b) => b.offsetParent);
  if (!boutons.length) return;
  let i = boutons.indexOf(document.activeElement);
  if (m.bas || m.droite) { i = (i + 1) % boutons.length; boutons[i].focus(); }
  if (m.haut || m.gauche) { i = (i - 1 + boutons.length) % boutons.length; boutons[i].focus(); }
  if (m.valider && document.activeElement && boutons.includes(document.activeElement)) document.activeElement.click();
  if (m.retour) { const r = ecran.querySelector("[data-retour]"); if (r) r.click(); }
  if (m.start && partie.etat === "pause") reprendre();
}

// ===== Écrans et menus =====
const pile = [];
const qualiteChoisieAuDemarrage = reglages.qualite;
function afficherEcran(id) {
  document.querySelectorAll(".ecran").forEach((e) => e.classList.toggle("visible", e.id === id));
  if (id === "ecran-carriere") remplirCarriere();
  if (id === "ecran-arsenal") remplirArsenal();
  if (id === "ecran-agents") remplirAgents();
  if (id === "ecran-modes") remplirModes();
  if (id === "ecran-enligne") preparerEnLigne();
}
function ouvrirEcran(id) {
  const actuel = document.querySelector(".ecran.visible");
  if (actuel) pile.push(actuel.id);
  afficherEcran(id);
}
function retourEcran() {
  if (document.querySelector("#ecran-reglages.visible") && reglages.qualite !== qualiteChoisieAuDemarrage && partie.etat === "menu") { location.reload(); return; }
  afficherEcran(pile.pop() || (partie.etat === "pause" ? "ecran-pause" : "ecran-menu"));
}
document.querySelectorAll("[data-ouvre]").forEach((b) => b.addEventListener("click", () => { audio.demarrer(); musique.demarrer(); audio.clic(); ouvrirEcran(b.dataset.ouvre); }));
document.querySelectorAll("[data-retour]").forEach((b) => b.addEventListener("click", () => { audio.clic(); retourEcran(); }));
document.addEventListener("mouseover", (e) => { if (e.target.closest && e.target.closest("button, .bouton-lien") && !e.target.closest("#tactile")) audio.survol(); });

// Groupe de boutons à choix unique
function choix(conteneur, options, valeur, surChoix) {
  const el = $(conteneur);
  el.innerHTML = "";
  for (const [v, texte] of options) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = texte;
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(v === valeur));
    b.addEventListener("click", () => { audio.clic(); surChoix(v); for (const x of el.children) x.setAttribute("aria-checked", String(x === b)); });
    el.appendChild(b);
  }
}

function remplirModes() {
  const conteneur = $("choix-mode");
  conteneur.innerHTML = "";
  for (const [id, m] of Object.entries(MODES)) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "carte-choix mode-" + id + (reglages.mode === id ? " choisie" : "");
    b.innerHTML = "<strong></strong><span></span>";
    b.querySelector("strong").textContent = m.nom;
    b.querySelector("span").textContent = m.texte;
    b.addEventListener("click", () => { audio.clic(); reglages.mode = id; sauverReglages(); remplirModes(); });
    conteneur.appendChild(b);
  }
  const stand = reglages.mode === "stand";
  $("groupe-carte").hidden = stand;
  $("groupe-defi").hidden = !stand;
  $("options-partie").hidden = stand;
  $("groupe-allies").hidden = !MODES[reglages.mode].equipes;
  choix("choix-carte", CARTES_JOUABLES.map((id) => [id, CARTES[id].nom]), reglages.carte, (v) => { reglages.carte = v; sauverReglages(); });
  choix("choix-defi", Object.entries(DEFIS).map(([id, d]) => [id, d.nom + (profilJ.d.defis[id] !== undefined ? ` · record ${profilJ.d.defis[id]}${d.score === "temps" ? " s" : ""}` : "")]), reglages.defi, (v) => { reglages.defi = v; sauverReglages(); });
  choix("choix-difficulte", Object.entries(DIFFICULTES).map(([id, d]) => [id, d.nom]), reglages.difficulte, (v) => { reglages.difficulte = v; sauverReglages(); });
  choix("choix-allies", [[true, "5 contre 5"], [false, "Seul contre 5"]], reglages.allies, (v) => { reglages.allies = v; sauverReglages(); });
  choix("choix-heure", [["jour", "Jour"], ["soir", "Soir"], ["nuit", "Nuit"], ["aleatoire", "Hasard"]], reglages.heure, (v) => { reglages.heure = v; sauverReglages(); });
  choix("choix-meteo", [["clair", "Clair"], ["pluie", "Pluie"], ["brouillard", "Brouillard"], ["aleatoire", "Hasard"]], reglages.meteo, (v) => { reglages.meteo = v; sauverReglages(); });
}

function remplirAgents() {
  const el = $("liste-agents");
  el.innerHTML = "";
  for (const a of Object.values(AGENTS)) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "carte-choix agent" + (profilJ.d.agent === a.id ? " choisie" : "");
    b.style.setProperty("--couleur-agent", a.couleur);
    b.innerHTML = "<strong></strong><em></em><span class='texte'></span><span class='cap'><b>E</b> <i></i></span><span class='cap'><b>X</b> <i></i></span>";
    b.querySelector("strong").textContent = a.nom;
    b.querySelector("em").textContent = a.role;
    b.querySelector(".texte").textContent = a.texte;
    const caps = b.querySelectorAll(".cap i");
    caps[0].textContent = CAPACITES[a.signature].nom + " — " + CAPACITES[a.signature].texte;
    caps[1].textContent = CAPACITES[a.ultime].nom + " — " + CAPACITES[a.ultime].texte;
    b.addEventListener("click", () => { audio.clic(); profilJ.d.agent = a.id; profilJ.sauver(); remplirAgents(); majBadge(); });
    el.appendChild(b);
  }
}

function remplirArsenal() {
  const el = $("liste-arsenal");
  el.innerHTML = "";
  for (const id of ["fusil", "sniper", "pompe", "pistolet", "couteau"]) {
    const ligne = document.createElement("div");
    ligne.className = "ligne-arsenal";
    const nom = document.createElement("strong");
    nom.textContent = ARMES[id].nom;
    ligne.appendChild(nom);
    const skins = document.createElement("div");
    skins.className = "skins";
    for (const [sid, sk] of Object.entries(SKINS)) {
      const b = document.createElement("button");
      b.type = "button";
      const ok = profilJ.skinDebloque(sid);
      b.className = "skin" + ((profilJ.d.skins[id] || "standard") === sid ? " choisie" : "") + (ok ? "" : " verrouille");
      b.style.setProperty("--c1", "#" + sk.carcasse.toString(16).padStart(6, "0"));
      b.style.setProperty("--c2", "#" + sk.accent.toString(16).padStart(6, "0"));
      b.title = ok ? sk.nom : `${sk.nom} : niveau ${NIVEAUX_SKINS[sid]}`;
      b.innerHTML = "<i></i><span></span>";
      b.querySelector("span").textContent = ok ? sk.nom : "Niv. " + NIVEAUX_SKINS[sid];
      b.disabled = !ok;
      b.addEventListener("click", () => { audio.clic(); profilJ.d.skins[id] = sid; profilJ.sauver(); remplirArsenal(); });
      skins.appendChild(b);
    }
    ligne.appendChild(skins);
    el.appendChild(ligne);
  }
}

function remplirCarriere() {
  const d = profilJ.d, s = d.stats;
  $("champ-pseudo").value = profilJ.pseudo === "Joueur" ? d.pseudo : profilJ.pseudo;
  $("champ-pseudo").disabled = !!(profilJ.compte && profilJ.compte.connecte);
  $("carriere-niveau").innerHTML = "<div class='xp-ligne'><span></span><span></span></div><div class='xp-barre'><i></i></div>";
  $("carriere-niveau").querySelectorAll("span")[0].textContent = "Niveau " + d.niveau;
  $("carriere-niveau").querySelectorAll("span")[1].textContent = `${d.xp} / ${Profil.xpNiveau(d.niveau)} XP`;
  $("carriere-niveau").querySelector("i").style.width = Math.round(profilJ.progression * 100) + "%";
  const kd = s.morts ? (s.kills / s.morts).toFixed(2) : String(s.kills);
  remplirStats($("carriere-stats"), [[s.parties, "Parties"], [s.victoires, "Victoires"], [s.kills, "Éliminations"], [kd, "Ratio K/D"], [s.kills ? Math.round((s.tetes / s.kills) * 100) + " %" : "0 %", "Headshots"], [s.aces, "Aces"]]);
  const g = $("carriere-succes");
  g.innerHTML = "";
  for (const [id, su] of Object.entries(SUCCES)) {
    const div = document.createElement("div");
    div.className = "succes" + (d.succes[id] ? " debloque" : "");
    div.innerHTML = "<span class='icone'></span><div class='corps'><strong></strong><span class='texte'></span></div>";
    div.querySelector(".icone").textContent = d.succes[id] ? su.icone : "🔒";
    div.querySelector("strong").textContent = su.nom;
    div.querySelector(".texte").textContent = su.texte;
    g.appendChild(div);
  }
  remplirStats($("carriere-defis"), Object.entries(DEFIS).filter(([id]) => id !== "libre").map(([id, df]) => [d.defis[id] !== undefined ? d.defis[id] + (df.score === "temps" ? " s" : "") : "—", df.nom]));
  const cl = $("carriere-classement");
  cl.innerHTML = "<p class='astuce'>Chargement…</p>";
  classement().then((r) => {
    if (!r || !r.joueurs) { cl.innerHTML = "<p class='astuce'>Classement indisponible ici (il fonctionne sur le site en ligne).</p>"; return; }
    cl.innerHTML = "";
    if (!r.joueurs.length) cl.innerHTML = "<p class='astuce'>Personne n'est encore classé : sois le premier !</p>";
    else {
      const t = document.createElement("table");
      t.className = "classement";
      t.innerHTML = "<tr><th>#</th><th>Joueur</th><th>Niv.</th><th>XP</th><th>Victoires</th><th>K/D</th></tr>";
      r.joueurs.forEach((j, i) => {
        const tr = document.createElement("tr");
        for (const v of [i + 1, j.pseudo, j.niveau, j.xp, j.victoires, j.morts ? (j.kills / j.morts).toFixed(2) : j.kills]) { const td = document.createElement("td"); td.textContent = v; tr.appendChild(td); }
        t.appendChild(tr);
      });
      cl.appendChild(t);
    }
    if (!(profilJ.compte && profilJ.compte.connecte)) { const p = document.createElement("p"); p.className = "astuce"; p.innerHTML = 'Pour apparaître ici, <a href="../compte.php">connecte-toi sur le site</a>.'; cl.appendChild(p); }
  });
}
$("champ-pseudo").addEventListener("input", (e) => { profilJ.d.pseudo = e.target.value.replace(/[<>&"']/g, "").slice(0, 16); profilJ.sauver(); majBadge(); });

function majBadge() {
  const d = profilJ.d;
  const a = AGENTS[d.agent] || AGENTS.volt;
  const badge = $("badge-profil");
  badge.innerHTML = "<div class='badge-nom'></div><div class='xp-ligne'><span></span><span></span></div><div class='xp-barre'><i></i></div>";
  badge.querySelector(".badge-nom").textContent = profilJ.pseudo + (profilJ.compte && profilJ.compte.connecte ? " ✓" : "");
  badge.querySelectorAll(".xp-ligne span")[0].textContent = "Niveau " + d.niveau;
  badge.querySelectorAll(".xp-ligne span")[1].textContent = `${d.xp} / ${Profil.xpNiveau(d.niveau)} XP`;
  badge.querySelector("i").style.width = Math.round(profilJ.progression * 100) + "%";
  $("tuile-agent").textContent = a.nom + " · " + a.role;
  joueur.nom = profilJ.pseudo;
}

function remplirCommandes() {
  const e = etiquette;
  const lignes = [
    [`${e("KeyW")} ${e("KeyA")} ${e("KeyS")} ${e("KeyD")}`, "Se déplacer"], ["Souris", "Viser"], ["Clic gauche", "Tirer (la 1re balle est la plus précise)"],
    ["Clic droit", "Viser avec la mire / coup lourd au couteau"], [e("KeyR"), "Recharger"], ["1 · 2 · 3 / molette", "Arme principale, pistolet, couteau"],
    [e("Space"), "Sauter"], [e("ShiftLeft"), "Courir"], [e("ControlLeft"), "S'accroupir (silencieux et précis)"],
    [e("KeyC"), "Fumée"], [e("KeyQ"), "Flash (détourne le regard !)"], [e("KeyE"), "Compétence signature de l'agent"], [e("KeyX"), "Ultime (se charge en éliminant)"],
    [e("KeyF") + " (maintenir)", "Poser / désamorcer le spike"], [e("KeyG"), "Lâcher le spike"], [e("KeyB"), "Boutique"], [e("KeyV"), "Ordres aux coéquipiers"],
    ["Tab", "Tableau des scores"], [e("KeyY"), "Inspecter l'arme"], ["Échap", "Pause"],
  ];
  const el = $("liste-touches");
  el.innerHTML = "";
  for (const [k, t] of lignes) {
    const kb = document.createElement("kbd"); kb.textContent = k;
    const sp = document.createElement("span"); sp.textContent = t;
    el.append(kb, sp);
  }
}

// ===== Boutique =====
function ouvrirBoutique() {
  if (!regles.peutAcheter()) { hud.annonce("", "La boutique s'ouvre pendant la phase d'achat", "#94a7c9", 1.4); return; }
  boutiqueOuverte = true;
  controles.relacher();
  if (document.pointerLockElement) document.exitPointerLock();
  $("boutique").classList.remove("cache");
  remplirBoutique();
}
function fermerBoutique(reverrouiller) {
  if (!boutiqueOuverte) return;
  boutiqueOuverte = false;
  $("boutique").classList.add("cache");
  if (reverrouiller && partie.etat === "jeu") verrouiller();
}
function remplirBoutique() {
  const gratuit = regles.gratuit() || partie.mode === "enligne";
  $("boutique-credits").textContent = gratuit ? "Gratuit dans ce mode" : "¤ " + joueur.credits;
  $("boutique-note").textContent = gratuit ? "Choisis l'arme avec laquelle tu (ré)apparais." : "Clique à nouveau sur un achat de cette manche pour le revendre.";
  for (const id of ["boutique-armes", "boutique-armures", "boutique-capacites"]) $(id).innerHTML = "";
  const article = (conteneur, cle, detail) => {
    const a = ARTICLES[cle];
    const b = document.createElement("button");
    b.type = "button";
    const possede = a.type === "arme" ? joueur.possede(cle) : a.type === "armure" ? joueur.armure >= a.valeur : (cle === "fumee" ? joueur.fumees : joueur.flashs) >= a.max;
    const prix = gratuit ? 0 : a.prix;
    b.className = "article" + (possede ? " possede" : "") + (!possede && joueur.credits < prix ? " cher" : "");
    b.innerHTML = "<strong></strong><span class='detail'></span><span class='prix'></span>";
    b.querySelector("strong").textContent = a.nom;
    b.querySelector(".detail").textContent = detail;
    b.querySelector(".prix").textContent = possede ? "✓" : prix ? "¤ " + prix : "Gratuit";
    b.addEventListener("click", () => {
      if (partie.mode === "enligne") { joueur.donnerArme(cle); regles.chargementDM = cle; audio.achat(true); }
      else regles.acheter(cle);
      remplirBoutique();
    });
    $(conteneur).appendChild(b);
  };
  const desc = { pistolet: "Semi-auto, précis", pompe: "Dévastateur de près", fusil: "Automatique, polyvalent", sniper: "Lunette ×3,6, tue en un tir à la tête" };
  for (const id of ["pistolet", "pompe", "fusil", "sniper"]) article("boutique-armes", id, `${desc[id]} · ${ARMES[id].degats.tete} à la tête`);
  const equipes = MODES[regles.mode].equipes && partie.mode !== "enligne";
  $("boutique-armures").parentElement.hidden = !equipes;
  if (equipes) {
    article("boutique-armures", "armure25", "Absorbe une partie des dégâts");
    article("boutique-armures", "armure50", "Protection maximale");
    article("boutique-capacites", "fumee", `Touche ${etiquette("KeyC")} · ${joueur.fumees}/2`);
    article("boutique-capacites", "flash", `Touche ${etiquette("KeyQ")} · ${joueur.flashs}/2`);
  }
}
$("boutique-fermer").addEventListener("click", () => fermerBoutique(true));

// ===== Démarrage d'une partie =====
function attendreImage() { return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); }

function preparerJoueur() {
  joueur.agent = profilJ.d.agent;
  joueur.skins = { ...profilJ.d.skins };
  joueur.nom = profilJ.pseudo;
  hud.agent(joueur.agent);
  hud.appliquerViseur(profilJ.d.viseur);
  hud.etiquettesTouches(etiquette);
  hud.vider();
  competences.vider();
  killcam = null; spectateur = null; enregistrement.length = 0; succesDeLaPartie = [];
  accumulateur = 0;
  temps = 0;
}

async function demarrerPartie() {
  audio.demarrer();
  musique.demarrer();
  audio.clic();
  const mode = reglages.mode;
  const idCarte = mode === "stand" ? "stand" : reglages.carte;
  const heure = mode === "stand" ? "jour" : reglages.heure;
  const meteo = mode === "stand" ? "clair" : reglages.meteo;
  const changement = carte.id !== idCarte || heure === "aleatoire" || meteo === "aleatoire" || carte.ambiance.heure !== heure || carte.ambiance.meteo !== meteo;
  if (changement) {
    $("texte-chargement").textContent = `Chargement de ${CARTES[idCarte].nom}…`;
    partie.etat = "chargement";
    afficherEcran("ecran-chargement");
    await attendreImage();
    chargerCarte(idCarte, heure, meteo);
  }
  pile.length = 0;
  afficherEcran(null);
  $("hud").classList.remove("cache");
  $("tactile").classList.toggle("cache", !controles.tactileActif);
  partie.etat = "jeu";
  partie.mode = mode;
  jeu.difficulte = DIFFICULTES[reglages.difficulte] || DIFFICULTES.normal;
  preparerJoueur();
  vue.prechauffer(["pistolet", "fusil", "couteau"], joueur.skins);
  regles.demarrer({ mode, allies: reglages.allies, defi: reglages.defi });
  renderer.shadowMap.needsUpdate = true;
  verrouiller();
}

function pause() {
  if (partie.etat !== "jeu") return;
  partie.etat = "pause";
  controles.relacher();
  basculerOrdres(false);
  fermerBoutique(false);
  const r = regles;
  $("pause-score").textContent = partie.mode === "enligne" ? "Partie en ligne : le jeu continue pendant la pause !" : r.mode === "deathmatch" ? `${joueur.kills} éliminations` : r.mode === "stand" ? DEFIS[r.defi.id].nom : `Manche ${r.manche} · ${r.scores.bleu} à ${r.scores.rouge}`;
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
  if (partie.mode === "enligne") quitterEnLigne();
  partie.etat = "menu";
  partie.mode = "menu";
  pile.length = 0;
  bots.vider();
  effets.vider();
  competences.vider();
  regles.retirerSpike();
  carte.barriere.activer(false);
  $("hud").classList.add("cache");
  $("tactile").classList.add("cache");
  musique.etat("menu");
  afficherEcran("ecran-menu");
  majBadge();
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
$("bouton-rejouer").addEventListener("click", () => { if (partie.mode === "enligne") { allerAuMenu(); ouvrirEcran("ecran-enligne"); } else demarrerPartie(); });
$("bouton-menu").addEventListener("click", allerAuMenu);
$("r-plein-ecran").addEventListener("click", pleinEcran);
document.addEventListener("fullscreenchange", () => { $("r-plein-ecran").textContent = document.fullscreenElement ? "Quitter le plein écran" : "Passer en plein écran"; });

// ===== Paramètres =====
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
const pct = (v) => Math.round(v * 100) + " %";
lierReglage("sensibilite", "sensibilite", (v) => v.toFixed(2));
lierReglage("sensibiliteManette", "sensibiliteManette", (v) => v.toFixed(2));
lierReglage("fov", "fov", (v) => v + "°");
lierReglage("volume", "volume", pct, (v) => audio.reglerVolume(v));
lierReglage("musique", "musique", pct, (v) => musique.reglerVolume(v));
lierReglage("ambiance", "ambiance", pct, (v) => audio.reglerAmbiance(v));
lierReglage("bob", "bob", pct);
lierReglage("luminosite", "luminosite", pct, (v) => { renderer.toneMappingExposure = carte.ambiance.exposition * v; });
function lierCase(id, cle, apres) {
  const c = $("r-" + id);
  c.checked = !!reglages[cle];
  c.addEventListener("change", () => { reglages[cle] = c.checked; sauverReglages(); if (apres) apres(c.checked); });
}
lierCase("annonceur", "annonceur", (v) => { audio.annonceur = v; });
lierCase("resolutionDynamique", "resolutionDynamique");
lierCase("fps", "fps", (v) => { $("fps").hidden = !v; });
$("fps").hidden = !reglages.fps;
$("r-qualite").value = reglages.qualite;
$("info-qualite").textContent = `En cours : ${{ basse: "faible", moyenne: "moyenne", haute: "élevée" }[qualite]}${reglages.qualite === "auto" ? " (choisie automatiquement)" : ""}. Carte graphique : ${detection.gpu ? detection.gpu.replace(/^ANGLE \(|\)$/g, "").slice(0, 70) : "inconnue"}.`;
$("r-qualite").addEventListener("change", (e) => {
  reglages.qualite = e.target.value;
  sauverReglages();
  $("note-qualite").hidden = reglages.qualite === qualiteChoisieAuDemarrage;
});

// Viseur personnalisé
function lierViseur() {
  const v = profilJ.d.viseur;
  const apercu = $("apercu-viseur");
  const maj = () => { hud.appliquerViseur(v, apercu); hud.appliquerViseur(v); profilJ.sauver(); };
  $("v-couleur").value = v.couleur;
  $("v-couleur").addEventListener("input", (e) => { v.couleur = e.target.value; maj(); });
  for (const k of ["longueur", "epaisseur", "ecart"]) {
    const c = $("v-" + k);
    c.value = v[k];
    $("ov-" + k).textContent = v[k];
    c.addEventListener("input", () => { v[k] = Number(c.value); $("ov-" + k).textContent = v[k]; maj(); });
  }
  for (const k of ["point", "contour", "dynamique"]) {
    const c = $("v-" + k);
    c.checked = !!v[k];
    c.addEventListener("change", () => { v[k] = c.checked; maj(); });
  }
  maj();
}
lierViseur();

// ===== En ligne =====
function statut(t) { $("enligne-statut").textContent = t; }
function preparerEnLigne() {
  $("enligne-pseudo").value = profilJ.pseudo;
  $("enligne-serveur").value = reglages.serveur || adresseParDefaut();
  choix("enligne-carte", CARTES_JOUABLES.map((id) => [id, CARTES[id].nom]), reglages.carteEnLigne, (v) => { reglages.carteEnLigne = v; sauverReglages(); });
  afficherSalon();
}
function afficherSalon() {
  $("enligne-connexion").hidden = !!salon;
  $("enligne-salon").hidden = !salon;
  if (!salon) return;
  $("salon-code").textContent = salon.code;
  const ul = $("salon-joueurs");
  ul.innerHTML = "";
  for (const p of salon.joueurs) {
    const li = document.createElement("li");
    li.textContent = p.nom + (p.hote ? " (hôte)" : "") + (p.id === reseau.id ? " — toi" : "");
    ul.appendChild(li);
  }
  const hote = salon.joueurs.find((p) => p.hote);
  const suisHote = hote && hote.id === reseau.id;
  $("salon-lancer").hidden = !suisHote;
  statut(suisHote ? "Donne le code à tes amis puis lance la partie." : "En attente du lancement par l'hôte…");
}
async function connecter() {
  const url = $("enligne-serveur").value.trim();
  reglages.serveur = url === adresseParDefaut() ? "" : url;
  sauverReglages();
  const nom = $("enligne-pseudo").value.trim().slice(0, 16) || "Joueur";
  if (!(profilJ.compte && profilJ.compte.connecte)) { profilJ.d.pseudo = nom; profilJ.sauver(); }
  if (reseau.connecte) return nom;
  statut("Connexion au serveur…");
  await reseau.connecter(url);
  return nom;
}
$("enligne-creer").addEventListener("click", async () => {
  audio.demarrer(); musique.demarrer();
  try { const nom = await connecter(); reseau.envoyer({ t: "creer", nom, carte: reglages.carteEnLigne }); }
  catch (e) { statut(e.message + " Le serveur multijoueur doit être lancé (voir le guide)."); }
});
$("enligne-rejoindre").addEventListener("click", async () => {
  audio.demarrer(); musique.demarrer();
  const code = $("enligne-code").value.trim().toUpperCase();
  if (code.length !== 4) { statut("Le code fait 4 caractères."); return; }
  try { const nom = await connecter(); reseau.envoyer({ t: "rejoindre", code, nom }); }
  catch (e) { statut(e.message + " Le serveur multijoueur doit être lancé (voir le guide)."); }
});
$("salon-lancer").addEventListener("click", () => { audio.clic(); reseau.envoyer({ t: "lancer", carte: reglages.carteEnLigne }); });
$("salon-quitter").addEventListener("click", () => { audio.clic(); quitterEnLigne(); afficherSalon(); statut(""); });
function quitterEnLigne() {
  reseau.envoyer({ t: "quitter" });
  enLigne.arreter();
  reseau.fermer();
  salon = null;
}
reseau.on("salon", (m) => { reseau.id = m.id; salon = { code: m.code, joueurs: m.joueurs }; afficherSalon(); });
reseau.on("joueurs", (m) => { if (salon) { salon.joueurs = m.joueurs; afficherSalon(); } enLigne.majJoueurs(m.joueurs); });
reseau.on("erreur", (m) => statut(m.texte));
reseau.on("debut", async (m) => {
  $("texte-chargement").textContent = `Chargement de ${CARTES[m.carte] ? CARTES[m.carte].nom : "la carte"}…`;
  partie.etat = "chargement";
  afficherEcran("ecran-chargement");
  await attendreImage();
  chargerCarte(m.carte, "jour", "clair");
  afficherEcran(null);
  $("hud").classList.remove("cache");
  $("tactile").classList.toggle("cache", !controles.tactileActif);
  partie.etat = "jeu";
  partie.mode = "enligne";
  preparerJoueur();
  joueur.stats = nouvellesStats();
  joueur.kills = joueur.morts = 0;
  joueur.armure = 0;
  joueur.fumees = joueur.flashs = 0;
  regles.mode = "deathmatch";
  regles.chargementDM = regles.chargementDM || "fusil";
  enLigne.gagnant = null;
  enLigne.demarrer(m);
  musique.etat("combat");
  hud.annonce("EN LIGNE", `Premier à ${enLigne.objectif} éliminations`, "#ffd166", 2.4);
  verrouiller();
});
reseau.on("etat", (m) => enLigne.etat(m));
reseau.on("tir", (m) => enLigne.tir(m));
reseau.on("touche", (m) => enLigne.touche(m));
reseau.on("mort", (m) => enLigne.mort(m));
reseau.on("parti", (m) => enLigne.retirer(m.id));
reseau.on("fin", (m) => { enLigne.scores = m.scores; enLigne.gagnant = m.gagnant; if (partie.mode === "enligne" && (partie.etat === "jeu" || partie.etat === "pause")) jeu.finPartie(); });
reseau.on("ferme", () => {
  const enPartie = partie.mode === "enligne" && (partie.etat === "jeu" || partie.etat === "pause");
  salon = null;
  enLigne.arreter();
  if (enPartie) allerAuMenu();
  statut("Déconnecté du serveur.");
  afficherSalon();
});

// ===== Démarrage =====
partie.etat = "menu";
partie.mode = "menu";
afficherEcran("ecran-menu");
majBadge();
remplirCommandes();
hud.etiquettesTouches(etiquette);
requestAnimationFrame(boucle);
// Premier geste de l'utilisateur : on peut démarrer le son (règle des navigateurs)
addEventListener("pointerdown", () => { audio.demarrer(); musique.demarrer(); if (partie.etat === "menu") musique.etat("menu"); }, { once: true });
etatCompte().then((c) => { profilJ.compte = c; majBadge(); });
if (matchMedia("(pointer: coarse)").matches) controles.tactileActif = true;

// Accès pour les tests automatiques uniquement (adresse ...?test)
if (TEST) {
  window.__neon = {
    partie, joueur, bots, regles, competences, demarrerPartie, camera, controles, vue, effets, renderer, reglages, profil: profilJ, hud, jeu, qualite, dyn,
    carte: () => carte, chargerCarte, pause, allerAuMenu, enLigne, temps: () => temps,
    avancer(secondes) {
      for (let t = 0; t < secondes; t += PAS) {
        if (partie.etat !== "jeu") break;
        traiterActions();
        simuler(PAS);
        if (partie.etat === "jeu") { const c = majVisuels(PAS, 1); if (c.killcam) restaurerKillcam(); }
      }
    },
  };
}
