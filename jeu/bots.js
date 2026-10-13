// Bots ennemis : modèle 3D animé et intelligence (vision réelle, réaction, rafales, couverture, communication).
import * as THREE from "three";
import { rayonSphere, rayonCylindre, RAYON_PERSO } from "./physique.js";
import { Personnage, ARCHETYPES } from "./personnages.js";

export const DIFFICULTES = {
  facile:    { nom: "Facile",    reaction: 0.65, erreur: 2.4, convergence: 1.3, tete: 0.06, rafale: [2, 4], degats: { tete: 70, corps: 20, jambes: 17 }, vitesseDetection: 1.0, cadence: 0.16, ouie: 0.7, couvert: 0.35, pause: [0.5, 0.9], rotation: 6 },
  normal:    { nom: "Normal",    reaction: 0.42, erreur: 1.45, convergence: 0.85, tete: 0.16, rafale: [3, 5], degats: { tete: 110, corps: 27, jambes: 23 }, vitesseDetection: 1.5, cadence: 0.13, ouie: 1, couvert: 0.6, pause: [0.35, 0.75], rotation: 9 },
  difficile: { nom: "Difficile", reaction: 0.26, erreur: 0.8, convergence: 0.5, tete: 0.32, rafale: [3, 6], degats: { tete: 160, corps: 35, jambes: 30 }, vitesseDetection: 2.2, cadence: 0.11, ouie: 1.25, couvert: 0.85, pause: [0.2, 0.45], rotation: 12 },
};

const DEG = Math.PI / 180;
const YEUX_BOT = 1.6;
const NOMS = ["Vipère", "Écho", "Spectre", "Volt", "Cendre", "Givre", "Néon", "Orage"];

function angleVers(dx, dz) { return Math.atan2(dx, dz); }
function diffAngle(a, b) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
const alea = (a, b) => a + Math.random() * (b - a);

// ----- Gestion des bots -----
export class GestionBots {
  constructor(scene, carte, audio, qualite = "moyenne") {
    this.qualite = qualite;
    this.diff = DIFFICULTES.normal;
    this.scene = scene;
    this.carte = carte;
    this.audio = audio;
    this.liste = [];
    this.surTir = null;       // (bot, depart, arrivee, toucheJoueur)
    this.surMort = null;
    this.tmp = new THREE.Vector3();
  }

  vider() {
    for (const b of this.liste) this.scene.remove(b.modele.racine);
    this.liste = [];
  }

  nouvelleManche(difficulte, nombre) {
    this.vider();
    this.diff = DIFFICULTES[difficulte] || DIFFICULTES.normal;
    const postes = [...this.carte.postes].sort(() => Math.random() - 0.5);
    // Répartition : au moins un bot sur A, un sur B, un au milieu.
    const parZone = { A: [], B: [], MID: [] };
    for (const p of postes) parZone[p.zone].push(p);
    const choix = [parZone.A.pop(), parZone.B.pop(), parZone.MID.pop(), ...parZone.A, ...parZone.B, ...parZone.MID].filter(Boolean);
    const noms = [...NOMS].sort(() => Math.random() - 0.5);

    for (let i = 0; i < nombre; i++) {
      const depart = this.carte.nav.aleatoire(Math.random, this.carte.zoneDepartBots) || { x: 0, z: -18 };
      const modele = new Personnage(ARCHETYPES[(i + Math.floor(Math.random() * 3)) % 3], i % 3, this.qualite);
      modele.racine.position.set(depart.x, 0, depart.z);
      this.scene.add(modele.racine);
      const bot = {
        nom: noms[i % noms.length], modele, x: depart.x, z: depart.z, yaw: Math.PI, pitch: 0,
        vie: 100, vivant: true, mortT: 0, etat: "attente", etatT: 0,
        poste: choix[i % choix.length], chemin: null, iChemin: 0, bloqueT: 0,
        vitesse: 0, vitesseCible: 0, lacetCible: Math.PI,
        conscience: 0, voit: false, perduT: 0, derniereVue: null, testVueT: Math.random() * 0.1,
        reactionT: 0, erreurVisee: 0, rafale: 0, prochainTir: 0, pauseT: 0, lateralT: 0, lateral: 1,
        mun: 25, rechargeT: 0, couvertFait: false, retourPeek: null, pasT: 0, phase: Math.random() * 6,
        agressif: Math.random() < 0.35, pousseeT: alea(18, 40), regardT: 0, regardDecalage: 0,
        tueur: null,
      };
      this.liste.push(bot);
    }
  }

