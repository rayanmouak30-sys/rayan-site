class_name Mode
extends Node
## Base des modes de jeu (Spike, Élimination, Combat à mort, Stand de tir).

var partie: Partie
var tir_ami := false
var minuteur := 0.0
var score := {"bleu": 0, "rouge": 0}


func demarrer() -> void:
	pass


func sur_elimination(_victime: Combattant, _tueur: Combattant, _tete: bool, _arme: String) -> void:
	pass


func texte_manche() -> String:
	return ""
