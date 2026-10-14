extends Control
## Écran de sélection des agents : grille des 20 portraits (5 catégories colorées, filtres), présentation 3D animée
## au centre, fiche du héros (rôle, difficulté, histoire), ses 4 capacités détaillées, ses skins (niveau ou points)
## et le bouton « Verrouiller » avec son animation de choix.

signal verrouille(id: String, skin: String)
signal retour

var vitrine: Vitrine3D
var fond: ColorRect
var grille: GridContainer
var cartes := {}            # id -> Button
var filtre := ""
var id_actuel := ""
var skin_actuel := "standard"
var l_nom: Label
var l_role: Label
var box_badges: HBoxContainer
var l_citation: Label
var l_histoire: Label
var box_capacites: VBoxContainer
var box_skins: HBoxContainer
var b_verrou: Button
var flash: ColorRect
var verrouillage := false
var mode_lancement := true   # vrai : on choisit l'agent avant une partie ; faux : consultation


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = Style.theme()
	fond = ColorRect.new()
	fond.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var sm := ShaderMaterial.new()
	sm.shader = load("res://assets/shaders/fond_menu.gdshader")
	fond.material = sm
	add_child(fond)
	vitrine = Vitrine3D.new()
	vitrine.anchor_left = 0.3
	vitrine.anchor_right = 0.68
	vitrine.anchor_top = 0.04
	vitrine.anchor_bottom = 1.0
	add_child(vitrine)
	_gauche()
	_droite()
	flash = ColorRect.new()
	flash.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	flash.color = Color(1, 1, 1, 0)
	flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(flash)
	montrer(Profil.heros)


func _gauche() -> void:
	var v := VBoxContainer.new()
	v.anchor_left = 0.0
	v.anchor_right = 0.3
	v.anchor_bottom = 1.0
	v.offset_left = 40
	v.offset_top = 34
	v.offset_right = -10
	v.offset_bottom = -30
	v.add_theme_constant_override("separation", 14)
	add_child(v)
	var haut := HBoxContainer.new()
	v.add_child(haut)
	var b_ret := Style.bouton("‹ RETOUR", 18, 120, 40)
	b_ret.pressed.connect(func() -> void: retour.emit())
	haut.add_child(b_ret)
	var titre := Style.etiquette("CHOISISSEZ VOTRE AGENT", 30, Style.TEXTE, true, 700)
	v.add_child(titre)
	# Filtres par catégorie
	var filtres := HFlowContainer.new()
	filtres.add_theme_constant_override("h_separation", 6)
	filtres.add_theme_constant_override("v_separation", 6)
	v.add_child(filtres)
	var tous := _bouton_filtre("TOUS", Style.TEXTE, "")
	filtres.add_child(tous)
	for c in DonneesHeros.ORDRE_CATEGORIES:
		filtres.add_child(_bouton_filtre(String(DonneesHeros.CATEGORIES[c]["nom"]).to_upper(), DonneesHeros.couleur_de(c), c))
	var defil := ScrollContainer.new()
	defil.size_flags_vertical = Control.SIZE_EXPAND_FILL
	defil.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	v.add_child(defil)
	grille = GridContainer.new()
	grille.columns = 4
	grille.add_theme_constant_override("h_separation", 10)
	grille.add_theme_constant_override("v_separation", 10)
	defil.add_child(grille)
	for id in DonneesHeros.liste():
		var carte := _carte(id)
		grille.add_child(carte)
		cartes[id] = carte
	var aide := Style.etiquette("Glissez sur le personnage pour le faire tourner", 14, Style.TEXTE2, false, 500)
	v.add_child(aide)


func _bouton_filtre(texte: String, couleur: Color, cat: String) -> Button:
	var b := Style.bouton(texte, 15, 0, 32)
	b.add_theme_color_override("font_color", couleur)
	b.pressed.connect(func() -> void:
		filtre = cat
		for id in cartes:
			(cartes[id] as Control).visible = cat == "" or DonneesHeros.heros(id)["categorie"] == cat)
	return b


