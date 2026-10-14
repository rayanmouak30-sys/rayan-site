"""Synthèse de tous les sons du jeu (originaux, aucun échantillon externe).

Usage : python3 outils/sons.py [filtre]
Écrit des fichiers Ogg Vorbis mono 44,1 kHz dans assets/sons/. Les variantes s'appellent nom_1.wav, nom_2.wav...
Principe des tirs : transitoire (claquement) + corps (bruit filtré qui décroît) + coup sourd grave
(sinus à hauteur descendante) + mécanique (petits clics) + queue de réverbération (convolution avec
une réponse impulsionnelle synthétique), puis saturation douce et normalisation.
"""
import os
import sys
import wave

import numpy as np
from scipy import signal

SR = 44100
ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ICI, "..", "assets", "sons")
rng = np.random.default_rng(7)


# ---------------------------------------------------------------------------
# Briques de base
# ---------------------------------------------------------------------------
def t_(duree):
    return np.arange(int(duree * SR)) / SR


def bruit(duree):
    return rng.standard_normal(int(duree * SR))


def env_exp(duree, tau, attaque=0.0005):
    t = t_(duree)
    e = np.exp(-t / tau)
    if attaque > 0:
        e *= np.clip(t / attaque, 0, 1)
    return e


def env_adsr(duree, a, d, s, r):
    t = t_(duree)
    e = np.interp(t, [0, a, a + d, max(a + d, duree - r), duree], [0, 1, s, s, 0])
    return e


def passe_bas(x, f, ordre=2):
    b, a = signal.butter(ordre, min(f, SR / 2 - 100) / (SR / 2), "low")
    return signal.lfilter(b, a, x)


def passe_haut(x, f, ordre=2):
    b, a = signal.butter(ordre, f / (SR / 2), "high")
    return signal.lfilter(b, a, x)


def passe_bande(x, f1, f2, ordre=2):
    b, a = signal.butter(ordre, [f1 / (SR / 2), min(f2, SR / 2 - 100) / (SR / 2)], "band")
    return signal.lfilter(b, a, x)


def resonance(x, f, q=8.0):
    """Filtre résonant (pic) : donne une note métallique à un bruit."""
    b, a = signal.iirpeak(f / (SR / 2), q)
    return signal.lfilter(b, a, x)


def sinus_glisse(duree, f0, f1, courbe=6.0):
    t = t_(duree)
    f = f1 + (f0 - f1) * np.exp(-t * courbe / max(duree, 1e-3))
    phase = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(phase)


def placer(dest, src, debut, gain=1.0):
    i = int(debut * SR)
    if i >= len(dest):
        return dest
    n = min(len(src), len(dest) - i)
    dest[i:i + n] += src[:n] * gain
    return dest


def mix(*xs):
    """Somme de signaux de longueurs différentes (complétés par du silence)."""
    n = max(len(x) for x in xs)
    r = np.zeros(n)
    for x in xs:
        r[: len(x)] += x
    return r


def vide(duree):
    return np.zeros(int(duree * SR))


def reverb(x, duree=1.0, couleur=4000, densite=1.0, humide=0.35, predelai=0.012):
    """Réverbération par convolution avec une réponse impulsionnelle synthétique."""
    n = int(duree * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / (SR * duree / 6.0))
    ir = passe_bas(ir, couleur)
    crete = np.max(np.abs(ir[: int(0.05 * SR)]))
    # Premières réflexions (discrètes, sans écho marqué)
    for k in range(6):
        d = int((0.007 + 0.011 * k + rng.random() * 0.006) * SR)
        if d < n:
            ir[d] += (0.5 - k * 0.06) * (1 if rng.random() > 0.5 else -1) * crete
    ir *= densite
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
    pd = np.zeros(int(predelai * SR))
    mouille = signal.fftconvolve(np.concatenate([pd, x]), ir)[: len(x) + n]
    sec = np.concatenate([x, np.zeros(n)])
    return sec * (1 - humide * 0.3) + mouille * humide


def saturer(x, force=1.5):
    return np.tanh(x * force) / np.tanh(force)


def normaliser(x, crete_db=-1.0):
    m = np.max(np.abs(x)) + 1e-9
    return x / m * (10 ** (crete_db / 20))


