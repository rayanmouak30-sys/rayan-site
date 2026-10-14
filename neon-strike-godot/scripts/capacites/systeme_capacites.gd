class_name SystemeCapacites
extends Node3D
## Les 19 familles d'effets des 80 capacités : grenades (vraie trajectoire, rebonds), zones au sol (feu, soin,
## ralenti, sonar, trou noir, frappe), fumées qui coupent la vue, flashs qui aveuglent selon le regard, murs
## d'énergie destructibles, pièges, tourelle, drone, révélations, bonus, séisme, déplacements (ruée, saut,
## téléportation, charge), camouflage et résurrection.
## Les effets visuels existent chez tout le monde ; dégâts et statuts ne sont appliqués que par l'autorité.

const GRAVITE := 18.0
const COULEURS := {
	"explosion": Color(1.0, 0.55, 0.25), "flash": Color(1, 1, 1), "fumee": Color(0.66, 0.7, 0.78), "commotion": Color(1.0, 0.82, 0.4),
	"emp": Color(0.49, 1.0, 0.83), "feu": Color(1.0, 0.45, 0.15), "ralenti": Color(0.55, 0.85, 1.0), "soin": Color(0.45, 1.0, 0.55),
	"sonar": Color(0.35, 1.0, 0.82), "trouNoir": Color(0.69, 0.49, 1.0), "frappe": Color(1.0, 0.62, 0.25), "brouillard": Color(0.7, 0.75, 0.8),
	"multiFlash": Color(1, 1, 1),
}

var partie: Partie
var autorite := true
var projectiles := []
var fumees := []
var zones := []
var murs := []
var pieges := []
var tourelles := []
var drones := []
var differes := []      # [temps restant, Callable]
var horloge := 0.0
var mat_grenade := {}
var mesh_grenade: Mesh


func _ready() -> void:
	name = "Capacites"
	var s := SphereMesh.new()
	s.radius = 0.07
	s.height = 0.14
	s.radial_segments = 12
	s.rings = 6
	mesh_grenade = s


func couleur_de(def: Dictionary) -> Color:
	if def.has("couleur"):
		var c: Variant = def["couleur"]
		if c is String:
			return Color(c)
		return Color.hex((int(c) << 8) | 0xff)
	return COULEURS.get(def.get("effet", ""), Color(0.8, 0.9, 1.0))


# =============================================================================
# Utilitaires
# =============================================================================
func ennemis(de: Combattant) -> Array[Combattant]:
	var l: Array[Combattant] = []
	for c in partie.combattants:
		if c.vivant and c.equipe != de.equipe and not (c is Cible):
			l.append(c)
	return l


func allies(de: Combattant, rayon := 0.0) -> Array[Combattant]:
	var l: Array[Combattant] = []
	for c in partie.combattants:
		if c.vivant and c.equipe == de.equipe and (rayon <= 0.0 or c.global_position.distance_to(de.global_position) <= rayon):
			l.append(c)
	return l


func ligne_libre(a: Vector3, b: Vector3) -> bool:
	var q := PhysicsRayQueryParameters3D.create(a, b, Combattant.COUCHE_MONDE)
	return get_world_3d().direct_space_state.intersect_ray(q).is_empty()


func rayon_monde(a: Vector3, b: Vector3) -> Dictionary:
	var q := PhysicsRayQueryParameters3D.create(a, b, Combattant.COUCHE_MONDE | Combattant.COUCHE_OBJETS)
	return get_world_3d().direct_space_state.intersect_ray(q)


func sol(p: Vector3, depuis := 2.0) -> Vector3:
	var r := rayon_monde(p + Vector3(0, depuis, 0), p + Vector3(0, -30, 0))
	return r["position"] if not r.is_empty() else Vector3(p.x, 0, p.z)


func degats(cible: Combattant, quantite: float, auteur: Combattant, id_cap: String) -> void:
	if not autorite or quantite <= 0.0 or not cible.vivant:
		return
	partie.infliger(auteur, cible, quantite, false, id_cap, cible.global_position + Vector3.UP)


func reveler(c: Combattant, duree: float) -> void:
	if autorite:
		c.revele = maxf(c.revele, duree)


func son(nom: String, pos: Vector3, vol := 0.0) -> void:
	Sons.jouer_3d(nom, pos, vol)


func plus_tard(t: float, f: Callable) -> void:
	differes.append([t, f])


# =============================================================================
# Point d'entrée
# =============================================================================
## Utilise une capacité. dir : direction du regard ; cible : point visé (bots), facultatif.
func executer(lanceur: Combattant, id: String, dir: Vector3, cible := Vector3.INF) -> bool:
	var def := DonneesCapacites.capacite(id)
	if def.is_empty():
		return false
	var plat := Vector3(dir.x, 0, dir.z)
	if plat.length_squared() < 1e-6:
		plat = -lanceur.global_transform.basis.z
	plat = plat.normalized()
	match String(def.get("famille", "")):
		"grenade":
			lancer_grenade(lanceur, def, id, dir, cible)
			return true
		"cible":
			var p := cible if cible != Vector3.INF else point_vise(lanceur, dir, float(def.get("portee", 40)))
			effet_point(def, sol(p, 1.0), lanceur, id)
			return true
		"buff":
			return buff(lanceur, def)
		"equipe":
			return bonus_equipe(lanceur, def)
		"mur":
			return poser_mur(lanceur, plat, def)
		"murFumee":
			return mur_fumee(lanceur, plat, def)
		"drone":
			lancer_drone(lanceur, plat, float(def.get("duree", 6)))
			return true
		"sonar":
			sonar(lanceur, def)
			return true
		"cone":
			cone(lanceur, plat, def)
			return true
		"piege":
			return poser_piege(lanceur, plat, def, id)
		"tourelle":
			return poser_tourelle(lanceur, plat, def, id)
		"camo":
			lanceur.appliquer_statut("camo", float(def.get("duree", 6)))
			lanceur.statuts["camo_revele"] = 0.0
			if def.has("vitesse"):
				lanceur.bonus_vitesse = float(def["vitesse"])
				lanceur.appliquer_statut("vitesse", float(def.get("duree", 6)))
			son("teleport", lanceur.global_position)
			return true
		"frenesie":
			var d := float(def.get("duree", 8))
			lanceur.bonus_vitesse = float(def.get("vitesse", 0.1))
			lanceur.appliquer_statut("vitesse", d)
			lanceur.bonus_cadence = float(def.get("cadence", 0.2))
			lanceur.appliquer_statut("cadence", d)
			lanceur.appliquer_statut("frenesie", d)
			son("capacite", lanceur.global_position)
			return true
		"resurrection":
			return resurrection(lanceur, def)
		"seisme":
			seisme(lanceur, def, id)
			return true
		"ruee", "saut", "blink", "charge":
			return deplacement(lanceur, def, id, plat)
	return false


