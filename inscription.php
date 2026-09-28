<?php
session_start();
require __DIR__ . "/comptes.php";

if (utilisateurConnecte()) { header("Location: contact.php"); exit; }

$erreur = "";
$pseudo = trim($_POST["pseudo"] ?? "");
$email = trim($_POST["email"] ?? "");

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $mdp = $_POST["mdp"] ?? "";
    $confirmation = $_POST["confirmation"] ?? "";

    if (!preg_match('/^[A-Za-z0-9_-]{3,20}$/', $pseudo)) {
        $erreur = "Pseudo : 3 à 20 caractères (lettres, chiffres, - ou _).";
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $erreur = "Adresse email invalide.";
    } elseif (strlen($mdp) < 8) {
        $erreur = "Le mot de passe doit faire au moins 8 caractères.";
    } elseif ($mdp !== $confirmation) {
        $erreur = "Les deux mots de passe ne correspondent pas.";
    } elseif (utilisateurParIdentifiant($pseudo) || utilisateurParIdentifiant($email)) {
        $erreur = "Ce pseudo ou cet email est déjà utilisé.";
    } else {
        $utilisateur = [
            "id" => nouvelId(),
            "pseudo" => $pseudo,
            "email" => $email,
            "hash" => password_hash($mdp, PASSWORD_DEFAULT),
            "cree" => time(),
        ];
        $utilisateurs = lireDonnees("utilisateurs");
        $utilisateurs[] = $utilisateur;
        ecrireDonnees("utilisateurs", $utilisateurs);
        connecterUtilisateur($utilisateur);
        header("Location: contact.php");
        exit;
    }
}

$titrePage = "Créer un compte";
include __DIR__ . "/partiel_entete.php";
?>
<div class="panneau">
  <h3>✨ Créer un compte</h3>
  <p class="panneau-info">Ton compte sert à m'envoyer des messages et à voir mes réponses. Le reste du site reste accessible sans compte.</p>
  <?php if ($erreur): ?><p class="panneau-erreur"><?= htmlspecialchars($erreur) ?></p><?php endif; ?>
  <form method="post">
    <input type="text" name="pseudo" placeholder="Pseudo" value="<?= htmlspecialchars($pseudo) ?>" required autofocus maxlength="20">
    <input type="email" name="email" placeholder="Email" value="<?= htmlspecialchars($email) ?>" required>
    <input type="password" name="mdp" placeholder="Mot de passe (8 caractères min.)" required minlength="8">
    <input type="password" name="confirmation" placeholder="Confirme le mot de passe" required minlength="8">
    <button type="submit">Créer mon compte</button>
  </form>
  <p class="panneau-lien">Déjà un compte ? <a href="compte.php">Se connecter</a></p>
</div>
</body>
</html>
