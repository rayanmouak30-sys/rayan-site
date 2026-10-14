extends Carte
## Stand de tir : couloirs avec cibles à 10, 20, 30 et 50 m, zone de déplacement avec couverts, rampes et escaliers.


func construire() -> void:
	nom_carte = "Stand de tir"
	ambiance(Color(0.32, 0.5, 0.78), Color(0.72, 0.78, 0.84), Color(0.3, 0.28, 0.26), Color(1.0, 0.95, 0.86), 1.4, Vector3(-48, -35, 0), 0.002)
	# Sol et murs
	bloc(Vector3(0, -0.5, -20), Vector3(60, 1, 90), "beton")
	bloc(Vector3(0, -0.49, -38), Vector3(24, 1, 56), "dalles")
	bloc(Vector3(-30.5, 4, -20), Vector3(1, 9, 90), "beton_sombre")
	bloc(Vector3(30.5, 4, -20), Vector3(1, 9, 90), "beton_sombre")
	bloc(Vector3(0, 4, -65.5), Vector3(60, 9, 1), "beton_sombre")
	bloc(Vector3(0, 4, 25.5), Vector3(60, 9, 1), "beton_sombre")
	# Pas de tir : comptoir et séparations entre les couloirs
	bloc(Vector3(0, 0.5, -6), Vector3(24, 1.0, 0.6), "metal_peint")
	bloc(Vector3(0, 1.03, -6), Vector3(24, 0.06, 0.8), "metal")
	for i in 5:
		var x := -12.0 + i * 6.0
		bloc(Vector3(x, 1.3, -8), Vector3(0.2, 2.6, 4), "metal_peint")
		neon(Vector3(x, 2.65, -8), Vector3(0.24, 0.05, 4), Color(0.4, 0.95, 1.0), 4.0)
	# Repères de distance au sol
	for d in [10, 20, 30, 50]:
		neon(Vector3(0, 0.02, -6 - d), Vector3(24, 0.02, 0.12), Color(1.0, 0.75, 0.3), 2.5)
	# Murs de fond en béton pour voir les impacts
	bloc(Vector3(0, 3, -62), Vector3(24, 6, 1), "beton_peint")
	# Zone d'entraînement au déplacement (à droite)
	bloc(Vector3(20, 0.5, -10), Vector3(2, 1, 2), "caisse")
	bloc(Vector3(20, 1.5, -10), Vector3(1.2, 1, 1.2), "caisse")
	bloc(Vector3(16, 0.6, -18), Vector3(4, 1.2, 1), "beton")
	bloc(Vector3(24, 1.5, -26), Vector3(6, 3, 6), "brique")
	escalier(Vector3(19.5, 0, -22), Vector3(19.5, 3, -26), 2.0, "metal_strie")
	bloc(Vector3(24, 3.05, -26), Vector3(6, 0.1, 6), "metal_strie")
	rampe(Vector3(24, 0, -36), Vector3(24, 3, -29), 3.0, "beton")
	bloc(Vector3(16, 1.2, -34), Vector3(0.4, 2.4, 6), "metal")
	vitre(Vector3(16, 1.6, -40), Vector3(0.1, 2.4, 4))
	bloc(Vector3(-20, 1.0, -14), Vector3(3, 2, 0.5), "beton")
	bloc(Vector3(-22, 0.5, -24), Vector3(2, 1, 4), "bois")
	bloc(Vector3(-18, 2, -34), Vector3(4, 4, 4), "tole")
	lampe(Vector3(0, 6, -10), Color(1, 0.9, 0.75), 2.5, 16.0)
	lampe(Vector3(0, 6, -40), Color(1, 0.9, 0.75), 2.5, 16.0)
	apparition("bleu", Vector3(0, 0.1, 0), Vector3(0, 0.1, -30))
	apparition("rouge", Vector3(0, 0.1, -55), Vector3(0, 0.1, 0))
	zone("Pas de tir", Vector3(0, 2, 0), Vector3(30, 6, 14))
	zone("Couloirs", Vector3(0, 2, -35), Vector3(24, 6, 50))
	zone("Parcours", Vector3(20, 2, -25), Vector3(20, 8, 40))


## Positions des cibles (centre au sol)
func positions_cibles() -> Array[Vector3]:
	var l: Array[Vector3] = []
	for i in 4:
		var x := -9.0 + i * 6.0
		for d in [10.0, 20.0, 30.0, 50.0]:
			l.append(Vector3(x + randf_range(-1.5, 1.5), 0.0, -6.0 - d))
	return l