## Point visé dans la direction du regard (jamais derrière un mur), ramené au sol
func point_vise(lanceur: Combattant, dir: Vector3, portee: float) -> Vector3:
	var o := lanceur.yeux()
	var r := rayon_monde(o, o + dir * portee)
	if not r.is_empty():
		return (r["position"] as Vector3) - dir * 0.4
	return o + dir * portee


# =============================================================================
# Grenades et projectiles
# =============================================================================
func lancer_grenade(lanceur: Combattant, def: Dictionary, id: String, dir: Vector3, cible: Vector3) -> void:
	var o := lanceur.yeux() - Vector3(0, 0.1, 0)
	var fleche := String(def.get("effet", "")) == "sonar"
	var v := Vector3.ZERO
	if cible == Vector3.INF:
		o += dir * 0.5
		v = dir * float(def.get("vitesse", 17.0 if def.get("effet") == "flash" else 15.0))
		if not fleche:
			v.y += 2.5
	else:
		var dh := Vector2(cible.x - o.x, cible.z - o.z).length()
		var T := clampf(dh / 13.0, 0.55, 1.4)
		v = Vector3((cible.x - o.x) / T, (cible.y - o.y) / T + 0.5 * GRAVITE * T, (cible.z - o.z) / T)
	var m := MeshInstance3D.new()
	if fleche:
		var cy := CylinderMesh.new()
		cy.top_radius = 0.0
		cy.bottom_radius = 0.04
		cy.height = 0.4
		m.mesh = cy
	else:
		m.mesh = mesh_grenade
	var c := couleur_de(def)
	var cle := c.to_html()
	if not mat_grenade.has(cle):
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(0.55, 0.62, 0.72)
		mat.metallic = 0.6
		mat.roughness = 0.35
		mat.emission_enabled = true
		mat.emission = c
		mat.emission_energy_multiplier = 1.5
		mat_grenade[cle] = mat
	m.material_override = mat_grenade[cle]
	add_child(m)
	m.global_position = o
	var lum := OmniLight3D.new()
	lum.light_color = c
	lum.light_energy = 0.6
	lum.omni_range = 1.5
	m.add_child(lum)
	var auto_sol := not def.has("fusee")
	projectiles.append({"def": def, "id": id, "pos": o, "vel": v, "vie": float(def.get("fusee", 3.0 if fleche else 4.0)),
		"mesh": m, "lanceur": lanceur, "repos": false, "au_sol": auto_sol, "fleche": fleche})
	son("lancer", o, -4.0)


func _maj_projectiles(dt: float) -> void:
	for p in projectiles:
		p["vie"] -= dt
		if not p["repos"]:
			var vel: Vector3 = p["vel"]
			vel.y -= GRAVITE * dt * (0.35 if p["fleche"] else 1.0)
			var pos: Vector3 = p["pos"]
			var pas := vel * dt
			var r := rayon_monde(pos, pos + pas + pas.normalized() * 0.07)
			if not r.is_empty():
				var n: Vector3 = r["normal"]
				pos = (r["position"] as Vector3) + n * 0.08
				if p["fleche"]:
					p["repos"] = true
					p["vie"] = 0.0
				else:
					vel = vel.bounce(n) * 0.45
					if Sons.limite("rebond", 0.08):
						son("rebond", pos, -8.0)
					if n.y > 0.6 and p["au_sol"] and vel.length() < 3.0:
						p["repos"] = true
			else:
				pos += pas
			p["vel"] = vel
			p["pos"] = pos
			var m: MeshInstance3D = p["mesh"]
			m.global_position = pos
			if p["fleche"] and vel.length() > 0.1:
				m.look_at(pos + vel, Vector3.UP)
				m.rotate_object_local(Vector3.RIGHT, -PI / 2)
			else:
				m.rotate_x(dt * 8.0)
		if (p["au_sol"] and p["repos"]) or p["vie"] <= 0.0:
			p["fini"] = true
			(p["mesh"] as Node).queue_free()
			effet_point(p["def"], p["pos"], p["lanceur"], p["id"], p)
	projectiles = projectiles.filter(func(p: Dictionary) -> bool: return not p.get("fini", false))


## Effet d'une grenade ou d'une capacité ciblée au point p
func effet_point(def: Dictionary, p: Vector3, lanceur: Combattant, id: String, proj := {}) -> void:
	match String(def.get("effet", "")):
		"fumee":
			deployer_fumee(p, float(def.get("duree", 15)), couleur_de(def))
		"flash":
			detoner_flash(p + Vector3(0, 0.3, 0), lanceur)
		"explosion":
			exploser(p, float(def.get("degats", 80)), float(def.get("rayon", 4.5)), lanceur, id, couleur_de(def))
		"commotion":
			onde(p, def, lanceur, "commotion", id)
		"emp":
			onde(p, def, lanceur, "emp", id)
		"feu", "ralenti", "soin", "sonar", "trouNoir", "frappe":
			creer_zone(def, p, lanceur, id, proj)
		"brouillard":
			var n := int(def.get("nombre", 5))
			for i in n:
				var a := TAU * i / n
				var q := p if i == 0 else sol(p + Vector3(cos(a), 0, sin(a)) * 3.4, 1.5)
				if i == 0 or ligne_libre(p + Vector3.UP, q + Vector3.UP):
					deployer_fumee(q, float(def.get("duree", 14)), couleur_de(def))
			var d2 := def.duplicate()
			d2["effet"] = "ralenti"
			d2["invisible"] = true
			d2["facteur"] = def.get("facteur", 0.7)
			creer_zone(d2, p, lanceur, id)
		"multiFlash":
			for i in int(def.get("nombre", 3)):
				var a := TAU * i / 3.0 + randf()
				var q := p + Vector3(cos(a) * 3.0, 2.2, sin(a) * 3.0)
				plus_tard(0.35 + i * 0.3, detoner_flash.bind(q, lanceur))
			plus_tard(0.3, func() -> void:
				for c in ennemis(lanceur):
					if c.global_position.distance_to(p) < 9.0:
						reveler(c, 3.0))


