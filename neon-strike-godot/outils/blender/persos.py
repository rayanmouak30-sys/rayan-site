"""Les 20 personnages de Neon Strike, modélisés de façon procédurale à partir de assets/donnees/heros.json.

Usage : venv/bin/python persos.py [id ...]     (sans argument : tous)
Produit assets/persos/<id>.glb : un maillage unique skinné sur le squelette commun (voir persos_base.py),
avec des matériaux nommés que Godot recolore selon le skin et l'équipe :
  Armure, Secondaire, Tissu, TissuClair, Accent, Equipe, Lentille (recolorés) ;
  Peau, Cheveux, Yeux, Blanc, Gant, Cuir, Caoutchouc, Metal, Sombre (propres au personnage).
Chaque personnage combine un corps (standard / fin / massif, homme / femme), un visage sculpté, une coiffure,
une tenue (buste), des épaulières, un équipement dorsal, un bas et des accessoires tous différents.
"""
import json
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from modelage import (  # noqa: E402
    nouvelle_scene, materiau, hexa, boite, cylindre, sphere, tore, revolution, tube, exporter_glb,
)
from persos_base import (  # noqa: E402
    creer_squelette, regler_os_armes, Modele, loft, membre, coque, bande, section, point_section,
    profil_torse, sections_torse, interp_torse, rayons_membres, transformer, _bras,
)

PROJET = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SORTIE = os.path.join(PROJET, "assets", "persos")
HEROS = json.load(open(os.path.join(PROJET, "assets", "donnees", "heros.json"), encoding="utf-8"))["heros"]

TETE_C = Vector((0, 0.02, 1.645))   # centre de la tête (repère armature)


def melanger(c1, c2, k):
    return tuple(a + (b - a) * k for a, b in zip(c1, c2))


# ===========================================================================
# Matériaux du personnage
# ===========================================================================
def materiaux(h):
    a = h["apparence"]
    c = a["couleurs"]
    tissu = hexa(c["tissu"])
    yeux = hexa(a["yeux"])
    lum = a.get("yeuxLumineux", False)
    return {
        "peau": materiau("Peau", hexa(a["peau"]), 0.0, 0.55),
        "levres": materiau("Levres", melanger(hexa(a["peau"]), (0.35, 0.12, 0.1), 0.25), 0.0, 0.45),
        "cheveux": materiau("Cheveux", hexa(a["cheveux"]), 0.0, 0.6),
        "barbe": materiau("Barbe", melanger(hexa(a["cheveux"]), hexa(a["peau"]), 0.4 if a.get("barbe") != "pleine" else 0.2), 0.0, 0.8),
        "yeux": materiau("Yeux", yeux, 0.0, 0.2, emission=yeux if lum else None, force_emission=4.0 if lum else 1.0),
        "blanc": materiau("Blanc", (0.85, 0.83, 0.8), 0.0, 0.25),
        "pupille": materiau("Pupille", (0.01, 0.01, 0.012), 0.0, 0.1),
        "armure": materiau("Armure", hexa(c["armure"]), 0.35, 0.42),
        "secondaire": materiau("Secondaire", hexa(c["secondaire"]), 0.25, 0.45),
        "tissu": materiau("Tissu", tissu, 0.0, 0.85),
        "tissu_clair": materiau("TissuClair", melanger(tissu, (0.6, 0.62, 0.66), 0.35), 0.0, 0.85),
        "accent": materiau("Accent", hexa(c["accent"]), 0.0, 0.4, emission=hexa(c["accent"]), force_emission=3.0),
        "equipe": materiau("Equipe", hexa("#4fd2ff"), 0.0, 0.4, emission=hexa("#4fd2ff"), force_emission=3.0),
        "lentille": materiau("Lentille", hexa(c["accent"]), 0.1, 0.1, emission=hexa(c["accent"]), force_emission=2.0),
        "gant": materiau("Gant", hexa("#24262c"), 0.0, 0.7),
        "cuir": materiau("Cuir", hexa("#3a2a20"), 0.0, 0.6),
        "caoutchouc": materiau("Caoutchouc", hexa("#141518"), 0.0, 0.9),
        "metal": materiau("Metal", hexa("#6b7280"), 0.9, 0.32),
        "sombre": materiau("Sombre", hexa("#0c0d10"), 0.2, 0.6),
    }


# ===========================================================================
# Tête et visage
# ===========================================================================
def _g(x, s):
    return math.exp(-(x / s) ** 2)


