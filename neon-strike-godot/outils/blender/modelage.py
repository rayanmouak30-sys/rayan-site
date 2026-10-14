"""Bibliothèque de modélisation procédurale pour Blender (module bpy) : volumes biseautés, profils extrudés,
cylindres, tubes, assemblage par matériau, squelettes, cinématique inverse et animations exportées en glTF.

Repère Blender : X à droite, Y vers l'avant, Z vers le haut (l'export glTF le convertit pour Godot : -Z avant, Y haut).
Unités : mètres.
"""
import math
import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector, Euler

# ---------------------------------------------------------------------------
# Scène
# ---------------------------------------------------------------------------

def nouvelle_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = 60
    sc.unit_settings.system = "METRIC"
    return sc


def lier(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


_materiaux = {}


def materiau(nom, couleur=(0.5, 0.5, 0.5), metal=0.0, rugosite=0.5, emission=None, force_emission=1.0, alpha=1.0):
    """Matériau Principled (exporté en glTF métal/rugosité). Le nom sert de clé côté Godot (skins)."""
    if nom in bpy.data.materials:
        return bpy.data.materials[nom]
    m = bpy.data.materials.new(nom)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    if len(couleur) == 3:
        couleur = (*couleur, 1.0)
    p.inputs["Base Color"].default_value = couleur
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rugosite
    if emission is not None:
        p.inputs["Emission Color"].default_value = (*emission, 1.0) if len(emission) == 3 else emission
        p.inputs["Emission Strength"].default_value = force_emission
    if alpha < 1.0:
        p.inputs["Alpha"].default_value = alpha
        m.blend_method = "BLEND" if hasattr(m, "blend_method") else None
    return m


def hexa(h):
    """'#rrggbb' -> couleur linéaire Blender"""
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)


# ---------------------------------------------------------------------------
# Construction par morceaux : chaque pièce est un bmesh transformé puis ajouté à un "Assemblage"
# qui regroupe la géométrie par matériau dans un seul objet.
# ---------------------------------------------------------------------------

def _transformer(bm, position=(0, 0, 0), rotation=(0, 0, 0), echelle=None):
    M = Matrix.Translation(Vector(position)) @ Euler(rotation, "XYZ").to_matrix().to_4x4()
    if echelle is not None:
        if isinstance(echelle, (int, float)):
            echelle = (echelle, echelle, echelle)
        M = M @ Matrix.Diagonal((*echelle, 1.0))
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    return bm


def _biseauter(bm, largeur, segments=2, angle_min=25.0):
    if largeur <= 0:
        return bm
    bm.edges.ensure_lookup_table()
    aretes = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(angle_min)]
    if aretes:
        bmesh.ops.bevel(bm, geom=aretes, offset=largeur, offset_type="OFFSET", segments=segments, profile=0.5, affect="EDGES", clamp_overlap=True)
    return bm


def boite(dims, position=(0, 0, 0), rotation=(0, 0, 0), biseau=0.0, segments=2):
    """Boîte de dimensions (x, y, z), centrée, avec biseau sur les arêtes."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(dims), verts=bm.verts)
    _biseauter(bm, min(biseau, min(dims) * 0.45), segments)
    return _transformer(bm, position, rotation)


def cylindre(rayon, longueur, axe="Y", position=(0, 0, 0), rotation=(0, 0, 0), segments=24, biseau=0.0, rayon2=None, ferme=True):
    """Cylindre (ou cône si rayon2) orienté selon l'axe donné, centré."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=ferme, cap_tris=False, segments=segments, radius1=rayon, radius2=rayon if rayon2 is None else rayon2, depth=longueur)
    if biseau > 0:
        _biseauter(bm, min(biseau, rayon * 0.4, longueur * 0.3), 2, 30)
    if axe == "Y":
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 4, "X"))
    elif axe == "X":
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 4, "Y"))
    return _transformer(bm, position, rotation)


def sphere(rayon, position=(0, 0, 0), echelle=None, segments=16, anneaux=10, rotation=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=anneaux, radius=rayon)
    return _transformer(bm, position, rotation, echelle)


