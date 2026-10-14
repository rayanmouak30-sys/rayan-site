extends Node
## Stand de tir : vérifie le joueur, la vue FPS, le tir, la visée, le rechargement, les armes et le HUD.


func executer() -> void:
	var arme: String = Test.arguments.get("arme", "pulsar")
	Jeu.config["mode"] = "stand"
	Jeu.config["arme"] = arme
	get_tree().change_scene_to_file("res://scenes/partie.tscn")
	await Test.attendre(4.0)
	var p: Partie = Jeu.partie
	var j := p.joueur
	# Vise la poitrine de la cible la plus proche du centre
	var meilleure: Combattant = null
	for c in p.combattants:
		if c is Cible and (meilleure == null or absf(c.global_position.x) + c.global_position.distance_to(j.global_position) * 0.1 < absf(meilleure.global_position.x) + meilleure.global_position.distance_to(j.global_position) * 0.1):
			meilleure = c
	var d := meilleure.global_position + Vector3(0, 1.2, 0) - j.yeux()
	j.regard = Vector2(atan2(d.y, Vector2(d.x, d.z).length()), atan2(-d.x, -d.z))
	await Test.attendre(0.4)
	await Test.capture("stand_%s_hanche" % arme)
	Input.action_press("viser")
	await Test.attendre(0.6)
	await Test.capture("stand_%s_visee" % arme)
	Input.action_release("viser")
	await Test.attendre(0.4)
	Input.action_press("tir")
	await Test.attendre(0.18)
	await Test.capture("stand_%s_tir" % arme)
	await Test.attendre(0.5)
	Input.action_release("tir")
	Test.mesure("munitions", j.arme.mun)
	Test.mesure("touches", p.mode.get("touches"))
	await Test.attendre(0.3)
	await Test.capture("stand_%s_impacts" % arme)
	Input.action_press("recharger")
	await Test.attendre(0.1)
	Input.action_release("recharger")
	await Test.attendre(j.arme.duree_recharge * 0.35)
	await Test.capture("stand_%s_recharge" % arme)
	await Test.attendre(j.arme.duree_recharge * 0.7)
	Test.mesure("munitions_apres_recharge", j.arme.mun)
	Input.action_press("inspecter")
	await Test.attendre(0.1)
	Input.action_release("inspecter")
	await Test.attendre(1.4)
	await Test.capture("stand_%s_inspection" % arme)
	# Course
	Input.action_press("avancer")
	Input.action_press("sprint")
	await Test.attendre(0.8)
	await Test.capture("stand_%s_course" % arme)
	Input.action_release("avancer")
	Input.action_release("sprint")
	await Test.attendre(0.5)
	Test.mesure("position", j.global_position)
	# Pistolet puis couteau
	Input.action_press("arme_2")
	await Test.attendre(0.05)
	Input.action_release("arme_2")
	await Test.attendre(0.8)
	await Test.capture("stand_pistolet")
	Input.action_press("arme_3")
	await Test.attendre(0.05)
	Input.action_release("arme_3")
	await Test.attendre(0.6)
	Input.action_press("tir")
	await Test.attendre(0.15)
	await Test.capture("stand_couteau_coup")
	Input.action_release("tir")
	await Test.attendre(0.5)
