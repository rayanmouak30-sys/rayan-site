extends Node2D
## GAME MANAGER : chef d'orchestre d'une partie.
## - compte le score, le temps, les vies et les déchets ramassés
## - fait apparaître déchets, bonus, déchets toxiques, nuages et voitures
## - augmente la difficulté (niveau de pollution 1 à 5)
## - détecte la victoire (objectif atteint) et la défaite (temps écoulé / plus de vies)
## Il communique avec les autres scènes uniquement par des SIGNAUX.

signal score_changed(score: int, target: int)
signal time_changed(time_left: float)
signal lives_changed(lives: int)
signal waste_changed(counts: Dictionary, total: int)
signal level_changed(level: int)

const COLLECTIBLE_SCENE := preload("res://scenes/Collectible.tscn")
const POLLUTION_SCENE := preload("res://scenes/Pollution.tscn")
const TOXIC_SCENE := preload("res://scenes/ToxicWaste.tscn")
const CAR_SCENE := preload("res://scenes/Car.tscn")

const MAP_RECT := Rect2(0, 0, 2560, 1600)
const MAX_LEVEL := 5
const START_LIVES := 3
const TOXIC_PENALTY := 50
const TOXIC_DAMAGE := 25.0
const CAR_DAMAGE := 20.0

## Réglages de chaque niveau de pollution (index 0 = niveau 1).
## Plus le niveau monte : plus de déchets, plus de dangers, voitures plus rapides.
const LEVELS := [
	{"waste_every": 1.5, "max_waste": 12, "toxic_every": 11.0, "max_toxic": 2, "pollution_every": 13.0,
		"max_pollution": 1, "radius": 75.0, "dps": 18.0, "car_every": 4.5, "max_cars": 3, "car_speed": 150.0, "haze": 0.05},
	{"waste_every": 1.3, "max_waste": 14, "toxic_every": 8.5, "max_toxic": 3, "pollution_every": 10.0,
		"max_pollution": 2, "radius": 90.0, "dps": 22.0, "car_every": 3.6, "max_cars": 4, "car_speed": 180.0, "haze": 0.15},
	{"waste_every": 1.1, "max_waste": 16, "toxic_every": 6.5, "max_toxic": 5, "pollution_every": 8.0,
		"max_pollution": 3, "radius": 105.0, "dps": 26.0, "car_every": 2.8, "max_cars": 6, "car_speed": 210.0, "haze": 0.27},
	{"waste_every": 0.95, "max_waste": 18, "toxic_every": 5.0, "max_toxic": 7, "pollution_every": 6.5,
		"max_pollution": 4, "radius": 120.0, "dps": 30.0, "car_every": 2.2, "max_cars": 8, "car_speed": 240.0, "haze": 0.4},
	{"waste_every": 0.8, "max_waste": 20, "toxic_every": 4.0, "max_toxic": 9, "pollution_every": 5.0,
		"max_pollution": 6, "radius": 135.0, "dps": 35.0, "car_every": 1.8, "max_cars": 10, "car_speed": 270.0, "haze": 0.55},
]
const WASTE_KEYS := {
	Collectible.Type.PLASTIQUE: "plastique", Collectible.Type.PAPIER: "papier",
	Collectible.Type.VERRE: "verre", Collectible.Type.ELECTRONIQUE: "electronique",
}

var score := 0
var target := 1000
var duration := 150.0
var time_left := 150.0
var elapsed := 0.0
var lives := START_LIVES
var level := 1
var counts := {"plastique": 0, "papier": 0, "verre": 0, "electronique": 0}
var total_waste := 0
var running := false
var finished := false
var _last_tick := -1
var _damage_flash := 0.0
var _haze := 0.0
var _toxic := 0.0

@onready var player: Player = $Entities/Player
@onready var hud = $HUD
@onready var pause_menu = $PauseMenu
@onready var collectibles: Node2D = $Entities/Collectibles
@onready var hazards: Node2D = $Entities/Hazards
@onready var pollution_root: Node2D = $Entities/Pollution
@onready var cars: Node2D = $Entities/Cars
@onready var effects: Node2D = $Entities/Effects
@onready var lanes: Node2D = $World/Lanes
@onready var player_start: Marker2D = $PlayerStart
@onready var haze_material: ShaderMaterial = $Overlay/Haze.material
@onready var waste_timer: Timer = $WasteTimer
@onready var toxic_timer: Timer = $ToxicTimer
@onready var pollution_timer: Timer = $PollutionTimer
@onready var car_timer: Timer = $CarTimer
@onready var bonus_timer: Timer = $BonusTimer


