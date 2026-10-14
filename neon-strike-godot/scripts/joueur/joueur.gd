class_name Joueur
extends Combattant
## Joueur local : déplacements FPS (course, sprint, saut, accroupi), caméra, inventaire, tir, recul,
## visée, rechargement, inspection, couteau. La vue des bras et de l'arme est gérée par VueArme.

signal arme_changee(id: String)
signal a_tire(id: String)
signal touche_infligee(victime: Combattant, degats: float, tete: bool, mortel: bool)

const GRAVITE := 20.0
const SAUT := 6.4
const ACCEL_SOL := 62.0
const FRICTION := 11.0
const ACCEL_AIR := 9.0
const SPRINT := 1.3
const VITESSE_ACCROUPI := 0.5
const HAUTEUR_DEBOUT := 1.8
const HAUTEUR_ACCROUPI := 1.25
const YEUX_DEBOUT := 1.62
const YEUX_ACCROUPI := 1.12
const DEG_PAR_PIXEL := 0.05

var tete: Node3D
var cam: Camera3D
var vue: VueArme
var forme: CollisionShape3D
var capsule: CapsuleShape3D
var effets: Effets

var regard := Vector2.ZERO          # x : tangage, y : lacet (radians)
var punch := Vector2.ZERO           # recul visuel de la caméra (degrés)
var secousse := 0.0
var souris_image := Vector2.ZERO
var controle := true                # faux pendant les menus / la pause / la mort

var inventaire := {1: "", 2: "pistolet", 3: "couteau"}
var logiques := {}                  # id -> LogiqueArme
var emplacement := 2
var arme: LogiqueArme
var pret_t := 0.0                   # temps avant de pouvoir tirer (sortie de l'arme)
var sprint_bloque := 0.0
var vise := false
var accroupi := false
var accroupi_k := 0.0
var gachette_relachee := true
var etait_en_recharge := false
var etait_au_sol := true
var vitesse_chute := 0.0
var atterrissage := 0.0
var pas_t := 0.0
var ecart_actuel := 0.0             # imprécision courante (degrés) pour le viseur dynamique
var horloge := 0.0
var temps_mort := 0.0


func _ready() -> void:
	super._ready()
	est_joueur = true
	hauteur_yeux = YEUX_DEBOUT
	floor_max_angle = deg_to_rad(46.0)
	floor_snap_length = 0.35
	floor_constant_speed = true
	capsule = CapsuleShape3D.new()
	capsule.radius = 0.32
	capsule.height = HAUTEUR_DEBOUT
	forme = CollisionShape3D.new()
	forme.shape = capsule
	forme.position.y = HAUTEUR_DEBOUT * 0.5
	add_child(forme)
	tete = Node3D.new()
	tete.name = "Tete"
	tete.position.y = YEUX_DEBOUT
	add_child(tete)
	cam = Camera3D.new()
	cam.name = "Camera"
	cam.keep_aspect = Camera3D.KEEP_WIDTH   # le champ de vision réglé est horizontal
	cam.near = 0.05
	cam.far = 400.0
	cam.current = true
	cam.cull_mask = 0xFFFFF & ~(1 << 19)    # la couche 20 contient le modèle du joueur (ombre seule)
	tete.add_child(cam)
	regard.y = rotation.y
	rotation = Vector3.ZERO


## À appeler par la partie : vue FPS (dans l'interface) et effets du monde
func brancher(vue_arme: VueArme, fx: Effets) -> void:
	vue = vue_arme
	effets = fx
	var ids := []
	for e in inventaire.values():
		if e != "":
			ids.append(e)
	vue.prechauffer(ids)
	choisir_emplacement(emplacement if inventaire[emplacement] != "" else 2, true)


func donner_arme(id: String) -> void:
	var def := DonneesArmes.arme(id)
	var e := int(def.get("emplacement", 1))
	inventaire[e] = id
	logiques[id] = LogiqueArme.new(id)
	if vue:
		vue.prechauffer([id])
		choisir_emplacement(e, true)


