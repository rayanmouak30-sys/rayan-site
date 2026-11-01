<?php
$titrePage = "Jeu DD — Eco Survivor";
include __DIR__ . "/partiel_entete.php";
?>
<section class="premier-plan">
  <canvas class="lightning-canvas" aria-hidden="true"></canvas>
  <h2>Eco Survivor</h2>
  <p>Jeu d'arcade 2D sur le développement durable · Godot 4 · DM Terminale STI2D SIN</p>
</section>

<div class="panneau panneau-large">
  <h3>🎮 Le projet</h3>
  <p class="panneau-info">Rayan Mouak · Terminale STI2D SIN · 2026-2027</p>
  <div class="dd-boutons">
    <a class="panneau-bouton" href="jeu-dd/" target="_blank" rel="noopener">▶ Jouer au jeu</a>
    <a class="panneau-bouton" href="jeu-dd/telechargement/ECO_SURVIVOR.zip" download>⬇ Projet Godot complet (ZIP)</a>
    <a class="panneau-bouton" href="jeu-dd/telechargement/README.md" download>⬇ README (fichier .md)</a>
  </div>
  <p class="panneau-lien">Le ZIP s'ouvre dans Godot 4 (Importer → project.godot → F5). Le README complet est aussi lisible ci-dessous.</p>
</div>

<div class="panneau panneau-large readme">
  <h3>📄 README</h3>
