// Agents et compétences : fumée (C), flash (Q), compétence signature (E) et ultime (X).
// Les grenades suivent une vraie trajectoire (gravité, rebonds sur les murs).
import * as THREE from "three";
import { textureEclat } from "./textures.js";

export const AGENTS = {
  volt: { id: "volt", nom: "Volt", role: "Duelliste", couleur: "#7cffd4", signature: "ruee", ultime: "surcharge", texte: "Rapide et offensif : il entre le premier sur les sites." },
  rempart: { id: "rempart", nom: "Rempart", role: "Sentinelle", couleur: "#8ab4ff", signature: "mur", ultime: "bastion", texte: "Bloque les passages et protège son équipe." },
  faucon: { id: "faucon", nom: "Faucon", role: "Initiateur", couleur: "#ffd166", signature: "drone", ultime: "sonar", texte: "Trouve les ennemis avant le combat." },
  aube: { id: "aube", nom: "Aube", role: "Soutien", couleur: "#9cff3a", signature: "soin", ultime: "renouveau", texte: "Garde son équipe en vie plus longtemps." },
};

export const CAPACITES = {
  fumee: { nom: "Fumée", prix: 100, max: 2, texte: "Grenade fumigène : bloque la vue pendant 15 s." },
  flash: { nom: "Flash", prix: 200, max: 2, texte: "Grenade aveuglante. Détourne le regard !" },
  ruee: { nom: "Ruée", recharge: 8, texte: "Dash rapide dans la direction du mouvement." },
  mur: { nom: "Rempart", recharge: 35, texte: "Mur d'énergie de 4,5 m pendant 14 s (on peut le détruire)." },
  drone: { nom: "Drone éclaireur", recharge: 30, texte: "Drone qui avance et révèle les ennemis qu'il voit." },
  soin: { nom: "Régénération", recharge: 30, texte: "Rend 50 PV en 2,5 s." },
  surcharge: { nom: "Surcharge", texte: "10 s : cadence de tir +25 %, vitesse +15 %." },
  bastion: { nom: "Bastion", texte: "Toute ton équipe reçoit +50 de bouclier et 50 PV." },
  sonar: { nom: "Sonar", texte: "Révèle tous les ennemis pendant 6 s." },
  renouveau: { nom: "Renouveau", texte: "Soigne entièrement toute ton équipe." },
};
export const POINTS_ULTIME = 5;

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

