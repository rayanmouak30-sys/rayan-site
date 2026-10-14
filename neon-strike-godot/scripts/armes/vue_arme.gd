class_name VueArme
extends SubViewportContainer
## Vue à la première personne : bras + arme (modèles Blender animés) rendus dans une couche à part
## (jamais à travers les murs), avec balancement, course, recul à ressorts, visée alignée sur le viseur,
## flash de bouche et écran de munitions du Pulsar.

const FOV := 64.0
const DISTANCE_VISEE := {"pulsar": 0.33, "fusil": 0.3, "pistolet": 0.4, "pompe": 0.34, "sniper": 0.2, "couteau": 0.3}
## Décalage de l'arme à la hanche (repère caméra) : arme un peu plus basse et à droite, façon FPS compétitif
const DECALAGE_HANCHE := {"pulsar": Vector3(0.022, -0.018, 0.012), "fusil": Vector3(0.022, -0.016, 0.01), "pompe": Vector3(0.02, -0.014, 0.012),
	"sniper": Vector3(0.02, -0.012, 0.012), "pistolet": Vector3(-0.012, 0.016, -0.008), "couteau": Vector3(0.0, 0.0, 0.0)}
const RECUL := {"pulsar": 0.9, "fusil": 1.0, "pistolet": 1.3, "pompe": 2.2, "sniper": 2.4, "couteau": 0.0}
## Sons calés sur les animations (instant relatif 0..1, nom du son) ; "*" = toutes les armes à chargeur
const SONS_ANIM := {
	"rechargement": {
		"*": [[0.2, "chargeur_sortie"], [0.56, "chargeur_entree"]],
		"pompe": [[0.12, "manip"], [0.32, "cartouche"], [0.495, "cartouche"], [0.67, "cartouche"], [0.845, "cartouche"]],
	},
	"rechargement_vide": {
		"*": [[0.2, "chargeur_sortie"], [0.56, "chargeur_entree"], [0.79, "armement"]],
		"pistolet": [[0.2, "chargeur_sortie"], [0.56, "chargeur_entree"], [0.79, "culasse_pistolet"]],
		"sniper": [[0.06, "verrou_ouvre"], [0.2, "chargeur_sortie"], [0.56, "chargeur_entree"], [0.94, "verrou_ferme"]],
		"pompe": [[0.12, "manip"], [0.32, "cartouche"], [0.495, "cartouche"], [0.67, "cartouche"], [0.845, "cartouche"], [0.93, "pompe"]],
	},
	"tir": {"pompe": [[0.42, "pompe"]], "sniper": [[0.4, "verrou_ouvre"], [0.76, "verrou_ferme"]]},
	"sortie": {"*": [[0.0, "sortie_tissu"], [0.62, "armement_leger"]], "couteau": [[0.0, "couteau_sortie"]], "pistolet": [[0.0, "sortie_tissu"], [0.6, "culasse_pistolet"]]},
	"inspection": {"*": [[0.1, "manip"], [0.55, "manip"]], "couteau": [[0.15, "couteau_sortie"], [0.5, "couteau_sortie"]]},
}

var vp: SubViewport
var cam: Camera3D
var pivot: Node3D
var monde_env: Environment
var lumiere_cle: DirectionalLight3D
var modeles := {}          # id -> {racine, ap, viseur, bouche, ecran, ads}
var id_actuel := ""
var actuel := {}

var visee_k := 0.0
var sprint_k := 0.0
var bob_t := 0.0
var bob_k := 0.0
var balance := Vector2.ZERO
var atterrissage := 0.0
var ressort_z := Ressort.new(260.0, 22.0)
var ressort_rx := Ressort.new(220.0, 20.0)
var ressort_rz := Ressort.new(180.0, 16.0)
var ressort_y := Ressort.new(160.0, 18.0)
var flash_t := 0.0
var flash: Node3D
var lumiere_flash: OmniLight3D
var mat_flash: StandardMaterial3D
var amplitude_bob := 1.0
var douilles: Array[MeshInstance3D] = []   # douilles éjectées (réserve)
var douilles_v: Array[Vector3] = []
var douilles_rot: Array[Vector3] = []
var douilles_t: Array[float] = []
var i_douille := 0
var anim_avant := 0.0       # position relative précédente de l'animation (pour les sons)
var anim_nom_avant := ""


