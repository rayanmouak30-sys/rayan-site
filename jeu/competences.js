// Moteur des capacités des personnages. Les 80 capacités (capacites.js) sont des données ; ce module
// programme leurs familles d'effets : grenades et projectiles (vraie trajectoire, rebonds), fumées, flashs,
// explosions, zones au sol (feu, givre, soin, sonar, trou noir, frappe), murs, drones, pièges, tourelles,
// camouflage, bonus personnels et d'équipe. Joueur et bots passent par les mêmes fonctions.
import * as THREE from "three";
import { textureEclat } from "./textures.js";
import { CAPACITES } from "./capacites.js";
import { ARMES } from "./armes.js";

export { CAPACITES };

function textureFumee() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  for (let i = 0; i < 9; i++) {
    const x = 40 + Math.random() * 48, y = 40 + Math.random() * 48, r = 26 + Math.random() * 26;
    const d = g.createRadialGradient(x, y, 0, x, y, r);
    d.addColorStop(0, "rgba(255,255,255,0.85)");
    d.addColorStop(0.5, "rgba(255,255,255,0.45)");
    d.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = d;
    g.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(c);
}

function textureLosange(couleur) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = couleur;
  g.strokeStyle = "rgba(0,0,0,0.7)";
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(32, 6); g.lineTo(54, 32); g.lineTo(32, 58); g.lineTo(10, 32); g.closePath();
  g.stroke(); g.fill();
  return new THREE.CanvasTexture(c);
}

const GRAVITE = 12;
const COULEURS_EFFET = { fumee: 0x8fa0b8, flash: 0xffe08a, explosion: 0xff7a2a, feu: 0xff7a2a, ralenti: 0xb07cff, commotion: 0xffd166, emp: 0x7cffd4, sonar: 0x5affd1, soin: 0x9cff6a };
const STATUTS = ["commotionT", "empT", "camoT", "camoRevelT", "vitesseT", "cadenceT", "entraveT", "rechargeRapideT", "frenesieT"];

// Géométries partagées des zones au sol
const geoDisque = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
const geoBord = new THREE.RingGeometry(0.94, 1, 48).rotateX(-Math.PI / 2);
const geoFleche = new THREE.ConeGeometry(0.035, 0.32, 8).rotateX(-Math.PI / 2);

