extends Node
## AUDIO MANAGER (autoload) : musique d'ambiance et effets sonores.
## La musique continue entre les scènes ; les effets utilisent plusieurs lecteurs
## pour pouvoir se superposer.

const SOUNDS := {
	"collect": preload("res://assets/sounds/collect.wav"),
	"bonus": preload("res://assets/sounds/bonus.wav"),
	"hurt": preload("res://assets/sounds/hurt.wav"),
	"life_lost": preload("res://assets/sounds/life_lost.wav"),
	"toxic": preload("res://assets/sounds/toxic.wav"),
	"horn": preload("res://assets/sounds/horn.wav"),
	"alarm": preload("res://assets/sounds/alarm.wav"),
	"tick": preload("res://assets/sounds/tick.wav"),
	"ui_hover": preload("res://assets/sounds/ui_hover.wav"),
	"ui_click": preload("res://assets/sounds/ui_click.wav"),
	"respawn": preload("res://assets/sounds/respawn.wav"),
	"victory": preload("res://assets/sounds/victory.wav"),
	"gameover": preload("res://assets/sounds/gameover.wav"),
}
const MUSIC := {
	"menu": preload("res://assets/sounds/music_menu.ogg"),
	"game": preload("res://assets/sounds/music_game.ogg"),
}

var _music: AudioStreamPlayer
var _players: Array[AudioStreamPlayer] = []
var _next := 0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for bus_name in ["Music", "SFX"]:
		if AudioServer.get_bus_index(bus_name) == -1:
			AudioServer.add_bus()
			var idx := AudioServer.bus_count - 1
			AudioServer.set_bus_name(idx, bus_name)
			AudioServer.set_bus_send(idx, "Master")
	_music = AudioStreamPlayer.new()
	_music.bus = "Music"
	add_child(_music)
	for i in 10:
		var p := AudioStreamPlayer.new()
		p.bus = "SFX"
		add_child(p)
		_players.append(p)
	update_volumes()


func update_volumes() -> void:
	_set_bus_volume("Music", Global.music_volume)
	_set_bus_volume("SFX", Global.sfx_volume)


func _set_bus_volume(bus_name: String, value: float) -> void:
	var idx := AudioServer.get_bus_index(bus_name)
	AudioServer.set_bus_volume_db(idx, linear_to_db(maxf(value, 0.0001)))
	AudioServer.set_bus_mute(idx, value <= 0.01)


func play_music(music_name: String) -> void:
	var stream: AudioStream = MUSIC[music_name]
	if _music.stream == stream and _music.playing:
		return
	if stream is AudioStreamOggVorbis:
		stream.loop = true
	_music.stream = stream
	_music.volume_db = -30.0
	_music.play()
	create_tween().tween_property(_music, "volume_db", 0.0, 1.0)


func fade_out_music(duration := 1.0) -> void:
	create_tween().tween_property(_music, "volume_db", -40.0, duration)


func play_sfx(sound_name: String, pitch := 1.0, volume_db := 0.0) -> void:
	if not SOUNDS.has(sound_name):
		push_warning("Son inconnu : " + sound_name)
		return
	var p := _players[_next]
	_next = (_next + 1) % _players.size()
	p.stream = SOUNDS[sound_name]
	p.pitch_scale = pitch
	p.volume_db = volume_db
	p.play()
