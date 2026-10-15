// Multijoueur en ligne : connexion WebSocket au serveur Node.js (jeu/serveur/serveur.js),
// salons à code et deathmatch entre amis. Les autres joueurs sont affichés comme des personnages
// "distants" dont la position est lissée entre deux messages.
import { HEROS } from "./heros.js";
import { ARMES } from "./armes.js";

export class Reseau {
  constructor() {
    this.ws = null;
    this.http = null;       // relais PHP du site (quand le serveur WebSocket n'est pas lancé)
    this.ecouteurs = new Map();
    this.id = null;
  }

  get connecte() { return (!!this.ws && this.ws.readyState === 1) || (!!this.http && this.http.actif); }

  on(type, fn) { this.ecouteurs.set(type, fn); }

  distribuer(m) {
    const f = m && this.ecouteurs.get(m.t);
    if (f) f(m);
  }

  // WebSocket d'abord ; sur le site, si le serveur temps réel ne répond pas, relais PHP (jeu/enligne.php)
  async connecter(url, repliSite = false) {
    try {
      await this.connecterWs(url, repliSite ? 3500 : 6000);
    } catch (e) {
      if (!repliSite) throw e;
      this.http = new RelaisHttp(this);
    }
  }

  connecterWs(url, delai) {
    return new Promise((ok, ko) => {
      let ws;
      try { ws = new WebSocket(url); } catch (e) { ko(new Error("Adresse du serveur invalide.")); return; }
      const minuterie = setTimeout(() => { try { ws.close(); } catch (e) { /* déjà fermé */ } ko(new Error("Le serveur ne répond pas.")); }, delai);
      ws.onopen = () => { clearTimeout(minuterie); this.ws = ws; ok(); };
      ws.onerror = () => { clearTimeout(minuterie); ko(new Error("Connexion impossible au serveur.")); };
      ws.onclose = () => {
        if (this.ws === ws) { this.ws = null; this.distribuer({ t: "ferme" }); }
      };
      ws.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch (err) { return; }
        this.distribuer(m);
      };
    });
  }

  envoyer(objet) {
    if (this.http && this.http.actif) this.http.envoyer(objet);
    else if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(objet));
  }

  fermer() {
    if (this.ws) { const ws = this.ws; this.ws = null; try { ws.close(); } catch (e) { /* déjà fermé */ } }
    if (this.http) { this.http.arreter(); this.http = null; }
  }
}

// Version du protocole (messages horodatés pour l'anti-triche du serveur)
export const VERSION_PROTOCOLE = 3;

// Relais par requêtes HTTP vers jeu/enligne.php : ~16 échanges par seconde en partie, 2 par seconde dans le salon.
// Les messages reçus sont exactement ceux du serveur WebSocket.
class RelaisHttp {
  constructor(reseau) {
    this.reseau = reseau;
    this.actif = true;
    this.code = null;
    this.id = null;
    this.jeton = null;
    this.file = [];
    this.etat = null;        // seule la dernière position compte
    this.enJeu = false;
    this.echecs = 0;
    this.boucleLancee = false;
  }

