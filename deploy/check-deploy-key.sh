#!/bin/bash
echo "=== github-actions deploy PUBLIC key (GitHub Deploy keys walata meka add karanna) ==="
sudo cat /home/github-actions/.ssh/github_deploy.pub 2>/dev/null || echo "MISSING github_deploy.pub"

echo ""
echo "=== github-actions SSH config ==="
sudo cat /home/github-actions/.ssh/config 2>/dev/null || echo "NO config"

echo ""
echo "=== authorized_keys (github-actions login) ==="
sudo cat /home/github-actions/.ssh/authorized_keys 2>/dev/null | head -3

echo ""
echo "=== git fetch test ==="
sudo -u github-actions bash -lc 'cd /opt/waytocanada && git fetch origin main && git log -1 --oneline'

echo ""
echo "=== docker containers ==="
sudo -u github-actions docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || docker ps

echo ""
echo "=== disk space ==="
df -h /
