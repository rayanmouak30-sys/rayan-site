extends Node2D
# ==============================================================
#  MISSION OCÉAN - script principal
#  C'est lui qui applique les règles du jeu : apparition des
#  objets, score, vies, pollution, zones, victoire et défaite.
# ==============================================================

# Les 4 états possibles du jeu
enum Etat { TITRE, JEU, PAUSE, FIN }

const OBJET = preload("res://scenes/objet.tscn")
const FICHIER_RECORD = "user://record.save"

# ---------- Réglages du jeu (change-les pour modifier la difficulté) ----------
const OBJECTIF = 60                     # nombre de déchets à ramasser pour gagner
const DECHETS_PAR_ZONE = 12             # on change de zone tous les 12 déchets
const VIES_DEPART = 3
const VIES_MAX = 5
const POLLUTION_DEPART = 0.40           # 0 = océan propre, 1 = océan mort
const POLLUTION_DECHET_RATE = 0.07      # un déchet qui s'échappe pollue l'océan
const POLLUTION_DECHET_RAMASSE = 0.015  # un déchet ramassé le nettoie un peu
const PROBA_BONUS = 0.07                # 7 % des objets sont des bonus
const DUREE_AIMANT = 6.0
const DUREE_INVINCIBLE = 1.5
const NOMS_ZONES = ["Lagon", "Récif corallien", "Grand large", "Abysses", "Continent de plastique"]
const INFOS = [
	"Les tortues marines confondent les sacs plastiques avec des méduses, leur nourriture.",
	"Dans l'océan, une bouteille en plastique met des centaines d'années à se dégrader.",
	"Le plastique ne disparaît jamais vraiment : il se casse en microplastiques que les poissons avalent.",
	"L'aluminium d'une canette se recycle à l'infini : la trier évite d'en fabriquer une neuve.",
	"La majorité des déchets marins vient de la terre ferme, portée par les rivières et le vent.",
	"L'Objectif de développement durable n°14 de l'ONU vise à protéger la vie aquatique.",
]

# ---------- Variables de la partie en cours ----------
var etat = Etat.TITRE
var score = 0
var record = 0
var vies = VIES_DEPART
var pollution = POLLUTION_DEPART
var dechets_ramasses = 0
var combo = 0                # déchets ramassés à la suite, sans erreur
var meilleur_combo = 0
var zone = 1
var secousse = 0.0           # force du tremblement de l'écran
var instant_fin = 0          # moment où la partie s'est terminée (en millisecondes)

# ---------- Raccourcis vers les nœuds de la scène ----------
@onready var joueur = $Monde/Joueur
@onready var decor = $Monde/Decor
@onready var objets = $Monde/Objets
@onready var effets = $Monde/Effets
@onready var minuteur_objets = $Monde/MinuteurObjets
@onready var minuteur_aimant = $Monde/MinuteurAimant
@onready var camera = $Camera2D
@onready var sons = $Sons
@onready var hud = $HUD


func _ready():
	# Les touches du clavier (KEY_A et KEY_W sont les touches Q et Z d'un clavier français)
	creer_action("gauche", [KEY_LEFT, KEY_A])
	creer_action("droite", [KEY_RIGHT, KEY_D])
	creer_action("haut", [KEY_UP, KEY_W])
	creer_action("bas", [KEY_DOWN, KEY_S])
	creer_action("valider", [KEY_SPACE, KEY_ENTER])
	creer_action("pause", [KEY_P, KEY_ESCAPE])
	creer_action("son", [KEY_M])

	# Les minuteurs préviennent ce script quand leur temps est écoulé
	minuteur_objets.timeout.connect(creer_objet)
	minuteur_aimant.timeout.connect(arreter_aimant)

	charger_record()
	joueur.hide()
	hud.afficher_titre(record)


# Crée une action de jeu et lui associe des touches (position physique sur le clavier)
func creer_action(nom, touches):
	if not InputMap.has_action(nom):
		InputMap.add_action(nom)
	for touche in touches:
		var evenement = InputEventKey.new()
		evenement.physical_keycode = touche
		InputMap.action_add_event(nom, evenement)


# Appelée à chaque appui sur une touche
func _unhandled_input(event):
	if event.is_action_pressed("valider"):
		if etat == Etat.TITRE:
			demarrer_partie()
		elif etat == Etat.FIN and Time.get_ticks_msec() - instant_fin > 1000:
			demarrer_partie()
	elif event.is_action_pressed("pause"):
		if etat == Etat.JEU or etat == Etat.PAUSE:
			basculer_pause()
	elif event.is_action_pressed("son"):
		AudioServer.set_bus_mute(0, not AudioServer.is_bus_mute(0))


