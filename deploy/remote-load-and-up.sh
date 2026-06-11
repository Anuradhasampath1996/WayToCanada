#!/bin/bash
# Load pre-built Docker images on EC2 and start containers (no build on server).
set -euo pipefail

DEPLOY_PATH="/opt/waytocanada"

resolve_image_archive() {
  local hint="${1:-}"
  local candidates=()
  if [ -n "$hint" ]; then candidates+=("$hint"); fi
  candidates+=(
    "/tmp/deploy-images.tar.gz"
    "/tmp/deploy-images.tar.gz/deploy-images.tar.gz"
    "/tmp/deploy-images.tar"
  )
  for path in "${candidates[@]}"; do
    if [ -f "$path" ] && [ -s "$path" ]; then
      echo "$path"
      return 0
    fi
  done
  echo "ERROR: deploy image archive not found under /tmp" >&2
  find /tmp -maxdepth 3 -type f \( -name 'deploy-images.tar.gz' -o -name 'deploy-images.tar' \) -ls 2>/dev/null || true
  exit 1
}

IMAGE_ARCHIVE=$(resolve_image_archive "${1:-}")

cd "$DEPLOY_PATH"

echo ">>> Configuring GitHub SSH for git fetch..."
mkdir -p ~/.ssh
chmod 700 ~/.ssh
DEPLOY_KEY="$HOME/.ssh/github_deploy"
if [ -f "$DEPLOY_KEY" ]; then
  if [ ! -f ~/.ssh/config ] || ! grep -q "Host github.com" ~/.ssh/config; then
    cat >> ~/.ssh/config << EOF
Host github.com
  HostName github.com
  User git
  IdentityFile ${DEPLOY_KEY}
  IdentitiesOnly yes
EOF
    chmod 600 ~/.ssh/config
  fi
  ssh-keyscan -t ed25519,rsa github.com >> ~/.ssh/known_hosts 2>/dev/null || true
  chmod 600 ~/.ssh/known_hosts 2>/dev/null || true
fi

git remote set-url origin git@github.com:Anuradhasampath1996/WayToCanada.git

echo ">>> Pulling latest config from main (no build)..."
if ! git fetch origin main; then
  echo "ERROR: Server cannot read from GitHub (Permission denied publickey)."
  exit 1
fi
git reset --hard origin/main

echo ">>> Clearing stale Laravel caches..."
rm -f backend/bootstrap/cache/*.php

bash deploy/bootstrap-prod-env.sh backend/.env

echo ">>> Archive: $IMAGE_ARCHIVE ($(du -h "$IMAGE_ARCHIVE" | cut -f1))"
file "$IMAGE_ARCHIVE"

if [ -f "/tmp/deploy-images.tar.gz.sha256" ]; then
  echo ">>> Verifying archive checksum..."
  (cd /tmp && sha256sum -c deploy-images.tar.gz.sha256)
fi

TAR_PATH="/tmp/deploy-images.tar"
rm -f "$TAR_PATH"

if [[ "$IMAGE_ARCHIVE" == *.gz ]]; then
  echo ">>> Verifying gzip integrity..."
  gzip -t "$IMAGE_ARCHIVE"
  echo ">>> Decompressing archive..."
  gunzip -c "$IMAGE_ARCHIVE" > "$TAR_PATH"
else
  cp "$IMAGE_ARCHIVE" "$TAR_PATH"
fi

echo ">>> Loading pre-built Docker images..."
docker load -i "$TAR_PATH"

rm -f "$TAR_PATH" "$IMAGE_ARCHIVE" /tmp/deploy-images.tar.gz.sha256

echo ">>> Pruning dangling images to free disk..."
docker image prune -f || true

echo ">>> Starting containers (--no-build)..."
docker compose -f docker-compose.prod.yml up -d --remove-orphans --no-build \
  postgres api frontend frontend-admin frontend-users frontend-consultant-site frontend-consultant-dash

docker exec wtc_postgres psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='db_lms'" | grep -q 1 || \
  docker exec wtc_postgres psql -U postgres -c "CREATE DATABASE db_lms;"
docker exec wtc_postgres psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='db_legal'" | grep -q 1 || \
  docker exec wtc_postgres psql -U postgres -c "CREATE DATABASE db_legal;"

sudo cp deploy/nginx/lightersmenia.conf /etc/nginx/sites-available/lightersmenia.com
sudo ln -sf /etc/nginx/sites-available/lightersmenia.com /etc/nginx/sites-enabled/lightersmenia.com
sudo nginx -t
sudo systemctl reload nginx

docker compose -f docker-compose.prod.yml ps
echo ">>> Deploy finished successfully (images built on GitHub Actions)."
