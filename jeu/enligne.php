<?php
// Mode En ligne de Neon Strike sans serveur Node.js : relais par requêtes HTTP (le jeu interroge ~15 fois par seconde).
// Mêmes messages que jeu/serveur/serveur.js (salon, joueurs, debut, etat, tir, touche, mort, parti, fin, erreur),
// donc la partie en ligne fonctionne pareil. Les salons sont des fichiers JSON dans donnees/ (interdit d'accès web).
//
// POST JSON, en-tête X-Requested-With: neonstrike
//   {"action":"creer", "nom", "carte", "heros"}                 -> {id, jeton, code, messages}
//   {"action":"rejoindre", "code", "nom", "heros"}              -> {id, jeton, code, messages} ou {erreur}
//   {"action":"echange", "code", "id", "jeton", "envois":[...]} -> {messages, etats} ou {ferme: true}
require __DIR__ . "/../comptes.php";
require __DIR__ . "/anticheat.php";

header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");
header("X-Content-Type-Options: nosniff");

const MAX_JOUEURS = 8;
const OBJECTIF = 20;
const CARTES = ["nexus", "bazar", "hangar"];
const LETTRES = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ABSENCE_MAX = 10.0;      // secondes sans requête : le joueur est retiré du salon
const FILE_MAX = 300;          // messages en attente par joueur
const DOSSIER_SALONS = DOSSIER_DONNEES . "/salons_enligne";
const VERSION_JEU = 2;          // version du protocole exigée (horodatage des messages pour l'anti-triche)

function repondre(array $donnees, int $code = 200): void {
    http_response_code($code);
    echo json_encode($donnees, JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER["REQUEST_METHOD"] ?? "") !== "POST" || ($_SERVER["HTTP_X_REQUESTED_WITH"] ?? "") !== "neonstrike") {
    repondre(["erreur" => "Requête refusée."], 403);
}
$brut = file_get_contents("php://input", false, null, 0, 65536);
$m = json_decode((string) $brut, true);
if (!is_array($m)) { repondre(["erreur" => "Requête invalide."], 400); }

function nettoyer($s, int $max): string {
    return mb_substr(trim(preg_replace('/[<>&"\'`\\\\]/u', "", (string) $s) ?? ""), 0, $max);
}
function nombre($v, float $min, float $max): float {
    return is_numeric($v) ? max($min, min($max, (float) $v)) : 0.0;
}
function herosValide($h): string {
    return is_string($h) && preg_match('/^[a-z]{2,12}$/', $h) ? $h : "kael";
}
function codeValide($c): string {
    $c = strtoupper(nettoyer($c, 4));
    return preg_match('/^[A-Z2-9]{4}$/', $c) ? $c : "";
}

// ----- Salons (un fichier par salon, verrouillé pendant chaque requête) -----
function ouvrirSalon(string $code, bool $creer) {
    preparerDossierDonnees();
    if (!is_dir(DOSSIER_SALONS)) { mkdir(DOSSIER_SALONS, 0750, true); }
    $chemin = DOSSIER_SALONS . "/" . $code . ".json";
    if (!$creer && !is_file($chemin)) { return null; }
    $f = @fopen($chemin, $creer ? "c+" : "r+");
    if (!$f) { return null; }
    flock($f, LOCK_EX);
    return $f;
}
function lireSalon($f): ?array {
    rewind($f);
    $s = json_decode((string) stream_get_contents($f), true);
    return is_array($s) && isset($s["joueurs"]) ? $s : null;
}
function fermerSalon($f, ?array $s, string $code): void {
    if ($s === null || !$s["joueurs"]) {
        ftruncate($f, 0);
        flock($f, LOCK_UN);
        fclose($f);
        @unlink(DOSSIER_SALONS . "/" . $code . ".json");
        return;
    }
    rewind($f);
    ftruncate($f, 0);
    fwrite($f, json_encode($s, JSON_UNESCAPED_UNICODE));
    fflush($f);
    flock($f, LOCK_UN);
    fclose($f);
}
function nettoyerVieuxSalons(): void {
    foreach (glob(DOSSIER_SALONS . "/*.json") ?: [] as $fichier) {
        if (filemtime($fichier) < time() - 3600) { @unlink($fichier); }
    }
}