class Ressort:
	var k: float
	var c: float
	var x := 0.0
	var v := 0.0
	func _init(raideur: float, amortissement: float) -> void:
		k = raideur
		c = amortissement
	func impulsion(dv: float) -> void:
		v += dv
	func maj(dt: float, cible := 0.0) -> float:
		var a := -k * (x - cible) - c * v
		v += a * dt
		x += v * dt
		return x


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	stretch = true
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	vp = SubViewport.new()
	vp.transparent_bg = true
	vp.own_world_3d = true
	vp.msaa_3d = Viewport.MSAA_4X
	vp.positional_shadow_atlas_size = 0
	vp.handle_input_locally = false
	add_child(vp)
	var env := WorldEnvironment.new()
	monde_env = Environment.new()
	monde_env.background_mode = Environment.BG_CLEAR_COLOR
	monde_env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	monde_env.ambient_light_color = Color(0.62, 0.68, 0.78)
	monde_env.ambient_light_energy = 0.55
	monde_env.tonemap_mode = Environment.TONE_MAPPER_AGX
	monde_env.reflected_light_source = Environment.REFLECTION_SOURCE_DISABLED
	env.environment = monde_env
	vp.add_child(env)
	lumiere_cle = DirectionalLight3D.new()
	lumiere_cle.rotation_degrees = Vector3(-38, 28, 0)
	lumiere_cle.light_energy = 1.6
	lumiere_cle.light_color = Color(1.0, 0.95, 0.88)
	vp.add_child(lumiere_cle)
	var contre := DirectionalLight3D.new()
	contre.rotation_degrees = Vector3(-10, 160, 0)
	contre.light_energy = 0.8
	contre.light_color = Color(0.6, 0.78, 1.0)
	vp.add_child(contre)
	var dessous := DirectionalLight3D.new()
	dessous.rotation_degrees = Vector3(55, -20, 0)
	dessous.light_energy = 0.25
	dessous.light_color = Color(0.9, 0.85, 0.8)
	vp.add_child(dessous)
	cam = Camera3D.new()
	cam.fov = FOV
	cam.near = 0.01
	cam.far = 20.0
	vp.add_child(cam)
	pivot = Node3D.new()
	cam.add_child(pivot)
	_creer_flash()
	_creer_douilles()


func _creer_flash() -> void:
	flash = Node3D.new()
	mat_flash = StandardMaterial3D.new()
	mat_flash.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat_flash.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat_flash.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mat_flash.albedo_texture = Textures.eclat()
	mat_flash.albedo_color = Color(1.0, 0.8, 0.55)
	mat_flash.no_depth_test = false
	mat_flash.cull_mode = BaseMaterial3D.CULL_DISABLED
	for i in 3:
		var q := MeshInstance3D.new()
		var m := QuadMesh.new()
		m.size = Vector2(0.16, 0.16) if i == 0 else Vector2(0.07, 0.24)
		q.mesh = m
		q.material_override = mat_flash
		if i == 1:
			q.rotation_degrees = Vector3(90, 0, 0)
			q.position = Vector3(0, 0, -0.08)
		elif i == 2:
			q.rotation_degrees = Vector3(90, 90, 0)
			q.position = Vector3(0, 0, -0.08)
		q.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		flash.add_child(q)
	flash.visible = false
	lumiere_flash = OmniLight3D.new()
	lumiere_flash.omni_range = 1.6
	lumiere_flash.light_energy = 0.0
	flash.add_child(lumiere_flash)


func _creer_douilles() -> void:
	var laiton := StandardMaterial3D.new()
	laiton.albedo_color = Color(0.85, 0.62, 0.3)
	laiton.metallic = 1.0
	laiton.roughness = 0.28
	var m := CylinderMesh.new()
	m.top_radius = 0.0042
	m.bottom_radius = 0.0045
	m.height = 0.022
	m.radial_segments = 10
	m.rings = 1
	m.material = laiton
	for i in 8:
		var d := MeshInstance3D.new()
		d.mesh = m
		d.visible = false
		d.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		cam.add_child(d)
		douilles.append(d)
		douilles_v.append(Vector3.ZERO)
		douilles_rot.append(Vector3.ZERO)
		douilles_t.append(0.0)


