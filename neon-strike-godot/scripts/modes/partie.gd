class_name Partie
extends Node3D
## Scène de partie : charge la carte, crée le joueur, la vue FPS, l'interface, les effets et le mode de jeu.
## C'est elle qui applique les dégâts (et donc l'autorité en réseau), compte les éliminations et le score.

signal combattant_elimine(victime: Combattant, tueur: Combattant, tete: bool, arme: String)

var carte: Carte
var effets: Effets
var joueur: Joueur
var vue: VueArme
var hud: Hud
var couche_ui: CanvasLayer
var mode: Mode
var combattants: Array[Combattant] = []
var en_pause := false
var menu_pause: Control


func _ready() -> void:
	Jeu.partie = self
	var nom_carte: String = Jeu.config.get("carte", "stand")
	if Jeu.config.get("mode", "") == "stand":
		nom_carte = "stand"
	var chemin := "res://scripts/carte/carte_%s.gd" % nom_carte
	if not ResourceLoader.exists(chemin):
		chemin = "res://scripts/carte/carte_stand.gd"
	carte = load(chemin).new()
	carte.name = "Carte"
	add_child(carte)
	effets = Effets.new()
	add_child(effets)
	couche_ui = CanvasLayer.new()
	couche_ui.layer = 1
	add_child(couche_ui)
	vue = VueArme.new()
	vue.name = "VueArme"
	couche_ui.add_child(vue)
	vue.accorder_lumiere(carte.ambiance_vue, carte.energie_vue)
	hud = Hud.new()
	hud.name = "Hud"
	couche_ui.add_child(hud)
	joueur = Joueur.new()
	joueur.name = "Joueur"
	joueur.nom_affiche = String(Reglages.lire("pseudo")) if String(Reglages.lire("pseudo")) != "" else "Joueur"
	joueur.heros = Jeu.config.get("heros", Profil.donnees.get("heros", "kael"))
	joueur.skin = Profil.skin_heros(joueur.heros)
	joueur.equipe = "bleu"
	add_child(joueur)
	joueur.definir_heros(joueur.heros, joueur.skin, 1 << 19, true)
	ajouter_combattant(joueur)
	var spawns: Array = carte.apparitions["bleu"]
	if not spawns.is_empty():
		joueur.reapparaitre(spawns[0])
	joueur.brancher(vue, effets)
	hud.joueur = joueur
	var nom_mode: String = Jeu.config.get("mode", "stand")
	var chemin_mode := "res://scripts/modes/mode_%s.gd" % nom_mode
	if not ResourceLoader.exists(chemin_mode):
		chemin_mode = "res://scripts/modes/mode_stand.gd"
	mode = load(chemin_mode).new()
	mode.name = "Mode"
	mode.partie = self
	add_child(mode)
	mode.demarrer()
	if not Test.actif:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func ajouter_combattant(c: Combattant) -> void:
	if not combattants.has(c):
		combattants.append(c)


## Dégâts d'un combattant sur un autre. Renvoie vrai si la victime est éliminée.
func infliger(auteur: Combattant, victime: Combattant, degats: float, tete: bool, arme: String, pos: Vector3) -> bool:
	if not victime.vivant:
		return false
	if auteur != victime and auteur.equipe == victime.equipe and not mode.tir_ami:
		return false
	var reel := victime.appliquer_degats(degats)
	if victime is Bot:
		(victime as Bot).reagir_touche(auteur)
	auteur.degats_infliges += reel
	victime.touche_recu.emit(reel, auteur, tete)
	if victime == joueur:
		hud.degats_recus(reel, auteur.global_position)
		Sons.jouer("degat_recu", -6.0, randf_range(0.95, 1.05))
	if victime is Cible:
		(victime as Cible).secouer(victime.global_position - auteur.global_position, 1.0 if not tete else 1.6)
	var mortel := victime.vie <= 0.0
	if auteur == joueur:
		hud.viseur.touche(tete, mortel)
	if mortel:
		eliminer(victime, auteur, tete, arme)
	return mortel


## Bruit (tir, pas de course, capacité) : les bots ennemis dans le rayon l'entendent
func bruit(pos: Vector3, rayon: float, auteur: Combattant) -> void:
	for c in combattants:
		if c is Bot and c.vivant and c != auteur and c.global_position.distance_to(pos) < rayon:
			(c as Bot).entendre(pos, auteur)


## Attend que le maillage de navigation soit cuit et synchronisé
func attendre_navigation() -> void:
	var nav := carte.navigation
	var t := 0
	while nav and nav.is_baking() and t < 600:
		await get_tree().process_frame
		t += 1
	await get_tree().physics_frame
	await get_tree().physics_frame


## Ajoute un bot (héros, équipe) à la partie
func ajouter_bot(id_heros: String, eq: String, nom := "") -> Bot:
	var b := Bot.new()
	b.name = "Bot_" + id_heros + "_" + str(combattants.size())
	b.equipe = eq
	b.nom_affiche = nom if nom != "" else String(DonneesHeros.heros(id_heros)["nom"])
	b.effets = effets
	add_child(b)
	var h := DonneesHeros.heros(id_heros)
	b.arme_tenue = String(h.get("arme", "fusil"))
	b.definir_heros(id_heros, "standard", 1, false)
	b.modele.appliquer_skin("standard", eq)
	b.equiper(b.arme_tenue)
	ajouter_combattant(b)
	return b


func eliminer(victime: Combattant, tueur: Combattant, tete: bool, arme: String) -> void:
	victime.vivant = false
	victime.morts += 1
	if tueur and tueur != victime:
		if tueur.equipe != victime.equipe:
			tueur.kills += 1
			if tete:
				tueur.tetes += 1
		if tueur == joueur:
			Sons.jouer("elimination", -2.0)
	if victime is Cible:
		(victime as Cible).tomber(victime.global_position - tueur.global_position)
	elif victime == joueur:
		joueur.mourir()
	elif victime.has_method("mourir"):
		victime.call("mourir", tueur, tete)
	if not victime is Cible:
		var nom_arme: String = DonneesArmes.arme(arme).get("nom", arme) if DonneesArmes.ARMES.has(arme) else arme
		hud.elimination(tueur.nom_affiche if tueur else "?", Style.couleur_equipe(tueur.equipe) if tueur else Style.TEXTE2,
			victime.nom_affiche, Style.couleur_equipe(victime.equipe), nom_arme, tete, tueur == joueur or victime == joueur)
	victime.elimine.emit(victime, tueur, tete, arme)
	combattant_elimine.emit(victime, tueur, tete, arme)
	mode.sur_elimination(victime, tueur, tete, arme)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause"):
		basculer_pause()
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseButton and event.pressed and not en_pause and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func basculer_pause() -> void:
	en_pause = not en_pause
	if en_pause:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		if menu_pause == null and ResourceLoader.exists("res://scripts/ui/menu_pause.gd"):
			menu_pause = load("res://scripts/ui/menu_pause.gd").new()
			couche_ui.add_child(menu_pause)
		if menu_pause:
			menu_pause.visible = true
		joueur.controle = false
	else:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
		if menu_pause:
			menu_pause.visible = false
		joueur.controle = joueur.vivant


func _exit_tree() -> void:
	if Jeu.partie == self:
		Jeu.partie = null
