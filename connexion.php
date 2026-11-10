<?php
session_start();
require __DIR__ . "/config.php";
require __DIR__ . "/verification_fonctions.php";
$erreur = "";
if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $mdp = $_POST["mdp"] ?? "";
    if ($mdp === $motDePasseAdmin) {
        $_SESSION["admin"] = true;
        unset($_SESSION["code_verification"], $_SESSION["code_expire"], $_SESSION["code_essais"], $_SESSION["code_envoye_a"]);
        header("Location: admin_documents.php");
        exit;
    } elseif ($mdp === $motDePasseProf) {
        envoyerCodeVerification($emailProprietaire);
        header("Location: verification.php");
        exit;
    } else {
        $erreur = "Mot de passe incorrect.";
    }
}

$titrePage = "Connexion admin";
$avecNav = false;
include __DIR__ . "/partiel_entete.php";
?>
<div class="panneau">
  <h1>Connexion admin</h1>
  <?php if ($erreur): ?><p class="panneau-erreur"><?= htmlspecialchars($erreur) ?></p><?php endif; ?>
  <form method="post">
    <input type="password" name="mdp" placeholder="Mot de passe" aria-label="Mot de passe" required autofocus>
    <button type="submit" class="bouton bouton-plein">Se connecter</button>
  </form>
</div>
<?php include __DIR__ . "/partiel_pied.php"; ?>
