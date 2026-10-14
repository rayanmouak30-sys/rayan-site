class_name Perso3D
extends Node3D
## Modèle 3D d'un héros : maillage du personnage, animations partagées (assets/persos/animations.glb),
## arme tenue en main droite (os "arme_<id>"), skin et couleur d'équipe. Utilisé en jeu et dans les menus.

const ANIMATIONS := "res://assets/persos/animations.glb"
const BOUCLES := ["repos", "course", "accroupi", "sprint", "chute", "vitrine"]

static var _bibliotheque: AnimationLibrary

var id_heros := ""
var skin := "standard"
var equipe := ""
var modele: Node3D
var squelette: Skeleton3D
var ap: AnimationPlayer
var arme_id := ""
var arme_noeud: Node3D
var attache: BoneAttachment3D
var anim_courante := ""
var modele_couches := 1
var arbre: AnimationTree
var etat := "sol"
var bs_sol: AnimationNodeBlendSpace2D
var bs_accroupi: AnimationNodeBlendSpace2D
var noeuds_anim := {}        # nom logique -> AnimationNodeAnimation (pour changer d'arme)

const HAUT_DU_CORPS := ["ventre", "torse", "cou", "tete", "clavicule_d", "clavicule_g", "bras_d", "bras_g", "avantbras_d", "avantbras_g",
	"main_d", "main_g", "doigts1_d", "doigts1_g", "doigts2_d", "doigts2_g", "pouce1_d", "pouce1_g", "pouce2_d", "pouce2_g"]


static func bibliotheque() -> AnimationLibrary:
	if _bibliotheque:
		return _bibliotheque
	var chemin := ANIMATIONS if ResourceLoader.exists(ANIMATIONS) else "res://assets/persos/animations_test.glb"
	var n: Node = (load(chemin) as PackedScene).instantiate()
	var ap_source: AnimationPlayer = n.find_child("AnimationPlayer", true, false)
	_bibliotheque = AnimationLibrary.new()
	for nom in ap_source.get_animation_list():
		var a: Animation = ap_source.get_animation(nom).duplicate()
		for mot in BOUCLES:
			if String(nom).contains(mot):
				a.loop_mode = Animation.LOOP_LINEAR
		_bibliotheque.add_animation(nom, a)
	n.free()
	return _bibliotheque


func charger(id: String, id_skin := "standard", eq := "") -> void:
	if modele:
		modele.queue_free()
	id_heros = id
	skin = id_skin
	equipe = eq
	var chemin := "res://assets/persos/%s.glb" % id
	modele = (load(chemin) as PackedScene).instantiate()
	add_child(modele)
	var h := DonneesHeros.heros(id)
	scale = Vector3.ONE * float(h["apparence"].get("taille", 1.0))
	squelette = modele.find_children("*", "Skeleton3D", true, false)[0]
	ap = AnimationPlayer.new()
	ap.name = "AnimationPlayer"
	modele.add_child(ap)
	ap.root_node = NodePath("..")
	ap.add_animation_library("", bibliotheque())
	ap.playback_default_blend_time = 0.15
	Skins.appliquer_heros(modele, id, id_skin, eq)
	definir_couches(modele_couches)
	attache = null
	arme_noeud = null
	if arme_id != "":
		var a := arme_id
		arme_id = ""
		tenir(a)


