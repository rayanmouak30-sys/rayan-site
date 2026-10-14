extends Node
## Multijoueur (ENet) : héberger ou rejoindre une partie. Complété à l'étape multijoueur.

var pair: MultiplayerPeer = null


func actif() -> bool:
	return pair != null


func quitter() -> void:
	if pair:
		pair.close()
	pair = null
	multiplayer.multiplayer_peer = OfflineMultiplayerPeer.new()
