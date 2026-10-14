"""Armes de Neon Strike : modèles détaillés + bras FPS riggés + animations, exportés en .glb pour Godot.

Usage : python armes.py [id_arme ...]   (sans argument : toutes les armes)
Produit, pour chaque arme :
  assets/armes/vm_<id>.glb   vue à la première personne (bras + arme + animations)
  assets/armes/arme_<id>.glb arme seule (tenue par les personnages, vitrine, arsenal)

Repère de l'arme : Y vers la bouche du canon, Z vers le haut, origine = centre de la poignée (main droite).
Repère de la vue FPS : caméra à l'origine, regard vers +Y, haut +Z.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Matrix, Vector, Euler, Quaternion  # noqa: E402
from modelage import (  # noqa: E402
    nouvelle_scene, materiau, hexa, boite, cylindre, sphere, tore, profil, tube, revolution, soustraire,
    Assemblage, armature, parenter_os, peau, poids_segments, poser, cle, ik_deux_os, matrice_visee,
    nouvelle_action, finir_action, exporter_glb, lier, regler_os,
)

PROJET = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SORTIE = os.path.join(PROJET, "assets", "armes")
FPS = 60


# ===========================================================================
# Matériaux (les noms servent de clés aux skins dans Godot)
# ===========================================================================
def materiaux():
    return {
        "carcasse": materiau("Carcasse", hexa("#343a44"), 0.75, 0.38),
        "claire": materiau("CarcasseClaire", hexa("#5a6270"), 0.7, 0.42),
        "polymere": materiau("Polymere", hexa("#1d2026"), 0.05, 0.72),
        "acier": materiau("Acier", hexa("#8a9099"), 0.95, 0.28),
        "sombre": materiau("AcierSombre", hexa("#202329"), 0.9, 0.35),
        "caoutchouc": materiau("Caoutchouc", hexa("#141518"), 0.0, 0.92),
        "accent": materiau("Accent", hexa("#7cffd4"), 0.0, 0.4, emission=hexa("#7cffd4"), force_emission=2.0),
        "coque": materiau("Coque", hexa("#c9ced5"), 0.15, 0.45),
        "coque_grise": materiau("CoqueGrise", hexa("#8b919b"), 0.5, 0.5),
        "plaque": materiau("Plaque", hexa("#2a5bd0"), 0.3, 0.4),
        "lumiere": materiau("Lumiere", hexa("#45f0ff"), 0.0, 0.3, emission=hexa("#45f0ff"), force_emission=4.0),
        "cable": materiau("Cable", hexa("#b3262a"), 0.05, 0.55),
        "verre": materiau("Verre", hexa("#1a3040"), 0.2, 0.05),
        "laiton": materiau("Laiton", hexa("#c9a24a"), 1.0, 0.3),
        "lame": materiau("Lame", hexa("#c8ccd2"), 1.0, 0.18),
        "ecran": materiau("Ecran", hexa("#061016"), 0.0, 0.2, emission=hexa("#45f0ff"), force_emission=0.3),
        "reticule": materiau("Reticule", hexa("#ff3040"), 0.0, 0.3, emission=hexa("#ff3040"), force_emission=6.0),
    }


def materiaux_bras():
    return {
        "manche": materiau("Manche", hexa("#2c3a56"), 0.0, 0.9),
        "gant": materiau("Gant", hexa("#23262d"), 0.0, 0.75),
        "renfort": materiau("Renfort", hexa("#454b57"), 0.35, 0.5),
        "accent": materiau("AccentBras", hexa("#7cffd4"), 0.0, 0.4, emission=hexa("#7cffd4"), force_emission=1.5),
        "peau": materiau("Peau", hexa("#8d5a3b"), 0.0, 0.6),
    }


# ===========================================================================
# Modèles d'armes : chaque fonction renvoie (pieces, points)
#   pieces : {"carcasse": Assemblage, "chargeur": Assemblage, "culasse"/"levier"/"pompe"/"verrou": Assemblage}
#   points : positions utiles (bouche, viseur, éjection, écran...) + prises des mains
# ===========================================================================

def vis(A, m, pos, axe="X", r=0.0035):
    """Petite tête de vis."""
    A.ajouter(cylindre(r, 0.002, axe=axe, position=pos, segments=10), m)
    A.ajouter(boite((0.0008 if axe != "X" else 0.0025, 0.0008 if axe == "Y" else r * 1.6, r * 1.6 if axe != "Z" else 0.0008), position=pos), m)


def arme_pulsar(M):
    """Pulsar P-07 : fusil à impulsion, coque blanche, plaques bleues, lumières cyan, écran de munitions."""
    P = lambda a, h: (a + 0.07, h + 0.082)  # conversion depuis le dessin d'origine (poignée à l'origine)
    pp = lambda pts: [P(a, h) for a, h in pts]
    C = Assemblage("Pulsar")
    # Coque supérieure massive avec nez biseauté et fentes d'aération
    coque = profil(pp([[-0.14, -0.02], [0.46, -0.02], [0.5, 0.0], [0.5, 0.055], [0.44, 0.086], [-0.06, 0.086], [-0.14, 0.06]]), 0.082, 0.006)
    fentes = []
    for i in range(5):
        y = 0.27 + i * 0.035
        fentes.append(boite((0.1, 0.012, 0.03), position=(0, y, 0.145), rotation=(0, 0, 0)))
    soustraire(coque, *fentes)
    C.ajouter(coque, M["coque"])
    for i in range(5):  # fond sombre des fentes
        C.ajouter(boite((0.074, 0.012, 0.028), position=(0, 0.27 + i * 0.035, 0.145)), M["sombre"])
    # Carcasse inférieure grise et puits du chargeur
    C.ajouter(profil(pp([[-0.12, -0.02], [0.3, -0.02], [0.3, -0.046], [0.24, -0.062], [0.0, -0.062], [-0.05, -0.042], [-0.12, -0.042]]), 0.07, 0.004), M["coque_grise"])
    # Plaques latérales bleues et poignée de transport
    C.ajouter(profil(pp([[-0.12, 0.0], [0.1, 0.0], [0.13, 0.04], [0.12, 0.076], [-0.1, 0.076]]), 0.09, 0.004), M["plaque"])
    poignee = profil(pp([[-0.02, 0.084], [0.13, 0.084], [0.12, 0.112], [0.0, 0.112]]), 0.05, 0.004)
    soustraire(poignee, profil(pp([[0.02, 0.09], [0.1, 0.09], [0.095, 0.104], [0.025, 0.104]]), 0.2, 0.0))
    C.ajouter(poignee, M["plaque"])
    for sx in (-1, 1):
        # Fenêtres lumineuses (cadre noir + bande cyan) et vis des plaques
        C.ajouter(boite((0.006, 0.29, 0.032), position=(sx * 0.041, 0.28, 0.11), biseau=0.003), M["sombre"])
        C.ajouter(boite((0.004, 0.25, 0.016), position=(sx * 0.044, 0.28, 0.11)), M["lumiere"])
        for y in (-0.02, 0.1):
            vis(C, M["acier"], (sx * 0.046, y + 0.07, 0.095))
    # Rail supérieur avec crans, viseur holographique sur rehausse
    C.ajouter(boite((0.03, 0.36, 0.012), position=(0, 0.33, 0.174), biseau=0.002), M["sombre"])
    for i in range(26):
        C.ajouter(boite((0.032, 0.006, 0.006), position=(0, 0.17 + i * 0.013, 0.183), biseau=0.001), M["sombre"])
    cadre = profil([(-0.024, 0.0), (0.024, 0.0), (0.024, 0.038), (0.016, 0.045), (-0.016, 0.045), (-0.024, 0.038)], 0.036, 0.0015)
    # le profil est dessiné en (avant, haut) : on le tourne pour qu'il soit face à la caméra
    bmesh.ops.rotate(cadre, verts=cadre.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 4, "Z"))
    soustraire(cadre, boite((0.038, 0.2, 0.034), position=(0, 0, 0.022)))
    C.ajouter(cadre, M["sombre"], position=(0, 0.11, 0.222))
    C.ajouter(boite((0.034, 0.05, 0.05), position=(0, 0.11, 0.2), biseau=0.005), M["sombre"])
    C.ajouter(boite((0.036, 0.03, 0.004), position=(0, 0.11, 0.224)), M["lumiere"])
    C.ajouter(boite((0.036, 0.002, 0.032), position=(0, 0.114, 0.245)), M["verre"])
    # Bloc avant à double canon et bouches lumineuses
    C.ajouter(boite((0.074, 0.19, 0.048), position=(0, 0.655, 0.116), biseau=0.012), M["sombre"])
    C.ajouter(boite((0.07, 0.16, 0.042), position=(0, 0.64, 0.058), biseau=0.012), M["sombre"])
    C.ajouter(boite((0.08, 0.12, 0.02), position=(0, 0.63, 0.146), biseau=0.006), M["coque_grise"])
    for z, y in ((0.116, 0.751), (0.058, 0.721)):
        C.ajouter(cylindre(0.019, 0.006, position=(0, y, z), segments=20), M["sombre"])
        C.ajouter(cylindre(0.012, 0.004, position=(0, y + 0.003, z), segments=18), M["lumiere"])
    for sx in (-1, 1):
        for i in range(3):
            C.ajouter(boite((0.004, 0.03, 0.008), position=(sx * 0.038, 0.6 + i * 0.045, 0.122)), M["lumiere"])
        C.ajouter(boite((0.004, 0.1, 0.03), position=(sx * 0.037, 0.64, 0.058), biseau=0.002), M["coque_grise"])
    # Tube sous le canon, bagues et bande rouge
    C.ajouter(cylindre(0.036, 0.32, position=(0, 0.41, 0.004), segments=24), M["sombre"])
    C.ajouter(revolution([(0.036, 0.0), (0.039, 0.01), (0.039, 0.03), (0.03, 0.04), (0.0, 0.04)], 24, position=(0, 0.57, 0.004)), M["sombre"])
    C.ajouter(cylindre(0.0375, 0.022, position=(0, 0.55, 0.004), segments=24), M["cable"])
    for i in range(4):
        C.ajouter(tore(0.0365, 0.003, position=(0, 0.29 + i * 0.055, 0.004), segments=24, segments_tube=6), M["coque_grise"])
    C.ajouter(boite((0.05, 0.2, 0.03), position=(0, 0.4, 0.032), biseau=0.006), M["coque_grise"])
    # Câbles rouges du flanc vers le tube
    for sx in (-1, 1):
        C.ajouter(tube([(sx * 0.042, 0.13, 0.082), (sx * 0.05, 0.19, 0.047), (sx * 0.042, 0.27, 0.022), (sx * 0.03, 0.33, 0.01)], 0.0065), M["cable"])
    # Poignée pistolet texturée, pontet et détente
    C.ajouter(profil([(0.04, 0.037), (-0.015, 0.037), (-0.05, -0.078), (-0.035, -0.094), (0.0, -0.089), (0.01, -0.058), (0.018, -0.028), (0.025, 0.002)], 0.034, 0.004), M["polymere"])
    for i in range(6):
        C.ajouter(boite((0.036, 0.004, 0.006), position=(0, -0.01 - i * 0.006, -0.012 - i * 0.012), rotation=(math.radians(-18), 0, 0)), M["caoutchouc"])
    garde = profil([(0.0, 0.042), (0.09, 0.042), (0.09, 0.002), (0.0, 0.002)], 0.012, 0.0015)
    soustraire(garde, profil([(0.012, 0.036), (0.08, 0.036), (0.08, 0.01), (0.012, 0.01)], 0.05, 0.0))
    C.ajouter(garde, M["coque_grise"])
    # Crosse squelettique et talon
    crosse = profil(pp([[-0.14, 0.05], [-0.36, 0.062], [-0.38, 0.042], [-0.38, -0.09], [-0.355, -0.102], [-0.3, -0.096], [-0.16, -0.036]]), 0.048, 0.005)
    soustraire(crosse, profil(pp([[-0.335, 0.036], [-0.2, 0.03], [-0.335, -0.066]]), 0.2, 0.0))
    C.ajouter(crosse, M["coque_grise"])
    C.ajouter(boite((0.052, 0.022, 0.156), position=(0, -0.32, 0.062), biseau=0.006), M["caoutchouc"])
    C.ajouter(boite((0.05, 0.2, 0.02), position=(0, -0.19, 0.14), biseau=0.005), M["plaque"])
    # Écran de munitions (le chiffre est dessiné par Godot)
    C.ajouter(boite((0.012, 0.082, 0.058), position=(-0.048, 0.04, 0.155), biseau=0.003), M["sombre"])
    C.ajouter(boite((0.004, 0.072, 0.048), position=(-0.0545, 0.04, 0.155)), M["ecran"])
    # Pièces mobiles
    D = Assemblage("Detente")
    D.ajouter(profil([(0.035, 0.03), (0.042, 0.03), (0.04, 0.008), (0.032, 0.014)], 0.006, 0.001), M["acier"])
    L = Assemblage("Levier")
    L.ajouter(boite((0.016, 0.03, 0.012), position=(0.05, 0.09, 0.134), biseau=0.003), M["sombre"])
    CH = Assemblage("Chargeur")
    CH.ajouter(profil(pp([[0.06, -0.06], [0.16, -0.06], [0.175, -0.2], [0.08, -0.206]]), 0.046, 0.004), M["polymere"])
    CH.ajouter(profil(pp([[0.078, -0.198], [0.178, -0.192], [0.18, -0.214], [0.08, -0.218]]), 0.05, 0.003), M["coque_grise"])
    CH.ajouter(boite((0.048, 0.07, 0.008), position=(0, 0.19, 0.03 - 0.078), rotation=(0.1, 0, 0)), M["lumiere"])
    points = {
        "bouche": (0, 0.76, 0.116), "viseur": (0, 0.11, 0.245), "ejection": (0.045, 0.02, 0.11),
        "ecran": (-0.057, 0.04, 0.155), "chargeur": (0, 0.18, -0.05),
        # Prises : position du poignet, axe main (poignet -> doigts), dos de la main
        "main_d": ((0.012, -0.075, -0.03), (0.0, 0.62, 0.78), (1.0, 0.0, -0.05)),
        "main_g": ((-0.072, 0.25, -0.05), (0.8, 0.45, 0.25), (-0.25, 0.1, -0.95)),
        "doigts_d": "poignee", "doigts_g": "garde",
    }
    return {"carcasse": C, "chargeur": CH, "levier": L, "detente": D}, points


def arme_pistolet(M):
    """Sentinelle : pistolet semi-automatique à culasse mobile."""
    C = Assemblage("Pistolet")
    # Carcasse polymère avec rail sous le canon
    C.ajouter(profil([(-0.03, 0.03), (0.14, 0.03), (0.14, 0.008), (0.06, 0.004), (0.045, -0.012), (0.0, -0.01), (-0.03, 0.0)], 0.03, 0.003), M["polymere"])
    C.ajouter(boite((0.026, 0.05, 0.006), position=(0, 0.105, 0.002), biseau=0.001), M["sombre"])
    garde = profil([(0.0, 0.012), (0.06, 0.012), (0.065, -0.018), (0.0, -0.022)], 0.012, 0.0015)
    soustraire(garde, profil([(0.008, 0.008), (0.052, 0.008), (0.056, -0.012), (0.008, -0.014)], 0.05, 0.0))
    C.ajouter(garde, M["polymere"])
    # Poignée inclinée avec quadrillage
    C.ajouter(profil([(0.0, 0.01), (-0.035, 0.01), (-0.06, -0.095), (-0.05, -0.105), (-0.012, -0.1), (0.002, -0.06)], 0.031, 0.004), M["polymere"])
    for i in range(7):
        for sx in (-1, 1):
            C.ajouter(boite((0.002, 0.026, 0.004), position=(sx * 0.016, -0.025 - i * 0.003, -0.02 - i * 0.011), rotation=(math.radians(-14), 0, 0)), M["caoutchouc"])
    C.ajouter(boite((0.03, 0.012, 0.012), position=(0, -0.03, -0.106), biseau=0.003), M["sombre"])
    # Canon visible à l'avant de la culasse
    C.ajouter(cylindre(0.0075, 0.03, position=(0, 0.16, 0.052), segments=16), M["acier"])
    # Pièces mobiles : culasse (recule au tir) et détente
    CU = Assemblage("Culasse")
    culasse = profil([(-0.035, 0.03), (0.165, 0.03), (0.17, 0.045), (0.165, 0.068), (-0.03, 0.068), (-0.04, 0.055)], 0.03, 0.003)
    rainures = [boite((0.04, 0.003, 0.025), position=(0, -0.025 + i * 0.006, 0.05)) for i in range(6)]
    soustraire(culasse, *rainures, boite((0.012, 0.05, 0.016), position=(0.016, 0.08, 0.058)))
    CU.ajouter(culasse, M["carcasse"])
    CU.ajouter(boite((0.004, 0.006, 0.008), position=(0, 0.155, 0.072)), M["sombre"])
    CU.ajouter(boite((0.006, 0.004, 0.004), position=(0, 0.156, 0.077)), M["accent"])
    for sx in (-1, 1):
        CU.ajouter(boite((0.004, 0.006, 0.008), position=(sx * 0.007, -0.03, 0.072)), M["sombre"])
        CU.ajouter(boite((0.0035, 0.003, 0.003), position=(sx * 0.007, -0.033, 0.077)), M["accent"])
        CU.ajouter(boite((0.002, 0.11, 0.003), position=(sx * 0.0152, 0.08, 0.04)), M["accent"])
    D = Assemblage("Detente")
    D.ajouter(profil([(0.03, 0.006), (0.036, 0.006), (0.034, -0.012), (0.028, -0.008)], 0.006, 0.001), M["acier"])
    CH = Assemblage("Chargeur")
    CH.ajouter(profil([(-0.01, -0.02), (-0.032, -0.02), (-0.056, -0.11), (-0.034, -0.11)], 0.024, 0.002), M["sombre"])
    CH.ajouter(boite((0.028, 0.03, 0.01), position=(0, -0.047, -0.113), biseau=0.002), M["polymere"])
    points = {
        "bouche": (0, 0.175, 0.052), "viseur": (0, -0.03, 0.078), "ejection": (0.016, 0.06, 0.058), "chargeur": (0, -0.035, -0.06),
        "main_d": ((0.004, -0.085, -0.075), (0.0, 0.55, 0.83), (1.0, 0.0, -0.08)),
        "main_g": ((-0.03, -0.075, -0.09), (0.35, 0.6, 0.72), (-0.85, 0.2, -0.3)),
        "doigts_d": "poignee", "doigts_g": "soutien",
    }
    return {"carcasse": C, "culasse": CU, "chargeur": CH, "detente": D}, points


def arme_fusil(M):
    """NS-7 Vecteur : fusil d'assaut, carcasse métal sombre, garde-main ajouré, chargeur courbe."""
    C = Assemblage("Fusil")
    # Carcasse supérieure et inférieure
    sup = profil([(-0.08, 0.04), (0.2, 0.04), (0.2, 0.1), (-0.08, 0.1)], 0.05, 0.004)
    soustraire(sup, boite((0.06, 0.07, 0.02), position=(0.03, 0.04, 0.07)))
    C.ajouter(sup, M["carcasse"])
    C.ajouter(boite((0.008, 0.07, 0.02), position=(0.021, 0.04, 0.07)), M["sombre"])
    C.ajouter(profil([(-0.08, 0.04), (0.17, 0.04), (0.17, 0.0), (0.12, -0.012), (0.04, -0.012), (-0.02, 0.0), (-0.08, 0.0)], 0.046, 0.003), M["claire"])
    # Garde-main ajouré (fentes) et canon
    garde = boite((0.048, 0.28, 0.052), position=(0, 0.34, 0.07), biseau=0.008)
    fentes = []
    for i in range(6):
        for sx in (-1, 1):
            fentes.append(boite((0.02, 0.026, 0.012), position=(sx * 0.024, 0.24 + i * 0.04, 0.07)))
    soustraire(garde, *fentes)
    C.ajouter(garde, M["polymere"])
    C.ajouter(cylindre(0.01, 0.16, position=(0, 0.56, 0.072), segments=16), M["sombre"])
    C.ajouter(cylindre(0.017, 0.06, position=(0, 0.66, 0.072), segments=16, biseau=0.003), M["sombre"])
    for i in range(3):
        C.ajouter(boite((0.04, 0.008, 0.006), position=(0, 0.645 + i * 0.012, 0.072)), M["sombre"])
    # Rail Picatinny
    C.ajouter(boite((0.024, 0.46, 0.008), position=(0, 0.2, 0.104)), M["sombre"])
    for i in range(34):
        C.ajouter(boite((0.026, 0.006, 0.005), position=(0, -0.02 + i * 0.0135, 0.11)), M["sombre"])
    # Viseur point rouge
    C.ajouter(boite((0.03, 0.06, 0.03), position=(0, 0.02, 0.123), biseau=0.006), M["sombre"])
    C.ajouter(cylindre(0.02, 0.05, position=(0, 0.02, 0.152), segments=20, biseau=0.003), M["sombre"])
    C.ajouter(cylindre(0.016, 0.002, position=(0, 0.045, 0.152), segments=20), M["verre"])
    # Poignée, pontet, crosse réglable
    C.ajouter(profil([(0.02, 0.0), (-0.02, 0.0), (-0.05, -0.105), (-0.035, -0.115), (0.0, -0.11), (0.012, -0.06)], 0.032, 0.004), M["polymere"])
    garde_det = profil([(0.0, 0.004), (0.09, 0.004), (0.09, -0.03), (0.0, -0.032)], 0.012, 0.0015)
    soustraire(garde_det, profil([(0.01, 0.0), (0.08, 0.0), (0.08, -0.024), (0.01, -0.026)], 0.05, 0.0))
    C.ajouter(garde_det, M["carcasse"])
    C.ajouter(cylindre(0.015, 0.2, position=(0, -0.17, 0.07), segments=16), M["carcasse"])
    crosse = profil([(-0.16, 0.1), (-0.33, 0.1), (-0.34, 0.08), (-0.34, -0.06), (-0.31, -0.07), (-0.2, 0.0), (-0.16, 0.03)], 0.04, 0.004)
    soustraire(crosse, profil([(-0.31, 0.07), (-0.22, 0.07), (-0.22, 0.03), (-0.3, -0.03)], 0.1, 0.0))
    C.ajouter(crosse, M["polymere"])
    C.ajouter(boite((0.044, 0.02, 0.17), position=(0, -0.345, 0.015), biseau=0.006), M["caoutchouc"])
    C.ajouter(boite((0.004, 0.08, 0.004), position=(0.026, 0.1, 0.085)), M["accent"])
    D = Assemblage("Detente")
    D.ajouter(profil([(0.04, 0.0), (0.046, 0.0), (0.044, -0.02), (0.036, -0.015)], 0.006, 0.001), M["acier"])
    L = Assemblage("Levier")
    L.ajouter(boite((0.03, 0.03, 0.01), position=(0.0, -0.095, 0.09), biseau=0.003), M["sombre"])
    L.ajouter(boite((0.03, 0.012, 0.01), position=(0.0, -0.11, 0.09)), M["sombre"])
    CH = Assemblage("Chargeur")
    pts = []
    for i in range(9):
        t = i / 8
        a = 0.065 + 0.035 * t * t
        pts.append((a + 0.06 * t, -0.012 - 0.18 * t))
    avant = [(p[0] + 0.03, p[1]) for p in pts]
    contour = [(0.06, -0.012)] + [(p[0] - 0.0, p[1]) for p in pts] + list(reversed([(p[0] + 0.038, p[1]) for p in pts]))
    CH.ajouter(profil(contour, 0.028, 0.003), M["sombre"])
    CH.ajouter(boite((0.032, 0.045, 0.012), position=(0, 0.18, -0.195), rotation=(math.radians(-15), 0, 0), biseau=0.003), M["polymere"])
    points = {
        "bouche": (0, 0.69, 0.072), "viseur": (0, 0.02, 0.152), "ejection": (0.03, 0.04, 0.075), "chargeur": (0, 0.1, -0.02),
        "main_d": ((0.006, -0.085, -0.035), (0.0, 0.6, 0.8), (1.0, 0.0, -0.06)),
        "main_g": ((-0.07, 0.25, 0.0), (0.8, 0.45, 0.25), (-0.25, 0.1, -0.95)),
        "doigts_d": "poignee", "doigts_g": "garde",
    }
    return {"carcasse": C, "chargeur": CH, "levier": L, "detente": D}, points


