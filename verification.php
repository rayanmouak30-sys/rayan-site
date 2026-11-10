<?php
session_start();
require __DIR__ . "/config.php";
require __DIR__ . "/verification_fonctions.php";

if (empty($_SESSION["code_verification"])) {
    header("Location: connexion.php");
    exit;
}

$erreur = "";
$info = "";
if ($_SERVER["REQUEST_METHOD"] === "POST" && isset($_POST["renvoyer"])) {
    if (time() - ($_SESSION["code_envoye_a"] ?? 0) < 30) {
        $erreur = "Attends quelques secondes avant de redemander un code.";
    } else {
        envoyerCodeVerification($emailProprietaire);
        $info = "Nouveau code envoyé.";
    }
} elseif ($_SERVER["REQUEST_METHOD"] === "POST") {
    if (time() > ($_SESSION["code_expire"] ?? 0)) {
        unset($_SESSION["code_verification"], $_SESSION["code_expire"], $_SESSION["code_essais"], $_SESSION["code_envoye_a"]);
        $erreur = "Code expiré, redemande une connexion.";
    } elseif (($_SESSION["code_essais"] ?? 0) >= 5) {
        unset($_SESSION["code_verification"], $_SESSION["code_expire"], $_SESSION["code_essais"], $_SESSION["code_envoye_a"]);
        $erreur = "Trop de tentatives, redemande une connexion.";
    } elseif (($_POST["code"] ?? "") === $_SESSION["code_verification"]) {
        $_SESSION["admin"] = true;
        unset($_SESSION["code_verification"], $_SESSION["code_expire"], $_SESSION["code_essais"], $_SESSION["code_envoye_a"]);
        header("Location: admin_documents.php");
        exit;
    } else {
        $_SESSION["code_essais"] = ($_SESSION["code_essais"] ?? 0) + 1;
        $erreur = "Code incorrect.";
    }
}

$titrePage = "Vérification";
$avecNav = false;
include __DIR__ . "/partiel_entete.php";
?>
<div class="panneau">
  <h1>Code de vérification</h1>
  <p class="panneau-info">Un code a été envoyé par email au propriétaire du site. Il doit te le communiquer pour valider la connexion (valable 2 minutes).</p>
  <?php if ($erreur): ?><p class="panneau-erreur"><?= htmlspecialchars($erreur) ?></p><?php endif; ?>
  <?php if ($info): ?><p class="panneau-succes"><?= htmlspecialchars($info) ?></p><?php endif; ?>
  <form method="post">
    <input class="champ-code" type="text" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="••••••" aria-label="Code à 6 chiffres" required autofocus>
    <button type="submit" class="bouton bouton-plein">Valider</button>
  </form>
  <form method="post">
    <input type="hidden" name="renvoyer" value="1">
    <button type="submit" class="bouton-lien">Renvoyer un nouveau code</button>
  </form>
  <p class="panneau-lien"><a href="connexion.php">← Revenir à la connexion</a></p>
</div>
<?php include __DIR__ . "/partiel_pied.php"; ?>
