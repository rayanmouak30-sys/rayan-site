class_name DonneesArmes
extends RefCounted
## Caractéristiques des armes et skins d'armes (assets/donnees/armes.json).

static var brut: Dictionary = DonneesHeros._lire("res://assets/donnees/armes.json")
static var ARMES: Dictionary = brut.get("armes", {})
static var PRINCIPALES: Array = brut.get("principales", [])
static var SKINS: Array = brut.get("skins", [])


static func arme(id: String) -> Dictionary:
	return ARMES.get(id, ARMES["pistolet"])


static func skin(id: String) -> Dictionary:
	for s in SKINS:
		if s["id"] == id:
			return s
	return SKINS[0]


## Facteur de dégâts selon la distance
static func facteur_distance(def: Dictionary, distance: float) -> float:
	var c: Variant = def.get("chute")
	if c == null or distance <= c[0]:
		return 1.0
	if distance >= c[1]:
		return c[2]
	return 1.0 - (1.0 - c[2]) * ((distance - c[0]) / (c[1] - c[0]))
