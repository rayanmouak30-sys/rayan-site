extends Node2D
# Script principal de la partie : score, temps, vies, apparitions, victoire/défaite.

var scene_objet = preload("res://scenes/Collectible.tscn")
var scene_pollution = preload("res://scenes/Pollution.tscn")

var score = 0
var objectif = 600
var temps = 90.0
var vies = 3
var dechets = 0
var niveau = 1
var fini = false


func _ready():
	$Player.sante_change.connect(_on_sante_change)
	$Player.mort.connect(_on_joueur_mort)
	mettre_a_jour_hud()


func _process(delta):
	if fini:
		return
	temps -= delta
	# difficulté : un niveau de plus toutes les 20 secondes
	var nouveau_niveau = 1 + int((90 - temps) / 20)
	if nouveau_niveau != niveau and nouveau_niveau <= 4:
		niveau = nouveau_niveau
		$TimerObjets.wait_time = 1.5 - niveau * 0.2
		$TimerPollution.wait_time = 7 - niveau * 1.2
		$HUD/Message.text = "La pollution augmente ! Niveau " + str(niveau)
		$HUD/Message.show()
		var tween = create_tween()
		tween.tween_interval(2.0)
		tween.tween_callback($HUD/Message.hide)
	if temps <= 0:
		temps = 0
		fin_de_partie(false)
	mettre_a_jour_hud()


func mettre_a_jour_hud():
	$HUD/Score.text = "Score : " + str(score) + " / " + str(objectif)
	$HUD/Temps.text = "Temps : " + str(int(temps))
	$HUD/Vies.text = "Vies : " + str(vies)
	$HUD/Dechets.text = "Déchets : " + str(dechets)
	$HUD/Niveau.text = "Niveau : " + str(niveau)


# position au hasard qui n'est pas dans une maison ou un arbre
func position_libre():
	for essai in 50:
		var p = Vector2(randf_range(40, 1240), randf_range(90, 690))
		var ok = true
		for obstacle in $Obstacles.get_children():
			if obstacle.position.distance_to(p) < 130:
				ok = false
		if ok:
			return p
	return Vector2(640, 450)


func _on_timer_objets_timeout():
	var objet = scene_objet.instantiate()
	# plus le niveau est haut, plus il y a de déchets toxiques
	var r = randf()
	if r < 0.08 + niveau * 0.05:
		objet.type = "toxique"
	elif r < 0.5:
		objet.type = "plastique"
	elif r < 0.72:
		objet.type = "papier"
	elif r < 0.9:
		objet.type = "verre"
	else:
		objet.type = "electronique"
	objet.position = position_libre()
	objet.ramasse.connect(_on_objet_ramasse)
	$Objets.add_child(objet)


func _on_timer_pollution_timeout():
	var nuage = scene_pollution.instantiate()
	var p = position_libre()
	# pas directement sur le joueur
	while p.distance_to($Player.position) < 150:
		p = Vector2(randf_range(80, 1200), randf_range(120, 650))
	nuage.position = p
	nuage.degats_par_seconde = 20 + niveau * 5
	$Pollutions.add_child(nuage)


func _on_objet_ramasse(objet):
	if fini:
		return
	score += objet.points
	if score < 0:
		score = 0
	# effet de particules
	$Particules.position = objet.position
	if objet.type == "toxique":
		$Particules.color = Color(0.5, 1, 0.2)
		$Player.prendre_degats(25)
		$SonDegat.play()
	else:
		$Particules.color = Color(1, 1, 0.5)
		dechets += 1
		$SonRamasser.play()
	$Particules.restart()
	if score >= objectif:
		fin_de_partie(true)


func _on_sante_change(sante):
	if fini:
		return
	$HUD/BarreVie.value = sante
	if not $SonDegat.playing:
		$SonDegat.play()


func _on_joueur_mort():
	if fini:
		return
	vies -= 1
	$SonViePerdue.play()
	$Player.position = Vector2(640, 450)
	if vies <= 0:
		fin_de_partie(false)


func fin_de_partie(victoire):
	if fini:
		return
	fini = true
	Global.score_final = score
	Global.dechets_final = dechets
	if score > Global.meilleur_score:
		Global.meilleur_score = score
	if victoire:
		get_tree().change_scene_to_file.call_deferred("res://scenes/Victory.tscn")
	else:
		get_tree().change_scene_to_file.call_deferred("res://scenes/GameOver.tscn")
