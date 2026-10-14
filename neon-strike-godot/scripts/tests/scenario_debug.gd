extends Node


func executer() -> void:
	Test.mesure("sons_charges", Sons.sons.size())
	Test.mesure("tir_fusil", Sons.existe("tir_fusil"))
	Test.mesure("musique", ResourceLoader.exists("res://assets/sons/musique_menu.ogg"))
	var m := Materiaux.obtenir("brique")
	Test.mesure("texture_brique", (m as StandardMaterial3D).albedo_texture != null)
