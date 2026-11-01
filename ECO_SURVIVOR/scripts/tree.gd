@tool
extends StaticBody2D
## ARBRE : obstacle (seul le tronc bloque). Le feuillage passe au-dessus du joueur
## et devient transparent quand le joueur est dessous.

const TEXTURES := [
	preload("res://assets/sprites/decor/tree_green.png"),
	preload("res://assets/sprites/decor/tree_lime.png"),
	preload("res://assets/sprites/decor/tree_blossom.png"),
]

@export_range(0, 2) var variant := 0:
	set(value):
		variant = value
		if is_node_ready():
			_apply()

var _player: Node2D
var _t := 0.0


func _ready() -> void:
	_apply()
	_t = randf() * 10.0


func _apply() -> void:
	$Canopy.texture = TEXTURES[variant]


func _process(delta: float) -> void:
	if Engine.is_editor_hint():
		return
	_t += delta
	$Canopy.rotation = sin(_t * 0.8) * 0.03
	if _player == null:
		_player = get_tree().get_first_node_in_group("player")
		return
	var near := global_position.distance_to(_player.global_position) < 52.0
	$Canopy.modulate.a = move_toward($Canopy.modulate.a, 0.45 if near else 1.0, delta * 3.0)
