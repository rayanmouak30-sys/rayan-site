class_name Style
extends RefCounted
## Charte graphique de l'interface : couleurs, polices, thème Godot et petits constructeurs.

const FOND := Color(0.035, 0.05, 0.08, 0.92)
const PANNEAU := Color(0.07, 0.09, 0.14, 0.88)
const PANNEAU_CLAIR := Color(0.12, 0.15, 0.22, 0.9)
const LIGNE := Color(1, 1, 1, 0.08)
const ACCENT := Color(0.49, 1.0, 0.83)
const ACCENT2 := Color(1.0, 0.82, 0.4)
const ROUGE := Color(1.0, 0.27, 0.33)
const BLEU := Color(0.31, 0.82, 1.0)
const TEXTE := Color(0.92, 0.94, 0.97)
const TEXTE2 := Color(0.6, 0.65, 0.74)
const OK := Color(0.45, 1.0, 0.55)

static var _polices := {}
static var _theme: Theme


static func police(poids := 500, titre := false) -> FontFile:
	var cle := ("rajdhani" if titre else "barlow") + str(poids)
	if _polices.has(cle):
		return _polices[cle]
	var chemin := "res://assets/polices/%s-latin-%d-normal.woff2" % ["rajdhani" if titre else "barlow", poids]
	var f: FontFile = load(chemin) if ResourceLoader.exists(chemin) else null
	if f == null:
		f = ThemeDB.fallback_font as FontFile
	_polices[cle] = f
	return f


static func couleur_equipe(e: String) -> Color:
	return BLEU if e == "bleu" else ROUGE


static func boite(couleur: Color, rayon := 6, bord := Color(0, 0, 0, 0), largeur_bord := 0, marge := 10) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = couleur
	s.set_corner_radius_all(rayon)
	if largeur_bord > 0:
		s.border_color = bord
		s.set_border_width_all(largeur_bord)
	s.content_margin_left = marge
	s.content_margin_right = marge
	s.content_margin_top = marge * 0.6
	s.content_margin_bottom = marge * 0.6
	s.anti_aliasing = true
	return s


static func theme() -> Theme:
	if _theme:
		return _theme
	var t := Theme.new()
	t.default_font = police(500)
	t.default_font_size = 18
	t.set_color("font_color", "Label", TEXTE)
	# Boutons
	t.set_stylebox("normal", "Button", boite(Color(0.1, 0.13, 0.2, 0.9), 6, LIGNE, 1, 14))
	t.set_stylebox("hover", "Button", boite(Color(0.14, 0.2, 0.28, 0.95), 6, ACCENT * Color(1, 1, 1, 0.6), 1, 14))
	t.set_stylebox("pressed", "Button", boite(Color(0.2, 0.32, 0.36, 1.0), 6, ACCENT, 2, 14))
	t.set_stylebox("disabled", "Button", boite(Color(0.08, 0.09, 0.12, 0.7), 6, LIGNE, 1, 14))
	t.set_stylebox("focus", "Button", boite(Color(0, 0, 0, 0), 6, ACCENT, 2, 14))
	t.set_color("font_color", "Button", TEXTE)
	t.set_color("font_hover_color", "Button", Color.WHITE)
	t.set_color("font_pressed_color", "Button", ACCENT)
	t.set_color("font_disabled_color", "Button", TEXTE2 * Color(1, 1, 1, 0.6))
	t.set_font("font", "Button", police(600, true))
	t.set_font_size("font_size", "Button", 20)
	# Cases à cocher : pas de fond
	var vide := StyleBoxEmpty.new()
	for etat in ["normal", "hover", "pressed", "focus", "hover_pressed", "disabled"]:
		t.set_stylebox(etat, "CheckButton", vide)
		t.set_stylebox(etat, "CheckBox", vide)
	t.set_color("font_color", "CheckButton", TEXTE)
	t.set_color("font_hover_color", "CheckButton", Color.WHITE)
	t.set_color("font_pressed_color", "CheckButton", ACCENT)
	# Panneaux
	t.set_stylebox("panel", "PanelContainer", boite(PANNEAU, 8, LIGNE, 1, 16))
	t.set_stylebox("panel", "Panel", boite(PANNEAU, 8, LIGNE, 1, 16))
	# Curseurs
	var piste := boite(Color(1, 1, 1, 0.1), 3, Color(0, 0, 0, 0), 0, 0)
	piste.content_margin_top = 3
	piste.content_margin_bottom = 3
	t.set_stylebox("slider", "HSlider", piste)
	var rempli := boite(ACCENT * Color(1, 1, 1, 0.8), 3, Color(0, 0, 0, 0), 0, 0)
	rempli.content_margin_top = 3
	rempli.content_margin_bottom = 3
	t.set_stylebox("grabber_area", "HSlider", rempli)
	t.set_stylebox("grabber_area_highlight", "HSlider", rempli)
	var poignee := Image.create(18, 18, false, Image.FORMAT_RGBA8)
	for y in 18:
		for x in 18:
			var d := Vector2(x - 8.5, y - 8.5).length()
			poignee.set_pixel(x, y, Color(1, 1, 1, clampf(8.5 - d, 0.0, 1.0)))
	var tp := ImageTexture.create_from_image(poignee)
	t.set_icon("grabber", "HSlider", tp)
	t.set_icon("grabber_highlight", "HSlider", tp)
	# Listes, onglets, champs
	t.set_stylebox("normal", "LineEdit", boite(Color(0.05, 0.07, 0.1, 0.95), 5, LIGNE, 1, 10))
	t.set_stylebox("focus", "LineEdit", boite(Color(0.05, 0.07, 0.1, 0.95), 5, ACCENT, 1, 10))
	t.set_stylebox("normal", "OptionButton", boite(Color(0.1, 0.13, 0.2, 0.9), 6, LIGNE, 1, 12))
	t.set_stylebox("hover", "OptionButton", boite(Color(0.14, 0.2, 0.28, 0.95), 6, ACCENT * Color(1, 1, 1, 0.6), 1, 12))
	t.set_stylebox("pressed", "OptionButton", boite(Color(0.2, 0.32, 0.36, 1.0), 6, ACCENT, 1, 12))
	t.set_stylebox("panel", "PopupMenu", boite(Color(0.06, 0.08, 0.12, 0.98), 6, LIGNE, 1, 8))
	t.set_stylebox("hover", "PopupMenu", boite(Color(0.16, 0.24, 0.3, 1.0), 4, Color(0, 0, 0, 0), 0, 8))
	t.set_stylebox("tab_selected", "TabBar", boite(Color(0.14, 0.2, 0.28, 0.95), 6, ACCENT, 0, 16))
	t.set_stylebox("tab_unselected", "TabBar", boite(Color(0, 0, 0, 0), 6, LIGNE, 0, 16))
	t.set_stylebox("tab_hovered", "TabBar", boite(Color(1, 1, 1, 0.05), 6, LIGNE, 0, 16))
	t.set_font("font", "TabBar", police(600, true))
	t.set_font_size("font_size", "TabBar", 22)
	t.set_color("font_selected_color", "TabBar", ACCENT)
	t.set_color("font_unselected_color", "TabBar", TEXTE2)
	t.set_color("font_hovered_color", "TabBar", TEXTE)
	t.set_stylebox("panel", "TabContainer", boite(Color(0, 0, 0, 0), 0, LIGNE, 0, 0))
	t.set_stylebox("tab_selected", "TabContainer", boite(Color(0.14, 0.2, 0.28, 0.95), 6, ACCENT, 0, 16))
	t.set_stylebox("tab_unselected", "TabContainer", boite(Color(0, 0, 0, 0), 6, LIGNE, 0, 16))
	t.set_stylebox("tab_hovered", "TabContainer", boite(Color(1, 1, 1, 0.05), 6, LIGNE, 0, 16))
	t.set_font("font", "TabContainer", police(600, true))
	t.set_font_size("font_size", "TabContainer", 22)
	t.set_color("font_selected_color", "TabContainer", ACCENT)
	t.set_color("font_unselected_color", "TabContainer", TEXTE2)
	t.set_stylebox("panel", "TooltipPanel", boite(Color(0.05, 0.07, 0.1, 0.97), 5, ACCENT * Color(1, 1, 1, 0.5), 1, 10))
	var barre := boite(Color(1, 1, 1, 0.08), 3, Color(0, 0, 0, 0), 0, 0)
	t.set_stylebox("scroll", "VScrollBar", barre)
	t.set_stylebox("grabber", "VScrollBar", boite(Color(1, 1, 1, 0.25), 3, Color(0, 0, 0, 0), 0, 0))
	t.set_stylebox("grabber_highlight", "VScrollBar", boite(ACCENT * Color(1, 1, 1, 0.6), 3, Color(0, 0, 0, 0), 0, 0))
	t.set_stylebox("grabber_pressed", "VScrollBar", boite(ACCENT, 3, Color(0, 0, 0, 0), 0, 0))
	_theme = t
	return t


