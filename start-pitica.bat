@echo off
title Pitica Study 🧠❤️
cd /d "%~dp0"

echo =========================================
echo   Iniciando o Pitica Study... ✨
echo =========================================

start /B ollama serve > nul 2>&1
start "Pitica API" /min cmd /c "npm run dev:api"
start "Pitica Web" /min cmd /c "npm run dev:web"

timeout /t 5 /nobreak > nul
start http://localhost:5173

echo =========================================
echo   Pitica Study Online! Bom estudo, Le! 🌻❤️
echo =========================================