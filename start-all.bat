@echo off

echo ==========================================
echo    Digital Closet - Start All Services
echo ==========================================
echo.

echo [1/3] Starting PostgreSQL database...
docker compose up -d db
if %errorlevel% neq 0 (
    echo.
    echo *** ERROR: Please start Docker Desktop first! ***
    pause
    exit /b 1
)
echo Database started.
echo.

echo [2/3] Starting API server (port 3001)...
start "Closet API" cmd /k "cd /d %~dp0apps\api && set DOTENV_CONFIG_PATH=%~dp0.env && npx tsx src/server.ts"
timeout /t 3 /nobreak >nul
echo API started.
echo.

echo [3/3] Starting Web frontend (port 8083)...
start "Closet Web" cmd /k "cd /d %~dp0apps\mobile && npx expo start --web --port 8083"
timeout /t 3 /nobreak >nul
echo Web started.
echo.

echo ==========================================
echo  All services started!
echo  Frontend: http://localhost:8083
echo  API:      http://localhost:3001
echo ==========================================
echo.
pause
