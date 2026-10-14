// Textures générées par le code (aucun fichier image à télécharger).
// Chaque matériau a une texture de couleur et une "normal map" qui donne du relief sous la lumière.
import * as THREE from "three";

function aleatoire(graine) {
  let s = graine >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Bruit de valeur tuilable (se répète sans couture).
function bruitTuilable(taille, frequence, octaves, graine) {
  const rng = aleatoire(graine);
  const out = new Float32Array(taille * taille);
  let amplitude = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const f = frequence << o;
    const grille = new Float32Array(f * f);
    for (let i = 0; i < grille.length; i++) grille[i] = rng();
    for (let y = 0; y < taille; y++) {
      const gy = (y / taille) * f, y0 = Math.floor(gy), ty = gy - y0;
      const sy = ty * ty * (3 - 2 * ty);
      const y1 = (y0 + 1) % f;
      for (let x = 0; x < taille; x++) {
        const gx = (x / taille) * f, x0 = Math.floor(gx), tx = gx - x0;
        const sx = tx * tx * (3 - 2 * tx);
        const x1 = (x0 + 1) % f;
        const a = grille[y0 * f + x0], b = grille[y0 * f + x1], c = grille[y1 * f + x0], d = grille[y1 * f + x1];
        out[y * taille + x] += amplitude * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
      }
    }
    total += amplitude;
    amplitude *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function versTexture(canvas, couleur = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (couleur) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function normalDepuisHauteur(h, taille, force) {
  const c = document.createElement("canvas");
  c.width = c.height = taille;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(taille, taille);
  for (let y = 0; y < taille; y++) {
    for (let x = 0; x < taille; x++) {
      const g = h[y * taille + ((x - 1 + taille) % taille)], d = h[y * taille + ((x + 1) % taille)];
      const hh = h[((y - 1 + taille) % taille) * taille + x], b = h[((y + 1) % taille) * taille + x];
      let nx = (g - d) * force, ny = (b - hh) * force, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * taille + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return versTexture(c, false);
}

function remplir(taille, fn) {
  const c = document.createElement("canvas");
  c.width = c.height = taille;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(taille, taille);
  for (let y = 0; y < taille; y++) {
    for (let x = 0; x < taille; x++) {
      const [r, g, b] = fn(x, y, y * taille + x);
      const i = (y * taille + x) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { c, ctx };
}

const clamp = (v) => Math.max(0, Math.min(255, v));

// Béton coulé : panneaux de 2 m avec joints, trous de banches et coulures.
export function textureBeton(qualite) {
  const T = qualite === "basse" ? 256 : 512;
  const n = bruitTuilable(T, 4, 6, 11);
  const fin = bruitTuilable(T, 32, 3, 12);
  const taches = bruitTuilable(T, 3, 3, 13);
  const h = new Float32Array(T * T);
  const { c, ctx } = remplir(T, (x, y, i) => {
    const joint = (x % (T / 2) < 2 || y % (T / 2) < 2) ? 1 : 0;
    const coulure = Math.max(0, Math.sin((x / T) * Math.PI * 22 + n[i] * 4)) ** 12 * (y / T) * 0.25;
    const v = 128 + (n[i] - 0.5) * 50 + (fin[i] - 0.5) * 26 - (taches[i] > 0.62 ? (taches[i] - 0.62) * 140 : 0) - coulure * 60 - joint * 45;
    h[i] = fin[i] * 0.6 + n[i] * 0.4 - joint * 0.8;
    return [clamp(v * 0.97), clamp(v * 0.99), clamp(v * 1.04)];
  });
  // Trous de banches
  ctx.fillStyle = "rgba(40,42,48,0.75)";
  for (let py = 0; py < 2; py++) for (let px = 0; px < 2; px++) for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
    ctx.beginPath();
    ctx.arc((px + ox) * T / 2, (py + oy) * T / 2, T / 120, 0, Math.PI * 2);
    ctx.fill();
  }
  return { map: versTexture(c), normalMap: normalDepuisHauteur(h, T, 3.2), echelle: 4 };
}

// Sol en béton ciré : dalles de 4 m, rayures et traces d'usure.
export function textureSol(qualite) {
  const T = qualite === "basse" ? 256 : 512;
  const n = bruitTuilable(T, 3, 6, 21);
  const fin = bruitTuilable(T, 48, 2, 22);
  const h = new Float32Array(T * T);
  const rng = aleatoire(23);
  const { c, ctx } = remplir(T, (x, y, i) => {
    const joint = (x % (T / 2) < 2 || y % (T / 2) < 2) ? 1 : 0;
    const v = 92 + (n[i] - 0.5) * 40 + (fin[i] - 0.5) * 14 - joint * 30;
    h[i] = fin[i] * 0.3 - joint;
    return [clamp(v * 0.95), clamp(v * 0.98), clamp(v * 1.05)];
  });
  ctx.strokeStyle = "rgba(200,205,215,0.10)";
  ctx.lineWidth = 1;
  for (let k = 0; k < 90; k++) {
    const x = rng() * T, y = rng() * T, a = rng() * Math.PI, l = 8 + rng() * 40;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  return { map: versTexture(c), normalMap: normalDepuisHauteur(h, T, 2.4), echelle: 8 };
}

// Métal peint ondulé (conteneurs, caisses) avec éraflures sur les bords.
export function textureMetal(couleur, graine, qualite) {
  const T = qualite === "basse" ? 256 : 512;
  const n = bruitTuilable(T, 4, 5, graine);
  const usure = bruitTuilable(T, 8, 4, graine + 1);
  // Couleur lue telle quelle (sRGB), sans conversion linéaire.
  const hex = parseInt(couleur.replace("#", ""), 16);
  const R = (hex >> 16) & 255, G = (hex >> 8) & 255, B = hex & 255;
  const h = new Float32Array(T * T);
  const { c } = remplir(T, (x, y, i) => {
    const onde = Math.sin((x / T) * Math.PI * 2 * 16);
    const bord = Math.min(y, T - y) < T * 0.04 ? 1 : 0;
    const raye = usure[i] > 0.76 || (bord && usure[i] > 0.55);
    const ombre = 0.82 + onde * 0.08 + (n[i] - 0.5) * 0.3;
    h[i] = onde * 0.5 + (raye ? -0.3 : 0) + bord * 0.8;
    if (raye) {
      const m = 105 + n[i] * 45;
      return [m, m * 0.98, m * 0.95];
    }
    return [clamp(R * ombre - bord * 20), clamp(G * ombre - bord * 20), clamp(B * ombre - bord * 20)];
  });
  return { map: versTexture(c), normalMap: normalDepuisHauteur(h, T, 2.2), echelle: 2.5 };
}

// Métal sombre brossé pour les rebords, poutres et l'arme.
export function textureMetalSombre(qualite) {
  const T = qualite === "basse" ? 128 : 256;
  const n = bruitTuilable(T, 64, 2, 31);
  const { c } = remplir(T, (x, y, i) => {
    const v = 46 + (n[i] - 0.5) * 22 + Math.sin(y * 0.9) * 3;
    return [v, v * 1.02, v * 1.08];
  });
  return { map: versTexture(c), echelle: 1 };
}

// Bandes jaune et noir des barrières.
export function textureDanger() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#16181d";
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = "#e8b419";
  for (let k = -2; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(k * 64, 128);
    ctx.lineTo(k * 64 + 32, 128);
    ctx.lineTo(k * 64 + 160, 0);
    ctx.lineTo(k * 64 + 128, 0);
    ctx.fill();
  }
  return { map: versTexture(c), echelle: 1 };
}

// Façades lointaines avec fenêtres éclairées (décor autour de l'arène).
export function textureFacade(graine) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 512;
  const ctx = c.getContext("2d");
  const rng = aleatoire(graine);
  ctx.fillStyle = "#0b1020";
  ctx.fillRect(0, 0, 256, 512);
  for (let y = 8; y < 512; y += 16) {
    for (let x = 8; x < 256; x += 14) {
      const r = rng();
      if (r < 0.32) {
        ctx.fillStyle = r < 0.06 ? "#7cc4ff" : r < 0.12 ? "#ffb15c" : "#2a3858";
        ctx.fillRect(x, y, 8, 9);
      }
    }
  }
  const t = versTexture(c);
  return t;
}

// Texte peint (lettres de site, flèches) sur fond transparent.
export function texturePeinture(texte, couleur, taille = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = taille;
  const ctx = c.getContext("2d");
  let corps = taille * 0.78;
  ctx.font = `800 ${corps}px "Orbitron", "Arial Black", Arial, sans-serif`;
  const largeur = ctx.measureText(texte).width;
  if (largeur > taille * 0.92) {
    corps *= (taille * 0.92) / largeur;
    ctx.font = `800 ${corps}px "Orbitron", "Arial Black", Arial, sans-serif`;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = couleur;
  ctx.globalAlpha = 0.9;
  ctx.fillText(texte, taille / 2, taille / 2 + corps * 0.05);
  // Effet de peinture usée
  ctx.globalCompositeOperation = "destination-out";
  const rng = aleatoire(texte.charCodeAt(0) * 7);
  for (let k = 0; k < 90; k++) {
    ctx.globalAlpha = rng() * 0.3;
    ctx.beginPath();
    ctx.arc(rng() * taille, rng() * taille, rng() * taille * 0.02, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Petite tache ronde floue (éclats, flashs, impacts).
export function textureEclat() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,230,170,0.9)");
  g.addColorStop(1, "rgba(255,160,60,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function textureTrou() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, "rgba(10,10,12,1)");
  g.addColorStop(0.3, "rgba(20,20,24,0.95)");
  g.addColorStop(0.55, "rgba(60,60,66,0.5)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// Applique des coordonnées de texture en mètres sur une BoxGeometry (pas d'étirement).
export function uvMonde(geo, l, h, p, echelle) {
  const uv = geo.attributes.uv;
  const faces = [[p, h], [p, h], [l, p], [l, p], [l, h], [l, h]];
  for (let f = 0; f < 6; f++) {
    const [w, hh] = faces[f];
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * w / echelle, uv.getY(i) * hh / echelle);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

// ===== Textures de détail (personnages, arme) =====
// Tissu tissé : trame fine en relief, légères variations.
export function textureTissu(qualite) {
  const T = qualite === "basse" ? 128 : 256;
  const n = bruitTuilable(T, 8, 3, 91);
  const h = new Float32Array(T * T);
  const { c } = remplir(T, (x, y, i) => {
    const trame = (Math.sin(x * Math.PI / 2) * 0.5 + 0.5) * ((y >> 2) % 2 ? 1 : 0.6) + (Math.sin(y * Math.PI / 2) * 0.5 + 0.5) * ((x >> 2) % 2 ? 0.6 : 1);
    h[i] = trame * 0.5 + n[i] * 0.3;
    const v = 200 + (n[i] - 0.5) * 50 + trame * 18;
    return [clamp(v), clamp(v), clamp(v)];
  });
  const t = { map: versTexture(c), normalMap: normalDepuisHauteur(h, T, 1.6) };
  t.map.repeat.set(3, 3); t.normalMap.repeat.set(3, 3);
  return t;
}

// Plaque composite (armures) : surface légèrement granuleuse, usure claire aux bords des coutures.
export function texturePlaque(qualite) {
  const T = qualite === "basse" ? 128 : 256;
  const n = bruitTuilable(T, 16, 3, 92);
  const u = bruitTuilable(T, 6, 4, 93);
  const h = new Float32Array(T * T);
  const { c } = remplir(T, (x, y, i) => {
    h[i] = n[i] * 0.35;
    const usure = u[i] > 0.72 ? (u[i] - 0.72) * 3 : 0;
    const v = 215 + (n[i] - 0.5) * 30 + usure * 120;
    return [clamp(v), clamp(v), clamp(v)];
  });
  return { map: versTexture(c), normalMap: normalDepuisHauteur(h, T, 1.2) };
}

// Polymère granité (poignée, crosse) et métal anodisé brossé (carcasse).
export function texturePolymere(qualite) {
  const T = qualite === "basse" ? 128 : 256;
  const n = bruitTuilable(T, 64, 2, 94);
  const h = new Float32Array(T * T);
  const { c } = remplir(T, (x, y, i) => {
    h[i] = n[i];
    const v = 205 + (n[i] - 0.5) * 30;
    return [clamp(v), clamp(v), clamp(v)];
  });
  return { map: versTexture(c), normalMap: normalDepuisHauteur(h, T, 2.2) };
}

export function textureAnodise(qualite) {
  const T = qualite === "basse" ? 128 : 256;
  const n = bruitTuilable(T, 4, 4, 95);
  const fin = bruitTuilable(T, 128, 1, 96);
  const { c } = remplir(T, (x, y, i) => {
    const brosse = Math.sin(y * 1.7 + fin[i] * 3) * 6;
    const v = 200 + (n[i] - 0.5) * 36 + brosse;
    return [clamp(v), clamp(v), clamp(v)];
  });
  const rough = remplir(T, (x, y, i) => {
    const v = 120 + (n[i] - 0.5) * 90 + (fin[i] - 0.5) * 40;
    return [clamp(v), clamp(v), clamp(v)];
  });
  return { map: versTexture(c), roughnessMap: versTexture(rough.c, false) };
}

// Marquage gravé de l'arme (logo Neon Strike, numéro de modèle).
export function textureMarquage(texte, sous) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = "rgba(210,220,235,0.85)";
  ctx.font = `700 28px "Orbitron", Arial, sans-serif`;
  ctx.fillText(texte, 8, 32);
  ctx.font = `600 15px "Rajdhani", Arial, sans-serif`;
  ctx.fillStyle = "rgba(150,165,190,0.85)";
  ctx.fillText(sous, 10, 54);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Réticule du viseur point rouge.
export function textureReticule() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  ctx.strokeStyle = "rgba(255,70,80,0.95)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(64, 64, 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,90,100,1)";
  ctx.beginPath();
  ctx.arc(64, 64, 3.5, 0, Math.PI * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Dégradé sombre pour l'ombrage de contact (pied des murs, sous les caisses).
export function textureOmbreContact() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(0.5, "rgba(0,0,0,0.18)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// ===== Textures des nouvelles cartes =====
// Enduit de façade (marché) : surface irrégulière, taches d'humidité, éclats laissant voir la brique.
export function textureEnduit(teinte, graine, qualite) {
  const T = qualite === "basse" ? 256 : 512;
  const n = bruitTuilable(T, 4, 5, graine);
  const fin = bruitTuilable(T, 32, 3, graine + 1);
  const eclats = bruitTuilable(T, 6, 3, graine + 2);
  const hex = parseInt(teinte.replace("#", ""), 16);
  const R = (hex >> 16) & 255, G = (hex >> 8) & 255, B = hex & 255;
  const h = new Float32Array(T * T);
  const { c } = remplir(T, (x, y, i) => {
    const brique = eclats[i] > 0.74;
    const humide = Math.max(0, 1 - y / (T * 0.35)) * 0 + Math.max(0, (y / T) - 0.75) * (n[i] * 0.8);
    h[i] = fin[i] * 0.5 + n[i] * 0.3 - (brique ? 0.6 : 0);
    if (brique) {
      const joint = (y % 24 < 3) || ((x + (Math.floor(y / 24) % 2) * 24) % 48 < 3);
      const v = joint ? 150 : 1;
      return joint ? [v, v * 0.95, v * 0.88] : [150 + fin[i] * 40, 80 + fin[i] * 20, 60 + fin[i] * 15];
    }
    const k = 0.9 + (n[i] - 0.5) * 0.18 + (fin[i] - 0.5) * 0.08 - humide * 0.35;
    return [clamp(R * k), clamp(G * k), clamp(B * k)];
  });
  return { map: versTexture(c), normalMap: normalDepuisHauteur(h, T, 2.2), echelle: 4 };
}

// Pavés de pierre (sol du marché)
export function texturePaves(qualite) {
  const T = qualite === "basse" ? 256 : 512;
  const n = bruitTuilable(T, 8, 4, 141);
  const fin = bruitTuilable(T, 48, 2, 142);
  const tailleP = T / 8;
  const h = new Float32Array(T * T);
  const { c } = remplir(T, (x, y, i) => {
    const ligne = Math.floor(y / tailleP);
    const xx = (x + (ligne % 2) * tailleP / 2) % T;
    const lx = xx % tailleP, ly = y % tailleP;
    const bord = Math.min(lx, ly, tailleP - lx, tailleP - ly);
    const joint = bord < 3;
    const id = Math.floor(xx / tailleP) * 7 + ligne * 13;
    const teinte = 0.85 + ((id * 9301 + 49297) % 233280) / 233280 * 0.3;
    h[i] = joint ? 0 : Math.min(1, bord / 8) * 0.8 + fin[i] * 0.2;
    if (joint) return [70, 66, 60];
    const v = (150 + (n[i] - 0.5) * 50 + (fin[i] - 0.5) * 20) * teinte;
    return [clamp(v * 1.02), clamp(v * 0.97), clamp(v * 0.9)];
  });
  return { map: versTexture(c), normalMap: normalDepuisHauteur(h, T, 3), echelle: 6 };
}

// Planches de bois (caisses, étals)
export function textureBois(qualite) {
  const T = qualite === "basse" ? 256 : 512;
  const n = bruitTuilable(T, 4, 4, 151);
  const fibre = bruitTuilable(T, 64, 2, 152);
  const h = new Float32Array(T * T);
  const { c } = remplir(T, (x, y, i) => {
    const planche = Math.floor(y / (T / 6));
    const joint = y % (T / 6) < 3;
    const veine = Math.sin((x / T) * Math.PI * 2 * 3 + n[i] * 10 + planche * 2) * 0.5 + 0.5;
    h[i] = joint ? 0 : 0.6 + fibre[i] * 0.3;
    if (joint) return [40, 28, 18];
    const v = 0.75 + veine * 0.2 + (fibre[i] - 0.5) * 0.15 + (planche % 2) * 0.05;
    return [clamp(150 * v), clamp(108 * v), clamp(70 * v)];
  });
  return { map: versTexture(c), normalMap: normalDepuisHauteur(h, T, 2.4), echelle: 1.6 };
}

// Bâche rayée (toits des étals)
export function textureBache(c1, c2) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? c1 : c2;
    ctx.fillRect(i * 16, 0, 16, 128);
  }
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  for (let y = 0; y < 128; y += 4) ctx.fillRect(0, y, 128, 1);
  return versTexture(c);
}

// Tôle ondulée claire (murs du hangar)
export function textureTole(teinte, qualite) {
  return textureMetal(teinte, 161, qualite);
}

// Sol époxy industriel avec marquages
export function textureSolIndustriel(qualite) {
  const T = qualite === "basse" ? 256 : 512;
  const n = bruitTuilable(T, 3, 5, 171);
  const fin = bruitTuilable(T, 64, 2, 172);
  const h = new Float32Array(T * T);
  const { c } = remplir(T, (x, y, i) => {
    const joint = (x % (T / 2) < 2 || y % (T / 2) < 2);
    h[i] = fin[i] * 0.2 - (joint ? 1 : 0);
    const v = 118 + (n[i] - 0.5) * 34 + (fin[i] - 0.5) * 10 - (joint ? 25 : 0);
    return [clamp(v * 0.94), clamp(v * 0.98), clamp(v * 1.02)];
  });
  return { map: versTexture(c), normalMap: normalDepuisHauteur(h, T, 1.8), echelle: 8 };
}

// Peinture laquée légèrement usée (coque du fusil Pulsar) : salissures discrètes et petits éclats
// laissant voir le métal (plus brillant). Renvoie couleur, rugosité et "métallicité".
export function texturePeintureUsee(qualite) {
  const T = qualite === "basse" ? 128 : 256;
  const n = bruitTuilable(T, 4, 4, 141);
  const eclats = bruitTuilable(T, 24, 2, 142);
  const fin = bruitTuilable(T, 64, 1, 143);
  const metal = (i) => eclats[i] > 0.74 ? Math.min(1, (eclats[i] - 0.74) * 12) : 0;
  const { c } = remplir(T, (x, y, i) => {
    const m = metal(i);
    const sale = (n[i] - 0.5) * 22 + (fin[i] - 0.5) * 8;
    const peinture = 224 + sale;
    const v = peinture * (1 - m) + (120 + fin[i] * 40) * m;
    return [clamp(v), clamp(v + 1), clamp(v + 3)];
  });
  const rough = remplir(T, (x, y, i) => {
    const m = metal(i);
    const v = 150 + (n[i] - 0.5) * 50 - m * 70;
    return [clamp(v), clamp(v), clamp(v)];
  });
  const met = remplir(T, (x, y, i) => {
    const v = 25 + metal(i) * 230;
    return [clamp(v), clamp(v), clamp(v)];
  });
  return { map: versTexture(c), roughnessMap: versTexture(rough.c, false), metalnessMap: versTexture(met.c, false) };
}
