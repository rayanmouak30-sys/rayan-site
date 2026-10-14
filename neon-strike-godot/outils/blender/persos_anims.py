"""Animations des personnages (squelette commun), calculées image par image puis exportées dans
assets/persos/animations.glb. Godot les partage entre les 20 héros (même squelette, mêmes noms d'os).

Pour chaque arme tenue <a> (pulsar, fusil, pistolet, pompe, sniper, couteau) :
  <a>_repos, <a>_course_av/ar/g/d, <a>_sprint, <a>_accroupi, <a>_accroupi_av/ar/g/d,
  <a>_saut, <a>_chute, <a>_atterrissage, <a>_tir, <a>_rechargement, <a>_equiper, <a>_touche
Communes : mort_avant, mort_arriere, mort_cote
Vitrine (écran de sélection) : vitrine_<pose>_<a> (boucle) et selection_<pose>_<a> (geste quand on choisit le héros)

Méthode : on calcule la matrice de chaque os dans l'espace de l'armature (bassin et colonne en cinématique
directe, jambes et bras en cinématique inverse vers les pieds et la poignée / garde de l'arme), puis on la
convertit en transformation locale (matrix_basis) clé par clé.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Matrix, Vector, Euler, Quaternion  # noqa: E402

from modelage import nouvelle_scene, materiau, boite, exporter_glb, ik_deux_os, matrice_visee, nouvelle_action, finir_action  # noqa: E402
from persos_base import creer_squelette, regler_os_armes, Modele  # noqa: E402

PROJET = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SORTIE = os.path.join(PROJET, "assets", "persos")
FPS = 30
ARMES = ["pulsar", "fusil", "pistolet", "pompe", "sniper", "couteau"]
LONGUES = ("pulsar", "fusil", "pompe", "sniper")
L_BRAS, L_AVBRAS = 0.285, 0.255


def lisse(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def courbe(cles, t):
    if t <= cles[0][0]:
        return cles[0][1]
    for (t0, v0), (t1, v1) in zip(cles, cles[1:]):
        if t <= t1:
            k = lisse((t - t0) / max(t1 - t0, 1e-6))
            if isinstance(v0, (tuple, list)):
                return tuple(a + (b - a) * k for a, b in zip(v0, v1))
            return v0 + (v1 - v0) * k
    return cles[-1][1]


def rot(rx=0.0, ry=0.0, rz=0.0):
    """Rotation (radians) autour des axes de l'armature : X droite, Y avant, Z haut."""
    return (Matrix.Rotation(rz, 3, "Z") @ Matrix.Rotation(ry, 3, "Y") @ Matrix.Rotation(rx, 3, "X"))


def interp_mat(A, B, k):
    la, ra, _ = A.decompose()
    lb, rb, _ = B.decompose()
    M = ra.slerp(rb, k).to_matrix().to_4x4()
    M.translation = la.lerp(lb, k)
    return M


# ===========================================================================
# Squelette : repos et conversion pose -> matrix_basis
# ===========================================================================
class Corps:
    def __init__(self, arm):
        self.arm = arm
        self.repos = {b.name: b.matrix_local.copy() for b in arm.data.bones}
        self.parent = {b.name: (b.parent.name if b.parent else None) for b in arm.data.bones}
        self.ordre = []
        def visiter(b):
            self.ordre.append(b.name)
            for c in b.children:
                visiter(c)
        for b in arm.data.bones:
            if b.parent is None:
                visiter(b)

    def tete(self, nom):
        return self.repos[nom].translation.copy()

    def appliquer(self, poses):
        """poses : {os: matrice armature}. Les os absents suivent leur parent (pose de repos relative)."""
        final = {}
        for n in self.ordre:
            p = self.parent[n]
            if n in poses:
                final[n] = poses[n]
            elif p is None:
                final[n] = self.repos[n]
            else:
                final[n] = final[p] @ self.repos[p].inverted() @ self.repos[n]
        for n in self.ordre:
            pb = self.arm.pose.bones[n]
            p = self.parent[n]
            if p is None:
                base = self.repos[n].inverted() @ final[n]
            else:
                local_repos = self.repos[p].inverted() @ self.repos[n]
                base = local_repos.inverted() @ final[p].inverted() @ final[n]
            pb.matrix_basis = base
        return final


# ===========================================================================
# Description d'une pose
# ===========================================================================
class Pose:
    def __init__(self):
        self.bassin = Vector((0, 0, 0.98))   # position de la tête de l'os "hanches"
        self.bassin_rot = rot()             # rotation du bassin
        self.ventre = rot()
        self.torse = rot()
        self.cou = rot()
        self.tete = rot()
        self.clav = {1: rot(), -1: rot()}
        self.pieds = {}                      # côté -> (cheville, direction du pied, haut du pied, flexion orteils)
        self.arme = None                     # matrice de l'arme dans le repère du torse au repos
        self.main_g = None                   # matrice de la main gauche (armature) ou "garde" (sur l'arme)
        self.main_g_libre = None             # matrice main gauche dans le repère du torse au repos
        self.doigts = {1: 1.0, -1: 0.8}      # flexion des doigts (0 ouverts, 1 serrés)
        self.index_d = 0.2                   # index droit (détente)
        self.genou_pole = {1: Vector((0.25, 1.0, 0.0)), -1: Vector((-0.25, 1.0, 0.0))}


