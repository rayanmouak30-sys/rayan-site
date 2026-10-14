class_name Bot
extends Combattant
## Bot : se déplace sur le maillage de navigation, voit et entend ses ennemis, vise avec un temps de réaction
## et une erreur qui dépendent de la difficulté, tire en rafales, se met à couvert pour recharger ou se soigner,
## contourne, cherche la dernière position connue et réagit aux touches.

const GRAVITE := 20.0
const DIFFICULTES := {
	"facile": {"reaction": 0.7, "erreur": 4.0, "tete": 0.08, "suivi": 3.0, "tourne": 4.0, "contre_strafe": false},
	"normal": {"reaction": 0.42, "erreur": 2.4, "tete": 0.22, "suivi": 5.0, "tourne": 7.0, "contre_strafe": true},
	"difficile": {"reaction": 0.28, "erreur": 1.4, "tete": 0.38, "suivi": 8.0, "tourne": 10.0, "contre_strafe": true},
	"expert": {"reaction": 0.18, "erreur": 0.8, "tete": 0.52, "suivi": 12.0, "tourne": 14.0, "contre_strafe": true},
}

var agent: NavigationAgent3D
var forme: CollisionShape3D
var capsule: CapsuleShape3D
var niveau := {}
var armes := {}                  # emplacement -> LogiqueArme
var arme: LogiqueArme
var effets: Effets

var etat := "objectif"            # objectif, combat, couvert, chercher
var objectif := Vector3.ZERO
var objectif_regard := Vector3.ZERO
var cible: Combattant
var vu_depuis := 0.0              # temps depuis que la cible est vue (réaction)
var plus_vu := 99.0               # temps depuis la dernière vue
var derniere_pos := Vector3.ZERO
var suspicion := Vector3.ZERO     # direction d'un bruit entendu
var suspicion_t := 0.0
var erreur := Vector2.ZERO        # erreur de visée actuelle (degrés)
var lacet := 0.0
var tangage := 0.0
var rafale := 0
var pause_tir := 0.0
var strafe := 1.0
var strafe_t := 0.0
var accroupi := false
var couvert := Vector3.ZERO
var couvert_t := 0.0
var percep_t := 0.0
var bloque_t := 0.0
var horloge := 0.0
var repath_t := 0.0
var actif := true                 # faux pendant la phase d'achat / avant le début de manche


func _ready() -> void:
	super._ready()
	niveau = DIFFICULTES.get(String(Jeu.config.get("difficulte", "normal")), DIFFICULTES["normal"])
	capsule = CapsuleShape3D.new()
	capsule.radius = 0.32
	capsule.height = 1.8
	forme = CollisionShape3D.new()
	forme.shape = capsule
	forme.position.y = 0.9
	add_child(forme)
	agent = NavigationAgent3D.new()
	agent.path_desired_distance = 0.8
	agent.target_desired_distance = 1.0
	agent.radius = 0.4
	agent.height = 1.75
	agent.path_max_distance = 3.0
	add_child(agent)
	floor_snap_length = 0.4
	floor_max_angle = deg_to_rad(46)
	lacet = rotation.y
	strafe_t = randf_range(0.3, 0.9)


func equiper(id_principale: String) -> void:
	armes.clear()
	armes[2] = LogiqueArme.new("pistolet")
	if id_principale != "" and id_principale != "pistolet":
		armes[1] = LogiqueArme.new(id_principale)
	arme = armes.get(1, armes[2])
	tenir_arme(arme.id)


func reapparaitre(t: Transform3D) -> void:
	global_position = t.origin
	lacet = t.basis.get_euler().y
	rotation = Vector3(0, lacet, 0)
	velocity = Vector3.ZERO
	vie = 100.0
	vivant = true
	collision_layer = COUCHE_COMBATTANTS
	activer_zones(true)
	reinitialiser_statuts()
	etat = "objectif"
	cible = null
	plus_vu = 99.0
	if modele:
		modele.ressusciter()
	for a in armes.values():
		(a as LogiqueArme).reinitialiser()


