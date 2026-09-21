<?php
session_start();
if (empty($_SESSION["admin"])) { header("Location: connexion.php"); exit; }
// ===== 2 lignes a changer =====
$titre   = "Documents";
$dossier = "uploads_documents/";
// ==============================
$tailleMax = 10 * 1024 * 1024;
$message = "";

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    if (!isset($_FILES["fichier"]) || $_FILES["fichier"]["error"] !== 0) {
        $message = "Aucun fichier recu.";
    } elseif ($_FILES["fichier"]["size"] > $tailleMax) {
        $message = "Fichier trop lourd (10 Mo max).";
    } else {
        $nom = basename($_FILES["fichier"]["name"]);
        $ext = strtolower(pathinfo($nom, PATHINFO_EXTENSION));
        if ($ext !== "pdf") {
            $message = "Seuls les PDF sont autorises.";
        } else {
            $nomPropre = preg_replace('/[^A-Za-z0-9._-]/', '_', $nom);
            if (!is_dir($dossier)) { mkdir($dossier, 0755, true); }
            if (move_uploaded_file($_FILES["fichier"]["tmp_name"], $dossier . $nomPropre)) {
                $message = "Fichier ajoute !";
            } else {
                $message = "Erreur lors de l'enregistrement.";
            }
        }
    }
}
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

<section id="prestation">
  <p class="badge">🔒 Espace administrateur</p>
  <?php if ($message): ?><p class="message"><?= htmlspecialchars($message) ?></p><?php endif; ?>

  <div class="ajout">
    <h3>Ajouter un fichier</h3>
    <form method="post" enctype="multipart/form-data">
      <input type="file" name="fichier" accept="application/pdf" required>
      <button type="submit">Envoyer le PDF</button>
    </form>
  </div>

  <div class="cartes">
    <?php if (empty($fichiers)): ?>
      <p style="color:#a99fc4;text-align:center;width:100%;">Rien pour l'instant.</p>
    <?php else: foreach ($fichiers as $f): ?>
      <a class="carte" href="<?= $dossier . rawurlencode($f) ?>" target="_blank"><h3><?= htmlspecialchars(str_replace(['_','.pdf'],[' ',''],$f)) ?></h3></a>
    <?php endforeach; endif; ?>
  </div>
</section>

<footer class="bas-de-page">
  <div><a href="index.html">← Voir le site public</a></div>
  <div><a href="deconnexion.php">Déconnexion</a></div>
</footer>
</body>
</html>
