extends "res://scripts/modes/mode_spike.gd"
## Élimination : les règles du Spike sans Spike — la manche se gagne en éliminant l'équipe adverse
## (les défenseurs gagnent aussi si le temps s'écoule).


func _init() -> void:
	avec_spike = false
