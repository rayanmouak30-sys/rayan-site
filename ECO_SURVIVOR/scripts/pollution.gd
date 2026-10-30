class_name PollutionZone
extends Area2D
## ZONE DE POLLUTION : nuage toxique qui fait perdre de la vie au joueur.
## 1) alerte (cercle rouge, sans danger)  2) actif (dégâts + dérive)  3) disparition.

enum State { WARNING, ACTIVE, FADING }

@export var radius := 90.0
@export var damage_per_second := 20.0
@export var lifetime := 14.0
@export var warning_time := 1.6

var drift := Vector2.ZERO
var state := State.WARNING
var map_rect := Rect2(0, 0, 2560, 1600)
var _t := 0.0

@onready var shape_node: CollisionShape2D = $CollisionShape2D
@onready var fog: ColorRect = $Fog
@onready var particles: CPUParticles2D = $Particles


func setup(r: float, dps: float, life: float, velocity: Vector2) -> void:
	radius = r
	damage_per_second = dps
	lifetime = life
	drift = velocity


func _ready() -> void:
	var circle := CircleShape2D.new()
	circle.radius = radius * 0.85
	shape_node.shape = circle
	fog.size = Vector2.ONE * radius * 2.0
	fog.position = -fog.size / 2.0
	var mat := (fog.material as ShaderMaterial).duplicate() as ShaderMaterial
	mat.set_shader_parameter("seed", randf() * 10.0)
	fog.material = mat
	particles.emission_sphere_radius = radius * 0.7
	particles.emitting = false
	_set_look(0.15, 1.0)


func _set_look(intensity: float, warning: float) -> void:
	var mat := fog.material as ShaderMaterial
	mat.set_shader_parameter("intensity", intensity)
	mat.set_shader_parameter("warning", warning)


func is_active() -> bool:
	return state == State.ACTIVE


func _physics_process(delta: float) -> void:
	_t += delta
	match state:
		State.WARNING:
			if _t >= warning_time:
				state = State.ACTIVE
				_t = 0.0
				particles.emitting = true
				create_tween().tween_method(func(v): _set_look(v, 1.0 - v), 0.15, 1.0, 0.6)
		State.ACTIVE:
			position += drift * delta
			if position.x < map_rect.position.x + radius or position.x > map_rect.end.x - radius:
				drift.x = -drift.x
			if position.y < map_rect.position.y + radius or position.y > map_rect.end.y - radius:
				drift.y = -drift.y
			for body in get_overlapping_bodies():
				if body is Player:
					body.pollution_damage(damage_per_second * delta)
			if _t >= lifetime:
				state = State.FADING
				particles.emitting = false
				var tw := create_tween()
				tw.tween_method(func(v): _set_look(v, 0.0), 1.0, 0.0, 1.0)
				tw.tween_callback(queue_free)
