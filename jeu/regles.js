// Règles des modes de jeu : Spike (attaque/défense), Élimination, Deathmatch et Stand de tir.
// Manches, économie (crédits, achats), spike (pose, désamorçage, explosion), réapparitions, défis.
import * as THREE from "three";
import { ARMES } from "./armes.js";
import { NOMS } from "./bots.js";
import { PALETTES_BLEUES, PALETTES_ROUGES } from "./personnages.js";
import { CAPACITES } from "./competences.js";
import { nouvellesStats } from "./joueur.js";

export const MODES = {
  spike: { nom: "Spike", texte: "Attaque / défense : pose le spike sur un site ou désamorce-le. La 1re équipe à 5 manches gagne.", equipes: true, achat: true },
  elimination: { nom: "Élimination", texte: "Pas de spike : élimine toute l'équipe adverse. La 1re équipe à 5 manches gagne.", equipes: true, achat: true },
  deathmatch: { nom: "Deathmatch", texte: "Chacun pour soi, réapparition immédiate. Le premier à 30 éliminations gagne.", equipes: false, achat: false },
  stand: { nom: "Stand de tir", texte: "Entraînement et défis chronométrés pour améliorer ta visée.", equipes: false, achat: false },
};

export const DEFIS = {
  libre: { nom: "Entraînement libre", texte: "Cibles fixes et mobiles à volonté. Change d'arme avec B." },
  reflexes: { nom: "Réflexes", texte: "Élimine 30 cibles le plus vite possible.", cibles: 30, score: "temps" },
  mobiles: { nom: "Cibles mobiles", texte: "60 secondes pour éliminer un maximum de cibles qui se déplacent.", duree: 60, score: "nombre" },
  tetes: { nom: "Que des têtes", texte: "60 secondes : seules les balles dans la tête comptent.", duree: 60, score: "nombre", tete: true },
  sniper: { nom: "Longue distance", texte: "12 cibles entre 22 et 40 m avec l'Aiguille, le plus vite possible.", cibles: 12, score: "temps", arme: "sniper" },
};

export const ARTICLES = {
  pompe: { nom: "Briseur", type: "arme", prix: 1800 },
  fusil: { nom: "NS-7 Vecteur", type: "arme", prix: 2900 },
  pulsar: { nom: "Pulsar P-07", type: "arme", prix: 3100 },
  sniper: { nom: "Aiguille", type: "arme", prix: 4700 },
  pistolet: { nom: "Sentinelle", type: "arme", prix: 0 },
  armure25: { nom: "Bouclier léger", type: "armure", valeur: 25, prix: 400 },
  armure50: { nom: "Bouclier lourd", type: "armure", valeur: 50, prix: 1000 },
  fumee: { nom: "Fumée", type: "capacite", prix: CAPACITES.fumee.prix, max: 2 },
  flash: { nom: "Flash", type: "capacite", prix: CAPACITES.flash.prix, max: 2 },
};

const MANCHES_GAGNANTES = 5;
const MANCHE_CHANGEMENT = 4;
const DUREE_ACHAT = 14;
const DUREE_MANCHE = 100;
const DUREE_SPIKE = 45;
const DUREE_POSE = 4;
const DUREE_DESAMORCAGE = 7;
const CREDITS_MAX = 9000;
const OBJECTIF_DM = 30;
const DUREE_DM = 480;
const alea = (a, b) => a + Math.random() * (b - a);

export class Regles {
  constructor(jeu) {
    this.jeu = jeu;
    this.mode = "spike";
    this.phase = "preparation";
    this.phaseT = 0;
    this.chrono = 0;
    this.manche = 0;
    this.scores = { bleu: 0, rouge: 0 };
    this.campJoueur = "attaque";
    this.spike = null;
    this.modeleSpike = null;
    this.reapparitions = [];
    this.munitions = [];
    this.defi = null;
    this.fini = false;
  }

  get joueur() { return this.jeu.joueur; }
  get bots() { return this.jeu.bots; }
  get carte() { return this.jeu.carte; }
  get equipes() { return MODES[this.mode].equipes; }

