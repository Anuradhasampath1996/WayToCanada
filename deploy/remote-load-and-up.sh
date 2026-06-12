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
  return 1
}

load_images_from_archive() {
  local image_archive="$1"

  echo ">>> Archive: $image_archive ($(du -h "$image_archive" | cut -f1))"
  file "$image_archive"

  if [ -f "/tmp/deploy-images.tar.gz.sha256" ]; then
    echo ">>> Verifying archive checksum..."
    (cd /tmp && sha256sum -c deploy-images.tar.gz.sha256)
  fi

  local tar_path="/tmp/deploy-images.tar"
  rm -f "$tar_path"

  if [[ "$image_archive" == *.gz ]]; then
    echo ">>> Verifying gzip integrity..."
    gzip -t "$image_archive"
    echo ">>> Decompressing archive..."
    gunzip -c "$image_archive" > "$tar_path"
  else
    cp "$image_archive" "$tar_path"
  fi

  echo ">>> Loading pre-built Docker images..."
  docker load -i "$tar_path"

  rm -f "$tar_path" "$image_archive" /tmp/deploy-images.tar.gz.sha256
}

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

if [ "${SKIP_IMAGE_LOAD:-0}" = "1" ]; then
  echo ">>> Skipping archive load (images already streamed from CI)."
elif archive="$(resolve_image_archive "${1:-}")"; then
  load_images_from_archive "$archive"
else
  echo "ERROR: deploy image archive not found and SKIP_IMAGE_LOAD is not set." >&2
  find /tmp -maxdepth 3 -type f \( -name 'deploy-images.tar.gz' -o -name 'deploy-images.tar' \) -ls 2>/dev/null || true
  exit 1
fi

echo ">>> Pruning unused Docker data to free disk..."
docker image prune -af 2>/dev/null || true
docker builder prune -af 2>/dev/null || true
df -h / | tail -1

echo ">>> Starting containers (--no-build)..."
docker compose -f docker-compose.prod.yml up -d --remove-orphans --no-build \
  postgres api frontend frontend-admin frontend-users frontend-consultant-site frontend-consultant-dash

docker exec wtc_postgres psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='db_lms'" | grep -q 1 || \
  docker exec wtc_postgres psql -U postgres -c "CREATE DATABASE db_lms;"
docker exec wtc_postgres psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='db_legal'" | grep -q 1 || \
  docker exec wtc_postgres psql -U postgres -c "CREATE DATABASE db_legal;"

sudo cp deploy/nginx/rcicmaster.conf /etc/nginx/sites-available/rcicmaster.com
sudo ln -sf /etc/nginx/sites-available/rcicmaster.com /etc/nginx/sites-enabled/rcicmaster.com
sudo nginx -t
sudo systemctl reload nginx

docker compose -f docker-compose.prod.yml ps
echo ">>> Deploy finished successfully (images built on GitHub Actions)."