def poser(C, P, prises, id_arme):
    """Calcule toutes les matrices d'os pour la pose P."""
    R = C.repos
    m = {}
    # Bassin et colonne (cinématique directe, rotations dans le repère de l'armature)
    def fk(nom, parent_pose, parent_nom, Rcum):
        tete_rest = R[nom].translation
        if parent_pose is None:
            t = tete_rest
        else:
            t = parent_pose @ R[parent_nom].inverted() @ tete_rest
        M = Matrix.Translation(t) @ (Rcum @ R[nom].to_3x3()).to_4x4()
        return M
    Rh = P.bassin_rot
    m["hanches"] = Matrix.Translation(P.bassin) @ (Rh @ R["hanches"].to_3x3()).to_4x4()
    Rv = Rh @ P.ventre
    m["ventre"] = fk("ventre", m["hanches"], "hanches", Rv)
    Rt = Rv @ P.torse
    m["torse"] = fk("torse", m["ventre"], "ventre", Rt)
    Rc = Rt @ P.cou
    m["cou"] = fk("cou", m["torse"], "torse", Rc)
    m["tete"] = fk("tete", m["cou"], "cou", Rc @ P.tete)
    torse_monde = m["torse"] @ R["torse"].inverted()     # repère "torse au repos" -> pose
    for s, c in ((1, "d"), (-1, "g")):
        m[f"clavicule_{c}"] = fk(f"clavicule_{c}", m["torse"], "torse", Rt @ P.clav[s])
    # Jambes (IK)
    avant = Rh @ Vector((0, 1, 0))
    for s, c in ((1, "d"), (-1, "g")):
        hanche = m["hanches"] @ R["hanches"].inverted() @ R[f"cuisse_{c}"].translation
        cheville, dir_pied, haut_pied, flex = P.pieds[s]
        pole = hanche + (Rh @ P.genou_pole[s]).normalized() * 0.6 + Vector((0, 0, -0.3))
        genou, bout = ik_deux_os(hanche, 0.42, 0.427, cheville, pole)
        m[f"cuisse_{c}"] = matrice_visee(hanche, genou - hanche, avant)
        m[f"tibia_{c}"] = matrice_visee(genou, bout - genou, avant)
        Mp = matrice_visee(bout, dir_pied, haut_pied)
        m[f"pied_{c}"] = Mp
        base_orteils = Mp @ Vector((0, (R[f"orteils_{c}"].translation - R[f"pied_{c}"].translation).length, 0))
        d_orteils = (Mp.to_3x3() @ Matrix.Rotation(flex, 3, "X") @ Vector((0, 1, 0)))
        m[f"orteils_{c}"] = matrice_visee(base_orteils, d_orteils, Mp.to_3x3() @ Matrix.Rotation(flex, 3, "X") @ Vector((0, 0, 1)))
    # Arme et mains
    Mw = None
    if P.arme is not None:
        Mw = torse_monde @ P.arme
        pr = prises[id_arme]
        cible_d = Mw @ pr["Mm"]
        placer_bras(C, m, 1, cible_d, torse_monde)
    if P.main_g is not None or P.main_g_libre is not None:
        if P.main_g == "garde" and Mw is not None and prises[id_arme]["Mg"] is not None:
            cible_g = Mw @ prises[id_arme]["Mg"]
        elif isinstance(P.main_g, Matrix):
            cible_g = P.main_g
        else:
            cible_g = torse_monde @ P.main_g_libre
        placer_bras(C, m, -1, cible_g, torse_monde)
    # Doigts
    for s, c in ((1, "d"), (-1, "g")):
        if f"main_{c}" not in m:
            continue
        f = P.doigts[s]
        Mh = m[f"main_{c}"]
        a1 = -math.radians(75 * f)
        a2 = -math.radians(80 * f)
        d1 = Mh @ R[f"main_{c}"].inverted() @ R[f"doigts1_{c}"] @ Matrix.Rotation(a1, 4, "X")
        m[f"doigts1_{c}"] = d1
        m[f"doigts2_{c}"] = d1 @ R[f"doigts1_{c}"].inverted() @ R[f"doigts2_{c}"] @ Matrix.Rotation(a2, 4, "X")
        p1 = Mh @ R[f"main_{c}"].inverted() @ R[f"pouce1_{c}"] @ Matrix.Rotation(-math.radians(35 * f), 4, "X") @ Matrix.Rotation(s * math.radians(25 * f), 4, "Z")
        m[f"pouce1_{c}"] = p1
        m[f"pouce2_{c}"] = p1 @ R[f"pouce1_{c}"].inverted() @ R[f"pouce2_{c}"] @ Matrix.Rotation(-math.radians(30 * f), 4, "X")
    return m


