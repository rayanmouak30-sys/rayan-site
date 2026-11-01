extends Control
# Écran de fin (victoire ou game over) : affiche le score et les boutons.


func _ready():
	$Fondu.modulate.a = 1
	create_tween().tween_property($Fondu, "modulate:a", 0.0, 0.8)
	$Infos.text = "Score : " + str(Global.score_final) + "\nDéchets ramassés : " + str(Global.dechets_final) + "\nMeilleur score : " + str(Global.meilleur_score)
	$Son.play()


func _on_recommencer_pressed():
	get_tree().change_scene_to_file("res://scenes/Main.tscn")


func _on_menu_pressed():
	get_tree().change_scene_to_file("res://scenes/MainMenu.tscn")
