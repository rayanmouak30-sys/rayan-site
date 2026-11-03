extends Area2D
# ==============================================================
#  UN OBJET qui dérive dans l'eau, de la droite vers la gauche.
#  Selon son type, c'est un déchet, un danger ou un bonus.
# ==============================================================

signal attrape(objet)     # envoyé quand le drone touche l'objet
signal sorti(objet)       # envoyé quand l'objet quitte l'écran par la gauche

const IMAGES_DECHETS = [
	preload("res://assets/bouteille.svg"),
	preload("res://assets/canette.svg"),
	preload("res://assets/sac.svg"),
	preload("res://assets/gobelet.svg"),
]
const IMAGES_DANGERS = [
	preload("res://assets/baril.svg"),
	preload("res://assets/petrole.svg"),
]
const IMAGE_VIE = preload("res://assets/bonus_vie.svg")
const IMAGE_AIMANT = preload("res://assets/aimant.svg")

const PORTEE_AIMANT = 300.0    # distance à laquelle l'aimant attire un déchet
const FORCE_AIMANT = 480.0     # vitesse d'attraction en pixels par seconde

# Ces 3 variables sont réglées par main.gd juste avant d'ajouter l'objet au jeu
var type = "dechet"            # "dechet", "danger", "vie" ou "aimant"
var vitesse = 200.0
var joueur = null

var temps = 0.0
var y_depart = 0.0
var amplitude = 0.0
var vitesse_rotation = 0.0


func _ready():
	# La collision : quand un corps entre dans la zone, on appelle _on_body_entered
	body_entered.connect(_on_body_entered)

	y_depart = position.y
	amplitude = randf_range(6.0, 26.0)
	temps = randf_range(0.0, TAU)

	# On choisit l'image selon le type
	if type == "dechet":
		$Sprite2D.texture = IMAGES_DECHETS.pick_random()
		vitesse_rotation = randf_range(-1.5, 1.5)
	elif type == "danger":
		$Sprite2D.texture = IMAGES_DANGERS.pick_random()
		vitesse_rotation = randf_range(-0.4, 0.4)
	elif type == "vie":
		$Sprite2D.texture = IMAGE_VIE
	else:
		$Sprite2D.texture = IMAGE_AIMANT


func _process(delta):
	temps += delta

	# L'objet avance vers la gauche en ondulant de haut en bas (fonction sinus)
	position.x -= vitesse * delta
	position.y = y_depart + sin(temps * 2.0) * amplitude
	$Sprite2D.rotation += vitesse_rotation * delta

	# Les bonus "battent" pour attirer l'oeil
	if type == "vie" or type == "aimant":
		$Sprite2D.scale = Vector2.ONE * (1.0 + sin(temps * 6.0) * 0.08)

	# Bonus aimant : les déchets proches sont attirés vers le drone
	if type == "dechet" and joueur != null and joueur.aimant_actif:
		var ecart = joueur.global_position - global_position
		if ecart.length() < PORTEE_AIMANT:
			var deplacement = ecart.normalized() * FORCE_AIMANT * delta
			position.x += deplacement.x
			y_depart += deplacement.y

	# L'objet est sorti de l'écran : on prévient main.gd puis on le supprime
	if position.x < -80.0:
		sorti.emit(self)
		queue_free()

	queue_redraw()


# Dessine un halo derrière l'image : rouge = danger, doré = bonus
func _draw():
	if type == "danger":
		draw_circle(Vector2.ZERO, 44.0 + sin(temps * 6.0) * 4.0, Color(1.0, 0.15, 0.1, 0.28))
	elif type == "vie" or type == "aimant":
		draw_circle(Vector2.ZERO, 38.0 + sin(temps * 6.0) * 3.0, Color(1.0, 0.95, 0.4, 0.3))


func _on_body_entered(body):
	if body == joueur:
		attrape.emit(self)