  async requete(corps) {
    const r = await fetch(new URL("enligne.php", location.href), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Requested-With": "neonstrike" },
      body: JSON.stringify(corps),
      cache: "no-store",
    });
    if (!r.ok && r.status !== 503) throw new Error("HTTP " + r.status);
    return r.json();
  }

  recevoir(liste) {
    for (const m of liste || []) {
      if (m.t === "debut") this.enJeu = true;
      else if (m.t === "fin") this.enJeu = false;
      this.reseau.distribuer(m);
    }
  }

  envoyer(m) {
    if (!this.actif) return;
    if (m.t === "creer" || m.t === "rejoindre") { this.entrer(m); return; }
    if (!this.code) return;
    if (m.t === "etat") { this.etat = m; return; }
    this.file.push(m);
    if (m.t === "quitter") this.arreter(true);
  }

  async entrer(m) {
    if (this.code) {
      // Changement de salon : on quitte proprement l'ancien
      this.requete({ action: "echange", code: this.code, id: this.id, jeton: this.jeton, envois: [{ t: "quitter" }] }).catch(() => {});
      this.code = null;
      this.file = [];
      this.etat = null;
      this.enJeu = false;
    }
    try {
      const r = await this.requete({ action: m.t, v: VERSION_PROTOCOLE, nom: m.nom, carte: m.carte, heros: m.heros, code: m.code });
      if (r.erreur) { this.reseau.distribuer({ t: "erreur", texte: r.erreur }); return; }
      this.code = r.code;
      this.id = r.id;
      this.jeton = r.jeton;
      this.recevoir(r.messages);
      if (!this.boucleLancee) { this.boucleLancee = true; this.boucle(); }
    } catch (e) {
      this.reseau.distribuer({ t: "erreur", texte: "Le site ne répond pas, réessaie dans un instant." });
    }
  }

  async boucle() {
    while (this.actif) {
      const debut = performance.now();
      if (!this.code) { await new Promise((ok) => setTimeout(ok, 200)); continue; }
      const envois = this.file.splice(0, 60);
      if (this.etat) { envois.push(this.etat); this.etat = null; }
      try {
        const r = await this.requete({ action: "echange", code: this.code, id: this.id, jeton: this.jeton, envois });
        if (!this.actif) return;
        this.echecs = 0;
        if (r.ferme) { if (r.exclu) this.reseau.distribuer({ t: "exclu", raison: r.exclu }); this.couper(); return; }
        for (const e of r.etats || []) this.reseau.distribuer(e);
        this.recevoir(r.messages);
      } catch (e) {
        if (!this.actif) return;
        // On renvoie les messages perdus (sauf la position, remplacée par la suivante)
        this.file.unshift(...envois.filter((x) => x.t !== "etat"));
        if (++this.echecs >= 12) { this.couper(); return; }
      }
      const pause = (this.enJeu ? 60 : 500) - (performance.now() - debut);
      if (pause > 0) await new Promise((ok) => setTimeout(ok, pause));
    }
  }

  // Dernier envoi (quitter) puis arrêt
  arreter(avecEnvoi = false) {
    if (!this.actif) return;
    this.actif = false;
    if (avecEnvoi && this.code) {
      this.requete({ action: "echange", code: this.code, id: this.id, jeton: this.jeton, envois: this.file.splice(0) }).catch(() => {});
    }
  }

  couper() {
    this.actif = false;
    if (this.reseau.http === this) { this.reseau.http = null; this.reseau.distribuer({ t: "ferme" }); }
  }
}

