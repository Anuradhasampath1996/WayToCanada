#!/bin/bash
set -euo pipefail
cd /opt/waytocanada
export DOCKER_BUILDKIT=1

build_and_start() {
  local tag="$1" context="$2"
  shift 2
  echo ">>> BUILD $tag"
  docker build -f docker/frontend/Dockerfile "$@" -t "$tag" "$context"
}

docker compose -f docker-compose.prod.yml up -d postgres api frontend

if docker image inspect waytocanada-frontend-admin:latest >/dev/null 2>&1; then
  echo ">>> Admin image exists, starting..."
  docker compose -f docker-compose.prod.yml up -d frontend-admin
else
  build_and_start waytocanada-frontend-admin "./frontend/Admins Dashbord" \
    --build-arg NEXT_PUBLIC_API_URL=http://admin.rcicmaster.com \
    --build-arg NEXT_PUBLIC_APP_URL=http://admin.rcicmaster.com
  docker compose -f docker-compose.prod.yml up -d frontend-admin
fi

build_and_start waytocanada-frontend-users "./frontend/Public users Dashbord" \
  --build-arg NEXT_PUBLIC_API_URL=http://app.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://app.rcicmaster.com \
  --build-arg NEXT_PUBLIC_OCR_URL=http://www.rcicmaster.com
docker compose -f docker-compose.prod.yml up -d frontend-users

build_and_start waytocanada-frontend-consultant-site "./frontend/Consultant Website" \
  --build-arg NEXT_PUBLIC_API_URL=http://consultant.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://consultant.rcicmaster.com \
  --build-arg NEXT_PUBLIC_CONSULTANT_DASHBOARD_URL=http://portal.rcicmaster.com
docker compose -f docker-compose.prod.yml up -d frontend-consultant-site

build_and_start waytocanada-frontend-consultant-dash "./frontend/Consultant Dashbord" \
  --build-arg NEXT_PUBLIC_API_URL=http://portal.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://portal.rcicmaster.com
docker compose -f docker-compose.prod.yml up -d frontend-consultant-dash

docker compose -f docker-compose.prod.yml ps
echo "=== HEALTH ==="
for port in 3000 3001 3002 3003 3005; do
  curl -sI "http://127.0.0.1:$port/" 2>/dev/null | head -1 || echo "$port: fail"
done