func _ready() -> void:
	var diff := Global.get_difficulty()
	duration = diff.duration
	target = diff.target
	time_left = duration
	player.damage_multiplier = diff.damage

	# --- connexions des signaux entre les scènes ---
	player.health_changed.connect(hud.update_health)
	player.energy_changed.connect(hud.update_energy)
	player.died.connect(_on_player_died)
	player.hurt.connect(_on_player_hurt)
	score_changed.connect(hud.update_score)
	time_changed.connect(hud.update_time)
	lives_changed.connect(hud.update_lives)
	waste_changed.connect(hud.update_waste)
	level_changed.connect(hud.update_level)
	waste_timer.timeout.connect(_on_waste_timer)
	toxic_timer.timeout.connect(_on_toxic_timer)
	pollution_timer.timeout.connect(_on_pollution_timer)
	car_timer.timeout.connect(_on_car_timer)
	bonus_timer.timeout.connect(_on_bonus_timer)

	score_changed.emit(score, target)
	time_changed.emit(time_left)
	lives_changed.emit(lives)
	waste_changed.emit(counts, total_waste)
	level_changed.emit(level)
	player.health_changed.emit(player.health, player.max_health)

	AudioManager.play_music("game")
	pause_menu.can_pause = false
	player.controls_enabled = false
	# quelques voitures et déchets dès le début
	for i in 2:
		_on_car_timer()
	hud.show_banner("PRÊT ?", "Atteins %d points en %d s" % [target, int(duration)], Color("3ef2d0"))
	var tw := create_tween()
	tw.tween_interval(1.8)
	tw.tween_callback(_start_game)


func _start_game() -> void:
	running = true
	pause_menu.can_pause = true
	player.controls_enabled = true
	hud.show_banner("NETTOIE LA VILLE !", "ZQSD / flèches pour bouger · Maj pour sprinter", Color("a6ff4d"))
	_apply_level()
	for t in [waste_timer, toxic_timer, pollution_timer, car_timer, bonus_timer]:
		t.start()
	for i in 7:
		_spawn_collectible(_random_waste_type())


func _physics_process(delta: float) -> void:
	_update_overlay(delta)
	if not running:
		return
	elapsed += delta
	time_left = maxf(duration - elapsed, 0.0)
	time_changed.emit(time_left)
	var sec := int(ceil(time_left))
	if sec <= 10 and sec != _last_tick and sec > 0:
		_last_tick = sec
		AudioManager.play_sfx("tick")
	var new_level := clampi(1 + int(elapsed / (duration / MAX_LEVEL)), 1, MAX_LEVEL)
	if new_level != level:
		_set_level(new_level)
	if time_left <= 0.0:
		_end_game(false, "time")


func _update_overlay(delta: float) -> void:
	_damage_flash = maxf(_damage_flash - delta * 1.8, 0.0)
	_haze = lerpf(_haze, LEVELS[level - 1].haze, delta * 0.8)
	_toxic = lerpf(_toxic, 1.0 if player.is_in_pollution() else 0.0, delta * 6.0)
	haze_material.set_shader_parameter("pollution", _haze)
	haze_material.set_shader_parameter("damage", _damage_flash)
	haze_material.set_shader_parameter("toxic", _toxic)


# ---------------------------------------------------------------------------
# Difficulté progressive
# ---------------------------------------------------------------------------
func _set_level(new_level: int) -> void:
	level = new_level
	level_changed.emit(level)
	_apply_level()
	AudioManager.play_sfx("alarm", 1.0, -4.0)
	hud.show_banner("ALERTE POLLUTION", "Niveau %d / %d : les dangers augmentent !" % [level, MAX_LEVEL], Color("ff8a3d"))
	_on_pollution_timer()


func _apply_level() -> void:
	var L: Dictionary = LEVELS[level - 1]
	waste_timer.wait_time = L.waste_every
	toxic_timer.wait_time = L.toxic_every
	pollution_timer.wait_time = L.pollution_every
	car_timer.wait_time = L.car_every


