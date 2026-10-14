"""Bases des personnages : squelette commun, surfaces lissées (lofts), coques, accumulation du maillage
avec les poids de peau, silhouettes (homme / femme, standard / fin / massif).

Repère Blender : le personnage regarde vers +Y, sa droite est +X, haut +Z (Godot : regard vers -Z).
Toutes les tailles sont pour un personnage de référence de 1,80 m ; l'échelle "taille" est appliquée dans Godot.
"""
import math

import bpy
import bmesh
from mathutils import Matrix, Vector

from modelage import lier

# ---------------------------------------------------------------------------
# Squelette
# ---------------------------------------------------------------------------
ANGLE_A = math.radians(40)   # bras en "A" (40° sous l'horizontale) au repos


def _bras(s):
    """Points de la chaîne du bras (s = +1 droite, -1 gauche) en pose A."""
    d = Vector((s * math.cos(ANGLE_A), 0.0, -math.sin(ANGLE_A)))
    epaule = Vector((s * 0.18, -0.01, 1.415))
    coude = epaule + d * 0.285
    poignet = coude + d * 0.255
    main = poignet + d * 0.085
    d1 = main + d * 0.045
    d2 = d1 + d * 0.038
    dos = Vector((s * math.sin(ANGLE_A), 0.0, math.cos(ANGLE_A)))   # dos de la main (vers l'extérieur-haut)
    return epaule, coude, poignet, main, d1, d2, d, dos


def os_perso():
    """Liste (nom, tête, queue, parent, déforme, axe Z voulu)."""
    defs = [
        ("hanches", (0, 0, 0.98), (0, 0, 1.08), None, True, (0, 1, 0)),
        ("ventre", (0, 0, 1.08), (0, 0.005, 1.23), "hanches", True, (0, 1, 0)),
        ("torse", (0, 0.005, 1.23), (0, 0, 1.43), "ventre", True, (0, 1, 0)),
        ("cou", (0, 0, 1.45), (0, 0.012, 1.555), "torse", True, (0, 1, 0)),
        ("tete", (0, 0.012, 1.555), (0, 0.012, 1.76), "cou", True, (0, 1, 0)),
    ]
    for s, c in ((1, "d"), (-1, "g")):
        ep, co, po, ma, d1, d2, d, dos = _bras(s)
        defs += [
            (f"clavicule_{c}", (s * 0.025, 0.0, 1.415), (s * 0.17, -0.01, 1.425), "torse", True, (0, 0, 1)),
            (f"bras_{c}", tuple(ep), tuple(co), f"clavicule_{c}", True, (0, 0, 1)),
            (f"avantbras_{c}", tuple(co), tuple(po), f"bras_{c}", True, (0, 0, 1)),
            (f"main_{c}", tuple(po), tuple(ma), f"avantbras_{c}", True, tuple(dos)),
            (f"doigts1_{c}", tuple(ma), tuple(d1), f"main_{c}", True, tuple(dos)),
            (f"doigts2_{c}", tuple(d1), tuple(d2), f"doigts1_{c}", True, tuple(dos)),
        ]
        pb = po + d * 0.025 + Vector((0, 0.022, 0))
        pd = pb + (d * 0.4 + Vector((0, 1, 0))).normalized() * 0.035
        pf = pd + (d * 0.6 + Vector((0, 1, 0))).normalized() * 0.03
        defs += [
            (f"pouce1_{c}", tuple(pb), tuple(pd), f"main_{c}", True, tuple(dos)),
            (f"pouce2_{c}", tuple(pd), tuple(pf), f"pouce1_{c}", True, tuple(dos)),
            (f"cuisse_{c}", (s * 0.095, 0.0, 0.94), (s * 0.095, 0.012, 0.52), "hanches", True, (0, 1, 0)),
            (f"tibia_{c}", (s * 0.095, 0.012, 0.52), (s * 0.095, -0.005, 0.095), f"cuisse_{c}", True, (0, 1, 0)),
            (f"pied_{c}", (s * 0.095, -0.005, 0.095), (s * 0.1, 0.12, 0.03), f"tibia_{c}", True, (0, 0, 1)),
            (f"orteils_{c}", (s * 0.1, 0.12, 0.03), (s * 0.1, 0.19, 0.028), f"pied_{c}", True, (0, 0, 1)),
        ]
    return defs


