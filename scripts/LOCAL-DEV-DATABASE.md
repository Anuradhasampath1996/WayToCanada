# Local development database — READ THIS FIRST

**Very important:** Wrong database = empty users / “data lost”. Your real local data lives on **Windows PostgreSQL**, not Docker `db_cws_test`.

---

## Correct setup (daily development)

| Setting | Value |
|---------|-------|
| **Server** | Windows PostgreSQL 18 |
| **Host** | `127.0.0.1` |
| **Port** | `5432` |
| **Database** | `db_cws` |
| **Username** | `postgres` |
| **Password** | `secret` |

`backend/.env` must contain:

```env
APP_ENV=local
DB_CWS_HOST=127.0.0.1
DB_CWS_PORT=5432
DB_CWS_DATABASE=db_cws
DB_CWS_USERNAME=postgres
DB_CWS_PASSWORD=secret

DB_LMS_HOST=127.0.0.1
DB_LMS_PORT=5432
DB_LMS_DATABASE=db_lms
DB_LMS_USERNAME=postgres
DB_LMS_PASSWORD=secret
```

---

## Database layout (after cleanup — 2026-06-17)

**One server for all local data:** Windows PostgreSQL @ `127.0.0.1:5432`

| Database | Purpose | Status |
|----------|---------|--------|
| `db_cws` | Users, consultants, clients, cases | **KEEP — your real data (5 users)** |
| `db_lms` | LMS courses / exams | Migrated on Windows |
| `db_legal` | Legal hub (when used) | Empty shell, ready for migrations |
| `postgres` | System DB | Do not drop |

**Removed (safe cleanup):**
- Docker Postgres container `wtc_postgres_dev` — stopped/removed from `docker-compose.dev.yml`
- Docker `db_cws_test` — dropped (wrong/empty duplicate, caused “missing users”)
- Docker `db_cws` — dropped (empty, no tables)

CI/GitHub Actions still uses its own temporary Postgres — does not affect your PC.

---

## Single local Postgres (Windows only)

| | Windows PostgreSQL |
|--|-------------------|
| **Port** | `5432` |
| **Password** | `secret` |
| **Main DB** | `db_cws` |
| **Service** | `postgresql-x64-18` |

Docker dev Postgres was **removed** so the app cannot connect to a wrong empty database again.

---

## What went wrong before

1. `backend/.env` had `DB_CWS_DATABASE=db_cws_test` and/or port `5433` (CI config).
2. `start-local-dev.ps1` **overrode** env vars to Docker Postgres `5433`.
3. App connected to an **empty** database → users/consultants “missing”.
4. Data was **not deleted** — it stayed on `db_cws` @ `5432`.

---

## Start local dev (safe)

1. Ensure **Windows PostgreSQL** is running:
   - Services → `postgresql-x64-18` → Running  
   - Or: `net start postgresql-x64-18` (Administrator)

2. Verify database (optional):
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\verify-local-database.ps1
   ```

3. **Run all pending migrations** (after pull / old DB recovery):
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\migrate-all-local.ps1
   ```
   Safe: adds missing tables only — does **not** delete users or client data.

4. Start servers:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\start-local-dev-terminal.ps1
   ```
   API reads **`backend/.env`** — no port override to Docker.

5. Docker is only used for **OCR** (`:8001`) and **LocalStack** (S3). Do not use Docker Postgres for app data.

---

## pgAdmin

| Field | Value |
|-------|-------|
| Name | PostgreSQL 18 (local data) |
| Host | `localhost` |
| Port | `5432` |
| Database | `db_cws` |
| Username | `postgres` |
| Password | `secret` |

Check users:
```sql
SELECT id, email FROM users ORDER BY id;
SELECT COUNT(*) FROM client_profiles;
```

---

## Default logins (local `db_cws`)

| Role | Email | Password |
|------|-------|----------|
| Super admin | `superadmin@waytocanada.ca` | `Admin@1234!` |
| Consultant | `anuradhasampath666@gmail.com` | (your password / Google) |
| Client | `widgetpixels17@gmail.com` | (your password / Google) |

---

## Do NOT do this on local dev

| Action | Risk |
|--------|------|
| Set `DB_CWS_DATABASE=db_cws_test` | Empty DB, no users |
| Set `DB_CWS_PORT=5433` | Docker test DB, not your data |
| Set `APP_ENV=testing` | Tests may wipe DB (`RefreshDatabase`) |
| Run `php artisan test` against `db_cws` | Can destroy real data |
| `docker compose down -v` | Deletes Docker volumes (not Windows PG data) |
| Copy `.env.ci` → `.env` | Wrong database for development |

---

## CI / automated tests only

GitHub Actions and `backend/.env.ci` use:

- Port `5433` (Docker on CI runner)
- Database `db_cws_test`

That is **only for CI**, not for your machine.

---

## Password reset (Windows PostgreSQL)

If you forget the `postgres` password:

```powershell
# Run PowerShell as Administrator
powershell -ExecutionPolicy Bypass -File scripts\reset-windows-postgres-password.ps1
```

Sets password to `secret` and restores secure `pg_hba.conf`.

**Warning:** Do not edit `pg_hba.conf` with editors that add UTF-8 BOM — it prevents PostgreSQL from starting.

---

## Production (AWS)

Production data is on the **EC2 server** (`db_cws` in Docker volume `wtc_pgdata`).  
Local `.env` changes do **not** affect production.

---

## Quick checklist before coding

- [ ] `backend/.env` → `DB_CWS_PORT=5432`, `DB_CWS_DATABASE=db_cws`
- [ ] `APP_ENV=local` (not `testing`)
- [ ] Windows service `postgresql-x64-18` is **Running**
- [ ] `php artisan tinker --execute="echo App\Models\User::count();"` shows your user count (not `0` or `1`)

---

*Last updated: 2026-06-17 — after recovering local data from Windows PostgreSQL `db_cws`.*
