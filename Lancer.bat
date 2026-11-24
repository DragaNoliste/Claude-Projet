@echo off
chcp 65001 >nul
title Industrial Photo Annotator
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERREUR] Node.js n'est pas installe.
  echo Telechargez la version LTS sur https://nodejs.org puis relancez ce fichier.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installation des dependances ^(premiere utilisation uniquement^)...
  call npm install
  if errorlevel 1 (
    echo [ERREUR] L'installation a echoue.
    pause
    exit /b 1
  )
)

echo.
echo Demarrage de l'application sur http://localhost:5173
echo Fermez cette fenetre pour arreter l'application.
echo.
call npm run dev -- --open
pause
