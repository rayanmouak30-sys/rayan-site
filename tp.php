<?php
// ===== 2 lignes a changer =====
$titre   = "Évaluations";
$dossier = "uploads_evaluations/";
// ==============================
?>
<!DOCTYPE html>
<html lang="fr">
<head>
<link rel="stylesheet" href="style.css">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= $titre ?> — Mon classeur numérique</title>
<link rel="icon" href="logo.svg">
</head>
<body>
<div id="veil" aria-hidden="true"></div>
<script src="transitions.js"></script>
<script src="lightning.js" defer></script>
<script src="filtre.js" defer></script>
<nav>
  <h1><a href="index.html">Mon classeur numérique</a></h1>
  <div class="ligne">
    <ul>
      <li><a href="documents.php">Documents</a></li>
      <li><a href="cours.php">Cours</a></li>
      <li><a href="tp.php">Évaluations</a></li>
    </ul>
  </div>
</nav>

<section class="premier-plan">
  <canvas class="lightning-canvas" aria-hidden="true"></canvas>
  <h2><?= $titre ?></h2>
  <p>Systèmes d'information et numérique</p>
</section>

<?php include __DIR__ . "/partiel_liste_publique.php"; ?>

<footer class="bas-de-page">
  <div><a href="index.html">Accueil</a></div>
  <div><a href="#">Mentions légales</a></div>
</footer>
</body>
</html>
