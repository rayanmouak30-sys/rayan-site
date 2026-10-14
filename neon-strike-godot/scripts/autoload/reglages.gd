extends Node
## Réglages du joueur : graphismes, son, sensibilité, viseur et touches (clavier, souris, manette).
## Gardés dans user://reglages.cfg et appliqués au démarrage.

signal change(cle: String)

const FICHIER := "user://reglages.cfg"

# Touches : positions physiques (KEY_W = Z sur un clavier AZERTY). Souris : "souris:<bouton>".
# [id, nom affiché, touches par défaut, boutons de manette par défaut]
const ACTIONS := [
	["avancer", "Avancer", [KEY_W, KEY_UP], []],
	["reculer", "Reculer", [KEY_S, KEY_DOWN], []],
	["gauche", "Aller à gauche", [KEY_A, KEY_LEFT], []],
	["droite", "Aller à droite", [KEY_D, KEY_RIGHT], []],
	["saut", "Sauter", [KEY_SPACE], [JOY_BUTTON_A]],
	["sprint", "Courir", [KEY_SHIFT], [JOY_BUTTON_LEFT_STICK]],
	["accroupi", "S'accroupir", [KEY_CTRL], [JOY_BUTTON_B]],
	["tir", "Tirer", ["souris:1"], []],
	["viser", "Viser", ["souris:2"], []],
	["recharger", "Recharger", [KEY_R], [JOY_BUTTON_X]],
	["arme_1", "Arme principale", [KEY_1], []],
	["arme_2", "Pistolet", [KEY_2], []],
	["arme_3", "Couteau", [KEY_3], []],
	["arme_suivante", "Arme suivante", ["souris:5"], [JOY_BUTTON_Y]],
	["arme_precedente", "Arme précédente", ["souris:4"], []],
	["capacite_c", "Capacité 1 (C)", [KEY_C], [JOY_BUTTON_RIGHT_SHOULDER]],
	["capacite_q", "Capacité 2 (A en AZERTY)", [KEY_Q], [JOY_BUTTON_LEFT_SHOULDER]],
	["capacite_e", "Capacité signature (E)", [KEY_E], [JOY_BUTTON_DPAD_UP]],
	["ultime", "Ultime (X)", [KEY_X], [JOY_BUTTON_DPAD_DOWN]],
	["interagir", "Poser / désamorcer le spike", [KEY_F], [JOY_BUTTON_DPAD_RIGHT]],
	["lacher", "Lâcher le spike", [KEY_G], []],
	["boutique", "Boutique", [KEY_B], [JOY_BUTTON_BACK]],
	["tableau", "Tableau des scores", [KEY_TAB], [JOY_BUTTON_DPAD_LEFT]],
	["inspecter", "Inspecter l'arme", [KEY_Y], [JOY_BUTTON_RIGHT_STICK]],
	["pause", "Pause", [KEY_ESCAPE], [JOY_BUTTON_START]],
]

const DEFAUTS := {
	# Graphismes
	"qualite": "auto",          # auto, bas, moyen, haut, ultra
	"plein_ecran": true,
	"vsync": true,
	"fps_max": 0,
	"echelle_rendu": 1.0,       # 0.5 à 1.0 (FSR en dessous de 1)
	"fov": 103.0,
	"luminosite": 1.0,
	"afficher_fps": false,
	# Son
	"volume_general": 0.8,
	"volume_effets": 1.0,
	"volume_musique": 0.5,
	"volume_voix": 0.9,
	# Contrôles
	"sensibilite": 1.0,
	"sensibilite_visee": 0.85,
	"sensibilite_manette": 1.0,
	"inverser_y": false,
	"balancement": 1.0,
	# Viseur
	"viseur_couleur": Color(0.49, 1.0, 0.83),
	"viseur_longueur": 7.0,
	"viseur_epaisseur": 2.0,
	"viseur_ecart": 4.0,
	"viseur_point": true,
	"viseur_contour": true,
	"viseur_dynamique": true,
	# Partie
	"difficulte": "normal",
	"mode": "spike",
	"allies": true,
	"pseudo": "",
	"adresse_serveur": "127.0.0.1",
}

