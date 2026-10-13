// Collisions, lancers de rayons et navigation des bots.
// Tout le décor solide est décrit par des boîtes alignées sur les axes (AABB) : c'est exact et très rapide.

export const RAYON_PERSO = 0.4;
export const TAILLE_PERSO = 1.8;

export class Monde {
  constructor() {
    this.boites = [];
  }

  ajouter(minX, minY, minZ, maxX, maxY, maxZ, info = {}) {
    const b = { minX, minY, minZ, maxX, maxY, maxZ, ...info };
    this.boites.push(b);
    return b;
  }

  // Un cylindre (x, z, rayon) dont les pieds sont à "pied" touche-t-il une boîte ?
  bloque(x, z, pied, rayon = RAYON_PERSO, taille = TAILLE_PERSO) {
    for (const b of this.boites) {
      if (b.traversable) continue;
      if (pied >= b.maxY - 0.05 || pied + taille <= b.minY) continue;
      const px = Math.max(b.minX, Math.min(x, b.maxX));
      const pz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - px, dz = z - pz;
      if (dx * dx + dz * dz < rayon * rayon) return true;
    }
    return false;
  }

  // Hauteur du sol sous un personnage (dessus d'une caisse ou 0).
  hauteurSol(x, z, pied, rayon = RAYON_PERSO) {
    let h = 0;
    const r = rayon * 0.75;
    for (const b of this.boites) {
      if (b.traversable) continue;
      if (b.maxY > pied + 0.06) continue;
      if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) h = Math.max(h, b.maxY);
    }
    return h;
  }

  // Rayon contre le décor. Retourne { t, boite, nx, ny, nz } ou null.
  rayon(ox, oy, oz, dx, dy, dz, tMax = 300, ignorerTraversable = true) {
    let meilleur = null;
    let tBest = tMax;
    const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
    for (const b of this.boites) {
      if (ignorerTraversable && b.traversable) continue;
      let t1 = (b.minX - ox) * ix, t2 = (b.maxX - ox) * ix;
      let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
      let axe = 0;
      t1 = (b.minY - oy) * iy; t2 = (b.maxY - oy) * iy;
      let a = Math.min(t1, t2), c = Math.max(t1, t2);
      if (a > tmin) { tmin = a; axe = 1; }
      tmax = Math.min(tmax, c);
      t1 = (b.minZ - oz) * iz; t2 = (b.maxZ - oz) * iz;
      a = Math.min(t1, t2); c = Math.max(t1, t2);
      if (a > tmin) { tmin = a; axe = 2; }
      tmax = Math.min(tmax, c);
      if (tmax < Math.max(tmin, 0) || tmin > tBest || tmin < 0) continue;
      tBest = tmin;
      meilleur = { t: tmin, boite: b, nx: axe === 0 ? -Math.sign(dx) : 0, ny: axe === 1 ? -Math.sign(dy) : 0, nz: axe === 2 ? -Math.sign(dz) : 0 };
    }
    return meilleur;
  }

  ligneLibre(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-4) return true;
    return this.rayon(ax, ay, az, dx / d, dy / d, dz / d, d) === null;
  }
}

// Rayon contre une sphère (tête). Retourne la distance ou -1.
export function rayonSphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = ox - cx, ly = oy - cy, lz = oz - cz;
  const b = lx * dx + ly * dy + lz * dz;
  const c = lx * lx + ly * ly + lz * lz - r * r;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : -1;
}

// Rayon contre un cylindre vertical (corps). Retourne { t, y } ou null.
export function rayonCylindre(ox, oy, oz, dx, dy, dz, cx, cz, r, yMin, yMax) {
  const lx = ox - cx, lz = oz - cz;
  const a = dx * dx + dz * dz;
  if (a < 1e-8) return null;
  const b = lx * dx + lz * dz;
  const c = lx * lx + lz * lz - r * r;
  const disc = b * b - a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / a;
  if (t < 0) return null;
  const y = oy + dy * t;
  if (y < yMin || y > yMax) return null;
  return { t, y };
}

// ===== Navigation : grille + A* =====
class Tas {
  constructor() { this.n = []; this.p = []; }
  get taille() { return this.n.length; }
  pousser(noeud, prio) {
    const n = this.n, p = this.p;
    n.push(noeud); p.push(prio);
    let i = n.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (p[parent] <= p[i]) break;
      [n[parent], n[i]] = [n[i], n[parent]];
      [p[parent], p[i]] = [p[i], p[parent]];
      i = parent;
    }
  }
  sortir() {
    const n = this.n, p = this.p;
    const haut = n[0];
    const dernierN = n.pop(), dernierP = p.pop();
    if (n.length) {
      n[0] = dernierN; p[0] = dernierP;
      let i = 0;
      for (;;) {
        const g = 2 * i + 1, d = g + 1;
        let m = i;
        if (g < n.length && p[g] < p[m]) m = g;
        if (d < n.length && p[d] < p[m]) m = d;
        if (m === i) break;
        [n[m], n[i]] = [n[i], n[m]];
        [p[m], p[i]] = [p[i], p[m]];
        i = m;
      }
    }
    return haut;
  }
}