func exploser(p: Vector3, deg: float, rayon: float, lanceur: Combattant, id: String, couleur: Color) -> void:
	partie.effets.explosion(p + Vector3(0, 0.3, 0), rayon * 0.6, couleur)
	partie.joueur.secousse = minf(1.0, partie.joueur.secousse + clampf(1.0 - partie.joueur.global_position.distance_to(p) / 25.0, 0.0, 1.0))
	partie.bruit(p, 40.0, lanceur)
	for c in ennemis(lanceur):
		var cp: Vector3 = c.global_position + Vector3.UP
		var d := cp.distance_to(p + Vector3(0, 0.5, 0))
		if d > rayon:
			continue
		if d > 1.2 and not ligne_libre(p + Vector3(0, 0.5, 0), cp):
			continue
		degats(c, maxf(12.0, deg * pow(1.0 - d / rayon, 0.6)), lanceur, id)
	for t in tourelles.duplicate():
		if t["equipe"] != lanceur.equipe and (t["noeud"] as Node3D).global_position.distance_to(p) < rayon:
			degats_objet(t, deg * 0.6)
	for m in murs.duplicate():
		if m["equipe"] != lanceur.equipe and (m["noeud"] as Node3D).global_position.distance_to(p) < rayon + 2.0:
			degats_objet(m, deg)


func onde(p: Vector3, def: Dictionary, lanceur: Combattant, type: String, id: String) -> void:
	var rayon := float(def.get("rayon", 5))
	anneau(p, rayon, COULEURS[type], 0.5)
	anneau(p, rayon * 0.6, Color.WHITE, 0.35)
	son("explosion" if type == "commotion" else "capacite", p, -4.0)
	for c in ennemis(lanceur):
		if c.global_position.distance_to(p) > rayon or not ligne_libre(p + Vector3(0, 0.4, 0), c.global_position + Vector3.UP):
			continue
		if type == "commotion":
			if autorite:
				c.appliquer_statut("commotion", float(def.get("duree", 3)))
		else:
			if autorite:
				c.appliquer_statut("emp", float(def.get("duree", 6)))
			degats(c, float(def.get("degats", 20)), lanceur, id)
			reveler(c, 1.5)


# =============================================================================
# Fumées et flashs
# =============================================================================
func deployer_fumee(p: Vector3, duree: float, couleur: Color) -> void:
	var g := Node3D.new()
	add_child(g)
	g.global_position = p
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	mat.albedo_texture = Textures.fumee()
	mat.albedo_color = Color(couleur.r, couleur.g, couleur.b, 0.0)
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	var sprites := []
	var n := 16 if Reglages.qualite() != "bas" else 10
	for i in n:
		var q := MeshInstance3D.new()
		var qm := QuadMesh.new()
		var t := randf_range(3.6, 5.2)
		qm.size = Vector2(t, t)
		q.mesh = qm
		q.material_override = mat
		q.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		var a := TAU * i / n
		var r := 0.0 if i == 0 else randf_range(0.6, 2.2)
		q.position = Vector3(cos(a) * r, randf_range(0.8, 3.4), sin(a) * r)
		g.add_child(q)
		sprites.append(q)
	fumees.append({"pos": p, "rayon": 3.2, "t": 0.0, "duree": duree, "noeud": g, "mat": mat, "sprites": sprites, "couleur": couleur})
	son("fumee", p, -2.0)


func _maj_fumees(dt: float) -> void:
	for f in fumees:
		f["t"] += dt
		var t: float = f["t"]
		var entree := minf(1.0, t / 0.7)
		var sortie := clampf((float(f["duree"]) - t) / 1.5, 0.0, 1.0)
		var c: Color = f["couleur"]
		(f["mat"] as StandardMaterial3D).albedo_color = Color(c.r, c.g, c.b, 0.96 * entree * sortie)
		for s in f["sprites"]:
			(s as Node3D).scale = Vector3.ONE * (0.35 + 0.65 * entree)
		if t >= f["duree"]:
			(f["noeud"] as Node).queue_free()
			f["fini"] = true
	fumees = fumees.filter(func(f: Dictionary) -> bool: return not f.get("fini", false))


## Une fumée coupe-t-elle la ligne a -> b ?
func fumee_bloque(a: Vector3, b: Vector3) -> bool:
	for f in fumees:
		var t: float = f["t"]
		var k := minf(1.0, t / 0.8) * (clampf((float(f["duree"]) - t) / 1.2, 0.0, 1.0))
		if k < 0.45:
			continue
		var c: Vector3 = f["pos"]
		var r := float(f["rayon"]) * k
		var ab := b - a
		var u := clampf((c - a).dot(ab) / maxf(ab.length_squared(), 1e-6), 0.0, 1.0)
		var pt := a + ab * u
		if Vector2(pt.x - c.x, pt.z - c.z).length() < r and pt.y < c.y + 4.6 and pt.y > c.y - 0.5:
			return true
	return false


func dans_fumee(p: Vector3) -> bool:
	for f in fumees:
		var c: Vector3 = f["pos"]
		if float(f["t"]) > 0.6 and Vector2(p.x - c.x, p.z - c.z).length() < float(f["rayon"]) * 0.85 and p.y < c.y + 4.4:
			return true
	return false


## Les flashs n'aveuglent que les adversaires, selon l'orientation du regard
func detoner_flash(p: Vector3, lanceur: Combattant) -> void:
	var lum := OmniLight3D.new()
	lum.light_energy = 12.0
	lum.omni_range = 14.0
	add_child(lum)
	lum.global_position = p
	var tw := create_tween()
	tw.tween_property(lum, "light_energy", 0.0, 0.35)
	tw.tween_callback(lum.queue_free)
	partie.effets.flash(p, Color.WHITE, 4.0)
	son("flash", p, 0.0)
	for c in partie.combattants:
		if not c.vivant or (lanceur and c.equipe == lanceur.equipe) or c is Cible:
			continue
		var oeil := c.yeux()
		var d := oeil.distance_to(p)
		if d > 34.0 or not ligne_libre(oeil, p) or fumee_bloque(oeil, p):
			continue
		var regard := c.direction_regard()
		if c is Joueur:
			regard = (c as Joueur).cam.global_transform.basis * Vector3.FORWARD
		var cosa := regard.dot((p - oeil).normalized())
		if cosa < -0.15 and d > 2.0:
			continue
		var intensite := pow(clampf(cosa + 0.15, 0.0, 1.0), 0.7) * minf(1.0, 1.2 - d / 34.0)
		if d < 2.0:
			intensite = maxf(intensite, 0.6)
		if intensite <= 0.05:
			continue
		if autorite:
			var duree := 0.5 + 2.4 * intensite
			c.aveugle = maxf(c.aveugle, duree)
			c.aveugle_max = maxf(duree, 0.1)


func mur_fumee(lanceur: Combattant, dir: Vector3, def: Dictionary) -> bool:
	var n := int(def.get("nombre", 5))
	var e := float(def.get("espacement", 2.6))
	var poses := 0
	var o := lanceur.global_position + Vector3(0, 1.2, 0)
	for i in n:
		var d: float = 2.5 + i * e
		if not ligne_libre(o, o + dir * d):
			break
		var p := sol(lanceur.global_position + dir * d, 2.0)
		plus_tard(i * 0.08, deployer_fumee.bind(p, float(def.get("duree", 12)), couleur_de(def)))
		if def.has("commotion"):
			plus_tard(i * 0.08 + 0.1, func() -> void:
				for c in ennemis(lanceur):
					if c.global_position.distance_to(p) < 3.0 and autorite:
						c.appliquer_statut("commotion", float(def["commotion"])))
		poses += 1
	return poses > 0


