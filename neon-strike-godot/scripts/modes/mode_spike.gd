extends Mode
## Spike (mode compétitif) : 5 contre 5, attaque / défense, première équipe à 7 manches, changement de côté
## après 6 manches. Phase d'achat (25 s), combat (1 min 40), pose du Spike sur A ou B (4 s), explosion
## après 40 s, désamorçage (7 s, moitié acquise). Économie : victoire 3000, défaite 1900 à 2900 selon la série,
## élimination 200, pose 300. Les armes principales sont perdues à la mort.
## Mode Élimination : mêmes règles sans Spike (avec_spike = false).

const MANCHES_VICTOIRE := 7
const MI_TEMPS := 6
const DUREE_ACHAT := 25.0
const DUREE_MANCHE := 100.0
const DUREE_FIN := 6.0
const CREDITS_MAX := 9000
const BOUCLIERS := {"leger": [25, 400], "lourd": [50, 1000]}

var avec_spike := true
var manche := 0
var phase := "attente"            # attente, achat, combat, fin, termine
var cote := {"bleu": "attaque", "rouge": "defense"}
var spike: Spike
var series := {"bleu": 0, "rouge": 0}
var site_attaque := "A"
var morts_manche := {}            # combattants morts pendant la manche (perdent l'arme principale)
var interaction := {}             # combattant -> {"type": "pose"/"desamorcage", "t": temps, "pos": position}
var plan_t := 0.0
var combat_t := 0.0
var menu_achat: Control
var fin_t := 0.0
var pose_par_equipe := ""
var execution := false            # les attaquants lancent l'assaut ensemble


func demarrer() -> void:
	partie.economie = true
	var j := partie.joueur
	j.etat_cap = EtatCapacites.new(j.heros, true)
	partie._preparer_hud_capacites()
	if String(Jeu.config.get("camp", "attaque")) == "defense":
		cote = {"bleu": "defense", "rouge": "attaque"}
	remplir_bots()
	for c in partie.combattants:
		c.credits = 800
		if c is Bot:
			(c as Bot).actif = false
	j.inventaire[1] = ""
	if avec_spike:
		spike = Spike.new()
		spike.name = "Spike"
		partie.add_child(spike)
		spike.pose.connect(_sur_pose)
		spike.explose.connect(func() -> void: _fin_manche(_equipe_de("attaque"), "Le Spike a explosé"))
		spike.desamorce.connect(func() -> void: _fin_manche(_equipe_de("defense"), "Spike désamorcé"))
	await partie.attendre_navigation()
	_nouvelle_manche()


func _equipe_de(c: String) -> String:
	return "bleu" if cote["bleu"] == c else "rouge"


## État envoyé aux joueurs invités (phase, Spike)
func etat_reseau() -> Dictionary:
	var d := {"hud": partie.dernier_hud, "phase": phase}
	if avec_spike and spike:
		d["spike"] = [spike.etat, spike.global_position, spike.porteur.id_reseau if is_instance_valid(spike.porteur) else 0, spike.minuterie, spike.site]
	return d


func texte_manche() -> String:
	return "MANCHE %d" % manche


