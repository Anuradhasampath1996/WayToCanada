#!/bin/bash
# Build all production images sequentially on EC2 (low-memory safe). Demo Dashboard excluded.
set -euo pipefail

cd /opt/waytocanada
export DOCKER_BUILDKIT=1

build_image() {
  local tag="$1"
  shift
  echo ">>> Building $tag ..."
  docker build -f docker/frontend/Dockerfile "$@" -t "$tag"
  docker image prune -f 2>/dev/null || true
  docker builder prune -f 2>/dev/null || true
  df -h / | tail -1
}

build_frontend() {
  local tag="$1"
  local context="$2"
  shift 2
  build_image "$tag" "$@" "$context"
}

echo ">>> Building waytocanada-api ..."
docker build -f docker/php/Dockerfile -t waytocanada-api .
docker image prune -f 2>/dev/null || true
docker builder prune -f 2>/dev/null || true

build_frontend waytocanada-frontend-public "./frontend/Publick website" \
  --build-arg NEXT_PUBLIC_API_URL=http://apply.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://apply.rcicmaster.com \
  --build-arg NEXT_PUBLIC_USER_DASHBOARD_URL=http://app.rcicmaster.com \
  --build-arg NEXT_PUBLIC_CONSULTANT_WEBSITE_URL=http://www.rcicmaster.com

build_frontend waytocanada-frontend-admin "./frontend/Admins Dashbord" \
  --build-arg NEXT_PUBLIC_API_URL=http://admin.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://admin.rcicmaster.com

build_frontend waytocanada-frontend-users "./frontend/Public users Dashbord" \
  --build-arg NEXT_PUBLIC_API_URL=http://app.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://app.rcicmaster.com \
  --build-arg NEXT_PUBLIC_PUBLIC_WEBSITE_URL=http://apply.rcicmaster.com \
  --build-arg NEXT_PUBLIC_OCR_URL=http://apply.rcicmaster.com

build_frontend waytocanada-frontend-consultant-site "./frontend/Consultant Website" \
  --build-arg NEXT_PUBLIC_API_URL=http://www.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://www.rcicmaster.com \
  --build-arg NEXT_PUBLIC_CONSULTANT_DASHBOARD_URL=http://portal.rcicmaster.com

build_frontend waytocanada-frontend-consultant-dash "./frontend/Consultant Dashbord" \
  --build-arg NEXT_PUBLIC_API_URL=http://portal.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://portal.rcicmaster.com \
  --build-arg NEXT_PUBLIC_CONSULTANT_WEBSITE_URL=http://www.rcicmaster.com

echo ">>> All production images built on server."