function listeJoueurs(array $s): array {
    $l = [];
    foreach ($s["joueurs"] as $id => $j) {
        $l[] = ["id" => (string) $id, "nom" => $j["nom"], "palette" => $j["palette"], "heros" => $j["heros"], "hote" => (string) $id === $s["hote"]];
    }
    return $l;
}
function envoyerA(array &$s, string $id, array $msg): void {
    if (!isset($s["joueurs"][$id])) { return; }
    $s["joueurs"][$id]["file"][] = $msg;
    if (count($s["joueurs"][$id]["file"]) > FILE_MAX) { array_shift($s["joueurs"][$id]["file"]); }
}
function diffuser(array &$s, array $msg, ?string $sauf = null): void {
    foreach (array_keys($s["joueurs"]) as $id) {
        if ((string) $id !== $sauf) { envoyerA($s, (string) $id, $msg); }
    }
}
function entrer(array &$s, string $id, string $nom, string $heros): string {
    $prises = array_column($s["joueurs"], "palette");
    $palette = 0;
    foreach ([7, 8, 9, 10, 11, 0, 3, 4] as $p) { if (!in_array($p, $prises, true)) { $palette = $p; break; } }
    $jeton = bin2hex(random_bytes(16));
    $s["joueurs"][$id] = ["nom" => $nom, "palette" => $palette, "heros" => $heros, "jeton" => hash("sha256", $jeton),
        "vu" => microtime(true), "lu" => 0.0, "etat" => null, "etat_t" => 0.0, "file" => [], "ac" => acNouveau(), "empreinte" => acEmpreinte()];
    $s["scores"][$id] = $s["scores"][$id] ?? ["kills" => 0, "morts" => 0];
    envoyerA($s, $id, ["t" => "salon", "code" => $s["code"], "id" => $id, "carte" => $s["carte"], "hote" => $s["hote"] === $id, "joueurs" => listeJoueurs($s)]);
    diffuser($s, ["t" => "joueurs", "joueurs" => listeJoueurs($s)]);
    if ($s["etat"] === "jeu") {
        envoyerA($s, $id, ["t" => "debut", "carte" => $s["carte"], "objectif" => OBJECTIF, "scores" => (object) $s["scores"], "joueurs" => listeJoueurs($s)]);
    }
    return $jeton;
}
function quitter(array &$s, string $id): void {
    if (!isset($s["joueurs"][$id])) { return; }
    unset($s["joueurs"][$id], $s["scores"][$id]);
    if (!$s["joueurs"]) { return; }
    if ($s["hote"] === $id) { $s["hote"] = (string) array_key_first($s["joueurs"]); }
    diffuser($s, ["t" => "parti", "id" => $id]);
    diffuser($s, ["t" => "joueurs", "joueurs" => listeJoueurs($s)]);
}
function retirerAbsents(array &$s): void {
    $limite = microtime(true) - ABSENCE_MAX;
    foreach ($s["joueurs"] as $id => $j) {
        if ($j["vu"] < $limite) { quitter($s, (string) $id); }
    }
}
function nouvelIdJoueur(array $s): string {
    do { $id = "p" . bin2hex(random_bytes(4)); } while (isset($s["joueurs"][$id]));
    return $id;
}
// Réponse à une entrée dans un salon : les messages en attente du joueur (dont "salon")
function reponseEntree(array &$s, string $id, string $jeton): array {
    $messages = $s["joueurs"][$id]["file"];
    $s["joueurs"][$id]["file"] = [];
    return ["id" => $id, "jeton" => $jeton, "code" => $s["code"], "messages" => $messages];
}

