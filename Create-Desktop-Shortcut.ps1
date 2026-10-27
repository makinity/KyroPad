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
Write-Host "Created Desktop Shortcut: KyroPad" -ForegroundColor Cyan
