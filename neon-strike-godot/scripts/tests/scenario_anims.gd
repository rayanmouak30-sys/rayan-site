extends Node
## Animations des personnages : --heros=kael --arme=fusil --anims=repos,course_av,...  (captures à plusieurs instants)


func executer() -> void:
	await Test.vider_scene()
	var id: String = Test.arguments.get("heros", "kael")
	var arme: String = Test.arguments.get("arme", "fusil")
	var anims: Array = Array(String(Test.arguments.get("anims", "repos,course_av,course_d,sprint,accroupi_av,tir,rechargement,saut,atterrissage")).split(",", false))
	var monde := Node3D.new()
	get_tree().root.add_child(monde)
	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.16, 0.18, 0.22)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.55, 0.6, 0.7)
	env.ambient_light_energy = 0.6
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	we.environment = env
	monde.add_child(we)
	var l := DirectionalLight3D.new()
	l.rotation_degrees = Vector3(-35, 150, 0)
	l.light_energy = 1.6
	l.shadow_enabled = true
	monde.add_child(l)
	var sol := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(20, 20)
	sol.mesh = pm
	monde.add_child(sol)
	var p := Perso3D.new()
	monde.add_child(p)
	p.arme_id = arme
	p.charger(id, Test.arguments.get("skin", "standard"), "bleu")
	var cam := Camera3D.new()
	cam.fov = 35
	monde.add_child(cam)
	var vues := {"face": Vector3(0.0, 1.1, -3.6), "cote": Vector3(3.6, 1.1, -0.6), "trois": Vector3(2.4, 1.3, -2.8)}
	var vue: String = Test.arguments.get("vue", "trois")
	cam.position = vues[vue]
	cam.look_at(Vector3(0, 0.95, 0))
	for nom in anims:
		var complet := String(nom) if p.ap.has_animation(String(nom)) else arme + "_" + String(nom)
		if not p.ap.has_animation(complet):
			print("ANIM ABSENTE ", complet)
			continue
		var duree := p.ap.get_animation(complet).length
		p.ap.play(complet, 0.0)
		for k in [0.0, 0.33, 0.66]:
			p.ap.seek(duree * k, true)
			await Test.attendre_images(2)
			await Test.capture("anim_%s_%s_%d" % [id, complet, int(k * 100)])