def _lisse(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def forme_tete(u, sil, machoire=True, visage=True):
    """Point d'une sphère unité u (x droite, y avant, z haut) -> point du crâne/visage (mètres, centre de la tête)."""
    x, y, z = u
    f = sil == "f"
    a, b, c = (0.073, 0.095, 0.114) if f else (0.077, 0.099, 0.118)
    X, Y, Z = a * x, b * y, c * z
    if machoire and z < 0:
        t = -z
        X *= 1 - (0.36 if f else 0.27) * t ** 1.5
        if y < 0:
            Y *= 1 - 0.42 * t ** 1.3
        else:
            Y *= 1 - 0.06 * t
    if y < 0 and z > -0.2:
        Y *= 1.05
    X *= 1 - 0.07 * max(0.0, z) * abs(y)
    if not visage:
        return Vector((X, Y, Z))
    av = _lisse(0.25, 0.75, y)
    if av > 0:
        d = 0.0
        # Orbites, arcades, pommettes
        for s in (1, -1):
            d -= 0.0085 * math.exp(-((X - s * 0.031) / 0.0165) ** 2 - ((Z - 0.012) / 0.0115) ** 2)
            d += (0.0035 if f else 0.005) * math.exp(-((X - s * 0.03) / 0.022) ** 2 - ((Z - 0.033) / 0.0085) ** 2)
            d += 0.0055 * math.exp(-((X - s * 0.044) / 0.016) ** 2 - ((Z + 0.012) / 0.014) ** 2)
        # Nez : arête, pointe, ailes
        k = 0.95 if f else 1.2
        prof = [(0.03, 0.0), (0.018, 0.006), (0.0, 0.012), (-0.02, 0.02), (-0.03, 0.022), (-0.038, 0.013), (-0.046, 0.002)]
        larg = [(0.03, 0.007), (0.0, 0.0085), (-0.025, 0.012), (-0.038, 0.016), (-0.046, 0.012)]
        n = _interp(prof, Z) * k
        w = _interp(larg, Z) * (0.9 if f else 1.0)
        if w > 1e-4 and n > 0:
            d += n * math.exp(-(X / w) ** 2)
        # Lèvres et bouche
        d += (0.0055 if f else 0.0042) * _g(Z + 0.056, 0.0055) * _g(X, 0.021)
        d += (0.0065 if f else 0.005) * _g(Z + 0.07, 0.0065) * _g(X, 0.019)
        d -= 0.003 * _g(Z + 0.0625, 0.0022) * _g(X, 0.02)
        # Menton
        d += (0.006 if f else 0.009) * _g(X, 0.02 if f else 0.026) * _g(Z + 0.094, 0.013)
        Y += d * av
    return Vector((X, Y, Z))


def _interp(pts, z):
    if z >= pts[0][0]:
        return pts[0][1] if z - pts[0][0] < 0.01 else 0.0
    for (z0, v0), (z1, v1) in zip(pts, pts[1:]):
        if z1 <= z <= z0:
            t = (z - z0) / (z1 - z0)
            return v0 + (v1 - v0) * t
    return 0.0


def sphere_deformee(fonction, segu=56, segv=36, rayon_sup=0.0):
    """Sphère UV dont chaque sommet passe par fonction(u) ; renvoie (bmesh, liste (sommet, u))."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segu, v_segments=segv, radius=1.0)
    for v in bm.verts:
        u = v.co.normalized()
        v.co = fonction(u)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def surface_visage(sil, X, Z):
    """Profondeur (Y) de la surface du visage aux coordonnées X, Z (recherche sur la sphère)."""
    meilleur, best = None, 1e9
    for i in range(60):
        for j in range(40):
            th = -math.pi / 2 + math.pi * j / 39
            ph = math.pi * i / 59
            u = Vector((math.cos(th) * math.cos(ph), math.cos(th) * math.sin(ph), math.sin(th)))
            p = forme_tete(u, sil)
            if p.y <= 0:
                continue
            e = (p.x - X) ** 2 + (p.z - Z) ** 2
            if e < best:
                best, meilleur = e, p
    return meilleur.y


def ajouter_tete(Mo, h, M):
    a = h["apparence"]
    sil = a["silhouette"]
    T = Matrix.Translation(TETE_C)
    # Crâne et visage
    if a.get("tete") != "casque":
        tete = sphere_deformee(lambda u: forme_tete(u, sil))
        Mo.ajouter(transformer(tete, T), M["peau"], "tete")
        # Lèvres (légère couleur)
        for z0, w, e in ((-0.056, 0.019, 0.0035), (-0.07, 0.017, 0.004)):
            yl = surface_visage(sil, 0.0, z0)
            l = sphere(1.0, segments=20, anneaux=10)
            transformer(l, Matrix.Translation(TETE_C + Vector((0, yl - 0.0035, z0))) @ Matrix.Diagonal((w, 0.0055, e, 1)))
            Mo.ajouter(l, M["levres"], "tete")
        # Yeux
        for s in (1, -1):
            X, Z = s * 0.031, 0.012
            ys = surface_visage(sil, X, Z)
            ce = TETE_C + Vector((X, ys - 0.0105, Z))
            Mo.ajouter(sphere(0.0118, ce, segments=18, anneaux=12), M["blanc"], "tete")
            iris = cylindre(0.0056, 0.0012, axe="Y", position=ce + Vector((0, 0.0112, 0)), segments=18)
            Mo.ajouter(iris, M["yeux"], "tete")
            Mo.ajouter(cylindre(0.0024, 0.0012, axe="Y", position=ce + Vector((0, 0.0119, 0)), segments=12), M["pupille"], "tete")
            # Paupières : anneau en amande
            p = tore(0.0118, 0.0026, axe="Y", position=(0, 0, 0), segments=22, segments_tube=8)
            transformer(p, Matrix.Translation(ce + Vector((0, 0.0045, 0.0005))) @ Matrix.Diagonal((1.08, 1.0, 0.72, 1)))
            Mo.ajouter(p, M["peau"], "tete")
            # Sourcils
            pts = []
            for k in range(5):
                xx = s * (0.013 + 0.036 * k / 4)
                zz = 0.03 + 0.006 * math.sin(math.pi * (k / 4) * 0.9) - (0.002 if k == 4 else 0)
                pts.append(TETE_C + Vector((xx, surface_visage(sil, xx, zz) + 0.0018, zz)))
            ep = 0.0028 if sil == "h" else 0.0019
            Mo.ajouter(membre(pts, [ep, ep * 1.25, ep * 1.2, ep, ep * 0.6], haut=(0, 1, 0), seg=8, aplat=0.45), M["cheveux"], "tete")
            # Oreilles
            if a.get("tete") not in ("casque", "capuche", "casqueVisiere") and a.get("accessoire") != "casqueAudio":
                o = sphere(1.0, segments=14, anneaux=10)
                transformer(o, Matrix.Translation(TETE_C + Vector((s * 0.07, -0.006, -0.002))) @ Matrix.Rotation(s * 0.25, 4, "Z") @ Matrix.Diagonal((0.009, 0.019, 0.029, 1)))
                Mo.ajouter(o, M["peau"], "tete")
                o2 = tore(0.013, 0.0035, axe="X", segments=14, segments_tube=6)
                transformer(o2, Matrix.Translation(TETE_C + Vector((s * 0.076, -0.006, -0.002))) @ Matrix.Rotation(s * 0.25, 4, "Z") @ Matrix.Diagonal((1, 0.75, 1.15, 1)))
                Mo.ajouter(o2, M["peau"], "tete")
        if a.get("cicatrice"):
            pts = [TETE_C + Vector((0.042, surface_visage(sil, 0.042, z) + 0.0012, z)) for z in (0.045, 0.025, 0.0, -0.025)]
            Mo.ajouter(membre(pts, [0.0014, 0.002, 0.002, 0.0012], haut=(0, 1, 0), seg=6, aplat=0.5), M["levres"], "tete")
    # Cou
    r = rayons_membres(a["corps"], sil)["cou"]
    Mo.ajouter(membre([(0, -0.004, 1.46), (0, 0.006, 1.51), (0, 0.016, 1.565)], [r * 1.12, r, r * 0.95], haut=(0, 1, 0), seg=20, aplat=1.05),
               M["peau"], ["torse", "cou", "tete"])


# ---------------------------------------------------------------------------
# Coiffures
# ---------------------------------------------------------------------------
def limite_cheveux(u, style):
    """Ligne d'implantation (z sur la sphère unité) selon la direction horizontale."""
    x, y, z = u
    av = max(0.0, y)
    ar = max(0.0, -y)
    lim = 0.4 * av ** 1.5 - 0.05 * (1 - abs(y)) - 0.5 * ar ** 1.2
    if style in ("carre", "longue"):
        lim = 0.4 * av ** 1.5 - 0.55 * (1 - av) ** 1.5
    return lim


def ajouter_coiffure(Mo, h, M):
    a = h["apparence"]
    sil = a["silhouette"]
    style = a.get("coiffure")
    if a.get("tete") in ("casque", "capuche", "casqueVisiere") or not style:
        return
    T = Matrix.Translation(TETE_C)
    rnd = random.Random(hash(h["id"]) & 0xffff)
    epais = {"courte": 0.011, "rasee": 0.0022, "queue": 0.008, "carre": 0.014, "tresses": 0.007, "meche": 0.011,
             "longue": 0.012, "boucles": 0.012, "chignon": 0.007, "pics": 0.009, "crete": 0.0025}.get(style, 0.01)

    def forme(u):
        lim = limite_cheveux(u, style)
        z = u.z
        k = _lisse(lim - 0.02, lim + 0.12, z)
        base = forme_tete(u, sil, machoire=style not in ("carre", "longue"), visage=False)
        n = base.normalized()
        ep = epais
        # Sillons des mèches : ondulation selon l'angle autour de l'axe avant-arrière
        meches = 1.0 + 0.32 * math.sin(math.atan2(u.x, u.z + 0.35) * 26 + u.y * 3.0) * _lisse(-0.6, 0.2, u.z)
        if style not in ("rasee", "crete"):
            ep *= meches
        if style == "courte":
            ep *= 1.0 + 0.5 * max(0.0, z) + 0.25 * math.sin(u.x * 23 + u.y * 17) * math.sin(u.z * 19)
        elif style in ("carre", "longue"):
            ep *= 1.0 + 0.7 * max(0.0, -z) + 0.3 * max(0.0, z)
        elif style == "crete":
            ep = 0.0022
        if k <= 0.001:
            return forme_tete(u, sil) * 0.97
        return base + n * (ep * k - 0.003 * (1 - k))
    calotte = sphere_deformee(forme, 40, 28)
    Mo.ajouter(transformer(calotte, T), M["cheveux"], "tete")
    C = TETE_C
    if style == "queue":
        pts = [C + Vector((0, -0.075, 0.07)), C + Vector((0, -0.115, 0.05)), C + Vector((0, -0.14, -0.02)), C + Vector((0, -0.13, -0.11)), C + Vector((0.005, -0.11, -0.2))]
        Mo.ajouter(membre(pts, [0.022, 0.026, 0.024, 0.017, 0.006], haut=(1, 0, 0), seg=14, aplat=0.8), M["cheveux"], ["tete", "cou"])
        anneau = tore(0.02, 0.005, axe="Y", segments=14)
        transformer(anneau, Matrix.Translation(C + Vector((0, -0.105, 0.058))) @ Matrix.Rotation(0.6, 4, "X"))
        Mo.ajouter(anneau, M["accent"], "tete")
    elif style == "carre":
        # Frange
        pts = [C + Vector((x, surface_visage(sil, x, 0.06) + 0.012, 0.062 - abs(x) * 0.3)) for x in (-0.05, -0.025, 0.0, 0.025, 0.05)]
        Mo.ajouter(membre(pts, [0.008, 0.011, 0.012, 0.011, 0.008], haut=(0, 1, 0), seg=10, aplat=0.6), M["cheveux"], "tete")
    elif style == "tresses":
        for i, ang in enumerate((-0.9, -0.45, 0.0, 0.45, 0.9)):
            dx = math.sin(ang) * 0.06
            pts = [C + Vector((dx, -0.08 + abs(dx) * 0.2, 0.0)), C + Vector((dx * 1.2, -0.095, -0.08)), C + Vector((dx * 1.3, -0.1, -0.17)), C + Vector((dx * 1.3, -0.105, -0.27))]
            ray = []
            n = 4
            Mo.ajouter(membre(pts, [0.012, 0.011, 0.01, 0.007], haut=(0, -1, 0), seg=10), M["cheveux"], ["tete", "cou", "torse"])
            for k in range(6):
                t = k / 5
                q = pts[1].lerp(pts[3], t)
                Mo.ajouter(sphere(0.0105 - t * 0.003, q, segments=8, anneaux=6), M["cheveux"], ["tete", "cou", "torse"])
            Mo.ajouter(cylindre(0.008, 0.012, axe="Z", position=pts[3] + Vector((0, 0, -0.01)), segments=10), M["accent"], ["cou", "torse"])
    elif style == "meche":
        pts = [C + Vector((0.0, 0.03, 0.115)), C + Vector((0.025, 0.085, 0.09)), C + Vector((0.045, 0.1, 0.05)), C + Vector((0.058, 0.09, 0.02))]
        Mo.ajouter(membre(pts, [0.018, 0.016, 0.012, 0.005], haut=(0, 0, 1), seg=12, aplat=0.55), M["cheveux"], "tete")
    elif style == "longue":
        # Rideau de cheveux dans le dos jusqu'aux omoplates
        secs = []
        for i, z in enumerate((0.04, -0.03, -0.1, -0.18, -0.26, -0.33)):
            t = i / 5
            secs.append(section(C + Vector((0, -0.075 - 0.025 * t, z)), 0.07 + 0.012 * t, 0.012, ry2=0.028, p=2.4))
        Mo.ajouter(loft(secs, 24), M["cheveux"], ["tete", "cou", "torse"])
        # Mèches devant les épaules (femmes) ou attachées (hommes)
        if sil == "f":
            for s in (1, -1):
                pts = [C + Vector((s * 0.065, 0.0, -0.02)), C + Vector((s * 0.075, 0.01, -0.11)), C + Vector((s * 0.085, 0.03, -0.2))]
                Mo.ajouter(membre(pts, [0.016, 0.02, 0.01], haut=(s, 0, 0), seg=10, aplat=0.5), M["cheveux"], ["tete", "cou", "torse"])
        pts = [C + Vector((x, surface_visage(sil, x, 0.07) + 0.01, 0.075 - abs(x) * 0.5)) for x in (-0.055, -0.03, -0.01)]
        Mo.ajouter(membre(pts, [0.006, 0.012, 0.01], haut=(0, 1, 0), seg=10, aplat=0.6), M["cheveux"], "tete")
    elif style == "boucles":
        for i in range(70):
            th = rnd.uniform(-0.25, 1.0) * math.pi / 2
            ph = rnd.uniform(0, 2 * math.pi)
            u = Vector((math.cos(th) * math.cos(ph), math.cos(th) * math.sin(ph), math.sin(th)))
            if u.z < limite_cheveux(u, style) + 0.05:
                continue
            p = forme_tete(u, sil, visage=False)
            Mo.ajouter(sphere(rnd.uniform(0.012, 0.019), C + p + p.normalized() * 0.01, segments=10, anneaux=7), M["cheveux"], "tete")
    elif style == "chignon":
        Mo.ajouter(sphere(0.036, C + Vector((0, -0.06, 0.1)), echelle=(1, 0.9, 0.85), segments=18, anneaux=12), M["cheveux"], "tete")
        Mo.ajouter(tore(0.03, 0.005, axe="Z", position=C + Vector((0, -0.06, 0.08)), segments=16), M["accent"], "tete")
        Mo.ajouter(cylindre(0.0025, 0.12, axe="X", position=C + Vector((0, -0.055, 0.105)), rotation=(0, 0, 0.4), segments=8), M["metal"], "tete")
    elif style == "pics":
        for i in range(14):
            th = rnd.uniform(0.25, 1.0) * math.pi / 2
            ph = rnd.uniform(0, 2 * math.pi)
            u = Vector((math.cos(th) * math.cos(ph), math.cos(th) * math.sin(ph), math.sin(th)))
            p = forme_tete(u, sil, visage=False)
            n = (p.normalized() + Vector((0, -0.3, 0.4))).normalized()
            base = C + p
            Mo.ajouter(membre([base, base + n * 0.045, base + n * 0.085], [0.017, 0.009, 0.001], haut=(0, 0, 1), seg=8, arrondi=False), M["cheveux"], "tete")
    elif style == "crete":
        for k in range(9):
            t = k / 8
            ang = math.radians(-20 + 150 * t)
            p = C + Vector((0, 0.1 * math.cos(ang) * 0.95, 0.112 * math.sin(ang) * 0.98))
            n = (p - C).normalized()
            hgt = 0.05 + 0.03 * math.sin(math.pi * t)
            Mo.ajouter(membre([p - n * 0.01, p + n * hgt * 0.6, p + n * hgt + Vector((0, -0.02, 0))], [0.012, 0.01, 0.002], haut=(1, 0, 0), seg=8, aplat=0.4, arrondi=False), M["cheveux"], "tete")


def ajouter_barbe(Mo, h, M):
    a = h["apparence"]
    barbe = a.get("barbe")
    if not barbe or a.get("masque"):
        return
    sil = a["silhouette"]
    ep = {"courte": 0.0035, "pleine": 0.009, "bouc": 0.006}[barbe]

    def forme(u):
        p = forme_tete(u, sil)
        x, y, z = u
        X, Z = p.x, p.z
        ax = abs(X)
        if y < -0.15:
            return p * 0.97
        if barbe in ("courte", "pleine"):
            # Sous la bouche au centre, remonte le long de la mâchoire jusqu'aux pattes
            seuil = -0.048 + (0.05 if barbe == "courte" else 0.038) * _lisse(0.032, 0.07, ax)
            k = _lisse(seuil + 0.004, seuil - 0.01, Z) * _lisse(-0.15, 0.25, y)
            # moustache
            k = max(k, _g(X, 0.026) * _lisse(-0.038, -0.046, Z) * _lisse(-0.056, -0.05, Z) * 1.0)
            # dégager les lèvres
            k *= 1 - _g(X, 0.022) * _g(Z + 0.064, 0.0095)
            if barbe == "pleine":
                k *= 0.6 + 1.0 * _lisse(-0.07, -0.125, Z)
        else:
            k = _g(X, 0.02) * _lisse(-0.075, -0.09, Z) * _lisse(0.0, 0.5, y)
            k = max(k, _g(X, 0.026) * _lisse(-0.038, -0.046, Z) * _lisse(-0.056, -0.05, Z))
            k *= 1 - _g(X, 0.022) * _g(Z + 0.064, 0.0095)
        if k < 0.02:
            return p * 0.97
        return p + p.normalized() * ep * k
    b = sphere_deformee(forme, 48, 32)
    Mo.ajouter(transformer(b, Matrix.Translation(TETE_C)), M["barbe"], "tete")


# ---------------------------------------------------------------------------
# Couvre-chefs, masques, lunettes, accessoires de tête
# ---------------------------------------------------------------------------
def ajouter_couvre_chef(Mo, h, M):
    a = h["apparence"]
    sil = a["silhouette"]
    C = TETE_C
    t = a.get("tete")
    if t == "casque":
        # Casque intégral : coque, visière lumineuse, protège-joues, crête
        def forme(u):
            p = forme_tete(u, sil, machoire=False, visage=False) * 1.22
            if u.z < -0.3:
                p.y *= 1.05
            return p
        Mo.ajouter(transformer(sphere_deformee(forme, 40, 28), Matrix.Translation(C + Vector((0, 0.004, 0.004)))), M["armure"], "tete")
        secs = [section(C + Vector((0, 0.0, z)), 0.09, 0.118, ry2=0.11, p=2.2) for z in (-0.005, 0.03)]
        Mo.ajouter(coque(secs, math.radians(35), math.radians(145), 0.008, 18), M["lentille"], "tete")
        for s in (1, -1):
            j = boite((0.02, 0.06, 0.07), biseau=0.008)
            transformer(j, Matrix.Translation(C + Vector((s * 0.088, 0.035, -0.06))) @ Matrix.Rotation(-s * 0.3, 4, "Z"))
            Mo.ajouter(j, M["secondaire"], "tete")
            Mo.ajouter(cylindre(0.018, 0.012, axe="X", position=C + Vector((s * 0.095, -0.005, 0.01)), segments=16), M["metal"], "tete")
        Mo.ajouter(boite((0.02, 0.17, 0.02), position=C + Vector((0, -0.01, 0.137)), biseau=0.008), M["secondaire"], "tete")
        Mo.ajouter(boite((0.06, 0.03, 0.05), position=C + Vector((0, 0.115, -0.07)), biseau=0.01), M["secondaire"], "tete")
        for k in range(3):
            Mo.ajouter(boite((0.04, 0.004, 0.004), position=C + Vector((0, 0.131, -0.058 - k * 0.012))), M["sombre"], "tete")
    elif t == "casqueVisiere":
        def forme(u):
            return forme_tete(u, sil, machoire=False, visage=False) * 1.17
        coque_casque = sphere_deformee(lambda u: forme(u) if (u.z > 0.15 or u.y < 0.2) and u.z > -0.45 else forme_tete(u, sil, visage=False) * 0.96, 40, 28)
        Mo.ajouter(transformer(coque_casque, Matrix.Translation(C + Vector((0, -0.004, 0.006)))), M["armure"], "tete")
        secs = [section(C + Vector((0, 0.006, z)), 0.088, 0.112, ry2=0.1, p=2.1) for z in (-0.07, -0.02, 0.03, 0.065)]
        Mo.ajouter(coque(secs, math.radians(28), math.radians(152), 0.003, 20, biseau=False), M["lentille"], "tete")
        for s in (1, -1):
            Mo.ajouter(cylindre(0.02, 0.016, axe="X", position=C + Vector((s * 0.088, 0.0, 0.005)), segments=18), M["secondaire"], "tete")
        Mo.ajouter(boite((0.03, 0.14, 0.018), position=C + Vector((0, -0.02, 0.13)), biseau=0.007), M["secondaire"], "tete")
        Mo.ajouter(boite((0.012, 0.02, 0.012), position=C + Vector((0.07, 0.06, 0.07)), biseau=0.003), M["accent"], "tete")
    elif t == "capuche":
        def forme(u):
            p = forme_tete(u, sil, machoire=False, visage=False) * 1.28
            p.z += 0.01
            p.y -= 0.012
            return p
        def ouverte(u):
            # ouverture du visage
            if u.y > 0.45 and u.z < 0.55 and u.z > -0.8:
                return forme_tete(u, sil, visage=False) * 0.95
            return forme(u)
        Mo.ajouter(transformer(sphere_deformee(ouverte, 40, 28), Matrix.Translation(C)), M["tissu"], "tete")
        # Bord de la capuche et pan sur les épaules
        bord = tore(0.085, 0.009, axe="Y", segments=28, segments_tube=8)
        transformer(bord, Matrix.Translation(C + Vector((0, 0.07, -0.01))) @ Matrix.Rotation(-0.2, 4, "X") @ Matrix.Diagonal((0.9, 1, 1.25, 1)))
        Mo.ajouter(bord, M["tissu_clair"], "tete")
        secs = [section(Vector((0, -0.01, z)), rx, ry, ry2=ry2, p=2.3) for z, rx, ry, ry2 in ((1.53, 0.1, 0.08, 0.1), (1.47, 0.15, 0.09, 0.11), (1.42, 0.2, 0.11, 0.115))]
        Mo.ajouter(coque(secs, math.radians(-200), math.radians(20), 0.008, 22), M["tissu"], ["tete", "cou", "torse"])
        Mo.ajouter(sphere(0.07, C + Vector((0, 0.03, 0.0)), echelle=(1.0, 0.6, 1.3), segments=16, anneaux=10), M["sombre"], "tete")

    # Masques
    m = a.get("masque")
    if m == "foulard":
        secs = []
        for z, rx, ry, ry2 in ((-0.03, 0.078, 0.104, 0.085), (-0.065, 0.074, 0.103, 0.07), (-0.1, 0.066, 0.094, 0.06), (-0.14, 0.064, 0.08, 0.065), (-0.2, 0.08, 0.075, 0.075)):
            secs.append(section(C + Vector((0, 0.005, z)), rx, ry, ry2=ry2, p=2.2))
        Mo.ajouter(loft(secs, 28, cap0=False, cap1=False), M["tissu_clair"], ["tete", "cou"])
        Mo.ajouter(membre([C + Vector((0, -0.085, -0.04)), C + Vector((0.02, -0.12, -0.08)), C + Vector((0.03, -0.13, -0.16))], [0.014, 0.012, 0.004], haut=(1, 0, 0), seg=8, aplat=0.4), M["tissu_clair"], ["tete", "cou"])
    elif m in ("demi", "respirateur"):
        secs = [section(C + Vector((0, 0.01, z)), rx, ry, ry2=0.05, p=2.4) for z, rx, ry in ((-0.025, 0.06, 0.11), (-0.06, 0.058, 0.112), (-0.095, 0.05, 0.1))]
        Mo.ajouter(coque(secs, math.radians(25), math.radians(155), 0.008, 18), M["secondaire"] if m == "demi" else M["sombre"], "tete")
        if m == "demi":
            for k in range(4):
                Mo.ajouter(boite((0.03, 0.006, 0.003), position=C + Vector((0, 0.124, -0.045 - k * 0.011))), M["accent"], "tete")
        else:
            for s in (1, -1):
                f = cylindre(0.022, 0.03, axe="Y", position=C + Vector((s * 0.045, 0.115, -0.075)), rotation=(0, 0, -s * 0.5), segments=18, biseau=0.004)
                Mo.ajouter(f, M["metal"], "tete")
                Mo.ajouter(cylindre(0.017, 0.006, axe="Y", position=C + Vector((s * 0.053, 0.13, -0.075)), rotation=(0, 0, -s * 0.5), segments=16), M["accent"], "tete")
            Mo.ajouter(cylindre(0.015, 0.02, axe="Y", position=C + Vector((0, 0.13, -0.09)), segments=16), M["metal"], "tete")
    # Lunettes
    l = a.get("lunettes")
    if l == "visiere":
        secs = [section(C + Vector((0, 0.0, z)), 0.082, 0.1, ry2=0.09, p=2.3) for z in (0.0, 0.024)]
        Mo.ajouter(coque(secs, math.radians(22), math.radians(158), 0.004, 22), M["lentille"], "tete")
        for s in (1, -1):
            Mo.ajouter(boite((0.012, 0.03, 0.03), position=C + Vector((s * 0.083, 0.02, 0.013)), biseau=0.004), M["secondaire"], "tete")
    elif l == "monocle":
        ys = surface_visage(sil, 0.031, 0.012)
        ce = C + Vector((0.031, ys + 0.009, 0.012))
        Mo.ajouter(tore(0.016, 0.003, axe="Y", position=ce, segments=20), M["metal"], "tete")
        Mo.ajouter(cylindre(0.015, 0.002, axe="Y", position=ce, segments=20), M["lentille"], "tete")
        Mo.ajouter(boite((0.022, 0.05, 0.03), position=C + Vector((0.075, 0.03, 0.01)), biseau=0.006), M["secondaire"], "tete")
        Mo.ajouter(membre([ce + Vector((0.015, 0, 0)), C + Vector((0.066, 0.06, 0.014))], [0.003, 0.003], seg=6), M["metal"], "tete")
    elif l == "lunettes":
        for s in (1, -1):
            ys = surface_visage(sil, s * 0.031, 0.014)
            ce = C + Vector((s * 0.031, ys + 0.012, 0.014))
            Mo.ajouter(cylindre(0.019, 0.012, axe="Y", position=ce, segments=20, biseau=0.003), M["sombre"], "tete")
            Mo.ajouter(cylindre(0.016, 0.003, axe="Y", position=ce + Vector((0, 0.006, 0)), segments=20), M["lentille"], "tete")
        secs = [section(C + Vector((0, -0.005, z)), 0.079, 0.1, ry2=0.1, p=2.2) for z in (0.006, 0.022)]
        Mo.ajouter(coque(secs, math.radians(170), math.radians(370), 0.004, 24, biseau=False), M["cuir"], "tete")
    # Accessoires
    acc = a.get("accessoire")
    if acc == "oreillette":
        Mo.ajouter(sphere(0.012, C + Vector((0.078, -0.004, 0.0)), echelle=(0.7, 1, 1.1)), M["secondaire"], "tete")
        Mo.ajouter(membre([C + Vector((0.08, 0.0, -0.01)), C + Vector((0.075, 0.05, -0.05)), C + Vector((0.045, 0.085, -0.06))], [0.0025, 0.0025, 0.0025], seg=6), M["sombre"], "tete")
        Mo.ajouter(sphere(0.005, C + Vector((0.043, 0.087, -0.06))), M["accent"], "tete")
    elif acc == "bandeau":
        secs = [section(C + Vector((0, -0.004, z)), 0.077, 0.098, ry2=0.1, p=2.2) for z in (0.045, 0.068)]
        Mo.ajouter(coque(secs, 0, 2 * math.pi, 0.004, 36, biseau=False), M["accent"], "tete")
        for s in (1, -1):
            Mo.ajouter(membre([C + Vector((s * 0.01, -0.1, 0.055)), C + Vector((s * 0.03, -0.13, 0.02)), C + Vector((s * 0.045, -0.14, -0.04))], [0.008, 0.007, 0.004], haut=(0, -1, 0), seg=8, aplat=0.25), M["accent"], ["tete", "cou"])
    elif acc == "diademe":
        secs = [section(C + Vector((0, 0.0, z)), 0.077, 0.1, ry2=0.098, p=2.2) for z in (0.072, 0.082)]
        Mo.ajouter(coque(secs, math.radians(10), math.radians(170), 0.003, 24, biseau=False), M["metal"], "tete")
        Mo.ajouter(sphere(0.008, C + Vector((0, 0.103, 0.085)), echelle=(1, 0.6, 1.4)), M["accent"], "tete")
    elif acc == "casqueAudio":
        for s in (1, -1):
            Mo.ajouter(cylindre(0.035, 0.03, axe="X", position=C + Vector((s * 0.085, -0.005, 0.0)), segments=24, biseau=0.008), M["secondaire"], "tete")
            Mo.ajouter(tore(0.024, 0.004, axe="X", position=C + Vector((s * 0.101, -0.005, 0.0)), segments=20), M["accent"], "tete")
        secs = [section(C + Vector((0, -0.005, 0.0)), 0.098, 0.016, p=2.0, x=(1, 0, 0), y=(0, 1, 0))]
        arc = []
        for k in range(9):
            ang = math.pi * k / 8
            arc.append(C + Vector((0.093 * math.cos(ang), -0.005, 0.125 * math.sin(ang) + 0.0)))
        Mo.ajouter(membre(arc, [0.009] * 9, haut=(0, 1, 0), seg=10, aplat=0.5), M["sombre"], "tete")
    elif acc == "couronne":
        for k in range(8):
            ang = 2 * math.pi * k / 8
            p = C + Vector((0.1 * math.cos(ang), 0.1 * math.sin(ang), 0.155))
            Mo.ajouter(boite((0.03, 0.012, 0.03), position=p, rotation=(0, 0, ang + math.pi / 2), biseau=0.004), M["accent"], "tete")
    elif acc == "halo":
        Mo.ajouter(tore(0.085, 0.006, axe="Z", position=C + Vector((0, -0.02, 0.17)), segments=40), M["accent"], "tete")
    elif acc == "fleurs":
        rnd = random.Random(5)
        for k in range(5):
            ang = -0.6 + k * 0.32
            p = C + Vector((0.08 * math.cos(ang + 1.0), -0.03 + 0.05 * math.sin(ang), 0.07 + 0.02 * math.sin(k)))
            for j in range(5):
                pa = 2 * math.pi * j / 5
                Mo.ajouter(sphere(0.008, p + Vector((math.cos(pa), 0, math.sin(pa))) * 0.009, echelle=(1, 0.4, 1)), M["accent"], "tete")
            Mo.ajouter(sphere(0.005, p), M["secondaire"], "tete")


# ===========================================================================
# Corps : torse, bras, mains, jambes, pieds
# ===========================================================================
def ajouter_corps(Mo, h, M, prof):
    a = h["apparence"]
    corps, sil = a["corps"], a["silhouette"]
    R = rayons_membres(corps, sil)
    buste = a.get("buste")
    jambes = a.get("jambes")
    # Torse (haut porté) : sous-couche toujours présente
    mat_haut = M["tissu"] if buste != "combinaison" else M["tissu"]
    Mo.ajouter(loft(sections_torse(prof, 0.004, z_min=0.86), 32), mat_haut, ["hanches", "ventre", "torse", "cou", "cuisse_d", "cuisse_g"])
    # Bras (manches) et mains
    for s, c in ((1, "d"), (-1, "g")):
        ep, co, po, ma, d1, d2, d, dos = _bras(s)
        rb, rab = R["bras"], R["avantbras"]
        epa = ep + Vector((-s * 0.015, 0, 0.01))
        pts = [epa, ep.lerp(co, 0.35), ep.lerp(co, 0.75), co, co.lerp(po, 0.3), co.lerp(po, 0.7), po - d * 0.01]
        ray = [rb[0] * 1.05, rb[0], rb[1], rb[2], rab[1], rab[0] * 0.95, rab[2]]
        Mo.ajouter(membre(pts, ray, haut=(0, 1, 0), seg=18), M["tissu"], [f"clavicule_{c}", f"bras_{c}", f"avantbras_{c}", "torse"])
        # Épaule arrondie (deltoïde)
        Mo.ajouter(sphere(rb[0] * 1.12, ep + Vector((-s * 0.008, 0, 0.004)), echelle=(1.0, 1.0, 0.95), segments=18, anneaux=12), M["tissu"], [f"clavicule_{c}", f"bras_{c}", "torse"])
        # Gant
        ajouter_main(Mo, M, s, c, po, ma, d1, d2, d, dos, R)
    # Jambes (pantalon) et bottes
    gonfle = {"cargo": 1.12, "moulantes": 1.0, "blindees": 1.08}.get(jambes, 1.05)
    mat_bas = M["tissu_clair"] if jambes != "moulantes" else M["tissu"]
    for s, c in ((1, "d"), (-1, "g")):
        rc, rj = R["cuisse"], R["jambe"]
        x = s * 0.095
        pts = [(x * 0.92, 0.0, 0.93), (x, 0.012, 0.8), (x, 0.012, 0.66), (x, 0.018, 0.53), (x, 0.012, 0.44), (x, 0.0, 0.3), (x, -0.004, 0.17)]
        ray = [rc[0] * 1.05, rc[0], rc[1], rc[2], rj[1], rj[0], rj[2]]
        ray = [r * gonfle for r in ray]
        Mo.ajouter(membre(pts, ray, haut=(0, 1, 0), seg=20, aplat=1.0), mat_bas, ["hanches", f"cuisse_{c}", f"tibia_{c}"])
        ajouter_botte(Mo, M, s, c, jambes == "blindees" or corps == "massif")
    # Ceinture et boucle
    z, cy, rx, ry, ry2 = (0.985,) + interp_torse(prof, 0.985)
    sec = section((0, cy, z), rx + 0.012, ry + 0.012, ry2=ry2 + 0.012, p=2.2)
    Mo.ajouter(bande(sec, 0, 2 * math.pi, 0.045, 0.008, 40), M["cuir"], ["hanches"])
    Mo.ajouter(boite((0.06, 0.016, 0.04), position=(0, cy + ry + 0.022, z), biseau=0.005), M["metal"], "hanches")
    Mo.ajouter(boite((0.03, 0.006, 0.012), position=(0, cy + ry + 0.031, z), biseau=0.002), M["accent"], "hanches")


def ajouter_main(Mo, M, s, c, po, ma, d1, d2, d, dos, R):
    """Gant : paume, quatre doigts (deux phalanges skinnées), pouce, poignet renforcé."""
    lat = d.cross(dos).normalized()   # direction "travers de la main" (vers l'avant pour les deux mains en pose A)
    k = R["avantbras"][2] / 0.03
    # Poignet / manchette
    Mo.ajouter(membre([po - d * 0.03, po + d * 0.005], [0.034 * k, 0.032 * k], haut=dos, seg=16, aplat=0.85), M["gant"], [f"avantbras_{c}", f"main_{c}"])
    # Paume
    paume = loft([section(po + d * f, 0.042 * k * w, 0.017 * k, x=lat, y=dos, p=3.0) for f, w in ((0.0, 0.85), (0.04, 1.0), (0.085, 0.98))], 16)
    Mo.ajouter(paume, M["gant"], f"main_{c}")
    Mo.ajouter(_plaque_main(po, d, dos, lat, k), M["secondaire"], f"main_{c}")
    # Doigts
    for i, off in enumerate((-0.027, -0.009, 0.009, 0.026)):
        L = (0.9, 1.0, 0.95, 0.75)[i]
        base = ma + lat * off * k - d * 0.004
        mi = d1 + lat * off * k * 1.02
        fin = d2 + lat * off * k * 1.04 - d * (1 - L) * 0.03
        r = 0.0092 * k * (1.0 if i < 3 else 0.85)
        Mo.ajouter(membre([base, base.lerp(mi, 0.5), mi], [r, r, r * 0.95], haut=dos, seg=10), M["gant"], f"doigts1_{c}")
        Mo.ajouter(membre([mi, fin], [r * 0.95, r * 0.85], haut=dos, seg=10), M["gant"], f"doigts2_{c}")
    # Pouce
    pb = po + d * 0.025 + Vector((0, 0.022, 0))
    dirp = (d * 0.4 + Vector((0, 1, 0))).normalized()
    pd = pb + dirp * 0.035
    pf = pd + (d * 0.6 + Vector((0, 1, 0))).normalized() * 0.03
    Mo.ajouter(membre([pb - dirp * 0.01, pd], [0.012 * k, 0.0105 * k], haut=dos, seg=10), M["gant"], f"pouce1_{c}")
    Mo.ajouter(membre([pd, pf], [0.0105 * k, 0.009 * k], haut=dos, seg=10), M["gant"], f"pouce2_{c}")


def _plaque_main(po, d, dos, lat, k):
    b = boite((0.06 * k, 0.05, 0.008), biseau=0.003)
    x = lat
    y = d
    z = dos
    Mr = Matrix((x, y, z)).transposed().to_4x4()
    Mr.translation = po + d * 0.05 + dos * 0.017 * k
    return transformer(b, Mr)


def ajouter_botte(Mo, M, s, c, lourde):
    x = s * 0.097
    k = 1.12 if lourde else 1.0
    # Tige de la botte (mollet bas) et pied
    tige = membre([(x, -0.005, 0.27), (x, -0.004, 0.18), (x, 0.0, 0.1)], [0.05 * k, 0.047 * k, 0.05 * k], haut=(0, 1, 0), seg=18)
    Mo.ajouter(tige, M["cuir"], [f"tibia_{c}", f"pied_{c}"])
    # Le loft suit Y : on doit orienter les sections perpendiculairement à Y
    pied = loft([section((x, y, z), rx * k, rz, x=(1, 0, 0), y=(0, 0, 1), p=2.6) for y, z, rx, rz in ((-0.05, 0.06, 0.045, 0.055), (-0.02, 0.055, 0.05, 0.058), (0.04, 0.045, 0.05, 0.045), (0.1, 0.035, 0.048, 0.035), (0.16, 0.03, 0.042, 0.028), (0.2, 0.028, 0.032, 0.022))], 18)
    Mo.ajouter(pied, M["cuir"], [f"pied_{c}", f"orteils_{c}"])
    semelle = boite((0.1 * k, 0.27, 0.024), position=(x, 0.075, 0.012), biseau=0.008)
    Mo.ajouter(semelle, M["caoutchouc"], [f"pied_{c}", f"orteils_{c}"])
    Mo.ajouter(boite((0.08 * k, 0.05, 0.01), position=(x, 0.13, 0.052), rotation=(-0.25, 0, 0), biseau=0.003), M["secondaire"], f"orteils_{c}")
    Mo.ajouter(bande(section((x, -0.004, 0.24), 0.052 * k, 0.052 * k), 0, 2 * math.pi, 0.018, 0.005, 24), M["secondaire"], f"tibia_{c}")


# ===========================================================================
# Tenues : buste, épaules, dos, jambes
# ===========================================================================
def _sur_torse(prof, z, a, gonfle=0.0):
    """Point de la surface du torse à la hauteur z et l'angle a (0 = droite, pi/2 = avant)."""
    cy, rx, ry, ry2 = interp_torse(prof, z)
    sec = section((0, cy, z), rx + gonfle, ry + gonfle, ry2=ry2 + gonfle, p=2.2)
    return point_section(sec, a)


def sangle_diagonale(prof, z0, a0, z1, a1, largeur, epaisseur, n=14, gonfle=0.012):
    pts = []
    for i in range(n + 1):
        t = i / n
        pts.append(_sur_torse(prof, z0 + (z1 - z0) * t, a0 + (a1 - a0) * t, gonfle))
    return membre(pts, [largeur * 0.5] * len(pts), haut=(0, 0, 1), seg=10, aplat=epaisseur / largeur, arrondi=False)


def ajouter_buste(Mo, h, M, prof):
    a = h["apparence"]
    b = a.get("buste")
    corps = a["corps"]
    P = ["hanches", "ventre", "torse", "cou"]
    PB = P + ["clavicule_d", "clavicule_g"]
    if b == "plastron":
        Mo.ajouter(coque(sections_torse(prof, 0.012, 1.17, 1.42, 0.006), math.radians(18), math.radians(162), 0.014, 20), M["armure"], P)
        Mo.ajouter(coque(sections_torse(prof, 0.01, 1.2, 1.41), math.radians(205), math.radians(335), 0.012, 16), M["armure"], P)
        for i, z in enumerate((1.06, 1.1, 1.14)):
            Mo.ajouter(coque(sections_torse(prof, 0.012 + 0.002 * i, z - 0.017, z + 0.017), math.radians(45), math.radians(135), 0.008, 14), M["secondaire"], P)
        Mo.ajouter(bande(section((0, 0, 1.44), 0.075, 0.062, ry2=0.066), 0, 2 * math.pi, 0.03, 0.008, 28), M["secondaire"], ["torse", "cou"])
        _bande_equipe(Mo, M, prof, 1.33, P)
    elif b == "combinaison":
        for s in (1, -1):
            Mo.ajouter(sangle_diagonale(prof, 1.0, math.pi / 2 + s * 0.35, 1.4, math.pi / 2 + s * 1.05, 0.012, 0.003, gonfle=0.007), M["secondaire"], P)
            Mo.ajouter(sangle_diagonale(prof, 0.95, math.pi / 2 + s * 1.3, 1.38, math.pi / 2 + s * 1.45, 0.02, 0.004, gonfle=0.007), M["tissu_clair"], P)
        Mo.ajouter(sangle_diagonale(prof, 0.99, math.pi / 2, 1.43, math.pi / 2 - 0.08, 0.006, 0.003, gonfle=0.008), M["accent"], P)
        Mo.ajouter(coque(sections_torse(prof, 0.008, 1.22, 1.38, 0.004), math.radians(55), math.radians(125), 0.008, 12), M["secondaire"], P)
        Mo.ajouter(bande(section((0, 0, 1.445), 0.07, 0.058, ry2=0.062), 0, 2 * math.pi, 0.03, 0.006, 28), M["tissu_clair"], ["torse", "cou"])
        _bande_equipe(Mo, M, prof, 1.3, P)
    elif b == "armureLourde":
        Mo.ajouter(coque(sections_torse(prof, 0.028, 1.12, 1.43, 0.01), math.radians(-25), math.radians(205), 0.02, 26), M["armure"], P)
        Mo.ajouter(coque(sections_torse(prof, 0.026, 1.14, 1.42), math.radians(200), math.radians(340), 0.02, 16), M["armure"], P)
        for i, z in enumerate((0.99, 1.04, 1.09)):
            Mo.ajouter(coque(sections_torse(prof, 0.02, z - 0.022, z + 0.022), math.radians(25), math.radians(155), 0.012, 16), M["secondaire"], P)
        Mo.ajouter(loft([section((0, 0.0, z), rx, ry, ry2=ry2, p=2.3) for z, rx, ry, ry2 in ((1.42, 0.13, 0.1, 0.1), (1.48, 0.1, 0.085, 0.095), (1.52, 0.085, 0.08, 0.09))], 26, cap0=False, cap1=False), M["secondaire"], ["torse", "cou"])
        cy, rx, ry, ry2 = interp_torse(prof, 1.32)
        Mo.ajouter(cylindre(0.035, 0.03, axe="Y", position=(0, cy + ry + 0.05, 1.32), segments=24, biseau=0.006), M["metal"], "torse")
        Mo.ajouter(cylindre(0.026, 0.02, axe="Y", position=(0, cy + ry + 0.066, 1.32), segments=24), M["accent"], "torse")
        _bande_equipe(Mo, M, prof, 1.22, P, gonfle=0.05)
    elif b == "veste":
        secs = sections_torse(prof, 0.016, 0.92, 1.44)
        Mo.ajouter(coque(secs, math.radians(100), math.radians(440), 0.008, 40), M["tissu"], PB)
        Mo.ajouter(coque(sections_torse(prof, 0.006, 0.95, 1.4), math.radians(80), math.radians(100), 0.003, 4), M["tissu_clair"], P)
        col = [section((0, 0.0, z), rx, ry, ry2=ry2, p=2.2) for z, rx, ry, ry2 in ((1.41, 0.15, 0.105, 0.1), (1.47, 0.095, 0.08, 0.085), (1.51, 0.085, 0.07, 0.08))]
        Mo.ajouter(coque(col, math.radians(105), math.radians(435), 0.006, 30), M["tissu"], ["torse", "cou"])
        for s in (1, -1):
            for z in (1.06, 1.25):
                p = _sur_torse(prof, z, math.pi / 2 - s * 0.75, 0.03)
                Mo.ajouter(boite((0.05, 0.02, 0.05), position=p, rotation=(0, 0, -s * 0.7), biseau=0.005), M["tissu_clair"], P)
        Mo.ajouter(coque(sections_torse(prof, 0.026, 1.0, 1.02), 0, 2 * math.pi, 0.004, 40), M["tissu"], P)
        _bande_equipe(Mo, M, prof, 1.36, P, gonfle=0.026, a0=200, a1=250)
    elif b == "harnais":
        for s in (1, -1):
            Mo.ajouter(sangle_diagonale(prof, 1.0, math.pi / 2 + s * 0.6, 1.43, math.pi / 2 - s * 0.9, 0.04, 0.006, gonfle=0.01), M["cuir"], P)
            Mo.ajouter(sangle_diagonale(prof, 1.0, math.pi * 1.5 + s * 0.6, 1.43, math.pi * 1.5 - s * 0.9, 0.04, 0.006, gonfle=0.01), M["cuir"], P)
            for z in (1.18, 1.3):
                p = _sur_torse(prof, z, math.pi / 2 + s * 0.45, 0.03)
                Mo.ajouter(boite((0.05, 0.03, 0.06), position=p, rotation=(0, 0, s * 0.45), biseau=0.006), M["secondaire"], P)
        Mo.ajouter(boite((0.07, 0.025, 0.07), position=_sur_torse(prof, 1.22, math.pi / 2, 0.025), biseau=0.01), M["metal"], P)
        Mo.ajouter(cylindre(0.018, 0.01, axe="Y", position=_sur_torse(prof, 1.22, math.pi / 2, 0.04), segments=16), M["accent"], P)
        _bande_equipe(Mo, M, prof, 1.38, P)
    elif b == "manteau":
        secs = []
        for z, ev in ((0.5, 0.11), (0.62, 0.08), (0.75, 0.055), (0.86, 0.03), (0.95, 0.022), (1.05, 0.02), (1.2, 0.02), (1.32, 0.02), (1.41, 0.02)):
            if z < 0.86:
                cy, rx, ry, ry2 = interp_torse(prof, 0.86)
                rx = 0.2 + ev
                secs.append(section((0, -0.01, z), rx, ry + ev + 0.02, ry2=ry2 + ev + 0.02, p=2.0))
            else:
                cy, rx, ry, ry2 = interp_torse(prof, z)
                secs.append(section((0, cy, z), rx + ev, ry + ev, ry2=ry2 + ev, p=2.2))
        Mo.ajouter(coque(secs, math.radians(102), math.radians(438), 0.009, 44), M["tissu"], ["hanches", "ventre", "torse", "cou", "cuisse_d", "cuisse_g"])
        col = [section((0, -0.005, z), rx, ry, ry2=ry2, p=2.2) for z, rx, ry, ry2 in ((1.4, 0.16, 0.11, 0.11), (1.48, 0.11, 0.09, 0.1), (1.56, 0.1, 0.085, 0.1))]
        Mo.ajouter(coque(col, math.radians(110), math.radians(430), 0.008, 30), M["tissu"], ["torse", "cou"])
        for z in (1.05, 1.15, 1.25):
            Mo.ajouter(sphere(0.008, _sur_torse(prof, z, math.pi / 2 + 0.25, 0.032)), M["metal"], P)
        Mo.ajouter(bande(section((0, 0.0, 1.0), 0.19, 0.12, ry2=0.13), 0, 2 * math.pi, 0.04, 0.008, 40), M["cuir"], ["hanches", "ventre"])
        _bande_equipe(Mo, M, prof, 1.34, P, gonfle=0.032, a0=195, a1=255)
    if corps == "massif" and b != "armureLourde":
        Mo.ajouter(coque(sections_torse(prof, 0.02, 1.25, 1.42), math.radians(30), math.radians(150), 0.012, 16), M["armure"], P)


def _bande_equipe(Mo, M, prof, z, P, gonfle=0.03, a0=210, a1=250):
    """Bande lumineuse aux couleurs de l'équipe (dos et poitrine) : lisibilité en combat."""
    for aa, ab in ((a0, a1), (360 - a1 + 180, 360 - a0 + 180)):
        Mo.ajouter(coque(sections_torse(prof, gonfle, z - 0.008, z + 0.008), math.radians(aa), math.radians(ab), 0.004, 8, biseau=False), M["equipe"], P)


def ajouter_epaules(Mo, h, M):
    a = h["apparence"]
    e = a.get("epaules")
    for s, c in ((1, "d"), (-1, "g")):
        ep, co, po, ma, d1, d2, d, dos = _bras(s)
        poids = Mo.poids_auto([f"clavicule_{c}", f"bras_{c}"])
        lourd = e == "lourdes" or (e == "asym" and s < 0)
        leger = e == "legeres" or (e == "asym" and s > 0)
        axe = (d + Vector((0, 0, 0.6))).normalized()
        haut = Vector((0, 0, 1))
        if lourd:
            for i in range(3):
                r = 0.09 - i * 0.012
                ctr = ep + Vector((-s * 0.01, 0, 0.03 - i * 0.03)) + d * (0.02 + i * 0.03)
                # Coque en dôme au-dessus de l'épaule
                dome = sphere(1.0, segments=20, anneaux=12)
                sc = Matrix.Diagonal((r * 1.05, r * 1.1, r * 0.75, 1))
                bm = dome
                for v in list(bm.verts):
                    if v.co.z < -0.15:
                        v.co.z = -0.15 + (v.co.z + 0.15) * 0.15
                Mr = Matrix.Translation(ctr) @ Matrix.Rotation(-s * (0.35 + i * 0.2), 4, "Y") @ sc
                Mo.ajouter(transformer(bm, Mr), M["armure"] if i != 1 else M["secondaire"], poids)
            Mo.ajouter(boite((0.012, 0.06, 0.02), position=ep + Vector((s * 0.04, 0, 0.075)), rotation=(0, -s * 0.4, 0), biseau=0.004), M["equipe"], poids)
        elif leger:
            dome = sphere(1.0, segments=18, anneaux=10)
            for v in list(dome.verts):
                if v.co.z < 0.0:
                    v.co.z *= 0.1
            r = 0.065
            Mr = Matrix.Translation(ep + Vector((s * 0.012, 0, 0.035))) @ Matrix.Rotation(-s * 0.45, 4, "Y") @ Matrix.Diagonal((r, r * 1.1, r * 0.7, 1))
            Mo.ajouter(transformer(dome, Mr), M["secondaire"], poids)
            Mo.ajouter(boite((0.01, 0.05, 0.012), position=ep + Vector((s * 0.03, 0, 0.068)), rotation=(0, -s * 0.45, 0), biseau=0.003), M["equipe"], poids)
        elif e == "fourrure":
            pass
        # Brassard d'équipe sur le haut du bras
        # Orientation : la bande doit entourer le bras (axe d)
        Mo.ajouter(_bande_bras(ep.lerp(co, 0.55), d, 0.052 * (1.2 if a["corps"] == "massif" else 1.0) * (0.9 if a["silhouette"] == "f" else 1.0)), M["equipe"], [f"bras_{c}"])
    if e == "fourrure":
        secs = []
        for z, rx, ry, ry2 in ((1.38, 0.2, 0.12, 0.12), (1.43, 0.19, 0.12, 0.125), (1.48, 0.14, 0.1, 0.11), (1.52, 0.1, 0.085, 0.1)):
            secs.append(section((0, -0.005, z), rx, ry, ry2=ry2, p=2.1))
        bm = loft(secs, 40, cap0=False, cap1=False)
        rnd = random.Random(3)
        for v in bm.verts:
            n = Vector((v.co.x, v.co.y - (-0.005), 0)).normalized()
            v.co += n * (0.012 + 0.01 * rnd.random())
        Mo.ajouter(bm, M["tissu_clair"], ["torse", "cou", "clavicule_d", "clavicule_g"])


def _bande_bras(c, d, r):
    x = d.cross(Vector((0, 1, 0))).normalized()
    y = Vector((0, 1, 0))
    sec = section(c, r, r, x=x, y=y)
    return bande(sec, 0, 2 * math.pi, 0.016, 0.004, 20)


def ajouter_dos(Mo, h, M, prof):
    a = h["apparence"]
    dos = a.get("dos")
    cy, rx, ry, ry2 = interp_torse(prof, 1.25)
    Y = cy - ry2 - 0.03   # plan du dos
    if a.get("buste") in ("armureLourde",):
        Y -= 0.03
    elif a.get("buste") in ("manteau", "veste"):
        Y -= 0.015
    T = "torse"
    if dos == "propulseurs":
        Mo.ajouter(boite((0.2, 0.08, 0.26), position=(0, Y - 0.02, 1.27), biseau=0.02), M["armure"], T)
        for s in (1, -1):
            Mo.ajouter(cylindre(0.045, 0.24, axe="Z", position=(s * 0.1, Y - 0.07, 1.22), rotation=(0.12, s * 0.15, 0), segments=24, biseau=0.01), M["secondaire"], T)
            Mo.ajouter(cylindre(0.05, 0.05, axe="Z", position=(s * 0.105, Y - 0.08, 1.08), rotation=(0.12, s * 0.15, 0), segments=24, rayon2=0.038), M["metal"], T)
            Mo.ajouter(cylindre(0.034, 0.012, axe="Z", position=(s * 0.106, Y - 0.083, 1.055), rotation=(0.12, s * 0.15, 0), segments=20), M["accent"], T)
            Mo.ajouter(tube([(s * 0.06, Y, 1.36), (s * 0.12, Y - 0.04, 1.37), (s * 0.1, Y - 0.07, 1.34)], 0.008, 8), M["sombre"], T)
        Mo.ajouter(boite((0.06, 0.012, 0.012), position=(0, Y - 0.062, 1.33)), M["equipe"], T)
    elif dos == "lames":
        for s in (1, -1):
            r = (0, 0.0, s * 0.65)
            Mo.ajouter(boite((0.035, 0.012, 0.5), position=(0, Y - 0.02, 1.2), rotation=(0, s * 0.6, 0), biseau=0.004), M["sombre"], T)
            lame = boite((0.025, 0.004, 0.42), position=(0, Y - 0.032, 1.22), rotation=(0, s * 0.6, 0), biseau=0.0015)
            Mo.ajouter(lame, M["accent"], T)
            Mo.ajouter(cylindre(0.012, 0.09, axe="Z", position=(s * 0.16, Y - 0.025, 1.43), rotation=(0, s * 0.6, 0), segments=12), M["cuir"], T)
    elif dos == "reservoirs":
        for s in (1, -1):
            Mo.ajouter(cylindre(0.05, 0.3, axe="Z", position=(s * 0.065, Y - 0.04, 1.23), segments=24, biseau=0.02), M["secondaire"], T)
            Mo.ajouter(cylindre(0.052, 0.03, axe="Z", position=(s * 0.065, Y - 0.04, 1.23), segments=24), M["accent"], T)
            Mo.ajouter(cylindre(0.02, 0.03, axe="Z", position=(s * 0.065, Y - 0.04, 1.4), segments=12), M["metal"], T)
            Mo.ajouter(tube([(s * 0.065, Y - 0.04, 1.41), (s * 0.15, Y, 1.42), (s * 0.2, Y + 0.05, 1.33), (s * 0.22, Y + 0.1, 1.15)], 0.007, 8), M["sombre"], ["torse", "ventre"])
        Mo.ajouter(boite((0.2, 0.03, 0.04), position=(0, Y - 0.03, 1.1), biseau=0.008), M["metal"], T)
    elif dos == "generateur":
        Mo.ajouter(boite((0.26, 0.1, 0.3), position=(0, Y - 0.03, 1.25), biseau=0.025), M["armure"], T)
        Mo.ajouter(cylindre(0.055, 0.04, axe="Y", position=(0, Y - 0.085, 1.27), segments=28, biseau=0.006), M["metal"], T)
        Mo.ajouter(cylindre(0.042, 0.02, axe="Y", position=(0, Y - 0.105, 1.27), segments=28), M["accent"], T)
        for s in (1, -1):
            for k in range(4):
                Mo.ajouter(boite((0.05, 0.01, 0.008), position=(s * 0.09, Y - 0.082, 1.17 + k * 0.025), biseau=0.002), M["sombre"], T)
        Mo.ajouter(boite((0.08, 0.012, 0.012), position=(0, Y - 0.082, 1.38)), M["equipe"], T)
    elif dos == "bouclier":
        Mo.ajouter(cylindre(0.2, 0.025, axe="Y", position=(0, Y - 0.025, 1.22), segments=8, biseau=0.008), M["armure"], T)
        Mo.ajouter(cylindre(0.15, 0.01, axe="Y", position=(0, Y - 0.04, 1.22), segments=8), M["secondaire"], T)
        Mo.ajouter(cylindre(0.05, 0.012, axe="Y", position=(0, Y - 0.048, 1.22), segments=24), M["accent"], T)
    elif dos == "antenne":
        Mo.ajouter(boite((0.2, 0.09, 0.24), position=(0, Y - 0.025, 1.24), biseau=0.02), M["secondaire"], T)
        Mo.ajouter(cylindre(0.006, 0.42, axe="Z", position=(0.07, Y - 0.04, 1.5), segments=8), M["metal"], T)
        Mo.ajouter(sphere(0.012, (0.07, Y - 0.04, 1.71)), M["accent"], T)
        Mo.ajouter(cylindre(0.03, 0.02, axe="Y", position=(-0.05, Y - 0.075, 1.3), segments=20), M["accent"], T)
        for k in range(3):
            Mo.ajouter(boite((0.16, 0.006, 0.01), position=(0, Y - 0.072, 1.17 + k * 0.02)), M["sombre"], T)
    elif dos == "cape":
        secs = []
        for z, rx, ev in ((1.43, 0.17, 0.0), (1.3, 0.2, 0.01), (1.1, 0.21, 0.02), (0.9, 0.22, 0.03), (0.7, 0.23, 0.05), (0.55, 0.24, 0.06)):
            cy, rxt, ry, ry2 = interp_torse(prof, max(z, 0.86))
            secs.append(section((0, cy, z), rx + ev, ry + 0.02 + ev, ry2=ry2 + 0.025 + ev, p=2.2))
        Mo.ajouter(coque(secs, math.radians(195), math.radians(345), 0.006, 20), M["tissu"], ["torse", "ventre", "hanches", "cuisse_d", "cuisse_g"])
        Mo.ajouter(cylindre(0.02, 0.01, axe="Y", position=(0.13, 0.08, 1.4), segments=16), M["accent"], T)
        Mo.ajouter(cylindre(0.02, 0.01, axe="Y", position=(-0.13, 0.08, 1.4), segments=16), M["accent"], T)
    elif dos == "drone":
        Mo.ajouter(boite((0.16, 0.06, 0.2), position=(0, Y - 0.02, 1.25), biseau=0.015), M["secondaire"], T)
        Mo.ajouter(sphere(0.06, (0, Y - 0.08, 1.28), echelle=(1.3, 0.8, 0.7)), M["armure"], T)
        Mo.ajouter(cylindre(0.02, 0.01, axe="Y", position=(0, Y - 0.13, 1.28), segments=16), M["lentille"], T)
        for sx in (1, -1):
            for sz in (1, -1):
                p = (sx * 0.09, Y - 0.08, 1.28 + sz * 0.07)
                Mo.ajouter(tore(0.03, 0.005, axe="Y", position=p, segments=18), M["metal"], T)
                Mo.ajouter(boite((0.05, 0.004, 0.006), position=p, rotation=(0, 0.5 * sx * sz, 0)), M["sombre"], T)
    elif dos == "carquois":
        Mo.ajouter(cylindre(0.035, 0.42, axe="Z", position=(0.05, Y - 0.03, 1.25), rotation=(0, -0.45, 0), segments=18, biseau=0.006), M["cuir"], T)
        for k in range(4):
            Mo.ajouter(boite((0.012, 0.003, 0.09), position=(0.13 + k * 0.012 - 0.02, Y - 0.03 + (k % 2) * 0.01, 1.47 - k * 0.01), rotation=(0, -0.45, 0)), M["accent"], T)
        Mo.ajouter(sangle_diagonale(prof, 1.0, math.pi / 2 - 0.5, 1.42, math.pi / 2 + 1.2, 0.035, 0.006), M["cuir"], ["torse", "ventre"])
    elif dos == "bobines":
        for s in (1, -1):
            for k in range(5):
                Mo.ajouter(tore(0.035 - k * 0.003, 0.008, axe="Z", position=(s * 0.08, Y - 0.05, 1.12 + k * 0.045), segments=20), M["metal"] if k % 2 == 0 else M["secondaire"], T)
            Mo.ajouter(cylindre(0.015, 0.25, axe="Z", position=(s * 0.08, Y - 0.05, 1.2), segments=12), M["accent"], T)
            Mo.ajouter(sphere(0.02, (s * 0.08, Y - 0.05, 1.36)), M["accent"], T)
        Mo.ajouter(boite((0.22, 0.05, 0.08), position=(0, Y - 0.02, 1.08), biseau=0.01), M["armure"], T)
    elif dos == "ailes":
        Mo.ajouter(boite((0.16, 0.06, 0.18), position=(0, Y - 0.02, 1.3), biseau=0.02), M["armure"], T)
        for s in (1, -1):
            for k in range(3):
                L = 0.42 - k * 0.07
                ang = 0.35 + k * 0.32
                ctr = Vector((s * 0.08, Y - 0.05 - k * 0.01, 1.36))
                dirv = Vector((s * math.sin(ang), 0, math.cos(ang) * 0.6 - 0.2)).normalized()
                plume = boite((0.05, 0.012, L), biseau=0.006)
                Mr = Matrix.Translation(ctr + dirv * L * 0.5) @ Matrix.Rotation(-s * (math.pi / 2 - ang) * 0.85, 4, "Y")
                Mo.ajouter(transformer(plume, Mr), M["armure"] if k != 1 else M["secondaire"], T)
                bord = boite((0.008, 0.014, L * 0.9))
                Mo.ajouter(transformer(bord, Mr @ Matrix.Translation((s * 0.026, 0, 0))), M["accent"], T)
    elif dos == "enceintes":
        Mo.ajouter(boite((0.26, 0.1, 0.24), position=(0, Y - 0.03, 1.24), biseau=0.02), M["sombre"], T)
        for s in (1, -1):
            Mo.ajouter(cylindre(0.065, 0.02, axe="Y", position=(s * 0.065, Y - 0.085, 1.26), segments=28), M["metal"], T)
            Mo.ajouter(tore(0.062, 0.006, axe="Y", position=(s * 0.065, Y - 0.095, 1.26), segments=28), M["accent"], T)
            Mo.ajouter(sphere(0.025, (s * 0.065, Y - 0.09, 1.26), echelle=(1, 0.5, 1)), M["secondaire"], T)
    elif dos == "vrilles":
        rnd = random.Random(11)
        for s in (1, -1):
            pts = [Vector((s * 0.05, Y + 0.01, 1.05)), Vector((s * 0.1, Y - 0.03, 1.22)), Vector((s * 0.15, Y + 0.01, 1.38)), Vector((s * 0.17, 0.0, 1.47)), Vector((s * 0.2, 0.06, 1.44))]
            Mo.ajouter(membre(pts, [0.012, 0.014, 0.012, 0.009, 0.004], seg=8), M["secondaire"], ["torse", "ventre", f"clavicule_{'d' if s > 0 else 'g'}"])
            for k in range(5):
                p = pts[0].lerp(pts[3], rnd.random())
                Mo.ajouter(sphere(0.022, p + Vector((s * 0.01, -0.015, 0)), echelle=(1.0, 0.25, 0.55), rotation=(0, rnd.random(), 0)), M["accent"], ["torse"])
    elif dos == "caisse":
        Mo.ajouter(boite((0.3, 0.2, 0.34), position=(0, Y - 0.09, 1.22), biseau=0.015), M["armure"], T)
        Mo.ajouter(boite((0.31, 0.21, 0.03), position=(0, Y - 0.09, 1.34)), M["secondaire"], T)
        Mo.ajouter(boite((0.31, 0.21, 0.03), position=(0, Y - 0.09, 1.1)), M["secondaire"], T)
        Mo.ajouter(boite((0.08, 0.02, 0.025), position=(0, Y - 0.2, 1.24)), M["accent"], T)
        Mo.ajouter(boite((0.025, 0.02, 0.08), position=(0, Y - 0.2, 1.24)), M["accent"], T)
        for s in (1, -1):
            Mo.ajouter(sangle_diagonale(prof, 1.12, math.pi / 2 + s * 0.6, 1.44, math.pi / 2 + s * 1.2, 0.04, 0.006), M["cuir"], ["torse", "ventre"])


def ajouter_jambes(Mo, h, M):
    a = h["apparence"]
    j = a.get("jambes")
    for s, c in ((1, "d"), (-1, "g")):
        x = s * 0.095
        P = [f"cuisse_{c}", f"tibia_{c}"]
        if j == "cargo":
            Mo.ajouter(boite((0.03, 0.08, 0.1), position=(s * 0.185, 0.0, 0.72), biseau=0.01), M["tissu_clair"], f"cuisse_{c}")
            Mo.ajouter(boite((0.032, 0.06, 0.012), position=(s * 0.186, 0.0, 0.77), biseau=0.004), M["tissu"], f"cuisse_{c}")
            g = coque([section((x, 0.03, z), 0.06, 0.07) for z in (0.48, 0.53, 0.58)], math.radians(40), math.radians(140), 0.014, 12)
            Mo.ajouter(g, M["secondaire"], P)
        elif j == "moulantes":
            Mo.ajouter(membre([(s * 0.17, 0.0, 0.9), (s * 0.165, 0.02, 0.7), (s * 0.13, 0.05, 0.53)], [0.005, 0.005, 0.004], seg=6), M["secondaire"], ["hanches", f"cuisse_{c}"])
            g = coque([section((x, 0.03, z), 0.055, 0.062) for z in (0.49, 0.53, 0.57)], math.radians(55), math.radians(125), 0.01, 10)
            Mo.ajouter(g, M["secondaire"], P)
        elif j == "blindees":
            Mo.ajouter(coque([section((x, 0.012, z), 0.085, 0.09) for z in (0.62, 0.72, 0.84)], math.radians(10), math.radians(170), 0.016, 16), M["armure"], [f"cuisse_{c}"])
            Mo.ajouter(coque([section((x, 0.012, z), 0.068, 0.072) for z in (0.17, 0.3, 0.44)], math.radians(15), math.radians(165), 0.016, 16), M["armure"], [f"tibia_{c}"])
            Mo.ajouter(coque([section((x, 0.03, z), 0.07, 0.08) for z in (0.48, 0.53, 0.58)], math.radians(35), math.radians(145), 0.02, 14), M["secondaire"], P)
            Mo.ajouter(boite((0.012, 0.012, 0.12), position=(x, 0.095, 0.3)), M["equipe"], [f"tibia_{c}"])


# ===========================================================================
# Assemblage d'un héros et export
# ===========================================================================
def prises_armes():
    """Matrice de la main droite dans le repère de chaque arme (depuis armes.py)."""
    import armes
    from modelage import nouvelle_scene as ns
    res = {}
    ns()
    Mw = armes.materiaux()
    for a in ("pulsar", "fusil", "pistolet", "pompe", "sniper", "couteau"):
        pieces, points = armes.ARMES[a](Mw)
        for A in pieces.values():
            A.bm.free()
        p, y, z = points["main_d"]
        x, y, z = armes.repere_main(y, z)
        Mm = Matrix((x, y, z)).transposed().to_4x4()
        Mm.translation = Vector(p)
        res[a] = Mm
    return res


def construire_heros(id_heros, prises):
    h = HEROS[id_heros]
    h["id"] = id_heros
    nouvelle_scene()
    arm = creer_squelette("Squelette")
    regler_os_armes(arm, prises)
    M = materiaux(h)
    a = h["apparence"]
    prof = profil_torse(a["corps"], a["silhouette"])
    Mo = Modele("Corps", arm)
    ajouter_corps(Mo, h, M, prof)
    ajouter_buste(Mo, h, M, prof)
    ajouter_epaules(Mo, h, M)
    ajouter_jambes(Mo, h, M)
    ajouter_dos(Mo, h, M, prof)
    ajouter_tete(Mo, h, M)
    ajouter_coiffure(Mo, h, M)
    ajouter_barbe(Mo, h, M)
    ajouter_couvre_chef(Mo, h, M)
    obj = Mo.construire()
    os.makedirs(SORTIE, exist_ok=True)
    nb = len(obj.data.polygons)
    exporter_glb(os.path.join(SORTIE, f"{id_heros}.glb"), animations=False)
    return nb


if __name__ == "__main__":
    ids = [a for a in sys.argv[sys.argv.index("--") + 1:] if a in HEROS] if "--" in sys.argv else [a for a in sys.argv[1:] if a in HEROS]
    ids = ids or list(HEROS)
    prises = prises_armes()
    for i in ids:
        n = construire_heros(i, prises)
        print("PERSO OK", i, n, "faces")
