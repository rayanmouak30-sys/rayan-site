<?php
// Attend $titrePage (string) et, optionnellement, $navAdmin (bool) definis avant l'inclusion.
$navAdmin = $navAdmin ?? false;
?>
<!DOCTYPE html>
<html lang="fr">
<head>
<link rel="stylesheet" href="style.css">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= htmlspecialchars($titrePage) ?> — Mon classeur numérique</title>
<link rel="icon" href="logo.svg">
</head>
<body>
<div id="veil" aria-hidden="true"></div>
<script src="transitions.js"></script>
<script src="curseur.js" defer></script>
<nav>
  <h1><a href="index.html">Mon classeur numérique</a></h1>
  <div class="ligne">
    <ul>
      <?php if ($navAdmin): ?>
      <li><a href="admin_documents.php">Documents</a></li>
      <li><a href="admin_cours.php">Cours</a></li>
      <li><a href="admin_tp.php">Évaluations</a></li>
      <li><a href="admin_messages.php">Messages</a></li>
      <li><a href="deconnexion.php">Déconnexion</a></li>
      <?php else: ?>
      <li><a href="documents.php">Documents</a></li>
      <li><a href="cours.php">Cours</a></li>
      <li><a href="tp.php">Évaluations</a></li>
      <li><a href="contact.php">Contact</a></li>
      <?php endif; ?>
    </ul>
  </div>
</nav>
