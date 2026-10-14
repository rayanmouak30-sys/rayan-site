extends Control
## Menu pause : reprendre, réglages, quitter la partie (la partie continue derrière, comme en ligne).

var reglages: Control


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = Style.theme()
	process_mode = Node.PROCESS_MODE_ALWAYS
	var voile := ColorRect.new()
	voile.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	voile.color = Color(0.02, 0.03, 0.05, 0.75)
	add_child(voile)
	var v := VBoxContainer.new()
	v.anchor_left = 0.5
	v.anchor_right = 0.5
	v.anchor_top = 0.5
	v.anchor_bottom = 0.5
	v.offset_left = -200
	v.offset_right = 200
	v.offset_top = -200
	v.offset_bottom = 200
	v.add_theme_constant_override("separation", 12)
	add_child(v)
	var t := Style.etiquette("PAUSE", 54, Style.TEXTE, true, 700)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(t)
	var reprendre := Style.bouton("REPRENDRE", 26, 400, 60)
	reprendre.pressed.connect(func() -> void: Jeu.partie.basculer_pause())
	v.add_child(reprendre)
	var regl := Style.bouton("RÉGLAGES", 26, 400, 60)
	regl.pressed.connect(func() -> void:
		reglages = load("res://scripts/ui/page_reglages.gd").new()
		add_child(reglages)
		reglages.retour.connect(reglages.queue_free))
	v.add_child(regl)
	var quitter := Style.bouton("QUITTER LA PARTIE", 26, 400, 60)
	quitter.pressed.connect(func() -> void: Jeu.aller_au_menu())
	v.add_child(quitter)
	var aide := Style.etiquette("%s : reprendre" % Reglages.touche("pause"), 15, Style.TEXTE2, false, 500)
	aide.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(aide)
