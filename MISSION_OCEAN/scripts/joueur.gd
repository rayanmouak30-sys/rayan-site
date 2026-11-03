extends CharacterBody2D
# ==============================================================
#  LE JOUEUR : un drone sous-marin de dépollution
#  Il se déplace dans les 4 directions avec les flèches ou ZQSD.
# ==============================================================

const VITESSE = 430.0          # vitesse maximale en pixels par seconde
const ACCELERATION = 8.0       # plus c'est grand, plus le drone réagit vite
const ZONE_MIN = Vector2(60, 115)      # coin haut-gauche de la zone autorisée
const ZONE_MAX = Vector2(1090, 560)    # coin bas-droit de la zone autorisée

var actif = false              # false = le joueur ne contrôle pas le drone (menu, fin)
var aimant_actif = false       # true pendant le bonus aimant
var temps_invincible = 0.0     # secondes d'invincibilité restantes après un choc
var temps = 0.0                # chronomètre qui sert aux animations


func _physics_process(delta):
	temps += delta
	temps_invincible = max(0.0, temps_invincible - delta)

	# 1) Lire le clavier : on obtient une direction (x, y)
	var direction = Vector2.ZERO
	if actif:
		direction = Input.get_vector("gauche", "droite", "haut", "bas")

	# 2) La vitesse se rapproche peu à peu de la vitesse voulue (effet d'inertie dans l'eau)
	velocity = velocity.lerp(direction * VITESSE, ACCELERATION * delta)
	move_and_slide()

	# 3) Le drone ne peut pas sortir de l'écran
	position = position.clamp(ZONE_MIN, ZONE_MAX)

	# 4) Le drone penche quand il monte ou descend
	var inclinaison = velocity.y / VITESSE * 0.35
	$Sprite2D.rotation = lerp($Sprite2D.rotation, inclinaison, 10.0 * delta)

	# 5) Il clignote tant qu'il est invincible
	if temps_invincible > 0.0 and fmod(temps, 0.2) < 0.1:
		$Sprite2D.modulate.a = 0.3
	else:
		$Sprite2D.modulate.a = 1.0

	queue_redraw()   # redemande le dessin de _draw()


# Dessine les anneaux du champ magnétique quand l'aimant est actif
func _draw():
	if aimant_actif:
		var rayon = 66.0 + sin(temps * 8.0) * 6.0
		draw_arc(Vector2.ZERO, rayon, 0.0, TAU, 48, Color(1.0, 0.35, 0.35, 0.7), 3.0)
		draw_arc(Vector2.ZERO, rayon + 16.0, 0.0, TAU, 48, Color(1.0, 0.35, 0.35, 0.35), 2.0)


# Remet le drone à son état de départ (appelé par main.gd au début d'une partie)
func reinitialiser(position_depart):
	position = position_depart
	velocity = Vector2.ZERO
	aimant_actif = false
	temps_invincible = 0.0
	actif = true
	show()
