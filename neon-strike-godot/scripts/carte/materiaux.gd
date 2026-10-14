class_name Materiaux
extends RefCounted
## Matériaux PBR des cartes : textures générées (outils/textures.py) en projection triplanaire
## dans le repère du monde (densité de texels constante, aucune UV à faire), avec repli sur des couleurs.

const DOSSIER := "res://assets/textures/"

## nom -> [couleur de repli, rugosité, métal, échelle (m par répétition), matière sonore]
const DEFS := {
	"beton": [Color(0.56, 0.55, 0.52), 0.85, 0.0, 3.0, "beton"],
	"beton_sombre": [Color(0.32, 0.32, 0.33), 0.8, 0.0, 3.0, "beton"],
	"beton_peint": [Color(0.78, 0.76, 0.7), 0.7, 0.0, 3.0, "beton"],
	"dalles": [Color(0.5, 0.5, 0.5), 0.7, 0.0, 2.0, "beton"],
	"asphalte": [Color(0.18, 0.18, 0.19), 0.9, 0.0, 4.0, "beton"],
	"brique": [Color(0.55, 0.3, 0.22), 0.85, 0.0, 2.0, "beton"],
	"metal": [Color(0.55, 0.57, 0.6), 0.38, 0.9, 2.0, "metal"],
	"metal_peint": [Color(0.24, 0.4, 0.52), 0.5, 0.6, 2.0, "metal"],
	"metal_strie": [Color(0.45, 0.46, 0.48), 0.42, 0.9, 1.5, "metal"],
	"tole": [Color(0.5, 0.52, 0.5), 0.5, 0.7, 2.5, "metal"],
	"rouille": [Color(0.45, 0.28, 0.18), 0.8, 0.4, 2.0, "metal"],
	"bois": [Color(0.55, 0.4, 0.26), 0.7, 0.0, 1.5, "bois"],
	"caisse": [Color(0.6, 0.48, 0.3), 0.75, 0.0, 1.2, "bois"],
	"terre": [Color(0.42, 0.34, 0.25), 0.95, 0.0, 4.0, "terre"],
	"herbe": [Color(0.3, 0.42, 0.2), 0.9, 0.0, 3.0, "vegetal"],
	"sable": [Color(0.76, 0.66, 0.48), 0.95, 0.0, 4.0, "terre"],
	"carrelage": [Color(0.85, 0.85, 0.82), 0.3, 0.0, 1.0, "beton"],
	"plastique": [Color(0.2, 0.22, 0.25), 0.5, 0.0, 1.0, "beton"],
	"verre": [Color(0.6, 0.75, 0.8, 0.25), 0.05, 0.0, 1.0, "verre"],
}

static var _cache := {}


static func obtenir(nom: String, teinte := Color(1, 1, 1)) -> Material:
	var cle := nom + "|" + teinte.to_html()
	if _cache.has(cle):
		return _cache[cle]
	var d: Array = DEFS.get(nom, DEFS["beton"])
	var m := StandardMaterial3D.new()
	m.resource_name = nom
	var alb := DOSSIER + nom + "_alb.jpg"
	var a_texture := ResourceLoader.exists(alb)
	if a_texture:
		m.albedo_texture = load(alb)
		m.albedo_color = teinte
		var nrm := DOSSIER + nom + "_nrm.jpg"
		if ResourceLoader.exists(nrm):
			m.normal_enabled = true
			m.normal_texture = load(nrm)
			m.normal_scale = 1.0
		var orm := DOSSIER + nom + "_orm.jpg"
		if ResourceLoader.exists(orm):
			# Occlusion (R), rugosité (V), métal (B)
			var t: Texture2D = load(orm)
			m.ao_enabled = true
			m.ao_texture = t
			m.ao_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_RED
			m.ao_light_affect = 0.6
			m.roughness_texture = t
			m.roughness_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_GREEN
			m.roughness = 1.0
			m.metallic_texture = t
			m.metallic_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_BLUE
			m.metallic = 1.0
		else:
			m.roughness = d[1]
			m.metallic = d[2]
	else:
		m.albedo_color = (d[0] as Color) * teinte
		m.roughness = d[1]
		m.metallic = d[2]
	if nom == "verre":
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.albedo_color = d[0]
		m.metallic_specular = 0.9
		m.roughness = 0.05
		m.refraction_enabled = false
		m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.uv1_triplanar = true
	m.uv1_world_triplanar = true
	m.uv1_triplanar_sharpness = 4.0
	var e: float = 1.0 / float(d[3])
	m.uv1_scale = Vector3(e, e, e)
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	_cache[cle] = m
	return m


static func matiere(nom: String) -> String:
	return (DEFS.get(nom, DEFS["beton"]) as Array)[4]


## Matériau émissif (néons, écrans, bandes lumineuses)
static func neon(couleur: Color, force := 3.0) -> Material:
	var cle := "neon|" + couleur.to_html() + str(force)
	if _cache.has(cle):
		return _cache[cle]
	var m := StandardMaterial3D.new()
	m.albedo_color = couleur
	m.emission_enabled = true
	m.emission = couleur
	m.emission_energy_multiplier = force
	m.roughness = 0.4
	_cache[cle] = m
	return m
