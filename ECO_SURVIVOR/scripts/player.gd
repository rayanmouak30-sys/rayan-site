extends CharacterBody2D
# Script du joueur : déplacement, sprint, santé.

signal sante_change(sante)
signal energie_change(energie)
signal mort

var vitesse = 250
var vitesse_sprint = 400
var sante = 100
var energie = 100
var invincible = 0.0   # temps restant d'invincibilité (en secondes)


func _physics_process(delta):
	# lecture des touches (ZQSD ou flèches)
	var direction = Input.get_vector("gauche", "droite", "haut", "bas")

	# sprint : utilise l'énergie (ressource à économiser)
	var v = vitesse
	if Input.is_action_pressed("sprint") and energie > 0 and direction != Vector2.ZERO:
		v = vitesse_sprint
		energie -= 40 * delta
	elif energie < 100:
		energie += 15 * delta
	energie = clamp(energie, 0, 100)
	energie_change.emit(energie)

	# déplacement fluide
	velocity = velocity.lerp(direction * v, 0.2)
	move_and_slide()

	# animation et orientation du personnage
	if direction != Vector2.ZERO:
		$Sprite.play("marche")
		$Sprite.rotation = direction.angle() + PI / 2
	else:
		$Sprite.play("repos")

	# clignotement quand le joueur est invincible
	if invincible > 0:
		invincible -= delta
		visible = int(invincible * 10) % 2 == 0
	else:
		visible = true


func prendre_degats(quantite):
	if invincible > 0:
		return
	sante -= quantite
	modulate = Color(1, 0.4, 0.4)   # flash rouge
	create_tween().tween_property(self, "modulate", Color(1, 1, 1), 0.3)
	if sante <= 0:
		sante = 100
		invincible = 2.0
		sante_change.emit(sante)
		mort.emit()
	else:
		sante_change.emit(sante)
