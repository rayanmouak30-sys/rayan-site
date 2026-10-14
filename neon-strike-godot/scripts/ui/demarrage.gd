extends Control
## Écran de démarrage : affiche le logo le temps du premier chargement puis ouvre le menu.

func _ready() -> void:
	if Test.actif and Test.arguments.get("scene_test", "") != "":
		return
	await get_tree().create_timer(0.4).timeout
	if ResourceLoader.exists(Jeu.SCENE_MENU):
		get_tree().change_scene_to_file(Jeu.SCENE_MENU)
