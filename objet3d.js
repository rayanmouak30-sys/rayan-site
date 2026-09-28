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

  function creerBras(matPeau) {
    var bras = new THREE.Group();

    bras.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), matPeau));

    var hautBras = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.7, 10), matPeau);
    hautBras.position.set(0, -0.37, 0);
    bras.add(hautBras);

    var coude = new THREE.Group();
    coude.position.set(0, -0.74, 0);
    bras.add(coude);
    coude.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), matPeau));

    var avantBras = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.62, 10), matPeau);
    avantBras.position.set(0, -0.33, 0);
    coude.add(avantBras);

    var main = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), matPeau);
    main.position.set(0, -0.66, 0);
    coude.add(main);

    bras.userData = { coude: coude, main: main };
    return bras;
  }

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
    camera.position.set(0, 0.25, 7.8);

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
      { r: 1.2, x: 0, y: 0, z: 0 },
      { r: 0.72, x: -1.15, y: 0.05, z: 0.1 },
      { r: 0.78, x: 1.1, y: 0.02, z: -0.1 },
      { r: 0.55, x: -0.5, y: 0.35, z: 0.3 },
      { r: 0.6, x: 0.55, y: 0.32, z: 0.25 },
    ].forEach(function (b) {
      var boule = new THREE.Mesh(new THREE.SphereGeometry(b.r, 16, 12), matiereNuage);
      boule.position.set(b.x, b.y - 2.15, b.z);
      boule.scale.y = 0.55;
      nuage.add(boule);
    });
    racine.add(nuage);

    // ----- Matiere "energie vivante" partagee par le corps -----
    var matPeau = new THREE.MeshStandardMaterial({
      color: 0x14284a,
      emissive: 0x1f6fe0,
      emissiveIntensity: 0.32,
      metalness: 0.45,
      roughness: 0.4,
    });

    // ----- Jambes croisees -----
    var jambeGauche = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 1.3, 10), matPeau);
    jambeGauche.rotation.z = Math.PI / 2.3;
    jambeGauche.position.set(-0.32, -1.35, 0.25);
    racine.add(jambeGauche);

    var jambeDroite = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 1.3, 10), matPeau);
    jambeDroite.rotation.z = -Math.PI / 2.3;
    jambeDroite.position.set(0.32, -1.35, -0.18);
    racine.add(jambeDroite);

    // ----- Cape -----
    var cape = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 1.7),
      new THREE.MeshStandardMaterial({
        color: 0x081428, emissive: 0x1f6fe0, emissiveIntensity: 0.2,
        side: THREE.DoubleSide, transparent: true, opacity: 0.88, roughness: 0.7,
      })
    );
    cape.position.set(0, -0.55, -0.55);
    cape.rotation.x = -0.3;
    racine.add(cape);

    // ----- Torse et cou -----
    var torse = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.8, 6, 12), matPeau);
    torse.position.set(0, -0.2, 0);
    racine.add(torse);

    var cou = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.2, 10), matPeau);
    cou.position.y = 0.32;
    racine.add(cou);

    // ----- Bras -----
    var brasGauche = creerBras(matPeau);
    brasGauche.position.set(-0.5, 0.12, 0.1);
    brasGauche.rotation.z = 0.3;
    racine.add(brasGauche);

    var brasDroit = creerBras(matPeau);
    brasDroit.position.set(0.5, 0.12, 0.1);
    brasDroit.rotation.z = -1.15;
    brasDroit.userData.coude.rotation.z = 0.75;
    racine.add(brasDroit);

    var orbe = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 14, 14),
      new THREE.MeshBasicMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0.85 })
    );
    orbe.position.set(0, 0.15, 0);
    brasDroit.userData.main.add(orbe);
    var lumiereOrbe = new THREE.PointLight(0x7cc4ff, 1.4, 3.5);
    lumiereOrbe.position.copy(orbe.position);
    brasDroit.userData.main.add(lumiereOrbe);

    // ----- Tete : visage visible + yeux lumineux + couronne (suit le curseur) -----
    var tete = new THREE.Group();
    tete.position.y = 0.62;
    racine.add(tete);

    tete.add(new THREE.Mesh(new THREE.SphereGeometry(0.52, 24, 20), matPeau));

    var matOeil = new THREE.MeshBasicMaterial({ color: 0xdcefff });
    var oeilGauche = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), matOeil);
    oeilGauche.position.set(-0.17, 0.02, 0.46);
    tete.add(oeilGauche);
    var oeilDroit = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), matOeil);
    oeilDroit.position.set(0.17, 0.02, 0.46);
    tete.add(oeilDroit);

    var couronne = new THREE.Mesh(
      new THREE.TorusGeometry(0.4, 0.032, 8, 28),
      new THREE.MeshStandardMaterial({ color: 0x7cc4ff, emissive: 0x3fa8ff, emissiveIntensity: 0.85, metalness: 0.9, roughness: 0.15 })
    );
    couronne.position.y = 0.28;
    couronne.rotation.x = Math.PI / 2;
    tete.add(couronne);

    var halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.68, 0.032, 10, 40),
      new THREE.MeshBasicMaterial({ color: 0x7cc4ff, transparent: true, opacity: 0.7 })
    );
    halo.position.y = 0.58;
    halo.rotation.x = Math.PI / 2;
    tete.add(halo);

    // ----- Eclats d'energie ambiants -----
    var eclats = [];
    for (var i = 0; i < 8; i++) {
      var eclat = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0 })
      );
      eclat.userData = {
        angle: Math.random() * Math.PI * 2,
        rayon: 1.3 + Math.random() * 0.5,
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

      racine.position.y = 0.35 + Math.sin(t * 0.9) * 0.06;
      racine.rotation.y += 0.0022;

      tete.rotation.y += (sourisX * 0.5 - tete.rotation.y) * 0.06;
      tete.rotation.x += (-sourisY * 0.3 - tete.rotation.x) * 0.06;

      halo.rotation.z += 0.01;
      couronne.material.emissiveIntensity = 0.65 + Math.sin(t * 2.4) * 0.25;
      matPeau.emissiveIntensity = 0.28 + Math.sin(t * 1.6) * 0.08;

      brasDroit.rotation.x = Math.sin(t * 0.7) * 0.05;
      var pulseOrbe = 0.7 + Math.sin(t * 6) * 0.3;
      orbe.material.opacity = pulseOrbe;
      orbe.scale.setScalar(0.85 + pulseOrbe * 0.3);
      lumiereOrbe.intensity = 0.9 + pulseOrbe * 1.2;

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
          -0.3 + Math.sin(t * d.vitesse) * 0.5,
          Math.sin(d.angle + t * 0.3) * d.rayon
        );
      });

      renderer.render(scene, camera);
      requestAnimationFrame(animer);
    }
    animer();
  }
})();
