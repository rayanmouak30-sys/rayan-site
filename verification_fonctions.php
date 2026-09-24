<?php
// Genere un nouveau code de verification a 6 chiffres, le stocke en session et l'envoie par email.
function envoyerCodeVerification(string $emailProprietaire): void {
    $code = str_pad((string) random_int(0, 999999), 6, "0", STR_PAD_LEFT);
    $_SESSION["code_verification"] = $code;
    $_SESSION["code_expire"] = time() + 120;
    $_SESSION["code_essais"] = 0;
    $_SESSION["code_envoye_a"] = time();

    $sujet = "Code de verification - connexion prof";
    $message = "Une connexion admin a ete demandee avec le mot de passe prof.\n\n"
              . "Code a communiquer pour valider : $code\n"
              . "Valable 2 minutes.\n\n"
              . "Si tu ne veux pas valider cette connexion, ne communique pas le code : il expirera tout seul.";
    $domaine = $_SERVER["SERVER_NAME"] ?? "mou.alwaysdata.net";
    $entetes = "From: Mon classeur numerique <no-reply@" . $domaine . ">";
    @mail($emailProprietaire, $sujet, $message, $entetes);
}