## Éjecte une douille depuis la fenêtre d'éjection (repère caméra) ; cartouche de pompe plus grosse et rouge
func _ejecter() -> void:
	var rep: Node3D = actuel.get("ejection")
	if rep == null:
		return
	var d := douilles[i_douille]
	var i := i_douille
	i_douille = (i_douille + 1) % douilles.size()
	d.visible = true
	d.transform = cam.global_transform.affine_inverse() * rep.global_transform
	d.scale = Vector3(2.2, 2.4, 2.2) if id_actuel == "pompe" else (Vector3(1.2, 1.6, 1.2) if id_actuel == "sniper" else Vector3.ONE)
	d.rotate_object_local(Vector3.RIGHT, PI / 2)
	douilles_v[i] = Vector3(randf_range(0.9, 1.4), randf_range(0.8, 1.2), randf_range(-0.1, 0.2))
	douilles_rot[i] = Vector3(randf_range(-20, 20), randf_range(-8, 8), randf_range(10, 25))
	douilles_t[i] = 0.7


func _maj_douilles(dt: float) -> void:
	for i in douilles.size():
		if douilles_t[i] <= 0.0:
			continue
		douilles_t[i] -= dt
		var d := douilles[i]
		douilles_v[i] += Vector3(0, -6.0, 0) * dt
		d.position += douilles_v[i] * dt
		d.rotation += douilles_rot[i] * dt
		if douilles_t[i] <= 0.0:
			d.visible = false


func _modele(id: String) -> Dictionary:
	if modeles.has(id):
		return modeles[id]
	var scene: PackedScene = load("res://assets/armes/vm_%s.glb" % id)
	var racine: Node3D = scene.instantiate()
	racine.visible = false
	pivot.add_child(racine)
	var ap: AnimationPlayer = racine.find_child("AnimationPlayer", true, false)
	ap.animation_finished.connect(_fin_animation.bind(id))
	for nom in ["repos"]:
		if ap.has_animation(nom):
			ap.get_animation(nom).loop_mode = Animation.LOOP_LINEAR
	var d := {
		"racine": racine, "ap": ap,
		"viseur": racine.find_child("Repere_viseur", true, false),
		"bouche": racine.find_child("Repere_bouche", true, false),
		"ecran_repere": racine.find_child("Repere_ecran", true, false),
		"ejection": racine.find_child("Repere_ejection", true, false),
		"ads": Transform3D.IDENTITY, "ads_ok": false, "ecran": null,
	}
	if d["ecran_repere"] != null:
		var l := Label3D.new()
		l.text = "25"
		l.font_size = 48
		l.pixel_size = 0.00055
		l.outline_size = 0
		l.modulate = Color(0.45, 1.0, 1.0)
		l.rotation_degrees = Vector3(0, -90, 0)
		l.position = Vector3(-0.0015, 0, 0)
		l.double_sided = false
		l.no_depth_test = false
		l.shaded = false
		(d["ecran_repere"] as Node3D).add_child(l)
		d["ecran"] = l
	Skins.appliquer_arme(racine, Profil.skin_arme(id))
	modeles[id] = d
	return d


## Précharge les modèles (évite un à-coup au premier changement d'arme)
func prechauffer(ids: Array) -> void:
	for id in ids:
		_modele(id)


func equiper(id: String, skin := "") -> void:
	if actuel.has("racine"):
		(actuel["racine"] as Node3D).visible = false
	id_actuel = id
	actuel = _modele(id)
	if skin != "":
		Skins.appliquer_arme(actuel["racine"], skin)
	var r: Node3D = actuel["racine"]
	r.visible = true
	if flash.get_parent():
		flash.get_parent().remove_child(flash)
	if actuel["bouche"]:
		(actuel["bouche"] as Node3D).add_child(flash)
	var ap: AnimationPlayer = actuel["ap"]
	ap.play("sortie", 0.0)
	ap.seek(0.0, true)
	actuel["ads_ok"] = false


