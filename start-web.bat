@echo off

echo [Starting Web frontend]
cd /d "%~dp0apps\mobile"
npx expo start --web --port 8083