def arme_pompe(M):
    """Briseur : fusil à pompe, tube magasin, gros canon, devant mobile."""
    C = Assemblage("Pompe")
    C.ajouter(profil([(-0.06, 0.03), (0.2, 0.03), (0.22, 0.06), (0.2, 0.1), (-0.06, 0.1), (-0.08, 0.07)], 0.054, 0.005), M["carcasse"])
    C.ajouter(cylindre(0.017, 0.5, position=(0, 0.45, 0.08), segments=20), M["sombre"])
    C.ajouter(cylindre(0.021, 0.04, position=(0, 0.7, 0.08), segments=20, biseau=0.003), M["sombre"])
    C.ajouter(cylindre(0.015, 0.44, position=(0, 0.42, 0.042), segments=18), M["claire"])
    C.ajouter(cylindre(0.017, 0.02, position=(0, 0.645, 0.042), segments=18), M["sombre"])
    C.ajouter(boite((0.02, 0.4, 0.008), position=(0, 0.42, 0.1)), M["sombre"])
    C.ajouter(cylindre(0.004, 0.006, axe="Z", position=(0, 0.69, 0.102), segments=10), M["accent"])
    for sx in (-1, 1):
        C.ajouter(boite((0.004, 0.1, 0.012), position=(sx * 0.028, 0.08, 0.065)), M["accent"])
    C.ajouter(profil([(0.02, 0.03), (-0.02, 0.03), (-0.055, -0.08), (-0.04, -0.09), (-0.005, -0.085), (0.01, -0.03)], 0.034, 0.004), M["polymere"])
    garde = profil([(0.0, 0.034), (0.09, 0.034), (0.09, 0.0), (0.0, -0.002)], 0.012, 0.0015)
    soustraire(garde, profil([(0.01, 0.03), (0.08, 0.03), (0.08, 0.006), (0.01, 0.004)], 0.05, 0.0))
    C.ajouter(garde, M["carcasse"])
    crosse = profil([(-0.06, 0.09), (-0.34, 0.07), (-0.36, 0.05), (-0.36, -0.09), (-0.33, -0.1), (-0.06, 0.02)], 0.044, 0.005)
    C.ajouter(crosse, M["polymere"])
    C.ajouter(boite((0.048, 0.024, 0.16), position=(0, -0.365, -0.015), biseau=0.006), M["caoutchouc"])
    PO = Assemblage("PompeAvant")
    devant = cylindre(0.026, 0.16, position=(0, 0.4, 0.045), segments=20, biseau=0.006)
    PO.ajouter(devant, M["polymere"])
    for i in range(8):
        PO.ajouter(tore(0.0262, 0.0022, position=(0, 0.34 + i * 0.017, 0.045), segments=20, segments_tube=5), M["caoutchouc"])
    D = Assemblage("Detente")
    D.ajouter(profil([(0.04, 0.03), (0.046, 0.03), (0.044, 0.01), (0.036, 0.014)], 0.006, 0.001), M["acier"])
    CH = Assemblage("Cartouche")
    CH.ajouter(cylindre(0.0105, 0.05, position=(0, 0, 0), segments=14), M["cable"])
    CH.ajouter(cylindre(0.011, 0.014, position=(0, -0.025, 0), segments=14), M["laiton"])
    points = {
        "bouche": (0, 0.72, 0.08), "viseur": (0, 0.0, 0.112), "ejection": (0.03, 0.1, 0.07), "chargeur": (0.0, 0.12, 0.02),
        "main_d": ((0.006, -0.08, -0.002), (0.0, 0.62, 0.78), (1.0, 0.0, -0.06)),
        "main_g": ((-0.07, 0.33, -0.025), (0.8, 0.45, 0.25), (-0.25, 0.1, -0.95)),
        "doigts_d": "poignee", "doigts_g": "garde",
    }
    return {"carcasse": C, "pompe": PO, "chargeur": CH, "detente": D}, points


