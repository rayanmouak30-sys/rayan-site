class_name Hud
extends Control
## Interface en jeu : viseur, vie et bouclier, munitions, arme, capacités et recharges, minuteur et score,
## fil des éliminations, annonces, indicateurs de dégâts, lunette, écran de mort, compteur d'images.

var joueur: Joueur
var viseur: Viseur

var l_vie: Label
var l_armure: Label
var barre_vie: ColorRect
var barre_vie_fond: ColorRect
var barre_armure: ColorRect
var l_mun: Label
var l_reserve: Label
var l_arme: Label
var barre_recharge: ColorRect
var l_minuteur: Label
var l_score_bleu: Label
var l_score_rouge: Label
var l_manche: Label
var l_zone: Label
var l_credits: Label
var fil: VBoxContainer
var annonce: Label
var sous_annonce: Label
var annonce_t := 0.0
var message: Label
var message_t := 0.0
var degats_rouge: ColorRect
var degats_t := 0.0
var indicateurs: Control
var directions := []        # [angle_monde (Vector3 source), temps]
var lunette: Control
var aveuglement: ColorRect
var l_fps: Label
var capacites_box: HBoxContainer
var cases_capacites := {}   # emplacement -> {fond, nom, touche, charges, recharge}
var ultime_box: Control
var mort_panneau: Control
var l_mort: Label
var barre_action: Control
var barre_action_k: ColorRect
var l_action: Label
var vivants_bleu: HBoxContainer
var vivants_rouge: HBoxContainer


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	theme = Style.theme()
	_lunette()
	degats_rouge = ColorRect.new()
	degats_rouge.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	degats_rouge.color = Color(0.8, 0.05, 0.05, 0.0)
	degats_rouge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(degats_rouge)
	aveuglement = ColorRect.new()
	aveuglement.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	aveuglement.color = Color(1, 1, 1, 0)
	aveuglement.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(aveuglement)
	viseur = Viseur.new()
	add_child(viseur)
	indicateurs = Control.new()
	indicateurs.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	indicateurs.mouse_filter = Control.MOUSE_FILTER_IGNORE
	indicateurs.draw.connect(_dessiner_indicateurs)
	add_child(indicateurs)
	_bas_gauche()
	_bas_droite()
	_haut()
	_fil()
	_annonces()
	_ecran_mort()
	_barre_action()
	l_fps = Style.etiquette("", 14, Style.TEXTE2, false, 500)
	l_fps.position = Vector2(8, 4)
	add_child(l_fps)


func _panneau(couleur := Color(0.03, 0.04, 0.07, 0.55)) -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", Style.boite(couleur, 6, Color(1, 1, 1, 0.06), 1, 12))
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return p


