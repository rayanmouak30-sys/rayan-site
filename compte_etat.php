<?php
session_start();
require __DIR__ . "/comptes.php";
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");
$u = utilisateurConnecte();
echo json_encode(["connecte" => (bool) $u, "pseudo" => $u["pseudo"] ?? null], JSON_UNESCAPED_UNICODE);
