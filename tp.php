<?php
// ===== 2 lignes a changer =====
$titre   = "Évaluations";
$dossier = "uploads_evaluations/";
// ==============================
$titrePage = $titre;
include __DIR__ . "/partiel_entete.php";
?>
<script src="filtre.js" defer></script>
<header class="titre-page">
  <h1><?= $titre ?></h1>
  <p>Systèmes d'information et numérique</p>
</header>

<?php include __DIR__ . "/partiel_liste_publique.php"; ?>

<?php include __DIR__ . "/partiel_pied.php"; ?>
