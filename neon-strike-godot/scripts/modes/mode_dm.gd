extends Mode
## Combat à mort par équipe : 5 contre 5, réapparition après 3 s, première équipe à 40 éliminations
## ou meilleure équipe après 8 minutes. Toutes les armes, sans économie.

const OBJECTIF := 40
const DUREE := 480.0
const REAPPARITION := 3.0

var fini := false
var attente := {}       # combattant -> temps avant réapparition


func demarrer() -> void:
	demarre = true
	minuteur = DUREE
	var j := partie.joueur
	j.donner_arme(Jeu.config.get("arme", DonneesHeros.heros(j.heros).get("arme", "fusil")))
	j.credits = -1
	remplir_bots()
	# La navigation doit être prête (première synchronisation) avant de choisir les points
	await partie.attendre_navigation()
	for c in partie.combattants:
		_placer(c)
	partie.annoncer("COMBAT À MORT", "Première équipe à %d éliminations" % OBJECTIF, Style.ACCENT, 3.0)


## Point d'apparition le plus éloigné des ennemis
func _placer(c: Combattant) -> void:
	var points: Array = partie.carte.apparitions.get(c.equipe, partie.carte.apparitions.get("bleu"))
	var candidats := points.duplicate()
	# Ajoute des points dans toute la carte (zones praticables)
	var map := partie.get_world_3d().navigation_map
	for z in partie.carte.zones:
		var a: AABB = z[1]
		var p := NavigationServer3D.map_get_closest_point(map, a.get_center())
		if p != Vector3.ZERO:
			candidats.append(Transform3D(Basis(Vector3.UP, randf() * TAU), p + Vector3(0, 0.1, 0)))
	var meilleur: Transform3D = candidats[0]
	var meilleur_score := -1e9
	for t in candidats:
		var tt: Transform3D = t
		var dmin := 1e9
		for e in partie.combattants:
			if e != c and e.vivant and e.equipe != c.equipe:
				dmin = minf(dmin, e.global_position.distance_to(tt.origin))
		var score := minf(dmin, 40.0) + randf() * 8.0
		if score > meilleur_score:
			meilleur_score = score
			meilleur = tt
	if c is Joueur:
		(c as Joueur).reapparaitre(meilleur)
	elif c is JoueurDistant:
		(c as JoueurDistant).reapparaitre(meilleur)
	elif c is Bot:
		(c as Bot).reapparaitre(meilleur)
		_nouvel_objectif(c as Bot)


func etat_reseau() -> Dictionary:
	return {"hud": partie.dernier_hud, "phase": "combat"}


func _nouvel_objectif(b: Bot) -> void:
	var zones: Array = partie.carte.zones
	if zones.is_empty():
		return
	var z: Array = zones[randi() % zones.size()]
	var map := partie.get_world_3d().navigation_map
	b.objectif = NavigationServer3D.map_get_closest_point(map, (z[1] as AABB).get_center())


func _process(dt: float) -> void:
	if fini or not demarre:
		return
	minuteur -= dt
	for c in attente.keys():
		attente[c] -= dt
		if attente[c] <= 0.0:
			attente.erase(c)
			if is_instance_valid(c):
				_placer(c)
	# Les bots changent d'objectif une fois arrivés
	for c in partie.combattants:
		if c is Bot and c.vivant and (c as Bot).etat == "objectif" and c.global_position.distance_to((c as Bot).objectif) < 3.0:
			_nouvel_objectif(c as Bot)
	partie.maj_partie(minuteur, score["bleu"], score["rouge"], "OBJECTIF %d" % OBJECTIF, minuteur < 30.0)
	if is_instance_valid(partie.joueur) and not partie.joueur.vivant and attente.has(partie.joueur):
		partie.hud.montrer_mort("Réapparition dans %d" % ceili(attente[partie.joueur]))
	else:
		partie.hud.montrer_mort("")
	if minuteur <= 0.0 or score["bleu"] >= OBJECTIF or score["rouge"] >= OBJECTIF:
		_fin()


func sur_elimination(victime: Combattant, tueur: Combattant, _tete: bool, _arme: String) -> void:
	if tueur and tueur.equipe != victime.equipe:
		score[tueur.equipe] += 1
	attente[victime] = REAPPARITION


func _fin() -> void:
	fini = true
	var gagnant := "bleu" if score["bleu"] > score["rouge"] else ("rouge" if score["rouge"] > score["bleu"] else "")
	var moi := partie.joueur.equipe
	var texte := "VICTOIRE" if gagnant == moi else ("ÉGALITÉ" if gagnant == "" else "DÉFAITE")
	partie.annoncer(texte, "%d - %d" % [score["bleu"], score["rouge"]], Style.OK if gagnant == moi else Style.ROUGE, 6.0)
	for c in partie.combattants:
		if c is Bot:
			(c as Bot).actif = false
	partie.fin_equipe(gagnant)