ARMES_TENUES = ["pulsar", "fusil", "pistolet", "pompe", "sniper", "couteau"]


def creer_squelette(nom="Squelette"):
    """Armature commune ; les os "arme_<id>" (sans déformation) portent l'arme tenue en main droite."""
    arm_data = bpy.data.armatures.new(nom)
    obj = lier(bpy.data.objects.new(nom, arm_data))
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    for nom_os, tete, queue, parent, deforme, haut in os_perso():
        b = arm_data.edit_bones.new(nom_os)
        b.head = Vector(tete)
        b.tail = Vector(queue)
        b.align_roll(Vector(haut))
        b.use_deform = deforme
        if parent:
            b.parent = arm_data.edit_bones[parent]
            b.use_connect = False
    for a in ARMES_TENUES:
        b = arm_data.edit_bones.new("arme_" + a)
        b.head = arm_data.edit_bones["main_d"].head
        b.tail = b.head + Vector((0, 0.05, 0))
        b.use_deform = False
        b.parent = arm_data.edit_bones["main_d"]
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in obj.pose.bones:
        pb.rotation_mode = "QUATERNION"
    return obj


def regler_os_armes(arm, prises):
    """Place au repos chaque os "arme_<id>" pour que la poignée de l'arme tombe dans la main droite.
    prises[id] = matrice de la main dans le repère de l'arme (Mm)."""
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    Mh = arm.data.edit_bones["main_d"].matrix.copy()
    for a, Mm in prises.items():
        eb = arm.data.edit_bones["arme_" + a]
        L = eb.length
        eb.matrix = Mh @ Mm.inverted()
        eb.length = L
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"


def segments_os(arm, noms=None):
    """Segments (nom, tête, queue) des os déformants pour le calcul des poids."""
    l = []
    for b in arm.data.bones:
        if not b.use_deform:
            continue
        if noms and b.name not in noms:
            continue
        l.append((b.name, b.head_local.copy(), b.tail_local.copy()))
    return l


# ---------------------------------------------------------------------------
# Surfaces : anneaux, lofts, coques
# ---------------------------------------------------------------------------
def _sgn(x):
    return 1.0 if x >= 0 else -1.0


def point_section(sec, a):
    """Point d'une section à l'angle a (0 = +x local, pi/2 = +y local / avant)."""
    c, s = math.cos(a), math.sin(a)
    ex = 2.0 / sec.get("p", 2.0)
    rx = sec["rx"] if c >= 0 else sec.get("rx2", sec["rx"])
    ry = sec["ry"] if s >= 0 else sec.get("ry2", sec["ry"])
    lx = rx * _sgn(c) * abs(c) ** ex
    ly = ry * _sgn(s) * abs(s) ** ex
    return sec["c"] + sec["x"] * lx + sec["y"] * ly


def section(c, rx, ry, ry2=None, x=(1, 0, 0), y=(0, 1, 0), p=2.0, rx2=None):
    d = {"c": Vector(c), "rx": rx, "ry": ry, "x": Vector(x).normalized(), "y": Vector(y).normalized(), "p": p}
    if ry2 is not None:
        d["ry2"] = ry2
    if rx2 is not None:
        d["rx2"] = rx2
    return d


