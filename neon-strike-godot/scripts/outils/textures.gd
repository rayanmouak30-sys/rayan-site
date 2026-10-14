class_name Textures
extends RefCounted
## Petites textures générées au démarrage (flash, étincelle, trou de balle, fumée), gardées en cache.

static var _cache := {}


static func _radiale(cle: String, taille: int, couleurs: PackedColorArray, positions: PackedFloat32Array) -> Texture2D:
	if _cache.has(cle):
		return _cache[cle]
	var g := Gradient.new()
	g.colors = couleurs
	g.offsets = positions
	var t := GradientTexture2D.new()
	t.gradient = g
	t.fill = GradientTexture2D.FILL_RADIAL
	t.fill_from = Vector2(0.5, 0.5)
	t.fill_to = Vector2(0.5, 0.0)
	t.width = taille
	t.height = taille
	_cache[cle] = t
	return t


## Éclat lumineux (flash de bouche, étincelles)
static func eclat() -> Texture2D:
	if _cache.has("eclat"):
		return _cache["eclat"]
	var n := 128
	var img := Image.create(n, n, false, Image.FORMAT_RGBA8)
	for y in n:
		for x in n:
			var d := Vector2(x - n / 2.0 + 0.5, y - n / 2.0 + 0.5) / (n / 2.0)
			var r := d.length()
			var a := atan2(d.y, d.x)
			var branches := pow(absf(cos(a * 3.0)), 18.0) * 0.6 + pow(absf(cos(a * 2.0 + 0.4)), 30.0) * 0.4
			var v := clampf(exp(-r * r * 9.0) + branches * maxf(0.0, 1.0 - r) * 0.8, 0.0, 1.0)
			img.set_pixel(x, y, Color(1, 1, 1, v))
	var t := ImageTexture.create_from_image(img)
	_cache["eclat"] = t
	return t


static func point_lumineux() -> Texture2D:
	return _radiale("point", 64, PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0.35), Color(1, 1, 1, 0)]), PackedFloat32Array([0.0, 0.3, 1.0]))


static func fumee() -> Texture2D:
	if _cache.has("fumee"):
		return _cache["fumee"]
	var n := 128
	var img := Image.create(n, n, false, Image.FORMAT_RGBA8)
	var bruit := FastNoiseLite.new()
	bruit.frequency = 0.05
	bruit.fractal_octaves = 4
	for y in n:
		for x in n:
			var d := Vector2(x - n / 2.0, y - n / 2.0).length() / (n / 2.0)
			var v := clampf((1.0 - d) * 1.3, 0.0, 1.0) * (0.6 + 0.4 * bruit.get_noise_2d(x, y))
			img.set_pixel(x, y, Color(1, 1, 1, clampf(v, 0.0, 1.0)))
	var t := ImageTexture.create_from_image(img)
	_cache["fumee"] = t
	return t


## Trou de balle (décalcomanie) : impact sombre, bord éclaté, petites fissures
static func trou_balle() -> Texture2D:
	if _cache.has("trou"):
		return _cache["trou"]
	var n := 64
	var img := Image.create(n, n, false, Image.FORMAT_RGBA8)
	var rng := RandomNumberGenerator.new()
	rng.seed = 42
	var fissures := []
	for i in 7:
		fissures.append(rng.randf() * TAU)
	for y in n:
		for x in n:
			var d := Vector2(x - n / 2.0 + 0.5, y - n / 2.0 + 0.5) / (n / 2.0)
			var r := d.length()
			var a := atan2(d.y, d.x)
			var coeur := clampf((0.22 - r) * 12.0, 0.0, 1.0)
			var halo := clampf((0.55 - r) * 2.5, 0.0, 1.0) * 0.55
			var f := 0.0
			for fa in fissures:
				var da := absf(wrapf(a - float(fa), -PI, PI))
				f = maxf(f, clampf(1.0 - da * 14.0 / maxf(r, 0.05), 0.0, 1.0) * clampf((0.85 - r) * 3.0, 0.0, 1.0))
			var alpha := clampf(maxf(coeur, maxf(halo, f * 0.8)), 0.0, 1.0)
			var c := lerpf(0.22, 0.02, coeur)
			img.set_pixel(x, y, Color(c, c * 0.97, c * 0.95, alpha))
	var t := ImageTexture.create_from_image(img)
	_cache["trou"] = t
	return t
