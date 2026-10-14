extends Node
## Vitrine des personnages : --ids=kael,vexa (par défaut tous). Vues de face, trois quarts, dos et gros plan du visage.

var monde: Node3D
var cam: Camera3D


func executer() -> void:
	await Test.vider_scene()
	var ids: Array = Array(String(Test.arguments.get("ids", "")).split(",", false))
	if ids.is_empty():
		ids = DonneesHeros.liste()
	var skin: String = Test.arguments.get("skin", "standard")
	monde = Node3D.new()
	get_tree().root.add_child(monde)
	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.16, 0.18, 0.22)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.55, 0.6, 0.7)
	env.ambient_light_energy = 0.6
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.ssao_enabled = true
	we.environment = env
	monde.add_child(we)
	var l := DirectionalLight3D.new()
	l.rotation_degrees = Vector3(-35, 30, 0)
	l.light_energy = 1.6
	l.shadow_enabled = true
	monde.add_child(l)
	var l2 := DirectionalLight3D.new()
	l2.rotation_degrees = Vector3(-15, 200, 0)
	l2.light_energy = 0.7
	l2.light_color = Color(0.7, 0.8, 1.0)
	monde.add_child(l2)
	var sol := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(60, 20)
	sol.mesh = pm
	var ms := StandardMaterial3D.new()
	ms.albedo_color = Color(0.3, 0.32, 0.36)
	sol.material_override = ms
	monde.add_child(sol)
	cam = Camera3D.new()
	cam.fov = 30
	monde.add_child(cam)
	var noeuds := []
	var ecart := 1.1
	for i in ids.size():
		var id: String = ids[i]
		var chemin := "res://assets/persos/%s.glb" % id
		if not ResourceLoader.exists(chemin):
			continue
		var n: Node3D = load(chemin).instantiate()
		var h := DonneesHeros.heros(id)
		var t: float = h["apparence"].get("taille", 1.0)
		n.scale = Vector3.ONE * t
		n.position = Vector3((i - (ids.size() - 1) / 2.0) * ecart, 0, 0)
		monde.add_child(n)
		Skins.appliquer_heros(n, id, skin, "bleu")
		noeuds.append(n)
	var largeur := ids.size() * ecart
	var groupe := int(Test.arguments.get("groupe", "5"))
	# Vues par groupes de 5 personnages
	for g in range(0, noeuds.size(), groupe):
		var dernier := mini(g + groupe, noeuds.size()) - 1
		var cx := ((noeuds[g] as Node3D).position.x + (noeuds[dernier] as Node3D).position.x) / 2.0
		var dist := 4.2 + (dernier - g) * 1.25
		for vue in [["face", 0.0], ["troisquarts", 35.0], ["dos", 180.0]]:
			var a := deg_to_rad(float(vue[1]))
			cam.position = Vector3(cx + sin(a) * dist, 1.05, -cos(a) * dist)
			cam.look_at(Vector3(cx, 0.95, 0))
			await Test.attendre_images(3)
			await Test.capture("persos_%d_%s_%s" % [g / groupe, vue[0], skin])
	# Gros plans des visages
	for n in noeuds:
		var p: Vector3 = (n as Node3D).position
		var t: float = (n as Node3D).scale.x
		cam.fov = 22
		cam.position = p + Vector3(0.22, 1.66 * t, -0.75)
		cam.look_at(p + Vector3(0, 1.62 * t, 0))
		await Test.attendre_images(2)
		await Test.capture("visage_%s" % ids[noeuds.find(n)])
