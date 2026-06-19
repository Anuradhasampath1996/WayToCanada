#!/bin/bash
# Build each Docker image on GitHub Actions and stream it to EC2 immediately.
# API is streamed first while disk is empty; old images are removed before deploy.
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

remote_prepare() {
  echo ">>> Preparing EC2 for deploy (stop apps, remove old images)..."
  ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" \
    "bash -s" < deploy/ec2-prepare-deploy.sh
}

remote_cleanup() {
  echo ">>> Cleaning EC2 disk before image load..."
  ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" \
    "bash -s" < deploy/ec2-docker-cleanup.sh
}

stream_image() {
  local tag="$1"
  local service="${2:-}"

  remote_cleanup

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
  echo ">>> Starting ${SERVICE}..."
  docker compose -f "$COMPOSE_FILE" up -d --no-build "$SERVICE"
fi

docker image prune -af 2>/dev/null || true
docker builder prune -af 2>/dev/null || true

echo ">>> Disk after ${TAG}:"
df -h / | tail -1
docker system df 2>/dev/null || true
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

remote_prepare

# API first — load while EC2 disk is mostly empty (was failing when loaded last).
echo ">>> Building waytocanada-api ..."
docker build -f docker/php/Dockerfile -t waytocanada-api .
stream_image waytocanada-api api

build_frontend waytocanada-frontend-public frontend "./frontend/Publick website" \
  --build-arg NEXT_PUBLIC_API_URL=http://apply.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://apply.rcicmaster.com \
  --build-arg NEXT_PUBLIC_USER_DASHBOARD_URL=http://app.rcicmaster.com \
  --build-arg NEXT_PUBLIC_CONSULTANT_WEBSITE_URL=http://www.rcicmaster.com

build_frontend waytocanada-frontend-admin frontend-admin "./frontend/Admins Dashbord" \
  --build-arg NEXT_PUBLIC_API_URL=http://admin.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://admin.rcicmaster.com

build_frontend waytocanada-frontend-users frontend-users "./frontend/Public users Dashbord" \
  --build-arg NEXT_PUBLIC_API_URL=http://app.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://app.rcicmaster.com \
  --build-arg NEXT_PUBLIC_PUBLIC_WEBSITE_URL=http://apply.rcicmaster.com \
  --build-arg NEXT_PUBLIC_OCR_URL=http://apply.rcicmaster.com

build_frontend waytocanada-frontend-consultant-site frontend-consultant-site "./frontend/Consultant Website" \
  --build-arg NEXT_PUBLIC_API_URL=http://www.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://www.rcicmaster.com \
  --build-arg NEXT_PUBLIC_CONSULTANT_DASHBOARD_URL=http://portal.rcicmaster.com

build_frontend waytocanada-frontend-consultant-dash frontend-consultant-dash "./frontend/Consultant Dashbord" \
  --build-arg NEXT_PUBLIC_API_URL=http://portal.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://portal.rcicmaster.com \
  --build-arg NEXT_PUBLIC_CONSULTANT_WEBSITE_URL=http://www.rcicmaster.com

echo ">>> All images built and streamed to EC2."
