// Profil du joueur (gardé dans ce navigateur) : niveau, XP, statistiques, succès, skins, viseur, personnage choisi.
// Le classement en ligne passe par api.php avec le compte du site (si le joueur est connecté).

import { herosValide } from "./heros.js";

export const SUCCES = {
  premiereVictoire: { nom: "Première victoire", texte: "Gagne une partie.", icone: "🏆" },
  premierSang: { nom: "Premier sang", texte: "Fais la première élimination d'une manche.", icone: "🩸" },
  ace: { nom: "ACE", texte: "Élimine les 5 ennemis dans une même manche.", icone: "🂡" },
  tireurElite: { nom: "Tireur d'élite", texte: "10 headshots dans une seule partie.", icone: "🎯" },
  artificier: { nom: "Artificier", texte: "Pose le spike.", icone: "💣" },
  demineur: { nom: "Démineur", texte: "Désamorce le spike.", icone: "🔧" },
  clutch: { nom: "Clutch", texte: "Gagne une manche en dernier survivant contre 2 ennemis ou plus.", icone: "🔥" },
  lame: { nom: "Lame silencieuse", texte: "Élimine un ennemi au couteau.", icone: "🔪" },
  sniper: { nom: "Œil de lynx", texte: "5 éliminations à l'Aiguille dans une partie.", icone: "🔭" },
  collectionneur: { nom: "Collectionneur", texte: "Élimine un ennemi avec chaque arme.", icone: "🧰" },
  champion: { nom: "Champion", texte: "Gagne un Deathmatch.", icone: "👑" },
  sansFaute: { nom: "Sans faute", texte: "Gagne une partie 5 à 0.", icone: "💎" },
  difficile: { nom: "Sans pitié", texte: "Gagne une partie en difficulté Difficile.", icone: "☠" },
  marathon: { nom: "Marathon", texte: "Joue 10 parties.", icone: "⏱" },
  veteran: { nom: "Vétéran", texte: "Atteins le niveau 10.", icone: "⭐" },
  stand: { nom: "Diplômé du stand", texte: "Termine les 4 défis du stand de tir.", icone: "🎓" },
};

// Skins débloqués selon le niveau
export const NIVEAUX_SKINS = { standard: 1, neon: 3, braise: 5, carbone: 7, arctique: 9, toxique: 12, or: 15 };

export const VISEUR_DEFAUT = { couleur: "#7cffd4", longueur: 7, epaisseur: 2, ecart: 4, point: true, contour: true, dynamique: true };

const CLE = "neonstrike-profil";

function profilVide() {
  return {
    pseudo: "", xp: 0, niveau: 1, agent: "kael", skins: {}, viseur: { ...VISEUR_DEFAUT },
    stats: { parties: 0, victoires: 0, kills: 0, morts: 0, tetes: 0, aces: 0, poses: 0, desamorcages: 0, manches: 0 },
    armes: {}, succes: {}, defis: {},
  };
}

export class Profil {
  constructor() {
    this.d = profilVide();
    try {
      const sauve = JSON.parse(localStorage.getItem(CLE) || "null");
      if (sauve) this.d = Profil.normaliser(sauve);
    } catch (e) { /* stockage indisponible */ }
    this.compte = null;
    this.surSauvegarde = null;
  }

  // Remet un profil (local ou venu du serveur) dans une forme sûre : bons types, valeurs par défaut
  static normaliser(brut) {
    const vide = profilVide();
    const objet = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
    const d = { ...vide, ...objet(brut) };
    d.stats = { ...vide.stats, ...objet(d.stats) };
    d.viseur = { ...VISEUR_DEFAUT, ...objet(d.viseur) };
    for (const k of ["skins", "succes", "defis", "armes"]) d[k] = { ...objet(d[k]) };
    d.xp = Math.max(0, Number(d.xp) || 0);
    d.niveau = Math.max(1, Math.floor(Number(d.niveau) || 1));
    d.pseudo = String(d.pseudo || "").slice(0, 16);
    d.agent = herosValide(typeof d.agent === "string" ? d.agent : vide.agent);
    return d;
  }

  sauver() {
    try { localStorage.setItem(CLE, JSON.stringify(this.d)); } catch (e) { /* stockage indisponible */ }
    if (this.surSauvegarde) this.surSauvegarde();
  }

  get pseudo() { return (this.compte && this.compte.pseudo) || this.d.pseudo || "Joueur"; }
  static xpNiveau(n) { return 400 + 100 * (n - 1); }
  get progression() { return this.d.xp / Profil.xpNiveau(this.d.niveau); }

  skinDebloque(id) { return this.d.niveau >= (NIVEAUX_SKINS[id] || 99); }

