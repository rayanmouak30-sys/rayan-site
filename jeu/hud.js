// Interface en jeu : viseur personnalisable, vie et bouclier, munitions et emplacements, compétences,
// score et équipes, spike, minimap, fil des éliminations, annonces, récap de manche, tableau des scores.
import { ARMES } from "./armes.js";
import { HEROS, CATEGORIES } from "./heros.js";
import { CAPACITES, ICONES, iconeCapacite } from "./capacites.js";

const $ = (id) => document.getElementById(id);

export { ICONES };

const NOMS_ARMES = { couteau: "LAME", pistolet: "SENTINELLE", pompe: "BRISEUR", fusil: "NS-7 VECTEUR", pulsar: "PULSAR P-07", sniper: "AIGUILLE", spike: "SPIKE" };

export class Hud {
  constructor(carte) {
    this.el = {
      viseur: $("viseur"), marqueur: $("marqueur"), vie: $("vie-nombre"), barre: $("vie-barre"),
      armure: $("armure-nombre"), armureBloc: $("armure-bloc"), armureBarre: $("armure-barre"),
      mun: $("mun-chargeur"), reserve: $("mun-reserve"), recharge: $("recharge-anneau"), nomArme: $("nom-arme"), emplacements: $("emplacements"),
      scoreMoi: $("score-moi"), scoreEux: $("score-eux"), chrono: $("chrono"), phase: $("phase"),
      pipsMoi: $("pips-moi"), pipsEux: $("pips-eux"), camp: $("etiquette-camp"), spike: $("spike-etat"),
      fil: $("fil"), annonce: $("annonce"), sousAnnonce: $("sous-annonce"),
      vignette: $("vignette"), directions: $("directions"), flash: $("flash-blanc"), teinte: $("teinte"),
      minimap: $("minimap"), lunette: $("lunette"), aide: $("aide"), progression: $("progression"), credits: $("credits"),
      banniere: $("banniere"), banniereTitre: $("banniere-titre"), bannierePoints: $("banniere-points"),
      capFumee: $("cap-fumee"), capFlash: $("cap-flash"), capSignature: $("cap-signature"), capUltime: $("cap-ultime"),
      agent: $("agent-nom"), portrait: $("hud-portrait"), ordres: $("ordres"), tableau: $("tableau"), recap: $("recap"), killcam: $("killcam"),
    };
    this.ctx = this.el.minimap.getContext("2d");
    this.cache = {};
    this.annonceT = 0;
    this.marqueurT = 0;
    this.vignetteK = 0;
    this.banniereT = 0;
    this.recapT = 0;
    this.pings = [];
    this.fond = null;
    this.minimapT = 0;
    this.changerCarte(carte);
    this.slots = { c: this.el.capFumee, q: this.el.capFlash, e: this.el.capSignature, x: this.el.capUltime };
  }

  changerCarte(carte) {
    this.carte = carte;
    this.fond = null;
  }

  ecrire(cle, el, valeur) {
    if (this.cache[cle] === valeur) return;
    this.cache[cle] = valeur;
    el.textContent = valeur;
  }

  classe(cle, el, nom, oui) {
    const k = cle + nom;
    if (this.cache[k] === oui) return;
    this.cache[k] = oui;
    el.classList.toggle(nom, oui);
  }

  // Applique le style du viseur choisi dans les paramètres
  appliquerViseur(v, el = this.el.viseur) {
    el.style.setProperty("--couleur-viseur", v.couleur);
    el.style.setProperty("--longueur", v.longueur + "px");
    el.style.setProperty("--epaisseur", v.epaisseur + "px");
    el.style.setProperty("--contour", v.contour ? "0 0 0 1px rgba(0,0,0,0.7)" : "none");
    el.querySelector("b").style.display = v.point ? "block" : "none";
    for (const i of el.querySelectorAll("i")) i.style.display = v.longueur > 0 ? "block" : "none";
    if (el === this.el.viseur) { this.viseurConf = v; this.cache.ecart = null; }
    else el.style.setProperty("--ecart", v.ecart + "px");
  }

