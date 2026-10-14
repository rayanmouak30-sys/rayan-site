class_name Vitrine3D
extends SubViewportContainer
## Présentation 3D d'un héros : socle lumineux, éclairage de studio aux couleurs de sa catégorie, animation de
## pose (vitrine_<pose>), rotation à la souris, apparition avec un éclat et geste quand on le choisit.

var vp: SubViewport
var cam: Camera3D
var socle: Node3D
var anneau_mat: StandardMaterial3D
var lumiere_cat: SpotLight3D
var lumiere_contre: OmniLight3D
var perso: Perso3D
var id_heros := ""
var angle := 0.0
var angle_cible := 0.0
var glisse := false
var auto_rotation := true
var eclat: MeshInstance3D
var eclat_mat: StandardMaterial3D
var particules: GPUParticles3D


func _ready() -> void:
	stretch = true
	mouse_filter = Control.MOUSE_FILTER_PASS
	vp = SubViewport.new()
	vp.own_world_3d = true
	vp.transparent_bg = true
	vp.msaa_3d = Viewport.MSAA_4X
	add_child(vp)
	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_CLEAR_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.5, 0.55, 0.68)
	env.ambient_light_energy = 0.55
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.glow_enabled = true
	env.glow_intensity = 0.6
	env.glow_bloom = 0.05
	env.ssao_enabled = Reglages.qualite() != "bas"
	we.environment = env
	vp.add_child(we)
	var cle := DirectionalLight3D.new()
	cle.rotation_degrees = Vector3(-30, 160, 0)
	cle.light_energy = 1.5
	cle.shadow_enabled = true
	vp.add_child(cle)
	var rempl := DirectionalLight3D.new()
	rempl.rotation_degrees = Vector3(-12, -40, 0)
	rempl.light_energy = 0.55
	rempl.light_color = Color(0.75, 0.85, 1.0)
	vp.add_child(rempl)
	lumiere_cat = SpotLight3D.new()
	lumiere_cat.position = Vector3(0, 3.2, 1.6)
	lumiere_cat.rotation_degrees = Vector3(-60, 0, 0)
	lumiere_cat.spot_angle = 35
	lumiere_cat.light_energy = 6.0
	lumiere_cat.spot_range = 6.0
	vp.add_child(lumiere_cat)
	lumiere_contre = OmniLight3D.new()
	lumiere_contre.position = Vector3(0, 1.6, 1.4)
	lumiere_contre.light_energy = 2.0
	lumiere_contre.omni_range = 3.5
	vp.add_child(lumiere_contre)
	cam = Camera3D.new()
	cam.fov = 30
	cam.position = Vector3(0, 1.12, -5.0)
	vp.add_child(cam)
	cam.look_at(Vector3(0, 1.0, 0))
	_creer_socle()


func _creer_socle() -> void:
	socle = Node3D.new()
	vp.add_child(socle)
	var disque := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.85
	cm.bottom_radius = 0.95
	cm.height = 0.12
	cm.radial_segments = 64
	disque.mesh = cm
	var md := StandardMaterial3D.new()
	md.albedo_color = Color(0.12, 0.13, 0.17)
	md.metallic = 0.7
	md.roughness = 0.3
	disque.material_override = md
	disque.position.y = -0.06
	socle.add_child(disque)
	var anneau := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.86
	tm.outer_radius = 0.9
	tm.rings = 64
	anneau.mesh = tm
	anneau_mat = StandardMaterial3D.new()
	anneau_mat.emission_enabled = true
	anneau_mat.emission_energy_multiplier = 3.0
	anneau.material_override = anneau_mat
	anneau.position.y = 0.0
	socle.add_child(anneau)
	# Éclat d'apparition (colonne lumineuse)
	eclat = MeshInstance3D.new()
	var cy := CylinderMesh.new()
	cy.top_radius = 0.7
	cy.bottom_radius = 0.9
	cy.height = 4.0
	cy.cap_top = false
	cy.cap_bottom = false
	eclat.mesh = cy
	eclat_mat = StandardMaterial3D.new()
	eclat_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	eclat_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	eclat_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	eclat_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	eclat_mat.albedo_color = Color(1, 1, 1, 0)
	eclat.material_override = eclat_mat
	eclat.position.y = 2.0
	eclat.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	socle.add_child(eclat)
	particules = GPUParticles3D.new()
	particules.amount = 40
	particules.lifetime = 1.6
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_RING
	pm.emission_ring_radius = 0.85
	pm.emission_ring_inner_radius = 0.8
	pm.emission_ring_height = 0.02
	pm.emission_ring_axis = Vector3.UP
	pm.direction = Vector3.UP
	pm.spread = 5
	pm.initial_velocity_min = 0.3
	pm.initial_velocity_max = 0.9
	pm.gravity = Vector3.ZERO
	var g := Gradient.new()
	g.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0)])
	var gt := GradientTexture1D.new()
	gt.gradient = g
	pm.color_ramp = gt
	particules.process_material = pm
	var q := QuadMesh.new()
	q.size = Vector2(0.05, 0.05)
	var mq := StandardMaterial3D.new()
	mq.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mq.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mq.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mq.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	mq.vertex_color_use_as_albedo = true
	mq.albedo_texture = Textures.point_lumineux()
	q.material = mq
	particules.draw_pass_1 = q
	socle.add_child(particules)


