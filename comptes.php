<?php
// Comptes visiteurs et messages de contact, stockes en JSON dans donnees/ (dossier interdit d'acces web).

const DOSSIER_DONNEES = __DIR__ . "/donnees";

function preparerDossierDonnees(): void {
    if (!is_dir(DOSSIER_DONNEES)) { mkdir(DOSSIER_DONNEES, 0750, true); }
    $htaccess = DOSSIER_DONNEES . "/.htaccess";
    if (!is_file($htaccess)) { file_put_contents($htaccess, "Require all denied\n"); }
}

function lireDonnees(string $nom): array {
    $chemin = DOSSIER_DONNEES . "/" . $nom . ".json";
    if (!is_file($chemin)) { return []; }
    $donnees = json_decode((string) file_get_contents($chemin), true);
    return is_array($donnees) ? $donnees : [];
}

function ecrireDonnees(string $nom, array $donnees): void {
    preparerDossierDonnees();
    file_put_contents(
        DOSSIER_DONNEES . "/" . $nom . ".json",
        json_encode($donnees, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT),
        LOCK_EX
    );
}

function nouvelId(): string {
    return bin2hex(random_bytes(8));
}

function utilisateurParId(string $id): ?array {
    foreach (lireDonnees("utilisateurs") as $u) {
        if ($u["id"] === $id) { return $u; }
    }
    return null;
}

function utilisateurConnecte(): ?array {
    if (empty($_SESSION["utilisateur_id"])) { return null; }
    return utilisateurParId($_SESSION["utilisateur_id"]);
}

function utilisateurParIdentifiant(string $identifiant): ?array {
    $identifiant = mb_strtolower(trim($identifiant));
    foreach (lireDonnees("utilisateurs") as $u) {
        if (mb_strtolower($u["pseudo"]) === $identifiant || mb_strtolower($u["email"]) === $identifiant) {
            return $u;
        }
    }
    return null;
}

function connecterUtilisateur(array $u): void {
    session_regenerate_id(true);
    $_SESSION["utilisateur_id"] = $u["id"];
}

function messagesDe(string $utilisateurId): array {
    $messages = array_values(array_filter(lireDonnees("messages"), function ($m) use ($utilisateurId) {
        return $m["utilisateur_id"] === $utilisateurId;
    }));
    usort($messages, function ($a, $b) { return $a["date"] <=> $b["date"]; });
    return $messages;
}

// Une entree par utilisateur ayant ecrit, triee par dernier message.
// "attente" = le dernier message vient du visiteur (donc pas encore repondu).
function conversations(): array {
    $conversations = [];
    foreach (lireDonnees("messages") as $m) {
        $id = $m["utilisateur_id"];
        if (!isset($conversations[$id])) { $conversations[$id] = ["nb" => 0, "dernier" => 0, "attente" => false]; }
        $conversations[$id]["nb"]++;
        if ($m["date"] >= $conversations[$id]["dernier"]) {
            $conversations[$id]["dernier"] = $m["date"];
            $conversations[$id]["attente"] = $m["auteur"] === "visiteur";
        }
    }
    uasort($conversations, function ($a, $b) { return $b["dernier"] <=> $a["dernier"]; });
    return $conversations;
}

function ajouterMessage(string $utilisateurId, string $auteur, string $texte): void {
    $messages = lireDonnees("messages");
    $messages[] = [
        "id" => nouvelId(),
        "utilisateur_id" => $utilisateurId,
        "auteur" => $auteur,
        "texte" => $texte,
        "date" => time(),
    ];
    ecrireDonnees("messages", $messages);
}
