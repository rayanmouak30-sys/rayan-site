# ECO SURVIVOR

Jeu d'arcade 2D fait avec **Godot 4** en **GDScript**. Projet Terminale STI2D spécialité SIN.

**Jouer en ligne :** https://mou.alwaysdata.net/jeu-dd/

## Auteurs

- ...................................
- ...................................
- Classe : ...........   Année : ...........

## Thème de développement durable

La ville est polluée. Le joueur doit la nettoyer en ramassant les déchets recyclables
(plastique, papier, verre, électronique) et en évitant la pollution (déchets toxiques et nuages
de pollution). Les déchets électroniques rapportent le plus, car ce sont les plus polluants s'ils
ne sont pas recyclés. Plus le temps passe, plus la pollution augmente : il faut agir vite.

## Principe du jeu

- Il faut atteindre **600 points** avant la fin du temps (**90 secondes**).
- Le joueur a **3 vies** et une **barre de santé**. Quand la santé tombe à 0, il perd une vie.

| Objet | Effet |
|---|---|
| Plastique | +10 points |
| Papier | +15 points |
| Verre | +20 points |
| Électronique | +30 points |
| Déchet toxique | −30 points et −25 santé |
| Nuage de pollution | fait perdre de la santé tant qu'on est dedans |

- Les maisons, les arbres et les bords de l'écran sont des obstacles.
- Les objets disparaissent au bout de 8 secondes (ils clignotent avant).
- **Difficulté** : toutes les 20 secondes, le niveau monte (jusqu'au niveau 4) : les objets
  apparaissent plus vite, il y a plus de nuages de pollution, ils font plus de dégâts et il y a
  plus de déchets toxiques.

## Moteur choisi et justification

Nous avons choisi **Godot 4** :
- il est **gratuit** et libre (licence MIT), aucun logiciel payant n'est nécessaire ;
- il est fait pour la **2D** (nœuds CharacterBody2D, Area2D, collisions, Timers…) ;
- le langage **GDScript** ressemble à Python, que nous connaissons ;
- il permet d'**exporter le jeu pour le Web** (rendu Compatibility, sans Thread Support).

Organisation du projet :

```
ECO_SURVIVOR/
├── project.godot        configuration (scène de départ : Main.tscn)
├── export_presets.cfg   export Web (Thread Support désactivé)
├── README.md
├── scenes/
│   ├── Main.tscn        la partie (fond, obstacles, joueur, HUD, timers, sons)
│   ├── Player.tscn      le joueur (CharacterBody2D)
│   ├── Collectible.tscn un déchet (Area2D)
│   ├── Pollution.tscn   un nuage de pollution (Area2D)
│   ├── Victory.tscn     écran de victoire
│   └── GameOver.tscn    écran de défaite
├── scripts/
│   ├── global.gd        (autoload) garde le score entre les scènes
│   ├── player.gd        déplacement, animation, santé
│   ├── game_manager.gd  score, temps, vies, apparitions, victoire/défaite
│   ├── collectible.gd   type et points d'un déchet
│   ├── pollution.gd     nuage qui fait perdre de la santé
│   └── end_screen.gd    écrans de fin (Victory et GameOver)
└── assets/              images (sprites, fond) et sons
```

Les objets communiquent par des **signaux** :
- `Collectible` → `ramasse` → `game_manager` (ajoute les points) ;
- `Player` → `sante_change` et `mort` → `game_manager` (barre de santé, vies) ;
- `Timer` → `timeout` → `game_manager` (apparition des déchets et des nuages) ;
- bouton RECOMMENCER → `pressed` → `end_screen.gd`.

## Commandes

- **Z Q S D** ou **flèches** : se déplacer
- Souris : bouton **RECOMMENCER** à la fin de la partie

Le jeu démarre directement quand on l'ouvre.

## Victoire / Défaite

- **Victoire** : on atteint 600 points avant la fin du temps.
- **Défaite (Game Over)** : le temps est écoulé, ou on a perdu les 3 vies.
- Les deux écrans affichent le score, le nombre de déchets ramassés, le meilleur score, et un
  bouton **RECOMMENCER**.

## Répartition du travail

| Élève | Travail réalisé |
|---|---|
| ........ | ........ (ex : joueur, déplacements, collisions) |
| ........ | ........ (ex : déchets, score, HUD, écrans de fin) |
| ........ | ........ (ex : pollution, difficulté, tests, export Web, README) |

## Bug ou difficulté principale

Quand nous avons testé la version Web, la **barre de santé paraissait vide** alors que le joueur
avait toute sa santé : on ne voyait pas quand on perdait de la vie.

## Solution trouvée

La barre était seulement teintée en rouge avec `modulate`, ce qui assombrissait aussi la partie
pleine. Nous avons donné à la `ProgressBar` deux styles (`StyleBoxFlat`) : un fond gris foncé et
un remplissage rouge vif. Maintenant la barre est bien rouge quand la santé est pleine et se vide
quand on prend des dégâts.

## Amélioration après le test croisé

*(À compléter avec ce que le camarade testeur a dit et ce qui a été changé.)*

## Sources des médias et ressources

- **Images** (joueur, déchets, ville, nuage) : créées pour ce projet (dessinées avec un programme
  Python). Aucune image prise sur Internet.
- **Sons** : créés pour ce projet (générés avec un programme Python). Aucun son pris sur Internet.
- **Police** : police par défaut de Godot.
- **Moteur** : Godot Engine 4, gratuit, licence MIT — https://godotengine.org
