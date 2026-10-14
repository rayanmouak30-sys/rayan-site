class_name SyncPartie
extends Node
## Synchronisation réseau d'une partie (nœud /root/Partie/Sync sur toutes les machines).
## L'hôte fait autorité : règles, bots, dégâts, crédits. Chaque joueur déplace son propre corps et calcule
## ses touches (favorise le tireur), puis l'hôte applique les dégâts et diffuse l'état 20 fois par seconde.

var partie: Partie
var envoi_t := 0.0
var etat_t := 0.0
var etat_n := 0
var prochain_id_bot := 1000


func _ready() -> void:
	name = "Sync"


func id_de(c: Combattant) -> int:
	return c.id_reseau


func par_id(id: int) -> Combattant:
	return partie.par_id.get(id)


# =============================================================================
# Mise en place
# =============================================================================
## Hôte : crée les joueurs distants (avant le démarrage du mode)
func creer_humains() -> void:
	for id in Reseau.joueurs:
		var infos: Dictionary = Reseau.joueurs[id]
		if int(id) == 1:
			partie.joueur.id_reseau = 1
			partie.joueur.equipe = infos.get("equipe", "bleu")
			partie.par_id[1] = partie.joueur
			continue
		_creer_distant(int(id), infos)


func _creer_distant(id: int, infos: Dictionary) -> JoueurDistant:
	var d := JoueurDistant.new()
	d.name = "Humain_%d" % id
	d.peer = id
	d.id_reseau = id
	d.equipe = infos.get("equipe", "bleu")
	d.nom_affiche = String(infos.get("pseudo", "Joueur"))
	partie.add_child(d)
	d.arme_tenue = "pistolet"
	d.definir_heros(String(infos.get("heros", "kael")), String(infos.get("skin", "standard")), 1, false)
	d.modele.appliquer_skin(String(infos.get("skin", "standard")), d.equipe)
	partie.par_id[id] = d
	partie.ajouter_combattant(d)
	return d


## Hôte : donne un identifiant à chaque bot puis envoie la liste complète aux autres
func envoyer_roster() -> void:
	var roster := []
	for c in partie.combattants:
		if c is Bot and c.id_reseau == 0:
			c.id_reseau = prochain_id_bot
			prochain_id_bot += 1
			partie.par_id[c.id_reseau] = c
		if c is Cible:
			continue
		var type := "bot" if c is Bot else "humain"
		roster.append([c.id_reseau, type, c.heros, c.skin, c.equipe, c.nom_affiche, c.arme_tenue])
	rpc("rpc_roster", roster)


@rpc("authority", "reliable")
func rpc_roster(roster: Array) -> void:
	var moi := Reseau.mon_id()
	for e in roster:
		var id: int = e[0]
		if partie.par_id.has(id):
			continue
		if id == moi:
			partie.joueur.id_reseau = id
			partie.joueur.equipe = e[4]
			partie.joueur.modele.appliquer_skin(e[3], e[4])
			partie.par_id[id] = partie.joueur
			continue
		if e[1] == "bot":
			var b := partie.ajouter_bot(e[2], e[4], e[5])
			b.marionnette = true
			b.actif = false
			b.id_reseau = id
			b.equiper(e[6])
			partie.par_id[id] = b
		else:
			var d := _creer_distant(id, {"heros": e[2], "skin": e[3], "equipe": e[4], "pseudo": e[5]})
			d.id_reseau = id
	partie.hud.annoncer("PARTIE EN LIGNE", "%d joueurs" % roster.size(), Style.ACCENT, 2.0)


var clients_prets := {}


## Hôte : attend que chaque joueur ait chargé la partie (15 s au plus)
func attendre_clients() -> void:
	var t := 0.0
	while t < 15.0:
		var tous := true
		for id in Reseau.joueurs:
			if int(id) != 1 and not clients_prets.has(int(id)):
				tous = false
		if tous:
			return
		await get_tree().create_timer(0.2).timeout
		t += 0.2


