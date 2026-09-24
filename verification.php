<?php
session_start();
require __DIR__ . "/config.php";

if (empty($_SESSION["code_verification"])) {
    header("Location: connexion.php");
    exit;
}

$erreur = "";
if ($_SERVER["REQUEST_METHOD"] === "POST") {
    if (time() > ($_SESSION["code_expire"] ?? 0)) {
        unset($_SESSION["code_verification"], $_SESSION["code_expire"], $_SESSION["code_essais"]);
        $erreur = "Code expiré, redemande une connexion.";
    } elseif (($_SESSION["code_essais"] ?? 0) >= 5) {
        unset($_SESSION["code_verification"], $_SESSION["code_expire"], $_SESSION["code_essais"]);
        $erreur = "Trop de tentatives, redemande une connexion.";
    } elseif (($_POST["code"] ?? "") === $_SESSION["code_verification"]) {
        $_SESSION["admin"] = true;
        unset($_SESSION["code_verification"], $_SESSION["code_expire"], $_SESSION["code_essais"]);
        header("Location: admin_documents.php");
        exit;
    } else {
        $_SESSION["code_essais"] = ($_SESSION["code_essais"] ?? 0) + 1;
        $erreur = "Code incorrect.";
    }
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
<link rel="stylesheet" href="style.css">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vérification</title>
<link rel="icon" href="logo.svg">
<style>
.ajout{max-width:420px;margin:120px auto 40px;padding:30px;background:var(--panel);border:1px solid var(--border);border-radius:14px;text-align:center;opacity:0;animation:apparait .6s ease forwards;transition:border-color .3s,box-shadow .3s;}
.ajout:hover{border-color:var(--border-strong);box-shadow:0 0 24px var(--glow);}
.ajout h3{font-family:'Orbitron',sans-serif;color:var(--accent-soft);margin-bottom:18px;}
.ajout p.info{color:var(--text-muted);font-size:15px;margin-bottom:15px;}
.ajout input{display:block;width:100%;margin:10px 0;padding:12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);text-align:center;letter-spacing:6px;font-size:22px;transition:border-color .3s,box-shadow .3s;}
.ajout input:focus{outline:none;border-color:var(--border-strong);box-shadow:0 0 10px var(--glow);}
.ajout button{margin-top:12px;padding:12px 30px;font-family:'Orbitron',sans-serif;color:var(--accent);background:transparent;border:1px solid var(--border-strong);border-radius:10px;cursor:pointer;transition:all .3s;}
.ajout button:hover{background:var(--border-strong);color:var(--bg);box-shadow:0 0 18px var(--glow);transform:translateY(-2px);}
.ajout button:active{transform:translateY(0);}
.message{text-align:center;color:var(--error);margin-bottom:15px;}
.retour{display:block;margin-top:16px;color:var(--text-muted);font-size:14px;}
</style>
</head>
<body>
<div id="veil" aria-hidden="true"></div>
<script src="transitions.js"></script>
<nav>
  <h1><a href="index.html">Mon classeur numérique</a></h1>
</nav>

<div class="ajout">
  <h3>📩 Code de vérification</h3>
  <p class="info">Un code a été envoyé par email au propriétaire du site. Il doit te le communiquer pour valider la connexion (valable 10 minutes).</p>
  <?php if ($erreur): ?><p class="message"><?= htmlspecialchars($erreur) ?></p><?php endif; ?>
  <form method="post">
    <input type="text" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="------" required autofocus>
    <button type="submit">Valider</button>
  </form>
  <a class="retour" href="connexion.php">← Revenir à la connexion</a>
</div>
</body>
</html>
