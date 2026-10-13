// Commandes unifiées : clavier + souris (touches modifiables), manette (Xbox / PlayStation, mappage standard)
// et écran tactile. Toutes produisent le même objet "cmd" (déplacement, tir, visée...) et une file d'actions ponctuelles.

const ZONE_MORTE = 0.18;
const CLE_TOUCHES = "neonstrike-touches";
const CLE_LIBELLES = "neonstrike-libelles";

// Actions du jeu : [identifiant, nom affiché, "maintien" (gardée enfoncée) ou "appui" (une fois), touches par défaut]
// Les touches sont des positions physiques : KeyW = Z sur un clavier AZERTY.
export const ACTIONS = [
  ["avancer", "Avancer", "maintien", ["KeyW", "ArrowUp"]],
  ["reculer", "Reculer", "maintien", ["KeyS", "ArrowDown"]],
  ["gauche", "Aller à gauche", "maintien", ["KeyA", "ArrowLeft"]],
  ["droite", "Aller à droite", "maintien", ["KeyD", "ArrowRight"]],
  ["saut", "Sauter", "maintien", ["Space"]],
  ["sprint", "Courir", "maintien", ["ShiftLeft"]],
  ["accroupi", "S'accroupir", "maintien", ["ControlLeft"]],
  ["tir", "Tirer", "maintien", ["Souris0"]],
  ["viser", "Viser / coup lourd au couteau", "maintien", ["Souris2"]],
  ["recharger", "Recharger", "appui", ["KeyR"]],
  ["arme1", "Arme principale", "appui", ["Digit1"]],
  ["arme2", "Pistolet", "appui", ["Digit2"]],
  ["arme3", "Couteau", "appui", ["Digit3"]],
  ["armeSuivante", "Arme suivante", "appui", ["MoletteBas"]],
  ["armePrecedente", "Arme précédente", "appui", ["MoletteHaut"]],
  ["fumee", "Fumée", "appui", ["KeyC"]],
  ["flash", "Flash", "appui", ["KeyQ"]],
  ["signature", "Compétence signature (agent)", "appui", ["KeyE"]],
  ["ultime", "Ultime", "appui", ["KeyX"]],
  ["interagir", "Poser / désamorcer le spike (maintenir)", "maintien", ["KeyF"]],
  ["lacher", "Lâcher le spike", "appui", ["KeyG"]],
  ["boutique", "Boutique", "appui", ["KeyB"]],
  ["ordres", "Ordres aux coéquipiers", "appui", ["KeyV"]],
  ["tableau", "Tableau des scores (maintenir)", "maintien", ["Tab"]],
  ["inspecter", "Inspecter l'arme", "appui", ["KeyY"]],
  ["pause", "Pause (Échap marche toujours)", "appui", ["KeyP"]],
];

// Libellés AZERTY par défaut (le jeu utilise la position physique des touches)
const AZERTY = { KeyQ: "A", KeyW: "Z", KeyA: "Q", KeyZ: "W", KeyM: ",", Semicolon: "M" };
const NOMS = {
  Space: "Espace", ShiftLeft: "Maj", ShiftRight: "Maj droite", ControlLeft: "Ctrl", ControlRight: "Ctrl droit", AltLeft: "Alt", AltRight: "Alt Gr",
  Escape: "Échap", Tab: "Tab", CapsLock: "Verr. Maj", Enter: "Entrée", Backspace: "Retour arrière", Delete: "Suppr", Insert: "Inser",
  Home: "Début", End: "Fin", PageUp: "Page ↑", PageDown: "Page ↓", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
  Souris0: "Clic gauche", Souris1: "Clic molette", Souris2: "Clic droit", Souris3: "Souris 4", Souris4: "Souris 5",
  MoletteHaut: "Molette ↑", MoletteBas: "Molette ↓", NumpadEnter: "Entrée (pavé)",
};

export class Controles {
  constructor(canvas) {
    this.canvas = canvas;
    this.cmd = { avant: 0, cote: 0, sprint: false, accroupi: false, saut: false, tir: false, viser: false, interagir: false, tableau: false };
    this.regard = { dx: 0, dy: 0 };     // pixels de souris équivalents, consommés à chaque image
    this.actions = [];                   // actions ponctuelles ("recharger", "arme1", "fumee"...)
    this.touches = {};
    this.manetteActive = false;
    this.tactileActif = false;
    this.disposition = null;
    this.carteTouches = null;
    this.enJeu = () => false;
    this.surDisposition = null;
    this.precedentManette = [];
    this.sensibiliteManette = 1;
    this.tactile = { joystick: null, regard: null, boutons: new Map() };
    this.libelles = {};
    try { this.libelles = JSON.parse(localStorage.getItem(CLE_LIBELLES) || "{}") || {}; } catch (e) { /* stockage indisponible */ }
    this.chargerLiaisons();
    this.chargerDisposition();
  }

