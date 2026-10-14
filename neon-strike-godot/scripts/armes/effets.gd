class_name Effets
extends Node3D
## Effets visuels du monde : traçantes, étincelles, poussière, trous de balles, explosions.
## Tout est mis en réserve (pools) pour ne jamais créer de nœuds pendant les combats.

const MAX_TRACES := 48
const MAX_TROUS := 96
const MAX_GERBES := 24

var traces: Array[MeshInstance3D] = []
var traces_vie: Array[float] = []
var traces_dep: Array[Vector3] = []
var traces_arr: Array[Vector3] = []
var i_trace := 0

var trous: Array[Decal] = []
var i_trou := 0

var gerbes: Array[GPUParticles3D] = []      # étincelles
var poussieres: Array[GPUParticles3D] = []  # nuage de poussière / fumée
var i_gerbe := 0

var mat_trace: StandardMaterial3D


func _ready() -> void:
	name = "Effets"
	mat_trace = StandardMaterial3D.new()
	mat_trace.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat_trace.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat_trace.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mat_trace.vertex_color_use_as_albedo = true
	mat_trace.cull_mode = BaseMaterial3D.CULL_DISABLED
	mat_trace.albedo_texture = Textures.point_lumineux()
	var maillage := QuadMesh.new()
	maillage.size = Vector2(1, 1)
	for i in MAX_TRACES:
		var m := MeshInstance3D.new()
		m.mesh = maillage
		var mat := mat_trace.duplicate() as StandardMaterial3D
		m.material_override = mat
		m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		m.visible = false
		add_child(m)
		traces.append(m)
		traces_vie.append(0.0)
		traces_dep.append(Vector3.ZERO)
		traces_arr.append(Vector3.ZERO)
	for i in MAX_TROUS:
		var d := Decal.new()
		d.texture_albedo = Textures.trou_balle()
		d.size = Vector3(0.09, 0.08, 0.09)
		d.cull_mask = 1
		d.upper_fade = 0.1
		d.lower_fade = 0.1
		d.visible = false
		add_child(d)
		trous.append(d)
	for i in MAX_GERBES:
		gerbes.append(_creer_etincelles())
		poussieres.append(_creer_poussiere())


func _creer_etincelles() -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.one_shot = true
	p.emitting = false
	p.amount = 14
	p.lifetime = 0.45
	p.explosiveness = 0.95
	p.local_coords = false
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var pm := ParticleProcessMaterial.new()
	pm.direction = Vector3(0, 0, 1)
	pm.spread = 55.0
	pm.initial_velocity_min = 2.5
	pm.initial_velocity_max = 7.0
	pm.gravity = Vector3(0, -12, 0)
	pm.scale_min = 0.5
	pm.scale_max = 1.0
	pm.damping_min = 2.0
	pm.damping_max = 4.0
	var g := Gradient.new()
	g.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0)])
	var gt := GradientTexture1D.new()
	gt.gradient = g
	pm.color_ramp = gt
	p.process_material = pm
	var q := QuadMesh.new()
	q.size = Vector2(0.025, 0.11)
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mat.vertex_color_use_as_albedo = true
	mat.albedo_texture = Textures.point_lumineux()
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	mat.billboard_keep_scale = true
	q.material = mat
	p.draw_pass_1 = q
	p.transform_align = GPUParticles3D.TRANSFORM_ALIGN_Z_BILLBOARD_Y_TO_VELOCITY
	add_child(p)
	return p


func _creer_poussiere() -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.one_shot = true
	p.emitting = false
	p.amount = 6
	p.lifetime = 0.9
	p.explosiveness = 1.0
	p.local_coords = false
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var pm := ParticleProcessMaterial.new()
	pm.direction = Vector3(0, 0, 1)
	pm.spread = 30.0
	pm.initial_velocity_min = 0.4
	pm.initial_velocity_max = 1.6
	pm.gravity = Vector3(0, -0.6, 0)
	pm.damping_min = 1.5
	pm.damping_max = 2.5
	pm.scale_min = 0.6
	pm.scale_max = 1.2
	var c := Curve.new()
	c.add_point(Vector2(0, 0.4))
	c.add_point(Vector2(1, 1.6))
	var ct := CurveTexture.new()
	ct.curve = c
	pm.scale_curve = ct
	var g := Gradient.new()
	g.colors = PackedColorArray([Color(1, 1, 1, 0.55), Color(1, 1, 1, 0)])
	var gt := GradientTexture1D.new()
	gt.gradient = g
	pm.color_ramp = gt
	pm.angle_min = 0.0
	pm.angle_max = 360.0
	p.process_material = pm
	var q := QuadMesh.new()
	q.size = Vector2(0.28, 0.28)
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.vertex_color_use_as_albedo = true
	mat.albedo_texture = Textures.fumee()
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	q.material = mat
	p.draw_pass_1 = q
	add_child(p)
	return p


