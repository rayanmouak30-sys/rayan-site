extends Node
## GLOBAL (autoload) : données partagées entre toutes les scènes.
## Réglages du joueur, difficulté, résultat de la dernière partie et record.

const SAVE_PATH := "user://eco_survivor.cfg"

## Paramètres de chaque difficulté (durée en secondes, score à atteindre, multiplicateur de dégâts)
const DIFFICULTIES := [
	{"name": "Facile", "duration": 180.0, "target": 800, "damage": 0.7},
	{"name": "Normal", "duration": 150.0, "target": 1000, "damage": 1.0},
	{"name": "Difficile", "duration": 150.0, "target": 1300, "damage": 1.3},
]

var music_volume := 0.7
var sfx_volume := 0.9
var difficulty := 1
var fullscreen := false
var screen_shake := true
var best_score := 0
## Résultat de la dernière partie (rempli par game_manager.gd, lu par les écrans de fin)
var last_result := {}


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	load_settings()
	apply_display()


func get_difficulty() -> Dictionary:
	return DIFFICULTIES[difficulty]


func apply_display() -> void:
	if OS.has_feature("web"):
		return
	if fullscreen:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)
	else:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)


## Enregistre le résultat et met à jour le record. Renvoie true si nouveau record.
func register_result(result: Dictionary) -> bool:
	var record := false
	if result.get("score", 0) > best_score:
		best_score = result.score
		record = true
	result["best_score"] = best_score
	result["new_record"] = record
	last_result = result
	save_settings()
	return record


func save_settings() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("audio", "music", music_volume)
	cfg.set_value("audio", "sfx", sfx_volume)
	cfg.set_value("game", "difficulty", difficulty)
	cfg.set_value("game", "screen_shake", screen_shake)
	cfg.set_value("game", "best_score", best_score)
	cfg.set_value("display", "fullscreen", fullscreen)
	cfg.save(SAVE_PATH)


func load_settings() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(SAVE_PATH) != OK:
		return
	music_volume = cfg.get_value("audio", "music", music_volume)
	sfx_volume = cfg.get_value("audio", "sfx", sfx_volume)
	difficulty = clampi(cfg.get_value("game", "difficulty", difficulty), 0, DIFFICULTIES.size() - 1)
	screen_shake = cfg.get_value("game", "screen_shake", screen_shake)
	best_score = cfg.get_value("game", "best_score", best_score)
	fullscreen = cfg.get_value("display", "fullscreen", fullscreen)
