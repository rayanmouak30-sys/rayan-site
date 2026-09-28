import * as THREE from "https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js";

(function () {
  if (window.innerWidth < 700) { return; }

  var heros = document.querySelectorAll(".premier-plan");
  if (!heros.length) { return; }

  heros.forEach(function (hero) {
    try {
      demarrerScene(hero);
    } catch (erreur) {
      // WebGL indisponible ou erreur de rendu : on laisse simplement le fond animé existant.
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
    camera.position.set(0, 0, 6.2);

    var groupe = new THREE.Group();
    scene.add(groupe);

    var geometrie = new THREE.CylinderGeometry(1.5, 1.5, 0.6, 6);
    var materiau = new THREE.MeshStandardMaterial({
      color: 0x0a1830,
      emissive: 0x1f6fe0,
      emissiveIntensity: 0.45,
      metalness: 0.6,
      roughness: 0.3,
      transparent: true,
      opacity: 0.88,
    });
    groupe.add(new THREE.Mesh(geometrie, materiau));

    var contours = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometrie),
      new THREE.LineBasicMaterial({ color: 0x7cc4ff, transparent: true, opacity: 0.9 })
    );
    groupe.add(contours);

    var noeuds = [];
    var nbNoeuds = 6;
    for (var i = 0; i < nbNoeuds; i++) {
      var sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0x3fa8ff })
      );
      sphere.userData = {
        rayon: 2.3 + Math.random() * 0.7,
        vitesse: 0.3 + Math.random() * 0.4,
        decalage: Math.random() * Math.PI * 2,
        inclinaison: (Math.random() - 0.5) * 1.2,
      };
      noeuds.push(sphere);
      scene.add(sphere);
    }

    scene.add(new THREE.AmbientLight(0x2a4a7a, 1.1));
    var lumiere1 = new THREE.PointLight(0x7cc4ff, 2.4, 20);
    lumiere1.position.set(2, 2, 4);
    scene.add(lumiere1);
    var lumiere2 = new THREE.PointLight(0x3fa8ff, 1.3, 20);
    lumiere2.position.set(-3, -1, 3);
    scene.add(lumiere2);

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

      groupe.rotation.y += 0.006;
      groupe.rotation.x += (sourisY * 0.35 - groupe.rotation.x) * 0.04;
      groupe.rotation.z += (sourisX * -0.15 - groupe.rotation.z) * 0.04;

      noeuds.forEach(function (n) {
        var d = n.userData;
        var angle = t * d.vitesse + d.decalage;
        n.position.set(
          Math.cos(angle) * d.rayon,
          Math.sin(angle * 0.6) * d.rayon * 0.4 + d.inclinaison,
          Math.sin(angle) * d.rayon
        );
      });

      renderer.render(scene, camera);
      requestAnimationFrame(animer);
    }
    animer();
  }
})();