func mourir(tueur: Combattant, _tete: bool) -> void:
	vivant = false
	collision_layer = 0
	activer_zones(false)
	cible = null
	if modele:
		var sens := "avant"
		if tueur:
			var vers := (tueur.global_position - global_position).normalized()
			var avant := -global_transform.basis.z
			var d := avant.dot(vers)
			sens = "arriere" if d > 0.3 else ("avant" if d < -0.3 else "cote")
		modele.mourir_anim(sens)


func _physics_process(dt: float) -> void:
	horloge += dt
	maj_statuts(dt)
	if not vivant:
		velocity.x = move_toward(velocity.x, 0.0, 10.0 * dt)
		velocity.z = move_toward(velocity.z, 0.0, 10.0 * dt)
		velocity.y -= GRAVITE * dt
		move_and_slide()
		return
	if arme:
		arme.maj(dt, horloge)
	if actif:
		percep_t -= dt
		if percep_t <= 0.0:
			percep_t = 0.1
			_percevoir()
		_decider(dt)
	_deplacer(dt)
	_viser(dt)
	if actif:
		_tirer(dt)
	animer_modele(is_on_floor(), accroupi, false)


# --- Perception -------------------------------------------------------------

func _ennemis() -> Array:
	var p: Partie = Jeu.partie
	if p == null:
		return []
	var l := []
	for c in p.combattants:
		if c != self and c.vivant and c.equipe != equipe and not (c is Cible):
			l.append(c)
	return l


func voit(c: Combattant) -> bool:
	if c.invisible() and global_position.distance_to(c.global_position) > 6.0:
		return false
	var depuis := yeux()
	var vers := c.global_position + Vector3(0, 1.2 * c.taille, 0)
	var q := PhysicsRayQueryParameters3D.create(depuis, vers, COUCHE_MONDE)
	return get_world_3d().direct_space_state.intersect_ray(q).is_empty()


func _percevoir() -> void:
	var meilleur: Combattant = null
	var meilleur_d := 1e9
	var avant := Vector3(-sin(lacet), 0, -cos(lacet))
	for c in _ennemis():
		var d: float = global_position.distance_to(c.global_position)
		if d > 90.0:
			continue
		var dir: Vector3 = (c.global_position - global_position)
		dir.y = 0
		var angle := rad_to_deg(avant.angle_to(dir.normalized()))
		var champ := 75.0 if c != cible else 110.0
		if (angle > champ and d > 5.0) or aveugle > 0.0:
			continue
		if c.revele > 0.0 or voit(c):
			var score := d * (0.6 if c == cible else 1.0)
			if score < meilleur_d:
				meilleur_d = score
				meilleur = c
	if meilleur:
		if meilleur != cible:
			cible = meilleur
			vu_depuis = 0.0
			erreur = Vector2(randf_range(-1, 1), randf_range(-1, 1)).normalized() * float(niveau["erreur"]) * randf_range(1.5, 2.5)
		plus_vu = 0.0
		derniere_pos = cible.global_position
	elif cible:
		plus_vu += 0.1
		if not cible.vivant or plus_vu > 6.0:
			cible = null


## Bruit entendu (tir, pas, capacité) : le bot regarde dans cette direction
func entendre(pos: Vector3, auteur: Combattant) -> void:
	if auteur and auteur.equipe == equipe:
		return
	suspicion = pos
	suspicion_t = 3.0
	if cible == null and etat == "objectif":
		derniere_pos = pos


## Touché : se retourne vers le tireur et réagit
func reagir_touche(auteur: Combattant) -> void:
	if auteur and auteur.equipe != equipe:
		suspicion = auteur.global_position
		suspicion_t = 3.0
		if cible == null:
			cible = auteur
			vu_depuis = 0.0
			plus_vu = 0.5
			derniere_pos = auteur.global_position
	if modele:
		modele.action("touche")


# --- Décisions --------------------------------------------------------------