## Traçante : un trait lumineux qui file du canon au point d'impact
func trace(depart: Vector3, arrivee: Vector3, couleur: Color, epaisseur := 0.018) -> void:
	if not depart.is_finite() or not arrivee.is_finite() or depart.distance_to(arrivee) < 1.0:
		return
	var i := i_trace
	i_trace = (i_trace + 1) % MAX_TRACES
	traces_dep[i] = depart
	traces_arr[i] = arrivee
	traces_vie[i] = 0.0
	var m := traces[i]
	(m.material_override as StandardMaterial3D).albedo_color = Color(couleur.r * 1.6, couleur.g * 1.6, couleur.b * 1.6, 0.9)
	m.set_meta("epaisseur", epaisseur)
	m.visible = true
	_placer_trace(i)


func _placer_trace(i: int) -> void:
	var m := traces[i]
	var d := traces_dep[i]
	var a := traces_arr[i]
	var dist := d.distance_to(a)
	var vitesse := 320.0
	var t := traces_vie[i]
	var tete := minf(t * vitesse + 2.0, dist)
	var longueur := minf(6.0, tete)
	var dir := (a - d) / dist
	var centre := d + dir * (tete - longueur * 0.5)
	var cam := get_viewport().get_camera_3d()
	var vers_cam := (cam.global_position - centre).normalized() if cam else Vector3.UP
	var cote := dir.cross(vers_cam).normalized()
	if cote.length_squared() < 0.01:
		cote = Vector3.UP
	var normale := cote.cross(dir).normalized()
	var ep: float = m.get_meta("epaisseur", 0.018)
	m.global_transform = Transform3D(Basis(cote * ep, dir * longueur, normale), centre)
	if tete >= dist:
		traces_vie[i] = 99.0


func _process(dt: float) -> void:
	for i in MAX_TRACES:
		var m := traces[i]
		if not m.visible:
			continue
		if traces_vie[i] >= 99.0:
			m.visible = false
			continue
		traces_vie[i] += dt
		_placer_trace(i)


## Impact sur une surface : trou, étincelles, poussière, son selon la matière
func impact(pos: Vector3, normale: Vector3, matiere := "beton", couleur := Color(1.0, 0.75, 0.4), trou := true) -> void:
	var base := _base_normale(normale)
	if trou and matiere != "vitre_energie":
		var d := trous[i_trou]
		i_trou = (i_trou + 1) % MAX_TROUS
		d.visible = true
		d.global_transform = Transform3D(base, pos)
		d.rotate_object_local(Vector3.UP, randf() * TAU)
		var s := randf_range(0.8, 1.2)
		d.size = Vector3(0.085 * s, 0.1, 0.085 * s)
		d.modulate = Color(1, 1, 1, 0.95) if matiere != "metal" else Color(0.8, 0.82, 0.85, 0.9)
	var g := gerbes[i_gerbe]
	var p := poussieres[i_gerbe]
	i_gerbe = (i_gerbe + 1) % MAX_GERBES
	var tr := Transform3D(_base_vers(normale), pos + normale * 0.02)
	g.global_transform = tr
	var pm := g.process_material as ParticleProcessMaterial
	g.amount = 18 if matiere == "metal" else 8
	pm.initial_velocity_max = 8.0 if matiere == "metal" else 4.5
	(g.draw_pass_1.surface_get_material(0) as StandardMaterial3D).albedo_color = couleur * 2.2 if matiere == "metal" else couleur * 1.4
	g.restart()
	p.global_transform = tr
	var teinte := {"beton": Color(0.62, 0.6, 0.56), "metal": Color(0.4, 0.4, 0.42), "bois": Color(0.5, 0.38, 0.24), "terre": Color(0.45, 0.36, 0.26), "verre": Color(0.75, 0.85, 0.9), "vegetal": Color(0.3, 0.42, 0.22)}
	(p.draw_pass_1.surface_get_material(0) as StandardMaterial3D).albedo_color = teinte.get(matiere, Color(0.6, 0.6, 0.6))
	p.restart()
	if Sons.limite("impact_" + matiere, 0.03):
		Sons.jouer_3d("impact_" + matiere if Sons.existe("impact_" + matiere) else "impact_beton", pos, -6.0, randf_range(0.9, 1.1))


