@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo    ClosetIQ - Cloudflare Tunnel
echo ==========================================
echo.
echo  Make sure API (port 3001) and Web (port 8083) are running first!
echo.

:: Check if API is running on port 3001
netstat -an | findstr ":3001.*LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo *** WARNING: API is NOT running on port 3001! ***
    echo *** Start services first with: start-all.bat or start.bat ***
    echo.
    set /p CONT=Continue anyway? (y/N):
    if /i not "!CONT!"=="y" (
        pause
        exit /b 1
    )
)

:: Check if Web is running on port 8083
netstat -an | findstr ":8083.*LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo *** WARNING: Web frontend is NOT running on port 8083! ***
    echo *** Start services first with: start-all.bat or start.bat ***
    echo.
    set /p CONT=Continue anyway? (y/N):
    if /i not "!CONT!"=="y" (
        pause
        exit /b 1
    )
)

echo Starting tunnel...
echo.
cloudflared tunnel --config "%USERPROFILE%\.cloudflared\closet-config.yml" run closet
