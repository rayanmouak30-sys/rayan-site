<?php
session_start();
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");
if (empty($_SESSION["admin"])) {
    http_response_code(403);
    echo json_encode(["attente" => 0]);
    exit;
}
require __DIR__ . "/comptes.php";
$attente = count(array_filter(conversations(), function ($c) { return $c["attente"]; }));
echo json_encode(["attente" => $attente]);
