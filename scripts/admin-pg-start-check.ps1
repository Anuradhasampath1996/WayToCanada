$ErrorActionPreference = "Stop"
$Out = "F:\WayToCanada\WayToCanada\backend\storage\logs\pg-check-result.txt"
$Service = "postgresql-x64-18"
$Psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$PgHba = "C:\Program Files\PostgreSQL\18\data\pg_hba.conf"
$PgHbaBak = "C:\Program Files\PostgreSQL\18\data\pg_hba.conf.bak-wtc"

"=== $(Get-Date) ===" | Out-File $Out

try {
    if ((Get-Service $Service).Status -ne 'Running') {
        Start-Service $Service
        Start-Sleep -Seconds 5
    }
    "Service: Running" | Out-File $Out -Append

    # Set password while trust mode active
    & $Psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "ALTER USER postgres WITH PASSWORD 'secret';" 2>&1 | Out-File $Out -Append

    if (Test-Path $PgHbaBak) {
        Copy-Item $PgHbaBak $PgHba -Force
        Restart-Service $Service -Force
        Start-Sleep -Seconds 4
        "pg_hba restored to scram" | Out-File $Out -Append
    }

    $env:PGPASSWORD = 'secret'
    & $Psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "\l" 2>&1 | Out-File $Out -Append

    foreach ($db in @('db_cws', 'db_cws_test')) {
        $exists = & $Psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" 2>&1
        if ($exists -match '1') {
            $count = & $Psql -h 127.0.0.1 -p 5432 -U postgres -d $db -tAc "SELECT COUNT(*) FROM users" 2>&1
            "$db users=$count" | Out-File $Out -Append
            & $Psql -h 127.0.0.1 -p 5432 -U postgres -d $db -c "SELECT id,email FROM users ORDER BY id LIMIT 5;" 2>&1 | Out-File $Out -Append
        } else {
            "$db missing" | Out-File $Out -Append
        }
    }
    "SUCCESS" | Out-File $Out -Append
} catch {
    "ERROR: $_" | Out-File $Out -Append
}
