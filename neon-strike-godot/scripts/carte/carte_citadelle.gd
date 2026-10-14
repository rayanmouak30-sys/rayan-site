extends Carte
## Citadelle : carte compétitive à deux sites (A à l'ouest, B à l'est) et trois couloirs.
## Routes : A principal, connecteur A, liaison A, milieu (haut / cour / bas), liaison B, marché B, B principal,
## et deux couloirs arrière pour les rotations des défenseurs.
## Construite sur une grille de 2 m : les zones praticables sont listées, tout le reste devient bâtiment.

const CASE := 2.0
const COLS := 48
const RANGS := 56
const X0 := -48.0
const Z0 := -56.0

## [nom, c0, c1, r0, r1, matériau du sol]
const ZONES := [
	["Spawn défense", 17, 30, 1, 6, "dalles"],
	["Haut milieu", 21, 26, 7, 20, "beton"],
	["Milieu", 18, 29, 21, 38, "dalles"],
	["Bas milieu", 21, 26, 39, 47, "beton"],
	["Spawn attaque", 17, 30, 48, 54, "asphalte"],
	["Site A", 2, 14, 9, 22, "carrelage"],
	["A principal", 2, 8, 23, 45, "asphalte"],
	["Hall A", 2, 16, 44, 49, "asphalte"],
	["Liaison A", 14, 17, 21, 23, "beton_sombre"],
	["Arrière A", 6, 16, 4, 8, "beton_sombre"],
	["Site B", 33, 45, 11, 23, "dalles"],
	["B principal", 39, 45, 24, 45, "asphalte"],
	["Hall B", 31, 45, 44, 49, "asphalte"],
	["Liaison B", 30, 33, 20, 22, "beton_sombre"],
	["Arrière B", 31, 41, 4, 10, "beton_sombre"],
	["Connecteur A", 9, 17, 33, 35, "metal_strie"],
	["Marché B", 30, 38, 30, 32, "carrelage"],
]

var grille := []       # index de zone ou -1 (bâtiment)


func construire() -> void:
	nom_carte = "Citadelle"
	ambiance(Color(0.36, 0.55, 0.82), Color(0.78, 0.8, 0.84), Color(0.32, 0.3, 0.28), Color(1.0, 0.93, 0.82), 1.5, Vector3(-52, -38, 0), 0.0025)
	ambiance_vue = Color(0.7, 0.72, 0.78)
	energie_vue = 0.6
	limites = AABB(Vector3(X0, -10, Z0), Vector3(COLS * CASE, 40, RANGS * CASE))
	_remplir_grille()
	_sols()
	_batiments()
	_details_site_a()
	_details_site_b()
	_details_milieu()
	_details_couloirs()
	_eclairage()
	_apparitions()
	site("A", Vector3(-31, 0, -24), 7.0)
	site("B", Vector3(31, 0, -22), 7.0)
	# Points tactiques pour les bots : entrées des sites, postes de défense, points de regroupement des attaquants
	entrees = {
		"A": [Vector3(-38, 0, -8), Vector3(-19, 0, -14), Vector3(-26, 0, -38)],
		"B": [Vector3(42, 0, -6), Vector3(18, 0, -16), Vector3(36, 0, -36)],
	}
	postes = {
		"A": [Vector3(-40, 2.7, -35), Vector3(-42, 0, -20), Vector3(-26, 0, -30), Vector3(-30, 0, -14), Vector3(-36, 0, -26)],
		"B": [Vector3(30, 1.3, -26), Vector3(40, 0, -30), Vector3(24, 0, -12), Vector3(36, 0, -18), Vector3(22, 0, -26)],
		"milieu": [Vector3(0, 0, -26), Vector3(-3, 0, -16), Vector3(3, 0, -18)],
	}
	regroupements = {
		"A": [Vector3(-38, 0, 14), Vector3(-14, 0, 34), Vector3(0, 0, 12)],
		"B": [Vector3(42, 0, 10), Vector3(34, 0, 31), Vector3(0, 0, 12)],
	}
	zones_spawn = {"attaque": AABB(Vector3(-14, -1, 40), Vector3(28, 10, 14)), "defense": AABB(Vector3(-14, -1, -54), Vector3(28, 10, 12))}
	for z in ZONES:
		var r := _rect(z[1], z[2], z[3], z[4])
		zone(z[0], Vector3(r.position.x + r.size.x / 2, 4, r.position.y + r.size.y / 2), Vector3(r.size.x, 14, r.size.y))


func _rect(c0: int, c1: int, r0: int, r1: int) -> Rect2:
	return Rect2(X0 + c0 * CASE, Z0 + r0 * CASE, (c1 - c0 + 1) * CASE, (r1 - r0 + 1) * CASE)


