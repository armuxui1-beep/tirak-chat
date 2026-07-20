@echo off
title Tirak Chat - Vercel Deployment
cd /d "%~dp0"

echo =========================================================
echo [Step 1] Building Tirak Chat production bundle...
echo =========================================================
cmd /c "npm run build"

echo.
echo =========================================================
echo [Step 2] Logging in and Deploying to Vercel...
echo If prompted "Set up and deploy?", press Y and Enter.
echo If not logged in, please complete sign-in in browser.
echo =========================================================
cmd /c "npx -y vercel --prod"
if %errorlevel% neq 0 (
    echo.
    echo Vercel login required or initial project setup...
    cmd /c "npx -y vercel login"
    echo.
    echo Retrying production deployment to Vercel...
    cmd /c "npx -y vercel --prod"
)

echo.
echo =========================================================
echo Vercel Deployment Completed! Check your Vercel Dashboard.
echo =========================================================
pause
