extends Control
## Arsenal : les armes en 3D (rotation), leurs caractéristiques et leurs 11 skins (débloqués par niveau ou points).

signal retour

var vp: SubViewport
var pivot: Node3D
var modele: Node3D
var id_arme := "pulsar"
var liste_skins: VBoxContainer
var l_nom: Label
var l_stats: Label
var angle := 0.0
var glisse := false


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = Style.theme()
	var fond := ColorRect.new()
	fond.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var sm := ShaderMaterial.new()
	sm.shader = load("res://assets/shaders/fond_menu.gdshader")
	fond.material = sm
	add_child(fond)
	var conteneur := SubViewportContainer.new()
	conteneur.stretch = true
	conteneur.anchor_left = 0.24
	conteneur.anchor_right = 0.7
	conteneur.anchor_top = 0.1
	conteneur.anchor_bottom = 0.9
	conteneur.gui_input.connect(_glisser)
	add_child(conteneur)
	vp = SubViewport.new()
	vp.own_world_3d = true
	vp.transparent_bg = true
	vp.msaa_3d = Viewport.MSAA_4X
	conteneur.add_child(vp)
	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_CLEAR_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.55, 0.6, 0.72)
	env.ambient_light_energy = 0.6
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.glow_enabled = true
	we.environment = env
	vp.add_child(we)
	for r in [Vector3(-35, 30, 0), Vector3(-15, 200, 0), Vector3(40, -60, 0)]:
		var l := DirectionalLight3D.new()
		l.rotation_degrees = r
		l.light_energy = 1.4 if r.x < -20 else 0.6
		vp.add_child(l)
	var cam := Camera3D.new()
	cam.fov = 28
	cam.position = Vector3(0, 0.05, 2.0)
	vp.add_child(cam)
	pivot = Node3D.new()
	vp.add_child(pivot)
	# Liste des armes
	var gauche := VBoxContainer.new()
	gauche.anchor_bottom = 1.0
	gauche.offset_left = 40
	gauche.offset_top = 40
	gauche.offset_right = 360
	gauche.add_theme_constant_override("separation", 8)
	add_child(gauche)
	var b_ret := Style.bouton("‹ RETOUR", 18, 120, 40)
	b_ret.pressed.connect(func() -> void: retour.emit())
	gauche.add_child(b_ret)
	gauche.add_child(Style.etiquette("ARSENAL", 40, Style.TEXTE, true, 700))
	for id in ["pulsar", "fusil", "sniper", "pompe", "pistolet", "couteau"]:
		var b := Style.bouton(String(DonneesArmes.arme(id)["nom"]).to_upper(), 20, 300, 50)
		var i: String = id
		b.pressed.connect(func() -> void: montrer(i))
		gauche.add_child(b)
	l_nom = Style.ombre(Style.etiquette("", 48, Style.TEXTE, true, 700))
	l_nom.anchor_left = 0.26
	l_nom.offset_top = 40
	add_child(l_nom)
	l_stats = Style.etiquette("", 16, Style.TEXTE2, false, 500)
	l_stats.anchor_left = 0.26
	l_stats.anchor_top = 1.0
	l_stats.anchor_bottom = 1.0
	l_stats.offset_top = -90
	add_child(l_stats)
	# Skins
	var droite := PanelContainer.new()
	droite.anchor_left = 0.72
	droite.anchor_right = 1.0
	droite.anchor_bottom = 1.0
	droite.offset_top = 40
	droite.offset_bottom = -40
	droite.offset_right = -40
	add_child(droite)
	var defil := ScrollContainer.new()
	droite.add_child(defil)
	liste_skins = VBoxContainer.new()
	liste_skins.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	liste_skins.add_theme_constant_override("separation", 8)
	defil.add_child(liste_skins)
	montrer(id_arme)


