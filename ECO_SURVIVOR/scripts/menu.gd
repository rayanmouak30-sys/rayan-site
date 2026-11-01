extends Control
# Menu principal : boutons JOUER, OPTIONS, QUITTER.


func _ready():
	# petite animation d'apparition
	$Fondu.modulate.a = 1
	create_tween().tween_property($Fondu, "modulate:a", 0.0, 0.8)
	$Options.hide()
	$Record.text = "Meilleur score : " + str(Global.meilleur_score)
	$Options/Volume.value = Global.volume


func _process(delta):
	# le titre bouge doucement
	$Titre.position.y = 80 + sin(Time.get_ticks_msec() / 400.0) * 6


func _on_jouer_pressed():
	$Clic.play()
	get_tree().change_scene_to_file("res://scenes/Main.tscn")


func _on_options_pressed():
	$Clic.play()
	$Options.show()
	$Jouer.hide()
	$BoutonOptions.hide()
	$Quitter.hide()


func _on_quitter_pressed():
	get_tree().quit()


func _on_volume_value_changed(value):
	Global.volume = value
	AudioServer.set_bus_volume_db(0, linear_to_db(value))


func _on_plein_ecran_toggled(active):
	if active:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)
	else:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)


func _on_retour_pressed():
	$Clic.play()
	$Options.hide()
	$Jouer.show()
	$BoutonOptions.show()
	$Quitter.show()
