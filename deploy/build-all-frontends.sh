#!/bin/bash
# Build all production images sequentially on EC2 (low-memory safe). Demo Dashboard excluded.
set -euo pipefail

cd /opt/waytocanada
export DOCKER_BUILDKIT=1

build_image() {
  local tag="$1"
  shift
  echo ">>> Building $tag ..."
  local attempt=1
  local max=3
  while [ "$attempt" -le "$max" ]; do
    if docker build -f docker/frontend/Dockerfile "$@" -t "$tag"; then
      docker image prune -f 2>/dev/null || true
      df -h / | tail -1
      return 0
    fi
    echo ">>> Build failed for $tag (attempt $attempt/$max). Retrying..."
    docker buildx prune -f 2>/dev/null || true
    sleep 5
    attempt=$((attempt + 1))
  done
  echo "ERROR: docker build failed for $tag after $max attempts"
  return 1
}

build_frontend() {
  local tag="$1"
  local context="$2"
  shift 2
  build_image "$tag" "$@" "$context"
}

echo ">>> Building waytocanada-api ..."
attempt=1
max=3
while [ "$attempt" -le "$max" ]; do
  if docker build -f docker/php/Dockerfile -t waytocanada-api .; then
    break
  fi
  echo ">>> API build failed (attempt $attempt/$max). Retrying..."
  docker buildx prune -f 2>/dev/null || true
  sleep 5
  attempt=$((attempt + 1))
done
if [ "$attempt" -gt "$max" ]; then
  echo "ERROR: waytocanada-api build failed"
  exit 1
fi
docker image prune -f 2>/dev/null || true

build_frontend waytocanada-frontend-public "./frontend/Publick website" \
  --build-arg NEXT_PUBLIC_API_URL=https://apply.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=https://apply.rcicmaster.com \
  --build-arg NEXT_PUBLIC_USER_DASHBOARD_URL=https://app.rcicmaster.com \
  --build-arg NEXT_PUBLIC_CONSULTANT_WEBSITE_URL=https://www.rcicmaster.com

build_frontend waytocanada-frontend-admin "./frontend/Admins Dashbord" \
  --build-arg NEXT_PUBLIC_API_URL=https://admin.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=https://admin.rcicmaster.com

build_frontend waytocanada-frontend-users "./frontend/Public users Dashbord" \
  --build-arg NEXT_PUBLIC_API_URL=https://app.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=https://app.rcicmaster.com \
  --build-arg NEXT_PUBLIC_PUBLIC_WEBSITE_URL=https://apply.rcicmaster.com \
  --build-arg NEXT_PUBLIC_OCR_URL=https://apply.rcicmaster.com

build_frontend waytocanada-frontend-consultant-site "./frontend/Consultant Website" \
  --build-arg NEXT_PUBLIC_API_URL=https://www.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=https://www.rcicmaster.com \
  --build-arg NEXT_PUBLIC_CONSULTANT_DASHBOARD_URL=https://portal.rcicmaster.com

build_frontend waytocanada-frontend-consultant-dash "./frontend/Consultant Dashbord" \
  --build-arg NEXT_PUBLIC_API_URL=https://portal.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=https://portal.rcicmaster.com \
  --build-arg NEXT_PUBLIC_CONSULTANT_WEBSITE_URL=https://www.rcicmaster.com

echo ">>> All production images built on server."
