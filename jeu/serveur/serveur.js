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
const OBJECTIF = 20;
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
  const client = { id: crypto.randomBytes(4).toString("hex"), nom: "Joueur", socket, salon: null, tampon: Buffer.alloc(0), fragments: [], compteur: 0, fenetre: Date.now(), palette: 0 };
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
const salons = new Map();
const LETTRES = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function nouveauCode() {
  for (;;) {
    let c = "";
    for (let i = 0; i < 4; i++) c += LETTRES[crypto.randomInt(LETTRES.length)];
    if (!salons.has(c)) return c;
  }
}

const nettoyer = (s, max) => String(s || "").replace(/[<>&"'`\\]/g, "").trim().slice(0, max);
const nombre = (v, min, max) => { const n = Number(v); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : 0; };

function listeJoueurs(salon) {
  return [...salon.joueurs.values()].map((c) => ({ id: c.id, nom: c.nom, palette: c.palette, heros: c.heros || "kael", hote: c === salon.hote }));
}

function diffuser(salon, objet, sauf = null) {
  const texte = Buffer.from(JSON.stringify(objet), "utf8");
  for (const c of salon.joueurs.values()) if (c !== sauf) envoyerTrame(c, texte);
}

function entrer(client, salon) {
  client.salon = salon;
  const prises = new Set([...salon.joueurs.values()].map((c) => c.palette));
  client.palette = [7, 8, 9, 10, 11, 0, 3, 4].find((p) => !prises.has(p)) ?? 0;
  salon.joueurs.set(client.id, client);
  salon.scores[client.id] = salon.scores[client.id] || { kills: 0, morts: 0 };
  envoyer(client, { t: "salon", code: salon.code, id: client.id, carte: salon.carte, hote: salon.hote === client, joueurs: listeJoueurs(salon) });
  diffuser(salon, { t: "joueurs", joueurs: listeJoueurs(salon) });
  if (salon.etat === "jeu") envoyer(client, { t: "debut", carte: salon.carte, objectif: OBJECTIF, scores: salon.scores, joueurs: listeJoueurs(salon) });
}

function quitter(client) {
  const salon = client.salon;
  if (!salon) return;
  client.salon = null;
  salon.joueurs.delete(client.id);
  delete salon.scores[client.id];
  if (!salon.joueurs.size) { salons.delete(salon.code); return; }
  if (salon.hote === client) salon.hote = salon.joueurs.values().next().value;
  diffuser(salon, { t: "parti", id: client.id });
  diffuser(salon, { t: "joueurs", joueurs: listeJoueurs(salon) });
}

function recevoir(client, texte) {
  // Anti-abus : 80 messages par seconde au maximum
  const maintenant = Date.now();
  if (maintenant - client.fenetre > 1000) { client.fenetre = maintenant; client.compteur = 0; }
  if (++client.compteur > 80) return;
  let m;
  try { m = JSON.parse(texte); } catch (e) { return; }
  if (!m || typeof m.t !== "string") return;
  const salon = client.salon;
  switch (m.t) {
    case "creer": {
      if (salon) quitter(client);
      client.nom = nettoyer(m.nom, 16) || "Joueur";
      client.heros = typeof m.heros === "string" && /^[a-z]{2,12}$/.test(m.heros) ? m.heros : "kael";
      const s = { code: nouveauCode(), carte: ["nexus", "bazar", "hangar"].includes(m.carte) ? m.carte : "nexus", hote: client, joueurs: new Map(), etat: "attente", scores: {} };
      salons.set(s.code, s);
      entrer(client, s);
      break;
    }
    case "rejoindre": {
      const s = salons.get(nettoyer(m.code, 4).toUpperCase());
      if (!s) { envoyer(client, { t: "erreur", texte: "Aucun salon avec ce code." }); break; }
      if (s.joueurs.size >= MAX_JOUEURS) { envoyer(client, { t: "erreur", texte: "Salon complet (8 joueurs)." }); break; }
      if (salon) quitter(client);
      client.nom = nettoyer(m.nom, 16) || "Joueur";
      client.heros = typeof m.heros === "string" && /^[a-z]{2,12}$/.test(m.heros) ? m.heros : "kael";
      entrer(client, s);
      break;
    }
    case "lancer":
      if (!salon || salon.hote !== client) break;
      if (["nexus", "bazar", "hangar"].includes(m.carte)) salon.carte = m.carte;
      salon.etat = "jeu";
      for (const id of Object.keys(salon.scores)) salon.scores[id] = { kills: 0, morts: 0 };
      diffuser(salon, { t: "debut", carte: salon.carte, objectif: OBJECTIF, scores: salon.scores, joueurs: listeJoueurs(salon) });
      break;
    case "etat":
      if (!salon) break;
      diffuser(salon, {
        t: "etat", id: client.id, x: nombre(m.x, -200, 200), y: nombre(m.y, -10, 50), z: nombre(m.z, -200, 200),
        l: nombre(m.l, -1e4, 1e4), g: nombre(m.g, -2, 2), a: nettoyer(m.a, 10), v: m.v ? 1 : 0, s: nombre(m.s, 0, 30), c: m.c ? 1 : 0,
      }, client);
      break;
    case "tir":
      if (!salon || !Array.isArray(m.o) || !Array.isArray(m.f)) break;
      diffuser(salon, { t: "tir", id: client.id, o: m.o.slice(0, 3).map((v) => nombre(v, -300, 300)), f: m.f.slice(0, 3).map((v) => nombre(v, -300, 300)), a: nettoyer(m.a, 10) }, client);
      break;
    case "touche": {
      if (!salon) break;
      const cible = salon.joueurs.get(String(m.cible));
      if (cible) envoyer(cible, { t: "touche", de: client.id, degats: nombre(m.degats, 0, 300), tete: !!m.tete, arme: nettoyer(m.arme, 10) });
      break;
    }
    case "mort": {
      if (!salon || salon.etat !== "jeu") break;
      const tueur = salon.joueurs.has(String(m.tueur)) && String(m.tueur) !== client.id ? String(m.tueur) : null;
      salon.scores[client.id].morts++;
      if (tueur) salon.scores[tueur].kills++;
      diffuser(salon, { t: "mort", victime: client.id, tueur, tete: !!m.tete, arme: nettoyer(m.arme, 10), scores: salon.scores });
      if (tueur && salon.scores[tueur].kills >= OBJECTIF) {
        salon.etat = "attente";
        diffuser(salon, { t: "fin", gagnant: tueur, scores: salon.scores });
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