// Adresse par défaut : le même site, chemin /ws (à configurer sur l'hébergeur)
export function adresseParDefaut() {
  if (location.protocol === "file:") return "ws://localhost:8080/ws";
  return (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws";
}

// Partie en ligne. Modes : "ffa" (chacun pour soi), "equipes" (bleus contre rouges), "coop" (les joueurs contre les bots).
// Les bots tournent chez l'hôte (intelligence, tirs, réapparitions) ; il envoie leurs positions 10 fois par seconde
// et les autres joueurs les affichent comme des joueurs distants. Un tir sur un bot est transmis à l'hôte par le serveur.
const DUREE_REAPPARITION = 3;

export class PartieEnLigne {
  constructor(jeu, reseau) {
    this.jeu = jeu;
    this.reseau = reseau;
    this.distants = new Map();
    this.scores = {};
    this.scoresEquipes = { bleu: 0, rouge: 0 };
    this.objectif = 20;
    this.mode = "ffa";
    this.hote = false;
    this.envoiT = 0;
    this.botsT = 0;
    this.reapparitionT = -1;
    this.reapBots = [];
    this.actif = false;
  }

  get moi() { return this.reseau.id; }
  get enEquipes() { return this.mode !== "ffa"; }

  // Bot que je fais tourner (hôte)
  botLocal(id) { return this.jeu.bots.liste.find((b) => b.botLocal && b.id === id) || null; }

  // Identifiant réseau d'un combattant (moi, un joueur distant, un de mes bots)
  idDe(c) {
    if (!c) return null;
    if (c === this.jeu.joueur) return this.moi;
    if (c.distantId) return c.distantId;
    if (c.botLocal) return c.id;
    return null;
  }

  nom(id) {
    if (id === this.moi) return this.jeu.joueur.nom;
    const b = this.distants.get(id) || this.botLocal(id);
    return b ? b.nom : "?";
  }

  equipeReseau(id, equipe) { return this.enEquipes ? (equipe === "rouge" ? "rouge" : "bleu") : "net-" + id; }

  demarrer(m) {
    const jeu = this.jeu;
    this.actif = true;
    this.mode = ["ffa", "equipes", "coop"].includes(m.mode) ? m.mode : "ffa";
    this.objectif = m.objectif || 20;
    this.scores = m.scores || {};
    this.scoresEquipes = m.equipes || { bleu: 0, rouge: 0 };
    this.hote = m.hote === this.moi;
    this.distants.clear();
    this.reapBots = [];
    jeu.bots.vider();
    jeu.bots.mode = "deathmatch";
    jeu.bots.equipes = this.enEquipes;
    const moi = (m.joueurs || []).find((p) => p.id === this.moi);
    jeu.joueur.equipe = this.equipeReseau(this.moi, moi && moi.equipe);
    for (const p of m.joueurs || []) if (p.id !== this.moi) this.ajouter(p);
    if (this.hote) this.creerBots(m);
    this.reapparaitre();
  }

  // Hôte : crée les bots demandés (équipes équilibrées, rouges en coop), sans capacités (non autorisées en ligne)
  creerBots(m) {
    const jeu = this.jeu, n = Math.max(0, Math.min(10, m.bots | 0));
    const effectifs = { bleu: 0, rouge: 0 };
    for (const p of m.joueurs || []) effectifs[p.equipe === "rouge" ? "rouge" : "bleu"]++;
    const pris = new Set((m.joueurs || []).map((p) => p.heros));
    const heros = Object.keys(HEROS).filter((h) => !pris.has(h)).sort(() => Math.random() - 0.5);
    for (let i = 0; i < n; i++) {
      let equipe = "dm" + i;
      if (this.mode === "coop") equipe = "rouge";
      else if (this.mode === "equipes") { equipe = effectifs.bleu <= effectifs.rouge ? "bleu" : "rouge"; effectifs[equipe]++; }
      const h = heros[i % heros.length];
      const b = jeu.bots.ajouter({ nom: HEROS[h].nom, heros: h, equipe, teinte: this.enEquipes ? equipe : "neutre", arme: jeu.regles.armeHeros(h), economie: false });
      b.capacites = null;
      b.botLocal = true;
      this.placerBot(b);
    }
  }

  placerBot(b) {
    const jeu = this.jeu;
    const p = jeu.regles.pointReapparition(b);
    b.arme = jeu.regles.armeHeros(b.heros);
    jeu.bots.placer(b, p.x, p.z, jeu.regles.lacetVersCentre(p) + Math.PI);
    jeu.effets.apparition({ x: p.x, y: 0, z: p.z }, 0x7cffd4);
  }

  // Joueur distant, ou bot de l'hôte vu par les autres
  ajouter(p) {
    if (this.distants.has(p.id) || p.id === this.moi) return;
    const bots = this.jeu.bots;
    const equipe = this.equipeReseau(p.id, p.equipe);
    const b = bots.ajouter({ nom: p.nom, equipe, heros: HEROS[p.heros] ? p.heros : "kael", teinte: this.enEquipes ? equipe : "neutre", arme: "fusil" });
    b.distant = true;
    b.distantId = p.id;
    b.botDistant = !!p.bot;
    b.net = null;
    bots.placer(b, 0, 0, 0);
    b.vivant = false;
    b.modele.racine.visible = false;
    this.distants.set(p.id, b);
  }

  retirer(id) {
    const b = this.distants.get(id);
    if (!b) return;
    this.jeu.bots.retirer(b);
    this.distants.delete(id);
  }

  // Liste des joueurs humains (les bots distants ne sont pas dedans)
  majJoueurs(liste) {
    if (!this.actif) return;
    const ids = new Set(liste.map((p) => p.id));
    for (const p of liste) this.ajouter(p);
    for (const [id, b] of [...this.distants]) if (!b.botDistant && !ids.has(id)) this.retirer(id);
  }

  reapparaitre() {
    const jeu = this.jeu, j = jeu.joueur;
    const p = jeu.regles.pointReapparition(j);
    j.equipementDeBase();
    j.donnerArme(jeu.regles.chargementDM || "fusil", false);
    j.placer(p.x, p.z, jeu.regles.lacetVersCentre(p));
    this.reapparitionT = -1;
    jeu.surReapparition();
  }

  // Message "etat" d'un autre joueur ou d'un bot de l'hôte
  etat(m) {
    if (!this.distants.has(m.id) && m.n && !this.botLocal(m.id)) this.ajouter({ id: m.id, nom: m.n, heros: m.hr, equipe: m.e, bot: true });
    const b = this.distants.get(m.id);
    if (!b) return;
    b.net = m;
    const bots = this.jeu.bots;
    if (m.v && !b.vivant) {
      if (ARMES[m.a] && m.a !== "couteau") b.arme = m.a;
      bots.placer(b, m.x, m.z, m.l + Math.PI);
      b.distant = true;
    } else if (!m.v && b.vivant) {
      b.vivant = false;
      b.modele.mourir(1);
    } else if (b.vivant && ARMES[m.a] && m.a !== "couteau" && m.a !== b.arme) {
      b.arme = m.a;
      const x = b.x, z = b.z, yaw = b.yaw;
      bots.placer(b, x, z, yaw);
      b.distant = true;
    }
  }

  tir(m) {
    const b = this.distants.get(m.id);
    const jeu = this.jeu;
    const o = { x: m.o[0], y: m.o[1], z: m.o[2] }, f = { x: m.f[0], y: m.f[1], z: m.f[2] };
    jeu.effets.tracante(o, f, 0xff8a70, 0.05);
    const d = Math.hypot(o.x - jeu.joueur.x, o.z - jeu.joueur.z);
    jeu.audio.tirBot(o, d, m.a);
    if (b && b.modele) b.modele.tir();
  }

  // Touché par un autre joueur ou un bot ; sur l'hôte, peut viser un de ses bots
  touche(m) {
    const jeu = this.jeu;
    const auteur = this.distants.get(m.de) || this.botLocal(m.de) || null;
    if (m.cible && m.cible !== this.moi) {
      const b = this.botLocal(m.cible);
      if (b && b.vivant) jeu.bots.blesser(b, m.degats, auteur, m.tete, m.arme);
      return;
    }
    if (!jeu.joueur.vivant) return;
    jeu.blesserJoueur(m.degats, auteur, m.tete, m.arme);
  }

  // Notre mort (envoyée au serveur, qui compte les points)
  mortLocale(tueur, tete, arme) {
    this.reseau.envoyer({ t: "mort", tueur: this.idDe(tueur), tete, arme });
    this.reapparitionT = DUREE_REAPPARITION;
  }

  // Hôte : un de ses bots est éliminé
  surMortBot(victime, tueur, tete, arme) {
    if (!victime.botLocal) return;
    this.reseau.envoyer({ t: "mort", bot: victime.id, tueur: this.idDe(tueur), tete, arme });
    this.reapBots.push({ b: victime, t: DUREE_REAPPARITION });
  }

  mort(m) {
    const jeu = this.jeu;
    this.scores = m.scores || this.scores;
    if (m.equipes) this.scoresEquipes = m.equipes;
    const b = this.distants.get(m.victime);
    if (b && b.vivant) { b.vivant = false; b.mortT = 0; b.modele.mourir(1); }
    const tueur = m.tueur ? this.nom(m.tueur) : "";
    const victime = this.nom(m.victime);
    jeu.hud.fil(tueur || victime, tueur ? victime : "s'est éliminé", m.tete, m.tueur === this.moi ? "tueur" : m.victime === this.moi ? "victime" : "", m.arme);
    if (m.tueur === this.moi && m.victime !== this.moi) jeu.surKillEnLigne(m.tete, m.arme);
  }

  maj(dt) {
    const jeu = this.jeu, j = jeu.joueur;
    this.envoiT -= dt;
    if (this.envoiT <= 0) {
      this.envoiT = 0.05;
      this.reseau.envoyer({ t: "etat", h: Math.round(performance.now()), x: +j.x.toFixed(2), y: +j.y.toFixed(2), z: +j.z.toFixed(2), l: +j.lacet.toFixed(3), g: +j.tangage.toFixed(3), a: j.armeActive, v: j.vivant ? 1 : 0, s: +Math.hypot(j.vel.x, j.vel.z).toFixed(1), c: j.accroupi ? 1 : 0 });
    }
    if (this.reapparitionT > 0) {
      this.reapparitionT -= dt;
      if (this.reapparitionT <= 0) this.reapparaitre();
    }
    if (!this.hote) return;
    // Hôte : réapparition et positions de ses bots
    for (const r of this.reapBots) { r.t -= dt; if (r.t <= 0) { this.placerBot(r.b); r.fait = true; } }
    this.reapBots = this.reapBots.filter((r) => !r.fait);
    this.botsT -= dt;
    if (this.botsT <= 0) {
      this.botsT = 0.1;
      const l = jeu.bots.liste.filter((b) => b.botLocal).map((b) => ({
        id: b.id, x: +b.x.toFixed(2), y: +(b.y || 0).toFixed(2), z: +b.z.toFixed(2), l: +(b.yaw - Math.PI).toFixed(3), g: +(b.pitch || 0).toFixed(3),
        a: b.arme, v: b.vivant ? 1 : 0, s: +(b.vitesse || 0).toFixed(1), c: 0, n: b.nom, hr: b.heros, e: this.enEquipes ? b.equipe : "",
      }));
      if (l.length) this.reseau.envoyer({ t: "bots", h: Math.round(performance.now()), l });
    }
  }

  classement() {
    const j = this.jeu.joueur;
    const ligne = (id, nom, equipe, moi = false) => ({ id, nom, equipe, moi, ...(this.scores[id] || { kills: 0, morts: 0 }) });
    const lignes = [ligne(this.moi, j.nom, j.equipe, true)];
    for (const [id, b] of this.distants) lignes.push(ligne(id, b.nom, b.equipe));
    for (const b of this.jeu.bots.liste) if (b.botLocal) lignes.push(ligne(b.id, b.nom, b.equipe));
    return lignes.sort((a, b) => b.kills - a.kills);
  }

  arreter() {
    this.actif = false;
    for (const id of [...this.distants.keys()]) this.retirer(id);
    for (const b of [...this.jeu.bots.liste]) if (b.botLocal) this.jeu.bots.retirer(b);
    this.reapBots = [];
  }
}
