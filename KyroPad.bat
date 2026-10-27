@echo off
title KyroPad Server
cd /d "%~dp0server"

if exist "..\venv\Scripts\python.exe" (
    set "PYTHON_CMD=..\venv\Scripts\python.exe"
) else (
    set "PYTHON_CMD=python"
)

%PYTHON_CMD% main.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Server stopped with code %ERRORLEVEL%. Press any key to exit.
    pause >nul
)
