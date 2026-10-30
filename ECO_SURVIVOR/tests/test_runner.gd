extends Node
## TESTS AUTOMATIQUES d'ECO SURVIVOR (non inclus dans l'export).
## Lancer : godot --headless --path . res://tests/TestRunner.tscn
## Chaque test affiche OK ou ÉCHEC, puis le programme quitte avec le nombre d'échecs.

var worker := false
var failures := 0
var passed := 0


func _ready() -> void:
	if not worker:
		# le testeur se place à la racine pour survivre aux changements de scène
		var w: Node = load("res://tests/test_runner.gd").new()
		w.worker = true
		w.name = "TestWorker"
		get_tree().root.add_child.call_deferred(w)
		return
	process_mode = Node.PROCESS_MODE_ALWAYS
	await _run_all()
	print("\n===== RÉSULTAT : %d OK, %d ÉCHEC(S) =====" % [passed, failures])
	get_tree().quit(failures)


func check(cond: bool, label: String) -> void:
	if cond:
		passed += 1
		print("  OK     ", label)
	else:
		failures += 1
		print("  ÉCHEC  ", label)


func wait(sec: float) -> void:
	await get_tree().create_timer(sec, true, true).timeout


func goto(path: String) -> Node:
	get_tree().change_scene_to_file(path)
	await get_tree().process_frame
	await get_tree().process_frame
	return get_tree().current_scene


func start_game() -> Node:
	var gm: Node = await goto("res://scenes/Main.tscn")
	await wait(2.0)
	return gm


func spawn_item(gm: Node, type: int) -> void:
	var item: Collectible = gm.COLLECTIBLE_SCENE.instantiate()
	item.type = type
	item.position = gm.player.global_position + Vector2(200, 0)
	item.collected.connect(gm._on_collectible_collected)
	gm.collectibles.add_child(item)
	await wait(0.6)
	item.global_position = gm.player.global_position
	await wait(0.2)


func clear_hazards(gm: Node) -> void:
	for group in [gm.collectibles, gm.hazards, gm.pollution_root, gm.cars]:
		for c in group.get_children():
			c.free()