func _remplir_grille() -> void:
	grille.clear()
	for r in RANGS:
		var ligne := []
		ligne.resize(COLS)
		ligne.fill(-1)
		grille.append(ligne)
	for i in ZONES.size():
		var z: Array = ZONES[i]
		for r in range(z[3], z[4] + 1):
			for c in range(z[1], z[2] + 1):
				if grille[r][c] == -1:
					grille[r][c] = i


## Fusionne les cases de même valeur en rectangles (gloutonnement)
func _rectangles(valeur_de: Callable) -> Array:
	var vu := []
	for r in RANGS:
		var l := []
		l.resize(COLS)
		l.fill(false)
		vu.append(l)
	var res := []
	for r in RANGS:
		for c in COLS:
			if vu[r][c]:
				continue
			var v: Variant = valeur_de.call(r, c)
			var c1 := c
			while c1 + 1 < COLS and not vu[r][c1 + 1] and valeur_de.call(r, c1 + 1) == v:
				c1 += 1
			var r1 := r
			var ok := true
			while ok and r1 + 1 < RANGS:
				for cc in range(c, c1 + 1):
					if vu[r1 + 1][cc] or valeur_de.call(r1 + 1, cc) != v:
						ok = false
						break
				if ok:
					r1 += 1
			for rr in range(r, r1 + 1):
				for cc in range(c, c1 + 1):
					vu[rr][cc] = true
			res.append([v, c, c1, r, r1])
	return res


func _sols() -> void:
	for rect in _rectangles(func(r: int, c: int) -> int: return grille[r][c]):
		if rect[0] < 0:
			continue
		var z: Array = ZONES[rect[0]]
		var rr := _rect(rect[1], rect[2], rect[3], rect[4])
		bloc(Vector3(rr.position.x + rr.size.x / 2, -0.5, rr.position.y + rr.size.y / 2), Vector3(rr.size.x, 1.0, rr.size.y), z[5])
	# Bordures (trottoirs) le long des murs des couloirs extérieurs
	bloc(Vector3(0, -2.0, 0), Vector3(COLS * CASE + 20, 1.0, RANGS * CASE + 20), "terre")


func _praticable(r: int, c: int) -> bool:
	return r >= 0 and r < RANGS and c >= 0 and c < COLS and grille[r][c] >= 0


func _batiments() -> void:
	var mats := ["beton", "brique", "beton_peint", "beton_sombre"]
	var n := 0
	for rect in _rectangles(func(r: int, c: int) -> int: return 1 if grille[r][c] < 0 else 0):
		if rect[0] != 1:
			continue
		var c0: int = rect[1]
		var c1: int = rect[2]
		var r0: int = rect[3]
		var r1: int = rect[4]
		var rr := _rect(c0, c1, r0, r1)
		var bord := c0 == 0 or r0 == 0 or c1 == COLS - 1 or r1 == RANGS - 1
		var h := 9.0 if bord else 6.0 + float((c0 * 7 + r0 * 13) % 4)
		var centre := Vector3(rr.position.x + rr.size.x / 2, 0, rr.position.y + rr.size.y / 2)
		# Matériau selon le quartier : briques à l'ouest (A), béton au centre, métal et béton peint à l'est (B)
		var m: String = mats[n % mats.size()]
		if centre.x < -20:
			m = "brique" if n % 3 != 0 else "beton"
		elif centre.x > 20:
			m = "beton_peint" if n % 3 != 0 else "tole"
		else:
			m = "beton" if n % 2 == 0 else "beton_sombre"
		bloc(centre + Vector3(0, h / 2, 0), Vector3(rr.size.x, h, rr.size.y), m)
		# Soubassement sombre et corniche
		bloc(centre + Vector3(0, 0.3, 0), Vector3(rr.size.x + 0.12, 0.6, rr.size.y + 0.12), "beton_sombre", 0.0, Color(1, 1, 1), false)
		bloc(centre + Vector3(0, h + 0.15, 0), Vector3(rr.size.x + 0.3, 0.3, rr.size.y + 0.3), "metal" if centre.x > 20 else "beton", 0.0, Color(1, 1, 1), false)
		_fenetres(c0, c1, r0, r1, h)
		n += 1