# =============================================================================
# Zones au sol
# =============================================================================
func creer_zone(def: Dictionary, p: Vector3, lanceur: Combattant, id: String, proj := {}) -> void:
	var effet: String = def.get("effet", "")
	var couleur := couleur_de(def)
	var rayon := float(def.get("rayon", 4))
	var g := Node3D.new()
	add_child(g)
	g.global_position = p + Vector3(0, 0.03, 0)
	var z := {"def": def, "effet": effet, "id": id, "lanceur": lanceur, "equipe": lanceur.equipe, "pos": p, "rayon": rayon,
		"t": 0.0, "duree": float(def.get("duree", 5)), "tick": 0.0, "noeud": g, "pulses": 0}
	if not def.get("invisible", false) and effet != "sonar":
		var disque := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = rayon
		cm.bottom_radius = rayon
		cm.height = 0.02
		cm.radial_segments = 48
		disque.mesh = cm
		var mat := StandardMaterial3D.new()
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		mat.albedo_color = Color(couleur.r, couleur.g, couleur.b, 0.18)
		disque.material_override = mat
		disque.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		g.add_child(disque)
		var bord := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = rayon - 0.06
		tm.outer_radius = rayon
		tm.rings = 48
		bord.mesh = tm
		var mb := mat.duplicate() as StandardMaterial3D
		mb.albedo_color = Color(couleur.r * 2, couleur.g * 2, couleur.b * 2, 0.9)
		bord.material_override = mb
		g.add_child(bord)
		z["mat"] = mat
		z["mat_bord"] = mb
		# Particules montantes (flammes, flocons, lucioles)
		if effet in ["feu", "soin", "ralenti", "trouNoir"]:
			var part := GPUParticles3D.new()
			part.amount = 40 if effet == "feu" else 20
			part.lifetime = 1.2
			var pm := ParticleProcessMaterial.new()
			pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_RING
			pm.emission_ring_radius = rayon * 0.9
			pm.emission_ring_inner_radius = 0.0
			pm.emission_ring_height = 0.1
			pm.emission_ring_axis = Vector3.UP
			pm.direction = Vector3.UP
			pm.spread = 15
			pm.initial_velocity_min = 0.5
			pm.initial_velocity_max = 2.2 if effet == "feu" else 1.0
			pm.gravity = Vector3.ZERO
			var gr := Gradient.new()
			gr.colors = PackedColorArray([Color(1, 1, 1, 0.9), Color(1, 1, 1, 0)])
			var gt := GradientTexture1D.new()
			gt.gradient = gr
			pm.color_ramp = gt
			part.process_material = pm
			var q := QuadMesh.new()
			q.size = Vector2(0.6, 0.6) if effet == "feu" else Vector2(0.18, 0.18)
			var mq := StandardMaterial3D.new()
			mq.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			mq.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			mq.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
			mq.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
			mq.vertex_color_use_as_albedo = true
			mq.albedo_texture = Textures.point_lumineux()
			mq.albedo_color = couleur * 1.6
			q.material = mq
			part.draw_pass_1 = q
			g.add_child(part)
	if effet == "feu" or effet == "soin":
		var l := OmniLight3D.new()
		l.light_color = couleur
		l.light_energy = 1.5
		l.omni_range = rayon * 1.6
		l.position.y = 0.8
		g.add_child(l)
	if effet == "trouNoir":
		var coeur := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = 0.9
		sm.height = 1.8
		coeur.mesh = sm
		var mc := StandardMaterial3D.new()
		mc.albedo_color = Color(0.02, 0.0, 0.03)
		mc.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		coeur.material_override = mc
		coeur.position.y = 1.6
		g.add_child(coeur)
		z["coeur"] = coeur
		son("ultime", p, -2.0)
	if effet == "sonar":
		z["duree"] = 0.4 + int(def.get("pulses", 2)) * 1.3
		z["prochain"] = 0.4
		z["oy"] = (proj.get("pos", p) as Vector3).y if not proj.is_empty() else p.y + 0.3
		if def.has("degats"):
			for c in ennemis(lanceur):
				if c.global_position.distance_to(p) < 1.5:
					degats(c, float(def["degats"]), lanceur, id)
	if effet == "frappe":
		var delai := float(def.get("delai", 1.2))
		var nb := int(def.get("nombre", 1))
		z["duree"] = delai + 0.15 * nb + 0.3
		var impacts := []
		for i in nb:
			var a := randf() * TAU
			var r := 0.0 if i == 0 else sqrt(randf()) * float(def.get("dispersion", 0))
			impacts.append({"pos": p + Vector3(cos(a) * r, 0, sin(a) * r), "t": delai + i * 0.15, "fait": false})
		z["impacts"] = impacts
		son("capacite", p, -2.0)
	if effet == "soin":
		son("soin", p, -4.0)
	zones.append(z)


