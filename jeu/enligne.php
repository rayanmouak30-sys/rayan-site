<?php
// Mode En ligne de Neon Strike sans serveur Node.js : relais par requêtes HTTP (le jeu interroge ~15 fois par seconde).
// Mêmes messages que jeu/serveur/serveur.js, donc la partie en ligne fonctionne pareil. Les salons sont des fichiers
// JSON dans donnees/ (interdit d'accès web).
//
// Modes : "ffa" (chacun pour soi), "equipes" (bleus contre rouges, complétés par des bots), "coop" (les joueurs
// ensemble contre des bots). Les bots tournent chez l'hôte (intelligence, tirs) : il envoie leur position ("bots"),
// leurs tirs et leurs touches. Les tirs sur un bot sont transmis à l'hôte.
//
// POST JSON, en-tête X-Requested-With: neonstrike
//   {"action":"creer", "v", "nom", "carte", "heros"}                 -> {id, jeton, code, messages}
//   {"action":"rejoindre", "v", "code", "nom", "heros"}              -> {id, jeton, code, messages} ou {erreur}
//   {"action":"echange", "code", "id", "jeton", "envois":[...]}      -> {messages, etats} ou {ferme: true}
require __DIR__ . "/../comptes.php";

header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");
header("X-Content-Type-Options: nosniff");

