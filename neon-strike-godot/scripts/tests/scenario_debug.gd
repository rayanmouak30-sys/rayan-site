extends Node


func executer() -> void:
	Jeu.config["mode"] = "stand"
	get_tree().change_scene_to_file("res://scenes/partie.tscn")
	await Test.attendre(1.0)
	var v: VueArme = Jeu.partie.vue
	var ap: AnimationPlayer = v.actuel["ap"]
	var sk: Skeleton3D = v.actuel["racine"].find_child("*", true, false) as Skeleton3D
	sk = v.actuel["racine"].find_children("*", "Skeleton3D", true, false)[0]
	var b: Node3D = v.actuel["bouche"]
	for i in 12:
		var id := sk.find_bone("arme")
		print("t=%.2f anim=%s pos=%.2f/%.2f loop=%d boucheY=%.3f osY=%.3f" % [Time.get_ticks_msec() / 1000.0, ap.current_animation, ap.current_animation_position, ap.current_animation_length, ap.get_animation(ap.current_animation).loop_mode if ap.current_animation != "" else -1, (v.cam.global_transform.affine_inverse() * b.global_position).y, (sk.get_bone_global_pose(id).origin).y])
		await Test.attendre(0.4)
