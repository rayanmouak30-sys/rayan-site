extends Node


func executer() -> void:
	Jeu.config["mode"] = "dm"
	Jeu.config["carte"] = "citadelle"
	get_tree().change_scene_to_file("res://scenes/partie.tscn")
	await Test.attendre(5.0)
	var p: Partie = Jeu.partie
	p.basculer_pause()
	await Test.attendre(0.5)
	await Test.capture("fin_pause")
	p.basculer_pause()
	p.fin_equipe("bleu")
	await Test.attendre(12.0)
	await Test.capture("fin_ecran")
	Test.mesure("niveau", Profil.niveau)
