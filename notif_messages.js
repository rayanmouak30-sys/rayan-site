(function () {
  var lien = document.querySelector('nav a[href="admin_messages.php"]');
  if (!lien) { return; }

  function afficher(nombre) {
    var badge = lien.querySelector(".notif-badge");
    if (nombre > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "notif-badge";
        lien.appendChild(badge);
      }
      badge.textContent = nombre > 9 ? "9+" : String(nombre);
      badge.title = nombre + " conversation(s) en attente de réponse";
    } else if (badge) {
      badge.remove();
    }
  }

  function verifier() {
    fetch("admin_notif.php", { credentials: "same-origin", cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : { attente: 0 }; })
      .then(function (d) { afficher(d.attente || 0); })
      .catch(function () { /* reseau indisponible : on reessaiera au prochain tour */ });
  }

  verifier();
  setInterval(verifier, 30000);
})();
