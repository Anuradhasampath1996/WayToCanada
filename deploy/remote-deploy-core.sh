#!/bin/bash
set -euo pipefail
cd /opt/waytocanada
git fetch origin main
git reset --hard origin/main
rm -f backend/bootstrap/cache/*.php
docker builder prune -af || true
docker system prune -af || true
export COMPOSE_PARALLEL_LIMIT=1
docker compose -f docker-compose.prod.yml build postgres api
docker compose -f docker-compose.prod.yml up -d --remove-orphans postgres api
sleep 10
docker compose -f docker-compose.prod.yml ps
curl -sI http://127.0.0.1:8000/ | head -1 || true
