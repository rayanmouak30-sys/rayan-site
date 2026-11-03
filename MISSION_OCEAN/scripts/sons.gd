extends Node
# ==============================================================
#  LES SONS : ils sont fabriqués par le calcul, sans fichier audio.
#  Un son est une suite de nombres (des "échantillons") qui
#  dessinent une onde. Ici on calcule une onde sinusoïdale.
# ==============================================================

const FREQUENCE_ECHANTILLONNAGE = 22050    # nombre d'échantillons par seconde
const VOLUME_MAX = 12000.0                 # sur 16 bits, le maximum possible est 32767

var sons = {}    # dictionnaire : nom du son -> son prêt à être joué


func _ready():
	# Chaque son est une liste de notes (fréquences en hertz) et une durée en secondes
	sons["ramasse"] = creer_son([880, 1320], 0.12)
	sons["rate"] = creer_son([300, 200], 0.22)
	sons["degat"] = creer_son([220, 110], 0.40, true)
	sons["bonus"] = creer_son([660, 880, 1320], 0.30)
	sons["zone"] = creer_son([523, 659, 784, 1047], 0.50)
	sons["victoire"] = creer_son([523, 659, 784, 1047, 1319, 1568], 1.00)
	sons["defaite"] = creer_son([392, 330, 262, 196], 1.00)


# Joue un son. "hauteur" permet de le rendre plus aigu (1.0 = normal)
func jouer(nom, hauteur = 1.0):
	var lecteur = AudioStreamPlayer.new()
	lecteur.stream = sons[nom]
	lecteur.pitch_scale = hauteur
	lecteur.volume_db = -6.0
	add_child(lecteur)
	lecteur.play()
	lecteur.finished.connect(lecteur.queue_free)   # le lecteur se supprime à la fin du son


# Calcule un son échantillon par échantillon
func creer_son(notes, duree, avec_bruit = false):
	var nombre = int(FREQUENCE_ECHANTILLONNAGE * duree)
	var donnees = PackedByteArray()
	donnees.resize(nombre * 2)                 # 16 bits = 2 octets par échantillon
	var phase = 0.0
	for i in nombre:
		var avancement = float(i) / nombre     # va de 0 (début) à 1 (fin)
		var numero_note = min(int(avancement * notes.size()), notes.size() - 1)
		phase += TAU * notes[numero_note] / FREQUENCE_ECHANTILLONNAGE
		var valeur = sin(phase)
		if avec_bruit:
			valeur = valeur * 0.5 + randf_range(-0.5, 0.5)
		valeur *= 1.0 - avancement             # le volume baisse jusqu'à zéro
		donnees.encode_s16(i * 2, int(valeur * VOLUME_MAX))

	var son = AudioStreamWAV.new()
	son.format = AudioStreamWAV.FORMAT_16_BITS
	son.mix_rate = FREQUENCE_ECHANTILLONNAGE
	son.stereo = false
	son.data = donnees
	return son
