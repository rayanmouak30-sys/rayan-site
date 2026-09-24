<?php
// Fonctions partagees pour lister/classer les PDF par theme (documents, cours, evaluations).
// Un theme = un sous-dossier du dossier de la categorie. Les fichiers a la racine = "Sans theme".

function themeVersDossier(string $theme): string {
    $theme = trim($theme);
    if ($theme === "") { return ""; }
    $theme = preg_replace('/[^\p{L}\p{N} _-]/u', '', $theme);
    $theme = preg_replace('/\s+/u', '_', trim($theme));
    $theme = trim($theme, "_-.");
    return mb_substr($theme, 0, 40);
}

function dossierVersTheme(string $dossier): string {
    return str_replace('_', ' ', $dossier);
}

function listerFichiers(string $racine): array {
    $fichiers = [];
    if (!is_dir($racine)) { return $fichiers; }

    foreach (scandir($racine) as $f) {
        $chemin = $racine . $f;
        if (is_file($chemin) && strtolower(pathinfo($f, PATHINFO_EXTENSION)) === "pdf") {
            $fichiers[] = [
                "nom" => $f,
                "theme" => "Sans thème",
                "sousDossier" => "",
                "url" => $racine . rawurlencode($f),
                "date" => filemtime($chemin),
            ];
        }
    }

    foreach (scandir($racine) as $sous) {
        $cheminDossier = $racine . $sous . "/";
        if ($sous === "." || $sous === ".." || !is_dir($cheminDossier)) { continue; }
        $theme = dossierVersTheme($sous);
        foreach (scandir($cheminDossier) as $f) {
            $chemin = $cheminDossier . $f;
            if (is_file($chemin) && strtolower(pathinfo($f, PATHINFO_EXTENSION)) === "pdf") {
                $fichiers[] = [
                    "nom" => $f,
                    "theme" => $theme,
                    "sousDossier" => $sous,
                    "url" => $cheminDossier . rawurlencode($f),
                    "date" => filemtime($chemin),
                ];
            }
        }
    }

    usort($fichiers, function ($a, $b) { return $b["date"] <=> $a["date"]; });
    return $fichiers;
}

// Recalcule un chemin admin (sous-dossier + nom envoyes par un formulaire) et verifie
// qu'il reste bien a l'interieur de $racine avant de le rendre. Retourne null sinon.
function resoudreCheminFichier(string $racine, string $sousDossier, string $nom): ?string {
    $sousDossier = themeVersDossier($sousDossier);
    $nom = basename(trim($nom));
    if ($nom === "") { return null; }

    $chemin = $racine . ($sousDossier !== "" ? $sousDossier . "/" : "") . $nom;
    $racineReelle = realpath($racine);
    $cheminReel = realpath($chemin);
    if ($racineReelle === false || $cheminReel === false) { return null; }
    if (strpos($cheminReel, $racineReelle . DIRECTORY_SEPARATOR) !== 0) { return null; }
    return $cheminReel;
}

// Nettoie un nom saisi par l'admin et force l'extension .pdf (evite de renommer vers un autre type de fichier).
function nomFichierPropre(string $nom): string {
    $sansExt = pathinfo(basename(trim($nom)), PATHINFO_FILENAME);
    $sansExt = preg_replace('/[^A-Za-z0-9._-]/', '_', $sansExt);
    $sansExt = trim($sansExt, "._-");
    return $sansExt === "" ? "" : $sansExt . ".pdf";
}

// Supprime le sous-dossier de theme s'il est devenu vide apres une suppression/un renommage.
function nettoyerDossierVide(string $racine, string $sousDossier): void {
    if ($sousDossier === "") { return; }
    $chemin = $racine . $sousDossier . "/";
    if (is_dir($chemin) && count(scandir($chemin)) <= 2) { rmdir($chemin); }
}

function themesDisponibles(array $fichiers): array {
    $themes = [];
    foreach ($fichiers as $f) { $themes[$f["theme"]] = true; }
    $themes = array_keys($themes);
    sort($themes, SORT_NATURAL | SORT_FLAG_CASE);
    return $themes;
}

function nomAffiche(string $nomFichier): string {
    return str_replace(["_", ".pdf"], [" ", ""], $nomFichier);
}
