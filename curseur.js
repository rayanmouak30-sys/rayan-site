(function () {
  if (!window.matchMedia || !window.matchMedia("(pointer: fine)").matches) { return; }

  var canvas = document.createElement("canvas");
  canvas.id = "circuit-curseur";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.zIndex = "900";
  canvas.style.pointerEvents = "none";
  document.body.appendChild(canvas);
  var ctx = canvas.getContext("2d");

  var w, h, dpr;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  var noeuds = [];
  var dernierX = null;
  var dernierY = null;
  var distanceMin = 34;
  var maxNoeuds = 55;

  function ajouterNoeud(x, y) {
    var coude = null;
    if (dernierX !== null) {
      coude = Math.random() < 0.5 ? { x: x, y: dernierY } : { x: dernierX, y: y };
    }
    noeuds.push({
      x: x, y: y,
      prevX: dernierX, prevY: dernierY,
      coude: coude,
      vie: 1,
      composant: Math.random() < 0.16,
    });
    if (noeuds.length > maxNoeuds) { noeuds.shift(); }
    dernierX = x;
    dernierY = y;
  }

  window.addEventListener("mousemove", function (e) {
    if (dernierX === null || Math.hypot(e.clientX - dernierX, e.clientY - dernierY) > distanceMin) {
      ajouterNoeud(e.clientX, e.clientY);
    }
  });

  function dessiner() {
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    noeuds.forEach(function (n) {
      if (n.prevX !== null) {
        ctx.strokeStyle = "rgba(63,168,255," + (0.55 * n.vie) + ")";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(n.prevX, n.prevY);
        if (n.coude) { ctx.lineTo(n.coude.x, n.coude.y); }
        ctx.lineTo(n.x, n.y);
        ctx.stroke();
      }

      var lueur = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 14);
      lueur.addColorStop(0, "rgba(63,168,255," + (0.35 * n.vie) + ")");
      lueur.addColorStop(1, "rgba(63,168,255,0)");
      ctx.fillStyle = lueur;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(124,196,255," + (0.85 * n.vie) + ")";
      if (n.composant) {
        ctx.save();
        ctx.translate(n.x, n.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-4, -4, 8, 8);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }

      n.vie *= 0.965;
    });
    ctx.restore();

    noeuds = noeuds.filter(function (n) { return n.vie > 0.04; });
    requestAnimationFrame(dessiner);
  }
  dessiner();
})();