  vivants() { return this.liste.filter((b) => b.vivant); }

  // ----- Perception -----
  peutVoir(bot, joueur) {
    const ox = bot.x, oy = YEUX_BOT, oz = bot.z;
    const yeux = joueur.pos.y + joueur.hauteurYeux;
    const monde = this.carte.monde;
    return monde.ligneLibre(ox, oy, oz, joueur.pos.x, yeux, joueur.pos.z) ||
      monde.ligneLibre(ox, oy, oz, joueur.pos.x, yeux - 0.55, joueur.pos.z);
  }

  // Un bruit (tir, pas) : les bots proches vont voir, les autres gardent leur angle et regardent vers le bruit.
  entendre(x, z, rayon) {
    rayon *= this.diff.ouie;
    for (const b of this.liste) {
      if (!b.vivant || b.etat === "combat" || b.etat === "couvert") continue;
      const d = Math.hypot(b.x - x, b.z - z);
      if (d > rayon) continue;
      b.bruit = { x, z, t: 2.5 };
      b.conscience = Math.max(b.conscience, 0.35);
      const tresProche = d < 11;
      const vaVoir = tresProche || (b.agressif && Math.random() < 0.25);
      if (vaVoir && b.etat !== "chasse") this.allerVers(b, x, z, "chasse", !tresProche);
    }
  }

  // Un bot qui repère le joueur prévient ses coéquipiers proches.
  alerter(source, x, z) {
    for (const b of this.liste) {
      if (b === source || !b.vivant || b.etat === "combat" || b.etat === "couvert") continue;
      if (Math.hypot(b.x - source.x, b.z - source.z) > 26) continue;
      if (Math.random() < 0.6) {
        const delai = alea(0.4, 1.2);
        setTimeout(() => { if (b.vivant && b.etat !== "combat") this.allerVers(b, x, z, "chasse", true); }, delai * 1000);
      }
    }
  }

  allerVers(bot, x, z, etat, courir = true) {
    const c = this.carte.nav.chemin(bot.x, bot.z, x, z);
    bot.chemin = c;
    bot.iChemin = 0;
    bot.etat = etat;
    bot.etatT = 0;
    bot.vitesseCible = courir ? 5.2 : 3;
    bot.bloqueT = 0;
    bot.arriveT = null;
  }

  // ----- Dégâts reçus -----
  blesser(bot, degats, depuisX, depuisZ, tete) {
    if (!bot.vivant) return false;
    bot.vie -= degats;
    if (bot.vie <= 0) {
      bot.vivant = false;
      bot.vie = 0;
      bot.mortT = 0;
      bot.modele.mourir(Math.sign(Math.random() - 0.5));
      if (this.surMort) this.surMort(bot, tete);
      return true;
    }
    // Touché : il sait d'où vient le tir et réagit plus vite.
    // Réaction physique à l'impact (le buste encaisse dans le sens du tir)
    const ix = bot.x - depuisX, iz = bot.z - depuisZ, il = Math.hypot(ix, iz) || 1;
    const s = Math.sin(bot.yaw), c = Math.cos(bot.yaw);
    bot.modele.impact((ix * c - iz * s) / il, (ix * s + iz * c) / il, tete);
    bot.lacetCible = angleVers(depuisX - bot.x, depuisZ - bot.z);
    bot.derniereVue = { x: depuisX, z: depuisZ };
    if (bot.etat !== "combat" && bot.etat !== "couvert") {
      bot.conscience = 1;
      bot.reactionT = this.diff.reaction * 0.7;
      bot.erreurVisee = this.diff.erreur * 1.6;
      bot.etat = "combat";
      bot.etatT = 0;
      bot.chemin = null;
    }
    if (bot.vie < 45 && !bot.couvertFait && Math.random() < this.diff.couvert) bot.veutCouvert = true;
    return false;
  }

  // ----- Balles du joueur contre les bots -----
  toucher(ox, oy, oz, dx, dy, dz, tMax) {
    let meilleur = null;
    for (const b of this.liste) {
      if (!b.vivant) continue;
      const accroupi = 0;
      const teteY = 1.69 - accroupi;
      const tTete = rayonSphere(ox, oy, oz, dx, dy, dz, b.x, teteY, b.z, 0.17);
      if (tTete >= 0 && tTete < tMax && (!meilleur || tTete < meilleur.t)) meilleur = { bot: b, t: tTete, partie: "tete" };
      const c = rayonCylindre(ox, oy, oz, dx, dy, dz, b.x, b.z, 0.29, 0, 1.5);
      if (c && c.t < tMax && (!meilleur || c.t < meilleur.t - 0.02)) meilleur = { bot: b, t: c.t, partie: c.y < 0.82 ? "jambes" : "corps" };
    }
    return meilleur;
  }

