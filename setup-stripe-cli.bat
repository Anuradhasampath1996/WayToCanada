@echo off
setlocal

set "STRIPE=%LOCALAPPDATA%\stripe-cli\stripe.exe"

if not exist "%STRIPE%" (
  echo Stripe CLI not found. Installing...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-stripe-cli.ps1"
  if errorlevel 1 (
    echo Install failed.
    pause
    exit /b 1
  )
)

echo.
echo ========================================
echo Stripe CLI Setup
echo ========================================
echo.
echo Step 1: Login to Stripe ^(browser will open^)
echo.
"%STRIPE%" login

if errorlevel 1 (
  echo Login failed or was cancelled.
  pause
  exit /b 1
)

echo.
echo Login successful!
echo.
echo Step 2: Run webhook forwarding:
echo   run-stripe-webhook.bat
echo.
echo Or start all servers including webhook:
echo   run-all-servers.bat
echo.
pause
