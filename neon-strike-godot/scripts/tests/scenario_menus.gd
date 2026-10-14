extends Node
## Captures des menus : principal, jouer, sélection des agents, réglages, arsenal.


func executer() -> void:
	get_tree().change_scene_to_file("res://scenes/menu.tscn")
	await Test.attendre(3.0)
	var m: Control = get_tree().current_scene
	await Test.capture("menu_principal")
	m.call("_ouvrir", m.get("page_jouer"))
	await Test.attendre(0.5)
	await Test.capture("menu_jouer")
	m.call("_choisir_agent")
	await Test.attendre(3.0)
	await Test.capture("menu_selection")
	var sel: Control = m.get_child(m.get_child_count() - 1)
	sel.call("montrer", "seraph")
	await Test.attendre(2.0)
	await Test.capture("menu_selection_seraph")
	sel.call("montrer", "titan")
	await Test.attendre(2.0)
	await Test.capture("menu_selection_titan")
	sel.queue_free()
	m.call("_reglages")
	await Test.attendre(1.0)
	await Test.capture("menu_reglages")
	var r: Control = m.get_child(m.get_child_count() - 1)
	(r.get("onglets") as TabContainer).current_tab = 4
	await Test.attendre(0.5)
	await Test.capture("menu_reglages_viseur")
	(r.get("onglets") as TabContainer).current_tab = 3
	await Test.attendre(0.5)
	await Test.capture("menu_reglages_touches")
	r.queue_free()
	m.call("_arsenal")
	await Test.attendre(2.0)
	await Test.capture("menu_arsenal")
