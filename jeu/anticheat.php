<?php
// Anti-triche du mode En ligne (relais PHP). Le jeu tourne chez chaque joueur, donc tout ce qui vient d'un navigateur
// peut être truqué : le serveur vérifie chaque message avec les règles du jeu (jeu/serveur/anticheat.json) et ne
// relaie que ce qui est possible. Même logique que jeu/serveur/anticheat.js (serveur temps réel).
//
// Détections : horloge accélérée (speedhack), téléportation et vitesse, dégâts impossibles, cadence de tir,
// touches sans tir, tir depuis une autre position, couteau à distance, invincibilité, élimination offerte à un complice,
// statistiques de visée (tirs à la tête, visée instantanée). Sanctions : message ignoré, points, exclusion du salon
// à 3 points et bannissement temporaire ; tout est noté dans donnees/anticheat.json (page admin_anticheat.php).

function acRegles(): array {
    static $r = null;
    if ($r === null) { $r = json_decode((string) file_get_contents(__DIR__ . "/serveur/anticheat.json"), true) ?: []; }
    return $r;
}

const AC_RAISONS = [
    "horloge" => "Horloge du jeu accélérée (speedhack)",
    "teleport" => "Téléportation",
    "vitesse" => "Vitesse de déplacement impossible",
    "degats" => "Dégâts impossibles",
    "cadence" => "Cadence de tir trop rapide",
    "sans_tir" => "Touches sans tir",
    "position_tir" => "Tir depuis une autre position",
    "couteau" => "Coup de couteau à distance",
    "portee" => "Touche hors de portée",
    "invincible" => "Invincibilité",
    "visee_tete" => "Taux de tirs à la tête anormal",
    "visee_snap" => "Visée automatique probable",
    "format" => "Messages truqués",
];

function acMaintenant(): float { return microtime(true) * 1000.0; }

function acNouveau(): array {
    return ["base" => null, "calib_fin" => null, "h" => 0.0, "pos" => null, "pos_h" => 0.0, "vivant" => 0, "reapparition" => true,
        "reserve" => (float) (acRegles()["reserve_deplacement"] ?? 20), "lacets" => [], "tirs" => [], "tir_arme" => "", "tir_h" => -1e12, "credit" => 0,
        "degats_vie" => 0.0, "depasse_t" => null, "recu_de" => [], "touches" => 0, "tetes" => 0, "snaps" => 0, "drapeaux" => [],
        "points" => 0, "derniers" => []];
}

function acEmpreinte(): string {
    return hash("sha256", ($_SERVER["REMOTE_ADDR"] ?? "") . "|" . ($_SERVER["HTTP_USER_AGENT"] ?? ""));
}

// ----- Bannissements temporaires (tous salons) et journal -----
function acBanni(string $empreinte): bool {
    $bans = lireDonnees("anticheat_bans");
    return isset($bans[$empreinte]) && $bans[$empreinte] > time();
}
function acBannir(string $empreinte): void {
    $bans = array_filter(lireDonnees("anticheat_bans"), fn($fin) => $fin > time());
    $bans[$empreinte] = time() + (int) (acRegles()["bannissement_s"] ?? 900);
    ecrireDonnees("anticheat_bans", $bans);
}
function acJournal(array $entree): void {
    $j = lireDonnees("anticheat");
    $j[] = $entree;
    ecrireDonnees("anticheat", array_slice($j, -300));
}

// Signale une triche : points, journal ; exclusion du salon à partir de points_exclusion
function acSignaler(array &$s, string $id, string $raison, int $points, string $detail = ""): void {
    if (!isset($s["joueurs"][$id])) { return; }
    $ac = &$s["joueurs"][$id]["ac"];
    $now = acMaintenant();
    // Une même raison ne compte qu'une fois toutes les 3 secondes (sauf les tricheries certaines)
    if ($points < 3 && isset($ac["derniers"][$raison]) && $now - $ac["derniers"][$raison] < 3000) { return; }
    $ac["derniers"][$raison] = $now;
    $ac["points"] += $points;
    $exclu = $ac["points"] >= (int) (acRegles()["points_exclusion"] ?? 3);
    acJournal(["t" => time(), "salon" => $s["code"], "nom" => $s["joueurs"][$id]["nom"], "raison" => AC_RAISONS[$raison] ?? $raison,
        "detail" => $detail, "points" => $ac["points"], "exclu" => $exclu]);
    if (!$exclu) { return; }
    $texte = AC_RAISONS[$raison] ?? $raison;
    $empreinte = $s["joueurs"][$id]["empreinte"] ?? "";
    $s["exclus"][$id] = ["raison" => $texte, "jeton" => $s["joueurs"][$id]["jeton"]];
    if ($empreinte !== "") { $s["bannis"][$empreinte] = true; acBannir($empreinte); }
    $nom = $s["joueurs"][$id]["nom"];
    quitter($s, $id);
    diffuser($s, ["t" => "triche", "nom" => $nom, "raison" => $texte]);
}

