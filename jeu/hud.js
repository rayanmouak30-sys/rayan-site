// Interface en jeu : viseur dynamique, vie, munitions, score, fil des éliminations, minimap, annonces.
import { LIMITES } from "./carte.js";

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor(carte) {
    this.carte = carte;
    this.el = {
      viseur: $("viseur"), marqueur: $("marqueur"), vie: $("vie-nombre"), barre: $("vie-barre"),
      mun: $("mun-chargeur"), reserve: $("mun-reserve"), recharge: $("recharge-anneau"),
      scoreMoi: $("score-moi"), scoreEux: $("score-eux"), chrono: $("chrono"), phase: $("phase"),
      pips: $("pips-bots"), fil: $("fil"), annonce: $("annonce"), sousAnnonce: $("sous-annonce"),
      vignette: $("vignette"), directions: $("directions"), competence: $("competence"), competenceRemplir: $("competence-remplir"),
      minimap: $("minimap"), lunette: $("lunette"),
      banniere: $("banniere"), banniereTitre: $("banniere-titre"), bannierePoints: $("banniere-points"),
    };
    this.banniereT = 0;
    this.ctx = this.el.minimap.getContext("2d");
    this.cache = {};
    this.annonceT = 0;
    this.marqueurT = 0;
    this.vignetteK = 0;
    this.pings = [];
    this.fond = null;
  }

  ecrire(cle, el, valeur) {
    if (this.cache[cle] === valeur) return;
    this.cache[cle] = valeur;
    el.textContent = valeur;
  }

  annonce(texte, sous = "", couleur = "#e9f1ff", duree = 2) {
    this.el.annonce.textContent = texte;
    this.el.sousAnnonce.textContent = sous;
    this.el.annonce.style.color = couleur;
    this.el.annonce.style.textShadow = `0 0 28px ${couleur}66`;
    this.el.annonce.parentElement.classList.remove("visible");
    void this.el.annonce.offsetWidth;
    this.el.annonce.parentElement.classList.add("visible");
    this.annonceT = duree;
  }

  fil(tueur, victime, tete, moi) {
    const ligne = document.createElement("div");
    ligne.className = "ligne-fil" + (moi === "tueur" ? " moi" : moi === "victime" ? " mort" : "");
    const a = document.createElement("span"); a.textContent = tueur;
    const arme = document.createElement("span"); arme.className = "icone-arme"; arme.textContent = tete ? "◎" : "▸";
    const b = document.createElement("span"); b.textContent = victime;
    ligne.append(a, arme, b);
    this.el.fil.prepend(ligne);
    while (this.el.fil.children.length > 5) this.el.fil.lastChild.remove();
    setTimeout(() => ligne.classList.add("part"), 4500);
    setTimeout(() => ligne.remove(), 5000);
  }

  touche(tete, elimination) {
    const m = this.el.marqueur;
    m.className = "hud" + (tete ? " tete" : "") + (elimination ? " elim" : "");
    m.style.opacity = 1;
    this.marqueurT = elimination ? 0.35 : 0.16;
  }

  degat(angle, fort) {
    this.vignetteK = Math.min(1, this.vignetteK + (fort ? 0.8 : 0.45));
    const arc = document.createElement("div");
    arc.className = "arc-degat";
    arc.style.transform = `rotate(${angle}rad)`;
    this.el.directions.appendChild(arc);
    setTimeout(() => arc.remove(), 1200);
  }

  // Bannière d'élimination (compteur de la manche, icône headshot)
  elimination(n, tete) {
    const b = this.el.banniere;
    this.el.banniereTitre.textContent = n >= 5 ? "ACE" : tete ? "HEADSHOT" : "ÉLIMINATION";
    this.el.bannierePoints.innerHTML = "";
    for (let i = 0; i < Math.min(n, 5); i++) {
      const p = document.createElement("i");
      if (i === n - 1) p.className = "nouveau";
      this.el.bannierePoints.appendChild(p);
    }
    b.classList.toggle("tete", tete);
    b.classList.remove("visible");
    void b.offsetWidth;
    b.classList.add("visible");
    this.banniereT = 1.6;
  }

  ruee() {
    const c = this.el.competence;
    c.classList.remove("active");
    void c.offsetWidth;
    c.classList.add("active");
  }

  ping(x, z) {
    this.pings.push({ x, z, t: 2.5 });
  }

  vider() {
    this.el.banniere.classList.remove("visible");
    this.el.fil.innerHTML = "";
    this.el.directions.innerHTML = "";
    this.pings = [];
    this.vignetteK = 0;
  }

  maj(dt, e) {
    // Viseur : l'écart montre l'imprécision réelle de l'arme.
    const ecart = Math.round(Math.min(40, 3 + e.imprecisionPx));
    if (this.cache.ecart !== ecart) { this.cache.ecart = ecart; this.el.viseur.style.setProperty("--ecart", ecart + "px"); }
    this.el.viseur.style.opacity = e.vise ? 0 : 1;
    this.el.lunette.style.opacity = e.vise ? 1 : 0;

    const vie = Math.max(0, Math.ceil(e.vie));
    this.ecrire("vie", this.el.vie, String(vie));
    if (this.cache.vieBarre !== vie) {
      this.cache.vieBarre = vie;
      this.el.barre.style.width = vie + "%";
      this.el.barre.style.background = vie > 50 ? "var(--vert)" : vie > 25 ? "var(--jaune)" : "var(--rouge)";
    }

    this.ecrire("mun", this.el.mun, e.recharge >= 0 ? "—" : String(e.mun));
    this.ecrire("res", this.el.reserve, String(e.reserve));
    this.el.mun.classList.toggle("bas", e.mun <= 5 && e.recharge < 0);
    this.el.recharge.style.opacity = e.recharge >= 0 ? 1 : 0;
    if (e.recharge >= 0) this.el.recharge.style.setProperty("--p", (e.recharge * 100).toFixed(1));

    this.ecrire("smoi", this.el.scoreMoi, String(e.scoreMoi));
    this.ecrire("seux", this.el.scoreEux, String(e.scoreEux));
    const c = Math.max(0, Math.ceil(e.chrono));
    this.ecrire("chrono", this.el.chrono, Math.floor(c / 60) + ":" + String(c % 60).padStart(2, "0"));
    this.el.chrono.classList.toggle("urgent", e.phase === "combat" && c <= 10);
    this.ecrire("phase", this.el.phase, e.phase === "preparation" ? "PRÉPARATION" : e.phase === "combat" ? `MANCHE ${e.manche}` : "");

    const pips = e.botsTotal + ":" + e.botsVivants;
    if (this.cache.pips !== pips) {
      this.cache.pips = pips;
      this.el.pips.innerHTML = "";
      for (let i = 0; i < e.botsTotal; i++) {
        const p = document.createElement("span");
        if (i >= e.botsVivants) p.className = "mort";
        this.el.pips.appendChild(p);
      }
    }

    const pret = e.rueeRecharge <= 0;
    this.el.competence.classList.toggle("prete", pret);
    this.el.competenceRemplir.style.transform = `scaleY(${pret ? 1 : 1 - e.rueeRecharge / e.rueeDuree})`;

    this.annonceT -= dt;
    if (this.annonceT <= 0) this.el.annonce.parentElement.classList.remove("visible");
    this.banniereT -= dt;
    if (this.banniereT <= 0) this.el.banniere.classList.remove("visible");
    this.marqueurT -= dt;
    if (this.marqueurT <= 0) this.el.marqueur.style.opacity = 0;
    this.vignetteK = Math.max(0, this.vignetteK - dt * 1.4);
    const basseVie = vie > 0 && vie <= 25 ? 0.35 + Math.sin(e.temps * 5) * 0.1 : 0;
    this.el.vignette.style.opacity = Math.max(this.vignetteK, basseVie).toFixed(3);

    this.minimap(dt, e);
  }

  minimap(dt, e) {
    const ctx = this.ctx, W = this.el.minimap.width, H = this.el.minimap.height;
    const largeur = LIMITES.maxX - LIMITES.minX, profondeur = LIMITES.maxZ - LIMITES.minZ;
    const k = Math.min((W - 12) / largeur, (H - 12) / profondeur);
    const ox = W / 2, oy = H / 2;
    const px = (x) => ox + x * k, py = (z) => oy + z * k;

    if (!this.fond) {
      // Le décor ne bouge pas : on le dessine une seule fois.
      const f = document.createElement("canvas");
      f.width = W; f.height = H;
      const g = f.getContext("2d");
      g.fillStyle = "rgba(8,14,28,0.78)";
      g.fillRect(0, 0, W, H);
      g.fillStyle = "rgba(60,78,110,0.55)";
      g.fillRect(px(LIMITES.minX), py(LIMITES.minZ), largeur * k, profondeur * k);
      for (const m of this.carte.murs2D) {
        g.fillStyle = m.h > 2.5 ? "#c9d6ee" : "#7f8fae";
        g.fillRect(px(m.x), py(m.z), Math.max(1, m.l * k), Math.max(1, m.p * k));
      }
      g.font = "700 13px Orbitron, Arial, sans-serif";
      g.fillStyle = "#3fa8ff"; g.fillText("A", px(21), py(-1));
      g.fillStyle = "#ff4f8a"; g.fillText("B", px(-22), py(-1));
      this.fond = f;
    }
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(this.fond, 0, 0);

    // Ennemis repérés par le joueur
    for (const p of this.pings) p.t -= dt;
    this.pings = this.pings.filter((p) => p.t > 0);
    for (const p of this.pings) {
      ctx.globalAlpha = Math.min(1, p.t);
      ctx.strokeStyle = "#ff4f5e";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px(p.x), py(p.z), 4 + (2.5 - p.t) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const b of e.botsVus) {
      ctx.fillStyle = "#ff4f5e";
      ctx.beginPath();
      ctx.arc(px(b.x), py(b.z), 3.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Joueur : flèche + cône de vision
    if (e.vivant) {
      const x = px(e.x), y = py(e.z);
      const a = -e.lacet - Math.PI / 2; // lacet 0 = regarde vers Z négatif (haut de la carte)
      ctx.fillStyle = "rgba(124,255,212,0.16)";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, 36, a - 0.6, a + 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = "#7cffd4";
      ctx.beginPath();
      ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(0, 2.5); ctx.lineTo(-4.5, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}
