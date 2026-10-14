extends Node
## Affiche une vue FPS d'arme (assets/armes/vm_<id>.glb) et capture plusieurs instants des animations.

func executer() -> void:
	var id: String = Test.arguments.get("arme", "pulsar")
	await Test.vider_scene()
	var monde := Node3D.new()
	get_tree().root.add_child(monde)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_SKY
	var ciel := Sky.new()
	ciel.sky_material = ProceduralSkyMaterial.new()
	e.sky = ciel
	e.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	e.tonemap_mode = Environment.TONE_MAPPER_AGX
	e.ssao_enabled = true
	env.environment = e
	monde.add_child(env)
	var soleil := DirectionalLight3D.new()
	soleil.rotation_degrees = Vector3(-50, -35, 0)
	soleil.light_energy = 1.2
	soleil.shadow_enabled = true
	monde.add_child(soleil)
	var sol := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(20, 20)
	sol.mesh = pm
	sol.position = Vector3(0, -1.6, 0)
	monde.add_child(sol)
	var mur := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(8, 4, 0.3)
	mur.mesh = bm
	mur.position = Vector3(0, 0, -5)
	monde.add_child(mur)
	var cam := Camera3D.new()
	cam.fov = 68
	cam.near = 0.01
	monde.add_child(cam)
	cam.make_current()
	var vm: Node3D = load("res://assets/armes/vm_%s.glb" % id).instantiate()
	cam.add_child(vm)
	var ap: AnimationPlayer = vm.find_child("AnimationPlayer", true, false)
	Test.mesure("animations", ap.get_animation_list() if ap else "aucune")
	var instants := [["repos", 0.5], ["tir", 0.05], ["rechargement", 0.35], ["rechargement", 0.55], ["rechargement_vide", 0.82], ["inspection", 0.4], ["inspection", 0.75], ["sortie", 0.45]]
	if id == "couteau":
		instants = [["repos", 0.5], ["tir", 0.4], ["tir_lourd", 0.45], ["inspection", 0.4], ["inspection", 0.6], ["sortie", 0.5]]
	if id in ["pompe", "sniper"]:
		instants.append(["tir", 0.45])
	var exterieur := Camera3D.new()
	exterieur.fov = 50
	monde.add_child(exterieur)
	exterieur.position = Vector3(1.0, 0.25, 0.35)
	exterieur.look_at_from_position(exterieur.position, Vector3(0.05, -0.2, -0.32))
	for inst in instants:
		var nom: String = inst[0]
		if ap == null or not ap.has_animation(nom):
			continue
		ap.play(nom)
		var duree := ap.get_animation(nom).length
		ap.seek(duree * float(inst[1]), true)
		ap.pause()
		cam.make_current()
		await Test.attendre_images(3)
		await Test.capture("vm_%s_%s_%d" % [id, nom, int(float(inst[1]) * 100)])
	ap.play("repos")
	ap.seek(0.5, true)
	ap.pause()
	exterieur.make_current()
	await Test.attendre_images(3)
	await Test.capture("vm_%s_exterieur" % id)
	exterieur.position = Vector3(-0.9, -0.3, 0.2)
	exterieur.look_at_from_position(exterieur.position, Vector3(0.05, -0.2, -0.32))
	await Test.attendre_images(3)
	await Test.capture("vm_%s_exterieur2" % id)
	# Gros plans des mains
	exterieur.fov = 30
	exterieur.look_at_from_position(Vector3(0.45, -0.2, -0.05), Vector3(0.18, -0.27, -0.3))
	await Test.attendre_images(3)
	await Test.capture("vm_%s_main_droite" % id)
	exterieur.look_at_from_position(Vector3(-0.45, -0.35, -0.4), Vector3(0.12, -0.3, -0.62))
	await Test.attendre_images(3)
	await Test.capture("vm_%s_main_gauche" % id)
