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

rem Vos donnees sont liees a l'adresse http://localhost:5173 : l'application utilise toujours ce port.
netstat -ano | findstr /r /c:":5173 .*LISTENING" >nul
if not errorlevel 1 (
  echo L'application est deja lancee : ouverture de http://localhost:5173
  start "" http://localhost:5173
  timeout /t 3 >nul
  exit /b 0
)

echo.
echo Demarrage de l'application sur http://localhost:5173
echo Fermez cette fenetre pour arreter l'application.
echo.
call npm run dev -- --open
if errorlevel 1 (
  echo.
  echo [ERREUR] Le port 5173 est utilise par un autre programme.
  echo Fermez l'autre fenetre de l'application ^(ou redemarrez le PC^), puis relancez ce fichier.
  echo Vos donnees ne sont pas perdues : elles sont liees a http://localhost:5173.
)
pause