# =============================================================================
# Déroulement des manches
# =============================================================================
func _nouvelle_manche() -> void:
	manche += 1
	if manche == MI_TEMPS + 1:
		cote = {"bleu": cote["rouge"], "rouge": cote["bleu"]}
		for c in partie.combattants:
			c.credits = 800
			_retirer_principale(c)
			c.armure = 0.0
			if c.etat_cap:
				c.etat_cap = EtatCapacites.new(c.heros, true)
			if c is JoueurDistant:
				partie.sync.rpc_id((c as JoueurDistant).peer, "rpc_inventaire", "capacites_neuves", "")
		partie._preparer_hud_capacites()
		partie.annoncer("CHANGEMENT DE CÔTÉ", "Vous êtes maintenant en %s" % ("attaque" if cote["bleu"] == "attaque" else "défense"), Style.ACCENT2, 3.0)
	partie.capacites.nettoyer()
	partie.effets.nettoyer()
	interaction.clear()
	pose_par_equipe = ""
	# Réapparition aux spawns ; les morts de la manche précédente perdent leur arme principale
	var compteurs := {"attaque": 0, "defense": 0}
	for c in partie.combattants:
		if c is Cible:
			continue
		var camp: String = cote[c.equipe]
		var pts: Array = partie.carte.apparitions.get(camp, partie.carte.apparitions["bleu"])
		var t: Transform3D = pts[compteurs[camp] % pts.size()]
		compteurs[camp] += 1
		if morts_manche.has(c):
			_retirer_principale(c)
			c.armure = 0.0
		if c is Joueur:
			(c as Joueur).reapparaitre(t)
		elif c is Bot:
			(c as Bot).reapparaitre(t)
			(c as Bot).actif = false
		elif c is JoueurDistant:
			(c as JoueurDistant).reapparaitre(t)
		c.vie = 100.0
		if c.etat_cap:
			c.etat_cap.nouvelle_manche()
			if manche > 1:
				c.etat_cap.ajouter_point()
		if c is JoueurDistant:
			partie.sync.rpc_id((c as JoueurDistant).peer, "rpc_inventaire", "nouvelle_manche", "")
	morts_manche.clear()
	# Le Spike : donné à un attaquant
	if avec_spike:
		var attaquants := _vivants(_equipe_de("attaque"))
		if attaquants.is_empty():
			attaquants = [partie.joueur]
		var porteur: Combattant = attaquants[randi() % attaquants.size()]
		if partie.joueur.equipe == _equipe_de("attaque") and randf() < 0.4:
			porteur = partie.joueur
		spike.donner(porteur)
		spike.site = ""
	site_attaque = "A" if randf() < 0.5 else "B"
	execution = false
	_achats_bots()
	phase = "achat"
	minuteur = DUREE_ACHAT
	combat_t = 0.0
	var camp_j: String = cote[partie.joueur.equipe]
	partie.annoncer("MANCHE %d" % manche, ("ATTAQUE" if camp_j == "attaque" else "DÉFENSE") + "  ·  Phase d'achat — %s : boutique" % Reglages.touche("boutique"), Style.TEXTE, 3.0)
	if avec_spike:
		partie.message_pour(spike.porteur, "VOUS PORTEZ LE SPIKE — posez-le sur A ou B (touche d'interaction)", 4.0)


func _retirer_principale(c: Combattant) -> void:
	if c is Joueur:
		var j := c as Joueur
		var id: String = j.inventaire.get(1, "")
		j.inventaire[1] = ""
		if id != "":
			j.logiques.erase(id)
		j.choisir_emplacement(2, true)
	elif c is Bot:
		(c as Bot).equiper("")
	elif c is JoueurDistant:
		(c as JoueurDistant).principale = ""
		c.arme_tenue = "pistolet"
		partie.sync.rpc_id((c as JoueurDistant).peer, "rpc_inventaire", "retirer", "")


func _vivants(eq: String) -> Array:
	return partie.combattants.filter(func(c: Combattant) -> bool: return c.vivant and c.equipe == eq and not (c is Cible))


func _physics_process(dt: float) -> void:
	match phase:
		"achat":
			minuteur -= dt
			_bloquer_spawns()
			if minuteur <= 0.0:
				phase = "combat"
				minuteur = DUREE_MANCHE
				for c in partie.combattants:
					if c is Bot:
						(c as Bot).actif = true
				Sons.jouer("manche_debut", -2.0)
				partie.annoncer("COMBAT", "", Style.ACCENT, 1.2)
				if menu_achat and menu_achat.visible:
					basculer_achat()
		"combat":
			combat_t += dt
			if not (avec_spike and spike.etat == "pose"):
				minuteur -= dt
			_interactions(dt)
			_plans_bots(dt)
			_verifier_fin()
		"fin":
			fin_t -= dt
			if fin_t <= 0.0:
				if score["bleu"] >= MANCHES_VICTOIRE or score["rouge"] >= MANCHES_VICTOIRE:
					_fin_partie()
				else:
					_nouvelle_manche()


func _process(_dt: float) -> void:
	var t := minuteur
	var urgent := phase == "combat" and t < 10.0
	var texte := "MANCHE %d" % manche
	if phase == "achat":
		texte = "ACHAT"
	if avec_spike and spike and spike.etat == "pose":
		t = spike.minuterie
		urgent = true
		texte = "SPIKE POSÉ — " + spike.site
	partie.maj_partie(t, score["bleu"], score["rouge"], texte, urgent)
	var l := []
	for eq in ["bleu", "rouge"]:
		var liste := []
		for c in partie.combattants:
			if c.equipe == eq and not (c is Cible):
				liste.append({"nom": c.nom_affiche, "vivant": c.vivant, "couleur": DonneesHeros.couleur_categorie(c.heros)})
		l.append(liste)
	partie.hud.maj_vivants(l[0], l[1])
	_spectateur()


