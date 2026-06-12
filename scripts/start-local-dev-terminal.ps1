# Run all WayToCanada services in the CURRENT terminal (Cursor integrated terminal).
# Usage: powershell -ExecutionPolicy Bypass -File scripts/start-local-dev-terminal.ps1
# Stop: Ctrl+C
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Backend = Join-Path $Root "backend"
$Fe = Join-Path $Root "frontend"
$Concurrently = Join-Path $Backend "node_modules\.bin\concurrently.cmd"
$BatDir = Join-Path $env:TEMP "wtc-dev-bats"

if (-not (Test-Path $Concurrently)) {
    Write-Host ">>> Installing concurrently in backend..." -ForegroundColor Yellow
    Push-Location $Backend
    npm install --no-audit --no-fund 2>$null
    Pop-Location
}

Write-Host ">>> WayToCanada - single terminal mode" -ForegroundColor Cyan

Push-Location $Root
docker compose -f docker-compose.dev.yml up -d
Pop-Location

Write-Host ">>> Waiting for Postgres on :5433..." -ForegroundColor Yellow
for ($i = 1; $i -le 30; $i++) {
    docker exec wtc_postgres_dev pg_isready -U postgres 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 2
}

if (-not (Test-Path (Join-Path $Backend ".env"))) {
    Copy-Item (Join-Path $Backend ".env.example") (Join-Path $Backend ".env")
}

Push-Location $Backend
if (-not (Select-String -Path ".env" -Pattern "^APP_KEY=base64:" -Quiet)) {
    php artisan key:generate --force | Out-Null
}
$env:DB_CWS_PORT = "5433"
$env:DB_LMS_PORT = "5433"
$env:DB_LEGAL_PORT = "5433"
$env:DB_CWS_HOST = "127.0.0.1"
$env:DB_LMS_HOST = "127.0.0.1"
$env:DB_LEGAL_HOST = "127.0.0.1"
$env:DB_CWS_PASSWORD = "secret"
$env:DB_LMS_PASSWORD = "secret"
$env:DB_LEGAL_PASSWORD = "secret"
$env:DB_CWS_USERNAME = "postgres"
$env:DB_LMS_USERNAME = "postgres"
$env:DB_LEGAL_USERNAME = "postgres"
php artisan migrate --force 2>$null
php artisan db:seed --class=RolesAndPermissionsSeeder --force 2>$null
Pop-Location

function New-WtcBat {
    param(
        [string]$Name,
        [string]$WorkDir,
        [string[]]$Lines
    )
    if (-not (Test-Path $BatDir)) {
        New-Item -ItemType Directory -Path $BatDir -Force | Out-Null
    }
    $path = Join-Path $BatDir "$Name.bat"
    $content = @("@echo off", "cd /d `"$WorkDir`"") + $Lines
    Set-Content -Path $path -Value ($content -join "`r`n") -Encoding ASCII
    return $path
}

function New-FrontendBat {
    param(
        [string]$Name,
        [string]$Dir,
        [int]$Port,
        [string[]]$ExtraEnv = @()
    )
    $dev = if (Test-Path (Join-Path $Dir "pnpm-lock.yaml")) {
        "pnpm dev --port $Port"
    } else {
        "npm run dev -- --port $Port"
    }
    $lines = @("set NEXT_PUBLIC_API_URL=http://127.0.0.1:8000") + $ExtraEnv + $dev
    return New-WtcBat $Name $Dir $lines
}

Write-Host ""
Write-Host "=== Local URLs ===" -ForegroundColor Green
Write-Host "  API:                http://127.0.0.1:8000"
Write-Host "  Public website:     http://localhost:3000"
Write-Host "  Admin dashboard:    http://localhost:3001"
Write-Host "  Users dashboard:    http://localhost:3002"
Write-Host "  Consultant website: http://localhost:3003"
Write-Host "  Consultant dash:    http://localhost:3005"
Write-Host ""
Write-Host ">>> Starting all services (Ctrl+C to stop)..." -ForegroundColor Yellow

$apiBat = New-WtcBat "api" $Backend @(
    "set DB_CWS_PORT=5433",
    "set DB_LMS_PORT=5433",
    "set DB_LEGAL_PORT=5433",
    "set DB_CWS_HOST=127.0.0.1",
    "set DB_LMS_HOST=127.0.0.1",
    "set DB_LEGAL_HOST=127.0.0.1",
    "set DB_CWS_PASSWORD=secret",
    "set DB_CWS_USERNAME=postgres",
    "php artisan serve --host=127.0.0.1 --port=8000"
)
$queueBat = New-WtcBat "queue" $Backend @("php artisan queue:listen --tries=1")
$webBat = New-FrontendBat "web" (Join-Path $Fe "Publick website") 3000 @(
    "set NEXT_PUBLIC_APP_URL=http://localhost:3000",
    "set NEXT_PUBLIC_USER_DASHBOARD_URL=http://localhost:3002",
    "set NEXT_PUBLIC_CONSULTANT_WEBSITE_URL=http://localhost:3003"
)
$adminBat = New-FrontendBat "admin" (Join-Path $Fe "Admins Dashbord") 3001 @(
    "set NEXT_PUBLIC_APP_URL=http://localhost:3001"
)
$usersBat = New-FrontendBat "users" (Join-Path $Fe "Public users Dashbord") 3002 @(
    "set NEXT_PUBLIC_APP_URL=http://localhost:3002",
    "set NEXT_PUBLIC_PUBLIC_WEBSITE_URL=http://localhost:3000",
    "set NEXT_PUBLIC_OCR_URL=http://127.0.0.1:8001"
)
$consSiteBat = New-FrontendBat "cons-site" (Join-Path $Fe "Consultant Website") 3003 @(
    "set NEXT_PUBLIC_APP_URL=http://localhost:3003",
    "set NEXT_PUBLIC_CONSULTANT_DASHBOARD_URL=http://localhost:3005",
    "set NEXT_PUBLIC_USER_DASHBOARD_URL=http://localhost:3002",
    "set NEXT_PUBLIC_ADMIN_DASHBOARD_URL=http://localhost:3001"
)
$consDashBat = New-FrontendBat "cons-dash" (Join-Path $Fe "Consultant Dashbord") 3005 @(
    "set NEXT_PUBLIC_APP_URL=http://localhost:3005",
    "set NEXT_PUBLIC_CONSULTANT_WEBSITE_URL=http://localhost:3003"
)

& $Concurrently `
  --kill-others-on-fail `
  -n "api,queue,web,admin,users,cons-site,cons-dash" `
  -c "blue,magenta,green,yellow,cyan,red,white" `
  $apiBat `
  $queueBat `
  $webBat `
  $adminBat `
  $usersBat `
  $consSiteBat `
  $consDashBat