func logique(id: String) -> LogiqueArme:
	if not logiques.has(id):
		logiques[id] = LogiqueArme.new(id)
	return logiques[id]


func choisir_emplacement(e: int, force := false) -> void:
	var id: String = inventaire.get(e, "")
	if id == "" or (e == emplacement and arme != null and not force):
		return
	if arme:
		arme.annuler_rechargement()
	emplacement = e
	arme = logique(id)
	etait_en_recharge = false
	pret_t = float(arme.def.get("equipement", 0.6))
	vise = false
	if vue:
		vue.equiper(id, Profil.skin_arme(id))
	Sons.jouer("equiper_" + id if Sons.existe("equiper_" + id) else "equiper", -4.0)
	if modele:
		tenir_arme(id)
	arme_changee.emit(id)


func arme_suivante(sens: int) -> void:
	var e := emplacement
	for i in 3:
		e = wrapi(e + sens, 1, 4)
		if inventaire.get(e, "") != "":
			choisir_emplacement(e)
			return


func _unhandled_input(event: InputEvent) -> void:
	if not controle or not vivant:
		return
	if event is InputEventMouseMotion and (Input.mouse_mode == Input.MOUSE_MODE_CAPTURED or Test.actif):
		souris_image += (event as InputEventMouseMotion).screen_relative
	elif event.is_action_pressed("arme_suivante"):
		arme_suivante(1)
	elif event.is_action_pressed("arme_precedente"):
		arme_suivante(-1)


## Touches d'action lues à chaque image physique (fonctionne aussi avec la manette)
func _touches_action() -> void:
	if Input.is_action_just_pressed("arme_1"):
		choisir_emplacement(1)
	elif Input.is_action_just_pressed("arme_2"):
		choisir_emplacement(2)
	elif Input.is_action_just_pressed("arme_3"):
		choisir_emplacement(3)
	if Input.is_action_just_pressed("recharger"):
		_recharger()
	if Input.is_action_just_pressed("inspecter"):
		if vue and pret_t <= 0.0 and not arme.en_recharge():
			vue.inspecter()


func _recharger() -> void:
	if arme and arme.lancer_rechargement():
		vise = false
		etait_en_recharge = true
		if vue:
			vue.recharger(arme.recharge_vide, arme.duree_recharge)
		if modele:
			modele.action("rechargement", arme.duree_recharge)


func vitesse_horizontale() -> float:
	return Vector2(velocity.x, velocity.z).length()


func _physics_process(dt: float) -> void:
	horloge += dt
	maj_statuts(dt)
	if not vivant:
		temps_mort += dt
		velocity.x = move_toward(velocity.x, 0.0, 20.0 * dt)
		velocity.z = move_toward(velocity.z, 0.0, 20.0 * dt)
		velocity.y -= GRAVITE * dt
		move_and_slide()
		return
	var actif := controle and (Input.mouse_mode == Input.MOUSE_MODE_CAPTURED or Test.actif)
	_regarder(dt, actif)
	if actif:
		_touches_action()
	_deplacer(dt, actif)
	_armes(dt, actif)