// ----- Messages du jeu (mêmes règles que le serveur Node.js) -----
function traiter(array &$s, string $id, array $m): void {
    $t = $m["t"] ?? "";
    switch ($t) {
        case "lancer":
            if ($s["hote"] !== $id) { break; }
            if (in_array($m["carte"] ?? "", CARTES, true)) { $s["carte"] = $m["carte"]; }
            $s["etat"] = "jeu";
            foreach (array_keys($s["scores"]) as $k) { $s["scores"][$k] = ["kills" => 0, "morts" => 0]; }
            // Nouvelle partie : tout le monde réapparaît, les statistiques de l'anti-triche repartent de zéro (pas les points)
            foreach (array_keys($s["joueurs"]) as $k) {
                $points = $s["joueurs"][$k]["ac"]["points"] ?? 0;
                $s["joueurs"][$k]["ac"] = acNouveau();
                $s["joueurs"][$k]["ac"]["points"] = $points;
                $s["joueurs"][$k]["etat"] = null;
            }
            diffuser($s, ["t" => "debut", "carte" => $s["carte"], "objectif" => OBJECTIF, "scores" => (object) $s["scores"], "joueurs" => listeJoueurs($s)]);
            break;
        case "etat":
            $etat = [
                "t" => "etat", "id" => $id, "x" => nombre($m["x"] ?? 0, -200, 200), "y" => nombre($m["y"] ?? 0, -10, 50), "z" => nombre($m["z"] ?? 0, -200, 200),
                "l" => nombre($m["l"] ?? 0, -1e4, 1e4), "g" => nombre($m["g"] ?? 0, -2, 2), "a" => nettoyer($m["a"] ?? "", 10), "v" => empty($m["v"]) ? 0 : 1,
                "s" => nombre($m["s"] ?? 0, 0, 30), "c" => empty($m["c"]) ? 0 : 1,
            ];
            if (!acEtat($s, $id, $etat, $m["h"] ?? null) || !isset($s["joueurs"][$id])) { break; }
            $s["joueurs"][$id]["etat"] = $etat;
            $s["joueurs"][$id]["etat_t"] = microtime(true);
            break;
        case "tir":
            if (!is_array($m["o"] ?? null) || !is_array($m["f"] ?? null)) { break; }
            $vec = fn($v) => array_pad(array_map(fn($x) => nombre($x, -300, 300), array_slice(array_values($v), 0, 3)), 3, 0.0);
            $tir = ["t" => "tir", "id" => $id, "o" => $vec($m["o"]), "f" => $vec($m["f"]), "a" => nettoyer($m["a"] ?? "", 10)];
            if (!acTir($s, $id, $tir + ["h" => $m["h"] ?? null])) { break; }
            diffuser($s, $tir, $id);
            break;
        case "touche":
            $cible = (string) ($m["cible"] ?? "");
            if ($cible === $id || !isset($s["joueurs"][$cible])) { break; }
            $touche = ["degats" => is_numeric($m["degats"] ?? null) ? max(0.0, (float) $m["degats"]) : 0.0, "tete" => !empty($m["tete"]), "arme" => nettoyer($m["arme"] ?? "", 10), "h" => $m["h"] ?? null];
            $degats = acTouche($s, $id, $cible, $touche);
            if ($degats !== null && isset($s["joueurs"][$cible])) {
                envoyerA($s, $cible, ["t" => "touche", "de" => $id, "degats" => $degats, "tete" => $touche["tete"], "arme" => $touche["arme"]]);
            }
            break;
        case "mort":
            if ($s["etat"] !== "jeu") { break; }
            $tueur = (string) ($m["tueur"] ?? "");
            $tueur = ($tueur !== "" && $tueur !== $id && isset($s["joueurs"][$tueur])) ? $tueur : null;
            $tueur = acMort($s, $id, $tueur);
            $s["scores"][$id]["morts"]++;
            if ($tueur) { $s["scores"][$tueur]["kills"]++; }
            diffuser($s, ["t" => "mort", "victime" => $id, "tueur" => $tueur, "tete" => !empty($m["tete"]), "arme" => nettoyer($m["arme"] ?? "", 10), "scores" => (object) $s["scores"]]);
            if ($tueur && $s["scores"][$tueur]["kills"] >= OBJECTIF) {
                $s["etat"] = "attente";
                diffuser($s, ["t" => "fin", "gagnant" => $tueur, "scores" => (object) $s["scores"]]);
            }
            break;
        case "quitter":
            quitter($s, $id);
            break;
    }
}

// ----- Actions -----
$action = $m["action"] ?? "";
$nom = nettoyer($m["nom"] ?? "", 16) ?: "Joueur";

if (($action === "creer" || $action === "rejoindre") && (int) ($m["v"] ?? 0) < VERSION_JEU) {
    repondre(["erreur" => "Ton jeu n'est pas à jour : recharge la page (Ctrl + F5)."]);
}
if (($action === "creer" || $action === "rejoindre") && acBanni(acEmpreinte())) {
    repondre(["erreur" => "Tu es exclu du mode en ligne pendant 15 minutes : triche détectée."]);
}

