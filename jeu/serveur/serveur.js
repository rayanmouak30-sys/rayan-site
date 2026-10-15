// Serveur multijoueur de Neon Strike : salons à code, relais des positions et des tirs, score du deathmatch.
// Node.js seul, aucune dépendance (WebSocket implémenté à la main, RFC 6455).
// Lancer en local :  node jeu/serveur/serveur.js   puis ouvrir http://localhost:8080/
"use strict";
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 8080;
const HOTE = process.env.IP || "0.0.0.0";
const RACINE = path.join(__dirname, "..");     // dossier jeu/ (servi seulement pour les tests en local)
const MAX_JOUEURS = 8;
const VERSION_JEU = 3;   // bots en ligne
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };

// ----- Fichiers statiques (pratique pour jouer en réseau local) -----
const serveur = http.createServer((req, res) => {
  let chemin = decodeURIComponent((req.url || "/").split("?")[0]);
  if (chemin === "/" || chemin === "") chemin = "/index.html";
  if (chemin === "/sante") { res.writeHead(200, { "Content-Type": "text/plain" }); res.end("ok"); return; }
  const fichier = path.normalize(path.join(RACINE, chemin));
  const ext = path.extname(fichier);
  if (!fichier.startsWith(RACINE + path.sep) || !TYPES[ext] || fichier.includes(path.sep + "serveur" + path.sep)) { res.writeHead(404); res.end(); return; }
  fs.readFile(fichier, (err, donnees) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[ext], "Cache-Control": "no-cache" });
    res.end(donnees);
  });
});

// ----- WebSocket -----
serveur.on("upgrade", (req, socket) => {
  const cle = req.headers["sec-websocket-key"];
  if (!cle || (req.headers.upgrade || "").toLowerCase() !== "websocket") { socket.destroy(); return; }
  const accepte = crypto.createHash("sha1").update(cle + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
  socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accepte + "\r\n\r\n");
  socket.setNoDelay(true);
  const client = { id: "p" + crypto.randomBytes(4).toString("hex"), nom: "Joueur", socket, salon: null, tampon: Buffer.alloc(0), fragments: [], compteur: 0, fenetre: Date.now(), palette: 0 };
  socket.on("data", (d) => lire(client, d));
  socket.on("close", () => quitter(client));
  socket.on("error", () => quitter(client));
});

function lire(client, donnees) {
  client.tampon = Buffer.concat([client.tampon, donnees]);
  if (client.tampon.length > 1 << 20) { client.socket.destroy(); return; }
  for (;;) {
    const b = client.tampon;
    if (b.length < 2) return;
    const fin = (b[0] & 0x80) !== 0, code = b[0] & 0x0f, masque = (b[1] & 0x80) !== 0;
    let longueur = b[1] & 0x7f, pos = 2;
    if (longueur === 126) { if (b.length < 4) return; longueur = b.readUInt16BE(2); pos = 4; }
    else if (longueur === 127) { if (b.length < 10) return; longueur = Number(b.readBigUInt64BE(2)); pos = 10; }
    if (longueur > 65536 || !masque) { client.socket.destroy(); return; }
    if (b.length < pos + 4 + longueur) return;
    const cleMasque = b.subarray(pos, pos + 4);
    const charge = Buffer.from(b.subarray(pos + 4, pos + 4 + longueur));
    for (let i = 0; i < charge.length; i++) charge[i] ^= cleMasque[i & 3];
    client.tampon = b.subarray(pos + 4 + longueur);
    if (code === 0x8) { envoyerTrame(client, Buffer.alloc(0), 0x8); client.socket.end(); return; }
    if (code === 0x9) { envoyerTrame(client, charge, 0xa); continue; }
    if (code === 0xa) continue;
    if (code === 0x1 || code === 0x0) {
      client.fragments.push(charge);
      if (!fin) continue;
      const texte = Buffer.concat(client.fragments).toString("utf8");
      client.fragments = [];
      recevoir(client, texte);
    }
  }
}

function envoyerTrame(client, charge, code = 0x1) {
  if (client.socket.destroyed) return;
  const n = charge.length;
  let tete;
  if (n < 126) tete = Buffer.from([0x80 | code, n]);
  else if (n < 65536) { tete = Buffer.alloc(4); tete[0] = 0x80 | code; tete[1] = 126; tete.writeUInt16BE(n, 2); }
  else { tete = Buffer.alloc(10); tete[0] = 0x80 | code; tete[1] = 127; tete.writeBigUInt64BE(BigInt(n), 2); }
  client.socket.write(Buffer.concat([tete, charge]));
}

