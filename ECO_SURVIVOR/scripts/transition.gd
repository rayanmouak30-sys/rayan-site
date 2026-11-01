extends CanvasLayer
## TRANSITION (autoload) : change de scène avec une animation de bulles.

@onready var curtain: ColorRect = $Curtain
var _busy := false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_set_progress(0.0)
	curtain.visible = false


func change_scene(path: String) -> void:
	if _busy:
		return
	_busy = true
	curtain.visible = true
	curtain.mouse_filter = Control.MOUSE_FILTER_STOP
	var tw := create_tween()
	tw.tween_method(_set_progress, 0.0, 1.0, 0.45).set_trans(Tween.TRANS_SINE)
	await tw.finished
	get_tree().paused = false
	get_tree().change_scene_to_file(path)
	await get_tree().process_frame
	await get_tree().process_frame
	tw = create_tween()
	tw.tween_method(_set_progress, 1.0, 0.0, 0.5).set_trans(Tween.TRANS_SINE)
	await tw.finished
	curtain.visible = false
	curtain.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_busy = false


func _set_progress(value: float) -> void:
	(curtain.material as ShaderMaterial).set_shader_parameter("progress", value)
