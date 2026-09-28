(function () {
  var CLE = "popupCompteVu";

  function dejaVu() {
    try { return localStorage.getItem(CLE) === "1"; } catch (e) { return false; }
  }
  function marquerVu() {
    try { localStorage.setItem(CLE, "1"); } catch (e) { /* stockage indisponible : la fenetre pourra reapparaitre */ }
  }

  if (dejaVu()) { return; }

  fetch("compte_etat.php", { credentials: "same-origin" })
    .then(function (r) { return r.json(); })
    .then(function (etat) {
      if (etat.connecte) { marquerVu(); return; }
      setTimeout(afficher, 900);
    })
    .catch(function () { /* pas de PHP (ex. fichier ouvert en local) : on n'affiche rien */ });

  function afficher() {
    var fond = document.createElement("div");
    fond.className = "modal-compte";
    fond.innerHTML =
      '<div class="modal-compte-boite" role="dialog" aria-modal="true" aria-labelledby="modal-compte-titre">' +
      '  <button type="button" class="modal-compte-fermer" aria-label="Fermer">✕</button>' +
      '  <h3 id="modal-compte-titre">⚡ Bienvenue !</h3>' +
      '  <p>Crée un compte pour pouvoir me contacter et suivre mes réponses.<br>Sans compte, tu as quand même accès à tous les documents, cours et évaluations.</p>' +
      '  <div class="modal-compte-actions">' +
      '    <a class="panneau-bouton" href="inscription.php">Créer un compte</a>' +
      '    <a class="modal-compte-secondaire" href="compte.php">J\'ai déjà un compte</a>' +
      '  </div>' +
      '  <button type="button" class="modal-compte-plus-tard">Continuer sans compte</button>' +
      '</div>';
    document.body.appendChild(fond);
    requestAnimationFrame(function () { fond.classList.add("visible"); });

    function fermer() {
      marquerVu();
      fond.classList.remove("visible");
      setTimeout(function () { fond.remove(); }, 300);
    }
    fond.querySelector(".modal-compte-fermer").addEventListener("click", fermer);
    fond.querySelector(".modal-compte-plus-tard").addEventListener("click", fermer);
    fond.addEventListener("click", function (e) { if (e.target === fond) { fermer(); } });
    document.addEventListener("keydown", function echap(e) {
      if (e.key === "Escape") { fermer(); document.removeEventListener("keydown", echap); }
    });
    fond.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", marquerVu); });
  }
})();