def placer_bras(C, m, s, M_main, torse_monde):
    c = "d" if s == 1 else "g"
    R = C.repos
    epaule = m[f"clavicule_{c}"] @ R[f"clavicule_{c}"].inverted() @ R[f"bras_{c}"].translation
    poignet = M_main.translation
    # Pôle du coude : vers l'extérieur, le bas et l'arrière du torse
    pole = epaule + torse_monde.to_3x3() @ Vector((s * 0.7, -0.35, -0.6))
    coude, bout = ik_deux_os(epaule, L_BRAS, L_AVBRAS, poignet, pole)
    haut_bras = torse_monde.to_3x3() @ Vector((s * 0.6, 0.1, 1.0))
    m[f"bras_{c}"] = matrice_visee(epaule, coude - epaule, haut_bras)
    dos = M_main.to_3x3() @ Vector((0, 0, 1))
    m[f"avantbras_{c}"] = matrice_visee(coude, bout - coude, dos)
    Mh = M_main.copy()
    Mh.translation = bout
    m[f"main_{c}"] = Mh


# ===========================================================================
# Prises : où sont l'arme et les mains
# ===========================================================================
def prises_armes():
    import armes
    res = {}
    Mw = armes.materiaux()
    for a in ARMES:
        pieces, points = armes.ARMES[a](Mw)
        for A in pieces.values():
            A.bm.free()
        def cadre(pt):
            if pt is None:
                return None
            p, y, z = pt
            x, y, z = armes.repere_main(y, z)
            M = Matrix((x, y, z)).transposed().to_4x4()
            M.translation = Vector(p)
            return M
        res[a] = {"Mm": cadre(points["main_d"]), "Mg": cadre(points.get("main_g")), "chargeur": Vector(points.get("chargeur", (0, 0, 0))),
                  "bouche": Vector(points.get("bouche", (0, 0.5, 0)))}
    return res


def arme_tenue(id_arme, etat="vise"):
    """Matrice de l'arme (origine = poignée) dans le repère du torse au repos."""
    if id_arme == "couteau":
        if etat == "sprint":
            return Matrix.Translation((0.2, 0.12, 1.02)) @ rot(-0.9, 0.0, 0.2).to_4x4()
        return Matrix.Translation((0.17, 0.26, 1.12)) @ rot(-0.3, 0.0, 0.25).to_4x4()
    if id_arme == "pistolet":
        if etat == "sprint":
            return Matrix.Translation((0.2, 0.15, 1.05)) @ rot(-0.8, 0.0, 0.3).to_4x4()
        if etat == "bas":
            return Matrix.Translation((0.12, 0.3, 1.1)) @ rot(-0.55, 0.0, 0.15).to_4x4()
        return Matrix.Translation((0.05, 0.36, 1.3)) @ rot(0.0, 0.0, 0.05).to_4x4()
    if etat == "sprint":
        return Matrix.Translation((0.14, 0.2, 1.16)) @ rot(-0.55, 0.15, 0.75).to_4x4()
    if etat == "bas":
        return Matrix.Translation((0.14, 0.22, 1.13)) @ rot(-0.45, 0.0, 0.25).to_4x4()
    # Visée en épaule : crosse à l'épaule droite, canon vers l'avant
    return Matrix.Translation((0.12, 0.2, 1.27)) @ rot(-0.03, 0.0, 0.0).to_4x4()


# Le torse se tourne légèrement (épaule gauche en avant) quand on tient une arme longue
TORSION = {"pulsar": -0.42, "fusil": -0.42, "pompe": -0.42, "sniper": -0.45, "pistolet": -0.08, "couteau": -0.2}


def pose_base(id_arme, etat="vise"):
    P = Pose()
    tw = TORSION[id_arme] if etat != "sprint" else -0.1
    P.ventre = rot(0, 0, tw * 0.35)
    P.torse = rot(0, 0, tw * 0.65)
    P.cou = rot(0, 0, -tw * 0.5)
    P.tete = rot(0, 0, -tw * 0.5)
    # L'arme est définie dans le repère du torse au repos ; on compense la torsion pour qu'elle vise devant
    P.arme = Matrix.Rotation(-tw, 4, "Z") @ arme_tenue(id_arme, etat)
    if id_arme == "couteau":
        P.main_g = None
        P.main_g_libre = Matrix.Rotation(-tw, 4, "Z") @ Matrix.Translation((-0.12, 0.25, 1.15)) @ rot(0.2, 0.0, 0.0).to_4x4() @ Matrix.Rotation(math.pi / 2, 4, "Y")
        P.doigts = {1: 1.0, -1: 1.0}
    else:
        P.main_g = "garde"
        P.doigts = {1: 1.0, -1: 0.75}
    for s in (1, -1):
        P.pieds[s] = (Vector((s * 0.12, 0.0 if s > 0 else 0.03, 0.095)), Vector((s * 0.15, 1, -0.5)), Vector((0, 0.45, 1)), 0.0)
    return P