var valeurs := {}
var liaisons := {}        # action -> Array de liaisons (int = keycode physique, "souris:n")
var liaisons_manette := {} # action -> Array de boutons


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	valeurs = DEFAUTS.duplicate(true)
	for a in ACTIONS:
		liaisons[a[0]] = a[2].duplicate()
		liaisons_manette[a[0]] = a[3].duplicate()
	charger()
	appliquer_touches()
	appliquer_fenetre()
	appliquer_son()


func lire(cle: String) -> Variant:
	return valeurs.get(cle, DEFAUTS.get(cle))


func ecrire(cle: String, valeur: Variant, sauver_maintenant := true) -> void:
	valeurs[cle] = valeur
	if cle.begins_with("volume_"):
		appliquer_son()
	elif cle in ["plein_ecran", "vsync", "fps_max", "echelle_rendu"]:
		appliquer_fenetre()
	change.emit(cle)
	if sauver_maintenant:
		sauver()


func charger() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(FICHIER) != OK:
		return
	for cle in DEFAUTS:
		if cfg.has_section_key("reglages", cle):
			var v: Variant = cfg.get_value("reglages", cle)
			if typeof(v) == typeof(DEFAUTS[cle]) or (DEFAUTS[cle] is float and v is int):
				valeurs[cle] = v
	for a in ACTIONS:
		if cfg.has_section_key("touches", a[0]):
			var l: Variant = cfg.get_value("touches", a[0])
			if l is Array:
				liaisons[a[0]] = l
		if cfg.has_section_key("manette", a[0]):
			var m: Variant = cfg.get_value("manette", a[0])
			if m is Array:
				liaisons_manette[a[0]] = m


func sauver() -> void:
	var cfg := ConfigFile.new()
	for cle in valeurs:
		cfg.set_value("reglages", cle, valeurs[cle])
	for a in liaisons:
		cfg.set_value("touches", a, liaisons[a])
	for a in liaisons_manette:
		cfg.set_value("manette", a, liaisons_manette[a])
	cfg.save(FICHIER)


# ----- Touches -----
func evenement_depuis(liaison: Variant) -> InputEvent:
	if liaison is String and liaison.begins_with("souris:"):
		var e := InputEventMouseButton.new()
		e.button_index = int(liaison.substr(7)) as MouseButton
		return e
	var k := InputEventKey.new()
	k.physical_keycode = int(liaison) as Key
	return k


func appliquer_touches() -> void:
	for a in ACTIONS:
		var id: String = a[0]
		if not InputMap.has_action(id):
			InputMap.add_action(id, 0.3)
		InputMap.action_erase_events(id)
		for l in liaisons[id]:
			InputMap.action_add_event(id, evenement_depuis(l))
		for b in liaisons_manette[id]:
			var j := InputEventJoypadButton.new()
			j.button_index = int(b) as JoyButton
			InputMap.action_add_event(id, j)
	# Gâchettes et stick gauche de la manette (fixes)
	_ajouter_axe("tir", JOY_AXIS_TRIGGER_RIGHT, 1.0)
	_ajouter_axe("viser", JOY_AXIS_TRIGGER_LEFT, 1.0)
	_ajouter_axe("avancer", JOY_AXIS_LEFT_Y, -1.0)
	_ajouter_axe("reculer", JOY_AXIS_LEFT_Y, 1.0)
	_ajouter_axe("gauche", JOY_AXIS_LEFT_X, -1.0)
	_ajouter_axe("droite", JOY_AXIS_LEFT_X, 1.0)
	# Stick droit : regard (actions dédiées)
	for r in [["regard_gauche", JOY_AXIS_RIGHT_X, -1.0], ["regard_droite", JOY_AXIS_RIGHT_X, 1.0], ["regard_haut", JOY_AXIS_RIGHT_Y, -1.0], ["regard_bas", JOY_AXIS_RIGHT_Y, 1.0]]:
		if not InputMap.has_action(r[0]):
			InputMap.add_action(r[0], 0.15)
		InputMap.action_erase_events(r[0])
		_ajouter_axe(r[0], r[1], r[2])
	# Navigation dans les menus à la manette
	for paire in [["ui_accept", JOY_BUTTON_A], ["ui_cancel", JOY_BUTTON_B]]:
		var j := InputEventJoypadButton.new()
		j.button_index = paire[1]
		if not InputMap.action_has_event(paire[0], j):
			InputMap.action_add_event(paire[0], j)