def loft(sections, seg=24, cap0=True, cap1=True, a0=0.0):
    """Surface passant par des sections successives, fermée par des calottes."""
    bm = bmesh.new()
    anneaux = []
    for sec in sections:
        anneaux.append([bm.verts.new(point_section(sec, a0 + 2 * math.pi * i / seg)) for i in range(seg)])
    for r1, r2 in zip(anneaux, anneaux[1:]):
        for i in range(seg):
            j = (i + 1) % seg
            bm.faces.new((r1[i], r1[j], r2[j], r2[i]))
    for cap, r in ((cap0, anneaux[0]), (cap1, anneaux[-1])):
        if cap:
            centre = bm.verts.new(sum((v.co for v in r), Vector()) / len(r))
            for i in range(seg):
                bm.faces.new((r[i], r[(i + 1) % seg], centre))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def membre(points, rayons, haut=(0, 0, 1), seg=18, aplat=1.0, arrondi=True, p=2.0):
    """Tube le long d'une polyligne avec un rayon par point ; extrémités arrondies."""
    pts = [Vector(q) for q in points]
    secs = []
    n = len(pts)
    for i, (q, r) in enumerate(zip(pts, rayons)):
        if i == 0:
            t = (pts[1] - pts[0])
        elif i == n - 1:
            t = (pts[-1] - pts[-2])
        else:
            t = (pts[i + 1] - pts[i - 1])
        t.normalize()
        h = Vector(haut)
        h = (h - t * h.dot(t))
        if h.length < 1e-5:
            h = Vector((1, 0, 0)) - t * t.x
        h.normalize()
        x = t.cross(h)
        secs.append(section(q, r, r * aplat, x=x, y=h, p=p))
    if arrondi:
        # Calottes arrondies : sections supplémentaires qui se referment
        t0 = (pts[0] - pts[1]).normalized()
        t1 = (pts[-1] - pts[-2]).normalized()
        debut, fin = [], []
        for k, f in ((1, 0.8), (2, 0.45)):
            s0 = dict(secs[0])
            s0["c"] = secs[0]["c"] + t0 * secs[0]["rx"] * (0.35 if k == 1 else 0.7)
            s0["rx"] = secs[0]["rx"] * f
            s0["ry"] = secs[0]["ry"] * f
            debut.insert(0, s0)
            s1 = dict(secs[-1])
            s1["c"] = secs[-1]["c"] + t1 * secs[-1]["rx"] * (0.35 if k == 1 else 0.7)
            s1["rx"] = secs[-1]["rx"] * f
            s1["ry"] = secs[-1]["ry"] * f
            fin.append(s1)
        secs = debut + secs + fin
    return loft(secs, seg)


