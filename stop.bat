@echo off

echo ==========================================
echo    Digital Closet - Stop All Services
echo ==========================================
echo.

docker compose -f docker-compose.yml -f docker-compose.tunnel.yml down 2>nul
docker compose down 2>nul
echo.
echo All services stopped.
echo.
pause