func _ajouter_axe(action: String, axe: JoyAxis, sens: float) -> void:
	var e := InputEventJoypadMotion.new()
	e.axis = axe
	e.axis_value = sens
	InputMap.action_add_event(action, e)


func lier(action: String, emplacement: int, liaison: Variant) -> void:
	# Une touche ne sert qu'à une action : on la retire des autres
	for a in liaisons:
		liaisons[a] = liaisons[a].filter(func(x): return str(x) != str(liaison))
	var l: Array = liaisons[action]
	while l.size() <= emplacement:
		l.append(null)
	l[emplacement] = liaison
	liaisons[action] = l.filter(func(x): return x != null)
	appliquer_touches()
	sauver()
	change.emit("touches")


func lier_manette(action: String, bouton: int) -> void:
	for a in liaisons_manette:
		liaisons_manette[a] = liaisons_manette[a].filter(func(x): return int(x) != bouton)
	liaisons_manette[action] = [bouton]
	appliquer_touches()
	sauver()
	change.emit("touches")


func reinitialiser_touches() -> void:
	for a in ACTIONS:
		liaisons[a[0]] = a[2].duplicate()
		liaisons_manette[a[0]] = a[3].duplicate()
	appliquer_touches()
	sauver()
	change.emit("touches")


func nom_liaison(liaison: Variant) -> String:
	if liaison == null:
		return "—"
	if liaison is String and liaison.begins_with("souris:"):
		match int(liaison.substr(7)):
			1: return "Clic gauche"
			2: return "Clic droit"
			3: return "Clic molette"
			4: return "Molette haut"
			5: return "Molette bas"
			8: return "Souris 4"
			9: return "Souris 5"
		return "Souris " + liaison.substr(7)
	# Nom de la touche selon la disposition réelle du clavier (A sur AZERTY pour KEY_Q)
	var physique := int(liaison) as Key
	var reelle := DisplayServer.keyboard_get_keycode_from_physical(physique)
	return OS.get_keycode_string(reelle if reelle != KEY_NONE else physique)


func nom_bouton_manette(b: int) -> String:
	var noms := {
		JOY_BUTTON_A: "A", JOY_BUTTON_B: "B", JOY_BUTTON_X: "X", JOY_BUTTON_Y: "Y",
		JOY_BUTTON_LEFT_SHOULDER: "LB", JOY_BUTTON_RIGHT_SHOULDER: "RB", JOY_BUTTON_BACK: "Select",
		JOY_BUTTON_START: "Start", JOY_BUTTON_LEFT_STICK: "L3", JOY_BUTTON_RIGHT_STICK: "R3",
		JOY_BUTTON_DPAD_UP: "Croix ↑", JOY_BUTTON_DPAD_DOWN: "Croix ↓", JOY_BUTTON_DPAD_LEFT: "Croix ←", JOY_BUTTON_DPAD_RIGHT: "Croix →",
	}
	return noms.get(b, "Bouton %d" % b)