def arme_sniper(M):
    """Aiguille : fusil de précision à verrou, canon cannelé, lunette ×3,6."""
    C = Assemblage("Sniper")
    C.ajouter(profil([(-0.1, 0.03), (0.25, 0.03), (0.25, 0.085), (-0.1, 0.085)], 0.05, 0.004), M["carcasse"])
    canon = cylindre(0.014, 0.62, position=(0, 0.56, 0.06), segments=24)
    C.ajouter(canon, M["sombre"])
    for i in range(6):
        a = i / 6 * 2 * math.pi
        C.ajouter(boite((0.004, 0.4, 0.004), position=(math.cos(a) * 0.0135, 0.5, 0.06 + math.sin(a) * 0.0135), rotation=(0, a, 0)), M["carcasse"])
    C.ajouter(cylindre(0.022, 0.08, position=(0, 0.9, 0.06), segments=20, biseau=0.004), M["sombre"])
    for i in range(4):
        C.ajouter(boite((0.05, 0.01, 0.008), position=(0, 0.875 + i * 0.016, 0.06)), M["sombre"])
    # Fût et bipied replié
    C.ajouter(profil([(0.12, 0.035), (0.48, 0.035), (0.5, 0.0), (0.12, -0.02)], 0.056, 0.006), M["polymere"])
    for sx in (-1, 1):
        C.ajouter(cylindre(0.005, 0.2, position=(sx * 0.018, 0.38, -0.025), segments=10), M["sombre"])
    # Lunette
    C.ajouter(cylindre(0.026, 0.34, position=(0, 0.09, 0.14), segments=28), M["sombre"])
    C.ajouter(cylindre(0.032, 0.09, position=(0, 0.28, 0.14), segments=28, rayon2=0.026, biseau=0.003), M["sombre"])
    C.ajouter(cylindre(0.03, 0.07, position=(0, -0.1, 0.14), segments=28, rayon2=0.026, biseau=0.003), M["sombre"])
    C.ajouter(cylindre(0.029, 0.003, position=(0, 0.325, 0.14), segments=28), M["verre"])
    C.ajouter(cylindre(0.026, 0.003, position=(0, -0.135, 0.14), segments=28), M["verre"])
    C.ajouter(cylindre(0.014, 0.03, axe="Z", position=(0, 0.09, 0.172), segments=16, biseau=0.002), M["sombre"])
    C.ajouter(cylindre(0.014, 0.03, axe="X", position=(0.03, 0.09, 0.14), segments=16, biseau=0.002), M["sombre"])
    for y in (0.0, 0.18):
        C.ajouter(boite((0.03, 0.025, 0.05), position=(0, y, 0.105), biseau=0.003), M["sombre"])
    C.ajouter(boite((0.004, 0.2, 0.004), position=(0.025, 0.09, 0.14)), M["accent"])
    # Poignée et crosse avec trou pour le pouce
    C.ajouter(profil([(0.02, 0.03), (-0.025, 0.03), (-0.055, -0.08), (-0.04, -0.09), (-0.005, -0.085), (0.008, -0.03)], 0.034, 0.004), M["polymere"])
    crosse = profil([(-0.1, 0.085), (-0.42, 0.1), (-0.44, 0.08), (-0.44, -0.08), (-0.41, -0.09), (-0.06, -0.02)], 0.046, 0.005)
    soustraire(crosse, profil([(-0.3, 0.06), (-0.12, 0.05), (-0.13, 0.0), (-0.28, 0.0)], 0.1, 0.0))
    C.ajouter(crosse, M["polymere"])
    C.ajouter(boite((0.05, 0.022, 0.17), position=(0, -0.45, 0.005), biseau=0.006), M["caoutchouc"])
    garde = profil([(0.0, 0.034), (0.09, 0.034), (0.09, 0.0), (0.0, -0.002)], 0.012, 0.0015)
    soustraire(garde, profil([(0.01, 0.03), (0.08, 0.03), (0.08, 0.006), (0.01, 0.004)], 0.05, 0.0))
    C.ajouter(garde, M["carcasse"])
    V = Assemblage("Verrou")
    V.ajouter(cylindre(0.011, 0.12, position=(0, 0.02, 0.075), segments=16), M["acier"])
    V.ajouter(cylindre(0.004, 0.06, axe="X", position=(0.035, -0.02, 0.075), segments=10), M["acier"])
    V.ajouter(sphere(0.011, position=(0.066, -0.02, 0.07)), M["sombre"])
    D = Assemblage("Detente")
    D.ajouter(profil([(0.04, 0.03), (0.046, 0.03), (0.044, 0.01), (0.036, 0.014)], 0.006, 0.001), M["acier"])
    CH = Assemblage("Chargeur")
    CH.ajouter(boite((0.03, 0.07, 0.07), position=(0, 0.13, -0.005), biseau=0.003), M["sombre"])
    points = {
        "bouche": (0, 0.94, 0.06), "viseur": (0, -0.14, 0.14), "ejection": (0.03, 0.05, 0.08), "chargeur": (0, 0.13, 0.0),
        "main_d": ((0.006, -0.08, -0.002), (0.0, 0.62, 0.78), (1.0, 0.0, -0.06)),
        "main_g": ((-0.072, 0.3, -0.04), (0.8, 0.45, 0.25), (-0.25, 0.1, -0.95)),
        "doigts_d": "poignee", "doigts_g": "garde",
    }
    return {"carcasse": C, "verrou": V, "chargeur": CH, "detente": D}, points


