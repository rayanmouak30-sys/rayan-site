<?php
// ===== 2 lignes a changer =====
$titre   = "Documents";
$dossier = "uploads_documents/";
// ==============================
$fichiers = [];
if (is_dir($dossier)) {
    foreach (scandir($dossier) as $f) {
        if (strtolower(pathinfo($f, PATHINFO_EXTENSION)) === "pdf") { $fichiers[] = $f; }
    }
}
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
  <h2><?= $titre ?></h2>
  <p>Systèmes d'information et numérique</p>
</section>

<section id="prestation">
  <h2>Consulter les fichiers</h2>
  <div class="cartes">
    <?php if (empty($fichiers)): ?>
      <p style="color:#a99fc4;text-align:center;width:100%;">Rien pour l'instant.</p>
    <?php else: foreach ($fichiers as $f): ?>
      <a class="carte reveal" href="<?= $dossier . rawurlencode($f) ?>" target="_blank"><h3><?= htmlspecialchars(str_replace(['_','.pdf'],[' ',''],$f)) ?></h3></a>
    <?php endforeach; endif; ?>
  </div>
</section>

<footer class="bas-de-page">
  <div><a href="index.html">Accueil</a></div>
  <div><a href="#">Mentions légales</a></div>
</footer>
</body>
</html>