func _regarder(dt: float, actif: bool) -> void:
	var sens := float(Reglages.lire("sensibilite")) * DEG_PAR_PIXEL
	var zoom := zoom_actuel()
	if zoom > 1.05:
		sens *= float(Reglages.lire("sensibilite_visee")) / zoom
	var m := souris_image if actif else Vector2.ZERO
	souris_image = Vector2.ZERO
	# Manette
	var stick := Input.get_vector("regard_gauche", "regard_droite", "regard_haut", "regard_bas") if InputMap.has_action("regard_gauche") else Vector2.ZERO
	m += stick * 900.0 * dt * float(Reglages.lire("sensibilite_manette"))
	var inv := -1.0 if Reglages.lire("inverser_y") else 1.0
	regard.y -= deg_to_rad(m.x * sens)
	regard.x -= deg_to_rad(m.y * sens) * inv
	regard.x = clampf(regard.x, deg_to_rad(-88.0), deg_to_rad(88.0))
	if vue:
		vue.set_meta("souris", m)
	# Recul : une partie déplace la caméra (punch), le reste ne dévie que les balles
	var r := arme.recul if arme else Vector2.ZERO
	punch = punch.lerp(r * 0.55, 1.0 - exp(-30.0 * dt))
	secousse = maxf(0.0, secousse - dt * 6.0)
	var bruit := Vector2(randf_range(-1, 1), randf_range(-1, 1)) * secousse * 0.6
	rotation = Vector3(0, regard.y, 0)
	tete.rotation = Vector3(regard.x + deg_to_rad(punch.x + bruit.x), deg_to_rad(punch.y + bruit.y), deg_to_rad(bruit.x * 0.5))
	# Hauteur des yeux selon l'accroupissement, et petit tassement à l'atterrissage
	accroupi_k = move_toward(accroupi_k, 1.0 if accroupi else 0.0, dt * 7.0)
	hauteur_yeux = lerpf(YEUX_DEBOUT, YEUX_ACCROUPI, accroupi_k)
	atterrissage = move_toward(atterrissage, 0.0, dt * 3.0)
	tete.position.y = hauteur_yeux - atterrissage * 0.12
	var fov := float(Reglages.lire("fov"))
	cam.fov = fov / zoom


func zoom_actuel() -> float:
	if not arme or not vue:
		return 1.0
	var z: float = arme.def.get("zoom", 1.0)
	return lerpf(1.0, z, vue.visee_k)


func _deplacer(dt: float, actif: bool) -> void:
	var entree := Input.get_vector("gauche", "droite", "avancer", "reculer") if actif else Vector2.ZERO
	var veut_accroupi := actif and Input.is_action_pressed("accroupi")
	if veut_accroupi != accroupi:
		if veut_accroupi or _place_pour_se_lever():
			accroupi = veut_accroupi
			capsule.height = HAUTEUR_ACCROUPI if accroupi else HAUTEUR_DEBOUT
			forme.position.y = capsule.height * 0.5
	var dir := (transform.basis * Vector3(entree.x, 0, entree.y))
	dir.y = 0
	if dir.length() > 1.0:
		dir = dir.normalized()
	var def_vit: float = arme.def.get("vitesse", 4.5) if arme else 4.5
	var vmax := def_vit * 1.18 * (1.0 + bonus_vitesse)
	var sprint := actif and Input.is_action_pressed("sprint") and entree.y < -0.3 and not accroupi and sprint_bloque <= 0.0 and not vise
	if sprint:
		vmax *= SPRINT
	if accroupi:
		vmax *= VITESSE_ACCROUPI
	if vise:
		vmax *= 0.72
	if statut("ralenti") > 0.0:
		vmax *= 0.55
	set_meta("sprint", sprint and vitesse_horizontale() > 1.0)
	var horiz := Vector3(velocity.x, 0, velocity.z)
	if is_on_floor():
		# Frottement puis accélération vers la vitesse voulue
		var v := horiz.length()
		if v > 0.0:
			var baisse := maxf(v, 2.0) * FRICTION * dt
			horiz *= maxf(v - baisse, 0.0) / v
		var cible := dir * vmax
		horiz = horiz.move_toward(cible, ACCEL_SOL * dt) if dir != Vector3.ZERO else horiz
		if actif and Input.is_action_just_pressed("saut") and statut("ancre") <= 0.0:
			velocity.y = SAUT
			Sons.jouer("saut", -10.0)
		else:
			velocity.y = minf(velocity.y, 0.0)
	else:
		# Contrôle limité en l'air
		var cible := dir * vmax
		var ajout := cible - horiz.project(cible.normalized()) if dir != Vector3.ZERO else Vector3.ZERO
		horiz += ajout.limit_length(ACCEL_AIR * dt)
		velocity.y -= GRAVITE * dt
		vitesse_chute = minf(vitesse_chute, velocity.y)
	velocity.x = horiz.x
	velocity.z = horiz.z
	move_and_slide()
	# Atterrissage et bruits de pas
	var au_sol := is_on_floor()
	if au_sol and not etait_au_sol:
		var force := clampf(-vitesse_chute / 12.0, 0.0, 1.0)
		atterrissage = force
		if vue:
			vue.set_meta("atterrissage", force)
		if force > 0.25:
			_pas(1.0, true)
		vitesse_chute = 0.0
	etait_au_sol = au_sol
	var v := vitesse_horizontale()
	if au_sol and v > 2.6 and not accroupi:
		pas_t -= dt * v
		if pas_t <= 0.0:
			pas_t = 2.1
			_pas(v / 6.0, false)


