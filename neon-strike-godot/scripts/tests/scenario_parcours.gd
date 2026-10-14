extends Node
## Parcours complet : menu, sélection et verrouillage d'un agent, partie Spike, boutique, tableau, combat.


func executer() -> void:
	get_tree().change_scene_to_file("res://scenes/demarrage.tscn")
	await Test.attendre(4.0)
	var m: Control = get_tree().current_scene
	Test.mesure("scene", m.name)
	m.set("choix", {"mode": "spike", "carte": "citadelle", "difficulte": "normal", "allies": true})
	m.call("_choisir_agent")
	await Test.attendre(2.0)
	var sel: Control = m.get_child(m.get_child_count() - 1)
	sel.call("montrer", "vexa")
	await Test.attendre(0.5)
	sel.call("_verrouiller")
	await Test.attendre(1.0)
	await Test.capture("parcours_verrou")
	await Test.attendre(5.0)
	var p: Partie = Jeu.partie
	Test.mesure("partie", p != null)
	if p == null:
		return
	Test.mesure("heros", p.joueur.heros)
	await Test.attendre(2.0)
	var mode = p.mode
	mode.basculer_achat()
	await Test.attendre(1.0)
	await Test.capture("parcours_boutique")
	Test.mesure("achat_fusil", mode.acheter(p.joueur, "arme:fusil"))
	Test.mesure("achat_bouclier", mode.acheter(p.joueur, "bouclier:leger"))
	Test.mesure("credits", p.joueur.credits)
	mode.basculer_achat()
	Input.action_press("tableau")
	await Test.attendre(0.5)
	await Test.capture("parcours_tableau")
	Input.action_release("tableau")
	await Test.attendre(25.0)
	Test.mesure("phase", mode.phase)
	await Test.capture("parcours_combat")
	Input.action_press("tir")
	await Test.attendre(0.4)
	Input.action_release("tir")
	Input.action_press("capacite_e")
	await Test.attendre(0.2)
	Input.action_release("capacite_e")
	await Test.attendre(2.0)
	await Test.capture("parcours_capacite")
	Test.mesure("mun", p.joueur.arme.mun)
