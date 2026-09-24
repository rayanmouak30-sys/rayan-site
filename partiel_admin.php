<?php
// Attend $titre et $dossier deja definis. Gere l'upload (avec thème facultatif) et affiche la liste classée.
require __DIR__ . "/fichiers.php";
$tailleMax = 10 * 1024 * 1024;
$message = "";

if ($_SERVER["REQUEST_METHOD"] === "POST" && isset($_POST["action"])) {
    $sousDossier = $_POST["sous_dossier"] ?? "";
    $chemin = resoudreCheminFichier($dossier, $sousDossier, $_POST["nom"] ?? "");

    if ($chemin === null || !is_file($chemin)) {
        $message = "Fichier introuvable.";
    } elseif ($_POST["action"] === "supprimer") {
        if (unlink($chemin)) {
            nettoyerDossierVide($dossier, themeVersDossier($sousDossier));
            $message = "Fichier supprimé.";
        } else {
            $message = "Erreur lors de la suppression.";
        }
    } elseif ($_POST["action"] === "renommer") {
        $nouveauNom = nomFichierPropre($_POST["nouveau_nom"] ?? "");
        if ($nouveauNom === "") {
            $message = "Nom invalide.";
        } else {
            $cibleDossier = dirname($chemin) . "/";
            if (is_file($cibleDossier . $nouveauNom)) {
                $message = "Un fichier porte déjà ce nom.";
            } elseif (rename($chemin, $cibleDossier . $nouveauNom)) {
                $message = "Fichier renommé.";
            } else {
                $message = "Erreur lors du renommage.";
            }
        }
    }
} elseif ($_SERVER["REQUEST_METHOD"] === "POST") {
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
      <div class="carte carte-admin">
        <span class="etiquette-theme"><?= htmlspecialchars($f["theme"]) ?></span>
        <a class="lien-titre" href="<?= $f["url"] ?>" target="_blank"><h3><?= htmlspecialchars(nomAffiche($f["nom"])) ?></h3></a>
        <p class="date">Ajouté le <?= date("d/m/Y", $f["date"]) ?></p>
        <div class="actions-fichier">
          <form method="post" class="form-renommer">
            <input type="hidden" name="action" value="renommer">
            <input type="hidden" name="sous_dossier" value="<?= htmlspecialchars($f["sousDossier"]) ?>">
            <input type="hidden" name="nom" value="<?= htmlspecialchars($f["nom"]) ?>">
            <input type="text" name="nouveau_nom" value="<?= htmlspecialchars(nomAffiche($f["nom"])) ?>" required>
            <button type="submit" title="Renommer">✎</button>
          </form>
          <form method="post" class="form-supprimer" onsubmit="return confirm('Supprimer « <?= htmlspecialchars(nomAffiche($f["nom"])) ?> » ?');">
            <input type="hidden" name="action" value="supprimer">
            <input type="hidden" name="sous_dossier" value="<?= htmlspecialchars($f["sousDossier"]) ?>">
            <input type="hidden" name="nom" value="<?= htmlspecialchars($f["nom"]) ?>">
            <button type="submit" class="bouton-danger" title="Supprimer">🗑</button>
          </form>
        </div>
      </div>
    <?php endforeach; endif; ?>
  </div>
</section>
