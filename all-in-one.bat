@echo off
chcp 65001 >nul
title Suno RPC - Автозапуск
setlocal

set "SERVER_DIR=C:\suno-discord-rpc\server"

echo 🔍 Проверяем систему...

:: Проверка Node.js
node --version >nul 2>&1 || (
    echo ❌ Установите Node.js: https://nodejs.org/
    pause
    exit 1
)

:: Проверка папки сервера
if not exist "%SERVER_DIR%\server.js" (
    echo ❌ server.js не найден
    pause
    exit 1
)

:: Установка зависимостей
cd /d "%SERVER_DIR%"
if not exist "node_modules" (
    echo 📦 Устанавливаем зависимости...
    npm install || (echo ❌ Ошибка установки & pause & exit 1)
)

:: Ожидание Discord
:wait_discord
echo 🔍 Ожидаем Discord...
tasklist | find /I "Discord.exe" >nul || (
    timeout /t 5 >nul
    goto wait_discord
)

:: Запуск сервера
echo 🚀 Запускаем сервер...
node server.js

echo.
echo ⚠️ Сервер остановлен. Нажмите любую клавишу для выхода...
pause >nul