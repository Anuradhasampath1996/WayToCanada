#!/bin/bash
# Quick production update: pull latest main + migrate (no full rebuild).
set -euo pipefail

DEPLOY_PATH="/opt/waytocanada"
cd "$DEPLOY_PATH"

git fetch origin main
git reset --hard origin/main
bash deploy/bootstrap-prod-env.sh backend/.env

docker compose -f docker-compose.prod.yml up -d api
sleep 5
docker exec wtc_api php artisan config:clear --no-ansi
docker exec wtc_api php artisan migrate --force --no-ansi
docker exec wtc_api php artisan cache:clear --no-ansi || true

echo ">>> Migrations complete. Current commit:"
git log -1 --oneline
curl -sI http://127.0.0.1:8000/up | head -1 || true