  // ----- Démarrage d'une partie -----
  demarrer(config) {
    const jeu = this.jeu, bots = this.bots, joueur = this.joueur;
    this.config = config;
    this.mode = config.mode;
    this.fini = false;
    this.manche = 0;
    this.scores = { bleu: 0, rouge: 0 };
    this.serieDefaites = { bleu: 0, rouge: 0 };
    this.reapparitions = [];
    this.historique = [];
    this.chronoDM = DUREE_DM;
    bots.vider();
    this.retirerMunitions();
    bots.mode = this.mode;
    bots.diff = jeu.difficulte;
    this.retirerSpike();
    joueur.stats = this.nouvellesStatsJoueur();
    joueur.kills = joueur.morts = joueur.degats = 0;
    joueur.credits = 800;
    joueur.ultime = 0;
    joueur.equipe = "bleu";
    joueur.equipementDeBase();
    joueur.fumees = joueur.flashs = 0;
    const noms = [...NOMS].sort(() => Math.random() - 0.5);

    if (this.mode === "spike" || this.mode === "elimination") {
      this.campJoueur = Math.random() < 0.5 ? "attaque" : "defense";
      bots.camps = { bleu: this.campJoueur, rouge: this.campJoueur === "attaque" ? "defense" : "attaque" };
      const allies = config.allies === false ? 0 : 4;
      for (let i = 0; i < allies; i++) bots.ajouter({ nom: noms.pop(), equipe: "bleu", palette: PALETTES_BLEUES[i % 3], arme: "pistolet" });
      for (let i = 0; i < 5; i++) bots.ajouter({ nom: noms.pop(), equipe: "rouge", palette: PALETTES_ROUGES[i % 3], arme: "pistolet" });
      for (const b of bots.liste) { b.credits = 800; b.armePrincipale = null; }
      this.nouvelleManche();
    } else if (this.mode === "deathmatch") {
      bots.camps = {};
      const palettes = [7, 8, 9, 10, 11, 0, 4];
      for (let i = 0; i < 7; i++) bots.ajouter({ nom: noms.pop(), equipe: "dm" + i, palette: palettes[i], arme: this.armeAleatoire() });
      joueur.equipe = "dmj";
      this.chargementDM = this.chargementDM || "fusil";
      this.phase = "combat";
      this.chrono = DUREE_DM;
      bots.nouvelleManche("combat");
      const p = this.pointReapparition(joueur);
      joueur.donnerArme(this.chargementDM, false);
      joueur.placer(p.x, p.z, this.lacetVersCentre(p));
      for (const b of bots.liste) { const q = this.pointReapparition(b); bots.placer(b, q.x, q.z, this.lacetVersCentre(q) + Math.PI); }
      this.creerMunitions();
      this.carte.barriere.activer(false);
      jeu.hud.annonce("DEATHMATCH", `Premier à ${OBJECTIF_DM} éliminations`, "#ffd166", 2.6);
      jeu.audio.annonce("debut");
      jeu.audio.parler("Deathmatch. Premier à trente éliminations.");
      jeu.musique.etat("combat");
    } else if (this.mode === "stand") {
      bots.camps = {};
      joueur.equipe = "joueur";
      this.phase = "combat";
      this.chrono = 0;
      this.defi = { id: config.defi || "libre", etat: "compte", t: 3, score: 0, cibles: 0, ecoule: 0 };
      const def = DEFIS[this.defi.id];
      joueur.donnerArme(def.arme || this.chargementStand || "fusil", false);
      const d = this.carte.departJoueur("attaque");
      joueur.placer(d.x, d.z, 0);
      this.carte.barriere.activer(false);
      jeu.hud.annonce(def.nom.toUpperCase(), def.texte, "#7cc4ff", 3);
      if (this.defi.id === "libre") { this.defi.etat = "actif"; this.remplirStand(); }
      jeu.musique.etat("calme");
    }
  }

  nouvellesStatsJoueur() { return nouvellesStats(); }

  armeAleatoire() {
    const r = Math.random();
    return r < 0.35 ? "fusil" : r < 0.58 ? "pulsar" : r < 0.73 ? "pompe" : r < 0.87 ? "sniper" : "pistolet";
  }