  // ----- Boucle -----
  maj(dt, temps, joueur, phase) {
    const actif = phase === "combat";
    for (const b of this.liste) {
      if (!b.vivant) { this.animerMort(b, dt); continue; }
      if (actif) this.penser(b, dt, temps, joueur);
      else { b.vitesseCible = 0; }
      this.deplacer(b, dt);
      this.animer(b, dt, joueur);
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

  penser(b, dt, temps, joueur) {
    const diff = this.diff;
    b.etatT += dt;

    // Vision (10 fois par seconde)
    b.testVueT -= dt;
    if (b.testVueT <= 0) {
      b.testVueT = 0.1;
      let voit = false;
      if (joueur.vivant) {
        const dx = joueur.pos.x - b.x, dz = joueur.pos.z - b.z, d = Math.hypot(dx, dz);
        const dansChamp = Math.abs(diffAngle(b.yaw, angleVers(dx, dz))) < (b.conscience >= 1 ? 80 : 52) * DEG;
        if (d < 60 && (dansChamp || d < 3) && this.peutVoir(b, joueur)) voit = true;
      }
      b.voit = voit;
    }

    if (b.voit) {
      const dx = joueur.pos.x - b.x, dz = joueur.pos.z - b.z, d = Math.hypot(dx, dz);
      // La détection monte plus vite si le joueur est proche, au centre de la vue ou en mouvement.
      const centre = 1 - Math.min(1, Math.abs(diffAngle(b.yaw, angleVers(dx, dz))) / (60 * DEG)) * 0.6;
      const bouge = Math.hypot(joueur.vel.x, joueur.vel.z) > 1 ? 1.4 : 1;
      b.conscience += dt * diff.vitesseDetection * centre * bouge * (1.6 - Math.min(d, 50) / 40) * 2.2;
      b.derniereVue = { x: joueur.pos.x, z: joueur.pos.z };
      b.perduT = 0;
      if (b.conscience >= 1 && b.etat !== "combat" && b.etat !== "couvert") {
        b.conscience = 1;
        b.etat = "combat";
        b.etatT = 0;
        b.chemin = null;
        b.reactionT = diff.reaction * alea(0.85, 1.3);
        b.erreurVisee = diff.erreur * 2;
        this.alerter(b, joueur.pos.x, joueur.pos.z);
      } else if (b.conscience < 1) {
        b.lacetCible = b.yaw + diffAngle(b.yaw, angleVers(dx, dz)) * 0.5; // il a un doute et regarde
      }
    } else {
      b.perduT += dt;
      if (b.etat !== "combat") b.conscience = Math.max(0, b.conscience - dt * 0.25);
    }

    switch (b.etat) {
      case "attente":
        // Début de manche : rejoindre son poste.
        this.allerVers(b, b.poste.x, b.poste.z, "versPoste", true);
        break;
      case "versPoste":
        b.lacetCible = b.chemin && b.chemin[b.iChemin] ? angleVers(b.chemin[b.iChemin].x - b.x, b.chemin[b.iChemin].z - b.z) : b.lacetCible;
        if (!b.chemin || b.iChemin >= b.chemin.length) { b.etat = "garde"; b.etatT = 0; }
        break;
      case "garde": {
        b.vitesseCible = 0;
        const vise = angleVers(b.poste.vise.x - b.x, b.poste.vise.z - b.z);
        b.regardT -= dt;
        if (b.regardT <= 0) { b.regardT = alea(1.2, 3.5); b.regardDecalage = alea(-28, 28) * DEG; }
        b.lacetCible = vise + b.regardDecalage;
        if (b.bruit && b.bruit.t > 0) { b.bruit.t -= dt; b.lacetCible = angleVers(b.bruit.x - b.x, b.bruit.z - b.z); }
        // Certains bots vont chercher le combat au bout d'un moment.
        if (b.agressif && b.etatT > b.pousseeT) {
          const cibles = [{ x: 20, z: 9 }, { x: 0, z: 8 }, { x: -20, z: 9 }];
          const c = cibles[Math.floor(Math.random() * cibles.length)];
          this.allerVers(b, c.x, c.z, "poussee", false);
        }
        break;
      }
      case "poussee":
        if (b.chemin && b.chemin[b.iChemin]) b.lacetCible = angleVers(b.chemin[b.iChemin].x - b.x, b.chemin[b.iChemin].z - b.z);
        if (!b.chemin || b.iChemin >= b.chemin.length) { b.poste = { x: b.x, z: b.z, vise: { x: b.x, z: b.z + 10 }, zone: "X" }; b.etat = "garde"; b.etatT = 0; b.agressif = false; }
        break;
      case "chasse":
        if (b.chemin && b.chemin[b.iChemin]) b.lacetCible = angleVers(b.chemin[b.iChemin].x - b.x, b.chemin[b.iChemin].z - b.z);
        if (!b.chemin || b.iChemin >= b.chemin.length) {
          // Arrivé : il fouille du regard puis retourne garder.
          b.vitesseCible = 0;
          if (b.arriveT === null) b.arriveT = b.etatT;
          b.regardT -= dt;
          if (b.regardT <= 0) { b.regardT = alea(0.6, 1.2); b.lacetCible = b.yaw + alea(-120, 120) * DEG; }
          if (b.etatT - b.arriveT > 5) this.allerVers(b, b.poste.x, b.poste.z, "versPoste", false);
        }
        break;
      case "combat":
        this.combat(b, dt, temps, joueur);
        break;
      case "couvert":
        if (b.chemin && b.iChemin < b.chemin.length) {
          b.lacetCible = angleVers(b.chemin[b.iChemin].x - b.x, b.chemin[b.iChemin].z - b.z);
        } else {
          b.vitesseCible = 0;
          if (b.mun < 25 && b.rechargeT <= 0) b.rechargeT = 2.2;
          if (b.derniereVue) b.lacetCible = angleVers(b.derniereVue.x - b.x, b.derniereVue.z - b.z);
          if (b.etatT > b.attenteCouvert && b.rechargeT <= 0) {
            // Re-peek : il revient à l'endroit d'où il tirait.
            const r = b.retourPeek || b.derniereVue;
            b.couvertFait = false;
            if (r) this.allerVers(b, r.x, r.z, "chasse", false);
            else { b.etat = "garde"; b.etatT = 0; }
          }
        }
        if (b.voit && b.conscience >= 1 && b.etatT > 0.6 && (!b.chemin || b.iChemin >= b.chemin.length)) { b.etat = "combat"; b.etatT = 0; }
        break;
    }

    if (b.rechargeT > 0) {
      b.rechargeT -= dt;
      if (b.rechargeT <= 0) b.mun = 25;
    }
  }

  combat(b, dt, temps, joueur) {
    const diff = this.diff;
    if (!joueur.vivant) { b.etat = "garde"; b.etatT = 0; return; }

    if (!b.voit) {
      // Perdu de vue : après un court instant, il va vérifier la dernière position.
      b.vitesseCible = 0;
      if (b.perduT > 0.7 && b.derniereVue) {
        b.conscience = 0.6;
        this.allerVers(b, b.derniereVue.x, b.derniereVue.z, "chasse", true);
      }
      return;
    }

    const dx = joueur.pos.x - b.x, dz = joueur.pos.z - b.z, d = Math.hypot(dx, dz);
    b.lacetCible = angleVers(dx, dz);

    // Se mettre à couvert (blessé ou chargeur vide)
    if ((b.veutCouvert || b.mun <= 0) && !b.couvertFait) {
      const abri = this.trouverCouvert(b, joueur);
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
      if (b.rechargeT <= 0) b.rechargeT = 2.2;
      b.vitesseCible = 0;
      return;
    }

    b.erreurVisee += (diff.erreur - b.erreurVisee) * (1 - Math.exp(-dt / diff.convergence));
    b.reactionT -= dt;

    // Pas chassés entre les rafales, arrêt net pour tirer (comme un vrai joueur).
    if (b.pauseT > 0) {
      b.pauseT -= dt;
      b.lateralT -= dt;
      if (b.lateralT <= 0) { b.lateral = -b.lateral; b.lateralT = alea(0.3, 0.6); }
      const ang = b.yaw + Math.PI / 2;
      b.mouvementForce = { x: Math.sin(ang) * b.lateral, z: Math.cos(ang) * b.lateral };
      b.vitesseCible = 3.2;
      return;
    }
    b.mouvementForce = null;
    b.vitesseCible = 0;

    const aligne = Math.abs(diffAngle(b.yaw, b.lacetCible)) < 6 * DEG;
    if (b.reactionT > 0 || !aligne || temps < b.prochainTir || b.vitesse > 1.2 || b.rechargeT > 0) return;

    if (b.rafale <= 0) b.rafale = Math.round(alea(diff.rafale[0], diff.rafale[1]));
    this.tirer(b, joueur, d, temps);
    b.rafale--;
    b.prochainTir = temps + diff.cadence;
    if (b.rafale <= 0) b.pauseT = alea(diff.pause[0], diff.pause[1]);
  }

  tirer(b, joueur, d, temps) {
    const diff = this.diff;
    b.mun--;
    const viseTete = Math.random() < diff.tete;
    const yeux = joueur.pos.y + joueur.hauteurYeux;
    const cible = { x: joueur.pos.x, y: viseTete ? yeux - 0.04 : yeux - 0.45, z: joueur.pos.z };
    // Erreur de visée : plus grande si le joueur bouge vite ou saute.
    let erreur = b.erreurVisee * (1 + Math.hypot(joueur.vel.x, joueur.vel.z) / 7);
    if (!joueur.auSol) erreur *= 1.6;
    const ox = b.x, oy = 1.45, oz = b.z;
    let dx = cible.x - ox, dy = cible.y - oy, dz = cible.z - oz;
    const l = Math.hypot(dx, dy, dz);
    dx /= l; dy /= l; dz /= l;
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * erreur * DEG;
    // Base orthonormée autour de la direction
    let ux = -dz, uz = dx;
    const ul = Math.hypot(ux, uz) || 1;
    ux /= ul; uz /= ul;
    const vx = dy * uz, vy = dz * ux - dx * uz, vz = -dy * ux;
    dx += (ux * Math.cos(a) + vx * Math.sin(a)) * r;
    dy += (vy * Math.sin(a)) * r;
    dz += (uz * Math.cos(a) + vz * Math.sin(a)) * r;
    const l2 = Math.hypot(dx, dy, dz);
    dx /= l2; dy /= l2; dz /= l2;

    const mur = this.carte.monde.rayon(ox, oy, oz, dx, dy, dz, 120);
    const tMur = mur ? mur.t : 120;
    // Touche le joueur ?
    let toucheJoueur = null;
    const tTete = rayonSphere(ox, oy, oz, dx, dy, dz, joueur.pos.x, yeux - 0.02, joueur.pos.z, 0.16);
    const corps = rayonCylindre(ox, oy, oz, dx, dy, dz, joueur.pos.x, joueur.pos.z, RAYON_PERSO * 0.85, joueur.pos.y, yeux - 0.15);
    if (tTete >= 0 && tTete < tMur) toucheJoueur = { t: tTete, partie: "tete" };
    else if (corps && corps.t < tMur) toucheJoueur = { t: corps.t, partie: corps.y - joueur.pos.y < 0.8 ? "jambes" : "corps" };

    const t = toucheJoueur ? toucheJoueur.t : tMur;
    b.modele.tir();
    b.modele.fusil.updateWorldMatrix(true, false);
    const depart = this.tmp.copy(b.modele.points.bouche).applyMatrix4(b.modele.fusil.matrixWorld).clone();
    const arrivee = { x: ox + dx * t, y: oy + dy * t, z: oz + dz * t };
    this.audio.tirBot({ x: b.x, y: 1.4, z: b.z }, d);
    if (this.surTir) this.surTir(b, depart, arrivee, toucheJoueur ? { degats: diff.degats[toucheJoueur.partie], partie: toucheJoueur.partie } : null, toucheJoueur ? null : mur);
  }

  trouverCouvert(b, joueur) {
    const nav = this.carte.nav, monde = this.carte.monde;
    const yeux = joueur.pos.y + joueur.hauteurYeux;
    let meilleur = null, meilleurCout = Infinity;
    for (let k = 0; k < 40; k++) {
      const p = nav.aleatoire(Math.random, { minX: b.x - 9, maxX: b.x + 9, minZ: b.z - 9, maxZ: b.z + 9 });
      if (!p) continue;
      if (Math.hypot(p.x - joueur.pos.x, p.z - joueur.pos.z) < Math.hypot(b.x - joueur.pos.x, b.z - joueur.pos.z) - 1) continue;
      if (monde.ligneLibre(p.x, 1.6, p.z, joueur.pos.x, yeux, joueur.pos.z)) continue;
      const cout = Math.hypot(p.x - b.x, p.z - b.z);
      if (cout < meilleurCout) { meilleurCout = cout; meilleur = p; }
    }
    return meilleur;
  }

  deplacer(b, dt) {
    const monde = this.carte.monde;
    let dirX = 0, dirZ = 0;
    if (b.mouvementForce) {
      dirX = b.mouvementForce.x; dirZ = b.mouvementForce.z;
    } else if (b.chemin && b.iChemin < b.chemin.length && b.vitesseCible > 0) {
      const p = b.chemin[b.iChemin];
      const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz);
      if (d < 0.35) { b.iChemin++; }
      else { dirX = dx / d; dirZ = dz / d; }
    }
    if (dirX || dirZ) { if (!b.dirMouvement) b.dirMouvement = { x: 0, z: 1 }; b.dirMouvement.x = dirX; b.dirMouvement.z = dirZ; }
    const cible = (dirX || dirZ) ? b.vitesseCible : 0;
    b.vitesse += (cible - b.vitesse) * (1 - Math.exp(-10 * dt));
    if (b.vitesse > 0.05 && (dirX || dirZ)) {
      const nx = b.x + dirX * b.vitesse * dt, nz = b.z + dirZ * b.vitesse * dt;
      let bouge = false;
      if (!monde.bloque(nx, b.z, 0, 0.35)) { b.x = nx; bouge = true; }
      if (!monde.bloque(b.x, nz, 0, 0.35)) { b.z = nz; bouge = true; }
      if (!bouge) {
        b.bloqueT += dt;
        if (b.mouvementForce) b.lateral = -b.lateral;
        if (b.bloqueT > 0.6 && b.chemin) {
          const fin = b.chemin[b.chemin.length - 1];
          b.chemin = this.carte.nav.chemin(b.x, b.z, fin.x, fin.z);
          b.iChemin = 0; b.bloqueT = 0;
        }
      } else b.bloqueT = Math.max(0, b.bloqueT - dt);
      // Bruits de pas
      b.pasT -= dt * (b.vitesse / 3);
      if (b.pasT <= 0 && b.vitesse > 2.5) {
        b.pasT = 0.5;
        this.audio.pas({ x: b.x, y: 0.1, z: b.z }, b.vitesse > 4 ? 1 : 0.5);
      }
    }
    const d = diffAngle(b.yaw, b.lacetCible);
    const vitRot = b.etat === "combat" ? this.diff.rotation : 4;
    b.yaw += Math.sign(d) * Math.min(Math.abs(d), vitRot * dt);
  }

  animer(b, dt, joueur) {
    const m = b.modele;
    m.racine.position.set(b.x, 0, b.z);
    m.racine.rotation.y = b.yaw;
    // Direction du mouvement dans le repère du personnage (avant = +Z)
    let lx = 0, lz = 1;
    if (b.dirMouvement) {
      const s = Math.sin(b.yaw), c = Math.cos(b.yaw);
      lz = b.dirMouvement.x * s + b.dirMouvement.z * c;
      lx = b.dirMouvement.x * c - b.dirMouvement.z * s;
    }
    let pitch = 0;
    if (b.etat === "combat" && joueur) {
      const d = Math.hypot(joueur.pos.x - b.x, joueur.pos.z - b.z);
      pitch = Math.atan2(joueur.pos.y + joueur.hauteurYeux - 0.4 - 1.45, d);
    }
    b.pitch += (pitch - b.pitch) * (1 - Math.exp(-10 * dt));
    const vise = b.etat === "combat" || b.etat === "chasse" || b.conscience > 0.6;
    m.maj({ dt, vitesse: b.vitesse, dirX: lx, dirZ: lz, vise, tangage: b.pitch, recharge: b.rechargeT > 0 ? 1 - b.rechargeT / 2.2 : -1 });
  }

  animerMort(b, dt) {
    b.mortT += dt;
    const m = b.modele;
    m.maj({ dt, vitesse: 0, dirX: 0, dirZ: 1, vise: false, tangage: 0, recharge: -1 });
    if (b.mortT > 6) m.racine.position.y = -(b.mortT - 6) * 0.25;
    if (b.mortT > 8) m.racine.visible = false;
  }
}
