# Create-Desktop-Shortcut.ps1 — Places 1-click Start and Stop shortcuts on your Windows Desktop

$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
$ProjectDir = (Get-Item $PSScriptRoot).FullName

# 1. Start KyroPad Shortcut (Opens console window with IP; close window with 'X' to stop)
$StartShortcutPath = Join-Path $DesktopPath "KyroPad.lnk"
$StartShortcut = $WshShell.CreateShortcut($StartShortcutPath)
$StartShortcut.TargetPath = "$ProjectDir\KyroPad.bat"
$StartShortcut.WorkingDirectory = "$ProjectDir"
$StartShortcut.Description = "Launch KyroPad Server (Close window to stop)"
$IconFile = "$ProjectDir\server\icon.ico"
if (Test-Path $IconFile) {
    $StartShortcut.IconLocation = "$IconFile,0"
}
$StartShortcut.Save()
Write-Host "Created Desktop Shortcut: KyroPad (Start)" -ForegroundColor Cyan

# 2. Stop KyroPad Shortcut (1-click force stop)
$StopShortcutPath = Join-Path $DesktopPath "Stop KyroPad.lnk"
$StopShortcut = $WshShell.CreateShortcut($StopShortcutPath)
$StopShortcut.TargetPath = "$ProjectDir\Stop-KyroPad.bat"
$StopShortcut.WorkingDirectory = "$ProjectDir"
$StopShortcut.Description = "Stop KyroPad Server"
$StopShortcut.IconLocation = "shell32.dll,27" # Red stop/cross icon from Windows
$StopShortcut.Save()
Write-Host "Created Desktop Shortcut: Stop KyroPad" -ForegroundColor Yellow
