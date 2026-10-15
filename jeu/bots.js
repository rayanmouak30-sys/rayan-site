// Bots : coéquipiers et adversaires. Vision réelle (murs + fumées), réaction, rafales, couverture,
// communication, stratégie d'équipe (rassemblement, exécution d'un site, pose / désamorçage du spike),
// ordres donnés par le joueur à ses alliés, deathmatch et mannequins du stand de tir.
import { rayonSphere, rayonCylindre } from "./physique.js";
import { Personnage } from "./personnages.js";
import { ARMES, facteurDistance } from "./armes.js";
import { HEROS, LISTE_HEROS } from "./heros.js";
import { CAPACITES, nouvelEtatCapacites, majRecharges } from "./capacites.js";

export const DIFFICULTES = {
  facile: { nom: "Facile", reaction: 0.85, erreur: 3.3, convergence: 1.7, tete: 0.04, rafale: [2, 3], facteurDegats: 0.34, vitesseDetection: 0.75, cadence: 0.19, ouie: 0.6, couvert: 0.3, pause: [0.6, 1.1], rotation: 4.5, utilitaires: 0.1 },
  normal: { nom: "Normal", reaction: 0.58, erreur: 2.1, convergence: 1.15, tete: 0.1, rafale: [2, 4], facteurDegats: 0.5, vitesseDetection: 1.1, cadence: 0.15, ouie: 0.85, couvert: 0.5, pause: [0.45, 0.9], rotation: 6.5, utilitaires: 0.3 },
  difficile: { nom: "Difficile", reaction: 0.38, erreur: 1.2, convergence: 0.75, tete: 0.22, rafale: [3, 5], facteurDegats: 0.7, vitesseDetection: 1.6, cadence: 0.13, ouie: 1.1, couvert: 0.75, pause: [0.3, 0.6], rotation: 9.5, utilitaires: 0.55 },
};

const DEG = Math.PI / 180;
export const NOMS = ["Vipère", "Écho", "Spectre", "Volt", "Cendre", "Givre", "Néon", "Orage", "Rafale", "Comète", "Nova", "Brume", "Titan", "Lynx", "Onyx", "Zénith", "Kira", "Ombre"];

function angleVers(dx, dz) { return Math.atan2(dx, dz); }
function diffAngle(a, b) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
const alea = (a, b) => a + Math.random() * (b - a);

// Un tir (rayon) touche-t-il ce combattant ? Tête = sphère, corps et jambes = cylindre.
export function toucherCombattant(c, ox, oy, oz, dx, dy, dz, tMax) {
  let best = null;
  const tT = rayonSphere(ox, oy, oz, dx, dy, dz, c.x, c.yeux + 0.07, c.z, 0.17);
  if (tT >= 0 && tT < tMax) best = { t: tT, partie: "tete" };
  const corps = rayonCylindre(ox, oy, oz, dx, dy, dz, c.x, c.z, 0.3, c.y, c.yeux - 0.1);
  if (corps && corps.t < tMax && (!best || corps.t < best.t - 0.02)) best = { t: corps.t, partie: corps.y - c.y < (c.yeux - c.y) * 0.5 ? "jambes" : "corps" };
  return best;
}

// Dégâts avec armure : le bouclier encaisse 66 % des dégâts tant qu'il en reste.
export function appliquerDegats(c, degats) {
  const absorbe = Math.min(c.armure || 0, degats * 0.66);
  c.armure = (c.armure || 0) - absorbe;
  const reel = Math.min(c.vie, degats - absorbe);
  c.vie -= degats - absorbe;
  return reel + absorbe;
}

class Bot {
  constructor(o) {
    Object.assign(this, {
      id: o.id, nom: o.nom, equipe: o.equipe, heros: o.heros || "kael", teinte: o.teinte || "neutre", mannequin: !!o.mannequin,
      taille: (HEROS[o.heros] && !o.mannequin ? HEROS[o.heros].apparence.taille : 1) || 1, capacites: null, capaciteT: 2,
      ruee: null, charge: null, chargeur: null,
      estJoueur: false, modele: null, x: 0, z: 0, y: 0, vx: 0, vz: 0, auSol: true, yaw: Math.PI, pitch: 0,
      vie: 100, armure: 0, vivant: false, mortT: 0, arme: o.arme || "fusil",
      etat: "attente", etatT: 0, objectif: null, chemin: null, iChemin: 0, bloqueT: 0,
      vitesse: 0, vitesseCible: 0, lacetCible: Math.PI, dirMouvement: { x: 0, z: 1 },
      cible: null, cibleVue: null, conscience: 0, voit: false, perduT: 0, derniereVue: null, testVueT: Math.random() * 0.1,
      reactionT: 0, erreurVisee: 0, rafale: 0, prochainTir: 0, pauseT: 0, lateralT: 0, lateral: 1,
      mun: 25, rechargeT: 0, dureeRecharge: 2, couvertFait: false, retourPeek: null, pasT: 0,
      agressif: false, pousseeT: 30, regardT: 0, regardDecalage: 0, redecideT: 0, aveugleT: 0, reveleT: 0,
      poseT: 0, desamorceT: 0, indice: 0, credits: 800, kills: 0, morts: 0, assists: 0, degats: 0, ultime: 0,
      fumees: 0, flashs: 0, utilitaireT: 0, rotation: null, tenir: null, pointSite: null, roam: null,
      mannequinOrigine: null, mannequinAmp: 0, mannequinVitesse: 0, mannequinPhase: 0, poste: null,
    });
  }
  get yeux() { return this.y + 1.6 * this.taille; }
}

export class GestionBots {
  constructor(scene, carte, audio, qualite = "moyenne") {
    this.qualite = qualite;
    this.diff = DIFFICULTES.normal;
    this.scene = scene;
    this.carte = carte;
    this.audio = audio;
    this.liste = [];
    this.joueur = null;          // combattant du joueur (getters x, z, y, yeux, vx, vz, equipe, vivant, nom)
    this.competences = null;     // fumées (bloquent la vue), flashs lancés par les bots
    this.mode = "elimination";
    this.spike = null;           // état du spike (règles)
    this.camps = { bleu: "attaque", rouge: "defense" };
    this.strategie = { bleu: this.nouvelleStrategie(), rouge: this.nouvelleStrategie() };
    this.ordres = { bleu: null, rouge: null };
    this.surTir = null;          // (bot, depart, arrivee, touche{cible, degats, partie} | null, mur, plomb)
    this.surMort = null;         // (victime, tueur, tete, arme)
    this.surBlessure = null;     // (victime, degats, auteur, tete)
    this.surSite = null;         // (equipe, site) : un attaquant est repéré sur un site
    this.prochainId = 1;
    this.phase = "preparation";
  }

  nouvelleStrategie() {
    return { site: Math.random() < 0.5 ? "A" : "B", phase: "rassemblement", t: 0, chasse: false, calmeT: 0, fumeeLancee: false };
  }

  // ----- Création et placement -----
  ajouter(o) {
    const heros = o.heros || (o.mannequin ? "mannequin" : LISTE_HEROS[Math.floor(Math.random() * LISTE_HEROS.length)].id);
    const b = new Bot({ ...o, heros, id: "b" + this.prochainId++ });
    if (!b.mannequin) b.capacites = nouvelEtatCapacites(heros, !!o.economie);
    this.liste.push(b);
    return b;
  }

  retirer(b) {
    if (b.modele) this.scene.remove(b.modele.racine);
    this.liste = this.liste.filter((x) => x !== b);
  }

  vider() {
    for (const b of this.liste) if (b.modele) this.scene.remove(b.modele.racine);
    this.liste = [];
  }