func _carte(id: String) -> Button:
	var h := DonneesHeros.heros(id)
	var couleur := DonneesHeros.couleur_categorie(id)
	var b := Button.new()
	b.custom_minimum_size = Vector2(100, 112)
	b.focus_mode = Control.FOCUS_NONE
	b.clip_contents = true
	var sb := Style.boite(Color(0.08, 0.1, 0.15, 0.95), 6, Color(couleur.r, couleur.g, couleur.b, 0.35), 2, 0)
	b.add_theme_stylebox_override("normal", sb)
	var sbh := Style.boite(Color(couleur.r * 0.25, couleur.g * 0.25, couleur.b * 0.25, 0.95), 6, couleur, 2, 0)
	b.add_theme_stylebox_override("hover", sbh)
	b.add_theme_stylebox_override("pressed", sbh)
	var chemin := "res://assets/portraits/%s.png" % id
	if ResourceLoader.exists(chemin):
		var t := TextureRect.new()
		t.texture = load(chemin)
		t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		t.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		t.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		t.offset_bottom = -22
		t.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(t)
	var bande := ColorRect.new()
	bande.color = Color(couleur.r, couleur.g, couleur.b, 0.9)
	bande.anchor_top = 1.0
	bande.anchor_bottom = 1.0
	bande.anchor_right = 1.0
	bande.offset_top = -22
	bande.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(bande)
	var n := Style.etiquette(String(h["nom"]), 15, Color(0.03, 0.04, 0.06), true, 700)
	n.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	n.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	bande.add_child(n)
	b.mouse_entered.connect(func() -> void:
		Sons.jouer("ui_survol", -12.0, 1.0, "Interface")
		var tw := b.create_tween()
		tw.tween_property(b, "scale", Vector2(1.04, 1.04), 0.08))
	b.mouse_exited.connect(func() -> void:
		var tw := b.create_tween()
		tw.tween_property(b, "scale", Vector2.ONE, 0.1))
	b.pivot_offset = Vector2(50, 56)
	b.pressed.connect(func() -> void:
		if not verrouillage:
			Sons.jouer("ui_clic", -6.0, 1.0, "Interface")
			montrer(id))
	return b


func _droite() -> void:
	var p := PanelContainer.new()
	p.anchor_left = 0.68
	p.anchor_right = 1.0
	p.anchor_bottom = 1.0
	p.offset_left = 0
	p.offset_right = -36
	p.offset_top = 34
	p.offset_bottom = -30
	p.add_theme_stylebox_override("panel", Style.boite(Color(0.04, 0.05, 0.08, 0.82), 10, Color(1, 1, 1, 0.07), 1, 22))
	add_child(p)
	var colonne := VBoxContainer.new()
	colonne.add_theme_constant_override("separation", 12)
	p.add_child(colonne)
	var defil := ScrollContainer.new()
	defil.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	defil.size_flags_vertical = Control.SIZE_EXPAND_FILL
	colonne.add_child(defil)
	var v := VBoxContainer.new()
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.add_theme_constant_override("separation", 10)
	defil.add_child(v)
	box_badges = HBoxContainer.new()
	box_badges.add_theme_constant_override("separation", 8)
	v.add_child(box_badges)
	l_nom = Style.ombre(Style.etiquette("", 64, Style.TEXTE, true, 700), 3)
	v.add_child(l_nom)
	l_role = Style.etiquette("", 20, Style.TEXTE2, true, 600)
	v.add_child(l_role)
	l_citation = Style.etiquette("", 17, Style.TEXTE, false, 500)
	l_citation.add_theme_font_override("font", Style.police(500))
	l_citation.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(l_citation)
	l_histoire = Style.etiquette("", 14, Style.TEXTE2, false, 400)
	l_histoire.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l_histoire.custom_minimum_size.x = 420
	v.add_child(l_histoire)
	v.add_child(Style.etiquette("CAPACITÉS", 16, Style.TEXTE2, true, 700))
	box_capacites = VBoxContainer.new()
	box_capacites.add_theme_constant_override("separation", 8)
	v.add_child(box_capacites)
	v.add_child(Style.etiquette("SKINS", 16, Style.TEXTE2, true, 700))
	box_skins = HBoxContainer.new()
	box_skins.add_theme_constant_override("separation", 8)
	v.add_child(box_skins)
	b_verrou = Style.bouton("VERROUILLER", 30, 0, 64)
	b_verrou.pressed.connect(_verrouiller)
	colonne.add_child(b_verrou)