# ===========================================================================
# Locomotion
# ===========================================================================
def pied_cycle(u, longueur, hauteur, direction, base, s, ap=0.58):
    """Pied pendant un cycle (u 0..1) : appui 0..ap (le pied recule), puis vol (le pied avance en l'air)."""
    if u < ap:
        k = u / ap
        avance = (0.5 - k) * longueur
        z = 0.0
        flex_t = 0.0
        tangage = 0.0
        if k > 0.75:
            tangage = (k - 0.75) / 0.25 * 0.5   # le talon se lève
    else:
        w = (u - ap) / (1 - ap)
        avance = (-0.5 + lisse(w)) * longueur
        z = hauteur * math.sin(math.pi * w) ** 1.2
        tangage = 0.5 * (1 - w) - 0.15 * math.sin(math.pi * w)
    pos = base + direction * avance + Vector((0, 0, z))
    return pos, tangage


def locomotion(id_arme, t, periode, vitesse, direction, accroupi=False, sprint=False, prises=None):
    P = pose_base(id_arme, "sprint" if sprint else "vise")
    d = Vector(direction).normalized()
    ap = 0.6 if accroupi else (0.36 if sprint else 0.4)
    # Foulée un peu raccourcie (lisible et sans grand écart) ; le moteur déplace le personnage
    longueur = vitesse * periode * ap * (0.6 if accroupi else 0.78)
    phase = t / periode
    hauteur = (0.13 if sprint else 0.1) if not accroupi else 0.07
    z_bassin = 0.98 if not accroupi else 0.74
    rebond = abs(math.sin(2 * math.pi * phase)) * (0.03 if not accroupi else 0.015)
    P.bassin = Vector((0, 0, z_bassin - 0.035 + rebond)) if not accroupi else Vector((0, -0.05, z_bassin + rebond * 0.5))
    pench = (0.18 if sprint else 0.08) if d.y > 0.5 else (0.03 if abs(d.y) < 0.5 else -0.04)
    if accroupi:
        pench += 0.22
    bal = math.sin(2 * math.pi * phase)
    P.bassin_rot = rot(pench * 0.4, 0.04 * bal * (1 if abs(d.x) < 0.5 else 0.3), 0.12 * bal * (d.y if abs(d.y) > 0.5 else 0.3))
    P.ventre = P.ventre @ rot(pench * 0.3, 0, -0.06 * bal)
    P.torse = P.torse @ rot(pench * 0.3, 0, -0.06 * bal)
    if accroupi:
        P.torse = P.torse @ rot(-0.15, 0, 0)
        P.cou = P.cou @ rot(-0.25, 0, 0)
    for s in (1, -1):
        u = (phase + (0.0 if s == 1 else 0.5)) % 1.0
        base = Vector((s * 0.115, 0.0, 0.095))
        if accroupi:
            base = Vector((s * 0.15, -0.02 + (0.12 if s == -1 else -0.08), 0.095))
        pos, tg = pied_cycle(u, longueur, hauteur, d, base, s, ap)
        dir_pied = Vector((s * 0.12, 1, 0))
        dir_pied = (Matrix.Rotation(-tg, 3, Vector((1, 0, 0))) @ dir_pied)
        haut = Matrix.Rotation(-tg, 3, Vector((1, 0, 0))) @ Vector((0, 0.3, 1))
        P.pieds[s] = (pos, dir_pied, haut, tg * 0.9)
        if accroupi:
            P.genou_pole[s] = Vector((s * 0.45, 1.0, 0.2))
    if sprint and id_arme != "couteau":
        P.main_g = "garde"
    if sprint and id_arme == "couteau":
        P.main_g_libre = Matrix.Translation((-0.2, 0.15 + 0.15 * bal, 1.05)) @ rot(-0.5, 0, 0).to_4x4() @ Matrix.Rotation(math.pi / 2, 4, "Y")
    # Respiration et oscillation de l'arme avec la foulée
    if P.arme is not None:
        P.arme = Matrix.Translation((0.005 * bal, 0, 0.008 * abs(bal))) @ P.arme
    return P


def repos(id_arme, t, periode=3.0, accroupi=False):
    P = pose_base(id_arme)
    resp = math.sin(2 * math.pi * t / periode)
    if accroupi:
        P.bassin = Vector((0, -0.06, 0.62))
        P.bassin_rot = rot(0.25, 0, 0)
        P.torse = P.torse @ rot(-0.1, 0, 0)
        P.cou = P.cou @ rot(-0.15, 0, 0)
        P.pieds[1] = (Vector((0.16, 0.12, 0.095)), Vector((0.2, 1, 0)), Vector((0, 0, 1)), 0.0)
        P.pieds[-1] = (Vector((-0.14, -0.22, 0.12)), Vector((-0.1, 1, -0.6)), Vector((0, 0.5, 1)), 0.6)
        P.genou_pole = {1: Vector((0.3, 1.0, 0.3)), -1: Vector((-0.2, 0.4, -0.6))}
    else:
        P.bassin = Vector((0, 0, 0.965 + 0.004 * resp))
        P.pieds[1] = (Vector((0.13, -0.04, 0.095)), Vector((0.35, 1, 0)), Vector((0, 0, 1)), 0.0)
        P.pieds[-1] = (Vector((-0.12, 0.1, 0.095)), Vector((-0.1, 1, 0)), Vector((0, 0, 1)), 0.0)
    P.torse = P.torse @ rot(0.01 * resp, 0, 0)
    P.clav = {1: rot(0, 0.015 * resp, 0), -1: rot(0, -0.015 * resp, 0)}
    if P.arme is not None:
        P.arme = Matrix.Translation((0, 0, 0.004 * resp)) @ P.arme
    return P