  // Met le bot en jeu (début de manche ou réapparition) avec son arme.
  placer(b, x, z, yaw = Math.PI) {
    if (!b.modele || b.modele.armeId !== b.arme || b.modele.heros !== (b.mannequin ? "mannequin" : b.heros)) {
      if (b.modele) this.scene.remove(b.modele.racine);
      b.modele = new Personnage(b.mannequin ? "mannequin" : b.heros, b.mannequin ? "mannequin" : b.teinte, this.qualite, b.arme);
      this.scene.add(b.modele.racine);
    } else b.modele.ressusciter();
    const def = ARMES[b.arme];
    Object.assign(b, {
      x, z, y: 0, vx: 0, vz: 0, yaw, lacetCible: yaw, pitch: 0, vie: 100, vivant: true, mortT: 0,
      etat: "attente", etatT: 0, objectif: null, chemin: null, cible: null, cibleVue: null, conscience: 0, voit: false,
      derniereVue: null, reactionT: 0, rafale: 0, prochainTir: 0, pauseT: 0, mun: def.chargeur || 1, rechargeT: 0,
      couvertFait: false, retourPeek: null, aveugleT: 0, reveleT: 0, poseT: 0, desamorceT: 0, rotation: null, tenir: null,
      pointSite: null, roam: null, vitesse: 0, agressif: Math.random() < 0.35, pousseeT: alea(18, 40), redecideT: alea(0.2, 1),
      utilitaireT: alea(3, 10), bruit: null, veutCouvert: false, ruee: null, charge: null, capaciteT: alea(1.5, 4),
    });
    if (this.competences) this.competences.reinitialiserStatuts(b);
    b.modele.racine.position.set(x, 0, z);
    b.modele.racine.rotation.y = yaw;
    b.modele.racine.visible = true;
  }

  vivants(equipe = null) { return this.liste.filter((b) => b.vivant && !b.mannequin && (!equipe || b.equipe === equipe)); }

  combattants() {
    const l = this.liste.filter((b) => !b.mannequin);
    return this.joueur ? [this.joueur, ...l] : l;
  }

  estEnnemi(a, c) {
    if (a === c) return false;
    if (this.mode === "deathmatch" && !this.equipes) return true;   // en ligne par équipes : deathmatch entre équipes
    return a.equipe !== c.equipe;
  }

  ennemisDe(b) { return this.combattants().filter((c) => c.vivant && this.estEnnemi(b, c)); }

  nouvelleManche(phase) {
    this.phase = phase;
    this.strategie = { bleu: this.nouvelleStrategie(), rouge: this.nouvelleStrategie() };
    for (const e of ["bleu", "rouge"]) if (this.ordres[e] && this.ordres[e].type !== "site") this.ordres[e] = null;
    if (this.ordres.bleu && this.ordres.bleu.type === "site") this.strategie.bleu.site = this.ordres.bleu.site;
    // Les défenseurs se répartissent sur les postes : au moins un par site et un au milieu.
    for (const equipe of ["bleu", "rouge"]) {
      if (this.camps[equipe] !== "defense") continue;
      const postes = [...this.carte.postes].sort(() => Math.random() - 0.5);
      const parZone = { A: [], B: [], MID: [] };
      for (const p of postes) (parZone[p.zone] || parZone.MID).push(p);
      const choix = [parZone.A.pop(), parZone.B.pop(), parZone.MID.pop(), ...parZone.A, ...parZone.B, ...parZone.MID].filter(Boolean);
      let i = 0;
      for (const b of this.liste) if (b.equipe === equipe && !b.mannequin) { b.poste = choix[i++ % Math.max(1, choix.length)] || null; b.indice = i; }
    }
    for (const equipe of ["bleu", "rouge"]) {
      let i = 0;
      for (const b of this.liste) if (b.equipe === equipe && !b.mannequin && this.camps[equipe] === "attaque") b.indice = i++;
    }
  }

  // Ordres du joueur à ses coéquipiers
  ordonner(equipe, ordre) {
    this.ordres[equipe] = ordre;
    const strat = this.strategie[equipe];
    if (ordre && ordre.type === "site") {
      strat.site = ordre.site;
      if (this.camps[equipe] === "attaque") { strat.phase = "execute"; for (const b of this.liste) if (b.equipe === equipe) b.pointSite = null; }
      else for (const b of this.liste) if (b.equipe === equipe) b.rotation = ordre.site;
    }
    for (const b of this.liste) {
      if (b.equipe !== equipe || !b.vivant || b.mannequin) continue;
      if (ordre && ordre.type === "tenir") b.tenir = { x: b.x, z: b.z };
      else b.tenir = null;
      if (b.etat !== "combat" && b.etat !== "couvert" && b.etat !== "pose" && b.etat !== "desamorce") this.decider(b);
    }
  }

  // ----- Perception -----
  vueLibre(ax, ay, az, bx, by, bz) {
    if (!this.carte.monde.ligneLibre(ax, ay, az, bx, by, bz)) return false;
    if (this.competences && this.competences.fumeeBloque(ax, ay, az, bx, by, bz)) return false;
    return true;
  }

  peutVoir(b, c) {
    return this.vueLibre(b.x, b.yeux, b.z, c.x, c.yeux, c.z) || this.vueLibre(b.x, b.yeux, b.z, c.x, c.yeux - 0.55, c.z);
  }

  percevoir(b) {
    if (b.aveugleT > 0) { b.voit = false; b.cibleVue = null; return; }
    let meilleur = null, score = Infinity;
    for (const c of this.ennemisDe(b)) {
      const dx = c.x - b.x, dz = c.z - b.z, d = Math.hypot(dx, dz);
      if (d > 70) continue;
      if (this.competences && this.competences.invisible(c) && d > 3.5) continue;
      const champ = (b.conscience >= 1 ? 85 : 55) * DEG;
      if (d > 3 && Math.abs(diffAngle(b.yaw, angleVers(dx, dz))) > champ) continue;
      if (!this.peutVoir(b, c)) continue;
      const s = d * (c === b.cible ? 0.6 : 1);
      if (s < score) { score = s; meilleur = c; }
    }
    b.voit = !!meilleur;
    b.cibleVue = meilleur;
  }

  // Un bruit (tir, pas) entendu par les adversaires de "source"
  entendre(x, z, rayon, source = null) {
    rayon *= this.diff.ouie;
    for (const b of this.liste) {
      if (!b.vivant || b.mannequin || b.etat === "combat" || b.etat === "couvert") continue;
      if (source && !this.estEnnemi(b, source)) continue;
      const d = Math.hypot(b.x - x, b.z - z);
      if (d > rayon) continue;
      b.bruit = { x, z, t: 2.5 };
      b.conscience = Math.max(b.conscience, 0.35);
      if (b.etat === "pose" || b.etat === "desamorce" || b.tenir) continue;
      const tresProche = d < 11;
      if ((tresProche || (b.agressif && Math.random() < 0.25)) && b.etat !== "chasse") this.chasser(b, x, z, !tresProche);
    }
  }

  // Information partagée : position ennemie connue de toute une équipe (drone, sonar, appel radio)
  informer(equipe, x, z) {
    for (const b of this.liste) {
      if (b.equipe !== equipe || !b.vivant || b.mannequin) continue;
      b.derniereVue = { x, z };
      b.conscience = Math.max(b.conscience, 0.6);
      if (b.etat === "garde") b.lacetCible = angleVers(x - b.x, z - b.z);
    }
  }

  // Un bot qui repère un ennemi prévient ses coéquipiers proches.
  alerter(source, x, z) {
    for (const b of this.liste) {
      if (b === source || !b.vivant || b.mannequin || b.etat === "combat" || b.etat === "couvert" || b.etat === "pose" || b.etat === "desamorce") continue;
      if (this.mode !== "deathmatch" && b.equipe !== source.equipe) continue;
      if (this.mode === "deathmatch" || b.tenir) continue;
      if (Math.hypot(b.x - source.x, b.z - source.z) > 26) continue;
      if (Math.random() < 0.6) { b.alerteT = alea(0.4, 1.2); b.alerte = { x, z }; }
    }
    // Repérage d'un attaquant sur un site : les défenseurs tournent
    if (this.mode !== "deathmatch" && this.camps[source.equipe] === "defense") {
      for (const [nom, s] of Object.entries(this.carte.sites)) {
        if (x > s.minX - 3 && x < s.maxX + 3 && z > s.minZ - 3 && z < s.maxZ + 3) { if (this.surSite) this.surSite(source.equipe, nom); this.tourner(source.equipe, nom); break; }
      }
    }
  }

