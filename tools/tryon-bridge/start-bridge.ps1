# Starts the tryon-bridge in the foreground. ASCII only on purpose. Not registered as a logon task.
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here
$log = Join-Path $here 'bridge.log'
& (Join-Path $here '.venv\Scripts\python.exe') (Join-Path $here 'server.py') *>> $log