# ---------------------------------------------------------------------------
# Apparitions
# ---------------------------------------------------------------------------
## Cherche une position libre (pas dans un bâtiment) grâce à une requête physique.
func find_free_position(radius: float, min_player_dist: float) -> Vector2:
	var space := get_world_2d().direct_space_state
	var query := PhysicsShapeQueryParameters2D.new()
	var circle := CircleShape2D.new()
	circle.radius = radius
	query.shape = circle
	query.collision_mask = 1
	for attempt in 40:
		var p := Vector2(randf_range(60, MAP_RECT.size.x - 60), randf_range(60, MAP_RECT.size.y - 60))
		if p.distance_to(player.global_position) < min_player_dist:
			continue
		query.transform = Transform2D(0.0, p)
		if space.intersect_shape(query, 1).is_empty():
			return p
	return Vector2.INF


func _random_waste_type() -> Collectible.Type:
	var r := randf()
	if r < 0.4:
		return Collectible.Type.PLASTIQUE
	if r < 0.7:
		return Collectible.Type.PAPIER
	if r < 0.9:
		return Collectible.Type.VERRE
	return Collectible.Type.ELECTRONIQUE


func _spawn_collectible(type: Collectible.Type) -> void:
	var pos := find_free_position(22.0, 90.0)
	if pos == Vector2.INF:
		return
	var item: Collectible = COLLECTIBLE_SCENE.instantiate()
	item.type = type
	item.position = pos
	item.collected.connect(_on_collectible_collected)
	collectibles.add_child(item)


func _count_waste() -> int:
	var n := 0
	for c in collectibles.get_children():
		if c is Collectible and c.is_waste() and not c.picked:
			n += 1
	return n


func _on_waste_timer() -> void:
	if _count_waste() < LEVELS[level - 1].max_waste:
		_spawn_collectible(_random_waste_type())


func _on_bonus_timer() -> void:
	if collectibles.get_child_count() - _count_waste() >= 2:
		return
	var low_health := player.health < player.max_health * 0.6
	_spawn_collectible(Collectible.Type.SOIN if low_health or randf() < 0.4 else Collectible.Type.ENERGIE)


func _on_toxic_timer() -> void:
	if hazards.get_child_count() >= LEVELS[level - 1].max_toxic:
		return
	var pos := find_free_position(26.0, 170.0)
	if pos == Vector2.INF:
		return
	var toxic: ToxicWaste = TOXIC_SCENE.instantiate()
	toxic.position = pos
	toxic.touched.connect(_on_toxic_touched)
	hazards.add_child(toxic)


func _on_pollution_timer() -> void:
	var L: Dictionary = LEVELS[level - 1]
	if pollution_root.get_child_count() >= L.max_pollution:
		return
	var r: float = L.radius * randf_range(0.85, 1.15)
	var pos := Vector2.INF
	for attempt in 20:
		var p := Vector2(randf_range(r, MAP_RECT.size.x - r), randf_range(r, MAP_RECT.size.y - r))
		if p.distance_to(player.global_position) > r + 140.0:
			pos = p
			break
	if pos == Vector2.INF:
		return
	var zone: PollutionZone = POLLUTION_SCENE.instantiate()
	var drift := Vector2.from_angle(randf() * TAU) * randf_range(15.0, 25.0 + level * 6.0)
	zone.setup(r, L.dps, randf_range(12.0, 18.0), drift)
	zone.position = pos
	pollution_root.add_child(zone)


func _on_car_timer() -> void:
	var L: Dictionary = LEVELS[level - 1]
	if cars.get_child_count() >= L.max_cars:
		return
	var lane: Path2D = lanes.get_children().pick_random()
	var car: Car = CAR_SCENE.instantiate()
	var a := lane.curve.get_point_position(0)
	var b := lane.curve.get_point_position(lane.curve.point_count - 1)
	car.setup(a, b, L.car_speed * randf_range(0.9, 1.1), randf() < 0.15)
	car.hit_player.connect(_on_car_hit)
	cars.add_child(car)


# ---------------------------------------------------------------------------
# Événements de jeu (reçus par signaux)
# ---------------------------------------------------------------------------
func _on_collectible_collected(item: Collectible) -> void:
	if not running:
		return
	var pos := item.global_position
	var color := item.get_color()
	if item.is_waste():
		counts[WASTE_KEYS[item.type]] += 1
		total_waste += 1
		waste_changed.emit(counts, total_waste)
		var pitch := 1.0 + 0.12 * int(item.type)
		AudioManager.play_sfx("collect", pitch)
		Effects.burst(effects, pos, color, 16, 200.0)
		Effects.floating_text(effects, pos, "+%d" % item.get_points(), color)
		item.pick_up()
		add_score(item.get_points())
	else:
		AudioManager.play_sfx("bonus")
		Effects.burst(effects, pos, color, 22, 240.0)
		if item.type == Collectible.Type.SOIN:
			player.heal(35.0)
			Effects.floating_text(effects, pos, "+35 SANTÉ", color, 22)
		else:
			player.refill_energy()
			Effects.floating_text(effects, pos, "ÉNERGIE MAX", color, 22)
		item.pick_up()


