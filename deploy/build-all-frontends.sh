#!/bin/bash
# Build all production frontends sequentially (low-memory EC2). Demo Dashboard excluded.
set -euo pipefail

cd /opt/waytocanada
export DOCKER_BUILDKIT=1

build_frontend() {
  local tag="$1"
  local context="$2"
  shift 2
  echo ">>> Building $tag ..."
  docker build -f docker/frontend/Dockerfile "$@" -t "$tag" "$context"
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

echo ">>> All frontend images built."
