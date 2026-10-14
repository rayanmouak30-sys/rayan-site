extends Node
## Multijoueur (ENet) : un joueur héberge (il fait tourner la partie, les bots et les règles), les autres rejoignent
## avec son adresse IP (réseau local, ou Internet avec le port 7777 ouvert / un VPN type Radmin ou ZeroTier).
## Salon : pseudo, héros, équipe et état « prêt » de chaque joueur ; l'hôte choisit le mode et lance.

signal salon_change
signal connecte
signal echec(raison: String)
signal deconnecte(raison: String)

const PORT := 7777
const MAX_JOUEURS := 10
const VERSION := "1.0"

var pair: ENetMultiplayerPeer = null
var joueurs := {}          # id de pair -> {pseudo, heros, skin, equipe, pret}
var config_partie := {"mode": "spike", "difficulte": "normal", "bots": true, "carte": "citadelle"}
var en_partie := false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	multiplayer.peer_connected.connect(_pair_connecte)
	multiplayer.peer_disconnected.connect(_pair_deconnecte)
	multiplayer.connected_to_server.connect(_connecte_serveur)
	multiplayer.connection_failed.connect(func() -> void:
		quitter()
		echec.emit("Connexion impossible. Vérifiez l'adresse, le port %d et le pare-feu." % PORT))
	multiplayer.server_disconnected.connect(func() -> void:
		var etait := en_partie
		quitter()
		deconnecte.emit("L'hôte a quitté la partie.")
		if etait:
			Jeu.aller_au_menu())


func actif() -> bool:
	return pair != null


func est_hote() -> bool:
	return pair != null and multiplayer.is_server()


## Vrai si cette machine décide (solo, ou hôte en réseau)
func autorite() -> bool:
	return pair == null or multiplayer.is_server()


func mon_id() -> int:
	return multiplayer.get_unique_id() if pair else 1


func _moi() -> Dictionary:
	var p := String(Reglages.lire("pseudo"))
	return {"pseudo": p if p != "" else "Joueur", "heros": Profil.heros, "skin": Profil.skin_heros(Profil.heros), "equipe": "bleu", "pret": false, "version": VERSION}


func heberger(port := PORT) -> String:
	quitter()
	pair = ENetMultiplayerPeer.new()
	var e := pair.create_server(port, MAX_JOUEURS)
	if e != OK:
		pair = null
		return "Impossible d'ouvrir le port %d (déjà utilisé ?)." % port
	multiplayer.multiplayer_peer = pair
	joueurs = {1: _moi()}
	salon_change.emit()
	return ""


func rejoindre(adresse: String, port := PORT) -> String:
	quitter()
	pair = ENetMultiplayerPeer.new()
	var e := pair.create_client(adresse.strip_edges(), port)
	if e != OK:
		pair = null
		return "Adresse invalide."
	multiplayer.multiplayer_peer = pair
	return ""


func quitter() -> void:
	if pair:
		pair.close()
	pair = null
	joueurs.clear()
	en_partie = false
	multiplayer.multiplayer_peer = OfflineMultiplayerPeer.new()


## Adresses IP locales à communiquer aux amis (réseau local / VPN)
func adresses_locales() -> Array:
	var l := []
	for a in IP.get_local_addresses():
		if a.contains(".") and not a.begins_with("127.") and not a.begins_with("169.254"):
			l.append(a)
	return l


func _pair_connecte(_id: int) -> void:
	pass


func _pair_deconnecte(id: int) -> void:
	joueurs.erase(id)
	salon_change.emit()
	if est_hote():
		rpc("_salon", joueurs, config_partie)
		if en_partie and Jeu.partie and Jeu.partie.has_method("joueur_parti"):
			Jeu.partie.joueur_parti(id)


func _connecte_serveur() -> void:
	rpc_id(1, "_presenter", _moi())
	connecte.emit()


@rpc("any_peer", "reliable")
func _presenter(infos: Dictionary) -> void:
	if not est_hote():
		return
	var id := multiplayer.get_remote_sender_id()
	if String(infos.get("version", "")) != VERSION or en_partie:
		rpc_id(id, "_refuse", "Version différente ou partie déjà commencée.")
		return
	# Équipe la moins remplie
	var n := {"bleu": 0, "rouge": 0}
	for j in joueurs.values():
		n[j["equipe"]] += 1
	infos["equipe"] = "bleu" if n["bleu"] <= n["rouge"] else "rouge"
	infos["pret"] = false
	joueurs[id] = infos
	rpc("_salon", joueurs, config_partie)
	salon_change.emit()


@rpc("authority", "reliable")
func _refuse(raison: String) -> void:
	quitter()
	echec.emit(raison)


@rpc("authority", "reliable")
func _salon(j: Dictionary, cfg: Dictionary) -> void:
	joueurs = j
	config_partie = cfg
	salon_change.emit()


## Mise à jour de mes infos dans le salon (héros, skin, équipe, prêt)
func maj_moi(cle: String, valeur: Variant) -> void:
	if not actif():
		return
	if est_hote():
		_maj_infos(1, cle, valeur)
	else:
		rpc_id(1, "_demande_maj", cle, valeur)


@rpc("any_peer", "reliable")
func _demande_maj(cle: String, valeur: Variant) -> void:
	if est_hote():
		_maj_infos(multiplayer.get_remote_sender_id(), cle, valeur)


func _maj_infos(id: int, cle: String, valeur: Variant) -> void:
	if not joueurs.has(id) or not cle in ["heros", "skin", "equipe", "pret", "pseudo"]:
		return
	joueurs[id][cle] = valeur
	rpc("_salon", joueurs, config_partie)
	salon_change.emit()


func maj_config(cle: String, valeur: Variant) -> void:
	if est_hote():
		config_partie[cle] = valeur
		rpc("_salon", joueurs, config_partie)
		salon_change.emit()


## L'hôte lance la partie pour tout le monde
func lancer() -> void:
	if not est_hote():
		return
	en_partie = true
	rpc("_lancer", config_partie, joueurs)
	_lancer(config_partie, joueurs)


@rpc("authority", "reliable")
func _lancer(cfg: Dictionary, j: Dictionary) -> void:
	joueurs = j
	en_partie = true
	var c := cfg.duplicate()
	c["en_ligne"] = true
	c["heros"] = joueurs.get(mon_id(), {}).get("heros", Profil.heros)
	c["allies"] = bool(cfg.get("bots", true))
	Jeu.lancer_partie(c)
