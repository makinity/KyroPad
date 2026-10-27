@echo off
title KyroPad Server
cd /d "%~dp0server"

echo ===================================================
echo               KYROPAD SERVER LAUNCHER              
echo ===================================================
echo.

if exist "..\venv\Scripts\python.exe" (
    set "PYTHON_CMD=..\venv\Scripts\python.exe"
) else (
    set "PYTHON_CMD=python"
)

echo Starting KyroPad Server...
echo Web App URL:  http://localhost:8080
echo WebSocket:    ws://localhost:8080
echo.
echo Minimize this window or close via the System Tray icon.
echo ===================================================
echo.

%PYTHON_CMD% main.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Server exited with an error. Press any key to close.
    pause >nul
)
