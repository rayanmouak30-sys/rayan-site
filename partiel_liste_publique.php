<?php
// Attend $titre et $dossier deja definis par la page qui inclut ce fichier.
require __DIR__ . "/fichiers.php";
$fichiers = listerFichiers($dossier);
$themes = themesDisponibles($fichiers);
?>
<section class="section">
  <div class="barre-filtre" data-filtre>
    <div class="barre-outils">
      <div class="recherche-zone">
        <input type="search" class="recherche" placeholder="Rechercher un titre…" aria-label="Rechercher un titre">
      </div>
      <?php if ($themes): ?>
      <details class="filtre-themes">
        <summary>Thèmes <span class="fleche" aria-hidden="true">▾</span></summary>
        <div class="options">
          <?php foreach ($themes as $t): ?>
            <label class="puce"><input type="checkbox" value="<?= htmlspecialchars($t) ?>"><span><?= htmlspecialchars($t) ?></span></label>
          <?php endforeach; ?>
        </div>
      </details>
      <?php endif; ?>
      <button type="button" class="reinitialiser" style="display:none;">Réinitialiser</button>
    </div>

    <div class="cartes">
      <?php if (empty($fichiers)): ?>
        <p class="vide-texte">Rien pour l'instant.</p>
      <?php else: foreach ($fichiers as $f): ?>
        <a class="carte" href="<?= $f["url"] ?>" target="_blank" rel="noopener" data-titre="<?= htmlspecialchars(strtolower(nomAffiche($f["nom"]))) ?>" data-theme="<?= htmlspecialchars($f["theme"]) ?>">
          <span class="etiquette-theme"><?= htmlspecialchars($f["theme"]) ?></span>
          <h3><?= htmlspecialchars(nomAffiche($f["nom"])) ?></h3>
          <p class="date">Ajouté le <?= date("d/m/Y", $f["date"]) ?></p>
        </a>
      <?php endforeach; ?>
      <?php endif; ?>
      <p class="vide vide-texte" style="display:none;">Aucun résultat.</p>
    </div>
  </div>
</section>
