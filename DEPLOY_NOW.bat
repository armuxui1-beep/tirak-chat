@echo off
title Deploying Tirak Chat to Firebase...
cd /d "%~dp0"

echo [Step 1] Building production bundle...
cmd /c "npm run build"

echo.
echo [Step 2] Deploying to Firebase Cloud...
cmd /c "npx -y firebase-tools deploy"
if %errorlevel% neq 0 (
    echo Fallback: Deploying using global firebase CLI...
    cmd /c "firebase deploy"
)

echo.
echo ===================================================
echo Deployment completed! Check tirakchat.app online.
echo ===================================================
pause
