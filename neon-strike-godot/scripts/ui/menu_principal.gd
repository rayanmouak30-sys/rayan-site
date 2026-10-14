extends Control
## Menu principal : vitrine 3D du héros choisi, navigation (Jouer, Agents, Arsenal, Multijoueur, Réglages, Quitter),
## carte de profil (niveau, XP, points de skins), choix du mode, de la carte et de la difficulté.

var fond: ColorRect
var vitrine: Vitrine3D
var nav: VBoxContainer
var page_jouer: Control
var page_courante: Control
var profil_box: PanelContainer
var choix := {"mode": "spike", "carte": "citadelle", "difficulte": "normal", "allies": true}
var musique: AudioStreamPlayer


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = Style.theme()
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	get_tree().paused = false
	fond = ColorRect.new()
	fond.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var sm := ShaderMaterial.new()
	sm.shader = load("res://assets/shaders/fond_menu.gdshader")
	fond.material = sm
	add_child(fond)
	vitrine = Vitrine3D.new()
	vitrine.anchor_left = 0.42
	vitrine.anchor_right = 1.0
	vitrine.anchor_top = 0.02
	vitrine.anchor_bottom = 1.0
	add_child(vitrine)
	_menu_gauche()
	_profil()
	_page_jouer()
	_montrer_heros()
	Profil.change.connect(_montrer_heros)
	_musique()


func _musique() -> void:
	musique = AudioStreamPlayer.new()
	musique.bus = "Musique"
	if ResourceLoader.exists("res://assets/sons/musique_menu.ogg"):
		var flux: AudioStreamOggVorbis = load("res://assets/sons/musique_menu.ogg")
		flux.loop = true
		musique.stream = flux
		musique.volume_db = -6.0
		add_child(musique)
		musique.play()


func _montrer_heros() -> void:
	vitrine.montrer(Profil.heros, Profil.skin_heros(Profil.heros))
	(fond.material as ShaderMaterial).set_shader_parameter("teinte", DonneesHeros.couleur_categorie(Profil.heros))
	_maj_profil()


func _menu_gauche() -> void:
	nav = VBoxContainer.new()
	nav.anchor_bottom = 1.0
	nav.offset_left = 70
	nav.offset_top = 80
	nav.offset_bottom = -60
	nav.offset_right = 520
	nav.add_theme_constant_override("separation", 4)
	add_child(nav)
	var boite_logo := VBoxContainer.new()
	boite_logo.add_theme_constant_override("separation", -34)
	nav.add_child(boite_logo)
	boite_logo.add_child(Style.ombre(Style.etiquette("NEON", 96, Style.TEXTE, true, 700), 4))
	boite_logo.add_child(Style.ombre(Style.etiquette("STRIKE", 96, Style.ACCENT, true, 700), 4))
	var sous := Style.etiquette("TACTIQUE · 5 CONTRE 5 · 20 AGENTS", 16, Style.TEXTE2, true, 600)
	nav.add_child(sous)
	var esp := Control.new()
	esp.custom_minimum_size.y = 40
	nav.add_child(esp)
	var entrees := [
		["JOUER", func() -> void: _ouvrir(page_jouer)],
		["AGENTS", _agents],
		["ARSENAL", _arsenal],
		["MULTIJOUEUR", _multijoueur],
		["RÉGLAGES", _reglages],
		["QUITTER", func() -> void: Jeu.quitter_jeu()],
	]
	for e in entrees:
		var b := Style.bouton_nav(e[0])
		b.pressed.connect(e[1])
		nav.add_child(b)
	var bas := Control.new()
	bas.size_flags_vertical = Control.SIZE_EXPAND_FILL
	nav.add_child(bas)
	nav.add_child(Style.etiquette("Version 1.0 · Godot", 13, Style.TEXTE2, false, 400))


func _profil() -> void:
	profil_box = PanelContainer.new()
	profil_box.anchor_left = 1.0
	profil_box.anchor_right = 1.0
	profil_box.offset_left = -360
	profil_box.offset_right = -40
	profil_box.offset_top = 36
	add_child(profil_box)


