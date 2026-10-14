extends Control
## Multijoueur : pseudo, héberger (affiche les adresses à donner aux amis) ou rejoindre par adresse IP,
## puis salon : joueurs, équipes, héros, état prêt ; l'hôte choisit le mode, la difficulté et lance.

signal retour

var l_etat: Label
var champ_ip: LineEdit
var champ_pseudo: LineEdit
var accueil: VBoxContainer
var salon: VBoxContainer
var liste: VBoxContainer
var l_adresses: Label
var b_lancer: Button
var b_pret: Button
var opt_mode: OptionButton
var opt_diff: OptionButton
var case_bots: CheckButton


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = Style.theme()
	var voile := ColorRect.new()
	voile.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	voile.color = Color(0.02, 0.025, 0.04, 0.92)
	add_child(voile)
	var cadre := PanelContainer.new()
	cadre.anchor_left = 0.5
	cadre.anchor_right = 0.5
	cadre.anchor_top = 0.5
	cadre.anchor_bottom = 0.5
	cadre.offset_left = -560
	cadre.offset_right = 560
	cadre.offset_top = -380
	cadre.offset_bottom = 380
	add_child(cadre)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 14)
	cadre.add_child(v)
	var haut := HBoxContainer.new()
	v.add_child(haut)
	var t := Style.etiquette("MULTIJOUEUR", 40, Style.TEXTE, true, 700)
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	haut.add_child(t)
	var fermer := Style.bouton("FERMER", 20, 140, 44)
	fermer.pressed.connect(func() -> void:
		if not Reseau.en_partie:
			Reseau.quitter()
		retour.emit())
	haut.add_child(fermer)
	var hp := HBoxContainer.new()
	hp.add_theme_constant_override("separation", 12)
	v.add_child(hp)
	hp.add_child(Style.etiquette("Pseudo", 18, Style.TEXTE, false, 500))
	champ_pseudo = LineEdit.new()
	champ_pseudo.text = String(Reglages.lire("pseudo"))
	champ_pseudo.placeholder_text = "Votre nom en jeu"
	champ_pseudo.max_length = 16
	champ_pseudo.custom_minimum_size.x = 300
	champ_pseudo.text_changed.connect(func(x: String) -> void:
		Reglages.ecrire("pseudo", x)
		Reseau.maj_moi("pseudo", x if x != "" else "Joueur"))
	hp.add_child(champ_pseudo)
	l_etat = Style.etiquette("", 16, Style.ACCENT2, false, 600)
	l_etat.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(l_etat)
	_accueil(v)
	_salon(v)
	Reseau.salon_change.connect(_maj_salon)
	Reseau.connecte.connect(func() -> void: l_etat.text = "Connecté ! En attente de l'hôte.")
	Reseau.echec.connect(func(r: String) -> void:
		l_etat.text = r
		_montrer(false))
	Reseau.deconnecte.connect(func(r: String) -> void:
		l_etat.text = r
		_montrer(false))
	_montrer(Reseau.actif())
	if Reseau.actif():
		_maj_salon()


func _accueil(v: VBoxContainer) -> void:
	accueil = VBoxContainer.new()
	accueil.add_theme_constant_override("separation", 14)
	v.add_child(accueil)
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 20)
	accueil.add_child(h)
	var heb := PanelContainer.new()
	heb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(heb)
	var hv := VBoxContainer.new()
	hv.add_theme_constant_override("separation", 10)
	heb.add_child(hv)
	hv.add_child(Style.etiquette("HÉBERGER", 26, Style.TEXTE, true, 700))
	var aide := Style.etiquette("Votre PC fait tourner la partie. Donnez votre adresse à vos amis (même Wi-Fi, ou VPN type Radmin VPN / ZeroTier pour jouer à distance). Port %d (UDP)." % Reseau.PORT, 15, Style.TEXTE2, false, 500)
	aide.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	aide.custom_minimum_size.x = 440
	hv.add_child(aide)
	var b := Style.bouton("CRÉER UN SALON", 22, 0, 56)
	b.pressed.connect(func() -> void:
		var err := Reseau.heberger()
		l_etat.text = err if err != "" else "Salon créé."
		if err == "":
			_montrer(true)
			_maj_salon())
	hv.add_child(b)
	var rej := PanelContainer.new()
	rej.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(rej)
	var rv := VBoxContainer.new()
	rv.add_theme_constant_override("separation", 10)
	rej.add_child(rv)
	rv.add_child(Style.etiquette("REJOINDRE", 26, Style.TEXTE, true, 700))
	var aide2 := Style.etiquette("Entrez l'adresse IP donnée par l'hôte.", 15, Style.TEXTE2, false, 500)
	rv.add_child(aide2)
	champ_ip = LineEdit.new()
	champ_ip.text = String(Reglages.lire("adresse_serveur"))
	champ_ip.placeholder_text = "ex. 192.168.1.20"
	rv.add_child(champ_ip)
	var b2 := Style.bouton("REJOINDRE", 22, 0, 56)
	b2.pressed.connect(func() -> void:
		Reglages.ecrire("adresse_serveur", champ_ip.text)
		var err := Reseau.rejoindre(champ_ip.text)
		l_etat.text = err if err != "" else "Connexion à %s…" % champ_ip.text
		if err == "":
			_montrer(true))
	rv.add_child(b2)