## Affiche un héros (avec son skin) ; transition lumineuse
func montrer(id: String, id_skin := "standard") -> void:
	if id == id_heros and perso and perso.skin == id_skin:
		return
	var nouveau := id != id_heros
	id_heros = id
	var h := DonneesHeros.heros(id)
	var couleur := DonneesHeros.couleur_categorie(id)
	anneau_mat.albedo_color = couleur
	anneau_mat.emission = couleur
	lumiere_cat.light_color = couleur
	lumiere_contre.light_color = couleur
	((particules.draw_pass_1 as QuadMesh).material as StandardMaterial3D).albedo_color = couleur * 1.5
	if perso:
		perso.queue_free()
	perso = Perso3D.new()
	vp.add_child(perso)
	perso.arme_id = String(h.get("arme", "fusil"))
	perso.charger(id, id_skin, "")
	var pose := String(h.get("pose", "garde"))
	var anim := "%s_vitrine_%s" % [perso.arme_id, pose]
	if perso.ap.has_animation(anim):
		perso.ap.play(anim)
	else:
		perso.ap.play(perso.arme_id + "_repos")
	if nouveau:
		angle = 0.6
		angle_cible = 0.0
		var t: float = perso.scale.x
		perso.scale = Vector3.ONE * t * 0.92
		var tw := create_tween().set_parallel(true)
		tw.tween_property(perso, "scale", Vector3.ONE * t, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		eclat_mat.albedo_color = Color(couleur.r, couleur.g, couleur.b, 0.55)
		tw.tween_property(eclat_mat, "albedo_color:a", 0.0, 0.5)
		Sons.jouer("ui_survol", -6.0)


## Geste quand le héros est choisi (animation "selection_<pose>")
func selectionner() -> void:
	if perso == null:
		return
	var h := DonneesHeros.heros(id_heros)
	var pose := String(h.get("pose", "garde"))
	var anim := "%s_selection_%s" % [perso.arme_id, pose]
	if perso.ap.has_animation(anim):
		perso.ap.play(anim, 0.15)
		perso.ap.queue("%s_vitrine_%s" % [perso.arme_id, pose])
	var couleur := anneau_mat.emission
	eclat_mat.albedo_color = Color(couleur.r, couleur.g, couleur.b, 0.9)
	var tw := create_tween()
	tw.tween_property(eclat_mat, "albedo_color:a", 0.0, 0.8)
	anneau_mat.emission_energy_multiplier = 9.0
	var tw2 := create_tween()
	tw2.tween_property(anneau_mat, "emission_energy_multiplier", 3.0, 0.8)
	angle_cible = 0.0


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and (event as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT:
		glisse = (event as InputEventMouseButton).pressed
		auto_rotation = false
	elif event is InputEventMouseMotion and glisse:
		angle_cible += (event as InputEventMouseMotion).relative.x * 0.01


func _process(dt: float) -> void:
	if auto_rotation:
		angle_cible = sin(Time.get_ticks_msec() / 1000.0 * 0.4) * 0.35
	angle = lerp_angle(angle, angle_cible, 1.0 - exp(-8.0 * dt))
	socle.rotation.y = angle
	if perso:
		perso.rotation.y = angle