  // ----- Touches personnalisées -----
  chargerLiaisons() {
    let sauve = {};
    try { sauve = JSON.parse(localStorage.getItem(CLE_TOUCHES) || "{}") || {}; } catch (e) { /* stockage indisponible */ }
    this.liaisons = {};
    for (const [id, , , defaut] of ACTIONS) this.liaisons[id] = Array.isArray(sauve[id]) ? sauve[id].filter((c) => typeof c === "string").slice(0, 2) : [...defaut];
    this.indexer();
  }

  indexer() {
    this.parCode = new Map();
    for (const [id, codes] of Object.entries(this.liaisons)) for (const c of codes) {
      if (!this.parCode.has(c)) this.parCode.set(c, []);
      this.parCode.get(c).push(id);
    }
  }

  sauverLiaisons() {
    try { localStorage.setItem(CLE_TOUCHES, JSON.stringify(this.liaisons)); } catch (e) { /* stockage indisponible */ }
    this.indexer();
  }

  // Associe une touche à une action (emplacement 0 = principale, 1 = secondaire).
  // Retourne la liste des actions qui utilisaient déjà cette touche (elles la perdent).
  lier(action, emplacement, code) {
    const retirees = [];
    for (const [id, codes] of Object.entries(this.liaisons)) {
      const i = codes.indexOf(code);
      if (i >= 0 && !(id === action && i === emplacement)) { codes.splice(i, 1); retirees.push(id); }
    }
    const codes = this.liaisons[action];
    if (emplacement < codes.length) codes[emplacement] = code;
    else codes.push(code);
    this.liaisons[action] = [...new Set(codes)].slice(0, 2);
    this.sauverLiaisons();
    return retirees;
  }

  effacer(action, emplacement) {
    this.liaisons[action].splice(emplacement, 1);
    this.sauverLiaisons();
  }

  reinitialiserLiaisons() {
    for (const [id, , , defaut] of ACTIONS) this.liaisons[id] = [...defaut];
    this.sauverLiaisons();
  }

  estLiee(code) { return this.parCode.has(code); }

  // Libellé de la touche principale d'une action (pour l'interface)
  etiquetteAction(action) {
    const codes = this.liaisons[action] || [];
    return codes.length ? this.etiquette(codes[0]) : "—";
  }

  // Une action "maintien" est-elle active (une de ses touches est enfoncée) ?
  actif(action) {
    for (const c of this.liaisons[action] || []) if (this.touches[c]) return true;
    return false;
  }

  // Une touche (ou un bouton de souris) vient d'être enfoncée
  presser(code) {
    if (code === "Escape") { this.action("pause"); return; }
    const deja = this.touches[code];
    this.touches[code] = true;
    if (deja) return;
    for (const id of this.parCode.get(code) || []) this.action(id);
    const chiffre = /^(Digit|Numpad)([1-5])$/.exec(code);
    if (chiffre) this.action("chiffre" + chiffre[2]);
  }

  relacherCode(code) { this.touches[code] = false; }

  async chargerDisposition() {
    try {
      const d = localStorage.getItem("neonstrike-clavier");
      if (d) this.disposition = d;
    } catch (e) { /* stockage indisponible */ }
    try {
      if (navigator.keyboard && navigator.keyboard.getLayoutMap) this.carteTouches = await navigator.keyboard.getLayoutMap();
    } catch (e) { /* non disponible */ }
    if (this.surDisposition) this.surDisposition();
  }

  // Texte affiché pour une touche physique (ou un bouton de souris)
  etiquette(code) {
    if (!code) return "—";
    if (NOMS[code]) return NOMS[code];
    const chiffre = /^Digit(\d)$/.exec(code);
    if (chiffre) return chiffre[1];
    const pave = /^Numpad(.+)$/.exec(code);
    if (pave) return "Pavé " + pave[1].replace("Add", "+").replace("Subtract", "−").replace("Multiply", "×").replace("Divide", "÷").replace("Decimal", ".");
    if (this.carteTouches && this.carteTouches.get(code)) return this.carteTouches.get(code).toUpperCase();
    if (this.libelles[code]) return this.libelles[code];
    if (this.disposition !== "qwerty" && AZERTY[code]) return AZERTY[code];
    if (code.startsWith("Key")) return code.slice(3);
    if (/^F\d+$/.test(code)) return code;
    return code;
  }

