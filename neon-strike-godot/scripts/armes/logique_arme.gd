class_name LogiqueArme
extends RefCounted
## Logique d'une arme : munitions, cadence, rechargement, recul (motif), dispersion. Commune au joueur et aux bots.

var id := ""
var def := {}
var mun := 0
var reserve := 0
var recharge_t := 0.0
var duree_recharge := 1.0
var recharge_vide := false
var prochain_tir := 0.0
var dernier_tir := -10.0
var serie := 0.0
var recul := Vector2.ZERO          # recul courant (degrés : x = tangage, y = lacet)
var cible_recul := Vector2.ZERO
var horloge := 0.0


func _init(id_arme: String) -> void:
	id = id_arme
	def = DonneesArmes.arme(id_arme)
	reinitialiser()


func reinitialiser() -> void:
	mun = int(def.get("chargeur", 0))
	reserve = int(def.get("reserve", 0))
	recharge_t = 0.0
	serie = 0.0
	recul = Vector2.ZERO
	cible_recul = Vector2.ZERO
	prochain_tir = 0.0


var type: String:
	get: return def.get("type", "auto")


func en_recharge() -> bool:
	return recharge_t > 0.0


## 0..1 pendant le rechargement, -1 sinon
func progression_recharge() -> float:
	return 1.0 - recharge_t / duree_recharge if recharge_t > 0.0 else -1.0


## Pompe et verrou : réarmement entre deux tirs (0..1), -1 sinon
func progression_cycle() -> float:
	if type != "pompe" and type != "verrou":
		return -1.0
	var t := horloge - dernier_tir
	var c: float = def["cadence"]
	return t / c if t >= 0.0 and t < c else -1.0


func peut_tirer(temps: float, gachette_neuve: bool) -> bool:
	if type == "melee":
		return temps >= prochain_tir
	if recharge_t > 0.0 or mun <= 0 or temps < prochain_tir:
		return false
	if type != "auto" and not gachette_neuve:
		return false
	return true


func lancer_rechargement() -> bool:
	if type == "melee" or recharge_t > 0.0 or mun >= int(def["chargeur"]) or reserve <= 0:
		return false
	recharge_vide = mun == 0
	duree_recharge = def["rechargement_vide"] if recharge_vide else def["rechargement"]
	recharge_t = duree_recharge
	serie = 0.0
	return true


func annuler_rechargement() -> void:
	recharge_t = 0.0


## Imprécision (degrés) selon le mouvement, le saut, l'accroupissement, la visée et la commotion
func imprecision(vitesse: float, en_l_air: bool, accroupi: bool, vise: bool, commotion := false) -> float:
	if type == "melee":
		return 0.0
	var e: float = def["precision_visee"] if def.get("lunette", false) and vise else def["precision"]
	if en_l_air:
		e += def["air"]
	elif vitesse > 0.6:
		e += minf(vitesse / 6.2, 1.2) * float(def["mouvement"])
	e += maxf(0.0, serie - 2.0) * float(def["serie"])
	if accroupi:
		e *= 0.75
	if vise and not def.get("lunette", false):
		e *= float(def["visee"])
	if commotion:
		e = e * 1.6 + 2.5
	return e


## Tire : renvoie la liste des décalages (radians) de chaque balle ou plomb
func tirer(temps: float, ecart_deg: float, vise: bool, lourd := false) -> Array[Vector2]:
	dernier_tir = temps
	var resultat: Array[Vector2] = []
	if type == "melee":
		prochain_tir = temps + (def["cadence_lourde"] if lourd else def["cadence"])
		return resultat
	mun -= 1
	var cadence: float = def["cadence"]
	if type == "auto" and temps - prochain_tir < cadence:
		prochain_tir += cadence
	else:
		prochain_tir = temps + cadence
	var motif: Array = def["recul"]
	var r: Array = motif[mini(int(serie), motif.size() - 1)]
	var f := 0.78 if vise else 1.0
	cible_recul = Vector2(float(r[0]) * f, float(r[1]) * f)
	serie += 1.0
	if mun <= 0:
		lancer_rechargement()
	var n := int(def.get("plombs", 1))
	var ecart := deg_to_rad(ecart_deg)
	for i in n:
		var disp := deg_to_rad(float(def.get("dispersion", 0.0))) * (0.8 if vise else 1.0) if def.has("plombs") else 0.0
		var a := randf() * TAU
		var rr := sqrt(randf()) * (ecart + disp)
		resultat.append(Vector2(cos(a) * rr, sin(a) * rr))
	return resultat


func maj(dt: float, temps: float) -> void:
	horloge = temps
	if recharge_t > 0.0:
		recharge_t -= dt
		if recharge_t <= 0.0:
			var pris := mini(int(def["chargeur"]) - mun, reserve)
			mun += pris
			reserve -= pris
			recharge_t = 0.0
	if type == "melee":
		return
	var au_repos := temps - dernier_tir > maxf(float(def["cadence"]) * 1.6, 0.12)
	if au_repos:
		serie = maxf(0.0, serie - dt * 18.0)
		if serie < 0.5:
			serie = 0.0
		cible_recul = Vector2.ZERO
	var k := 1.0 - exp(-(float(def["recuperation"]) if au_repos else 28.0) * dt)
	recul += (cible_recul - recul) * k
