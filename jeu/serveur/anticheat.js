// Anti-triche du serveur temps réel (WebSocket). Même logique et mêmes règles (anticheat.json) que jeu/anticheat.php :
// horloge accélérée, téléportation et vitesse, dégâts impossibles, cadence, touches sans tir, tir depuis une autre position,
// couteau à distance, invincibilité, élimination offerte, statistiques de visée. Points, exclusion et bannissement temporaire.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const R = JSON.parse(fs.readFileSync(path.join(__dirname, "anticheat.json"), "utf8"));
const JOURNAL = path.join(__dirname, "..", "..", "donnees", "anticheat.json");
const RAISONS = {
  horloge: "Horloge du jeu accélérée (speedhack)", teleport: "Téléportation", vitesse: "Vitesse de déplacement impossible",
  degats: "Dégâts impossibles", cadence: "Cadence de tir trop rapide", sans_tir: "Touches sans tir",
  position_tir: "Tir depuis une autre position", couteau: "Coup de couteau à distance", portee: "Touche hors de portée",
  invincible: "Invincibilité", visee_tete: "Taux de tirs à la tête anormal", visee_snap: "Visée automatique probable", format: "Messages truqués",
};
const bans = new Map();   // empreinte -> fin (ms)

const maintenant = () => Date.now();
// Adresse vue par le proxy de l'hébergeur : la DERNIÈRE de X-Forwarded-For (les précédentes peuvent être inventées par le client)
const adresse = (req) => String(req.headers["x-forwarded-for"] || "").split(",").map((x) => x.trim()).filter(Boolean).pop() || req.socket.remoteAddress || "";
const empreinte = (req) => crypto.createHash("sha256").update(adresse(req) + "|" + String(req.headers["user-agent"] || "")).digest("hex");

function nouveau() {
  return { base: null, calibFin: null, h: 0, pos: null, posH: 0, vivant: 0, reapparition: true, reserve: R.reserve_deplacement, lacets: [], tirs: {},
    tirArme: "", tirH: -1e12, credit: 0, degatsVie: 0, depasseT: null, recuDe: {}, touches: 0, tetes: 0, snaps: 0, drapeaux: {}, points: 0, derniers: {} };
}

function journal(entree) {
  try {
    let j = [];
    try { j = JSON.parse(fs.readFileSync(JOURNAL, "utf8")); } catch (e) { /* pas encore de journal */ }
    if (!Array.isArray(j)) j = Object.values(j);
    j.push(entree);
    fs.writeFileSync(JOURNAL, JSON.stringify(j.slice(-300), null, 1));
  } catch (e) { /* journal indisponible : la partie continue */ }
}

const banni = (emp) => (bans.get(emp) || 0) > maintenant();

// ctx : { salon, client, exclure(client, raison) } ; retourne vrai si le joueur a été exclu
function signaler(ctx, raison, points, detail = "") {
  let c = ctx.client;
  // Triche d'un bot : c'est l'hôte qui le fait tourner, c'est lui qui est sanctionné
  if (c.bot) { detail = `bot ${c.nom} : ${detail}`; c = c.proprio; if (!c || !c.salon) return true; }
  const ac = c.ac, t = maintenant();
  if (!ac || c.exclu) return true;
  if (points < 3 && ac.derniers[raison] && t - ac.derniers[raison] < 3000) return false;
  ac.derniers[raison] = t;
  ac.points += points;
  const exclu = ac.points >= R.points_exclusion;
  journal({ t: Math.floor(t / 1000), salon: ctx.salon.code, nom: c.nom, raison: RAISONS[raison] || raison, detail, points: ac.points, exclu });
  if (!exclu) return false;
  c.exclu = true;
  if (c.empreinte) { bans.set(c.empreinte, t + R.bannissement_s * 1000); ctx.salon.bannis.add(c.empreinte); }
  ctx.exclure(c, RAISONS[raison] || raison);
  return true;
}

