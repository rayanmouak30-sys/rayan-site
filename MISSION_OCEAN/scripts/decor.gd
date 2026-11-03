extends Node2D
# ==============================================================
#  LE DÉCOR : il est entièrement dessiné par le code dans _draw().
#  Plus la pollution est forte, plus l'eau devient trouble, les
#  coraux blanchissent et les poissons disparaissent.
# ==============================================================

const LARGEUR = 1152.0
const HAUTEUR = 648.0
const NIVEAU_SOL = 596.0
const NOMBRE_POISSONS = 14
const ECART_ALGUES = 170.0
const IMAGE_POISSON = preload("res://assets/poisson.svg")
const COULEURS_POISSONS = [
	Color("ffb703"), Color("fb8500"), Color("ff70a6"), Color("90e0ef"), Color("b5e48c"),
]

# Ces variables sont réglées par main.gd
var pollution = 0.4              # 0 = océan propre, 1 = océan mort
var profondeur = 0.0             # 0 en zone 1, 1 en dernière zone : l'eau s'assombrit
var vitesse_defilement = 70.0    # vitesse à laquelle le fond défile

var pollution_affichee = 0.4     # suit "pollution" en douceur pour éviter les sauts de couleur
var defilement = 0.0             # distance parcourue depuis le début
var temps = 0.0
var poissons = []


func _ready():
	# On crée les poissons : chacun est un dictionnaire de valeurs
	for i in NOMBRE_POISSONS:
		poissons.append({
			"x": randf_range(0.0, LARGEUR),
			"y": randf_range(130.0, 520.0),
			"vitesse": randf_range(30.0, 90.0),
			"taille": randf_range(0.5, 1.0),
			"couleur": COULEURS_POISSONS.pick_random(),
			"decalage": randf_range(0.0, TAU),
			"opacite": 0.0,
		})


func _process(delta):
	temps += delta
	defilement += vitesse_defilement * delta
	pollution_affichee = lerp(pollution_affichee, pollution, 2.0 * delta)

	# Moins il y a de pollution, plus il y a de poissons visibles
	var nombre_visibles = int(round(NOMBRE_POISSONS * (1.0 - pollution_affichee)))
	for i in NOMBRE_POISSONS:
		var poisson = poissons[i]
		poisson["x"] -= (poisson["vitesse"] + vitesse_defilement * 0.5) * delta
		if poisson["x"] < -60.0:
			poisson["x"] = LARGEUR + 60.0
			poisson["y"] = randf_range(130.0, 520.0)
		var opacite_voulue = 0.75 if i < nombre_visibles else 0.0
		poisson["opacite"] = move_toward(poisson["opacite"], opacite_voulue, delta * 0.6)

	queue_redraw()   # redemande le dessin à chaque image


func _draw():
	dessiner_eau()
	dessiner_rayons()
	dessiner_collines(0.15, 455.0, 45.0, melange(Color(0.0, 0.47, 0.71, 0.35), Color(0.36, 0.38, 0.26, 0.5)))
	dessiner_collines(0.35, 505.0, 55.0, melange(Color(0.01, 0.24, 0.54, 0.6), Color(0.24, 0.25, 0.16, 0.75)))
	dessiner_poissons()
	dessiner_sol()


# Mélange une couleur "océan propre" et une couleur "océan pollué" selon la pollution
func melange(couleur_propre, couleur_polluee):
	return couleur_propre.lerp(couleur_polluee, pollution_affichee)


# L'eau : un dégradé du haut (clair) vers le bas (sombre)
func dessiner_eau():
	var haut = melange(Color("56cfe1"), Color("8a9a5b")).darkened(profondeur * 0.45)
	var bas = melange(Color("03045e"), Color("33301c")).darkened(profondeur * 0.3)
	draw_polygon(
		PackedVector2Array([Vector2(0, 0), Vector2(LARGEUR, 0), Vector2(LARGEUR, HAUTEUR), Vector2(0, HAUTEUR)]),
		PackedColorArray([haut, haut, bas, bas]))


# Les rayons de soleil : ils disparaissent quand l'eau est polluée
func dessiner_rayons():
	var force = (1.0 - pollution_affichee) * (1.0 - profondeur * 0.6)
	for i in 6:
		var x = 80.0 + i * 200.0 + sin(temps * 0.3 + i) * 30.0
		var clair = Color(1, 1, 1, (0.11 + 0.05 * sin(temps * 0.7 + i * 1.7)) * force)
		var transparent = Color(1, 1, 1, 0)
		draw_polygon(
			PackedVector2Array([Vector2(x, 0), Vector2(x + 70.0, 0), Vector2(x - 110.0, 560.0), Vector2(x - 230.0, 560.0)]),
			PackedColorArray([clair, clair, transparent, transparent]))


