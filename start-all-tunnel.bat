@echo off

echo ==========================================
echo    ClosetIQ - Start All (Tunnel Mode)
echo ==========================================
echo.

echo [1/4] Starting PostgreSQL database...
docker compose up -d db
if %errorlevel% neq 0 (
    echo.
    echo *** ERROR: Please start Docker Desktop first! ***
    pause
    exit /b 1
)
echo Database started.
echo.

echo [2/4] Starting API server (port 3001)...
start "Closet API" cmd /k "cd /d %~dp0apps\api && set DOTENV_CONFIG_PATH=%~dp0.env && npx tsx src/server.ts"
timeout /t 5 /nobreak >nul
echo API started.
echo.

echo [3/4] Starting Web frontend - Tunnel mode (port 8083)...
start "Closet Web" cmd /k "cd /d %~dp0apps\mobile && copy /Y .env.tunnel .env && npx expo start --web --port 8083 --clear"
timeout /t 3 /nobreak >nul
echo Web started.
echo.

echo [4/4] Starting Cloudflare Tunnel...
start "Closet Tunnel" cmd /k "cloudflared tunnel --config %USERPROFILE%\.cloudflared\closet-config.yml run closet"
timeout /t 3 /nobreak >nul
echo Tunnel started.
echo.

echo ==========================================
echo  All services started!
echo.
echo  Local:  http://localhost:8083
echo  Tunnel: See your Cloudflare config
echo ==========================================
echo.
pause