func _place_pour_se_lever() -> bool:
	var p := PhysicsShapeQueryParameters3D.new()
	var s := CapsuleShape3D.new()
	s.radius = capsule.radius - 0.02
	s.height = HAUTEUR_DEBOUT
	p.shape = s
	p.transform = Transform3D(Basis.IDENTITY, global_position + Vector3(0, HAUTEUR_DEBOUT * 0.5 + 0.04, 0))
	p.collision_mask = COUCHE_MONDE
	p.exclude = [get_rid()]
	return get_world_3d().direct_space_state.intersect_shape(p, 1).is_empty()


func matiere_sol() -> String:
	var q := PhysicsRayQueryParameters3D.create(global_position + Vector3.UP * 0.2, global_position + Vector3.DOWN * 0.4, COUCHE_MONDE, [get_rid()])
	var r := get_world_3d().direct_space_state.intersect_ray(q)
	if r.is_empty():
		return "beton"
	return Combattant.matiere_de(r["collider"])


func _pas(force: float, atterrir: bool) -> void:
	var m := matiere_sol()
	var nom := "pas_" + m if Sons.existe("pas_" + m) else "pas_beton"
	Sons.jouer(nom, -14.0 + force * 6.0 + (4.0 if atterrir else 0.0), randf_range(0.92, 1.08))


func _armes(dt: float, actif: bool) -> void:
	if not arme:
		return
	arme.maj(dt, horloge)
	pret_t = maxf(0.0, pret_t - dt)
	sprint_bloque = maxf(0.0, sprint_bloque - dt)
	# Début de rechargement automatique (chargeur vide)
	if arme.en_recharge() and not etait_en_recharge:
		vise = false
		if vue:
			vue.recharger(arme.recharge_vide, arme.duree_recharge)
	etait_en_recharge = arme.en_recharge()
	var melee := arme.type == "melee"
	var tir := actif and Input.is_action_pressed("tir")
	var tir2 := actif and Input.is_action_pressed("viser")
	if not tir:
		gachette_relachee = true
	# Visée (clic droit) ; pour le couteau, clic droit = coup lourd
	vise = tir2 and not melee and not arme.en_recharge() and pret_t <= 0.0 and not bool(get_meta("sprint", false))
	var en_sprint := bool(get_meta("sprint", false))
	var en_l_air := not is_on_floor()
	ecart_actuel = arme.imprecision(vitesse_horizontale(), en_l_air, accroupi, vise, statut("commotion") > 0.0)
	if pret_t <= 0.0:
		if melee:
			if (tir or tir2) and arme.peut_tirer(horloge, true):
				_coup_couteau(tir2 and not tir)
		elif tir:
			if arme.mun <= 0 and not arme.en_recharge() and gachette_relachee:
				Sons.jouer("vide", -6.0)
				gachette_relachee = false
				_recharger()
			elif arme.peut_tirer(horloge, gachette_relachee):
				if en_sprint:
					sprint_bloque = 0.25
				_tirer()
				gachette_relachee = false
	animer_modele(is_on_floor(), accroupi, en_sprint)
	if vue:
		vue.amplitude_bob = float(Reglages.lire("balancement"))
		var souris: Vector2 = vue.get_meta("souris", Vector2.ZERO)
		var att: float = vue.get_meta("atterrissage", 0.0)
		vue.set_meta("atterrissage", 0.0)
		vue.maj(dt, {
			"vitesse": vitesse_horizontale(), "au_sol": is_on_floor(), "vise": vise,
			"sprint": en_sprint, "souris": souris, "mun": arme.mun, "recharge": arme.en_recharge(),
			"atterrissage": att,
		})


