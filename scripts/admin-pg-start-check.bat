@echo off
set LOG=F:\WayToCanada\WayToCanada\backend\storage\logs\pg-start-result.txt
echo === %date% %time% === > "%LOG%"
net start postgresql-x64-18 >> "%LOG%" 2>&1
if errorlevel 1 (
  echo NET_START_FAILED >> "%LOG%"
  "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" start -D "C:\Program Files\PostgreSQL\18\data" -l "C:\Program Files\PostgreSQL\18\data\log\manual-start.log" >> "%LOG%" 2>&1
)
timeout /t 4 /nobreak >nul
set PGPASSWORD=secret
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "\l" >> "%LOG%" 2>&1
for %%D in (db_cws db_cws_test) do (
  echo --- %%D --- >> "%LOG%"
  "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h 127.0.0.1 -p 5432 -U postgres -d %%D -tAc "SELECT COUNT(*) FROM users" >> "%LOG%" 2>&1
)
echo DONE >> "%LOG%"
