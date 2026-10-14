"""Textures PBR des cartes, générées (aucune image externe) et raccordables (bords qui se répètent sans couture).

Usage : python3 outils/textures.py [nom ...]
Pour chaque matériau : assets/textures/<nom>_alb.png (couleur), _nrm.png (normales, convention OpenGL),
_orm.png (R occlusion, V rugosité, B métal). Résolution 512 px.
"""
import os
import sys

import numpy as np
from PIL import Image

N = 512
ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ICI, "..", "assets", "textures")
rng = np.random.default_rng(12)


def _h(t):
    return sum(ord(c) * (i + 1) for i, c in enumerate(t))


def bruit_periodique(n=N, beta=2.0, graine=None):
    """Bruit fractal périodique (spectre en 1/f^beta), normalisé 0..1."""
    r = np.random.default_rng(graine) if graine is not None else rng
    fx = np.fft.fftfreq(n)[:, None]
    fy = np.fft.fftfreq(n)[None, :]
    f = np.sqrt(fx ** 2 + fy ** 2)
    f[0, 0] = 1.0
    spectre = (r.standard_normal((n, n)) + 1j * r.standard_normal((n, n))) / f ** (beta / 2)
    spectre[0, 0] = 0
    x = np.real(np.fft.ifft2(spectre))
    x -= x.min()
    return x / (x.max() + 1e-9)


def bruit_bande(n=N, f0=0.05, larg=0.02, graine=None):
    r = np.random.default_rng(graine) if graine is not None else rng
    fx = np.fft.fftfreq(n)[:, None]
    fy = np.fft.fftfreq(n)[None, :]
    f = np.sqrt(fx ** 2 + fy ** 2)
    filtre = np.exp(-((f - f0) / larg) ** 2)
    spectre = (r.standard_normal((n, n)) + 1j * r.standard_normal((n, n))) * filtre
    x = np.real(np.fft.ifft2(spectre))
    x -= x.min()
    return x / (x.max() + 1e-9)


def flou(x, rayon=2):
    """Flou périodique (moyenne glissante)."""
    y = x.copy()
    for ax in (0, 1):
        acc = np.zeros_like(y)
        for k in range(-rayon, rayon + 1):
            acc += np.roll(y, k, axis=ax)
        y = acc / (2 * rayon + 1)
    return y


