extends Control
## Réglages : graphismes, son, contrôles (sensibilité et touches clavier / souris / manette) et éditeur de viseur
## avec aperçu en direct. Utilisé dans le menu principal et dans le menu pause.

signal retour

var onglets: TabContainer
var apercu: Viseur
var attente_touche := {}     # {"action": id, "emplacement": n, "bouton": Button}
var lignes_touches := {}


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = Style.theme()
	var voile := ColorRect.new()
	voile.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	voile.color = Color(0.02, 0.025, 0.04, 0.9)
	add_child(voile)
	var cadre := PanelContainer.new()
	cadre.anchor_left = 0.5
	cadre.anchor_right = 0.5
	cadre.anchor_top = 0.5
	cadre.anchor_bottom = 0.5
	cadre.offset_left = -620
	cadre.offset_right = 620
	cadre.offset_top = -400
	cadre.offset_bottom = 400
	add_child(cadre)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	cadre.add_child(v)
	var haut := HBoxContainer.new()
	v.add_child(haut)
	var t := Style.etiquette("RÉGLAGES", 40, Style.TEXTE, true, 700)
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	haut.add_child(t)
	var fermer := Style.bouton("FERMER", 20, 140, 44)
	fermer.pressed.connect(func() -> void: retour.emit())
	haut.add_child(fermer)
	onglets = TabContainer.new()
	onglets.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(onglets)
	_graphismes()
	_son()
	_controles()
	_touches()
	_viseur()


func _page(nom: String) -> VBoxContainer:
	var defil := ScrollContainer.new()
	defil.name = nom
	defil.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	onglets.add_child(defil)
	var v := VBoxContainer.new()
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.add_theme_constant_override("separation", 10)
	defil.add_child(v)
	var marge := Control.new()
	marge.custom_minimum_size.y = 6
	v.add_child(marge)
	return v


func _ligne(parent: Control, texte: String, ctrl: Control, aide := "") -> void:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 16)
	parent.add_child(h)
	var l := Style.etiquette(texte, 18, Style.TEXTE, false, 500)
	l.custom_minimum_size.x = 360
	if aide != "":
		l.tooltip_text = aide
		l.mouse_filter = Control.MOUSE_FILTER_PASS
	h.add_child(l)
	ctrl.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN if ctrl is CheckButton else Control.SIZE_EXPAND_FILL
	h.add_child(ctrl)


func _curseur(cle: String, bas: float, haut: float, pas: float, format := "%.2f", facteur := 1.0) -> Control:
	var h := HBoxContainer.new()
	var s := HSlider.new()
	s.min_value = bas
	s.max_value = haut
	s.step = pas
	s.value = float(Reglages.lire(cle))
	s.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	s.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var l := Style.etiquette(format % (s.value * facteur), 18, Style.ACCENT, true, 700)
	l.custom_minimum_size.x = 80
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	s.value_changed.connect(func(x: float) -> void:
		l.text = format % (x * facteur)
		Reglages.ecrire(cle, x, false)
		if apercu:
			apercu.queue_redraw())
	s.drag_ended.connect(func(_c: bool) -> void: Reglages.sauver())
	h.add_child(s)
	h.add_child(l)
	return h


func _case(cle: String) -> CheckButton:
	var c := CheckButton.new()
	c.button_pressed = bool(Reglages.lire(cle))
	c.focus_mode = Control.FOCUS_NONE
	c.toggled.connect(func(x: bool) -> void:
		Reglages.ecrire(cle, x)
		if apercu:
			apercu.queue_redraw())
	return c


func _choix(cle: String, options: Array) -> OptionButton:
	var o := OptionButton.new()
	o.focus_mode = Control.FOCUS_NONE
	for i in options.size():
		o.add_item(options[i][1], i)
		if str(Reglages.lire(cle)) == str(options[i][0]):
			o.selected = i
	o.item_selected.connect(func(i: int) -> void: Reglages.ecrire(cle, options[i][0]))
	return o


