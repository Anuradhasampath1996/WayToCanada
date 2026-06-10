#!/bin/bash
set -euo pipefail
cd /opt/waytocanada
git fetch origin main
git reset --hard origin/main
export COMPOSE_PARALLEL_LIMIT=1
export DOCKER_BUILDKIT=1
docker compose -f docker-compose.prod.yml build --no-deps frontend
docker compose -f docker-compose.prod.yml up -d frontend
sleep 10
docker compose -f docker-compose.prod.yml ps
curl -sI http://127.0.0.1:3000/ | head -3
curl -sI http://127.0.0.1/ -H 'Host: www.lightersmenia.com' | head -5
