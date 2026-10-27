Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get root project directory
projectDir = fso.GetParentFolderName(WScript.ScriptFullName)
pythonExe = projectDir & "\venv\Scripts\python.exe"
serverScript = projectDir & "\server\main.py"
serverDir = projectDir & "\server"

If Not fso.FileExists(pythonExe) Then
    pythonExe = "python.exe"
End If

' Run in server directory with hidden console window (0 = hidden)
WshShell.CurrentDirectory = serverDir
WshShell.Run """" & pythonExe & """ """ & serverScript & """", 0, False