def saut(id_arme, t, etat):
    P = pose_base(id_arme)
    if etat == "saut":
        k = lisse(t / 0.35)
        P.bassin = Vector((0, 0, 0.98 + 0.05 * k))
        for s in (1, -1):
            P.pieds[s] = (Vector((s * 0.12, -0.05 * k + (0.1 * k if s == 1 else 0), 0.095 + 0.25 * k + (0.08 * k if s == 1 else 0))), Vector((0, 1, -0.6 * k)), Vector((0, 0.5 * k, 1)), 0.4 * k)
    elif etat == "chute":
        b = math.sin(2 * math.pi * t / 1.0)
        P.bassin = Vector((0, 0, 1.0))
        for s in (1, -1):
            P.pieds[s] = (Vector((s * 0.13, 0.04 * s * b - 0.02, 0.2 + 0.03 * s * b)), Vector((s * 0.1, 1, -0.4)), Vector((0, 0.4, 1)), 0.3)
        P.torse = P.torse @ rot(0.05, 0, 0)
    else:  # atterrissage
        k = math.sin(math.pi * min(1.0, t / 0.4))
        P.bassin = Vector((0, -0.03 * k, 0.98 - 0.16 * k))
        P.bassin_rot = rot(0.12 * k, 0, 0)
        for s in (1, -1):
            P.pieds[s] = (Vector((s * 0.14, 0.02 * s, 0.095)), Vector((s * 0.2, 1, 0)), Vector((0, 0, 1)), 0.0)
            P.genou_pole[s] = Vector((s * 0.4, 1.0, 0.0))
        P.torse = P.torse @ rot(0.08 * k, 0, 0)
    return P


# ===========================================================================
# Actions du haut du corps : tir, rechargement, équiper, touché
# ===========================================================================
def tir(id_arme, t):
    P = repos(id_arme, 0.0)
    d = {"pompe": 0.35, "sniper": 0.45, "pistolet": 0.18}.get(id_arme, 0.14)
    force = {"pompe": 2.2, "sniper": 2.5, "pistolet": 1.3, "couteau": 0.0}.get(id_arme, 1.0)
    k = math.exp(-t / (d * 0.25)) * min(1.0, t / 0.015)
    if id_arme == "couteau":
        # Coup de lame : armé puis estoc en diagonale
        u = t / 0.4
        a = courbe([(0, (0, 0, 0)), (0.25, (0.08, -0.08, 0.1)), (0.5, (-0.1, 0.28, -0.02)), (1, (0, 0, 0))], u)
        r = courbe([(0, (0, 0, 0)), (0.25, (0.4, 0, 0.5)), (0.5, (-0.2, 0, -0.6)), (1, (0, 0, 0))], u)
        P.arme = Matrix.Translation(a) @ P.arme @ rot(*r).to_4x4()
        P.torse = P.torse @ rot(0, 0, courbe([(0, 0), (0.25, -0.25), (0.5, 0.25), (1, 0)], u))
        return P
    P.arme = Matrix.Translation((0, -0.04 * force * k, 0.01 * force * k)) @ P.arme @ rot(0.06 * force * k, 0, 0).to_4x4()
    P.torse = P.torse @ rot(-0.03 * force * k, 0, 0)
    P.index_d = 1.0 if t < 0.06 else 0.2
    if id_arme == "pompe":
        u = t / 0.9
        rec = courbe([(0, 0), (0.3, 0), (0.45, 1), (0.6, 1), (0.75, 0), (1, 0)], u)
        if P.main_g == "garde":
            Mw = P.arme
            P.main_g = None
            P.main_g_libre = Mw @ Matrix.Translation((0, -0.07 * rec, 0)) @ PRISES["pompe"]["Mg"]
    if id_arme == "sniper":
        u = t / 1.35
        lev = courbe([(0, 0), (0.3, 0), (0.42, 1), (0.75, 1), (0.85, 0), (1, 0)], u)
        if lev > 0.01:
            Mw = P.arme
            cible = Mw @ Matrix.Translation((0.06, -0.06 * lev, 0.05)) @ rot(0, 0.6, 1.2).to_4x4()
            Mg = Mw @ PRISES["sniper"]["Mg"]
            P.main_g = None
            P.main_g_libre = interp_mat(Mg, cible, lev)
    return P