def arme_couteau(M):
    """Lame tactique : lame à dos dentelé, garde, manche enroulé."""
    C = Assemblage("Couteau")
    lame = profil([(0.02, 0.012), (0.17, 0.016), (0.215, 0.006), (0.2, -0.004), (0.12, -0.016), (0.02, -0.014)], 0.005, 0.0012)
    dents = [boite((0.02, 0.006, 0.006), position=(0, 0.06 + i * 0.012, 0.016), rotation=(math.radians(45), 0, 0)) for i in range(6)]
    soustraire(lame, *dents)
    C.ajouter(lame, M["lame"])
    C.ajouter(boite((0.0055, 0.13, 0.002), position=(0, 0.11, 0.004)), M["accent"])
    C.ajouter(boite((0.03, 0.012, 0.046), position=(0, 0.014, 0.0), biseau=0.003), M["sombre"])
    C.ajouter(profil([(0.008, 0.012), (-0.1, 0.014), (-0.108, 0.0), (-0.1, -0.016), (0.008, -0.014)], 0.022, 0.006), M["polymere"])
    for i in range(7):
        C.ajouter(tore(0.0145, 0.0018, position=(0, -0.015 - i * 0.012, -0.001), segments=16, segments_tube=5), M["caoutchouc"])
    C.ajouter(cylindre(0.007, 0.012, position=(0, -0.112, 0), segments=12), M["acier"])
    points = {
        "bouche": (0, 0.2, 0.0), "viseur": (0, 0.0, 0.03), "ejection": (0, 0, 0), "chargeur": (0, 0, 0),
        "main_d": ((0.0, -0.11, -0.03), (0.0, 0.85, 0.5), (1.0, 0.0, -0.1)),
        "main_g": None,
        "doigts_d": "poing", "doigts_g": "libre",
    }
    return {"carcasse": C}, points


