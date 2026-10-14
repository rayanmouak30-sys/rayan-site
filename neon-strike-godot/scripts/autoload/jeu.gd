extends Node
## Session de jeu : configuration de la partie en cours et changement d'écran.

signal partie_lancee
signal retour_menu

const SCENE_MENU := "res://scenes/menu.tscn"
const SCENE_PARTIE := "res://scenes/partie.tscn"

## Configuration de la partie : mode, carte, difficulté, alliés, personnage, en ligne...
var config := {
	"mode": "spike",
	"carte": "citadelle",
	"difficulte": "normal",
	"allies": true,
	"en_ligne": false,
}
var partie: Node = null   # scène de partie en cours


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS


func lancer_partie(c: Dictionary = {}) -> void:
	for cle in c:
		config[cle] = c[cle]
	if not config.has("heros"):
		config["heros"] = Profil.heros
	get_tree().paused = false
	get_tree().change_scene_to_file(SCENE_PARTIE)
	partie_lancee.emit()


func aller_au_menu() -> void:
	get_tree().paused = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	partie = null
	if Reseau.actif():
		Reseau.quitter()
	get_tree().change_scene_to_file(SCENE_MENU)
	retour_menu.emit()


func quitter_jeu() -> void:
	Reglages.sauver()
	get_tree().quit()
