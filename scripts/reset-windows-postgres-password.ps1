# Reset Windows PostgreSQL 18 postgres user password (run as Administrator).
# Usage: Right-click PowerShell -> Run as Administrator, then:
#   powershell -ExecutionPolicy Bypass -File "F:\WayToCanada\WayToCanada\scripts\reset-windows-postgres-password.ps1"

$ErrorActionPreference = "Stop"
$PgData = "C:\Program Files\PostgreSQL\18\data"
$PgHba = Join-Path $PgData "pg_hba.conf"
$PgHbaBak = Join-Path $PgData "pg_hba.conf.bak-wtc"
$Psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$Service = "postgresql-x64-18"
$NewPassword = "secret"

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: Run this script as Administrator." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $PgHbaBak)) {
    Copy-Item $PgHba $PgHbaBak -Force
}

$trust = @"
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
local   replication     all                                     trust
host    replication     all             127.0.0.1/32            trust
host    replication     all             ::1/128                 trust
"@

$content = Get-Content $PgHba -Raw
$content = $content -replace 'local\s+all\s+all\s+scram-sha-256', 'local   all             all                                     trust'
$content = $content -replace 'host\s+all\s+all\s+127\.0\.0\.1/32\s+scram-sha-256', 'host    all             all             127.0.0.1/32            trust'
$content = $content -replace 'host\s+all\s+all\s+::1/128\s+scram-sha-256', 'host    all             all             ::1/128                 trust'
$content = $content -replace 'local\s+replication\s+all\s+scram-sha-256', 'local   replication     all                                     trust'
$content = $content -replace 'host\s+replication\s+all\s+127\.0\.0\.1/32\s+scram-sha-256', 'host    replication     all             127.0.0.1/32            trust'
$content = $content -replace 'host\s+replication\s+all\s+::1/128\s+scram-sha-256', 'host    replication     all             ::1/128                 trust'
[System.IO.File]::WriteAllText($PgHba, $content)

Write-Host ">>> Restarting PostgreSQL service..." -ForegroundColor Yellow
Restart-Service $Service -Force
Start-Sleep -Seconds 4

Write-Host ">>> Setting postgres password to: $NewPassword" -ForegroundColor Yellow
& $Psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "ALTER USER postgres WITH PASSWORD '$NewPassword';"

Write-Host ">>> Restoring secure pg_hba.conf..." -ForegroundColor Yellow
[System.IO.File]::WriteAllText($PgHba, (Get-Content $PgHbaBak -Raw))
Restart-Service $Service -Force
Start-Sleep -Seconds 3

$env:PGPASSWORD = $NewPassword
Write-Host ">>> Testing connection..." -ForegroundColor Yellow
& $Psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "\l"

Write-Host ""
Write-Host ">>> Checking user counts in databases..." -ForegroundColor Green
foreach ($db in @("db_cws", "db_cws_test", "postgres")) {
    try {
        $count = & $Psql -h 127.0.0.1 -p 5432 -U postgres -d $db -tAc "SELECT COUNT(*) FROM users" 2>&1
        if ($LASTEXITCODE -eq 0) { Write-Host "  5432/$db users = $count" }
        else { Write-Host "  5432/$db => $count" }
    } catch {
        Write-Host "  5432/$db => no users table or missing DB"
    }
}

Write-Host ""
Write-Host "DONE. New password: $NewPassword" -ForegroundColor Green
Write-Host "pgAdmin: connect to localhost:5432, user postgres, password $NewPassword"