  gagnerXp(n) {
    const avant = this.d.niveau;
    this.d.xp += Math.max(0, Math.round(n));
    while (this.d.xp >= Profil.xpNiveau(this.d.niveau)) { this.d.xp -= Profil.xpNiveau(this.d.niveau); this.d.niveau++; }
    if (this.d.niveau >= 10) this.debloquer("veteran");
    return this.d.niveau - avant;
  }

  // Retourne true si le succès vient d'être débloqué
  debloquer(id) {
    if (!SUCCES[id] || this.d.succes[id]) return false;
    this.d.succes[id] = Date.now();
    this.nouveaux = this.nouveaux || [];
    this.nouveaux.push(id);
    return true;
  }

  prendreNouveaux() { const n = this.nouveaux || []; this.nouveaux = []; return n; }

  noterKillArme(arme) {
    this.d.armes[arme] = (this.d.armes[arme] || 0) + 1;
    if (["pistolet", "pompe", "fusil", "pulsar", "sniper", "couteau"].every((a) => this.d.armes[a])) this.debloquer("collectionneur");
  }

  // Fin de partie : statistiques, XP et succès. r : résultat de la partie.
  terminerPartie(r) {
    const s = this.d.stats;
    let xp = 0;
    if (r.mode === "stand") {
      xp = r.termine ? 40 : 10;
      const def = r.defi;
      if (def && def !== "libre" && r.termine) {
        const ancien = this.d.defis[def];
        const meilleur = ancien === undefined || (r.typeScore === "temps" ? r.score < ancien : r.score > ancien);
        if (meilleur) { this.d.defis[def] = r.score; xp += 20; r.record = true; }
        if (["reflexes", "mobiles", "tetes", "sniper"].every((k) => this.d.defis[k] !== undefined)) this.debloquer("stand");
      }
    } else {
      s.parties++;
      s.kills += r.kills; s.morts += r.morts; s.tetes += r.tetes; s.aces += r.aces || 0;
      s.poses += r.poses || 0; s.desamorcages += r.desamorcages || 0; s.manches += r.manchesGagnees || 0;
      if (r.victoire) s.victoires++;
      if (r.mode === "deathmatch") xp = r.kills * 6 + (r.victoire ? 120 : 40);
      else xp = (r.manchesGagnees || 0) * 20 + r.kills * 8 + r.tetes * 4 + (r.aces || 0) * 30 + (r.victoire ? 150 : 60);
      if (r.victoire) this.debloquer("premiereVictoire");
      if (r.victoire && r.mode === "deathmatch") this.debloquer("champion");
      if (r.victoire && r.scoreEux === 0 && r.mode !== "deathmatch") this.debloquer("sansFaute");
      if (r.victoire && r.difficulte === "difficile") this.debloquer("difficile");
      if (r.tetes >= 10) this.debloquer("tireurElite");
      if ((r.killsSniper || 0) >= 5) this.debloquer("sniper");
      if (s.parties >= 10) this.debloquer("marathon");
    }
    const niveaux = this.gagnerXp(xp);
    this.sauver();
    return { xp, niveaux };
  }
}

// ----- Classement en ligne (comptes du site) -----
const ENTETES = { "X-Requested-With": "neonstrike" };

export async function etatCompte() {
  try {
    const r = await fetch("api.php?action=etat", { headers: ENTETES, credentials: "same-origin" });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}

export async function envoyerResultat(resultat) {
  try {
    const r = await fetch("api.php?action=resultat", {
      method: "POST", credentials: "same-origin",
      headers: { ...ENTETES, "Content-Type": "application/json" },
      body: JSON.stringify(resultat),
    });
    return r.ok ? await r.json() : null;
  } catch (e) { return null; }
}

export async function classement() {
  try {
    const r = await fetch("api.php?action=classement", { headers: ENTETES, credentials: "same-origin" });
    return r.ok ? await r.json() : null;
  } catch (e) { return null; }
}

// ----- Compte du site depuis le jeu -----
async function appelApi(action, corps = null) {
  try {
    const r = await fetch("api.php?action=" + action, {
      method: corps ? "POST" : "GET", credentials: "same-origin",
      headers: corps ? { ...ENTETES, "Content-Type": "application/json" } : ENTETES,
      body: corps ? JSON.stringify(corps) : undefined,
    });
    const donnees = await r.json().catch(() => ({}));
    return r.ok ? donnees : { erreur: donnees.erreur || "Le serveur ne répond pas (" + r.status + ")." };
  } catch (e) { return { erreur: "Connexion impossible : le compte ne marche que sur le site en ligne." }; }
}

export const connexion = (identifiant, mdp) => appelApi("connexion", { identifiant, mdp });
export const inscription = (pseudo, email, mdp) => appelApi("inscription", { pseudo, email, mdp });
export const deconnexion = () => appelApi("deconnexion", {});
export const chargerSauvegarde = () => appelApi("profil");
export const envoyerSauvegarde = (donnees) => appelApi("sauver", donnees);
