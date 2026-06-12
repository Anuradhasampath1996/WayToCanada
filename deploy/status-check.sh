#!/bin/bash
echo "=== DOCKER ==="
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || sudo -u github-actions docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
echo ""
echo "=== BUILD PROCESS ==="
ps aux | grep -E 'docker build|next build|pnpm' | grep -v grep | head -5
echo ""
echo "=== DISK/MEM ==="
df -h / | tail -1
free -h | head -2
