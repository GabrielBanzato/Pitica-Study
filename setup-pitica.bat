@echo off
title Setup Inicial - Pitica Study 🌻
cd /d "%~dp0"

echo 1/3 - Baixando modelo Qwen 2.5 (3B)...
ollama pull qwen2.5:3b

echo 2/3 - Instalando pacotes do Node.js...
call npm install

echo 3/3 - Sincronizando banco de dados...
cd apps\api
call npx prisma db push
call npx prisma generate
cd ..\..

echo Setup concluido!
pause