## Couches de rendu (le modèle du joueur local n'est vu que par les ombres et les autres joueurs)
func definir_couches(c: int, ombres_seules := false) -> void:
	modele_couches = c
	for n in [modele, arme_noeud]:
		if n == null:
			continue
		for mi in (n as Node).find_children("*", "MeshInstance3D", true, false):
			(mi as MeshInstance3D).layers = c
			(mi as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY if ombres_seules else GeometryInstance3D.SHADOW_CASTING_SETTING_ON


func appliquer_skin(id_skin: String, eq := "") -> void:
	skin = id_skin
	equipe = eq
	Skins.appliquer_heros(modele, id_heros, id_skin, eq)


## Prend une arme en main (modèle arme_<id>.glb attaché à l'os "arme_<id>")
func tenir(id: String, id_skin_arme := "") -> void:
	if id == arme_id and arme_noeud:
		return
	arme_id = id
	if attache:
		attache.queue_free()
	attache = BoneAttachment3D.new()
	attache.bone_name = "arme_" + id
	squelette.add_child(attache)
	var chemin := "res://assets/armes/arme_%s.glb" % id
	arme_noeud = (load(chemin) as PackedScene).instantiate()
	# Le repère des os garde la convention Blender (Y le long de l'os) : on ramène l'arme (convertie en Y haut)
	arme_noeud.basis = Basis(Vector3.RIGHT, PI / 2)
	attache.add_child(arme_noeud)
	Skins.appliquer_arme(arme_noeud, id_skin_arme if id_skin_arme != "" else "standard")
	for mi in arme_noeud.find_children("*", "MeshInstance3D", true, false):
		(mi as MeshInstance3D).layers = modele_couches
	if arbre:
		_actualiser_noms()


func a_animation(nom: String) -> bool:
	return ap != null and ap.has_animation(nom)


## Joue une animation ; "nom" sans préfixe d'arme est complété (ex. "repos" -> "fusil_repos")
func jouer(nom: String, fondu := 0.15, vitesse := 1.0, depuis_debut := false) -> void:
	var complet := nom
	if not ap.has_animation(complet):
		complet = arme_id + "_" + nom
	if not ap.has_animation(complet):
		complet = "fusil_" + nom
	if not ap.has_animation(complet):
		return
	if complet == anim_courante and not depuis_debut:
		ap.speed_scale = vitesse
		return
	anim_courante = complet
	ap.play(complet, fondu, 1.0)
	ap.speed_scale = vitesse
	if depuis_debut:
		ap.seek(0.0, true)


## Arbre d'animation : locomotion (sol / accroupi en espaces de mélange 2D, sprint, air, mort)
## + action du haut du corps (tir, rechargement, équiper, touché) en "one shot" filtré.
func preparer_arbre() -> void:
	if arbre:
		arbre.queue_free()
	arbre = AnimationTree.new()
	arbre.name = "Arbre"
	modele.add_child(arbre)
	arbre.root_node = NodePath("..")
	arbre.anim_player = arbre.get_path_to(ap)
	var bt := AnimationNodeBlendTree.new()
	noeuds_anim.clear()
	bs_sol = _espace(["repos", "course_av", "course_ar", "course_g", "course_d"], "sol")
	bs_accroupi = _espace(["accroupi", "accroupi_av", "accroupi_ar", "accroupi_g", "accroupi_d"], "accr")
	var transition := AnimationNodeTransition.new()
	transition.xfade_time = 0.18
	for e in ["sol", "accroupi", "sprint", "air", "mort"]:
		transition.add_input(e)
	bt.add_node("etat", transition)
	bt.add_node("sol", bs_sol)
	bt.add_node("accroupi", bs_accroupi)
	bt.add_node("sprint", _anim("sprint"))
	bt.add_node("air", _anim("chute"))
	bt.add_node("mort", _anim("mort_avant", true))
	for i in 5:
		bt.connect_node("etat", i, ["sol", "accroupi", "sprint", "air", "mort"][i])
	var vitesse := AnimationNodeTimeScale.new()
	bt.add_node("vitesse", vitesse)
	bt.connect_node("vitesse", 0, "etat")
	var os := AnimationNodeOneShot.new()
	os.fadein_time = 0.06
	os.fadeout_time = 0.15
	os.filter_enabled = true
	for b in HAUT_DU_CORPS:
		os.set_filter_path(NodePath("Squelette/Skeleton3D:" + b), true)
	bt.add_node("action", os)
	bt.add_node("anim_action", _anim("tir"))
	bt.add_node("vitesse_action", AnimationNodeTimeScale.new())
	bt.connect_node("vitesse_action", 0, "anim_action")
	bt.connect_node("action", 0, "vitesse")
	bt.connect_node("action", 1, "vitesse_action")
	bt.connect_node("output", 0, "action")
	arbre.tree_root = bt
	arbre.active = true
	etat = "sol"


func _anim(nom: String, absolu := false) -> AnimationNodeAnimation:
	var a := AnimationNodeAnimation.new()
	a.animation = _complet(nom) if not absolu else nom
	noeuds_anim[nom] = a
	return a


func _espace(noms: Array, prefixe: String) -> AnimationNodeBlendSpace2D:
	var bs := AnimationNodeBlendSpace2D.new()
	bs.blend_mode = AnimationNodeBlendSpace2D.BLEND_MODE_INTERPOLATED
	var pos := [Vector2(0, 0), Vector2(0, 1), Vector2(0, -1), Vector2(-1, 0), Vector2(1, 0)]
	for i in noms.size():
		bs.add_blend_point(_anim(noms[i]), pos[i], -1, StringName("%s_%s" % [prefixe, noms[i]]))
	bs.min_space = Vector2(-1.2, -1.2)
	bs.max_space = Vector2(1.2, 1.2)
	bs.sync = true
	return bs


func _complet(nom: String) -> String:
	for n in [arme_id + "_" + nom, "fusil_" + nom, nom]:
		if ap.has_animation(n):
			return n
	return ""


## Met à jour les noms d'animation après un changement d'arme
func _actualiser_noms() -> void:
	for nom in noeuds_anim:
		if nom.begins_with("mort"):
			continue
		(noeuds_anim[nom] as AnimationNodeAnimation).animation = _complet(nom)


## Locomotion : vitesse locale (x droite, y avant, en m/s), état "sol", "accroupi", "sprint", "air"
func maj_locomotion(v_locale: Vector2, nouvel_etat: String) -> void:
	if arbre == null or etat == "mort":
		return
	if nouvel_etat != etat:
		etat = nouvel_etat
		arbre.set("parameters/etat/transition_request", etat)
	var vit := 1.0
	if etat == "sol":
		var p := v_locale / 5.3
		arbre.set("parameters/sol/blend_position", p.limit_length(1.0))
		vit = clampf(v_locale.length() / 5.3, 0.6, 1.4) if v_locale.length() > 0.4 else 1.0
	elif etat == "accroupi":
		var p := v_locale / 2.6
		arbre.set("parameters/accroupi/blend_position", p.limit_length(1.0))
		vit = clampf(v_locale.length() / 2.6, 0.6, 1.4) if v_locale.length() > 0.3 else 1.0
	elif etat == "sprint":
		vit = clampf(v_locale.length() / 7.0, 0.7, 1.3)
	arbre.set("parameters/vitesse/scale", vit)


## Action du haut du corps : "tir", "rechargement", "equiper", "touche"
func action(nom: String, duree_voulue := 0.0) -> void:
	if arbre == null or etat == "mort":
		return
	var complet := _complet(nom)
	if complet == "":
		return
	var a := noeuds_anim["tir"] as AnimationNodeAnimation
	a.animation = complet
	var vit := 1.0
	if duree_voulue > 0.0:
		vit = ap.get_animation(complet).length / duree_voulue
	arbre.set("parameters/vitesse_action/scale", vit)
	arbre.set("parameters/action/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FIRE)


func mourir_anim(sens: String) -> void:
	if arbre == null:
		return
	(noeuds_anim["mort_avant"] as AnimationNodeAnimation).animation = "mort_" + sens
	arbre.set("parameters/action/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_ABORT)
	etat = "mort"
	arbre.set("parameters/etat/transition_request", "mort")
	arbre.set("parameters/vitesse/scale", 1.0)


func ressusciter() -> void:
	if arbre == null:
		return
	etat = "sol"
	arbre.set("parameters/etat/transition_request", "sol")


## Position mondiale de la bouche du canon (traçantes des autres combattants)
func bouche() -> Vector3:
	if arme_noeud:
		var r: Node3D = arme_noeud.find_child("Repere_bouche", true, false)
		if r:
			return r.global_position
	return global_position + Vector3(0, 1.4, 0)


func os_global(nom: String) -> Vector3:
	var i := squelette.find_bone(nom)
	if i < 0:
		return global_position
	return squelette.global_transform * squelette.get_bone_global_pose(i).origin
