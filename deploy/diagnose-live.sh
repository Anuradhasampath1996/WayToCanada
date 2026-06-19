#!/bin/bash
set -euo pipefail

echo "=== PORT 443 ==="
ss -tlnp | grep ':443' || echo "PORT 443 NOT LISTENING (HTTPS unavailable)"

echo "=== API LOGIN DIRECT ==="
curl -s -w "\nHTTP:%{http_code}\n" -X POST "http://127.0.0.1:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"email":"superadmin@rcicmaster.com","password":"Admin@1234!"}' | head -c 600

echo ""
echo "=== API LOGIN VIA NGINX ==="
curl -s -w "\nHTTP:%{http_code}\n" -X POST "http://127.0.0.1/api/v1/auth/login" \
  -H "Host: admin.rcicmaster.com" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"email":"superadmin@rcicmaster.com","password":"Admin@1234!"}' | head -c 600

echo ""
echo "=== SUPERADMIN USERS ==="
docker exec wtc_postgres psql -U postgres -d db_cws -c "SELECT id, email, name FROM users WHERE email ILIKE '%superadmin%' OR email ILIKE '%waytocanada%' LIMIT 5;"

echo "=== PORTAL / ADMIN HTTP ==="
curl -sI "http://127.0.0.1/" -H "Host: portal.rcicmaster.com" | head -4
curl -sI "http://127.0.0.1/dashboard/login/v1" -H "Host: admin.rcicmaster.com" | head -4

echo "=== DB MIGRATE STATUS ==="
docker exec wtc_api php artisan migrate:status --no-ansi 2>&1 | tail -3