func _fin_animation(nom: StringName, id: String) -> void:
	if id != id_actuel:
		return
	if nom != &"repos":
		(actuel["ap"] as AnimationPlayer).play("repos", 0.12)


func jouer(nom: String, duree_voulue := 0.0, fondu := 0.06) -> void:
	if not actuel.has("ap"):
		return
	var ap: AnimationPlayer = actuel["ap"]
	if not ap.has_animation(nom):
		return
	var vitesse := 1.0
	if duree_voulue > 0.0:
		vitesse = ap.get_animation(nom).length / duree_voulue
	ap.play(nom, fondu, vitesse)
	ap.seek(0.0, true)


func animation_courante() -> String:
	return String((actuel["ap"] as AnimationPlayer).current_animation) if actuel.has("ap") else ""


func tir(lourd := false) -> void:
	var k: float = RECUL.get(id_actuel, 1.0)
	if id_actuel == "couteau":
		jouer("tir_lourd" if lourd else "tir", 0.0, 0.04)
		return
	jouer("tir", 0.0, 0.0)
	ressort_z.impulsion(0.9 * k * (0.45 if visee_k > 0.5 else 1.0))
	ressort_rx.impulsion(4.5 * k * (0.5 if visee_k > 0.5 else 1.0))
	ressort_rz.impulsion(randf_range(-1.5, 1.5) * k)
	flash_t = 0.05
	flash.visible = true
	flash.rotation.z = randf() * TAU
	flash.scale = Vector3.ONE * randf_range(0.8, 1.2)
	var def := DonneesArmes.arme(id_actuel)
	mat_flash.albedo_color = Color(def.get("couleur_flash", "#ffc27a"))
	lumiere_flash.light_color = mat_flash.albedo_color
	lumiere_flash.light_energy = 3.0
	# Douille : immédiate pour les armes semi/auto, au réarmement pour la pompe et le verrou
	if id_actuel in ["pistolet", "fusil"]:
		_ejecter()
	elif id_actuel in ["pompe", "sniper"]:
		get_tree().create_timer(DonneesArmes.arme(id_actuel)["cadence"] * 0.5).timeout.connect(func() -> void:
			if id_actuel in ["pompe", "sniper"]:
				_ejecter())


## Petit geste quand on lance une capacité (l'arme s'abaisse un instant)
func geste_capacite() -> void:
	ressort_y.impulsion(-2.5)
	ressort_rx.impulsion(-6.0)
	ressort_rz.impulsion(4.0)


func recharger(vide: bool, duree: float) -> void:
	jouer("rechargement_vide" if vide else "rechargement", duree, 0.1)


func inspecter() -> void:
	if animation_courante() == "repos":
		jouer("inspection", 0.0, 0.15)


func sortie_en_cours() -> bool:
	return animation_courante() == "sortie"


## Lumière ambiante de la vue FPS accordée à la carte
func accorder_lumiere(ambiance: Color, energie: float) -> void:
	monde_env.ambient_light_color = ambiance
	monde_env.ambient_light_energy = energie