func _bas_gauche() -> void:
	var p := _panneau()
	p.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	p.position = Vector2(28, -118)
	p.grow_vertical = Control.GROW_DIRECTION_BEGIN
	add_child(p)
	p.anchor_top = 1.0
	p.anchor_bottom = 1.0
	p.offset_left = 28
	p.offset_top = -112
	p.offset_bottom = -28
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 18)
	p.add_child(h)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 2)
	h.add_child(v)
	var ligne := HBoxContainer.new()
	ligne.add_theme_constant_override("separation", 10)
	v.add_child(ligne)
	l_vie = Style.ombre(Style.etiquette("100", 52, Style.TEXTE, true, 700))
	ligne.add_child(l_vie)
	var bouclier := VBoxContainer.new()
	bouclier.alignment = BoxContainer.ALIGNMENT_CENTER
	ligne.add_child(bouclier)
	l_armure = Style.etiquette("0", 22, Style.BLEU, true, 700)
	bouclier.add_child(l_armure)
	bouclier.add_child(Style.etiquette("BOUCLIER", 11, Style.TEXTE2, false, 600))
	barre_vie_fond = ColorRect.new()
	barre_vie_fond.custom_minimum_size = Vector2(190, 6)
	barre_vie_fond.color = Color(1, 1, 1, 0.12)
	v.add_child(barre_vie_fond)
	barre_vie = ColorRect.new()
	barre_vie.size = Vector2(190, 6)
	barre_vie.color = Style.TEXTE
	barre_vie_fond.add_child(barre_vie)
	barre_armure = ColorRect.new()
	barre_armure.position = Vector2(0, -4)
	barre_armure.size = Vector2(0, 3)
	barre_armure.color = Style.BLEU
	barre_vie_fond.add_child(barre_armure)
	# Capacités
	capacites_box = HBoxContainer.new()
	capacites_box.add_theme_constant_override("separation", 8)
	h.add_child(capacites_box)
	l_credits = Style.etiquette("", 16, Style.ACCENT2, true, 700)
	l_credits.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	l_credits.anchor_top = 1.0
	l_credits.anchor_bottom = 1.0
	l_credits.offset_left = 32
	l_credits.offset_top = -140
	add_child(l_credits)
	l_zone = Style.ombre(Style.etiquette("", 16, Style.TEXTE2, true, 600))
	l_zone.position = Vector2(28, 200)
	add_child(l_zone)


## Cases des capacités : C, Q, E et ultime X (icône, touche, charges, recharge)
func preparer_capacites(liste: Array) -> void:
	for c in capacites_box.get_children():
		c.queue_free()
	cases_capacites.clear()
	for info in liste:
		var empl: String = info["emplacement"]
		var case := Control.new()
		case.custom_minimum_size = Vector2(64, 76) if empl != "x" else Vector2(78, 76)
		case.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var fond := Panel.new()
		fond.size = Vector2(case.custom_minimum_size.x, 56)
		fond.add_theme_stylebox_override("panel", Style.boite(Color(0.08, 0.1, 0.16, 0.8), 6, Color(1, 1, 1, 0.15), 1, 0))
		fond.mouse_filter = Control.MOUSE_FILTER_IGNORE
		case.add_child(fond)
		var icone := Icones.controle(info.get("icone", "explosion"), info.get("couleur", Style.ACCENT))
		icone.position = Vector2((case.custom_minimum_size.x - 40) / 2.0, 8)
		icone.size = Vector2(40, 40)
		fond.add_child(icone)
		var voile := ColorRect.new()
		voile.color = Color(0, 0, 0, 0.6)
		voile.mouse_filter = Control.MOUSE_FILTER_IGNORE
		voile.size = Vector2(case.custom_minimum_size.x, 0)
		fond.add_child(voile)
		var l_rech := Style.etiquette("", 20, Style.TEXTE, true, 700)
		l_rech.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		l_rech.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		l_rech.size = Vector2(case.custom_minimum_size.x, 56)
		fond.add_child(l_rech)
		var l_touche := Style.etiquette(info.get("touche", "?"), 13, Style.TEXTE2, true, 700)
		l_touche.position = Vector2(0, 58)
		l_touche.size = Vector2(case.custom_minimum_size.x, 16)
		l_touche.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		case.add_child(l_touche)
		var charges := HBoxContainer.new()
		charges.add_theme_constant_override("separation", 3)
		charges.position = Vector2(4, 50)
		charges.mouse_filter = Control.MOUSE_FILTER_IGNORE
		case.add_child(charges)
		capacites_box.add_child(case)
		cases_capacites[empl] = {"case": case, "fond": fond, "voile": voile, "recharge": l_rech, "charges": charges, "icone": icone, "nb": -1}


