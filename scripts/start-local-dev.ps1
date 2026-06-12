# Start all WayToCanada services in separate PowerShell windows.
# For Cursor integrated terminal use: scripts/start-local-dev-terminal.ps1
# Usage: powershell -ExecutionPolicy Bypass -File scripts/start-local-dev.ps1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host ">>> WayToCanada local dev" -ForegroundColor Cyan
Write-Host ">>> Project root: $Root"

function Start-DevWindow {
    param(
        [string]$Title,
        [string]$Command
    )
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "`$Host.UI.RawUI.WindowTitle = '$Title'; $Command"
    ) | Out-Null
}

function Start-Frontend {
    param(
        [string]$Title,
        [string]$Dir,
        [int]$Port,
        [hashtable]$Env = @{}
    )
    $envLines = @(
        "`$env:NEXT_PUBLIC_API_URL='http://127.0.0.1:8000'"
    )
    foreach ($key in $Env.Keys) {
        $envLines += "`$env:$key='$($Env[$key])'"
    }
    $envBlock = $envLines -join "; "
    $pkgManager = if (Test-Path (Join-Path $Dir "pnpm-lock.yaml")) { "pnpm" } else { "npm run" }
    $devCmd = if ($pkgManager -eq "pnpm") { "pnpm dev --port $Port" } else { "npm run dev -- --port $Port" }
    $cmd = "cd '$Dir'; $envBlock; $devCmd"
    Start-DevWindow -Title "WTC: $Title" -Command $cmd
}

Write-Host ">>> Starting Docker (Postgres, LocalStack, OCR)..." -ForegroundColor Yellow
Push-Location $Root
docker compose -f docker-compose.dev.yml up -d
Pop-Location

Write-Host ">>> Waiting for Postgres..." -ForegroundColor Yellow
for ($i = 1; $i -le 30; $i++) {
    docker exec wtc_postgres_dev pg_isready -U postgres 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 2
}

$backend = Join-Path $Root "backend"
if (-not (Test-Path (Join-Path $backend ".env"))) {
    Copy-Item (Join-Path $backend ".env.example") (Join-Path $backend ".env")
    Write-Host ">>> Created backend/.env from .env.example"
}

Push-Location $backend
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

Write-Host ">>> Starting Laravel API + queue..." -ForegroundColor Yellow
$apiEnv = @"
`$env:DB_CWS_PORT='5433'; `$env:DB_LMS_PORT='5433'; `$env:DB_LEGAL_PORT='5433';
`$env:DB_CWS_HOST='127.0.0.1'; `$env:DB_LMS_HOST='127.0.0.1'; `$env:DB_LEGAL_HOST='127.0.0.1';
`$env:DB_CWS_PASSWORD='secret'; `$env:DB_CWS_USERNAME='postgres';
cd '$backend'; php artisan serve --host=127.0.0.1 --port=8000
"@
Start-DevWindow -Title "WTC: API :8000" -Command $apiEnv
Start-Sleep -Seconds 1
Start-DevWindow -Title "WTC: Queue" -Command "cd '$backend'; php artisan queue:listen --tries=1"

Write-Host ">>> Starting frontends..." -ForegroundColor Yellow
$fe = Join-Path $Root "frontend"

Start-Frontend -Title "Public Website :3000" `
    -Dir (Join-Path $fe "Publick website") -Port 3000 -Env @{
        NEXT_PUBLIC_APP_URL                         = "http://localhost:3000"
        NEXT_PUBLIC_USER_DASHBOARD_URL              = "http://localhost:3002"
        NEXT_PUBLIC_CONSULTANT_WEBSITE_URL          = "http://localhost:3003"
    }

Start-Frontend -Title "Admin Dashboard :3001" `
    -Dir (Join-Path $fe "Admins Dashbord") -Port 3001 -Env @{
        NEXT_PUBLIC_APP_URL = "http://localhost:3001"
    }

Start-Frontend -Title "Users Dashboard :3002" `
    -Dir (Join-Path $fe "Public users Dashbord") -Port 3002 -Env @{
        NEXT_PUBLIC_APP_URL            = "http://localhost:3002"
        NEXT_PUBLIC_PUBLIC_WEBSITE_URL = "http://localhost:3000"
        NEXT_PUBLIC_OCR_URL            = "http://127.0.0.1:8001"
    }

Start-Frontend -Title "Consultant Website :3003" `
    -Dir (Join-Path $fe "Consultant Website") -Port 3003 -Env @{
        NEXT_PUBLIC_APP_URL                  = "http://localhost:3003"
        NEXT_PUBLIC_CONSULTANT_DASHBOARD_URL = "http://localhost:3005"
        NEXT_PUBLIC_USER_DASHBOARD_URL       = "http://localhost:3002"
        NEXT_PUBLIC_ADMIN_DASHBOARD_URL      = "http://localhost:3001"
    }

Start-Frontend -Title "Consultant Dashboard :3005" `
    -Dir (Join-Path $fe "Consultant Dashbord") -Port 3005 -Env @{
        NEXT_PUBLIC_APP_URL              = "http://localhost:3005"
        NEXT_PUBLIC_CONSULTANT_WEBSITE_URL = "http://localhost:3003"
    }

Write-Host ""
Write-Host "=== Local URLs ===" -ForegroundColor Green
Write-Host "  API:                  http://127.0.0.1:8000"
Write-Host "  Public website:       http://localhost:3000"
Write-Host "  Admin dashboard:      http://localhost:3001"
Write-Host "  Users dashboard:      http://localhost:3002"
Write-Host "  Consultant website:   http://localhost:3003"
Write-Host "  Consultant dashboard:   http://localhost:3005"
Write-Host "  OCR service:          http://127.0.0.1:8001"
Write-Host ""
Write-Host "Each service runs in its own PowerShell window." -ForegroundColor Cyan
Write-Host "Stop Docker: docker compose -f docker-compose.dev.yml down" -ForegroundColor DarkGray
