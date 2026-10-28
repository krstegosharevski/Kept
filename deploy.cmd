@echo off
rem Kept deploy: publishes the app folder to Vercel.
rem The first time, Vercel opens the browser to log in and asks a few setup questions (see README.md).
title Kept deploy
cd /d "%~dp0"
rem keep npm's download cache on this drive (E:), since C: is nearly full
set "npm_config_cache=%~dp0.npm-cache"
where node >nul 2>nul || (echo Node.js is missing. Install the LTS version from https://nodejs.org, then run this again. & pause & exit /b 1)
echo Running the tests first...
call node --test || (echo. & echo Tests failed, so nothing was published. & pause & exit /b 1)
echo.
call npx --yes vercel deploy app --prod
echo.
if errorlevel 1 (echo Publishing failed. Read the messages above.) else (echo Done. Open the address above in Safari on your iPhone.)
pause
