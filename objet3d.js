import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

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

  function chemin(depart, arrivee, deplacement, segments) {
    var pts = [depart];
    for (var i = 1; i < segments; i++) {
      var pt = depart.clone().lerp(arrivee, i / segments);
      var chaos = deplacement * (1 - Math.abs(i / segments - 0.5) * 1.3);
      pt.x += (Math.random() - 0.5) * chaos;
      pt.y += (Math.random() - 0.5) * chaos;
      pt.z += (Math.random() - 0.5) * chaos;
      pts.push(pt);
    }
    pts.push(arrivee);
    return pts;
  }

  function creerTube(pts, rayon) {
    var courbe = new THREE.CatmullRomCurve3(pts);
    return new THREE.TubeGeometry(courbe, pts.length * 2, rayon, 5, false);
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
    renderer.toneMapping = THREE.ReinhardToneMapping;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 6.5);

    var composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    var bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.9, 0.45, 0.32);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    var racine = new THREE.Group();
    scene.add(racine);

    // ----- Noyau -----
    var rayonNoyau = 0.75;
    var noyau = new THREE.Mesh(
      new THREE.SphereGeometry(rayonNoyau, 32, 24),
      new THREE.MeshBasicMaterial({ color: 0x2f8fff })
    );
    racine.add(noyau);

    var lumiereNoyau = new THREE.PointLight(0x7cc4ff, 3, 10);
    racine.add(lumiereNoyau);

    // ----- Eclairs : forme chaotique, branches, flash -----
    var matEclair = new THREE.MeshBasicMaterial({ color: 0xffffff });
    var matGlow = new THREE.MeshBasicMaterial({ color: 0x5fb4ff, transparent: true, opacity: 0.4 });

    function creerEclair() {
      var depart = new THREE.Vector3().randomDirection().multiplyScalar(rayonNoyau * 1.02);
      var direction = depart.clone().normalize();
      var longueur = 1.8 + Math.random() * 1.6;
      var arrivee = direction.clone().multiplyScalar(rayonNoyau + longueur);

      var groupe = new THREE.Group();
      var pointsPrincipal = chemin(depart, arrivee, 0.4, 8);

      var coeur = new THREE.Mesh(creerTube(pointsPrincipal, 0.022), matEclair.clone());
      var glow = new THREE.Mesh(creerTube(pointsPrincipal, 0.06), matGlow.clone());
      glow.userData.estGlow = true;
      groupe.add(glow);
      groupe.add(coeur);

      var nbBranches = Math.random() < 0.7 ? 1 : 2;
      for (var b = 0; b < nbBranches; b++) {
        var idx = 2 + Math.floor(Math.random() * (pointsPrincipal.length - 4));
        var origine = pointsPrincipal[idx];
        var extremiteBranche = origine.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 1.2,
          (Math.random() - 0.5) * 1.2 - 0.3,
          (Math.random() - 0.5) * 1.2
        ));
        var pointsBranche = chemin(origine, extremiteBranche, 0.25, 5);
        var brancheCoeur = new THREE.Mesh(creerTube(pointsBranche, 0.013), matEclair.clone());
        var brancheGlow = new THREE.Mesh(creerTube(pointsBranche, 0.035), matGlow.clone());
        brancheGlow.userData.estGlow = true;
        groupe.add(brancheGlow);
        groupe.add(brancheCoeur);
      }

      groupe.userData = { vie: 1, decroissance: 0.78 + Math.random() * 0.08 };
      racine.add(groupe);
      return groupe;
    }

    var eclairs = [];
    var prochainEclair = 0;
    var flashAmbiant = 0;

    scene.add(new THREE.AmbientLight(0x1a2f52, 0.6));
    var lum1 = new THREE.PointLight(0x3fa8ff, 0.8, 20);
    lum1.position.set(3, 2, 4);
    scene.add(lum1);

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
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", ajusterTaille);
    ajusterTaille();

    var horloge = new THREE.Clock();
    function animer() {
      var t = horloge.getElapsedTime();

      racine.rotation.y += 0.0025;
      racine.rotation.x += (sourisY * 0.15 - racine.rotation.x) * 0.04;
      racine.rotation.z += (-sourisX * 0.1 - racine.rotation.z) * 0.04;

      noyau.material.color.setHSL(0.58, 1, 0.55 + Math.sin(t * 3) * 0.08);
      lumiereNoyau.intensity = 2.5 + Math.sin(t * 5) * 1.2;

      prochainEclair -= 1;
      if (prochainEclair <= 0) {
        eclairs.push(creerEclair());
        flashAmbiant = 1;
        prochainEclair = 10 + Math.random() * 20;
      }
      flashAmbiant *= 0.85;
      bloom.strength = 0.9 + flashAmbiant * 0.9;

      eclairs = eclairs.filter(function (grp) {
        grp.userData.vie *= grp.userData.decroissance;
        grp.children.forEach(function (mesh) {
          mesh.material.transparent = true;
          mesh.material.opacity = grp.userData.vie * (mesh.userData.estGlow ? 0.4 : 1);
        });
        if (grp.userData.vie < 0.04) { racine.remove(grp); return false; }
        return true;
      });

      composer.render();
      requestAnimationFrame(animer);
    }
    animer();
  }
})();