  // Devine la disposition du clavier d'après la lettre produite
  apprendre(e) {
    if (e.code && e.key && e.key.length === 1 && e.key !== " " && this.libelles[e.code] !== e.key.toUpperCase()) {
      this.libelles[e.code] = e.key.toUpperCase();
      try { localStorage.setItem(CLE_LIBELLES, JSON.stringify(this.libelles)); } catch (err) { /* stockage indisponible */ }
    }
    if (e.code === "KeyQ" && e.key && e.key.length === 1) {
      const d = e.key.toLowerCase() === "a" ? "azerty" : e.key.toLowerCase() === "q" ? "qwerty" : null;
      if (d && d !== this.disposition) {
        this.disposition = d;
        try { localStorage.setItem("neonstrike-clavier", d); } catch (err) { /* stockage indisponible */ }
        if (this.surDisposition) this.surDisposition();
      }
    }
  }

  action(nom) { this.actions.push(nom); }
  prendreActions() { const a = this.actions; this.actions = []; return a; }
  prendreRegard() { const r = { dx: this.regard.dx, dy: this.regard.dy }; this.regard.dx = this.regard.dy = 0; return r; }

  relacher() {
    for (const k in this.touches) this.touches[k] = false;
    this.tactile.joystick = null;
    this.tactile.regard = null;
    for (const b of this.tactile.boutons.values()) b.presse = false;
  }

  // ----- Clavier, souris et molette -----
  clavierBas(e) {
    this.apprendre(e);
    this.presser(e.code);
  }

  clavierHaut(e) { this.relacherCode(e.code); }

  sourisBas(bouton) { this.presser("Souris" + bouton); }
  sourisHaut(bouton) { this.relacherCode("Souris" + bouton); }

  molette(e) {
    const code = e.deltaY > 0 ? "MoletteBas" : "MoletteHaut";
    this.presser(code);
    this.relacherCode(code);
  }

