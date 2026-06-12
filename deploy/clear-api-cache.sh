#!/bin/bash
sudo -u github-actions docker exec wtc_api sh -c 'php artisan config:clear; php artisan cache:clear; php artisan migrate --force'
echo "=== /up ==="
curl -sI http://127.0.0.1:8000/up | head -3
echo "=== /api (sample) ==="
curl -sI http://127.0.0.1:8000/api/v1/health 2>/dev/null | head -3 || curl -sI http://127.0.0.1:8000/api/ | head -3
