<?php
session_start();
if (empty($_SESSION["admin"])) { header("Location: connexion.php"); exit; }
require __DIR__ . "/comptes.php";

$selection = $_GET["u"] ?? "";
$erreur = "";

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $cible = $_POST["u"] ?? "";
    $texte = trim($_POST["texte"] ?? "");
    if (!utilisateurParId($cible)) {
        $erreur = "Utilisateur introuvable.";
    } elseif ($texte === "" || mb_strlen($texte) > 2000) {
        $erreur = "Réponse vide ou trop longue.";
    } else {
        ajouterMessage($cible, "admin", $texte);
        header("Location: admin_messages.php?u=" . rawurlencode($cible));
        exit;
    }
    $selection = $cible;
}

// Conversations : un utilisateur par ligne, triees par dernier message.
$conversations = [];
foreach (lireDonnees("messages") as $m) {
    $id = $m["utilisateur_id"];
    if (!isset($conversations[$id])) { $conversations[$id] = ["nb" => 0, "dernier" => 0, "attente" => false]; }
    $conversations[$id]["nb"]++;
    if ($m["date"] >= $conversations[$id]["dernier"]) {
        $conversations[$id]["dernier"] = $m["date"];
        $conversations[$id]["attente"] = $m["auteur"] === "visiteur";
    }
}
uasort($conversations, function ($a, $b) { return $b["dernier"] <=> $a["dernier"]; });

$utilisateurSelection = $selection !== "" ? utilisateurParId($selection) : null;

$titrePage = "Admin — Messages";
$navAdmin = true;
include __DIR__ . "/partiel_entete.php";
?>
<div class="panneau panneau-large">
  <h3>📨 Messages reçus</h3>
  <p class="panneau-info"><?= count(lireDonnees("utilisateurs")) ?> compte(s) créé(s) · <?= count($conversations) ?> conversation(s)</p>

  <?php if (!$conversations): ?>
    <p class="fil-vide">Aucun message pour l'instant.</p>
  <?php else: ?>
  <ul class="liste-conversations">
    <?php foreach ($conversations as $id => $c): $u = utilisateurParId($id); if (!$u) { continue; } ?>
      <li class="<?= $id === $selection ? "active" : "" ?>">
        <a href="admin_messages.php?u=<?= rawurlencode($id) ?>">
          <strong><?= htmlspecialchars($u["pseudo"]) ?></strong>
          <span><?= htmlspecialchars($u["email"]) ?> · <?= $c["nb"] ?> msg · <?= date("d/m/Y H:i", $c["dernier"]) ?></span>
          <?php if ($c["attente"]): ?><em class="pastille">à répondre</em><?php endif; ?>
        </a>
      </li>
    <?php endforeach; ?>
  </ul>
  <?php endif; ?>

  <?php if ($utilisateurSelection): ?>
  <h3 class="titre-fil">Conversation avec <?= htmlspecialchars($utilisateurSelection["pseudo"]) ?></h3>
  <div class="fil-messages">
    <?php foreach (messagesDe($utilisateurSelection["id"]) as $m): ?>
      <div class="bulle-msg <?= $m["auteur"] === "admin" ? "bulle-moi" : "bulle-autre" ?>">
        <span class="bulle-auteur"><?= $m["auteur"] === "admin" ? "Toi" : htmlspecialchars($utilisateurSelection["pseudo"]) ?> · <?= date("d/m/Y H:i", $m["date"]) ?></span>
        <p><?= nl2br(htmlspecialchars($m["texte"])) ?></p>
      </div>
    <?php endforeach; ?>
  </div>
  <?php if ($erreur): ?><p class="panneau-erreur"><?= htmlspecialchars($erreur) ?></p><?php endif; ?>
  <form method="post">
    <input type="hidden" name="u" value="<?= htmlspecialchars($utilisateurSelection["id"]) ?>">
    <textarea name="texte" rows="3" maxlength="2000" placeholder="Ta réponse..." required></textarea>
    <button type="submit">Répondre</button>
  </form>
  <?php endif; ?>
</div>
</body>
</html>
