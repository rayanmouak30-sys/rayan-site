<?php
session_start();
require __DIR__ . "/comptes.php";

if (utilisateurConnecte()) { header("Location: contact.php"); exit; }

$erreur = "";
$identifiant = trim($_POST["identifiant"] ?? "");

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $utilisateur = utilisateurParIdentifiant($identifiant);
    if ($utilisateur && password_verify($_POST["mdp"] ?? "", $utilisateur["hash"])) {
        connecterUtilisateur($utilisateur);
        header("Location: contact.php");
        exit;
    }
    $erreur = "Identifiant ou mot de passe incorrect.";
}

$titrePage = "Se connecter";
include __DIR__ . "/partiel_entete.php";
?>
<div class="panneau">
  <h3>🔑 Se connecter</h3>
  <?php if ($erreur): ?><p class="panneau-erreur"><?= htmlspecialchars($erreur) ?></p><?php endif; ?>
  <form method="post">
    <input type="text" name="identifiant" placeholder="Pseudo ou email" value="<?= htmlspecialchars($identifiant) ?>" required autofocus>
    <input type="password" name="mdp" placeholder="Mot de passe" required>
    <button type="submit">Se connecter</button>
  </form>
  <p class="panneau-lien">Pas encore de compte ? <a href="inscription.php">Créer un compte</a></p>
</div>
</body>
</html>
