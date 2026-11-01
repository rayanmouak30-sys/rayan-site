# ECO SURVIVOR

Jeu d'arcade 2D fait avec **Godot 4** en **GDScript**.
Projet STI2D spécialité SIN.

## Auteurs

- ...................................
- ...................................
- Classe : ...........   Année : ...........

## Thème : le développement durable

Le joueur doit nettoyer une ville polluée en ramassant les déchets recyclables.
Il doit éviter les déchets toxiques et les nuages de pollution, et faire attention
à son énergie (le sprint la consomme : il faut l'économiser).

## Règles

- Il faut atteindre **600 points** avant la fin du temps (**90 secondes**).
- Le joueur a **3 vies** et une **barre de santé**. Quand la santé tombe à 0, il perd une vie.

| Objet | Points |
|---|---|
| Plastique | +10 |
| Papier | +15 |
| Verre | +20 |
| Électronique | +30 |
| Déchet toxique | −30 points et −25 santé |
| Nuage de pollution | fait perdre de la santé tant qu'on est dedans |

Les maisons et les arbres sont des obstacles.
Les objets disparaissent au bout de 8 secondes (ils clignotent avant).

**Difficulté** : toutes les 20 secondes, le niveau monte (jusqu'au niveau 4). Les objets
apparaissent plus vite, il y a plus de nuages de pollution, ils font plus de dégâts, et il y a
plus de déchets toxiques.

## Commandes

- **Z Q S D** ou **flèches** : se déplacer
- **Maj** ou **Espace** : sprint (utilise l'énergie)
- Souris : boutons des menus

## Victoire et défaite

- **Victoire** : on atteint 600 points avant la fin du temps.
- **Défaite (Game Over)** : le temps est écoulé, ou on a perdu les 3 vies.
- Les deux écrans ont un bouton **RECOMMENCER** et un bouton **RETOUR AU MENU**.

## Pourquoi Godot ?

Godot est gratuit, léger et fait pour la 2D. Le GDScript ressemble à Python.
Il permet aussi d'exporter le jeu pour le Web.

## Organisation du projet

```
ECO_SURVIVOR/
├── project.godot
├── export_presets.cfg   (export Web, threads désactivés)
├── README.md
├── scenes/
│   ├── MainMenu.tscn    menu principal + panneau options
│   ├── Main.tscn        la partie (fond, obstacles, joueur, HUD, timers, sons)
│   ├── Player.tscn      le joueur (CharacterBody2D)
│   ├── Collectible.tscn un déchet (Area2D)
│   ├── Pollution.tscn   un nuage de pollution (Area2D)
│   ├── Victory.tscn     écran de victoire
│   └── GameOver.tscn    écran de défaite
├── scripts/
│   ├── global.gd        (autoload) garde le score entre les scènes
│   ├── player.gd
│   ├── game_manager.gd
│   ├── collectible.gd
│   ├── pollution.gd
│   ├── menu.gd
│   └── end_screen.gd    utilisé par Victory et GameOver
└── assets/
    ├── sprites/         images du joueur, des déchets, du nuage
    ├── backgrounds/     image de la ville
    └── sounds/          sons et musique
```

Collisions : chaque maison, arbre et mur est un **StaticBody2D** avec un **CollisionShape2D**.
Le joueur est un **CharacterBody2D** et les objets sont des **Area2D**.

## Fonctions principales

**player.gd**
- `_physics_process()` : lit les touches, gère le sprint et l'énergie, déplace le joueur
  avec `move_and_slide()` et change l'animation (repos / marche).
- `prendre_degats()` : enlève de la santé ; à 0, envoie le signal `mort`.

**game_manager.gd**
- `_process()` : fait baisser le temps, augmente le niveau, vérifie si le temps est fini.
- `_on_timer_objets_timeout()` : fait apparaître un déchet au hasard (Timer).
- `_on_timer_pollution_timeout()` : fait apparaître un nuage de pollution (Timer).
- `position_libre()` : choisit une position qui n'est pas sur une maison ou un arbre.
- `_on_objet_ramasse()` : ajoute les points et vérifie la victoire.
- `_on_joueur_mort()` : enlève une vie.
- `fin_de_partie()` : ouvre l'écran de victoire ou de Game Over.

**collectible.gd** : choisit l'image et les points selon le type, fait flotter l'objet,
le supprime après 8 secondes.

**pollution.gd** : fait apparaître le nuage, le déplace lentement et enlève de la santé au joueur.

## Les signaux utilisés

- `Collectible` → signal `ramasse` → `game_manager` (ajoute les points)
- `Player` → signaux `sante_change`, `energie_change`, `mort` → `game_manager` (met à jour le HUD et les vies)
- `Timer` → signal `timeout` → `game_manager` (apparition des objets)
- Boutons → signal `pressed` → `menu.gd` et `end_screen.gd`

## Difficultés et solutions

- **Les objets apparaissaient dans les maisons** → la fonction `position_libre()` vérifie la
  distance avec les obstacles.
- **Les nuages apparaissaient sur le joueur** → on choisit une autre position s'il est trop près,
  et le nuage ne fait pas de dégâts pendant sa première seconde.
- **Le joueur perdait plusieurs vies d'un coup** → 2 secondes d'invincibilité après une vie perdue
  (le joueur clignote).
- **Le son de dégât se répétait en boucle dans le nuage** → on ne le relance que s'il est fini.

## Améliorations possibles

- Ajouter des poubelles de tri (bleue, jaune, verte).
- Ajouter des voitures qui bougent.
- Plusieurs niveaux avec des cartes différentes.
- Un menu pause.

## Lancer le jeu

1. Installer Godot 4 (version 4.3 ou plus récente) : https://godotengine.org
2. Dans Godot : **Importer** → choisir `project.godot`.
3. Appuyer sur **F5**.

**Export Web** : Projet → Exporter → préréglage **Web** (déjà réglé, Thread Support désactivé).
La première fois, Godot demande d'installer les modèles d'exportation.

## Sources des ressources

- Images et sons : créés pour ce projet (dessinés et générés avec des programmes Python).
  Aucune image ni aucun son pris sur Internet.
- Police : police par défaut de Godot.
- Moteur : Godot Engine (gratuit, licence MIT).