@rpc("any_peer", "reliable")
func rpc_client_pret() -> void:
	clients_prets[multiplayer.get_remote_sender_id()] = true


# =============================================================================
# États périodiques
# =============================================================================
func _physics_process(dt: float) -> void:
	if not Reseau.actif():
		return
	var j := partie.joueur
	# Mon corps : envoyé à tout le monde 30 fois par seconde
	envoi_t -= dt
	if envoi_t <= 0.0 and j.id_reseau != 0:
		envoi_t = 1.0 / 30.0
		var drapeaux := (1 if j.accroupi else 0) | (2 if bool(j.get_meta("sprint", false)) else 0) | (4 if j.is_on_floor() else 0)
		rpc("rpc_etat_humain", j.id_reseau, j.global_position, j.regard.y, j.regard.x, j.velocity, drapeaux, j.arme.id if j.arme else "")
	# Hôte : état de tous les combattants et du mode, 20 fois par seconde
	if Reseau.est_hote():
		etat_t -= dt
		if etat_t <= 0.0:
			etat_t = 0.05
			etat_n += 1
			_envoyer_etat(etat_n % 3 == 0)


@rpc("any_peer", "unreliable_ordered")
func rpc_etat_humain(id: int, pos: Vector3, lacet: float, tangage: float, vel: Vector3, drapeaux: int, arme: String) -> void:
	var c := par_id(id)
	if c is JoueurDistant:
		(c as JoueurDistant).recevoir_etat(pos, lacet, tangage, vel, drapeaux, arme)


## État rapide (20 Hz, non fiable) dans un tampon binaire compact : ~50 octets par combattant, pour rester
## sous la taille d'un paquet (MTU) même à 10 joueurs. Le reste (crédits, scores, statuts, arme) part en fiable ~7 fois par seconde.
func _envoyer_etat(avec_lent: bool) -> void:
	var tampon := StreamPeerBuffer.new()
	var lent := []
	for c in partie.combattants:
		if c is Cible or c.id_reseau == 0:
			continue
		var lacet := c.rotation.y
		var tangage := 0.0
		var accroupi := false
		if c is Joueur:
			lacet = (c as Joueur).regard.y
			tangage = (c as Joueur).regard.x
			accroupi = (c as Joueur).accroupi
		elif c is Bot:
			tangage = (c as Bot).tangage
			accroupi = (c as Bot).accroupi
		var drapeaux := (1 if c.vivant else 0) | (2 if accroupi else 0) | (4 if c.is_on_floor() else 0)
		tampon.put_32(c.id_reseau)
		for v in [c.global_position, c.velocity]:
			tampon.put_float(v.x)
			tampon.put_float(v.y)
			tampon.put_float(v.z)
		tampon.put_float(lacet)
		tampon.put_float(tangage)
		tampon.put_float(c.vie)
		tampon.put_float(c.armure)
		tampon.put_u8(drapeaux)
		tampon.put_u16(clampi(roundi(c.aveugle * 100.0), 0, 65535))
		tampon.put_u16(clampi(roundi(c.aveugle_max * 100.0), 0, 65535))
		tampon.put_u16(clampi(roundi(c.revele * 100.0), 0, 65535))
		if avec_lent:
			var st := {}
			for k in c.statuts:
				if float(c.statuts[k]) > 0.0:
					st[k] = c.statuts[k]
			lent.append([c.id_reseau, c.arme_tenue, c.credits, c.kills, c.morts, c.tetes, st, c.etat_cap.points if c.etat_cap else 0])
	rpc("rpc_etat", tampon.data_array, partie.mode.etat_reseau() if partie.mode.has_method("etat_reseau") else {})
	if avec_lent:
		rpc("rpc_etat_lent", lent)


