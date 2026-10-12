@echo off
rem Double-click: fetch fresh assets, commit and publish the site to GitHub Pages.
chcp 65001 >nul
cd /d "%~dp0"
node scripts\deploy.mjs --assets
echo.
pause