func montrer(id: String) -> void:
	id_actuel = id
	var h := DonneesHeros.heros(id)
	var couleur := DonneesHeros.couleur_categorie(id)
	skin_actuel = Profil.skin_heros(id)
	vitrine.montrer(id, skin_actuel)
	(fond.material as ShaderMaterial).set_shader_parameter("teinte", couleur)
	for c in box_badges.get_children():
		c.queue_free()
	var cat: Dictionary = DonneesHeros.CATEGORIES[h["categorie"]]
	box_badges.add_child(Style.badge(String(cat["nom"]).to_upper(), couleur))
	var etoiles := "●".repeat(int(h.get("difficulte", 1))) + "○".repeat(3 - int(h.get("difficulte", 1)))
	box_badges.add_child(Style.badge("DIFFICULTÉ " + etoiles, Style.TEXTE2))
	box_badges.add_child(Style.badge(String(DonneesArmes.arme(String(h.get("arme", "fusil")))["nom"]).to_upper(), Style.TEXTE2))
	l_nom.text = String(h["nom"])
	l_nom.add_theme_color_override("font_color", Style.TEXTE)
	l_role.text = String(h.get("role", "")).to_upper()
	l_role.add_theme_color_override("font_color", couleur)
	l_citation.text = "« %s »" % h.get("citation", "")
	l_histoire.text = String(h.get("histoire", ""))
	# Capacités
	for c in box_capacites.get_children():
		c.queue_free()
	var touches := {"c": "capacite_c", "q": "capacite_q", "e": "capacite_e", "x": "ultime"}
	var ids: Array = h.get("capacites", [])
	for i in ids.size():
		var empl: String = DonneesCapacites.EMPLACEMENTS[i]
		var d := DonneesCapacites.capacite(ids[i])
		box_capacites.add_child(_ligne_capacite(d, empl, Reglages.touche(touches[empl]), couleur))
	_skins(id)
	var sbv := Style.boite(Color(couleur.r * 0.35, couleur.g * 0.35, couleur.b * 0.35, 0.95), 8, couleur, 2, 16)
	b_verrou.add_theme_stylebox_override("normal", sbv)
	var sbh := Style.boite(Color(couleur.r * 0.55, couleur.g * 0.55, couleur.b * 0.55, 1.0), 8, couleur.lightened(0.3), 2, 16)
	b_verrou.add_theme_stylebox_override("hover", sbh)
	b_verrou.text = "VERROUILLER" if mode_lancement else "CHOISIR"
	for k in cartes:
		var b: Button = cartes[k]
		var cc := DonneesHeros.couleur_categorie(k)
		var sb := Style.boite(Color(0.08, 0.1, 0.15, 0.95), 6, cc if k == id else Color(cc.r, cc.g, cc.b, 0.35), 3 if k == id else 2, 0)
		b.add_theme_stylebox_override("normal", sb)


func _ligne_capacite(d: Dictionary, empl: String, touche: String, couleur: Color) -> Control:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", Style.boite(Color(1, 1, 1, 0.035), 6, Color(1, 1, 1, 0.05), 1, 10))
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 12)
	p.add_child(h)
	var col := VBoxContainer.new()
	col.alignment = BoxContainer.ALIGNMENT_CENTER
	h.add_child(col)
	var ic := Icones.controle(String(d.get("icone", "soin")), couleur if empl != "x" else Style.ACCENT2)
	ic.custom_minimum_size = Vector2(44, 44)
	col.add_child(ic)
	var t := Style.etiquette(touche, 13, Style.TEXTE2, true, 700)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(t)
	var v := VBoxContainer.new()
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.add_theme_constant_override("separation", 2)
	h.add_child(v)
	var titre := HBoxContainer.new()
	v.add_child(titre)
	titre.add_child(Style.etiquette(String(d.get("nom", "")).to_upper(), 18, Style.TEXTE, true, 700))
	if empl == "x":
		titre.add_child(Style.badge("ULTIME", Style.ACCENT2, 11))
	elif empl == "e":
		titre.add_child(Style.badge("SIGNATURE", couleur, 11))
	var l := Style.etiquette(String(d.get("texte", "")), 14, Style.TEXTE2, false, 400)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size.x = 340
	v.add_child(l)
	var details := []
	if empl == "x":
		details.append("%d points d'ultime" % int(d.get("points", 7)))
	else:
		if int(d.get("charges", 1)) > 1:
			details.append("%d charges" % int(d["charges"]))
		if d.has("prix") and empl != "e":
			details.append("¤ %d" % int(d["prix"]))
		details.append("recharge %d s" % int(d.get("recharge", 30)))
	v.add_child(Style.etiquette(" · ".join(details), 12, Color(couleur.r, couleur.g, couleur.b, 0.85), true, 600))
	return p