  // ----- Manches (Spike / Élimination) -----
  nouvelleManche() {
    const jeu = this.jeu, bots = this.bots, joueur = this.joueur, carte = this.carte;
    this.manche++;
    if (this.manche === MANCHE_CHANGEMENT + 1) {
      // Changement de camp : économie remise à zéro
      this.campJoueur = this.campJoueur === "attaque" ? "defense" : "attaque";
      bots.camps = { bleu: this.campJoueur, rouge: this.campJoueur === "attaque" ? "defense" : "attaque" };
      joueur.equipementDeBase();
      joueur.fumees = joueur.flashs = 0;
      joueur.credits = 800;
      for (const b of bots.liste) { b.credits = 800; b.armePrincipale = null; b.armure = 0; b.fumees = b.flashs = 0; b.survecu = false; }
      this.changementAnnonce = true;
    }
    const dernier = this.scores.bleu === MANCHES_GAGNANTES - 1 || this.scores.rouge === MANCHES_GAGNANTES - 1;
    this.phase = "preparation";
    this.phaseT = DUREE_ACHAT;
    this.compteur = Math.ceil(DUREE_ACHAT);
    this.chrono = DUREE_MANCHE;
    this.killsManche = 0;
    this.statsDebut = { kills: joueur.stats.kills, degats: joueur.stats.degats, credits: joueur.credits };
    this.degatsRecusManche = 0;
    this.premierSang = false;
    joueur.achatsManche = [];

    // Le joueur garde son arme s'il a survécu, sinon il repart au pistolet
    if (!joueur.vivant && this.manche > 1) { joueur.equipementDeBase(); }
    const zoneJ = this.campJoueur === "attaque" ? carte.zoneDepartAttaque : carte.zoneDepartBots;
    const pj = carte.pointDans(zoneJ);
    joueur.placer(pj.x, pj.z, this.campJoueur === "attaque" ? 0 : Math.PI);
    joueur.signatureT = 0;
    joueur.porteSpike = false;

    for (const b of bots.liste) {
      if (!b.survecu) { b.armePrincipale = null; b.armure = 0; }
      this.achatBot(b);
      const zone = bots.camps[b.equipe] === "attaque" ? carte.zoneDepartAttaque : carte.zoneDepartBots;
      const p = carte.pointDans(zone);
      bots.placer(b, p.x, p.z, bots.camps[b.equipe] === "attaque" ? Math.PI : 0);
    }
    bots.nouvelleManche("preparation");

    // Spike : porté par le joueur s'il attaque, sinon par un bot attaquant
    this.retirerSpike();
    if (this.mode === "spike") {
      this.spike = { etat: "porte", porteur: null, x: 0, z: 0, site: null, minuteur: DUREE_SPIKE, poseT: 0, desamorceT: 0, miChemin: false, bipT: 0 };
      bots.spike = this.spike;
      if (this.campJoueur === "attaque") { this.spike.porteur = joueur; joueur.porteSpike = true; }
      else {
        const attaquants = bots.liste.filter((b) => b.equipe === "rouge");
        this.spike.porteur = attaquants[Math.floor(Math.random() * attaquants.length)];
      }
      this.creerModeleSpike();
    } else { this.spike = null; bots.spike = null; }

    carte.barriere.activer(true);
    jeu.preparerManche();
    const camp = this.campJoueur === "attaque" ? "ATTAQUE" : "DÉFENSE";
    if (this.changementAnnonce) {
      this.changementAnnonce = false;
      jeu.hud.annonce("CHANGEMENT DE CAMP", `Tu passes en ${camp.toLowerCase()} · crédits remis à 800`, "#ffd166", 3.2);
      jeu.audio.parler("Changement de camp.");
    } else if (dernier) {
      jeu.hud.annonce(`MANCHE ${this.manche}`, "Balle de match !", "#ffd166", 2.6);
      jeu.audio.parler("Balle de match.");
    } else {
      jeu.hud.annonce(`MANCHE ${this.manche}`, `${camp} · Achète ton équipement (B)`, "#7cc4ff", 2.6);
    }
    jeu.audio.annonce("manche");
    jeu.musique.etat("achat");
  }

  // Achats des bots selon leurs crédits (manches pistolet, éco, achat complet)
  achatBot(b) {
    const pistolet = this.manche === 1 || this.manche === MANCHE_CHANGEMENT + 1;
    if (b.armePrincipale) { b.arme = b.armePrincipale; }
    else if (!pistolet && b.credits >= 3900) {
      const arme = b.credits >= 5700 && Math.random() < 0.22 ? "sniper" : Math.random() < 0.45 ? "pulsar" : "fusil";
      b.credits -= ARMES[arme].prix;
      b.arme = b.armePrincipale = arme;
    } else if (!pistolet && b.credits >= 2300) {
      const arme = b.credits >= 2900 && Math.random() < 0.6 ? "fusil" : "pompe";
      b.credits -= ARMES[arme].prix;
      b.arme = b.armePrincipale = arme;
    } else b.arme = "pistolet";
    if (b.armure < 50 && b.credits >= 1000 && b.armePrincipale) { b.credits -= 1000; b.armure = 50; }
    else if (b.armure < 25 && b.credits >= 400 && (pistolet ? Math.random() < 0.5 : true)) { b.credits -= 400; b.armure = 25; }
    b.fumees = 0; b.flashs = 0;
    if (b.credits >= 100 && Math.random() < 0.6) { b.credits -= 100; b.fumees = 1; }
    if (b.credits >= 200 && Math.random() < 0.6) { b.credits -= 200; b.flashs = 1; }
  }

  // ----- Boutique du joueur -----
  peutAcheter() {
    if (this.mode === "deathmatch" || this.mode === "stand") return true;
    return this.phase === "preparation" && this.joueur.vivant;
  }

  gratuit() { return this.mode === "deathmatch" || this.mode === "stand"; }

  acheter(cle) {
    const j = this.joueur, a = ARTICLES[cle];
    if (!a || !this.peutAcheter()) return false;
    const prix = this.gratuit() ? 0 : a.prix;
    // Un achat de cette manche peut être revendu (remboursé) en cliquant à nouveau
    const deja = j.achatsManche.find((x) => x.cle === cle);
    if (a.type === "arme") {
      if (j.possede(cle) && deja) { j.credits += deja.prix; j.achatsManche = j.achatsManche.filter((x) => x !== deja); j.retirerArme(cle); if (ARMES[cle].emplacement === 2) j.donnerArme("pistolet"); this.jeu.audio.achat(false); return true; }
      if (j.possede(cle)) { j.equiper(cle); return false; }
      if (j.credits < prix) { this.jeu.audio.refus(); return false; }
      const ancien = ARMES[cle].emplacement === 1 ? j.inventaire.principale : j.inventaire.secondaire;
      const ancienAchat = ancien && j.achatsManche.find((x) => x.cle === ancien);
      if (ancienAchat) { j.credits += ancienAchat.prix; j.achatsManche = j.achatsManche.filter((x) => x !== ancienAchat); }
      j.credits -= prix;
      j.donnerArme(cle);
      j.achatsManche.push({ cle, prix });
      if (this.mode === "deathmatch") this.chargementDM = cle;
      if (this.mode === "stand") this.chargementStand = cle;
      this.jeu.surAchat(cle);
    } else if (a.type === "armure") {
      if (deja) { j.credits += deja.prix; j.armure = deja.avant; j.achatsManche = j.achatsManche.filter((x) => x !== deja); this.jeu.audio.achat(false); return true; }
      if (j.armure >= a.valeur || j.credits < prix) { this.jeu.audio.refus(); return false; }
      const autre = j.achatsManche.find((x) => ARTICLES[x.cle].type === "armure");
      if (autre) { j.credits += autre.prix; j.armure = autre.avant; j.achatsManche = j.achatsManche.filter((x) => x !== autre); }
      j.achatsManche.push({ cle, prix, avant: j.armure });
      j.credits -= prix;
      j.armure = a.valeur;
    } else {
      const champ = cle === "fumee" ? "fumees" : "flashs";
      if (j[champ] >= a.max || j.credits < prix) { this.jeu.audio.refus(); return false; }
      j.credits -= prix;
      j[champ]++;
      j.achatsManche.push({ cle, prix });
    }
    this.jeu.audio.achat(true);
    return true;
  }

