@echo off

echo ==========================================
echo    Digital Closet - Start All (Docker)
echo ==========================================
echo.

echo Starting all services (DB + API + Web)...
docker compose up -d --build
if %errorlevel% neq 0 (
    echo.
    echo *** ERROR: Please start Docker Desktop first! ***
    pause
    exit /b 1
)

echo.
echo ==========================================
echo  All services started!
echo.
echo  Frontend: http://localhost:8083
echo  API:      http://localhost:3001
echo.
echo  Stop:     stop.bat
echo  Logs:     docker compose logs -f
echo ==========================================
echo.
pause
