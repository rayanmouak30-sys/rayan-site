extends Node
## Rend le portrait de chaque héros (tête et épaules, fond transparent, 256 px) dans --sortie.


func executer() -> void:
	await Test.vider_scene()
	var vp := SubViewport.new()
	vp.size = Vector2i(256, 256)
	vp.transparent_bg = true
	vp.own_world_3d = true
	vp.msaa_3d = Viewport.MSAA_4X
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	get_tree().root.add_child(vp)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_CLEAR_COLOR
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.6, 0.65, 0.75)
	e.ambient_light_energy = 0.7
	e.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.environment = e
	vp.add_child(env)
	var l := DirectionalLight3D.new()
	l.rotation_degrees = Vector3(-25, 155, 0)
	l.light_energy = 1.7
	vp.add_child(l)
	var l2 := DirectionalLight3D.new()
	l2.rotation_degrees = Vector3(-10, -30, 0)
	l2.light_energy = 1.0
	l2.light_color = Color(0.7, 0.85, 1.0)
	vp.add_child(l2)
	var cam := Camera3D.new()
	cam.fov = 24
	vp.add_child(cam)
	for id in DonneesHeros.liste():
		var p := Perso3D.new()
		vp.add_child(p)
		p.arme_id = ""
		p.charger(id, "standard", "")
		p.ap.play("fusil_repos")
		p.ap.seek(0.5, true)
		var t: float = p.scale.x
		var tete := Vector3(0, 1.58 * t, 0)
		cam.position = tete + Vector3(0.25, 0.04, -1.25)
		cam.look_at(tete + Vector3(0, -0.04, 0))
		await Test.attendre_images(4)
		await RenderingServer.frame_post_draw
		var img := vp.get_texture().get_image()
		img.save_png(Test.sortie.path_join(id + ".png"))
		print("portrait ", id)
		p.queue_free()
		await Test.attendre_images(1)