ARMES = {"pulsar": arme_pulsar, "pistolet": arme_pistolet, "fusil": arme_fusil, "pompe": arme_pompe, "sniper": arme_sniper, "couteau": arme_couteau}

# Position de l'arme au repos dans la vue FPS (camera -> origine de l'arme) et durées des animations
CADRAGE = {
    "pulsar": {"pos": (0.17, 0.34, -0.235), "rot": (0.07, 0.0, 0.06), "sortie": 0.85, "rechargement": 2.2, "rechargement_vide": 2.5, "tir": 0.095},
    "fusil": {"pos": (0.165, 0.34, -0.225), "rot": (0.07, 0.0, 0.06), "sortie": 0.75, "rechargement": 2.1, "rechargement_vide": 2.6, "tir": 0.1},
    "pistolet": {"pos": (0.13, 0.36, -0.185), "rot": (0.03, 0.0, 0.05), "sortie": 0.5, "rechargement": 1.5, "rechargement_vide": 1.8, "tir": 0.15},
    "pompe": {"pos": (0.17, 0.33, -0.24), "rot": (0.07, 0.0, 0.06), "sortie": 0.8, "rechargement": 2.4, "rechargement_vide": 2.8, "tir": 0.9},
    "sniper": {"pos": (0.165, 0.32, -0.235), "rot": (0.07, 0.0, 0.055), "sortie": 0.9, "rechargement": 2.9, "rechargement_vide": 3.3, "tir": 1.35},
    "couteau": {"pos": (0.17, 0.38, -0.22), "rot": (0.15, 0.0, 0.3), "sortie": 0.35, "tir": 0.42, "tir_lourd": 1.0},
}


# ===========================================================================
# Bras FPS : squelette et maillage
# ===========================================================================
# Épaule droite en arrière, épaule gauche avancée (posture de tir) ; bras un peu longs comme dans les FPS
EPAULE = {1: Vector((0.24, -0.18, -0.3)), -1: Vector((-0.16, 0.05, -0.29))}
L_BRAS, L_AVANTBRAS = 0.36, 0.36
# Doigts : (nom, base dans le repère main (x latéral, y long, z dos), longueurs des phalanges, rayon)
DOIGTS = [
    ("index", (0.026, 0.092, 0.0), (0.042, 0.027, 0.021), 0.0098),
    ("majeur", (0.008, 0.096, 0.002), (0.046, 0.029, 0.022), 0.0102),
    ("annulaire", (-0.01, 0.093, 0.0), (0.043, 0.027, 0.021), 0.0098),
    ("auriculaire", (-0.027, 0.084, -0.003), (0.034, 0.021, 0.019), 0.0088),
]
POUCE = ("pouce", (0.032, 0.022, -0.012), (0.04, 0.031, 0.025), 0.0115)


def repere_main(y, z):
    y = Vector(y).normalized()
    z = Vector(z)
    z = (z - y * z.dot(y)).normalized()
    x = y.cross(z)
    return x, y, z


def pose_doigts(type_prise, cote):
    """Angles de flexion (degrés) des phalanges selon la prise."""
    if type_prise == "poignee":
        return {"index": (8, 25, 15), "majeur": (72, 82, 45), "annulaire": (75, 85, 45), "auriculaire": (78, 85, 40), "pouce": (35, 25, 15)}
    if type_prise == "garde":
        return {"index": (50, 62, 35), "majeur": (58, 70, 40), "annulaire": (62, 72, 40), "auriculaire": (65, 72, 38), "pouce": (30, 20, 12)}
    if type_prise == "soutien":
        return {"index": (50, 60, 30), "majeur": (62, 70, 40), "annulaire": (65, 72, 40), "auriculaire": (68, 72, 38), "pouce": (10, 10, 5)}
    if type_prise == "poing":
        return {"index": (80, 90, 50), "majeur": (82, 92, 50), "annulaire": (84, 92, 48), "auriculaire": (86, 90, 45), "pouce": (40, 35, 25)}
    return {"index": (12, 15, 8), "majeur": (16, 18, 10), "annulaire": (20, 20, 10), "auriculaire": (24, 22, 12), "pouce": (10, 8, 5)}


def os_bras():
    """Définition du squelette (pose de repos : bras le long d'une prise de fusil standard)."""
    defs = [("racine", (0, 0, 0), (0, 0.05, 0), None, False), ("arme", (0, 0, 0), (0, 0.05, 0), "racine", False)]
    for nom in ("chargeur", "culasse", "levier", "pompe", "verrou", "detente"):
        defs.append((nom, (0, 0, 0), (0, 0.03, 0), "arme", False))
    for cote, s in ((1, "d"), (-1, "g")):
        e = EPAULE[cote]
        coude = e + Vector((cote * 0.04, 0.22, -0.16)).normalized() * L_BRAS
        poignet = coude + Vector((-cote * 0.06, 0.25, 0.06)).normalized() * L_AVANTBRAS
        defs.append((f"bras_{s}", tuple(e), tuple(coude), "racine", True))
        defs.append((f"avantbras_{s}", tuple(coude), tuple(poignet), f"bras_{s}", True))
        defs.append((f"main_{s}", tuple(poignet), tuple(poignet + Vector((0, 0.08, 0))), f"avantbras_{s}", True))
        for nom, base, longueurs, _r in DOIGTS + [POUCE]:
            parent = f"main_{s}"
            p = poignet + Vector((base[0] * cote, base[1], base[2]))
            for i, l in enumerate(longueurs):
                n = f"{nom}{i + 1}_{s}"
                defs.append((n, tuple(p), tuple(p + Vector((0, l, 0))), parent, True))
                parent = n
                p = p + Vector((0, l, 0))
    return defs


