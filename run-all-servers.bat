@echo off
setlocal enabledelayedexpansion

REM Run all main project servers and show URLs.
REM This script assumes Docker, Composer, and Node are installed and available in PATH.

set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

echo.
echo ========================================
echo Starting WayToCanada servers...
echo ========================================
echo.
echo Backend API: http://localhost:8000
echo OCR service: http://localhost:8001/api/v1
echo LocalStack: http://localhost:4566
echo.
echo Frontend app URLs:
echo   Admin Dashboard:       http://localhost:3000
echo   Public Users Dashboard: http://localhost:3001
echo   Consultant Website:    http://localhost:3002
echo   Public Website:        http://localhost:3003
echo   Demo Dashboard:        http://localhost:3004
echo   Consultant Dashboard:  http://localhost:3005
echo.
echo Launching docker-compose services...
start "Docker Compose" cmd /k "cd /d "%PROJECT_ROOT%" && docker compose up"
echo Launching Laravel backend (API + queue + Vite)...
start "Backend" cmd /k "cd /d "%PROJECT_ROOT%backend" && composer run dev"
echo Launching Admin Dashboard...
start "Admin Dashboard" cmd /k "cd /d "%PROJECT_ROOT%frontend\Admins Dashbord" && npx next dev -p 3000"
echo Launching Public Users Dashboard...
start "Public Users Dashboard" cmd /k "cd /d "%PROJECT_ROOT%frontend\Public users Dashbord" && npx next dev -p 3001"
echo Launching Consultant Website...
start "Consultant Website" cmd /k "cd /d "%PROJECT_ROOT%frontend\Consultant Website" && npx next dev -p 3002"
echo Launching Public Website...
start "Public Website" cmd /k "cd /d "%PROJECT_ROOT%frontend\Publick website" && npx next dev -p 3003"
echo Launching Demo Dashboard...
start "Demo Dashboard" cmd /k "cd /d "%PROJECT_ROOT%frontend\Demo Dashbord" && npx next dev -p 3004"
echo Launching Consultant Dashboard...
start "Consultant Dashboard" cmd /k "cd /d "%PROJECT_ROOT%frontend\Consultant Dashbord" && npx next dev -p 3005"
echo Launching Stripe Webhook ^(requires: setup-stripe-cli.bat once^)...
start "Stripe Webhook" cmd /k "cd /d "%PROJECT_ROOT%" && run-stripe-webhook.bat"
echo.
echo All launch commands sent. Please check each window for startup logs.
echo.
echo Stripe webhook: copy whsec_... from the Stripe Webhook window into
echo Admin - Payment Gateway - Signing Secret if not done yet.
echo.
pause