## etat : {emplacement: {charges, max, recharge (s restantes), recharge_max, pret, ultime_points, ultime_max, actif}}
func maj_capacites(etat: Dictionary) -> void:
	for empl in cases_capacites:
		if not etat.has(empl):
			continue
		var c: Dictionary = cases_capacites[empl]
		var e: Dictionary = etat[empl]
		var h: float = 56.0
		var voile: ColorRect = c["voile"]
		var l: Label = c["recharge"]
		var fond: Panel = c["fond"]
		if empl == "x":
			var pts: int = e.get("ultime_points", 0)
			var mx: int = e.get("ultime_max", 7)
			var pret := pts >= mx
			voile.size.y = h * (1.0 - float(pts) / mx) if not pret else 0.0
			l.text = "" if pret else "%d/%d" % [pts, mx]
			(fond.get_theme_stylebox("panel") as StyleBoxFlat).border_color = Style.ACCENT2 if pret else Color(1, 1, 1, 0.15)
			(c["icone"] as Control).modulate = Color(1, 1, 1, 1.0 if pret else 0.45)
			continue
		var n: int = e.get("charges", 0)
		var r: float = e.get("recharge", 0.0)
		var rmax: float = maxf(e.get("recharge_max", 1.0), 0.01)
		voile.size.y = h * clampf(r / rmax, 0.0, 1.0) if n == 0 else 0.0
		l.text = str(ceili(r)) if n == 0 and r > 0.0 else ""
		(c["icone"] as Control).modulate = Color(1, 1, 1, 1.0 if n > 0 else 0.35)
		(fond.get_theme_stylebox("panel") as StyleBoxFlat).border_color = Style.ACCENT if e.get("actif", false) else Color(1, 1, 1, 0.15)
		if c["nb"] != n * 10 + int(e.get("max", 1)):
			c["nb"] = n * 10 + int(e.get("max", 1))
			var box: HBoxContainer = c["charges"]
			for x in box.get_children():
				x.queue_free()
			for i in int(e.get("max", 1)):
				var pt := ColorRect.new()
				pt.custom_minimum_size = Vector2(8, 3)
				pt.color = Style.ACCENT if i < n else Color(1, 1, 1, 0.2)
				box.add_child(pt)


func _bas_droite() -> void:
	var p := _panneau()
	add_child(p)
	p.anchor_left = 1.0
	p.anchor_right = 1.0
	p.anchor_top = 1.0
	p.anchor_bottom = 1.0
	p.offset_right = -28
	p.offset_bottom = -28
	p.offset_top = -112
	p.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 0)
	v.alignment = BoxContainer.ALIGNMENT_END
	p.add_child(v)
	var h := HBoxContainer.new()
	h.alignment = BoxContainer.ALIGNMENT_END
	h.add_theme_constant_override("separation", 6)
	v.add_child(h)
	l_mun = Style.ombre(Style.etiquette("25", 52, Style.TEXTE, true, 700))
	h.add_child(l_mun)
	l_reserve = Style.etiquette("/ 75", 22, Style.TEXTE2, true, 600)
	l_reserve.size_flags_vertical = Control.SIZE_SHRINK_END
	l_reserve.custom_minimum_size.y = 46
	h.add_child(l_reserve)
	l_arme = Style.etiquette("", 15, Style.TEXTE2, true, 600)
	l_arme.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	v.add_child(l_arme)
	var fond := ColorRect.new()
	fond.custom_minimum_size = Vector2(170, 3)
	fond.color = Color(1, 1, 1, 0.08)
	v.add_child(fond)
	barre_recharge = ColorRect.new()
	barre_recharge.size = Vector2(0, 3)
	barre_recharge.color = Style.ACCENT
	fond.add_child(barre_recharge)


