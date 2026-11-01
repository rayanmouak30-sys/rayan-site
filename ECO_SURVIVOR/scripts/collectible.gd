extends Area2D
# Script d'un objet à ramasser (déchet ou déchet toxique).

signal ramasse(objet)

var type = "plastique"
var points = 10
var temps_de_vie = 8.0
var t = 0.0

var textures = {
	"plastique": preload("res://assets/sprites/plastique.png"),
	"papier": preload("res://assets/sprites/papier.png"),
	"verre": preload("res://assets/sprites/verre.png"),
	"electronique": preload("res://assets/sprites/electronique.png"),
	"toxique": preload("res://assets/sprites/toxique.png"),
}
var valeurs = {"plastique": 10, "papier": 15, "verre": 20, "electronique": 30, "toxique": -30}


func _ready():
	$Sprite.texture = textures[type]
	points = valeurs[type]


func _process(delta):
	t += delta
	# l'objet flotte (animation)
	$Sprite.position.y = sin(t * 4) * 4
	# il clignote puis disparaît s'il n'est pas ramassé
	if t > temps_de_vie - 2:
		$Sprite.visible = int(t * 8) % 2 == 0
	if t > temps_de_vie:
		queue_free()


func _on_body_entered(body):
	if body.name == "Player":
		ramasse.emit(self)
		queue_free()