def normales(h, force=4.0):
    dx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * 0.5 * force
    dy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * 0.5 * force
    nz = np.ones_like(h)
    n = np.stack([-dx, dy, nz], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return ((n * 0.5 + 0.5) * 255).astype(np.uint8)


def occlusion(h, rayon=6, force=1.2):
    m = flou(h, rayon)
    ao = 1.0 - np.clip((m - h) * force * 4, 0, 1)
    return np.clip(ao, 0.3, 1.0)


def couleur(base, variation, *cartes):
    """base : (r,g,b) 0..1 ; variation : liste de (carte 0..1, delta (r,g,b))."""
    img = np.ones((N, N, 3)) * np.array(base)
    for carte, delta in variation:
        img += (carte[..., None] - 0.5) * np.array(delta)
    return np.clip(img, 0, 1)


def ecrire(nom, alb, h, rug, metal, force_n=4.0, ao=None):
    os.makedirs(SORTIE, exist_ok=True)
    if ao is None:
        ao = occlusion(h)
    alb = alb * (0.65 + 0.35 * ao[..., None])
    Image.fromarray((np.clip(alb, 0, 1) ** (1 / 1.0) * 255).astype(np.uint8)).save(os.path.join(SORTIE, nom + "_alb.png"))
    Image.fromarray(normales(h, force_n)).save(os.path.join(SORTIE, nom + "_nrm.png"))
    rug = np.broadcast_to(np.asarray(rug, dtype=float), (N, N))
    metal = np.broadcast_to(np.asarray(metal, dtype=float), (N, N))
    orm = np.stack([ao, np.clip(rug, 0.03, 1), np.clip(metal, 0, 1)], axis=-1)
    Image.fromarray((orm * 255).astype(np.uint8)).save(os.path.join(SORTIE, nom + "_orm.png"))
    print("texture", nom)


def grille(n_x, n_y, joint, decal_rangs=0.5, alea=0.0, graine=1):
    """Motif de briques / dalles : renvoie (masque des joints 0..1, identifiant de pièce aléatoire 0..1)."""
    r = np.random.default_rng(graine)
    y, x = np.mgrid[0:N, 0:N] / N
    rang = np.floor(y * n_y)
    xx = x * n_x + (rang % 2) * decal_rangs * n_x / n_x
    col = np.floor(xx) % n_x
    fx = xx - np.floor(xx)
    fy = y * n_y - rang
    j = np.minimum(np.minimum(fx, 1 - fx) * N / n_x, np.minimum(fy, 1 - fy) * N / n_y)
    joints = np.clip(1 - j / joint, 0, 1)
    ids = r.random((n_y, n_x + 1))
    pid = ids[rang.astype(int) % n_y, col.astype(int)]
    return joints, pid, fx, fy


# ---------------------------------------------------------------------------
def beton(nom, base, rug=0.85, taches=0.35, panneaux=False):
    b1 = bruit_periodique(beta=2.2, graine=_h(nom) % 1000)
    b2 = bruit_periodique(beta=1.2, graine=_h(nom) % 1000 + 1)
    pores = (np.random.default_rng(3).random((N, N)) > 0.985).astype(float)
    pores = flou(pores, 1)
    h = b1 * 0.5 + b2 * 0.25 - pores * 1.5
    alb = couleur(base, [(b1, (0.1, 0.1, 0.1)), (b2, (0.06, 0.06, 0.05)), (bruit_periodique(beta=3.0, graine=7), (taches * 0.25,) * 3)])
    if panneaux:
        joints, pid, fx, fy = grille(2, 2, 3, 0.0)
        h -= joints * 0.8
        alb *= (1 - joints[..., None] * 0.35)
        alb *= (0.94 + 0.12 * pid[..., None])
        # trous de banches
        y, x = np.mgrid[0:N, 0:N] / N
        trou = (np.sqrt(((x * 2) % 1 - 0.5) ** 2 + ((y * 2) % 1 - 0.5) ** 2) < 0.025).astype(float)
        h -= flou(trou, 2) * 2
        alb *= (1 - flou(trou, 2)[..., None] * 0.5)
    r = rug + (b2 - 0.5) * 0.15
    ecrire(nom, alb, h, r, np.zeros((N, N)), 3.0)


def dalles():
    joints, pid, fx, fy = grille(4, 4, 4, 0.0)
    b = bruit_periodique(beta=2.0, graine=21)
    h = 1 - joints - b * 0.15
    alb = couleur((0.5, 0.5, 0.49), [(b, (0.12, 0.12, 0.12))])
    alb *= (0.88 + 0.22 * pid[..., None])
    alb *= (1 - joints[..., None] * 0.5)
    ecrire("dalles", alb, h, 0.7 + joints * 0.2 + (b - 0.5) * 0.1, np.zeros((N, N)), 5.0)


def asphalte():
    b = bruit_periodique(beta=1.0, graine=31)
    grains = np.random.default_rng(4).random((N, N))
    h = b * 0.3 + grains * 0.4
    alb = couleur((0.17, 0.17, 0.18), [(grains, (0.12, 0.12, 0.12)), (bruit_periodique(beta=2.5, graine=5), (0.06, 0.06, 0.06))])
    ecrire("asphalte", alb, h, 0.9 - grains * 0.1, np.zeros((N, N)), 2.0)


def brique():
    joints, pid, fx, fy = grille(4, 8, 3.5, 0.5, graine=8)
    b = bruit_periodique(beta=1.6, graine=41)
    h = (1 - joints) * 0.9 + b * 0.2
    teinte = np.stack([0.55 + 0.12 * (pid - 0.5), 0.29 + 0.06 * (pid - 0.5), 0.21 + 0.05 * (pid - 0.5)], axis=-1)
    alb = teinte * (0.85 + 0.3 * b[..., None])
    mortier = np.array([0.62, 0.6, 0.56])
    alb = alb * (1 - joints[..., None]) + mortier * joints[..., None]
    ecrire("brique", alb, h, 0.85 + 0.1 * joints, np.zeros((N, N)), 6.0)


def metal(nom, base, rug, metal_v=0.95, rayures=True, peint=False):
    b = bruit_periodique(beta=2.4, graine=_h(nom) % 997)
    # métal brossé : bruit étiré horizontalement
    brosse = bruit_periodique(beta=1.0, graine=51)
    brosse = flou(np.roll(brosse, 0, axis=0), 0)
    brosse = np.mean([np.roll(brosse, k, axis=1) for k in range(-12, 13)], axis=0)
    h = b * 0.3 + brosse * 0.2
    alb = couleur(base, [(b, (0.06, 0.06, 0.06)), (brosse, (0.04, 0.04, 0.04))])
    r = rug + (brosse - 0.5) * 0.12 + (b - 0.5) * 0.1
    m = np.ones((N, N)) * metal_v
    if peint:
        # peinture écaillée : le métal apparaît par endroits
        eclats = (bruit_periodique(beta=2.0, graine=61) > 0.72).astype(float)
        eclats = flou(eclats, 1)
        alb = alb * (1 - eclats[..., None]) + np.array([0.45, 0.45, 0.47]) * eclats[..., None]
        m = 0.15 + 0.8 * eclats
        r = r * (1 - eclats) + 0.35 * eclats
        h += eclats * 0.3
    if rayures:
        lignes = np.zeros((N, N))
        rr = np.random.default_rng(9)
        for i in range(60):
            y0 = rr.integers(0, N)
            x0 = rr.integers(0, N)
            L = rr.integers(20, 120)
            pente = rr.uniform(-0.3, 0.3)
            for k in range(L):
                lignes[(y0 + int(k * pente)) % N, (x0 + k) % N] = 1
        r = r - lignes * 0.15
        alb = alb + lignes[..., None] * 0.05
    ecrire(nom, alb, h, r, m, 2.0)


def metal_strie():
    """Tôle larmée (motif en losanges en relief)."""
    y, x = np.mgrid[0:N, 0:N] / N
    n = 8
    u = (x * n + y * n) % 1
    v = (x * n - y * n) % 1
    cellule_x = np.floor(x * n * 2)
    larme = np.where((cellule_x + np.floor(y * n * 2)) % 2 == 0,
                     np.exp(-(((x * n * 2) % 1 - 0.5) ** 2 / 0.06 + ((y * n * 2) % 1 - 0.5) ** 2 / 0.012)),
                     np.exp(-(((x * n * 2) % 1 - 0.5) ** 2 / 0.012 + ((y * n * 2) % 1 - 0.5) ** 2 / 0.06)))
    b = bruit_periodique(beta=2.2, graine=71)
    h = larme * 0.8 + b * 0.2
    alb = couleur((0.42, 0.43, 0.45), [(b, (0.08, 0.08, 0.08))]) * (0.9 + 0.15 * larme[..., None])
    ecrire("metal_strie", alb, h, 0.45 - larme * 0.15 + (b - 0.5) * 0.15, np.ones((N, N)) * 0.9, 6.0)


def tole():
    y, x = np.mgrid[0:N, 0:N] / N
    ondes = 0.5 + 0.5 * np.sin(x * 2 * np.pi * 8)
    b = bruit_periodique(beta=2.2, graine=81)
    rouille = np.clip((bruit_periodique(beta=1.8, graine=82) - 0.62) * 4, 0, 1) * (0.4 + 0.6 * (1 - y))
    h = ondes + b * 0.15
    alb = couleur((0.5, 0.52, 0.5), [(b, (0.08, 0.08, 0.08))])
    alb = alb * (1 - rouille[..., None]) + np.array([0.42, 0.24, 0.13]) * rouille[..., None]
    ecrire("tole", alb, h, 0.5 + rouille * 0.35, 0.75 - rouille * 0.6, 3.0)


def rouille():
    b1 = bruit_periodique(beta=2.0, graine=91)
    b2 = bruit_periodique(beta=1.0, graine=92)
    h = b1 * 0.6 + b2 * 0.4
    alb = couleur((0.42, 0.24, 0.14), [(b1, (0.18, 0.1, 0.06)), (b2, (0.08, 0.05, 0.03))])
    ecrire("rouille", alb, h, 0.85 + (b2 - 0.5) * 0.1, 0.35 + 0.2 * b1, 4.0)


def bois(nom="bois", base=(0.52, 0.37, 0.24), planches=6):
    y, x = np.mgrid[0:N, 0:N] / N
    rang = np.floor(y * planches)
    rr = np.random.default_rng(13)
    decal = rr.random(planches)[rang.astype(int)]
    veines = bruit_periodique(beta=1.5, graine=101)
    fibre = np.sin((x * 3 + decal * 7 + veines * 0.8) * 2 * np.pi * 6) * 0.5 + 0.5
    fy = y * planches - rang
    joint = np.clip(1 - np.minimum(fy, 1 - fy) * N / planches / 2.5, 0, 1)
    h = fibre * 0.3 - joint
    alb = couleur(base, [(fibre, (0.1, 0.07, 0.04)), (veines, (0.08, 0.05, 0.03))])
    alb *= (0.85 + 0.3 * decal[..., None])
    alb *= (1 - joint[..., None] * 0.6)
    ecrire(nom, alb, h, 0.7 + fibre * 0.1 + joint * 0.2, np.zeros((N, N)), 3.0)


def caisse():
    """Caisse en bois : planches + cadre + pochoir."""
    y, x = np.mgrid[0:N, 0:N] / N
    bois_tex = np.sin((x * 3 + bruit_periodique(beta=1.5, graine=111) * 0.8) * 2 * np.pi * 5) * 0.5 + 0.5
    cadre = ((np.minimum(np.minimum(x, 1 - x), np.minimum(y, 1 - y)) < 0.08) | (np.abs(x - y) < 0.05)).astype(float)
    planche = np.floor(y * 5)
    joint = np.clip(1 - np.minimum(y * 5 - planche, 1 - (y * 5 - planche)) * N / 5 / 2, 0, 1) * (1 - cadre)
    h = bois_tex * 0.2 + cadre * 0.8 - joint
    alb = couleur((0.62, 0.48, 0.3), [(bois_tex, (0.12, 0.09, 0.05))])
    alb = alb * (1 - cadre[..., None] * 0.25)
    alb *= (1 - joint[..., None] * 0.5)
    ecrire("caisse", alb, h, 0.75, np.zeros((N, N)), 4.0)


def terre(nom="terre", base=(0.42, 0.34, 0.25), cailloux=True):
    b1 = bruit_periodique(beta=2.0, graine=_h(nom) % 500)
    b2 = bruit_periodique(beta=1.0, graine=_h(nom) % 500 + 3)
    h = b1 * 0.5 + b2 * 0.3
    if cailloux:
        c = (bruit_bande(f0=0.06, larg=0.02, graine=7) > 0.78).astype(float)
        c = flou(c, 1)
        h += c * 0.8
    alb = couleur(base, [(b1, (0.12, 0.1, 0.07)), (b2, (0.06, 0.05, 0.04))])
    if cailloux:
        alb = alb * (1 - c[..., None] * 0.5) + np.array([0.55, 0.53, 0.5]) * c[..., None] * 0.5
    ecrire(nom, alb, h, 0.92, np.zeros((N, N)), 3.0)


def herbe():
    b = bruit_periodique(beta=1.8, graine=131)
    brins = np.random.default_rng(5).random((N, N))
    brins = np.mean([np.roll(brins, k, axis=0) for k in range(4)], axis=0)
    h = brins * 0.6 + b * 0.4
    alb = couleur((0.27, 0.38, 0.17), [(b, (0.12, 0.14, 0.06)), (brins, (0.1, 0.12, 0.05))])
    ecrire("herbe", alb, h, 0.9, np.zeros((N, N)), 3.0)


def carrelage():
    joints, pid, fx, fy = grille(6, 6, 2.5, 0.0, graine=4)
    b = bruit_periodique(beta=2.5, graine=141)
    h = 1 - joints
    alb = couleur((0.82, 0.82, 0.8), [(b, (0.05, 0.05, 0.05))]) * (0.95 + 0.08 * pid[..., None])
    alb = alb * (1 - joints[..., None] * 0.45)
    ecrire("carrelage", alb, h, 0.25 + joints * 0.5, np.zeros((N, N)), 4.0)


def plastique():
    b = bruit_periodique(beta=1.2, graine=151)
    h = b * 0.15
    alb = couleur((0.2, 0.22, 0.25), [(b, (0.03, 0.03, 0.03))])
    ecrire("plastique", alb, h, 0.5 + b * 0.1, np.zeros((N, N)), 1.5)


TOUTES = {
    "beton": lambda: beton("beton", (0.56, 0.55, 0.52), panneaux=True),
    "beton_sombre": lambda: beton("beton_sombre", (0.33, 0.33, 0.34), 0.8),
    "beton_peint": lambda: beton("beton_peint", (0.78, 0.76, 0.7), 0.65, 0.2),
    "dalles": dalles,
    "asphalte": asphalte,
    "brique": brique,
    "metal": lambda: metal("metal", (0.56, 0.58, 0.6), 0.35),
    "metal_peint": lambda: metal("metal_peint", (0.24, 0.4, 0.52), 0.5, 0.2, peint=True),
    "metal_strie": metal_strie,
    "tole": tole,
    "rouille": rouille,
    "bois": bois,
    "caisse": caisse,
    "terre": terre,
    "sable": lambda: terre("sable", (0.76, 0.66, 0.48), False),
    "herbe": herbe,
    "carrelage": carrelage,
    "plastique": plastique,
}

if __name__ == "__main__":
    noms = sys.argv[1:] or list(TOUTES)
    for n in noms:
        TOUTES[n]()
