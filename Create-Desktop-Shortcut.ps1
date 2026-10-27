# Create-Desktop-Shortcut.ps1 — Places a 1-click KyroPad launcher on your Windows Desktop

$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
$ProjectDir = (Get-Item $PSScriptRoot).FullName
$ShortcutPath = Join-Path $DesktopPath "KyroPad.lnk"

$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = "`"$ProjectDir\Launch-KyroPad.vbs`""
$Shortcut.WorkingDirectory = "$ProjectDir\server"
$Shortcut.Description = "Launch KyroPad Windows 11 Remote Server"

$IconFile = "$ProjectDir\server\icon.ico"
if (Test-Path $IconFile) {
    $Shortcut.IconLocation = "$IconFile,0"
}

$Shortcut.Save()
Write-Host "Success! Created KyroPad shortcut on your Desktop: $ShortcutPath" -ForegroundColor Cyan