def tore(rayon, epaisseur, axe="Y", position=(0, 0, 0), segments=24, segments_tube=8):
    bm = bmesh.new()
    verts_anneau = []
    for i in range(segments):
        a = 2 * math.pi * i / segments
        anneau = []
        for j in range(segments_tube):
            b = 2 * math.pi * j / segments_tube
            r = rayon + epaisseur * math.cos(b)
            anneau.append(bm.verts.new((r * math.cos(a), r * math.sin(a), epaisseur * math.sin(b))))
        verts_anneau.append(anneau)
    for i in range(segments):
        a1, a2 = verts_anneau[i], verts_anneau[(i + 1) % segments]
        for j in range(segments_tube):
            bm.faces.new((a1[j], a2[j], a2[(j + 1) % segments_tube], a1[(j + 1) % segments_tube]))
    if axe == "Y":
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 4, "X"))
    elif axe == "X":
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 4, "Y"))
    return _transformer(bm, position)


def profil(points, epaisseur, biseau=0.002, position=(0, 0, 0), rotation=(0, 0, 0), segments=2, trous=None):
    """Polygone dessiné vu de côté : points (avant, haut) en mètres, extrudé sur X (épaisseur centrée).
    'avant' = +Y Blender (vers la bouche du canon)."""
    bm = bmesh.new()
    vs = [bm.verts.new((-epaisseur / 2, p[0], p[1])) for p in points]
    face = bm.faces.new(vs)
    bmesh.ops.recalc_face_normals(bm, faces=[face])
    res = bmesh.ops.extrude_face_region(bm, geom=[face])
    nouveaux = [g for g in res["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=nouveaux, vec=(epaisseur, 0, 0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if trous:
        for t in trous:
            _percer(bm, t, epaisseur)
    _biseauter(bm, biseau, segments, 20)
    return _transformer(bm, position, rotation)


def _percer(bm, trou, epaisseur):
    """Trou traversant (polygone sur Y/Z) : boolean par coupe simple via bmesh (approche : soustraction convexe)."""
    coupeur = profil(trou, epaisseur * 3, 0.0)
    _boolean_bmesh(bm, coupeur, "DIFFERENCE")


def _boolean_bmesh(bm, bm_coupe, operation):
    """Boolean entre deux bmesh via des objets temporaires (modificateur Boolean, solveur exact)."""
    me_a = bpy.data.meshes.new("_a"); bm.to_mesh(me_a)
    me_b = bpy.data.meshes.new("_b"); bm_coupe.to_mesh(me_b)
    oa = lier(bpy.data.objects.new("_a", me_a))
    ob = lier(bpy.data.objects.new("_b", me_b))
    mod = oa.modifiers.new("bool", "BOOLEAN")
    mod.object = ob
    mod.operation = operation
    mod.solver = "EXACT"
    dg = bpy.context.evaluated_depsgraph_get()
    ev = oa.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    bm.clear()
    bm.from_mesh(me)
    for o in (oa, ob):
        bpy.data.objects.remove(o, do_unlink=True)
    for m in (me_a, me_b, me):
        bpy.data.meshes.remove(m)
    bm_coupe.free()
    return bm


def soustraire(bm, *coupes):
    for c in coupes:
        _boolean_bmesh(bm, c, "DIFFERENCE")
    return bm


def tube(points, rayon, segments=8, resolution=6):
    """Tube lisse passant par des points (câbles, tuyaux)."""
    courbe = bpy.data.curves.new("_tube", "CURVE")
    courbe.dimensions = "3D"
    courbe.bevel_depth = rayon
    courbe.bevel_resolution = max(1, segments // 4)
    courbe.resolution_u = resolution
    s = courbe.splines.new("BEZIER")
    s.bezier_points.add(len(points) - 1)
    for bp, p in zip(s.bezier_points, points):
        bp.co = Vector(p)
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    o = lier(bpy.data.objects.new("_tube", courbe))
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    bm = bmesh.new()
    bm.from_mesh(me)
    bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.curves.remove(courbe)
    bpy.data.meshes.remove(me)
    return bm


def revolution(points, segments=24, axe="Y", position=(0, 0, 0)):
    """Surface de révolution : points (rayon, abscisse le long de l'axe)."""
    bm = bmesh.new()
    anneaux = []
    for i in range(segments):
        a = 2 * math.pi * i / segments
        anneaux.append([bm.verts.new((r * math.cos(a), x, r * math.sin(a))) for r, x in points])
    for i in range(segments):
        a1, a2 = anneaux[i], anneaux[(i + 1) % segments]
        for j in range(len(points) - 1):
            bm.faces.new((a1[j], a1[j + 1], a2[j + 1], a2[j]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if axe == "Z":
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(-90), 4, "X"))
    elif axe == "X":
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(-90), 4, "Z"))
    return _transformer(bm, position)


def copie(bm):
    b = bm.copy()
    return b


class Assemblage:
    """Regroupe des pièces (bmesh) par matériau puis crée un seul objet Blender lissé."""

    def __init__(self, nom):
        self.nom = nom
        self.bm = bmesh.new()
        self.mats = []

    def ajouter(self, bm_piece, mat, position=None, rotation=None):
        if position is not None or rotation is not None:
            _transformer(bm_piece, position or (0, 0, 0), rotation or (0, 0, 0))
        if mat.name not in [m.name for m in self.mats]:
            self.mats.append(mat)
        idx = [m.name for m in self.mats].index(mat.name)
        me = bpy.data.meshes.new("_p")
        bm_piece.to_mesh(me)
        n0 = len(self.bm.faces)
        self.bm.from_mesh(me)
        self.bm.faces.ensure_lookup_table()
        for f in self.bm.faces[n0:]:
            f.material_index = idx
        bpy.data.meshes.remove(me)
        bm_piece.free()
        return self

    def construire(self, angle_lissage=35.0, uv=True):
        me = bpy.data.meshes.new(self.nom)
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        if uv:
            _uv_cubique(self.bm)
        self.bm.to_mesh(me)
        self.bm.free()
        for m in self.mats:
            me.materials.append(m)
        for p in me.polygons:
            p.use_smooth = True
        me.set_sharp_from_angle(angle=math.radians(angle_lissage))
        return lier(bpy.data.objects.new(self.nom, me))


def _uv_cubique(bm, echelle=4.0):
    """Projection UV cubique simple (les détails de surface sont surtout en triplanaire dans Godot)."""
    couche = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            co = l.vert.co
            if ax == 0:
                u, v = co.y, co.z
            elif ax == 1:
                u, v = co.x, co.z
            else:
                u, v = co.x, co.y
            l[couche].uv = (u * echelle, v * echelle)


# ---------------------------------------------------------------------------
# Squelettes, parentage et animations
# ---------------------------------------------------------------------------

def armature(nom, os_def):
    """os_def : liste de (nom, tete, queue, parent, deforme, roulis). Crée l'armature en mode édition."""
    arm = bpy.data.armatures.new(nom)
    obj = lier(bpy.data.objects.new(nom, arm))
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    for d in os_def:
        nom_os, tete, queue, parent = d[0], d[1], d[2], d[3]
        deforme = d[4] if len(d) > 4 else True
        roulis = d[5] if len(d) > 5 else 0.0
        b = arm.edit_bones.new(nom_os)
        b.head = Vector(tete)
        b.tail = Vector(queue)
        b.roll = roulis
        b.use_deform = deforme
        if parent:
            b.parent = arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in obj.pose.bones:
        pb.rotation_mode = "QUATERNION"
    return obj


def regler_os(arm, matrices):
    """Place des os au repos (mode édition) à des matrices données (espace armature)."""
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for nom, M in matrices.items():
        eb = arm.data.edit_bones[nom]
        longueur = eb.length
        eb.matrix = M
        eb.length = longueur
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"


def parenter_os(obj, arm, nom_os):
    """Attache un objet rigide à un os (il suit l'os sans déformation)."""
    M = obj.matrix_world.copy()
    obj.parent = arm
    obj.parent_type = "BONE"
    obj.parent_bone = nom_os
    bpy.context.view_layer.update()
    obj.matrix_world = M
    return obj


def peau(obj, arm, poids_par_sommet):
    """Peau : poids_par_sommet(co) -> {os: poids}. Ajoute groupes de sommets + modificateur Armature."""
    groupes = {}
    for i, v in enumerate(obj.data.vertices):
        co = obj.matrix_world @ v.co
        for nom_os, w in poids_par_sommet(co).items():
            if w <= 1e-4:
                continue
            if nom_os not in groupes:
                groupes[nom_os] = obj.vertex_groups.new(name=nom_os)
            groupes[nom_os].add([i], w, "REPLACE")
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    M = obj.matrix_world.copy()
    obj.parent = arm
    obj.matrix_world = M
    return obj


def poids_segments(segments, rayon_fondu=0.03, max_os=2):
    """Fonction de poids : segments = [(nom_os, a, b)] en coordonnées monde. Poids selon la distance aux segments."""
    segs = [(n, Vector(a), Vector(b)) for n, a, b in segments]

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
            w = math.exp(-((dist - dmin) / rayon_fondu) ** 2)
            res[n] = res.get(n, 0) + w
        s = sum(res.values())
        return {n: w / s for n, w in res.items()}
    return f


def matrice_os(arm, nom):
    """Matrice de repos de l'os (espace armature)."""
    return arm.data.bones[nom].matrix_local.copy()


def poser(arm, nom, M_armature):
    """Place l'os à la matrice voulue (espace armature) puis met à jour la scène."""
    pb = arm.pose.bones[nom]
    pb.matrix = M_armature
    bpy.context.view_layer.update()


def cle(arm, noms, image):
    for n in noms:
        pb = arm.pose.bones[n]
        pb.keyframe_insert("location", frame=image)
        pb.keyframe_insert("rotation_quaternion", frame=image)
        pb.keyframe_insert("scale", frame=image)


def ik_deux_os(epaule, longueur1, longueur2, cible, pole):
    """Cinématique inverse analytique : renvoie la position du coude (espace armature)."""
    epaule, cible, pole = Vector(epaule), Vector(cible), Vector(pole)
    d = cible - epaule
    dist = max(abs(longueur1 - longueur2) + 1e-4, min(d.length, longueur1 + longueur2 - 1e-4))
    d.normalize()
    w = pole - epaule
    w = w - d * w.dot(d)
    if w.length < 1e-6:
        w = Vector((0, 0, -1))
    w.normalize()
    cos_a = max(-1, min(1, (longueur1 ** 2 + dist ** 2 - longueur2 ** 2) / (2 * longueur1 * dist)))
    a = math.acos(cos_a)
    u = d * math.cos(a) + w * math.sin(a)
    return epaule + u * longueur1, epaule + d * dist


def matrice_visee(origine, direction, haut):
    """Matrice d'os dont l'axe Y (Blender : axe de l'os) pointe vers 'direction', Z proche de 'haut'."""
    y = Vector(direction).normalized()
    z = Vector(haut)
    z = (z - y * z.dot(y))
    if z.length < 1e-6:
        z = Vector((0, 0, 1)) if abs(y.z) < 0.9 else Vector((1, 0, 0))
        z = (z - y * z.dot(y))
    z.normalize()
    x = y.cross(z)
    M = Matrix((x, y, z)).transposed().to_4x4()
    M.translation = Vector(origine)
    return M


def piste_nla(arm, action, nom):
    """Range l'action dans une piste NLA nommée (chaque piste devient une animation glTF)."""
    if arm.animation_data is None:
        arm.animation_data_create()
    piste = arm.animation_data.nla_tracks.new()
    piste.name = nom
    debut = int(action.frame_range[0])
    piste.strips.new(nom, debut, action)
    piste.mute = False
    return piste


def nouvelle_action(arm, nom):
    if arm.animation_data is None:
        arm.animation_data_create()
    a = bpy.data.actions.new(nom)
    a.use_fake_user = True
    arm.animation_data.action = a
    return a


def finir_action(arm, action, nom, interpolation="BEZIER"):
    # Blender 4.4+ : animations par couches (slots) ; on parcourt les F-curves accessibles
    courbes = []
    if hasattr(action, "fcurves") and action.fcurves:
        courbes = list(action.fcurves)
    else:
        for couche in getattr(action, "layers", []):
            for bande in couche.strips:
                for sac in getattr(bande, "channelbags", []):
                    courbes.extend(sac.fcurves)
    for fc in courbes:
        for k in fc.keyframe_points:
            k.interpolation = interpolation
    arm.animation_data.action = None
    piste_nla(arm, action, nom)


def exporter_glb(chemin, objets=None, animations=True):
    """Exporte la scène (ou les objets donnés) en .glb pour Godot."""
    if objets is not None:
        for o in bpy.context.scene.objects:
            o.select_set(o in objets)
    bpy.ops.export_scene.gltf(
        filepath=chemin,
        export_format="GLB",
        use_selection=objets is not None,
        export_apply=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_animations=animations,
        export_animation_mode="NLA_TRACKS",
        export_force_sampling=True,
        export_frame_step=1,
        export_skins=True,
        export_all_influences=False,
        export_def_bones=False,
        export_optimize_animation_size=True,
        export_extras=True,
    )