  tourner(equipe, site) {
    for (const b of this.liste) {
      if (b.equipe !== equipe || !b.vivant || b.mannequin || b.rotation || b.tenir) continue;
      if (b.poste && b.poste.zone === site) continue;
      if (Math.random() < 0.5) b.rotation = site;
    }
  }

  chasser(b, x, z, courir = true) {
    b.objectif = { type: "chasse", x, z };
    this.allerVers(b, x, z, "chasse", courir);
  }

  allerVers(bot, x, z, etat, courir = true) {
    bot.chemin = this.carte.nav.chemin(bot.x, bot.z, x, z);
    bot.iChemin = 0;
    bot.etat = etat;
    bot.etatT = 0;
    bot.vitesseCible = courir ? Math.min(4.8, ARMES[bot.arme].vitesse || 4.4) : 2.7;
    bot.bloqueT = 0;
    bot.arriveT = null;
  }

  // ----- Objectifs (macro) -----
  plusProcheDe(equipe, x, z, filtre = () => true) {
    let meilleur = null, dMin = Infinity;
    for (const b of this.liste) {
      if (b.equipe !== equipe || !b.vivant || b.mannequin || !filtre(b)) continue;
      const d = Math.hypot(b.x - x, b.z - z);
      if (d < dMin) { dMin = d; meilleur = b; }
    }
    return meilleur;
  }

  objectif(b) {
    const carte = this.carte, spike = this.spike, L = carte.limites;
    if (this.mode === "deathmatch") {
      if (!b.roam || Math.hypot(b.roam.x - b.x, b.roam.z - b.z) < 2) b.roam = carte.nav.aleatoire(Math.random, { minX: L.minX + 2, maxX: L.maxX - 2, minZ: L.minZ + 2, maxZ: L.maxZ - 2 });
      return b.roam ? { type: "roam", x: b.roam.x, z: b.roam.z, courir: Math.random() < 0.7 } : null;
    }
    const camp = this.camps[b.equipe];
    const ordre = this.ordres[b.equipe];
    const strat = this.strategie[b.equipe];
    const joueur = this.joueur;

    if (this.mode === "spike" && spike) {
      if (spike.etat === "pose") {
        if (camp === "attaque") {
          const postes = carte.apresPose[spike.site] || [];
          const p = postes.length ? postes[b.indice % postes.length] : { x: spike.x, z: spike.z };
          return { type: "apresPose", x: p.x, z: p.z, vise: { x: spike.x, z: spike.z } };
        }
        const desamorceur = this.plusProcheDe(b.equipe, spike.x, spike.z);
        const joueurDesamorce = joueur && joueur.vivant && joueur.equipe === b.equipe && Math.hypot(joueur.x - spike.x, joueur.z - spike.z) < 4;
        if (desamorceur === b && !joueurDesamorce) return { type: "desamorcer", x: spike.x, z: spike.z };
        if (!b.pointReprise) { const a = Math.random() * Math.PI * 2; b.pointReprise = { x: spike.x + Math.cos(a) * 4, z: spike.z + Math.sin(a) * 4 }; }
        return { type: "reprise", x: b.pointReprise.x, z: b.pointReprise.z, vise: { x: spike.x, z: spike.z } };
      }
      if (camp === "attaque") {
        if (spike.etat === "sol") {
          const joueurProche = joueur && joueur.vivant && joueur.equipe === b.equipe;
          const ramasseur = this.plusProcheDe(b.equipe, spike.x, spike.z);
          if (ramasseur === b && !(joueurProche && Math.hypot(joueur.x - spike.x, joueur.z - spike.z) < Math.hypot(b.x - spike.x, b.z - spike.z))) return { type: "ramasser", x: spike.x, z: spike.z };
        }
        if (spike.porteur === b && strat.phase === "execute") {
          const s = carte.sites[strat.site];
          if (!b.pointPose) b.pointPose = { x: s.x + alea(-1.5, 1.5), z: s.z + alea(-1.5, 1.5) };
          return { type: "poser", x: b.pointPose.x, z: b.pointPose.z };
        }
      }
    }

    if (ordre && joueur && b.equipe === joueur.equipe) {
      if (ordre.type === "suivre" && joueur.vivant) {
        const a = (b.indice % 4) * 1.4 - 2.1;
        const s = Math.sin(joueur.lacet || 0), c = Math.cos(joueur.lacet || 0);
        const x = joueur.x + s * 2.6 + c * a * 0.8, z = joueur.z + c * 2.6 - s * a * 0.8;
        return { type: "suivre", x, z, courir: Math.hypot(x - b.x, z - b.z) > 5 };
      }
      if (ordre.type === "tenir" && b.tenir) return { type: "tenir", x: b.tenir.x, z: b.tenir.z };
    }

    if (camp === "attaque") {
      const site = carte.sites[strat.site];
      if (!site) return null;
      if (strat.phase === "rassemblement") {
        const r = carte.rassemblement[strat.site];
        const a = b.indice * 2.1;
        return { type: "rassemblement", x: r.x + Math.cos(a) * 1.6, z: r.z + Math.sin(a) * 1.2, vise: { x: site.x, z: site.z } };
      }
      if (this.mode === "elimination" && strat.chasse) {
        if (!b.roam || Math.hypot(b.roam.x - b.x, b.roam.z - b.z) < 2) b.roam = carte.pointDans(carte.zoneDepartBots);
        return { type: "chasse", x: b.roam.x, z: b.roam.z, courir: false };
      }
      if (!b.pointSite) b.pointSite = carte.pointDans(site);
      const dz = carte.zoneDepartBots;
      return { type: "site", x: b.pointSite.x, z: b.pointSite.z, vise: { x: (dz.minX + dz.maxX) / 2, z: (dz.minZ + dz.maxZ) / 2 } };
    }

    // Défense
    const siteRot = b.rotation || (ordre && ordre.type === "site" ? ordre.site : null);
    if (siteRot && (!b.poste || b.poste.zone !== siteRot)) {
      const postes = carte.postes.filter((p) => p.zone === siteRot);
      if (postes.length) { const p = postes[b.indice % postes.length]; return { type: "poste", x: p.x, z: p.z, vise: p.vise }; }
    }
    if (b.poste) return { type: "poste", x: b.poste.x, z: b.poste.z, vise: b.poste.vise };
    return null;
  }

  decider(b) {
    const o = this.objectif(b);
    b.redecideT = alea(0.8, 1.6);
    if (!o) { b.etat = "garde"; b.etatT = 0; b.objectif = null; return; }
    b.objectif = o;
    if (Math.hypot(o.x - b.x, o.z - b.z) < 0.9) { this.arriver(b); return; }
    this.allerVers(b, o.x, o.z, "deplacement", o.courir !== false);
  }

  arriver(b) {
    const o = b.objectif;
    b.chemin = null;
    b.vitesseCible = 0;
    b.etatT = 0;
    if (!o) { b.etat = "garde"; return; }
    if (o.type === "poser" && this.spike && this.spike.porteur === b) { b.etat = "pose"; b.poseT = 0; return; }
    if (o.type === "desamorcer" && this.spike && this.spike.etat === "pose") { b.etat = "desamorce"; return; }
    if (o.type === "roam") { b.roam = null; this.decider(b); return; }
    b.etat = "garde";
    b.vise = o.vise || null;
  }

