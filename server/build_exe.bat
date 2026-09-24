@echo off
:: ============================================================
:: WinDeck Remote — Build portable .exe
:: Requires: Python 3.10+, pip, pyinstaller in the venv
:: Run this script from the server\ directory.
:: ============================================================

echo.
echo [WinDeck Remote] Building portable .exe with PyInstaller...
echo.

:: Ensure we are in the correct directory (where main.py lives)
cd /d "%~dp0"

:: Activate virtual environment if one exists alongside the server folder
if exist "..\venv\Scripts\activate.bat" (
    echo [INFO] Activating virtual environment...
    call "..\venv\Scripts\activate.bat"
) else (
    echo [WARN] No venv found at ..\venv — using system Python.
)

:: Install dependencies before building
echo [INFO] Installing dependencies...
pip install -r requirements.txt --quiet

:: Build the executable
:: --onefile        : single portable .exe
:: --noconsole      : no terminal window (background tray app)
:: --name           : output binary name
:: --add-data       : include win_actions module explicitly
:: --hidden-import  : pystray and PIL backends not always auto-detected
pyinstaller ^
    --onefile ^
    --noconsole ^
    --name "WinDeckRemote" ^
    --hidden-import "pystray._win32" ^
    --hidden-import "PIL._imaging" ^
    --hidden-import "websockets.legacy.server" ^
    --hidden-import "pynput.mouse._win32" ^
    --hidden-import "pynput.keyboard._win32" ^
    main.py

echo.
if exist "dist\WinDeckRemote.exe" (
    echo [SUCCESS] Build complete: dist\WinDeckRemote.exe
) else (
    echo [ERROR] Build failed — check PyInstaller output above.
    exit /b 1
)

echo.
echo Copy dist\WinDeckRemote.exe to any Windows 11 machine and run it.
echo No Python installation required on the target machine.
echo.
pause