def maillage_bras(arm, MB, cote):
    """Manche, avant-bras renforcé, gant avec doigts articulés. Construit dans la pose de repos du squelette."""
    s = "d" if cote == 1 else "g"
    A = Assemblage(f"Bras_{s}")
    b = arm.data.bones
    e, c = b[f"bras_{s}"].head_local, b[f"bras_{s}"].tail_local
    w = b[f"avantbras_{s}"].tail_local

    def le_long(a, z, ra, rz, mat, seg=20, anneaux=8):
        """Membre effilé de a vers z (rayons ra -> rz), arrondi aux deux bouts."""
        d = (z - a)
        L = d.length
        pts = []
        for i in range(anneaux + 1):
            t = i / anneaux
            r = ra + (rz - ra) * t
            pts.append((r * (1 + 0.04 * math.sin(t * math.pi)), t * L))
        debut = [(ra * math.sin(a), -ra * 0.6 * math.cos(a)) for a in (0.0, 0.5, 0.9, 1.25)]
        fin = [(rz * math.cos(a), L + rz * 0.6 * math.sin(a)) for a in (0.32, 0.7, 1.1, 1.5708)]
        pts = debut + pts[1:-1] + fin
        piece = revolution(pts, 28)
        R = d.to_track_quat("Y", "Z").to_matrix().to_4x4()
        bmesh.ops.transform(piece, matrix=Matrix.Translation(a) @ R, verts=piece.verts)
        A.ajouter(piece, mat)

    # Manche (bras + avant-bras) avec revers au poignet
    le_long(e, c, 0.058, 0.05, MB["manche"])
    le_long(c - (w - c).normalized() * 0.02, w - (w - c).normalized() * 0.05, 0.05, 0.041, MB["manche"])
    d_av = (w - c).normalized()
    revers = revolution([(0.042, 0.0), (0.046, 0.005), (0.046, 0.03), (0.042, 0.035)], 22)
    bmesh.ops.transform(revers, matrix=Matrix.Translation(w - d_av * 0.075) @ d_av.to_track_quat("Y", "Z").to_matrix().to_4x4(), verts=revers.verts)
    A.ajouter(revers, MB["renfort"])
    # Plaque d'avant-bras avec liseré lumineux
    Mav = matrice_visee(c + d_av * 0.14, d_av, Vector((cote * 0.6, 0.0, 1.0)))
    plaque = boite((0.05, 0.12, 0.016), biseau=0.006)
    bmesh.ops.transform(plaque, matrix=Mav @ Matrix.Translation((0, 0, 0.042)), verts=plaque.verts)
    A.ajouter(plaque, MB["renfort"])
    lis = boite((0.004, 0.09, 0.004))
    bmesh.ops.transform(lis, matrix=Mav @ Matrix.Translation((cote * 0.018, 0, 0.051)), verts=lis.verts)
    A.ajouter(lis, MB["accent"])
    # Gant : paume, dos renforcé, poignet
    mh = b[f"main_{s}"].matrix_local
    paume = boite((0.082, 0.098, 0.034), biseau=0.013, segments=3)
    bmesh.ops.transform(paume, matrix=mh @ Matrix.Translation((0, 0.048, 0)), verts=paume.verts)
    A.ajouter(paume, MB["gant"])
    dos = boite((0.07, 0.06, 0.012), biseau=0.005)
    bmesh.ops.transform(dos, matrix=mh @ Matrix.Translation((0, 0.06, 0.019)), verts=dos.verts)
    A.ajouter(dos, MB["renfort"])
    poignet = cylindre(0.036, 0.04, segments=20)
    bmesh.ops.transform(poignet, matrix=mh @ Matrix.Translation((0, 0.004, 0)) @ Matrix.Diagonal((1.1, 1, 0.75, 1)), verts=poignet.verts)
    A.ajouter(poignet, MB["gant"])
    sangle = boite((0.086, 0.014, 0.04), biseau=0.004)
    bmesh.ops.transform(sangle, matrix=mh @ Matrix.Translation((0, 0.012, 0.002)), verts=sangle.verts)
    A.ajouter(sangle, MB["renfort"])
    # Doigts (phalanges arrondies) et protections des jointures
    for nom, base, longueurs, r in DOIGTS + [POUCE]:
        for i, l in enumerate(longueurs):
            bo = b[f"{nom}{i + 1}_{s}"]
            rr = r * (1 - 0.08 * i)
            ph = revolution([(0.0, -rr * 0.7), (rr * 0.75, -rr * 0.45), (rr, -rr * 0.05)] + [(rr, l * 0.5)] + [(rr * 0.97, l), (rr * 0.7, l + rr * 0.5), (0.0, l + rr * 0.75)], 12)
            bmesh.ops.transform(ph, matrix=bo.matrix_local, verts=ph.verts)
            A.ajouter(ph, MB["gant"])
            if i == 0 and nom != "pouce":
                k = boite((rr * 2.1, rr * 1.4, 0.006), biseau=0.002)
                bmesh.ops.transform(k, matrix=bo.matrix_local @ Matrix.Translation((0, 0.006, rr * 0.9)), verts=k.verts)
                A.ajouter(k, MB["renfort"])
    obj = A.construire(angle_lissage=60)
    # Poids : manche fondue au coude, gant rigide par phalange
    segs = [(f"bras_{s}", e, c), (f"avantbras_{s}", c, w), (f"main_{s}", w, w + (mh.to_3x3() @ Vector((0, 0.07, 0))))]
    for nom, base, longueurs, r in DOIGTS + [POUCE]:
        for i in range(len(longueurs)):
            bo = b[f"{nom}{i + 1}_{s}"]
            segs.append((bo.name, bo.head_local, bo.tail_local))
    f = poids_segments(segs, rayon_fondu=0.012, max_os=2)
    peau(obj, arm, f)
    return obj