// Faux : message à ignorer
function horloge(ctx, h) {
  const ac = ctx.client.ac;
  if (typeof h !== "number" || !Number.isFinite(h)) { signaler(ctx, "format", 1, "horodatage absent"); return false; }
  if (h + 1 < ac.h) return false;
  ac.h = Math.max(ac.h, h);
  const t = maintenant(), decalage = h - t;
  if (ac.calibFin === null) ac.calibFin = t + R.calibrage_horloge_ms;
  if (t <= ac.calibFin) { ac.base = ac.base === null ? decalage : Math.max(ac.base, decalage); return true; }
  const avance = decalage - ac.base;
  if (avance > R.avance_horloge_max_ms) { signaler(ctx, "horloge", 3, `horloge en avance de ${(avance / 1000).toFixed(1)} s`); return false; }
  return true;
}

function etat(ctx, e, h) {
  if (!horloge(ctx, h)) return false;
  const ac = ctx.client.ac, cap = R.reserve_deplacement, pos = [e.x, e.y, e.z], v = e.v ? 1 : 0;
  if (v === 1 && ac.pos && ac.vivant === 1) {
    const dt = Math.max(0, (h - ac.posH) / 1000);
    const d = Math.hypot(pos[0] - ac.pos[0], pos[2] - ac.pos[2]);
    const permis = R.vitesse_max * dt + R.marge_deplacement;
    if (d > cap + permis) { signaler(ctx, "teleport", 3, `${d.toFixed(1)} m en ${dt.toFixed(2)} s`); return false; }
    ac.reserve = Math.min(cap, ac.reserve - (d - permis));
    if (ac.reserve < 0) {
      ac.reserve = cap;
      if (signaler(ctx, "vitesse", 2, `${d.toFixed(1)} m en ${dt.toFixed(2)} s`)) return false;
    }
  } else if (v === 1 && ac.vivant === 0 && !ac.reapparition && ac.pos) {
    signaler(ctx, "teleport", 3, "réapparition sans élimination");
    return false;
  }
  if (v === 1 && ac.vivant === 0) { ac.reapparition = false; ac.degatsVie = 0; ac.depasseT = null; ac.reserve = cap; }
  ac.vivant = v;
  ac.pos = pos;
  ac.posH = h;
  ac.lacets.push([h, e.l]);
  if (ac.lacets.length > 3) ac.lacets.shift();
  if (v === 1 && ac.depasseT !== null && maintenant() - ac.depasseT > R.delai_invincibilite_ms) {
    signaler(ctx, "invincible", 3, `${Math.round(ac.degatsVie)} dégâts reçus sans mourir`);
    return false;
  }
  return true;
}

function cadence(ac, arme, h) {
  const def = R.armes[arme], fenetre = R.fenetre_cadence_s * 1000;
  const liste = (ac.tirs[arme] || []).filter((t) => t > h - fenetre);
  liste.push(h);
  ac.tirs[arme] = liste;
  return liste.length <= R.fenetre_cadence_s / (def.cadence / R.bonus_cadence_max) + R.marge_cadence_tirs;
}

function tir(ctx, m) {
  if (!horloge(ctx, m.h)) return false;
  const def = R.armes[m.a], ac = ctx.client.ac;
  if (!def || def.melee) { signaler(ctx, "format", 1, "arme inconnue : " + m.a); return false; }
  if (ac.vivant !== 1) return false;
  if (ac.pos) {
    const ecart = Math.hypot(m.o[0] - ac.pos[0], m.o[2] - ac.pos[2]);
    if (ecart > R.ecart_tir_position) { signaler(ctx, "position_tir", 1, `${ecart.toFixed(1)} m de sa position`); return false; }
  }
  if (!cadence(ac, m.a, m.h)) { signaler(ctx, "cadence", 2, `${m.a} : ${ac.tirs[m.a].length} tirs en ${R.fenetre_cadence_s} s`); return false; }
  ac.tirArme = m.a;
  ac.tirH = m.h;
  // Les bots envoient une touche par plomb, les joueurs une par cible
  ac.credit = ctx.client.bot ? def.plombs || 1 : def.cibles_par_tir || 1;
  return true;
}

