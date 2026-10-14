extends Node
## Tests automatiques : lancés avec  godot --path . -- --scenario=<nom> --sortie=<dossier>
## Le scénario (scripts/tests/scenario_<nom>.gd) pilote le jeu, prend des captures et affiche des mesures.

var actif := false
var scenario := ""
var sortie := ""
var arguments := {}


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--") and a.contains("="):
			var p := a.substr(2).split("=", true, 1)
			arguments[p[0]] = p[1]
		elif a.begins_with("--"):
			arguments[a.substr(2)] = "1"
	scenario = arguments.get("scenario", "")
	sortie = arguments.get("sortie", OS.get_user_data_dir())
	actif = scenario != ""
	if actif:
		# Rendu logiciel lent : la physique doit rattraper le temps réel pour que les durées restent justes
		Engine.max_physics_steps_per_frame = 64
		get_window().size = Vector2i(int(arguments.get("largeur", "1280")), int(arguments.get("hauteur", "720")))
		_lancer.call_deferred()


func _lancer() -> void:
	var chemin := "res://scripts/tests/scenario_%s.gd" % scenario
	if not ResourceLoader.exists(chemin):
		printerr("TEST : scénario introuvable ", chemin)
		get_tree().quit(2)
		return
	var script: Script = load(chemin)
	if script == null or not script.can_instantiate():
		printerr("TEST : scénario invalide ", chemin)
		get_tree().quit(3)
		return
	var s: Node = script.new()
	s.name = "Scenario"
	add_child(s)
	print("TEST : début du scénario ", scenario)
	await s.executer()
	print("TEST : fin du scénario ", scenario)
	get_tree().quit(0)


## Retire la scène courante (pour afficher un monde de test à la place)
func vider_scene() -> void:
	var sc := get_tree().current_scene
	if sc:
		sc.queue_free()
	await get_tree().process_frame


## Attend n secondes de jeu (temps réel du moteur)
func attendre(secondes: float) -> void:
	await get_tree().create_timer(secondes, true, false, true).timeout


func attendre_images(n: int) -> void:
	for i in n:
		await get_tree().process_frame


## Capture de l'écran (PNG) dans le dossier de sortie
func capture(nom: String) -> void:
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	var chemin := sortie.path_join(nom + ".png")
	img.save_png(chemin)
	print("TEST : capture ", chemin)


func mesure(nom: String, valeur: Variant) -> void:
	print("MESURE %s = %s" % [nom, str(valeur)])
