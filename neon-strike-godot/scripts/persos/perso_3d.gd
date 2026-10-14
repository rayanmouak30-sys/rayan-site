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
	for mi in modele.find_children("*", "MeshInstance3D", true, false):
		(mi as MeshInstance3D).layers = 2
	attache = null
	arme_noeud = null
	if arme_id != "":
		var a := arme_id
		arme_id = ""
		tenir(a)


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
