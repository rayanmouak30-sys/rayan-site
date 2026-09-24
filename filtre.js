(function () {
  document.querySelectorAll("[data-filtre]").forEach(function (zone) {
    var cartes = zone.querySelectorAll(".carte");
    var recherche = zone.querySelector(".recherche");
    var cases = zone.querySelectorAll(".filtre-themes input[type=checkbox]");
    var vide = zone.querySelector(".vide");

    function appliquer() {
      var texte = (recherche ? recherche.value : "").toLowerCase().trim();
      var themesCoches = Array.prototype.filter.call(cases, function (c) { return c.checked; })
        .map(function (c) { return c.value; });
      var visibles = 0;

      cartes.forEach(function (carte) {
        var titre = carte.dataset.titre || "";
        var theme = carte.dataset.theme || "";
        var okTexte = !texte || titre.indexOf(texte) !== -1;
        var okTheme = themesCoches.length === 0 || themesCoches.indexOf(theme) !== -1;
        var visible = okTexte && okTheme;
        carte.style.display = visible ? "" : "none";
        if (visible) { visibles++; }
      });

      if (vide) { vide.style.display = visibles === 0 ? "block" : "none"; }
    }

    if (recherche) { recherche.addEventListener("input", appliquer); }
    cases.forEach(function (c) { c.addEventListener("change", appliquer); });
  });
})();
