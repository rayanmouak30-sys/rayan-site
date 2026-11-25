<?php
$titrePage = "Fiche gym — Sport";
include __DIR__ . "/partiel_entete.php";
?>
<section class="premier-plan">
  <canvas class="lightning-canvas" aria-hidden="true"></canvas>
  <h2>Fiche gym</h2>
  <p>Sport · Gymnastique BAC · Terminale STI2D</p>
</section>

<div class="panneau panneau-large">
  <h3>🤸 Ma fiche de gymnastique</h3>
  <p class="panneau-info">Rayan Mouak · Terminale STI2D</p>
  <div class="dd-boutons">
    <a class="panneau-bouton" href="fiches/Fiche_BAC_GYM.docx" download>⬇ Télécharger (Word)</a>
    <a class="panneau-bouton" href="fiches/Fiche_BAC_GYM.pdf" download>⬇ Télécharger (PDF)</a>
    <a class="panneau-bouton" href="fiches/Fiche_BAC_GYM.pdf" target="_blank" rel="noopener">📄 Ouvrir en grand</a>
  </div>
  <object class="apercu-fiche" data="fiches/Fiche_BAC_GYM.pdf" type="application/pdf" aria-label="Fiche de gymnastique">
    <p class="panneau-lien">L'aperçu ne s'affiche pas sur cet appareil : utilise les boutons ci-dessus.</p>
  </object>
</div>


<footer class="bas-de-page">
  <div><a href="index.html">Accueil</a></div>
  <div><a href="#">Mentions légales</a></div>
</footer>
<script src="lightning.js" defer></script>
</body>
</html>