## e : vitesse, au_sol, vise, sprint, souris (Vector2), mun, dt, atterrissage
func maj(dt: float, e: Dictionary) -> void:
	if not actuel.has("racine"):
		return
	var racine: Node3D = actuel["racine"]
	# Transformation de visée calculée une fois l'arme posée (viseur aligné sur le centre de l'écran)
	if not actuel["ads_ok"] and actuel["viseur"] != null and animation_courante() == "repos":
		var v := pivot.global_transform.affine_inverse() * (actuel["viseur"] as Node3D).global_transform
		v.basis = v.basis.orthonormalized()
		var cible := Transform3D(Basis.IDENTITY, Vector3(0, 0, -float(DISTANCE_VISEE.get(id_actuel, 0.25))))
		actuel["ads"] = cible * v.affine_inverse()
		actuel["ads_ok"] = true
	var lisse := func(k: float) -> float: return 1.0 - exp(-k * dt)
	var vise: bool = bool(e.get("vise", false)) and bool(actuel["ads_ok"])
	visee_k += ((1.0 if vise else 0.0) - visee_k) * lisse.call(14.0)
	sprint_k += ((1.0 if e.get("sprint", false) else 0.0) - sprint_k) * lisse.call(9.0)
	var vit: float = e.get("vitesse", 0.0)
	bob_k += ((minf(vit / 5.0, 1.0) if e.get("au_sol", true) else 0.0) - bob_k) * lisse.call(8.0)
	bob_t += dt * (6.0 + vit * 1.4)
	var souris: Vector2 = e.get("souris", Vector2.ZERO)
	balance += (-souris * 0.0009 - balance) * lisse.call(10.0)
	balance = balance.clamp(Vector2(-0.06, -0.05), Vector2(0.06, 0.05))
	if e.get("atterrissage", 0.0) > 0.0:
		ressort_y.impulsion(-float(e["atterrissage"]) * 1.4)
	var rz := ressort_z.maj(dt)
	var rx := ressort_rx.maj(dt)
	var rr := ressort_rz.maj(dt)
	var ry := ressort_y.maj(dt)
	var hors_visee := 1.0 - visee_k * 0.85
	var a := amplitude_bob * hors_visee
	var pos := Vector3(
		sin(bob_t) * 0.012 * bob_k * a + balance.x * hors_visee,
		-absf(cos(bob_t)) * 0.01 * bob_k * a + ry * 0.03 + balance.y * hors_visee,
		rz * 0.045)
	var rot := Vector3(rx * 0.012 + balance.y * 1.5 * hors_visee, balance.x * 2.0 * hors_visee + sin(bob_t * 0.5) * 0.01 * bob_k * a, rr * 0.01 + balance.x * 1.2 * hors_visee)
	# Course : arme baissée et tournée
	pos += Vector3(0.015, -0.025, 0.01) * sprint_k
	rot += Vector3(-0.16, 0.36, 0.14) * sprint_k
	pos += (DECALAGE_HANCHE.get(id_actuel, Vector3.ZERO) as Vector3) * (1.0 - visee_k)
	var proc := Transform3D(Basis.from_euler(rot), pos)
	var ads: Transform3D = actuel["ads"] if actuel["ads_ok"] else Transform3D.IDENTITY
	pivot.transform = proc * Transform3D.IDENTITY.interpolate_with(ads, visee_k)
	var zoom: float = DonneesArmes.arme(id_actuel).get("zoom", 1.0)
	cam.fov = FOV / lerpf(1.0, minf(zoom, 1.5), visee_k * 0.6)
	# Flash
	if flash_t > 0.0:
		flash_t -= dt
		lumiere_flash.light_energy *= exp(-40.0 * dt)
		if flash_t <= 0.0:
			flash.visible = false
			lumiere_flash.light_energy = 0.0
	_sons_animation()
	_maj_douilles(dt)
	# Écran de munitions
	if actuel["ecran"] != null:
		var l: Label3D = actuel["ecran"]
		var m := int(e.get("mun", 0))
		var txt := "--" if e.get("recharge", false) else str(m)
		if l.text != txt:
			l.text = txt
			l.modulate = Color(1.0, 0.35, 0.35) if m <= 5 else Color(0.45, 1.0, 1.0)


func _sons_animation() -> void:
	var ap: AnimationPlayer = actuel["ap"]
	var nom := String(ap.current_animation)
	if nom == "" or not SONS_ANIM.has(nom):
		anim_nom_avant = nom
		return
	var u := ap.current_animation_position / maxf(ap.current_animation_length, 0.001)
	if nom != anim_nom_avant or u < anim_avant - 0.01:
		anim_avant = -0.001
	var table: Dictionary = SONS_ANIM[nom]
	var liste: Array = table.get(id_actuel, table.get("*", [])) if not (id_actuel == "couteau" and not table.has("couteau")) else []
	for e in liste:
		if anim_avant < float(e[0]) and u >= float(e[0]):
			Sons.jouer(String(e[1]), -6.0, randf_range(0.96, 1.04))
	anim_avant = u
	anim_nom_avant = nom


## Position du canon à l'écran -> point de départ des traçantes dans le monde
func position_bouche_ecran() -> Vector2:
	if actuel.get("bouche") == null:
		return get_viewport_rect().size * Vector2(0.62, 0.72)
	return cam.unproject_position((actuel["bouche"] as Node3D).global_position)
