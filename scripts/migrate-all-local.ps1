# Run ALL pending migrations on local databases (safe — does not delete data).
# Usage: powershell -ExecutionPolicy Bypass -File scripts/migrate-all-local.ps1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Backend = Join-Path $Root "backend"

Write-Host ">>> Verifying database config..." -ForegroundColor Cyan
& powershell -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\verify-local-database.ps1")
if ($LASTEXITCODE -ne 0) { exit 1 }

Push-Location $Backend

Write-Host ">>> Running all CWS migrations (db_cws)..." -ForegroundColor Yellow
php artisan migrate --force

Write-Host ">>> Seeding roles (if missing)..." -ForegroundColor Yellow
php artisan db:seed --class=RolesAndPermissionsSeeder --force

Write-Host ">>> Seeding LMS categories (db_lms via LMS migrations)..." -ForegroundColor Yellow
php artisan db:seed --class=LmsCategorySeeder --force

Write-Host ""
Write-Host ">>> Migration status (pending should be none):" -ForegroundColor Green
$pending = php artisan migrate:status 2>&1 | Select-String "Pending"
if ($pending) {
    Write-Host $pending -ForegroundColor Red
    Pop-Location
    exit 1
} else {
    Write-Host "  All CWS migrations: Ran" -ForegroundColor Green
}

$env:PGPASSWORD = "secret"
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$cwsTables = & $psql -h 127.0.0.1 -p 5432 -U postgres -d db_cws -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'"
$lmsTables = & $psql -h 127.0.0.1 -p 5432 -U postgres -d db_lms -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'"
$users = & $psql -h 127.0.0.1 -p 5432 -U postgres -d db_cws -tAc "SELECT COUNT(*) FROM users"

Write-Host ""
Write-Host "  db_cws tables : $cwsTables"
Write-Host "  db_lms tables : $lmsTables"
Write-Host "  db_cws users  : $users (unchanged)"
Write-Host ""
Write-Host "DONE — all migrations applied." -ForegroundColor Green

Pop-Location
