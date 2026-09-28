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
    var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.3, 7.5);

    var racine = new THREE.Group();
    scene.add(racine);

    // ----- Nuage -----
    var nuage = new THREE.Group();
    var matiereNuage = new THREE.MeshStandardMaterial({
      color: 0xbfe0ff,
      emissive: 0x2f8fff,
      emissiveIntensity: 0.18,
      transparent: true,
      opacity: 0.85,
      roughness: 0.9,
      metalness: 0,
    });
    [
      { r: 1.15, x: 0, y: 0, z: 0 },
      { r: 0.7, x: -1.1, y: 0.05, z: 0.1 },
      { r: 0.75, x: 1.05, y: 0.02, z: -0.1 },
      { r: 0.55, x: -0.5, y: 0.35, z: 0.3 },
      { r: 0.6, x: 0.55, y: 0.32, z: 0.25 },
    ].forEach(function (b) {
      var boule = new THREE.Mesh(new THREE.SphereGeometry(b.r, 16, 12), matiereNuage);
      boule.position.set(b.x, b.y - 1.7, b.z);
      boule.scale.y = 0.55;
      nuage.add(boule);
    });
    racine.add(nuage);

    // ----- Silhouette assise (robe conique, ouverte en bas) -----
    var matiereRobe = new THREE.MeshStandardMaterial({
      color: 0x0a1830,
      emissive: 0x1f6fe0,
      emissiveIntensity: 0.35,
      metalness: 0.5,
      roughness: 0.4,
    });
    var robe = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.1, 24, 1, true), matiereRobe);
    robe.position.y = -0.75;
    racine.add(robe);

    var contourRobe = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.ConeGeometry(1.1, 2.1, 12, 1, true), 25),
      new THREE.LineBasicMaterial({ color: 0x7cc4ff, transparent: true, opacity: 0.5 })
    );
    contourRobe.position.y = -0.75;
    racine.add(contourRobe);

    // ----- Tete, masque et auréole (suivent le curseur) -----
    var tete = new THREE.Group();
    tete.position.y = 0.55;
    racine.add(tete);

    tete.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 24, 20),
      new THREE.MeshStandardMaterial({ color: 0x0f1f38, emissive: 0x1f6fe0, emissiveIntensity: 0.25, metalness: 0.4, roughness: 0.5 })
    ));

    var masque = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.05, 10, 24, Math.PI * 1.1),
      new THREE.MeshStandardMaterial({ color: 0x7cc4ff, emissive: 0x3fa8ff, emissiveIntensity: 0.9, metalness: 0.8, roughness: 0.2 })
    );
    masque.position.set(0, -0.02, 0.48);
    masque.rotation.x = Math.PI / 2.1;
    tete.add(masque);

    var halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.035, 10, 40),
      new THREE.MeshBasicMaterial({ color: 0x7cc4ff, transparent: true, opacity: 0.75 })
    );
    halo.position.y = 0.62;
    halo.rotation.x = Math.PI / 2;
    tete.add(halo);

    // ----- Petits eclats d'energie qui crepitent autour -----
    var eclats = [];
    for (var i = 0; i < 8; i++) {
      var eclat = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0 })
      );
      eclat.userData = {
        angle: Math.random() * Math.PI * 2,
        rayon: 1.2 + Math.random() * 0.5,
        vitesse: 0.4 + Math.random() * 0.5,
        decalageVie: Math.random() * Math.PI * 2,
      };
      eclats.push(eclat);
      racine.add(eclat);
    }

    scene.add(new THREE.AmbientLight(0x2a4a7a, 1.0));
    var lum1 = new THREE.PointLight(0x7cc4ff, 2.2, 20);
    lum1.position.set(2, 3, 4);
    scene.add(lum1);
    var lum2 = new THREE.PointLight(0x3fa8ff, 1.1, 20);
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

      racine.position.y = 0.4 + Math.sin(t * 0.9) * 0.06;
      racine.rotation.y += 0.0025;

      tete.rotation.y += (sourisX * 0.5 - tete.rotation.y) * 0.06;
      tete.rotation.x += (-sourisY * 0.3 - tete.rotation.x) * 0.06;

      halo.rotation.z += 0.01;
      masque.material.emissiveIntensity = 0.7 + Math.sin(t * 3) * 0.3;

      nuage.children.forEach(function (b, i) {
        b.position.y += Math.sin(t * 1.2 + i) * 0.0008;
      });

      eclats.forEach(function (e) {
        var d = e.userData;
        var vie = (Math.sin(t * d.vitesse + d.decalageVie) + 1) / 2;
        var visible = vie > 0.82;
        e.material.opacity = visible ? (vie - 0.82) / 0.18 : 0;
        e.position.set(
          Math.cos(d.angle + t * 0.3) * d.rayon,
          -0.2 + Math.sin(t * d.vitesse) * 0.4,
          Math.sin(d.angle + t * 0.3) * d.rayon
        );
      });

      renderer.render(scene, camera);
      requestAnimationFrame(animer);
    }
    animer();
  }
})();
