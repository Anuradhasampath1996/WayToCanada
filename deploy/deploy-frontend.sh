#!/bin/bash
set -euo pipefail
cd /opt/waytocanada
git fetch origin main
git reset --hard origin/main
bash deploy/bootstrap-prod-env.sh backend/.env
rm -f backend/bootstrap/cache/*.php
docker builder prune -af || true
export COMPOSE_PARALLEL_LIMIT=1
docker compose -f docker-compose.prod.yml build postgres api frontend
docker compose -f docker-compose.prod.yml up -d --remove-orphans postgres api frontend
sleep 12
docker compose -f docker-compose.prod.yml ps
curl -sI http://127.0.0.1:3000/ | head -3
curl -sI http://127.0.0.1:8000/up | head -3
curl -sI http://127.0.0.1/ -H 'Host: www.lightersmenia.com' | head -3
