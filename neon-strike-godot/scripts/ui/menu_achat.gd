extends Control
## Boutique de la phase d'achat : armes, boucliers et charges de capacités (C et Q).

var mode: Node
var grille_armes: GridContainer
var grille_autres: HBoxContainer
var l_credits: Label
var boutons := []        # [Button, article, prix]


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = Style.theme()
	var voile := ColorRect.new()
	voile.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	voile.color = Color(0.02, 0.03, 0.05, 0.72)
	add_child(voile)
	var cadre := PanelContainer.new()
	cadre.anchor_left = 0.5
	cadre.anchor_right = 0.5
	cadre.anchor_top = 0.5
	cadre.anchor_bottom = 0.5
	cadre.offset_left = -560
	cadre.offset_right = 560
	cadre.offset_top = -330
	cadre.offset_bottom = 330
	add_child(cadre)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 14)
	cadre.add_child(v)
	var entete := HBoxContainer.new()
	v.add_child(entete)
	var titre := Style.etiquette("BOUTIQUE", 40, Style.TEXTE, true, 700)
	titre.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	entete.add_child(titre)
	l_credits = Style.etiquette("", 32, Style.ACCENT2, true, 700)
	entete.add_child(l_credits)
	v.add_child(Style.etiquette("ARMES", 18, Style.TEXTE2, true, 700))
	grille_armes = GridContainer.new()
	grille_armes.columns = 3
	grille_armes.add_theme_constant_override("h_separation", 12)
	grille_armes.add_theme_constant_override("v_separation", 12)
	v.add_child(grille_armes)
	for id in ["pistolet", "pompe", "fusil", "pulsar", "sniper"]:
		var def := DonneesArmes.arme(id)
		_carte(grille_armes, String(def["nom"]).to_upper(), _desc_arme(def), "arme:" + id, int(def.get("prix", 0)), Vector2(352, 120), id)
	v.add_child(Style.etiquette("BOUCLIERS ET CAPACITÉS", 18, Style.TEXTE2, true, 700))
	grille_autres = HBoxContainer.new()
	grille_autres.add_theme_constant_override("separation", 12)
	v.add_child(grille_autres)
	var bas := Style.etiquette("%s ou Échap : fermer" % Reglages.touche("boutique"), 15, Style.TEXTE2, false, 500)
	bas.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	v.add_child(bas)


func _desc_arme(def: Dictionary) -> String:
	var d: Dictionary = def.get("degats", {})
	return "%s · %d balles\nTête %d · Corps %d" % [{"auto": "Automatique", "semi": "Semi-auto", "pompe": "Pompe", "verrou": "Verrou"}.get(def.get("type", "auto"), ""), int(def.get("chargeur", 0)), int(d.get("tete", 0)), int(d.get("corps", 0))]


func _carte(parent: Control, nom: String, desc: String, article: String, prix: int, taille: Vector2, icone_arme := "", icone_cap := "") -> void:
	var b := Button.new()
	b.custom_minimum_size = taille
	b.focus_mode = Control.FOCUS_NONE
	parent.add_child(b)
	var h := HBoxContainer.new()
	h.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	h.offset_left = 14
	h.offset_right = -14
	h.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(h)
	if icone_cap != "":
		var ic := Icones.controle(icone_cap, Style.ACCENT)
		ic.custom_minimum_size = Vector2(48, 48)
		ic.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		h.add_child(ic)
	var t := VBoxContainer.new()
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	t.alignment = BoxContainer.ALIGNMENT_CENTER
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_child(t)
	t.add_child(Style.etiquette(nom, 22, Style.TEXTE, true, 700))
	var l := Style.etiquette(desc, 14, Style.TEXTE2, false, 500)
	t.add_child(l)
	var lp := Style.etiquette("GRATUIT" if prix == 0 else "¤ %d" % prix, 22, Style.ACCENT2, true, 700)
	lp.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	h.add_child(lp)
	b.pressed.connect(func() -> void:
		if mode.acheter(mode.partie.joueur, article):
			actualiser()
		else:
			Sons.jouer("ui_refus", -6.0))
	b.mouse_entered.connect(func() -> void: Sons.jouer("ui_survol", -10.0))
	boutons.append([b, article, prix])


func actualiser() -> void:
	var j: Joueur = mode.partie.joueur
	for c in grille_autres.get_children():
		c.queue_free()
	boutons = boutons.filter(func(x: Array) -> bool: return not String(x[1]).begins_with("bouclier") and not String(x[1]).begins_with("capacite"))
	_carte(grille_autres, "BOUCLIER LÉGER", "+25 bouclier", "bouclier:leger", 400, Vector2(260, 96))
	_carte(grille_autres, "BOUCLIER LOURD", "+50 bouclier", "bouclier:lourd", 1000, Vector2(260, 96))
	if j.etat_cap:
		for empl in ["c", "q"]:
			if not j.etat_cap.ids.has(empl):
				continue
			var d := j.etat_cap.def(empl)
			var desc := "Charges %d / %d" % [j.etat_cap.charges[empl], j.etat_cap.maxi[empl]]
			_carte(grille_autres, String(d.get("nom", "")).to_upper(), desc, "capacite:" + empl, j.etat_cap.prix(empl), Vector2(270, 96), "", d.get("icone", "soin"))
	l_credits.text = "¤ %d" % j.credits
	for x in boutons:
		var b: Button = x[0]
		if not is_instance_valid(b):
			continue
		var art: String = x[1]
		var possede := art.begins_with("arme:") and (j.inventaire.values().has(art.substr(5)))
		b.disabled = j.credits < int(x[2]) or possede
		b.modulate = Color(1, 1, 1, 0.55) if b.disabled else Color.WHITE


func _unhandled_input(event: InputEvent) -> void:
	if visible and event.is_action_pressed("pause"):
		mode.basculer_achat()
		get_viewport().set_input_as_handled()