# Appelée à chaque image
func _process(delta):
	# Tremblement de l'écran : il diminue jusqu'à s'arrêter
	secousse = move_toward(secousse, 0.0, 40.0 * delta)
	camera.offset = Vector2(randf_range(-1.0, 1.0), randf_range(-1.0, 1.0)) * secousse

	# Le décor suit la pollution, la jauge de l'aimant suit son minuteur
	decor.pollution = pollution
	hud.afficher_aimant(minuteur_aimant.time_left / DUREE_AIMANT)


# ---------- Début, pause et fin de partie ----------

func demarrer_partie():
	for objet in objets.get_children():
		objet.queue_free()
	score = 0
	vies = VIES_DEPART
	pollution = POLLUTION_DEPART
	dechets_ramasses = 0
	combo = 0
	meilleur_combo = 0
	zone = 1
	arreter_aimant()
	joueur.reinitialiser(Vector2(200, 324))
	appliquer_zone()
	minuteur_objets.start()
	etat = Etat.JEU
	hud.afficher_jeu()
	hud.annoncer("ZONE 1 : " + NOMS_ZONES[0])
	mettre_a_jour_hud()


func basculer_pause():
	if etat == Etat.JEU:
		etat = Etat.PAUSE
	else:
		etat = Etat.JEU
	# Met en pause tout ce qui est dans le nœud "Monde" (son mode de traitement est "Pausable")
	get_tree().paused = etat == Etat.PAUSE
	hud.afficher_pause(etat == Etat.PAUSE)


func terminer_partie(victoire, raison):
	etat = Etat.FIN
	instant_fin = Time.get_ticks_msec()
	minuteur_objets.stop()
	arreter_aimant()
	joueur.actif = false

	if victoire:
		score += vies * 100      # bonus : 100 points par vie restante
		pollution = 0.0
		sons.jouer("victoire")
		# Les objets encore à l'écran éclatent
		for objet in objets.get_children():
			creer_eclat(objet.position, Color(0.7, 1.0, 0.8))
			objet.queue_free()
	else:
		sons.jouer("defaite")
		if vies <= 0:
			creer_eclat(joueur.position, Color(1.0, 0.6, 0.2))
			joueur.hide()

	var nouveau_record = score > record
	if nouveau_record:
		record = score
		sauver_record()
	hud.afficher_fin(victoire, raison, score, record, nouveau_record, dechets_ramasses, OBJECTIF,
			multiplicateur(meilleur_combo), INFOS.pick_random())


# ---------- La difficulté : elle augmente à chaque zone ----------

func vitesse_objets():
	return 170.0 + 40.0 * (zone - 1)

func intervalle_objets():
	return max(0.55, 1.15 - 0.14 * (zone - 1))

func proba_danger():
	return 0.20 + 0.04 * (zone - 1)

func appliquer_zone():
	minuteur_objets.wait_time = intervalle_objets()
	decor.vitesse_defilement = 70.0 + 25.0 * (zone - 1)
	decor.profondeur = (zone - 1) / float(NOMS_ZONES.size() - 1)

func changer_zone():
	zone += 1
	appliquer_zone()
	sons.jouer("zone")
	hud.annoncer("ZONE %d : %s" % [zone, NOMS_ZONES[zone - 1]])


# ---------- Les objets ----------

# Appelée par le minuteur : fait apparaître un nouvel objet à droite de l'écran
func creer_objet():
	var objet = OBJET.instantiate()
	var tirage = randf()     # nombre au hasard entre 0 et 1
	if tirage < PROBA_BONUS:
		if vies < VIES_MAX and randf() < 0.5:
			objet.type = "vie"
		else:
			objet.type = "aimant"
	elif tirage < PROBA_BONUS + proba_danger():
		objet.type = "danger"
	else:
		objet.type = "dechet"
	objet.position = Vector2(1152 + 60, randf_range(125.0, 550.0))
	objet.vitesse = vitesse_objets() * randf_range(0.85, 1.15)
	objet.joueur = joueur
	objet.attrape.connect(_on_objet_attrape)
	objet.sorti.connect(_on_objet_sorti)
	objets.add_child(objet)


# Le drone a touché un objet (signal "attrape" de objet.gd)
func _on_objet_attrape(objet):
	if etat != Etat.JEU:
		return
	if objet.type == "dechet":
		ramasser_dechet(objet)
	elif objet.type == "danger":
		if joueur.temps_invincible > 0.0:
			return           # le drone est encore protégé : rien ne se passe
		subir_degat(objet)
	elif objet.type == "vie":
		vies = min(vies + 1, VIES_MAX)
		sons.jouer("bonus")
		creer_eclat(objet.position, Color(1.0, 0.5, 0.6))
		texte_flottant("+1 VIE", objet.position, Color(1.0, 0.6, 0.7))
	elif objet.type == "aimant":
		joueur.aimant_actif = true
		minuteur_aimant.start(DUREE_AIMANT)
		sons.jouer("bonus")
		creer_eclat(objet.position, Color(1.0, 0.9, 0.4))
		texte_flottant("AIMANT !", objet.position, Color(1.0, 0.9, 0.4))
	objet.queue_free()
	mettre_a_jour_hud()


