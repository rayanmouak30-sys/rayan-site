<?php
session_start();
if (empty($_SESSION["admin"])) { header("Location: connexion.php"); exit; }
// ===== 2 lignes a changer =====
$titre   = "Documents";
$dossier = "uploads_documents/";
// ==============================
$titrePage = "Admin — " . $titre;
$navAdmin = true;
include __DIR__ . "/partiel_entete.php";
?>
<header class="titre-page">
  <p class="surtitre">Espace administrateur</p>
  <h1><?= $titre ?></h1>
  <p>Ajouter, renommer ou supprimer des fichiers.</p>
</header>

<?php include __DIR__ . "/partiel_admin.php"; ?>

<?php include __DIR__ . "/partiel_pied.php"; ?>