# Des collines au loin. "parallaxe" : plus c'est petit, plus la colline est loin et défile lentement
func dessiner_collines(parallaxe, hauteur_base, relief, couleur):
	var points = PackedVector2Array()
	for i in 38:
		var x = i * 32.0
		var x_monde = x + defilement * parallaxe
		var y = hauteur_base + sin(x_monde * 0.006 + parallaxe * 20.0) * relief + sin(x_monde * 0.017) * relief * 0.4
		points.append(Vector2(x, y))
	points.append(Vector2(37 * 32.0, HAUTEUR))
	points.append(Vector2(0, HAUTEUR))
	draw_colored_polygon(points, couleur)


# Hauteur du sable à la position x de l'écran (le sol est une somme de deux sinus)
func hauteur_sol(x):
	var x_monde = x + defilement
	return NIVEAU_SOL + sin(x_monde * 0.010) * 12.0 + sin(x_monde * 0.031) * 6.0


# Le fond marin : sable, algues et coraux
func dessiner_sol():
	# Les algues et les coraux sont espacés régulièrement et défilent avec le sol
	var premier = int(floor(defilement / ECART_ALGUES))
	for numero in range(premier, premier + 9):
		var x = numero * ECART_ALGUES - defilement
		var pied = Vector2(x, hauteur_sol(x) + 6.0)
		if numero % 3 == 0:
			dessiner_corail(pied, numero)
		else:
			dessiner_algue(pied, 55.0 + (numero * 37) % 60, numero)
			dessiner_algue(pied + Vector2(16.0, 0.0), 35.0 + (numero * 53) % 40, numero + 3)

	# Le sable, dessiné par-dessus le pied des algues
	var points = PackedVector2Array()
	for i in 38:
		var x = i * 32.0
		points.append(Vector2(x, hauteur_sol(x)))
	points.append(Vector2(37 * 32.0, HAUTEUR))
	points.append(Vector2(0, HAUTEUR))
	draw_colored_polygon(points, melange(Color("e9c46a"), Color("7a6f4b")).darkened(profondeur * 0.35))


# Une algue : une ligne brisée dont chaque point ondule avec le temps
func dessiner_algue(pied, hauteur, numero):
	var points = PackedVector2Array()
	for i in 7:
		var avancement = i / 6.0     # 0 au pied, 1 au sommet
		var ondulation = sin(temps * 1.6 + i * 0.7 + numero) * 9.0 * avancement
		points.append(pied + Vector2(ondulation, -hauteur * avancement))
	var couleur = melange(Color("2d9c5a"), Color("5e5b34")).darkened(profondeur * 0.3)
	draw_polyline(points, couleur, 7.0, true)


# Un corail : coloré dans un océan propre, blanc quand il est pollué (blanchissement)
func dessiner_corail(pied, numero):
	var couleur_vive = Color("ff6b9d") if numero % 2 == 0 else Color("ff9e00")
	var couleur = melange(couleur_vive, Color("cfcfc4")).darkened(profondeur * 0.25)
	draw_circle(pied + Vector2(0.0, -14.0), 20.0, couleur)
	draw_circle(pied + Vector2(-20.0, -4.0), 14.0, couleur.darkened(0.12))
	draw_circle(pied + Vector2(21.0, -6.0), 15.0, couleur.lightened(0.12))
	draw_circle(pied + Vector2(6.0, -34.0), 11.0, couleur.lightened(0.2))


func dessiner_poissons():
	for poisson in poissons:
		if poisson["opacite"] < 0.01:
			continue
		var ondulation = sin(temps * 3.0 + poisson["decalage"]) * 6.0
		var couleur = poisson["couleur"]
		couleur.a = poisson["opacite"]
		# On déplace le "repère" de dessin sur le poisson, retourné pour qu'il nage vers la gauche
		draw_set_transform(Vector2(poisson["x"], poisson["y"] + ondulation), 0.0, Vector2(-poisson["taille"], poisson["taille"]))
		draw_texture(IMAGE_POISSON, -IMAGE_POISSON.get_size() / 2.0, couleur)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)   # on remet le repère normal