func _haut() -> void:
	var c := HBoxContainer.new()
	c.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	c.anchor_left = 0.5
	c.anchor_right = 0.5
	c.offset_top = 14
	c.grow_horizontal = Control.GROW_DIRECTION_BOTH
	c.alignment = BoxContainer.ALIGNMENT_CENTER
	c.add_theme_constant_override("separation", 10)
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(c)
	vivants_bleu = HBoxContainer.new()
	vivants_bleu.add_theme_constant_override("separation", 3)
	vivants_bleu.alignment = BoxContainer.ALIGNMENT_END
	vivants_bleu.custom_minimum_size.x = 170
	c.add_child(vivants_bleu)
	l_score_bleu = Style.ombre(Style.etiquette("0", 34, Style.BLEU, true, 700))
	c.add_child(l_score_bleu)
	var mid := _panneau(Color(0.03, 0.04, 0.07, 0.7))
	mid.custom_minimum_size = Vector2(118, 0)
	c.add_child(mid)
	var mv := VBoxContainer.new()
	mv.add_theme_constant_override("separation", -6)
	mid.add_child(mv)
	l_minuteur = Style.etiquette("1:40", 30, Style.TEXTE, true, 700)
	l_minuteur.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	mv.add_child(l_minuteur)
	l_manche = Style.etiquette("", 12, Style.TEXTE2, false, 600)
	l_manche.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	mv.add_child(l_manche)
	l_score_rouge = Style.ombre(Style.etiquette("0", 34, Style.ROUGE, true, 700))
	c.add_child(l_score_rouge)
	vivants_rouge = HBoxContainer.new()
	vivants_rouge.add_theme_constant_override("separation", 3)
	vivants_rouge.custom_minimum_size.x = 170
	c.add_child(vivants_rouge)


## Pastilles des combattants vivants de chaque camp (portraits colorés par catégorie)
func maj_vivants(bleus: Array, rouges: Array) -> void:
	for paire in [[vivants_bleu, bleus], [vivants_rouge, rouges]]:
		var box: HBoxContainer = paire[0]
		var l: Array = paire[1]
		while box.get_child_count() < l.size():
			var r := Panel.new()
			r.custom_minimum_size = Vector2(30, 34)
			r.add_theme_stylebox_override("panel", Style.boite(Color(0.1, 0.12, 0.18, 0.85), 4, Color(1, 1, 1, 0.1), 1, 0))
			var lab := Style.etiquette("", 13, Style.TEXTE, true, 700)
			lab.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
			lab.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			lab.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
			r.add_child(lab)
			box.add_child(r)
		for i in box.get_child_count():
			var r: Panel = box.get_child(i)
			r.visible = i < l.size()
			if i < l.size():
				var e: Dictionary = l[i]
				var lab: Label = r.get_child(0)
				lab.text = String(e["nom"]).substr(0, 2)
				var sb := r.get_theme_stylebox("panel") as StyleBoxFlat
				sb.border_color = e["couleur"] if e["vivant"] else Color(1, 1, 1, 0.05)
				r.modulate = Color(1, 1, 1, 1.0 if e["vivant"] else 0.3)


func _fil() -> void:
	fil = VBoxContainer.new()
	fil.anchor_left = 1.0
	fil.anchor_right = 1.0
	fil.offset_left = -460
	fil.offset_right = -24
	fil.offset_top = 70
	fil.add_theme_constant_override("separation", 4)
	fil.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(fil)


## Ligne du fil des éliminations
func elimination(tueur: String, couleur_tueur: Color, victime: String, couleur_victime: Color, arme: String, tete: bool, moi: bool) -> void:
	var p := _panneau(Color(0.03, 0.04, 0.07, 0.72) if not moi else Color(0.18, 0.14, 0.04, 0.8))
	p.size_flags_horizontal = Control.SIZE_SHRINK_END
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 10)
	p.add_child(h)
	h.add_child(Style.etiquette(tueur, 17, couleur_tueur, true, 700))
	var a := Style.etiquette(arme.to_upper(), 13, Style.TEXTE2, true, 600)
	a.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	h.add_child(a)
	if tete:
		h.add_child(Style.etiquette("◎", 16, Style.ACCENT2, false, 700))
	h.add_child(Style.etiquette(victime, 17, couleur_victime, true, 700))
	fil.add_child(p)
	if fil.get_child_count() > 6:
		fil.get_child(0).queue_free()
	var tw := p.create_tween()
	p.modulate.a = 0.0
	tw.tween_property(p, "modulate:a", 1.0, 0.15)
	tw.tween_interval(6.0)
	tw.tween_property(p, "modulate:a", 0.0, 0.5)
	tw.tween_callback(p.queue_free)


