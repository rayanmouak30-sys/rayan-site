# Neon Strike — guide

FPS tactique en 3D qui tourne directement dans le navigateur (aucune installation).
Adresse : https://mou.alwaysdata.net/jeu/

## Modes de jeu

| Mode | Principe |
|---|---|
| **Spike** | Attaque / défense en 5 contre 5. Les attaquants posent le spike sur le site A ou B (maintenir F, 4 s), les défenseurs le désamorcent (7 s, la progression est gardée à mi-chemin). 1re équipe à 5 manches, changement de camp après la manche 4. |
| **Élimination** | Même chose sans spike : il faut éliminer toute l'équipe adverse. |
| **Deathmatch** | Chacun pour soi, réapparition au bout de 3 s. Premier à 30 éliminations (ou meilleur score après 8 min). |
| **Stand de tir** | Entraînement libre + 4 défis chronométrés (Réflexes, Cibles mobiles, Que des têtes, Longue distance). Les records sont gardés. |
| **En ligne** | Deathmatch entre amis avec un code de salon (voir plus bas). |

Options d'une partie : carte (Nexus, Bazar, Hangar), difficulté des bots, 5 contre 5 ou seul contre 5, heure (jour, soir, nuit avec lampe torche) et météo (clair, pluie, brouillard).

## Commandes (clavier AZERTY)

| Touche | Action |
|---|---|
| Z Q S D | Se déplacer |
| Souris / clic gauche / clic droit | Viser / tirer / viser avec la mire (coup lourd au couteau) |
| 1 · 2 · 3 ou molette | Arme principale · pistolet · couteau |
| R | Recharger |
| Espace / Maj / Ctrl | Sauter / courir / s'accroupir |
| C | Fumée |
| A | Flash (détourne le regard quand elle explose !) |
| E | Compétence signature de l'agent |
| X | Ultime (se charge avec les éliminations, les morts et le spike) |
| F (maintenir) | Poser / désamorcer le spike |
| G | Lâcher le spike |
| B | Boutique |
| V puis 1 à 5 | Ordres aux coéquipiers (suivez-moi, allez sur A, allez sur B, tenez, jouez librement) |
| Tab | Tableau des scores |
| Y | Inspecter l'arme |
| Échap | Pause |

**Manette** (Xbox / PlayStation) : sticks pour bouger et viser, RT tirer, LT viser, A sauter, B s'accroupir, X recharger (maintenir pour le spike), Y changer d'arme, LB/RB flash/fumée, croix haut/bas signature/ultime, croix gauche ordres, Select boutique, Start pause. Les menus se parcourent aussi à la manette.

**Téléphone / tablette** : joystick à gauche, glisser à droite pour viser, boutons à l'écran. Le bouton TIR sert aussi à viser en glissant.

## Armes et boutique

| Arme | Prix | Points forts |
|---|---|---|
| Sentinelle (pistolet) | gratuit | précis, semi-automatique |
| Briseur (pompe) | 1800 | énorme de près, réarmement à chaque tir |
| NS-7 Vecteur (fusil) | 2900 | automatique, recul à maîtriser |
| Aiguille (précision) | 4700 | lunette ×3,6, tue d'un tir à la tête |
| Lame (couteau) | — | on court plus vite ; un coup dans le dos fait 150 |

Boucliers : léger (+25, 400) et lourd (+50, 1000). Fumée 100, flash 200 (2 de chaque au maximum).
Crédits : 800 au départ, +200 par élimination, +3000 pour une manche gagnée, 1900 à 2900 pour une manche perdue, +300 si le spike a été posé. Un achat de la manche peut être revendu en recliquant dessus.

## Agents

| Agent | Signature (E) | Ultime (X) |
|---|---|---|
| Volt — Duelliste | Ruée (dash) | Surcharge : cadence et vitesse augmentées 10 s |
| Rempart — Sentinelle | Mur d'énergie (destructible) | Bastion : +50 bouclier et +50 PV pour l'équipe |
| Faucon — Initiateur | Drone éclaireur qui révèle les ennemis | Sonar : tous les ennemis révélés 6 s |
| Aube — Soutien | Régénération (+50 PV) | Renouveau : toute l'équipe soignée |

## Progression

XP et niveaux, 16 succès, 7 skins d'armes débloqués par niveau (Arsenal), viseur personnalisable (Paramètres), statistiques et records (Carrière).
Tout est gardé dans le navigateur. Pour apparaître au **classement en ligne**, il faut être connecté avec son compte du site (page Compte) : chaque partie Spike, Élimination ou Deathmatch y est alors envoyée.

## Graphismes

La qualité est choisie automatiquement selon la carte graphique (« Faible » sur les PC portables et les téléphones). La **résolution dynamique** baisse un peu la netteté quand le jeu ralentit, pour rester fluide. Le réglage **Luminosité** éclaircit l'image si besoin.

## Multijoueur en ligne

Le jeu se connecte à un petit serveur Node.js (`jeu/serveur/serveur.js`, aucune dépendance à installer).

### Avec des amis sur le même Wi-Fi
1. Installer Node.js (https://nodejs.org) sur un PC.
2. Dans le dossier du site : `node jeu/serveur/serveur.js`
3. Tout le monde ouvre `http://ADRESSE-IP-DU-PC:8080/` dans le navigateur, puis En ligne. Adresse du serveur : `ws://ADRESSE-IP-DU-PC:8080/ws`.

### Sur internet avec AlwaysData
1. Interface d'administration AlwaysData → Web → Sites → Ajouter un site.
2. Adresse : `mou.alwaysdata.net/ws` · Type : **Node.js** · Commande : `node jeu/serveur/serveur.js` · Répertoire de travail : `www`.
3. Dans le jeu (En ligne), l'adresse du serveur proposée est déjà `wss://mou.alwaysdata.net/ws`.

Le serveur lit le port et l'adresse fournis par l'hébergeur (variables `PORT` et `IP`). Cette configuration AlwaysData n'a pas pu être testée depuis ici : si la connexion échoue, vérifier dans AlwaysData que le site Node.js est démarré et que les WebSockets sont acceptés.

En ligne, seules les compétences Ruée et Régénération sont disponibles (les autres ne sont pas encore synchronisées entre joueurs).
