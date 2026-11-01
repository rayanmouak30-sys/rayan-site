extends Area2D
# Zone de pollution : fait perdre de la vie au joueur tant qu'il est dedans.

var degats_par_seconde = 25
var temps_de_vie = 8.0
var t = 0.0
var direction = Vector2.ZERO


func _ready():
	# le nuage apparaît doucement
	modulate.a = 0
	create_tween().tween_property(self, "modulate:a", 1.0, 1.0)
	direction = Vector2(randf_range(-1, 1), randf_range(-1, 1)) * 30


func _physics_process(delta):
	t += delta
	position += direction * delta
	# pas de dégâts pendant l'apparition (le joueur a le temps de s'éloigner)
	if t > 1.0:
		for body in get_overlapping_bodies():
			if body.name == "Player":
				body.prendre_degats(degats_par_seconde * delta)
	if t > temps_de_vie:
		queue_free()