## Pendant l'achat, chacun reste dans sa zone de départ
func _bloquer_spawns() -> void:
	for c in partie.combattants:
		var z: AABB = partie.carte.zones_spawn.get(cote.get(c.equipe, ""), AABB())
		if z.size == Vector3.ZERO:
			continue
		var p := c.global_position
		var q := Vector3(clampf(p.x, z.position.x + 0.5, z.end.x - 0.5), p.y, clampf(p.z, z.position.z + 0.5, z.end.z - 0.5))
		if q != p:
			c.global_position = q


func _verifier_fin() -> void:
	var att := _vivants(_equipe_de("attaque")).size()
	var def := _vivants(_equipe_de("defense")).size()
	var pose := avec_spike and spike.etat == "pose"
	if def == 0:
		_fin_manche(_equipe_de("attaque"), "Défenseurs éliminés")
	elif att == 0 and not pose:
		_fin_manche(_equipe_de("defense"), "Attaquants éliminés")
	elif minuteur <= 0.0 and not pose:
		_fin_manche(_equipe_de("defense"), "Temps écoulé")


func _fin_manche(gagnant: String, raison: String) -> void:
	if phase != "combat":
		return
	phase = "fin"
	fin_t = DUREE_FIN
	if Test.actif:
		print("MANCHE %d : %s (%s) à %.0f s" % [manche, gagnant, raison, combat_t])
	score[gagnant] += 1
	var perdant := "rouge" if gagnant == "bleu" else "bleu"
	series[gagnant] = 0
	series[perdant] += 1
	for c in partie.combattants:
		if c is Cible:
			continue
		var gain := 3000 if c.equipe == gagnant else 1900 + 500 * mini(series[perdant] - 1, 2)
		if pose_par_equipe == c.equipe:
			gain += 300
		c.credits = mini(CREDITS_MAX, c.credits + gain)
		if c is Bot:
			(c as Bot).actif = false
	interaction.clear()
	var moi := gagnant == partie.joueur.equipe
	partie.annoncer("MANCHE GAGNÉE" if moi else "MANCHE PERDUE", raison, Style.OK if moi else Style.ROUGE, 4.0)
	Sons.jouer("manche_gagnee" if moi else "manche_perdue", -2.0)
	if avec_spike and spike.etat == "explose":
		partie.effets.explosion(spike.global_position + Vector3.UP, 8.0, Color(1.0, 0.4, 0.3))
		for c in partie.combattants:
			if c.vivant and c.global_position.distance_to(spike.global_position) < 15.0 and not (c is Cible):
				partie.infliger(c, c, 999.0, false, "spike", c.global_position)
		spike.visible = false


func _fin_partie() -> void:
	phase = "termine"
	var moi := partie.joueur.equipe
	var gagne: bool = int(score[moi]) >= MANCHES_VICTOIRE
	partie.annoncer("VICTOIRE" if gagne else "DÉFAITE", "%d - %d" % [score["bleu"], score["rouge"]], Style.OK if gagne else Style.ROUGE, 8.0)
	partie.fin_equipe(moi if gagne else ("rouge" if moi == "bleu" else "bleu"))


func sur_elimination(victime: Combattant, tueur: Combattant, _tete: bool, _arme: String) -> void:
	morts_manche[victime] = true
	if tueur and tueur != victime and tueur.equipe != victime.equipe and phase == "combat":
		tueur.credits = mini(CREDITS_MAX, tueur.credits + 200)
	interaction.erase(victime)
	if avec_spike and spike.etat == "porte" and spike.porteur == victime:
		spike.lacher(victime.global_position + Vector3(0, 0.05, 0))
		for c in _vivants(victime.equipe):
			partie.message_pour(c, "LE SPIKE EST TOMBÉ", 2.0)


func sur_resurrection(c: Combattant) -> void:
	morts_manche.erase(c)


func _sur_pose(nom_site: String) -> void:
	pose_par_equipe = _equipe_de("attaque")
	var moi_attaque: bool = cote[partie.joueur.equipe] == "attaque"
	partie.annoncer("SPIKE POSÉ", "Site " + nom_site + (" — défendez-le" if moi_attaque else " — désamorcez-le !"), Style.ROUGE, 2.5)
	for c in partie.combattants:
		if c.etat_cap and c.equipe == pose_par_equipe:
			pass


