extends Node
## Utilise les 4 capacités de chaque héros (--ids=... sinon tous) au stand de tir, face aux cibles et à 3 bots.


func executer() -> void:
	Jeu.config["mode"] = "stand"
	get_tree().change_scene_to_file("res://scenes/partie.tscn")
	await Test.attendre(3.0)
	var p: Partie = Jeu.partie
	var j := p.joueur
	await p.attendre_navigation()
	var bots := []
	for i in 3:
		var b := p.ajouter_bot(["titan", "echo", "mist"][i], "rouge")
		b.reapparaitre(Transform3D(Basis.IDENTITY, Vector3(-4 + i * 4, 0.1, -14)))
		b.actif = false
		bots.append(b)
	var ids: Array = Array(String(Test.arguments.get("ids", "")).split(",", false))
	if ids.is_empty():
		ids = DonneesHeros.liste()
	var captures := Test.arguments.has("captures")
	var total := 0
	for id in ids:
		j.heros = id
		j.etat_cap = EtatCapacites.new(id, false)
		j.etat_cap.points = j.etat_cap.points_max
		j.regard = Vector2(deg_to_rad(-6), 0)
		for empl in ["c", "q", "e", "x"]:
			if not j.etat_cap.ids.has(empl):
				continue
			for b in bots:
				if not b.vivant:
					b.reapparaitre(Transform3D(Basis.IDENTITY, b.global_position))
				b.vie = 100.0
			j.vie = 100.0
			j.vivant = true
			j.controle = true
			var dir := j.cam.global_transform.basis * Vector3.FORWARD
			var ok := p.utiliser_capacite(j, empl, dir)
			var nomc: String = DonneesCapacites.capacite(j.etat_cap.ids[empl]).get("nom", "?")
			Test.mesure("cap_%s_%s" % [id, empl], "%s ok=%s" % [nomc, str(ok)])
			total += 1
			await Test.attendre(1.3)
			if captures:
				await Test.capture("cap_%s_%s" % [id, empl])
			await Test.attendre(0.6)
		p.capacites.nettoyer()
		j.global_position = Vector3(0, 0.1, 0)
		j.velocity = Vector3.ZERO
	Test.mesure("capacites_testees", total)
