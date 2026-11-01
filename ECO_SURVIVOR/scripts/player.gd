extends CharacterBody2D
# Script du joueur : déplacement et santé.

signal sante_change(sante)
signal mort

var vitesse = 250
var sante = 100
var invincible = 0.0   # temps restant d'invincibilité (en secondes)


func _physics_process(delta):
	# lecture des touches (ZQSD ou flèches)
	var direction = Input.get_vector("gauche", "droite", "haut", "bas")

	# déplacement fluide
	velocity = velocity.lerp(direction * vitesse, 0.2)
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