# =============================================================================
# Pose, désamorçage, ramassage
# =============================================================================
func site_de(p: Vector3) -> String:
	for nom in partie.carte.sites:
		var s: Dictionary = partie.carte.sites[nom]
		if Vector2(p.x - s["centre"].x, p.z - s["centre"].z).length() < float(s["rayon"]):
			return nom
	return ""


func _interactions(dt: float) -> void:
	if not avec_spike:
		return
	var j := partie.joueur
	# Ramassage automatique par un attaquant
	if spike.etat == "sol":
		for c in _vivants(_equipe_de("attaque")):
			if c.global_position.distance_to(spike.global_position) < 1.3:
				spike.donner(c)
				partie.message_pour(c, "VOUS AVEZ LE SPIKE", 2.0)
				break
	# Joueur : maintenir la touche d'interaction
	var maintien := j.vivant and Input.is_action_pressed("interagir") and j.controle
	if maintien and not interaction.has(j):
		if spike.etat == "porte" and spike.porteur == j and site_de(j.global_position) != "" and j.is_on_floor():
			interaction[j] = {"type": "pose", "t": 0.0, "pos": j.global_position}
		elif spike.etat == "pose" and cote[j.equipe] == "defense" and j.global_position.distance_to(spike.global_position) < 1.8:
			interaction[j] = {"type": "desamorcage", "t": spike.progression_desamorcage, "pos": j.global_position}
	if not maintien and interaction.has(j):
		var it: Dictionary = interaction[j]
		if it["type"] == "desamorcage" and float(it["t"]) >= Spike.DUREE_DESAMORCAGE * 0.5:
			spike.progression_desamorcage = Spike.DUREE_DESAMORCAGE * 0.5
		interaction.erase(j)
	# Joueurs distants : même logique avec leur touche transmise par le réseau
	for c in partie.combattants:
		if not (c is JoueurDistant) or not c.vivant:
			continue
		var jd := c as JoueurDistant
		if jd.maintien_interaction and not interaction.has(jd):
			if spike.etat == "porte" and spike.porteur == jd and site_de(jd.global_position) != "":
				interaction[jd] = {"type": "pose", "t": 0.0, "pos": jd.global_position}
			elif spike.etat == "pose" and cote[jd.equipe] == "defense" and jd.global_position.distance_to(spike.global_position) < 1.8:
				interaction[jd] = {"type": "desamorcage", "t": spike.progression_desamorcage, "pos": jd.global_position}
		elif not jd.maintien_interaction and interaction.has(jd):
			interaction.erase(jd)
			partie.sync.rpc_id(jd.peer, "rpc_progression", "", 0.0)
		if interaction.has(jd):
			var itd: Dictionary = interaction[jd]
			var tot := Spike.DUREE_POSE if itd["type"] == "pose" else Spike.DUREE_DESAMORCAGE
			partie.sync.rpc_id(jd.peer, "rpc_progression", "POSE DU SPIKE" if itd["type"] == "pose" else "DÉSAMORÇAGE", float(itd["t"]) / tot)
	# Avancement de toutes les interactions (joueur et bots)
	for c in interaction.keys():
		var it: Dictionary = interaction[c]
		if not is_instance_valid(c) or not c.vivant or c.global_position.distance_to(it["pos"]) > 0.6:
			interaction.erase(c)
			continue
		c.velocity.x = 0.0
		c.velocity.z = 0.0
		it["t"] += dt
		if c == j and Sons.limite("interaction", 0.6):
			Sons.jouer("manip", -8.0)
		if it["type"] == "pose" and it["t"] >= Spike.DUREE_POSE:
			interaction.erase(c)
			spike.poser(c.global_position + Vector3(0, 0.02, 0), site_de(c.global_position))
		elif it["type"] == "desamorcage" and it["t"] >= Spike.DUREE_DESAMORCAGE:
			interaction.erase(c)
			spike.desamorcer()
	if interaction.has(j):
		var it: Dictionary = interaction[j]
		var total := Spike.DUREE_POSE if it["type"] == "pose" else Spike.DUREE_DESAMORCAGE
		partie.hud.progression("POSE DU SPIKE" if it["type"] == "pose" else "DÉSAMORÇAGE", float(it["t"]) / total)
	else:
		partie.hud.progression("", 0.0)


