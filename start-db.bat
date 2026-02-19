@echo off

echo [Starting PostgreSQL database]
echo.
echo Make sure Docker Desktop is running!
echo.
docker compose up -d db
echo.
echo Database started (port 5432)
pause
