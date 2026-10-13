// Multijoueur en ligne : connexion WebSocket au serveur Node.js (jeu/serveur/serveur.js),
// salons à code et deathmatch entre amis. Les autres joueurs sont affichés comme des personnages
// "distants" dont la position est lissée entre deux messages.
import { ARMES } from "./armes.js";

export class Reseau {
  constructor() {
    this.ws = null;
    this.ecouteurs = new Map();
    this.id = null;
  }

  get connecte() { return !!this.ws && this.ws.readyState === 1; }

  on(type, fn) { this.ecouteurs.set(type, fn); }

  connecter(url) {
    return new Promise((ok, ko) => {
      let ws;
      try { ws = new WebSocket(url); } catch (e) { ko(new Error("Adresse du serveur invalide.")); return; }
      const minuterie = setTimeout(() => { try { ws.close(); } catch (e) { /* déjà fermé */ } ko(new Error("Le serveur ne répond pas.")); }, 6000);
      ws.onopen = () => { clearTimeout(minuterie); this.ws = ws; ok(); };
      ws.onerror = () => { clearTimeout(minuterie); ko(new Error("Connexion impossible au serveur.")); };
      ws.onclose = () => {
        if (this.ws === ws) { this.ws = null; const f = this.ecouteurs.get("ferme"); if (f) f(); }
      };
      ws.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch (err) { return; }
        const f = this.ecouteurs.get(m.t);
        if (f) f(m);
      };
    });
  }

  envoyer(objet) { if (this.connecte) this.ws.send(JSON.stringify(objet)); }

  fermer() {
    if (this.ws) { const ws = this.ws; this.ws = null; try { ws.close(); } catch (e) { /* déjà fermé */ } }
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
    const b = bots.ajouter({ nom: p.nom, equipe: "net-" + p.id, palette: p.palette, arme: "fusil" });
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
      this.reseau.envoyer({ t: "etat", x: +j.x.toFixed(2), y: +j.y.toFixed(2), z: +j.z.toFixed(2), l: +j.lacet.toFixed(3), g: +j.tangage.toFixed(3), a: j.armeActive, v: j.vivant ? 1 : 0, s: +Math.hypot(j.vel.x, j.vel.z).toFixed(1), c: j.accroupi ? 1 : 0 });
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
