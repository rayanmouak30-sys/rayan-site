<?php
// En-tete commun a toutes les pages PHP.
// Attend $titrePage (string). Optionnel : $navAdmin (bool) pour le menu admin, $avecNav (bool, true par defaut).
$navAdmin = $navAdmin ?? false;
$avecNav = $avecNav ?? true;
$pageActuelle = basename($_SERVER["SCRIPT_NAME"] ?? "");

$liens = $navAdmin
    ? [
        "admin_documents.php" => "Documents",
        "admin_cours.php"     => "Cours",
        "admin_tp.php"        => "Évaluations",
        "admin_messages.php"  => "Messages",
        "deconnexion.php"     => "Déconnexion",
    ]
    : [
        "documents.php" => "Documents",
        "cours.php"     => "Cours",
        "tp.php"        => "Évaluations",
        "jeu-dd.php"    => "Jeu DD",
        "jeu/"          => "Jeu",
        "contact.php"   => "Contact",
    ];
?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= htmlspecialchars($titrePage) ?> — Mon classeur numérique</title>
<link rel="icon" href="logo.svg">
<link rel="stylesheet" href="style.css">
<?php if ($navAdmin): ?><script src="notif_messages.js" defer></script><?php endif; ?>
</head>
<body>
<nav class="barre">
  <div class="conteneur barre-int">
    <a class="marque" href="index.html"><img src="logo.svg" alt="" width="22" height="22">Mon classeur numérique</a>
    <?php if ($avecNav): ?>
    <ul class="menu">
      <?php foreach ($liens as $href => $texte): ?>
      <li><a href="<?= $href ?>"<?= $href === $pageActuelle ? ' aria-current="page"' : '' ?>><?= $texte ?></a></li>
      <?php endforeach; ?>
    </ul>
    <?php endif; ?>
  </div>
</nav>
<main class="conteneur">
