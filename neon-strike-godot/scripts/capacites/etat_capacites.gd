class_name EtatCapacites
extends RefCounted
## Charges, recharges et points d'ultime des quatre capacités d'un combattant (C, Q, E, X).
## En mode économie (Spike, Élimination), C et Q s'achètent ; E se recharge seule ; X demande des points.

var heros := ""
var ids := {}          # emplacement -> id de capacité
var charges := {}
@warning_ignore("shadowed_global_identifier")
var maxi := {}
var recharge := {}     # secondes avant la prochaine charge
var points := 0
var points_max := 7
var economie := false
var actif := {}        # emplacement -> temps d'effet en cours (pour l'interface)


func _init(id_heros: String, eco := false) -> void:
	heros = id_heros
	economie = eco
	var liste: Array = DonneesHeros.heros(id_heros).get("capacites", [])
	for i in mini(liste.size(), 4):
		var empl: String = DonneesCapacites.EMPLACEMENTS[i]
		ids[empl] = liste[i]
		var d := DonneesCapacites.capacite(liste[i])
		if empl == "x":
			points_max = int(d.get("points", 7))
			continue
		maxi[empl] = int(d.get("charges", 1))
		charges[empl] = maxi[empl] if (not economie or empl == "e") else 0
		recharge[empl] = 0.0
		actif[empl] = 0.0


func def(empl: String) -> Dictionary:
	return DonneesCapacites.capacite(ids.get(empl, ""))


func maj(dt: float) -> void:
	for empl in charges:
		actif[empl] = maxf(0.0, float(actif[empl]) - dt)
		if charges[empl] >= maxi[empl] or (economie and empl != "e"):
			recharge[empl] = 0.0
			continue
		if recharge[empl] <= 0.0:
			recharge[empl] = float(def(empl).get("recharge", 30))
		recharge[empl] -= dt
		if recharge[empl] <= 0.0:
			charges[empl] += 1
			recharge[empl] = 0.0


func disponible(empl: String) -> bool:
	if empl == "x":
		return points >= points_max and ids.has("x")
	return ids.has(empl) and int(charges.get(empl, 0)) > 0


func consommer(empl: String) -> void:
	if empl == "x":
		points = 0
		return
	charges[empl] = maxi(0, int(charges[empl]) - 1)
	actif[empl] = 0.4


func ajouter_point(n := 1) -> bool:
	var avant := points
	points = mini(points_max, points + n)
	return avant < points_max and points >= points_max


## Début de manche (économie) : la signature est pleine, les charges achetées sont gardées
func nouvelle_manche() -> void:
	if charges.has("e"):
		charges["e"] = maxi["e"]
		recharge["e"] = 0.0


func prix(empl: String) -> int:
	return int(def(empl).get("prix", 200))


func etat_hud() -> Dictionary:
	var r := {}
	for empl in ["c", "q", "e"]:
		if not ids.has(empl):
			continue
		r[empl] = {"charges": charges[empl], "max": maxi[empl], "recharge": recharge[empl],
			"recharge_max": float(def(empl).get("recharge", 30)), "actif": actif[empl] > 0.0}
	if ids.has("x"):
		r["x"] = {"ultime_points": points, "ultime_max": points_max}
	return r
