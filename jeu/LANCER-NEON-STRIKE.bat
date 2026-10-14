@echo off
title Neon Strike - serveur local
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js n est pas installe sur ce PC.
  echo  1. Installe la version LTS depuis https://nodejs.org
  echo  2. Relance ce fichier LANCER-NEON-STRIKE.bat
  echo.
  start "" "https://nodejs.org"
  pause
  exit /b 1
)

echo.
echo  ===== NEON STRIKE =====
echo  Le jeu s ouvre dans ton navigateur : http://localhost:8080/
echo.
echo  Jouer a plusieurs sur le meme Wi-Fi :
echo  tes amis ouvrent http://ADRESSE-IPv4-DE-CE-PC:8080/ puis menu En ligne.
echo  Adresse(s) IPv4 de ce PC :
ipconfig | findstr /i "IPv4"
echo.
echo  Si Windows demande l autorisation pour Node.js, accepte "Reseaux prives".
echo  Pour arreter le jeu : ferme cette fenetre.
echo.
start "" "http://localhost:8080/"
node serveur\serveur.js
pause