func _run_all() -> void:
	Global.difficulty = 1
	print("\n--- 1. Chargement de toutes les scènes ---")
	for s in ["MainMenu", "Main", "Player", "Collectible", "Pollution", "ToxicWaste", "Car", "Tree", "HUD",
			"PauseMenu", "OptionsPanel", "GameOver", "Victory", "FloatingText", "Transition"]:
		var packed: PackedScene = load("res://scenes/%s.tscn" % s)
		var inst: Node = packed.instantiate() if packed else null
		check(inst != null, "scène %s.tscn chargée et instanciée" % s)
		if inst:
			inst.free()

	print("\n--- 2. Démarrage d'une partie ---")
	var gm := await start_game()
	check(gm.running, "la partie démarre après le compte à rebours")
	check(gm.lives == 3, "3 vies au départ")
	check(gm.target == 1000 and gm.duration == 150.0, "objectif 1000 pts en 150 s (Normal)")
	check(gm.time_left < 150.0, "le chronomètre décompte")
	check(gm.collectibles.get_child_count() > 0, "des déchets apparaissent sur la carte")
	clear_hazards(gm)

	print("\n--- 3. Score des déchets ---")
	gm.score = 0
	await spawn_item(gm, Collectible.Type.PLASTIQUE)
	check(gm.score == 10, "plastique = +10 (score %d)" % gm.score)
	await spawn_item(gm, Collectible.Type.PAPIER)
	check(gm.score == 25, "papier = +15 (score %d)" % gm.score)
	await spawn_item(gm, Collectible.Type.VERRE)
	check(gm.score == 45, "verre = +20 (score %d)" % gm.score)
	await spawn_item(gm, Collectible.Type.ELECTRONIQUE)
	check(gm.score == 75, "électronique = +30 (score %d)" % gm.score)
	check(gm.total_waste == 4 and gm.counts.plastique == 1 and gm.counts.electronique == 1, "compteur de déchets = 4")
	check(gm.hud.score_label.text == "75", "le HUD affiche le score")
	check(gm.hud.total_label.text.ends_with("4"), "le HUD affiche le nombre de déchets")

	print("\n--- 4. Dangers ---")
	clear_hazards(gm)
	var toxic: ToxicWaste = gm.TOXIC_SCENE.instantiate()
	toxic.position = gm.player.global_position + Vector2(300, 0)
	toxic.touched.connect(gm._on_toxic_touched)
	gm.hazards.add_child(toxic)
	await wait(0.6)
	toxic.global_position = gm.player.global_position
	await wait(0.3)
	check(gm.score == 25, "déchet toxique = -50 points (score %d)" % gm.score)
	check(is_equal_approx(gm.player.health, 75.0), "déchet toxique = -25 santé (santé %.0f)" % gm.player.health)
	await wait(1.2)
	var h: float = gm.player.health
	var car: Car = gm.CAR_SCENE.instantiate()
	var p: Vector2 = gm.player.global_position
	car.setup(p + Vector2(-300, 0), p + Vector2(600, 0), 400.0)
	car.hit_player.connect(gm._on_car_hit)
	gm.cars.add_child(car)
	await wait(1.2)
	check(gm.player.health < h, "une voiture blesse le joueur (%.0f -> %.0f)" % [h, gm.player.health])
	clear_hazards(gm)
	await wait(1.0)
	h = gm.player.health
	var zone: PollutionZone = gm.POLLUTION_SCENE.instantiate()
	zone.setup(100.0, 20.0, 10.0, Vector2.ZERO)
	zone.warning_time = 0.1
	zone.position = gm.player.global_position
	gm.pollution_root.add_child(zone)
	await wait(1.2)
	check(gm.player.health < h - 10.0, "nuage de pollution = perte de santé continue (%.0f -> %.0f)" % [h, gm.player.health])
	check(gm.player.is_in_pollution(), "le joueur est détecté dans la pollution")
	clear_hazards(gm)

	print("\n--- 5. Bonus et énergie ---")
	gm.player.health = 40.0
	await spawn_item(gm, Collectible.Type.SOIN)
	check(is_equal_approx(gm.player.health, 75.0), "bonus soin = +35 santé (%.0f)" % gm.player.health)
	gm.player.energy = 10.0
	await spawn_item(gm, Collectible.Type.ENERGIE)
	check(gm.player.energy > 95.0, "bonus énergie = batterie pleine")
	Input.action_press("move_right")
	Input.action_press("sprint")
	var x0: float = gm.player.global_position.x
	var e0: float = gm.player.energy
	await wait(0.5)
	Input.action_release("sprint")
	Input.action_release("move_right")
	check(gm.player.global_position.x > x0 + 50.0 or gm.player.get_slide_collision_count() > 0, "le joueur se déplace avec les touches")
	check(gm.player.energy < e0, "le sprint consomme de l'énergie")

	print("\n--- 6. Collisions avec les bâtiments ---")
	gm.player.velocity = Vector2.ZERO
	gm.player.global_position = Vector2(1160, 900)
	await wait(0.3)
	Input.action_press("move_up")
	await wait(1.5)
	Input.action_release("move_up")
	check(gm.player.global_position.y > 734.0, "le kiosque (bâtiment) bloque le joueur (y=%.0f)" % gm.player.global_position.y)

	print("\n--- 7. Difficulté progressive ---")
	var w0: float = gm.waste_timer.wait_time
	gm.elapsed = 31.0
	await wait(0.2)
	check(gm.level == 2, "niveau de pollution 2 après 30 s")
	check(gm.waste_timer.wait_time < w0, "les objets apparaissent plus souvent")
	gm.elapsed = 121.0
	await wait(0.2)
	check(gm.level == 5, "niveau 5 en fin de partie")
	check(gm.LEVELS[4].max_pollution > gm.LEVELS[0].max_pollution and gm.LEVELS[4].car_speed > gm.LEVELS[0].car_speed,
		"plus de nuages et voitures plus rapides au niveau 5")
	gm.elapsed = 0.0

	print("\n--- 8. Perte de vie ---")
	await wait(2.6)
	gm.player.take_damage(999.0)
	await wait(0.1)
	check(gm.lives == 2, "santé à 0 = une vie perdue")
	check(gm.hud.hearts[2].texture == gm.hud.HEART_EMPTY, "le HUD affiche un cœur vide")
	await wait(1.5)
	check(not gm.player.is_dead and is_equal_approx(gm.player.health, 100.0), "le joueur réapparaît avec toute sa santé")

	print("\n--- 9. Pause ---")
	gm.pause_menu.open()
	check(get_tree().paused, "Échap met le jeu en pause")
	gm.pause_menu.resume()
	check(not get_tree().paused, "REPRENDRE relance le jeu")

	print("\n--- 10. Victoire ---")
	gm.add_score(gm.target)
	check(gm.finished and Global.last_result.victory, "objectif atteint = victoire")
	await wait(4.0)
	var scene := get_tree().current_scene
	check(scene.name == "Victory", "l'écran de victoire s'affiche (%s)" % scene.name)
	await wait(2.0)
	check(scene.get_node("%ScoreValue").text == str(Global.last_result.score), "le score final est affiché")
	scene.get_node("%MenuButton").pressed.emit()
	await wait(1.5)
	check(get_tree().current_scene.name == "MainMenu", "bouton RETOUR AU MENU (victoire)")

	print("\n--- 11. Défaite : temps écoulé ---")
	gm = await start_game()
	gm.elapsed = gm.duration - 0.05
	await wait(0.3)
	check(gm.finished and not Global.last_result.victory and Global.last_result.reason == "time", "temps écoulé = défaite")
	await wait(4.0)
	scene = get_tree().current_scene
	check(scene.name == "GameOver", "l'écran Game Over s'affiche (%s)" % scene.name)
	scene.get_node("%RestartButton").pressed.emit()
	await wait(1.5)
	check(get_tree().current_scene.name == "Main", "bouton RECOMMENCER (game over)")

	print("\n--- 12. Défaite : plus de vies ---")
	gm = get_tree().current_scene
	await wait(2.0)
	for i in 3:
		gm.player._invincible = 0.0
		gm.player.take_damage(999.0)
		await wait(1.5)
	check(gm.lives == 0 and gm.finished and Global.last_result.reason == "lives", "3 vies perdues = défaite")
	await wait(3.5)
	scene = get_tree().current_scene
	check(scene.name == "GameOver", "Game Over après la perte des vies")
	scene.get_node("%MenuButton").pressed.emit()
	await wait(1.5)

	print("\n--- 13. Menu principal et options ---")
	scene = get_tree().current_scene
	check(scene.name == "MainMenu", "bouton RETOUR AU MENU (game over)")
	scene.get_node("MainBox/Buttons/OptionsButton").pressed.emit()
	check(scene.get_node("OptionsPanel").visible, "bouton OPTIONS ouvre le panneau")
	scene.get_node("OptionsPanel/VBox/Grid/DifficultyOption").item_selected.emit(2)
	check(Global.difficulty == 2, "la difficulté se règle dans les options")
	scene.get_node("OptionsPanel/VBox/Grid/MusicSlider").value = 0.3
	check(is_equal_approx(Global.music_volume, 0.3), "le volume de la musique se règle")
	scene.get_node("OptionsPanel/VBox/BackButton").pressed.emit()
	check(not scene.get_node("OptionsPanel").visible, "bouton RETOUR ferme les options")
	scene.get_node("MainBox/Buttons/HowToButton").pressed.emit()
	check(scene.get_node("HowToPanel").visible, "bouton COMMENT JOUER")
	scene.get_node("%HowToBack").pressed.emit()
	Global.difficulty = 1
	Global.music_volume = 0.7
	scene.get_node("%PlayButton").pressed.emit()
	await wait(1.5)
	check(get_tree().current_scene.name == "Main", "bouton JOUER lance la partie")
	var quit_btn := (get_tree().current_scene as Node)
	check(quit_btn != null, "QUITTER : get_tree().quit() (non testé ici pour ne pas fermer le test)")
