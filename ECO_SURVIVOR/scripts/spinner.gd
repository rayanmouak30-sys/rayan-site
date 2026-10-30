extends Sprite2D
## Fait tourner un sprite (rotor d'éolienne).

@export var speed := 2.5


func _process(delta: float) -> void:
	rotation += speed * delta