def rechargement(id_arme, t, duree):
    P = repos(id_arme, t)
    u = t / duree
    if id_arme == "couteau":
        return P
    Mw0 = P.arme
    incl = courbe([(0, 0), (0.15, 1), (0.82, 1), (1, 0)], u)
    P.arme = Mw0 @ rot(0.12 * incl, -0.45 * incl, 0.25 * incl).to_4x4() @ Matrix.Translation((0, -0.05 * incl, -0.02 * incl))
    pr = PRISES[id_arme]
    Mw = P.arme
    garde = Mw @ pr["Mg"] if pr["Mg"] is not None else None
    chargeur = Mw @ Matrix.Translation(pr["chargeur"] + Vector((-0.03, -0.02, -0.06))) @ rot(0.4, 0, 0.2).to_4x4() @ Matrix.Rotation(math.pi, 4, "Y")
    ceinture = Matrix.Translation((-0.15, 0.1, 1.0)) @ rot(-1.2, 0, 0).to_4x4() @ Matrix.Rotation(math.pi / 2, 4, "Y")
    if id_arme == "pompe":
        port = Mw @ Matrix.Translation(pr["chargeur"] + Vector((-0.02, 0.0, -0.05))) @ Matrix.Rotation(math.pi, 4, "Y")
        cyc = (u - 0.15) / 0.7 * 4
        if 0.15 < u < 0.85:
            f = cyc % 1.0
            cible = interp_mat(ceinture, port, lisse(f / 0.6)) if f < 0.6 else interp_mat(port, ceinture, lisse((f - 0.6) / 0.4))
        else:
            cible = garde
        P.main_g = None
        P.main_g_libre = cible
        return P
    if u < 0.14:
        cible = interp_mat(garde, chargeur, lisse(u / 0.14))
    elif u < 0.3:
        cible = interp_mat(chargeur, ceinture, lisse((u - 0.14) / 0.16))
    elif u < 0.42:
        cible = ceinture
    elif u < 0.6:
        cible = interp_mat(ceinture, chargeur, lisse((u - 0.42) / 0.18))
    elif u < 0.72:
        cible = chargeur
    elif u < 0.86:
        cible = interp_mat(chargeur, garde, lisse((u - 0.72) / 0.14))
    else:
        cible = garde
    P.main_g = None
    P.main_g_libre = cible
    P.doigts[-1] = 0.9
    P.tete = P.tete @ rot(-0.25 * incl, 0, 0.15 * incl)
    return P


def equiper(id_arme, t):
    P = repos(id_arme, 0.0)
    k = lisse(t / 0.45)
    bas = Matrix.Translation((0.2, 0.05, 0.95)) @ rot(-1.3, 0, 0.4).to_4x4()
    P.arme = interp_mat(bas, P.arme, k)
    if id_arme != "couteau" and k < 0.7:
        P.main_g = None
        P.main_g_libre = Matrix.Translation((-0.2, 0.05, 0.98)) @ rot(-0.3, 0, 0).to_4x4() @ Matrix.Rotation(math.pi / 2, 4, "Y")
    return P


def touche(id_arme, t):
    P = repos(id_arme, 0.0)
    k = math.sin(math.pi * min(1.0, t / 0.35)) * math.exp(-t * 2)
    P.torse = P.torse @ rot(-0.25 * k, 0, 0.15 * k)
    P.cou = P.cou @ rot(-0.3 * k, 0, 0)
    P.bassin = P.bassin + Vector((0, -0.03 * k, -0.02 * k))
    return P


def mort(t, sens):
    """Chute : sens 1 en avant, -1 en arrière, 0 sur le côté. Pose finale allongée."""
    P = pose_base("fusil")
    P.arme = None
    P.main_g = None
    u = min(1.0, t / 1.1)
    k = lisse(u)
    genoux = math.sin(math.pi * min(1.0, u * 1.4)) * 0.5
    if sens == 1:
        P.bassin = Vector((0, 0.35 * k, 0.98 - 0.8 * k + 0.1 * math.sin(math.pi * k)))
        P.bassin_rot = rot(1.45 * k, 0, 0.2 * k)
    elif sens == -1:
        P.bassin = Vector((0, -0.4 * k, 0.98 - 0.82 * k + 0.08 * math.sin(math.pi * k)))
        P.bassin_rot = rot(-1.45 * k, 0, -0.2 * k)
    else:
        P.bassin = Vector((0.3 * k, 0.0, 0.98 - 0.82 * k))
        P.bassin_rot = rot(0, 1.45 * k, 0.5 * k)
    P.ventre = rot(0.1 * k * sens, 0, 0)
    P.torse = rot(0.15 * k * sens, 0, 0.2 * k)
    P.cou = rot(0.3 * k * sens, 0, 0.3 * k)
    P.tete = rot(0, 0, 0.3 * k)
    Rh = P.bassin_rot
    for s in (1, -1):
        hanche = P.bassin + Rh @ Vector((s * 0.095, 0, -0.04))
        jambe = Rh @ Vector((s * 0.03, 0.15 * genoux, -0.82 + 0.25 * genoux))
        P.pieds[s] = (hanche + jambe, Rh @ Vector((0, 1, -0.3)), Rh @ Vector((0, 0.3, 1)), 0.3 * k)
        P.genou_pole[s] = Vector((s * 0.3, 1.0, 0.0))
    Rt = Rh @ P.ventre @ P.torse
    torse_c = P.bassin + Rh @ Vector((0, 0, 0.35))
    for s in (1, -1):
        bras = Vector((s * (0.45 + 0.2 * k), 0.1 * k, -0.25 - 0.15 * (1 - k)))
        M = Matrix.Translation(torse_c + Rt @ bras) @ (Rt @ rot(0, s * 0.5, 0)).to_4x4() @ Matrix.Rotation(s * math.pi / 2, 4, "Z")
        if s == 1:
            P.main_d_libre = M
        else:
            P.main_g = M
    P.doigts = {1: 0.35, -1: 0.35}
    return P