## Fenêtres sombres et bandes lumineuses sur les façades qui donnent sur un couloir
func _fenetres(c0: int, c1: int, r0: int, r1: int, h: float) -> void:
	if h < 6.0:
		return
	var rr := _rect(c0, c1, r0, r1)
	var y := 3.8
	# Faces nord/sud (le long de x)
	for face in [[r0 - 1, rr.position.y - 0.06], [r1 + 1, rr.position.y + rr.size.y + 0.06]]:
		var c := c0
		while c <= c1:
			if _praticable(face[0], c) and (c - c0) % 3 == 1 and c < c1:
				var x := X0 + c * CASE + CASE
				bloc(Vector3(x, y, face[1]), Vector3(1.6, 1.8, 0.1), "verre", 0.0, Color(1, 1, 1), false)
				bloc(Vector3(x, y - 0.95, face[1]), Vector3(1.9, 0.12, 0.25), "metal", 0.0, Color(1, 1, 1), false)
			c += 1
	for face in [[c0 - 1, rr.position.x - 0.06], [c1 + 1, rr.position.x + rr.size.x + 0.06]]:
		var r := r0
		while r <= r1:
			if _praticable(r, face[0]) and (r - r0) % 3 == 1 and r < r1:
				var z := Z0 + r * CASE + CASE
				bloc(Vector3(face[1], y, z), Vector3(0.1, 1.8, 1.6), "verre", 0.0, Color(1, 1, 1), false)
				bloc(Vector3(face[1], y - 0.95, z), Vector3(0.25, 0.12, 1.9), "metal", 0.0, Color(1, 1, 1), false)
			r += 1


func _caisse(pos: Vector3, taille := 2.0, empiler := false, rot := 0.0) -> void:
	bloc(pos + Vector3(0, taille / 2, 0), Vector3.ONE * taille, "caisse", rot)
	if empiler:
		bloc(pos + Vector3(0.2, taille + taille * 0.35, 0.1), Vector3.ONE * taille * 0.7, "caisse", rot + 0.3)


func _muret(a: Vector3, b: Vector3, h := 1.1, ep := 0.5, mat := "beton") -> void:
	var d := b - a
	var centre := (a + b) / 2 + Vector3(0, h / 2, 0)
	bloc(centre, Vector3(ep, h, d.length()), mat, atan2(d.x, d.z))


func _details_site_a() -> void:
	# Hauteurs A : plateforme surélevée avec escalier et garde-corps
	bloc(Vector3(-40, 1.3, -35), Vector3(8, 2.6, 6), "beton")
	bloc(Vector3(-40, 2.65, -35), Vector3(8.1, 0.1, 6.1), "metal_strie")
	escalier(Vector3(-34.5, 0, -30.0), Vector3(-34.5, 2.6, -33.5), 2.2, "metal_strie")
	_muret(Vector3(-44, 2.6, -31.9), Vector3(-36.5, 2.6, -31.9), 1.0, 0.25, "metal_peint")
	# Couverts du site
	_caisse(Vector3(-31, 0, -25), 2.2, true)
	_caisse(Vector3(-28.6, 0, -25.4), 1.4)
	_caisse(Vector3(-24, 0, -16), 2.0, false, 0.4)
	_muret(Vector3(-38, 0, -18), Vector3(-34, 0, -18))
	_muret(Vector3(-22, 0, -30), Vector3(-22, 0, -34), 1.3, 0.6, "beton_sombre")
	bloc(Vector3(-42, 1.2, -14), Vector3(2.4, 2.4, 6), "tole")   # conteneur
	# Marquage du site
	neon(Vector3(-31, 0.02, -24), Vector3(14, 0.02, 0.15), Color(1.0, 0.75, 0.3), 2.0)
	neon(Vector3(-31, 0.02, -24), Vector3(0.15, 0.02, 14), Color(1.0, 0.75, 0.3), 2.0)
	_panneau_site("A", Vector3(-19.2, 4.5, -20), PI / 2)


func _details_site_b() -> void:
	bloc(Vector3(30, 0.6, -24), Vector3(10, 1.2, 8), "beton")
	bloc(Vector3(30, 1.22, -24), Vector3(10.1, 0.06, 8.1), "metal_strie")
	rampe(Vector3(30, 0, -15.5), Vector3(30, 1.2, -20), 4.0, "metal_strie")
	_caisse(Vector3(38, 0, -14), 2.2, true, 0.2)
	_caisse(Vector3(22, 0, -30), 2.0, true)
	_caisse(Vector3(27, 1.2, -26), 1.4)
	_muret(Vector3(40, 0, -28), Vector3(43, 0, -28), 1.2, 0.5, "beton_sombre")
	bloc(Vector3(42, 1.3, -20), Vector3(2.4, 2.6, 6), "tole", 0.0)
	neon(Vector3(31, 0.02, -22), Vector3(14, 0.02, 0.15), Color(1.0, 0.75, 0.3), 2.0)
	neon(Vector3(31, 0.02, -22), Vector3(0.15, 0.02, 14), Color(1.0, 0.75, 0.3), 2.0)
	_panneau_site("B", Vector3(19.2, 4.5, -16), -PI / 2)


