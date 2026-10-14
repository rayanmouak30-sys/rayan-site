extends Mode
## Mode chez un joueur invité : les règles tournent chez l'hôte. Ce mode affiche le minuteur, le score,
## les phases, le Spike, gère la boutique (demandes à l'hôte), la touche d'interaction et la caméra spectateur.

var nom_mode := "dm"
var phase := "attente"
var spike: Spike
var menu_achat: Control
var maintien := false
var suivi: Combattant


func demarrer() -> void:
	partie.economie = nom_mode in ["spike", "elimination"]
	var j := partie.joueur
	j.etat_cap = EtatCapacites.new(j.heros, partie.economie)
	partie._preparer_hud_capacites()
	j.credits = 800 if partie.economie else -1
	if nom_mode == "dm":
		j.donner_arme(String(DonneesHeros.heros(j.heros).get("arme", "fusil")))
	if nom_mode == "spike":
		spike = Spike.new()
		partie.add_child(spike)
		spike.visible = false
	partie.hud.annoncer("CONNEXION À LA PARTIE", "En attente de l'hôte…", Style.TEXTE2, 5.0)


func recevoir_etat(d: Dictionary) -> void:
	var h: Array = d.get("hud", [])
	if h.size() == 5:
		partie.hud.maj_partie(h[0], h[1], h[2], h[3], h[4])
		score = {"bleu": h[1], "rouge": h[2]}
	var avant := phase
	phase = d.get("phase", phase)
	if avant == "achat" and phase != "achat" and menu_achat and menu_achat.visible:
		basculer_achat()
	if spike and d.has("spike"):
		var sp: Array = d["spike"]
		spike.etat = sp[0]
		var porteur: Combattant = partie.par_id.get(int(sp[2]))
		spike.porteur = porteur
		spike.minuterie = sp[3]
		spike.site = sp[4]
		if sp[0] != "porte":
			spike.global_position = sp[1]
		spike.visible = sp[0] in ["sol", "pose"] or (sp[0] == "porte" and porteur != null and porteur != partie.joueur)


func _process(_dt: float) -> void:
	var l := []
	for eq in ["bleu", "rouge"]:
		var liste := []
		for c in partie.combattants:
			if c.equipe == eq and not (c is Cible):
				liste.append({"nom": c.nom_affiche, "vivant": c.vivant, "couleur": DonneesHeros.couleur_categorie(c.heros)})
		l.append(liste)
	partie.hud.maj_vivants(l[0], l[1])
	var m := Input.is_action_pressed("interagir") and partie.joueur.vivant and partie.joueur.controle
	if m != maintien:
		maintien = m
		partie.sync.rpc_id(1, "rpc_interaction", m)
	_spectateur()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("boutique") and phase == "achat" and partie.joueur.vivant:
		basculer_achat()
		get_viewport().set_input_as_handled()


## Demande d'achat à l'hôte ; la boutique se met à jour quand il répond
func acheter(_c: Combattant, article: String) -> bool:
	partie.sync.rpc_id(1, "rpc_acheter", article)
	get_tree().create_timer(0.3).timeout.connect(func() -> void:
		if menu_achat and menu_achat.visible:
			menu_achat.call("actualiser"))
	return true


func basculer_achat() -> void:
	if menu_achat == null:
		menu_achat = load("res://scripts/ui/menu_achat.gd").new()
		menu_achat.set("mode", self)
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


func _spectateur() -> void:
	var j := partie.joueur
	if j.vivant or nom_mode == "dm":
		suivi = null
		return
	if suivi == null or not suivi.vivant:
		suivi = null
		for c in partie.combattants:
			if c.vivant and c.equipe == j.equipe and c != j:
				suivi = c
				break
	if suivi:
		var b := suivi.global_transform.basis
		var cible := suivi.global_position + Vector3(0, 1.6 * suivi.taille, 0)
		j.cam.global_position = j.cam.global_position.lerp(cible + b * Vector3(0.5, 0.35, 2.4), 0.2)
		j.cam.look_at(cible + (-b.z) * 3.0)