def fondu_fin(x, duree=0.01):
    n = min(len(x), int(duree * SR))
    if n > 0:
        x[-n:] *= np.linspace(1, 0, n)
    return x


def couper_silence(x, seuil=0.0008):
    idx = np.where(np.abs(x) > seuil)[0]
    if len(idx) == 0:
        return x
    return x[: idx[-1] + 1]


def ecrire(nom, x, crete_db=-1.0):
    x = normaliser(couper_silence(fondu_fin(np.asarray(x, dtype=np.float64))), crete_db)
    os.makedirs(SORTIE, exist_ok=True)
    # Ogg Vorbis (bien plus léger que le WAV, lu nativement par Godot)
    import soundfile
    soundfile.write(os.path.join(SORTIE, nom + ".ogg"), np.clip(x, -1, 1).astype(np.float32), SR, format="OGG", subtype="VORBIS")


# ---------------------------------------------------------------------------
# Composants de tir
# ---------------------------------------------------------------------------
def claquement(duree=0.004, f_haut=1500, gain=1.0):
    n = bruit(duree) * np.linspace(1, 0, int(duree * SR)) ** 2
    return passe_haut(n, f_haut) * gain


def corps(duree, tau, f_bas, f_haut, gain=1.0):
    return passe_bande(bruit(duree), f_bas, f_haut) * env_exp(duree, tau, 0.0004) * gain


def coup_sourd(duree, f0, f1, tau, gain=1.0):
    return sinus_glisse(duree, f0, f1, 9) * env_exp(duree, tau, 0.001) * gain


def clic(f=3000, q=6, duree=0.025, gain=1.0):
    x = bruit(duree) * env_exp(duree, duree / 6, 0.0002)
    return (resonance(x, f, q) * 0.7 + passe_haut(x, 2000) * 0.3) * gain


def tir(params, variante):
    p = dict(params)
    v = 1.0 + (variante - 1) * 0.035 * (1 if variante % 2 else -1)
    d = p["duree"]
    x = vide(d)
    placer(x, claquement(0.005, p.get("f_claquement", 1500), p.get("claquement", 1.0)), 0)
    placer(x, corps(d, p["tau_corps"], p["f_bas"] * v, p["f_haut"] * v, p.get("corps", 1.0)), 0)
    placer(x, coup_sourd(min(d, 0.5), p["f_sourd"] * v, p["f_sourd"] * 0.45, p["tau_sourd"], p.get("sourd", 1.0)), 0)
    if p.get("mecanique"):
        for (dt, f, g) in p["mecanique"]:
            placer(x, clic(f * v, 7, 0.02, g), dt)
    if p.get("energie"):
        # Pulsar : zap descendant + harmonique cristalline
        z = sinus_glisse(0.16, 2600 * v, 380, 5) * env_exp(0.16, 0.045, 0.001)
        z += 0.5 * sinus_glisse(0.16, 5200 * v, 760, 5) * env_exp(0.16, 0.03, 0.001)
        z += 0.35 * np.sign(sinus_glisse(0.16, 900 * v, 120, 4)) * env_exp(0.16, 0.025, 0.001)
        placer(x, passe_bas(z, 9000) * p["energie"], 0.001)
        # Sifflement de recharge du condensateur
        s = sinus_glisse(0.1, 1800, 4200, 2) * env_exp(0.1, 0.03, 0.01) * 0.12
        placer(x, s, 0.035)
    x = saturer(x, p.get("saturation", 2.0))
    x = reverb(x, p.get("rev_duree", 0.9), p.get("rev_couleur", 3500), humide=p.get("rev", 0.35))
    return x


