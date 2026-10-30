# ECO SURVIVOR

Jeu d'arcade 2D en vue du dessus réalisé avec **Godot 4** et **GDScript**.
Projet de Terminale STI2D, spécialité SIN (Systèmes d'Information et Numérique).

## Auteurs

- Nom Prénom : ......................................
- Nom Prénom : ......................................
- Classe : Terminale STI2D SIN – Année scolaire : ..........
- Professeur : ......................................

## 1. Thème : le développement durable

La ville est envahie par les déchets et la pollution. Le joueur incarne un agent écologique équipé
d'une pince à déchets. Il doit **ramasser les déchets recyclables** (plastique, papier, verre,
électronique), **éviter les dangers environnementaux** (déchets toxiques, nuages de pollution,
voitures polluantes) et **gérer son énergie**.

Le jeu montre plusieurs idées du développement durable :
- le **tri des déchets** : chaque matière a une valeur différente (les déchets électroniques,
  les plus polluants, rapportent le plus) ;
- l'**économie des ressources** : l'énergie du sprint est limitée et doit être utilisée au bon moment ;
- les **conséquences de la pollution** : plus le temps passe, plus la ville se pollue (brume,
  nuages toxiques, circulation plus dense) ;
- la ville du futur : toits solaires, toits végétalisés, éoliennes et jardins partagés, à côté
  d'usines qui fument.

## 2. Principe et règles

- **Objectif** : atteindre le score demandé (1000 points en mode Normal) **avant la fin du chronomètre**
  (2 min 30 en mode Normal).
