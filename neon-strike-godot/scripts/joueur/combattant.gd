class_name Combattant
extends CharacterBody3D
## Base commune au joueur et aux bots : vie, bouclier, équipe, personnage, zones de touche, statuts des capacités.

signal elimine(victime: Combattant, tueur: Combattant, tete: bool, arme: String)
signal touche_recu(degats: float, auteur: Combattant, tete: bool)

const COUCHE_MONDE := 1
const COUCHE_COMBATTANTS := 2
const COUCHE_TOUCHES := 4
const COUCHE_OBJETS := 8
const MASQUE_TIR := COUCHE_MONDE | COUCHE_TOUCHES | COUCHE_OBJETS

var nom_affiche := "Joueur"
var equipe := "bleu"
var heros := "kael"
var skin := "standard"
var vie := 100.0
var armure := 0.0
var vivant := true
var est_joueur := false
var hauteur_yeux := 1.62
var taille := 1.0                 # échelle du personnage (les zones de touche suivent)

# Statistiques de la partie
var kills := 0
var morts := 0
var tetes := 0
var assists := 0
var degats_infliges := 0.0
var credits := 800
var ultime := 0
var capacites := {}               # état des capacités (charges, recharges)

# Statuts appliqués par les capacités (temps restant en secondes)
var statuts := {}
var bonus_vitesse := 0.0
var bonus_cadence := 0.0
var soin_restant := 0.0
var soin_taux := 0.0
var revele := 0.0
var aveugle := 0.0
var aveugle_max := 1.0

var zones_touche: Array[Area3D] = []
var modele: Perso3D
var arme_tenue := ""


## Choisit le héros (taille, zones de touche) et crée son modèle 3D
func definir_heros(id: String, id_skin := "standard", couches := 1, ombres_seules := false) -> void:
	heros = id
	skin = id_skin
	var h := DonneesHeros.heros(id)
	taille = float(h["apparence"].get("taille", 1.0))
	hauteur_yeux = 1.62 * taille
	creer_zones_touche()
	if modele:
		modele.queue_free()
	modele = Perso3D.new()
	modele.name = "Modele"
	add_child(modele)
	modele.modele_couches = couches
	modele.arme_id = arme_tenue if arme_tenue != "" else String(h.get("arme", "fusil"))
	modele.charger(id, id_skin, equipe)
	modele.preparer_arbre()
	modele.definir_couches(couches, ombres_seules)


func tenir_arme(id: String) -> void:
	arme_tenue = id
	if modele:
		modele.tenir(id, Profil.skin_arme(id) if est_joueur else "standard")
		modele.action("equiper")


## Animation selon le déplacement (vitesse locale) et l'état
func animer_modele(au_sol: bool, accroupi: bool, sprint: bool) -> void:
	if modele == null or not vivant:
		return
	var v := global_transform.basis.inverse() * velocity
	var vl := Vector2(v.x, -v.z)
	var e := "sol"
	if not au_sol:
		e = "air"
	elif sprint and vl.y > 3.0:
		e = "sprint"
	elif accroupi:
		e = "accroupi"
	modele.maj_locomotion(vl, e)


func _ready() -> void:
	collision_layer = COUCHE_COMBATTANTS
	collision_mask = COUCHE_MONDE | COUCHE_COMBATTANTS | COUCHE_OBJETS
	creer_zones_touche()


## Zones de touche : tête (sphère), corps et jambes (capsules), sur la couche "touches"
func creer_zones_touche() -> void:
	for z in zones_touche:
		z.queue_free()
	zones_touche.clear()
	var defs := [
		["tete", SphereShape3D.new(), Vector3(0, 1.63 * taille, 0.02)],
		["corps", CapsuleShape3D.new(), Vector3(0, 1.18 * taille, 0)],
		["jambes", CapsuleShape3D.new(), Vector3(0, 0.45 * taille, 0)],
	]
	(defs[0][1] as SphereShape3D).radius = 0.15 * taille
	(defs[1][1] as CapsuleShape3D).radius = 0.27 * taille
	(defs[1][1] as CapsuleShape3D).height = 0.75 * taille
	(defs[2][1] as CapsuleShape3D).radius = 0.22 * taille
	(defs[2][1] as CapsuleShape3D).height = 0.9 * taille
	for d in defs:
		var z := Area3D.new()
		z.name = "Touche_" + d[0]
		z.collision_layer = COUCHE_TOUCHES
		z.collision_mask = 0
		z.monitoring = false
		z.monitorable = true
		z.set_meta("partie", d[0])
		z.set_meta("combattant", self)
		var cs := CollisionShape3D.new()
		cs.shape = d[1]
		cs.position = d[2]
		z.add_child(cs)
		add_child(z)
		zones_touche.append(z)


func activer_zones(actif: bool) -> void:
	for z in zones_touche:
		z.monitorable = actif
		for c in z.get_children():
			(c as CollisionShape3D).disabled = not actif


func yeux() -> Vector3:
	return global_position + Vector3(0, hauteur_yeux, 0)


## Direction du regard (unitaire)
func direction_regard() -> Vector3:
	return -global_transform.basis.z


## Le bouclier encaisse 66 % des dégâts tant qu'il en reste ; renvoie les dégâts réellement infligés
func appliquer_degats(degats: float) -> float:
	var absorbe := minf(armure, degats * 0.66)
	armure -= absorbe
	var reel := minf(vie, degats - absorbe)
	vie -= degats - absorbe
	return reel + absorbe


func reinitialiser_statuts() -> void:
	statuts.clear()
	bonus_vitesse = 0.0
	bonus_cadence = 0.0
	soin_restant = 0.0
	soin_taux = 0.0
	revele = 0.0
	aveugle = 0.0


func statut(nom: String) -> float:
	return float(statuts.get(nom, 0.0))


func appliquer_statut(nom: String, duree: float) -> void:
	statuts[nom] = maxf(statut(nom), duree)


func maj_statuts(dt: float) -> void:
	for k in statuts.keys():
		statuts[k] = maxf(0.0, float(statuts[k]) - dt)
	if statut("vitesse") <= 0.0:
		bonus_vitesse = 0.0
	if statut("cadence") <= 0.0:
		bonus_cadence = 0.0
	revele = maxf(0.0, revele - dt)
	aveugle = maxf(0.0, aveugle - dt)
	if soin_restant > 0.0 and vivant:
		var s := minf(soin_restant, soin_taux * dt)
		soin_restant -= s
		vie = minf(100.0, vie + s)


func invisible() -> bool:
	return statut("camo") > 0.0 and statut("camo_revele") <= 0.0


func ajouter_soin(total: float, duree: float) -> void:
	soin_restant += total
	soin_taux = maxf(soin_taux, total / maxf(0.1, duree))


## Matière d'une surface touchée (méta "matiere" sur le corps ou son parent) : beton, metal, bois, verre, terre, vegetal
static func matiere_de(o: Object) -> String:
	if o == null:
		return "beton"
	if o.has_meta("matiere"):
		return o.get_meta("matiere")
	if o is Node and (o as Node).get_parent() and (o as Node).get_parent().has_meta("matiere"):
		return (o as Node).get_parent().get_meta("matiere")
	return "beton"
