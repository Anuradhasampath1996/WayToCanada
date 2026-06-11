#!/bin/bash
# Maximize free disk before streaming new images (keeps Postgres data).
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/waytocanada}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

cd "$DEPLOY_PATH"

echo ">>> Disk before deploy prep:"
df -h / | tail -1
docker system df 2>/dev/null || true

echo ">>> Stopping app containers (postgres stays up)..."
docker compose -f "$COMPOSE_FILE" stop \
  api frontend frontend-admin frontend-users frontend-consultant-site frontend-consultant-dash \
  2>/dev/null || true

echo ">>> Removing old waytocanada images..."
mapfile -t OLD_IMAGES < <(docker images --format '{{.Repository}}:{{.Tag}}' | grep '^waytocanada-' || true)
if [ "${#OLD_IMAGES[@]}" -gt 0 ]; then
  docker rmi -f "${OLD_IMAGES[@]}" 2>/dev/null || true
fi

docker builder prune -af 2>/dev/null || true
docker image prune -af 2>/dev/null || true
docker container prune -f 2>/dev/null || true

# Partial data from failed docker load attempts
find /var/lib/docker/tmp -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true
sudo rm -rf /var/lib/containerd/io.containerd.content.v1.content/ingest/* 2>/dev/null || true

echo ">>> Disk after deploy prep:"
df -h / | tail -1
docker system df 2>/dev/null || true

AVAIL_KB=$(df / | awk 'NR==2 {print $4}')
if [ "${AVAIL_KB:-0}" -lt 3145728 ]; then
  echo "WARNING: Less than 3GB free on /. Deploy may fail — run: docker system prune -af"
fi