  // ----- Manette (API Gamepad) -----
  manette(dt, reglages) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let p = null;
    for (const g of pads) if (g && g.connected) { p = g; break; }
    if (!p) { if (this.manetteActive) { this.manetteActive = false; this.etatManette = null; } return null; }
    const b = (i) => p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.4);
    const prec = this.precedentManette;
    const appui = (i) => b(i) && !prec[i];
    const axe = (v) => (Math.abs(v) < ZONE_MORTE ? 0 : Math.sign(v) * (Math.abs(v) - ZONE_MORTE) / (1 - ZONE_MORTE));
    const lx = axe(p.axes[0] || 0), ly = axe(p.axes[1] || 0), rx = axe(p.axes[2] || 0), ry = axe(p.axes[3] || 0);
    const utilise = lx || ly || rx || ry || p.buttons.some((x) => x.pressed);
    if (utilise) this.manetteActive = true;
    const etat = { lx, ly, rx, ry, a: b(0), haut: appui(12), bas: appui(13), gauche: appui(14), droite: appui(15), valider: appui(0), retour: appui(1), start: appui(9) };
    if (this.enJeu()) {
      // Regard : courbe progressive (précis au centre, rapide en bout de course)
      const vitesse = 900 * (reglages.sensibiliteManette || 1);
      this.regard.dx += Math.sign(rx) * rx * rx * vitesse * dt;
      this.regard.dy += Math.sign(ry) * ry * ry * vitesse * dt * 0.75;
      this.manetteCmd = { avant: -ly, cote: lx, sprint: b(10) || (this.sprintManette && -ly > 0.5), accroupi: b(1), saut: b(0), tir: b(7), viser: b(6), interagir: b(2) };
      if (appui(10)) this.sprintManette = !this.sprintManette;
      if (-ly < 0.3) this.sprintManette = false;
      if (appui(2)) this.action("recharger");
      if (appui(3)) this.action("armeSuivante");
      if (appui(4)) this.action("flash");
      if (appui(5)) this.action("fumee");
      if (appui(11)) this.action("arme3");
      if (appui(12)) this.action("signature");
      if (appui(13)) this.action("ultime");
      if (appui(14)) this.action("ordres");
      if (appui(15)) this.action("inspecter");
      if (appui(8)) this.action("boutique");
      if (appui(9)) this.action("pause");
    } else this.manetteCmd = null;
    this.precedentManette = p.buttons.map((x) => x.pressed || x.value > 0.4);
    return etat;
  }

  // ----- Écran tactile -----
  installerTactile(racine) {
    this.racineTactile = racine;
    const zone = racine.querySelector(".zone-tactile");
    zone.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
      e.preventDefault();
      this.tactileActif = true;
      if (e.clientX < innerWidth * 0.42 && !this.tactile.joystick) {
        this.tactile.joystick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
        this.dessinerJoystick();
      } else if (!this.tactile.regard) {
        this.tactile.regard = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }
      zone.setPointerCapture(e.pointerId);
    });
    zone.addEventListener("pointermove", (e) => {
      const j = this.tactile.joystick, r = this.tactile.regard;
      if (j && e.pointerId === j.id) { j.x = e.clientX; j.y = e.clientY; this.dessinerJoystick(); }
      if (r && e.pointerId === r.id) { this.regard.dx += (e.clientX - r.x) * 1.6; this.regard.dy += (e.clientY - r.y) * 1.6; r.x = e.clientX; r.y = e.clientY; }
    });
    const fin = (e) => {
      if (this.tactile.joystick && e.pointerId === this.tactile.joystick.id) { this.tactile.joystick = null; this.dessinerJoystick(); }
      if (this.tactile.regard && e.pointerId === this.tactile.regard.id) this.tactile.regard = null;
    };
    zone.addEventListener("pointerup", fin);
    zone.addEventListener("pointercancel", fin);

    // Boutons : maintenus (tir, visée...) ou ponctuels (recharger, compétences...)
    for (const el of racine.querySelectorAll("[data-tactile]")) {
      const nom = el.dataset.tactile;
      const etat = { presse: false, id: null, x: 0, y: 0 };
      this.tactile.boutons.set(nom, etat);
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.tactileActif = true;
        etat.presse = true; etat.id = e.pointerId; etat.x = e.clientX; etat.y = e.clientY;
        el.classList.add("presse");
        el.setPointerCapture(e.pointerId);
        if (el.dataset.action) this.action(el.dataset.action);
      });
      // Glisser depuis le bouton de tir oriente aussi la vue (comme sur les FPS mobiles)
      el.addEventListener("pointermove", (e) => {
        if (!etat.presse || e.pointerId !== etat.id || nom !== "tir") return;
        this.regard.dx += (e.clientX - etat.x) * 1.6; this.regard.dy += (e.clientY - etat.y) * 1.6;
        etat.x = e.clientX; etat.y = e.clientY;
      });
      const relache = (e) => { if (e.pointerId === etat.id) { etat.presse = false; el.classList.remove("presse"); } };
      el.addEventListener("pointerup", relache);
      el.addEventListener("pointercancel", relache);
    }
  }

  dessinerJoystick() {
    const base = this.racineTactile && this.racineTactile.querySelector(".joystick");
    if (!base) return;
    const j = this.tactile.joystick;
    base.classList.toggle("visible", !!j);
    if (!j) return;
    base.style.left = j.x0 + "px";
    base.style.top = j.y0 + "px";
    const dx = j.x - j.x0, dy = j.y - j.y0, d = Math.hypot(dx, dy), max = 56;
    const k = d > max ? max / d : 1;
    base.querySelector("i").style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  }

  // ----- Synthèse : la commande finale, à chaque image -----
  maj(dt, reglages) {
    const etatManette = this.manette(dt, reglages);
    const c = this.cmd;
    const a = (id) => this.actif(id);
    c.avant = (a("avancer") ? 1 : 0) - (a("reculer") ? 1 : 0);
    c.cote = (a("droite") ? 1 : 0) - (a("gauche") ? 1 : 0);
    c.sprint = a("sprint");
    c.accroupi = a("accroupi");
    c.saut = a("saut");
    c.tir = a("tir");
    c.viser = a("viser");
    c.interagir = a("interagir");
    c.tableau = a("tableau");
    const m = this.manetteCmd;
    if (m) {
      if (Math.abs(m.avant) > Math.abs(c.avant)) c.avant = m.avant;
      if (Math.abs(m.cote) > Math.abs(c.cote)) c.cote = m.cote;
      c.sprint ||= m.sprint; c.accroupi ||= m.accroupi; c.saut ||= m.saut; c.tir ||= m.tir; c.viser ||= m.viser; c.interagir ||= m.interagir;
    }
    if (this.tactileActif) {
      const j = this.tactile.joystick;
      if (j) {
        const dx = j.x - j.x0, dy = j.y - j.y0, d = Math.hypot(dx, dy);
        if (d > 8) {
          const k = Math.min(1, d / 56);
          c.avant = -dy / d * k;
          c.cote = dx / d * k;
          c.sprint = d > 80;
        }
      }
      const b = (n) => this.tactile.boutons.get(n) && this.tactile.boutons.get(n).presse;
      c.tir ||= b("tir"); c.viser ||= b("viser"); c.saut ||= b("saut"); c.accroupi ||= b("accroupi"); c.interagir ||= b("interagir");
    }
    return etatManette;
  }
}