func add_score(amount: int) -> void:
	score = maxi(score + amount, 0)
	score_changed.emit(score, target)
	if running and score >= target:
		_end_game(true, "target")


func _on_toxic_touched(toxic: ToxicWaste) -> void:
	if not running or player.is_invincible():
		return
	var pos := toxic.global_position
	AudioManager.play_sfx("toxic")
	toxic.explode()
	Effects.floating_text(effects, pos, "-%d" % TOXIC_PENALTY, Color("7dff3a"), 30)
	hud.show_toast("Déchet toxique ! -%d points" % TOXIC_PENALTY, Color("b6ff4d"))
	add_score(-TOXIC_PENALTY)
	player.take_damage(TOXIC_DAMAGE, pos, true)


func _on_car_hit(car: Car) -> void:
	if not running or player.is_invincible():
		return
	AudioManager.play_sfx("horn")
	Effects.burst(effects, player.global_position, Color("ffd166"), 14, 240.0)
	hud.show_toast("Attention aux voitures !", Color("ffd166"))
	player.take_damage(CAR_DAMAGE, car.global_position, true)


func _on_player_hurt(_amount: float) -> void:
	AudioManager.play_sfx("hurt")
	_damage_flash = 0.8


func _on_player_died() -> void:
	if not running:
		return
	lives -= 1
	lives_changed.emit(lives)
	_damage_flash = 1.0
	AudioManager.play_sfx("life_lost")
	Effects.burst(effects, player.global_position, Color("ff4d6d"), 30, 300.0)
	Effects.burst(effects, player.global_position, Color(0.6, 0.6, 0.6, 0.7), 10, 100.0, Effects.SMOKE, 1.0, 1.0)
	if lives <= 0:
		_end_game(false, "lives")
		return
	hud.show_banner("VIE PERDUE", "Il te reste %d vie%s" % [lives, "s" if lives > 1 else ""], Color("ff4d6d"))
	var tw := create_tween()
	tw.tween_interval(1.2)
	tw.tween_callback(_respawn_player)


func _respawn_player() -> void:
	if finished:
		return
	player.respawn(player_start.global_position)
	AudioManager.play_sfx("respawn")
	Effects.burst(effects, player.global_position, Color("3ef2d0"), 24, 220.0)


# ---------------------------------------------------------------------------
# Fin de partie
# ---------------------------------------------------------------------------
func _end_game(victory: bool, reason: String) -> void:
	if finished:
		return
	finished = true
	running = false
	pause_menu.can_pause = false
	player.controls_enabled = false
	for t in [waste_timer, toxic_timer, pollution_timer, car_timer, bonus_timer]:
		t.stop()
	var stars := 0
	if victory:
		stars = 1 + int(lives >= 2) + int(time_left >= 30.0)
	Global.register_result({
		"victory": victory, "reason": reason, "score": score, "target": target,
		"time_used": elapsed, "time_left": time_left, "lives": lives, "level": level,
		"counts": counts.duplicate(), "total": total_waste, "stars": stars,
		"difficulty": Global.get_difficulty().name,
	})
	AudioManager.fade_out_music(1.5)
	if victory:
		AudioManager.play_sfx("victory")
		hud.show_banner("OBJECTIF ATTEINT !", "La ville respire à nouveau", Color("a6ff4d"))
		for i in 6:
			Effects.burst(effects, player.global_position + Vector2(randf_range(-200, 200), randf_range(-120, 120)),
				Color.from_hsv(randf(), 0.6, 1.0), 20, 260.0, Effects.LEAF, 1.2, 0.9)
	else:
		AudioManager.play_sfx("gameover")
		var title := "TEMPS ÉCOULÉ" if reason == "time" else "PLUS DE VIES"
		hud.show_banner(title, "La pollution a gagné cette fois...", Color("ff4d6d"))
	var tw := create_tween()
	tw.tween_interval(2.4)
	tw.tween_callback(func(): Transition.change_scene("res://scenes/Victory.tscn" if victory else "res://scenes/GameOver.tscn"))
