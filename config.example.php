<?php
// Copier ce fichier en config.php sur le serveur et definir des mots de passe forts.
// config.php est ignore par git (voir .gitignore) : ne jamais y committer les vrais mots de passe.
$motDePasseAdmin = "change-moi";
// Mot de passe separe pour le professeur : sa connexion doit etre validee par email avant d'obtenir l'acces admin.
$motDePasseProf = "change-moi-aussi";
// Adresse qui recoit le code de verification quand le prof se connecte.
$emailProprietaire = "ton-email@example.com";
