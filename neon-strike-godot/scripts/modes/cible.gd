class_name Cible
extends Combattant
## Cible du stand de tir : mannequin articulé qui bascule quand on l'élimine puis se relève.

signal tombee(cible: Cible)

var socle: Node3D
var corps_visuel: Node3D
var relever_t := 0.0
var mobile := false
var origine := Vector3.ZERO
var phase := 0.0
var mats: Array[StandardMaterial3D] = []


func _ready() -> void:
	super._ready()
	collision_layer = 0
	collision_mask = 0
	nom_affiche = "Cible"
	equipe = "rouge"
	origine = position
	phase = randf() * TAU
	socle = Node3D.new()
	add_child(socle)
	var base := MeshInstance3D.new()
	var cy := CylinderMesh.new()
	cy.top_radius = 0.3
	cy.bottom_radius = 0.36
	cy.height = 0.08
	base.mesh = cy
	base.position.y = 0.04
	base.material_override = Materiaux.obtenir("metal")
	socle.add_child(base)
	corps_visuel = Node3D.new()
	add_child(corps_visuel)
	var orange := StandardMaterial3D.new()
	orange.albedo_color = Color(0.95, 0.45, 0.18)
	orange.roughness = 0.6
	var gris := StandardMaterial3D.new()
	gris.albedo_color = Color(0.25, 0.27, 0.3)
	gris.roughness = 0.5
	gris.metallic = 0.5
	mats = [orange, gris]
	_piece(CapsuleMesh.new(), Vector3(0, 0.45, 0), Vector3(0.36, 0.95, 0.3), gris)        # jambes
	_piece(CapsuleMesh.new(), Vector3(0, 1.18, 0), Vector3(0.56, 0.8, 0.36), orange)      # torse
	_piece(SphereMesh.new(), Vector3(0, 1.63, 0.02), Vector3(0.3, 0.32, 0.3), orange)     # tête
	_piece(CapsuleMesh.new(), Vector3(-0.36, 1.15, 0), Vector3(0.14, 0.62, 0.14), gris)
	_piece(CapsuleMesh.new(), Vector3(0.36, 1.15, 0), Vector3(0.14, 0.62, 0.14), gris)
	var bande := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.22, 0.04, 0.02)
	bande.mesh = bm
	bande.position = Vector3(0, 1.66, -0.15)
	bande.material_override = Materiaux.neon(Color(0.4, 1.0, 0.9), 3.0)
	corps_visuel.add_child(bande)


func _piece(m: PrimitiveMesh, pos: Vector3, taille: Vector3, mat: Material) -> void:
	var mi := MeshInstance3D.new()
	if m is CapsuleMesh:
		(m as CapsuleMesh).radius = taille.x * 0.5
		(m as CapsuleMesh).height = taille.y
		mi.scale = Vector3(1, 1, taille.z / taille.x)
	elif m is SphereMesh:
		(m as SphereMesh).radius = taille.x * 0.5
		(m as SphereMesh).height = taille.y
	mi.mesh = m
	mi.position = pos
	mi.material_override = mat
	corps_visuel.add_child(mi)


func _physics_process(dt: float) -> void:
	if mobile and vivant:
		position.x = origine.x + sin(Time.get_ticks_msec() / 1000.0 * 1.3 + phase) * 2.2
	if not vivant:
		relever_t -= dt
		if relever_t <= 0.0:
			relever()


func tomber(direction: Vector3) -> void:
	vivant = false
	activer_zones(false)
	relever_t = 2.2
	var axe := Vector3.UP.cross(direction.normalized()).normalized()
	if axe.length_squared() < 0.1:
		axe = Vector3.RIGHT
	var cible_rot := Basis(axe, deg_to_rad(85.0))
	var tw := create_tween()
	tw.tween_property(corps_visuel, "basis", cible_rot, 0.35).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tombee.emit(self)


func relever() -> void:
	vie = 100.0
	armure = 0.0
	vivant = true
	var tw := create_tween()
	tw.tween_property(corps_visuel, "basis", Basis.IDENTITY, 0.4).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_callback(activer_zones.bind(true))


## Petit sursaut quand la cible est touchée
func secouer(direction: Vector3, force: float) -> void:
	var axe := Vector3.UP.cross(direction.normalized())
	if axe.length_squared() < 0.01:
		return
	var tw := create_tween()
	tw.tween_property(corps_visuel, "basis", Basis(axe.normalized(), deg_to_rad(6.0 * force)), 0.05)
	tw.tween_property(corps_visuel, "basis", Basis.IDENTITY, 0.25).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