export class Competences {
  constructor(scene, carte, audio, qualite) {
    this.scene = scene;
    this.carte = carte;
    this.audio = audio;
    this.qualite = qualite;
    this.combattants = () => [];
    this.estEnnemi = (a, b) => a.equipe !== b.equipe;
    this.surAveugle = null;   // (combattant, intensite, duree)
    this.surRevele = null;    // (cible, duree, equipe)
    this.projectiles = [];
    this.fumees = [];
    this.murs = [];
    this.drones = [];

    this.texFumee = textureFumee();
    this.geoGrenade = new THREE.SphereGeometry(0.07, 10, 8);
    this.matGrenades = {
      fumee: new THREE.MeshStandardMaterial({ color: 0x8fa0b8, roughness: 0.5, metalness: 0.4, emissive: 0x3fa8ff, emissiveIntensity: 0.6 }),
      flash: new THREE.MeshStandardMaterial({ color: 0xe8e8f0, roughness: 0.4, metalness: 0.5, emissive: 0xffe08a, emissiveIntensity: 0.9 }),
    };
    this.matEclat = new THREE.SpriteMaterial({ map: textureEclat(), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
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
    for (const f of this.fumees) this.scene.remove(f.groupe);
    for (const m of [...this.murs]) this.detruireMur(m);
    for (const d of this.drones) { this.scene.remove(d.mesh); this.audio.droneStop(d.son); }
    this.projectiles = [];
    this.fumees = [];
    this.drones = [];
  }

  // ----- Grenades -----
  // lanceur : combattant ; cible : point visé (bots) ; dir : direction du regard (joueur)
  lancer(type, lanceur, cible = null, dir = null) {
    const o = new THREE.Vector3(lanceur.x, lanceur.yeux - 0.1, lanceur.z);
    const v = new THREE.Vector3();
    if (dir) {
      o.addScaledVector(dir, 0.5);
      v.copy(dir).multiplyScalar(type === "flash" ? 17 : 15);
      v.y += 2.5;
    } else {
      const dx = cible.x - o.x, dz = cible.z - o.z, dh = Math.hypot(dx, dz);
      const T = Math.max(0.55, Math.min(1.4, dh / 13));
      v.set(dx / T, (cible.y - o.y) / T + 0.5 * GRAVITE * T, dz / T);
    }
    const mesh = new THREE.Mesh(this.geoGrenade, this.matGrenades[type]);
    mesh.position.copy(o);
    this.scene.add(mesh);
    this.projectiles.push({ type, pos: o, vel: v, vie: type === "flash" ? (dir ? 0.75 : 0.95) : 4, mesh, lanceur, repos: false });
    this.audio.lancer();
  }

  majProjectiles(dt) {
    const monde = this.carte.monde;
    for (const p of this.projectiles) {
      p.vie -= dt;
      if (!p.repos) {
        p.vel.y -= GRAVITE * dt;
        const d = p.vel.length() * dt;
        if (d > 1e-5) {
          const dx = p.vel.x / p.vel.length(), dy = p.vel.y / p.vel.length(), dz = p.vel.z / p.vel.length();
          const h = monde.rayon(p.pos.x, p.pos.y, p.pos.z, dx, dy, dz, d + 0.07);
          if (h) {
            // Rebond amorti sur le mur touché
            p.pos.set(p.pos.x + dx * (h.t - 0.08), p.pos.y + dy * (h.t - 0.08), p.pos.z + dz * (h.t - 0.08));
            if (h.nx) p.vel.x = -p.vel.x * 0.4;
            if (h.ny) p.vel.y = -p.vel.y * 0.35;
            if (h.nz) p.vel.z = -p.vel.z * 0.4;
            p.vel.multiplyScalar(0.7);
            this.audio.rebond(p.pos);
            if (h.ny > 0 && p.type === "fumee") p.repos = true;
          } else p.pos.addScaledVector(p.vel, dt);
        }
        if (p.pos.y <= 0.07) {
          p.pos.y = 0.07;
          if (p.vel.y < -2) this.audio.rebond(p.pos);
          p.vel.y = Math.abs(p.vel.y) * 0.3;
          p.vel.x *= 0.6; p.vel.z *= 0.6;
          if (p.type === "fumee") p.repos = true;
        }
      }
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.x += dt * 8;
      if (p.type === "fumee" && p.repos) this.deployerFumee(p);
      else if (p.type === "flash" && p.vie <= 0) this.detonerFlash(p);
      else if (p.vie <= 0 && p.type === "fumee") this.deployerFumee(p);
    }
    this.projectiles = this.projectiles.filter((p) => !p.fini);
  }

  deployerFumee(p) {
    p.fini = true;
    this.scene.remove(p.mesh);
    const groupe = new THREE.Group();
    const n = this.qualite === "basse" ? 9 : 14;
    const sprites = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texFumee, color: i % 3 ? 0xa9b4c6 : 0x96a3b8, transparent: true, opacity: 0, depthWrite: false }));
      const a = (i / n) * Math.PI * 2, r = i === 0 ? 0 : 1 + Math.random() * 1.4;
      s.position.set(Math.cos(a) * r, 0.9 + Math.random() * 2.4, Math.sin(a) * r);
      s.userData.taille = 3.2 + Math.random() * 1.6;
      s.material.rotation = Math.random() * 6;
      groupe.add(s);
      sprites.push(s);
    }
    groupe.position.set(p.pos.x, 0, p.pos.z);
    this.scene.add(groupe);
    this.fumees.push({ x: p.pos.x, z: p.pos.z, rayon: 3.1, t: 0, duree: 15, groupe, sprites });
    this.audio.fumee(p.pos);
  }

  detonerFlash(p) {
    p.fini = true;
    this.scene.remove(p.mesh);
    this.eclat.position.copy(p.pos);
    this.eclat.visible = true;
    this.eclatT = 0.35;
    this.lumiere.position.copy(p.pos);
    this.lumiere.intensity = 60;
    this.audio.flash(p.pos);
    const monde = this.carte.monde;
    for (const c of this.combattants()) {
      if (!c.vivant) continue;
      const dx = p.pos.x - c.x, dy = p.pos.y - c.yeux, dz = p.pos.z - c.z, d = Math.hypot(dx, dy, dz);
      if (d > 34 || !monde.ligneLibre(c.x, c.yeux, c.z, p.pos.x, p.pos.y, p.pos.z)) continue;
      if (this.fumeeBloque(c.x, c.yeux, c.z, p.pos.x, p.pos.y, p.pos.z)) continue;
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
      if (y < 4.6) return true;
    }
    return false;
  }

  dansFumee(x, y, z) {
    for (const f of this.fumees) {
      const k = Math.min(1, f.t / 0.8);
      if (k > 0.5 && y < 4.4 && (x - f.x) ** 2 + (z - f.z) ** 2 < (f.rayon * 0.85) ** 2) return true;
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

  // ----- Mur d'énergie -----
  poserMur(lanceur, dir) {
    const monde = this.carte.monde;
    const selonX = Math.abs(dir.z) >= Math.abs(dir.x); // le mur s'étend sur X quand on regarde vers ±Z
    const demiL = 2.25, demiE = 0.2;
    for (const recul of [2.6, 3.6, 1.8]) {
      const cx = lanceur.x + dir.x * recul, cz = lanceur.z + dir.z * recul;
      const b = selonX
        ? { minX: cx - demiL, maxX: cx + demiL, minZ: cz - demiE, maxZ: cz + demiE }
        : { minX: cx - demiE, maxX: cx + demiE, minZ: cz - demiL, maxZ: cz + demiL };
      const occupe = this.combattants().some((c) => c.vivant && c.x > b.minX - 0.45 && c.x < b.maxX + 0.45 && c.z > b.minZ - 0.45 && c.z < b.maxZ + 0.45);
      if (occupe) continue;
      const mur = { t: 0, duree: 14, vie: 600, equipe: lanceur.equipe };
      mur.boite = monde.ajouter(b.minX, 0, b.minZ, b.maxX, 3.2, b.maxZ, { type: "mur", competence: mur });
      const geo = new THREE.BoxGeometry(b.maxX - b.minX, 3.2, b.maxZ - b.minZ);
      mur.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x7fb8ff, emissive: 0x3f7fff, emissiveIntensity: 0.9, transparent: true, opacity: 0.55, roughness: 0.2, metalness: 0.2, depthWrite: false }));
      const aretes = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xbfe0ff }));
      mur.mesh.add(aretes);
      mur.mesh.position.set(cx, 1.6, cz);
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

  degatsMur(mur, degats) {
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
    this.murs = this.murs.filter((m) => m !== mur);
  }

  majMurs(dt) {
    for (const m of [...this.murs]) {
      m.t += dt;
      m.mesh.scale.y = Math.min(1, m.t / 0.35);
      m.mesh.material.opacity = 0.3 + 0.25 * (m.vie / 600) + Math.sin(m.t * 6) * 0.03;
      if (m.t > m.duree) this.detruireMur(m);
    }
  }

  // ----- Drone éclaireur -----
  lancerDrone(lanceur, dir) {
    const mesh = new THREE.Group();
    const corps = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.22), new THREE.MeshStandardMaterial({ color: 0x2a2f38, metalness: 0.6, roughness: 0.4 }));
    mesh.add(corps);
    const matRotor = new THREE.MeshBasicMaterial({ color: 0x9aa6b8, transparent: true, opacity: 0.5 });
    const rotors = [];
    for (const [x, z] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.005, 12), matRotor);
      r.position.set(x, 0.04, z);
      mesh.add(r);
      rotors.push(r);
    }
    const oeil = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd166, toneMapped: false }));
    oeil.position.set(0, -0.02, -0.12);
    mesh.add(oeil);
    const d = new THREE.Vector3(dir.x, 0, dir.z).normalize();
    mesh.position.set(lanceur.x + d.x * 0.6, 1.6, lanceur.z + d.z * 0.6);
    mesh.rotation.y = Math.atan2(-d.x, -d.z);
    this.scene.add(mesh);
    this.drones.push({ mesh, dir: d, t: 0, duree: 6, lanceur, equipe: lanceur.equipe, scanT: 0, oeil, son: this.audio.droneStart() });
  }

  majDrones(dt) {
    const monde = this.carte.monde;
    for (const d of this.drones) {
      d.t += dt;
      const p = d.mesh.position;
      const h = monde.rayon(p.x, p.y, p.z, d.dir.x, 0, d.dir.z, 7 * dt + 0.4);
      if (!h) p.addScaledVector(d.dir, 7 * dt);
      p.y = 1.6 + Math.sin(d.t * 4) * 0.05;
      for (const r of d.mesh.children) if (r.geometry && r.geometry.type === "CylinderGeometry") r.rotation.y += dt * 60;
      d.oeil.visible = Math.floor(d.t * 4) % 2 === 0;
      this.audio.droneMaj(d.son, p);
      d.scanT -= dt;
      if (d.scanT <= 0) {
        d.scanT = 0.25;
        for (const c of this.combattants()) {
          if (!c.vivant || !this.estEnnemi(d.lanceur, c)) continue;
          const dist = Math.hypot(c.x - p.x, c.z - p.z);
          if (dist > 24 || !monde.ligneLibre(p.x, p.y, p.z, c.x, c.yeux, c.z) || this.fumeeBloque(p.x, p.y, p.z, c.x, c.yeux, c.z)) continue;
          if (this.surRevele) this.surRevele(c, 2.5, d.equipe);
        }
      }
      if (d.t >= d.duree) { d.fini = true; this.scene.remove(d.mesh); this.audio.droneStop(d.son); }
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

  maj(dt) {
    this.majProjectiles(dt);
    this.majFumees(dt);
    this.majMurs(dt);
    this.majDrones(dt);
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
