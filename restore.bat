@echo off

echo ==========================================
echo    Digital Closet - Restore
echo ==========================================
echo.

set BACKUP_DIR=%~dp0backups

:: List available backups
echo Available backups:
echo.
dir /b /ad "%BACKUP_DIR%" 2>nul
if %errorlevel% neq 0 (
    echo No backups found.
    pause
    exit /b 1
)

echo.
set /p BACKUP_NAME=Enter backup folder name:
set BACKUP_PATH=%BACKUP_DIR%\%BACKUP_NAME%

if not exist "%BACKUP_PATH%\database.dump" (
    echo *** ERROR: %BACKUP_PATH%\database.dump not found ***
    pause
    exit /b 1
)

echo.
echo WARNING: Restore will overwrite existing data!
set /p CONFIRM=Continue? (y/N):
if /i not "%CONFIRM%"=="y" (
    echo Cancelled.
    pause
    exit /b 0
)

echo.
echo [1/2] Restoring database...
docker cp "%BACKUP_PATH%\database.dump" closet-db:/tmp/closet_backup.dump
docker exec closet-db pg_restore -U closet -d closet --clean --if-exists /tmp/closet_backup.dump
docker exec closet-db rm /tmp/closet_backup.dump
echo Database restored.
echo.

if exist "%BACKUP_PATH%\images.tar.gz" (
    echo [2/2] Restoring images...
    docker run --rm -v closet_images:/data -v "%BACKUP_PATH%":/backup alpine sh -c "rm -rf /data/* && tar xzf /backup/images.tar.gz -C /data"
    echo Images restored.
) else (
    echo [2/2] Skipping image restore (images.tar.gz not found)
)

echo.
echo ==========================================
echo  Restore complete! Restart services:
echo  stop.bat then start.bat
echo ==========================================
echo.
pause