func _graphismes() -> void:
	var v := _page("Graphismes")
	_ligne(v, "Qualité", _choix("qualite", [["auto", "Automatique (selon la carte graphique)"], ["bas", "Basse (PC portable)"], ["moyen", "Moyenne"], ["haut", "Haute"], ["ultra", "Ultra"]]), "Prise en compte à la prochaine partie")
	_ligne(v, "Plein écran", _case("plein_ecran"))
	_ligne(v, "Synchronisation verticale", _case("vsync"))
	_ligne(v, "Images par seconde max (0 = illimité)", _curseur("fps_max", 0, 300, 10, "%d"))
	_ligne(v, "Échelle de rendu (FSR en dessous de 100 %)", _curseur("echelle_rendu", 0.5, 1.0, 0.05, "%d %%", 100.0))
	_ligne(v, "Champ de vision (horizontal)", _curseur("fov", 80, 120, 1, "%d°"))
	_ligne(v, "Luminosité", _curseur("luminosite", 0.6, 1.6, 0.05, "%.2f"))
	_ligne(v, "Afficher les images par seconde", _case("afficher_fps"))
	_ligne(v, "Balancement de l'arme", _curseur("balancement", 0.0, 1.5, 0.05, "%.2f"))


func _son() -> void:
	var v := _page("Son")
	_ligne(v, "Volume général", _curseur("volume_general", 0, 1, 0.01, "%d %%", 100.0))
	_ligne(v, "Effets (tirs, pas, capacités)", _curseur("volume_effets", 0, 1, 0.01, "%d %%", 100.0))
	_ligne(v, "Musique", _curseur("volume_musique", 0, 1, 0.01, "%d %%", 100.0))
	_ligne(v, "Voix et annonces", _curseur("volume_voix", 0, 1, 0.01, "%d %%", 100.0))


func _controles() -> void:
	var v := _page("Souris et manette")
	_ligne(v, "Sensibilité de la souris", _curseur("sensibilite", 0.1, 4.0, 0.01, "%.2f"))
	_ligne(v, "Sensibilité en visée (multiplicateur)", _curseur("sensibilite_visee", 0.3, 1.5, 0.01, "%.2f"))
	_ligne(v, "Sensibilité de la manette", _curseur("sensibilite_manette", 0.2, 3.0, 0.05, "%.2f"))
	_ligne(v, "Inverser l'axe vertical", _case("inverser_y"))


func _touches() -> void:
	var v := _page("Touches")
	var aide := Style.etiquette("Cliquez sur une touche puis appuyez sur la nouvelle (clavier ou souris). Échap pour annuler.", 15, Style.TEXTE2, false, 500)
	aide.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(aide)
	for a in Reglages.ACTIONS:
		var h := HBoxContainer.new()
		h.add_theme_constant_override("separation", 10)
		v.add_child(h)
		var l := Style.etiquette(String(a[1]), 17, Style.TEXTE, false, 500)
		l.custom_minimum_size.x = 360
		h.add_child(l)
		var boutons := []
		for e in 2:
			var b := Style.bouton("", 16, 200, 38)
			var action: String = a[0]
			var emp := e
			b.pressed.connect(func() -> void: _attendre_touche(action, emp, b))
			h.add_child(b)
			boutons.append(b)
		var m := Style.etiquette("", 15, Style.TEXTE2, true, 600)
		m.custom_minimum_size.x = 110
		h.add_child(m)
		lignes_touches[a[0]] = [boutons, m]
	var reinit := Style.bouton("RÉTABLIR LES TOUCHES PAR DÉFAUT", 18, 0, 46)
	reinit.pressed.connect(func() -> void:
		Reglages.reinitialiser_touches()
		_maj_touches())
	v.add_child(reinit)
	_maj_touches()


