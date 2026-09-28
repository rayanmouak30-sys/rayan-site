<?php
session_start();
require __DIR__ . "/comptes.php";

$utilisateur = utilisateurConnecte();
$erreur = "";

if ($utilisateur && $_SERVER["REQUEST_METHOD"] === "POST") {
    $texte = trim($_POST["texte"] ?? "");
    $recents = array_filter(messagesDe($utilisateur["id"]), function ($m) {
        return $m["auteur"] === "visiteur" && $m["date"] > time() - 86400;
    });
    if ($texte === "") {
        $erreur = "Le message est vide.";
    } elseif (mb_strlen($texte) > 1000) {
        $erreur = "Message trop long (1000 caractères max).";
    } elseif (count($recents) >= 20) {
        $erreur = "Tu as envoyé beaucoup de messages aujourd'hui, réessaie demain.";
    } else {
        ajouterMessage($utilisateur["id"], "visiteur", $texte);
        header("Location: contact.php");
        exit;
    }
}

$titrePage = "Contact";
include __DIR__ . "/partiel_entete.php";
?>
<?php if (!$utilisateur): ?>
<div class="panneau">
  <h3>✉️ Me contacter</h3>
  <p class="panneau-info">Pour m'envoyer un message et voir mes réponses, crée un compte gratuit (ça prend 20 secondes).</p>
  <a class="panneau-bouton" href="inscription.php">Créer un compte</a>
  <p class="panneau-lien">Déjà un compte ? <a href="compte.php">Se connecter</a></p>
</div>
<?php else: ?>
<div class="panneau panneau-large">
  <h3>✉️ Conversation</h3>
  <p class="panneau-info">Connecté en tant que <strong><?= htmlspecialchars($utilisateur["pseudo"]) ?></strong> · <a href="deconnexion.php">Se déconnecter</a></p>

  <div class="fil-messages">
    <?php $messages = messagesDe($utilisateur["id"]); ?>
    <?php if (!$messages): ?>
      <p class="fil-vide">Aucun message pour l'instant. Écris-moi ci-dessous !</p>
    <?php else: foreach ($messages as $m): ?>
      <div class="bulle-msg <?= $m["auteur"] === "admin" ? "bulle-autre" : "bulle-moi" ?>">
        <span class="bulle-auteur"><?= $m["auteur"] === "admin" ? "Rayan" : "Toi" ?> · <?= date("d/m/Y H:i", $m["date"]) ?></span>
        <p><?= nl2br(htmlspecialchars($m["texte"])) ?></p>
      </div>
    <?php endforeach; endif; ?>
  </div>

  <?php if ($erreur): ?><p class="panneau-erreur"><?= htmlspecialchars($erreur) ?></p><?php endif; ?>
  <form method="post">
    <textarea name="texte" rows="4" maxlength="1000" placeholder="Ton message..." required></textarea>
    <button type="submit">Envoyer</button>
  </form>
</div>
<?php endif; ?>
</body>
</html>
