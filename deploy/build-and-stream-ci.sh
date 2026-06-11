#!/bin/bash
# Build each Docker image on GitHub Actions and stream it to EC2 immediately.
# After each load, restart that service and prune old images to avoid EC2 disk full.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export DOCKER_BUILDKIT=1

SSH_HOST="${SSH_HOST:?SSH_HOST is required}"
SSH_USER="${SSH_USER:?SSH_USER is required}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/deploy_key}"
SSH_PORT="${SSH_PORT:-22}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/waytocanada}"

SSH_OPTS=(-i "$SSH_KEY" -p "$SSH_PORT" -o StrictHostKeyChecking=no)
COMPOSE_FILE="docker-compose.prod.yml"

remote_cleanup() {
  echo ">>> Preparing EC2 disk space..."
  ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" \
    "bash -s" < deploy/ec2-docker-cleanup.sh
}

stream_image() {
  local tag="$1"
  local service="${2:-}"

  echo ">>> Streaming $tag to EC2..."
  docker save "$tag" | gzip -1 | ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" bash -s "$tag" "$service" "$DEPLOY_PATH" "$COMPOSE_FILE" <<'REMOTE'
set -euo pipefail
TAG="$1"
SERVICE="$2"
DEPLOY_PATH="$3"
COMPOSE_FILE="$4"

cd "$DEPLOY_PATH"

echo ">>> Loading ${TAG}..."
gunzip | docker load

if [ -n "$SERVICE" ]; then
  echo ">>> Restarting ${SERVICE} with new image..."
  docker compose -f "$COMPOSE_FILE" up -d --no-build "$SERVICE"
fi

echo ">>> Pruning unused images after ${TAG}..."
docker image prune -af 2>/dev/null || true
docker builder prune -af 2>/dev/null || true

echo ">>> Disk after ${TAG}:"
df -h / | tail -1
echo ">>> Loaded ${TAG} on EC2"
REMOTE

  docker rmi "$tag" >/dev/null 2>&1 || true
  docker builder prune -f >/dev/null 2>&1 || true
}

build_frontend() {
  local tag="$1"
  local service="$2"
  local context="$3"
  shift 3
  echo ">>> Building $tag ..."
  docker build -f docker/frontend/Dockerfile "$@" -t "$tag" "$context"
  stream_image "$tag" "$service"
}

remote_cleanup

build_frontend waytocanada-frontend-public frontend "./frontend/Publick website" \
  --build-arg NEXT_PUBLIC_API_URL=http://www.lightersmenia.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://www.lightersmenia.com \
  --build-arg NEXT_PUBLIC_USER_DASHBOARD_URL=http://app.lightersmenia.com \
  --build-arg NEXT_PUBLIC_CONSULTANT_WEBSITE_URL=http://consultant.lightersmenia.com

build_frontend waytocanada-frontend-admin frontend-admin "./frontend/Admins Dashbord" \
  --build-arg NEXT_PUBLIC_API_URL=http://admin.lightersmenia.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://admin.lightersmenia.com

build_frontend waytocanada-frontend-users frontend-users "./frontend/Public users Dashbord" \
  --build-arg NEXT_PUBLIC_API_URL=http://app.lightersmenia.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://app.lightersmenia.com \
  --build-arg NEXT_PUBLIC_OCR_URL=http://www.lightersmenia.com

build_frontend waytocanada-frontend-consultant-site frontend-consultant-site "./frontend/Consultant Website" \
  --build-arg NEXT_PUBLIC_API_URL=http://consultant.lightersmenia.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://consultant.lightersmenia.com \
  --build-arg NEXT_PUBLIC_CONSULTANT_DASHBOARD_URL=http://portal.lightersmenia.com

build_frontend waytocanada-frontend-consultant-dash frontend-consultant-dash "./frontend/Consultant Dashbord" \
  --build-arg NEXT_PUBLIC_API_URL=http://portal.lightersmenia.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://portal.lightersmenia.com

echo ">>> Building waytocanada-api ..."
docker build -f docker/php/Dockerfile -t waytocanada-api .
stream_image waytocanada-api api

echo ">>> All images built and streamed to EC2."