if ($action === "creer") {
    preparerDossierDonnees();
    if (!is_dir(DOSSIER_SALONS)) { mkdir(DOSSIER_SALONS, 0750, true); }
    nettoyerVieuxSalons();
    if (count(glob(DOSSIER_SALONS . "/*.json") ?: []) >= 200) { repondre(["erreur" => "Trop de salons ouverts, réessaie dans un moment."], 503); }
    for ($essai = 0; $essai < 50; $essai++) {
        $code = "";
        for ($i = 0; $i < 4; $i++) { $code .= LETTRES[random_int(0, strlen(LETTRES) - 1)]; }
        if (!is_file(DOSSIER_SALONS . "/" . $code . ".json")) { break; }
    }
    $f = ouvrirSalon($code, true);
    if (!$f) { repondre(["erreur" => "Impossible de créer le salon."], 500); }
    $s = ["code" => $code, "carte" => in_array($m["carte"] ?? "", CARTES, true) ? $m["carte"] : "nexus", "hote" => "", "etat" => "attente", "scores" => [], "joueurs" => []];
    $id = nouvelIdJoueur($s);
    $s["hote"] = $id;
    $jeton = entrer($s, $id, $nom, herosValide($m["heros"] ?? ""));
    $r = reponseEntree($s, $id, $jeton);
    fermerSalon($f, $s, $code);
    repondre($r);
}

if ($action === "rejoindre") {
    $code = codeValide($m["code"] ?? "");
    $f = $code !== "" ? ouvrirSalon($code, false) : null;
    $s = $f ? lireSalon($f) : null;
    if ($s) { retirerAbsents($s); }
    if (!$s || !$s["joueurs"]) {
        if ($f) { fermerSalon($f, $s, $code); }
        repondre(["erreur" => "Aucun salon avec ce code."]);
    }
    if (isset($s["bannis"][acEmpreinte()])) {
        fermerSalon($f, $s, $code);
        repondre(["erreur" => "Tu as été exclu de ce salon pour triche."]);
    }
    if (count($s["joueurs"]) >= MAX_JOUEURS) {
        fermerSalon($f, $s, $code);
        repondre(["erreur" => "Salon complet (8 joueurs)."]);
    }
    $id = nouvelIdJoueur($s);
    $jeton = entrer($s, $id, $nom, herosValide($m["heros"] ?? ""));
    $r = reponseEntree($s, $id, $jeton);
    fermerSalon($f, $s, $code);
    repondre($r);
}

if ($action === "echange") {
    $code = codeValide($m["code"] ?? "");
    $id = (string) ($m["id"] ?? "");
    $f = $code !== "" ? ouvrirSalon($code, false) : null;
    $s = $f ? lireSalon($f) : null;
    $jetonRecu = hash("sha256", (string) ($m["jeton"] ?? ""));
    if (!$s || !isset($s["joueurs"][$id]) || !hash_equals($s["joueurs"][$id]["jeton"], $jetonRecu)) {
        if ($f) { flock($f, LOCK_UN); fclose($f); }
        $exclu = $s["exclus"][$id] ?? null;
        repondre(["ferme" => true] + (is_array($exclu) && hash_equals($exclu["jeton"], $jetonRecu) ? ["exclu" => $exclu["raison"]] : []));
    }
    $maintenant = microtime(true);
    $s["joueurs"][$id]["vu"] = $maintenant;
    $envois = is_array($m["envois"] ?? null) ? array_slice($m["envois"], 0, 60) : [];
    foreach ($envois as $e) {
        if (is_array($e) && isset($s["joueurs"][$id])) { traiter($s, $id, $e); }
    }
    retirerAbsents($s);
    if (!isset($s["joueurs"][$id])) {
        $exclu = $s["exclus"][$id]["raison"] ?? null;
        fermerSalon($f, $s, $code);
        repondre(["ferme" => true] + ($exclu ? ["exclu" => $exclu] : []));
    }
    // Positions des autres joueurs mises à jour depuis ma dernière requête
    $lu = $s["joueurs"][$id]["lu"];
    $etats = [];
    foreach ($s["joueurs"] as $autre => $j) {
        if ((string) $autre !== $id && $j["etat"] !== null && $j["etat_t"] > $lu) { $etats[] = $j["etat"]; }
    }
    $s["joueurs"][$id]["lu"] = $maintenant;
    $messages = $s["joueurs"][$id]["file"];
    $s["joueurs"][$id]["file"] = [];
    fermerSalon($f, $s, $code);
    repondre(["messages" => $messages, "etats" => $etats]);
}

repondre(["erreur" => "Action inconnue."], 400);