// Renvoie les dégâts validés, ou null
function touche(ctx, cible, m) {
  if (!horloge(ctx, m.h)) return null;
  const def = R.armes[m.arme], ac = ctx.client.ac;
  if (!def) { signaler(ctx, "format", 1, "arme inconnue : " + m.arme); return null; }
  const vic = cible.ac;
  if (!vic || ac.vivant !== 1 || vic.vivant !== 1) return null;
  const max = m.tete ? def.max_tete : def.max_corps;
  if (m.degats > max + 1) { signaler(ctx, "degats", 3, `${Math.round(m.degats)} dégâts au ${m.arme} (maximum ${max})`); return null; }
  const distance = ac.pos && vic.pos ? Math.hypot(ac.pos[0] - vic.pos[0], ac.pos[2] - vic.pos[2]) : 0;
  if (def.melee) {
    if (distance > def.portee + R.marge_portee_melee) { signaler(ctx, "couteau", 1, `coup à ${distance.toFixed(1)} m`); return null; }
    if (!cadence(ac, m.arme, m.h)) { signaler(ctx, "cadence", 2, `couteau : ${ac.tirs[m.arme].length} coups en ${R.fenetre_cadence_s} s`); return null; }
  } else {
    if (ac.tirArme !== m.arme || m.h - ac.tirH > R.delai_touche_apres_tir_ms || ac.credit <= 0) { signaler(ctx, "sans_tir", 2, `touche au ${m.arme} sans tir correspondant`); return null; }
    ac.credit--;
    if (distance > R.portee_max) { signaler(ctx, "portee", 1, `touche à ${Math.round(distance)} m`); return null; }
  }
  if (!def.melee && m.arme !== "pompe" && m.arme !== "sniper" && !ctx.client.bot) {
    const v = R.visee;
    ac.touches++;
    if (m.tete) {
      ac.tetes++;
      const l = ac.lacets;
      if (l.length >= 2) {
        const [h1, l1] = l[l.length - 2], [h2, l2] = l[l.length - 1];
        const dl = Math.abs((((l2 - l1 + 3 * Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
        const dt = Math.max(0.01, (h2 - h1) / 1000);
        if (dl >= v.angle_snap && dl / dt >= v.vitesse_snap) ac.snaps++;
      }
    }
    if (!ac.drapeaux.tete && ac.touches >= v.touches_min && ac.tetes / ac.touches > v.ratio_tete_max) {
      ac.drapeaux.tete = true;
      if (signaler(ctx, "visee_tete", 1, `${Math.round(100 * ac.tetes / ac.touches)} % de tirs à la tête sur ${ac.touches} touches`)) return null;
    }
    if (!ac.drapeaux.snap && ac.snaps >= v.snaps_min && ac.snaps / Math.max(1, ac.tetes) >= v.ratio_snap_max) {
      ac.drapeaux.snap = true;
      if (signaler(ctx, "visee_snap", 1, `${ac.snaps} tirs à la tête juste après un demi-tour instantané`)) return null;
    }
  }
  vic.degatsVie += m.degats;
  vic.recuDe[ctx.client.id] = maintenant();
  if (vic.depasseT === null && vic.degatsVie > R.degats_vie_max) vic.depasseT = maintenant();
  return m.degats;
}

// Élimination déclarée par la victime : renvoie l'id du tueur validé, ou null
function mort(ctx, tueur) {
  const ac = ctx.client.ac;
  const valide = tueur !== null && ac.recuDe[tueur] !== undefined && maintenant() - ac.recuDe[tueur] <= R.delai_kill_ms;
  if (tueur !== null && !valide) journal({ t: Math.floor(maintenant() / 1000), salon: ctx.salon.code, nom: ctx.client.nom, raison: "Élimination non justifiée refusée", detail: "attribuée à un autre joueur", points: ac.points, exclu: false });
  ac.vivant = 0; ac.reapparition = true; ac.degatsVie = 0; ac.depasseT = null; ac.recuDe = {};
  return valide ? tueur : null;
}

module.exports = { R, nouveau, empreinte, banni, etat, tir, touche, mort };