ARMES = {
    "pistolet": {"duree": 0.5, "tau_corps": 0.028, "f_bas": 500, "f_haut": 6500, "f_sourd": 150, "tau_sourd": 0.04,
                 "sourd": 0.7, "corps": 1.1, "f_claquement": 2500, "mecanique": [(0.018, 3800, 0.25), (0.05, 2600, 0.18)],
                 "saturation": 2.2, "rev": 0.32, "rev_duree": 0.8},
    "fusil": {"duree": 0.6, "tau_corps": 0.04, "f_bas": 250, "f_haut": 5200, "f_sourd": 105, "tau_sourd": 0.06,
              "sourd": 1.1, "corps": 1.0, "mecanique": [(0.012, 3100, 0.22)], "saturation": 2.6, "rev": 0.38, "rev_duree": 1.0},
    "pulsar": {"duree": 0.55, "tau_corps": 0.022, "f_bas": 700, "f_haut": 7000, "f_sourd": 120, "tau_sourd": 0.05,
               "sourd": 0.9, "corps": 0.55, "energie": 0.8, "saturation": 1.8, "rev": 0.34, "rev_duree": 0.9, "rev_couleur": 5000},
    "pompe": {"duree": 1.0, "tau_corps": 0.08, "f_bas": 120, "f_haut": 3600, "f_sourd": 70, "tau_sourd": 0.12,
              "sourd": 1.5, "corps": 1.2, "saturation": 3.0, "rev": 0.3, "rev_duree": 1.2, "rev_couleur": 2600},
    "sniper": {"duree": 1.4, "tau_corps": 0.05, "f_bas": 150, "f_haut": 6000, "f_sourd": 58, "tau_sourd": 0.1,
               "sourd": 1.6, "corps": 1.25, "claquement": 1.6, "f_claquement": 3000, "saturation": 3.2, "rev": 0.34,
               "rev_duree": 1.8, "rev_couleur": 3000},
}


# ---------------------------------------------------------------------------
# Mécanique, manipulation, couteau
# ---------------------------------------------------------------------------
def metal_choc(f=2400, duree=0.12, tau=0.03, gain=1.0, q=12):
    x = bruit(duree) * env_exp(duree, 0.004, 0.0002)
    r = resonance(x, f, q) + 0.6 * resonance(x, f * 1.73, q) + 0.3 * resonance(x, f * 2.41, q)
    return r * env_exp(duree, tau, 0.0002) * gain


def glissement(duree=0.18, f1=1500, f2=4500, gain=1.0):
    x = bruit(duree)
    t = t_(duree)
    x = passe_bande(x, f1, f2) * (np.sin(np.pi * t / duree) ** 1.5)
    # Grain du frottement
    grain = 1 + 0.5 * np.sign(np.sin(2 * np.pi * 60 * t + rng.random() * 3))
    return x * grain * gain


