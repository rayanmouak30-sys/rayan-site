import * as THREE from "https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js";

(function () {
  if (window.innerWidth < 700) { return; }

  var heros = document.querySelectorAll(".premier-plan");
  if (!heros.length) { return; }

  heros.forEach(function (hero) {
    try {
      demarrerScene(hero);
    } catch (erreur) {
      // WebGL indisponible ou erreur de rendu : on laisse simplement le fond anime existant.
    }
  });

  function demarrerScene(hero) {
    var canvas = document.createElement("canvas");
    canvas.className = "objet-3d-canvas";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.zIndex = "1";
    canvas.style.pointerEvents = "none";
    hero.appendChild(canvas);

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 6.5);

    var racine = new THREE.Group();
    scene.add(racine);

    // ----- Noyau (orbe de foudre) -----
    var rayonNoyau = 0.8;
    var noyau = new THREE.Mesh(
      new THREE.SphereGeometry(rayonNoyau, 32, 24),
      new THREE.MeshStandardMaterial({
        color: 0x0a1830, emissive: 0x2f8fff, emissiveIntensity: 0.85,
        metalness: 0.4, roughness: 0.15, transparent: true, opacity: 0.8,
      })
    );
    racine.add(noyau);

    var lumiereNoyau = new THREE.PointLight(0x7cc4ff, 2.5, 8);
    racine.add(lumiereNoyau);

    // ----- Anneau orbital -----
    var anneau = new THREE.Mesh(
      new THREE.TorusGeometry(1.7, 0.012, 8, 80),
      new THREE.MeshBasicMaterial({ color: 0x3fa8ff, transparent: true, opacity: 0.35 })
    );
    anneau.rotation.x = 1.3;
    racine.add(anneau);

    // ----- Eclairs en tubes 3D qui jaillissent du noyau -----
    var matEclair = new THREE.MeshBasicMaterial({ color: 0xeaf5ff, transparent: true, opacity: 1, toneMapped: false });

    function creerEclair() {
      var depart = new THREE.Vector3().randomDirection().multiplyScalar(rayonNoyau * 1.02);
      var direction = depart.clone().normalize();
      var longueur = 1.5 + Math.random() * 1.4;
      var arrivee = direction.clone().multiplyScalar(rayonNoyau + longueur);

      var pts = [depart];
      var segments = 6;
      for (var i = 1; i < segments; i++) {
        var pt = depart.clone().lerp(arrivee, i / segments);
        var ecart = (1 - Math.abs(i / segments - 0.5) * 2) * 0.32;
        pt.x += (Math.random() - 0.5) * ecart;
        pt.y += (Math.random() - 0.5) * ecart;
        pt.z += (Math.random() - 0.5) * ecart;
        pts.push(pt);
      }
      pts.push(arrivee);

      var courbe = new THREE.CatmullRomCurve3(pts);
      var geoCoeur = new THREE.TubeGeometry(courbe, 16, 0.028, 6, false);
      var geoGlow = new THREE.TubeGeometry(courbe, 16, 0.07, 6, false);

      var groupe = new THREE.Group();
      var coeur = new THREE.Mesh(geoCoeur, matEclair.clone());
      var glow = new THREE.Mesh(geoGlow, new THREE.MeshBasicMaterial({
        color: 0x3fa8ff, transparent: true, opacity: 0.35, toneMapped: false,
      }));
      groupe.add(glow);
      groupe.add(coeur);
      groupe.userData = { vie: 1, decroissance: 0.83 + Math.random() * 0.06, coeur: coeur, glow: glow };
      racine.add(groupe);
      return groupe;
    }

    var eclairs = [];
    var prochainEclair = 0;

    scene.add(new THREE.AmbientLight(0x2a4a7a, 0.9));
    var lum1 = new THREE.PointLight(0x7cc4ff, 1.6, 20);
    lum1.position.set(3, 2, 4);
    scene.add(lum1);
    var lum2 = new THREE.PointLight(0x3fa8ff, 1, 20);
    lum2.position.set(-3, -1, 3);
    scene.add(lum2);

    var sourisX = 0;
    var sourisY = 0;
    hero.addEventListener("mousemove", function (e) {
      var rect = hero.getBoundingClientRect();
      sourisX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      sourisY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    });

    function ajusterTaille() {
      var w = hero.clientWidth || 1;
      var h = hero.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", ajusterTaille);
    ajusterTaille();

    var horloge = new THREE.Clock();
    function animer() {
      var t = horloge.getElapsedTime();

      racine.rotation.y += 0.003;
      racine.rotation.x += (sourisY * 0.2 - racine.rotation.x) * 0.04;
      racine.rotation.z += (-sourisX * 0.12 - racine.rotation.z) * 0.04;

      noyau.material.emissiveIntensity = 0.7 + Math.sin(t * 3) * 0.25;
      lumiereNoyau.intensity = 2 + Math.sin(t * 5) * 1;
      anneau.rotation.z += 0.005;

      prochainEclair -= 1;
      if (prochainEclair <= 0) {
        eclairs.push(creerEclair());
        if (Math.random() < 0.6) { eclairs.push(creerEclair()); }
        prochainEclair = 4 + Math.random() * 6;
      }
      eclairs = eclairs.filter(function (e) {
        e.userData.vie *= e.userData.decroissance;
        e.userData.coeur.material.opacity = e.userData.vie;
        e.userData.glow.material.opacity = e.userData.vie * 0.35;
        if (e.userData.vie < 0.04) { racine.remove(e); return false; }
        return true;
      });

      renderer.render(scene, camera);
      requestAnimationFrame(animer);
    }
    animer();
  }
})();