<p>Jeu d'arcade 2D en vue du dessus réalisé avec <strong>Godot 4</strong> et <strong>GDScript</strong>.
Projet de Terminale STI2D, spécialité SIN.</p>
<p><strong>Jouer en ligne :</strong> https://mou.alwaysdata.net/jeu-dd/</p>
<h2>Auteurs</h2>
<ul>
<li>Rayan MOUAK</li>
<li>Classe : Terminale STI2D SIN   Année scolaire : 2026-2027</li>
</ul>
<p>Projet individuel.</p>
<h2>Thème de développement durable</h2>
<p>La ville est envahie par les déchets et la pollution. Le joueur incarne un agent écologique équipé
d'une pince à déchets. Il doit <strong>ramasser les déchets recyclables</strong>, <strong>éviter les dangers
environnementaux</strong> et <strong>économiser son énergie</strong>.</p>
<p>Le jeu montre plusieurs idées du développement durable :
- le <strong>tri des déchets</strong> : chaque matière a une valeur différente (les déchets électroniques, les
  plus polluants s'ils ne sont pas recyclés, rapportent le plus) ;
- l'<strong>économie des ressources</strong> : l'énergie du sprint est limitée, il faut l'utiliser au bon moment ;
- les <strong>conséquences de la pollution</strong> : plus le temps passe, plus la ville se pollue (brume,
  nuages toxiques, circulation plus dense) ;
- la ville du futur : toits solaires, toits végétalisés, éoliennes et jardins partagés, à côté
  d'usines qui fument.</p>
<h2>Principe du jeu</h2>
<ul>
<li><strong>Objectif</strong> : atteindre le score demandé (<strong>1000 points</strong> en mode Normal) <strong>avant la fin du
  chronomètre</strong> (<strong>2 min 30</strong> en mode Normal).</li>
<li>Le joueur a <strong>3 vies</strong>. Chaque vie a une <strong>barre de santé</strong> de 100 points. Quand la santé tombe à
  0, il perd une vie et réapparaît au centre de la ville.</li>
</ul>
<table>
<thead>
<tr>
<th>Objet</th>
<th>Effet</th>
</tr>
</thead>
<tbody>
<tr>
<td>Plastique (bouteille bleue)</td>
<td>+10 points</td>
</tr>
<tr>
<td>Papier (journal)</td>
<td>+15 points</td>
</tr>
<tr>
<td>Verre (bouteille verte)</td>
<td>+20 points</td>
</tr>
<tr>
<td>Déchet électronique (téléphone)</td>
<td>+30 points (disparaît plus vite)</td>
</tr>
<tr>
<td>Cœur</td>
<td>+35 santé</td>
</tr>
<tr>
<td>Batterie</td>
<td>énergie rechargée à 100 %</td>
</tr>
<tr>
<td>Déchet toxique (baril jaune)</td>
<td><strong>−50 points et −25 santé</strong></td>
</tr>
<tr>
<td>Nuage de pollution</td>
<td>perte de santé tant qu'on reste dedans</td>
</tr>
<tr>
<td>Voiture</td>
<td>−20 santé et recul</td>
</tr>
<tr>
<td>Bâtiments, arbres, fontaine, étangs, conteneurs</td>
<td>obstacles</td>
</tr>
</tbody>
</table>
<p>Les objets apparaissent à des endroits aléatoires et disparaissent au bout de quelques secondes
(ils clignotent avant). Un nuage de pollution est annoncé par un <strong>cercle rouge clignotant</strong> avant
de devenir dangereux.</p>
<p><strong>Difficulté progressive</strong> : la partie est découpée en <strong>5 niveaux de pollution</strong> (un nouveau niveau
toutes les 30 s). À chaque niveau, une alarme retentit : plus de déchets, plus de déchets toxiques
et de nuages, des nuages plus grands, plus de voitures et plus rapides, et une brume de pollution
de plus en plus forte.</p>
<p>Le menu OPTIONS propose 3 difficultés : Facile (800 pts en 3 min), Normal (1000 pts en 2 min 30),
Difficile (1300 pts en 2 min 30).</p>
<h2>Moteur choisi et justification</h2>
<p>J'ai choisi <strong>Godot 4</strong> :
- il est <strong>gratuit</strong> et libre (licence MIT), aucun outil payant n'est nécessaire ;
- il est fait pour la <strong>2D</strong> (CharacterBody2D, Area2D, collisions, particules, caméra…) ;
- le langage <strong>GDScript</strong> ressemble à Python ;
- le système de <strong>scènes</strong> et de <strong>signaux</strong> permet un projet bien organisé ;
- il permet d'<strong>exporter le jeu pour le Web</strong> (rendu Compatibility, sans Thread Support).</p>
<h3>Organisation du projet</h3>
<pre><code>ECO_SURVIVOR/
├── project.godot          configuration (scène de départ, touches, autoloads, rendu Compatibility)
├── export_presets.cfg     export Web (Thread Support désactivé)
├── scenes/                toutes les scènes (.tscn)
├── scripts/               tous les scripts GDScript (.gd)
├── ui/theme.tres          thème de l'interface (couleurs, polices, boutons)
├── assets/                images, sons, polices, shaders
├── tools/                 programmes Python qui ont créé les images et les sons
└── tests/                 tests automatiques (non inclus dans l'export)
</code></pre>
<table>
<thead>
<tr>
<th>Scène</th>
<th>Nœud racine</th>
<th>Rôle</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>MainMenu.tscn</code></td>
<td>Control</td>
<td>menu principal : JOUER, COMMENT JOUER, OPTIONS, QUITTER</td>
</tr>
<tr>
<td><code>Main.tscn</code></td>
<td>Node2D</td>
<td>la partie : ville, obstacles, voies des voitures, joueur, HUD, pause</td>
</tr>
<tr>
<td><code>Player.tscn</code></td>
<td>CharacterBody2D</td>
<td>le joueur (sprite animé, collision, caméra)</td>
</tr>
<tr>
<td><code>Collectible.tscn</code></td>
<td>Area2D</td>
<td>déchet ou bonus à ramasser</td>
</tr>
<tr>
<td><code>Pollution.tscn</code></td>
<td>Area2D</td>
<td>nuage de pollution</td>
</tr>
<tr>
<td><code>ToxicWaste.tscn</code></td>
<td>Area2D</td>
<td>baril toxique</td>
</tr>
<tr>
<td><code>Car.tscn</code></td>
<td>Area2D</td>
<td>voiture qui suit une voie</td>
</tr>
<tr>
<td><code>HUD.tscn</code></td>
<td>CanvasLayer</td>
<td>score, objectif, temps, vies, santé, énergie, déchets</td>
</tr>
<tr>
<td><code>PauseMenu.tscn</code> / <code>OptionsPanel.tscn</code></td>
<td>—</td>
<td>pause et options</td>
</tr>
<tr>
<td><code>Victory.tscn</code> / <code>GameOver.tscn</code></td>
<td>Control</td>
<td>écrans de fin</td>
</tr>
</tbody>
</table>
<p>Les scènes communiquent par des <strong>signaux</strong> : un déchet envoie <code>collected</code>, un baril <code>touched</code>,
une voiture <code>hit_player</code>, le joueur <code>died</code> / <code>health_changed</code>… Le script <code>game_manager.gd</code> reçoit
ces signaux, met à jour le score et les vies, puis prévient le HUD avec ses propres signaux
(<code>score_changed</code>, <code>time_changed</code>, <code>lives_changed</code>…).</p>
<p>Fonctions principales :
- <code>player.gd</code> → <code>_physics_process()</code> (touches, accélération, sprint, <code>move_and_slide()</code>),
  <code>take_damage()</code> (santé, recul, invincibilité courte).
- <code>game_manager.gd</code> → <code>find_free_position()</code> (position libre grâce au moteur physique),
  les fonctions <code>_on_..._timer()</code> (apparitions), <code>add_score()</code> (victoire),
  <code>_on_player_died()</code> (vies, défaite), <code>_end_game()</code>. Le tableau <code>LEVELS</code> contient les réglages
  des 5 niveaux de difficulté.</p>
<h2>Commandes</h2>
<table>
<thead>
<tr>
<th>Action</th>
<th>Clavier</th>
<th>Manette</th>
</tr>
</thead>
<tbody>
<tr>
<td>Se déplacer</td>
<td><strong>Z Q S D</strong> ou <strong>flèches</strong></td>
<td>stick gauche</td>
</tr>
<tr>
<td>Sprinter (consomme l'énergie)</td>
<td><strong>Maj</strong> ou <strong>Espace</strong></td>
<td>bouton A</td>
</tr>
<tr>
<td>Pause</td>
<td><strong>Échap</strong> ou <strong>P</strong></td>
<td>Start</td>
</tr>
<tr>
<td>Menus</td>
<td>souris, ou flèches + Entrée</td>
<td></td>
</tr>
</tbody>
</table>
<h2>Victoire / Défaite</h2>
<ul>
<li><strong>Victoire</strong> : le score atteint l'objectif avant la fin du temps. L'écran de victoire donne de 1 à
  3 étoiles (+1 s'il reste au moins 2 vies, +1 s'il reste au moins 30 s).</li>
<li><strong>Défaite</strong> : le temps est écoulé, <strong>ou</strong> le joueur a perdu ses 3 vies.</li>
<li>Les deux écrans affichent les statistiques (score, déchets par type, temps, niveau de pollution,
  record) et les boutons <strong>RECOMMENCER</strong> et <strong>RETOUR AU MENU</strong>.</li>
</ul>
<h2>Répartition du travail</h2>
<p>Projet individuel : je suis seul sur ce projet, il n'y a donc pas de répartition entre plusieurs
élèves. Le code et les ressources ont été réalisés avec l'aide d'une IA (voir les sources).</p>
<h2>Bug ou difficulté principale</h2>
<p>Pendant la création du jeu, plusieurs problèmes simples sont apparus :</p>
<ol>
<li><strong>Des déchets apparaissaient dans les bâtiments</strong> : ils étaient placés au hasard sur la carte,
   parfois à l'intérieur d'une maison, donc impossibles à ramasser.</li>
<li><strong>Le personnage était trop petit</strong> à l'écran : on le voyait mal au milieu de la ville.</li>
<li><strong>Le logo du menu était coupé</strong> : le mot « SURVIVOR » dépassait de l'image.</li>
<li><strong>Une erreur apparaissait sur l'écran Game Over</strong> : le script cherchait les étoiles, qui
   n'existent que sur l'écran de victoire.</li>
</ol>
<h2>Solution trouvée</h2>
<ol>
<li>La fonction <code>find_free_position()</code> vérifie avec le moteur physique (<code>intersect_shape()</code>) qu'il
   n'y a pas d'obstacle à l'endroit choisi. Sinon, elle essaie une autre position.</li>
<li>Le sprite du joueur a été agrandi (échelle 0,62 → 0,75) et sa zone de collision aussi.</li>
<li>Le logo a été refait en mesurant la largeur du texte avant de le dessiner.</li>
<li>Le script utilise <code>get_node_or_null("%Stars")</code> : si les étoiles n'existent pas (écran Game
   Over), il ne fait rien au lieu de provoquer une erreur.</li>
</ol>
<h2>Amélioration après le test croisé</h2>
<p><em>(À compléter après avoir fait jouer quelqu'un au jeu.)</em></p>
<ul>
<li>Testeur : ………………</li>
<li>Ce qu'il a remarqué : ………………</li>
<li>Ce que j'ai changé (ou ce que je changerais) : ………………</li>
</ul>
<h2>Sources des médias et ressources</h2>
<ul>
<li><strong>Images</strong> (personnage, déchets, voitures, arbres, ville, icônes, logo) : créées pour ce projet,
  dessinées par programme avec Python et Pillow (<code>tools/generate_art.py</code>, <code>tools/generate_city.py</code>).</li>
<li><strong>Sons et musiques</strong> : créés pour ce projet, synthétisés avec Python, numpy et scipy
  (<code>tools/generate_sounds.py</code>). Aucun son pris sur Internet.</li>
<li><strong>Polices</strong> : <em>Orbitron</em> et <em>Exo 2</em> (Google Fonts), licence libre SIL Open Font License 1.1
  (licences dans <code>assets/fonts/</code>).</li>
<li><strong>Moteur</strong> : Godot Engine 4, gratuit, licence MIT — https://godotengine.org</li>
<li><strong>Aide</strong> : le code, les images et les sons ont été réalisés avec l'aide de l'IA Claude (Anthropic).</li>
</ul>
<h2>Lancer et exporter le projet</h2>
<ol>
<li>Installer <strong>Godot 4</strong> (version 4.3 ou plus récente, version standard).</li>
<li>Dans Godot : <strong>Importer</strong> → choisir <code>project.godot</code> → <strong>Importer et modifier</strong>.</li>
<li>Appuyer sur <strong>F5</strong>.</li>
</ol>
<p>Export Web : <em>Projet → Exporter…</em>, préréglage <strong>Web</strong> déjà configuré (Thread Support désactivé).</p>
</div>

<footer class="bas-de-page">
  <div><a href="index.html">Accueil</a></div>
  <div><a href="#">Mentions légales</a></div>
</footer>
<script src="lightning.js" defer></script>
</body>
</html>
