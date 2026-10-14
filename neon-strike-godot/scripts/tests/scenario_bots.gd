extends Node
## Bots en combat à mort sur la Citadelle : le joueur reste spectateur (caméra libre), mesures d'éliminations.


func executer() -> void:
	Jeu.config["mode"] = Test.arguments.get("mode", "dm")
	Jeu.config["carte"] = Test.arguments.get("carte", "citadelle")
	Jeu.config["difficulte"] = "normal"
	get_tree().change_scene_to_file("res://scenes/partie.tscn")
	await Test.attendre(3.0)
	var p: Partie = Jeu.partie
	var j := p.joueur
	j.controle = false
	j.vivant = false
	j.activer_zones(false)
	j.global_position = Vector3(0, 30, 20)
	j.collision_layer = 0
	j.collision_mask = 0
	j.set_physics_process(false)
	p.vue.visible = false
	var duree := float(Test.arguments.get("duree", "40"))
	Engine.time_scale = float(Test.arguments.get("vitesse", "1"))
	var sans_captures := Test.arguments.has("sans_captures")
	var t := 0.0
	var i := 0
	while t < duree:
		await Test.attendre(duree / 6.0)
		t += duree / 6.0
		# Caméra qui suit un bot vivant
		var bots := p.combattants.filter(func(c: Combattant) -> bool: return c is Bot and c.vivant)
		if not bots.is_empty():
			var b: Bot = bots[i % bots.size()]
			j.global_position = b.global_position + b.global_transform.basis.z * 3.5 + Vector3(0, 1.0, 0)
			j.tete.position = Vector3(0, 0.8, 0)
			j.cam.look_at(b.global_position + Vector3(0, 1.3, 0))
			await Test.attendre_images(2)
			if not sans_captures:
				await Test.capture("bots_%d" % i)
			Test.mesure("bot_%d" % i, "%s etat=%s vie=%d cible=%s" % [b.nom_affiche, b.etat, int(b.vie), b.cible.nom_affiche if b.cible else "-"])
		i += 1
	Test.mesure("score", p.mode.score)
	if p.mode.get("manche") != null:
		Test.mesure("manche", p.mode.get("manche"))
	var kills := 0
	for c in p.combattants:
		kills += c.kills
	Test.mesure("eliminations", kills)