func ramasser_dechet(objet):
	combo += 1
	meilleur_combo = max(meilleur_combo, combo)
	var points = 10 * multiplicateur(combo)
	score += points
	dechets_ramasses += 1
	pollution = max(0.0, pollution - POLLUTION_DECHET_RAMASSE)
	sons.jouer("ramasse", 1.0 + 0.06 * min(combo, 12))    # le son monte avec le combo
	creer_eclat(objet.position, Color(0.6, 1.0, 0.75))
	texte_flottant("+%d" % points, objet.position, Color(1.0, 0.95, 0.4))

	if dechets_ramasses >= OBJECTIF:
		terminer_partie(true, "Bravo ! La vie marine est de retour grâce à toi.")
	elif dechets_ramasses % DECHETS_PAR_ZONE == 0:
		changer_zone()


func subir_degat(objet):
	vies -= 1
	combo = 0
	joueur.temps_invincible = DUREE_INVINCIBLE
	secousse = 16.0
	hud.flash()
	sons.jouer("degat")
	creer_eclat(objet.position, Color(0.25, 0.2, 0.3))
	texte_flottant("-1 VIE", objet.position, Color(1.0, 0.35, 0.3))
	if vies <= 0:
		terminer_partie(false, "Ton drone est hors service...")


# Un objet est sorti de l'écran (signal "sorti" de objet.gd)
func _on_objet_sorti(objet):
	if etat != Etat.JEU or objet.type != "dechet":
		return
	# Un déchet s'est échappé : la pollution augmente et le combo est perdu
	pollution = min(1.0, pollution + POLLUTION_DECHET_RATE)
	combo = 0
	sons.jouer("rate")
	texte_flottant("POLLUTION !", Vector2(70, objet.position.y), Color(1.0, 0.4, 0.3))
	mettre_a_jour_hud()
	if pollution >= 1.0:
		terminer_partie(false, "Trop de déchets t'ont échappé : l'océan est mort.")


func arreter_aimant():
	minuteur_aimant.stop()
	joueur.aimant_actif = false


# ---------- Outils ----------

# Le multiplicateur de points : x1, puis x2 après 5 déchets à la suite, etc. (maximum x5)
func multiplicateur(valeur_combo):
	return min(1 + int(valeur_combo / 5.0), 5)


func mettre_a_jour_hud():
	hud.mettre_a_jour(score, vies, pollution, dechets_ramasses, OBJECTIF, zone,
			NOMS_ZONES.size(), NOMS_ZONES[zone - 1], multiplicateur(combo))


# Une gerbe de bulles colorées à l'endroit indiqué
func creer_eclat(endroit, couleur):
	var eclat = CPUParticles2D.new()
	eclat.position = endroit
	eclat.texture = preload("res://assets/bulle.svg")
	eclat.amount = 16
	eclat.lifetime = 0.7
	eclat.one_shot = true
	eclat.explosiveness = 1.0
	eclat.spread = 180.0
	eclat.gravity = Vector2(0, -120)
	eclat.initial_velocity_min = 80.0
	eclat.initial_velocity_max = 220.0
	eclat.scale_amount_min = 0.5
	eclat.scale_amount_max = 1.3
	eclat.color = couleur
	eclat.emitting = true
	eclat.finished.connect(eclat.queue_free)    # l'éclat se supprime tout seul à la fin
	effets.add_child(eclat)


# Un petit texte qui monte et s'efface (exemple : "+10")
func texte_flottant(texte, endroit, couleur):
	var etiquette = Label.new()
	etiquette.text = texte
	etiquette.position = endroit + Vector2(-30, -50)
	etiquette.add_theme_font_size_override("font_size", 26)
	etiquette.add_theme_color_override("font_color", couleur)
	etiquette.add_theme_color_override("font_outline_color", Color(0.0, 0.1, 0.25))
	etiquette.add_theme_constant_override("outline_size", 8)
	effets.add_child(etiquette)
	var animation = etiquette.create_tween()
	animation.tween_property(etiquette, "position:y", etiquette.position.y - 60.0, 0.8)
	animation.parallel().tween_property(etiquette, "modulate:a", 0.0, 0.8)
	animation.tween_callback(etiquette.queue_free)


# ---------- Le record, enregistré dans un fichier ----------

func charger_record():
	if FileAccess.file_exists(FICHIER_RECORD):
		var fichier = FileAccess.open(FICHIER_RECORD, FileAccess.READ)
		if fichier != null:
			record = fichier.get_32()


func sauver_record():
	var fichier = FileAccess.open(FICHIER_RECORD, FileAccess.WRITE)
	if fichier != null:
		fichier.store_32(record)
