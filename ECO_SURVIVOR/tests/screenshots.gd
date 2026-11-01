extends Node
## Prend des captures d'écran du jeu (nécessite un affichage, pas --headless).

var worker := false
var out_dir := "user://shots"


func _ready() -> void:
	if not worker:
		var w: Node = load("res://tests/screenshots.gd").new()
		w.worker = true
		get_tree().root.add_child.call_deferred(w)
		return
	process_mode = Node.PROCESS_MODE_ALWAYS
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out_dir = args[0]
	DirAccess.make_dir_recursive_absolute(out_dir)
	get_tree().change_scene_to_file("res://scenes/MainMenu.tscn")
	await wait(2.5)
	shot("1_menu")
	get_tree().current_scene.get_node("MainBox/Buttons/HowToButton").pressed.emit()
	await wait(0.6)
	shot("2_comment_jouer")
	get_tree().change_scene_to_file("res://scenes/Main.tscn")
	await wait(0.6)
	shot("3_pret")
	await wait(2.0)
	var gm := get_tree().current_scene
	Input.action_press("move_right")
	await wait(1.2)
	Input.action_release("move_right")
	Input.action_press("move_down")
	await wait(0.8)
	Input.action_release("move_down")
	gm.elapsed = 62.0
	await wait(3.5)
	for i in 3:
		gm._on_pollution_timer()
		gm._on_toxic_timer()
		gm._on_car_timer()
	gm.add_score(430)
	await wait(2.5)
	shot("4_jeu")
	gm.pause_menu.open()
	await wait(0.5)
	shot("5_pause")
	gm.pause_menu.resume()
	gm.add_score(1000)
	await wait(4.5)
	shot("6_victoire")
	get_tree().change_scene_to_file("res://scenes/Main.tscn")
	await wait(2.2)
	gm = get_tree().current_scene
	gm.elapsed = gm.duration
	await wait(4.5)
	shot("7_game_over")
	get_tree().quit()


func wait(sec: float) -> void:
	await get_tree().create_timer(sec, true, true).timeout


func shot(name: String) -> void:
	var img := get_viewport().get_texture().get_image()
	img.save_png(out_dir.path_join(name + ".png"))
	print("capture ", name)
