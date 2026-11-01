extends CanvasLayer
## MENU PAUSE : Échap ou P met le jeu en pause (get_tree().paused).

var can_pause := true

@onready var panel: Control = $Panel
@onready var options: Control = $OptionsPanel


func _ready() -> void:
	visible = false
	options.visible = false
	UiFx.setup_buttons(self)
	%ResumeButton.pressed.connect(resume)
	%RestartButton.pressed.connect(func(): Transition.change_scene("res://scenes/Main.tscn"))
	%OptionsButton.pressed.connect(_open_options)
	%MenuButton.pressed.connect(func(): Transition.change_scene("res://scenes/MainMenu.tscn"))
	options.closed.connect(_on_options_closed)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause"):
		if visible:
			resume()
		elif can_pause:
			open()
		get_viewport().set_input_as_handled()


func open() -> void:
	get_tree().paused = true
	visible = true
	options.visible = false
	UiFx.pop_in(panel)
	%ResumeButton.grab_focus()


func resume() -> void:
	get_tree().paused = false
	visible = false


func _open_options() -> void:
	panel.visible = false
	options.open()


func _on_options_closed() -> void:
	panel.visible = true
	%OptionsButton.grab_focus()