## Direction de tir : regard + recul complet + décalage de dispersion (radians)
func direction_tir(decalage: Vector2) -> Vector3:
	var r := arme.recul
	var b := Basis.from_euler(Vector3(regard.x + deg_to_rad(r.x), regard.y + deg_to_rad(r.y), 0))
	return (b * Vector3(tan(decalage.x), tan(decalage.y), -1.0)).normalized()


func _exclusions() -> Array[RID]:
	var ex: Array[RID] = [get_rid()]
	for z in zones_touche:
		ex.append(z.get_rid())
	return ex


func _tirer() -> void:
	var id := arme.id
	var def := arme.def
	var decalages := arme.tirer(horloge, ecart_actuel, vise)
	vue.tir()
	a_tire.emit(id)
	Sons.jouer("tir_" + id, -2.0, randf_range(0.97, 1.03))
	if Jeu.partie:
		Jeu.partie.bruit(global_position, 45.0, self)
	if modele:
		modele.action("tir")
	secousse = minf(1.0, secousse + float(VueArme.RECUL.get(id, 1.0)) * 0.12)
	var origine := cam.global_position
	var depart_trace := origine + cam.global_transform.basis * Vector3(0.12, -0.1, -0.6)
	if vue.size.x > 1.0 and vue.size.y > 1.0:
		depart_trace = cam.project_position(vue.position_bouche_ecran() * (get_viewport().get_visible_rect().size / vue.size), 0.9)
	var espace := get_world_3d().direct_space_state
	var ex := _exclusions()
	var couleur := Color(def.get("couleur_trace", "#ffe9b8"))
	var touches_par_cible := {}
	var n := 0
	for d in decalages:
		var dir := direction_tir(d)
		var q := PhysicsRayQueryParameters3D.create(origine, origine + dir * 220.0, MASQUE_TIR, ex)
		q.collide_with_areas = true
		q.collide_with_bodies = true
		var r := espace.intersect_ray(q)
		var fin := origine + dir * 220.0
		if not r.is_empty():
			fin = r["position"]
			var c: Object = r["collider"]
			if c is Area3D and c.has_meta("combattant"):
				var victime: Combattant = c.get_meta("combattant")
				var partie: String = c.get_meta("partie")
				var deg: float = float(def["degats"][partie]) * DonneesArmes.facteur_distance(def, origine.distance_to(fin))
				if not touches_par_cible.has(victime):
					touches_par_cible[victime] = {"degats": 0.0, "tete": false, "pos": fin}
				touches_par_cible[victime]["degats"] += deg
				touches_par_cible[victime]["tete"] = touches_par_cible[victime]["tete"] or partie == "tete"
				effets.touche_combattant(fin, r["normal"], partie == "tete", victime.armure > 0.0)
			else:
				effets.impact(fin, r["normal"], Combattant.matiere_de(c), couleur)
		# Traçante : une sur deux pour les rafales, toutes pour les armes lourdes ; pas de traçante en visée lunette
		if not (def.get("lunette", false) and vise) and (decalages.size() > 1 or arme.serie <= 1.0 or int(arme.serie) % 2 == 0):
			if n < 4:
				effets.trace(depart_trace, fin, couleur, 0.03 if id == "sniper" else (0.022 if id == "pulsar" else 0.016))
		n += 1
	for victime in touches_par_cible:
		var t: Dictionary = touches_par_cible[victime]
		infliger(victime, t["degats"], t["tete"], id, t["pos"])