  // ----- Spike -----
  creerModeleSpike() {
    if (this.modeleSpike) return;
    const g = new THREE.Group();
    const corps = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.26, 12), new THREE.MeshStandardMaterial({ color: 0x2a2d35, metalness: 0.7, roughness: 0.35 }));
    corps.position.y = 0.13;
    const anneau = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 6, 20), new THREE.MeshStandardMaterial({ color: 0xff3a3a, emissive: 0xff2a2a, emissiveIntensity: 1.5 }));
    anneau.rotation.x = Math.PI / 2;
    anneau.position.y = 0.2;
    const pointe = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0xc8ccd4, metalness: 0.9, roughness: 0.25 }));
    pointe.position.y = 0.37;
    g.add(corps, anneau, pointe);
    const lumiere = new THREE.PointLight(0xff3030, 0, 5, 2);
    lumiere.position.y = 0.5;
    if (this.jeu.qualite !== "basse") g.add(lumiere);
    g.visible = false;
    this.jeu.scene.add(g);
    this.modeleSpike = { groupe: g, anneau, lumiere };
  }

  retirerSpike() {
    if (this.modeleSpike) { this.jeu.scene.remove(this.modeleSpike.groupe); this.modeleSpike = null; }
    if (this.joueur) this.joueur.porteSpike = false;
  }

  // Tout ce que les règles ont ajouté à la scène (retour au menu)
  nettoyer() {
    this.retirerSpike();
    this.retirerMunitions();
  }

  // ----- Caisses de munitions (deathmatch uniquement) -----
  creerMunitions() {
    this.retirerMunitions();
    const carte = this.carte, scene = this.jeu.scene;
    // Emplacements répartis sur la carte : postes, abords des sites, points de rassemblement
    const candidats = [...carte.postes, ...Object.values(carte.apresPose).flat(), ...Object.values(carte.rassemblement)].filter((p) => carte.nav.estLibre(p.x, p.z));
    const choisis = [];
    for (const p of candidats.sort(() => Math.random() - 0.5)) {
      if (choisis.every((c) => Math.hypot(c.x - p.x, c.z - p.z) > 9)) choisis.push(p);
      if (choisis.length >= 8) break;
    }
    if (!this.matsMunitions) {
      const c = document.createElement("canvas");
      c.width = 128; c.height = 64;
      const g = c.getContext("2d");
      g.fillStyle = "#4a5236"; g.fillRect(0, 0, 128, 64);
      g.fillStyle = "#ffd166"; g.fillRect(0, 24, 128, 16);
      g.fillStyle = "#2a2e20";
      for (let i = 0; i < 3; i++) { g.fillRect(44 + i * 14, 18, 8, 26); g.beginPath(); g.arc(48 + i * 14, 18, 4, Math.PI, 0); g.fill(); }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      this.matsMunitions = {
        caisse: new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.2 }),
        bande: new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffb020, emissiveIntensity: 0.9 }),
        faisceau: new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }),
        geo: new THREE.BoxGeometry(0.62, 0.36, 0.42),
        geoBande: new THREE.BoxGeometry(0.64, 0.05, 0.44),
        geoFaisceau: new THREE.CylinderGeometry(0.28, 0.28, 3.2, 12, 1, true),
      };
    }
    const M = this.matsMunitions;
    this.munitions = choisis.map((p) => {
      const groupe = new THREE.Group();
      const caisse = new THREE.Mesh(M.geo, M.caisse);
      const bande = new THREE.Mesh(M.geoBande, M.bande);
      bande.position.y = 0.06;
      const objet = new THREE.Group();
      objet.add(caisse, bande);
      objet.position.y = 0.45;
      const faisceau = new THREE.Mesh(M.geoFaisceau, M.faisceau);
      faisceau.position.y = 1.6;
      groupe.add(objet, faisceau);
      groupe.position.set(p.x, 0, p.z);
      scene.add(groupe);
      return { x: p.x, z: p.z, groupe, objet, attente: 0 };
    });
  }

  retirerMunitions() {
    for (const m of this.munitions || []) this.jeu.scene.remove(m.groupe);
    this.munitions = [];
  }

  majMunitions(dt) {
    const j = this.joueur;
    for (const m of this.munitions) {
      if (m.attente > 0) {
        m.attente -= dt;
        m.groupe.visible = m.attente <= 0;
        continue;
      }
      m.objet.rotation.y += dt * 1.4;
      m.objet.position.y = 0.45 + Math.sin(performance.now() / 400 + m.x) * 0.06;
      if (!j.vivant || Math.hypot(j.x - m.x, j.z - m.z) > 1.3 || j.y > 1.5) continue;
      const armes = Object.values(j.logiques);
      if (armes.every((l) => l.reserve >= l.def.reserve)) continue;
      for (const l of armes) l.reserve = l.def.reserve;
      m.attente = 18;
      m.groupe.visible = false;
      this.jeu.audio.ramassage();
      this.jeu.hud.fil("", "Munitions récupérées", false, "info");
    }
  }

  siteDe(x, z) {
    for (const [nom, s] of Object.entries(this.carte.sites)) if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ) return nom;
    return null;
  }

  lacherSpike(porteur) {
    const s = this.spike;
    s.etat = "sol";
    s.porteur = null;
    s.x = porteur.x;
    s.z = porteur.z;
    if (porteur === this.joueur) this.joueur.porteSpike = false;
    this.jeu.hud.fil("", "Spike lâché", false, "info");
  }

  planter(qui) {
    const s = this.spike, jeu = this.jeu;
    s.etat = "pose";
    s.porteur = null;
    s.x = qui.x; s.z = qui.z;
    s.site = this.siteDe(qui.x, qui.z) || "A";
    s.minuteur = DUREE_SPIKE;
    s.poseT = 0;
    s.bipT = 0;
    if (qui === this.joueur) { this.joueur.porteSpike = false; this.joueur.stats.poses++; this.joueur.gagnerUltime(1); this.joueur.credits = Math.min(CREDITS_MAX, this.joueur.credits + 300); }
    this.phase = "spike";
    this.chrono = DUREE_SPIKE;
    jeu.hud.annonce("SPIKE POSÉ", `Site ${s.site}`, "#ff4f5e", 2.4);
    jeu.audio.spikePose();
    jeu.audio.parler("Spike posé.");
    jeu.musique.etat("spike");
    this.bots.informer(this.bots.camps.rouge === "defense" ? "rouge" : "bleu", s.x, s.z);
    jeu.surEvenement("pose", qui);
  }

  majSpike(dt, cmd) {
    const s = this.spike, joueur = this.joueur, bots = this.bots, jeu = this.jeu;
    if (!s) return;
    const m = this.modeleSpike;
    joueur.verrou = false;
    jeu.progression = null;
    const enCombat = this.phase === "combat" || this.phase === "spike";
    const attaque = (c) => (c.estJoueur ? this.campJoueur : bots.camps[c.equipe]) === "attaque";

    if (s.etat === "porte" && s.porteur && !s.porteur.vivant) this.lacherSpike(s.porteur);
    if (s.etat === "sol" && enCombat) {
      // Ramassé en passant dessus (attaquants seulement)
      for (const c of bots.combattants()) {
        if (!c.vivant || !attaque(c) || Math.hypot(c.x - s.x, c.z - s.z) > 1.2) continue;
        s.etat = "porte"; s.porteur = c;
        if (c === joueur) { joueur.porteSpike = true; jeu.hud.annonce("SPIKE RAMASSÉ", "Pose-le sur un site (F)", "#ffd166", 1.6); }
        break;
      }
    }

    // Pose
    if (s.etat === "porte" && this.phase === "combat") {
      const p = s.porteur;
      if (p === joueur && joueur.vivant) {
        const site = this.siteDe(joueur.x, joueur.z);
        joueur.dansSite = site;
        if (cmd.interagir && site && joueur.auSol) {
          s.poseT += dt;
          joueur.verrou = true;
          jeu.progression = { texte: "POSE DU SPIKE", k: s.poseT / DUREE_POSE };
          if (s.poseT >= DUREE_POSE) this.planter(joueur);
        } else s.poseT = 0;
      } else if (p && !p.estJoueur) {
        if (p.etat === "pose" && this.siteDe(p.x, p.z)) {
          s.poseT += dt;
          if (s.poseT >= DUREE_POSE) this.planter(p);
        } else s.poseT = 0;
      }
    }

    // Désamorçage (progression gardée à mi-chemin)
    if (s.etat === "pose" && this.phase === "spike") {
      let desamorceur = null;
      if (joueur.vivant && !attaque(joueur) && cmd.interagir && Math.hypot(joueur.x - s.x, joueur.z - s.z) < 1.6 && joueur.auSol) { desamorceur = joueur; joueur.verrou = true; }
      if (!desamorceur) for (const b of bots.liste) if (b.vivant && b.etat === "desamorce" && Math.hypot(b.x - s.x, b.z - s.z) < 1.6) { desamorceur = b; break; }
      if (desamorceur) {
        if (!s.desamorceurPrecedent) jeu.audio.spikeDesamorce(false);
        s.desamorceT += dt;
        if (s.desamorceT >= DUREE_DESAMORCAGE / 2) s.miChemin = true;
        if (desamorceur === joueur) jeu.progression = { texte: "DÉSAMORÇAGE", k: s.desamorceT / DUREE_DESAMORCAGE, mi: true };
        if (s.desamorceT >= DUREE_DESAMORCAGE) {
          s.etat = "desamorce";
          if (desamorceur === joueur) { joueur.stats.desamorcages++; joueur.gagnerUltime(1); }
          jeu.audio.spikeDesamorce(true);
          jeu.audio.parler("Spike désamorcé.");
          jeu.surEvenement("desamorce", desamorceur);
          this.finManche(desamorceur.equipe, "SPIKE DÉSAMORCÉ");
        }
      } else s.desamorceT = s.miChemin ? DUREE_DESAMORCAGE / 2 : 0;
      s.desamorceurPrecedent = desamorceur;

      s.minuteur -= dt;
      this.chrono = s.minuteur;
      // Bips de plus en plus rapides
      s.bipT -= dt;
      const intervalle = s.minuteur > 20 ? 1 : s.minuteur > 10 ? 0.5 : s.minuteur > 5 ? 0.25 : 0.12;
      if (s.bipT <= 0) { s.bipT = intervalle; jeu.audio.spikeBip({ x: s.x, y: 0.3, z: s.z }, s.minuteur < 10); if (m) m.lumiere.intensity = 6; }
      if (s.minuteur <= 0 && s.etat === "pose") this.explosion();
    }

    // Visuel
    if (m) {
      const visible = s.etat === "sol" || s.etat === "pose" || s.etat === "desamorce";
      m.groupe.visible = visible;
      if (visible) {
        m.groupe.position.set(s.x, 0, s.z);
        m.anneau.material.emissiveIntensity = s.etat === "pose" ? 0.6 + (m.lumiere.intensity / 6) * 2.5 : s.etat === "desamorce" ? 0.05 : 0.8;
        m.lumiere.intensity *= Math.exp(-10 * dt);
        m.groupe.rotation.y += dt * (s.etat === "sol" ? 1.5 : 0);
      }
    }
  }

  explosion() {
    const s = this.spike, jeu = this.jeu;
    s.etat = "explose";
    jeu.effets.explosion({ x: s.x, y: 0.5, z: s.z });
    jeu.audio.explosion({ x: s.x, y: 0.5, z: s.z });
    for (const c of this.bots.combattants()) {
      if (!c.vivant) continue;
      const d = Math.hypot(c.x - s.x, c.z - s.z);
      if (d < 14) jeu.infliger(c, 400, null, false, "spike");
    }
    const vainqueur = this.campJoueur === "attaque" ? "bleu" : "rouge";
    this.finManche(vainqueur, "LE SPIKE A EXPLOSÉ");
  }

  // ----- Morts -----
  surMort(victime, tueur, tete, arme) {
    const jeu = this.jeu, joueur = this.joueur, bots = this.bots;
    if (this.mode === "stand") return this.surMortStand(victime, tueur, tete);
    if (this.spike && this.spike.porteur === victime) this.lacherSpike(victime);
    if (tueur && tueur !== victime) {
      tueur.kills = (tueur.kills || 0) + 1;
      if (this.equipes) tueur.credits = Math.min(CREDITS_MAX, (tueur.credits || 0) + 200);
      if (tueur === joueur) {
        joueur.gagnerUltime(1);
        this.killsManche++;
      }
    }
    if (victime === joueur) { joueur.gagnerUltime(1); }
    else victime.survecu = false;
    if (!this.premierSang && tueur) { this.premierSang = true; jeu.surEvenement("premierSang", tueur); }

    if (this.mode === "deathmatch") {
      this.reapparitions.push({ c: victime, t: 3 });
      if (tueur && tueur.kills >= OBJECTIF_DM) this.finDeathmatch();
      return;
    }
    this.verifierFinManche();
    // Dernier survivant de ton équipe
    if (joueur.vivant && this.equipes && this.phase !== "fin") {
      const allies = bots.vivants("bleu").length;
      const ennemis = bots.vivants("rouge").length;
      if (allies === 0 && victime.equipe === "bleu" && ennemis > 0 && bots.liste.some((b) => b.equipe === "bleu")) {
        jeu.hud.annonce("DERNIER EN VIE", `1 contre ${ennemis}`, "#ffd166", 2);
        jeu.audio.parler(ennemis > 1 ? `Dernier survivant. Un contre ${ennemis}.` : "Dernier survivant.");
        this.clutch = ennemis;
        jeu.musique.etat("tension");
      }
    }
  }

  vivantsCamp(camp) {
    const equipe = this.campJoueur === camp ? "bleu" : "rouge";
    let n = this.bots.vivants(equipe).length;
    if (equipe === "bleu" && this.joueur.vivant) n++;
    return n;
  }

  verifierFinManche() {
    if (this.phase !== "combat" && this.phase !== "spike") return;
    const att = this.vivantsCamp("attaque"), def = this.vivantsCamp("defense");
    const equipeAtt = this.campJoueur === "attaque" ? "bleu" : "rouge";
    const equipeDef = equipeAtt === "bleu" ? "rouge" : "bleu";
    if (def === 0) this.finManche(equipeAtt, "ÉQUIPE ADVERSE ÉLIMINÉE");
    else if (att === 0 && !(this.spike && this.spike.etat === "pose")) this.finManche(equipeDef, "ATTAQUANTS ÉLIMINÉS");
  }

  finManche(gagnante, raison) {
    if (this.phase === "fin") return;
    const jeu = this.jeu, joueur = this.joueur, bots = this.bots;
    this.phase = "fin";
    this.phaseT = 5.5;
    this.scores[gagnante]++;
    const gagnee = gagnante === "bleu";
    const perdante = gagnante === "bleu" ? "rouge" : "bleu";
    this.serieDefaites[gagnante] = 0;
    this.serieDefaites[perdante]++;
    const bonusDefaite = 1900 + 500 * Math.min(2, this.serieDefaites[perdante] - 1);
    const poseBonus = this.spike && (this.spike.etat === "pose" || this.spike.etat === "explose" || this.spike.etat === "desamorce");
    const equipeAtt = this.campJoueur === "attaque" ? "bleu" : "rouge";
    const gain = (equipe) => (equipe === gagnante ? 3000 : bonusDefaite) + (poseBonus && equipe === equipeAtt ? 300 : 0);
    joueur.credits = Math.min(CREDITS_MAX, joueur.credits + gain("bleu"));
    for (const b of bots.liste) { b.credits = Math.min(CREDITS_MAX, b.credits + gain(b.equipe)); b.survecu = b.vivant; }
    if (gagnee) joueur.stats.manchesGagnees++;
    const ace = this.killsManche >= 5;
    if (ace) joueur.stats.aces++;
    if (gagnee && this.clutch && joueur.vivant) { joueur.stats.clutchs++; jeu.surEvenement("clutch", this.clutch); }
    this.clutch = 0;
    this.historique.push(gagnante);
    const recap = {
      gagnee, raison, manche: this.manche, scores: { ...this.scores },
      kills: joueur.stats.kills - this.statsDebut.kills,
      degats: Math.round(joueur.stats.degats - this.statsDebut.degats),
      recus: Math.round(this.degatsRecusManche),
      credits: joueur.credits - this.statsDebut.credits + joueur.achatsManche.reduce((s, a) => s + a.prix, 0),
      total: joueur.credits,
      mvp: this.mvpManche(),
      survie: joueur.vivant,
    };
    jeu.finManche(recap, ace);
  }

  mvpManche() {
    const candidats = [{ nom: this.joueur.nom, kills: this.killsManche, joueur: true }];
    return candidats[0].kills > 0 ? candidats[0] : null;
  }

  finDeathmatch() {
    if (this.fini) return;
    this.fini = true;
    this.phase = "finPartie";
    this.jeu.finPartie();
  }

  // Orientation (convention du joueur) pour regarder vers le centre de la carte
  lacetVersCentre(p) {
    const L = this.carte.limites;
    return Math.atan2(-((L.minX + L.maxX) / 2 - p.x), -((L.minZ + L.maxZ) / 2 - p.z));
  }

  pointReapparition(c) {
    const L = this.carte.limites;
    let meilleur = null, score = -1;
    for (let k = 0; k < 16; k++) {
      const p = this.carte.nav.aleatoire(Math.random, { minX: L.minX + 1.5, maxX: L.maxX - 1.5, minZ: L.minZ + 1.5, maxZ: L.maxZ - 1.5 });
      if (!p) continue;
      let dMin = 99;
      for (const e of this.bots.combattants()) if (e !== c && e.vivant) dMin = Math.min(dMin, Math.hypot(e.x - p.x, e.z - p.z));
      if (dMin > score) { score = dMin; meilleur = p; }
    }
    return meilleur || this.carte.pointDans(this.carte.zoneDepartBots);
  }

  // ----- Stand de tir -----
  remplirStand() {
    const bots = this.bots;
    const d = this.defi;
    const voulu = d.id === "libre" ? 6 : d.id === "reflexes" || d.id === "sniper" ? 1 : 3;
    while (bots.liste.filter((b) => b.vivant).length < voulu) this.ajouterCible();
  }

  ajouterCible() {
    const bots = this.bots, d = this.defi;
    const mobile = d.id === "mobiles" || (d.id === "libre" && Math.random() < 0.4);
    const loin = d.id === "sniper";
    const z = loin ? alea(-40, -22) : alea(-30, -9);
    const x = alea(-8.5, 8.5);
    let b = bots.liste.find((c) => !c.vivant && c.mortT > 0.8);
    if (!b) b = bots.ajouter({ nom: "Cible", equipe: "cible", palette: 6, arme: "pistolet", mannequin: true, type: "avantgarde" });
    bots.placer(b, x, z, 0);
    b.mannequin = true;
    b.etat = "mannequin";
    b.mannequinOrigine = { x, z };
    b.mannequinAmp = mobile ? alea(1.5, 3.5) : 0;
    b.mannequinVitesse = alea(1.2, 2.2);
    b.mannequinPhase = Math.random() * 6;
    b.vie = 100;
    b.armure = 0;
  }

  surMortStand(victime, tueur, tete) {
    const d = this.defi;
    if (!d || d.etat !== "actif") return;
    d.cibles++;
    const def = DEFIS[d.id];
    if (def.cibles && d.cibles >= def.cibles) { this.finDefi(); return; }
    d.remplirT = d.id === "libre" ? 0.9 : 0.12;
  }

  finDefi() {
    const d = this.defi, def = DEFIS[d.id];
    d.etat = "fini";
    d.score = def.score === "temps" ? Math.round(d.ecoule * 100) / 100 : d.cibles;
    for (const b of this.bots.liste) if (b.vivant) { b.vivant = false; b.modele.racine.visible = false; }
    this.fini = true;
    this.phase = "finPartie";
    this.jeu.finPartie();
  }

  // ----- Boucle (pas fixe) -----
  maj(dt, cmd) {
    const jeu = this.jeu;
    if (this.mode === "stand") {
      const d = this.defi;
      if (d.etat === "compte") {
        const avant = Math.ceil(d.t);
        d.t -= dt;
        if (Math.ceil(d.t) < avant && d.t > 0) { jeu.hud.annonce(String(Math.ceil(d.t)), "", "#e9f1ff", 0.8); jeu.audio.annonce("compte"); }
        if (d.t <= 0) { d.etat = "actif"; jeu.hud.annonce("GO !", "", "#7cffd4", 0.8); jeu.audio.annonce("debut"); this.remplirStand(); }
      } else if (d.etat === "actif") {
        d.ecoule += dt;
        if (d.remplirT > 0) { d.remplirT -= dt; if (d.remplirT <= 0) this.remplirStand(); }
        const def = DEFIS[d.id];
        this.chrono = def.duree ? Math.max(0, def.duree - d.ecoule) : d.ecoule;
        if (def.duree && d.ecoule >= def.duree) this.finDefi();
      }
      // Munitions infinies au stand
      for (const l of Object.values(this.joueur.logiques)) if (l.reserve < 50) l.reserve = 999;
      return;
    }

    if (this.mode === "deathmatch") {
      this.chrono -= dt;
      this.majMunitions(dt);
      for (const r of this.reapparitions) {
        r.t -= dt;
        if (r.t > 0) continue;
        const p = this.pointReapparition(r.c);
        if (r.c === this.joueur) {
          this.joueur.equipementDeBase();
          this.joueur.donnerArme(this.chargementDM, false);
          this.joueur.placer(p.x, p.z, this.lacetVersCentre(p));
          jeu.surReapparition();
        } else {
          r.c.arme = this.armeAleatoire();
          this.bots.placer(r.c, p.x, p.z, this.lacetVersCentre(p) + Math.PI);
        }
        r.fait = true;
      }
      this.reapparitions = this.reapparitions.filter((r) => !r.fait);
      if (this.chrono <= 0) this.finDeathmatch();
      return;
    }

    // Spike / élimination
    if (this.phase === "preparation") {
      this.phaseT -= dt;
      const reste = Math.ceil(this.phaseT);
      if (reste < this.compteur && reste <= 3 && reste > 0) { jeu.audio.annonce("compte"); jeu.hud.annonce(String(reste), "", "#e9f1ff", 0.8); }
      this.compteur = reste;
      if (this.phaseT <= 0) {
        this.phase = "combat";
        this.carte.barriere.activer(false);
        const camp = this.campJoueur === "attaque";
        const sous = this.mode === "spike" ? (camp ? "Pose le spike sur A ou B" : "Défends les sites A et B") : "Élimine l'équipe adverse";
        jeu.hud.annonce("COMBAT", sous, "#7cffd4", 1.6);
        jeu.audio.annonce("debut");
        jeu.musique.etat("combat");
        this.bots.phase = "combat";
      }
    } else if (this.phase === "combat") {
      this.chrono -= dt;
      if (this.chrono <= 0) {
        const equipeDef = this.campJoueur === "defense" ? "bleu" : "rouge";
        this.finManche(equipeDef, "TEMPS ÉCOULÉ");
      }
    } else if (this.phase === "fin") {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        if (this.scores.bleu >= MANCHES_GAGNANTES || this.scores.rouge >= MANCHES_GAGNANTES) { this.fini = true; this.phase = "finPartie"; jeu.finPartie(); }
        else this.nouvelleManche();
        return;
      }
    }
    if (this.spike) this.majSpike(dt, cmd);
    else { this.joueur.verrou = false; jeu.progression = null; }
  }

  // Résumé pour l'interface
  resume() {
    return {
      mode: this.mode, phase: this.phase, chrono: this.phase === "preparation" ? this.phaseT : this.chrono, manche: this.manche,
      scores: this.scores, campJoueur: this.campJoueur, spike: this.spike, defi: this.defi,
    };
  }
}

export { MANCHES_GAGNANTES, DUREE_SPIKE, OBJECTIF_DM };
