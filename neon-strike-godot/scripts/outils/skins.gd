class_name Skins
extends RefCounted
## Applique les skins aux modèles importés (armes et personnages) en remplaçant les matériaux par nom.
## Les matériaux sont créés une fois puis partagés (cache).

const EFFETS := {"": 0, "lignes": 1, "magma": 2, "carbone": 3, "camo": 4, "acide": 5, "or": 6, "holo": 7, "ecailles": 8, "galaxie": 9, "chrome": 10, "cristal": 11, "neon": 12}
static var _cache := {}
static var _shader: Shader = null
static var _shader_spectre: Shader = null


static func _sh() -> Shader:
	if _shader == null:
		_shader = load("res://assets/shaders/skin_effet.gdshader")
	return _shader


static func _sh_spectre() -> Shader:
	if _shader_spectre == null:
		_shader_spectre = load("res://assets/shaders/skin_spectre.gdshader")
	return _shader_spectre


static func _effet(cle: String, base: Color, base2: Color, accent: Color, metal: float, rug: float, effet: String, echelle := 10.0, emission := 1.0) -> Material:
	if _cache.has(cle):
		return _cache[cle]
	var m: Material
	if effet == "spectre":
		var s := ShaderMaterial.new()
		s.shader = _sh_spectre()
		s.set_shader_parameter("couleur", base)
		s.set_shader_parameter("accent", accent)
		s.set_shader_parameter("echelle", echelle)
		m = s
	elif effet == "" and emission == 0.0:
		var st := StandardMaterial3D.new()
		st.albedo_color = base
		st.metallic = metal
		st.roughness = rug
		m = st
	else:
		var s := ShaderMaterial.new()
		s.shader = _sh()
		s.set_shader_parameter("couleur", base)
		s.set_shader_parameter("couleur2", base2)
		s.set_shader_parameter("accent", accent)
		s.set_shader_parameter("metal", metal)
		s.set_shader_parameter("rugosite", rug)
		s.set_shader_parameter("effet", int(EFFETS.get(effet, 0)))
		s.set_shader_parameter("echelle", echelle)
		s.set_shader_parameter("force_emission", emission)
		m = s
	_cache[cle] = m
	return m


static func _lumineux(cle: String, c: Color, force: float) -> StandardMaterial3D:
	if _cache.has(cle):
		return _cache[cle]
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.emission_enabled = true
	m.emission = c
	m.emission_energy_multiplier = force
	_cache[cle] = m
	return m


static func _maillages(racine: Node) -> Array:
	var l := []
	if racine is MeshInstance3D:
		l.append(racine)
	for c in racine.get_children():
		l.append_array(_maillages(c))
	return l


static func _nom_materiau(mi: MeshInstance3D, i: int) -> String:
	var m := mi.mesh.surface_get_material(i)
	return m.resource_name if m else ""


## Skin d'arme : remplace la carcasse, la coque, les plaques, les lumières...
static func appliquer_arme(racine: Node, id_skin: String) -> void:
	var s := DonneesArmes.skin(id_skin)
	var standard: bool = s["id"] == "standard"
	var carcasse := Color(s["carcasse"])
	var secondaire := Color(s["secondaire"])
	var poly := Color(s["polymere"])
	var accent := Color(s["accent"])
	var effet: String = s["effet"]
	var k := "arme|" + id_skin + "|"
	for mi in _maillages(racine):
		var m := mi as MeshInstance3D
		if m.mesh == null:
			continue
		for i in m.mesh.get_surface_count():
			var nom := _nom_materiau(m, i)
			var mat: Material = null
			if standard:
				m.set_surface_override_material(i, null)
				continue
			match nom:
				"Carcasse", "Coque":
					mat = _effet(k + "c", carcasse, secondaire, accent, s["metal"], s["rugosite"], effet)
				"CarcasseClaire", "CoqueGrise", "Plaque":
					mat = _effet(k + "s", secondaire, carcasse, accent, s["metal"], s["rugosite"] + 0.05, effet if effet in ["or", "holo", "chrome", "spectre", "galaxie"] else "", 12.0, 0.6 if effet != "" else 0.0)
				"Polymere":
					mat = _effet(k + "p", poly, secondaire, accent, 0.1, 0.7, effet if effet in ["galaxie", "spectre", "holo"] else "", 10.0, 0.6 if effet in ["galaxie", "spectre", "holo"] else 0.0)
				"Accent", "Lumiere":
					mat = _lumineux(k + "a", accent, 3.0 if nom == "Lumiere" else 2.0)
			m.set_surface_override_material(i, mat)


## Couleur d'équipe des bandes lumineuses des personnages
const COULEURS_EQUIPE := {"bleu": Color("#4fd2ff"), "rouge": Color("#ff4655")}


## Skin de personnage : armure, tissu, secondaire, accent (+ effet du skin Prestige) ; bandes d'équipe
static func appliquer_heros(racine: Node, id_heros: String, id_skin: String, equipe := "") -> void:
	var h := DonneesHeros.heros(id_heros)
	var s := DonneesHeros.skin(id_heros, id_skin)
	var c: Dictionary = s["couleurs"]
	var armure := Color(c["armure"])
	var tissu := Color(c["tissu"])
	var sec := Color(c["secondaire"])
	var accent := Color(c["accent"])
	var effet: String = s.get("effet", "")
	var eq: Color = COULEURS_EQUIPE.get(equipe, accent)
	var k := "heros|" + id_heros + "|" + id_skin + "|"
	for mi in _maillages(racine):
		var m := mi as MeshInstance3D
		if m.mesh == null:
			continue
		for i in m.mesh.get_surface_count():
			var nom := _nom_materiau(m, i)
			var mat: Material = null
			match nom:
				"Armure":
					mat = _effet(k + "armure", armure, sec, accent, 0.25 if effet == "" else 0.8, 0.45, effet, 6.0, 1.0 if effet != "" else 0.0)
				"Tissu":
					mat = _effet(k + "tissu", tissu, tissu.lightened(0.1), accent, 0.0, 0.9, "", 6.0, 0.0)
				"TissuClair":
					mat = _effet(k + "tissuc", tissu.lightened(0.25), tissu, accent, 0.0, 0.88, "", 6.0, 0.0)
				"Secondaire":
					mat = _effet(k + "sec", sec, armure, accent, 0.3 if effet == "" else 0.7, 0.5, effet if effet in ["or", "chrome", "holo"] else "", 8.0, 0.4 if effet in ["holo"] else 0.0)
				"Accent":
					mat = _lumineux(k + "accent", accent, 2.2)
				"Equipe":
					mat = _lumineux("equipe|" + equipe + "|" + id_heros, eq, 2.6)
				"Lentille":
					mat = _lumineux("lentille|" + equipe + "|" + id_heros, eq, 1.8)
			if mat != null:
				m.set_surface_override_material(i, mat)
