extends Node


func executer() -> void:
	Jeu.config["mode"] = "spike"
	Jeu.config["camp"] = "defense"
	Jeu.config["carte"] = "citadelle"
	get_tree().change_scene_to_file("res://scenes/partie.tscn")
	await Test.attendre(2.0)
	var p: Partie = Jeu.partie
	var j := p.joueur
	j.set_physics_process(false)
	j.vivant = false
	j.global_position = Vector3(0, 40, 0)
	Engine.time_scale = 4.0
	for k in 14:
		await Test.attendre(2.5)
		var m = p.mode
		var txt := "t=%.0f phase=%s site=%s spike=%s" % [m.combat_t, m.phase, m.site_attaque, m.spike.etat]
		print(txt)
		for c in p.combattants:
			if c is Bot:
				var b := c as Bot
				print("   %s %s %s pos=%s obj=%s etat=%s vie=%d porteur=%s nav=%s" % [b.equipe, m.cote[b.equipe], b.nom_affiche, str(b.global_position.round()), str(b.objectif.round()), b.etat, int(b.vie), str(m.spike.porteur == b), str(b.agent.is_navigation_finished())])
