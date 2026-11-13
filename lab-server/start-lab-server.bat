@echo off
title NSCT Lab Server
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed on this PC.
  echo Install Node.js 18 or newer from the installer on your USB drive, then run this again.
  pause
  exit /b 1
)
node server.js 8080
pause
