<?php
// Point d'entree du widget d'assistant IA (appele en JS depuis assistant.js).
session_start();
header("Content-Type: application/json; charset=utf-8");
require __DIR__ . "/config.php";

function repondreJson(array $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    repondreJson(["erreur" => "Methode non autorisee."], 405);
}

if (empty($cleApiIA) || $cleApiIA === "colle-ta-cle-ici") {
    repondreJson(["erreur" => "L'assistant n'est pas encore configuré (clé API manquante dans config.php)."], 500);
}

// ----- Limite anti-abus : un nombre de messages max par jour, tous visiteurs confondus -----
$limiteJournaliere = 60;
$fichierCompteur = __DIR__ . "/assistant_compteur.json";
$aujourdhui = date("Y-m-d");
$compteur = ["date" => $aujourdhui, "total" => 0];
if (is_file($fichierCompteur)) {
    $donnees = json_decode((string) file_get_contents($fichierCompteur), true);
    if (is_array($donnees) && ($donnees["date"] ?? "") === $aujourdhui) {
        $compteur = $donnees;
    }
}
if ($compteur["total"] >= $limiteJournaliere) {
    repondreJson(["erreur" => "L'assistant a atteint sa limite de messages pour aujourd'hui, réessaie demain."], 429);
}

// ----- Lecture de la requete -----
$corps = json_decode((string) file_get_contents("php://input"), true);
$message = trim((string) ($corps["message"] ?? ""));
$historique = is_array($corps["historique"] ?? null) ? $corps["historique"] : [];

if ($message === "") {
    repondreJson(["erreur" => "Message vide."], 400);
}
if (mb_strlen($message) > 500) {
    repondreJson(["erreur" => "Message trop long (500 caractères max)."], 400);
}

// ----- Construction de la conversation pour l'API Gemini -----
$instructionSysteme = "Tu es l'assistant du site portfolio de Rayan, élève en STI2D spécialité SIN "
    . "(Systèmes d'Information et Numérique). Le site s'appelle 'Mon classeur numérique' et présente "
    . "ses documents, cours et évaluations. Réponds toujours en français, de façon simple et concise "
    . "(quelques phrases maximum). Tu peux aider à naviguer sur le site (pages Documents, Cours, "
    . "Évaluations) et répondre à des questions générales sur le STI2D/SIN.";

$contenus = [];
foreach (array_slice($historique, -6) as $m) {
    if (!isset($m["role"], $m["contenu"])) { continue; }
    $role = $m["role"] === "assistant" ? "model" : "user";
    $contenus[] = ["role" => $role, "parts" => [["text" => (string) $m["contenu"]]]];
}
$contenus[] = ["role" => "user", "parts" => [["text" => $message]]];

$payload = [
    "systemInstruction" => ["parts" => [["text" => $instructionSysteme]]],
    "contents" => $contenus,
    "generationConfig" => ["maxOutputTokens" => 300],
];

$modele = $modeleIA ?? "gemini-2.0-flash";
$url = "https://generativelanguage.googleapis.com/v1beta/models/" . rawurlencode($modele)
     . ":generateContent?key=" . urlencode($cleApiIA);

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ["Content-Type: application/json"],
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
    CURLOPT_TIMEOUT => 20,
]);
$reponseBrute = curl_exec($ch);
$erreurCurl = curl_error($ch);
$codeHttp = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($reponseBrute === false || $erreurCurl !== "") {
    repondreJson(["erreur" => "Impossible de contacter l'IA pour le moment."], 502);
}

$reponse = json_decode($reponseBrute, true);
$texte = $reponse["candidates"][0]["content"]["parts"][0]["text"] ?? null;

if ($codeHttp !== 200 || $texte === null) {
    repondreJson([
        "erreur" => "L'IA n'a pas pu répondre (vérifie la clé API dans config.php).",
        "detail" => substr($reponseBrute, 0, 300),
    ], 502);
}

$compteur["total"]++;
file_put_contents($fichierCompteur, json_encode($compteur));

repondreJson(["reponse" => trim($texte)]);
