@echo off
setlocal
set LOG=F:\WayToCanada\WayToCanada\backend\storage\logs\pg-fix-result.txt
set PGDATA=C:\Program Files\PostgreSQL\18\data
set PSQL=C:\Program Files\PostgreSQL\18\bin\psql.exe
set HBA=%PGDATA%\pg_hba.conf
set HBA_BAK=%PGDATA%\pg_hba.conf.bak-wtc

echo === %date% %time% === > "%LOG%"

powershell -NoProfile -Command ^
  "$c = Get-Content '%HBA_BAK%' -Raw; " ^
  "$c = $c -replace 'scram-sha-256','trust'; " ^
  "[System.IO.File]::WriteAllText('%HBA%', $c)" >> "%LOG%" 2>&1

net start postgresql-x64-18 >> "%LOG%" 2>&1
if errorlevel 1 (
  "%ProgramFiles%\PostgreSQL\18\bin\pg_ctl.exe" start -D "%PGDATA%" -w >> "%LOG%" 2>&1
)
timeout /t 4 /nobreak >nul

"%PSQL%" -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "ALTER USER postgres WITH PASSWORD 'secret';" >> "%LOG%" 2>&1

powershell -NoProfile -Command ^
  "[System.IO.File]::WriteAllText('%HBA%', (Get-Content '%HBA_BAK%' -Raw))" >> "%LOG%" 2>&1

net stop postgresql-x64-18 >> "%LOG%" 2>&1
timeout /t 2 /nobreak >nul
net start postgresql-x64-18 >> "%LOG%" 2>&1
timeout /t 4 /nobreak >nul

set PGPASSWORD=secret
"%PSQL%" -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "\l" >> "%LOG%" 2>&1

for %%D in (db_cws db_cws_test) do (
  echo --- %%D --- >> "%LOG%"
  "%PSQL%" -h 127.0.0.1 -p 5432 -U postgres -d %%D -tAc "SELECT COUNT(*) FROM users" >> "%LOG%" 2>&1
  "%PSQL%" -h 127.0.0.1 -p 5432 -U postgres -d %%D -c "SELECT id,email FROM users ORDER BY id LIMIT 8;" >> "%LOG%" 2>&1
)

echo SUCCESS >> "%LOG%"
