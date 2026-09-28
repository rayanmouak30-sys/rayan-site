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

  // Un membre a deux segments (bras ou jambe), capsules + spheres aux articulations
  // pour eviter les coutures visibles entre les pieces.
  function creerMembre(rayonHaut, longHaut, rayonBas, longBas, mat) {
    var membre = new THREE.Group();
    membre.add(new THREE.Mesh(new THREE.SphereGeometry(rayonHaut * 1.15, 14, 12), mat));

    var segHaut = new THREE.Mesh(new THREE.CapsuleGeometry(rayonHaut, longHaut, 4, 12), mat);
    segHaut.position.y = -(longHaut / 2 + rayonHaut);
    membre.add(segHaut);

    var articulation = new THREE.Group();
    articulation.position.y = -(longHaut + rayonHaut * 2);
    membre.add(articulation);
    articulation.add(new THREE.Mesh(new THREE.SphereGeometry(rayonBas * 1.2, 12, 10), mat));

    var segBas = new THREE.Mesh(new THREE.CapsuleGeometry(rayonBas, longBas, 4, 12), mat);
    segBas.position.y = -(longBas / 2 + rayonBas);
    articulation.add(segBas);

    var extremite = new THREE.Mesh(new THREE.SphereGeometry(rayonBas * 1.15, 12, 10), mat);
    extremite.position.y = -(longBas + rayonBas * 2);
    articulation.add(extremite);

    membre.userData = { articulation: articulation, extremite: extremite };
    return membre;
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
    var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0.55, 9.6);

    var racine = new THREE.Group();
    scene.add(racine);

    // ----- Nuage (support) -----
    var nuage = new THREE.Group();
    var matiereNuage = new THREE.MeshStandardMaterial({
      color: 0xbfe0ff, emissive: 0x2f8fff, emissiveIntensity: 0.18,
      transparent: true, opacity: 0.85, roughness: 0.9, metalness: 0,
    });
    [
      { r: 1.3, x: 0, y: 0, z: 0 },
      { r: 0.8, x: -1.25, y: 0.05, z: 0.1 },
      { r: 0.85, x: 1.2, y: 0.02, z: -0.1 },
      { r: 0.6, x: -0.55, y: 0.35, z: 0.3 },
      { r: 0.65, x: 0.6, y: 0.32, z: 0.25 },
    ].forEach(function (b) {
      var boule = new THREE.Mesh(new THREE.SphereGeometry(b.r, 18, 14), matiereNuage);
      boule.position.set(b.x, b.y - 1.9, b.z);
      boule.scale.y = 0.5;
      nuage.add(boule);
    });
    racine.add(nuage);

    // ----- Matiere "chair d'energie" partagee -----
    var matPeau = new THREE.MeshStandardMaterial({
      color: 0x18305a, emissive: 0x1f6fe0, emissiveIntensity: 0.28,
      metalness: 0.4, roughness: 0.45,
    });

    // ----- Jambes -----
    var jambeGauche = creerMembre(0.14, 0.7, 0.11, 0.65, matPeau);
    jambeGauche.position.set(-0.24, 0.55, 0.05);
    racine.add(jambeGauche);

    var jambeDroite = creerMembre(0.14, 0.7, 0.11, 0.65, matPeau);
    jambeDroite.position.set(0.24, 0.55, 0.05);
    racine.add(jambeDroite);

    // ----- Pieds -----
    [jambeGauche, jambeDroite].forEach(function (jambe) {
      var pied = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.22, 4, 8), matPeau);
      pied.rotation.z = Math.PI / 2;
      pied.position.set(0, -0.02, 0.12);
      jambe.userData.articulation.add(pied);
    });

    // ----- Torse (bassin + poitrine en une capsule, plus etroit pour degager les bras) -----
    var torse = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.78, 6, 14), matPeau);
    torse.position.set(0, 1.28, 0);
    racine.add(torse);

    var cou = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.18, 10), matPeau);
    cou.position.y = 1.98;
    racine.add(cou);

    // ----- Drape a la taille (façon toge, cintre en haut / evase en bas) -----
    var matDrape = new THREE.MeshStandardMaterial({
      color: 0x0e2040, emissive: 0x1f6fe0, emissiveIntensity: 0.15, roughness: 0.8, metalness: 0.1,
    });
    var drape = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.5, 16, 1, true), matDrape);
    drape.position.y = 0.65;
    racine.add(drape);

    // ----- Cape (fine, derriere les epaules seulement) -----
    var cape = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 1.3, 1, 6),
      new THREE.MeshStandardMaterial({
        color: 0x081428, emissive: 0x1f6fe0, emissiveIntensity: 0.2,
        side: THREE.DoubleSide, transparent: true, opacity: 0.82, roughness: 0.7,
      })
    );
    cape.position.set(0, 1.4, -0.32);
    cape.rotation.x = -0.15;
    racine.add(cape);

    // ----- Bras (ecartes du torse pour bien se distinguer) -----
    var brasGauche = creerMembre(0.1, 0.5, 0.078, 0.45, matPeau);
    brasGauche.position.set(-0.5, 1.82, 0);
    brasGauche.rotation.z = 0.18;
    racine.add(brasGauche);

    var brasDroit = creerMembre(0.1, 0.5, 0.078, 0.45, matPeau);
    brasDroit.position.set(0.5, 1.82, 0);
    brasDroit.rotation.z = -0.22;
    racine.add(brasDroit);

    [brasGauche, brasDroit].forEach(function (bras) {
      var main = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), matPeau);
      bras.userData.extremite.add(main);
    });

    // ----- Canne (plantee pres de la main droite) -----
    var canne = new THREE.Group();
    var hauteurCanne = 1.95;
    var futCanne = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.032, hauteurCanne, 10),
      new THREE.MeshStandardMaterial({ color: 0x0a1830, emissive: 0x1f6fe0, emissiveIntensity: 0.25, metalness: 0.7, roughness: 0.3 })
    );
    futCanne.position.y = hauteurCanne / 2;
    canne.add(futCanne);

    var pommeauCanne = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 14, 14),
      new THREE.MeshStandardMaterial({ color: 0x7cc4ff, emissive: 0x3fa8ff, emissiveIntensity: 1, metalness: 0.85, roughness: 0.15 })
    );
    pommeauCanne.position.y = hauteurCanne;
    canne.add(pommeauCanne);
    var lumierePommeau = new THREE.PointLight(0x7cc4ff, 1.3, 3.5);
    lumierePommeau.position.y = hauteurCanne;
    canne.add(lumierePommeau);

    canne.position.set(0.56, 0.48, 0.22);
    racine.add(canne);

    // ----- Tete : visage, yeux lumineux, couronne (suit le curseur) -----
    var tete = new THREE.Group();
    tete.position.y = 2.35;
    racine.add(tete);

    var crane = new THREE.Mesh(new THREE.SphereGeometry(0.3, 26, 22), matPeau);
    crane.scale.set(1, 1.02, 1);
    tete.add(crane);

    var machoire = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), matPeau);
    machoire.scale.set(0.8, 0.55, 0.75);
    machoire.position.set(0, -0.24, 0.03);
    tete.add(machoire);

    var arcadeSourciliere = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.045, 0.08),
      matPeau
    );
    arcadeSourciliere.position.set(0, 0.06, 0.27);
    tete.add(arcadeSourciliere);

    var nez = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 10), matPeau);
    nez.rotation.x = Math.PI / 2.2;
    nez.position.set(0, -0.06, 0.32);
    tete.add(nez);

    var matBarbe = new THREE.MeshStandardMaterial({ color: 0x050b18, roughness: 0.95, metalness: 0 });
    var barbe = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 12), matBarbe);
    barbe.position.set(0, -0.44, 0.14);
    barbe.rotation.z = Math.PI;
    tete.add(barbe);

    var matOeil = new THREE.MeshBasicMaterial({ color: 0xdcefff });
    var oeilGauche = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), matOeil);
    oeilGauche.position.set(-0.14, 0.0, 0.27);
    tete.add(oeilGauche);
    var oeilDroit = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), matOeil);
    oeilDroit.position.set(0.14, 0.0, 0.27);
    tete.add(oeilDroit);

    var couronne = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.03, 8, 28),
      new THREE.MeshStandardMaterial({ color: 0x7cc4ff, emissive: 0x3fa8ff, emissiveIntensity: 0.85, metalness: 0.9, roughness: 0.15 })
    );
    couronne.position.y = 0.28;
    couronne.rotation.x = Math.PI / 2;
    tete.add(couronne);

    var pointesCouronne = new THREE.Group();
    for (var p = 0; p < 5; p++) {
      var pointe = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 6), couronne.material);
      var angle = (p / 5) * Math.PI * 2;
      pointe.position.set(Math.cos(angle) * 0.34, 0.35, Math.sin(angle) * 0.34);
      pointesCouronne.add(pointe);
    }
    tete.add(pointesCouronne);

    var halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.03, 10, 40),
      new THREE.MeshBasicMaterial({ color: 0x7cc4ff, transparent: true, opacity: 0.7 })
    );
    halo.position.y = 0.5;
    halo.rotation.x = Math.PI / 2;
    tete.add(halo);

    // ----- Eclats d'energie ambiants -----
    var eclats = [];
    for (var i = 0; i < 9; i++) {
      var eclat = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0 })
      );
      eclat.userData = {
        angle: Math.random() * Math.PI * 2,
        rayon: 1.5 + Math.random() * 0.6,
        hauteur: Math.random() * 1.8,
        vitesse: 0.35 + Math.random() * 0.45,
        decalageVie: Math.random() * Math.PI * 2,
      };
      eclats.push(eclat);
      racine.add(eclat);
    }

    scene.add(new THREE.AmbientLight(0x2a4a7a, 1.05));
    var lum1 = new THREE.PointLight(0x7cc4ff, 2.4, 22);
    lum1.position.set(2.2, 3.5, 4.5);
    scene.add(lum1);
    var lum2 = new THREE.PointLight(0x3fa8ff, 1.2, 22);
    lum2.position.set(-3, 0, 3);
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

      racine.position.y = 0.3 + Math.sin(t * 0.8) * 0.05;
      racine.rotation.y += 0.002;

      tete.rotation.y += (sourisX * 0.45 - tete.rotation.y) * 0.06;
      tete.rotation.x += (-sourisY * 0.25 - tete.rotation.x) * 0.06;

      halo.rotation.z += 0.008;
      pointesCouronne.rotation.y += 0.004;
      couronne.material.emissiveIntensity = 0.65 + Math.sin(t * 2.2) * 0.22;
      matPeau.emissiveIntensity = 0.26 + Math.sin(t * 1.5) * 0.07;

      var pulsePommeau = 0.75 + Math.sin(t * 4.5) * 0.25;
      pommeauCanne.scale.setScalar(0.85 + pulsePommeau * 0.3);
      lumierePommeau.intensity = 0.8 + pulsePommeau * 1.1;

      nuage.children.forEach(function (b, i) {
        b.position.y += Math.sin(t * 1.2 + i) * 0.0008;
      });

      eclats.forEach(function (e) {
        var d = e.userData;
        var vie = (Math.sin(t * d.vitesse + d.decalageVie) + 1) / 2;
        var visible = vie > 0.8;
        e.material.opacity = visible ? (vie - 0.8) / 0.2 : 0;
        e.position.set(
          Math.cos(d.angle + t * 0.25) * d.rayon,
          d.hauteur - 1,
          Math.sin(d.angle + t * 0.25) * d.rayon
        );
      });

      renderer.render(scene, camera);
      requestAnimationFrame(animer);
    }
    animer();
  }
})();
