class_name UiFx
extends RefCounted
## Animations et sons communs à tous les boutons (survol = grossit, clic = son).


static func setup_buttons(root: Node) -> void:
	for node in root.find_children("*", "BaseButton", true, false):
		var btn := node as BaseButton
		btn.mouse_entered.connect(_hover.bind(btn, true))
		btn.mouse_exited.connect(_hover.bind(btn, false))
		btn.focus_entered.connect(_hover.bind(btn, true))
		btn.focus_exited.connect(_hover.bind(btn, false))
		btn.pressed.connect(func(): AudioManager.play_sfx("ui_click"))


static func _hover(btn: BaseButton, on: bool) -> void:
	if not btn.is_inside_tree() or not (btn is Button) or btn is CheckButton:
		return
	btn.pivot_offset = btn.size / 2.0
	var tw := btn.create_tween()
	tw.tween_property(btn, "scale", Vector2.ONE * (1.06 if on else 1.0), 0.12)
	if on:
		AudioManager.play_sfx("ui_hover")


## Fait apparaître un panneau (fondu + zoom).
static func pop_in(panel: Control) -> void:
	panel.visible = true
	panel.pivot_offset = panel.size / 2.0
	panel.scale = Vector2(0.85, 0.85)
	panel.modulate.a = 0.0
	var tw := panel.create_tween().set_parallel()
	tw.tween_property(panel, "scale", Vector2.ONE, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(panel, "modulate:a", 1.0, 0.2)