# ===========================================================================
# Vitrine (écran de sélection)
# ===========================================================================
def vitrine(id_arme, pose, t, periode=4.0):
    P = repos(id_arme, t, periode)
    resp = math.sin(2 * math.pi * t / periode)
    lent = math.sin(2 * math.pi * t / periode * 0.5)
    tw = TORSION[id_arme]
    if pose == "garde":
        # Arme en travers de la poitrine, canon vers le haut à gauche
        P.arme = Matrix.Translation((0.1, 0.22, 1.12)) @ rot(0.9, 0.0, 0.5).to_4x4() @ rot(0, -0.5, 0).to_4x4()
        P.torse = rot(0, 0, -0.15)
        P.cou = rot(0, 0, 0.1)
        P.tete = rot(-0.05, 0, 0.05)
    elif pose == "pret":
        P.arme = Matrix.Translation((0.14, 0.24, 1.1)) @ rot(-0.55, 0.0, 0.35).to_4x4()
        P.torse = rot(0.04, 0, -0.25)
        P.cou = rot(0, 0, 0.15)
        P.tete = rot(0, 0, 0.1)
    elif pose == "epaule":
        # Arme posée sur l'épaule droite, main gauche sur la hanche
        P.arme = Matrix.Translation((0.2, 0.12, 1.36)) @ rot(1.9, 0.0, 0.25).to_4x4()
        P.main_g = None
        P.main_g_libre = Matrix.Translation((-0.2, 0.02, 1.0)) @ rot(0, 0, 0.3).to_4x4() @ Matrix.Rotation(-math.pi / 2, 4, "Y") @ Matrix.Rotation(math.pi, 4, "Z")
        P.torse = rot(-0.03, 0, 0.0)
        P.bassin_rot = rot(0, -0.06, 0)
        P.doigts[-1] = 0.5
    elif pose == "inspection":
        P.arme = Matrix.Translation((0.05, 0.3, 1.2)) @ rot(0.15, -0.6 + 0.08 * lent, 1.0).to_4x4()
        P.torse = rot(0.06, 0, -0.1)
        P.cou = rot(0.25, 0, 0.15)
        P.tete = rot(0.2, 0, 0.2)
    elif pose == "decontracte":
        P.arme = Matrix.Translation((0.24, 0.06, 0.95)) @ rot(-1.35, 0.0, 0.1).to_4x4()
        P.main_g = None
        P.main_g_libre = Matrix.Translation((-0.19, 0.0, 1.0)) @ rot(0, 0, 0.3).to_4x4() @ Matrix.Rotation(-math.pi / 2, 4, "Y") @ Matrix.Rotation(math.pi, 4, "Z")
        P.bassin = Vector((0.025, 0, 0.965))
        P.bassin_rot = rot(0, 0.07, 0.1)
        P.torse = rot(0, -0.05, -0.05)
        P.tete = rot(0.05, 0.08, 0.15)
        P.pieds[1] = (Vector((0.15, 0.0, 0.095)), Vector((0.4, 1, 0)), Vector((0, 0, 1)), 0.0)
        P.pieds[-1] = (Vector((-0.08, 0.12, 0.095)), Vector((-0.3, 1, 0)), Vector((0, 0, 1)), 0.0)
        P.doigts[-1] = 0.5
    if id_arme == "couteau" and P.main_g == "garde":
        P.main_g = None
        P.main_g_libre = Matrix.Translation((-0.18, 0.12, 1.05)) @ rot(0.3, 0, 0).to_4x4() @ Matrix.Rotation(math.pi / 2, 4, "Y")
    P.torse = P.torse @ rot(0.012 * resp, 0, 0)
    P.tete = P.tete @ rot(0, 0, 0.04 * lent)
    return P


def selection(id_arme, pose, t, duree=1.6):
    """Geste quand on choisit le héros : l'arme est levée et armée, puis retour à la pose de vitrine."""
    u = t / duree
    fin = vitrine(id_arme, pose, t)
    debut = vitrine(id_arme, pose, 0.0)
    k = courbe([(0, 0), (0.3, 1), (0.65, 1), (1, 0)], u)
    if fin.arme is not None:
        haut = Matrix.Translation((0.12, 0.3, 1.38)) @ rot(0.25, 0, 0.0).to_4x4()
        fin.arme = interp_mat(fin.arme, haut, k)
        if id_arme != "couteau":
            fin.main_g = "garde" if k > 0.3 else fin.main_g
            if fin.main_g == "garde":
                fin.main_g_libre = None
    fin.torse = fin.torse @ rot(-0.06 * k, 0, 0.2 * k)
    fin.tete = fin.tete @ rot(-0.08 * k, 0, 0)
    fin.bassin = fin.bassin + Vector((0, 0, -0.03 * math.sin(math.pi * min(1, u * 2))))
    return fin