func _maj_zones(dt: float) -> void:
	for z in zones:
		z["t"] += dt
		var t: float = z["t"]
		var k := clampf(minf(t / 0.3, (float(z["duree"]) - t) / 0.6), 0.0, 1.0)
		if z.has("mat"):
			var m: StandardMaterial3D = z["mat"]
			m.albedo_color.a = 0.18 * k
			(z["mat_bord"] as StandardMaterial3D).albedo_color.a = 0.9 * k * (0.75 + 0.25 * sin(horloge * 6.0))
		z["tick"] -= dt
		var tick: bool = z["tick"] <= 0.0
		if tick:
			z["tick"] = 0.25
		var p: Vector3 = z["pos"]
		var r2: float = float(z["rayon"]) ** 2
		var def: Dictionary = z["def"]
		var lanceur: Combattant = z["lanceur"]
		if not is_instance_valid(lanceur):
			z["fini"] = true
			(z["noeud"] as Node).queue_free()
			continue
		match String(z["effet"]):
			"feu":
				if tick:
					for c in ennemis(lanceur):
						if Vector2(c.global_position.x - p.x, c.global_position.z - p.z).length_squared() < r2 and c.global_position.y - p.y < 1.5:
							degats(c, float(def.get("dps", 30)) * 0.25, lanceur, z["id"])
			"ralenti":
				for c in ennemis(lanceur):
					if Vector2(c.global_position.x - p.x, c.global_position.z - p.z).length_squared() < r2:
						if autorite:
							c.appliquer_statut("ralenti", 0.3)
						if tick and def.has("dps"):
							degats(c, float(def["dps"]) * 0.25, lanceur, z["id"])
			"soin":
				if tick and autorite:
					for c in allies(lanceur):
						if Vector2(c.global_position.x - p.x, c.global_position.z - p.z).length_squared() < r2 and c.vie < 100.0:
							c.vie = minf(100.0, c.vie + float(def.get("hps", 15)) * 0.25)
					if def.has("ralentiEnnemis"):
						for c in ennemis(lanceur):
							if Vector2(c.global_position.x - p.x, c.global_position.z - p.z).length_squared() < r2:
								c.appliquer_statut("ralenti", 0.4)
			"sonar":
				if t >= float(z["prochain"]) and int(z["pulses"]) < int(def.get("pulses", 2)):
					z["pulses"] += 1
					z["prochain"] += 1.3
					anneau(p, float(z["rayon"]), couleur_de(def), 0.8)
					son("sonar", p + Vector3.UP, -2.0)
					var oy := Vector3(p.x, float(z["oy"]) + 0.2, p.z)
					for c in ennemis(lanceur):
						if c.global_position.distance_to(p) > float(z["rayon"]):
							continue
						if ligne_libre(oy, c.yeux() - Vector3(0, 0.3, 0)) or ligne_libre(oy, c.global_position + Vector3(0, 0.6, 0)):
							reveler(c, 2.2)
			"trouNoir":
				if z.has("coeur"):
					(z["coeur"] as Node3D).scale = Vector3.ONE * maxf(0.05, k) * (1.0 + sin(horloge * 9.0) * 0.08)
				if t < float(z["duree"]) - 0.25:
					for c in ennemis(lanceur):
						var d := Vector3(p.x - c.global_position.x, 0, p.z - c.global_position.z)
						if d.length() > float(z["rayon"]) or d.length() < 0.4:
							continue
						if autorite:
							c.velocity += d.normalized() * 14.0 * dt
				elif not z.get("explose", false):
					z["explose"] = true
					partie.effets.explosion(p + Vector3(0, 1.2, 0), float(z["rayon"]) * 0.5, couleur_de(def))
					for c in ennemis(lanceur):
						if c.global_position.distance_to(p) < float(z["rayon"]) * 0.75:
							degats(c, float(def.get("degats", 70)), lanceur, z["id"])
			"frappe":
				for imp in z["impacts"]:
					if not imp["fait"] and t >= float(imp["t"]):
						imp["fait"] = true
						exploser(sol(imp["pos"], 3.0), float(def.get("degats", 80)), float(z["rayon"]), lanceur, z["id"], couleur_de(def))
		if t >= float(z["duree"]):
			z["fini"] = true
			(z["noeud"] as Node).queue_free()
	zones = zones.filter(func(z: Dictionary) -> bool: return not z.get("fini", false))


## Anneau lumineux qui s'étend (sonars, ondes, séisme)
func anneau(p: Vector3, rayon: float, couleur: Color, duree := 0.6) -> void:
	var m := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.92
	tm.outer_radius = 1.0
	tm.rings = 48
	m.mesh = tm
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mat.albedo_color = Color(couleur.r * 2, couleur.g * 2, couleur.b * 2, 0.9)
	m.material_override = mat
	m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(m)
	m.global_position = p + Vector3(0, 0.1, 0)
	m.scale = Vector3(0.3, 0.3, 0.3)
	var tw := create_tween().set_parallel(true)
	tw.tween_property(m, "scale", Vector3(rayon, 1.0, rayon), duree).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)
	tw.tween_property(mat, "albedo_color:a", 0.0, duree)
	tw.chain().tween_callback(m.queue_free)


# =============================================================================
# Bonus, révélations, séisme
# =============================================================================
func buff(c: Combattant, def: Dictionary) -> bool:
	if def.get("condition", "") == "blesse" and c.vie >= 100.0 and not def.has("cadence") and not def.has("vitesse"):
		return false
	if def.has("armure"):
		if c.armure >= 100.0:
			return false
		c.armure = minf(100.0, c.armure + float(def["armure"]))
		son("bouclier", c.global_position)
	if def.has("soin"):
		c.ajouter_soin(float(def["soin"]), float(def.get("dureeSoin", 2)))
		son("soin", c.global_position)
	var d := float(def.get("duree", 6))
	if def.has("cadence"):
		c.bonus_cadence = float(def["cadence"])
		c.appliquer_statut("cadence", d)
	if def.has("vitesse"):
		c.bonus_vitesse = float(def["vitesse"])
		c.appliquer_statut("vitesse", d)
	if def.get("rechargeRapide", false):
		c.appliquer_statut("recharge_rapide", d)
	anneau(c.global_position, 1.4, Color.WHITE, 0.5)
	return true


func bonus_equipe(c: Combattant, def: Dictionary) -> bool:
	var cibles := allies(c, float(def.get("rayon", 0)))
	if not cibles.has(c):
		cibles.append(c)
	for x in cibles:
		var cb: Combattant = x
		if def.has("armure"):
			cb.armure = minf(100.0, cb.armure + float(def["armure"]))
		if def.has("soin"):
			cb.vie = minf(100.0, cb.vie + float(def["soin"]))
		var d := float(def.get("duree", 6))
		if def.has("cadence"):
			cb.bonus_cadence = float(def["cadence"])
			cb.appliquer_statut("cadence", d)
		if def.has("vitesse"):
			cb.bonus_vitesse = float(def["vitesse"])
			cb.appliquer_statut("vitesse", d)
		if def.get("munitions", false) and cb.has_method("remplir_munitions"):
			cb.call("remplir_munitions")
		anneau(cb.global_position, 1.2, Color(0.55, 0.7, 1.0) if def.has("armure") else Color(0.6, 1.0, 0.4), 0.5)
	son("bouclier" if def.has("armure") and not def.has("soin") else "soin", c.global_position)
	return true


func sonar(c: Combattant, def: Dictionary) -> void:
	var global_ := not def.has("rayon")
	anneau(c.global_position, 40.0 if global_ else float(def["rayon"]), Color(0.35, 1.0, 0.82), 1.4 if global_ else 0.9)
	son("sonar", c.global_position)
	for e in ennemis(c):
		if global_ or e.global_position.distance_to(c.global_position) <= float(def["rayon"]):
			reveler(e, float(def.get("duree", 3)))
	if def.has("vitesse"):
		c.bonus_vitesse = float(def["vitesse"])
		c.appliquer_statut("vitesse", float(def.get("duree", 3)))