// Horloge du client (performance.now) : elle ne peut pas avancer plus vite que celle du serveur.
// Faux si le message doit être ignoré.
function acHorloge(array &$s, string $id, $h): bool {
    $r = acRegles();
    if (!is_numeric($h)) { acSignaler($s, $id, "format", 1, "horodatage absent"); return false; }
    $h = (float) $h;
    $ac = &$s["joueurs"][$id]["ac"];
    if ($h + 1 < $ac["h"]) { return false; }            // message en retard : ignoré
    $ac["h"] = max($ac["h"], $h);
    $now = acMaintenant();
    $decalage = $h - $now;
    if ($ac["calib_fin"] === null) { $ac["calib_fin"] = $now + (float) ($r["calibrage_horloge_ms"] ?? 1000); }
    if ($now <= $ac["calib_fin"]) {
        $ac["base"] = $ac["base"] === null ? $decalage : max($ac["base"], $decalage);
        return true;
    }
    $avance = $decalage - $ac["base"];
    if ($avance > (float) ($r["avance_horloge_max_ms"] ?? 2000)) {
        acSignaler($s, $id, "horloge", 3, sprintf("horloge en avance de %.1f s", $avance / 1000));
        return false;
    }
    return true;
}

// Position (message "etat") : vitesse, téléportation, réapparition, invincibilité
function acEtat(array &$s, string $id, array $e, $h): bool {
    if (!acHorloge($s, $id, $h)) { return false; }
    $r = acRegles();
    $ac = &$s["joueurs"][$id]["ac"];
    $h = (float) $h;
    $pos = [$e["x"], $e["y"], $e["z"]];
    $cap = (float) ($r["reserve_deplacement"] ?? 20);
    $vivant = (int) $e["v"];
    if ($vivant === 1 && $ac["pos"] !== null && $ac["vivant"] === 1) {
        $dt = max(0.0, ($h - $ac["pos_h"]) / 1000.0);
        $d = hypot($pos[0] - $ac["pos"][0], $pos[2] - $ac["pos"][2]);
        $permis = (float) ($r["vitesse_max"] ?? 9) * $dt + (float) ($r["marge_deplacement"] ?? 0.05);
        if ($d > $cap + $permis) {
            acSignaler($s, $id, "teleport", 3, sprintf("%.1f m en %.2f s", $d, $dt));
            return false;
        }
        $ac["reserve"] = min($cap, $ac["reserve"] - ($d - $permis));
        if ($ac["reserve"] < 0) {
            $ac["reserve"] = $cap;
            acSignaler($s, $id, "vitesse", 2, sprintf("%.1f m en %.2f s", $d, $dt));
            if (!isset($s["joueurs"][$id])) { return false; }
        }
    } elseif ($vivant === 1 && $ac["vivant"] === 0 && !$ac["reapparition"] && $ac["pos"] !== null) {
        // Réapparition sans être mort : interdit (servirait à se téléporter)
        acSignaler($s, $id, "teleport", 3, "réapparition sans élimination");
        return false;
    }
    if ($vivant === 1 && $ac["vivant"] === 0) {
        $ac["reapparition"] = false;
        $ac["degats_vie"] = 0.0;
        $ac["depasse_t"] = null;
        $ac["reserve"] = $cap;
    }
    $ac["vivant"] = $vivant;
    $ac["pos"] = $pos;
    $ac["pos_h"] = $h;
    $ac["lacets"][] = [$h, (float) $e["l"]];
    if (count($ac["lacets"]) > 3) { array_shift($ac["lacets"]); }
    // A encaissé bien plus que ses points de vie, armure et soins, et joue toujours
    if ($vivant === 1 && $ac["depasse_t"] !== null && acMaintenant() - $ac["depasse_t"] > (float) ($r["delai_invincibilite_ms"] ?? 2500)) {
        acSignaler($s, $id, "invincible", 3, sprintf("%d dégâts reçus sans mourir", (int) $ac["degats_vie"]));
        return false;
    }
    return true;
}

