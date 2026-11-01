class_name Effects
extends RefCounted
## Effets visuels réutilisables : explosions de particules et textes flottants.

const SPARK := preload("res://assets/sprites/fx/spark.png")
const SMOKE := preload("res://assets/sprites/fx/smoke.png")
const LEAF := preload("res://assets/sprites/fx/leaf.png")
const FLOATING_TEXT := preload("res://scenes/FloatingText.tscn")


## Gerbe de particules (one shot) qui se supprime toute seule.
static func burst(parent: Node, pos: Vector2, color: Color, amount := 18, speed := 220.0,
		texture: Texture2D = null, lifetime := 0.6, size := 0.6) -> void:
	var p := CPUParticles2D.new()
	p.texture = texture if texture else SPARK
	p.amount = amount
	p.lifetime = lifetime
	p.one_shot = true
	p.explosiveness = 1.0
	p.spread = 180.0
	p.gravity = Vector2.ZERO
	p.initial_velocity_min = speed * 0.4
	p.initial_velocity_max = speed
	p.damping_min = speed * 0.8
	p.damping_max = speed * 1.2
	p.angular_velocity_min = -180.0
	p.angular_velocity_max = 180.0
	p.scale_amount_min = size * 0.5
	p.scale_amount_max = size
	var grad := Gradient.new()
	grad.set_color(0, color)
	grad.set_color(1, Color(color, 0.0))
	p.color_ramp = grad
	if texture == null:
		var mat := CanvasItemMaterial.new()
		mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
		p.material = mat
	p.z_index = 20
	parent.add_child(p)
	p.global_position = pos
	p.emitting = true
	parent.get_tree().create_timer(lifetime + 0.3, false).timeout.connect(p.queue_free)


static func floating_text(parent: Node, pos: Vector2, text: String, color: Color, font_size := 26) -> void:
	var ft := FLOATING_TEXT.instantiate()
	ft.position = pos + Vector2(0, -24)
	ft.setup(text, color, font_size)
	parent.add_child(ft)
