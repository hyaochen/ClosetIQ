' Hidden-window launcher. Task Scheduler must run THIS (wscript.exe run-hidden.vbs),
' never powershell.exe directly: a direct powershell task flashes a black console window.
Set sh = CreateObject("WScript.Shell")
here = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & here & "\start-bridge.ps1""", 0, False