func _decider(dt: float) -> void:
	suspicion_t -= dt
	couvert_t -= dt
	var vois := cible != null and plus_vu < 0.15
	if vois:
		vu_depuis += dt
	var besoin_couvert := (vie < 35.0 and armure <= 0.0) or (arme and arme.mun == 0 and arme.type != "melee")
	match etat:
		"objectif":
			if vois:
				etat = "combat"
			elif cible and plus_vu < 5.0:
				etat = "chercher"
		"combat":
			if besoin_couvert:
				_chercher_couvert()
			elif not vois:
				etat = "chercher" if cible else "objectif"
		"couvert":
			if couvert_t <= 0.0 or (not arme.en_recharge() and vie >= 35.0) or global_position.distance_to(couvert) < 0.8 and not arme.en_recharge():
				etat = "chercher" if cible else "objectif"
		"chercher":
			if vois:
				etat = "combat"
			elif cible == null or plus_vu > 5.0 or global_position.distance_to(derniere_pos) < 1.5:
				etat = "objectif"
				cible = null
	# Recharge quand on n'est pas en combat
	if arme and etat != "combat" and arme.mun < int(arme.def.get("chargeur", 1)) * 0.5 and not arme.en_recharge():
		_recharger()
	# Change pour le pistolet si l'arme principale est vide en plein combat proche
	if arme and arme.mun == 0 and armes.has(2) and arme != armes[2] and vois and cible.global_position.distance_to(global_position) < 15.0:
		arme.annuler_rechargement()
		arme = armes[2]
		tenir_arme(arme.id)
	elif arme == armes.get(2) and armes.has(1) and etat != "combat" and (armes[1] as LogiqueArme).mun > 0:
		arme = armes[1]
		tenir_arme(arme.id)


func _recharger() -> void:
	if arme.lancer_rechargement() and modele:
		modele.action("rechargement", arme.duree_recharge)
		if Sons.limite("rech_bot_" + str(get_instance_id()), 0.5):
			Sons.jouer_3d("chargeur_sortie", global_position + Vector3.UP, -10.0)


func _chercher_couvert() -> void:
	var menace := derniere_pos + Vector3(0, 1.5, 0)
	var map := get_world_3d().navigation_map
	var meilleur := Vector3.ZERO
	var meilleur_d := 1e9
	var espace := get_world_3d().direct_space_state
	for i in 18:
		var a := randf() * TAU
		var r := randf_range(3.0, 12.0)
		var p := NavigationServer3D.map_get_closest_point(map, global_position + Vector3(cos(a) * r, 0, sin(a) * r))
		var q := PhysicsRayQueryParameters3D.create(menace, p + Vector3(0, 1.1, 0), COUCHE_MONDE)
		if espace.intersect_ray(q).is_empty():
			continue
		var d := global_position.distance_to(p) + p.distance_to(derniere_pos) * -0.15
		if d < meilleur_d:
			meilleur_d = d
			meilleur = p
	if meilleur != Vector3.ZERO:
		couvert = meilleur
		couvert_t = 6.0
		etat = "couvert"
		if arme.mun < int(arme.def.get("chargeur", 1)) and not arme.en_recharge():
			_recharger()


# --- Déplacement -------------------------------------------------------------