function envoyer(client, objet) { envoyerTrame(client, Buffer.from(JSON.stringify(objet), "utf8")); }

// ----- Salons -----
// Modes : "ffa" (chacun pour soi), "equipes" (bleus contre rouges), "coop" (les joueurs contre les bots).
// Les bots tournent chez l'hôte : il envoie leurs positions ("bots"), tirs et touches.
const salons = new Map();
const LETTRES = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MODES = ["ffa", "equipes", "coop"];
const OBJECTIFS = { ffa: 20, equipes: 50, coop: 50 };
const DIFFICULTES = ["facile", "normal", "difficile", "expert"];
const CARTES = ["nexus", "bazar", "hangar"];
const MAX_BOTS = 10;

function nouveauCode() {
  for (;;) {
    let c = "";
    for (let i = 0; i < 4; i++) c += LETTRES[crypto.randomInt(LETTRES.length)];
    if (!salons.has(c)) return c;
  }
}

const nettoyer = (s, max) => String(s || "").replace(/[<>&"'`\\]/g, "").trim().slice(0, max);
const nombre = (v, min, max) => { const n = Number(v); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : 0; };
const idBot = (b) => (typeof b === "string" && /^b\d{1,4}$/.test(b) ? b : "");
const herosValide = (h) => (typeof h === "string" && /^[a-z]{2,12}$/.test(h) ? h : "kael");

const config = (salon) => ({ mode: salon.mode, bots: salon.nbBots, difficulte: salon.difficulte, carte: salon.carte });
function listeJoueurs(salon) {
  return [...salon.joueurs.values()].map((c) => ({ id: c.id, nom: c.nom, palette: c.palette, heros: c.heros || "kael", hote: c === salon.hote, equipe: c.equipe }));
}

function diffuser(salon, objet, sauf = null) {
  const texte = Buffer.from(JSON.stringify(objet), "utf8");
  for (const c of salon.joueurs.values()) if (c !== sauf) envoyerTrame(c, texte);
}
const diffuserJoueurs = (salon) => diffuser(salon, { t: "joueurs", joueurs: listeJoueurs(salon), config: config(salon) });

function equipeLibre(salon) {
  const n = { bleu: 0, rouge: 0 };
  for (const c of salon.joueurs.values()) if (n[c.equipe] !== undefined) n[c.equipe]++;
  return n.bleu <= n.rouge ? "bleu" : "rouge";
}
const acteurParId = (salon, id) => salon.joueurs.get(id) || salon.bots.get(id) || null;
const equipeDe = (salon, id) => { const a = acteurParId(salon, id); return a ? a.equipe || "" : ""; };
function scoresEquipes(salon) {
  const t = { bleu: 0, rouge: 0 };
  for (const [id, sc] of Object.entries(salon.scores)) { const e = salon.equipesPartie[id]; if (t[e] !== undefined) t[e] += sc.kills; }
  return t;
}
const messageDebut = (salon) => ({ t: "debut", carte: salon.carte, mode: salon.mode, bots: salon.nbBots, difficulte: salon.difficulte, objectif: OBJECTIFS[salon.mode],
  hote: salon.hote.id, scores: salon.scores, equipes: scoresEquipes(salon), joueurs: listeJoueurs(salon) });

function entrer(client, salon) {
  client.salon = salon;
  const prises = new Set([...salon.joueurs.values()].map((c) => c.palette));
  client.palette = [7, 8, 9, 10, 11, 0, 3, 4].find((p) => !prises.has(p)) ?? 0;
  client.equipe = salon.mode === "coop" ? "bleu" : equipeLibre(salon);
  salon.joueurs.set(client.id, client);
  salon.scores[client.id] = salon.scores[client.id] || { kills: 0, morts: 0 };
  envoyer(client, { t: "salon", code: salon.code, id: client.id, carte: salon.carte, hote: salon.hote === client, joueurs: listeJoueurs(salon), config: config(salon) });
  diffuserJoueurs(salon);
  if (salon.etat === "jeu") {
    salon.equipesPartie[client.id] = salon.mode === "ffa" ? "" : client.equipe;
    envoyer(client, messageDebut(salon));
  }
}

function retirerBots(salon, proprio = null) {
  for (const [id, b] of [...salon.bots]) {
    if (proprio && b.proprio !== proprio) continue;
    salon.bots.delete(id);
    delete salon.scores[id];
    diffuser(salon, { t: "parti", id });
  }
}

function quitter(client) {
  const salon = client.salon;
  if (!salon) return;
  client.salon = null;
  salon.joueurs.delete(client.id);
  delete salon.scores[client.id];
  retirerBots(salon, client);
  if (!salon.joueurs.size) { salons.delete(salon.code); return; }
  if (salon.hote === client) salon.hote = salon.joueurs.values().next().value;
  diffuser(salon, { t: "parti", id: client.id });
  diffuserJoueurs(salon);
}

function refuserEntree(client, m, s) {
  if (!m.v || Number(m.v) < VERSION_JEU) { envoyer(client, { t: "erreur", texte: "Ton jeu n'est pas à jour : recharge la page (Ctrl + F5)." }); return true; }
  return false;
}

function appliquerConfig(salon, m) {
  if (MODES.includes(m.mode)) salon.mode = m.mode;
  if (m.bots !== undefined) salon.nbBots = Math.round(nombre(m.bots, 0, MAX_BOTS));
  if (DIFFICULTES.includes(m.difficulte)) salon.difficulte = m.difficulte;
  if (CARTES.includes(m.carte)) salon.carte = m.carte;
  if (salon.mode === "coop") for (const c of salon.joueurs.values()) c.equipe = "bleu";
}

const etatValide = (m, id) => ({
  t: "etat", id, x: nombre(m.x, -200, 200), y: nombre(m.y, -10, 50), z: nombre(m.z, -200, 200),
  l: nombre(m.l, -1e4, 1e4), g: nombre(m.g, -2, 2), a: nettoyer(m.a, 10), v: m.v ? 1 : 0, s: nombre(m.s, 0, 30), c: m.c ? 1 : 0,
});

// Qui agit : le joueur, ou un de ses bots (seul l'hôte en a)
function acteurDe(salon, client, m) {
  const b = idBot(m.bot);
  if (!b) return client;
  const bot = salon.bots.get(b);
  return bot && bot.proprio === client ? bot : null;
}

function recevoir(client, texte) {
  // Anti-abus : 120 messages par seconde au maximum (joueur + ses bots)
  const maintenant = Date.now();
  if (maintenant - client.fenetre > 1000) { client.fenetre = maintenant; client.compteur = 0; }
  if (++client.compteur > 120) return;
  let m;
  try { m = JSON.parse(texte); } catch (e) { return; }
  if (!m || typeof m.t !== "string") return;
  const salon = client.salon;
  const hote = salon && salon.hote === client;
  switch (m.t) {
    case "creer": {
      if (refuserEntree(client, m, null)) break;
      if (salon) quitter(client);
      client.nom = nettoyer(m.nom, 16) || "Joueur";
      client.heros = herosValide(m.heros);
      const s = { code: nouveauCode(), carte: "nexus", mode: "ffa", nbBots: 0, difficulte: "normal", hote: client, joueurs: new Map(), bots: new Map(),
        etat: "attente", scores: {}, equipesPartie: {} };
      appliquerConfig(s, m);
      salons.set(s.code, s);
      entrer(client, s);
      break;
    }
    case "rejoindre": {
      const s = salons.get(nettoyer(m.code, 4).toUpperCase());
      if (!s) { envoyer(client, { t: "erreur", texte: "Aucun salon avec ce code." }); break; }
      if (refuserEntree(client, m, s)) break;
      if (s.joueurs.size >= MAX_JOUEURS) { envoyer(client, { t: "erreur", texte: "Salon complet (8 joueurs)." }); break; }
      if (salon) quitter(client);
      client.nom = nettoyer(m.nom, 16) || "Joueur";
      client.heros = herosValide(m.heros);
      entrer(client, s);
      break;
    }
    case "config":
      if (!hote || salon.etat === "jeu") break;
      appliquerConfig(salon, m);
      diffuserJoueurs(salon);
      break;
    case "equipe":
      if (!salon || salon.etat === "jeu" || salon.mode !== "equipes") break;
      client.equipe = client.equipe === "bleu" ? "rouge" : "bleu";
      diffuserJoueurs(salon);
      break;
    case "lancer":
      if (!hote) break;
      appliquerConfig(salon, m);
      salon.etat = "jeu";
      retirerBots(salon);
      salon.scores = {};
      salon.equipesPartie = {};
      for (const c of salon.joueurs.values()) {
        salon.scores[c.id] = { kills: 0, morts: 0 };
        salon.equipesPartie[c.id] = salon.mode === "ffa" ? "" : c.equipe;
      }
      diffuser(salon, messageDebut(salon));
      break;
    case "etat": {
      if (!salon) break;
      const e = etatValide(m, client.id);
      diffuser(salon, e, client);
      break;
    }
    case "bots": {
      // Positions des bots de l'hôte (même contrôle que la position d'un joueur)
      if (!hote || salon.etat !== "jeu" || !Array.isArray(m.l)) break;
      for (const e of m.l.slice(0, MAX_BOTS)) {
        const id = idBot(e && e.id);
        if (!id) continue;
        let bot = salon.bots.get(id);
        if (!bot) {
          if (salon.bots.size >= MAX_BOTS) continue;
          const equipe = salon.mode === "ffa" ? "" : e.e === "bleu" ? "bleu" : "rouge";
          bot = { id, bot: true, proprio: client, nom: nettoyer(e.n, 16) || "Bot", heros: herosValide(e.hr), equipe };
          salon.bots.set(id, bot);
          salon.scores[id] = salon.scores[id] || { kills: 0, morts: 0 };
          salon.equipesPartie[id] = equipe;
        } else if (bot.proprio !== client) continue;
        const etat = { ...etatValide(e, id), n: bot.nom, hr: bot.heros, e: bot.equipe };
        diffuser(salon, etat, client);
      }
      break;
    }
    case "tir": {
      if (!salon || !Array.isArray(m.o) || !Array.isArray(m.f)) break;
      const qui = acteurDe(salon, client, m);
      if (!qui) break;
      const vec = (v) => [0, 1, 2].map((i) => nombre(v[i], -300, 300));
      const t = { t: "tir", id: qui.id, o: vec(m.o), f: vec(m.f), a: nettoyer(m.a, 10) };
      diffuser(salon, t, client);
      break;
    }
    case "touche": {
      // Touche d'un joueur ou d'un bot de l'hôte, sur un joueur ou un bot ; transmise au propriétaire de la cible
      if (!salon) break;
      const qui = acteurDe(salon, client, m);
      const cible = acteurParId(salon, String(m.cible));
      if (!qui || !cible || cible === qui) break;
      if (salon.mode !== "ffa" && qui.equipe && qui.equipe === cible.equipe) break;   // pas de tir ami
      const x = { tete: !!m.tete, arme: nettoyer(m.arme, 10) };
      const degats = nombre(m.degats, 0, 400);
      const dest = cible.bot ? cible.proprio : cible;
      if (dest !== client) envoyer(dest, { t: "touche", de: qui.id, cible: cible.id, degats, tete: x.tete, arme: x.arme });
      break;
    }
    case "mort": {
      if (!salon || salon.etat !== "jeu") break;
      const victime = acteurDe(salon, client, m);
      if (!victime) break;
      const idTueur = acteurParId(salon, String(m.tueur)) && String(m.tueur) !== victime.id ? String(m.tueur) : null;
      let tueur = idTueur;
      if (tueur && salon.mode !== "ffa" && equipeDe(salon, tueur) === victime.equipe) tueur = null;
      salon.scores[victime.id] = salon.scores[victime.id] || { kills: 0, morts: 0 };
      salon.scores[victime.id].morts++;
      if (tueur) { salon.scores[tueur] = salon.scores[tueur] || { kills: 0, morts: 0 }; salon.scores[tueur].kills++; }
      const equipes = scoresEquipes(salon);
      diffuser(salon, { t: "mort", victime: victime.id, tueur, tete: !!m.tete, arme: nettoyer(m.arme, 10), scores: salon.scores, equipes });
      const objectif = OBJECTIFS[salon.mode];
      let gagnant = null;
      if (salon.mode === "ffa") { if (tueur && salon.scores[tueur].kills >= objectif) gagnant = tueur; }
      else for (const [e, n] of Object.entries(equipes)) if (n >= objectif) gagnant = e;
      if (gagnant) {
        salon.etat = "attente";
        diffuser(salon, { t: "fin", gagnant, scores: salon.scores, equipes });
        retirerBots(salon);
      }
      break;
    }
    case "quitter":
      quitter(client);
      break;
  }
}

// Coupe les connexions mortes (ping toutes les 20 s)
setInterval(() => {
  for (const s of salons.values()) for (const c of s.joueurs.values()) envoyerTrame(c, Buffer.alloc(0), 0x9);
}, 20000);

serveur.listen(PORT, HOTE, () => console.log(`Neon Strike : serveur prêt sur http://localhost:${PORT}/ (WebSocket : ws://localhost:${PORT}/ws)`));