func montrer(id: String, apercu := "") -> void:
	id_arme = id
	if modele:
		modele.queue_free()
	modele = (load("res://assets/armes/arme_%s.glb" % id) as PackedScene).instantiate()
	pivot.add_child(modele)
	# Centre et cadre l'arme
	var aabb := AABB()
	var premier := true
	for mi in modele.find_children("*", "MeshInstance3D", true, false):
		var b: AABB = (mi as MeshInstance3D).get_aabb()
		b = (mi as MeshInstance3D).transform * b
		aabb = b if premier else aabb.merge(b)
		premier = false
	var echelle := 0.9 / maxf(aabb.size.length(), 0.01)
	modele.scale = Vector3.ONE * echelle
	modele.position = -aabb.get_center() * echelle
	Skins.appliquer_arme(modele, apercu if apercu != "" else Profil.skin_arme(id))
	var def := DonneesArmes.arme(id)
	l_nom.text = String(def["nom"]).to_upper()
	if def.get("type") == "melee":
		l_stats.text = "Coup léger %d · coup lourd %d · dans le dos ×2" % [int(def["degats_leger"]), int(def["degats_lourd"])]
	else:
		var d: Dictionary = def["degats"]
		l_stats.text = "Prix ¤ %d · chargeur %d · cadence %.0f coups/min · rechargement %.1f s\nDégâts : tête %d · corps %d · jambes %d" % [int(def.get("prix", 0)), int(def["chargeur"]), 60.0 / float(def["cadence"]), float(def["rechargement"]), int(d["tete"]), int(d["corps"]), int(d["jambes"])]
	if apercu == "":
		_skins()


func _skins() -> void:
	for c in liste_skins.get_children():
		c.queue_free()
	liste_skins.add_child(Style.etiquette("SKINS · %d point(s)" % int(Profil.donnees["points_skins"]), 20, Style.TEXTE, true, 700))
	for s in DonneesArmes.SKINS:
		var cle := "arme:%s" % s["id"]
		var dispo := Profil.skin_disponible(cle, s)
		var equipe: bool = Profil.skin_arme(id_arme) == s["id"]
		var b := Button.new()
		b.custom_minimum_size = Vector2(0, 62)
		b.focus_mode = Control.FOCUS_NONE
		var c1 := Color(s.get("carcasse", "#555a66"))
		var c2 := Color(s.get("accent", "#ffffff"))
		b.add_theme_stylebox_override("normal", Style.boite(Color(c1.r * 0.3, c1.g * 0.3, c1.b * 0.3, 0.9), 6, c2 if equipe else Color(1, 1, 1, 0.1), 2 if equipe else 1, 10))
		b.add_theme_stylebox_override("hover", Style.boite(Color(c1.r * 0.4, c1.g * 0.4, c1.b * 0.4, 1.0), 6, c2, 2, 10))
		var h := HBoxContainer.new()
		h.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		h.offset_left = 12
		h.offset_right = -12
		h.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(h)
		var pastille := ColorRect.new()
		pastille.custom_minimum_size = Vector2(28, 28)
		pastille.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		pastille.color = c1
		pastille.mouse_filter = Control.MOUSE_FILTER_IGNORE
		h.add_child(pastille)
		var n := Style.etiquette(String(s["nom"]).to_upper(), 18, Style.TEXTE, true, 700)
		n.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		h.add_child(n)
		var etat := "ÉQUIPÉ" if equipe else ("DISPONIBLE" if dispo else "NIV. %d · %d PT" % [int(s.get("niveau", 1)), int(s.get("prix", 0))])
		h.add_child(Style.etiquette(etat, 13, c2 if equipe else (Style.TEXTE2 if dispo else Style.ROUGE), true, 700))
		var sid: String = s["id"]
		b.mouse_entered.connect(func() -> void: Skins.appliquer_arme(modele, sid))
		b.mouse_exited.connect(func() -> void: Skins.appliquer_arme(modele, Profil.skin_arme(id_arme)))
		b.pressed.connect(func() -> void:
			if dispo or Profil.acheter_skin(cle, int(s.get("prix", 0))):
				Profil.equiper_skin_arme(id_arme, sid)
				Sons.jouer("ui_achat", -6.0, 1.0, "Interface")
				_skins()
			else:
				Sons.jouer("ui_refus", -6.0, 1.0, "Interface"))
		liste_skins.add_child(b)


func _glisser(event: InputEvent) -> void:
	if event is InputEventMouseButton and (event as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT:
		glisse = (event as InputEventMouseButton).pressed
	elif event is InputEventMouseMotion and glisse:
		angle += (event as InputEventMouseMotion).relative.x * 0.01


func _process(dt: float) -> void:
	if not glisse:
		angle += dt * 0.4
	pivot.rotation = Vector3(0.15, angle, 0)