def coque(sections, a0, a1, epaisseur, nseg=16, biseau=True):
    """Coque partielle (plaque d'armure épousant une surface) entre les angles a0 et a1, épaisseur vers l'extérieur."""
    bm = bmesh.new()
    ext, inte = [], []
    for sec in sections:
        e, i_ = [], []
        for k in range(nseg + 1):
            a = a0 + (a1 - a0) * k / nseg
            p = point_section(sec, a)
            n = (p - sec["c"])
            n = n - sec["x"].cross(sec["y"]) * n.dot(sec["x"].cross(sec["y"]))
            n.normalize()
            # Bords amincis : la coque s'affine vers ses bords
            bord = min(k, nseg - k) / max(1, nseg * 0.12)
            ep = epaisseur * (0.55 + 0.45 * min(1.0, bord))
            e.append(bm.verts.new(p + n * ep))
            i_.append(bm.verts.new(p))
        ext.append(e)
        inte.append(i_)
    S = len(sections)
    for j in range(S - 1):
        for k in range(nseg):
            bm.faces.new((ext[j][k], ext[j][k + 1], ext[j + 1][k + 1], ext[j + 1][k]))
            bm.faces.new((inte[j][k], inte[j + 1][k], inte[j + 1][k + 1], inte[j][k + 1]))
    for j in range(S - 1):
        bm.faces.new((ext[j][0], ext[j + 1][0], inte[j + 1][0], inte[j][0]))
        bm.faces.new((ext[j][nseg], inte[j][nseg], inte[j + 1][nseg], ext[j + 1][nseg]))
    for k in range(nseg):
        bm.faces.new((ext[0][k], inte[0][k], inte[0][k + 1], ext[0][k + 1]))
        bm.faces.new((ext[S - 1][k], ext[S - 1][k + 1], inte[S - 1][k + 1], inte[S - 1][k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if biseau:
        bm.edges.ensure_lookup_table()
        aretes = [ed for ed in bm.edges if len(ed.link_faces) == 2 and ed.calc_face_angle(0) > math.radians(50)]
        if aretes:
            bmesh.ops.bevel(bm, geom=aretes, offset=epaisseur * 0.3, offset_type="OFFSET", segments=1, affect="EDGES", clamp_overlap=True)
    return bm


def bande(sections, a0, a1, largeur_h, epaisseur, nseg=24):
    """Sangle / ceinture : bande fine sur la surface (une section, centrée), entre deux angles."""
    sec = sections
    s_haut = dict(sec)
    s_bas = dict(sec)
    n = sec["x"].cross(sec["y"]).normalized()
    s_haut["c"] = sec["c"] + n * largeur_h * 0.5
    s_bas["c"] = sec["c"] - n * largeur_h * 0.5
    return coque([s_bas, s_haut], a0, a1, epaisseur, nseg, biseau=False)


def transformer(bm, M):
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    return bm


# ---------------------------------------------------------------------------
# Accumulation du maillage du personnage avec poids de peau
# ---------------------------------------------------------------------------
class Modele:
    """Toutes les pièces d'un personnage dans un seul maillage, poids de peau par pièce."""

    def __init__(self, nom, arm):
        self.nom = nom
        self.arm = arm
        self.bm = bmesh.new()
        self.deform = self.bm.verts.layers.deform.verify()
        self.uv = self.bm.loops.layers.uv.verify()
        self.mats = []
        self.os = [b.name for b in arm.data.bones if b.use_deform]
        self.index_os = {n: i for i, n in enumerate(self.os)}
        self.segs = segments_os(arm)

    def poids_auto(self, noms=None, fondu=0.035, max_os=2):
        segs = [s for s in self.segs if (noms is None or s[0] in noms)]

        def f(co):
            d = []
            for n, a, b in segs:
                ab = b - a
                t = max(0.0, min(1.0, (co - a).dot(ab) / max(ab.length_squared, 1e-9)))
                d.append((((a + ab * t) - co).length, n))
            d.sort()
            proches = d[:max_os]
            dmin = proches[0][0]
            res = {}
            for dist, n in proches:
                w = math.exp(-((dist - dmin) / fondu) ** 2)
                res[n] = res.get(n, 0) + w
            s = sum(res.values())
            return {n: w / s for n, w in res.items()}
        return f

    def ajouter(self, piece, mat, poids, uv_echelle=3.0, lisse=True):
        """poids : nom d'os (pièce rigide), liste de noms (poids automatiques restreints) ou fonction co -> {os: w}."""
        if mat.name not in [m.name for m in self.mats]:
            self.mats.append(mat)
        idx = [m.name for m in self.mats].index(mat.name)
        if isinstance(poids, str):
            fonction = None
            fixe = {poids: 1.0}
        elif isinstance(poids, (list, tuple)):
            fonction = self.poids_auto(poids)
            fixe = None
        elif poids is None:
            fonction = self.poids_auto()
            fixe = None
        else:
            fonction = poids
            fixe = None
        me = bpy.data.meshes.new("_p")
        piece.to_mesh(me)
        piece.free()
        nv0 = len(self.bm.verts)
        nf0 = len(self.bm.faces)
        self.bm.from_mesh(me)
        bpy.data.meshes.remove(me)
        self.bm.verts.ensure_lookup_table()
        self.bm.faces.ensure_lookup_table()
        for v in self.bm.verts[nv0:]:
            w = fixe if fixe is not None else fonction(v.co)
            dv = v[self.deform]
            for n, x in w.items():
                if x > 1e-3 and n in self.index_os:
                    dv[self.index_os[n]] = x
        for f in self.bm.faces[nf0:]:
            f.material_index = idx
            f.smooth = lisse
            # UV cubiques (détails de surface : tissus, rayures) en mètres * échelle
            n = f.normal
            ax = max(range(3), key=lambda i: abs(n[i]))
            for l in f.loops:
                co = l.vert.co
                u, v = (co.y, co.z) if ax == 0 else ((co.x, co.z) if ax == 1 else (co.x, co.y))
                l[self.uv].uv = (u * uv_echelle, v * uv_echelle)
        return self

    def construire(self):
        me = bpy.data.meshes.new(self.nom)
        self.bm.to_mesh(me)
        self.bm.free()
        for m in self.mats:
            me.materials.append(m)
        me.set_sharp_from_angle(angle=math.radians(50))
        obj = lier(bpy.data.objects.new(self.nom, me))
        for n in self.os:
            obj.vertex_groups.new(name=n)
        mod = obj.modifiers.new("Armature", "ARMATURE")
        mod.object = self.arm
        obj.parent = self.arm
        return obj


# ---------------------------------------------------------------------------
# Silhouettes : profil du torse et rayons des membres
# ---------------------------------------------------------------------------
# z, décalage avant (cy), demi-largeur (rx), avant (ry), arrière (ry2)
TORSE_H = [
    (0.86, 0.0, 0.13, 0.085, 0.095),
    (0.91, 0.0, 0.162, 0.095, 0.115),
    (0.97, 0.0, 0.168, 0.095, 0.112),
    (1.03, 0.0, 0.158, 0.092, 0.098),
    (1.10, 0.0, 0.152, 0.092, 0.09),
    (1.17, 0.005, 0.158, 0.1, 0.092),
    (1.24, 0.008, 0.172, 0.112, 0.098),
    (1.31, 0.008, 0.183, 0.115, 0.1),
    (1.37, 0.0, 0.19, 0.105, 0.098),
    (1.415, -0.005, 0.178, 0.088, 0.09),
    (1.445, -0.006, 0.142, 0.072, 0.08),
    (1.475, -0.004, 0.095, 0.06, 0.068),
    (1.5, 0.0, 0.066, 0.055, 0.06),
]


def profil_torse(corps, silhouette):
    l = []
    for z, cy, rx, ry, ry2 in TORSE_H:
        k_x, k_y = 1.0, 1.0
        if corps == "massif":
            k_x = 1.16 if z > 1.2 else 1.1
            k_y = 1.15
        elif corps == "fin":
            k_x, k_y = 0.93, 0.92
        if silhouette == "f":
            if z >= 1.3:
                k_x *= 0.88
            elif 1.03 <= z <= 1.17:
                k_x *= 0.86
            elif 0.9 <= z < 1.0:
                k_x *= 1.04
            if 1.22 <= z <= 1.33:
                ry += 0.022 if z < 1.32 else 0.012
                cy += 0.004
        if z > 1.44:
            k_x = min(k_x, 1.05)
        l.append((z, cy, rx * k_x, ry * k_y, ry2 * k_y))
    return l


def sections_torse(profil, gonfle=0.0, z_min=None, z_max=None, avant=0.0, pas=0.03):
    """Sections du torse (gonflées de 'gonfle' mètres pour les vêtements et armures), échantillonnées
    régulièrement entre z_min et z_max (par défaut tout le profil)."""
    z0 = profil[0][0] if z_min is None else z_min
    z1 = profil[-1][0] if z_max is None else z_max
    zs = sorted(set([z0, z1] + [p[0] for p in profil if z0 < p[0] < z1]))
    # complète pour un pas régulier
    fin = []
    for za, zb in zip(zs, zs[1:]):
        n = max(1, int(math.ceil((zb - za) / pas)))
        fin += [za + (zb - za) * k / n for k in range(n)]
    fin.append(zs[-1])
    secs = []
    for z in fin:
        cy, rx, ry, ry2 = interp_torse(profil, z)
        secs.append(section((0, cy, z), rx + gonfle, ry + gonfle + avant, ry2 + gonfle, p=2.2))
    return secs


def interp_torse(profil, z):
    for (z0, *a), (z1, *b) in zip(profil, profil[1:]):
        if z0 <= z <= z1:
            t = (z - z0) / (z1 - z0)
            return tuple(x + (y - x) * t for x, y in zip(a, b))
    return tuple(profil[-1][1:]) if z > profil[-1][0] else tuple(profil[0][1:])


def rayons_membres(corps, silhouette):
    k = {"standard": 1.0, "massif": 1.2, "fin": 0.9}.get(corps, 1.0)
    if silhouette == "f":
        k *= 0.88
    jambe = k * (1.06 if silhouette == "f" else 1.0)
    return {
        "bras": [0.06 * k, 0.053 * k, 0.045 * k],
        "avantbras": [0.044 * k, 0.045 * k, 0.033 * k],
        "cuisse": [0.097 * jambe, 0.082 * jambe, 0.06 * jambe],
        "jambe": [0.057 * jambe, 0.064 * jambe, 0.044 * jambe, 0.039 * jambe],
        "cou": 0.056 * (1.15 if corps == "massif" else (0.88 if silhouette == "f" else 1.0)),
    }
