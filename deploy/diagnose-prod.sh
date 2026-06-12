#!/bin/bash
set -e
echo "=== DISK ==="
df -h /

echo ""
echo "=== DOCKER CONTAINERS ==="
sudo -u github-actions docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || docker ps -a

echo ""
echo "=== LOCAL PORT CHECK ==="
curl -sI http://127.0.0.1:8000/ 2>/dev/null | head -3 || echo "8000: no response"
curl -sI http://127.0.0.1:3000/ 2>/dev/null | head -3 || echo "3000: no response (frontend missing = 502)"

echo ""
echo "=== NGINX CONFIG ==="
sudo nginx -t 2>&1
echo "--- sites-enabled ---"
sudo ls -la /etc/nginx/sites-enabled/ 2>/dev/null
sudo cat /etc/nginx/sites-enabled/* 2>/dev/null | head -80

echo ""
echo "=== BACKEND .ENV (DB only, no secrets) ==="
if [ -f /opt/waytocanada/backend/.env ]; then
  grep -E '^(APP_ENV|APP_URL|DB_|POSTGRES_)' /opt/waytocanada/backend/.env | sed 's/PASSWORD=.*/PASSWORD=***/'
else
  echo "backend/.env MISSING"
fi

echo ""
echo "=== API LOGS (last 20) ==="
sudo -u github-actions docker logs wtc_api --tail 20 2>&1 || true

echo ""
echo "=== REPO / COMPOSE ==="
cd /opt/waytocanada 2>/dev/null && git log -1 --oneline && ls docker-compose*.yml 2>/dev/null