# ===========================================================================
# Animation de la vue FPS
# ===========================================================================
def lisse(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def courbe(cles, t):
    """Interpolation douce entre des clés [(temps, valeur)] (valeur = nombre ou tuple)."""
    if t <= cles[0][0]:
        return cles[0][1]
    for (t0, v0), (t1, v1) in zip(cles, cles[1:]):
        if t <= t1:
            k = lisse((t - t0) / max(t1 - t0, 1e-6))
            if isinstance(v0, (tuple, list)):
                return tuple(a + (b - a) * k for a, b in zip(v0, v1))
            return v0 + (v1 - v0) * k
    return cles[-1][1]


class Pose:
    """État d'une image : décalage de l'arme (position, rotation), mains, pièces mobiles, doigts."""

    def __init__(self):
        self.pos = (0, 0, 0)          # décalage de l'arme dans le repère caméra
        self.rot = (0, 0, 0)          # rotation additionnelle (tangage X, roulis Y, lacet Z)
        self.main_g = 0.0             # 0 : main gauche sur la garde ; 1 : position "chargeur" ; 2 : poche
        self.main_g_libre = 0.0       # 1 : main gauche baissée hors de l'écran
        self.chargeur = (0, 0, 0)     # décalage du chargeur (repère arme)
        self.chargeur_visible = 1.0
        self.culasse = 0.0            # recul de la culasse / levier / pompe / verrou (mètres)
        self.verrou_rot = 0.0         # rotation du levier de verrou
        self.detente = 0.0            # 0..1
        self.main_d_decal = (0, 0, 0)


def animations_arme(id_arme, cad, points):
    """Renvoie {nom: (durée, fonction t -> Pose, boucle)}."""
    anims = {}
    lourde = id_arme in ("pompe", "sniper")
    dur_sortie = cad["sortie"]

    def sortie(t):
        p = Pose()
        k = lisse(t / dur_sortie)
        p.pos = (0.04 * (1 - k), -0.08 * (1 - k), -0.28 * (1 - k))
        p.rot = (-0.9 * (1 - k), 0.35 * (1 - k), -0.25 * (1 - k))
        if id_arme == "pistolet" and t > dur_sortie * 0.55:
            p.culasse = 0.024 * math.sin(min(1, (t - dur_sortie * 0.55) / (dur_sortie * 0.4)) * math.pi)
        if id_arme in ("fusil", "pulsar") and t > dur_sortie * 0.6:
            p.culasse = 0.05 * math.sin(min(1, (t - dur_sortie * 0.6) / (dur_sortie * 0.35)) * math.pi)
        return p
    anims["sortie"] = (dur_sortie, sortie, False)

    def repos(t):
        p = Pose()
        a = 2 * math.pi * t / 3.0
        p.pos = (0.0015 * math.sin(a), 0.001 * math.sin(2 * a), 0.0025 * math.sin(a + 0.6))
        p.rot = (0.006 * math.sin(a + 1.0), 0.004 * math.sin(a), 0.003 * math.sin(2 * a))
        return p
    anims["repos"] = (3.0, repos, True)

    # Tir : recul court (le ressort de recul procédural s'ajoute dans Godot)
    if id_arme == "couteau":
        def coup(t, lourd=False):
            p = Pose()
            d = cad["tir_lourd" if lourd else "tir"]
            u = t / d
            if lourd:
                p.pos = courbe([(0, (0, 0, 0)), (0.25, (0.02, -0.06, 0.05)), (0.45, (-0.06, 0.2, 0.0)), (0.6, (-0.05, 0.18, -0.01)), (1, (0, 0, 0))], u)
                p.rot = courbe([(0, (0, 0, 0)), (0.25, (0.6, 0, 0.2)), (0.45, (-0.3, 0, -0.1)), (1, (0, 0, 0))], u)
            else:
                p.pos = courbe([(0, (0, 0, 0)), (0.2, (0.06, -0.02, 0.04)), (0.5, (-0.16, 0.1, -0.03)), (0.7, (-0.12, 0.06, -0.05)), (1, (0, 0, 0))], u)
                p.rot = courbe([(0, (0, 0, 0)), (0.2, (0.1, 0.4, 0.5)), (0.5, (-0.1, -0.5, -0.9)), (1, (0, 0, 0))], u)
            return p
        anims["tir"] = (cad["tir"], lambda t: coup(t), False)
        anims["tir_lourd"] = (cad["tir_lourd"], lambda t: coup(t, True), False)
    else:
        def tir(t):
            p = Pose()
            d = min(cad["tir"], 0.16)
            u = t / d
            p.detente = 1.0 if u < 0.5 else max(0.0, 1 - (u - 0.5) * 2)
            if id_arme == "pistolet":
                p.culasse = 0.028 * math.sin(min(1, u * 1.2) * math.pi)
            elif id_arme in ("fusil", "pulsar"):
                p.culasse = 0.0
            if lourde:
                # Réarmement : pompe ou verrou
                total = cad["tir"]
                v = t / total
                if id_arme == "pompe":
                    p.culasse = 0.075 * courbe([(0, 0), (0.28, 0), (0.45, 1), (0.6, 1), (0.75, 0), (1, 0)], v)
                    p.pos = courbe([(0, (0, 0, 0)), (0.3, (0, 0, 0)), (0.5, (0.0, -0.015, -0.005)), (0.8, (0, 0, 0)), (1, (0, 0, 0))], v)
                    p.rot = courbe([(0, (0, 0, 0)), (0.3, (0, 0, 0)), (0.5, (0.04, 0.08, 0)), (0.8, (0, 0, 0)), (1, (0, 0, 0))], v)
                else:
                    p.verrou_rot = courbe([(0, 0), (0.3, 0), (0.42, 1), (0.72, 1), (0.82, 0), (1, 0)], v)
                    p.culasse = 0.07 * courbe([(0, 0), (0.42, 0), (0.55, 1), (0.62, 1), (0.74, 0), (1, 0)], v)
                    p.pos = courbe([(0, (0, 0, 0)), (0.3, (0, 0, 0)), (0.45, (-0.01, -0.01, 0.0)), (0.8, (0, 0, 0)), (1, (0, 0, 0))], v)
                    p.rot = courbe([(0, (0, 0, 0)), (0.3, (0, 0, 0)), (0.45, (0.0, 0.18, 0.05)), (0.8, (0, 0, 0)), (1, (0, 0, 0))], v)
            return p
        anims["tir"] = (cad["tir"] if lourde else max(0.12, min(cad["tir"], 0.16)), tir, False)

        def recharge(t, vide):
            total = cad["rechargement_vide" if vide else "rechargement"]
            u = t / total
            p = Pose()
            if id_arme == "pompe":
                # Cartouches insérées une par une sous l'arme
                p.rot = courbe([(0, (0, 0, 0)), (0.12, (0.12, -0.35, 0.1)), (0.88, (0.12, -0.35, 0.1)), (1, (0, 0, 0))], u)
                p.pos = courbe([(0, (0, 0, 0)), (0.12, (-0.02, 0.0, 0.03)), (0.88, (-0.02, 0.0, 0.03)), (1, (0, 0, 0))], u)
                cycle = (u - 0.15) / 0.7 * 4
                if 0.15 < u < 0.85:
                    f = cycle % 1.0
                    p.main_g = 1.0
                    p.main_g_libre = 0.0
                    p.chargeur_visible = 1.0 if f < 0.7 else 0.0
                    p.chargeur = (0.0, -0.05 * (1 - lisse(f / 0.7)), -0.06 * (1 - lisse(f / 0.7)))
                else:
                    p.chargeur_visible = 0.0
                if vide:
                    p.culasse = 0.075 * courbe([(0, 0), (0.88, 0), (0.93, 1), (0.98, 0), (1, 0)], u)
                return p
            # Inclinaison de l'arme, main gauche vers le chargeur, chargeur retiré puis remis
            p.rot = courbe([(0, (0, 0, 0)), (0.15, (0.1, -0.5, 0.22)), (0.8, (0.08, -0.45, 0.2)), (1, (0, 0, 0))], u)
            p.pos = courbe([(0, (0, 0, 0)), (0.15, (-0.03, 0.02, 0.035)), (0.8, (-0.025, 0.02, 0.03)), (1, (0, 0, 0))], u)
            p.main_g = courbe([(0, 0), (0.14, 1), (0.3, 2), (0.42, 2), (0.6, 1), (0.72, 1), (0.86, 0), (1, 0)], u)
            sortie_ch = courbe([(0, 0), (0.18, 0), (0.3, 1)], u)
            retour = courbe([(0, 0), (0.42, 0), (0.6, 1), (0.66, 1)], u)
            p.chargeur = (0.0, 0.0, -0.18 * sortie_ch * (1 - retour) - 0.01 * (1 - retour) * (1 if u > 0.3 else 0))
            p.chargeur_visible = 0.0 if 0.34 < u < 0.42 else 1.0
            if vide:
                # Levier d'armement / culasse à la fin
                p.culasse = (0.05 if id_arme != "pistolet" else 0.025) * courbe([(0, 0), (0.74, 0), (0.8, 1), (0.84, 1), (0.88, 0), (1, 0)], u)
            if id_arme == "sniper":
                p.verrou_rot = courbe([(0, 0), (0.08, 1), (0.92, 1), (1, 0)], u) if vide else 0.0
            return p
        anims["rechargement"] = (cad["rechargement"], lambda t: recharge(t, False), False)
        anims["rechargement_vide"] = (cad["rechargement_vide"], lambda t: recharge(t, True), False)

    def inspection(t):
        total = 3.6
        u = t / total
        p = Pose()
        p.rot = courbe([(0, (0, 0, 0)), (0.15, (0.15, -0.9, 0.5)), (0.45, (0.25, -1.0, 0.65)), (0.6, (-0.1, 0.4, -0.3)), (0.85, (-0.05, 0.35, -0.25)), (1, (0, 0, 0))], u)
        p.pos = courbe([(0, (0, 0, 0)), (0.15, (-0.08, 0.04, 0.06)), (0.45, (-0.09, 0.03, 0.07)), (0.6, (-0.02, 0.0, 0.04)), (0.85, (-0.02, 0.0, 0.035)), (1, (0, 0, 0))], u)
        if id_arme == "couteau":
            p.rot = courbe([(0, (0, 0, 0)), (0.2, (0.2, 0, 1.4)), (0.4, (0.1, 3.14, 1.2)), (0.6, (0.2, 6.28, 1.3)), (0.8, (0, 6.28, 0.3)), (1, (0, 6.28, 0))], u)
            p.pos = courbe([(0, (0, 0, 0)), (0.2, (-0.06, 0.02, 0.06)), (0.8, (-0.06, 0.02, 0.06)), (1, (0, 0, 0))], u)
        else:
            p.main_g_libre = courbe([(0, 0), (0.12, 1), (0.88, 1), (1, 0)], u)
        return p
    anims["inspection"] = (3.6, inspection, False)
    return anims


def construire_vue(id_arme):
    nouvelle_scene()
    M = materiaux()
    MB = materiaux_bras()
    pieces, points = ARMES[id_arme](M)
    cad = CADRAGE[id_arme]
    arm = armature("BrasFPS", os_bras())
    # Pièces de l'arme : objets rigides attachés aux os (la carcasse à "arme", les pièces mobiles à leurs os)
    M_arme = Matrix.Translation(cad["pos"]) @ Euler(cad["rot"], "XYZ").to_matrix().to_4x4()
    regler_os(arm, {n: M_arme for n in ("arme", "chargeur", "culasse", "levier", "pompe", "verrou", "detente")})
    objets = {}
    for nom, A in pieces.items():
        o = A.construire()
        o.matrix_world = M_arme
        objets[nom] = o
    # Repères utiles exportés (bouche, viseur, éjection, écran) : objets vides attachés à l'os de l'arme
    reperes = {}
    for nom in ("bouche", "viseur", "ejection", "ecran"):
        if nom in points:
            v = bpy.data.objects.new("Repere_" + nom, None)
            v.empty_display_size = 0.01
            lier(v)
            v.matrix_world = M_arme @ Matrix.Translation(points[nom])
            reperes[nom] = v
    bpy.context.view_layer.update()
    # Rattachement : carcasse et repères à "arme", pièces mobiles à leurs os
    rattache = {"carcasse": "arme", "chargeur": "chargeur", "culasse": "culasse", "levier": "levier", "pompe": "pompe", "verrou": "verrou", "detente": "detente"}
    # Les os des pièces sont à l'origine en repos : on les place au repos de l'arme via la pose (voir appliquer_pose)
    for nom, o in objets.items():
        parenter_os(o, arm, rattache[nom])
    for v in reperes.values():
        parenter_os(v, arm, "arme")
    # Bras
    for cote in (1, -1):
        maillage_bras(arm, MB, cote)

    anims = animations_arme(id_arme, cad, points)
    # Les os "arme" et pièces mobiles ont un repos à l'origine : la pose les place sur l'arme.
    repos_arme = arm.data.bones["arme"].matrix_local.copy()
    for nom, (duree, fn, boucle) in anims.items():
        action = nouvelle_action(arm, nom)
        n = max(2, int(round(duree * FPS)))
        for i in range(n + 1):
            t = min(duree, i / FPS)
            if boucle and i == n:
                t = 0.0
            pose = fn(t)
            appliquer_pose(arm, pose, M_arme, repos_arme, points, id_arme)
            cle(arm, [pb.name for pb in arm.pose.bones], i + 1)
        finir_action(arm, action, nom, "LINEAR")
    # Pose de repos neutre pour l'export
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    os.makedirs(SORTIE, exist_ok=True)
    exporter_glb(os.path.join(SORTIE, f"vm_{id_arme}.glb"))


def appliquer_pose(arm, pose, M_arme, repos_arme, points, id_arme):
    """Place tous les os pour une image : arme, pièces mobiles, mains (IK) et doigts."""
    Moff = Matrix.Translation(pose.pos) @ Euler(pose.rot, "XYZ").to_matrix().to_4x4()
    # La rotation de l'arme se fait autour de sa poignée (origine de l'arme)
    Ma = Matrix.Translation(M_arme.translation) @ Moff @ Matrix.Translation(-M_arme.translation) @ M_arme
    poser(arm, "arme", Ma)
    poser(arm, "detente", Ma @ Matrix.Translation((0, -0.004 * pose.detente, 0)))
    poser(arm, "culasse", Ma @ Matrix.Translation((0, -pose.culasse, 0)))
    poser(arm, "levier", Ma @ Matrix.Translation((0, -pose.culasse, 0)))
    poser(arm, "pompe", Ma @ Matrix.Translation((0, -pose.culasse, 0)))
    piv = Vector(points.get("ejection", (0, 0, 0)))
    Mv = Matrix.Translation((0, -pose.culasse, 0)) @ Matrix.Translation((0, 0, 0.075)) @ Matrix.Rotation(-1.4 * pose.verrou_rot, 4, "Y") @ Matrix.Translation((0, 0, -0.075))
    poser(arm, "verrou", Ma @ Mv)
    e = max(pose.chargeur_visible, 0.0001)
    poser(arm, "chargeur", Ma @ Matrix.Translation(pose.chargeur) @ Matrix.Diagonal((e, e, e, 1)))
    # Main droite : poignée
    if points["main_d"] is not None:
        p, y, z = points["main_d"]
        x, y, z = repere_main(y, z)
        Mm = Matrix((x, y, z)).transposed().to_4x4()
        Mm.translation = Vector(p) + Vector(pose.main_d_decal)
        placer_bras(arm, "d", Ma @ Mm)
    # Main gauche : garde, chargeur ou poche, ou baissée
    if points["main_g"] is not None:
        p, y, z = points["main_g"]
        x, y, z = repere_main(y, z)
        M_garde = Ma @ Matrix((x, y, z)).transposed().to_4x4()
        M_garde.translation = Ma @ Vector(p)
        ch = Ma @ (Vector(points["chargeur"]) + Vector(pose.chargeur) + Vector((-0.045, -0.06, -0.06)))
        M_ch = matrice_visee(ch, Ma.to_3x3() @ Vector((0.2, 0.6, 0.75)), Ma.to_3x3() @ Vector((-1.0, 0.0, 0.1)))
        M_poche = matrice_visee(Vector((-0.25, 0.05, -0.62)), Vector((0.3, 0.6, 0.6)), Vector((-1, 0, 0)))
        cible = interp_matrice(M_garde, M_ch, min(1.0, pose.main_g))
        if pose.main_g > 1.0:
            cible = interp_matrice(M_ch, M_poche, pose.main_g - 1.0)
        if pose.main_g_libre > 0:
            cible = interp_matrice(cible, M_poche, pose.main_g_libre)
        placer_bras(arm, "g", cible)
    else:
        placer_bras(arm, "g", matrice_visee(Vector((-0.3, 0.02, -0.7)), Vector((0.2, 0.5, 0.8)), Vector((-1, 0, 0))))
    # Doigts selon la prise (détente : l'index se replie)
    prise_d = pose_doigts(points["doigts_d"], 1)
    flex = dict(prise_d)
    if points["doigts_d"] == "poignee":
        i1, i2, i3 = flex["index"]
        flex["index"] = (i1 + 22 * pose.detente, i2 + 28 * pose.detente, i3 + 10 * pose.detente)
    plier_doigts(arm, "d", flex)
    prise_g = pose_doigts(points["doigts_g"] if pose.main_g < 0.5 and pose.main_g_libre < 0.5 else ("poing" if pose.main_g >= 0.5 else "libre"), -1)
    plier_doigts(arm, "g", prise_g)


def interp_matrice(A, B, k):
    k = lisse(k)
    la, ra, _ = A.decompose()
    lb, rb, _ = B.decompose()
    l = la.lerp(lb, k)
    r = ra.slerp(rb, k)
    M = r.to_matrix().to_4x4()
    M.translation = l
    return M


def placer_bras(arm, s, M_main):
    """IK : place l'épaule, le coude et le poignet pour que la main atteigne M_main (espace armature)."""
    cote = 1 if s == "d" else -1
    epaule = arm.data.bones[f"bras_{s}"].head_local
    poignet = M_main.translation
    pole = epaule + Vector((cote * 0.5, 0.0, -0.55))
    coude, bout = ik_deux_os(epaule, L_BRAS, L_AVANTBRAS, poignet, pole)
    haut = Vector((cote * 0.3, 0.0, 1.0))
    poser(arm, f"bras_{s}", matrice_visee(epaule, coude - epaule, haut))
    dos_main = M_main.to_3x3() @ Vector((0, 0, 1))
    poser(arm, f"avantbras_{s}", matrice_visee(coude, bout - coude, dos_main))
    Mh = M_main.copy()
    Mh.translation = bout
    poser(arm, f"main_{s}", Mh)


def plier_doigts(arm, s, flex):
    """Fléchit chaque phalange (rotation autour de l'axe X local, vers la paume)."""
    for nom, base, longueurs, _r in DOIGTS + [POUCE]:
        angles = flex.get(nom, (0, 0, 0))
        parent_M = arm.pose.bones[f"main_{s}"].matrix
        for i in range(len(longueurs)):
            bo = arm.data.bones[f"{nom}{i + 1}_{s}"]
            pb = arm.pose.bones[bo.name]
            # repos relatif au parent, puis flexion
            parent_rest = bo.parent.matrix_local
            rel = parent_rest.inverted() @ bo.matrix_local
            ax = "X"
            ang = -math.radians(angles[i])
            if nom == "pouce":
                rot = Matrix.Rotation(ang * 0.8, 4, "X") @ Matrix.Rotation((0.6 if s == "d" else -0.6) * (1 if i == 0 else 0.0), 4, "Z")
            else:
                rot = Matrix.Rotation(ang, 4, ax)
            M = parent_M @ rel @ rot
            pb.matrix = M
            bpy.context.view_layer.update()
            parent_M = pb.matrix.copy()


def construire_arme_seule(id_arme):
    """Arme seule (pour les personnages et la vitrine), origine à la poignée, repères inclus."""
    nouvelle_scene()
    M = materiaux()
    pieces, points = ARMES[id_arme](M)
    objs = []
    for nom, A in pieces.items():
        o = A.construire()
        if nom == "chargeur" and id_arme == "pompe":
            o.hide_render = True
            bpy.data.objects.remove(o, do_unlink=True)
            continue
        objs.append(o)
    for nom in ("bouche", "viseur", "main_g"):
        if nom in points and points[nom] is not None:
            v = bpy.data.objects.new("Repere_" + nom, None)
            lier(v)
            p = points[nom][0] if nom == "main_g" else points[nom]
            v.location = p
            objs.append(v)
    exporter_glb(os.path.join(SORTIE, f"arme_{id_arme}.glb"), animations=False)


if __name__ == "__main__":
    ids = [a for a in sys.argv[1:] if a in ARMES] or list(ARMES)
    for i in ids:
        construire_arme_seule(i)
        construire_vue(i)
        print("ARME OK", i)