## Touche sur un combattant : étincelles d'armure ou éclat d'énergie (pas de sang)
func touche_combattant(pos: Vector3, normale: Vector3, tete: bool, bouclier: bool) -> void:
	var g := gerbes[i_gerbe]
	i_gerbe = (i_gerbe + 1) % MAX_GERBES
	g.global_transform = Transform3D(_base_vers(normale), pos)
	g.amount = 22 if tete else 12
	var c := Color(0.5, 0.9, 1.0) if bouclier else (Color(1.0, 0.9, 0.5) if tete else Color(1.0, 0.45, 0.35))
	(g.draw_pass_1.surface_get_material(0) as StandardMaterial3D).albedo_color = c * 2.0
	g.restart()


## Explosion : flash, gerbe, fumée, lumière brève, son, secousse
func explosion(pos: Vector3, rayon: float, couleur := Color(1.0, 0.6, 0.25)) -> void:
	for k in 3:
		var g := gerbes[i_gerbe]
		var p := poussieres[i_gerbe]
		i_gerbe = (i_gerbe + 1) % MAX_GERBES
		g.global_transform = Transform3D(_base_vers(Vector3.UP).rotated(Vector3.RIGHT, k * 2.1), pos)
		g.amount = 32
		(g.process_material as ParticleProcessMaterial).initial_velocity_max = 4.0 + rayon * 2.0
		(g.draw_pass_1.surface_get_material(0) as StandardMaterial3D).albedo_color = couleur * 2.5
		g.restart()
		p.global_transform = Transform3D(Basis.IDENTITY.scaled(Vector3.ONE * (1.0 + rayon * 0.4)), pos)
		(p.draw_pass_1.surface_get_material(0) as StandardMaterial3D).albedo_color = Color(0.25, 0.24, 0.23)
		p.restart()
	var l := OmniLight3D.new()
	l.light_color = couleur
	l.light_energy = 6.0
	l.omni_range = rayon * 2.5
	add_child(l)
	l.global_position = pos + Vector3.UP * 0.4
	var tw := create_tween()
	tw.tween_property(l, "light_energy", 0.0, 0.35)
	tw.tween_callback(l.queue_free)
	var boule := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.5
	sm.height = 1.0
	boule.mesh = sm
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mat.albedo_color = Color(couleur.r, couleur.g, couleur.b, 0.8)
	boule.material_override = mat
	boule.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(boule)
	boule.global_position = pos
	boule.scale = Vector3.ONE * 0.3
	var tb := create_tween().set_parallel(true)
	tb.tween_property(boule, "scale", Vector3.ONE * rayon * 1.6, 0.25).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_EXPO)
	tb.tween_property(mat, "albedo_color:a", 0.0, 0.3)
	tb.chain().tween_callback(boule.queue_free)
	Sons.jouer_3d("explosion", pos, 2.0, randf_range(0.92, 1.05))


func _base_vers(dir: Vector3) -> Basis:
	# Base dont l'axe Z pointe selon dir
	var z := dir.normalized()
	var x := Vector3.UP.cross(z)
	if x.length_squared() < 0.001:
		x = Vector3.RIGHT
	x = x.normalized()
	return Basis(x, z.cross(x), z)


func _base_normale(n: Vector3) -> Basis:
	# Base dont l'axe Y (projection du décalque) pointe selon la normale
	var y := n.normalized()
	var x := y.cross(Vector3.FORWARD)
	if x.length_squared() < 0.001:
		x = y.cross(Vector3.RIGHT)
	x = x.normalized()
	return Basis(x, y, x.cross(y))


## Efface les trous de balles (nouvelle manche)
func nettoyer() -> void:
	for d in trous:
		d.visible = false
