@echo off
chcp 65001 >nul
title Suno Discord RPC - Запуск
setlocal

set "NODE_DIR=node-portable"
set "NODE_EXE=%NODE_DIR%\node.exe"
set "NPM_SCRIPT=%NODE_DIR%\node_modules\npm\bin\npm-cli.js"

echo ================================
echo    Suno Discord RPC Launcher
echo ================================
echo.

:: Проверяем Node.js в системе
node --version >nul 2>&1
if %errorlevel% == 0 (
    echo ✅ Найден Node.js в системе
    goto :check_deps
)

:: Проверяем portable версию
if exist "%NODE_EXE%" (
    echo ✅ Найдена portable версия Node.js
    set "PATH=%CD%\%NODE_DIR%;%PATH%"
    goto :check_deps
)

echo ❌ Node.js не найден
echo 📥 Скачиваем portable версию...
echo.

:: Создаем папку
if not exist "%NODE_DIR%" mkdir "%NODE_DIR%"

:: Скачиваем Node.js
echo 🔄 Скачиваем Node.js (это займет время)...
powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v18.18.0/win-x64/node.exe' -OutFile '%NODE_EXE%'"

if not exist "%NODE_EXE%" (
    echo ❌ Не удалось скачать Node.js
    echo 🔗 Скачайте вручную: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js скачан
set "PATH=%CD%\%NODE_DIR%;%PATH%"

:check_deps
echo.
echo 🔍 Проверяем зависимости...

:: Проверяем установлен ли npm в portable версии
if exist "%NPM_SCRIPT%" (
    echo ✅ Найден npm в portable версии
    goto :install_app_deps
)

:: Если используем системный Node.js
node --version >nul 2>&1
if %errorlevel% == 0 (
    echo ✅ Используем системный npm
    goto :install_app_deps
)

echo 📦 Устанавливаем npm для portable версии...
echo ⏳ Это может занять несколько минут...

:: Скачиваем и распаковываем npm
powershell -Command "& {
    Invoke-WebRequest -Uri 'https://github.com/npm/cli/archive/refs/tags/v9.8.1.zip' -OutFile 'npm.zip'
    Expand-Archive -Path 'npm.zip' -DestinationPath 'npm-temp' -Force
    if (!(Test-Path '%NODE_DIR%\node_modules')) { mkdir '%NODE_DIR%\node_modules' }
    Move-Item -Path 'npm-temp\cli-9.8.1' -Destination '%NODE_DIR%\node_modules\npm' -Force
    Remove-Item -Path 'npm.zip' -Force
    Remove-Item -Path 'npm-temp' -Recurse -Force
}"

if not exist "%NPM_SCRIPT%" (
    echo ❌ Не удалось установить npm
    goto :manual_install
)

echo ✅ npm установлен

:install_app_deps
echo.
echo 📦 Устанавливаем зависимости приложения...

:: Используем правильный npm
if exist "%NPM_SCRIPT%" (
    "%NODE_EXE%" "%NPM_SCRIPT%" run install-deps
) else (
    npm run install-deps
)

if %errorlevel% neq 0 (
    echo ❌ Ошибка установки зависимостей
    goto :manual_install
)

echo ✅ Все зависимости установлены
goto :start_app

:manual_install
echo.
echo 🔧 Попробуем альтернативный метод установки...
cd server
if exist "%NPM_SCRIPT%" (
    "%NODE_EXE%" "%NPM_SCRIPT%" install
) else (
    npm install
)
cd..

:start_app
echo.
echo 🚀 Запускаем Suno RPC...
echo 📢 Откройте Discord и Suno AI
echo ⏳ Сервер запускается...
echo.

if exist "%NODE_EXE%" (
    cd server
    "%NODE_EXE%" server.js
) else (
    npm start
)

pause
exit /b 0