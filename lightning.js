(function () {
  var canvases = document.querySelectorAll(".lightning-canvas");
  if (!canvases.length) return;

  canvases.forEach(function (canvas) {
    var ctx = canvas.getContext("2d");
    var w, h, dpr, t = 0;
    var clouds = [], rain = [], bolts = [], flash = 0, nextStrike = 10;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildClouds();
      buildRain();
    }

    function buildClouds() {
      clouds = [];
      for (var i = 0; i < 5; i++) {
        clouds.push({
          x: Math.random() * w,
          y: Math.random() * h * 0.35,
          r: h * (0.28 + Math.random() * 0.22),
          speed: 0.06 + Math.random() * 0.08,
          phase: Math.random() * 10
        });
      }
    }

    function buildRain() {
      rain = [];
      var count = Math.floor(w / 5);
      for (var i = 0; i < count; i++) {
        rain.push({ x: Math.random() * w, y: Math.random() * h, len: 16 + Math.random() * 20, speed: 11 + Math.random() * 9 });
      }
    }

    /* ---------- Génération d'un éclair (déplacement de point médian) ---------- */
    function subdivide(points, displace, minSeg) {
      if (displace < minSeg) return points;
      var out = [points[0]];
      for (var i = 0; i < points.length - 1; i++) {
        var a = points[i], b = points[i + 1];
        var mx = (a.x + b.x) / 2 + (Math.random() - 0.5) * displace;
        var my = (a.y + b.y) / 2 + (Math.random() - 0.5) * displace * 0.35;
        out.push({ x: mx, y: my });
        out.push(b);
      }
      return subdivide(out, displace * 0.55, minSeg);
    }

    function makeBoltPath(x1, y1, x2, y2, displace) {
      return subdivide([{ x: x1, y: y1 }, { x: x2, y: y2 }], displace, 4);
    }

    function spawnStrike() {
      var x1 = w * (0.2 + Math.random() * 0.6);
      var y1 = -10;
      var x2 = x1 + (Math.random() - 0.5) * w * 0.25;
      var y2 = h * (0.62 + Math.random() * 0.18);
      var main = makeBoltPath(x1, y1, x2, y2, w * 0.09);
      var strike = { life: 1, decay: 0.965, impactX: x2, impactY: y2, segments: [{ pts: main, core: 3.2, alphaMul: 1 }] };

      var branchCount = 1 + Math.floor(Math.random() * 2);
      for (var i = 0; i < branchCount; i++) {
        var idx = Math.floor(main.length * (0.25 + Math.random() * 0.5));
        var origin = main[idx];
        var bx = origin.x + (Math.random() - 0.5) * w * 0.3;
        var by = Math.min(h * 0.95, origin.y + h * (0.18 + Math.random() * 0.22));
        var branch = makeBoltPath(origin.x, origin.y, bx, by, w * 0.05);
        strike.segments.push({ pts: branch, core: 1.6, alphaMul: 0.6 });
      }
      bolts.push(strike);
      flash = Math.max(flash, 0.55 + Math.random() * 0.25);
    }

    function drawBoltSegment(seg, alpha) {
      ctx.save();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.globalCompositeOperation = "lighter";

      var glowPasses = [
        { w: seg.core * 9, a: 0.10 },
        { w: seg.core * 5, a: 0.22 },
        { w: seg.core * 2.4, a: 0.45 }
      ];
      glowPasses.forEach(function (gp) {
        ctx.strokeStyle = "rgba(80,160,255," + (gp.a * alpha) + ")";
        ctx.lineWidth = gp.w;
        ctx.beginPath();
        seg.pts.forEach(function (p, i) { i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); });
        ctx.stroke();
      });

      ctx.strokeStyle = "rgba(244,249,255," + alpha + ")";
      ctx.lineWidth = seg.core;
      ctx.beginPath();
      seg.pts.forEach(function (p, i) { i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); });
      ctx.stroke();
      ctx.restore();
    }

    function draw() {
      var sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#03050b");
      sky.addColorStop(0.6, "#050b18");
      sky.addColorStop(1, "#0a1424");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      clouds.forEach(function (c) {
        var cx = (c.x + t * c.speed) % (w + c.r * 2) - c.r;
        var grad = ctx.createRadialGradient(cx, c.y, 0, cx, c.y, c.r);
        grad.addColorStop(0, "rgba(20,32,54,0.55)");
        grad.addColorStop(1, "rgba(20,32,54,0)");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(cx, c.y, c.r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();

      nextStrike -= 1;
      if (nextStrike <= 0) {
        spawnStrike();
        if (Math.random() < 0.6) { spawnStrike(); }
        nextStrike = 35 + Math.random() * 35;
      }

      bolts = bolts.filter(function (b) { return b.life > 0.02; });
      bolts.forEach(function (b) {
        b.segments.forEach(function (seg) { drawBoltSegment(seg, b.life * seg.alphaMul); });

        var impactGrad = ctx.createRadialGradient(b.impactX, b.impactY, 0, b.impactX, b.impactY, w * 0.12);
        impactGrad.addColorStop(0, "rgba(150,200,255," + (0.35 * b.life) + ")");
        impactGrad.addColorStop(1, "rgba(150,200,255,0)");
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = impactGrad;
        ctx.beginPath(); ctx.arc(b.impactX, b.impactY, w * 0.12, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        b.life *= b.decay;
      });

      if (flash > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = "rgba(150,190,255," + (flash * 0.28) + ")";
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
        flash *= 0.85;
      }

      ctx.save();
      ctx.strokeStyle = "rgba(150,190,255,0.32)";
      ctx.lineWidth = 1.3;
      rain.forEach(function (r) {
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x - 3, r.y + r.len);
        ctx.stroke();
        r.y += r.speed;
        r.x -= r.speed * 0.25;
        if (r.y > h) { r.y = -r.len; r.x = Math.random() * w; }
      });
      ctx.restore();

      t += 1;
      requestAnimationFrame(draw);
    }

    window.addEventListener("resize", resize);
    resize();
    spawnStrike();
    draw();
  });
})();
