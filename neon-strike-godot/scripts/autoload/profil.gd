extends Node
## Profil du joueur : personnage choisi, skins équipés et débloqués, niveau, XP, statistiques.
## Gardé dans user://profil.json.

signal change

const FICHIER := "user://profil.json"

var donnees := {}


func _ready() -> void:
	donnees = vide()
	charger()


func vide() -> Dictionary:
	return {
		"heros": "kael",
		"niveau": 1,
		"xp": 0,
		"points_skins": 0,
		"skins_heros": {},      # heros -> skin équipé
		"skins_armes": {},      # arme -> skin équipé
		"debloques": [],        # skins achetés avec des points
		"stats": {"parties": 0, "victoires": 0, "kills": 0, "morts": 0, "tetes": 0},
	}


func charger() -> void:
	if not FileAccess.file_exists(FICHIER):
		return
	var f := FileAccess.open(FICHIER, FileAccess.READ)
	var brut: Variant = JSON.parse_string(f.get_as_text())
	if brut is Dictionary:
		for cle in donnees:
			if brut.has(cle) and typeof(brut[cle]) == typeof(donnees[cle]):
				donnees[cle] = brut[cle]
			elif brut.has(cle) and donnees[cle] is int and brut[cle] is float:
				donnees[cle] = int(brut[cle])
	if not DonneesHeros.HEROS.has(donnees["heros"]):
		donnees["heros"] = "kael"


func sauver() -> void:
	var f := FileAccess.open(FICHIER, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(donnees, "\t"))
	change.emit()


var heros: String:
	get: return donnees["heros"]
	set(v):
		if DonneesHeros.HEROS.has(v):
			donnees["heros"] = v
			sauver()

var niveau: int:
	get: return int(donnees["niveau"])


func xp_niveau(n: int) -> int:
	return 500 + 120 * (n - 1)


## Ajoute de l'XP ; retourne le nombre de niveaux gagnés (1 point de skin par niveau)
func gagner_xp(n: int) -> int:
	var avant := niveau
	donnees["xp"] = int(donnees["xp"]) + maxi(0, n)
	while int(donnees["xp"]) >= xp_niveau(niveau):
		donnees["xp"] = int(donnees["xp"]) - xp_niveau(niveau)
		donnees["niveau"] = niveau + 1
		donnees["points_skins"] = int(donnees["points_skins"]) + 1
	sauver()
	return niveau - avant


# ----- Skins -----
func skin_heros(id_heros: String) -> String:
	return donnees["skins_heros"].get(id_heros, "standard")


func skin_arme(id_arme: String) -> String:
	return donnees["skins_armes"].get(id_arme, "standard")


## Un skin est disponible s'il est gratuit, débloqué par le niveau ou acheté avec des points
func skin_disponible(cle: String, condition: Dictionary) -> bool:
	if condition.get("niveau", 1) <= niveau:
		return true
	return cle in donnees["debloques"]


func acheter_skin(cle: String, prix: int) -> bool:
	if cle in donnees["debloques"] or int(donnees["points_skins"]) < prix:
		return false
	donnees["points_skins"] = int(donnees["points_skins"]) - prix
	donnees["debloques"].append(cle)
	sauver()
	return true


func equiper_skin_heros(id_heros: String, skin: String) -> void:
	donnees["skins_heros"][id_heros] = skin
	sauver()


func equiper_skin_arme(id_arme: String, skin: String) -> void:
	donnees["skins_armes"][id_arme] = skin
	sauver()


func noter_partie(kills: int, morts: int, tetes: int, victoire: bool) -> void:
	var s: Dictionary = donnees["stats"]
	s["parties"] = int(s["parties"]) + 1
	s["kills"] = int(s["kills"]) + kills
	s["morts"] = int(s["morts"]) + morts
	s["tetes"] = int(s["tetes"]) + tetes
	if victoire:
		s["victoires"] = int(s["victoires"]) + 1
	sauver()