def sons_mecaniques():
    for i in range(1, 3):
        x = vide(0.3)
        placer(x, glissement(0.08, 1200, 5000, 0.5), 0)
        placer(x, metal_choc(1700 + i * 80, 0.15, 0.025, 1.0), 0.07)
        placer(x, clic(3200, 5, 0.03, 0.6), 0.075)
        ecrire(f"chargeur_sortie_{i}", reverb(x, 0.3, 4000, humide=0.15), -4)
        x = vide(0.35)
        placer(x, glissement(0.1, 1000, 4000, 0.5), 0)
        placer(x, metal_choc(1300 + i * 60, 0.18, 0.03, 1.0), 0.09)
        placer(x, clic(4200, 4, 0.03, 1.0), 0.095)
        placer(x, clic(2600, 6, 0.02, 0.5), 0.13)
        ecrire(f"chargeur_entree_{i}", reverb(x, 0.3, 4000, humide=0.15), -3)
        x = vide(0.35)
        placer(x, clic(2800, 5, 0.03, 0.7), 0)
        placer(x, glissement(0.07, 1500, 6000, 0.6), 0.01)
        placer(x, metal_choc(2100 + i * 90, 0.15, 0.02, 1.0), 0.08)
        placer(x, clic(3600, 4, 0.03, 1.0), 0.085)
        ecrire(f"armement_{i}", reverb(x, 0.3, 4500, humide=0.15), -3)
        x = vide(0.2)
        placer(x, clic(3000, 5, 0.02, 0.6), 0)
        placer(x, metal_choc(2600, 0.1, 0.015, 0.7), 0.05)
        ecrire(f"armement_leger_{i}", x, -8)
        x = vide(0.25)
        placer(x, glissement(0.05, 2000, 7000, 0.5), 0)
        placer(x, metal_choc(2900 + i * 100, 0.12, 0.018, 1.0), 0.05)
        ecrire(f"culasse_pistolet_{i}", reverb(x, 0.25, 5000, humide=0.12), -4)
        # Pompe : aller-retour
        x = vide(0.45)
        placer(x, glissement(0.12, 800, 3500, 0.8), 0)
        placer(x, metal_choc(1100, 0.12, 0.03, 0.9), 0.1)
        placer(x, glissement(0.1, 900, 3800, 0.8), 0.17)
        placer(x, metal_choc(1500, 0.15, 0.03, 1.0), 0.26)
        ecrire(f"pompe_{i}", reverb(x, 0.35, 3500, humide=0.18), -2)
        x = vide(0.3)
        placer(x, clic(2200, 4, 0.03, 0.7), 0)
        placer(x, glissement(0.12, 1200, 4500, 0.6), 0.02)
        placer(x, metal_choc(1900, 0.12, 0.02, 0.8), 0.13)
        ecrire(f"verrou_ouvre_{i}", reverb(x, 0.3, 4000, humide=0.15), -4)
        x = vide(0.3)
        placer(x, glissement(0.1, 1200, 4500, 0.6), 0)
        placer(x, metal_choc(1600, 0.16, 0.025, 1.0), 0.1)
        placer(x, clic(3500, 4, 0.03, 0.9), 0.15)
        ecrire(f"verrou_ferme_{i}", reverb(x, 0.3, 4000, humide=0.15), -3)
    for i in range(1, 4):
        x = vide(0.22)
        placer(x, glissement(0.06, 900, 3000, 0.5), 0)
        placer(x, metal_choc(1250 + i * 70, 0.12, 0.02, 0.8, q=6), 0.05)
        placer(x, clic(1800, 4, 0.03, 0.5), 0.06)
        ecrire(f"cartouche_{i}", x, -5)
        # Manipulation : tissu + petits contacts métalliques
        x = vide(0.4)
        placer(x, passe_bande(bruit(0.3), 400, 3000) * np.sin(np.pi * t_(0.3) / 0.3) ** 2 * 0.25, 0)
        placer(x, clic(2400 + i * 200, 5, 0.03, 0.35), 0.12 + i * 0.03)
        ecrire(f"manip_{i}", x, -10)
        x = passe_bande(bruit(0.35), 300, 2500) * np.sin(np.pi * t_(0.35) / 0.35) ** 2
        ecrire(f"sortie_tissu_{i}", x, -12)
    ecrire("equiper", reverb(placer(vide(0.25), metal_choc(2200, 0.12, 0.02), 0.03), 0.2, 4000, humide=0.1), -8)
    # Détente à vide
    x = vide(0.12)
    placer(x, clic(3400, 5, 0.03, 1.0), 0)
    placer(x, clic(2200, 6, 0.03, 0.5), 0.012)
    ecrire("vide", x, -6)
    # Couteau
    for i in range(1, 4):
        d = 0.32
        t = t_(d)
        f = 800 + 2600 * np.sin(np.pi * t / d) ** 2
        x = bruit(d)
        # Filtre à fréquence variable : sifflement de la lame dans l'air
        y = np.zeros_like(x)
        for k in range(0, len(x), 256):
            seg = x[k:k + 256]
            fc = f[k]
            y[k:k + 256] = passe_bande(seg, fc * 0.6, fc * 1.6)
        y *= np.sin(np.pi * t / d) ** 2
        ecrire(f"couteau_{i}", y, -6)
        d = 0.5
        t = t_(d)
        f = 500 + 1800 * np.sin(np.pi * t / d) ** 2
        x = bruit(d)
        y = np.zeros_like(x)
        for k in range(0, len(x), 256):
            fc = f[k]
            y[k:k + 256] = passe_bande(x[k:k + 256], fc * 0.6, fc * 1.6)
        y *= np.sin(np.pi * t / d) ** 2
        ecrire(f"couteau_lourd_{i}", y, -4)
        ecrire(f"couteau_mur_{i}", reverb(metal_choc(2600 + i * 150, 0.3, 0.07, 1.0, 20), 0.4, 6000, humide=0.2), -5)
    x = vide(0.6)
    placer(x, glissement(0.4, 3000, 9000, 0.7), 0)
    placer(x, metal_choc(4200, 0.5, 0.12, 0.6, 30), 0.32)
    ecrire("couteau_sortie", x, -8)


