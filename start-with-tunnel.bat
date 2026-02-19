@echo off

echo ==========================================
echo    ClosetIQ - Start (Docker + Tunnel)
echo ==========================================
echo.

echo Starting all services (DB + API + Web + Tunnel)...
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d --build
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
echo  Local access:
echo    Frontend: http://localhost:8083
echo    API:      http://localhost:3001
echo.
echo  Tunnel access: See your Cloudflare Tunnel config
echo.
echo  View logs:  docker compose logs -f
echo  API logs:   docker compose logs -f api
echo  Web logs:   docker compose logs -f web
echo  Stop:       stop.bat
echo ==========================================
echo.
pause