func _salon(v: VBoxContainer) -> void:
	salon = VBoxContainer.new()
	salon.add_theme_constant_override("separation", 12)
	salon.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(salon)
	l_adresses = Style.etiquette("", 18, Style.ACCENT, true, 700)
	l_adresses.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	salon.add_child(l_adresses)
	var opts := HBoxContainer.new()
	opts.add_theme_constant_override("separation", 12)
	salon.add_child(opts)
	opt_mode = OptionButton.new()
	for m in [["spike", "Spike"], ["elimination", "Élimination"], ["dm", "Combat à mort"]]:
		opt_mode.add_item(m[1])
		opt_mode.set_item_metadata(opt_mode.item_count - 1, m[0])
	opt_mode.item_selected.connect(func(i: int) -> void: Reseau.maj_config("mode", opt_mode.get_item_metadata(i)))
	opts.add_child(opt_mode)
	opt_diff = OptionButton.new()
	for d in [["facile", "Bots faciles"], ["normal", "Bots normaux"], ["difficile", "Bots difficiles"], ["expert", "Bots experts"]]:
		opt_diff.add_item(d[1])
		opt_diff.set_item_metadata(opt_diff.item_count - 1, d[0])
	opt_diff.selected = 1
	opt_diff.item_selected.connect(func(i: int) -> void: Reseau.maj_config("difficulte", opt_diff.get_item_metadata(i)))
	opts.add_child(opt_diff)
	case_bots = CheckButton.new()
	case_bots.text = "Compléter avec des bots"
	case_bots.button_pressed = true
	case_bots.toggled.connect(func(x: bool) -> void: Reseau.maj_config("bots", x))
	opts.add_child(case_bots)
	var defil := ScrollContainer.new()
	defil.size_flags_vertical = Control.SIZE_EXPAND_FILL
	salon.add_child(defil)
	liste = VBoxContainer.new()
	liste.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	liste.add_theme_constant_override("separation", 6)
	defil.add_child(liste)
	var bas := HBoxContainer.new()
	bas.add_theme_constant_override("separation", 12)
	salon.add_child(bas)
	var b_eq := Style.bouton("CHANGER D'ÉQUIPE", 20, 260, 54)
	b_eq.pressed.connect(func() -> void:
		var moi: Dictionary = Reseau.joueurs.get(Reseau.mon_id(), {})
		Reseau.maj_moi("equipe", "rouge" if moi.get("equipe", "bleu") == "bleu" else "bleu"))
	bas.add_child(b_eq)
	var b_heros := Style.bouton("CHOISIR L'AGENT", 20, 260, 54)
	b_heros.pressed.connect(_choisir_heros)
	bas.add_child(b_heros)
	b_pret = Style.bouton("PRÊT", 20, 160, 54)
	b_pret.toggle_mode = true
	b_pret.toggled.connect(func(x: bool) -> void: Reseau.maj_moi("pret", x))
	bas.add_child(b_pret)
	b_lancer = Style.bouton("LANCER LA PARTIE", 22, 0, 54)
	b_lancer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b_lancer.pressed.connect(func() -> void: Reseau.lancer())
	bas.add_child(b_lancer)


func _montrer(dans_salon: bool) -> void:
	accueil.visible = not dans_salon
	salon.visible = dans_salon


func _choisir_heros() -> void:
	var sel: Control = load("res://scripts/ui/page_selection.gd").new()
	sel.set("mode_lancement", false)
	add_child(sel)
	sel.connect("retour", sel.queue_free)
	sel.connect("verrouille", func(id: String, skin: String) -> void:
		Reseau.maj_moi("heros", id)
		Reseau.maj_moi("skin", skin)
		sel.queue_free())


func _maj_salon() -> void:
	if not is_inside_tree():
		return
	var hote := Reseau.est_hote()
	l_adresses.text = ("Adresse(s) à donner : " + ", ".join(Reseau.adresses_locales()) + "  (port %d)" % Reseau.PORT) if hote else "Salon de l'hôte"
	opt_mode.disabled = not hote
	opt_diff.disabled = not hote
	case_bots.disabled = not hote
	b_lancer.visible = hote
	for i in opt_mode.item_count:
		if opt_mode.get_item_metadata(i) == Reseau.config_partie.get("mode"):
			opt_mode.selected = i
	for c in liste.get_children():
		c.queue_free()
	for id in Reseau.joueurs:
		var j: Dictionary = Reseau.joueurs[id]
		var p := PanelContainer.new()
		var coul := Style.couleur_equipe(String(j.get("equipe", "bleu")))
		p.add_theme_stylebox_override("panel", Style.boite(Color(coul.r * 0.15, coul.g * 0.15, coul.b * 0.15, 0.9), 6, coul, 1, 12))
		var h := HBoxContainer.new()
		h.add_theme_constant_override("separation", 14)
		p.add_child(h)
		var por := TextureRect.new()
		var ch := "res://assets/portraits/%s.png" % j.get("heros", "kael")
		if ResourceLoader.exists(ch):
			por.texture = load(ch)
		por.custom_minimum_size = Vector2(44, 44)
		por.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		por.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		h.add_child(por)
		var n := Style.etiquette(String(j.get("pseudo", "Joueur")) + ("  (hôte)" if int(id) == 1 else "") + ("  (vous)" if int(id) == Reseau.mon_id() else ""), 20, Style.TEXTE, true, 700)
		n.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		h.add_child(n)
		h.add_child(Style.etiquette(String(DonneesHeros.heros(String(j.get("heros", "kael")))["nom"]), 18, DonneesHeros.couleur_categorie(String(j.get("heros", "kael"))), true, 700))
		h.add_child(Style.badge("ÉQUIPE " + ("BLEUE" if j.get("equipe") == "bleu" else "ROUGE"), coul))
		h.add_child(Style.badge("PRÊT" if j.get("pret", false) else "…", Style.OK if j.get("pret", false) else Style.TEXTE2))
		liste.add_child(p)
