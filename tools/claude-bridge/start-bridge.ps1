# Starts the claude-bridge in the foreground (launched by run-hidden.vbs). ASCII only on purpose.
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here
$log = Join-Path $here 'bridge.log'
node (Join-Path $here 'bridge.js') *>> $log