// Cadence : nombre de tirs sur une fenêtre glissante (temps du client, borné par le contrôle d'horloge)
function acCadence(array &$ac, string $arme, float $h): bool {
    $r = acRegles();
    $def = $r["armes"][$arme];
    $fenetre = (float) ($r["fenetre_cadence_s"] ?? 2) * 1000;
    $liste = array_values(array_filter($ac["tirs"][$arme] ?? [], fn($t) => $t > $h - $fenetre));
    $liste[] = $h;
    $ac["tirs"][$arme] = $liste;
    $permis = ($fenetre / 1000) / ($def["cadence"] / (float) ($r["bonus_cadence_max"] ?? 1.25)) + (int) ($r["marge_cadence_tirs"] ?? 2);
    return count($liste) <= $permis;
}

// Tir (message "tir") : arme connue, tireur vivant, origine du tir, cadence. Faux : non relayé.
function acTir(array &$s, string $id, array $m): bool {
    if (!acHorloge($s, $id, $m["h"] ?? null)) { return false; }
    $r = acRegles();
    $arme = (string) ($m["a"] ?? "");
    $def = $r["armes"][$arme] ?? null;
    if (!$def || !empty($def["melee"])) { acSignaler($s, $id, "format", 1, "arme inconnue : " . $arme); return false; }
    $ac = &$s["joueurs"][$id]["ac"];
    if ($ac["vivant"] !== 1) { return false; }
    $h = (float) $m["h"];
    if ($ac["pos"] !== null && hypot($m["o"][0] - $ac["pos"][0], $m["o"][2] - $ac["pos"][2]) > (float) ($r["ecart_tir_position"] ?? 4.5)) {
        acSignaler($s, $id, "position_tir", 1, sprintf("%.1f m de sa position", hypot($m["o"][0] - $ac["pos"][0], $m["o"][2] - $ac["pos"][2])));
        return false;
    }
    if (!acCadence($ac, $arme, $h)) {
        acSignaler($s, $id, "cadence", 2, $arme . " : " . count($ac["tirs"][$arme]) . " tirs en " . ($r["fenetre_cadence_s"] ?? 2) . " s");
        return false;
    }
    $ac["tir_arme"] = $arme;
    $ac["tir_h"] = $h;
    $ac["credit"] = (int) ($def["cibles_par_tir"] ?? 1);
    return true;
}