func cone(c: Combattant, dir: Vector3, def: Dictionary) -> void:
	var cos_max := cos(deg_to_rad(float(def.get("angle", 50)) / 2.0))
	anneau(c.global_position + dir * 4.0, 4.0, Color(1.0, 0.78, 0.27), 0.6)
	son("sonar", c.global_position)
	for e in ennemis(c):
		var d := Vector3(e.global_position.x - c.global_position.x, 0, e.global_position.z - c.global_position.z)
		if d.length() > float(def.get("portee", 40)) or d.length() < 0.1:
			continue
		if d.normalized().dot(dir) < cos_max:
			continue
		reveler(e, float(def.get("duree", 4)))


func seisme(c: Combattant, def: Dictionary, id: String) -> void:
	var p := c.global_position
	anneau(p, 1.5, Color(1.0, 0.65, 0.17), 0.3)
	plus_tard(float(def.get("delai", 0.45)), func() -> void:
		var r := float(def.get("rayon", 8))
		anneau(p, r, Color(1.0, 0.65, 0.17), 0.7)
		anneau(p, r * 0.6, Color(1.0, 0.88, 0.54), 0.5)
		son("explosion", p, 0.0)
		partie.joueur.secousse = 1.0 if partie.joueur.global_position.distance_to(p) < r * 1.5 else partie.joueur.secousse
		for e in ennemis(c):
			var d := Vector2(e.global_position.x - p.x, e.global_position.z - p.z).length()
			if d > r or e.global_position.y - p.y > 1.2:
				continue
			degats(e, float(def.get("degats", 60)) * (1.0 - 0.5 * d / r), c, id)
			if autorite:
				e.appliquer_statut("ralenti", float(def.get("ralenti", 3))))


func resurrection(c: Combattant, def: Dictionary) -> bool:
	var meilleur: Combattant = null
	for x in partie.combattants:
		if x != c and not x.vivant and x.equipe == c.equipe and not (x is Cible):
			if meilleur == null or x.global_position.distance_to(c.global_position) < meilleur.global_position.distance_to(c.global_position):
				meilleur = x
	if meilleur == null:
		return false
	if autorite and partie.has_method("ressusciter"):
		partie.ressusciter(meilleur, c, float(def.get("vie", 100)))
	anneau(meilleur.global_position, 2.0, Color(1.0, 0.95, 0.6), 1.0)
	son("ultime_pret", meilleur.global_position)
	return true


# =============================================================================
# Déplacements : ruée, saut, téléportation, charge
# =============================================================================
func deplacement(c: Combattant, def: Dictionary, id: String, plat: Vector3) -> bool:
	match String(def.get("famille", "")):
		"saut":
			if not c.is_on_floor():
				return false
			c.velocity.y = float(def.get("impulsion", 8.8))
			anneau(c.global_position, 1.3, Color(1.0, 0.25, 0.63), 0.4)
			son("ruee", c.global_position)
		"ruee":
			var dir := plat
			var v := Vector3(c.velocity.x, 0, c.velocity.z)
			if v.length() > 1.0:
				dir = v.normalized()
			c.set_meta("ruee", {"dir": dir, "t": float(def.get("duree", 0.27)), "v": float(def.get("vitesse", 30))})
			son("ruee", c.global_position)
		"blink":
			var portee := float(def.get("portee", 9))
			var o := c.global_position + Vector3(0, 1.0, 0)
			var r := rayon_monde(o, o + plat * portee)
			var dist := portee if r.is_empty() else maxf(0.0, o.distance_to(r["position"]) - 0.6)
			if dist < 1.0:
				return false
			var cible := sol(c.global_position + plat * dist, 1.5)
			anneau(c.global_position, 1.2, Color(0.69, 0.49, 1.0), 0.4)
			c.global_position = cible + Vector3(0, 0.05, 0)
			anneau(cible, 1.2, Color(0.69, 0.49, 1.0), 0.4)
			son("teleport", cible)
		"charge":
			c.set_meta("charge", {"dir": plat, "t": float(def.get("duree", 0.45)), "v": float(def.get("vitesse", 16)), "deg": float(def.get("degats", 50)), "id": id, "touches": []})
			son("ruee", c.global_position)
	return true


## Appelé par le joueur / les bots à chaque image physique : applique ruée et charge en cours
func maj_deplacement(c: Combattant, dt: float) -> bool:
	if c.has_meta("ruee"):
		var r: Dictionary = c.get_meta("ruee")
		r["t"] -= dt
		c.velocity.x = r["dir"].x * float(r["v"])
		c.velocity.z = r["dir"].z * float(r["v"])
		c.velocity.y = maxf(c.velocity.y, 0.0)
		if r["t"] <= 0.0:
			c.remove_meta("ruee")
			c.velocity.x *= 0.25
			c.velocity.z *= 0.25
		return true
	if c.has_meta("charge"):
		var ch: Dictionary = c.get_meta("charge")
		ch["t"] -= dt
		c.velocity.x = ch["dir"].x * float(ch["v"])
		c.velocity.z = ch["dir"].z * float(ch["v"])
		for e in ennemis(c):
			if e.global_position.distance_to(c.global_position) < 1.6 and not (ch["touches"] as Array).has(e):
				(ch["touches"] as Array).append(e)
				degats(e, float(ch["deg"]), c, ch["id"])
				if autorite:
					e.velocity += Vector3(ch["dir"].x, 0.4, ch["dir"].z) * 9.0
					e.appliquer_statut("commotion", 1.5)
		if ch["t"] <= 0.0:
			c.remove_meta("charge")
		return true
	return false


# =============================================================================
# Murs, pièges, tourelle, drone
# =============================================================================
func poser_mur(lanceur: Combattant, dir: Vector3, def: Dictionary) -> bool:
	var longueur := float(def.get("longueur", 4.5))
	var vie := float(def.get("vie", 600))
	var couleur := couleur_de(def) if def.has("couleur") else Color(0.5, 0.72, 1.0)
	for recul in [2.6, 3.6, 1.8]:
		var centre: Vector3 = lanceur.global_position + dir * float(recul)
		var occupe := false
		for c in partie.combattants:
			if c.vivant and Vector2(c.global_position.x - centre.x, c.global_position.z - centre.z).length() < longueur * 0.5 + 0.4 and absf(dir.cross(Vector3.UP).normalized().dot(c.global_position - centre)) < 0.8 and absf(dir.dot(c.global_position - centre)) < 0.7:
				occupe = true
		if occupe:
			continue
		var y0 := sol(centre, 2.0).y
		var corps := StaticBody3D.new()
		corps.collision_layer = Combattant.COUCHE_OBJETS
		corps.collision_mask = 0
		add_child(corps)
		corps.global_position = Vector3(centre.x, y0 + 1.6, centre.z)
		corps.rotation.y = atan2(dir.x, dir.z)
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = Vector3(longueur, 3.2, 0.4)
		cs.shape = bs
		corps.add_child(cs)
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = bs.size
		mi.mesh = bm
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(couleur.r, couleur.g, couleur.b, 0.55)
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.emission_enabled = true
		mat.emission = couleur
		mat.emission_energy_multiplier = 1.2
		mat.roughness = 0.2
		mat.cull_mode = BaseMaterial3D.CULL_DISABLED
		mi.material_override = mat
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		corps.add_child(mi)
		corps.scale.y = 0.01
		var m := {"noeud": corps, "vie": vie, "vie_max": vie, "equipe": lanceur.equipe, "t": 0.0, "duree": float(def.get("duree", 14)), "mat": mat, "type": "mur"}
		corps.set_meta("objet_capacite", m)
		corps.set_meta("matiere", "metal")
		murs.append(m)
		son("mur", corps.global_position)
		return true
	return false


