#!/bin/bash
# Quick fix: rebuild admin + consultant portal with HTTPS API URLs (mixed-content fix).
set -euo pipefail

cd /opt/waytocanada
export DOCKER_BUILDKIT=1

echo ">>> Patching backend .env for HTTPS URLs..."
bash deploy/bootstrap-prod-env.sh backend/.env

echo ">>> Rebuilding admin dashboard..."
docker build -f docker/frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://admin.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=https://admin.rcicmaster.com \
  -t waytocanada-frontend-admin \
  "./frontend/Admins Dashbord"

echo ">>> Rebuilding consultant portal..."
docker build -f docker/frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://portal.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=https://portal.rcicmaster.com \
  --build-arg NEXT_PUBLIC_CONSULTANT_WEBSITE_URL=https://www.rcicmaster.com \
  -t waytocanada-frontend-consultant-dash \
  "./frontend/Consultant Dashbord"

docker compose -f docker-compose.prod.yml up -d api frontend-admin frontend-consultant-dash

docker exec wtc_api php artisan config:clear --no-ansi || true
docker exec wtc_api php artisan cache:clear --no-ansi || true

echo ">>> Health checks"
curl -sI -H 'Host: admin.rcicmaster.com' http://127.0.0.1/dashboard/login/v1 | head -3
curl -sI -H 'Host: portal.rcicmaster.com' http://127.0.0.1/ | head -3
echo ">>> Done. Use https://admin.rcicmaster.com/dashboard/login/v1 and https://portal.rcicmaster.com/"
