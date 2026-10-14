extends Node
## Charge tous les scripts du projet pour détecter les erreurs de compilation.


func executer() -> void:
	var erreurs := 0
	for f in _lister("res://scripts"):
		var s: Script = load(f)
		if s == null or not s.can_instantiate():
			printerr("ERREUR SCRIPT : ", f)
			erreurs += 1
	Test.mesure("scripts_en_erreur", erreurs)


func _lister(dossier: String) -> Array:
	var l := []
	for d in DirAccess.get_directories_at(dossier):
		l.append_array(_lister(dossier.path_join(d)))
	for f in DirAccess.get_files_at(dossier):
		if f.ends_with(".gd"):
			l.append(dossier.path_join(f))
	return l