func _skins(id: String) -> void:
	for c in box_skins.get_children():
		c.queue_free()
	var h := DonneesHeros.heros(id)
	for s in h.get("skins", []):
		var cle := "heros:%s:%s" % [id, s["id"]]
		var dispo := Profil.skin_disponible(cle, s)
		var equipe: bool = Profil.skin_heros(id) == s["id"]
		var b := Button.new()
		b.custom_minimum_size = Vector2(136, 78)
		b.focus_mode = Control.FOCUS_NONE
		var cs: Dictionary = s.get("couleurs", {})
		var c1 := Color(cs.get("armure", "#888888"))
		var c2 := Color(cs.get("accent", "#ffffff"))
		var sb := Style.boite(Color(c1.r * 0.25, c1.g * 0.25, c1.b * 0.25, 0.95), 6, c2 if equipe else Color(1, 1, 1, 0.12), 2 if equipe else 1, 8)
		b.add_theme_stylebox_override("normal", sb)
		b.add_theme_stylebox_override("hover", Style.boite(Color(c1.r * 0.35, c1.g * 0.35, c1.b * 0.35, 1.0), 6, c2, 2, 8))
		var v := VBoxContainer.new()
		v.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		v.offset_left = 8
		v.offset_top = 6
		v.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(v)
		var pastilles := HBoxContainer.new()
		pastilles.mouse_filter = Control.MOUSE_FILTER_IGNORE
		for k in ["armure", "tissu", "secondaire", "accent"]:
			var r := ColorRect.new()
			r.custom_minimum_size = Vector2(14, 14)
			r.color = Color(cs.get(k, "#888888"))
			r.mouse_filter = Control.MOUSE_FILTER_IGNORE
			pastilles.add_child(r)
		v.add_child(pastilles)
		v.add_child(Style.etiquette(String(s["nom"]).to_upper(), 14, Style.TEXTE, true, 700))
		var etat := "ÉQUIPÉ" if equipe else ("DISPONIBLE" if dispo else "NIV. %d · %d PT" % [int(s.get("niveau", 1)), int(s.get("prix", 0))])
		v.add_child(Style.etiquette(etat, 11, c2 if equipe else (Style.TEXTE2 if dispo else Style.ROUGE), true, 700))
		b.mouse_entered.connect(func() -> void: vitrine.montrer(id, s["id"]))
		b.mouse_exited.connect(func() -> void: vitrine.montrer(id, Profil.skin_heros(id)))
		b.pressed.connect(func() -> void:
			if dispo or Profil.acheter_skin(cle, int(s.get("prix", 0))):
				Profil.equiper_skin_heros(id, s["id"])
				skin_actuel = s["id"]
				Sons.jouer("ui_achat", -6.0, 1.0, "Interface")
				vitrine.montrer(id, s["id"])
				_skins(id)
			else:
				Sons.jouer("ui_refus", -6.0, 1.0, "Interface"))
		box_skins.add_child(b)


func _verrouiller() -> void:
	if verrouillage:
		return
	Profil.heros = id_actuel
	if not mode_lancement:
		verrouille.emit(id_actuel, skin_actuel)
		return
	verrouillage = true
	Sons.jouer("ui_valider", -2.0, 1.0, "Interface")
	vitrine.selectionner()
	var couleur := DonneesHeros.couleur_categorie(id_actuel)
	b_verrou.text = "VERROUILLÉ"
	var tw := create_tween()
	tw.tween_interval(1.3)
	tw.tween_property(flash, "color", Color(couleur.r, couleur.g, couleur.b, 0.0), 0.0)
	tw.tween_property(flash, "color", Color(couleur.r, couleur.g, couleur.b, 0.9), 0.25)
	tw.tween_property(flash, "color", Color(0.02, 0.02, 0.03, 1.0), 0.3)
	tw.tween_callback(func() -> void: verrouille.emit(id_actuel, skin_actuel))
