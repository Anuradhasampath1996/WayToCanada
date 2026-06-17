# Verify local dev points at the real database (Windows PostgreSQL db_cws).
# Usage: powershell -ExecutionPolicy Bypass -File scripts/verify-local-database.ps1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$EnvFile = Join-Path $Root "backend\.env"
$Psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

Write-Host ">>> WayToCanada database check" -ForegroundColor Cyan

if (-not (Test-Path $EnvFile)) {
    Write-Host "FAIL: backend/.env not found" -ForegroundColor Red
    exit 1
}

$envContent = Get-Content $EnvFile -Raw
$port = if ($envContent -match 'DB_CWS_PORT=(\d+)') { $Matches[1] } else { "?" }
$db = if ($envContent -match 'DB_CWS_DATABASE=(\S+)') { $Matches[1] } else { "?" }
$appEnv = if ($envContent -match 'APP_ENV=(\S+)') { $Matches[1] } else { "?" }

Write-Host "  APP_ENV            = $appEnv"
Write-Host "  DB_CWS_PORT        = $port"
Write-Host "  DB_CWS_DATABASE    = $db"

$ok = $true
if ($port -ne "5432") {
    Write-Host "WARN: Port should be 5432 (Windows PostgreSQL with your data)" -ForegroundColor Yellow
    $ok = $false
}
if ($db -ne "db_cws") {
    Write-Host "WARN: Database should be db_cws (not db_cws_test)" -ForegroundColor Yellow
    $ok = $false
}
if ($appEnv -eq "testing") {
    Write-Host "WARN: APP_ENV=testing can wipe DB when running tests" -ForegroundColor Yellow
    $ok = $false
}

$svc = Get-Service postgresql-x64-18 -ErrorAction SilentlyContinue
if (-not $svc -or $svc.Status -ne "Running") {
    Write-Host "FAIL: Windows PostgreSQL service not running (postgresql-x64-18)" -ForegroundColor Red
    Write-Host "      Start: net start postgresql-x64-18 (as Administrator)" -ForegroundColor DarkGray
    exit 1
}

$env:PGPASSWORD = "secret"
$userCount = & $Psql -h 127.0.0.1 -p 5432 -U postgres -d db_cws -tAc "SELECT COUNT(*) FROM users" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAIL: Cannot connect to db_cws on 5432: $userCount" -ForegroundColor Red
    exit 1
}

Write-Host "  db_cws users       = $userCount" -ForegroundColor Green

if ([int]$userCount -lt 1) {
    Write-Host "WARN: No users in db_cws - wrong or empty database?" -ForegroundColor Yellow
    $ok = $false
}

if ($ok) {
    Write-Host "OK: Local database configuration looks correct." -ForegroundColor Green
    Write-Host "See: scripts/LOCAL-DEV-DATABASE.md" -ForegroundColor DarkGray
    exit 0
}

Write-Host "FIX: Edit backend/.env - see scripts/LOCAL-DEV-DATABASE.md" -ForegroundColor Yellow
exit 1
