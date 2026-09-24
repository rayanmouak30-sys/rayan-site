(function () {
  document.querySelectorAll("[data-filtre]").forEach(function (zone) {
    var cartes = zone.querySelectorAll(".carte");
    var recherche = zone.querySelector(".recherche");
    var cases = zone.querySelectorAll(".filtre-themes input[type=checkbox]");
    var vide = zone.querySelector(".vide");
    var reinitialiser = zone.querySelector(".reinitialiser");

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
      if (reinitialiser) { reinitialiser.style.display = (texte || themesCoches.length) ? "inline-block" : "none"; }
    }

    if (recherche) { recherche.addEventListener("input", appliquer); }
    cases.forEach(function (c) {
      c.addEventListener("change", function () {
        var puce = c.closest(".puce");
        if (puce) { puce.classList.toggle("actif", c.checked); }
        appliquer();
      });
    });
    if (reinitialiser) {
      reinitialiser.addEventListener("click", function () {
        if (recherche) { recherche.value = ""; }
        cases.forEach(function (c) {
          c.checked = false;
          var puce = c.closest(".puce");
          if (puce) { puce.classList.remove("actif"); }
        });
        appliquer();
      });
    }
  });
})();
