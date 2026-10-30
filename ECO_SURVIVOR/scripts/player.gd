class_name Player
extends CharacterBody2D
## JOUEUR : déplacement fluide 8 directions, sprint (consomme de l'énergie),
## santé, invincibilité temporaire, recul, animations et tremblement de caméra.

signal health_changed(health: float, max_health: float)
signal energy_changed(energy: float, max_energy: float, exhausted: bool)
signal hurt(amount: float)
signal died

@export var speed := 250.0
@export var sprint_speed := 410.0
@export var acceleration := 1900.0
@export var friction := 2200.0
@export var max_health := 100.0
@export var max_energy := 100.0
@export var sprint_cost := 32.0      ## énergie consommée par seconde de sprint
@export var energy_regen := 14.0     ## énergie récupérée par seconde sans sprinter

var health := 100.0
var energy := 100.0
var exhausted := false               ## batterie vide : sprint bloqué jusqu'à 30 %
var controls_enabled := true
var damage_multiplier := 1.0
var is_dead := false
var _invincible := 0.0
var _knockback := Vector2.ZERO
var _shake := 0.0
var _last_pollution_hit := -10.0

@onready var body: Node2D = $Body
@onready var sprite: AnimatedSprite2D = $Body/Sprite
@onready var trail: CPUParticles2D = $Trail
@onready var camera: Camera2D = $Camera2D


func _ready() -> void:
	health = max_health
	energy = max_energy
	sprite.play("idle")


func _physics_process(delta: float) -> void:
	if is_dead:
		return
	var input := Vector2.ZERO
	if controls_enabled:
		input = Input.get_vector("move_left", "move_right", "move_up", "move_down")
	var moving := input.length() > 0.1
	var sprinting := controls_enabled and moving and Input.is_action_pressed("sprint") and not exhausted

	# --- gestion de la ressource énergie ---
	if sprinting:
		energy = maxf(energy - sprint_cost * delta, 0.0)
		if energy <= 0.0:
			exhausted = true
	else:
		energy = minf(energy + energy_regen * delta, max_energy)
		if exhausted and energy >= max_energy * 0.3:
			exhausted = false
	energy_changed.emit(energy, max_energy, exhausted)

	# --- déplacement avec accélération / freinage (fluide) ---
	var target_speed := sprint_speed if sprinting else speed
	if moving:
		velocity = velocity.move_toward(input * target_speed, acceleration * delta)
	else:
		velocity = velocity.move_toward(Vector2.ZERO, friction * delta)
	var saved := velocity
	velocity += _knockback
	move_and_slide()
	velocity = saved
	_knockback = _knockback.move_toward(Vector2.ZERO, 1400.0 * delta)

	# --- animation ---
	if velocity.length() > 20.0:
		body.rotation = lerp_angle(body.rotation, velocity.angle() + PI / 2.0, 14.0 * delta)
		sprite.play("walk")
		sprite.speed_scale = clampf(velocity.length() / speed, 0.6, 1.8)
	else:
		sprite.play("idle")
		sprite.speed_scale = 1.0
	trail.emitting = sprinting and velocity.length() > 200.0


func _process(delta: float) -> void:
	# clignotement pendant l'invincibilité
	if _invincible > 0.0:
		_invincible -= delta
		body.visible = fmod(_invincible, 0.16) > 0.08 or _invincible <= 0.0
	# tremblement de caméra
	if _shake > 0.0:
		_shake = maxf(_shake - 30.0 * delta, 0.0)
		camera.offset = Vector2(randf_range(-1, 1), randf_range(-1, 1)) * _shake
	else:
		camera.offset = Vector2.ZERO


## Inflige des dégâts. knock_from = position de la source (pour le recul).
## grant_iframes = donne une courte invincibilité (voitures, déchets toxiques).
func take_damage(amount: float, knock_from := Vector2.INF, grant_iframes := false) -> void:
	if is_dead or _invincible > 0.0:
		return
	health = maxf(health - amount * damage_multiplier, 0.0)
	health_changed.emit(health, max_health)
	if knock_from != Vector2.INF:
		_knockback = (global_position - knock_from).normalized() * 520.0
	if grant_iframes:
		_invincible = 0.9
		hurt.emit(amount)
		shake(9.0)
		var tw := create_tween()
		sprite.modulate = Color(1, 0.3, 0.3)
		tw.tween_property(sprite, "modulate", Color.WHITE, 0.3)
	if health <= 0.0:
		_die()


## Dégâts continus d'un nuage de pollution (appelé à chaque image).
func pollution_damage(amount: float) -> void:
	_last_pollution_hit = Time.get_ticks_msec() / 1000.0
	take_damage(amount)


func is_in_pollution() -> bool:
	return Time.get_ticks_msec() / 1000.0 - _last_pollution_hit < 0.15


func heal(amount: float) -> void:
	health = minf(health + amount, max_health)
	health_changed.emit(health, max_health)


func refill_energy() -> void:
	energy = max_energy
	exhausted = false


func is_invincible() -> bool:
	return _invincible > 0.0 or is_dead


func shake(strength: float) -> void:
	if Global.screen_shake:
		_shake = maxf(_shake, strength)


func _die() -> void:
	is_dead = true
	velocity = Vector2.ZERO
	trail.emitting = false
	body.visible = false
	shake(14.0)
	died.emit()


## Réapparition après la perte d'une vie.
func respawn(pos: Vector2) -> void:
	global_position = pos
	health = max_health
	energy = max_energy
	exhausted = false
	is_dead = false
	_knockback = Vector2.ZERO
	_invincible = 2.5
	body.visible = true
	health_changed.emit(health, max_health)
	camera.reset_smoothing()