  // ----- Dégâts reçus -----
  blesser(bot, degats, auteur, tete, arme = null) {
    if (!bot.vivant) return false;
    const reel = appliquerDegats(bot, degats);
    if (auteur && auteur.degats !== undefined) auteur.degats += reel;
    if (this.surBlessure) this.surBlessure(bot, reel, auteur, tete);
    if (bot.mannequin) { if (bot.vie <= 0) this.tuer(bot, auteur, tete, arme); return bot.vie <= 0; }
    if (bot.vie <= 0) { this.tuer(bot, auteur, tete, arme); return true; }
    const depuisX = auteur ? auteur.x : bot.x, depuisZ = auteur ? auteur.z : bot.z + 1;
    const ix = bot.x - depuisX, iz = bot.z - depuisZ, il = Math.hypot(ix, iz) || 1;
    const s = Math.sin(bot.yaw), c = Math.cos(bot.yaw);
    bot.modele.impact((ix * c - iz * s) / il, (ix * s + iz * c) / il, tete);
    bot.lacetCible = angleVers(depuisX - bot.x, depuisZ - bot.z);
    bot.derniereVue = { x: depuisX, z: depuisZ };
    if (bot.etat !== "combat" && bot.etat !== "couvert" && auteur && auteur.vivant) {
      bot.conscience = 1;
      bot.reactionT = this.diff.reaction * 0.7;
      bot.erreurVisee = this.diff.erreur * 1.6;
      bot.etat = "combat";
      bot.etatT = 0;
      bot.cible = auteur;
      bot.chemin = null;
    }
    if (bot.vie < 45 && !bot.couvertFait && Math.random() < this.diff.couvert) bot.veutCouvert = true;
    return false;
  }

  tuer(bot, tueur, tete, arme) {
    bot.vivant = false;
    bot.vie = 0;
    bot.mortT = 0;
    bot.morts++;
    bot.vitesse = 0;
    bot.modele.mourir(Math.sign(Math.random() - 0.5));
    if (this.surMort) this.surMort(bot, tueur, tete, arme);
  }

  // Balles d'un tireur (joueur ou bot) : premier combattant adverse touché avant tMax.
  toucher(tireur, ox, oy, oz, dx, dy, dz, tMax) {
    let meilleur = null;
    for (const b of this.liste) {
      if (!b.vivant) continue;
      if (tireur && !b.mannequin && !this.estEnnemi(tireur, b)) continue;
      const h = toucherCombattant(b, ox, oy, oz, dx, dy, dz, meilleur ? meilleur.t : tMax);
      if (h && (!meilleur || h.t < meilleur.t)) meilleur = { cible: b, bot: b, t: h.t, partie: h.partie };
    }
    return meilleur;
  }

