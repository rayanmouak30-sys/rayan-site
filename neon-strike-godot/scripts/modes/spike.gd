class_name Spike
extends Node3D
## Le Spike : porté par un attaquant (sur le dos), lâché à sa mort, posé sur un site (4 s),
## explose après 40 s ; les défenseurs le désamorcent en 7 s (la moitié reste acquise à 3,5 s).

signal pose(site: String)
signal explose
signal desamorce

const DUREE_POSE := 4.0
const DUREE_DESAMORCAGE := 7.0
const MINUTERIE := 40.0

var etat := "porte"        # porte, sol, pose, explose, desamorce
var porteur: Combattant
var site := ""
var minuterie := MINUTERIE
var progression_desamorcage := 0.0
var bip_t := 0.0
var lumiere: OmniLight3D
var anneau_mat: StandardMaterial3D
var corps: Node3D


func _ready() -> void:
	corps = Node3D.new()
	add_child(corps)
	var base := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.12
	cm.bottom_radius = 0.16
	cm.height = 0.42
	base.mesh = cm
	base.material_override = Materiaux.obtenir("metal_peint", Color(0.4, 0.4, 0.45))
	base.position.y = 0.21
	corps.add_child(base)
	for i in 3:
		var a := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = 0.13
		tm.outer_radius = 0.16
		a.mesh = tm
		a.position.y = 0.1 + i * 0.12
		if i == 1:
			anneau_mat = StandardMaterial3D.new()
			anneau_mat.emission_enabled = true
			anneau_mat.albedo_color = Color(1.0, 0.3, 0.3)
			anneau_mat.emission = Color(1.0, 0.25, 0.25)
			anneau_mat.emission_energy_multiplier = 3.0
			a.material_override = anneau_mat
		else:
			a.material_override = Materiaux.obtenir("metal")
		corps.add_child(a)
	var pointe := MeshInstance3D.new()
	var cn := CylinderMesh.new()
	cn.top_radius = 0.0
	cn.bottom_radius = 0.09
	cn.height = 0.2
	pointe.mesh = cn
	pointe.position.y = 0.52
	pointe.material_override = Materiaux.obtenir("metal")
	corps.add_child(pointe)
	lumiere = OmniLight3D.new()
	lumiere.light_color = Color(1.0, 0.3, 0.3)
	lumiere.light_energy = 0.0
	lumiere.omni_range = 4.0
	lumiere.position.y = 0.4
	add_child(lumiere)


func donner(c: Combattant) -> void:
	porteur = c
	etat = "porte"
	visible = true


func lacher(pos: Vector3) -> void:
	porteur = null
	etat = "sol"
	global_position = pos
	rotation = Vector3.ZERO
	visible = true


func poser(pos: Vector3, nom_site: String) -> void:
	porteur = null
	etat = "pose"
	site = nom_site
	minuterie = MINUTERIE
	progression_desamorcage = 0.0
	global_position = pos
	rotation = Vector3(0, randf() * TAU, 0)
	Sons.jouer_3d("spike_pose", pos, 0.0)
	pose.emit(nom_site)


func _process(dt: float) -> void:
	match etat:
		"porte":
			if is_instance_valid(porteur) and porteur.vivant:
				# Sur le dos du porteur
				var b := porteur.global_transform.basis
				global_position = porteur.global_position + b * Vector3(0.0, 1.2 * porteur.taille, 0.25)
				rotation = Vector3(0.3, porteur.rotation.y, 0)
				visible = not porteur.est_joueur
		"pose":
			minuterie -= dt
			# Bips de plus en plus rapides
			var periode := 1.0 if minuterie > 20.0 else (0.5 if minuterie > 10.0 else (0.25 if minuterie > 5.0 else 0.12))
			bip_t -= dt
			if bip_t <= 0.0:
				bip_t = periode
				Sons.jouer_3d("spike_bip", global_position + Vector3.UP * 0.4, -4.0)
				lumiere.light_energy = 3.0
			lumiere.light_energy = move_toward(lumiere.light_energy, 0.3, dt * 12.0)
			anneau_mat.emission_energy_multiplier = 1.0 + lumiere.light_energy * 2.0
			if minuterie <= 0.0:
				etat = "explose"
				explose.emit()
		_:
			pass


func desamorcer() -> void:
	etat = "desamorce"
	lumiere.light_energy = 0.0
	anneau_mat.emission = Color(0.3, 1.0, 0.6)
	Sons.jouer_3d("spike_desamorce", global_position, 0.0)
	desamorce.emit()
