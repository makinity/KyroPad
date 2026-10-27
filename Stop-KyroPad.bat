@echo off
title Stop KyroPad
echo ========================================
echo        STOPPING KYROPAD SERVER...        
echo ========================================

:: 1. Kill any process listening on port 8080
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080" ^| findstr "LISTENING"') do (
    echo Stopping process PID %%a on port 8080...
    taskkill /F /PID %%a >nul 2>&1
)

:: 2. Terminate any python running server\main.py
wmic process where "commandline like '%%server\\main.py%%'" call terminate >nul 2>&1

echo.
echo [OK] KyroPad Server has been completely stopped!
timeout /t 2 >nul
