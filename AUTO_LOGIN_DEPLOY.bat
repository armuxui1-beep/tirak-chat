@echo off
title Tirak Chat - Auto Login and Deploy
cd /d "%~dp0"

echo =========================================================
echo [Step 1] Opening Firebase Login...
echo Please allow sign-in in your browser when prompted.
echo =========================================================
cmd /c "npx -y firebase-tools login"

echo.
echo =========================================================
echo [Step 2] Deploying Tirak Chat to Cloud (tirakchat.app)...
echo =========================================================
cmd /c "npx -y firebase-tools deploy"

echo.
echo =========================================================
echo Deployment completed! Check https://tirakchat.app online.
echo =========================================================
pause
