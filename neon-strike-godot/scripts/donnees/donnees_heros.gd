class_name DonneesHeros
extends RefCounted
## Les 20 personnages, leurs catégories et leurs skins (assets/donnees/heros.json, partagé avec le générateur Blender).

static var brut: Dictionary = _lire("res://assets/donnees/heros.json")
static var HEROS: Dictionary = brut.get("heros", {})
static var CATEGORIES: Dictionary = brut.get("categories", {})
static var ORDRE_CATEGORIES: Array = brut.get("ordre", [])


static func _lire(chemin: String) -> Dictionary:
	var f := FileAccess.open(chemin, FileAccess.READ)
	if f == null:
		push_error("Données introuvables : " + chemin)
		return {}
	var d: Variant = JSON.parse_string(f.get_as_text())
	return d if d is Dictionary else {}


## Liste ordonnée par catégorie
static func liste() -> Array:
	var l := []
	for c in ORDRE_CATEGORIES:
		for id in HEROS:
			if HEROS[id]["categorie"] == c:
				l.append(id)
	return l


static func heros(id: String) -> Dictionary:
	return HEROS.get(id, HEROS.get("kael", {}))


static func couleur_categorie(id_heros: String) -> Color:
	return Color(CATEGORIES[heros(id_heros)["categorie"]]["couleur"])


static func skin(id_heros: String, id_skin: String) -> Dictionary:
	for s in heros(id_heros).get("skins", []):
		if s["id"] == id_skin:
			return s
	return heros(id_heros)["skins"][0]


static func couleur_de(categorie: String) -> Color:
	return Color(CATEGORIES.get(categorie, {"couleur": "#ffffff"})["couleur"])
