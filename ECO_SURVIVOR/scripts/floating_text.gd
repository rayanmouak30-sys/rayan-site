extends Node2D
## Texte qui monte et s'efface (ex : "+10").

@onready var label: Label = $Label


func setup(text: String, color: Color, font_size := 26) -> void:
	$Label.text = text
	$Label.add_theme_color_override("font_color", color)
	$Label.add_theme_font_size_override("font_size", font_size)


func _ready() -> void:
	scale = Vector2(0.5, 0.5)
	var tw := create_tween()
	tw.tween_property(self, "scale", Vector2.ONE, 0.15).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(self, "position:y", position.y - 60.0, 0.9).set_ease(Tween.EASE_OUT)
	tw.tween_property(self, "modulate:a", 0.0, 0.3)
	tw.tween_callback(queue_free)