# =============================================================================
# Plans des bots
# =============================================================================
func _plans_bots(dt: float) -> void:
	plan_t -= dt
	if plan_t > 0.0:
		return
	plan_t = 0.4
	var carte := partie.carte
	var i_def := 0
	var i_att := 0
	for c in partie.combattants:
		if not (c is Bot) or not c.vivant:
			continue
		var b := c as Bot
		var camp: String = cote[b.equipe]
		if camp == "attaque":
			_plan_attaquant(b, i_att, carte)
			i_att += 1
		else:
			_plan_defenseur(b, i_def, carte)
			i_def += 1


func _plan_attaquant(b: Bot, i: int, carte: Carte) -> void:
	if not avec_spike:
		_plan_libre(b, i, carte)
		return
	var site: Dictionary = carte.sites[site_attaque]
	var centre: Vector3 = site["centre"]
	if spike.etat == "sol":
		# Le plus proche va ramasser le Spike
		var plus_proche: Combattant = null
		for c in _vivants(b.equipe):
			if plus_proche == null or c.global_position.distance_to(spike.global_position) < plus_proche.global_position.distance_to(spike.global_position):
				plus_proche = c
		if plus_proche == b:
			b.objectif = spike.global_position
			return
	if spike.etat == "pose":
		var postes: Array = carte.postes.get(spike.site, [spike.global_position])
		b.objectif = postes[i % postes.size()]
		var entrees: Array = carte.entrees.get(spike.site, [])
		if not entrees.is_empty():
			b.objectif_regard = (entrees[i % entrees.size()] as Vector3) + Vector3(0, 1.4, 0)
		return
	var regroupe: Array = carte.regroupements.get(site_attaque, [centre])
	var porteur := spike.porteur == b
	# Regroupement au même point, puis assaut ensemble (ou après 30 s quoi qu'il arrive)
	if not execution:
		var point: Vector3 = regroupe[0]
		var presents := 0
		var vivants := _vivants(b.equipe)
		for c in vivants:
			if c.global_position.distance_to(point) < 9.0:
				presents += 1
		if presents >= maxi(1, vivants.size() - 1) or combat_t > 30.0:
			execution = true
	if not execution:
		b.objectif = (regroupe[0] as Vector3) + Vector3(randf_range(-2, 2), 0, randf_range(-2, 2)) * 0.0 + Vector3((i % 3 - 1) * 1.5, 0, floorf(i / 3.0) * 1.5)
	else:
		var postes: Array = carte.postes.get(site_attaque, [centre])
		b.objectif = centre if porteur else postes[i % postes.size()]
	b.objectif_regard = Vector3.ZERO
	# Le porteur pose quand il est sur le site sans ennemi en vue
	if porteur and site_de(b.global_position) == site_attaque and b.plus_vu > 1.5 and not interaction.has(b) and b.is_on_floor():
		if b.global_position.distance_to(centre) < 6.0:
			interaction[b] = {"type": "pose", "t": 0.0, "pos": b.global_position}


func _plan_defenseur(b: Bot, i: int, carte: Carte) -> void:
	if avec_spike and spike.etat == "pose":
		b.objectif = spike.global_position
		b.objectif_regard = Vector3.ZERO
		# Le défenseur le plus proche désamorce si personne n'est en vue
		if b.global_position.distance_to(spike.global_position) < 1.6 and b.plus_vu > 1.5 and not interaction.has(b):
			interaction[b] = {"type": "desamorcage", "t": spike.progression_desamorcage, "pos": b.global_position}
		return
	if not avec_spike:
		_plan_libre(b, i, carte)
		return
	var cles := ["A", "A", "B", "B", "milieu"]
	var cle: String = cles[i % cles.size()]
	var postes: Array = carte.postes.get(cle, [Vector3.ZERO])
	b.objectif = postes[(i >> 1) % postes.size()] if cle != "milieu" else postes[0]
	var entrees: Array = carte.entrees.get(cle, [])
	if entrees.is_empty():
		b.objectif_regard = Vector3(0, 1.4, 20)
	else:
		b.objectif_regard = (entrees[i % entrees.size()] as Vector3) + Vector3(0, 1.4, 0)


## Élimination : les attaquants poussent un site, les défenseurs tiennent
func _plan_libre(b: Bot, i: int, carte: Carte) -> void:
	var camp: String = cote[b.equipe]
	if camp == "attaque":
		var regroupe: Array = carte.regroupements.get(site_attaque, [Vector3.ZERO])
		b.objectif = regroupe[i % regroupe.size()] if combat_t < 15.0 else (carte.sites[site_attaque]["centre"] as Vector3)
	else:
		var cles := ["A", "A", "B", "B", "milieu"]
		var postes: Array = carte.postes.get(cles[i % 5], [Vector3.ZERO])
		b.objectif = postes[0]


