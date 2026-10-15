# Neon Strike — guide

FPS tactique en 3D qui tourne directement dans le navigateur.
Adresse : https://mou.alwaysdata.net/jeu/

## Lancer le jeu

- **En ligne (le plus simple)** : ouvrir https://mou.alwaysdata.net/jeu/ dans Chrome, Edge ou Firefox.
- **Sur un PC Windows, même sans Internet** : installer [Node.js](https://nodejs.org) (version LTS), puis double-cliquer sur `LANCER-NEON-STRIKE.bat` (dans le dossier du jeu ou du ZIP). Le navigateur s'ouvre sur `http://localhost:8080/`. Détails dans `LISEZMOI-WINDOWS.txt`.
- Ouvrir `index.html` directement (double-clic) ne marche pas : les navigateurs bloquent les modules JavaScript en `file://`.

La bibliothèque 3D (Three.js 0.186.1, licence MIT) est copiée dans `vendor/three/` : aucun CDN n'est nécessaire.

## Modes de jeu

| Mode | Principe |
|---|---|
| **Spike** | Attaque / défense en 5 contre 5. Les attaquants posent le spike sur le site A ou B (maintenir F, 4 s), les défenseurs le désamorcent (7 s, la progression est gardée à mi-chemin). 1re équipe à 5 manches, changement de camp après la manche 4. |
| **Élimination** | Même chose sans spike : il faut éliminer toute l'équipe adverse. |
| **Deathmatch** | Chacun pour soi, réapparition au bout de 3 s. Premier à 30 éliminations (ou meilleur score après 8 min). Caisses de munitions sur la carte. |
| **Stand de tir** | Entraînement libre + 4 défis chronométrés. Les capacités touchent aussi les cibles : pratique pour les essayer. |
| **En ligne** | Deathmatch entre amis avec un code de salon (voir plus bas). |

## Commandes (clavier AZERTY)

Toutes les touches se changent dans **Commandes** (clavier, souris et manette). Touches de départ :

| Touche | Action |
|---|---|
| Z Q S D | Se déplacer |
| Souris / clic gauche / clic droit | Viser / tirer / viser avec la mire |
| 1 · 2 · 3 ou molette | Arme principale · pistolet · couteau |
| R | Recharger |
| Espace / Maj / Ctrl | Sauter / courir / s'accroupir |
| **C** | Capacité 1 du personnage |
| **A** | Capacité 2 (touche Q d'un clavier QWERTY : sur AZERTY, Q sert à aller à gauche) |
| **E** | Capacité signature |
| **X** | Ultime |
| F (maintenir) | Interagir : poser / désamorcer le spike (E est déjà pris par la signature) |
| G | Lâcher le spike |
| B | Boutique |
| V puis 1 à 5 | Ordres aux coéquipiers |
| Tab | Tableau des scores |
| Y | Inspecter l'arme |
| Échap | Pause |

**Manette** : RT tirer, LT viser, A sauter, B s'accroupir, X recharger, Y changer d'arme, LB/RB capacités 2 et 1, croix haut/bas signature/ultime. Tout se règle dans Commandes.
**Téléphone / tablette** : joystick à gauche, glisser à droite pour viser ; les boutons de capacités affichent les icônes du personnage.

## Personnages

20 personnages originaux en 5 catégories. Menu **Personnages** : vitrine 3D (glisser pour tourner, molette pour zoomer), histoire, personnalité, difficulté, arme de prédilection et détail chiffré des 4 capacités ; bouton **Sélectionner** (ou double-clic sur un portrait).
Les bots sont aussi des personnages : jamais deux fois le même dans une équipe, et ils utilisent leurs capacités selon la situation. Les coéquipiers ont un repère cyan au-dessus de la tête, et des bandes lumineuses bleues (alliés) ou rouges (adversaires) en Spike et Élimination.

### Assaut — Entrent les premiers et gagnent les duels.

| Personnage | Rôle | Difficulté | Arme | C | A (Q) | E (signature) | X (ultime) |
|---|---|---|---|---|---|---|---|
| **KAEL** | Fer de lance | ★☆☆ | Pulsar P-07 | Charge à fragmentation | Éclat aveuglant | Propulsion | Assaut total |
| **VEXA** | Acrobate | ★★★ | NS-7 Vecteur | Saut vectoriel | Voile éclair | Pas de l'ombre | Frénésie |
| **BRAX** | Briseur de lignes | ★☆☆ | Briseur | Grenade sonique | Plaques réactives | Charge du bélier | Onde sismique |
| **NYRA** | Pyromancienne | ★★☆ | Pulsar P-07 | Cocktail plasma | Fusée éclairante | Cœur ardent | Supernova |

### Défense — Tiennent une zone et protègent l'équipe.

| Personnage | Rôle | Difficulté | Arme | C | A (Q) | E (signature) | X (ultime) |
|---|---|---|---|---|---|---|---|
| **TITAN** | Forteresse | ★☆☆ | Pulsar P-07 | Plaque d'acier | Bouclier déployable | Barrière titan | Rempart vivant |
| **AEGIS** | Gardienne | ★★☆ | NS-7 Vecteur | Champ réparateur | Pulsion répulsive | Mur des Archives | Égide |
| **ROKAN** | Ingénieur | ★★☆ | NS-7 Vecteur | Mine sismique | Grenade frag | Tourelle automatique | Barrage d'artillerie |
| **FROST** | Tireuse cryo | ★★★ | Aiguille | Fil glacé | Grenade givrante | Mur de glace | Blizzard |

### Reconnaissance — Trouvent les ennemis avant le combat.

| Personnage | Rôle | Difficulté | Arme | C | A (Q) | E (signature) | X (ultime) |
|---|---|---|---|---|---|---|---|
| **ECHO** | Sonar vivant | ★★☆ | NS-7 Vecteur | Flèche sonar | Onde de choc | Écoute | Résonance totale |
| **GHOST** | Infiltrateur | ★★★ | NS-7 Vecteur | Camouflage | Éclipse | Drone furtif | Ombre totale |
| **ORION** | Pisteur | ★★☆ | Aiguille | Lyra | Balise traqueuse | Marque du chasseur | Chasse ouverte |
| **KIRA** | Éclaireuse | ★★☆ | NS-7 Vecteur | Flash ricochet | Lame traqueuse | Pas de lumière | Tempête d'éclats |

### Contrôle — Coupent les lignes de vue et ralentissent l'adversaire.

| Personnage | Rôle | Difficulté | Arme | C | A (Q) | E (signature) | X (ultime) |
|---|---|---|---|---|---|---|---|
| **NEXUS** | Gravitationniste | ★★★ | Pulsar P-07 | Puits gravitationnel | Voile du vide | Distorsion | Trou noir |
| **MIST** | Alchimiste | ★☆☆ | NS-7 Vecteur | Nuage | Brume toxique | Rideau de brume | Brouillard total |
| **VOLT** | Électrocinéticien | ★★☆ | Pulsar P-07 | Grenade IEM | Arc électrique | Ruée électrique | Surcharge |
| **SABLE** | Nomade des dunes | ★★☆ | Briseur | Tempête de sable | Sables mouvants | Mur de sable | Simoun |

### Soutien — Soignent, protègent et ravitaillent.

| Personnage | Rôle | Difficulté | Arme | C | A (Q) | E (signature) | X (ultime) |
|---|---|---|---|---|---|---|---|
| **SERAPH** | Médecin de guerre | ★☆☆ | NS-7 Vecteur | Orbe de soin | Lueur sacrée | Régénération | Résurrection |
| **PULSE** | Rythmicien | ★★☆ | Pulsar P-07 | Stimulant | Onde basse | Battement | Crescendo |
| **BLOOM** | Botaniste | ★★☆ | NS-7 Vecteur | Spore de soin | Lianes | Peau d'écorce | Jardin sacré |
| **ATLAS** | Logisticien | ★☆☆ | Briseur | Caisse de ravitaillement | Fumigène | Bouclier portatif | Renouveau |

## Capacités

- **C et A** : en Spike et Élimination, elles s'achètent à la boutique (charges gardées d'une manche à l'autre, remises à zéro au changement de camp). En Deathmatch, au stand et en ligne, elles se rechargent toutes seules.
- **E (signature)** : gratuite, se recharge avec le temps (et redevient prête à chaque manche).
- **X (ultime)** : se charge avec les éliminations, les morts, la pose et le désamorçage du spike (6 à 8 points selon le personnage).
- Une **IEM** coupe les capacités pendant quelques secondes ; une **commotion** fait trembler la vue et dérègle la visée ; les **zones de givre, de gravité ou de sable** ralentissent ; le **camouflage** empêche les bots de te repérer sauf à bout portant (tirer te révèle un instant).
- Les flashs, explosions et zones n'affectent que les adversaires.
- **En ligne**, seules les capacités qui ne touchent que soi (ruée, saut, téléportation, soins et bonus personnels) sont disponibles : les autres ne sont pas encore synchronisées entre joueurs.

Les 80 capacités sont décrites par des données (`capacites.js`) et reposent sur une vingtaine de familles d'effets programmées une fois (`competences.js`) : grenade, zone au sol, mur, drone, piège, tourelle, sonar, bonus d'équipe, téléportation, etc.

## Armes et boutique

| Arme | Prix | Points forts |
|---|---|---|
| Sentinelle (pistolet) | gratuit | précis, semi-automatique |
| Briseur (pompe) | 1800 | énorme de près |
| NS-7 Vecteur (fusil) | 2900 | automatique, recul à maîtriser |
| **Pulsar P-07** (fusil à impulsion) | 3100 | automatique, très stable, écran de munitions sur l'arme, tirs cyan |
| Aiguille (précision) | 4700 | lunette ×3,6, tue d'un tir à la tête |
| Lame (couteau) | — | on court plus vite ; un coup dans le dos fait 150 |

Boucliers : léger (+25, 400) et lourd (+50, 1000). L'**Arsenal** montre chaque arme en 3D avec la finition choisie.

## Progression

XP et niveaux, succès, 7 finitions d'armes, viseur personnalisable, statistiques. Avec un compte du site, la progression, les touches et les réglages sont sauvegardés et reviennent sur un autre ordinateur ; le classement en ligne est mis à jour après chaque partie.

## Graphismes

La qualité est choisie automatiquement selon la carte graphique (« Faible » sur les PC portables et les téléphones), avec résolution dynamique. Sur « Faible », chaque personnage ne coûte que deux appels de rendu.

## Multijoueur

### Sur le site (rien à installer)
Sur https://mou.alwaysdata.net/jeu/ → **En ligne** : un joueur clique *Créer un salon* et donne le code de 4 lettres, les autres le tapent puis *Rejoindre*. Jusqu'à 8 joueurs et 10 bots.

L'hôte choisit dans le salon :
- **Mode** : *Coop contre les bots* (tous les joueurs ensemble contre une équipe de bots, première équipe à 50 éliminations), *Équipes* (bleus contre rouges, chaque joueur peut changer d'équipe, les bots complètent les deux équipes, 50 éliminations) ou *Chacun pour soi* (premier à 20 éliminations) ;
- **Bots** : aucun, 2, 4, 6, 8 ou 10, et leur **difficulté** (facile à expert) ;
- **Carte**.

Les bots tournent sur le PC de l'hôte (intelligence, tirs, réapparitions) ; les autres les voient et peuvent les éliminer normalement. Si l'hôte quitte, ses bots disparaissent et un autre joueur devient hôte. Pas de tir ami en équipes. Réapparition après 3 secondes.
Le jeu essaie d'abord le serveur temps réel (WebSocket, voir plus bas) ; s'il n'est pas lancé, il passe automatiquement par le relais PHP du site (`enligne.php`, ~16 échanges par seconde, un peu plus de latence). Les salons sont gardés dans `donnees/` (inaccessible depuis le web) et effacés quand tout le monde est parti.

### Avec des amis sur le même Wi-Fi
1. Sur un PC Windows : lancer `LANCER-NEON-STRIKE.bat` (Node.js installé). Ailleurs : `node serveur/serveur.js` dans le dossier du jeu.
2. Les autres ouvrent `http://ADRESSE-IP-DU-PC:8080/` (l'adresse IPv4 est affichée dans la fenêtre noire), puis **En ligne**.
3. Un joueur crée un salon, les autres tapent le code. Adresse du serveur : `ws://ADRESSE-IP-DU-PC:8080/ws`.
4. Si le pare-feu Windows demande l'autorisation pour Node.js, accepter « Réseaux privés ».

### Serveur temps réel sur AlwaysData (facultatif, moins de latence)
1. Interface d'administration AlwaysData → Web → Sites → Ajouter un site.
2. Adresse : `mou.alwaysdata.net/ws` · Type : **Node.js** · Commande : `node jeu/serveur/serveur.js` · Répertoire de travail : `www`.
3. Dans le jeu (En ligne), l'adresse proposée est déjà `wss://mou.alwaysdata.net/ws`.

Cette configuration AlwaysData n'a pas pu être testée depuis l'environnement de développement : si la connexion échoue, vérifier dans AlwaysData que le site Node.js est démarré.

## Ce qui est procédural (pour être honnête)

Tout est créé par le code, sans fichiers 3D ni sons extraits d'autres jeux :
- **Personnages** : assemblages de volumes simples (sphères, boîtes arrondies, profils extrudés) sur un squelette animé par cinématique inverse. Chacun a sa morphologie, son visage, sa coiffure, sa tenue, son équipement dorsal et ses couleurs, mais ce ne sont pas des modèles sculptés de jeu commercial. Les portraits sont rendus à partir de ces modèles.
- **Animations** : marche, course, visée, rechargement, chute, et 5 attitudes de repos réparties entre les 20 personnages (garde, prêt, arme sur l'épaule, inspection, décontracté) ; animation d'apparition dans la vitrine et colonne de lumière à la réapparition.
- **Sons** : synthétisés en direct (Web Audio).
- **Bots** : vraie vision (murs, fumées), stratégie d'équipe et usage des capacités par règles simples ; ils ne sautent pas.
