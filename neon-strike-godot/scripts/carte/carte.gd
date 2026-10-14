class_name Carte
extends Node3D
## Base des cartes : outils de construction (blocs, rampes, escaliers, vitres, néons, décors),
## points d'apparition, sites de pose, lumières et environnement. Chaque carte hérite et remplit construire().

var nom_carte := "Carte"
var apparitions := {"bleu": [], "rouge": []}   # Array[Transform3D]
var sites := {}                                # "A" -> {centre: Vector3, rayon: float}
var zones := []                                # noms de zones pour l'interface (callouts) : [nom, AABB]
var points_couvert: Array[Vector3] = []        # positions abritées utilisées par les bots
var env: Environment
var soleil: DirectionalLight3D
var ambiance_vue := Color(0.62, 0.68, 0.78)    # lumière des bras en vue FPS
var energie_vue := 0.55
var limites := AABB(Vector3(-60, -10, -60), Vector3(120, 40, 120))
var navigation: NavigationRegion3D
var _statiques: Node3D


func _ready() -> void:
	_statiques = Node3D.new()
	_statiques.name = "Geometrie"
	add_child(_statiques)
	construire()
	_preparer_navigation()


func construire() -> void:
	pass


# --- Outils de construction -------------------------------------------------

## Bloc plein (sol, mur, caisse...) : centre, taille, matériau ; renvoie le corps statique
func bloc(centre: Vector3, taille: Vector3, materiau := "beton", rot_y := 0.0, teinte := Color(1, 1, 1), collision := true) -> StaticBody3D:
	var corps := StaticBody3D.new()
	corps.collision_layer = Combattant.COUCHE_MONDE
	corps.collision_mask = 0
	corps.set_meta("matiere", Materiaux.matiere(materiau))
	corps.position = centre
	corps.rotation.y = rot_y
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = taille
	mi.mesh = bm
	mi.material_override = Materiaux.obtenir(materiau, teinte)
	corps.add_child(mi)
	if collision:
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = taille
		cs.shape = bs
		corps.add_child(cs)
	_statiques.add_child(corps)
	return corps


## Rampe : de "bas" (centre du bord bas) à "haut" (centre du bord haut), largeur et épaisseur
func rampe(bas: Vector3, haut: Vector3, largeur: float, materiau := "beton", epaisseur := 0.3) -> StaticBody3D:
	var d := haut - bas
	var longueur := d.length()
	var centre := (bas + haut) * 0.5 - Vector3.UP * epaisseur * 0.5
	var avant := d.normalized()
	var cote := Vector3.UP.cross(avant).normalized()
	var haut_v := avant.cross(cote).normalized()
	var corps := StaticBody3D.new()
	corps.collision_layer = Combattant.COUCHE_MONDE
	corps.set_meta("matiere", Materiaux.matiere(materiau))
	corps.transform = Transform3D(Basis(cote, haut_v, -avant), centre)
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(largeur, epaisseur, longueur)
	mi.mesh = bm
	mi.material_override = Materiaux.obtenir(materiau)
	corps.add_child(mi)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = bm.size
	cs.shape = bs
	corps.add_child(cs)
	_statiques.add_child(corps)
	return corps


## Escalier : marches visibles, collision en rampe (déplacement fluide)
func escalier(bas: Vector3, haut: Vector3, largeur: float, materiau := "beton") -> void:
	var d := haut - bas
	var n := maxi(2, int(round(d.y / 0.2)))
	var horiz := Vector3(d.x, 0, d.z)
	var pas_h := horiz / n
	var pas_v := d.y / n
	var rot := atan2(-horiz.x, -horiz.z)
	for i in n:
		var h := pas_v * (i + 1)
		var c := bas + pas_h * (i + 0.5) + Vector3.UP * h * 0.5
		bloc(c, Vector3(largeur, h, pas_h.length() + 0.01), materiau, rot, Color(1, 1, 1), false)
	var r := rampe(bas, haut, largeur, materiau, 0.1)
	(r.get_child(0) as MeshInstance3D).visible = false


## Vitre : bloque les déplacements, laisse passer la vue, les balles la traversent
func vitre(centre: Vector3, taille: Vector3, rot_y := 0.0) -> void:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = taille
	mi.mesh = bm
	mi.material_override = Materiaux.obtenir("verre")
	mi.position = centre
	mi.rotation.y = rot_y
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_statiques.add_child(mi)
	var corps := StaticBody3D.new()
	corps.collision_layer = Combattant.COUCHE_COMBATTANTS  # bloque les joueurs uniquement
	corps.collision_mask = 0
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = taille
	cs.shape = bs
	corps.add_child(cs)
	corps.position = centre
	corps.rotation.y = rot_y
	_statiques.add_child(corps)


## Bande lumineuse (néon) avec une vraie lumière si demandé
func neon(centre: Vector3, taille: Vector3, couleur: Color, force := 3.0, lumiere := 0.0, portee := 6.0) -> void:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = taille
	mi.mesh = bm
	mi.material_override = Materiaux.neon(couleur, force)
	mi.position = centre
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_statiques.add_child(mi)
	if lumiere > 0.0:
		var l := OmniLight3D.new()
		l.light_color = couleur
		l.light_energy = lumiere
		l.omni_range = portee
		l.omni_attenuation = 1.2
		l.shadow_enabled = false
		l.position = centre
		_statiques.add_child(l)


