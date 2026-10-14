class_name Viseur
extends Control
## Viseur personnalisable : couleur, longueur, épaisseur, écart, point central, contour, écart dynamique.
## Dessiné au pixel près, centré à l'écran.

var ecart_dyn := 0.0        # pixels ajoutés selon l'imprécision
var cache := false          # caché en visée lunette / couteau
var apercu := {}            # réglages forcés (éditeur de viseur)
var marque_t := 0.0         # marqueur de touche
var marque_tete := false
var marque_mortel := false


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func r(cle: String) -> Variant:
	return apercu.get(cle, Reglages.lire("viseur_" + cle))


func touche(tete: bool, mortel: bool) -> void:
	marque_t = 0.22 if not mortel else 0.4
	marque_tete = tete
	marque_mortel = mortel


func _process(dt: float) -> void:
	marque_t = maxf(0.0, marque_t - dt)
	queue_redraw()


func _draw() -> void:
	var c := (size * 0.5).floor()
	if not cache:
		var couleur: Color = r("couleur")
		var l: float = r("longueur")
		var ep: float = r("epaisseur")
		var e: float = r("ecart") + (ecart_dyn if r("dynamique") else 0.0)
		var contour: bool = r("contour")
		var traits := [
			Rect2(c.x + e, c.y - ep / 2.0, l, ep), Rect2(c.x - e - l, c.y - ep / 2.0, l, ep),
			Rect2(c.x - ep / 2.0, c.y + e, ep, l), Rect2(c.x - ep / 2.0, c.y - e - l, ep, l),
		]
		if l > 0.0:
			for t in traits:
				var rt: Rect2 = t
				rt.position = rt.position.round()
				if contour:
					draw_rect(rt.grow(1.0), Color(0, 0, 0, 0.75))
			for t in traits:
				var rt: Rect2 = t
				rt.position = rt.position.round()
				draw_rect(rt, couleur)
		if r("point"):
			var p := Rect2(c - Vector2(ep, ep) / 2.0, Vector2(ep, ep))
			p.position = p.position.round()
			if contour:
				draw_rect(p.grow(1.0), Color(0, 0, 0, 0.75))
			draw_rect(p, couleur)
	if marque_t > 0.0:
		var a := clampf(marque_t / 0.15, 0.0, 1.0)
		var col := Color(1.0, 0.25, 0.25, a) if marque_mortel else (Color(1.0, 0.85, 0.3, a) if marque_tete else Color(1, 1, 1, a))
		var d := 9.0 + (1.0 - a) * 3.0
		var lg := 7.0
		for s in [Vector2(1, 1), Vector2(-1, 1), Vector2(1, -1), Vector2(-1, -1)]:
			draw_line(c + s * d, c + s * (d + lg), Color(0, 0, 0, a * 0.6), 4.0, true)
			draw_line(c + s * d, c + s * (d + lg), col, 2.0, true)
