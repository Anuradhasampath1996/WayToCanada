# PostgreSQL test database (PHPUnit / CI parity)

**Production/dev data:** Windows PostgreSQL @ `127.0.0.1:5432` → `db_cws`  
**Automated tests:** Docker PostgreSQL @ `127.0.0.1:5433` → `db_cws_test`, `db_lms_test`

PHPUnit reads connection settings from `backend/phpunit.xml` — not from `backend/.env`.

## Root cause of prior test failures

Feature tests failed with `Connection refused` on port **5433** because:

- `phpunit.xml` intentionally targets an **isolated test Postgres** (same as GitHub Actions CI)
- Local dev was migrated to Windows Postgres on **5432** only (`docker-compose.dev.yml` removed Docker Postgres to prevent accidental connection to empty databases)
- No test Postgres instance was running on **5433**

This is correct separation — tests must not run against `db_cws`.

## Start test Postgres

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-test-postgres.ps1
```

Or:

```powershell
docker compose -f docker-compose.test.yml up -d
```

Verify:

```powershell
cd backend
php scripts/check-test-db.php
```

## Run tests

```powershell
cd backend
php artisan test tests/Unit/GovernmentForms/
php artisan test tests/Feature/GovernmentForms/
```

## Stop test Postgres

```powershell
docker compose -f docker-compose.test.yml down
```

Use `down -v` only if you want to wipe the test volume.