func degats_objet(o: Dictionary, quantite: float) -> void:
	if not autorite:
		return
	o["vie"] -= quantite
	if o["vie"] <= 0.0:
		detruire_objet(o)


func detruire_objet(o: Dictionary) -> void:
	if o.get("detruit", false):
		return
	o["detruit"] = true
	var n: Node3D = o["noeud"]
	if o["type"] == "tourelle":
		partie.effets.explosion(n.global_position + Vector3(0, 0.4, 0), 0.8, Color(1.0, 0.7, 0.4))
	n.queue_free()
	murs.erase(o)
	tourelles.erase(o)


func _maj_murs(dt: float) -> void:
	for m in murs.duplicate():
		m["t"] += dt
		var n: Node3D = m["noeud"]
		n.scale.y = minf(1.0, float(m["t"]) / 0.35)
		(m["mat"] as StandardMaterial3D).albedo_color.a = 0.3 + 0.25 * float(m["vie"]) / float(m["vie_max"]) + sin(float(m["t"]) * 6.0) * 0.03
		if m["t"] > m["duree"]:
			detruire_objet(m)


func poser_piege(lanceur: Combattant, dir: Vector3, def: Dictionary, id: String) -> bool:
	var o := lanceur.global_position + Vector3(0, 0.4, 0)
	var r := rayon_monde(o, o + dir * 3.5)
	var d := 3.0 if r.is_empty() else maxf(0.6, o.distance_to(r["position"]) - 0.5)
	var p := sol(lanceur.global_position + dir * d, 1.5)
	var siens := pieges.filter(func(x: Dictionary) -> bool: return x["lanceur"] == lanceur and x["id"] == id)
	if siens.size() >= int(def.get("charges", 2)):
		(siens[0]["noeud"] as Node).queue_free()
		pieges.erase(siens[0])
	var couleur := couleur_de(def) if def.has("couleur") else Color(0.61, 1.0, 0.23)
	var g := Node3D.new()
	add_child(g)
	g.global_position = p + Vector3(0, 0.03, 0)
	var socle := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.16
	cm.bottom_radius = 0.2
	cm.height = 0.06
	socle.mesh = cm
	socle.material_override = Materiaux.obtenir("metal")
	g.add_child(socle)
	var voyant := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.05
	sm.height = 0.1
	voyant.mesh = sm
	voyant.material_override = Materiaux.neon(couleur, 4.0)
	voyant.position.y = 0.06
	g.add_child(voyant)
	pieges.append({"noeud": g, "voyant": voyant, "pos": p, "def": def, "id": id, "lanceur": lanceur, "equipe": lanceur.equipe, "t": 0.0, "couleur": couleur})
	son("capacite", p, -6.0)
	return true


func _maj_pieges(dt: float) -> void:
	for p in pieges.duplicate():
		p["t"] += dt
		(p["voyant"] as Node3D).visible = int(horloge * 2.5) % 2 == 0
		if float(p["t"]) < 0.6 or not is_instance_valid(p["lanceur"]):
			continue
		var def: Dictionary = p["def"]
		var r := float(def.get("declencheur", 2.2))
		var pos: Vector3 = p["pos"]
		var declenche := false
		for c in ennemis(p["lanceur"]):
			if Vector2(c.global_position.x - pos.x, c.global_position.z - pos.z).length() < r and absf(c.global_position.y - pos.y) < 1.2:
				declenche = true
		if not declenche:
			continue
		anneau(pos, r * 1.4, p["couleur"], 0.5)
		son("explosion" if def.has("degats") else "capacite", pos, -4.0)
		for c in ennemis(p["lanceur"]):
			if Vector2(c.global_position.x - pos.x, c.global_position.z - pos.z).length() > r * 1.2:
				continue
			if def.has("degats"):
				degats(c, float(def["degats"]), p["lanceur"], p["id"])
			if def.has("ralenti") and autorite:
				c.appliquer_statut("ralenti", float(def["ralenti"]))
			if def.has("revele"):
				reveler(c, float(def["revele"]))
		(p["noeud"] as Node).queue_free()
		pieges.erase(p)


func poser_tourelle(lanceur: Combattant, dir: Vector3, def: Dictionary, id: String) -> bool:
	for t in tourelles.duplicate():
		if t["lanceur"] == lanceur:
			detruire_objet(t)
	var o := lanceur.global_position + Vector3(0, 0.5, 0)
	var r := rayon_monde(o, o + dir * 2.2)
	var d := 1.6 if r.is_empty() else maxf(0.7, o.distance_to(r["position"]) - 0.5)
	var p := sol(lanceur.global_position + dir * d, 1.5)
	var corps := StaticBody3D.new()
	corps.collision_layer = Combattant.COUCHE_OBJETS
	add_child(corps)
	corps.global_position = p
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(0.45, 0.8, 0.45)
	cs.shape = bs
	cs.position.y = 0.4
	corps.add_child(cs)
	var metal := Materiaux.obtenir("metal_peint")
	var pied := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.06
	cm.bottom_radius = 0.3
	cm.height = 0.55
	pied.mesh = cm
	pied.material_override = metal
	pied.position.y = 0.28
	corps.add_child(pied)
	var tete := Node3D.new()
	tete.position.y = 0.64
	tete.rotation.y = atan2(-dir.x, -dir.z)
	corps.add_child(tete)
	var boitier := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.28, 0.2, 0.34)
	boitier.mesh = bm
	boitier.material_override = metal
	tete.add_child(boitier)
	var canon := MeshInstance3D.new()
	var cc := CylinderMesh.new()
	cc.top_radius = 0.025
	cc.bottom_radius = 0.03
	cc.height = 0.4
	canon.mesh = cc
	canon.material_override = Materiaux.obtenir("metal")
	canon.rotation.x = PI / 2
	canon.position = Vector3(0, 0.02, -0.3)
	tete.add_child(canon)
	var oeil := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.035
	sm.height = 0.07
	oeil.mesh = sm
	oeil.material_override = Materiaux.neon(Color(0.61, 1.0, 0.23), 4.0)
	oeil.position = Vector3(0, 0.05, -0.17)
	tete.add_child(oeil)
	var t := {"noeud": corps, "tete": tete, "type": "tourelle", "def": def, "id": id, "lanceur": lanceur, "equipe": lanceur.equipe,
		"vie": float(def.get("vie", 160)), "t": 0.0, "duree": float(def.get("duree", 25)), "prochain": 0.8, "cible": null, "cherche": 0.0}
	corps.set_meta("objet_capacite", t)
	corps.set_meta("matiere", "metal")
	tourelles.append(t)
	son("bouclier", p)
	return true


