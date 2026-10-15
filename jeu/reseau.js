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
export const VERSION_PROTOCOLE = 2;

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

export class PartieEnLigne {
  constructor(jeu, reseau) {
    this.jeu = jeu;
    this.reseau = reseau;
    this.distants = new Map();
    this.scores = {};
    this.objectif = 20;
    this.envoiT = 0;
    this.reapparitionT = -1;
    this.actif = false;
  }

  get moi() { return this.reseau.id; }

  nom(id) {
    if (id === this.moi) return this.jeu.joueur.nom;
    const b = this.distants.get(id);
    return b ? b.nom : "?";
  }

  demarrer(m) {
    const jeu = this.jeu;
    this.actif = true;
    this.objectif = m.objectif || 20;
    this.scores = m.scores || {};
    this.distants.clear();
    jeu.bots.vider();
    jeu.bots.mode = "deathmatch";
    jeu.joueur.equipe = "net-" + this.moi;
    for (const p of m.joueurs || []) if (p.id !== this.moi) this.ajouter(p);
    this.reapparaitre();
  }

  ajouter(p) {
    if (this.distants.has(p.id) || p.id === this.moi) return;
    const bots = this.jeu.bots;
    const b = bots.ajouter({ nom: p.nom, equipe: "net-" + p.id, heros: HEROS[p.heros] ? p.heros : "kael", teinte: "neutre", arme: "fusil" });
    b.distant = true;
    b.distantId = p.id;
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

  majJoueurs(liste) {
    if (!this.actif) return;
    const ids = new Set(liste.map((p) => p.id));
    for (const p of liste) this.ajouter(p);
    for (const id of [...this.distants.keys()]) if (!ids.has(id)) this.retirer(id);
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

  // Message "etat" d'un autre joueur
  etat(m) {
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

  // On a été touché par un autre joueur
  touche(m) {
    const jeu = this.jeu;
    const auteur = this.distants.get(m.de) || null;
    if (!jeu.joueur.vivant) return;
    jeu.blesserJoueur(m.degats, auteur, m.tete, m.arme);
  }

  // Notre mort (envoyée au serveur, qui compte les points)
  mortLocale(tueur, tete, arme) {
    this.reseau.envoyer({ t: "mort", tueur: tueur && tueur.distantId ? tueur.distantId : null, tete, arme });
    this.reapparitionT = 3;
  }

  mort(m) {
    const jeu = this.jeu;
    this.scores = m.scores || this.scores;
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
  }

  classement() {
    const lignes = [{ id: this.moi, nom: this.jeu.joueur.nom, ...(this.scores[this.moi] || { kills: 0, morts: 0 }), moi: true }];
    for (const [id, b] of this.distants) lignes.push({ id, nom: b.nom, ...(this.scores[id] || { kills: 0, morts: 0 }) });
    return lignes.sort((a, b) => b.kills - a.kills);
  }

  arreter() {
    this.actif = false;
    for (const id of [...this.distants.keys()]) this.retirer(id);
  }
}
