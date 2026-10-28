@echo off
rem Kept preview: serves the app folder at http://localhost:3000 and opens it in your browser.
rem Stop it with Ctrl+C or by closing this window.
title Kept preview
cd /d "%~dp0"
rem keep npm's download cache on this drive (E:), since C: is nearly full
set "npm_config_cache=%~dp0.npm-cache"
where node >nul 2>nul || (echo Node.js is missing. Install the LTS version from https://nodejs.org, then run this again. & pause & exit /b 1)
rem Open the browser as soon as the server answers. The first run downloads "serve", which can take a moment.
start "" /b cmd /c "for /l %%i in (1,1,90) do @(curl -s -o nul http://localhost:3000/ && (start "" http://localhost:3000/ & exit) & ping -n 2 127.0.0.1 >nul)"
npx --yes serve app -l 3000
pause