# =============================================================================
# Économie et boutique
# =============================================================================
func _achats_bots() -> void:
	for c in partie.combattants:
		if not (c is Bot):
			continue
		var b := c as Bot
		var prefere: String = DonneesHeros.heros(b.heros).get("arme", "fusil")
		var a_principale := b.armes.has(1)
		if not a_principale:
			var prix_pref := int(DonneesArmes.arme(prefere).get("prix", 2900))
			if b.credits >= prix_pref + 1000:
				acheter(b, "arme:" + prefere)
			elif b.credits >= 3900:
				acheter(b, "arme:fusil")
			elif b.credits >= 2400 and manche > 1:
				acheter(b, "arme:pompe")
		if b.armure < 50.0 and b.credits >= 1000 + (0 if b.armes.has(1) else 1500):
			acheter(b, "bouclier:lourd")
		elif b.armure < 25.0 and b.credits >= 400:
			acheter(b, "bouclier:leger")
		for empl in ["c", "q"]:
			if b.etat_cap and b.etat_cap.ids.has(empl) and b.credits >= b.etat_cap.prix(empl) + 200:
				acheter(b, "capacite:" + empl)


## Achat d'un article ("arme:fusil", "bouclier:lourd", "capacite:c") ; renvoie vrai si réussi
func acheter(c: Combattant, article: String) -> bool:
	if phase != "achat" and not (phase == "combat" and combat_t < 0.1):
		return false
	var p := article.split(":")
	match p[0]:
		"arme":
			var def := DonneesArmes.arme(p[1])
			var prix := int(def.get("prix", 0))
			if c.credits < prix:
				return false
			c.credits -= prix
			if c is Joueur:
				(c as Joueur).donner_arme(p[1])
			elif c is Bot:
				(c as Bot).equiper(p[1])
			elif c is JoueurDistant:
				(c as JoueurDistant).principale = p[1]
				partie.sync.rpc_id((c as JoueurDistant).peer, "rpc_inventaire", "donner", p[1])
		"bouclier":
			var b: Array = BOUCLIERS[p[1]]
			if c.credits < int(b[1]) or c.armure >= float(b[0]):
				return false
			c.credits -= int(b[1])
			c.armure = float(b[0])
		"capacite":
			var e := c.etat_cap
			if e == null or not e.ids.has(p[1]) or e.charges[p[1]] >= e.maxi[p[1]] or c.credits < e.prix(p[1]):
				return false
			c.credits -= e.prix(p[1])
			e.charges[p[1]] += 1
			if c is JoueurDistant:
				partie.sync.rpc_id((c as JoueurDistant).peer, "rpc_inventaire", "charge", p[1])
	if c is Joueur:
		Sons.jouer("ui_achat", -4.0)
	return true


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("boutique") and phase == "achat" and partie.joueur.vivant:
		basculer_achat()
		get_viewport().set_input_as_handled()


func basculer_achat() -> void:
	if menu_achat == null:
		menu_achat = load("res://scripts/ui/menu_achat.gd").new()
		menu_achat.mode = self
		partie.couche_ui.add_child(menu_achat)
		menu_achat.visible = false
	menu_achat.visible = not menu_achat.visible
	if menu_achat.visible:
		menu_achat.call("actualiser")
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		partie.joueur.controle = false
	else:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
		partie.joueur.controle = partie.joueur.vivant


# =============================================================================
# Spectateur : quand le joueur est mort, la caméra suit un allié vivant
# =============================================================================
var suivi: Combattant


func _spectateur() -> void:
	var j := partie.joueur
	if j.vivant or phase == "attente":
		suivi = null
		return
	if suivi == null or not suivi.vivant:
		var allies := _vivants(j.equipe)
		suivi = allies[0] if not allies.is_empty() else null
		if suivi:
			partie.hud.afficher_message("Vous regardez " + suivi.nom_affiche, 2.0)
	if suivi:
		var b := suivi.global_transform.basis
		var cible := suivi.global_position + Vector3(0, 1.6 * suivi.taille, 0)
		var pos := cible + b * Vector3(0.5, 0.35, 2.4)
		j.cam.global_position = j.cam.global_position.lerp(pos, 0.2)
		j.cam.look_at(cible + (-b.z) * 3.0)