export class Competences {
  constructor(scene, carte, audio, qualite) {
    this.scene = scene;
    this.carte = carte;
    this.audio = audio;
    this.qualite = qualite;
    this.effets = null;
    this.combattants = () => [];
    this.estEnnemi = (a, b) => a.equipe !== b.equipe;
    this.surAveugle = null;      // (combattant, intensite, duree)
    this.surRevele = null;       // (cible, duree, equipe)
    this.surDegats = null;       // (cible, degats, auteur, capId)
    this.surResurrection = null; // (lanceur, def)
    this.surTirTourelle = null;  // (depart, arrivee)
    this.projectiles = [];
    this.fumees = [];
    this.murs = [];
    this.drones = [];
    this.zones = [];
    this.pieges = [];
    this.tourelles = [];
    this.differes = [];

    this.texFumee = textureFumee();
    this.texEclat = textureEclat();
    this.geoGrenade = new THREE.SphereGeometry(0.07, 10, 8);
    this.matsGrenade = new Map();
    this.matEclat = new THREE.SpriteMaterial({ map: this.texEclat, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.eclat = new THREE.Sprite(this.matEclat);
    this.eclat.visible = false;
    scene.add(this.eclat);
    this.eclatT = 0;
    this.lumiere = new THREE.PointLight(0xfff4e0, 0, 30, 1.5);
    scene.add(this.lumiere);

    // Marqueurs des ennemis révélés (visibles à travers les murs)
    const matMarqueur = new THREE.SpriteMaterial({ map: textureLosange("#ff4f5e"), depthTest: false, depthWrite: false, transparent: true, toneMapped: false });
    this.marqueurs = [];
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Sprite(matMarqueur);
      s.scale.set(0.45, 0.45, 1);
      s.renderOrder = 999;
      s.visible = false;
      scene.add(s);
      this.marqueurs.push(s);
    }
  }

  changerCarte(carte) {
    this.vider();
    this.carte = carte;
  }

  vider() {
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    for (const f of this.fumees) { this.scene.remove(f.groupe); for (const s of f.sprites) s.material.dispose(); }
    for (const m of [...this.murs]) this.detruireMur(m);
    for (const d of this.drones) { this.scene.remove(d.mesh); this.audio.droneStop(d.son); }
    for (const z of this.zones) this.retirerZone(z);
    for (const p of this.pieges) this.scene.remove(p.mesh);
    for (const t of [...this.tourelles]) this.detruireTourelle(t, false);
    this.projectiles = [];
    this.fumees = [];
    this.drones = [];
    this.zones = [];
    this.pieges = [];
    this.tourelles = [];
    this.differes = [];
  }

  // ===== Statuts des combattants (joueur et bots) =====
  reinitialiserStatuts(c) {
    for (const k of STATUTS) c[k] = 0;
    c.vitesseK = 0; c.cadenceK = 0; c.soinRestant = 0; c.soinTaux = 0;
  }

  majStatuts(c, dt) {
    for (const k of STATUTS) if (c[k] > 0) c[k] = Math.max(0, c[k] - dt);
    if (c.soinRestant > 0) {
      if (!c.vivant) c.soinRestant = 0;
      else {
        const s = Math.min(c.soinRestant, c.soinTaux * dt);
        c.soinRestant -= s;
        c.vie = Math.min(100, c.vie + s);
      }
    }
  }

  facteurVitesse(c) {
    let f = 1;
    if (c.vitesseT > 0) f *= 1 + (c.vitesseK || 0);
    if (c.commotionT > 0) f *= 0.72;
    if (c.entraveT > 0) f *= 0.5;
    for (const z of this.zones) {
      if (!z.ralenti || !this.estEnnemi(z.lanceur, c)) continue;
      if ((c.x - z.x) ** 2 + (c.z - z.z) ** 2 < z.rayon * z.rayon && (c.y || 0) < 2.5) f = Math.min(f, z.ralenti);
    }
    return f;
  }

  facteurCadence(c) { return c.cadenceT > 0 ? 1 + (c.cadenceK || 0) : 1; }
  invisible(c) { return c.camoT > 0 && !(c.camoRevelT > 0); }

  ajouterSoin(c, total, duree) {
    c.soinRestant = (c.soinRestant || 0) + total;
    c.soinTaux = Math.max(c.soinTaux || 0, total / Math.max(0.1, duree));
  }

  allies(c, rayon = 0) {
    return this.combattants().filter((x) => x.vivant && !x.mannequin && (x === c || !this.estEnnemi(c, x)) && (!rayon || Math.hypot(x.x - c.x, x.z - c.z) <= rayon));
  }

  ennemis(c) { return this.combattants().filter((x) => x.vivant && this.estEnnemi(c, x)); }

  reveler(cible, duree, equipe) { if (this.surRevele) this.surRevele(cible, duree, equipe); }

  degats(cible, degats, auteur, capId) { if (degats > 0 && this.surDegats) this.surDegats(cible, degats, auteur, capId); }

  // ===== Point d'entrée : utiliser une capacité =====
  // ctx : { dir (Vector3, direction du regard du joueur) | cible ({x, y, z}, point visé par un bot) }
  // Les déplacements (ruée, saut, téléportation, charge) sont gérés par joueur.js et bots.js.
  executer(lanceur, id, ctx = {}) {
    const def = CAPACITES[id];
    if (!def) return false;
    const dir = ctx.dir ? ctx.dir.clone() : this.directionVers(lanceur, ctx.cible);
    const plat = new THREE.Vector3(dir.x, 0, dir.z);
    if (plat.lengthSq() < 1e-6) plat.set(0, 0, -1);
    plat.normalize();
    switch (def.famille) {
      case "grenade": this.lancerGrenade(lanceur, def, id, ctx.cible || null, ctx.dir || null); return true;
      case "cible": {
        const p = ctx.cible ? this.sol(ctx.cible.x, ctx.cible.z, 3) : this.pointVise(lanceur, dir, def.portee || 40);
        if (!p) return false;
        this.effetPoint(def, p, lanceur, id);
        return true;
      }
      case "buff": return this.buff(lanceur, def);
      case "equipe": return this.bonusEquipe(lanceur, def);
      case "mur": return this.poserMur(lanceur, plat, def);
      case "murFumee": return this.murFumee(lanceur, plat, def);
      case "drone": this.lancerDrone(lanceur, plat, def.duree || 6); return true;
      case "sonar": this.sonar(lanceur, def); return true;
      case "cone": this.cone(lanceur, plat, def); return true;
      case "piege": return this.poserPiege(lanceur, plat, def, id);
      case "tourelle": return this.poserTourelle(lanceur, plat, def, id);
      case "camo":
        lanceur.camoT = def.duree;
        lanceur.camoRevelT = 0;
        if (def.vitesse) { lanceur.vitesseT = def.duree; lanceur.vitesseK = def.vitesse; }
        this.audio.capacite("camo", lanceur.estJoueur ? null : { x: lanceur.x, y: 1, z: lanceur.z });
        return true;
      case "frenesie":
        lanceur.frenesieT = def.duree;
        lanceur.vitesseT = def.duree; lanceur.vitesseK = def.vitesse || 0.1;
        return true;
      case "resurrection":
        if (this.surResurrection) this.surResurrection(lanceur, def);
        return true;
      case "seisme": this.seisme(lanceur, def, id); return true;
    }
    return false;
  }

  directionVers(lanceur, cible) {
    if (!cible) return new THREE.Vector3(Math.sin(lanceur.yaw || 0), 0, Math.cos(lanceur.yaw || 0));
    return new THREE.Vector3(cible.x - lanceur.x, (cible.y ?? 1) - lanceur.yeux, cible.z - lanceur.z).normalize();
  }

  // Hauteur du sol (dessus d'une caisse ou sol) sous un point
  sol(x, z, depuis = 6) {
    const h = this.carte.monde.rayon(x, depuis, z, 0, -1, 0, depuis + 1);
    return { x, y: h ? Math.max(0, depuis - h.t) : 0, z };
  }

  // Point visé par le joueur, ramené au sol (jamais derrière un mur)
  pointVise(lanceur, dir, portee) {
    const monde = this.carte.monde;
    const o = { x: lanceur.x, y: lanceur.yeux, z: lanceur.z };
    const h = monde.rayon(o.x, o.y, o.z, dir.x, dir.y, dir.z, portee);
    let t = h ? Math.max(0.5, h.t - 0.4) : portee;
    if (!h && dir.y < -0.02) t = Math.min(portee, o.y / -dir.y);
    const x = o.x + dir.x * t, y = o.y + dir.y * t, z = o.z + dir.z * t;
    return this.sol(x, z, Math.max(1, y + 0.2));
  }

  // ===== Grenades et projectiles =====
  materiauGrenade(couleur) {
    if (!this.matsGrenade.has(couleur)) this.matsGrenade.set(couleur, new THREE.MeshStandardMaterial({ color: 0x8fa0b8, roughness: 0.4, metalness: 0.5, emissive: couleur, emissiveIntensity: 0.9 }));
    return this.matsGrenade.get(couleur);
  }

  // Ancienne interface (fumée / flash standard)
  lancer(type, lanceur, cible = null, dir = null) {
    this.lancerGrenade(lanceur, { effet: type, fusee: type === "flash" ? (dir ? 0.75 : 0.95) : undefined, duree: 15 }, type, cible, dir);
  }

  lancerGrenade(lanceur, def, capId, cible = null, dir = null) {
    const o = new THREE.Vector3(lanceur.x, lanceur.yeux - 0.1, lanceur.z);
    const v = new THREE.Vector3();
    const fleche = def.effet === "sonar";
    if (dir) {
      o.addScaledVector(dir, 0.5);
      v.copy(dir).multiplyScalar(def.vitesse || (def.effet === "flash" ? 17 : 15));
      if (!fleche) v.y += 2.5;
    } else {
      const dx = cible.x - o.x, dz = cible.z - o.z, dh = Math.hypot(dx, dz);
      const T = Math.max(0.55, Math.min(1.4, dh / 13));
      v.set(dx / T, ((cible.y ?? 0) - o.y) / T + 0.5 * GRAVITE * T, dz / T);
    }
    const couleur = def.couleur || COULEURS_EFFET[def.effet] || 0xffffff;
    const mesh = new THREE.Mesh(fleche ? geoFleche : this.geoGrenade, this.materiauGrenade(couleur));
    mesh.position.copy(o);
    this.scene.add(mesh);
    // fusée : durée avant explosion ; sans fusée, l'effet se déclenche à l'arrêt au sol (4 s au plus)
    const vie = def.fusee !== undefined ? def.fusee : (fleche ? 3 : 4);
    this.projectiles.push({ def, capId, pos: o, vel: v, vie, mesh, lanceur, repos: false, auSol: def.fusee === undefined, fleche });
    this.audio.lancer();
  }

  majProjectiles(dt) {
    const monde = this.carte.monde;
    for (const p of this.projectiles) {
      p.vie -= dt;
      if (!p.repos) {
        p.vel.y -= GRAVITE * dt * (p.fleche ? 0.35 : 1);
        const l = p.vel.length(), d = l * dt;
        if (d > 1e-5) {
          const dx = p.vel.x / l, dy = p.vel.y / l, dz = p.vel.z / l;
          const h = monde.rayon(p.pos.x, p.pos.y, p.pos.z, dx, dy, dz, d + 0.07);
          if (h) {
            p.pos.set(p.pos.x + dx * (h.t - 0.08), p.pos.y + dy * (h.t - 0.08), p.pos.z + dz * (h.t - 0.08));
            if (p.fleche) { p.repos = true; p.vie = 0; }
            else {
              if (h.nx) p.vel.x = -p.vel.x * 0.4;
              if (h.ny) p.vel.y = -p.vel.y * 0.35;
              if (h.nz) p.vel.z = -p.vel.z * 0.4;
              p.vel.multiplyScalar(0.7);
              this.audio.rebond(p.pos);
              if (h.ny > 0 && p.auSol) p.repos = true;
            }
          } else p.pos.addScaledVector(p.vel, dt);
          if (p.fleche && !p.repos) p.mesh.lookAt(p.pos.x + dx, p.pos.y + dy, p.pos.z + dz);
        }
        if (p.pos.y <= 0.07) {
          p.pos.y = 0.07;
          if (p.fleche) { p.repos = true; p.vie = 0; }
          else {
            if (p.vel.y < -2) this.audio.rebond(p.pos);
            p.vel.y = Math.abs(p.vel.y) * 0.3;
            p.vel.x *= 0.6; p.vel.z *= 0.6;
            if (p.auSol) p.repos = true;
          }
        }
      }
      p.mesh.position.copy(p.pos);
      if (!p.fleche) p.mesh.rotation.x += dt * 8;
      if ((p.auSol && p.repos) || p.vie <= 0) {
        p.fini = true;
        this.scene.remove(p.mesh);
        this.effetPoint(p.def, { x: p.pos.x, y: Math.max(0, p.pos.y - 0.07), z: p.pos.z }, p.lanceur, p.capId, p);
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.fini);
  }

  // Effet d'une grenade ou d'une capacité ciblée à l'endroit p
  effetPoint(def, p, lanceur, capId, projectile = null) {
    switch (def.effet) {
      case "fumee": this.deployerFumee(p, def.duree || 15, def.couleur); break;
      case "flash": this.detonerFlash(p, lanceur); break;
      case "explosion": this.exploser(p, def.degats || 80, def.rayon || 4.5, lanceur, capId, def.couleur); break;
      case "commotion": this.onde(p, def, lanceur, "commotion"); break;
      case "emp": this.onde(p, def, lanceur, "emp", capId); break;
      case "feu": case "ralenti": case "soin": case "sonar": case "trouNoir": case "frappe":
        this.creerZone(def, p, lanceur, capId, projectile);
        break;
      case "brouillard": {
        const n = def.nombre || 5;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2, r = i === 0 ? 0 : 3.4;
          const q = this.sol(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, Math.max(2, p.y + 1));
          if (i === 0 || this.carte.monde.ligneLibre(p.x, 1, p.z, q.x, 1, q.z)) this.deployerFumee(q, def.duree || 14, def.couleur);
        }
        this.creerZone({ ...def, effet: "ralenti", rayon: def.rayon || 6, duree: def.duree || 14, facteur: def.facteur || 0.7, invisible: true }, p, lanceur, capId);
        break;
      }
      case "multiFlash": {
        const n = def.nombre || 3;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + Math.random();
          const q = { x: p.x + Math.cos(a) * 3, y: (p.y || 0) + 2.2, z: p.z + Math.sin(a) * 3 };
          this.differes.push({ t: 0.35 + i * 0.3, fn: () => this.detonerFlash(q, lanceur) });
        }
        this.differes.push({ t: 0.3, fn: () => {
          for (const c of this.ennemis(lanceur)) if (Math.hypot(c.x - p.x, c.z - p.z) < 9) this.reveler(c, 3, lanceur.equipe);
        } });
        break;
      }
    }
  }