## Étiquette prête à l'emploi
static func etiquette(texte: String, taille := 18, couleur := TEXTE, titre := false, poids := 600) -> Label:
	var l := Label.new()
	l.text = texte
	l.add_theme_font_override("font", police(poids, titre))
	l.add_theme_font_size_override("font_size", taille)
	l.add_theme_color_override("font_color", couleur)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


static func ombre(l: Label, taille := 2) -> Label:
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.6))
	l.add_theme_constant_override("shadow_offset_x", 0)
	l.add_theme_constant_override("shadow_offset_y", taille)
	l.add_theme_constant_override("shadow_outline_size", taille + 2)
	return l



## Bouton de menu (texte en capitales, police de titre)
static func bouton(texte: String, taille := 22, largeur := 0.0, hauteur := 52.0) -> Button:
	var b := Button.new()
	b.text = texte
	b.add_theme_font_size_override("font_size", taille)
	b.custom_minimum_size = Vector2(largeur, hauteur)
	b.focus_mode = Control.FOCUS_NONE
	b.mouse_entered.connect(func() -> void: Sons.jouer("ui_survol", -12.0, 1.0, "Interface"))
	b.pressed.connect(func() -> void: Sons.jouer("ui_clic", -6.0, 1.0, "Interface"))
	return b


## Bouton plat de navigation (menu de gauche) avec liseré à la sélection
static func bouton_nav(texte: String) -> Button:
	var b := bouton(texte, 30, 320, 58)
	b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	b.add_theme_stylebox_override("normal", boite(Color(0, 0, 0, 0), 0, Color(0, 0, 0, 0), 0, 18))
	var survol := boite(Color(1, 1, 1, 0.06), 4, ACCENT, 0, 18)
	survol.border_width_left = 4
	survol.border_color = ACCENT
	b.add_theme_stylebox_override("hover", survol)
	b.add_theme_stylebox_override("pressed", survol)
	b.add_theme_color_override("font_hover_color", ACCENT)
	return b


## Étiquette de catégorie / badge coloré
static func badge(texte: String, couleur: Color, taille := 14) -> PanelContainer:
	var p := PanelContainer.new()
	var sb := boite(Color(couleur.r, couleur.g, couleur.b, 0.18), 4, couleur, 1, 8)
	sb.content_margin_top = 2
	sb.content_margin_bottom = 2
	p.add_theme_stylebox_override("panel", sb)
	p.add_child(etiquette(texte, taille, couleur, true, 700))
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return p
