Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get root project directory
projectDir = fso.GetParentFolderName(WScript.ScriptFullName)
pythonExe = projectDir & "\venv\Scripts\pythonw.exe"
serverScript = projectDir & "\server\main.py"
serverDir = projectDir & "\server"

' Verify files exist
If Not fso.FileExists(pythonExe) Then
    pythonExe = "pythonw.exe"
End If

' Start KyroPad silently in background (0 = hidden window)
WshShell.CurrentDirectory = serverDir
WshShell.Run """" & pythonExe & """ """ & serverScript & """", 0, False
