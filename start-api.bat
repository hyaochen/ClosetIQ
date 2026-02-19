@echo off

echo [Starting API server]
set DOTENV_CONFIG_PATH=%~dp0.env
cd /d "%~dp0apps\api"
npx tsx src/server.ts
