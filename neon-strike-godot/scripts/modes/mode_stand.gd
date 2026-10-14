extends Mode
## Stand de tir : cibles qui se relèvent, munitions infinies en réserve, changement d'arme libre (touches 1 à 3 et B).

var cibles: Array[Cible] = []
var touches := 0
var tetes := 0
var tirs := 0


func demarrer() -> void:
	minuteur = 0.0
	var c := partie.carte
	var positions: Array[Vector3] = c.call("positions_cibles") if c.has_method("positions_cibles") else []
	var i := 0
	for p in positions:
		var cible := Cible.new()
		cible.name = "Cible%d" % i
		cible.mobile = i % 4 == 3
		cible.position = p
		cible.rotation.y = 0.0
		partie.add_child(cible)
		partie.ajouter_combattant(cible)
		cibles.append(cible)
		i += 1
	partie.joueur.donner_arme(Jeu.config.get("arme", "pulsar"))
	partie.joueur.credits = -1
	partie.joueur.a_tire.connect(func(_id: String) -> void: tirs += 1)
	partie.joueur.touche_infligee.connect(func(_v: Combattant, _d: float, tete: bool, _m: bool) -> void:
		touches += 1
		if tete:
			tetes += 1)
	partie.hud.annoncer("STAND DE TIR", "1-2-3 : armes  ·  B : changer d'arme principale  ·  R : recharger  ·  Y : inspecter", Style.ACCENT, 4.0)


func _process(dt: float) -> void:
	minuteur += dt
	var j := partie.joueur
	# Réserve infinie au stand
	for l in j.logiques.values():
		var la: LogiqueArme = l
		if la.type != "melee":
			la.reserve = maxi(la.reserve, int(la.def.get("chargeur", 10)) * 3)
	var precision := 0 if tirs == 0 else roundi(100.0 * touches / maxf(tirs, 1))
	partie.hud.maj_partie(minuteur, touches, tetes, "PRÉCISION %d %%" % precision)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("boutique"):
		# Fait défiler les armes principales
		var liste: Array = DonneesArmes.PRINCIPALES
		var actuelle: String = partie.joueur.inventaire.get(1, "")
		var k := (liste.find(actuelle) + 1) % liste.size()
		partie.joueur.donner_arme(liste[k])
		partie.hud.afficher_message(String(DonneesArmes.arme(liste[k])["nom"]).to_upper())


func sur_elimination(victime: Combattant, _tueur: Combattant, _tete: bool, _arme: String) -> void:
	if victime == partie.joueur:
		await get_tree().create_timer(2.0).timeout
		partie.joueur.reapparaitre(partie.carte.apparitions["bleu"][0])