// Touche (message "touche") : renvoie les dégâts validés, ou null si la touche est refusée
function acTouche(array &$s, string $id, string $cible, array $m): ?float {
    if (!acHorloge($s, $id, $m["h"] ?? null)) { return null; }
    $r = acRegles();
    $arme = (string) ($m["arme"] ?? "");
    $def = $r["armes"][$arme] ?? null;
    if (!$def) { acSignaler($s, $id, "format", 1, "arme inconnue : " . $arme); return null; }
    if (!isset($s["joueurs"][$cible])) { return null; }
    $ac = &$s["joueurs"][$id]["ac"];
    $vic = &$s["joueurs"][$cible]["ac"];
    if ($ac["vivant"] !== 1 || $vic["vivant"] !== 1) { return null; }   // décalage réseau : ignoré sans sanction
    $h = (float) $m["h"];
    $degats = (float) $m["degats"];
    $tete = !empty($m["tete"]);
    $max = $tete ? $def["max_tete"] : $def["max_corps"];
    if ($degats > $max + 1) {
        acSignaler($s, $id, "degats", 3, sprintf("%d dégâts au %s (maximum %d)", $degats, $arme, $max));
        return null;
    }
    $distance = ($ac["pos"] !== null && $vic["pos"] !== null) ? hypot($ac["pos"][0] - $vic["pos"][0], $ac["pos"][2] - $vic["pos"][2]) : 0.0;
    if (!empty($def["melee"])) {
        if ($distance > $def["portee"] + (float) ($r["marge_portee_melee"] ?? 3.7)) {
            acSignaler($s, $id, "couteau", 1, sprintf("coup à %.1f m", $distance));
            return null;
        }
        if (!acCadence($ac, $arme, $h)) {
            acSignaler($s, $id, "cadence", 2, "couteau : " . count($ac["tirs"][$arme]) . " coups en " . ($r["fenetre_cadence_s"] ?? 2) . " s");
            return null;
        }
    } else {
        if ($ac["tir_arme"] !== $arme || $h - $ac["tir_h"] > (float) ($r["delai_touche_apres_tir_ms"] ?? 1500) || $ac["credit"] <= 0) {
            acSignaler($s, $id, "sans_tir", 2, "touche au " . $arme . " sans tir correspondant");
            return null;
        }
        $ac["credit"]--;
        if ($distance > (float) ($r["portee_max"] ?? 260)) {
            acSignaler($s, $id, "portee", 1, sprintf("touche à %.0f m", $distance));
            return null;
        }
    }
    // Statistiques de visée (armes à balles, hors pompe et précision)
    if (empty($def["melee"]) && $arme !== "pompe" && $arme !== "sniper") {
        $v = $r["visee"];
        $ac["touches"]++;
        if ($tete) {
            $ac["tetes"]++;
            $l = $ac["lacets"];
            if (count($l) >= 2) {
                [$h1, $l1] = $l[count($l) - 2];
                [$h2, $l2] = $l[count($l) - 1];
                $dl = abs(fmod($l2 - $l1 + 3 * M_PI, 2 * M_PI) - M_PI);
                $dt = max(0.01, ($h2 - $h1) / 1000);
                if ($dl >= $v["angle_snap"] && $dl / $dt >= $v["vitesse_snap"]) { $ac["snaps"]++; }
            }
        }
        if (empty($ac["drapeaux"]["tete"]) && $ac["touches"] >= $v["touches_min"] && $ac["tetes"] / $ac["touches"] > $v["ratio_tete_max"]) {
            $ac["drapeaux"]["tete"] = true;
            acSignaler($s, $id, "visee_tete", 1, sprintf("%d %% de tirs à la tête sur %d touches", 100 * $ac["tetes"] / $ac["touches"], $ac["touches"]));
            if (!isset($s["joueurs"][$id])) { return null; }
        }
        if (empty($ac["drapeaux"]["snap"]) && $ac["snaps"] >= $v["snaps_min"] && $ac["snaps"] / max(1, $ac["tetes"]) >= $v["ratio_snap_max"]) {
            $ac["drapeaux"]["snap"] = true;
            acSignaler($s, $id, "visee_snap", 1, sprintf("%d tirs à la tête juste après un demi-tour instantané", $ac["snaps"]));
            if (!isset($s["joueurs"][$id])) { return null; }
        }
    }
    // Dégâts validés : comptés pour l'invincibilité et pour justifier une élimination
    $vic["degats_vie"] += $degats;
    $vic["recu_de"][$id] = acMaintenant();
    if ($vic["depasse_t"] === null && $vic["degats_vie"] > (float) ($r["degats_vie_max"] ?? 400)) { $vic["depasse_t"] = acMaintenant(); }
    return $degats;
}

// Élimination déclarée par la victime : le tueur doit lui avoir vraiment infligé des dégâts récemment
function acMort(array &$s, string $id, ?string $tueur): ?string {
    $r = acRegles();
    $ac = &$s["joueurs"][$id]["ac"];
    $valide = $tueur !== null && isset($ac["recu_de"][$tueur]) && acMaintenant() - $ac["recu_de"][$tueur] <= (float) ($r["delai_kill_ms"] ?? 6000);
    if ($tueur !== null && !$valide) {
        acJournal(["t" => time(), "salon" => $s["code"], "nom" => $s["joueurs"][$id]["nom"], "raison" => "Élimination non justifiée refusée",
            "detail" => "attribuée à " . ($s["joueurs"][$tueur]["nom"] ?? "?"), "points" => $ac["points"], "exclu" => false]);
    }
    $ac["vivant"] = 0;
    $ac["reapparition"] = true;
    $ac["degats_vie"] = 0.0;
    $ac["depasse_t"] = null;
    $ac["recu_de"] = [];
    return $valide ? $tueur : null;
}
