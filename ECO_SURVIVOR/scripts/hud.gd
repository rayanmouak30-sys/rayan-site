extends CanvasLayer
## HUD : affichage du score, de l'objectif, du temps, des vies, de la santé,
## de l'énergie et des déchets récupérés. Mis à jour par les signaux du GameManager.

const HEART := preload("res://assets/ui/heart.png")
const HEART_EMPTY := preload("res://assets/ui/heart_empty.png")

@onready var score_label: Label = %ScoreLabel
@onready var objective_bar: ProgressBar = %ObjectiveBar
@onready var objective_label: Label = %ObjectiveLabel
@onready var time_label: Label = %TimeLabel
@onready var level_label: Label = %LevelLabel
@onready var hearts: Array = [%Heart1, %Heart2, %Heart3]
@onready var health_bar: ProgressBar = %HealthBar
@onready var energy_bar: ProgressBar = %EnergyBar
@onready var count_labels := {
	"plastique": %PlasticCount, "papier": %PaperCount, "verre": %GlassCount, "electronique": %EwasteCount,
}
@onready var total_label: Label = %TotalLabel
@onready var banner: Label = %Banner
@onready var sub_banner: Label = %SubBanner
@onready var toast: Label = %Toast

var _lives := 3
var _banner_tween: Tween
var _toast_tween: Tween


func _ready() -> void:
	banner.modulate.a = 0.0
	sub_banner.modulate.a = 0.0
	toast.modulate.a = 0.0
	# chaque barre a son propre style pour changer sa couleur
	for bar in [health_bar, energy_bar, objective_bar]:
		bar.add_theme_stylebox_override("fill", bar.get_theme_stylebox("fill").duplicate())


func _set_fill(bar: ProgressBar, color: Color) -> void:
	(bar.get_theme_stylebox("fill") as StyleBoxFlat).bg_color = color


func _punch(node: Control, amount := 1.25) -> void:
	node.pivot_offset = node.size / 2.0
	node.scale = Vector2.ONE * amount
	create_tween().tween_property(node, "scale", Vector2.ONE, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


func update_score(score: int, target: int) -> void:
	if str(score) != score_label.text:
		_punch(score_label)
	score_label.text = str(score)
	objective_bar.max_value = target
	create_tween().tween_property(objective_bar, "value", float(mini(score, target)), 0.3)
	objective_label.text = "OBJECTIF  %d / %d" % [score, target]
	_set_fill(objective_bar, Color("a6ff4d") if score >= target * 0.75 else Color("3ef2d0"))


func update_time(time_left: float) -> void:
	var s := int(ceil(time_left))
	time_label.text = "%02d:%02d" % [s / 60, s % 60]
	if time_left <= 10.0:
		time_label.modulate = Color(1, 0.35, 0.35)
		time_label.pivot_offset = time_label.size / 2.0
		time_label.scale = Vector2.ONE * (1.0 + 0.08 * absf(sin(time_left * PI)))
	elif time_left <= 30.0:
		time_label.modulate = Color(1, 0.85, 0.4)
	else:
		time_label.modulate = Color.WHITE


func update_level(level: int) -> void:
	level_label.text = "POLLUTION  NIV. %d / 5" % level
	var colors := [Color("a6ff4d"), Color("d9ff4d"), Color("ffd84a"), Color("ff9a3d"), Color("ff4d4d")]
	level_label.add_theme_color_override("font_color", colors[clampi(level - 1, 0, 4)])
	if level > 1:
		_punch(level_label, 1.4)


func update_lives(lives: int) -> void:
	for i in hearts.size():
		hearts[i].texture = HEART if i < lives else HEART_EMPTY
	if lives < _lives and lives >= 0 and lives < hearts.size():
		_punch(hearts[lives], 1.8)
	_lives = lives


func update_health(health: float, max_health: float) -> void:
	health_bar.max_value = max_health
	create_tween().tween_property(health_bar, "value", health, 0.15)
	var ratio := health / max_health
	_set_fill(health_bar, Color("5be37a") if ratio > 0.6 else (Color("ffd84a") if ratio > 0.3 else Color("ff4d6d")))


func update_energy(energy: float, max_energy: float, exhausted: bool) -> void:
	energy_bar.max_value = max_energy
	energy_bar.value = energy
	if exhausted:
		_set_fill(energy_bar, Color(0.5, 0.55, 0.6) if fmod(Time.get_ticks_msec() / 250.0, 2.0) < 1.0 else Color(0.9, 0.4, 0.3))
	else:
		_set_fill(energy_bar, Color("3ef2d0"))


func update_waste(counts: Dictionary, total: int) -> void:
	for key in count_labels:
		var lbl: Label = count_labels[key]
		var txt := str(counts[key])
		if lbl.text != txt:
			_punch(lbl, 1.5)
		lbl.text = txt
	total_label.text = "DÉCHETS RÉCUPÉRÉS : %d" % total


func show_banner(title: String, subtitle := "", color := Color.WHITE) -> void:
	banner.text = title
	sub_banner.text = subtitle
	banner.add_theme_color_override("font_color", color)
	if _banner_tween:
		_banner_tween.kill()
	banner.pivot_offset = banner.size / 2.0
	banner.scale = Vector2(1.5, 1.5)
	_banner_tween = create_tween()
	_banner_tween.set_parallel()
	_banner_tween.tween_property(banner, "scale", Vector2.ONE, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_banner_tween.tween_property(banner, "modulate:a", 1.0, 0.2)
	_banner_tween.tween_property(sub_banner, "modulate:a", 1.0, 0.3)
	_banner_tween.chain().tween_interval(1.6)
	_banner_tween.chain().tween_property(banner, "modulate:a", 0.0, 0.4)
	_banner_tween.parallel().tween_property(sub_banner, "modulate:a", 0.0, 0.4)


func show_toast(text: String, color := Color.WHITE) -> void:
	toast.text = text
	toast.add_theme_color_override("font_color", color)
	if _toast_tween:
		_toast_tween.kill()
	toast.modulate.a = 1.0
	_toast_tween = create_tween()
	_toast_tween.tween_interval(1.4)
	_toast_tween.tween_property(toast, "modulate:a", 0.0, 0.5)
