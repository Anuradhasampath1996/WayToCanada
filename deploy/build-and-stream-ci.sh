#!/bin/bash
# Build each Docker image on GitHub Actions and stream it to EC2 immediately.
# Avoids filling runner disk with one large docker save archive.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export DOCKER_BUILDKIT=1

SSH_HOST="${SSH_HOST:?SSH_HOST is required}"
SSH_USER="${SSH_USER:?SSH_USER is required}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/deploy_key}"
SSH_PORT="${SSH_PORT:-22}"

SSH_OPTS=(-i "$SSH_KEY" -p "$SSH_PORT" -o StrictHostKeyChecking=no)

stream_image() {
  local tag="$1"
  echo ">>> Streaming $tag to EC2..."
  docker save "$tag" | gzip -1 | ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" \
    "set -euo pipefail; gunzip | docker load; echo '>>> Loaded ${tag} on EC2'"
  docker rmi "$tag" >/dev/null 2>&1 || true
  docker builder prune -f >/dev/null 2>&1 || true
}

build_frontend() {
  local tag="$1"
  local context="$2"
  shift 2
  echo ">>> Building $tag ..."
  docker build -f docker/frontend/Dockerfile "$@" -t "$tag" "$context"
  stream_image "$tag"
}

build_frontend waytocanada-frontend-public "./frontend/Publick website" \
  --build-arg NEXT_PUBLIC_API_URL=http://www.lightersmenia.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://www.lightersmenia.com \
  --build-arg NEXT_PUBLIC_USER_DASHBOARD_URL=http://app.lightersmenia.com \
  --build-arg NEXT_PUBLIC_CONSULTANT_WEBSITE_URL=http://consultant.lightersmenia.com

build_frontend waytocanada-frontend-admin "./frontend/Admins Dashbord" \
  --build-arg NEXT_PUBLIC_API_URL=http://admin.lightersmenia.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://admin.lightersmenia.com

build_frontend waytocanada-frontend-users "./frontend/Public users Dashbord" \
  --build-arg NEXT_PUBLIC_API_URL=http://app.lightersmenia.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://app.lightersmenia.com \
  --build-arg NEXT_PUBLIC_OCR_URL=http://www.lightersmenia.com

build_frontend waytocanada-frontend-consultant-site "./frontend/Consultant Website" \
  --build-arg NEXT_PUBLIC_API_URL=http://consultant.lightersmenia.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://consultant.lightersmenia.com \
  --build-arg NEXT_PUBLIC_CONSULTANT_DASHBOARD_URL=http://portal.lightersmenia.com

build_frontend waytocanada-frontend-consultant-dash "./frontend/Consultant Dashbord" \
  --build-arg NEXT_PUBLIC_API_URL=http://portal.lightersmenia.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://portal.lightersmenia.com

echo ">>> Building waytocanada-api ..."
docker build -f docker/php/Dockerfile -t waytocanada-api .
stream_image waytocanada-api

echo ">>> All images built and streamed to EC2."