func _deplacer(dt: float) -> void:
	var but := global_position
	var vitesse := 5.3 * (1.0 + bonus_vitesse)
	var direct := Vector3.ZERO
	accroupi = false
	match etat:
		"objectif":
			but = objectif
		"chercher":
			but = derniere_pos
			vitesse *= 0.75
		"couvert":
			but = couvert
		"combat":
			# Déplacement latéral (ADAD), arrêt pour tirer précisément
			strafe_t -= dt
			if strafe_t <= 0.0:
				strafe = -strafe if randf() < 0.75 else strafe
				strafe_t = randf_range(0.35, 1.1)
				accroupi = randf() < 0.15
			var vers := (cible.global_position - global_position) if cible else Vector3.FORWARD
			vers.y = 0
			direct = vers.normalized().cross(Vector3.UP) * strafe
			if niveau["contre_strafe"] and pause_tir <= 0.0 and rafale > 0:
				direct = Vector3.ZERO
			if arme and arme.type == "melee" and cible:
				direct = vers.normalized()
	if statut("ralenti") > 0.0:
		vitesse *= 0.55
	var dir := Vector3.ZERO
	if direct != Vector3.ZERO:
		dir = direct
		# Ne pas tomber ni foncer dans un mur : on vérifie la case visée
		var map := get_world_3d().navigation_map
		var p := NavigationServer3D.map_get_closest_point(map, global_position + dir * 1.2)
		if p.distance_to(global_position + dir * 1.2) > 0.6:
			strafe = -strafe
			dir = -dir
	elif global_position.distance_to(but) > 1.2:
		repath_t -= dt
		if repath_t <= 0.0 or agent.target_position.distance_to(but) > 1.0:
			agent.target_position = but
			repath_t = 0.5
		var suivant := agent.get_next_path_position()
		dir = suivant - global_position
		dir.y = 0
		if dir.length() > 0.05:
			dir = dir.normalized()
	if accroupi:
		vitesse *= 0.5
	capsule.height = 1.25 if accroupi else 1.8
	forme.position.y = capsule.height * 0.5
	var cible_v := dir * vitesse
	var h := Vector3(velocity.x, 0, velocity.z).move_toward(cible_v, 40.0 * dt)
	velocity.x = h.x
	velocity.z = h.z
	if is_on_floor():
		velocity.y = -1.0
	else:
		velocity.y -= GRAVITE * dt
	move_and_slide()
	# Coincé : petit saut et nouveau chemin
	if dir != Vector3.ZERO and Vector3(velocity.x, 0, velocity.z).length() < 0.5:
		bloque_t += dt
		if bloque_t > 0.8 and is_on_floor():
			velocity.y = 6.0
			bloque_t = 0.0
			repath_t = 0.0
			strafe = -strafe
	else:
		bloque_t = 0.0


# --- Visée et tir ------------------------------------------------------------

func point_vise() -> Vector3:
	if cible and plus_vu < 0.3:
		var t := cible.taille
		return cible.global_position + Vector3(0, 1.25 * t, 0)
	if etat == "chercher" or etat == "couvert":
		return derniere_pos + Vector3(0, 1.4, 0)
	if suspicion_t > 0.0:
		return suspicion + Vector3(0, 1.4, 0)
	if objectif_regard != Vector3.ZERO:
		return objectif_regard
	var v := Vector3(velocity.x, 0, velocity.z)
	return global_position + (v.normalized() * 10.0 if v.length() > 0.5 else -global_transform.basis.z * 10.0) + Vector3(0, 1.5, 0)


func _viser(dt: float) -> void:
	var p := point_vise()
	var d := p - yeux()
	var lacet_voulu := atan2(-d.x, -d.z)
	var tangage_voulu := atan2(d.y, Vector2(d.x, d.z).length())
	var k := 1.0 - exp(-float(niveau["tourne"]) * dt)
	lacet = lerp_angle(lacet, lacet_voulu, k)
	tangage = lerpf(tangage, tangage_voulu, k)
	rotation.y = lacet
	# L'erreur de visée se réduit à mesure que le bot suit sa cible
	erreur = erreur.lerp(Vector2.ZERO, 1.0 - exp(-float(niveau["suivi"]) * dt * 0.25))


