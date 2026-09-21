<?php
session_start();
require __DIR__ . "/config.php";
$erreur = "";
if ($_SERVER["REQUEST_METHOD"] === "POST") {
    if (($_POST["mdp"] ?? "") === $motDePasseAdmin) {
        $_SESSION["admin"] = true;
        header("Location: admin_documents.php");
        exit;
    } else {
        $erreur = "Mot de passe incorrect.";
    }
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
<link rel="stylesheet" href="style.css">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connexion admin</title>
<style>
.ajout{max-width:420px;margin:120px auto 40px;padding:30px;background:var(--panel);border:1px solid var(--border);border-radius:14px;text-align:center;opacity:0;animation:apparait .6s ease forwards;transition:border-color .3s,box-shadow .3s;}
.ajout:hover{border-color:var(--border-strong);box-shadow:0 0 24px var(--glow);}
.ajout h3{font-family:'Orbitron',sans-serif;color:var(--accent-soft);margin-bottom:18px;}
.ajout input{display:block;width:100%;margin:10px 0;padding:12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);transition:border-color .3s,box-shadow .3s;}
.ajout input:focus{outline:none;border-color:var(--border-strong);box-shadow:0 0 10px var(--glow);}
.ajout button{margin-top:12px;padding:12px 30px;font-family:'Orbitron',sans-serif;color:var(--accent);background:transparent;border:1px solid var(--border-strong);border-radius:10px;cursor:pointer;transition:all .3s;}
.ajout button:hover{background:var(--border-strong);color:var(--bg);box-shadow:0 0 18px var(--glow);transform:translateY(-2px);}
.ajout button:active{transform:translateY(0);}
.message{text-align:center;color:var(--error);margin-bottom:15px;}
</style>
</head>
<body>
<div id="veil" aria-hidden="true"></div>
<script src="transitions.js"></script>
<nav>
  <h1><a href="index.html">Mon classeur numérique</a></h1>
</nav>

<div class="ajout">
  <h3>🔒 Connexion admin</h3>
  <?php if ($erreur): ?><p class="message"><?= htmlspecialchars($erreur) ?></p><?php endif; ?>
  <form method="post">
    <input type="password" name="mdp" placeholder="Mot de passe" required autofocus>
    <button type="submit">Se connecter</button>
  </form>
</div>
</body>
</html>
