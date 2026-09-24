@echo off
:: ============================================================
:: WinDeck Remote — Fix Firewall Rules (Run as Administrator)
:: ============================================================

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [INFO] Requesting Administrator permissions...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"
echo.
echo =======================================================
echo WinDeck Remote - Updating Windows Firewall Rules
echo =======================================================
echo.

echo [1/3] Removing old / blocking firewall rules...
netsh advfirewall firewall delete rule name="windeckremote" >nul 2>&1
netsh advfirewall firewall delete rule name="WinDeck Remote" >nul 2>&1
netsh advfirewall firewall delete rule name="WinDeck Remote Port" >nul 2>&1
netsh advfirewall firewall delete rule name="WinDeck Remote App" >nul 2>&1
netsh advfirewall firewall delete rule name="KyroPad Port" >nul 2>&1
netsh advfirewall firewall delete rule name="KyroPad App" >nul 2>&1

echo [2/3] Adding Allow rule for Port 8080 (Server) and 8081 (Metro Bundler)...
netsh advfirewall firewall add rule name="KyroPad Port" dir=in action=allow protocol=TCP localport=8080 profile=any
netsh advfirewall firewall add rule name="Expo Metro Port" dir=in action=allow protocol=TCP localport=8081 profile=any

echo [3/3] Adding Allow rule for KyroPad.exe executable...
if exist "dist\KyroPad.exe" (
    netsh advfirewall firewall add rule name="KyroPad App" dir=in action=allow program="%~dp0dist\KyroPad.exe" enable=yes profile=any
)
if exist "dist\WinDeckRemote.exe" (
    netsh advfirewall firewall add rule name="WinDeck Remote App" dir=in action=allow program="%~dp0dist\WinDeckRemote.exe" enable=yes profile=any
)

echo.
echo [SUCCESS] Windows Firewall is now configured to allow KyroPad!
echo.
pause
