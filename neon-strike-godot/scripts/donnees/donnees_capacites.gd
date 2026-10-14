class_name DonneesCapacites
extends RefCounted
## Les 80 capacités (assets/donnees/capacites.json) : chacune utilise une "famille" d'effet du moteur.

static var CAPACITES: Dictionary = DonneesHeros._lire("res://assets/donnees/capacites.json")
const EMPLACEMENTS := ["c", "q", "e", "x"]
const ACTIONS := {"c": "capacite_c", "q": "capacite_q", "e": "capacite_e", "x": "ultime"}
const FAMILLES_PERSONNELLES := ["ruee", "saut", "blink", "buff"]


static func capacite(id: String) -> Dictionary:
	return CAPACITES.get(id, {})


static func de(id_heros: String) -> Dictionary:
	var c: Array = DonneesHeros.heros(id_heros)["capacites"]
	return {"c": c[0], "q": c[1], "e": c[2], "x": c[3]}
