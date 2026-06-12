#!/bin/bash
set -e
cd /opt/waytocanada
sudo cp /tmp/docker-compose.prod.yml docker-compose.prod.yml 2>/dev/null || true
sudo -u github-actions docker compose -f docker-compose.prod.yml up -d --force-recreate api
sleep 10
sudo -u github-actions docker exec wtc_api sh -c 'php artisan config:clear; php artisan migrate --force'
curl -sI http://127.0.0.1:8000/up | head -3