- Le joueur a **3 vies**. Chaque vie possède une **barre de santé** de 100 points.
- Quand la santé tombe à 0, le joueur perd une vie et réapparaît au centre de la ville
  (avec 2,5 s d'invincibilité).

| Objet | Effet |
|---|---|
| Plastique (bouteille bleue) | +10 points |
| Papier (journal) | +15 points |
| Verre (bouteille verte) | +20 points |
| Déchet électronique (téléphone) | +30 points (disparaît plus vite) |
| Cœur | +35 santé |
| Batterie | Énergie rechargée à 100 % |
| Déchet toxique (baril jaune) | **−50 points et −25 santé** |
| Nuage de pollution | perte de santé tant qu'on reste dedans |
| Voiture | −20 santé et recul |
| Bâtiments, arbres, fontaine, étangs, conteneurs | obstacles (on ne peut pas les traverser) |

Les objets apparaissent à des endroits aléatoires et disparaissent au bout de quelques secondes
(ils clignotent avant de disparaître). Un nuage de pollution est toujours annoncé par un **cercle
rouge clignotant** 1,6 s avant de devenir dangereux.

### Difficulté progressive

La partie est découpée en **5 niveaux de pollution** (un nouveau niveau toutes les 30 s en Normal).
À chaque niveau, une alarme retentit et :
- les déchets apparaissent plus souvent ;
- il y a plus de déchets toxiques et de nuages de pollution, et les nuages sont plus grands et plus nocifs ;
- il y a plus de voitures et elles roulent plus vite, il faut donc se déplacer avec plus de précision ;
- une brume de pollution recouvre de plus en plus l'écran.

Le menu OPTIONS propose 3 difficultés : Facile (800 pts en 3 min), Normal (1000 pts en 2 min 30),
Difficile (1300 pts en 2 min 30, dégâts augmentés).

## 3. Commandes

| Action | Clavier | Manette |
|---|---|---|
| Se déplacer (8 directions) | **Z Q S D** ou **flèches** | stick gauche / croix |
| Sprinter (consomme l'énergie) | **Maj** ou **Espace** | bouton A |
| Pause | **Échap** ou **P** | Start |
| Menus | souris, ou flèches + Entrée | |

> Les touches de déplacement utilisent la **position physique** des touches : ZQSD sur un clavier
> AZERTY, WASD sur un clavier QWERTY.

Si l'énergie tombe à 0, le sprint est bloqué jusqu'à ce que la batterie remonte à 30 %.

## 4. Conditions de victoire et de défaite

- **Victoire** : le score atteint l'objectif avant la fin du temps. L'écran de victoire affiche
  de 1 à 3 étoiles (1 étoile = victoire, +1 s'il reste au moins 2 vies, +1 s'il reste au moins 30 s).
- **Défaite** : le chronomètre arrive à 0 sans avoir atteint l'objectif, **ou** le joueur perd ses 3 vies.
- Les deux écrans affichent les statistiques (score, déchets par type, temps, niveau de pollution,
  record) et les boutons **RECOMMENCER** et **RETOUR AU MENU**. Le record est sauvegardé.

## 5. Lancer, modifier et exporter le projet

1. Installer **Godot 4** (version 4.3 ou plus récente, version standard, pas besoin de .NET) :
   <https://godotengine.org/download>
2. Décompresser le ZIP.
3. Dans Godot : **Importer** → choisir le fichier `project.godot` → **Importer et modifier**.
   Au premier lancement, Godot importe les images et les sons (quelques secondes).
4. Appuyer sur **F5** (ou le bouton ▶) pour jouer.

**Export Web** : menu *Projet → Exporter…*, le préréglage **Web** est déjà configuré
(rendu Compatibility, **Thread Support désactivé**, aucune fonction multithread). Il faut seulement
installer les *modèles d'exportation* (Godot le propose dans la fenêtre d'export), puis cliquer sur
*Exporter le projet* et choisir le dossier `export/web/`. Les fichiers obtenus (`index.html`,
`.js`, `.wasm`, `.pck`) se mettent sur n'importe quel hébergement web. Comme les threads sont
désactivés, aucune configuration spéciale du serveur (en-têtes COOP/COEP) n'est nécessaire.
Pour tester en local, il faut passer par un petit serveur (exemple : `python -m http.server`),
pas ouvrir le fichier `index.html` directement.

## 6. Pourquoi Godot 4 ?

- **Gratuit et libre** (licence MIT), léger, fonctionne sur Windows, Linux et macOS.
- Très adapté à la **2D** : nœuds dédiés (CharacterBody2D, Area2D, particules, caméra 2D…).
- Le langage **GDScript** ressemble à Python, que l'on utilise en SIN.
- Le système de **scènes** et de **signaux** permet une architecture claire.
- **Export Web** intégré : le jeu peut être joué dans un navigateur.
- Le rendu **Compatibility** (OpenGL ES 3 / WebGL 2) fonctionne même sur des ordinateurs modestes.

## 7. Organisation du projet

```
ECO_SURVIVOR/
├── project.godot          configuration (scène de départ, touches, autoloads, rendu Compatibility)
├── export_presets.cfg     préréglage d'export Web (threads désactivés)
├── README.md
├── icon.png
├── scenes/                toutes les scènes (.tscn)
├── scripts/               tous les scripts GDScript (.gd)
├── ui/theme.tres          thème de l'interface (couleurs, polices, boutons)
├── assets/
│   ├── sprites/           personnage, déchets, voitures, arbres, effets
│   ├── ui/                logo, icônes du HUD
│   ├── backgrounds/       image de la ville
│   ├── sounds/            effets sonores (.wav) et musiques (.ogg)
│   ├── fonts/             polices Orbitron et Exo 2 (+ licences)
│   └── shaders/           effets graphiques (pollution, brume, transition)
├── tools/                 programmes Python qui ont créé les images et les sons
└── tests/                 tests automatiques (non inclus dans l'export)
```

### Les scènes

| Scène | Nœud racine | Rôle |
|---|---|---|
| `MainMenu.tscn` | Control | menu principal : JOUER, COMMENT JOUER, OPTIONS, QUITTER |
| `Main.tscn` | Node2D | la partie : ville, obstacles, voies de circulation, joueur, HUD, pause |
| `Player.tscn` | **CharacterBody2D** | le joueur (sprite animé, collision, caméra, traînée de sprint) |
| `Collectible.tscn` | **Area2D** | déchet ou bonus à ramasser |
| `Pollution.tscn` | Area2D | nuage de pollution (shader animé) |
| `ToxicWaste.tscn` | Area2D | baril toxique |
| `Car.tscn` | Area2D | voiture polluante qui suit une voie |
| `Tree.tscn` | StaticBody2D | arbre (obstacle, feuillage transparent quand on passe dessous) |
| `HUD.tscn` | CanvasLayer | score, objectif, temps, vies, santé, énergie, déchets |
| `PauseMenu.tscn` | CanvasLayer | menu pause |
| `OptionsPanel.tscn` | PanelContainer | volumes, difficulté, plein écran, tremblements |
| `Victory.tscn` / `GameOver.tscn` | Control | écrans de fin |
| `Transition.tscn` | CanvasLayer | animation entre deux scènes (autoload) |
| `FloatingText.tscn`, `StreetLamp.tscn`, `ChimneySmoke.tscn`, `Turbine.tscn` | — | petits éléments visuels |

Toutes les collisions utilisent des **CollisionShape2D** (cercles, rectangles) ou des
CollisionPolygon2D (étangs). Couches de collision : 1 = monde, 2 = joueur, 3 = objets, 4 = dangers.

### Les signaux (communication entre scènes)

```
Collectible ──collected──────▶ GameManager ──score_changed──▶ HUD
ToxicWaste  ──touched────────▶ GameManager ──time_changed───▶ HUD
Car         ──hit_player─────▶ GameManager ──lives_changed──▶ HUD
Player      ──died / hurt────▶ GameManager ──waste_changed──▶ HUD
Player      ──health_changed / energy_changed ────────────▶ HUD
Timer       ──timeout────────▶ GameManager (apparition des objets et des dangers)
Button      ──pressed────────▶ menus (menu.gd, pause_menu.gd, end_screen.gd…)
```

Les objets ne connaissent pas le GameManager : ils émettent un signal et c'est le GameManager qui
décide quoi faire (ajouter des points, retirer de la vie…). Cela rend le code plus clair.

## 8. Fonctions principales du code

**`game_manager.gd`** (script de `Main.tscn`, le « chef d'orchestre »)
- `_ready()` : lit la difficulté, connecte tous les signaux, lance le compte à rebours.
- `_physics_process()` : fait avancer le chronomètre, change de niveau toutes les 30 s, détecte la fin du temps.
- `find_free_position()` : choisit une position aléatoire **libre** (pas dans un bâtiment) grâce à une
  requête au moteur physique (`intersect_shape`).
- `_on_waste_timer()`, `_on_toxic_timer()`, `_on_pollution_timer()`, `_on_car_timer()`, `_on_bonus_timer()` :
  font apparaître les objets et les dangers selon le niveau.
- `_on_collectible_collected()` : ajoute les points et met à jour les compteurs.
- `add_score()` : modifie le score et vérifie la **victoire**.
- `_on_player_died()` : retire une vie, fait réapparaître le joueur ou déclenche la **défaite**.
- `_end_game()` : arrête la partie, enregistre le résultat, affiche l'écran de fin.
- Le tableau `LEVELS` contient tous les réglages de difficulté : il suffit de modifier ses valeurs
  pour rééquilibrer le jeu.

**`player.gd`** (CharacterBody2D)
- `_physics_process()` : lit les touches avec `Input.get_vector()`, accélère/freine progressivement
  (déplacement fluide), gère le sprint et l'énergie, appelle `move_and_slide()` (collisions), oriente
  et anime le personnage.
- `take_damage()` : retire de la santé, applique un recul, donne une invincibilité courte.
- `heal()`, `refill_energy()`, `respawn()`, `shake()` (tremblement de caméra).

**Autres scripts**
- `collectible.gd` : type de déchet, points, animation (flottement, halo), disparition.
- `pollution.gd` : états ALERTE → ACTIF → DISPARITION, dérive du nuage, dégâts continus.
- `car.gd` : déplacement le long d'une voie, klaxon quand le joueur est devant.
- `hud.gd` : met à jour l'affichage et anime les valeurs (score qui « saute », bandeaux, messages).
- `menu.gd`, `pause_menu.gd`, `options_panel.gd`, `end_screen.gd` : boutons et menus.
- `global.gd` (autoload) : réglages, difficulté, record, sauvegarde dans un fichier.
- `audio_manager.gd` (autoload) : musiques en boucle et effets sonores.
- `transition.gd` (autoload) : animation de changement de scène.
- `effects.gd` : explosions de particules et textes flottants.

## 9. Difficultés techniques rencontrées et solutions

| Difficulté | Solution |
|---|---|
| Faire apparaître les objets sans qu'ils tombent dans un bâtiment | requête physique `intersect_shape()` sur la couche « monde » avant de placer un objet |
| Dessin de la ville et collisions qui doivent correspondre exactement | un programme Python (`tools/generate_city.py`) dessine l'image **et** écrit les collisions de `Main.tscn` à partir du même plan |
| Les nuages de pollution apparaissaient sur le joueur : injuste | phase d'alerte (cercle rouge) et apparition à distance du joueur |
| Le joueur perdait plusieurs fois de la vie en un seul choc | invincibilité de 0,9 s après un choc (le joueur clignote) |
| Clavier AZERTY / QWERTY | touches configurées en **position physique** |
| Musique qui doit boucler sans coupure | musique calculée pour boucler parfaitement + `loop = true` sur le flux OGG |
| Le menu pause ne doit pas être gelé par la pause | `process_mode = Always` sur le menu pause et les autoloads |
| Export Web sans multithreading | rendu Compatibility, Thread Support désactivé, uniquement des `CPUParticles2D` |
| Le bouton QUITTER ne peut pas fermer un onglet de navigateur | sur le Web, il affiche un message à la place |

## 10. Tests réalisés

Le dossier `tests/` contient un test automatique qui joue réellement une partie :
```
godot --headless --path . res://tests/TestRunner.tscn
```
Il vérifie (63 vérifications) : chargement de toutes les scènes, démarrage de la partie, 3 vies,
points de chaque déchet (+10, +15, +20, +30), compteur de déchets, affichage du HUD, déchet toxique
(−50 points, −25 santé), voiture, nuage de pollution, bonus, déplacement au clavier, sprint et énergie,
collision avec un bâtiment, passage des niveaux de pollution, perte de vie et réapparition, pause,
victoire, défaite par le temps, défaite par les vies, et tous les boutons (JOUER, COMMENT JOUER,
OPTIONS, RETOUR, RECOMMENCER, RETOUR AU MENU). Résultat : **63 OK, 0 échec** avec Godot 4.3 et 4.7.
L'export Web a aussi été testé dans un navigateur Chromium.

Non testé automatiquement : le son réel (pas de carte son sur la machine de test) et le bouton
QUITTER sur ordinateur (il appelle simplement `get_tree().quit()`).

## 11. Améliorations possibles

- Centres de tri : obliger le joueur à déposer les déchets dans la bonne poubelle (tri sélectif).
- Plusieurs villes / niveaux avec une carte différente.
- Tableau des meilleurs scores en ligne.
- Mode deux joueurs sur le même clavier.
- Commandes tactiles pour jouer sur téléphone.
- Ennemis « pollueurs » qui jettent des déchets.

## 12. Sources des ressources

- **Images** (personnage, déchets, voitures, arbres, ville, icônes, logo) : **créations originales**
  dessinées par programme avec Python et la bibliothèque Pillow (`tools/generate_art.py` et
  `tools/generate_city.py`).
- **Sons et musiques** : **créations originales** synthétisées avec Python, numpy et scipy
  (`tools/generate_sounds.py`). Aucun échantillon externe.
- **Polices** : *Orbitron* (Matt McInerney) et *Exo 2* (Natanael Gama), Google Fonts,
  licence libre **SIL Open Font License 1.1** (fichiers de licence dans `assets/fonts/`).
- **Moteur** : Godot Engine 4, licence MIT – <https://godotengine.org>

Pour recréer les ressources : `python3 tools/generate_art.py`, `python3 tools/generate_city.py`,
`python3 tools/generate_sounds.py` (nécessite Pillow, numpy, scipy et ffmpeg pour l'OGG).