  // Personnage joué : nom, catégorie, portrait et icônes des 4 capacités
  heros(id, portrait = null) {
    const h = HEROS[id] || HEROS.kael;
    const cat = CATEGORIES[h.categorie];
    this.el.agent.textContent = h.nom + " · " + cat.nom.toUpperCase();
    this.el.agent.style.color = cat.couleur;
    this.el.portrait.style.setProperty("--couleur-heros", cat.couleur);
    if (portrait) this.el.portrait.src = portrait; else this.el.portrait.removeAttribute("src");
    h.capacites.forEach((capId, i) => {
      const el = this.slots[["c", "q", "e", "x"][i]];
      el.querySelector(".icone").innerHTML = iconeCapacite(capId);
      el.title = CAPACITES[capId].nom + " — " + CAPACITES[capId].texte;
      if (i < 3) el.style.color = cat.couleur;
    });
    const pts = this.el.capUltime.querySelector(".points");
    pts.innerHTML = "";
    for (let i = 0; i < (CAPACITES[h.capacites[3]].points || 7); i++) pts.appendChild(document.createElement("i"));
    this.cache.ult = null;
    // Boutons tactiles : icônes des capacités du personnage
    ["fumee", "flash", "signature", "ultime"].forEach((action, i) => {
      const bt = document.querySelector(`#tactile [data-action="${action}"]`);
      if (bt) { bt.innerHTML = iconeCapacite(h.capacites[i]); bt.title = CAPACITES[h.capacites[i]].nom; bt.style.color = i === 3 ? "var(--jaune)" : cat.couleur; }
    });
  }

