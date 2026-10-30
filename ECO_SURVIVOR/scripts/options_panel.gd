extends PanelContainer
## PANNEAU OPTIONS : volumes, difficulté, plein écran, tremblements d'écran.
## Les réglages sont sauvegardés (fichier user://eco_survivor.cfg).

signal closed

@onready var music_slider: HSlider = %MusicSlider
@onready var sfx_slider: HSlider = %SfxSlider
@onready var difficulty_option: OptionButton = %DifficultyOption
@onready var fullscreen_check: CheckButton = %FullscreenCheck
@onready var shake_check: CheckButton = %ShakeCheck
@onready var info_label: Label = %InfoLabel


func _ready() -> void:
	difficulty_option.clear()
	for d in Global.DIFFICULTIES:
		difficulty_option.add_item(d.name)
	music_slider.value = Global.music_volume
	sfx_slider.value = Global.sfx_volume
	difficulty_option.selected = Global.difficulty
	fullscreen_check.button_pressed = Global.fullscreen
	fullscreen_check.disabled = OS.has_feature("web")
	shake_check.button_pressed = Global.screen_shake
	_update_info()
	music_slider.value_changed.connect(_on_music)
	sfx_slider.value_changed.connect(_on_sfx)
	sfx_slider.drag_ended.connect(func(_c): AudioManager.play_sfx("collect"))
	difficulty_option.item_selected.connect(_on_difficulty)
	fullscreen_check.toggled.connect(_on_fullscreen)
	shake_check.toggled.connect(_on_shake)
	%BackButton.pressed.connect(_on_back)


func open() -> void:
	UiFx.pop_in(self)
	%BackButton.grab_focus()


func _update_info() -> void:
	var d := Global.get_difficulty()
	info_label.text = "%s : %d points en %d secondes" % [d.name, d.target, int(d.duration)]


func _on_music(v: float) -> void:
	Global.music_volume = v
	AudioManager.update_volumes()


func _on_sfx(v: float) -> void:
	Global.sfx_volume = v
	AudioManager.update_volumes()


func _on_difficulty(index: int) -> void:
	Global.difficulty = index
	_update_info()


func _on_fullscreen(on: bool) -> void:
	Global.fullscreen = on
	Global.apply_display()


func _on_shake(on: bool) -> void:
	Global.screen_shake = on


func _on_back() -> void:
	Global.save_settings()
	visible = false
	closed.emit()