# ---------------------------------------------------------------------------
# Impacts, touches, pas
# ---------------------------------------------------------------------------
def sons_impacts():
    for i in range(1, 4):
        v = 1 + (i - 2) * 0.06
        x = mix(corps(0.18, 0.02, 400 * v, 5000, 1.0), claquement(0.003, 2000, 0.7))
        placer(x, passe_bande(bruit(0.12), 2000, 8000) * env_exp(0.12, 0.03) * 0.25, 0.01)  # éclats
        ecrire(f"impact_beton_{i}", reverb(x, 0.3, 4000, humide=0.15), -3)
        x = mix(metal_choc(1800 * v, 0.4, 0.06, 1.0, 25), metal_choc(3700 * v, 0.3, 0.04, 0.5, 30), claquement(0.003, 3000, 0.6))
        ecrire(f"impact_metal_{i}", reverb(x, 0.4, 6000, humide=0.2), -3)
        x = corps(0.15, 0.025, 200 * v, 2500, 1.0) + resonance(bruit(0.15) * env_exp(0.15, 0.02), 420 * v, 4) * 0.6
        ecrire(f"impact_bois_{i}", x, -4)
        x = corps(0.2, 0.04, 100 * v, 1500, 1.0)
        placer(x, passe_bande(bruit(0.15), 1500, 5000) * env_exp(0.15, 0.04) * 0.2, 0.01)
        ecrire(f"impact_terre_{i}", x, -5)
        y = vide(0.35)
        placer(y, claquement(0.004, 3000, 1.0), 0)
        for k in range(10):
            placer(y, metal_choc(3500 + rng.random() * 5000, 0.06, 0.012, 0.35 * rng.random(), 40), 0.005 + rng.random() * 0.2)
        ecrire(f"impact_verre_{i}", y, -4)
        x = passe_bande(bruit(0.2), 800, 6000) * env_exp(0.2, 0.05) * (1 + 0.6 * np.sign(np.sin(2 * np.pi * 37 * t_(0.2))))
        ecrire(f"impact_vegetal_{i}", x, -8)
    # Retour de touche (pour le tireur) : clic sec / ding métallique pour la tête
    x = mix(corps(0.06, 0.008, 1500, 6000, 1.0), coup_sourd(0.06, 300, 150, 0.01, 0.5))
    ecrire("touche", x, -6)
    x = metal_choc(3100, 0.35, 0.07, 1.0, 30) + 0.6 * np.concatenate([np.sin(2 * np.pi * 1550 * t_(0.35)) * env_exp(0.35, 0.06, 0.001)])
    ecrire("touche_tete", x, -3)
    # Élimination confirmée : double tonalité ascendante
    x = vide(0.5)
    for k, f in enumerate([880, 1320]):
        s = np.sin(2 * np.pi * f * t_(0.3)) + 0.3 * np.sin(2 * np.pi * f * 2 * t_(0.3))
        placer(x, s * env_exp(0.3, 0.08, 0.002) * 0.6, k * 0.07)
    ecrire("elimination", reverb(x, 0.6, 6000, humide=0.25), -4)
    # Dégâts reçus : choc sourd
    x = coup_sourd(0.25, 120, 50, 0.06, 1.0) + corps(0.25, 0.03, 100, 1200, 0.6)
    ecrire("degat_recu", saturer(x, 2), -4)
    # Pas : talon puis semelle, selon la surface
    surfaces = {
        "beton": (lambda v: mix(corps(0.12, 0.012, 300 * v, 4000, 1.0), coup_sourd(0.1, 120, 70, 0.015, 0.6))),
        "metal": (lambda v: mix(corps(0.12, 0.01, 400 * v, 5000, 0.7), metal_choc(900 * v, 0.25, 0.05, 0.6, 15), metal_choc(2300 * v, 0.2, 0.03, 0.3, 20))),
        "bois": (lambda v: corps(0.12, 0.015, 150 * v, 2500, 1.0) + resonance(bruit(0.12) * env_exp(0.12, 0.02), 300 * v, 5) * 0.8),
        "terre": (lambda v: corps(0.16, 0.03, 120 * v, 2200, 1.0) + passe_bande(bruit(0.16), 2000, 6000) * env_exp(0.16, 0.04) * 0.15),
        "vegetal": (lambda v: passe_bande(bruit(0.2), 600, 7000) * env_exp(0.2, 0.05) * (1 + 0.8 * np.sign(np.sin(2 * np.pi * 43 * t_(0.2)))) * 0.6 + corps(0.2, 0.02, 100, 1500, 0.5)),
        "verre": (lambda v: mix(corps(0.12, 0.01, 400 * v, 5000, 0.8), metal_choc(3200 * v, 0.15, 0.02, 0.2, 30))),
    }
    for nom, f in surfaces.items():
        for i in range(1, 5):
            v = 1 + (i - 2.5) * 0.05
            x = vide(0.35)
            placer(x, f(v) * 0.6, 0)
            placer(x, f(v * 1.05), 0.035)
            ecrire(f"pas_{nom}_{i}", reverb(x, 0.25, 3000, humide=0.12), -6)
    x = mix(passe_bande(bruit(0.2), 200, 2500) * env_exp(0.2, 0.05) * 0.6, corps(0.15, 0.02, 100, 1000, 0.4))
    ecrire("saut", x, -10)


