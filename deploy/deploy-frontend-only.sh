#!/bin/bash
set -euo pipefail
cd /opt/waytocanada
git fetch origin main
git reset --hard origin/main
export DOCKER_BUILDKIT=1
docker build \
  -f docker/frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=http://apply.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://apply.rcicmaster.com \
  -t waytocanada-frontend \
  "./frontend/Publick website"
docker compose -f docker-compose.prod.yml up -d frontend
sleep 12
docker compose -f docker-compose.prod.yml ps
curl -sI http://127.0.0.1:3000/ | head -3
curl -sI http://127.0.0.1/ -H 'Host: www.rcicmaster.com' | head -5
