@echo off
setlocal

set "STRIPE=%LOCALAPPDATA%\stripe-cli\stripe.exe"

if not exist "%STRIPE%" (
  echo Stripe CLI not found. Run setup-stripe-cli.bat first.
  pause
  exit /b 1
)

echo.
echo ========================================
echo Stripe Webhook - Local Forwarding
echo ========================================
echo.
echo Target: http://localhost:8000/api/v1/webhooks/stripe
echo.
echo After this starts, copy the whsec_... signing secret
echo and paste it in Admin Dashboard:
echo   http://localhost:3000/admindashboard/payment-gateway
echo   - Signing Secret field - Save Settings
echo.
echo Keep this window open while testing payments.
echo Press Ctrl+C to stop.
echo.
echo ========================================
echo.

"%STRIPE%" listen ^
  --forward-to localhost:8000/api/v1/webhooks/stripe ^
  --events checkout.session.completed,invoice.paid,customer.subscription.updated,customer.subscription.deleted

pause