# ---------------------------------------------------------------------------
# Capacités, explosions, interface, annonces sonores
# ---------------------------------------------------------------------------
def sons_capacites():
    # Explosion : coup grave saturé + grondement + débris
    x = vide(2.5)
    placer(x, coup_sourd(1.2, 90, 30, 0.35, 1.6), 0)
    placer(x, corps(2.0, 0.35, 40, 3000, 1.3), 0)
    placer(x, claquement(0.01, 800, 2.0), 0)
    for k in range(14):
        placer(x, corps(0.08, 0.01, 1500, 7000, 0.15 * rng.random()), 0.2 + rng.random() * 1.2)
    ecrire("explosion", reverb(saturer(x, 3.0), 2.0, 2000, humide=0.5), -1)
    # Flash : détonation sèche + sifflement aigu qui s'estompe
    x = vide(2.2)
    placer(x, mix(claquement(0.006, 1500, 1.5), corps(0.3, 0.03, 500, 8000, 1.0)), 0)
    placer(x, np.sin(2 * np.pi * 3600 * t_(2.0)) * env_exp(2.0, 0.6, 0.05) * 0.18, 0.05)
    ecrire("flash", reverb(x, 1.0, 6000, humide=0.3), -2)
    # Fumée : souffle prolongé
    d = 2.0
    x = passe_bande(bruit(d), 300, 5000) * env_adsr(d, 0.05, 0.3, 0.5, 1.2)
    ecrire("fumee", x, -6)
    # Lancer / rebond de grenade
    ecrire("lancer", passe_bande(bruit(0.25), 400, 3000) * np.sin(np.pi * t_(0.25) / 0.25) ** 2, -10)
    for i in range(1, 3):
        ecrire(f"rebond_{i}", metal_choc(900 + i * 300, 0.15, 0.02, 1.0, 8), -8)
    # Activation générique : montée synthétique
    for nom, f0, f1 in [("capacite", 400, 1600), ("bouclier", 250, 900), ("soin", 600, 1200), ("ruee", 300, 120), ("teleport", 2000, 300)]:
        d = 0.5
        s = sinus_glisse(d, f0, f1, 3) + 0.4 * sinus_glisse(d, f0 * 1.5, f1 * 1.5, 3)
        s *= env_adsr(d, 0.01, 0.15, 0.5, 0.3)
        if nom == "ruee":
            s = s * 0.5 + passe_bande(bruit(d), 300, 3000) * env_adsr(d, 0.02, 0.1, 0.6, 0.3)
        if nom == "teleport":
            s += passe_haut(bruit(d), 4000) * env_exp(d, 0.1) * 0.3
        if nom == "soin":
            for k, f in enumerate([660, 880, 1100]):
                placer(s, np.sin(2 * np.pi * f * t_(0.25)) * env_exp(0.25, 0.08, 0.005) * 0.4, k * 0.06)
        ecrire(nom, reverb(s, 0.6, 5000, humide=0.3), -5)
    # Sonar : ping
    x = np.sin(2 * np.pi * 1450 * t_(1.0)) * env_exp(1.0, 0.18, 0.002) + 0.3 * np.sin(2 * np.pi * 2900 * t_(1.0)) * env_exp(1.0, 0.1, 0.002)
    ecrire("sonar", reverb(x, 1.2, 5000, humide=0.45), -4)
    # Mur / barrière qui se dresse
    x = vide(1.0)
    placer(x, coup_sourd(0.6, 70, 40, 0.15, 1.0), 0)
    placer(x, corps(0.8, 0.2, 80, 2500, 0.8), 0)
    placer(x, sinus_glisse(0.6, 200, 600, 2) * env_adsr(0.6, 0.05, 0.2, 0.4, 0.3) * 0.3, 0.05)
    ecrire("mur", reverb(saturer(x, 2), 0.8, 3000, humide=0.3), -3)
    # Tourelle / drone : bourdonnement
    d = 1.0
    t = t_(d)
    s = np.sign(np.sin(2 * np.pi * 110 * t)) * 0.3 + np.sin(2 * np.pi * 220 * t) * 0.4
    s = passe_bas(s, 1800) * (0.8 + 0.2 * np.sin(2 * np.pi * 7 * t))
    ecrire("drone", s * env_adsr(d, 0.05, 0.1, 0.9, 0.05), -10)
    ecrire("tourelle_tir", saturer(mix(claquement(0.004, 2000, 1), corps(0.15, 0.02, 600, 6000, 0.8)), 2), -6)
    # Ultime prête
    x = vide(1.0)
    for k, f in enumerate([523, 659, 784, 1046]):
        placer(x, (np.sin(2 * np.pi * f * t_(0.5)) + 0.3 * np.sin(4 * np.pi * f * t_(0.5))) * env_exp(0.5, 0.15, 0.005) * 0.5, k * 0.08)
    ecrire("ultime_pret", reverb(x, 1.0, 6000, humide=0.35), -4)
    # Ultime lancée : grand impact cinématique
    x = vide(2.0)
    placer(x, coup_sourd(1.5, 70, 28, 0.5, 1.5), 0)
    placer(x, sinus_glisse(1.0, 200, 1200, 1.5) * env_adsr(1.0, 0.3, 0.3, 0.4, 0.4) * 0.3, 0)
    placer(x, corps(1.5, 0.4, 60, 2000, 0.6), 0)
    ecrire("ultime", reverb(saturer(x, 2), 1.8, 2500, humide=0.5), -2)
    # Spike (bombe) : bip, pose, désamorçage, détonation finale
    ecrire("spike_bip", np.sin(2 * np.pi * 2093 * t_(0.09)) * env_adsr(0.09, 0.003, 0.02, 0.7, 0.03), -6)
    x = vide(1.2)
    for k in range(5):
        placer(x, clic(3000 + k * 300, 5, 0.03, 0.6), k * 0.18)
    placer(x, np.sin(2 * np.pi * 1760 * t_(0.3)) * env_exp(0.3, 0.1, 0.005) * 0.6, 0.95)
    ecrire("spike_pose", x, -4)
    x = vide(0.8)
    placer(x, sinus_glisse(0.6, 1600, 300, 2) * env_adsr(0.6, 0.01, 0.2, 0.6, 0.3) * 0.6, 0)
    placer(x, metal_choc(2000, 0.2, 0.05, 0.6), 0.5)
    ecrire("spike_desamorce", reverb(x, 0.6, 5000, humide=0.3), -4)


