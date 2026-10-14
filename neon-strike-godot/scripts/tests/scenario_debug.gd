extends Node


func executer() -> void:
	await Test.vider_scene()
	var c = load("res://scripts/carte/carte_citadelle.gd").new()
	get_tree().root.add_child(c)
	await Test.attendre_images(2)
	for n in c.find_children("*", "MeshInstance3D", true, false):
		var p: Vector3 = n.global_position
		if p.distance_to(Vector3(-24, 3, -6)) < 9 and p.y > 2.0:
			print(n.get_parent().name, " ", p, " ", (n.mesh as BoxMesh).size if n.mesh is BoxMesh else "", " ", n.material_override.resource_name if n.material_override else "")
