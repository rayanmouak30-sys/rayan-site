extends Node
## Test réseau sur une seule machine : --role=hote (crée le salon, lance quand un joueur est là) ou --role=client.


func executer() -> void:
	var role: String = Test.arguments.get("role", "hote")
	var mode: String = Test.arguments.get("mode", "dm")
	Reglages.valeurs["pseudo"] = role.to_upper()
	if role == "hote":
		print("RESEAU hote : ", Reseau.heberger())
		Reseau.maj_config("mode", mode)
		var t := 0.0
		while Reseau.joueurs.size() < 2 and t < 30.0:
			await Test.attendre(0.5)
			t += 0.5
		Test.mesure("joueurs_salon", Reseau.joueurs.size())
		Reseau.lancer()
	else:
		await Test.attendre(2.0)
		print("RESEAU client : ", Reseau.rejoindre("127.0.0.1"))
		var t := 0.0
		while not Reseau.en_partie and t < 40.0:
			await Test.attendre(0.5)
			t += 0.5
	var duree := float(Test.arguments.get("duree", "40"))
	await Test.attendre(duree)
	var p: Partie = Jeu.partie
	if p == null:
		Test.mesure("partie", "absente")
		return
	var humains := 0
	var bots := 0
	for c in p.combattants:
		if c is JoueurDistant:
			humains += 1
		elif c is Bot:
			bots += 1
	Test.mesure("role", role)
	Test.mesure("combattants", "%d (distants %d, bots %d)" % [p.combattants.size(), humains, bots])
	Test.mesure("score", p.mode.score)
	Test.mesure("hud", p.hud.l_minuteur.text + " " + p.hud.l_score_bleu.text + "-" + p.hud.l_score_rouge.text)
	Test.mesure("ma_vie", "%d vivant=%s id=%d equipe=%s" % [int(p.joueur.vie), str(p.joueur.vivant), p.joueur.id_reseau, p.joueur.equipe])
	var kills := 0
	for c in p.combattants:
		kills += c.kills
	Test.mesure("eliminations", kills)
	var b: Bot = null
	for c in p.combattants:
		if c is Bot:
			b = c
			break
	if b:
		Test.mesure("bot_exemple", "%s pos=%s vivant=%s" % [b.nom_affiche, str(b.global_position.round()), str(b.vivant)])
