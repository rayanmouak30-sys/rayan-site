class_name ToxicWaste
extends Area2D
## DÉCHET TOXIQUE : à éviter ! Le toucher retire des points et de la vie.

signal touched(toxic: ToxicWaste)

@export var lifetime := 18.0
var age := 0.0
var _done := false

@onready var sprite: Sprite2D = $Sprite
@onready var glow: Sprite2D = $Glow


func _ready() -> void:
	body_entered.connect(_on_body_entered)
	# chute depuis le ciel
	sprite.position.y = -60.0
	modulate.a = 0.0
	var tw := create_tween().set_parallel()
	tw.tween_property(sprite, "position:y", -6.0, 0.5).set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)
	tw.tween_property(self, "modulate:a", 1.0, 0.3)


func _process(delta: float) -> void:
	if _done:
		return
	age += delta
	glow.modulate.a = 0.45 + 0.25 * sin(age * 5.0)
	if lifetime - age < 3.0:
		sprite.visible = fmod(age, 0.25) < 0.17
	if age >= lifetime:
		_done = true
		var tw := create_tween()
		tw.tween_property(self, "modulate:a", 0.0, 0.3)
		tw.tween_callback(queue_free)


func _on_body_entered(body: Node2D) -> void:
	if not _done and body is Player and not body.is_dead:
		touched.emit(self)


func explode() -> void:
	_done = true
	set_deferred("monitoring", false)
	Effects.burst(get_parent(), global_position, Color("7dff3a"), 30, 260.0)
	Effects.burst(get_parent(), global_position, Color(0.3, 0.35, 0.1, 0.8), 10, 90.0, Effects.SMOKE, 1.0, 1.2)
	queue_free()