func _maj_profil() -> void:
	for c in profil_box.get_children():
		c.queue_free()
	var v := VBoxContainer.new()
	profil_box.add_child(v)
	var h := HBoxContainer.new()
	v.add_child(h)
	var pseudo := String(Reglages.lire("pseudo"))
	var n := Style.etiquette(pseudo if pseudo != "" else "AGENT", 22, Style.TEXTE, true, 700)
	n.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(n)
	h.add_child(Style.badge("NIV. %d" % Profil.niveau, Style.ACCENT2, 16))
	var fond_xp := ColorRect.new()
	fond_xp.custom_minimum_size = Vector2(280, 6)
	fond_xp.color = Color(1, 1, 1, 0.1)
	v.add_child(fond_xp)
	var xp := ColorRect.new()
	xp.color = Style.ACCENT2
	xp.size = Vector2(280.0 * float(Profil.donnees["xp"]) / Profil.xp_niveau(Profil.niveau), 6)
	fond_xp.add_child(xp)
	var s: Dictionary = Profil.donnees["stats"]
	v.add_child(Style.etiquette("%d XP / %d · %d point(s) de skin" % [int(Profil.donnees["xp"]), Profil.xp_niveau(Profil.niveau), int(Profil.donnees["points_skins"])], 13, Style.TEXTE2, false, 500))
	v.add_child(Style.etiquette("%d parties · %d victoires · %d éliminations" % [int(s["parties"]), int(s["victoires"]), int(s["kills"])], 13, Style.TEXTE2, false, 500))
	var h2 := DonneesHeros.heros(Profil.heros)
	v.add_child(Style.etiquette("Agent : " + String(h2["nom"]), 15, DonneesHeros.couleur_categorie(Profil.heros), true, 700))


func _ouvrir(p: Control) -> void:
	if page_courante and page_courante != p:
		page_courante.visible = false
	page_courante = p
	p.visible = true


func _page_jouer() -> void:
	page_jouer = PanelContainer.new()
	page_jouer.anchor_left = 0.0
	page_jouer.anchor_top = 1.0
	page_jouer.anchor_bottom = 1.0
	page_jouer.offset_left = 420
	page_jouer.offset_right = 1120
	page_jouer.offset_top = -560
	page_jouer.offset_bottom = -60
	page_jouer.visible = false
	add_child(page_jouer)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	page_jouer.add_child(v)
	v.add_child(Style.etiquette("MODE DE JEU", 18, Style.TEXTE2, true, 700))
	var modes := GridContainer.new()
	modes.columns = 2
	modes.add_theme_constant_override("h_separation", 10)
	modes.add_theme_constant_override("v_separation", 10)
	v.add_child(modes)
	var groupe_modes := ButtonGroup.new()
	for m in [["spike", "SPIKE", "Attaque / défense, poser ou désamorcer · 7 manches"], ["elimination", "ÉLIMINATION", "Éliminez l'équipe adverse · 7 manches"],
			["dm", "COMBAT À MORT", "5 contre 5, réapparition · 40 éliminations"], ["stand", "STAND DE TIR", "Entraînement, cibles à 10, 20, 30 et 50 m"]]:
		var b := _carte_option(m[1], m[2], groupe_modes, choix["mode"] == m[0])
		var id: String = m[0]
		b.pressed.connect(func() -> void: choix["mode"] = id)
		modes.add_child(b)
	v.add_child(Style.etiquette("DIFFICULTÉ DES BOTS", 18, Style.TEXTE2, true, 700))
	var diff := HBoxContainer.new()
	diff.add_theme_constant_override("separation", 8)
	v.add_child(diff)
	var groupe_diff := ButtonGroup.new()
	for d in [["facile", "FACILE"], ["normal", "NORMAL"], ["difficile", "DIFFICILE"], ["expert", "EXPERT"]]:
		var b := Style.bouton(d[1], 18, 150, 44)
		b.toggle_mode = true
		b.button_group = groupe_diff
		b.button_pressed = choix["difficulte"] == d[0]
		var id: String = d[0]
		b.pressed.connect(func() -> void: choix["difficulte"] = id)
		diff.add_child(b)
	var allies := CheckButton.new()
	allies.text = "Bots alliés (sinon vous êtes seul contre 5)"
	allies.button_pressed = true
	allies.focus_mode = Control.FOCUS_NONE
	allies.toggled.connect(func(x: bool) -> void: choix["allies"] = x)
	v.add_child(allies)
	v.add_child(Style.etiquette("CARTE : CITADELLE (deux sites, trois couloirs)", 16, Style.TEXTE2, true, 600))
	var lancer := Style.bouton("CHOISIR L'AGENT ›", 28, 0, 64)
	lancer.add_theme_stylebox_override("normal", Style.boite(Color(0.1, 0.35, 0.3, 0.95), 8, Style.ACCENT, 2, 16))
	lancer.pressed.connect(_choisir_agent)
	v.add_child(lancer)


