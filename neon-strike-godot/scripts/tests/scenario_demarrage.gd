extends Node

func executer() -> void:
	await Test.attendre(0.5)
	Test.mesure("heros", DonneesHeros.HEROS.size())
	Test.mesure("liste", DonneesHeros.liste().size())
	Test.mesure("capacites", DonneesCapacites.CAPACITES.size())
	Test.mesure("armes", DonneesArmes.ARMES.size())
	Test.mesure("skins_armes", DonneesArmes.SKINS.size())
	Test.mesure("touche_capacite_q", Reglages.touche("capacite_q"))
	Test.mesure("skin_elite_kael", DonneesHeros.skin("kael", "elite")["nom"])
	Test.mesure("scene", get_tree().current_scene.name if get_tree().current_scene else "aucune")
