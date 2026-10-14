class_name Icones
extends RefCounted
## Pictogrammes des capacités (SVG originaux, assets/donnees/icones.json) rendus en textures nettes.

static var _svg: Dictionary = DonneesHeros._lire("res://assets/donnees/icones.json")
static var _cache := {}


static func texture(nom: String, taille := 96) -> Texture2D:
	var cle := nom + str(taille)
	if _cache.has(cle):
		return _cache[cle]
	var svg: String = _svg.get(nom, _svg.get("soin", ""))
	var img := Image.new()
	if svg == "" or img.load_svg_from_string(svg, taille / 24.0) != OK:
		img = Image.create(taille, taille, false, Image.FORMAT_RGBA8)
	img.generate_mipmaps()
	var t := ImageTexture.create_from_image(img)
	_cache[cle] = t
	return t


static func controle(nom: String, couleur := Color.WHITE, taille := 96) -> TextureRect:
	var r := TextureRect.new()
	r.texture = texture(nom, taille)
	r.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	r.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	r.self_modulate = couleur
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return r
