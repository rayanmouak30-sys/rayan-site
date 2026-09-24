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
                    "url" => $cheminDossier . rawurlencode($f),
                    "date" => filemtime($chemin),
                ];
            }
        }
    }

    usort($fichiers, function ($a, $b) { return $b["date"] <=> $a["date"]; });
    return $fichiers;
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
