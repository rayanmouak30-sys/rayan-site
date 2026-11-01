class_name Collectible
extends Area2D
## OBJET À RAMASSER (déchet recyclable ou bonus).
## Prévient le GameManager avec le signal "collected" quand le joueur le touche.

signal collected(item: Collectible)

enum Type { PLASTIQUE, PAPIER, VERRE, ELECTRONIQUE, SOIN, ENERGIE }

const INFO := {
	Type.PLASTIQUE: {"name": "Plastique", "points": 10, "life": 14.0, "color": Color("4fc3ff"),
		"texture": preload("res://assets/sprites/items/plastic.png")},
	Type.PAPIER: {"name": "Papier", "points": 15, "life": 14.0, "color": Color("ffd84a"),
		"texture": preload("res://assets/sprites/items/paper.png")},
	Type.VERRE: {"name": "Verre", "points": 20, "life": 12.0, "color": Color("4dff9a"),
		"texture": preload("res://assets/sprites/items/glass.png")},
	Type.ELECTRONIQUE: {"name": "Électronique", "points": 30, "life": 9.0, "color": Color("c27bff"),
		"texture": preload("res://assets/sprites/items/ewaste.png")},
	Type.SOIN: {"name": "Soin", "points": 0, "life": 10.0, "color": Color("ff6b8b"),
		"texture": preload("res://assets/sprites/items/bonus_health.png")},
	Type.ENERGIE: {"name": "Énergie", "points": 0, "life": 10.0, "color": Color("b6ff4d"),
		"texture": preload("res://assets/sprites/items/bonus_energy.png")},
}

@export var type: Type = Type.PLASTIQUE

var age := 0.0
var lifetime := 14.0
var picked := false
var _phase := 0.0

@onready var sprite: Sprite2D = $Sprite
@onready var glow: Sprite2D = $Glow
@onready var shadow: Sprite2D = $Shadow


func _ready() -> void:
	var info: Dictionary = INFO[type]
	sprite.texture = info.texture
	glow.modulate = Color(info.color, 0.6)
	lifetime = info.life
	_phase = randf() * TAU
	body_entered.connect(_on_body_entered)
	# animation d'apparition
	scale = Vector2.ZERO
	create_tween().tween_property(self, "scale", Vector2.ONE, 0.45).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


func is_waste() -> bool:
	return type <= Type.ELECTRONIQUE


func get_points() -> int:
	return INFO[type].points


func get_color() -> Color:
	return INFO[type].color


func _process(delta: float) -> void:
	if picked:
		return
	age += delta
	# flottement + pulsation du halo
	sprite.position.y = -8.0 + sin(age * 3.0 + _phase) * 4.0
	sprite.rotation = sin(age * 2.0 + _phase) * 0.15
	glow.scale = Vector2.ONE * (0.6 + 0.08 * sin(age * 4.0 + _phase))
	shadow.scale = Vector2(0.3, 0.3) * (1.0 - 0.1 * sin(age * 3.0 + _phase))
	# clignote pendant les 3 dernières secondes
	if lifetime - age < 3.0:
		modulate.a = 0.4 + 0.6 * (0.5 + 0.5 * sin(age * 18.0))
	if age >= lifetime:
		_disappear()


func _on_body_entered(body: Node2D) -> void:
	if not picked and body is Player and not body.is_dead:
		collected.emit(self)


## Appelé par le GameManager quand l'objet est ramassé.
func pick_up() -> void:
	picked = true
	set_deferred("monitoring", false)
	modulate.a = 1.0
	var tw := create_tween().set_parallel()
	tw.tween_property(self, "scale", Vector2(1.8, 1.8), 0.2)
	tw.tween_property(self, "modulate:a", 0.0, 0.2)
	tw.chain().tween_callback(queue_free)


func _disappear() -> void:
	picked = true
	set_deferred("monitoring", false)
	var tw := create_tween()
	tw.tween_property(self, "scale", Vector2.ZERO, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_IN)
	tw.tween_callback(queue_free)
