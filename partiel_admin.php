<?php
// Attend $titre et $dossier deja definis. Gere l'upload (avec thème facultatif) et affiche la liste classée.
require __DIR__ . "/fichiers.php";
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
            $sousDossier = themeVersDossier($_POST["theme"] ?? "");
            $cible = $dossier . ($sousDossier !== "" ? $sousDossier . "/" : "");
            if (!is_dir($cible)) { mkdir($cible, 0755, true); }
            if (move_uploaded_file($_FILES["fichier"]["tmp_name"], $cible . $nomPropre)) {
                $message = "Fichier ajouté !";
            } else {
                $message = "Erreur lors de l'enregistrement.";
            }
        }
    }
}

$fichiers = listerFichiers($dossier);
$themes = themesDisponibles($fichiers);
?>
<section id="prestation">
  <p class="badge">🔒 Espace administrateur</p>
  <?php if ($message): ?><p class="message"><?= htmlspecialchars($message) ?></p><?php endif; ?>

  <div class="ajout">
    <h3>Ajouter un fichier</h3>
    <form method="post" enctype="multipart/form-data">
      <input type="file" name="fichier" accept="application/pdf" required>
      <input type="text" name="theme" list="themes-existants" placeholder="Thème (ex : Bases de données) — facultatif">
      <datalist id="themes-existants">
        <?php foreach ($themes as $t): if ($t !== "Sans thème"): ?>
          <option value="<?= htmlspecialchars($t) ?>">
        <?php endif; endforeach; ?>
      </datalist>
      <button type="submit">Envoyer le PDF</button>
    </form>
  </div>

  <div class="cartes">
    <?php if (empty($fichiers)): ?>
      <p style="color:#a99fc4;text-align:center;width:100%;">Rien pour l'instant.</p>
    <?php else: foreach ($fichiers as $f): ?>
      <a class="carte" href="<?= $f["url"] ?>" target="_blank">
        <span class="etiquette-theme"><?= htmlspecialchars($f["theme"]) ?></span>
        <h3><?= htmlspecialchars(nomAffiche($f["nom"])) ?></h3>
        <p class="date">Ajouté le <?= date("d/m/Y", $f["date"]) ?></p>
      </a>
    <?php endforeach; endif; ?>
  </div>
</section>