func _panneau_site(lettre: String, pos: Vector3, rot_y: float) -> void:
	var l := Label3D.new()
	l.text = lettre
	l.font = Style.police(700, true)
	l.font_size = 256
	l.pixel_size = 0.01
	l.modulate = Color(1.0, 0.8, 0.35)
	l.outline_size = 0
	l.position = pos
	l.rotation.y = rot_y
	l.shaded = false
	add_child(l)


func _details_milieu() -> void:
	# Fontaine octogonale (couvert bas) au centre de la cour
	bloc(Vector3(0, 0.5, 4), Vector3(4, 1.0, 4), "beton_peint", PI / 4)
	bloc(Vector3(0, 0.5, 4), Vector3(4, 1.0, 4), "beton_peint", 0.0)
	bloc(Vector3(0, 1.4, 4), Vector3(0.8, 1.8, 0.8), "metal")
	neon(Vector3(0, 2.4, 4), Vector3(0.5, 0.2, 0.5), Color(0.4, 0.9, 1.0), 4.0, 2.5, 7.0)
	_caisse(Vector3(-8, 0, 14), 2.0, true)
	_caisse(Vector3(8, 0, -8), 2.0)
	_caisse(Vector3(-9, 0, -10), 1.4)
	_muret(Vector3(-3, 0, -30), Vector3(3, 0, -30), 1.2)
	_caisse(Vector3(3, 0, 30), 2.0, false, 0.25)
	# Bancs et lampadaires de la cour
	for x in [-10.0, 10.0]:
		bloc(Vector3(x, 0.25, 4), Vector3(0.6, 0.5, 3), "bois")
		bloc(Vector3(x, 2.2, 12), Vector3(0.18, 4.4, 0.18), "metal_peint")
		neon(Vector3(x, 4.4, 12), Vector3(0.5, 0.15, 0.5), Color(1.0, 0.85, 0.6), 3.0, 1.6, 9.0)


func _details_couloirs() -> void:
	# A principal : voiture abandonnée (couvert) et caisses
	bloc(Vector3(-38, 0.75, 6), Vector3(2.0, 1.1, 4.4), "metal_peint", 0.15, Color(0.9, 0.3, 0.25))
	bloc(Vector3(-38, 1.55, 5.8), Vector3(1.8, 0.6, 2.4), "verre", 0.15)
	_caisse(Vector3(-34, 0, 24), 2.0, true)
	_caisse(Vector3(-42, 0, -4), 1.4)
	# B principal : conteneur et caisses
	bloc(Vector3(40, 1.3, 22), Vector3(2.6, 2.6, 6.5), "tole", 0.0, Color(0.6, 0.8, 1.0))
	_caisse(Vector3(34, 0, 10), 2.0)
	_caisse(Vector3(36, 0, -4), 1.4, false, 0.5)
	# Connecteur A et marché B : couloirs couverts (toit) plus sombres
	bloc(Vector3(-22, 4.2, 14), Vector3(18, 0.4, 6), "beton_sombre")
	bloc(Vector3(20, 4.2, 6), Vector3(18, 0.4, 6), "beton_sombre")
	# Barrières de spawn
	for z in [40.5, -42.5]:
		_muret(Vector3(-14, 0, z), Vector3(-7, 0, z), 2.5, 0.4, "metal")
		_muret(Vector3(7, 0, z), Vector3(14, 0, z), 2.5, 0.4, "metal")


func _eclairage() -> void:
	# Lampes chaudes dans les couloirs, néons froids sur les sites
	var lampes := [
		Vector3(-38, 5, 30), Vector3(-38, 5, 12), Vector3(-38, 5, -6), Vector3(38, 5, 30), Vector3(38, 5, 10), Vector3(38, 5, -6),
		Vector3(-22, 3.6, 14), Vector3(20, 3.6, 6), Vector3(0, 5, 34), Vector3(0, 5, -26), Vector3(-22, 4, -48), Vector3(22, 4, -48),
	]
	for p in lampes:
		lampe(p, Color(1.0, 0.82, 0.6), 1.6, 10.0)
		bloc(p + Vector3(0, 0.3, 0), Vector3(0.6, 0.12, 0.3), "metal", 0.0, Color(1, 1, 1), false)
	for s in [[Vector3(-31, 5.5, -24), Color(0.5, 0.85, 1.0)], [Vector3(31, 5.5, -22), Color(0.5, 0.85, 1.0)]]:
		lampe(s[0], s[1], 1.2, 14.0)


func _apparitions() -> void:
	for i in 5:
		var x := -8.0 + i * 4.0
		apparition("attaque", Vector3(x, 0.1, 50), Vector3(x, 0.1, 0))
		apparition("defense", Vector3(x, 0.1, -50), Vector3(x, 0.1, 0))
	apparitions["bleu"] = apparitions["attaque"]
	apparitions["rouge"] = apparitions["defense"]