export class GrilleNav {
  constructor(monde, minX, maxX, minZ, maxZ, cellule = 0.5, rayon = 0.45) {
    this.minX = minX; this.minZ = minZ; this.cellule = cellule;
    this.lx = Math.ceil((maxX - minX) / cellule);
    this.lz = Math.ceil((maxZ - minZ) / cellule);
    this.libre = new Uint8Array(this.lx * this.lz);
    for (let j = 0; j < this.lz; j++) {
      for (let i = 0; i < this.lx; i++) {
        const x = minX + (i + 0.5) * cellule, z = minZ + (j + 0.5) * cellule;
        this.libre[j * this.lx + i] = monde.bloque(x, z, 0, rayon, 1.8) ? 0 : 1;
      }
    }
    this.g = new Float32Array(this.lx * this.lz);
    this.parent = new Int32Array(this.lx * this.lz);
    this.marque = new Uint32Array(this.lx * this.lz);
    this.ferme = new Uint32Array(this.lx * this.lz);
    this.tour = 0;
  }

  indice(x, z) {
    const i = Math.floor((x - this.minX) / this.cellule);
    const j = Math.floor((z - this.minZ) / this.cellule);
    if (i < 0 || j < 0 || i >= this.lx || j >= this.lz) return -1;
    return j * this.lx + i;
  }

  centre(k) {
    return { x: this.minX + ((k % this.lx) + 0.5) * this.cellule, z: this.minZ + (Math.floor(k / this.lx) + 0.5) * this.cellule };
  }

  estLibre(x, z) {
    const k = this.indice(x, z);
    return k >= 0 && this.libre[k] === 1;
  }

  plusProcheLibre(x, z) {
    const k0 = this.indice(x, z);
    if (k0 >= 0 && this.libre[k0]) return k0;
    const i0 = Math.floor((x - this.minX) / this.cellule), j0 = Math.floor((z - this.minZ) / this.cellule);
    for (let r = 1; r < 12; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.abs(di) !== r && Math.abs(dj) !== r) continue;
          const i = i0 + di, j = j0 + dj;
          if (i < 0 || j < 0 || i >= this.lx || j >= this.lz) continue;
          const k = j * this.lx + i;
          if (this.libre[k]) return k;
        }
      }
    }
    return -1;
  }

  // Segment entièrement sur des cellules libres ?
  segmentLibre(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az);
    const pas = Math.max(1, Math.ceil(d / (this.cellule * 0.5)));
    for (let s = 0; s <= pas; s++) {
      const t = s / pas;
      if (!this.estLibre(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }

  chemin(ax, az, bx, bz) {
    const depart = this.plusProcheLibre(ax, az);
    const arrivee = this.plusProcheLibre(bx, bz);
    if (depart < 0 || arrivee < 0) return null;
    this.tour++;
    const tour = this.tour, lx = this.lx, lz = this.lz;
    const g = this.g, parent = this.parent, marque = this.marque, ferme = this.ferme, libre = this.libre;
    const ai = arrivee % lx, aj = Math.floor(arrivee / lx);
    const h = (k) => {
      const di = Math.abs((k % lx) - ai), dj = Math.abs(Math.floor(k / lx) - aj);
      return Math.max(di, dj) + 0.414 * Math.min(di, dj);
    };
    const tas = new Tas();
    g[depart] = 0; parent[depart] = -1; marque[depart] = tour;
    tas.pousser(depart, h(depart));
    let trouve = false, iterations = 0;
    while (tas.taille && iterations++ < 20000) {
      const k = tas.sortir();
      if (ferme[k] === tour) continue;
      ferme[k] = tour;
      if (k === arrivee) { trouve = true; break; }
      const i = k % lx, j = Math.floor(k / lx);
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = i + di, nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= lx || nj >= lz) continue;
          const nk = nj * lx + ni;
          if (!libre[nk] || ferme[nk] === tour) continue;
          if (di && dj && (!libre[j * lx + ni] || !libre[nj * lx + i])) continue; // pas de coin coupé
          const cout = g[k] + (di && dj ? 1.414 : 1);
          if (marque[nk] !== tour || cout < g[nk]) {
            marque[nk] = tour; g[nk] = cout; parent[nk] = k;
            tas.pousser(nk, cout + h(nk));
          }
        }
      }
    }
    if (!trouve) return null;

    const brut = [];
    for (let k = arrivee; k !== -1; k = parent[k]) brut.push(this.centre(k));
    brut.reverse();
    brut[brut.length - 1] = { x: bx, z: bz };
    if (!this.estLibre(bx, bz)) brut[brut.length - 1] = this.centre(arrivee);

    // Lissage : on saute les points intermédiaires quand la ligne droite est libre.
    const lisse = [];
    let courant = { x: ax, z: az };
    let i = 0;
    while (i < brut.length) {
      let j = brut.length - 1;
      while (j > i && !this.segmentLibre(courant.x, courant.z, brut[j].x, brut[j].z)) j--;
      lisse.push(brut[j]);
      courant = brut[j];
      i = j + 1;
    }
    return lisse;
  }

  aleatoire(rng = Math.random, zone = null) {
    for (let essai = 0; essai < 300; essai++) {
      const x = zone ? zone.minX + rng() * (zone.maxX - zone.minX) : this.minX + rng() * this.lx * this.cellule;
      const z = zone ? zone.minZ + rng() * (zone.maxZ - zone.minZ) : this.minZ + rng() * this.lz * this.cellule;
      if (this.estLibre(x, z)) return { x, z };
    }
    return null;
  }
}
