extends Control
## Fin de partie : victoire / défaite, statistiques du joueur, XP gagnée et progression de niveau.

var partie: Node
var victoire := false


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = Style.theme()
	var voile := ColorRect.new()
	voile.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	voile.color = Color(0.02, 0.025, 0.04, 0.0)
	add_child(voile)
	var tw := create_tween()
	tw.tween_property(voile, "color:a", 0.88, 0.6)
	var j: Combattant = partie.joueur
	var xp := 250 + (250 if victoire else 0) + j.kills * 25 + j.tetes * 10
	var niveaux := Profil.gagner_xp(xp)
	Profil.noter_partie(j.kills, j.morts, j.tetes, victoire)
	var v := VBoxContainer.new()
	v.anchor_left = 0.5
	v.anchor_right = 0.5
	v.anchor_top = 0.5
	v.anchor_bottom = 0.5
	v.offset_left = -360
	v.offset_right = 360
	v.offset_top = -300
	v.offset_bottom = 300
	v.add_theme_constant_override("separation", 14)
	add_child(v)
	var t := Style.ombre(Style.etiquette("VICTOIRE" if victoire else "DÉFAITE", 96, Style.OK if victoire else Style.ROUGE, true, 700), 4)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(t)
	var mode: Mode = partie.mode
	var s := Style.etiquette("%d  —  %d" % [int(mode.score.get("bleu", 0)), int(mode.score.get("rouge", 0))], 36, Style.TEXTE, true, 700)
	s.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(s)
	var stats := Style.etiquette("%d éliminations · %d morts · %d tirs à la tête · %d dégâts" % [j.kills, j.morts, j.tetes, int(j.degats_infliges)], 20, Style.TEXTE2, false, 500)
	stats.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(stats)
	var lxp := Style.etiquette("+%d XP" % xp, 34, Style.ACCENT2, true, 700)
	lxp.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(lxp)
	if niveaux > 0:
		var ln := Style.etiquette("NIVEAU %d ATTEINT ! +%d point(s) de skin" % [Profil.niveau, niveaux], 24, Style.ACCENT, true, 700)
		ln.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		v.add_child(ln)
	var fond := ColorRect.new()
	fond.custom_minimum_size = Vector2(720, 10)
	fond.color = Color(1, 1, 1, 0.1)
	v.add_child(fond)
	var barre := ColorRect.new()
	barre.color = Style.ACCENT2
	barre.size = Vector2(0, 10)
	fond.add_child(barre)
	var tw2 := create_tween()
	tw2.tween_property(barre, "size:x", 720.0 * float(Profil.donnees["xp"]) / Profil.xp_niveau(Profil.niveau), 1.2).set_delay(0.5)
	var h := HBoxContainer.new()
	h.alignment = BoxContainer.ALIGNMENT_CENTER
	h.add_theme_constant_override("separation", 16)
	v.add_child(h)
	var rejouer := Style.bouton("REJOUER", 24, 240, 58)
	rejouer.pressed.connect(func() -> void: Jeu.lancer_partie({}))
	h.add_child(rejouer)
	var menu := Style.bouton("MENU PRINCIPAL", 24, 280, 58)
	menu.pressed.connect(func() -> void: Jeu.aller_au_menu())
	h.add_child(menu)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
