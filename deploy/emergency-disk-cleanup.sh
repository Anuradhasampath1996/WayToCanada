#!/bin/bash
# Run on EC2 when deploy fails with "no space left on device".
# Usage: ssh to server, then: bash /opt/waytocanada/deploy/emergency-disk-cleanup.sh
set -euo pipefail

cd /opt/waytocanada

echo "=== BEFORE ==="
df -h /
docker system df || true

docker compose -f docker-compose.prod.yml stop \
  api frontend frontend-admin frontend-users frontend-consultant-site frontend-consultant-dash \
  2>/dev/null || true

mapfile -t OLD_IMAGES < <(docker images --format '{{.Repository}}:{{.Tag}}' | grep '^waytocanada-' || true)
if [ "${#OLD_IMAGES[@]}" -gt 0 ]; then
  docker rmi -f "${OLD_IMAGES[@]}" 2>/dev/null || true
fi

docker system prune -af 2>/dev/null || true
sudo rm -rf /var/lib/containerd/io.containerd.content.v1.content/ingest/* 2>/dev/null || true
sudo journalctl --vacuum-size=100M 2>/dev/null || true

echo "=== AFTER ==="
df -h /
docker system df || true
echo "Done. Re-run GitHub Actions deploy."
