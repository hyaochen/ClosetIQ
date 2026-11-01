# Starts the tryon-bridge in the foreground. ASCII only on purpose. Not registered as a logon task.
# Windows PowerShell 5.1 wraps every native stderr line in a NativeCommandError, so with
# $ErrorActionPreference = 'Stop' the first python INFO line (stderr) would kill this script.
# Hand the redirection to cmd.exe instead: python's stderr never passes through PowerShell.
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here
$py = Join-Path $here '.venv\Scripts\python.exe'
$srv = Join-Path $here 'server.py'
$log = Join-Path $here 'bridge.log'
cmd.exe /c """$py"" ""$srv"" >> ""$log"" 2>&1"
exit $LASTEXITCODE