@rpc("authority", "unreliable_ordered")
func rpc_etat(donnees: PackedByteArray, mode: Dictionary) -> void:
	var j := partie.joueur
	var tampon := StreamPeerBuffer.new()
	tampon.data_array = donnees
	while tampon.get_available_bytes() >= 51:
		var id := tampon.get_32()
		var pos := Vector3(tampon.get_float(), tampon.get_float(), tampon.get_float())
		var vel := Vector3(tampon.get_float(), tampon.get_float(), tampon.get_float())
		var lacet := tampon.get_float()
		var tangage := tampon.get_float()
		var vie := tampon.get_float()
		var armure := tampon.get_float()
		var drapeaux := tampon.get_u8()
		var aveugle := tampon.get_u16() / 100.0
		var aveugle_max := tampon.get_u16() / 100.0
		var revele := tampon.get_u16() / 100.0
		var c := par_id(id)
		if c == null:
			continue
		c.vie = vie
		c.armure = armure
		c.revele = revele
		if c == j:
			j.aveugle = maxf(j.aveugle, aveugle) if aveugle > j.aveugle + 0.2 else j.aveugle
			j.aveugle_max = maxf(aveugle_max, 0.01)
			continue
		# Réapparition décidée par l'hôte
		if drapeaux & 1 != 0 and not c.vivant:
			var t := Transform3D(Basis(Vector3.UP, lacet), pos)
			if c is Bot:
				(c as Bot).reapparaitre(t)
			elif c is JoueurDistant:
				(c as JoueurDistant).reapparaitre(t)
		if c is Bot:
			var b := c as Bot
			b.cible_reseau = pos
			b.lacet = lacet
			b.tangage = tangage
			b.velocity = vel
			b.accroupi = drapeaux & 2 != 0
		# Les humains (hôte compris) envoient eux-mêmes leur corps 30 fois par seconde (rpc_etat_humain)
	if partie.mode.has_method("recevoir_etat"):
		partie.mode.recevoir_etat(mode)


@rpc("authority", "reliable")
func rpc_etat_lent(l: Array) -> void:
	var j := partie.joueur
	for e in l:
		var c := par_id(int(e[0]))
		if c == null:
			continue
		c.credits = e[2]
		c.kills = e[3]
		c.morts = e[4]
		c.tetes = e[5]
		for k in e[6]:
			c.statuts[k] = e[6][k]
		if c == j:
			if j.etat_cap and int(e[7]) > j.etat_cap.points:
				j.etat_cap.points = int(e[7])
			continue
		if c is Bot and String(e[1]) != "" and String(e[1]) != (c as Bot).arme_tenue:
			(c as Bot).tenir_arme(e[1])


# =============================================================================
# Tirs, dégâts, éliminations
# =============================================================================
## Diffuse les effets d'un tir (traçantes, impacts, son, animation) à toutes les autres machines
func envoyer_tir(tireur: Combattant, depart: Vector3, fins: PackedVector3Array, normales: PackedVector3Array, matieres: PackedStringArray, arme: String) -> void:
	if Reseau.actif() and tireur.id_reseau != 0:
		rpc("rpc_tir", tireur.id_reseau, depart, fins, normales, matieres, arme)


@rpc("any_peer", "unreliable")
func rpc_tir(id: int, depart: Vector3, fins: PackedVector3Array, normales: PackedVector3Array, matieres: PackedStringArray, arme: String) -> void:
	var c := par_id(id)
	var def := DonneesArmes.arme(arme)
	var couleur := Color(def.get("couleur_trace", "#ffe9b8"))
	if c and c.modele:
		depart = c.modele.bouche()
		c.modele.action("tir")
	for i in fins.size():
		if i < 3:
			partie.effets.trace(depart, fins[i], couleur, 0.02)
		if matieres[i] == "chair":
			partie.effets.touche_combattant(fins[i], normales[i], false, false)
		elif matieres[i] != "":
			partie.effets.impact(fins[i], normales[i], matieres[i], couleur)
	partie.effets.flash(depart, Color(def.get("couleur_flash", "#ffc27a")), 1.0)
	Sons.jouer_3d("tir_" + arme, depart, -2.0, randf_range(0.96, 1.04), 90.0)
	if Reseau.est_hote() and c:
		partie.bruit(depart, 45.0, c)


