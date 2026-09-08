# Start PostgreSQL test instance on port 5433 (CI-parity, isolated from dev db_cws @ 5432).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "Starting test PostgreSQL on 127.0.0.1:5433 ..."
docker compose -f "$Root\docker-compose.test.yml" up -d

Write-Host "Waiting for Postgres healthcheck ..."
$ready = $false
for ($i = 1; $i -le 30; $i++) {
    try {
        $null = docker exec wtc_postgres_test pg_isready -U postgres 2>$null
        if ($LASTEXITCODE -eq 0) {
            $ready = $true
            break
        }
    } catch {}
    Start-Sleep -Seconds 2
}

if (-not $ready) {
    Write-Error "Postgres test container did not become ready."
    exit 1
}

Write-Host "Test databases:"
docker exec wtc_postgres_test psql -U postgres -d postgres -c "\l" | Select-String "db_.*_test"

Write-Host ""
Write-Host "Run tests from backend/:"
Write-Host "  php artisan test tests/Feature/GovernmentForms/"
