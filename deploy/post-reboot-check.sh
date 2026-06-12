#!/bin/bash
set -e
echo "=== SYSTEM ==="
uptime
free -h | head -2
echo ""
echo "=== DOCKER ==="
sudo -u github-actions docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || docker ps -a
echo ""
echo "=== IMAGES ==="
sudo -u github-actions docker images --format '{{.Repository}}' 2>/dev/null | grep waytocanada | sort -u
echo ""
echo "=== LOCAL HEALTH ==="
for port in 3000 3001 8000; do curl -sI "http://127.0.0.1:$port/" 2>/dev/null | head -1 || curl -sI "http://127.0.0.1:$port/up" 2>/dev/null | head -1 || echo "$port: down"; done
