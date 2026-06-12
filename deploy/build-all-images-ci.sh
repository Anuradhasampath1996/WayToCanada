#!/bin/bash
# Build all production Docker images on GitHub Actions (7GB RAM runner).
# Images are saved and transferred to EC2 — the server never builds.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export DOCKER_BUILDKIT=1

build_frontend() {
  local tag="$1"
  local context="$2"
  shift 2
  echo ">>> Building $tag ..."
  docker build -f docker/frontend/Dockerfile "$@" -t "$tag" "$context"
}

build_frontend waytocanada-frontend-public "./frontend/Publick website" \
  --build-arg NEXT_PUBLIC_API_URL=http://www.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://www.rcicmaster.com \
  --build-arg NEXT_PUBLIC_USER_DASHBOARD_URL=http://app.rcicmaster.com \
  --build-arg NEXT_PUBLIC_CONSULTANT_WEBSITE_URL=http://consultant.rcicmaster.com

build_frontend waytocanada-frontend-admin "./frontend/Admins Dashbord" \
  --build-arg NEXT_PUBLIC_API_URL=http://admin.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://admin.rcicmaster.com

build_frontend waytocanada-frontend-users "./frontend/Public users Dashbord" \
  --build-arg NEXT_PUBLIC_API_URL=http://app.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://app.rcicmaster.com \
  --build-arg NEXT_PUBLIC_OCR_URL=http://www.rcicmaster.com

build_frontend waytocanada-frontend-consultant-site "./frontend/Consultant Website" \
  --build-arg NEXT_PUBLIC_API_URL=http://consultant.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://consultant.rcicmaster.com \
  --build-arg NEXT_PUBLIC_CONSULTANT_DASHBOARD_URL=http://portal.rcicmaster.com

build_frontend waytocanada-frontend-consultant-dash "./frontend/Consultant Dashbord" \
  --build-arg NEXT_PUBLIC_API_URL=http://portal.rcicmaster.com \
  --build-arg NEXT_PUBLIC_APP_URL=http://portal.rcicmaster.com

echo ">>> Building waytocanada-api ..."
docker build -f docker/php/Dockerfile -t waytocanada-api .

echo ">>> All images built on CI runner."
