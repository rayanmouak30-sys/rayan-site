(function () {
  var bouton = document.getElementById("assistant-bouton");
  var panneau = document.getElementById("assistant-panneau");
  var fermer = document.getElementById("assistant-fermer");
  var form = document.getElementById("assistant-form");
  var saisie = document.getElementById("assistant-saisie");
  var messages = document.getElementById("assistant-messages");
  if (!bouton || !panneau || !form || !saisie || !messages) { return; }

  var historique = [];
  var dejaOuvert = false;

  function ajouterMessage(role, texte) {
    var bulle = document.createElement("div");
    bulle.className = "assistant-bulle " + (role === "user" ? "assistant-bulle-user" : "assistant-bulle-ia");
    bulle.textContent = texte;
    messages.appendChild(bulle);
    messages.scrollTop = messages.scrollHeight;
    return bulle;
  }

  bouton.addEventListener("click", function () {
    panneau.hidden = !panneau.hidden;
    if (!panneau.hidden) {
      saisie.focus();
      if (!dejaOuvert) {
        dejaOuvert = true;
        ajouterMessage("assistant", "Salut 👋 Je suis l'assistant de ce site, pose-moi une question sur les documents, les cours ou le STI2D/SIN.");
      }
    }
  });

  if (fermer) {
    fermer.addEventListener("click", function () { panneau.hidden = true; });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var texte = saisie.value.trim();
    if (!texte) { return; }

    ajouterMessage("user", texte);
    historique.push({ role: "user", contenu: texte });
    saisie.value = "";
    saisie.disabled = true;

    var attente = ajouterMessage("assistant", "...");

    fetch("assistant.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: texte, historique: historique }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        attente.remove();
        if (data.reponse) {
          ajouterMessage("assistant", data.reponse);
          historique.push({ role: "assistant", contenu: data.reponse });
        } else {
          var texteErreur = data.erreur || "Erreur inconnue.";
          if (data.detail) { texteErreur += "\n\nDétail technique : " + data.detail; }
          ajouterMessage("assistant", texteErreur);
        }
      })
      .catch(function () {
        attente.remove();
        ajouterMessage("assistant", "Impossible de contacter l'assistant.");
      })
      .finally(function () {
        saisie.disabled = false;
        saisie.focus();
      });
  });
})();
