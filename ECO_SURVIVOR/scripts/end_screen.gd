extends Control
## ÉCRAN DE FIN (utilisé par Victory.tscn et GameOver.tscn).
## Affiche les statistiques de la partie stockées dans Global.last_result.

const STAR := preload("res://assets/ui/star.png")
const STAR_EMPTY := preload("res://assets/ui/star_empty.png")
const TIPS := [
	"Astuce : les déchets électroniques valent 30 points mais disparaissent vite.",
	"Astuce : garde ton énergie pour sprinter quand un nuage arrive.",
	"Astuce : un cercle rouge annonce un futur nuage de pollution, éloigne-toi !",
	"Astuce : les voitures klaxonnent juste avant de te percuter.",
	"Astuce : ramasse les cœurs quand ta santé est basse.",
]

@export var victory := false

@onready var stars_box: HBoxContainer = get_node_or_null("%Stars")


func _ready() -> void:
	get_tree().paused = false
	AudioManager.play_music("menu")
	var r: Dictionary = Global.last_result
	if r.is_empty():
		r = {"score": 0, "target": 1000, "time_used": 0.0, "level": 1, "total": 0, "stars": 0, "reason": "time",
			"counts": {"plastique": 0, "papier": 0, "verre": 0, "electronique": 0}, "best_score": Global.best_score,
			"new_record": false}
	if not victory:
		%Subtitle.text = "Le temps est écoulé..." if r.get("reason") == "time" else "Tu as perdu tes 3 vies..."
		%Tip.text = TIPS.pick_random()
	var t := int(r.get("time_used", 0.0))
	%TimeValue.text = "%d:%02d" % [t / 60, t % 60]
	%TargetValue.text = str(r.get("target", 0))
	%LevelValue.text = "%d / 5" % r.get("level", 1)
	%TotalValue.text = str(r.get("total", 0))
	%BestValue.text = str(r.get("best_score", 0))
	var c: Dictionary = r.get("counts", {})
	%PlasticValue.text = "x%d" % c.get("plastique", 0)
	%PaperValue.text = "x%d" % c.get("papier", 0)
	%GlassValue.text = "x%d" % c.get("verre", 0)
	%EwasteValue.text = "x%d" % c.get("electronique", 0)
	%Record.visible = r.get("new_record", false)
	# animation : le score défile de 0 à sa valeur
	var tw := create_tween()
	tw.tween_interval(0.4)
	tw.tween_method(func(v): %ScoreValue.text = str(int(v)), 0.0, float(r.get("score", 0)), 1.2)
	# étoiles (victoire)
	if stars_box:
		var stars: int = r.get("stars", 0)
		for i in stars_box.get_child_count():
			var s: TextureRect = stars_box.get_child(i)
			s.texture = STAR if i < stars else STAR_EMPTY
			s.pivot_offset = Vector2(36, 36)
			s.scale = Vector2.ZERO
			var st := create_tween()
			st.tween_interval(0.5 + i * 0.25)
			st.tween_property(s, "scale", Vector2.ONE, 0.4).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	# entrée du panneau
	UiFx.pop_in(%Card)
	UiFx.setup_buttons(self)
	%RestartButton.pressed.connect(func(): Transition.change_scene("res://scenes/Main.tscn"))
	%MenuButton.pressed.connect(func(): Transition.change_scene("res://scenes/MainMenu.tscn"))
	%RestartButton.grab_focus()


func _process(_delta: float) -> void:
	if %Record.visible:
		%Record.modulate.a = 0.6 + 0.4 * sin(Time.get_ticks_msec() / 150.0)