## Texte court de la touche principale d'une action (affiché dans le HUD)
func touche(action: String) -> String:
	var l: Array = liaisons.get(action, [])
	if l.is_empty():
		return "—"
	var t := nom_liaison(l[0])
	return t if t.length() <= 6 else t.substr(0, 5) + "."


# ----- Fenêtre, rendu et son -----
func appliquer_fenetre() -> void:
	if DisplayServer.get_name() == "headless":
		return
	var fenetre := get_window()
	if Test.actif:
		return
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_EXCLUSIVE_FULLSCREEN if lire("plein_ecran") else DisplayServer.WINDOW_MODE_WINDOWED)
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_ENABLED if lire("vsync") else DisplayServer.VSYNC_DISABLED)
	Engine.max_fps = int(lire("fps_max"))
	var e: float = clampf(float(lire("echelle_rendu")), 0.5, 1.0)
	fenetre.scaling_3d_scale = e
	fenetre.scaling_3d_mode = Viewport.SCALING_3D_MODE_FSR if e < 0.99 else Viewport.SCALING_3D_MODE_BILINEAR


func appliquer_son() -> void:
	var regler := func(bus: String, v: float) -> void:
		var i := AudioServer.get_bus_index(bus)
		if i >= 0:
			AudioServer.set_bus_volume_db(i, linear_to_db(maxf(v, 0.0001)))
			AudioServer.set_bus_mute(i, v <= 0.001)
	regler.call("Master", float(lire("volume_general")))
	regler.call("Effets", float(lire("volume_effets")))
	regler.call("Musique", float(lire("volume_musique")))
	regler.call("Voix", float(lire("volume_voix")))


## Qualité réellement utilisée : "auto" choisit selon la carte graphique
func qualite() -> String:
	var q: String = lire("qualite")
	if q != "auto":
		return q
	if RenderingServer.get_current_rendering_method() == "gl_compatibility":
		return "bas"
	var nom := RenderingServer.get_video_adapter_name().to_lower()
	var integree := nom.contains("intel") or nom.contains("uhd") or nom.contains("iris") or nom.contains("llvmpipe") or nom.contains("vega 8") or nom.contains("radeon(tm) graphics") or nom.contains("mali") or nom.contains("adreno")
	if integree:
		return "bas"
	if nom.contains("rtx 40") or nom.contains("rtx 50") or nom.contains("rx 7") or nom.contains("rx 9") or nom.contains("rtx 30"):
		return "ultra"
	return "haut"


## Réglages d'éclairage selon la qualité (appelé par la carte quand elle crée son environnement)
func appliquer_environnement(env: Environment) -> void:
	var q := qualite()
	var compat := RenderingServer.get_current_rendering_method() == "gl_compatibility"
	env.ssao_enabled = not compat and q in ["moyen", "haut", "ultra"]
	env.ssil_enabled = not compat and q in ["haut", "ultra"]
	env.ssr_enabled = not compat and q == "ultra"
	env.sdfgi_enabled = not compat and q in ["haut", "ultra"]
	env.glow_enabled = q != "bas" or not compat
	env.volumetric_fog_enabled = not compat and q == "ultra" and env.volumetric_fog_enabled
	env.tonemap_exposure = float(lire("luminosite")) * env.tonemap_exposure
	var vp := get_viewport()
	vp.msaa_3d = Viewport.MSAA_DISABLED if q == "bas" else Viewport.MSAA_2X if q == "moyen" else Viewport.MSAA_4X
	vp.screen_space_aa = Viewport.SCREEN_SPACE_AA_FXAA if q == "bas" else Viewport.SCREEN_SPACE_AA_DISABLED
	vp.use_taa = false
	RenderingServer.directional_shadow_atlas_set_size(2048 if q == "bas" else 4096, true)
	RenderingServer.directional_soft_shadow_filter_set_quality(RenderingServer.SHADOW_QUALITY_SOFT_VERY_LOW if q == "bas" else RenderingServer.SHADOW_QUALITY_SOFT_MEDIUM)
