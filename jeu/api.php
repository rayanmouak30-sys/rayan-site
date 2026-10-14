<?php
// Classement en ligne de Neon Strike, lié aux comptes du site.
// GET  ?action=etat        -> joueur connecté ?
// POST ?action=resultat    -> enregistre le résultat d'une partie (compte connecté obligatoire)
// GET  ?action=classement  -> les 20 meilleurs joueurs
// POST ?action=connexion / inscription / deconnexion -> compte du site, depuis le jeu
// GET  ?action=profil, POST ?action=sauver -> progression du jeu gardée sur le compte
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

// ----- Limitation des tentatives (par adresse IP, gardée hachée) -----
function tentativesRestantes(string $type, int $max, int $fenetre): bool {
    $cle = $type . ":" . substr(hash("sha256", ($_SERVER["REMOTE_ADDR"] ?? "?") . "neonstrike"), 0, 24);
    $limites = lireDonnees("neonstrike_limites");
    $maintenant = time();
    $liste = array_values(array_filter($limites[$cle] ?? [], function ($t) use ($maintenant, $fenetre) { return $maintenant - (int) $t < $fenetre; }));
    return count($liste) < $max;
}

function noterTentative(string $type): void {
    $cle = $type . ":" . substr(hash("sha256", ($_SERVER["REMOTE_ADDR"] ?? "?") . "neonstrike"), 0, 24);
    $limites = lireDonnees("neonstrike_limites");
    $maintenant = time();
    // Nettoyage des vieilles entrées (plus d'une heure)
    foreach ($limites as $k => $liste) {
        $limites[$k] = array_values(array_filter($liste, function ($t) use ($maintenant) { return $maintenant - (int) $t < 3600; }));
        if (!$limites[$k]) { unset($limites[$k]); }
    }
    $limites[$cle][] = $maintenant;
    ecrireDonnees("neonstrike_limites", $limites);
}

function lireCorps(): array {
    $brut = (string) file_get_contents("php://input");
    if (strlen($brut) > 60000) { repondre(["erreur" => "Données trop volumineuses."], 413); }
    $corps = json_decode($brut, true);
    return is_array($corps) ? $corps : [];
}

if ($action === "connexion") {
    if ($_SERVER["REQUEST_METHOD"] !== "POST") { repondre(["erreur" => "Méthode non autorisée."], 405); }
    if (!tentativesRestantes("connexion", 8, 600)) { repondre(["erreur" => "Trop d'essais. Réessaie dans quelques minutes."], 429); }
    $corps = lireCorps();
    $u = utilisateurParIdentifiant((string) ($corps["identifiant"] ?? ""));
    if ($u && password_verify((string) ($corps["mdp"] ?? ""), $u["hash"])) {
        connecterUtilisateur($u);
        repondre(["connecte" => true, "pseudo" => $u["pseudo"]]);
    }
    noterTentative("connexion");
    repondre(["erreur" => "Pseudo/email ou mot de passe incorrect."], 401);
}

if ($action === "inscription") {
    if ($_SERVER["REQUEST_METHOD"] !== "POST") { repondre(["erreur" => "Méthode non autorisée."], 405); }
    if (!tentativesRestantes("inscription", 4, 3600)) { repondre(["erreur" => "Trop de comptes créés depuis cet appareil. Réessaie plus tard."], 429); }
    $corps = lireCorps();
    $pseudo = trim((string) ($corps["pseudo"] ?? ""));
    $email = trim((string) ($corps["email"] ?? ""));
    $mdp = (string) ($corps["mdp"] ?? "");
    // Mêmes règles que la page d'inscription du site
    if (!preg_match('/^[A-Za-z0-9_-]{3,20}$/', $pseudo)) { repondre(["erreur" => "Pseudo : 3 à 20 caractères (lettres, chiffres, - ou _)."], 400); }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { repondre(["erreur" => "Adresse email invalide."], 400); }
    if (strlen($mdp) < 8) { repondre(["erreur" => "Le mot de passe doit faire au moins 8 caractères."], 400); }
    if (utilisateurParIdentifiant($pseudo) || utilisateurParIdentifiant($email)) { repondre(["erreur" => "Ce pseudo ou cet email est déjà utilisé."], 409); }
    $utilisateur = ["id" => nouvelId(), "pseudo" => $pseudo, "email" => $email, "hash" => password_hash($mdp, PASSWORD_DEFAULT), "cree" => time()];
    $utilisateurs = lireDonnees("utilisateurs");
    $utilisateurs[] = $utilisateur;
    ecrireDonnees("utilisateurs", $utilisateurs);
    noterTentative("inscription");
    connecterUtilisateur($utilisateur);
    repondre(["connecte" => true, "pseudo" => $pseudo]);
}

if ($action === "deconnexion") {
    if ($_SERVER["REQUEST_METHOD"] !== "POST") { repondre(["erreur" => "Méthode non autorisée."], 405); }
    unset($_SESSION["utilisateur_id"]);
    session_regenerate_id(true);
    repondre(["connecte" => false]);
}

// ----- Sauvegarde de la progression du jeu (XP, succès, touches, réglages) -----
if ($action === "profil") {
    if (!$utilisateur) { repondre(["erreur" => "Non connecté."], 401); }
    $profils = lireDonnees("neonstrike_profils");
    repondre(["sauvegarde" => $profils[$utilisateur["id"]] ?? null]);
}

if ($action === "sauver") {
    if ($_SERVER["REQUEST_METHOD"] !== "POST") { repondre(["erreur" => "Méthode non autorisée."], 405); }
    if (!$utilisateur) { repondre(["erreur" => "Non connecté."], 401); }
    $corps = lireCorps();
    $sauvegarde = [];
    foreach (["profil", "reglages", "touches", "manette"] as $cle) {
        if (isset($corps[$cle]) && is_array($corps[$cle])) { $sauvegarde[$cle] = $corps[$cle]; }
    }
    $sauvegarde["maj"] = time();
    $profils = lireDonnees("neonstrike_profils");
    $profils[$utilisateur["id"]] = $sauvegarde;
    ecrireDonnees("neonstrike_profils", $profils);
    repondre(["ok" => true]);
}

repondre(["erreur" => "Action inconnue."], 400);
