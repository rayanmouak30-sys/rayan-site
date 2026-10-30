extends Control
## MENU PRINCIPAL : JOUER, COMMENT JOUER, OPTIONS, QUITTER.

@onready var background: TextureRect = $Background
@onready var logo: TextureRect = %Logo
@onready var buttons: VBoxContainer = %Buttons
@onready var how_to: Control = $HowToPanel
@onready var options: Control = $OptionsPanel
@onready var quit_message: Label = %QuitMessage
var _t := 0.0


func _ready() -> void:
	get_tree().paused = false
	AudioManager.play_music("menu")
	how_to.visible = false
	options.visible = false
	quit_message.visible = false
	%BestLabel.text = "RECORD : %d" % Global.best_score
	UiFx.setup_buttons(self)
	options.closed.connect(_show_main)
	%HowToBack.pressed.connect(_show_main)
	# animation d'entrée : logo puis boutons un par un
	logo.modulate.a = 0.0
	create_tween().tween_property(logo, "modulate:a", 1.0, 0.7)
	var i := 0
	for b in buttons.get_children():
		b.modulate.a = 0.0
		var t2 := create_tween()
		t2.tween_interval(0.25 + i * 0.09)
		t2.tween_property(b, "modulate:a", 1.0, 0.3)
		i += 1
	%PlayButton.grab_focus()


func _process(delta: float) -> void:
	_t += delta
	# la ville défile lentement en arrière-plan
	background.position = Vector2(-500.0 + sin(_t * 0.05) * 450.0, -300.0 + cos(_t * 0.07) * 250.0)
	logo.self_modulate = Color(1, 1, 1).lerp(Color(0.85, 1, 0.95), 0.5 + 0.5 * sin(_t * 2.0))


func _on_play_pressed() -> void:
	Transition.change_scene("res://scenes/Main.tscn")


func _on_how_to_pressed() -> void:
	%MainBox.visible = false
	UiFx.pop_in(how_to)
	%HowToBack.grab_focus()


func _on_options_pressed() -> void:
	%MainBox.visible = false
	options.open()


func _on_quit_pressed() -> void:
	if OS.has_feature("web"):
		# un jeu Web ne peut pas fermer l'onglet du navigateur
		quit_message.visible = true
		quit_message.text = "Merci d'avoir joué ! Ferme l'onglet du navigateur pour quitter."
	else:
		get_tree().quit()


func _show_main() -> void:
	how_to.visible = false
	options.visible = false
	%MainBox.visible = true
	%PlayButton.grab_focus()
