# Start Windows PostgreSQL 18 and show databases/user counts (Administrator).
$ErrorActionPreference = "Stop"
$Service = "postgresql-x64-18"
$Psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: Run as Administrator." -ForegroundColor Red
    exit 1
}

$svc = Get-Service $Service -ErrorAction SilentlyContinue
if ($svc.Status -ne 'Running') {
    Write-Host ">>> Starting $Service ..." -ForegroundColor Yellow
    Start-Service $Service
    Start-Sleep -Seconds 4
}

$env:PGPASSWORD = 'secret'
Write-Host ">>> Databases on port 5432:" -ForegroundColor Green
& $Psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "\l"

foreach ($db in @('db_cws', 'db_cws_test')) {
    Write-Host ">>> Checking $db ..." -ForegroundColor Cyan
    $exists = & $Psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" 2>&1
    if ($exists -match '1') {
        $users = & $Psql -h 127.0.0.1 -p 5432 -U postgres -d $db -tAc "SELECT COUNT(*) FROM users" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  $db users = $users"
            & $Psql -h 127.0.0.1 -p 5432 -U postgres -d $db -c "SELECT id, email, created_at FROM users ORDER BY id LIMIT 10;"
        } else {
            Write-Host "  $db => $users"
        }
    } else {
        Write-Host "  $db does not exist"
    }
}

Write-Host "DONE" -ForegroundColor Green
