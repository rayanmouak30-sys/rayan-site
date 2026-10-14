class_name Mode
extends Node
## Base des modes de jeu (Spike, Élimination, Combat à mort, Stand de tir).

var partie: Partie
var tir_ami := false
var minuteur := 0.0
var score := {"bleu": 0, "rouge": 0}
var demarre := false


func demarrer() -> void:
	pass


## Complète les deux équipes avec des bots (5 par équipe). Hors ligne, "allies" = faux laisse le joueur seul.
func remplir_bots() -> void:
	var humains := {"bleu": 0, "rouge": 0}
	var pris := []
	for c in partie.combattants:
		if not (c is Cible):
			humains[c.equipe] = int(humains.get(c.equipe, 0)) + 1
			pris.append(c.heros)
	var heros := DonneesHeros.liste().filter(func(h: String) -> bool: return not pris.has(h))
	heros.shuffle()
	var en_ligne := partie.sync != null
	var avec_bots := bool(Jeu.config.get("allies", true))
	for eq in ["bleu", "rouge"]:
		var n := 5 - int(humains[eq])
		if en_ligne and not avec_bots:
			n = 0
		elif not en_ligne and eq == partie.joueur.equipe and not avec_bots:
			n = 0
		for i in maxi(0, n):
			if heros.is_empty():
				heros = DonneesHeros.liste().duplicate()
				heros.shuffle()
			partie.ajouter_bot(heros.pop_back(), eq)


func sur_elimination(_victime: Combattant, _tueur: Combattant, _tete: bool, _arme: String) -> void:
	pass


func texte_manche() -> String:
	return ""