func _maj_touches() -> void:
	for a in lignes_touches:
		var l: Array = Reglages.liaisons.get(a, [])
		var boutons: Array = lignes_touches[a][0]
		for e in 2:
			(boutons[e] as Button).text = Reglages.nom_liaison(l[e]) if e < l.size() else "—"
		var mm: Array = Reglages.liaisons_manette.get(a, [])
		(lignes_touches[a][1] as Label).text = ("🎮 " + Reglages.nom_bouton_manette(int(mm[0]))) if not mm.is_empty() else ""


func _attendre_touche(action: String, emplacement: int, b: Button) -> void:
	attente_touche = {"action": action, "emplacement": emplacement, "bouton": b}
	b.text = "…"


func _input(event: InputEvent) -> void:
	if attente_touche.is_empty() or not is_visible_in_tree():
		return
	var liaison: Variant = null
	if event is InputEventKey and event.pressed and not event.echo:
		var k := event as InputEventKey
		if k.physical_keycode == KEY_ESCAPE:
			attente_touche = {}
			_maj_touches()
			get_viewport().set_input_as_handled()
			return
		liaison = int(k.physical_keycode)
	elif event is InputEventMouseButton and event.pressed:
		liaison = "souris:%d" % (event as InputEventMouseButton).button_index
	if liaison != null:
		Reglages.lier(attente_touche["action"], attente_touche["emplacement"], liaison)
		attente_touche = {}
		_maj_touches()
		get_viewport().set_input_as_handled()


func _viseur() -> void:
	var v := _page("Viseur")
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 24)
	v.add_child(h)
	var reglages := VBoxContainer.new()
	reglages.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	reglages.add_theme_constant_override("separation", 10)
	h.add_child(reglages)
	# Couleurs prédéfinies
	var couleurs := HBoxContainer.new()
	couleurs.add_theme_constant_override("separation", 8)
	for c in [Color(0.49, 1.0, 0.83), Color(0.2, 1.0, 0.3), Color(1.0, 1.0, 0.2), Color(0.0, 1.0, 1.0), Color(1.0, 0.3, 1.0), Color(1, 1, 1), Color(1.0, 0.3, 0.3)]:
		var b := Button.new()
		b.custom_minimum_size = Vector2(38, 38)
		b.focus_mode = Control.FOCUS_NONE
		b.add_theme_stylebox_override("normal", Style.boite(c, 6, Color(0, 0, 0, 0.6), 2, 0))
		b.add_theme_stylebox_override("hover", Style.boite(c, 6, Color.WHITE, 2, 0))
		var cc: Color = c
		b.pressed.connect(func() -> void:
			Reglages.ecrire("viseur_couleur", cc)
			apercu.queue_redraw())
		couleurs.add_child(b)
	_ligne(reglages, "Couleur", couleurs)
	_ligne(reglages, "Longueur des traits", _curseur("viseur_longueur", 0, 20, 1, "%d"))
	_ligne(reglages, "Épaisseur", _curseur("viseur_epaisseur", 1, 6, 1, "%d"))
	_ligne(reglages, "Écart au centre", _curseur("viseur_ecart", 0, 20, 1, "%d"))
	_ligne(reglages, "Point central", _case("viseur_point"))
	_ligne(reglages, "Contour noir", _case("viseur_contour"))
	_ligne(reglages, "Écart dynamique (mouvement, rafale)", _case("viseur_dynamique"))
	# Aperçu sur un fond de jeu
	var fond := PanelContainer.new()
	fond.custom_minimum_size = Vector2(300, 300)
	fond.add_theme_stylebox_override("panel", Style.boite(Color(0.35, 0.42, 0.5), 8, Color(1, 1, 1, 0.1), 1, 0))
	h.add_child(fond)
	var degrade := TextureRect.new()
	var gt := GradientTexture2D.new()
	var g := Gradient.new()
	g.colors = PackedColorArray([Color(0.55, 0.62, 0.72), Color(0.25, 0.28, 0.32)])
	gt.gradient = g
	gt.fill_to = Vector2(0, 1)
	degrade.texture = gt
	degrade.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	fond.add_child(degrade)
	apercu = Viseur.new()
	fond.add_child(apercu)