const MAX_JOUEURS = 8;
const MAX_BOTS = 10;
const OBJECTIFS = ["ffa" => 20, "equipes" => 50, "coop" => 50];
const MODES = ["ffa", "equipes", "coop"];
const DIFFICULTES = ["facile", "normal", "difficile", "expert"];
const CARTES = ["nexus", "bazar", "hangar"];
const LETTRES = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ABSENCE_MAX = 10.0;      // secondes sans requête : le joueur est retiré du salon
const FILE_MAX = 300;          // messages en attente par joueur
const DOSSIER_SALONS = DOSSIER_DONNEES . "/salons_enligne";
const VERSION_JEU = 3;         // version du protocole exigée (bots en ligne)

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
function idBot($b): string {
    return is_string($b) && preg_match('/^b\d{1,4}$/', $b) ? $b : "";
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
    if ($s === null || !humains($s)) {
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

// Les bots de l'hôte sont rangés avec les joueurs, marqués "bot"
function estBot(array $s, string $id): bool { return !empty($s["joueurs"][$id]["bot"]); }
function humains(array $s): array {
    return array_values(array_map("strval", array_keys(array_filter($s["joueurs"], fn($j) => empty($j["bot"])))));
}
function equipeDe(array $s, string $id): string { return (string) ($s["joueurs"][$id]["equipe"] ?? ""); }
function config(array $s): array {
    return ["mode" => $s["mode"], "bots" => $s["nb_bots"], "difficulte" => $s["difficulte"], "carte" => $s["carte"]];
}
function listeJoueurs(array $s): array {
    $l = [];
    foreach (humains($s) as $id) {
        $j = $s["joueurs"][$id];
        $l[] = ["id" => $id, "nom" => $j["nom"], "palette" => $j["palette"], "heros" => $j["heros"], "hote" => $id === $s["hote"], "equipe" => $j["equipe"]];
    }
    return $l;
}
function envoyerA(array &$s, string $id, array $msg): void {
    if (!isset($s["joueurs"][$id]) || estBot($s, $id)) { return; }
    $s["joueurs"][$id]["file"][] = $msg;
    if (count($s["joueurs"][$id]["file"]) > FILE_MAX) { array_shift($s["joueurs"][$id]["file"]); }
}
function diffuser(array &$s, array $msg, ?string $sauf = null): void {
    foreach (humains($s) as $id) {
        if ($id !== $sauf) { envoyerA($s, $id, $msg); }
    }
}
function diffuserJoueurs(array &$s): void {
    diffuser($s, ["t" => "joueurs", "joueurs" => listeJoueurs($s), "config" => config($s)]);
}
// Équipe la moins nombreuse (en mode équipes)
function equipeLibre(array $s): string {
    $n = ["bleu" => 0, "rouge" => 0];
    foreach (humains($s) as $id) { if (isset($n[equipeDe($s, $id)])) { $n[equipeDe($s, $id)]++; } }
    return $n["bleu"] <= $n["rouge"] ? "bleu" : "rouge";
}
function scoresEquipes(array $s): array {
    $t = ["bleu" => 0, "rouge" => 0];
    foreach ($s["scores"] as $id => $sc) {
        $e = $s["equipes_partie"][(string) $id] ?? "";
        if (isset($t[$e])) { $t[$e] += $sc["kills"]; }
    }
    return $t;
}
function messageDebut(array $s): array {
    return ["t" => "debut", "carte" => $s["carte"], "mode" => $s["mode"], "bots" => $s["nb_bots"], "difficulte" => $s["difficulte"],
        "objectif" => OBJECTIFS[$s["mode"]], "hote" => $s["hote"], "scores" => (object) $s["scores"], "equipes" => scoresEquipes($s), "joueurs" => listeJoueurs($s)];
}

function entrer(array &$s, string $id, string $nom, string $heros): string {
    $prises = array_column($s["joueurs"], "palette");
    $palette = 0;
    foreach ([7, 8, 9, 10, 11, 0, 3, 4] as $p) { if (!in_array($p, $prises, true)) { $palette = $p; break; } }
    $jeton = bin2hex(random_bytes(16));
    $s["joueurs"][$id] = ["nom" => $nom, "palette" => $palette, "heros" => $heros, "jeton" => hash("sha256", $jeton), "equipe" => equipeLibre($s),
        "vu" => microtime(true), "lu" => 0.0, "etat" => null, "etat_t" => 0.0, "file" => []];
    if ($s["mode"] === "coop") { $s["joueurs"][$id]["equipe"] = "bleu"; }
    $s["scores"][$id] = $s["scores"][$id] ?? ["kills" => 0, "morts" => 0];
    envoyerA($s, $id, ["t" => "salon", "code" => $s["code"], "id" => $id, "carte" => $s["carte"], "hote" => $s["hote"] === $id, "joueurs" => listeJoueurs($s), "config" => config($s)]);
    diffuserJoueurs($s);
    if ($s["etat"] === "jeu") {
        $s["equipes_partie"][$id] = $s["mode"] === "ffa" ? "" : $s["joueurs"][$id]["equipe"];
        envoyerA($s, $id, messageDebut($s));
    }
    return $jeton;
}
function retirerBots(array &$s, ?string $proprio = null): void {
    foreach (array_keys($s["joueurs"]) as $b) {
        $b = (string) $b;
        if (estBot($s, $b) && ($proprio === null || $s["joueurs"][$b]["proprio"] === $proprio)) {
            unset($s["joueurs"][$b], $s["scores"][$b]);
            diffuser($s, ["t" => "parti", "id" => $b]);
        }
    }
}
function quitter(array &$s, string $id): void {
    if (!isset($s["joueurs"][$id]) || estBot($s, $id)) { return; }
    unset($s["joueurs"][$id], $s["scores"][$id]);
    retirerBots($s, $id);
    if (!humains($s)) { return; }
    if ($s["hote"] === $id) { $s["hote"] = humains($s)[0]; }
    diffuser($s, ["t" => "parti", "id" => $id]);
    diffuserJoueurs($s);
}
function retirerAbsents(array &$s): void {
    $limite = microtime(true) - ABSENCE_MAX;
    foreach (humains($s) as $id) {
        if ($s["joueurs"][$id]["vu"] < $limite) { quitter($s, $id); }
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
// Qui agit : le joueur lui-même, ou un de ses bots (seul l'hôte en a)
function acteur(array $s, string $id, array $m): ?string {
    $b = idBot($m["bot"] ?? null);
    if ($b === "") { return $id; }
    return (isset($s["joueurs"][$b]) && estBot($s, $b) && $s["joueurs"][$b]["proprio"] === $id) ? $b : null;
}
function proprietaire(array $s, string $id): string {
    return estBot($s, $id) ? (string) $s["joueurs"][$id]["proprio"] : $id;
}
function etatValide(array $m, string $id): array {
    return [
        "t" => "etat", "id" => $id, "x" => nombre($m["x"] ?? 0, -200, 200), "y" => nombre($m["y"] ?? 0, -10, 50), "z" => nombre($m["z"] ?? 0, -200, 200),
        "l" => nombre($m["l"] ?? 0, -1e4, 1e4), "g" => nombre($m["g"] ?? 0, -2, 2), "a" => nettoyer($m["a"] ?? "", 10), "v" => empty($m["v"]) ? 0 : 1,
        "s" => nombre($m["s"] ?? 0, 0, 30), "c" => empty($m["c"]) ? 0 : 1,
    ];
}

// ----- Messages du jeu (mêmes règles que le serveur Node.js) -----
function traiter(array &$s, string $id, array $m): void {
    $t = $m["t"] ?? "";
    $hote = $s["hote"] === $id;
    switch ($t) {
        case "config":
            if (!$hote || $s["etat"] === "jeu") { break; }
            if (in_array($m["mode"] ?? "", MODES, true)) { $s["mode"] = $m["mode"]; }
            if (isset($m["bots"])) { $s["nb_bots"] = (int) nombre($m["bots"], 0, MAX_BOTS); }
            if (in_array($m["difficulte"] ?? "", DIFFICULTES, true)) { $s["difficulte"] = $m["difficulte"]; }
            if (in_array($m["carte"] ?? "", CARTES, true)) { $s["carte"] = $m["carte"]; }
            if ($s["mode"] === "coop") { foreach (humains($s) as $k) { $s["joueurs"][$k]["equipe"] = "bleu"; } }
            diffuserJoueurs($s);
            break;
        case "equipe":
            if ($s["etat"] === "jeu" || $s["mode"] !== "equipes") { break; }
            $s["joueurs"][$id]["equipe"] = equipeDe($s, $id) === "bleu" ? "rouge" : "bleu";
            diffuserJoueurs($s);
            break;
        case "lancer":
            if (!$hote) { break; }
            traiter($s, $id, ["t" => "config"] + $m);
            $s["etat"] = "jeu";
            retirerBots($s);
            $s["scores"] = [];
            $s["equipes_partie"] = [];
            // Nouvelle partie : tout le monde réapparaît
            foreach (humains($s) as $k) {
                $s["scores"][$k] = ["kills" => 0, "morts" => 0];
                $s["equipes_partie"][$k] = $s["mode"] === "ffa" ? "" : equipeDe($s, $k);
                $s["joueurs"][$k]["etat"] = null;
            }
            diffuser($s, messageDebut($s));
            break;
        case "etat":
            $etat = etatValide($m, $id);
            $s["joueurs"][$id]["etat"] = $etat;
            $s["joueurs"][$id]["etat_t"] = microtime(true);
            break;
        case "bots":
            // Positions des bots de l'hôte
            if (!$hote || $s["etat"] !== "jeu" || !is_array($m["l"] ?? null)) { break; }
            foreach (array_slice($m["l"], 0, MAX_BOTS) as $e) {
                $b = idBot($e["id"] ?? null);
                if ($b === "" || !is_array($e)) { continue; }
                if (!isset($s["joueurs"][$b])) {
                    if (count(array_filter($s["joueurs"], fn($j) => !empty($j["bot"]))) >= MAX_BOTS) { continue; }
                    $equipe = $s["mode"] === "ffa" ? "" : ((($e["e"] ?? "") === "bleu") ? "bleu" : "rouge");
                    $s["joueurs"][$b] = ["bot" => true, "proprio" => $id, "nom" => nettoyer($e["n"] ?? "Bot", 16) ?: "Bot", "heros" => herosValide($e["hr"] ?? ""),
                        "equipe" => $equipe, "etat" => null, "etat_t" => 0.0];
                    $s["scores"][$b] = $s["scores"][$b] ?? ["kills" => 0, "morts" => 0];
                    $s["equipes_partie"][$b] = $equipe;
                } elseif (!estBot($s, $b) || $s["joueurs"][$b]["proprio"] !== $id) {
                    continue;
                }
                $etat = etatValide($e, $b) + ["n" => $s["joueurs"][$b]["nom"], "hr" => $s["joueurs"][$b]["heros"], "e" => $s["joueurs"][$b]["equipe"]];
                $s["joueurs"][$b]["etat"] = $etat;
                $s["joueurs"][$b]["etat_t"] = microtime(true);
            }
            break;
        case "tir":
            if (!is_array($m["o"] ?? null) || !is_array($m["f"] ?? null)) { break; }
            $qui = acteur($s, $id, $m);
            if ($qui === null) { break; }
            $vec = fn($v) => array_pad(array_map(fn($x) => nombre($x, -300, 300), array_slice(array_values($v), 0, 3)), 3, 0.0);
            $tir = ["t" => "tir", "id" => $qui, "o" => $vec($m["o"]), "f" => $vec($m["f"]), "a" => nettoyer($m["a"] ?? "", 10)];
            diffuser($s, $tir, $id);
            break;
        case "touche":
            // Touche d'un joueur ou d'un bot de l'hôte, sur un joueur ou un bot ; transmise au propriétaire de la cible
            $qui = acteur($s, $id, $m);
            $cible = (string) ($m["cible"] ?? "");
            if ($qui === null || $cible === $qui || !isset($s["joueurs"][$cible])) { break; }
            if ($s["mode"] !== "ffa" && equipeDe($s, $qui) !== "" && equipeDe($s, $qui) === equipeDe($s, $cible)) { break; }   // pas de tir ami
            $touche = ["tete" => !empty($m["tete"]), "arme" => nettoyer($m["arme"] ?? "", 10)];
            $degats = nombre($m["degats"] ?? 0, 0, 400);
            $dest = proprietaire($s, $cible);
            if ($dest !== $id) {
                envoyerA($s, $dest, ["t" => "touche", "de" => $qui, "cible" => $cible, "degats" => $degats, "tete" => $touche["tete"], "arme" => $touche["arme"]]);
            }
            break;
        case "mort":
            if ($s["etat"] !== "jeu") { break; }
            $victime = acteur($s, $id, $m);
            if ($victime === null) { break; }
            $tueur = (string) ($m["tueur"] ?? "");
            $tueur = ($tueur !== "" && $tueur !== $victime && isset($s["joueurs"][$tueur])) ? $tueur : null;
            if ($tueur !== null && $s["mode"] !== "ffa" && equipeDe($s, $tueur) === equipeDe($s, $victime)) { $tueur = null; }
            $s["scores"][$victime] = $s["scores"][$victime] ?? ["kills" => 0, "morts" => 0];
            $s["scores"][$victime]["morts"]++;
            if ($tueur) {
                $s["scores"][$tueur] = $s["scores"][$tueur] ?? ["kills" => 0, "morts" => 0];
                $s["scores"][$tueur]["kills"]++;
            }
            $equipes = scoresEquipes($s);
            diffuser($s, ["t" => "mort", "victime" => $victime, "tueur" => $tueur, "tete" => !empty($m["tete"]), "arme" => nettoyer($m["arme"] ?? "", 10),
                "scores" => (object) $s["scores"], "equipes" => $equipes]);
            $objectif = OBJECTIFS[$s["mode"]];
            $gagnant = null;
            if ($s["mode"] === "ffa") { if ($tueur && $s["scores"][$tueur]["kills"] >= $objectif) { $gagnant = $tueur; } }
            else { foreach ($equipes as $e => $n) { if ($n >= $objectif) { $gagnant = $e; } } }
            if ($gagnant !== null) {
                $s["etat"] = "attente";
                diffuser($s, ["t" => "fin", "gagnant" => $gagnant, "scores" => (object) $s["scores"], "equipes" => $equipes]);
                retirerBots($s);
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
    $s = ["code" => $code, "carte" => in_array($m["carte"] ?? "", CARTES, true) ? $m["carte"] : "nexus", "hote" => "", "etat" => "attente",
        "mode" => in_array($m["mode"] ?? "", MODES, true) ? $m["mode"] : "ffa", "nb_bots" => (int) nombre($m["bots"] ?? 0, 0, MAX_BOTS),
        "difficulte" => in_array($m["difficulte"] ?? "", DIFFICULTES, true) ? $m["difficulte"] : "normal", "scores" => [], "equipes_partie" => [], "joueurs" => []];
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
    if (!$s || !humains($s)) {
        if ($f) { fermerSalon($f, $s, $code); }
        repondre(["erreur" => "Aucun salon avec ce code."]);
    }
    if (count(humains($s)) >= MAX_JOUEURS) {
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
    if (!$s || !isset($s["joueurs"][$id]) || estBot($s, $id) || !hash_equals($s["joueurs"][$id]["jeton"], $jetonRecu)) {
        if ($f) { flock($f, LOCK_UN); fclose($f); }
        repondre(["ferme" => true]);
    }
    $maintenant = microtime(true);
    $s["joueurs"][$id]["vu"] = $maintenant;
    $envois = is_array($m["envois"] ?? null) ? array_slice($m["envois"], 0, 80) : [];
    foreach ($envois as $e) {
        if (is_array($e) && isset($s["joueurs"][$id])) { traiter($s, $id, $e); }
    }
    retirerAbsents($s);
    if (!isset($s["joueurs"][$id])) {
        fermerSalon($f, $s, $code);
        repondre(["ferme" => true]);
    }
    // Positions des autres joueurs et des bots (sauf les miens) mises à jour depuis ma dernière requête
    $lu = $s["joueurs"][$id]["lu"];
    $etats = [];
    foreach ($s["joueurs"] as $autre => $j) {
        $autre = (string) $autre;
        if ($autre === $id || ($j["proprio"] ?? "") === $id) { continue; }
        if ($j["etat"] !== null && $j["etat_t"] > $lu) { $etats[] = $j["etat"]; }
    }
    $s["joueurs"][$id]["lu"] = $maintenant;
    $messages = $s["joueurs"][$id]["file"];
    $s["joueurs"][$id]["file"] = [];
    fermerSalon($f, $s, $code);
    repondre(["messages" => $messages, "etats" => $etats]);
}

repondre(["erreur" => "Action inconnue."], 400);