func _maj_tourelles(dt: float) -> void:
	for t in tourelles.duplicate():
		t["t"] += dt
		if t["t"] > t["duree"] or not is_instance_valid(t["lanceur"]):
			detruire_objet(t)
			continue
		var tete: Node3D = t["tete"]
		var o := tete.global_position
		t["cherche"] -= dt
		if t["cherche"] <= 0.0:
			t["cherche"] = 0.15
			var meilleur: Combattant = null
			var dmin := float(t["def"].get("portee", 28))
			for c in ennemis(t["lanceur"]):
				var d := c.global_position.distance_to(o)
				if d > dmin or c.invisible():
					continue
				if not ligne_libre(o, c.yeux() - Vector3(0, 0.3, 0)) or fumee_bloque(o, c.yeux()):
					continue
				dmin = d
				meilleur = c
			t["cible"] = meilleur
		var c: Combattant = t["cible"]
		if c == null or not is_instance_valid(c) or not c.vivant:
			tete.rotation.y += dt * 0.8
			continue
		var voulu := atan2(-(c.global_position.x - o.x), -(c.global_position.z - o.z))
		var diff := wrapf(voulu - tete.rotation.y, -PI, PI)
		tete.rotation.y += signf(diff) * minf(absf(diff), 5.0 * dt)
		t["prochain"] -= dt
		if absf(diff) > 0.12 or t["prochain"] > 0.0:
			continue
		t["prochain"] = float(t["def"].get("cadence", 0.24))
		var d := c.global_position.distance_to(o)
		var chance := 0.6 if d < 10.0 else (0.42 if d < 20.0 else 0.28)
		var touche := randf() < chance
		var depart := o + tete.global_transform.basis * Vector3(0, 0.02, -0.45)
		var arrivee := c.yeux() - Vector3(0, 0.45, 0) + (Vector3.ZERO if touche else Vector3(randf_range(-0.7, 0.7), randf_range(0, 0.8), randf_range(-0.7, 0.7)))
		partie.effets.trace(depart, arrivee, Color(0.7, 1.0, 0.4), 0.012)
		partie.effets.flash(depart, Color(0.7, 1.0, 0.4), 0.5)
		son("tourelle_tir", depart, -6.0)
		if touche:
			degats(c, float(t["def"].get("degats", 9)), t["lanceur"], t["id"])


func lancer_drone(lanceur: Combattant, dir: Vector3, duree: float) -> void:
	var g := Node3D.new()
	add_child(g)
	g.global_position = lanceur.global_position + dir * 0.6 + Vector3(0, 1.6, 0)
	g.rotation.y = atan2(-dir.x, -dir.z)
	var corps := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.24, 0.07, 0.24)
	corps.mesh = bm
	corps.material_override = Materiaux.obtenir("metal_peint")
	g.add_child(corps)
	for x in [-0.15, 0.15]:
		for z in [-0.15, 0.15]:
			var r := MeshInstance3D.new()
			var tm := TorusMesh.new()
			tm.inner_radius = 0.06
			tm.outer_radius = 0.08
			r.mesh = tm
			r.material_override = Materiaux.obtenir("metal")
			r.position = Vector3(x, 0.03, z)
			g.add_child(r)
	var oeil := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.035
	sm.height = 0.07
	oeil.mesh = sm
	oeil.material_override = Materiaux.neon(Color(1.0, 0.82, 0.4), 5.0)
	oeil.position = Vector3(0, -0.02, -0.13)
	g.add_child(oeil)
	var l := OmniLight3D.new()
	l.light_color = Color(1.0, 0.82, 0.4)
	l.light_energy = 0.8
	l.omni_range = 2.0
	g.add_child(l)
	drones.append({"noeud": g, "dir": dir, "t": 0.0, "duree": duree, "lanceur": lanceur, "equipe": lanceur.equipe, "scan": 0.0, "y0": g.global_position.y, "oeil": oeil})
	son("drone", g.global_position, -4.0)


func _maj_drones(dt: float) -> void:
	for d in drones:
		d["t"] += dt
		var g: Node3D = d["noeud"]
		var p := g.global_position
		var dir: Vector3 = d["dir"]
		if rayon_monde(p, p + dir * (7.0 * dt + 0.4)).is_empty():
			p += dir * 7.0 * dt
		p.y = float(d["y0"]) + sin(float(d["t"]) * 4.0) * 0.05
		g.global_position = p
		(d["oeil"] as Node3D).visible = int(float(d["t"]) * 4.0) % 2 == 0
		d["scan"] -= dt
		if d["scan"] <= 0.0 and is_instance_valid(d["lanceur"]):
			d["scan"] = 0.25
			for c in ennemis(d["lanceur"]):
				if c.global_position.distance_to(p) > 24.0 or not ligne_libre(p, c.yeux()) or fumee_bloque(p, c.yeux()):
					continue
				reveler(c, 2.5)
		if d["t"] >= d["duree"]:
			d["fini"] = true
			g.queue_free()
	drones = drones.filter(func(d: Dictionary) -> bool: return not d.get("fini", false))


# =============================================================================
func _physics_process(dt: float) -> void:
	horloge += dt
	for d in differes:
		d[0] -= dt
	var a_faire := differes.filter(func(d: Array) -> bool: return d[0] <= 0.0)
	differes = differes.filter(func(d: Array) -> bool: return d[0] > 0.0)
	for d in a_faire:
		(d[1] as Callable).call()
	_maj_projectiles(dt)
	_maj_fumees(dt)
	_maj_zones(dt)
	_maj_murs(dt)
	_maj_pieges(dt)
	_maj_tourelles(dt)
	_maj_drones(dt)


## Nouvelle manche : tout disparaît
func nettoyer() -> void:
	for l in [projectiles, fumees, zones, pieges, drones]:
		for o in l:
			if o.has("mesh") and is_instance_valid(o["mesh"]):
				(o["mesh"] as Node).queue_free()
			if o.has("noeud") and is_instance_valid(o["noeud"]):
				(o["noeud"] as Node).queue_free()
		l.clear()
	for o in murs.duplicate() + tourelles.duplicate():
		detruire_objet(o)
	differes.clear()