  // Lettres des touches affichées sur les compétences (elles suivent les touches choisies par le joueur)
  etiquettesTouches(etiquetteAction) {
    for (const el of document.querySelectorAll("[data-action-touche]")) el.textContent = etiquetteAction(el.dataset.actionTouche);
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

  // moi : "tueur" | "victime" | "allie" | "info" | ""
  fil(tueur, victime, tete, moi, arme = null, couleurs = null) {
    const ligne = document.createElement("div");
    ligne.className = "ligne-fil" + (moi === "tueur" ? " moi" : moi === "victime" ? " mort" : moi === "info" ? " info" : "");
    const a = document.createElement("span"); a.textContent = tueur;
    if (couleurs) a.style.color = couleurs[0];
    const icone = document.createElement("span"); icone.className = "icone-arme";
    const capacite = arme && arme.startsWith && arme.startsWith("cap:") ? CAPACITES[arme.slice(4)] : null;
    icone.textContent = (arme && NOMS_ARMES[arme] ? NOMS_ARMES[arme] + " " : capacite ? capacite.nom.toUpperCase() + " " : "") + (tete ? "◎" : moi === "info" ? "" : "▸");
    const b = document.createElement("span"); b.textContent = victime;
    if (couleurs) b.style.color = couleurs[1];
    ligne.append(a, icone, b);
    this.el.fil.prepend(ligne);
    while (this.el.fil.children.length > 6) this.el.fil.lastChild.remove();
    setTimeout(() => ligne.classList.add("part"), 5000);
    setTimeout(() => ligne.remove(), 5500);
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

  elimination(n, tete) {
    const b = this.el.banniere;
    this.el.banniereTitre.textContent = n >= 5 ? "ACE" : n === 4 ? "QUADRUPLE" : n === 3 ? "TRIPLE" : n === 2 ? "DOUBLE" : tete ? "HEADSHOT" : "ÉLIMINATION";
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

  activerCapacite(nom) {
    const el = { fumee: this.el.capFumee, flash: this.el.capFlash, signature: this.el.capSignature, ultime: this.el.capUltime }[nom];
    if (!el) return;
    el.classList.remove("active");
    void el.offsetWidth;
    el.classList.add("active");
  }

  ping(x, z) { this.pings.push({ x, z, t: 2.5 }); }

  // Récapitulatif de fin de manche
  recap(r) {
    const el = this.el.recap;
    el.innerHTML = "";
    const titre = document.createElement("div");
    titre.className = "recap-titre " + (r.gagnee ? "gagne" : "perdu");
    titre.textContent = r.gagnee ? "MANCHE GAGNÉE" : "MANCHE PERDUE";
    const raison = document.createElement("div");
    raison.className = "recap-raison";
    raison.textContent = r.raison + " · " + r.scores.bleu + " – " + r.scores.rouge;
    const grille = document.createElement("div");
    grille.className = "recap-grille";
    for (const [v, l] of [[r.kills, "Éliminations"], [r.degats, "Dégâts infligés"], [r.recus, "Dégâts reçus"], ["+" + r.credits, "Crédits gagnés"]]) {
      const c = document.createElement("div");
      const s = document.createElement("strong"); s.textContent = v;
      const p = document.createElement("span"); p.textContent = l;
      c.append(s, p);
      grille.appendChild(c);
    }
    el.append(titre, raison, grille);
    el.classList.add("visible");
    this.recapT = 4.6;
  }

  killcam(texte) {
    this.el.killcam.textContent = texte || "";
    this.el.killcam.classList.toggle("visible", !!texte);
  }

  ordres(visible, liste = [], manette = false) {
    const el = this.el.ordres;
    el.classList.toggle("visible", visible);
    if (!visible) return;
    el.innerHTML = "<div class='ordres-titre'>ORDRES À L'ÉQUIPE</div>";
    liste.forEach((o, i) => {
      const d = document.createElement("div");
      const k = document.createElement("kbd"); k.textContent = manette ? ["A", "B", "X", "Y", "LB"][i] : String(i + 1);
      const s = document.createElement("span"); s.textContent = o;
      d.append(k, s);
      el.appendChild(d);
    });
  }

  // lignes : [{ nom, kills, morts, extra, equipe ("moi"/"eux"), vivant, joueur }]
  tableau(visible, titre = "", lignes = []) {
    const el = this.el.tableau;
    el.classList.toggle("visible", visible);
    if (!visible) { this.cache.tableau = null; return; }
    const cle = titre + JSON.stringify(lignes);
    if (this.cache.tableau === cle) return;
    this.cache.tableau = cle;
    el.innerHTML = "";
    const h = document.createElement("div"); h.className = "tableau-titre"; h.textContent = titre;
    el.appendChild(h);
    const t = document.createElement("table");
    const entete = document.createElement("tr");
    for (const c of ["Joueur", "É", "M", ""]) { const th = document.createElement("th"); th.textContent = c; entete.appendChild(th); }
    t.appendChild(entete);
    for (const l of lignes) {
      const tr = document.createElement("tr");
      tr.className = (l.equipe || "") + (l.joueur ? " joueur" : "") + (l.vivant === false ? " mort" : "");
      for (const v of [l.nom, l.kills, l.morts, l.extra || ""]) { const td = document.createElement("td"); td.textContent = v; tr.appendChild(td); }
      t.appendChild(tr);
    }
    el.appendChild(t);
  }

  vider() {
    this.el.banniere.classList.remove("visible");
    this.el.recap.classList.remove("visible");
    this.el.fil.innerHTML = "";
    this.el.directions.innerHTML = "";
    this.pings = [];
    this.vignetteK = 0;
    this.killcam(null);
    this.ordres(false);
    this.tableau(false);
  }

  pips(el, cle, total, vivants) {
    const v = total + ":" + vivants;
    if (this.cache[cle] === v) return;
    this.cache[cle] = v;
    el.innerHTML = "";
    for (let i = 0; i < total; i++) {
      const p = document.createElement("span");
      if (i >= vivants) p.className = "mort";
      el.appendChild(p);
    }
  }

  // e : état complet du jeu pour cette image (voir main.js)
  maj(dt, e) {
    const j = e.joueur;
    // Viseur : l'écart montre l'imprécision réelle de l'arme
    const conf = this.viseurConf || { ecart: 4, dynamique: true };
    const ecart = Math.round(Math.min(40, conf.ecart + (conf.dynamique ? e.imprecisionPx : 0)));
    if (this.cache.ecart !== ecart) { this.cache.ecart = ecart; this.el.viseur.style.setProperty("--ecart", ecart + "px"); }
    const lunette = e.lunette;
    this.el.viseur.style.opacity = e.vise && !e.couteau ? (lunette ? 0 : 0.0) : e.masquerViseur ? 0 : 1;
    this.el.lunette.style.opacity = lunette ? 1 : 0;

    const vie = Math.max(0, Math.ceil(j.vie));
    this.ecrire("vie", this.el.vie, String(vie));
    if (this.cache.vieBarre !== vie) {
      this.cache.vieBarre = vie;
      this.el.barre.style.width = vie + "%";
      this.el.barre.style.background = vie > 50 ? "var(--vert)" : vie > 25 ? "var(--jaune)" : "var(--rouge)";
    }
    const armure = Math.ceil(j.armure);
    this.ecrire("armure", this.el.armure, String(armure));
    this.classe("armure", this.el.armureBloc, "vide", armure <= 0);
    if (this.cache.armureBarre !== armure) { this.cache.armureBarre = armure; this.el.armureBarre.style.width = armure * 2 + "%"; }

    // Arme active, munitions, emplacements
    const L = j.logique, def = L.def;
    const melee = def.type === "melee";
    this.ecrire("mun", this.el.mun, melee ? "—" : e.recharge >= 0 ? "…" : String(L.mun));
    this.ecrire("res", this.el.reserve, melee ? "" : String(L.reserve > 500 ? "∞" : L.reserve));
    this.ecrire("nomArme", this.el.nomArme, NOMS_ARMES[def.id]);
    this.classe("melee", this.el.mun.parentElement, "melee", melee);
    this.classe("mun", this.el.mun, "bas", !melee && L.mun <= Math.max(2, def.chargeur * 0.2) && e.recharge < 0);
    this.el.recharge.style.opacity = e.recharge >= 0 ? 1 : 0;
    if (e.recharge >= 0) this.el.recharge.style.setProperty("--p", (e.recharge * 100).toFixed(1));
    const slots = [j.inventaire.principale, j.inventaire.secondaire, "couteau"].map((id, i) => (id ? `${i + 1}:${id}` : "")).join("|") + "|" + j.armeActive + (j.porteSpike ? "|spike" : "");
    if (this.cache.slots !== slots) {
      this.cache.slots = slots;
      const el = this.el.emplacements;
      el.innerHTML = "";
      [j.inventaire.principale, j.inventaire.secondaire, "couteau"].forEach((id, i) => {
        if (!id) return;
        const d = document.createElement("div");
        d.className = "emplacement" + (id === j.armeActive ? " actif" : "");
        d.innerHTML = `<kbd>${i + 1}</kbd><span></span>`;
        d.querySelector("span").textContent = NOMS_ARMES[id];
        el.appendChild(d);
      });
      if (j.porteSpike) { const d = document.createElement("div"); d.className = "emplacement spike"; d.textContent = "◆ SPIKE"; el.appendChild(d); }
    }

    // Capacités : charges, recharge, points d'ultime, blocage par une IEM
    const etat = j.capacites;
    const bloque = j.empT > 0;
    for (const slot of ["c", "q", "e"]) {
      const e = etat[slot], el = this.slots[slot];
      this.ecrire("ch" + slot, el.querySelector(".charges"), e.max > 1 || slot !== "e" ? "•".repeat(e.charges) : "");
      this.classe("v" + slot, el, "vide", e.charges <= 0);
      this.classe("p" + slot, el, "prete", e.charges > 0 && slot === "e");
      this.classe("b" + slot, el, "bloquee", bloque);
      const enRecharge = e.charges < e.max && (!etat.economie || slot === "e");
      const k = enRecharge ? Math.min(1, e.t / (CAPACITES[e.id].recharge || 30)) : 0;
      const kr = Math.round(k * 40) / 40;
      if (this.cache["r" + slot] !== kr) { this.cache["r" + slot] = kr; el.querySelector(".remplir").style.transform = `scaleY(${kr})`; }
    }
    this.classe("bx", this.el.capUltime, "bloquee", bloque);
    if (this.cache.ult !== j.ultime) {
      this.cache.ult = j.ultime;
      [...this.el.capUltime.querySelectorAll(".points i")].forEach((p, i) => p.classList.toggle("plein", i < j.ultime));
      this.el.capUltime.classList.toggle("prete", j.ultime >= etat.x.points);
    }

    // Score, chrono, équipes
    const r = e.regles;
    let gauche = "", droite = "";
    if (r.mode === "deathmatch" || r.mode === "enligne") { gauche = String(e.scoreMoi); droite = String(e.scoreTete); }
    else if (r.mode === "stand") { gauche = String(e.defiScore); droite = e.defiObjectif; }
    else { gauche = String(r.scores.bleu); droite = String(r.scores.rouge); }
    this.ecrire("smoi", this.el.scoreMoi, gauche);
    this.ecrire("seux", this.el.scoreEux, droite);
    const c = Math.max(0, Math.ceil(e.chrono));
    const spikePose = r.spike && r.spike.etat === "pose";
    this.ecrire("chrono", this.el.chrono, r.mode === "enligne" ? "LIVE" : spikePose ? "◆ " + c : Math.floor(c / 60) + ":" + String(c % 60).padStart(2, "0"));
    this.classe("chrono", this.el.chrono, "urgent", (r.phase === "combat" || spikePose) && c <= 10 && r.mode !== "stand" && r.mode !== "enligne");
    this.classe("chrono", this.el.chrono, "spike", !!spikePose);
    this.ecrire("phase", this.el.phase, e.textePhase);
    this.ecrire("camp", this.el.camp, e.texteCamp);
    this.pips(this.el.pipsMoi, "pm", e.equipeMoi[0], e.equipeMoi[1]);
    this.pips(this.el.pipsEux, "pe", e.equipeEux[0], e.equipeEux[1]);
    this.ecrire("aide", this.el.aide, e.aide || "");
    this.ecrire("credits", this.el.credits, e.credits !== null ? "¤ " + e.credits : "");

    // Barre de pose / désamorçage
    const p = e.progression;
    this.classe("prog", this.el.progression, "visible", !!p);
    if (p) {
      this.ecrire("progT", this.el.progression.querySelector(".texte"), p.texte);
      this.el.progression.querySelector("i").style.width = Math.min(100, p.k * 100).toFixed(1) + "%";
      this.el.progression.querySelector("b").style.display = p.mi ? "block" : "none";
    }

    // Écran blanc du flash, teinte des ultimes
    this.el.flash.style.opacity = e.aveugle.toFixed(3);
    this.el.teinte.style.opacity = e.teinte ? "1" : "0";
    if (e.teinte && this.cache.teinte !== e.teinte) { this.cache.teinte = e.teinte; this.el.teinte.style.boxShadow = `inset 0 0 160px ${e.teinte}`; }

    this.annonceT -= dt;
    if (this.annonceT <= 0) this.el.annonce.parentElement.classList.remove("visible");
    this.banniereT -= dt;
    if (this.banniereT <= 0) this.el.banniere.classList.remove("visible");
    this.recapT -= dt;
    if (this.recapT <= 0) this.el.recap.classList.remove("visible");
    this.marqueurT -= dt;
    if (this.marqueurT <= 0) this.el.marqueur.style.opacity = 0;
    this.vignetteK = Math.max(0, this.vignetteK - dt * 1.4);
    const basseVie = vie > 0 && vie <= 25 ? 0.35 + Math.sin(e.temps * 5) * 0.1 : 0;
    this.el.vignette.style.opacity = Math.max(this.vignetteK, basseVie).toFixed(3);

    // La minimap n'a pas besoin d'être redessinée à chaque image
    this.minimapT -= dt;
    for (const pg of this.pings) pg.t -= dt;
    if (this.minimapT <= 0) { this.minimapT = 1 / 20; this.minimap(e); }
  }

  minimap(e) {
    const ctx = this.ctx, W = this.el.minimap.width, H = this.el.minimap.height;
    const L = this.carte.limites;
    const largeur = L.maxX - L.minX, profondeur = L.maxZ - L.minZ;
    const k = Math.min((W - 12) / largeur, (H - 12) / profondeur);
    const ox = W / 2 - ((L.minX + L.maxX) / 2) * k, oy = H / 2 - ((L.minZ + L.maxZ) / 2) * k;
    const px = (x) => ox + x * k, py = (z) => oy + z * k;

    if (!this.fond) {
      const f = document.createElement("canvas");
      f.width = W; f.height = H;
      const g = f.getContext("2d");
      g.fillStyle = "rgba(8,14,28,0.78)";
      g.fillRect(0, 0, W, H);
      g.fillStyle = "rgba(70,90,124,0.55)";
      g.fillRect(px(L.minX), py(L.minZ), largeur * k, profondeur * k);
      for (const [nom, s] of Object.entries(this.carte.sites || {})) {
        g.fillStyle = nom === "A" ? "rgba(63,168,255,0.16)" : "rgba(255,79,138,0.16)";
        g.fillRect(px(s.minX), py(s.minZ), (s.maxX - s.minX) * k, (s.maxZ - s.minZ) * k);
      }
      for (const m of this.carte.murs2D) {
        g.fillStyle = m.h > 2.5 ? "#c9d6ee" : "#7f8fae";
        g.fillRect(px(m.x), py(m.z), Math.max(1, m.l * k), Math.max(1, m.p * k));
      }
      g.font = "700 13px Orbitron, Arial, sans-serif";
      for (const [nom, s] of Object.entries(this.carte.sites || {})) {
        g.fillStyle = nom === "A" ? "#3fa8ff" : "#ff4f8a";
        g.fillText(nom, px(s.x) - 5, py(s.z) + 5);
      }
      this.fond = f;
    }
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(this.fond, 0, 0);

    // Fumées
    for (const f of e.fumees) {
      ctx.fillStyle = "rgba(200,210,230,0.45)";
      ctx.beginPath();
      ctx.arc(px(f.x), py(f.z), f.rayon * k, 0, Math.PI * 2);
      ctx.fill();
    }
    // Caisses de munitions (deathmatch)
    ctx.fillStyle = "#ffd166";
    for (const m of e.munitions || []) ctx.fillRect(px(m.x) - 3, py(m.z) - 2, 6, 4);
    // Spike
    if (e.spike && (e.spike.etat === "sol" || e.spike.etat === "pose")) {
      ctx.fillStyle = e.spike.etat === "pose" ? "#ff4f5e" : "#ffd166";
      ctx.save();
      ctx.translate(px(e.spike.x), py(e.spike.z));
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }
    // Ennemis entendus/repérés
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
    // Alliés
    for (const a of e.allies) {
      ctx.fillStyle = a.porteSpike ? "#ffd166" : "#5ad8ff";
      ctx.beginPath();
      ctx.arc(px(a.x), py(a.z), 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const b of e.ennemisVus) {
      ctx.fillStyle = "#ff4f5e";
      ctx.beginPath();
      ctx.arc(px(b.x), py(b.z), 3.6, 0, Math.PI * 2);
      ctx.fill();
    }

    const j = e.vue;
    if (j) {
      const x = px(j.x), y = py(j.z);
      const a = -j.lacet - Math.PI / 2;
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
