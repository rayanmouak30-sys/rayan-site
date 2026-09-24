<?php
session_start();
if (empty($_SESSION["admin"])) { header("Location: connexion.php"); exit; }
// ===== 2 lignes a changer =====
$titre   = "Documents";
$dossier = "uploads_documents/";
// ==============================
?>
<!DOCTYPE html>
<html lang="fr">
<head>
<link rel="stylesheet" href="style.css">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Admin — <?= $titre ?></title>
<link rel="icon" href="logo.svg">
<style>
.ajout{max-width:520px;margin:0 auto 40px;padding:25px;background:var(--panel);border:1px solid var(--border);border-radius:14px;text-align:center;transition:border-color .3s,box-shadow .3s;}
.ajout:hover{border-color:var(--border-strong);box-shadow:0 0 24px var(--glow);}
.ajout h3{font-family:'Orbitron',sans-serif;color:var(--accent-soft);margin-bottom:15px;}
.ajout input{display:block;width:100%;margin:10px 0;padding:12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);transition:border-color .3s,box-shadow .3s;}
.ajout input:focus{outline:none;border-color:var(--border-strong);box-shadow:0 0 10px var(--glow);}
.ajout button{margin-top:10px;padding:12px 28px;font-family:'Orbitron',sans-serif;color:var(--accent);background:transparent;border:1px solid var(--border-strong);border-radius:10px;cursor:pointer;transition:all .3s;}
.ajout button:hover{background:var(--border-strong);color:var(--bg);box-shadow:0 0 18px var(--glow);transform:translateY(-2px);}
.ajout button:active{transform:translateY(0);}
.message{text-align:center;color:var(--accent-soft);margin-bottom:20px;font-size:18px;animation:apparait .5s ease forwards;}
.badge{text-align:center;color:var(--accent);font-family:'Orbitron',sans-serif;margin-bottom:20px;}
</style>
</head>
<body>
<div id="veil" aria-hidden="true"></div>
<script src="transitions.js"></script>
<script src="lightning.js" defer></script>
<nav>
  <h1><a href="index.html">Mon classeur numérique</a></h1>
  <div class="ligne">
    <ul>
      <li><a href="admin_documents.php">Documents</a></li>
      <li><a href="admin_cours.php">Cours</a></li>
      <li><a href="admin_tp.php">Évaluations</a></li>
      <li><a href="deconnexion.php">Déconnexion</a></li>
    </ul>
  </div>
</nav>

<section class="premier-plan">
  <canvas class="lightning-canvas" aria-hidden="true"></canvas>
  <h2>Admin — <?= $titre ?></h2>
  <p>Espace réservé : ajout de fichiers</p>
</section>

<?php include __DIR__ . "/partiel_admin.php"; ?>

<footer class="bas-de-page">
  <div><a href="index.html">← Voir le site public</a></div>
  <div><a href="deconnexion.php">Déconnexion</a></div>
</footer>
</body>
</html>
