#!/bin/bash
set -e
ENV_FILE="/opt/waytocanada/backend/.env"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-secret}"

sudo bash /opt/waytocanada/deploy/bootstrap-prod-env.sh "$ENV_FILE" || bash /tmp/bootstrap-prod-env.sh "$ENV_FILE"

echo ""
echo "=== Creating extra DBs in postgres container ==="
sudo -u github-actions docker exec wtc_postgres psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='db_lms'" | grep -q 1 || \
  sudo -u github-actions docker exec wtc_postgres psql -U postgres -c "CREATE DATABASE db_lms;"
sudo -u github-actions docker exec wtc_postgres psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='db_legal'" | grep -q 1 || \
  sudo -u github-actions docker exec wtc_postgres psql -U postgres -c "CREATE DATABASE db_legal;"

echo ""
echo "=== Restart API ==="
cd /opt/waytocanada
sudo -u github-actions docker compose -f docker-compose.prod.yml restart api
sleep 8

echo ""
echo "=== API health ==="
curl -sI http://127.0.0.1:8000/up | head -3 || curl -s http://127.0.0.1:8000/up | head -5

echo ""
echo "=== DB env check ==="
grep -E '^(APP_ENV|APP_URL|DB_CWS_)' "$ENV_FILE" | sed 's/PASSWORD=.*/PASSWORD=***/'