  // ----- Boucle -----
  maj(dt, temps, phase) {
    this.phase = phase;
    const actif = phase === "combat" || phase === "spike";
    // Stratégie des équipes à l'attaque : rassemblement puis exécution du site
    for (const equipe of ["bleu", "rouge"]) {
      const strat = this.strategie[equipe];
      if (!actif) continue;
      strat.t += dt;
      if (this.camps[equipe] === "attaque" && strat.phase === "rassemblement") {
        const membres = this.liste.filter((b) => b.equipe === equipe && b.vivant && !b.mannequin && !b.tenir);
        const prets = membres.filter((b) => b.objectif && b.objectif.type === "rassemblement" && b.etat === "garde").length;
        if (strat.t > 22 || (membres.length && prets >= Math.ceil(membres.length * 0.75) && strat.t > 6)) {
          strat.phase = "execute";
          for (const b of membres) if (b.etat === "garde" || b.etat === "deplacement") this.decider(b);
          this.utilitairesExecution(equipe);
        }
      }
      if (this.mode === "elimination" && this.camps[equipe] === "attaque" && strat.phase === "execute") {
        const voient = this.liste.some((b) => b.equipe === equipe && b.vivant && b.voit);
        strat.calmeT = voient ? 0 : strat.calmeT + dt;
        if (!strat.chasse && strat.calmeT > 12 && strat.t > 30) { strat.chasse = true; for (const b of this.liste) if (b.equipe === equipe && b.etat === "garde") this.decider(b); }
      }
    }

    for (const b of this.liste) {
      if (b.distant) { this.majDistant(b, dt); continue; }
      if (!b.vivant) { this.animerMort(b, dt); continue; }
      if (this.competences && !b.mannequin) this.competences.majStatuts(b, dt);
      if (b.mannequin) this.mannequin(b, dt, temps);
      else if (actif) this.penser(b, dt, temps);
      else this.preparer(b, dt);
      this.deplacer(b, dt);
      this.animer(b, dt);
    }
    // Les bots ne se marchent pas dessus
    const v = this.liste.filter((b) => b.vivant);
    for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) {
      const a = v[i], c = v[j];
      const dx = c.x - a.x, dz = c.z - a.z, d = Math.hypot(dx, dz);
      if (d > 0.001 && d < 0.75) {
        const p = (0.75 - d) / 2;
        const nx = dx / d * p, nz = dz / d * p;
        if (!this.carte.monde.bloque(a.x - nx, a.z - nz, 0, 0.35)) { a.x -= nx; a.z -= nz; }
        if (!this.carte.monde.bloque(c.x + nx, c.z + nz, 0, 0.35)) { c.x += nx; c.z += nz; }
      }
    }
  }

  // Phase de préparation : les défenseurs s'installent, les attaquants attendent derrière la barrière.
  preparer(b, dt) {
    b.etatT += dt;
    if (this.mode === "deathmatch") return;
    if (this.camps[b.equipe] === "defense" && b.etat === "attente" && b.etatT > 0.6) this.decider(b);
    else if (b.etat === "deplacement" && (!b.chemin || b.iChemin >= b.chemin.length)) this.arriver(b);
    else if (b.etat === "deplacement" && b.chemin && b.chemin[b.iChemin]) b.lacetCible = angleVers(b.chemin[b.iChemin].x - b.x, b.chemin[b.iChemin].z - b.z);
    if (this.camps[b.equipe] === "attaque") b.vitesseCible = 0;
    if (b.etat === "garde") this.garder(b, dt);
  }

  mannequin(b, dt, temps) {
    b.vitesseCible = 0;
    if (b.mannequinAmp > 0) {
      const o = b.mannequinOrigine;
      const cible = o.x + Math.sin(temps * b.mannequinVitesse + b.mannequinPhase) * b.mannequinAmp;
      const dx = cible - b.x;
      b.mouvementForce = { x: Math.sign(dx), z: 0 };
      b.vitesseCible = Math.min(4.5, Math.abs(dx) * 6);
    }
    b.lacetCible = 0;
  }

  garder(b, dt) {
    b.vitesseCible = 0;
    const vise = b.vise ? angleVers(b.vise.x - b.x, b.vise.z - b.z) : b.yaw;
    b.regardT -= dt;
    if (b.regardT <= 0) { b.regardT = alea(1.2, 3.5); b.regardDecalage = alea(-28, 28) * DEG; }
    b.lacetCible = vise + b.regardDecalage;
    if (b.bruit && b.bruit.t > 0) { b.bruit.t -= dt; b.lacetCible = angleVers(b.bruit.x - b.x, b.bruit.z - b.z); }
  }

  penser(b, dt, temps) {
    const diff = this.diff;
    b.etatT += dt;
    if (b.capacites) majRecharges(b.capacites, dt);
    this.utiliserCapacites(b, dt);
    if (b.aveugleT > 0) b.aveugleT -= dt;
    b.testVueT -= dt;
    if (b.testVueT <= 0) { b.testVueT = 0.1; this.percevoir(b); }
    if (b.alerteT !== undefined && b.alerteT > 0) {
      b.alerteT -= dt;
      if (b.alerteT <= 0 && b.alerte && b.etat !== "combat" && b.etat !== "couvert" && b.etat !== "pose" && b.etat !== "desamorce") this.chasser(b, b.alerte.x, b.alerte.z, true);
    }

    if (b.voit) {
      const c = b.cibleVue;
      const dx = c.x - b.x, dz = c.z - b.z, d = Math.hypot(dx, dz);
      const centre = 1 - Math.min(1, Math.abs(diffAngle(b.yaw, angleVers(dx, dz))) / (60 * DEG)) * 0.6;
      const bouge = Math.hypot(c.vx, c.vz) > 1 ? 1.4 : 1;
      b.conscience += dt * diff.vitesseDetection * centre * bouge * (1.6 - Math.min(d, 50) / 40) * 2.2;
      b.derniereVue = { x: c.x, z: c.z };
      b.perduT = 0;
      if (b.etat === "combat") b.cible = c;
      if (b.conscience >= 1 && b.etat !== "combat" && b.etat !== "couvert") {
        b.conscience = 1;
        b.etat = "combat";
        b.etatT = 0;
        b.chemin = null;
        b.cible = c;
        b.reactionT = diff.reaction * alea(0.85, 1.3) + (ARMES[b.arme].bot && ARMES[b.arme].bot.reactionBonus || 0);
        b.erreurVisee = diff.erreur * 2;
        this.alerter(b, c.x, c.z);
      } else if (b.conscience < 1 && b.etat !== "pose" && b.etat !== "desamorce") {
        b.lacetCible = b.yaw + diffAngle(b.yaw, angleVers(dx, dz)) * 0.5;
      }
    } else {
      b.perduT += dt;
      if (b.etat !== "combat") b.conscience = Math.max(0, b.conscience - dt * 0.25);
    }

    switch (b.etat) {
      case "attente":
        this.decider(b);
        break;
      case "deplacement": {
        if (b.chemin && b.chemin[b.iChemin]) {
          const p = b.chemin[b.iChemin];
          b.lacetCible = angleVers(p.x - b.x, p.z - b.z);
          if (b.bruit && b.bruit.t > 0) { b.bruit.t -= dt; b.lacetCible = angleVers(b.bruit.x - b.x, b.bruit.z - b.z); }
        }
        if (!b.chemin || b.iChemin >= b.chemin.length) this.arriver(b);
        b.redecideT -= dt;
        if (b.redecideT <= 0) {
          const o = this.objectif(b);
          b.redecideT = b.objectif && b.objectif.type === "suivre" ? 0.8 : 2;
          if (o && (!b.objectif || o.type !== b.objectif.type || Math.hypot(o.x - b.objectif.x, o.z - b.objectif.z) > 2.5)) this.decider(b);
        }
        break;
      }
      case "garde": {
        this.garder(b, dt);
        b.redecideT -= dt;
        if (b.redecideT <= 0) {
          const o = this.objectif(b);
          b.redecideT = alea(0.8, 1.6);
          if (o && (!b.objectif || o.type !== b.objectif.type || Math.hypot(o.x - b.x, o.z - b.z) > 2.5)) this.decider(b);
        }
        // Certains défenseurs vont chercher le combat au bout d'un moment.
        if (this.mode !== "deathmatch" && this.camps[b.equipe] === "defense" && b.agressif && !b.tenir && b.etatT > b.pousseeT && !(this.spike && this.spike.etat === "pose")) {
          const pts = Object.values(this.carte.rassemblement || {});
          b.agressif = false;
          if (pts.length) { const p = pts[Math.floor(Math.random() * pts.length)]; this.chasser(b, p.x, p.z - 2, false); }
        }
        break;
      }
      case "chasse":
        if (b.chemin && b.chemin[b.iChemin]) b.lacetCible = angleVers(b.chemin[b.iChemin].x - b.x, b.chemin[b.iChemin].z - b.z);
        if (!b.chemin || b.iChemin >= b.chemin.length) {
          b.vitesseCible = 0;
          if (b.arriveT === null) b.arriveT = b.etatT;
          b.regardT -= dt;
          if (b.regardT <= 0) { b.regardT = alea(0.6, 1.2); b.lacetCible = b.yaw + alea(-120, 120) * DEG; }
          if (b.etatT - b.arriveT > 4) this.decider(b);
        }
        break;
      case "combat":
        this.combat(b, dt, temps);
        break;
      case "couvert":
        if (b.chemin && b.iChemin < b.chemin.length) {
          b.lacetCible = angleVers(b.chemin[b.iChemin].x - b.x, b.chemin[b.iChemin].z - b.z);
        } else {
          b.vitesseCible = 0;
          if (b.mun < (ARMES[b.arme].chargeur || 1) && b.rechargeT <= 0) this.recharger(b);
          if (b.derniereVue) b.lacetCible = angleVers(b.derniereVue.x - b.x, b.derniereVue.z - b.z);
          if (b.etatT > b.attenteCouvert && b.rechargeT <= 0) {
            const r = b.retourPeek || b.derniereVue;
            b.couvertFait = false;
            if (r) this.chasser(b, r.x, r.z, false);
            else this.decider(b);
          }
        }
        if (b.voit && b.conscience >= 1 && b.etatT > 0.6 && (!b.chemin || b.iChemin >= b.chemin.length)) { b.etat = "combat"; b.etatT = 0; b.cible = b.cibleVue; }
        break;
      case "pose":
      case "desamorce":
        b.vitesseCible = 0;
        if (b.etat === "pose" && (!this.spike || this.spike.porteur !== b)) { this.decider(b); break; }
        if (b.etat === "desamorce" && (!this.spike || this.spike.etat !== "pose")) { this.decider(b); break; }
        if (this.spike) b.lacetCible = angleVers(this.spike.x - b.x + 0.01, this.spike.z - b.z);
        // Un ennemi en vue : il abandonne pour se battre (la progression du désamorçage est gardée à mi-chemin)
        if (b.voit && b.conscience >= 1) { b.etat = "combat"; b.etatT = 0; b.cible = b.cibleVue; }
        break;
    }

    if (b.rechargeT > 0) {
      b.rechargeT -= dt;
      if (b.rechargeT <= 0) b.mun = ARMES[b.arme].chargeur || 1;
    }
  }

  recharger(b) {
    const def = ARMES[b.arme];
    b.dureeRecharge = def.rechargement || 2;
    b.rechargeT = b.dureeRecharge;
  }

  // ===== Capacités des personnages (IA) =====
  // Exécution d'un site : les attaquants qui ont une fumée la lancent entre le site et les défenseurs.
  utilitairesExecution(equipe) {
    if (!this.competences) return;
    const strat = this.strategie[equipe];
    const site = this.carte.sites[strat.site];
    const dz = this.carte.zoneDepartBots;
    if (!site) return;
    const cx = (dz.minX + dz.maxX) / 2, cz = (dz.minZ + dz.maxZ) / 2;
    let fumees = 0;
    for (const b of this.liste) {
      if (b.equipe !== equipe || !b.vivant || !b.capacites || b.empT > 0 || fumees >= 2) continue;
      for (const slot of ["c", "q", "e"]) {
        const e = b.capacites[slot], def = CAPACITES[e.id];
        if (e.charges <= 0 || !(def.effet === "fumee" || def.famille === "murFumee")) continue;
        if (Math.random() > this.diff.utilitaires + 0.45) continue;
        const k = 0.35 + fumees * 0.2;
        const point = { x: site.x + (cx - site.x) * k + alea(-2, 2), y: 0, z: site.z + (cz - site.z) * k + alea(-2, 2) };
        b.lacetCible = angleVers(point.x - b.x, point.z - b.z);
        b.yaw = b.lacetCible;
        if (this.competences.executer(b, e.id, { cible: point })) { e.charges--; fumees++; }
        break;
      }
    }
  }

  // Décide, de temps en temps, d'utiliser une capacité selon la situation
  utiliserCapacites(b, dt) {
    if (!this.competences || !b.capacites || b.mannequin || b.empT > 0 || b.ruee || b.charge) return;
    b.capaciteT -= dt;
    if (b.capaciteT > 0) return;
    b.capaciteT = alea(0.7, 1.4);
    const chance = 0.25 + this.diff.utilitaires;
    for (const slot of ["x", "e", "c", "q"]) {
      const e = b.capacites[slot];
      if (slot === "x" ? b.ultime < e.points : e.charges <= 0) continue;
      const def = CAPACITES[e.id];
      const decision = this.decisionCapacite(b, def);
      if (!decision || Math.random() > chance * (slot === "x" ? 1.2 : 1)) continue;
      if (this.lancerCapacite(b, e.id, def, decision)) {
        if (slot === "x") b.ultime = 0;
        else e.charges--;
        b.capaciteT = alea(1.5, 3);
        return;
      }
    }
  }

  // Situation du bot -> cible de la capacité ({ point } ou { soi: true }), ou null s'il vaut mieux attendre
  decisionCapacite(b, def) {
    const combat = b.etat === "combat" && b.cible && b.cible.vivant;
    const c = combat ? b.cible : null;
    const d = c ? Math.hypot(c.x - b.x, c.z - b.z) : Infinity;
    const vu = combat && b.voit && b.cibleVue === c;
    const connu = b.derniereVue;
    const dConnu = connu ? Math.hypot(connu.x - b.x, connu.z - b.z) : Infinity;
    const defense = this.mode !== "deathmatch" && this.camps[b.equipe] === "defense";
    const strat = this.strategie[b.equipe];
    const allies = this.liste.filter((x) => x.equipe === b.equipe && x.vivant && !x.mannequin && Math.hypot(x.x - b.x, x.z - b.z) < 12);
    const blesses = allies.filter((x) => x.vie < 65).length;
    const devant = (m) => ({ point: { x: b.x + Math.sin(b.yaw) * m, y: 1, z: b.z + Math.cos(b.yaw) * m } });
    const versCible = (x) => ({ point: { x: x.x, y: 0, z: x.z } });
    switch (def.famille) {
      case "grenade":
      case "cible": {
        const effet = def.effet;
        if (effet === "flash") return !vu && connu && dConnu > 6 && dConnu < 22 && b.perduT > 0.4 ? { point: { x: connu.x, y: 2.2, z: connu.z } } : null;
        if (effet === "fumee") return combat && b.vie < 45 && d > 8 ? { point: { x: (b.x + c.x) / 2, y: 0, z: (b.z + c.z) / 2 } } : null;
        if (effet === "soin") return (b.vie < 60 || blesses >= 2) && !vu ? { point: { x: b.x, y: 0, z: b.z } } : null;
        if (effet === "sonar") return !combat && (b.bruit || (strat && strat.phase === "rassemblement" && !defense) || Math.random() < 0.08) ? devant(14) : null;
        if (effet === "multiFlash") return connu && dConnu < 30 && !vu ? { point: { x: connu.x, y: 0, z: connu.z } } : null;
        if (effet === "brouillard") return combat && d > 8 ? versCible(c) : null;
        // Effets offensifs : explosion, feu, givre, commotion, IEM, trou noir, frappe...
        if (vu && d > 5 && d < (def.portee || 25)) return versCible(c);
        if (!vu && connu && dConnu > 5 && dConnu < 22 && (effet === "explosion" || effet === "feu" || effet === "frappe")) return { point: { x: connu.x, y: 0, z: connu.z } };
        return null;
      }
      case "buff":
        if (def.armure) return (b.armure || 0) < 50 && (combat || b.etatT < 3) ? { soi: true } : null;
        if (def.soin && !def.cadence) return b.vie < 55 && !vu ? { soi: true } : null;
        return combat ? { soi: true } : null;
      case "equipe":
        if (def.munitions) return allies.length >= 2 || combat ? { soi: true } : null;
        if (def.soin || def.armure) return blesses >= 2 || (b.vie < 50 && !vu) || (combat && allies.length >= 3) ? { soi: true } : null;
        return combat && allies.length >= 2 ? { soi: true } : combat && def.rayon === 0 ? { soi: true } : null;
      case "mur":
        if (combat && b.vie < 60 && d > 6) return versCible(c);
        return defense && b.etat === "garde" && b.vise && b.etatT > 1 && Math.random() < 0.2 ? { point: { x: b.vise.x, y: 1, z: b.vise.z } } : null;
      case "murFumee":
        if (combat && d > 10) return versCible(c);
        return null;
      case "drone":
        return !combat && (b.bruit || (!defense && strat && strat.phase === "execute") || Math.random() < 0.06) ? devant(10) : null;
      case "sonar":
        if (!def.rayon) return combat || (strat && strat.phase === "execute") ? { soi: true } : null;
        return !combat && (b.bruit || b.conscience > 0.3 || Math.random() < 0.1) ? { soi: true } : null;
      case "cone":
        return !combat && (b.bruit || b.etat === "deplacement") && Math.random() < 0.4 ? devant(20) : null;
      case "piege":
        if (defense && b.etat === "garde" && b.vise) return { point: { x: b.vise.x, y: 0, z: b.vise.z } };
        return this.mode === "deathmatch" && !combat && Math.random() < 0.15 ? devant(3) : null;
      case "tourelle":
        if (defense && b.etat === "garde" && b.vise) return { point: { x: b.vise.x, y: 0, z: b.vise.z } };
        if (this.spike && this.spike.etat === "pose" && !defense && b.etat === "garde") return { point: { x: this.spike.x, y: 0, z: this.spike.z } };
        return combat && d > 8 ? versCible(c) : null;
      case "camo":
        return (combat && b.vie < 45) || (!combat && !defense && strat && strat.phase === "execute" && Math.random() < 0.3) ? { soi: true } : null;
      case "frenesie":
        return combat ? { soi: true } : null;
      case "resurrection": {
        const morts = this.liste.filter((x) => x.equipe === b.equipe && !x.vivant && !x.mannequin && Math.hypot(x.x - b.x, x.z - b.z) < (def.rayon || 30)).length;
        return morts >= 2 && !vu ? { soi: true } : null;
      }
      case "seisme":
        return combat && d < (def.rayon || 9) * 0.85 ? { soi: true } : null;
      case "ruee":
        return combat && d < 18 && Math.random() < 0.5 ? { soi: true } : null;
      case "blink":
        return (combat && b.vie < 40) || (combat && d > 6 && d < 14 && Math.random() < 0.3) ? { soi: true } : null;
      case "charge":
        return combat && d > 2.5 && d < 7 ? { soi: true } : null;
    }
    return null;
  }

  lancerCapacite(b, id, def, decision) {
    const c = b.cible;
    switch (def.famille) {
      case "saut": return false;
      case "ruee": {
        // Esquive latérale ou ruée vers l'ennemi
        const ang = c ? angleVers(c.x - b.x, c.z - b.z) : b.yaw;
        const a = ang + (Math.random() < 0.6 ? (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2 : 0);
        b.ruee = { dx: Math.sin(a), dz: Math.cos(a), t: def.duree || 0.27, duree: def.duree || 0.27, vitesse: (def.vitesse || 30) * 0.85 };
        this.audio.ruee();
        return true;
      }
      case "charge": {
        if (!c) return false;
        const a = angleVers(c.x - b.x, c.z - b.z);
        b.charge = { dx: Math.sin(a), dz: Math.cos(a), t: def.duree || 0.45, def, touches: new Set() };
        this.audio.ruee();
        return true;
      }
      case "blink": {
        const monde = this.carte.monde;
        const fuite = b.vie < 40 && c;
        const a = c ? angleVers(c.x - b.x, c.z - b.z) + (fuite ? Math.PI : 0) : b.yaw;
        const dx = Math.sin(a), dz = Math.cos(a);
        let meilleur = 0;
        for (let d = 0.5; d <= (def.portee || 8); d += 0.25) {
          const x = b.x + dx * d, z = b.z + dz * d;
          if (!monde.ligneLibre(b.x, 1, b.z, x, 1, z)) break;
          if (!monde.bloque(x, z, 0, 0.35) && this.carte.nav.estLibre(x, z)) meilleur = d;
        }
        if (meilleur < 2) return false;
        if (this.competences.effets) this.competences.effets.apparition({ x: b.x, y: 0, z: b.z }, 0xb07cff);
        b.x += dx * meilleur; b.z += dz * meilleur;
        b.chemin = null;
        if (this.competences.effets) this.competences.effets.apparition({ x: b.x, y: 0, z: b.z }, 0xd0b0ff);
        this.audio.capacite("teleport", { x: b.x, y: 1, z: b.z });
        return true;
      }
    }
    if (decision.point) {
      b.lacetCible = angleVers(decision.point.x - b.x, decision.point.z - b.z);
      b.yaw = b.lacetCible;
    }
    return this.competences.executer(b, id, decision.point ? { cible: decision.point } : {});
  }

  // Ruée et charge des bots (déplacement rapide, sans traverser les murs)
  deplacementSpecial(b, dt) {
    const monde = this.carte.monde;
    const m = b.ruee || b.charge;
    m.t -= dt;
    const v = b.ruee ? m.vitesse * (0.45 + 0.55 * Math.max(0, m.t / m.duree)) : m.def.vitesse * 0.9;
    const ax = b.x, az = b.z;
    const pas = Math.max(1, Math.ceil(v * dt / 0.15));
    for (let i = 0; i < pas; i++) {
      const nx = b.x + m.dx * v * dt / pas, nz = b.z + m.dz * v * dt / pas;
      if (!monde.bloque(nx, b.z, 0, 0.35)) b.x = nx;
      if (!monde.bloque(b.x, nz, 0, 0.35)) b.z = nz;
    }
    b.vx = (b.x - ax) / dt; b.vz = (b.z - az) / dt;
    b.vitesse = Math.hypot(b.vx, b.vz);
    if (b.vitesse > 0.2) { b.dirMouvement.x = b.vx / b.vitesse; b.dirMouvement.z = b.vz / b.vitesse; }
    if (b.charge) {
      for (const e of this.ennemisDe(b)) {
        if (m.touches.has(e) || Math.hypot(e.x - b.x, e.z - b.z) > 1.15) continue;
        m.touches.add(e);
        e.commotionT = Math.max(e.commotionT || 0, m.def.commotion || 1.5);
        this.competences.degats(e, (m.def.degats || 45) * this.diff.facteurDegats * 1.4, b, "brax_belier");
      }
    }
    const d = diffAngle(b.yaw, b.lacetCible);
    b.yaw += Math.sign(d) * Math.min(Math.abs(d), 8 * dt);
    if (m.t <= 0) { b.ruee = null; b.charge = null; }
  }

  combat(b, dt, temps) {
    const diff = this.diff;
    const c = b.cible;
    if (!c || !c.vivant) {
      b.cible = null;
      if (b.voit && b.cibleVue) { b.cible = b.cibleVue; b.reactionT = diff.reaction * 0.6; return; }
      b.conscience = 0.7;
      this.decider(b);
      return;
    }
    if (!b.voit || b.cibleVue !== c) {
      if (b.voit && b.cibleVue) { b.cible = b.cibleVue; b.reactionT = Math.max(b.reactionT, diff.reaction * 0.5); return; }
      b.vitesseCible = 0;
      if (b.perduT > 0.7 && b.derniereVue) {
        b.conscience = 0.6;
        if (b.tenir) { b.etat = "garde"; b.vise = b.derniereVue; }
        else this.chasser(b, b.derniereVue.x, b.derniereVue.z, true);
      }
      return;
    }

    const dx = c.x - b.x, dz = c.z - b.z, d = Math.hypot(dx, dz);
    b.lacetCible = angleVers(dx, dz);
    const def = ARMES[b.arme];

    if ((b.veutCouvert || b.mun <= 0) && !b.couvertFait && !b.tenir) {
      const abri = this.trouverCouvert(b, c);
      if (abri) {
        b.couvertFait = true;
        b.veutCouvert = false;
        b.retourPeek = { x: b.x, z: b.z };
        b.attenteCouvert = alea(1.6, 3.2);
        this.allerVers(b, abri.x, abri.z, "couvert", true);
        return;
      }
      b.veutCouvert = false;
    }
    if (b.mun <= 0) {
      if (b.rechargeT <= 0) this.recharger(b);
      b.vitesseCible = 0;
      return;
    }

    // Fusil à pompe : il se rapproche avant de tirer
    if (def.bot && def.bot.portee && d > def.bot.portee && !b.tenir) {
      b.mouvementForce = { x: dx / d, z: dz / d };
      b.vitesseCible = 4;
      return;
    }

    b.erreurVisee += (diff.erreur - b.erreurVisee) * (1 - Math.exp(-dt / diff.convergence));
    b.reactionT -= dt;

    if (b.pauseT > 0) {
      b.pauseT -= dt;
      b.lateralT -= dt;
      if (b.lateralT <= 0) { b.lateral = -b.lateral; b.lateralT = alea(0.3, 0.6); }
      const ang = b.yaw + Math.PI / 2;
      b.mouvementForce = { x: Math.sin(ang) * b.lateral, z: Math.cos(ang) * b.lateral };
      b.vitesseCible = 2.8;
      return;
    }
    b.mouvementForce = null;
    b.vitesseCible = 0;

    const aligne = Math.abs(diffAngle(b.yaw, b.lacetCible)) < 6 * DEG;
    if (b.reactionT > 0 || !aligne || temps < b.prochainTir || b.vitesse > 1.2 || b.rechargeT > 0) return;

    const rafale = def.type === "auto" ? diff.rafale : def.bot.rafale;
    if (b.rafale <= 0) b.rafale = Math.round(alea(rafale[0], rafale[1]));
    this.tirer(b, c, d, temps);
    b.rafale--;
    b.prochainTir = temps + (def.type === "auto" ? diff.cadence : def.bot.cadence) / (this.competences ? this.competences.facteurCadence(b) : 1);
    if (b.rafale <= 0) b.pauseT = alea(diff.pause[0], diff.pause[1]) * (def.type === "auto" ? 1 : 0.5);
  }

  tirer(b, c, d) {
    const diff = this.diff;
    const def = ARMES[b.arme];
    b.mun--;
    const viseTete = Math.random() < diff.tete * (def.type === "verrou" ? 0.6 : 1);
    const cy = viseTete ? c.yeux + 0.05 : c.yeux - 0.45;
    let erreur = b.erreurVisee * (1 + Math.hypot(c.vx, c.vz) / 7) * (def.bot.facteur || 1);
    if (!c.auSol) erreur *= 1.6;
    if (b.aveugleT > 0) erreur *= 6;
    if (b.commotionT > 0) erreur *= 2.2;
    if (b.camoT > 0) b.camoRevelT = 0.6;
    const ox = b.x, oy = 1.45, oz = b.z;
    let dx0 = c.x - ox, dy0 = cy - oy, dz0 = c.z - oz;
    const l = Math.hypot(dx0, dy0, dz0);
    dx0 /= l; dy0 /= l; dz0 /= l;
    let ux = -dz0, uz = dx0;
    const ul = Math.hypot(ux, uz) || 1;
    ux /= ul; uz /= ul;
    const vx = dy0 * uz, vy = dz0 * ux - dx0 * uz, vz = -dy0 * ux;

    b.modele.tir();
    b.modele.fusil.updateWorldMatrix(true, false);
    const depart = b.modele.points.bouche.clone().applyMatrix4(b.modele.fusil.matrixWorld);
    this.audio.tirBot({ x: b.x, y: 1.4, z: b.z }, d, def.id);
    if (this.joueur && b !== this.joueur) this.entendre(b.x, b.z, 32, b);

    const plombs = def.plombs || 1;
    for (let p = 0; p < plombs; p++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * (erreur + (def.plombs ? def.dispersion * 0.8 : 0)) * DEG;
      let dx = dx0 + (ux * Math.cos(a) + vx * Math.sin(a)) * r;
      let dy = dy0 + vy * Math.sin(a) * r;
      let dz = dz0 + (uz * Math.cos(a) + vz * Math.sin(a)) * r;
      const l2 = Math.hypot(dx, dy, dz);
      dx /= l2; dy /= l2; dz /= l2;
      const mur = this.carte.monde.rayon(ox, oy, oz, dx, dy, dz, 120);
      const tMur = mur ? mur.t : 120;
      let touche = null;
      for (const e of this.ennemisDe(b)) {
        const h = toucherCombattant(e, ox, oy, oz, dx, dy, dz, touche ? touche.t : tMur);
        if (h) touche = { cible: e, t: h.t, partie: h.partie };
      }
      const t = touche ? touche.t : tMur;
      const arrivee = { x: ox + dx * t, y: oy + dy * t, z: oz + dz * t };
      if (touche) touche.degats = def.degats[touche.partie] * diff.facteurDegats * facteurDistance(def, touche.t);
      if (this.surTir) this.surTir(b, depart, arrivee, touche, touche ? null : mur, p > 0);
    }
  }

  trouverCouvert(b, c) {
    const nav = this.carte.nav, monde = this.carte.monde;
    let meilleur = null, meilleurCout = Infinity;
    for (let k = 0; k < 40; k++) {
      const p = nav.aleatoire(Math.random, { minX: b.x - 9, maxX: b.x + 9, minZ: b.z - 9, maxZ: b.z + 9 });
      if (!p) continue;
      if (Math.hypot(p.x - c.x, p.z - c.z) < Math.hypot(b.x - c.x, b.z - c.z) - 1) continue;
      if (monde.ligneLibre(p.x, 1.6, p.z, c.x, c.yeux, c.z)) continue;
      const cout = Math.hypot(p.x - b.x, p.z - b.z);
      if (cout < meilleurCout) { meilleurCout = cout; meilleur = p; }
    }
    return meilleur;
  }

  deplacer(b, dt) {
    const monde = this.carte.monde;
    if (b.ruee || b.charge) { this.deplacementSpecial(b, dt); return; }
    let dirX = 0, dirZ = 0;
    if (b.mouvementForce) {
      dirX = b.mouvementForce.x; dirZ = b.mouvementForce.z;
      if (b.etat !== "combat" && !b.mannequin) b.mouvementForce = null;
    } else if (b.chemin && b.iChemin < b.chemin.length && b.vitesseCible > 0) {
      const p = b.chemin[b.iChemin];
      const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz);
      if (d < 0.35) b.iChemin++;
      else { dirX = dx / d; dirZ = dz / d; }
    }
    if (dirX || dirZ) { b.dirMouvement.x = dirX; b.dirMouvement.z = dirZ; }
    const facteur = this.competences && !b.mannequin ? this.competences.facteurVitesse(b) : 1;
    const cible = (dirX || dirZ) ? b.vitesseCible * facteur : 0;
    b.vitesse += (cible - b.vitesse) * (1 - Math.exp(-10 * dt));
    b.vx = b.vz = 0;
    if (b.vitesse > 0.05 && (dirX || dirZ)) {
      const nx = b.x + dirX * b.vitesse * dt, nz = b.z + dirZ * b.vitesse * dt;
      let bouge = false;
      const ax = b.x, az = b.z;
      if (!monde.bloque(nx, b.z, 0, 0.35)) { b.x = nx; bouge = true; }
      if (!monde.bloque(b.x, nz, 0, 0.35)) { b.z = nz; bouge = true; }
      b.vx = (b.x - ax) / dt; b.vz = (b.z - az) / dt;
      if (!bouge) {
        b.bloqueT += dt;
        if (b.mouvementForce) b.lateral = -b.lateral;
        if (b.bloqueT > 0.6 && b.chemin) {
          const fin = b.chemin[b.chemin.length - 1];
          b.chemin = this.carte.nav.chemin(b.x, b.z, fin.x, fin.z);
          b.iChemin = 0; b.bloqueT = 0;
        }
      } else b.bloqueT = Math.max(0, b.bloqueT - dt);
      b.pasT -= dt * (b.vitesse / 3);
      if (b.pasT <= 0 && b.vitesse > 2.5) {
        b.pasT = 0.5;
        this.audio.pas({ x: b.x, y: 0.1, z: b.z }, b.vitesse > 4 ? 1 : 0.5);
        this.entendre(b.x, b.z, b.vitesse > 4 ? 14 : 7, b);
      }
    }
    const d = diffAngle(b.yaw, b.lacetCible);
    const vitRot = b.etat === "combat" ? this.diff.rotation : 4;
    b.yaw += Math.sign(d) * Math.min(Math.abs(d), vitRot * dt);
    if (b.reveleT > 0) b.reveleT -= dt;
  }

  // Joueur en ligne : position lissée entre deux messages du serveur
  majDistant(b, dt) {
    if (!b.vivant) { this.animerMort(b, dt); return; }
    const n = b.net;
    if (!n) return;
    const k = 1 - Math.exp(-14 * dt);
    const ax = b.x, az = b.z;
    if (Math.hypot(n.x - b.x, n.z - b.z) > 6) { b.x = n.x; b.z = n.z; }
    b.x += (n.x - b.x) * k; b.z += (n.z - b.z) * k; b.y += (n.y - b.y) * k;
    b.vx = (b.x - ax) / dt; b.vz = (b.z - az) / dt;
    b.vitesse = Math.hypot(b.vx, b.vz);
    if (b.vitesse > 0.2) { b.dirMouvement.x = b.vx / b.vitesse; b.dirMouvement.z = b.vz / b.vitesse; }
    b.yaw += diffAngle(b.yaw, n.l + Math.PI) * k;
    b.pitchNet = n.g;
    this.animer(b, dt);
  }

  animer(b, dt) {
    const m = b.modele;
    if (this.competences && !b.mannequin) m.camoufler(this.competences.invisible(b));
    m.racine.position.set(b.x, b.distant ? b.y : 0, b.z);
    m.racine.rotation.y = b.yaw;
    let lx = 0, lz = 1;
    const s = Math.sin(b.yaw), c = Math.cos(b.yaw);
    lz = b.dirMouvement.x * s + b.dirMouvement.z * c;
    lx = b.dirMouvement.x * c - b.dirMouvement.z * s;
    let pitch = 0;
    if (b.distant) pitch = b.pitchNet || 0;
    else if (b.etat === "combat" && b.cible) {
      const d = Math.hypot(b.cible.x - b.x, b.cible.z - b.z);
      pitch = Math.atan2(b.cible.yeux - 0.4 - 1.45, d);
    }
    b.pitch += (pitch - b.pitch) * (1 - Math.exp(-10 * dt));
    const vise = b.distant || (!b.mannequin && (b.etat === "combat" || b.etat === "chasse" || b.conscience > 0.6));
    m.maj({ dt, vitesse: b.vitesse, dirX: lx, dirZ: lz, vise, tangage: b.pitch, recharge: b.rechargeT > 0 ? 1 - b.rechargeT / b.dureeRecharge : -1 });
  }

  animerMort(b, dt) {
    b.mortT += dt;
    if (!b.modele) return;
    const m = b.modele;
    if (b.mortT < 9) m.maj({ dt, vitesse: 0, dirX: 0, dirZ: 1, vise: false, tangage: 0, recharge: -1 });
    if (b.mortT > 6) m.racine.position.y = -(b.mortT - 6) * 0.25;
    if (b.mortT > 8) m.racine.visible = false;
  }
}
