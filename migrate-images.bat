@echo off

echo ==========================================
echo    Digital Closet - Migrate Local Images
echo ==========================================
echo.

set LOCAL_IMAGES=%~dp0apps\api\data\images

if not exist "%LOCAL_IMAGES%" (
    echo Local image directory not found: %LOCAL_IMAGES%
    echo Nothing to migrate.
    pause
    exit /b 0
)

echo Copying %LOCAL_IMAGES% to Docker volume (closet_images)...
echo.

:: Create a temporary container to copy files into the volume
docker run --rm -v closet_images:/data -v "%LOCAL_IMAGES%":/source alpine sh -c "cp -r /source/* /data/ 2>/dev/null && echo 'Done' || echo 'No files to copy'"

echo.
echo Migration complete!
echo.
pause