## Un joueur a touché quelqu'un chez lui : l'hôte applique les dégâts
@rpc("any_peer", "reliable")
func rpc_degats(id_victime: int, degats: float, tete: bool, arme: String, pos: Vector3) -> void:
	if not Reseau.est_hote():
		return
	var auteur := par_id(multiplayer.get_remote_sender_id())
	var victime := par_id(id_victime)
	if auteur and victime and auteur.vivant:
		partie.infliger(auteur, victime, minf(degats, 600.0), tete, arme, pos)


## L'hôte prévient un joueur qu'il est touché (flash rouge, direction)
@rpc("authority", "reliable")
func rpc_degat_recu(quantite: float, source: Vector3) -> void:
	partie.hud.degats_recus(quantite, source)
	Sons.jouer("degat_recu", -6.0)


@rpc("authority", "reliable")
func rpc_elimination(id_victime: int, id_tueur: int, tete: bool, arme: String) -> void:
	var v := par_id(id_victime)
	var t := par_id(id_tueur)
	if v == null:
		return
	partie.eliminer(v, t, tete, arme)


# =============================================================================
# Capacités
# =============================================================================
@rpc("any_peer", "reliable")
func rpc_capacite(id_lanceur: int, id_cap: String, dir: Vector3, cible: Vector3) -> void:
	var c := par_id(id_lanceur)
	if c == null:
		return
	partie.capacites.autorite = Reseau.est_hote()
	partie.capacites.executer(c, id_cap, dir, cible)


# =============================================================================
# Ordres de l'hôte vers un joueur
# =============================================================================
@rpc("authority", "reliable")
func rpc_reapparaitre(t: Transform3D) -> void:
	partie.joueur.reapparaitre(t)


## op : "retirer" (perd l'arme principale), "donner" (arme), "bouclier", "charge"
@rpc("authority", "reliable")
func rpc_inventaire(op: String, valeur: String) -> void:
	var j := partie.joueur
	match op:
		"retirer":
			var id: String = j.inventaire.get(1, "")
			j.inventaire[1] = ""
			j.logiques.erase(id)
			j.choisir_emplacement(2, true)
		"donner":
			j.donner_arme(valeur)
		"charge":
			if j.etat_cap and j.etat_cap.charges.has(valeur):
				j.etat_cap.charges[valeur] = mini(j.etat_cap.maxi[valeur], int(j.etat_cap.charges[valeur]) + 1)
		"capacites_neuves":
			j.etat_cap = EtatCapacites.new(j.heros, true)
			partie._preparer_hud_capacites()
		"nouvelle_manche":
			if j.etat_cap:
				j.etat_cap.nouvelle_manche()
	if op == "donner" or op == "charge":
		Sons.jouer("ui_achat", -6.0)


@rpc("authority", "reliable")
func rpc_message(texte: String, duree: float) -> void:
	partie.hud.afficher_message(texte, duree)


@rpc("authority", "reliable")
func rpc_annonce(texte: String, sous: String, couleur: Color, duree: float) -> void:
	partie.hud.annoncer(texte, sous, couleur, duree)


@rpc("authority", "unreliable_ordered")
func rpc_progression(texte: String, k: float) -> void:
	partie.hud.progression(texte, k)


@rpc("authority", "reliable")
func rpc_fin(gagnant: String) -> void:
	partie.fin_de_partie(gagnant == partie.joueur.equipe)


# =============================================================================
# Demandes des joueurs vers l'hôte
# =============================================================================
@rpc("any_peer", "reliable")
func rpc_acheter(article: String) -> void:
	if not Reseau.est_hote():
		return
	var c := par_id(multiplayer.get_remote_sender_id())
	if c and partie.mode.has_method("acheter"):
		partie.mode.acheter(c, article)


@rpc("any_peer", "reliable")
func rpc_interaction(maintien: bool) -> void:
	var c := par_id(multiplayer.get_remote_sender_id())
	if c is JoueurDistant:
		(c as JoueurDistant).maintien_interaction = maintien
