# Backup local WayToCanada PostgreSQL databases (db_cws + db_lms).
# Usage: powershell -ExecutionPolicy Bypass -File scripts\backup-databases.ps1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$BackupDir = Join-Path $Root "backups"
$PgBin = "C:\Program Files\PostgreSQL\18\bin"
$PgDump = Join-Path $PgBin "pg_dump.exe"
$Psql = Join-Path $PgBin "psql.exe"

if (-not (Test-Path $PgDump)) {
    Write-Host "FAIL: pg_dump not found at $PgDump" -ForegroundColor Red
    exit 1
}

$svc = Get-Service postgresql-x64-18 -ErrorAction SilentlyContinue
if (-not $svc -or $svc.Status -ne "Running") {
    Write-Host "FAIL: Windows PostgreSQL service not running (postgresql-x64-18)" -ForegroundColor Red
    Write-Host "Start: net start postgresql-x64-18 (as Administrator)" -ForegroundColor DarkGray
    exit 1
}

$envFile = Join-Path $Root "backend\.env"
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile -Raw
    $pgUser = if ($envContent -match 'DB_CWS_USERNAME=(\S+)') { $Matches[1] } else { "postgres" }
    $pgPass = if ($envContent -match 'DB_CWS_PASSWORD=(\S+)') { $Matches[1] } else { "secret" }
    $pgHost = if ($envContent -match 'DB_CWS_HOST=(\S+)') { $Matches[1] } else { "127.0.0.1" }
    $pgPort = if ($envContent -match 'DB_CWS_PORT=(\d+)') { $Matches[1] } else { "5432" }
    $dbCws  = if ($envContent -match 'DB_CWS_DATABASE=(\S+)') { $Matches[1] } else { "db_cws" }
    $dbLms  = if ($envContent -match 'DB_LMS_DATABASE=(\S+)') { $Matches[1] } else { "db_lms" }
} else {
    $pgUser = "postgres"; $pgPass = "secret"; $pgHost = "127.0.0.1"; $pgPort = "5432"
    $dbCws = "db_cws"; $dbLms = "db_lms"
}

$env:PGPASSWORD = $pgPass
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$ts = Get-Date -Format "yyyy-MM-dd_HHmmss"
$cwsFile = Join-Path $BackupDir "db_cws_backup_$ts.sql"
$lmsFile = Join-Path $BackupDir "db_lms_backup_$ts.sql"
$zipFile = Join-Path $BackupDir "waytocanada_db_backup_$ts.zip"

Write-Host ">>> Backing up $dbCws @ ${pgHost}:${pgPort}..." -ForegroundColor Cyan
& $PgDump -h $pgHost -p $pgPort -U $pgUser -d $dbCws --no-owner --no-acl -f $cwsFile

Write-Host ">>> Backing up $dbLms..." -ForegroundColor Cyan
$dbExists = & $Psql -h $pgHost -p $pgPort -U $pgUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$dbLms'" 2>$null
if ($dbExists -eq "1") {
    & $PgDump -h $pgHost -p $pgPort -U $pgUser -d $dbLms --no-owner --no-acl -f $lmsFile
} else {
    Write-Host "WARN: $dbLms not found — skipping LMS backup" -ForegroundColor Yellow
    $lmsFile = $null
}

$toZip = @($cwsFile)
if ($lmsFile -and (Test-Path $lmsFile)) { $toZip += $lmsFile }
Compress-Archive -Path $toZip -DestinationPath $zipFile -Force

$cwsSize = [math]::Round((Get-Item $cwsFile).Length / 1MB, 2)
$zipSize = [math]::Round((Get-Item $zipFile).Length / 1MB, 2)

Write-Host ""
Write-Host "=== Backup complete ===" -ForegroundColor Green
Write-Host "  db_cws SQL:  $cwsFile ($cwsSize MB)"
if ($lmsFile -and (Test-Path $lmsFile)) {
    $lmsSize = [math]::Round((Get-Item $lmsFile).Length / 1MB, 2)
    Write-Host "  db_lms SQL:  $lmsFile ($lmsSize MB)"
}
Write-Host "  ZIP (download): $zipFile ($zipSize MB)" -ForegroundColor Green
Write-Host ""
Write-Host "Restore db_cws:" -ForegroundColor DarkGray
Write-Host "  psql -h 127.0.0.1 -U postgres -d db_cws -f `"$cwsFile`""