func _tirer(dt: float) -> void:
	pause_tir -= dt
	if arme == null or cible == null or plus_vu > 0.2 or not cible.vivant:
		rafale = 0
		return
	if vu_depuis < float(niveau["reaction"]) or arme.en_recharge():
		return
	var dist := global_position.distance_to(cible.global_position)
	var bot_def: Dictionary = arme.def.get("bot", {})
	if arme.type == "melee":
		if dist < 2.2 and arme.peut_tirer(horloge, true):
			arme.tirer(horloge, 0.0, false)
			if modele:
				modele.action("tir")
			Sons.jouer_3d("couteau", global_position + Vector3.UP, -4.0)
			_infliger(cible, float(arme.def["degats_leger"]), false, cible.global_position + Vector3.UP)
		return
	if bot_def.has("portee") and dist > float(bot_def["portee"]):
		return
	if pause_tir > 0.0:
		return
	if rafale <= 0:
		var r: Array = bot_def.get("rafale", [1, 3])
		rafale = randi_range(int(r[0]), int(r[1]))
	if not arme.peut_tirer(horloge, true):
		return
	# Angle entre le regard et la cible : on ne tire que si on est aligné
	var vers := (cible.global_position + Vector3(0, 1.2, 0) - yeux()).normalized()
	var regard := Vector3(-sin(lacet) * cos(tangage), sin(tangage), -cos(lacet) * cos(tangage))
	if rad_to_deg(regard.angle_to(vers)) > 12.0:
		return
	var vise_tete := randf() < float(niveau["tete"])
	var point := cible.global_position + Vector3(0, (1.63 if vise_tete else 1.2) * cible.taille, 0)
	var dir := (point - yeux()).normalized()
	var ecart := arme.imprecision(Vector3(velocity.x, 0, velocity.z).length(), not is_on_floor(), accroupi, false) * float(bot_def.get("facteur", 1.0))
	var decalages := arme.tirer(horloge, ecart, false)
	arme.recul = Vector2.ZERO
	var base := Basis.looking_at(dir, Vector3.UP)
	var err := erreur + Vector2(randf_range(-1, 1), randf_range(-1, 1)) * float(niveau["erreur"]) * 0.35
	var depart := modele.bouche() if modele else yeux()
	var couleur := Color(arme.def.get("couleur_trace", "#ffe9b8"))
	var espace := get_world_3d().direct_space_state
	var ex: Array[RID] = [get_rid()]
	for z in zones_touche:
		ex.append(z.get_rid())
	var touches := {}
	var n := 0
	for o in decalages:
		var off: Vector2 = o + Vector2(deg_to_rad(err.x), deg_to_rad(err.y))
		var d := (base * Vector3(tan(off.x), tan(off.y), -1.0)).normalized()
		var q := PhysicsRayQueryParameters3D.create(yeux(), yeux() + d * 200.0, MASQUE_TIR, ex)
		q.collide_with_areas = true
		var r := espace.intersect_ray(q)
		var fin := yeux() + d * 200.0
		if not r.is_empty():
			fin = r["position"]
			var c: Object = r["collider"]
			if c is Area3D and c.has_meta("combattant"):
				var v: Combattant = c.get_meta("combattant")
				var partie_corps: String = c.get_meta("partie")
				var deg: float = float(arme.def["degats"][partie_corps]) * DonneesArmes.facteur_distance(arme.def, yeux().distance_to(fin))
				if not touches.has(v):
					touches[v] = [0.0, false, fin]
				touches[v][0] += deg
				touches[v][1] = touches[v][1] or partie_corps == "tete"
				if effets:
					effets.touche_combattant(fin, r["normal"], partie_corps == "tete", v.armure > 0.0)
			elif effets:
				effets.impact(fin, r["normal"], Combattant.matiere_de(c), couleur)
		if effets and n < 3:
			effets.trace(depart, fin, couleur, 0.02)
		n += 1
	if effets:
		effets.flash(depart, Color(arme.def.get("couleur_flash", "#ffc27a")), 1.0)
	Sons.jouer_3d("tir_" + arme.id, depart, -2.0, randf_range(0.96, 1.04), 90.0)
	if modele:
		modele.action("tir")
	var p: Partie = Jeu.partie
	if p:
		p.bruit(global_position, 45.0, self)
	for v in touches:
		_infliger(v, touches[v][0], touches[v][1], touches[v][2])
	rafale -= 1
	if rafale <= 0:
		pause_tir = randf_range(0.25, 0.6) * (float(bot_def.get("cadence", 0.3)) / 0.3)
	if arme.mun == 0:
		_recharger()


func _infliger(v: Combattant, deg: float, tete: bool, pos: Vector3) -> void:
	var p: Partie = Jeu.partie
	if p:
		p.infliger(self, v, deg, tete, arme.id, pos)