def sons_interface():
    def note(f, d=0.12, tau=0.04, h=0.3):
        return (np.sin(2 * np.pi * f * t_(d)) + h * np.sin(4 * np.pi * f * t_(d))) * env_exp(d, tau, 0.002)
    ecrire("ui_survol", passe_haut(note(2400, 0.05, 0.012, 0.1), 800), -18)
    ecrire("ui_clic", mix(note(1500, 0.1, 0.025), 0.5 * clic(4000, 5, 0.02, 0.6)), -10)
    ecrire("ui_retour", note(900, 0.12, 0.03), -12)
    x = vide(0.35)
    placer(x, note(1046, 0.2, 0.05), 0)
    placer(x, note(1568, 0.25, 0.07), 0.06)
    ecrire("ui_achat", x, -8)
    ecrire("ui_refus", note(220, 0.25, 0.08, 0.6) * (1 + 0.5 * np.sign(np.sin(2 * np.pi * 30 * t_(0.25)))), -10)
    x = vide(0.4)
    placer(x, note(784, 0.15, 0.05), 0)
    placer(x, note(1175, 0.3, 0.1), 0.08)
    ecrire("ui_valider", reverb(x, 0.5, 6000, humide=0.25), -8)
    ecrire("compte_a_rebours", note(1318, 0.15, 0.04, 0.2), -10)
    # Fin de manche
    for nom, notes in [("manche_gagnee", [523, 659, 784, 1046]), ("manche_perdue", [440, 349, 294, 220])]:
        x = vide(1.6)
        for k, f in enumerate(notes):
            s = sum(np.sin(2 * np.pi * f * m * t_(0.9)) / m for m in (1, 2, 3)) * env_exp(0.9, 0.3, 0.01) * 0.4
            placer(x, s, k * 0.12)
        ecrire(nom, reverb(x, 1.5, 4000, humide=0.4), -3)
    # Début de manche : impact grave + montée
    x = vide(1.5)
    placer(x, coup_sourd(1.0, 80, 35, 0.3, 1.2), 0)
    placer(x, sinus_glisse(0.8, 300, 900, 2) * env_adsr(0.8, 0.2, 0.2, 0.5, 0.3) * 0.25, 0)
    ecrire("manche_debut", reverb(saturer(x, 1.6), 1.4, 3000, humide=0.45), -3)


