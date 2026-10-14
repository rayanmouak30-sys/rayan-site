class_name JoueurDistant
extends Combattant
## Un joueur humain d'une autre machine : son corps suit l'état réseau (position, regard, vitesse),
## il a des zones de touche et un modèle animé. Chez l'hôte, il porte aussi sa vie, ses crédits et ses capacités.

var peer := 0
var cible_pos := Vector3.ZERO
var lacet_reseau := 0.0
var tangage_reseau := 0.0
var vel_reseau := Vector3.ZERO
var accroupi_r := false
var sprint_r := false
var au_sol_r := true
var arme_id := ""
var principale := ""            # arme principale (connue de l'hôte)
var maintien_interaction := false
var recu := false


func _ready() -> void:
	super._ready()
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.32
	cap.height = 1.8
	cs.shape = cap
	cs.position.y = 0.9
	add_child(cs)


func recevoir_etat(pos: Vector3, lacet: float, tangage: float, vel: Vector3, drapeaux: int, arme: String) -> void:
	cible_pos = pos
	lacet_reseau = lacet
	tangage_reseau = tangage
	vel_reseau = vel
	accroupi_r = drapeaux & 1 != 0
	sprint_r = drapeaux & 2 != 0
	au_sol_r = drapeaux & 4 != 0
	if not recu:
		global_position = pos
		recu = true
	if arme != "" and arme != arme_id:
		arme_id = arme
		tenir_arme(arme)


func _physics_process(dt: float) -> void:
	maj_statuts(dt)
	if not vivant:
		return
	# Interpolation douce + prolongement par la vitesse (masque la latence)
	var predite := cible_pos + vel_reseau * 0.05
	if global_position.distance_to(predite) > 4.0:
		global_position = predite
	else:
		global_position = global_position.lerp(predite, 1.0 - exp(-18.0 * dt))
	rotation.y = lerp_angle(rotation.y, lacet_reseau, 1.0 - exp(-20.0 * dt))
	velocity = vel_reseau
	animer_modele(au_sol_r, accroupi_r, sprint_r)


func yeux() -> Vector3:
	return global_position + Vector3(0, 1.62 * taille if not accroupi_r else 1.12 * taille, 0)


func direction_regard() -> Vector3:
	return Vector3(-sin(lacet_reseau) * cos(tangage_reseau), sin(tangage_reseau), -cos(lacet_reseau) * cos(tangage_reseau))


## Réapparition décidée par l'hôte : on prévient le propriétaire
func reapparaitre(t: Transform3D) -> void:
	global_position = t.origin
	cible_pos = t.origin
	rotation.y = t.basis.get_euler().y
	vie = 100.0
	vivant = true
	collision_layer = COUCHE_COMBATTANTS
	activer_zones(true)
	reinitialiser_statuts()
	if modele:
		modele.ressusciter()
	if Reseau.est_hote() and Jeu.partie:
		Jeu.partie.sync.rpc_id(peer, "rpc_reapparaitre", t)


func mourir(tueur: Combattant, _tete: bool) -> void:
	vivant = false
	collision_layer = 0
	activer_zones(false)
	if modele:
		var sens := "avant"
		if tueur:
			var d := direction_regard().dot((tueur.global_position - global_position).normalized())
			sens = "arriere" if d > 0.3 else ("avant" if d < -0.3 else "cote")
		modele.mourir_anim(sens)