func _carte_option(titre: String, texte: String, groupe: ButtonGroup, actif: bool) -> Button:
	var b := Button.new()
	b.toggle_mode = true
	b.button_group = groupe
	b.button_pressed = actif
	b.focus_mode = Control.FOCUS_NONE
	b.custom_minimum_size = Vector2(330, 84)
	b.add_theme_stylebox_override("normal", Style.boite(Color(0.08, 0.1, 0.15, 0.9), 8, Color(1, 1, 1, 0.08), 1, 14))
	b.add_theme_stylebox_override("hover", Style.boite(Color(0.12, 0.16, 0.22, 0.95), 8, Style.ACCENT * Color(1, 1, 1, 0.6), 1, 14))
	b.add_theme_stylebox_override("pressed", Style.boite(Color(0.1, 0.28, 0.26, 0.95), 8, Style.ACCENT, 2, 14))
	var v := VBoxContainer.new()
	v.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	v.offset_left = 16
	v.offset_top = 10
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(v)
	v.add_child(Style.etiquette(titre, 22, Style.TEXTE, true, 700))
	var l := Style.etiquette(texte, 14, Style.TEXTE2, false, 500)
	v.add_child(l)
	b.mouse_entered.connect(func() -> void: Sons.jouer("ui_survol", -12.0, 1.0, "Interface"))
	b.pressed.connect(func() -> void: Sons.jouer("ui_clic", -6.0, 1.0, "Interface"))
	return b


func _choisir_agent() -> void:
	var sel: Control = load("res://scripts/ui/page_selection.gd").new()
	add_child(sel)
	sel.retour.connect(sel.queue_free)
	sel.verrouille.connect(func(id: String, _skin: String) -> void:
		var c := choix.duplicate()
		c["heros"] = id
		c["en_ligne"] = false
		Jeu.lancer_partie(c))


func _agents() -> void:
	var sel: Control = load("res://scripts/ui/page_selection.gd").new()
	sel.mode_lancement = false
	add_child(sel)
	sel.retour.connect(func() -> void:
		sel.queue_free()
		_montrer_heros())
	sel.verrouille.connect(func(_id: String, _skin: String) -> void:
		sel.queue_free()
		_montrer_heros())


func _arsenal() -> void:
	var a: Control = load("res://scripts/ui/page_arsenal.gd").new()
	add_child(a)
	a.retour.connect(a.queue_free)


func _reglages() -> void:
	var r: Control = load("res://scripts/ui/page_reglages.gd").new()
	add_child(r)
	r.retour.connect(func() -> void:
		r.queue_free()
		_maj_profil())


func _multijoueur() -> void:
	if not ResourceLoader.exists("res://scripts/ui/page_multijoueur.gd"):
		return
	var m: Control = load("res://scripts/ui/page_multijoueur.gd").new()
	add_child(m)
	m.retour.connect(m.queue_free)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause") and page_courante and page_courante.visible:
		page_courante.visible = false
