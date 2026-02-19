@echo off

echo ==========================================
echo    Digital Closet - Backup
echo ==========================================
echo.

:: Set backup directory
set BACKUP_DIR=%~dp0backups
set TIMESTAMP=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%
set TIMESTAMP=%TIMESTAMP: =0%
set BACKUP_PATH=%BACKUP_DIR%\%TIMESTAMP%

:: Create backup directory
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
mkdir "%BACKUP_PATH%"

echo [1/2] Backing up database...
docker exec closet-db pg_dump -U closet -d closet -F c -f /tmp/closet_backup.dump
if %errorlevel% neq 0 (
    echo *** ERROR: Database backup failed. Is the service running? ***
    pause
    exit /b 1
)
docker cp closet-db:/tmp/closet_backup.dump "%BACKUP_PATH%\database.dump"
docker exec closet-db rm /tmp/closet_backup.dump
echo Database backed up to %BACKUP_PATH%\database.dump
echo.

echo [2/2] Backing up images...
docker run --rm -v closet_images:/data -v "%BACKUP_PATH%":/backup alpine tar czf /backup/images.tar.gz -C /data .
echo Images backed up to %BACKUP_PATH%\images.tar.gz
echo.

echo ==========================================
echo  Backup complete!
echo  Location: %BACKUP_PATH%
echo.
echo  Files:
dir /b "%BACKUP_PATH%"
echo ==========================================
echo.
pause
