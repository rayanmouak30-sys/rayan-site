<?php
// Classement en ligne de Neon Strike, lié aux comptes du site.
// GET  ?action=etat        -> joueur connecté ?
// POST ?action=resultat    -> enregistre le résultat d'une partie (compte connecté obligatoire)
// GET  ?action=classement  -> les 20 meilleurs joueurs
session_start();
require __DIR__ . "/../comptes.php";

header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");
header("X-Content-Type-Options: nosniff");

function repondre(array $donnees, int $code = 200): void {
    http_response_code($code);
    echo json_encode($donnees, JSON_UNESCAPED_UNICODE);
    exit;
}

// En-tête personnalisé obligatoire : un autre site ne peut pas l'envoyer sans autorisation (protection CSRF).
if (($_SERVER["HTTP_X_REQUESTED_WITH"] ?? "") !== "neonstrike") {
    repondre(["erreur" => "Requête refusée."], 403);
}

$action = $_GET["action"] ?? "";
$utilisateur = utilisateurConnecte();

if ($action === "etat") {
    repondre(["connecte" => (bool) $utilisateur, "pseudo" => $utilisateur["pseudo"] ?? null]);
}

if ($action === "classement") {
    $joueurs = lireDonnees("neonstrike");
    $liste = [];
    foreach ($joueurs as $j) {
        $liste[] = [
            "pseudo" => (string) ($j["pseudo"] ?? "?"),
            "niveau" => (int) ($j["niveau"] ?? 1),
            "xp" => (int) ($j["xp"] ?? 0),
            "parties" => (int) ($j["parties"] ?? 0),
            "victoires" => (int) ($j["victoires"] ?? 0),
            "kills" => (int) ($j["kills"] ?? 0),
            "morts" => (int) ($j["morts"] ?? 0),
        ];
    }
    usort($liste, function ($a, $b) { return $b["xp"] <=> $a["xp"]; });
    repondre(["joueurs" => array_slice($liste, 0, 20)]);
}

if ($action === "resultat") {
    if ($_SERVER["REQUEST_METHOD"] !== "POST") { repondre(["erreur" => "Méthode non autorisée."], 405); }
    if (!$utilisateur) { repondre(["erreur" => "Connecte-toi sur le site pour apparaître au classement."], 401); }
    $corps = json_decode((string) file_get_contents("php://input"), true);
    if (!is_array($corps)) { repondre(["erreur" => "Données invalides."], 400); }

    // Valeurs bornées : une partie ne peut pas rapporter n'importe quoi.
    $borne = function ($v, int $max): int { return max(0, min($max, (int) $v)); };
    $kills = $borne($corps["kills"] ?? 0, 80);
    $morts = $borne($corps["morts"] ?? 0, 80);
    $tetes = min($kills, $borne($corps["tetes"] ?? 0, 80));
    $xp = $borne($corps["xp"] ?? 0, 1200);
    $niveau = $borne($corps["niveau"] ?? 1, 500);
    $victoire = !empty($corps["victoire"]);
    $mode = in_array($corps["mode"] ?? "", ["spike", "elimination", "deathmatch"], true) ? $corps["mode"] : null;
    if (!$mode) { repondre(["erreur" => "Mode non classé."], 400); }

    $joueurs = lireDonnees("neonstrike");
    $id = $utilisateur["id"];
    $j = $joueurs[$id] ?? ["pseudo" => $utilisateur["pseudo"], "xp" => 0, "niveau" => 1, "parties" => 0, "victoires" => 0, "kills" => 0, "morts" => 0, "tetes" => 0, "dernier" => 0];
    // Une partie dure plusieurs minutes : on refuse les envois trop rapprochés.
    if (time() - (int) ($j["dernier"] ?? 0) < 45) { repondre(["erreur" => "Résultat déjà enregistré il y a peu."], 429); }
    $j["pseudo"] = $utilisateur["pseudo"];
    $j["xp"] = (int) $j["xp"] + $xp;
    $j["niveau"] = max((int) $j["niveau"], $niveau);
    $j["parties"] = (int) $j["parties"] + 1;
    $j["victoires"] = (int) $j["victoires"] + ($victoire ? 1 : 0);
    $j["kills"] = (int) $j["kills"] + $kills;
    $j["morts"] = (int) $j["morts"] + $morts;
    $j["tetes"] = (int) ($j["tetes"] ?? 0) + $tetes;
    $j["dernier"] = time();
    $joueurs[$id] = $j;
    ecrireDonnees("neonstrike", $joueurs);
    repondre(["ok" => true, "xpTotal" => $j["xp"]]);
}

repondre(["erreur" => "Action inconnue."], 400);