# ===========================================================================
# Génération
# ===========================================================================
PRISES = {}


def enregistrer(C, nom, duree, fn, id_arme, boucle):
    arm = C.arm
    action = nouvelle_action(arm, nom)
    n = max(2, int(round(duree * FPS)))
    for i in range(n + 1):
        t = min(duree, i / FPS)
        if boucle and i == n:
            t = 0.0
        P = fn(t)
        m = poser(C, P, PRISES, id_arme)
        if hasattr(P, "main_d_libre"):
            placer_bras(C, m, 1, P.main_d_libre, m["torse"] @ C.repos["torse"].inverted())
        C.appliquer(m)
        for pb in arm.pose.bones:
            pb.keyframe_insert("location", frame=i + 1)
            pb.keyframe_insert("rotation_quaternion", frame=i + 1)
    finir_action(arm, action, nom, "LINEAR")


def main(filtre=None):
    global PRISES
    nouvelle_scene()
    bpy.context.scene.render.fps = FPS
    PRISES = prises_armes()
    nouvelle_scene()
    bpy.context.scene.render.fps = FPS
    arm = creer_squelette("Squelette")
    regler_os_armes(arm, {a: PRISES[a]["Mm"] for a in ARMES})
    C = Corps(arm)
    # Petit maillage skinné : nécessaire pour que Godot crée un Skeleton3D
    Mo = Modele("Ancre", arm)
    Mo.ajouter(boite((0.02, 0.02, 0.02), position=(0, 0, 1.0)), materiau("Ancre"), "hanches")
    Mo.construire()
    import json
    heros = json.load(open(os.path.join(PROJET, "assets", "donnees", "heros.json"), encoding="utf-8"))["heros"]
    combos = sorted({(h["pose"], h["arme"]) for h in heros.values()})
    VITESSE = 5.3
    for a in ARMES:
        if filtre and a not in filtre:
            continue
        def ajoute(nom, duree, fn, boucle):
            enregistrer(C, f"{a}_{nom}", duree, fn, a, boucle)
        ajoute("repos", 3.0, lambda t: repos(a, t), True)
        per = 0.66
        for suffixe, d in (("av", (0, 1, 0)), ("ar", (0, -1, 0)), ("g", (-1, 0, 0)), ("d", (1, 0, 0))):
            ajoute("course_" + suffixe, per, lambda t, d=d: locomotion(a, t, per, VITESSE * (0.85 if d[1] < 0 else 1.0), d), True)
            ajoute("accroupi_" + suffixe, 0.8, lambda t, d=d: locomotion(a, t, 0.8, 2.6, d, accroupi=True), True)
        ajoute("sprint", 0.6, lambda t: locomotion(a, t, 0.6, 7.0, (0, 1, 0), sprint=True), True)
        ajoute("accroupi", 3.0, lambda t: repos(a, t, 3.0, accroupi=True), True)
        ajoute("saut", 0.35, lambda t: saut(a, t, "saut"), False)
        ajoute("chute", 1.0, lambda t: saut(a, t, "chute"), True)
        ajoute("atterrissage", 0.4, lambda t: saut(a, t, "atterrissage"), False)
        d_tir = {"pompe": 0.9, "sniper": 1.35, "couteau": 0.4}.get(a, 0.2)
        ajoute("tir", d_tir, lambda t: tir(a, t), False)
        if a != "couteau":
            d_rech = {"pompe": 2.4, "sniper": 2.9, "pistolet": 1.5}.get(a, 2.1)
            ajoute("rechargement", d_rech, lambda t, d_rech=d_rech: rechargement(a, t, d_rech), False)
        ajoute("equiper", 0.5, lambda t: equiper(a, t), False)
        ajoute("touche", 0.4, lambda t: touche(a, t), False)
        for pose, arme in combos:
            if arme != a:
                continue
            ajoute(f"vitrine_{pose}", 4.0, lambda t, pose=pose: vitrine(a, pose, t), True)
            ajoute(f"selection_{pose}", 1.6, lambda t, pose=pose: selection(a, pose, t), False)
        print("ANIMS OK", a)
    if not filtre:
        for nom, sens in (("mort_avant", 1), ("mort_arriere", -1), ("mort_cote", 0)):
            enregistrer(C, nom, 1.4, lambda t, sens=sens: mort(t, sens), "fusil", False)
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    os.makedirs(SORTIE, exist_ok=True)
    exporter_glb(os.path.join(SORTIE, "animations.glb" if not filtre else "animations_test.glb"))


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    main([a for a in args if a in ARMES] or None)
