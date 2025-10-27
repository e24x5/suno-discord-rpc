@echo off
@chcp 65001 >nul
title Suno Discord RPC

:: === НАСТРОЙКИ ===
set "RPC_DIR=C:\suno-discord-rpc"
set "NODE_CMD=node server.js"
set "LOG_FILE=%RPC_DIR%\rpc_log.txt"

echo [%date% %time%] ▶ Запуск ожидания Discord... >> "%LOG_FILE%"

:: === 1. Ждём процесс Discord ===
:waitDiscord
tasklist | find /I "Discord.exe" >nul
if errorlevel 1 (
  echo [%date% %time%] ⏳ Discord не запущен, повтор через 5 сек... >> "%LOG_FILE%"
  timeout /t 5 >nul
  goto waitDiscord
)
echo [%date% %time%] ✅ Discord запущен, проверяю RPC... >> "%LOG_FILE%"

:: === 2. Ждём пока появится IPC ===
set "IPC_READY=0"
for /L %%i in (0,1,9) do (
  if exist "\\?\pipe\discord-ipc-%%i" set "IPC_READY=1"
)
if "%IPC_READY%"=="0" (
  echo [%date% %time%] ⏳ RPC не готов, повтор через 3 сек... >> "%LOG_FILE%"
  timeout /t 3 >nul
  goto waitDiscord
)
echo [%date% %time%] ✅ Найден RPC-канал Discord, стартую сервер... >> "%LOG_FILE%"

:: === 3. Запуск сервера и автоперезапуск ===
cd /d "%RPC_DIR%"
:loop
echo [%date% %time%] ▶ Запуск node server.js >> "%LOG_FILE%"
%NODE_CMD% >> "%LOG_FILE%" 2>&1
echo [%date% %time%] ⚠️ Сервер завершился, перезапуск через 5 секунд... >> "%LOG_FILE%"
timeout /t 5 >nul
goto loop