func _annonces() -> void:
	annonce = Style.ombre(Style.etiquette("", 54, Style.TEXTE, true, 700), 3)
	annonce.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	annonce.anchor_left = 0.0
	annonce.anchor_right = 1.0
	annonce.offset_top = 170
	annonce.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(annonce)
	sous_annonce = Style.ombre(Style.etiquette("", 20, Style.TEXTE2, true, 600))
	sous_annonce.anchor_right = 1.0
	sous_annonce.offset_top = 236
	sous_annonce.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(sous_annonce)
	message = Style.ombre(Style.etiquette("", 18, Style.TEXTE, true, 600))
	message.anchor_top = 1.0
	message.anchor_bottom = 1.0
	message.anchor_right = 1.0
	message.offset_top = -200
	message.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(message)


func annoncer(texte: String, sous := "", couleur := Style.TEXTE, duree := 2.5) -> void:
	annonce.text = texte
	annonce.add_theme_color_override("font_color", couleur)
	sous_annonce.text = sous
	annonce_t = duree
	annonce.scale = Vector2(1.15, 1.15)
	annonce.pivot_offset = Vector2(annonce.size.x / 2.0, 30)
	var tw := annonce.create_tween()
	tw.tween_property(annonce, "scale", Vector2.ONE, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


func afficher_message(texte: String, duree := 2.0) -> void:
	message.text = texte
	message_t = duree


func _ecran_mort() -> void:
	mort_panneau = Control.new()
	mort_panneau.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mort_panneau.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mort_panneau.visible = false
	add_child(mort_panneau)
	var voile := ColorRect.new()
	voile.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	voile.color = Color(0.1, 0.0, 0.02, 0.35)
	voile.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mort_panneau.add_child(voile)
	l_mort = Style.ombre(Style.etiquette("", 24, Style.TEXTE, true, 700))
	l_mort.anchor_right = 1.0
	l_mort.anchor_top = 1.0
	l_mort.anchor_bottom = 1.0
	l_mort.offset_top = -260
	l_mort.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	mort_panneau.add_child(l_mort)


func _barre_action() -> void:
	barre_action = VBoxContainer.new()
	barre_action.anchor_left = 0.5
	barre_action.anchor_right = 0.5
	barre_action.anchor_top = 0.5
	barre_action.anchor_bottom = 0.5
	barre_action.offset_left = -160
	barre_action.offset_right = 160
	barre_action.offset_top = 70
	barre_action.mouse_filter = Control.MOUSE_FILTER_IGNORE
	barre_action.visible = false
	add_child(barre_action)
	l_action = Style.ombre(Style.etiquette("", 16, Style.TEXTE, true, 700))
	l_action.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	barre_action.add_child(l_action)
	var fond := ColorRect.new()
	fond.custom_minimum_size = Vector2(320, 8)
	fond.color = Color(0, 0, 0, 0.55)
	barre_action.add_child(fond)
	barre_action_k = ColorRect.new()
	barre_action_k.size = Vector2(0, 8)
	barre_action_k.color = Style.ACCENT2
	fond.add_child(barre_action_k)


## Barre de progression centrale (pose / désamorçage du Spike) ; texte vide = masquée
func progression(texte: String, k: float) -> void:
	barre_action.visible = texte != ""
	l_action.text = texte
	barre_action_k.size.x = 320.0 * clampf(k, 0.0, 1.0)


func montrer_mort(texte: String) -> void:
	mort_panneau.visible = texte != ""
	l_mort.text = texte


func _lunette() -> void:
	lunette = Control.new()
	lunette.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	lunette.mouse_filter = Control.MOUSE_FILTER_IGNORE
	lunette.visible = false
	lunette.draw.connect(func() -> void:
		var s := lunette.size
		var c := s * 0.5
		var r := s.y * 0.46
		var noir := Color(0.0, 0.0, 0.0, 1.0)
		# Masque autour du cercle
		var pts := PackedVector2Array()
		var n := 96
		for i in n + 1:
			pts.append(c + Vector2(cos(TAU * i / n), sin(TAU * i / n)) * r)
		draw_rect(Rect2(0, 0, c.x - r + 1, s.y), noir)
		draw_rect(Rect2(c.x + r - 1, 0, s.x - c.x - r + 1, s.y), noir)
		for i in n:
			var a := pts[i]
			var b := pts[i + 1]
			var haut := Vector2(a.x, 0.0) if a.y < c.y else Vector2(a.x, s.y)
			var haut2 := Vector2(b.x, 0.0) if b.y < c.y else Vector2(b.x, s.y)
			draw_colored_polygon(PackedVector2Array([a, b, haut2, haut]), noir)
		draw_arc(c, r, 0, TAU, 128, Color(0, 0, 0, 1), 6.0, true)
		draw_arc(c, r - 10, 0, TAU, 128, Color(0, 0, 0, 0.35), 18.0, true)
		# Réticule fin avec graduations
		var l := Color(0.02, 0.02, 0.02, 0.95)
		draw_line(Vector2(c.x - r, c.y), Vector2(c.x - 26, c.y), l, 2.0)
		draw_line(Vector2(c.x + 26, c.y), Vector2(c.x + r, c.y), l, 2.0)
		draw_line(Vector2(c.x, c.y + 26), Vector2(c.x, c.y + r), l, 2.0)
		draw_line(Vector2(c.x, c.y - r), Vector2(c.x, c.y - 26), l, 2.0)
		draw_line(Vector2(c.x - 26, c.y), Vector2(c.x + 26, c.y), l, 1.0)
		draw_line(Vector2(c.x, c.y - 26), Vector2(c.x, c.y + 26), l, 1.0)
		for k in range(1, 5):
			draw_line(Vector2(c.x - 6, c.y + 26 + k * 22), Vector2(c.x + 6, c.y + 26 + k * 22), l, 1.0)
		draw_circle(c, 1.6, Color(1.0, 0.25, 0.2))
		)
	add_child(lunette)


func _process(dt: float) -> void:
	if annonce_t > 0.0:
		annonce_t -= dt
		var a := clampf(annonce_t / 0.4, 0.0, 1.0)
		annonce.modulate.a = a
		sous_annonce.modulate.a = a
	if message_t > 0.0:
		message_t -= dt
		message.modulate.a = clampf(message_t / 0.3, 0.0, 1.0)
	if Reglages.lire("afficher_fps"):
		l_fps.text = "%d FPS" % Engine.get_frames_per_second()
	else:
		l_fps.text = ""
	if not is_instance_valid(joueur):
		return
	var j := joueur
	degats_t = maxf(0.0, degats_t - dt)
	var faible := clampf((35.0 - j.vie) / 35.0, 0.0, 1.0) * 0.18 if j.vivant else 0.0
	degats_rouge.color.a = maxf(degats_t * 0.9, faible * (0.7 + 0.3 * sin(Time.get_ticks_msec() * 0.006)))
	aveuglement.color.a = clampf(j.aveugle / maxf(j.aveugle_max, 0.01), 0.0, 1.0) * 1.0 if j.aveugle > 0.0 else 0.0
	l_vie.text = str(ceili(maxf(j.vie, 0.0)))
	l_vie.add_theme_color_override("font_color", Style.ROUGE if j.vie <= 30.0 else Style.TEXTE)
	barre_vie.size.x = 190.0 * clampf(j.vie / 100.0, 0.0, 1.0)
	barre_vie.color = Style.ROUGE if j.vie <= 30.0 else Style.TEXTE
	l_armure.text = str(ceili(j.armure))
	barre_armure.size.x = 190.0 * clampf(j.armure / 50.0, 0.0, 1.0)
	l_credits.text = "¤ %d" % j.credits if j.credits >= 0 else ""
	if j.arme:
		var a := j.arme
		var melee := a.type == "melee"
		l_mun.text = "" if melee else str(a.mun)
		l_reserve.text = "" if melee else "/ %d" % a.reserve
		var faible_mun := not melee and a.mun <= int(int(a.def.get("chargeur", 10)) * 0.25)
		l_mun.add_theme_color_override("font_color", Style.ROUGE if faible_mun else Style.TEXTE)
		l_arme.text = String(a.def.get("nom", "")).to_upper()
		var p := a.progression_recharge()
		barre_recharge.size.x = 170.0 * p if p >= 0.0 else 0.0
		# Viseur dynamique : écart en pixels selon l'imprécision et le champ de vision
		var fov_h := deg_to_rad(j.cam.fov)
		var px := tan(deg_to_rad(j.ecart_actuel)) / tan(fov_h * 0.5) * size.x * 0.5
		viseur.ecart_dyn = lerpf(viseur.ecart_dyn, clampf(px * 0.6, 0.0, 60.0), 1.0 - exp(-20.0 * dt))
		var lunette_on := bool(a.def.get("lunette", false)) and j.vue != null and j.vue.visee_k > 0.85 and j.vivant
		lunette.visible = lunette_on
		viseur.cache = lunette_on or not j.vivant
		if j.vue:
			j.vue.modulate.a = 0.0 if lunette_on else 1.0
	if j.effets != null and Jeu.partie and Jeu.partie.get("carte") != null:
		l_zone.text = (Jeu.partie.carte as Carte).nom_zone(j.global_position).to_upper()
	# Indicateurs de direction des dégâts
	var i := 0
	while i < directions.size():
		directions[i][1] -= dt
		if directions[i][1] <= 0.0:
			directions.remove_at(i)
		else:
			i += 1
	indicateurs.queue_redraw()


## Dégâts reçus : flash rouge et flèche vers l'origine
func degats_recus(quantite: float, source: Vector3) -> void:
	degats_t = clampf(degats_t + quantite / 120.0, 0.0, 0.5)
	directions.append([source, 1.2])


func _dessiner_indicateurs() -> void:
	if not is_instance_valid(joueur):
		return
	var c := indicateurs.size * 0.5
	for d in directions:
		var vers: Vector3 = (d[0] as Vector3) - joueur.global_position
		var local := joueur.global_transform.basis.inverse() * vers
		var ang := atan2(local.x, -local.z)
		var a := clampf(float(d[1]) / 0.5, 0.0, 1.0)
		var r := 150.0
		var dir := Vector2(sin(ang), -cos(ang))
		var perp := Vector2(-dir.y, dir.x)
		var p := c + dir * r
		var pts := PackedVector2Array([p + dir * 26, p - perp * 34 + dir * 4, p - perp * 26, p + perp * 26, p + perp * 34 + dir * 4])
		indicateurs.draw_colored_polygon(PackedVector2Array([p + dir * 22, p - perp * 30, p + perp * 30]), Color(1.0, 0.15, 0.15, 0.55 * a))
		pts.clear()


func maj_partie(minuteur: float, score_bleu: int, score_rouge: int, texte_manche: String, urgent := false) -> void:
	var t := maxi(0, ceili(minuteur))
	l_minuteur.text = "%d:%02d" % [t / 60.0, t % 60]
	l_minuteur.add_theme_color_override("font_color", Style.ROUGE if urgent else Style.TEXTE)
	l_score_bleu.text = str(score_bleu)
	l_score_rouge.text = str(score_rouge)
	l_manche.text = texte_manche