def musique_menu():
    """Boucle d'ambiance du menu : nappes lentes et pulsation légère (64 s)."""
    d = 32.0
    t = t_(d)
    accords = [[220, 261.6, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [196, 246.9, 329.6]]
    x = np.zeros_like(t)
    seg = d / len(accords)
    for k, acc in enumerate(accords):
        e = np.clip(1 - np.abs((t - (k + 0.5) * seg) / (seg * 0.75)), 0, 1) ** 1.2
        for f in acc:
            for det in (-0.6, 0.6):
                ph = rng.random() * 6.28
                x += np.sin(2 * np.pi * (f + det) * t + ph) * e * 0.08
                x += np.sin(2 * np.pi * (f * 2 + det) * t + ph) * e * 0.02
    # Basse pulsée
    for k, acc in enumerate(accords):
        for b in range(16):
            debut = k * seg + b * seg / 16
            n = np.sin(2 * np.pi * acc[0] / 2 * t_(0.4)) * env_exp(0.4, 0.12, 0.005) * 0.25
            placer(x, n, debut)
    # Scintillements
    for k in range(40):
        f = rng.choice([880, 987.8, 1174.7, 1318.5, 1568])
        placer(x, np.sin(2 * np.pi * f * t_(1.0)) * env_exp(1.0, 0.3, 0.01) * 0.05, rng.random() * (d - 1))
    x = passe_bas(x, 5000)
    x = reverb(x, 3.0, 3000, humide=0.6)[: len(t)]
    # Boucle sans couture : fondu croisé début/fin
    n = int(1.5 * SR)
    x[:n] = x[:n] * np.linspace(0, 1, n) + x[-n:] * np.linspace(1, 0, n)
    x = x[:-n]
    ecrire("musique_menu", x, -6)


def main():
    filtre = sys.argv[1] if len(sys.argv) > 1 else ""
    if not filtre or filtre == "tirs":
        for nom, p in ARMES.items():
            for v in range(1, 4):
                ecrire(f"tir_{nom}_{v}", tir(p, v), -0.5)
    if not filtre or filtre == "meca":
        sons_mecaniques()
    if not filtre or filtre == "impacts":
        sons_impacts()
    if not filtre or filtre == "capacites":
        sons_capacites()
    if not filtre or filtre == "ui":
        sons_interface()
    if not filtre or filtre == "musique":
        musique_menu()
    print("sons écrits dans", os.path.normpath(SORTIE))


if __name__ == "__main__":
    main()
