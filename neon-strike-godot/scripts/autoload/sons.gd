extends Node
## Lecture des sons (tous synthétisés par outils/sons.py, originaux).
## jouer("tir_pulsar") ou jouer_3d("pas_beton", position). Les variantes "nom_1", "nom_2"... sont tirées au hasard.

var sons := {}          # nom -> Array[AudioStream]
var pool_2d: Array[AudioStreamPlayer] = []
var pool_3d: Array[AudioStreamPlayer3D] = []
var i2d := 0
var i3d := 0
var limites := {}       # nom -> temps du dernier son (évite les doublons)


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	var dossier := "res://assets/sons/"
	for fichier in ResourceLoader.list_directory(dossier):
		if not fichier.ends_with(".wav") and not fichier.ends_with(".ogg"):
			continue
		var flux := load(dossier + fichier) as AudioStream
		if flux == null:
			continue
		var nom := fichier.get_basename()
		var base := nom
		var morceaux := nom.rsplit("_", true, 1)
		if morceaux.size() == 2 and morceaux[1].is_valid_int():
			base = morceaux[0]
		if not sons.has(base):
			sons[base] = []
		sons[base].append(flux)
		if base != nom:
			sons[nom] = [flux]
	for i in 16:
		var p := AudioStreamPlayer.new()
		p.bus = "Effets"
		add_child(p)
		pool_2d.append(p)
	for i in 48:
		var p := AudioStreamPlayer3D.new()
		p.bus = "Effets"
		p.attenuation_model = AudioStreamPlayer3D.ATTENUATION_INVERSE_DISTANCE
		p.unit_size = 4.0
		p.max_distance = 70.0
		p.panning_strength = 1.0
		add_child(p)
		pool_3d.append(p)


func existe(nom: String) -> bool:
	return sons.has(nom)


func _flux(nom: String) -> AudioStream:
	var l: Array = sons.get(nom, [])
	if l.is_empty():
		return null
	return l[randi() % l.size()]


## Évite de rejouer le même son trop souvent (ex. rebonds, pas)
func limite(nom: String, ecart: float) -> bool:
	var t := Time.get_ticks_msec() / 1000.0
	if t - float(limites.get(nom, -100.0)) < ecart:
		return false
	limites[nom] = t
	return true


func jouer(nom: String, volume_db := 0.0, hauteur := 1.0, bus := "Effets") -> void:
	var f := _flux(nom)
	if f == null:
		return
	var p := pool_2d[i2d]
	i2d = (i2d + 1) % pool_2d.size()
	p.stream = f
	p.volume_db = volume_db
	p.pitch_scale = hauteur * randf_range(0.97, 1.03)
	p.bus = bus
	p.play()


func jouer_3d(nom: String, position: Vector3, volume_db := 0.0, hauteur := 1.0, portee := 70.0) -> void:
	var f := _flux(nom)
	if f == null:
		return
	var p := pool_3d[i3d]
	i3d = (i3d + 1) % pool_3d.size()
	p.stream = f
	p.global_position = position
	p.volume_db = volume_db
	p.max_distance = portee
	p.pitch_scale = hauteur * randf_range(0.96, 1.04)
	p.play()
