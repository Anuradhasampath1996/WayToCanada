#!/bin/bash
set -euo pipefail
cd /opt/waytocanada
git fetch origin main
git reset --hard origin/main
export DOCKER_BUILDKIT=1

build_one() {
  local tag="$1" context="$2"
  shift 2
  if docker image inspect "${tag}:latest" >/dev/null 2>&1; then
    echo ">>> Image $tag exists, skipping build"
    return 0
  fi
  echo ">>> BUILD $tag"
  docker build -f docker/frontend/Dockerfile "$@" -t "$tag" "$context"
}

docker compose -f docker-compose.prod.yml up -d postgres api frontend frontend-admin frontend-users

build_one waytocanada-frontend-consultant-site "./frontend/Consultant Website" \
  --build-arg NEXT_PUBLIC_API_URL=http://consultant.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://consultant.rcicmaster.com \
  --build-arg NEXT_PUBLIC_CONSULTANT_DASHBOARD_URL=http://portal.rcicmaster.com \
  --build-arg NEXT_PUBLIC_ADMIN_DASHBOARD_URL=http://admin.rcicmaster.com \
  --build-arg NEXT_PUBLIC_USER_DASHBOARD_URL=http://app.rcicmaster.com
docker compose -f docker-compose.prod.yml up -d frontend-consultant-site

build_one waytocanada-frontend-consultant-dash "./frontend/Consultant Dashbord" \
  --build-arg NEXT_PUBLIC_API_URL=http://portal.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://portal.rcicmaster.com
docker compose -f docker-compose.prod.yml up -d frontend-consultant-dash

sudo cp deploy/nginx/rcicmaster.conf /etc/nginx/sites-available/rcicmaster.com
sudo ln -sf /etc/nginx/sites-available/rcicmaster.com /etc/nginx/sites-enabled/rcicmaster.com
sudo nginx -t
sudo systemctl reload nginx

docker compose -f docker-compose.prod.yml ps
echo "=== HEALTH ==="
for port in 3000 3001 3002 3003 3005 8000; do
  code=$(curl -sI "http://127.0.0.1:$port/" 2>/dev/null | head -1)
  [ -z "$code" ] && code=$(curl -sI "http://127.0.0.1:$port/up" 2>/dev/null | head -1)
  echo "$port: ${code:-down}"
done
