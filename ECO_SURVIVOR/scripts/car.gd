class_name Car
extends Area2D
## VOITURE POLLUANTE : obstacle mobile qui suit une voie (Path2D) puis disparaît.

signal hit_player(car: Car)

const TEXTURES := [
	preload("res://assets/sprites/cars/car_red.png"),
	preload("res://assets/sprites/cars/car_orange.png"),
	preload("res://assets/sprites/cars/car_grey.png"),
	preload("res://assets/sprites/cars/car_purple.png"),
]
const TRUCK := preload("res://assets/sprites/cars/truck.png")

var direction := Vector2.RIGHT
var speed := 160.0
var _end := Vector2.ZERO
var _honked := false

@onready var sprite: Sprite2D = $Sprite
@onready var shadow: Sprite2D = $Shadow
@onready var shape_node: CollisionShape2D = $CollisionShape2D


func setup(from: Vector2, to: Vector2, spd: float, truck := false) -> void:
	position = from
	_end = to
	direction = (to - from).normalized()
	rotation = direction.angle()
	speed = spd * (0.75 if truck else 1.0)
	set_meta("truck", truck)


func _ready() -> void:
	var truck: bool = get_meta("truck", false)
	sprite.texture = TRUCK if truck else TEXTURES.pick_random()
	var rect := RectangleShape2D.new()
	rect.size = Vector2(128, 48) if truck else Vector2(90, 40)
	shape_node.shape = rect
	shadow.position = Vector2(5, 8).rotated(-rotation)
	body_entered.connect(_on_body_entered)


func _physics_process(delta: float) -> void:
	position += direction * speed * delta
	if (_end - position).dot(direction) < 0.0:
		queue_free()
	# klaxonne quand le joueur est juste devant
	if not _honked:
		var player := get_tree().get_first_node_in_group("player") as Node2D
		if player:
			var to_player := player.global_position - global_position
			if to_player.length() < 200.0 and to_player.normalized().dot(direction) > 0.85:
				_honked = true
				AudioManager.play_sfx("horn", randf_range(0.9, 1.1), -6.0)


func _on_body_entered(body: Node2D) -> void:
	if body is Player:
		hit_player.emit(self)
