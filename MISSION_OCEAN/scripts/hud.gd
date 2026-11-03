extends CanvasLayer
# ==============================================================
#  L'AFFICHAGE (HUD) : score, vies, jauges et écrans du jeu.
#  Ce script ne décide de rien : il affiche ce que main.gd lui donne.
# ==============================================================

const LARGEUR_JAUGE = 262.0
const LARGEUR_JAUGE_AIMANT = 120.0
const VERT = Color(0.35, 0.9, 0.5)
const ROUGE = Color(0.95, 0.25, 0.2)

var animation_annonce = null


func _ready():
	# Fait clignoter en boucle les textes "Appuie sur ESPACE"
	for texte in [$EcranTitre/Demarrer, $EcranFin/Rejouer]:
		var animation = create_tween().set_loops()
		animation.tween_property(texte, "modulate:a", 0.25, 0.6)
		animation.tween_property(texte, "modulate:a", 1.0, 0.6)


# ---------- Les écrans ----------

func afficher_titre(record):
	$EcranTitre.show()
	$Jeu.hide()
	$EcranPause.hide()
	$EcranFin.hide()
	$EcranTitre/Record.text = "Record à battre : %d" % record
	$EcranTitre/Record.visible = record > 0


func afficher_jeu():
	$EcranTitre.hide()
	$Jeu.show()
	$EcranPause.hide()
	$EcranFin.hide()


func afficher_pause(en_pause):
	$EcranPause.visible = en_pause


func afficher_fin(victoire, raison, score, record, nouveau_record, dechets, objectif, meilleur_multiplicateur, info):
	$Jeu.hide()
	$EcranFin.show()
	if victoire:
		$EcranFin/Titre.text = "OCÉAN SAUVÉ !"
		$EcranFin/Titre.modulate = Color(0.6, 1.0, 0.65)
	else:
		$EcranFin/Titre.text = "MISSION ÉCHOUÉE"
		$EcranFin/Titre.modulate = Color(1.0, 0.5, 0.45)
	$EcranFin/Raison.text = raison

	var lignes = "Score : %d" % score
	if nouveau_record:
		lignes += "     NOUVEAU RECORD !"
	else:
		lignes += "     Record : %d" % record
	lignes += "\nDéchets ramassés : %d / %d" % [dechets, objectif]
	lignes += "\nMeilleur combo : x%d" % meilleur_multiplicateur
	$EcranFin/Resultats.text = lignes
	$EcranFin/PanneauInfo/Info.text = info


# ---------- Les informations pendant la partie ----------

func mettre_a_jour(score, vies, pollution, dechets, objectif, zone, nombre_zones, nom_zone, multiplicateur):
	$Jeu/Score.text = "SCORE : %d" % score
	$Jeu/Zone.text = "ZONE %d/%d : %s" % [zone, nombre_zones, nom_zone]

	# Les coeurs : on montre seulement ceux qui correspondent aux vies restantes
	for i in $Jeu/Vies.get_child_count():
		$Jeu/Vies.get_child(i).visible = i < vies

	# Jauge de pollution : sa largeur et sa couleur dépendent de la pollution
	$Jeu/PollutionTexte.text = "POLLUTION : %d %%" % int(round(pollution * 100.0))
	$Jeu/PollutionBarre.size.x = LARGEUR_JAUGE * pollution
	$Jeu/PollutionBarre.color = VERT.lerp(ROUGE, pollution)

	# Jauge de progression vers la victoire
	$Jeu/DechetsTexte.text = "DÉCHETS : %d / %d" % [dechets, objectif]
	$Jeu/DechetsBarre.size.x = LARGEUR_JAUGE * dechets / float(objectif)

	$Jeu/Combo.text = "COMBO x%d" % multiplicateur
	$Jeu/Combo.visible = multiplicateur > 1


# "reste" va de 1 (aimant plein) à 0 (aimant terminé)
func afficher_aimant(reste):
	$Jeu/Aimant.visible = reste > 0.0
	$Jeu/Aimant/Barre.size.x = LARGEUR_JAUGE_AIMANT * reste


# Affiche un grand message au milieu de l'écran, qui apparaît puis s'efface
func annoncer(texte):
	$Annonce.text = texte
	$Annonce.modulate.a = 0.0
	$Annonce.scale = Vector2(0.6, 0.6)
	if animation_annonce != null:
		animation_annonce.kill()
	animation_annonce = create_tween()
	animation_annonce.tween_property($Annonce, "modulate:a", 1.0, 0.3)
	animation_annonce.parallel().tween_property($Annonce, "scale", Vector2.ONE, 0.3)
	animation_annonce.tween_interval(1.4)
	animation_annonce.tween_property($Annonce, "modulate:a", 0.0, 0.5)


# Flash rouge sur tout l'écran quand le drone est touché
func flash():
	$Flash.color.a = 0.45
	create_tween().tween_property($Flash, "color:a", 0.0, 0.4)