func lampe(pos: Vector3, couleur := Color(1.0, 0.86, 0.68), energie := 2.0, portee := 9.0, ombres := false) -> OmniLight3D:
	var l := OmniLight3D.new()
	l.light_color = couleur
	l.light_energy = energie
	l.omni_range = portee
	l.shadow_enabled = ombres
	l.position = pos
	_statiques.add_child(l)
	return l


## Décor modélisé (glb) avec collisions générées si demandé
func decor(chemin: String, pos: Vector3, rot_y := 0.0, echelle := 1.0, collision := true, matiere := "metal") -> Node3D:
	if not ResourceLoader.exists(chemin):
		return null
	var n: Node3D = (load(chemin) as PackedScene).instantiate()
	n.position = pos
	n.rotation.y = rot_y
	n.scale = Vector3.ONE * echelle
	_statiques.add_child(n)
	if collision:
		for mi in n.find_children("*", "MeshInstance3D", true, false):
			var m := mi as MeshInstance3D
			if m.name.ends_with("_nocol"):
				continue
			var corps := StaticBody3D.new()
			corps.collision_layer = Combattant.COUCHE_MONDE
			corps.set_meta("matiere", matiere)
			var cs := CollisionShape3D.new()
			cs.shape = m.mesh.create_convex_shape(true, true) if m.name.ends_with("_convexe") else m.mesh.create_trimesh_shape()
			corps.add_child(cs)
			m.add_child(corps)
	return n


func apparition(equipe: String, pos: Vector3, regard_vers: Vector3) -> void:
	var t := Transform3D(Basis.IDENTITY, pos)
	var d := regard_vers - pos
	t.basis = Basis(Vector3.UP, atan2(-d.x, -d.z))
	if not apparitions.has(equipe):
		apparitions[equipe] = []
	apparitions[equipe].append(t)


func site(nom: String, centre: Vector3, rayon: float) -> void:
	sites[nom] = {"centre": centre, "rayon": rayon}


func zone(nom: String, centre: Vector3, taille: Vector3) -> void:
	zones.append([nom, AABB(centre - taille * 0.5, taille)])


## Nom de la zone où se trouve une position (affiché dans l'interface)
func nom_zone(p: Vector3) -> String:
	for z in zones:
		if (z[1] as AABB).has_point(p):
			return z[0]
	return ""


## Environnement : ciel procédural, brouillard, lumière, réglages selon la qualité
func ambiance(ciel_haut: Color, ciel_horizon: Color, sol: Color, soleil_couleur: Color, soleil_force: float, soleil_rot: Vector3, brouillard := 0.004) -> void:
	var we := WorldEnvironment.new()
	env = Environment.new()
	var ciel := Sky.new()
	var mat := ProceduralSkyMaterial.new()
	mat.sky_top_color = ciel_haut
	mat.sky_horizon_color = ciel_horizon
	mat.ground_horizon_color = ciel_horizon
	mat.ground_bottom_color = sol
	mat.sun_angle_max = 20.0
	ciel.sky_material = mat
	env.background_mode = Environment.BG_SKY
	env.sky = ciel
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.9
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.tonemap_exposure = 1.0
	env.fog_enabled = brouillard > 0.0
	env.fog_light_color = ciel_horizon
	env.fog_density = brouillard
	env.fog_sky_affect = 0.3
	env.adjustment_enabled = true
	env.adjustment_brightness = float(Reglages.lire("luminosite"))
	env.adjustment_contrast = 1.05
	env.adjustment_saturation = 1.05
	Reglages.appliquer_environnement(env)
	we.environment = env
	add_child(we)
	soleil = DirectionalLight3D.new()
	soleil.light_color = soleil_couleur
	soleil.light_energy = soleil_force
	soleil.rotation_degrees = soleil_rot
	soleil.shadow_enabled = true
	soleil.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS
	soleil.directional_shadow_max_distance = 90.0
	soleil.shadow_bias = 0.03
	soleil.shadow_normal_bias = 1.2
	soleil.shadow_blur = 1.2
	add_child(soleil)


func _preparer_navigation() -> void:
	navigation = NavigationRegion3D.new()
	navigation.name = "Navigation"
	var nm := NavigationMesh.new()
	nm.geometry_parsed_geometry_type = NavigationMesh.PARSED_GEOMETRY_STATIC_COLLIDERS
	nm.geometry_collision_mask = Combattant.COUCHE_MONDE | Combattant.COUCHE_COMBATTANTS
	nm.agent_radius = 0.4
	nm.agent_height = 1.75
	nm.agent_max_climb = 0.45
	nm.agent_max_slope = 46.0
	nm.cell_size = 0.2
	nm.cell_height = 0.1
	nm.geometry_source_geometry_mode = NavigationMesh.SOURCE_GEOMETRY_GROUPS_WITH_CHILDREN
	nm.geometry_source_group_name = &"navigation"
	navigation.navigation_mesh = nm
	add_child(navigation)
	_statiques.add_to_group(&"navigation")
	# Cuisson en arrière-plan ; les bots attendent la fin (signal bake_finished)
	navigation.bake_navigation_mesh(true)
