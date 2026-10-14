# Neon Strike — FPS tactique 3D (Godot 4.7)

## Jouer sur Windows
1. Décompresse `NeonStrike-Windows.zip` où tu veux (Bureau par exemple).
2. Double-clique sur **NeonStrike.exe**. Si Windows affiche « Windows a protégé votre ordinateur » : *Informations complémentaires* → *Exécuter quand même* (le jeu n'est pas signé, c'est normal).
3. Pour le mettre sur le bureau : clic droit sur `NeonStrike.exe` → *Envoyer vers* → *Bureau (créer un raccourci)*.

Configuration conseillée : carte graphique compatible Vulkan ou DirectX 12 (sinon le jeu passe automatiquement en mode OpenGL, plus léger). Sur PC portable, mets *Réglages → Graphismes → Qualité : Basse*.

## Touches (modifiables dans Réglages → Touches)
| Action | Touche |
|---|---|
| Se déplacer | Z Q S D (W A S D en QWERTY) |
| Sauter / Courir / S'accroupir | Espace / Maj / Ctrl |
| Tirer / Viser | Clic gauche / Clic droit |
| Recharger / Inspecter | R / Y |
| Armes | 1 principale, 2 pistolet, 3 couteau, molette |
| Capacités | C, A (Q en QWERTY), E (signature), X (ultime) |
| Poser / désamorcer le Spike | F (maintenir) |
| Boutique (phase d'achat) | B |
| Tableau des scores | Tab |
| Pause | Échap |

Manette Xbox / PlayStation reconnue (stick droit pour viser).

## Modes
- **Spike** : 5 contre 5, attaque / défense, 7 manches gagnantes, changement de côté après 6 manches. Phase d'achat de 25 s (armes, boucliers, charges de capacités), pose du Spike en 4 s sur A ou B, explosion après 40 s, désamorçage en 7 s.
- **Élimination** : mêmes règles sans Spike.
- **Combat à mort** : 5 contre 5 avec réapparition, première équipe à 40 éliminations.
- **Stand de tir** : cibles à 10, 20, 30 et 50 m ; B pour changer d'arme principale.

Les bots ont 4 niveaux (facile, normal, difficile, expert) : ils se mettent à couvert, utilisent leurs capacités, s'organisent pour attaquer un site, défendent, reprennent et désamorcent.

## Multijoueur (jusqu'à 10 joueurs)
- **Même Wi-Fi / même box** : un joueur clique *Multijoueur → Créer un salon* ; l'adresse affichée (ex. `192.168.1.20`) est donnée aux autres, qui cliquent *Rejoindre* et la tapent.
- **À distance (Internet)** : le plus simple est d'installer tous les deux **Radmin VPN** (gratuit) ou **ZeroTier**, de rejoindre le même réseau, puis d'utiliser l'adresse Radmin/ZeroTier de l'hôte. Autre solution : ouvrir le port **7777 UDP** sur la box de l'hôte et donner son IP publique.
- Le pare-feu Windows demande l'autorisation au premier lancement : accepte (réseaux privés).
- L'hôte choisit le mode et la difficulté ; les équipes sont complétées par des bots si la case est cochée.

## Contenu
- 6 armes modélisées et animées (sortie, tir, rechargement normal et à vide, inspection, réarmement pompe et verrou), sons propres à chaque arme, douilles, flash, traçantes, impacts selon la matière, 11 skins d'armes.
- 20 agents différents (5 catégories), chacun avec 4 capacités (80 au total) et 3 skins (standard, élite au niveau 4, prestige au niveau 10, ou achetés avec des points gagnés en montant de niveau).
- Carte compétitive **Citadelle** : 2 sites, couloirs A principal, connecteur A, liaison A, milieu, liaison B, marché B, B principal, couloirs arrière.
- Interface : sélection des agents avec présentation 3D animée, viseur personnalisable, HUD complet, tableau des scores, résultats de manche et de partie, réglages graphiques / son / sensibilité / touches.

Tout le contenu (modèles 3D, animations, textures, sons, musique) est original, généré par les outils du dossier `outils/`. Polices Rajdhani et Barlow sous licence SIL OFL (voir `assets/polices/`).

## Pour les développeurs
- Ouvrir le dossier `neon-strike-godot` avec **Godot 4.7**.
- Régénérer le contenu : `outils/blender/armes.py`, `persos.py`, `persos_anims.py` (Blender en module Python `bpy`), `outils/sons.py`, `outils/textures.py`.
- Tests automatiques : `godot --path . -- --scenario=<nom>` (voir `scripts/tests/`).
- Export : *Projet → Exporter → Windows* (préréglage fourni).
