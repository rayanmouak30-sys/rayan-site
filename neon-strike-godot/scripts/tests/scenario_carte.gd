extends Node
## Vues de la carte : --carte=citadelle ; vue de dessus puis vues à hauteur d'homme.


func executer() -> void:
	await Test.vider_scene()
	var nom: String = Test.arguments.get("carte", "citadelle")
	var carte: Carte = load("res://scripts/carte/carte_%s.gd" % nom).new()
	get_tree().root.add_child(carte)
	var cam := Camera3D.new()
	cam.far = 500
	carte.add_child(cam)
	cam.current = true
	await Test.attendre_images(3)
	cam.position = Vector3(0, 150, 1)
	cam.fov = 50
	cam.look_at(Vector3(0, 0, 0))
	await Test.attendre_images(3)
	await Test.capture("carte_%s_dessus" % nom)
	var vues := [
		["spawn_attaque", Vector3(0, 1.7, 50), Vector3(0, 1.5, 20)],
		["milieu", Vector3(0, 1.7, 18), Vector3(0, 1.5, -10)],
		["site_a", Vector3(-24, 1.7, -8), Vector3(-34, 1.0, -30)],
		["a_principal", Vector3(-38, 1.7, 34), Vector3(-38, 1.5, 0)],
		["site_b", Vector3(36, 1.7, -4), Vector3(28, 1.0, -26)],
		["b_principal", Vector3(42, 1.7, 40), Vector3(40, 1.5, 0)],
		["hauteurs_a", Vector3(-40, 4.3, -36), Vector3(-26, 1.0, -18)],
		["haut_milieu", Vector3(0, 1.7, -40), Vector3(0, 1.5, -14)],
	]
	cam.fov = 75
	for v in vues:
		cam.position = v[1]
		cam.look_at(v[2])
		await Test.attendre_images(3)
		await Test.capture("carte_%s_%s" % [nom, v[0]])
	await Test.attendre(1.0)
	var nm: NavigationMesh = carte.navigation.navigation_mesh
	Test.mesure("navmesh_polygones", nm.get_polygon_count())
