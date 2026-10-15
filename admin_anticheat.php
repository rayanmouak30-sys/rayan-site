<?php
session_start();
if (empty($_SESSION["admin"])) { header("Location: connexion.php"); exit; }
require __DIR__ . "/comptes.php";

// Journal de l'anti-triche du mode En ligne du jeu (écrit par jeu/anticheat.php et jeu/serveur/anticheat.js)
if ($_SERVER["REQUEST_METHOD"] === "POST") {
    if (($_POST["action"] ?? "") === "lever") { ecrireDonnees("anticheat_bans", []); }
    if (($_POST["action"] ?? "") === "vider") { ecrireDonnees("anticheat", []); }
    header("Location: admin_anticheat.php");
    exit;
}

$journal = array_reverse(lireDonnees("anticheat"));
$bans = array_filter(lireDonnees("anticheat_bans"), fn($fin) => $fin > time());
$exclusions = count(array_filter($journal, fn($e) => !empty($e["exclu"])));

$titrePage = "Admin — Anti-triche";
$navAdmin = true;
include __DIR__ . "/partiel_entete.php";
?>
<div class="panneau panneau-large">
  <h3>🛡️ Anti-triche du jeu en ligne</h3>
  <p class="panneau-info"><?= count($journal) ?> détection(s) · <?= $exclusions ?> exclusion(s) · <?= count($bans) ?> bannissement(s) en cours (15 min)</p>

  <?php if (!$journal): ?>
    <p class="fil-vide">Aucune triche détectée pour l'instant.</p>
  <?php else: ?>
  <ul class="liste-conversations">
    <?php foreach (array_slice($journal, 0, 150) as $e): ?>
      <li>
        <a>
          <strong><?= htmlspecialchars((string) ($e["nom"] ?? "?")) ?> — <?= htmlspecialchars((string) ($e["raison"] ?? "")) ?></strong>
          <span>Salon <?= htmlspecialchars((string) ($e["salon"] ?? "")) ?> · <?= date("d/m/Y H:i:s", (int) ($e["t"] ?? 0)) ?> · <?= htmlspecialchars((string) ($e["detail"] ?? "")) ?> · <?= (int) ($e["points"] ?? 0) ?> point(s)</span>
          <?php if (!empty($e["exclu"])): ?><em class="pastille">exclu</em><?php endif; ?>
        </a>
      </li>
    <?php endforeach; ?>
  </ul>
  <?php endif; ?>

  <form method="post" class="panneau-lien">
    <button type="submit" name="action" value="lever">Lever les bannissements</button>
    <button type="submit" name="action" value="vider" onclick="return confirm('Effacer tout le journal ?');">Vider le journal</button>
  </form>
</div>
</body>
</html>