## Applique des dégâts (passe par la partie, qui gère le réseau, le score et les éliminations)
func infliger(victime: Combattant, degats: float, tete_touchee: bool, id_arme: String, pos: Vector3) -> void:
	if not is_instance_valid(victime) or not victime.vivant:
		return
	var p: Node = Jeu.partie
	var mortel := false
	if p and p.has_method("infliger"):
		mortel = p.infliger(self, victime, degats, tete_touchee, id_arme, pos)
	else:
		victime.appliquer_degats(degats)
		mortel = victime.vie <= 0.0
		if mortel:
			victime.vivant = false
	touche_infligee.emit(victime, degats, tete_touchee, mortel)
	Sons.jouer("touche_tete" if tete_touchee else "touche", -4.0 if tete_touchee else -8.0)


func _coup_couteau(lourd: bool) -> void:
	var def := arme.def
	arme.tirer(horloge, 0.0, false, lourd)
	vue.tir(lourd)
	Sons.jouer("couteau_lourd" if lourd else "couteau", -4.0, randf_range(0.95, 1.05))
	# Le coup part un peu après le début de l'animation
	await get_tree().create_timer(0.12 if not lourd else 0.3).timeout
	if not vivant:
		return
	var origine := cam.global_position
	var espace := get_world_3d().direct_space_state
	var ex := _exclusions()
	for ang in [0.0, -0.12, 0.12, 0.06, -0.06]:
		var dir := (cam.global_transform.basis * Vector3(ang, -0.03, -1.0)).normalized()
		var q := PhysicsRayQueryParameters3D.create(origine, origine + dir * float(def["portee"]), MASQUE_TIR, ex)
		q.collide_with_areas = true
		var r := espace.intersect_ray(q)
		if r.is_empty():
			continue
		var c: Object = r["collider"]
		if c is Area3D and c.has_meta("combattant"):
			var victime: Combattant = c.get_meta("combattant")
			# Coup dans le dos : dégâts doublés
			var dos := victime.direction_regard().dot(dir) > 0.5
			var deg: float = def["degats_lourd" if lourd else "degats_leger"] * (2.0 if dos else 1.0)
			effets.touche_combattant(r["position"], r["normal"], false, victime.armure > 0.0)
			infliger(victime, deg, false, "couteau", r["position"])
		else:
			effets.impact(r["position"], r["normal"], Combattant.matiere_de(c), Color(1, 0.8, 0.5), false)
			Sons.jouer_3d("couteau_mur", r["position"], -4.0)
		return


func mourir() -> void:
	vivant = false
	controle = false
	vise = false
	temps_mort = 0.0
	if vue:
		vue.visible = false
	capsule.height = 0.6
	forme.position.y = 0.3
	var tw := create_tween()
	tw.tween_property(tete, "position:y", 0.35, 0.6).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tw.parallel().tween_property(tete, "rotation:z", 0.5, 0.6)
	activer_zones(false)


func reapparaitre(t: Transform3D) -> void:
	global_transform = Transform3D(Basis.IDENTITY, t.origin)
	regard = Vector2(0, t.basis.get_euler().y)
	velocity = Vector3.ZERO
	vie = 100.0
	vivant = true
	controle = true
	accroupi = false
	capsule.height = HAUTEUR_DEBOUT
	forme.position.y = HAUTEUR_DEBOUT * 0.5
	tete.rotation = Vector3.ZERO
	reinitialiser_statuts()
	activer_zones(true)
	if vue:
		vue.visible = true
		choisir_emplacement(1 if inventaire[1] != "" else 2, true)