  // Dégâts de zone avec atténuation, bloqués par les murs
  exploser(p, degats, rayon, lanceur, capId, couleur = 0xff8a3a) {
    const monde = this.carte.monde;
    if (this.effets) this.effets.petiteExplosion(p, rayon, couleur);
    this.audio.capacite("explosion", p);
    for (const c of this.combattants()) {
      if (!c.vivant || !this.estEnnemi(lanceur, c)) continue;
      const d = Math.hypot(c.x - p.x, (c.y || 0) + 1 - (p.y + 0.5), c.z - p.z);
      if (d > rayon) continue;
      if (!monde.ligneLibre(p.x, p.y + 0.5, p.z, c.x, (c.y || 0) + 1, c.z) && d > 1.2) continue;
      const k = Math.pow(1 - d / rayon, 0.6);
      this.degats(c, Math.max(12, degats * k), lanceur, capId);
    }
    for (const t of [...this.tourelles]) if (this.estEnnemi(lanceur, t) && Math.hypot(t.x - p.x, t.z - p.z) < rayon) this.degatsTourelle(t, degats * 0.6);
  }

  // Onde instantanée : commotion ou IEM
  onde(p, def, lanceur, type, capId) {
    const monde = this.carte.monde;
    const rayon = def.rayon || 5;
    if (this.effets) { this.effets.anneau(p, rayon, type === "emp" ? 0x7cffd4 : 0xffd166, 0.5, 0.4); this.effets.anneau(p, rayon * 0.6, 0xffffff, 0.35, 0.8); }
    this.audio.capacite(type, p);
    for (const c of this.combattants()) {
      if (!c.vivant || !this.estEnnemi(lanceur, c)) continue;
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d > rayon || !monde.ligneLibre(p.x, p.y + 0.4, p.z, c.x, (c.y || 0) + 1, c.z)) continue;
      if (type === "commotion") c.commotionT = Math.max(c.commotionT || 0, def.duree || 3);
      else { c.empT = Math.max(c.empT || 0, def.duree || 6); this.degats(c, def.degats || 20, lanceur, capId); this.reveler(c, 1.5, lanceur.equipe); }
    }
  }

  // ===== Fumées et flashs =====
  deployerFumee(p, duree = 15, couleur = null) {
    const groupe = new THREE.Group();
    const n = this.qualite === "basse" ? 9 : 14;
    const sprites = [];
    const base = new THREE.Color(couleur || 0xa9b4c6);
    for (let i = 0; i < n; i++) {
      const col = base.clone().multiplyScalar(i % 3 ? 1 : 0.9);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texFumee, color: col, transparent: true, opacity: 0, depthWrite: false }));
      const a = (i / n) * Math.PI * 2, r = i === 0 ? 0 : 1 + Math.random() * 1.4;
      s.position.set(Math.cos(a) * r, 0.9 + Math.random() * 2.4, Math.sin(a) * r);
      s.userData.taille = 3.2 + Math.random() * 1.6;
      s.material.rotation = Math.random() * 6;
      groupe.add(s);
      sprites.push(s);
    }
    groupe.position.set(p.x, p.y || 0, p.z);
    this.scene.add(groupe);
    this.fumees.push({ x: p.x, z: p.z, y: p.y || 0, rayon: 3.1, t: 0, duree, groupe, sprites });
    this.audio.fumee(p);
  }

  // Les flashs n'aveuglent que les adversaires du lanceur
  detonerFlash(p, lanceur = null) {
    this.eclat.position.set(p.x, Math.max(p.y, 0.3) + 0.2, p.z);
    this.eclat.visible = true;
    this.eclatT = 0.35;
    this.lumiere.position.copy(this.eclat.position);
    this.lumiere.intensity = 60;
    this.audio.flash(p);
    const monde = this.carte.monde;
    const py = this.eclat.position.y;
    for (const c of this.combattants()) {
      if (!c.vivant || (lanceur && !this.estEnnemi(lanceur, c))) continue;
      const dx = p.x - c.x, dy = py - c.yeux, dz = p.z - c.z, d = Math.hypot(dx, dy, dz);
      if (d > 34 || !monde.ligneLibre(c.x, c.yeux, c.z, p.x, py, p.z)) continue;
      if (this.fumeeBloque(c.x, c.yeux, c.z, p.x, py, p.z)) continue;
      const lacet = c.estJoueur ? c.lacet : c.yaw;
      const tangage = c.estJoueur ? c.tangage : 0;
      // Direction du regard (joueur : lacet 0 = -Z ; bots : yaw 0 = +Z)
      const vx = c.estJoueur ? -Math.sin(lacet) * Math.cos(tangage) : Math.sin(lacet);
      const vz = c.estJoueur ? -Math.cos(lacet) * Math.cos(tangage) : Math.cos(lacet);
      const vy = c.estJoueur ? Math.sin(tangage) : 0;
      const cos = (vx * dx + vy * dy + vz * dz) / Math.max(d, 0.01);
      if (cos < -0.15 && d > 2) continue;
      let intensite = Math.pow(Math.min(1, Math.max(0, cos + 0.15)), 0.7) * Math.min(1, 1.2 - d / 34);
      if (d < 2) intensite = Math.max(intensite, 0.6); // trop près : aveuglé même de dos
      if (intensite <= 0.05) continue;
      if (this.surAveugle) this.surAveugle(c, intensite, 0.5 + 2.4 * intensite);
    }
  }

  // Une fumée coupe-t-elle la ligne A → B ? (colonne de fumée de 4,5 m de haut)
  fumeeBloque(ax, ay, az, bx, by, bz) {
    for (const f of this.fumees) {
      const k = Math.min(1, f.t / 0.8) * (f.t > f.duree - 1.2 ? (f.duree - f.t) / 1.2 : 1);
      if (k < 0.45) continue;
      const r = f.rayon * k;
      const sx = bx - ax, sz = bz - az, l2 = sx * sx + sz * sz;
      let t = l2 > 1e-6 ? ((f.x - ax) * sx + (f.z - az) * sz) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      const px = ax + sx * t, pz = az + sz * t;
      if ((px - f.x) ** 2 + (pz - f.z) ** 2 > r * r) continue;
      const y = ay + (by - ay) * t;
      if (y < f.y + 4.6) return true;
    }
    return false;
  }

  dansFumee(x, y, z) {
    for (const f of this.fumees) {
      const k = Math.min(1, f.t / 0.8);
      if (k > 0.5 && y < f.y + 4.4 && (x - f.x) ** 2 + (z - f.z) ** 2 < (f.rayon * 0.85) ** 2) return true;
    }
    return false;
  }

  majFumees(dt) {
    for (const f of this.fumees) {
      f.t += dt;
      const entree = Math.min(1, f.t / 0.7), sortie = f.t > f.duree - 1.5 ? Math.max(0, (f.duree - f.t) / 1.5) : 1;
      for (const s of f.sprites) {
        s.material.opacity = 0.97 * entree * sortie;
        const k = 0.35 + 0.65 * entree;
        s.scale.setScalar(s.userData.taille * k);
        s.material.rotation += dt * 0.05;
      }
      if (f.t >= f.duree) { this.scene.remove(f.groupe); for (const s of f.sprites) s.material.dispose(); f.fini = true; }
    }
    this.fumees = this.fumees.filter((f) => !f.fini);
  }

  // Ligne de fumées devant le lanceur (s'arrête au premier mur)
  murFumee(lanceur, dir, def) {
    const monde = this.carte.monde;
    const n = def.nombre || 5, e = def.espacement || 2.6;
    let posees = 0;
    for (let i = 0; i < n; i++) {
      const d = 2.5 + i * e;
      if (!monde.ligneLibre(lanceur.x, 1.2, lanceur.z, lanceur.x + dir.x * d, 1.2, lanceur.z + dir.z * d)) break;
      const p = this.sol(lanceur.x + dir.x * d, lanceur.z + dir.z * d, 3);
      this.differes.push({ t: i * 0.08, fn: () => this.deployerFumee(p, def.duree || 12, def.couleur) });
      if (def.commotion) {
        this.differes.push({ t: i * 0.08 + 0.1, fn: () => {
          for (const c of this.ennemis(lanceur)) if (Math.hypot(c.x - p.x, c.z - p.z) < 3) c.commotionT = Math.max(c.commotionT || 0, def.commotion);
        } });
      }
      posees++;
    }
    return posees > 0;
  }

  // ===== Zones au sol =====
  creerZone(def, p, lanceur, capId, projectile = null) {
    const effet = def.effet;
    const couleur = def.couleur || COULEURS_EFFET[effet] || 0xffffff;
    const rayon = def.rayon || 4;
    const groupe = new THREE.Group();
    groupe.position.set(p.x, (p.y || 0) + 0.03, p.z);
    const z = { def, effet, capId, lanceur, equipe: lanceur.equipe, x: p.x, y: p.y || 0, z: p.z, rayon, t: 0, duree: def.duree || 5, tick: 0, groupe, materiaux: [], sprites: [], pulses: 0 };
    const mat = (c, o) => { const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }); z.materiaux.push(m); return m; };
    if (!def.invisible) {
      if (effet !== "sonar") {
        const disque = new THREE.Mesh(geoDisque, mat(couleur, effet === "frappe" ? 0.12 : 0.15));
        disque.scale.setScalar(rayon);
        const bord = new THREE.Mesh(geoBord, mat(couleur, 0.8));
        bord.scale.setScalar(rayon);
        bord.position.y = 0.01;
        groupe.add(disque, bord);
        z.disque = disque; z.bord = bord;
      }
      // Particules (sprites additifs) : flammes, flocons, lucioles de soin...
      const nb = effet === "feu" ? 10 : effet === "soin" ? 8 : effet === "ralenti" ? 8 : effet === "trouNoir" ? 12 : 0;
      for (let i = 0; i < (this.qualite === "basse" ? Math.ceil(nb / 2) : nb); i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texEclat, color: couleur, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.8 }));
        z.materiaux.push(s.material);
        s.userData = { a: Math.random() * Math.PI * 2, r: Math.sqrt(Math.random()) * rayon * 0.9, h: Math.random(), v: 0.6 + Math.random() };
        groupe.add(s);
        z.sprites.push(s);
      }
    }
    if (effet === "ralenti") z.ralenti = def.facteur || 0.5;
    if (effet === "soin" && def.ralentiEnnemis) z.ralenti = def.ralentiEnnemis;
    if (effet === "trouNoir") {
      const coeur = new THREE.Mesh(new THREE.SphereGeometry(0.9, 20, 14), new THREE.MeshBasicMaterial({ color: 0x050008 }));
      const halo = new THREE.Mesh(new THREE.SphereGeometry(1.3, 20, 14), mat(couleur, 0.35));
      coeur.position.y = halo.position.y = 1.6;
      groupe.add(coeur, halo);
      z.materiaux.push(coeur.material);
      z.geos = [coeur.geometry, halo.geometry];
      z.halo = halo; z.coeur = coeur;
      this.audio.capacite("trouNoir", p);
    }
    if (effet === "sonar") {
      const f = new THREE.Mesh(geoFleche, this.materiauGrenade(couleur));
      f.position.y = 0.15;
      f.rotation.x = Math.PI / 2;
      if (projectile) { f.position.copy(projectile.pos).sub(groupe.position); f.quaternion.copy(projectile.mesh.quaternion); }
      groupe.add(f);
      z.duree = 0.4 + (def.pulses || 2) * 1.3;
      z.prochainPulse = 0.4;
      z.oy = (projectile ? projectile.pos.y : p.y + 0.3);
      if (def.degats) for (const c of this.ennemis(lanceur)) if (Math.hypot(c.x - p.x, c.z - p.z) < 1.5) this.degats(c, def.degats, lanceur, capId);
    }
    if (effet === "frappe") {
      z.duree = (def.delai || 1.2) + 0.15 * (def.nombre || 1) + 0.3;
      z.impacts = [];
      for (let i = 0; i < (def.nombre || 1); i++) {
        const a = Math.random() * Math.PI * 2, r = i === 0 ? 0 : Math.sqrt(Math.random()) * (def.dispersion || 0);
        z.impacts.push({ x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r, t: (def.delai || 1.2) + i * 0.15, fait: false });
      }
      this.audio.capacite("frappe", p);
    }
    if (effet === "feu") this.audio.capacite("feu", p);
    if (effet === "soin" || effet === "ralenti") this.audio.capacite(effet === "soin" ? "soin" : "zone", p);
    this.scene.add(groupe);
    this.zones.push(z);
    return z;
  }

  retirerZone(z) {
    this.scene.remove(z.groupe);
    for (const m of z.materiaux) m.dispose();
    if (z.geos) for (const g of z.geos) g.dispose();
  }

  majZones(dt, temps) {
    const monde = this.carte.monde;
    for (const z of this.zones) {
      z.t += dt;
      const fin = Math.min(1, (z.duree - z.t) / 0.6);
      const entree = Math.min(1, z.t / 0.3);
      const k = Math.max(0, Math.min(entree, fin));
      if (z.disque) { z.disque.material.opacity = (z.effet === "frappe" ? 0.12 + 0.25 * Math.min(1, z.t / (z.def.delai || 1.2)) : 0.15) * k; z.bord.material.opacity = 0.7 * k * (0.75 + 0.25 * Math.sin(temps * 6)); }
      if (z.bord && z.effet === "ralenti") z.bord.rotation.y += dt * 0.6;
      for (const s of z.sprites) {
        const u = s.userData;
        if (z.effet === "trouNoir") {
          u.a += dt * (2 + u.v * 2);
          u.r = Math.max(0.3, u.r - dt * 1.8);
          if (u.r <= 0.31) u.r = z.rayon * (0.7 + Math.random() * 0.3);
          s.position.set(Math.cos(u.a) * u.r, 1.6 + Math.sin(u.a * 2) * 0.3, Math.sin(u.a) * u.r);
          s.scale.setScalar(0.35);
        } else {
          u.h = (u.h + dt * u.v * (z.effet === "feu" ? 0.9 : 0.35)) % 1;
          s.position.set(Math.cos(u.a) * u.r, u.h * (z.effet === "feu" ? 1.4 : 2.2), Math.sin(u.a) * u.r);
          s.scale.setScalar((z.effet === "feu" ? 0.7 : 0.3) * (1 - u.h * 0.6));
          s.material.opacity = 0.85 * k * (1 - u.h);
        }
      }
      z.tick -= dt;
      const tick = z.tick <= 0;
      if (tick) z.tick = 0.25;
      if (z.effet === "feu" && tick) {
        for (const c of this.ennemis(z.lanceur)) if ((c.x - z.x) ** 2 + (c.z - z.z) ** 2 < z.rayon * z.rayon && (c.y || 0) - z.y < 1.5) this.degats(c, (z.def.dps || 30) * 0.25, z.lanceur, z.capId);
      }
      if (z.effet === "ralenti" && tick && z.def.dps) {
        for (const c of this.ennemis(z.lanceur)) if ((c.x - z.x) ** 2 + (c.z - z.z) ** 2 < z.rayon * z.rayon) this.degats(c, z.def.dps * 0.25, z.lanceur, z.capId);
      }
      if (z.effet === "soin" && tick) {
        for (const c of this.allies(z.lanceur)) if ((c.x - z.x) ** 2 + (c.z - z.z) ** 2 < z.rayon * z.rayon && c.vie < 100) c.vie = Math.min(100, c.vie + (z.def.hps || 15) * 0.25);
      }
      if (z.effet === "sonar" && z.t >= z.prochainPulse && z.pulses < (z.def.pulses || 2)) {
        z.pulses++;
        z.prochainPulse += 1.3;
        if (this.effets) this.effets.anneau({ x: z.x, y: z.y, z: z.z }, z.rayon, z.def.couleur || 0x5affd1, 0.8, 0.5);
        this.audio.capacite("sonar", { x: z.x, y: z.oy, z: z.z });
        for (const c of this.ennemis(z.lanceur)) {
          if (Math.hypot(c.x - z.x, c.z - z.z) > z.rayon) continue;
          if (!monde.ligneLibre(z.x, z.oy + 0.2, z.z, c.x, c.yeux - 0.3, c.z) && !monde.ligneLibre(z.x, z.oy + 0.2, z.z, c.x, (c.y || 0) + 0.6, c.z)) continue;
          this.reveler(c, 2.2, z.equipe);
        }
      }
      if (z.effet === "trouNoir") {
        if (z.halo) { z.halo.scale.setScalar(1 + Math.sin(temps * 9) * 0.08); z.halo.material.opacity = 0.35 * k; z.coeur.scale.setScalar(Math.max(0.05, k)); }
        if (z.t < z.duree - 0.25) {
          for (const c of this.ennemis(z.lanceur)) {
            const dx = z.x - c.x, dz = z.z - c.z, d = Math.hypot(dx, dz);
            if (d > z.rayon || d < 0.4) continue;
            this.deplacer(c, (dx / d) * 3.4 * dt, (dz / d) * 3.4 * dt);
          }
        } else if (!z.explose) {
          z.explose = true;
          if (this.effets) this.effets.petiteExplosion({ x: z.x, y: z.y + 1.2, z: z.z }, z.rayon * 0.8, z.def.couleur || 0xb07cff);
          this.audio.capacite("explosion", z);
          for (const c of this.ennemis(z.lanceur)) if (Math.hypot(c.x - z.x, c.z - z.z) < z.rayon * 0.75) this.degats(c, z.def.degats || 70, z.lanceur, z.capId);
        }
      }
      if (z.effet === "frappe") {
        for (const i of z.impacts) if (!i.fait && z.t >= i.t) { i.fait = true; this.exploser(this.sol(i.x, i.z, Math.max(3, z.y + 2)), z.def.degats || 80, z.rayon, z.lanceur, z.capId, z.def.couleur || 0xffa040); }
      }
      if (z.t >= z.duree) { z.fini = true; this.retirerZone(z); }
    }
    this.zones = this.zones.filter((z) => !z.fini);
  }

  // Déplace un combattant (aspiration) sans traverser les murs
  deplacer(c, dx, dz) {
    const monde = this.carte.monde;
    if (c.estJoueur) {
      if (!monde.bloque(c.pos.x + dx, c.pos.z, c.pos.y, 0.35)) c.pos.x += dx;
      if (!monde.bloque(c.pos.x, c.pos.z + dz, c.pos.y, 0.35)) c.pos.z += dz;
    } else if (!c.distant) {
      if (!monde.bloque(c.x + dx, c.z, 0, 0.35)) c.x += dx;
      if (!monde.bloque(c.x, c.z + dz, 0, 0.35)) c.z += dz;
    }
  }

  // ===== Bonus =====
  buff(c, def) {
    if (def.condition === "blesse" && c.vie >= 100 && !def.cadence && !def.vitesse) return false;
    if (def.armure) {
      if ((c.armure || 0) >= 100) return false;
      c.armure = Math.min(100, (c.armure || 0) + def.armure);
      this.audio.capacite("bouclier", c.estJoueur ? null : { x: c.x, y: 1, z: c.z });
    }
    if (def.soin) { this.ajouterSoin(c, def.soin, def.dureeSoin || 2); this.audio.soin(); }
    if (def.cadence) { c.cadenceT = def.duree; c.cadenceK = def.cadence; }
    if (def.vitesse) { c.vitesseT = def.duree; c.vitesseK = def.vitesse; }
    if (def.rechargeRapide) c.rechargeRapideT = def.duree;
    if (this.effets && !c.estJoueur) this.effets.anneau({ x: c.x, y: 0, z: c.z }, 1.4, 0xffffff, 0.5);
    return true;
  }

  bonusEquipe(c, def) {
    const cibles = this.allies(c, def.rayon || 0);
    if (!cibles.includes(c)) cibles.push(c);
    for (const x of cibles) {
      if (def.armure) x.armure = Math.min(100, (x.armure || 0) + def.armure);
      if (def.soin) x.vie = Math.min(100, x.vie + def.soin);
      if (def.cadence) { x.cadenceT = def.duree; x.cadenceK = def.cadence; }
      if (def.vitesse) { x.vitesseT = def.duree; x.vitesseK = def.vitesse; }
      if (def.munitions) {
        if (x.estJoueur) { if (x.remplirMunitions) x.remplirMunitions(); }
        else if (x.arme && ARMES[x.arme]) { x.mun = ARMES[x.arme].chargeur || 1; x.rechargeT = 0; }
      }
      if (this.effets) this.effets.apparition({ x: x.x, y: x.y || 0, z: x.z }, def.armure ? 0x8ab4ff : 0x9cff6a);
    }
    this.audio.capacite(def.armure && !def.soin ? "bouclier" : "soin", c.estJoueur ? null : { x: c.x, y: 1, z: c.z });
    return true;
  }

  // ===== Révélations =====
  sonar(c, def) {
    const global = !def.rayon;
    if (this.effets) this.effets.anneau({ x: c.x, y: 0, z: c.z }, global ? 40 : def.rayon, 0x5affd1, global ? 1.4 : 0.9, 0.4);
    this.audio.capacite("sonar", c.estJoueur ? null : { x: c.x, y: 1, z: c.z });
    for (const e of this.ennemis(c)) if (global || Math.hypot(e.x - c.x, e.z - c.z) <= def.rayon) this.reveler(e, def.duree || 3, c.equipe);
    if (def.vitesse) { c.vitesseT = def.duree; c.vitesseK = def.vitesse; }
  }

  cone(c, dir, def) {
    const cosMax = Math.cos(((def.angle || 50) / 2) * Math.PI / 180);
    if (this.effets) this.effets.anneau({ x: c.x + dir.x * 4, y: 0, z: c.z + dir.z * 4 }, 4, 0xffc845, 0.6, 0.5);
    this.audio.capacite("sonar", c.estJoueur ? null : { x: c.x, y: 1, z: c.z });
    for (const e of this.ennemis(c)) {
      const dx = e.x - c.x, dz = e.z - c.z, d = Math.hypot(dx, dz);
      if (d > (def.portee || 40) || d < 0.1) continue;
      if ((dx * dir.x + dz * dir.z) / d < cosMax) continue;
      this.reveler(e, def.duree || 4, c.equipe);
    }
  }

  // ===== Séisme (autour du lanceur, après un court délai) =====
  seisme(c, def, capId) {
    const p = { x: c.x, y: c.y || 0, z: c.z };
    if (this.effets) this.effets.anneau(p, 1.5, 0xffa62b, 0.3);
    this.differes.push({ t: def.delai || 0.45, fn: () => {
      if (this.effets) { this.effets.anneau(p, def.rayon, 0xffa62b, 0.7, 0.1); this.effets.anneau(p, def.rayon * 0.6, 0xffe08a, 0.5, 0.3); }
      this.audio.capacite("seisme", p);
      for (const e of this.ennemis(c)) {
        const d = Math.hypot(e.x - p.x, e.z - p.z);
        if (d > def.rayon || (e.y || 0) > 1.2) continue;
        this.degats(e, (def.degats || 60) * (1 - 0.5 * d / def.rayon), c, capId);
        e.entraveT = Math.max(e.entraveT || 0, def.ralenti || 3);
      }
    } });
  }

  // ===== Mur d'énergie (longueur, résistance, durée et couleur réglables) =====
  poserMur(lanceur, dir, def = {}) {
    const monde = this.carte.monde;
    const selonX = Math.abs(dir.z) >= Math.abs(dir.x); // le mur s'étend sur X quand on regarde vers ±Z
    const demiL = (def.longueur || 4.5) / 2, demiE = 0.2;
    const vie = def.vie || 600, couleur = def.couleur || 0x7fb8ff;
    for (const recul of [2.6, 3.6, 1.8]) {
      const cx = lanceur.x + dir.x * recul, cz = lanceur.z + dir.z * recul;
      const b = selonX
        ? { minX: cx - demiL, maxX: cx + demiL, minZ: cz - demiE, maxZ: cz + demiE }
        : { minX: cx - demiE, maxX: cx + demiE, minZ: cz - demiL, maxZ: cz + demiL };
      const occupe = this.combattants().some((c) => c.vivant && c.x > b.minX - 0.45 && c.x < b.maxX + 0.45 && c.z > b.minZ - 0.45 && c.z < b.maxZ + 0.45);
      if (occupe) continue;
      const y0 = this.sol(cx, cz, 2).y;
      const mur = { t: 0, duree: def.duree || 14, vie, vieMax: vie, equipe: lanceur.equipe, type: "mur" };
      mur.boite = monde.ajouter(b.minX, y0, b.minZ, b.maxX, y0 + 3.2, b.maxZ, { type: "mur", competence: mur });
      const geo = new THREE.BoxGeometry(b.maxX - b.minX, 3.2, b.maxZ - b.minZ);
      const c = new THREE.Color(couleur);
      mur.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: c, emissive: c.clone().multiplyScalar(0.55), emissiveIntensity: 0.9, transparent: true, opacity: 0.55, roughness: 0.2, metalness: 0.2, depthWrite: false }));
      const aretes = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: c.clone().lerp(new THREE.Color(0xffffff), 0.5) }));
      mur.mesh.add(aretes);
      mur.aretes = aretes;
      mur.mesh.position.set(cx, y0 + 1.6, cz);
      mur.mesh.scale.y = 0.01;
      this.scene.add(mur.mesh);
      // La grille de navigation des bots contourne le mur
      const nav = this.carte.nav;
      mur.cellules = [];
      for (let x = b.minX - 0.45; x <= b.maxX + 0.45; x += nav.cellule * 0.5) {
        for (let z = b.minZ - 0.45; z <= b.maxZ + 0.45; z += nav.cellule * 0.5) {
          const k = nav.indice(x, z);
          if (k >= 0 && nav.libre[k]) { nav.libre[k] = 0; mur.cellules.push(k); }
        }
      }
      this.murs.push(mur);
      this.audio.mur({ x: cx, y: 1, z: cz });
      return true;
    }
    return false;
  }

  // Dégâts sur un objet de capacité touché par une balle (mur, tourelle)
  degatsObjet(obj, degats) {
    if (obj.type === "tourelle") this.degatsTourelle(obj, degats);
    else this.degatsMur(obj, degats);
  }

  degatsMur(mur, degats) {
    if (mur.type === "tourelle") { this.degatsTourelle(mur, degats); return; }
    mur.vie -= degats;
    if (mur.vie <= 0) this.detruireMur(mur);
  }

  detruireMur(mur) {
    if (mur.detruit) return;
    mur.detruit = true;
    const monde = this.carte.monde;
    monde.boites = monde.boites.filter((b) => b !== mur.boite);
    for (const k of mur.cellules) this.carte.nav.libre[k] = 1;
    this.scene.remove(mur.mesh);
    mur.mesh.geometry.dispose();
    mur.mesh.material.dispose();
    mur.aretes.geometry.dispose();
    mur.aretes.material.dispose();
    this.murs = this.murs.filter((m) => m !== mur);
  }

  majMurs(dt) {
    for (const m of [...this.murs]) {
      m.t += dt;
      m.mesh.scale.y = Math.min(1, m.t / 0.35);
      m.mesh.material.opacity = 0.3 + 0.25 * (m.vie / m.vieMax) + Math.sin(m.t * 6) * 0.03;
      if (m.t > m.duree) this.detruireMur(m);
    }
  }

  // ===== Pièges (mine, fil, lianes) =====
  poserPiege(lanceur, dir, def, capId) {
    const monde = this.carte.monde;
    let d = 3;
    const h = monde.rayon(lanceur.x, 0.4, lanceur.z, dir.x, 0, dir.z, 3.5);
    if (h) d = Math.max(0.6, h.t - 0.5);
    const p = this.sol(lanceur.x + dir.x * d, lanceur.z + dir.z * d, (lanceur.y || 0) + 1.5);
    // Charges max du piège : on retire le plus ancien de ce lanceur
    const siens = this.pieges.filter((x) => x.lanceur === lanceur && x.capId === capId);
    if (siens.length >= (def.charges || 2)) this.retirerPiege(siens[0]);
    const couleur = def.couleur || 0x9cff3a;
    const mesh = new THREE.Group();
    const socle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.06, 12), new THREE.MeshStandardMaterial({ color: 0x2a2f38, metalness: 0.6, roughness: 0.4 }));
    const voyant = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: couleur, toneMapped: false }));
    voyant.position.y = 0.06;
    const cercle = new THREE.Mesh(geoBord, new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    cercle.scale.setScalar(def.declencheur || 2.2);
    cercle.position.y = -0.01;
    mesh.add(socle, voyant, cercle);
    mesh.position.set(p.x, p.y + 0.03, p.z);
    this.scene.add(mesh);
    this.pieges.push({ x: p.x, y: p.y, z: p.z, def, capId, lanceur, equipe: lanceur.equipe, mesh, voyant, t: 0, arme: 0.6 });
    this.audio.capacite("piege", p);
    return true;
  }

  retirerPiege(p) {
    this.scene.remove(p.mesh);
    p.mesh.traverse((o) => { if (o.geometry && o.geometry !== geoBord) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    this.pieges = this.pieges.filter((x) => x !== p);
  }

  majPieges(dt, temps) {
    for (const p of [...this.pieges]) {
      p.t += dt;
      p.voyant.visible = Math.floor(temps * 2.5) % 2 === 0;
      if (p.t < p.arme) continue;
      const r = p.def.declencheur || 2.2;
      const cible = this.ennemis(p.lanceur).find((c) => Math.hypot(c.x - p.x, c.z - p.z) < r && Math.abs((c.y || 0) - p.y) < 1.2);
      if (!cible) continue;
      if (this.effets) { this.effets.anneau(p, r * 1.4, p.def.couleur || 0x9cff3a, 0.5, 0.2); this.effets.etincellesEn({ x: p.x, y: p.y + 0.2, z: p.z }, { x: 0, y: 1.5, z: 0 }, p.def.couleur || 0x9cff3a, 16); }
      this.audio.capacite("piege", p);
      for (const c of this.ennemis(p.lanceur)) {
        if (Math.hypot(c.x - p.x, c.z - p.z) > r * 1.2) continue;
        if (p.def.degats) this.degats(c, p.def.degats, p.lanceur, p.capId);
        if (p.def.ralenti) c.entraveT = Math.max(c.entraveT || 0, p.def.ralenti);
        if (p.def.revele) this.reveler(c, p.def.revele, p.equipe);
      }
      this.retirerPiege(p);
    }
  }

  // ===== Tourelle automatique =====
  poserTourelle(lanceur, dir, def, capId) {
    const monde = this.carte.monde;
    for (const t of [...this.tourelles]) if (t.lanceur === lanceur) this.detruireTourelle(t, false);
    let d = 1.6;
    const h = monde.rayon(lanceur.x, 0.5, lanceur.z, dir.x, 0, dir.z, 2.2);
    if (h) d = Math.max(0.7, h.t - 0.5);
    const x = lanceur.x + dir.x * d, z = lanceur.z + dir.z * d;
    const y = this.sol(x, z, (lanceur.y || 0) + 1.5).y;
    const t = { type: "tourelle", x, y, z, def, capId, lanceur, equipe: lanceur.equipe, vie: def.vie || 160, t: 0, duree: def.duree || 25, prochainTir: 0.8, cible: null, cherche: 0, angle: Math.atan2(dir.x, dir.z) };
    const g = new THREE.Group();
    const matCorps = new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.6, roughness: 0.45 });
    const matLueur = new THREE.MeshBasicMaterial({ color: 0x9cff3a, toneMapped: false });
    const pied = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.5, 8), matCorps);
    pied.position.y = 0.25;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.08, 10), matCorps);
    base.position.y = 0.04;
    const tete = new THREE.Group();
    tete.position.y = 0.62;
    const boitier = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.3), matCorps);
    const canon = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.36, 8).rotateX(Math.PI / 2), matCorps);
    canon.position.set(0, 0.02, 0.28);
    const oeil = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), matLueur);
    oeil.position.set(0, 0.04, 0.155);
    tete.add(boitier, canon, oeil);
    g.add(pied, base, tete);
    g.position.set(x, y, z);
    tete.rotation.y = t.angle;
    this.scene.add(g);
    t.mesh = g; t.tete = tete; t.materiaux = [matCorps, matLueur];
    t.boite = monde.ajouter(x - 0.22, y, z - 0.22, x + 0.22, y + 0.78, z + 0.22, { type: "tourelle", competence: t });
    this.tourelles.push(t);
    this.audio.capacite("bouclier", { x, y: y + 0.5, z });
    return true;
  }

  degatsTourelle(t, degats) {
    t.vie -= degats;
    if (t.vie <= 0) this.detruireTourelle(t, true);
  }

  detruireTourelle(t, explosion) {
    if (t.detruite) return;
    t.detruite = true;
    const monde = this.carte.monde;
    monde.boites = monde.boites.filter((b) => b !== t.boite);
    this.scene.remove(t.mesh);
    t.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const m of t.materiaux) m.dispose();
    if (explosion && this.effets) this.effets.petiteExplosion({ x: t.x, y: t.y + 0.4, z: t.z }, 1.5, 0xffc27a);
    this.tourelles = this.tourelles.filter((x) => x !== t);
  }

  majTourelles(dt) {
    const monde = this.carte.monde;
    for (const t of [...this.tourelles]) {
      t.t += dt;
      if (t.t > t.duree) { this.detruireTourelle(t, false); continue; }
      const oy = t.y + 0.66;
      t.cherche -= dt;
      if (t.cherche <= 0) {
        t.cherche = 0.15;
        let meilleur = null, dMin = t.def.portee || 28;
        for (const c of this.ennemis(t)) {
          const d = Math.hypot(c.x - t.x, c.z - t.z);
          if (d > dMin || this.invisible(c)) continue;
          if (!monde.ligneLibre(t.x, oy, t.z, c.x, c.yeux - 0.3, c.z) || this.fumeeBloque(t.x, oy, t.z, c.x, c.yeux - 0.3, c.z)) continue;
          dMin = d; meilleur = c;
        }
        t.cible = meilleur;
      }
      const c = t.cible;
      if (!c || !c.vivant) { t.tete.rotation.y += dt * 0.8; continue; }
      const voulu = Math.atan2(c.x - t.x, c.z - t.z);
      let diff = voulu - t.tete.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      t.tete.rotation.y += Math.sign(diff) * Math.min(Math.abs(diff), 5 * dt);
      t.prochainTir -= dt;
      if (Math.abs(diff) > 0.12 || t.prochainTir > 0) continue;
      t.prochainTir = t.def.cadence || 0.24;
      const d = Math.hypot(c.x - t.x, c.z - t.z);
      const chance = d < 10 ? 0.6 : d < 20 ? 0.42 : 0.28;
      const depart = { x: t.x + Math.sin(t.tete.rotation.y) * 0.45, y: oy + 0.02, z: t.z + Math.cos(t.tete.rotation.y) * 0.45 };
      const touche = Math.random() < chance * (Math.hypot(c.vx || 0, c.vz || 0) > 3 ? 0.7 : 1);
      const arrivee = { x: c.x + (touche ? 0 : (Math.random() - 0.5) * 1.4), y: c.yeux - 0.45 + (touche ? 0 : Math.random() * 0.8), z: c.z + (touche ? 0 : (Math.random() - 0.5) * 1.4) };
      if (this.surTirTourelle) this.surTirTourelle(depart, arrivee, t);
      this.audio.capacite("tourelle", depart);
      if (touche) this.degats(c, t.def.degats || 9, t.lanceur, t.capId);
    }
  }

  // ===== Drone éclaireur =====
  lancerDrone(lanceur, dir, duree = 6) {
    const mesh = new THREE.Group();
    const corps = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.22), new THREE.MeshStandardMaterial({ color: 0x2a2f38, metalness: 0.6, roughness: 0.4 }));
    mesh.add(corps);
    const matRotor = new THREE.MeshBasicMaterial({ color: 0x9aa6b8, transparent: true, opacity: 0.5 });
    for (const [x, z] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.005, 12), matRotor);
      r.position.set(x, 0.04, z);
      r.userData.rotor = true;
      mesh.add(r);
    }
    const oeil = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd166, toneMapped: false }));
    oeil.position.set(0, -0.02, -0.12);
    mesh.add(oeil);
    const d = new THREE.Vector3(dir.x, 0, dir.z).normalize();
    mesh.position.set(lanceur.x + d.x * 0.6, (lanceur.y || 0) + 1.6, lanceur.z + d.z * 0.6);
    mesh.rotation.y = Math.atan2(-d.x, -d.z);
    this.scene.add(mesh);
    this.drones.push({ mesh, dir: d, t: 0, duree, lanceur, equipe: lanceur.equipe, scanT: 0, oeil, y0: mesh.position.y, son: this.audio.droneStart() });
  }

  majDrones(dt) {
    const monde = this.carte.monde;
    for (const d of this.drones) {
      d.t += dt;
      const p = d.mesh.position;
      const h = monde.rayon(p.x, p.y, p.z, d.dir.x, 0, d.dir.z, 7 * dt + 0.4);
      if (!h) p.addScaledVector(d.dir, 7 * dt);
      p.y = d.y0 + Math.sin(d.t * 4) * 0.05;
      for (const r of d.mesh.children) if (r.userData.rotor) r.rotation.y += dt * 60;
      d.oeil.visible = Math.floor(d.t * 4) % 2 === 0;
      this.audio.droneMaj(d.son, p);
      d.scanT -= dt;
      if (d.scanT <= 0) {
        d.scanT = 0.25;
        for (const c of this.combattants()) {
          if (!c.vivant || !this.estEnnemi(d.lanceur, c)) continue;
          const dist = Math.hypot(c.x - p.x, c.z - p.z);
          if (dist > 24 || !monde.ligneLibre(p.x, p.y, p.z, c.x, c.yeux, c.z) || this.fumeeBloque(p.x, p.y, p.z, c.x, c.yeux, c.z)) continue;
          this.reveler(c, 2.5, d.equipe);
        }
      }
      if (d.t >= d.duree) {
        d.fini = true;
        this.scene.remove(d.mesh);
        d.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        this.audio.droneStop(d.son);
      }
    }
    this.drones = this.drones.filter((d) => !d.fini);
  }

  // Ennemis révélés : un losange rouge au-dessus de la tête, visible à travers le décor
  majMarqueurs(cibles, temps) {
    for (let i = 0; i < this.marqueurs.length; i++) {
      const s = this.marqueurs[i], c = cibles[i];
      s.visible = !!c;
      if (c) { s.position.set(c.x, c.yeux + 0.55 + Math.sin(temps * 5) * 0.04, c.z); }
    }
  }

  maj(dt, temps = 0) {
    for (const d of this.differes) { d.t -= dt; if (d.t <= 0 && !d.fait) { d.fait = true; d.fn(); } }
    this.differes = this.differes.filter((d) => !d.fait);
    this.majProjectiles(dt);
    this.majFumees(dt);
    this.majMurs(dt);
    this.majDrones(dt);
    this.majZones(dt, temps);
    this.majPieges(dt, temps);
    this.majTourelles(dt);
    if (this.eclatT > 0) {
      this.eclatT -= dt;
      const k = Math.max(0, this.eclatT / 0.35);
      this.eclat.scale.setScalar(6 * k + 0.5);
      this.matEclat.opacity = k;
      if (this.eclatT <= 0) this.eclat.visible = false;
    }
    this.lumiere.intensity *= Math.exp(-14 * dt);
  }
}
