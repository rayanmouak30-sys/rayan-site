extends Control
## Tableau des scores (maintenir Tab) : les deux équipes, agent, éliminations / morts / assistances, crédits.

var partie: Node
var colonnes := {}


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = Style.theme()
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	visible = false


func actualiser() -> void:
	for c in get_children():
		c.queue_free()
	var v := VBoxContainer.new()
	v.anchor_left = 0.5
	v.anchor_right = 0.5
	v.anchor_top = 0.5
	v.anchor_bottom = 0.5
	v.offset_left = -520
	v.offset_right = 520
	v.offset_top = -330
	v.offset_bottom = 330
	v.add_theme_constant_override("separation", 14)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(v)
	var mode: Mode = partie.mode
	var titre := Style.ombre(Style.etiquette("%d  —  %d" % [int(mode.score.get("bleu", 0)), int(mode.score.get("rouge", 0))], 44, Style.TEXTE, true, 700))
	titre.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(titre)
	for eq in ["bleu", "rouge"]:
		var p := PanelContainer.new()
		var couleur := Style.couleur_equipe(eq)
		p.add_theme_stylebox_override("panel", Style.boite(Color(0.03, 0.04, 0.07, 0.88), 8, Color(couleur.r, couleur.g, couleur.b, 0.5), 1, 14))
		v.add_child(p)
		var g := GridContainer.new()
		g.columns = 6
		g.add_theme_constant_override("h_separation", 26)
		g.add_theme_constant_override("v_separation", 6)
		p.add_child(g)
		for t in ["", "JOUEUR", "É", "M", "DÉGÂTS", "CRÉDITS"]:
			g.add_child(Style.etiquette(t, 13, Style.TEXTE2, true, 700))
		var liste: Array = partie.combattants.filter(func(c: Combattant) -> bool: return c.equipe == eq and not (c is Cible))
		liste.sort_custom(func(a: Combattant, b: Combattant) -> bool: return a.kills > b.kills)
		for c in liste:
			var cb: Combattant = c
			var portrait := TextureRect.new()
			var ch := "res://assets/portraits/%s.png" % cb.heros
			if ResourceLoader.exists(ch):
				portrait.texture = load(ch)
			portrait.custom_minimum_size = Vector2(40, 40)
			portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
			portrait.modulate = Color(1, 1, 1, 1.0 if cb.vivant else 0.35)
			g.add_child(portrait)
			var nom := cb.nom_affiche + ("  (vous)" if cb == partie.joueur else "")
			var ln := Style.etiquette(nom, 18, Style.ACCENT2 if cb == partie.joueur else Style.TEXTE, true, 700)
			ln.custom_minimum_size.x = 380
			g.add_child(ln)
			g.add_child(Style.etiquette(str(cb.kills), 18, Style.TEXTE, true, 700))
			g.add_child(Style.etiquette(str(cb.morts), 18, Style.TEXTE, true, 700))
			g.add_child(Style.etiquette(str(int(cb.degats_infliges)), 18, Style.TEXTE2, true, 600))
			g.add_child(Style.etiquette("¤ %d" % cb.credits if cb.credits >= 0 and (eq == partie.joueur.equipe) else "", 18, Style.ACCENT2, true, 600))
